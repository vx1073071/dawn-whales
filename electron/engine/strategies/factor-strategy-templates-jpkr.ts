/**
 * R222 JVS#2: Japan & Korea factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


