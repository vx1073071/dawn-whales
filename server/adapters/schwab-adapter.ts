/**
 * DAWN WHALES R133 J03 — Charles Schwab Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for Charles Schwab (thinkorswim).
 * Uses Schwab Trader API — OAuth2 + REST.
 * 
 * Markets: US stocks, ETFs, options
 * 
 * Auth: OAuth2 Authorization Code flow
 *  - Client ID + Client Secret
 *  - Authorization endpoint: https://api.schwabapi.com/v1/oauth/authorize
 *  - Token endpoint: https://api.schwabapi.com/v1/oauth/token
 *  - Scopes: read, trade
 *  - Access token: 30 min expiry, refresh token: 7 days
 * 
 * Special considerations:
 *  - No WebSocket streaming available for individual traders
 *  - Refresh token MUST be rotated (7-day expiry)
 *  - Account ID uses hashed accountNumber field
 *  - Order placement requires OAuth2 trade scope
 */

import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

export class SchwabAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private accessToken = '';
  private refreshToken = '';
  private tokenExpiry = 0;
  private accountNumber = '';
  private accountHash = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
  }

  async connect(): Promise<void> {
    // OAuth2: first try to get token, if none, need user to authorize
    if (!this.accessToken || Date.now() > this.tokenExpiry) {
      await this.acquireAccessToken();
    }
    const hc = await this.healthCheck();
    if (!hc.ok) throw new Error('Schwab health check failed');

    // Get account numbers
    const accounts = await this.schwabGet('/trader/v1/accounts/accountNumbers');
    if (accounts?.length > 0) {
      this.accountNumber = accounts[0].accountNumber;
      this.accountHash = accounts[0].hashValue;
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.accessToken = '';
    this.tokenExpiry = 0;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.ensureAuth();
      const res = await fetch(`${this.config.restBaseUrl}/trader/v1/accounts/accountNumbers`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected && this.accessToken !== ''; }

  async getAccount(): Promise<CloudAccountInfo> {
    await this.ensureAuth();
    const data = await this.schwabGet(`/trader/v1/accounts/${this.accountHash}`);
    const balances = data?.securitiesAccount?.currentBalances;
    const initial = data?.securitiesAccount?.initialBalances;

    return {
      brokerId: this.brokerId, accountId: this.accountNumber,
      totalEquity: parseFloat(balances?.liquidationValue || '0'),
      availableBalance: parseFloat(balances?.availableFunds || '0'),
      unrealizedPnl: 0,
      realizedPnl: 0,
      currency: 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    await this.ensureAuth();
    const results: CloudQuoteInfo[] = [];
    if (symbols.length === 0) return results;

    try {
      const data = await this.schwabGet(`/marketdata/v1/quotes?symbols=${symbols.join(',')}`);
      for (const sym of symbols) {
        const q = data?.[sym]?.quote || data?.[sym]?.reference || data?.[sym];
        if (q) {
          results.push({
            brokerId: this.brokerId, symbol: sym,
            price: parseFloat(q.lastPrice || '0'),
            change: parseFloat(q.netChange || '0'),
            changePct: parseFloat(q.netPercentChange || '0'),
            volume: parseInt(q.totalVolume || '0'),
            high24h: parseFloat(q.highPrice || '0'),
            low24h: parseFloat(q.lowPrice || '0'),
            timestamp: Date.now(),
          });
        }
      }
    } catch {}
    return results;
  }

  async getDepth(_symbol: string, _limit = 10): Promise<CloudDepthSnapshot> {
    // Schwab does not expose L2 depth for individual traders
    return { brokerId: this.brokerId, symbol: _symbol, bids: [], asks: [], timestamp: Date.now() };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    await this.ensureAuth();
    const body = {
      orderType: req.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
      session: 'NORMAL',
      duration: 'DAY',
      orderStrategyType: 'SINGLE',
      orderLegCollection: [{
        instruction: req.side === 'BUY' ? 'BUY' : 'SELL',
        quantity: req.quantity,
        instrument: { symbol: req.symbol, assetType: 'EQUITY' },
      }],
    };

    if (req.orderType === 'LIMIT' && req.price) {
      (body as any).price = req.price;
    }

    // Schwab returns 201 with Location header
    const res = await this.schwabPost(`/trader/v1/accounts/${this.accountHash}/orders`, body);
    const orderId = res?.orderId?.toString() || '';

    return {
      brokerId: this.brokerId, orderId,
      clientOrderId: '', symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: 0, filledPrice: 0,
      status: 'NEW', createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.schwabDelete(`/trader/v1/accounts/${this.accountHash}/orders/${orderId}`);
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.schwabGet(`/trader/v1/accounts/${this.accountHash}/orders?status=WORKING`);
    return (data || []).map((o: any) => this.mapSchwabOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    // Schwab: get completed orders (last 60 days max)
    const data = await this.schwabGet(`/trader/v1/accounts/${this.accountHash}/orders?maxResults=${limit}&fromEnteredTime=${new Date(Date.now() - 60*86400000).toISOString()}&toEnteredTime=${new Date().toISOString()}&status=FILLED`);
    return (data || []).map((o: any) => this.mapSchwabOrder(o));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.schwabGet(`/trader/v1/accounts/${this.accountHash}`);
      const positions = data?.securitiesAccount?.positions || [];
      return positions.map((p: any) => ({
        brokerId: this.brokerId,
        symbol: p.instrument?.symbol || '',
        quantity: parseFloat(p.longQuantity || '0') - parseFloat(p.shortQuantity || '0'),
        avgCost: parseFloat(p.averagePrice || '0'),
        marketValue: parseFloat(p.marketValue || '0'),
        unrealizedPnl: parseFloat(p.unrealizedDayPnl || '0'),
        marketPrice: parseFloat(p.marketPrice || '0'),
        currency: 'USD', accountId: this.accountNumber,
      }));
    } catch { return []; }
  }

  subscribeQuotes(symbols: string[]): void {
    const poll = async () => {
      if (!this.connected) return;
      try {
        const quotes = await this.getQuotes(symbols);
        for (const q of quotes) this.quoteCallbacks.forEach((cb) => cb(q));
      } catch {}
      if (this.connected) setTimeout(poll, 4000);
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

  // ═══════════════ OAuth ═════════════════════════════════

  private async acquireAccessToken(): Promise<void> {
    // Try refresh token first
    if (this.refreshToken) {
      try {
        const data = await this.schwabTokenRequest({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.apiKey,
        });
        if (data?.access_token) {
          this.accessToken = data.access_token;
          if (data.refresh_token) this.refreshToken = data.refresh_token;
          this.tokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
          return;
        }
      } catch {}
    }

    // Fallback: require user to authorize (OAuth2 authorization code flow)
    // In production, use Electron redirect URI
    const authUrl = `${this.config.restBaseUrl}/v1/oauth/authorize?client_id=${this.config.apiKey}&redirect_uri=http://localhost:3000/callback&response_type=code`;
    throw new Error(`Schwab OAuth2 required. Authorize at: ${authUrl}`);
  }

  private async ensureAuth(): Promise<void> {
    if (!this.accessToken || Date.now() > this.tokenExpiry - 60000) {
      await this.acquireAccessToken();
    }
  }

  private async schwabTokenRequest(params: Record<string, string>): Promise<any> {
    const body = new URLSearchParams(params);
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString('base64');
    const res = await fetch(`${this.config.restBaseUrl}/v1/oauth/token`, {
      method: 'POST', body,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return res.json();
  }

  // ═══════════════ REST ══════════════════════════════════

  private async schwabGet(path: string): Promise<any> {
    return this.schwabRequest('GET', path);
  }

  private async schwabPost(path: string, body: any): Promise<any> {
    return this.schwabRequest('POST', path, body);
  }

  private async schwabDelete(path: string): Promise<any> {
    return this.schwabRequest('DELETE', path);
  }

  private async schwabRequest(method: string, path: string, body?: any): Promise<any> {
    await this.ensureAuth();
    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      // Token expired — try refresh once
      if (res.status === 401) {
        await this.acquireAccessToken();
        return this.schwabRequest(method, path, body);
      }
      throw new Error(`Schwab ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  private mapSchwabOrder(o: any): CloudOrderInfo {
    const leg = o.orderLegCollection?.[0] || {};
    return {
      brokerId: this.brokerId, orderId: o.orderId?.toString() || '',
      clientOrderId: o.clientOrderId, symbol: leg.instrument?.symbol || '',
      side: leg.instruction,
      orderType: o.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(leg.quantity || '0'),
      price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.filledQuantity || '0'),
      filledPrice: 0,
      status: o.status === 'FILLED' ? 'FILLED' : o.status === 'CANCELED' ? 'CANCELED' : o.status === 'REJECTED' ? 'REJECTED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  private emitError(e: Error): void { this.errorCallbacks.forEach((cb) => cb(e)); }
}
