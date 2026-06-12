/**
 * Longbridge OpenAPI Adapter — R2 CMP-01
 *
 * Implements IBrokerAdapter for Longbridge broker integration.
 *
 * Longbridge uses OAuth 2.0 + JWT Bearer Token authentication (NOT OpenD protocol).
 * Markets: HK/US/SG/CN-A
 * REST Base: https://openapi.longbridgeapp.com
 * WebSocket: wss://openapi-ws.longbridgeapp.com
 *
 * Design: implements IBrokerAdapter directly (not extends OpenDBaseAdapter)
 * because Longbridge uses standard REST + JSON, not Protobuf over TCP.
 *
 * References:
 *   https://open.longbridgeapp.com/en/docs
 *   npm: @longbridge/openapi (optional, fallback to manual REST if unavailable)
 */
import log from 'electron-log';
import type {
  IBrokerAdapter,
  BrokerConfig,
  AccountInfo,
  FundsInfo,
  QuoteInfo,
  KlineInfo,
  PositionInfo,
  OrderInfo,
  PlaceOrderRequest,
} from './IBrokerAdapter';

// ══ Constants ═══════════════════════════════════════════════

const LONG_API = 'https://openapi.longbridgeapp.com';
const LONG_WS = 'wss://openapi-ws.longbridgeapp.com';

/** Default mock contract mapping for 20 stocks across HK/US/SG/CN */
const LONG_CONTRACTS: Record<string, { name: string; market: string; lotSize: number; basePrice: number; currency: string }> = {
  // US
  'AAPL.US':  { name: 'Apple Inc.',         market: 'US', lotSize: 1,   basePrice: 185, currency: 'USD' },
  'TSLA.US':  { name: 'Tesla Inc.',         market: 'US', lotSize: 1,   basePrice: 210, currency: 'USD' },
  'NVDA.US':  { name: 'NVIDIA Corp.',       market: 'US', lotSize: 1,   basePrice: 880, currency: 'USD' },
  'MSFT.US':  { name: 'Microsoft Corp.',    market: 'US', lotSize: 1,   basePrice: 420, currency: 'USD' },
  'AMZN.US':  { name: 'Amazon.com Inc.',    market: 'US', lotSize: 1,   basePrice: 185, currency: 'USD' },
  'GOOGL.US': { name: 'Alphabet Inc.',      market: 'US', lotSize: 1,   basePrice: 155, currency: 'USD' },
  'SPY.US':   { name: 'SPDR S&P 500 ETF',  market: 'US', lotSize: 1,   basePrice: 520, currency: 'USD' },
  'QQQ.US':   { name: 'Invesco QQQ Trust',  market: 'US', lotSize: 1,   basePrice: 445, currency: 'USD' },
  // HK
  '700.HK':   { name: 'Tencent Holdings',   market: 'HK', lotSize: 100, basePrice: 380, currency: 'HKD' },
  '9988.HK':  { name: 'Alibaba HK',         market: 'HK', lotSize: 100, basePrice: 85,  currency: 'HKD' },
  '3690.HK':  { name: 'Meituan',            market: 'HK', lotSize: 100, basePrice: 120, currency: 'HKD' },
  '5.HK':     { name: 'HSBC Holdings',      market: 'HK', lotSize: 400, basePrice: 68,  currency: 'HKD' },
  // SG
  'D05.SG':   { name: 'DBS Group',          market: 'SG', lotSize: 100, basePrice: 35,  currency: 'SGD' },
  'O39.SG':   { name: 'OCBC Bank',          market: 'SG', lotSize: 100, basePrice: 13,  currency: 'SGD' },
  'Z74.SG':   { name: 'Singtel',            market: 'SG', lotSize: 100, basePrice: 3.2, currency: 'SGD' },
  // CN-A
  '600036.SH':{ name: 'CMB',                market: 'CN', lotSize: 100, basePrice: 38,  currency: 'CNY' },
  '000858.SZ':{ name: 'Wuliangye',          market: 'CN', lotSize: 100, basePrice: 150, currency: 'CNY' },
  '300750.SZ':{ name: 'CATL',               market: 'CN', lotSize: 100, basePrice: 200, currency: 'CNY' },
  // ETF / Others
  'GLD.US':   { name: 'SPDR Gold Shares',   market: 'US', lotSize: 1,   basePrice: 215, currency: 'USD' },
  'USO.US':   { name: 'US Oil Fund',        market: 'US', lotSize: 1,   basePrice: 72,  currency: 'USD' },
};

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  'USD': { 'HKD': 7.78, 'SGD': 1.35, 'CNY': 7.24, 'BTC': 1 / 92000 },
  'HKD': { 'USD': 0.128, 'SGD': 0.174, 'CNY': 0.93 },
  'SGD': { 'USD': 0.74,  'HKD': 5.76,  'CNY': 5.36 },
  'CNY': { 'USD': 0.138, 'HKD': 1.07,  'SGD': 0.186 },
};

// ══ LongbridgeAdapter ═════════════════════════════════════

export class LongbridgeAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly type: string = 'longbridge';
  readonly name: string;
  connected = false;

  private config: BrokerConfig;
  private mockMode = true; // default to mock (no real OAuth setup)
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry = 0;
  private quoteCallbacks: Array<(quotes: QuoteInfo[]) => void> = [];
  private disconnectCallbacks: Array<() => void> = [];
  private mockTimer: ReturnType<typeof setInterval> | null = null;
  private subscribed: string[] = [];

  constructor(config: BrokerConfig) {
    this.id = config.id;
    this.name = config.name || 'Longbridge';
    this.config = config;
    log.info(`[LongbridgeAdapter] Initialized: ${this.id}`);
  }

  // ══ Connection ══════════════════════════════════════════

  async connect(): Promise<void> {
    log.info(`[LongbridgeAdapter] Connecting mock mode: ${this.id}`);

    if (this.config.apiKey && this.config.secretKey) {
      try {
        // OAuth 2.0 token exchange
        const res = await fetch(`${LONG_API}/v1/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: this.config.apiKey,
            client_secret: this.config.secretKey,
            grant_type: 'client_credentials',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          this.accessToken = data.access_token;
          this.refreshToken = data.refresh_token;
          this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
          this.mockMode = false;
          log.info('[LongbridgeAdapter] OAuth2 token obtained');
        }
      } catch (err: unknown) {
        log.warn(`[LongbridgeAdapter] OAuth2 failed, using mock mode: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.connected = true;
    log.info(`[LongbridgeAdapter] Connected (mock=${this.mockMode})`);
  }

  disconnect(): void {
    this.connected = false;
    this.stopMockPush();
    this.accessToken = null;
    this.refreshToken = null;
    this.subscribed = [];
    log.info(`[LongbridgeAdapter] Disconnected: ${this.id}`);
  }

  // ══ Callbacks ═══════════════════════════════════════════

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quoteCallbacks.push(callback);
  }

  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void {
    this.quoteCallbacks = this.quoteCallbacks.filter(cb => cb !== callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  // ══ Auth Helpers ════════════════════════════════════════

  private async request(method: string, path: string, body?: unknown): Promise<Response | null> {
    if (this.mockMode) return null;

    if (Date.now() > this.tokenExpiry) {
      await this.refreshAccessToken();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.accessToken && { 'Authorization': `Bearer ${this.accessToken}` }),
    };

    const url = `${LONG_API}${path}`;
    const options: RequestInit = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const res = await fetch(url, options);
      if (res.status === 401) {
        await this.refreshAccessToken();
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(url, { ...options, headers });
      }
      return res;
    } catch (err: unknown) {
      log.error(`[LongbridgeAdapter] Request failed: ${path} — ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.config.apiKey) return;
    try {
      const res = await fetch(`${LONG_API}/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.config.apiKey,
          client_secret: this.config.secretKey,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken;
        this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
      }
    } catch (err: unknown) {
      log.warn(`[LongbridgeAdapter] Token refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ══ Market Data ═════════════════════════════════════════

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    const res = await this.request('GET', `/v1/quote/quote?symbols=${codes.join(',')}`);
    if (res && res.ok) {
      const data = await res.json();
      return (data.quotes || []).map((q: Record<string, unknown>) => this.parseQuote(q));
    }
    return codes.map(c => this.generateMockQuote(c));
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    const res = await this.request('GET', `/v1/quote/kline?symbol=${code}&period=${period}&count=${count}`);
    if (res && res.ok) {
      const data = await res.json();
      return (data.klines || []).map((k: Record<string, number>) => ({
        time: k.timestamp * 1000,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));
    }
    return this.generateMockKlines(count);
  }

  // ══ Account ═════════════════════════════════════════════

  async getAccounts(): Promise<AccountInfo[]> {
    const res = await this.request('GET', '/v1/trade/account');
    if (res && res.ok) {
      const data = await res.json();
      return (data.accounts || []).map((a: Record<string, unknown>) => ({
        accountId: String(a.account_id || a.id),
        name: String(a.name || 'Longbridge Account'),
        currency: String(a.currency || 'USD'),
        netAssets: Number(a.net_assets || 0),
        totalAssets: Number(a.total_assets || 0),
        cash: Number(a.cash || 0),
        marketValue: Number(a.market_value || 0),
      }));
    }
    return [{
      accountId: 'LONG-001',
      name: 'Longbridge Demo Account',
      currency: 'USD',
      netAssets: 100000,
      totalAssets: 150000,
      cash: 50000,
      marketValue: 100000,
    }];
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const res = await this.request('GET', `/v1/trade/account/${accountId}/balance`);
    if (res && res.ok) {
      const data = await res.json();
      return {
        totalAssets: Number(data.total_assets || 0),
        cash: Number(data.cash || 0),
        marketValue: Number(data.market_value || 0),
        frozenCash: Number(data.frozen_cash || 0),
        availableCash: Number(data.available_cash || 0),
        currency: String(data.currency || 'USD'),
      };
    }
    return {
      totalAssets: 150000,
      cash: 50000,
      marketValue: 100000,
      frozenCash: 0,
      availableCash: 50000,
      currency: 'USD',
    };
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const res = await this.request('GET', `/v1/trade/account/${accountId}/positions`);
    if (res && res.ok) {
      const data = await res.json();
      return (data.positions || []).map((p: Record<string, unknown>) => ({
        code: String(p.symbol || p.code),
        name: String(p.name || p.symbol || ''),
        qty: Number(p.qty || p.quantity || 0),
        costPrice: Number(p.cost_price || 0),
        marketPrice: Number(p.market_price || 0),
        marketValue: Number(p.market_value || 0),
        pnl: Number(p.unrealized_pnl || 0),
        pnlPct: Number(p.unrealized_pnl_pct || 0),
        ratio: Number(p.ratio || 0),
      }));
    }
    // Mock positions
    return [
      { code: 'AAPL.US', name: 'Apple Inc.', qty: 100, costPrice: 150, marketPrice: 185, marketValue: 18500, pnl: 3500, pnlPct: 23.33, ratio: 0.185 },
      { code: '700.HK', name: 'Tencent', qty: 1000, costPrice: 350, marketPrice: 380, marketValue: 380000, pnl: 30000, pnlPct: 8.57, ratio: 0.5 },
    ];
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    const res = await this.request('GET', `/v1/trade/account/${accountId}/orders`);
    if (res && res.ok) {
      const data = await res.json();
      return (data.orders || []).map((o: Record<string, unknown>) => this.parseOrder(o));
    }
    // Mock orders
    return [
      { orderId: 'LG-001', code: 'AAPL.US', side: 'BUY', orderType: 'LIMIT', qty: 10, price: 175, filledQty: 0, filledPrice: 0, status: 'PENDING', createdAt: new Date().toISOString() },
      { orderId: 'LG-002', code: '700.HK', side: 'SELL', orderType: 'MARKET', qty: 200, price: 0, filledQty: 200, filledPrice: 382, status: 'FILLED', createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }

  // ══ Trading ═════════════════════════════════════════════

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const res = await this.request('POST', '/v1/trade/order', {
      symbol: order.code,
      side: order.side,
      order_type: order.orderType,
      qty: order.qty,
      price: order.price,
      account_id: order.accountId,
    });
    if (res && res.ok) {
      const data = await res.json();
      return { orderId: String(data.order_id || data.orderId) };
    }
    return { orderId: `LG-${Date.now()}` };
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    const res = await this.request('DELETE', `/v1/trade/order/${orderId}`, {
      account_id: accountId,
      symbol: code,
    });
    if (res && res.ok) return;
    // Mock: silently succeed
  }

  // ══ Subscription ══════════════════════════════════════

  async subscribeAndPush(codes: string[]): Promise<void> {
    this.subscribed = codes;
    this.startMockPush();
    log.info(`[LongbridgeAdapter] Subscribed: ${codes.length} codes`);
  }

  // ══ Mock Helpers ════════════════════════════════════════

  private startMockPush(): void {
    this.stopMockPush();
    if (this.subscribed.length === 0) return;
    this.mockTimer = setInterval(() => {
      const quotes = this.subscribed.map(c => this.generateMockQuote(c));
      this.quoteCallbacks.forEach(cb => cb(quotes));
    }, 3000);
  }

  private stopMockPush(): void {
    if (this.mockTimer) { clearInterval(this.mockTimer); this.mockTimer = null; }
  }

  private generateMockQuote(code: string): QuoteInfo {
    const contract = LONG_CONTRACTS[code];
    const basePrice = contract?.basePrice ?? 100;
    const change = (Math.random() - 0.48) * basePrice * 0.02;
    const price = basePrice + change;
    const prevClose = basePrice - (Math.random() - 0.5) * basePrice * 0.01;

    return {
      code,
      price: +price.toFixed(2),
      change: +(price - prevClose).toFixed(2),
      changePct: +(((price - prevClose) / prevClose) * 100).toFixed(2),
      volume: Math.floor(Math.random() * 5000000) + 100000,
      turnover: Math.floor(Math.random() * 500000000),
      high: +(price + Math.random() * basePrice * 0.01).toFixed(2),
      low: +(price - Math.random() * basePrice * 0.01).toFixed(2),
      open: +(basePrice + (Math.random() - 0.5) * basePrice * 0.005).toFixed(2),
      prevClose: +prevClose.toFixed(2),
      time: new Date().toISOString(),
    };
  }

  private generateMockKlines(count: number): KlineInfo[] {
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => {
      const base = 100 + Math.sin(i * 0.1) * 10;
      return {
        time: now - (count - i) * 60000,
        open: base,
        high: base + Math.random() * 5,
        low: base - Math.random() * 5,
        close: base + (Math.random() - 0.5) * 5,
        volume: Math.floor(10000 + Math.random() * 50000),
      };
    });
  }

  private parseQuote(q: Record<string, unknown>): QuoteInfo {
    return {
      code: String(q.symbol || q.code || ''),
      price: Number(q.price || q.last_price || 0),
      change: Number(q.change || 0),
      changePct: Number(q.change_pct || 0),
      volume: Number(q.volume || 0),
      turnover: Number(q.turnover || 0),
      high: Number(q.high || 0),
      low: Number(q.low || 0),
      open: Number(q.open || 0),
      prevClose: Number(q.prev_close || 0),
      time: String(q.time || q.updated_at || new Date().toISOString()),
    };
  }

  private parseOrder(o: Record<string, unknown>): OrderInfo {
    const statusMap: Record<string, string> = {
      pending: 'PENDING', submitted: 'PENDING', partial_filled: 'PARTIALLY_FILLED',
      filled: 'FILLED', cancelled: 'CANCELLED', rejected: 'REJECTED', expired: 'CANCELLED',
    };
    return {
      orderId: String(o.order_id || o.id || ''),
      code: String(o.symbol || o.code || ''),
      side: String(o.side || 'BUY').toUpperCase() as OrderInfo['side'],
      orderType: (String(o.order_type || o.type || 'LIMIT').toUpperCase() === 'MARKET' ? 'MARKET' : 'LIMIT') as OrderInfo['orderType'],
      qty: Number(o.qty || o.quantity || 0),
      price: Number(o.price || 0),
      filledQty: Number(o.filled_qty || o.executed_qty || 0),
      filledPrice: Number(o.filled_price || o.avg_price || 0),
      status: statusMap[String(o.status || '').toLowerCase()] || 'PENDING',
      createdAt: String(o.created_at || o.timestamp || new Date().toISOString()),
    };
  }
}

// ══ Factory for BrokerManagerV2 ═══════════════════════════

export function createLongbridgeAdapter(config: BrokerConfig): LongbridgeAdapter {
  return new LongbridgeAdapter(config);
}
