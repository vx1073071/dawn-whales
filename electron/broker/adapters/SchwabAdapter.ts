— R119 QClaw: structural type errors pending resolution by JVS/PM
// ── QUANT MOO — SchwabAdapter ─────────────────────────────────────────
// R2 OAU-01: Charles Schwab Broker Adapter
// Inherits OAuthBrokerBase (OAuth2 Authorization Code + PKCE)
// API Base: https://api.schwabapi.com
// Markets: US equities, ETFs, options, futures, mutual funds, bonds

import log from 'electron-log';
import { OAuthBrokerBase, type OAuthBrokerConfig, type OAuthVersion } from './OAuthBrokerBase';
import type {
  BrokerConfig, QuoteInfo, KlineInfo, AccountInfo,
  FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest,
} from '../IBrokerAdapter';
import type {
  IBrokerAdapterV2, BrokerType, MarketType,
  TradingPairInfo, OrderBookInfo, MarginInfo,
  BrokerConnectionStatus, TaggedQuoteInfo,
} from '../IBrokerAdapterV2';

// ═══════════════════════════════════════════════════════════
// 配置类型
// ═══════════════════════════════════════════════════════════

export interface SchwabConfig extends OAuthBrokerConfig {
  type: 'schwab';
  // Schwab专用
  accountHash?: string;           // 账户HASH值(首次获取后缓存)
  accountNumber?: string;         // 明文账户号(展示用)
  streamerUrl?: string;           // WebSocket Streamer URL
  streamerKey?: string;           // Streamer key (从accounts端点获取)
  // OAuth2
  codeVerifier?: string;          // PKCE code verifier
}

const DEFAULT_SCHWAB_CONFIG: Partial<SchwabConfig> = {
  type: 'schwab',
  authUrl: 'https://api.schwabapi.com/v1/oauth/authorize',
  tokenUrl: 'https://api.schwabapi.com/v1/oauth/token',
  baseApiUrl: 'https://api.schwabapi.com',
  scopes: ['readonly', 'trader'],
  redirectUri: 'https://127.0.0.1:8182',
};

// ═══════════════════════════════════════════════════════════
// Schwab API 响应类型
// ═══════════════════════════════════════════════════════════

interface SchwabAccount {
  accountNumber: string;
  hashValue: string;
}

interface SchwabSecuritiesAccount {
  accountNumber: string;
  type: string;
  roundTrips: number;
  isDayTrader: boolean;
  isClosingOnlyRestricted: boolean;
  positions?: SchwabPosition[];
  initialBalances?: SchwabBalance;
  currentBalances?: SchwabBalance;
  projectedBalances?: SchwabBalance;
}

interface SchwabBalance {
  cashBalance: number;
  marginBalance: number;
  longMarketValue: number;
  shortMarketValue: number;
  availableFunds: number;
  availableFundsNonMarginableTrade: number;
  buyingPower: number;
  maintenanceRequirement: number;
  equity: number;
  netLiquidation: number;
  cashAvailableForTrading?: number;
}

interface SchwabPosition {
  shortQuantity: number;
  longQuantity: number;
  averagePrice: number;
  marketValue: number;
  currentDayProfitLoss: number;
  currentDayProfitLossPercentage: number;
  instrument: SchwabInstrument;
}

interface SchwabInstrument {
  symbol: string;
  cusip: string;
  assetType: 'EQUITY' | 'ETF' | 'OPTION' | 'FUTURE' | 'MUTUAL_FUND' | 'FIXED_INCOME';
  description: string;
  netChange: number;
  type?: string;
  putCall?: 'PUT' | 'CALL';
  underlyingSymbol?: string;
}

interface SchwabQuote {
  assetType: SchwabInstrument['assetType'];
  cusip: string;
  symbol: string;
  description: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastPrice: number;
  netChange: number;
  netPercentChangeInDouble: number;
  totalVolume: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  closePrice: number;
  quoteTime: number;          // Unix timestamp ms
  tradeTime: number;
  mark: number;
  markChangeInDouble: number;
  markPercentChangeInDouble: number;
  volatility: number;
  peRatio: number;
  divAmount: number;
  divYield: number;
  week52High: number;
  week52Low: number;
}

interface SchwabPriceHistoryResponse {
  candles: Array<{
    datetime: number;          // Unix timestamp ms
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  symbol: string;
  empty: boolean;
  previousClose: number;
  previousCloseDate: number;
}

interface SchwabOrderRequest {
  session: 'NORMAL' | 'AM' | 'PM';
  duration: 'DAY' | 'GOOD_TILL_CANCEL' | 'FILL_OR_KILL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'NET_DEBIT' | 'NET_CREDIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  orderLegCollection: Array<{
    instruction: 'BUY' | 'SELL' | 'SELL_SHORT' | 'BUY_TO_COVER' | 'BUY_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_OPEN' | 'SELL_TO_CLOSE';
    quantity: number;
    instrument: {
      assetType: string;
      symbol: string;
    };
  }>;
  orderStrategyType: 'SINGLE' | 'OCO' | 'TRIGGER';
  complexOrderStrategyType?: 'NONE' | 'COVERED' | 'PROTECTIVE' | 'VERTICAL' | 'IRON_CONDOR';
}

interface SchwabOrderResponse {
  orderId: string;
  status: string;
}

interface SchwabOrder {
  orderId: number;
  status: 'AWAITING_PARENT_ORDER' | 'AWAITING_CONDITION' | 'AWAITING_MANUAL_REVIEW' | 'ACCEPTED' | 'AWAITING_UR_OUT' | 'PENDING_ACTIVATION' | 'QUEUED' | 'WORKING' | 'REJECTED' | 'PENDING_CANCEL' | 'CANCELED' | 'PENDING_REPLACE' | 'REPLACED' | 'FILLED' | 'EXPIRED' | 'NEW' | 'AWAITING_RELEASE_TIME' | 'PENDING_ACKNOWLEDGEMENT' | 'PENDING_RECALL' | 'UNKNOWN';
  orderType: string;
  session: string;
  duration: string;
  price: number;
  filledQuantity: number;
  remainingQuantity: number;
  orderLegCollection: Array<{
    instruction: string;
    instrument: { symbol: string };
    quantity: number;
  }>;
  enteredTime: string;
  closeTime?: string;
}

interface SchwabOrdersResponse {
  orders: SchwabOrder[];
  cursor?: string;
}

interface SchwabTransaction {
  activityId: number;
  type: 'TRADE' | 'RECEIVE_AND_DELIVER' | 'DIVIDEND_OR_INTEREST' | 'ACH_RECEIPT' | 'ACH_DISBURSEMENT' | 'JOURNAL' | 'ELECTRONIC_FUND' | 'WIRE_IN' | 'WIRE_OUT';
  tradeDate: string;
  netAmount: number;
  description: string;
  status: string;
}

interface SchwabOptionChainResponse {
  symbol: string;
  underlying: { symbol: string; last: number; change: number; percentChange: number };
  callExpDateMap: Record<string, Record<string, SchwabOptionContract[]>>;
  putExpDateMap: Record<string, Record<string, SchwabOptionContract[]>>;
}

interface SchwabOptionContract {
  putCall: 'CALL' | 'PUT';
  symbol: string;
  description: string;
  strikePrice: number;
  bid: number;
  ask: number;
  last: number;
  mark: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  openInterest: number;
  volume: number;
  intrinsicValue: number;
  timeValue: number;
  volatility: number;
  daysToExpiration: number;
  expirationType: string;
  inTheMoney: boolean;
}

// ═══════════════════════════════════════════════════════════
// SchwabAdapter
// ═══════════════════════════════════════════════════════════

export class SchwabAdapter extends OAuthBrokerBase implements IBrokerAdapterV2 {
  protected config: SchwabConfig;
  private accountHashCache: string | null = null;
  private streamerUrl: string | null = null;
  private streamerKey: string | null = null;

  constructor(config: Partial<SchwabConfig> & Pick<SchwabConfig, 'id' | 'name' | 'clientId' | 'clientSecret'>) {
    const merged: SchwabConfig = {
      ...DEFAULT_SCHWAB_CONFIG,
      ...config,
    } as SchwabConfig;

    super(merged as OAuthBrokerConfig);
    this.config = merged;
  }

  // ═══ Abstract: OAuth Version ════════════════════════════
  protected _oauthVersion(): OAuthVersion {
    return '2.0';
  }

  protected _buildAuthHeaders(headers: Record<string, string>): Record<string, string> {
    // OAuth2: already set Bearer token in base class, nothing extra needed
    return headers;
  }

  // ═══ Account Hash (首次获取后缓存) ═════════════════════
  private async _getAccountHash(): Promise<string> {
    if (this.accountHashCache) return this.accountHashCache;

    const data = await this._makeAuthRequest('GET', '/trader/v1/accounts/accountNumbers');

    const accounts: SchwabAccount[] = Array.isArray(data) ? data : [];
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const hash = accounts[0].hashValue;
    this.accountHashCache = hash;
    log.info(`[Schwab] Account hash cached: ${hash.slice(0, 4)}...`);
    return hash;
  }

  // ═══ Override: 增强connect收集Streamer凭证 ═════════════
  async connect(): Promise<void> {
    await super.connect();

    // After OAuth, fetch account hash for subsequent calls
    try {
      await this._getAccountHash();

      // Also fetch streamer credentials (WebSocket实时行情)
      const acctHash = this.accountHashCache;
      if (acctHash) {
        try {
          const prefs = await this._makeAuthRequest(
            'GET',
            `/trader/v1/accounts/${acctHash}/preferences`
          );
          this.streamerUrl = prefs?.streamerInfo?.streamerSocketUrl || null;
          this.streamerKey = prefs?.streamerInfo?.schwabClientCustomerId || null;
        } catch {
          log.warn('[Schwab] Streamer preferences unavailable, real-time push disabled');
        }
      }
    } catch (err: any) {
      log.error(`[Schwab] Account init failed: ${err.message}`);
    }
  }

  // ═══ Abstract: Path Builders ════════════════════════════
  protected _quotePath(codes: string[]): string {
    const symbols = codes.map(c => c.replace(/^US\./, '')).join(',');
    return `/marketdata/v1/quotes?symbols=${symbols}&fields=quote,reference`;
  }

  protected _klinePath(code: string, period: string, count: number): string {
    const symbol = code.replace(/^US\./, '');

    // Map QUANT MOO period → Schwab frequency parameters
    const freqMap: Record<string, { periodType: string; period: string; frequencyType: string; frequency: number }> = {
      '1D': { periodType: 'day', period: String(count), frequencyType: 'minute', frequency: 5 },
      '1W': { periodType: 'week', period: String(count), frequencyType: 'daily', frequency: 1 },
      '1M': { periodType: 'month', period: String(count), frequencyType: 'daily', frequency: 1 },
      '1Y': { periodType: 'year', period: String(count), frequencyType: 'daily', frequency: 1 },
      'ALL': { periodType: 'year', period: '20', frequencyType: 'monthly', frequency: 1 },
    };

    const freq = freqMap[period] || freqMap['1M'];
    return `/marketdata/v1/pricehistory?symbol=${symbol}&periodType=${freq.periodType}&period=${freq.period}&frequencyType=${freq.frequencyType}&frequency=${freq.frequency}&needExtendedHoursData=false`;
  }

  protected _buildOrderBody(order: PlaceOrderRequest): SchwabOrderRequest {
    const symbol = order.code.replace(/^US\./, '');
    const accountId = order.accountId || this.accountHashCache || '';

    return {
      session: 'NORMAL',
      duration: (order as any).timeInForce === 'GTC' ? 'GOOD_TILL_CANCEL'
        : (order as any).timeInForce === 'IOC' ? 'FILL_OR_KILL'
        : 'DAY',
      orderType: order.orderType,
      quantity: order.qty,
      price: order.price,
      stopPrice: (order as any).stopPrice,
      orderLegCollection: [{
        instruction: order.side === 'BUY' ? 'BUY' : 'SELL',
        quantity: order.qty,
        instrument: {
          assetType: 'EQUITY',
          symbol: symbol,
        },
      }],
      orderStrategyType: 'SINGLE',
    };
  }

  // ═══ Override: Path overrides for Schwab-specific ═══════
  // Schwab account endpoints use different structure than base class
  private async _makeApiRequest<T>(method: string, path: string, body?: any): Promise<T> {
    return this._makeAuthRequest(method, path, body) as Promise<T>;
  }

  // ═══ Abstract: Data Parsers ══════════════════════════════
  // Each parser must transform Schwab's response format to QUANT MOO types

  protected _parseQuotes(data: any): QuoteInfo[] {
    if (!data || typeof data !== 'object') return [];

    // Schwab returns different shapes based on single vs batch
    const entries: Array<[string, SchwabQuote]> = Object.entries(data);
    // If data is an array-like response, handle differently
    const quotes: SchwabQuote[] = [];
    for (const [key, val] of entries) {
      if (key === 'requestid' || key === 'symbol') continue;
      if (typeof val === 'object' && val !== null && 'symbol' in val) {
        quotes.push(val as unknown as SchwabQuote);
      }
    }

    if (quotes.length === 0 && 'symbol' in data && 'lastPrice' in data) {
      quotes.push(data as unknown as SchwabQuote);
    }

    return quotes.map(q => ({
      code: `US.${q.symbol}`,
      price: q.lastPrice || q.mark || 0,
      change: q.netChange || 0,
      changePct: q.netPercentChangeInDouble || 0,
      volume: q.totalVolume || 0,
      turnover: 0, // Schwab doesn't provide turnover
      high: q.highPrice || 0,
      low: q.lowPrice || 0,
      open: q.openPrice || 0,
      prevClose: q.closePrice || 0,
      time: q.quoteTime ? new Date(q.quoteTime).toISOString() : new Date().toISOString(),
    }));
  }

  protected _parseKlines(data: any): KlineInfo[] {
    if (!data || !data.candles) return [];

    const candles: SchwabPriceHistoryResponse['candles'] = data.candles;
    return candles.map(c => ({
      time: new Date(c.datetime).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  protected _parseAccounts(data: any): AccountInfo[] {
    if (!data) return [];

    // Schwab returns array of { securitiesAccount: { ... } }
    const accounts: any[] = Array.isArray(data) ? data : [data];
    const results: AccountInfo[] = [];

    for (const wrapper of accounts) {
      const sec = wrapper?.securitiesAccount as SchwabSecuritiesAccount | undefined;
      if (!sec) continue;

      const bal = sec.currentBalances || sec.initialBalances || sec.projectedBalances;
      const netAssets = bal?.liquidationValue || bal?.netLiquidation || 0;

      results.push({
        accountId: sec.accountNumber || '',
        name: `Schwab ${sec.type || 'Account'} ${(sec.accountNumber || '').slice(-4)}`,
        currency: 'USD',
        netAssets,
        totalAssets: bal?.longMarketValue || 0,
        cash: bal?.cashBalance || 0,
        marketValue: bal?.longMarketValue || 0,
      });
    }

    return results;
  }

  protected _parseFunds(data: any): FundsInfo {
    if (!data) {
      return { totalAssets: 0, cash: 0, marketValue: 0, frozenCash: 0, availableCash: 0, currency: 'USD' };
    }

    const bal = data?.securitiesAccount?.currentBalances
      || data?.securitiesAccount?.initialBalances
      || data?.currentBalances
      || data;

    return {
      totalAssets: bal.liquidationValue || bal.netLiquidation || 0,
      cash: bal.cashBalance || 0,
      marketValue: bal.longMarketValue || 0,
      frozenCash: 0,
      availableCash: bal.availableFunds || bal.cashAvailableForTrading || 0,
      currency: 'USD',
    };
  }

  protected _parsePositions(data: any): PositionInfo[] {
    if (!data) return [];

    const sec = data?.securitiesAccount as SchwabSecuritiesAccount | undefined;
    const positions = sec?.positions || (Array.isArray(data.positions) ? data.positions : []);
    const bal = sec?.currentBalances || sec?.initialBalances || sec?.projectedBalances;
    const totalMarketValue = bal?.liquidationValue || bal?.netLiquidation || 1;

    return (positions as SchwabPosition[]).map(p => {
      const mktValue = p.marketValue || 0;
      return {
        code: `US.${p.instrument.symbol}`,
        name: p.instrument.description || p.instrument.symbol,
        qty: p.longQuantity - p.shortQuantity,
        costPrice: p.averagePrice || 0,
        marketPrice: p.longQuantity > 0 ? mktValue / p.longQuantity : 0,
        marketValue: mktValue,
        pnl: p.currentDayProfitLoss || 0,
        pnlPct: p.currentDayProfitLossPercentage || 0,
        ratio: totalMarketValue > 0 ? mktValue / totalMarketValue : 0,
      };
    });
  }

  protected _parseOrders(data: any): OrderInfo[] {
    const orders: SchwabOrder[] = data?.orders || (Array.isArray(data) ? data : []) || [];

    const statusMap: Record<string, OrderInfo['status']> = {
      'WORKING': 'SUBMITTED',
      'QUEUED': 'PENDING',
      'NEW': 'PENDING',
      'PENDING_ACTIVATION': 'PENDING',
      'AWAITING_PARENT_ORDER': 'PENDING',
      'AWAITING_CONDITION': 'PENDING',
      'ACCEPTED': 'SUBMITTED',
      'FILLED': 'FILLED',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      'CANCELED': 'CANCELLED',
      'PENDING_CANCEL': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'EXPIRED': 'EXPIRED',
      'REPLACED': 'SUBMITTED',
    };

    return orders.map(o => {
      const leg = o.orderLegCollection?.[0];
      return {
        orderId: String(o.orderId),
        code: leg ? `US.${leg.instrument.symbol}` : '',
        side: leg?.instruction?.includes('BUY') ? 'BUY' : 'SELL',
        orderType: (o.orderType as any) === 'LIMIT' ? 'LIMIT'
          : (o.orderType as any) === 'STOP' ? 'STOP'
          : 'MARKET',
        qty: leg?.quantity || 0,
        price: o.price || 0,
        filledQty: o.filledQuantity || 0,
        filledPrice: 0,
        status: statusMap[o.status] || 'PENDING',
        createdAt: o.enteredTime || new Date().toISOString(),
      };
    });
  }

  protected _parseOrderResult(data: any): { orderId: string } {
    return { orderId: String(data?.orderId || data?.order_id || '') };
  }

  // ═══ Override: Account path (Schwab uses accountHash) ══
  async getAccounts(): Promise<AccountInfo[]> {
    const hash = await this._getAccountHash();
    const data = await this._makeAuthRequest('GET', `/trader/v1/accounts/${hash}?fields=positions`);
    return this._parseAccounts(data);
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    const hash = accountId || this.accountHashCache || await this._getAccountHash();
    const data = await this._makeAuthRequest('GET', `/trader/v1/accounts/${hash}`);
    return this._parseFunds(data);
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    const hash = accountId || this.accountHashCache || await this._getAccountHash();
    const data = await this._makeAuthRequest('GET', `/trader/v1/accounts/${hash}?fields=positions`);
    return this._parsePositions(data);
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    const hash = accountId || this.accountHashCache || await this._getAccountHash();
    try {
      const data = await this._makeAuthRequest('GET', `/trader/v1/accounts/${hash}/orders?status=ALL&maxResults=50`);
      return this._parseOrders(data);
    } catch {
      return [];
    }
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    const hash = order.accountId || this.accountHashCache || await this._getAccountHash();
    const body = this._buildOrderBody(order);
    const data = await this._makeAuthRequest('POST', `/trader/v1/accounts/${hash}/orders`, body);
    return this._parseOrderResult(data);
  }

  async cancelOrder(orderId: string, accountId: string): Promise<void> {
    const hash = accountId || this.accountHashCache || await this._getAccountHash();
    await this._makeAuthRequest('DELETE', `/trader/v1/accounts/${hash}/orders/${orderId}`);
  }

  // ═══ V2 Extensions ══════════════════════════════════════
  override getMarkets(): MarketType[] {
    return ['US'];
  }

  override getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'> {
    return ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP', 'OCO'];
  }

  override getBrokerType(): BrokerType {
    return 'schwab';
  }

  // ── Schwab特色功能 ─────────────────────────────────────

  /** 获取期权链 (Schwab特有) */
  async getOptionChain(
    symbol: string,
    strike?: number,
    fromDate?: string,
    toDate?: string,
    contractType?: 'CALL' | 'PUT' | 'ALL',
  ): Promise<SchwabOptionChainResponse> {
    const sym = symbol.replace(/^US\./, '');
    let path = `/marketdata/v1/chains?symbol=${sym}`;
    if (strike) path += `&strike=${strike}`;
    if (fromDate) path += `&fromDate=${fromDate}`;
    if (toDate) path += `&toDate=${toDate}`;
    if (contractType && contractType !== 'ALL') path += `&contractType=${contractType}`;

    return this._makeApiRequest<SchwabOptionChainResponse>('GET', path);
  }

  /** 获取市场异动股 */
  async getMovers(index: '$SPX' | '$DJI' | '$COMPX'): Promise<any> {
    return this._makeApiRequest('GET', `/marketdata/v1/movers/${index}`);
  }

  /** 获取交易历史 */
  async getTransactions(accountId?: string, startDate?: string, endDate?: string): Promise<SchwabTransaction[]> {
    const hash = accountId || this.accountHashCache || await this._getAccountHash();
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const query = params.toString();
    const path = `/trader/v1/accounts/${hash}/transactions${query ? '?' + query : ''}`;
    return this._makeApiRequest<SchwabTransaction[]>('GET', path);
  }

  /** 获取市场状态 (是否开盘) */
  async getMarketHours(market: 'equity' | 'option' | 'bond' | 'future' | 'forex' = 'equity'): Promise<any> {
    return this._makeApiRequest('GET', `/marketdata/v1/markets/${market}`);
  }

  /** Streamer WebSocket连接 (实时行情推送) — 需额外认证 */
  async getStreamerCredentials(): Promise<{ url: string; key: string } | null> {
    if (this.streamerUrl && this.streamerKey) {
      return { url: this.streamerUrl, key: this.streamerKey };
    }
    return null;
  }

  /** 验证 connect 状态 */
  override async ping(): Promise<{ latency: number; timestamp: number }> {
    const t0 = Date.now();
    try {
      await this._makeAuthRequest('GET', '/trader/v1/accounts/accountNumbers');
      return { latency: Date.now() - t0, timestamp: Date.now() };
    } catch {
      return { latency: -1, timestamp: Date.now() };
    }
  }

  override getConnectionStatus(): BrokerConnectionStatus {
    return {
      brokerId: this.id,
      brokerName: this.name,
      brokerType: 'schwab',
      connected: this.connected,
      connectedAt: this.connected ? Date.now() : undefined,
      subscriptionsCount: 0,
    };
  }
}

export default SchwabAdapter;
