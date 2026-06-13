/**
 * DAWN WHALES R153 J04 — Longbridge Cloud Adapter Skeleton
 *
 * Server-side adapter for Longbridge Securities.
 * Protocol: REST API via api.longbridge.com with JWT auth.
 *
 * Markets: HK stocks, US stocks, SG stocks, CN A-shares
 * Auth: Longbridge App Key + App Secret → JWT access token
 *
 * §Framework skeleton: implements ICloudBrokerAdapter.
 * Full implementation depends on Longbridge TypeScript SDK availability.
 * For now, HTTP REST fallback with JWT auth flow.
 *
 * ≥200L
 */

import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

export class LongbridgeAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private accessToken: string = '';
  private tokenExpiry: number = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private subscribedSymbols: Set<string> = new Set();

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name || 'Longbridge';
    this.brokerType = config.type as CloudBrokerType || 'ib';
  }

  // ═══════════ Connection ═════════════════════════════════

  async connect(): Promise<void> {
    try {
      await this.authenticate();
      const hc = await this.healthCheck();
      if (!hc.ok) throw new Error('Longbridge health check failed');
      this.connected = true;
    } catch (e: any) {
      this.emitError(new Error(`Longbridge connect failed: ${e.message}`));
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.accessToken = '';
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.subscribedSymbols.clear();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/v1/status`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected && this.tokenExpiry > Date.now(); }

  // ═══════════ Auth ══════════════════════════════════

  private async authenticate(): Promise<void> {
    const res = await fetch(`${this.config.restBaseUrl}/v1/trade/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key: this.config.apiKey,
        app_secret: this.config.secretKey,
      }),
    });
    if (!res.ok) throw new Error(`Longbridge auth failed: ${res.status}`);
    const data = await res.json();
    this.accessToken = data?.access_token || '';
    this.tokenExpiry = Date.now() + (data?.expires_in || 3600) * 1000;
  }

  private get authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  // ═══════════ Account ══════════════════════════════════

  async getAccount(): Promise<CloudAccountInfo> {
    try {
      const data = await this.lbGet('/v1/asset/account');
      return {
        brokerId: this.brokerId,
        accountId: data?.account?.accountId || '',
        totalEquity: parseFloat(data?.account?.totalNetAsset || '0'),
        availableBalance: parseFloat(data?.account?.withdrawableCash || '0'),
        unrealizedPnl: parseFloat(data?.account?.unrealizedPnl || '0'),
        realizedPnl: parseFloat(data?.account?.realizedPnl || '0'),
        currency: data?.account?.baseCurrency || 'HKD',
      };
    } catch {
      return { brokerId: this.brokerId, accountId: '', totalEquity: 0,
        availableBalance: 0, unrealizedPnl: 0, realizedPnl: 0, currency: 'HKD' };
    }
  }

  // ═══════════ Quotes ══════════════════════════════════

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    if (symbols.length === 0) return [];
    try {
      const symStr = symbols.join(',');
      const data = await this.lbGet(`/v1/stock/quote?symbols=${encodeURIComponent(symStr)}`);
      return (data?.quotes || data?.items || []).map((q: any) => ({
        brokerId: this.brokerId,
        symbol: q.symbol || '',
        price: parseFloat(q.latestPrice || q.lastPrice || q.close || '0'),
        change: 0, changePct: 0,
        volume: parseInt(q.volume || '0'),
        high24h: parseFloat(q.high || '0'),
        low24h: parseFloat(q.low || '0'),
        timestamp: Date.now(),
      }));
    } catch (e: any) {
      this.emitError(new Error(`Longbridge getQuotes: ${e.message}`));
      return [];
    }
  }

  async getKlines(symbol: string, period: string = 'day', count: number = 100): Promise<any[]> {
    try {
      const data = await this.lbGet(
        `/v1/stock/kline?symbol=${encodeURIComponent(symbol)}&period=${period}&count=${count}`
      );
      return (data?.klines || data?.items || []).map((k: any) => ({
        time: k.timestamp || k.date,
        open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume,
      }));
    } catch { return []; }
  }

  async getDepth(_symbol: string, _limit = 10): Promise<CloudDepthSnapshot> {
    try {
      const data = await this.lbGet(
        `/v1/stock/depth?symbol=${encodeURIComponent(_symbol)}&limit=${_limit}`
      );
      const bids: [number, number][] = (data?.bids || []).map((b: any) => [b.price, b.quantity]);
      const asks: [number, number][] = (data?.asks || []).map((a: any) => [a.price, a.quantity]);
      return { brokerId: this.brokerId, symbol: _symbol, bids, asks, timestamp: Date.now() };
    } catch {
      return { brokerId: this.brokerId, symbol: _symbol, bids: [], asks: [], timestamp: Date.now() };
    }
  }

  // ═══════════ Orders ══════════════════════════════════

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    try {
      const data = await this.lbPost('/v1/trade/order', {
        symbol: req.symbol,
        side: req.side,
        orderType: req.orderType === 'MARKET' ? 'MO' : 'LO',
        submittedQuantity: req.quantity,
        submittedPrice: req.price,
      });
      return {
        brokerId: this.brokerId, orderId: data?.orderId || '',
        clientOrderId: req.clientOrderId, symbol: req.symbol,
        side: req.side, orderType: req.orderType,
        quantity: req.quantity, price: req.price || 0,
        filledQuantity: 0, filledPrice: 0,
        status: data?.status === 'FILLED' ? 'FILLED' : 'NEW',
        createdAt: Date.now(), updatedAt: Date.now(),
      };
    } catch {
      return { brokerId: this.brokerId, orderId: '', symbol: req.symbol,
        side: req.side, orderType: req.orderType, quantity: 0, price: 0,
        filledQuantity: 0, filledPrice: 0, status: 'REJECTED',
        createdAt: Date.now(), updatedAt: Date.now() };
    }
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    try { await this.lbDelete(`/v1/trade/order/${orderId}`); return true; }
    catch { return false; }
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    try {
      const data = await this.lbGet('/v1/trade/orders?status=OPEN');
      return (data?.orders || []).map((o: any) => ({
        brokerId: this.brokerId, orderId: o.orderId || '',
        symbol: o.symbol || '', side: o.side || 'BUY',
        orderType: o.orderType === 'MO' ? 'MARKET' : 'LIMIT',
        quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.price || '0'),
        filledQuantity: parseFloat(o.filledQuantity || '0'),
        filledPrice: parseFloat(o.filledPrice || '0'),
        status: o.status === 'FILLED' ? 'FILLED' : o.status === 'CANCELED' ? 'CANCELED' : 'NEW',
        createdAt: Date.now(), updatedAt: Date.now(),
      }));
    } catch { return []; }
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    try {
      const data = await this.lbGet(`/v1/trade/orders?limit=${limit}`);
      return (data?.orders || []).map((o: any) => ({
        brokerId: this.brokerId, orderId: o.orderId || '',
        symbol: o.symbol || '', side: o.side || 'BUY',
        orderType: o.orderType === 'MO' ? 'MARKET' : 'LIMIT',
        quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.price || '0'),
        filledQuantity: parseFloat(o.filledQuantity || '0'),
        filledPrice: parseFloat(o.filledPrice || '0'),
        status: o.status === 'FILLED' ? 'FILLED' : o.status === 'CANCELED' ? 'CANCELED' : 'NEW',
        createdAt: Date.now(), updatedAt: Date.now(),
      }));
    } catch { return []; }
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.lbGet('/v1/asset/position');
      return (data?.positions || []).map((p: any) => ({
        brokerId: this.brokerId,
        symbol: p.symbol || '',
        quantity: parseFloat(p.quantity || '0'),
        entryPrice: parseFloat(p.costPrice || '0'),
        markPrice: parseFloat(p.marketPrice || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPnl || '0'),
      }));
    } catch { return []; }
  }

  // ═══════════ Subscriptions ═════════════════════════

  subscribeQuotes(symbols: string[]): void {
    for (const s of symbols) this.subscribedSymbols.add(s);
    if (!this.pollTimer) {
      this.pollTimer = setInterval(async () => {
        if (!this.connected || this.subscribedSymbols.size === 0) return;
        try {
          const quotes = await this.getQuotes(Array.from(this.subscribedSymbols));
          for (const q of quotes) this.quoteCallbacks.forEach(cb => cb(q));
        } catch {}
      }, 3000);
    }
  }

  unsubscribeQuotes(symbols: string[]): void {
    for (const s of symbols) this.subscribedSymbols.delete(s);
    if (this.subscribedSymbols.size === 0 && this.pollTimer) {
      clearInterval(this.pollTimer); this.pollTimer = null;
    }
  }

  subscribeDepth(_symbol: string): void {}
  unsubscribeDepth(_symbol: string): void {}

  onQuote(cb: CloudQuoteCallback): void { this.quoteCallbacks.push(cb); }
  onDepth(cb: CloudDepthCallback): void { this.depthCallbacks.push(cb); }
  onOrderUpdate(cb: CloudOrderCallback): void { this.orderCallbacks.push(cb); }
  onError(cb: CloudErrorCallback): void { this.errorCallbacks.push(cb); }

  dispose(): void {
    this.disconnect();
    this.quoteCallbacks = []; this.depthCallbacks = [];
    this.orderCallbacks = []; this.errorCallbacks = [];
  }

  // ═══════════ Private ═══════════════════════════════

  private async lbGet(path: string): Promise<any> {
    return this.lbRequest('GET', path);
  }

  private async lbPost(path: string, body?: any): Promise<any> {
    return this.lbRequest('POST', path, body);
  }

  private async lbDelete(path: string): Promise<any> {
    return this.lbRequest('DELETE', path);
  }

  private async lbRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method,
      headers: this.authHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Longbridge ${res.status}`);
    return res.json().catch(() => null);
  }

  private emitError(e: Error): void {
    this.errorCallbacks.forEach(cb => cb(e));
  }
}
