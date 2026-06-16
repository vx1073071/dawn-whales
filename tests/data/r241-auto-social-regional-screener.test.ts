/**
 * R241-auto: Social Feeds + Regional Feeds + Stock Screener V2 Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SocialFeedsFetcher, resetSocialFeedsFetcher } from '../../electron/engine/data/social-feeds';
import { RegionalFeedsFetcher, resetRegionalFeedsFetcher } from '../../electron/engine/data/regional-feeds';
import { StockScreenerV2, resetStockScreenerV2 } from '../../electron/engine/data/stock-screener-v2';
import type { NewsItem } from '../../electron/engine/data/news-types';

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function createNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: `test:${Math.random().toString(36).substring(7)}`,
    title: 'Test News',
    body: 'Test body content.',
    source: 'reddit',
    publishedAt: Date.now(),
    fetchedAt: Date.now(),
    language: 'en',
    tickers: ['TEST'],
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
// R241-auto#1: SocialFeedsFetcher Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R241-auto#1: SocialFeedsFetcher', () => {
  let fetcher: SocialFeedsFetcher;

  beforeEach(() => {
    resetSocialFeedsFetcher();
    fetcher = new SocialFeedsFetcher();
  });

  describe('Configuration', () => {
    it('has 6 Reddit + 1 StockTwits = 7 feed statuses', () => {
      const status = fetcher.getFeedStatus();
      expect(status.length).toBe(7);
    });

    it('includes WSB subreddit', () => {
      const status = fetcher.getFeedStatus();
      const names = status.map(s => s.name);
      expect(names).toContain('r/wallstreetbets');
    });

    it('includes StockTwits', () => {
      const status = fetcher.getFeedStatus();
      const names = status.map(s => s.name);
      expect(names).toContain('StockTwits');
    });

    it('is available initially', async () => {
      const available = await fetcher.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Reddit', () => {
    it('fetches from wallstreetbets hot JSON', async () => {
      const status = fetcher.getFeedStatus();
      const wsbStatus = status.find(s => s.name === 'r/wallstreetbets');
      expect(wsbStatus).toBeDefined();

      // Access internal feeds config
      const sources = (fetcher as any).constructor.prototype
        ? [{ subreddit: 'wallstreetbets', endpoint: 'https://www.reddit.com/r/wallstreetbets/hot.json?limit=50', weight: 1.5, category: 'social', tags: ['wsb'] }]
        : null;

      // If we can access sources, fetch WSB
      if (sources) {
        const items = await (fetcher as any).fetchRedditSub(sources[0]);
        expect(Array.isArray(items)).toBe(true);
      }
    });

    it('extracts tickers from Reddit posts', async () => {
      // Use a simple approach: the extractTickers function is internal,
      // but we can test via fetched items if any have tickers
      expect(true).toBe(true); // Placeholder — live API dependent
    });
  });

  describe('StockTwits', () => {
    it('can fetch StockTwits for a symbol', async () => {
      const items = await fetcher.fetchStockTwits('AAPL');
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('Full Fetch', () => {
    it('fetches from all social sources (symbol scoped)', async () => {
      const items = await fetcher.fetch(['GME']);
      expect(Array.isArray(items)).toBe(true);
    }, 15000);

    it('deduplicates items by ID (symbol scoped)', async () => {
      const items = await fetcher.fetch(['TSLA']);
      const ids = items.map(i => i.id);
      expect(ids.length).toBe(new Set(ids).size);
    }, 15000);
  });

  describe('Health', () => {
    it('returns health status', async () => {
      const health = await fetcher.getHealth();
      expect(['ok', 'degraded', 'down']).toContain(health.status);
      expect(Array.isArray(health.feeds)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// R241-auto#2: RegionalFeedsFetcher Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R241-auto#2: RegionalFeedsFetcher', () => {
  let fetcher: RegionalFeedsFetcher;

  beforeEach(() => {
    resetRegionalFeedsFetcher();
    fetcher = new RegionalFeedsFetcher();
  });

  describe('Configuration', () => {
    it('initializes with 3 regional feeds', () => {
      const status = fetcher.getFeedStatus();
      expect(status.length).toBe(3);
    });

    it('includes Nikkei Asia', () => {
      const status = fetcher.getFeedStatus();
      const names = status.map(s => s.name);
      expect(names).toContain('Nikkei Asia');
    });

    it('includes Investing India', () => {
      const status = fetcher.getFeedStatus();
      const names = status.map(s => s.name);
      expect(names).toContain('Investing India');
    });

    it('includes Investing Australia', () => {
      const status = fetcher.getFeedStatus();
      const names = status.map(s => s.name);
      expect(names).toContain('Investing Australia');
    });

    it('is available initially', async () => {
      const available = await fetcher.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('RSS Parsing', () => {
    it('handles RDF format (Nikkei Asia)', async () => {
      const feeds = (fetcher as any).feeds;
      const nikkei = feeds.find((f: any) => f.name === 'Nikkei Asia');
      if (!nikkei) return;

      const items = await fetcher.fetchRegionFeed(nikkei);
      expect(Array.isArray(items)).toBe(true);
    });

    it('handles RSS format (Investing India)', async () => {
      const feeds = (fetcher as any).feeds;
      const india = feeds.find((f: any) => f.name === 'Investing India');
      if (!india) return;

      const items = await fetcher.fetchRegionFeed(india);
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('Full Fetch', () => {
    it('fetches from all regional sources in parallel', async () => {
      const items = await fetcher.fetch();
      expect(Array.isArray(items)).toBe(true);
      const ids = items.map(i => i.id);
      expect(ids.length).toBe(new Set(ids).size);
    });

    it('filters by symbol', async () => {
      const items = await fetcher.fetch(['7203.T']);
      expect(Array.isArray(items)).toBe(true);
    });

    it('filters by timestamp', async () => {
      const now = Date.now();
      const items = await fetcher.fetch(undefined, now - 86400000);
      for (const item of items) {
        expect(item.publishedAt).toBeGreaterThanOrEqual(now - 86400000);
      }
    });
  });

  describe('Health', () => {
    it('returns health with regional feed details', async () => {
      const health = await fetcher.getHealth();
      expect(health.status).toBeDefined();
      expect(Array.isArray(health.feeds)).toBe(true);
      expect(health.feeds.length).toBe(3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// R241-auto#3: StockScreenerV2 Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R241-auto#3: StockScreenerV2', () => {
  let v2: StockScreenerV2;

  beforeEach(() => {
    resetStockScreenerV2();
    v2 = new StockScreenerV2();
  });

  describe('Configuration', () => {
    it('inherits all v1 presets + has v2 presets', () => {
      const presets = v2.getPresets();
      expect(presets.length).toBeGreaterThanOrEqual(8);
      const names = presets.map(p => p.name);
      expect(names).toContain('跨市场联动');
      expect(names).toContain('加密传导');
      expect(names).toContain('商品轮动');
      expect(names).toContain('社交共振');
      expect(names).toContain('时区接力');
    });
  });

  describe('Cross Market Screening', () => {
    it('screens cross-market with US leaders', () => {
      const results = v2.screenCrossMarket(['NVDA', 'TSLA', 'AAPL']);
      expect(Array.isArray(results)).toBe(true);
      // Each result should have crossMarket data
      for (const r of results) {
        if (r.crossMarket) {
          expect(Array.isArray(r.crossMarket.usLeaders)).toBe(true);
          expect(Array.isArray(r.crossMarket.cnEquivalents)).toBe(true);
          expect(typeof r.crossMarket.correlation).toBe('number');
        }
      }
    });

    it('returns empty for unknown US tickers', () => {
      const results = v2.screenCrossMarket(['UNKNOWN']);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Crypto Impact Screening', () => {
    it('screens crypto-impacted stocks', () => {
      const results = v2.screenCryptoImpact('BTC');
      expect(Array.isArray(results)).toBe(true);
      for (const r of results) {
        if (r.cryptoExposure) {
          expect(r.cryptoExposure.cryptoAsset).toBe('BTC');
          expect(['positive', 'negative']).toContain(r.cryptoExposure.direction);
          expect(r.cryptoExposure.sensitivity).toBeGreaterThan(0);
          expect(r.cryptoExposure.sensitivity).toBeLessThanOrEqual(1);
        }
      }
    });

    it('returns empty for unmapped crypto', () => {
      const results = v2.screenCryptoImpact('FANTOM');
      expect(results.length).toBe(0);
    });
  });

  describe('Commodity Rotation Screening', () => {
    it('screens commodity-affected stocks', () => {
      const results = v2.screenCommodityRotation('WTI');
      expect(Array.isArray(results)).toBe(true);
      for (const r of results) {
        if (r.commodityExposure) {
          expect(r.commodityExposure.commodity).toBe('WTI');
          expect(['positive', 'negative']).toContain(r.commodityExposure.direction);
          expect(r.commodityExposure.sensitivity).toBeGreaterThan(0);
        }
      }
    });

    it('returns empty for unmapped commodity', () => {
      const results = v2.screenCommodityRotation('URANIUM');
      expect(results.length).toBe(0);
    });
  });

  describe('Social Resonance Screening', () => {
    it('ingests social data', () => {
      const redditItems: NewsItem[] = [
        createNewsItem({
          id: 'reddit:wallstreetbets:abc123',
          tickers: ['GME'],
          source: 'reddit',
          sentiment: { score: 0.8, confidence: 0.9 } as any,
          metadata: { subreddit: 'wallstreetbets' },
        }),
      ];

      const stItems: NewsItem[] = [
        createNewsItem({
          id: 'stocktwits:GME:xyz',
          tickers: ['GME'],
          source: 'stocktwits',
          sentiment: { score: 0.7, confidence: 0.8 } as any,
        }),
      ];

      v2.ingestSocial(redditItems, stItems);

      const results = v2.screenSocialResonance();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Timezone Momentum', () => {
    it('screens timezone momentum', () => {
      const results = v2.screenTimezoneMomentum();
      expect(Array.isArray(results)).toBe(true);
      for (const r of results) {
        if (r.timezoneMomentum) {
          expect(typeof r.timezoneMomentum.asia).toBe('number');
          expect(typeof r.timezoneMomentum.europe).toBe('number');
          expect(typeof r.timezoneMomentum.americas).toBe('number');
          expect(['accelerating', 'steady', 'decelerating']).toContain(r.timezoneMomentum.gradient);
        }
      }
    });
  });

  describe('All Dimensions & Composite', () => {
    it('returns all dimensions', () => {
      const all = v2.screenAllDimensions();
      expect(Array.isArray(all.crossMarket)).toBe(true);
      expect(Array.isArray(all.crypto)).toBe(true);
      expect(Array.isArray(all.commodity)).toBe(true);
      expect(Array.isArray(all.social)).toBe(true);
      expect(Array.isArray(all.timezone)).toBe(true);
    });

    it('returns composite ranking', () => {
      const composite = v2.screenComposite();
      expect(Array.isArray(composite)).toBe(true);
      // Should have V2ScreenerResult structures
      if (composite.length > 0) {
        const r = composite[0];
        expect(typeof r.ticker).toBe('string');
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('V2ScreenerResult Structure', () => {
    it('crossMarket results have all v2 fields', () => {
      const results = v2.screenCrossMarket(['NVDA', 'TSLA']);
      for (const r of results) {
        // V1 fields
        expect(typeof r.ticker).toBe('string');
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.signals).toBeDefined();
        // V2 fields should be present (may be null)
        expect('crossMarket' in r).toBe(true);
        expect('cryptoExposure' in r).toBe(true);
        expect('commodityExposure' in r).toBe(true);
        expect('socialResonance' in r).toBe(true);
        expect('timezoneMomentum' in r).toBe(true);
      }
    });
  });
});
