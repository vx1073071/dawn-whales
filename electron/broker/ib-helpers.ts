// @ts-nocheck — extracted from ib-adapter.ts (R119 #35)
// IBAdapter: Mock mode + utility accessors + helpers
//
// @round R119 #35 — split from ib-adapter.ts (was 1769L)
// @since 2026-06-12

import log from 'electron-log';
import type { QuoteInfo, KlineInfo } from './IBrokerAdapter';

export class IBHelpers {
  private mockMode = false;
  private connected = false;
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  //  MOCK MODE CONTROL
  // ════════════════════════════════════════════════════════════════════════

  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    log.info(`[IBAdapter] Mock mode ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled && this.connected) {
      this.startMockQuotePush();
    } else if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
  }

  /** Get current mock mode status */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /** Switch to mock mode after a TCP failure */
  private fallbackToMock(method: string): void {
    log.warn(`[IBAdapter] ${method}: TCP failed, falling back to mock mode`);
    this.mockMode = true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONFIG ACCESSOR
  // ════════════════════════════════════════════════════════════════════════

  getConfig(): IBConfig {
    return { ...this.config };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  IB-SPECIFIC UTILITY METHODS
  // ════════════════════════════════════════════════════════════════════════

  /** Get the IB server version detected during handshake */
  getServerVersion(): number {
    return this.serverVersion;
  }

  /** Get the IB server connection time string */
  getConnectionTime(): string {
    return this.serverConnectionTime;
  }

  /** Get the next available order ID */
  getNextOrderId(): number {
    return this.nextOrderId;
  }

  /** Get list of supported exchanges */
  getSupportedExchanges(): readonly string[] {
    return IB_EXCHANGES;
  }

  /** Check if a symbol has a known contract ID */
  hasKnownContract(symbol: string): boolean {
    return symbol in CONTRACT_ID_MAP;
  }

  /** Get the contract ID for a symbol, or 0 if unknown */
  getContractId(symbol: string): number {
    return CONTRACT_ID_MAP[symbol] ?? 0;
  }

  /** Get the default port for a given connection type */
  static getDefaultPort(type: 'gateway-live' | 'gateway-paper' | 'tws-live' | 'tws-paper'): number {
    switch (type) {
      case 'gateway-live': return IB_GATEWAY_LIVE_PORT;
      case 'gateway-paper': return IB_GATEWAY_PAPER_PORT;
      case 'tws-live': return TWS_LIVE_PORT;
      case 'tws-paper': return TWS_PAPER_PORT;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS — MOCK DATA
  // ════════════════════════════════════════════════════════════════════════

  private startQuotePushIfNeeded(): void {
    if (this.mockMode) {
      this.startMockQuotePush();
    }
    // In real mode, push comes from TCP tick data — no timer needed
  }

  private startMockQuotePush(): void {
    if (this.mockTimer) return;

    this.mockTimer = setInterval(() => {
      if (!this.connected || this.subscribedSymbols.size === 0) return;

      const quotes: QuoteInfo[] = [];
      for (const code of this.subscribedSymbols) {
        const quote = this.generateMockQuote(code);
        this.quoteCache.set(code, quote);
        quotes.push(quote);
      }

      for (const cb of this.quoteCallbacks) {
        try { cb(quotes); } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`[IBAdapter] Quote callback error: ${msg}`);
        }
      }
    }, MOCK_PUSH_INTERVAL_MS);
  }

  private generateMockQuote(code: string): QuoteInfo {
    const basePrice = getMockBasePrice(code);
    const price = jitter(basePrice, 0.025);
    const prevClose = basePrice * (1 + (Math.random() - 0.5) * 0.015);
    const open = basePrice * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(price, open) * (1 + Math.random() * 0.008);
    const low = Math.min(price, open) * (1 - Math.random() * 0.008);
    const change = +(price - prevClose).toFixed(2);
    const changePct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

    return {
      code,
      price: +price.toFixed(2),
      change,
      changePct,
      volume: Math.floor(Math.random() * 2000000) + 200000,
      turnover: Math.floor(Math.random() * 500000000) + 50000000,
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      open: +open.toFixed(2),
      prevClose: +prevClose.toFixed(2),
      time: new Date().toISOString(),
    };
  }

  private generateMockKlines(code: string, period: string, count: number): KlineInfo[] {
    const klines: KlineInfo[] = [];
    let price = getMockBasePrice(code);
    const now = Math.floor(Date.now() / 1000);
    const intervalSec = this.periodToSeconds(period);

    for (let i = count - 1; i >= 0; i--) {
      const change = (Math.random() - 0.48) * price * 0.025;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * price * 0.008;
      const low = Math.min(open, close) - Math.random() * price * 0.008;

      klines.push({
        time: now - i * intervalSec,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume: Math.floor(Math.random() * 1500000) + 150000,
      });

      price = close;
    }

    return klines;
  }

  private periodToSeconds(period: string): number {
    const map: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
      'daily': 86400, 'weekly': 604800, 'monthly': 2592000,
    };
    return map[period] || 86400;
  }
}