/**
 * JVS-84: Data Quality Monitoring System
 * 
 * Monitors data quality metrics in real-time:
 * - Freshness: How recent is the data?
 * - Completeness: Are all required fields present?
 * - Consistency: Are values within expected ranges?
 * - Timeliness: Is data arriving on schedule?
 * 
 * Features:
 * - Real-time quality scoring (0-100)
 * - Anomaly detection for quality degradation
 * - Alert system for critical issues
 * - Quality trend tracking
 * - Data lineage tracking
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface QualityMetric {
  metric: string;
  value: number;
  unit: string;
  timestamp: number;
  source?: string;
}

export interface QualityScore {
  overall: number;           // 0-100
  freshness: number;         // 0-100
  completeness: number;      // 0-100
  consistency: number;       // 0-100
  timeliness: number;        // 0-100
  timestamp: number;
}

export interface QualityAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  acknowledged: boolean;
}

export interface QualityConfig {
  thresholds: {
    freshness: number;       // Max age in seconds
    completeness: number;    // Min percentage (0-100)
    consistency: number;     // Min percentage (0-100)
    timeliness: number;      // Max delay in seconds
  };
  alerts: {
    enabled: boolean;
    levels: {
      warning: number;       // Threshold for warning (0-100)
      critical: number;      // Threshold for critical (0-100)
    };
  };
  sampling: {
    windowSize: number;      // Number of samples to keep
    sampleInterval: number;  // Sample every N milliseconds
  };
}

export interface DataLineage {
  source: string;
  destination: string;
  timestamp: number;
  records: number;
  latency: number;         // ms
}

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG: QualityConfig = {
  thresholds: {
    freshness: 300,          // 5 minutes
    completeness: 95,        // 95%
    consistency: 90,         // 90%
    timeliness: 60,          // 60 seconds
  },
  alerts: {
    enabled: true,
    levels: {
      warning: 70,           // Alert if score < 70
      critical: 50,          // Alert if score < 50
    },
  },
  sampling: {
    windowSize: 100,
    sampleInterval: 60000,   // 1 minute
  },
};

// ── Data Quality Monitor ───────────────────────────────────────────────────

export class DataQualityMonitor extends EventEmitter {
  private config: QualityConfig;
  private metrics: Map<string, QualityMetric[]> = new Map();
  private alerts: QualityAlert[] = [];
  private lineage: DataLineage[] = [];
  private lastUpdate: number = Date.now();
  private sampleTimer?: NodeJS.Timeout;

  constructor(config?: Partial<QualityConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Record a new metric sample
   */
  recordMetric(metric: QualityMetric): void {
    if (!this.metrics.has(metric.metric)) {
      this.metrics.set(metric.metric, []);
    }

    const samples = this.metrics.get(metric.metric)!;
    samples.push(metric);

    // Keep only last N samples
    if (samples.length > this.config.sampling.windowSize) {
      samples.shift();
    }

    this.lastUpdate = Date.now();
    this.emit('metric', metric);

    // Check if alert needed
    if (this.config.alerts.enabled) {
      this.checkAlerts(metric);
    }
  }

  /**
   * Record data lineage event
   */
  recordLineage(lineage: DataLineage): void {
    this.lineage.push(lineage);

    // Keep only last 100 lineage events
    if (this.lineage.length > 100) {
      this.lineage.shift();
    }

    this.emit('lineage', lineage);
  }

  /**
   * Calculate current quality score
   */
  calculateScore(): QualityScore {
    const now = Date.now();
    
    // Calculate freshness (based on last update time)
    const age = (now - this.lastUpdate) / 1000; // seconds
    const freshness = Math.max(0, 100 - (age / this.config.thresholds.freshness) * 100);

    // Calculate completeness (based on metric availability)
    const expectedMetrics = ['freshness', 'completeness', 'consistency', 'timeliness'];
    const availableMetrics = expectedMetrics.filter(m => this.metrics.has(m));
    const completeness = (availableMetrics.length / expectedMetrics.length) * 100;

    // Calculate consistency (based on metric stability)
    const consistency = this.calculateConsistency();

    // Calculate timeliness (based on update frequency)
    const timeliness = this.calculateTimeliness();

    // Calculate overall score (weighted average)
    const overall = (freshness * 0.25 + completeness * 0.3 + consistency * 0.3 + timeliness * 0.25);

    return {
      overall: Math.max(0, Math.min(100, overall)),
      freshness: Math.max(0, Math.min(100, freshness)),
      completeness: Math.max(0, Math.min(100, completeness)),
      consistency: Math.max(0, Math.min(100, consistency)),
      timeliness: Math.max(0, Math.min(100, timeliness)),
      timestamp: now,
    };
  }

  /**
   * Get all alerts
   */
  getAlerts(): QualityAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get quality trend over time
   */
  getQualityTrend(samples: number = 20): QualityScore[] {
    const trend: QualityScore[] = [];
    const samplesPerMetric = new Map<string, QualityMetric[]>();

    // Collect last N samples for each metric
    for (const [metric, samples] of this.metrics.entries()) {
      samplesPerMetric.set(metric, samples.slice(-samples));
    }

    // Calculate scores at different time points
    const numPoints = Math.min(samples, 20);
    for (let i = 0; i < numPoints; i++) {
      const pointInTime = Date.now() - (numPoints - i) * 60000; // 1 minute intervals
      const score = this.calculateScoreAtTime(pointInTime);
      trend.push(score);
    }

    return trend;
  }

  /**
   * Start periodic sampling
   */
  startSampling(): void {
    if (this.sampleTimer) return;

    this.sampleTimer = setInterval(() => {
      this.emit('sample', this.calculateScore());
    }, this.config.sampling.sampleInterval);
  }

  /**
   * Stop periodic sampling
   */
  stopSampling(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = undefined;
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    running: boolean;
    lastUpdate: number;
    metricCount: number;
    alertCount: number;
    lineageCount: number;
  } {
    return {
      running: this.sampleTimer !== undefined,
      lastUpdate: this.lastUpdate,
      metricCount: this.metrics.size,
      alertCount: this.alerts.length,
      lineageCount: this.lineage.length,
    };
  }

  // ── Private Methods ────────────────────────────────────────────────────

  private calculateConsistency(): number {
    if (this.metrics.size === 0) return 100;

    let totalConsistency = 0;
    let count = 0;

    for (const samples of this.metrics.values()) {
      if (samples.length < 2) continue;

      // Calculate standard deviation
      const values = samples.map(s => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Consistency: lower variance = higher consistency
      const maxVariance = 100; // Arbitrary max
      const consistency = Math.max(0, 100 - (stdDev / maxVariance) * 100);
      totalConsistency += consistency;
      count++;
    }

    return count > 0 ? totalConsistency / count : 100;
  }

  private calculateTimeliness(): number {
    const now = Date.now();
    const age = (now - this.lastUpdate) / 1000; // seconds
    const maxDelay = this.config.thresholds.timeliness;
    
    return Math.max(0, 100 - (age / maxDelay) * 100);
  }

  private calculateScoreAtTime(timestamp: number): QualityScore {
    // Simplified: just use current calculation
    // In production, you'd store historical scores
    return this.calculateScore();
  }

  private checkAlerts(metric: QualityMetric): void {
    const { warning, critical } = this.config.alerts.levels;
    
    // Check if metric value is below threshold
    if (metric.value < critical) {
      this.createAlert('critical', metric);
    } else if (metric.value < warning) {
      this.createAlert('warning', metric);
    }
  }

  private createAlert(level: 'warning' | 'critical', metric: QualityMetric): void {
    const alert: QualityAlert = {
      id: this.generateAlertId(),
      level,
      metric: metric.metric,
      message: `${metric.metric} is ${metric.value}${metric.unit}`,
      value: metric.value,
      threshold: level === 'critical' 
        ? this.config.alerts.levels.critical 
        : this.config.alerts.levels.warning,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let monitorInstance: DataQualityMonitor | null = null;

export function getDataQualityMonitor(config?: Partial<QualityConfig>): DataQualityMonitor {
  if (!monitorInstance) {
    monitorInstance = new DataQualityMonitor(config);
  }
  return monitorInstance;
}

export default DataQualityMonitor;
