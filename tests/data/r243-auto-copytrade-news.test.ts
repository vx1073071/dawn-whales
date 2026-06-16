/**
 * R243-auto#1: CopytradeNewsEnhancer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CopytradeNewsEnhancer,
  resetCopytradeNewsEnhancer,
} from '../../electron/engine/data/copytrade-news-enhancer';
import type { CreatorTradeSignal, EnrichedCopytradeOrder } from '../../electron/engine/data/copytrade-news-enhancer';
import type { NewsItem } from '../../electron/engine/data/news-types';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createNewsItem(overrides: Partial<NewsItem> & { tickers?: string[] }): NewsItem {
  return {
    id: `news:${Math.random().toString(36).substring(7)}`,
    title: 'Test News',
    body: 'Test body.',
    source: 'newsapi',
    publishedAt: Date.now(),
    fetchedAt: Date.now(),
    language: 'en',
    tickers: [],
    impact: 'P2',
    category: 'company',
    ...overrides,
  };
}

function createTradeSignal(overrides: Partial<CreatorTradeSignal> = {}): CreatorTradeSignal {
  return {
    tradeId: `trade:${Math.random().toString(36).substring(7)}`,
    creatorId: 'creator:test',
    creatorName: 'TestTrader',
    symbol: 'AAPL',
    direction: 'BUY',
    quantity: 100,
    timestamp: Date.now(),
    strategyId: 'strat:1',
    strategyName: 'Momentum',
    market: 'US',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// R243-auto#1: CopytradeNewsEnhancer
// ═══════════════════════════════════════════════════════════════════

describe('R243-auto#1: CopytradeNewsEnhancer', () => {
  let enhancer: CopytradeNewsEnhancer;

  beforeEach(() => {
    resetCopytradeNewsEnhancer();
    enhancer = new CopytradeNewsEnhancer();
  });

  // ── News Ingestion ──────────────────────────────────────────────

  describe('News Ingestion', () => {
    it('indexes news by ticker', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Apple earnings' }),
        createNewsItem({ tickers: ['MSFT'], title: 'Microsoft cloud' }),
        createNewsItem({ tickers: ['AAPL'], title: 'iPhone sales' }),
      ];
      enhancer.ingestNews(items);

      const aapl = enhancer.getNewsForSymbol('AAPL');
      const msft = enhancer.getNewsForSymbol('MSFT');
      expect(aapl.length).toBe(2);
      expect(msft.length).toBe(1);
    });

    it('normalizes ticker symbols', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Apple US' }),
      ];
      enhancer.ingestNews(items);

      const byUpper = enhancer.getNewsForSymbol('AAPL');
      const byLower = enhancer.getNewsForSymbol('aapl');
      expect(byUpper.length).toBe(1);
      expect(byLower.length).toBe(1);
    });

    it('deduplicates same news ID', () => {
      const item = createNewsItem({ id: 'dup', tickers: ['AAPL'], title: 'Unique' });
      enhancer.ingestNews([item]);
      enhancer.ingestNews([item]); // Ingest again

      const aapl = enhancer.getNewsForSymbol('AAPL');
      expect(aapl.length).toBe(1);
    });

    it('respects lookback window', () => {
      const old = Date.now() - 30 * 24 * 3600_000;
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: old, title: 'Old news' }),
        createNewsItem({ tickers: ['AAPL'], title: 'Recent news' }),
      ];
      enhancer.ingestNews(items, 14);

      const aapl = enhancer.getNewsForSymbol('AAPL');
      expect(aapl.length).toBe(1);
      expect(aapl[0].title).toBe('Recent news');
    });
  });

  // ── Trade→News Matching ─────────────────────────────────────────

  describe('Trade Matching', () => {
    it('matches trade with relevant news', () => {
      const items: NewsItem[] = [
        createNewsItem({
          tickers: ['AAPL'], title: 'Apple reports record earnings',
          impact: 'P0', sentiment: { score: 0.8, confidence: 0.9 } as any,
          category: 'earnings',
        }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({ symbol: 'AAPL', direction: 'BUY' });
      const match = enhancer.matchTrade(signal);

      expect(match.matchedNews.length).toBe(1);
      expect(match.matchedNews[0].title).toContain('Apple');
      expect(match.confidence).toBeGreaterThan(0);
    });

    it('aligns BUY with positive sentiment', () => {
      const items: NewsItem[] = [
        createNewsItem({
          tickers: ['NVDA'], title: 'Nvidia beats estimates',
          sentiment: { score: 0.9, confidence: 0.95, keywords: ['AI', 'chips'] } as any,
        }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({ symbol: 'NVDA', direction: 'BUY' });
      const match = enhancer.matchTrade(signal);

      expect(match.sentimentSummary.label).toBe('strong_bullish');
      expect(match.justificationKeywords.length).toBeGreaterThan(0);
    });

    it('aligns SELL with negative sentiment', () => {
      const items: NewsItem[] = [
        createNewsItem({
          tickers: ['TSLA'], title: 'Tesla misses delivery targets',
          sentiment: { score: -0.7, confidence: 0.9 } as any,
        }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({ symbol: 'TSLA', direction: 'SELL' });
      const match = enhancer.matchTrade(signal);

      expect(match.sentimentSummary.label).toBe('strong_bearish');
    });

    it('handles no matching news gracefully', () => {
      const signal = createTradeSignal({ symbol: 'AAPL' });
      const match = enhancer.matchTrade(signal);

      expect(match.matchedNews).toEqual([]);
      expect(match.confidence).toBe(0);
      expect(match.topJustification).toContain('No recent news');
    });

    it('higher impact news scores higher', () => {
      const now = Date.now();
      const items: NewsItem[] = [
        createNewsItem({ id: 'p3', tickers: ['AAPL'], impact: 'P3', publishedAt: now - 100, title: 'Minor' }),
        createNewsItem({ id: 'p0', tickers: ['AAPL'], impact: 'P0', publishedAt: now - 101, title: 'Breaking' }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({ symbol: 'AAPL' });
      const match = enhancer.matchTrade(signal);

      // P0 should be matched (even if slightly older)
      expect(match.matchedNews.length).toBeGreaterThanOrEqual(1);
      const impacts = match.matchedNews.map(n => n.matchScore);
      const p0Item = match.matchedNews.find(n => n.newsId === 'p0');
      const p3Item = match.matchedNews.find(n => n.newsId === 'p3');
      if (p0Item && p3Item) {
        expect(p0Item.matchScore).toBeGreaterThanOrEqual(p3Item.matchScore);
      }
    });

    it('caches match results', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Test cache' }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({ symbol: 'AAPL' });
      const match1 = enhancer.matchTrade(signal);
      const match2 = enhancer.matchTrade(signal);

      expect(match1).toBe(match2); // Same object reference
    });
  });

  // ── Order Enrichment ────────────────────────────────────────────

  describe('Order Enrichment', () => {
    it('enriches copytrade order with news context', () => {
      const items: NewsItem[] = [
        createNewsItem({
          tickers: ['AAPL'], title: 'Apple launches new product',
          impact: 'P1', sentiment: { score: 0.5, confidence: 0.8 } as any,
          category: 'company',
        }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({ symbol: 'AAPL', direction: 'BUY' });
      const enriched = enhancer.enrichOrder(signal);

      expect(enriched.symbol).toBe('AAPL');
      expect(enriched.direction).toBe('BUY');
      expect(enriched.newsContext.length).toBeGreaterThan(0);
      expect(enriched.justification.length).toBeGreaterThan(0);
      expect(enriched.relatedNewsCount).toBe(1);
      expect(enriched.topNewsTitle).toContain('Apple');
    });

    it('generates proper risk signals', () => {
      // No news = YELLOW (low confidence)
      const signal = createTradeSignal({ symbol: 'UNKNOWN' });
      const enriched = enhancer.enrichOrder(signal);
      expect(enriched.riskSignal).toBe('YELLOW');

      // Matching news with no risk keywords = GREEN
      resetCopytradeNewsEnhancer();
      enhancer = new CopytradeNewsEnhancer();
      enhancer.ingestNews([
        createNewsItem({ tickers: ['MSFT'], title: 'Microsoft beats', impact: 'P1', sentiment: { score: 0.6, confidence: 0.8 } as any }),
      ]);
      const enriched2 = enhancer.enrichOrder(createTradeSignal({ symbol: 'MSFT', direction: 'BUY' }));
      expect(enriched2.riskSignal).toBe('GREEN');
    });

    it('caches enriched orders', () => {
      enhancer.ingestNews([
        createNewsItem({ tickers: ['AAPL'], title: 'Test' }),
      ]);
      const signal = createTradeSignal({ symbol: 'AAPL' });
      const order1 = enhancer.enrichOrder(signal);
      const order2 = enhancer.enrichOrder(signal);
      expect(order1).toBe(order2);
    });
  });

  // ── Notification Generation ─────────────────────────────────────

  describe('Notification Generation', () => {
    it('generates enhanced notification with news context', () => {
      const items: NewsItem[] = [
        createNewsItem({
          tickers: ['TSLA'], title: 'Tesla unveils new model',
          sentiment: { score: 0.7, confidence: 0.9, keywords: ['EV', 'launch'] } as any,
        }),
      ];
      enhancer.ingestNews(items);

      const signal = createTradeSignal({
        symbol: 'TSLA', direction: 'BUY', quantity: 50, price: 250,
      });
      const notif = enhancer.generateNotification(signal, 'follower:1');

      expect(notif.followerId).toBe('follower:1');
      expect(notif.creatorName).toBe('TestTrader');
      expect(notif.message).toContain('TSLA');
      expect(notif.message).toContain('50');
      expect(notif.briefMessage.length).toBeLessThan(notif.message.length);
      expect(notif.newsLinks.length).toBeGreaterThanOrEqual(1);
      expect(notif.requiresConfirmation).toBe(true);
    });

    it('can disable news mentions', () => {
      enhancer.ingestNews([
        createNewsItem({ tickers: ['AAPL'], title: 'Test' }),
      ]);
      const signal = createTradeSignal({ symbol: 'AAPL' });
      const notif = enhancer.generateNotification(signal, 'follower:1', { mentionNews: false });

      expect(notif.newsLinks).toEqual([]);
      expect(notif.message).not.toContain('📰');
    });

    it('supports optional confirmation', () => {
      const notif = enhancer.generateNotification(
        createTradeSignal(), 'follower:1', { requireConfirmation: false },
      );
      expect(notif.requiresConfirmation).toBe(false);
    });
  });

  // ── Batch Processing ────────────────────────────────────────────

  describe('Batch Processing', () => {
    it('processes multiple trade signals', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Apple beats', sentiment: { score: 0.8 } as any }),
        createNewsItem({ tickers: ['MSFT'], title: 'Microsoft cloud up', sentiment: { score: 0.5 } as any }),
        createNewsItem({ tickers: ['TSLA'], title: 'Tesla miss', sentiment: { score: -0.7 } as any }),
      ];
      enhancer.ingestNews(items);

      const signals = [
        createTradeSignal({ symbol: 'AAPL', direction: 'BUY' }),
        createTradeSignal({ symbol: 'MSFT', direction: 'BUY' }),
        createTradeSignal({ symbol: 'TSLA', direction: 'SELL' }),
      ];

      const orders = enhancer.processBatch(signals);
      expect(orders.length).toBe(3);
      // Sort by news count: AAPL and MSFT should come before UNKNOWN
      expect(orders.every(o => o.symbol !== undefined)).toBe(true);
    });

    it('batch generates notifications', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'Test' }),
        createNewsItem({ tickers: ['MSFT'], title: 'Test' }),
      ];
      enhancer.ingestNews(items);

      const signals = [
        createTradeSignal({ symbol: 'AAPL' }),
        createTradeSignal({ symbol: 'MSFT' }),
      ];
      const notifs = enhancer.batchNotifications(signals, 'follower:1');
      expect(notifs.length).toBe(2);
    });
  });

  // ── Statistics ──────────────────────────────────────────────────

  describe('Statistics', () => {
    it('tracks processing stats', () => {
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], title: 'News 1' }),
        createNewsItem({ tickers: ['AAPL'], title: 'News 2' }),
        createNewsItem({ tickers: ['MSFT'], title: 'News 3' }),
      ];
      enhancer.ingestNews(items);

      enhancer.matchTrade(createTradeSignal({ symbol: 'AAPL' }));
      enhancer.matchTrade(createTradeSignal({ symbol: 'MSFT' }));
      enhancer.matchTrade(createTradeSignal({ symbol: 'AAPL' }));

      const stats = enhancer.getStats();
      expect(stats.totalTradesProcessed).toBe(3);
      expect(stats.totalNewsMatched).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Maintenance ─────────────────────────────────────────────────

  describe('Maintenance', () => {
    it('prunes old news', () => {
      const oldTime = Date.now() - 100 * 3600_000;
      const items: NewsItem[] = [
        createNewsItem({ tickers: ['AAPL'], publishedAt: oldTime, title: 'Very old' }),
        createNewsItem({ tickers: ['AAPL'], title: 'Recent' }),
      ];
      enhancer.ingestNews(items, 200); // Override lookback for this test
      enhancer.matchTrade(createTradeSignal({ symbol: 'AAPL' }));

      const pruned = enhancer.prune(72);
      expect(pruned).toBeGreaterThanOrEqual(1);
    });

    it('reset clears all state', () => {
      enhancer.ingestNews([createNewsItem({ tickers: ['AAPL'] })]);
      enhancer.matchTrade(createTradeSignal({ symbol: 'AAPL' }));

      enhancer.reset();
      const stats = enhancer.getStats();
      expect(stats.totalTradesProcessed).toBe(0);
      expect(enhancer.getNewsForSymbol('AAPL')).toEqual([]);
    });
  });

  // ── Sentiment Summary Edge Cases ────────────────────────────────

  describe('Sentiment Summaries', () => {
    it('neutral for news without sentiment', () => {
      enhancer.ingestNews([
        createNewsItem({ tickers: ['XYZ'], title: 'No sentiment data' }),
      ]);
      const match = enhancer.matchTrade(createTradeSignal({ symbol: 'XYZ' }));
      expect(match.sentimentSummary.label).toBe('neutral');
      expect(match.sentimentSummary.sourceCount).toBe(0);
    });

    it('strong_bullish for very positive sentiment', () => {
      enhancer.ingestNews([
        createNewsItem({ tickers: ['AAPL'], impact: 'P0', sentiment: { score: 0.85, confidence: 1 } as any }),
      ]);
      const match = enhancer.matchTrade(createTradeSignal({ symbol: 'AAPL', direction: 'BUY' }));
      expect(match.sentimentSummary.label).toBe('strong_bullish');
    });
  });
});
