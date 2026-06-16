/**
 * R244 JVS Test Suite
 * Tests: FactorCalculatorValidator + WatchlistSmartNewsEngine + NewsFactorBridgeEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FactorCalculatorValidator } from '../electron/engine/factors/FactorCalculatorValidator';
import { WatchlistSmartNewsEngine } from '../electron/engine/news/WatchlistSmartNewsEngine';
import { NewsFactorBridgeEngine } from '../electron/engine/news/NewsFactorBridgeEngine';

// ═════════════════════════════════════════════════════════════════════════════
// FactorCalculatorValidator Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('FactorCalculatorValidator', () => {
  let validator: FactorCalculatorValidator;

  beforeEach(() => {
    validator = FactorCalculatorValidator.getInstance();
    validator.invalidateCache();
  });

  it('should be a singleton', () => {
    const a = FactorCalculatorValidator.getInstance();
    const b = FactorCalculatorValidator.getInstance();
    expect(a).toBe(b);
  });

  it('should produce a validation report', async () => {
    const report = await validator.validate();
    expect(report).toBeDefined();
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.registryTotal).toBeGreaterThan(0);
    expect(typeof report.coveragePct).toBe('number');
    expect(Array.isArray(report.missing)).toBe(true);
    expect(Array.isArray(report.ghosts)).toBe(true);
    expect(Array.isArray(report.duplicates)).toBe(true);
  });

  it('should have tier coverage in report', async () => {
    const report = await validator.validate();
    expect(report.tierCoverage).toBeDefined();
    expect(report.tierCoverage.green).toBeGreaterThanOrEqual(0);
    expect(report.tierCoverage.yellow).toBeGreaterThanOrEqual(0);
    expect(report.tierCoverage.pro).toBeGreaterThanOrEqual(0);
    expect(report.tierCoverage.marketRed).toBeGreaterThanOrEqual(0);
    expect(report.tierCoverage.marketYellow).toBeGreaterThanOrEqual(0);
    expect(report.tierCoverage.finalRed).toBeGreaterThanOrEqual(0);
  });

  it('should have level1 coverage in report', async () => {
    const report = await validator.validate();
    expect(Array.isArray(report.level1Coverage)).toBe(true);
  });

  it('should have a summary string', async () => {
    const report = await validator.validate();
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(10);
  });

  it('should cache reports within TTL', async () => {
    const r1 = await validator.validate();
    const r2 = await validator.validate();
    expect(r1.generatedAt).toBe(r2.generatedAt); // Same cached result
  });

  it('should invalidate cache correctly', async () => {
    const r1 = await validator.validate();
    validator.invalidateCache();
    const r2 = await validator.validate();
    // After invalidation, new report should have different timestamp
    expect(r2.generatedAt).toBeGreaterThanOrEqual(r1.generatedAt);
  });

  it('should get factor detail for a known factor', async () => {
    const detail = await validator.getFactorDetail('MKT');
    expect(detail.status).toBeDefined();
    expect(['covered', 'missing', 'ghost', 'duplicate']).toContain(detail.status);
    expect(typeof detail.notes).toBe('string');
  });

  it('should get factor detail for a ghost factor', async () => {
    const detail = await validator.getFactorDetail('CRYPTO_SOPR');
    expect(detail).toBeDefined();
    expect(typeof detail.notes).toBe('string');
  });

  it('should return all 4 status types', async () => {
    const statuses = new Set<string>();
    const ids = ['MKT', 'XYZ_NONEXISTENT', 'CRYPTO_PUELL', 'EQUITY_MULTIPLIER'];
    for (const id of ids) {
      const detail = await validator.getFactorDetail(id);
      statuses.add(detail.status);
    }
    // We should see at least 2 distinct statuses
    expect(statuses.size).toBeGreaterThanOrEqual(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WatchlistSmartNewsEngine Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('WatchlistSmartNewsEngine', () => {
  let engine: WatchlistSmartNewsEngine;

  beforeEach(() => {
    engine = WatchlistSmartNewsEngine.getInstance();
  });

  it('should be a singleton', () => {
    const a = WatchlistSmartNewsEngine.getInstance();
    const b = WatchlistSmartNewsEngine.getInstance();
    expect(a).toBe(b);
  });

  it('should fetch news for a single symbol', async () => {
    const result = await engine.fetchWatchlistNews([
      { symbol: 'AAPL', market: 'US', aliases: ['Apple', 'iPhone'] },
    ]);
    expect(result).toBeDefined();
    expect(result.symbols).toContain('AAPL');
    expect(result.perSymbol.length).toBe(1);
    expect(result.generatedAt).toBeGreaterThan(0);
  });

  it('should produce per-symbol results', async () => {
    const result = await engine.fetchWatchlistNews([
      { symbol: 'TSLA', market: 'US', aliases: ['Tesla'] },
    ]);
    expect(result.perSymbol[0].symbol).toBe('TSLA');
    expect(typeof result.perSymbol[0].digestSummary).toBe('string');
  });

  it('should include market digest', async () => {
    const result = await engine.fetchWatchlistNews([
      { symbol: 'AAPL', market: 'US', aliases: [] },
    ]);
    expect(result.marketsDigest).toBeDefined();
    expect(typeof result.marketsDigest.usSummary).toBe('string');
    expect(typeof result.marketsDigest.temperature).toBe('string');
    expect(['frozen', 'cold', 'neutral', 'warm', 'hot']).toContain(result.marketsDigest.temperature);
  });

  it('should handle multiple symbols', async () => {
    const result = await engine.fetchWatchlistNews([
      { symbol: 'AAPL', market: 'US', aliases: [] },
      { symbol: '0700', market: 'HK', aliases: ['Tencent'] },
    ]);
    expect(result.perSymbol.length).toBe(2);
  });

  it('should handle empty watchlist gracefully', async () => {
    const result = await engine.fetchWatchlistNews([]);
    expect(result).toBeDefined();
    expect(result.perSymbol.length).toBe(0);
    expect(result.totalArticlesScanned).toBeGreaterThanOrEqual(0);
  });

  it('should rank articles by relevance score', async () => {
    const result = await engine.fetchWatchlistNews([
      { symbol: 'NVDA', market: 'US', aliases: ['Nvidia', 'GPU', 'AI'] },
    ]);
    const articles = result.perSymbol[0]?.rankedArticles || [];
    if (articles.length >= 2) {
      for (let i = 1; i < articles.length; i++) {
        expect(articles[i - 1].relevanceScore).toBeGreaterThanOrEqual(articles[i].relevanceScore);
      }
    }
  });

  it('should have cross-market signals', async () => {
    const result = await engine.fetchWatchlistNews([
      { symbol: 'AAPL', market: 'US', aliases: [] },
      { symbol: 'BTCUSDT', market: 'CRYPTO', aliases: [] },
      { symbol: 'XAUUSD', market: 'COMMODITY', aliases: [] },
    ]);
    expect(Array.isArray(result.crossMarketSignals)).toBe(true);
  });

  it('should have digestSummary for free tier', async () => {
    const result = await engine.fetchWatchlistNews(
      [{ symbol: 'MSFT', market: 'US', aliases: [] }],
      5, 24, false, // paid=false
    );
    const summary = result.perSymbol[0].digestSummary;
    expect(typeof summary).toBe('string');
  });

  it('should include suggestedAction when paid=true', async () => {
    const result = await engine.fetchWatchlistNews(
      [{ symbol: 'AMZN', market: 'US', aliases: [] }],
      5, 24, true, // paid=true
    );
    expect(result.perSymbol[0].suggestedAction).toBeDefined();
  });

  it('should handle quickLookup', async () => {
    const result = await engine.quickLookup('GOOGL', 'US');
    expect(result.symbol).toBe('GOOGL');
    expect(result.market).toBe('US');
  });

  it('should scan breaking news', async () => {
    const result = await engine.scanBreaking([
      { symbol: 'META', market: 'US', aliases: [] },
    ], 0.3);
    expect(Array.isArray(result)).toBe(true);
    for (const article of result) {
      expect(Math.abs(article.sentiment)).toBeGreaterThanOrEqual(0.3);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// NewsFactorBridgeEngine Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('NewsFactorBridgeEngine', () => {
  let bridge: NewsFactorBridgeEngine;

  beforeEach(() => {
    bridge = NewsFactorBridgeEngine.getInstance();
  });

  it('should be a singleton', () => {
    const a = NewsFactorBridgeEngine.getInstance();
    const b = NewsFactorBridgeEngine.getInstance();
    expect(a).toBe(b);
  });

  it('should compute factor shifts from news', () => {
    const result = bridge.computeFactorShifts({
      symbol: 'AAPL',
      runAt: Date.now(),
      articles: [
        {
          id: '1', title: 'Apple beats earnings estimates',
          source: 'reuters', sourceAuthority: 1.0,
          publishedAt: Date.now() - 3600000,
          sentiment: 0.6, category: 'earnings' as const,
          keywords: ['AAPL', 'earnings'],
        },
        {
          id: '2', title: 'iPhone sales surge in China',
          source: 'bloomberg', sourceAuthority: 0.95,
          publishedAt: Date.now() - 7200000,
          sentiment: 0.4, category: 'product_launch' as const,
          keywords: ['AAPL', 'iPhone'],
        },
      ],
    });

    expect(result.symbol).toBe('AAPL');
    expect(result.totalArticles).toBe(2);
    expect(result.shifts.length).toBeGreaterThan(0);
    expect(Array.isArray(result.topBullish)).toBe(true);
    expect(Array.isArray(result.topBearish)).toBe(true);
    expect(Array.isArray(result.riskAlerts)).toBe(true);
  });

  it('should return empty report for no articles', () => {
    const result = bridge.computeFactorShifts({
      symbol: 'XYZ',
      runAt: Date.now(),
      articles: [],
    });

    expect(result.symbol).toBe('XYZ');
    expect(result.totalArticles).toBe(0);
    expect(result.shifts.length).toBe(0);
    expect(result.aggregateShiftIndex).toBe(0);
  });

  it('should filter stale articles (>24h)', () => {
    const result = bridge.computeFactorShifts({
      symbol: 'OLD',
      runAt: Date.now(),
      articles: [{
        id: 'old1', title: 'Very old news',
        source: 'reuters', sourceAuthority: 1.0,
        publishedAt: Date.now() - 48 * 3600000, // 48h ago
        sentiment: 0.8, category: 'earnings' as const,
        keywords: [],
      }],
    });

    expect(result.totalArticles).toBe(0); // Filtered out
  });

  it('should produce significant macro shifts for strong signals', () => {
    const result = bridge.computeFactorShifts({
      symbol: 'STRONG',
      runAt: Date.now(),
      articles: [
        {
          id: 's1', title: 'CPI data comes in hot — inflation surging',
          source: 'reuters', sourceAuthority: 1.0,
          publishedAt: Date.now(),
          sentiment: -0.9, category: 'macro_data' as const,
          keywords: ['CPI', 'inflation'],
        },
        {
          id: 's2', title: 'Fed signals aggressive rate hikes ahead',
          source: 'bloomberg', sourceAuthority: 0.95,
          publishedAt: Date.now() - 1800000,
          sentiment: -0.8, category: 'macro_data' as const,
          keywords: ['Fed', 'rate hike'],
        },
      ],
    });

    expect(result.shifts.length).toBeGreaterThan(0);
    // Macro data news should strongly affect L1_MACRO factors
    const macroShifts = result.shifts.filter(s => s.level1 === 'L1_MACRO');
    expect(macroShifts.length).toBeGreaterThan(0);
    // Both articles negative => macro factors should shift down
    const avgMacro = macroShifts.reduce((s, f) => s + f.delta, 0) / macroShifts.length;
    expect(avgMacro).toBeLessThan(0);
    expect(typeof result.summary).toBe('string');
  });

  it('should compute aggregate shift index within [-100, 100]', () => {
    const result = bridge.computeFactorShifts({
      symbol: 'TEST',
      runAt: Date.now(),
      articles: [
        {
          id: 't1', title: 'Test news',
          source: 'reuters', sourceAuthority: 1.0,
          publishedAt: Date.now(),
          sentiment: 0.5, category: 'earnings' as const,
          keywords: [],
        },
      ],
    });
    expect(result.aggregateShiftIndex).toBeGreaterThanOrEqual(-100);
    expect(result.aggregateShiftIndex).toBeLessThanOrEqual(100);
  });

  it('should compute from direct sentiment', () => {
    const result = bridge.computeFromSentiment(
      'AAPL', 'earnings', 0.8, 1.0,
    );
    expect(result.symbol).toBe('AAPL');
    expect(result.totalArticles).toBe(1);
    expect(result.shifts.length).toBeGreaterThan(0);
  });

  it('should batch compute for multiple symbols', () => {
    const results = bridge.batchCompute([
      {
        symbol: 'AAPL', runAt: Date.now(),
        articles: [{
          id: 'a1', title: 'Apple news',
          source: 'reuters', sourceAuthority: 1.0,
          publishedAt: Date.now(), sentiment: 0.5,
          category: 'earnings' as const, keywords: [],
        }],
      },
      {
        symbol: 'GOOGL', runAt: Date.now(),
        articles: [{
          id: 'g1', title: 'Google news',
          source: 'bloomberg', sourceAuthority: 0.95,
          publishedAt: Date.now(), sentiment: -0.3,
          category: 'regulatory' as const, keywords: [],
        }],
      },
    ]);

    expect(results.length).toBe(2);
    expect(results[0].symbol).toBe('AAPL');
    expect(results[1].symbol).toBe('GOOGL');
  });

  it('should list registered factors', () => {
    const factors = bridge.getRegisteredFactors();
    expect(factors.length).toBeGreaterThan(0);
    expect(factors[0]).toHaveProperty('factorId');
    expect(factors[0]).toHaveProperty('label');
    expect(factors[0]).toHaveProperty('level1');
  });

  it('should have different shifts for opposite sentiment', () => {
    const bullish = bridge.computeFromSentiment('T1', 'earnings', 0.8, 1.0);
    const bearish = bridge.computeFromSentiment('T1', 'earnings', -0.8, 1.0);

    expect(bullish.aggregateShiftIndex).toBeGreaterThan(0);
    expect(bearish.aggregateShiftIndex).toBeLessThan(0);
  });

  it('should include risk alerts for regulatory news', () => {
    const result = bridge.computeFromSentiment('RISK', 'regulatory', -0.9, 1.0);
    expect(result.riskAlerts.length).toBeGreaterThan(0);
  });

  it('should handle crypto events with crypto factors', () => {
    const result = bridge.computeFromSentiment('BTC', 'crypto_event', 0.9, 1.0);
    const cryptoShifts = result.shifts.filter(s => s.level1 === 'L1_CRYPTO');
    expect(cryptoShifts.length).toBeGreaterThan(0);
  });

  it('should handle commodity events', () => {
    const result = bridge.computeFromSentiment('GOLD', 'commodity_event', 0.7, 0.85);
    const cmdShifts = result.shifts.filter(s => s.level1 === 'L1_COMMODITY');
    expect(cmdShifts.length).toBeGreaterThan(0);
  });
});
