/**
 * QUANT MOO R123-Q01 — Management IPC Schemas (Tier 3)
 * 
 * Covers: cache:*, db:*, prefs:*, notification:*, cron:*, snapshot:*, version:*
 * Dev-only validation (skipped in production unless --validate-ipc flag)
 */

import { z } from 'zod';

// ═══════════ cache ══════════════════════════════════════

export const CacheGetRequest = z.object({
  key: z.string().min(1),
  namespace: z.string().default('default'),
}).passthrough();

export const CacheSetRequest = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  ttlMs: z.number().positive().optional(),
  namespace: z.string().default('default'),
}).passthrough();

export const CacheDeleteRequest = z.object({
  key: z.string().min(1),
  namespace: z.string().default('default'),
}).passthrough();

export const CacheStatsResponse = z.object({
  success: z.boolean(),
  stats: z.object({
    totalEntries: z.number().int(),
    hitRate: z.number(),
    missRate: z.number(),
    totalSizeBytes: z.number(),
    namespaces: z.record(z.string(), z.number()),
  }).optional(),
}).passthrough();

// ═══════════ db ═════════════════════════════════════════

export const DbGetSettingsResponse = z.object({
  success: z.boolean(),
  settings: z.record(z.unknown()).default({}),
}).passthrough();

export const DbSaveSettingsRequest = z.object({
  settings: z.record(z.unknown()),
}).passthrough();

// ═══════════ prefs ══════════════════════════════════════

export const PrefsGetRequest = z.object({
  key: z.string().min(1),
  section: z.string().optional(),
}).passthrough();

export const PrefsSetRequest = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  section: z.string().optional(),
}).passthrough();

// ═══════════ notification ═══════════════════════════════

export const NotificationSendRequest = z.object({
  channel: z.enum(['system', 'telegram', 'feishu', 'email']),
  title: z.string().min(1),
  body: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  sound: z.boolean().default(true),
  data: z.record(z.unknown()).optional(),
}).passthrough();

// ═══════════ cron ═══════════════════════════════════════

export const CronScheduleRequest = z.object({
  name: z.string().min(1),
  schedule: z.string().min(1),
  task: z.enum(['backfill', 'health_check', 'quality_check', 'report', 'auto_backup']),
  params: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
}).passthrough();

// ═══════════ snapshot ═══════════════════════════════════

export const SnapshotCaptureRequest = z.object({
  type: z.enum(['portfolio', 'positions', 'risk', 'pnl']),
  label: z.string().optional(),
}).passthrough();

export const SnapshotListRequest = z.object({
  type: z.enum(['portfolio', 'positions', 'risk', 'pnl']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
}).passthrough();

// ═══════════ version ════════════════════════════════════

export const VersionGetRequest = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
}).passthrough();

// ═══════════ dashboard ══════════════════════════════════

export const DashboardSummaryResponse = z.object({
  success: z.boolean(),
  dashboard: z.object({
    totalEquity: z.number(),
    dailyPnL: z.number(),
    dailyPnLPercent: z.number(),
    activeTrades: z.number().int(),
    winRate: z.number().optional(),
    sharpeRatio: z.number().optional(),
    connectedBrokers: z.number().int(),
    totalBrokers: z.number().int(),
    lastUpdate: z.number(),
  }).optional(),
}).passthrough();

// ═══════════ condition ══════════════════════════════════

export const ConditionRulesResponse = z.object({
  success: z.boolean(),
  rules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    condition: z.record(z.unknown()),
    action: z.enum(['alert', 'trade', 'notification']),
    cooldownMs: z.number().int().default(60000),
    maxDaily: z.number().int().optional(),
    dailyCount: z.number().int().default(0),
  })).default([]),
}).passthrough();
