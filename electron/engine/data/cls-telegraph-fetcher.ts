/**
 * R238-auto#2: 财联社电报 API 接入 (CLS Telegraph Fetcher)
 *
 * 从财联社电报 (cls.cn) 拉取实时快讯，转换为标准化 NewsItem。
 *
 * 数据源特性:
 *   - 类型: 实时快讯 REST API (阿里云市场)
 *   - 延迟: ~500ms (P0 级实时推送)
 *   - 覆盖: A股 / 宏观 / 行业 / 公司
 *   - 认证: 阿里云市场 AppKey (付费)
 *   - 限频: 按套餐 (基础版 1000次/天)
 *
 * API 端点:
 *   - GET /telegraph/index        — 最新电报列表 (分页)
 *   - GET /telegraph/detail/{id} — 电报详情
 *   - GET /telegraph/search      — 搜索电报
 *
 * 降级策略:
 *   - API 不可用 → 轮询财联社公开 RSS (免费)
 *   - 两者皆不可用 → 返回空 (不影响主流程)
 */

import type { NewsItem, NewsFetcher } from './news-types';

// ── Configuration ─────────────────────────────────────────────────────

interface CLSConfig {
  /** 阿里云市场 AppKey */
  appKey: string;
  /** API Base URL */
  baseUrl: string;
  /** 请求超时 (ms) */
  timeoutMs: number;
  /** 轮询间隔 (ms) — 用于降级 RSS 模式 */
  pollIntervalMs: number;
  /** 默认页大小 */
  pageSize: number;
  /** 是否启用降级 */
  enableFallback: boolean;
}

const DEFAULT_CONFIG: CLSConfig = {
  appKey: process.env.CLS_APP_KEY || '',
  baseUrl: 'https://clsapi.market.alicloudapi.com',
  timeoutMs: 3000,
  pollIntervalMs: 5000, // 5 seconds for polling mode
  pageSize: 50,
  enableFallback: true,
};

// ── Response Types ────────────────────────────────────────────────────

interface CLSTelegraphItem {
  id: string;
  title: string;
  content: string;
  ctime: number;           // unix seconds
  type: number;            // 1=快讯 2=深度 3=公告
  level: number;           // 1=普通 2=重要 3=紧急
  tags?: string[];         // e.g. ["A股", "宏观", "科技"]
  stocks?: string[];       // related stock codes
  source?: string;
}

interface CLSAPIResponse {
  code: number;
  message: string;
  data: {
    list: CLSTelegraphItem[];
    total: number;
    page: number;
    hasMore: boolean;
  };
}

// ── Fetcher ───────────────────────────────────────────────────────────

export class CLSTelegraphFetcher implements NewsFetcher {
  readonly source = 'cls_telegraph' as const;
  private config: CLSConfig;
  private lastFetchTime = 0;
  private healthStatus: 'ok' | 'degraded' | 'down' = 'ok';
  private consecutiveErrors = 0;
  private seenIds = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<CLSConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 从阿里云市场 API 获取最新电报
   */
  async fetchTelegraphList(page = 1, pageSize?: number): Promise<CLSTelegraphItem[]> {
    const size = pageSize || this.config.pageSize;

    try {
      const resp = await fetch(
        `${this.config.baseUrl}/telegraph/index?page=${page}&size=${size}`,
        {
          headers: {
            'Authorization': `APPCODE ${this.config.appKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );

      if (!resp.ok) {
        throw new Error(`CLS API HTTP ${resp.status}: ${await resp.text().catch(() => '')}`);
      }

      const body: CLSAPIResponse = await resp.json();
      if (body.code !== 200) {
        throw new Error(`CLS API error: ${body.message}`);
      }

      this.consecutiveErrors = 0;
      this.healthStatus = 'ok';
      this.lastFetchTime = Date.now();
      return body.data?.list || [];
    } catch (err: any) {
      console.error(`[CLS] API fetch failed: ${err.message}`);
      this.consecutiveErrors++;
      this.updateHealth();

      // Fallback to public RSS
      if (this.config.enableFallback) {
        return this.fetchFromPublicRSS();
      }
      return [];
    }
  }

  /**
   * 降级: 财联社公开 RSS (免费, 无需认证)
   */
  private async fetchFromPublicRSS(): Promise<CLSTelegraphItem[]> {
    try {
      const resp = await fetch('https://www.cls.cn/api/sw?app=CailianpressWeb&os=web&sv=8.4.6', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.cls.cn/telegraph',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) return [];

      const body = await resp.json();
      const rawList = body?.data?.roll_data || body?.data || [];

      return rawList.map((item: Record<string, any>) => ({
        id: `cls_rss:${item.id || Date.now()}`,
        title: item.title || '',
        content: item.content || item.brief || '',
        ctime: item.ctime || Math.floor(Date.now() / 1000),
        type: item.type || 1,
        level: item.level || 1,
        tags: item.tags || [],
        stocks: item.stocks || [],
        source: 'cls_rss_fallback',
      }));
    } catch (err: any) {
      console.error(`[CLS] RSS fallback failed: ${err.message}`);
      return [];
    }
  }

  /**
   * 获取单条电报详情
   */
  async fetchDetail(id: string): Promise<CLSTelegraphItem | null> {
    try {
      const resp = await fetch(
        `${this.config.baseUrl}/telegraph/detail/${id}`,
        {
          headers: {
            'Authorization': `APPCODE ${this.config.appKey}`,
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );

      if (!resp.ok) return null;
      const body = await resp.json();
      return body?.data || null;
    } catch (err: any) {
      console.error(`[CLS] Detail fetch failed for ${id}: ${err.message}`);
      return null;
    }
  }

  /**
   * 搜索电报
   */
  async searchTelegraph(query: string, page = 1): Promise<CLSTelegraphItem[]> {
    try {
      const resp = await fetch(
        `${this.config.baseUrl}/telegraph/search?q=${encodeURIComponent(query)}&page=${page}`,
        {
          headers: {
            'Authorization': `APPCODE ${this.config.appKey}`,
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );

      if (!resp.ok) return [];
      const body: CLSAPIResponse = await resp.json();
      return body?.data?.list || [];
    } catch {
      return [];
    }
  }

  // ── NewsFetcher Interface ────────────────────────────────────────

  async fetch(symbols?: string[], since?: number): Promise<NewsItem[]> {
    try {
      const items = await this.fetchTelegraphList(1, this.config.pageSize);

      const results: NewsItem[] = [];
      for (const item of items) {
        // Skip already-seen items
        if (this.seenIds.has(item.id)) continue;
        this.seenIds.add(item.id);

        // Filter by time
        const publishedAtMs = item.ctime * 1000;
        if (since && publishedAtMs < since) continue;

        // Filter by symbols if specified
        if (symbols && symbols.length > 0 && item.stocks) {
          const hasTarget = item.stocks.some(s => symbols.includes(s));
          if (!hasTarget) continue;
        }

        results.push(this.transformToNewsItem(item));
      }

      // Prune seenIds set to prevent memory leak
      if (this.seenIds.size > 100000) {
        const ids = [...this.seenIds];
        this.seenIds = new Set(ids.slice(-50000));
      }

      return results;
    } catch (err: any) {
      console.error(`[CLS] fetch failed: ${err.message}`);
      return [];
    }
  }

  /**
   * 转换 CLS 电报 → Dawn Whales NewsItem
   */
  private transformToNewsItem(item: CLSTelegraphItem): NewsItem {
    // Map CLS level to impact
    const impactMap: Record<number, NewsItem['impact']> = {
      3: 'P0', // 紧急
      2: 'P1', // 重要
      1: 'P2', // 普通
    };

    // Detect category from tags/content
    const category = this.mapCategory(item);

    // Stock codes: CLS uses format like "SH600036" or "600036"
    const tickers = (item.stocks || []).map(s => s.replace(/^(SH|SZ|BJ)/, ''));

    return {
      id: `cls:${item.id}`,
      title: item.title,
      body: item.content,
      summary: item.content?.substring(0, 200)?.replace(/\n/g, ' '),
      source: 'cls_telegraph',
      publishedAt: item.ctime * 1000,
      fetchedAt: Date.now(),
      language: 'zh',
      tickers,
      category,
      impact: impactMap[item.level] || 'P2',
      metadata: {
        clsType: item.type,
        clsLevel: item.level,
        clsTags: item.tags,
        rawStocks: item.stocks,
        source: item.source || 'cls_api',
      },
      fingerprint: this.computeFingerprint(item),
    };
  }

  private mapCategory(item: CLSTelegraphItem): NewsItem['category'] {
    const text = (item.title + item.content + (item.tags || []).join(' ')).toLowerCase();

    if (/财报|业绩|营收|利润|季报|年报|预增|预减/i.test(text)) return 'earnings';
    if (/央行|证监会|政策|监管|降准|降息|加息|LPR/i.test(text)) return 'policy';
    if (/行业|板块|概念|赛道/i.test(text)) return 'industry';
    if (/公司|业务|公告|停牌|复牌|重组|收购/i.test(text)) return 'company';
    if (/GDP|CPI|PMI|进出口|通胀|就业|经济/i.test(text)) return 'macro';
    if (/技术|突破|支撑|阻力/i.test(text)) return 'technical';
    if (/突发|紧急|预警|警告|暴跌|暴涨|熔断/i.test(text)) return 'breaking';

    return 'macro'; // Default for telegraph = macro news
  }

  private computeFingerprint(item: CLSTelegraphItem): string {
    const { createHash } = require('crypto');
    const content = (item.title + item.content).replace(/\s+/g, '').substring(0, 500);
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  // ── Polling Mode (降级) ──────────────────────────────────────────

  /**
   * 启动轮询模式 — 周期性拉取电报
   */
  startPolling(onNews: (items: NewsItem[]) => void): void {
    if (this.pollTimer) this.stopPolling();

    console.log(`[CLS] Starting polling mode (interval: ${this.config.pollIntervalMs}ms)`);
    this.pollTimer = setInterval(async () => {
      const items = await this.fetch();
      if (items.length > 0) {
        onNews(items);
      }
    }, this.config.pollIntervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('[CLS] Polling stopped');
    }
  }

  // ── Health ───────────────────────────────────────────────────────

  private updateHealth(): void {
    if (this.consecutiveErrors >= 5) {
      this.healthStatus = 'down';
    } else if (this.consecutiveErrors >= 2) {
      this.healthStatus = 'degraded';
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const items = await this.fetchTelegraphList(1, 1);
      return items !== null;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<{ status: 'ok' | 'degraded' | 'down'; latencyMs: number; lastFetch?: number }> {
    const start = Date.now();
    try {
      await this.fetchTelegraphList(1, 1);
      return {
        status: 'ok',
        latencyMs: Date.now() - start,
        lastFetch: this.lastFetchTime || undefined,
      };
    } catch {
      return {
        status: this.healthStatus,
        latencyMs: Date.now() - start,
        lastFetch: this.lastFetchTime || undefined,
      };
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: CLSTelegraphFetcher | null = null;
export function getCLSTelegraphFetcher(config?: Partial<CLSConfig>): CLSTelegraphFetcher {
  if (!instance) instance = new CLSTelegraphFetcher(config);
  return instance;
}
