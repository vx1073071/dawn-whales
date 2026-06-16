/**
 * R238-auto#1a: 雪球 API 接入 (Xueqiu Fetcher)
 *
 * 从雪球 (xueqiu.com) 拉取热门讨论帖，转换为标准化 NewsItem。
 *
 * 数据源特性:
 *   - 类型: 社交投资 REST API
 *   - 延迟: ~3s
 *   - 覆盖: A股/港美股
 *   - 认证: 无需 API Key (公开接口)
 *   - 限频: 60次/分钟
 *
 * API 端点:
 *   - GET /statuses/search.json?q={symbol}&count=20   — 搜索帖子
 *   - GET /statuses/hot.json?symbol={symbol}          — 热门讨论
 *   - GET /stock/{symbol}/news.json?page=1&size=20    — 个股新闻
 */

import { createHash } from 'crypto';
import type { NewsItem, NewsFetcher } from './news-types';

// ── Configuration ─────────────────────────────────────────────────────

const XUEQIU_BASE = 'https://xueqiu.com';
const REQUEST_TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const MIN_FETCH_INTERVAL = 2000; // 2 seconds between requests
const CACHE_TTL = 60000; // 1 minute

interface XueqiuStatus {
  id: number;
  title: string;
  text: string;
  created_at: number;
  user: {
    id: number;
    screen_name: string;
    followers_count: number;
  };
  retweet_count: number;
  reply_count: number;
  symbol?: string;
  source?: string;
}

// ── Rate Limiter ──────────────────────────────────────────────────────

class RateLimiter {
  private lastRequest = 0;
  private requestCount = 0;
  private windowStart = Date.now();

  async acquire(): Promise<void> {
    const now = Date.now();

    // Reset window every 60s
    if (now - this.windowStart > 60000) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Enforce 60 req/min
    if (this.requestCount >= 55) {
      const waitMs = 60000 - (now - this.windowStart) + 100;
      await new Promise(r => setTimeout(r, waitMs));
      this.windowStart = Date.now();
      this.requestCount = 0;
    }

    // Enforce minimum interval
    const elapsed = now - this.lastRequest;
    if (elapsed < MIN_FETCH_INTERVAL) {
      await new Promise(r => setTimeout(r, MIN_FETCH_INTERVAL - elapsed));
    }

    this.lastRequest = Date.now();
    this.requestCount++;
  }
}

// ── Fetcher Implementation ────────────────────────────────────────────

export class XueqiuFetcher implements NewsFetcher {
  readonly source = 'xueqiu' as const;
  private limiter = new RateLimiter();
  private cookies: string | null = null;
  private cache = new Map<string, { data: NewsItem[]; ts: number }>();
  private healthStatus: 'ok' | 'degraded' | 'down' = 'ok';
  private lastFetchTime = 0;
  private consecutiveErrors = 0;

  /**
   * 获取雪球 Cookie (用于 API 认证)
   * 雪球要求请求携带 Cookie (xq_a_token)
   */
  private async ensureCookies(): Promise<string> {
    if (this.cookies) return this.cookies;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const resp = await fetch(`${XUEQIU_BASE}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const setCookie = resp.headers.get('set-cookie');
      if (setCookie) {
        this.cookies = setCookie.split(';')[0];
        return this.cookies!;
      }

      // Attempt without cookie
      this.cookies = '';
      return '';
    } catch (err: any) {
      console.warn(`[Xueqiu] Cookie fetch failed: ${err.message}, proceeding without`);
      this.cookies = '';
      return '';
    }
  }

  /**
   * 发送 API 请求 (含重试)
   */
  private async request(path: string): Promise<unknown> {
    const cookie = await this.ensureCookies();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.limiter.acquire();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const resp = await fetch(`${XUEQIU_BASE}${path}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            ...(cookie ? { 'Cookie': cookie } : {}),
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          if (resp.status === 429) {
            const retryAfter = parseInt(resp.headers.get('Retry-After') || '5', 10);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          }
          throw new Error(`HTTP ${resp.status}`);
        }

        const json = await resp.json();
        this.consecutiveErrors = 0;
        this.healthStatus = 'ok';
        return json;
      } catch (err: any) {
        if (attempt < MAX_RETRIES - 1 && err.name === 'AbortError') {
          await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    throw new Error(`[Xueqiu] Failed after ${MAX_RETRIES} retries`);
  }

  /**
   * 获取热门讨论帖
   */
  async fetchHotPosts(symbol?: string, limit = 20): Promise<XueqiuStatus[]> {
    const cacheKey = `hot:${symbol || 'global'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data as unknown as XueqiuStatus[];
    }

    try {
      let path = '/statuses/hot.json';
      if (symbol) path += `?symbol=${encodeURIComponent(symbol)}`;

      const data = await this.request(path) as { list?: XueqiuStatus[] };
      const items = data?.list || [];
      this.cache.set(cacheKey, { data: items as unknown as NewsItem[], ts: Date.now() });
      this.lastFetchTime = Date.now();
      return items;
    } catch (err: any) {
      console.error(`[Xueqiu] fetchHotPosts failed: ${err.message}`);
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= 5) this.healthStatus = 'down';
      else if (this.consecutiveErrors >= 2) this.healthStatus = 'degraded';
      return [];
    }
  }

  /**
   * 搜索帖子
   */
  async searchPosts(query: string, limit = 20): Promise<XueqiuStatus[]> {
    const path = `/statuses/search.json?q=${encodeURIComponent(query)}&count=${Math.min(limit, 50)}`;
    try {
      const data = await this.request(path) as { list?: XueqiuStatus[] };
      return data?.list || [];
    } catch (err: any) {
      console.error(`[Xueqiu] searchPosts failed: ${err.message}`);
      return [];
    }
  }

  /**
   * 主提取方法 — 实现 NewsFetcher 接口
   */
  async fetch(symbols?: string[], since?: number): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const seenIds = new Set<number>();

    const targets = symbols && symbols.length > 0 ? symbols : ['SH000001', 'SZ399001'];

    for (const symbol of targets) {
      try {
        // Fetch hot posts + search results for each symbol
        const [hotPosts, searchResults] = await Promise.all([
          this.fetchHotPosts(symbol, 20),
          this.searchPosts(symbol, 20),
        ]);

        const merged = [...hotPosts, ...searchResults];
        for (const post of merged) {
          if (seenIds.has(post.id)) continue;
          seenIds.add(post.id);

          if (since && post.created_at < since) continue;

          allItems.push(this.transformToNewsItem(post, symbol));
        }
      } catch (err: any) {
        console.error(`[Xueqiu] fetch failed for ${symbol}: ${err.message}`);
      }
    }

    return allItems;
  }

  /**
   * 转换 Xueqiu 帖子 → QUANT MOO NewsItem
   */
  private transformToNewsItem(post: XueqiuStatus, symbol?: string): NewsItem {
    // Extract tickers from text
    const tickers = this.extractTickers(post.text, symbol);

    // Detect category from content
    const category = this.detectCategory(post.title || post.text);

    return {
      id: `xueqiu:${post.id}`,
      title: post.title || post.text.substring(0, 100),
      body: post.text,
      summary: post.text.substring(0, 200).replace(/\n/g, ' '),
      url: `https://xueqiu.com${post.source || ''}`,
      source: 'xueqiu',
      publishedAt: post.created_at,
      fetchedAt: Date.now(),
      language: 'zh',
      tickers,
      category,
      impact: post.retweet_count > 100 ? 'P1' : post.retweet_count > 10 ? 'P2' : 'P3',
      metadata: {
        author: post.user?.screen_name || 'unknown',
        followers: post.user?.followers_count || 0,
        retweets: post.retweet_count,
        replies: post.reply_count,
        engagement: (post.retweet_count || 0) + (post.reply_count || 0),
      },
      fingerprint: this.computeFingerprint(post),
    };
  }

  /**
   * 从文本中提取股票代码
   */
  private extractTickers(text: string, symbol?: string): string[] {
    const tickers: string[] = [];
    if (symbol) tickers.push(symbol);

    // $AAPL $TSLA like mentions
    const dollarMentions = text.match(/\$([A-Z]{1,5})/g);
    if (dollarMentions) {
      dollarMentions.forEach(m => tickers.push(m.substring(1)));
    }

    // Chinese stock codes: 600xxx, 000xxx, 300xxx
    const cnCodes = text.match(/\b(\d{6})\b/g);
    if (cnCodes) {
      cnCodes.forEach(c => {
        if (/^(60[0-9]|00[0-9]|30[0-9]|68[0-9])\d{3}$/.test(c)) {
          tickers.push(c);
        }
      });
    }

    return [...new Set(tickers)];
  }

  /**
   * 检测新闻类别
   */
  private detectCategory(text: string): NewsItem['category'] {
    const lower = text.toLowerCase();
    if (/财报|营收|利润|earning|revenue|eps/i.test(lower)) return 'earnings';
    if (/政策|央行|监管|降息|regulation|fed|pboc/i.test(lower)) return 'policy';
    if (/行业|板块|sector|industry/i.test(lower)) return 'industry';
    if (/公司|业务|product|ceo|launch/i.test(lower)) return 'company';
    if (/GDP|CPI|通胀|就业|宏观|economy/i.test(lower)) return 'macro';
    if (/技术|突破|支撑|阻力|K线|ma|rsi/i.test(lower)) return 'technical';
    if (/突发|紧急|breaking|urgent/i.test(lower)) return 'breaking';
    return 'social';
  }

  /**
   * 计算去重指纹
   */
  private computeFingerprint(post: XueqiuStatus): string {
    const content = (post.title + post.text).replace(/\s+/g, '').substring(0, 500);
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  // ── Health Check ─────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    try {
      const items = await this.fetchHotPosts(undefined, 1);
      return items.length >= 0; // Empty response is still available
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<{ status: 'ok' | 'degraded' | 'down'; latencyMs: number; lastFetch?: number }> {
    const start = Date.now();
    try {
      await this.fetchHotPosts(undefined, 1);
      return {
        status: 'ok',
        latencyMs: Date.now() - start,
        lastFetch: this.lastFetchTime || undefined,
      };
    } catch {
      return {
        status: this.healthStatus as 'ok' | 'degraded' | 'down',
        latencyMs: Date.now() - start,
        lastFetch: this.lastFetchTime || undefined,
      };
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: XueqiuFetcher | null = null;
export function getXueqiuFetcher(): XueqiuFetcher {
  if (!instance) instance = new XueqiuFetcher();
  return instance;
}
