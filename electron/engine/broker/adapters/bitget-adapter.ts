/**
 * Bitget Adapter — Bitget现货适配器
 * 实现 IBrokerAdapter 统一接口
 *
 * API文档: https://bitgetlimited.github.io/apidoc/en/mix/
 * 签名: HMAC-SHA256(timestamp + method + path + query + body)
 */

import * as crypto from 'crypto';
import WebSocket from 'ws';
import type {
  IBrokerAdapter, BrokerCredentials, Quote, Kline, OrderRequest, OrderResult,
  Position, Account, Trade, DataCallback, MarketDataEvent, Market,
} from '../types';

const REST_BASE = 'https://api.bitget.com';
const WS_PUBLIC = 'wss://ws.bitget.com/v2/ws/public';

export class BitgetAdapter implements IBrokerAdapter {
  readonly name = 'Bitget';
  readonly markets: Market[] = ['CRYPTO'];
  readonly supportsRealTime = true;

  private creds?: BrokerCredentials;
  private ws: WebSocket | null = null;
  private wsListeners = new Map<string, Set<DataCallback>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  async connect(credentials: BrokerCredentials): Promise<void> {
    this.creds = credentials;
    const res = await this.request('GET', '/api/v2/public/time');
    if (!res.ok) throw new Error(`Bitget connection failed: ${res.status}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.wsListeners.clear();
  }

  isConnected(): boolean { return this.connected; }

  private sign(timestamp: string, method: string, path: string, query: string, body: string): string {
    if (!this.creds?.apiSecret) throw new Error('API secret required');
    const prehash = timestamp + method + path + (query || '') + (body || '');
    return crypto.createHmac('sha256', this.creds.apiSecret).update(prehash).digest('base64');
  }

  async getQuote(symbol: string): Promise<Quote> {
    const res = await this.request('GET', `/api/v2/spot/market/tickers?symbol=${symbol}`);
    const d = (await res.json()).data[0];
    return {
      symbol: d.symbol,
      bid: parseFloat(d.buyOne),
      ask: parseFloat(d.sellOne),
      last: parseFloat(d.last),
      volume: parseFloat(d.usdtVolume),
      change: parseFloat(d.change),
      changePercent: parseFloat(d.changeUtc8) * 100,
      timestamp: parseInt(d.ts),
    };
  }

  async getKlines(symbol: string, interval: string, limit = 200): Promise<Kline[]> {
    const res = await this.request('GET', `/api/v2/spot/market/candles?symbol=${symbol}&granularity=${interval}&limit=${limit}`);
    const data = (await res.json()).data;
    if (!data || data.length === 0) return [];
    return data.reverse().map((c: string[]) => ({
      openTime: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
      closeTime: parseInt(c[0]),
    }));
  }

  async subscribeMarketData(symbols: string[], callback: DataCallback): Promise<void> {
    if (!this.ws) {
      this.ws = new WebSocket(WS_PUBLIC);
      this.ws.on('open', () => {
        symbols.forEach(s => {
          this.ws!.send(JSON.stringify({ op: 'subscribe', args: [{ instType: 'SP', channel: 'ticker', instId: s }] }));
        });
      });
      this.ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'snapshot' || msg.action === 'update') {
          const sym = msg.arg.instId;
          const set = this.wsListeners.get(sym);
          if (set) {
            const evt: MarketDataEvent = { type: 'QUOTE', symbol: sym, data: msg.data[0], timestamp: parseInt(msg.ts) };
            set.forEach(cb => cb(evt));
          }
        }
      });
      this.pingTimer = setInterval(() => this.ws?.send('ping'), 25000);
    }
    for (const sym of symbols) {
      const set = this.wsListeners.get(sym) || new Set();
      set.add(callback);
      this.wsListeners.set(sym, set);
    }
  }

  async unsubscribeMarketData(symbols: string[]): Promise<void> {
    for (const sym of symbols) this.wsListeners.delete(sym);
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const body = JSON.stringify({
      symbol: order.symbol,
      side: order.side.toLowerCase(),
      orderType: order.type === 'MARKET' ? 'market' : 'limit',
      force: 'gtc',
      size: String(order.quantity),
      ...(order.price && { price: String(order.price) }),
    });
    const res = await this.signedRequest('POST', '/api/v2/spot/trade/place-order', '', body);
    const d = (await res.json()).data;
    return this.mapOrder(d);
  }

  async cancelOrder(orderId: string): Promise<void> {
    const body = JSON.stringify({ orderId });
    await this.signedRequest('POST', '/api/v2/spot/trade/cancel-order', '', body);
  }

  async modifyOrder(_orderId: string, _updates: Partial<OrderRequest>): Promise<OrderResult> {
    throw new Error('Bitget modify: cancel + replace (not yet auto)');
  }

  async getOrder(orderId: string): Promise<OrderResult | null> {
    const body = JSON.stringify({ orderId });
    const res = await this.signedRequest('POST', '/api/v2/spot/trade/orderInfo', '', body);
    const d = (await res.json()).data[0];
    return d ? this.mapOrder(d) : null;
  }

  async getAccount(): Promise<Account> {
    const res = await this.signedRequest('GET', '/api/v2/spot/account/assets', '', '');
    const d = (await res.json()).data;
    const usdt = d.find((b: { coinName: string }) => b.coinName === 'USDT');
    return {
      accountId: 'bitget-spot',
      currency: 'USDT',
      cash: parseFloat(usdt?.available || '0'),
      marketValue: parseFloat(usdt?.available || '0') - parseFloat(usdt?.frozen || '0'),
      totalEquity: parseFloat(usdt?.available || '0'),
      buyingPower: parseFloat(usdt?.available || '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.signedRequest('GET', '/api/v2/spot/account/assets', '', '');
    const list = (await res.json()).data;
    return list.filter((b: { available: string }) => parseFloat(b.available) > 0).map((b: { coinName: string; available: string }) => ({
      symbol: b.coinName,
      quantity: parseFloat(b.available),
      avgCost: 0,
      marketPrice: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
    }));
  }

  async getOrders(_status?: string): Promise<OrderResult[]> {
    const res = await this.signedRequest('GET', '/api/v2/spot/trade/unfilled-orders', '', '');
    const list = (await res.json()).data || [];
    return list.map((o: never) => this.mapOrder(o));
  }

  async getTrades(_startTime?: Date, _endTime?: Date): Promise<Trade[]> {
    const res = await this.signedRequest('GET', '/api/v2/spot/trade/fills', '', '');
    const list = (await res.json()).data || [];
    return list.map((t: { tradeId: string; orderId: string; symbol: string; side: string; size: string; price: string; fee: string; ts: string }) => ({
      tradeId: t.tradeId,
      orderId: t.orderId,
      symbol: t.symbol,
      side: t.side.toUpperCase() as 'BUY' | 'SELL',
      quantity: parseFloat(t.size),
      price: parseFloat(t.price),
      fee: parseFloat(t.fee),
      timestamp: parseInt(t.ts),
    }));
  }

  private async request(method: string, path: string): Promise<Response> {
    return fetch(`${REST_BASE}${path}`, { method });
  }

  private async signedRequest(method: string, path: string, query: string, body: string): Promise<Response> {
    if (!this.creds?.apiKey) throw new Error('Bitget credentials required');
    const timestamp = String(Date.now());
    const signature = this.sign(timestamp, method, path, query, body);
    const url = `${REST_BASE}${path}${query ? '?' + query : ''}`;
    return fetch(url, {
      method,
      headers: {
        'ACCESS-KEY': this.creds.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.creds.apiSecret!.substring(0, 16),
        'Content-Type': 'application/json',
      },
      body: body || undefined,
    });
  }

  private mapOrder(d: { orderId: string; clientOid?: string; status: string; symbol: string; side: string; orderType: string; size: string; fillSize: string; priceAvg: string; cTime: string }): OrderResult {
    const sMap: Record<string, string> = { init: 'PENDING', new: 'PENDING', partially_filled: 'PARTIAL', full_filled: 'FILLED', filled: 'FILLED', canceled: 'CANCELLED', cancelled: 'CANCELLED' };
    return {
      orderId: d.orderId,
      clientOrderId: d.clientOid,
      status: (sMap[d.status] || 'PENDING') as OrderResult['status'],
      symbol: d.symbol,
      side: d.side.toUpperCase() as OrderResult['side'],
      type: (d.orderType === 'market' ? 'MARKET' : 'LIMIT') as OrderResult['type'],
      quantity: parseFloat(d.size),
      filledQuantity: parseFloat(d.fillSize),
      avgPrice: parseFloat(d.priceAvg),
      timestamp: parseInt(d.cTime),
    };
  }
}
