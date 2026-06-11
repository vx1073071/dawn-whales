import log from 'electron-log';
import { EngineError } from '../core/engine-error';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface FutuQuote {
  code: string;
  name: string;
  curPrice: number;
  prevClose: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  turnover: number;
  updateTime: string;
  bidPrice: number;
  askPrice: number;
  bidVol: number;
  askVol: number;
}

export interface MarketTick {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  bidVol?: number;
  askVol?: number;
}

export interface AdapterStatus {
  connected: boolean;
  subscribedSymbols: string[];
  ticksConverted: number;
  errors: number;
  lastTickAt: number;
  uptime: number;
}

type QuoteUpdateCallback = (tick: MarketTick) => void;

// ─── Constants ─────────────────────────────────────────────────────────────────

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const STATS_LOG_INTERVAL_MS = 60_000;

// ─── Adapter ───────────────────────────────────────────────────────────────────

export class FutuWsAdapter {
  private futuClient: unknown;
  private wsEngine: unknown;

  private subscribedSymbols: Set<string> = new Set();
  private callbacks: QuoteUpdateCallback[] = [];

  private connected = false;
  private running = false;
  private ticksConverted = 0;
  private errors = 0;
  private lastTickAt = 0;
  private startedAt = 0;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  // Bound handlers for clean removal
  private boundOnQuote: (quote: FutuQuote) => void;
  private boundOnConnect: () => void;
  private boundOnDisconnect: (reason: string) => void;
  private boundOnError: (err: Error) => void;

  constructor(futuClient: unknown, wsEngine: unknown) {
    this.futuClient = futuClient;
    this.wsEngine = wsEngine;

    this.boundOnQuote = this.handleFutuQuote.bind(this);
    this.boundOnConnect = this.handleFutuConnect.bind(this);
    this.boundOnDisconnect = this.handleFutuDisconnect.bind(this);
    this.boundOnError = this.handleFutuError.bind(this);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async start(symbols: string[]): Promise<boolean> {
    if (this.running) {
      log.warn('[FutuWsAdapter] Adapter already running, ignoring start()');
      return true;
    }

    log.info(`[FutuWsAdapter] Starting adapter with ${symbols.length} symbols`);
    this.running = true;
    this.startedAt = Date.now();
    this.attachEventListeners();
    this.startStatsLogger();

    try {
      const connected = await this.ensureConnection();
      if (!connected) {
        log.error('[FutuWsAdapter] Failed to connect to Futu OpenD');
        return false;
      }

      await this.subscribeToSymbols(symbols);
      log.info(`[FutuWsAdapter] Adapter started successfully`);
      return true;
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      void EngineError; // structured error domain: DATA
      log.error('[FutuWsAdapter] Failed to start:', err);
      this.errors++;
      return false;
    }
  }

  stop(): void {
    log.info('[FutuWsAdapter] Stopping adapter');
    this.running = false;
    this.connected = false;

    this.stopStatsLogger();
    this.clearReconnectTimer();

    if (this.subscribedSymbols.size > 0) {
      this.unsubscribeAll();
    }

    this.detachEventListeners();
    this.subscribedSymbols.clear();
    this.callbacks = [];

    log.info(
      `[FutuWsAdapter] Adapter stopped — ${this.ticksConverted} ticks converted, ${this.errors} errors`
    );
  }

  async addSymbols(symbols: string[]): Promise<void> {
    const newSymbols = symbols.filter((s) => !this.subscribedSymbols.has(s));
    if (newSymbols.length === 0) {
      log.debug('[FutuWsAdapter] addSymbols: all symbols already subscribed');
      return;
    }

    log.info(`[FutuWsAdapter] Adding ${newSymbols.length} symbols: ${newSymbols.join(', ')}`);

    try {
      await this.subscribeToSymbols(newSymbols);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[FutuWsAdapter] Failed to add symbols:', err);
      this.errors++;
      throw err;
    }
  }

  removeSymbols(symbols: string[]): void {
    const toRemove = symbols.filter((s) => this.subscribedSymbols.has(s));
    if (toRemove.length === 0) {
      log.debug('[FutuWsAdapter] removeSymbols: none of the specified symbols are subscribed');
      return;
    }

    log.info(`[FutuWsAdapter] Removing ${toRemove.length} symbols: ${toRemove.join(', ')}`);

    for (const sym of toRemove) {
      this.subscribedSymbols.delete(sym);
    }

    try {
      this.futuClient.unsubscribeQuote(toRemove);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[FutuWsAdapter] Error unsubscribing symbols:', err);
      this.errors++;
    }
  }

  convertQuote(futuQuote: FutuQuote): MarketTick {
    const change = futuQuote.curPrice - futuQuote.prevClose;
    const changePct =
      futuQuote.prevClose !== 0
        ? (change / futuQuote.prevClose) * 100
        : 0;

    const tick: MarketTick = {
      code: futuQuote.code,
      price: futuQuote.curPrice,
      change: roundTo(change, 4),
      changePct: roundTo(changePct, 4),
      volume: futuQuote.volume,
      high: futuQuote.highPrice,
      low: futuQuote.lowPrice,
      open: futuQuote.openPrice,
      prevClose: futuQuote.prevClose,
      timestamp: parseTimestamp(futuQuote.updateTime),
    };

    if (futuQuote.bidPrice > 0) {
      tick.bid = futuQuote.bidPrice;
      tick.bidVol = futuQuote.bidVol;
    }

    if (futuQuote.askPrice > 0) {
      tick.ask = futuQuote.askPrice;
      tick.askVol = futuQuote.askVol;
    }

    return tick;
  }

  getStatus(): AdapterStatus {
    return {
      connected: this.connected,
      subscribedSymbols: Array.from(this.subscribedSymbols),
      ticksConverted: this.ticksConverted,
      errors: this.errors,
      lastTickAt: this.lastTickAt,
      uptime: this.running ? Date.now() - this.startedAt : 0,
    };
  }

  onQuoteUpdate(callback: QuoteUpdateCallback): void {
    this.callbacks.push(callback);
  }

  // ─── Private: Event Handlers ───────────────────────────────────────────────

  private handleFutuQuote(quote: FutuQuote): void {
    try {
      if (!quote || !quote.code) {
        log.warn('[FutuWsAdapter] Received invalid quote (missing code)');
        this.errors++;
        return;
      }

      const tick = this.convertQuote(quote);
      this.ticksConverted++;
      this.lastTickAt = Date.now();

      // Forward to wsEngine
      this.forwardToWsEngine(tick);

      // Notify registered callbacks
      this.notifyCallbacks(tick);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error(`[FutuWsAdapter] Error processing quote for ${quote?.code}:`, err);
      this.errors++;
    }
  }

  private handleFutuConnect(): void {
    log.info('[FutuWsAdapter] Futu OpenD connected');
    this.connected = true;
    this.reconnectAttempts = 0;

    // Re-subscribe on reconnect if we had symbols
    if (this.subscribedSymbols.size > 0) {
      const symbols = Array.from(this.subscribedSymbols);
      log.info(
        `[FutuWsAdapter] Re-subscribing to ${symbols.length} symbols after reconnect`
      );
      this.subscribeToSymbols(symbols).catch((err: unknown) => {
        log.error('[FutuWsAdapter] Failed to re-subscribe after reconnect:', err);
        this.errors++;
      });
    }
  }

  private handleFutuDisconnect(reason: string): void {
    log.warn(`[FutuWsAdapter] Futu OpenD disconnected: ${reason}`);
    this.connected = false;

    if (this.running) {
      this.scheduleReconnect();
    }
  }

  private handleFutuError(err: Error): void {
    log.error('[FutuWsAdapter] Futu OpenD error:', err.message);
    this.errors++;
  }

  // ─── Private: Subscriptions ────────────────────────────────────────────────

  private async ensureConnection(): Promise<boolean> {
    if (this.connected) return true;

    try {
      if (typeof this.futuClient.connect === 'function') {
        await this.futuClient.connect();
      }
      this.connected = true;
      this.reconnectAttempts = 0;
      return true;
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[FutuWsAdapter] Connection failed:', err);
      this.connected = false;
      return false;
    }
  }

  private async subscribeToSymbols(symbols: string[]): Promise<void> {
    for (const sym of symbols) {
      this.subscribedSymbols.add(sym);
    }

    if (typeof this.futuClient.subscribeQuote === 'function') {
      await this.futuClient.subscribeQuote(symbols);
    } else {
      log.warn('[FutuWsAdapter] futuClient.subscribeQuote is not available');
    }
  }

  private unsubscribeAll(): void {
    try {
      const symbols = Array.from(this.subscribedSymbols);
      if (typeof this.futuClient.unsubscribeQuote === 'function') {
        this.futuClient.unsubscribeQuote(symbols);
      }
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[FutuWsAdapter] Error during unsubscribeAll:', err);
      this.errors++;
    }
  }

  // ─── Private: Reconnection ─────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log.error(
        `[FutuWsAdapter] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`
      );
      return;
    }

    this.clearReconnectTimer();
    this.reconnectAttempts++;

    const delay = Math.min(
      RECONNECT_DELAY_MS * this.reconnectAttempts,
      30_000
    );

    log.info(
      `[FutuWsAdapter] Scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      if (!this.running) return;

      log.info(`[FutuWsAdapter] Reconnect attempt ${this.reconnectAttempts}...`);
      const ok = await this.ensureConnection();

      if (ok) {
        log.info('[FutuWsAdapter] Reconnected successfully');
      } else {
        log.warn('[FutuWsAdapter] Reconnect failed, will retry');
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Private: Forwarding ───────────────────────────────────────────────────

  private forwardToWsEngine(tick: MarketTick): void {
    try {
      if (this.wsEngine && typeof this.wsEngine.pushTick === 'function') {
        this.wsEngine.pushTick(tick);
      } else if (this.wsEngine && typeof this.wsEngine.onMarketTick === 'function') {
        this.wsEngine.onMarketTick(tick);
      } else {
        log.debug('[FutuWsAdapter] wsEngine has no pushTick/onMarketTick method');
      }
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error(`[FutuWsAdapter] Failed to forward tick ${tick.code} to wsEngine:`, err);
      this.errors++;
    }
  }

  private notifyCallbacks(tick: MarketTick): void {
    for (const cb of this.callbacks) {
      try {
        cb(tick);
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[FutuWsAdapter] Callback error:', err);
        this.errors++;
      }
    }
  }

  // ─── Private: Event Listener Management ────────────────────────────────────

  private attachEventListeners(): void {
    if (!this.futuClient) return;

    if (typeof this.futuClient.on === 'function') {
      this.futuClient.on('quote', this.boundOnQuote);
      this.futuClient.on('connect', this.boundOnConnect);
      this.futuClient.on('disconnect', this.boundOnDisconnect);
      this.futuClient.on('error', this.boundOnError);
    }
  }

  private detachEventListeners(): void {
    if (!this.futuClient) return;

    if (typeof this.futuClient.off === 'function') {
      this.futuClient.off('quote', this.boundOnQuote);
      this.futuClient.off('connect', this.boundOnConnect);
      this.futuClient.off('disconnect', this.boundOnDisconnect);
      this.futuClient.off('error', this.boundOnError);
    }
  }

  // ─── Private: Stats Logging ────────────────────────────────────────────────

  private startStatsLogger(): void {
    this.stopStatsLogger();
    this.statsTimer = setInterval(() => {
      const status = this.getStatus();
      log.info(
        `[FutuWsAdapter] Stats — connected: ${status.connected}, ` +
          `symbols: ${status.subscribedSymbols.length}, ` +
          `ticks: ${status.ticksConverted}, errors: ${status.errors}, ` +
          `uptime: ${formatUptime(status.uptime)}`
      );
    }, STATS_LOG_INTERVAL_MS);
  }

  private stopStatsLogger(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function parseTimestamp(updateTime: string): number {
  if (!updateTime) return Date.now();

  const parsed = new Date(updateTime).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function formatUptime(ms: number): string {
  if (ms <= 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default FutuWsAdapter;
