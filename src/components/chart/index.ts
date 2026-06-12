// ── R113 Chart barrel — KLineChart Pro + Indicator Panel + 指标引擎 ─────
export { default as KLineChartPro } from './KLineChartPro';
export type { KLineChartProProps } from './KLineChartPro';

export { default as IndicatorPanel } from './IndicatorPanel';
export type { IndicatorPanelProps } from './IndicatorPanel';
export { INDICATOR_DEFS, CATEGORY_COLORS, CATEGORY_LABELS } from './IndicatorPanel';
export type { IndicatorDef, IndicatorCategory } from './IndicatorPanel';

// Re-export from lib
export { ALL_TIMEFRAMES, TIMEFRAME_LABELS, TIMEFRAME_MS } from '../../lib/chart/types';
export type { Timeframe, AdjustType, CandleType, KlineBar, IndicatorLine, ChartTheme } from '../../lib/chart/types';
export { CHART_THEME_DARK, DEFAULT_LAYOUT } from '../../lib/chart/types';
export * from '../../lib/chart/indicator-engine';
export { transformCandles, toHeikinAshi, applyPreAdjust, applyPostAdjust, downsample, aggregateTimeframe, niceScale, findPriceRange } from '../../lib/chart/kline-utils';
