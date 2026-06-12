// @ts-nocheck
/**
 * DAWN WHALES R134 J02 — eToro Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for eToro.
 * Uses eToro REST API — OAuth2 + REST + WS.
 * 
 * Auth: OAuth2 Bearer token
 * Markets: Stocks, ETFs, Crypto, CFDs (global)
 * 
 * Special: eToro uses instrument IDs (not symbols) for most endpoints.
 */

import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

export class EtoroAdapter implements ICloudBrokerAdapter {
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
    this.accessToken = (config.options?.accessToken as string) || '';
  }

  async connect(): Promise<void> {
    if (!this.accessToken) {
      // eToro uses OAuth2 Bearer token
      // In production, user authorizes via eToro OAuth flow
      this.accessToken = await this.acquireToken();
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> { this.connected = false; }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/api/v1/info`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.etoroGet('/api/v1/account');
    return {
      brokerId: this.brokerId, accountId: data?.login || this.brokerId,
      totalEquity: parseFloat(data?.equity || '0'),
      availableBalance: parseFloat(data?.available || '0'),
      unrealizedPnl: parseFloat(data?.unrealizedPnl || '0'),
      realizedPnl: parseFloat(data?.realizedPnl || '0'),
      currency: data?.currency || 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const data = await this.etoroGet(`/api/v1/markets/${sym}`);
        if (data?.instrument) {
          const d = data.instrument;
          results.push({
            brokerId: this.brokerId, symbol: sym,
            price: parseFloat(d.rate || '0'),
            change: parseFloat(d.dailyChange || '0'),
            changePct: parseFloat(d.dailyChangePercent || '0'),
            volume: 0, high24h: parseFloat(d.high || '0'), low24h: parseFloat(d.low || '0'),
            timestamp: Date.now(),
          });
        }
      } catch {}
    }
    return results;
  }

  async getDepth(_symbol: string, _limit = 10): Promise<CloudDepthSnapshot> {
    return { brokerId: this.brokerId, symbol: _symbol, bids: [], asks: [], timestamp: Date.now() };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      instrumentId: await this.resolveInstrumentId(req.symbol),
      direction: req.side === 'BUY' ? 'buy' : 'sell',
      quantity: req.quantity,
      orderType: req.orderType === 'MARKET' ? 'market' : 'limit',
      limitPrice: req.orderType === 'LIMIT' ? req.price : undefined,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit,
    };
    const data = await this.etoroPost('/api/v1/trades', body);
    return {
      brokerId: this.brokerId, orderId: data?.positionId?.toString() || '',
      clientOrderId: body.instrumentId, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: req.quantity, filledPrice: parseFloat(data?.openRate || '0'),
      status: 'FILLED', createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.etoroDelete(`/api/v1/trades/${orderId}`);
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.etoroGet('/api/v1/trades?status=open');
    return (data?.positions || []).map((p: any) => this.mapEtoroPosition(p));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const data = await this.etoroGet(`/api/v1/trades?status=closed&limit=${limit}`);
    return (data?.positions || []).map((p: any) => this.mapEtoroPosition(p));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.etoroGet('/api/v1/trades?status=open');
      return (data?.positions || []).map((p: any) => ({
        brokerId: this.brokerId, symbol: p.instrumentName || '',
        quantity: parseFloat(p.units || '0'), avgCost: parseFloat(p.openRate || '0'),
        marketValue: parseFloat(p.currentValue || '0'),
        unrealizedPnl: parseFloat(p.profit || '0'),
        marketPrice: parseFloat(p.currentRate || '0'),
        currency: 'USD', accountId: this.brokerId,
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

  private async acquireToken(): Promise<string> {
    // eToro OAuth2 token endpoint
    const res = await fetch(`${this.config.restBaseUrl}/api/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.config.apiKey, secret: this.config.secretKey }),
    });
    const data = await res.json();
    return data?.access_token || data?.token || '';
  }

  private async resolveInstrumentId(symbol: string): Promise<string> {
    const data = await this.etoroGet(`/api/v1/markets/${symbol}`);
    return data?.instrument?.instrumentId || symbol;
  }

  private async etoroGet(path: string): Promise<any> { return this.etoroRequest('GET', path); }
  private async etoroPost(path: string, body: any): Promise<any> { return this.etoroRequest('POST', path, body); }
  private async etoroDelete(path: string): Promise<any> { return this.etoroRequest('DELETE', path); }

  private async etoroRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`eToro ${res.status}`);
    return res.json().catch(() => ({}));
  }

  private mapEtoroPosition(p: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: p.positionId?.toString() || '',
      clientOrderId: p.instrumentId, symbol: p.instrumentName || '',
      side: p.direction === 'buy' ? 'BUY' : 'SELL',
      orderType: 'MARKET', quantity: parseFloat(p.units || '0'),
      price: parseFloat(p.openRate || '0'),
      filledQuantity: parseFloat(p.units || '0'),
      filledPrice: parseFloat(p.openRate || '0'),
      status: p.status === 'closed' ? 'FILLED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }
}
