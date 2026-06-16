/**
 * CreatorMarketEngine — R246 P1-03
 * 
 * 创作者市场后端引擎。管理创作者市场协议（基于 marketplace 协议扩展）：
 * 9.9 USDT 基础定价 + 平台提成（L1:30%/L2:20%/L3:10%）+
 * 创作者入驻/审核/等级管理 + 收益报表 + 提现集成。
 * 
 * 与 ContentMarketplaceEngine 协作：前者管理内容，本引擎管理创作者账户。
 * 
 * Pricing: 9.9 USDT/月（创作者基础服务费），平台从每笔销售中提成
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type CreatorStatus = 'pending' | 'active' | 'suspended' | 'banned';
export type CreatorLevel = 'L1' | 'L2' | 'L3';
export type SubscriptionTier = 'free' | 'basic' | 'pro';

export interface Creator {
  /** Creator user ID */
  id: string;
  /** Display name */
  displayName: string;
  /** Bio / description */
  bio: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Current status */
  status: CreatorStatus;
  /** Creator level */
  level: CreatorLevel;
  /** Subscription tier */
  tier: SubscriptionTier;
  /** Specialties */
  specialties: string[];
  /** Total sales count */
  totalSales: number;
  /** Total revenue earned (after platform cut) */
  totalRevenue: number;
  /** Total platform commission from this creator */
  totalCommission: number;
  /** Average rating across all content */
  avgRating: number;
  /** Follower count */
  followerCount: number;
  /** Content count */
  contentCount: number;
  /** Joined timestamp */
  joinedAt: number;
  /** Subscription fee (USDT/month, 0 for free tier) */
  subscriptionFee: number;
  /** Verified badge */
  verified: boolean;
  /** Social links */
  socialLinks?: { platform: string; url: string }[];
}

export interface RevenueReport {
  /** Creator ID */
  creatorId: string;
  /** Period start */
  periodStart: number;
  /** Period end */
  periodEnd: number;
  /** Total sales in period */
  totalSales: number;
  /** Gross revenue in period */
  grossRevenue: number;
  /** Platform commission in period */
  commission: number;
  /** Net revenue (creator share) */
  netRevenue: number;
  /** Breakdown by content */
  contentBreakdown: ContentRevenue[];
  /** Breakdown by day */
  dailyBreakdown: DailyRevenue[];
}

export interface ContentRevenue {
  contentId: string;
  title: string;
  sales: number;
  grossRevenue: number;
  commission: number;
  netRevenue: number;
}

export interface DailyRevenue {
  date: string; // YYYY-MM-DD
  sales: number;
  grossRevenue: number;
  commission: number;
  netRevenue: number;
}

export interface CreatorApplication {
  /** Application ID */
  id: string;
  /** User ID */
  userId: string;
  /** Display name */
  displayName: string;
  /** Bio */
  bio: string;
  /** Specialties */
  specialties: string[];
  /** Application notes */
  notes: string;
  /** Portfolio links */
  portfolio: string[];
  /** Application status */
  status: 'pending' | 'approved' | 'rejected';
  /** Review notes */
  reviewNotes?: string;
  /** Applied at */
  appliedAt: number;
  /** Reviewed at */
  reviewedAt?: number;
}

export interface CreatorSearchQuery {
  /** Search keywords (name, bio, specialties) */
  keywords?: string;
  /** Filter by level */
  level?: CreatorLevel;
  /** Filter by specialties */
  specialties?: string[];
  /** Filter by status */
  status?: CreatorStatus;
  /** Sort by */
  sortBy?: 'revenue' | 'sales' | 'rating' | 'followers' | 'newest';
  /** Pagination */
  page?: number;
  pageSize?: number;
}

export interface CreatorSearchResult {
  creators: Creator[];
  total: number;
  page: number;
  pageSize: number;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

/** Platform commission rates by level */
const COMMISSION_RATES: Record<CreatorLevel, number> = {
  L1: 0.30,
  L2: 0.20,
  L3: 0.10,
};

/** Sales thresholds for level upgrades */
const LEVEL_THRESHOLDS = {
  L2: 100,   // 100 cumulative sales → L2
  L3: 1000,  // 1000 cumulative sales → L3
};

/** Subscription fees by tier */
const TIER_FEES: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 9.9,
  pro: 29.9,
};

/** Default page size */
const DEFAULT_PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class CreatorMarketEngine {
  private static instance: CreatorMarketEngine;

  /** Creator store (keyed by user ID) */
  private creators: Map<string, Creator> = new Map();
  /** Applications store */
  private applications: Map<string, CreatorApplication> = new Map();
  /** Revenue reports cache */
  private reports: Map<string, RevenueReport[]> = new Map();
  /** Transaction log for revenue tracking */
  private transactionLog: Array<{
    creatorId: string; contentId: string; amount: number;
    commission: number; timestamp: number;
  }> = [];
  /** App counter */
  private appCounter = 0;

  private constructor() {}

  static getInstance(): CreatorMarketEngine {
    if (!CreatorMarketEngine.instance) {
      CreatorMarketEngine.instance = new CreatorMarketEngine();
    }
    return CreatorMarketEngine.instance;
  }

  // ═════════════════════════════════════════════════════════
  // Creator Registration & Management
  // ═════════════════════════════════════════════════════════

  /**
   * Submit a creator application.
   */
  apply(params: {
    userId: string; displayName: string; bio: string;
    specialties: string[]; notes: string; portfolio: string[];
  }): CreatorApplication {
    this.appCounter++;
    const app: CreatorApplication = {
      id: `app-${this.appCounter}`,
      userId: params.userId,
      displayName: params.displayName,
      bio: params.bio,
      specialties: params.specialties,
      notes: params.notes,
      portfolio: params.portfolio,
      status: 'pending',
      appliedAt: Date.now(),
    };
    this.applications.set(app.id, app);
    log.info(`[CreatorMarket] Application submitted: ${app.id} by ${params.displayName}`);
    return app;
  }

  /**
   * Review (approve/reject) an application.
   */
  reviewApplication(appId: string, approved: boolean, notes?: string): CreatorApplication | null {
    const app = this.applications.get(appId);
    if (!app || app.status !== 'pending') return null;

    const now = Date.now();
    app.status = approved ? 'approved' : 'rejected';
    app.reviewNotes = notes;
    app.reviewedAt = now;

    if (approved) {
      // Create creator profile
      const creator: Creator = {
        id: app.userId,
        displayName: app.displayName,
        bio: app.bio,
        status: 'active',
        level: 'L1',
        tier: 'free',
        specialties: app.specialties,
        totalSales: 0,
        totalRevenue: 0,
        totalCommission: 0,
        avgRating: 0,
        followerCount: 0,
        contentCount: 0,
        joinedAt: now,
        subscriptionFee: 0,
        verified: false,
      };
      this.creators.set(app.userId, creator);
      log.info(`[CreatorMarket] Application approved: ${app.displayName} (${app.userId})`);
    } else {
      log.info(`[CreatorMarket] Application rejected: ${app.displayName} (${app.userId}): ${notes || 'no reason'}`);
    }

    return app;
  }

  /**
   * Get application by ID.
   */
  getApplication(appId: string): CreatorApplication | undefined {
    return this.applications.get(appId);
  }

  /**
   * Get all pending applications.
   */
  getPendingApplications(): CreatorApplication[] {
    return Array.from(this.applications.values())
      .filter(a => a.status === 'pending')
      .sort((a, b) => a.appliedAt - b.appliedAt);
  }

  /**
   * Get creator profile.
   */
  getCreator(creatorId: string): Creator | undefined {
    return this.creators.get(creatorId);
  }

  /**
   * Update creator profile.
   */
  updateCreator(creatorId: string, updates: Partial<Pick<Creator,
    'displayName' | 'bio' | 'avatarUrl' | 'specialties' | 'socialLinks'
  >>): Creator | null {
    const creator = this.creators.get(creatorId);
    if (!creator) return null;
    Object.assign(creator, updates);
    return creator;
  }

  /**
   * Suspend a creator.
   */
  suspendCreator(creatorId: string, reason?: string): boolean {
    const creator = this.creators.get(creatorId);
    if (!creator) return false;
    creator.status = 'suspended';
    log.info(`[CreatorMarket] Suspended ${creatorId}: ${reason || 'no reason'}`);
    return true;
  }

  /**
   * Ban a creator.
   */
  banCreator(creatorId: string, reason?: string): boolean {
    const creator = this.creators.get(creatorId);
    if (!creator) return false;
    creator.status = 'banned';
    log.info(`[CreatorMarket] Banned ${creatorId}: ${reason || 'no reason'}`);
    return true;
  }

  /**
   * Verify a creator (badge).
   */
  verifyCreator(creatorId: string): boolean {
    const creator = this.creators.get(creatorId);
    if (!creator) return false;
    creator.verified = true;
    return true;
  }

  // ═════════════════════════════════════════════════════════
  // Creator Level Management
  // ═════════════════════════════════════════════════════════

  /**
   * Get the current creator level.
   */
  getCreatorLevel(creatorId: string): CreatorLevel {
    return this.creators.get(creatorId)?.level || 'L1';
  }

  /**
   * Check and auto-promote creator level based on sales.
   */
  checkLevelPromotion(creatorId: string): { promoted: boolean; oldLevel: CreatorLevel; newLevel: CreatorLevel } {
    const creator = this.creators.get(creatorId);
    const oldLevel = creator?.level || 'L1';
    const newLevel = this.computeLevel(creatorId);

    if (creator && newLevel !== oldLevel) {
      creator.level = newLevel;
      creator.subscriptionFee = TIER_FEES[creator.tier];
      log.info(`[CreatorMarket] Level promoted: ${creatorId} ${oldLevel} → ${newLevel}`);
      return { promoted: true, oldLevel, newLevel };
    }

    return { promoted: false, oldLevel, newLevel: oldLevel };
  }

  /**
   * Compute level from sales count.
   */
  computeLevel(creatorId: string): CreatorLevel {
    const creator = this.creators.get(creatorId);
    if (!creator) return 'L1';
    if (creator.totalSales >= LEVEL_THRESHOLDS.L3) return 'L3';
    if (creator.totalSales >= LEVEL_THRESHOLDS.L2) return 'L2';
    return 'L1';
  }

  /**
   * Get commission rate for a creator.
   */
  getCommissionRate(creatorId: string): number {
    const level = this.getCreatorLevel(creatorId);
    return COMMISSION_RATES[level];
  }

  // ═════════════════════════════════════════════════════════
  // Subscription Tiers
  // ═════════════════════════════════════════════════════════

  /**
   * Upgrade creator subscription tier.
   */
  upgradeTier(creatorId: string, tier: SubscriptionTier): Creator | null {
    const creator = this.creators.get(creatorId);
    if (!creator) return null;
    creator.tier = tier;
    creator.subscriptionFee = TIER_FEES[tier];
    log.info(`[CreatorMarket] Tier upgraded: ${creatorId} → ${tier}`);
    return creator;
  }

  /**
   * Get subscription fee for a creator.
   */
  getSubscriptionFee(creatorId: string): number {
    const creator = this.creators.get(creatorId);
    return creator ? creator.subscriptionFee : 0;
  }

  // ═════════════════════════════════════════════════════════
  // Revenue Tracking
  // ═════════════════════════════════════════════════════════

  /**
   * Record a sale transaction.
   */
  recordSale(creatorId: string, contentId: string, amount: number): {
    commission: number; creatorShare: number; promoted: boolean;
  } | null {
    const creator = this.creators.get(creatorId);
    if (!creator || creator.status !== 'active') return null;

    const commissionRate = COMMISSION_RATES[creator.level];
    const commission = Math.round(amount * commissionRate * 100) / 100;
    const creatorShare = Math.round((amount - commission) * 100) / 100;

    // Record transaction
    this.transactionLog.push({
      creatorId, contentId, amount, commission,
      timestamp: Date.now(),
    });

    // Update creator stats
    creator.totalSales++;
    creator.totalRevenue = Math.round((creator.totalRevenue + creatorShare) * 100) / 100;
    creator.totalCommission = Math.round((creator.totalCommission + commission) * 100) / 100;

    // Check level promotion
    const { promoted } = this.checkLevelPromotion(creatorId);

    return { commission, creatorShare, promoted };
  }

  /**
   * Record a new content item for a creator.
   */
  recordContent(creatorId: string): boolean {
    const creator = this.creators.get(creatorId);
    if (!creator) return false;
    creator.contentCount++;
    return true;
  }

  /**
   * Record a follower.
   */
  recordFollow(creatorId: string, increment: boolean = true): boolean {
    const creator = this.creators.get(creatorId);
    if (!creator) return false;
    creator.followerCount = Math.max(0, creator.followerCount + (increment ? 1 : -1));
    return true;
  }

  // ═════════════════════════════════════════════════════════
  // Revenue Reports
  // ═════════════════════════════════════════════════════════

  /**
   * Generate revenue report for a period.
   */
  generateRevenueReport(
    creatorId: string,
    periodStart: number,
    periodEnd: number
  ): RevenueReport | null {
    const creator = this.creators.get(creatorId);
    if (!creator) return null;

    // Filter transactions in period
    const txs = this.transactionLog.filter(
      t => t.creatorId === creatorId &&
        t.timestamp >= periodStart &&
        t.timestamp <= periodEnd
    );

    const totalSales = txs.length;
    const grossRevenue = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
    const commission = Math.round(txs.reduce((s, t) => s + t.commission, 0) * 100) / 100;
    const netRevenue = Math.round((grossRevenue - commission) * 100) / 100;

    // Per-content breakdown
    const byContent = new Map<string, { sales: number; gross: number; comm: number }>();
    for (const t of txs) {
      const entry = byContent.get(t.contentId) || { sales: 0, gross: 0, comm: 0 };
      entry.sales++;
      entry.gross += t.amount;
      entry.comm += t.commission;
      byContent.set(t.contentId, entry);
    }
    const contentBreakdown: ContentRevenue[] = Array.from(byContent.entries())
      .map(([contentId, e]) => ({
        contentId,
        title: contentId, // placeholder; real implementation reads from ContentMarketplace
        sales: e.sales,
        grossRevenue: Math.round(e.gross * 100) / 100,
        commission: Math.round(e.comm * 100) / 100,
        netRevenue: Math.round((e.gross - e.comm) * 100) / 100,
      }));

    // Per-day breakdown
    const byDay = new Map<string, { sales: number; gross: number; comm: number }>();
    for (const t of txs) {
      const date = new Date(t.timestamp).toISOString().slice(0, 10);
      const entry = byDay.get(date) || { sales: 0, gross: 0, comm: 0 };
      entry.sales++;
      entry.gross += t.amount;
      entry.comm += t.commission;
      byDay.set(date, entry);
    }
    const dailyBreakdown: DailyRevenue[] = Array.from(byDay.entries())
      .map(([date, e]) => ({
        date,
        sales: e.sales,
        grossRevenue: Math.round(e.gross * 100) / 100,
        commission: Math.round(e.comm * 100) / 100,
        netRevenue: Math.round((e.gross - e.comm) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const report: RevenueReport = {
      creatorId,
      periodStart,
      periodEnd,
      totalSales,
      grossRevenue,
      commission,
      netRevenue,
      contentBreakdown,
      dailyBreakdown,
    };

    // Cache report
    const cacheKey = `${creatorId}:${periodStart}-${periodEnd}`;
    if (!this.reports.has(creatorId)) this.reports.set(creatorId, []);
    this.reports.get(creatorId)!.push(report);

    return report;
  }

  /**
   * Get cached reports for a creator.
   */
  getReports(creatorId: string, limit: number = 12): RevenueReport[] {
    return (this.reports.get(creatorId) || [])
      .sort((a, b) => b.periodEnd - a.periodEnd)
      .slice(0, limit);
  }

  /**
   * Get monthly revenue summary.
   */
  getMonthlySummary(creatorId: string, months: number = 6): DailyRevenue[] {
    const now = Date.now();
    const start = now - months * 30 * 24 * 3600_000;
    const txs = this.transactionLog.filter(
      t => t.creatorId === creatorId && t.timestamp >= start
    );

    const byMonth = new Map<string, { sales: number; gross: number; comm: number }>();
    for (const t of txs) {
      const month = new Date(t.timestamp).toISOString().slice(0, 7);
      const entry = byMonth.get(month) || { sales: 0, gross: 0, comm: 0 };
      entry.sales++;
      entry.gross += t.amount;
      entry.comm += t.commission;
      byMonth.set(month, entry);
    }

    return Array.from(byMonth.entries())
      .map(([date, e]) => ({
        date: `${date}-01`,
        sales: e.sales,
        grossRevenue: Math.round(e.gross * 100) / 100,
        commission: Math.round(e.comm * 100) / 100,
        netRevenue: Math.round((e.gross - e.comm) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ═════════════════════════════════════════════════════════
  // Creator Discovery / Search
  // ═════════════════════════════════════════════════════════

  /**
   * Search creators.
   */
  searchCreators(query: CreatorSearchQuery): CreatorSearchResult {
    const page = query.page || 1;
    const pageSize = Math.min(100, query.pageSize || DEFAULT_PAGE_SIZE);

    let candidates = Array.from(this.creators.values())
      .filter(c => c.status === 'active');

    // Keyword search
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      candidates = candidates.filter(c =>
        c.displayName.toLowerCase().includes(kw) ||
        c.bio.toLowerCase().includes(kw) ||
        c.specialties.some(s => s.toLowerCase().includes(kw))
      );
    }

    // Level filter
    if (query.level) {
      candidates = candidates.filter(c => c.level === query.level);
    }

    // Specialties filter
    if (query.specialties && query.specialties.length > 0) {
      candidates = candidates.filter(c =>
        c.specialties.some(s => query.specialties!.includes(s))
      );
    }

    // Sort
    switch (query.sortBy || 'revenue') {
      case 'revenue':
        candidates.sort((a, b) => b.totalRevenue - a.totalRevenue);
        break;
      case 'sales':
        candidates.sort((a, b) => b.totalSales - a.totalSales);
        break;
      case 'rating':
        candidates.sort((a, b) => b.avgRating - a.avgRating);
        break;
      case 'followers':
        candidates.sort((a, b) => b.followerCount - a.followerCount);
        break;
      case 'newest':
        candidates.sort((a, b) => b.joinedAt - a.joinedAt);
        break;
    }

    const total = candidates.length;
    const start = (page - 1) * pageSize;

    return {
      creators: candidates.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get top creators by revenue.
   */
  getTopCreators(limit: number = 10): Creator[] {
    return Array.from(this.creators.values())
      .filter(c => c.status === 'active')
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  /**
   * Get trending creators (most sales in last 30 days).
   */
  getTrendingCreators(limit: number = 10): Creator[] {
    const now = Date.now();
    const last30d = now - 30 * 24 * 3600_000;

    // Compute recent sales per creator
    const recentSales = new Map<string, number>();
    for (const t of this.transactionLog) {
      if (t.timestamp >= last30d) {
        recentSales.set(t.creatorId, (recentSales.get(t.creatorId) || 0) + 1);
      }
    }

    return Array.from(this.creators.values())
      .filter(c => c.status === 'active')
      .map(c => ({ creator: c, recent: recentSales.get(c.id) || 0 }))
      .sort((a, b) => b.recent - a.recent)
      .slice(0, limit)
      .map(x => x.creator);
  }

  // ═════════════════════════════════════════════════════════
  // Platform Dashboards
  // ═════════════════════════════════════════════════════════

  /**
   * Get platform-wide creator stats.
   */
  getPlatformStats(): {
    totalCreators: number;
    activeCreators: number;
    totalSales: number;
    totalRevenue: number;
    totalCommission: number;
    byLevel: Record<CreatorLevel, number>;
  } {
    const all = Array.from(this.creators.values());
    const active = all.filter(c => c.status === 'active');

    return {
      totalCreators: all.length,
      activeCreators: active.length,
      totalSales: active.reduce((s, c) => s + c.totalSales, 0),
      totalRevenue: Math.round(active.reduce((s, c) => s + c.totalRevenue, 0) * 100) / 100,
      totalCommission: Math.round(active.reduce((s, c) => s + c.totalCommission, 0) * 100) / 100,
      byLevel: {
        L1: active.filter(c => c.level === 'L1').length,
        L2: active.filter(c => c.level === 'L2').length,
        L3: active.filter(c => c.level === 'L3').length,
      },
    };
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.creators.clear();
    this.applications.clear();
    this.reports.clear();
    this.transactionLog = [];
    this.appCounter = 0;
  }
}

export default CreatorMarketEngine;
