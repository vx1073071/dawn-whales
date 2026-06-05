/**
 * JVS-89: 异常检测系统
 * 
 * 使用统计方法和机器学习算法检测市场数据异常
 * 包括：价格异常、成交量异常、波动率异常
 */

import { EventEmitter } from 'events';
import { AnomalyDetector } from './anomaly-detector';

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
    price: number;      // 价格偏离标准差倍数
    volume: number;     // 成交量偏离标准差倍数
    volatility: number; // 波动率偏离标准差倍数
  };
  windowSize: number;   // 历史数据窗口大小
  checkInterval: number; // 检查间隔（毫秒）
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
    price: 3.0,      // 3个标准差
    volume: 3.0,
    volatility: 3.0,
  },
  windowSize: 100,
  checkInterval: 60000, // 1分钟
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
   * 启动异常检测
   */
  start(): void {
    if (this.checkTimer) {
      this.stop();
    }

    this.checkTimer = setInterval(() => {
      this.checkAllAnomalies();
    }, this.config.checkInterval);

    console.log(`[AnomalyDetection] Started with interval ${this.config.checkInterval}ms`);
  }

  /**
   * 停止异常检测
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      console.log('[AnomalyDetection] Stopped');
    }
  }

  /**
   * 检测单个股票的异常
   */
  detectAnomalies(symbol: string, data: {
    price: number;
    volume: number;
    volatility?: number;
  }): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];

    // 更新历史数据
    this.updateHistory(symbol, data);

    // 价格异常检测
    const priceAnomaly = this.detectPriceAnomaly(symbol, data.price);
    if (priceAnomaly) {
      alerts.push(priceAnomaly);
    }

    // 成交量异常检测
    const volumeAnomaly = this.detectVolumeAnomaly(symbol, data.volume);
    if (volumeAnomaly) {
      alerts.push(volumeAnomaly);
    }

    // 波动率异常检测
    if (data.volatility !== undefined) {
      const volatilityAnomaly = this.detectVolatilityAnomaly(symbol, data.volatility);
      if (volatilityAnomaly) {
        alerts.push(volatilityAnomaly);
      }
    }

    // 发送事件
    alerts.forEach(alert => {
      this.emit('anomaly', alert);
    });

    return alerts;
  }

  /**
   * 检测所有股票的异常
   */
  private checkAllAnomalies(): void {
    // 这个方法应该从实时数据源获取数据
    // 这里只是占位符，实际实现需要从数据管道获取数据
    console.log('[AnomalyDetection] Checking all anomalies...');
  }

  /**
   * 检测价格异常
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
        description: `价格异常: ${price.toFixed(2)} (Z-Score: ${zscore.toFixed(2)})`,
        value: price,
        threshold: this.config.thresholds.price,
        metadata: { zscore, method: 'zscore' },
      };
    }

    return null;
  }

  /**
   * 检测成交量异常
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
        description: `成交量异常: ${volume.toLocaleString()} (Z-Score: ${zscore.toFixed(2)})`,
        value: volume,
        threshold: this.config.thresholds.volume,
        metadata: { zscore, method: 'zscore' },
      };
    }

    return null;
  }

  /**
   * 检测波动率异常
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
        description: `波动率异常: ${volatility.toFixed(2)}% (Z-Score: ${zscore.toFixed(2)})`,
        value: volatility,
        threshold: this.config.thresholds.volatility,
        metadata: { zscore, method: 'zscore' },
      };
    }

    return null;
  }

  /**
   * 根据Z-Score确定严重程度
   */
  private getSeverity(zscore: number): 'low' | 'medium' | 'high' | 'critical' {
    const abs = Math.abs(zscore);
    if (abs > 5) return 'critical';
    if (abs > 4) return 'high';
    if (abs > 3) return 'medium';
    return 'low';
  }

  /**
   * 更新历史数据
   */
  private updateHistory(symbol: string, data: {
    price: number;
    volume: number;
    volatility?: number;
  }): void {
    // 价格历史
    const priceHistory = this.priceHistory.get(symbol) || [];
    priceHistory.push(data.price);
    if (priceHistory.length > this.maxHistory) {
      priceHistory.shift();
    }
    this.priceHistory.set(symbol, priceHistory);

    // 成交量历史
    const volumeHistory = this.volumeHistory.get(symbol) || [];
    volumeHistory.push(data.volume);
    if (volumeHistory.length > this.maxHistory) {
      volumeHistory.shift();
    }
    this.volumeHistory.set(symbol, volumeHistory);

    // 波动率历史
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
   * 生成告警ID
   */
  private generateAlertId(): string {
    return `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取所有告警
   */
  getAlerts(): AnomalyAlert[] {
    return [...this.alerts];
  }

  /**
   * 获取特定股票的告警
   */
  getAlertsBySymbol(symbol: string): AnomalyAlert[] {
    return this.alerts.filter(alert => alert.symbol === symbol);
  }

  /**
   * 获取特定类型的告警
   */
  getAlertsByType(type: AnomalyAlert['type']): AnomalyAlert[] {
    return this.alerts.filter(alert => alert.type === type);
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      // 标记为已确认（可以添加acknowledged字段）
      return true;
    }
    return false;
  }

  /**
   * 清空告警
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * 获取统计信息
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

// 单例
let anomalyDetectionInstance: AnomalyDetectionSystem | null = null;

export function getAnomalyDetectionSystem(config?: Partial<AnomalyConfig>): AnomalyDetectionSystem {
  if (!anomalyDetectionInstance) {
    anomalyDetectionInstance = new AnomalyDetectionSystem(config);
  }
  return anomalyDetectionInstance;
}
