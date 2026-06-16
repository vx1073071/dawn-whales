/**
 * QUANT MOO R133 J02 — Tiger Brokers Cloud Adapter
 * 
 * Implements ICloudBrokerAdapter for Tiger Brokers.
 * Uses Tiger HTTP SDK (tigerbrokers) — REST with RSA/HMAC signing.
 * 
 * Markets: HK stocks, US stocks, A-shares (SH/SZ via Stock Connect)
 * Tiger SDK: TypeScript SDK available (@tigerbrokers/api-client)
 * 
 * Auth: RSA private key + Tiger ID (account)
 * Signing: HMAC-SHA256 with private key
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

function tigerSign(timestamp: number, privateKeyPem: string, method: string, path: string, body: string): string {
  const prehash = `${timestamp}\n${method}\n${path}\n${body}`;
  return crypto.createSign('RSA-SHA256').update(prehash).sign(privateKeyPem, 'base64');
}

export class TigerAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private tigerAccount = '';
  private privateKeyPem = '';

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
    // Tiger requires RSA private key (not HMAC)
    this.privateKeyPem = (config.options?.privateKeyPem as string) || '';
    this.tigerAccount = (config.options?.tigerAccountId as string) || config.apiKey;
  }

  async connect(): Promise<void> {
    const hc = await this.healthCheck();
    if (!hc.ok) throw new Error('Tiger health check failed');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/trade/accounts`);
      return { ok: res.status < 500, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.tigerGet('/trade/assets', { account: this.tigerAccount });
    return {
      brokerId: this.brokerId, accountId: this.tigerAccount,
      totalEquity: parseFloat(data?.totalAssets || '0'),
      availableBalance: parseFloat(data?.totalCash || '0'),
      unrealizedPnl: parseFloat(data?.unrealizedPnl || '0'),
      realizedPnl: parseFloat(data?.realizedPnl || '0'),
      currency: data?.baseCurrency || 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const data = await this.tigerGet('/quote/stock/brief', { symbols: sym });
        const q = data?.items?.[0];
        if (q) {
          results.push({
            brokerId: this.brokerId, symbol: sym,
            price: parseFloat(q.latestPrice || q.last || '0'),
            change: parseFloat(q.change || '0'),
            changePct: parseFloat(q.pctChange || q.changePct || '0'),
            volume: parseInt(q.volume || '0'),
            high24h: parseFloat(q.high || '0'),
            low24h: parseFloat(q.low || '0'),
            timestamp: Date.now(),
          });
        }
      } catch {}
    }
    return results;
  }

  async getDepth(symbol: string, limit = 10): Promise<CloudDepthSnapshot> {
    try {
      const data = await this.tigerGet('/quote/depth/orderbook', { symbols: symbol, level: Math.min(limit, 10).toString() });
      const d = data?.items?.[0];
      return {
        brokerId: this.brokerId, symbol,
        bids: (d?.bidPrices || []).map((p: number, i: number) => [p, (d?.bidVolumes || [])[i] || 0]),
        asks: (d?.askPrices || []).map((p: number, i: number) => [p, (d?.askVolumes || [])[i] || 0]),
        timestamp: Date.now(),
      };
    } catch { return { brokerId: this.brokerId, symbol, bids: [], asks: [], timestamp: Date.now() }; }
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      account: this.tigerAccount,
      symbol: req.symbol,
      action: req.side,
      orderType: req.orderType === 'MARKET' ? 'MKT' : 'LMT',
      quantity: req.quantity,
      limitPrice: req.orderType === 'LIMIT' ? req.price : undefined,
    };
    const data = await this.tigerPost('/trade/order/place', body);
    const o = data;

    return {
      brokerId: this.brokerId, orderId: o?.id?.toString() || '',
      clientOrderId: o?.orderId, symbol: req.symbol,
      side: req.side, orderType: req.orderType,
      quantity: req.quantity, price: req.price || 0,
      filledQuantity: parseFloat(o?.filledQuantity || '0'),
      filledPrice: parseFloat(o?.avgFillPrice || '0'),
      status: o?.status === 'Filled' ? 'FILLED' : o?.status === 'Cancelled' ? 'CANCELED' : o?.status === 'Rejected' ? 'REJECTED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.tigerPost('/trade/order/delete', { account: this.tigerAccount, id: parseInt(orderId) });
    return true;
  }

  async getOpenOrders(_symbol?: string): Promise<CloudOrderInfo[]> {
    const data = await this.tigerGet('/trade/orders', { account: this.tigerAccount, status: 'Open' });
    return (data?.items || []).map((o: any) => this.mapTigerOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 50): Promise<CloudOrderInfo[]> {
    const data = await this.tigerGet('/trade/orders', { account: this.tigerAccount, status: 'All', limit: limit.toString() });
    return (data?.items || []).map((o: any) => this.mapTigerOrder(o));
  }

  async getPositions(): Promise<CloudPositionInfo[]> {
    try {
      const data = await this.tigerGet('/trade/positions', { account: this.tigerAccount });
      return (data?.items || []).map((p: any) => ({
        brokerId: this.brokerId, symbol: p.symbol || p.contractCode || '',
        quantity: parseFloat(p.quantity || p.position || '0'),
        avgCost: parseFloat(p.averageCost || p.cost || '0'),
        marketValue: parseFloat(p.marketValue || '0'),
        unrealizedPnl: parseFloat(p.unrealizedPnl || '0'),
        marketPrice: parseFloat(p.marketPrice || p.lastPrice || '0'),
        currency: p.currency || 'USD', accountId: this.tigerAccount,
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

  // ═══════════════ Private ═══════════════════════════════

  private async tigerGet(path: string, params: Record<string, string> = {}): Promise<any> {
    const qs = Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return this.tigerRequest('GET', qs ? `${path}?${qs}` : path);
  }

  private async tigerPost(path: string, body: any): Promise<any> {
    return this.tigerRequest('POST', path, body);
  }

  private async tigerRequest(method: string, path: string, body?: any): Promise<any> {
    const ts = Math.floor(Date.now() / 1000);
    const bodyStr = body ? JSON.stringify(body) : '';
    const sig = tigerSign(ts, this.privateKeyPem, method, path, bodyStr);

    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? bodyStr : undefined,
      headers: {
        'Authorization': `TIGER ${this.config.apiKey}:${sig}`,
        'Tiger-Timestamp': ts.toString(),
        'Content-Type': 'application/json', 'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Tiger ${res.status}`);
    return res.json();
  }

  private mapTigerOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: (o.id || o.orderId || '').toString(),
      clientOrderId: o.orderId, symbol: o.symbol || '',
      side: o.action, orderType: o.orderType === 'MKT' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.limitPrice || o.price || '0'),
      filledQuantity: parseFloat(o.filledQuantity || '0'),
      filledPrice: parseFloat(o.avgFillPrice || '0'),
      status: o.status === 'Filled' ? 'FILLED' : o.status === 'Cancelled' ? 'CANCELED' : o.status === 'Rejected' ? 'REJECTED' : 'NEW',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  private emitError(e: Error): void { this.errorCallbacks.forEach((cb) => cb(e)); }
}
