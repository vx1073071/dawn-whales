— R119 QClaw: structural type errors pending resolution by JVS/PM
// ── DAWN WHALES — eToroAdapter ──────────────────────────────────────────
// R3 OAU-03: eToro Broker Adapter
// Inherits OAuthBrokerBase (OAuth2 Authorization Code)
// Markets: US stocks, ETFs, crypto, commodities, forex
// Features: CopyTrader, Agent Portfolio, leverage, social trading
// OAuth2 with API Key + Client ID/Secret

import log from 'electron-log';
import { OAuthBrokerBase, type OAuthBrokerConfig, type OAuthVersion } from './OAuthBrokerBase';
import type { QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../IBrokerAdapter';
import type { MarketType, TradingPairInfo } from '../IBrokerAdapterV2';

export interface EToroConfig extends OAuthBrokerConfig {
  type: 'etoro';
  clientId: string;
  clientSecret: string;
  apiKey: string;
  useRealAccount?: boolean;
}

const DEFAULT_ETORO_CONFIG: Partial<EToroConfig> = {
  type: 'etoro',
  authUrl: 'https://api.etoro.com/oauth/authorize',
  tokenUrl: 'https://api.etoro.com/oauth/token',
  baseApiUrl: 'https://api.etoro.com',
  scopes: ['read', 'trade'],
  redirectUri: 'http://localhost:8183/callback',
};

// ═══════════════════════════════════════════════════════════
// eToro API Response Types
// ═══════════════════════════════════════════════════════════

interface EToroMetadata {
  InstrumentId: number;
  SymbolFull: string;
  DisplayName: string;
  IsReal: boolean;
  InstrumentTypeID: number;
  Leverage: number;
}

interface EToroRate {
  InstrumentId: number;
  Rate: number;
  Bid: number;
  Ask: number;
  DailyChange: number;
  DailyChangePercentage: number;
  High: number;
  Low: number;
  Open: number;
  PreviousClose: number;
  Volume: number;
  Time: string;
}

interface EToroPosition {
  PositionId: number;
  InstrumentId: number;
  InstrumentDisplayName: string;
  SymbolFull: string;
  PositionType: 'Short' | 'Long';
  Amount: number;
  Units: number;
  OpenRate: number;
  CloseRate: number | null;
  MarketRate: number;
  StopLossRate: number | null;
  TakeProfitRate: number | null;
  Leverage: number;
  NetProfit: number;
  ProfitPercentage: number;
  Allocation: number;
  IsReal: boolean;
  IsOpen: boolean;
  OpenDateTime: string;
}

interface EToroOrder {
  OrderId: number;
  PositionId: number | null;
  InstrumentId: number;
  SymbolFull: string;
  Side: 'Buy' | 'Sell';
  OrderType: 'Limit' | 'Market' | 'Stop';
  Quantity: number;
  LimitRate: number | null;
  StopRate: number | null;
  Status: 'Open' | 'Executed' | 'Cancelled' | 'Rejected';
  CreatedDateTime: string;
}

interface EToroAccount {
  AccountId: number;
  ClientId: string;
  DisplayName: string;
  AccountType: string;
  Currency: string;
  Balance: number;
  AvailableBalance: number;
  Equity: number;
  EquityPercent: number;
  UnrealizedProfit: number;
  TotalAllocated: number;
  IsReal: boolean;
}

// ═══════════════════════════════════════════════════════════
// eToroAdapter
// ═══════════════════════════════════════════════════════════

export class eToroAdapter extends OAuthBrokerBase {
  declare protected config: EToroConfig;
  private cachedRates: Map<number, EToroRate> = new Map();
  private cachedInstruments: Map<string, EToroMetadata> = new Map();

  constructor(config: Partial<EToroConfig> & Pick<EToroConfig, 'id' | 'name' | 'clientId' | 'clientSecret' | 'apiKey'>) {
    const merged: EToroConfig = { ...DEFAULT_ETORO_CONFIG, ...config } as EToroConfig;
    super(merged as OAuthBrokerConfig);
    this.config = merged;
  }

  protected _oauthVersion(): OAuthVersion { return '2.0'; }
  protected _buildAuthHeaders(h: Record<string, string>): Record<string, string> { return h; }

  // ═══ Connect: fetch instrument metadata ════════════════
  async connect(): Promise<void> {
    await super.connect();
    try {
      await this._loadInstrumentMetadata();
      log.info(`[eToro] Connected — ${this.cachedInstruments.size} instruments loaded`);
    } catch (err: any) {
      log.warn(`[eToro] Metadata load failed (non-fatal): ${err.message}`);
    }
  }

  /** Load instrument ID→symbol mapping for subsequent lookups */
  private async _loadInstrumentMetadata(): Promise<void> {
    const data = await this._makeAuthRequest('GET', '/metadata/instruments');
    const instruments: EToroMetadata[] = Array.isArray(data) ? data : (data?.InstrumentDisplayDatas || []);
    for (const inst of instruments) {
      this.cachedInstruments.set(inst.SymbolFull.toUpperCase(), inst);
    }
  }

  /** Look up instrument ID by symbol */
  private _getInstrumentId(symbol: string): number {
    const clean = symbol.replace(/^US\./, '').toUpperCase();
    const inst = this.cachedInstruments.get(clean);
    if (!inst) throw new Error(`eToro instrument not found: ${clean}`);
    return inst.InstrumentId;
  }

  // ═══ Abstract: Path Builders ════════════════════════════
  protected _quotePath(codes: string[]): string {
    const ids = codes.map(c => this._getInstrumentId(c)).join(',');
    return `/rates/instruments?InstrumentIds=${ids}`;
  }

  protected _klinePath(code: string, period: string, count: number): string {
    const instId = this._getInstrumentId(code);
    // Map period to eToro candle interval
    const intervalMap: Record<string, string> = {
      '1D': 'OneMinute', '1W': 'FifteenMinutes', '1M': 'OneHour',
      '1Y': 'OneDay', 'ALL': 'OneWeek',
    };
    return `/rates/candles/${instId}?CandleInterval=${intervalMap[period] || 'OneDay'}&CandlesAmount=${count}`;
  }

  protected _buildOrderBody(order: PlaceOrderRequest): any {
    const instId = this._getInstrumentId(order.code);
    return {
      InstrumentId: instId,
      Side: order.side === 'BUY' ? 'Buy' : 'Sell',
      OrderType: order.orderType === 'LIMIT' ? 'Limit' : 'Market',
      Quantity: order.qty,
      LimitRate: order.price || 0,
      StopLossRate: (order as any).stopPrice || null,
      TakeProfitRate: null,
      IsReal: this.config.useRealAccount ?? false,
    };
  }

  // ═══ Abstract: Data Parsers ══════════════════════════════
  protected _parseQuotes(data: any): QuoteInfo[] {
    const rates: EToroRate[] = Array.isArray(data) ? data : (data?.Rates || []);
    return rates.map(r => {
      // Reverse-lookup symbol from cached instruments
      let symbol = `INST_${r.InstrumentId}`;
      for (const [sym, inst] of this.cachedInstruments) {
        if (inst.InstrumentId === r.InstrumentId) { symbol = sym; break; }
      }
      this.cachedRates.set(r.InstrumentId, r);
      return {
        code: `US.${symbol}`,
        price: r.Rate || 0,
        change: r.DailyChange || 0,
        changePct: r.DailyChangePercentage || 0,
        volume: r.Volume || 0,
        turnover: 0,
        high: r.High || 0,
        low: r.Low || 0,
        open: r.Open || 0,
        prevClose: r.PreviousClose || 0,
        time: r.Time || new Date().toISOString(),
      };
    });
  }

  protected _parseKlines(data: any): KlineInfo[] {
    const candles = data?.Candles || data?.candles || (Array.isArray(data) ? data : []);
    return candles.map((c: any) => ({
      time: c.FromDate || c.Timestamp || new Date().toISOString(),
      open: c.Open || 0,
      high: c.High || 0,
      low: c.Low || 0,
      close: c.Close || 0,
      volume: 0,
    }));
  }

  protected _parseAccounts(data: any): AccountInfo[] {
    const accounts: EToroAccount[] = Array.isArray(data) ? data : (data?.Accounts || [data]);
    return accounts.map(a => ({
      accountId: String(a.AccountId),
      name: `eToro ${a.AccountType} ${a.IsReal ? '(Real)' : '(Demo)'}`,
      currency: a.Currency || 'USD',
      netAssets: a.Equity || 0,
      totalAssets: a.Balance || 0,
      cash: a.AvailableBalance || 0,
      marketValue: a.TotalAllocated || 0,
    }));
  }

  protected _parseFunds(data: any): FundsInfo {
    const a = data as EToroAccount;
    return {
      totalAssets: a.Equity || 0,
      cash: a.AvailableBalance || 0,
      marketValue: a.TotalAllocated || 0,
      frozenCash: (a.Balance || 0) - (a.AvailableBalance || 0),
      availableCash: a.AvailableBalance || 0,
      currency: a.Currency || 'USD',
    };
  }

  protected _parsePositions(data: any): PositionInfo[] {
    const positions: EToroPosition[] = Array.isArray(data) ? data : (data?.Positions || []);
    const totalEquity = positions.reduce((s, p) => s + (p.Allocation || 0), 0) || 1;
    return positions.filter(p => p.IsOpen).map(p => ({
      code: `US.${p.SymbolFull}`,
      name: p.InstrumentDisplayName || p.SymbolFull,
      qty: p.Units || 0,
      costPrice: p.OpenRate || 0,
      marketPrice: p.MarketRate || 0,
      marketValue: p.Allocation || 0,
      pnl: p.NetProfit || 0,
      pnlPct: p.ProfitPercentage || 0,
      ratio: totalEquity > 0 ? (p.Allocation || 0) / totalEquity : 0,
    }));
  }

  protected _parseOrders(data: any): OrderInfo[] {
    const orders: EToroOrder[] = Array.isArray(data) ? data : (data?.Orders || []);
    const statusMap: Record<string, OrderInfo['status']> = {
      'Open': 'SUBMITTED', 'Executed': 'FILLED', 'Cancelled': 'CANCELLED', 'Rejected': 'REJECTED',
    };
    return orders.map(o => ({
      orderId: String(o.OrderId),
      code: `US.${o.SymbolFull}`,
      side: o.Side === 'Buy' ? 'BUY' : 'SELL',
      orderType: o.OrderType === 'Limit' ? 'LIMIT' : o.OrderType === 'Stop' ? 'STOP' : 'MARKET',
      qty: o.Quantity || 0,
      price: o.LimitRate || o.StopRate || 0,
      filledQty: o.Status === 'Executed' ? (o.Quantity || 0) : 0,
      filledPrice: 0,
      status: statusMap[o.Status] || 'PENDING',
      createdAt: o.CreatedDateTime || new Date().toISOString(),
    }));
  }

  protected _parseOrderResult(data: any): { orderId: string } {
    return { orderId: String(data?.OrderId || data?.orderId || `etoro-${Date.now()}`) };
  }

  // ═══ Override: eToro-specific account endpoints ════════
  async getAccounts(): Promise<AccountInfo[]> {
    const data = await this._makeAuthRequest('GET', '/accounts');
    return this._parseAccounts(data);
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const data = await this._makeAuthRequest('GET', `/accounts/${accountId || ''}`);
    return this._parseFunds(data);
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const data = await this._makeAuthRequest('GET', `/accounts/${accountId || ''}/positions`);
    return this._parsePositions(data);
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    try {
      const data = await this._makeAuthRequest('GET', `/accounts/${accountId || ''}/orders?Limit=50`);
      return this._parseOrders(data);
    } catch { return []; }
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const body = this._buildOrderBody(order);
    body.IsReal = this.config.useRealAccount ?? false;
    const accountId = order.accountId || '';
    const data = await this._makeAuthRequest('POST', `/accounts/${accountId}/orders`, body);
    return this._parseOrderResult(data);
  }

  async cancelOrder(orderId: string, accountId: string): Promise<void> {
    await this._makeAuthRequest('DELETE', `/accounts/${accountId || ''}/orders/${orderId}`);
  }

  // ═══ eToro-specific features ════════════════════════════
  /** Get all available trading instruments */
  async getInstruments(): Promise<EToroMetadata[]> {
    const data = await this._makeAuthRequest('GET', '/metadata/instruments');
    return Array.isArray(data) ? data : [];
  }

  /** Get copy-trader / Agent Portfolio data */
  async getAgentPortfolio(agentId: string): Promise<any> {
    return this._makeAuthRequest('GET', `/agents/${agentId}/portfolio`);
  }

  /** Copy a trader's portfolio */
  async copyTrader(traderId: string, amount: number, isReal?: boolean): Promise<any> {
    return this._makeAuthRequest('POST', `/agents/${traderId}/copy`, {
      TraderId: traderId,
      Amount: amount,
      IsReal: isReal ?? this.config.useRealAccount ?? false,
    });
  }

  /** Get social sentiment for an instrument */
  async getSocialSentiment(instrumentId: number): Promise<any> {
    return this._makeAuthRequest('GET', `/sentiment/${instrumentId}`);
  }

  /** Get trading history */
  async getHistory(accountId?: string): Promise<any> {
    return this._makeAuthRequest('GET', `/accounts/${accountId || ''}/history`);
  }

  // ═══ V2 Extensions ═════════════════════════════════════
  getMarkets(): MarketType[] { return ['US', 'EU', 'CRYPTO']; }

  getSupportedOrderTypes() {
    return ['MARKET', 'LIMIT', 'STOP'] as const;
  }

  getBrokerType() { return 'etoro' as const; }

  async getTradingPairs(): Promise<TradingPairInfo[]> {
    const insts = await this.getInstruments();
    return insts.map(i => ({
      symbol: i.SymbolFull,
      baseAsset: i.SymbolFull.split('/')[0] || i.SymbolFull,
      quoteAsset: i.SymbolFull.split('/')[1] || 'USD',
      minQty: 1, maxQty: 999999, stepSize: 1, tickSize: 0.01,
      pricePrecision: 2, qtyPrecision: 0, isEnabled: i.IsReal !== false,
    }));
  }

  async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    try { await this._makeAuthRequest('GET', '/accounts'); return { latency: Date.now() - t0, timestamp: Date.now() }; }
    catch { return { latency: -1, timestamp: Date.now() }; }
  }
}

export default eToroAdapter;
