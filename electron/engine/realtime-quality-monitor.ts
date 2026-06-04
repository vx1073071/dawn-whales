// ── JVS-50: Real-time Data Quality Monitor ──────────────────────────────────
// Real-time monitoring of data quality with alerts and metrics
// Features: quality scoring, anomaly detection, alert system, performance metrics
// Requirements: >=500 lines, >=5 tests, benchmark, design doc

import { EventEmitter as NodeEventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DataQualityMetrics {
  freshness: number;        // 0-100, data freshness score
  completeness: number;     // 0-100, data completeness
  consistency: number;      // 0-100, data consistency
  latency: number;          // 0-100, data latency score
  overall: number;          // 0-100, overall quality score
}

export interface QualityAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: DataQualityMetrics;
  details?: Record<string, any>;
}

export interface QualityThreshold {
  freshness: number;        // Min freshness score
  completeness: number;     // Min completeness score
  consistency: number;      // Min consistency score
  latency: number;          // Min latency score
  overall: number;          // Min overall score
}

export interface QualityMonitorConfig {
  thresholds: QualityThreshold;
  alertInterval: number;    // Alert interval (ms)
  enableAlerts: boolean;
  enableMetrics: boolean;
  maxAlerts: number;        // Max alerts to keep
}

export interface QualityStats {
  totalChecks: number;
  alertsTriggered: number;
  avgQuality: number;
  worstQuality: number;
  bestQuality: number;
  uptime: number;
}

// ── Data Quality Calculator ────────────────────────────────────────────────

export class DataQualityCalculator {
  /**
   * Calculate data quality metrics
   */
  static calculateQuality(data: any, timestamp?: number): DataQualityMetrics {
    const freshness = this.calculateFreshness(data, timestamp);
    const completeness = this.calculateCompleteness(data);
    const consistency = this.calculateConsistency(data);
    const latency = this.calculateLatency(data, timestamp);
    
    const overall = (freshness + completeness + consistency + latency) / 4;

    return {
      freshness,
      completeness,
      consistency,
      latency,
      overall,
    };
  }

  /**
   * Calculate freshness score (0-100)
   * Based on how recent the data is
   */
  static calculateFreshness(data: any, timestamp?: number): number {
    if (!data || !timestamp) return 0;
    
    const age = Date.now() - timestamp;
    const maxAge = 60000; // 60 seconds
    
    if (age >= maxAge) return 0;
    return Math.max(0, 100 - (age / maxAge) * 100);
  }

  /**
   * Calculate completeness score (0-100)
   * Based on percentage of required fields present
   */
  static calculateCompleteness(data: any): number {
    if (!data || typeof data !== 'object') return 0;
    
    const requiredFields = ['price', 'volume', 'timestamp'];
    const optionalFields = ['high', 'low', 'open', 'close'];
    
    let present = 0;
    let total = requiredFields.length + optionalFields.length;
    
    for (const field of requiredFields) {
      if (data[field] !== undefined && data[field] !== null) {
        present++;
      }
    }
    
    for (const field of optionalFields) {
      if (data[field] !== undefined && data[field] !== null) {
        present++;
      }
    }
    
    return Math.round((present / total) * 100);
  }

  /**
   * Calculate consistency score (0-100)
   * Based on data validation and consistency checks
   */
  static calculateConsistency(data: any): number {
    if (!data || typeof data !== 'object') return 0;
    
    let score = 100;
    
    // Check price consistency
    if (data.price !== undefined) {
      if (typeof data.price !== 'number' || data.price <= 0) {
        score -= 30;
      }
    }
    
    // Check volume consistency
    if (data.volume !== undefined) {
      if (typeof data.volume !== 'number' || data.volume < 0) {
        score -= 20;
      }
    }
    
    // Check timestamp consistency
    if (data.timestamp !== undefined) {
      if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
        score -= 20;
      }
    }
    
    // Check high/low consistency
    if (data.high !== undefined && data.low !== undefined) {
      if (data.high < data.low) {
        score -= 25;
      }
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate latency score (0-100)
   * Based on data latency
   */
  static calculateLatency(data: any, timestamp?: number): number {
    if (!data || !timestamp) return 0;
    
    const latency = Date.now() - timestamp;
    const maxLatency = 30000; // 30 seconds
    
    if (latency >= maxLatency) return 0;
    return Math.max(0, 100 - (latency / maxLatency) * 100);
  }

  /**
   * Compare two data points for consistency
   */
  static compareDataPoints(data1: any, data2: any): number {
    if (!data1 || !data2) return 0;
    
    let score = 100;
    
    // Compare prices
    if (data1.price !== undefined && data2.price !== undefined) {
      const diff = Math.abs(data1.price - data2.price);
      const maxDiff = data1.price * 0.1; // 10% difference
      if (diff > maxDiff) {
        score -= 30;
      }
    }
    
    // Compare volumes
    if (data1.volume !== undefined && data2.volume !== undefined) {
      const diff = Math.abs(data1.volume - data2.volume);
      const maxDiff = data1.volume * 0.5; // 50% difference
      if (diff > maxDiff) {
        score -= 20;
      }
    }
    
    return Math.max(0, score);
  }
}

// ── Quality Monitor ────────────────────────────────────────────────────────

export class RealtimeQualityMonitor extends NodeEventEmitter {
  private config: QualityMonitorConfig;
  private alerts: QualityAlert[] = [];
  private stats: QualityStats;
  private startTime: number;
  private alertIdCounter = 0;
  private alertTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<QualityMonitorConfig>) {
    super();
    
    this.config = {
      thresholds: config?.thresholds ?? {
        freshness: 60,
        completeness: 70,
        consistency: 75,
        latency: 65,
        overall: 70,
      },
      alertInterval: config?.alertInterval ?? 5000,
      enableAlerts: config?.enableAlerts ?? true,
      enableMetrics: config?.enableMetrics ?? true,
      maxAlerts: config?.maxAlerts ?? 100,
    };

    this.stats = {
      totalChecks: 0,
      alertsTriggered: 0,
      avgQuality: 0,
      worstQuality: 100,
      bestQuality: 0,
      uptime: 0,
    };

    this.startTime = Date.now();
  }

  /**
   * Check data quality and trigger alerts if needed
   */
  checkQuality(data: any, timestamp?: number): DataQualityMetrics {
    const metrics = DataQualityCalculator.calculateQuality(data, timestamp);
    this.stats.totalChecks++;

    // Update stats
    if (this.config.enableMetrics) {
      this.updateStats(metrics);
    }

    // Check thresholds and trigger alerts
    if (this.config.enableAlerts) {
      this.checkThresholds(metrics, data);
    }

    return metrics;
  }

  /**
   * Update quality statistics
   */
  private updateStats(metrics: DataQualityMetrics): void {
    const quality = metrics.overall;
    
    // Update average quality
    this.stats.avgQuality = (this.stats.avgQuality * (this.stats.totalChecks - 1) + quality) / this.stats.totalChecks;
    
    // Update worst/best quality
    if (quality < this.stats.worstQuality) {
      this.stats.worstQuality = quality;
    }
    if (quality > this.stats.bestQuality) {
      this.stats.bestQuality = quality;
    }
    
    // Update uptime
    this.stats.uptime = Date.now() - this.startTime;
  }

  /**
   * Check thresholds and trigger alerts
   */
  private checkThresholds(metrics: DataQualityMetrics, data: any): void {
    const alerts: QualityAlert[] = [];
    const timestamp = Date.now();

    // Check each metric against threshold
    if (metrics.freshness < this.config.thresholds.freshness) {
      alerts.push({
        id: this.generateAlertId(),
        timestamp,
        severity: this.getSeverity(metrics.freshness, this.config.thresholds.freshness),
        message: `Freshness below threshold: ${metrics.freshness.toFixed(2)} < ${this.config.thresholds.freshness}`,
        metrics,
        details: { metric: 'freshness', threshold: this.config.thresholds.freshness },
      });
    }

    if (metrics.completeness < this.config.thresholds.completeness) {
      alerts.push({
        id: this.generateAlertId(),
        timestamp,
        severity: this.getSeverity(metrics.completeness, this.config.thresholds.completeness),
        message: `Completeness below threshold: ${metrics.completeness.toFixed(2)} < ${this.config.thresholds.completeness}`,
        metrics,
        details: { metric: 'completeness', threshold: this.config.thresholds.completeness },
      });
    }

    if (metrics.consistency < this.config.thresholds.consistency) {
      alerts.push({
        id: this.generateAlertId(),
        timestamp,
        severity: this.getSeverity(metrics.consistency, this.config.thresholds.consistency),
        message: `Consistency below threshold: ${metrics.consistency.toFixed(2)} < ${this.config.thresholds.consistency}`,
        metrics,
        details: { metric: 'consistency', threshold: this.config.thresholds.consistency },
      });
    }

    if (metrics.latency < this.config.thresholds.latency) {
      alerts.push({
        id: this.generateAlertId(),
        timestamp,
        severity: this.getSeverity(metrics.latency, this.config.thresholds.latency),
        message: `Latency below threshold: ${metrics.latency.toFixed(2)} < ${this.config.thresholds.latency}`,
        metrics,
        details: { metric: 'latency', threshold: this.config.thresholds.latency },
      });
    }

    if (metrics.overall < this.config.thresholds.overall) {
      alerts.push({
        id: this.generateAlertId(),
        timestamp,
        severity: this.getSeverity(metrics.overall, this.config.thresholds.overall),
        message: `Overall quality below threshold: ${metrics.overall.toFixed(2)} < ${this.config.thresholds.overall}`,
        metrics,
        details: { metric: 'overall', threshold: this.config.thresholds.overall },
      });
    }

    // Add alerts and emit events
    for (const alert of alerts) {
      this.addAlert(alert);
      this.emit('alert', alert);
    }
  }

  /**
   * Add alert to history
   */
  private addAlert(alert: QualityAlert): void {
    this.alerts.push(alert);
    this.stats.alertsTriggered++;

    // Enforce max alerts
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts.shift();
    }
  }

  /**
   * Get severity based on how far below threshold
   */
  private getSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const diff = threshold - value;
    if (diff > 30) return 'critical';
    if (diff > 20) return 'high';
    if (diff > 10) return 'medium';
    return 'low';
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${++this.alertIdCounter}`;
  }

  /**
   * Get all alerts
   */
  getAlerts(): QualityAlert[] {
    return [...this.alerts];
  }

  /**
   * Get statistics
   */
  getStats(): QualityStats {
    return { ...this.stats };
  }

  /**
   * Clear alerts
   */
  clearAlerts(): number {
    const count = this.alerts.length;
    this.alerts = [];
    return count;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      alertsTriggered: 0,
      avgQuality: 0,
      worstQuality: 100,
      bestQuality: 0,
      uptime: 0,
    };
    this.startTime = Date.now();
  }

  /**
   * Close monitor
   */
  close(): void {
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let qualityMonitor: RealtimeQualityMonitor | null = null;

export function getRealtimeQualityMonitor(): RealtimeQualityMonitor {
  if (!qualityMonitor) {
    qualityMonitor = new RealtimeQualityMonitor();
  }
  return qualityMonitor;
}

// ── Benchmark ──────────────────────────────────────────────────────────────

export function benchmarkQualityMonitor(iterations: number = 1000): {
  checkQualityTime: number;
  calculateFreshnessTime: number;
  calculateCompletenessTime: number;
  calculateConsistencyTime: number;
  calculateLatencyTime: number;
} {
  const monitor = getRealtimeQualityMonitor();

  // Create test data
  const testData = {
    price: 150.50,
    volume: 1000000,
    timestamp: Date.now(),
    high: 151.00,
    low: 149.50,
    open: 150.00,
    close: 150.50,
  };

  // Benchmark checkQuality
  const checkStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    monitor.checkQuality(testData, Date.now());
  }
  const checkQualityTime = (Date.now() - checkStart) / iterations;

  // Benchmark calculateFreshness
  const freshnessStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    DataQualityCalculator.calculateFreshness(testData, Date.now());
  }
  const calculateFreshnessTime = (Date.now() - freshnessStart) / iterations;

  // Benchmark calculateCompleteness
  const completenessStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    DataQualityCalculator.calculateCompleteness(testData);
  }
  const calculateCompletenessTime = (Date.now() - completenessStart) / iterations;

  // Benchmark calculateConsistency
  const consistencyStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    DataQualityCalculator.calculateConsistency(testData);
  }
  const calculateConsistencyTime = (Date.now() - consistencyStart) / iterations;

  // Benchmark calculateLatency
  const latencyStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    DataQualityCalculator.calculateLatency(testData, Date.now());
  }
  const calculateLatencyTime = (Date.now() - latencyStart) / iterations;

  return {
    checkQualityTime,
    calculateFreshnessTime,
    calculateCompletenessTime,
    calculateConsistencyTime,
    calculateLatencyTime,
  };
}
