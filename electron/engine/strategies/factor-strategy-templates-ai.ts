/**
 * R222 JVS#2: AI-Native factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

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


