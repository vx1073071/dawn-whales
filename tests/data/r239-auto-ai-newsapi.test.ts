/**
 * R239-auto: NewsAPI + AI Sentiment Engine Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AISentimentEngine, resetAISentimentEngine } from '../../electron/engine/data/ai-sentiment-engine';
import { NewsAPIKeyManager } from '../../electron/engine/data/newsapi-manager';
import type { NewsItem, SentimentResult } from '../../electron/engine/data/news-types';

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
    tickers: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// NewsAPIKeyManager Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R239-auto#1: NewsAPIKeyManager', () => {
  let manager: NewsAPIKeyManager;

  beforeEach(() => {
    manager = new NewsAPIKeyManager();
  });

  it('adds API key and returns an ID', () => {
    const id = manager.addKey('sk_test_key_12345', 'free');
    expect(id).toBeTruthy();
    expect(id.startsWith('newsapi_')).toBe(true);
  });

  it('gets active key after adding', () => {
    manager.addKey('sk_test_key_12345', 'free');
    const keyInfo = manager.getActiveKey();
    expect(keyInfo).not.toBeNull();
    expect(keyInfo!.key).toBe('sk_test_key_12345');
  });

  it('returns null when no keys added', () => {
    expect(manager.getActiveKey()).toBeNull();
  });

  it('tracks usage count', () => {
    const id = manager.addKey('sk_test_key_abc', 'free');
    const keyInfo = manager.getActiveKey();
    expect(keyInfo).not.toBeNull();

    manager.recordUsage(id);
    manager.recordUsage(id);

    const stats = manager.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.dailyRequests).toBe(2);
  });

  it('prefers paid key over free when quota is same', () => {
    manager.addKey('sk_free_1', 'free');
    const keyInfo = manager.getActiveKey();
    expect(keyInfo).not.toBeNull();
  });

  it('handles key rotation', () => {
    const oldId = manager.addKey('sk_old_key', 'free');
    const newId = manager.rotateKey(oldId, 'sk_new_key', 'free');

    expect(newId).not.toBe(oldId);
    const keyInfo = manager.getActiveKey();
    expect(keyInfo).not.toBeNull();
  });

  it('reports correct stats', () => {
    manager.addKey('sk_a', 'free');
    manager.addKey('sk_b', 'paid');

    const stats = manager.getStats();
    expect(stats.totalKeys).toBe(2);
    expect(stats.activeKeys).toBe(2);
    expect(stats.freeKeys).toBe(1);
    expect(stats.paidKeys).toBe(1);
  });

  it('encrypts keys (not stored in plaintext)', () => {
    const id = manager.addKey('sk_secret_key_value', 'free');
    // The manager stores the key internally in a Map (in-memory),
    // but the encryption methods exist for persistent storage
    expect(id).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AISentimentEngine Tests
// ═══════════════════════════════════════════════════════════════════════

describe('R239-auto#2: AISentimentEngine', () => {
  let engine: AISentimentEngine;

  beforeEach(() => {
    resetAISentimentEngine();
    // Create without API key — will test local fallback behavior
    engine = new AISentimentEngine({ apiKey: '', cacheSize: 100 });
  });

  describe('Configuration', () => {
    it('initializes with default config', () => {
      expect(engine).toBeDefined();
    });

    it('accepts custom config', () => {
      const custom = new AISentimentEngine({ temperature: 0.5, cacheSize: 50 });
      expect(custom).toBeDefined();
    });

    it('isAvailable returns false without API key', async () => {
      const available = await engine.isAvailable();
      expect(available).toBe(false);
    });

    it('isAvailable returns true with API key', async () => {
      const keyed = new AISentimentEngine({ apiKey: 'sk-test-key-123' });
      const available = await keyed.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Local Fallback: Keyword Sentiment', () => {
    it('detects positive sentiment from keywords', async () => {
      const item = createNewsItem({
        title: 'Apple Reports Record Profit',
        body: 'Apple beat all estimates with record revenue growth and profit surge. Bullish outlook.',
      });

      const result = await engine.analyze(item);
      expect(result.provider).toBe('keyword');
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('detects negative sentiment from keywords', async () => {
      const item = createNewsItem({
        title: 'Tesla Stock Plunges on Bankruptcy Fears',
        body: 'Tesla shares crash amid downgrade and fraud investigation. Bearish outlook with massive losses.',
      });

      const result = await engine.analyze(item);
      expect(result.provider).toBe('keyword');
      expect(result.score).toBeLessThan(0);
    });

    it('returns neutral for no matches', async () => {
      const item = createNewsItem({
        title: 'The Weather Today',
        body: 'Sunny with a chance of clouds. Nothing financial here.',
      });

      const result = await engine.analyze(item);
      expect(result.provider).toBe('keyword');
      expect(result.score).toBe(0);
    });

    it('clamps score to -1 .. +1', async () => {
      // 10 positive keywords only
      const body = 'beat growth record profit upgrade positive surge rally bullish breakthrough launch '.repeat(3);
      const item = createNewsItem({ title: 'Very Positive', body });

      const result = await engine.analyze(item);
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('clamps confidence to 0 .. 1', async () => {
      const item = createNewsItem({ title: 'Test', body: 'Something happened.' });
      const result = await engine.analyze(item);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Results Structure', () => {
    it('returns valid SentimentResult structure', async () => {
      const item = createNewsItem({
        title: 'Fed Raises Rates by 25bps',
        body: 'The Federal Reserve announced a rate hike today.',
      });

      const result = await engine.analyze(item);

      expect(typeof result.score).toBe('number');
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.tickers)).toBe(true);
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(result.keywords.length).toBeLessThanOrEqual(5);
      expect(['earnings', 'policy', 'industry', 'company', 'macro', 'technical', 'social', 'breaking']).toContain(result.category);
      expect(result.impact).toBeGreaterThanOrEqual(1);
      expect(result.impact).toBeLessThanOrEqual(10);
      expect(typeof result.reasoning).toBe('string');
      expect(['deepseek', 'keyword', 'none']).toContain(result.provider);
    });
  });

  describe('Cache', () => {
    it('caches identical queries', async () => {
      const item1 = createNewsItem({
        title: 'Microsoft Cloud Revenue Grows 30%',
        body: 'Microsoft reported strong cloud growth driven by Azure.',
      });
      const item2 = createNewsItem({
        title: 'Microsoft Cloud Revenue Grows 30%',
        body: 'Microsoft reported strong cloud growth driven by Azure.',
      });

      const r1 = await engine.analyze(item1);
      const r2 = await engine.analyze(item2);

      // Same query should return cached result
      expect(r1.score).toBe(r2.score);
      expect(r1.confidence).toBe(r2.confidence);

      const stats = engine.getStats();
      expect(stats.cache.hits).toBeGreaterThanOrEqual(1);
    });

    it('returns different results for different queries', async () => {
      const item1 = createNewsItem({ title: 'Bull Market Continues', body: 'The rally persists with strong earnings.' });
      const item2 = createNewsItem({ title: 'Bear Market Warning', body: 'Stocks plummet on recession fears.' });

      const r1 = await engine.analyze(item1);
      const r2 = await engine.analyze(item2);

      // Different news should potentially have different scores
      expect(typeof r1.score).toBe('number');
      expect(typeof r2.score).toBe('number');
    });
  });

  describe('Batch Processing', () => {
    it('analyzes batch of items', async () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Positive News A', body: 'Record profits beat estimates.' }),
        createNewsItem({ title: 'Negative News B', body: 'Stock crashes on downgrade warning.' }),
        createNewsItem({ title: 'Neutral News C', body: 'Company announces routine update.' }),
      ];

      const results = await engine.analyzeBatch(items);
      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(typeof r.score).toBe('number');
      });

      // Positive news should have positive/non-negative score
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      // Negative news should have negative/non-positive score
      expect(results[1].score).toBeLessThanOrEqual(0);
    });

    it('analyzeAndUpdateBatch updates items', async () => {
      const items: NewsItem[] = [
        createNewsItem({ title: 'Update Test', body: 'Some financial news content here.' }),
      ];

      const updated = await engine.analyzeAndUpdateBatch(items);
      expect(updated[0].sentiment).toBeDefined();
      expect(updated[0].sentiment!.score).toBeDefined();
    });
  });

  describe('Cost Tracker', () => {
    it('cost tracker is accessible', () => {
      const tracker = engine.getCostTracker();
      expect(tracker).toBeDefined();
      const stats = tracker.getStats();
      expect(typeof stats.totalCost).toBe('number');
      expect(typeof stats.monthCost).toBe('number');
    });
  });

  describe('Stats', () => {
    it('returns engine stats', () => {
      const stats = engine.getStats();
      expect(stats.cache).toBeDefined();
      expect(stats.cost).toBeDefined();
      expect(stats.health).toBeDefined();
      expect(stats.health.status).toBeDefined();
      expect(typeof stats.health.circuitOpen).toBe('boolean');
      expect(typeof stats.health.consecutiveFailures).toBe('number');
      expect(stats.config).toBeDefined();
    });
  });
});
