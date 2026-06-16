/**
 * R249 P2-35: NewsSearchFilter — 新闻搜索筛选引擎
 * LOBEHUB | v2.8.0
 *
 * 为新闻Feed提供高级搜索+多维度筛选。
 *
 * 功能:
 *   1. 全文搜索: 标题/正文/来源关键词
 *   2. 7维筛选: 市场/来源/影响度/情绪/资产/时间/排序
 *   3. 搜索结果排序: 相关性/时间/影响度
 *   4. 搜索历史+热门搜索
 *
 * 约束: 纯TypeScript, >=380L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed';
export type NewsImpact = 'high' | 'medium' | 'low';
export type NewsSortMode = 'relevance' | 'time' | 'impact';

export interface NewsItem {
  id: string; title: string; summary: string; body: string;
  source: string; sourceUrl: string; market: string;
  sentiment: NewsSentiment; sentimentScore: number; // -1 to 1
  impact: NewsImpact; impactScore: number; // 0 to 1
  symbols: string[]; categories: string[]; tags: string[];
  publishedAt: number; fetchedAt: number;
}

export interface NewsSearchFilters {
  query?: string;
  markets?: string[]; sources?: string[];
  sentiment?: NewsSentiment[]; impact?: NewsImpact[];
  assetClasses?: string[]; symbols?: string[];
  publishedAfter?: number; publishedBefore?: number;
  sortBy?: NewsSortMode; page?: number; pageSize?: number;
}

export interface NewsSearchResult {
  items: NewsItem[]; total: number; page: number; pageSize: number;
  totalPages: number; took: number;  // 搜索耗时ms
  facets: {
    markets: { value: string; count: number; }[];
    sources: { value: string; count: number; }[];
    sentiment: { value: string; count: number; }[];
    impact: { value: string; count: number; }[];
  };
  suggestedFilters: string[];  // 搜索建议
}

export interface SearchSuggestion {
  text: string; type: 'history' | 'trending' | 'related'; count?: number;
}

export interface SearchConfig {
  maxHistorySize: number; defaultPageSize: number; maxResults: number;
}

const DEFAULT_CONFIG: SearchConfig = {
  maxHistorySize: 50, defaultPageSize: 20, maxResults: 500,
};

// ── NewsSearchFilterEngine ─────────────────────────────────

export class NewsSearchFilterEngine {
  readonly id = 'news_search_filter';
  readonly version = '2.8.0';
  private config: SearchConfig;
  private searchHistory: Map<string, { text: string; count: number; lastUsed: number; }> = new Map();
  private trendingSearches: Map<string, number> = new Map();

  constructor(config?: Partial<SearchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  search(items: NewsItem[], filters: NewsSearchFilters): NewsSearchResult {
    const start = performance.now();
    let filtered = [...items];

    // 全文搜索
    if (filters.query) {
      const q = filters.query.toLowerCase();
      this.recordSearch(q);
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.symbols.some(s => s.toLowerCase().includes(q)) ||
        item.source.toLowerCase().includes(q)
      );
    }

    // 7维筛选
    if (filters.markets?.length) filtered = filtered.filter(i => filters.markets!.includes(i.market));
    if (filters.sources?.length) filtered = filtered.filter(i => filters.sources!.includes(i.source));
    if (filters.sentiment?.length) filtered = filtered.filter(i => filters.sentiment!.includes(i.sentiment));
    if (filters.impact?.length) filtered = filtered.filter(i => filters.impact!.includes(i.impact));
    if (filters.symbols?.length) filtered = filtered.filter(i => filters.symbols!.some(s => filters.symbols!.includes(s)));
    if (filters.assetClasses?.length) filtered = filtered.filter(i => i.categories.some(c => filters.assetClasses!.includes(c)));
    if (filters.publishedAfter) filtered = filtered.filter(i => i.publishedAt >= filters.publishedAfter!);
    if (filters.publishedBefore) filtered = filtered.filter(i => i.publishedAt <= filters.publishedBefore!);

    // 排序
    const sortBy = filters.sortBy || 'time';
    if (sortBy === 'time') filtered.sort((a, b) => b.publishedAt - a.publishedAt);
    else if (sortBy === 'impact') filtered.sort((a, b) => b.impactScore - a.impactScore);
    else if (sortBy === 'relevance' && filters.query) {
      const q = filters.query.toLowerCase();
      filtered.sort((a, b) => this.relevanceScore(b, q) - this.relevanceScore(a, q));
    }

    // 分页
    const total = Math.min(filtered.length, this.config.maxResults);
    const page = filters.page || 1;
    const pageSize = filters.pageSize || this.config.defaultPageSize;
    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

    // 统计Facets
    const facets = this.calcFacets(filtered.slice(0, total));

    // 建议
    const suggestions = this.generateSuggestions(filters.query);

    return {
      items: pagedItems, total, page, pageSize, totalPages,
      took: Math.round(performance.now() - start),
      facets, suggestedFilters: suggestions,
    };
  }

  // ── 搜索建议 ──────────────────────────────────────────

  getSuggestions(): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // 历史
    const history = [...this.searchHistory.entries()]
      .sort((a, b) => b[1].lastUsed - a[1].lastUsed)
      .slice(0, 5)
      .map(([text, data]) => ({ text, type: 'history' as const, count: data.count }));

    // 热门
    const trending = [...this.trendingSearches.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, type: 'trending' as const, count }));

    return [...history, ...trending].slice(0, 10);
  }

  /** 快速筛选预设 */
  getQuickFilters(): { name: string; label: string; filters: Partial<NewsSearchFilters>; }[] {
    return [
      { name: 'breaking', label: '🔥 突发新闻', filters: { impact: ['high'], sortBy: 'time' as NewsSortMode } },
      { name: 'crypto', label: '₿ 加密货币', filters: { assetClasses: ['crypto'], sortBy: 'time' as NewsSortMode } },
      { name: 'us_market', label: '🇺🇸 美股', filters: { markets: ['US'], sortBy: 'impact' as NewsSortMode } },
      { name: 'hk_market', label: '🇭🇰 港股', filters: { markets: ['HK'], sortBy: 'impact' as NewsSortMode } },
      { name: 'bullish', label: '🟢 利好消息', filters: { sentiment: ['bullish'], sortBy: 'time' as NewsSortMode } },
      { name: 'bearish', label: '🔴 利空消息', filters: { sentiment: ['bearish'], sortBy: 'time' as NewsSortMode } },
      { name: 'commodity', label: '🛢️ 商品', filters: { assetClasses: ['commodity'], sortBy: 'time' as NewsSortMode } },
      { name: '24h', label: '🕐 24小时内', filters: { publishedAfter: Date.now() - 86400000, sortBy: 'impact' as NewsSortMode } },
    ];
  }

  // ── Private ────────────────────────────────────────────

  private relevanceScore(item: NewsItem, query: string): number {
    let score = 0;
    if (item.title.toLowerCase().includes(query)) score += 10;
    if (item.summary.toLowerCase().includes(query)) score += 5;
    if (item.symbols.some(s => s.toLowerCase().includes(query))) score += 8;
    if (item.source.toLowerCase().includes(query)) score += 2;
    // 影响度加成
    score += item.impactScore * 3;
    return score;
  }

  private calcFacets(items: NewsItem[]) {
    const mkMap = new Map<string, number>();
    const srcMap = new Map<string, number>();
    const sentMap = new Map<string, number>();
    const impMap = new Map<string, number>();
    items.forEach(i => {
      mkMap.set(i.market, (mkMap.get(i.market) || 0) + 1);
      srcMap.set(i.source, (srcMap.get(i.source) || 0) + 1);
      sentMap.set(i.sentiment, (sentMap.get(i.sentiment) || 0) + 1);
      impMap.set(i.impact, (impMap.get(i.impact) || 0) + 1);
    });
    const sortByCount = (e: [string, number][]) => e.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count }));
    return {
      markets: sortByCount([...mkMap.entries()]),
      sources: sortByCount([...srcMap.entries()]),
      sentiment: sortByCount([...sentMap.entries()]),
      impact: sortByCount([...impMap.entries()]),
    };
  }

  private recordSearch(query: string): void {
    const existing = this.searchHistory.get(query);
    if (existing) { existing.count++; existing.lastUsed = Date.now(); }
    else {
      this.searchHistory.set(query, { text: query, count: 1, lastUsed: Date.now() });
      if (this.searchHistory.size > this.config.maxHistorySize) {
        const oldest = [...this.searchHistory.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
        if (oldest) this.searchHistory.delete(oldest[0]);
      }
    }
    this.trendingSearches.set(query, (this.trendingSearches.get(query) || 0) + 1);
  }

  private generateSuggestions(query?: string): string[] {
    if (!query || query.length < 2) return [];
    const suggestions: string[] = [];
    for (const [text] of this.searchHistory) {
      if (text.includes(query) && text !== query) suggestions.push(text);
    }
    return suggestions.slice(0, 5);
  }
}

export default NewsSearchFilterEngine;
