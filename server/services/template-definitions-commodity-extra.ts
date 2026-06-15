/**
 * template-definitions-commodity-extra.ts — R207 J2: 商品补充3策略模板
 *
 * 3 additional commodity futures templates:
 *   1. CRUDE_OIL_TREND     — 原油趋势: EIA库存+裂解价差+地缘风险
 *   2. AGRI_SEASONAL       — 农产品季节性: 种植/生长/收获季+天气
 *   3. COPPER_CYCLE        — 铜周期: LME库存+中国PMI+美元
 *
 * Register with templateRegistry.registerAll().
 */

import { StrategyTemplate, MarketTag, AITriggerPoint } from './TemplateEngine';

function commT(name: string): AITriggerPoint[] {
  return [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + name + '历史回测与季节性', descriptionEN: 'AI analyzes ' + name + ' backtest and seasonality',
      targetParams: ['contractMonth'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI优化' + name + '品种选择与仓位分配', descriptionEN: 'AI optimizes ' + name + ' instrument selection',
      targetParams: ['instruments'] },
    { type: 'ALT_DATA', nameCN: '替代数据', nameEN: 'Alt Data', priceUSDT: 2,
      descriptionCN: '解锁EIA/LME/天气/船运实时数据', descriptionEN: 'Unlock EIA/LME/weather/shipping real-time data',
      targetParams: ['altData'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: '诊断' + name + '因子IC', descriptionEN: 'Diagnose ' + name + ' factor ICs',
      targetParams: ['factorIds'] },
  ];
}

const COMMODITY_EXTRA_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 原油趋势 — CMD_EIA_CRUDE + CMD_CRACK_SPREAD + CMD_GEOPOL_RISK + CMD_MOMENTUM_1M
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-crude-oil-trend',
    name: 'Crude Oil Trend Follower',
    nameCN: '原油趋势',
    category: 'commodity',
    riskLevel: 'high',
    description: 'EIA库存变化+裂解价差+地缘风险+短期动量四维驱动原油策略',
    oneLiner: '库存↓+裂解↑+地缘紧张+动量→做多原油',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_EIA_CRUDE', 'CMD_CRACK_SPREAD', 'CMD_GEOPOL_RISK', 'CMD_MOMENTUM_1M'],
      weights: [0.30, 0.25, 0.20, 0.25],
      formula: '0.30*CMD_EIA_CRUDE + 0.25*CMD_CRACK_SPREAD + 0.20*CMD_GEOPOL_RISK + 0.25*CMD_MOMENTUM_1M',
    },
    ironRules: {
      oneLiner: '库存↓+裂解↑+地缘紧张+动量→做多原油',
      stopLossRule: '-12%止损；EIA库存意外大增>5M桶立即平仓',
      marketScope: 'NYMEX WTI(CL)+ICE Brent(CO)+RBOB汽油(RB)+取暖油(HO)',
      failureCheck: 'OPEC+增产宣布或战略储备释放时暂停；原油波动率<20%低位降仓',
    },
    aiTriggers: commT('原油趋势'),
    applicable: ['Commodity Futures', 'Energy'],
    tags: ['crude-oil', 'WTI', 'Brent', 'energy', 'commodity'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.30, maxPosition: 0.12 },
    timeframe: ['1d', '1w'],
    popularityScore: 82,
    winRate: 0.60,
    sharpe: 1.15,
    matchesKeyword(kw: string): boolean { return ['原油', 'crude', 'oil', 'wti', '能源'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 农产品季节性 — CMD_SEASONALITY + CMD_BASIS + CMD_NATGAS_STORAGE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-agri-seasonal',
    name: 'Agricultural Seasonal Cycle',
    nameCN: '农产品季节性',
    category: 'commodity',
    riskLevel: 'low',
    description: '种植→生长→收获三季轮动：玉米/大豆/小麦/棉花品种季节性波动捕捉',
    oneLiner: '种植季做多波动/收获季做空→季节轮动收割',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_SEASONALITY', 'CMD_BASIS', 'CMD_NATGAS_STORAGE'],
      weights: [0.40, 0.35, 0.25],
      formula: '0.40*CMD_SEASONALITY + 0.35*CMD_BASIS + 0.25*CMD_NATGAS_STORAGE',
    },
    ironRules: {
      oneLiner: '种植季做多波动/收获季做空→季节轮动收割',
      stopLossRule: '-10%止损；USDA报告超预期调整时快速平仓',
      marketScope: 'CBOT玉米(C)+大豆(S)+小麦(W)+ICE棉花(CT)+白糖(SB)',
      failureCheck: '厄尔尼诺/拉尼娜极端天气预警时降低仓位；USDA单次调整>10%时暂停至市场消化',
    },
    aiTriggers: commT('农产品季节性'),
    applicable: ['Commodity Futures', 'Agriculture'],
    tags: ['agriculture', 'seasonal', 'grain', 'softs', 'commodity'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.22, maxPosition: 0.10 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 66,
    winRate: 0.56,
    sharpe: 0.88,
    matchesKeyword(kw: string): boolean { return ['农产品', 'agriculture', '季节', 'grain', 'corn'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 铜周期 — CMD_LME_INVENTORY + CMD_DXY_LINKAGE + CMD_MOMENTUM_12M + CMD_INFLATION_BE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'cmd-copper-cycle',
    name: 'Copper Cycle Trader',
    nameCN: '铜周期',
    category: 'commodity',
    riskLevel: 'medium',
    description: '经济晴雨表：LME铜库存+美元+12月动量+通胀预期四维铜周期策略',
    oneLiner: 'LME库存↓+美元弱+通胀↑+动量→做多铜（经济复苏信号）',
    version: 1,
    marketTags: ['COMMODITY'] as MarketTag[],
    factorCombo: {
      factorIds: ['CMD_LME_INVENTORY', 'CMD_DXY_LINKAGE', 'CMD_MOMENTUM_12M', 'CMD_INFLATION_BE'],
      weights: [0.25, 0.25, 0.25, 0.25],
      formula: '0.25*CMD_LME_INVENTORY + 0.25*CMD_DXY_LINKAGE + 0.25*CMD_MOMENTUM_12M + 0.25*CMD_INFLATION_BE',
    },
    ironRules: {
      oneLiner: 'LME库存↓+美元弱+通胀↑+动量→做多铜（经济复苏信号）',
      stopLossRule: '-12%止损；中国PMI连续3月<50或LME铜库存单月+50%平仓',
      marketScope: 'LME铜(CA)+COMEX铜(HG)+SHFE铜，关注中国需求+全球基建',
      failureCheck: 'DXY单月涨>5%或全球PMI连降3月→铜需求面空，暂停策略',
    },
    aiTriggers: commT('铜周期'),
    applicable: ['Commodity Futures', 'Industrial Metals'],
    tags: ['copper', 'LME', 'industrial', 'cycle', 'commodity'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.28, maxPosition: 0.10 },
    timeframe: ['1d', '1w', '1mo'],
    popularityScore: 74,
    winRate: 0.58,
    sharpe: 1.02,
    matchesKeyword(kw: string): boolean { return ['铜', 'copper', '周期', 'LME', '工业'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default COMMODITY_EXTRA_TEMPLATES;
