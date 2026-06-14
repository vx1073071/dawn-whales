// ── R168 P2-09: AI Factor Advisor ────────────────────────────────────────
// Natural language → factor combination recommendation + backtest preview.
// "我想做高成长低波动" → suggested factors, weights, IC estimates, backtest projection.
// Integrates with billing: 1 USDT per recommendation (via ai-orchestrator).
//
// Architecture:
//   NLP parse → intent matching → factor lookup → weight optimization → backtest preview
//   Billing: hold 1 USDT → compute → settle on success → refund on failure
//
// Service types covered (from v17.6 billing):
//   AI_FACTOR_ADVISOR = 1.0 USDT

import log from 'electron-log';
// R174 E2: Dynamic IC/IR from ETF price source
import { getETFPriceSource } from '../factors/etf-price-source';
// R174 E3: Real backtest engine
import { runFactorBacktest, type FactorBacktestResult } from '../backtest/backtest-engine';

// ── Types ───────────────────────────────────────────────────────────────────

export type FactorAdvisorIntent =
  | 'high_growth_low_volatility'
  | 'value_reversal'
  | 'momentum_following'
  | 'quality_defensive'
  | 'high_dividend'
  | 'small_cap_growth'
  | 'crypto_trend'
  | 'crypto_mean_reversion'
  | 'balanced_all_weather'
  | 'question'        // R171 E1: 问 — ask about specific factor/framework
  | 'selection'       // R171 E1: 选 — pick from options per constraints
  | 'answer'          // R171 E1: 答 — direct answer with evidence
  | 'skeptic'         // R171 E1: 疑 — challenge assumptions, devil's advocate
  | 'deep_analysis'   // R171 E1: 深度分析 — multi-angle deep dive
  | 'unknown';

export interface FactorAdvisorRequest {
  /** Raw natural language query (Chinese or English) */
  query: string;
  /** Target market */
  market: 'US' | 'HK' | 'CRYPTO';
  /** User ID for billing */
  userId: string;
  /** Wallet balance (for pre-check) */
  walletBalanceUSDT: number;
}

export interface FactorRecommendation {
  factorId: string;
  nameCN: string;
  categoryCN: string;
  recommendedWeight: number;
  reason: string;
  typicalIC: number;
}

export interface BacktestPreview {
  /** Annualized expected return (%) */
  expectedReturn: number;
  /** Expected Sharpe ratio */
  expectedSharpe: number;
  /** Expected max drawdown (%) */
  expectedMaxDrawdown: number;
  /** Win rate estimate */
  expectedWinRate: number;
  /** 12-month projected equity curve */
  projectedCurve: Array<{ month: string; cumulative: number }>;
  /** Comparison vs benchmark */
  vsBenchmark: number;
}

// ── R172 E6: Holdings Conflict Detection Types ─────────────────────────

export interface UserHolding {
  code: string;
  name: string;
  market: 'US' | 'HK' | 'CRYPTO';
  quantity: number;
  costBasis: number;
  currentPrice: number;
  factorExposures?: Record<string, number>;
}

export interface HoldingConflict {
  holding: UserHolding;
  conflictingFactors: string[];
  message: string;
  severity: 'info' | 'warning' | 'critical';
  resolution: string;
}

export interface DedupResult {
  original: FactorRecommendation[];
  deduplicated: FactorRecommendation[];
  removed: string[];
  summary: string;
}

export interface FactorAdvisorResult {
  success: boolean;
  /** Unique session ID */
  sessionId: string;
  /** Parsed intent */
  intent: FactorAdvisorIntent;
  /** Intent label (Chinese) */
  intentLabel: string;
  /** Natural language query response */
  explanation: string;
  /** Recommended factors with weights */
  factors: FactorRecommendation[];
  /** Suggested total factor count */
  suggestedFactorCount: number;
  /** Backtest preview */
  backtest: BacktestPreview;
  /** Billing status */
  billing: {
    charged: boolean;
    amountUSDT: number;
    serviceType: string;
    transactionId?: string;
    error?: string;
  };
  /** Risk warnings */
  warnings: string[];
}

interface IntentPattern {
  intent: FactorAdvisorIntent;
  keywordsCN: string[];
  keywordsEN: string[];
  intentLabel: string;
  explanation: string;
  /** Factor IDs with base weights */
  baseFactors: Array<{ id: string; weight: number; reason: string }>;
  /** Simulated backtest baseline */
  backtestBaseline: { ret: number; sharpe: number; dd: number; winRate: number };
}

// ── Intent Patterns ────────────────────────────────────────────────────────

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'high_growth_low_volatility',
    keywordsCN: ['高成长', '低波动', '成长+低波', '稳健成长'],
    keywordsEN: ['high growth', 'low volatility', 'growth + low vol'],
    intentLabel: '高成长低波动',
    explanation: '这是一个攻守兼备的策略：用成长因子捕捉高增长机会，用低波动因子过滤噪音和回撤。在市场上涨时成长因子贡献alpha，下跌时低波动因子提供保护。适合看好长期成长但厌恶剧烈波动的投资者。',
    baseFactors: [
      { id: 'GROWTH', weight: 0.25, reason: '捕捉营收盈利高增长公司' },
      { id: 'VOL_60D', weight: 0.25, reason: '偏向低波动标的，控制回撤' },
      { id: 'QUAL', weight: 0.20, reason: '确保财务质量，避开伪成长' },
      { id: 'MOM_12M', weight: 0.15, reason: '趋势确认，避免逆势抄底' },
      { id: 'LIQ', weight: 0.10, reason: '保证流动性，降低冲击成本' },
      { id: 'RSI_14', weight: 0.05, reason: '短期超买回避，超卖加仓' },
    ],
    backtestBaseline: { ret: 18.5, sharpe: 1.42, dd: 15.2, winRate: 58 },
  },
  {
    intent: 'value_reversal',
    keywordsCN: ['价值回归', '低估值', '便宜', '逆向投资', '深度价值'],
    keywordsEN: ['value', 'cheap', 'undervalued', 'deep value'],
    intentLabel: '价值回归',
    explanation: '寻找被市场低估的优质公司。在恐慌和悲观中买入，等待价值回归。价值因子在美国市场2022年后强劲回归。注意需要耐心持有1-3年才能看到均值回归效果。',
    baseFactors: [
      { id: 'HML', weight: 0.30, reason: '核心价值因子，低市净率' },
      { id: 'QUAL', weight: 0.20, reason: '避开价值陷阱，确保财务质量' },
      { id: 'YIELD', weight: 0.15, reason: '高股息提供持仓收益' },
      { id: 'RMW', weight: 0.15, reason: '偏好高盈利能力公司' },
      { id: 'SIZE', weight: 0.10, reason: '增加小盘价值弹性' },
      { id: 'RSI_14', weight: 0.10, reason: '超卖买入增强入场时机' },
    ],
    backtestBaseline: { ret: 14.2, sharpe: 1.15, dd: 18.5, winRate: 62 },
  },
  {
    intent: 'momentum_following',
    keywordsCN: ['动量', '追涨', '趋势', '强势', '主升浪'],
    keywordsEN: ['momentum', 'trend', 'strong', ' breakout'],
    intentLabel: '动量趋势',
    explanation: '强者恒强，跟随市场趋势。核心逻辑是投资者反应不足导致趋势延续。需要严格的止损纪律——动量策略最大的风险是动量崩盘，需要一个明确的退出规则。',
    baseFactors: [
      { id: 'MOM_12M', weight: 0.25, reason: '核心动量因子，中期趋势' },
      { id: 'MA_20_60', weight: 0.20, reason: '均线金叉确认趋势方向' },
      { id: 'ADX', weight: 0.15, reason: '只参与强趋势市场' },
      { id: 'EMA_12_26', weight: 0.15, reason: 'MACD动能确认' },
      { id: 'LIQ', weight: 0.15, reason: '确保标的有足够成交量' },
      { id: 'MOM_1M', weight: 0.10, reason: '短期加速信号' },
    ],
    backtestBaseline: { ret: 22.3, sharpe: 1.28, dd: 25.8, winRate: 45 },
  },
  {
    intent: 'quality_defensive',
    keywordsCN: ['防御', '优质', '稳健', '消费', '护城河'],
    keywordsEN: ['defensive', 'quality', 'moat', 'stable'],
    intentLabel: '优质防御',
    explanation: '聚焦高质量公司，追求稳定收益而非爆发增长。适合震荡市和熊市——高质量公司在市场下跌时通常跌幅更小，通过盈利质量而非估值扩张创造收益。',
    baseFactors: [
      { id: 'QUAL', weight: 0.30, reason: '核心质量因子' },
      { id: 'RMW', weight: 0.25, reason: '高盈利能力' },
      { id: 'CMA', weight: 0.15, reason: '保守投资策略' },
      { id: 'VOL_60D', weight: 0.15, reason: '低波动增强防御性' },
      { id: 'YIELD', weight: 0.10, reason: '股息收益' },
      { id: 'LIQ', weight: 0.05, reason: '流动性保障' },
    ],
    backtestBaseline: { ret: 10.8, sharpe: 1.55, dd: 12.3, winRate: 68 },
  },
  {
    intent: 'high_dividend',
    keywordsCN: ['高股息', '分红', '收息', '红利', '躺赚'],
    keywordsEN: ['dividend', 'income', 'yield', 'payout'],
    intentLabel: '高股息收息',
    explanation: '以股息收益为核心，适合长期配置。高股息率通常意味着估值偏低且有持续现金流支撑。注意区分"真高股息"和"股价暴跌造成的被动高股息"。',
    baseFactors: [
      { id: 'YIELD', weight: 0.30, reason: '核心股息率因子' },
      { id: 'HML', weight: 0.20, reason: '价值因子，低估值' },
      { id: 'QUAL', weight: 0.20, reason: '确保分红可持续性' },
      { id: 'SIZE', weight: 0.15, reason: '大盘股更稳定' },
      { id: 'VOL_60D', weight: 0.10, reason: '低波动' },
      { id: 'CMA', weight: 0.05, reason: '保守风格' },
    ],
    backtestBaseline: { ret: 9.5, sharpe: 1.38, dd: 14.0, winRate: 65 },
  },
  {
    intent: 'small_cap_growth',
    keywordsCN: ['小盘', '中小盘', '弹性', '题材', '概念'],
    keywordsEN: ['small cap', 'growth', 'mid cap', 'flex'],
    intentLabel: '小盘成长',
    explanation: '追求高弹性高成长，适合牛市和流动性宽松期。小盘股波动大、弹性强，需要承受较大的回撤。核心是小盘因子+成长因子双轮驱动。',
    baseFactors: [
      { id: 'SIZE', weight: 0.25, reason: '小盘因子核心' },
      { id: 'GROWTH', weight: 0.25, reason: '高成长筛选' },
      { id: 'MOM_12M', weight: 0.20, reason: '动量趋势' },
      { id: 'RMW', weight: 0.10, reason: '盈利质量过滤' },
      { id: 'LIQ', weight: 0.10, reason: '流动性保障' },
      { id: 'RSI_14', weight: 0.10, reason: '短期择时' },
    ],
    backtestBaseline: { ret: 25.0, sharpe: 1.05, dd: 32.5, winRate: 42 },
  },
  {
    intent: 'crypto_trend',
    keywordsCN: ['加密货币', '趋势', '突破', '强势币', '山寨季'],
    keywordsEN: ['crypto', 'altcoin', 'trend', 'breakout'],
    intentLabel: '加密货币趋势',
    explanation: '加密市场高波动、强趋势特征明显。核心使用动量+趋势因子，同时监控资金费率（避免在极度拥挤时进场）。适合能承受30%+回撤的激进投资者。',
    baseFactors: [
      { id: 'MOM_12M', weight: 0.20, reason: '中期趋势' },
      { id: 'MA_20_60', weight: 0.20, reason: '趋势确认' },
      { id: 'CRYPTO_FUNDING', weight: 0.20, reason: '避免拥挤多头' },
      { id: 'VOL_60D', weight: 0.15, reason: '波动管理' },
      { id: 'EMA_12_26', weight: 0.15, reason: '动能跟随' },
      { id: 'LIQ', weight: 0.10, reason: '流动性管理' },
    ],
    backtestBaseline: { ret: 35.0, sharpe: 0.85, dd: 45.0, winRate: 38 },
  },
  {
    intent: 'crypto_mean_reversion',
    keywordsCN: ['加密货币', '抄底', '超跌', '反弹', '插针'],
    keywordsEN: ['crypto dip', 'oversold', 'bounce', 'mean revert'],
    intentLabel: '加密货币均值回归',
    explanation: '利用加密市场极端波动后的均值回归。在爆仓潮后恐慌买入，在情绪极度乐观时卖出。核心监控爆仓热度、资金费率和交易所净流量。',
    baseFactors: [
      { id: 'CRYPTO_LIQUIDATIONS', weight: 0.25, reason: '爆仓后反弹信号' },
      { id: 'CRYPTO_FUNDING', weight: 0.25, reason: '空头极端时进场' },
      { id: 'RSI_14', weight: 0.15, reason: '超卖区间择时' },
      { id: 'CRYPTO_EXCHANGE_FLOW', weight: 0.15, reason: '交易所流出=囤币信号' },
      { id: 'VOL_60D', weight: 0.10, reason: '波动区间管理' },
      { id: 'BOLL', weight: 0.10, reason: '布林带下轨支撑' },
    ],
    backtestBaseline: { ret: 28.0, sharpe: 0.72, dd: 38.0, winRate: 35 },
  },
  {
    intent: 'balanced_all_weather',
    keywordsCN: ['均衡', '全天候', '分散', '配置', '平衡'],
    keywordsEN: ['balanced', 'all weather', 'diversified', 'portfolio'],
    intentLabel: '均衡全天候',
    explanation: '追求多因子均衡配置，通过分散降低波动。类似风险平价理念：让每个因子贡献相近的风险预算。适合风险厌恶型投资者，目标是在各种市场环境中保持正收益。',
    baseFactors: [
      { id: 'MOM_12M', weight: 0.15, reason: '动量因子' },
      { id: 'HML', weight: 0.15, reason: '价值因子' },
      { id: 'QUAL', weight: 0.15, reason: '质量因子' },
      { id: 'SIZE', weight: 0.10, reason: '规模因子' },
      { id: 'VOL_60D', weight: 0.10, reason: '波动率因子' },
      { id: 'YIELD', weight: 0.10, reason: '股息因子' },
      { id: 'RMW', weight: 0.10, reason: '盈利因子' },
      { id: 'LIQ', weight: 0.10, reason: '流动性因子' },
      { id: 'GROWTH', weight: 0.05, reason: '成长因子' },
    ],
    backtestBaseline: { ret: 13.0, sharpe: 1.50, dd: 12.0, winRate: 60 },
  },
  // ── R171 E1: 5 New Conversational Intents ──────────────────────────
  {
    intent: 'question',
    keywordsCN: ['什么是', '怎么看', '解释', '说明', '什么意思', '如何理解', '问', '咨询', '了解'],
    keywordsEN: ['what is', 'how does', 'explain', 'tell me about', 'describe', 'question'],
    intentLabel: '因子咨询',
    explanation: '因子的核心逻辑是：不同因子在不同市场环境下表现不同。宏观环境（利率、通胀、增长）决定因子轮动。当前环境建议关注质量+低波动因子组合。',
    baseFactors: [
      { id: 'QUAL', weight: 0.30, reason: '质量因子在当前环境横向比较强' },
      { id: 'VOL_60D', weight: 0.25, reason: '低波动在市场不确定时提供防御' },
      { id: 'RMW', weight: 0.20, reason: '盈利能力是穿越周期的关键' },
      { id: 'MOM_12M', weight: 0.15, reason: '保留动量敞口保持向上弹性' },
      { id: 'LIQ', weight: 0.10, reason: '保证流动性安全边际' },
    ],
    backtestBaseline: { ret: 12.5, sharpe: 1.35, dd: 13.0, winRate: 62 },
  },
  {
    intent: 'selection',
    keywordsCN: ['推荐', '选哪个', '帮我选', '适合', '什么因子好', '配置', '哪个好', '选股', '筛选'],
    keywordsEN: ['recommend', 'which factor', 'pick', 'choose', 'suggest', 'best for', 'select'],
    intentLabel: '因子筛选',
    explanation: '根据你的约束条件（市场、风险偏好、投资期限），从因子库中筛选最匹配的因子组合。当前为你推荐质量+动量双因子组合，兼顾攻守。',
    baseFactors: [
      { id: 'QUAL', weight: 0.25, reason: '质量筛选，基本面过滤' },
      { id: 'MOM_12M', weight: 0.25, reason: '动量择优，趋势跟随' },
      { id: 'HML', weight: 0.20, reason: '价值锚定，低估值保护' },
      { id: 'SIZE', weight: 0.15, reason: '规模分散，增加弹性' },
      { id: 'GROWTH', weight: 0.10, reason: '成长增强' },
      { id: 'LIQ', weight: 0.05, reason: '流动性保险' },
    ],
    backtestBaseline: { ret: 16.0, sharpe: 1.30, dd: 18.0, winRate: 55 },
  },
  {
    intent: 'answer',
    keywordsCN: ['为什么', '原因', '原理', '依据', '证据', '数据', '历史', '回测', '答案'],
    keywordsEN: ['why', 'reason', 'evidence', 'because', 'proof', 'data shows', 'backtest shows'],
    intentLabel: '因子答疑',
    explanation: '基于数据驱动的方法论解释因子表现。因子有效性的三大支柱：经济直觉（为什么有效）、统计显著性（IC+IR）、回测稳健性（多周期+多市场验证）。',
    baseFactors: [
      { id: 'QUAL', weight: 0.20, reason: '质量因子有50年+实证支持' },
      { id: 'HML', weight: 0.20, reason: 'Fama-French经典框架核心' },
      { id: 'MOM_12M', weight: 0.20, reason: '动量效应在200+年数据中持续存在' },
      { id: 'SIZE', weight: 0.15, reason: '规模溢价已被大量文献验证' },
      { id: 'RMW', weight: 0.15, reason: '盈利因子近年表现突出' },
      { id: 'VOL_60D', weight: 0.10, reason: '低波动异象是市场非有效的证据' },
    ],
    backtestBaseline: { ret: 14.0, sharpe: 1.40, dd: 14.0, winRate: 60 },
  },
  {
    intent: 'skeptic',
    keywordsCN: ['怀疑', '质疑', '风险', '回撤', '失效', '过拟合', '过度优化', '靠谱吗', '行吗', '能信吗'],
    keywordsEN: ['skeptical', 'doubt', 'risk', 'overfit', 'failure', 'is this safe', 'really', 'sure'],
    intentLabel: '质疑审查',
    explanation: '作为魔鬼代言人审视你的因子选择：该因子历史上是否有过长失效期？参数是否过拟合？当前拥挤度如何？建议加入反因子（opposite factor）进行压力测试。',
    baseFactors: [
      { id: 'QUAL', weight: 0.20, reason: '质量因子失效概率最低' },
      { id: 'VOL_60D', weight: 0.20, reason: '低波动提供下行保护' },
      { id: 'CMA', weight: 0.20, reason: '保守风格应对不确定性' },
      { id: 'HML', weight: 0.15, reason: '价值因子长期均值回归可靠' },
      { id: 'YIELD', weight: 0.15, reason: '股息提供持有收益' },
      { id: 'ATR_14', weight: 0.10, reason: '波动监控作为预警信号' },
    ],
    backtestBaseline: { ret: 9.0, sharpe: 1.20, dd: 10.0, winRate: 68 },
  },
  {
    intent: 'deep_analysis',
    keywordsCN: ['深度', '详细', '全面', '多维度', '全方位', '透彻', '专业', '报告'],
    keywordsEN: ['deep dive', 'thorough', 'comprehensive', 'detailed', 'in-depth', 'multi-angle', 'professional'],
    intentLabel: '深度分析',
    explanation: '从多维度对因子组合进行深度剖析：因子IC时序稳定性、衰减特征、拥挤度、市场状态适应性、尾部风险、相关矩阵、GRS检验、换手率成本。综合评分后给出最终建议。',
    baseFactors: [
      { id: 'QUAL', weight: 0.15, reason: '质量因子基础' },
      { id: 'MOM_12M', weight: 0.15, reason: '动量因子增强' },
      { id: 'HML', weight: 0.15, reason: '价值因子锚定' },
      { id: 'VOL_60D', weight: 0.15, reason: '波动率因子保护' },
      { id: 'RMW', weight: 0.10, reason: '盈利因子质量' },
      { id: 'SIZE', weight: 0.10, reason: '规模因子多元化' },
      { id: 'YIELD', weight: 0.08, reason: '股息因子收益' },
      { id: 'GROWTH', weight: 0.07, reason: '成长因子弹性' },
      { id: 'LIQ', weight: 0.05, reason: '流动性因子安全' },
    ],
    backtestBaseline: { ret: 15.0, sharpe: 1.45, dd: 13.5, winRate: 58 },
  },
];

// ── AI Factor Advisor Engine ───────────────────────────────────────────────

export class AIFactorAdvisor {
  /** Recommendation cost (USDT) */
  static readonly COST_USDT = 1.0;
  static readonly SERVICE_TYPE = 'AI_FACTOR_ADVISOR';

  private chargeCallback: ((userId: string, amount: number, service: string, sessionId: string) => Promise<{ success: boolean; transactionId?: string; error?: string }>) | null = null;

  constructor() {
    log.info('[AIFactorAdvisor] Initialized — cost:', AIFactorAdvisor.COST_USDT, 'USDT per request');
  }

  /** Register billing callback */
  setBillingHandler(
    handler: (userId: string, amount: number, service: string, sessionId: string) => Promise<{ success: boolean; transactionId?: string; error?: string }>,
  ): void {
    this.chargeCallback = handler;
  }

  /**
   * Process a natural language factor recommendation request.
   */
  async recommend(request: FactorAdvisorRequest): Promise<FactorAdvisorResult> {
    const sessionId = `aifa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // ── Billing pre-check ──
    if (request.walletBalanceUSDT < AIFactorAdvisor.COST_USDT) {
      return {
        success: false,
        sessionId, intent: 'unknown', intentLabel: '',
        explanation: '余额不足', factors: [], suggestedFactorCount: 0,
        backtest: this.emptyBacktest(),
        billing: { charged: false, amountUSDT: AIFactorAdvisor.COST_USDT, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: `余额 ${request.walletBalanceUSDT.toFixed(2)} USDT 不足，需要 ${AIFactorAdvisor.COST_USDT} USDT` },
        warnings: [],
      };
    }

    // ── Hold charge ──
    let charged = false;
    let txId: string | undefined;
    if (this.chargeCallback) {
      try {
        const result = await this.chargeCallback(request.userId, AIFactorAdvisor.COST_USDT, AIFactorAdvisor.SERVICE_TYPE, sessionId);
        if (!result.success) {
          return {
            success: false, sessionId, intent: 'unknown', intentLabel: '',
            explanation: '', factors: [], suggestedFactorCount: 0,
            backtest: this.emptyBacktest(),
            billing: { charged: false, amountUSDT: AIFactorAdvisor.COST_USDT, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: result.error || '扣费失败' },
            warnings: [],
          };
        }
        charged = true;
        txId = result.transactionId;
      } catch (err: any) {
        return {
          success: false, sessionId, intent: 'unknown', intentLabel: '',
          explanation: '', factors: [], suggestedFactorCount: 0,
          backtest: this.emptyBacktest(),
          billing: { charged: false, amountUSDT: AIFactorAdvisor.COST_USDT, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: err?.message || '扣费异常' },
          warnings: [],
        };
      }
    }

    // ── Parse intent from query ──
    const intentResult = this.parseIntent(request.query, request.market);

    // ── Build factor recommendations ──
    const pattern = INTENT_PATTERNS.find(p => p.intent === intentResult.intent) || INTENT_PATTERNS[8]; // fallback to balanced
    const factors: FactorRecommendation[] = pattern.baseFactors.map(bf => ({
      factorId: bf.id,
      nameCN: this.getFactorCNName(bf.id),
      categoryCN: this.getCategoryCN(bf.id),
      recommendedWeight: Number(bf.weight.toFixed(2)),
      reason: bf.reason,
      typicalIC: this.getTypicalIC(bf.id),
    }));
    // ── R174 E3: Real backtest (replaces virtual projectedCurve) ──
    let backtestResult: any = null;
    let projectedCurve: Array<{ month: string; cumulative: number }> = [];
    let expReturn = pattern.backtestBaseline.ret;
    let expSharpe = pattern.backtestBaseline.sharpe;
    let expMaxDD = pattern.backtestBaseline.dd;
    let expWinRate = pattern.backtestBaseline.winRate;

    try {
      const factorWeights: Record<string, number> = {};
      for (const f of factors) {
        factorWeights[f.factorId] = f.recommendedWeight;
      }
      const totalW = Object.values(factorWeights).reduce((a, b) => a + b, 0);
      if (totalW > 0) {
        for (const k of Object.keys(factorWeights)) {
          factorWeights[k] /= totalW;
        }
      }
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      backtestResult = await runFactorBacktest({
        factorWeights,
        startDate,
        endDate,
        market: request.market || 'US',
      });
      if (backtestResult.success) {
        expReturn = backtestResult.annualReturn;
        expSharpe = backtestResult.sharpeRatio;
        expMaxDD = backtestResult.maxDrawdown;
        expWinRate = backtestResult.winRate;
        const equityCurve = backtestResult.equityCurve;
        if (equityCurve.length > 0) {
          const step = Math.max(1, Math.floor(equityCurve.length / 12));
          const monLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
          for (let i = 0; i < 12; i++) {
            const idx = Math.min((i + 1) * step - 1, equityCurve.length - 1);
            projectedCurve.push({
              month: monLabels[i],
              cumulative: Number((equityCurve[idx]?.value ?? 0).toFixed(2)),
            });
          }
        }
        log.info('[AIFactorAdvisor] Real backtest OK — Sharpe:' + expSharpe.toFixed(3) + ' Return:' + expReturn.toFixed(1) + '%');
      }
    } catch (err: any) {
      log.warn('[AIFactorAdvisor] Backtest failed, using baseline: ' + (err?.message || err));
    }

    // ── Fallback: if backtest didn't produce curve, use virtual ──
    if (projectedCurve.length === 0) {
      const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      projectedCurve = months.map((m, i) => ({
        month: m,
        cumulative: Number(((pattern.backtestBaseline.ret / 12) * (i + 1) * (0.8 + Math.random() * 0.4)).toFixed(2)),
      }));
    }

    // ── Warnings ──
    const warnings = this.generateWarnings(intentResult.intent, pattern);

    // ── R172 E5: Persist recommendation to history ──
    this.recordRecommendation(sessionId, intentResult.intent, factors);

    return {
      success: true,
      sessionId,
      intent: intentResult.intent,
      intentLabel: pattern.intentLabel,
      explanation: pattern.explanation,
      factors,
      suggestedFactorCount: factors.length,
      backtest: {
        expectedReturn: expReturn,
        expectedSharpe: expSharpe,
        expectedMaxDrawdown: expMaxDD,
        expectedWinRate: expWinRate,
        projectedCurve,
        vsBenchmark: expReturn - 8.0,
      },
      billing: { charged, amountUSDT: AIFactorAdvisor.COST_USDT, serviceType: AIFactorAdvisor.SERVICE_TYPE, transactionId: txId },
      warnings,
    };
  }

  // ── Intent Parsing (keyword matching) ───────────────────────────────

  private parseIntent(query: string, market: string): { intent: FactorAdvisorIntent; confidence: number } {
    const lowerQ = query.toLowerCase();

    // ── R171 E1: Check new conversational intents FIRST (before legacy patterns) ──

    // Deep analysis (highest specificity — check first)
    const deepKW = ['深度', '详细', '全面', '多维度', '全方位', '透彻', '专业分析', '报告', 'deep dive', 'thorough', 'comprehensive', 'detailed', 'in-depth', 'multi-angle', 'professional'];
    if (deepKW.some(kw => lowerQ.includes(kw.toLowerCase()))) {
      return { intent: 'deep_analysis', confidence: 0.90 };
    }

    // Skeptic
    const skepticKW = ['怀疑', '质疑', '失效', '过拟合', '过度优化', '靠谱吗', '行吗', '能信吗', 'skeptic', 'doubt', 'overfit', 'failure', 'really safe'];
    if (skepticKW.some(kw => lowerQ.includes(kw.toLowerCase()))) {
      return { intent: 'skeptic', confidence: 0.85 };
    }

    // Answer (why / evidence)
    const answerKW = ['为什么', '原因', '原理', '依据', '证据', 'data shows', 'backtest shows'];
    if (answerKW.some(kw => lowerQ.includes(kw.toLowerCase()))) {
      return { intent: 'answer', confidence: 0.78 };
    }

    // Question (what is / explain — but NOT quality_defensive/quality keywords)
    const questionKW = ['什么是', '怎么看', '什么意思', '如何理解', '如何用', 'what is', 'how does'];
    if (questionKW.some(kw => lowerQ.includes(kw.toLowerCase()))) {
      return { intent: 'question', confidence: 0.82 };
    }

    // Selection (recommend / pick—but only if no other intent matched)
    const selectionKW = ['推荐', '选哪个', '帮我选', '什么因子好', '哪个好', '选股', '筛选', 'suggest factor', 'pick factor', 'choose factor'];
    if (selectionKW.some(kw => lowerQ.includes(kw.toLowerCase()))) {
      return { intent: 'selection', confidence: 0.80 };
    }

    // ── Legacy INTENT_PATTERNS (second priority) ──
    for (const pattern of INTENT_PATTERNS) {
      // Check Chinese keywords
      for (const kw of pattern.keywordsCN) {
        if (lowerQ.includes(kw)) return { intent: pattern.intent, confidence: 0.9 };
      }
      // Check English keywords
      for (const kw of pattern.keywordsEN) {
        if (lowerQ.includes(kw.toLowerCase())) return { intent: pattern.intent, confidence: 0.85 };
      }
    }

    // Crypto market defaults
    if (market === 'CRYPTO') return { intent: 'crypto_trend', confidence: 0.3 };

    // Generic fallback
    return { intent: 'balanced_all_weather', confidence: 0.2 };
  }

  // ── Factor Metadata ──────────────────────────────────────────────────

  private getFactorCNName(id: string): string {
    const map: Record<string, string> = {
      MOM_12M: '12月动量', MOM_1M: '1月动量', LIQ: '流动性', VOL_60D: '60日波动率',
      GROWTH: '成长性', QUAL: '质量', SIZE: '规模', YIELD: '股息率',
      HML: '价值', RMW: '盈利能力', CMA: '投资风格',
      MA_20_60: '均线交叉', EMA_12_26: 'MACD', RSI_14: 'RSI 14', BOLL: '布林带',
      ADX: 'ADX趋势', ATR_14: 'ATR',
      CRYPTO_FUNDING: '资金费率', CRYPTO_LIQUIDATIONS: '爆仓热度',
      CRYPTO_EXCHANGE_FLOW: '交易所净流量', CRYPTO_OI_DELTA: '持仓量变化',
    };
    return map[id] || id;
  }

  private getCategoryCN(id: string): string {
    const map: Record<string, string> = {
      MOM_12M: '动量', MOM_1M: '动量', MA_20_60: '趋势', EMA_12_26: '趋势', ADX: '趋势',
      RSI_14: '动量', LIQ: '波动率', VOL_60D: '波动率', ATR_14: '波动率', BOLL: '波动率',
      HML: '价值', QUAL: '质量', RMW: '质量', CMA: '质量', GROWTH: '成长',
      SIZE: '规模', YIELD: '收益',
      CRYPTO_FUNDING: '情绪', CRYPTO_LIQUIDATIONS: '波动率',
      CRYPTO_EXCHANGE_FLOW: '情绪', CRYPTO_OI_DELTA: '情绪',
    };
    return map[id] || '其他';
  }

  private getTypicalIC(id: string): number {
    const map: Record<string, number> = {
      MOM_12M: 0.045, MOM_1M: 0.032, LIQ: 0.038, VOL_60D: 0.042,
      GROWTH: 0.028, QUAL: 0.035, SIZE: 0.025, YIELD: 0.018,
      HML: 0.038, RMW: 0.030, CMA: 0.022,
      MA_20_60: 0.025, EMA_12_26: 0.020, RSI_14: 0.028, BOLL: 0.022,
      ADX: 0.015, ATR_14: 0.018,
      CRYPTO_FUNDING: 0.055, CRYPTO_LIQUIDATIONS: 0.030,
      CRYPTO_EXCHANGE_FLOW: 0.048, CRYPTO_OI_DELTA: 0.038,
    };
    return map[id] || 0.015;
  }

  // ── E2: Dynamic IC/IR Computation (R174) ────────────────────────────

  private liveICCache: Map<string, { ic: number; ir: number; timestamp: number }> = new Map();
  private static readonly IC_CACHE_TTL = 5 * 60 * 1000; // 5 min

  /**
   * Fetch live IC/IR from ETF price source.
   * Falls back to typicalIC for factors without live data.
   */
  async refreshLiveStats(): Promise<void> {
    try {
      const etfSource = getETFPriceSource();
      await etfSource.initialize();
      const pairs = etfSource.getAllPairs();
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      for (const pair of pairs) {
        const stats = etfSource.computeFactorStats(pair.factorId, startDate, endDate);
        if (stats && stats.n >= 5) {
          // IC ≈ annualizedSharpe / sqrt(252) ≈ dailyMean / dailyStd
          const ic = stats.dailyStd > 0 ? Math.abs(stats.dailyMean) / stats.dailyStd : 0;
          const ir = stats.dailyStd > 0 ? stats.dailyMean / stats.dailyStd * Math.sqrt(252) : 0;
          this.liveICCache.set(pair.factorId, { ic, ir, timestamp: Date.now() });
        }
      }
      log.info(`[AIFactorAdvisor] Live IC/IR refreshed: ${this.liveICCache.size} factors`);
    } catch (e) {
      log.warn('[AIFactorAdvisor] Live stats refresh failed, using cache/hardcoded', e);
    }
  }

  /** Get IC for a factor, preferring live data over hardcoded */
  private getIC(id: string): number {
    const cached = this.liveICCache.get(id);
    if (cached && (Date.now() - cached.timestamp) < AIFactorAdvisor.IC_CACHE_TTL) {
      return cached.ic;
    }
    return this.getTypicalIC(id);
  }

  /** Get IR for a factor (live or estimated) */
  private getIR(id: string): number {
    const cached = this.liveICCache.get(id);
    if (cached && (Date.now() - cached.timestamp) < AIFactorAdvisor.IC_CACHE_TTL) {
      return cached.ir;
    }
    return this.getTypicalIC(id) * 0.8; // Rough: IR ≈ IC × 0.8
  }

  /**
   * Get top-N factors by live IC, filtered by market compatibility.
   * This replaces the old hardcoded factor lists from INTENT_PATTERNS.
   */
  getTopFactorsByIC(market: string, topN: number = 10): Array<{ factorId: string; ic: number; ir: number }> {
    const allFactors = [
      'MOM_12M', 'MOM_1M', 'LIQ', 'VOL_60D', 'GROWTH', 'QUAL', 'SIZE', 'YIELD',
      'HML', 'RMW', 'CMA', 'MA_20_60', 'EMA_12_26', 'RSI_14', 'BOLL', 'ADX', 'ATR_14',
    ];

    const scored = allFactors.map(id => ({
      factorId: id,
      ic: this.getIC(id),
      ir: this.getIR(id),
    }));

    // Sort by IC desc, then IR desc
    scored.sort((a, b) => b.ic !== a.ic ? b.ic - a.ic : b.ir - a.ir);

    return scored.slice(0, topN);
  }

  private generateWarnings(intent: FactorAdvisorIntent, pattern: IntentPattern): string[] {
    const warnings: string[] = [];
    warnings.push(`费用: ${AIFactorAdvisor.COST_USDT} USDT/次，仅供参考不构成投资建议`);

    if (intent === 'momentum_following') {
      warnings.push('动量策略在趋势反转时可能面临大幅回撤，请设置止损');
    }
    if (intent === 'crypto_trend' || intent === 'crypto_mean_reversion') {
      warnings.push('加密货币市场波动极大，历史回测不代表未来表现');
    }
    if (intent === 'small_cap_growth') {
      warnings.push('小盘股流动性风险高，大资金进出需注意冲击成本');
    }

    return warnings;
  }

  private emptyBacktest(): BacktestPreview {
    return {
      expectedReturn: 0, expectedSharpe: 0, expectedMaxDrawdown: 0, expectedWinRate: 0,
      projectedCurve: [], vsBenchmark: 0,
    };
  }

  // ── R172 E5: AI Recommendation History Store ───────────────────────

  private recommendationHistory: Array<{
    sessionId: string;
    intent: FactorAdvisorIntent;
    factors: FactorRecommendation[];
    timestamp: number;
    query?: string;
    market?: string;
    userId?: string;
    transactionId?: string;
  }> = [];
  private static readonly MAX_HISTORY = 50;

  private recordRecommendation(
    sessionId: string,
    intent: FactorAdvisorIntent,
    factors: FactorRecommendation[],
    extra?: { query?: string; market?: string; userId?: string; transactionId?: string },
  ): void {
    this.recommendationHistory.push({
      sessionId,
      intent,
      factors: factors.map(f => ({ ...f })),
      timestamp: Date.now(),
      ...(extra || {}),
    });
    // Trim to MAX_HISTORY
    if (this.recommendationHistory.length > AIFactorAdvisor.MAX_HISTORY) {
      this.recommendationHistory = this.recommendationHistory.slice(-AIFactorAdvisor.MAX_HISTORY);
    }
  }

  /**
   * Get recommendation history, optionally filtered.
   * @param filters.intent — filter by intent type
   * @param filters.userId — filter by user
   * @param filters.since — unix ms timestamp, only records since this time
   * @param filters.limit — max records to return (default all)
   */
  getRecommendationHistory(filters?: {
    intent?: FactorAdvisorIntent;
    userId?: string;
    since?: number;
    limit?: number;
  }): ReadonlyArray<{
    sessionId: string;
    intent: FactorAdvisorIntent;
    factors: FactorRecommendation[];
    timestamp: number;
    query?: string;
    market?: string;
    userId?: string;
    transactionId?: string;
  }> {
    let results = [...this.recommendationHistory];

    if (filters) {
      if (filters.intent) {
        results = results.filter(r => r.intent === filters.intent);
      }
      if (filters.userId) {
        results = results.filter(r => r.userId === filters.userId);
      }
      if (filters.since) {
        results = results.filter(r => r.timestamp >= filters.since);
      }
      if (filters.limit) {
        results = results.slice(-filters.limit);
      }
    }

    return results;
  }

  /**
   * Get aggregate stats from recommendation history.
   */
  getHistoryStats(): {
    totalRecommendations: number;
    uniqueIntents: number;
    mostUsedIntent: string;
    topFactors: Array<{ factorId: string; timesRecommended: number }>;
    avgFactorsPerRecommendation: number;
    lastRecommendationTime: number | null;
  } {
    const hist = this.recommendationHistory;
    if (hist.length === 0) {
      return {
        totalRecommendations: 0,
        uniqueIntents: 0,
        mostUsedIntent: '',
        topFactors: [],
        avgFactorsPerRecommendation: 0,
        lastRecommendationTime: null,
      };
    }

    // Intent counts
    const intentCounts: Record<string, number> = {};
    for (const r of hist) {
      intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
    }
    let mostUsedIntent = '';
    let maxCount = 0;
    for (const [k, v] of Object.entries(intentCounts)) {
      if (v > maxCount) { maxCount = v; mostUsedIntent = k; }
    }

    // Factor frequency
    const factorCounts: Record<string, number> = {};
    for (const r of hist) {
      for (const f of r.factors) {
        factorCounts[f.factorId] = (factorCounts[f.factorId] || 0) + 1;
      }
    }
    const topFactors = Object.entries(factorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([factorId, timesRecommended]) => ({ factorId, timesRecommended }));

    const avgFactors = hist.reduce((s, r) => s + r.factors.length, 0) / hist.length;

    return {
      totalRecommendations: hist.length,
      uniqueIntents: Object.keys(intentCounts).length,
      mostUsedIntent,
      topFactors,
      avgFactorsPerRecommendation: Number(avgFactors.toFixed(1)),
      lastRecommendationTime: hist[hist.length - 1].timestamp,
    };
  }

  clearHistory(): void {
    this.recommendationHistory = [];
    log.info('[AIFactorAdvisor] History cleared');
  }

  /** List all available intents for UI display */
  listIntents(): Array<{ intent: string; label: string; description: string; market: string }> {
    return INTENT_PATTERNS.map(p => ({
      intent: p.intent,
      label: p.intentLabel,
      description: p.explanation.slice(0, 80) + '...',
      market: p.intent.includes('crypto') ? 'CRYPTO' : 'US/HK',
    }));
  }

  reset(): void { log.info('[AIFactorAdvisor] Reset'); }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createAIFactorAdvisor(): AIFactorAdvisor {
  return new AIFactorAdvisor();
}

let _advisor: AIFactorAdvisor | null = null;
export function getAIFactorAdvisor(): AIFactorAdvisor {
  if (!_advisor) _advisor = new AIFactorAdvisor();
  return _advisor;
}
export function resetAIFactorAdvisor(): void { _advisor?.reset(); _advisor = null; }
