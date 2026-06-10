// JVS-46-01: 策略市场搜索/评分引擎
// 多维度评分 (收益/风险/夏普) + 全文搜索

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface StrategyMetric {
  strategyId: string;
  name: string;
  author: string;
  tags: string[];
  returns: number; // 年化收益率 (%)
  risk: number; // 最大回撤 (%)
  sharpe: number; // 夏普比率
  winRate: number; // 胜率 (%)
  trades: number; // 交易次数
  subscribers: number; // 订阅数
  rating: number; // 用户评分 (1-5)
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
   * 添加或更新策略
   */
  addStrategy(metric: StrategyMetric): void {
    const isNew = !this.strategies.has(metric.strategyId);
    this.strategies.set(metric.strategyId, { ...metric });
    this.emit(isNew ? 'strategy:added' : 'strategy:updated', metric);
    log.info(`[StrategyMarketplaceSearch] ${isNew ? 'Added' : 'Updated'} strategy: ${metric.strategyId}`);
  }

  /**
   * 批量添加策略
   */
  addStrategies(metrics: StrategyMetric[]): void {
    metrics.forEach(m => this.addStrategy(m));
  }

  /**
   * 获取单个策略
   */
  getStrategy(strategyId: string): StrategyMetric | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * 删除策略
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
   * 搜索策略
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
      // 关键词搜索 (名称、作者、标签)
      if (keyword) {
        const nameMatch = strategy.name.toLowerCase().includes(keywordLower);
        const authorMatch = strategy.author.toLowerCase().includes(keywordLower);
        const tagMatch = strategy.tags.some(t => t.toLowerCase().includes(keywordLower));
        if (!nameMatch && !authorMatch && !tagMatch) {
          continue;
        }
      }

      // 过滤条件
      if (strategy.returns < minReturn) continue;
      if (strategy.risk > maxRisk) continue;
      if (strategy.sharpe < minSharpe) continue;
      if (strategy.winRate < minWinRate) continue;
      if (strategy.rating < minRating) continue;

      // 标签过滤
      if (tags.length > 0) {
        const hasTag = tags.some(t => strategy.tags.includes(t));
        if (!hasTag) continue;
      }

      results.push(strategy);
    }

    // 排序
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

    // 分页
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
   * 计算策略综合评分 (0-100)
   */
  calculateScore(strategy: StrategyMetric): number {
    const weights = {
      returns: 0.25,
      risk: 0.20,
      sharpe: 0.30,
      winRate: 0.15,
      subscribers: 0.10
    };

    // 归一化各项指标 (0-100)
    const normalizedReturns = Math.min(100, Math.max(0, (strategy.returns + 50) / 2)); // -50%~100% -> 0~100
    const normalizedRisk = Math.max(0, 100 - strategy.risk); // 风险越低越好
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
   * 获取策略排名
   */
  getTopStrategies(limit: number = 10): StrategyMetric[] {
    const allStrategies = Array.from(this.strategies.values());
    
    // 按综合评分排序
    const scored = allStrategies.map(s => ({
      ...s,
      score: this.calculateScore(s)
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  /**
   * 获取所有标签
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const strategy of this.strategies.values()) {
      strategy.tags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }

  /**
   * 获取统计信息
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

    // 统计标签频率
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
   * 清空所有策略
   */
  clear(): void {
    this.strategies.clear();
    this.emit('cleared');
    log.info('[StrategyMarketplaceSearch] Cleared all strategies');
  }

  /**
   * 获取策略总数
   */
  get size(): number {
    return this.strategies.size;
  }
}

// 单例
let instance: StrategyMarketplaceSearch | null = null;

export function getStrategyMarketplaceSearch(): StrategyMarketplaceSearch {
  if (!instance) {
    instance = new StrategyMarketplaceSearch();
  }
  return instance;
}

export default StrategyMarketplaceSearch;
