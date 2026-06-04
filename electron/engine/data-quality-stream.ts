// ── Data Quality Stream Monitor (JVS-31) ────────────────────────────────────
// Real-time validation of WebSocket tick data
// Detects: price bounds, volume anomalies, timestamp gaps, stale data

import { EventEmitter } from 'events';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface QualityAlert {
  timestamp: number;
  type: 'price_out_of_bounds' | 'volume_anomaly' | 'timestamp_gap' | 'stale_data' | 'invalid_format';
  severity: 'low' | 'medium' | 'high';
  code: string;
  message: string;
  details: any;
}

export interface QualityMetrics {
  totalTicks: number;
  validTicks: number;
  invalidTicks: number;
  alertsGenerated: number;
  averageLatency: number;
  lastUpdate: number;
  uptime: number;
}

export interface StreamQualityStatus {
  monitoring: boolean;
  metrics: QualityMetrics;
  recentAlerts: QualityAlert[];
  symbolStats: Map<string, { ticks: number; alerts: number; lastUpdate: number }>;
}

// ── Quality Validator ──────────────────────────────────────────────────────

interface PriceBounds {
  min: number;
  max: number;
}

const DEFAULT_PRICE_BOUNDS: Record<string, PriceBounds> = {
  '600519': { min: 1000, max: 3000 },  // Moutai
  '000858': { min: 80, max: 250 },     // Wuliangye
  '601318': { min: 30, max: 80 },      // Ping An
  '000001': { min: 8, max: 20 },       // Ping An Bank
  '300750': { min: 100, max: 400 },    // CATL
  DEFAULT: { min: 0.01, max: 100000 }, // Fallback
};

const VOLUME_ANOMALY_THRESHOLD = 10; // 10x average
const TIMESTAMP_GAP_THRESHOLD = 60000; // 60 seconds
const STALE_DATA_THRESHOLD = 300000; // 5 minutes

// ── Data Quality Stream Monitor ────────────────────────────────────────────

class DataQualityStreamMonitor extends EventEmitter {
  private monitoring = false;
  private metrics: QualityMetrics = {
    totalTicks: 0,
    validTicks: 0,
    invalidTicks: 0,
    alertsGenerated: 0,
    averageLatency: 0,
    lastUpdate: 0,
    uptime: 0,
  };
  private recentAlerts: QualityAlert[] = [];
  private symbolStats = new Map<string, { ticks: number; alerts: number; lastUpdate: number }>();
  private lastTimestamps = new Map<string, number>();
  private volumeHistory = new Map<string, number[]>();
  private startTime = 0;

  constructor() {
    super();
    log.info('[DataQualityStream] Initialized');
  }

  start(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.startTime = Date.now();
    log.info('[DataQualityStream] Monitoring started');
  }

  stop(): void {
    if (!this.monitoring) return;
    this.monitoring = false;
    log.info('[DataQualityStream] Monitoring stopped');
  }

  validateTick(tick: any): boolean {
    if (!this.monitoring) return true;

    this.metrics.totalTicks++;
    const now = Date.now();
    let isValid = true;

    // Update symbol stats
    if (!this.symbolStats.has(tick.code)) {
      this.symbolStats.set(tick.code, { ticks: 0, alerts: 0, lastUpdate: 0 });
    }
    const stats = this.symbolStats.get(tick.code)!;
    stats.ticks++;

    // 1. Format validation
    if (!this.validateFormat(tick)) {
      isValid = false;
    }

    // 2. Price bounds validation
    if (!this.validatePriceBounds(tick)) {
      isValid = false;
    }

    // 3. Volume anomaly detection
    if (!this.validateVolume(tick)) {
      isValid = false;
    }

    // 4. Timestamp validation
    if (!this.validateTimestamp(tick, now)) {
      isValid = false;
    }

    // 5. Stale data detection
    if (!this.validateFreshness(tick, now)) {
      isValid = false;
    }

    // Update metrics
    if (isValid) {
      this.metrics.validTicks++;
    } else {
      this.metrics.invalidTicks++;
    }

    // Update latency
    const latency = now - tick.timestamp;
    this.metrics.averageLatency = (this.metrics.averageLatency * (this.metrics.totalTicks - 1) + latency) / this.metrics.totalTicks;

    // Update last update
    this.metrics.lastUpdate = now;
    stats.lastUpdate = now;
    this.lastTimestamps.set(tick.code, now);

    // Update uptime
    this.metrics.uptime = now - this.startTime;

    return isValid;
  }

  private validateFormat(tick: any): boolean {
    const requiredFields = ['code', 'price', 'volume', 'timestamp'];
    const missing = requiredFields.filter(f => tick[f] === undefined || tick[f] === null);

    if (missing.length > 0) {
      this.addAlert({
        timestamp: Date.now(),
        type: 'invalid_format',
        severity: 'high',
        code: tick.code || 'UNKNOWN',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { tick, missing },
      });
      return false;
    }

    if (typeof tick.price !== 'number' || typeof tick.volume !== 'number') {
      this.addAlert({
        timestamp: Date.now(),
        type: 'invalid_format',
        severity: 'high',
        code: tick.code,
        message: 'Invalid data types for price or volume',
        details: { price: typeof tick.price, volume: typeof tick.volume },
      });
      return false;
    }

    return true;
  }

  private validatePriceBounds(tick: any): boolean {
    const bounds = DEFAULT_PRICE_BOUNDS[tick.code] || DEFAULT_PRICE_BOUNDS.DEFAULT;

    if (tick.price < bounds.min || tick.price > bounds.max) {
      this.addAlert({
        timestamp: Date.now(),
        type: 'price_out_of_bounds',
        severity: 'high',
        code: tick.code,
        message: `Price ${tick.price} outside bounds [${bounds.min}, ${bounds.max}]`,
        details: { price: tick.price, bounds },
      });
      return false;
    }

    return true;
  }

  private validateVolume(tick: any): boolean {
    if (!this.volumeHistory.has(tick.code)) {
      this.volumeHistory.set(tick.code, []);
    }

    const history = this.volumeHistory.get(tick.code)!;
    history.push(tick.volume);

    // Keep last 100 volumes
    if (history.length > 100) {
      history.shift();
    }

    // Need at least 10 samples
    if (history.length < 10) {
      return true;
    }

    // Calculate average
    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    // Check anomaly
    if (tick.volume > avg * VOLUME_ANOMALY_THRESHOLD) {
      this.addAlert({
        timestamp: Date.now(),
        type: 'volume_anomaly',
        severity: 'medium',
        code: tick.code,
        message: `Volume ${tick.volume} is ${(tick.volume / avg).toFixed(1)}x average`,
        details: { volume: tick.volume, average: avg, ratio: tick.volume / avg },
      });
      return false;
    }

    return true;
  }

  private validateTimestamp(tick: any, now: number): boolean {
    const lastTimestamp = this.lastTimestamps.get(tick.code);

    if (lastTimestamp !== undefined) {
      const gap = tick.timestamp - lastTimestamp;

      if (gap > TIMESTAMP_GAP_THRESHOLD) {
        this.addAlert({
          timestamp: now,
          type: 'timestamp_gap',
          severity: 'medium',
          code: tick.code,
          message: `Timestamp gap: ${gap}ms (threshold: ${TIMESTAMP_GAP_THRESHOLD}ms)`,
          details: { gap, lastTimestamp, currentTimestamp: tick.timestamp },
        });
        return false;
      }
    }

    return true;
  }

  private validateFreshness(tick: any, now: number): boolean {
    const age = now - tick.timestamp;

    if (age > STALE_DATA_THRESHOLD) {
      this.addAlert({
        timestamp: now,
        type: 'stale_data',
        severity: 'low',
        code: tick.code,
        message: `Data is ${age}ms old (threshold: ${STALE_DATA_THRESHOLD}ms)`,
        details: { age, timestamp: tick.timestamp },
      });
      return false;
    }

    return true;
  }

  private addAlert(alert: QualityAlert): void {
    this.recentAlerts.push(alert);
    this.metrics.alertsGenerated++;

    // Update symbol stats
    const stats = this.symbolStats.get(alert.code);
    if (stats) {
      stats.alerts++;
    }

    // Keep last 50 alerts
    if (this.recentAlerts.length > 50) {
      this.recentAlerts.shift();
    }

    // Emit alert
    this.emit('alert', alert);

    log.warn(`[DataQualityStream] Alert: ${alert.type} for ${alert.code} - ${alert.message}`);
  }

  getStatus(): StreamQualityStatus {
    return {
      monitoring: this.monitoring,
      metrics: { ...this.metrics },
      recentAlerts: [...this.recentAlerts],
      symbolStats: new Map(this.symbolStats),
    };
  }

  clearAlerts(): void {
    this.recentAlerts = [];
    log.info('[DataQualityStream] Alerts cleared');
  }

  resetMetrics(): void {
    this.metrics = {
      totalTicks: 0,
      validTicks: 0,
      invalidTicks: 0,
      alertsGenerated: 0,
      averageLatency: 0,
      lastUpdate: 0,
      uptime: 0,
    };
    this.symbolStats.clear();
    log.info('[DataQualityStream] Metrics reset');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let dataQualityStreamInstance: DataQualityStreamMonitor | null = null;

export function getDataQualityStream(): DataQualityStreamMonitor {
  if (!dataQualityStreamInstance) {
    dataQualityStreamInstance = new DataQualityStreamMonitor();
  }
  return dataQualityStreamInstance;
}
