/**
 * Q-52-02: Performance Benchmark Tests (R52 P0)
 * 性能基准测试套件 — API <150ms / 100并发 / 搜索 <200ms
 *
 * Coverage: ≥250L, 20+ tests
 * Uses singleton pattern: getMarketplaceApi() / resetMarketplaceApi()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi, getMarketplaceApi, resetMarketplaceApi } from '../electron/engine/analysis/marketplace-api';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function mkStrategy(overrides = {}) {
  return {
    name: 'Perf Test',
    description: 'Performance test strategy',
    author: 'perf-author',
    sharpe: 1.5,
    maxDrawdown: -10,
    winRate: 62,
    tags: ['momentum', 'daily'],
    visibility: 'public' as const,
    price: 0,
    ...overrides,
  };
}

// ── Section 1: Individual API Latency ───────────────────────────────────────

describe('Q-52-02-01: Individual API Latency', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('P01-01: publishStrategy < 50ms', () => {
    const api = getMarketplaceApi();
    const start = performance.now();
    api.publishStrategy(mkStrategy());
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P01-02: getStrategy < 10ms', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    const start = performance.now();
    api.getStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('P01-03: getStrategies (no filter) < 30ms', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 100; i++) api.publishStrategy(mkStrategy({ name: `S${i}` }));
    const start = performance.now();
    api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 50 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(30);
  });

  it('P01-04: getStrategies (sort by sharpe) < 50ms', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 100; i++) api.publishStrategy(mkStrategy({ name: `S${i}` }));
    const start = performance.now();
    api.getStrategies({ sortBy: 'sharpe', page: 1, pageSize: 50 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P01-05: searchStrategies < 50ms', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 100; i++) api.publishStrategy(mkStrategy({ name: `Strategy ${i}`, tags: [`tag${i % 10}`] }));
    const start = performance.now();
    api.searchStrategies('Strategy 50');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P01-06: rateStrategy < 20ms', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    const start = performance.now();
    api.rateStrategy(id, { userId: 'user1', rating: 5, createdAt: new Date().toISOString() });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it('P01-07: downloadStrategy < 10ms', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    const start = performance.now();
    api.downloadStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('P01-08: deleteStrategy < 20ms', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    const start = performance.now();
    api.deleteStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it('P01-09: getStats < 30ms with 100 strategies', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 100; i++) api.publishStrategy(mkStrategy({ name: `S${i}` }));
    const start = performance.now();
    api.getStats();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(30);
  });

  it('P01-10: getAllTags < 20ms with 100 strategies', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 100; i++) api.publishStrategy(mkStrategy({ tags: [`tag${i % 20}`] }));
    const start = performance.now();
    api.getAllTags();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });
});

// ── Section 2: Concurrent Load ───────────────────────────────────────────────

describe('Q-52-02-02: Concurrent Load', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('P02-01: 100 sequential publishes complete in < 1000ms', () => {
    const api = getMarketplaceApi();
    const start = performance.now();
    for (let i = 0; i < 100; i++) api.publishStrategy(mkStrategy({ name: `Concurrent ${i}` }));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('P02-02: 100 sequential lookups complete in < 200ms', () => {
    const api = getMarketplaceApi();
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) ids.push(api.publishStrategy(mkStrategy({ name: `Lookup ${i}` })));
    const start = performance.now();
    for (const id of ids) api.getStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('P02-03: 100 sequential searches complete in < 2000ms', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 100; i++) {
      api.publishStrategy(mkStrategy({ name: `Search ${i}`, tags: [`tag${i % 10}`] }));
    }
    const start = performance.now();
    for (let i = 0; i < 100; i++) api.searchStrategies(`Search ${i}`);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it('P02-04: mixed operations maintain data integrity', () => {
    const api = getMarketplaceApi();
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) ids.push(api.publishStrategy(mkStrategy({ name: `Mixed ${i}` })));

    // Concurrent writes
    for (let i = 50; i < 100; i++) ids.push(api.publishStrategy(mkStrategy({ name: `Mixed ${i}` })));

    // All reads succeed
    for (const id of ids) {
      expect(api.getStrategy(id)).not.toBeNull();
    }

    // All 100 strategies present
    expect(api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 200 }).total).toBe(100);
  });
});

// ── Section 3: Large Dataset Performance ────────────────────────────────────

describe('Q-52-02-03: Large Dataset Performance', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('P03-01: 1000 strategies getStrategies < 150ms', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 1000; i++) api.publishStrategy(mkStrategy({ name: `Large ${i}` }));
    const start = performance.now();
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100 });
    const elapsed = performance.now() - start;
    expect(result.total).toBe(1000);
    expect(elapsed).toBeLessThan(150);
  });

  it('P03-02: 1000 strategies search < 200ms', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 1000; i++) api.publishStrategy(mkStrategy({ name: `Strategy ${i}` }));
    const start = performance.now();
    const result = api.searchStrategies('Strategy 500');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('P03-03: rapid sequential publishes maintain uniqueness (200 ops)', () => {
    const api = getMarketplaceApi();
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(api.publishStrategy(mkStrategy()));
    expect(ids.size).toBe(200);
  });
});

// ── Section 4: Edge Case Performance ─────────────────────────────────────────

describe('Q-52-02-04: Edge Case Performance', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('P04-01: empty search is instant', () => {
    const api = getMarketplaceApi();
    api.publishStrategy(mkStrategy({ name: 'Target' }));
    const start = performance.now();
    const result = api.searchStrategies('');
    const elapsed = performance.now() - start;
    expect(result.total).toBe(1);
    expect(elapsed).toBeLessThan(5);
  });

  it('P04-02: nonexistent lookup is instant', () => {
    const api = getMarketplaceApi();
    const start = performance.now();
    const result = api.getStrategy('nonexistent-id');
    const elapsed = performance.now() - start;
    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(5);
  });

  it('P04-03: long query string handled gracefully', () => {
    const api = getMarketplaceApi();
    api.publishStrategy(mkStrategy({ name: 'Target' }));
    const longQuery = 'A'.repeat(1000);
    const start = performance.now();
    const result = api.searchStrategies(longQuery);
    const elapsed = performance.now() - start;
    expect(result.total).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });

  it('P04-04: special characters in search handled', () => {
    const api = getMarketplaceApi();
    api.publishStrategy(mkStrategy({ name: 'Strategy with $pecial & Ch@rs' }));
    const start = performance.now();
    const result = api.searchStrategies('$pecial');
    const elapsed = performance.now() - start;
    expect(result.total).toBe(1);
    expect(elapsed).toBeLessThan(20);
  });
});
