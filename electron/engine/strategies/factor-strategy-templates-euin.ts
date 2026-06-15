/**
 * R222 JVS#2: Europe & India factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


