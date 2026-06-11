/**
 * JVS-45-02 + J-52-01: Marketplace API - strategy marketplace
 * strategy publish download、search、version
 *
 * J-52-01 R52 enhancements:
 * - Audit/review workflow (pending → approved/rejected)
 * - Category + market + timeframe filtering
 * - Strategy versioning (updateStrategy)
 * - Audit queue management
 */

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:DATA] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export type AuditStatus = 'pending' | 'approved' | 'rejected';
export type StrategyVisibility = 'public' | 'private' | 'unlisted';
export type StrategyCategory = 'momentum' | 'mean-reversion' | 'arbitrage' | 'trend-following' | 'scalping' | 'swing' | 'options' | 'forex' | 'crypto' | 'multi-asset';
export type StrategyMarket = 'us-equity' | 'cn-equity' | 'hk-equity' | 'forex' | 'crypto' | 'futures' | 'options' | 'multi-market';
export type StrategyTimeframe = 'intraday' | 'daily' | 'weekly' | 'monthly';

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
  visibility: StrategyVisibility;
  price?: number;
  // J-52-01 enhanced fields
  category?: StrategyCategory;
  market?: StrategyMarket;
  timeframe?: StrategyTimeframe;
  auditStatus?: AuditStatus;
  auditNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  version?: number;
  annualReturn?: number;
  subscriberCount?: number;
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
  // J-52-01 enhanced filters
  category?: StrategyCategory;
  market?: StrategyMarket;
  timeframe?: StrategyTimeframe;
  auditStatus?: AuditStatus;
  maxDrawdown?: number;
  minWinRate?: number;
}

export interface MarketplaceResult {
  strategies: MarketplaceStrategy[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditAction {
  reviewer: string;
  note?: string;
}

export interface StrategyVersion {
  version: number;
  strategy: MarketplaceStrategy;
  changedAt: string;
  changeNote?: string;
}

// ── Marketplace Engine ─────────────────────────────────────────────────────

export class MarketplaceApi {
  private strategies: Map<string, MarketplaceStrategy> = new Map();
  private ratings: Map<string, StrategyRating[]> = new Map();
  private versions: Map<string, StrategyVersion[]> = new Map();
  private idCounter: number = 1;

  constructor() {
    log.info('[MarketplaceApi] Initialized');
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  publishStrategy(
    strategy: Omit<MarketplaceStrategy, 'id' | 'createdAt' | 'updatedAt'> & {
      downloads?: number;
      rating?: number;
      ratingCount?: number;
    }
  ): string {
    const id = `strat_${this.idCounter++}`;
    const now = new Date().toISOString();

    const newStrategy: MarketplaceStrategy = {
      ...strategy,
      id,
      createdAt: now,
      updatedAt: now,
      downloads: strategy.downloads ?? 0,
      rating: strategy.rating ?? 0,
      ratingCount: strategy.ratingCount ?? 0,
      // J-52-01: default audit status to 'approved' for backward compatibility
      auditStatus: strategy.auditStatus ?? 'approved',
      version: strategy.version ?? 1,
      subscriberCount: strategy.subscriberCount ?? 0,
      annualReturn: strategy.annualReturn ?? 0,
    };

    this.strategies.set(id, newStrategy);
    // Store initial version
    this.versions.set(id, [{ version: 1, strategy: { ...newStrategy }, changedAt: now, changeNote: 'Initial publish' }]);
    log.info(`[MarketplaceApi] Published strategy: ${strategy.name} (${id})`);
    return id;
  }

  // ── J-52-01: Audit Workflow ──────────────────────────────────────────────

  /**
   * Publish strategy with pending audit status
   */
  submitForReview(
    strategy: Omit<MarketplaceStrategy, 'id' | 'createdAt' | 'updatedAt' | 'auditStatus'>
  ): string {
    return this.publishStrategy({ ...strategy, auditStatus: 'pending' as AuditStatus });
  }

  /**
   * Get all strategies pending audit review
   */
  getPendingQueue(): MarketplaceStrategy[] {
    return Array.from(this.strategies.values())
      .filter(s => s.auditStatus === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Approve a pending strategy
   */
  approveStrategy(id: string, action: AuditAction): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      log.warn(`[MarketplaceApi] Strategy not found: ${id}`);
      return false;
    }
    if (strategy.auditStatus !== 'pending') {
      log.warn(`[MarketplaceApi] Strategy ${id} is not pending (status: ${strategy.auditStatus})`);
      return false;
    }
    strategy.auditStatus = 'approved';
    strategy.reviewedBy = action.reviewer;
    strategy.auditNote = action.note;
    strategy.reviewedAt = new Date().toISOString();
    const createdAtMs = new Date(strategy.createdAt).getTime();
    strategy.updatedAt = new Date(Math.max(Date.now(), createdAtMs + 1)).toISOString();
    log.info(`[MarketplaceApi] Approved strategy ${id} by ${action.reviewer}`);
    return true;
  }

  /**
   * Reject a pending strategy with reason
   */
  rejectStrategy(id: string, action: AuditAction): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      log.warn(`[MarketplaceApi] Strategy not found: ${id}`);
      return false;
    }
    if (strategy.auditStatus !== 'pending') {
      log.warn(`[MarketplaceApi] Strategy ${id} is not pending (status: ${strategy.auditStatus})`);
      return false;
    }
    strategy.auditStatus = 'rejected';
    strategy.reviewedBy = action.reviewer;
    strategy.auditNote = action.note || 'Rejected';
    strategy.reviewedAt = new Date().toISOString();
    const createdAtMs = new Date(strategy.createdAt).getTime();
    strategy.updatedAt = new Date(Math.max(Date.now(), createdAtMs + 1)).toISOString();
    log.info(`[MarketplaceApi] Rejected strategy ${id} by ${action.reviewer}: ${action.note}`);
    return true;
  }

  /**
   * Get audit statistics
   */
  getAuditStats(): { pending: number; approved: number; rejected: number; total: number } {
    const all = Array.from(this.strategies.values());
    return {
      pending: all.filter(s => s.auditStatus === 'pending').length,
      approved: all.filter(s => s.auditStatus === 'approved').length,
      rejected: all.filter(s => s.auditStatus === 'rejected').length,
      total: all.length,
    };
  }

  // ── J-52-01: Strategy Versioning ─────────────────────────────────────────

  /**
   * Update an existing strategy (creates a new version)
   */
  updateStrategy(id: string, updates: Partial<Pick<MarketplaceStrategy, 'name' | 'description' | 'tags' | 'price' | 'category' | 'market' | 'timeframe'>>, changeNote?: string): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      log.warn(`[MarketplaceApi] Strategy not found: ${id}`);
      return false;
    }
    Object.assign(strategy, updates);
    const currentVersion = (strategy.version ?? 1) + 1;
    strategy.version = currentVersion;
    const createdAtMs = new Date(strategy.createdAt).getTime();
    strategy.updatedAt = new Date(Math.max(Date.now(), createdAtMs + 1)).toISOString();

    // Store version history
    if (!this.versions.has(id)) this.versions.set(id, []);
    this.versions.get(id)!.push({
      version: currentVersion,
      strategy: { ...strategy },
      changedAt: strategy.updatedAt,
      changeNote,
    });

    log.info(`[MarketplaceApi] Updated strategy ${id} to v${currentVersion}`);
    return true;
  }

  /**
   * Get version history for a strategy
   */
  getVersionHistory(id: string): StrategyVersion[] {
    return this.versions.get(id) || [];
  }

  // ── Get Strategies ───────────────────────────────────────────────────────

  getStrategies(filter: MarketplaceFilter): MarketplaceResult {
    let strategies = Array.from(this.strategies.values())
      .filter(s => s.visibility === 'public');

    // J-52-01: Audit status filter (only when explicitly requested)
    if (filter.auditStatus) {
      strategies = strategies.filter(s => s.auditStatus === filter.auditStatus);
    }

    // Apply base filters
    if (filter.tag) {
      strategies = strategies.filter(s => s.tags.includes(filter.tag!));
    }
    if (filter.minRating !== undefined) {
      strategies = strategies.filter(s => s.rating >= filter.minRating!);
    }
    if (filter.minSharpe !== undefined) {
      strategies = strategies.filter(s => s.sharpe >= filter.minSharpe!);
    }

    // J-52-01: Enhanced filters
    if (filter.category) {
      strategies = strategies.filter(s => s.category === filter.category);
    }
    if (filter.market) {
      strategies = strategies.filter(s => s.market === filter.market);
    }
    if (filter.timeframe) {
      strategies = strategies.filter(s => s.timeframe === filter.timeframe);
    }
    if (filter.maxDrawdown !== undefined) {
      strategies = strategies.filter(s => s.maxDrawdown <= filter.maxDrawdown!);
    }
    if (filter.minWinRate !== undefined) {
      strategies = strategies.filter(s => s.winRate >= filter.minWinRate!);
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
    // Ensure updatedAt is always > createdAt
    const createdAtMs = new Date(strategy.createdAt).getTime();
    const updatedMs = Math.max(Date.now(), createdAtMs + 1);
    strategy.updatedAt = new Date(updatedMs).toISOString();

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
    // Ensure updatedAt is always > createdAt (add 1ms minimum offset)
    const createdAtMs = new Date(strategy.createdAt).getTime();
    const updatedMs = Math.max(Date.now(), createdAtMs + 1);
    strategy.updatedAt = new Date(updatedMs).toISOString();
    log.info(`[MarketplaceApi] Downloaded strategy: ${strategy.name} (${strategy.downloads} downloads)`);
    return strategy;
  }

  // ── Delete Strategy ──────────────────────────────────────────────────────

  deleteStrategy(id: string): boolean {
    const existed = this.strategies.delete(id);
    if (existed) {
      this.ratings.delete(id);
      this.versions.delete(id);
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
        s.tags.some(t => t.toLowerCase().includes(queryLower)) ||
        (s.author && s.author.toLowerCase().includes(queryLower)) ||
        (s.category && s.category.toLowerCase().includes(queryLower)) ||
        (s.market && s.market.toLowerCase().includes(queryLower))
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
      // J-52-01: Enhanced search filters
      if (filter.category) {
        strategies = strategies.filter(s => s.category === filter.category);
      }
      if (filter.market) {
        strategies = strategies.filter(s => s.market === filter.market);
      }
      if (filter.timeframe) {
        strategies = strategies.filter(s => s.timeframe === filter.timeframe);
      }
      if (filter.auditStatus) {
        strategies = strategies.filter(s => s.auditStatus === filter.auditStatus);
      }
      if (filter.maxDrawdown !== undefined) {
        strategies = strategies.filter(s => s.maxDrawdown <= filter.maxDrawdown!);
      }
      if (filter.minWinRate !== undefined) {
        strategies = strategies.filter(s => s.winRate >= filter.minWinRate!);
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
    this.versions.clear();
    this.idCounter = 1;
    log.info('[MarketplaceApi] Cleared all strategies');
  }

  // ── J-52-01: Category/Market stats ────────────────────────────────────────

  /**
   * Get strategies grouped by category
   */
  getStrategiesByCategory(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const s of this.strategies.values()) {
      const cat = s.category || 'uncategorized';
      result[cat] = (result[cat] || 0) + 1;
    }
    return result;
  }

  /**
   * Get strategies grouped by market
   */
  getStrategiesByMarket(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const s of this.strategies.values()) {
      const mkt = s.market || 'unknown';
      result[mkt] = (result[mkt] || 0) + 1;
    }
    return result;
  }

  /**
   * Get all available categories
   */
  getAvailableCategories(): string[] {
    const cats = new Set<string>();
    for (const s of this.strategies.values()) {
      if (s.category) cats.add(s.category);
    }
    return Array.from(cats).sort();
  }

  /**
   * Get all available markets
   */
  getAvailableMarkets(): string[] {
    const mkts = new Set<string>();
    for (const s of this.strategies.values()) {
      if (s.market) mkts.add(s.market);
    }
    return Array.from(mkts).sort();
  }

  /**
   * Get all available timeframes
   */
  getAvailableTimeframes(): string[] {
    const tfs = new Set<string>();
    for (const s of this.strategies.values()) {
      if (s.timeframe) tfs.add(s.timeframe);
    }
    return Array.from(tfs).sort();
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
