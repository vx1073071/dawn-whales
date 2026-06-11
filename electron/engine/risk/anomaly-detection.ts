/**
 * JVS-89: anomaly detection
 * 
 * method
 * volume、volatility
 */

import { EventEmitter } from 'events';
import { AnomalyDetector } from '../analysis/anomaly-detector';
import log from 'electron-log';
import i18n from '../../../src/i18n';

export interface AnomalyAlert {
  id: string;
  timestamp: number;
  type: 'price_anomaly' | 'volume_anomaly' | 'volatility_anomaly' | 'correlation_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  symbol?: string;
  description: string;
  value: number;
  threshold: number;
  metadata?: Record<string, any>;
}

export interface AnomalyConfig {
  enabled: boolean;
  methods: AnomalyMethod[];
  thresholds: {
    price: number;      // price deviation in std devs
    volume: number;     // volume deviation in std devs
    volatility: number; // volatility deviation in std devs
  };
  windowSize: number;   // historical data window size
  checkInterval: number; // check interval (ms)
}

export interface AnomalyMethod {
  name: 'zscore' | 'iqr' | 'mad' | 'isolation_forest';
  enabled: boolean;
  weight: number;
}

const DEFAULT_CONFIG: AnomalyConfig = {
  enabled: true,
  methods: [
    { name: 'zscore', enabled: true, weight: 0.4 },
    { name: 'iqr', enabled: true, weight: 0.3 },
    { name: 'mad', enabled: true, weight: 0.2 },
    { name: 'isolation_forest', enabled: false, weight: 0.1 },
  ],
  thresholds: {
    price: 3.0,      // 3 std devs
    volume: 3.0,
    volatility: 3.0,
  },
  windowSize: 100,
  checkInterval: 60000, // 1 minute
};

export class AnomalyDetectionSystem extends EventEmitter {
  private config: AnomalyConfig;
  private alerts: AnomalyAlert[] = [];
  private detector: AnomalyDetector;
  private priceHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private volatilityHistory: Map<string, number[]> = new Map();
  private checkTimer?: NodeJS.Timeout;
  private maxHistory = 1000;

  constructor(config?: Partial<AnomalyConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detector = new AnomalyDetector(this.config.methods);
  }

  /**
 * anomaly detection
   */
  start(): void {
    if (this.checkTimer) {
      this.stop();
    }

    this.checkTimer = setInterval(() => {
      this.checkAllAnomalies();
    }, this.config.checkInterval);

    log.info(`[AnomalyDetection] Started with interval ${this.config.checkInterval}ms`);
  }

  /**
   * stopanomaly detection
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      log.info('[AnomalyDetection] Stopped');
    }
  }

  /**
 *
   */
  detectAnomalies(symbol: string, data: {
    price: number;
    volume: number;
    volatility?: number;
  }): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

 // update
    this.updateHistory(symbol, data);

 // anomaly detection
    const priceAnomaly = this.detectPriceAnomaly(symbol, data.price);
    if (priceAnomaly) {
      alerts.push(priceAnomaly);
    }

    // volumeanomaly detection
    const volumeAnomaly = this.detectVolumeAnomaly(symbol, data.volume);
    if (volumeAnomaly) {
      alerts.push(volumeAnomaly);
    }

    // volatilityanomaly detection
    if (data.volatility !== undefined) {
      const volatilityAnomaly = this.detectVolatilityAnomaly(symbol, data.volatility);
      if (volatilityAnomaly) {
        alerts.push(volatilityAnomaly);
      }
    }

 // event
    alerts.forEach(alert => {
      this.emit('anomaly', alert);
    });

    return alerts;
  }

  /**
 *
   */
  private checkAllAnomalies(): void {
 // methoddata source
 // ，data pipeline
    log.info('[AnomalyDetection] Checking all anomalies...');
  }

  /**
 *
   */
  private detectPriceAnomaly(symbol: string, price: number): AnomalyAlert | null {
    const history = this.priceHistory.get(symbol) || [];
    if (history.length < this.config.windowSize) {
      return null;
    }

    const zscore = this.detector.zscore(price, history);
    const iqr = this.detector.iqr(price, history);

    if (Math.abs(zscore) > this.config.thresholds.price) {
      return {
        id: this.generateAlertId(),
        timestamp: Date.now(),
        type: 'price_anomaly',
        severity: this.getSeverity(zscore),
        symbol,
        description: i18n.t('anomalyDetection.k1'),
        value: price,
        threshold: this.config.thresholds.price,
        metadata: { zscore, method: 'zscore' },
      };
    }

    return null;
  }

  /**
 * volume
   */
  private detectVolumeAnomaly(symbol: string, volume: number): AnomalyAlert | null {
    const history = this.volumeHistory.get(symbol) || [];
    if (history.length < this.config.windowSize) {
      return null;
    }

    const zscore = this.detector.zscore(volume, history);
    const iqr = this.detector.iqr(volume, history);

    if (Math.abs(zscore) > this.config.thresholds.volume) {
      return {
        id: this.generateAlertId(),
        timestamp: Date.now(),
        type: 'volume_anomaly',
        severity: this.getSeverity(zscore),
        symbol,
        description: i18n.t('anomalyDetection.k2'),
        value: volume,
        threshold: this.config.thresholds.volume,
        metadata: { zscore, method: 'zscore' },
      };
    }

    return null;
  }

  /**
 * volatility
   */
  private detectVolatilityAnomaly(symbol: string, volatility: number): AnomalyAlert | null {
    const history = this.volatilityHistory.get(symbol) || [];
    if (history.length < this.config.windowSize) {
      return null;
    }

    const zscore = this.detector.zscore(volatility, history);

    if (Math.abs(zscore) > this.config.thresholds.volatility) {
      return {
        id: this.generateAlertId(),
        timestamp: Date.now(),
        type: 'volatility_anomaly',
        severity: this.getSeverity(zscore),
        symbol,
        description: i18n.t('anomalyDetection.k3'),
        value: volatility,
        threshold: this.config.thresholds.volatility,
        metadata: { zscore, method: 'zscore' },
      };
    }

    return null;
  }

  /**
 * Z-Score
   */
  private getSeverity(zscore: number): 'low' | 'medium' | 'high' | 'critical' {
    const abs = Math.abs(zscore);
    if (abs > 5) return 'critical';
    if (abs > 4) return 'high';
    if (abs > 3) return 'medium';
    return 'low';
  }

  /**
 * update
   */
  private updateHistory(symbol: string, data: {
    price: number;
    volume: number;
    volatility?: number;
  }): void {
 //
    const priceHistory = this.priceHistory.get(symbol) || [];
    priceHistory.push(data.price);
    if (priceHistory.length > this.maxHistory) {
      priceHistory.shift();
    }
    this.priceHistory.set(symbol, priceHistory);

 // volume
    const volumeHistory = this.volumeHistory.get(symbol) || [];
    volumeHistory.push(data.volume);
    if (volumeHistory.length > this.maxHistory) {
      volumeHistory.shift();
    }
    this.volumeHistory.set(symbol, volumeHistory);

 // volatility
    if (data.volatility !== undefined) {
      const volatilityHistory = this.volatilityHistory.get(symbol) || [];
      volatilityHistory.push(data.volatility);
      if (volatilityHistory.length > this.maxHistory) {
        volatilityHistory.shift();
      }
      this.volatilityHistory.set(symbol, volatilityHistory);
    }
  }

  /**
 * ID
   */
  private generateAlertId(): string {
    return `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
 *
   */
  getAlerts(): AnomalyAlert[] {
    return [...this.alerts];
  }

  /**
 *
   */
  getAlertsBySymbol(symbol: string): AnomalyAlert[] {
    return this.alerts.filter(alert => alert.symbol === symbol);
  }

  /**
 *
   */
  getAlertsByType(type: AnomalyAlert['type']): AnomalyAlert[] {
    return this.alerts.filter(alert => alert.type === type);
  }

  /**
 * confirm
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
 // confirm（acknowledged）
      return true;
    }
    return false;
  }

  /**
 * clear
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
 * info
   */
  getStats(): {
    totalAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    bySymbol: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const bySymbol: Record<string, number> = {};

    this.alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      if (alert.symbol) {
        bySymbol[alert.symbol] = (bySymbol[alert.symbol] || 0) + 1;
      }
    });

    return {
      totalAlerts: this.alerts.length,
      byType,
      bySeverity,
      bySymbol,
    };
  }
}

//
let anomalyDetectionInstance: AnomalyDetectionSystem | null = null;

export function getAnomalyDetectionSystem(config?: Partial<AnomalyConfig>): AnomalyDetectionSystem {
  if (!anomalyDetectionInstance) {
    anomalyDetectionInstance = new AnomalyDetectionSystem(config);
  }
  return anomalyDetectionInstance;
}
