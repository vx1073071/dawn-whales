// @ts-nocheck
/**
 * DAWN WHALES R131 J02 — Bitget Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for Bitget Spot V2.
 * REST: api.bitget.com (HMAC-SHA256 base64 signing)
 * WS:   ws.bitget.com (WebSocket V2)
 * 
 * Bitget signing: prehash = timestamp + method + requestPath + body
 * Signature output is base64-encoded.
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

function bitgetSign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const prehash = timestamp + method + path + (body || '');
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64');
}

export class BitgetAdapter implements ICloudBrokerAdapter {
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
    if (!hc.ok) throw new Error('Bitget health check failed');
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
      const res = await fetch(`${this.config.restBaseUrl}/api/v2/public/time`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.bitgetGet('/api/v2/spot/account/assets');
    const assets = data?.data || [];
    const total = assets.reduce((sum: number, a: any) => sum + parseFloat(a.available) + parseFloat(a.frozen), 0);
    const usdtAsset = assets.find((a: any) => a.coin === 'USDT');
    return {
      brokerId: this.brokerId, accountId: this.brokerId,
      totalEquity: total, availableBalance: parseFloat(usdtAsset?.available || '0'),
      unrealizedPnl: 0, realizedPnl: 0, currency: 'USDT',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const data = await this.bitgetGet('/api/v2/spot/market/tickers', { symbol: sym.replace('/', '') });
        const t = data?.data?.[0];
        if (t) results.push({
          brokerId: this.brokerId, symbol: t.symbol,
          price: parseFloat(t.lastPr), change: parseFloat(t.change24h),
          changePct: parseFloat(t.change24h) / (parseFloat(t.lastPr) - parseFloat(t.change24h)) * 100,
          volume: parseFloat(t.vol24h), high24h: parseFloat(t.high24h), low24h: parseFloat(t.low24h),
          timestamp: parseInt(t.ts) || Date.now(),
        });
      } catch {}
    }
    return results;
  }

  async getDepth(symbol: string, limit = 100): Promise<CloudDepthSnapshot> {
    const data = await this.bitgetGet('/api/v2/spot/market/orderbook', { symbol: symbol.replace('/', ''), limit: limit.toString() });
    const ob = data?.data;
    return {
      brokerId: this.brokerId, symbol,
      bids: (ob?.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (ob?.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: parseInt(ob?.ts) || Date.now(),
    };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body: any = {
      symbol: req.symbol.replace('/', ''), side: req.side.toLowerCase(),
      orderType: req.orderType === 'MARKET' ? 'market' : 'limit',
      quantity: req.quantity.toString(),
    };
    if (body.orderType === 'limit') body.price = req.price?.toString();
    const data = await this.bitgetPost('/api/v2/spot/trade/place-order', body);
    const o = data?.data;
    return {
      brokerId: this.brokerId, orderId: o?.orderId || '', clientOrderId: o?.clientOrderId,
      symbol: req.symbol, side: req.side, orderType: req.orderType,
      quantity: parseFloat(o?.quantity || '0'), price: parseFloat(o?.price || '0'),
      filledQuantity: parseFloat(o?.fillQuantity || '0'), filledPrice: parseFloat(o?.fillPrice || '0'),
      status: o?.status === 'filled' ? 'FILLED' : o?.status === 'cancelled' ? 'CANCELED' : 'NEW',
      createdAt: parseInt(o?.cTime) || Date.now(), updatedAt: parseInt(o?.uTime) || Date.now(),
    };
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    await this.bitgetPost('/api/v2/spot/trade/cancel-order', { symbol: symbol.replace('/', ''), orderId });
    return true;
  }

  async getOpenOrders(symbol?: string): Promise<CloudOrderInfo[]> {
    const params: any = {};
    if (symbol) params.symbol = symbol.replace('/', '');
    const data = await this.bitgetGet('/api/v2/spot/trade/open-orders', params);
    return (data?.data || []).map((o: any) => this.mapBitgetOrder(o));
  }

  async getOrderHistory(symbol?: string, limit = 100): Promise<CloudOrderInfo[]> {
    const params: any = { limit: limit.toString() };
    if (symbol) params.symbol = symbol.replace('/', '');
    const data = await this.bitgetGet('/api/v2/spot/trade/history', params);
    return (data?.data || []).map((o: any) => this.mapBitgetOrder(o));
  }

  subscribeQuotes(symbols: string[]): void {
    this.subscribedSymbols = symbols.map((s) => s.replace('/', ''));
    const channels = this.subscribedSymbols.map((s) => ({ channel: 'ticker', instId: s }));
    this.connectWs(channels);
  }

  unsubscribeQuotes(_symbols: string[]): void {
    if (this.ws) this.ws.close();
    this.subscribedSymbols = [];
  }

  subscribeDepth(symbol: string): void {
    const s = symbol.replace('/', '');
    this.connectWs([{ channel: 'orderbook', instId: s, depth: '20' }]);
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

  // ═══════════════ Private ══════════════════════════════

  private connectWs(channels: any[]): void {
    if (this.ws) this.ws.close();
    const wsUrl = this.config.wsBaseUrl || 'wss://ws.bitget.com/v2/ws/public';
    this.ws = new (require('ws'))(wsUrl);
    this.ws.on('open', () => {
      this.ws.send(JSON.stringify({ op: 'subscribe', args: channels }));
    });
    this.ws.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'snapshot' || msg.action === 'update') {
          for (const item of msg.data || []) {
            if (msg.arg?.channel === 'ticker') {
              this.quoteCallbacks.forEach((cb) => cb({
                brokerId: this.brokerId, symbol: item.instId,
                price: parseFloat(item.lastPr), change: parseFloat(item.change24h),
                changePct: parseFloat(item.change24h) / (parseFloat(item.lastPr) - parseFloat(item.change24h)) * 100,
                volume: parseFloat(item.vol24h), high24h: parseFloat(item.high24h), low24h: parseFloat(item.low24h),
                timestamp: parseInt(item.ts) || Date.now(),
              }));
            } else if (msg.arg?.channel === 'orderbook') {
              this.depthCallbacks.forEach((cb) => cb({
                brokerId: this.brokerId, symbol: msg.arg.instId,
                bids: (item.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
                asks: (item.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
                timestamp: parseInt(item.ts) || Date.now(),
              }));
            }
          }
        }
      } catch {}
    });
    this.ws.on('error', (e: any) => this.emitError(new Error(`Bitget WS: ${e.message}`)));
    this.ws.on('close', () => {
      if (this.connected && this.subscribedSymbols.length > 0) {
        this.reconnectTimer = setTimeout(() => {
          const chs = this.subscribedSymbols.map((s) => ({ channel: 'ticker', instId: s }));
          this.connectWs(chs);
        }, 3000);
      }
    });
  }

  private async bitgetGet(path: string, params: Record<string, string> = {}): Promise<any> {
    const qs = Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return this.bitgetRequest('GET', qs ? `${path}?${qs}` : path);
  }

  private async bitgetPost(path: string, body: any): Promise<any> {
    return this.bitgetRequest('POST', path, body);
  }

  private async bitgetRequest(method: string, path: string, body?: any): Promise<any> {
    const ts = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const sign = bitgetSign(ts, method, path, bodyStr, this.config.secretKey);

    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? bodyStr : undefined,
      headers: {
        'ACCESS-KEY': this.config.apiKey, 'ACCESS-SIGN': sign,
        'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': this.config.passphrase || '',
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Bitget ${res.status}`);
    return res.json();
  }

  private mapBitgetOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: o.orderId || '', clientOrderId: o.clientOrderId,
      symbol: o.symbol, side: o.side === 'buy' ? 'BUY' : 'SELL',
      orderType: o.orderType === 'market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.fillQuantity || '0'), filledPrice: parseFloat(o.fillPrice || '0'),
      status: o.status === 'filled' ? 'FILLED' : o.status === 'cancelled' ? 'CANCELED' : 'NEW',
      createdAt: parseInt(o.cTime) || Date.now(), updatedAt: parseInt(o.uTime) || Date.now(),
    };
  }

  private emitError(e: Error): void { this.errorCallbacks.forEach((cb) => cb(e)); }
}
