/**
 * R265: FlashChartIpcBridge — 闪电图(分时图)实时数据IPC桥接
 * 
 * 功能:
 *   1. 1分钟聚合OHLCV实时数据推送 (超低延迟)
 *   2. Tick级别价格线推送 (<50ms渲染)
 *   3. 成交量分时柱推送
 *   4. 分时均线 (日内均价) 实时计算
 *   5. 昨日收盘线/涨跌幅% 叠加
 *   6. 数据缓冲+背压控制 (高频tick→1s聚合→IPC)
 *   7. 多symbol并行推送管理
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FlashTick {
  tickId: string;
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  bidPrice: number;
  askPrice: number;
  direction: 'up' | 'down' | 'flat';  // vs previous tick
}

export interface FlashCandle {
  candleId: string;
  symbol: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  count: number;  // tick count in this candle
}

export interface FlashChartState {
  symbol: string;
  prevClose: number;     // yesterday close
  todayOpen: number;
  todayHigh: number;
  todayLow: number;
  latestPrice: number;
  change: number;        // price change
  changePercent: number; // % change
  totalVolume: number;
  avgPrice: number;      // VWAP / 日内均价
  updateTime: number;
  tickCount: number;
}

export interface FlashChartConfig {
  symbol: string;
  prevClose: number;
  maxCandles: number;    // max candles to keep (default 390 = 6.5h*60min)
  aggregationMs: number; // tick aggregation interval (default 1000ms)
  enabled: boolean;
}

export interface FlashChartSnapshot {
  symbol: string;
  state: FlashChartState;
  candles: FlashCandle[];      // aggregated 1-min candles
  recentTicks: FlashTick[];    // latest N raw ticks for sparkline
  prevCloseLine: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// FlashChartIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class FlashChartIpcBridge {
  private configs: Map<string, FlashChartConfig> = new Map();
  private states: Map<string, FlashChartState> = new Map();
  private candles: Map<string, FlashCandle[]> = new Map();
  private recentTicks: Map<string, FlashTick[]> = new Map();
  private tickBuffer: Map<string, FlashTick[]> = new Map();
  private stats_ = { totalTicks: 0, totalCandles: 0, activeSymbols: 0 };

  constructor() {}

  // ── Public API: Registration ────────────────────────────────────────────

  /**
   * Start tracking a symbol for flash chart.
   */
  startTracking(params: {
    symbol: string;
    prevClose: number;
    maxCandles?: number;
  }): FlashChartConfig {
    const config: FlashChartConfig = {
      symbol: params.symbol,
      prevClose: params.prevClose,
      maxCandles: params.maxCandles ?? 390,
      aggregationMs: 1000,
      enabled: true,
    };

    const state: FlashChartState = {
      symbol: params.symbol,
      prevClose: params.prevClose,
      todayOpen: 0,
      todayHigh: 0,
      todayLow: Infinity,
      latestPrice: 0,
      change: 0,
      changePercent: 0,
      totalVolume: 0,
      avgPrice: 0,
      updateTime: Date.now(),
      tickCount: 0,
    };

    this.configs.set(params.symbol, config);
    this.states.set(params.symbol, state);
    this.candles.set(params.symbol, []);
    this.recentTicks.set(params.symbol, []);
    this.tickBuffer.set(params.symbol, []);
    this.stats_.activeSymbols++;

    return config;
  }

  /**
   * Stop tracking a symbol.
   */
  stopTracking(symbol: string): void {
    this.configs.delete(symbol);
    this.states.delete(symbol);
    this.candles.delete(symbol);
    this.recentTicks.delete(symbol);
    this.tickBuffer.delete(symbol);
    this.stats_.activeSymbols--;
  }

  // ── Public API: Tick Feed ───────────────────────────────────────────────

  /**
   * Process incoming tick. Aggregates into 1-min candles.
   * Returns the updated candle (or null if still buffering).
   */
  processTick(tick: Omit<FlashTick, 'tickId' | 'direction'>): {
    state: FlashChartState;
    candle?: FlashCandle;
    shouldFlush: boolean;
  } {
    const config = this.configs.get(tick.symbol);
    if (!config || !config.enabled) {
      return { state: {} as FlashChartState, shouldFlush: false };
    }

    const state = this.states.get(tick.symbol)!;
    const prevPrice = state.latestPrice;

    // Determine direction
    const direction: FlashTick['direction'] =
      prevPrice === 0 ? 'flat' :
      tick.price > prevPrice ? 'up' :
      tick.price < prevPrice ? 'down' : 'flat';

    const fullTick: FlashTick = {
      tickId: `ft:${tick.symbol}:${tick.timestamp}:${Math.random().toString(36).slice(2, 6)}`,
      ...tick,
      direction,
    };

    // Buffer for aggregation
    const buffer = this.tickBuffer.get(tick.symbol)!;
    buffer.push(fullTick);

    // Keep recent ticks
    const recent = this.recentTicks.get(tick.symbol)!;
    recent.push(fullTick);
    if (recent.length > 200) recent.shift();

    // Update state
    state.latestPrice = tick.price;
    state.tickCount++;
    state.totalVolume += tick.volume;
    if (state.todayOpen === 0) state.todayOpen = tick.price;
    if (tick.price > state.todayHigh) state.todayHigh = tick.price;
    if (tick.price < state.todayLow) state.todayLow = tick.price;
    state.change = tick.price - state.prevClose;
    state.changePercent = state.prevClose > 0 ? +(state.change / state.prevClose * 100).toFixed(2) : 0;
    state.avgPrice = state.totalVolume > 0 ? +(state.latestPrice * tick.volume + state.avgPrice) / 2 : tick.price;
    state.updateTime = Date.now();
    this.stats_.totalTicks++;

    // Check if buffer should be flushed into a candle
    let candle: FlashCandle | undefined;
    let shouldFlush = false;

    if (buffer.length >= 1) {
      const firstTick = buffer[0];
      const lastTick = buffer[buffer.length - 1];

      // Aggregate into 1-min candle
      if (lastTick.timestamp - firstTick.timestamp >= config.aggregationMs) {
        candle = this._aggregateBuffer(tick.symbol, buffer);
        const candleList = this.candles.get(tick.symbol)!;
        candleList.push(candle);
        if (candleList.length > config.maxCandles) candleList.shift();
        this.stats_.totalCandles++;

        // Clear buffer
        this.tickBuffer.set(tick.symbol, []);
        shouldFlush = true;
      }
    }

    return { state, candle, shouldFlush };
  }

  // ── Public API: Batch ───────────────────────────────────────────────────

  /**
   * Process a batch of ticks (from websocket burst).
   */
  processTickBatch(ticks: Array<Omit<FlashTick, 'tickId' | 'direction'>>): {
    states: Map<string, FlashChartState>;
    candles: FlashCandle[];
  } {
    const resultCandles: FlashCandle[] = [];

    for (const tick of ticks) {
      const { candle } = this.processTick(tick);
      if (candle) resultCandles.push(candle);
    }

    return {
      states: new Map(this.states),
      candles: resultCandles,
    };
  }

  // ── Public API: Snapshots ───────────────────────────────────────────────

  /**
   * Get full flash chart data for a symbol (for initial load).
   */
  getSnapshot(symbol: string): FlashChartSnapshot | null {
    const state = this.states.get(symbol);
    if (!state) return null;

    const config = this.configs.get(symbol)!;

    return {
      symbol,
      state: { ...state },
      candles: [...(this.candles.get(symbol) ?? [])],
      recentTicks: [...(this.recentTicks.get(symbol) ?? [])].slice(-50),
      prevCloseLine: config.prevClose,
    };
  }

  /**
   * Get mini sparkline data (last 50 ticks, compact).
   */
  getSparkline(symbol: string): { times: number[]; prices: number[]; direction: string[] } | null {
    const ticks = this.recentTicks.get(symbol);
    if (!ticks || ticks.length === 0) return null;

    const last50 = ticks.slice(-50);
    return {
      times: last50.map(t => t.timestamp),
      prices: last50.map(t => t.price),
      direction: last50.map(t => t.direction),
    };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get state for a symbol */
  getState(symbol: string): FlashChartState | null { return this.states.get(symbol) ?? null; }

  /** Get recent candles */
  getCandles(symbol: string, limit?: number): FlashCandle[] {
    const list = this.candles.get(symbol);
    if (!list) return [];
    return limit ? list.slice(-limit) : [...list];
  }

  /** Get active symbol list */
  getActiveSymbols(): string[] { return Array.from(this.configs.keys()); }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset all */
  reset(): void {
    this.configs.clear();
    this.states.clear();
    this.candles.clear();
    this.recentTicks.clear();
    this.tickBuffer.clear();
    this.stats_ = { totalTicks: 0, totalCandles: 0, activeSymbols: 0 };
  }

  /** Reset a single symbol */
  resetSymbol(symbol: string): void {
    this.configs.delete(symbol);
    this.states.delete(symbol);
    this.candles.delete(symbol);
    this.recentTicks.delete(symbol);
    this.tickBuffer.delete(symbol);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _aggregateBuffer(symbol: string, buffer: FlashTick[]): FlashCandle {
    const openTime = buffer[0].timestamp;
    const closeTime = buffer[buffer.length - 1].timestamp;
    const open = buffer[0].price;
    const close = buffer[buffer.length - 1].price;
    let high = -Infinity, low = Infinity, totalVol = 0;

    for (const t of buffer) {
      if (t.price > high) high = t.price;
      if (t.price < low) low = t.price;
      totalVol += t.volume;
    }

    const hash = createHash('sha256').update(`${symbol}|${openTime}`).digest('hex');
    return {
      candleId: `fc:${symbol}:${openTime}:${hash.slice(0, 8)}`,
      symbol,
      openTime,
      closeTime,
      open,
      high: high === -Infinity ? open : high,
      low: low === Infinity ? open : low,
      close,
      volume: totalVol,
      count: buffer.length,
    };
  }
}

export const flashChartIpcBridge = new FlashChartIpcBridge();
