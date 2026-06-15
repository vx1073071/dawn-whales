/**
 * template-definitions-us.ts — R204 J2: 美股7策略模板
 *
 * 7 US equity templates with 四铁律 + 3-5 AI trigger points:
 *   1. EARNINGS_HUNTER   — 财报猎人
 *   2. MAG7_MOMENTUM     — MAG7动量
 *   3. VALUE_MINER       — 价值掘金
 *   4. LOW_VOL_DEFENSE   — 低波防御
 *   5. THIRTEEN_F_TRACK  — 13F跟随
 *   6. PEAD_DRIFT        — PEAD漂移
 *   7. VIX_HEDGE         — VIX对冲
 *
 * Register with: templateRegistry.registerAll() in init.
 */

import { StrategyTemplate, MarketTag, AITriggerPoint, FactorCombo, FourIronRules } from './TemplateEngine';

// ── Helper to build AI triggers for US templates ──────────────────────────

function usTriggers(suffix: string): AITriggerPoint[] {
  return [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + suffix + '模板历史回测', descriptionEN: 'AI analyzes ' + suffix + ' backtest performance',
      targetParams: ['lookbackPeriod'] },
    { type: 'PARAM_FILL', nameCN: '参数智能填充', nameEN: 'Auto Param Fill', priceUSDT: 1,
      descriptionCN: '根据当前市场智能推荐' + suffix + '参数', descriptionEN: 'AI recommends ' + suffix + ' params for current market',
      targetParams: ['entryThreshold', 'stopLossPct'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI分析' + suffix + '因子权重优化空间', descriptionEN: 'AI analyzes ' + suffix + ' factor weight optimization',
      targetParams: ['factorWeights'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: 'AI诊断' + suffix + '当前因子IC及拥挤度', descriptionEN: 'AI checks ' + suffix + ' factor IC and crowding',
      targetParams: ['factorIds'] },
  ];
}

// ── 7 US Templates ────────────────────────────────────────────────────────

const US_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 财报猎人 — SURPRISE + MOM_20 + TURNOVER + QUAL_ROE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-earnings-hunter',
    name: 'Earnings Surprise Hunter',
    nameCN: '财报猎人',
    category: 'event_driven',
    riskLevel: 'medium',
    description: '捕捉财报超预期后的漂移效应：买入SURPRISE>5%且20日动量>0的标的，持有至下次财报前',
    oneLiner: '财报超预期+动量确认→持有至下次财报',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['SURPRISE', 'MOM_20', 'TURNOVER', 'QUAL_ROE'],
      weights: [0.35, 0.30, 0.15, 0.20],
      formula: '0.35*SURPRISE + 0.30*MOM_20 + 0.15*TURNOVER + 0.20*QUAL_ROE',
    },
    ironRules: {
      oneLiner: '财报超预期+动量确认→持有至下次财报',
      stopLossRule: '财报后5日内跌破突破日前低则-5%止损，单只最大-8%',
      marketScope: 'US股票，市值>10B，近5日有财报发布，SURPRISE>5%',
      failureCheck: '连续3季财报后无漂移、SURPRISE因子IC<0.02时暂停使用',
    },
    aiTriggers: usTriggers('财报猎人'),
    applicable: ['US Stocks', 'Earnings Season'],
    tags: ['earnings', 'surprise', 'momentum', 'US'],
    risk: { defaultStopLoss: 0.05, defaultTakeProfit: 0.15, maxPosition: 0.08 },
    timeframe: ['1d', '1w'],
    popularityScore: 85,
    winRate: 0.62,
    sharpe: 1.15,
    matchesKeyword(kw: string): boolean { return ['财报', 'earnings', 'surprise', '猎人'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. MAG7动量 — TREND_STRENGTH + MOM_20 + VOL_BREAKOUT + INST_OWNER
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-mag7-momentum',
    name: 'MAG7 Momentum Rotator',
    nameCN: 'MAG7动量',
    category: 'momentum',
    riskLevel: 'high',
    description: 'MAG7七巨头中选Top3动量最强标的，每周换仓：AAPL/MSFT/GOOGL/AMZN/META/NVDA/TSLA',
    oneLiner: 'MAG7每周Top3动量轮动，强者恒强',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['TREND_STRENGTH', 'MOM_20', 'VOL_BREAKOUT', 'INST_OWNER'],
      weights: [0.35, 0.30, 0.20, 0.15],
      formula: '0.35*TREND_STRENGTH + 0.30*MOM_20 + 0.20*VOL_BREAKOUT + 0.15*INST_OWNER',
    },
    ironRules: {
      oneLiner: 'MAG7每周Top3动量轮动，强者恒强',
      stopLossRule: '单只-8%止损，组合-15%时清仓观望1周',
      marketScope: 'US MAG7: AAPL/MSFT/GOOGL/AMZN/META/NVDA/TSLA',
      failureCheck: 'MAG7平均动量IC连续4周<0.03时降仓50%，<0时停止策略',
    },
    aiTriggers: [
      ...usTriggers('MAG7动量'),
      { type: 'ALT_DATA', nameCN: '替代数据解锁', nameEN: 'Alt Data Unlock', priceUSDT: 2,
        descriptionCN: '解锁13F机构持仓+期权暗池流数据', descriptionEN: 'Unlock 13F institutional + options dark pool data',
        targetParams: ['altData'] },
    ],
    applicable: ['US Stocks', 'MAG7'],
    tags: ['mag7', 'momentum', 'rotation', 'weekly'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.15 },
    timeframe: ['1d', '1w'],
    popularityScore: 92,
    winRate: 0.68,
    sharpe: 1.42,
    matchesKeyword(kw: string): boolean { return ['mag7', '动量', 'momentum', '七巨头'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 价值掘金 — VAL_BP + VAL_EP + DIV_YIELD + LOW_VOL + SIZE_LARGE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-value-miner',
    name: 'Deep Value Miner',
    nameCN: '价值掘金',
    category: 'value',
    riskLevel: 'low',
    description: '低PB+低PE+高股息+低波动+大市值五重筛选，巴菲特风格深度价值',
    oneLiner: '低PB低PE高股息低波大市值→买入等待价值回归',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['VAL_BP', 'VAL_EP', 'DIV_YIELD', 'LOW_VOL', 'SIZE_LARGE'],
      weights: [0.25, 0.25, 0.20, 0.15, 0.15],
      formula: '0.25*VAL_BP + 0.25*VAL_EP + 0.20*DIV_YIELD + 0.15*LOW_VOL + 0.15*SIZE_LARGE',
    },
    ironRules: {
      oneLiner: '低PB低PE高股息低波大市值→买入等待价值回归',
      stopLossRule: '-12%止损（价值股波动小），关注基本面恶化信号',
      marketScope: 'US股票，市值>50B，VAL_BP<0.5分位，DIV_YIELD>2%',
      failureCheck: '价值因子IC连续2月<0，或市场风格切换到纯成长时暂停',
    },
    aiTriggers: usTriggers('价值掘金'),
    applicable: ['US Stocks', 'Large Cap', 'Value'],
    tags: ['value', 'Buffett', 'dividend', 'defensive', 'US'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.25, maxPosition: 0.08 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 78,
    winRate: 0.58,
    sharpe: 0.95,
    matchesKeyword(kw: string): boolean { return ['价值', 'value', '掘金', 'buffett', '低pb'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 低波防御 — LOW_VOL + DIV_GROWTH + QUAL_ROE + SIZE_LARGE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-low-vol-defense',
    name: 'Low Volatility Defense',
    nameCN: '低波防御',
    category: 'defensive',
    riskLevel: 'low',
    description: '高波动市场切换低波防御：LOW_VOL + DIV_GROWTH + QUAL_ROE三因子护城河',
    oneLiner: '低波动+股息增长+ROE质量→熊市防御组合',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['LOW_VOL', 'DIV_GROWTH', 'QUAL_ROE', 'SIZE_LARGE'],
      weights: [0.35, 0.25, 0.25, 0.15],
      formula: '0.35*LOW_VOL + 0.25*DIV_GROWTH + 0.25*QUAL_ROE + 0.15*SIZE_LARGE',
    },
    ironRules: {
      oneLiner: '低波动+股息增长+ROE质量→熊市防御组合',
      stopLossRule: '-6%止损（低波策略波动小），市场波动率回落后可恢复',
      marketScope: 'US股票，市值>20B，VIX>25时触发使用，VIX<20时降仓',
      failureCheck: 'VIX<15且防御因子IC<0时，切换回进攻策略',
    },
    aiTriggers: usTriggers('低波防御'),
    applicable: ['US Stocks', 'Defensive', 'High VIX'],
    tags: ['low-vol', 'defensive', 'dividend', 'quality', 'US'],
    risk: { defaultStopLoss: 0.06, defaultTakeProfit: 0.12, maxPosition: 0.10 },
    timeframe: ['1d', '1w'],
    popularityScore: 72,
    winRate: 0.60,
    sharpe: 1.08,
    matchesKeyword(kw: string): boolean { return ['低波', '防御', 'defense', 'low vol', 'vix'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 5. 13F跟随 — INST_OWNER + MOM_60 + SURPRISE + TURNOVER
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-thirteen-f-track',
    name: '13-F Whale Tracker',
    nameCN: '13F跟随',
    category: 'event_driven',
    riskLevel: 'medium',
    description: '跟踪顶级对冲基金13F季度持仓变化：新增持仓+增持>20%+动量确认→跟随入场',
    oneLiner: '跟顶级基金13F加仓→动量确认→跟随建仓',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['INST_OWNER', 'MOM_60', 'SURPRISE', 'TURNOVER'],
      weights: [0.35, 0.30, 0.20, 0.15],
      formula: '0.35*INST_OWNER + 0.30*MOM_60 + 0.20*SURPRISE + 0.15*TURNOVER',
    },
    ironRules: {
      oneLiner: '跟顶级基金13F加仓→动量确认→跟随建仓',
      stopLossRule: '-10%止损，如发生13F减仓信号立即离场',
      marketScope: 'US股票，基金新增或增持>20%，市值>5B',
      failureCheck: '13F报告滞后45天，如季中跌破13F持仓成本价15%则提前退出',
    },
    aiTriggers: [
      ...usTriggers('13F跟随'),
      { type: 'ALT_DATA', nameCN: '替代数据解锁', nameEN: 'Alt Data Unlock', priceUSDT: 2,
        descriptionCN: '解锁高频13F追踪+暗池+大宗交易数据', descriptionEN: 'Unlock high-freq 13F tracking, dark pool, block trade data',
        targetParams: ['altData'] },
    ],
    applicable: ['US Stocks', '13-F Filings'],
    tags: ['13F', 'whale', 'institutional', 'event', 'US'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.25, maxPosition: 0.10 },
    timeframe: ['1d', '1w'],
    popularityScore: 88,
    winRate: 0.65,
    sharpe: 1.28,
    matchesKeyword(kw: string): boolean { return ['13f', '跟随', 'whale', '机构'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 6. PEAD漂移 — SURPRISE + MOM_20 + VAL_EP + TURNOVER
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-pead-drift',
    name: 'PEAD Drift Capture',
    nameCN: 'PEAD漂移',
    category: 'event_driven',
    riskLevel: 'medium',
    description: 'Post-Earnings Announcement Drift：财报超预期后5-60日漂移效应捕捉',
    oneLiner: '财报超预期→5-60日漂移捕捉→分3批止盈',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['SURPRISE', 'MOM_20', 'VAL_EP', 'TURNOVER'],
      weights: [0.40, 0.25, 0.20, 0.15],
      formula: '0.40*SURPRISE + 0.25*MOM_20 + 0.20*VAL_EP + 0.15*TURNOVER',
    },
    ironRules: {
      oneLiner: '财报超预期→5-60日漂移捕捉→分3批止盈',
      stopLossRule: '第5日未启动漂移则-3%止损；启动后跟踪止损-8%',
      marketScope: 'US股票，市值>5B，SURPRISE>3%，财报后T+1~T+5入场',
      failureCheck: '漂移幅度连3季收窄或SURPRISE因子IC<0.01时停止',
    },
    aiTriggers: usTriggers('PEAD漂移'),
    applicable: ['US Stocks', 'Earnings Season'],
    tags: ['PEAD', 'earnings', 'drift', 'event', 'US'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.18, maxPosition: 0.06 },
    timeframe: ['1d', '1w'],
    popularityScore: 80,
    winRate: 0.63,
    sharpe: 1.22,
    matchesKeyword(kw: string): boolean { return ['pead', '漂移', 'drift', '财报'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 7. VIX对冲 — LOW_VOL + TREND_STRENGTH + DIV_YIELD + CMD_DXY_LINKAGE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-vix-hedge',
    name: 'VIX Spike Hedger',
    nameCN: 'VIX对冲',
    category: 'hedge',
    riskLevel: 'high',
    description: 'VIX>30时启动尾部对冲：低波动+趋势强度+股息+美元联动四因子防御',
    oneLiner: 'VIX>30启动→四因子防御→VIX<20退出',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['LOW_VOL', 'TREND_STRENGTH', 'DIV_YIELD', 'CMD_DXY_LINKAGE'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*LOW_VOL + 0.25*TREND_STRENGTH + 0.25*DIV_YIELD + 0.20*CMD_DXY_LINKAGE',
    },
    ironRules: {
      oneLiner: 'VIX>30启动→四因子防御→VIX<20退出',
      stopLossRule: 'VIX回落至20时可手动退出；亏损超-10%平仓',
      marketScope: 'US股票（防御板块优先），VIX>30触发，含USD敏感型标的',
      failureCheck: 'VIX<15时关闭策略；DXY与美股相关性反转时重新评估',
    },
    aiTriggers: [
      ...usTriggers('VIX对冲'),
      { type: 'ALT_DATA', nameCN: '替代数据解锁', nameEN: 'Alt Data Unlock', priceUSDT: 2,
        descriptionCN: '解锁VIX期货期限结构+put/call比率数据', descriptionEN: 'Unlock VIX futures term structure + put/call ratio data',
        targetParams: ['altData'] },
    ],
    applicable: ['US Stocks', 'Hedge', 'High Volatility'],
    tags: ['vix', 'hedge', 'tail-risk', 'defensive', 'US'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.20, maxPosition: 0.12 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 75,
    winRate: 0.55,
    sharpe: 0.82,
    matchesKeyword(kw: string): boolean { return ['vix', '对冲', 'hedge', '波动率'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default US_TEMPLATES;
