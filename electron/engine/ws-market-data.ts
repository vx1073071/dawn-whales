/**
 * ws-market-data.ts
 *
 * WebSocket Market Data Engine — receives real-time ticks from external
 * sources (Futu OpenD, mock feed, or any WS adapter) and emits them to
 * downstream consumers (strategy engine, trade bridge, UI).
 *
 * Central hub for live market data distribution.
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ─── Core Types ──────────────────────────────────────────────

export interface MarketTick {
  /** Symbol code, e.g. "US.TQQQ", "HK.00700" */
  code: string;
  /** Last traded price */
  price: number;
  /** Change from previous close (absolute) */
  change: number;
  /** Change from previous close (percentage) */
  changePct: number;
  /** Cumulative volume for the day */
  volume: number;
  /** Cumulative turnover for the day */
  amount: number;
  /** Day open price */
  open: number;
  /** Day high price */
  high: number;
  /** Day low price */
  low: number;
  /** Previous close price */
  prevClose: number;
  /** Best bid price */
  bidPrice: number;
  /** Best ask price */
  askPrice: number;
  /** Best bid volume */
  bidVolume: number;
  /** Best ask volume */
  askVolume: number;
  /** Tick timestamp (ISO 8601) */
  updateTime: string;
  /** Source identifier (e.g. "futu", "mock") */
  source?: string;
}

/** Alias used by ws-trade-bridge and other consumers */
export type TickData = MarketTick;

// ─── Engine Configuration ────────────────────────────────────

export interface WsMarketDataConfig {
  /** Maximum ticks to buffer per symbol */
  maxBufferSize: number;
  /** Whether to log every incoming tick */
  verboseLogging: boolean;
  /** Symbols to auto-subscribe on start */
  defaultSymbols: string[];
}

// ─── Tick Statistics ─────────────────────────────────────────

interface TickStats {
  totalTicks: number;
  ticksBySymbol: Map<string, number>;
  lastTickTime: number;
  firstTickTime: number;
  errors: number;
}

// ─── WsMarketDataEngine Class ────────────────────────────────

export class WsMarketDataEngine extends EventEmitter {
  private config: WsMarketDataConfig;
  private running = false;

  /** Latest tick per symbol */
  private latestTicks: Map<string, MarketTick> = new Map();

  /** Ring buffer of recent ticks per symbol */
  private tickBuffers: Map<string, MarketTick[]> = new Map();

  /** Aggregate statistics */
  private stats: TickStats = {
    totalTicks: 0,
    ticksBySymbol: new Map(),
    lastTickTime: 0,
    firstTickTime: 0,
    errors: 0,
  };

  /** Registered data sources */
  private sources: Set<string> = new Set();

  constructor(config?: Partial<WsMarketDataConfig>) {
    super();
    this.setMaxListeners(50);

    this.config = {
      maxBufferSize: config?.maxBufferSize ?? 500,
      verboseLogging: config?.verboseLogging ?? false,
      defaultSymbols: config?.defaultSymbols ?? [],
    };

    log.info('[WsMarketData] Engine initialized', {
      maxBufferSize: this.config.maxBufferSize,
      defaultSymbols: this.config.defaultSymbols.length,
    });
  }

  // ─── Lifecycle ───────────────────────────────────────────

  /**
   * Start the market data engine.
   * Initializes buffers for default symbols.
   */
  start(): void {
    if (this.running) {
      log.warn('[WsMarketData] Already running');
      return;
    }

    this.running = true;

    // Initialize buffers for default symbols
    for (const symbol of this.config.defaultSymbols) {
      if (!this.tickBuffers.has(symbol)) {
        this.tickBuffers.set(symbol, []);
      }
    }

    log.info('[WsMarketData] Engine started', {
      defaultSymbols: this.config.defaultSymbols,
    });

    this.emit('started');
  }

  /**
   * Stop the market data engine and clear all buffers.
   */
  stop(): void {
    if (!this.running) {
      log.warn('[WsMarketData] Not running');
      return;
    }

    this.running = false;
    this.emit('stopped');

    log.info('[WsMarketData] Engine stopped', {
      totalTicksProcessed: this.stats.totalTicks,
    });
  }

  /**
   * Check if the engine is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ─── Tick Ingestion ──────────────────────────────────────

  /**
   * Handle an external tick from any data source.
   * This is the primary entry point for all market data.
   *
   * @param tick - The market tick to process
   */
  handleExternalTick(tick: MarketTick): void {
    if (!this.running) {
      this.stats.errors++;
      return;
    }

    // Validate tick
    if (!tick.code || tick.price <= 0) {
      this.stats.errors++;
      if (this.config.verboseLogging) {
        log.warn('[WsMarketData] Invalid tick:', tick);
      }
      return;
    }

    // Update statistics
    this.stats.totalTicks++;
    this.stats.lastTickTime = Date.now();
    if (this.stats.firstTickTime === 0) {
      this.stats.firstTickTime = Date.now();
    }

    const symbolCount = this.stats.ticksBySymbol.get(tick.code) ?? 0;
    this.stats.ticksBySymbol.set(tick.code, symbolCount + 1);

    // Update latest tick
    this.latestTicks.set(tick.code, tick);

    // Update ring buffer
    let buffer = this.tickBuffers.get(tick.code);
    if (!buffer) {
      buffer = [];
      this.tickBuffers.set(tick.code, buffer);
    }
    buffer.push(tick);
    if (buffer.length > this.config.maxBufferSize) {
      buffer.shift();
    }

    // Register source
    if (tick.source) {
      this.sources.add(tick.source);
    }

    // Verbose logging
    if (this.config.verboseLogging) {
      log.info(`[WsMarketData] Tick: ${tick.code} @ ${tick.price} vol=${tick.volume}`);
    }

    // Emit tick event to all listeners
    this.emit('tick', tick);
    this.emit(`tick:${tick.code}`, tick);
  }

  /**
   * Batch ingest multiple ticks at once.
   */
  handleBatchTicks(ticks: MarketTick[]): void {
    for (const tick of ticks) {
      this.handleExternalTick(tick);
    }
  }

  // ─── Data Access ─────────────────────────────────────────

  /**
   * Get the latest tick for a symbol.
   */
  getLatestTick(code: string): MarketTick | undefined {
    return this.latestTicks.get(code);
  }

  /**
   * Get all latest ticks.
   */
  getAllLatestTicks(): Map<string, MarketTick> {
    return new Map(this.latestTicks);
  }

  /**
   * Get recent tick history for a symbol.
   */
  getTickHistory(code: string, limit?: number): MarketTick[] {
    const buffer = this.tickBuffers.get(code);
    if (!buffer) return [];
    if (limit && limit > 0) {
      return buffer.slice(-limit);
    }
    return [...buffer];
  }

  /**
   * Get all subscribed/seen symbols.
   */
  getSymbols(): string[] {
    return Array.from(this.tickBuffers.keys());
  }

  // ─── Statistics ──────────────────────────────────────────

  /**
   * Get engine statistics.
   */
  getStats(): {
    totalTicks: number;
    ticksBySymbol: Record<string, number>;
    lastTickTime: number;
    firstTickTime: number;
    uptimeMs: number;
    errors: number;
    sources: string[];
    symbolCount: number;
  } {
    const ticksBySymbol: Record<string, number> = {};
    for (const [sym, count] of this.stats.ticksBySymbol.entries()) {
      ticksBySymbol[sym] = count;
    }

    return {
      totalTicks: this.stats.totalTicks,
      ticksBySymbol,
      lastTickTime: this.stats.lastTickTime,
      firstTickTime: this.stats.firstTickTime,
      uptimeMs: this.stats.firstTickTime > 0 ? Date.now() - this.stats.firstTickTime : 0,
      errors: this.stats.errors,
      sources: Array.from(this.sources),
      symbolCount: this.latestTicks.size,
    };
  }

  /**
   * Reset all statistics counters.
   */
  resetStats(): void {
    this.stats = {
      totalTicks: 0,
      ticksBySymbol: new Map(),
      lastTickTime: 0,
      firstTickTime: 0,
      errors: 0,
    };
    log.info('[WsMarketData] Stats reset');
  }

  // ─── Configuration ───────────────────────────────────────

  /**
   * Get current configuration.
   */
  getConfig(): WsMarketDataConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<WsMarketDataConfig>): void {
    if (updates.maxBufferSize !== undefined) {
      this.config.maxBufferSize = updates.maxBufferSize;
      // Trim existing buffers
      for (const [sym, buffer] of this.tickBuffers.entries()) {
        if (buffer.length > this.config.maxBufferSize) {
          this.tickBuffers.set(sym, buffer.slice(-this.config.maxBufferSize));
        }
      }
    }
    if (updates.verboseLogging !== undefined) {
      this.config.verboseLogging = updates.verboseLogging;
    }
    if (updates.defaultSymbols !== undefined) {
      this.config.defaultSymbols = updates.defaultSymbols;
    }
    log.info('[WsMarketData] Config updated', this.config);
  }
}

export default WsMarketDataEngine;
