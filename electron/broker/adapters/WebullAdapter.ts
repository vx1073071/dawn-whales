— R119 QClaw: structural type errors pending resolution by JVS/PM
// ── QUANT MOO — WebullAdapter ─────────────────────────────────────────
// R3 OAU-04: Webull Broker Adapter
// Inherits OAuthBrokerBase (OAuth2 Authorization Code)
// Markets: US equities, ETFs, options
// Features: Paper trading sandbox, fractional shares, extended hours

import log from 'electron-log';
import { OAuthBrokerBase, type OAuthBrokerConfig, type OAuthVersion } from './OAuthBrokerBase';
import type { QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../IBrokerAdapter';
import type { MarketType, TradingPairInfo } from '../IBrokerAdapterV2';

export interface WebullConfig extends OAuthBrokerConfig {
  type: 'webull';
  clientId: string;
  clientSecret: string;
  paperTrading?: boolean;       // default: true (paper = safer dev)
  deviceId?: string;            // required for API auth
}

const DEFAULT_WEBULL_CONFIG: Partial<WebullConfig> = {
  type: 'webull',
  authUrl: 'https://api.webull.com/oauth/authorize',
  tokenUrl: 'https://api.webull.com/oauth/token',
  baseApiUrl: 'https://api.webull.com',
  scopes: ['read', 'trade'],
  redirectUri: 'http://localhost:8184/callback',
  paperTrading: true,
};

// ═══════════════════════════════════════════════════════════
// Webull API Response Types
// ═══════════════════════════════════════════════════════════

interface WebullAccount {
  accountId: string;
  accountType: 'CASH' | 'MARGIN' | 'PAPER';
  currency: string;
  netLiquidation: number;
  totalMarketValue: number;
  cashBalance: number;
  availableCash: number;
  buyingPower: number;
  dayTrades: number;
}

interface WebullPosition {
  tickerId: number;
  symbol: string;
  name: string;
  positionType: 'stock' | 'option';
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  percentage: number;
  currency: string;
}

interface WebullQuote {
  tickerId: number;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  preClose: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  time: string;
  status: string;
}

interface WebullKline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface WebullOrder {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LMT' | 'MKT' | 'STP' | 'STP_LMT' | 'TRAIL';
  totalQuantity: number;
  filledQuantity: number;
  limitPrice: number;
  stopPrice: number;
  filledAvgPrice: number;
  status: 'Working' | 'Filled' | 'Cancelled' | 'Rejected' | 'PartiallyFilled' | 'Pending';
  createTime: string;
  updateTime: string;
  timeInForce: 'GTC' | 'DAY' | 'IOC';
}

interface WebullOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  tif: 'GTC' | 'DAY' | 'IOC';
  orderType: 'LMT' | 'MKT' | 'STP' | 'STP_LMT' | 'TRAIL';
  quantity: number;
  lmtPrice?: number;
  auxPrice?: number;           // stop price
  outsideRegularTradingHours?: boolean;
}

// ═══════════════════════════════════════════════════════════
// WebullAdapter
// ═══════════════════════════════════════════════════════════

export class WebullAdapter extends OAuthBrokerBase {
  declare protected config: WebullConfig;
  private deviceId: string;

  constructor(config: Partial<WebullConfig> & Pick<WebullConfig, 'id' | 'name' | 'clientId' | 'clientSecret'>) {
    const merged: WebullConfig = { ...DEFAULT_WEBULL_CONFIG, ...config } as WebullConfig;
    super(merged as OAuthBrokerConfig);
    this.config = merged;
    this.deviceId = merged.deviceId || this._generateDeviceId();
  }

  protected _oauthVersion(): OAuthVersion { return '2.0'; }
  protected _buildAuthHeaders(h: Record<string, string>): Record<string, string> {
    h['x-device-id'] = this.deviceId;
    return h;
  }

  private _generateDeviceId(): string {
    const chars = 'abcdef0123456789';
    let id = '';
    for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }

  // ═══ Override auth request for Webull-specific headers ═════
  protected async _makeAuthRequest(method: string, path: string, body?: any): Promise<any> {
    if (!this.token) throw new Error('Not authorized');

    const url = `${this.config.baseApiUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token.accessToken}`,
      'Content-Type': 'application/json',
      'x-device-id': this.deviceId,
      'x-paper-trading': this.config.paperTrading ? 'true' : 'false',
    };

    const bodyStr = body ? JSON.stringify(body) : undefined;

    const res = await fetch(url, { method, headers, body: bodyStr, signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Webull HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    return res.json();
  }

  // ═══ Abstract: Path Builders ════════════════════════════
  protected _quotePath(codes: string[]): string {
    const symbols = codes.map(c => c.replace(/^US\./, '')).join(',');
    return `/market/quotes?symbols=${symbols}`;
  }

  protected _klinePath(code: string, period: string, count: number): string {
    const symbol = code.replace(/^US\./, '');
    const typeMap: Record<string, string> = {
      '1D': 'm1', '1W': 'm15', '1M': 'm60', '1Y': 'd1', 'ALL': 'w1',
    };
    return `/market/kline/${symbol}?type=${typeMap[period] || 'd1'}&count=${count}`;
  }

  protected _buildOrderBody(order: PlaceOrderRequest): WebullOrderRequest {
    const symbol = order.code.replace(/^US\./, '');
    const typeMap: Record<string, WebullOrderRequest['orderType']> = {
      'MARKET': 'MKT', 'LIMIT': 'LMT', 'STOP': 'STP',
      'STOP_LIMIT': 'STP_LMT', 'TRAILING_STOP': 'TRAIL',
    };
    return {
      symbol,
      side: order.side,
      tif: ((order as any).timeInForce as WebullOrderRequest['tif']) || 'DAY',
      orderType: typeMap[order.orderType] || 'LMT',
      quantity: order.qty,
      lmtPrice: order.price,
      auxPrice: (order as any).stopPrice || 0,
      outsideRegularTradingHours: (order as any).extendedHours || false,
    };
  }

  // ═══ Abstract: Data Parsers ══════════════════════════════
  protected _parseQuotes(data: any): QuoteInfo[] {
    const quotes: WebullQuote[] = Array.isArray(data) ? data : (data?.quotes || [data]);
    return quotes.map(q => ({
      code: `US.${q.symbol}`,
      price: q.price || 0,
      change: q.change || 0,
      changePct: q.changePercent || 0,
      volume: q.volume || 0,
      turnover: 0,
      high: q.high || 0,
      low: q.low || 0,
      open: q.open || 0,
      prevClose: q.preClose || 0,
      time: q.time || new Date().toISOString(),
    }));
  }

  protected _parseKlines(data: any): KlineInfo[] {
    const candles: WebullKline[] = data?.klines || data?.candles || (Array.isArray(data) ? data : []);
    return candles.map(c => ({
      time: new Date(c.timestamp * 1000).toISOString(),
      open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
    }));
  }

  protected _parseAccounts(data: any): AccountInfo[] {
    const accounts: WebullAccount[] = Array.isArray(data) ? data : (data?.accounts || [data]);
    return accounts.map(a => ({
      accountId: a.accountId,
      name: `Webull ${a.accountType} ${a.accountId.slice(-4)}`,
      currency: a.currency || 'USD',
      netAssets: a.netLiquidation || 0,
      totalAssets: a.totalMarketValue || 0,
      cash: a.cashBalance || 0,
      marketValue: a.totalMarketValue || 0,
    }));
  }

  protected _parseFunds(data: any): FundsInfo {
    const a: WebullAccount = data?.accounts?.[0] || data;
    return {
      totalAssets: a.netLiquidation || 0,
      cash: a.cashBalance || 0,
      marketValue: a.totalMarketValue || 0,
      frozenCash: (a.cashBalance || 0) - (a.availableCash || 0),
      availableCash: a.availableCash || a.cashBalance || 0,
      currency: a.currency || 'USD',
    };
  }

  protected _parsePositions(data: any): PositionInfo[] {
    const positions: WebullPosition[] = Array.isArray(data) ? data : (data?.positions || []);
    const total = positions.reduce((s, p) => s + p.marketValue, 0) || 1;
    return positions.map(p => ({
      code: `US.${p.symbol}`,
      name: p.name || p.symbol,
      qty: p.quantity || 0,
      costPrice: p.averageCost || 0,
      marketPrice: p.marketPrice || 0,
      marketValue: p.marketValue || 0,
      pnl: p.unrealizedPnl || 0,
      pnlPct: p.unrealizedPnlPercent || 0,
      ratio: total > 0 ? p.marketValue / total : 0,
    }));
  }

  protected _parseOrders(data: any): OrderInfo[] {
    const orders: WebullOrder[] = Array.isArray(data) ? data : (data?.orders || []);
    const statusMap: Record<string, OrderInfo['status']> = {
      'Working': 'SUBMITTED', 'Pending': 'PENDING', 'Filled': 'FILLED',
      'PartiallyFilled': 'PARTIALLY_FILLED', 'Cancelled': 'CANCELLED', 'Rejected': 'REJECTED',
    };
    const typeMap: Record<string, OrderInfo['orderType']> = {
      'LMT': 'LIMIT', 'MKT': 'MARKET', 'STP': 'STOP', 'STP_LMT': 'STOP_LIMIT', 'TRAIL': 'TRAILING_STOP',
    };
    return orders.map(o => ({
      orderId: o.orderId,
      code: `US.${o.symbol}`,
      side: o.side,
      orderType: typeMap[o.orderType] || 'MARKET',
      qty: o.totalQuantity || 0,
      price: o.limitPrice || o.stopPrice || o.filledAvgPrice || 0,
      filledQty: o.filledQuantity || 0,
      filledPrice: o.filledAvgPrice || 0,
      status: statusMap[o.status] || 'PENDING',
      createdAt: o.createTime || new Date().toISOString(),
    }));
  }

  protected _parseOrderResult(data: any): { orderId: string } {
    return { orderId: String(data?.orderId || data?.order_id || `webull-${Date.now()}`) };
  }

  // ═══ Override account methods ════════════════════════════
  async getAccounts(): Promise<AccountInfo[]> {
    const data = await this._makeAuthRequest('GET', `/trade/accounts`);
    return this._parseAccounts(data);
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const data = await this._makeAuthRequest('GET', `/trade/accounts/${accountId || ''}`);
    return this._parseFunds(data);
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const data = await this._makeAuthRequest('GET', `/trade/accounts/${accountId || ''}/positions`);
    return this._parsePositions(data);
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    try {
      const data = await this._makeAuthRequest('GET', `/trade/accounts/${accountId || ''}/orders?status=all&limit=50`);
      return this._parseOrders(data);
    } catch { return []; }
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const body = this._buildOrderBody(order);
    const acctId = order.accountId || '';
    const data = await this._makeAuthRequest('POST', `/trade/accounts/${acctId}/orders`, body);
    return this._parseOrderResult(data);
  }

  async cancelOrder(orderId: string, accountId: string): Promise<void> {
    const acctId = accountId || '';
    await this._makeAuthRequest('DELETE', `/trade/accounts/${acctId}/orders/${orderId}`);
  }

  // ═══ Webull-specific features ══════════════════════════
  /** Switch between paper and real trading */
  setPaperMode(enabled: boolean): void {
    this.config.paperTrading = enabled;
    log.info(`[Webull] Paper trading: ${enabled}`);
  }

  /** Get extended hours quote */
  async getExtendedHoursQuote(symbol: string): Promise<any> {
    return this._makeAuthRequest('GET', `/market/extended/${symbol.replace(/^US\./, '')}`);
  }

  /** Search instruments */
  async searchInstruments(query: string): Promise<any> {
    return this._makeAuthRequest('GET', `/search?q=${encodeURIComponent(query)}`);
  }

  // ═══ V2 Extensions ═════════════════════════════════════
  getMarkets(): MarketType[] { return ['US']; }

  getSupportedOrderTypes() {
    return ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP'] as const;
  }

  getBrokerType() { return 'webull' as const; }

  async getTradingPairs(): Promise<TradingPairInfo[]> {
    const data = await this._makeAuthRequest('GET', '/market/instruments');
    const items = Array.isArray(data) ? data : [];
    return items.slice(0, 200).map((i: any) => ({
      symbol: i.symbol || '',
      baseAsset: i.symbol || '',
      quoteAsset: 'USD',
      minQty: 1, maxQty: 999999, stepSize: 1, tickSize: 0.01,
      pricePrecision: 2, qtyPrecision: 0, isEnabled: i.tradeable !== false,
    }));
  }

  async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    try { await this._makeAuthRequest('GET', '/trade/accounts'); return { latency: Date.now() - t0, timestamp: Date.now() }; }
    catch { return { latency: -1, timestamp: Date.now() }; }
  }
}

export default WebullAdapter;
