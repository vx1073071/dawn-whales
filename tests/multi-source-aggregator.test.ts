/**
 * J-41-01: MultiSourceAggregator Activation Tests
 * Tests the activated MultiSourceAggregator with 4 data sources:
 * EastMoney (东方财富), Sina Finance (新浪财经), Tencent Finance (腾讯财经), Xueqiu (雪球)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MultiSourceAggregator,
} from '../electron/engine/multi-source-aggregator';

// Mock fetcher that returns controlled data
function createMockFetcher(sourceId: string, data: any, shouldFail = false, delayMs = 0) {
  return async (symbol: string) => {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (shouldFail) {
      throw new Error(`${sourceId} fetch failed for ${symbol}`);
    }
    return {
      symbol,
      timestamp: Date.now(),
      source: sourceId,
      ...data,
    };
  };
}

// Create aggregator without health check timers to avoid fake timer issues
function createTestAggregator(): MultiSourceAggregator {
  const aggregator = new MultiSourceAggregator();

  const configs = [
    { id: 'eastmoney', name: 'EastMoney', priority: 1, enabled: true, timeoutMs: 5000, maxRetries: 2, healthCheckIntervalMs: 0 },
    { id: 'sina', name: 'Sina Finance', priority: 2, enabled: true, timeoutMs: 5000, maxRetries: 2, healthCheckIntervalMs: 0 },
    { id: 'tencent', name: 'Tencent Finance', priority: 3, enabled: true, timeoutMs: 5000, maxRetries: 2, healthCheckIntervalMs: 0 },
    { id: 'xueqiu', name: 'Xueqiu', priority: 4, enabled: true, timeoutMs: 5000, maxRetries: 1, healthCheckIntervalMs: 0 },
  ];

  for (const config of configs) {
    aggregator.addSource(config, async () => {
      throw new Error(`Source ${config.id} fetcher not implemented`);
    });
  }

  return aggregator;
}

describe('J-41-01: MultiSourceAggregator Activation', () => {
  let aggregator: MultiSourceAggregator;

  afterEach(() => {
    if (aggregator) {
      aggregator.destroy();
    }
  });

  // ─── T1: Default 4 sources registered ─────────────────────────────────────

  it('should register 4 default data sources', () => {
    aggregator = createTestAggregator();
    const ids = aggregator.getSourceIds();
    expect(ids).toHaveLength(4);
    expect(ids).toContain('eastmoney');
    expect(ids).toContain('sina');
    expect(ids).toContain('tencent');
    expect(ids).toContain('xueqiu');
  });

  // ─── T2: Sources have correct priority ordering ────────────────────────────

  it('should have correct priority ordering (eastmoney=1, sina=2, tencent=3, xueqiu=4)', () => {
    aggregator = createTestAggregator();
    const eastmoney = aggregator.getSourceConfig('eastmoney');
    const sina = aggregator.getSourceConfig('sina');
    const tencent = aggregator.getSourceConfig('tencent');
    const xueqiu = aggregator.getSourceConfig('xueqiu');

    expect(eastmoney?.priority).toBe(1);
    expect(sina?.priority).toBe(2);
    expect(tencent?.priority).toBe(3);
    expect(xueqiu?.priority).toBe(4);
  });

  // ─── T3: All sources enabled by default ───────────────────────────────────

  it('should have all sources enabled by default', () => {
    aggregator = createTestAggregator();
    const stats = aggregator.getStatsSummary();
    expect(stats.totalSources).toBe(4);
    expect(stats.enabledSources).toBe(4);
  });

  // ─── T4: fetchBest uses highest priority source ───────────────────────────

  it('should fetchBest from highest priority source (eastmoney)', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    const result = await aggregator.fetchBest('600519');

    expect(result.source).toBe('eastmoney');
    expect(result.price).toBe(100);
  });

  // ─── T5: fetchBest falls back when primary fails ──────────────────────────

  it('should fallback to sina when eastmoney fails', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      createMockFetcher('eastmoney', {}, true) // fail
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    const result = await aggregator.fetchBest('600519');

    expect(result.source).toBe('sina');
    expect(result.price).toBe(101);
  });

  // ─── T6: fetchBest falls back through multiple failures ───────────────────

  it('should fallback through multiple failures to xueqiu', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')!, maxRetries: 0 },
      createMockFetcher('sina', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('tencent')!, maxRetries: 0 },
      createMockFetcher('tencent', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('xueqiu')!, maxRetries: 0 },
      createMockFetcher('xueqiu', { price: 99, source: 'xueqiu' })
    );

    const result = await aggregator.fetchBest('600519');

    expect(result.source).toBe('xueqiu');
  });

  // ─── T7: fetchBest throws when all sources fail ───────────────────────────

  it('should throw when all sources fail', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')!, maxRetries: 0 },
      createMockFetcher('sina', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('tencent')!, maxRetries: 0 },
      createMockFetcher('tencent', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('xueqiu')!, maxRetries: 0 },
      createMockFetcher('xueqiu', {}, true)
    );

    await expect(aggregator.fetchBest('600519')).rejects.toThrow(/All sources failed/);
  });

  // ─── T8: setSourceEnabled disables a source ───────────────────────────────

  it('should skip disabled sources in fetchBest', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    // Disable eastmoney
    aggregator.setSourceEnabled('eastmoney', false);

    const result = await aggregator.fetchBest('600519');

    // Should use sina since eastmoney is disabled
    expect(result.source).toBe('sina');
  });

  // ─── T9: setSourceEnabled re-enables a source ─────────────────────────────

  it('should use re-enabled source in fetchBest', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );

    aggregator.setSourceEnabled('eastmoney', false);
    aggregator.setSourceEnabled('eastmoney', true);

    const result = await aggregator.fetchBest('600519');

    expect(result.source).toBe('eastmoney');
  });

  // ─── T10: removeSource removes a source ───────────────────────────────────

  it('should remove a source and not use it', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    aggregator.removeSource('eastmoney');
    expect(aggregator.getSourceIds()).not.toContain('eastmoney');

    const result = await aggregator.fetchBest('600519');

    expect(result.source).toBe('sina');
  });

  // ─── T11: getStatsSummary tracks requests ─────────────────────────────────

  it('should track request counts in getStatsSummary', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100 })
    );

    await aggregator.fetchBest('600519');
    await aggregator.fetchBest('000001');

    const stats = aggregator.getStatsSummary();
    expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    expect(stats.totalErrors).toBe(0);
  });

  // ─── T12: getStatsSummary tracks errors ───────────────────────────────────

  it('should track error counts in getStatsSummary', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101 })
    );

    await aggregator.fetchBest('600519');

    const stats = aggregator.getStatsSummary();
    expect(stats.totalErrors).toBeGreaterThanOrEqual(1);
  });

  // ─── T13: fetchAll returns data from all sources ──────────────────────────

  it('should fetchAll from all enabled sources', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );
    // Also add mocks for tencent and xueqiu so all 4 sources succeed
    aggregator.addSource(
      { ...aggregator.getSourceConfig('tencent')! },
      createMockFetcher('tencent', { price: 99, source: 'tencent' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('xueqiu')! },
      createMockFetcher('xueqiu', { price: 102, source: 'xueqiu' })
    );

    const result = await aggregator.fetchAll('600519');

    expect(result.bestData).toBeDefined();
    expect(result.consensus).toBeGreaterThanOrEqual(0);
    expect(result.allSources.length).toBeGreaterThanOrEqual(1);
  });

  // ─── T14: timeout handling ────────────────────────────────────────────────

  it('should timeout slow sources and fallback', async () => {
    aggregator = createTestAggregator();
    // eastmoney has 5000ms timeout, make it take longer
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, timeoutMs: 100 },
      createMockFetcher('eastmoney', { price: 100 }, false, 5000) // 5s delay
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    const result = await aggregator.fetchBest('600519');

    // Should have fallen back to sina due to timeout
    expect(result.source).toBe('sina');
  }, 10000);

  // ─── T15: retry on transient failure ──────────────────────────────────────

  it('should retry on transient failure', async () => {
    aggregator = createTestAggregator();
    let attempt = 0;
    const retryFetcher = async (symbol: string) => {
      attempt++;
      if (attempt <= 1) {
        throw new Error('transient failure');
      }
      return { symbol, timestamp: Date.now(), source: 'eastmoney', price: 100 };
    };

    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 2 },
      retryFetcher
    );

    const result = await aggregator.fetchBest('600519');

    expect(result.price).toBe(100);
    expect(attempt).toBe(2); // first fail + retry success
  });

  // ─── T16: health check degrades source after errors ───────────────────────

  it('should degrade source health after repeated errors', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101 })
    );

    // Make several failing requests
    for (let i = 0; i < 3; i++) {
      await aggregator.fetchBest('600519');
    }

    const stats = aggregator.getStatsSummary();
    // After errors, some sources should be degraded or unavailable
    expect(stats.degradedSources + stats.unavailableSources).toBeGreaterThanOrEqual(1);
  });

  // ─── T17: destroy cleans up ───────────────────────────────────────────────

  it('should clean up on destroy', () => {
    aggregator = createTestAggregator();
    expect(aggregator.getSourceIds()).toHaveLength(4);

    aggregator.destroy();
    expect(aggregator.getSourceIds()).toHaveLength(0);
  });

  // ─── T18: toJSON produces valid snapshot ──────────────────────────────────

  it('should produce valid JSON snapshot', () => {
    aggregator = createTestAggregator();
    const json = aggregator.toJSON();
    expect(json).toHaveProperty('sources');
    expect(Array.isArray(json.sources)).toBe(true);
    expect(json.sources).toHaveLength(4);
  });

  // ─── T19: emit events on fetch success ────────────────────────────────────

  it('should emit fetch-success event', async () => {
    aggregator = createTestAggregator();
    const handler = vi.fn();
    aggregator.on('fetch-success', handler);

    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100 })
    );

    await aggregator.fetchBest('600519');

    expect(handler).toHaveBeenCalled();
  });

  // ─── T20: emit events on fetch failure ────────────────────────────────────

  it('should emit fetch-error event when all fail', async () => {
    aggregator = createTestAggregator();
    const handler = vi.fn();
    aggregator.on('fetch-error', handler);

    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      createMockFetcher('eastmoney', {}, true)
    );

    await aggregator.fetchBest('600519').catch(() => {});

    expect(handler).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JVS-41-01 Enhancement Tests
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── T21: Data Deduplication - removes exact duplicates ──────────────────

  it('should deduplicate data points with same symbol/source/price', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.8 },
      { symbol: '600519', source: 'sina' as const, price: 101.00, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
    ];

    const deduped = aggregator.deduplicateDataPoints(points);
    expect(deduped).toHaveLength(2);
    // Should keep the eastmoney one with higher confidence (0.9)
    const eastmoneyPoint = deduped.find((d) => d.source === 'eastmoney');
    expect(eastmoneyPoint?.confidence).toBe(0.9);
  });

  // ─── T22: Data Deduplication - countDuplicates ───────────────────────────

  it('should correctly count duplicates', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.8 },
      { symbol: '600519', source: 'sina' as const, price: 101.00, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
      { symbol: '600519', source: 'sina' as const, price: 101.00, volume: 1200, timestamp: Date.now(), quality: 'medium' as const, confidence: 0.7 },
    ];

    expect(aggregator.countDuplicates(points)).toBe(2);
  });

  // ─── T23: Data Deduplication - no duplicates returns same count ──────────

  it('should return all points when no duplicates exist', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: 101.00, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
      { symbol: '600519', source: 'tencent' as const, price: 100.50, volume: 1100, timestamp: Date.now(), quality: 'high' as const, confidence: 0.88 },
    ];

    const deduped = aggregator.deduplicateDataPoints(points);
    expect(deduped).toHaveLength(3);
    expect(aggregator.countDuplicates(points)).toBe(0);
  });

  // ─── T24: Price Anomaly Detection - z-score flags outliers ───────────────

  it('should detect price anomalies using z-score', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: 100.00, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
      { symbol: '600519', source: 'tencent' as const, price: 100.00, volume: 1100, timestamp: Date.now(), quality: 'high' as const, confidence: 0.88 },
      { symbol: '600519', source: 'xueqiu' as const, price: 300.00, volume: 500, timestamp: Date.now(), quality: 'low' as const, confidence: 0.3 },
    ];

    // With 4 data points, max z-score is ~1.73; use threshold 1.5 for small-N
    const anomalies = aggregator.detectPriceAnomalies(points, 1.5);

    // The xueqiu point at 300 (vs three at 100) should be flagged as anomalous
    const xueqiuAnomaly = anomalies.find((a) => a.source === 'xueqiu');
    expect(xueqiuAnomaly?.flagged).toBe(true);
    expect(xueqiuAnomaly?.zScore).toBeGreaterThan(1.5);

    // Only xueqiu is anomalous at threshold 1.5
    const flaggedAnomalies = anomalies.filter((a) => a.flagged);
    expect(flaggedAnomalies).toHaveLength(1);
    expect(flaggedAnomalies[0].source).toBe('xueqiu');

    // The normal prices should not be flagged
    const eastmoneyAnomaly = anomalies.find((a) => a.source === 'eastmoney');
    expect(eastmoneyAnomaly?.flagged).toBe(false);
  });

  // ─── T25: Price Anomaly Detection - no anomalies for uniform data ────────

  it('should not flag anomalies for uniform data', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: 100.10, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
      { symbol: '600519', source: 'tencent' as const, price: 99.90, volume: 1100, timestamp: Date.now(), quality: 'high' as const, confidence: 0.88 },
    ];

    const anomalies = aggregator.detectPriceAnomalies(points, 2.0);
    const flagged = anomalies.filter((a) => a.flagged);
    expect(flagged).toHaveLength(0);
  });

  // ─── T26: IQR Anomaly Detection ─────────────────────────────────────────

  it('should detect anomalies using IQR method', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: 101.00, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
      { symbol: '600519', source: 'tencent' as const, price: 99.50, volume: 1100, timestamp: Date.now(), quality: 'high' as const, confidence: 0.88 },
      { symbol: '600519', source: 'xueqiu' as const, price: 98.00, volume: 900, timestamp: Date.now(), quality: 'high' as const, confidence: 0.82 },
      { symbol: '600519', source: 'eastmoney' as const, price: 500.00, volume: 100, timestamp: Date.now(), quality: 'low' as const, confidence: 0.2 },
    ];

    const anomalies = aggregator.detectAnomaliesIQR(points);
    expect(anomalies.length).toBeGreaterThan(0);

    // The 500 price should be flagged as an outlier
    const outlier = anomalies.find((a) => a.price === 500);
    expect(outlier?.flagged).toBe(true);
  });

  // ─── T27: Batch Fetch - fetches multiple symbols ─────────────────────────

  it('should batch fetch multiple symbols with concurrency limit', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      async (symbol: string) => ({
        symbol,
        source: 'eastmoney' as const,
        price: 100 + Math.random() * 10,
        volume: 1000,
        timestamp: Date.now(),
        quality: 'high' as const,
        confidence: 0.9,
      })
    );

    const symbols = ['600519', '000001', '000002', '601318', '600036'];
    const results = await aggregator.batchFetch(symbols, 2);

    expect(results).toHaveLength(5);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.every((r) => r.data !== undefined)).toBe(true);
  });

  // ─── T28: Batch Fetch - handles partial failures ─────────────────────────

  it('should handle partial failures in batch fetch', async () => {
    aggregator = createTestAggregator();
    let callCount = 0;
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')!, maxRetries: 0 },
      async (symbol: string) => {
        callCount++;
        if (symbol === 'FAIL') {
          throw new Error('intentional failure');
        }
        return {
          symbol,
          source: 'eastmoney' as const,
          price: 100,
          volume: 1000,
          timestamp: Date.now(),
          quality: 'high' as const,
          confidence: 0.9,
        };
      }
    );

    const results = await aggregator.batchFetch(['600519', 'FAIL', '000001'], 3);

    expect(results).toHaveLength(3);
    const successResults = results.filter((r) => r.success);
    const failResults = results.filter((r) => !r.success);
    expect(successResults).toHaveLength(2);
    expect(failResults).toHaveLength(1);
    expect(failResults[0].error).toBeDefined();
  });

  // ─── T29: Batch Fetch - empty symbols returns empty ──────────────────────

  it('should return empty array for empty symbols in batch fetch', async () => {
    aggregator = createTestAggregator();
    const results = await aggregator.batchFetch([], 5);
    expect(results).toHaveLength(0);
  });

  // ─── T30: Source Latency Tracking - records and retrieves latency ─────────

  it('should track latency percentiles per source', () => {
    aggregator = createTestAggregator();

    // Simulate latency measurements
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (const ms of latencies) {
      aggregator.recordLatency('eastmoney', ms);
    }

    const stats = aggregator.getLatencyStats('eastmoney');
    expect(stats).toBeDefined();
    expect(stats!.samples).toBe(10);
    expect(stats!.p50).toBeGreaterThan(0);
    expect(stats!.p95).toBeGreaterThan(stats!.p50);
    expect(stats!.p99).toBeGreaterThan(stats!.p95);
  });

  // ─── T31: Source Latency Tracking - returns undefined for unknown source ──

  it('should return undefined for source with no latency data', () => {
    aggregator = createTestAggregator();
    const stats = aggregator.getLatencyStats('eastmoney');
    expect(stats).toBeUndefined();
  });

  // ─── T32: Source Latency Tracking - getAllLatencyStats ────────────────────

  it('should return latency stats for all tracked sources', () => {
    aggregator = createTestAggregator();

    aggregator.recordLatency('eastmoney', 50);
    aggregator.recordLatency('eastmoney', 100);
    aggregator.recordLatency('sina', 30);
    aggregator.recordLatency('sina', 60);

    const allStats = aggregator.getAllLatencyStats();
    expect(Object.keys(allStats)).toHaveLength(2);
    expect(allStats['eastmoney']).toBeDefined();
    expect(allStats['sina']).toBeDefined();
    expect(allStats['eastmoney'].samples).toBe(2);
    expect(allStats['sina'].samples).toBe(2);
  });

  // ─── T33: Source Latency Tracking - clear works ──────────────────────────

  it('should clear latency stats', () => {
    aggregator = createTestAggregator();

    aggregator.recordLatency('eastmoney', 50);
    aggregator.recordLatency('sina', 30);
    aggregator.clearLatencyStats();

    expect(aggregator.getLatencyStats('eastmoney')).toBeUndefined();
    expect(aggregator.getLatencyStats('sina')).toBeUndefined();
    expect(aggregator.getAllLatencyStats()).toEqual({});
  });

  // ─── T34: Validation Layer - validates correct data point ────────────────

  it('should validate a correct data point as valid', () => {
    aggregator = createTestAggregator();

    const result = aggregator.validateDataPoint({
      symbol: '600519',
      source: 'eastmoney',
      price: 100.00,
      volume: 50000,
      timestamp: Date.now(),
      quality: 'high',
      confidence: 0.9,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ─── T35: Validation Layer - rejects invalid price ───────────────────────

  it('should reject data point with negative price', () => {
    aggregator = createTestAggregator();

    const result = aggregator.validateDataPoint({
      symbol: '600519',
      source: 'eastmoney',
      price: -10,
      volume: 50000,
      timestamp: Date.now(),
      quality: 'high',
      confidence: 0.9,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('price'))).toBe(true);
  });

  // ─── T36: Validation Layer - warns on stale data ─────────────────────────

  it('should warn on stale timestamp', () => {
    aggregator = createTestAggregator();

    const result = aggregator.validateDataPoint({
      symbol: '600519',
      source: 'eastmoney',
      price: 100.00,
      volume: 50000,
      timestamp: Date.now() - 600_000, // 10 minutes old
      quality: 'high',
      confidence: 0.9,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('Stale'))).toBe(true);
  });

  // ─── T37: Validation Layer - rejects future timestamp ────────────────────

  it('should reject data point with future timestamp', () => {
    aggregator = createTestAggregator();

    const result = aggregator.validateDataPoint({
      symbol: '600519',
      source: 'eastmoney',
      price: 100.00,
      volume: 50000,
      timestamp: Date.now() + 120_000, // 2 minutes in future
      quality: 'high',
      confidence: 0.9,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Future'))).toBe(true);
  });

  // ─── T38: Validation Layer - rejects negative volume ─────────────────────

  it('should reject data point with negative volume', () => {
    aggregator = createTestAggregator();

    const result = aggregator.validateDataPoint({
      symbol: '600519',
      source: 'eastmoney',
      price: 100.00,
      volume: -500,
      timestamp: Date.now(),
      quality: 'high',
      confidence: 0.9,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('volume'))).toBe(true);
  });

  // ─── T39: Validation Layer - configurable validation rules ───────────────

  it('should allow custom validation config', () => {
    aggregator = createTestAggregator();
    aggregator.setValidationConfig({ maxPrice: 50 });

    const result = aggregator.validateDataPoint({
      symbol: '600519',
      source: 'eastmoney',
      price: 100.00,
      volume: 50000,
      timestamp: Date.now(),
      quality: 'high',
      confidence: 0.9,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
  });

  // ─── T40: Validation Layer - filterValid removes invalid points ──────────

  it('should filter out invalid data points', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: -5, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.8 },
      { symbol: '600519', source: 'tencent' as const, price: 101.00, volume: 1200, timestamp: Date.now(), quality: 'high' as const, confidence: 0.85 },
    ];

    const valid = aggregator.filterValid(points);
    expect(valid).toHaveLength(2);
    expect(valid.every((v) => v.price > 0)).toBe(true);
  });

  // ─── T41: Source Weight History - records and retrieves history ──────────

  it('should track source weight history', () => {
    aggregator = createTestAggregator();

    aggregator.recordSourceSelection('600519', 'eastmoney', ['eastmoney', 'sina'], 'best-priority');
    aggregator.recordSourceSelection('000001', 'sina', ['eastmoney', 'sina'], 'fallback');
    aggregator.recordSourceSelection('000002', 'eastmoney', ['eastmoney', 'sina'], 'best-priority');

    const history = aggregator.getSourceWeightHistory();
    expect(history).toHaveLength(3);
    expect(history[0].selectedSource).toBe('eastmoney');
    expect(history[1].selectedSource).toBe('sina');
  });

  // ─── T42: Source Weight History - distribution aggregation ───────────────

  it('should compute source weight distribution', () => {
    aggregator = createTestAggregator();

    aggregator.recordSourceSelection('600519', 'eastmoney', ['eastmoney'], 'best');
    aggregator.recordSourceSelection('000001', 'eastmoney', ['eastmoney'], 'best');
    aggregator.recordSourceSelection('000002', 'sina', ['sina'], 'fallback');

    const dist = aggregator.getSourceWeightDistribution();
    expect(dist['eastmoney']).toBe(2);
    expect(dist['sina']).toBe(1);
  });

  // ─── T43: Source Weight History - auto-recorded on fetchBest ─────────────

  it('should auto-record source selection on fetchBest', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );

    await aggregator.fetchBest('600519');

    const history = aggregator.getSourceWeightHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[history.length - 1].selectedSource).toBe('eastmoney');
  });

  // ─── T44: Source Weight History - clear works ────────────────────────────

  it('should clear source weight history', () => {
    aggregator = createTestAggregator();

    aggregator.recordSourceSelection('600519', 'eastmoney', ['eastmoney'], 'best');
    aggregator.recordSourceSelection('000001', 'sina', ['sina'], 'fallback');
    expect(aggregator.getSourceWeightHistory()).toHaveLength(2);

    aggregator.clearSourceWeightHistory();
    expect(aggregator.getSourceWeightHistory()).toHaveLength(0);
  });

  // ─── T45: Anomaly records are stored and clearable ───────────────────────

  it('should store and clear anomaly records', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: 500.00, volume: 1000, timestamp: Date.now(), quality: 'low' as const, confidence: 0.3 },
    ];

    aggregator.detectPriceAnomalies(points);
    expect(aggregator.getAnomalyRecords().length).toBeGreaterThan(0);

    aggregator.clearAnomalyRecords();
    expect(aggregator.getAnomalyRecords()).toHaveLength(0);
  });

  // ─── T46: toJSON includes enhancement state ──────────────────────────────

  it('should include enhancement state in toJSON snapshot', () => {
    aggregator = createTestAggregator();

    aggregator.recordSourceSelection('600519', 'eastmoney', ['eastmoney'], 'best');
    aggregator.recordLatency('eastmoney', 50);
    aggregator.recordLatency('eastmoney', 100);

    const json = aggregator.toJSON() as any;
    expect(json).toHaveProperty('sourceWeightHistory');
    expect(json).toHaveProperty('sourceWeightDistribution');
    expect(json).toHaveProperty('latencyStats');
    expect(json).toHaveProperty('validationConfig');
    expect(json.sourceWeightHistory).toHaveLength(1);
    expect(json.latencyStats['eastmoney']).toBeDefined();
    expect(json.latencyStats['eastmoney'].samples).toBe(2);
  });

  // ─── T47: getValidationConfig returns current config ─────────────────────

  it('should return current validation config', () => {
    aggregator = createTestAggregator();
    const config = aggregator.getValidationConfig();

    expect(config).toHaveProperty('minPrice');
    expect(config).toHaveProperty('maxPrice');
    expect(config).toHaveProperty('maxVolumeRatio');
    expect(config).toHaveProperty('maxTimestampAgeMs');
    expect(config.minPrice).toBeGreaterThan(0);
    expect(config.maxPrice).toBeGreaterThan(config.minPrice);
  });

  // ─── T48: validateAll returns per-point validation results ───────────────

  it('should validate all data points and return results', () => {
    aggregator = createTestAggregator();
    const points = [
      { symbol: '600519', source: 'eastmoney' as const, price: 100.00, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.9 },
      { symbol: '600519', source: 'sina' as const, price: -5, volume: 1000, timestamp: Date.now(), quality: 'high' as const, confidence: 0.8 },
    ];

    const results = aggregator.validateAll(points);
    expect(results).toHaveLength(2);
    expect(results[0].result.valid).toBe(true);
    expect(results[1].result.valid).toBe(false);
  });

  // ─── T49: clearLatencyStatsForSource clears only one source ──────────────

  it('should clear latency stats for a specific source only', () => {
    aggregator = createTestAggregator();

    aggregator.recordLatency('eastmoney', 50);
    aggregator.recordLatency('sina', 30);

    aggregator.clearLatencyStatsForSource('eastmoney');

    expect(aggregator.getLatencyStats('eastmoney')).toBeUndefined();
    expect(aggregator.getLatencyStats('sina')).toBeDefined();
    expect(aggregator.getLatencyStats('sina')!.samples).toBe(1);
  });

  // ─── T50: Latency auto-recorded during fetchBest ─────────────────────────

  it('should auto-record latency during fetchBest', async () => {
    aggregator = createTestAggregator();
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );

    await aggregator.fetchBest('600519');

    const stats = aggregator.getLatencyStats('eastmoney');
    expect(stats).toBeDefined();
    expect(stats!.samples).toBeGreaterThanOrEqual(1);
  });
});
