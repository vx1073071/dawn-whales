/**
 * R222 JVS#2: HK Supplement factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


