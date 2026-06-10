// ── JVS-111: News Aggregation System ─────────────────────────────────────────
// Aggregate news from multiple sources with sentiment analysis

import log from 'electron-log';

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
    '利好', '上涨', '涨停', '突破', '增长', '盈利', '超预期', '创新高',
    '买入', '推荐', '增持', '强劲', '乐观', '利好', '突破', '反弹',
    'positive', 'bullish', 'up', 'gain', 'growth', 'profit'
  ];

  private negativeKeywords = [
    '利空', '下跌', '跌停', '下跌', '亏损', '下滑', '不及预期', '暴跌',
    '卖出', '减持', '减持', '疲软', '悲观', '利空', '崩盘', '暴跌',
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
    const stopWords = new Set(['的', '了', '是', '在', '和', '与', '及', '等', 'the', 'a', 'an', 'the', 'and', 'or']);

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
      '贵州茅台', '五粮液', '中国平安', '招商银行', '腾讯', '阿里巴巴',
      '宁德时代', '比亚迪', '美团', '京东', '小米', '百度'
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
        name: '东方财富',
        type: 'eastmoney',
        endpoint: 'https://push2.eastmoney.com/api/qt/clist/get',
        enabled: true,
      },
      {
        name: '新浪财经',
        type: 'sina',
        endpoint: 'https://feed.mix.sina.com.cn/api/roll/get',
        enabled: true,
      },
      {
        name: '雪球',
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
      '贵州茅台发布 quarterly 报告，净利润超预期增长',
      '五粮液宣布扩大产能，市场反应积极',
      '中国平安股价下跌，市场担忧经济放缓',
      '招商银行宣布分红方案，投资者信心增强',
      '腾讯发布新产品，市场预期乐观',
    ];

    for (let i = 0; i < count; i++) {
      const title = titles[i % titles.length];
      const sentiment = analyzer.analyze(title);
      const keywords = analyzer.extractKeywords(title);
      const symbols = analyzer.extractSymbols(title);

      items.push({
        id: `${source}-${Date.now()}-${i}`,
        title,
        summary: `这是关于${title}的详细报道...`,
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
