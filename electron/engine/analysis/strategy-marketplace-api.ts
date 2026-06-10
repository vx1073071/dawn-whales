/**
 * J-66-03 [P0]: 策略市场上架API (R66 v19 — v1.6.0 GA)
 *
 * 发布流程: 选策略→设价格(1-1000USDT)→写简介→上架
 * 搜索+筛选+排序(收益/订阅数/评分)
 *
 * >=200L, 5 tests
 */

import * as crypto from 'crypto';
import { EngineError, ErrorCode } from '../errors';


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
