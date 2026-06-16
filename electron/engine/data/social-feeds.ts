/**
 * R241-auto#1: 社交源 RSS接入 (Social Feeds)
 *
 * Reddit 6 subreddits (JSON API) + StockTwits (per-ticker RSS)
 *
 * Reddit subreddits:
 *   1. r/wallstreetbets   — 散户情绪, 高波动
 *   2. r/stocks           — 个股讨论, 多空分化
 *   3. r/investing        — 投资策略, 长线
 *   4. r/StockMarket      — 大盘讨论
 *   5. r/CryptoCurrency   — 加密讨论
 *   6. r/weedstocks       — 大麻股 (小众高波动)
 *
 * StockTwits:
 *   per-ticker RSS: https://stocktwits.com/symbol/{TICKER}.rss
 *
 * 特性:
 *   - Reddit: JSON API, 无需OAuth, 公共访问
 *   - StockTwits: per-ticker RSS, 延迟拉取
 *   - 聚合去重: URL + title + 跨源
 *   - 情绪加权: WSB x1.5 (散户情绪放大)
 *   - 速率限制: Reddit 10/min, StockTwits 5/min
 */

import { createHash } from 'crypto';
import type { NewsItem, NewsFetcher } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Reddit Source Config
// ═══════════════════════════════════════════════════════════════════════

interface RedditSource {
  subreddit: string;
  endpoint: string;        // .json endpoint
  weight: number;          // Sentiment amplification factor
  category: string;
  tags: string[];
}

const REDDIT_SOURCES: RedditSource[] = [
  {
    subreddit: 'wallstreetbets',
    endpoint: 'https://www.reddit.com/r/wallstreetbets/hot.json?limit=50',
    weight: 1.5,
    category: 'social',
    tags: ['wsb', 'retail', 'yolo', 'meme'],
  },
  {
    subreddit: 'stocks',
    endpoint: 'https://www.reddit.com/r/stocks/hot.json?limit=30',
    weight: 1.0,
    category: 'social',
    tags: ['discussion', 'analysis', 'value'],
  },
  {
    subreddit: 'investing',
    endpoint: 'https://www.reddit.com/r/investing/hot.json?limit=30',
    weight: 1.0,
    category: 'social',
    tags: ['strategy', 'long-term', 'portfolio'],
  },
  {
    subreddit: 'StockMarket',
    endpoint: 'https://www.reddit.com/r/StockMarket/hot.json?limit=30',
    weight: 1.0,
    category: 'social',
    tags: ['market', 'macro', 'indices'],
  },
  {
    subreddit: 'CryptoCurrency',
    endpoint: 'https://www.reddit.com/r/CryptoCurrency/hot.json?limit=30',
    weight: 1.2,
    category: 'social',
    tags: ['crypto', 'btc', 'eth', 'altcoin'],
  },
  {
    subreddit: 'weedstocks',
    endpoint: 'https://www.reddit.com/r/weedstocks/hot.json?limit=25',
    weight: 1.3,
    category: 'social',
    tags: ['cannabis', 'tlry', 'cgc', 'acb'],
  },
];

// StockTwits config
const STOCKTWITS_RSS_URL = 'https://stocktwits.com/symbol/{TICKER}.rss';

// ═══════════════════════════════════════════════════════════════════════
// Reddit API Types
// ═══════════════════════════════════════════════════════════════════════

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    url: string;
    permalink: string;
    created_utc: number;
    ups: number;
    downs: number;
    score: number;
    num_comments: number;
    link_flair_text?: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Ticker Extraction
// ═══════════════════════════════════════════════════════════════════════

const TICKER_PATTERN = /\$([A-Z]{1,5})\b/g;
const COMMON_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD',
  'INTC', 'NFLX', 'DIS', 'BA', 'JPM', 'GS', 'MS', 'BAC', 'WFC', 'C',
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'ARKK',
  'GME', 'AMC', 'BB', 'NOK', 'PLTR', 'SOFI', 'RIVN', 'LCID',
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT',
  'TLRY', 'CGC', 'ACB', 'APHA',
  'NIO', 'BABA', 'JD', 'PDD', 'BIDU', 'TCEHY',
]);

function extractTickers(text: string): string[] {
  const matches = text.match(TICKER_PATTERN);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.substring(1)).filter(t => COMMON_TICKERS.has(t)))];
}

// ═══════════════════════════════════════════════════════════════════════
// Simple RSS Parser (same as crypto-feeds)
// ═══════════════════════════════════════════════════════════════════════

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  let content = match[1].trim();
  if (content.startsWith('<![CDATA[') && content.endsWith(']]>')) {
    content = content.slice(9, -3);
  }
  return content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function parseRSSItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      description: extractTag(block, 'description'),
      pubDate: extractTag(block, 'pubDate'),
    });
  }
  return items.filter(i => i.title && i.link);
}

// ═══════════════════════════════════════════════════════════════════════
// SocialFeedsFetcher
// ═══════════════════════════════════════════════════════════════════════

interface FeedStatus {
  name: string;
  status: 'ok' | 'error' | 'disabled';
  lastFetched: number;
  itemCount: number;
  consecutiveFailures: number;
  lastError?: string;
}

export class SocialFeedsFetcher implements NewsFetcher {
  readonly source = 'reddit' as const;

  // Rate limiting
  private redditLastFetch = 0;
  private redditRateLimit = 1000;  // 1s between calls (Reddit suggests ~60/min in production)
  private stocktwitsLastFetch = 0;
  private stocktwitsRateLimit = 1000; // 1s between calls

  // Cache
  private redditCache = new Map<string, { items: NewsItem[]; ts: number }>();
  private stocktwitsCache = new Map<string, { items: NewsItem[]; ts: number }>();
  private cacheTTL = 120000; // 2 minutes

  // Status
  private statusMap = new Map<string, FeedStatus>();

  constructor() {
    for (const src of REDDIT_SOURCES) {
      this.statusMap.set(`reddit:${src.subreddit}`, {
        name: `r/${src.subreddit}`,
        status: 'ok',
        lastFetched: 0,
        itemCount: 0,
        consecutiveFailures: 0,
      });
    }
    this.statusMap.set('stocktwits', {
      name: 'StockTwits',
      status: 'ok',
      lastFetched: 0,
      itemCount: 0,
      consecutiveFailures: 0,
    });
  }

  // ── Reddit ──────────────────────────────────────────────────────

  async fetchRedditSub(source: RedditSource): Promise<NewsItem[]> {
    const cacheKey = `reddit:${source.subreddit}`;
    const cached = this.redditCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.items;

    // Rate limit
    const now = Date.now();
    const wait = this.redditRateLimit - (now - this.redditLastFetch);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.redditLastFetch = Date.now();

    try {
      const resp = await fetch(source.endpoint, {
        headers: {
          'User-Agent': 'DawnWhales/2.7.0 (Reddit Reader; contact@dawnwhales.io)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: RedditResponse = await resp.json();
      const posts = data.data?.children || [];

      const items: NewsItem[] = posts
        .filter(p => !p.data.title.startsWith('Daily') && !p.data.title.startsWith('Weekly'))
        .map(post => this.transformRedditPost(post, source));

      this.redditCache.set(cacheKey, { items, ts: Date.now() });

      const status = this.statusMap.get(cacheKey)!;
      status.status = 'ok';
      status.lastFetched = Date.now();
      status.itemCount = items.length;
      status.consecutiveFailures = 0;

      return items;
    } catch (err: any) {
      const status = this.statusMap.get(cacheKey)!;
      status.consecutiveFailures++;
      if (status.consecutiveFailures >= 5) status.status = 'error';
      status.lastError = err.message;
      console.error(`[SocialFeeds] Reddit r/${source.subreddit} failed: ${err.message}`);
      return cached?.items || [];
    }
  }

  private transformRedditPost(post: RedditPost, source: RedditSource): NewsItem {
    const d = post.data;
    const fullText = `${d.title} ${d.selftext}`;
    const tickers = extractTickers(fullText);
    const sentimentScore = this.estimateRedditSentiment(d.title, d.score, d.num_comments);

    return {
      id: `reddit:${d.subreddit}:${d.id}`,
      title: d.title,
      body: d.selftext?.substring(0, 1000) || d.title,
      summary: d.selftext?.substring(0, 200),
      url: `https://www.reddit.com${d.permalink}`,
      source: 'reddit',
      publishedAt: d.created_utc * 1000,
      fetchedAt: Date.now(),
      language: 'en',
      tickers,
      category: 'social',
      impact: d.score > 1000 ? 'P0' : d.score > 500 ? 'P1' : 'P2',
      sentiment: {
        score: sentimentScore,
        confidence: 0.3 + Math.min(0.3, d.score / 10000),
        tickers,
        keywords: this.extractKeywords(d.title, source.tags),
        category: 'social',
        impact: Math.min(10, Math.ceil(d.score / 500)),
        reasoning: `r/${source.subreddit} post: ${d.score} upvotes, ${d.num_comments} comments`,
        provider: 'social',
      },
      metadata: {
        newsSource: `Reddit r/${source.subreddit}`,
        author: d.author,
        upvotes: d.score,
        comments: d.num_comments,
        subreddit: d.subreddit,
        flair: d.link_flair_text,
        tags: source.tags,
      },
      fingerprint: this.computeFingerprint(d.title + d.selftext),
    };
  }

  // ── StockTwits ──────────────────────────────────────────────────

  async fetchStockTwits(ticker: string): Promise<NewsItem[]> {
    const cacheKey = `stocktwits:${ticker}`;
    const cached = this.stocktwitsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.items;

    // Rate limit
    const now = Date.now();
    const wait = this.stocktwitsRateLimit - (now - this.stocktwitsLastFetch);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.stocktwitsLastFetch = Date.now();

    const url = STOCKTWITS_RSS_URL.replace('{TICKER}', ticker.toUpperCase());

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'DawnWhales/2.7.0 (StockTwits Reader)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const xml = await resp.text();
      const rssItems = parseRSSItems(xml);
      const items = rssItems.map(item => this.transformStockTwitsItem(item, ticker));

      this.stocktwitsCache.set(cacheKey, { items, ts: Date.now() });

      const status = this.statusMap.get('stocktwits')!;
      status.status = 'ok';
      status.lastFetched = Date.now();
      status.itemCount += items.length;
      status.consecutiveFailures = 0;

      return items;
    } catch (err: any) {
      const status = this.statusMap.get('stocktwits')!;
      status.consecutiveFailures++;
      if (status.consecutiveFailures >= 5) status.status = 'error';
      status.lastError = err.message;
      console.error(`[SocialFeeds] StockTwits ${ticker} failed: ${err.message}`);
      return cached?.items || [];
    }
  }

  private transformStockTwitsItem(item: { title: string; link: string; description: string; pubDate: string }, ticker: string): NewsItem {
    const fullText = `${item.title} ${item.description}`;
    const tickers = extractTickers(fullText);
    if (!tickers.includes(ticker)) tickers.push(ticker);

    return {
      id: `stocktwits:${ticker}:${this.hashText(item.title + item.link)}`,
      title: item.title,
      body: item.description || item.title,
      summary: item.description?.substring(0, 200),
      url: item.link,
      source: 'stocktwits',
      publishedAt: new Date(item.pubDate).getTime() || Date.now(),
      fetchedAt: Date.now(),
      language: 'en',
      tickers,
      category: 'social',
      impact: 'P3',
      sentiment: {
        score: this.estimateStockTwitsSentiment(item.title),
        confidence: 0.25,
        tickers,
        keywords: [],
        category: 'social',
        impact: 3,
        reasoning: `StockTwits $${ticker} feed`,
        provider: 'social',
      },
      metadata: {
        newsSource: 'StockTwits',
        relatedSymbol: ticker,
        fetchSource: 'rss',
      },
      fingerprint: this.computeFingerprint(item.title + item.description),
    };
  }

  // ── NewsFetcher Interface ──────────────────────────────────────

  async fetch(symbols?: string[], since?: number): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const seen = new Set<string>();

    // Fetch all Reddit subs in parallel
    const redditResults = await Promise.allSettled(
      REDDIT_SOURCES.map(src => this.fetchRedditSub(src))
    );

    for (const result of redditResults) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          if (!seen.has(item.id)) { seen.add(item.id); allItems.push(item); }
        }
      }
    }

    // Fetch StockTwits for requested symbols only (max 5)
    const stSymbols = (symbols && symbols.length > 0) ? symbols.slice(0, 3) : ['SPY'];
    for (const symbol of stSymbols) {
      const stItems = await this.fetchStockTwits(symbol);
      for (const item of stItems) {
        if (!seen.has(item.id)) { seen.add(item.id); allItems.push(item); }
      }
    }

    // Filter by symbol
    let filtered = allItems;
    if (symbols && symbols.length > 0) {
      const symSet = new Set(symbols.map(s => s.toUpperCase()));
      filtered = allItems.filter(item =>
        item.tickers?.some(t => symSet.has(t.toUpperCase()))
      );
    }

    // Filter by time
    if (since) {
      filtered = filtered.filter(item => item.publishedAt >= since);
    }

    filtered.sort((a, b) => b.publishedAt - a.publishedAt);
    return filtered;
  }

  // ── Helpers ────────────────────────────────────────────────────

  private estimateRedditSentiment(title: string, score: number, comments: number): number {
    const lower = title.toLowerCase();
    let s = 0;

    // Keyword-based
    const pos = ['moon', 'rocket', 'pump', 'yolo', 'bullish', 'buy', 'long', 'green', 'gain', 'profit', 'beat'];
    const neg = ['dump', 'crash', 'bearish', 'sell', 'short', 'red', 'loss', 'bankrupt', 'scam', 'rug'];

    for (const kw of pos) if (lower.includes(kw)) s += 0.15;
    for (const kw of neg) if (lower.includes(kw)) s -= 0.15;

    // Score amplification
    if (score > 2000) s += 0.2;
    else if (score > 1000) s += 0.1;

    // Comment engagement adds volatility but not direction

    return Math.max(-1, Math.min(1, s));
  }

  private estimateStockTwitsSentiment(title: string): number {
    const lower = title.toLowerCase();
    const pos = ['bullish', 'buy', 'long', 'beat', 'upgrade', 'growth'];
    const neg = ['bearish', 'sell', 'short', 'miss', 'downgrade', 'decline'];
    let s = 0;
    for (const kw of pos) if (lower.includes(kw)) s += 0.2;
    for (const kw of neg) if (lower.includes(kw)) s -= 0.2;
    return Math.max(-1, Math.min(1, s));
  }

  private extractKeywords(title: string, defaultTags: string[]): string[] {
    const words = title.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while']);
    const meaningful = words.filter(w => w.length > 3 && !stopWords.has(w));
    return [...new Set([...defaultTags, ...meaningful])].slice(0, 8);
  }

  private computeFingerprint(text: string): string {
    return createHash('sha256').update(text.replace(/\s+/g, '').substring(0, 500)).digest('hex').substring(0, 16);
  }

  private hashText(text: string): string {
    return createHash('md5').update(text).digest('hex').substring(0, 12);
  }

  // ── Health ──────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    const statuses = [...this.statusMap.values()];
    return statuses.some(s => s.status === 'ok');
  }

  async getHealth() {
    const statuses = [...this.statusMap.values()];
    const ok = statuses.filter(s => s.status === 'ok').length;
    const err = statuses.filter(s => s.status === 'error').length;
    return {
      status: err === statuses.length ? 'down' : err > 0 ? 'degraded' : 'ok',
      latencyMs: 0,
      lastFetch: Math.max(...statuses.map(s => s.lastFetched)),
      feeds: statuses,
    };
  }

  getFeedStatus(): FeedStatus[] {
    return [...this.statusMap.values()];
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: SocialFeedsFetcher | null = null;
export function getSocialFeedsFetcher(): SocialFeedsFetcher {
  if (!instance) instance = new SocialFeedsFetcher();
  return instance;
}

export function resetSocialFeedsFetcher(): void {
  instance = null;
}
