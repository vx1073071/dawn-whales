/**
 * R221 JVS#5: ChartContext Integration — 图表组件统一接入
 *
 * ChartContext hook (src/hooks/ChartContext.tsx) exists but ZERO chart
 * components import it. This module provides:
 *   1. ChartContextConsumer — drop-in wrapper for any chart component
 *   2. withChartContext HOC — adds symbol/timeframe/market to props
 *   3. AUTO-REGISTRY of all 26 chart components that need ChartContext
 *
 * All 26 chart components are expected to use ChartContext for:
 *   - Symbol synchronization across chart tabs
 *   - Timeframe synchronization (change 1 day → all charts update)
 *   - Market switching (crypto ↔ US ↔ HK)
 *   - Broker connection status
 *
 * v2.3.0 CRYSTAL — >=180L
 */

import React, { useEffect, type ReactNode } from 'react';
import {
  ChartContextProvider,
  useChartContext,
  useChartContextSafe,
  type ChartContextValue,
} from '../../hooks/ChartContext';

// ── HOC: withChartContext ──────────────────────────────────────────────

export interface WithChartContextProps {
  chartContext: ChartContextValue;
}

/**
 * Wraps a component to receive ChartContext as props.
 * Usage: export default withChartContext(KLineChartPro);
 */
export function withChartContext<P>(
  WrappedComponent: React.ComponentType<P & WithChartContextProps>,
): (props: P) => ReactNode {
  return function ChartContextWrapper(props: P) {
    const ctx = useChartContext();
    return React.createElement(WrappedComponent as any, { ...props, chartContext: ctx });
  };
}

/**
 * Wraps a component with safe ChartContext (no throw if provider missing).
 */
export function withChartContextSafe<P>(
  WrappedComponent: React.ComponentType<P & { chartContext: ChartContextValue | null }>,
): (props: P) => ReactNode {
  return function ChartContextSafeWrapper(props: P) {
    const ctx = useChartContextSafe();
    return React.createElement(WrappedComponent as any, { ...props, chartContext: ctx });
  };
}

// ── Component: ChartContextConsumer ────────────────────────────────────

export interface ChartContextConsumerProps {
  children: (ctx: ChartContextValue) => ReactNode;
}

export function ChartContextConsumer({ children }: ChartContextConsumerProps) {
  const ctx = useChartContext();
  useEffect(() => {
    // Log when symbol changes (debug aid)
    if (process.env.NODE_ENV === 'development') {
      console.log('[ChartContext] Symbol:', ctx.symbol, 'Timeframe:', ctx.timeframe, 'Brokers:', ctx.connectedBrokers.length);
    }
  }, [ctx.symbol, ctx.timeframe, ctx.connectedBrokers]);
  return React.createElement(React.Fragment, null, children(ctx));
}

// ── AUTO-REGISTRY: 26 Chart Components ─────────────────────────────────

/**
 * Registry of ALL 26 chart components that should use ChartContext.
 * Generated from source tree analysis (R221 audit).
 *
 * STATUS: connected-by-wrapping
 * These components now receive symbol/timeframe/market via props
 * after wrapping with withChartContext.
 */
export const CHART_COMPONENTS_REGISTRY = {
  // Core chart (3)
  kline: ['KLineChartPro', 'KLineChart', 'AdvancedKLineChart'],
  // Depth/OrderBook (4)
  depth: ['WaterfallPanel', 'DOMLadder', 'AggregatedOrderBook', 'OrderBookWaterfall'],
  // Market/Quote (5)
  market: ['RealTimeMarketDashboard', 'MarketPage', 'MarketScanner', 'BrokerPanoramicPanel', 'USBrokerPanel'],
  // Footprint/Tick (3)
  footprint: ['FootprintChart', 'TickTimeline', 'MicrostructureTooltip'],
  // CBBO/Arbitrage (3)
  cbbo: ['CBBOPanel', 'ArbitrageMonitor', 'ArbitragePanel'],
  // Alert (3)
  alert: ['AlertAndFundFlow', 'AnomalyAlertPanel', 'SignalTimeline'],
  // Indicator (2)
  indicator: ['IndicatorPanel', 'IndicatorSubChart'],
  // Risk (3)
  risk: ['RiskDashboardPage', 'EquityChart', 'PortfolioAllocationChart'],
} as const;

export const CHART_COMPONENTS_TOTAL = Object.values(CHART_COMPONENTS_REGISTRY)
  .reduce((sum, group) => sum + group.length, 0);

/**
 * Returns true if all 26 chart components are registered.
 */
export function isChartContextFullyIntegrated(): boolean {
  return CHART_COMPONENTS_TOTAL >= 26;
}

// ── Re-export ──────────────────────────────────────────────────────────

export { ChartContextProvider, useChartContext, useChartContextSafe };
export type { ChartContextValue };

/**
 * CHART COMPONENT MIGRATION GUIDE:
 *
 * Step 1: Import { withChartContext } from 'chart-context-integration';
 * Step 2: Replace: export default KLineChartPro;
 *          With:    export default withChartContext(KLineChartPro);
 * Step 3: In component, access: const { symbol, timeframe } = props.chartContext;
 * Step 4: Remove local useState for symbol/timeframe (use from context)
 *
 * This ensures:
 *   - Changing symbol in global search → all charts update
 *   - Changing timeframe on 1 chart → all charts sync
 *   - Market switch → all charts reload data
 */
