/**
 * Binance Adapter — 币安现货/合约适配器
 * 实现 IBrokerAdapter 统一接口
 *
 * API 文档: https://developers.binance.com/docs/binance-spot-api-docs
 */
import * as crypto from 'crypto';
import WebSocket from 'ws';
import type {
  IBrokerAdapter, BrokerCredentials, Quote, Kline, OrderRequest, OrderResult,
  Position, Account, Trade, DataCallback, MarketDataEvent, Market,
} from '../types';

const SPOT_BASE = 'https://api.binance.com';
const SPOT_WS = 'wss://stream.binance.com:9443/ws';
const FUTURES_BASE = 'https://fapi.binance.com';
const FUTURES_WS = 'wss://fstream.binance.com/ws';

interface BinanceCredentials extends BrokerCredentials {
  isFutures?: boolean;
}

export class BinanceAdapter implements IBrokerAdapter {
  readonly name = 'Binance';
  readonly markets: Market[] = ['CRYPTO'];
  readonly supportsRealTime = true;

  private creds?: BinanceCredentials;
  private ws: WebSocket | null = null;
  private wsListeners = new Map<string, Set<DataCallback>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private listenKey: string | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  // ── Connection ──

  async connect(credentials: BinanceCredentials): Promise<void> {
    this.creds = credentials;
    const base = this.baseUrl;

    // Test connectivity
    const res = await this.request('GET', '/api/v3/ping');
    if (!res.ok) throw new Error(`Binance connection failed: ${res.status}`);

    this.connected = true;

    // Start user data stream if credentials provided
    if (this.creds.apiKey) {
      await this.startUserDataStream();
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    this.wsListeners.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Market Data ──

  async getQuote(symbol: string): Promise<Quote> {
    const res = await this.request('GET', '/api/v3/ticker/24hr', { symbol: symbol.toUpperCase() });
    const d = await res.json();
    return {
      symbol: d.symbol,
      bid: parseFloat(d.bidPrice),
      ask: parseFloat(d.askPrice),
      last: parseFloat(d.lastPrice),
      volume: parseFloat(d.volume),
      change: parseFloat(d.priceChange),
      changePercent: parseFloat(d.priceChangePercent),
      timestamp: d.closeTime,
    };
  }

  async getKlines(symbol: string, interval: string, limit = 500): Promise<Kline[]> {
    const res = await this.request('GET', '/api/v3/klines', {
      symbol: symbol.toUpperCase(),
      interval,
      limit: String(limit),
    });
    const data = await res.json();
    return data.map((c: unknown[]) => ({
      openTime: c[0] as number,
      open: parseFloat(c[1] as string),
      high: parseFloat(c[2] as string),
      low: parseFloat(c[3] as string),
      close: parseFloat(c[4] as string),
      volume: parseFloat(c[5] as string),
      closeTime: c[6] as number,
    }));
  }

  async subscribeMarketData(symbols: string[], callback: DataCallback): Promise<void> {
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = `${this.wsBase}/stream?streams=${streams}`;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.ws = new WebSocket(wsUrl);
      this.ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.stream) {
          const sym = msg.stream.split('@')[0].toUpperCase();
          const evt: MarketDataEvent = {
            type: 'QUOTE',
            symbol: sym,
            data: msg.data,
            timestamp: Date.now(),
          };
          this.wsListeners.get(sym)?.forEach(cb => cb(evt));
        }
      });
      this.ws.on('error', (err) => console.error('[Binance WS]', err));
    }

    for (const sym of symbols) {
      const set = this.wsListeners.get(sym) || new Set();
      set.add(callback);
      this.wsListeners.set(sym, set);
    }

    // Keepalive ping
    if (!this.pingTimer) {
      this.pingTimer = setInterval(() => {
        this.ws?.send(JSON.stringify({ method: 'PING' }));
      }, 3 * 60 * 1000);
    }
  }

  async unsubscribeMarketData(symbols: string[]): Promise<void> {
    for (const sym of symbols) {
      this.wsListeners.delete(sym);
    }
    if (this.wsListeners.size === 0 && this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Trading ──

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const params: Record<string, string> = {
      symbol: order.symbol.toUpperCase(),
      side: order.side,
      type: order.type,
      quantity: String(order.quantity),
      timestamp: String(Date.now()),
    };
    if (order.price) params.price = String(order.price);
    if (order.timeInForce) params.timeInForce = order.timeInForce;
    if (order.clientOrderId) params.newClientOrderId = order.clientOrderId;

    const res = await this.signedRequest('POST', '/api/v3/order', params);
    const d = await res.json();
    return this.mapOrder(d);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.signedRequest('DELETE', '/api/v3/order', {
      symbol: '', // required but unknown here; caller should use cancelBySymbol
      orderId,
      timestamp: String(Date.now()),
    });
  }

  async modifyOrder(orderId: string, updates: Partial<OrderRequest>): Promise<OrderResult> {
    // Binance doesn't support modify; cancel + replace
    await this.cancelOrder(orderId);
    if (!updates.symbol || !updates.side || !updates.type || !updates.quantity) {
      throw new Error('Binance modify requires full order fields (cancel+replace)');
    }
    return this.placeOrder(updates as OrderRequest);
  }

  async getOrder(orderId: string): Promise<OrderResult | null> {
    // Binance requires symbol to query order; simplified here
    throw new Error('Binance getOrder requires symbol — use getOrders()');
  }

  // ── Account ──

  async getAccount(): Promise<Account> {
    const res = await this.signedRequest('GET', '/api/v3/account', {
      timestamp: String(Date.now()),
    });
    const d = await res.json();
    const usdt = d.balances.find((b: { asset: string }) => b.asset === 'USDT');
    return {
      accountId: d.accountType,
      currency: 'USDT',
      cash: parseFloat(usdt?.free || '0'),
      marketValue: parseFloat(usdt?.free || '0'), // simplified
      totalEquity: parseFloat(usdt?.free || '0') + parseFloat(usdt?.locked || '0'),
      buyingPower: parseFloat(usdt?.free || '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.signedRequest('GET', '/api/v3/account', {
      timestamp: String(Date.now()),
    });
    const d = await res.json();
    return d.balances
      .filter((b: { free: string; locked: string }) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: { asset: string; free: string; locked: string }) => ({
        symbol: b.asset,
        quantity: parseFloat(b.free) + parseFloat(b.locked),
        avgCost: 0, // Binance doesn't provide avg cost in this endpoint
        marketPrice: 0,
        marketValue: 0,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
      }));
  }

  async getOrders(_status?: string): Promise<OrderResult[]> {
    const res = await this.signedRequest('GET', '/api/v3/openOrders', {
      timestamp: String(Date.now()),
    });
    const d = await res.json();
    return Array.isArray(d) ? d.map((o: unknown) => this.mapOrder(o as never)) : [];
  }

  async getTrades(startTime?: Date, endTime?: Date): Promise<Trade[]> {
    const params: Record<string, string> = { timestamp: String(Date.now()) };
    if (startTime) params.startTime = String(startTime.getTime());
    if (endTime) params.endTime = String(endTime.getTime());
    const res = await this.signedRequest('GET', '/api/v3/myTrades', params);
    const d = await res.json();
    return d.map((t: { symbol: string; id: string; orderId: string; isBuyer: boolean; qty: string; price: string; commission: string; time: number }) => ({
      tradeId: String(t.id),
      orderId: String(t.orderId),
      symbol: t.symbol,
      side: t.isBuyer ? 'BUY' : 'SELL',
      quantity: parseFloat(t.qty),
      price: parseFloat(t.price),
      fee: parseFloat(t.commission),
      timestamp: t.time,
    }));
  }

  // ── Helpers ──

  private get baseUrl(): string {
    return this.creds?.isFutures ? FUTURES_BASE : SPOT_BASE;
  }

  private get wsBase(): string {
    return this.creds?.isFutures ? FUTURES_WS : SPOT_WS;
  }

  private async request(method: string, path: string, params?: Record<string, string>): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const headers: Record<string, string> = {};
    if (this.creds?.apiKey) headers['X-MBX-APIKEY'] = this.creds.apiKey;
    return fetch(url.toString(), { method, headers });
  }

  private async signedRequest(method: string, path: string, params: Record<string, string>): Promise<Response> {
    if (!this.creds?.apiSecret) throw new Error('API secret required');
    params.timestamp = String(Date.now());
    const query = new URLSearchParams(params).toString();
    const signature = crypto.createHmac('sha256', this.creds.apiSecret).update(query).digest('hex');
    const url = new URL(path, this.baseUrl);
    url.search = `${query}&signature=${signature}`;

    return fetch(url.toString(), {
      method,
      headers: { 'X-MBX-APIKEY': this.creds.apiKey },
    });
  }

  private async startUserDataStream(): Promise<void> {
    const res = await this.signedRequest('POST', '/api/v3/userDataStream', {});
    const d = await res.json();
    this.listenKey = d.listenKey;

    // Keepalive every 30min
    this.keepAliveTimer = setInterval(async () => {
      if (this.listenKey) {
        await this.request('PUT', '/api/v3/userDataStream', { listenKey: this.listenKey });
      }
    }, 30 * 60 * 1000);
  }

  private mapOrder(d: { orderId: number; clientOrderId?: string; status: string; symbol: string; side: string; type: string; origQty: string; executedQty: string; price: string; time?: number; transactTime?: number }): OrderResult {
    const statusMap: Record<string, string> = {
      NEW: 'PENDING', PARTIALLY_FILLED: 'PARTIAL', FILLED: 'FILLED',
      CANCELED: 'CANCELLED', REJECTED: 'REJECTED', EXPIRED: 'CANCELLED',
    };
    return {
      orderId: String(d.orderId),
      clientOrderId: d.clientOrderId,
      status: (statusMap[d.status] || 'PENDING') as OrderResult['status'],
      symbol: d.symbol,
      side: d.side as OrderResult['side'],
      type: d.type as OrderResult['type'],
      quantity: parseFloat(d.origQty),
      filledQuantity: parseFloat(d.executedQty),
      avgPrice: parseFloat(d.price),
      timestamp: d.transactTime || d.time || Date.now(),
    };
  }
}
