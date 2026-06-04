// ── News Aggregator — Multi-source Financial News & Sentiment ──────────────
// JVS-5: Aggregates news from EM financial search + futu comment sentiment
// Features: keyword search, sentiment scoring, deduplication, SQLite cache

import log from 'electron-log';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  publishTime: number;
  url: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;  // -1.0 to +1.0
  keywords: string[];
  symbols: string[];       // Related stock codes
  category: 'news' | 'announcement' | 'research' | 'comment';
  rawContent?: string;
}

export interface NewsSearchRequest {
  query: string;
  symbols?: string[];      // Filter by stock code
  categories?: string[];   // Filter by category
  sentimentFilter?: 'positive' | 'negative' | 'all';
  hoursBack?: number;      // Only news from last N hours (default 24)
  limit?: number;          // Max results (default 20)
}

export interface NewsSearchResult {
  success: boolean;
  articles: NewsArticle[];
  total: number;
  sentimentSummary: {
    positive: number;
    negative: number;
    neutral: number;
    avgScore: number;
    overallMood: 'bullish' | 'bearish' | 'mixed';
  };
  durationMs: number;
  source: string;
  error?: string;
}

export interface MarketMoodReport {
  mood: 'bullish' | 'bearish' | 'mixed' | 'unknown';
  score: number;           // -100 to +100
  confidence: number;      // 0-1
  topPositiveKeywords: string[];
  topNegativeKeywords: string[];
  articleCount: number;
  timestamp: number;
}

// ── Sentiment Keywords ─────────────────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  '上涨', '利好', '增长', '突破', '新高', '超预期', '盈利', '回暖', '景气',
  '买入', '推荐', '增持', '看好', '利润增', '营收增', '订单', '扩张', '回购',
  '分红', '创新高', '强势', '放量', '主力资金流入', '北向资金买入',
  'profit', 'growth', 'bullish', 'upgrade', 'beat', 'outperform',
];

const NEGATIVE_KEYWORDS = [
  '下跌', '利空', '下滑', '亏损', '风险', '警告', '减持', '违规', '处罚',
  '卖出', '下调', '减持', '看空', '利润降', '营收降', '退市', '暴雷',
  '爆仓', '崩盘', '套牢', '缩量', '主力资金流出', '北向资金卖出',
  'loss', 'decline', 'bearish', 'downgrade', 'miss', 'underperform',
  'fraud', 'investigation', 'bankrupt',
];

// ── Script Paths ───────────────────────────────────────────────────────────

const NEWS_SCRIPT_PATHS = [
  path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'em-mx-finance-search', 'scripts', 'get_data.py'),
  path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'mx-search', 'scripts', 'get_data.py'),
];

// ── News Aggregator Service ────────────────────────────────────────────────

export class NewsAggregatorService {
  private scriptPath: string | null = null;
  private db: any = null;
  private cache = new Map<string, { data: NewsSearchResult; expires: number }>();
  private static CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.detectScript();
    log.info(`[NewsAggregator] Initialized, script: ${this.scriptPath || 'NOT FOUND'}`);
  }

  initialize(db: any): void {
    this.db = db;
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS news_aggregate (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT,
        publish_time INTEGER,
        url TEXT,
        summary TEXT,
        sentiment TEXT DEFAULT 'neutral',
        sentiment_score REAL DEFAULT 0,
        keywords TEXT,
        symbols TEXT,
        category TEXT DEFAULT 'news',
        fetched_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_news_agg_time ON news_aggregate(publish_time DESC);
      CREATE INDEX IF NOT EXISTS idx_news_agg_sentiment ON news_aggregate(sentiment);
      CREATE INDEX IF NOT EXISTS idx_news_agg_symbol ON news_aggregate(symbols);
    `);
  }

  private detectScript(): void {
    for (const p of NEWS_SCRIPT_PATHS) {
      if (fs.existsSync(p)) { this.scriptPath = p; return; }
    }
  }

  /**
   * Search for financial news
   */
  async search(request: NewsSearchRequest): Promise<NewsSearchResult> {
    const startTime = Date.now();
    const limit = request.limit || 20;
    const hoursBack = request.hoursBack || 24;
    const cacheKey = `${request.query}-${request.symbols?.join(',') || ''}`;

    // 1. Check memory cache
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > now) {
      return this.filterResults(cached.data, request);
    }

    // 2. Fetch from EM skill script
    let articles: NewsArticle[] = [];
    try {
      articles = await this.fetchFromScript(request.query, limit * 2);
    } catch (err: any) {
      log.warn('[NewsAggregator] Script fetch failed:', err.message);
    }

    // 3. Also check SQLite for recent articles
    if (articles.length === 0 && this.db) {
      articles = this.getFromSQLite(request.query, hoursBack, limit);
    }

    // 4. Score sentiment for each article
    for (const article of articles) {
      if (article.sentimentScore === 0) {
        const scored = this.scoreSentiment(article.title + ' ' + article.summary);
        article.sentiment = scored.sentiment;
        article.sentimentScore = scored.score;
      }
    }

    // 5. Save to SQLite
    this.saveToSQLite(articles);

    // 6. Build result
    const filtered = this.filterResults(
      { success: true, articles, total: articles.length, sentimentSummary: this.computeSummary(articles), durationMs: 0, source: 'em-search' },
      request,
    );

    const result: NewsSearchResult = {
      ...filtered,
      durationMs: Date.now() - startTime,
    };

    // Cache result
    this.cache.set(cacheKey, { data: result, expires: now + NewsAggregatorService.CACHE_TTL });

    log.info(`[NewsAggregator] Search "${request.query}": ${result.articles.length} articles, mood: ${result.sentimentSummary.overallMood}`);
    return result;
  }

  /**
   * Get overall market mood from recent news
   */
  async getMarketMood(symbols?: string[]): Promise<MarketMoodReport> {
    const query = symbols && symbols.length > 0
      ? symbols.join(' ')
      : 'A股市场';

    const result = await this.search({
      query: `${query} 最新动态`,
      hoursBack: 12,
      limit: 30,
    });

    if (!result.success || result.articles.length === 0) {
      return {
        mood: 'unknown',
        score: 0,
        confidence: 0,
        topPositiveKeywords: [],
        topNegativeKeywords: [],
        articleCount: 0,
        timestamp: Date.now(),
      };
    }

    const { positive, negative, neutral, avgScore } = result.sentimentSummary;
    const total = positive + negative + neutral;

    let mood: MarketMoodReport['mood'];
    if (avgScore > 0.2) mood = 'bullish';
    else if (avgScore < -0.2) mood = 'bearish';
    else mood = 'mixed';

    // Extract top keywords
    const posKeywords = this.extractTopKeywords(result.articles.filter(a => a.sentiment === 'positive'));
    const negKeywords = this.extractTopKeywords(result.articles.filter(a => a.sentiment === 'negative'));

    // Confidence based on article count and sentiment agreement
    const confidence = Math.min(1, total / 10) * (1 - neutral / Math.max(total, 1));

    return {
      mood,
      score: Math.round(avgScore * 100),
      confidence: Math.round(confidence * 100) / 100,
      topPositiveKeywords: posKeywords,
      topNegativeKeywords: negKeywords,
      articleCount: total,
      timestamp: Date.now(),
    };
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  private async fetchFromScript(query: string, limit: number): Promise<NewsArticle[]> {
    if (!this.scriptPath) return [];

    const cmd = `python3 "${this.scriptPath}" "${query.replace(/"/g, '\\"')}" --no-save`;

    const stdout = await new Promise<string>((resolve, reject) => {
      exec(cmd, {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout || '');
      });
    });

    return this.parseScriptOutput(stdout, limit);
  }

  private parseScriptOutput(stdout: string, limit: number): NewsArticle[] {
    // EM finance search returns Markdown-formatted text
    // Parse it into structured articles
    const articles: NewsArticle[] = [];
    const lines = stdout.split('\n');

    let currentTitle = '';
    let currentContent = '';
    let currentUrl = '';
    let currentSource = '';
    let articleCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect article headers (## or ###)
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        // Save previous article
        if (currentTitle && articleCount < limit) {
          articles.push(this.buildArticle(currentTitle, currentContent, currentSource, currentUrl));
          articleCount++;
        }
        currentTitle = trimmed.replace(/^#+\s*/, '');
        currentContent = '';
        currentUrl = '';
        currentSource = '';
      } else if (trimmed.match(/https?:\/\//)) {
        currentUrl = trimmed.match(/https?:\/\/[^\s)>\]]+/)?.[0] || '';
      } else if (trimmed.startsWith('来源:') || trimmed.startsWith('Source:')) {
        currentSource = trimmed.replace(/^(来源|Source):\s*/i, '');
      } else if (trimmed.length > 0) {
        currentContent += trimmed + ' ';
      }
    }

    // Last article
    if (currentTitle && articleCount < limit) {
      articles.push(this.buildArticle(currentTitle, currentContent, currentSource, currentUrl));
    }

    // If no structured parsing worked, treat entire output as one article
    if (articles.length === 0 && stdout.length > 50) {
      articles.push(this.buildArticle(
        'Market News Summary',
        stdout.slice(0, 2000),
        'East Money',
        '',
      ));
    }

    return articles;
  }

  private buildArticle(title: string, content: string, source: string, url: string): NewsArticle {
    const scored = this.scoreSentiment(title + ' ' + content);
    const symbols = this.extractSymbols(content);
    const keywords = this.extractKeywords(title + ' ' + content);

    return {
      id: `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      source: source || 'East Money',
      publishTime: Date.now(),
      url,
      summary: content.slice(0, 500),
      sentiment: scored.sentiment,
      sentimentScore: scored.score,
      keywords,
      symbols,
      category: this.detectCategory(title, content),
    };
  }

  private scoreSentiment(text: string): { sentiment: NewsArticle['sentiment']; score: number } {
    let posCount = 0;
    let negCount = 0;

    for (const kw of POSITIVE_KEYWORDS) {
      if (text.includes(kw)) posCount++;
    }
    for (const kw of NEGATIVE_KEYWORDS) {
      if (text.includes(kw)) negCount++;
    }

    const total = posCount + negCount;
    if (total === 0) return { sentiment: 'neutral', score: 0 };

    const score = (posCount - negCount) / Math.max(total, 1);
    let sentiment: NewsArticle['sentiment'];
    if (score > 0.2) sentiment = 'positive';
    else if (score < -0.2) sentiment = 'negative';
    else sentiment = 'neutral';

    return { sentiment, score: Math.round(score * 100) / 100 };
  }

  private extractSymbols(text: string): string[] {
    const symbols: string[] = [];
    // Match A-share codes: 6xxxxx, 0xxxxx, 3xxxxx
    const matches = text.match(/[036]\d{5}/g);
    if (matches) symbols.push(...new Set(matches));
    return symbols.slice(0, 10);
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const allKeywords = [...POSITIVE_KEYWORDS, ...NEGATIVE_KEYWORDS];
    for (const kw of allKeywords) {
      if (text.includes(kw)) keywords.push(kw);
    }
    return [...new Set(keywords)].slice(0, 10);
  }

  private extractTopKeywords(articles: NewsArticle[]): string[] {
    const freq = new Map<string, number>();
    for (const a of articles) {
      for (const kw of a.keywords) {
        freq.set(kw, (freq.get(kw) || 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);
  }

  private detectCategory(title: string, content: string): NewsArticle['category'] {
    if (title.includes('公告') || title.includes('announcement')) return 'announcement';
    if (title.includes('研报') || title.includes('评级') || title.includes('research')) return 'research';
    if (title.includes('评论') || title.includes('讨论') || title.includes('comment')) return 'comment';
    return 'news';
  }

  private filterResults(result: NewsSearchResult, request: NewsSearchRequest): NewsSearchResult {
    let articles = result.articles;

    if (request.symbols && request.symbols.length > 0) {
      articles = articles.filter(a =>
        a.symbols.some(s => request.symbols!.includes(s))
      );
    }

    if (request.categories && request.categories.length > 0) {
      articles = articles.filter(a => request.categories!.includes(a.category));
    }

    if (request.sentimentFilter && request.sentimentFilter !== 'all') {
      articles = articles.filter(a => a.sentiment === request.sentimentFilter);
    }

    if (request.limit) {
      articles = articles.slice(0, request.limit);
    }

    return {
      ...result,
      articles,
      total: articles.length,
      sentimentSummary: this.computeSummary(articles),
    };
  }

  private computeSummary(articles: NewsArticle[]): NewsSearchResult['sentimentSummary'] {
    const positive = articles.filter(a => a.sentiment === 'positive').length;
    const negative = articles.filter(a => a.sentiment === 'negative').length;
    const neutral = articles.filter(a => a.sentiment === 'neutral').length;
    const scores = articles.map(a => a.sentimentScore);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    let overallMood: 'bullish' | 'bearish' | 'mixed';
    if (avgScore > 0.15) overallMood = 'bullish';
    else if (avgScore < -0.15) overallMood = 'bearish';
    else overallMood = 'mixed';

    return { positive, negative, neutral, avgScore: Math.round(avgScore * 100) / 100, overallMood };
  }

  private saveToSQLite(articles: NewsArticle[]): void {
    if (!this.db || articles.length === 0) return;

    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO news_aggregate
      (id, title, source, publish_time, url, summary, sentiment, sentiment_score, keywords, symbols, category, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((items: NewsArticle[]) => {
      for (const a of items) {
        stmt.run(
          a.id, a.title, a.source, a.publishTime, a.url, a.summary,
          a.sentiment, a.sentimentScore,
          JSON.stringify(a.keywords), JSON.stringify(a.symbols),
          a.category, now
        );
      }
    });

    tx(articles);
  }

  private getFromSQLite(query: string, hoursBack: number, limit: number): NewsArticle[] {
    if (!this.db) return [];

    const since = Date.now() - hoursBack * 60 * 60 * 1000;
    const rows = this.db.prepare(
      `SELECT * FROM news_aggregate WHERE fetched_at > ? ORDER BY publish_time DESC LIMIT ?`
    ).all(since, limit * 3) as any[];

    return rows
      .filter((r: any) => {
        const text = (r.title + ' ' + (r.summary || '')).toLowerCase();
        return query.split(/\s+/).some(q => text.includes(q.toLowerCase()));
      })
      .slice(0, limit)
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        source: r.source || '',
        publishTime: r.publish_time,
        url: r.url || '',
        summary: r.summary || '',
        sentiment: r.sentiment || 'neutral',
        sentimentScore: r.sentiment_score || 0,
        keywords: JSON.parse(r.keywords || '[]'),
        symbols: JSON.parse(r.symbols || '[]'),
        category: r.category || 'news',
      }));
  }

  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, val] of this.cache) {
      if (val.expires < now) this.cache.delete(key);
    }
    if (this.db) {
      this.db.prepare('DELETE FROM news_aggregate WHERE fetched_at < ?').run(now - 7 * 24 * 60 * 60 * 1000);
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let newsAggregatorInstance: NewsAggregatorService | null = null;

export function getNewsAggregator(): NewsAggregatorService {
  if (!newsAggregatorInstance) {
    newsAggregatorInstance = new NewsAggregatorService();
  }
  return newsAggregatorInstance;
}
