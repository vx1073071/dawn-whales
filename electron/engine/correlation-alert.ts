// ── Correlation Alert (JVS-52) ──────────────────────────────────────────────
// Correlation breakdown detection and alert system
// Detects when stock correlations change significantly (regime shifts)
// IPC: alert:correlation

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CorrelationSnapshot {
  codeA: string;
  codeB: string;
  correlation: number;       // Current correlation (-1 to 1)
  previousCorrelation: number;
  change: number;            // Correlation change
}

export interface CorrelationAlert {
  id: string;
  timestamp: number;
  type: 'breakdown' | 'spike' | 'regime_shift' | 'divergence';
  severity: 'low' | 'medium' | 'high' | 'critical';
  codeA: string;
  codeB: string;
  message: string;
  details: {
    currentCorrelation: number;
    previousCorrelation: number;
    change: number;
    historicalAvg?: number;
    historicalStdDev?: number;
    zScore?: number;
  };
  context: string;
}

export interface CorrelationAlertResult {
  success: boolean;
  alerts: CorrelationAlert[];
  summary: {
    totalAlerts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    pairsAnalyzed: number;
  };
  timestamp: number;
  error?: string;
}

// ── Thresholds ─────────────────────────────────────────────────────────────

const CORRELATION_THRESHOLDS = {
  change: { low: 0.15, medium: 0.25, high: 0.4, critical: 0.6 },
  absolute: { low: 0.7, medium: 0.8, high: 0.9, critical: 0.95 },
  zScore: { low: 1.5, medium: 2.0, high: 2.5, critical: 3.0 },
};

// ── Statistical Helpers ────────────────────────────────────────────────────

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function determineSeverity(
  absChange: number,
  absCorrelation: number,
  zScore: number
): 'low' | 'medium' | 'high' | 'critical' {
  // Check z-score first (most reliable)
  if (Math.abs(zScore) >= CORRELATION_THRESHOLDS.zScore.critical) return 'critical';
  if (Math.abs(zScore) >= CORRELATION_THRESHOLDS.zScore.high) return 'high';

  // Check absolute change
  if (absChange >= CORRELATION_THRESHOLDS.change.critical) return 'critical';
  if (absChange >= CORRELATION_THRESHOLDS.change.high) return 'high';

  // Check absolute correlation (very high correlation is suspicious)
  if (absCorrelation >= CORRELATION_THRESHOLDS.absolute.critical) return 'high';
  if (absCorrelation >= CORRELATION_THRESHOLDS.absolute.high) return 'medium';

  if (absChange >= CORRELATION_THRESHOLDS.change.medium) return 'medium';
  if (absChange >= CORRELATION_THRESHOLDS.change.low) return 'low';

  return 'low';
}

function determineAlertType(
  change: number,
  currentCorrelation: number,
  previousCorrelation: number
): 'breakdown' | 'spike' | 'regime_shift' | 'divergence' {
  const absChange = Math.abs(change);

  // Large negative change = correlation breakdown
  if (change < -0.3) return 'breakdown';

  // Large positive change = correlation spike
  if (change > 0.3) return 'spike';

  // Sign flip = regime shift
  if (Math.sign(currentCorrelation) !== Math.sign(previousCorrelation) && absChange > 0.2) {
    return 'regime_shift';
  }

  // Divergence from historical pattern
  return 'divergence';
}

function generateAlertMessage(
  codeA: string,
  codeB: string,
  type: string,
  severity: string,
  currentCorrelation: number,
  change: number
): string {
  const severityText = { low: '轻微', medium: '中等', high: '显著', critical: '严重' }[severity] || '';
  const typeText = {
    breakdown: '相关性崩溃',
    spike: '相关性飙升',
    regime_shift: '关系反转',
    divergence: '偏离历史',
  }[type] || '异常';

  const direction = change > 0 ? '上升' : '下降';
  return `${codeA}/${codeB} ${severityText}${typeText}: 当前 ${currentCorrelation.toFixed(3)}, ${direction} ${Math.abs(change).toFixed(3)}`;
}

function generateContext(
  currentCorrelation: number,
  historicalAvg: number,
  historicalStdDev: number,
  zScore: number
): string {
  let context = `历史均值: ${historicalAvg.toFixed(3)}, 标准差: ${historicalStdDev.toFixed(3)}, Z-Score: ${zScore.toFixed(2)}`;

  if (Math.abs(zScore) >= 2) {
    context += ` (${zScore > 0 ? '高于' : '低于'}均值 ${Math.abs(zScore).toFixed(1)} 个标准差)`;
  }

  return context;
}

// ── Main Function ──────────────────────────────────────────────────────────

export async function detectCorrelationAnomalies(
  currentSnapshots: CorrelationSnapshot[],
  historicalData: Map<string, number[]>  // key: "codeA|codeB", value: historical correlations
): Promise<CorrelationAlertResult> {
  if (!currentSnapshots || currentSnapshots.length === 0) {
    return {
      success: false,
      alerts: [],
      summary: {
        totalAlerts: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        pairsAnalyzed: 0,
      },
      timestamp: Date.now(),
      error: 'No correlation data provided',
    };
  }

  log.info(`[CorrelationAlert] Analyzing ${currentSnapshots.length} pairs`);

  const alerts: CorrelationAlert[] = [];

  for (const snapshot of currentSnapshots) {
    const { codeA, codeB, correlation, previousCorrelation, change } = snapshot;
    const pairKey = `${codeA}|${codeB}`;

    // Get historical data
    const historicalCorrelations = historicalData.get(pairKey) || [];
    const historicalAvg = calculateMean(historicalCorrelations);
    const historicalStdDev = calculateStdDev(historicalCorrelations);
    const zScore = calculateZScore(correlation, historicalAvg, historicalStdDev);

    // Determine severity
    const absChange = Math.abs(change);
    const absCorrelation = Math.abs(correlation);
    const severity = determineSeverity(absChange, absCorrelation, zScore);

    // Only create alert if severity is medium or higher
    if (severity === 'low') continue;

    // Determine alert type
    const alertType = determineAlertType(change, correlation, previousCorrelation);

    const alert: CorrelationAlert = {
      id: `corr-${codeA}-${codeB}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: alertType,
      severity,
      codeA,
      codeB,
      message: generateAlertMessage(codeA, codeB, alertType, severity, correlation, change),
      details: {
        currentCorrelation: correlation,
        previousCorrelation,
        change,
        historicalAvg,
        historicalStdDev,
        zScore,
      },
      context: generateContext(correlation, historicalAvg, historicalStdDev, zScore),
    };

    alerts.push(alert);
  }

  // Calculate summary
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  const result: CorrelationAlertResult = {
    success: true,
    alerts,
    summary: {
      totalAlerts: alerts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      pairsAnalyzed: currentSnapshots.length,
    },
    timestamp: Date.now(),
  };

  log.info(`[CorrelationAlert] Done: ${alerts.length} alerts from ${currentSnapshots.length} pairs (${criticalCount} critical, ${highCount} high)`);

  return result;
}

// ── Batch Analysis ─────────────────────────────────────────────────────────

export async function analyzeCorrelationMatrix(
  correlationMatrix: number[][],
  codes: string[],
  previousMatrix?: number[][],
  historicalMatrices?: Map<string, number[]>
): Promise<CorrelationAlertResult> {
  if (!correlationMatrix || !codes || codes.length === 0) {
    return {
      success: false,
      alerts: [],
      summary: { totalAlerts: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, pairsAnalyzed: 0 },
      timestamp: Date.now(),
      error: 'Invalid input',
    };
  }

  const snapshots: CorrelationSnapshot[] = [];

  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const correlation = correlationMatrix[i]?.[j] ?? 0;
      const previousCorrelation = previousMatrix?.[i]?.[j] ?? correlation;
      const change = correlation - previousCorrelation;

      snapshots.push({
        codeA: codes[i],
        codeB: codes[j],
        correlation,
        previousCorrelation,
        change,
      });
    }
  }

  return detectCorrelationAnomalies(snapshots, historicalMatrices || new Map());
}

// ── Real-time Monitoring ───────────────────────────────────────────────────

export interface CorrelationMonitorConfig {
  checkInterval: number;    // milliseconds
  alertThreshold: 'low' | 'medium' | 'high' | 'critical';
}

export class CorrelationMonitor {
  private config: CorrelationMonitorConfig;
  private historicalData: Map<string, number[]>;
  private intervalId: NodeJS.Timeout | null = null;
  private onAlertCallback: ((alert: CorrelationAlert) => void) | null = null;

  constructor(config: CorrelationMonitorConfig) {
    this.config = config;
    this.historicalData = new Map();
  }

  setHistoricalData(pairKey: string, values: number[]): void {
    this.historicalData.set(pairKey, values);
  }

  setAlertCallback(callback: (alert: CorrelationAlert) => void): void {
    this.onAlertCallback = callback;
  }

  async checkAnomalies(snapshots: CorrelationSnapshot[]): Promise<CorrelationAlertResult> {
    const result = await detectCorrelationAnomalies(snapshots, this.historicalData);

    // Filter alerts by threshold
    const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    const thresholdLevel = severityOrder[this.config.alertThreshold];

    const filteredAlerts = result.alerts.filter(
      alert => severityOrder[alert.severity] >= thresholdLevel
    );

    // Trigger callbacks
    if (this.onAlertCallback) {
      for (const alert of filteredAlerts) {
        this.onAlertCallback(alert);
      }
    }

    return {
      ...result,
      alerts: filteredAlerts,
      summary: { ...result.summary, totalAlerts: filteredAlerts.length },
    };
  }

  startMonitoring(fetchSnapshots: () => Promise<CorrelationSnapshot[]>): void {
    if (this.intervalId) return;

    log.info(`[CorrelationMonitor] Starting with ${this.config.checkInterval}ms interval`);

    this.intervalId = setInterval(async () => {
      try {
        const snapshots = await fetchSnapshots();
        await this.checkAnomalies(snapshots);
      } catch (err: any) {
        log.error('[CorrelationMonitor] Check failed:', err);
      }
    }, this.config.checkInterval);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('[CorrelationMonitor] Stopped');
    }
  }
}
