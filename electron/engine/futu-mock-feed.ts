/**
 * futu-mock-feed.ts
 *
 * Realistic mock market data feed generator for development and testing.
 * Generates synthetic ticks with configurable volatility, trend, and events,
 * then pushes them through the WsMarketDataEngine for downstream consumption.
 *
 * Features:
 *  - Per-symbol price state with random walk + drift + mean reversion
 *  - Realistic bid/ask spread (0.01–0.05% of price)
 *  - Volume with occasional spikes
 *  - Random "events": gap up/down, volume surges
 *  - Configurable tick interval
 */

import log from 'electron-log';
import type { WsMarketDataEngine, MarketTick } from './ws-market-data';

// ─── Types ────────────────────────────────────────────────────

type TrendDirection = 'up' | 'down' | 'flat';

interface SymbolState {
  code: string;
  currentPrice: number;
  basePrice: number;
  drift: number;
  volatility: number;
  trend: TrendDirection;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  cumulativeVolume: number;
  cumulativeAmount: number;
  lastTickTime: number;
  tickCount: number;
}

interface MockFeedConfig {
  /** Default tick interval in milliseconds */
  defaultIntervalMs: number;
  /** Global volatility multiplier */
  volatilityMultiplier: number;
  /** Probability of a random event per tick (0–1) */
  eventProbability: number;
  /** Maximum spread as fraction of price */
  maxSpreadPct: number;
  /** Minimum spread as fraction of price */
  minSpreadPct: number;
}

interface FeedStats {
  totalTicksPushed: number;
  ticksBySymbol: Record<string, number>;
  errors: number;
  startTime: number;
  uptimeMs: number;
  eventsTriggered: number;
  running: boolean;
}

// ─── Default Symbol Prices ────────────────────────────────────

const DEFAULT_PRICES: Record<string, { price: number; name: string }> = {
  'US.TQQQ':   { price: 52.00,   name: 'ProShares 3x QQQ' },
  'US.SQQQ':   { price: 28.50,   name: 'ProShares -3x QQQ' },
  'US.NVDA':   { price: 880.00,  name: 'NVIDIA' },
  'US.AAPL':   { price: 192.00,  name: 'Apple' },
  'US.MSFT':   { price: 420.00,  name: 'Microsoft' },
  'US.GOOG':   { price: 175.00,  name: 'Alphabet' },
  'US.AMZN':   { price: 185.00,  name: 'Amazon' },
  'US.META':   { price: 510.00,  name: 'Meta Platforms' },
  'US.TSLA':   { price: 245.00,  name: 'Tesla' },
  'US.AMDB':   { price: 165.00,  name: 'AMD' },
  'US.SPY':    { price: 545.00,  name: 'SPDR S&P 500' },
  'US.QQQ':    { price: 468.00,  name: 'Invesco QQQ' },
  'HK.00700':  { price: 378.50,  name: '腾讯控股' },
  'HK.09988':  { price: 82.00,   name: '阿里巴巴' },
  'HK.03690':  { price: 128.00,  name: '美团' },
  'HK.01810':  { price: 18.50,   name: '小米集团' },
  'HK.09888':  { price: 92.00,   name: '百度集团' },
  'HK.00981':  { price: 18.20,   name: '中芯国际' },
  'SH.600519': { price: 1580.00, name: '贵州茅台' },
  'SZ.300750': { price: 195.00,  name: '宁德时代' },
};

// ─── Default Configuration ────────────────────────────────────

const DEFAULT_CONFIG: MockFeedConfig = {
  defaultIntervalMs: 1000,
  volatilityMultiplier: 1.0,
  eventProbability: 0.005,
  maxSpreadPct: 0.0005,
  minSpreadPct: 0.0001,
};

// ─── FutuMockFeed Class ───────────────────────────────────────

export class FutuMockFeed {
  private wsEngine: WsMarketDataEngine;
  private config: MockFeedConfig;
  private symbolStates: Map<string, SymbolState> = new Map();
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private startTime = 0;
  private totalTicksPushed = 0;
  private errors = 0;
  private eventsTriggered = 0;
  private subscribedSymbols: string[] = [];

  constructor(wsEngine: WsMarketDataEngine, config?: Partial<MockFeedConfig>) {
    this.wsEngine = wsEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };

    log.info('[FutuMockFeed] Initialized', {
      defaultInterval: this.config.defaultIntervalMs,
      volatilityMultiplier: this.config.volatilityMultiplier,
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Start pushing mock ticks for the given symbols.
   *
   * @param symbols - Array of symbol codes (e.g. ["US.TQQQ", "HK.00700"])
   * @param intervalMs - Override tick interval (ms). Defaults to config.
   */
  start(symbols: string[], intervalMs?: number): void {
    if (this.running) {
      log.warn('[FutuMockFeed] Already running — stopping first');
      this.stop();
    }

    if (symbols.length === 0) {
      log.warn('[FutuMockFeed] No symbols provided, not starting');
      return;
    }

    this.subscribedSymbols = [...symbols];
    const interval = intervalMs ?? this.config.defaultIntervalMs;

    // Initialize symbol states
    for (const code of symbols) {
      this.initSymbolState(code);
    }

    this.running = true;
    this.startTime = Date.now();
    this.totalTicksPushed = 0;
    this.errors = 0;
    this.eventsTriggered = 0;

    // Start the tick loop
    this.intervalTimer = setInterval(() => {
      this.tickLoop();
    }, interval);

    log.info(`[FutuMockFeed] Started — ${symbols.length} symbols @ ${interval}ms`, {
      symbols: symbols.join(', '),
    });
  }

  /**
   * Stop all mock feed generation.
   */
  stop(): void {
    if (!this.running) {
      log.warn('[FutuMockFeed] Not running');
      return;
    }

    this.running = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    const uptime = Date.now() - this.startTime;
    log.info(`[FutuMockFeed] Stopped — pushed ${this.totalTicksPushed} ticks in ${(uptime / 1000).toFixed(1)}s`, {
      errors: this.errors,
      events: this.eventsTriggered,
    });
  }

  // ─── Configuration ────────────────────────────────────────

  /**
   * Set volatility for a specific symbol.
   * Higher values = larger price movements per tick.
   *
   * @param symbol - Symbol code
   * @param vol - Volatility value (0.0001 = very calm, 0.01 = very wild)
   */
  setVolatility(symbol: string, vol: number): void {
    const state = this.symbolStates.get(symbol);
    if (state) {
      state.volatility = Math.max(0.00001, Math.min(vol, 0.1));
      log.info(`[FutuMockFeed] Volatility set: ${symbol} → ${state.volatility}`);
    } else {
      log.warn(`[FutuMockFeed] Symbol not found: ${symbol}`);
    }
  }

  /**
   * Set trend direction for a specific symbol.
   *
   * @param symbol - Symbol code
   * @param direction - 'up', 'down', or 'flat'
   */
  setTrend(symbol: string, direction: TrendDirection): void {
    const state = this.symbolStates.get(symbol);
    if (!state) {
      log.warn(`[FutuMockFeed] Symbol not found: ${symbol}`);
      return;
    }

    state.trend = direction;

    // Set drift based on direction
    switch (direction) {
      case 'up':
        state.drift = state.volatility * 0.3;
        break;
      case 'down':
        state.drift = -state.volatility * 0.3;
        break;
      case 'flat':
        state.drift = 0;
        break;
    }

    log.info(`[FutuMockFeed] Trend set: ${symbol} → ${direction} (drift=${state.drift.toFixed(6)})`);
  }

  /**
   * Get the current mock feed configuration.
   */
  getConfig(): MockFeedConfig & { subscribedSymbols: string[] } {
    return {
      ...this.config,
      subscribedSymbols: [...this.subscribedSymbols],
    };
  }

  /**
   * Get feed statistics.
   */
  getStats(): FeedStats {
    const ticksBySymbol: Record<string, number> = {};
    for (const [code, state] of this.symbolStates.entries()) {
      ticksBySymbol[code] = state.tickCount;
    }

    return {
      totalTicksPushed: this.totalTicksPushed,
      ticksBySymbol,
      errors: this.errors,
      startTime: this.startTime,
      uptimeMs: this.running ? Date.now() - this.startTime : 0,
      eventsTriggered: this.eventsTriggered,
      running: this.running,
    };
  }

  // ─── Core Tick Generation Loop ────────────────────────────

  /**
   * Main tick loop called on each interval.
   * Generates and pushes one tick per subscribed symbol.
   */
  private tickLoop(): void {
    if (!this.running) return;

    for (const code of this.subscribedSymbols) {
      try {
        const state = this.symbolStates.get(code);
        if (!state) continue;

        // Check for random events
        if (Math.random() < this.config.eventProbability) {
          this.triggerEvent(state);
        }

        // Generate the tick
        const tick = this.generateTick(state);

        // Push to the WS engine
        this.wsEngine.handleExternalTick(tick);

        // Update stats
        this.totalTicksPushed++;
        state.tickCount++;
        state.lastTickTime = Date.now();
      } catch (err: any) {
        this.errors++;
        log.error(`[FutuMockFeed] Error generating tick for ${code}:`, err.message);
      }
    }
  }

  /**
   * Generate a single tick for a symbol based on random walk with drift
   * and mean reversion.
   */
  private generateTick(state: SymbolState): MarketTick {
    // Random walk component
    const randomWalk = this.gaussianRandom() * state.volatility * state.currentPrice;

    // Mean reversion component (pulls price back toward base)
    const meanReversionStrength = 0.002;
    const deviation = state.currentPrice - state.basePrice;
    const meanReversion = -deviation * meanReversionStrength;

    // Drift component (trend)
    const driftComponent = state.drift * state.currentPrice;

    // Calculate new price
    const priceChange = randomWalk + meanReversion + driftComponent;
    let newPrice = state.currentPrice + priceChange;

    // Ensure price stays positive
    newPrice = Math.max(newPrice, state.basePrice * 0.5);
    newPrice = Math.max(newPrice, 0.01);

    // Round to appropriate decimal places
    newPrice = this.roundPrice(newPrice);

    // Update day high/low
    state.dayHigh = Math.max(state.dayHigh, newPrice);
    state.dayLow = Math.min(state.dayLow, newPrice);

    // Generate volume (with occasional spikes)
    const baseVolume = this.generateVolume(state);
    state.cumulativeVolume += baseVolume;
    state.cumulativeAmount += baseVolume * newPrice;

    // Calculate change from prev close
    const change = this.roundPrice(newPrice - state.prevClose);
    const changePct = state.prevClose > 0
      ? Math.round(((newPrice - state.prevClose) / state.prevClose) * 10000) / 100
      : 0;

    // Generate bid/ask spread
    const spreadPct = this.config.minSpreadPct +
      Math.random() * (this.config.maxSpreadPct - this.config.minSpreadPct);
    const halfSpread = newPrice * spreadPct / 2;
    const bidPrice = this.roundPrice(newPrice - halfSpread);
    const askPrice = this.roundPrice(newPrice + halfSpread);

    // Bid/ask volumes (random but realistic)
    const bidVolume = Math.round((500 + Math.random() * 5000) / 100) * 100;
    const askVolume = Math.round((500 + Math.random() * 5000) / 100) * 100;

    // Update current price in state
    state.currentPrice = newPrice;

    return {
      code: state.code,
      price: newPrice,
      change,
      changePct,
      volume: state.cumulativeVolume,
      amount: Math.round(state.cumulativeAmount * 100) / 100,
      open: state.dayOpen,
      high: state.dayHigh,
      low: state.dayLow,
      prevClose: state.prevClose,
      bidPrice,
      askPrice,
      bidVolume,
      askVolume,
      updateTime: new Date().toISOString(),
      source: 'mock',
    };
  }

  // ─── Event System ─────────────────────────────────────────

  /**
   * Trigger a random market event on a symbol.
   * Events: gap up, gap down, volume surge.
   */
  private triggerEvent(state: SymbolState): void {
    const eventType = Math.random();
    this.eventsTriggered++;

    if (eventType < 0.35) {
      // Gap Up: price jumps 1–3%
      const gapPct = 0.01 + Math.random() * 0.02;
      state.currentPrice = this.roundPrice(state.currentPrice * (1 + gapPct));
      state.dayHigh = Math.max(state.dayHigh, state.currentPrice);
      log.info(`[FutuMockFeed] EVENT: Gap UP ${state.code} +${(gapPct * 100).toFixed(2)}% → ${state.currentPrice}`);
    } else if (eventType < 0.70) {
      // Gap Down: price drops 1–3%
      const gapPct = 0.01 + Math.random() * 0.02;
      state.currentPrice = this.roundPrice(state.currentPrice * (1 - gapPct));
      state.dayLow = Math.min(state.dayLow, state.currentPrice);
      log.info(`[FutuMockFeed] EVENT: Gap DOWN ${state.code} -${(gapPct * 100).toFixed(2)}% → ${state.currentPrice}`);
    } else {
      // Volume Surge: 5–20x normal volume
      const surgeMultiplier = 5 + Math.random() * 15;
      const surgeVolume = Math.round(surgeMultiplier * 2000);
      state.cumulativeVolume += surgeVolume;
      state.cumulativeAmount += surgeVolume * state.currentPrice;
      log.info(`[FutuMockFeed] EVENT: Volume SURGE ${state.code} ${surgeMultiplier.toFixed(1)}x (+${surgeVolume})`);
    }
  }

  // ─── Symbol State Initialization ──────────────────────────

  /**
   * Initialize or reset the state for a symbol.
   */
  private initSymbolState(code: string): void {
    const defaultInfo = DEFAULT_PRICES[code];
    const basePrice = defaultInfo?.price ?? 100;

    // Add slight randomness to starting price (±0.5%)
    const startPrice = this.roundPrice(basePrice * (1 + (Math.random() - 0.5) * 0.01));

    const state: SymbolState = {
      code,
      currentPrice: startPrice,
      basePrice,
      drift: 0,
      volatility: this.getDefaultVolatility(code),
      trend: 'flat',
      dayOpen: startPrice,
      dayHigh: startPrice,
      dayLow: startPrice,
      prevClose: this.roundPrice(basePrice * (1 + (Math.random() - 0.5) * 0.005)),
      cumulativeVolume: Math.round(Math.random() * 50000) + 10000,
      cumulativeAmount: 0,
      lastTickTime: 0,
      tickCount: 0,
    };

    // Calculate initial cumulative amount
    state.cumulativeAmount = state.cumulativeVolume * startPrice;

    this.symbolStates.set(code, state);

    log.info(`[FutuMockFeed] Symbol initialized: ${code} @ ${startPrice} (prevClose=${state.prevClose})`);
  }

  /**
   * Get default volatility for a symbol based on its type.
   * Leveraged ETFs and crypto-adjacent stocks get higher vol.
   */
  private getDefaultVolatility(code: string): number {
    const vol = this.config.volatilityMultiplier;

    // Leveraged ETFs are wild
    if (code.includes('TQQQ') || code.includes('SQQQ') || code.includes('SOXL')) {
      return 0.003 * vol;
    }

    // Tech stocks are moderately volatile
    if (code.includes('NVDA') || code.includes('TSLA') || code.includes('AMD')) {
      return 0.002 * vol;
    }

    // Large caps are calmer
    if (code.includes('AAPL') || code.includes('MSFT') || code.includes('GOOG')) {
      return 0.001 * vol;
    }

    // HK stocks
    if (code.startsWith('HK.')) {
      return 0.0015 * vol;
    }

    // A-shares
    if (code.startsWith('SH.') || code.startsWith('SZ.')) {
      return 0.0012 * vol;
    }

    // Default
    return 0.0015 * vol;
  }

  // ─── Volume Generation ────────────────────────────────────

  /**
   * Generate realistic per-tick volume.
   * Most ticks have modest volume; occasional spikes.
   */
  private generateVolume(state: SymbolState): number {
    // Base volume per tick (in shares)
    let baseVol = 100 + Math.random() * 900;

    // Volume spikes (5% chance)
    if (Math.random() < 0.05) {
      baseVol *= 3 + Math.random() * 7;
    }

    // Higher volume for popular stocks
    if (state.code.includes('TQQQ') || state.code.includes('NVDA') || state.code.includes('00700')) {
      baseVol *= 2;
    }

    // Round to nearest 100
    return Math.round(baseVol / 100) * 100;
  }

  // ─── Utility Functions ────────────────────────────────────

  /**
   * Generate a Gaussian random number using Box-Muller transform.
   * Mean = 0, StdDev = 1.
   */
  private gaussianRandom(): number {
    let u1 = 0;
    let u2 = 0;

    // Avoid log(0)
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();

    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z;
  }

  /**
   * Round price to appropriate decimal places.
   * HK stocks: 1–2 decimals; US stocks: 2 decimals; A-shares: 2 decimals.
   */
  private roundPrice(price: number): number {
    if (price >= 1000) {
      return Math.round(price * 100) / 100;
    }
    if (price >= 100) {
      return Math.round(price * 100) / 100;
    }
    if (price >= 10) {
      return Math.round(price * 100) / 100;
    }
    return Math.round(price * 1000) / 1000;
  }
}

export default FutuMockFeed;
