/**
 * J-52-02: Strategy Subscription + Earnings Engine (R52 P0)
 * 策略订阅管理 + 收益分成 + 结算系统
 *
 * Features:
 * - Subscribe/unsubscribe to strategies
 * - Tier-based access control (free/basic/premium/enterprise)
 * - Revenue split: author 85% / platform 15%
 * - Earnings tracking per strategy per period
 * - Settlement processing (weekly/monthly)
 * - Subscriber-only content gating
 *
 * ≥400L, 25+ tests
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended';
export type EarningStatus = 'pending' | 'settled' | 'paid';
export type EarningPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface Subscription {
  id: string;
  strategyId: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  price: number;
  currency: string;
  startedAt: string;
  expiresAt?: string;
  cancelledAt?: string;
  autoRenew: boolean;
  trialDays: number;
  isTrial: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EarningRecord {
  id: string;
  strategyId: string;
  authorId: string;
  period: EarningPeriod;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  platformFee: number;
  authorRevenue: number;
  netRevenue: number; // authorRevenue - any taxes/fees
  subscriberCount: number;
  newSubscribers: number;
  cancelledSubscribers: number;
  currency: string;
  status: EarningStatus;
  settledAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface RevenueSplit {
  authorPercent: number;
  platformPercent: number;
  minPayout: number;
  currency: string;
}

export interface SubscriptionStats {
  totalActive: number;
  totalExpired: number;
  totalCancelled: number;
  totalRevenue: number;
  avgRevenuePerSub: number;
  tierBreakdown: Record<SubscriptionTier, number>;
}

export interface AuthorEarningsSummary {
  authorId: string;
  totalGross: number;
  totalPlatformFee: number;
  totalNet: number;
  totalSubscribers: number;
  strategyCount: number;
  pendingPayout: number;
  currency: string;
}

// ── Default Revenue Split ──────────────────────────────────────────────────

const DEFAULT_SPLIT: RevenueSplit = {
  authorPercent: 85,
  platformPercent: 15,
  minPayout: 10.0,
  currency: 'USD',
};

// ── Tier Pricing Defaults ──────────────────────────────────────────────────

const TIER_PRICES: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 9.99,
  premium: 29.99,
  enterprise: 99.99,
};

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: ['view-public', 'basic-search'],
  basic: ['view-public', 'basic-search', 'view-strategies', 'basic-analytics'],
  premium: ['view-public', 'basic-search', 'view-strategies', 'basic-analytics', 'advanced-analytics', 'priority-support', 'backtest-access'],
  enterprise: ['view-public', 'basic-search', 'view-strategies', 'basic-analytics', 'advanced-analytics', 'priority-support', 'backtest-access', 'api-access', 'custom-integrations', 'dedicated-support'],
};

// ── Subscription Engine ────────────────────────────────────────────────────

export class SubscriptionEarnings {
  private subscriptions: Map<string, Subscription> = new Map();
  private earnings: Map<string, EarningRecord> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map(); // userId → Set<subscriptionId>
  private strategySubscriptions: Map<string, Set<string>> = new Map(); // strategyId → Set<subscriptionId>
  private idCounter = 1;
  private split: RevenueSplit;

  constructor(split?: Partial<RevenueSplit>) {
    this.split = { ...DEFAULT_SPLIT, ...split };
    log.info('[SubscriptionEarnings] Initialized');
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────

  subscribe(params: {
    strategyId: string;
    userId: string;
    tier?: SubscriptionTier;
    price?: number;
    trialDays?: number;
    autoRenew?: boolean;
  }): Subscription {
    const { strategyId, userId, tier = 'free', trialDays = 0, autoRenew = true } = params;

    // Check for existing active subscription
    const existing = this.getUserActiveSubscription(userId, strategyId);
    if (existing) {
      log.warn(`[SubscriptionEarnings] User ${userId} already has active subscription to ${strategyId}`);
      return existing;
    }

    const price = params.price ?? TIER_PRICES[tier];
    const now = new Date().toISOString();
    const isTrial = trialDays > 0;

    const sub: Subscription = {
      id: `sub_${this.idCounter++}`,
      strategyId,
      userId,
      tier,
      status: 'active',
      price,
      currency: 'USD',
      startedAt: now,
      expiresAt: trialDays > 0 ? new Date(Date.now() + trialDays * 86400000).toISOString() : undefined,
      autoRenew,
      trialDays,
      isTrial,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(sub.id, sub);

    // Index by user
    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }
    this.userSubscriptions.get(userId)!.add(sub.id);

    // Index by strategy
    if (!this.strategySubscriptions.has(strategyId)) {
      this.strategySubscriptions.set(strategyId, new Set());
    }
    this.strategySubscriptions.get(strategyId)!.add(sub.id);

    log.info(`[SubscriptionEarnings] User ${userId} subscribed to ${strategyId} (${tier}, $${price})`);
    return sub;
  }

  // ── Unsubscribe ──────────────────────────────────────────────────────────

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      log.warn(`[SubscriptionEarnings] Subscription not found: ${subscriptionId}`);
      return false;
    }
    if (sub.status !== 'active') {
      log.warn(`[SubscriptionEarnings] Subscription ${subscriptionId} is not active (status: ${sub.status})`);
      return false;
    }

    const now = new Date().toISOString();
    sub.status = 'cancelled';
    sub.cancelledAt = now;
    sub.updatedAt = now;

    log.info(`[SubscriptionEarnings] User ${sub.userId} unsubscribed from ${sub.strategyId}`);
    return true;
  }

  /**
   * Unsubscribe by user + strategy (finds active sub)
   */
  unsubscribeByUserStrategy(userId: string, strategyId: string): boolean {
    const sub = this.getUserActiveSubscription(userId, strategyId);
    if (!sub) return false;
    return this.unsubscribe(sub.id);
  }

  // ── Query Subscriptions ───────────────────────────────────────────────────

  getSubscription(id: string): Subscription | null {
    return this.subscriptions.get(id) || null;
  }

  getUserActiveSubscription(userId: string, strategyId: string): Subscription | null {
    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) return null;

    for (const subId of userSubs) {
      const sub = this.subscriptions.get(subId);
      if (sub && sub.strategyId === strategyId && sub.status === 'active') {
        // Check expiry
        if (sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) {
          sub.status = 'expired';
          sub.updatedAt = new Date().toISOString();
          continue;
        }
        return sub;
      }
    }
    return null;
  }

  getUserSubscriptions(userId: string, statusFilter?: SubscriptionStatus): Subscription[] {
    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) return [];

    const result: Subscription[] = [];
    for (const subId of userSubs) {
      const sub = this.subscriptions.get(subId);
      if (sub) {
        // Auto-expire check
        if (sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) {
          sub.status = 'expired';
          sub.updatedAt = new Date().toISOString();
        }
        if (!statusFilter || sub.status === statusFilter) {
          result.push(sub);
        }
      }
    }
    return result;
  }

  getStrategySubscribers(strategyId: string, statusFilter?: SubscriptionStatus): Subscription[] {
    const stratSubs = this.strategySubscriptions.get(strategyId);
    if (!stratSubs) return [];

    const result: Subscription[] = [];
    for (const subId of stratSubs) {
      const sub = this.subscriptions.get(subId);
      if (sub) {
        // Auto-expire check
        if (sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) {
          sub.status = 'expired';
          sub.updatedAt = new Date().toISOString();
        }
        if (!statusFilter || sub.status === statusFilter) {
          result.push(sub);
        }
      }
    }
    return result;
  }

  getStrategySubscriberCount(strategyId: string): number {
    return this.getStrategySubscribers(strategyId, 'active').length;
  }

  /**
   * Check if user has active access to a strategy
   */
  hasAccess(userId: string, strategyId: string, requiredTier?: SubscriptionTier): boolean {
    const sub = this.getUserActiveSubscription(userId, strategyId);
    if (!sub) return false;
    if (!requiredTier) return true;

    const tierLevels: Record<SubscriptionTier, number> = { free: 0, basic: 1, premium: 2, enterprise: 3 };
    return tierLevels[sub.tier] >= tierLevels[requiredTier];
  }

  // ── Earnings Calculation ─────────────────────────────────────────────────

  /**
   * Calculate earnings for a strategy over a period
   */
  calculateEarnings(strategyId: string, authorId: string, period: EarningPeriod, periodStart: string, periodEnd: string): EarningRecord {
    const startMs = new Date(periodStart).getTime();
    const endMs = new Date(periodEnd).getTime();

    // Count active subscribers during the period
    const subs = this.getStrategySubscribers(strategyId);
    const activeSubs = subs.filter(s => {
      const startedMs = new Date(s.startedAt).getTime();
      const cancelledMs = s.cancelledAt ? new Date(s.cancelledAt).getTime() : Infinity;
      const expiresMs = s.expiresAt ? new Date(s.expiresAt).getTime() : Infinity;
      const effectiveEnd = Math.min(cancelledMs, expiresMs);
      return startedMs < endMs && effectiveEnd > startMs;
    });

    const newSubs = subs.filter(s => new Date(s.startedAt).getTime() >= startMs && new Date(s.startedAt).getTime() < endMs);
    const cancelledSubs = subs.filter(s => s.cancelledAt && new Date(s.cancelledAt).getTime() >= startMs && new Date(s.cancelledAt).getTime() < endMs);

    // Calculate gross revenue
    const grossRevenue = activeSubs.reduce((sum, s) => sum + s.price, 0);
    const platformFee = grossRevenue * (this.split.platformPercent / 100);
    const authorRevenue = grossRevenue * (this.split.authorPercent / 100);
    const netRevenue = authorRevenue; // simplified: no additional deductions

    const now = new Date().toISOString();
    const record: EarningRecord = {
      id: `earn_${this.idCounter++}`,
      strategyId,
      authorId,
      period,
      periodStart,
      periodEnd,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      authorRevenue: Math.round(authorRevenue * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      subscriberCount: activeSubs.length,
      newSubscribers: newSubs.length,
      cancelledSubscribers: cancelledSubs.length,
      currency: 'USD',
      status: 'pending',
      createdAt: now,
    };

    this.earnings.set(record.id, record);
    log.info(`[SubscriptionEarnings] Calculated earnings for ${strategyId}: $${grossRevenue} gross, $${authorRevenue} author`);
    return record;
  }

  /**
   * Process settlement for a pending earning record
   */
  settleEarning(earningId: string): boolean {
    const earning = this.earnings.get(earningId);
    if (!earning) {
      log.warn(`[SubscriptionEarnings] Earning not found: ${earningId}`);
      return false;
    }
    if (earning.status !== 'pending') {
      log.warn(`[SubscriptionEarnings] Earning ${earningId} is not pending (status: ${earning.status})`);
      return false;
    }
    earning.status = 'settled';
    earning.settledAt = new Date().toISOString();
    log.info(`[SubscriptionEarnings] Settled earning ${earningId}: $${earning.authorRevenue}`);
    return true;
  }

  /**
   * Mark earning as paid
   */
  payEarning(earningId: string): boolean {
    const earning = this.earnings.get(earningId);
    if (!earning) return false;
    if (earning.status !== 'settled') {
      log.warn(`[SubscriptionEarnings] Earning ${earningId} must be settled before payment`);
      return false;
    }
    if (earning.authorRevenue < this.split.minPayout) {
      log.warn(`[SubscriptionEarnings] Earning ${earningId} below minimum payout ($${this.split.minPayout})`);
      return false;
    }
    earning.status = 'paid';
    earning.paidAt = new Date().toISOString();
    log.info(`[SubscriptionEarnings] Paid earning ${earningId}: $${earning.authorRevenue}`);
    return true;
  }

  /**
   * Batch settle all pending earnings
   */
  settleAllPending(): number {
    let count = 0;
    for (const earning of this.earnings.values()) {
      if (earning.status === 'pending') {
        earning.status = 'settled';
        earning.settledAt = new Date().toISOString();
        count++;
      }
    }
    log.info(`[SubscriptionEarnings] Batch settled ${count} pending earnings`);
    return count;
  }

  // ── Revenue Queries ──────────────────────────────────────────────────────

  getEarningsByStrategy(strategyId: string): EarningRecord[] {
    return Array.from(this.earnings.values())
      .filter(e => e.strategyId === strategyId)
      .sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime());
  }

  getEarningsByAuthor(authorId: string): EarningRecord[] {
    return Array.from(this.earnings.values())
      .filter(e => e.authorId === authorId)
      .sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime());
  }

  getAuthorEarningsSummary(authorId: string): AuthorEarningsSummary {
    const earnings = this.getEarningsByAuthor(authorId);
    const totalGross = earnings.reduce((sum, e) => sum + e.grossRevenue, 0);
    const totalPlatformFee = earnings.reduce((sum, e) => sum + e.platformFee, 0);
    const totalNet = earnings.reduce((sum, e) => sum + e.netRevenue, 0);
    const totalSubscribers = earnings.reduce((sum, e) => sum + e.subscriberCount, 0);
    const strategyIds = new Set(earnings.map(e => e.strategyId));
    const pendingPayout = earnings
      .filter(e => e.status === 'settled')
      .reduce((sum, e) => sum + e.netRevenue, 0);

    return {
      authorId,
      totalGross: Math.round(totalGross * 100) / 100,
      totalPlatformFee: Math.round(totalPlatformFee * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalSubscribers,
      strategyCount: strategyIds.size,
      pendingPayout: Math.round(pendingPayout * 100) / 100,
      currency: 'USD',
    };
  }

  getLeaderboard(limit: number = 10): { authorId: string; totalRevenue: number; subscriberCount: number }[] {
    const authorMap = new Map<string, { revenue: number; subs: number }>();
    for (const earning of this.earnings.values()) {
      const existing = authorMap.get(earning.authorId) || { revenue: 0, subs: 0 };
      existing.revenue += earning.authorRevenue;
      existing.subs += earning.subscriberCount;
      authorMap.set(earning.authorId, existing);
    }
    return Array.from(authorMap.entries())
      .map(([authorId, data]) => ({
        authorId,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        subscriberCount: data.subs,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  // ── Subscription Stats ───────────────────────────────────────────────────

  getSubscriptionStats(): SubscriptionStats {
    const all = Array.from(this.subscriptions.values());
    const active = all.filter(s => s.status === 'active');
    const expired = all.filter(s => s.status === 'expired');
    const cancelled = all.filter(s => s.status === 'cancelled');
    const totalRevenue = active.reduce((sum, s) => sum + s.price, 0);

    const tierBreakdown: Record<SubscriptionTier, number> = { free: 0, basic: 0, premium: 0, enterprise: 0 };
    for (const s of active) {
      tierBreakdown[s.tier] = (tierBreakdown[s.tier] || 0) + 1;
    }

    return {
      totalActive: active.length,
      totalExpired: expired.length,
      totalCancelled: cancelled.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgRevenuePerSub: active.length > 0 ? Math.round((totalRevenue / active.length) * 100) / 100 : 0,
      tierBreakdown,
    };
  }

  getRevenueSplit(): RevenueSplit {
    return { ...this.split };
  }

  getTierPrice(tier: SubscriptionTier): number {
    return TIER_PRICES[tier];
  }

  getTierFeatures(tier: SubscriptionTier): string[] {
    return [...TIER_FEATURES[tier]];
  }

  // ── Clear ────────────────────────────────────────────────────────────────

  clearAll(): void {
    this.subscriptions.clear();
    this.earnings.clear();
    this.userSubscriptions.clear();
    this.strategySubscriptions.clear();
    this.idCounter = 1;
    log.info('[SubscriptionEarnings] Cleared all data');
  }

  get subscriptionCount(): number {
    return this.subscriptions.size;
  }

  get earningCount(): number {
    return this.earnings.size;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: SubscriptionEarnings | null = null;

export function getSubscriptionEarnings(): SubscriptionEarnings {
  if (!_instance) {
    _instance = new SubscriptionEarnings();
  }
  return _instance;
}

export function resetSubscriptionEarnings(): void {
  if (_instance) {
    _instance.clearAll();
  }
  _instance = null;
}

export default SubscriptionEarnings;
