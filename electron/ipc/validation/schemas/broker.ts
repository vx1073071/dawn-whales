/**
 * DAWN WHALES R123-Q01 — Broker IPC Schemas (Tier 1, 10 channels)
 * 
 * Covers: broker:connect/disconnect/getQuotes/subscribe/getAccounts/
 *         getPositions/placeOrder/cancelOrder/getOrders/getStatus
 */

import { z } from 'zod';

// ═══════════ Shared ══════════════════════════════════════

const QuoteShape = z.object({
  symbol: z.string().min(1),
  brokerId: z.string().min(1),
  price: z.number().finite(),
  bid: z.number().finite().optional(),
  ask: z.number().finite().optional(),
  bidSize: z.number().optional(),
  askSize: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  volume: z.number().optional(),
  change24h: z.number().optional(),
  changePercent24h: z.number().optional(),
  timestamp: z.number().positive(),
}).passthrough();

const AccountShape = z.object({
  brokerId: z.string().min(1),
  accountId: z.string(),
  currency: z.string(),
  balance: z.number(),
  available: z.number(),
  unrealizedPnl: z.number().optional(),
}).passthrough();

const PositionShape = z.object({
  brokerId: z.string().min(1),
  symbol: z.string().min(1),
  side: z.enum(['long', 'short']),
  quantity: z.number(),
  avgPrice: z.number(),
  currentPrice: z.number().optional(),
  unrealizedPnl: z.number().optional(),
  marketValue: z.number().optional(),
}).passthrough();

// ═══════════ broker:connect ══════════════════════════════

export const BrokerConnectRequest = z.object({
  brokerId: z.string().min(1).max(50),
  credentials: z.object({
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    passphrase: z.string().optional(),
    oauthCode: z.string().optional(),
    oauthToken: z.string().optional(),
    paperTrading: z.boolean().default(false),
  }).passthrough(),
  options: z.record(z.unknown()).optional(),
}).passthrough();

export const BrokerConnectResponse = z.object({
  success: z.boolean(),
  brokerId: z.string(),
  status: z.enum(['connected', 'connecting', 'failed']),
  error: z.string().optional(),
  latencyMs: z.number().positive().optional(),
  serverTime: z.number().optional(),
}).passthrough();

// ═══════════ broker:disconnect ═══════════════════════════

export const BrokerDisconnectRequest = z.object({
  brokerId: z.string().min(1),
}).passthrough();

export const BrokerDisconnectResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}).passthrough();

// ═══════════ broker:getQuotes ════════════════════════════

export const BrokerGetQuotesRequest = z.object({
  symbols: z.array(z.string().min(1)).min(1).max(100),
  brokerId: z.string().optional(),
}).passthrough();

export const BrokerGetQuotesResponse = z.object({
  success: z.boolean(),
  quotes: z.array(QuoteShape).default([]),
}).passthrough();

// ═══════════ broker:subscribe ════════════════════════════

export const BrokerSubscribeRequest = z.object({
  symbols: z.array(z.string().min(1)).min(1).max(200),
  brokerId: z.string().optional(),
  type: z.enum(['quote', 'depth', 'tick', 'kline']).default('quote'),
  interval: z.string().optional(), // e.g. '1m','5m','1h' for kline
}).passthrough();

export const BrokerSubscribeResponse = z.object({
  success: z.boolean(),
  subscribed: z.number().int().nonnegative(),
  failed: z.array(z.object({ symbol: z.string(), reason: z.string() })).default([]),
}).passthrough();

// ═══════════ broker:getAccounts ══════════════════════════

export const BrokerGetAccountsRequest = z.object({
  brokerId: z.string().optional(), // omit = all brokers
}).passthrough();

export const BrokerGetAccountsResponse = z.object({
  success: z.boolean(),
  accounts: z.array(AccountShape).default([]),
}).passthrough();

// ═══════════ broker:getPositions ═════════════════════════

export const BrokerGetPositionsRequest = z.object({
  brokerId: z.string().optional(),
}).passthrough();

export const BrokerGetPositionsResponse = z.object({
  success: z.boolean(),
  positions: z.array(PositionShape).default([]),
}).passthrough();

// ═══════════ broker:placeOrder ══════════════════════════

export const BrokerPlaceOrderRequest = z.object({
  brokerId: z.string().min(1),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop_loss', 'take_profit', 'trailing_stop', 'oco']),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
  trailingPct: z.number().min(0).max(100).optional(),
  ocoTakeProfit: z.number().optional(),
  ocoStopLoss: z.number().optional(),
  timeInForce: z.enum(['GTC', 'IOC', 'FOK', 'DAY']).default('GTC'),
  confirmed: z.boolean().default(false),
  clientOrderId: z.string().optional(),
}).passthrough();

export const BrokerPlaceOrderResponse = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  symbol: z.string().optional(),
  side: z.string().optional(),
  type: z.string().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  filledQuantity: z.number().optional(),
  filledPrice: z.number().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  estimatedFee: z.number().optional(),
}).passthrough();

// ═══════════ broker:cancelOrder ══════════════════════════

export const BrokerCancelOrderRequest = z.object({
  brokerId: z.string().min(1),
  orderId: z.string().min(1),
  symbol: z.string().optional(),
}).passthrough();

export const BrokerCancelOrderResponse = z.object({
  success: z.boolean(),
  cancelled: z.boolean().default(false),
  error: z.string().optional(),
}).passthrough();

// ═══════════ broker:getOrders ════════════════════════════

export const BrokerGetOrdersRequest = z.object({
  brokerId: z.string().optional(),
  symbol: z.string().optional(),
  status: z.enum(['open', 'filled', 'cancelled', 'all']).default('open'),
  limit: z.number().int().min(1).max(500).default(50),
}).passthrough();

export const BrokerGetOrdersResponse = z.object({
  success: z.boolean(),
  orders: z.array(z.object({
    orderId: z.string(),
    brokerId: z.string(),
    symbol: z.string(),
    side: z.enum(['buy', 'sell']),
    type: z.string(),
    quantity: z.number(),
    price: z.number().optional(),
    filledQuantity: z.number().default(0),
    filledPrice: z.number().optional(),
    status: z.string(),
    createdAt: z.number(),
    updatedAt: z.number().optional(),
  }).passthrough()).default([]),
}).passthrough();

// ═══════════ broker:getStatus ════════════════════════════

export const BrokerGetStatusRequest = z.object({
  brokerId: z.string().min(1),
}).passthrough();

export const BrokerGetStatusResponse = z.object({
  success: z.boolean(),
  brokerId: z.string(),
  connected: z.boolean(),
  connectedAt: z.number().optional(),
  subscriptionsCount: z.number().optional(),
  latencyP50: z.number().optional(),
  latencyP99: z.number().optional(),
  error: z.string().optional(),
}).passthrough();
