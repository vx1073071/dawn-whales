// ── Macro Alert (JVS-51) ───────────────────────────────────────────────────
// GDP/CPI/PMI anomaly detection and alert system
// IPC: alert:macro

import log from 'electron-log';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface MacroDataPoint {
  date: string;
  indicator: string;        // 'GDP' | 'CPI' | 'PMI'
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
}

export interface MacroAlert {
  id: string;
  timestamp: number;
  indicator: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'anomaly' | 'trend_break' | 'threshold_breach';
  message: string;
  details: {
    currentValue: number;
    previousValue: number;
    change: number;
    changePercent: number;
    threshold?: number;
    historicalAvg?: number;
    historicalStdDev?: number;
  };
  context: string;
}

export interface MacroAlertResult {
  success: boolean;
  alerts: MacroAlert[];
  summary: {
    totalAlerts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    indicatorsAnalyzed: string[];
  };
  timestamp: number;
  error?: string;
}

// ── Thresholds ─────────────────────────────────────────────────────────────

const THRESHOLDS = {
  GDP: {
    changePercent: { low: 1, medium: 2, high: 3, critical: 5 },
    absoluteChange: { low: 0.5, medium: 1, high: 2, critical: 3 },
  },
  CPI: {
    changePercent: { low: 0.5, medium: 1, high: 2, critical: 3 },
    absoluteChange: { low: 0.3, medium: 0.5, high: 1, critical: 2 },
  },
  PMI: {
    changePercent: { low: 2, medium: 5, high: 8, critical: 10 },
    absoluteChange: { low: 1, medium: 2, high: 3, critical: 5 },
  },
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

function determineSeverity(zScore: number, changePercent: number, indicator: string): 'low' | 'medium' | 'high' | 'critical' {
  const thresholds = THRESHOLDS[indicator as keyof typeof THRESHOLDS];
  if (!thresholds) return 'low';

  const absChangePercent = Math.abs(changePercent);

  // Use both z-score and absolute change to determine severity
  if (absChangePercent >= thresholds.changePercent.critical || Math.abs(zScore) >= 3) {
    return 'critical';
  }
  if (absChangePercent >= thresholds.changePercent.high || Math.abs(zScore) >= 2.5) {
    return 'high';
  }
  if (absChangePercent >= thresholds.changePercent.medium || Math.abs(zScore) >= 2) {
    return 'medium';
  }
  if (absChangePercent >= thresholds.changePercent.low || Math.abs(zScore) >= 1.5) {
    return 'low';
  }

  return 'low';
}

function generateAlertMessage(
  indicator: string,
  type: 'anomaly' | 'trend_break' | 'threshold_breach',
  severity: 'low' | 'medium' | 'high' | 'critical',
  currentValue: number,
  changePercent: number
): string {
  const direction = changePercent > 0 ? i18n.t('macroAlert.k1') : i18n.t('macroAlert.k2');
  const absChange = Math.abs(changePercent).toFixed(2);

  const severityText = {
    low: i18n.t('macroAlert.k3'),
    medium: i18n.t('macroAlert.k4'),
    high: i18n.t('macroAlert.k5'),
    critical: i18n.t('macroAlert.k6'),
  }[severity];

  const typeText = {
    anomaly: i18n.t('macroAlert.k7'),
    trend_break: i18n.t('macroAlert.k8'),
    threshold_breach: i18n.t('macroAlert.k9'),
  }[type];

  return i18n.t('macroAlert.k10');
}

function generateContext(
  indicator: string,
  currentValue: number,
  historicalAvg: number,
  historicalStdDev: number,
  zScore: number
): string {
  const avgText = historicalAvg.toFixed(2);
  const stdDevText = historicalStdDev.toFixed(2);
  const zScoreText = zScore.toFixed(2);

  let context = i18n.t('macroAlert.k11');

  if (Math.abs(zScore) >= 2) {
    context += ` (${zScore > 0 ? i18n.t('macroAlert.k12') : i18n.t('macroAlert.k13')}${i18n.t('MacroAlert.k0')} ${Math.abs(zScore).toFixed(1)} ${i18n.t('MacroAlert.k1')}`;
  }

  return context;
}

// ── Main Function ──────────────────────────────────────────────────────────

export async function detectMacroAnomalies(
  currentData: MacroDataPoint[],
  historicalData: Map<string, number[]>
): Promise<MacroAlertResult> {
  if (!currentData || currentData.length === 0) {
    return {
      success: false,
      alerts: [],
      summary: {
        totalAlerts: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        indicatorsAnalyzed: [],
      },
      timestamp: Date.now(),
      error: 'No data provided',
    };
  }

  log.info(`[MacroAlert] Analyzing ${currentData.length} data points`);

  const alerts: MacroAlert[] = [];
  const indicatorsAnalyzed = new Set<string>();

  for (const point of currentData) {
    const { indicator, value, previousValue, change, changePercent } = point;
    indicatorsAnalyzed.add(indicator);

    // Get historical data for statistical analysis
    const historicalValues = historicalData.get(indicator) || [];
    const historicalAvg = calculateMean(historicalValues);
    const historicalStdDev = calculateStdDev(historicalValues);
    const zScore = calculateZScore(value, historicalAvg, historicalStdDev);

    // Determine alert type
    let alertType: 'anomaly' | 'trend_break' | 'threshold_breach' = 'anomaly';
    const absChangePercent = Math.abs(changePercent);

    // Check if it's a trend break (large change from previous)
    if (absChangePercent >= 5) {
      alertType = 'trend_break';
    }

    // Check if it breaches thresholds
    const thresholds = THRESHOLDS[indicator as keyof typeof THRESHOLDS];
    if (thresholds && absChangePercent >= thresholds.changePercent.medium) {
      alertType = 'threshold_breach';
    }

    // Determine severity
    const severity = determineSeverity(zScore, changePercent, indicator);

    // Only create alert if severity is medium or higher
    if (severity === 'low') continue;

    const alert: MacroAlert = {
      id: `macro-${indicator}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      indicator,
      severity,
      type: alertType,
      message: generateAlertMessage(indicator, alertType, severity, value, changePercent),
      details: {
        currentValue: value,
        previousValue,
        change,
        changePercent,
        threshold: thresholds?.changePercent[severity],
        historicalAvg,
        historicalStdDev,
      },
      context: generateContext(indicator, value, historicalAvg, historicalStdDev, zScore),
    };

    alerts.push(alert);
  }

  // Calculate summary
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  const result: MacroAlertResult = {
    success: true,
    alerts,
    summary: {
      totalAlerts: alerts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      indicatorsAnalyzed: Array.from(indicatorsAnalyzed),
    },
    timestamp: Date.now(),
  };

  log.info(`[MacroAlert] Done: ${alerts.length} alerts (${criticalCount} critical, ${highCount} high, ${mediumCount} medium)`);

  return result;
}

// ── Batch Analysis ─────────────────────────────────────────────────────────

export async function analyzeMultipleIndicators(
  indicatorData: { indicator: string; currentData: MacroDataPoint[]; historicalData: number[] }[]
): Promise<MacroAlertResult> {
  log.info(`[MacroAlert] Analyzing ${indicatorData.length} indicators`);

  const allCurrentData: MacroDataPoint[] = [];
  const historicalMap = new Map<string, number[]>();

  for (const { indicator, currentData, historicalData } of indicatorData) {
    allCurrentData.push(...currentData);
    historicalMap.set(indicator, historicalData);
  }

  return detectMacroAnomalies(allCurrentData, historicalMap);
}

// ── Real-time Monitoring ───────────────────────────────────────────────────

export interface MacroMonitorConfig {
  indicators: string[];
  checkInterval: number;    // milliseconds
  alertThreshold: 'low' | 'medium' | 'high' | 'critical';
}

export class MacroMonitor {
  private config: MacroMonitorConfig;
  private historicalData: Map<string, number[]>;
  private intervalId: NodeJS.Timeout | null = null;
  private onAlertCallback: ((alert: MacroAlert) => void) | null = null;

  constructor(config: MacroMonitorConfig) {
    this.config = config;
    this.historicalData = new Map();
  }

  setHistoricalData(indicator: string, values: number[]): void {
    this.historicalData.set(indicator, values);
  }

  setAlertCallback(callback: (alert: MacroAlert) => void): void {
    this.onAlertCallback = callback;
  }

  async checkAnomalies(currentData: MacroDataPoint[]): Promise<MacroAlertResult> {
    const result = await detectMacroAnomalies(currentData, this.historicalData);

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
      summary: {
        ...result.summary,
        totalAlerts: filteredAlerts.length,
      },
    };
  }

  startMonitoring(fetchData: () => Promise<MacroDataPoint[]>): void {
    if (this.intervalId) return;

    log.info(`[MacroMonitor] Starting monitoring with ${this.config.checkInterval}ms interval`);

    this.intervalId = setInterval(async () => {
      try {
        const currentData = await fetchData();
        await this.checkAnomalies(currentData);
      } catch (err: unknown) {
        log.error('[MacroMonitor] Check failed:', err);
      }
    }, this.config.checkInterval);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('[MacroMonitor] Monitoring stopped');
    }
  }
}
