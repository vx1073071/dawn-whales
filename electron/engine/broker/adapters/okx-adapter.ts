/**
 * OKX Adapter — OKX现货/合约适配器
 * 实现 IBrokerAdapter 统一接口
 *
 * API文档: https://www.okx.com/docs-v5/en/
 * 签名: HMAC-SHA256(timestamp + method + path + body)
 * 认证头: OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-TIMESTAMP, OK-ACCESS-PASSPHRASE
 */

import * as crypto from 'crypto';
import WebSocket from 'ws';
import type {
  IBrokerAdapter, BrokerCredentials, Quote, Kline, OrderRequest, OrderResult,
  Position, Account, Trade, DataCallback, MarketDataEvent, Market,
} from '../types';

const REST_BASE = 'https://www.okx.com';
const WS_PUBLIC = 'wss://ws.okx.com:8443/ws/v5/public';
const WS_PRIVATE = 'wss://ws.okx.com:8443/ws/v5/private';

interface OKXCredentials extends BrokerCredentials {
  passphrase: string;
}

export class OKXAdapter implements IBrokerAdapter {
  readonly name = 'OKX';
  readonly markets: Market[] = ['CRYPTO'];
  readonly supportsRealTime = true;

  private creds?: OKXCredentials;
  private ws: WebSocket | null = null;
  private wsListeners = new Map<string, Set<DataCallback>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  // ── Connection ──

  async connect(credentials: OKXCredentials): Promise<void> {
    this.creds = credentials;
    const res = await this.request('GET', '/api/v5/public/time');
    if (!res.ok) throw new Error(`OKX connection failed: ${res.status}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.wsListeners.clear();
  }

  isConnected(): boolean { return this.connected; }

  // ── OKX 签名 (timestamp + method + path + body) ──

  private sign(timestamp: string, method: string, path: string, body: string = ''): string {
    if (!this.creds?.apiSecret) throw new Error('API secret required');
    const prehash = timestamp + method + path + body;
    return crypto.createHmac('sha256', this.creds.apiSecret).update(prehash).digest('base64');
  }

  // ── Market Data ──

  async getQuote(symbol: string): Promise<Quote> {
    const instId = symbol.replace('/', '-').replace('_', '-');
    const res = await this.request('GET', `/api/v5/market/ticker?instId=${instId}`);
    const d = (await res.json()).data[0];
    return {
      symbol: d.instId,
      bid: parseFloat(d.bidPx),
      ask: parseFloat(d.askPx),
      last: parseFloat(d.last),
      volume: parseFloat(d.vol24h),
      change: parseFloat(d.high24h) - parseFloat(d.low24h),
      changePercent: parseFloat(d.sodUtc8) ? ((parseFloat(d.last) - parseFloat(d.sodUtc8)) / parseFloat(d.sodUtc8)) * 100 : 0,
      timestamp: parseInt(d.ts),
    };
  }

  async getKlines(symbol: string, interval: string, limit = 100): Promise<Kline[]> {
    const instId = symbol.replace('/', '-');
    const bar = interval === '1m' ? '1m' : interval === '5m' ? '5m' : interval === '1h' ? '1H' : '1D';
    const res = await this.request('GET', `/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`);
    const data = (await res.json()).data as string[][];
    if (!data || data.length === 0) return [];
    // OKX returns [ts, o, h, l, c, vol, ...] in reverse chronological order
    return data.reverse().map(c => ({
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
    const args = symbols.map(s => ({ channel: 'tickers', instId: s.replace('/', '-') }));
    if (!this.ws) {
      this.ws = new WebSocket(WS_PUBLIC);
      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({ op: 'subscribe', args }));
      });
      this.ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'subscribe') return;
        if (msg.data && Array.isArray(msg.data)) {
          msg.data.forEach((d: { instId: string }) => {
            const sym = d.instId.replace('-', '/');
            const set = this.wsListeners.get(sym);
            if (set) {
              const evt: MarketDataEvent = { type: 'QUOTE', symbol: sym, data: d, timestamp: Date.now() };
              set.forEach(cb => cb(evt));
            }
          });
        }
      });
      this.pingTimer = setInterval(() => this.ws?.send('ping'), 29000);
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

  // ── Trading ──

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const instId = order.symbol.replace('/', '-');
    const body = JSON.stringify({
      instId, tdMode: 'cash', side: order.side.toLowerCase(),
      ordType: order.type === 'MARKET' ? 'market' : 'limit',
      sz: String(order.quantity),
      ...(order.price && { px: String(order.price) }),
    });
    const res = await this.signedRequest('POST', '/api/v5/trade/order', body);
    const d = (await res.json()).data[0];
    return this.mapOrder(d);
  }

  async cancelOrder(orderId: string): Promise<void> {
    const body = JSON.stringify({ ordId: orderId });
    await this.signedRequest('POST', '/api/v5/trade/cancel-order', body);
  }

  async modifyOrder(_orderId: string, _updates: Partial<OrderRequest>): Promise<OrderResult> {
    throw new Error('OKX modify: use amend-order endpoint (not yet implemented)');
  }

  async getOrder(orderId: string): Promise<OrderResult | null> {
    const res = await this.signedRequest('GET', `/api/v5/trade/order?ordId=${orderId}`, '');
    const d = (await res.json()).data[0];
    return d ? this.mapOrder(d) : null;
  }

  // ── Account ──

  async getAccount(): Promise<Account> {
    const res = await this.signedRequest('GET', '/api/v5/account/balance', '');
    const d = (await res.json()).data[0];
    const usdt = d.details.find((b: { ccy: string }) => b.ccy === 'USDT');
    return {
      accountId: d.uid,
      currency: 'USDT',
      cash: parseFloat(usdt?.availBal || '0'),
      marketValue: parseFloat(usdt?.eq || '0') - parseFloat(usdt?.availBal || '0'),
      totalEquity: parseFloat(usdt?.eq || '0'),
      buyingPower: parseFloat(usdt?.availBal || '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.signedRequest('GET', '/api/v5/account/positions', '');
    const data = (await res.json()).data;
    return data.map((p: { instId: string; pos: string; avgPx: string; markPx: string; upl: string; uplRatio: string; notionalUsd: string }) => ({
      symbol: p.instId,
      quantity: parseFloat(p.pos),
      avgCost: parseFloat(p.avgPx),
      marketPrice: parseFloat(p.markPx),
      marketValue: parseFloat(p.notionalUsd),
      unrealizedPnl: parseFloat(p.upl),
      unrealizedPnlPercent: parseFloat(p.uplRatio) * 100,
    }));
  }

  async getOrders(_status?: string): Promise<OrderResult[]> {
    const res = await this.signedRequest('GET', '/api/v5/trade/orders-pending', '');
    return ((await res.json()).data || []).map((o: never) => this.mapOrder(o));
  }

  async getTrades(startTime?: Date, endTime?: Date): Promise<Trade[]> {
    const params = new URLSearchParams({ instType: 'SPOT' });
    if (startTime) params.set('begin', String(startTime.getTime()));
    if (endTime) params.set('end', String(endTime.getTime()));
    const res = await this.signedRequest('GET', `/api/v5/trade/fills?${params}`, '');
    return ((await res.json()).data || []).map((t: { tradeId: string; ordId: string; instId: string; side: string; sz: string; px: string; fee: string; ts: string }) => ({
      tradeId: t.tradeId,
      orderId: t.ordId,
      symbol: t.instId,
      side: t.side.toUpperCase() as 'BUY' | 'SELL',
      quantity: parseFloat(t.sz),
      price: parseFloat(t.px),
      fee: parseFloat(t.fee),
      timestamp: parseInt(t.ts),
    }));
  }

  // ── Helpers ──

  private async request(method: string, path: string): Promise<Response> {
    return fetch(`${REST_BASE}${path}`, { method });
  }

  private async signedRequest(method: string, path: string, body: string): Promise<Response> {
    if (!this.creds?.apiKey || !this.creds?.apiSecret || !this.creds?.passphrase) {
      throw new Error('OKX credentials required');
    }
    const timestamp = new Date().toISOString().replace(/[.:TZ-]/g, '').slice(0, 14);
    const sign = this.sign(timestamp, method, path, body);
    return fetch(`${REST_BASE}${path}`, {
      method,
      headers: {
        'OK-ACCESS-KEY': this.creds.apiKey,
        'OK-ACCESS-SIGN': sign,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': this.creds.passphrase,
        'Content-Type': 'application/json',
      },
      body: body || undefined,
    });
  }

  private mapOrder(d: { ordId: string; clOrdId?: string; state: string; instId: string; side: string; ordType: string; sz: string; accFillSz: string; avgPx: string; cTime?: string; uTime?: string }): OrderResult {
    const statusMap: Record<string, string> = {
      live: 'PENDING', partially_filled: 'PARTIAL', filled: 'FILLED',
      canceled: 'CANCELLED', cancelled: 'CANCELLED',
    };
    return {
      orderId: d.ordId,
      clientOrderId: d.clOrdId,
      status: (statusMap[d.state] || 'PENDING') as OrderResult['status'],
      symbol: d.instId,
      side: d.side.toUpperCase() as OrderResult['side'],
      type: (d.ordType === 'market' ? 'MARKET' : 'LIMIT') as OrderResult['type'],
      quantity: parseFloat(d.sz),
      filledQuantity: parseFloat(d.accFillSz),
      avgPrice: parseFloat(d.avgPx),
      timestamp: parseInt(d.cTime || d.uTime || '0'),
    };
  }
}
