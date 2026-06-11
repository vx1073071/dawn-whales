// JVS-22: Strategy Signal Push Optimizer
// Optimized real-time strategy signal push with filtering and batching

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface StrategySignal {
  timestamp: number;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  strategy: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface SignalSubscription {
  symbols: string[];
  minStrength: number; // 0-100, minimum signal strength
  strategies?: string[]; // Filter by strategy name
}

export interface SignalHistory {
  signal: StrategySignal;
  timestamp: number;
}

export interface PusherConfig {
  maxHistorySize: number;
  batchSize: number;
  batchInterval: number; // ms
  enableCompression: boolean;
}

export interface PerformanceMetrics {
  pushTime: number[];
  batchSize: number[];
  filteredSignals: number;
  totalSignals: number;
  lastUpdate: number;
}

export class SignalPusher extends EventEmitter {
  private subscriptions: Map<string, SignalSubscription> = new Map();
  private signalHistory: Map<string, SignalHistory[]> = new Map();
  private signalBatch: Map<string, StrategySignal[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private performanceMetrics: PerformanceMetrics = {
    pushTime: [],
    batchSize: [],
    filteredSignals: 0,
    totalSignals: 0,
    lastUpdate: Date.now(),
  };

  constructor(private config: PusherConfig = {
    maxHistorySize: 1000,
    batchSize: 10,
    batchInterval: 1000,
    enableCompression: false,
  }) {
    super();
    log.info(`[SignalPusher] Initialized with batchSize=${config.batchSize}, batchInterval=${config.batchInterval}ms`);
  }

  /**
   * Subscribe to signal updates
   */
  subscribe(clientId: string, subscription: SignalSubscription): void {
    this.subscriptions.set(clientId, subscription);
    log.info(`[SignalPusher] Client ${clientId} subscribed with ${subscription.symbols.length} symbols, minStrength=${subscription.minStrength}`);
  }

  /**
   * Unsubscribe from signal updates
   */
  unsubscribe(clientId: string): void {
    this.subscriptions.delete(clientId);
    log.info(`[SignalPusher] Client ${clientId} unsubscribed`);
  }

  /**
   * Process incoming signal with filtering and batching
   */
  processSignal(signal: StrategySignal): void {
    const startTime = performance.now();
    this.performanceMetrics.totalSignals++;

    // Find all subscribed clients
    for (const [clientId, subscription] of this.subscriptions) {
      // Check if symbol is subscribed
      if (!subscription.symbols.includes(signal.symbol)) {
        continue;
      }

      // Filter by strategy if specified
      if (subscription.strategies && subscription.strategies.length > 0) {
        if (!subscription.strategies.includes(signal.strategy)) {
          continue;
        }
      }

      // Filter by minimum strength
      if (signal.strength < subscription.minStrength) {
        this.performanceMetrics.filteredSignals++;
        continue;
      }

      // Add to batch
      if (!this.signalBatch.has(clientId)) {
        this.signalBatch.set(clientId, []);
      }

      const batch = this.signalBatch.get(clientId)!;
      batch.push(signal);

      // Check if batch is full or force flush
      if (batch.length >= this.config.batchSize) {
        this.flushBatch(clientId);
      } else if (!this.batchTimers.has(clientId)) {
        // Set timer to flush batch
        const timer = setTimeout(() => {
          this.flushBatch(clientId);
        }, this.config.batchInterval);
        this.batchTimers.set(clientId, timer);
      }
    }

    // Update signal history
    this.updateSignalHistory(signal);

    // Monitor performance
    const pushTime = performance.now() - startTime;
    this.performanceMetrics.pushTime.push(pushTime);
    if (this.performanceMetrics.pushTime.length > 100) {
      this.performanceMetrics.pushTime.shift();
    }
    this.performanceMetrics.lastUpdate = Date.now();
  }

  /**
   * Flush signal batch to clients
   */
  private flushBatch(clientId: string): void {
    const batch = this.signalBatch.get(clientId);
    if (!batch || batch.length === 0) return;

    const startTime = performance.now();

    // Emit batched signals
    this.emit('signals', {
      clientId,
      signals: batch,
      timestamp: Date.now(),
    });

    // Monitor batch size
    this.performanceMetrics.batchSize.push(batch.length);
    if (this.performanceMetrics.batchSize.length > 100) {
      this.performanceMetrics.batchSize.shift();
    }

    // Clear batch
    this.signalBatch.delete(clientId);

    // Clear timer
    const timer = this.batchTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(clientId);
    }

    const flushTime = performance.now() - startTime;
    log.debug(`[SignalPusher] Flushed ${batch.length} signals to ${clientId} in ${flushTime.toFixed(2)}ms`);
  }

  /**
   * Update signal history
   */
  private updateSignalHistory(signal: StrategySignal): void {
    if (!this.signalHistory.has(signal.symbol)) {
      this.signalHistory.set(signal.symbol, []);
    }

    const history = this.signalHistory.get(signal.symbol)!;
    history.push({
      signal,
      timestamp: Date.now(),
    });

    // Limit history size
    if (history.length > this.config.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get signal history for symbol
   */
  getSignalHistory(symbol: string, limit?: number): SignalHistory[] {
    const history = this.signalHistory.get(symbol);
    if (!history) return [];

    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): { totalClients: number; totalSymbols: number; avgMinStrength: number } {
    let totalSymbols = 0;
    let totalMinStrength = 0;

    for (const [clientId, subscription] of this.subscriptions) {
      totalSymbols += subscription.symbols.length;
      totalMinStrength += subscription.minStrength;
    }

    const avgMinStrength = this.subscriptions.size > 0 
      ? totalMinStrength / this.subscriptions.size 
      : 0;

    return {
      totalClients: this.subscriptions.size,
      totalSymbols,
      avgMinStrength,
    };
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this.signalHistory.clear();
    this.signalBatch.clear();
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    log.info('[SignalPusher] All history cleared');
  }
}
