// ── R285 JVS-2 TemplateMarketplaceEngine ────────────────
// 模板市场引擎：上架/下载/付费/评分/搜索/筛选 + 创作者三级分账
// 定价：免费3基础 + 社区付费1-30 USDT + AI定制2 USDT
// 平台抽成: L1(30%) / L2(20%) / L3(10%) ← v17.6盈利模型

import { EngineError } from '../../../electron/engine/core/engine-error';
import { getEngineDedupRegistry } from './engine-dedup-registry';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type TemplateCategory =
  | 'trend_following'
  | 'momentum'
  | 'value'
  | 'growth'
  | 'income'
  | 'volatility'
  | 'china_style'
  | 'crypto';

export type TemplateTier = 'free' | 'basic' | 'premium';

export type CreatorLevel = 'L1' | 'L2' | 'L3';

export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'removed';

export interface TemplateListing {
  templateId: string;
  name: string;
  nameCn: string;
  description: string;
  category: TemplateCategory;
  tier: TemplateTier;
  price: number; // USDT, 0 for free
  creatorId: string;
  creatorLevel: CreatorLevel;
  creatorName: string;
  status: ListingStatus;
  version: string;
  downloads: number;
  rating: number; // 0-5
  ratingCount: number;
  previewImageUrl: string;
  strategyConfig: Record<string, unknown>;
  indicators: string[];
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  tags: string[];
  compatibleMarkets: string[];
}

export interface PurchaseResult {
  success: boolean;
  purchaseId: string;
  templateId: string;
  price: number;
  platformFee: number; // USDT paid to platform
  creatorRevenue: number; // USDT paid to creator
  platformFeeRate: number; // %
  buyerId: string;
  timestamp: number;
  error?: string;
}

export interface TemplateSearchQuery {
  query?: string;
  category?: TemplateCategory;
  tier?: TemplateTier;
  minRating?: number;
  maxPrice?: number;
  sortBy?: 'downloads' | 'rating' | 'price' | 'newest' | 'relevance';
  page?: number;
  pageSize?: number;
  compatibleMarket?: string;
  tags?: string[];
}

export interface TemplateSearchResult {
  items: TemplateListing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreatorRevenueReport {
  creatorId: string;
  level: CreatorLevel;
  totalSales: number;
  totalRevenue: number;
  totalPlatformFee: number;
  platformFeeRate: number;
  salesByMonth: Record<string, { count: number; revenue: number }>;
}

// ═══════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════

const CREATOR_FEE_RATES: Record<CreatorLevel, number> = {
  L1: 0.30, // platform takes 30%
  L2: 0.20, // platform takes 20%
  L3: 0.10, // platform takes 10%
};

const DEFAULT_FREE_TEMPLATES = 3;
const MIN_PURCHASE_PRICE = 1; // USDT
const MAX_PURCHASE_PRICE = 30; // USDT
const AI_GENERATE_PRICE = 2; // USDT per AI-generated template

// ═══════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════

export class TemplateMarketplaceEngine {
  private listings: Map<string, TemplateListing> = new Map();
  private purchaseHistory: Map<string, PurchaseResult[]> = new Map(); // buyerId → purchases
  private salesRecords: Map<string, PurchaseResult[]> = new Map(); // creatorId → sales
  private searchIndex: Map<string, Set<string>> = new Map(); // keyword → templateIds

  constructor() {
    // Pre-seed 3 free templates
    this.seedFreeTemplates();
  }

  reset(): void {
    this.listings.clear();
    this.purchaseHistory.clear();
    this.salesRecords.clear();
    this.searchIndex.clear();
    this.seedFreeTemplates();
  }

  // ═══════════════════════════════════════════════
  // Free templates (seeded)
  // ═══════════════════════════════════════════════

  private seedFreeTemplates(): void {
    const freeTemplates: Omit<TemplateListing, 'templateId' | 'createdAt' | 'updatedAt' | 'publishedAt'>[] = [
      {
        name: 'MA Cross',
        nameCn: '均线交叉',
        description: 'Classic golden cross / death cross strategy. SMA50 crossing SMA200.',
        category: 'trend_following',
        tier: 'free',
        price: 0,
        creatorId: 'system',
        creatorLevel: 'L3',
        creatorName: 'Dawn Whales',
        status: 'published',
        version: '1.0.0',
        downloads: 1200,
        rating: 4.2,
        ratingCount: 85,
        previewImageUrl: '/previews/ma-cross.png',
        strategyConfig: { fast: 50, slow: 200, market: 'US' },
        indicators: ['SMA', 'Volume'],
        tags: ['beginner', 'trend', 'classic'],
        compatibleMarkets: ['US', 'HK', 'Crypto'],
      },
      {
        name: 'MACD Signal',
        nameCn: 'MACD信号',
        description: 'MACD histogram + signal line crossover with RSI confirmation.',
        category: 'momentum',
        tier: 'free',
        price: 0,
        creatorId: 'system',
        creatorLevel: 'L3',
        creatorName: 'Dawn Whales',
        status: 'published',
        version: '1.0.0',
        downloads: 980,
        rating: 4.5,
        ratingCount: 67,
        previewImageUrl: '/previews/macd-signal.png',
        strategyConfig: { fast: 12, slow: 26, signal: 9, rsiPeriod: 14, rsiThreshold: 30 },
        indicators: ['MACD', 'RSI'],
        tags: ['momentum', 'popular'],
        compatibleMarkets: ['US', 'HK', 'Crypto', 'SG'],
      },
      {
        name: 'RSI Bounce',
        nameCn: 'RSI反弹',
        description: 'Oversold RSI bounce with volume confirmation. 30/70 thresholds.',
        category: 'momentum',
        tier: 'free',
        price: 0,
        creatorId: 'system',
        creatorLevel: 'L3',
        creatorName: 'Dawn Whales',
        status: 'published',
        version: '1.0.0',
        downloads: 760,
        rating: 4.0,
        ratingCount: 52,
        previewImageUrl: '/previews/rsi-bounce.png',
        strategyConfig: { rsiPeriod: 14, oversold: 30, overbought: 70, volMultiplier: 1.5 },
        indicators: ['RSI', 'Volume'],
        tags: ['beginner', 'counter-trend'],
        compatibleMarkets: ['US', 'Crypto'],
      },
    ];

    const now = Date.now();
    for (const t of freeTemplates) {
      const id = `tpl_${t.name.toLowerCase().replace(/\s+/g, '_')}`;
      this.listings.set(id, {
        ...t,
        templateId: id,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      });
      this.addToSearchIndex(id, t.name, t.nameCn, t.tags);
    }
  }

  // ═══════════════════════════════════════════════
  // Listing management
  // ═══════════════════════════════════════════════

  createListing(
    data: Omit<TemplateListing, 'templateId' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'status' |
                   'downloads' | 'rating' | 'ratingCount' | 'version'>,
  ): TemplateListing {
    if (data.tier !== 'free' && (data.price < MIN_PURCHASE_PRICE || data.price > MAX_PURCHASE_PRICE)) {
      throw new EngineError(
        `Template price must be between ${MIN_PURCHASE_PRICE}-${MAX_PURCHASE_PRICE} USDT`,
      );
    }

    const now = Date.now();
    const id = `tpl_${data.creatorId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const listing: TemplateListing = {
      ...data,
      templateId: id,
      status: 'pending_review',
      version: '1.0.0',
      downloads: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };

    this.listings.set(id, listing);
    this.addToSearchIndex(id, data.name, data.nameCn, data.tags);
    return listing;
  }

  approveListing(templateId: string): TemplateListing {
    const listing = this.listings.get(templateId);
    if (!listing) throw new EngineError(`Template ${templateId} not found`);
    if (listing.status !== 'pending_review') {
      throw new EngineError(`Template ${templateId} is not pending review (status: ${listing.status})`);
    }
    const now = Date.now();
    const updated: TemplateListing = {
      ...listing,
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    };
    this.listings.set(templateId, updated);
    return updated;
  }

  rejectListing(templateId: string, reason: string): TemplateListing {
    const listing = this.listings.get(templateId);
    if (!listing) throw new EngineError(`Template ${templateId} not found`);
    const updated: TemplateListing = {
      ...listing,
      status: 'rejected',
      updatedAt: Date.now(),
    };
    this.listings.set(templateId, updated);
    return updated;
  }

  getListing(templateId: string): TemplateListing | undefined {
    return this.listings.get(templateId);
  }

  getListingsByIds(ids: string[]): TemplateListing[] {
    return ids.map((id) => this.listings.get(id)).filter(Boolean) as TemplateListing[];
  }

  // ═══════════════════════════════════════════════
  // Purchase
  // ═══════════════════════════════════════════════

  purchase(templateId: string, buyerId: string): PurchaseResult {
    const listing = this.listings.get(templateId);
    if (!listing) {
      return this.purchaseError(templateId, buyerId, 'Template not found');
    }
    if (listing.status !== 'published') {
      return this.purchaseError(templateId, buyerId, 'Template is not published');
    }
    if (listing.price <= 0 && listing.tier === 'free') {
      // Free download — no payment required
      return this.recordPurchase(listing, buyerId);
    }

    // Calculate fees
    const feeRate = CREATOR_FEE_RATES[listing.creatorLevel];
    const platformFee = Math.round(listing.price * feeRate * 100) / 100;
    const creatorRevenue = Math.round((listing.price - platformFee) * 100) / 100;

    const result = this.recordPurchase(listing, buyerId, platformFee, creatorRevenue, feeRate);

    // Update download count
    const updated = { ...listing, downloads: listing.downloads + 1, updatedAt: Date.now() };
    this.listings.set(templateId, updated);

    return result;
  }

  private recordPurchase(
    listing: TemplateListing,
    buyerId: string,
    platformFee = 0,
    creatorRevenue = 0,
    feeRate = 0,
  ): PurchaseResult {
    const purchaseId = `pur_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const result: PurchaseResult = {
      success: true,
      purchaseId,
      templateId: listing.templateId,
      price: listing.price,
      platformFee,
      creatorRevenue,
      platformFeeRate: feeRate * 100,
      buyerId,
      timestamp: Date.now(),
    };

    // Record buyer history
    const buyerHistory = this.purchaseHistory.get(buyerId) ?? [];
    buyerHistory.push(result);
    this.purchaseHistory.set(buyerId, buyerHistory);

    // Record seller history
    const sellerRecords = this.salesRecords.get(listing.creatorId) ?? [];
    sellerRecords.push(result);
    this.salesRecords.set(listing.creatorId, sellerRecords);

    return result;
  }

  private purchaseError(templateId: string, buyerId: string, error: string): PurchaseResult {
    return {
      success: false,
      purchaseId: '',
      templateId,
      price: 0,
      platformFee: 0,
      creatorRevenue: 0,
      platformFeeRate: 0,
      buyerId,
      timestamp: Date.now(),
      error,
    };
  }

  // ═══════════════════════════════════════════════
  // Rating
  // ═══════════════════════════════════════════════

  rate(templateId: string, rating: number): TemplateListing {
    if (rating < 0 || rating > 5) {
      throw new EngineError('Rating must be between 0 and 5');
    }
    const listing = this.listings.get(templateId);
    if (!listing) throw new EngineError(`Template ${templateId} not found`);

    const totalPoints = listing.rating * listing.ratingCount + rating;
    const newCount = listing.ratingCount + 1;
    const newRating = Math.round((totalPoints / newCount) * 10) / 10;

    const updated: TemplateListing = {
      ...listing,
      rating: newRating,
      ratingCount: newCount,
      updatedAt: Date.now(),
    };
    this.listings.set(templateId, updated);
    return updated;
  }

  // ═══════════════════════════════════════════════
  // AI generation pricing
  // ═══════════════════════════════════════════════

  getAIGeneratePrice(): number {
    return AI_GENERATE_PRICE;
  }

  generateAITemplate(requestedStyle: TemplateCategory, buyerId: string): PurchaseResult {
    // AI generation is a flat fee, platform takes 100% (not a creator product)
    return {
      success: true,
      purchaseId: `ai_pur_${Date.now().toString(36)}`,
      templateId: `ai_tpl_${requestedStyle}_${Date.now().toString(36)}`,
      price: AI_GENERATE_PRICE,
      platformFee: AI_GENERATE_PRICE, // 100% platform revenue
      creatorRevenue: 0,
      platformFeeRate: 100,
      buyerId,
      timestamp: Date.now(),
    };
  }

  // ═══════════════════════════════════════════════
  // Search & Filter
  // ═══════════════════════════════════════════════

  search(query: TemplateSearchQuery): TemplateSearchResult {
    let results = Array.from(this.listings.values())
      .filter((l) => l.status === 'published');

    if (query.category) {
      results = results.filter((l) => l.category === query.category);
    }
    if (query.tier) {
      results = results.filter((l) => l.tier === query.tier);
    }
    if (query.minRating !== undefined) {
      results = results.filter((l) => l.rating >= query.minRating!);
    }
    if (query.maxPrice !== undefined) {
      results = results.filter((l) => l.price <= query.maxPrice!);
    }
    if (query.compatibleMarket) {
      results = results.filter((l) =>
        l.compatibleMarkets.includes(query.compatibleMarket!),
      );
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter((l) =>
        query.tags!.some((t) => l.tags.includes(t)),
      );
    }
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.nameCn.includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    const sortBy = query.sortBy ?? 'downloads';
    results.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating;
        case 'price': return a.price - b.price;
        case 'newest': return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
        case 'relevance': return 0; // already filtered
        case 'downloads':
        default: return b.downloads - a.downloads;
      }
    });

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);

    return {
      items,
      total: results.length,
      page,
      pageSize,
      hasMore: start + pageSize < results.length,
    };
  }

  // ═══════════════════════════════════════════════
  // Creator revenue
  // ═══════════════════════════════════════════════

  getCreatorRevenue(creatorId: string): CreatorRevenueReport {
    const sales = this.salesRecords.get(creatorId) ?? [];
    const level = this.inferCreatorLevel(creatorId, sales.length);
    const totalRevenue = sales.reduce((s, r) => s + r.creatorRevenue, 0);
    const totalPlatformFee = sales.reduce((s, r) => s + r.platformFee, 0);

    const salesByMonth: Record<string, { count: number; revenue: number }> = {};
    for (const sale of sales) {
      const month = new Date(sale.timestamp).toISOString().slice(0, 7);
      if (!salesByMonth[month]) salesByMonth[month] = { count: 0, revenue: 0 };
      salesByMonth[month].count++;
      salesByMonth[month].revenue += sale.creatorRevenue;
    }

    return {
      creatorId,
      level,
      totalSales: sales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPlatformFee: Math.round(totalPlatformFee * 100) / 100,
      platformFeeRate: CREATOR_FEE_RATES[level] * 100,
      salesByMonth,
    };
  }

  private inferCreatorLevel(creatorId: string, totalSales: number): CreatorLevel {
    if (totalSales >= 1000) return 'L3';
    if (totalSales >= 100) return 'L2';
    return 'L1';
  }

  getCreatorListings(creatorId: string): TemplateListing[] {
    return Array.from(this.listings.values()).filter(
      (l) => l.creatorId === creatorId,
    );
  }

  // ═══════════════════════════════════════════════
  // Search indexing
  // ═══════════════════════════════════════════════

  private addToSearchIndex(id: string, name: string, nameCn: string, tags: string[]): void {
    const keywords = new Set([...name.toLowerCase().split(/\s+/), ...nameCn.split(/\s+/), ...tags]);
    for (const kw of keywords) {
      if (!this.searchIndex.has(kw)) this.searchIndex.set(kw, new Set());
      this.searchIndex.get(kw)!.add(id);
    }
  }

  // ═══════════════════════════════════════════════
  // Marketplace stats
  // ═══════════════════════════════════════════════

  getMarketplaceStats(): {
    totalListings: number;
    publishedCount: number;
    freeCount: number;
    paidCount: number;
    totalDownloads: number;
    totalRevenue: number;
    avgRating: number;
  } {
    const published = Array.from(this.listings.values()).filter((l) => l.status === 'published');
    const free = published.filter((l) => l.tier === 'free');
    const paid = published.filter((l) => l.tier !== 'free');
    const totalRevenue = Array.from(this.salesRecords.values())
      .flat()
      .reduce((s, r) => s + r.platformFee, 0);

    return {
      totalListings: this.listings.size,
      publishedCount: published.length,
      freeCount: free.length,
      paidCount: paid.length,
      totalDownloads: published.reduce((s, l) => s + l.downloads, 0),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgRating: published.length > 0
        ? Math.round((published.reduce((s, l) => s + l.rating, 0) / published.length) * 10) / 10
        : 0,
    };
  }
}

// ═══════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════

let instance: TemplateMarketplaceEngine | null = null;

export function getTemplateMarketplace(): TemplateMarketplaceEngine {
  if (!instance) instance = new TemplateMarketplaceEngine();
  return instance;
}

export function resetTemplateMarketplace(): void {
  instance?.reset();
  instance = null;
}
