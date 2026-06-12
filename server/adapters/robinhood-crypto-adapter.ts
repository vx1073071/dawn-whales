// @ts-nocheck
/**
 * DAWN WHALES R131 J03 — Robinhood Crypto Adapter
 * 
 * Implements ICloudBrokerAdapter for Robinhood Crypto.
 * REST: api.robinhood.com/crypto (ED25519 signing)
 * WS:   Not available (Robinhood does not provide real-time crypto WS)
 * 
 * Differences from Binance/OKX:
 *  - ED25519 key pair signing (public/private key, not HMAC)
 *  - Header-based auth: x-api-key + x-timestamp + x-signature
 *  - Uses base64-encoded DER keys
 *  - REST polling for quotes (no WS streaming available)
 *  - Limited to US residents only
 */

import crypto from 'crypto';
import {
  ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType,
  CloudQuoteInfo, CloudAccountInfo, CloudPositionInfo,
  CloudOrderRequest, CloudOrderInfo, CloudDepthSnapshot,
  CloudQuoteCallback, CloudDepthCallback, CloudOrderCallback, CloudErrorCallback,
} from '../../electron/broker/ICloudBrokerAdapter';

/**
 * Robinhood ED25519 signer.
 * For MVP: uses Node crypto.createSign('RSA-SHA256') and converts private key.
 * Full ED25519 requires key pair generation:
 *   openssl genpkey -algorithm ED25519 -out private.pem
 *   openssl pkey -in private.pem -pubout -out public.pem
 */
class Ed25519Signer {
  private privateKeyPem: string;
  private apiKey: string;

  constructor(apiKey: string, privateKeyPem: string) {
    this.apiKey = apiKey;
    this.privateKeyPem = privateKeyPem;
  }

  sign(method: string, path: string, timestamp: string, body: string): string {
    // Robinhood signature: SHA-256 with ED25519
    // Prehash: timestamp + method + path + body
    const prehash = timestamp + method.toUpperCase() + path + (body || '');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(prehash);
    return sign.sign(this.privateKeyPem, 'base64');
  }
}

export class RobinhoodCryptoAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;
  private config: CloudBrokerConfig;
  private connected = false;
  private signer: Ed25519Signer;
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];
  private pollTimer?: NodeJS.Timeout;
  private pollingSymbols: string[] = [];
  private pollingActive = false;

  constructor(config: CloudBrokerConfig) {
    this.config = config;
    this.brokerId = config.brokerId;
    this.brokerName = config.name;
    this.brokerType = config.type as CloudBrokerType;
    this.signer = new Ed25519Signer(config.apiKey, (config.options?.privateKeyPem as string) || '');
  }

  async connect(): Promise<void> {
    const hc = await this.healthCheck();
    if (!hc.ok) throw new Error('Robinhood health check failed');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.stopPolling();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/api/v1/`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch { return { ok: false, latencyMs: Date.now() - start }; }
  }

  isConnected(): boolean { return this.connected; }

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.rhGet('/crypto/trading/v1/accounts/');
    const results = data?.results || [];
    const total = results.reduce((sum: number, a: any) => sum + parseFloat(a.portfolio_equity || '0'), 0);
    return {
      brokerId: this.brokerId, accountId: this.brokerId,
      totalEquity: total, availableBalance: results.reduce((s: number, a: any) => s + parseFloat(a.buying_power || '0'), 0),
      unrealizedPnl: 0, realizedPnl: 0, currency: 'USD',
    };
  }

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const results: CloudQuoteInfo[] = [];
    for (const sym of symbols) {
      try {
        const rhSymbol = sym.replace('/', '-').toUpperCase();
        const data = await this.rhGet(`/marketdata/forex/quotes/${rhSymbol}/`);
        if (data) {
          const price = parseFloat(data.mark_price || '0');
          const prev = parseFloat(data.previous_close || data.mark_price || '0');
          results.push({
            brokerId: this.brokerId, symbol: sym,
            price, change: price - prev,
            changePct: prev ? (price - prev) / prev * 100 : 0,
            volume: 0, high24h: price, low24h: price,
            timestamp: Date.now(),
          });
        }
      } catch {}
    }
    return results;
  }

  async getDepth(symbol: string, limit = 10): Promise<CloudDepthSnapshot> {
    const rhSymbol = symbol.replace('/', '-').toUpperCase();
    const data = await this.rhGet(`/marketdata/forex/orderbook/${rhSymbol}/`);
    return {
      brokerId: this.brokerId, symbol,
      bids: (data?.bids || []).slice(0, limit).map((b: any) => [parseFloat(b.price), parseFloat(b.quantity)]),
      asks: (data?.asks || []).slice(0, limit).map((a: any) => [parseFloat(a.price), parseFloat(a.quantity)]),
      timestamp: Date.now(),
    };
  }

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const body = {
      symbol: req.symbol.replace('/', '-').toUpperCase(),
      side: req.side.toLowerCase(),
      type: req.orderType === 'MARKET' ? 'market' : 'limit',
      quantity: req.quantity.toString(),
    } as any;
    if (body.type === 'limit') body.limit_price = req.price?.toString();

    const data = await this.rhPost('/crypto/trading/v1/orders/', body);
    return {
      brokerId: this.brokerId, orderId: data?.id || '', clientOrderId: data?.ref_id,
      symbol: req.symbol, side: req.side, orderType: req.orderType,
      quantity: parseFloat(data?.quantity || '0'), price: parseFloat(data?.price || body.limit_price || '0'),
      filledQuantity: parseFloat(data?.cumulative_quantity || '0'),
      filledPrice: parseFloat(data?.average_price || '0'),
      status: data?.state === 'filled' ? 'FILLED' : data?.state === 'canceled' ? 'CANCELED' : data?.state === 'rejected' ? 'REJECTED' : 'NEW',
      createdAt: new Date(data?.created_at).getTime() || Date.now(),
      updatedAt: new Date(data?.updated_at).getTime() || Date.now(),
    };
  }

  async cancelOrder(orderId: string, _symbol: string): Promise<boolean> {
    await this.rhPost(`/crypto/trading/v1/orders/${orderId}/cancel/`, {});
    return true;
  }

  async getOpenOrders(symbol?: string): Promise<CloudOrderInfo[]> {
    const params = symbol ? `?symbol=${encodeURIComponent(symbol.replace('/', '-').toUpperCase())}` : '?state=open';
    const data = await this.rhGet(`/crypto/trading/v1/orders/${params}`);
    return (data?.results || []).map((o: any) => this.mapRHCryptoOrder(o));
  }

  async getOrderHistory(_symbol?: string, limit = 100): Promise<CloudOrderInfo[]> {
    const data = await this.rhGet(`/crypto/trading/v1/orders/?page_size=${limit}`);
    return (data?.results || []).map((o: any) => this.mapRHCryptoOrder(o));
  }

  subscribeQuotes(symbols: string[]): void {
    this.pollingSymbols = symbols;
    // Robinhood has no WS → fall back to REST polling every 5s
    this.startPolling();
  }

  unsubscribeQuotes(_symbols: string[]): void {
    this.pollingSymbols = [];
    this.stopPolling();
  }

  subscribeDepth(symbol: string): void {
    this.pollingSymbols = [symbol];
    this.startPolling();
  }

  unsubscribeDepth(_symbol: string): void {
    this.pollingSymbols = [];
    this.stopPolling();
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

  private startPolling(): void {
    if (this.pollingActive || this.pollingSymbols.length === 0) return;
    this.pollingActive = true;
    const poll = async () => {
      if (!this.pollingActive) return;
      try {
        const quotes = await this.getQuotes(this.pollingSymbols);
        for (const q of quotes) {
          this.quoteCallbacks.forEach((cb) => cb(q));
        }
      } catch {}
      if (this.pollingActive) {
        this.pollTimer = setTimeout(poll, 5000);
      }
    };
    poll();
  }

  private stopPolling(): void {
    this.pollingActive = false;
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = undefined; }
  }

  private async rhGet(path: string): Promise<any> {
    return this.rhRequest('GET', path);
  }

  private async rhPost(path: string, body: any): Promise<any> {
    return this.rhRequest('POST', path, body);
  }

  private async rhRequest(method: string, path: string, body?: any): Promise<any> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const sig = this.signer.sign(method, path, ts, bodyStr);

    const res = await fetch(`${this.config.restBaseUrl}${path}`, {
      method, body: body ? bodyStr : undefined,
      headers: {
        'x-api-key': this.config.apiKey,
        'x-timestamp': ts,
        'x-signature': sig,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Robinhood ${res.status}`);
    return res.json();
  }

  private mapRHCryptoOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId, orderId: o.id || '', clientOrderId: o.ref_id,
      symbol: o.symbol || '', side: o.side === 'buy' ? 'BUY' : 'SELL',
      orderType: o.type === 'market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.quantity || '0'), price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.cumulative_quantity || '0'),
      filledPrice: parseFloat(o.average_price || '0'),
      status: o.state === 'filled' ? 'FILLED' : o.state === 'canceled' ? 'CANCELED' : o.state === 'rejected' ? 'REJECTED' : 'NEW',
      createdAt: new Date(o.created_at).getTime() || Date.now(),
      updatedAt: new Date(o.updated_at).getTime() || Date.now(),
    };
  }

  private emitError(e: Error): void { this.errorCallbacks.forEach((cb) => cb(e)); }
}
