/**
 * template-definitions-us-extra.ts — R205 J2: 美股补充3策略模板
 *
 * 3 additional US equity templates:
 *   1. TECH_MOMENTUM — 科技动能: 纳指科技板块动量轮动
 *   2. HEALTH_DEFENSE — 医疗防御: 医疗板块防御+创新管线
 *   3. CONSUMER_STAPLE — 消费稳健: 必选消费+股息增长
 *
 * Append to US_TEMPLATES array in template-definitions-us.ts for registration.
 */

import { StrategyTemplate, MarketTag, AITriggerPoint } from './TemplateEngine';

// ── AI trigger builder ────────────────────────────────────────────────────

function usExtraTriggers(name: string): AITriggerPoint[] {
  return [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + name + '历史回测与板块轮动', descriptionEN: 'AI analyzes ' + name + ' backtest and sector rotation',
      targetParams: ['lookback'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI优化' + name + '选股范围与持仓权重', descriptionEN: 'AI optimizes ' + name + ' stock selection and position weights',
      targetParams: ['universe', 'maxPosition'] },
    { type: 'PARAM_FILL', nameCN: '参数填充', nameEN: 'Auto Param Fill', priceUSDT: 1,
      descriptionCN: '根据当前板块轮动智能推荐' + name + '参数', descriptionEN: 'AI recommends ' + name + ' params based on sector rotation',
      targetParams: ['entryThreshold', 'momentumWindow'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: 'AI诊断' + name + '因子IC及拥挤度', descriptionEN: 'Diagnose ' + name + ' factor IC and crowding',
      targetParams: ['factorIds'] },
  ];
}

// ── 3 US Extra Templates ──────────────────────────────────────────────────

const US_EXTRA_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 科技动能 — TREND_STRENGTH + MOM_20 + VOL_BREAKOUT + INST_OWNER + SURPRISE
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-tech-momentum',
    name: 'Tech Sector Momentum',
    nameCN: '科技动能',
    category: 'momentum',
    riskLevel: 'high',
    description: '纳指100科技板块精选：趋势强度+20日动量+波动突破+机构持仓+财报意外五因子',
    oneLiner: '纳指科技Top10动量→月度调仓→强者恒强',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['TREND_STRENGTH', 'MOM_20', 'VOL_BREAKOUT', 'INST_OWNER', 'SURPRISE'],
      weights: [0.30, 0.25, 0.20, 0.15, 0.10],
      formula: '0.30*TREND_STRENGTH + 0.25*MOM_20 + 0.20*VOL_BREAKOUT + 0.15*INST_OWNER + 0.10*SURPRISE',
    },
    ironRules: {
      oneLiner: '纳指科技Top10动量→月度调仓→强者恒强',
      stopLossRule: '单只-10%止损，板块整体-15%减半仓；纳指跌破200日均线清仓',
      marketScope: '🇺🇸US科技股：纳指100成分股中科技板块(排除金融/地产)，市值>20B',
      failureCheck: '科技板块动量因子IC连续4周<0，或利率快速上升(10Y+50bp/月)降仓50%',
    },
    aiTriggers: usExtraTriggers('科技动能'),
    applicable: ['US Stocks', 'NASDAQ 100', 'Technology'],
    tags: ['tech', 'momentum', 'NASDAQ', 'sector', 'US'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.25, maxPosition: 0.10 },
    timeframe: ['1d', '1w'],
    popularityScore: 90,
    winRate: 0.66,
    sharpe: 1.38,
    matchesKeyword(kw: string): boolean { return ['科技', 'tech', 'nasdaq', '纳指', '动能'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 医疗防御 — LOW_VOL + QUAL_ROE + DIV_GROWTH + SURPRISE + MOM_60
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-healthcare-defense',
    name: 'Healthcare Defense',
    nameCN: '医疗防御',
    category: 'defensive',
    riskLevel: 'low',
    description: '医疗板块防御型精选：低波+ROE质量+股息增长+FDA/财报催化+中期动量',
    oneLiner: '低波医疗+ROE+股息增长→防御+催化双驱动',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['LOW_VOL', 'QUAL_ROE', 'DIV_GROWTH', 'SURPRISE', 'MOM_60'],
      weights: [0.25, 0.25, 0.20, 0.15, 0.15],
      formula: '0.25*LOW_VOL + 0.25*QUAL_ROE + 0.20*DIV_GROWTH + 0.15*SURPRISE + 0.15*MOM_60',
    },
    ironRules: {
      oneLiner: '低波医疗+ROE+股息增长→防御+催化双驱动',
      stopLossRule: '-8%止损；临床失败/FDA拒批立即平仓该标的',
      marketScope: '🇺🇸US医疗板块：制药/生物科技/医疗器械/健康保险，市值>10B',
      failureCheck: '医疗ETF XLV跌破200日线且板块IC<0时停止；大型专利悬崖事件降仓',
    },
    aiTriggers: [
      ...usExtraTriggers('医疗防御'),
      { type: 'ALT_DATA', nameCN: '替代数据解锁', nameEN: 'Alt Data Unlock', priceUSDT: 2,
        descriptionCN: '解锁FDA审批日历+临床管线+专利到期数据', descriptionEN: 'Unlock FDA calendar, clinical pipeline, patent expiry data',
        targetParams: ['altData'] },
    ],
    applicable: ['US Stocks', 'Healthcare', 'Defensive'],
    tags: ['healthcare', 'defensive', 'biotech', 'FDA', 'US'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.08 },
    timeframe: ['1d', '1w'],
    popularityScore: 74,
    winRate: 0.59,
    sharpe: 1.02,
    matchesKeyword(kw: string): boolean { return ['医疗', 'healthcare', 'biotech', 'pharma'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 消费稳健 — DIV_YIELD + DIV_GROWTH + LOW_VOL + QUAL_ROE + VAL_BP
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'us-consumer-staple',
    name: 'Consumer Staple Income',
    nameCN: '消费稳健',
    category: 'defensive',
    riskLevel: 'low',
    description: '必选消费稳健收益型：股息率+股息增长+低波动+ROE质量+估值五重筛选',
    oneLiner: '必选消费高股息+低波+ROE→长期复利稳健',
    version: 1,
    marketTags: ['US'] as MarketTag[],
    factorCombo: {
      factorIds: ['DIV_YIELD', 'DIV_GROWTH', 'LOW_VOL', 'QUAL_ROE', 'VAL_BP'],
      weights: [0.25, 0.20, 0.20, 0.20, 0.15],
      formula: '0.25*DIV_YIELD + 0.20*DIV_GROWTH + 0.20*LOW_VOL + 0.20*QUAL_ROE + 0.15*VAL_BP',
    },
    ironRules: {
      oneLiner: '必选消费高股息+低波+ROE→长期复利稳健',
      stopLossRule: '-10%止损；股息削减>20%立即平仓该标的',
      marketScope: '🇺🇸US必选消费：食品饮料/家居用品/个护/烟草，市值>15B，股息率>2%',
      failureCheck: '板块ROE连续2季恶化或消费信心指数连降3月时降仓50%',
    },
    aiTriggers: usExtraTriggers('消费稳健'),
    applicable: ['US Stocks', 'Consumer Staples', 'Dividend'],
    tags: ['consumer', 'staples', 'dividend', 'defensive', 'US'],
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.18, maxPosition: 0.08 },
    timeframe: ['1w', '1mo'],
    popularityScore: 70,
    winRate: 0.57,
    sharpe: 0.88,
    matchesKeyword(kw: string): boolean { return ['消费', 'consumer', 'staples', '股息', '必选'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default US_EXTRA_TEMPLATES;
