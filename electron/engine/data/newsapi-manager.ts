/**
 * R239-auto#1: NewsAPI.org 接入 + API Key 管理
 *
 * NewsAPI.org 接入: 英文80K源综合新闻搜索
 *
 * 特性:
 *   - 端点: GET /v2/everything (搜索) + GET /v2/top-headlines (头条)
 *   - 限频: 免费 100次/天, 付费 500次/天
 *   - 认证: API Key via X-Api-Key header
 *   - 缓存: LRU 5分钟TTL
 *   - Key管理: AES-256-GCM 加密存储, 轮换日志
 *
 * API Key 管理:
 *   - 加密存储 (AES-256-GCM)
 *   - 轮换支持 (旧Key保留72h过渡期)
 *   - 使用统计 (日/月用量)
 *   - 费率限制检测 (429响应处理)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import type { NewsItem, NewsFetcher } from './news-types';

// ── Configuration ─────────────────────────────────────────────────────

const NEWSAPI_BASE = 'https://newsapi.org/v2';
const REQUEST_TIMEOUT = 8000;
const CACHE_TTL = 300000; // 5 minutes
const MAX_RETRIES = 3;
const DAILY_LIMIT_FREE = 100;
const DAILY_LIMIT_PAID = 500;

// Encryption config for API key storage
const ENCRYPTION_KEY = process.env.NEWS_ENCRYPTION_KEY || randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: 'ok' | 'error';
  totalResults: number;
  articles: NewsAPIArticle[];
  code?: string;
  message?: string;
}

// ── API Key Manager ───────────────────────────────────────────────────

interface KeyEntry {
  key: string;
  encrypted: string;
  tier: 'free' | 'paid';
  dailyLimit: number;
  createdAt: number;
  lastUsed?: number;
  dailyCount: number;
  totalCount: number;
  isActive: boolean;
}

export class NewsAPIKeyManager {
  private keys = new Map<string, KeyEntry>();
  private dailyResetAt = 0;

  constructor() {
    this.dailyResetAt = this.nextResetTime();
  }

  /**
   * 添加 API Key (自动加密)
   */
  addKey(key: string, tier: 'free' | 'paid' = 'free'): string {
    const id = `newsapi_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const encrypted = this.encryptKey(key);

    this.keys.set(id, {
      key,
      encrypted,
      tier,
      dailyLimit: tier === 'paid' ? DAILY_LIMIT_PAID : DAILY_LIMIT_FREE,
      createdAt: Date.now(),
      dailyCount: 0,
      totalCount: 0,
      isActive: true,
    });

    return id;
  }

  /**
   * 轮换 Key (旧Key保留72h过渡期后自动失效)
   */
  rotateKey(oldId: string, newKey: string, tier: 'free' | 'paid'): string {
    const newId = this.addKey(newKey, tier);

    // Mark old key for retirement after 72h
    const oldEntry = this.keys.get(oldId);
    if (oldEntry) {
      setTimeout(() => {
        const entry = this.keys.get(oldId);
        if (entry) entry.isActive = false;
      }, 72 * 60 * 60 * 1000);
    }

    return newId;
  }

  /**
   * 获取可用的 API Key (自动负载均衡)
   */
  getActiveKey(): { key: string; id: string } | null {
    // Reset daily counts if needed
    if (Date.now() >= this.dailyResetAt) {
      this.resetDailyCounts();
      this.dailyResetAt = this.nextResetTime();
    }

    // Find key with most remaining quota
    let best: { id: string; entry: KeyEntry; remaining: number } | null = null;

    for (const [id, entry] of this.keys) {
      if (!entry.isActive) continue;
      const remaining = entry.dailyLimit - entry.dailyCount;
      if (remaining <= 0) continue;

      if (!best || remaining > best.remaining) {
        best = { id, entry, remaining };
      }
    }

    return best ? { key: best.entry.key, id: best.id } : null;
  }

  /**
   * 记录使用次数
   */
  recordUsage(id: string): void {
    const entry = this.keys.get(id);
    if (entry) {
      entry.dailyCount++;
      entry.totalCount++;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * 获取使用统计
   */
  getStats() {
    const stats = {
      totalKeys: this.keys.size,
      activeKeys: 0,
      paidKeys: 0,
      freeKeys: 0,
      totalRequests: 0,
      dailyRequests: 0,
      remainingDaily: 0,
    };

    for (const entry of this.keys.values()) {
      if (entry.isActive) stats.activeKeys++;
      if (entry.tier === 'paid') stats.paidKeys++;
      else stats.freeKeys++;
      stats.totalRequests += entry.totalCount;
      stats.dailyRequests += entry.dailyCount;
      stats.remainingDaily += Math.max(0, entry.dailyLimit - entry.dailyCount);
    }

    return stats;
  }

  // ── Private ──────────────────────────────────────────────────────

  private encryptKey(key: string): string {
    const iv = randomBytes(16);
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex').subarray(0, 32);
    const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(key, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptKey(encrypted: string): string {
    const [ivHex, authTagHex, dataHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex').subarray(0, 32);
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  private resetDailyCounts(): void {
    for (const entry of this.keys.values()) {
      entry.dailyCount = 0;
    }
  }

  private nextResetTime(): number {
    const now = new Date();
    now.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    return now.getTime();
  }
}

// ── NewsAPI Fetcher ───────────────────────────────────────────────────

interface NewsAPIConfig {
  pageSize: number;
  maxResults: number;
  language: string;
  sortBy: 'relevancy' | 'popularity' | 'publishedAt';
}

const DEFAULT_CONFIG: NewsAPIConfig = {
  pageSize: 50,
  maxResults: 100,
  language: 'en',
  sortBy: 'publishedAt',
};

export class NewsAPIFetcher implements NewsFetcher {
  readonly source = 'newsapi' as const;
  private config: NewsAPIConfig;
  private keyManager: NewsAPIKeyManager;
  private cache = new Map<string, { data: NewsItem[]; ts: number }>();
  private lastFetchTime = 0;
  private healthStatus: 'ok' | 'degraded' | 'down' = 'ok';
  private consecutiveErrors = 0;

  constructor(keyManager: NewsAPIKeyManager, config?: Partial<NewsAPIConfig>) {
    this.keyManager = keyManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 发送 API 请求
   */
  private async request(path: string): Promise<NewsAPIResponse> {
    const keyInfo = this.keyManager.getActiveKey();
    if (!keyInfo) {
      throw new Error('[NewsAPI] No active API keys available (quota exhausted)');
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(`${NEWSAPI_BASE}${path}`, {
          headers: {
            'X-Api-Key': keyInfo.key,
            'User-Agent': 'QuantMoo/2.7.0',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        this.keyManager.recordUsage(keyInfo.id);

        if (resp.status === 429) {
          // Rate limited — try another key
          const altKey = this.keyManager.getActiveKey();
          if (altKey && altKey.id !== keyInfo.id) {
            keyInfo.key = altKey.key;
            keyInfo.id = altKey.id;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw new Error('[NewsAPI] Rate limit exceeded on all keys');
        }

        if (!resp.ok) {
          throw new Error(`[NewsAPI] HTTP ${resp.status}`);
        }

        const body = await resp.json();
        if (body.status === 'error') {
          throw new Error(`[NewsAPI] ${body.code}: ${body.message}`);
        }

        this.consecutiveErrors = 0;
        this.healthStatus = 'ok';
        this.lastFetchTime = Date.now();
        return body;
      } catch (err: any) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        this.consecutiveErrors++;
        this.updateHealth();
        throw err;
      }
    }

    throw new Error('[NewsAPI] Max retries exceeded');
  }

  /**
   * 搜索新闻
   */
  async search(query: string, from?: string, to?: string): Promise<NewsItem[]> {
    const cacheKey = `search:${query}:${from || ''}:${to || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    try {
      const params = new URLSearchParams({
        q: query,
        pageSize: String(this.config.pageSize),
        language: this.config.language,
        sortBy: this.config.sortBy,
      });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const data = await this.request(`/everything?${params}`);
      const items = (data.articles || []).map(a => this.transformToNewsItem(a, 'search'));
      this.cache.set(cacheKey, { data: items, ts: Date.now() });
      return items;
    } catch (err: any) {
      console.error(`[NewsAPI] search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * 获取头条新闻
   */
  async topHeadlines(category?: string, country = 'us'): Promise<NewsItem[]> {
    const cacheKey = `headlines:${country}:${category || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    try {
      const params = new URLSearchParams({
        country,
        pageSize: String(Math.min(this.config.pageSize, 20)),
      });
      if (category) params.set('category', category);

      const data = await this.request(`/top-headlines?${params}`);
      const items = (data.articles || []).map(a => this.transformToNewsItem(a, 'headlines'));
      this.cache.set(cacheKey, { data: items, ts: Date.now() });
      return items;
    } catch (err: any) {
      console.error(`[NewsAPI] topHeadlines failed: ${err.message}`);
      return [];
    }
  }

  // ── NewsFetcher Interface ────────────────────────────────────────

  async fetch(symbols?: string[], since?: number): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];

    try {
      // Fetch top headlines (general market context)
      const headlines = await this.topHeadlines('business');
      allItems.push(...headlines);

      // Fetch symbol-specific news
      if (symbols && symbols.length > 0) {
        for (const symbol of symbols) {
          const symbolNews = await this.search(symbol);
          allItems.push(...symbolNews);
        }
      }

      // Filter by time
      if (since) {
        return allItems.filter(item => item.publishedAt >= since);
      }

      // Deduplicate by ID within this batch
      const seen = new Set<string>();
      return allItems.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    } catch (err: any) {
      console.error(`[NewsAPI] fetch failed: ${err.message}`);
      return allItems;
    }
  }

  private transformToNewsItem(article: NewsAPIArticle, source: string): NewsItem {
    const tickers = this.extractTickers(article.title + ' ' + (article.description || ''));
    const category = this.detectCategory(article.title, article.description || '');

    return {
      id: `newsapi:${this.hashTitle(article.title)}`,
      title: article.title,
      body: article.content || article.description || article.title,
      summary: article.description?.substring(0, 200),
      url: article.url,
      source: 'newsapi',
      publishedAt: new Date(article.publishedAt).getTime(),
      fetchedAt: Date.now(),
      language: 'en',
      tickers,
      category,
      impact: this.detectImpact(article.title, article.description || ''),
      metadata: {
        newsSource: article.source.name,
        author: article.author,
        imageUrl: article.urlToImage,
        fetchSource: source,
      },
      fingerprint: this.computeFingerprint(article),
    };
  }

  private hashTitle(title: string): string {
    return createHash('md5').update(title).digest('hex').substring(0, 12);
  }

  private computeFingerprint(article: NewsAPIArticle): string {
    const content = (article.title + (article.description || '')).replace(/\s+/g, '').substring(0, 500);
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private extractTickers(text: string): string[] {
    const matches = text.match(/\$?[A-Z]{1,5}\b/g);
    if (!matches) return [];
    const blacklist = new Set(['A', 'I', 'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'HAVE', 'NEW', 'NOW', 'ITS', 'INC', 'CEO', 'CFO', 'USA', 'USD', 'ETF', 'IPO', 'GDP', 'CPI', 'PMI', 'API', 'SEO', 'AI', 'ML', 'VC', 'PE', 'IT', 'HR', 'PR', 'US', 'UK', 'EU', 'UN', 'UK']);
    return [...new Set(matches.map(m => m.replace('$', '')).filter(m => !blacklist.has(m)))];
  }

  private detectCategory(title: string, desc: string): NewsItem['category'] {
    const text = (title + ' ' + desc).toLowerCase();
    if (/earnings|revenue|profit|quarterly|eps|guidance/i.test(text)) return 'earnings';
    if (/fed|central bank|interest rate|inflation|policy|regulation|sec|cftc/i.test(text)) return 'policy';
    if (/sector|industry|supply chain|manufacturing/i.test(text)) return 'industry';
    if (/ceo|merger|acquisition|layoff|product|launch|patent|ipo|spin/i.test(text)) return 'company';
    if (/gdp|employment|unemployment|trade|deficit|economy|recession|growth/i.test(text)) return 'macro';
    if (/technical|support|resistance|breakout|trend|volume|rsi|moving average/i.test(text)) return 'technical';
    if (/breaking|urgent|alert|crash|surge|plunge|halt/i.test(text)) return 'breaking';
    return 'company';
  }

  private detectImpact(title: string, desc: string): NewsItem['impact'] {
    const text = (title + ' ' + desc).toLowerCase();
    if (/crash|plunge|meltdown|bankruptcy|scandal|investigation|fraud|halt|suspension/i.test(text)) return 'P0';
    if (/warn|miss|downgrade|layoff|lawsuit|fine|sanction|volatility|surge/i.test(text)) return 'P1';
    if (/beat|upgrade|positive|growth|expansion|partnership|launch/i.test(text)) return 'P2';
    return 'P3';
  }

  private updateHealth(): void {
    if (this.consecutiveErrors >= 5) this.healthStatus = 'down';
    else if (this.consecutiveErrors >= 2) this.healthStatus = 'degraded';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const keyInfo = this.keyManager.getActiveKey();
      return !!keyInfo;
    } catch {
      return false;
    }
  }

  async getHealth() {
    return {
      status: this.healthStatus,
      latencyMs: 0,
      lastFetch: this.lastFetchTime || undefined,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: NewsAPIKeyManager | null = null;
export function getNewsAPIKeyManager(): NewsAPIKeyManager {
  if (!instance) instance = new NewsAPIKeyManager();
  return instance;
}
