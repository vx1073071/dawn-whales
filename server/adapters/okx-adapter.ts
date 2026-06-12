// @ts-nocheck
/**
 * DAWN WHALES R130 J02 — OKX Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for OKX.
 * REST: www.okx.com (OK-ACCESS-SIGN with HMAC-SHA256 + timestamp)
 * WS:   ws.okx.com (public channel) / ws.okx.com (private channel)
 * 
 * OKX requires pre-hashed body for sign (unlike Binance query string).
 * Passphrase is required (3-key auth: API Key + Secret + Passphrase).
 */

import crypto from 'crypto';
import WebSocket from 'ws';
import { 
  ICloudBrokerAdapter, 
  CloudBrokerConfig, 
  CloudBrokerType,
  CloudQuoteInfo,
  CloudAccountInfo,
  CloudPositionInfo,
  CloudOrderRequest,
  CloudOrderInfo,
  CloudDepthSnapshot,
  CloudQuoteCallback,
  CloudDepthCallback,
  CloudOrderCallback,
  CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

// ═══════════════ Signing (OKX pre-hash) ═══════════════════

function okxSign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const prehash = timestamp + method + path + (body || '');
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64');
}

// ═══════════════ OKX Adapter ══════════════════════════════

export class OkxAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;

  private config: CloudBrokerConfig;
  private connected = false;
  private simulateTrading = true; // simulation mode for market data only

  // Callbacks
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];

  // WS
  private publicWs?: WebSocket;
  private privateWs?: WebSocket;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private subscribedInstruments: string[] = [];

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
  }

  // ═══════════════ Connection ═════════════════════════════

  async connect(): Promise<void> {
    try {
      const hc = await this.healthCheck();
      if (!hc.ok) throw new Error('OKX health check failed');
      this.connected = true;
    } catch (e: any) {
      this.emitError(new Error(`OKX connect failed: ${e.message}`));
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    [this.publicWs, this.privateWs].forEach((ws) => {
      if (ws) { try { ws.close(); } catch {} }
    });
    this.reconnectTimers.forEach((t) => clearTimeout(t));
    this.reconnectTimers.clear();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/api/v5/public/time`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  isConnected(): boolean { return this.connected; }

  // ═══════════════ Account ═══════════════════════════════

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.okxGet('/api/v5/account/balance');
    const details = data?.data?.[0]?.details || [];
    const totalEquity = parseFloat(data?.data?.[0]?.totalEq || '0');

    return {
      brokerId: this.brokerId,
      accountId: this.brokerId,
      totalEquity,
      availableBalance: parseFloat(details.find((d: any) => d.ccy === 'USDT')?.availEq || '0'),
      unrealizedPnl: parseFloat(data?.data?.[0]?.upl || '0'),
      realizedPnl: 0,
      currency: 'USD',
    };
  }

  // ═══════════════ Quotes ════════════════════════════════

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const okxSymbols = symbols.map((s) => s.replace('/', '-'));
    const results: CloudQuoteInfo[] = [];

    for (const instId of okxSymbols) {
      try {
        const data = await this.okxGet('/api/v5/market/ticker', { instId });
        const t = data?.data?.[0];
        if (t) {
          results.push({
            brokerId: this.brokerId,
            symbol: t.instId,
            price: parseFloat(t.last),
            change: parseFloat(t.sodUtc8 || '0') - parseFloat(t.last),
            changePct: parseFloat(t.sodUtc8) ? ((parseFloat(t.last) - parseFloat(t.sodUtc8)) / parseFloat(t.sodUtc8) * 100) : 0,
            volume: parseFloat(t.vol24h),
            high24h: parseFloat(t.high24h),
            low24h: parseFloat(t.low24h),
            timestamp: parseInt(t.ts) || Date.now(),
          });
        }
      } catch {}
    }
    return results;
  }

  async getDepth(symbol: string, limit = 20): Promise<CloudDepthSnapshot> {
    const instId = symbol.replace('/', '-');
    const data = await this.okxGet('/api/v5/market/books', { instId, sz: limit.toString() });

    return {
      brokerId: this.brokerId,
      symbol,
      bids: (data?.data?.[0]?.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data?.data?.[0]?.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: parseInt(data?.data?.[0]?.ts) || Date.now(),
    };
  }

  // ═══════════════ Orders ════════════════════════════════

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const instId = req.symbol.replace('/', '-');
    const side = req.side.toLowerCase();
    const ordType = req.orderType === 'MARKET' ? 'market' : 'limit';

    const body: any = {
      instId,
      tdMode: 'cash',
      side,
      ordType,
      sz: req.quantity.toString(),
    };
    if (ordType === 'limit') body.px = req.price?.toString();
    if (req.clientOrderId) body.clOrdId = req.clientOrderId;

    const data = await this.okxPost('/api/v5/trade/order', body);
    const o = data?.data?.[0];

    return {
      brokerId: this.brokerId,
      orderId: o?.ordId || '',
      clientOrderId: o?.clOrdId,
      symbol: req.symbol,
      side: req.side,
      orderType: req.orderType,
      quantity: parseFloat(o?.sz || '0'),
      price: parseFloat(o?.px || req.price?.toString() || '0'),
      filledQuantity: parseFloat(o?.fillSz || '0'),
      filledPrice: parseFloat(o?.avgPx || '0'),
      status: o?.state === 'filled' ? 'FILLED' : o?.state === 'canceled' ? 'CANCELED' : 'NEW',
      createdAt: parseInt(o?.cTime) || Date.now(),
      updatedAt: parseInt(o?.uTime) || Date.now(),
    };
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    const instId = symbol.replace('/', '-');
    await this.okxPost('/api/v5/trade/cancel-order', { instId, ordId: orderId });
    return true;
  }

  async getOpenOrders(symbol?: string): Promise<CloudOrderInfo[]> {
    const params: Record<string, string> = {};
    if (symbol) params.instId = symbol.replace('/', '-');
    const data = await this.okxGet('/api/v5/trade/orders-pending', params);
    return (data?.data || []).map((o: any) => this.mapOkxOrder(o));
  }

  async getOrderHistory(symbol?: string, limit = 100): Promise<CloudOrderInfo[]> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (symbol) params.instId = symbol.replace('/', '-');
    const data = await this.okxGet('/api/v5/trade/orders-history-archive', params);
    return (data?.data || []).map((o: any) => this.mapOkxOrder(o));
  }

  // ═══════════════ Subscriptions ═════════════════════════

  subscribeQuotes(symbols: string[]): void {
    this.subscribedInstruments = symbols.map((s) => s.replace('/', '-'));
    const channels = this.subscribedInstruments.map((i) => ({
      channel: 'tickers',
      instId: i,
    }));

    this.connectPublicWs(channels);
  }

  unsubscribeQuotes(_symbols: string[]): void {
    if (this.publicWs) this.publicWs.close();
    this.subscribedInstruments = [];
  }

  subscribeDepth(symbol: string): void {
    const instId = symbol.replace('/', '-');
    const channels = [{ channel: 'books', instId }];
    this.connectPublicWs(channels);
  }

  unsubscribeDepth(_symbol: string): void {
    if (this.publicWs) this.publicWs.close();
  }

  // ═══════════════ Event Listeners ═══════════════════════

  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = [];
    this.depthCallbacks = [];
    this.orderCallbacks = [];
    this.errorCallbacks = [];
  }

  // ═══════════════ Private WS ════════════════════════════

  private connectPublicWs(channels: any[]): void {
    if (this.publicWs) this.publicWs.close();

    this.publicWs = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
    this.publicWs.on('open', () => {
      this.publicWs?.send(JSON.stringify({
        op: 'subscribe',
        args: channels,
      }));
    });

    this.publicWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'error') {
          this.emitError(new Error(`OKX WS error: ${msg.msg}`));
          return;
        }
        if (!msg.data) return;

        for (const item of msg.data) {
          if (msg.arg?.channel === 'tickers') {
            this.quoteCallbacks.forEach((cb) => cb({
              brokerId: this.brokerId,
              symbol: item.instId,
              price: parseFloat(item.last),
              change: parseFloat(item.sodUtc8 || '0') - parseFloat(item.last),
              changePct: parseFloat(item.sodUtc8) ? ((parseFloat(item.last) - parseFloat(item.sodUtc8)) / parseFloat(item.sodUtc8) * 100) : 0,
              volume: parseFloat(item.vol24h),
              high24h: parseFloat(item.high24h),
              low24h: parseFloat(item.low24h),
              timestamp: parseInt(item.ts) || Date.now(),
            }));
          } else if (msg.arg?.channel === 'books') {
            this.depthCallbacks.forEach((cb) => cb({
              brokerId: this.brokerId,
              symbol: msg.arg.instId,
              bids: (item.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
              asks: (item.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
              timestamp: parseInt(item.ts) || Date.now(),
            }));
          }
        }
      } catch {}
    });

    this.publicWs.on('error', (e) => this.emitError(new Error(`OKX public WS error: ${e.message}`)));
    this.publicWs.on('close', () => {
      if (this.connected && this.subscribedInstruments.length > 0) {
        this.scheduleReconnect('public', () => {
          const chs = this.subscribedInstruments.map((i) => ({ channel: 'tickers', instId: i }));
          this.connectPublicWs(chs);
        });
      }
    });
  }

  private scheduleReconnect(label: string, fn: () => void): void {
    const timer = setTimeout(fn, 3000);
    this.reconnectTimers.set(label, timer);
  }

  private emitError(e: Error): void {
    this.errorCallbacks.forEach((cb) => cb(e));
  }

  // ═══════════════ REST Helpers ══════════════════════════

  private async okxGet(path: string, params: Record<string, string> = {}): Promise<any> {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const fullPath = qs ? `${path}?${qs}` : path;
    return this.okxRequest('GET', fullPath);
  }

  private async okxPost(path: string, body: any): Promise<any> {
    return this.okxRequest('POST', path, body);
  }

  private async okxRequest(method: string, path: string, body?: any): Promise<any> {
    const timestamp = new Date().toISOString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const sign = okxSign(timestamp, method, path, bodyStr, this.config.secretKey);

    const headers: Record<string, string> = {
      'OK-ACCESS-KEY': this.config.apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.config.passphrase || '',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.simulateTrading) {
      headers['x-simulated-trading'] = '1';
    }

    const url = `${this.config.restBaseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? bodyStr : undefined,
    });

    if (!res.ok) {
      throw new Error(`OKX API ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  // ═══════════════ Order Mapper ═══════════════════════════

  private mapOkxOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId,
      orderId: o.ordId || '',
      clientOrderId: o.clOrdId,
      symbol: o.instId,
      side: o.side === 'buy' ? 'BUY' : 'SELL',
      orderType: o.ordType === 'market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.sz || '0'),
      price: parseFloat(o.px || '0'),
      filledQuantity: parseFloat(o.fillSz || '0'),
      filledPrice: parseFloat(o.avgPx || '0'),
      status: o.state === 'filled' ? 'FILLED' : o.state === 'canceled' ? 'CANCELED' : 'NEW',
      createdAt: parseInt(o.cTime) || Date.now(),
      updatedAt: parseInt(o.uTime) || Date.now(),
    };
  }
}
