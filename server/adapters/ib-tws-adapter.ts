/**
 * DAWN WHALES R133 J01 — Interactive Brokers TWS Cloud Adapter
 * 
 * Implements ICloudBrokerAdapter for IB TWS via IB Gateway REST API.
 * Uses Client Portal REST API (localhost:5000/v1/api).
 * 
 * Auth: IB Gateway session-based (SSO/OAuth not needed for local gateway)
 * Markets: US stocks, options, futures
 * 
 * Special considerations:
 *  - IB uses conid (contract ID) not symbol strings
 *  - Account ID is in format U1234567
 *  - Position responses include assetClass, conid, currency
 *  - Orders use unique orderRef for client-side dedup
 */

import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

export class IBTwsAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private sessionAuth = false;
  private accountId = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
  }

  async connect(): Promise<void> {
    // IB Gateway requires SSO authentication first
    await this.authenticateGateway();
    const accounts = await this.ibGet('/portfolio/accounts');
    if (accounts?.length > 0) {
      this.accountId = accounts[0].accountId || accounts[0].id;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    try { await fetch(`${this.config.restBaseUrl}/v1/api/logout`, { method: 'POST' }); } catch {}
    this.connected = false;
    this.sessionAuth = false;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/v1/api/iserver/auth/status`);
      const data = await res.json();
      return { ok: res.ok && data?.authenticated === true, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected && this.sessionAuth; }

  async getAccount(): Promise<CloudAccountInfo> {
    const summary = await this.ibGet(`/portfolio/${this.accountId}/summary`);
    return {
      brokerId: this.brokerId, accountId: this.accountId,
      totalEquity: parseFloat(summary?.totalcashvalue?.amount || '0') + parseFloat(summary?.stockmarketvalue?.amount || '0'),
      availableBalance: parseFloat(summary?.availablefunds?.amount || '0'),
      unrealizedPnl: parseFloat(summary?.unrealizedpnl?.amount || '0'),
      realizedPnl: 0, currency: summary?.currency || 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    // IB: first search conid by symbol, then get market data snapshot
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const conid = await this.resolveConid(sym);
        if (!conid) continue;
        const data = await this.ibGet(`/iserver/marketdata/snapshot?conids=${conid}&fields=31,55,72,73,74,84,86`);
        const s = data?.[0];
        if (s) {
          results.push({
            brokerId: this.brokerId, symbol: sym,
            price: parseFloat(s[31] || s._31 || '0'),
            change: parseFloat(s[72] || s._72 || '0'),
            changePct: parseFloat(s[73] || s._73 || '0'),
            volume: parseInt(s[84] || s._84 || '0'),
            high24h: parseFloat(s[74] || s._74 || '0'),
            low24h: parseFloat(s[86] || s._86 || '0'),
            timestamp: Date.now(),
          });
        }
      } catch {}
    }
    return results;
  }

  async getDepth(_symbol: string, _limit = 10): Promise<CloudDepthSnapshot> {
    // IB TWS Client Portal does not expose L2 order book via REST
    return { brokerId: this.brokerId, symbol: _symbol, bids: [], asks: [], timestamp: Date.now() };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const conid = await this.resolveConid(req.symbol);
    if (!conid) throw new Error(`Cannot resolve IB conid for ${req.symbol}`);

    const body: any = {
      acctId: this.accountId,
      conid: parseInt(conid),
      secType: `${conid}@STK`,
      cOID: req.clientOrderId || `jvs-${Date.now()}`,
      orderType: req.orderType === 'MARKET' ? 'MKT' : 'LMT',
      side: req.side,
      quantity: req.quantity,
    };
    if (body.orderType === 'LMT') body.price = req.price;

    const data = await this.ibPost(`/iserver/account/${this.accountId}/orders`, { orders: [body] });
    const reply = data?.[0];

    return {
      brokerId: this.brokerId, orderId: reply?.order_id || reply?.id || '',
      clientOrderId: body.cOID, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: 0, filledPrice: 0,
      status: reply?.order_status === 'Cancelled' ? 'CANCELED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.ibDelete(`/iserver/account/${this.accountId}/order/${orderId}`);
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.ibGet(`/iserver/account/${this.accountId}/orders`);
    return (data?.orders || data?.live || []).map((o: any) => this.mapIbOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    // IB Client Portal returns both live and recent completed orders
    const data = await this.ibGet(`/iserver/account/orders?force=true`);
    return ((data?.orders || []).slice(0, limit)).map((o: any) => this.mapIbOrder(o));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.ibGet(`/portfolio/${this.accountId}/positions/0`);
      return (data || []).map((p: any) => ({
        brokerId: this.brokerId, symbol: p.contractDesc || p.ticker || '',
        quantity: parseFloat(p.position || '0'), avgCost: parseFloat(p.avgCost || p.avgPrice || '0'),
        marketValue: parseFloat(p.mktValue || '0'), unrealizedPnl: parseFloat(p.unrealizedPnl || '0'),
        marketPrice: parseFloat(p.mktPrice || '0'), currency: p.currency || 'USD',
        accountId: this.accountId,
      }));
    } catch { return []; }
  }

  subscribeQuotes(symbols: string[]): void {
    // IB: REST polling every 2s
    const poll = async () => {
      if (!this.connected) return;
      try {
        const quotes = await this.getQuotes(symbols);
        for (const q of quotes) this.quoteCallbacks.forEach((cb) => cb(q));
      } catch {}
      setTimeout(poll, 2000);
    };
    poll();
  }

  unsubscribeQuotes(_symbols: string[]): void { /* polling auto-stops on disconnect */ }
  subscribeDepth(_symbol: string): void { /* IB no L2 via REST */ }
  unsubscribeDepth(_symbol: string): void {}

  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = []; this.depthCallbacks = []; this.orderCallbacks = []; this.errorCallbacks = [];
  }

  // ═══════════════ Private ═══════════════════════════════

  private async authenticateGateway(): Promise<void> {
    const status = await this.ibGet('/iserver/auth/status');
    if (!status?.authenticated) {
      // Trigger SSO (IB Gateway port 5000 auto-opens login)
      await this.ibPost('/iserver/auth/ssodh/init', {});
      // Poll for auth completion (max 30s)
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const s = await this.ibGet('/iserver/auth/status');
        if (s?.authenticated) { this.sessionAuth = true; return; }
      }
      throw new Error('IB Gateway authentication timeout');
    }
    this.sessionAuth = true;
  }

  private async resolveConid(symbol: string): Promise<string | null> {
    try {
      const data = await this.ibGet(`/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}`);
      const results = data || [];
      const stock = results.find((r: any) => r.description === 'STK' || r.assetClass === 'STK');
      return stock?.conid?.toString() || results[0]?.conid?.toString() || null;
    } catch { return null; }
  }

  private async ibGet(path: string): Promise<any> {
    return this.ibRequest('GET', path);
  }

  private async ibPost(path: string, body: any): Promise<any> {
    return this.ibRequest('POST', path, body);
  }

  private async ibDelete(path: string): Promise<any> {
    return this.ibRequest('DELETE', path);
  }

  private async ibRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.config.restBaseUrl}/v1/api${path}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    if (!res.ok) {
      this.emitError(new Error(`IB ${res.status}: ${res.statusText}`));
      return null;
    }
    return res.json().catch(() => null);
  }

  private mapIbOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: o.orderId || o.order_id || '',
      clientOrderId: o.orderRef || o.cOID, symbol: o.contractDesc || o.localSymbol || '',
      side: o.side, orderType: o.orderType === 'MKT' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.totalQuantity || o.quantity || '0'),
      price: parseFloat(o.limitPrice || o.price || '0'),
      filledQuantity: parseFloat(o.filledQuantity || '0'),
      filledPrice: parseFloat(o.avgFillPrice || '0'),
      status: o.status === 'Filled' ? 'FILLED' : o.status === 'Cancelled' ? 'CANCELED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  private emitError(e: Error): void { this.errorCallbacks.forEach((cb) => cb(e)); }
}
