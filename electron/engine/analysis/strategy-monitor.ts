// ── Q52: Strategy Performance Monitor ─────────────────────────────────────────
// Real-time Sharpe/Calmar/TE tracking + Strategy lifecycle management
// Anomaly detection in strategy performance

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type StrategyStatus = 'DESIGN' | 'PAPER_TESTING' | 'LIVE' | 'PAUSED' | 'STOPPED' | 'ARCHIVED';
export type AnomalyType = 'SHARPE_DROP' | 'DRAWDOWN_SPIKE' | 'VOL_SPIKE' | 'SIGNAL_DRIFT' | 'CORRELATION_BREAK' | 'TURNOVER_ANOMALY';

export interface StrategySnapshot {
  strategyId: string;
  name: string;
  status: StrategyStatus;

  // Performance (cumulative)
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio: number;
  calmarRatio: number;
  sortinoRatio: number;
  informationRatio: number;
  trackingError: number;

  // Risk
  volatility: number;
  maxDrawdown: number;
  currentDrawdown: number;
  var95: number;

  // Activity
  nTrades: number;
  winRate: number;
  avgWinLossRatio: number;
  turnover: number;         // Portfolio turnover per period
  lastTradeDate: string;
  uptimeDays: number;

  // Signals
  signalStrength: number;   // 0-1
  signalConfidence: number; // 0-1
  signalsPerDay: number;

  // Lifecycle
  createdAt: string;
  startedAt?: string;
  pausedAt?: string;
  notes: string[];

  // Alerts
  alerts: Array<{ type: AnomalyType; severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string; detectedAt: string }>;
}

export interface PerformanceAnomaly {
  strategyId: string;
  type: AnomalyType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
  detectedAt: string;
  currentValue: number;
  baselineValue: number;
  deviation: number;        // % from baseline
  duration: number;         // periods affected
}

export interface StrategyMonitorReport {
  portfolioId: string;
  strategies: StrategySnapshot[];
  aggregate: {
    totalStrategies: number;
    activeStrategies: number;
    totalValue: number;
    weightedSharpe: number;
    totalDrawdown: number;
    bestStrategy: string;
    worstStrategy: string;
  };
  anomalies: PerformanceAnomaly[];
  lifecycleSummary: Record<StrategyStatus, number>;
  recommendations: string[];
  timestamp: number;
}

// ── Rolling Metrics ─────────────────────────────────────────────────────

function rollingSharpe(returns: number[], rfRate = 0.0): number {
  if (returns.length < 5) return 0;
  const excess = returns.map(r => r - rfRate / 252);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const std = Math.sqrt(excess.reduce((s, r) => s + (r - mean) ** 2, 0) / (excess.length - 1));
  return std > 0 ? (mean / std) * Math.sqrt(252) : 0;
}

function rollingCalmar(returns: number[], maxDD: number): number {
  if (maxDD === 0) return 0;
  const annReturn = returns.reduce((a, b) => a + b, 0) / returns.length * 252;
  return annReturn / Math.abs(maxDD);
}

function rollingSortino(returns: number[], rfRate = 0.0): number {
  if (returns.length < 5) return 0;
  const excess = returns.map(r => r - rfRate / 252);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const downside = excess.filter(r => r < 0);
  const downStd = downside.length > 0
    ? Math.sqrt(downside.reduce((s, r) => s + r ** 2, 0) / downside.length)
    : 1e-9;
  return downStd > 0 ? (mean / downStd) * Math.sqrt(252) : 0;
}

// ── Anomaly Detection ────────────────────────────────────────────────────

function detectAnomalies(
  current: StrategySnapshot,
  history: StrategySnapshot[]
): PerformanceAnomaly[] {
  const anomalies: PerformanceAnomaly[] = [];

  if (history.length < 5) return anomalies;

  const prev = history[history.length - 2];
  if (!prev) return anomalies;

  // Sharpe drop
  if (current.sharpeRatio < prev.sharpeRatio * 0.7 && current.sharpeRatio < 0.5) {
    anomalies.push({
      strategyId: current.strategyId,
      type: 'SHARPE_DROP',
      severity: current.sharpeRatio < 0 ? 'CRITICAL' : 'WARNING',
      description: `Sharpe dropped from ${prev.sharpeRatio.toFixed(2)} to ${current.sharpeRatio.toFixed(2)}`,
      detectedAt: new Date().toISOString(),
      currentValue: current.sharpeRatio,
      baselineValue: prev.sharpeRatio,
      deviation: ((current.sharpeRatio - prev.sharpeRatio) / prev.sharpeRatio) * 100,
      duration: 1,
    });
  }

  // Drawdown spike
  if (current.currentDrawdown > prev.currentDrawdown * 1.5 && current.currentDrawdown > 5) {
    anomalies.push({
      strategyId: current.strategyId,
      type: 'DRAWDOWN_SPIKE',
      severity: current.currentDrawdown > 15 ? 'CRITICAL' : 'WARNING',
      description: `Drawdown spiked to ${current.currentDrawdown.toFixed(1)}%`,
      detectedAt: new Date().toISOString(),
      currentValue: current.currentDrawdown,
      baselineValue: prev.currentDrawdown,
      deviation: ((current.currentDrawdown - prev.currentDrawdown) / prev.currentDrawdown) * 100,
      duration: 1,
    });
  }

  // Vol spike
  if (current.volatility > prev.volatility * 1.5) {
    anomalies.push({
      strategyId: current.strategyId,
      type: 'VOL_SPIKE',
      severity: 'WARNING',
      description: `Volatility spiked to ${(current.volatility * 100).toFixed(1)}% (was ${(prev.volatility * 100).toFixed(1)}%)`,
      detectedAt: new Date().toISOString(),
      currentValue: current.volatility,
      baselineValue: prev.volatility,
      deviation: ((current.volatility - prev.volatility) / prev.volatility) * 100,
      duration: 1,
    });
  }

  // Turnover anomaly
  if (Math.abs(current.turnover - prev.turnover) > prev.turnover * 2) {
    anomalies.push({
      strategyId: current.strategyId,
      type: 'TURNOVER_ANOMALY',
      severity: 'INFO',
      description: `Turnover changed significantly: ${(prev.turnover * 100).toFixed(1)}% → ${(current.turnover * 100).toFixed(1)}%`,
      detectedAt: new Date().toISOString(),
      currentValue: current.turnover,
      baselineValue: prev.turnover,
      deviation: ((current.turnover - prev.turnover) / prev.turnover) * 100,
      duration: 1,
    });
  }

  return anomalies;
}

// ── Strategy Monitor ─────────────────────────────────────────────────────

export class StrategyMonitor {
  private history: Map<string, StrategySnapshot[]> = new Map();

  constructor() {
    log.info('[StrategyMonitor] Initialized');
  }

  // ── Record Snapshot ─────────────────────────────────────────────────

  recordSnapshot(snapshot: StrategySnapshot): void {
    const existing = this.history.get(snapshot.strategyId) ?? [];
    existing.push(snapshot);
    // Keep last 30 snapshots
    if (existing.length > 30) existing.shift();
    this.history.set(snapshot.strategyId, existing);
  }

  // ── Update Strategy Status ─────────────────────────────────────────

  updateStatus(strategyId: string, newStatus: StrategyStatus, notes?: string[]): void {
    const snapshots = this.history.get(strategyId) ?? [];
    if (snapshots.length === 0) return;

    const latest = { ...snapshots[snapshots.length - 1]! };
    latest.status = newStatus;
    if (notes) latest.notes.push(...notes);
    if (newStatus === 'PAUSED') latest.pausedAt = new Date().toISOString();
    if (newStatus === 'LIVE' && !latest.startedAt) latest.startedAt = new Date().toISOString();

    snapshots[snapshots.length - 1] = latest;
    this.history.set(strategyId, snapshots);
  }

  // ── Detect Anomalies ─────────────────────────────────────────────

  detectAnomalies(strategyId: string): PerformanceAnomaly[] {
    const history = this.history.get(strategyId) ?? [];
    const current = history[history.length - 1];
    if (!current) return [];
    return detectAnomalies(current, history);
  }

  // ── Generate Report ───────────────────────────────────────────────

  generateReport(
    portfolioId: string,
    strategies: StrategySnapshot[]
  ): StrategyMonitorReport {
    for (const s of strategies) {
      this.recordSnapshot(s);
    }

    const active = strategies.filter(s =>
      s.status === 'LIVE' || s.status === 'PAPER_TESTING'
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lifecycleSummary: Record<StrategyStatus, number> = {} as any;
    for (const s of strategies) {
      lifecycleSummary[s.status] = (lifecycleSummary[s.status] ?? 0) + 1;
    }

    const totalValue = strategies.reduce((sum, s) => sum + s.totalValue, 0);
    const weightedSharpe = active.length > 0
      ? active.reduce((s, a) => s + a.sharpeRatio * (a.totalValue / totalValue), 0)
      : 0;

    const sorted = [...strategies].sort((a, b) => b.sharpeRatio - a.sharpeRatio);
    const bestStrategy = sorted[0]?.strategyId ?? 'N/A';
    const worst = sorted[sorted.length - 1];
    const worstStrategy = worst?.strategyId ?? 'N/A';

    const allAnomalies: PerformanceAnomaly[] = [];
    for (const strategy of strategies) {
      allAnomalies.push(...this.detectAnomalies(strategy.strategyId));
    }

    const recommendations: string[] = [];
    if (allAnomalies.some(a => a.severity === 'CRITICAL')) {
      recommendations.push('🚨 Critical anomalies detected — immediate review required');
    }
    if (active.filter(s => s.sharpeRatio < 0).length > active.length * 0.3) {
      recommendations.push('⚠️ >30% of active strategies have negative Sharpe — review strategy pipeline');
    }
    if (worst?.sharpeRatio < -1) {
      recommendations.push(`🛑 Strategy ${worstStrategy} Sharpe ${worst.sharpeRatio.toFixed(2)} — consider stopping`);
    }
    if (recommendations.length === 0) {
      recommendations.push('✅ All strategies within normal performance bounds');
    }

    return {
      portfolioId,
      strategies: strategies.map(s => ({
        ...s,
        alerts: this.detectAnomalies(s.strategyId).map(a => ({
          type: a.type,
          severity: a.severity,
          message: a.description,
          detectedAt: a.detectedAt,
        })),
      })),
      aggregate: {
        totalStrategies: strategies.length,
        activeStrategies: active.length,
        totalValue,
        weightedSharpe: Math.round(weightedSharpe * 100) / 100,
        totalDrawdown: Math.max(...strategies.map(s => s.currentDrawdown)),
        bestStrategy,
        worstStrategy,
      },
      anomalies: allAnomalies,
      lifecycleSummary,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── Quick Metrics ────────────────────────────────────────────────

  quickMetrics(returns: number[]): {
    sharpe: number;
    calmar: number;
    sortino: number;
    maxDD: number;
    vol: number;
  } {
    if (returns.length < 2) {
      return { sharpe: 0, calmar: 0, sortino: 0, maxDD: 0, vol: 0 };
    }

    // Max drawdown
    let peak = returns[0]!;
    let maxDD = 0;
    let running = 1;
    for (const r of returns) {
      running *= (1 + r);
      if (running > peak) peak = running;
      const dd = (peak - running) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    const vol = Math.sqrt(returns.reduce((s, r) => s + r ** 2, 0) / returns.length) * Math.sqrt(252);

    return {
      sharpe: Math.round(rollingSharpe(returns) * 100) / 100,
      calmar: Math.round(rollingCalmar(returns, maxDD) * 100) / 100,
      sortino: Math.round(rollingSortino(returns) * 100) / 100,
      maxDD: Math.round(maxDD * 10000) / 100,
      vol: Math.round(vol * 10000) / 100,
    };
  }
}

export default StrategyMonitor;