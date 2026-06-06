// JVS-21: KLine Aggregation Optimizer
// Optimized K-line aggregation with circular buffer, batch processing, and perf monitoring

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface KLinePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

export interface AggregationResult {
  timeframe: string;
  candles: KLinePoint[];
  processingTimeMs: number;
  memoryUsedBytes: number;
}

export interface OptimizerConfig {
  maxBufferSize: number;
  batchProcessThreshold: number;
  enableCompression: boolean;
  gcIntervalMs: number;
}

const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

/**
 * Circular buffer for memory-efficient K-line storage
 */
class RingBuffer<T> {
  private buf: (T | null)[];
  private head = 0;
  private len = 0;

  constructor(private cap: number) {
    this.buf = new Array(cap).fill(null);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.cap;
    if (this.len < this.cap) this.len++;
  }

  toArray(): T[] {
    if (this.len === 0) return [];
    if (this.len < this.cap) {
      return this.buf.slice(0, this.len).filter(Boolean) as T[];
    }
    return [
      ...this.buf.slice(this.head, this.cap),
      ...this.buf.slice(0, this.head),
    ].filter(Boolean) as T[];
  }

  last(): T | null {
    if (this.len === 0) return null;
    const idx = (this.head - 1 + this.cap) % this.cap;
    return this.buf[idx];
  }

  size(): number {
    return this.len;
  }

  clear(): void {
    this.buf = new Array(this.cap).fill(null);
    this.head = 0;
    this.len = 0;
  }
}

/**
 * Aggregates raw 1m K-line data into higher timeframes efficiently
 */
export class KLineAggregationOptimizer extends EventEmitter {
  private config: Required<OptimizerConfig>;
  private buffers: Map<string, Map<string, RingBuffer<KLinePoint>>> = new Map();
  private perfLog: { op: string; ms: number; ts: number }[] = [];
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<OptimizerConfig>) {
    super();
    this.config = {
      maxBufferSize: config?.maxBufferSize ?? 500,
      batchProcessThreshold: config?.batchProcessThreshold ?? 50,
      enableCompression: config?.enableCompression ?? false,
      gcIntervalMs: config?.gcIntervalMs ?? 60_000,
    };
    this.startGC();
    log.info(`[KLineOptimizer] Initialized (buffer=${this.config.maxBufferSize})`);
  }

  /**
   * Feed raw 1-minute K-line data point
   */
  feed(symbol: string, point: KLinePoint): void {
    const t0 = performance.now();

    if (!this.buffers.has(symbol)) {
      this.buffers.set(symbol, new Map());
    }
    const symbolBufs = this.buffers.get(symbol)!;

    // Store in 1m buffer
    if (!symbolBufs.has('1m')) {
      symbolBufs.set('1m', new RingBuffer<KLinePoint>(this.config.maxBufferSize));
    }
    symbolBufs.get('1m')!.push(point);

    // Aggregate to higher timeframes
    for (const [tf, ms] of Object.entries(TIMEFRAME_MS)) {
      if (tf === '1m') continue;
      if (!symbolBufs.has(tf)) {
        symbolBufs.set(tf, new RingBuffer<KLinePoint>(this.config.maxBufferSize));
      }
      this.aggregateCandle(symbolBufs.get(tf)!, point, ms);
    }

    const elapsed = performance.now() - t0;
    this.perfLog.push({ op: 'feed', ms: elapsed, ts: Date.now() });
    this.emit('feed', { symbol, point, elapsed });
  }

  /**
   * Batch feed multiple points
   */
  feedBatch(symbol: string, points: KLinePoint[]): void {
    const t0 = performance.now();
    for (const p of points) {
      this.feed(symbol, p);
    }
    const elapsed = performance.now() - t0;
    this.perfLog.push({ op: 'feedBatch', ms: elapsed, ts: Date.now() });
    this.emit('batchComplete', { symbol, count: points.length, elapsed });
  }

  /**
   * Get aggregated candles for a timeframe
   */
  getCandles(symbol: string, timeframe: string, limit?: number): KLinePoint[] {
    const symbolBufs = this.buffers.get(symbol);
    if (!symbolBufs) return [];
    const buf = symbolBufs.get(timeframe);
    if (!buf) return [];
    const all = buf.toArray();
    return limit ? all.slice(-limit) : all;
  }

  /**
   * Get full aggregation result with metrics
   */
  getAggregationResult(symbol: string, timeframe: string): AggregationResult {
    const t0 = performance.now();
    const candles = this.getCandles(symbol, timeframe);
    const mem = process.memoryUsage().heapUsed;
    return {
      timeframe,
      candles,
      processingTimeMs: performance.now() - t0,
      memoryUsedBytes: mem,
    };
  }

  /**
   * Aggregate a single candle into the target timeframe buffer
   */
  private aggregateCandle(
    buf: RingBuffer<KLinePoint>,
    point: KLinePoint,
    intervalMs: number
  ): void {
    const windowStart = Math.floor(point.timestamp / intervalMs) * intervalMs;
    const last = buf.last();

    if (last && Math.floor(last.timestamp / intervalMs) * intervalMs === windowStart) {
      // Update existing candle
      last.high = Math.max(last.high, point.high);
      last.low = Math.min(last.low, point.low);
      last.close = point.close;
      last.volume += point.volume;
      if (point.amount && last.amount) last.amount += point.amount;
    } else {
      // New candle
      buf.push({ ...point, timestamp: windowStart });
    }
  }

  /**
   * Periodic garbage collection
   */
  private startGC(): void {
    this.gcTimer = setInterval(() => {
      const before = this.getStats();
      // Trim perf log
      if (this.perfLog.length > 200) {
        this.perfLog = this.perfLog.slice(-100);
      }
      this.emit('gc', before);
    }, this.config.gcIntervalMs);
    // Don't block process exit
    if (this.gcTimer.unref) this.gcTimer.unref();
  }

  /**
   * Performance metrics
   */
  getPerformanceStats(): {
    avgFeedMs: number;
    maxFeedMs: number;
    totalOps: number;
    bufferCount: number;
  } {
    const feeds = this.perfLog.filter(p => p.op === 'feed');
    const avg = feeds.length > 0
      ? feeds.reduce((s, p) => s + p.ms, 0) / feeds.length
      : 0;
    const max = feeds.length > 0
      ? Math.max(...feeds.map(p => p.ms))
      : 0;

    let bufferCount = 0;
    for (const symbolBufs of this.buffers.values()) {
      bufferCount += symbolBufs.size;
    }

    return {
      avgFeedMs: avg,
      maxFeedMs: max,
      totalOps: this.perfLog.length,
      bufferCount,
    };
  }

  /**
   * Storage stats
   */
  getStats(): { symbols: number; totalCandles: number; memoryMB: number } {
    let totalCandles = 0;
    for (const symbolBufs of this.buffers.values()) {
      for (const buf of symbolBufs.values()) {
        totalCandles += buf.size();
      }
    }
    return {
      symbols: this.buffers.size,
      totalCandles,
      memoryMB: process.memoryUsage().heapUsed / (1024 * 1024),
    };
  }

  /**
   * Clear specific symbol
   */
  clearSymbol(symbol: string): void {
    this.buffers.delete(symbol);
  }

  /**
   * Clear all
   */
  clearAll(): void {
    this.buffers.clear();
    this.perfLog = [];
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    this.clearAll();
    this.removeAllListeners();
  }
}

// Singleton
let optimizerInstance: KLineAggregationOptimizer | null = null;

export function getKLineAggregationOptimizer(
  config?: Partial<OptimizerConfig>
): KLineAggregationOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new KLineAggregationOptimizer(config);
  }
  return optimizerInstance;
}
