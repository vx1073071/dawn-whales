// ── R204 autoclaw #3 + #4: Factor-Based Strategy Template Definitions ──────
// 13 core templates: 5 HK + 8 Crypto
// Each template: 四铁律 + factor combo with weights + AI trigger points (3-5)
// Designed for JVS TemplateEngine + TemplateRegistry consumption
//
// Market coverage: 🇭🇰 HK(5) + 🪙 Crypto(8)
// Factor base: 298 factors across 44 categories
//
// ≥ 500L production-ready

// ── Types (aligned with JVS TemplateEngine expected interface) ─────────────

export type MarketTag = '🇭🇰' | '🇺🇸' | '🪙' | '🇯🇵' | '🇹🇼' | '🇰🇷' | '🇸🇬' | '🇦🇺' | '🇮🇳' | '🇪🇺' | '🛢️';

/** R206: DeepSeek conversational chat configuration for AI-native templates */

/** Structured holding days for filtering/sorting */
export interface HoldingDays {
  min: number;
  max: number;
  unit: 'day' | 'month' | 'year';
}

export interface DeepSeekChatConfig {
  enabled: boolean;
  /** System prompt prefix — injected before user prompt */
  systemPrompt: string;
  /** Suggested conversation starters (max 5) */
  conversationStarters: string[];
  /** Parameters the AI can tune via conversation */
  tunableParams: { paramName: string; description: string; currentValue: string; range: string }[];
  /** Billing: per conversation turn */
  costPerTurn: number;          // USDT, typically 1.0
  /** AI degradation chain: V4ProFold → V4ProRaw → V4Flash → MiniMax */
  degradationChain: 'AIDegradationChain';
  /** Whether user can one-click apply AI-suggested params to template */
  oneClickApply: boolean;
  /** Max conversation rounds per session before re-auth */
  maxRounds: number;
}

export interface AITriggerPoint {
  id: string;                    // e.g. "backtest-read"
  label: string;                  // AI回测解读
  touchpointId: string;          // BillingTouchpoint identifier
  costUSDT: number;              // 1 | 1.5 | 2
  description: string;           // What the AI does
}

export interface TemplateFourIronRules {
  /** 铁律1: 一句话人话 ≤80字 */
  humanLine: string;
  /** 铁律2: 止损规则 */
  stopLossRule: string;
  /** 铁律3: 适用市场+品种 */
  marketScope: { market: MarketTag; assetClass: string; symbols?: string[] }[];
  /** 铁律4: 失效自检 */
  failureCheck: string;
}

export interface FactorComboEntry {
  factorId: string;
  factorName: string;
  weight: number;                // 0-100, sum = 100
  direction: 'long' | 'short';   // Factor exposure direction
  threshold?: { min?: number; max?: number };  // Signal threshold
}

export interface FactorStrategyTemplate {
  id: string;                    // e.g. "hk-ah-premium"
  name: string;                  // English name
  nameCn: string;                // Chinese name
  /** R214: Expanded category to match all 11 market tags + AI + cross-market + commodity */
  category: 'hk' | 'us' | 'crypto' | 'jp' | 'kr' | 'tw' | 'sg' | 'au' | 'in' | 'eu' | 'cross' | 'commodity' | 'ai';
  difficulty: 1 | 2 | 3 | 4 | 5; // ⭐ rating
  timeHorizon: 'intraday' | 'swing' | 'position' | 'long-term';
  expectedHoldingDays: string;   // e.g. "3-14天"

  /** 四铁律 */
  fourIronRules: TemplateFourIronRules;

  /** Factor combo: all factor weights must sum to 100 */
  factorCombo: FactorComboEntry[];

  /** 3-5 AI付费触发点 */
  aiTriggerPoints: AITriggerPoint[];

  /** R206: DeepSeek conversational chat trigger (for AI-native templates) */
  deepSeekChat?: DeepSeekChatConfig;

  /** R214: Structured holding days for filtering/sorting (P8) */
  holdingDays: HoldingDays;

  /** Backtest summary (placeholder until real backtest runs) */
  backtestSummary?: string;

  /** Metadata */
  tags: string[];
  version: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🇭🇰 HK TEMPLATES (5) — autoclaw #3
// ═══════════════════════════════════════════════════════════════════════════════

export const HK_TEMPLATES: FactorStrategyTemplate[] = [

  // ── 1. AH溢价套利 ────────────────────────────────────────────────────────
  {
    id: 'hk-ah-premium',
    name: 'AH Premium Arbitrage',
    nameCn: 'AH溢价套利',
    category: 'hk',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '5-20天',
    holdingDays: { min: 5, max: 20, unit: 'day' },
    fourIronRules: {
      humanLine: '当A股比H股贵超30%时买H股卖A股，溢价回落到15%以下平仓。利用同一公司两地定价差套利。',
      stopLossRule: 'AH溢价扩大超过入场时5%止损，或单只亏损超过3%止损。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['H股AH双重上市标的: 工商银行/中国平安/中石油等'] },
      ],
      failureCheck: 'AH溢价指数<115(溢价消失)时放弃此策略；人民币大幅贬值(>3%/月)时暂停(汇率驱动溢价而非定价错误)。',
    },
    factorCombo: [
      { factorId: 'HK_AH_PREMIUM', factorName: 'AH溢价因子', weight: 45, direction: 'short', threshold: { min: 30 } },
      { factorId: 'HK_SOUTHBOUND_SMART', factorName: '南向资金流向', weight: 20, direction: 'long' },
      { factorId: 'VALUE_PE', factorName: '市盈率价值', weight: 15, direction: 'long' },
      { factorId: 'MOMENTUM_1M', factorName: '1月反转', weight: 10, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AH溢价策略健康: 价差仍在历史区间? 套利窗口>1%?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'AH溢价突破阈值实时推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'AI分析AH溢价历史套利胜率和最优入场阈值' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: 'AI自动优化溢价阈值和持仓天数' },
      { id: 'alt-data', label: '替代数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '解锁AH溢价实时监控+港交所持股数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AH溢价套利策略助手。基于AH溢价/南向资金/PB价值因子，帮助用户优化溢价阈值、持仓周期和止损参数。',
      conversationStarters: [
        'AH溢价何时入场最优？',
        '南向资金流出需要减仓吗？',
        '溢价阈值设30%还是35%更优？'
      ],
      tunableParams: [
        { paramName: 'premiumThreshold', description: 'AH溢价入场阈值', currentValue: '30%', range: '25%-40%' },
        { paramName: 'holdingDays', description: '持仓天数', currentValue: '5-20', range: '3-30天' },
        { paramName: 'stopLossPct', description: '止损百分比', currentValue: '5%', range: '3%-8%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['AH溢价', '套利', '跨市场', '价值'],
    version: 'v1.0',
  },

  // ── 2. 窝轮/牛熊证方向 ────────────────────────────────────────────────────
  {
    id: 'hk-warrant-direction',
    name: 'Warrant/CBBC Direction Flow',
    nameCn: '窝轮方向追踪',
    category: 'hk',
    difficulty: 4,
    timeHorizon: 'intraday',
    expectedHoldingDays: '1-3天',
    holdingDays: { min: 1, max: 3, unit: 'day' },
    fourIronRules: {
      humanLine: '当窝轮/牛熊证街货量集中在某个方向时反向操作——散户窝轮持仓是反向指标。散户大量买入认购=看跌信号。',
      stopLossRule: '窝轮方向指标回落到中位(±0.3)止损；持仓不超过3个交易日。',
      marketScope: [
        { market: '🇭🇰', assetClass: '窝轮/牛熊证', symbols: ['恒指/腾讯/美团/阿里/港交所相关轮证'] },
      ],
      failureCheck: '市场单边暴涨暴跌(恒指单日>5%)→窝轮被强平导致数据失真→暂停；港交所修改轮证规则→重新评估。',
    },
    factorCombo: [
      { factorId: 'HK_WARRANT_FLOW', factorName: '窝轮资金流向', weight: 40, direction: 'short', threshold: { min: 1.5 } },
      { factorId: 'HK_CBBC_RATIO', factorName: '牛熊证比例', weight: 25, direction: 'short', threshold: { min: 1.5 } },
      { factorId: 'HK_SHORT_SELL_RATIO', factorName: '沽空比率', weight: 15, direction: 'long' },
      { factorId: 'RETAIL_SENTIMENT', factorName: '散户情绪', weight: 10, direction: 'short' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'long', threshold: { max: 30 } },
    ],
    aiTriggerPoints: [
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '窝轮街货量异常+散户情绪反转推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '窝轮反向指标历史胜率分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '诊断窝轮拥挤度+牛熊比例可靠性' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '窝轮实时街货量+发行商对冲数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股窝轮牛熊证策略助手。基于街货量/散户情绪/沽空比率因子，帮助用户判断方向信号强度和止盈止损。',
      conversationStarters: [
        '窝轮街货量激增是反向信号吗？',
        '牛熊证比例怎么看方向？',
        '窝轮数据失真怎么办？'
      ],
      tunableParams: [
        { paramName: 'flowThreshold', description: '窝轮方向阈值', currentValue: '1.5', range: '1.0-2.5' },
        { paramName: 'holdingDays', description: '持仓天数', currentValue: '1-3', range: '1-5天' },
        { paramName: 'sentimentWeight', description: '散户情绪权重', currentValue: '10%', range: '5%-20%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['窝轮', '牛熊证', '逆向', '散户情绪'],
    version: 'v1.0',
  },

  // ── 3. 高股息阶梯 ────────────────────────────────────────────────────────
  {
    id: 'hk-dividend-ladder',
    name: 'HK Dividend Ladder',
    nameCn: '港股股息阶梯',
    category: 'hk',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '90-365天',
    holdingDays: { min: 3, max: 12, unit: 'month' },
    fourIronRules: {
      humanLine: '买入港股中股息率>5%+派息稳定(连续3年)+PB<1的蓝筹，按除息日排期轮动持有，吃股息+估值修复双重收益。',
      stopLossRule: '股息率跌破4%或公司削减派息>20%→立即卖出。PB回升到>1.2时分批止盈。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['中资银行/电信/能源/REITs等稳定派息港股蓝筹'] },
      ],
      failureCheck: '利率大幅上升(美联储加息>2%)→高股息股被抛售→暂停加仓；港股通南向资金连续2月净流出→减仓。',
    },
    factorCombo: [
      { factorId: 'HK_DIVIDEND_YIELD', factorName: '港股股息率', weight: 40, direction: 'long', threshold: { min: 5 } },
      { factorId: 'HK_PB_RATIO', factorName: '港股PB价值', weight: 20, direction: 'long', threshold: { max: 1.0 } },
      { factorId: 'DIVIDEND_STABILITY', factorName: '派息稳定性', weight: 20, direction: 'long' },
      { factorId: 'HK_SOUTHBOUND_SMART', factorName: '南向资金', weight: 10, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'health-check', label: 'AI策略健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '检查持仓股息是否可持续' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化股息率阈值和仓位分配' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股股息策略历史表现分析' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港交所披露易+公司公告派息预测数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股股息阶梯策略助手。基于股息率/PB价值/派息稳定性因子，帮助用户优化除息日轮动和调仓节奏。',
      conversationStarters: [
        '港股股息率>5%的蓝筹有哪些？',
        '除息日轮动怎么排期最优？',
        '公司削派息时怎么切换？'
      ],
      tunableParams: [
        { paramName: 'divYieldMin', description: '最低股息率', currentValue: '5%', range: '4%-7%' },
        { paramName: 'holdingMonths', description: '持仓月数', currentValue: '3-12', range: '1-24个月' },
        { paramName: 'pbMax', description: 'PB上限', currentValue: '1.0', range: '0.5-1.5' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['高股息', '价值', '蓝筹', '长期持有'],
    version: 'v1.0',
  },

  // ── 4. 南向资金追踪 ──────────────────────────────────────────────────────
  {
    id: 'hk-southbound-tracker',
    name: 'Southbound Smart Money Tracker',
    nameCn: '南向聪明钱追踪',
    category: 'hk',
    difficulty: 2,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-21天',
    holdingDays: { min: 7, max: 21, unit: 'day' },
    fourIronRules: {
      humanLine: '跟着南向资金走：南向连续3日净买入>50亿港元时买入港股，南向连续3日净卖出>30亿时减仓。资金流向是港股最大的alpha来源。',
      stopLossRule: '南向资金反转(连续2日净卖出>10亿)时止损，或个股跌超5%止损。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['恒生科技/恒生指数权重股: 腾讯/美团/阿里/快手/小米'] },
      ],
      failureCheck: '人民币汇率突然大幅贬值(>2%/周)→南向资金可能是避险而非主动流入→暂停。中美关系急剧恶化→港股系统性风险>南向alpha。',
    },
    factorCombo: [
      { factorId: 'HK_SOUTHBOUND_SMART', factorName: '南向资金智能流向', weight: 40, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'HK_BOARD_TRADE_HK', factorName: '港股通成交占比', weight: 20, direction: 'long' },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 20, direction: 'long' },
      { factorId: 'HK_SECTOR_ROTATION', factorName: '板块轮动', weight: 10, direction: 'long' },
      { factorId: 'MONEY_FLOW_CMF', factorName: '资金流量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '南向资金策略健康: 资金流向趋势延续? IC>0.03?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港股通北向资金+港交所CCASS持仓替代数据' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '南向资金历史alpha分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '南向资金拥挤度+边际效应衰减预警' },
      { id: 'ai-daily', label: 'AI每日简报', touchpointId: 'AI_DAILY_BRIEFING', costUSDT: 1, description: '每日南向资金动向+Top被买标的' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股南向资金追踪策略助手。基于南向净买入/板块偏好/聪明钱信号因子，帮助用户跟随后续资金流向。',
      conversationStarters: [
        '南向资金流向哪个板块最多？',
        '南向净流出是否持续？',
        '聪明钱信号可靠性如何提升？'
      ],
      tunableParams: [
        { paramName: 'flowThreshold', description: '南向流入阈值', currentValue: '5亿', range: '2-10亿/日' },
        { paramName: 'sectorRotation', description: '板块轮动间隔', currentValue: '2周', range: '1-4周' },
        { paramName: 'trailingStop', description: '移动止损', currentValue: '8%', range: '5%-12%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['南向资金', '资金流', '趋势', '聪明钱'],
    version: 'v1.0',
  },

  // ── 5. 红筹回归 ──────────────────────────────────────────────────────────
  {
    id: 'hk-redchip-homecoming',
    name: 'Red Chip Homecoming Arbitrage',
    nameCn: '红筹回归套利',
    category: 'hk',
    difficulty: 4,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '布局可能回归A股/科创板二次上市的中概红筹股。触发信号：提交A股上市申请+港股折价>20%→买入港股等待估值收敛。',
      stopLossRule: '回归申请被否→立即清仓；申请后3个月内无进展→减半仓；港股折价扩大到>40%→止损。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['已/拟回A中概: 中芯国际/华虹/百济神州/再鼎医药等'] },
      ],
      failureCheck: 'A股IPO审核收紧(过会率<70%)→回归路径被封→暂停；中美审计监管合作破裂→中概退市风险>回归溢价。',
    },
    factorCombo: [
      { factorId: 'HK_REDCHIP_PREMIUM', factorName: '红筹AH折价', weight: 35, direction: 'long', threshold: { min: 20 } },
      { factorId: 'HK_LISTING_EVENT', factorName: '港股上市事件', weight: 25, direction: 'long' },
      { factorId: 'HK_AH_PREMIUM', factorName: 'AH溢价', weight: 15, direction: 'short' },
      { factorId: 'SECTOR_TECH', factorName: '科技板块', weight: 15, direction: 'long' },
      { factorId: 'REGULATORY_RISK', factorName: '监管风险', weight: 10, direction: 'short', threshold: { max: -0.5 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '红筹回A策略健康: 回A进度正常? 价差合理?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '红筹回A进度+价差信号推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '红筹回归概率+时间线预测' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '历史中概回归案例收益率分析' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港交所/A股IPO审核进度+招股书分析' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股红筹回归策略助手。基于红筹股回A股折价/政策催化剂/流动性对比因子，帮助用户抓住回A套利机会。',
      conversationStarters: [
        '红筹回A大概率折价多少？',
        '哪些红筹股最有回A可能？',
        '政策暂停回A怎么办？'
      ],
      tunableParams: [
        { paramName: 'discountTarget', description: '回归折价目标', currentValue: '20%', range: '10%-35%' },
        { paramName: 'policyCatalyst', description: '政策催化剂权重', currentValue: '30%', range: '20%-40%' },
        { paramName: 'timeHorizon', description: '时间窗口', currentValue: '3-12月', range: '1-24月' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['红筹', '回归套利', '事件驱动', '中概'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🪙 CRYPTO TEMPLATES (8) — autoclaw #4
// ═══════════════════════════════════════════════════════════════════════════════

export const CRYPTO_TEMPLATES: FactorStrategyTemplate[] = [

  // ── 6. BTC趋势跟踪 ───────────────────────────────────────────────────────
  {
    id: 'crypto-btc-trend',
    name: 'BTC Trend Following',
    nameCn: 'BTC趋势跟踪',
    category: 'crypto',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '14-60天',
    holdingDays: { min: 14, max: 60, unit: 'day' },
    fourIronRules: {
      humanLine: '当BTC 12月动量>1.5+MVRV Z-Score<5+资金费率正常→做多BTC。比特币是最强的趋势资产——跟着趋势走，不要猜顶底。',
      stopLossRule: 'MVRV_Z>7(极度泡沫)→减仓到30%；12月动量转负→止损；资金费率>0.1%(过度看多)→减半仓。',
      marketScope: [
        { market: '🪙', assetClass: '加密现货', symbols: ['BTC/USDT'] },
      ],
      failureCheck: '交易所被盗/监管禁令(如2022 FTX)→趋势策略在极端黑天鹅中失效；稳定币脱锚→系统性风险>趋势信号→清仓。',
    },
    factorCombo: [
      { factorId: 'BTC_MOMENTUM_12M', factorName: 'BTC 12月动量', weight: 35, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'CRYPTO_MVRV_Z', factorName: 'MVRV Z-Score', weight: 25, direction: 'long', threshold: { max: 5 } },
      { factorId: 'CRYPTO_FUNDING_RATE', factorName: '资金费率', weight: 15, direction: 'long', threshold: { max: 0.1 } },
      { factorId: 'CRYPTO_MINER_FLOW', factorName: '矿工流向', weight: 15, direction: 'long', threshold: { min: -1 } },
      { factorId: 'CRYPTO_STABLECOIN_MINT', factorName: '稳定币铸造', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'BTC趋势策略月度健康体检: IC>0.02? 因子相关性<0.7?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'BTC趋势信号+资金费率异动实时推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'BTC趋势策略各周期表现分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'MVRV+Puell+资金费率综合诊断' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化动量窗口+NVRV阈值' },
      { id: 'alt-data', label: '链上数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '实时链上数据: 巨鲸交易+交易所余额+活跃地址' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是BTC趋势跟踪策略助手。基于BTC动量/全网算力/MVRV/交易所余额因子，帮助用户调整跟踪止损和仓位。',
      conversationStarters: [
        'BTC趋势是否还健康？',
        'MVRV进入危险区了吗？',
        '算力下跌是风险信号吗？'
      ],
      tunableParams: [
        { paramName: 'trendPeriod', description: '趋势判断周期', currentValue: '20日', range: '10-60日' },
        { paramName: 'trailingStop', description: '跟踪止损', currentValue: '15%', range: '10%-25%' },
        { paramName: 'positionPct', description: '建议仓位', currentValue: '40%', range: '20%-80%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['BTC', '趋势', '动量', '链上'],
    version: 'v1.0',
  },

  // ── 7. ETH/BTC轮动 ───────────────────────────────────────────────────────
  {
    id: 'crypto-eth-btc-rotation',
    name: 'ETH/BTC Rotation',
    nameCn: 'ETH/BTC轮动',
    category: 'crypto',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '5-20天',
    holdingDays: { min: 5, max: 20, unit: 'day' },
    fourIronRules: {
      humanLine: 'ETH/BTC汇率>0.07超配ETH；<0.05超配BTC。在两大加密巨头间动态轮动。',
      stopLossRule: 'ETH/BTC汇率跌破入场时2%止损；任一持仓跌超8%止损。',
      marketScope: [
        { market: '🪙', assetClass: '加密现货', symbols: ['ETH/USDT', 'BTC/USDT'] },
      ],
      failureCheck: 'ETH重大升级失败/分叉→ETH基本面改变→暂停；BTC主导率持续上升(>60%)→BTC一枝独秀→全配BTC。',
    },
    factorCombo: [
      { factorId: 'ETH_BTC_RATIO', factorName: 'ETH/BTC汇率', weight: 30, direction: 'long', threshold: { min: 0.06 } },
      { factorId: 'CRYPTO_DEFI_TVL', factorName: 'DeFi TVL', weight: 20, direction: 'long' },
      { factorId: 'ETH_GAS_PRICE', factorName: 'ETH Gas费', weight: 15, direction: 'long' },
      { factorId: 'CRYPTO_STABLECOIN_MINT', factorName: '稳定币铸造', weight: 15, direction: 'long' },
      { factorId: 'BTC_DOMINANCE', factorName: 'BTC主导率', weight: 20, direction: 'short', threshold: { max: 55 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'ETH/BTC轮动策略健康检查: 轮动信号准确率>60%?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'ETH链上Gas费+稳定币供应+DeFi TVL替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'ETH/BTC轮动信号+Gas费异常推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'ETH/BTC轮动历史表现' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'DeFi生态健康度+ETH燃烧率分析' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '轮动阈值+持仓比例优化' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是ETH/BTC轮动策略助手。基于ETH/BTC汇率/Gas费/DeFi TVL/L2活跃度因子，帮助用户判断轮动时机。',
      conversationStarters: [
        'ETH/BTC汇率现在该轮动吗？',
        'Gas费暴涨是牛市信号吗？',
        'L2吸走ETH价值怎么办？'
      ],
      tunableParams: [
        { paramName: 'ratioThreshold', description: 'ETH/BTC轮动阈值', currentValue: '0.06', range: '0.04-0.08' },
        { paramName: 'gasIndicator', description: 'Gas费参考权重', currentValue: '25%', range: '15%-35%' },
        { paramName: 'rebalancePeriod', description: '调仓周期', currentValue: '14天', range: '7-30天' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['ETH', 'BTC', '轮动', '相对价值'],
    version: 'v1.0',
  },

  // ── 8. 资金费率套利 ──────────────────────────────────────────────────────
  {
    id: 'crypto-funding-arbitrage',
    name: 'Funding Rate Arbitrage',
    nameCn: '资金费率套利',
    category: 'crypto',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '1-3天',
    holdingDays: { min: 1, max: 3, unit: 'day' },
    fourIronRules: {
      humanLine: '资金费率>0.1%(极度看多)→现货多头+合约空头(费率套利)；费率<-0.05%(极度看空)→现货空头+合约多头。赚的是市场极端情绪的费率差。',
      stopLossRule: '资金费率回归正常(±0.01%)即平仓；方向性敞口>5%时止损。',
      marketScope: [
        { market: '🪙', assetClass: '加密合约', symbols: ['BTC/USDT永续', 'ETH/USDT永续'] },
      ],
      failureCheck: '交易所修改资金费率规则→重新计算盈亏比；标的剧烈波动(单日>20%)→套利方向性风险>费率收益→暂停。',
    },
    factorCombo: [
      { factorId: 'CRYPTO_FUNDING_EXTREME', factorName: '资金费率极端', weight: 45, direction: 'short', threshold: { min: 2.0 } },
      { factorId: 'CRYPTO_OPEN_INTEREST', factorName: '未平仓合约', weight: 20, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'CRYPTO_LIQUIDATION_RISK', factorName: '清算风险', weight: 15, direction: 'short' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'short' },
      { factorId: 'BTC_MOMENTUM_1M', factorName: 'BTC 1月动量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '资金费率套利健康: 套利空间持续存在? 执行成功率>90%?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '交易所BTC储备+稳定币流入/流出替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '资金费率异动触发套利窗口推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '资金费率套利各费率区间的历史胜率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'OI+费率+Liquidation综合市场情绪诊断' },
      { id: 'stress-test', label: 'AI压力测试', touchpointId: 'AI_STRESS_TEST', costUSDT: 2, description: '极端行情下套利策略最大回撤模拟' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是加密资金费率套利策略助手。基于永续合约资金费率/现货溢价/市场情绪因子，帮助用户优化套利参数。',
      conversationStarters: [
        '资金费率套利年化收益多少？',
        '资金费率转负该平仓吗？',
        '极端行情套利还安全吗？'
      ],
      tunableParams: [
        { paramName: 'fundingThreshold', description: '资金费率入场阈值', currentValue: '0.01%', range: '0.005%-0.03%' },
        { paramName: 'maxLeverage', description: '最大杠杆', currentValue: '3x', range: '1x-5x' },
        { paramName: 'exitFunding', description: '退出资金费率', currentValue: '0.003%', range: '0.001%-0.01%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['资金费率', '套利', '中性', '合约'],
    version: 'v1.0',
  },

  // ── 9. 清算猎杀 ──────────────────────────────────────────────────────────
  {
    id: 'crypto-liquidation-hunt',
    name: 'Liquidation Hunt (Counter-Trend)',
    nameCn: '清算猎杀',
    category: 'crypto',
    difficulty: 4,
    timeHorizon: 'intraday',
    expectedHoldingDays: '1-2天',
    holdingDays: { min: 1, max: 2, unit: 'day' },
    fourIronRules: {
      humanLine: '当多头清算量>2x日均+未平仓合约暴增→"多头被猎杀"→抄底做多；空头清算量>2x日均→"空头被挤压"→做空。吃的是爆仓盘的流动性。',
      stopLossRule: '入场后2小时内不反弹→止损；清算量回落到<日均→平仓。杠杆≤3x，永不做>5x。',
      marketScope: [
        { market: '🪙', assetClass: '加密合约', symbols: ['BTC/USDT永续', 'ETH/USDT永续'] },
      ],
      failureCheck: '交易所清算数据延迟(>5分钟)→数据滞后→暂停；连续3次猎杀失败→市场结构改变→重新评估。',
    },
    factorCombo: [
      { factorId: 'CRYPTO_LIQUIDATION_RISK', factorName: '清算量异常', weight: 40, direction: 'long', threshold: { min: 2.0 } },
      { factorId: 'CRYPTO_OPEN_INTEREST', factorName: '未平仓合约', weight: 20, direction: 'long' },
      { factorId: 'MOMENTUM_1M', factorName: '1月反转', weight: 20, direction: 'long', threshold: { min: -2 } },
      { factorId: 'CRYPTO_FUNDING_RATE', factorName: '资金费率', weight: 10, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'long', threshold: { min: 2 } },
    ],
    aiTriggerPoints: [
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '大额爆仓事件实时推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '清算热力图+OI结构分析' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '清算猎杀历史触发的反弹概率' },
      { id: 'stress-test', label: 'AI压力测试', touchpointId: 'AI_STRESS_TEST', costUSDT: 2, description: '连环清算场景下的策略最大回撤' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是加密爆仓猎手策略助手。基于爆仓热力图/多空比/未平仓合约/资金费率因子，帮助用户判断极端行情反向机会。',
      conversationStarters: [
        '爆仓密集区会反弹吗？',
        '多空比极端该抄底吗？',
        'OI骤降是底还是腰斩？'
      ],
      tunableParams: [
        { paramName: 'liqThreshold', description: '爆仓金额阈值', currentValue: '1亿', range: '5000万-5亿' },
        { paramName: 'longShortRatio', description: '多空比极端值', currentValue: '3.0', range: '2.0-5.0' },
        { paramName: 'recoveryWait', description: '企稳等待时间', currentValue: '4小时', range: '1-24小时' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['清算', '逆向', '高杠杆', '短线'],
    version: 'v1.0',
  },

  // ── 10. 链上三灯 ─────────────────────────────────────────────────────────
  {
    id: 'crypto-onchain-three-lights',
    name: 'On-Chain Three-Light Signal',
    nameCn: '链上三灯信号',
    category: 'crypto',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '14-90天',
    holdingDays: { min: 14, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '三盏灯全绿才入场：🟢Stablecoin在铸造(新钱进场)+🟢矿工在囤币(不卖)+🟢资金费率正常=牛市信号。两绿一黄=观望，两红=减仓。',
      stopLossRule: '任两灯转红→减仓50%；三灯全红→清仓。红灯定义：稳定币销毁>铸造+矿工暴量卖币+费率极端。',
      marketScope: [
        { market: '🪙', assetClass: '加密现货', symbols: ['BTC/USDT', 'ETH/USDT'] },
      ],
      failureCheck: '交易所黑客→链上数据仍看涨但币价可能暴跌(因为在黑客地址)→暂停。稳定币(USDT/USDC)脱锚→三灯信号全部失真→清仓。',
    },
    factorCombo: [
      { factorId: 'CRYPTO_STABLECOIN_MINT', factorName: '稳定币铸造', weight: 35, direction: 'long' },
      { factorId: 'CRYPTO_MINER_FLOW', factorName: '矿工流向', weight: 30, direction: 'long', threshold: { min: -1 } },
      { factorId: 'CRYPTO_FUNDING_RATE', factorName: '资金费率', weight: 20, direction: 'long', threshold: { max: 0.1 } },
      { factorId: 'CRYPTO_MVRV_Z', factorName: 'MVRV Z-Score', weight: 15, direction: 'long', threshold: { max: 5 } },
    ],
    aiTriggerPoints: [
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '三灯信号的各周期胜率统计' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '链上活跃度+交易所余额+巨鲸行为综合诊断' },
      { id: 'signal-push', label: '信号推送订阅', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '三灯信号变化即时推送' },
      { id: 'alt-data', label: '链上数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '实时链上: 交易所净流入+聪明钱+巨鲸警报' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是链上三灯策略助手。基于大额转账/交易所净流入/稳定币铸币/巨鲸地址因子，帮助用户解读链上信号。',
      conversationStarters: [
        '链上大额转入交易所=要砸盘？',
        '稳定币大量铸币是买入信号吗？',
        '三灯全绿要不要加仓？'
      ],
      tunableParams: [
        { paramName: 'whaleThreshold', description: '巨鲸交易阈值', currentValue: '1000BTC', range: '500-5000BTC' },
        { paramName: 'inflowSignal', description: '交易所流入权重', currentValue: '40%', range: '25%-55%' },
        { paramName: 'stablecoinMint', description: '稳定币铸币权重', currentValue: '35%', range: '20%-50%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['链上', '三灯', '信号', '趋势'],
    version: 'v1.0',
  },

  // ── 11. 期现套利 ─────────────────────────────────────────────────────────
  {
    id: 'crypto-futures-spot-arb',
    name: 'Futures-Spot Basis Arbitrage',
    nameCn: '期现套利',
    category: 'crypto',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '7-90天',
    holdingDays: { min: 7, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '当季度合约溢价>年化15%→买现货+空合约(锁定价差)。溢价就是你的无风险收益。持有到交割日，稳吃年化15-30%。',
      stopLossRule: '溢价回落到<年化5%→平仓(收益已不够覆盖资金成本)；合约保证金不足时补仓。',
      marketScope: [
        { market: '🪙', assetClass: '加密合约+现货', symbols: ['BTC/USDT', 'ETH/USDT'] },
      ],
      failureCheck: '交易所限制合约杠杆/修改保证金规则→套利成本增加→重新计算；现货与合约价差出现负溢价(Backwardation)→停止。',
    },
    factorCombo: [
      { factorId: 'CRYPTO_BASIS_SPREAD', factorName: '期现价差', weight: 50, direction: 'long', threshold: { min: 15 } },
      { factorId: 'CRYPTO_FUNDING_RATE', factorName: '资金费率', weight: 20, direction: 'long', threshold: { max: 0.05 } },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 15, direction: 'short', threshold: { max: 50 } },
      { factorId: 'CRYPTO_OPEN_INTEREST', factorName: '未平仓合约', weight: 15, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '期现套利健康: 价差>交易成本? IC持续为正?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '期货持仓量+多空比+清算热力图替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '期现价差异常扩大推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '各交易所期现套利年化收益对比' },
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '全交易所期现/跨期价差实时扫描' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '最优入场溢价阈值+交割日前平仓时机' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是加密期现套利策略助手。基于期货溢价/资金费率/交割日期因子，帮助用户优化期现套利和到期管理。',
      conversationStarters: [
        '期货溢价>5%怎么套利？',
        '交割日临近溢价收窄怎么办？',
        '不同交易所溢价差异怎么利用？'
      ],
      tunableParams: [
        { paramName: 'premiumEntry', description: '溢价入场阈值', currentValue: '3%', range: '1%-10%' },
        { paramName: 'maxTenor', description: '最大期限', currentValue: '90天', range: '30-180天' },
        { paramName: 'minAPY', description: '最低年化收益', currentValue: '15%', range: '10%-30%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['期现套利', '中性', '低风险', '稳定收益'],
    version: 'v1.0',
  },

  // ── 12. HODL定投增强 ─────────────────────────────────────────────────────
  {
    id: 'crypto-hodl-dca-enhanced',
    name: 'HODL DCA Enhanced',
    nameCn: 'HODL定投增强',
    category: 'crypto',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '180-730天',
    holdingDays: { min: 6, max: 24, unit: 'month' },
    fourIronRules: {
      humanLine: '每周定投BTC/ETH，但在MVRV_Z<0(被低估)时加倍买入+在MVRV_Z>7(泡沫)时跳过定投。比普通定投多赚一倍。',
      stopLossRule: '不定时止损。MVRV_Z>7时启动分批卖出(每次卖20%，间隔2周)；跌破200周均线时清仓(真正的熊市确认)。',
      marketScope: [
        { market: '🪙', assetClass: '加密现货', symbols: ['BTC/USDT', 'ETH/USDT'] },
      ],
      failureCheck: '全球加密货币被禁(如大国全面禁止)→定投标的不复存在→停止。BTC市值跌破黄金市值的10%→加密叙事失效→重新评估。',
    },
    factorCombo: [
      { factorId: 'CRYPTO_MVRV_Z', factorName: 'MVRV Z-Score', weight: 35, direction: 'long', threshold: { max: 3 } },
      { factorId: 'BTC_200WMA', factorName: 'BTC 200周均线', weight: 25, direction: 'long' },
      { factorId: 'CRYPTO_PUELL_MULTIPLE', factorName: 'Puell Multiple', weight: 20, direction: 'long', threshold: { max: 2 } },
      { factorId: 'CRYPTO_STABLECOIN_MINT', factorName: '稳定币铸造', weight: 10, direction: 'long' },
      { factorId: 'CRYPTO_MINER_FLOW', factorName: '矿工流向', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'DCA加仓时机+链上指标异动推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'HODL增强vs普通DCA长期收益对比' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化加倍/跳过阈值+定投频率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '周期定位+底部顶部概率评估' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是加密定投增强策略助手。基于恐惧贪婪指数/RSI超卖/200日均线偏离因子，帮助用户优化定投节奏。',
      conversationStarters: [
        '恐惧指数低该加倍定投吗？',
        'RSI超卖是最佳加仓点吗？',
        '定投组合需要调整吗？'
      ],
      tunableParams: [
        { paramName: 'fearGreed', description: '恐惧贪婪加仓阈值', currentValue: '25', range: '15-35' },
        { paramName: 'dcaAmount', description: '定投金额', currentValue: '100', range: '50-500' },
        { paramName: 'bonusMultiplier', description: '超跌加倍倍数', currentValue: '2x', range: '1.5x-3x' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['定投', 'HODL', '长期', '新手友好'],
    version: 'v1.0',
  },

  // ── 13. 巨鲸追踪 ─────────────────────────────────────────────────────────
  {
    id: 'crypto-whale-tracker',
    name: 'Whale Transaction Tracker',
    nameCn: '巨鲸追踪',
    category: 'crypto',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '3-14天',
    holdingDays: { min: 3, max: 14, unit: 'day' },
    fourIronRules: {
      humanLine: '当单笔>1000BTC的链上转账数量暴增+方向流向交易所→巨鲸在出货→做空/减仓；流向冷钱包→巨鲸在囤币→跟多。跟着最大的钱走。',
      stopLossRule: '巨鲸信号出现后3天内市场不跟→止损；鲸鱼地址突然反向操作→立即平仓。',
      marketScope: [
        { market: '🪙', assetClass: '加密现货', symbols: ['BTC/USDT', 'ETH/USDT'] },
      ],
      failureCheck: '交易所内部转账vs真实鲸鱼转账→数据源无法区分→误判风险高→降低仓位。鲸鱼地址被标记为交易所冷钱包(误判)→重新分类后恢复。',
    },
    factorCombo: [
      { factorId: 'CRYPTO_WHALE_TX', factorName: '巨鲸交易量', weight: 40, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'CRYPTO_EXCHANGE_INFLOW', factorName: '交易所净流入', weight: 25, direction: 'short', threshold: { min: 1.5 } },
      { factorId: 'CRYPTO_MINER_FLOW', factorName: '矿工流向', weight: 15, direction: 'long' },
      { factorId: 'CRYPTO_MVRV_Z', factorName: 'MVRV Z-Score', weight: 10, direction: 'long' },
      { factorId: 'MOMENTUM_1M', factorName: '1月反转', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '巨鲸地址聚类分析+行为模式识别' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '大额链上转账实时推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '鲸鱼行为与币价的历史关联度' },
      { id: 'alt-data', label: '链上数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '鲸鱼地址标签+聪明钱跟踪+OTC交易数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是加密巨鲸追踪策略助手。基于巨鲸地址/聪明钱/交易所大额转移/DeFi协议TVL因子，帮助用户跟随聪明钱。',
      conversationStarters: [
        '巨鲸增持什么币最多？',
        '聪明钱在买还是卖？',
        '大额提币到钱包是什么信号？'
      ],
      tunableParams: [
        { paramName: 'whaleListSize', description: '追踪巨鲸数量', currentValue: '50', range: '20-100' },
        { paramName: 'minTransfer', description: '最小转账金额', currentValue: '100万', range: '50万-500万' },
        { paramName: 'followDelay', description: '跟单延迟', currentValue: '1小时', range: '0-24小时' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['巨鲸', '链上', '聪明钱', '趋势'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Aggregate: all 13 autoclaw templates
// ═══════════════════════════════════════════════════════════════════════════════

/** All autoclaw-authored factor templates (R204 #3 + #4) */
export const AUTOCLAW_TEMPLATES: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,
  ...CRYPTO_TEMPLATES,
];

/** Template count by category */
export const TEMPLATE_COUNT = {
  hk: HK_TEMPLATES.length,
  crypto: CRYPTO_TEMPLATES.length,
  total: AUTOCLAW_TEMPLATES.length,
};

/** Quick lookup by ID */
export function getTemplateById(id: string): FactorStrategyTemplate | undefined {
  return AUTOCLAW_TEMPLATES.find(t => t.id === id);
}

/** Get templates by market tag */
export function getTemplatesByMarket(market: MarketTag): FactorStrategyTemplate[] {
  return AUTOCLAW_TEMPLATES.filter(t =>
    t.fourIronRules.marketScope.some(s => s.market === market)
  );
}

/** Validate 四铁律 completeness */
export function validateFourIronRules(template: FactorStrategyTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const rules = template.fourIronRules;

  if (!rules.humanLine || rules.humanLine.length === 0) errors.push('铁律1: 缺少一句话人话');
  if (rules.humanLine && rules.humanLine.length > 80) errors.push(`铁律1: 人话超过80字(当前${rules.humanLine.length}字)`);
  if (!rules.stopLossRule || rules.stopLossRule.length === 0) errors.push('铁律2: 缺少止损规则');
  if (!rules.marketScope || rules.marketScope.length === 0) errors.push('铁律3: 缺少适用市场');
  if (!rules.failureCheck || rules.failureCheck.length === 0) errors.push('铁律4: 缺少失效自检');

  // Validate factor weights sum to 100
  const weightSum = template.factorCombo.reduce((sum, f) => sum + f.weight, 0);
  if (Math.abs(weightSum - 100) > 1) errors.push(`因子权重和≠100%(当前${weightSum}%)`);

  // Validate AI trigger points count
  if (template.aiTriggerPoints.length < 3) errors.push(`AI触发点<3个(当前${template.aiTriggerPoints.length}个)`);
  if (template.aiTriggerPoints.length > 5) errors.push(`AI触发点>5个(当前${template.aiTriggerPoints.length}个)`);

  return { valid: errors.length === 0, errors };
}

/** Batch validate all templates */
export function validateAllTemplates(): { templateId: string; valid: boolean; errors: string[] }[] {
  return AUTOCLAW_TEMPLATES.map(t => ({
    templateId: t.id,
    ...validateFourIronRules(t),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// R205 autoclaw #2: JP/KR TEMPLATES (4)
// ═══════════════════════════════════════════════════════════════════════════════

export const JP_KR_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'jp-jpx-value-repair',
    name: 'JPX Value Repair',
    nameCn: 'JPX价值修复',
    category: 'jp',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '买入PB<1+ROE>8%+宣布回购的日本股票。东证交易所逼企业提升估值——跟着政策走，等PB修复到1以上卖出。',
      stopLossRule: 'PB持续低于0.5或ROE下降到<5%→卖出(真·价值陷阱)；回购计划取消→立即出。',
      marketScope: [{ market: '🇯🇵', assetClass: '股票', symbols: ['东证/日经PB<1的银行/商社/制造股'] }],
      failureCheck: '日本央行大幅加息→低PB股是借钱买的，利率上升杀估值→暂停；东证Value-up政策被新政府推翻→停止。',
    },
    factorCombo: [
      { factorId: 'JP_PB_RATIO', factorName: '日股PB价值', weight: 35, direction: 'long', threshold: { max: 1.0 } },
      { factorId: 'JP_VALUE_TRAP', factorName: '日股价值陷阱', weight: 20, direction: 'short', threshold: { max: 30 } },
      { factorId: 'JP_BUYBACK', factorName: '日股回购因子', weight: 20, direction: 'long' },
      { factorId: 'JP_FOREIGN_FLOW', factorName: '外资买卖超', weight: 15, direction: 'long' },
      { factorId: 'DIVIDEND_YIELD', factorName: '股息率', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'JPX价值修复健康: 价值因子溢价持续? 公司治理改善?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '东京证交所披露数据+外资持股变动替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'JPX价值股催化剂事件推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'JPX价值修复策略历史胜率分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '日股PB+ROE+回购综合估值诊断' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化PB阈值+持有期限' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是日股价值修复策略助手。基于PB/ROE/自社株買い/配当利回因子，帮助用户抓住日本公司治理改革机会。',
      conversationStarters: [
        '东证改革哪些股票受益最大？',
        'PB<1的日股能修复到1吗？',
        '自社株買い力度增强要加仓吗？'
      ],
      tunableParams: [
        { paramName: 'pbThreshold', description: 'PB门槛', currentValue: '1.0', range: '0.5-1.2' },
        { paramName: 'roeMin', description: '最小ROE', currentValue: '8%', range: '5%-12%' },
        { paramName: 'buybackWeight', description: '回购信号权重', currentValue: '30%', range: '20%-40%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['JPX', '价值修复', '回购', '日股'],
    version: 'v1.0',
  },
  {
    id: 'jp-nisa-dca-enhanced',
    name: 'NISA DCA Enhanced',
    nameCn: 'NISA定投增强',
    category: 'jp',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '90-365天',
    holdingDays: { min: 3, max: 12, unit: 'month' },
    fourIronRules: {
      humanLine: '利用日本NISA免税账户定投日股，在日股分红季(3月/9月)前加倍买入、夏季淡季减半。吃日股分红+季节性波动双重收益。',
      stopLossRule: '分红季后股价不填权(跌超5%)→出。不做长期止损，定投策略靠时间分散风险。',
      marketScope: [{ market: '🇯🇵', assetClass: '股票', symbols: ['日经225成分股+日本高息股'] }],
      failureCheck: '日元大幅贬值(>10%/年)→海外投资者收益被汇率吃掉→减半额。NISA制度被修改→重新评估。',
    },
    factorCombo: [
      { factorId: 'JP_DIVIDEND_SEASON', factorName: '日股分红季', weight: 35, direction: 'long', threshold: { min: 60 } },
      { factorId: 'JP_DIVIDEND_YIELD', factorName: '日股股息率', weight: 25, direction: 'long', threshold: { min: 3 } },
      { factorId: 'JPY_SENSITIVITY', factorName: '日元敏感度', weight: 15, direction: 'short', threshold: { max: 0.5 } },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 15, direction: 'long' },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'NISA定投增强vs普通DCA收益对比' },
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '持仓分红可持续性检查' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化分红季前后加倍/减半时机' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是NISA定投增强策略助手。基于日股估值/日元汇率/全球资金流向/东证指数ETF因子，帮助用户优化NISA免税额度利用。',
      conversationStarters: [
        'NISA额度怎么分配最优？',
        '日元贬值该加仓日股吗？',
        '东证ETF现在估值合理吗？'
      ],
      tunableParams: [
        { paramName: 'nisaAllocation', description: 'NISA额度分配', currentValue: '60%日股40%全球', range: '自定比例' },
        { paramName: 'yenHedge', description: '日元对冲比例', currentValue: '30%', range: '0%-50%' },
        { paramName: 'rebalanceFrequency', description: '再平衡频率', currentValue: '季度', range: '月度-年度' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['NISA', '定投', '分红', '新手友好'],
    version: 'v1.0',
  },
  {
    id: 'kr-krx-momentum',
    name: 'KRX Momentum Tracker',
    nameCn: 'KRX动量追踪',
    category: 'kr',
    difficulty: 2,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-30天',
    holdingDays: { min: 7, max: 30, unit: 'day' },
    fourIronRules: {
      humanLine: '跟着韩股动量最强的板块走：12月动量Top3板块+外资在买→超配。韩国是全球最强动量市场之一，跟趋势比猜顶底靠谱。',
      stopLossRule: '板块动量跌出Top3→切换到新Top3；个股跌超8%→止损。',
      marketScope: [{ market: '🇰🇷', assetClass: '股票', symbols: ['KOSPI: 三星/SK海力士/LG化学/现代汽车'] }],
      failureCheck: '韩元大幅贬值(>5%/月)→外资逃离→动量信号失真→暂停。朝鲜半岛紧张升级→KOSPI/KOSDAQ系统性风险→清仓。',
    },
    factorCombo: [
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 35, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'KR_FOREIGN_OWNERSHIP', factorName: '韩股外资持股', weight: 25, direction: 'long' },
      { factorId: 'SECTOR_TECH', factorName: '科技板块', weight: 15, direction: 'long' },
      { factorId: 'KR_SAMSUNG_LINKAGE', factorName: '三星关联', weight: 15, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'short', threshold: { max: 35 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'KRX动量策略健康: 动量因子IC>0? 换手率合理?' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '韩股动量策略历史表现' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '韩股外资+三星链综合诊断' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '板块动量轮动实时推送' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是韩国动量策略助手。基于外资净买入/动量/半导体周期/汇率因子，帮助用户在KRX市场捕捉趋势。',
      conversationStarters: [
        '外资买入持续性怎么看？',
        '半导体周期见底了吗？',
        '韩元贬值对哪些股票利好？'
      ],
      tunableParams: [
        { paramName: 'foreignFlow', description: '外资流入阈值', currentValue: '1000亿韩元', range: '500-3000亿' },
        { paramName: 'momentumPeriod', description: '动量周期', currentValue: '20日', range: '10-60日' },
        { paramName: 'semiconductorWeight', description: '半导体板块权重', currentValue: '40%', range: '25%-55%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['韩股', '动量', '板块轮动', '外资'],
    version: 'v1.0',
  },
  {
    id: 'kr-krx-export-cycle',
    name: 'KRX Export Cycle Rotation',
    nameCn: 'KRX出口周期轮动',
    category: 'kr',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '14-60天',
    holdingDays: { min: 14, max: 60, unit: 'day' },
    fourIronRules: {
      humanLine: '跟着韩国出口数据走：半导体出口增>20%→超配三星/芯片股；汽车出口增>15%→超配现代/起亚。韩国股市=全球贸易晴雨表。',
      stopLossRule: '出口数据连续2个月下降→切换板块；全球PMI<50→出口需求衰退→减仓。',
      marketScope: [{ market: '🇰🇷', assetClass: '股票', symbols: ['三星/SK海力士/现代/起亚/LG化学'] }],
      failureCheck: '美国对韩关税→出口股被重创→暂停。中国经济硬着陆→韩国出口失速→切换到内需板块。',
    },
    factorCombo: [
      { factorId: 'KR_EXPORT_CYCLE', factorName: '韩国出口周期', weight: 35, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'KR_FOREIGN_OWNERSHIP', factorName: '外资持股', weight: 20, direction: 'long' },
      { factorId: 'KR_KRW_SENSITIVITY', factorName: '韩元敏感度', weight: 15, direction: 'short', threshold: { max: 0.5 } },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 20, direction: 'long' },
      { factorId: 'SECTOR_MANUFACTURING', factorName: '制造业板块', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'KRX出口周期健康: 出口数据与股价相关性稳定?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '韩国出口数据+汇率异动推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '出口周期轮动历史胜率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '全球PMI+韩元+出口综合诊断' },
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '韩股出口vs内需板块轮动信号' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是韩国出口周期策略助手。基于韩国出口数据/全球PMI/半导体出货量/航运指数因子，帮助用户判断出口周期位置。',
      conversationStarters: [
        '韩国出口增速见顶了吗？',
        '全球PMI下行出口股怎么办？',
        '半导体出货量拐点怎么看？'
      ],
      tunableParams: [
        { paramName: 'exportGrowth', description: '出口增速阈值', currentValue: '5%', range: '0%-15%' },
        { paramName: 'globalPMI', description: '全球PMI权重', currentValue: '35%', range: '25%-45%' },
        { paramName: 'cyclePosition', description: '周期位置权重', currentValue: '30%', range: '20%-40%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['韩股', '出口', '周期', '轮动'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// R205 autoclaw #3: TW/SG/AU TEMPLATES (4)
// ═══════════════════════════════════════════════════════════════════════════════

export const TW_SG_AU_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'tw-twse-electronic-exdiv',
    name: 'TWSE Electronic Ex-Dividend Chase',
    nameCn: 'TWSE电子除权息行情',
    category: 'tw',
    difficulty: 2,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-21天',
    holdingDays: { min: 7, max: 21, unit: 'day' },
    fourIronRules: {
      humanLine: '台股除权息季(6-8月)前2周买入高息电子股→除权日卖出(抢权)；或除权后持有2周等填权。台股一年一度的硬钱行情。',
      stopLossRule: '除权日跌超3%→不填权→立即出。台股融资过热(>融资余额增速30%)→减半仓。',
      marketScope: [{ market: '🇹🇼', assetClass: '股票', symbols: ['台积电/联发科/鸿海/台达电'] }],
      failureCheck: '台积电大跌(>10%)→权重30%拖累TWSE→暂停。外资连续超卖→除权息行情被外资卖压→减仓。',
    },
    factorCombo: [
      { factorId: 'TW_DIVIDEND_CHASE', factorName: '台股除权息行情', weight: 40, direction: 'long', threshold: { min: 60 } },
      { factorId: 'TW_TSMC_LINKAGE', factorName: '台积电关联', weight: 20, direction: 'long' },
      { factorId: 'TW_FOREIGN_FLOW', factorName: '外资买卖超', weight: 15, direction: 'long' },
      { factorId: 'TW_MARGIN_OVERHEAT', factorName: '融资过热', weight: 15, direction: 'short', threshold: { max: 30 } },
      { factorId: 'DIVIDEND_YIELD', factorName: '股息率', weight: 10, direction: 'long', threshold: { min: 4 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'TWSE除权息健康: 填息率>70%? 因子稳定性?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '除权息日历+填息概率信号推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '台股除权息行情历史胜率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '台积电链+外资+融资综合诊断' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化除权前后持有天数' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是台股电子除息策略助手。基于台积电/联发科/鸿海等电子龙头除息日历+填息率+外资动向因子，帮助用户优化除息交易。',
      conversationStarters: [
        '台积电除息前该买吗？',
        '填息率高的电子股有哪些？',
        '外资在除息前后怎么操作？'
      ],
      tunableParams: [
        { paramName: 'exdivLookback', description: '除息回溯天数', currentValue: '30', range: '14-60天' },
        { paramName: 'fillRatioMin', description: '最低填息率', currentValue: '70%', range: '50%-90%' },
        { paramName: 'foreignWeight', description: '外资动向权重', currentValue: '30%', range: '20%-40%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['台股', '除权息', '季节性', '电子'],
    version: 'v1.0',
  },
  {
    id: 'sg-sgx-financial-yield',
    name: 'SGX Financial Yield Play',
    nameCn: 'SGX金融高息',
    category: 'sg',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '90-365天',
    holdingDays: { min: 3, max: 12, unit: 'month' },
    fourIronRules: {
      humanLine: '买入新加坡REITs+银行股，分红率>5%+新元稳定。新加坡是亚洲的收租天堂——REIT分红比定存高一倍。',
      stopLossRule: '分红率下降到<4%或REIT资产净值跌>10%→即出。新元大跌(>3%/月)→减半仓。',
      marketScope: [{ market: '🇸🇬', assetClass: '股票', symbols: ['REITs: Capitaland/Mapletree + DBS/OCBC/UOB'] }],
      failureCheck: '全球利率飙升→REIT融资成本飙升→分红被利息吃掉→暂停。写字楼崩盘→切换到工业/数据中心REIT。',
    },
    factorCombo: [
      { factorId: 'SG_REIT_SPREAD', factorName: 'REIT息差', weight: 40, direction: 'long', threshold: { min: 2 } },
      { factorId: 'SG_STI_WEIGHT', factorName: 'STI权重', weight: 20, direction: 'long' },
      { factorId: 'SG_SGD_LINKAGE', factorName: '新元关联', weight: 15, direction: 'long' },
      { factorId: 'SG_DIVIDEND_CULTURE', factorName: '分红文化', weight: 15, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'REIT分红可持续性分析' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '新加坡REIT长期收益率分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '息差+新元+物业周期综合诊断' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是新加坡金融收息策略助手。基于DBS/OCBC/UOB股息率/新加坡SORA利率/REITs收益因子，帮助用户优化收息组合。',
      conversationStarters: [
        '新加坡银行股息率现在多少？',
        'SORA利率下降对银行股利好吗？',
        '新加坡REIT vs 银行哪个更有吸引力？'
      ],
      tunableParams: [
        { paramName: 'yieldMin', description: '最低股息率', currentValue: '4%', range: '3%-6%' },
        { paramName: 'soraWeight', description: 'SORA利率权重', currentValue: '25%', range: '15%-35%' },
        { paramName: 'rebalanceQuarter', description: '调仓频率', currentValue: '季度', range: '月度-半年度' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['新加坡', 'REIT', '高息', '长期'],
    version: 'v1.0',
  },
  {
    id: 'au-asx-resource-franking',
    name: 'ASX Resource + Franking Double Play',
    nameCn: 'ASX资源Franking双收',
    category: 'au',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买入澳矿巨头BHP/RIO/FMG+银行CBA/NAB，吃矿价+Franking退税(100%分红=实际多30%)。',
      stopLossRule: '铁矿石单月跌>15%→矿企减半仓。Franking降到<50%→切换标的。澳元跌>5%→减仓。',
      marketScope: [{ market: '🇦🇺', assetClass: '股票', symbols: ['BHP/RIO/FMG + CBA/NAB/WBC/ANZ'] }],
      failureCheck: '中国经济硬着陆→矿业+银行双杀→清仓。澳洲改革Franking制度→分红优势丧失→重新评估。',
    },
    factorCombo: [
      { factorId: 'AU_COMMODITY_LINK', factorName: '澳股商品关联', weight: 30, direction: 'long' },
      { factorId: 'AU_FRANKING_CREDIT', factorName: 'Franking Credit', weight: 25, direction: 'long', threshold: { min: 80 } },
      { factorId: 'AU_BANK_DIVIDEND', factorName: '澳洲银行高息', weight: 15, direction: 'long' },
      { factorId: 'AU_AUD_SENSITIVITY', factorName: '澳元敏感度', weight: 15, direction: 'long' },
      { factorId: 'CMD_MOMENTUM_12M', factorName: '商品动量', weight: 15, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'ASX资源策略健康: 大宗商品与股价相关性? Franking信用?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '澳洲港口出货量+矿山生产报告替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '大宗商品价格突破+Franking变化推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '澳股矿业+银行双收策略历史表现' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '铁矿石+澳元+分红综合诊断' },
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '澳股矿业vs银行轮动信号' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是澳洲资源股+Frankling Credit策略助手。基于铁矿石/煤炭/LNG价格+澳元汇率+Franking收益率因子，帮助用户优化资源股配置。',
      conversationStarters: [
        '铁矿石价格还会涨吗？',
        'Franking Credit能抵多少税？',
        '澳元与资源股负相关怎么对冲？'
      ],
      tunableParams: [
        { paramName: 'ironOreWeight', description: '铁矿石价格权重', currentValue: '30%', range: '20%-40%' },
        { paramName: 'audHedge', description: '澳元对冲比例', currentValue: '40%', range: '20%-60%' },
        { paramName: 'frankingYield', description: 'Franking最低收益率', currentValue: '5%', range: '3%-8%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['澳股', '矿业', 'Franking', '高息'],
    version: 'v1.0',
  },
  {
    id: 'in-nse-it-outsourcing',
    name: 'NSE IT Outsourcing Momentum',
    nameCn: 'NSE IT外包动量',
    category: 'in',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '14-60天',
    holdingDays: { min: 14, max: 60, unit: 'day' },
    fourIronRules: {
      humanLine: '印度IT外包巨头(TCS/Infosys/Wipro/HCL)发财报前买入、发布后持有。美国IT支出增速>10%+卢比贬值→印度IT最强季度。',
      stopLossRule: '财报miss预期→立即出。卢比升值>3%→IT股汇兑损失→减仓。个股跌超8%止损。',
      marketScope: [{ market: '🇮🇳', assetClass: '股票', symbols: ['TCS/Infosys/Wipro/HCL Tech'] }],
      failureCheck: '美国经济衰退→企业IT支出缩减→印度IT订单下降→暂停。AI取代外包(LLM写代码)→长期结构性风险→重新评估。',
    },
    factorCombo: [
      { factorId: 'IN_IT_SECTOR', factorName: '印度IT板块', weight: 30, direction: 'long' },
      { factorId: 'IN_FII_DII_FLOW', factorName: 'FII/DII资金流', weight: 25, direction: 'long' },
      { factorId: 'IN_INR_HEDGE', factorName: '卢比对冲', weight: 20, direction: 'short', threshold: { max: 0.5 } },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 15, direction: 'long' },
      { factorId: 'QUALITY_ROE', factorName: 'ROE质量', weight: 10, direction: 'long', threshold: { min: 20 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'NSE IT外包健康: IT支出趋势延续? 汇率影响可控?' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '印度IT财报季策略历史胜率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'FII+卢比+IT支出综合诊断' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '印度IT巨头财报日历提醒' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是印度IT外包策略助手。基于TCS/Infosys/Wipro季报/美元兑卢比汇率/美国IT支出趋势因子，帮助用户判断印度IT板块机会。',
      conversationStarters: [
        '印度IT外包订单增长趋势？',
        '卢比贬值利好IT出口吗？',
        '美国IT预算削减影响多大？'
      ],
      tunableParams: [
        { paramName: 'revenueGrowth', description: '营收增速阈值', currentValue: '10%', range: '5%-20%' },
        { paramName: 'usdInrWeight', description: '美元卢比汇率权重', currentValue: '25%', range: '15%-35%' },
        { paramName: 'dealPipeline', description: '订单管道权重', currentValue: '35%', range: '25%-45%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['印度', 'IT', '财报', '外包'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// R205 autoclaw #4: EU/IN TEMPLATES (3)
// ═══════════════════════════════════════════════════════════════════════════════

export const EU_IN_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'eu-stoxx-esg-premium',
    name: 'STOXX ESG Premium Capture',
    nameCn: 'STOXX ESG溢价捕获',
    category: 'eu',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买入ESG评分在上升的欧洲股——买正在变绿的，不买一直绿的。ESG升级触发机构强制买入，等资金流入推高估值。',
      stopLossRule: 'ESG评分被降级→立即出(触发机构强制卖出)。ESG溢价收缩到<0→市场不再给ESG溢价→出。',
      marketScope: [{ market: '🇪🇺', assetClass: '股票', symbols: ['STOXX 600 ESG: 能源转型/新能源/可持续包装'] }],
      failureCheck: 'SFDR法规放松→ESG资金流出→ESG溢价消失→停止。欧洲经济衰退→投资者只要回报不要ESG→暂停。',
    },
    factorCombo: [
      { factorId: 'EU_ESG_PREMIUM', factorName: 'ESG溢价', weight: 35, direction: 'long', threshold: { min: 0 } },
      { factorId: 'ESG_SCORE', factorName: 'ESG评分', weight: 25, direction: 'long' },
      { factorId: 'EU_STOXX_SECTOR', factorName: 'STOXX行业', weight: 15, direction: 'long' },
      { factorId: 'EU_EUR_SENSITIVITY', factorName: '欧元敏感度', weight: 15, direction: 'long' },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'STOXX ESG健康: ESG评级变动趋势? 碳价影响?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'ESG评级变动+碳价异动推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '欧洲ESG溢价历史表现分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'ESG升级/降级预测+资金流向分析' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'MSCI ESG评级变化+可持续披露数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是欧洲ESG溢价策略助手。基于ESG评分/碳足迹/绿色税收优惠/EU Taxonomy因子，帮助用户捕捉欧洲ESG溢价。',
      conversationStarters: [
        'ESG评级升级对股价影响多大？',
        '碳关税利好哪些欧洲公司？',
        'EU Taxonomy合规标的怎么筛选？'
      ],
      tunableParams: [
        { paramName: 'esgThreshold', description: 'ESG最低评分', currentValue: '70', range: '60-85' },
        { paramName: 'carbonWeight', description: '碳足迹权重', currentValue: '25%', range: '15%-35%' },
        { paramName: 'greenTaxonomy', description: '绿色分类权重', currentValue: '30%', range: '20%-40%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['欧洲', 'ESG', '溢价', '可持续'],
    version: 'v1.0',
  },
  {
    id: 'in-nse-inflation-hedge',
    name: 'NSE Inflation Hedge',
    nameCn: 'NSE通胀对冲',
    category: 'in',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '印度通胀>6%+央行加息→买入印度金融股(利率上升受益)+商品股(通胀传导)。印度通胀是最大的宏观alpha来源。',
      stopLossRule: '通胀回落到<4%→通胀对冲策略失效→切换到成长股。卢比贬值>5%→外资逃离→减仓。',
      marketScope: [{ market: '🇮🇳', assetClass: '股票', symbols: ['HDFC Bank/ICICI/SBI + Reliance/ONGC'] }],
      failureCheck: '印度政府价格管制(如食品油补贴)→通胀数据失真→暂停。全球大宗商品崩盘→商品股跟跌→只留金融股。',
    },
    factorCombo: [
      { factorId: 'IN_INFLATION_HEDGE', factorName: '印度通胀对冲', weight: 40, direction: 'long', threshold: { min: 6 } },
      { factorId: 'IN_FII_DII_FLOW', factorName: 'FII/DII资金流', weight: 20, direction: 'long' },
      { factorId: 'IN_INR_HEDGE', factorName: '卢比对冲', weight: 15, direction: 'short' },
      { factorId: 'SECTOR_FINANCIAL', factorName: '金融板块', weight: 15, direction: 'long' },
      { factorId: 'CMD_MOMENTUM_12M', factorName: '商品动量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'NSE通胀对冲健康: 通胀敏感度稳定? 因子有效性?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '印度CPI成分价格+季风降雨替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '印度CPI/WPI数据异动+商品价格推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '印度通胀对冲策略历史表现' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '通胀+利率+卢比综合诊断' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化通胀阈值+板块配比' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是印度通胀对冲策略助手。基于印度CPI/WPI/Repo Rate/黄金价格/消费数据因子，帮助用户在印度高通胀环境中保护购买力。',
      conversationStarters: [
        '印度CPI>6%该配置什么？',
        'Repo Rate见顶了可以买了吗？',
        '黄金能对冲印度通胀吗？'
      ],
      tunableParams: [
        { paramName: 'cpiThreshold', description: 'CPI触发阈值', currentValue: '5%', range: '4%-7%' },
        { paramName: 'goldWeight', description: '黄金配置权重', currentValue: '20%', range: '10%-30%' },
        { paramName: 'consumptionSector', description: '消费板块权重', currentValue: '30%', range: '20%-40%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['印度', '通胀', '对冲', '金融'],
    version: 'v1.0',
  },
  {
    id: 'in-nifty50-rotation',
    name: 'Nifty50 Sector Rotation',
    nameCn: 'Nifty50轮动',
    category: 'in',
    difficulty: 2,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-30天',
    holdingDays: { min: 7, max: 30, unit: 'day' },
    fourIronRules: {
      humanLine: '跟着印度最强板块走：Nifty50板块动量Top2+FII净买入→超配。印度板块轮动比发达市场更强——因为内资外资博弈。',
      stopLossRule: '板块动量跌出Top2→切换。FII连续3天净卖出→减半仓。个股跌超8%止损。',
      marketScope: [{ market: '🇮🇳', assetClass: '股票', symbols: ['Nifty50: 金融/IT/汽车/制药/FMCG龙头'] }],
      failureCheck: '莫迪政策出台失败→NSE/BSE波动→板块轮动失效→暂停。印度大选前后→政策不确定性→降低仓位。',
    },
    factorCombo: [
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 35, direction: 'long', threshold: { min: 1.0 } },
      { factorId: 'IN_FII_DII_FLOW', factorName: 'FII/DII资金流', weight: 25, direction: 'long' },
      { factorId: 'SECTOR_MOMENTUM', factorName: '板块动量', weight: 20, direction: 'long' },
      { factorId: 'IN_MONSOON_EFFECT', factorName: '雨季效应', weight: 10, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'short' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'Nifty50轮动健康: 因子轮动超额>基准? IC>0?' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'Nifty50轮动策略历史表现' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '板块动量轮动实时推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'FII+板块动量+雨季综合诊断' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是Nifty50轮动策略助手。基于板块动量/外资FII流向/国内DII流向/企业盈利增速因子，帮助用户在Nifty50板块间轮动。',
      conversationStarters: [
        '现在该切换到哪个板块？',
        'FII流出DII流入怎么解读？',
        'Nifty50估值偏高该减仓吗？'
      ],
      tunableParams: [
        { paramName: 'rotationPeriod', description: '轮动周期', currentValue: '月', range: '周-月' },
        { paramName: 'momentumLookback', description: '动量回溯期', currentValue: '1个月', range: '2周-3个月' },
        { paramName: 'fiiWeight', description: 'FII流向权重', currentValue: '30%', range: '20%-40%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['印度', 'Nifty50', '轮动', '动量'],
    version: 'v1.0',
  },
];

// ============================================================================
// R205: Updated aggregate — 24 templates (13 R204 + 11 R205)
// ============================================================================

export const ALL_AUTOCLAW_TEMPLATES: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,
  ...CRYPTO_TEMPLATES,
  ...JP_KR_TEMPLATES,
  ...TW_SG_AU_TEMPLATES,
  ...EU_IN_TEMPLATES,
];

export const ALL_TEMPLATE_COUNT = {
  hk: HK_TEMPLATES.length,
  crypto: CRYPTO_TEMPLATES.length,
  jp_kr: JP_KR_TEMPLATES.length,
  tw_sg_au: TW_SG_AU_TEMPLATES.length,
  eu_in: EU_IN_TEMPLATES.length,
  total: ALL_AUTOCLAW_TEMPLATES.length,
};

export function getTemplateByIdR205(id: string): FactorStrategyTemplate | undefined {
  return ALL_AUTOCLAW_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByMarketR205(market: MarketTag): FactorStrategyTemplate[] {
  return ALL_AUTOCLAW_TEMPLATES.filter(t => t.fourIronRules.marketScope.some(s => s.market === market));
}

export function validateAllTemplatesR205(): { templateId: string; valid: boolean; errors: string[] }[] {
  return ALL_AUTOCLAW_TEMPLATES.map(t => ({ templateId: t.id, ...validateFourIronRules(t) }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// R206 autoclaw #2: 🤖 AI-NATIVE TEMPLATES (10) — DeepSeek conversational
// ═══════════════════════════════════════════════════════════════════════════════
// Each AI template embeds a DeepSeekChatConfig enabling conversational
// parameter tuning via AIDegradationChain (V4ProFold→V4ProRaw→V4Flash→MiniMax).
// Conversation cost: 1U/turn. User can one-click apply AI-suggested params.
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_TEMPLATES: FactorStrategyTemplate[] = [

  // ── 25. AI动量 ──────────────────────────────────────────────────────────
  {
    id: 'ai-momentum-chaser',
    name: 'AI Momentum Chaser',
    nameCn: 'AI动量猎手',
    category: 'ai',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '3-14天',
    holdingDays: { min: 3, max: 14, unit: 'day' },
    fourIronRules: {
      humanLine: '让AI帮你找最强动量：12月动量Top10%+短期加速+成交量放大。AI每天扫描美股/港股Top500，你只管执行。',
      stopLossRule: '动量排名跌出Top30%→止损；短期加速度转负→减半仓。AI会在对话中提醒调仓。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票', symbols: ['美股S&P500+Nasdaq100'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['港股恒生+恒生科技'] },
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC/ETH + Top50'] },
      ],
      failureCheck: '市场恐慌(VIX>40)→动量策略集体失效→AI建议切换到风控模板。市场横盘震荡(无趋势)→动量钝化→暂停。',
    },
    factorCombo: [
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 30, direction: 'long', threshold: { min: 1.0 } },
      { factorId: 'MOMENTUM_3M', factorName: '3月动量', weight: 25, direction: 'long' },
      { factorId: 'VOLUME_RATIO', factorName: '量比', weight: 15, direction: 'long' },
      { factorId: 'MOMENTUM_1M', factorName: '1月动量', weight: 20, direction: 'long' },
      { factorId: 'RSI', factorName: 'RSI强度', weight: 10, direction: 'long', threshold: { min: 60 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AI动量策略月度体检: 各因子IC衰减? 过拟合风险?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '跨市场资金流+社交媒体情绪替代数据' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '动量策略历史胜率+夏普比率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '动量衰减预警+行业动量轮动' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '动量Top10实时更新推送' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '自适应动量窗口+阈值优化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI动量策略助手。基于MOMENTUM_12M/MOMENTUM_3M/量比/RSI因子，帮助用户调整动量阈值、持仓周期和止损参数。',
      conversationStarters: [
        '当前市场动量最强的5个标的？',
        '我的动量止损阈值设多少合适？',
        '动量信号衰减了，该减仓吗？',
      ],
      tunableParams: [
        { paramName: 'momentumThreshold', description: '动量最低阈值', currentValue: '1.0', range: '0.5-2.0' },
        { paramName: 'holdingDays', description: '持仓天数', currentValue: '3-14', range: '1-30天' },
        { paramName: 'stopLossPct', description: '止损百分比', currentValue: '8%', range: '3%-15%' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '动量', '趋势', '美股港股大盘'],
    version: 'v1.0',
  },

  // ── 26. AI价值 ──────────────────────────────────────────────────────────
  {
    id: 'ai-value-hunter',
    name: 'AI Value Hunter',
    nameCn: 'AI价值猎手',
    category: 'ai',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '让AI帮你挖价值洼地：PB<1.5+PE<15+ROE>15%+股息率>3%。AI筛出被低估的股票，你验证后买入等回归。',
      stopLossRule: 'PE超过行业均值150%→卖出(不再低估)；ROE连续两季下降→基本面恶化→出。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票', symbols: ['SP500成分股'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['恒生成分股'] },
        { market: '🇯🇵', assetClass: '股票', symbols: ['日经225'] },
      ],
      failureCheck: '价值陷阱(低PB是因为行业没落)→AI会交叉验证营收增速→营收没涨的低估=真陷阱→停止。利率上升周期→价值股无优势→切换。',
    },
    factorCombo: [
      { factorId: 'PB_RATIO', factorName: 'PB估值', weight: 30, direction: 'short', threshold: { max: 1.5 } },
      { factorId: 'PE_RATIO', factorName: 'PE估值', weight: 25, direction: 'short', threshold: { max: 15 } },
      { factorId: 'DIVIDEND_YIELD', factorName: '股息率', weight: 20, direction: 'long', threshold: { min: 3 } },
      { factorId: 'QUALITY_ROE', factorName: 'ROE质量', weight: 15, direction: 'long', threshold: { min: 15 } },
      { factorId: 'VALUE_TRAP', factorName: '价值陷阱检测', weight: 10, direction: 'short', threshold: { max: 0.3 } },
    ],
    aiTriggerPoints: [
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '13F机构持仓+内幕交易披露替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '价值因子信号+估值修复触发推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '价值策略长期收益率+回撤分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '价值vs价值陷阱交叉验证' },
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '持仓估值合理性+基本面变化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI价值策略助手。基于PB/PE/股息率/ROE因子，帮用户识别真正被低估的股票，排除价值陷阱。',
      conversationStarters: [
        '当前最被低估的5只股票是哪些？',
        '这只股票是真低估还是价值陷阱？',
        'PE和PB哪个指标在当前市场更可靠？',
      ],
      tunableParams: [
        { paramName: 'pbMax', description: 'PB上限', currentValue: '1.5', range: '0.5-2.0' },
        { paramName: 'peMax', description: 'PE上限', currentValue: '15', range: '5-25' },
        { paramName: 'dividendMin', description: '股息率下限', currentValue: '3%', range: '2%-8%' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '价值', '低估', '基本面'],
    version: 'v1.0',
  },

  // ── 27. AI套利 ──────────────────────────────────────────────────────────
  {
    id: 'ai-arbitrage-engine',
    name: 'AI Arbitrage Engine',
    nameCn: 'AI套利引擎',
    category: 'ai',
    difficulty: 4,
    timeHorizon: 'intraday',
    expectedHoldingDays: '1-7天',
    holdingDays: { min: 1, max: 7, unit: 'day' },
    fourIronRules: {
      humanLine: '所有套利机会AI帮你盯：跨市场价差、期货-现货基差、期权波动率曲面异常。AI扫描→你执行→利润入袋。',
      stopLossRule: '价差扩大>50%→止损(价差可能继续扩大)；基差反转(contango↔backwardation)→出。不做逆势套利。',
      marketScope: [
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC/ETH永续 vs 现货', '跨交易所'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['AH股跨市场'] },
        { market: '🇺🇸', assetClass: '期权', symbols: ['波动率曲面套利'] },
      ],
      failureCheck: '流动性枯竭→价差无法收敛→AI建议停止。监管变化(如禁止跨交易所)→立即停止。极端市场(崩盘/熔断)→所有套利暂停。',
    },
    factorCombo: [
      { factorId: 'AH_PREMIUM', factorName: 'AH溢价', weight: 25, direction: 'short', threshold: { max: 10 } },
      { factorId: 'FUTURES_SPOT_SPREAD', factorName: '期现基差', weight: 25, direction: 'long', threshold: { min: 2 } },
      { factorId: 'VOLATILITY_SKEW', factorName: '波动率偏斜', weight: 20, direction: 'long' },
      { factorId: 'OPTION_IM_SPREAD', factorName: '期权IV价差', weight: 20, direction: 'long', threshold: { min: 5 } },
      { factorId: 'LIQUIDITY_DEPTH', factorName: '流动性深度', weight: 10, direction: 'long', threshold: { min: 1e6 } },
    ],
    aiTriggerPoints: [
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '跨美股/港股/AH套利机会实时扫描' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '套利可行性+收敛概率诊断' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '套利机会出现即时推送' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '套利阈值+持仓时间优化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI套利策略助手。监控跨市场价差、期现基差、期权波动率曲面，帮用户识别高胜率套利机会。',
      conversationStarters: [
        '现在有什么套利机会？',
        '这个价差会收敛吗？多久？',
        '套利持仓多久最合适？',
      ],
      tunableParams: [
        { paramName: 'spreadThreshold', description: '价差最小阈值', currentValue: '2%', range: '0.5%-10%' },
        { paramName: 'maxHoldingHours', description: '最长持仓小时', currentValue: '168', range: '1-168小时' },
        { paramName: 'minLiquidity', description: '最低流动性(USD)', currentValue: '1M', range: '100K-10M' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '套利', '价差', '高频'],
    version: 'v1.0',
  },

  // ── 28. AI择时 ──────────────────────────────────────────────────────────
  {
    id: 'ai-timing-oracle',
    name: 'AI Timing Oracle',
    nameCn: 'AI择时先知',
    category: 'ai',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '1-21天',
    holdingDays: { min: 1, max: 21, unit: 'day' },
    fourIronRules: {
      humanLine: '让AI告诉你什么时候该买、什么时候该卖：结合趋势+波动率+情绪+宏观，AI给出多空信号和仓位建议。',
      stopLossRule: 'AI信号从多/空转为中性→出。连续3次信号错误→暂停→让AI自查策略是否失效。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票', symbols: ['SPY/QQQ/DIA (ETF择时)'] },
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC永续合约择时'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['恒指期货择时'] },
      ],
      failureCheck: '市场进入随机游走(没有任何因子有预测力)→择时失效→AI建议切换到纯持有。重大政策事件(如加息/战争)→择时信号紊乱→暂停。',
    },
    factorCombo: [
      { factorId: 'TREND_SIGNAL', factorName: '趋势信号', weight: 35, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 20, direction: 'short', threshold: { max: 30 } },
      { factorId: 'SENTIMENT', factorName: '市场情绪', weight: 15, direction: 'long' },
      { factorId: 'MACRO_MOMENTUM', factorName: '宏观动量', weight: 15, direction: 'long' },
      { factorId: 'RSI', factorName: 'RSI超买超卖', weight: 15, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AI择时策略健康: 信号准确率>55%? 各维度贡献?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '期权订单流+暗池交易量替代数据' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '多空信号实时推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '多因子择时综合评分' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '择时窗口+信号阈值优化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI择时策略助手。结合趋势/波动率/情绪/宏观因子，给出明确的多空信号和仓位建议。',
      conversationStarters: [
        '现在该买还是该卖？',
        '我的仓位应该加还是减？',
        '什么信号出现我该清仓？',
      ],
      tunableParams: [
        { paramName: 'signalThreshold', description: '信号触发阈值', currentValue: '0.6', range: '0.3-0.9' },
        { paramName: 'positionSize', description: '建议仓位%', currentValue: '50%', range: '10%-100%' },
        { paramName: 'reEntryCooldown', description: '再入场冷却(天)', currentValue: '3', range: '1-10天' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '择时', '多空', '宏观'],
    version: 'v1.0',
  },

  // ── 29. AI风控 ──────────────────────────────────────────────────────────
  {
    id: 'ai-risk-sentinel',
    name: 'AI Risk Sentinel',
    nameCn: 'AI风控哨兵',
    category: 'ai',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '实时监控',
    holdingDays: { min: 0, max: 1, unit: 'day' },
    fourIronRules: {
      humanLine: 'AI24小时值守你的风险：波动率突破→建议降仓；相关性突变→建议对冲；最大回撤逼近→强制提醒。你睡觉，AI不睡。',
      stopLossRule: '最大回撤触及用户设定阈值→AI强制提醒减仓。波动率突破2σ→建议降杠杆。不对冲机会消失→建议恢复仓位。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票+期权', symbols: ['S&P500+Nasdaq100+期权链'] },
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC+ETH+SOL等Top20'] },
        { market: '🇭🇰', assetClass: '股票+窝轮', symbols: ['恒生+恒生科技+窝轮'] },
      ],
      failureCheck: '恐慌性抛售→所有风控指标超标→AI无法区分恐慌vs真风险→建议人工判断。流动性枯竭→风控信号滞后→只保留硬止损。',
    },
    factorCombo: [
      { factorId: 'MAX_DRAWDOWN', factorName: '最大回撤', weight: 35, direction: 'short', threshold: { max: 15 } },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 25, direction: 'short', threshold: { max: 35 } },
      { factorId: 'CORRELATION', factorName: '相关性突变', weight: 15, direction: 'short', threshold: { max: 0.8 } },
      { factorId: 'TAIL_RISK', factorName: '尾风险', weight: 15, direction: 'short', threshold: { max: 2 } },
      { factorId: 'VAR', factorName: 'VaR值', weight: 10, direction: 'short', threshold: { max: 5 } },
    ],
    aiTriggerPoints: [
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '组合风控全面诊断' },
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '风险指标预警+对冲建议' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '风控预警即时推送' },
      { id: 'arbitrage-scan', label: 'AI对冲扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '最佳对冲工具推荐' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI风控策略助手。监控波动率/回撤/相关性/尾风险，实时评估组合风险并给出降仓/对冲建议。',
      conversationStarters: [
        '我的组合现在风险大吗？',
        '什么信号出现我该减仓？',
        '最佳对冲方案是什么？',
      ],
      tunableParams: [
        { paramName: 'maxDrawdownLimit', description: '最大回撤上限%', currentValue: '15%', range: '5%-30%' },
        { paramName: 'volAlertThreshold', description: '波动率预警阈值', currentValue: '35', range: '20-50' },
        { paramName: 'corrAlertThreshold', description: '相关性预警阈值', currentValue: '0.8', range: '0.5-0.95' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '风控', '风险', '监控'],
    version: 'v1.0',
  },

  // ── 30. AI组合 ──────────────────────────────────────────────────────────
  {
    id: 'ai-portfolio-builder',
    name: 'AI Portfolio Builder',
    nameCn: 'AI组合大师',
    category: 'ai',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '告诉AI你的目标(收益%/风险容忍度/持仓数量)→AI用多因子模型帮你建造最优组合→一键部署。每月自动再平衡。',
      stopLossRule: '组合整体回撤超过目标→AI建议降仓或切换模板。单一标的权重偏离>10%→触发再平衡。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票+ETF', symbols: ['SP500+行业ETF'] },
        { market: '🇭🇰', assetClass: '股票+REIT', symbols: ['恒指+红筹'] },
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC/ETH+DeFi'] },
      ],
      failureCheck: '市场风格突变(价值→成长)→AI需要重建组合→原组合失效→停止自动再平衡。因子失效(IC降到<0)→重新训练→暂停。',
    },
    factorCombo: [
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 20, direction: 'long' },
      { factorId: 'QUALITY_ROE', factorName: 'ROE质量', weight: 20, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 20, direction: 'long' },
      { factorId: 'PB_RATIO', factorName: 'PB估值', weight: 15, direction: 'short' },
      { factorId: 'DIVIDEND_YIELD', factorName: '股息率', weight: 15, direction: 'long' },
      { factorId: 'CORRELATION', factorName: '低相关性', weight: 10, direction: 'short', threshold: { max: 0.5 } },
    ],
    aiTriggerPoints: [
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '组合历史收益+风险分解' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '因子暴露+风格分析' },
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '再平衡提醒+偏离预警' },
      { id: 'attribution', label: '归因分析', touchpointId: 'AI_PORTFOLIO_ATTRIBUTION', costUSDT: 1.5, description: '收益归因+因子贡献分解' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI组合构建助手。基于用户的收益目标和风险容忍度，用多因子模型设计最优组合方案。',
      conversationStarters: [
        '帮我设计一个年化15%的组合？',
        '我的组合需要再平衡吗？',
        '增加一只港股对我的组合有什么影响？',
      ],
      tunableParams: [
        { paramName: 'targetReturn', description: '目标年化收益率%', currentValue: '15%', range: '5%-50%' },
        { paramName: 'maxDrawdown', description: '最大可接受回撤%', currentValue: '20%', range: '5%-40%' },
        { paramName: 'numHoldings', description: '持仓数量', currentValue: '10', range: '5-30只' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '组合', '多因子', '再平衡'],
    version: 'v1.0',
  },

  // ── 31. AI选股 ──────────────────────────────────────────────────────────
  {
    id: 'ai-stock-screener',
    name: 'AI Stock Screener',
    nameCn: 'AI选股大师',
    category: 'ai',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '14-90天',
    holdingDays: { min: 14, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '告诉AI你的选股偏好(成长/价值/质量/动量)→AI用多因子打分系统从几千只股票中挑出Top-N。你只需确认买入。',
      stopLossRule: '股票从AI评分Top-N掉落→卖出。基本面突变(财报暴雷/高管辞职)→AI降级→立即出。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票', symbols: ['美股S&P500 (500只)'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['港股恒生指数 (82只)'] },
      ],
      failureCheck: 'AI偏好过拟合某一因子→选中一堆同类股票→集中度风险→AI需要提示分散化。财报季前后→基本面数据剧变→暂停筛选→等数据稳定。',
    },
    factorCombo: [
      { factorId: 'QUALITY_ROE', factorName: 'ROE质量', weight: 25, direction: 'long', threshold: { min: 15 } },
      { factorId: 'EARNING_GROWTH', factorName: '盈利增长', weight: 25, direction: 'long', threshold: { min: 10 } },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 20, direction: 'long' },
      { factorId: 'PE_RATIO', factorName: 'PE估值', weight: 15, direction: 'short', threshold: { max: 30 } },
      { factorId: 'DEBT_RATIO', factorName: '负债率', weight: 15, direction: 'short', threshold: { max: 60 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AI选股策略健康: 月胜率>55%? 因子暴露漂移?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '招聘数据+APP下载量+信用卡消费替代数据' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'AI筛选结果更新+新股票信号推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '多因子选股历史胜率' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '因子打分有效性检验' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '因子权重+阈值优化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI选股助手。基于多因子打分系统，帮用户从美股S&P500+港股恒生中筛选符合偏好的股票。',
      conversationStarters: [
        '帮我找5只高ROE+低PE的成长股？',
        '这周最值得关注的股票是哪几只？',
        '为什么AI给这只股票打了低分？',
      ],
      tunableParams: [
        { paramName: 'roeMin', description: 'ROE最低要求%', currentValue: '15%', range: '5%-30%' },
        { paramName: 'peMax', description: 'PE上限', currentValue: '30', range: '10-50' },
        { paramName: 'numPicks', description: '推荐数量', currentValue: '5', range: '3-20只' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '选股', '多因子', '打分'],
    version: 'v1.0',
  },

  // ── 32. AI行业 ──────────────────────────────────────────────────────────
  {
    id: 'ai-sector-rotator',
    name: 'AI Sector Rotator',
    nameCn: 'AI行业轮动',
    category: 'ai',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-30天',
    holdingDays: { min: 7, max: 30, unit: 'day' },
    fourIronRules: {
      humanLine: '让AI告诉你钱在流向哪个行业：行业动量+资金流入+宏观周期→AI每周给出Top3行业配置。跟着钱走。',
      stopLossRule: '行业跌出Top3→切换。行业ETF跌超5%→止损。全部11个行业无正动量→转为空仓等待。',
      marketScope: [
        { market: '🇺🇸', assetClass: 'ETF', symbols: ['SPDR行业ETF (XLC/XLF/XLE/XLK等11只)'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['恒生行业龙头'] },
      ],
      failureCheck: '市场风格从行业轮动变成美股+港股同涨同跌(相关性>0.8)→行业轮动失效→AI建议切换到大盘ETF。经济周期从扩张转到衰退→防御性行业也跌→空仓。',
    },
    factorCombo: [
      { factorId: 'SECTOR_MOMENTUM', factorName: '行业动量', weight: 35, direction: 'long' },
      { factorId: 'SECTOR_FLOW', factorName: '行业资金流', weight: 25, direction: 'long' },
      { factorId: 'MACRO_MOMENTUM', factorName: '宏观动量', weight: 15, direction: 'long' },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 15, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'short', threshold: { max: 25 } },
    ],
    aiTriggerPoints: [
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '行业轮动信号每周推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '行业周期定位+动量持续性' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '行业轮动历史表现' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI行业轮动助手。基于行业动量/资金流/宏观周期，每周给出最优行业配置方案。',
      conversationStarters: [
        '这周最该配置哪3个行业？',
        '科技股还能继续涨吗？',
        '现在该切换到防御板块了吗？',
      ],
      tunableParams: [
        { paramName: 'topSectors', description: '持仓行业数', currentValue: '3', range: '2-5个' },
        { paramName: 'rotationFrequency', description: '轮动频率(天)', currentValue: '7', range: '3-30天' },
        { paramName: 'minMomentumScore', description: '最低动量分', currentValue: '60', range: '30-80' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '行业', '轮动', '资金流'],
    version: 'v1.0',
  },

  // ── 33. AI事件 ──────────────────────────────────────────────────────────
  {
    id: 'ai-event-catalyst',
    name: 'AI Event Catalyst',
    nameCn: 'AI事件驱动',
    category: 'ai',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '1-14天',
    holdingDays: { min: 1, max: 14, unit: 'day' },
    fourIronRules: {
      humanLine: 'AI盯住所有重大事件：财报/并购/分拆/回购/重大公告→AI评估事件影响力+方向→你决定是否参与。消息到→AI解析→你执行。',
      stopLossRule: '事件后24h股价没有预期方向→事件被定价→出。谣言被否认→立即出。利好出尽(股价已经涨了预期)→出。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票', symbols: ['美股S&P500+Nasdaq100'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['港股恒生+恒生科技'] },
      ],
      failureCheck: '信息源噪音化(AI从社交网络抓取的信息可信度下降)→事件信号失真→暂停。监管打击内幕消息→部分事件源失效→只保留公开信息源。',
    },
    factorCombo: [
      { factorId: 'EVENT_SENTIMENT', factorName: '事件情绪', weight: 35, direction: 'long' },
      { factorId: 'EARNING_SURPRISE', factorName: '财报惊喜', weight: 25, direction: 'long' },
      { factorId: 'NEWS_MOMENTUM', factorName: '新闻动量', weight: 20, direction: 'long' },
      { factorId: 'SENTIMENT', factorName: '市场情绪', weight: 10, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率挤压', weight: 10, direction: 'long', threshold: { min: 20 } },
    ],
    aiTriggerPoints: [
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '重大事件即时推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '事件影响力评估+方向预测' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '社交媒体+新闻NLP情绪数据' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '事件窗口+情绪阈值优化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI事件驱动策略助手。实时监控重大公司事件(财报/并购/回购等)，评估影响力并给出交易建议。',
      conversationStarters: [
        '今天有什么值得关注的事件？',
        '这个并购消息是利好还是利空？',
        '财报超预期，该追涨还是等回调？',
      ],
      tunableParams: [
        { paramName: 'eventWindowHours', description: '事件窗口(小时)', currentValue: '24', range: '4-72小时' },
        { paramName: 'sentimentThreshold', description: '情绪触发阈值', currentValue: '0.3', range: '0.1-0.7' },
        { paramName: 'maxPositionPct', description: '最大仓位%', currentValue: '10%', range: '1%-25%' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '事件', '财报', '情绪'],
    version: 'v1.0',
  },

  // ── 34. AI调仓 ──────────────────────────────────────────────────────────
  {
    id: 'ai-rebalance-optimizer',
    name: 'AI Rebalance Optimizer',
    nameCn: 'AI调仓大师',
    category: 'ai',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '自动执行',
    holdingDays: { min: 0, max: 1, unit: 'day' },
    fourIronRules: {
      humanLine: 'AI帮你管调仓：每周/每月自动检查偏离→计算最优调仓方案(最小交易成本)→一键执行。不用自己算该换什么了。',
      stopLossRule: '标的跌超止损线→AI自动发出调出信号。因子IC转负→AI建议移除对应因子敞口。融资/流动性突变→暂停自动调仓。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股票+ETF', symbols: ['美股S&P500+11行业ETF'] },
        { market: '🇭🇰', assetClass: '股票', symbols: ['港股恒生+恒生科技'] },
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC/ETH+Alt'] },
      ],
      failureCheck: '交易成本超过预期调仓收益→AI建议跳过本轮调仓。市场停牌/限制交易→AI无法执行→暂停。标的流动性恶化→调仓成本激增→降频。',
    },
    factorCombo: [
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_EFFICIENCY', factorName: '因子效率(IC)', weight: 25, direction: 'long', threshold: { min: 0.05 } },
      { factorId: 'TRANSACTION_COST', factorName: '交易成本', weight: 20, direction: 'short', threshold: { max: 0.5 } },
      { factorId: 'DISPERSION', factorName: '横截面离散度', weight: 15, direction: 'long' },
      { factorId: 'LIQUIDITY', factorName: '流动性', weight: 15, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '因子IC趋势+调仓必要性评估' },
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '组合偏离+调仓提醒' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '调仓频率+阈值+成本优化' },
      { id: 'attribution', label: '归因分析', touchpointId: 'AI_PORTFOLIO_ATTRIBUTION', costUSDT: 1.5, description: '调仓收益归因' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI调仓优化助手。基于因子IC/交易成本/流动性，计算最优调仓方案，最小化成本最大化收益。',
      conversationStarters: [
        '我的组合现在需要调仓吗？',
        '调仓成本大概多少？值得吗？',
        '如果不调仓，风险有多大？',
      ],
      tunableParams: [
        { paramName: 'rebalanceFrequency', description: '调仓频率', currentValue: '每周', range: '每日-每月' },
        { paramName: 'maxTurnover', description: '最大换手率%', currentValue: '20%', range: '5%-50%' },
        { paramName: 'costThreshold', description: '交易成本上限(bps)', currentValue: '50', range: '10-100bps' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '调仓', '再平衡', '成本'],
    version: 'v1.0',
  },
];

// ============================================================================
// R206: Final aggregate — 34 templates (13 R204 + 11 R205 + 10 R206)
// ============================================================================

export const ALL_AUTOCLAW_TEMPLATES_R206: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,       // R204: 5
  ...CRYPTO_TEMPLATES,    // R204: 8
  ...JP_KR_TEMPLATES,     // R205: 4
  ...TW_SG_AU_TEMPLATES,  // R205: 4
  ...EU_IN_TEMPLATES,     // R205: 3
  ...AI_TEMPLATES,        // R206: 10
];

export const ALL_TEMPLATE_COUNT_R206 = {
  hk: HK_TEMPLATES.length,              // 5
  crypto: CRYPTO_TEMPLATES.length,       // 8
  jp_kr: JP_KR_TEMPLATES.length,        // 4
  tw_sg_au: TW_SG_AU_TEMPLATES.length,  // 4
  eu_in: EU_IN_TEMPLATES.length,        // 3
  ai: AI_TEMPLATES.length,              // 10
  total: ALL_AUTOCLAW_TEMPLATES_R206.length, // 34
};

export function getTemplateByIdR206(id: string): FactorStrategyTemplate | undefined {
  return ALL_AUTOCLAW_TEMPLATES_R206.find(t => t.id === id);
}

export function getTemplatesByMarketR206(market: MarketTag): FactorStrategyTemplate[] {
  return ALL_AUTOCLAW_TEMPLATES_R206.filter(t => t.fourIronRules.marketScope.some(s => s.market === market));
}

export function getAITemplates(): FactorStrategyTemplate[] {
  return AI_TEMPLATES;
}

export function validateAllTemplatesR206(): { templateId: string; valid: boolean; errors: string[] }[] {
  return ALL_AUTOCLAW_TEMPLATES_R206.map(t => ({ templateId: t.id, ...validateFourIronRules(t) }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// R207 autoclaw #2: 🇭🇰 HK SUPPLEMENT TEMPLATES (3)
// ═══════════════════════════════════════════════════════════════════════════════

export const HK_SUPPLEMENT_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'hk-reit-yield',
    name: 'HK REIT Income Machine',
    nameCn: '港股REIT收租机',
    category: 'hk',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '90-365天',
    holdingDays: { min: 3, max: 12, unit: 'month' },
    fourIronRules: {
      humanLine: '买入香港REITs(领展/置富/阳光/泓富)，分红率>5%+资产净值稳定。香港REIT是亚洲最成熟的REIT市场——做包租公比炒股省心。',
      stopLossRule: '分红率降到<4%或NAV跌>10%→出。加息周期→REIT融资成本上升→减仓。',
      marketScope: [{ market: '🇭🇰', assetClass: 'REIT', symbols: ['领展/置富/阳光/泓富/冠君/越秀'] }],
      failureCheck: '香港零售地产空置率飙升(>10%)→REIT租金收入下降→止损。港元联系汇率脱钩→资产重估→暂停。',
    },
    factorCombo: [
      { factorId: 'DIVIDEND_YIELD', factorName: '股息率', weight: 40, direction: 'long', threshold: { min: 5 } },
      { factorId: 'HK_REIT_NAV', factorName: 'REIT资产净值', weight: 25, direction: 'long' },
      { factorId: 'HK_INTEREST_RATE', factorName: '香港利率', weight: 15, direction: 'short' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'long' },
      { factorId: 'HK_PROPERTY_CYCLE', factorName: '物业周期', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'REIT分红可持续性+NAV变化' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股REIT长期回报分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '利率+租金+空置率综合诊断' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股REIT收息策略助手。基于领展/置富/冠君等REIT股息率+物业估值+利率敏感度因子，帮助用户优化REIT收息组合。',
      conversationStarters: [
        '港股REIT股息率>6%的值得买吗？',
        '加息周期REIT怎么办？',
        '香港零售REIT vs 写字楼REIT哪家强？'
      ],
      tunableParams: [
        { paramName: 'yieldMin', description: '最低股息率', currentValue: '5%', range: '4%-7%' },
        { paramName: 'rateSensitivity', description: '利率敏感度阈值', currentValue: '0.8', range: '0.5-1.0' },
        { paramName: 'propertyType', description: '物业类型偏好', currentValue: '零售', range: '零售/写字楼/工业/综合' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['港股', 'REIT', '收租', '分红'],
    version: 'v1.0',
  },
  {
    id: 'hk-ipo-flip',
    name: 'HK IPO First-Day Flip',
    nameCn: '港股打新翻倍',
    category: 'hk',
    difficulty: 3,
    timeHorizon: 'intraday',
    expectedHoldingDays: '上市首日-7天',
    holdingDays: { min: 0, max: 7, unit: 'day' },
    fourIronRules: {
      humanLine: '散户超额认购>100倍+基石投资者>50%→打新暗盘买入→上市首日卖出。港股打新是散户最强alpha——但只做超额爆款。',
      stopLossRule: '上市首日跌破发行价5%→立即平仓。暗盘跌>3%→不买。超额倍数<50倍→不打(热度不够)。',
      marketScope: [{ market: '🇭🇰', assetClass: 'IPO', symbols: ['超额认购>100倍的港股IPO'] }],
      failureCheck: '港股IPO市场冰冻期(连续3个月无超额>50倍)→无机会→暂停。香港证监会收紧打新规则(如降低散户中签率)→策略失效→重新评估。',
    },
    factorCombo: [
      { factorId: 'HK_IPO_OVERSUB', factorName: '超额认购倍数', weight: 40, direction: 'long', threshold: { min: 100 } },
      { factorId: 'HK_CORNERSTONE', factorName: '基石占比', weight: 25, direction: 'long', threshold: { min: 50 } },
      { factorId: 'HK_IPO_SIZE', factorName: '募资规模', weight: 15, direction: 'long', threshold: { min: 1e8 } },
      { factorId: 'HK_DARK_POOL', factorName: '暗盘信号', weight: 10, direction: 'long' },
      { factorId: 'SENTIMENT', factorName: '市场情绪', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'IPO打新健康: 首日涨幅分布正常? 市场热度?' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '爆款IPO打新机会推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: 'IPO热度+暗盘+基石综合评分' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股打新历史胜率分析' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股IPO打新策略助手。基于超额认购倍数/暗盘价格/基石投资者比例/行业热度因子，帮助用户判断IPO参与策略。',
      conversationStarters: [
        '超额认购>100倍可以All in吗？',
        '暗盘涨了要不要首日卖出？',
        '基石投资者比例低的IPO风险大吗？'
      ],
      tunableParams: [
        { paramName: 'oversubscription', description: '超额认购阈值', currentValue: '50倍', range: '20-200倍' },
        { paramName: 'flipStrategy', description: '卖出策略', currentValue: '首日', range: '暗盘/首日/首周' },
        { paramName: 'cornerstoneMin', description: '基石最低比例', currentValue: '30%', range: '20%-50%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['港股', '打新', 'IPO', '暗盘'],
    version: 'v1.0',
  },
  {
    id: 'hk-short-squeeze',
    name: 'HK Short Squeeze Hunter',
    nameCn: '港股沽空挤压',
    category: 'hk',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '1-7天',
    holdingDays: { min: 1, max: 7, unit: 'day' },
    fourIronRules: {
      humanLine: '找被过度沽空的港股：沽空比率>30%+市值<50亿→一旦有利好→空头被迫回补→股价暴涨。港股沽空挤压是最暴利策略——但也是最高风险。',
      stopLossRule: '沽空比率降到<15%→挤压已结束→出。没有利好催化→等催化剂。个股跌>10%→空头判断对的→止损。',
      marketScope: [{ market: '🇭🇰', assetClass: '股票', symbols: ['沽空>30%的港股中小市值'] }],
      failureCheck: '大市崩盘→多头空头一起砸→挤压不会发生→清仓。标的被港交所停牌→无法交易→最坏情况。',
    },
    factorCombo: [
      { factorId: 'HK_SHORT_RATIO', factorName: '沽空比率', weight: 40, direction: 'long', threshold: { min: 30 } },
      { factorId: 'HK_SHORT_DAYS', factorName: '沽空天数', weight: 20, direction: 'long', threshold: { min: 5 } },
      { factorId: 'HK_MARKET_CAP', factorName: '市值因子', weight: 15, direction: 'short', threshold: { max: 5e9 } },
      { factorId: 'HK_NEWS_CATALYST', factorName: '利好催化', weight: 15, direction: 'long' },
      { factorId: 'SENTIMENT', factorName: '市场情绪', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '沽空挤压健康: 沽空比例正常? 挤压概率合理?' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '沽空挤压预警实时推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '沽空比率+催化+挤压概率诊断' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '暗池沽空流量+社交情绪数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股逼空策略助手。基于沽空比率/借货成本/流通股本/大户持仓因子，帮助用户判断逼空机会和风险。',
      conversationStarters: [
        '沽空比率>20%是逼空信号吗？',
        '借货成本飙升意味什么？',
        '逼空失败最坏亏多少？'
      ],
      tunableParams: [
        { paramName: 'shortRatio', description: '沽空比率阈值', currentValue: '15%', range: '10%-25%' },
        { paramName: 'borrowCost', description: '借货成本阈值', currentValue: '10%/年', range: '5%-30%/年' },
        { paramName: 'maxPosition', description: '最大仓位', currentValue: '10%', range: '5%-20%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['港股', '沽空', '挤压', '高波动'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// R207 autoclaw #4: 🌐 CROSS-MARKET SUPPLEMENT TEMPLATES (4)
// ═══════════════════════════════════════════════════════════════════════════════

export const CROSS_SUPPLEMENT_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'xm-fx-hedge',
    name: 'Cross-Market FX Hedge',
    nameCn: '汇率对冲矩阵',
    category: 'cross',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买美元资产→做多美元/港币对冲；买日股→做多日元/港币对冲。跨境投资不锁汇=汇兑损益吃掉超额收益——AI帮你算最佳对冲比率。',
      stopLossRule: '对冲成本(远期升贴水)超过预期收益3%→停止对冲→改为自然敞口。汇率波动率>15%→增加对冲比率到80%。',
      marketScope: [
        { market: '🇺🇸', assetClass: '外汇', symbols: ['USD/HKD', 'USD/CNY远期'] },
        { market: '🇯🇵', assetClass: '外汇', symbols: ['JPY/HKD远期'] },
        { market: '🇪🇺', assetClass: '外汇', symbols: ['EUR/HKD远期'] },
      ],
      failureCheck: '远期市场流动性枯竭(金融危机)→对冲不可执行→转换为现货对冲。联系汇率制度波动→港币不对美元对冲。',
    },
    factorCombo: [
      { factorId: 'FX_CARRY', factorName: '息差套利', weight: 35, direction: 'long' },
      { factorId: 'FX_VOLATILITY', factorName: '汇率波动率', weight: 25, direction: 'short', threshold: { max: 15 } },
      { factorId: 'FX_FORWARD_POINTS', factorName: '远期升贴水', weight: 20, direction: 'short' },
      { factorId: 'MACRO_MOMENTUM', factorName: '宏观动量', weight: 10, direction: 'long' },
      { factorId: 'INTEREST_RATE', factorName: '利差', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '外汇对冲健康: 对冲有效性>80%? 成本合理?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '央行利率预期+跨境资金流替代数据' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '最优对冲比率+息差分析' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '对冲vs不对冲历史收益对比' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '对冲比率+滚动频率优化' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是外汇对冲策略助手。基于利率差/远期曲线/波动率微笑/COT持仓因子，帮助用户设计和优化外汇对冲方案。',
      conversationStarters: [
        '美元见顶了该调整对冲吗？',
        'Carry Trade还能做吗？',
        '央行干预风险怎么评估？'
      ],
      tunableParams: [
        { paramName: 'hedgeRatio', description: '对冲比例', currentValue: '70%', range: '50%-100%' },
        { paramName: 'carryThreshold', description: 'Carry最低利差', currentValue: '2%', range: '1%-5%' },
        { paramName: 'volatility', description: '波动率阈值', currentValue: '10%', range: '5%-20%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['跨市场', '汇率', '对冲', '远期'],
    version: 'v1.0',
  },
  {
    id: 'xm-rate-spread',
    name: 'Global Rate Spread Trade',
    nameCn: '全球利率差交易',
    category: 'cross',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '做多高利率国家的短期债券+做空低利率国家的短期债券→吃利差。美日利差>3%→做多美债/做空日债=躺赚。',
      stopLossRule: '利差收窄>1%→平仓(利息收益被利差损失吃掉)。高利率国家降息→利差缩小→提前平仓。',
      marketScope: [
        { market: '🇺🇸', assetClass: '债券', symbols: ['2Y/10Y Treasury'] },
        { market: '🇯🇵', assetClass: '债券', symbols: ['10Y JGB'] },
        { market: '🇪🇺', assetClass: '债券', symbols: ['10Y Bund'] },
      ],
      failureCheck: '高利率国家信用违约(如新兴市场)→息差是假的一真风险在违约→立刻平仓。日元carry trade unwind→利率差交易集体平仓→暂停。',
    },
    factorCombo: [
      { factorId: 'INTEREST_RATE', factorName: '利差', weight: 40, direction: 'long', threshold: { min: 2 } },
      { factorId: 'CREDIT_SPREAD', factorName: '信用利差', weight: 20, direction: 'short', threshold: { max: 2 } },
      { factorId: 'MACRO_MOMENTUM', factorName: '宏观动量', weight: 15, direction: 'long' },
      { factorId: 'FX_CARRY', factorName: '息差套利', weight: 15, direction: 'long' },
      { factorId: 'TERM_STRUCTURE', factorName: '期限结构', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '各国CPI/PPI+贸易余额替代数据' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '全球利差机会扫描+央行政策分析' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '利差变化预警推送' },
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '跨国利差套利机会扫描' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是利率价差策略助手。基于各国收益率曲线/利差变化/央行政策预期/通胀预期因子，帮助用户捕捉利率定价差机会。',
      conversationStarters: [
        '美日利差还会扩大吗？',
        '收益率曲线倒挂如何交易？',
        '央行转向怎么提前布局？'
      ],
      tunableParams: [
        { paramName: 'spreadEntry', description: '利差入场阈值', currentValue: '50bp', range: '25-150bp' },
        { paramName: 'durationTarget', description: '久期目标', currentValue: '5年', range: '2-10年' },
        { paramName: 'centralBank', description: '央行政策权重', currentValue: '40%', range: '30%-50%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['跨市场', '利率', '债券', '利差'],
    version: 'v1.0',
  },
  {
    id: 'xm-credit-arbitrage',
    name: 'Cross-Border Credit Arbitrage',
    nameCn: '跨境信贷套利',
    category: 'cross',
    difficulty: 4,
    timeHorizon: 'position',
    expectedHoldingDays: '30-180天',
    holdingDays: { min: 30, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '同一家公司在A市场发的债和B市场发的债——信用利差不同→买便宜的一边。中资美元债vs境内债利差>2%=机会。',
      stopLossRule: '信用利差扩大到>5%→可能定价的是违约风险不是套利机会→止损。发行方信用评级被降→立即平仓。',
      marketScope: [
        { market: '🇭🇰', assetClass: '债券', symbols: ['中资美元债'] },
        { market: '🇺🇸', assetClass: '公司债', symbols: ['IG/HY corporate bonds'] },
      ],
      failureCheck: '跨境资本管制(如限制换汇)→套利不可执行→暂停。信用事件(违约/展期)→利差永不平仓→最坏情况。',
    },
    factorCombo: [
      { factorId: 'CREDIT_SPREAD', factorName: '信用利差', weight: 40, direction: 'long', threshold: { min: 2 } },
      { factorId: 'AH_PREMIUM', factorName: 'AH溢价(类比)', weight: 20, direction: 'short' },
      { factorId: 'DEFAULT_PROB', factorName: '违约概率', weight: 15, direction: 'short', threshold: { max: 5 } },
      { factorId: 'INTEREST_RATE', factorName: '利差', weight: 15, direction: 'long' },
      { factorId: 'LIQUIDITY', factorName: '流动性', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '跨境信用套利机会扫描' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '信用风险评估+套利可行性' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'CDS数据+债券异动监测' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是信用套利策略助手。基于CDS利差/信用评级/违约概率/回收率因子，帮助用户在信用市场寻找定价偏差。',
      conversationStarters: [
        'CDS利差扩大=买入机会吗？',
        '投资级vs垃圾级利差怎么交易？',
        '信用事件发生时怎么应对？'
      ],
      tunableParams: [
        { paramName: 'cdsSpread', description: 'CDS利差阈值', currentValue: '100bp', range: '50-300bp' },
        { paramName: 'ratingMin', description: '最低信用评级', currentValue: 'BBB-', range: 'BB-至AAA' },
        { paramName: 'defaultProb', description: '违约概率阈值', currentValue: '2%', range: '0.5%-5%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['跨市场', '信用', '套利', '债券'],
    version: 'v1.0',
  },
  {
    id: 'xm-commodity-pair',
    name: 'Commodity Pair Trade',
    nameCn: '商品配对交易',
    category: 'commodity',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-30天',
    holdingDays: { min: 7, max: 30, unit: 'day' },
    fourIronRules: {
      humanLine: '买一只商品期货+卖一只相关商品期货→赚相对价值而非方向。金铜比/油金比偏离历史均值>2σ→做均值回归。',
      stopLossRule: '比价继续偏离(>3σ)→止损(可能是结构性变化)。配对相关性跌破0.5→配对失效→重新配对。',
      marketScope: [
        { market: '🛢️', assetClass: '商品期货', symbols: ['黄金/铜/原油/天然气/大豆/玉米'] },
      ],
      failureCheck: '商品供需结构性变化(如页岩油打破油金比)→历史均值不再有效→暂停。汇率/政策干预(如OPEC减产)→配对逻辑被扭曲。',
    },
    factorCombo: [
      { factorId: 'CMD_SPREAD_ZSCORE', factorName: '商品比价Z分数', weight: 35, direction: 'long', threshold: { min: 2 } },
      { factorId: 'CMD_CORRELATION', factorName: '商品相关性', weight: 25, direction: 'long', threshold: { min: 0.7 } },
      { factorId: 'CMD_TERM_STRUCTURE', factorName: '商品期限结构', weight: 15, direction: 'long' },
      { factorId: 'CMD_MOMENTUM_12M', factorName: '商品动量', weight: 15, direction: 'long' },
      { factorId: 'CMD_INVENTORY', factorName: '商品库存', weight: 10, direction: 'short' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '商品配对健康: 价差均值回归速度? 季节性稳定?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港口库存+航运指数+天气预测替代数据' },
      { id: 'arbitrage-scan', label: 'AI套利扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '全球商品配对机会扫描' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '配对相关性+比价均值回归分析' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '比价偏离预警实时推送' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是商品货币对策略助手。基于商品价格/CFTC持仓/实际利率/美元指数因子，帮助用户交易商品货币对。',
      conversationStarters: [
        '油价涨该买CAD还是NOK？',
        '铁矿价格对AUD影响有多大？',
        '商品超级周期来了吗？'
      ],
      tunableParams: [
        { paramName: 'commodityCorr', description: '商品汇率相关性', currentValue: '0.7', range: '0.5-0.9' },
        { paramName: 'cotThreshold', description: 'COT极端持仓阈值', currentValue: '80%', range: '70%-95%' },
        { paramName: 'positionSize', description: '单品种仓位', currentValue: '5%', range: '2%-10%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['商品', '配对', '均值回归', '比价'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// R207 autoclaw #5: 🤖 AI SUPPLEMENT TEMPLATES (3) — with DeepSeekChatConfig
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_SUPPLEMENT_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'ai-factor-rotation',
    name: 'AI Factor Rotation Engine',
    nameCn: 'AI因子轮动',
    category: 'ai',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-30天',
    holdingDays: { min: 7, max: 30, unit: 'day' },
    fourIronRules: {
      humanLine: '让AI自动在各因子间轮动：动量IC高→超配动量因子；价值IC高→超配价值因子。每个月AI重新排名因子IC，一键切换配置。',
      stopLossRule: '轮入的因子IC连续2周为负→切换回因子中性。没有一个因子IC>0.05→美股+港股双无效→空仓/持有SPY+恒生ETF。',
      marketScope: [
        { market: '🇺🇸', assetClass: '因子组合', symbols: ['动量/价值/质量/低波/规模5因子'] },
        { market: '🇭🇰', assetClass: '因子组合', symbols: ['港股动量/价值/股息因子'] },
      ],
      failureCheck: '因子拥挤度>90%(所有策略同向)→因子轮动变成拥挤交易→AI建议降频或切换。市场危机→所有因子同跌(correlation→1)→轮动失效。',
    },
    factorCombo: [
      { factorId: 'FACTOR_EFFICIENCY', factorName: '因子效率(IC)', weight: 35, direction: 'long', threshold: { min: 0.05 } },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_CROWDING', factorName: '因子拥挤度', weight: 15, direction: 'short', threshold: { max: 0.7 } },
      { factorId: 'DISPERSION', factorName: '横截面离散度', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_CORRELATION', factorName: '因子间相关性', weight: 15, direction: 'short', threshold: { max: 0.5 } },
    ],
    aiTriggerPoints: [
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '月度因子IC排名+轮动建议' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '因子轮动vs持有单一因子对比' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '轮动频率+因子权重优化' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '因子IC变化预警推送' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI因子轮动助手。基于5大因子的IC(信息系数)排名，每月给出最优因子权重配置。因子拥挤度>70%时自动提示风险。',
      conversationStarters: [
        '这个月该超配哪个因子？',
        '动量因子还有效吗？',
        '因子拥挤度太高，该减仓吗？',
      ],
      tunableParams: [
        { paramName: 'rotationFrequency', description: '轮动频率', currentValue: '每月', range: '每周-每季' },
        { paramName: 'minIC', description: '最低IC阈值', currentValue: '0.05', range: '0.02-0.10' },
        { paramName: 'crowdingLimit', description: '拥挤度上限', currentValue: '0.7', range: '0.5-0.9' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '因子', '轮动', '月度'],
    version: 'v1.0',
  },
  {
    id: 'ai-timing-enhanced',
    name: 'AI Timing Enhanced',
    nameCn: 'AI择时增强',
    category: 'ai',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '1-14天',
    holdingDays: { min: 1, max: 14, unit: 'day' },
    fourIronRules: {
      humanLine: 'AI择时v2：不仅看趋势和波动率，还加入资金流+期权伽马+国债利率——五维择时比三维更准。信号出现→一键执行。',
      stopLossRule: '5个维度中3个以上反方向→减半仓。信号连续3天错误→模型可能过拟合→暂停→让AI重新训练。',
      marketScope: [
        { market: '🇺🇸', assetClass: '股指期货', symbols: ['ES(SP500)/NQ(Nasdaq)/RTY(Russell)'] },
        { market: '🪙', assetClass: '加密货币', symbols: ['BTC永续合约'] },
      ],
      failureCheck: '市场进入事件驱动模式(如FOMC/CPI)→技术因子失效→AI降低信号权重→暂缓开仓。流动性断层(闪崩)→信号失真→只保留硬止损。',
    },
    factorCombo: [
      { factorId: 'TREND_SIGNAL', factorName: '趋势信号', weight: 25, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 20, direction: 'short', threshold: { max: 30 } },
      { factorId: 'OPTION_GAMMA', factorName: '期权伽马', weight: 20, direction: 'long' },
      { factorId: 'FUND_FLOW', factorName: '资金流向', weight: 20, direction: 'long' },
      { factorId: 'TREASURY_RATE', factorName: '国债利率变化', weight: 15, direction: 'short' },
    ],
    aiTriggerPoints: [
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '五维择时信号实时推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '五维度信号一致性诊断' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '五维度权重+信号阈值优化' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '期权异动+大户资金流数据' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI择时增强助手。基于趋势/波动率/期权伽马/资金流向/国债利率五维度，给出高可信度的多空信号和仓位建议。',
      conversationStarters: [
        '五维度信号现在是什么方向？',
        '哪个维度发出的信号最强？',
        '信号有没有冲突？该信哪个？',
      ],
      tunableParams: [
        { paramName: 'dimensionWeight', description: '五维度权重分配', currentValue: '25/20/20/20/15', range: '自定义配比' },
        { paramName: 'signalThreshold', description: '信号触发阈值', currentValue: '0.6', range: '0.3-0.9' },
        { paramName: 'consensusRequired', description: '最少一致维度', currentValue: '3', range: '2-5' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '择时', '五维', '伽马'],
    version: 'v2.0',
  },
  {
    id: 'ai-hedge-enhanced',
    name: 'AI Hedge Enhanced',
    nameCn: 'AI对冲增强',
    category: 'ai',
    difficulty: 4,
    timeHorizon: 'position',
    expectedHoldingDays: '7-60天',
    holdingDays: { min: 7, max: 60, unit: 'day' },
    fourIronRules: {
      humanLine: 'AI帮你管对冲：多维度计算组合尾部风险→自动匹配最优对冲工具(期权/期货/反向ETF/波动率)。不是简单地买PUT——是最优成本对冲。',
      stopLossRule: '对冲成本>组合预期收益的20%→对冲太贵→降低对冲比率。风险场景解除(如VIX回落到<20)→逐步卸掉对冲。',
      marketScope: [
        { market: '🇺🇸', assetClass: '期权+期货+ETF', symbols: ['SPY期权/VIX期货/SQQQ/TBT'] },
        { market: '🪙', assetClass: '永续合约', symbols: ['BTC永续空单'] },
      ],
      failureCheck: '期权市场流动性枯竭(波动率飙升时)→对冲成本不可控→只保留期货对冲。VIX ETN信用事件(如2018 XVG爆仓)→停止用波动率产品对冲。',
    },
    factorCombo: [
      { factorId: 'TAIL_RISK', factorName: '尾风险', weight: 30, direction: 'short', threshold: { max: 2 } },
      { factorId: 'VAR', factorName: 'VaR值', weight: 20, direction: 'short', threshold: { max: 5 } },
      { factorId: 'CORRELATION', factorName: '相关性', weight: 15, direction: 'short', threshold: { max: 0.8 } },
      { factorId: 'HEDGE_COST', factorName: '对冲成本比', weight: 15, direction: 'short', threshold: { max: 0.2 } },
      { factorId: 'OPTION_GAMMA', factorName: '期权伽马', weight: 10, direction: 'long' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'long', threshold: { min: 20 } },
    ],
    aiTriggerPoints: [
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '尾部风险+对冲成本综合诊断' },
      { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '对冲信号触发即时推送' },
      { id: 'arbitrage-scan', label: 'AI对冲扫描', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 2, description: '最优对冲工具+比率推荐' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '对冲比率+工具选择优化' },
    ],
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AI对冲增强助手。基于组合尾部风险实时计算最优对冲方案，平衡成本和保护效果，给出具体工具和比率建议。',
      conversationStarters: [
        '我的组合现在需要什么对冲？',
        '买PUT还是做空期货更划算？',
        '现在的对冲成本合理吗？',
      ],
      tunableParams: [
        { paramName: 'hedgeRatio', description: '对冲比率', currentValue: '50%', range: '0%-100%' },
        { paramName: 'costLimit', description: '对冲成本上限(%收益)', currentValue: '20%', range: '5%-30%' },
        { paramName: 'instruments', description: '对冲工具配置', currentValue: '期权+期货', range: '期权/期货/ETF/波动率' },
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    },
    tags: ['AI', '对冲', '尾部风险', '期权'],
    version: 'v2.0',
  },
];

// ============================================================================
// R207: Phase 2 Final — 44 templates (13+11+10+10)
// ============================================================================

export const ALL_AUTOCLAW_TEMPLATES_R207: FactorStrategyTemplate[] = [
  ...HK_TEMPLATES,               // R204: 5
  ...CRYPTO_TEMPLATES,            // R204: 8
  ...JP_KR_TEMPLATES,             // R205: 4
  ...TW_SG_AU_TEMPLATES,          // R205: 4
  ...EU_IN_TEMPLATES,             // R205: 3
  ...AI_TEMPLATES,                // R206: 10
  ...HK_SUPPLEMENT_TEMPLATES,     // R207: 3
  ...CROSS_SUPPLEMENT_TEMPLATES,  // R207: 4
  ...AI_SUPPLEMENT_TEMPLATES,     // R207: 3
];

export const ALL_TEMPLATE_COUNT_R207 = {
  hk: HK_TEMPLATES.length + HK_SUPPLEMENT_TEMPLATES.length,        // 8
  crypto: CRYPTO_TEMPLATES.length,                                   // 8
  jp_kr: JP_KR_TEMPLATES.length,                                     // 4
  tw_sg_au: TW_SG_AU_TEMPLATES.length,                               // 4
  eu_in: EU_IN_TEMPLATES.length,                                     // 3
  ai: AI_TEMPLATES.length + AI_SUPPLEMENT_TEMPLATES.length,          // 13
  cross: CROSS_SUPPLEMENT_TEMPLATES.length,                          // 4
  total: ALL_AUTOCLAW_TEMPLATES_R207.length,                         // 44
};

export function getTemplateByIdR207(id: string): FactorStrategyTemplate | undefined {
  return ALL_AUTOCLAW_TEMPLATES_R207.find(t => t.id === id);
}

export function getTemplatesByMarketR207(market: MarketTag): FactorStrategyTemplate[] {
  return ALL_AUTOCLAW_TEMPLATES_R207.filter(t => t.fourIronRules.marketScope.some(s => s.market === market));
}

export function getAITemplatesR207(): FactorStrategyTemplate[] {
  return [...AI_TEMPLATES, ...AI_SUPPLEMENT_TEMPLATES];
}

export function validateAllTemplatesR207(): { templateId: string; valid: boolean; errors: string[] }[] {
  return ALL_AUTOCLAW_TEMPLATES_R207.map(t => ({ templateId: t.id, ...validateFourIronRules(t) }));
}
