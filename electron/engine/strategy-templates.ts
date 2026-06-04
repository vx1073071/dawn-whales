// ── Q18: Strategy Templates ──────────────────────────────────────────────────
// Pre-built strategy templates for common trading patterns.
// Each template is a parameterized strategy config ready to instantiate.
// Supports: momentum, mean-reversion, breakout, pairs, options-covered-call

import log from 'electron-log';

// ── Template Types ─────────────────────────────────────────────────────────

export type StrategyCategory = 'momentum' | 'mean_reversion' | 'breakout' | 'pairs' | 'options' | 'multi_factor';
export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';

export interface ParameterDef {
  name: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description: string;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  category: StrategyCategory;
  timeframe: TimeFrame[];
  parameters: ParameterDef[];
  indicators: string[];   // required indicators
  rules: {
    entry: string;
    exit: string;
    stopLoss?: string;
    takeProfit?: string;
  };
  risk: {
    defaultStopLoss: number;   // fraction, e.g. 0.02 = 2%
    defaultTakeProfit: number;
    maxPosition: number;        // fraction of equity
  };
 适用于?: string[];          // applicable symbols/countries
  tags: string[];
}

// ── Template Registry ────────────────────────────────────────────────────────

const TEMPLATES: StrategyTemplate[] = [

  // ── 1. MACD 双均线 ──────────────────────────────────────────────────
  {
    id: 'macd-dual-ma',
    name: 'MACD Dual Moving Average',
    nameCn: 'MACD 双均线',
    description: '经典 MACD 金叉死叉策略，结合快速/慢速双均线过滤趋势',
    category: 'momentum',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'fastPeriod', label: '快线周期', type: 'number', default: 12, min: 5, max: 50, step: 1, description: '快线 EMA 周期' },
      { name: 'slowPeriod', label: '慢线周期', type: 'number', default: 26, min: 10, max: 200, step: 1, description: '慢线 EMA 周期' },
      { name: 'signalPeriod', label: '信号线周期', type: 'number', default: 9, min: 5, max: 30, step: 1, description: 'MACD 信号线周期' },
      { name: 'maPeriod', label: '均线周期', type: 'number', default: 50, min: 10, max: 500, step: 10, description: '趋势过滤均线周期' },
      { name: 'entryThreshold', label: '入场阈值', type: 'number', default: 0, min: -5, max: 5, step: 0.1, description: 'MACD 柱状图入场阈值' },
    ],
    indicators: ['MACD', 'EMA'],
    rules: {
      entry: 'MACD 金叉 且 价格在 MA 均线上方',
      exit: 'MACD 死叉 或 价格跌破均线',
      stopLoss: '入场价 - 2ATR',
      takeProfit: '入场价 + 3ATR',
    },
    risk: { defaultStopLoss: 0.02, defaultTakeProfit: 0.05, maxPosition: 0.10 },
    适用于: ['A股', '港股', '美股'],
    tags: ['趋势跟踪', 'MACD', '经典策略'],
  },

  // ── 2. 布林带均值回归 ─────────────────────────────────────────────
  {
    id: 'bollinger-mean-reversion',
    name: 'Bollinger Band Mean Reversion',
    nameCn: '布林带均值回归',
    description: '价格触及布林带下轨买入，上轨卖出，经典均值回归策略',
    category: 'mean_reversion',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'period', label: 'BB 周期', type: 'number', default: 20, min: 10, max: 100, step: 5, description: '布林带计算周期' },
      { name: 'stdDev', label: '标准差倍数', type: 'number', default: 2, min: 1, max: 4, step: 0.25, description: '布林带标准差倍数' },
      { name: 'rsiPeriod', label: 'RSI 周期', type: 'number', default: 14, min: 7, max: 30, step: 1, description: 'RSI 确认周期' },
      { name: 'rsi Oversold', label: 'RSI 超卖', type: 'number', default: 30, min: 20, max: 50, step: 5, description: 'RSI 超卖阈值' },
      { name: 'rsi Overbought', label: 'RSI 超买', type: 'number', default: 70, min: 50, max: 80, step: 5, description: 'RSI 超买阈值' },
    ],
    indicators: ['BollingerBands', 'RSI'],
    rules: {
      entry: '价格触及布林下轨 且 RSI < 超卖阈值',
      exit: '价格触及布林中轨 或 RSI > 50',
      stopLoss: '入场价 - 2ATR',
      takeProfit: '布林中轨',
    },
    risk: { defaultStopLoss: 0.025, defaultTakeProfit: 0.04, maxPosition: 0.10 },
    适用于: ['A股', '港股', '商品期货'],
    tags: ['均值回归', '布林带', 'RSI'],
  },

  // ── 3. 突破策略 ────────────────────────────────────────────────────
  {
    id: 'breakout-20d',
    name: '20-Day Breakout',
    nameCn: '20日突破策略',
    description: '价格突破20日高点时买入，跌破18日低点时卖出，经典动量突破',
    category: 'breakout',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'entryPeriod', label: '入场周期', type: 'number', default: 20, min: 10, max: 100, step: 5, description: '入场前高周期' },
      { name: 'exitPeriod', label: '止损周期', type: 'number', default: 18, min: 10, max: 100, step: 5, description: '止损前低周期（建议 < 入场周期）' },
      { name: 'atrPeriod', label: 'ATR 周期', type: 'number', default: 14, min: 7, max: 50, step: 1, description: 'ATR 周期' },
      { name: 'volumeConfirm', label: '量能确认', type: 'boolean', default: true, description: '是否要求放量确认' },
      { name: 'volumeRatio', label: '量比阈值', type: 'number', default: 1.5, min: 1, max: 5, step: 0.25, description: '放量倍数要求' },
    ],
    indicators: ['SMA', 'ATR', 'Volume'],
    rules: {
      entry: '价格突破 entryPeriod 高点 且 (量能确认=否 或 成交量 > 量比阈值 × 20日均量)',
      exit: '价格跌破 exitPeriod 低点',
      stopLoss: '入场价 - 2ATR',
      takeProfit: '跟踪止损：跌破均线止盈',
    },
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.08, maxPosition: 0.08 },
    适用于: ['A股', '美股', '期货'],
    tags: ['突破', '动量', '趋势跟踪'],
  },

  // ── 4. 备兑 Covered Call ─────────────────────────────────────────────
  {
    id: 'covered-call',
    name: 'Covered Call (Options)',
    nameCn: '备兑看涨期权',
    description: '持有正股的同时卖出虚值看涨期权收取权利金，适用于震荡或慢牛市场',
    category: 'options',
    timeframe: ['1d', '1w'],
    parameters: [
      { name: 'moneyness', label: '虚值程度 (OTM %)', type: 'number', default: 5, min: 1, max: 20, step: 1, description: '卖出期权的虚值百分比' },
      { name: 'dte', label: '到期天数 (DTE)', type: 'number', default: 30, min: 7, max: 60, step: 7, description: '目标到期天数' },
      { name: 'deltaTarget', label: 'Delta 目标', type: 'number', default: 0.30, min: 0.10, max: 0.50, step: 0.05, description: '目标 Delta 值' },
      { name: 'rollWhen', label: '滚动时机', type: 'select', default: '7dte', options: ['7dte', '5dte', 'atm'], description: '到期前多少天滚动' },
      { name: 'maxCallSize', label: '单笔最大 Call 数', type: 'number', default: 10, min: 1, max: 100, step: 1, description: '每笔交易最大开仓张数' },
    ],
    indicators: ['IV Rank', 'Delta'],
    rules: {
      entry: '持有正股，卖出虚值 Call（delta = deltaTarget）',
      exit: '到期行权 或 标的上涨至行权价 + 50% 利润时平仓',
      stopLoss: '标的跌幅 > 15% 时平仓止损',
      takeProfit: '权利金收入达到目标时止盈（通常 30-50%）',
    },
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.03, maxPosition: 0.30 },
    适用于: ['美股', '港股'],
    tags: ['期权', '备兑', '收入策略', '港美股'],
  },

  // ── 5. 多因子选股 ( Quantitative ) ──────────────────────────────────
  {
    id: 'quant-multi-factor',
    name: 'Multi-Factor Quantitative',
    nameCn: '多因子量化选股',
    description: '基于 JVS Q15 Multi-Factor Model 的量化选股策略，综合资金流/龙虎榜/基金持仓/情绪/技术面',
    category: 'multi_factor',
    timeframe: ['1d'],
    parameters: [
      { name: 'preset', label: '权重预设', type: 'select', default: 'balanced',
        options: ['balanced', 'momentum', 'value', 'institutional'],
        description: '因子权重预设：均衡/动量/价值/机构' },
      { name: 'minScore', label: '最低评分', type: 'number', default: 65, min: 50, max: 90, step: 1, description: '最低综合评分要求' },
      { name: 'universeSize', label: '持仓上限', type: 'number', default: 10, min: 3, max: 50, step: 1, description: '最大同时持仓数' },
      { name: 'rebalanceFreq', label: '调仓频率', type: 'select', default: 'weekly',
        options: ['daily', 'weekly', 'biweekly', 'monthly'],
        description: '组合再平衡频率' },
      { name: 'useSentiment', label: '使用舆情因子', type: 'boolean', default: true, description: '是否纳入新闻舆情因子' },
    ],
    indicators: ['资金流', '龙虎榜', '基金持仓', '舆情', '技术面'],
    rules: {
      entry: '综合评分 > minScore 时买入，排名前 universeSize 的股票',
      exit: '评分跌破 minScore - 10 或持仓超过 universeSize 时调仓',
      stopLoss: '单一标的亏损 > 8% 时止损',
      takeProfit: '单一标的盈利 > 15% 时跟踪止盈',
    },
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.15, maxPosition: 0.15 },
    适用于: ['A股'],
    tags: ['量化', '多因子', '选股', 'JVS集成'],
  },

  // ── 6. Pairs Trading 配对交易 ─────────────────────────────────────────
  {
    id: 'pairs-trading',
    name: 'Pairs Trading',
    nameCn: '配对交易',
    description: '做多一只股票同时做空另一只，赌两只股票的价差回归历史均值',
    category: 'pairs',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'pair', label: '配对股票', type: 'string', default: '', description: '格式: CODE1,CODE2 (如 000001,000002)' },
      { name: 'lookback', label: '均值回归周期', type: 'number', default: 60, min: 20, max: 252, step: 10, description: '计算历史价差的周期' },
      { name: 'entryZ', label: '入场 Z-Score', type: 'number', default: 2.0, min: 1.0, max: 3.0, step: 0.25, description: '触发入场的 Z-score 阈值' },
      { name: 'exitZ', label: '出场 Z-Score', type: 'number', default: 0.0, min: 0.0, max: 1.0, step: 0.25, description: '回归均值的 Z-score 阈值' },
      { name: 'stopZ', label: '止损 Z-Score', type: 'number', default: 3.0, min: 2.0, max: 5.0, step: 0.25, description: '止损 Z-score 阈值' },
    ],
    indicators: ['Z-Score', 'Correlation', 'Spread'],
    rules: {
      entry: 'Z-Score > entryZ 时 short 价差，Z-Score < -entryZ 时 long 价差',
      exit: 'Z-Score 回归至 exitZ 时平仓',
      stopLoss: 'Z-Score 超过 stopZ 时止损',
      takeProfit: 'Z-Score 回归 0 时止盈',
    },
    risk: { defaultStopLoss: 0.04, defaultTakeProfit: 0.06, maxPosition: 0.10 },
    适用于: ['港股', '美股'],
    tags: ['配对', '市场中性', '统计套利'],
  },

  // ── 7. ATR 趋势跟踪 ────────────────────────────────────────────────
  {
    id: 'atr-trend-following',
    name: 'ATR Trend Following',
    nameCn: 'ATR 趋势跟踪',
    description: '基于 ATR 动态止损的趋势跟踪策略，适用于期货和外汇',
    category: 'momentum',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'atrPeriod', label: 'ATR 周期', type: 'number', default: 14, min: 7, max: 50, step: 1, description: 'ATR 计算周期' },
      { name: 'atrMultiplier', label: 'ATR 倍数', type: 'number', default: 2.0, min: 1.0, max: 5.0, step: 0.25, description: '止损 ATR 倍数' },
      { name: 'emaPeriod', label: 'EMA 周期', type: 'number', default: 50, min: 20, max: 200, step: 10, description: '趋势判断 EMA 周期' },
      { name: 'useTrailingStop', label: '使用追踪止损', type: 'boolean', default: true, description: '是否启用 ATR 追踪止损' },
    ],
    indicators: ['ATR', 'EMA'],
    rules: {
      entry: '价格上穿 EMA 且在 EMA 上方运行时买入',
      exit: '价格下穿 EMA 时卖出',
      stopLoss: 'ATR 追踪止损：入场价 - atrMultiplier × ATR',
      takeProfit: 'ATR 追踪止盈：高点 - atrMultiplier × ATR',
    },
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.10, maxPosition: 0.08 },
    适用于: ['期货', '外汇', '商品'],
    tags: ['趋势跟踪', 'ATR', '追踪止损'],
  },

  // ── 8. RSI 超买超卖 ─────────────────────────────────────────────────
  {
    id: 'rsi-oversold',
    name: 'RSI Oversold/Overbought',
    nameCn: 'RSI 超买超卖',
    description: '经典 RSI 指标超卖买入、超买卖出，配合随机指标过滤假信号',
    category: 'mean_reversion',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'rsiPeriod', label: 'RSI 周期', type: 'number', default: 14, min: 7, max: 30, step: 1, description: 'RSI 计算周期' },
      { name: 'oversold', label: '超卖线', type: 'number', default: 30, min: 20, max: 40, step: 5, description: 'RSI 超卖阈值' },
      { name: 'overbought', label: '超买线', type: 'number', default: 70, min: 60, max: 80, step: 5, description: 'RSI 超买阈值' },
      { name: 'useStoch', label: '配合 KD 指标', type: 'boolean', default: true, description: '是否要求 KDJ 确认' },
      { name: 'confirmationBars', label: '确认 K 线数', type: 'number', default: 2, min: 1, max: 5, step: 1, description: '信号确认所需连续 K 线' },
    ],
    indicators: ['RSI', 'KDJ'],
    rules: {
      entry: 'RSI < oversold 且 (useStoch=否 或 K < D) 时买入',
      exit: 'RSI > 50 或 RSI > overbought 时卖出',
      stopLoss: 'RSI 再次跌破超卖线时止损',
      takeProfit: 'RSI 触及 overbought - 10 时止盈',
    },
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.07, maxPosition: 0.10 },
    适用于: ['A股', '港股', '外汇'],
    tags: ['RSI', '超买超卖', '均值回归'],
  },
];

// ── API Functions ───────────────────────────────────────────────────────────

export function getAllTemplates(): StrategyTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): StrategyTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: StrategyCategory): StrategyTemplate[] {
  return TEMPLATES.filter(t => t.category === category);
}

export function getTemplatesByTag(tag: string): StrategyTemplate[] {
  return TEMPLATES.filter(t => t.tags.some(t2 => t2.includes(tag)));
}

export function searchTemplates(query: string): StrategyTemplate[] {
  const q = query.toLowerCase();
  return TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.nameCn.includes(query) ||
    t.description.includes(query) ||
    t.category.includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

export function instantiateTemplate(
  id: string,
  paramOverrides: Record<string, any> = {}
): { strategy: Partial<any>; error?: string } {
  const tmpl = getTemplate(id);
  if (!tmpl) return { strategy: {}, error: `Template ${id} not found` };

  const params: Record<string, any> = {};
  for (const p of tmpl.parameters) {
    params[p.name] = paramOverrides[p.name] ?? p.default;
  }

  const strategy = {
    name: tmpl.name,
    nameCn: tmpl.nameCn,
    description: tmpl.description,
    category: tmpl.category,
    timeframe: tmpl.timeframe,
    parameters: params,
    indicators: tmpl.indicators,
    rules: tmpl.rules,
    risk: tmpl.risk,
    tags: tmpl.tags,
    templateId: tmpl.id,
    createdAt: Date.now(),
  };

  return { strategy };
}
