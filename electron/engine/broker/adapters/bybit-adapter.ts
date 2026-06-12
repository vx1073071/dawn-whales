/**
 * Bybit Adapter — Bybit现货/合约适配器
 * 实现 IBrokerAdapter 统一接口
 *
 * API文档: https://bybit-exchange.github.io/docs/v5/intro
 * 签名: HMAC-SHA256(timestamp + api_key + recv_window + query_string)
 */

import * as crypto from 'crypto';
import WebSocket from 'ws';
import type {
  IBrokerAdapter, BrokerCredentials, Quote, Kline, OrderRequest, OrderResult,
  Position, Account, Trade, DataCallback, MarketDataEvent, Market,
} from '../types';

const REST_BASE = 'https://api.bybit.com';
const WS_PUBLIC = 'wss://stream.bybit.com/v5/public/spot';

export class BybitAdapter implements IBrokerAdapter {
  readonly name = 'Bybit';
  readonly markets: Market[] = ['CRYPTO'];
  readonly supportsRealTime = true;

  private creds?: BrokerCredentials;
  private ws: WebSocket | null = null;
  private wsListeners = new Map<string, Set<DataCallback>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  async connect(credentials: BrokerCredentials): Promise<void> {
    this.creds = credentials;
    const res = await this.request('GET', '/v5/market/time');
    if (!res.ok) throw new Error(`Bybit connection failed: ${res.status}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.wsListeners.clear();
  }

  isConnected(): boolean { return this.connected; }

  private sign(params: Record<string, string>): string {
    if (!this.creds?.apiSecret) throw new Error('API secret required');
    params.timestamp = String(Date.now());
    params.recv_window = '5000';
    const query = new URLSearchParams(params).toString();
    return crypto.createHmac('sha256', this.creds.apiSecret).update(query).digest('hex');
  }

  async getQuote(symbol: string): Promise<Quote> {
    const res = await this.request('GET', `/v5/market/tickers?category=spot&symbol=${symbol}`);
    const d = (await res.json()).result.list[0];
    return {
      symbol: d.symbol,
      bid: parseFloat(d.bid1Price),
      ask: parseFloat(d.ask1Price),
      last: parseFloat(d.lastPrice),
      volume: parseFloat(d.volume24h),
      change: parseFloat(d.price24hPcnt) * parseFloat(d.lastPrice) / 100,
      changePercent: parseFloat(d.price24hPcnt) * 100,
      timestamp: Date.now(),
    };
  }

  async getKlines(symbol: string, interval: string, limit = 200): Promise<Kline[]> {
    const res = await this.request('GET', `/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`);
    const list = (await res.json()).result.list;
    return list.reverse().map((c: string[]) => ({
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
          this.ws!.send(JSON.stringify({ req_id: s, op: 'subscribe', args: [`tickers.${s}`] }));
        });
      });
      this.ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.topic && msg.topic.startsWith('tickers.')) {
          const sym = msg.topic.replace('tickers.', '');
          const set = this.wsListeners.get(sym);
          if (set) {
            const evt: MarketDataEvent = { type: 'QUOTE', symbol: sym, data: msg.data, timestamp: Date.now() };
            set.forEach(cb => cb(evt));
          }
        }
      });
      this.pingTimer = setInterval(() => this.ws?.send(JSON.stringify({ op: 'ping' })), 20000);
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
    const params: Record<string, string> = {
      category: 'spot', symbol: order.symbol, side: order.side,
      orderType: order.type === 'MARKET' ? 'Market' : 'Limit',
      qty: String(order.quantity),
    };
    if (order.price) params.price = String(order.price);
    const res = await this.signedRequest('POST', '/v5/order/create', params);
    const d = (await res.json()).result;
    return this.mapOrder(d);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.signedRequest('POST', '/v5/order/cancel', { category: 'spot', orderId });
  }

  async modifyOrder(_orderId: string, _updates: Partial<OrderRequest>): Promise<OrderResult> {
    throw new Error('Bybit modify: use amend endpoint (not yet implemented)');
  }

  async getOrder(orderId: string): Promise<OrderResult | null> {
    const res = await this.signedRequest('GET', '/v5/order/realtime', { category: 'spot', orderId });
    const d = (await res.json()).result.list[0];
    return d ? this.mapOrder(d) : null;
  }

  async getAccount(): Promise<Account> {
    const res = await this.signedRequest('GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' });
    const d = (await res.json()).result.list[0];
    const usdt = d.coin.find((b: { coin: string }) => b.coin === 'USDT');
    if (!usdt) throw new Error('USDT balance not found');
    return {
      accountId: d.accountIMRate || 'bybit-account',
      currency: 'USDT',
      cash: parseFloat(usdt.availableToWithdraw || '0'),
      marketValue: parseFloat(usdt.usdValue || '0') - parseFloat(usdt.availableToWithdraw || '0'),
      totalEquity: parseFloat(usdt.usdValue || '0'),
      buyingPower: parseFloat(usdt.availableToWithdraw || '0'),
    };
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.signedRequest('GET', '/v5/position/list', { category: 'linear', settleCoin: 'USDT' });
    const list = (await res.json()).result.list;
    return list.map((p: { symbol: string; size: string; avgPrice: string; markPrice: string; positionValue: string; unrealisedPnl: string }) => ({
      symbol: p.symbol,
      quantity: parseFloat(p.size),
      avgCost: parseFloat(p.avgPrice),
      marketPrice: parseFloat(p.markPrice),
      marketValue: parseFloat(p.positionValue),
      unrealizedPnl: parseFloat(p.unrealisedPnl),
      unrealizedPnlPercent: parseFloat(p.avgPrice) > 0 ? (parseFloat(p.unrealisedPnl) / (parseFloat(p.size) * parseFloat(p.avgPrice))) * 100 : 0,
    }));
  }

  async getOrders(_status?: string): Promise<OrderResult[]> {
    const res = await this.signedRequest('GET', '/v5/order/realtime', { category: 'spot' });
    return ((await res.json()).result.list || []).map((o: never) => this.mapOrder(o));
  }

  async getTrades(_startTime?: Date, _endTime?: Date): Promise<Trade[]> {
    const res = await this.signedRequest('GET', '/v5/execution/list', { category: 'spot' });
    return ((await res.json()).result.list || []).map((t: { execId: string; orderId: string; symbol: string; side: string; execQty: string; execPrice: string; execFee: string; execTime: string }) => ({
      tradeId: t.execId,
      orderId: t.orderId,
      symbol: t.symbol,
      side: t.side.toUpperCase() as 'BUY' | 'SELL',
      quantity: parseFloat(t.execQty),
      price: parseFloat(t.execPrice),
      fee: parseFloat(t.execFee),
      timestamp: parseInt(t.execTime),
    }));
  }

  private async request(method: string, path: string): Promise<Response> {
    return fetch(`${REST_BASE}${path}`, { method });
  }

  private async signedRequest(method: string, path: string, params: Record<string, string>): Promise<Response> {
    if (!this.creds?.apiKey) throw new Error('Bybit credentials required');
    params.api_key = this.creds.apiKey;
    params.timestamp = String(Date.now());
    params.recv_window = '5000';
    const query = new URLSearchParams(params).toString();
    const signature = crypto.createHmac('sha256', this.creds.apiSecret!).update(query).digest('hex');
    if (method === 'GET') {
      return fetch(`${REST_BASE}${path}?${query}&sign=${signature}`);
    }
    return fetch(`${REST_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, sign: signature }),
    });
  }

  private mapOrder(d: { orderId: string; orderLinkId?: string; orderStatus: string; symbol: string; side: string; orderType: string; qty: string; cumExecQty: string; avgPrice: string; createdTime: string }): OrderResult {
    const sMap: Record<string, string> = { New: 'PENDING', PartiallyFilled: 'PARTIAL', Filled: 'FILLED', Cancelled: 'CANCELLED', Rejected: 'REJECTED' };
    return {
      orderId: d.orderId,
      clientOrderId: d.orderLinkId,
      status: (sMap[d.orderStatus] || 'PENDING') as OrderResult['status'],
      symbol: d.symbol,
      side: d.side.toUpperCase() as OrderResult['side'],
      type: (d.orderType === 'Market' ? 'MARKET' : 'LIMIT') as OrderResult['type'],
      quantity: parseFloat(d.qty),
      filledQuantity: parseFloat(d.cumExecQty),
      avgPrice: parseFloat(d.avgPrice),
      timestamp: parseInt(d.createdTime),
    };
  }
}
