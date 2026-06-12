/**
 * Broker Adapter 统一类型定义
 * 所有券商适配器必须实现 IBrokerAdapter 接口
 */

export type Market = 'HK' | 'US' | 'CN' | 'SG' | 'JP' | 'CRYPTO' | 'EU';

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP';
export type OrderStatus = 'PENDING' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'DAY';

export interface BrokerCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;      // OKX / Coinbase
  accountId?: string;       // IB / Schwab
  sandbox?: boolean;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: TimeInForce;
  clientOrderId?: string;
}

export interface OrderResult {
  orderId: string;
  clientOrderId?: string;
  status: OrderStatus;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  avgPrice: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface Account {
  accountId: string;
  currency: string;
  cash: number;
  marketValue: number;
  totalEquity: number;
  buyingPower: number;
  marginUsed?: number;
}

export interface Trade {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  fee: number;
  timestamp: number;
}

export type DataCallback = (data: MarketDataEvent) => void;

export interface MarketDataEvent {
  type: 'QUOTE' | 'TRADE' | 'KLINE' | 'DEPTH' | 'ORDER_UPDATE';
  symbol: string;
  data: unknown;
  timestamp: number;
}

/** 所有券商适配器必须实现的接口 */
export interface IBrokerAdapter {
  readonly name: string;
  readonly markets: Market[];
  readonly supportsRealTime: boolean;

  /** 连接券商 */
  connect(credentials: BrokerCredentials): Promise<void>;

  /** 断开连接 */
  disconnect(): Promise<void>;

  /** 检查连接状态 */
  isConnected(): boolean;

  // ── 行情数据 ──

  /** 获取实时报价 */
  getQuote(symbol: string): Promise<Quote>;

  /** 获取 K 线数据 */
  getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;

  /** 订阅实时行情 */
  subscribeMarketData(symbols: string[], callback: DataCallback): Promise<void>;

  /** 取消订阅 */
  unsubscribeMarketData(symbols: string[]): Promise<void>;

  // ── 交易 ──

  /** 下单 */
  placeOrder(order: OrderRequest): Promise<OrderResult>;

  /** 撤单 */
  cancelOrder(orderId: string): Promise<void>;

  /** 改单 */
  modifyOrder(orderId: string, updates: Partial<OrderRequest>): Promise<OrderResult>;

  /** 查询订单 */
  getOrder(orderId: string): Promise<OrderResult | null>;

  // ── 账户 ──

  /** 获取账户信息 */
  getAccount(): Promise<Account>;

  /** 获取持仓 */
  getPositions(): Promise<Position[]>;

  /** 获取订单列表 */
  getOrders(status?: OrderStatus): Promise<OrderResult[]>;

  /** 获取成交记录 */
  getTrades(startTime?: Date, endTime?: Date): Promise<Trade[]>;
}
