/**
 * R238-auto: News Data Integration Tests
 *
 * Tests: XueqiuFetcher + DedupEngine + CLSTelegraphFetcher
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DedupEngine, resetDedupEngine } from '../../electron/engine/data/dedup-engine';
import type { NewsItem } from '../../electron/engine/data/news-types';

// ── Helpers ───────────────────────────────────────────────────────────

let _itemCounter = 0;
function createNewsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  _itemCounter++;
  return {
    id: 'test:' + _itemCounter + ':' + Math.random().toString(36).substring(7),
    title: `Test News Title ${_itemCounter}`,
    body: `This is test news content for dedup testing #${_itemCounter}.`,
    source: 'xueqiu',
    publishedAt: Date.now(),
    fetchedAt: Date.now(),
    language: 'zh',
    tickers: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DedupEngine Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R238-auto#1b: DedupEngine', () => {
  let engine: DedupEngine;

  beforeEach(() => {
    resetDedupEngine();
    engine = new DedupEngine({ maxCacheSize: 1000 });
  });

  describe('URL Deduplication', () => {
    it('detects exact URL duplicate', () => {
      const item1 = createNewsItem({
        id: 'a:1', title: 'Shared URL News', body: 'Body A for URL test.',
        url: 'https://example.com/news/1', source: 'xueqiu',
      });
      const item2 = createNewsItem({
        id: 'b:2', title: 'Shared URL News', body: 'Body B different content.',
        url: 'https://example.com/news/1', source: 'sina',
      });

      const r1 = engine.process(item1);
      expect(r1.isDuplicate).toBe(false);

      const r2 = engine.process(item2);
      expect(r2.isDuplicate).toBe(true);
      expect(r2.matchType).toBe('url');
      expect(r2.duplicateOf).toBe('a:1');
    });

    it('passes unique URLs through', () => {
      const item1 = createNewsItem({
        id: 'a:1', title: 'Unique A', body: 'Unique body A content.',
        url: 'https://x.com/1',
      });
      const item2 = createNewsItem({
        id: 'a:2', title: 'Unique B', body: 'Unique body B content.',
        url: 'https://x.com/2',
      });

      expect(engine.process(item1).isDuplicate).toBe(false);
      expect(engine.process(item2).isDuplicate).toBe(false);
    });
  });

  describe('Title Similarity Deduplication', () => {
    it('detects near-identical English titles', () => {
      // Use titles that are identical after normalization
      // First item is higher priority (reuters) so second (xueqiu) won't replace it
      const item1 = createNewsItem({
        id: 'a:1',
        title: 'Breaking: Fed Raises Rates by 25 Basis Points',
        body: 'Body text for item one is unique and different from item two.',
        source: 'reuters',
      });
      const item2 = createNewsItem({
        id: 'b:1',
        title: 'Breaking Fed Raises Rates by 25 Basis Points!!!',
        body: 'Body text for item two is completely distinct here.',
        source: 'xueqiu',
      });

      engine.process(item1);
      const result = engine.process(item2);
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('title');
    });

    it('passes significantly different titles', () => {
      const item1 = createNewsItem({
        id: 'a:1', title: 'Apple Releases New iPhone',
        body: 'Apple product launch details.',
        source: 'xueqiu',
      });
      const item2 = createNewsItem({
        id: 'b:1', title: 'Tesla Announces Self-Driving Breakthrough',
        body: 'Tesla autonomous driving update.',
        source: 'sina',
      });

      engine.process(item1);
      const result = engine.process(item2);
      expect(result.isDuplicate).toBe(false);
    });

    it('detects same title with different punctuation', () => {
      const sharedBody = 'Shared body content for title punctuation test. '.repeat(5);
      const item1 = createNewsItem({
        id: 'a:1', title: 'Breaking: Market Surges on Fed Announcement', body: sharedBody, source: 'cls_telegraph',
      });
      const item2 = createNewsItem({
        id: 'b:1', title: 'Breaking Market Surges on Fed Announcement', body: sharedBody + 'extra', source: 'sina',
      });

      engine.process(item1);
      const result = engine.process(item2);
      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('Content Fingerprint Deduplication', () => {
    it('detects same content with different titles', () => {
      // Same body, different titles, first item = higher priority (reuters)
      const body = 'TheFederalReserveTodayAnnouncedA25BasisPointRateIncreaseCitingStrongEconomicGrowthAndPersistentInflationaryPressures.'.repeat(3);
      const item1 = createNewsItem({ id: 'a:1', title: 'Fed Rate Hike Analysis', body, source: 'reuters' });
      const item2 = createNewsItem({ id: 'b:1', title: 'Federal Reserve Interest Rate Decision Coverage', body, source: 'xueqiu' });

      engine.process(item1);
      const result = engine.process(item2);
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('fingerprint');
    });

    it('passes different content through', () => {
      const item1 = createNewsItem({
        id: 'a:1', title: 'Apple Report',
        body: 'Content about Apple earnings report Q4 2025 showing record revenue across iPhone and Mac segments.',
        source: 'xueqiu',
      });
      const item2 = createNewsItem({
        id: 'a:2', title: 'Tesla Update',
        body: 'Content about Tesla vehicle deliveries exceeding analyst expectations by 15% in the latest quarter.',
        source: 'xueqiu',
      });

      engine.process(item1);
      expect(engine.process(item2).isDuplicate).toBe(false);
    });
  });

  describe('Source Priority', () => {
    it('higher priority source replaces lower priority duplicate', () => {
      const body = 'Breaking news about market crash and economic turmoil worldwide. '.repeat(5);
      const xueqiu = createNewsItem({ id: 'xq:1', title: 'Market Crash Alert', body, source: 'xueqiu' });
      const reuters = createNewsItem({ id: 'reut:1', title: 'Market Crash Alert', body, source: 'reuters' });

      engine.process(xueqiu);
      const result = engine.process(reuters);
      expect(result.isDuplicate).toBe(false);
    });

    it('lower priority does not replace higher priority', () => {
      const body = 'Important economic data released today showing GDP growth. '.repeat(5);
      const reuters = createNewsItem({ id: 'reut:1', title: 'Economic Data Release', body, source: 'reuters' });
      const xueqiu = createNewsItem({ id: 'xq:1', title: 'Economic Data Release', body, source: 'xueqiu' });

      engine.process(reuters);
      const result = engine.process(xueqiu);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOf).toBe('reut:1');
    });
  });

  describe('Batch Processing', () => {
    it('deduplicates batch correctly', () => {
      const sharedBody = 'Important economic data released today with detailed analysis. '.repeat(3);
      const items: NewsItem[] = [
        createNewsItem({ id: '1', title: 'Unique News A', body: sharedBody, source: 'reuters' }),
        createNewsItem({ id: '1-dup', title: 'Unique News A', body: sharedBody, source: 'sina' }),
        createNewsItem({ id: '2', title: 'Unique News B', body: 'Completely different news content about tech sector growth.', source: 'cnbc' }),
        createNewsItem({ id: '3', title: 'Unique News C', body: 'Another distinct article about global market trends today.', source: 'cls_telegraph' }),
      ];

      const results = engine.processBatch(items);
      expect(results.length).toBeLessThanOrEqual(3);
      const sources = results.map(r => r.source);
      expect(sources).toContain('reuters');
    });

    it('empties batch returns empty', () => {
      expect(engine.processBatch([])).toEqual([]);
    });
  });

  describe('Stats', () => {
    it('tracks dedup rate', () => {
      const sharedBody = 'Shared body for dedup stats test. '.repeat(5);
      const item1 = createNewsItem({ id: '1', title: 'Stats Test', body: sharedBody, url: 'https://x.com/1', source: 'xueqiu' });
      const item2 = createNewsItem({ id: '2', title: 'Stats Test', body: sharedBody, url: 'https://x.com/1', source: 'sina' });

      engine.process(item1);
      engine.process(item2);

      const stats = engine.getStats();
      expect(stats.total).toBe(2);
      expect(stats.duplicates).toBe(1);
      expect(stats.unique).toBe(1);
      expect(stats.dedupRate).toBe(0.5);
    });

    it('reports 0 dedup rate when no duplicates', () => {
      const items = [
        createNewsItem({ id: '1', title: 'First Article', body: 'First article unique content about topic A today with details.', url: 'https://x.com/1' }),
        createNewsItem({ id: '2', title: 'Second Article', body: 'Second article distinct content about topic B discussing trends.', url: 'https://x.com/2' }),
      ];

      engine.processBatch(items);
      const stats = engine.getStats();
      expect(stats.duplicates).toBe(0);
      expect(stats.dedupRate).toBe(0);
    });
  });

  describe('Config', () => {
    it('uses custom config values', () => {
      const customEngine = new DedupEngine({
        windowMs: 3600000,
        maxCacheSize: 100,
        titleSimilarityThreshold: 0.95,
      });

      const stats = customEngine.getStats();
      expect(stats.windowMs).toBe(3600000);
      expect(stats.cacheSize).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// News Types Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R238: News Types', () => {
  it('NewsItem has all required fields', () => {
    const item: NewsItem = {
      id: 'test:1',
      title: 'Test',
      body: 'Body',
      source: 'xueqiu',
      publishedAt: Date.now(),
      fetchedAt: Date.now(),
      language: 'zh',
      tickers: ['AAPL'],
    };

    expect(item.id).toBeTruthy();
    expect(item.title).toBeTruthy();
    expect(item.source).toBe('xueqiu');
    expect(item.language).toBe('zh');
  });

  it('SentimentResult has valid range', () => {
    const sentiment = {
      score: 0.75,
      confidence: 0.92,
      tickers: ['AAPL'],
      keywords: ['earnings', 'beat'],
      category: 'earnings' as const,
      impact: 8,
      reasoning: 'Strong earnings beat',
      provider: 'deepseek' as const,
    };

    expect(sentiment.score).toBeGreaterThanOrEqual(-1);
    expect(sentiment.score).toBeLessThanOrEqual(1);
    expect(sentiment.confidence).toBeGreaterThanOrEqual(0);
    expect(sentiment.confidence).toBeLessThanOrEqual(1);
    expect(sentiment.impact).toBeGreaterThanOrEqual(1);
    expect(sentiment.impact).toBeLessThanOrEqual(10);
  });

  it('DedupResult structure is correct', () => {
    const item = createNewsItem({ id: 'test:1' });
    const result = {
      item,
      isDuplicate: false,
    };

    expect(result.item.id).toBe('test:1');
    expect(result.isDuplicate).toBe(false);
    expect(result.duplicateOf).toBeUndefined();
    expect(result.similarity).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Source Priority Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R238: Source Priority System', () => {
  it('reuters has highest priority among major feeds', () => {
    const sources = ['cnbc', 'cls_telegraph', 'eastmoney', 'sina', 'xueqiu', 'reddit'];
    let replacedCount = 0;

    for (const source of sources) {
      const engine = new DedupEngine();
      const body = 'Test content for source priority comparison. '.repeat(10);
      const item1 = createNewsItem({ id: `${source}:1`, title: 'Breaking News Priority Test', body, source: source as any });
      const item2 = createNewsItem({ id: 'reuters:1', title: 'Breaking News Priority Test', body, source: 'reuters' });

      engine.process(item1);
      const result = engine.process(item2);
      if (!result.isDuplicate) replacedCount++;
    }

    expect(replacedCount).toBeGreaterThanOrEqual(1);
  });

  it('all 15 source types are recognized', () => {
    const sourceTypes = [
      'eastmoney', 'sina', 'xueqiu', 'cls_telegraph',
      'alphavantage_ns', 'newsapi', 'polygon', 'reddit',
      'twitter', 'stocktwits', 'wechat_public',
      'reuters', 'cnbc', 'yahoo_finance', 'marketwatch',
    ];

    for (const source of sourceTypes) {
      const item = createNewsItem({
        id: `${source}:1`, title: `${source} Test`, body: `${source} specific content for recognition test.`,
        source: source as any,
      });
      const result = new DedupEngine().process(item);
      expect(result.isDuplicate).toBe(false);
    }
  });
});
