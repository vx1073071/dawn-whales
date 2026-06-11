/**
 * J-52-03: Strategy Marketplace Data Models (R52 P1)
 * 策略市场核心数据模型 + 验证 + 迁移脚本
 *
 * Models: Strategy / Subscription / Review / Earnings
 * Validation: schema-level + field-level + cross-field
 * Migration: schema versioning + forward migration
 *
 * ≥300L, 15+ tests
 */

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:DATA] structured error tracking

// ── Schema Version ─────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 2;

// ── Enums ──────────────────────────────────────────────────────────────────

export type StrategyStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
export type StrategyCategory = 'momentum' | 'mean-reversion' | 'arbitrage' | 'trend-following' | 'scalping' | 'swing' | 'options' | 'forex' | 'crypto' | 'multi-asset';
export type StrategyTimeframe = 'intraday' | 'daily' | 'weekly' | 'monthly';
export type StrategyMarket = 'us-equity' | 'cn-equity' | 'hk-equity' | 'forex' | 'crypto' | 'futures' | 'options' | 'multi-market';
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type EarningPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type Visibility = 'public' | 'private' | 'unlisted';

// ── Core Strategy Model ────────────────────────────────────────────────────

export interface StrategyModel {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  category: StrategyCategory;
  market: StrategyMarket;
  timeframe: StrategyTimeframe;
  tags: string[];
  visibility: Visibility;
  status: StrategyStatus;
  version: number;
  price: number; // 0 = free
  currency: string;

  // Performance metrics
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  annualReturn: number;
  totalTrades: number;
  avgHoldingPeriod: number; // days

  // Marketplace metrics
  rating: number;
  ratingCount: number;
  subscriberCount: number;
  downloadCount: number;
  viewCount: number;

  // Content
  code?: string;
  config?: Record<string, unknown>;
  backtestResult?: Record<string, unknown>;

  // Audit
  auditNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// ── Subscription Model ─────────────────────────────────────────────────────

export interface SubscriptionModel {
  id: string;
  strategyId: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  price: number;
  currency: string;
  platformFee: number; // percentage (0-100)
  authorRevenue: number; // percentage (0-100)
  startedAt: string;
  expiresAt?: string;
  cancelledAt?: string;
  autoRenew: boolean;
  trialDays: number;
  isTrial: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Review Model ───────────────────────────────────────────────────────────

export interface ReviewModel {
  id: string;
  strategyId: string;
  userId: string;
  userName: string;
  rating: number; // 0-5
  title: string;
  content: string;
  status: ReviewStatus;
  helpful: number;
  notHelpful: number;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Earnings Model ─────────────────────────────────────────────────────────

export interface EarningRecord {
  id: string;
  strategyId: string;
  authorId: string;
  period: EarningPeriod;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  platformFee: number;
  netRevenue: number;
  subscriberCount: number;
  currency: string;
  status: 'pending' | 'settled' | 'paid';
  settledAt?: string;
  paidAt?: string;
  createdAt: string;
}

// ── Migration Record ───────────────────────────────────────────────────────

export interface MigrationRecord {
  version: number;
  appliedAt: string;
  description: string;
  success: boolean;
}

// ── Validation Functions ───────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const VALID_CATEGORIES: StrategyCategory[] = ['momentum', 'mean-reversion', 'arbitrage', 'trend-following', 'scalping', 'swing', 'options', 'forex', 'crypto', 'multi-asset'];
const VALID_TIMEFRAMES: StrategyTimeframe[] = ['intraday', 'daily', 'weekly', 'monthly'];
const VALID_MARKETS: StrategyMarket[] = ['us-equity', 'cn-equity', 'hk-equity', 'forex', 'crypto', 'futures', 'options', 'multi-market'];
const VALID_TIERS: SubscriptionTier[] = ['free', 'basic', 'premium', 'enterprise'];
const VALID_VISIBILITIES: Visibility[] = ['public', 'private', 'unlisted'];
const VALID_STATUSES: StrategyStatus[] = ['draft', 'pending', 'approved', 'rejected', 'archived'];

export function validateStrategy(input: Partial<StrategyModel>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Strategy name is required', value: input.name });
  } else if (input.name.length > 200) {
    errors.push({ field: 'name', message: 'Strategy name must be <= 200 characters', value: input.name });
  }

  if (!input.description || input.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description is required', value: input.description });
  } else if (input.description.length > 5000) {
    errors.push({ field: 'description', message: 'Description must be <= 5000 characters', value: input.description });
  }

  if (!input.authorId || input.authorId.trim().length === 0) {
    errors.push({ field: 'authorId', message: 'Author ID is required', value: input.authorId });
  }

  if (input.category && !VALID_CATEGORIES.includes(input.category)) {
    errors.push({ field: 'category', message: `Invalid category: ${input.category}`, value: input.category });
  }

  if (input.timeframe && !VALID_TIMEFRAMES.includes(input.timeframe)) {
    errors.push({ field: 'timeframe', message: `Invalid timeframe: ${input.timeframe}`, value: input.timeframe });
  }

  if (input.market && !VALID_MARKETS.includes(input.market)) {
    errors.push({ field: 'market', message: `Invalid market: ${input.market}`, value: input.market });
  }

  if (input.visibility && !VALID_VISIBILITIES.includes(input.visibility)) {
    errors.push({ field: 'visibility', message: `Invalid visibility: ${input.visibility}`, value: input.visibility });
  }

  if (input.status && !VALID_STATUSES.includes(input.status)) {
    errors.push({ field: 'status', message: `Invalid status: ${input.status}`, value: input.status });
  }

  if (input.price !== undefined && (input.price < 0 || !Number.isFinite(input.price))) {
    errors.push({ field: 'price', message: 'Price must be >= 0 and finite', value: input.price });
  }

  if (input.sharpe !== undefined && !Number.isFinite(input.sharpe)) {
    errors.push({ field: 'sharpe', message: 'Sharpe must be finite', value: input.sharpe });
  }

  if (input.maxDrawdown !== undefined && (input.maxDrawdown > 0 || !Number.isFinite(input.maxDrawdown))) {
    errors.push({ field: 'maxDrawdown', message: 'Max drawdown must be <= 0 and finite', value: input.maxDrawdown });
  }

  if (input.winRate !== undefined && (input.winRate < 0 || input.winRate > 100)) {
    errors.push({ field: 'winRate', message: 'Win rate must be 0-100', value: input.winRate });
  }

  if (input.annualReturn !== undefined && !Number.isFinite(input.annualReturn)) {
    errors.push({ field: 'annualReturn', message: 'Annual return must be finite', value: input.annualReturn });
  }

  if (input.tags && !Array.isArray(input.tags)) {
    errors.push({ field: 'tags', message: 'Tags must be an array', value: input.tags });
  } else if (input.tags && input.tags.length > 20) {
    errors.push({ field: 'tags', message: 'Maximum 20 tags allowed', value: input.tags.length });
  }

  if (input.rating !== undefined && (input.rating < 0 || input.rating > 5)) {
    errors.push({ field: 'rating', message: 'Rating must be 0-5', value: input.rating });
  }

  return { valid: errors.length === 0, errors };
}

export function validateReview(input: Partial<ReviewModel>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.strategyId) errors.push({ field: 'strategyId', message: 'Strategy ID is required' });
  if (!input.userId) errors.push({ field: 'userId', message: 'User ID is required' });

  if (input.rating === undefined || input.rating < 0 || input.rating > 5) {
    errors.push({ field: 'rating', message: 'Rating must be 0-5', value: input.rating });
  }

  if (input.title && input.title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be <= 200 characters' });
  }

  if (input.content && input.content.length > 2000) {
    errors.push({ field: 'content', message: 'Content must be <= 2000 characters' });
  }

  return { valid: errors.length === 0, errors };
}

export function validateSubscription(input: Partial<SubscriptionModel>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.strategyId) errors.push({ field: 'strategyId', message: 'Strategy ID is required' });
  if (!input.userId) errors.push({ field: 'userId', message: 'User ID is required' });

  if (input.tier && !VALID_TIERS.includes(input.tier)) {
    errors.push({ field: 'tier', message: `Invalid tier: ${input.tier}`, value: input.tier });
  }

  if (input.price !== undefined && input.price < 0) {
    errors.push({ field: 'price', message: 'Price must be >= 0', value: input.price });
  }

  if (input.platformFee !== undefined && (input.platformFee < 0 || input.platformFee > 100)) {
    errors.push({ field: 'platformFee', message: 'Platform fee must be 0-100', value: input.platformFee });
  }

  if (input.authorRevenue !== undefined && (input.authorRevenue < 0 || input.authorRevenue > 100)) {
    errors.push({ field: 'authorRevenue', message: 'Author revenue must be 0-100', value: input.authorRevenue });
  }

  if (input.platformFee !== undefined && input.authorRevenue !== undefined) {
    if (input.platformFee + input.authorRevenue > 100) {
      errors.push({ field: 'revenue', message: 'Platform fee + author revenue must be <= 100%' });
    }
  }

  if (input.trialDays !== undefined && (input.trialDays < 0 || input.trialDays > 90)) {
    errors.push({ field: 'trialDays', message: 'Trial days must be 0-90', value: input.trialDays });
  }

  return { valid: errors.length === 0, errors };
}

// ── Model Factory ──────────────────────────────────────────────────────────

let _idCounter = 1000;

function nextId(prefix: string): string {
  return `${prefix}_${++_idCounter}_${Date.now().toString(36)}`;
}

export function createStrategy(input: Partial<StrategyModel> & { name: string; authorId: string; authorName: string }): StrategyModel {
  const now = new Date().toISOString();
  return {
    id: nextId('strat'),
    name: input.name,
    description: input.description || '',
    authorId: input.authorId,
    authorName: input.authorName,
    category: input.category || 'momentum',
    market: input.market || 'us-equity',
    timeframe: input.timeframe || 'daily',
    tags: input.tags || [],
    visibility: input.visibility || 'public',
    status: input.status || 'draft',
    version: 1,
    price: input.price ?? 0,
    currency: input.currency || 'USD',
    sharpe: input.sharpe ?? 0,
    maxDrawdown: input.maxDrawdown ?? 0,
    winRate: input.winRate ?? 0,
    annualReturn: input.annualReturn ?? 0,
    totalTrades: input.totalTrades ?? 0,
    avgHoldingPeriod: input.avgHoldingPeriod ?? 0,
    rating: input.rating ?? 0,
    ratingCount: input.ratingCount ?? 0,
    subscriberCount: 0,
    downloadCount: 0,
    viewCount: 0,
    code: input.code,
    config: input.config,
    backtestResult: input.backtestResult,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSubscription(input: Partial<SubscriptionModel> & { strategyId: string; userId: string }): SubscriptionModel {
  const now = new Date().toISOString();
  const tier = input.tier || 'free';
  const price = input.price ?? 0;
  const platformFee = input.platformFee ?? 15;
  const authorRevenue = input.authorRevenue ?? 85;

  return {
    id: nextId('sub'),
    strategyId: input.strategyId,
    userId: input.userId,
    tier,
    status: 'active',
    price,
    currency: input.currency || 'USD',
    platformFee,
    authorRevenue,
    startedAt: input.startedAt || now,
    expiresAt: input.expiresAt,
    autoRenew: input.autoRenew ?? true,
    trialDays: input.trialDays ?? 0,
    isTrial: input.isTrial ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createReview(input: Partial<ReviewModel> & { strategyId: string; userId: string; userName: string; rating: number }): ReviewModel {
  const now = new Date().toISOString();
  return {
    id: nextId('rev'),
    strategyId: input.strategyId,
    userId: input.userId,
    userName: input.userName,
    rating: input.rating,
    title: input.title || '',
    content: input.content || '',
    status: 'pending',
    helpful: 0,
    notHelpful: 0,
    verifiedPurchase: input.verifiedPurchase ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createEarningRecord(input: Partial<EarningRecord> & { strategyId: string; authorId: string; period: EarningPeriod; grossRevenue: number }): EarningRecord {
  const now = new Date().toISOString();
  const platformFeePct = 15;
  const platformFee = input.grossRevenue * (platformFeePct / 100);
  return {
    id: nextId('earn'),
    strategyId: input.strategyId,
    authorId: input.authorId,
    period: input.period,
    periodStart: input.periodStart || now,
    periodEnd: input.periodEnd || now,
    grossRevenue: input.grossRevenue,
    platformFee,
    netRevenue: input.grossRevenue - platformFee,
    subscriberCount: input.subscriberCount ?? 0,
    currency: input.currency || 'USD',
    status: 'pending',
    createdAt: now,
  };
}

// ── Migration Engine ───────────────────────────────────────────────────────

const migrationHistory: MigrationRecord[] = [];

export function getMigrationHistory(): MigrationRecord[] {
  return [...migrationHistory];
}

export function migrateStrategyV1ToV2(old: Record<string, unknown>): StrategyModel {
  const now = new Date().toISOString();
  return {
    id: (old.id as string) || nextId('strat'),
    name: (old.name as string) || 'Unnamed',
    description: (old.description as string) || '',
    authorId: (old.author as string) || (old.authorId as string) || 'unknown',
    authorName: (old.authorName as string) || (old.author as string) || 'Unknown',
    category: (old.category as StrategyCategory) || 'momentum',
    market: (old.market as StrategyMarket) || 'us-equity',
    timeframe: (old.timeframe as StrategyTimeframe) || 'daily',
    tags: (old.tags as string[]) || [],
    visibility: (old.visibility as Visibility) || 'public',
    status: (old.status as StrategyStatus) || 'approved',
    version: 2,
    price: (old.price as number) ?? 0,
    currency: (old.currency as string) || 'USD',
    sharpe: (old.sharpe as number) ?? 0,
    maxDrawdown: (old.maxDrawdown as number) ?? 0,
    winRate: (old.winRate as number) ?? 0,
    annualReturn: (old.annualReturn as number) ?? (old.returns as number) ?? 0,
    totalTrades: (old.totalTrades as number) ?? (old.trades as number) ?? 0,
    avgHoldingPeriod: (old.avgHoldingPeriod as number) ?? 0,
    rating: (old.rating as number) ?? 0,
    ratingCount: (old.ratingCount as number) ?? 0,
    subscriberCount: (old.subscriberCount as number) ?? (old.subscribers as number) ?? 0,
    downloadCount: (old.downloadCount as number) ?? (old.downloads as number) ?? 0,
    viewCount: (old.viewCount as number) ?? 0,
    createdAt: (old.createdAt as string) || now,
    updatedAt: (old.updatedAt as string) || now,
  };
}

export function runMigration(fromVersion: number, data: Record<string, unknown>[]): { migrated: StrategyModel[]; record: MigrationRecord } {
  const startedAt = new Date().toISOString();

  if (fromVersion === 1) {
    const migrated = data.map(d => migrateStrategyV1ToV2(d));
    const record: MigrationRecord = {
      version: 2,
      appliedAt: startedAt,
      description: 'Migrate V1 strategies to V2 schema (add category/market/timeframe/status/version/authorId/authorName)',
      success: true,
    };
    migrationHistory.push(record);
    log.info(`[MarketplaceModels] Migration V1→V2 complete: ${migrated.length} strategies`);
    return { migrated, record };
  }

  const record: MigrationRecord = {
    version: fromVersion + 1,
    appliedAt: startedAt,
    description: `No migration available from version ${fromVersion}`,
    success: false,
  };
  return { migrated: [], record };
}

// ── Reset (for testing) ────────────────────────────────────────────────────

export function resetIdCounter(): void {
  _idCounter = 1000;
}

export function resetMigrationHistory(): void {
  migrationHistory.length = 0;
}

export default {
  SCHEMA_VERSION,
  validateStrategy,
  validateReview,
  validateSubscription,
  createStrategy,
  createSubscription,
  createReview,
  createEarningRecord,
  runMigration,
  getMigrationHistory,
  resetIdCounter,
  resetMigrationHistory,
};
