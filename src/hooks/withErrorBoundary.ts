// ── R122-M02 withErrorBoundary HOC — 一键包裹引擎组件 ────────────────────
// PM: 26个引擎组件需要 ErrorBoundary 防白屏
// 用法: wrapWithErrorBoundary(MyComponent, 'MyComponent')

import { ComponentType, createElement } from 'react';
import { ErrorBoundary, ErrorBoundaryProps } from '../components/shared/ErrorBoundary';

export function wrapWithErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  componentName: string,
  onError?: ErrorBoundaryProps['onError']
): ComponentType<P> {
  const displayName = `withErrorBoundary(${componentName})`;

  function Wrapped(props: P) {
    return createElement(ErrorBoundary, { componentName, onError, children: undefined } as ErrorBoundaryProps,
      createElement(Component, props as any)
    );
  }
  Wrapped.displayName = displayName;
  return Wrapped;
}

// ── 26 Engine Components Registry ──
// Ordered by module: K-Line (5) + Depth (5) + Broker (6) + Scanner (5) + Replay (3) + Chart (2)
export const ENGINE_COMPONENTS = [
  'KLineChartPro',
  'IndicatorPanel',
  'DrawingToolbar',
  'TradeEssentials',
  'VolumeProfileSpread',
  // Depth
  'OrderBookWaterfall',
  'DOMLadder',
  'DepthAnalyzerPanel',
  'FootprintChart',
  'CBBOPanel',
  // Broker
  'WatchlistV2',
  'ArbitragePanel',
  'AggregatedPortfolio',
  'SignalProviderDashboard',
  'BrokerManagerAndPortfolio',
  'EnhancedPanels',
  // Scanner
  'MarketScanner',
  'HeatmapTreemap',
  'ArbitrageMonitor',
  'AlertAndFundFlow',
  'PatternOverlay',
  // Replay
  'ReplayAndMicrostructure',
  'TickTimeline',
  'ChartStates',
  // Chart
  'IndicatorTemplates',
  'BrokerE2E',
] as const;

export default wrapWithErrorBoundary;
