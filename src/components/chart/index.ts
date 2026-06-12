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

// Drawing tools
export { default as DrawingToolbar } from './DrawingToolbar';
export type { DrawingToolbarProps } from './DrawingToolbar';
export { DRAWING_TOOLS, DRAWING_CATEGORY_LABELS, DRAWING_CATEGORY_COLORS, DRAWING_COLORS, LINE_STYLES } from './DrawingToolbar';
export type { DrawingToolDef, DrawingCategory } from './DrawingToolbar';

// Pattern overlay
export { default as PatternOverlay, PatternSummary, detectPatterns, PATTERN_CATALOG } from './PatternOverlay';
export type { PatternOverlayProps, PatternResult, PatternSummaryProps } from './PatternOverlay';

// R114 Depth/Tick UI
export { default as OrderBookWaterfall } from './OrderBookWaterfall';
export type { OrderBookData, OrderBookLevel, OrderBookProps } from './OrderBookWaterfall';
export { default as TickTimeline } from './TickTimeline';
export type { TickRecord, TickTimelineProps } from './TickTimeline';
export { default as DepthAnalyzerPanel } from './DepthAnalyzerPanel';
export type { DepthMetrics, DepthAnalyzerProps } from './DepthAnalyzerPanel';

// R115 Heatmap/Scanner/Alert/FundFlow
export { default as HeatmapTreemap } from './HeatmapTreemap';
export type { HeatmapItem, HeatmapView, HeatmapPeriod, HeatmapProps } from './HeatmapTreemap';
export { default as MarketScanner } from './MarketScanner';
export type { ScanItem, PresetScan, ScanFilter, MarketScannerProps } from './MarketScanner';
export { AlertPanel, FundFlowPanel } from './AlertAndFundFlow';
export type { AlertRule, AlertChannel, AlertTrigger, AlertPanelProps, FundFlowItem, FundFlowProps } from './AlertAndFundFlow';
