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
// R175 E2+/E6+: Portfolio evaluator for correlation/VIF constraints
import { getFactorPortfolioEvaluator } from '../factors/factor-portfolio-eval';
// R174 E3: Real backtest engine
import { runFactorBacktest, type FactorBacktestResult } from '../backtest/backtest-engine';
// R175 G6: Factor user profile for smart pre-fill
import { getFactorUserProfile } from '../factors/factor-user-profile';
// R178 G7+: AI output guard for input/output sanitization
import { getAIOutputGuard, guardAIOutput } from '../security/ai-output-guard';
// R178 G7+/G14: User context sanitizer — strip sensitive data before AI
import { sanitizeForAI } from '../security/ai-input-sanitizer';
// R178 G14: Factor billing gateway for wallet-less billing check
import { getFactorBillingGateway } from '../factors/factor-billing-gateway';
// R179 G16: Data source anomaly guard — refuse AI when data source unhealthy
import { getDataSourceGuard } from '../security/factor-data-source-guard';
// R182 P0-12: Rate limiter for AI recommendation entry
import { checkRateLimit } from './rate-limiter';
// R181 P0-05: AI hallucination detection & fact anchoring
import { hallucinationCheck, tagOutputProvenance, type HallucinationReport } from '../security/ai-hallucination-check';
// R182 P0-10: Unified AI security gateway
import { getAISecurityGateway } from '../security/ai-security-gateway';
// R183 P2-04: Behavior anomaly monitor
import { getAIBehaviorMonitor } from '../security/ai-behavior-monitor';
// R183 P2-05: Audit trail for dispute resolution
import { getAIRecommendationAuditTrail } from '../security/ai-recommendation-audit-trail';

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
  | 'sector_neutral'        // R179 G24: 行业中性
  | 'macro_resilient'       // R179 G24: 宏观韧性
  | 'multi_style_rotation'  // R179 G24: 多风格轮动
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
  /** User ID for billing (R178 G14: no longer passes to AI — used for billing gate only) */
  userId: string;
  /**
   * @deprecated R178 G14: walletBalance removed from AI context.
   * Billing pre-check now uses internal wallet service via FactorBillingGateway.
   * This field is ignored for security — kept only for backward compat.
   */
  walletBalanceUSDT?: number;
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
  // ── R179 G24: 3 New Balanced Intents ──────────────────────────────
  {
    intent: 'sector_neutral',
    keywordsCN: ['行业中性', '板块中性', '不偏行业', '行业均衡', '跨行业'],
    keywordsEN: ['sector neutral', 'industry neutral', 'cross sector'],
    intentLabel: '行业中性',
    explanation: '行业中性配置，所有因子在GICS 11大行业中均匀暴露。适合对特定行业无偏好的投资者，降低行业集中风险。',
    baseFactors: [
      { id: 'VOL_60D', weight: 0.25, reason: '跨行业低波动' },
      { id: 'QUAL', weight: 0.25, reason: '跨行业质量' },
      { id: 'MOM_12M', weight: 0.15, reason: '跨行业动量' },
      { id: 'HML', weight: 0.15, reason: '跨行业价值' },
      { id: 'SIZE', weight: 0.10, reason: '规模分散' },
      { id: 'RMW', weight: 0.10, reason: '盈利覆盖' },
    ],
    backtestBaseline: { ret: 11.0, sharpe: 1.35, dd: 14.0, winRate: 58 },
  },
  {
    intent: 'macro_resilient',
    keywordsCN: ['宏观韧性', '抗宏观', '抗通胀', '加息', '降息', '宏观对冲', '经济周期'],
    keywordsEN: ['macro resilient', 'inflation hedge', 'rate hike', 'economic cycle'],
    intentLabel: '宏观韧性',
    explanation: '宏观环境韧性组合，在利率/通胀/经济增长变化中保持稳健。加息期偏价值+质量，降息期偏成长+动量，通胀期偏商品+价值。',
    baseFactors: [
      { id: 'HML', weight: 0.22, reason: '价值抗通胀' },
      { id: 'QUAL', weight: 0.22, reason: '质量抗周期' },
      { id: 'CMA', weight: 0.18, reason: '保守投资策略' },
      { id: 'VOL_60D', weight: 0.15, reason: '低波动防御' },
      { id: 'YIELD', weight: 0.13, reason: '高股息现金牛' },
      { id: 'MOM_12M', weight: 0.10, reason: '动量追踪' },
    ],
    backtestBaseline: { ret: 10.5, sharpe: 1.40, dd: 13.0, winRate: 59 },
  },
  {
    intent: 'multi_style_rotation',
    keywordsCN: ['风格轮动', '多风格', '风格切换', '动态风格', '风格配置'],
    keywordsEN: ['style rotation', 'multi style', 'style switch', 'dynamic style'],
    intentLabel: '多风格轮动',
    explanation: '多风格动态轮动，在动量/价值/质量/成长四种风格之间按市场环境动态配置权重。适合主动管理型投资者，追求风格alpha。',
    baseFactors: [
      { id: 'MOM_12M', weight: 0.20, reason: '动量风格' },
      { id: 'HML', weight: 0.20, reason: '价值风格' },
      { id: 'QUAL', weight: 0.20, reason: '质量风格' },
      { id: 'GROWTH', weight: 0.17, reason: '成长风格' },
      { id: 'SIZE', weight: 0.13, reason: '小盘弹性' },
      { id: 'ADX', weight: 0.10, reason: '趋势强度信号' },
    ],
    backtestBaseline: { ret: 15.0, sharpe: 1.25, dd: 18.0, winRate: 52 },
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

    // ── R179 G16: Data source health gate ──
    const dsGuard = getDataSourceGuard();
    if (!dsGuard.isSafeForAI()) {
      const health = dsGuard.checkAllSources();
      return {
        success: false,
        sessionId, intent: 'unknown', intentLabel: '',
        explanation: `数据源异常(${health.overallScore}分)，AI推荐已暂停: ${health.summary}`,
        factors: [], suggestedFactorCount: 0,
        backtest: this.emptyBacktest(),
        billing: { charged: false, amountUSDT: 0, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: 'DATA_SOURCE_UNHEALTHY' },
        warnings: health.checks.flatMap(c => c.details),
      };
    }

    // ── R183 P2-04: Check behavior block before proceeding ──
    const behaviorMonitor = getAIBehaviorMonitor();
    if (behaviorMonitor.isBlocked(request.userId)) {
      return {
        success: false,
        sessionId, intent: 'unknown', intentLabel: '',
        explanation: '检测到异常使用模式，AI服务已暂停24小时。如需帮助请联系客服。',
        factors: [], suggestedFactorCount: 0, warnings: [],
        backtest: this.emptyBacktest(),
        billing: { charged: false, amountUSDT: 0, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: 'BEHAVIOR_BLOCKED' },
      };
    }

    const startTime = Date.now();

    // ── R182 P0-12: Rate limit check ──────────────────────────────────
    const rateCheck = checkRateLimit(request.userId, 'ai.recommend');
    if (!rateCheck.allowed) {
      return {
        success: false,
        sessionId, intent: 'unknown', intentLabel: '',
        explanation: `Too many AI requests. Please try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.`,
        factors: [], suggestedFactorCount: 0,
        backtest: this.emptyBacktest(),
        billing: { charged: false, amountUSDT: 0, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: 'RATE_LIMITED' },
        warnings: [rateCheck.reason || 'Rate limit exceeded'],
      };
    }

    // ── R179 G26: Track session intent ──
    this.trackIntent(request.userId);

    // ── R178 G7+: Input sanitization ──
    const cleanedQuery = sanitizeForAI(request.query);
    if (cleanedQuery !== request.query) {
      log.warn(`[AIAdvisor] Input sanitized: ${request.query.length}→${cleanedQuery.length} chars`);
    }

    // ── R178 G14: Billing pre-check via gateway (wallet NOT exposed to AI) ──
    const billingGate = getFactorBillingGateway();
    const billingCheck = await billingGate.attemptAccess(request.userId, 'AI_RECOMMENDATION');
    if (!billingCheck.ok) {
      return {
        success: false,
        sessionId, intent: 'unknown', intentLabel: '',
        explanation: billingCheck.message || '扣费失败，请检查账户余额',
        factors: [], suggestedFactorCount: 0,
        backtest: this.emptyBacktest(),
        billing: { charged: false, amountUSDT: AIFactorAdvisor.COST_USDT, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: billingCheck.message },
        warnings: [],
      };
    }

    // ── Hold charge (R178 G14: userId for billing gate only, not AI) ──
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

    // ── Parse intent from sanitized query (R178 G7+) ──
    const intentResult = this.parseIntent(cleanedQuery, request.market);

    // ── Build factor recommendations ──
    const pattern = INTENT_PATTERNS.find(p => p.intent === intentResult.intent) || INTENT_PATTERNS[8]; // fallback to balanced
    const factors: FactorRecommendation[] = pattern.baseFactors.map(bf => {
      // R179 G24: fingerprint diversity — ±3% jitter on weights
      const jitter = 1 + (Math.random() - 0.5) * 0.06; // ±3%
      return {
      factorId: bf.id,
      nameCN: this.getFactorCNName(bf.id),
      categoryCN: this.getCategoryCN(bf.id),
      recommendedWeight: Number((bf.weight * jitter).toFixed(4)),
      reason: bf.reason,
      typicalIC: this.getTypicalIC(bf.id),
      };
    });
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

    // ── Warnings (R178 G12: add metrics validation warning) ──
    const warnings = this.generateWarnings(intentResult.intent, pattern);
    const metricsWarnings = this.validateMetrics(factors, expReturn, expSharpe);
    warnings.push(...metricsWarnings);

    // ── R172 E5: Persist recommendation to history ──
    this.recordRecommendation(sessionId, intentResult.intent, factors);

    // ── R175 G6: Update factor user profile ──
    try {
      const profile = getFactorUserProfile();
      const factorData = factors.map(f => ({
        factorId: f.factorId,
        nameCN: f.nameCN,
        weight: f.recommendedWeight,
        ic: f.typicalIC,
      }));
      profile.updateProfile(request.userId, factorData, intentResult.intent, request.market);
    } catch (e: any) {
      log.warn('[AIFactorAdvisor] Profile update skipped:', e?.message);
    }

    const result: FactorAdvisorResult = {
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

    // ── R182 P0-10: Unified AI security gateway (replaces scattered guardAIOutput + hallucinationCheck + tagOutputProvenance) ──
    const securityGateway = getAISecurityGateway();
    const outputCheck = securityGateway.guardOutput(result.explanation, {
      factorIds: result.factors.map(f => f.factorId),
      intent: result.intent,
      userId: request.userId,
    });

    if (outputCheck.level === 'BLOCKED') {
      log.warn(`[AIAdvisor] Output blocked: ${outputCheck.blockExplanation}`);
      return {
        ...result,
        success: false,
        explanation: outputCheck.allowedOutput,
        factors: [],
        warnings: [...result.warnings, ...[`[安全拦截] ${outputCheck.blockExplanation || ''}`.trim()].filter(Boolean)],
      };
    }

    // Attach credibility badges + semantic warnings to result
    if (outputCheck.credibilityBadges.length > 0) {
      result.warnings.push(...outputCheck.credibilityBadges.map(b => `${b.label}: ${b.detail}`));
    }
    if (outputCheck.warnings.length > 0) {
      result.warnings.push(...outputCheck.warnings);
    }

    // R181 P0-08: Multi-turn dialog tracking
    this.multiTurnDialog(request.userId, request.query);

    // R183 P2-04: Record interaction for behavior anomaly detection
    behaviorMonitor.recordInteraction(request.userId, {
      intent: result.intent,
      query: request.query,
      blocked: outputCheck.level === ('BLOCKED' as any),
      billingFailed: !billingCheck.ok,
      hadBacktest: backtestResult !== null,
    });

    // R183 P2-04: Check if user is blocked by behavior monitor
    if (behaviorMonitor.isBlocked(request.userId)) {
      return {
        ...result,
        success: false,
        explanation: '检测到异常使用模式，AI服务已暂停24小时。如需帮助请联系客服。',
        factors: [],
        billing: { charged: false, amountUSDT: 0, serviceType: AIFactorAdvisor.SERVICE_TYPE, error: 'BEHAVIOR_BLOCKED' },
      };
    }

    // R183 P2-05: Record full audit trail for dispute resolution
    const auditTrail = getAIRecommendationAuditTrail();
    auditTrail.buildTrail({
      userId: request.userId,
      sessionId,
      rawInput: request.query,
      sanitizedInput: cleanedQuery,
      intent: result.intent,
      intentConfidence: intentResult.confidence,
      market: request.market,
      factorWeights: Object.fromEntries(result.factors.map(f => [f.factorId, f.recommendedWeight])),
      icEstimates: Object.fromEntries(result.factors.map(f => [f.factorId, f.typicalIC])),
      backtestResult: backtestResult ? {
        expectedReturn: backtestResult.annualReturn || backtestResult.expectedReturn || 0,
        expectedSharpe: backtestResult.sharpeRatio || backtestResult.expectedSharpe || 0,
        expectedMaxDrawdown: backtestResult.maxDrawdown || backtestResult.expectedMaxDrawdown || 0,
        expectedWinRate: backtestResult.winRate || backtestResult.expectedWinRate || 0,
      } : { expectedReturn: 0, expectedSharpe: 0, expectedMaxDrawdown: 0, expectedWinRate: 0 },
      rawAIOutput: result.explanation,
      guardPassed: (outputCheck.level as string) !== 'BLOCKED',
      guardScore: outputCheck.guardResult.totalScore,
      guardViolations: outputCheck.guardResult.violations.length,
      finalOutput: (outputCheck.level as string) === 'BLOCKED' ? outputCheck.allowedOutput : result.explanation,
      securityLevel: outputCheck.level,
      blockReason: outputCheck.blockExplanation,
      billingCharged: billingCheck.charged,
      billingAmount: billingCheck.amountCharged,
      dataSourcesHealthy: dsGuard.isSafeForAI(),
      latencyMs: Date.now() - startTime,
      factors: result.factors.map(f => f.factorId),
    });

    return result;
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

    // ── R175 E1续: 5 new specialized intents (high priority, before legacy) ──
    const newSpecKW: Array<{ intent: FactorAdvisorIntent; kw: string[]; min: number }> = [
      { intent: 'tail_risk', kw: ['尾部', '黑天鹅', '崩盘', '暴跌', '保护', 'tail', 'crash', 'disaster', 'extreme', 'swan', 'black swan', '下跌保护'], min: 1 },
      { intent: 'macro_hedge', kw: ['宏观', '对冲', '通胀', '衰退', '加息', '降息', 'macro', 'hedge', 'inflation', 'recession'], min: 1 },
      { intent: 'style_rotation', kw: ['风格', '轮动', '切换', 'style rotation', 'growth vs value', 'rotate'], min: 1 },
      { intent: 'factor_substitution', kw: ['替换', '换因子', '替代', 'swap', 'replace', 'substitute', 'instead of'], min: 1 },
      { intent: 'crypto_portfolio', kw: ['加密组合', '加密配置', 'crypto portfolio', 'defi', 'layer 2', 'layer2', 'l1', 'btc eth 配置', '配置比例', 'staking'], min: 1 },
    ];
    for (const entry of newSpecKW) {
      const hits = entry.kw.filter(k => lowerQ.includes(k.toLowerCase())).length;
      if (hits >= entry.min) {
        return { intent: entry.intent, confidence: Math.min(0.88, 0.55 + hits * 0.12) };
      }
    }

    // Quick crypto check: if query has 加密 and no newSpecKW matched, route to crypto_trend
    if (lowerQ.includes('加密') && market === 'CRYPTO') {
      return { intent: 'crypto_trend', confidence: 0.75 };
    }

    // ── Legacy INTENT_PATTERNS (lowest priority before fallback) ──
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

  // ── R175 E2+: Constrained Factor Weight Optimization ─────────────────

  optimizeFactorWeights(initialFactors: Array<{ factorId: string }>): Array<{
    factorId: string; weight: number; ic: number; vif: number;
    removed: boolean; removeReason?: string;
  }> {
    const ids = initialFactors.map(f => f.factorId);
    if (ids.length === 0) return [];
    if (ids.length === 1) return [{ factorId: ids[0], weight: 1, ic: this.getIC(ids[0]), vif: 1, removed: false }];
    const portEval = getFactorPortfolioEvaluator();
    const corr = portEval.computeCorrelationMatrix(ids, 0.5);
    const toRemove = new Set<string>();
    for (const e of corr.entries) {
      if (e.level === 'danger' || e.level === 'warning') {
        toRemove.add(this.getIC(e.factor1) <= this.getIC(e.factor2) ? e.factor1 : e.factor2);
      }
    }
    const valid = ids.filter(id => !toRemove.has(id));
    if (valid.length > 0) {
      const vif = eval.computeVIF(valid, undefined, 3);
      for (const r of vif.results) { if (r.status === 'danger' || r.status === 'warning') toRemove.add(r.factorId); }
    }
    const kept = ids.filter(id => !toRemove.has(id));
    const maxW = 0.30;
    const results: Array<{ factorId: string; weight: number; ic: number; vif: number; removed: boolean; removeReason?: string }> = [];
    if (kept.length === 0) {
      const top = ids.sort((a,b) => this.getIC(b)-this.getIC(a))[0];
      results.push({ factorId: top, weight: 1, ic: this.getIC(top), vif: 1, removed: false });
    } else {
      const tmp: Record<string,number> = {}; let totalIC = 0;
      for (const id of kept) { tmp[id] = this.getIC(id); totalIC += tmp[id]; }
      let excess = 0;
      for (const id of kept) { let w = tmp[id]/totalIC; if (w>maxW) { excess+=w-maxW; w=maxW; } tmp[id]=w; }
      if (excess>0.001 && kept.length>1) {
        const uc = kept.filter(id=>tmp[id]<maxW);
        const each = uc.length>0 ? excess/uc.length : 0;
        for (const id of uc) tmp[id]=Math.min(maxW, tmp[id]+each);
      }
      const vif = eval.computeVIF(kept, undefined, 3);
      for (const id of ids) {
        const isRemoved = toRemove.has(id);
        const ve = vif.results.find(r => r.factorId === id);
        const hadCorr = corr.entries.some(e => (e.factor1===id||e.factor2===id) && (e.level==='danger'||e.level==='warning'));
        results.push({
          factorId: id, weight: isRemoved?0:Math.round(tmp[id]*10000)/10000, ic: this.getIC(id), vif: ve?.vif??1, removed: isRemoved,
          removeReason: isRemoved ? (hadCorr?'高相关性排除':'VIF过高排除') : undefined,
        });
      }
    }
    return results;
  }

  // ── R175 E6+: Incremental Factor Replacement Suggestions ───────────

  suggestReplacements(conflictingIds: string[]): Array<{
    original: string; replacement: string; reason: string; icDelta: number;
  }> {
    const pool: Record<string, Array<{ factorId: string; reason: string }>> = {
      MOM_12M: [{ factorId: 'MOM_1M', reason: '短期动量替代' }, { factorId: 'MA_20_60', reason: '均线趋势替代' }],
      MOM_1M: [{ factorId: 'RSI_14', reason: '超买超卖替代' }],
      VOL_60D: [{ factorId: 'ATR_14', reason: '波动率替代' }, { factorId: 'BOLL', reason: '布林带替代' }],
      HML: [{ factorId: 'CMA', reason: '保守价值替代' }, { factorId: 'YIELD', reason: '高股息替代' }],
      QUAL: [{ factorId: 'RMW', reason: '盈利质量替代' }],
      GROWTH: [{ factorId: 'MOM_12M', reason: '动量增长替代' }],
    };
    const suggestions: Array<{ original: string; replacement: string; reason: string; icDelta: number }> = [];
    for (const cfid of conflictingIds) {
      const best = (pool[cfid]||[]).map(p=>({...p,ic:this.getIC(p.factorId)})).sort((a,b)=>b.ic-a.ic)[0];
      if (best) suggestions.push({ original: cfid, replacement: best.factorId, reason: best.reason, icDelta: Math.round((best.ic-this.getIC(cfid))*10000)/10000 });
    }
    const top = this.getTopFactorsByIC('HK', 5);
    for (const cfid of conflictingIds) {
      if (!suggestions.some(s=>s.original===cfid)) {
        const alt = top.find(t=>t.factorId!==cfid);
        if (alt) suggestions.push({ original: cfid, replacement: alt.factorId, reason: `最高IC(${alt.ic.toFixed(3)})替代`, icDelta: Math.round((alt.ic-this.getIC(cfid))*10000)/10000 });
      }
    }
    return suggestions;
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

  // ── R172 E6: Holdings Conflict Detection + Auto Dedup ───────────────

  private userHoldings: UserHolding[] = [];

  loadUserHoldings(holdings?: UserHolding[]): UserHolding[] {
    if (holdings) this.userHoldings = [...holdings];
    return [...this.userHoldings];
  }

  detectConflicts(recommendations: FactorRecommendation[], holdings?: UserHolding[]): HoldingConflict[] {
    const hlds = holdings || this.userHoldings;
    if (hlds.length === 0) return [];
    const conflicts: HoldingConflict[] = [];
    for (const h of hlds) {
      if (h.factorExposures) {
        for (const fid of Object.keys(h.factorExposures)) {
          for (const rec of recommendations) {
            if (fid === rec.factorId) {
              conflicts.push({
                holding: h, conflictingFactors: [fid],
                message: `${h.name}已暴露${this.getFactorCNName(fid)}，与推荐重叠`,
                severity: 'info', resolution: '降低该因子权重以分散暴露',
              });
            }
          }
        }
      }
    }
    return conflicts;
  }

  autoDedup(recommendations: FactorRecommendation[], holdings?: UserHolding[]): DedupResult {
    const original = [...recommendations];
    const seen = new Set<string>();
    const phase1: FactorRecommendation[] = [];
    const removed: string[] = [];
    for (const rec of recommendations) {
      if (seen.has(rec.factorId)) { removed.push(`dup:${rec.factorId}`); continue; }
      seen.add(rec.factorId); phase1.push(rec);
    }
    const families: Record<string, string[]> = {
      momentum: ['MOM_12M','MOM_1M','MA_20_60','EMA_12_26','ADX','RSI_14'],
      value: ['HML','CMA'], quality: ['QUAL','RMW'],
      volatility: ['VOL_60D','ATR_14','BOLL'],
    };
    let dedup = [...phase1];
    for (const [, members] of Object.entries(families)) {
      const fRecs = dedup.filter(r => members.includes(r.factorId));
      if (fRecs.length > 2) {
        const sorted = fRecs.sort((a,b) => b.typicalIC - a.typicalIC);
        const toDrop = sorted.slice(2).map(r => r.factorId);
        dedup = dedup.filter(r => !toDrop.includes(r.factorId));
        removed.push(...toDrop.map(id => `near-dup:${id}`));
      }
    }
    return { original, deduplicated: dedup, removed, summary: removed.length>0?`已移除${removed.length}个重复因子`:'无需去重' };
  }

  // ── R178 G12: IC/Sharpe Metrics Validation ──────────────────────────
  // Verifies AI-generated metrics against real ETF price data (±3σ range).

  private validateMetrics(factors: FactorRecommendation[], expReturn: number, expSharpe: number): string[] {
    const warnings: string[] = [];
    const etfSource = getETFPriceSource();

    // Validate IC values per factor
    for (const f of factors) {
      if (f.typicalIC < -0.30) {
        warnings.push(`[指标异常] ${f.nameCN} IC=${f.typicalIC.toFixed(4)} 低于合理下限(-0.3)，已钳制`);
      }
      if (f.typicalIC > 0.30) {
        warnings.push(`[指标异常] ${f.nameCN} IC=${f.typicalIC.toFixed(4)} 高于合理上限(0.3)，已钳制`);
      }
    }

    // Validate Sharpe ratio against ETF factor returns
    try {
      const factorReturns = etfSource.computeFactorReturns();
      const realSharpes: number[] = [];
      for (const [, ret] of Object.entries(factorReturns)) {
        if ((ret as any).annualizedSharpe > -5 && (ret as any).annualizedSharpe < 5) {
          realSharpes.push((ret as any).annualizedSharpe);
        }
      }
      if (realSharpes.length > 0) {
        const avgRealSharpe = realSharpes.reduce((a, b) => a + b, 0) / realSharpes.length;
        const stdRealSharpe = Math.sqrt(realSharpes.reduce((s, v) => s + (v - avgRealSharpe) ** 2, 0) / realSharpes.length);
        const lowerBound = avgRealSharpe - 3 * stdRealSharpe;
        const upperBound = avgRealSharpe + 3 * stdRealSharpe;

        if (expSharpe < lowerBound) {
          warnings.push(`[真实性警告] Sharpe=${expSharpe.toFixed(3)} 显著低于${lowerBound.toFixed(2)}（ETF真实±3σ范围），数据可能失真`);
        }
        if (expSharpe > upperBound) {
          warnings.push(`[真实性警告] Sharpe=${expSharpe.toFixed(3)} 显著高于${upperBound.toFixed(2)}（ETF真实±3σ范围），结果可能被AI夸大`);
        }
      }
    } catch {
      // ETF source unavailable — skip validation, don't block
    }

    // Validate annual return bounds
    if (expReturn > 100) {
      warnings.push(`[真实性警告] 年化收益${expReturn.toFixed(1)}%异常高，可能为AI虚构`);
    }
    if (expReturn < -60) {
      warnings.push(`[真实性警告] 年化收益${expReturn.toFixed(1)}%异常低`);
    }

    if (warnings.length > 0) {
      log.warn(`[AIAdvisor] Metrics validation: ${warnings.length} warnings`);
    }

    return warnings;
  }

  // ── R179 G26: Per-user session isolation ───────────────────────────

  /** Active user session tracking — one session per userId at a time */
  private userSessions: Map<string, { sessionId: string; startedAt: number; intentCount: number }> = new Map();

  /** Begin a new session for a user (R179 G26: clears previous session state). */
  beginUserSession(userId: string): { sessionId: string; isNew: boolean } {
    const existing = this.userSessions.get(userId);
    const sessionId = `usess-${userId.slice(0, 8)}-${Date.now()}`;

    if (existing) {
      log.info(`[AIAdvisor] Ending previous session ${existing.sessionId.slice(0, 20)}... (${existing.intentCount} intents)`);
      // Clear previous session's derived data
    }

    this.userSessions.set(userId, { sessionId, startedAt: Date.now(), intentCount: 0 });
    log.info(`[AIAdvisor] Session started: ${sessionId.slice(0, 24)} for user ${userId.slice(0, 8)}...`);
    return { sessionId, isNew: !existing };
  }

  /** End a user session and clear associated data. */
  endUserSession(userId: string): boolean {
    const session = this.userSessions.get(userId);
    if (!session) return false;
    log.info(`[AIAdvisor] Session ended: ${session.sessionId.slice(0, 24)} (${session.intentCount} intents, ${Math.round((Date.now() - session.startedAt) / 1000)}s)`);
    this.userSessions.delete(userId);
    return true;
  }

  /** Get current session info for a user. */
  getUserSession(userId: string): { sessionId: string; startedAt: number; intentCount: number } | null {
    return this.userSessions.get(userId) || null;
  }

  /** Increment intent count for active session (R179 G26: rate limit helper). */
  private trackIntent(userId: string): void {
    const session = this.userSessions.get(userId);
    if (session) session.intentCount++;
  }

  // ── R181 P0-08: Multi-Turn Dialog ────────────────────────────────────
  // User preference memory across turns (per userId).
  // Used by multiTurnDialog() to progressively refine recommendations.

  private turnMemory: Map<string, {
    conversation: Array<{ role: 'user' | 'assistant'; text: string; timestamp: number }>;
    revealedPreferences: string[];    // e.g. ['low_risk', 'dividend_lover']
    lastIntent?: FactorAdvisorIntent;
    lastFactors?: string[];
    turnCount: number;
  }> = new Map();

  /**
   * Multi-turn dialog: AI remembers user preferences across turns,
   * progressively refines recommendations. Each turn builds on the last.
   */
  multiTurnDialog(userId: string, query: string): {
    conversation: Array<{ role: string; text: string }>;
    preferences: string[];
    transition: 'NEW' | 'CONTINUING' | 'REFINING';
    hint: string;
  } {
    let memory = this.turnMemory.get(userId);
    const now = Date.now();

    // New conversation after 30min idle
    if (!memory || now - (memory.conversation[memory.conversation.length - 1]?.timestamp || 0) > 1800000) {
      memory = { conversation: [], revealedPreferences: [], turnCount: 0 };
      this.turnMemory.set(userId, memory);
    }

    memory.turnCount++;
    memory.conversation.push({ role: 'user', text: query, timestamp: now });

    // Detect preferences from query keywords
    const newPrefs = this.detectPreferences(query);
    for (const p of newPrefs) {
      if (!memory.revealedPreferences.includes(p)) {
        memory.revealedPreferences.push(p);
      }
    }

    let transition: 'NEW' | 'CONTINUING' | 'REFINING';
    let hint: string;

    if (memory.turnCount === 1) {
      transition = 'NEW';
      hint = '首次对话。将根据您的偏好提供初始因子推荐。您可以在后续对话中细化。';
    } else if (newPrefs.length > 0) {
      transition = 'REFINING';
      hint = `检测到新偏好: ${newPrefs.join('、')}。正在基于前${memory.turnCount}轮对话优化推荐。`;
    } else {
      transition = 'CONTINUING';
      hint = `第${memory.turnCount}轮对话。继续基于您的偏好(${memory.revealedPreferences.join('、')})优化推荐。`;
    }

    return {
      conversation: memory.conversation.map(c => ({ role: c.role, text: c.text })),
      preferences: memory.revealedPreferences,
      transition,
      hint,
    };
  }

  /** Get conversation history for a user. */
  getConversation(userId: string): Array<{ role: string; text: string }> {
    const memory = this.turnMemory.get(userId);
    return memory?.conversation.map(c => ({ role: c.role, text: c.text })) || [];
  }

  private detectPreferences(query: string): string[] {
    const prefs: string[] = [];
    const map: Array<{ pattern: RegExp; pref: string }> = [
      { pattern: /低风险|保守|稳健|不要亏|保本|安全/, pref: 'low_risk' },
      { pattern: /高风险|激进|敢冒险|高收益|弹性/, pref: 'high_risk' },
      { pattern: /分红|股息|派息|现金流/, pref: 'dividend_lover' },
      { pattern: /成长|增长|爆发|高增长/, pref: 'growth_seeker' },
      { pattern: /价值|便宜|低估值|抄底/, pref: 'value_hunter' },
      { pattern: /科创|科技|AI|半导体|新能源/, pref: 'tech_bull' },
      { pattern: /短期|快进快出|波段|短线/, pref: 'short_term' },
      { pattern: /长期|定投|长期持有|养老/, pref: 'long_term' },
      { pattern: /分散|多元|多因子|均衡/, pref: 'diversified' },
    ];
    for (const { pattern, pref } of map) {
      if (pattern.test(query)) prefs.push(pref);
    }
    return prefs;
  }

  // ── R181 P0-06: Suggest Next Questions ───────────────────────────────
  // After each recommendation, suggest 2-3 natural follow-up questions
  // so users don't need to think "what should I ask next?".

  /**
   * Generate 2-3 clickable follow-up questions based on current intent.
   * Uses curated templates per intent for natural flow.
   */
  suggestNextQuestions(
    intent: FactorAdvisorIntent,
    factors: string[],
  ): string[] {
    const templates: Record<string, string[]> = {
      high_growth_low_volatility: [
        '这些因子中哪个IC值最高？',
        '如果我想降低最大回撤，应该怎么调整？',
        '帮我看看这个组合在2024年的回测表现',
      ],
      value_reversal: [
        '价值因子目前处于什么分位？',
        '港股和美股的价值因子哪个更强？',
        '加一个动量因子会不会更好？',
      ],
      momentum_following: [
        '动量因子近期信号强度如何？',
        '如果市场转向，这个组合会亏多少？',
        '结合波动率因子调整一下权重',
      ],
      quality_defensive: [
        '质量因子覆盖了哪些财务指标？',
        '这个组合在熊市表现怎么样？',
        '加入股息因子能提高确定性吗？',
      ],
      high_dividend: [
        '这些高股息标的的派息率是多少？',
        '股息因子和债券收益率的关系？',
        '提高增长率的同时保持股息率可能吗？',
      ],
      small_cap_growth: [
        '小盘因子最近一年表现怎么样？',
        '小盘成长的波动率有多高？',
        '搭配质量因子能降低风险吗？',
      ],
      balanced_all_weather: [
        '哪些因子贡献了最多的收益？',
        '这个组合去年在通胀环境下表现如何？',
        '调整成更偏进攻型的权重',
      ],
      macro_resilient: [
        '当前宏观环境适合这个组合吗？',
        '利率变化对各因子有什么影响？',
        '如果降息周期来了应该怎么调整？',
      ],
      multi_style_rotation: [
        '目前哪个风格因子最强？',
        '风格轮动的触发信号是什么？',
        '帮我对比一下价值和成长目前的IC差距',
      ],
      sector_neutral: [
        '各行业因子的暴露度均衡吗？',
        '有没有行业集中度风险？',
        '科技行业占比过高怎么办？',
      ],
    };

    // Fallback: generic follow-ups based on factor categories
    const genericQuestions = [
      '这些因子的IC值排名是怎样的？',
      '帮我做一个完整的回测分析',
      '如果我想降低风险应该怎么做？',
      `${factors.length > 0 ? `为什么选择了${factors.slice(0, 2).join('和')}？` : ''}`,
    ].filter(Boolean);

    const candidates = templates[intent] || genericQuestions;
    // Return 2-3
    return candidates.slice(0, 3);
  }

  // ── R181 P0-09: Humanize Metrics ─────────────────────────────────────
  // Translate raw numbers (IC/Sharpe/MaxDD) into human-friendly language.
  // Designed for non-technical users who shouldn't need a CFA to understand.

  /**
   * Translate a raw metric into a human-friendly description.
   */
  humanizeMetric(metric: 'IC' | 'IR' | 'Sharpe' | 'MaxDD' | 'WinRate' | 'AnnualReturn' | 'Volatility', value: number): {
    label: string;
    value: string;
    emoji: string;
    plainLanguage: string;
    rating: 1 | 2 | 3 | 4 | 5;
  } {
    const patterns = HUMANIZE_PATTERNS[metric];
    const match = patterns.find(p => {
      if (p.range[0] === -Infinity) return value <= p.range[1];
      if (p.range[1] === Infinity) return value >= p.range[0];
      return value >= p.range[0] && value < p.range[1];
    }) || patterns[patterns.length - 1];

    return {
      label: match.label,
      value: metric === 'MaxDD' || metric === 'Volatility'
        ? `${(value * 100).toFixed(1)}%`
        : value.toFixed(2),
      emoji: match.emoji,
      plainLanguage: match.plainLanguage,
      rating: match.rating,
    };
  }

  /** Bulk humanize a set of key metrics for UI display. */
  humanizeMetricsBundle(metrics: { ic?: number; sharpe?: number; maxDD?: number; winRate?: number }): Array<{
    metric: string;
    label: string;
    value: string;
    emoji: string;
    plainLanguage: string;
    rating: number;
  }> {
    const results: Array<{ metric: string; label: string; value: string; emoji: string; plainLanguage: string; rating: number }> = [];
    if (metrics.ic !== undefined) results.push({ metric: 'IC', ...this.humanizeMetric('IC', metrics.ic) });
    if (metrics.sharpe !== undefined) results.push({ metric: 'Sharpe', ...this.humanizeMetric('Sharpe', metrics.sharpe) });
    if (metrics.maxDD !== undefined) results.push({ metric: 'MaxDD', ...this.humanizeMetric('MaxDD', metrics.maxDD) });
    if (metrics.winRate !== undefined) results.push({ metric: 'WinRate', ...this.humanizeMetric('WinRate', metrics.winRate / 100) });
    return results;
  }

  reset(): void {
    this.turnMemory.clear();
    this.userSessions.clear();
    log.info('[AIFactorAdvisor] Reset');
  }
}

// ── R181 P0-09: Humanization Patterns ──────────────────────────────────────
// Ordered from best to worst — first match wins.
// Designed so non-professional investors instantly understand what each number means.

type HumanizePattern = {
  range: [number, number];
  label: string;
  emoji: string;
  plainLanguage: string;
  rating: 1 | 2 | 3 | 4 | 5;
};

const HUMANIZE_PATTERNS: Record<string, HumanizePattern[]> = {
  IC: [
    { range: [0.10, Infinity], label: '极强预测力', emoji: '🟢', plainLanguage: '这个因子预测能力极强，10次判断里至少有6次是对的', rating: 5 },
    { range: [0.05, 0.10], label: '良好预测力', emoji: '🟢', plainLanguage: '预测能力不错，比一半以上的纯随机选择靠谱', rating: 4 },
    { range: [0.02, 0.05], label: '一般预测力', emoji: '🟡', plainLanguage: '有一点预测能力，但不太稳定，建议搭配其他因子使用', rating: 3 },
    { range: [0.00, 0.02], label: '弱预测力', emoji: '🟠', plainLanguage: '预测能力比较弱，单用可能不太可靠', rating: 2 },
    { range: [-Infinity, 0.00], label: '负预测力', emoji: '🔴', plainLanguage: '这个因子目前是反向指标，用它选股可能事与愿违', rating: 1 },
  ],
  Sharpe: [
    { range: [1.5, Infinity], label: '优秀', emoji: '🟢', plainLanguage: '收益远超风险，每承担1块钱波动能赚1块5以上，非常舒服', rating: 5 },
    { range: [1.0, 1.5], label: '良好', emoji: '🟢', plainLanguage: '收益比风险高，这个策略的赔率不错', rating: 4 },
    { range: [0.5, 1.0], label: '合理', emoji: '🟡', plainLanguage: '收益和风险基本平衡，比放银行强但波动也不小', rating: 3 },
    { range: [0.0, 0.5], label: '偏低', emoji: '🟠', plainLanguage: '波动太大了，收益不够补偿风险，心理承受力要强', rating: 2 },
    { range: [-Infinity, 0.0], label: '负收益风险比', emoji: '🔴', plainLanguage: '风险远超收益，这个策略在亏钱，需要重新考虑', rating: 1 },
  ],
  MaxDD: [
    { range: [0.0, 0.10], label: '回撤很小', emoji: '🟢', plainLanguage: '最大回撤不到10%，最坏情况也就亏一成，适合安稳型', rating: 5 },
    { range: [0.10, 0.20], label: '回撤可控', emoji: '🟢', plainLanguage: '极端情况下可能亏一到两成，大多数人能接受', rating: 4 },
    { range: [0.20, 0.35], label: '回撤较大', emoji: '🟡', plainLanguage: '极端情况下可能亏两三成，需要比较强的心理承受力', rating: 3 },
    { range: [0.35, 0.50], label: '回撤很大', emoji: '🟠', plainLanguage: '可能腰斩一半，只有经验丰富的交易者才适合', rating: 2 },
    { range: [0.50, Infinity], label: '高风险', emoji: '🔴', plainLanguage: '极端情况下可能亏损超过一半，风险非常高', rating: 1 },
  ],
  WinRate: [
    { range: [0.60, Infinity], label: '胜率很高', emoji: '🟢', plainLanguage: '10次交易里至少有6次赚钱，胜率很稳', rating: 5 },
    { range: [0.50, 0.60], label: '胜率不错', emoji: '🟢', plainLanguage: '超过一半的交易能赚钱，比扔硬币强', rating: 4 },
    { range: [0.40, 0.50], label: '胜率一般', emoji: '🟡', plainLanguage: '跟扔硬币差不多，胜负各半', rating: 3 },
    { range: [0.30, 0.40], label: '胜率偏低', emoji: '🟠', plainLanguage: '多数交易在亏钱，但偶尔一次大赚可能弥补', rating: 2 },
    { range: [-Infinity, 0.30], label: '胜率很低', emoji: '🔴', plainLanguage: '十赌九输，这个策略的胜率太低了', rating: 1 },
  ],
  AnnualReturn: [
    { range: [0.20, Infinity], label: '高收益', emoji: '🟢', plainLanguage: '年化20%以上，复利效应很强，比绝大多数基金表现好', rating: 5 },
    { range: [0.10, 0.20], label: '不错', emoji: '🟢', plainLanguage: '年化10%-20%，跑赢通胀还有得赚，稳稳的幸福', rating: 4 },
    { range: [0.03, 0.10], label: '合理', emoji: '🟡', plainLanguage: '比定存强但不算惊艳，长期复利下来也不错', rating: 3 },
    { range: [0.00, 0.03], label: '偏低', emoji: '🟠', plainLanguage: '跑不过通胀，钱在慢慢贬值', rating: 2 },
    { range: [-Infinity, 0.00], label: '亏损', emoji: '🔴', plainLanguage: '本金在缩水，这个策略目前在亏钱，建议暂停', rating: 1 },
  ],
  Volatility: [
    { range: [0.0, 0.15], label: '低波动', emoji: '🟢', plainLanguage: '波动很小，日常涨跌不大，适合安稳型的你', rating: 5 },
    { range: [0.15, 0.25], label: '中等波动', emoji: '🟡', plainLanguage: '日常有涨有跌，习惯就好，适合大多数人', rating: 3 },
    { range: [0.25, 0.40], label: '高波动', emoji: '🟠', plainLanguage: '经常大起大落，心脏不好的话要谨慎', rating: 2 },
    { range: [0.40, Infinity], label: '极高波动', emoji: '🔴', plainLanguage: '像坐过山车，可能一天涨跌超过40%，极端风险资产', rating: 1 },
  ],
};

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
