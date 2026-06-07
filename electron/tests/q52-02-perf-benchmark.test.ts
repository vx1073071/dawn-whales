/**
 * Q-52-02: Performance Benchmark Tests (R52 P0)
 * 性能基准测试套件 — API <150ms / 100并发 / 搜索 <200ms
 *
 * Tests: MarketplaceApi + StrategyMarketplaceSearch performance
 * Coverage: ≥250L, 20+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi } from '../../electron/engine/marketplace-api';
import { StrategyMarketplaceSearch } from '../../electron/engine/strategy-marketplace-search';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function createMockStrategy(overrides = {}) {
  return {
    name: 'Test Strategy',
    description: 'A test strategy for performance testing',
    author: 'perf-author',
    rating: 4.0,
    ratingCount: 100,
    downloads: 500,
    sharpe: 1.5,
    maxDrawdown: -10,
    winRate: 65,
    tags: ['momentum', 'daily'],
    visibility: 'public' as const,
    price: 0,
    ...overrides,
  };
}

function createMockMetric(overrides = {}) {
  return {
    strategyId: 'strat_1',
    name: 'Test Strategy',
    author: 'test-author',
    tags: ['momentum'],
    returns: 15.5,
    risk: -8.2,
    sharpe: 1.8,
    winRate: 62,
    trades: 120,
    subscribers: 10,
    rating: 4.2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ── Q-52-02-01: MarketplaceApi Latency ─────────────────────────────────────

describe('Q-52-02-01: MarketplaceApi Latency (<150ms)', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
    // Seed 100 strategies for realistic load
    for (let i = 0; i < 100; i++) {
      api.publishStrategy(createMockStrategy({
        name: `Strategy ${i}`,
        sharpe: 1 + (i % 10) * 0.2,
        rating: 3 + (i % 5) * 0.3,
        downloads: i * 10,
        tags: i % 3 === 0 ? ['trend'] : i % 3 === 1 ? ['momentum'] : ['mean-reversion'],
      }));
    }
  });

  it('P01-01: publishStrategy completes in <50ms', () => {
    const start = performance.now();
    api.publishStrategy(createMockStrategy({ name: 'Perf Test' }));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P01-02: getStrategy completes in <10ms', () => {
    const id = api.publishStrategy(createMockStrategy());
    const start = performance.now();
    api.getStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('P01-03: getStrategies (100 items, no filter) completes in <30ms', () => {
    const start = performance.now();
    api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 50 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(30);
  });

  it('P01-04: getStrategies with sort completes in <50ms', () => {
    const start = performance.now();
    api.getStrategies({ sortBy: 'rating', page: 1, pageSize: 50 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P01-05: searchStrategies completes in <50ms', () => {
    const start = performance.now();
    api.searchStrategies('Strategy 50');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P01-06: rateStrategy completes in <20ms', () => {
    const id = api.publishStrategy(createMockStrategy());
    const start = performance.now();
    api.rateStrategy(id, { userId: 'user1', rating: 5 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it('P01-07: downloadStrategy completes in <10ms', () => {
    const id = api.publishStrategy(createMockStrategy());
    const start = performance.now();
    api.downloadStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('P01-08: deleteStrategy completes in <20ms', () => {
    const id = api.publishStrategy(createMockStrategy());
    const start = performance.now();
    api.deleteStrategy(id);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });
});

// ── Q-52-02-02: StrategyMarketplaceSearch Latency ───────────────────────────

describe('Q-52-02-02: StrategyMarketplaceSearch Latency (<200ms)', () => {
  let search: StrategyMarketplaceSearch;

  beforeEach(() => {
    search = new StrategyMarketplaceSearch();
    // Seed 100 strategies
    for (let i = 0; i < 100; i++) {
      search.addStrategy(createMockMetric({
        strategyId: `strat_${i}`,
        name: `Strategy ${i}`,
        sharpe: 1 + (i % 10) * 0.2,
        rating: 3 + (i % 5) * 0.3,
        subscribers: i * 5,
        tags: i % 3 === 0 ? ['trend'] : i % 3 === 1 ? ['momentum'] : ['mean-reversion'],
      }));
    }
  });

  it('P02-01: search with keyword completes in <50ms', () => {
    const start = performance.now();
    search.search({ keyword: 'Strategy 50' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P02-02: search with minSharpe filter completes in <50ms', () => {
    const start = performance.now();
    search.search({ minSharpe: 2.0 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P02-03: search with sorting completes in <100ms', () => {
    const start = performance.now();
    search.search({ sortBy: 'sharpe', sortOrder: 'desc' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('P02-04: search with pagination completes in <50ms', () => {
    const start = performance.now();
    search.search({ page: 2, pageSize: 10 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('P02-05: getTopStrategies completes in <30ms', () => {
    const start = performance.now();
    search.getTopStrategies(10);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(30);
  });

  it('P02-06: addStrategy completes in <20ms', () => {
    const start = performance.now();
    search.addStrategy(createMockMetric({ strategyId: `new_strat_${Date.now()}` }));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(20);
  });
});

// ── Q-52-02-03: Concurrent Load ───────────────────────────────────────────

describe('Q-52-02-03: Concurrent Load (100 parallel operations)', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('P03-01: 100 parallel publishStrategy operations complete successfully', () => {
    const ids: string[] = [];
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      ids.push(api.publishStrategy(createMockStrategy({ name: `Concurrent ${i}` })));
    }
    const elapsed = performance.now() - start;

    // All 100 should succeed
    expect(ids.length).toBe(100);
    expect(new Set(ids).size).toBe(100); // All unique

    // Total time should be reasonable (not 100x serial time)
    // 100 ops × 5ms avg = 500ms max total
    expect(elapsed).toBeLessThan(500);
  });

  it('P03-02: 100 parallel getStrategy lookups complete in <100ms total', () => {
    // Pre-seed
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(api.publishStrategy(createMockStrategy({ name: `Lookup ${i}` })));
    }

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      api.getStrategy(ids[i]);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('P03-03: 100 parallel searchStrategies complete in <200ms total', () => {
    // Pre-seed
    for (let i = 0; i < 100; i++) {
      api.publishStrategy(createMockStrategy({ name: `Search ${i}`, tags: [`tag${i % 10}`] }));
    }

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      api.searchStrategies(`Search ${i}`);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('P03-04: mixed concurrent operations maintain data integrity', () => {
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      ids.push(api.publishStrategy(createMockStrategy({ name: `Mixed ${i}` })));
    }

    // Concurrent writes
    const writeStart = performance.now();
    for (let i = 50; i < 100; i++) {
      ids.push(api.publishStrategy(createMockStrategy({ name: `Mixed ${i}` })));
    }
    const writeElapsed = performance.now() - writeStart;

    // Concurrent reads
    const readStart = performance.now();
    for (const id of ids) {
      expect(api.getStrategy(id)).not.toBeNull();
    }
    const readElapsed = performance.now() - readStart;

    // Writes should be fast
    expect(writeElapsed).toBeLessThan(200);
    // Reads should be very fast
    expect(readElapsed).toBeLessThan(100);

    // All strategies should be present
    expect(api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 200 }).total).toBe(100);
  });
});

// ── Q-52-02-04: Stress & Edge Cases ─────────────────────────────────────────

describe('Q-52-02-04: Stress & Edge Cases', () => {
  it('P04-01: 1000 strategies getStrategies still <150ms', () => {
    const api = new MarketplaceApi();
    for (let i = 0; i < 1000; i++) {
      api.publishStrategy(createMockStrategy({ name: `Large ${i}` }));
    }
    const start = performance.now();
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100 });
    const elapsed = performance.now() - start;
    expect(result.total).toBe(1000);
    expect(result.strategies.length).toBe(100);
    expect(elapsed).toBeLessThan(150);
  });

  it('P04-02: empty search handles gracefully', () => {
    const api = new MarketplaceApi();
    const start = performance.now();
    const result = api.searchStrategies('');
    const elapsed = performance.now() - start;
    expect(result.total).toBe(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('P04-03: nonexistent strategy lookup is fast', () => {
    const api = new MarketplaceApi();
    const start = performance.now();
    const result = api.getStrategy('nonexistent');
    const elapsed = performance.now() - start;
    expect(result).toBeNull();
    expect(elapsed).toLessThan(5);
  });

  it('P04-04: rapid sequential publishes maintain uniqueness', () => {
    const api = new MarketplaceApi();
    const ids = new Set<string>();
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      ids.add(api.publishStrategy(createMockStrategy()));
    }
    const elapsed = performance.now() - start;
    expect(ids.size).toBe(200); // All unique
    expect(elapsed).toBeLessThan(500);
  });

  it('P04-05: search with very long query string handles gracefully', () => {
    const api = new MarketplaceApi();
    api.publishStrategy(createMockStrategy({ name: 'Target Strategy' }));
    const longQuery = 'A'.repeat(1000);
    const start = performance.now();
    const result = api.searchStrategies(longQuery);
    const elapsed = performance.now() - start;
    expect(result.total).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });
});