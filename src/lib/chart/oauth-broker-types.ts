// ── R114 QTE-23 QClaw: OAuth券商深度API适配类型 ──────────────────────
// PM: 行情升级v2.0 模块5 — 4家OAuth券商(Schwab/E*TRADE/eToro/Webull) WS Streamer类型
// 所有OAuth适配器的深度/Tick/WS消息类型统一封装, 映射到IBrokerDepthAdapter接口
//
// @author QClaw (document-shrimp)
// @round R114 QTE-23
// @since 2026-06-12
//
// ═══════════════════════════════════════════════════════════════════════
// USAGE
// ═══════════════════════════════════════════════════════════════════════
// 每个OAuth适配器继承 OAuthDepthBase, 只需实现 transform* 方法:
//
//   class SchwabAdapter extends OAuthDepthBase {
//     connect(creds) { return this.connectWS('wss://...', creds); }
//     transformDepth(raw: SchwabOrderBook): OrderBookSnapshot { ... }
//     transformTick(raw: SchwabTick): TickRecord { ... }
//   }
// ═══════════════════════════════════════════════════════════════════════

import type {
  OrderBookSnapshot, TickRecord, DepthCallback,
  TickCallback, IBrokerDepthAdapter,
} from './depth-types';

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: OAuth通用基类类型
// ═══════════════════════════════════════════════════════════════════════

/** OAuth凭证 (扩展自BrokerCredentials) */
export interface OAuthCredentials {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken?: string;
  /** 过期时间 (Unix ms) */
  expiresAt?: number;
  /** API Key (部分需要) */
  apiKey?: string;
  /** App Secret / Consumer Secret */
  apiSecret?: string;
  /** 账户ID */
  accountId?: string;
  /** 是否纸交易 */
  paper?: boolean;
}

/** OAuth Token刷新器 */
export interface OAuthTokenRefresher {
  /** 用refreshToken获取新accessToken */
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
  /** 检查token是否需要刷新 */
  needsRefresh(expiresAt: number): boolean;
}

/** OAuth深度适配器抽象基类 */
export abstract class OAuthDepthBase implements IBrokerDepthAdapter {
  abstract readonly name: string;
  abstract readonly supportsOrderBook: boolean;
  abstract readonly supportsTick: boolean;
  abstract readonly supportsBrokerQueue: boolean;

  protected credentials?: OAuthCredentials;
  protected ws: WebSocket | null = null;
  protected depthCallbacks = new Map<string, Set<DepthCallback>>();
  protected tickCallbacks = new Map<string, Set<TickCallback>>();
  protected pingTimer: ReturnType<typeof setInterval> | null = null;
  protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  // ── Abstract (子类必须实现) ──

  /** 获取WS端点URL */
  abstract getWSEndpoint(): string;

  /** 格式化symbol为交易所格式 */
  abstract formatSymbol(symbol: string): string;

  /** 解析WS原始消息为统一格式 */
  abstract parseWSMessage(raw: unknown): WSParsedMessage[];

  /** 转换交易所原始深度数据 → OrderBookSnapshot */
  abstract transformDepth(raw: unknown, symbol: string): OrderBookSnapshot;

  /** 转换交易所原始tick数据 → TickRecord */
  abstract transformTick(raw: unknown, symbol: string): TickRecord;

  // ── OrderBook ──

  abstract getOrderBook(symbol: string, levels?: number): Promise<OrderBookSnapshot>;

  async subscribeOrderBook(symbol: string, callback: DepthCallback, levels = 20): Promise<void> {
    const sym = this.formatSymbol(symbol);
    if (!this.depthCallbacks.has(sym)) {
      this.depthCallbacks.set(sym, new Set());
      await this.ensureConnected();
      this.sendSubscribe('orderBook', sym, { levels });
    }
    this.depthCallbacks.get(sym)!.add(callback);
  }

  async unsubscribeOrderBook(symbol: string): Promise<void> {
    const sym = this.formatSymbol(symbol);
    this.depthCallbacks.delete(sym);
    this.sendUnsubscribe('orderBook', sym);
  }

  // ── Tick ──

  async subscribeTick(symbol: string, callback: TickCallback): Promise<void> {
    const sym = this.formatSymbol(symbol);
    if (!this.tickCallbacks.has(sym)) {
      this.tickCallbacks.set(sym, new Set());
      await this.ensureConnected();
      this.sendSubscribe('tick', sym, {});
    }
    this.tickCallbacks.get(sym)!.add(callback);
  }

  async unsubscribeTick(symbol: string): Promise<void> {
    const sym = this.formatSymbol(symbol);
    this.tickCallbacks.delete(sym);
    this.sendUnsubscribe('tick', sym);
  }

  // ── WS lifecycle ──

  protected async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    await this.connectWS();
  }

  protected connectWS(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.getWSEndpoint();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.credentials) this.authenticate();
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data as string);
          const parsed = this.parseWSMessage(raw);
          for (const msg of parsed) this.dispatchMessage(msg);
        } catch (e) {
          // 某些消息非JSON (如ping/pong文本) 忽略即可
        }
      };

      this.ws.onerror = (err) => { if (this.ws!.readyState === WebSocket.CONNECTING) reject(err); };

      this.ws.onclose = () => {
        this.stopPing();
        this.scheduleReconnect();
      };
    });
  }

  protected authenticate(): void {
    // 子类覆盖实现具体的OAuth/JWT认证
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: this.credentials?.accessToken,
        accountId: this.credentials?.accountId,
      }));
    }
  }

  protected sendSubscribe(channel: string, symbol: string, params: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel, symbol, ...params }));
    }
  }

  protected sendUnsubscribe(channel: string, symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', channel, symbol }));
    }
  }

  protected dispatchMessage(msg: WSParsedMessage): void {
    const { type, symbol, data } = msg;
    if (type === 'depth') {
      const snapshot = this.transformDepth(data, symbol);
      this.depthCallbacks.get(symbol)?.forEach(cb => cb(snapshot));
    } else if (type === 'tick') {
      const tick = this.transformTick(data, symbol);
      this.tickCallbacks.get(symbol)?.forEach(cb => cb(tick));
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
    }, 30_000);
  }

  private stopPing(): void { if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; } }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connectWS(), delay);
  }

  /** 断开连接并清理资源 */
  async disconnect(): Promise<void> {
    this.stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.depthCallbacks.clear();
    this.tickCallbacks.clear();
  }
}

/** WS消息解析结果 */
export interface WSParsedMessage {
  type: 'depth' | 'tick' | 'auth_response' | 'heartbeat' | 'error';
  symbol: string;
  data: unknown;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: Schwab (OAuth2 PKCE) WS Streamer 类型
// ═══════════════════════════════════════════════════════════════════════
// API: https://developer.schwab.com/products/trader-api
// Auth: OAuth2 PKCE → accessToken → WS Login (JWT)
// WS: wss://streamer.schwab.com/ws
// 请求: {"requests":[{"requestid":"1","service":"LEVELONE_EQUITIES","requestid":"1",...}]}
// 响应: {"data":[{"service":"LEVELONE_EQUITIES","content":[...]}]}

/** Schwab WS各级行情服务 */
export type SchwabServiceType =
  | 'LEVELONE_EQUITIES'   // L1 实时 (quote/bid/ask/last/volume)
  | 'LEVELONE_OPTIONS'    // 期权L1
  | 'LEVELONE_FUTURES'    // 期货L1
  | 'LEVELTWO_EQUITIES'   // L2 深度 (NY/NASDAQ book)
  | 'TIMESALE_EQUITY'     // Tick逐笔
  | 'CHART_EQUITY';       // K线

/** Schwab WS登录请求 */
export interface SchwabLoginRequest {
  requests: [{
    requestid: string;
    service: 'ADMIN';
    command: 'LOGIN';
    parameters: {
      Authorization: string;   // accessToken
      token: string;           // refreshToken
      schwabClientChannel: string;
      schwabClientFunctionId: string;
    };
  }];
}

/** Schwab WS订阅请求 */
export interface SchwabSubscribeRequest {
  requests: {
    requestid: string;
    service: SchwabServiceType;
    command: 'SUBS' | 'UNSUBS' | 'ADD' | 'VIEW';
    parameters: {
      keys: string;   // "AAPL,MSFT"
      fields: string; // "0,1,2,3,4,5,6,7,8,9" (字段ID列表)
    };
  }[];
}

/** Schwab WS Level 1 响应字段 ID 映射 */
export const SCHWAB_L1_FIELDS = {
  KEY: 0, BID_PRICE: 1, ASK_PRICE: 2, LAST_PRICE: 3,
  BID_SIZE: 4, ASK_SIZE: 5, LAST_SIZE: 8, VOLUME: 10,
  HIGH: 16, LOW: 17, OPEN: 19, CLOSE: 20,
  CHANGE: 21, CHANGE_PCT: 22, TIMESTAMP: 24, STATUS: 25,
} as const;

/** Schwab Level 2 (深度) 字段 */
export const SCHWAB_L2_FIELDS = {
  KEY: 0,
  MMID: 0,       // Market Maker ID
  BID_PRICE: 1,  // 买方挂单价
  ASK_PRICE: 2,  // 卖方挂单价
  BID_SIZE: 3,   // 买方挂单量
  ASK_SIZE: 4,
  TIMESTAMP: 12,
} as const;

/** Schwab Level 2 原始响应内容 */
export interface SchwabL2Content {
  key: string;    // symbol
  0: string;      // MMID
  1: number;      // bidPrice
  2: number;      // askPrice
  3: number;      // bidSize
  4: number;      // askSize
  12: number;     // timestamp
}

/** Schwab Tick (Time & Sale) 原始响应 */
export interface SchwabTickContent {
  key: string;
  0: string;      // tradeId
  1: number;      // price
  2: number;      // size
  3: number;      // timestamp
  4: number;      // sequence
}

/** Schwab WS 服务响应 */
export interface SchwabServiceResponse {
  service: SchwabServiceType;
  command: string;
  timestamp: number;
  content: unknown[];
}

/** Schwab WS 完整响应 */
export interface SchwabWSResponse {
  response?: { service: string; content: unknown[] }[];
  data?: SchwabServiceResponse[];
  notify?: { heartbeat?: string }[];
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: E*TRADE (OAuth1.0a) 类型
// ═══════════════════════════════════════════════════════════════════════
// API: https://developer.etrade.com
// Auth: OAuth1.0a (signature-based, 非token refresh)
// Market: REST v1/market/quote + v1/market/optionchains
// 注意: E*TRADE 无原生WS, 使用REST轮询+模拟推送

/** E*TRADE REST API 响应包裹 */
export interface ETradeResponse<T> {
  QuoteResponse?: { QuoteData: T[] };
  OptionChainResponse?: { OptionPair: unknown[] };
}

/** E*TRADE 单一报价 */
export interface ETradeQuote {
  symbol: string;
  description: string;
  bid: number;
  ask: number;
  lastPrice: number;
  bidSize: number;
  askSize: number;
  totalVolume: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume10Day: number;
  dateTimeUTC: number;
  securityStatus: string;
}

/** E*TRADE 深度 (通过fullQuote拉取, 非原生L2) */
export interface ETradeFullQuote {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  /** 最后10笔逐笔成交 (模拟Tick) */
  recentTrades: {
    price: number;
    size: number;
    time: number;
    exchange: string;
  }[];
  /** 52周高低 */
  hi52: number;
  lo52: number;
  /** 市值 */
  marketCap: number;
  /** EPS */
  eps: number;
  /** PE */
  pe: number;
}

/** E*TRADE 深度REST轮询配置 */
export interface ETradePollConfig {
  /** 轮询间隔 (ms, 最小500) */
  interval: number;
  /** 深度数据用fullQuote = true */
  useFullQuote: boolean;
  /** 超时 (ms) */
  timeout: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: eToro (Agent Portfolio) 类型
// ═══════════════════════════════════════════════════════════════════════
// API: 无公开API, 通过 Agent Portfolio WS 获取实时价格
// 参考: etoro.com API 抓取 (纸交易可用 eToroX API)

/** eToro WS 价格推送 */
export interface EToroWSPrice {
  /** 交易品种ID (如 1=AAPL, 1002=BTC) */
  instrumentId: number;
  /** 品种名称 */
  instrumentName: string;
  /** 当前价 */
  price: number;
  /** 买入价 */
  bid: number;
  /** 卖出价 */
  ask: number;
  /** 涨跌 */
  change: number;
  /** 涨跌幅 */
  changePct: number;
  /** 时间 */
  timestamp: number;
  /** 深度 (模拟, 非真实L2) */
  virtualDepth?: {
    bids: [number, number][];  // [price, size]
    asks: [number, number][];  // [price, size]
  };
}

/** eToro Agent Portfolio WS 消息类型 */
export interface EToroWSMessage {
  type: 'price' | 'orderbook' | 'news' | 'trade' | 'error' | 'heartbeat';
  data: EToroWSPrice | EToroTradeData | EToroErrorData;
}

/** eToro 逐笔模拟数据 (来自Agent Portfolio历史) */
export interface EToroTradeData {
  instrumentId: number;
  trades: {
    price: number;
    volume: number;
    direction: 'BUY' | 'SELL';
    timestamp: number;
  }[];
}

/** eToro 错误 */
export interface EToroErrorData {
  code: string;
  message: string;
}

/** eToro 品种元数据 */
export interface EToroInstrument {
  instrumentId: number;
  name: string;
  symbol: string;
  type: 'Stock' | 'ETF' | 'Crypto' | 'Forex' | 'Index' | 'Commodity';
  exchange: string;
  currency: string;
  pipSize?: number;
  leverage?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: Webull (Paper Trading) 类型
// ═══════════════════════════════════════════════════════════════════════
// API: Webull Paper Trading API
// Auth: OAuth2
// WS: quote/snapshot 订阅

/** Webull WS 行情推送类型 */
export type WebullRealtimeType =
  | 'QUOTE'     // 实时报价 (L1)
  | 'ORDER_BOOK' // L2 深度
  | 'TRADE'     // 逐笔
  | 'KLINE';    // K线

/** Webull 实时报价字段 */
export interface WebullQuoteFields {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  volume: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  status: string;
  timestamp: number;
}

/** Webull OrderBook 单档 */
export interface WebullOrderBookLevel {
  price: number;
  size: number;
  orderCount: number;
}

/** Webull OrderBook 完整深度 */
export interface WebullOrderBook {
  symbol: string;
  bids: WebullOrderBookLevel[];
  asks: WebullOrderBookLevel[];
  timestamp: number;
  /** 序列号 (用于delta合并) */
  seqId: number;
}

/** Webull 逐笔成交 */
export interface WebullTick {
  symbol: string;
  price: number;
  size: number;
  timestamp: number;
  tradeId: string;
  /** 方向: B=BID, A=ASK, N=UNKNOWN */
  side: 'B' | 'A' | 'N';
  /** 交易所代码 */
  exchange: string;
  /** 条件码 */
  condition: string;
  /** tick序列号 */
  seqId: number;
}

/** Webull WS 订阅参数 */
export interface WebullSubscribeParams {
  symbol: string;
  type: WebullRealtimeType;
  /** 深度档数 (默认20) */
  levels?: number;
}

/** Webull WS 消息格式 */
export interface WebullWSMessage {
  event: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'heartbeat';
  type: WebullRealtimeType;
  symbol?: string;
  data?: unknown;
  error?: { code: string; msg: string };
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: OAuth适配器工厂注册类型
// ═══════════════════════════════════════════════════════════════════════

/** 所有OAuth券商标识 */
export type OAuthBrokerId = 'schwab' | 'etrade' | 'etoro' | 'webull';

/** OAuth深度适配器创建工厂 */
export interface OAuthDepthAdapterFactory {
  id: OAuthBrokerId;
  label: string;
  markets: string[];
  /** 创建适配器实例 */
  create(): IBrokerDepthAdapter;
  /** 获取该券商的凭证验证规则 */
  validateCredentials(creds: OAuthCredentials): boolean;
}

/** OAuth适配器注册表条目 */
export interface OAuthRegistryEntry {
  brokerId: OAuthBrokerId;
  label: string;
  factory: () => IBrokerDepthAdapter;
  authUrl: string;     // OAuth授权页面
  tokenUrl: string;    // Token交换端点
  scopes: string[];    // 所需OAuth scope
  supportsDepth: boolean;
  supportsTick: boolean;
}

/** OAuth券商注册表 */
export const OAUTH_BROKER_REGISTRY: OAuthRegistryEntry[] = [
  {
    brokerId: 'schwab', label: 'Charles Schwab',
    factory: () => { throw new Error('SchwabAdapter not yet implemented'); },
    authUrl: 'https://api.schwabapi.com/v1/oauth/authorize',
    tokenUrl: 'https://api.schwabapi.com/v1/oauth/token',
    scopes: ['readonly', 'offline_access'],
    supportsDepth: true, supportsTick: true,
  },
  {
    brokerId: 'etrade', label: 'E*TRADE',
    factory: () => { throw new Error('ETRADEAdapter not yet implemented'); },
    authUrl: 'https://us.etrade.com/e/t/etws/authorize',
    tokenUrl: 'https://api.etrade.com/oauth/request_token',
    scopes: ['quote', 'account'],
    supportsDepth: true, supportsTick: true,
  },
  {
    brokerId: 'etoro', label: 'eToro',
    factory: () => { throw new Error('eToroAdapter not yet implemented'); },
    authUrl: 'https://etoro.com/oauth2/v1/auth',
    tokenUrl: 'https://etoro.com/oauth2/v1/token',
    scopes: ['portfolio', 'trading'],
    supportsDepth: true, supportsTick: false,
  },
  {
    brokerId: 'webull', label: 'Webull',
    factory: () => { throw new Error('WebullAdapter not yet implemented'); },
    authUrl: 'https://webullapp.com/us/oauth2/authorize',
    tokenUrl: 'https://webullapp.com/us/oauth2/token',
    scopes: ['quote', 'order', 'account'],
    supportsDepth: true, supportsTick: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// EXPORT AGGREGATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * 全部OAuth深度适配类型
 *
 * 基类: OAuthDepthBase, OAuthCredentials, OAuthTokenRefresher, WSParsedMessage
 *
 * Schwab: SchwabServiceType, SchwabLoginRequest, SchwabSubscribeRequest,
 *         SCHWAB_L1_FIELDS, SCHWAB_L2_FIELDS, SchwabL2Content, SchwabTickContent,
 *         SchwabServiceResponse, SchwabWSResponse
 *
 * E*TRADE: ETradeQuote, ETradeFullQuote, ETradeResponse, ETradePollConfig
 *
 * eToro: EToroWSPrice, EToroWSMessage, EToroTradeData, EToroErrorData, EToroInstrument
 *
 * Webull: WebullRealtimeType, WebullQuoteFields, WebullOrderBook, WebullOrderBookLevel,
 *         WebullTick, WebullSubscribeParams, WebullWSMessage
 *
 * 注册表: OAuthBrokerId, OAuthDepthAdapterFactory, OAuthRegistryEntry,
 *         OAUTH_BROKER_REGISTRY
 */
