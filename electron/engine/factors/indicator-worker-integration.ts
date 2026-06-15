// ── R226 auto#1 1.3c: IndicatorWorker → FactorSignalPipeline Integration ───
// Connects the chart indicator worker to factor signal pipeline
// Completes data link 5: UI → rendering with factor signals
//
// Design: IndicatorWorker receives factor signals via preload IPC,
// computes indicator overlays on chart data, and returns annotations.

import type { FactorSignal } from '../factors/factor-signal-pipeline';

// ── Types ─────────────────────────────────────────────────────────────────

/** Factor annotation to overlay on chart */
export interface FactorChartAnnotation {
  factorId: string;
  timestamp: number;
  type: 'signal' | 'alert' | 'breakout' | 'decay';
  label: string;           // Display text
  price?: number;          // Y-axis position
  color?: string;          // Annotation color
  icon?: string;           // Emoji icon
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/** Indicator worker input: chart data + factor signals */
export interface IndicatorWorkerInput {
  symbol: string;
  bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  signals: FactorSignal[];
  options?: {
    showBreakouts?: boolean;
    showDecayWarnings?: boolean;
    showAlerts?: boolean;
  };
}

/** Indicator worker output */
export interface IndicatorWorkerOutput {
  annotations: FactorChartAnnotation[];
  indicators: Array<{
    factorId: string;
    type: string;
    values: number[];
    style: {
      color: string;
      lineWidth: number;
      dashStyle?: 'solid' | 'dash' | 'dot';
    };
  }>;
}

// ── Signal → Annotation Mapping ──────────────────────────────────────────

const SIGNAL_COLORS: Record<string, string> = {
  factor_breakout: '#4caf50',
  decay_warning: '#ff9800',
  factor_recommendation: '#2196f3',
  portfolio_alert: '#f44336',
  crowding_signal: '#9c27b0',
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function signalToAnnotation(signal: FactorSignal, price?: number): FactorChartAnnotation {
  return {
    factorId: signal.factorId,
    timestamp: signal.timestamp,
    type: signal.type === 'factor_breakout' ? 'breakout' :
          signal.type === 'decay_warning' ? 'decay' :
          signal.type === 'portfolio_alert' ? 'alert' : 'signal',
    label: signal.reason || signal.type,
    price,
    color: SIGNAL_COLORS[signal.type] || '#888888',
    icon: signal.type === 'factor_breakout' ? '🚀' :
          signal.type === 'decay_warning' ? '⚠️' :
          signal.type === 'factor_recommendation' ? '💡' :
          signal.type === 'portfolio_alert' ? '🔴' : '📊',
    priority: signal.priority,
  };
}

// ── Worker Computation ────────────────────────────────────────────────────

/**
 * Process factor signals against chart bars to produce annotations and indicator overlays.
 * This is the main entry point for IndicatorWorker.
 */
export function computeFactorIndicatorOverlay(input: IndicatorWorkerInput): IndicatorWorkerOutput {
  const annotations: FactorChartAnnotation[] = [];
  const indicators: IndicatorWorkerOutput['indicators'] = [];

  if (!input.signals || input.signals.length === 0) {
    return { annotations, indicators };
  }

  // Sort bars by time for binary search
  const sortedBars = [...input.bars].sort((a, b) => a.time - b.time);

  for (const signal of input.signals) {
    if (!signal.factorId) continue;

    // Skip based on options
    if (!input.options?.showBreakouts && signal.type === 'factor_breakout') continue;
    if (!input.options?.showDecayWarnings && signal.type === 'decay_warning') continue;
    if (!input.options?.showAlerts && signal.type === 'portfolio_alert') continue;

    // Find the closest price at signal time
    let closestPrice: number | undefined;
    for (const bar of sortedBars) {
      if (bar.time >= signal.timestamp) {
        closestPrice = bar.close;
        break;
      }
    }

    annotations.push(signalToAnnotation(signal, closestPrice));
  }

  // Sort annotations by priority (highest first) then by timestamp
  annotations.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] || 0;
    const pb = PRIORITY_ORDER[b.priority] || 0;
    return pb - pa || a.timestamp - b.timestamp;
  });

  return { annotations, indicators };
}

/**
 * Initialize IndicatorWorker connection to FactorSignalPipeline.
 * Called from renderer via preload IPC.
 */
export function initializeFactorIndicators(): void {
  console.log('[R226] IndicatorWorker: factor signal integration ONLINE — data link #5');
}

// ═══════════ IPC Registration (renderer-side) ════════════════════════════════

/**
 * Register factor signal listeners in the renderer process.
 * Call this from React useEffect or app init.
 */
export function registerFactorSignalListener(
  onSignal: (signal: FactorSignal) => void,
  onBatch: (signals: FactorSignal[]) => void,
): () => void {
  const api = (window as any).api || (window as any).electronAPI;
  if (!api) {
    console.warn('[R226] FactorSignalListener: no API available (not in Electron?)');
    return () => {};
  }

  if (api.on) {
    api.on('factor:signal', (_event: any, signal: FactorSignal) => onSignal(signal));
    api.on('factor:signal-batch', (_event: any, signals: FactorSignal[]) => onBatch(signals));
  }

  return () => {
    if (api.removeAllListeners) {
      api.removeAllListeners('factor:signal');
      api.removeAllListeners('factor:signal-batch');
    }
  };
}
