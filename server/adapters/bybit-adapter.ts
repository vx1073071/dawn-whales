/**
 * QUANT MOO R131 J01 — Bybit Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for Bybit Spot V5.
 * REST: api.bybit.com (HMAC-SHA256 signing)
 * WS:   stream.bybit.com (WebSocket V5 public)
 * 
 * Differences from Binance:
 *  - Bybit uses timestamp + recv_window + 2-second time sensitive
 *  - Signature format: timestamp+apiKey+recvWindow+queryString
 *  - Account endpoint: /v5/account/wallet-balance
 *  - WS uses subscribe op (not stream path)
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

function bybitSign(params: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(params).digest('hex');
}

export class BybitAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private ws?: any;
  private reconnectTimer?: NodeJS.Timeout;
  private subscribedSymbols: string[] = [];

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
  }

  async connect(): Promise<void> {
    const hc = await this.healthCheck();
    if (!hc.ok) throw new Error('Bybit health check failed');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) { try { this.ws.close(); } catch {} }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/v5/market/time`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.bybitGet('/v5/account/wallet-balance', { accountType: 'UNIFIED' });
    const list = data?.result?.list?.[0];
    const coins = list?.coin || [];
    return {
      brokerId: this.brokerId, accountId: this.brokerId,
      totalEquity: parseFloat(list?.totalEquity || '0'),
      availableBalance: parseFloat(coins.find((c: any) => c.coin === 'USDT')?.availableToWithdraw || '0'),
      unrealizedPnl: parseFloat(list?.totalUnrealizedPnl || '0'),
      realizedPnl: 0, currency: 'USDT',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const data = await this.bybitGet('/v5/market/tickers', { symbol: sym.replace('/', '') });
        const t = data?.result?.list?.[0];
        if (t) results.push({
          brokerId: this.brokerId, symbol: t.symbol,
          price: parseFloat(t.lastPrice), change: parseFloat(t.price24hPcnt) * parseFloat(t.lastPrice) / 100,
          changePct: parseFloat(t.price24hPcnt), volume: parseFloat(t.volume24h),
          high24h: parseFloat(t.highPrice24h), low24h: parseFloat(t.lowPrice24h),
          timestamp: parseInt(t.time) || Date.now(),
        });
      } catch {}
    }
    return results;
  }

  async getDepth(symbol: string, limit = 50): Promise<CloudDepthSnapshot> {
    const data = await this.bybitGet('/v5/market/orderbook', { symbol: symbol.replace('/', ''), limit: limit.toString() });
    const ob = data?.result;
    return {
      brokerId: this.brokerId, symbol,
      bids: (ob?.b || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (ob?.a || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: parseInt(ob?.ts) || Date.now(),
    };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const params: any = {
      category: 'spot', symbol: req.symbol.replace('/', ''),
      side: req.side === 'BUY' ? 'Buy' : 'Sell',
      orderType: req.orderType === 'MARKET' ? 'Market' : 'Limit',
      qty: req.quantity.toString(),
    };
    if (params.orderType === 'Limit') params.price = req.price?.toString();
    const data = await this.bybitPost('/v5/order/create', params);
    const o = data?.result;
    return {
      brokerId: this.brokerId, orderId: o?.orderId || '',
      clientOrderId: o?.orderLinkId, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: parseFloat(o?.qty || '0'), price: parseFloat(o?.price || '0'),
      filledQuantity: parseFloat(o?.cumExecQty || '0'),
      filledPrice: parseFloat(o?.avgPrice || '0'),
      status: o?.orderStatus === 'Filled' ? 'FILLED' : o?.orderStatus === 'Cancelled' ? 'CANCELED' : 'NEW',
      createdAt: parseInt(o?.createdTime) || Date.now(),
      updatedAt: parseInt(o?.updatedTime) || Date.now(),
    };
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    await this.bybitPost('/v5/order/cancel', { category: 'spot', symbol: symbol.replace('/', ''), orderId });
    return true;
  }

  async getOpenOrders(symbol?: string): Promise<CloudOrderInfo[]> {
    const params: any = { category: 'spot' };
    if (symbol) params.symbol = symbol.replace('/', '');
    const data = await this.bybitGet('/v5/order/realtime', params);
    return (data?.result?.list || []).map((o: any) => this.mapBybitOrder(o));
  }

  async getOrderHistory(symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const params: any = { category: 'spot', limit: limit.toString() };
    if (symbol) params.symbol = symbol.replace('/', '');
    const data = await this.bybitGet('/v5/order/history', params);
    return (data?.result?.list || []).map((o: any) => this.mapBybitOrder(o));
  }

  subscribeQuotes(symbols: string[]): void {
    this.subscribedSymbols = symbols.map((s) => s.replace('/', ''));
    const wsUrl = this.config.wsBaseUrl || 'wss://stream.bybit.com/v5/public/spot';
    this.ws = new (require('ws'))(wsUrl);
    this.ws.on('open', () => {
      this.ws.send(JSON.stringify({ op: 'subscribe', args: this.subscribedSymbols.map((s) => `tickers.${s}`) }));
    });
    this.ws.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.topic?.startsWith('tickers.') && msg.data) {
          const t = msg.data;
          this.quoteCallbacks.forEach((cb) => cb({
            brokerId: this.brokerId, symbol: t.symbol,
            price: parseFloat(t.lastPrice), change: parseFloat(t.price24hPcnt) * parseFloat(t.lastPrice) / 100,
            changePct: parseFloat(t.price24hPcnt), volume: parseFloat(t.volume24h),
            high24h: parseFloat(t.highPrice24h), low24h: parseFloat(t.lowPrice24h),
            timestamp: parseInt(t.time) || Date.now(),
          }));
        }
      } catch {}
    });
    this.ws.on('error', (e: any) => this.emitError(new Error(`Bybit WS: ${e.message}`)));
    this.ws.on('close', () => { if (this.connected) { this.reconnectTimer = setTimeout(() => this.subscribeQuotes(symbols), 3000); } });
  }

  unsubscribeQuotes(_symbols: string[]): void {
    if (this.ws) this.ws.close();
    this.subscribedSymbols = [];
  }

  subscribeDepth(symbol: string): void {
    const s = symbol.replace('/', '');
    const wsUrl = this.config.wsBaseUrl || 'wss://stream.bybit.com/v5/public/spot';
    this.ws = new (require('ws'))(wsUrl);
    this.ws.on('open', () => { this.ws.send(JSON.stringify({ op: 'subscribe', args: [`orderbook.50.${s}`] })); });
    this.ws.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.topic?.startsWith('orderbook') && msg.data) {
          const d = msg.data;
          this.depthCallbacks.forEach((cb) => cb({
            brokerId: this.brokerId, symbol,
            bids: (d.b || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
            asks: (d.a || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
            timestamp: parseInt(d.ts) || Date.now(),
          }));
        }
      } catch {}
    });
  }

  unsubscribeDepth(_symbol: string): void {
    if (this.ws) this.ws.close();
  }

  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = []; this.depthCallbacks = []; this.orderCallbacks = []; this.errorCallbacks = [];
  }

  // ═══════════════ REST ══════════════════════════════════

  private async bybitGet(path: string, params: Record<string, string> = {}): Promise<any> {
    const qs = Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return this.bybitRequest('GET', qs ? `${path}?${qs}` : path);
  }

  private async bybitPost(path: string, body: any): Promise<any> {
    return this.bybitRequest('POST', path, body);
  }

  private async bybitRequest(method: string, path: string, body?: any): Promise<any> {
    const ts = Date.now().toString();
    const recv = '5000';
    const bodyStr = body ? JSON.stringify(body) : '';
    const signStr = ts + this.config.apiKey + recv + (method === 'POST' ? bodyStr : '');
    const sign = bybitSign(signStr, this.config.secretKey);

    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? bodyStr : undefined,
      headers: {
        'X-BAPI-API-KEY': this.config.apiKey, 'X-BAPI-TIMESTAMP': ts,
        'X-BAPI-SIGN': sign, 'X-BAPI-RECV-WINDOW': recv,
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Bybit ${res.status}`);
    return res.json();
  }

  private mapBybitOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: o.orderId || '', clientOrderId: o.orderLinkId,
      symbol: o.symbol, side: o.side === 'Buy' ? 'BUY' : 'SELL',
      orderType: o.orderType === 'Market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.qty || '0'), price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.cumExecQty || '0'), filledPrice: parseFloat(o.avgPrice || '0'),
      status: o.orderStatus === 'Filled' ? 'FILLED' : o.orderStatus === 'Cancelled' ? 'CANCELED' : 'NEW',
      createdAt: parseInt(o.createdTime) || Date.now(), updatedAt: parseInt(o.updatedTime) || Date.now(),
    };
  }

  private emitError(e: Error): void { this.errorCallbacks.forEach((cb) => cb(e)); }
}
