/**
 * Moomoo OpenD Adapter
 * Implements IBrokerAdapter interface for Moomoo broker integration
 * Moomoo uses similar OpenD protocol as Futu but with different defaults (port 11211)
 */

import {
  IBrokerAdapter,
  BrokerConfig,
  AccountInfo,
  FundsInfo,
  PositionInfo,
  OrderInfo,
  QuoteInfo,
  KlineInfo,
  PlaceOrderRequest,
} from './IBrokerAdapter';
import log from 'electron-log';

export interface MoomooConfig extends BrokerConfig {
  language?: 'en' | 'zh-CN' | 'zh-HK';
  market?: 'US' | 'HK' | 'SG';
  currency?: 'USD' | 'HKD' | 'SGD';
}

type QuoteCallback = (quotes: QuoteInfo[]) => void;
type DisconnectCallback = () => void;

export class MoomooAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly type: string = 'moomoo';
  readonly name: string;
  connected: boolean = false;

  private config: MoomooConfig;
  private subscribedSymbols: Set<string> = new Set();
  private quoteCache: Map<string, QuoteInfo> = new Map();
  private mockMode: boolean = false;
  private quoteCallbacks: QuoteCallback[] = [];
  private disconnectCallbacks: DisconnectCallback[] = [];
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: MoomooConfig) {
    this.id = config.id || 'moomoo-default';
    this.name = config.name || 'Moomoo';
    this.config = {
      ...config,
      host: config.host || '127.0.0.1',
      port: config.port || 11211, // Moomoo default port (vs Futu 11111)
      language: config.language || 'en',
      market: config.market || 'US',
      currency: config.currency || 'USD',
    };
    log.info(`[MoomooAdapter] Initialized: ${this.id} (${this.config.host}:${this.config.port})`);
  }

  async connect(): Promise<void> {
    try {
      log.info(`[MoomooAdapter] Connecting to ${this.config.host}:${this.config.port}...`);

      // TODO: Implement actual Moomoo OpenD TCP connection
      // Moomoo OpenD uses same protocol as Futu but different port (11211)
      // For now, use mock mode
      this.mockMode = true;
      this.connected = true;

      // Start mock quote push
      this.startMockQuotePush();

      log.info(`[MoomooAdapter] Connected successfully (mock mode: ${this.mockMode})`);
    } catch (err: any) {
      log.error(`[MoomooAdapter] Connection failed: ${err.message}`);
      this.connected = false;
      throw err;
    }
  }

  disconnect(): void {
    try {
      log.info('[MoomooAdapter] Disconnecting...');
      this.connected = false;
      this.subscribedSymbols.clear();
      this.quoteCache.clear();

      if (this.mockTimer) {
        clearInterval(this.mockTimer);
        this.mockTimer = null;
      }

      // Notify disconnect callbacks
      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* ignore */ }
      }

      log.info('[MoomooAdapter] Disconnected');
    } catch (err: any) {
      log.error(`[MoomooAdapter] Disconnect error: ${err.message}`);
    }
  }

  // ── Quote Push ──────────────────────────────────────────────────────────

  onQuotePush(callback: QuoteCallback): void {
    this.quoteCallbacks.push(callback);
  }

  removeQuotePush(callback: QuoteCallback): void {
    const idx = this.quoteCallbacks.indexOf(callback);
    if (idx >= 0) this.quoteCallbacks.splice(idx, 1);
  }

  onDisconnect(callback: DisconnectCallback): void {
    this.disconnectCallbacks.push(callback);
  }

  // ── Account ─────────────────────────────────────────────────────────────

  async getAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return [
        {
          accountId: 'MOOMOO-001',
          name: 'Moomoo Demo Account',
          currency: this.config.currency || 'USD',
          netAssets: 100000,
          totalAssets: 100000,
          cash: 50000,
          marketValue: 50000,
        },
      ];
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return {
        totalAssets: 100000,
        cash: 50000,
        marketValue: 50000,
        frozenCash: 0,
        availableCash: 50000,
        currency: this.config.currency || 'USD',
      };
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  // ── Positions ───────────────────────────────────────────────────────────

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return [
        {
          code: 'US.AAPL', name: 'Apple Inc.', qty: 100,
          costPrice: 150.0, marketPrice: 155.0, marketValue: 15500,
          pnl: 500, pnlPct: 3.33, ratio: 0.31,
        },
        {
          code: 'US.TSLA', name: 'Tesla Inc.', qty: 50,
          costPrice: 200.0, marketPrice: 210.0, marketValue: 10500,
          pnl: 500, pnlPct: 5.0, ratio: 0.21,
        },
        {
          code: 'US.NVDA', name: 'NVIDIA Corp.', qty: 30,
          costPrice: 800.0, marketPrice: 880.0, marketValue: 26400,
          pnl: 2400, pnlPct: 10.0, ratio: 0.48,
        },
      ];
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  // ── Quotes ──────────────────────────────────────────────────────────────

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    return codes.map(code => {
      const cached = this.quoteCache.get(code);
      if (cached) return cached;

      const mockQuote = this.generateMockQuote(code);
      this.quoteCache.set(code, mockQuote);
      return mockQuote;
    });
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      const klines: KlineInfo[] = [];
      let price = 150 + Math.random() * 50;
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = this.periodToSeconds(period);

      for (let i = count - 1; i >= 0; i--) {
        const change = (Math.random() - 0.48) * price * 0.03;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * price * 0.01;
        const low = Math.min(open, close) - Math.random() * price * 0.01;

        klines.push({
          time: now - i * intervalSec,
          open: +open.toFixed(2),
          high: +high.toFixed(2),
          low: +low.toFixed(2),
          close: +close.toFixed(2),
          volume: Math.floor(Math.random() * 1000000) + 100000,
        });

        price = close;
      }

      return klines;
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  // ── Orders ──────────────────────────────────────────────────────────────

  async placeOrder(request: PlaceOrderRequest): Promise<{ orderId: string }> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      const orderId = `MOOMOO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      log.info(`[MoomooAdapter] Order placed: ${orderId} ${request.side} ${request.qty} ${request.code} @ ${request.price || 'MARKET'}`);
      return { orderId };
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      log.info(`[MoomooAdapter] Order cancelled: ${orderId} for ${code} (mock mode)`);
      return;
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return [
        {
          orderId: 'MOOMOO-ORD-001',
          code: 'US.AAPL',
          side: 'BUY',
          orderType: 'LIMIT',
          qty: 100,
          price: 150.0,
          filledQty: 100,
          filledPrice: 150.0,
          status: 'FILLED',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
    }

    // TODO: Implement actual Moomoo API call
    throw new Error('Real Moomoo API not implemented yet');
  }

  // ── Subscription ────────────────────────────────────────────────────────

  async subscribeAndPush(codes: string[]): Promise<void> {
    if (!this.connected) throw new Error('Not connected');

    for (const code of codes) {
      this.subscribedSymbols.add(code);
    }

    log.info(`[MoomooAdapter] Subscribed to ${codes.length} symbols: ${codes.join(', ')}`);

    // Start mock quote push if not already running
    if (this.mockMode && !this.mockTimer) {
      this.startMockQuotePush();
    }
  }

  // ── Mock Mode ───────────────────────────────────────────────────────────

  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    log.info(`[MoomooAdapter] Mock mode ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled && this.connected) {
      this.startMockQuotePush();
    } else if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
  }

  // ── Currency Conversion ─────────────────────────────────────────────────

  async convertCurrency(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;

    const rates: Record<string, Record<string, number>> = {
      'USD': { 'HKD': 7.78, 'SGD': 1.35 },
      'HKD': { 'USD': 0.128, 'SGD': 0.174 },
      'SGD': { 'USD': 0.74, 'HKD': 5.76 },
    };

    const rate = rates[from]?.[to] || 1.0;
    return amount * rate;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private generateMockQuote(code: string): QuoteInfo {
    const basePrice = this.getBasePrice(code);
    const change = (Math.random() - 0.48) * basePrice * 0.03;
    const price = basePrice + change;
    const prevClose = basePrice - (Math.random() - 0.5) * basePrice * 0.02;

    return {
      code,
      price: +price.toFixed(2),
      change: +(price - prevClose).toFixed(2),
      changePct: +(((price - prevClose) / prevClose) * 100).toFixed(2),
      volume: Math.floor(Math.random() * 1000000) + 100000,
      turnover: Math.floor(Math.random() * 100000000),
      high: +(price + Math.random() * basePrice * 0.01).toFixed(2),
      low: +(price - Math.random() * basePrice * 0.01).toFixed(2),
      open: +(basePrice + (Math.random() - 0.5) * basePrice * 0.01).toFixed(2),
      prevClose: +prevClose.toFixed(2),
      time: new Date().toISOString(),
    };
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
        try { cb(quotes); } catch (err: any) {
          log.error(`[MoomooAdapter] Quote callback error: ${err.message}`);
        }
      }
    }, 2000); // Push every 2 seconds
  }

  private getBasePrice(code: string): number {
    const prices: Record<string, number> = {
      'US.AAPL': 155, 'US.TSLA': 210, 'US.NVDA': 880,
      'US.MSFT': 420, 'US.GOOGL': 155, 'US.AMZN': 185,
      'US.META': 490, 'US.SPY': 520, 'US.QQQ': 445,
      'US.TQQQ': 52, 'US.SQQQ': 28, 'US.SOXL': 35,
      'US.SOXS': 22, 'US.IWM': 200, 'US.GLD': 215,
    };
    return prices[code] || 100;
  }

  private periodToSeconds(period: string): number {
    const map: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
    };
    return map[period] || 86400;
  }

  getConfig(): MoomooConfig {
    return { ...this.config };
  }
}

export function createMoomooAdapter(config?: Partial<MoomooConfig>): MoomooAdapter {
  return new MoomooAdapter({
    id: config?.id || 'moomoo-default',
    name: config?.name || 'Moomoo',
    type: 'moomoo',
    host: config?.host || '127.0.0.1',
    port: config?.port || 11211,
    enabled: config?.enabled !== false,
    ...config,
  } as MoomooConfig);
}
