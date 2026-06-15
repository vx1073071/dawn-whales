/**
 * template-definitions-us-v2.ts — R206 J2: 美股补充5策略模板
 *
 * 5 additional US equity templates:
 *   1. SMALL_CAP_VALUE     — 小盘价值: Russell 2000 小盘+价值+动量
 *   2. LARGE_CAP_GROWTH    — 大盘成长: S&P500 Top50成长+机构+动量
 *   3. COVERED_CALL        — 备兑期权覆盖: 持有股票+卖出OTM Call收权利金
 *   4. DIVIDEND_ARISTOCRAT — 分红贵族: 连续25年+股息增长+低波+ROE
 *   5. ESG_LEADER          — ESG领袖: ESG评分+MOM+ROE+DIV组合
 *
 * Register with templateRegistry.registerAll().
 */

import { StrategyTemplate, MarketTag, AITriggerPoint } from './TemplateEngine';

// ── AI trigger builder ────────────────────────────────────────────────────

function usTrigger(name: string, extra?: AITriggerPoint): AITriggerPoint[] {
  const base: AITriggerPoint[] = [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + name + '历史回测', descriptionEN: 'AI analyzes ' + name + ' backtest',
      targetParams: ['lookback'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI优化' + name + '筛选条件与持仓', descriptionEN: 'AI optimizes ' + name + ' filters and positions',
      targetParams: ['universeSize', 'maxPosition'] },
    { type: 'PARAM_FILL', nameCN: '参数填充', nameEN: 'Auto Param Fill', priceUSDT: 1,
      descriptionCN: '根据市场环境智能推荐' + name + '参数', descriptionEN: 'AI recommends ' + name + ' params',
      targetParams: ['entryThreshold'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: '诊断' + name + '因子IC及拥挤度', descriptionEN: 'Diagnose ' + name + ' factor ICs',
      targetParams: ['factorIds'] },
  ];
  if (extra) base.push(extra);
  return base;
}

// ── 5 US Extra Templates ──────────────────────────────────────────────────

const US_V2_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 小盘价值 — SIZE_SMALL + VAL_BP + VAL_EP + MOM_60 + TURNOVER
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-small-cap-value',
    name: 'Small-Cap Deep Value',
    nameCN: '小盘价值',
    category: 'value',
    description: 'Russell 2000小盘价值挖矿：小市值+低PB+低PE+60日动量+换手率五因子',
    oneLiner: 'Russell小盘+低估值+动量为王→50只精选',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['SIZE_SMALL', 'VAL_BP', 'VAL_EP', 'MOM_60', 'TURNOVER'],
      weights: [0.20, 0.25, 0.20, 0.20, 0.15],
      formula: '0.20*SIZE_SMALL + 0.25*VAL_BP + 0.20*VAL_EP + 0.20*MOM_60 + 0.15*TURNOVER',
    },
    ironRules: {
      oneLiner: 'Russell小盘+低估值+动量为王→50只精选',
      stopLossRule: '单只-15%止损（小盘波动大）；组合-20%清仓',
      marketScope: 'US Russell 2000成分股，市值500M-10B，PB<行业均值50分位',
      failureCheck: 'Russell 2000跑输S&P500连续3月时暂停；小盘流动性危机时避让',
    },
    aiTriggers: usTrigger('小盘价值'),
    applicable: ['US Stocks', 'Small-Cap', 'Value'],
    tags: ['small-cap', 'value', 'Russell', 'deep-value', 'US'],
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.35, maxPosition: 0.05 },
    timeframe: ['1w', '1mo'],
    popularityScore: 68,
    winRate: 0.55,
    sharpe: 0.85,
    matchesKeyword(kw: string): boolean { return ['小盘', 'small cap', 'russell', '微型'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 大盘成长 — SIZE_LARGE + TREND_STRENGTH + MOM_20 + INST_OWNER + SURPRISE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-large-cap-growth',
    name: 'Large-Cap Growth Leaders',
    nameCN: '大盘成长',
    category: 'growth',
    description: 'S&P500 Top50成长精选：大市值+趋势+动量+机构+财报五因子选出成长龙头',
    oneLiner: 'S&P500 Top50成长+动量+机构→精选龙头',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['SIZE_LARGE', 'TREND_STRENGTH', 'MOM_20', 'INST_OWNER', 'SURPRISE'],
      weights: [0.20, 0.25, 0.25, 0.15, 0.15],
      formula: '0.20*SIZE_LARGE + 0.25*TREND_STRENGTH + 0.25*MOM_20 + 0.15*INST_OWNER + 0.15*SURPRISE',
    },
    ironRules: {
      oneLiner: 'S&P500 Top50成长+动量+机构→精选龙头',
      stopLossRule: '单只-10%止损；成长板块整体-15%减半仓',
      marketScope: 'US S&P500 Top50 by market cap，聚焦科技/消费/医疗成长板块',
      failureCheck: '成长vs价值风格指数连续跑输2月时降仓50%',
    },
    aiTriggers: usTrigger('大盘成长'),
    applicable: ['US Stocks', 'Large-Cap', 'Growth'],
    tags: ['large-cap', 'growth', 'S&P500', 'leaders', 'US'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.25, maxPosition: 0.12 },
    timeframe: ['1d', '1w'],
    popularityScore: 85,
    winRate: 0.64,
    sharpe: 1.22,
    matchesKeyword(kw: string): boolean { return ['大盘', 'large cap', 'growth', '龙头', 'sp500'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 备兑期权覆盖 — LOW_VOL + DIV_YIELD + SIZE_LARGE + QUAL_ROE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-covered-call',
    name: 'Covered Call Income',
    nameCN: '备兑期权覆盖',
    category: 'income',
    description: '持有优质股票+每月卖出OTM Call收权利金：月化1-2%额外收益，降低持仓成本',
    oneLiner: '持有股票+卖Call收权利金→月化+1-2%增强收益',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['LOW_VOL', 'DIV_YIELD', 'SIZE_LARGE', 'QUAL_ROE'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*LOW_VOL + 0.25*DIV_YIELD + 0.25*SIZE_LARGE + 0.20*QUAL_ROE',
    },
    ironRules: {
      oneLiner: '持有股票+卖Call收权利金→月化+1-2%增强收益',
      stopLossRule: '标的跌破行权价-10%止损（避免被行权亏损扩大）',
      marketScope: 'US个股+ETF（有期权链），市值>20B，IV>20%以提高权利金收入',
      failureCheck: 'VIX<12（权利金过低<0.5%/月）或标的IV percentile<30时暂停',
    },
    aiTriggers: usTrigger('备兑期权', {
      type: 'ALT_DATA', nameCN: '替代数据', nameEN: 'Alt Data', priceUSDT: 2,
      descriptionCN: '解锁期权IV曲面+skew+put/call比率', descriptionEN: 'Unlock options IV surface + skew + put/call ratio',
      targetParams: ['altData'],
    }),
    applicable: ['US Stocks', 'Options', 'Income'],
    tags: ['covered-call', 'options', 'income', 'dividend', 'US'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.18, maxPosition: 0.10 },
    timeframe: ['1w', '1mo'],
    popularityScore: 74,
    winRate: 0.60,
    sharpe: 1.05,
    matchesKeyword(kw: string): boolean { return ['备兑', 'covered call', '期权', '权利金', 'income'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 分红贵族 — DIV_YIELD + DIV_GROWTH + QUAL_ROE + LOW_VOL + SIZE_LARGE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-dividend-aristocrat',
    name: 'Dividend Aristocrats',
    nameCN: '分红贵族',
    category: 'income',
    description: '连续25年+提高股息标的：股息率+股息增长+ROE+低波+大市值五因子',
    oneLiner: '25年连增股息+ROE+低波→分红复利机器',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['DIV_YIELD', 'DIV_GROWTH', 'QUAL_ROE', 'LOW_VOL', 'SIZE_LARGE'],
      weights: [0.25, 0.25, 0.20, 0.15, 0.15],
      formula: '0.25*DIV_YIELD + 0.25*DIV_GROWTH + 0.20*QUAL_ROE + 0.15*LOW_VOL + 0.15*SIZE_LARGE',
    },
    ironRules: {
      oneLiner: '25年连增股息+ROE+低波→分红复利机器',
      stopLossRule: '股息削减>10%立即平仓；单只-12%止损',
      marketScope: 'US S&P 500 Dividend Aristocrats指数成分股（连续25年+提高股息）',
      failureCheck: '板块平均股息率<2%或利率急升（10Y+100bp/季）时降仓50%',
    },
    aiTriggers: usTrigger('分红贵族'),
    applicable: ['US Stocks', 'Dividend', 'Large-Cap'],
    tags: ['dividend', 'aristocrat', 'income', 'defensive', 'US'],
    risk: { defaultStopLoss: 0.12, defaultTakeProfit: 0.20, maxPosition: 0.08 },
    timeframe: ['1mo', '3mo'],
    popularityScore: 82,
    winRate: 0.62,
    sharpe: 0.98,
    matchesKeyword(kw: string): boolean { return ['分红', 'dividend', 'aristocrat', '股息', '贵族'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 5. ESG领袖 — SURPRISE + QUAL_ROE + MOM_60 + DIV_GROWTH + INST_OWNER
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-esg-leader',
    name: 'ESG Leaders',
    nameCN: 'ESG领袖',
    category: 'growth',
    description: 'ESG高评分+高ROE+动量+股息增长+机构持仓：可持续成长组合',
    oneLiner: 'ESG高分+高ROE+动量→可持续成长',
    version: 1,
    marketTags: ['US', 'EU'] as MarketTag[],
    factorCombo: {
      factorIds: ['SURPRISE', 'QUAL_ROE', 'MOM_60', 'DIV_GROWTH', 'INST_OWNER'],
      weights: [0.15, 0.25, 0.25, 0.15, 0.20],
      formula: '0.15*SURPRISE + 0.25*QUAL_ROE + 0.25*MOM_60 + 0.15*DIV_GROWTH + 0.20*INST_OWNER',
    },
    ironRules: {
      oneLiner: 'ESG高分+高ROE+动量→可持续成长',
      stopLossRule: '-10%止损；ESG评级下调>1级立即平仓',
      marketScope: 'US+EU MSCI ESG Leaders指数成分股，ESG评级AA以上',
      failureCheck: 'ESG板块跑输大盘连续2季时暂停；反ESG政策风险时降仓',
    },
    aiTriggers: usTrigger('ESG领袖'),
    applicable: ['US Stocks', 'EU Stocks', 'ESG'],
    tags: ['ESG', 'sustainable', 'growth', 'quality', 'US', 'EU'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.20, maxPosition: 0.08 },
    timeframe: ['1w', '1mo'],
    popularityScore: 72,
    winRate: 0.56,
    sharpe: 0.90,
    matchesKeyword(kw: string): boolean { return ['esg', '可持续', 'sustainable', 'green'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default US_V2_TEMPLATES;
