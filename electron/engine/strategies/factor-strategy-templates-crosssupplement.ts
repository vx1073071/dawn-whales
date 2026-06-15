/**
 * R222 JVS#2: Cross-Market Supplement factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


