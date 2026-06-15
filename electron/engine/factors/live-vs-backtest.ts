// ── R218-auto#1 (L10): 实盘vs回测偏差追踪 — 日偏差+衰退检测+预警 ─────────
// 基于现有 live-vs-backtest-engine.ts 扩展
// 新增: 日偏差自动追踪 / 衰退检测 / 三级预警 / 滚动窗口 / 健康评分

import {
  LiveVsBacktestDeviationEngine,
  type DeviationPoint,
  type DeviationReport,
  type AttributionCategory,
} from './live-vs-backtest-engine';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface DailyDeviationSnapshot {
  date: string;
  factorId: string;
  symbol: string;
  liveValue: number;
  backtestValue: number;
  deviation: number;
  deviationPct: number;
  cumulativeDeviation: number;
  trendDirection: 'improving' | 'stable' | 'decaying';
  trendSlope: number;
}

export interface DecaySignal {
  factorId: string;
  symbol: string;
  detected: boolean;
  severity: AlertLevel;
  trendSlope: number;             // deviation trend (positive = widening)
  decayRate: number;              // % per day
  rSquared: number;               // how confident the trend is linear
  projectedDeviation7d: number;   // predicted deviation in 7 days
  projectedDeviation30d: number;
  daysUntilCritical: number | null;
  message: string;
}

export interface DeviationAlert {
  id: string;
  factorId: string;
  symbol: string;
  level: AlertLevel;
  title: string;
  message: string;
  triggerValue: number;
  threshold: number;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  escalatedFrom?: AlertLevel;
}

export interface RollingWindowStats {
  window: '7d' | '30d' | '90d';
  meanDeviation: number;
  maxDeviation: number;
  minDeviation: number;
  stdDeviation: number;
  meanDeviationPct: number;
  trendDirection: 'improving' | 'stable' | 'decaying';
  trendMagnitude: number;
  dataPoints: number;
}

export interface StrategyHealthFromDeviation {
  factorId: string;
  symbol: string;
  score: number;                   // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  correlation: number;
  maxDeviation: number;
  meanDeviation: number;
  decayDetected: boolean;
  decaySeverity: AlertLevel;
  rollingWindows: RollingWindowStats[];
  activeAlerts: DeviationAlert[];
  lastSnapshotAt: number | null;
  recommendation: string;
}

export interface DailyDeviationReport {
  generatedAt: number;
  date: string;
  totalFactors: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  factors: StrategyHealthFromDeviation[];
  newAlerts: DeviationAlert[];
  summary: string;
}

export interface LiveVsBacktestConfig {
  checkIntervalHours: number;
  maxMeanDeviation: number;
  maxMaxDeviation: number;
  minCorrelation: number;
  decayThresholdPct: number;      // deviation %/day to trigger decay
  decayTrendWindowDays: number;   // days to analyze decay trend
  warningDeviationPct: number;    // trigger WARNING alert
  criticalDeviationPct: number;   // trigger CRITICAL alert
  rollingWindows: Array<'7d' | '30d' | '90d'>;
  autoEscalateAfterMs: number;    // auto escalate unacknowledged alerts
}

const DEFAULT_LIVE_VS_BACKTEST_CONFIG: LiveVsBacktestConfig = {
  checkIntervalHours: 24,
  maxMeanDeviation: 0.10,
  maxMaxDeviation: 0.25,
  minCorrelation: 0.70,
  decayThresholdPct: 0.005,       // 0.5%/day deviation growth = decay
  decayTrendWindowDays: 14,
  warningDeviationPct: 0.10,      // 10% deviation → WARNING
  criticalDeviationPct: 0.20,     // 20% deviation → CRITICAL
  rollingWindows: ['7d', '30d', '90d'],
  autoEscalateAfterMs: 7 * 86400_000, // 7 days unacknowledged → escalate
};

// ═══════════════════════════════════════════════════════════════════════════
// LIVE VS BACKTEST TRACKER
// ═══════════════════════════════════════════════════════════════════════════

export class LiveVsBacktestTracker {
  private config: LiveVsBacktestConfig;
  private engine: LiveVsBacktestDeviationEngine;

  // Daily snapshots: factorId+symbol → snapshots (sorted by date)
  private dailySnapshots = new Map<string, DailyDeviationSnapshot[]>();

  // Active alerts
  private alerts = new Map<string, DeviationAlert[]>(); // factorId+symbol → alerts

  // Latest health scores
  private healthScores = new Map<string, StrategyHealthFromDeviation>();

  private alertCounter = 0;

  constructor(config?: Partial<LiveVsBacktestConfig>) {
    this.config = { ...DEFAULT_LIVE_VS_BACKTEST_CONFIG, ...config };
    this.engine = new LiveVsBacktestDeviationEngine({
      maxMeanDeviation: this.config.maxMeanDeviation,
      maxMaxDeviation: this.config.maxMaxDeviation,
      minCorrelation: this.config.minCorrelation,
      dataDelayThresholdMs: 60_000,
      regimeChangeThreshold: 0.15,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RECORD DAILY SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record a daily live-vs-backtest comparison point.
   * Call this once per day per active strategy.
   */
  recordDailySnapshot(
    factorId: string,
    symbol: string,
    liveValue: number,
    backtestValue: number,
    date?: string,
  ): DailyDeviationSnapshot {
    const key = `${factorId}:${symbol}`;
    const snapDate = date ?? new Date().toISOString().split('T')[0];
    const deviation = liveValue - backtestValue;
    const deviationPct = backtestValue !== 0 ? deviation / Math.abs(backtestValue) : 0;

    // Cumulative deviation from all prior snapshots
    const existingSnaps = this.dailySnapshots.get(key) ?? [];
    const cumulativeDeviation = existingSnaps.length > 0
      ? existingSnaps[existingSnaps.length - 1].cumulativeDeviation + deviation
      : deviation;

    // Trend analysis
    const recentSnaps = existingSnaps.slice(-this.config.decayTrendWindowDays);
    const trendResult = this.computeTrendDirection(recentSnaps.map(s => s.deviation));

    const snapshot: DailyDeviationSnapshot = {
      date: snapDate,
      factorId,
      symbol,
      liveValue,
      backtestValue,
      deviation,
      deviationPct,
      cumulativeDeviation,
      trendDirection: trendResult.direction,
      trendSlope: trendResult.slope,
    };

    // Store
    if (!this.dailySnapshots.has(key)) {
      this.dailySnapshots.set(key, []);
    }
    this.dailySnapshots.get(key)!.push(snapshot);

    // Check for alerts
    this.checkAlertThresholds(snapshot, key);

    // Update health
    this.updateHealthScore(factorId, symbol);

    return snapshot;
  }

  /**
   * Bulk record — e.g., load historical data
   */
  bulkRecordSnapshots(snapshots: DailyDeviationSnapshot[]): void {
    for (const snap of snapshots) {
      const key = `${snap.factorId}:${snap.symbol}`;
      if (!this.dailySnapshots.has(key)) {
        this.dailySnapshots.set(key, []);
      }
      const existing = this.dailySnapshots.get(key)!;
      // Insert sorted by date
      const idx = existing.findIndex(s => s.date > snap.date);
      if (idx === -1) existing.push(snap);
      else existing.splice(idx, 0, snap);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DECAY DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Detect if backtest advantage is decaying (live performance drifting from backtest).
   * Key signal: deviation is monotonically increasing over recent window.
   */
  detectDecay(factorId: string, symbol: string): DecaySignal {
    const key = `${factorId}:${symbol}`;
    const snaps = this.dailySnapshots.get(key);
    const defaultResult: DecaySignal = {
      factorId, symbol, detected: false, severity: 'info',
      trendSlope: 0, decayRate: 0, rSquared: 0,
      projectedDeviation7d: 0, projectedDeviation30d: 0,
      daysUntilCritical: null, message: '无衰退信号',
    };

    if (!snaps || snaps.length < this.config.decayTrendWindowDays) {
      defaultResult.message = `数据不足: 需要至少 ${this.config.decayTrendWindowDays} 天数据`;
      return defaultResult;
    }

    const recentSnaps = snaps.slice(-this.config.decayTrendWindowDays);
    const deviations = recentSnaps.map(s => s.deviationPct);
    const days = recentSnaps.map((_, i) => i);

    // Linear regression: deviation = slope * day + intercept
    const regression = this.linearRegression(days, deviations);

    // Check if decay is significant
    const decayRatePctPerDay = regression.slope * 100;
    const isDecaying = regression.slope > 0 && decayRatePctPerDay >= this.config.decayThresholdPct;
    const isStrongCorrelation = regression.rSquared >= 0.6;

    const detected = isDecaying && isStrongCorrelation;

    // Determine severity
    let severity: AlertLevel = 'info';
    if (detected && decayRatePctPerDay >= 0.02) severity = 'critical';
    else if (detected && decayRatePctPerDay >= 0.01) severity = 'warning';

    // Project future deviation
    const lastDay = days[days.length - 1];
    const lastDeviation = deviations[deviations.length - 1];
    const projected7d = lastDeviation + regression.slope * 7;
    const projected30d = lastDeviation + regression.slope * 30;

    // Days until critical threshold
    let daysUntilCritical: number | null = null;
    if (regression.slope > 0) {
      daysUntilCritical = Math.ceil(
        (this.config.criticalDeviationPct - lastDeviation) / regression.slope,
      );
      if (daysUntilCritical <= 0) daysUntilCritical = 0;
    }

    // Message
    let message: string;
    if (!detected) {
      message = `回测偏离在正常范围，${decayRatePctPerDay.toFixed(3)}%/day趋势`;
    } else if (severity === 'critical') {
      message = `严重衰退！偏离以 ${decayRatePctPerDay.toFixed(2)}%/day 恶化，预计 ${daysUntilCritical} 天内达临界值`;
    } else if (severity === 'warning') {
      message = `警告：检测到回测衰退迹象，偏离以 ${decayRatePctPerDay.toFixed(2)}%/day 增长`;
    } else {
      message = `轻微偏离：建议关注策略表现`;
    }

    return {
      factorId, symbol, detected, severity,
      trendSlope: regression.slope,
      decayRate: Math.round(decayRatePctPerDay * 1000) / 1000,
      rSquared: Math.round(regression.rSquared * 1000) / 1000,
      projectedDeviation7d: Math.round(projected7d * 10000) / 10000,
      projectedDeviation30d: Math.round(projected30d * 10000) / 10000,
      daysUntilCritical,
      message,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ROLLING WINDOW STATS
  // ═══════════════════════════════════════════════════════════════════════

  getRollingWindowStats(
    factorId: string,
    symbol: string,
  ): RollingWindowStats[] {
    const key = `${factorId}:${symbol}`;
    const snaps = this.dailySnapshots.get(key);
    if (!snaps || snaps.length === 0) return [];

    return this.config.rollingWindows.map(windowSize => {
      const windowDays = parseInt(windowSize.replace('d', ''));
      const windowSnaps = snaps.slice(-windowDays);

      if (windowSnaps.length === 0) {
        return {
          window: windowSize,
          meanDeviation: 0, maxDeviation: 0, minDeviation: 0,
          stdDeviation: 0, meanDeviationPct: 0,
          trendDirection: 'stable' as const,
          trendMagnitude: 0, dataPoints: 0,
        };
      }

      const deviations = windowSnaps.map(s => s.deviation);
      const deviationPcts = windowSnaps.map(s => s.deviationPct);

      const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
      const meanPct = deviationPcts.reduce((a, b) => a + b, 0) / deviationPcts.length;
      const max = Math.max(...deviations);
      const min = Math.min(...deviations);
      const variance = deviations.reduce((s, d) => s + (d - mean) ** 2, 0) / deviations.length;

      const trend = this.computeTrendDirection(deviations);

      return {
        window: windowSize,
        meanDeviation: Math.round(mean * 10000) / 10000,
        maxDeviation: Math.round(max * 10000) / 10000,
        minDeviation: Math.round(min * 10000) / 10000,
        stdDeviation: Math.round(Math.sqrt(variance) * 10000) / 10000,
        meanDeviationPct: Math.round(meanPct * 10000) / 10000,
        trendDirection: trend.direction,
        trendMagnitude: Math.round(trend.slope * 10000) / 10000,
        dataPoints: windowSnaps.length,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STRATEGY HEALTH SCORE (from deviation perspective)
  // ═══════════════════════════════════════════════════════════════════════

  getStrategyHealth(factorId: string, symbol: string): StrategyHealthFromDeviation {
    const key = `${factorId}:${symbol}`;
    const cached = this.healthScores.get(key);
    if (cached) return cached;

    return this.updateHealthScore(factorId, symbol);
  }

  private updateHealthScore(factorId: string, symbol: string): StrategyHealthFromDeviation {
    const key = `${factorId}:${symbol}`;
    const snaps = this.dailySnapshots.get(key) ?? [];
    const decay = this.detectDecay(factorId, symbol);
    const windows = this.getRollingWindowStats(factorId, symbol);
    const activeAlerts = Array.from(this.getActiveAlerts(factorId, symbol));

    // Compute health score (0-100)
    let score = 100;

    // Penalty 1: correlation (0-30 points)
    const recentSnaps = snaps.slice(-30);
    if (recentSnaps.length >= 5) {
      const liveVals = recentSnaps.map(s => s.liveValue);
      const btVals = recentSnaps.map(s => s.backtestValue);
      const correlation = this.pearsonCorrelation(liveVals, btVals);
      if (correlation < 0.5) score -= 30;
      else if (correlation < 0.7) score -= 15;
      else if (correlation < 0.85) score -= 5;
    }

    // Penalty 2: mean deviation (0-30 points)
    if (recentSnaps.length > 0) {
      const meanDev = recentSnaps.reduce((s, p) => s + Math.abs(p.deviationPct), 0) / recentSnaps.length;
      if (meanDev > 0.25) score -= 30;
      else if (meanDev > 0.15) score -= 20;
      else if (meanDev > 0.10) score -= 10;
      else if (meanDev > 0.05) score -= 5;
    }

    // Penalty 3: max deviation (0-20 points)
    if (recentSnaps.length > 0) {
      const maxDev = Math.max(...recentSnaps.map(s => Math.abs(s.deviationPct)));
      if (maxDev > 0.40) score -= 20;
      else if (maxDev > 0.25) score -= 10;
      else if (maxDev > 0.15) score -= 5;
    }

    // Penalty 4: decay (0-20 points)
    if (decay.detected) {
      if (decay.severity === 'critical') score -= 20;
      else if (decay.severity === 'warning') score -= 10;
      else score -= 5;
    }

    // Clamp
    score = Math.max(0, Math.min(100, score));

    // Grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 40) grade = 'D';
    else grade = 'F';

    // Recommendation
    let recommendation: string;
    if (grade === 'A') recommendation = '策略表现与回测高度一致，继续保持';
    else if (grade === 'B') recommendation = '轻微偏离，建议关注趋势变化';
    else if (grade === 'C') recommendation = '明显偏离，建议检查策略参数和数据源';
    else if (grade === 'D') recommendation = '严重偏离，建议暂停实盘并重新评估策略';
    else recommendation = '策略已失效，强烈建议停止使用并迁移到新版本';

    const health: StrategyHealthFromDeviation = {
      factorId,
      symbol,
      score,
      grade,
      correlation: recentSnaps.length >= 5
        ? Math.round(this.pearsonCorrelation(recentSnaps.map(s => s.liveValue), recentSnaps.map(s => s.backtestValue)) * 10000) / 10000
        : 0,
      maxDeviation: recentSnaps.length > 0
        ? Math.max(...recentSnaps.map(s => Math.abs(s.deviationPct)))
        : 0,
      meanDeviation: recentSnaps.length > 0
        ? recentSnaps.reduce((s, p) => s + Math.abs(p.deviationPct), 0) / recentSnaps.length
        : 0,
      decayDetected: decay.detected,
      decaySeverity: decay.severity,
      rollingWindows: windows,
      activeAlerts,
      lastSnapshotAt: recentSnaps.length > 0
        ? new Date(recentSnaps[recentSnaps.length - 1].date).getTime()
        : null,
      recommendation,
    };

    this.healthScores.set(key, health);
    return health;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ALERT SYSTEM
  // ═══════════════════════════════════════════════════════════════════════

  private checkAlertThresholds(snapshot: DailyDeviationSnapshot, key: string): void {
    const absDevPct = Math.abs(snapshot.deviationPct);

    if (absDevPct >= this.config.criticalDeviationPct) {
      this.raiseAlert(snapshot.factorId, snapshot.symbol, 'critical',
        '严重偏离', `实盘偏离回测${(absDevPct*100).toFixed(1)}%，已超临界阈值${(this.config.criticalDeviationPct*100).toFixed(0)}%`,
        absDevPct, this.config.criticalDeviationPct);
    } else if (absDevPct >= this.config.warningDeviationPct) {
      this.raiseAlert(snapshot.factorId, snapshot.symbol, 'warning',
        '偏离警告', `实盘偏离回测${(absDevPct*100).toFixed(1)}%，超过警告阈值${(this.config.warningDeviationPct*100).toFixed(0)}%`,
        absDevPct, this.config.warningDeviationPct);
    }
  }

  raiseAlert(
    factorId: string, symbol: string, level: AlertLevel,
    title: string, message: string,
    triggerValue: number, threshold: number,
  ): DeviationAlert {
    const key = `${factorId}:${symbol}`;
    const alert: DeviationAlert = {
      id: `dev_alert_${++this.alertCounter}`,
      factorId, symbol, level, title, message,
      triggerValue: Math.round(triggerValue * 10000) / 10000,
      threshold: Math.round(threshold * 10000) / 10000,
      timestamp: Date.now(),
      acknowledged: false,
    };

    if (!this.alerts.has(key)) {
      this.alerts.set(key, []);
    }
    this.alerts.get(key)!.push(alert);

    // Auto-escalate older unacknowledged alerts
    this.autoEscalateAlerts(key);

    return alert;
  }

  acknowledgeAlert(alertId: string, factorId: string, symbol: string): boolean {
    const key = `${factorId}:${symbol}`;
    const alerts = this.alerts.get(key);
    if (!alerts) return false;

    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();
    return true;
  }

  getActiveAlerts(factorId: string, symbol: string): DeviationAlert[] {
    const key = `${factorId}:${symbol}`;
    return (this.alerts.get(key) ?? []).filter(a => !a.acknowledged);
  }

  getAllUnacknowledgedAlerts(): DeviationAlert[] {
    const all: DeviationAlert[] = [];
    for (const [, alerts] of Array.from(this.alerts)) {
      for (const a of alerts) {
        if (!a.acknowledged) all.push(a);
      }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  private autoEscalateAlerts(key: string): void {
    const alerts = this.alerts.get(key);
    if (!alerts) return;

    const now = Date.now();
    for (const alert of alerts) {
      if (alert.acknowledged) continue;
      const age = now - alert.timestamp;

      if (age > this.config.autoEscalateAfterMs * 2 && alert.level !== 'critical') {
        alert.escalatedFrom = alert.level;
        alert.level = 'critical';
        alert.message += ' [自动升级: 长期未确认]';
      } else if (age > this.config.autoEscalateAfterMs && alert.level === 'info') {
        alert.escalatedFrom = 'info';
        alert.level = 'warning';
        alert.message += ' [自动升级: 7天未确认]';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DAILY REPORT
  // ═══════════════════════════════════════════════════════════════════════

  generateDailyReport(date?: string): DailyDeviationReport {
    const reportDate = date ?? new Date().toISOString().split('T')[0];
    const allFactors: StrategyHealthFromDeviation[] = [];

    for (const [key, snaps] of Array.from(this.dailySnapshots)) {
      if (snaps.length === 0) continue;
      const [factorId, symbol] = key.split(':');
      const health = this.getStrategyHealth(factorId, symbol);
      allFactors.push(health);
    }

    const healthyCount = allFactors.filter(f => f.grade === 'A' || f.grade === 'B').length;
    const warningCount = allFactors.filter(f => f.grade === 'C').length;
    const criticalCount = allFactors.filter(f => f.grade === 'D' || f.grade === 'F').length;

    const newAlerts = this.getAllUnacknowledgedAlerts();

    const summary = allFactors.length > 0
      ? `${allFactors.length} 策略监控中: ${healthyCount} 健康, ${warningCount} 警告, ${criticalCount} 严重, ${newAlerts.length} 条新预警`
      : '暂无监控数据';

    return {
      generatedAt: Date.now(),
      date: reportDate,
      totalFactors: allFactors.length,
      healthyCount,
      warningCount,
      criticalCount,
      factors: allFactors,
      newAlerts,
      summary,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BULK HEALTH CHECK (all tracked strategies)
  // ═══════════════════════════════════════════════════════════════════════

  checkAllStrategiesHealth(): StrategyHealthFromDeviation[] {
    const results: StrategyHealthFromDeviation[] = [];

    for (const [key] of Array.from(this.dailySnapshots)) {
      const [factorId, symbol] = key.split(':');
      results.push(this.getStrategyHealth(factorId, symbol));
    }

    results.sort((a, b) => a.score - b.score); // worst first
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════

  getSnapshots(factorId: string, symbol: string): DailyDeviationSnapshot[] {
    return this.dailySnapshots.get(`${factorId}:${symbol}`) ?? [];
  }

  getAllTrackedFactors(): Array<{ factorId: string; symbol: string }> {
    const factors: Array<{ factorId: string; symbol: string }> = [];
    for (const [key] of Array.from(this.dailySnapshots)) {
      const [factorId, symbol] = key.split(':');
      factors.push({ factorId, symbol });
    }
    return factors;
  }

  getConfig(): LiveVsBacktestConfig { return { ...this.config }; }

  updateConfig(updates: Partial<LiveVsBacktestConfig>): void {
    Object.assign(this.config, updates);
  }

  reset(): void {
    this.dailySnapshots.clear();
    this.alerts.clear();
    this.healthScores.clear();
    this.alertCounter = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE MATH HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private linearRegression(x: number[], y: number[]): {
    slope: number; intercept: number; rSquared: number;
  } {
    const n = x.length;
    if (n < 2) return { slope: 0, intercept: y[0] ?? 0, rSquared: 0 };

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((s, yi, i) => s + (yi - (slope * x[i] + intercept)) ** 2, 0);
    const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, rSquared };
  }

  private computeTrendDirection(values: number[]): {
    direction: 'improving' | 'stable' | 'decaying';
    slope: number;
  } {
    if (values.length < 2) return { direction: 'stable', slope: 0 };

    const x = values.map((_, i) => i);
    const { slope } = this.linearRegression(x, values);

    if (slope > 0.001) return { direction: 'decaying', slope };
    if (slope < -0.001) return { direction: 'improving', slope };
    return { direction: 'stable', slope };
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let cov = 0, varX = 0, varY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }

    if (varX === 0 || varY === 0) return 0;
    return cov / Math.sqrt(varX * varY);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _trackerInstance: LiveVsBacktestTracker | null = null;

export function getLiveVsBacktestTracker(config?: Partial<LiveVsBacktestConfig>): LiveVsBacktestTracker {
  if (!_trackerInstance) {
    _trackerInstance = new LiveVsBacktestTracker(config);
  }
  return _trackerInstance;
}

export function resetLiveVsBacktestTracker(): void {
  _trackerInstance?.reset();
  _trackerInstance = null;
}

export default {
  LiveVsBacktestTracker,
  getLiveVsBacktestTracker,
  resetLiveVsBacktestTracker,
};
