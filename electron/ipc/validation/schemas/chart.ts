/**
 * DAWN WHALES R123-Q01 — Chart / Indicator / Depth IPC Schemas (Tier 2)
 * 
 * Covers: chart:getKlines, indicator:compute, depth:getOrderBook, alert:subscribe, scanner:search
 */

import { z } from 'zod';

// ═══════════ chart:getKlines ════════════════════════════

export const GetKlinesRequest = z.object({
  symbol: z.string().min(1),
  brokerId: z.string().optional(),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W', 'M']),
  adjust: z.enum(['none', 'pre', 'post']).default('none'),
  count: z.number().int().min(1).max(5000).default(200),
  startTime: z.number().positive().optional(),
  endTime: z.number().positive().optional(),
}).passthrough();

export const GetKlinesResponse = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
    turnover: z.number().optional(),
  })).default([]),
}).passthrough();

// ═══════════ indicator:compute ══════════════════════════

export const IndicatorComputeRequest = z.object({
  symbol: z.string().min(1),
  indicatorIds: z.array(z.string()).min(1).max(20),
  bars: z.array(z.object({
    time: z.number(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  })).min(1).max(10000),
  params: z.record(z.string(), z.record(z.string(), z.number())).optional(),
}).passthrough();

export const IndicatorComputeResponse = z.object({
  success: z.boolean(),
  indicators: z.array(z.object({
    indicatorId: z.string(),
    name: z.string(),
    results: z.array(z.record(z.string(), z.union([z.number(), z.null(), z.boolean().optional()]))).default([]),
  })).default([]),
}).passthrough();

// ═══════════ depth:getOrderBook ═════════════════════════

export const GetOrderBookRequest = z.object({
  symbol: z.string().min(1),
  brokerId: z.string().optional(),
  depth: z.number().int().min(5).max(50).default(20),
}).passthrough();

export const GetOrderBookResponse = z.object({
  success: z.boolean(),
  data: z.object({
    symbol: z.string(),
    exchange: z.string(),
    bids: z.array(z.object({ price: z.number(), size: z.number(), orderCount: z.number().int().optional() })),
    asks: z.array(z.object({ price: z.number(), size: z.number(), orderCount: z.number().int().optional() })),
    best: z.object({
      bidPrice: z.number(), bidSize: z.number(),
      askPrice: z.number(), askSize: z.number(),
      spread: z.number(), spreadPercent: z.number(),
    }),
    updateId: z.number(),
    timestamp: z.number(),
  }).optional(),
}).passthrough();

// ═══════════ alert:subscribe ════════════════════════════

export const AlertSubscribeRequest = z.object({
  rules: z.array(z.object({
    symbol: z.string().min(1),
    type: z.enum(['price', 'volume', 'pattern', 'indicator', 'spread']),
    condition: z.object({
      field: z.string(),
      operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'between', 'cross_above', 'cross_below']),
      value: z.number(),
      value2: z.number().optional(),
    }),
    channels: z.array(z.enum(['system', 'telegram', 'feishu', 'email'])).default(['system']),
    cooldownMs: z.number().int().min(1000).default(60000),
  })).min(1).max(50),
}).passthrough();

// ═══════════ scanner:search ═════════════════════════════

export const ScannerSearchRequest = z.object({
  market: z.enum(['HK', 'US', 'CN', 'CRYPTO', 'FOREX']),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'between', 'cross_above', 'cross_below']),
    value: z.number(),
    value2: z.number().optional(),
  })).min(1),
  logic: z.enum(['AND', 'OR']).default('AND'),
  sort: z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }).optional(),
  limit: z.number().int().min(1).max(200).default(50),
}).passthrough();

// ═══════════ data:news ══════════════════════════════════

export const DataNewsRequest = z.object({
  symbol: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20),
  language: z.enum(['zh', 'en']).default('zh'),
}).passthrough();

export const DataNewsResponse = z.object({
  success: z.boolean(),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    source: z.string(),
    url: z.string().optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    timestamp: z.number(),
  })).default([]),
}).passthrough();

// ═══════════ fundflow:getSnapshot ═══════════════════════

export const FundFlowRequest = z.object({
  symbol: z.string().min(1),
  type: z.enum(['stock', 'sector', 'market']).default('stock'),
}).passthrough();

// ═══════════ ws:connect ════════════════════════════════

export const WsConnectRequest = z.object({
  url: z.string().optional(),
  brokerId: z.string().optional(),
  autoReconnect: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(20).default(5),
}).passthrough();

// ═══════════ ws:subscribe ══════════════════════════════

export const WsSubscribeRequest = z.object({
  symbols: z.array(z.string()).min(1).max(500),
  channels: z.array(z.enum([
    'quote', 'depth', 'tick',
    'kline_1m', 'kline_5m', 'kline_15m',
    'kline_1h', 'kline_4h', 'kline_D',
  ])).default(['quote']),
  brokerId: z.string().optional(),
}).passthrough();
