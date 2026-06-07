/**
 * JVS-45-02: Marketplace API - 策略市场引擎
 * 策略发布、评分、下载、搜索
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MarketplaceStrategy {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  rating: number;
  ratingCount: number;
  downloads: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  tags: string[];
  visibility: 'public' | 'private';
  price?: number;
}

export interface StrategyRating {
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface MarketplaceFilter {
  tag?: string;
  minRating?: number;
  minSharpe?: number;
  sortBy: 'rating' | 'downloads' | 'sharpe' | 'newest';
  page: number;
  pageSize: number;
}

export interface MarketplaceResult {
  strategies: MarketplaceStrategy[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Marketplace Engine ─────────────────────────────────────────────────────

export class MarketplaceApi {
  private strategies: Map<string, MarketplaceStrategy> = new Map();
  private ratings: Map<string, StrategyRating[]> = new Map();
  private idCounter: number = 1;

  constructor() {
    log.info('[MarketplaceApi] Initialized');
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  publishStrategy(
    strategy: Omit<MarketplaceStrategy, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating' | 'ratingCount'>
  ): string {
    const id = `strat_${this.idCounter++}`;
    const now = new Date().toISOString();

    const newStrategy: MarketplaceStrategy = {
      ...strategy,
      id,
      createdAt: now,
      updatedAt: now,
      downloads: 0,
      rating: 0,
      ratingCount: 0,
    };

    this.strategies.set(id, newStrategy);
    log.info(`[MarketplaceApi] Published strategy: ${strategy.name} (${id})`);
    return id;
  }

  // ── Get Strategies ───────────────────────────────────────────────────────

  getStrategies(filter: MarketplaceFilter): MarketplaceResult {
    let strategies = Array.from(this.strategies.values())
      .filter(s => s.visibility === 'public');

    // Apply filters
    if (filter.tag) {
      strategies = strategies.filter(s => s.tags.includes(filter.tag!));
    }
    if (filter.minRating !== undefined) {
      strategies = strategies.filter(s => s.rating >= filter.minRating!);
    }
    if (filter.minSharpe !== undefined) {
      strategies = strategies.filter(s => s.sharpe >= filter.minSharpe!);
    }

    // Sort
    switch (filter.sortBy) {
      case 'rating':
        strategies.sort((a, b) => b.rating - a.rating);
        break;
      case 'downloads':
        strategies.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'sharpe':
        strategies.sort((a, b) => b.sharpe - a.sharpe);
        break;
      case 'newest':
        strategies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    const total = strategies.length;
    const start = (filter.page - 1) * filter.pageSize;
    const paged = strategies.slice(start, start + filter.pageSize);

    return {
      strategies: paged,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  // ── Get Single Strategy ──────────────────────────────────────────────────

  getStrategy(id: string): MarketplaceStrategy | null {
    return this.strategies.get(id) || null;
  }

  // ── Rate Strategy ────────────────────────────────────────────────────────

  rateStrategy(strategyId: string, rating: StrategyRating): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      log.warn(`[MarketplaceApi] Strategy not found: ${strategyId}`);
      return false;
    }

    if (rating.rating < 0 || rating.rating > 5) {
      log.warn(`[MarketplaceApi] Invalid rating: ${rating.rating}`);
      return false;
    }

    // Store rating
    if (!this.ratings.has(strategyId)) {
      this.ratings.set(strategyId, []);
    }
    this.ratings.get(strategyId)!.push(rating);

    // Update strategy rating
    const allRatings = this.ratings.get(strategyId)!;
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    strategy.rating = Math.round(avgRating * 10) / 10;
    strategy.ratingCount = allRatings.length;
    strategy.updatedAt = new Date().toISOString();

    log.info(`[MarketplaceApi] Rated strategy ${strategyId}: ${rating.rating}`);
    return true;
  }

  // ── Download Strategy ────────────────────────────────────────────────────

  downloadStrategy(id: string): MarketplaceStrategy | null {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      log.warn(`[MarketplaceApi] Strategy not found: ${id}`);
      return null;
    }

    strategy.downloads++;
    strategy.updatedAt = new Date().toISOString();
    log.info(`[MarketplaceApi] Downloaded strategy: ${strategy.name} (${strategy.downloads} downloads)`);
    return strategy;
  }

  // ── Delete Strategy ──────────────────────────────────────────────────────

  deleteStrategy(id: string): boolean {
    const existed = this.strategies.delete(id);
    if (existed) {
      this.ratings.delete(id);
      log.info(`[MarketplaceApi] Deleted strategy: ${id}`);
    }
    return existed;
  }

  // ── Search ───────────────────────────────────────────────────────────────

  searchStrategies(query: string, filter?: MarketplaceFilter): MarketplaceResult {
    const queryLower = query.toLowerCase();
    let strategies = Array.from(this.strategies.values())
      .filter(s => s.visibility === 'public')
      .filter(s =>
        s.name.toLowerCase().includes(queryLower) ||
        s.description.toLowerCase().includes(queryLower) ||
        s.tags.some(t => t.toLowerCase().includes(queryLower))
      );

    // Apply filters
    if (filter) {
      if (filter.tag) {
        strategies = strategies.filter(s => s.tags.includes(filter.tag!));
      }
      if (filter.minRating !== undefined) {
        strategies = strategies.filter(s => s.rating >= filter.minRating!);
      }
      if (filter.minSharpe !== undefined) {
        strategies = strategies.filter(s => s.sharpe >= filter.minSharpe!);
      }
      switch (filter.sortBy) {
        case 'rating':
          strategies.sort((a, b) => b.rating - a.rating);
          break;
        case 'downloads':
          strategies.sort((a, b) => b.downloads - a.downloads);
          break;
        case 'sharpe':
          strategies.sort((a, b) => b.sharpe - a.sharpe);
          break;
        case 'newest':
          strategies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
      }
    }

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paged = strategies.slice(start, start + pageSize);

    return {
      strategies: paged,
      total: strategies.length,
      page,
      pageSize,
    };
  }

  // ── Top Strategies ───────────────────────────────────────────────────────

  getTopStrategies(limit: number = 10): MarketplaceStrategy[] {
    return Array.from(this.strategies.values())
      .filter(s => s.visibility === 'public')
      .sort((a, b) => b.rating - a.rating || b.downloads - a.downloads)
      .slice(0, limit);
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  getStats(): {
    totalStrategies: number;
    totalDownloads: number;
    avgRating: number;
    avgSharpe: number;
  } {
    const strategies = Array.from(this.strategies.values());
    const totalDownloads = strategies.reduce((sum, s) => sum + s.downloads, 0);
    const ratedStrategies = strategies.filter(s => s.ratingCount > 0);
    const avgRating = ratedStrategies.length > 0
      ? ratedStrategies.reduce((sum, s) => sum + s.rating, 0) / ratedStrategies.length
      : 0;
    const avgSharpe = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + s.sharpe, 0) / strategies.length
      : 0;

    return {
      totalStrategies: strategies.length,
      totalDownloads,
      avgRating: Math.round(avgRating * 10) / 10,
      avgSharpe: Math.round(avgSharpe * 100) / 100,
    };
  }

  // ── Get All Tags ─────────────────────────────────────────────────────────

  getAllTags(): string[] {
    const tags = new Set<string>();
    this.strategies.forEach(s => s.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }

  // ── Clear All ────────────────────────────────────────────────────────────

  clearAll(): void {
    this.strategies.clear();
    this.ratings.clear();
    this.idCounter = 1;
    log.info('[MarketplaceApi] Cleared all strategies');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: MarketplaceApi | null = null;

export function getMarketplaceApi(): MarketplaceApi {
  if (!_instance) {
    _instance = new MarketplaceApi();
  }
  return _instance;
}

export function resetMarketplaceApi(): void {
  if (_instance) {
    _instance.clearAll();
  }
  _instance = null;
}

export default MarketplaceApi;
