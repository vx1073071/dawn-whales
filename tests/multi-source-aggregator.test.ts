/**
 * J-41-01: MultiSourceAggregator Activation Tests
 * Tests the activated MultiSourceAggregator with 4 data sources:
 * EastMoney (东方财富), Sina Finance (新浪财经), Tencent Finance (腾讯财经), Xueqiu (雪球)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MultiSourceAggregator,
  createDefaultAggregator,
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

describe('J-41-01: MultiSourceAggregator Activation', () => {
  let aggregator: MultiSourceAggregator;

  beforeEach(() => {
    vi.useFakeTimers();
    aggregator = createDefaultAggregator();
  });

  afterEach(() => {
    aggregator.destroy();
    vi.useRealTimers();
  });

  // ─── T1: Default 4 sources registered ─────────────────────────────────────

  it('should register 4 default data sources', () => {
    const ids = aggregator.getSourceIds();
    expect(ids).toHaveLength(4);
    expect(ids).toContain('eastmoney');
    expect(ids).toContain('sina');
    expect(ids).toContain('tencent');
    expect(ids).toContain('xueqiu');
  });

  // ─── T2: Sources have correct priority ordering ────────────────────────────

  it('should have correct priority ordering (eastmoney=1, sina=2, tencent=3, xueqiu=4)', () => {
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
    const stats = aggregator.getStatsSummary();
    expect(stats.totalSources).toBe(4);
    expect(stats.enabledSources).toBe(4);
  });

  // ─── T4: fetchBest uses highest priority source ───────────────────────────

  it('should fetchBest from highest priority source (eastmoney)', async () => {
    // Replace all fetchers with mocks
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.source).toBe('eastmoney');
    expect(result.price).toBe(100);
  });

  // ─── T5: fetchBest falls back when primary fails ──────────────────────────

  it('should fallback to sina when eastmoney fails', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', {}, true) // fail
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.source).toBe('sina');
    expect(result.price).toBe(101);
  });

  // ─── T6: fetchBest falls back through multiple failures ───────────────────

  it('should fallback through multiple failures to xueqiu', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('tencent')! },
      createMockFetcher('tencent', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('xueqiu')! },
      createMockFetcher('xueqiu', { price: 99, source: 'xueqiu' })
    );

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.source).toBe('xueqiu');
  });

  // ─── T7: fetchBest throws when all sources fail ───────────────────────────

  it('should throw when all sources fail', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('tencent')! },
      createMockFetcher('tencent', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('xueqiu')! },
      createMockFetcher('xueqiu', {}, true)
    );

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    await expect(promise).rejects.toThrow(/All sources failed/);
  });

  // ─── T8: setSourceEnabled disables a source ───────────────────────────────

  it('should skip disabled sources in fetchBest', async () => {
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

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    // Should use sina since eastmoney is disabled
    expect(result.source).toBe('sina');
  });

  // ─── T9: setSourceEnabled re-enables a source ─────────────────────────────

  it('should use re-enabled source in fetchBest', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );

    aggregator.setSourceEnabled('eastmoney', false);
    aggregator.setSourceEnabled('eastmoney', true);

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.source).toBe('eastmoney');
  });

  // ─── T10: removeSource removes a source ───────────────────────────────────

  it('should remove a source and not use it', async () => {
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

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.source).toBe('sina');
  });

  // ─── T11: getStatsSummary tracks requests ─────────────────────────────────

  it('should track request counts in getStatsSummary', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100 })
    );

    const p1 = aggregator.fetchBest('600519');
    vi.runAllTimers();
    await p1;

    const p2 = aggregator.fetchBest('000001');
    vi.runAllTimers();
    await p2;

    const stats = aggregator.getStatsSummary();
    expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    expect(stats.totalErrors).toBe(0);
  });

  // ─── T12: getStatsSummary tracks errors ───────────────────────────────────

  it('should track error counts in getStatsSummary', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101 })
    );

    const p = aggregator.fetchBest('600519');
    vi.runAllTimers();
    await p;

    const stats = aggregator.getStatsSummary();
    expect(stats.totalErrors).toBeGreaterThanOrEqual(1);
  });

  // ─── T13: fetchAll returns data from all sources ──────────────────────────

  it('should fetchAll from all enabled sources', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100, source: 'eastmoney' })
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' })
    );

    const promise = aggregator.fetchAll('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.best).toBeDefined();
    expect(result.consensus).toBeDefined();
    expect(result.dataPoints.length).toBeGreaterThanOrEqual(1);
  });

  // ─── T14: timeout handling ────────────────────────────────────────────────

  it('should timeout slow sources and fallback', async () => {
    // eastmoney has 5000ms timeout, make it take longer
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100 }, false, 10000) // 10s delay
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101, source: 'sina' }, false, 0)
    );

    const promise = aggregator.fetchBest('600519');
    vi.advanceTimersByTime(6000); // past eastmoney's 5s timeout
    const result = await promise;

    // Should have fallen back to sina due to timeout
    expect(result.source).toBe('sina');
  });

  // ─── T15: retry on transient failure ──────────────────────────────────────

  it('should retry on transient failure', async () => {
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

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    const result = await promise;

    expect(result.price).toBe(100);
    expect(attempt).toBe(2); // first fail + retry success
  });

  // ─── T16: health check degrades source after errors ───────────────────────

  it('should degrade source health after repeated errors', async () => {
    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', {}, true)
    );
    aggregator.addSource(
      { ...aggregator.getSourceConfig('sina')! },
      createMockFetcher('sina', { price: 101 })
    );

    // Make several failing requests
    for (let i = 0; i < 3; i++) {
      const p = aggregator.fetchBest('600519');
      vi.runAllTimers();
      await p;
    }

    const stats = aggregator.getStatsSummary();
    // After errors, some sources should be degraded or unavailable
    expect(stats.degradedSources + stats.unavailableSources).toBeGreaterThanOrEqual(1);
  });

  // ─── T17: destroy cleans up ───────────────────────────────────────────────

  it('should clean up on destroy', () => {
    const freshAggregator = createDefaultAggregator();
    expect(freshAggregator.getSourceIds()).toHaveLength(4);

    freshAggregator.destroy();
    expect(freshAggregator.getSourceIds()).toHaveLength(0);
  });

  // ─── T18: toJSON produces valid snapshot ──────────────────────────────────

  it('should produce valid JSON snapshot', () => {
    const json = aggregator.toJSON();
    expect(json).toHaveProperty('sources');
    expect(Array.isArray(json.sources)).toBe(true);
    expect(json.sources).toHaveLength(4);
  });

  // ─── T19: emit events on fetch success/failure ────────────────────────────

  it('should emit fetch-success event', async () => {
    const handler = vi.fn();
    aggregator.on('fetch-success', handler);

    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', { price: 100 })
    );

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    await promise;

    expect(handler).toHaveBeenCalled();
  });

  // ─── T20: emit events on fetch failure ────────────────────────────────────

  it('should emit fetch-error event when all fail', async () => {
    const handler = vi.fn();
    aggregator.on('fetch-error', handler);

    aggregator.addSource(
      { ...aggregator.getSourceConfig('eastmoney')! },
      createMockFetcher('eastmoney', {}, true)
    );

    const promise = aggregator.fetchBest('600519');
    vi.runAllTimers();
    await promise.catch(() => {});

    expect(handler).toHaveBeenCalled();
  });
});
