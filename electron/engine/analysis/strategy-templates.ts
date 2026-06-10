// ── Q18: Strategy Templates ──────────────────────────────────────────────────
// Pre-built strategy templates for common trading patterns.
// Each template is a parameterized strategy config ready to instantiate.
// Supports: momentum, mean-reversion, breakout, pairs, options-covered-call

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Template Types ─────────────────────────────────────────────────────────

export type StrategyCategory = 'momentum' | 'mean_reversion' | 'breakout' | 'pairs' | 'options' | 'multi_factor';
export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';

export interface ParameterDef {
  name: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  default: unknown;
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
    nameCn: i18n.t('strategyTemplates.k1'),
    description: i18n.t('strategyTemplates.k2'),
    category: 'momentum',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'fastPeriod', label: i18n.t('strategyTemplates.k3'), type: 'number', default: 12, min: 5, max: 50, step: 1, description: i18n.t('strategyTemplates.k4') },
      { name: 'slowPeriod', label: i18n.t('strategyTemplates.k5'), type: 'number', default: 26, min: 10, max: 200, step: 1, description: i18n.t('strategyTemplates.k6') },
      { name: 'signalPeriod', label: i18n.t('strategyTemplates.k7'), type: 'number', default: 9, min: 5, max: 30, step: 1, description: i18n.t('strategyTemplates.k8') },
      { name: 'maPeriod', label: i18n.t('strategyTemplates.k9'), type: 'number', default: 50, min: 10, max: 500, step: 10, description: i18n.t('strategyTemplates.k10') },
      { name: 'entryThreshold', label: i18n.t('strategyTemplates.k11'), type: 'number', default: 0, min: -5, max: 5, step: 0.1, description: i18n.t('strategyTemplates.k12') },
    ],
    indicators: ['MACD', 'EMA'],
    rules: {
      entry: i18n.t('strategyTemplates.k13'),
      exit: i18n.t('strategyTemplates.k14'),
      stopLoss: i18n.t('strategyTemplates.k15'),
      takeProfit: i18n.t('strategyTemplates.k16'),
    },
    risk: { defaultStopLoss: 0.02, defaultTakeProfit: 0.05, maxPosition: 0.10 },
    适用于: [i18n.t('strategyTemplates.k17'), i18n.t('strategyTemplates.k18'), i18n.t('strategyTemplates.k19')],
    tags: [i18n.t('strategyTemplates.k20'), 'MACD', i18n.t('strategyTemplates.k21')],
  },

  // ── 2. 布林带均值回归 ─────────────────────────────────────────────
  {
    id: 'bollinger-mean-reversion',
    name: 'Bollinger Band Mean Reversion',
    nameCn: i18n.t('strategyTemplates.k22'),
    description: i18n.t('strategyTemplates.k23'),
    category: 'mean_reversion',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'period', label: i18n.t('strategyTemplates.k24'), type: 'number', default: 20, min: 10, max: 100, step: 5, description: i18n.t('strategyTemplates.k25') },
      { name: 'stdDev', label: i18n.t('strategyTemplates.k26'), type: 'number', default: 2, min: 1, max: 4, step: 0.25, description: i18n.t('strategyTemplates.k27') },
      { name: 'rsiPeriod', label: i18n.t('strategyTemplates.k28'), type: 'number', default: 14, min: 7, max: 30, step: 1, description: i18n.t('strategyTemplates.k29') },
      { name: 'rsi Oversold', label: i18n.t('strategyTemplates.k30'), type: 'number', default: 30, min: 20, max: 50, step: 5, description: i18n.t('strategyTemplates.k31') },
      { name: 'rsi Overbought', label: i18n.t('strategyTemplates.k32'), type: 'number', default: 70, min: 50, max: 80, step: 5, description: i18n.t('strategyTemplates.k33') },
    ],
    indicators: ['BollingerBands', 'RSI'],
    rules: {
      entry: i18n.t('strategyTemplates.k34'),
      exit: i18n.t('strategyTemplates.k35'),
      stopLoss: i18n.t('strategyTemplates.k36'),
      takeProfit: i18n.t('strategyTemplates.k37'),
    },
    risk: { defaultStopLoss: 0.025, defaultTakeProfit: 0.04, maxPosition: 0.10 },
    适用于: [i18n.t('strategyTemplates.k38'), i18n.t('strategyTemplates.k39'), i18n.t('strategyTemplates.k40')],
    tags: [i18n.t('strategyTemplates.k41'), i18n.t('strategyTemplates.k42'), 'RSI'],
  },

  // ── 3. 突破策略 ────────────────────────────────────────────────────
  {
    id: 'breakout-20d',
    name: '20-Day Breakout',
    nameCn: i18n.t('strategyTemplates.k43'),
    description: i18n.t('strategyTemplates.k44'),
    category: 'breakout',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'entryPeriod', label: i18n.t('strategyTemplates.k45'), type: 'number', default: 20, min: 10, max: 100, step: 5, description: i18n.t('strategyTemplates.k46') },
      { name: 'exitPeriod', label: i18n.t('strategyTemplates.k47'), type: 'number', default: 18, min: 10, max: 100, step: 5, description: i18n.t('strategyTemplates.k48') },
      { name: 'atrPeriod', label: i18n.t('strategyTemplates.k49'), type: 'number', default: 14, min: 7, max: 50, step: 1, description: i18n.t('strategyTemplates.k50') },
      { name: 'volumeConfirm', label: i18n.t('strategyTemplates.k51'), type: 'boolean', default: true, description: i18n.t('strategyTemplates.k52') },
      { name: 'volumeRatio', label: i18n.t('strategyTemplates.k53'), type: 'number', default: 1.5, min: 1, max: 5, step: 0.25, description: i18n.t('strategyTemplates.k54') },
    ],
    indicators: ['SMA', 'ATR', 'Volume'],
    rules: {
      entry: i18n.t('strategyTemplates.k55'),
      exit: i18n.t('strategyTemplates.k56'),
      stopLoss: i18n.t('strategyTemplates.k57'),
      takeProfit: i18n.t('strategyTemplates.k58'),
    },
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.08, maxPosition: 0.08 },
    适用于: [i18n.t('strategyTemplates.k59'), i18n.t('strategyTemplates.k60'), i18n.t('strategyTemplates.k61')],
    tags: [i18n.t('strategyTemplates.k62'), i18n.t('strategyTemplates.k63'), i18n.t('strategyTemplates.k64')],
  },

  // ── 4. 备兑 Covered Call ─────────────────────────────────────────────
  {
    id: 'covered-call',
    name: 'Covered Call (Options)',
    nameCn: i18n.t('strategyTemplates.k65'),
    description: i18n.t('strategyTemplates.k66'),
    category: 'options',
    timeframe: ['1d', '1w'],
    parameters: [
      { name: 'moneyness', label: i18n.t('strategyTemplates.k67'), type: 'number', default: 5, min: 1, max: 20, step: 1, description: i18n.t('strategyTemplates.k68') },
      { name: 'dte', label: i18n.t('strategyTemplates.k69'), type: 'number', default: 30, min: 7, max: 60, step: 7, description: i18n.t('strategyTemplates.k70') },
      { name: 'deltaTarget', label: i18n.t('strategyTemplates.k71'), type: 'number', default: 0.30, min: 0.10, max: 0.50, step: 0.05, description: i18n.t('strategyTemplates.k72') },
      { name: 'rollWhen', label: i18n.t('strategyTemplates.k73'), type: 'select', default: '7dte', options: ['7dte', '5dte', 'atm'], description: i18n.t('strategyTemplates.k74') },
      { name: 'maxCallSize', label: i18n.t('strategyTemplates.k75'), type: 'number', default: 10, min: 1, max: 100, step: 1, description: i18n.t('strategyTemplates.k76') },
    ],
    indicators: ['IV Rank', 'Delta'],
    rules: {
      entry: i18n.t('strategyTemplates.k77'),
      exit: i18n.t('strategyTemplates.k78'),
      stopLoss: i18n.t('strategyTemplates.k79'),
      takeProfit: i18n.t('strategyTemplates.k80'),
    },
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.03, maxPosition: 0.30 },
    适用于: [i18n.t('strategyTemplates.k81'), i18n.t('strategyTemplates.k82')],
    tags: [i18n.t('strategyTemplates.k83'), i18n.t('strategyTemplates.k84'), i18n.t('strategyTemplates.k85'), i18n.t('strategyTemplates.k86')],
  },

  // ── 5. 多因子选股 ( Quantitative ) ──────────────────────────────────
  {
    id: 'quant-multi-factor',
    name: 'Multi-Factor Quantitative',
    nameCn: i18n.t('strategyTemplates.k87'),
    description: i18n.t('strategyTemplates.k88'),
    category: 'multi_factor',
    timeframe: ['1d'],
    parameters: [
      { name: 'preset', label: i18n.t('strategyTemplates.k89'), type: 'select', default: 'balanced',
        options: ['balanced', 'momentum', 'value', 'institutional'],
        description: i18n.t('strategyTemplates.k90') },
      { name: 'minScore', label: i18n.t('strategyTemplates.k91'), type: 'number', default: 65, min: 50, max: 90, step: 1, description: i18n.t('strategyTemplates.k92') },
      { name: 'universeSize', label: i18n.t('strategyTemplates.k93'), type: 'number', default: 10, min: 3, max: 50, step: 1, description: i18n.t('strategyTemplates.k94') },
      { name: 'rebalanceFreq', label: i18n.t('strategyTemplates.k95'), type: 'select', default: 'weekly',
        options: ['daily', 'weekly', 'biweekly', 'monthly'],
        description: i18n.t('strategyTemplates.k96') },
      { name: 'useSentiment', label: i18n.t('strategyTemplates.k97'), type: 'boolean', default: true, description: i18n.t('strategyTemplates.k98') },
    ],
    indicators: [i18n.t('strategyTemplates.k99'), i18n.t('strategyTemplates.k100'), i18n.t('strategyTemplates.k101'), i18n.t('strategyTemplates.k102'), i18n.t('strategyTemplates.k103')],
    rules: {
      entry: i18n.t('strategyTemplates.k104'),
      exit: i18n.t('strategyTemplates.k105'),
      stopLoss: i18n.t('strategyTemplates.k106'),
      takeProfit: i18n.t('strategyTemplates.k107'),
    },
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.15, maxPosition: 0.15 },
    适用于: [i18n.t('strategyTemplates.k108')],
    tags: [i18n.t('strategyTemplates.k109'), i18n.t('strategyTemplates.k110'), i18n.t('strategyTemplates.k111'), i18n.t('strategyTemplates.k112')],
  },

  // ── 6. Pairs Trading 配对交易 ─────────────────────────────────────────
  {
    id: 'pairs-trading',
    name: 'Pairs Trading',
    nameCn: i18n.t('strategyTemplates.k113'),
    description: i18n.t('strategyTemplates.k114'),
    category: 'pairs',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'pair', label: i18n.t('strategyTemplates.k115'), type: 'string', default: '', description: i18n.t('strategyTemplates.k116') },
      { name: 'lookback', label: i18n.t('strategyTemplates.k117'), type: 'number', default: 60, min: 20, max: 252, step: 10, description: i18n.t('strategyTemplates.k118') },
      { name: 'entryZ', label: i18n.t('strategyTemplates.k119'), type: 'number', default: 2.0, min: 1.0, max: 3.0, step: 0.25, description: i18n.t('strategyTemplates.k120') },
      { name: 'exitZ', label: i18n.t('strategyTemplates.k121'), type: 'number', default: 0.0, min: 0.0, max: 1.0, step: 0.25, description: i18n.t('strategyTemplates.k122') },
      { name: 'stopZ', label: i18n.t('strategyTemplates.k123'), type: 'number', default: 3.0, min: 2.0, max: 5.0, step: 0.25, description: i18n.t('strategyTemplates.k124') },
    ],
    indicators: ['Z-Score', 'Correlation', 'Spread'],
    rules: {
      entry: i18n.t('strategyTemplates.k125'),
      exit: i18n.t('strategyTemplates.k126'),
      stopLoss: i18n.t('strategyTemplates.k127'),
      takeProfit: i18n.t('strategyTemplates.k128'),
    },
    risk: { defaultStopLoss: 0.04, defaultTakeProfit: 0.06, maxPosition: 0.10 },
    适用于: [i18n.t('strategyTemplates.k129'), i18n.t('strategyTemplates.k130')],
    tags: [i18n.t('strategyTemplates.k131'), i18n.t('strategyTemplates.k132'), i18n.t('strategyTemplates.k133')],
  },

  // ── 7. ATR 趋势跟踪 ────────────────────────────────────────────────
  {
    id: 'atr-trend-following',
    name: 'ATR Trend Following',
    nameCn: i18n.t('strategyTemplates.k134'),
    description: i18n.t('strategyTemplates.k135'),
    category: 'momentum',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'atrPeriod', label: i18n.t('strategyTemplates.k136'), type: 'number', default: 14, min: 7, max: 50, step: 1, description: i18n.t('strategyTemplates.k137') },
      { name: 'atrMultiplier', label: i18n.t('strategyTemplates.k138'), type: 'number', default: 2.0, min: 1.0, max: 5.0, step: 0.25, description: i18n.t('strategyTemplates.k139') },
      { name: 'emaPeriod', label: i18n.t('strategyTemplates.k140'), type: 'number', default: 50, min: 20, max: 200, step: 10, description: i18n.t('strategyTemplates.k141') },
      { name: 'useTrailingStop', label: i18n.t('strategyTemplates.k142'), type: 'boolean', default: true, description: i18n.t('strategyTemplates.k143') },
    ],
    indicators: ['ATR', 'EMA'],
    rules: {
      entry: i18n.t('strategyTemplates.k144'),
      exit: i18n.t('strategyTemplates.k145'),
      stopLoss: i18n.t('strategyTemplates.k146'),
      takeProfit: i18n.t('strategyTemplates.k147'),
    },
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.10, maxPosition: 0.08 },
    适用于: [i18n.t('strategyTemplates.k148'), i18n.t('strategyTemplates.k149'), i18n.t('strategyTemplates.k150')],
    tags: [i18n.t('strategyTemplates.k151'), 'ATR', i18n.t('strategyTemplates.k152')],
  },

  // ── 8. RSI 超买超卖 ─────────────────────────────────────────────────
  {
    id: 'rsi-oversold',
    name: 'RSI Oversold/Overbought',
    nameCn: i18n.t('strategyTemplates.k153'),
    description: i18n.t('strategyTemplates.k154'),
    category: 'mean_reversion',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'rsiPeriod', label: i18n.t('strategyTemplates.k155'), type: 'number', default: 14, min: 7, max: 30, step: 1, description: i18n.t('strategyTemplates.k156') },
      { name: 'oversold', label: i18n.t('strategyTemplates.k157'), type: 'number', default: 30, min: 20, max: 40, step: 5, description: i18n.t('strategyTemplates.k158') },
      { name: 'overbought', label: i18n.t('strategyTemplates.k159'), type: 'number', default: 70, min: 60, max: 80, step: 5, description: i18n.t('strategyTemplates.k160') },
      { name: 'useStoch', label: i18n.t('strategyTemplates.k161'), type: 'boolean', default: true, description: i18n.t('strategyTemplates.k162') },
      { name: 'confirmationBars', label: i18n.t('strategyTemplates.k163'), type: 'number', default: 2, min: 1, max: 5, step: 1, description: i18n.t('strategyTemplates.k164') },
    ],
    indicators: ['RSI', 'KDJ'],
    rules: {
      entry: i18n.t('strategyTemplates.k165'),
      exit: i18n.t('strategyTemplates.k166'),
      stopLoss: i18n.t('strategyTemplates.k167'),
      takeProfit: i18n.t('strategyTemplates.k168'),
    },
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.07, maxPosition: 0.10 },
    适用于: [i18n.t('strategyTemplates.k169'), i18n.t('strategyTemplates.k170'), i18n.t('strategyTemplates.k171')],
    tags: ['RSI', i18n.t('strategyTemplates.k172'), i18n.t('strategyTemplates.k173')],
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
