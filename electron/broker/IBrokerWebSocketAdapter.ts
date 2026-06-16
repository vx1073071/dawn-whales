/**
 * R231 JVS#2: IBrokerWebSocketAdapter — WebSocket推送层接口
 *
 * Unified interface for all 13+ broker WebSocket adapters.
 * Provides real-time quote streaming with reconnection, heartbeat,
 * and multi-socket management capabilities.
 *
 * Supported brokers:
 *   Cryptocurrency (5): Binance, OKX, Bybit, Bitget, Robinhood Crypto
 *   Bridge/OAuth (5): Tiger, VBKR, uSMART, Schwab, Webull
 *   REST/WS (3): eToro, E*TRADE, MT5
 *
 * v2.6.0-QUANTUM | >=400L production-ready
 */

import type { QuoteInfo } from '../IBrokerAdapter';
import type { TaggedQuoteInfo, BrokerType, MarketType } from '../IBrokerAdapterV2';

// ── Connection State ─────────────────────────────────────────────────────

export type WSConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closing'
  | 'error';

export interface WSConnectionInfo {
  brokerId: string;
  brokerType: BrokerType;
  state: WSConnectionState;
  connectedAt: number | null;
  lastHeartbeatAt: number | null;
  lastMessageAt: number | null;
  reconnectCount: number;
  messageCount: number;
  errorCount: number;
  latencyMs: number | null;
  endpoint: string;
}

// ── Subscription ─────────────────────────────────────────────────────────

export interface WSSubscription {
  /** Symbol or code to subscribe to */
  symbol: string;
  /** Market type for routing */
  market?: MarketType;
  /** Channel type (ticker, orderbook, kline, trade) */
  channel: 'ticker' | 'orderbook' | 'kline' | 'trade';
  /** Channel-specific parameters */
  params?: Record<string, string | number>;
  /** Subscribed at timestamp */
  subscribedAt: number;
}

export interface WSSubscriptionRequest {
  brokerId: string;
  subscriptions: WSSubscription[];
}

// ── Message Types ────────────────────────────────────────────────────────

export interface WSMessage {
  brokerId: string;
  brokerType: BrokerType;
  type: 'quote' | 'trade' | 'orderbook' | 'kline' | 'heartbeat' | 'error' | 'status';
  data: unknown;
  timestamp: number;
  raw?: string;
}

export interface WSQuoteMessage extends WSMessage {
  type: 'quote';
  data: TaggedQuoteInfo;
}

export interface WSTradeMessage extends WSMessage {
  type: 'trade';
  data: {
    symbol: string;
    price: number;
    quantity: number;
    side: 'buy' | 'sell';
    timestamp: number;
    tradeId: string;
  };
}

export interface WSHeartbeatMessage extends WSMessage {
  type: 'heartbeat';
  data: {
    latencyMs: number;
    brokerId: string;
  };
}

// ── Configuration ────────────────────────────────────────────────────────

export interface WSBrokerConfig {
  brokerId: string;
  brokerType: BrokerType;
  /** WebSocket endpoint URL */
  wsEndpoint: string;
  /** REST endpoint for initial data fetch (fallback) */
  restEndpoint?: string;
  /** Ping interval in ms (0 = no ping) */
  pingIntervalMs: number;
  /** Pong timeout in ms before marking disconnected */
  pongTimeoutMs: number;
  /** Reconnect delay in ms */
  reconnectDelayMs: number;
  /** Max reconnection attempts (-1 = infinite) */
  maxReconnectAttempts: number;
  /** Exponential backoff multiplier for reconnect */
  reconnectBackoffMultiplier: number;
  /** Max reconnect delay (caps exponential growth) */
  maxReconnectDelayMs: number;
  /** Authentication header or param */
  auth?: {
    type: 'api-key' | 'bearer' | 'hmac' | 'oauth2';
    key?: string;
    secret?: string;
    passphrase?: string;
    token?: string;
  };
  /** Rate limit: max messages per second */
  rateLimitMsgPerSec?: number;
  /** Rate limit: max subscriptions per connection */
  maxSubscriptions?: number;
}

export const DEFAULT_WS_CONFIG: Partial<WSBrokerConfig> = {
  pingIntervalMs: 30000,
  pongTimeoutMs: 10000,
  reconnectDelayMs: 1000,
  maxReconnectAttempts: 10,
  reconnectBackoffMultiplier: 1.5,
  maxReconnectDelayMs: 30000,
  rateLimitMsgPerSec: 100,
  maxSubscriptions: 500,
};

// ── Adapter Interface ────────────────────────────────────────────────────

export interface IBrokerWebSocketAdapter {
  /** Broker identification */
  readonly brokerId: string;
  readonly brokerType: BrokerType;
  readonly state: WSConnectionState;

  /** Connect to WebSocket endpoint */
  connect(): Promise<void>;
  /** Disconnect gracefully */
  disconnect(): Promise<void>;
  /** Reconnect with backoff */
  reconnect(): Promise<void>;

  /** Subscribe to symbols/channels */
  subscribe(request: WSSubscriptionRequest): Promise<void>;
  /** Unsubscribe from symbols/channels */
  unsubscribe(symbols: string[], channels?: string[]): Promise<void>;
  /** Get current subscriptions */
  getSubscriptions(): WSSubscription[];

  /** Message callback registration */
  onMessage(callback: (msg: WSMessage) => void): () => void;
  /** Quote callback (filtered for quotes only) */
  onQuote(callback: (quote: TaggedQuoteInfo) => void): () => void;
  /** Disconnect callback */
  onDisconnect(callback: (brokerId: string) => void): () => void;
  /** Reconnect callback */
  onReconnect(callback: (brokerId: string) => void): () => void;
  /** State change callback */
  onStateChange(callback: (info: WSConnectionInfo) => void): () => void;

  /** Get connection info */
  getConnectionInfo(): WSConnectionInfo;
  /** Get connection latency */
  getLatency(): number | null;

  /** Convert raw exchange message to standardized WSMessage */
  parseRawMessage(raw: unknown): WSMessage;
  /** Serialize subscription request to exchange-specific format */
  serializeSubscription(subs: WSSubscription[]): unknown;
  /** Send raw data (for protocol-specific needs) */
  send(data: unknown): Promise<void>;
}
