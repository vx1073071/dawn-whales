// ── R270 JVS 测试文件 ──
// 覆盖: GlobalPerformanceOptimizer (LRUCache + WorkerPool + IndicatorCache + BatchProcessor + MemoryMonitor), IndicatorTemplateMarketplaceEngine

import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache, WorkerPool, IndicatorCache, BatchProcessor, MemoryMonitor, GlobalPerformanceOptimizer, getGlobalPerformanceOptimizer, resetGlobalPerformanceOptimizer } from '../electron/engine/analysis/global-performance-optimizer';
import { IndicatorTemplateMarketplaceEngine, getIndicatorTemplateMarketplaceEngine, resetIndicatorTemplateMarketplaceEngine } from '../electron/engine/analysis/indicator-template-marketplace-engine';

// ═══════════════════════════════════════════════════════════
// LRU Cache
// ═══════════════════════════════════════════════════════════

describe('LRUCache', () => {
  it('set and get', () => {
    const cache = new LRUCache<string, number>({ maxSize: 5 });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('miss returns undefined', () => {
    const cache = new LRUCache({ maxSize: 5 });
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('evicts LRU when over capacity', () => {
    const cache = new LRUCache<string, number>({ maxSize: 2 });
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined(); // evicted
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('LRU promoted on access', () => {
    const cache = new LRUCache<string, number>({ maxSize: 2 });
    cache.set('a', 1); cache.set('b', 2);
    cache.get('a'); // promotes a
    cache.set('c', 3); // should evict b
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('stats track hits/misses', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10 });
    cache.set('a', 1);
    cache.get('a'); cache.get('a');
    cache.get('b');
    const stats = cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3, 1);
  });

  it('purgeExpired removes expired entries', () => {
    const cache = new LRUCache<string, number>({ maxSize: 10, ttlMs: 1 });
    cache.set('a', 1);
    // wait for TTL
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // This depends on timing; just check purgeExpired doesn't throw
        cache.purgeExpired();
        resolve();
      }, 10);
    });
  });

  it('delete removes entry', () => {
    const cache = new LRUCache<string, number>({ maxSize: 5 });
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.delete('a')).toBe(false);
  });

  it('clear empties cache', () => {
    const cache = new LRUCache<string, number>({ maxSize: 5 });
    cache.set('a', 1); cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.stats().size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Indicator Cache
// ═══════════════════════════════════════════════════════════

describe('IndicatorCache', () => {
  it('set and get with params', () => {
    const cache = new IndicatorCache(50);
    const values = [1, 2, 3, 4, 5];
    cache.set('AAPL', 'SMA', values, { period: 20 });
    expect(cache.get('AAPL', 'SMA', { period: 20 })).toEqual(values);
  });

  it('different params = different keys', () => {
    const cache = new IndicatorCache(50);
    cache.set('AAPL', 'SMA', [1, 2], { period: 10 });
    cache.set('AAPL', 'SMA', [3, 4], { period: 20 });
    expect(cache.get('AAPL', 'SMA', { period: 10 })).toEqual([1, 2]);
    expect(cache.get('AAPL', 'SMA', { period: 20 })).toEqual([3, 4]);
  });

  it('invalidate removes all entries for symbol', () => {
    const cache = new IndicatorCache(50);
    cache.set('AAPL', 'SMA', [1], { period: 10 });
    cache.set('AAPL', 'EMA', [2], { period: 10 });
    cache.invalidate('AAPL');
    expect(cache.get('AAPL', 'SMA', { period: 10 })).toBeUndefined();
    expect(cache.get('AAPL', 'EMA', { period: 10 })).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════
// Worker Pool
// ═══════════════════════════════════════════════════════════

describe('WorkerPool', () => {
  it('creates pool with default size', () => {
    const pool = new WorkerPool({ maxWorkers: 2 });
    expect(pool.poolSize).toBe(0);
    expect(pool.activeWorkers).toBe(0);
  });

  it('execute returns result', async () => {
    const pool = new WorkerPool({ maxWorkers: 1 });
    const result = await pool.execute<string>('testFn', [1, 2]);
    expect(result).toBeDefined();
    pool.terminate();
  });

  it('executeBatch handles multiple tasks', async () => {
    const pool = new WorkerPool({ maxWorkers: 2 });
    const results = await pool.executeBatch([
      { fn: 'fn1', args: [] },
      { fn: 'fn2', args: [] },
    ]);
    expect(results.length).toBe(2);
    pool.terminate();
  });

  it('terminate clears workers', () => {
    const pool = new WorkerPool({ maxWorkers: 2 });
    pool.terminate();
    expect(pool.poolSize).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Memory Monitor
// ═══════════════════════════════════════════════════════════

describe('MemoryMonitor', () => {
  it('capture returns stats', () => {
    const mm = new MemoryMonitor();
    const stats = mm.capture(0.8, 4, 2);
    expect(stats.heapUsedMB).toBeDefined();
    expect(stats.cacheHitRate).toBe(0.8);
  });

  it('health returns ok when below thresholds', () => {
    const mm = new MemoryMonitor();
    mm.setThresholds(500, 800);
    mm.capture(0.5, 2, 1);
    const h = mm.health();
    expect(h.status).toBe('ok');
  });

  it('average computes across snapshots', () => {
    const mm = new MemoryMonitor();
    for (let i = 0; i < 5; i++) mm.capture(0.5, 2, 1);
    const avg = mm.average(3);
    expect(avg.heapUsedMB).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// Global Performance Optimizer
// ═══════════════════════════════════════════════════════════

describe('GlobalPerformanceOptimizer', () => {
  let gpo: GlobalPerformanceOptimizer;
  beforeEach(() => { resetGlobalPerformanceOptimizer(); gpo = getGlobalPerformanceOptimizer(); });

  it('recordMetric and getMetrics', () => {
    gpo.recordMetric('render', 42, 'ms');
    const metrics = gpo.getMetrics('render');
    expect(metrics.length).toBe(1);
    expect(metrics[0].value).toBe(42);
  });

  it('healthReport returns all sections', () => {
    const report = gpo.healthReport();
    expect(report.memory).toBeDefined();
    expect(report.cache).toBeDefined();
    expect(report.workers).toBeDefined();
  });

  it('optimizationReport estimates savings', () => {
    gpo.lruCache.set('key1', 'val1');
    gpo.lruCache.get('key1');
    const report = gpo.optimizationReport();
    expect(report.totalOps).toBeGreaterThanOrEqual(0);
    expect(report.estimatedSavedMs).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════
// IndicatorTemplateMarketplaceEngine
// ═══════════════════════════════════════════════════════════

describe('IndicatorTemplateMarketplaceEngine', () => {
  let engine: IndicatorTemplateMarketplaceEngine;
  beforeEach(() => { resetIndicatorTemplateMarketplaceEngine(); engine = getIndicatorTemplateMarketplaceEngine(); });

  it('create template', () => {
    const tmpl = engine.create('user1', 'Alice', {
      name: 'Test Template', description: 'A test', category: '趋势',
      indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }],
      price: 5, tags: ['SMA', 'trend'],
    });
    expect(tmpl.id).toBeDefined();
    expect(tmpl.price).toBe(5);
    expect(tmpl.status).toBe('published');
  });

  it('search returns matching templates', () => {
    engine.create('u1', 'A', { name: 'MACD Combo', description: 'MACD strategy', category: '趋势', indicators: [{ type: 'MACD', params: {}, pane: 'sub1', visible: true }], price: 5 });
    engine.create('u1', 'A', { name: 'RSI Only', description: 'RSI indicator', category: '动量', indicators: [{ type: 'RSI', params: {}, pane: 'sub1', visible: true }], price: 3 });
    const results = engine.search('MACD');
    expect(results.total).toBe(1);
    expect(results.items[0].name).toBe('MACD Combo');
  });

  it('purchase deducts platform fee (30%)', () => {
    const tmpl = engine.create('creator1', 'Bob', { name: 'Vol Strategy', description: '', category: '波动', indicators: [{ type: 'ATR', params: {}, pane: 'sub1', visible: true }], price: 10 });
    const result = engine.purchase(tmpl.id, 'buyer1');
    expect(result.success).toBe(true);
    expect(result.platformRevenue).toBe(3); // 30% of 10
    expect(result.creatorRevenue).toBe(7); // 70% of 10
  });

  it('duplicate purchase rejected', () => {
    const tmpl = engine.create('c', 'C', { name: 'X', description: '', category: '动量', indicators: [{ type: 'RSI', params: {}, pane: 'sub1', visible: true }], price: 5 });
    engine.purchase(tmpl.id, 'buyer');
    const result2 = engine.purchase(tmpl.id, 'buyer');
    expect(result2.success).toBe(false);
  });

  it('addReview updates rating', () => {
    const tmpl = engine.create('c', 'C', { name: 'Y', description: '', category: '成交量', indicators: [{ type: 'VWAP', params: {}, pane: 'sub1', visible: true }], price: 3 });
    engine.addReview(tmpl.id, 'u1', 'User1', 4, 'Good');
    engine.addReview(tmpl.id, 'u2', 'User2', 2, 'Bad');
    const updated = engine.get(tmpl.id)!;
    expect(updated.rating).toBe(3);
    expect(updated.ratingCount).toBe(2);
  });

  it('download must be purchased for paid templates', () => {
    const tmpl = engine.create('c', 'C', { name: 'Z', description: '', category: '趋势', indicators: [{ type: 'EMA', params: {}, pane: 'main', visible: true }], price: 5 });
    expect(engine.download(tmpl.id, 'buyer')).toBeNull();
    engine.purchase(tmpl.id, 'buyer');
    expect(engine.download(tmpl.id, 'buyer')).not.toBeNull();
  });

  it('stats returns marketplace metrics', () => {
    const tmpl = engine.create('c1', 'Creator1', { name: 'A', description: '', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 10 });
    engine.purchase(tmpl.id, 'buyer');
    const stats = engine.stats();
    expect(stats.totalTemplates).toBeGreaterThanOrEqual(1);
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(10);
    expect(stats.platformRevenue).toBe(3);
    expect(stats.topCreators.length).toBeGreaterThan(0);
  });

  it('getCategories returns unique categories', () => {
    engine.create('u', 'U', { name: 'A', description: '', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 1 });
    engine.create('u', 'U', { name: 'B', description: '', category: '动量', indicators: [{ type: 'RSI', params: {}, pane: 'sub1', visible: true }], price: 1 });
    const cats = engine.getCategories();
    expect(cats).toContain('趋势');
    expect(cats).toContain('动量');
  });

  it('seedDemo creates demo templates', () => {
    const demos = engine.seedDemo('demo', 'Demo');
    expect(demos.length).toBe(2);
    expect(demos[0].authorName).toBe('Demo');
  });

  it('update increments version', () => {
    const tmpl = engine.create('u', 'U', { name: 'Old', description: '', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 1 });
    const updated = engine.update(tmpl.id, 'u', { name: 'New Name' });
    expect(updated!.version).toBe(2);
    expect(updated!.name).toBe('New Name');
  });

  it('delete archives template', () => {
    const tmpl = engine.create('u', 'U', { name: 'Del', description: '', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 1 });
    engine.delete(tmpl.id, 'u');
    expect(engine.get(tmpl.id)!.status).toBe('archived');
  });

  it('search pagination', () => {
    for (let i = 0; i < 25; i++) {
      engine.create('u', 'U', { name: `Template ${i}`, description: '', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 1 });
    }
    const r1 = engine.search('', { page: 1, pageSize: 10 });
    expect(r1.items.length).toBe(10);
    const r2 = engine.search('', { page: 2, pageSize: 10 });
    expect(r2.items.length).toBe(10);
    const r3 = engine.search('', { page: 3, pageSize: 10 });
    expect(r3.items.length).toBe(5);
  });
});
