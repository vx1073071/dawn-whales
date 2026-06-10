/**
 * JVS-99: Real-time Data Visualization Service
 * Provides real-time data streams for visualization components
 * Integrates with sliding window aggregator and performance monitor
 */

import { EventEmitter } from 'events';
import { getSlidingWindowAggregator } from './sliding-window-aggregator';
import { getPerformanceMonitor } from '../portfolio/performance-monitor';
import log from 'electron-log';

export interface VisualizationDataPoint {
  timestamp: number;
  symbol: string;
  price: number;
  volume: number;
  change: number;
  changePct: number;
}

export interface VisualizationConfig {
  symbols: string[];
  updateInterval: number;  // ms
  maxDataPoints: number;
  enableAlerts: boolean;
}

export class RealtimeVisualizationService extends EventEmitter {
  private config: VisualizationConfig;
  private aggregator = getSlidingWindowAggregator();
  private monitor = getPerformanceMonitor();
  private isRunning = false;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<VisualizationConfig>) {
    super();
    this.config = {
      symbols: config?.symbols || [],
      updateInterval: config?.updateInterval || 1000,
      maxDataPoints: config?.maxDataPoints || 1000,
      enableAlerts: config?.enableAlerts ?? true,
    };
  }

  /**
   * Start real-time visualization
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.updateTimer = setInterval(() => {
      this.emitUpdate();
    }, this.config.updateInterval);

    // Subscribe to aggregator events
    this.aggregator.on('update', (data) => {
      this.emit('data', data);
    });

    // Subscribe to monitor alerts if enabled
    if (this.config.enableAlerts) {
      this.monitor.onAlert((alert) => {
        this.emit('alert', alert);
      });
    }

    log.info('[RealtimeVisualization] Started with', this.config.symbols.length, 'symbols');
  }

  /**
   * Stop real-time visualization
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    log.info('[RealtimeVisualization] Stopped');
  }

  /**
   * Add symbols to monitor
   */
  addSymbols(symbols: string[]): void {
    for (const symbol of symbols) {
      this.config.symbols.push(symbol);
    }
  }

  /**
   * Remove symbols from monitoring
   */
  removeSymbols(symbols: string[]): void {
    for (const symbol of symbols) {
      this.config.symbols.delete(symbol);
    }
  }

  /**
   * Emit update event with current data
   */
  private emitUpdate(): void {
    const data: VisualizationDataPoint[] = [];

    for (const symbol of this.config.symbols) {
      const aggregatorData = this.aggregator.getAggregatedData(symbol);
      if (aggregatorData && aggregatorData.length > 0) {
        const latest = aggregatorData[aggregatorData.length - 1];
        data.push({
          timestamp: latest.timestamp,
          symbol: latest.symbol,
          price: latest.close,
          volume: latest.volume,
          change: latest.close - latest.open,
          changePct: ((latest.close - latest.open) / latest.open) * 100
        });
      }
    }

    if (data.length > 0) {
      this.emit('update', data);
    }
  }

  /**
   * Get current visualization data
   */
  getData(): VisualizationDataPoint[] {
    const data: VisualizationDataPoint[] = [];

    for (const symbol of this.config.symbols) {
      const aggregatorData = this.aggregator.getAggregatedData(symbol);
      if (aggregatorData && aggregatorData.length > 0) {
        const latest = aggregatorData[aggregatorData.length - 1];
        data.push({
          timestamp: latest.timestamp,
          symbol: latest.symbol,
          price: latest.close,
          volume: latest.volume,
          change: latest.close - latest.open,
          changePct: ((latest.close - latest.open) / latest.open) * 100
        });
      }
    }

    return data;
  }

  /**
   * Get historical data for a symbol
   */
  getHistoricalData(symbol: string, limit?: number): VisualizationDataPoint[] {
    const aggregatorData = this.aggregator.getAggregatedData(symbol);
    if (!aggregatorData || aggregatorData.length === 0) {
      return [];
    }

    const data = aggregatorData.map(d => ({
      timestamp: d.timestamp,
      symbol: d.symbol,
      price: d.close,
      volume: d.volume,
      change: d.close - d.open,
      changePct: ((d.close - d.open) / d.open) * 100
    }));

    if (limit && limit < data.length) {
      return data.slice(-limit);
    }

    return data;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalSymbols: number;
    totalDataPoints: number;
    isRunning: boolean;
    updateInterval: number;
  } {
    const aggregatorSummary = this.aggregator.getSummary();
    return {
      totalSymbols: this.config.symbols.length,
      totalDataPoints: aggregatorSummary.totalDataPoints,
      isRunning: this.isRunning,
      updateInterval: this.config.updateInterval
    };
  }
}

let instance: RealtimeVisualizationService | null = null;

export function getRealtimeVisualizationService(): RealtimeVisualizationService {
  if (!instance) {
    instance = new RealtimeVisualizationService();
  }
  return instance;
}
