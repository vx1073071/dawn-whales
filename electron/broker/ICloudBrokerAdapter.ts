// @ts-nocheck
/**
 * DAWN WHALES R129 J01 — ICloudBrokerAdapter
 * 
 * Server-side cloud broker adapter interface.
 * Extends IBrokerAdapterV2 semantics but lives on the Express server,
 * not in Electron main process. Supports REST/WS-based cloud brokers
 * (Binance, OKX, Bybit, etc.) that don't need local OpenD gateways.
 * 
 * Key differences from IBrokerAdapterV2:
 *  - No electron/Node native modules (uses fetch/ws instead)
 *  - Async-first (all methods return Promise)
 *  - Server-side lifecycle (health checks, graceful shutdown)
 *  - API Key from encrypted DB (AES-256-GCM) via CredentialManager
 */

// ═══════════════ Connection ══════════════════════════════════

export interface CloudBrokerConfig {
  brokerId: string;
  name: string;
  type: CloudBrokerType;
  /** API Key (decrypted at runtime) */
  apiKey: string;
  /** Secret Key (decrypted at runtime) */
  secretKey: string;
  /** Optional passphrase (OKX, Coinbase) */
  passphrase?: string;
  /** Base REST URL */
  restBaseUrl: string;
  /** Base WS URL */
  wsBaseUrl?: string;
  /** Extra options */
  options?: Record<string, unknown>;
}

export type CloudBrokerType =
  | 'binance' | 'binance-testnet'
  | 'okx' | 'okx-testnet'
  | 'bybit' | 'bybit-testnet'
  | 'bitget' | 'bitget-testnet'
  | 'robinhood'
  | 'ib' | 'tiger' | 'schwab' | 'etrade' | 'etoro'
  | 'mt5' | 'webull'
  ;

// ═══════════════ Tagged Data Types ═════════════════════════

export interface CloudQuoteInfo {
  brokerId: string;
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface CloudAccountInfo {
  brokerId: string;
  accountId: string;
  totalEquity: number;
  availableBalance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  currency: string;
}

export interface CloudPositionInfo {
  brokerId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage?: number;
}

export interface CloudOrderRequest {
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'STOP_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  clientOrderId?: string;
  reduceOnly?: boolean;
}

export interface CloudOrderInfo {
  brokerId: string;
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  quantity: number;
  price: number;
  filledQuantity: number;
  filledPrice: number;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  createdAt: number;
  updatedAt: number;
}

export interface CloudDepthSnapshot {
  brokerId: string;
  symbol: string;
  bids: [number, number][];  // [price, quantity]
  asks: [number, number][];
  timestamp: number;
}

// ═══════════════ Subscriber ═════════════════════════════════

export type CloudQuoteCallback = (quote: CloudQuoteInfo) => void;
export type CloudDepthCallback = (depth: CloudDepthSnapshot) => void;
export type CloudOrderCallback = (order: CloudOrderInfo) => void;
export type CloudErrorCallback = (error: Error) => void;

// ═══════════════ Core Interface ═══════════════════════════

export interface ICloudBrokerAdapter {
  // ── Identification ──
  readonly brokerId: string;
  readonly brokerName: string;
  readonly brokerType: CloudBrokerType;

  // ── Connection Lifecycle ──
  /** Connect: authenticate + open WS */
  connect(): Promise<void>;
  /** Disconnect: close WS, clean up */
  disconnect(): Promise<void>;
  /** Health check: ping REST endpoint */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
  /** Connection state */
  isConnected(): boolean;

  // ── Account ──
  getAccount(): Promise<CloudAccountInfo>;

  // ── Quotes & Market Data ──
  getQuotes(symbols: string[]): Promise<CloudQuoteInfo[]>;
  getDepth(symbol: string, limit?: number): Promise<CloudDepthSnapshot>;

  // ── Orders ──
  placeOrder(order: CloudOrderRequest): Promise<CloudOrderInfo>;
  cancelOrder(orderId: string, symbol: string): Promise<boolean>;
  getOpenOrders(symbol?: string): Promise<CloudOrderInfo[]>;
  getOrderHistory(symbol?: string, limit?: number): Promise<CloudOrderInfo[]>;

  // ── Subscriptions (push) ──
  subscribeQuotes(symbols: string[]): void;
  unsubscribeQuotes(symbols: string[]): void;
  subscribeDepth(symbol: string): void;
  unsubscribeDepth(symbol: string): void;

  // ── Event Listeners ──
  onQuote(callback: CloudQuoteCallback): void;
  onDepth(callback: CloudDepthCallback): void;
  onOrderUpdate(callback: CloudOrderCallback): void;
  onError(callback: CloudErrorCallback): void;

  // ── Cleanup ──
  /** Release all resources */
  dispose(): void;
}
