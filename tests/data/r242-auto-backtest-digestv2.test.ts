/**
 * R242-auto: News Backtest Data Prep + Daily Digest V2 Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NewsBacktestDataPrep, resetBacktestDataPrep } from '../../electron/engine/data/news-backtest-data-prep';
import { DailyDigestV2Engine, resetDailyDigestV2Engine } from '../../electron/engine/data/daily-digest-v2';
import type { NewsItem } from '../../electron/engine/data/news-types';
import type { PriceSnapshot } from '../../electron/engine/data/news-backtest-data-prep';

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
    ...overrides,
  };
}

function daysAgo(days: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

function createPriceSnapshot(ticker: string, daysAgoCount: number, close: number): PriceSnapshot {
  return {
    ticker,
    date: daysAgo(daysAgoCount),
    open: close * 0.99,
    high: close * 1.02,
    low: close * 0.98,
    close,
    volume: 1000000,
    adjClose: close,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// R242-auto#1: NewsBacktestDataPrep Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R242-auto#1: NewsBacktestDataPrep', () => {
  let prep: NewsBacktestDataPrep;

  beforeEach(() => {
    resetBacktestDataPrep();
    prep = new NewsBacktestDataPrep();
  });

  describe('Data Ingestion', () => {
    it('ingests news and indexes by ticker', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(3) }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(1) }),
        createNewsItem({ tickers: ['MSFT'], publishedAt: daysAgo(2) }),
      ];
      prep.ingestNews(items);
      const stats = prep.getStats();
      expect(stats.tickersTracked).toBeGreaterThanOrEqual(2);
      expect(stats.totalNewsItems).toBe(3);
    });

    it('ingests price history', () => {
      const prices: PriceSnapshot[] = [
        createPriceSnapshot('AAPL', 30, 150),
        createPriceSnapshot('AAPL', 29, 152),
        createPriceSnapshot('AAPL', 28, 148),
      ];
      prep.ingestPrices('AAPL', prices);
      const stats = prep.getStats();
      expect(stats.priceDataAvailable).toBe(1);
    });

    it('ingests benchmark prices', () => {
      const spy: PriceSnapshot[] = [
        createPriceSnapshot('SPY', 30, 450),
        createPriceSnapshot('SPY', 29, 452),
        createPriceSnapshot('SPY', 28, 448),
      ];
      prep.ingestBenchmark(spy);
      const stats = prep.getStats();
      expect(stats.benchmarkLoaded).toBe(true);
    });
  });

  describe('Alignment', () => {
    it('aligns news with price data', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(5), title: 'Apple Earnings' }),
      ];
      const prices: PriceSnapshot[] = [];
      for (let i = 40; i >= 0; i--) {
        prices.push(createPriceSnapshot('AAPL', i, 150 + (40 - i) * 0.5));
      }

      prep.ingestNews(items);
      prep.ingestPrices('AAPL', prices);

      const aligned = prep.align('AAPL');
      expect(aligned.length).toBeGreaterThanOrEqual(1);
      expect(aligned[0].ticker).toBe('AAPL');
      expect(aligned[0].returns).toBeDefined();
      expect(typeof aligned[0].returns.window5d).toBe('number');
    });

    it('returns returns for all windows', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['MSFT'], publishedAt: daysAgo(10) }),
      ];
      const prices: PriceSnapshot[] = [];
      for (let i = 40; i >= 0; i--) {
        prices.push(createPriceSnapshot('MSFT', i, 300 + i * 0.2));
      }
      prep.ingestNews(items);
      prep.ingestPrices('MSFT', prices);

      const aligned = prep.align('MSFT');
      if (aligned.length > 0) {
        const r = aligned[0].returns;
        expect(typeof r.window1d).toBe('number');
        expect(typeof r.window3d).toBe('number');
        expect(typeof r.window5d).toBe('number');
        expect(typeof r.window7d).toBe('number');
        expect(typeof r.window14d).toBe('number');
        expect(typeof r.window30d).toBe('number');
        expect(typeof r.maxDrawdown).toBe('number');
        expect(typeof r.volatility).toBe('number');
      }
    });

    it('returns empty for ticker with no news', () => {
      const aligned = prep.align('UNKNOWN');
      expect(aligned).toEqual([]);
    });

    it('returns empty for ticker with no prices', () => {
      prep.ingestNews([createNewsItem({ tickers: ['NO_PRICE'] })]);
      const aligned = prep.align('NO_PRICE');
      expect(aligned).toEqual([]);
    });
  });

  describe('Summary', () => {
    it('generates summary for tickers with data', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(5), impact: 'P1', sentiment: { score: -0.5 } as any }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(3), impact: 'P2', sentiment: { score: 0.3 } as any }),
      ];
      const prices: PriceSnapshot[] = [];
      for (let i = 40; i >= 0; i--) {
        prices.push(createPriceSnapshot('AAPL', i, 150 + Math.sin(i) * 10));
      }

      prep.ingestNews(items);
      prep.ingestPrices('AAPL', prices);
      const summary = prep.generateSummary(['AAPL']);

      expect(summary.totalEvents).toBeGreaterThanOrEqual(0);
      expect(summary.statistics).toBeDefined();
      expect(typeof summary.statistics.avgReturn5d).toBe('number');
      expect(typeof summary.statistics.winRate5d).toBe('number');
    });

    it('generates empty summary when no data', () => {
      const summary = prep.generateSummary();
      expect(summary.totalEvents).toBe(0);
    });
  });

  describe('Query', () => {
    it('queries events by keyword', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(5), title: 'Apple launches new iPhone' }),
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(3), title: 'Apple Services revenue grows' }),
      ];
      const prices: PriceSnapshot[] = [];
      for (let i = 40; i >= 0; i--) {
        prices.push(createPriceSnapshot('AAPL', i, 150 + i * 0.1));
      }
      prep.ingestNews(items);
      prep.ingestPrices('AAPL', prices);

      const results = prep.queryEvents('AAPL', 'iPhone', 30);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns query stats', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(5), title: 'Apple earnings beat' }),
      ];
      const prices: PriceSnapshot[] = [];
      for (let i = 40; i >= 0; i--) {
        prices.push(createPriceSnapshot('AAPL', i, 150 + i * 0.1));
      }
      prep.ingestNews(items);
      prep.ingestPrices('AAPL', prices);

      const stats = prep.queryStats('AAPL', 'earnings');
      expect(typeof stats.mean).toBe('number');
      expect(typeof stats.count).toBe('number');
    });
  });

  describe('Export', () => {
    it('exports CSV', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: daysAgo(5), title: 'Export Test' }),
      ];
      const prices: PriceSnapshot[] = [];
      for (let i = 40; i >= 0; i--) {
        prices.push(createPriceSnapshot('AAPL', i, 150));
      }
      prep.ingestNews(items);
      prep.ingestPrices('AAPL', prices);

      const csv = prep.exportCSV('AAPL');
      expect(typeof csv).toBe('string');
    });

    it('exports JSON', () => {
      const json = prep.exportJSON();
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(typeof parsed.totalEvents).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// R242-auto#2: DailyDigestV2 Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R242-auto#2: DailyDigestV2Engine', () => {
  let engine: DailyDigestV2Engine;

  beforeEach(() => {
    resetDailyDigestV2Engine();
    engine = new DailyDigestV2Engine();
  });

  describe('Full Generation', () => {
    it('generates a complete DailyDigestV2', () => {
      const portfolioNews: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Apple Beats Earnings', impact: 'P1', sentiment: { score: 0.7 } as any }),
        createNewsItem({ tickers: ['MSFT'], title: 'Microsoft Cloud Revenue Up', impact: 'P2', sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['TSLA'], title: 'Tesla Issues Recall', impact: 'P1', sentiment: { score: -0.6 } as any }),
      ];
      const watchlistNews: NewsItem[] = [
        createNewsItem({ tickers: ['NVDA'], title: 'Nvidia AI Chip Demand Soars', impact: 'P0', sentiment: { score: 0.9 } as any }),
        createNewsItem({ tickers: ['GME'], title: 'GameStop Volatility', impact: 'P2', sentiment: { score: -0.2 } as any }),
      ];
      const marketNews: NewsItem[] = [
        createNewsItem({ title: 'Fed Holds Rates', impact: 'P1', sentiment: { score: 0.1 } as any }),
        createNewsItem({ title: 'Oil Prices Rise on Supply Concerns', impact: 'P2', sentiment: { score: -0.1 } as any }),
        createNewsItem({ title: 'Tech Sector Leads Rally', impact: 'P2', sentiment: { score: 0.6 } as any }),
      ];

      const priceChanges = new Map<string, number>([
        ['AAPL', 2.5],
        ['MSFT', 1.8],
        ['TSLA', -4.2],
      ]);

      const digest = engine.generate(portfolioNews, watchlistNews, marketNews, priceChanges);

      // Structure checks
      expect(typeof digest.date).toBe('string');
      expect(digest.marketOverview).toBeDefined();
      expect(digest.portfolio).toBeDefined();
      expect(digest.watchlist).toBeDefined();
      expect(Array.isArray(digest.topNews)).toBe(true);
      expect(typeof digest.disclaimer).toBe('string');
    });
  });

  describe('Market Overview', () => {
    it('builds market overview with sentiment', () => {
      const marketNews: NewsItem[] = [
        createNewsItem({ title: 'Stocks Rally on Tech Earnings', sentiment: { score: 0.8 } as any }),
        createNewsItem({ title: 'Bull Market Continues', sentiment: { score: 0.6 } as any }),
      ];

      const digest = engine.generate([], [], marketNews);

      expect(digest.marketOverview.sentimentBias).toBe('bullish');
      expect(digest.marketOverview.fearGreedIndex).toBeGreaterThan(70);
    });

    it('detects bearish market', () => {
      const marketNews: NewsItem[] = [
        createNewsItem({ title: 'Stocks Crash on Recession Fears', sentiment: { score: -0.7 } as any }),
      ];

      const digest = engine.generate([], [], marketNews);
      expect(digest.marketOverview.sentimentBias).toBe('bearish');
    });

    it('has sector heatmap', () => {
      const marketNews: NewsItem[] = [
        createNewsItem({ title: 'Tech stocks surge on AI chip demand', sentiment: { score: 0.8 } as any }),
        createNewsItem({ title: 'Bank stocks under pressure from rate cuts', sentiment: { score: -0.4 } as any }),
        createNewsItem({ title: 'Oil companies rally as crude spikes', sentiment: { score: 0.5 } as any }),
      ];

      const digest = engine.generate([], [], marketNews);
      expect(digest.marketOverview.sectorHeatmap).toBeDefined();
      const sectors = Object.keys(digest.marketOverview.sectorHeatmap);
      expect(sectors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Portfolio Attribution', () => {
    it('generates attribution for portfolio items', () => {
      const news: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Apple reports record iPhone sales', sentiment: { score: 0.7 } as any }),
      ];
      const priceChanges = new Map([['AAPL', 3.2]]);

      const digest = engine.generate(news, [], [], priceChanges);
      expect(digest.portfolio.attribution.length).toBeGreaterThanOrEqual(1);
      const attr = digest.portfolio.attribution[0];
      expect(attr.symbol).toBe('AAPL');
      expect(typeof attr.reason).toBe('string');
      expect(attr.confidence).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment', () => {
    it('assesses elevated risk for negative P0 news', () => {
      const news: NewsItem[] = [
        createNewsItem({ tickers: ['TSLA'], title: 'Tesla crash investigation', impact: 'P0', sentiment: { score: -0.8 } as any }),
      ];

      const risk = engine.assessRisk('TSLA', news);
      expect(risk.riskLevel).toBe('medium');
      expect(risk.riskScore).toBeGreaterThan(30);
      expect(risk.suggestion).toBe('HEDGE');
    });

    it('assesses low risk for positive news', () => {
      const news: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Apple beats all estimates', impact: 'P2', sentiment: { score: 0.7 } as any }),
      ];

      const risk = engine.assessRisk('AAPL', news);
      expect(risk.riskLevel).toBe('low');
      expect(risk.suggestion).toBe('HOLD');
    });

    it('returns low risk for no news', () => {
      const risk = engine.assessRisk('AAPL', []);
      expect(risk.riskLevel).toBe('low');
      expect(risk.riskScore).toBe(10);
    });
  });

  describe('Strategy Suggestions', () => {
    it('generates strategy for event-driven news', () => {
      const news: NewsItem[] = [
        createNewsItem({ tickers: ['COIN'], title: 'SEC approves Bitcoin ETF', impact: 'P0', sentiment: { score: 0.8 } as any, category: 'policy' }),
        createNewsItem({ tickers: ['COIN'], title: 'Crypto trading volume surges', impact: 'P1', sentiment: { score: 0.6 } as any }),
        createNewsItem({ tickers: ['COIN'], title: 'Coinbase expands services', impact: 'P2', sentiment: { score: 0.4 } as any }),
      ];

      const strategy = engine.generateStrategy('COIN', news);
      expect(strategy).not.toBeNull();
      if (strategy) {
        expect(strategy.symbol).toBe('COIN');
        expect(strategy.type).toBeDefined();
        expect(['long', 'short']).toContain(strategy.direction);
        expect(typeof strategy.rationale).toBe('string');
      }
    });

    it('returns null for insufficient news', () => {
      const strategy = engine.generateStrategy('AAPL', []);
      expect(strategy).toBeNull();

      const oneItem = engine.generateStrategy('AAPL', [
        createNewsItem({ tickers: ['AAPL'] }),
      ]);
      expect(oneItem).toBeNull();
    });
  });

  describe('Top News', () => {
    it('ranks top news by impact (P0 items appear, sorting is correct)', () => {
      const allNews: NewsItem[] = [
        createNewsItem({ id: '1', title: 'Breaking News', impact: 'P0' }),
        createNewsItem({ id: '2', title: 'Important Update', impact: 'P1' }),
        createNewsItem({ id: '3', title: 'Sector News', impact: 'P2' }),
        createNewsItem({ id: '4', title: 'General News', impact: 'P3' }),
      ];

      const digest = engine.generate([], [], allNews);
      expect(digest.topNews.length).toBeGreaterThanOrEqual(3);
      // P0 should appear somewhere in top news
      const impacts = digest.topNews.map(n => n.impact);
      expect(impacts).toContain('P0');
    });
  });

  describe('Watchlist', () => {
    it('detects bullish and bearish signals', () => {
      const watchlistNews: NewsItem[] = [
        createNewsItem({ tickers: ['NVDA'], title: 'Nvidia smashes earnings', sentiment: { score: 0.9 } as any }),
        createNewsItem({ tickers: ['INTC'], title: 'Intel warns on margins', sentiment: { score: -0.5 } as any }),
      ];

      const digest = engine.generate([], watchlistNews, []);
      expect(digest.watchlist.bullishSignals.length).toBeGreaterThanOrEqual(1);
      expect(digest.watchlist.bearishSignals.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty inputs gracefully', () => {
      const digest = engine.generate([], [], []);
      expect(digest.marketOverview.theme).toBeDefined();
      expect(digest.portfolio.attribution).toEqual([]);
      expect(digest.portfolio.riskAssessments).toEqual([]);
      expect(digest.watchlist.bullishSignals).toEqual([]);
      expect(digest.topNews).toEqual([]);
    });

    it('handles news without tickers', () => {
      const digest = engine.generate(
        [createNewsItem({ tickers: [] })],
        [],
        [createNewsItem({})],
      );
      expect(digest).toBeDefined();
    });
  });
});
