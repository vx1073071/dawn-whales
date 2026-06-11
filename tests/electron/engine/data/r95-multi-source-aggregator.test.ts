/**
 * R95 J-01: engine/data 覆盖率 — MultiSourceAggregator
 * 覆盖: multi-source-aggregator.ts (1399行)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MultiSourceAggregator,
  createDefaultAggregator,
  type DataPoint,
  type DataSourceConfig,
} from '../../../../electron/engine/data/multi-source-aggregator';

function makeConfig(id: any, priority: number, enabled = true): DataSourceConfig {
  return {
    id,
    name: `Source ${id}`,
    priority,
    enabled,
    timeoutMs: 1000,
    maxRetries: 0,
    healthCheckIntervalMs: 0,
  };
}

function makeDataPoint(overrides: Partial<DataPoint> = {}): DataPoint {
  return {
    symbol: 'AAPL',
    source: 'eastmoney',
    price: 150.0,
    volume: 1000000,
    timestamp: Date.now(),
    quality: 'high',
    confidence: 0.95,
    ...overrides,
  };
}

describe('MultiSourceAggregator', () => {
  let agg: MultiSourceAggregator;

  beforeEach(() => {
    agg = new MultiSourceAggregator();
  });

  afterEach(() => {
    agg.destroy();
  });

  // ── Source Management ─────────────────────────────────────────────────

  describe('addSource / removeSource', () => {
    it('should add a source', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      expect(agg.sourceCount).toBe(1);
    });

    it('should replace existing source', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      agg.addSource(makeConfig('eastmoney', 2), async () => makeDataPoint());
      expect(agg.sourceCount).toBe(1);
    });

    it('should remove a source', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      expect(agg.removeSource('eastmoney')).toBe(true);
      expect(agg.sourceCount).toBe(0);
    });

    it('should return false for removing non-existent source', () => {
      expect(agg.removeSource('nope' as any)).toBe(false);
    });
  });

  describe('setSourceEnabled / getSourceConfig / getSourceIds', () => {
    it('should toggle enabled', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      agg.setSourceEnabled('eastmoney', false);
      expect(agg.getSourceConfig('eastmoney')?.enabled).toBe(false);
    });

    it('should return false for non-existent source toggle', () => {
      expect(agg.setSourceEnabled('nope' as any, false)).toBe(false);
    });

    it('should get source config', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      expect(agg.getSourceConfig('eastmoney')?.id).toBe('eastmoney');
    });

    it('should return undefined for non-existent config', () => {
      expect(agg.getSourceConfig('nope' as any)).toBeUndefined();
    });

    it('should get source ids', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      agg.addSource(makeConfig('sina', 2), async () => makeDataPoint());
      expect(agg.getSourceIds()).toEqual(['eastmoney', 'sina']);
    });
  });

  // ── Fetching ──────────────────────────────────────────────────────────

  describe('fetchBest', () => {
    it('should fetch from best source', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async (sym) => makeDataPoint({ symbol: sym, source: 'eastmoney', price: 150 }));
      agg.addSource(makeConfig('sina', 2), async (sym) => makeDataPoint({ symbol: sym, source: 'sina', price: 149 }));
      const dp = await agg.fetchBest('AAPL');
      expect(dp.source).toBe('eastmoney');
    });

    it('should fallback to lower priority source', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => { throw new Error('fail'); });
      agg.addSource(makeConfig('sina', 2), async (sym) => makeDataPoint({ symbol: sym, source: 'sina', price: 149 }));
      const dp = await agg.fetchBest('AAPL');
      expect(dp.source).toBe('sina');
    });

    it('should throw when all sources fail', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => { throw new Error('fail'); });
      await expect(agg.fetchBest('AAPL')).rejects.toThrow('All sources failed');
    });

    it('should throw when no sources available', async () => {
      await expect(agg.fetchBest('AAPL')).rejects.toThrow('No enabled sources');
    });

    it('should skip disabled sources', async () => {
      agg.addSource(makeConfig('eastmoney', 1, false), async () => makeDataPoint());
      await expect(agg.fetchBest('AAPL')).rejects.toThrow('No enabled sources');
    });
  });

  describe('fetchAll', () => {
    it('should fetch from all sources and compute consensus', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async (sym) => makeDataPoint({ symbol: sym, source: 'eastmoney', price: 150 }));
      agg.addSource(makeConfig('sina', 2), async (sym) => makeDataPoint({ symbol: sym, source: 'sina', price: 151 }));
      const result = await agg.fetchAll('AAPL');
      expect(result.allSources.length).toBe(2);
      expect(result.consensus).toBeGreaterThan(0);
    });

    it('should throw when all sources fail', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => { throw new Error('fail'); });
      await expect(agg.fetchAll('AAPL')).rejects.toThrow();
    });

    it('should throw when no sources', async () => {
      await expect(agg.fetchAll('AAPL')).rejects.toThrow();
    });
  });

  // ── Consensus ─────────────────────────────────────────────────────────

  describe('getConsensus', () => {
    it('should return 1 for single source', () => {
      expect(agg.getConsensus([makeDataPoint()])).toBe(1);
    });

    it('should return 0 for empty array', () => {
      expect(agg.getConsensus([])).toBe(0);
    });

    it('should return high consensus for similar prices', () => {
      const points = [
        makeDataPoint({ price: 150, quality: 'high' }),
        makeDataPoint({ price: 150.5, quality: 'high', source: 'sina' }),
      ];
      expect(agg.getConsensus(points)).toBeGreaterThan(0.9);
    });

    it('should return low consensus for divergent prices', () => {
      const points = [
        makeDataPoint({ price: 100, quality: 'high' }),
        makeDataPoint({ price: 200, quality: 'high', source: 'sina' }),
      ];
      expect(agg.getConsensus(points)).toBeLessThan(0.5);
    });

    it('should filter out unavailable quality', () => {
      const points = [
        makeDataPoint({ price: 150, quality: 'unavailable' }),
        makeDataPoint({ price: 150, quality: 'high', source: 'sina' }),
      ];
      expect(agg.getConsensus(points)).toBe(1); // only one valid
    });

    it('should return 0 for all unavailable', () => {
      const points = [
        makeDataPoint({ quality: 'unavailable' }),
        makeDataPoint({ quality: 'unavailable', source: 'sina' }),
      ];
      expect(agg.getConsensus(points)).toBe(0);
    });
  });

  // ── Price Spread ──────────────────────────────────────────────────────

  describe('getPriceSpread', () => {
    it('should calculate spread', () => {
      const points = [
        makeDataPoint({ price: 100 }),
        makeDataPoint({ price: 110, source: 'sina' }),
      ];
      const spread = agg.getPriceSpread(points);
      expect(spread.min).toBe(100);
      expect(spread.max).toBe(110);
      expect(spread.spread).toBe(10);
      expect(spread.spreadPct).toBe(10);
    });

    it('should return zeros for empty array', () => {
      const spread = agg.getPriceSpread([]);
      expect(spread.spread).toBe(0);
    });
  });

  // ── Health ────────────────────────────────────────────────────────────

  describe('health monitoring', () => {
    it('should get health of all sources', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      const health = agg.getHealth();
      expect(health.length).toBe(1);
      expect(health[0].status).toBe('healthy');
    });

    it('should get single source health', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      expect(agg.getSourceHealth('eastmoney')?.status).toBe('healthy');
    });

    it('should return undefined for non-existent source health', () => {
      expect(agg.getSourceHealth('nope' as any)).toBeUndefined();
    });

    it('should reset health', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      agg.resetHealth('eastmoney');
      expect(agg.getSourceHealth('eastmoney')?.errorCount).toBe(0);
    });

    it('should return false for resetting non-existent source', () => {
      expect(agg.resetHealth('nope' as any)).toBe(false);
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────

  describe('statistics', () => {
    it('should get source stats', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      const stats = agg.getSourceStats();
      expect(stats.eastmoney).toBeDefined();
      expect(stats.eastmoney.requests).toBe(0);
    });

    it('should get single source stats', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      expect(agg.getSingleSourceStats('eastmoney')?.requests).toBe(0);
    });

    it('should return undefined for non-existent stats', () => {
      expect(agg.getSingleSourceStats('nope' as any)).toBeUndefined();
    });

    it('should get overall error rate', () => {
      expect(agg.getOverallErrorRate()).toBe(0);
    });

    it('should get stats summary', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      agg.addSource(makeConfig('sina', 2, false), async () => makeDataPoint());
      const summary = agg.getStatsSummary();
      expect(summary.totalSources).toBe(2);
      expect(summary.enabledSources).toBe(1);
    });
  });

  // ── Deduplication ─────────────────────────────────────────────────────

  describe('deduplicateDataPoints', () => {
    it('should remove duplicates', () => {
      const points = [
        makeDataPoint({ price: 150 }),
        makeDataPoint({ price: 150.0005 }),
        makeDataPoint({ price: 200, source: 'sina' }),
      ];
      const deduped = agg.deduplicateDataPoints(points);
      expect(deduped.length).toBe(2);
    });

    it('should keep single point', () => {
      expect(agg.deduplicateDataPoints([makeDataPoint()]).length).toBe(1);
    });

    it('should handle empty', () => {
      expect(agg.deduplicateDataPoints([]).length).toBe(0);
    });

    it('should count duplicates', () => {
      const points = [
        makeDataPoint({ price: 150 }),
        makeDataPoint({ price: 150.0005 }),
      ];
      expect(agg.countDuplicates(points)).toBe(1);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────

  describe('validateDataPoint', () => {
    it('should validate a good data point', () => {
      const r = agg.validateDataPoint(makeDataPoint());
      expect(r.valid).toBe(true);
    });

    it('should reject zero price', () => {
      const r = agg.validateDataPoint(makeDataPoint({ price: 0 }));
      expect(r.valid).toBe(false);
    });

    it('should reject negative price', () => {
      const r = agg.validateDataPoint(makeDataPoint({ price: -1 }));
      expect(r.valid).toBe(false);
    });

    it('should reject negative volume', () => {
      const r = agg.validateDataPoint(makeDataPoint({ volume: -100 }));
      expect(r.valid).toBe(false);
    });

    it('should warn on stale timestamp', () => {
      const r = agg.validateDataPoint(makeDataPoint({ timestamp: Date.now() - 600000 }));
      expect(r.warnings.length).toBeGreaterThan(0);
    });

    it('should reject future timestamp', () => {
      const r = agg.validateDataPoint(makeDataPoint({ timestamp: Date.now() + 120000 }));
      expect(r.valid).toBe(false);
    });

    it('should reject out-of-range confidence', () => {
      const r = agg.validateDataPoint(makeDataPoint({ confidence: 1.5 }));
      expect(r.valid).toBe(false);
    });
  });

  describe('validateAll / filterValid', () => {
    it('should validate all points', () => {
      const results = agg.validateAll([makeDataPoint(), makeDataPoint({ price: -1, source: 'sina' })]);
      expect(results.length).toBe(2);
      expect(results[0].result.valid).toBe(true);
      expect(results[1].result.valid).toBe(false);
    });

    it('should filter valid points', () => {
      const filtered = agg.filterValid([makeDataPoint(), makeDataPoint({ price: -1, source: 'sina' })]);
      expect(filtered.length).toBe(1);
    });
  });

  // ── Anomaly Detection ─────────────────────────────────────────────────

  describe('detectPriceAnomalies', () => {
    it('should detect price anomalies', () => {
      const points = [
        makeDataPoint({ price: 150 }),
        makeDataPoint({ price: 151, source: 'sina' }),
        makeDataPoint({ price: 149, source: 'tencent' }),
        makeDataPoint({ price: 150.5, source: 'xueqiu' }),
      ];
      const anomalies = agg.detectPriceAnomalies(points, 2.0);
      expect(anomalies.length).toBe(4);
      // With similar prices, none should be flagged
      const flagged = anomalies.filter(a => a.flagged);
      expect(flagged.length).toBe(0);
    });

    it('should flag extreme outlier', () => {
      const points = [
        makeDataPoint({ price: 100 }),
        makeDataPoint({ price: 100, source: 'sina' }),
        makeDataPoint({ price: 100, source: 'tencent' }),
        makeDataPoint({ price: 1000, source: 'xueqiu' }),
      ];
      const anomalies = agg.detectPriceAnomalies(points, 1.5);
      const flagged = anomalies.filter(a => a.flagged);
      expect(flagged.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for single point', () => {
      expect(agg.detectPriceAnomalies([makeDataPoint()]).length).toBe(0);
    });

    it('should return empty for identical prices', () => {
      const points = [makeDataPoint({ price: 100 }), makeDataPoint({ price: 100, source: 'sina' })];
      expect(agg.detectPriceAnomalies(points).length).toBe(0);
    });
  });

  describe('detectAnomaliesIQR', () => {
    it('should detect IQR outliers', () => {
      const points = [
        makeDataPoint({ price: 100 }),
        makeDataPoint({ price: 101, source: 'sina' }),
        makeDataPoint({ price: 102, source: 'tencent' }),
        makeDataPoint({ price: 103, source: 'xueqiu' }),
        makeDataPoint({ price: 500, source: 'eastmoney' }),
      ];
      const anomalies = agg.detectAnomaliesIQR(points);
      expect(anomalies.some(a => a.flagged)).toBe(true);
    });

    it('should return empty for less than 4 points', () => {
      expect(agg.detectAnomaliesIQR([makeDataPoint(), makeDataPoint()]).length).toBe(0);
    });
  });

  // ── Anomaly Records ───────────────────────────────────────────────────

  describe('anomaly records', () => {
    it('should store and retrieve anomaly records', () => {
      agg.detectPriceAnomalies([
        makeDataPoint({ price: 100 }),
        makeDataPoint({ price: 500, source: 'sina' }),
      ]);
      expect(agg.getAnomalyRecords().length).toBe(2);
    });

    it('should clear anomaly records', () => {
      agg.detectPriceAnomalies([
        makeDataPoint({ price: 100 }),
        makeDataPoint({ price: 500, source: 'sina' }),
      ]);
      agg.clearAnomalyRecords();
      expect(agg.getAnomalyRecords().length).toBe(0);
    });
  });

  // ── Source Weight History ─────────────────────────────────────────────

  describe('source weight history', () => {
    it('should record and retrieve', () => {
      agg.recordSourceSelection('AAPL', 'eastmoney', ['eastmoney', 'sina']);
      expect(agg.getSourceWeightHistory().length).toBe(1);
    });

    it('should get distribution', () => {
      agg.recordSourceSelection('AAPL', 'eastmoney', ['eastmoney', 'sina']);
      agg.recordSourceSelection('MSFT', 'eastmoney', ['eastmoney', 'sina']);
      const dist = agg.getSourceWeightDistribution();
      expect(dist.eastmoney).toBe(2);
    });

    it('should clear history', () => {
      agg.recordSourceSelection('AAPL', 'eastmoney', ['eastmoney']);
      agg.clearSourceWeightHistory();
      expect(agg.getSourceWeightHistory().length).toBe(0);
    });
  });

  // ── Latency Tracking ─────────────────────────────────────────────────

  describe('latency tracking', () => {
    it('should record and get latency stats', () => {
      for (let i = 0; i < 10; i++) {
        agg.recordLatency('eastmoney', 50 + i * 10);
      }
      const stats = agg.getLatencyStats('eastmoney');
      expect(stats).toBeDefined();
      expect(stats!.samples).toBe(10);
      expect(stats!.p50).toBeGreaterThan(0);
    });

    it('should return undefined for no samples', () => {
      expect(agg.getLatencyStats('nope' as any)).toBeUndefined();
    });

    it('should get all latency stats', () => {
      agg.recordLatency('eastmoney', 50);
      agg.recordLatency('sina', 100);
      const all = agg.getAllLatencyStats();
      expect(Object.keys(all).length).toBe(2);
    });

    it('should clear latency stats', () => {
      agg.recordLatency('eastmoney', 50);
      agg.clearLatencyStats();
      expect(agg.getAllLatencyStats()).toEqual({});
    });

    it('should clear per-source', () => {
      agg.recordLatency('eastmoney', 50);
      agg.clearLatencyStatsForSource('eastmoney');
      expect(agg.getLatencyStats('eastmoney')).toBeUndefined();
    });
  });

  // ── Batch Fetch ───────────────────────────────────────────────────────

  describe('batchFetch', () => {
    it('should batch fetch multiple symbols', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async (sym) => makeDataPoint({ symbol: sym, source: 'eastmoney' }));
      const results = await agg.batchFetch(['AAPL', 'MSFT', 'GOOG']);
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle empty symbols', async () => {
      const results = await agg.batchFetch([]);
      expect(results.length).toBe(0);
    });

    it('should handle partial failures', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async (sym) => {
        if (sym === 'FAIL') throw new Error('fail');
        return makeDataPoint({ symbol: sym, source: 'eastmoney' });
      });
      const results = await agg.batchFetch(['AAPL', 'FAIL']);
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  // ── fetchAllWithDedup ─────────────────────────────────────────────────

  describe('fetchAllWithDedup', () => {
    it('should fetch with dedup and validation', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async (sym) => makeDataPoint({ symbol: sym, source: 'eastmoney', price: 150 }));
      agg.addSource(makeConfig('sina', 2), async (sym) => makeDataPoint({ symbol: sym, source: 'sina', price: 150.0001 }));
      const result = await agg.fetchAllWithDedup('AAPL');
      expect(result.duplicatesRemoved).toBeGreaterThanOrEqual(0);
      expect(result.validationResults.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Validation Config ─────────────────────────────────────────────────

  describe('validation config', () => {
    it('should get config', () => {
      const cfg = agg.getValidationConfig();
      expect(cfg.minPrice).toBe(0.001);
    });

    it('should set config', () => {
      agg.setValidationConfig({ minPrice: 1 });
      expect(agg.getValidationConfig().minPrice).toBe(1);
    });
  });

  // ── toJSON ────────────────────────────────────────────────────────────

  describe('toJSON', () => {
    it('should serialize state', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      const json = agg.toJSON() as any;
      expect(json.sources.length).toBe(1);
      expect(json.validationConfig).toBeDefined();
    });
  });

  // ── Factory ───────────────────────────────────────────────────────────

  describe('createDefaultAggregator', () => {
    it('should create with 4 default sources', () => {
      const d = createDefaultAggregator();
      expect(d.sourceCount).toBe(4);
      d.destroy();
    });
  });

  // ── Destroy ───────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('should clear all sources and listeners', () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      agg.destroy();
      expect(agg.sourceCount).toBe(0);
    });
  });

  // ── checkAllSources ───────────────────────────────────────────────────

  describe('checkAllSources', () => {
    it('should run health checks on all sources', async () => {
      agg.addSource(makeConfig('eastmoney', 1), async () => makeDataPoint());
      const health = await agg.checkAllSources();
      expect(health.length).toBe(1);
    });
  });
});
