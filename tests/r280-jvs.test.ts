/**
 * R280 JVS 综合测试 — PerformanceOptimizer + EmergencyBugfix
 * >= 20 tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorPerformanceOptimizer,
} from '../electron/engine/analysis/factor-performance-optimizer';
import {
  EmergencyBugfixEngine,
  getEmergencyBugfixEngine,
  resetEmergencyBugfixEngine,
} from '../electron/engine/analysis/emergency-bugfix-engine';

beforeEach(() => {
  resetEmergencyBugfixEngine();
});

// A. FactorPerformanceOptimizer (10 tests)
describe('FactorPerformanceOptimizer', () => {
  it('A1: Lazy load state', () => {
    const opt = new FactorPerformanceOptimizer();
    expect(opt.isLazyLoaded('factor_001')).toBe(false);
    opt.markLazyLoaded('factor_001');
    expect(opt.isLazyLoaded('factor_001')).toBe(true);
  });

  it('A2: getMemo returns undefined on miss', () => {
    const opt = new FactorPerformanceOptimizer();
    expect(opt.getMemo('nonexistent')).toBeUndefined();
  });

  it('A3: setMemo + getMemo round-trip', () => {
    const opt = new FactorPerformanceOptimizer({ memoWindowMs: 60000 });
    opt.setMemo('key1', { data: 42 }, 60000);
    const hit = opt.getMemo<{ data: number }>('key1');
    expect(hit).not.toBeUndefined();
    expect(hit!.data).toBe(42);
  });

  it('A4: LRU cache put and get', () => {
    const opt = new FactorPerformanceOptimizer({ maxCacheSize: 100 });
    opt.setCache('pe_ttm', 'AAPL', 0.85);
    expect(opt.getFromCache('pe_ttm', 'AAPL')).toBe(0.85);
    expect(opt.getFromCache('pe_ttm', 'GOOGL')).toBeUndefined();
  });

  it('A5: Batch compute splits correctly', () => {
    const opt = new FactorPerformanceOptimizer({ batchSize: 10 });
    const items = Array.from({ length: 25 }, (_, i) => i);
    const results = opt.batchCompute(items, (chunk) => chunk.map(x => x * 2));
    expect(results).toEqual(items.map(x => x * 2));
  });

  it('A6: Dependency graph propagation', () => {
    const opt = new FactorPerformanceOptimizer();
    opt.setDeps('factor_a', ['factor_b', 'factor_c']);
    opt.markDirty('factor_c');
    const dirty = opt.getDirty();
    expect(dirty.has('factor_c')).toBe(true);
    expect(dirty.has('factor_a')).toBe(true);
  });

  it('A7: clearDirty removes single factor', () => {
    const opt = new FactorPerformanceOptimizer();
    opt.markDirty('factor_x');
    expect(opt.getDirty().has('factor_x')).toBe(true);
    opt.clearDirty('factor_x');
    expect(opt.getDirty().has('factor_x')).toBe(false);
  });

  it('A8: Precompute decile bins', () => {
    const opt = new FactorPerformanceOptimizer();
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const bins = opt.precomputeBins('test_factor', values);
    expect(bins.length).toBe(9);
    // 10th percentile ≈ 10, 90th percentile ≈ 90
    expect(bins[0]).toBeGreaterThan(8);
    expect(bins[0]).toBeLessThan(12);
  });

  it('A9: getMetrics hit rate', () => {
    const opt = new FactorPerformanceOptimizer({ maxCacheSize: 100 });
    opt.setCache('f1', 'sym1', 0.5);
    opt.getFromCache('f1', 'sym1'); // hit
    opt.getFromCache('f1', 'sym2'); // miss
    const m = opt.getMetrics();
    expect(m.cacheHits).toBe(1);
    expect(m.cacheMisses).toBe(1);
    expect(m.hitRate).toBeCloseTo(0.5, 1);
  });

  it('A10: unloaded count', () => {
    const opt = new FactorPerformanceOptimizer();
    expect(opt.getUnloadedCount()).toBe(620); // total 620, 0 loaded
    opt.markLazyLoaded('f1');
    opt.markLazyLoaded('f2');
    expect(opt.getUnloadedCount()).toBe(618);
  });
});

// B. EmergencyBugfixEngine (10 tests)
describe('EmergencyBugfixEngine', () => {
  it('B1: singleton', () => {
    expect(getEmergencyBugfixEngine()).toBe(getEmergencyBugfixEngine());
  });

  it('B2: nullSafeGet returns fallback for null', () => {
    const engine = getEmergencyBugfixEngine();
    expect(engine.nullSafeGet(null, 'a.b', 42)).toBe(42);
    expect(engine.nullSafeGet({ a: { b: 99 } }, 'a.b', 0)).toBe(99);
    expect(engine.nullSafeGet({}, 'a.b', 'fall')).toBe('fall');
  });

  it('B3: filterNaN removes NaNs and Infs', () => {
    const engine = getEmergencyBugfixEngine();
    const { clean, removed } = engine.filterNaN([1, NaN, 2, Infinity, -Infinity, 3, NaN]);
    expect(clean).toEqual([1, 2, 3]);
    expect(removed).toBe(4);
  });

  it('B4: safeDiv protects zero', () => {
    const engine = getEmergencyBugfixEngine();
    expect(engine.safeDiv(10, 2)).toBe(5);
    expect(engine.safeDiv(10, 0)).toBe(0);
    expect(engine.safeDiv(NaN, 5)).toBe(0);
    expect(engine.safeDiv(0, 0)).toBe(0);
  });

  it('B5: boundsCheck', () => {
    const engine = getEmergencyBugfixEngine();
    expect(engine.boundsCheck([1, 2, 3], 1)).toBe(true);
    expect(engine.boundsCheck([1, 2, 3], 5)).toBe(false);
    expect(engine.boundsCheck([], 0)).toBe(false);
  });

  it('B6: decimalGuard rounds precisely', () => {
    const engine = getEmergencyBugfixEngine();
    expect(engine.decimalGuard(1.23456789, 4)).toBe(1.2346);
    expect(engine.decimalGuard(1.0, 6)).toBe(1);
    expect(engine.decimalGuard(NaN, 2)).toBe(0);
  });

  it('B7: loopCap enforces max iterations', () => {
    const engine = getEmergencyBugfixEngine();
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result: number[] = [];
    const { processed, capped } = engine.loopCap(items, 3, (item) => result.push(item * 2));
    expect(result).toEqual([2, 4, 6]);
    expect(processed).toBe(3);
    expect(capped).toBe(true);
  });

  it('B8: fixTimestamps corrects bad values', () => {
    const engine = getEmergencyBugfixEngine();
    const { fixed, issues } = engine.fixTimestamps([0, 100, 50, NaN]);
    expect(fixed.length).toBe(4);
    expect(issues).toBeGreaterThan(0);
    // All should be valid and increasing
    for (let i = 1; i < fixed.length; i++) {
      expect(fixed[i]).toBeGreaterThan(fixed[i - 1]);
    }
    expect(Number.isFinite(fixed[3])).toBe(true);
  });

  it('B9: detectOutliers finds IQR extremes', () => {
    const engine = getEmergencyBugfixEngine();
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const { outliers, winsorized } = engine.detectOutliers(values, 1.5);
    expect(outliers.length).toBeGreaterThan(0);
    expect(winsorized.length).toBe(values.length);
    expect(Math.max(...winsorized)).toBeLessThan(100); // 100 winsorized
  });

  it('B10: runComprehensiveScan returns reports', () => {
    const engine = getEmergencyBugfixEngine();
    const reports = engine.runComprehensiveScan();
    expect(reports.length).toBeGreaterThan(0);
    const m = engine.getBugfixMetrics();
    expect(m.totalBugsFound).toBe(reports.length);
    expect(m.highFixed + m.mediumFixed + m.lowFixed).toBe(m.totalFixed);
  });
});
