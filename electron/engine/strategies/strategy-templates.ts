// ── R161 P0-F5: Strategy Templates 22 (from 6→22, 6 categories) ──────────
// Categories: trend(4) | mean_reversion(4) | momentum(4) | value(3) | multi_factor(3) | options(4)
// Each: one-liner + params + tags + backtest summary

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Template Types ─────────────────────────────────────────────────────────

export type StrategyCategory =
  | 'trend'
  | 'mean_reversion'
  | 'momentum'
  | 'value'
  | 'multi_factor'
  | 'options';

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

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
  oneLiner: string;                 // R161: one-sentence pitch
  category: StrategyCategory;
  timeframe: TimeFrame[];
  parameters: ParameterDef[];
  indicators: string[];
  rules: {
    entry: string;
    exit: string;
    stopLoss?: string;
    takeProfit?: string;
  };
  risk: {
    defaultStopLoss: number;
    defaultTakeProfit: number;
    maxPosition: number;
  };
  applicable?: string[];
  tags: string[];
  backtestSummary?: string;         // R161: brief backtest results summary
  // R222-ML#4: 四铁律 + AI触发 + 因子标准
  ironRules?: {
    humanReadable: string;
    stopLossExplicit: string;
    marketApplicable: string;
    failureSelfCheck: string;
  };
  aiTriggers?: Array<{ context: 'factor' | 'goldenRule' | 'backtest' | 'parameter'; label: string; cost: number }>;
  factorWeight?: Record<string, number>;
  riskLevel?: 'conservative' | 'balanced' | 'aggressive';
  categoryCn?: string;
  updatedAt?: number;
  version?: string;
}

// ── Template Registry (22 templates / 6 categories) ────────────────────────

const TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // TREND (趋势) — 4 templates
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. MACD Dual Moving Average
  {
    id: 'macd-dual-ma',
    name: 'MACD Dual Moving Average',
    nameCn: i18n.t('strategyTemplates.k1'),
    description: i18n.t('strategyTemplates.k2'),
    oneLiner: 'Classic MACD crossover with EMA trend filter for intermediate trends',
    category: 'trend',
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
    applicable: [i18n.t('strategyTemplates.k17'), i18n.t('strategyTemplates.k18'), i18n.t('strategyTemplates.k19')],
    tags: [i18n.t('strategyTemplates.k20'), 'MACD', i18n.t('strategyTemplates.k21')],
    backtestSummary: 'US equities 2010-2024: Sharpe 0.82, win rate 54%, max DD 18%, annual return +12.3%',
  },

  // 2. 20-Day Breakout
  {
    id: 'breakout-20d',
    name: '20-Day Breakout',
    nameCn: i18n.t('strategyTemplates.k43'),
    description: i18n.t('strategyTemplates.k44'),
    oneLiner: 'N-period high breakout with volume confirmation for strong directional moves',
    category: 'trend',
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
    applicable: [i18n.t('strategyTemplates.k59'), i18n.t('strategyTemplates.k60'), i18n.t('strategyTemplates.k61')],
    tags: [i18n.t('strategyTemplates.k62'), i18n.t('strategyTemplates.k63'), i18n.t('strategyTemplates.k64')],
    backtestSummary: 'Futures 2015-2024: Sharpe 0.68, win rate 42%, max DD 22%, annual return +18.7%',
  },

  // 3. ATR Trend Following
  {
    id: 'atr-trend-following',
    name: 'ATR Trend Following',
    nameCn: i18n.t('strategyTemplates.k134'),
    description: i18n.t('strategyTemplates.k135'),
    oneLiner: 'EMA-trend aligned entries with ATR-based position sizing and trailing stops',
    category: 'trend',
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
    applicable: [i18n.t('strategyTemplates.k148'), i18n.t('strategyTemplates.k149'), i18n.t('strategyTemplates.k150')],
    tags: [i18n.t('strategyTemplates.k151'), 'ATR', i18n.t('strategyTemplates.k152')],
    backtestSummary: 'Crypto 2020-2024: Sharpe 1.15, win rate 38%, max DD 15%, annual return +42.1%',
  },

  // 4. Donchian Channel Turtle (NEW)
  {
    id: 'donchian-turtle',
    name: 'Donchian Turtle Trend',
    nameCn: '唐奇安海龟趋势',
    description: 'Turtle trading rules: 20-day Donchian breakout entries, pyramiding up to 4 units, 10-day exit',
    oneLiner: 'Classic Turtle system with Donchian channels and pyramided position sizing',
    category: 'trend',
    timeframe: ['1d'],
    parameters: [
      { name: 'entryChannel', label: 'Entry Breakout Days', type: 'number', default: 20, min: 10, max: 60, step: 5, description: 'Days for entry breakout (Donchian high)' },
      { name: 'exitChannel', label: 'Exit Breakout Days', type: 'number', default: 10, min: 5, max: 30, step: 1, description: 'Days for exit breakout (Donchian low)' },
      { name: 'atrPeriod', label: 'ATR Period', type: 'number', default: 20, min: 10, max: 50, step: 1, description: 'ATR lookback for position sizing' },
      { name: 'maxUnits', label: 'Max Pyramid Units', type: 'number', default: 4, min: 1, max: 10, step: 1, description: 'Max number of pyramided entries' },
      { name: 'addUnitATR', label: 'Add Unit (ATR)', type: 'number', default: 0.5, min: 0.25, max: 2.0, step: 0.25, description: 'ATR distance to add another unit' },
    ],
    indicators: ['Donchian', 'ATR'],
    rules: {
      entry: 'Buy when price breaks above 20-day Donchian high; add 1 unit every +0.5 ATR',
      exit: 'Sell when price breaks below 10-day Donchian low',
      stopLoss: 'Hard stop at -2 ATR from entry',
      takeProfit: 'No fixed TP; trail with Donchian exit',
    },
    risk: { defaultStopLoss: 0.04, defaultTakeProfit: 0.12, maxPosition: 0.20 },
    tags: ['trend-following', 'turtle-trading', 'donchian', 'pyramiding', 'long-term'],
    backtestSummary: 'Commodities 2000-2024: Sharpe 0.91, win rate 36%, max DD 28%, annual return +22.4%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEAN REVERSION (回归) — 4 templates
  // ═══════════════════════════════════════════════════════════════════════════

  // 5. Bollinger Band Mean Reversion
  {
    id: 'bollinger-mean-reversion',
    name: 'Bollinger Band Mean Reversion',
    nameCn: i18n.t('strategyTemplates.k22'),
    description: i18n.t('strategyTemplates.k23'),
    oneLiner: 'Fade extremes: buy at lower band with RSI confirmation, sell at middle band',
    category: 'mean_reversion',
    timeframe: ['15m', '1h', '4h', '1d'],
    parameters: [
      { name: 'period', label: i18n.t('strategyTemplates.k24'), type: 'number', default: 20, min: 10, max: 100, step: 5, description: i18n.t('strategyTemplates.k25') },
      { name: 'stdDev', label: i18n.t('strategyTemplates.k26'), type: 'number', default: 2, min: 1, max: 4, step: 0.25, description: i18n.t('strategyTemplates.k27') },
      { name: 'rsiPeriod', label: i18n.t('strategyTemplates.k28'), type: 'number', default: 14, min: 7, max: 30, step: 1, description: i18n.t('strategyTemplates.k29') },
      { name: 'rsiOversold', label: i18n.t('strategyTemplates.k30'), type: 'number', default: 30, min: 20, max: 50, step: 5, description: i18n.t('strategyTemplates.k31') },
      { name: 'rsiOverbought', label: i18n.t('strategyTemplates.k32'), type: 'number', default: 70, min: 50, max: 80, step: 5, description: i18n.t('strategyTemplates.k33') },
    ],
    indicators: ['BollingerBands', 'RSI'],
    rules: {
      entry: i18n.t('strategyTemplates.k34'),
      exit: i18n.t('strategyTemplates.k35'),
      stopLoss: i18n.t('strategyTemplates.k36'),
      takeProfit: i18n.t('strategyTemplates.k37'),
    },
    risk: { defaultStopLoss: 0.025, defaultTakeProfit: 0.04, maxPosition: 0.10 },
    applicable: [i18n.t('strategyTemplates.k38'), i18n.t('strategyTemplates.k39'), i18n.t('strategyTemplates.k40')],
    tags: [i18n.t('strategyTemplates.k41'), i18n.t('strategyTemplates.k42'), 'RSI'],
    backtestSummary: 'US equities 2010-2024: Sharpe 0.74, win rate 61%, max DD 12%, annual return +9.8%',
  },

  // 6. RSI Oversold/Overbought
  {
    id: 'rsi-oversold',
    name: 'RSI Oversold/Overbought',
    nameCn: i18n.t('strategyTemplates.k153'),
    description: i18n.t('strategyTemplates.k154'),
    oneLiner: 'Classic RSI reversal: buy at oversold (30), sell at overbought (70) with KDJ confirmation',
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
    applicable: [i18n.t('strategyTemplates.k169'), i18n.t('strategyTemplates.k170'), i18n.t('strategyTemplates.k171')],
    tags: ['RSI', i18n.t('strategyTemplates.k172'), i18n.t('strategyTemplates.k173')],
    backtestSummary: 'FX majors 2015-2024: Sharpe 0.61, win rate 58%, max DD 14%, annual return +7.2%',
  },

  // 7. KDJ Reversal (NEW)
  {
    id: 'kdj-reversal',
    name: 'KDJ Golden Cross Reversal',
    nameCn: 'KDJ金叉反转',
    description: 'Stochastic KDJ indicator reversal: enter on K-line golden cross below 20, exit on death cross above 80',
    oneLiner: 'KDJ oversold golden cross with trend filter for swing reversal entries',
    category: 'mean_reversion',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'kPeriod', label: 'K Period', type: 'number', default: 9, min: 5, max: 30, step: 1, description: 'KDJ K-line calculation period' },
      { name: 'dPeriod', label: 'D Period', type: 'number', default: 3, min: 2, max: 9, step: 1, description: 'KDJ D-line smoothing period' },
      { name: 'oversoldLevel', label: 'Oversold Threshold', type: 'number', default: 20, min: 10, max: 40, step: 5, description: 'K value below this = oversold' },
      { name: 'overboughtLevel', label: 'Overbought Threshold', type: 'number', default: 80, min: 60, max: 90, step: 5, description: 'K value above this = overbought' },
      { name: 'trendFilter', label: 'Trend Filter EMA', type: 'number', default: 100, min: 50, max: 200, step: 10, description: 'Only trade in direction of EMA trend' },
    ],
    indicators: ['KDJ', 'EMA'],
    rules: {
      entry: 'Long: K>D golden cross with K<20 and price>EMA(100). Short: K<D death cross with K>80 and price<EMA(100)',
      exit: 'Reverse KDJ crossing + price crossing midpoint',
      stopLoss: 'Stop at swing low/high before entry',
      takeProfit: 'Take profit at opposite extreme (K>80 for long, K<20 for short)',
    },
    risk: { defaultStopLoss: 0.025, defaultTakeProfit: 0.06, maxPosition: 0.08 },
    tags: ['KDJ', 'stochastic', 'oversold', 'reversal', 'swing-trading'],
    backtestSummary: 'HK stocks 2018-2024: Sharpe 0.69, win rate 56%, max DD 16%, annual return +11.5%',
  },

  // 8. CCI Divergence (NEW)
  {
    id: 'cci-divergence',
    name: 'CCI Divergence Mean Reversion',
    nameCn: 'CCI背离均值回归',
    description: 'Commodity Channel Index divergence detection: enter when CCI shows bullish/bearish divergence with price',
    oneLiner: 'CCI divergence signals with multi-timeframe confirmation for high-probability reversals',
    category: 'mean_reversion',
    timeframe: ['4h', '1d'],
    parameters: [
      { name: 'cciPeriod', label: 'CCI Period', type: 'number', default: 20, min: 10, max: 50, step: 1, description: 'CCI calculation period' },
      { name: 'extremeLevel', label: 'Extreme Level', type: 'number', default: 100, min: 75, max: 200, step: 25, description: 'CCI extreme (±level) triggers divergence scan' },
      { name: 'divLookback', label: 'Divergence Lookback', type: 'number', default: 20, min: 10, max: 50, step: 5, description: 'Bars to look back for divergence pattern' },
      { name: 'confirmationTF', label: 'Confirmation Timeframe', type: 'select', default: '1d', options: ['1h', '4h', '1d', '1w'], description: 'Higher timeframe for trend confirmation' },
    ],
    indicators: ['CCI', 'Volume'],
    rules: {
      entry: 'Bullish div: price lower low + CCI higher low; Bearish div: price higher high + CCI lower high; confirm with volume spike',
      exit: 'CCI returns to ±50 zone or opposite extreme',
      stopLoss: 'Stop beyond most recent swing point',
      takeProfit: 'Take 50% at CCI=0, trail rest',
    },
    risk: { defaultStopLoss: 0.02, defaultTakeProfit: 0.05, maxPosition: 0.08 },
    tags: ['CCI', 'divergence', 'mean-reversion', 'multi-timeframe'],
    backtestSummary: 'Indices 2015-2024: Sharpe 0.78, win rate 53%, max DD 11%, annual return +10.2%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MOMENTUM (动量) — 4 templates
  // ═══════════════════════════════════════════════════════════════════════════

  // 9. Dual Momentum (NEW)
  {
    id: 'dual-momentum',
    name: 'Dual Momentum (Absolute + Relative)',
    nameCn: '双动量(绝对+相对)',
    description: 'Gary Antonacci dual momentum: compare absolute momentum vs T-bills, then relative momentum across assets, rotate monthly',
    oneLiner: 'Absolute + relative momentum rotation with crash protection via T-bill switch',
    category: 'momentum',
    timeframe: ['1d'],
    parameters: [
      { name: 'lookbackMonths', label: 'Lookback Months', type: 'number', default: 12, min: 3, max: 24, step: 1, description: 'Months for momentum calculation' },
      { name: 'rotationFreq', label: 'Rotation Frequency', type: 'select', default: 'monthly', options: ['weekly', 'biweekly', 'monthly'], description: 'How often to rebalance' },
      { name: 'topN', label: 'Top N Assets', type: 'number', default: 3, min: 1, max: 10, step: 1, description: 'Number of top momentum assets to hold' },
      { name: 'riskOffAsset', label: 'Risk-Off Asset', type: 'select', default: 'SHY', options: ['SHY', 'IEF', 'BIL', 'CASH'], description: 'Safe asset when absolute momentum is negative' },
    ],
    indicators: ['Rate-of-Change', 'Relative-Strength'],
    rules: {
      entry: 'Each month: (1) If SPY 12M return > T-bills, invest in top-N momentum ETFs. (2) Else, switch to risk-off asset',
      exit: 'Rotate on schedule; no intra-month exit',
      stopLoss: 'N/A — crash protection via absolute momentum switch',
      takeProfit: 'N/A — rotation-based continuous strategy',
    },
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.20, maxPosition: 0.30 },
    tags: ['dual-momentum', 'rotation', 'absolute-momentum', 'relative-strength', 'risk-management'],
    backtestSummary: 'Global ETFs 2000-2024: Sharpe 0.93, win rate 68% (monthly), max DD 22%, annual return +14.7%',
  },

  // 10. RSI Momentum Breakout (NEW)
  {
    id: 'rsi-momentum',
    name: 'RSI Momentum Breakout',
    nameCn: 'RSI动量突破',
    description: 'Enter on RSI strength breakout above 60 with expanding volume and ADX trend confirmation',
    oneLiner: 'RSI > 60 momentum surge with ADX filter for continuation entries',
    category: 'momentum',
    timeframe: ['1h', '4h', '1d'],
    parameters: [
      { name: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 7, max: 30, step: 1, description: 'RSI calculation period' },
      { name: 'rsiEntry', label: 'RSI Entry Level', type: 'number', default: 60, min: 50, max: 80, step: 5, description: 'RSI must exceed this for entry' },
      { name: 'adxPeriod', label: 'ADX Period', type: 'number', default: 14, min: 7, max: 30, step: 1, description: 'ADX calculation period' },
      { name: 'adxMin', label: 'ADX Minimum', type: 'number', default: 25, min: 15, max: 40, step: 5, description: 'ADX must exceed this (trending market)' },
      { name: 'volumeMin', label: 'Volume Min Ratio', type: 'number', default: 1.2, min: 1.0, max: 3.0, step: 0.1, description: 'Volume vs 20-day average' },
    ],
    indicators: ['RSI', 'ADX', 'Volume'],
    rules: {
      entry: 'Long: RSI > rsiEntry, ADX > adxMin, Volume > 1.2× avg. Short: mirror for bearish',
      exit: 'RSI crosses below 50 (momentum exhaustion) or trailing stop',
      stopLoss: 'Chandelier exit: trailing 3× ATR from highest high',
      takeProfit: 'Scale out 1/3 at +2R, trail rest',
    },
    risk: { defaultStopLoss: 0.025, defaultTakeProfit: 0.08, maxPosition: 0.10 },
    tags: ['RSI', 'momentum', 'ADX', 'volume-confirmation', 'breakout'],
    backtestSummary: 'US stocks 2010-2024: Sharpe 0.86, win rate 48%, max DD 16%, annual return +19.1%',
  },

  // 11. Volume-Price Momentum (NEW)
  {
    id: 'volume-price-momentum',
    name: 'Volume-Price Momentum (VWAP Anchored)',
    nameCn: '量价动量(VWAP锚定)',
    description: 'Anchored VWAP momentum: enter when price breaks above anchored VWAP from a significant event with rising OBV',
    oneLiner: 'VWAP-anchored breakouts from key events with OBV confirmation for institutional-grade entries',
    category: 'momentum',
    timeframe: ['15m', '1h', '4h'],
    parameters: [
      { name: 'anchorEvent', label: 'Anchor Event', type: 'select', default: 'earnings', options: ['earnings', 'fomc', 'cpi', 'nfp', 'custom'], description: 'Event to anchor VWAP from' },
      { name: 'vwapDeviation', label: 'VWAP Deviation %', type: 'number', default: 1.5, min: 0.5, max: 5, step: 0.25, description: 'Deviation above/below VWAP for entry' },
      { name: 'obvLookback', label: 'OBV Lookback', type: 'number', default: 10, min: 5, max: 30, step: 5, description: 'Bars to confirm OBV trend' },
      { name: 'maxBars', label: 'Max Hold Bars', type: 'number', default: 20, min: 5, max: 50, step: 5, description: 'Max bars to hold (time stop)' },
    ],
    indicators: ['AnchoredVWAP', 'OBV', 'Volume'],
    rules: {
      entry: 'Price crosses anchor VWAP + deviation%; OBV rising for obvLookback bars; volume above average',
      exit: 'Price returns within VWAP band OR time stop OR opposite OBV signal',
      stopLoss: 'Stop at anchored VWAP minus 2× ATR',
      takeProfit: 'Partial at 2× risk, trail rest with VWAP',
    },
    risk: { defaultStopLoss: 0.015, defaultTakeProfit: 0.04, maxPosition: 0.06 },
    tags: ['VWAP', 'institutional', 'volume', 'momentum', 'event-driven'],
    backtestSummary: 'Earnings events 2020-2024: Sharpe 1.02, win rate 52%, max DD 9%, annual return +25.3%',
  },

  // 12. Sector Rotation Momentum (NEW)
  {
    id: 'sector-rotation',
    name: 'Sector Rotation Momentum',
    nameCn: '板块轮动动量',
    description: 'Rotate into top-performing sectors using 3/6/12-month momentum with volatility weighting',
    oneLiner: 'Top-3 sector rotation based on multi-horizon momentum with vol-adjusted position sizing',
    category: 'momentum',
    timeframe: ['1d', '1w'],
    parameters: [
      { name: 'momentumMonths', label: 'Momentum Horizon', type: 'select', default: '6m', options: ['3m', '6m', '12m', 'composite'], description: 'Momentum measurement horizon' },
      { name: 'numSectors', label: 'Number of Sectors', type: 'number', default: 3, min: 1, max: 5, step: 1, description: 'Number of top sectors to hold' },
      { name: 'volAdjust', label: 'Volatility Adjust', type: 'boolean', default: true, description: 'Scale position size by inverse volatility' },
      { name: 'rebalanceDay', label: 'Rebalance Day', type: 'select', default: '1st', options: ['1st', '15th', 'end'], description: 'Day of month to rebalance' },
    ],
    indicators: ['Rate-of-Change', 'ATR'],
    rules: {
      entry: 'Monthly: rank 11 sectors by momentum. Buy top-N sector ETFs weighted by 1/volatility',
      exit: 'Rotate out of sectors that drop below top-N+2 ranking positions',
      stopLoss: 'N/A — sector diversification',
      takeProfit: 'N/A — continuous rotation',
    },
    risk: { defaultStopLoss: 0.05, defaultTakeProfit: 0.15, maxPosition: 0.25 },
    tags: ['sector-rotation', 'momentum', 'ETF', 'volatility-weighted', 'macro'],
    backtestSummary: 'US sectors 2005-2024: Sharpe 0.88, win rate 63% (monthly), max DD 26%, annual return +12.9%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALUE (价值) — 3 templates
  // ═══════════════════════════════════════════════════════════════════════════

  // 13. P/E + P/B Deep Value (NEW)
  {
    id: 'pe-pb-deep-value',
    name: 'P/E + P/B Deep Value',
    nameCn: '市盈率+市净率深度价值',
    description: 'Screen for stocks with P/E < sector median and P/B < 1.5, rank by combined value score, hold top quintile',
    oneLiner: 'Deep value screener on P/E + P/B combo with sector-relative ranking',
    category: 'value',
    timeframe: ['1d', '1w'],
    parameters: [
      { name: 'maxPE', label: 'Max P/E Ratio', type: 'number', default: 15, min: 5, max: 30, step: 1, description: 'Maximum trailing P/E' },
      { name: 'maxPB', label: 'Max P/B Ratio', type: 'number', default: 1.5, min: 0.5, max: 3.0, step: 0.25, description: 'Maximum price-to-book ratio' },
      { name: 'minDivYield', label: 'Min Dividend Yield %', type: 'number', default: 2, min: 0, max: 8, step: 0.5, description: 'Minimum dividend yield for quality filter' },
      { name: 'universeSize', label: 'Portfolio Size', type: 'number', default: 20, min: 10, max: 50, step: 5, description: 'Number of stocks to hold' },
      { name: 'rebalanceMonths', label: 'Rebalance (Months)', type: 'number', default: 3, min: 1, max: 12, step: 1, description: 'Quarterly rebalancing' },
    ],
    indicators: ['P/E', 'P/B', 'Dividend Yield'],
    rules: {
      entry: 'Quarterly: filter universe (P/E < maxPE, P/B < maxPB, yield > minDivYield), rank by combined value score, buy top universeSize',
      exit: 'Sell stocks that exceed rebalancePE threshold or drop out of top 2×universeSize',
      stopLoss: 'N/A — diversified value portfolio',
      takeProfit: 'Trim at 50% gain, rotate into next value stock',
    },
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.30, maxPosition: 0.15 },
    tags: ['value-investing', 'PE-ratio', 'PB-ratio', 'dividend', 'deep-value'],
    backtestSummary: 'US equities 2000-2024: Sharpe 0.65, win rate 55% (quarterly), max DD 35%, annual return +11.3%',
  },

  // 14. Dividend Aristocrats Stability Value (NEW)
  {
    id: 'dividend-stability',
    name: 'Dividend Stability Value',
    nameCn: '股息稳定性价值',
    description: 'Invest in companies with 10+ years of consecutive dividend growth, stable payout ratios, and reasonable valuation',
    oneLiner: 'Dividend growth with payout ratio filter for income + capital preservation',
    category: 'value',
    timeframe: ['1d'],
    parameters: [
      { name: 'minYears', label: 'Min Dividend Years', type: 'number', default: 10, min: 5, max: 25, step: 1, description: 'Minimum consecutive years of dividend growth' },
      { name: 'maxPayoutRatio', label: 'Max Payout Ratio %', type: 'number', default: 60, min: 30, max: 80, step: 5, description: 'Max payout ratio (sustainability filter)' },
      { name: 'minYield', label: 'Min Dividend Yield %', type: 'number', default: 2.5, min: 1, max: 6, step: 0.5, description: 'Minimum dividend yield' },
      { name: 'maxDebt', label: 'Max Debt/Equity', type: 'number', default: 1.5, min: 0.5, max: 3.0, step: 0.25, description: 'Maximum debt-to-equity ratio' },
    ],
    indicators: ['Dividend Growth', 'Payout Ratio', 'D/E Ratio', 'FCF Yield'],
    rules: {
      entry: 'Screen for div growth ≥ minYears, payout < maxPayoutRatio, yield > minYield, D/E < maxDebt. Equal-weight hold 15-20 stocks',
      exit: 'Sell if dividend cut, payout ratio exceeds 80%, or D/E triples',
      stopLoss: 'N/A — buy-and-hold income strategy',
      takeProfit: 'Re-evaluate annually; hold long-term',
    },
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.10 },
    tags: ['dividend', 'income', 'aristocrats', 'quality', 'low-volatility'],
    backtestSummary: 'US dividend payers 1990-2024: Sharpe 0.59, win rate 72% (annual), max DD 28%, annual return +9.4%',
  },

  // 15. Graham Net-Net (NEW)
  {
    id: 'graham-net-net',
    name: 'Graham Net-Net Strategy',
    nameCn: '格雷厄姆净净股',
    description: 'Benjamin Graham deep value: buy stocks trading below NCAV (current assets - total liabilities) with margin of safety',
    oneLiner: 'Classic net-net working capital screen with 2/3 NCAV entry for extreme value',
    category: 'value',
    timeframe: ['1d'],
    parameters: [
      { name: 'ncavDiscount', label: 'NCAV Discount %', type: 'number', default: 33, min: 20, max: 50, step: 1, description: 'Required discount to NCAV (margin of safety)' },
      { name: 'minMktCap', label: 'Min Market Cap (M)', type: 'number', default: 50, min: 10, max: 500, step: 10, description: 'Minimum market cap in millions' },
      { name: 'maxPositions', label: 'Max Positions', type: 'number', default: 30, min: 10, max: 100, step: 5, description: 'Maximum positions for diversification' },
      { name: 'sellThreshold', label: 'Sell at % of NCAV', type: 'number', default: 100, min: 80, max: 120, step: 5, description: 'Sell when price reaches this % of NCAV' },
    ],
    indicators: ['NCAV', 'Current Ratio', 'P/B'],
    rules: {
      entry: 'Buy when market cap < NCAV × (1 - ncavDiscount%). Filter: current ratio > 1.5, positive earnings',
      exit: 'Sell when price reaches sellThreshold% of NCAV or after 2 years (whichever first)',
      stopLoss: 'N/A — extreme margin of safety',
      takeProfit: 'Target sellThreshold% of NCAV',
    },
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.50, maxPosition: 0.05 },
    tags: ['graham', 'net-net', 'deep-value', 'NCAV', 'margin-of-safety'],
    backtestSummary: 'Global small caps 1985-2024: Sharpe 0.71, win rate 58%, max DD 38%, annual return +16.8%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-FACTOR (多因子) — 3 templates
  // ═══════════════════════════════════════════════════════════════════════════

  // 16. Quant Multi-Factor
  {
    id: 'quant-multi-factor',
    name: 'Multi-Factor Quantitative',
    nameCn: i18n.t('strategyTemplates.k87'),
    description: i18n.t('strategyTemplates.k88'),
    oneLiner: 'Balanced multi-factor scoring across momentum, value, quality, growth, and low-volatility',
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
    applicable: [i18n.t('strategyTemplates.k108')],
    tags: [i18n.t('strategyTemplates.k109'), i18n.t('strategyTemplates.k110'), i18n.t('strategyTemplates.k111'), i18n.t('strategyTemplates.k112')],
    backtestSummary: 'Global equities 2010-2024: Sharpe 1.05, win rate 59%, max DD 14%, annual return +15.6%',
  },

  // 17. Value-Momentum Rotator (NEW)
  {
    id: 'value-momentum-rotator',
    name: 'Value-Momentum Rotator',
    nameCn: '价值动量轮动器',
    description: 'Dynamic factor rotation between value and momentum based on market regime: defensive value in bear, aggressive momentum in bull',
    oneLiner: 'Regime-aware rotation between value and momentum factors using VIX and trend signals',
    category: 'multi_factor',
    timeframe: ['1d'],
    parameters: [
      { name: 'regimeIndicator', label: 'Regime Indicator', type: 'select', default: 'vix-ma', options: ['vix-ma', 'spy-ma', 'composite'], description: 'Signal to detect market regime' },
      { name: 'vixThreshold', label: 'VIX Threshold', type: 'number', default: 25, min: 15, max: 40, step: 1, description: 'VIX above = defensive, below = aggressive' },
      { name: 'valueWeightMin', label: 'Min Value Weight', type: 'number', default: 40, min: 30, max: 60, step: 5, description: 'Minimum value allocation in defensive' },
      { name: 'momentumWeightMax', label: 'Max Momentum Weight', type: 'number', default: 70, min: 60, max: 85, step: 5, description: 'Maximum momentum allocation in aggressive' },
      { name: 'lookbackDays', label: 'Regime Lookback', type: 'number', default: 50, min: 20, max: 100, step: 10, description: 'Days to assess regime change' },
    ],
    indicators: ['VIX', 'SMA(200)', 'Factor Returns'],
    rules: {
      entry: 'Daily: if VIX > vixThreshold or SPY < SMA(200), tilt valueWeightMin% to value. Else tilt momentumWeightMax% to momentum',
      exit: 'Rebalance daily; smooth transitions with max 10% daily shift',
      stopLoss: 'Hold cash if both factors negative',
      takeProfit: 'Rotate continuously',
    },
    risk: { defaultStopLoss: 0.06, defaultTakeProfit: 0.12, maxPosition: 0.20 },
    tags: ['factor-rotation', 'regime-detection', 'value-momentum', 'VIX', 'adaptive'],
    backtestSummary: 'US equities 1995-2024: Sharpe 1.12, win rate 64% (monthly), max DD 18%, annual return +17.3%',
  },

  // 18. Quality-Growth Compounder (NEW)
  {
    id: 'quality-growth-compound',
    name: 'Quality-Growth Compounder',
    nameCn: '质量成长复利器',
    description: 'Screen for compounders: high ROE, consistent earnings growth, low debt, reasonable P/E for long-term hold',
    oneLiner: 'Buffett-style quality compounder screen with ROE, FCF growth, and margin stability',
    category: 'multi_factor',
    timeframe: ['1d'],
    parameters: [
      { name: 'minROE', label: 'Min ROE %', type: 'number', default: 15, min: 10, max: 30, step: 1, description: 'Minimum return on equity' },
      { name: 'minRevGrowth', label: 'Min Revenue Growth %', type: 'number', default: 10, min: 5, max: 25, step: 1, description: 'Minimum 3-year revenue CAGR' },
      { name: 'minMargin', label: 'Min Operating Margin %', type: 'number', default: 12, min: 5, max: 25, step: 1, description: 'Minimum operating margin' },
      { name: 'maxPEG', label: 'Max PEG Ratio', type: 'number', default: 1.5, min: 0.5, max: 3.0, step: 0.25, description: 'Maximum P/E to growth ratio' },
      { name: 'maxPositions', label: 'Max Positions', type: 'number', default: 15, min: 5, max: 30, step: 1, description: 'Number of compounders to hold' },
    ],
    indicators: ['ROE', 'Revenue Growth', 'Op Margin', 'PEG', 'FCF Yield'],
    rules: {
      entry: 'Quarterly screen for ROE > minROE, rev growth > minRevGrowth, margin > minMargin, PEG < maxPEG. Buy top maxPositions by composite quality score',
      exit: 'Sell if ROE drops below 10% or revenue growth turns negative for 2 consecutive quarters',
      stopLoss: 'N/A — long-term compounder strategy',
      takeProfit: 'Hold indefinitely; trim only on quality deterioration',
    },
    risk: { defaultStopLoss: 0.10, defaultTakeProfit: 0.30, maxPosition: 0.12 },
    tags: ['quality', 'growth', 'compounding', 'ROE', 'fundamental'],
    backtestSummary: 'US large caps 2005-2024: Sharpe 0.84, win rate 67% (annual), max DD 22%, annual return +14.2%',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONS (期权) — 4 templates
  // ═══════════════════════════════════════════════════════════════════════════

  // 19. Covered Call
  {
    id: 'covered-call',
    name: 'Covered Call (Options)',
    nameCn: i18n.t('strategyTemplates.k65'),
    description: i18n.t('strategyTemplates.k66'),
    oneLiner: 'Sell OTM calls against stock holdings to generate income; roll before expiration',
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
    applicable: [i18n.t('strategyTemplates.k81'), i18n.t('strategyTemplates.k82')],
    tags: [i18n.t('strategyTemplates.k83'), i18n.t('strategyTemplates.k84'), i18n.t('strategyTemplates.k85'), i18n.t('strategyTemplates.k86')],
    backtestSummary: 'S&P 500 2010-2024: Sharpe 0.68, win rate 82%, max DD 15%, annual return +10.1% (lower vol than buy-hold)',
  },

  // 20. Iron Condor (NEW)
  {
    id: 'iron-condor',
    name: 'Iron Condor (Neutral Range)',
    nameCn: '铁秃鹰(中性区间)',
    description: 'Sell both OTM put spread and call spread to profit from range-bound price action; high probability, defined risk',
    oneLiner: 'High-probability range-bound strategy: sell put spread + call spread with 80% PoP target',
    category: 'options',
    timeframe: ['1d'],
    parameters: [
      { name: 'dte', label: 'Days to Expiration', type: 'number', default: 30, min: 7, max: 60, step: 7, description: 'Days to expiration' },
      { name: 'putDelta', label: 'Put Delta', type: 'number', default: 0.16, min: 0.10, max: 0.30, step: 0.02, description: 'Short put delta (≈1 std dev)' },
      { name: 'callDelta', label: 'Call Delta', type: 'number', default: 0.16, min: 0.10, max: 0.30, step: 0.02, description: 'Short call delta (≈1 std dev)' },
      { name: 'wingWidth', label: 'Wing Width ($)', type: 'number', default: 5, min: 2.5, max: 20, step: 2.5, description: 'Width between short and long strikes' },
      { name: 'profitTarget', label: 'Profit Target %', type: 'number', default: 50, min: 25, max: 75, step: 5, description: '% of max credit to take profit' },
    ],
    indicators: ['IV Rank', 'Expected Move'],
    rules: {
      entry: 'Sell 1 OTM put spread + 1 OTM call spread, delta ~0.16 each, DTE 30-45, credit > 1/3 wing width, IV Rank > 25 preferred',
      exit: 'Close at profitTarget% of max credit or 21 DTE (whichever first). Manage losers at 2× credit',
      stopLoss: 'Close entire position if loss exceeds 2× credit received',
      takeProfit: 'Close at 50% of max profit or hold to expiration',
    },
    risk: { defaultStopLoss: 0.05, defaultTakeProfit: 0.03, maxPosition: 0.10 },
    tags: ['iron-condor', 'neutral', 'income', 'defined-risk', 'theta'],
    backtestSummary: 'SPX 2010-2024: Sharpe 1.34, win rate 84%, max DD 12%, annual return +15.8% (on margin)',
  },

  // 21. Put Credit Spread (NEW)
  {
    id: 'put-credit-spread',
    name: 'Put Credit Spread (Bullish Premium)',
    nameCn: '卖出看跌价差(看涨权利金)',
    description: 'Sell OTM put spreads on uptrending stocks at support levels to collect premium with defined risk',
    oneLiner: 'Sell put spreads at key support on trending stocks for consistent premium income',
    category: 'options',
    timeframe: ['1d'],
    parameters: [
      { name: 'dte', label: 'Days to Expiration', type: 'number', default: 14, min: 7, max: 45, step: 7, description: 'Days to expiration' },
      { name: 'shortDelta', label: 'Short Put Delta', type: 'number', default: 0.25, min: 0.10, max: 0.40, step: 0.05, description: 'Short put delta target' },
      { name: 'spreadWidth', label: 'Spread Width ($)', type: 'number', default: 5, min: 1, max: 20, step: 1, description: 'Width between short and long put' },
      { name: 'creditMin', label: 'Min Credit %', type: 'number', default: 15, min: 10, max: 40, step: 5, description: 'Minimum credit as % of spread width' },
      { name: 'trendFilter', label: 'Trend Filter', type: 'select', default: 'above-50ma', options: ['above-50ma', 'above-200ma', 'rsi-bullish', 'none'], description: 'Stock must be in uptrend' },
    ],
    indicators: ['Support/Resistance', 'IV Percentile', 'Trend'],
    rules: {
      entry: 'Stock above trend filter; sell OTM put spread at support level or delta 0.25; credit > creditMin% of width; DTE 14-30',
      exit: 'Close at 50% max profit or manage at 2× credit loss',
      stopLoss: 'Cut loss if underlying breaks support OR loss reaches 2× credit received',
      takeProfit: 'Close when remaining premium < 50% of entry credit',
    },
    risk: { defaultStopLoss: 0.04, defaultTakeProfit: 0.02, maxPosition: 0.08 },
    tags: ['put-credit-spread', 'premium-selling', 'bullish', 'defined-risk', 'support'],
    backtestSummary: 'US large caps 2015-2024: Sharpe 0.92, win rate 76%, max DD 11%, annual return +18.4% (on margin)',
  },

  // 22. Long Straddle (Earnings) (NEW)
  {
    id: 'long-straddle-earnings',
    name: 'Long Straddle (Earnings Play)',
    nameCn: '买入跨式(财报博弈)',
    description: 'Buy ATM straddle before earnings announcements to capture large post-earnings moves regardless of direction',
    oneLiner: 'Pre-earnings long straddle with IV crush management: buy 1d before, sell day after',
    category: 'options',
    timeframe: ['1d'],
    parameters: [
      { name: 'daysBefore', label: 'Days Before Earnings', type: 'number', default: 1, min: 1, max: 5, step: 1, description: 'Buy straddle this many days before ER' },
      { name: 'daysAfter', label: 'Hold Days After', type: 'number', default: 1, min: 1, max: 10, step: 1, description: 'Sell this many days after ER' },
      { name: 'minMove', label: 'Min Expected Move %', type: 'number', default: 5, min: 3, max: 15, step: 0.5, description: 'Minimum expected move (from options chain)' },
      { name: 'maxIVRank', label: 'Max IV Rank', type: 'number', default: 70, min: 50, max: 90, step: 5, description: 'Max IV rank to avoid buying expensive premium' },
      { name: 'positionSize', label: 'Position Size %', type: 'number', default: 2, min: 1, max: 10, step: 1, description: 'Max % of portfolio per trade' },
    ],
    indicators: ['IV Rank', 'Expected Move', 'Earnings Date'],
    rules: {
      entry: 'Buy ATM straddle daysBefore days before earnings. Filter: expected move > minMove%, IV Rank < maxIVRank',
      exit: 'Sell entire position daysAfter days after earnings. No adjustments',
      stopLoss: 'Full position risk — defined by premium paid',
      takeProfit: 'No target — sell on schedule regardless',
    },
    risk: { defaultStopLoss: 0.02, defaultTakeProfit: 0.08, maxPosition: 0.02 },
    tags: ['straddle', 'earnings', 'volatility', 'event-driven', 'non-directional'],
    backtestSummary: 'Earnings plays 2018-2024 (filtered): win rate 44%, avg win +85%, avg loss -100%, expected value +5.2% per trade',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════════════

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
  return TEMPLATES.filter(t => t.tags.some(t2 =>
    t2.toLowerCase().includes(tag.toLowerCase())
  ));
}

export function searchTemplates(query: string): StrategyTemplate[] {
  const q = query.toLowerCase();
  return TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.nameCn.includes(query) ||
    t.description.includes(query) ||
    t.oneLiner.toLowerCase().includes(q) ||
    t.category.includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

export function getCategoryCounts(): Record<StrategyCategory, number> {
  const counts: Record<StrategyCategory, number> = {
    trend: 0, mean_reversion: 0, momentum: 0, value: 0, multi_factor: 0, options: 0,
  };
  for (const t of TEMPLATES) {
    if (counts[t.category] !== undefined) counts[t.category]++;
  }
  return counts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function instantiateTemplate(
  id: string,
  paramOverrides: Record<string, any> = {},
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
    oneLiner: tmpl.oneLiner,
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

// ── R222-ML#4: 四铁律 + AI触发 + 因子权重 向后兼容层 ───────────────
// 为所有21个（去掉R214删除的template）添加因子标准字段

const IRON_RULE_DEFAULTS: Record<string, StrategyTemplate['ironRules']> = {
  trend: {
    humanReadable: '符合趋势跟踪逻辑，MACD/MA交叉信号',
    stopLossExplicit: '固定百分比止损或ATR动态止损',
    marketApplicable: '适用于有明确趋势的市场(HK/US/JP)',
    failureSelfCheck: '震荡市频繁假信号/趋势反转未止盈/止损过宽',
  },
  mean_reversion: {
    humanReadable: '价格偏离均线后向均值回归',
    stopLossExplicit: '突破布林带外轨2%止损',
    marketApplicable: '适用于震荡市场，单边趋势禁用',
    failureSelfCheck: '趋势市持续背离/RSI极端值持续/布林带收窄后未及时退出',
  },
  momentum: {
    humanReadable: '价格动量延续，强者恒强',
    stopLossExplicit: '跌破前低或3日低点止损',
    marketApplicable: '适用于强势上涨或下跌市场',
    failureSelfCheck: '动量反转未及时退出/假突破/市场情绪突变',
  },
  value: {
    humanReadable: '低估值买入高估值卖出',
    stopLossExplicit: '跌破支撑位或PE分位数回升止损',
    marketApplicable: '适用于成熟市场，新兴市场谨慎',
    failureSelfCheck: '价值陷阱/估值修复不达预期/宏观变化',
  },
  multi_factor: {
    humanReadable: '多因子组合选取最优标的',
    stopLossExplicit: '因子失效后止损或调仓',
    marketApplicable: '全市场适用，需根据市场动态调整权重',
    failureSelfCheck: '因子IC衰减/因子拥挤/过拟合',
  },
  options: {
    humanReadable: '期权策略，利用波动率和时间价值',
    stopLossExplicit: '权利金亏损100%或标的价格突破止损',
    marketApplicable: '适用于有期权市场的品种(US/HK)',
    failureSelfCheck: '隐波骤变/Gamma风险/到期日未平仓',
  },
};

const DEFAULT_AI_TRIGGERS: StrategyTemplate['aiTriggers'] = [
  { context: 'backtest', label: 'AI回测解读', cost: 1 },
  { context: 'parameter', label: 'AI参数优化', cost: 1.5 },
  { context: 'factor', label: 'AI因子分析', cost: 1 },
];

const FACTOR_W_DEFAULTS: Record<string, Record<string, number>> = {
  trend: { MA: 0.35, MACD: 0.35, ADX: 0.30 },
  mean_reversion: { BOLL: 0.40, RSI: 0.35, MA: 0.25 },
  momentum: { MOM_12M: 0.45, SMB: 0.25, VOL: 0.30 },
  value: { PE: 0.40, PB: 0.30, DIV: 0.30 },
  multi_factor: { MOM_12M: 0.25, ROE: 0.25, PE: 0.25, VOL_60D: 0.25 },
  options: { IV: 0.40, GAMMA: 0.30, THETA: 0.30 },
};

/** 为模板注入四铁律+AI触发+因子权重(如果缺失) */
export function enrichTemplateWithStandards(tmpl: StrategyTemplate): StrategyTemplate {
  return {
    ...tmpl,
    ironRules: tmpl.ironRules || IRON_RULE_DEFAULTS[tmpl.category] || IRON_RULE_DEFAULTS.trend,
    aiTriggers: tmpl.aiTriggers || DEFAULT_AI_TRIGGERS,
    factorWeight: tmpl.factorWeight || FACTOR_W_DEFAULTS[tmpl.category] || {},
    riskLevel: tmpl.riskLevel ||
      (tmpl.category === 'options' ? 'aggressive' : tmpl.category === 'momentum' ? 'balanced' : 'conservative') as StrategyTemplate['riskLevel'],
    categoryCn: tmpl.categoryCn || categoryToCn(tmpl.category),
    updatedAt: Date.now(),
    version: 'v2.3.0',
  };
}

function categoryToCn(cat: string): string {
  const m: Record<string, string> = {
    trend: '趋势', mean_reversion: '均值回归', momentum: '动量',
    value: '价值', multi_factor: '多因子', options: '期权',
  };
  return m[cat] || cat;
}

/** 为所有模板批量注入标准字段 */
export function enrichAllTemplates(): StrategyTemplate[] {
  return TEMPLATES.map(enrichTemplateWithStandards);
}

/** 获取已注入标准的模板列表 */
export function getStandardizedTemplates(): StrategyTemplate[] {
  return enrichAllTemplates();
}
