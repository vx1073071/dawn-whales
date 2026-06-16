/**
 * QUANT MOO R123-Q01 — Trade IPC Schemas (Tier 1, 5 channels)
 * 
 * ALWAYS validated regardless of NODE_ENV (financial-critical).
 * Covers: trade:execute/cancel/emergency-stop/get-orders/get-summary
 */

import { z } from 'zod';

// ═══════════ trade:execute ══════════════════════════════

export const TradeExecuteRequest = z.object({
  signalId: z.string().min(1),
  brokerId: z.string().min(1),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  type: z.enum(['market', 'limit']).default('market'),
  price: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  confirmed: z.boolean().default(false),
}).passthrough();

export const TradeExecuteResponse = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  brokerId: z.string().optional(),
  symbol: z.string().optional(),
  filledPrice: z.number().optional(),
  filledQuantity: z.number().optional(),
  error: z.string().optional(),
  timestamp: z.number().optional(),
}).passthrough();

// ═══════════ trade:cancel ═══════════════════════════════

export const TradeCancelRequest = z.object({
  orderId: z.string().min(1),
  brokerId: z.string().min(1),
}).passthrough();

export const TradeCancelResponse = z.object({
  success: z.boolean(),
  cancelled: z.boolean().default(false),
  error: z.string().optional(),
}).passthrough();

// ═══════════ trade:emergency-stop ═══════════════════════

export const EmergencyStopRequest = z.object({
  confirmed: z.literal(true),
  reason: z.string().optional(),
}).passthrough();

export const EmergencyStopResponse = z.object({
  success: z.boolean(),
  cancelledOrders: z.number().int().nonnegative().default(0),
  closedPositions: z.number().int().nonnegative().default(0),
  freedMargin: z.number().default(0),
  message: z.string(),
}).passthrough();

// ═══════════ trade:get-orders ═══════════════════════════

export const TradeGetOrdersRequest = z.object({
  brokerId: z.string().optional(),
  status: z.enum(['open', 'filled', 'cancelled', 'all']).default('open'),
  limit: z.number().int().min(1).max(200).default(50),
}).passthrough();

export const TradeGetOrdersResponse = z.object({
  success: z.boolean(),
  orders: z.array(z.object({
    orderId: z.string(),
    brokerId: z.string(),
    symbol: z.string(),
    side: z.enum(['buy', 'sell']),
    quantity: z.number(),
    filledQuantity: z.number().default(0),
    status: z.string(),
    signalId: z.string().optional(),
    timestamp: z.number(),
  }).passthrough()).default([]),
}).passthrough();

// ═══════════ trade:get-summary ═════════════════════════

export const TradeGetSummaryRequest = z.object({
  brokerId: z.string().optional(),
  since: z.number().positive().optional(),
}).passthrough();

export const TradeGetSummaryResponse = z.object({
  success: z.boolean(),
  summary: z.object({
    totalTrades: z.number().int().default(0),
    totalVolume: z.number().default(0),
    winRate: z.number().optional(),
    totalPnL: z.number().default(0),
    dailyPnL: z.number().default(0),
    sharpeRatio: z.number().optional(),
    maxDrawdown: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

// ═══════════ trade:get-positions ════════════════════════

export const TradeGetPositionsRequest = z.object({
  brokerId: z.string().optional(),
}).passthrough();

export const TradeGetPositionsResponse = z.object({
  success: z.boolean(),
  positions: z.array(z.object({
    brokerId: z.string(),
    symbol: z.string(),
    side: z.enum(['long', 'short']),
    quantity: z.number(),
    avgPrice: z.number(),
    currentPrice: z.number().optional(),
    unrealizedPnl: z.number().optional(),
    marketValue: z.number().optional(),
    signalId: z.string().optional(),
  }).passthrough()).default([]),
}).passthrough();

// ═══════════ trade:confirm-signal ═══════════════════════

export const TradeConfirmSignalRequest = z.object({
  signalId: z.string().min(1),
  confirmed: z.boolean(),
  adjustedQuantity: z.number().positive().optional(),
  adjustedStopLoss: z.number().positive().optional(),
}).passthrough();

export const TradeConfirmSignalResponse = z.object({
  success: z.boolean(),
  status: z.enum(['confirmed', 'rejected', 'adjusted']).optional(),
  error: z.string().optional(),
}).passthrough();
