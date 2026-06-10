// ── JVS-111: News Aggregation System ─────────────────────────────────────────
// Aggregate news from multiple sources with sentiment analysis

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishTime: number;
  url: string;
  sentiment: NewsSentiment;
  keywords: string[];
  relatedSymbols: string[];
}

export interface NewsSentiment {
  score: number;  // -1 to 1
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface NewsSource {
  name: string;
  type: 'eastmoney' | 'sina' | 'xueqiu' | 'custom';
  endpoint: string;
  enabled: boolean;
}

export interface NewsFilter {
  keywords?: string[];
  symbols?: string[];
  sources?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  sentiment?: ('positive' | 'neutral' | 'negative')[];
  minScore?: number;
}

export interface NewsAggregationResult {
  items: NewsItem[];
  total: number;
  sources: string[];
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topKeywords: Array<{ keyword: string; count: number }>;
}

// ── Sentiment Analysis Engine ──────────────────────────────────────────────

export class SentimentAnalyzer {
  private positiveKeywords = [
    i18n.t('newsAggregator.k1'), i18n.t('newsAggregator.k2'), i18n.t('newsAggregator.k3'), i18n.t('newsAggregator.k4'), i18n.t('newsAggregator.k5'), i18n.t('newsAggregator.k6'), i18n.t('newsAggregator.k7'), i18n.t('newsAggregator.k8'),
    i18n.t('newsAggregator.k9'), i18n.t('newsAggregator.k10'), i18n.t('newsAggregator.k11'), i18n.t('newsAggregator.k12'), i18n.t('newsAggregator.k13'), i18n.t('newsAggregator.k14'), i18n.t('newsAggregator.k15'), i18n.t('newsAggregator.k16'),
    'positive', 'bullish', 'up', 'gain', 'growth', 'profit'
  ];

  private negativeKeywords = [
    i18n.t('newsAggregator.k17'), i18n.t('newsAggregator.k18'), i18n.t('newsAggregator.k19'), i18n.t('newsAggregator.k20'), i18n.t('newsAggregator.k21'), i18n.t('newsAggregator.k22'), i18n.t('newsAggregator.k23'), i18n.t('newsAggregator.k24'),
    i18n.t('newsAggregator.k25'), i18n.t('newsAggregator.k26'), i18n.t('newsAggregator.k27'), i18n.t('newsAggregator.k28'), i18n.t('newsAggregator.k29'), i18n.t('newsAggregator.k30'), i18n.t('newsAggregator.k31'), i18n.t('newsAggregator.k32'),
    'negative', 'bearish', 'down', 'loss', 'decline', 'loss'
  ];

  /**
   * Analyze sentiment of news text
   */
  analyze(text: string): NewsSentiment {
    const textLower = text.toLowerCase();
    
    let positiveCount = 0;
    let negativeCount = 0;

    // Count positive keywords
    for (const keyword of this.positiveKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        positiveCount++;
      }
    }

    // Count negative keywords
    for (const keyword of this.negativeKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        negativeCount++;
      }
    }

    const total = positiveCount + negativeCount;
    if (total === 0) {
      return { score: 0, label: 'neutral', confidence: 0.5 };
    }

    const score = (positiveCount - negativeCount) / total;
    const confidence = Math.abs(score);
    const label: NewsSentiment['label'] = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';

    return {
      score: Math.max(-1, Math.min(1, score)),
      label,
      confidence,
    };
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text: string): string[] {
    const keywords = new Set<string>();
    
    // Simple keyword extraction (can be enhanced with NLP)
    const words = text.split(/\s+/);
    const stopWords = new Set([i18n.t('newsAggregator.k33'), i18n.t('newsAggregator.k34'), i18n.t('newsAggregator.k35'), i18n.t('newsAggregator.k36'), i18n.t('newsAggregator.k37'), i18n.t('newsAggregator.k38'), i18n.t('newsAggregator.k39'), i18n.t('newsAggregator.k40'), 'the', 'a', 'an', 'the', 'and', 'or']);

    for (const word of words) {
      const clean = word.replace(/[^\w\u4e00-\u9fa5]/g, '');
      if (clean.length >= 2 && !stopWords.has(clean)) {
        keywords.add(clean);
      }
    }

    return Array.from(keywords).slice(0, 10);
  }

  /**
   * Extract stock symbols from text
   */
  extractSymbols(text: string): string[] {
    const symbols = new Set<string>();
    
    // Match A-share codes (6 digits)
    const aShareMatch = text.match(/[036]\d{5}/g);
    if (aShareMatch) {
      symbols.add(...aShareMatch);
    }

    // Match common stock names
    const stockNames = [
      i18n.t('newsAggregator.k41'), i18n.t('newsAggregator.k42'), i18n.t('newsAggregator.k43'), i18n.t('newsAggregator.k44'), i18n.t('newsAggregator.k45'), i18n.t('newsAggregator.k46'),
      i18n.t('newsAggregator.k47'), i18n.t('newsAggregator.k48'), i18n.t('newsAggregator.k49'), i18n.t('newsAggregator.k50'), i18n.t('newsAggregator.k51'), i18n.t('newsAggregator.k52')
    ];

    for (const name of stockNames) {
      if (text.includes(name)) {
        symbols.add(name);
      }
    }

    return Array.from(symbols);
  }
}

// ── News Source Fetcher ────────────────────────────────────────────────────

export class NewsFetcher {
  private sources: NewsSource[] = [];

  constructor() {
    this.initDefaultSources();
  }

  private initDefaultSources(): void {
    this.sources = [
      {
        name: i18n.t('newsAggregator.k53'),
        type: 'eastmoney',
        endpoint: 'https://push2.eastmoney.com/api/qt/clist/get',
        enabled: true,
      },
      {
        name: i18n.t('newsAggregator.k54'),
        type: 'sina',
        endpoint: 'https://feed.mix.sina.com.cn/api/roll/get',
        enabled: true,
      },
      {
        name: i18n.t('newsAggregator.k55'),
        type: 'xueqiu',
        endpoint: 'https://xueqiu.com/statuses/search.json',
        enabled: true,
      },
    ];
  }

  /**
   * Fetch news from all enabled sources
   */
  async fetchAll(filter?: NewsFilter): Promise<NewsItem[]> {
    const enabledSources = this.sources.filter(s => s.enabled);
    const promises = enabledSources.map(source => this.fetchFromSource(source, filter));
    
    const results = await Promise.allSettled(promises);
    const items: NewsItem[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        items.push(...result.value);
      }
    }

    // Sort by publish time (newest first)
    items.sort((a, b) => b.publishTime - a.publishTime);

    return items;
  }

  /**
   * Fetch news from a single source
   */
  private async fetchFromSource(source: NewsSource, filter?: NewsFilter): Promise<NewsItem[]> {
    try {
      // Mock implementation - in real implementation, this would make HTTP requests
      // to the actual news APIs
      const mockItems = this.generateMockNews(source.name, 10);
      
      // Apply filter
      return this.applyFilter(mockItems, filter);
    } catch (err: unknown) {
      log.error(`[NewsFetcher] Error fetching from ${source.name}:`, err);
      return [];
    }
  }

  /**
   * Generate mock news for testing
   */
  private generateMockNews(source: string, count: number): NewsItem[] {
    const analyzer = new SentimentAnalyzer();
    const items: NewsItem[] = [];

    const titles = [
      i18n.t('newsAggregator.k56'),
      i18n.t('newsAggregator.k57'),
      i18n.t('newsAggregator.k58'),
      i18n.t('newsAggregator.k59'),
      i18n.t('newsAggregator.k60'),
    ];

    for (let i = 0; i < count; i++) {
      const title = titles[i % titles.length];
      const sentiment = analyzer.analyze(title);
      const keywords = analyzer.extractKeywords(title);
      const symbols = analyzer.extractSymbols(title);

      items.push({
        id: `${source}-${Date.now()}-${i}`,
        title,
        summary: i18n.t('newsAggregator.k61'),
        source,
        publishTime: Date.now() - Math.random() * 86400000, // Random time in last 24h
        url: `https://example.com/news/${i}`,
        sentiment,
        keywords,
        relatedSymbols: symbols,
      });
    }

    return items;
  }

  /**
   * Apply filter to news items
   */
  private applyFilter(items: NewsItem[], filter?: NewsFilter): NewsItem[] {
    if (!filter) return items;

    let filtered = items;

    // Filter by keywords
    if (filter.keywords && filter.keywords.length > 0) {
      filtered = filtered.filter(item =>
        filter.keywords!.some(keyword =>
          item.title.toLowerCase().includes(keyword.toLowerCase()) ||
          item.summary.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    // Filter by symbols
    if (filter.symbols && filter.symbols.length > 0) {
      filtered = filtered.filter(item =>
        filter.symbols!.some(symbol => item.relatedSymbols.includes(symbol))
      );
    }

    // Filter by sources
    if (filter.sources && filter.sources.length > 0) {
      filtered = filtered.filter(item => filter.sources!.includes(item.source));
    }

    // Filter by time range
    if (filter.timeRange) {
      filtered = filtered.filter(item =>
        item.publishTime >= filter.timeRange!.start &&
        item.publishTime <= filter.timeRange!.end
      );
    }

    // Filter by sentiment
    if (filter.sentiment && filter.sentiment.length > 0) {
      filtered = filtered.filter(item => filter.sentiment!.includes(item.sentiment.label));
    }

    // Filter by minimum score
    if (filter.minScore !== undefined) {
      filtered = filtered.filter(item => Math.abs(item.sentiment.score) >= filter.minScore!);
    }

    return filtered;
  }
}

// ── News Aggregator ────────────────────────────────────────────────────────

export class NewsAggregator {
  private fetcher: NewsFetcher;
  private analyzer: SentimentAnalyzer;

  constructor() {
    this.fetcher = new NewsFetcher();
    this.analyzer = new SentimentAnalyzer();
  }

  /**
   * Aggregate news from all sources with optional filtering
   */
  async aggregate(filter?: NewsFilter): Promise<NewsAggregationResult> {
    const items = await this.fetcher.fetchAll(filter);

    // Calculate sentiment distribution
    const sentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    for (const item of items) {
      sentimentDistribution[item.sentiment.label]++;
    }

    // Extract top keywords
    const keywordCounts = new Map<string, number>();
    for (const item of items) {
      for (const keyword of item.keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }

    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    // Get unique sources
    const sources = Array.from(new Set(items.map(item => item.source)));

    return {
      items,
      total: items.length,
      sources,
      sentimentDistribution,
      topKeywords,
    };
  }

  /**
   * Get news for specific symbols
   */
  async getNewsForSymbols(symbols: string[], timeRange?: { start: number; end: number }): Promise<NewsItem[]> {
    const filter: NewsFilter = {
      symbols,
      timeRange,
    };

    return this.fetcher.fetchAll(filter);
  }

  /**
   * Get sentiment summary for symbols
   */
  async getSentimentSummary(symbols: string[]): Promise<Map<string, NewsSentiment>> {
    const news = await this.getNewsForSymbols(symbols);
    const summary = new Map<string, NewsSentiment>();

    for (const symbol of symbols) {
      const symbolNews = news.filter(item => item.relatedSymbols.includes(symbol));
      
      if (symbolNews.length === 0) {
        summary.set(symbol, { score: 0, label: 'neutral', confidence: 0.5 });
        continue;
      }

      const avgScore = symbolNews.reduce((sum, item) => sum + item.sentiment.score, 0) / symbolNews.length;
      const avgConfidence = symbolNews.reduce((sum, item) => sum + item.sentiment.confidence, 0) / symbolNews.length;
      const label: NewsSentiment['label'] = avgScore > 0.2 ? 'positive' : avgScore < -0.2 ? 'negative' : 'neutral';

      summary.set(symbol, {
        score: avgScore,
        label,
        confidence: avgConfidence,
      });
    }

    return summary;
  }
}

let aggregatorInstance: NewsAggregator | null = null;

export function getNewsAggregator(): NewsAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new NewsAggregator();
  }
  return aggregatorInstance;
}
