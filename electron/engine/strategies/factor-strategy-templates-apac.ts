/**
 * R222 JVS#2: APAC (TW/SG/AU) factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


