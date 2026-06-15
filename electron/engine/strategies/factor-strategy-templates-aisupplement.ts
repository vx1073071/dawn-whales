/**
 * R222 JVS#2: AI Supplement factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


