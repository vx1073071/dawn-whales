// ── Stream Computing Engine (JVS-61) ─────────────────────────────────────────
// 流式计算引擎 - 滑动窗口计算 + 实时聚合 (VWAP/TWAP)
// 支持：滑动窗口、时间窗口、实时聚合、流式指标计算

import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TickData {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  high?: number;
  low?: number;
}

export interface WindowConfig {
  type: 'sliding' | 'tumbling' | 'session';
  size: number;           // Window size in milliseconds
  slideInterval?: number; // For sliding windows
}

export interface AggregatedData {
  symbol: string;
  timestamp: number;
  vwap: number;           // Volume Weighted Average Price
  twap: number;           // Time Weighted Average Price
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
}

export interface StreamMetrics {
  symbol: string;
  timestamp: number;
  // Price metrics
  priceChange: number;
  priceChangePct: number;
  // Volume metrics
  volumeSpike: boolean;
  volumeRatio: number;      // Current vs average
  // Momentum
  momentum5: number;
  momentum10: number;
  // Volatility
  volatility5: number;
  volatility10: number;
}

// ── Sliding Window ─────────────────────────────────────────────────────────

class SlidingWindow {
  private data: TickData[] = [];
  private maxSize: number;
  private windowSizeMs: number;

  constructor(windowSizeMs: number, maxSize: number = 10000) {
    this.windowSizeMs = windowSizeMs;
    this.maxSize = maxSize;
  }

  add(tick: TickData): void {
    this.data.push(tick);
    
    // Remove old data outside window
    const cutoff = Date.now() - this.windowSizeMs;
    while (this.data.length > 0 && this.data[0].timestamp < cutoff) {
      this.data.shift();
    }

    // Limit max size
    while (this.data.length > this.maxSize) {
      this.data.shift();
    }
  }

  getData(): TickData[] {
    return [...this.data];
  }

  getRecent(count: number): TickData[] {
    return this.data.slice(-count);
  }

  clear(): void {
    this.data = [];
  }

  size(): number {
    return this.data.length;
  }
}

// ── Aggregation Functions ──────────────────────────────────────────────────

class Aggregator {
  /**
   * Calculate VWAP (Volume Weighted Average Price)
   */
  static calculateVWAP(ticks: TickData[]): number {
    if (ticks.length === 0) return 0;

    let cumulativeTPV = 0;  // Typical Price * Volume
    let cumulativeVolume = 0;

    for (const tick of ticks) {
      const typicalPrice = tick.high && tick.low
        ? (tick.high + tick.low + tick.price) / 3
        : tick.price;
      
      cumulativeTPV += typicalPrice * tick.volume;
      cumulativeVolume += tick.volume;
    }

    return cumulativeVolume === 0 ? 0 : cumulativeTPV / cumulativeVolume;
  }

  /**
   * Calculate TWAP (Time Weighted Average Price)
   */
  static calculateTWAP(ticks: TickData[]): number {
    if (ticks.length === 0) return 0;

    let cumulativePrice = 0;
    for (const tick of ticks) {
      cumulativePrice += tick.price;
    }

    return cumulativePrice / ticks.length;
  }

  /**
   * Calculate OHLC (Open, High, Low, Close)
   */
  static calculateOHLC(ticks: TickData[]): { open: number; high: number; low: number; close: number } {
    if (ticks.length === 0) {
      return { open: 0, high: 0, low: 0, close: 0 };
    }

    const prices = ticks.map(t => t.price);
    const highs = ticks.map(t => t.high || t.price);
    const lows = ticks.map(t => t.low || t.price);

    return {
      open: ticks[0].price,
      high: Math.max(...highs),
      low: Math.min(...lows),
      close: ticks[ticks.length - 1].price,
    };
  }

  /**
   * Aggregate ticks into a single data point
   */
  static aggregate(symbol: string, ticks: TickData[]): AggregatedData {
    const ohlc = this.calculateOHLC(ticks);
    const vwap = this.calculateVWAP(ticks);
    const twap = this.calculateTWAP(ticks);
    const volume = ticks.reduce((sum, t) => sum + t.volume, 0);

    return {
      symbol,
      timestamp: Date.now(),
      vwap,
      twap,
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      volume,
      tradeCount: ticks.length,
    };
  }
}

// ── Stream Computing Engine ────────────────────────────────────────────────

export class StreamComputingEngine extends EventEmitter {
  private windows: Map<string, SlidingWindow> = new Map();
  private config: WindowConfig;
  private aggregatedCache: Map<string, AggregatedData> = new Map();
  private metricsCache: Map<string, StreamMetrics> = new Map();

  constructor(config?: Partial<WindowConfig>) {
    super();
    this.config = {
      type: config?.type || 'sliding',
      size: config?.size || 5 * 60 * 1000,  // Default 5 minutes
      slideInterval: config?.slideInterval || 60 * 1000,  // Default 1 minute
    };
  }

  /**
   * Process a new tick
   */
  processTick(tick: TickData): StreamMetrics {
    const { symbol } = tick;

    // Get or create window for this symbol
    if (!this.windows.has(symbol)) {
      this.windows.set(symbol, new SlidingWindow(this.config.size));
    }

    const window = this.windows.get(symbol)!;
    window.add(tick);

    // Calculate metrics
    const metrics = this.calculateMetrics(symbol, window.getData());
    this.metricsCache.set(symbol, metrics);

    // Emit tick event
    this.emit('tick', tick, metrics);

    return metrics;
  }

  /**
   * Get aggregated data for a symbol
   */
  getAggregatedData(symbol: string): AggregatedData | null {
    const window = this.windows.get(symbol);
    if (!window) return null;

    const ticks = window.getData();
    return Aggregator.aggregate(symbol, ticks);
  }

  /**
   * Get current metrics for a symbol
   */
  getMetrics(symbol: string): StreamMetrics | null {
    return this.metricsCache.get(symbol) || null;
  }

  /**
   * Get all symbols being tracked
   */
  getSymbols(): string[] {
    return Array.from(this.windows.keys());
  }

  /**
   * Clear data for a symbol
   */
  clearSymbol(symbol: string): void {
    this.windows.delete(symbol);
    this.aggregatedCache.delete(symbol);
    this.metricsCache.delete(symbol);
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.windows.clear();
    this.aggregatedCache.clear();
    this.metricsCache.clear();
  }

  /**
   * Calculate stream metrics
   */
  private calculateMetrics(symbol: string, ticks: TickData[]): StreamMetrics {
    if (ticks.length < 2) {
      return {
        symbol,
        timestamp: Date.now(),
        priceChange: 0,
        priceChangePct: 0,
        volumeSpike: false,
        volumeRatio: 1,
        momentum5: 0,
        momentum10: 0,
        volatility5: 0,
        volatility10: 0,
      };
    }

    const current = ticks[ticks.length - 1];
    const previous = ticks[ticks.length - 2];
    
    // Price change
    const priceChange = current.price - previous.price;
    const priceChangePct = previous.price === 0 ? 0 : (priceChange / previous.price) * 100;

    // Volume metrics
    const avgVolume = ticks.reduce((sum, t) => sum + t.volume, 0) / ticks.length;
    const volumeRatio = avgVolume === 0 ? 1 : current.volume / avgVolume;
    const volumeSpike = volumeRatio > 3;  // 3x average = spike

    // Momentum (last 5 and 10 ticks)
    const momentum5 = this.calculateMomentum(ticks, 5);
    const momentum10 = this.calculateMomentum(ticks, 10);

    // Volatility (last 5 and 10 ticks)
    const volatility5 = this.calculateVolatility(ticks, 5);
    const volatility10 = this.calculateVolatility(ticks, 10);

    return {
      symbol,
      timestamp: Date.now(),
      priceChange,
      priceChangePct,
      volumeSpike,
      volumeRatio,
      momentum5,
      momentum10,
      volatility5,
      volatility10,
    };
  }

  private calculateMomentum(ticks: TickData[], period: number): number {
    if (ticks.length < period + 1) return 0;

    const current = ticks[ticks.length - 1].price;
    const past = ticks[ticks.length - 1 - period].price;
    
    return past === 0 ? 0 : ((current - past) / past) * 100;
  }

  private calculateVolatility(ticks: TickData[], period: number): number {
    if (ticks.length < period + 1) return 0;

    const recentTicks = ticks.slice(-period);
    const returns: number[] = [];

    for (let i = 1; i < recentTicks.length; i++) {
      const prev = recentTicks[i - 1].price;
      const curr = recentTicks[i].price;
      if (prev !== 0) {
        returns.push((curr - prev) / prev);
      }
    }

    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100;  // Convert to percentage
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let streamEngineInstance: StreamComputingEngine | null = null;

export function getStreamComputingEngine(config?: Partial<WindowConfig>): StreamComputingEngine {
  if (!streamEngineInstance) {
    streamEngineInstance = new StreamComputingEngine(config);
  }
  return streamEngineInstance;
}
