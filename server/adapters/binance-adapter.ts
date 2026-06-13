// @ts-nocheck
/**
 * DAWN WHALES R130 J01 — Binance Cloud Broker Adapter
 * 
 * Implements ICloudBrokerAdapter for Binance Spot.
 * REST: api.binance.com (HMAC-SHA256 signing)
 * WS:   stream.binance.com (WebSocket streaming)
 * 
 * Rate limits: 1200 req/min (no API key) / 6000 req/min (VIP)
 * Exchanges use UPLOADS weighting system
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

// ═══════════════ Signing ═══════════════════════════════════

function sign(queryString: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

// ═══════════════ Binance Adapter ══════════════════════════

export class BinanceAdapter implements ICloudBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;

  private config: CloudBrokerConfig;
  private connected = false;

  // Callback lists
  private quoteCallbacks: CloudQuoteCallback[] = [];
  private depthCallbacks: CloudDepthCallback[] = [];
  private orderCallbacks: CloudOrderCallback[] = [];
  private errorCallbacks: CloudErrorCallback[] = [];

  // WS connections
  private quoteWs?: WebSocket;
  private depthWs?: WebSocket;
  private userDataWs?: WebSocket;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  // R153: 增强健壮性 — 自动重连计数 + 延迟统计
  private errorCount = 0;
  private lastQuoteTs = 0;
  private reconnectCount = 0;
  private maxReconnectAttempts = 10;
  private subscribedQuoteStreams: string[] = [];
  private activeDepthSymbol: string | null = null;

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
      if (!hc.ok) throw new Error('Binance health check failed');
      this.connected = true;
    } catch (e: any) {
      this.emitError(new Error(`Binance connect failed: ${e.message}`));
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.cleanupWebSockets();
    this.reconnectTimers.forEach((t) => clearTimeout(t));
    this.reconnectTimers.clear();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.config.restBaseUrl}/api/v3/ping`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ═══════════════ Account ═══════════════════════════════

  async getAccount(): Promise<CloudAccountInfo> {
    const data = await this.signedGet('/api/v3/account');
    const balances = data.balances || [];
    const totalEquity = balances.reduce((sum: number, b: any) => {
      return sum + parseFloat(b.free) * this.getUsdtPrice(b.asset);
    }, 0);

    return {
      brokerId: this.brokerId,
      accountId: this.brokerId,
      totalEquity,
      availableBalance: parseFloat(balances.find((b: any) => b.asset === 'USDT')?.free || '0'),
      unrealizedPnl: 0,
      realizedPnl: 0,
      currency: 'USDT',
    };
  }

  // ═══════════════ Quotes ════════════════════════════════

  async getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]> {
    const symbolsParam = JSON.stringify(symbols.map((s) => s.replace('/', '')));
    const data = await this.publicGet('/api/v3/ticker/24hr', `symbols=${encodeURIComponent(symbolsParam)}`);

    if (!Array.isArray(data)) return [];

    return data.map((t: any) => ({
      brokerId: this.brokerId,
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.priceChange),
      changePct: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.volume),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      timestamp: t.closeTime || Date.now(),
    }));
  }

  async getDepth(symbol: string, limit = 20): Promise<CloudDepthSnapshot> {
    const cleanSymbol = symbol.replace('/', '');
    const data = await this.publicGet('/api/v3/depth', `symbol=${cleanSymbol}&limit=${limit}`);

    return {
      brokerId: this.brokerId,
      symbol,
      bids: (data.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: data.lastUpdateId || Date.now(),
    };
  }

  // ═══════════════ Orders ════════════════════════════════

  async placeOrder(req: CloudOrderRequest): Promise<CloudOrderInfo> {
    const cleanSymbol = req.symbol.replace('/', '');
    const side = req.side === 'BUY' ? 'BUY' : 'SELL';
    const type = req.orderType === 'MARKET' ? 'MARKET' : 'LIMIT';

    const params: Record<string, string> = {
      symbol: cleanSymbol,
      side,
      type,
      quantity: req.quantity.toString(),
    };
    if (type === 'LIMIT' && req.price) params.price = req.price.toString();
    if (req.stopPrice) {
      params.stopPrice = req.stopPrice.toString();
    }
    if (req.clientOrderId) params.newClientOrderId = req.clientOrderId;

    const data = await this.signedPost('/api/v3/order', params);

    return {
      brokerId: this.brokerId,
      orderId: data.orderId?.toString() || '',
      clientOrderId: data.clientOrderId,
      symbol: req.symbol,
      side: req.side,
      orderType: req.orderType,
      quantity: parseFloat(data.origQty || req.quantity),
      price: parseFloat(data.price || req.price || '0'),
      filledQuantity: parseFloat(data.executedQty || '0'),
      filledPrice: parseFloat(data.cummulativeQuoteQty || '0') / (parseFloat(data.executedQty || '1')),
      status: this.mapBinanceOrderStatus(data.status),
      createdAt: data.transactTime || Date.now(),
      updatedAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    const cleanSymbol = symbol.replace('/', '');
    await this.signedDelete('/api/v3/order', { symbol: cleanSymbol, orderId });
    return true;
  }

  async getOpenOrders(symbol?: string): Promise<CloudOrderInfo[]> {
    const params: Record<string, string> = {};
    if (symbol) params.symbol = symbol.replace('/', '');
    const data = await this.signedGet('/api/v3/openOrders', params);
    if (!Array.isArray(data)) return [];
    return data.map((o: any) => this.mapBinanceOrder(o));
  }

  async getOrderHistory(symbol?: string, limit = 500): Promise<CloudOrderInfo[]> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (symbol) params.symbol = symbol.replace('/', '');
    const data = await this.signedGet('/api/v3/allOrders', params);
    if (!Array.isArray(data)) return [];
    return data.map((o: any) => this.mapBinanceOrder(o));
  }

  // ═══════════════ Subscriptions ═════════════════════════

  subscribeQuotes(symbols: string[]): void {
    const streams = symbols.map((s) => `${s.replace('/', '').toLowerCase()}@ticker`).join('/');
    this.subscribedQuoteStreams = streams.split('/');
    this.reconnectCount = 0;
    this.connectQuoteStream(streams);
  }

  unsubscribeQuotes(symbols: string[]): void {
    if (this.quoteWs) this.quoteWs.close();
  }

  subscribeDepth(symbol: string): void {
    const stream = `${symbol.replace('/', '').toLowerCase()}@depth20@100ms`;
    this.depthWs = this.createWs(`wss://stream.binance.com:9443/ws/${stream}`, 'depth');
    this.depthWs.on('message', (raw) => {
      try {
        const d = JSON.parse(raw.toString());
        this.depthCallbacks.forEach((cb) => cb({
          brokerId: this.brokerId,
          symbol,
          bids: (d.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
          asks: (d.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
          timestamp: d.E || Date.now(),
        }));
      } catch {}
    });
  }

  unsubscribeDepth(_symbol: string): void {
    if (this.depthWs) this.depthWs.close();
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

  // ═══════════════ Private ═══════════════════════════════

  private connectQuoteStream(streams: string): void {
    this.quoteWs = this.createWs(`wss://stream.binance.com:9443/ws/${streams}`, 'quote');
    this.quoteWs.on('message', (raw) => {
      try {
        this.errorCount = 0; // Reset error counter on success
        this.lastQuoteTs = Date.now();
        const t = JSON.parse(raw.toString());
        const quote: CloudQuoteInfo = {
          brokerId: this.brokerId,
          symbol: t.s,
          price: parseFloat(t.c),
          change: parseFloat(t.p),
          changePct: parseFloat(t.P),
          volume: parseFloat(t.v),
          high24h: parseFloat(t.h),
          low24h: parseFloat(t.l),
          timestamp: t.E || Date.now(),
        };
        this.quoteCallbacks.forEach((cb) => cb(quote));
      } catch { this.errorCount++; }
    });
  }

  private createWs(url: string, label: string): WebSocket {
    const ws = new WebSocket(url);
    ws.on('error', (e) => {
      this.emitError(new Error(`Binance ${label} WS error: ${e.message}`));
    });
    ws.on('close', () => {
      if (this.connected && this.reconnectCount < this.maxReconnectAttempts) {
        this.reconnectCount++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000);
        console.warn(`[BinanceAdapter] ${label} WS closed, reconnecting #${this.reconnectCount} in ${delay}ms`);
        const streams = this.subscribedQuoteStreams.join('/');
        const timer = setTimeout(() => this.connectQuoteStream(streams), delay);
        this.reconnectTimers.set(label, timer as any);
      } else {
        this.emitError(new Error(`Binance ${label} WS closed — max reconnects exceeded`));
      }
    });
    return ws;
  }

  private cleanupWebSockets(): void {
    [this.quoteWs, this.depthWs, this.userDataWs].forEach((ws) => {
      if (ws) {
        try { ws.close(); } catch {}
      }
    });
  }

  private emitError(e: Error): void {
    this.errorCallbacks.forEach((cb) => cb(e));
  }

  // ═══════════════ REST Helpers ══════════════════════════

  private async publicGet(endpoint: string, query = ''): Promise<any> {
    const url = query 
      ? `${this.config.restBaseUrl}${endpoint}?${query}`
      : `${this.config.restBaseUrl}${endpoint}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Binance API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private async signedGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    params.timestamp = Date.now().toString();
    const qs = this.buildQuery(params);
    const signature = sign(qs, this.config.secretKey);
    const url = `${this.config.restBaseUrl}${endpoint}?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      headers: { 'X-MBX-APIKEY': this.config.apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Binance API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private async signedPost(endpoint: string, params: Record<string, string>): Promise<any> {
    params.timestamp = Date.now().toString();
    const qs = this.buildQuery(params);
    const signature = sign(qs, this.config.secretKey);
    const url = `${this.config.restBaseUrl}${endpoint}?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': this.config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) throw new Error(`Binance API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private async signedDelete(endpoint: string, params: Record<string, string>): Promise<any> {
    params.timestamp = Date.now().toString();
    const qs = this.buildQuery(params);
    const signature = sign(qs, this.config.secretKey);
    const url = `${this.config.restBaseUrl}${endpoint}?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-MBX-APIKEY': this.config.apiKey },
    });
    if (!res.ok) throw new Error(`Binance API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private buildQuery(params: Record<string, string>): string {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .sort()
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  private mapBinanceOrder(o: any): CloudOrderInfo {
    return {
      brokerId: this.brokerId,
      orderId: o.orderId?.toString() || '',
      clientOrderId: o.clientOrderId,
      symbol: o.symbol,
      side: o.side === 'BUY' ? 'BUY' : 'SELL',
      orderType: o.type === 'MARKET' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(o.origQty || '0'),
      price: parseFloat(o.price || '0'),
      filledQuantity: parseFloat(o.executedQty || '0'),
      filledPrice: parseFloat(o.cummulativeQuoteQty || '0') / (parseFloat(o.executedQty || '1')),
      status: this.mapBinanceOrderStatus(o.status),
      createdAt: o.time || Date.now(),
      updatedAt: o.updateTime || Date.now(),
    };
  }

  private mapBinanceOrderStatus(status: string): CloudOrderInfo['status'] {
    const map: Record<string, CloudOrderInfo['status']> = {
      'NEW': 'NEW',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      'FILLED': 'FILLED',
      'CANCELED': 'CANCELED',
      'REJECTED': 'REJECTED',
      'EXPIRED': 'EXPIRED',
    };
    return map[status] || 'NEW';
  }

  private getUsdtPrice(asset: string): number {
    // Simplified: major assets hardcoded for MVP
    const prices: Record<string, number> = {
      'USDT': 1, 'USDC': 1, 'BUSD': 1,
      'BTC': 85000, 'ETH': 3200, 'BNB': 580,
    };
    return prices[asset] || 0;
  }
}
