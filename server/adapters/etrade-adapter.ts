/**
 * QUANT MOO R134 J01 — E*TRADE Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for E*TRADE.
 * Uses E*TRADE Developer API — OAuth1.0a + REST.
 * 
 * Auth: OAuth 1.0a 3-legged
 *  - Request Token → Authorize → Access Token
 *  - HMAC-SHA1 signing per request
 * Markets: US stocks, ETFs, options
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

function oauthSign(method: string, url: string, params: Record<string, string>, clientSecret: string, tokenSecret = ''): string {
  const signingKey = `${encodeURIComponent(clientSecret)}&${encodeURIComponent(tokenSecret)}`;
  const base = Object.entries(params).sort().map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const baseStr = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(base)}`;
  return crypto.createHmac('sha1', signingKey).update(baseStr).digest('base64');
}

export class EtradeAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string; readonly brokerName: string; readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private accessToken = ''; private accessTokenSecret = '';
  private accountIdKey = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
    this.accessToken = (config.options?.accessToken as string) || '';
    this.accessTokenSecret = (config.options?.accessTokenSecret as string) || '';
  }

  async connect(): Promise<void> {
    if (!this.accessToken || !this.accessTokenSecret) {
      throw new Error('E*TRADE OAuth access token required');
    }
    // Get account list
    const data = await this.etradeGet('/v1/accounts/list');
    const accounts = data?.AccountListResponse?.Accounts?.Account || [];
    if (accounts.length > 0) {
      this.accountIdKey = accounts[0].accountIdKey;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> { this.connected = false; }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/v1/accounts/list`);
      return { ok: res.status < 500, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.etradeGet(`/v1/accounts/${this.accountIdKey}/balance`);
    const bal = data?.BalanceResponse?.Computed || {};
    return {
      brokerId: this.brokerId, accountId: this.accountIdKey,
      totalEquity: parseFloat(bal.netAccountValue || '0'),
      availableBalance: parseFloat(bal.cashAvailableForInvestment || '0'),
      unrealizedPnl: parseFloat(bal.totalUnrealizedGain || '0'),
      realizedPnl: 0, currency: 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    if (symbols.length === 0) return results;
    try {
      const data = await this.etradeGet(`/v1/market/quote/${symbols.join(',')}`);
      const quotes = data?.QuoteResponse?.QuoteData || [];
      for (const q of quotes) {
        const all = q.All || q;
        results.push({
          brokerId: this.brokerId, symbol: q.Product?.symbol || '',
          price: parseFloat(all.lastTrade || '0'),
          change: parseFloat(all.change || '0'),
          changePct: parseFloat(all.changePct || '0'),
          volume: parseInt(all.totalVolume || '0'),
          high24h: parseFloat(all.high || '0'),
          low24h: parseFloat(all.low || '0'),
          timestamp: Date.now(),
        });
      }
    } catch {}
    return results;
  }

  async getDepth(_symbol: string, _limit = 10): Promise<CloudDepthSnapshot> {
    return { brokerId: this.brokerId, symbol: _symbol, bids: [], asks: [], timestamp: Date.now() };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      PlaceOrderRequest: {
        orderType: req.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
        clientOrderId: req.clientOrderId || `jvs-${Date.now()}`,
        Order: [{
          Instrument: [{ Product: { symbol: req.symbol }, orderAction: req.side, Quantity: req.quantity }],
          priceType: req.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
          limitPrice: req.orderType === 'LIMIT' ? req.price : undefined,
        }],
      },
    };
    const data = await this.etradePost(`/v1/accounts/${this.accountIdKey}/orders/place`, body);
    const o = data?.PlaceOrderResponse?.OrderIds?.[0] || {};

    return {
      brokerId: this.brokerId, orderId: o.orderId?.toString() || '',
      clientOrderId: body.PlaceOrderRequest.clientOrderId,
      symbol: req.symbol, side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: 0, filledPrice: 0,
      status: 'NEW', createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.etradeDelete(`/v1/accounts/${this.accountIdKey}/orders/cancel`, { orderId });
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.etradeGet(`/v1/accounts/${this.accountIdKey}/orders?status=OPEN`);
    return (data?.OrdersResponse?.Order || []).map((o: any) => this.mapEtradeOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const data = await this.etradeGet(`/v1/accounts/${this.accountIdKey}/orders?count=${limit}`);
    return (data?.OrdersResponse?.Order || []).map((o: any) => this.mapEtradeOrder(o));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.etradeGet(`/v1/accounts/${this.accountIdKey}/portfolio`);
      const pos = data?.PortfolioResponse?.AccountPortfolio?.[0]?.Position || [];
      return pos.map((p: any) => ({
        brokerId: this.brokerId, symbol: p.Product?.symbol || '',
        quantity: parseFloat(p.quantity || '0'), avgCost: parseFloat(p.avgCost || '0'),
        marketValue: parseFloat(p.marketValue || '0'),
        unrealizedPnl: parseFloat(p.daysGain || '0'),
        marketPrice: parseFloat(p.quoteDetails?.lastTrade || '0'),
        currency: 'USD', accountId: this.accountIdKey,
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

  private async etradeGet(path: string): Promise<any> { return this.etradeRequest('GET', path); }
  private async etradePost(path: string, body: any): Promise<any> { return this.etradeRequest('POST', path, body); }
  private async etradeDelete(path: string, params: Record<string, string> = {}): Promise<any> { return this.etradeRequest('DELETE', path + '?' + new URLSearchParams(params).toString()); }

  private async etradeRequest(method: string, path: string): Promise<any> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const url = `${this.config.restBaseUrl}${path}`;
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.apiKey, oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: ts,
      oauth_token: this.accessToken, oauth_version: '1.0',
    };
    const sig = oauthSign(method, url, oauthParams, this.config.secretKey, this.accessTokenSecret);
    const authHeader = `OAuth ${Object.entries({ ...oauthParams, oauth_signature: sig }).map(([k,v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(', ')}`;
    const res = await fetch(url, { method, headers: { Authorization: authHeader, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`E*TRADE ${res.status}`);
    return res.json().catch(() => ({}));
  }

  private mapEtradeOrder(o: any): CloudOrderInfo {
    const detail = o.OrderDetail?.[0] || {};
    const inst = detail.Instrument?.[0] || {};
    return {
      brokerId: this.brokerId, orderId: detail.orderId?.toString() || '',
      clientOrderId: o.clientOrderId, symbol: inst.Product?.symbol || '',
      side: inst.orderAction, orderType: (detail.priceType || '').includes('MARKET') ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(inst.orderedQuantity || '0'),
      price: parseFloat(detail.limitPrice || '0'),
      filledQuantity: parseFloat(detail.executedQuantity || '0'),
      filledPrice: parseFloat(detail.averageExecutionPrice || '0'),
      status: o.orderStatus === 'EXECUTED' ? 'FILLED' : o.orderStatus === 'CANCELLED' ? 'CANCELED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }
}
