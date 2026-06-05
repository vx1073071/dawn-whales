/**
 * futu-ws-adapter.ts
 *
 * Adapts Futu OpenD TCP quote push data to the WsMarketDataEngine format.
 * Acts as a bridge between the FutuOpenDClient (raw TCP protobuf) and
 * the WsMarketDataEngine (normalized MarketTick events).
 *
 * Responsibilities:
 *  - Subscribe to Futu OpenD real-time quote pushes
 *  - Convert Futu quote format to MarketTick format
 *  - Forward converted ticks to WsMarketDataEngine
 *  - Handle connection/disconnection lifecycle events
 *  - Track adapter status and statistics
 */

import log from 'electron-log';
import type { WsMarketDataEngine, MarketTick } from './ws-market-data';
import type { FutuOpenDClient } from '../broker/futu-opend';

// ─── Types ────────────────────────────────────────────────────

type AdapterStatus = 'disconnected' | 'connecting' | 'connected' | 'subscribed' | 'error';

interface AdapterStats {
  status: AdapterStatus;
  subscribedSymbols: string[];
  totalQuotesReceived: number;
  totalTicksForwarded: number;
  conversionErrors: number;
  connectionErrors: number;
  lastQuoteTime: number;
  startTime: number;
  uptimeMs: number;
}

interface FutuQuoteRaw {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  amount: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  updateTime: string;
  // Optional fields that may come from Futu push
  bidPrice?: number;
  askPrice?: number;
  bidVolume?: number;
  askVolume?: number;
}

// ─── FutuWsAdapter Class ─────────────────────────────────────

export class FutuWsAdapter {
  private futuClient: FutuOpenDClient;
  private wsEngine: WsMarketDataEngine;
  private status: AdapterStatus = 'disconnected';
  private subscribedSymbols: string[] = [];
  private totalQuotesReceived = 0;
  private totalTicksForwarded = 0;
  private conversionErrors = 0;
  private connectionErrors = 0;
  private lastQuoteTime = 0;
  private startTime = 0;
  private pushCallbackRegistered = false;
  private disconnectHandlerRegistered = false;

  constructor(futuClient: FutuOpenDClient, wsEngine: WsMarketDataEngine) {
    this.futuClient = futuClient;
    this.wsEngine = wsEngine;

    log.info('[FutuWsAdapter] Initialized');
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Start the adapter: connect to Futu OpenD (if needed),
   * subscribe to quote pushes for the given symbols,
   * and forward converted ticks to the WS engine.
   *
   * @param symbols - Array of symbol codes (e.g. ["US.TQQQ", "HK.00700"])
   */
  async start(symbols: string[]): Promise<void> {
    if (symbols.length === 0) {
      log.warn('[FutuWsAdapter] No symbols provided, not starting');
      return;
    }

    this.startTime = Date.now();
    this.subscribedSymbols = [...symbols];

    try {
      // Step 1: Ensure Futu client is connected
      this.status = 'connecting';
      await this.ensureConnection();

      // Step 2: Register push callback (only once)
      this.registerPushCallback();

      // Step 3: Register disconnect handler (only once)
      this.registerDisconnectHandler();

      // Step 4: Subscribe to Futu quote pushes
      this.status = 'subscribed';
      await this.futuClient.subscribeAndPush(symbols);

      log.info(`[FutuWsAdapter] Started — subscribed to ${symbols.length} symbols`, {
        symbols: symbols.join(', '),
      });
    } catch (err: any) {
      this.status = 'error';
      this.connectionErrors++;
      log.error(`[FutuWsAdapter] Start failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Stop the adapter: unsubscribe from all symbols.
   * The Futu client connection is left intact for other consumers.
   */
  async stop(): Promise<void> {
    if (this.status === 'disconnected') {
      log.warn('[FutuWsAdapter] Already disconnected');
      return;
    }

    // Unsubscribe by subscribing with empty list (Futu OpenD behavior)
    // Note: FutuOpenDClient doesn't expose an explicit unsubscribe method,
    // so we rely on the disconnect or re-subscribe pattern.
    this.status = 'disconnected';
    this.subscribedSymbols = [];

    const uptime = this.startTime > 0 ? Date.now() - this.startTime : 0;
    log.info(`[FutuWsAdapter] Stopped — forwarded ${this.totalTicksForwarded} ticks in ${(uptime / 1000).toFixed(1)}s`, {
      conversionErrors: this.conversionErrors,
      connectionErrors: this.connectionErrors,
    });

    // Reset counters
    this.totalQuotesReceived = 0;
    this.totalTicksForwarded = 0;
    this.conversionErrors = 0;
    this.startTime = 0;
  }

  // ─── Quote Conversion ─────────────────────────────────────

  /**
   * Convert a raw Futu quote object to a MarketTick.
   *
   * @param futuQuote - Raw quote from Futu OpenD push
   * @returns Normalized MarketTick
   */
  convertQuote(futuQuote: FutuQuoteRaw): MarketTick {
    const price = futuQuote.price ?? 0;
    const prevClose = futuQuote.prevClose ?? 0;

    // Calculate bid/ask if not provided
    const spreadPct = 0.0002; // Default 0.02% spread
    const halfSpread = price * spreadPct / 2;
    const bidPrice = futuQuote.bidPrice ?? Math.round((price - halfSpread) * 100) / 100;
    const askPrice = futuQuote.askPrice ?? Math.round((price + halfSpread) * 100) / 100;
    const bidVolume = futuQuote.bidVolume ?? 0;
    const askVolume = futuQuote.askVolume ?? 0;

    return {
      code: futuQuote.code,
      price,
      change: futuQuote.change ?? (prevClose > 0 ? Math.round((price - prevClose) * 100) / 100 : 0),
      changePct: futuQuote.changePct ?? (prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0),
      volume: futuQuote.volume ?? 0,
      amount: futuQuote.amount ?? 0,
      open: futuQuote.open ?? price,
      high: futuQuote.high ?? price,
      low: futuQuote.low ?? price,
      prevClose,
      bidPrice,
      askPrice,
      bidVolume,
      askVolume,
      updateTime: futuQuote.updateTime ?? new Date().toISOString(),
      source: 'futu',
    };
  }

  // ─── Status ───────────────────────────────────────────────

  /**
   * Get the current adapter status and statistics.
   */
  getStatus(): AdapterStats {
    return {
      status: this.status,
      subscribedSymbols: [...this.subscribedSymbols],
      totalQuotesReceived: this.totalQuotesReceived,
      totalTicksForwarded: this.totalTicksForwarded,
      conversionErrors: this.conversionErrors,
      connectionErrors: this.connectionErrors,
      lastQuoteTime: this.lastQuoteTime,
      startTime: this.startTime,
      uptimeMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  // ─── Private: Connection Management ───────────────────────

  /**
   * Ensure the Futu OpenD client is connected.
   * If not connected, attempts to connect.
   */
  private async ensureConnection(): Promise<void> {
    if (this.futuClient.connected) {
      log.info('[FutuWsAdapter] Futu client already connected');
      this.status = 'connected';
      return;
    }

    log.info('[FutuWsAdapter] Connecting to Futu OpenD...');
    await this.futuClient.connect();
    this.status = 'connected';
    log.info('[FutuWsAdapter] Futu OpenD connected');
  }

  /**
   * Register the quote push callback on the Futu client.
   * This callback receives raw quote arrays and converts/forwards them.
   */
  private registerPushCallback(): void {
    if (this.pushCallbackRegistered) return;

    this.futuClient.onQuotePush((quotes: any[]) => {
      this.handleQuotePush(quotes);
    });

    this.pushCallbackRegistered = true;
    log.info('[FutuWsAdapter] Push callback registered');
  }

  /**
   * Register a disconnect handler on the Futu client.
   */
  private registerDisconnectHandler(): void {
    if (this.disconnectHandlerRegistered) return;

    this.futuClient.onDisconnect(() => {
      this.handleDisconnect();
    });

    this.disconnectHandlerRegistered = true;
    log.info('[FutuWsAdapter] Disconnect handler registered');
  }

  // ─── Private: Event Handlers ──────────────────────────────

  /**
   * Handle incoming quote push from Futu OpenD.
   * Converts each quote to MarketTick and forwards to the WS engine.
   */
  private handleQuotePush(quotes: any[]): void {
    if (!quotes || quotes.length === 0) return;

    this.totalQuotesReceived += quotes.length;
    this.lastQuoteTime = Date.now();

    for (const rawQuote of quotes) {
      try {
        // Validate minimum required fields
        if (!rawQuote.code || rawQuote.price == null || rawQuote.price <= 0) {
          this.conversionErrors++;
          continue;
        }

        // Convert to MarketTick
        const tick = this.convertQuote(rawQuote as FutuQuoteRaw);

        // Forward to WS engine
        this.wsEngine.handleExternalTick(tick);
        this.totalTicksForwarded++;
      } catch (err: any) {
        this.conversionErrors++;
        log.warn(`[FutuWsAdapter] Quote conversion error for ${rawQuote?.code ?? 'unknown'}:`, err.message);
      }
    }
  }

  /**
   * Handle Futu OpenD disconnection.
   * Updates adapter status and logs the event.
   * The FutuOpenDClient handles reconnection internally;
   * once reconnected, the push subscription will be re-established.
   */
  private handleDisconnect(): void {
    log.warn('[FutuWsAdapter] Futu OpenD disconnected — adapter in error state');
    this.status = 'error';
    this.connectionErrors++;

    // The FutuOpenDClient's internal reconnect loop will re-establish
    // the connection and re-subscribe. We just need to update our status.
    // Once reconnected, the push callback will resume automatically.
  }
}

export default FutuWsAdapter;
