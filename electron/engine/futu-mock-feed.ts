import log from 'electron-log';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface MockTick {
  code: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  timestamp: number;
  bidPrice: number;
  askPrice: number;
  bidVolume: number;
  askVolume: number;
}

export interface SymbolState {
  code: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  volatility: number;      // 0.001 - 0.05
  drift: number;           // -0.001 to 0.001 (trend direction)
  meanReversion: number;   // 0.01 - 0.1 (strength of mean reversion)
  trend: 'up' | 'down' | 'flat';
  fairValue: number;       // mean-reversion target
  baseVolume: number;      // average volume per tick
  tickCount: number;       // ticks generated for this symbol
}

export interface MockFeedConfig {
  intervalMs: number;        // tick interval (50-5000ms)
  symbols: string[];
  eventProbability: number;  // 0-1, probability of a "market event" per tick
  baseSpreadPct: number;     // 0.01-0.05%
}

export interface FeedStats {
  totalTicks: number;
  uptimeMs: number;
  symbolsActive: number;
  symbolList: string[];
  eventsTriggered: number;
  recentEvents: MarketEvent[];
}

export interface MarketEvent {
  type: 'gap_up' | 'gap_down' | 'volume_surge' | 'flash_crash';
  code: string;
  description: string;
  timestamp: number;
  magnitude: number;
}

// ─── Default Prices ────────────────────────────────────────────────────────────

const DEFAULT_PRICES: Record<string, number> = {
  TQQQ: 52,
  NVDA: 880,
  AAPL: 192,
  MSFT: 415,
  GOOG: 155,
  TSLA: 178,
  AMZN: 185,
  META: 490,
  QQQ: 445,
  SPY: 520,
  SOXL: 35,
  SOXS: 22,
  SQQQ: 28,
  PLTR: 24,
  ARKK: 52,
  IWM: 200,
  GLD: 215,
  TLT: 92,
  UVXY: 18,
  BABA: 78,
  PDD: 128,
  NIO: 5.5,
};

const DEFAULT_SYMBOLS = Object.keys(DEFAULT_PRICES);

const DEFAULT_CONFIG: MockFeedConfig = {
  intervalMs: 500,
  symbols: DEFAULT_SYMBOLS,
  eventProbability: 0.005,
  baseSpreadPct: 0.02,
};

// ─── Utility: Box-Muller Normal Distribution ───────────────────────────────────

function boxMullerRandom(): number {
  let u1 = 0;
  let u2 = 0;
  // Avoid log(0) which is -Infinity
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── FutuMockFeed Class ────────────────────────────────────────────────────────

export class FutuMockFeed {
  private config: MockFeedConfig;
  private symbols: Map<string, SymbolState> = new Map();
  private tickListeners: Array<(tick: MockTick) => void> = [];
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;
  private totalTicks: number = 0;
  private eventLog: MarketEvent[] = [];
  private maxEventLogSize = 50;
  private running = false;

  constructor(config?: Partial<MockFeedConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Clamp config values to sane ranges
    this.config.intervalMs = clamp(this.config.intervalMs, 50, 5000);
    this.config.eventProbability = clamp(this.config.eventProbability, 0, 1);
    this.config.baseSpreadPct = clamp(this.config.baseSpreadPct, 0.01, 0.05);

    // Initialize symbols from config
    for (const code of this.config.symbols) {
      const defaultPrice = DEFAULT_PRICES[code];
      this.initSymbol(code, defaultPrice ?? 100);
    }

    log.info(
      `[FutuMockFeed] Initialized with ${this.symbols.size} symbols, ` +
      `interval=${this.config.intervalMs}ms, ` +
      `eventProb=${this.config.eventProbability}`
    );
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Start pushing ticks at the configured interval.
   */
  start(): void {
    if (this.running) {
      log.warn('[FutuMockFeed] Already running, ignoring start()');
      return;
    }

    this.running = true;
    this.startTime = Date.now();
    log.info(`[FutuMockFeed] Starting tick feed (${this.symbols.size} symbols)`);

    this.intervalHandle = setInterval(() => {
      this.tickAll();
    }, this.config.intervalMs);
  }

  /**
   * Stop all feeds.
   */
  stop(): void {
    if (!this.running) {
      log.warn('[FutuMockFeed] Not running, ignoring stop()');
      return;
    }

    this.running = false;
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    const uptime = Date.now() - this.startTime;
    log.info(
      `[FutuMockFeed] Stopped. Uptime=${uptime}ms, ` +
      `totalTicks=${this.totalTicks}, events=${this.eventLog.length}`
    );
  }

  /**
   * Add a symbol to the feed.
   */
  addSymbol(code: string, initialPrice?: number): void {
    if (this.symbols.has(code)) {
      log.warn(`[FutuMockFeed] Symbol ${code} already exists, skipping add`);
      return;
    }

    const price = initialPrice ?? DEFAULT_PRICES[code] ?? 100;
    this.initSymbol(code, price);
    log.info(`[FutuMockFeed] Added symbol: ${code} @ ${price}`);
  }

  /**
   * Remove a symbol from the feed.
   */
  removeSymbol(code: string): void {
    if (!this.symbols.has(code)) {
      log.warn(`[FutuMockFeed] Symbol ${code} not found, skipping remove`);
      return;
    }

    this.symbols.delete(code);
    log.info(`[FutuMockFeed] Removed symbol: ${code}`);
  }

  /**
   * Adjust volatility for a specific symbol.
   */
  setVolatility(code: string, vol: number): void {
    const state = this.symbols.get(code);
    if (!state) {
      log.warn(`[FutuMockFeed] setVolatility: ${code} not found`);
      return;
    }

    state.volatility = clamp(vol, 0.001, 0.05);
    log.info(`[FutuMockFeed] ${code} volatility set to ${state.volatility}`);
  }

  /**
   * Set trend direction for a specific symbol.
   */
  setTrend(code: string, direction: 'up' | 'down' | 'flat'): void {
    const state = this.symbols.get(code);
    if (!state) {
      log.warn(`[FutuMockFeed] setTrend: ${code} not found`);
      return;
    }

    state.trend = direction;

    switch (direction) {
      case 'up':
        state.drift = 0.0005 + Math.random() * 0.0005; // 0.0005 to 0.001
        break;
      case 'down':
        state.drift = -(0.0005 + Math.random() * 0.0005); // -0.001 to -0.0005
        break;
      case 'flat':
        state.drift = (Math.random() - 0.5) * 0.0002; // -0.0001 to 0.0001
        break;
    }

    log.info(`[FutuMockFeed] ${code} trend set to ${direction} (drift=${state.drift.toFixed(6)})`);
  }

  /**
   * Get feed statistics.
   */
  getStats(): FeedStats {
    return {
      totalTicks: this.totalTicks,
      uptimeMs: this.running ? Date.now() - this.startTime : 0,
      symbolsActive: this.symbols.size,
      symbolList: Array.from(this.symbols.keys()),
      eventsTriggered: this.eventLog.length,
      recentEvents: this.eventLog.slice(-10),
    };
  }

  /**
   * Register a tick listener callback.
   */
  onTick(callback: (tick: MockTick) => void): void {
    this.tickListeners.push(callback);
  }

  /**
   * Generate a single tick for a symbol (can be called manually for testing).
   */
  generateTick(code: string): MockTick {
    const state = this.symbols.get(code);
    if (!state) {
      throw new Error(`[FutuMockFeed] generateTick: symbol ${code} not found`);
    }

    return this.produceTick(state);
  }

  // ─── Internal Logic ────────────────────────────────────────────────────────

  /**
   * Initialize a symbol's state.
   */
  private initSymbol(code: string, price: number): void {
    const volatility = this.deriveVolatility(code);
    const drift = (Math.random() - 0.5) * 0.0004; // slight random drift
    const meanReversion = 0.02 + Math.random() * 0.06; // 0.02 - 0.08

    const state: SymbolState = {
      code,
      price,
      prevClose: price,
      open: price,
      high: price,
      low: price,
      volume: 0,
      turnover: 0,
      volatility,
      drift,
      meanReversion,
      trend: 'flat',
      fairValue: price,
      baseVolume: this.deriveBaseVolume(code, price),
      tickCount: 0,
    };

    this.symbols.set(code, state);
  }

  /**
   * Derive a reasonable volatility based on the symbol type.
   * Leveraged ETFs and meme stocks get higher vol; index ETFs get lower.
   */
  private deriveVolatility(code: string): number {
    const leveraged = ['TQQQ', 'SOXL', 'SOXS', 'SQQQ', 'UVXY'];
    const highVol = ['TSLA', 'NVDA', 'PLTR', 'NIO', 'PDD', 'BABA'];
    const lowVol = ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT'];

    if (leveraged.includes(code)) {
      return 0.015 + Math.random() * 0.025; // 0.015 - 0.04
    } else if (highVol.includes(code)) {
      return 0.008 + Math.random() * 0.015; // 0.008 - 0.023
    } else if (lowVol.includes(code)) {
      return 0.002 + Math.random() * 0.005; // 0.002 - 0.007
    } else {
      return 0.004 + Math.random() * 0.01; // 0.004 - 0.014
    }
  }

  /**
   * Derive a reasonable base volume per tick based on symbol and price.
   */
  private deriveBaseVolume(code: string, price: number): number {
    const megaCap = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOG', 'TSLA'];
    const indexEtf = ['SPY', 'QQQ', 'IWM'];

    if (megaCap.includes(code)) {
      return 50000 + Math.floor(Math.random() * 100000);
    } else if (indexEtf.includes(code)) {
      return 80000 + Math.floor(Math.random() * 120000);
    } else if (price < 10) {
      return 100000 + Math.floor(Math.random() * 200000); // low-priced = higher volume
    } else {
      return 10000 + Math.floor(Math.random() * 40000);
    }
  }

  /**
   * Tick all symbols once.
   */
  private tickAll(): void {
    const codes = Array.from(this.symbols.keys());

    for (const code of codes) {
      const state = this.symbols.get(code);
      if (!state) continue;

      // Check for market events before generating tick
      if (Math.random() < this.config.eventProbability) {
        this.triggerEvent(state);
      }

      const tick = this.produceTick(state);
      this.totalTicks++;

      // Notify all listeners
      for (const listener of this.tickListeners) {
        try {
          listener(tick);
        } catch (err) {
          log.error(`[FutuMockFeed] Tick listener error for ${code}:`, err);
        }
      }
    }
  }

  /**
   * Produce a single tick from a symbol state, updating the state in the process.
   */
  private produceTick(state: SymbolState): MockTick {
    const normalRandom = boxMullerRandom();

    // ── Price movement: random walk + mean reversion ──
    const meanReversionForce = state.meanReversion * (state.fairValue - state.price) / state.price;
    const priceChange = state.drift + state.volatility * normalRandom + meanReversionForce;

    const oldPrice = state.price;
    let newPrice = state.price * (1 + priceChange);

    // Safety: never go below $0.01
    newPrice = Math.max(0.01, newPrice);
    newPrice = roundTo(newPrice, 2);

    // Update state
    state.price = newPrice;
    state.tickCount++;

    // Update OHLC
    if (state.tickCount === 1) {
      // First tick of session: open = first trade price
      state.open = newPrice;
      state.high = newPrice;
      state.low = newPrice;
    } else {
      state.high = Math.max(state.high, newPrice);
      state.low = Math.min(state.low, newPrice);
    }

    // ── Volume generation ──
    const volumeNoise = 0.5 + Math.random() * 1.0; // 0.5x to 1.5x
    const volumeSpike = Math.random() < 0.02 ? 10 : 1; // 2% chance of 10x spike
    const tickVolume = Math.floor(state.baseVolume * volumeNoise * volumeSpike);

    state.volume += tickVolume;
    state.turnover += tickVolume * newPrice;

    // ── Bid/Ask spread ──
    const spreadPct = this.config.baseSpreadPct / 100;
    const halfSpread = newPrice * spreadPct / 2;

    const bidPrice = roundTo(newPrice - halfSpread, 2);
    const askPrice = roundTo(newPrice + halfSpread, 2);

    // Bid/ask volumes: random but proportional to tick volume
    const bidVolume = Math.floor(tickVolume * (0.3 + Math.random() * 0.7));
    const askVolume = Math.floor(tickVolume * (0.3 + Math.random() * 0.7));

    // ── Slowly drift fair value to create realistic trend shifts ──
    if (state.tickCount % 100 === 0) {
      const fairDrift = (Math.random() - 0.5) * state.volatility * state.fairValue * 0.5;
      state.fairValue = Math.max(0.01, state.fairValue + fairDrift);
    }

    return {
      code: state.code,
      price: newPrice,
      prevClose: state.prevClose,
      open: state.open,
      high: state.high,
      low: state.low,
      volume: state.volume,
      turnover: roundTo(state.turnover, 2),
      timestamp: Date.now(),
      bidPrice,
      askPrice,
      bidVolume,
      askVolume,
    };
  }

  /**
   * Trigger a random market event on a symbol.
   */
  private triggerEvent(state: SymbolState): void {
    const eventTypes: MarketEvent['type'][] = ['gap_up', 'gap_down', 'volume_surge', 'flash_crash'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    let description = '';
    let magnitude = 0;

    switch (eventType) {
      case 'gap_up': {
        magnitude = 0.05 + Math.random() * 0.10; // 5-15% jump
        const jump = state.price * magnitude;
        state.price = roundTo(state.price + jump, 2);
        state.fairValue = state.price; // fair value adjusts with gap
        state.high = Math.max(state.high, state.price);
        description = `${state.code} gap UP ${(magnitude * 100).toFixed(1)}% to $${state.price}`;
        break;
      }

      case 'gap_down': {
        magnitude = 0.05 + Math.random() * 0.10; // 5-15% drop
        const drop = state.price * magnitude;
        state.price = roundTo(Math.max(0.01, state.price - drop), 2);
        state.fairValue = state.price;
        state.low = Math.min(state.low, state.price);
        description = `${state.code} gap DOWN ${(magnitude * 100).toFixed(1)}% to $${state.price}`;
        break;
      }

      case 'volume_surge': {
        magnitude = 5 + Math.random() * 15; // 5-20x normal volume
        const surgeVolume = Math.floor(state.baseVolume * magnitude);
        state.volume += surgeVolume;
        state.turnover += surgeVolume * state.price;
        description = `${state.code} volume SURGE ${magnitude.toFixed(1)}x (${surgeVolume.toLocaleString()} shares)`;
        break;
      }

      case 'flash_crash': {
        // Rapid drop (3-8%) followed by partial recovery in the same tick
        const crashMagnitude = 0.03 + Math.random() * 0.05;
        const recoveryRatio = 0.4 + Math.random() * 0.4; // recover 40-80% of the drop
        const dropAmount = state.price * crashMagnitude;
        const crashLow = state.price - dropAmount;
        const recovery = dropAmount * recoveryRatio;
        state.price = roundTo(Math.max(0.01, state.price - dropAmount + recovery), 2);
        state.low = Math.min(state.low, roundTo(Math.max(0.01, crashLow), 2));
        magnitude = crashMagnitude;
        description =
          `${state.code} FLASH CRASH ${(crashMagnitude * 100).toFixed(1)}% drop, ` +
          `recovered ${(recoveryRatio * 100).toFixed(0)}% → $${state.price}`;
        break;
      }
    }

    const event: MarketEvent = {
      type: eventType,
      code: state.code,
      description,
      timestamp: Date.now(),
      magnitude,
    };

    this.eventLog.push(event);

    // Keep event log bounded
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxEventLogSize);
    }

    log.info(`[FutuMockFeed] EVENT: ${description}`);
  }
}

// ─── Singleton convenience (optional) ──────────────────────────────────────────

let defaultInstance: FutuMockFeed | null = null;

export function getDefaultMockFeed(config?: Partial<MockFeedConfig>): FutuMockFeed {
  if (!defaultInstance) {
    defaultInstance = new FutuMockFeed(config);
  }
  return defaultInstance;
}

export function destroyDefaultMockFeed(): void {
  if (defaultInstance) {
    defaultInstance.stop();
    defaultInstance = null;
  }
}

export default FutuMockFeed;
