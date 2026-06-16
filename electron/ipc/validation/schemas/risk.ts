/**
 * QUANT MOO R123-Q01 — Risk IPC Schemas (Tier 1, 5 channels)
 * 
 * ALWAYS validated (financial-critical).
 * Covers: risk:getStatusSnapshot/getAlerts/updateConfig/getDrawdownState/getKellyStats
 */

import { z } from 'zod';

// ═══════════ risk:getStatusSnapshot ═════════════════════

export const RiskSnapshotRequest = z.object({}).passthrough();

export const RiskSnapshotResponse = z.object({
  success: z.boolean(),
  snapshot: z.object({
    totalEquity: z.number(),
    totalExposure: z.number(),
    marginUsed: z.number(),
    marginAvailable: z.number(),
    marginRatio: z.number().optional(),
    dailyPnL: z.number().default(0),
    dailyPnLPercent: z.number().default(0),
    maxDrawdown: z.number().optional(),
    var95: z.number().optional(),
    cvar95: z.number().optional(),
    sharpeRatio: z.number().optional(),
    leverageRatio: z.number().optional(),
    alertCount: z.number().int().default(0),
    timestamp: z.number(),
  }).passthrough().optional(),
}).passthrough();

// ═══════════ risk:getAlerts ═════════════════════════════

export const RiskAlertsRequest = z.object({
  acknowledged: z.boolean().optional(),
  level: z.enum(['info', 'warning', 'critical']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
}).passthrough();

export const RiskAlertsResponse = z.object({
  success: z.boolean(),
  alerts: z.array(z.object({
    id: z.string(),
    level: z.enum(['info', 'warning', 'critical']),
    type: z.enum(['margin', 'drawdown', 'exposure', 'liquidation', 'position_size', 'volatility']),
    message: z.string(),
    value: z.number(),
    threshold: z.number(),
    timestamp: z.number(),
    acknowledged: z.boolean().default(false),
  }).passthrough()).default([]),
}).passthrough();

// ═══════════ risk:updateConfig ══════════════════════════

export const RiskConfigUpdateRequest = z.object({
  maxPositionSize: z.number().positive().max(1e9).optional(),
  maxPositionSizePct: z.number().min(0).max(100).optional(),
  maxLeverage: z.number().min(1).max(125).optional(),
  maxDrawdown: z.number().min(0).max(100).optional(),
  dailyLossLimit: z.number().positive().optional(),
  cooldownMinutes: z.number().int().min(0).max(1440).optional(),
  autoHedge: z.boolean().optional(),
  enabled: z.boolean().optional(),
}).passthrough();

export const RiskConfigUpdateResponse = z.object({
  success: z.boolean(),
  updated: z.record(z.unknown()).default({}),
}).passthrough();

// ═══════════ risk:getDrawdownState ══════════════════════

export const DrawdownStateRequest = z.object({}).passthrough();

export const DrawdownStateResponse = z.object({
  success: z.boolean(),
  drawdown: z.object({
    current: z.number(),
    max: z.number(),
    maxDate: z.number().optional(),
    currentRecoveryPct: z.number().optional(),
    daysInDrawdown: z.number().int().optional(),
    emergencyTriggered: z.boolean().default(false),
  }).passthrough().optional(),
}).passthrough();

// ═══════════ risk:getKellyStats ═════════════════════════

export const KellyStatsRequest = z.object({
  symbol: z.string().optional(),
  lookbackDays: z.number().int().min(5).max(365).default(90),
}).passthrough();

export const KellyStatsResponse = z.object({
  success: z.boolean(),
  kelly: z.object({
    optimalFraction: z.number(),
    halfKelly: z.number(),
    quarterKelly: z.number(),
    winRate: z.number(),
    avgWin: z.number(),
    avgLoss: z.number(),
    tradesAnalyzed: z.number().int().default(0),
  }).passthrough().optional(),
}).passthrough();
