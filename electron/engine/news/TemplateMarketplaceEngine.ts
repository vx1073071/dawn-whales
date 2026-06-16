/**
 * P1-02 TemplateMarketplaceEngine — Template Marketplace Backend
 * R248 — Strategy Deepening
 * JVS / 引擎虾
 *
 * Template marketplace: users can browse, search, fork, rate, and purchase
 * strategy templates. Creators publish templates with pricing tiers.
 * Supports template versioning, dependency tracking, and usage analytics.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type TemplateCategory =
  | 'trend_following'
  | 'mean_reversion'
  | 'momentum'
  | 'breakout'
  | 'arbitrage'
  | 'grid'
  | 'martingale'
  | 'custom';

export type TemplateStatus = 'draft' | 'published' | 'deprecated' | 'suspended';

export type PricingTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface TemplateVersion {
  version: string; // semver
  changelog: string;
  configuration: Record<string, unknown>;
  createdAt: number;
  downloadCount: number;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  markets: string[];
  tags: string[];
  creatorId: string;
  creatorName: string;
  creatorLevel: string;
  status: TemplateStatus;
  pricing: TemplatePricing;
  currentVersion: string;
  versions: TemplateVersion[];
  /** Dependencies on other templates or data sources */
  dependencies: string[];
  avgRating: number;
  ratingCount: number;
  forkCount: number;
  downloadCount: number;
  viewCount: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export interface TemplatePricing {
  tier: PricingTier;
  price: number; // USDT
  /** Percentage for free tier features */
  freeFeatures: string[];
  proFeatures: string[];
  enterpriseFeatures: string[];
  /** Revenue share for creator */
  revenueShare: number; // e.g., 0.7 = 70%
  hasSubscription: boolean;
  subscriptionPrice?: number; // monthly
}

export interface TemplateReview {
  id: string;
  templateId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  text: string;
  helpfulCount: number;
  createdAt: number;
}

export interface TemplateSearchParams {
  keywords?: string;
  category?: TemplateCategory;
  market?: string;
  tier?: PricingTier;
  minRating?: number;
  sortBy?: 'newest' | 'popular' | 'rating' | 'downloads';
  limit?: number;
  offset?: number;
}

export interface TemplateFork {
  id: string;
  originalTemplateId: string;
  forkedById: string;
  forkedByName: string;
  newTemplateId: string;
  changes: string;
  createdAt: number;
}

export interface TemplateAnalytics {
  templateId: string;
  totalViews: number;
  totalDownloads: number;
  totalRevenue: number;
  activeUsers: number;
  dailyViews: Array<{ date: string; count: number }>;
  dailyDownloads: Array<{ date: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class TemplateMarketplaceEngine {
  private static instance: TemplateMarketplaceEngine;

  private templates: Map<string, StrategyTemplate> = new Map();
  private reviews: Map<string, TemplateReview[]> = new Map();
  private forks: Map<string, TemplateFork[]> = new Map();
  private analytics: Map<string, TemplateAnalytics> = new Map();
  private transactions: Array<{ templateId: string; buyerId: string; price: number; timestamp: number }> = [];
  private idCounter = 0;

  private constructor() {}

  static getInstance(): TemplateMarketplaceEngine {
    if (!TemplateMarketplaceEngine.instance) {
      TemplateMarketplaceEngine.instance = new TemplateMarketplaceEngine();
    }
    return TemplateMarketplaceEngine.instance;
  }

  reset(): void {
    this.templates.clear();
    this.reviews.clear();
    this.forks.clear();
    this.analytics.clear();
    this.transactions = [];
    this.idCounter = 0;
  }

  private nextId(prefix: string): string {
    return `${prefix}-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Template CRUD
  // ═══════════════════════════════════════════════════════════════

  publishTemplate(params: {
    name: string;
    description: string;
    category: TemplateCategory;
    markets: string[];
    tags: string[];
    creatorId: string;
    creatorName: string;
    creatorLevel: string;
    pricing: TemplatePricing;
    configuration?: Record<string, unknown>;
    dependencies?: string[];
  }): StrategyTemplate {
    const now = Date.now();
    const version = '1.0.0';

    const template: StrategyTemplate = {
      id: this.nextId('tpl'),
      name: params.name,
      description: params.description,
      category: params.category,
      markets: params.markets,
      tags: params.tags,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      creatorLevel: params.creatorLevel,
      status: 'published',
      pricing: params.pricing,
      currentVersion: version,
      versions: [{
        version,
        changelog: 'Initial release',
        configuration: params.configuration || {},
        createdAt: now,
        downloadCount: 0,
      }],
      dependencies: params.dependencies || [],
      avgRating: 0,
      ratingCount: 0,
      forkCount: 0,
      downloadCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    };

    this.templates.set(template.id, template);

    // Initialize analytics
    this.analytics.set(template.id, {
      templateId: template.id,
      totalViews: 0,
      totalDownloads: 0,
      totalRevenue: 0,
      activeUsers: 0,
      dailyViews: [],
      dailyDownloads: [],
    });

    log.info(`[TemplateMarket] Published template: ${template.id} (${template.name})`);
    return template;
  }

  getTemplate(id: string): StrategyTemplate | undefined {
    return this.templates.get(id);
  }

  updateTemplate(id: string, updates: Partial<Pick<StrategyTemplate, 'name' | 'description' | 'category' | 'markets' | 'tags' | 'pricing' | 'status' | 'dependencies'>>): StrategyTemplate | null {
    const tpl = this.templates.get(id);
    if (!tpl) return null;
    Object.assign(tpl, updates, { updatedAt: Date.now() });
    return tpl;
  }

  deprecateTemplate(id: string): boolean {
    const tpl = this.templates.get(id);
    if (!tpl) return false;
    tpl.status = 'deprecated';
    tpl.updatedAt = Date.now();
    return true;
  }

  suspendTemplate(id: string, reason: string): boolean {
    const tpl = this.templates.get(id);
    if (!tpl) return false;
    tpl.status = 'suspended';
    tpl.updatedAt = Date.now();
    log.warn(`[TemplateMarket] Suspended template ${id}: ${reason}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Versioning
  // ═══════════════════════════════════════════════════════════════

  addVersion(templateId: string, version: string, changelog: string, configuration: Record<string, unknown>): TemplateVersion | null {
    const tpl = this.templates.get(templateId);
    if (!tpl) return null;

    const v: TemplateVersion = {
      version,
      changelog,
      configuration,
      createdAt: Date.now(),
      downloadCount: 0,
    };

    tpl.versions.push(v);
    tpl.currentVersion = version;
    tpl.updatedAt = Date.now();

    log.info(`[TemplateMarket] Template ${templateId} updated to v${version}`);
    return v;
  }

  getVersions(templateId: string): TemplateVersion[] {
    const tpl = this.templates.get(templateId);
    return tpl ? tpl.versions : [];
  }

  // ═══════════════════════════════════════════════════════════════
  // Search & Browse
  // ═══════════════════════════════════════════════════════════════

  searchTemplates(params: TemplateSearchParams): { templates: StrategyTemplate[]; total: number } {
    let results = Array.from(this.templates.values()).filter(t => t.status === 'published');

    if (params.keywords) {
      const kw = params.keywords.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(kw) ||
        t.description.toLowerCase().includes(kw) ||
        t.tags.some(tag => tag.toLowerCase().includes(kw)),
      );
    }

    if (params.category) {
      results = results.filter(t => t.category === params.category);
    }

    if (params.market) {
      results = results.filter(t => t.markets.includes(params.market));
    }

    if (params.tier) {
      results = results.filter(t => t.pricing.tier === params.tier);
    }

    if (params.minRating) {
      results = results.filter(t => t.avgRating >= params.minRating!);
    }

    // Sort
    switch (params.sortBy) {
      case 'newest': results.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'popular': results.sort((a, b) => b.viewCount - a.viewCount); break;
      case 'rating': results.sort((a, b) => b.avgRating - a.avgRating); break;
      case 'downloads': results.sort((a, b) => b.downloadCount - a.downloadCount); break;
      default: results.sort((a, b) => b.createdAt - a.createdAt);
    }

    const total = results.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    results = results.slice(offset, offset + limit);

    return { templates: results, total };
  }

  browseCategory(category: TemplateCategory, limit?: number): { templates: StrategyTemplate[]; total: number } {
    return this.searchTemplates({ category, limit, sortBy: 'popular' });
  }

  getCreatorTemplates(creatorId: string): StrategyTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.creatorId === creatorId);
  }

  getTrending(limit: number = 10): StrategyTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.status === 'published')
      .sort((a, b) => (b.viewCount + b.downloadCount * 5) - (a.viewCount + a.downloadCount * 5))
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════
  // Reviews
  // ═══════════════════════════════════════════════════════════════

  addReview(params: {
    templateId: string;
    reviewerId: string;
    reviewerName: string;
    rating: number;
    text: string;
  }): TemplateReview | null {
    const tpl = this.templates.get(params.templateId);
    if (!tpl) return null;

    // Clamp rating
    const rating = Math.max(1, Math.min(5, Math.round(params.rating)));

    const review: TemplateReview = {
      id: this.nextId('rev'),
      templateId: params.templateId,
      reviewerId: params.reviewerId,
      reviewerName: params.reviewerName,
      rating,
      text: params.text,
      helpfulCount: 0,
      createdAt: Date.now(),
    };

    if (!this.reviews.has(params.templateId)) {
      this.reviews.set(params.templateId, []);
    }

    // Check for existing review by same user
    const existing = this.reviews.get(params.templateId)!;
    const existingIdx = existing.findIndex(r => r.reviewerId === params.reviewerId);
    if (existingIdx >= 0) {
      const oldRating = existing[existingIdx].rating;
      existing[existingIdx] = review;
      // Recalculate avg
      const total = existing.reduce((s, r) => s + r.rating, 0);
      tpl.avgRating = Math.round(total / existing.length * 10) / 10;
    } else {
      existing.push(review);
      tpl.avgRating = Math.round((tpl.avgRating * tpl.ratingCount + rating) / (tpl.ratingCount + 1) * 10) / 10;
      tpl.ratingCount++;
    }

    return review;
  }

  getReviews(templateId: string, limit?: number): { reviews: TemplateReview[]; total: number } {
    const reviews = this.reviews.get(templateId) || [];
    const sorted = [...reviews].sort((a, b) => b.createdAt - a.createdAt);
    const total = sorted.length;
    return { reviews: limit ? sorted.slice(0, limit) : sorted, total };
  }

  markReviewHelpful(reviewId: string): boolean {
    for (const [, reviews] of this.reviews) {
      const r = reviews.find(r => r.id === reviewId);
      if (r) {
        r.helpfulCount++;
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // Forking
  // ═══════════════════════════════════════════════════════════════

  forkTemplate(params: {
    originalTemplateId: string;
    forkedById: string;
    forkedByName: string;
    changes: string;
    newName?: string;
  }): { fork: TemplateFork; newTemplate: StrategyTemplate } | null {
    const original = this.templates.get(params.originalTemplateId);
    if (!original || original.status === 'suspended') return null;

    original.forkCount++;

    const newTemplate = this.publishTemplate({
      name: params.newName || `${original.name} (fork)`,
      description: `Forked from ${original.name}: ${params.changes}`,
      category: original.category,
      markets: original.markets,
      tags: [...original.tags, 'forked'],
      creatorId: params.forkedById,
      creatorName: params.forkedByName,
      creatorLevel: 'L1',
      pricing: { ...original.pricing },
      dependencies: [...original.dependencies, original.id],
    });

    const fork: TemplateFork = {
      id: this.nextId('fork'),
      originalTemplateId: params.originalTemplateId,
      forkedById: params.forkedById,
      forkedByName: params.forkedByName,
      newTemplateId: newTemplate.id,
      changes: params.changes,
      createdAt: Date.now(),
    };

    if (!this.forks.has(params.originalTemplateId)) {
      this.forks.set(params.originalTemplateId, []);
    }
    this.forks.get(params.originalTemplateId)!.push(fork);

    log.info(`[TemplateMarket] Forked ${params.originalTemplateId} → ${newTemplate.id}`);
    return { fork, newTemplate };
  }

  getForks(templateId: string): TemplateFork[] {
    return this.forks.get(templateId) || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // Purchase & Usage
  // ═══════════════════════════════════════════════════════════════

  recordView(templateId: string): boolean {
    const tpl = this.templates.get(templateId);
    if (!tpl) return false;
    tpl.viewCount++;
    const a = this.analytics.get(templateId);
    if (a) {
      a.totalViews++;
      a.activeUsers = Math.max(a.activeUsers, 1);
    }
    return true;
  }

  purchaseTemplate(templateId: string, buyerId: string): { success: boolean; price: number; revenueShare: number; creatorRevenue: number } | null {
    const tpl = this.templates.get(templateId);
    if (!tpl || tpl.status !== 'published') return null;

    const price = tpl.pricing.price;
    const revenueShare = tpl.pricing.revenueShare;
    const creatorRevenue = price * revenueShare;

    tpl.downloadCount++;
    if (tpl.versions.length > 0) {
      tpl.versions[tpl.versions.length - 1].downloadCount++;
    }

    this.transactions.push({
      templateId,
      buyerId,
      price,
      timestamp: Date.now(),
    });

    const a = this.analytics.get(templateId);
    if (a) {
      a.totalDownloads++;
      a.totalRevenue += price;
    }

    log.info(`[TemplateMarket] Purchase: ${templateId} by ${buyerId} for ${price} USDT`);
    return { success: true, price, revenueShare, creatorRevenue };
  }

  getTransactions(templateId: string): Array<{ templateId: string; buyerId: string; price: number; timestamp: number }> {
    return this.transactions.filter(t => t.templateId === templateId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Analytics
  // ═══════════════════════════════════════════════════════════════

  getAnalytics(templateId: string): TemplateAnalytics | undefined {
    return this.analytics.get(templateId);
  }

  getCreatorAnalytics(creatorId: string): {
    totalTemplates: number;
    totalDownloads: number;
    totalRevenue: number;
    avgRating: number;
  } {
    const templates = Array.from(this.templates.values()).filter(t => t.creatorId === creatorId);
    const totalDownloads = templates.reduce((s, t) => s + t.downloadCount, 0);
    const totalRating = templates.reduce((s, t) => s + t.avgRating * t.ratingCount, 0);
    const totalRatingCount = templates.reduce((s, t) => s + t.ratingCount, 0);

    let totalRevenue = 0;
    for (const t of templates) {
      const txs = this.transactions.filter(tx => tx.templateId === t.id);
      totalRevenue += txs.reduce((s, tx) => s + tx.price * t.pricing.revenueShare, 0);
    }

    return {
      totalTemplates: templates.length,
      totalDownloads,
      totalRevenue,
      avgRating: totalRatingCount > 0 ? Math.round(totalRating / totalRatingCount * 10) / 10 : 0,
    };
  }

  getPlatformStats(): {
    totalTemplates: number;
    totalCreators: number;
    totalDownloads: number;
    totalRevenue: number;
  } {
    const tiles = Array.from(this.templates.values());
    const creators = new Set(tiles.map(t => t.creatorId));

    return {
      totalTemplates: tiles.length,
      totalCreators: creators.size,
      totalDownloads: tiles.reduce((s, t) => s + t.downloadCount, 0),
      totalRevenue: this.transactions.reduce((s, tx) => s + tx.price, 0),
    };
  }
}
