// JVS-22: Signal Push Optimizer
// Optimized signal push with batching, filtering, dedup, and perf monitoring

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface SignalPayload {
  id?: string;
  symbol: string;
  strategy: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  price?: number;
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface SubscriptionFilter {
  symbols?: string[];
  strategies?: string[];
  minStrength?: number;
  directions?: ('BUY' | 'SELL' | 'HOLD')[];
}

export interface PushBatch {
  clientId: string;
  signals: SignalPayload[];
  filteredCount: number;
  dedupCount: number;
  elapsedMs: number;
}

export interface PusherConfig {
  batchSize: number;
  batchIntervalMs: number;
  maxHistoryPerSymbol: number;
  deduplicateMs: number; // Ignore duplicate signals within this window
  enableCompression: boolean;
}

export class SignalPushOptimizer extends EventEmitter {
  private config: Required<PusherConfig>;
  private subscriptions: Map<string, SubscriptionFilter> = new Map();
  private batches: Map<string, SignalPayload[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private history: Map<string, SignalPayload[]> = new Map();
  private recentSignals: Map<string, number> = new Map(); // dedupKey -> timestamp
  private metrics = {
    totalReceived: 0,
    totalPushed: 0,
    totalFiltered: 0,
    totalDedup: 0,
    avgBatchSize: 0,
    avgPushMs: 0,
    pushTimes: [] as number[],
  };

  constructor(config?: Partial<PusherConfig>) {
    super();
    this.config = {
      batchSize: config?.batchSize ?? 10,
      batchIntervalMs: config?.batchIntervalMs ?? 500,
      maxHistoryPerSymbol: config?.maxHistoryPerSymbol ?? 100,
      deduplicateMs: config?.deduplicateMs ?? 5000,
      enableCompression: config?.enableCompression ?? false,
    };
    log.info(`[SignalPushOptimizer] batch=${this.config.batchSize}, interval=${this.config.batchIntervalMs}ms`);
  }

  /**
   * Subscribe a client with filters
   */
  subscribe(clientId: string, filter: SubscriptionFilter): void {
    this.subscriptions.set(clientId, filter);
    log.info(`[SignalPushOptimizer] Client ${clientId} subscribed`, filter);
  }

  /**
   * Unsubscribe a client
   */
  unsubscribe(clientId: string): void {
    this.subscriptions.delete(clientId);
    this.batches.delete(clientId);
    const t = this.timers.get(clientId);
    if (t) { clearTimeout(t); this.timers.delete(clientId); }
  }

  /**
   * Process incoming signal
   */
  pushSignal(signal: SignalPayload): void {
    this.metrics.totalReceived++;

    // Dedup check
    const dedupKey = `${signal.symbol}:${signal.strategy}:${signal.direction}`;
    const lastSeen = this.recentSignals.get(dedupKey);
    if (lastSeen && (Date.now() - lastSeen) < this.config.deduplicateMs) {
      this.metrics.totalDedup++;
      return;
    }
    this.recentSignals.set(dedupKey, Date.now());

    // Update history
    if (!this.history.has(signal.symbol)) {
      this.history.set(signal.symbol, []);
    }
    const hist = this.history.get(signal.symbol)!;
    hist.push(signal);
    if (hist.length > this.config.maxHistoryPerSymbol) hist.shift();

    // Distribute to subscribers
    for (const [clientId, filter] of this.subscriptions) {
      if (!this.matchesFilter(signal, filter)) {
        this.metrics.totalFiltered++;
        continue;
      }
      this.enqueue(clientId, signal);
    }
  }

  /**
   * Batch push multiple signals
   */
  pushBatch(signals: SignalPayload[]): void {
    for (const s of signals) this.pushSignal(s);
  }

  /**
   * Check if signal matches subscription filter
   */
  private matchesFilter(signal: SignalPayload, filter: SubscriptionFilter): boolean {
    if (filter.symbols && !filter.symbols.includes(signal.symbol)) return false;
    if (filter.strategies && !filter.strategies.includes(signal.strategy)) return false;
    if (filter.minStrength !== undefined && signal.strength < filter.minStrength) return false;
    if (filter.directions && !filter.directions.includes(signal.direction)) return false;
    return true;
  }

  /**
   * Enqueue signal for batch delivery
   */
  private enqueue(clientId: string, signal: SignalPayload): void {
    if (!this.batches.has(clientId)) {
      this.batches.set(clientId, []);
    }
    const batch = this.batches.get(clientId)!;
    batch.push(signal);

    if (batch.length >= this.config.batchSize) {
      this.flush(clientId);
    } else if (!this.timers.has(clientId)) {
      const t = setTimeout(() => this.flush(clientId), this.config.batchIntervalMs);
      if (t.unref) t.unref();
      this.timers.set(clientId, t);
    }
  }

  /**
   * Flush batch for client
   */
  private flush(clientId: string): void {
    const t0 = performance.now();
    const batch = this.batches.get(clientId);
    if (!batch || batch.length === 0) return;

    const signals = [...batch];
    batch.length = 0;

    // Clear timer
    const timer = this.timers.get(clientId);
    if (timer) { clearTimeout(timer); this.timers.delete(clientId); }

    this.metrics.totalPushed += signals.length;
    const elapsed = performance.now() - t0;
    this.metrics.pushTimes.push(elapsed);
    if (this.metrics.pushTimes.length > 100) this.metrics.pushTimes.shift();
    this.metrics.avgPushMs = this.metrics.pushTimes.reduce((s, v) => s + v, 0) / this.metrics.pushTimes.length;
    this.metrics.avgBatchSize = signals.length;

    const result: PushBatch = {
      clientId,
      signals,
      filteredCount: this.metrics.totalFiltered,
      dedupCount: this.metrics.totalDedup,
      elapsedMs: elapsed,
    };

    this.emit('push', result);
  }

  /**
   * Flush all pending batches
   */
  flushAll(): void {
    for (const clientId of this.batches.keys()) {
      this.flush(clientId);
    }
  }

  /**
   * Get signal history for symbol
   */
  getHistory(symbol: string, limit?: number): SignalPayload[] {
    const hist = this.history.get(symbol);
    if (!hist) return [];
    return limit ? hist.slice(-limit) : hist;
  }

  /**
   * Get all-time metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get subscription stats
   */
  getSubscriptionStats(): {
    totalClients: number;
    totalSymbols: number;
  } {
    let totalSymbols = 0;
    for (const filter of this.subscriptions.values()) {
      totalSymbols += filter.symbols?.length ?? 0;
    }
    return { totalClients: this.subscriptions.size, totalSymbols };
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.history.clear();
    this.recentSignals.clear();
    this.batches.clear();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.metrics = {
      totalReceived: 0, totalPushed: 0, totalFiltered: 0,
      totalDedup: 0, avgBatchSize: 0, avgPushMs: 0, pushTimes: [],
    };
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.clearAll();
    this.removeAllListeners();
  }
}

// Singleton
let pusherInstance: SignalPushOptimizer | null = null;

export function getSignalPushOptimizer(
  config?: Partial<PusherConfig>
): SignalPushOptimizer {
  if (!pusherInstance) {
    pusherInstance = new SignalPushOptimizer(config);
  }
  return pusherInstance;
}
