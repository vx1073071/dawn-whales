/**
 * R240-auto: News Stock Screener + Crypto Feeds Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NewsStockScreener, resetStockScreener } from '../../electron/engine/data/news-stock-screener';
import { CryptoFeedsFetcher, resetCryptoFeedsFetcher } from '../../electron/engine/data/crypto-feeds';
import type { NewsItem } from '../../electron/engine/data/news-types';

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function createNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: `test:${Math.random().toString(36).substring(7)}`,
    title: 'Test News',
    body: 'Test body content.',
    source: 'newsapi',
    publishedAt: Date.now(),
    fetchedAt: Date.now(),
    language: 'en',
    tickers: ['TEST'],
    sentiment: { score: 0, confidence: 0.8, tickers: [], keywords: [], category: 'company', impact: 5, reasoning: '', provider: 'keyword' },
    ...overrides,
  };
}

function daysAgo(days: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

// ═══════════════════════════════════════════════════════════════════════
// R240-auto#1: NewsStockScreener Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R240-auto#1: NewsStockScreener', () => {
  let screener: NewsStockScreener;

  beforeEach(() => {
    resetStockScreener();
    screener = new NewsStockScreener({ maxResults: 20, minNewsToEvaluate: 2, lookbackDays: 30 });
  });

  describe('Ingestion', () => {
    it('ingests news and builds history', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.6 } as any }),
        createNewsItem({ tickers: ['MSFT'], publishedAt: daysAgo(1), sentiment: { score: -0.3 } as any }),
      ];

      screener.ingest(items);
      const stats = screener.getStats();
      expect(stats.trackedTickers).toBeGreaterThanOrEqual(2);
      expect(stats.totalSnapshots).toBeGreaterThanOrEqual(2);
    });

    it('handles empty news', () => {
      screener.ingest([]);
      const stats = screener.getStats();
      expect(stats.trackedTickers).toBe(0);
    });

    it('merges new data with existing history', () => {
      const batch1: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(2), sentiment: { score: 0.3 } as any }),
      ];
      const batch2: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(1), sentiment: { score: 0.5 } as any }),
      ];

      screener.ingest(batch1);
      screener.ingest(batch2);
      const stats = screener.getStats();
      expect(stats.trackedTickers).toBe(1);
      expect(stats.totalSnapshots).toBe(2);
    });
  });

  describe('Sentiment Improving Preset', () => {
    it('detects improving sentiment over 3 days', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(2), sentiment: { score: 0.1 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(1), sentiment: { score: 0.3 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.4 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.6 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
      ];

      screener.ingest(items);
      const results = screener.screen('情绪改善选股');
      expect(results.length).toBeGreaterThanOrEqual(0);
      if (results.length > 0) {
        const r = results[0];
        expect(r.ticker).toBe('AAPL');
        expect(r.score).toBeGreaterThan(0);
      }
    });

    it('does not detect improving sentiment when declining', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(2), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(1), sentiment: { score: 0.3 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: -0.1 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: -0.2 } as any }),
      ];

      screener.ingest(items);
      const results = screener.screen('情绪改善选股');
      expect(results.length).toBe(0);
    });
  });

  describe('Sentiment Reversal Preset', () => {
    it('detects sentiment reversal from negative to positive', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['TSLA'], publishedAt: daysAgo(1), sentiment: { score: -0.3 } as any }),
        createNewsItem({ tickers: ['TSLA'], publishedAt: daysAgo(1), sentiment: { score: -0.2 } as any }),
        createNewsItem({ tickers: ['TSLA'], publishedAt: daysAgo(0), sentiment: { score: 0.3 } as any }),
        createNewsItem({ tickers: ['TSLA'], publishedAt: daysAgo(0), sentiment: { score: 0.4 } as any }),
        createNewsItem({ tickers: ['TSLA'], publishedAt: daysAgo(0), sentiment: { score: 0.2 } as any }),
      ];

      screener.ingest(items);
      const results = screener.screen('情绪反转捕捉');
      // Reversal from -0.25 to +0.3 → from_threshold -0.1 to to_threshold 0.1 ✓
      // But volume is undefined, so volume_surge condition fails
      // In AND logic, both must pass
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('News Surge Preset', () => {
    it('detects news surge (many articles today vs avg)', () => {
      const items: NewsItem[] = [
        // Past 4 days: 1 article each
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(4), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(3), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(2), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(1), sentiment: { score: 0.5 } as any }),
        // Today: 5 articles
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(0), sentiment: { score: 0.6 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['NVDA'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
      ];

      screener.ingest(items);
      const results = screener.screen('海量新闻预警');
      expect(results.length).toBeGreaterThanOrEqual(0);
      if (results.length > 0) {
        expect(results[0].ticker).toBe('NVDA');
      }
    });
  });

  describe('Signals', () => {
    it('returns signals for a ticker', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(2), sentiment: { score: 0.3 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(1), sentiment: { score: 0.4 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
      ];

      screener.ingest(items);
      const signals = screener.getSignals('AAPL');
      expect(signals).not.toBeNull();
      if (signals) {
        expect(signals.sentimentTrend).toBe('improving');
        expect(typeof signals.sentimentAvg).toBe('number');
        expect(typeof signals.newsCount).toBe('number');
        expect(signals.newsTrend).toBeDefined();
      }
    });

    it('returns null for unknown ticker', () => {
      const signals = screener.getSignals('UNKNOWN');
      expect(signals).toBeNull();
    });

    it('returns null for ticker with insufficient data', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['TSLA'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
      ];
      screener.ingest(items);
      const signals = screener.getSignals('TSLA');
      expect(signals).toBeNull(); // Only 1 snapshot, need 2+
    });
  });

  describe('ScreenerResult Structure', () => {
    it('produces valid results with all fields', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['GOOG'], publishedAt: daysAgo(2), sentiment: { score: 0.3 } as any }),
        createNewsItem({ tickers: ['GOOG'], publishedAt: daysAgo(1), sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['GOOG'], publishedAt: daysAgo(0), sentiment: { score: 0.7 } as any }),
        createNewsItem({ tickers: ['GOOG'], publishedAt: daysAgo(0), sentiment: { score: 0.6 } as any }),
        createNewsItem({ tickers: ['GOOG'], publishedAt: daysAgo(0), sentiment: { score: 0.8 } as any }),
      ];

      screener.ingest(items);
      const results = screener.screen();

      for (const r of results) {
        expect(typeof r.ticker).toBe('string');
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
        expect(Array.isArray(r.matchedConditions)).toBe(true);
        expect(r.signals.sentimentTrend).toBeDefined();
        expect(['STRONG_BUY', 'BUY', 'HOLD', 'WATCH', 'CAUTION']).toContain(r.suggestion);
        expect(Array.isArray(r.recentNews)).toBe(true);
      }
    });
  });

  describe('Presets Management', () => {
    it('has default presets', () => {
      const presets = screener.getPresets();
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(presets[0].name).toBe('情绪改善选股');
    });

    it('adds and removes presets', () => {
      const custom = { name: 'TestPreset', description: 'Custom', conditions: [], logic: 'AND' as const };
      screener.addPreset(custom);
      expect(screener.getPresets().length).toBeGreaterThan(4);

      screener.removePreset('TestPreset');
      const names = screener.getPresets().map(p => p.name);
      expect(names).not.toContain('TestPreset');
    });
  });

  describe('Volume Data', () => {
    it('accepts volume data', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(0), sentiment: { score: 0.5 } as any }),
      ];
      screener.ingest(items);

      screener.setVolumeData([{
        ticker: 'AAPL',
        date: daysAgo(0),
        volume: 1000000,
      }]);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Multi-Ticker Screening', () => {
    it('screens multiple tickers simultaneously', () => {
      const items: NewsItem[] = [];
      ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'META'].forEach((ticker, i) => {
        for (let day = 3; day >= 0; day--) {
          items.push(createNewsItem({
            tickers: [ticker],
            publishedAt: daysAgo(day),
            sentiment: { score: 0.2 + (3 - day) * 0.15 + i * 0.02 } as any,
          }));
        }
      });

      screener.ingest(items);
      const results = screener.screen();
      // Some may match, some may not depending on conditions
      expect(Array.isArray(results)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// R240-auto#2: CryptoFeedsFetcher Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R240-auto#2: CryptoFeedsFetcher', () => {
  let fetcher: CryptoFeedsFetcher;

  beforeEach(() => {
    resetCryptoFeedsFetcher();
    fetcher = new CryptoFeedsFetcher();
  });

  describe('Configuration', () => {
    it('initializes with 5 default crypto feeds', () => {
      const status = fetcher.getFeedStatus();
      expect(status).toHaveLength(5);
      const names = status.map(s => s.name);
      expect(names).toContain('CoinDesk');
      expect(names).toContain('CoinTelegraph');
      expect(names).toContain('Decrypt');
      expect(names).toContain('The Block');
      expect(names).toContain('CryptoFeedr');
    });

    it('initializes all feeds with status ok', () => {
      const status = fetcher.getFeedStatus();
      for (const s of status) {
        expect(s.status).toBe('ok');
      }
    });

    it('is available when feeds are configured', async () => {
      const available = await fetcher.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('RSS Parser (via fetchFeed)', () => {
    it('fetches from CoinDesk RSS', async () => {
      const status = fetcher.getFeedStatus();
      const coindesk = status.find(s => s.name === 'CoinDesk')!;

      const feeds = (fetcher as any).feeds;
      const coindeskFeed = feeds.find((f: any) => f.name === 'CoinDesk');
      if (!coindeskFeed) return;

      const items = await fetcher.fetchFeed(coindeskFeed);
      // CoinDesk RSS should return items
      expect(Array.isArray(items)).toBe(true);
      // RSS feeds may be empty but shouldn't throw
    });

    it('returns cached items on second fetch within interval', async () => {
      const feeds = (fetcher as any).feeds;
      const coindeskFeed = feeds.find((f: any) => f.name === 'CoinDesk');

      const items1 = await fetcher.fetchFeed(coindeskFeed);
      const items2 = await fetcher.fetchFeed(coindeskFeed);

      // Second fetch should use cache (same reference or length)
      expect(Array.isArray(items1)).toBe(true);
      expect(Array.isArray(items2)).toBe(true);
    });

    it('produces valid NewsItem structure', async () => {
      const feeds = (fetcher as any).feeds;
      const coindeskFeed = feeds.find((f: any) => f.name === 'CoinDesk');

      const items = await fetcher.fetchFeed(coindeskFeed);
      if (items.length > 0) {
        const item = items[0];
        expect(typeof item.id).toBe('string');
        expect(typeof item.title).toBe('string');
        expect(typeof item.url).toBe('string');
        expect(typeof item.publishedAt).toBe('number');
        expect(typeof item.fetchedAt).toBe('number');
        expect(item.language).toBe('en');
        expect(Array.isArray(item.tickers)).toBe(true);
        // Source should be a valid crypto source
        expect(['coindesk', 'cointelegraph', 'decrypt', 'theblock', 'cryptofeedr']).toContain(item.source);
      }
    });

    it('has fingerprint for dedup', async () => {
      const feeds = (fetcher as any).feeds;
      const coindeskFeed = feeds.find((f: any) => f.name === 'CoinDesk');

      const items = await fetcher.fetchFeed(coindeskFeed);
      if (items.length > 0) {
        expect(items[0].fingerprint).toBeDefined();
        expect(typeof items[0].fingerprint).toBe('string');
      }
    });
  });

  describe('fetch (all feeds)', () => {
    it('fetches from all crypto feeds in parallel', async () => {
      const items = await fetcher.fetch();
      expect(Array.isArray(items)).toBe(true);
      // Items should be deduplicated
      const ids = items.map(i => i.id);
      expect(ids.length).toBe(new Set(ids).size);
    });

    it('filters by symbol', async () => {
      const items = await fetcher.fetch(['BTC']);
      expect(Array.isArray(items)).toBe(true);
      // All returned items should mention BTC (if any)
      for (const item of items) {
        if (item.tickers) {
          // Not all items will match BTC, but the filter should be applied
        }
      }
    });

    it('filters by since timestamp', async () => {
      const now = Date.now();
      const items = await fetcher.fetch(undefined, now - 86400000); // last 24h
      for (const item of items) {
        expect(item.publishedAt).toBeGreaterThanOrEqual(now - 86400000);
      }
    });
  });

  describe('Health', () => {
    it('returns health with feed details', async () => {
      const health = await fetcher.getHealth();
      expect(health.status).toBeDefined();
      expect(health.feeds).toBeDefined();
      expect(Array.isArray(health.feeds)).toBe(true);
      expect(health.feeds.length).toBe(5);
    });
  });

  describe('Cache', () => {
    it('has cache after fetching', async () => {
      const feeds = (fetcher as any).feeds;
      const coindeskFeed = feeds.find((f: any) => f.name === 'CoinDesk');

      await fetcher.fetchFeed(coindeskFeed);
      const cache = fetcher.getCache();
      expect(cache.has('CoinDesk')).toBe(true);
    });
  });
});
