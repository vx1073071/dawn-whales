/**
 * DAWN WHALES R134 J04 — Valuable Capital (华盛/VBKR) + 盈立 (uSMART) Adapters
 * 
 * Two adapters in one file — both are HK-based traditional brokers
 * targeting HK stocks + US stocks.
 * 
 * ====== 华盛 (VBKR) ======
 * Also known as: Valuable Capital, VBroker
 * Markets: HK, US, A-shares (Stock Connect)
 * API: REST with HMAC-SHA256 signing
 * Protocol: Similar to 富途 OpenD but different endpoint
 * 
 * ====== 盈立 (uSMART) ======
 * Also known as: uSMART Securities
 * Markets: HK, US
 * API: REST with HMAC-SHA256 + token-based auth
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

// ═══════════════ 华盛 (VBKR) Adapter ═══════════════════════

function vbkrSign(timestamp: string, params: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}${params}`).digest('hex');
}

export class VbkrAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string; readonly brokerName: string; readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private accessToken = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
  }

  async connect(): Promise<void> {
    this.accessToken = await this.vbkrLogin();
    this.connected = true;
  }

  async disconnect(): Promise<void> { this.connected = false; }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/api/v1/system/time`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.vbkrGet('/api/v1/account/info');
    return {
      brokerId: this.brokerId, accountId: data?.accountId || this.brokerId,
      totalEquity: parseFloat(data?.totalAssets || '0'),
      availableBalance: parseFloat(data?.availableCash || '0'),
      unrealizedPnl: parseFloat(data?.unrealizedPnl || '0'),
      realizedPnl: parseFloat(data?.realizedPnl || '0'),
      currency: data?.baseCurrency || 'HKD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const data = await this.vbkrGet(`/api/v1/quote?symbols=${symbols.join(',')}`);
    return (data?.quotes || []).map((q: any) => ({
      brokerId: this.brokerId, symbol: q.symbol,
      price: parseFloat(q.latestPrice || q.last || '0'),
      change: parseFloat(q.change || '0'),
      changePct: parseFloat(q.changePct || '0'),
      volume: parseInt(q.volume || '0'),
      high24h: parseFloat(q.high || '0'), low24h: parseFloat(q.low || '0'),
      timestamp: Date.now(),
    }));
  }

  async getDepth(symbol: string, limit = 10): Promise<CloudDepthSnapshot> {
    const data = await this.vbkrGet(`/api/v1/quote/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
    return {
      brokerId: this.brokerId, symbol,
      bids: (data?.bids || []).map((b: any) => [parseFloat(b.price), parseInt(b.volume)]),
      asks: (data?.asks || []).map((a: any) => [parseFloat(a.price), parseInt(a.volume)]),
      timestamp: Date.now(),
    };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      symbol: req.symbol, side: req.side, orderType: req.orderType === 'MARKET' ? 'MKT' : 'LMT',
      quantity: req.quantity, price: req.orderType === 'LIMIT' ? req.price : undefined,
    };
    const data = await this.vbkrPost('/api/v1/trade/order/place', body);
    return {
      brokerId: this.brokerId, orderId: data?.orderId || '',
      clientOrderId: data?.clientOrderId, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: 0, filledPrice: 0,
      status: 'NEW', createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.vbkrPost('/api/v1/trade/order/cancel', { orderId });
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.vbkrGet('/api/v1/trade/orders?status=open');
    return (data?.orders || []).map((o: any) => this.mapVbkrOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const data = await this.vbkrGet(`/api/v1/trade/orders?status=all&limit=${limit}`);
    return (data?.orders || []).map((o: any) => this.mapVbkrOrder(o));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.vbkrGet('/api/v1/account/positions');
      return (data?.positions || []).map((p: any) => ({
        brokerId: this.brokerId, symbol: p.symbol || '',
        quantity: parseFloat(p.quantity || '0'), avgCost: parseFloat(p.avgCost || '0'),
        marketValue: parseFloat(p.marketValue || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPnl || '0'),
        marketPrice: parseFloat(p.marketPrice || '0'),
        currency: p.currency || 'HKD', accountId: this.brokerId,
      }));
    } catch { return []; }
  }

  subscribeQuotes(symbols: string[]): void {
    const poll = async () => {
      if (!this.connected) return;
      try { const quotes = await this.getQuotes(symbols); for (const q of quotes) this.quoteCallbacks.forEach((cb) => cb(q)); } catch {}
      if (this.connected) setTimeout(poll, 5000);
    };
    poll();
  }

  unsubscribeQuotes(_symbols: string[]): void {}
  subscribeDepth(_symbol: string): void {}
  unsubscribeDepth(_symbol: string): void {}
  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = []; this.depthCallbacks = []; this.orderCallbacks = []; this.errorCallbacks = [];
  }

  private async vbkrLogin(): Promise<string> {
    const res = await this.vbkrPost('/api/v1/auth/login', { appKey: this.config.apiKey, appSecret: this.config.secretKey });
    return res?.accessToken || '';
  }

  private async vbkrGet(path: string): Promise<any> { return this.vbkrRequest('GET', path); }
  private async vbkrPost(path: string, body: any): Promise<any> { return this.vbkrRequest('POST', path, body); }

  private async vbkrRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`VBKR ${res.status}`);
    return res.json().catch(() => ({}));
  }

  private mapVbkrOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: o.orderId || '',
      clientOrderId: o.clientOrderId, symbol: o.symbol || '',
      side: o.side, orderType: o.orderType === 'MKT' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.filledQuantity || '0'),
      filledPrice: parseFloat(o.avgFillPrice || '0'),
      status: o.status === 'Filled' ? 'FILLED' : o.status === 'Cancelled' ? 'CANCELED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }
}

// ═══════════════ 盈立 (uSMART) Adapter ═══════════════════

function usmartSign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const prehash = `${timestamp}\n${method}\n${path}\n${body}`;
  return crypto.createHmac('sha256', secret).update(prehash).digest('hex');
}

export class USmartAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string; readonly brokerName: string; readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private accessToken = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
  }

  async connect(): Promise<void> {
    this.accessToken = await this.usmartLogin();
    this.connected = true;
  }

  async disconnect(): Promise<void> { this.connected = false; }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/v1/system/ping`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.usmartGet('/v1/account/overview');
    return {
      brokerId: this.brokerId, accountId: data?.accountNo || this.brokerId,
      totalEquity: parseFloat(data?.totalAsset || '0'),
      availableBalance: parseFloat(data?.availableCash || '0'),
      unrealizedPnl: parseFloat(data?.unrealizedProfitLoss || '0'),
      realizedPnl: parseFloat(data?.realizedProfitLoss || '0'),
      currency: 'HKD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const data = await this.usmartPost('/v1/market/quote/batch', { symbols });
    return (data?.list || []).map((q: any) => ({
      brokerId: this.brokerId, symbol: q.symbol,
      price: parseFloat(q.lastDone || q.last || '0'),
      change: parseFloat(q.change || '0'),
      changePct: parseFloat(q.changeRate || '0'),
      volume: parseInt(q.volume || '0'),
      high24h: parseFloat(q.high || '0'), low24h: parseFloat(q.low || '0'),
      timestamp: Date.now(),
    }));
  }

  async getDepth(symbol: string, limit = 10): Promise<CloudDepthSnapshot> {
    const data = await this.usmartPost('/v1/market/orderbook', { symbol, depth: limit.toString() });
    return {
      brokerId: this.brokerId, symbol,
      bids: (data?.bid || []).map((b: any) => [parseFloat(b.price), parseInt(b.volume)]),
      asks: (data?.ask || []).map((a: any) => [parseFloat(a.price), parseInt(a.volume)]),
      timestamp: Date.now(),
    };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      symbol: req.symbol, side: req.side, type: req.orderType === 'MARKET' ? 'market' : 'limit',
      quantity: req.quantity, ...(req.orderType === 'LIMIT' && { price: req.price }),
    };
    const data = await this.usmartPost('/v1/trade/order/submit', body);
    return {
      brokerId: this.brokerId, orderId: data?.orderId || '',
      clientOrderId: data?.clientOrderId, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: 0, filledPrice: 0,
      status: 'NEW', createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.usmartPost('/v1/trade/order/cancel', { orderId });
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.usmartPost('/v1/trade/order/list', { status: 'pending' });
    return (data?.orders || []).map((o: any) => this.mapUSmartOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const data = await this.usmartPost('/v1/trade/order/list', { status: 'all', limit: limit.toString() });
    return (data?.orders || []).map((o: any) => this.mapUSmartOrder(o));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.usmartPost('/v1/account/position/list', {});
      return (data?.positions || []).map((p: any) => ({
        brokerId: this.brokerId, symbol: p.symbol || '',
        quantity: parseFloat(p.currentQuantity || '0'), avgCost: parseFloat(p.averageCost || '0'),
        marketValue: parseFloat(p.marketValue || '0'),
        unrealizedPnl: parseFloat(p.unrealizedProfitLoss || '0'),
        marketPrice: parseFloat(p.marketPrice || '0'),
        currency: 'HKD', accountId: this.brokerId,
      }));
    } catch { return []; }
  }

  subscribeQuotes(symbols: string[]): void {
    const poll = async () => {
      if (!this.connected) return;
      try { const quotes = await this.getQuotes(symbols); for (const q of quotes) this.quoteCallbacks.forEach((cb) => cb(q)); } catch {}
      if (this.connected) setTimeout(poll, 5000);
    };
    poll();
  }

  unsubscribeQuotes(_symbols: string[]): void {}
  subscribeDepth(_symbol: string): void {}
  unsubscribeDepth(_symbol: string): void {}
  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = []; this.depthCallbacks = []; this.orderCallbacks = []; this.errorCallbacks = [];
  }

  private async usmartLogin(): Promise<string> {
    const data = await this.usmartPost('/v1/auth/login', { appKey: this.config.apiKey, appSecret: this.config.secretKey });
    return data?.token || '';
  }

  private async usmartGet(path: string): Promise<any> { return this.usmartRequest('GET', path); }
  private async usmartPost(path: string, body: any): Promise<any> { return this.usmartRequest('POST', path, body); }

  private async usmartRequest(method: string, path: string, body?: any): Promise<any> {
    const ts = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const sig = usmartSign(ts, method, path, bodyStr, this.config.secretKey);

    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? bodyStr : undefined,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Timestamp': ts, 'X-Signature': sig,
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`uSMART ${res.status}`);
    return res.json().catch(() => ({}));
  }

  private mapUSmartOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: o.orderId || '',
      clientOrderId: o.clientOrderId, symbol: o.symbol || '',
      side: o.side, orderType: o.type === 'market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.dealtQuantity || o.filledQty || '0'),
      filledPrice: parseFloat(o.averagePrice || '0'),
      status: o.status === 'done' ? 'FILLED' : o.status === 'cancelled' ? 'CANCELED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }
}

export { VbkrAdapter as VbkrAdapter };
