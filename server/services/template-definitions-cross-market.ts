/**
 * template-definitions-cross-market.ts — R206 J1: 跨市场8策略模板
 *
 * 8 cross-market/multi-asset templates with 四铁律 + 3-5 AI trigger points:
 *   1. ALL_WEATHER        — 全天候: 股债商品黄金四维配置
 *   2. RISK_PARITY        — 风险平价: 波动率倒数加权
 *   3. GLOBAL_ALLOC       — 全球配置: 美股+港股+欧股+日股+新兴
 *   4. MULTI_ASSET        — 多资产: 股票+债券+商品+加密+现金
 *   5. TAIL_HEDGE         — 尾部对冲: 期权+VIX+国债多资产对冲
 *   6. SPREAD_ARB         — 跨市场套利: AH+ADR+ETF+跨期
 *   7. INFLATION_SHIELD   — 通胀护盾: TIPS+黄金+商品+REITs
 *   8. RECESSION_BUNKER   — 衰退碉堡: 国债+黄金+防御股+现金
 *
 * Register with templateRegistry.registerAll().
 */

import { StrategyTemplate, MarketTag, AITriggerPoint } from './TemplateEngine';

// ── Cross-market AI trigger builder ───────────────────────────────────────

function crossTriggers(name: string, extraTrigger?: AITriggerPoint): AITriggerPoint[] {
  const base: AITriggerPoint[] = [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + name + '多资产回测表现与相关性', descriptionEN: 'AI analyzes ' + name + ' multi-asset backtest and correlations',
      targetParams: ['assetWeights'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI优化' + name + '资产配置权重', descriptionEN: 'AI optimizes ' + name + ' asset allocation weights',
      targetParams: ['weights'] },
    { type: 'PARAM_FILL', nameCN: '参数填充', nameEN: 'Auto Param Fill', priceUSDT: 1,
      descriptionCN: '根据当前宏观环境智能推荐' + name + '参数', descriptionEN: 'AI recommends ' + name + ' params based on macro environment',
      targetParams: ['allocation'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: '诊断' + name + '各资产因子IC与拥挤度', descriptionEN: 'Diagnose ' + name + ' per-asset factor ICs',
      targetParams: ['factorIds'] },
  ];
  if (extraTrigger) base.push(extraTrigger);
  return base;
}

// ── 8 Cross-Market Templates ──────────────────────────────────────────────

const CROSS_MARKET_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 全天候 — TREND_STRENGTH + LOW_VOL + CMD_MOMENTUM_12M + CMD_REAL_RATE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-all-weather',
    name: 'All-Weather Portfolio',
    nameCN: '全天候',
    category: 'multi_asset',
    riskLevel: 'low',
    description: 'Bridgewater全天候风格：股票30%+长期国债40%+中期国债15%+黄金7.5%+商品7.5%',
    oneLiner: '股债商品黄金四维配置→穿越牛熊周期',
    version: 1,
    marketTags: ['US', 'COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['TREND_STRENGTH', 'LOW_VOL', 'CMD_MOMENTUM_12M', 'CMD_REAL_RATE'],
      weights: [0.25, 0.25, 0.25, 0.25],
      formula: '0.25*TREND_STRENGTH + 0.25*LOW_VOL + 0.25*CMD_MOMENTUM_12M + 0.25*CMD_REAL_RATE',
    },
    ironRules: {
      oneLiner: '股债商品黄金四维配置→穿越牛熊周期',
      stopLossRule: '组合整体-15%止损；单一资产类别-25%减半仓位',
      marketScope: 'US股票+国债+COMEX黄金+商品期货（多元资产组合）',
      failureCheck: '股债相关性持续>0.3（失去对冲效果）时降低债券权重；实际利率急升>200bp降金',
    },
    aiTriggers: crossTriggers('全天候'),
    applicable: ['Multi-Asset', 'US Markets', 'Commodities'],
    tags: ['all-weather', 'Bridgewater', 'multi-asset', 'defensive'],
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.30, maxPosition: 0.20 },
    timeframe: ['1w', '1mo'],
    popularityScore: 88,
    winRate: 0.60,
    sharpe: 1.05,
    matchesKeyword(kw: string): boolean { return ['全天候', 'all weather', '桥水'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 风险平价 — LOW_VOL + CMD_VOLATILITY + TREND_STRENGTH + DIV_YIELD
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-risk-parity',
    name: 'Risk Parity',
    nameCN: '风险平价',
    category: 'multi_asset',
    riskLevel: 'medium',
    description: '波动率倒数加权：每类资产波动率越低权重越高，目标各资产风险贡献均等',
    oneLiner: '波动率倒数加权→各资产风险均等→更稳穿越周期',
    version: 1,
    marketTags: ['US', 'HK', 'COMMODITY', 'EU'] as MarketTag[],
    factorCombo: {
      factorIds: ['LOW_VOL', 'CMD_VOLATILITY', 'TREND_STRENGTH', 'DIV_YIELD'],
      weights: [0.35, 0.25, 0.20, 0.20],
      formula: '0.35*LOW_VOL + 0.25*CMD_VOLATILITY + 0.20*TREND_STRENGTH + 0.20*DIV_YIELD',
    },
    ironRules: {
      oneLiner: '波动率倒数加权→各资产风险均等→更稳穿越周期',
      stopLossRule: '单一资产-20%止损重整权重；总组合-12%降杠杆',
      marketScope: 'US+HK股票（低波优先）+长期国债+黄金+商品ETF',
      failureCheck: '多类资产波动率同时飙升（相关性>0.7）时暂停重新配置',
    },
    aiTriggers: crossTriggers('风险平价'),
    applicable: ['Multi-Asset', 'Global'],
    tags: ['risk-parity', 'volatility', 'multi-asset', 'defensive'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.25, maxPosition: 0.15 },
    timeframe: ['1w', '1mo'],
    popularityScore: 82,
    winRate: 0.62,
    sharpe: 1.15,
    matchesKeyword(kw: string): boolean { return ['风险平价', 'risk parity', '波动率'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 全球配置 — MOM_60 + TREND_STRENGTH + CMD_DXY_LINKAGE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-global-allocation',
    name: 'Global Asset Allocation',
    nameCN: '全球配置',
    category: 'multi_asset',
    riskLevel: 'medium',
    description: '全球五大市场动量轮动：US/HK/EU/JP/EM每月选Top2市场超配',
    oneLiner: '五市场月度动量轮动→Top2超配→全球分散',
    version: 1,
    marketTags: ['US', 'HK', 'EU', 'JP', 'IN'] as MarketTag[],
    factorCombo: {
      factorIds: ['MOM_60', 'TREND_STRENGTH', 'CMD_DXY_LINKAGE'],
      weights: [0.40, 0.35, 0.25],
      formula: '0.40*MOM_60 + 0.35*TREND_STRENGTH + 0.25*CMD_DXY_LINKAGE',
    },
    ironRules: {
      oneLiner: '五市场月度动量轮动→Top2超配→全球分散',
      stopLossRule: '单市场-15%平仓该市场仓位；总组合-12%降仓50%',
      marketScope: 'US🇺🇸 HK🇭🇰 EU🇪🇺 JP🇯🇵 IN🇮🇳 五大市场指数ETF',
      failureCheck: 'DXY单月波动>5%暂停调仓；全球市场相关性>0.8（系统性风险）降仓至50%',
    },
    aiTriggers: crossTriggers('全球配置'),
    applicable: ['Global', 'Multi-Market', 'ETF'],
    tags: ['global', 'allocation', 'rotation', 'multi-market'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.25, maxPosition: 0.15 },
    timeframe: ['1w', '1mo'],
    popularityScore: 78,
    winRate: 0.58,
    sharpe: 0.92,
    matchesKeyword(kw: string): boolean { return ['全球', 'global', '配置', 'allocation'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 多资产 — TREND_STRENGTH + VAL_BP + CMD_MOMENTUM_12M + FUNDING_RATE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-multi-asset',
    name: 'Multi-Asset Composite',
    nameCN: '多资产',
    category: 'multi_asset',
    riskLevel: 'medium',
    description: '股+债+商品+加密+现金五类资产动态配置，基于动量+价值+资金费率三信号',
    oneLiner: '股债商品加密现金→五类动态配置→分散风险',
    version: 1,
    marketTags: ['US', 'COMMODITY', 'CRYPTO'] as MarketTag[],
    factorCombo: {
      factorIds: ['TREND_STRENGTH', 'VAL_BP', 'CMD_MOMENTUM_12M', 'FUNDING_RATE'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*TREND_STRENGTH + 0.25*VAL_BP + 0.25*CMD_MOMENTUM_12M + 0.20*FUNDING_RATE',
    },
    ironRules: {
      oneLiner: '股债商品加密现金→五类动态配置→分散风险',
      stopLossRule: '加密仓位-25%止损；商品-15%；股票-10%；总组合-15%避险至现金',
      marketScope: 'US股票+美国国债+商品期货+加密货币（BTC/ETH）+USD现金',
      failureCheck: '加密资金费率连续负值+加密市值<1T（山寨季结束）→加密降至0%',
    },
    aiTriggers: crossTriggers('多资产'),
    applicable: ['Multi-Asset', 'Global', 'Crypto'],
    tags: ['multi-asset', 'crypto', 'commodity', 'allocation'],
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.35, maxPosition: 0.12 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 75,
    winRate: 0.56,
    sharpe: 0.88,
    matchesKeyword(kw: string): boolean { return ['多资产', 'multi asset', 'crypto', 'diversified'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 5. 尾部对冲 — LOW_VOL + CMD_GEOPOL_RISK + TREND_STRENGTH + DIV_YIELD
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-tail-hedge',
    name: 'Tail Risk Hedger',
    nameCN: '尾部对冲',
    category: 'hedge',
    riskLevel: 'high',
    description: '黑天鹅防护：长期OTM Put期权+VIX期货+TIPS国债+防御股组合',
    oneLiner: 'Put+VIX+国债+防御股→黑天鹅防护',
    version: 1,
    marketTags: ['US', 'COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['LOW_VOL', 'CMD_GEOPOL_RISK', 'TREND_STRENGTH', 'DIV_YIELD'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*LOW_VOL + 0.25*CMD_GEOPOL_RISK + 0.25*TREND_STRENGTH + 0.20*DIV_YIELD',
    },
    ironRules: {
      oneLiner: 'Put+VIX+国债+防御股→黑天鹅防护',
      stopLossRule: '对冲成本超组合3%/月时降对冲仓位；黑天鹅未发生则期权到期自动平仓',
      marketScope: 'US防御股+TLT长期国债+VIX期货+OTM Put期权',
      failureCheck: 'VIX<15且GPR<80持续1月→对冲性价比低，降至50%对冲',
    },
    aiTriggers: crossTriggers('尾部对冲', {
      type: 'ALT_DATA', nameCN: '替代数据', nameEN: 'Alt Data', priceUSDT: 2,
      descriptionCN: '解锁VIX期货期限结构+SKEW指数数据', descriptionEN: 'Unlock VIX futures term structure + SKEW index',
      targetParams: ['altData'],
    }),
    applicable: ['Hedge', 'US Markets', 'Options'],
    tags: ['tail-risk', 'hedge', 'black-swan', 'options', 'VIX'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.50, maxPosition: 0.10 },
    timeframe: ['1w', '1mo'],
    popularityScore: 70,
    winRate: 0.50,
    sharpe: 0.65,
    matchesKeyword(kw: string): boolean { return ['尾部', 'tail', 'hedge', '黑天鹅', '对冲'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 6. 跨市场套利 — CMD_BASIS + CMD_GOLD_SILVER_RATIO + CMD_CRACK_SPREAD
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-spread-arb',
    name: 'Cross-Market Spread Arbitrage',
    nameCN: '跨市场套利',
    category: 'arbitrage',
    riskLevel: 'low',
    description: '多市场价差套利：AH溢价+ADR折价+金银比+裂解价差四套利策略并行',
    oneLiner: 'AH+ADR+金银比+裂解价差→四套利并行→低相关收益',
    version: 1,
    marketTags: ['US', 'HK', 'COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_BASIS', 'CMD_GOLD_SILVER_RATIO', 'CMD_CRACK_SPREAD'],
      weights: [0.35, 0.35, 0.30],
      formula: '0.35*CMD_BASIS + 0.35*CMD_GOLD_SILVER_RATIO + 0.30*CMD_CRACK_SPREAD',
    },
    ironRules: {
      oneLiner: 'AH+ADR+金银比+裂解价差→四套利并行→低相关收益',
      stopLossRule: '单套利-5%止损；价差突破历史2σ平仓',
      marketScope: 'AH溢价(🇨🇳+🇭🇰)+ADR折价(🇭🇰+🇺🇸)+金银比(GC+SI)+裂解价差(CL+RB+HO)',
      failureCheck: '连续2月套利收益<资金成本（年化<3%）时暂停',
    },
    aiTriggers: crossTriggers('跨市场套利'),
    applicable: ['Arbitrage', 'Cross-Market', 'Commodities'],
    tags: ['arbitrage', 'spread', 'cross-market', 'AH', 'ADR'],
    risk: { defaultStopLoss: 0.05, defaultTakeProfit: 0.12, maxPosition: 0.15 },
    timeframe: ['1d', '1w'],
    popularityScore: 72,
    winRate: 0.65,
    sharpe: 1.30,
    matchesKeyword(kw: string): boolean { return ['套利', 'arbitrage', 'spread', '跨市场'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 7. 通胀护盾 — CMD_REAL_RATE + CMD_INFLATION_BE + CMD_GOLD_ETF + DIV_GROWTH
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-inflation-shield',
    name: 'Inflation Shield',
    nameCN: '通胀护盾',
    category: 'multi_asset',
    riskLevel: 'low',
    description: '高通胀防御组合：TIPS国债+COMEX黄金+商品期货+REITs+股息增长股',
    oneLiner: 'TIPS+黄金+商品+REITs→通胀来了也不怕',
    version: 1,
    marketTags: ['US', 'COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_REAL_RATE', 'CMD_INFLATION_BE', 'CMD_GOLD_ETF', 'DIV_GROWTH'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*CMD_REAL_RATE + 0.25*CMD_INFLATION_BE + 0.25*CMD_GOLD_ETF + 0.20*DIV_GROWTH',
    },
    ironRules: {
      oneLiner: 'TIPS+黄金+商品+REITs→通胀来了也不怕',
      stopLossRule: '-8%止损；CPI连续3月回落+实际利率转正则降仓50%',
      marketScope: 'US TIPS+COMEX黄金+商品指数+REITs ETF+股息增长股',
      failureCheck: '通胀预期BEIR<2%持续2月时降TIPS+黄金仓位，切换至成长配置',
    },
    aiTriggers: crossTriggers('通胀护盾'),
    applicable: ['Multi-Asset', 'Inflation', 'Commodities'],
    tags: ['inflation', 'TIPS', 'gold', 'commodity', 'REITs'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.12 },
    timeframe: ['1w', '1mo'],
    popularityScore: 80,
    winRate: 0.58,
    sharpe: 0.95,
    matchesKeyword(kw: string): boolean { return ['通胀', 'inflation', 'TIPS', 'shield'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 8. 衰退碉堡 — CMD_REAL_RATE + CMD_GEOPOL_RISK + LOW_VOL + DIV_YIELD
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cross-recession-bunker',
    name: 'Recession Bunker',
    nameCN: '衰退碉堡',
    category: 'defensive',
    riskLevel: 'low',
    description: '经济衰退防护：长期国债+黄金+防御股+现金，利率下降+避险需求驱动',
    oneLiner: '国债+黄金+防御股+现金→衰退来了保本金',
    version: 1,
    marketTags: ['US', 'COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_REAL_RATE', 'CMD_GEOPOL_RISK', 'LOW_VOL', 'DIV_YIELD'],
      weights: [0.30, 0.20, 0.25, 0.25],
      formula: '0.30*CMD_REAL_RATE + 0.20*CMD_GEOPOL_RISK + 0.25*LOW_VOL + 0.25*DIV_YIELD',
    },
    ironRules: {
      oneLiner: '国债+黄金+防御股+现金→衰退来了保本金',
      stopLossRule: '总组合-8%止损；收益率曲线重新陡峭化(2Y-10Y>0)时逐步退出国债仓位',
      marketScope: 'US长期国债(TLT)+COMEX黄金+US防御股（公用事业/消费/医疗）+USD现金',
      failureCheck: 'NBER未宣布衰退但GDP连续2季>2%时暂停策略',
    },
    aiTriggers: crossTriggers('衰退碉堡'),
    applicable: ['Multi-Asset', 'Recession', 'Defensive'],
    tags: ['recession', 'defensive', 'treasury', 'gold', 'safe-haven'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.15 },
    timeframe: ['1w', '1mo', '3mo'],
    popularityScore: 78,
    winRate: 0.55,
    sharpe: 0.82,
    matchesKeyword(kw: string): boolean { return ['衰退', 'recession', 'bunker', '防守'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default CROSS_MARKET_TEMPLATES;
