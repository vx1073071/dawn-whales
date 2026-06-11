import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';

/**
 * J-78-02: realtime-news.ts (~300L)
 * replaces 40-line stub
 *
 * NewsAPI + 
 * ++sort
 * : WebSocket/SSE 
 * → (-100~+100)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RealtimeNewsItem {
  id: string;
  source: string;
  title: string;
  summary: string;
  url?: string;
  sentiment: number;
  symbols: string[];
  categories: string[];
  publishedAt: string;
  fetchedAt: string;
  relevance?: number;
}

export interface NewsSourceConfig {
  name: string;
  enabled: boolean;\1/** @deprecated R83 — use server-side AI Gateway token */
\1\2
  baseUrl?: string;
  fetchIntervalMs: number;
  maxItemsPerFetch: number;
}

export interface NewsFilter {
  symbols?: string[];
  categories?: string[];
  minSentiment?: number;
  maxSentiment?: number;
  since?: string;
  source?: string;
  keyword?: string;
  limit?: number;
}

export interface RealtimeNewsService {
  start(): void;
  stop(): void;
  getLatest(filter?: NewsFilter): RealtimeNewsItem[];
  onNews(callback: (item: RealtimeNewsItem) => void): () => void;
  getNewsById(id: string): RealtimeNewsItem | undefined;
  getStats(): NewsStats;
}

export interface NewsStats {
  totalItems: number;
  sources: Record<string, number>;
  categories: Record<string, number>;
}

// ── Source Configs ─────────────────────────────────────────────────────────

const DEFAULT_SOURCES: NewsSourceConfig[] = [
  { name: 'newsapi', enabled: true, fetchIntervalMs: 60_000, maxItemsPerFetch: 50 },
  { name: 'eastmoney', enabled: true, fetchIntervalMs: 60_000, maxItemsPerFetch: 100 },
];

// ── Sentiment keywords ────────────────────────────────────────────────────
const BULLISH_WORDS = [
  i18n.t('realtimeNews.k1'),
  i18n.t('realtimeNews.k2'),
  i18n.t('realtimeNews.k3'),
  i18n.t('realtimeNews.k4'),
  i18n.t('realtimeNews.k5'),
  i18n.t('realtimeNews.k6'),
  i18n.t('realtimeNews.k7'),
  i18n.t('realtimeNews.k8'),
  i18n.t('realtimeNews.k9'),
  i18n.t('realtimeNews.k10'),
  i18n.t('realtimeNews.k11'),
  i18n.t('realtimeNews.k12'),
  i18n.t('realtimeNews.k13'),
];
const BEARISH_WORDS = [
  i18n.t('realtimeNews.k14'),
  i18n.t('realtimeNews.k15'),
  i18n.t('realtimeNews.k16'),
  i18n.t('realtimeNews.k17'),
  i18n.t('realtimeNews.k18'),
  i18n.t('realtimeNews.k19'),
  i18n.t('realtimeNews.k20'),
  i18n.t('realtimeNews.k21'),
  i18n.t('realtimeNews.k22'),
  i18n.t('realtimeNews.k23'),
  i18n.t('realtimeNews.k24'),
  i18n.t('realtimeNews.k25'),
  i18n.t('realtimeNews.k26'),
  i18n.t('realtimeNews.k27'),
];

// ── News Engine ───────────────────────────────────────────────────────────

export class RealtimeNewsEngine implements RealtimeNewsService {
  private news: Map<string, RealtimeNewsItem> = new Map();
  private listeners: Array<(item: RealtimeNewsItem) => void> = [];
  private intervalIds: ReturnType<typeof setInterval>[] = [];
  private running = false;

  /** Add a news item (dedup by title+source hash) */
  add(item: RealtimeNewsItem): boolean {
    const dedupKey = this.hashTitle(item.title, item.source);
    if (this.news.has(dedupKey)) return false;
    const enriched = { ...item, fetchedAt: new Date().toISOString(), id: dedupKey };
    this.news.set(dedupKey, enriched);
    this.notify(enriched);
    return true;
  }

  addBatch(items: RealtimeNewsItem[]): number {
    return items.reduce((c, item) => c + (this.add(item) ? 1 : 0), 0);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const src of DEFAULT_SOURCES.filter((s) => s.enabled)) {
      this.fetchFromSource(src);
      this.intervalIds.push(setInterval(() => this.fetchFromSource(src), src.fetchIntervalMs));
    }
  }

  stop(): void {
    this.running = false;
    for (const id of this.intervalIds) clearInterval(id);
    this.intervalIds = [];
  }

  getLatest(filter?: NewsFilter): RealtimeNewsItem[] {
    let items = [...this.news.values()].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
    if (filter) {
      if (filter.symbols?.length) items = items.filter((i) => filter.symbols!.some((s) => i.symbols.includes(s)));
      if (filter.categories?.length)
        items = items.filter((i) => filter.categories!.some((c) => i.categories.includes(c)));
      if (filter.minSentiment !== undefined) items = items.filter((i) => i.sentiment >= filter.minSentiment!);
      if (filter.maxSentiment !== undefined) items = items.filter((i) => i.sentiment <= filter.maxSentiment!);
      if (filter.keyword)
        items = items.filter((i) => i.title.includes(filter.keyword!) || i.summary.includes(filter.keyword!));
      if (filter.source) items = items.filter((i) => i.source === filter.source);
      if (filter.since) items = items.filter((i) => new Date(i.publishedAt) >= new Date(filter.since!));
    }
    const limit = filter?.limit ?? 50;
    return items.slice(0, limit);
  }

  getNewsById(id: string): RealtimeNewsItem | undefined {
    return this.news.get(id);
  }

  onNews(callback: (item: RealtimeNewsItem) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  getStats(): NewsStats {
    const sources: Record<string, number> = {};
    const categories: Record<string, number> = {};
    for (const item of this.news.values()) {
      sources[item.source] = (sources[item.source] || 0) + 1;
      for (const cat of item.categories) categories[cat] = (categories[cat] || 0) + 1;
    }
    return { totalItems: this.news.size, sources, categories };
  }

  clear(): void {
    this.news.clear();
  }

  // ── Fetch (simulated — real adapters in production) ───────────────────

  private async fetchFromSource(source: NewsSourceConfig): Promise<void> {
    try {
      if (source.name === 'newsapi') await this.fetchNewsAPI(source);
      else if (source.name === 'eastmoney') await this.fetchEastmoney(source);
    } catch (err) {
      log.warn(`[RealtimeNews] Fetch failed for ${source.name}:`, (err as Error).message);
    }
  }

  private async fetchNewsAPI(source: NewsSourceConfig): Promise<void> {
    // Simulated — in production: GET https://newsapi.org/v2/everything
    const mockItems: RealtimeNewsItem[] = [
      {
        id: '',
        source: 'newsapi',
        title: 'Fed Signals Rate Hold',
        summary: 'Federal Reserve indicates interest rates to remain steady.',
        sentiment: 30,
        symbols: ['US.SPY'],
        categories: ['macro', 'fed'],
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
      },
      {
        id: '',
        source: 'newsapi',
        title: 'Tech Earnings Beat Estimates',
        summary: 'Major tech companies report better-than-expected Q2 results.',
        sentiment: 60,
        symbols: ['US.AAPL', 'US.MSFT'],
        categories: ['earnings', 'tech'],
        publishedAt: new Date(Date.now() - 60000).toISOString(),
        fetchedAt: new Date().toISOString(),
      },
      {
        id: '',
        source: 'newsapi',
        title: 'Oil Prices Dip on Supply Concerns',
        summary: 'Crude oil prices fall amid increased OPEC+ production.',
        sentiment: -25,
        symbols: ['US.USO'],
        categories: ['commodities'],
        publishedAt: new Date(Date.now() - 120000).toISOString(),
        fetchedAt: new Date().toISOString(),
      },
    ];
    this.addBatch(mockItems);
  }

  private async fetchEastmoney(source: NewsSourceConfig): Promise<void> {
    // Simulated — in production: GET https://push2.eastmoney.com/api/qt/ulist/news
    const mockItems: RealtimeNewsItem[] = [
      {
        id: '',
        source: 'eastmoney',
        title: i18n.t('realtimeNews.k28'),
        summary: i18n.t('realtimeNews.k29'),
        sentiment: 70,
        symbols: ['CN.601012', 'CN.688599'],
        categories: ['policy', 'newenergy', 'CN'],
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
      },
      {
        id: '',
        source: 'eastmoney',
        title: i18n.t('realtimeNews.k30'),
        summary: i18n.t('realtimeNews.k31'),
        sentiment: -40,
        symbols: ['HK.0700', 'HK.9988'],
        categories: ['market', 'tech', 'HK'],
        publishedAt: new Date(Date.now() - 30000).toISOString(),
        fetchedAt: new Date().toISOString(),
      },
      {
        id: '',
        source: 'eastmoney',
        title: i18n.t('realtimeNews.k32'),
        summary: i18n.t('realtimeNews.k33'),
        sentiment: 40,
        symbols: ['CN.000001'],
        categories: ['market', 'volume'],
        publishedAt: new Date(Date.now() - 90000).toISOString(),
        fetchedAt: new Date().toISOString(),
      },
      {
        id: '',
        source: 'eastmoney',
        title: i18n.t('realtimeNews.k34'),
        summary: i18n.t('realtimeNews.k35'),
        sentiment: 75,
        symbols: ['CN.688981', 'CN.002049'],
        categories: ['tech', 'semiconductor', 'CN'],
        publishedAt: new Date(Date.now() - 150000).toISOString(),
        fetchedAt: new Date().toISOString(),
      },
    ];
    this.addBatch(mockItems);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private hashTitle(title: string, source: string): string {
    const { createHash } = require('crypto');
    return createHash('md5').update(`${source}|${title}`).digest('hex').substring(0, 16);
  }

  private notify(item: RealtimeNewsItem): void {
    for (const listener of this.listeners) {
      try {
        listener(item);
      } catch {
        /* ignore listener errors */
      }
    }
  }
}

// ── Sentiment Analysis ─────────────────────────────────────────────────────

export function analyzeSentiment(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();
  for (const w of BULLISH_WORDS) if (lower.includes(w.toLowerCase())) score += 15;
  for (const w of BEARISH_WORDS) if (lower.includes(w.toLowerCase())) score -= 15;
  return Math.max(-100, Math.min(100, score));
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: RealtimeNewsEngine | null = null;

export function getRealtimeNewsService(): RealtimeNewsEngine {
  if (!instance) instance = new RealtimeNewsEngine();
  return instance;
}

export function resetRealtimeNews(): void {
  instance?.stop();
  instance?.clear();
  instance = null;
}

export default { RealtimeNewsEngine, getRealtimeNewsService, resetRealtimeNews, analyzeSentiment };
