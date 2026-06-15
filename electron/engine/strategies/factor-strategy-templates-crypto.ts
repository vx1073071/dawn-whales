/**
 * R222 JVS#2: Crypto factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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

