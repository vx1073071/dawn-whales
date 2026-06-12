// @ts-nocheck
/**
 * DAWN WHALES R134 J03 — MT5 (MetaTrader 5) Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for MT5 via MetaApi (metaapi.cloud).
 * 
 * MetaApi provides a REST+WS bridge to any MT4/MT5 broker.
 * This adapter works across ALL MT5-compatible brokers:
 *  - Forex: OANDA, FOREX.com, IC Markets, Pepperstone, FXCM, XM, etc.
 *  - Stocks/Indices: 100+ MT5 brokers
 *  - Crypto: MT5 crypto brokers
 * 
 * Auth: MetaApi token (obtained via metaapi.cloud registration)
 * 
 * Key design: single adapter → any MT5 broker via brokerApiId config.
 */

import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

export class Mt5Adapter implements ICloudBrokerAdapter {
  readonly brokerId: string; readonly brokerName: string; readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private metaApiToken = '';
  private accountId = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
    this.metaApiToken = this.config.secretKey; // MetaApi uses API token as "secret"
  }

  async connect(): Promise<void> {
    // Get MetaApi account info
    const accounts = await this.metaGet('/users/current/accounts');
    if (accounts?.length > 0) {
      this.accountId = accounts[0]._id || accounts[0].id;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> { this.connected = false; }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch('https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
        headers: { 'auth-token': this.metaApiToken },
      });
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.metaGet(`/users/current/accounts/${this.accountId}/accountInformation`);
    return {
      brokerId: this.brokerId, accountId: this.accountId,
      totalEquity: parseFloat(data?.equity || '0'),
      availableBalance: parseFloat(data?.balance || '0') + parseFloat(data?.credit || '0'),
      unrealizedPnl: parseFloat(data?.equity || '0') - parseFloat(data?.balance || '0'),
      realizedPnl: 0, currency: data?.currency || 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const data = await this.metaGet(`/users/current/accounts/${this.accountId}/symbols/${encodeURIComponent(sym)}/specification`);
        if (data) {
          results.push({
            brokerId: this.brokerId, symbol: sym,
            price: parseFloat(data.bid || '0'),
            change: 0, changePct: 0, volume: 0,
            high24h: parseFloat(data.bid || '0'), low24h: parseFloat(data.ask || '0'),
            timestamp: Date.now(),
          });
        }
      } catch {}
    }
    return results;
  }

  async getDepth(symbol: string, limit = 10): Promise<CloudDepthSnapshot> {
    try {
      const data = await this.metaGet(`/users/current/accounts/${this.accountId}/tick/${encodeURIComponent(symbol)}`);
      return {
        brokerId: this.brokerId, symbol,
        bids: [[parseFloat(data?.bid || '0'), 0]],
        asks: [[parseFloat(data?.ask || '0'), 0]],
        timestamp: Date.now(),
      };
    } catch {
      return { brokerId: this.brokerId, symbol, bids: [], asks: [], timestamp: Date.now() };
    }
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      symbol: req.symbol,
      type: req.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
      side: req.side.toLowerCase(),
      volume: req.quantity,
      ...(req.orderType === 'LIMIT' && { price: req.price }),
      ...(req.stopLoss && { stopLoss: req.stopLoss }),
      ...(req.takeProfit && { takeProfit: req.takeProfit }),
    };
    const data = await this.metaPost(`/users/current/accounts/${this.accountId}/trade`, body);
    return {
      brokerId: this.brokerId, orderId: data?.orderId || data?.positionId || '',
      clientOrderId: data?.clientId, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: parseFloat(data?.openPrice || req.price || '0'),
      filledQuantity: req.quantity, filledPrice: parseFloat(data?.openPrice || '0'),
      status: 'FILLED', createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.metaDelete(`/users/current/accounts/${this.accountId}/positions/${orderId}`);
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.metaGet(`/users/current/accounts/${this.accountId}/positions`);
    return (data || []).map((p: any) => this.mapMt5Position(p));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const data = await this.metaGet(`/users/current/accounts/${this.accountId}/history-orders?limit=${limit}`);
    return (data || []).map((p: any) => this.mapMt5Position(p));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.metaGet(`/users/current/accounts/${this.accountId}/positions`);
      return (data || []).map((p: any) => ({
        brokerId: this.brokerId, symbol: p.symbol || '',
        quantity: parseFloat(p.volume || '0'), avgCost: parseFloat(p.openPrice || '0'),
        marketValue: parseFloat(p.currentPrice || '0') * parseFloat(p.volume || '0'),
        unrealizedPnl: parseFloat(p.unrealizedProfit || p.profit || '0'),
        marketPrice: parseFloat(p.currentPrice || '0'),
        currency: 'USD', accountId: this.accountId,
      }));
    } catch { return []; }
  }

  subscribeQuotes(symbols: string[]): void {
    const poll = async () => {
      if (!this.connected) return;
      try { const quotes = await this.getQuotes(symbols); for (const q of quotes) this.quoteCallbacks.forEach((cb) => cb(q)); } catch {}
      if (this.connected) setTimeout(poll, 3000);
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

  private async metaGet(path: string): Promise<any> { return this.metaRequest('GET', path); }
  private async metaPost(path: string, body: any): Promise<any> { return this.metaRequest('POST', path, body); }
  private async metaDelete(path: string): Promise<any> { return this.metaRequest('DELETE', path); }

  private async metaRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: {
        'auth-token': this.metaApiToken,
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`MT5 MetaApi ${res.status}`);
    return res.json().catch(() => ({}));
  }

  private mapMt5Position(p: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: p.id || p.positionId || '',
      clientOrderId: p.clientId, symbol: p.symbol || '',
      side: p.type?.includes('BUY') ? 'BUY' : 'SELL',
      orderType: 'MARKET', quantity: parseFloat(p.volume || '0'),
      price: parseFloat(p.openPrice || '0'),
      filledQuantity: parseFloat(p.volume || '0'),
      filledPrice: parseFloat(p.openPrice || '0'),
      status: p.state === 'POSITION_CLOSED' ? 'FILLED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }
}
