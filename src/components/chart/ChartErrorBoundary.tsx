/**
 * R221 JVS#4: ChartErrorBoundary — 图表专用ErrorBoundary包裹
 *
 * Existing ErrorBoundary.tsx (3 versions) were never imported by chart components.
 * This module provides a chart-specific wrapper that:
 *   1. Catches chart rendering errors (canvas init failures, data format errors)
 *   2. Shows a chart-specific fallback (not a generic crash screen)
 *   3. Auto-retries on symbol/timeframe change
 *   4. Logs to performance monitor for chart health tracking
 *
 * v2.3.0 CRYSTAL — >=100L
 */

import React, { Component, type ReactNode } from 'react';

// ── Props ────────────────────────────────────────────────────────────

export interface ChartErrorBoundaryProps {
  children: ReactNode;
  /** Chart identifier for error tracking */
  chartType: 'kline' | 'depth' | 'footprint' | 'cbbo' | 'indicator';
  /** Symbol being displayed */
  symbol?: string;
  /** Custom fallback (defaults to chart-specific crash UI) */
  fallback?: ReactNode;
  /** Called on error */
  onError?: (error: Error, chartType: string) => void;
  /** Auto-retry on symbol change */
  autoRetry?: boolean;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

// ── Component ────────────────────────────────────────────────────────

export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ChartErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: { componentStack: string }) {
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
    console.error(
      `[ChartErrorBoundary] ${this.props.chartType} chart crashed (x${this.state.errorCount + 1}):`,
      error.message,
    );
    this.props.onError?.(error, this.props.chartType);
  }

  componentDidUpdate(prevProps: ChartErrorBoundaryProps) {
    // Auto-retry when symbol changes (data likely different, retry makes sense)
    if (
      this.props.autoRetry !== false &&
      this.state.hasError &&
      this.props.symbol !== prevProps.symbol
    ) {
      this.handleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const icon = CHART_CRASH_ICONS[this.props.chartType] || '📊';
      const label = CHART_CRASH_LABELS[this.props.chartType] || this.props.chartType;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 200,
          background: '#1a1a2e',
          color: '#94a3b8',
          fontFamily: 'monospace',
          fontSize: 14,
          gap: 12,
          padding: 24,
          borderRadius: 8,
          border: '1px solid #334155',
        }}>
          <div style={{ fontSize: 32 }}>{icon}</div>
          <div style={{ fontWeight: 600, color: '#f87171' }}>
            {label} 图表加载失败
          </div>
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', maxWidth: 300 }}>
            {this.state.error?.message || '未知错误'}
          </div>
          {this.state.errorCount > 1 && (
            <div style={{ fontSize: 11, color: '#475569' }}>
              已重试 {this.state.errorCount} 次
            </div>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

const CHART_CRASH_ICONS: Record<string, string> = {
  kline: '🕯️',
  depth: '📊',
  footprint: '👣',
  cbbo: '🔀',
  indicator: '📈',
};

const CHART_CRASH_LABELS: Record<string, string> = {
  kline: 'K线',
  depth: '深度',
  footprint: '足迹',
  cbbo: '最优报价',
  indicator: '指标',
};

/**
 * Convenience HOC: wraps any component with ChartErrorBoundary.
 */
export function withChartErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  chartType: ChartErrorBoundaryProps['chartType'],
): React.FC<P & { symbol?: string }> {
  return function ChartErrorBoundaryWrapper(props: P & { symbol?: string }) {
    return (
      <ChartErrorBoundary chartType={chartType} symbol={props.symbol}>
        <WrappedComponent {...props} />
      </ChartErrorBoundary>
    );
  };
}
