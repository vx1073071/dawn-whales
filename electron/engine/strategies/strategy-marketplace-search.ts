// JVS-46-01: strategy marketplacesearch/
// (//Sharpe) + search

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface StrategyMetric {
  strategyId: string;
  name: string;
  author: string;
  tags: string[];
  returns: number; // annualized return (%)
  risk: number; // max drawdown (%)
  sharpe: number; // Sharpe ratio
  winRate: number; // win rate (%)
  trades: number; // trade count
  subscribers: number; // subscribers
  rating: number; // user rating (1-5)
  createdAt: number;
  updatedAt: number;
}

export interface SearchQuery {
  keyword?: string;
  minReturn?: number;
  maxRisk?: number;
  minSharpe?: number;
  minWinRate?: number;
  minRating?: number;
  tags?: string[];
  sortBy?: 'returns' | 'risk' | 'sharpe' | 'winRate' | 'subscribers' | 'rating';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  strategies: StrategyMetric[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class StrategyMarketplaceSearch extends EventEmitter {
  private strategies: Map<string, StrategyMetric> = new Map();

  constructor() {
    super();
    log.info('[StrategyMarketplaceSearch] initialized');
  }

  /**
 * updatestrategy/policy
   */
  addStrategy(metric: StrategyMetric): void {
    const isNew = !this.strategies.has(metric.strategyId);
    this.strategies.set(metric.strategyId, { ...metric });
    this.emit(isNew ? 'strategy:added' : 'strategy:updated', metric);
    log.info(`[StrategyMarketplaceSearch] ${isNew ? 'Added' : 'Updated'} strategy: ${metric.strategyId}`);
  }

  /**
 * strategy/policy
   */
  addStrategies(metrics: StrategyMetric[]): void {
    metrics.forEach(m => this.addStrategy(m));
  }

  /**
 * strategy/policy
   */
  getStrategy(strategyId: string): StrategyMetric | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * deletestrategy/policy
   */
  removeStrategy(strategyId: string): boolean {
    const removed = this.strategies.delete(strategyId);
    if (removed) {
      this.emit('strategy:removed', strategyId);
      log.info(`[StrategyMarketplaceSearch] Removed strategy: ${strategyId}`);
    }
    return removed;
  }

  /**
   * searchstrategy/policy
   */
  search(query: SearchQuery): SearchResult {
    const {
      keyword = '',
      minReturn = -Infinity,
      maxRisk = Infinity,
      minSharpe = -Infinity,
      minWinRate = 0,
      minRating = 0,
      tags = [],
      sortBy = 'sharpe',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20
    } = query;

    const keywordLower = keyword.toLowerCase();
    const results: StrategyMetric[] = [];

    for (const strategy of this.strategies.values()) {
 // search ( )
      if (keyword) {
        const nameMatch = strategy.name.toLowerCase().includes(keywordLower);
        const authorMatch = strategy.author.toLowerCase().includes(keywordLower);
        const tagMatch = strategy.tags.some(t => t.toLowerCase().includes(keywordLower));
        if (!nameMatch && !authorMatch && !tagMatch) {
          continue;
        }
      }

 // condition
      if (strategy.returns < minReturn) continue;
      if (strategy.risk > maxRisk) continue;
      if (strategy.sharpe < minSharpe) continue;
      if (strategy.winRate < minWinRate) continue;
      if (strategy.rating < minRating) continue;

 //
      if (tags.length > 0) {
        const hasTag = tags.some(t => strategy.tags.includes(t));
        if (!hasTag) continue;
      }

      results.push(strategy);
    }

    // sort
    results.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'returns':
          aValue = a.returns;
          bValue = b.returns;
          break;
        case 'risk':
          aValue = a.risk;
          bValue = b.risk;
          break;
        case 'winRate':
          aValue = a.winRate;
          bValue = b.winRate;
          break;
        case 'subscribers':
          aValue = a.subscribers;
          bValue = b.subscribers;
          break;
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        case 'sharpe':
        default:
          aValue = a.sharpe;
          bValue = b.sharpe;
          break;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // pagination
    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      strategies: paginatedResults,
      total,
      page,
      pageSize,
      totalPages
    };
  }

  /**
 * strategy/policy (0-100)
   */
  calculateScore(strategy: StrategyMetric): number {
    const weights = {
      returns: 0.25,
      risk: 0.20,
      sharpe: 0.30,
      winRate: 0.15,
      subscribers: 0.10
    };

 // metric (0-100)
    const normalizedReturns = Math.min(100, Math.max(0, (strategy.returns + 50) / 2)); // -50%~100% -> 0~100
    const normalizedRisk = Math.max(0, 100 - strategy.risk); // lower risk is better
    const normalizedSharpe = Math.min(100, Math.max(0, strategy.sharpe * 25)); // 0~4 -> 0~100
    const normalizedWinRate = strategy.winRate;
    const normalizedSubscribers = Math.min(100, strategy.subscribers / 10);

    const score =
      normalizedReturns * weights.returns +
      normalizedRisk * weights.risk +
      normalizedSharpe * weights.sharpe +
      normalizedWinRate * weights.winRate +
      normalizedSubscribers * weights.subscribers;

    return Math.round(score * 100) / 100;
  }

  /**
 * strategy ranking
   */
  getTopStrategies(limit: number = 10): StrategyMetric[] {
    const allStrategies = Array.from(this.strategies.values());
    
 // sort
    const scored = allStrategies.map(s => ({
      ...s,
      score: this.calculateScore(s)
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  /**
 *
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const strategy of this.strategies.values()) {
      strategy.tags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }

  /**
 * info
   */
  getStats(): {
    totalStrategies: number;
    avgReturn: number;
    avgRisk: number;
    avgSharpe: number;
    topTags: string[];
  } {
    const allStrategies = Array.from(this.strategies.values());
    const total = allStrategies.length;

    if (total === 0) {
      return {
        totalStrategies: 0,
        avgReturn: 0,
        avgRisk: 0,
        avgSharpe: 0,
        topTags: []
      };
    }

    const totalReturns = allStrategies.reduce((sum, s) => sum + s.returns, 0);
    const totalRisk = allStrategies.reduce((sum, s) => sum + s.risk, 0);
    const totalSharpe = allStrategies.reduce((sum, s) => sum + s.sharpe, 0);

 // frequency
    const tagCounts = new Map<string, number>();
    for (const strategy of allStrategies) {
      for (const tag of strategy.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    return {
      totalStrategies: total,
      avgReturn: totalReturns / total,
      avgRisk: totalRisk / total,
      avgSharpe: totalSharpe / total,
      topTags
    };
  }

  /**
 * clearstrategy/policy
   */
  clear(): void {
    this.strategies.clear();
    this.emit('cleared');
    log.info('[StrategyMarketplaceSearch] Cleared all strategies');
  }

  /**
 * strategy/policy
   */
  get size(): number {
    return this.strategies.size;
  }
}

//
let instance: StrategyMarketplaceSearch | null = null;

export function getStrategyMarketplaceSearch(): StrategyMarketplaceSearch {
  if (!instance) {
    instance = new StrategyMarketplaceSearch();
  }
  return instance;
}

export default StrategyMarketplaceSearch;
