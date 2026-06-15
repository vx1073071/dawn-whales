/**
 * template-definitions-commodity.ts — R205 J1: 商品期货6策略模板
 *
 * 6 commodity futures templates with 四铁律 + 3-5 AI trigger points:
 *   1. COT_SMART_MONEY     — COT聪明钱: 跟随商业持仓(COT Commercial)
 *   2. BASIS_HUNTER        — 基差猎人: 期货基差收敛套利
 *   3. ROLL_HARVESTER      — 展期收割: 期限结构展期收益
 *   4. INVENTORY_CYCLE     — 库存周期: EIA+LME库存驱动
 *   5. GOLD_SILVER_RATIO   — 金银比: 金银比价均值回归
 *   6. REAL_RATE_GOLD      — 实际利率黄金: TIPS实际利率→金价
 *
 * Register with: templateRegistry.registerAll() in init.
 */

import { StrategyTemplate, MarketTag, AITriggerPoint } from './TemplateEngine';

// ── Commodity AI trigger builder ──────────────────────────────────────────

function commTriggers(name: string): AITriggerPoint[] {
  return [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + name + '历史回测与展期影响', descriptionEN: 'AI analyzes ' + name + ' backtest and roll impact',
      targetParams: ['contractMonth'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI优化' + name + '品种选择与仓位分配', descriptionEN: 'AI optimizes ' + name + ' instrument selection and sizing',
      targetParams: ['instruments', 'positionPct'] },
    { type: 'ALT_DATA', nameCN: '替代数据', nameEN: 'Alt Data', priceUSDT: 2,
      descriptionCN: '解锁CFTC/EIA/LME实时数据+历史库存', descriptionEN: 'Unlock real-time CFTC/EIA/LME data + historical inventory',
      targetParams: ['altData'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: '诊断' + name + '因子IC与展期成本', descriptionEN: 'Diagnose ' + name + ' factor IC and roll costs',
      targetParams: ['factorIds'] },
  ];
}

// ── 6 Commodity Templates ─────────────────────────────────────────────────

const COMMODITY_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. COT聪明钱 — CMD_COT_COMMERCIAL + CMD_COT_SPECULATOR + CMD_MOMENTUM_1M
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-cot-smart-money',
    name: 'COT Smart Money',
    nameCN: 'COT聪明钱',
    category: 'commodity',
    riskLevel: 'medium',
    description: '跟随CFTC商业持仓：商业净多>历史80分位做多，商业净空>80分位做空，投机仓位反向确认',
    oneLiner: '商业持仓极端→反向操作→跟随聪明钱',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_COT_COMMERCIAL', 'CMD_COT_SPECULATOR', 'CMD_MOMENTUM_1M'],
      weights: [0.45, 0.30, 0.25],
      formula: '0.45*CMD_COT_COMMERCIAL + 0.30*CMD_COT_SPECULATOR + 0.25*CMD_MOMENTUM_1M',
    },
    ironRules: {
      oneLiner: '商业持仓极端→反向操作→跟随聪明钱',
      stopLossRule: '浮亏-12%止损；COT数据周五发布后48h内未回归则平仓',
      marketScope: '🛢️商品期货：原油/黄金/铜/大豆/天然气/玉米(有CFTC报告的品种)',
      failureCheck: 'COT商业净多/净空连续4周从极端回归均值时退出；品种持仓量<100K手时避让',
    },
    aiTriggers: commTriggers('COT聪明钱'),
    applicable: ['Commodity Futures', 'COT Report'],
    tags: ['COT', 'smart-money', 'commercial', 'futures', 'commodity'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.25, maxPosition: 0.12 },
    timeframe: ['1d', '1w'],
    popularityScore: 76,
    winRate: 0.60,
    sharpe: 1.10,
    matchesKeyword(kw: string): boolean { return ['cot', '聪明钱', 'smart money', '商业持仓'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 基差猎人 — CMD_BASIS + CMD_ROLL_YIELD + CMD_TERM_STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-basis-hunter',
    name: 'Basis Convergence Hunter',
    nameCN: '基差猎人',
    category: 'commodity',
    riskLevel: 'medium',
    description: '现货升水/贴水极端→基差收敛套利：近月贴水>5%做多，近月升水>5%做空',
    oneLiner: '近月贴水>5%做多/升水>5%做空→到期收敛',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_BASIS', 'CMD_ROLL_YIELD', 'CMD_TERM_STRUCTURE'],
      weights: [0.40, 0.35, 0.25],
      formula: '0.40*CMD_BASIS + 0.35*CMD_ROLL_YIELD + 0.25*CMD_TERM_STRUCTURE',
    },
    ironRules: {
      oneLiner: '近月贴水>5%做多/升水>5%做空→到期收敛',
      stopLossRule: '-8%止损；展期前2周未收敛则平仓换月',
      marketScope: '🛢️商品期货：原油/铜/黄金/天然气/农产品',
      failureCheck: '连续3个月近远月价差不收敛、仓储成本异常变化时停止',
    },
    aiTriggers: commTriggers('基差猎人'),
    applicable: ['Commodity Futures', 'Arbitrage'],
    tags: ['basis', 'arbitrage', 'convergence', 'futures', 'commodity'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.15, maxPosition: 0.15 },
    timeframe: ['1d', '1w'],
    popularityScore: 70,
    winRate: 0.64,
    sharpe: 1.25,
    matchesKeyword(kw: string): boolean { return ['基差', 'basis', 'convergence', '升水', '贴水'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 展期收割 — CMD_ROLL_YIELD + CMD_TERM_STRUCTURE + CMD_MOMENTUM_12M
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-roll-harvester',
    name: 'Roll Yield Harvester',
    nameCN: '展期收割',
    category: 'commodity',
    riskLevel: 'low',
    description: 'backwardation品种展期正收益：选择展期收益率最高3个品种，每月展期收割roll yield',
    oneLiner: '展期收益率Top3→月度滚动→收割backwardation溢价',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_ROLL_YIELD', 'CMD_TERM_STRUCTURE', 'CMD_MOMENTUM_12M'],
      weights: [0.40, 0.35, 0.25],
      formula: '0.40*CMD_ROLL_YIELD + 0.35*CMD_TERM_STRUCTURE + 0.25*CMD_MOMENTUM_12M',
    },
    ironRules: {
      oneLiner: '展期收益率Top3→月度滚动→收割backwardation溢价',
      stopLossRule: '单品种-10%止损；展期收益率转负立即退出',
      marketScope: '🛢️商品期货：原油/铜/天然气/黄金(backwardation品种优先)',
      failureCheck: '市场转contango(升水)且展期收益率连续负值时停止',
    },
    aiTriggers: commTriggers('展期收割'),
    applicable: ['Commodity Futures', 'Carry Trade'],
    tags: ['roll-yield', 'backwardation', 'carry', 'futures', 'commodity'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.20, maxPosition: 0.12 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 68,
    winRate: 0.62,
    sharpe: 1.18,
    matchesKeyword(kw: string): boolean { return ['展期', 'roll', 'backwardation', 'carry'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 库存周期 — CMD_EIA_CRUDE + CMD_NATGAS_STORAGE + CMD_LME_INVENTORY
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-inventory-cycle',
    name: 'Inventory Cycle Trader',
    nameCN: '库存周期',
    category: 'commodity',
    riskLevel: 'medium',
    description: 'EIA+LME库存驱动：库存低于5年均值做多，高于5年均值做空，结合季节性',
    oneLiner: '库存vs5年均值→低于做多/高于做空→季节性校准',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_EIA_CRUDE', 'CMD_NATGAS_STORAGE', 'CMD_LME_INVENTORY', 'CMD_SEASONALITY'],
      weights: [0.30, 0.20, 0.25, 0.25],
      formula: '0.30*CMD_EIA_CRUDE + 0.20*CMD_NATGAS_STORAGE + 0.25*CMD_LME_INVENTORY + 0.25*CMD_SEASONALITY',
    },
    ironRules: {
      oneLiner: '库存vs5年均值→低于做多/高于做空→季节性校准',
      stopLossRule: '-10%止损；库存数据周报发布后反转立即平50%仓位',
      marketScope: '🛢️能源+金属：原油(EIA)/天然气(EIA)/铜(LME)/铝(LME)/镍(LME)/锌(LME)',
      failureCheck: '库存数据连续8周无趋势(0.8~1.2倍5年均值)时暂停；存储成本异常时退出',
    },
    aiTriggers: commTriggers('库存周期'),
    applicable: ['Commodity Futures', 'Energy', 'Metals'],
    tags: ['inventory', 'EIA', 'LME', 'seasonal', 'commodity'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.22, maxPosition: 0.10 },
    timeframe: ['1w', '1mo'],
    popularityScore: 72,
    winRate: 0.58,
    sharpe: 0.95,
    matchesKeyword(kw: string): boolean { return ['库存', 'inventory', 'EIA', 'LME'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 5. 金银比 — CMD_GOLD_SILVER_RATIO + CMD_OPEN_INTEREST + CMD_VOLATILITY
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-gold-silver-ratio',
    name: 'Gold-Silver Ratio Mean Reversion',
    nameCN: '金银比',
    category: 'commodity',
    riskLevel: 'low',
    description: '金/银比值均值回归：>85买银卖金(看涨银)，<70买金卖银(看涨金)，历史上限90/下限50',
    oneLiner: '金银比>85买银卖金/<70买金卖银→均值回归',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_GOLD_SILVER_RATIO', 'CMD_OPEN_INTEREST', 'CMD_VOLATILITY'],
      weights: [0.50, 0.25, 0.25],
      formula: '0.50*CMD_GOLD_SILVER_RATIO + 0.25*CMD_OPEN_INTEREST + 0.25*CMD_VOLATILITY',
    },
    ironRules: {
      oneLiner: '金银比>85买银卖金/<70买金卖银→均值回归',
      stopLossRule: '止损-8%；比值突破历史极值(>100或<45)平仓观望',
      marketScope: '🛢️贵金属：COMEX黄金+白银期货 (GC+SI)',
      failureCheck: '比值连续6月单向运行(不回均值)时暂停；COMEX持仓量<历史50%时避让',
    },
    aiTriggers: commTriggers('金银比'),
    applicable: ['Commodity Futures', 'Precious Metals'],
    tags: ['gold-silver', 'mean-reversion', 'ratio', 'precious', 'commodity'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.18, maxPosition: 0.15 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 82,
    winRate: 0.68,
    sharpe: 1.35,
    matchesKeyword(kw: string): boolean { return ['金银比', 'gold silver', 'ratio', '贵金属'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 6. 实际利率黄金 — CMD_REAL_RATE + CMD_GOLD_ETF + CMD_DXY_LINKAGE + CMD_GEOPOL_RISK
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-real-rate-gold',
    name: 'Real Rate Gold Trader',
    nameCN: '实际利率黄金',
    category: 'commodity',
    riskLevel: 'low',
    description: 'TIPS实际利率↓→黄金↑：实际利率+GLD持仓+DXY+地缘四因子驱动金价',
    oneLiner: '实际利率↓+GLD↑+美元↓+地缘↑→做多黄金',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_REAL_RATE', 'CMD_GOLD_ETF', 'CMD_DXY_LINKAGE', 'CMD_GEOPOL_RISK'],
      weights: [0.35, 0.25, 0.20, 0.20],
      formula: '0.35*CMD_REAL_RATE + 0.25*CMD_GOLD_ETF + 0.20*CMD_DXY_LINKAGE + 0.20*CMD_GEOPOL_RISK',
    },
    ironRules: {
      oneLiner: '实际利率↓+GLD↑+美元↓+地缘↑→做多黄金',
      stopLossRule: '-8%止损；实际利率连续2周反弹超20bp止盈50%仓位',
      marketScope: '🛢️贵金属：COMEX黄金(GC)/GLD ETF/上海金',
      failureCheck: '实际利率与金价相关性连续2月<0.3(弱相关)时停止；美联储转向鹰派时降仓50%',
    },
    aiTriggers: commTriggers('实际利率黄金'),
    applicable: ['Commodity Futures', 'Gold', 'ETF'],
    tags: ['gold', 'real-rate', 'TIPS', 'DXY', 'geopolitical', 'commodity'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.15 },
    timeframe: ['1d', '1w'],
    popularityScore: 85,
    winRate: 0.65,
    sharpe: 1.28,
    matchesKeyword(kw: string): boolean { return ['实际利率', 'real rate', 'gold', '黄金', 'geopolitical'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default COMMODITY_TEMPLATES;
