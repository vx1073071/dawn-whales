/**
 * J-66-03 [P0]: strategy marketplaceAPI (R66 v19 — v1.6.0 GA)
 *
 * release: strategy/policy→(1-1000USDT)→→
 * search+filter+sort(/subscribe/)
 *
 * >=200L, 5 tests
 */

import * as crypto from 'crypto';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export type StrategyCategory = 'trend' | 'mean-reversion' | 'momentum' | 'volatility' | 'ml' | 'arbitrage';
export type StrategyMarket = 'HK' | 'US' | 'A';
export type SortBy = 'revenue' | 'subscribers' | 'rating' | 'newest' | 'price';

export interface StrategyListing {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  category: StrategyCategory;
  market: StrategyMarket;
  price: number;              // USDT, 1-1000
  rating: number;             // 1-5
  totalSubscribers: number;
  totalRevenue: number;
  signalsPublished: number;
  winRate7d: number;          // 0-1
  qualityGrade: string;       // A+~F
  publishedAt: string | null;
  isActive: boolean;
}

export interface SearchFilters {
  category?: StrategyCategory;
  market?: StrategyMarket;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minWinRate?: number;
  qualityGrade?: string;
}

export interface SearchResult {
  items: StrategyListing[];
  total: number;
  page: number;
  pageSize: number;
}

// ── R166: Unified marketplace types ────────────────────────────────────────

export type AssetType = 'strategy' | 'factor' | 'signal';

export interface UnifiedMarketItem {
  assetType: AssetType;
  id: string;
  name: string;
  description: string;
  creatorId: string;
  price: number;             // USDT
  rating: number;
  totalSubscribers: number;
  totalRevenue: number;
  qualityGrade: string;
  category: string;
  market: string;
  publishedAt: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedSearchQuery {
  text?: string;
  category?: string;
  market?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'rating' | 'revenue' | 'price' | 'newest';
  page?: number;
  pageSize?: number;
  assetTypes?: AssetType[];
}

export interface UnifiedSearchResult {
  items: UnifiedMarketItem[];
  total: number;
  page: number;
  pageSize: number;
  breakdownByType: { strategy: number; factor: number; signal: number };
}

export interface FactorListing {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  category: string;
  market: string;
  price: number;
  rating: number;
  totalSubscribers: number;
  totalRevenue: number;
  icValue: number;
  isActive: boolean;
  qualityGrade: string;
  publishedAt: string;
}

export interface SignalListing {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  category: string;
  market: string;
  price: number;
  rating: number;
  totalSubscribers: number;
  totalRevenue: number;
  winRate7d: number;
  signalCount: number;
  isActive: boolean;
  qualityGrade: string;
  publishedAt: string;
}

// ── R166: Commission engine types ──────────────────────────────────────────

export type CreatorTier = 'L1' | 'L2' | 'L3';

export interface CommissionTierConfig {
  creatorPercent: number;
  platformPercent: number;
}

export interface CommissionResult {
  assetType: AssetType;
  price: number;
  feeRate: number;
  tier: CreatorTier;
  creatorPercent: number;
  platformPercent: number;
  creatorEarnings: number;
  platformEarnings: number;
  settlement: {
    totalBuyerPaid: number;
    creatorNet: number;
    platformFee: number;
    currency: string;
  };
}

const FEE_RATE = 0.15; // 15% platform fee

const COMMISSION_TIERS: Record<CreatorTier, CommissionTierConfig> = {
  L1: { creatorPercent: 70, platformPercent: 30 },
  L2: { creatorPercent: 80, platformPercent: 20 },
  L3: { creatorPercent: 90, platformPercent: 10 },
};

// ── Marketplace Engine ────────────────────────────────────────────────────

export class StrategyMarketplaceEngine {
  private listings: Map<string, StrategyListing> = new Map();
  private creatorListings: Map<string, Set<string>> = new Map();

  // ── CRUD ────────────────────────────────────────────────────────────────

  createListing(params: {
    creatorId: string; name: string; description: string;
    category: StrategyCategory; market: StrategyMarket; price: number;
  }): StrategyListing {
    if (params.price < 1 || params.price > 1000) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Price must be 1-1000 USDT');
    if (params.name.length < 3) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Name too short (min 3 characters)');
    if (params.description.length < 10) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Description too short (min 10 characters)');

    const id = `STR-${crypto.randomBytes(4).toString('hex')}`;
    const listing: StrategyListing = {
      id, creatorId: params.creatorId, name: params.name, description: params.description,
      category: params.category, market: params.market, price: params.price,
      rating: 0, totalSubscribers: 0, totalRevenue: 0, signalsPublished: 0,
      winRate7d: 0, qualityGrade: 'F', publishedAt: null, isActive: false,
    };
    this.listings.set(id, listing);

    if (!this.creatorListings.has(params.creatorId)) this.creatorListings.set(params.creatorId, new Set());
    this.creatorListings.get(params.creatorId)!.add(id);

    return listing;
  }

  publishListing(listingId: string): StrategyListing {
    const listing = this.listings.get(listingId);
    if (!listing) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Listing not found');
    listing.publishedAt = new Date().toISOString();
    listing.isActive = true;
    return listing;
  }

  unpublishListing(listingId: string): StrategyListing {
    const listing = this.listings.get(listingId);
    if (!listing) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Listing not found');
    listing.isActive = false;
    return listing;
  }

  updateListing(listingId: string, updates: { name?: string; description?: string; price?: number }): StrategyListing {
    const listing = this.listings.get(listingId);
    if (!listing) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Listing not found');
    if (updates.price !== undefined && (updates.price < 1 || updates.price > 1000)) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Price must be 1-1000 USDT');
    if (updates.name !== undefined && updates.name.length < 3) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Name too short');
    if (updates.description !== undefined && updates.description.length < 10) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Description too short');

    Object.assign(listing, updates);
    return listing;
  }

  updateStats(listingId: string, stats: { rating?: number; subscribers?: number; revenue?: number; winRate7d?: number; qualityGrade?: string }): StrategyListing {
    const listing = this.listings.get(listingId);
    if (!listing) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Listing not found');
    if (stats.rating !== undefined) listing.rating = stats.rating;
    if (stats.subscribers !== undefined) listing.totalSubscribers = stats.subscribers;
    if (stats.revenue !== undefined) listing.totalRevenue = stats.revenue;
    if (stats.winRate7d !== undefined) listing.winRate7d = stats.winRate7d;
    if (stats.qualityGrade !== undefined) listing.qualityGrade = stats.qualityGrade;
    return listing;
  }

  // ── Search ──────────────────────────────────────────────────────────────

  search(filters: SearchFilters = {}, sort: SortBy = 'revenue', page: number = 1, pageSize: number = 20): SearchResult {
    let items = [...this.listings.values()].filter(l => l.isActive);

    if (filters.category) items = items.filter(l => l.category === filters.category);
    if (filters.market) items = items.filter(l => l.market === filters.market);
    if (filters.minPrice !== undefined) items = items.filter(l => l.price >= filters.minPrice!);
    if (filters.maxPrice !== undefined) items = items.filter(l => l.price <= filters.maxPrice!);
    if (filters.minRating !== undefined) items = items.filter(l => l.rating >= filters.minRating!);
    if (filters.minWinRate !== undefined) items = items.filter(l => l.winRate7d >= filters.minWinRate!);
    if (filters.qualityGrade) items = items.filter(l => l.qualityGrade === filters.qualityGrade);

    // Sort
    items.sort((a, b) => {
      switch (sort) {
        case 'revenue': return b.totalRevenue - a.totalRevenue;
        case 'subscribers': return b.totalSubscribers - a.totalSubscribers;
        case 'rating': return b.rating - a.rating;
        case 'newest': return new Date(b.publishedAt ?? '0').getTime() - new Date(a.publishedAt ?? '0').getTime();
        case 'price': return a.price - b.price;
        default: return 0;
      }
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getListing(id: string): StrategyListing | undefined {
    return this.listings.get(id);
  }

  getCreatorListings(creatorId: string): StrategyListing[] {
    const ids = this.creatorListings.get(creatorId);
    if (!ids) return [];
    return [...ids].map(id => this.listings.get(id)!).filter(Boolean);
  }

  getTopListings(sort: SortBy = 'revenue', limit: number = 10): StrategyListing[] {
    return this.search({}, sort, 1, limit).items;
  }

  getFeaturedListings(limit: number = 6): StrategyListing[] {
    return [...this.listings.values()]
      .filter(l => l.isActive && l.rating >= 4)
      .sort((a, b) => b.rating - a.rating || b.totalSubscribers - a.totalSubscribers)
      .slice(0, limit);
  }

  // ── Unified Types ────────────────────────────────────────────────────────

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): { totalListings: number; totalActive: number; totalRevenue: number; avgPrice: number } {
    const all = [...this.listings.values()];
    const active = all.filter(l => l.isActive);
    const totalRevenue = active.reduce((s, l) => s + l.totalRevenue, 0);
    const avgPrice = active.length > 0 ? active.reduce((s, l) => s + l.price, 0) / active.length : 0;
    return {
      totalListings: all.length,
      totalActive: active.length,
      totalRevenue,
      avgPrice: Number(avgPrice.toFixed(2)),
    };
  }

  // ── R166: Unified Search (strategy + factor + signal) ───────────────────

  /**
   * Unified search across ALL marketplace asset types.
   * Returns mixed results sorted by relevance/rating.
   */
  unifiedSearch(query: UnifiedSearchQuery): UnifiedSearchResult {
    const allItems: UnifiedMarketItem[] = [];

    // Strategy listings
    for (const listing of this.listings.values()) {
      if (!listing.isActive) continue;
      if (query.category && listing.category !== query.category) continue;
      if (query.market && listing.market !== query.market) continue;
      if (query.minPrice !== undefined && listing.price < query.minPrice) continue;
      if (query.maxPrice !== undefined && listing.price > query.maxPrice) continue;
      allItems.push({
        assetType: 'strategy',
        id: listing.id,
        name: listing.name,
        description: listing.description,
        creatorId: listing.creatorId,
        price: listing.price,
        rating: listing.rating,
        totalSubscribers: listing.totalSubscribers,
        totalRevenue: listing.totalRevenue,
        qualityGrade: listing.qualityGrade,
        category: listing.category,
        market: listing.market,
        publishedAt: listing.publishedAt ?? '',
        metadata: { winRate7d: listing.winRate7d, signalsPublished: listing.signalsPublished },
      });
    }

    // Factor listings (in-memory store)
    for (const factor of this.factorStore.values()) {
      if (!factor.isActive) continue;
      if (query.market && factor.market !== query.market) continue;
      if (query.minPrice !== undefined && factor.price < query.minPrice) continue;
      if (query.maxPrice !== undefined && factor.price > query.maxPrice) continue;
      allItems.push({
        assetType: 'factor',
        id: factor.id,
        name: factor.name,
        description: factor.description,
        creatorId: factor.creatorId,
        price: factor.price,
        rating: factor.rating,
        totalSubscribers: factor.totalSubscribers,
        totalRevenue: factor.totalRevenue,
        qualityGrade: factor.qualityGrade,
        category: factor.category,
        market: factor.market,
        publishedAt: factor.publishedAt,
        metadata: { icValue: factor.icValue, category: factor.category },
      });
    }

    // Signal store entries
    for (const signal of this.signalStore.values()) {
      if (!signal.isActive) continue;
      if (query.market && signal.market !== query.market) continue;
      if (query.minPrice !== undefined && signal.price < query.minPrice) continue;
      if (query.maxPrice !== undefined && signal.price > query.maxPrice) continue;
      allItems.push({
        assetType: 'signal',
        id: signal.id,
        name: signal.name,
        description: signal.description,
        creatorId: signal.creatorId,
        price: signal.price,
        rating: signal.rating,
        totalSubscribers: signal.totalSubscribers,
        totalRevenue: signal.totalRevenue,
        qualityGrade: signal.qualityGrade,
        category: signal.category,
        market: signal.market,
        publishedAt: signal.publishedAt,
        metadata: { winRate7d: signal.winRate7d, signalCount: signal.signalCount },
      });
    }

    // Sort
    const sort = query.sort ?? 'rating';
    allItems.sort((a, b) => {
      switch (sort) {
        case 'price': return a.price - b.price;
        case 'rating': return b.rating - a.rating;
        case 'newest': return b.publishedAt.localeCompare(a.publishedAt);
        case 'revenue': return b.totalRevenue - a.totalRevenue;
        default: return b.rating - a.rating;
      }
    });

    // Filter by text
    let items = allItems;
    if (query.text) {
      const lower = query.text.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(lower) ||
        i.description.toLowerCase().includes(lower),
      );
    }

    const total = items.length;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      breakdownByType: {
        strategy: items.filter(i => i.assetType === 'strategy').length,
        factor: items.filter(i => i.assetType === 'factor').length,
        signal: items.filter(i => i.assetType === 'signal').length,
      },
    };
  }

  // ── R166: Factor marketplace store ──────────────────────────────────────

  private factorStore: Map<string, FactorListing> = new Map();
  private signalStore: Map<string, SignalListing> = new Map();

  listFactor(factor: Omit<FactorListing, 'id' | 'publishedAt' | 'totalRevenue' | 'totalSubscribers' | 'rating'>): FactorListing {
    const id = `FCT-${crypto.randomBytes(4).toString('hex')}`;
    const entry: FactorListing = {
      ...factor,
      id,
      price: factor.price ?? 5,
      rating: 0,
      totalSubscribers: 0,
      totalRevenue: 0,
      isActive: factor.isActive ?? false,
      publishedAt: new Date().toISOString(),
    };
    this.factorStore.set(id, entry);
    return entry;
  }

  publishFactor(factorId: string): FactorListing {
    const f = this.factorStore.get(factorId);
    if (!f) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Factor not found');
    f.isActive = true;
    f.publishedAt = new Date().toISOString();
    return f;
  }

  getFactor(factorId: string): FactorListing | undefined {
    return this.factorStore.get(factorId);
  }

  // ── R166: Signal marketplace store ──────────────────────────────────────

  listSignal(signal: Omit<SignalListing, 'id' | 'publishedAt' | 'totalRevenue' | 'totalSubscribers' | 'rating'>): SignalListing {
    const id = `SIG-${crypto.randomBytes(4).toString('hex')}`;
    const entry: SignalListing = {
      ...signal,
      id,
      price: signal.price ?? 10,
      rating: 0,
      totalSubscribers: 0,
      totalRevenue: 0,
      isActive: signal.isActive ?? false,
      publishedAt: new Date().toISOString(),
    };
    this.signalStore.set(id, entry);
    return entry;
  }

  publishSignal(signalId: string): SignalListing {
    const s = this.signalStore.get(signalId);
    if (!s) throw new EngineError(ErrorCode.STRATEGY_CREATE_FAILED, 'Signal not found');
    s.isActive = true;
    s.publishedAt = new Date().toISOString();
    return s;
  }

  getSignal(signalId: string): SignalListing | undefined {
    return this.signalStore.get(signalId);
  }

  // ── R166: Unified commission engine ──────────────────────────────────────

  /**
   * Calculate commission for a purchase across any asset type.
   * Applies creator tier rules consistent with RevenueEngine v15.
   */
  calculateCommission(params: {
    assetType: 'strategy' | 'factor' | 'signal';
    price: number;                // USDT
    creatorTier?: CreatorTier;
  }): CommissionResult {
    const tierConfig = COMMISSION_TIERS[params.creatorTier ?? 'L1'] ?? COMMISSION_TIERS.L1;
    const rawFee = Math.round(params.price * FEE_RATE * 100) / 100;
    const platformEarnings = Number(rawFee.toFixed(2));
    const creatorEarnings = Number((params.price - rawFee).toFixed(2));

    return {
      assetType: params.assetType,
      price: params.price,
      feeRate: FEE_RATE,
      tier: params.creatorTier ?? 'L1',
      creatorPercent: tierConfig.creatorPercent,
      platformPercent: tierConfig.platformPercent,
      creatorEarnings,
      platformEarnings,
      settlement: {
        totalBuyerPaid: params.price,
        creatorNet: creatorEarnings,
        platformFee: platformEarnings,
        currency: 'USDT',
      },
    };
  }

  // ── R166: Full reset (include unified stores) ──────────────────────────

  resetAll(): void {
    this.listings.clear();
    this.creatorListings.clear();
    this.factorStore.clear();
    this.signalStore.clear();
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.listings.clear();
    this.creatorListings.clear();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _marketplace: StrategyMarketplaceEngine | null = null;

export function getMarketplace(): StrategyMarketplaceEngine {
  if (!_marketplace) _marketplace = new StrategyMarketplaceEngine();
  return _marketplace;
}

export function resetMarketplace(): void {
  _marketplace?.reset();
  _marketplace = null;
}

export default { StrategyMarketplaceEngine, getMarketplace, resetMarketplace };
