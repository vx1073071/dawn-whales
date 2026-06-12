// ── DAWN WHALES — IBrokerAdapterV2 + Tagged Types ──────────────────────
// R1 INF-01: Extended broker interface with Tagged data types
// Location: electron/broker/IBrokerAdapter.ts (extends existing)
// Tagged types: brokerId贯穿所有行情/持仓/订单数据, 支持多券商并发

export interface BrokerConfig {
  id: string;           // e.g. 'futu-default', 'binance-spot', 'okx-main'
  name: string;         // display name
  type: BrokerType;     // 扩展至15+券商
  host: string;
  port: number;
  enabled: boolean;
  // R1新增: 连接配置
  apiKey?: string;      // REST/WS API Key (加密/OAuth券商)
  secretKey?: string;   // Secret Key
  passphrase?: string;  // OKX特殊字段
  options?: Record<string, unknown>; // 券商特有配置
}

// R1: 扩展券商类型到完整列表
export type BrokerType =
  // 已有4家
  | 'futu' | 'moomoo' | 'ib' | 'longbridge'
  // P0: Bridge模式
  | 'tiger' | 'vbkr' | 'usmart'
  // P0: 加密货币
  | 'binance' | 'okx' | 'bybit' | 'bitget'
  // P1: OAuth券商
  | 'schwab' | 'etrade' | 'etoro' | 'webull'
  // P1: Robinhood Crypto
  | 'robinhood'
  // P1特殊: MT5
  | 'mt5';

// ═══════════════════════════════════════════════════════════
// Tagged 数据类型 (R1新增 — 所有数据携带brokerId)
// ═══════════════════════════════════════════════════════════

export interface TaggedQuoteInfo {
  // 原始字段
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  time: string;
  // R1 Tagged扩展
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  market: MarketType;
  originalCode: string; // 原始券商代码(before normalization)
  standardCode: string; // 标准化后代码(UnifiedCode)
  bid?: number;         // 买一价(套利需要)
  ask?: number;         // 卖一价(套利需要)
  spreadPct?: number;   // 买卖价差百分比
  timestamp: number;    // UTC ms
}

export type MarketType = 'HK' | 'US' | 'CN' | 'CRYPTO' | 'SG' | 'JP' | 'UK' | 'EU';

export const MARKET_LABELS: Record<MarketType, string> = {
  HK: '港股', US: '美股', CN: 'A股', CRYPTO: '加密货币',
  SG: '新加坡', JP: '日本', UK: '英国', EU: '欧洲',
};

export interface TaggedPositionInfo {
  code: string;
  name: string;
  qty: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  ratio: number;
  // R1 Tagged扩展
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  market: MarketType;
  standardCode: string;
  currency: string;
  exchangeRate?: number; // 汇率(跨币种聚合用)
}

export interface TaggedOrderInfo {
  orderId: string;
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO';
  qty: number;
  price: number;
  filledQty: number;
  filledPrice: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  // R1 Tagged扩展
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  standardCode: string;
  commission?: number;
  commissionCurrency?: string;
}

export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

export interface TaggedPlaceOrderRequest {
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO';
  qty: number;
  price?: number;
  accountId?: string;
  // R1 Tagged扩展
  brokerId: string;             // 'auto' = 走SmartOrderRouter
  stopPrice?: number;            // 止损价
  trailPercent?: number;         // 跟踪止损百分比
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  clientOrderId?: string;        // 幂等key
  options?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════
// 券商特有类型 (R1新增)
// ═══════════════════════════════════════════════════════════

export interface TradingPairInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  minQty: number;
  maxQty: number;
  stepSize: number;
  tickSize: number;
  pricePrecision: number;
  qtyPrecision: number;
  isEnabled: boolean;
}

export interface OrderBookInfo {
  symbol: string;
  bids: Array<{ price: number; qty: number; brokerId?: string }>;
  asks: Array<{ price: number; qty: number; brokerId?: string }>;
  timestamp: number;
  brokerId?: string;
}

export interface MarginInfo {
  accountId: string;
  totalMargin: number;
  usedMargin: number;
  availableMargin: number;
  marginRatio: number;         // 0-1, >1 = 保证金不足
  marginCallLevel: number;
  currency: string;
  brokerId: string;
}

export interface BrokerConnectionStatus {
  brokerId: string;
  brokerName: string;
  brokerType: BrokerType;
  connected: boolean;
  connectedAt?: number;        // UTC ms
  latencyP50?: number;         // p50延迟ms
  latencyP99?: number;         // p99延迟ms
  errorRate?: number;          // 最近100次请求错误率
  lastError?: string;
  subscriptionsCount: number;
}

// ═══════════════════════════════════════════════════════════
// V2扩展接口 (extends 现有IBrokerAdapter)
// ═══════════════════════════════════════════════════════════

import type { AccountInfo, FundsInfo, PositionInfo, OrderInfo, QuoteInfo, KlineInfo, PlaceOrderRequest, IBrokerAdapter } from './IBrokerAdapter';

export interface IBrokerAdapterV2 extends IBrokerAdapter {
  // ── 原接口不变（向后兼容）────────────────────────────────
  // connect()/disconnect()
  // getQuotes(codes)/getKlines(code,period,count)
  // getAccounts()/getFunds(accountId)
  // getPositions(accountId)/getOrders(accountId)
  // placeOrder(order)/cancelOrder(orderId,accountId,code)
  // subscribeAndPush(codes)
  // onQuotePush(callback)/removeQuotePush(callback)/onDisconnect(callback)

  // ── V2新增能力 ────────────────────────────────────────────
  /** 获取可交易对列表(加密/OAuth券商) */
  getTradingPairs?(): Promise<TradingPairInfo[]>;

  /** 获取订单簿深度 */
  getDepth?(symbol: string, limit?: number): Promise<OrderBookInfo>;

  /** 获取历史订单 */
  getOrderHistory?(accountId: string, startDate?: string, endDate?: string): Promise<TaggedOrderInfo[]>;

  /** 获取保证金比例 */
  getMarginRatio?(accountId: string): Promise<MarginInfo>;

  /** 获取连接状态详情 */
  getConnectionStatus?(): BrokerConnectionStatus;

  /** 健康检查ping */
  ping?(): Promise<{ latency: number; timestamp: number }>;

  /** 获取支持的市场列表 */
  getMarkets(): MarketType[];

  /** 获取支持的订单类型 */
  getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'>;

  /** 是否需要本地网关(如OpenD/TWS) */
  requiresLocalGateway(): boolean;

  /** 获取券商类型 */
  getBrokerType(): BrokerType;

  /** 获取Token(如有, for QuoteAggregator/BrokerEventBus) */
  getToken?(): string;

  // ── 聚合回调(R1新增) ─────────────────────────────────────
  /** Tagged行情推送(代替原onQuotePush, 推送时自动Tagged) */
  onTaggedQuotePush?(callback: (quotes: TaggedQuoteInfo[]) => void): void;
  removeTaggedQuotePush?(callback: (quotes: TaggedQuoteInfo[]) => void): void;
}

export { type AccountInfo, type FundsInfo, type PositionInfo, type OrderInfo, type QuoteInfo, type KlineInfo, type PlaceOrderRequest };
