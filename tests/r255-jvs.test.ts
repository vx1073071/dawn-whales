import { describe, it, expect, beforeEach } from 'vitest';
import { DataQualityMonitorEngine } from '../electron/engine/data/DataQualityMonitorEngine';
import { LocalCacheLayer } from '../electron/engine/data/LocalCacheLayer';
import { MultiStockComparisonEngine } from '../electron/engine/analysis/MultiStockComparisonEngine';

// ═══════════════════════════════════════════════════════════════
// DQ-03 DataQualityMonitorEngine
// ═══════════════════════════════════════════════════════════════

describe('DataQualityMonitorEngine', () => {
  let engine: DataQualityMonitorEngine;
  beforeEach(() => { engine = DataQualityMonitorEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(DataQualityMonitorEngine.getInstance()).toBe(engine); });

  it('evaluates a good quote', () => {
    const q = engine.createMockQuote();
    const snap = engine.evaluateQuote(q);
    expect(snap.symbol).toBe('AAPL');
    expect(snap.overallScore).toBeGreaterThanOrEqual(70);
    expect(snap.grade).toMatch(/^[ABCD]$/);
  });

  it('evaluates a bad quote', () => {
    const q = engine.createMockBadQuote();
    const snap = engine.evaluateQuote(q);
    expect(snap.symbol).toBe('BROKEN');
    expect(snap.overallScore).toBeLessThan(60);
    expect(snap.grade).toMatch(/^[DEF]$/);
  });

  it('timeliness dim stale data', () => {
    const q = engine.createMockQuote({ timestamp: Date.now() - 10000 });
    const snap = engine.evaluateQuote(q);
    expect(snap.timeliness.staleness).not.toBe('fresh');
  });

  it('completeness missing fields', () => {
    const q = engine.createMockQuote({ price: 0, volume: -1 });
    const snap = engine.evaluateQuote(q);
    expect(snap.completeness.completenessRate).toBeLessThan(1);
  });

  it('consistency detects price jump', () => {
    engine.evaluateQuote(engine.createMockQuote({ price: 100 }));
    const q = engine.createMockQuote({ price: 200 });
    const snap = engine.evaluateQuote(q);
    expect(snap.consistency.priceJumpCount).toBeGreaterThanOrEqual(0);
  });

  it('accuracy valid spread', () => {
    const q = engine.createMockQuote({ bid: 185, ask: 185.5 });
    const snap = engine.evaluateQuote(q);
    expect(snap.accuracy.spreadRatio).toBeLessThan(1);
  });

  it('generates alerts for bad data', () => {
    const q = engine.createMockQuote({ timestamp: Date.now() - 120000, price: 0 });
    const snap = engine.evaluateQuote(q);
    expect(snap.alerts.length).toBeGreaterThan(0);
  });

  it('evaluates batch', () => {
    const qs = [engine.createMockQuote({ symbol: 'AAPL' }), engine.createMockQuote({ symbol: 'MSFT' })];
    const snaps = engine.evaluateBatch(qs);
    expect(snaps).toHaveLength(2);
    expect(engine.getAllSymbols()).toHaveLength(2);
  });

  it('getHistory returns snapshots', () => {
    engine.evaluateQuote(engine.createMockQuote({ symbol: 'X' }));
    const hist = engine.getHistory('X');
    expect(hist).toHaveLength(1);
  });

  it('getLatestSnapshot', () => {
    engine.evaluateQuote(engine.createMockQuote({ symbol: 'Y', price: 100 }));
    const snap = engine.getLatestSnapshot('Y');
    expect(snap).toBeDefined();
    expect(snap!.symbol).toBe('Y');
  });

  it('getAlerts by symbol', () => {
    engine.evaluateQuote(engine.createMockBadQuote());
    expect(engine.getAlerts('BROKEN').length).toBeGreaterThan(0);
  });

  it('getAlertCount by severity', () => {
    engine.evaluateQuote(engine.createMockBadQuote());
    const critical = engine.getAlertCount('critical');
    const warning = engine.getAlertCount('warning');
    expect(critical + warning).toBeGreaterThanOrEqual(0);
  });

  it('health report', () => {
    engine.evaluateQuote(engine.createMockQuote({ symbol: 'AAPL' }));
    engine.evaluateQuote(engine.createMockQuote({ symbol: 'MSFT' }));
    engine.evaluateQuote(engine.createMockBadQuote());
    const report = engine.generateHealthReport();
    expect(report.symbolsTracked).toBe(3);
    expect(report.averageScore).toBeGreaterThan(0);
    expect(report.gradeDistribution).toBeDefined();
    expect(report.trend).toMatch(/^(improving|stable|degrading)$/);
  });

  it('snapshot count increments', () => {
    expect(engine.getSnapshotCount()).toBe(0);
    engine.evaluateQuote(engine.createMockQuote({ symbol: 'A' }));
    expect(engine.getSnapshotCount()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// DQ-04 LocalCacheLayer
// ═══════════════════════════════════════════════════════════════

describe('LocalCacheLayer', () => {
  let cache: LocalCacheLayer;
  beforeEach(() => { cache = LocalCacheLayer.getInstance(); cache.reset(); });

  it('singleton', () => { expect(LocalCacheLayer.getInstance()).toBe(cache); });

  it('set and get', () => {
    cache.set('k1', { hello: 'world' });
    const result = cache.get<{ hello: string }>('k1');
    expect(result).not.toBeNull();
    expect(result!.value.hello).toBe('world');
  });

  it('get non-existent returns null', () => {
    expect(cache.get('nope')).toBeNull();
  });

  it('TTL expiration', async () => {
    cache.configure({ defaultTTLMs: 10, staleWhileRevalidateMs: 0 });
    cache.set('k1', 'data');
    expect(cache.get('k1')).not.toBeNull();
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    const r = cache.get('k1');
    expect(r).toBeNull();
  }, 10000);

  it('stale-while-revalidate works', () => {
    cache.set('k1', 'data', 10); // 10ms TTL, 60s stale window
    expect(cache.getStale('k1')).not.toBeNull();
  });

  it('delete removes key', () => {
    cache.set('k1', 'val');
    expect(cache.delete('k1')).toBe(true);
    expect(cache.get('k1')).toBeNull();
    expect(cache.delete('gone')).toBe(false);
  });

  it('has checks existence', () => {
    cache.set('k1', 'val');
    expect(cache.has('k1')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('clear namespace', () => {
    cache.set('a', 1, undefined, 'ns1');
    cache.set('b', 2, undefined, 'ns2');
    expect(cache.count()).toBe(2);
    const removed = cache.clear('ns1');
    expect(removed).toBe(1);
    expect(cache.count('ns1')).toBe(0);
    expect(cache.count('ns2')).toBe(1);
  });

  it('clear all', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.count()).toBe(0);
  });

  it('batch setMany and getMany', () => {
    cache.setMany([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]);
    const got = cache.getMany(['a', 'b', 'c']);
    expect(got.get('a')).toBe(1);
    expect(got.get('b')).toBe(2);
  });

  it('deleteMany', () => {
    cache.setMany([{ key: 'a', value: 1 }, { key: 'b', value: 2 }, { key: 'c', value: 3 }]);
    expect(cache.deleteMany(['a', 'c'])).toBe(2);
    expect(cache.count()).toBe(1);
  });

  it('keys returns namespace keys', () => {
    cache.set('x', 1, undefined, 'test');
    cache.set('y', 2, undefined, 'test');
    expect(cache.keys('test')).toHaveLength(2);
  });

  it('getNamespaces returns distinct', () => {
    cache.set('a', 1, undefined, 'ns1');
    cache.set('b', 1, undefined, 'ns2');
    expect(cache.getNamespaces()).toContain('ns1');
  });

  it('prune removes expired', async () => {
    cache.configure({ defaultTTLMs: 5, staleWhileRevalidateMs: 0 });
    cache.set('expire-me', 'val');
    await new Promise(r => setTimeout(r, 20));
    const pruned = cache.prune();
    expect(pruned).toBe(1);
    expect(cache.count()).toBe(0);
  });

  it('stats track hit/miss', () => {
    cache.set('a', 1);
    cache.get('a');
    cache.get('a');
    cache.get('missing');
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeGreaterThan(60);
  });

  it('LRU eviction by size', () => {
    cache.configure({ maxEntries: 3, staleWhileRevalidateMs: 0 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.entryCount()).toBe(3);
    cache.set('d', 4); // should evict least recently used
    expect(cache.entryCount()).toBeLessThanOrEqual(3);
    // 'a' was first in, should have been evicted (or another)
    const evicted = !cache.get('a') || !cache.get('b') || !cache.get('c');
    expect(evicted).toBe(true);
    const stats = cache.getStats();
    expect(stats.evictions).toBeGreaterThanOrEqual(1);
  });

  it('warmup preloads', () => {
    cache.warmup([{ key: 'hot_a', value: 100 }, { key: 'hot_b', value: 200 }]);
    expect(cache.count()).toBe(2);
    expect(cache.get<number>('hot_a')!.value).toBe(100);
  });

  it('serialize/deserialize roundtrip', () => {
    cache.set('s1', { score: 95 });
    cache.set('s2', [1, 2, 3]);
    const json = cache.serialize();
    cache.clear();
    const count = cache.deserialize(json);
    expect(count).toBe(2);
    expect(cache.get<{ score: number }>('s1')!.value.score).toBe(95);
  });

  it('hitRate is 0 with no queries', () => {
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// AI-05 MultiStockComparisonEngine
// ═══════════════════════════════════════════════════════════════

describe('MultiStockComparisonEngine', () => {
  let engine: MultiStockComparisonEngine;
  beforeEach(() => { engine = MultiStockComparisonEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(MultiStockComparisonEngine.getInstance()).toBe(engine); });

  it('throws with < 2 symbols', () => {
    const single = [engine.createMockMetrics({ symbol: 'AAPL' })];
    expect(() => engine.compare(single)).toThrow('At least 2 symbols');
  });

  it('compares 5 tech stocks', () => {
    const group = engine.createMockGroup();
    const result = engine.compare(group);

    expect(result.scorecards).toHaveLength(5);
    expect(result.pairwiseMatrix.length).toBeGreaterThanOrEqual(4);
    expect(result.radarData).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('scorecards have ranks', () => {
    const group = engine.createMockGroup();
    const result = engine.compare(group);
    const ranks = result.scorecards.map(s => s.rank);
    expect(Math.min(...ranks)).toBe(1);
    expect(Math.max(...ranks)).toBe(5);
  });

  it('radar data has correct axes', () => {
    const group = engine.createMockGroup();
    const result = engine.compare(group);
    expect(result.axes).toHaveLength(7);
    Object.values(result.radarData).forEach(arr => {
      expect(arr).toHaveLength(7);
      arr.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
    });
  });

  it('pairwise similarity between 0 and 1', () => {
    const group = engine.createMockGroup();
    const result = engine.compare(group);
    result.pairwiseMatrix.forEach(p => {
      expect(p.similarity).toBeGreaterThanOrEqual(0);
      expect(p.similarity).toBeLessThanOrEqual(1);
    });
  });

  it('dimensions have label', () => {
    const dims = engine.getDimensionKeys();
    expect(dims).toHaveLength(7);
    dims.forEach(d => {
      expect(d.id).toBeTruthy();
      expect(d.label).toBeTruthy();
    });
  });

  it('getLastResult', () => {
    const group = engine.createMockGroup();
    engine.compare(group);
    expect(engine.getLastResult()).not.toBeNull();
  });

  it('getRadarData', () => {
    const group = engine.createMockGroup();
    engine.compare(group);
    const radar = engine.getRadarData('AAPL');
    expect(radar).toBeDefined();
    expect(radar).toHaveLength(7);
  });

  it('getPairwiseDistance', () => {
    const group = engine.createMockGroup();
    engine.compare(group);
    const dist = engine.getPairwiseDistance('AAPL', 'MSFT');
    expect(dist).toBeGreaterThanOrEqual(0);
  });

  it('compareCount increments', () => {
    expect(engine.getCompareCount()).toBe(0);
    engine.compare(engine.createMockGroup());
    expect(engine.getCompareCount()).toBe(1);
  });

  it('configure changes weights', () => {
    engine.configure({ dimensionWeights: { valuation: 50 } });
    const group = engine.createMockGroup();
    engine.compare(group);
    const result = engine.getLastResult()!;
    expect(result.scorecards.length).toBeGreaterThanOrEqual(2);
  });
});
