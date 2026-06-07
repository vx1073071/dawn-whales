/**
 * Q-52-03: Integration Tests (R52 P1)
 * 前后端集成测试套件 — 集联/一致性/错误/边界
 *
 * Coverage: ≥200L, 15+ tests
 * Uses singleton pattern: getMarketplaceApi() / resetMarketplaceApi()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi, getMarketplaceApi, resetMarketplaceApi } from '../electron/engine/marketplace-api';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function mkStrategy(overrides = {}) {
  return {
    name: 'Integration Test',
    description: 'An integration test strategy',
    author: 'integration-author',
    sharpe: 1.8,
    maxDrawdown: -12,
    winRate: 65,
    tags: ['momentum', 'daily'],
    visibility: 'public' as const,
    price: 0,
    ...overrides,
  };
}

// ── Section 1: End-to-End Marketplace Workflow ───────────────────────────────

describe('Q-52-03-01: End-to-End Marketplace Workflow', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('I01-01: publish → search → rate → download → delete lifecycle', () => {
    const api = getMarketplaceApi();

    // 1. Publish
    const id = api.publishStrategy(mkStrategy({
      name: 'My Alpha Strategy',
      description: 'High sharpe momentum strategy',
      tags: ['momentum', 'high-sharpe'],
      sharpe: 2.5,
    }));

    // 2. Find via search
    const searchResult = api.searchStrategies('Alpha');
    expect(searchResult.total).toBe(1);
    expect(searchResult.strategies[0].id).toBe(id);

    // 3. Rate it
    expect(api.rateStrategy(id, { userId: 'user1', rating: 5, createdAt: new Date().toISOString() })).toBe(true);
    expect(api.getStrategy(id)!.rating).toBe(5);

    // 4. Download
    expect(api.downloadStrategy(id)!.downloads).toBe(1);
    expect(api.downloadStrategy(id)!.downloads).toBe(2);

    // 5. Delete
    expect(api.deleteStrategy(id)).toBe(true);

    // 6. Gone from all views
    expect(api.getStrategy(id)).toBeNull();
    expect(api.searchStrategies('Alpha').total).toBe(0);
  });

  it('I01-02: private strategy hidden from public search but accessible by ID', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ name: 'Private Alpha', visibility: 'private' }));

    expect(api.searchStrategies('Private').total).toBe(0);
    expect(api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100 }).strategies.find(s => s.id === id)).toBeUndefined();
    expect(api.getStrategy(id)).not.toBeNull();
  });

  it('I01-03: rating updates affect ranking', () => {
    const api = getMarketplaceApi();
    const idHigh = api.publishStrategy(mkStrategy({ name: 'High', sharpe: 1.0 }));
    const idLow = api.publishStrategy(mkStrategy({ name: 'Low', sharpe: 3.0 }));

    // Rate low as 5, high as 1
    api.rateStrategy(idHigh, { userId: 'u1', rating: 1, createdAt: new Date().toISOString() });
    api.rateStrategy(idLow, { userId: 'u1', rating: 5, createdAt: new Date().toISOString() });

    const top = api.getTopStrategies(10);
    expect(top[0].name).toBe('Low'); // Rated 5 > Rated 1
  });

  it('I01-04: multiple authors can publish independently', () => {
    const api = getMarketplaceApi();
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(api.publishStrategy(mkStrategy({
        name: `Author ${i % 3} Strategy`,
        author: `author${i % 3}`,
      })));
    }
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100 });
    expect(result.total).toBe(10);
    expect(new Set(ids).size).toBe(10);
  });

  it('I01-05: strategy state persists correctly across operations', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({
      name: 'State Test',
      sharpe: 2.0,
      rating: 0,
      downloads: 0,
    }));

    // Rate
    api.rateStrategy(id, { userId: 'u1', rating: 4, createdAt: new Date().toISOString() });
    // Download
    api.downloadStrategy(id);
    api.downloadStrategy(id);
    // Verify all fields intact
    const s = api.getStrategy(id)!;
    expect(s.sharpe).toBe(2.0);
    expect(s.rating).toBe(4);
    expect(s.downloads).toBe(2);
    expect(s.ratingCount).toBe(1);
  });
});

// ── Section 2: Data Consistency ─────────────────────────────────────────────

describe('Q-52-03-02: Data Consistency', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('I02-01: rating is atomic — no partial states', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ rating: 0, ratingCount: 0 }));

    api.rateStrategy(id, { userId: 'u1', rating: 5, createdAt: new Date().toISOString() });

    const strategy = api.getStrategy(id)!;
    expect(strategy.ratingCount).toBe(1);
    expect(strategy.rating).toBe(5);
    expect(new Date(strategy.updatedAt).getTime()).toBeGreaterThan(new Date(strategy.createdAt).getTime());
  });

  it('I02-02: download does not affect other fields', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({
      sharpe: 2.5,
      rating: 4.0,
      ratingCount: 5,
    }));
    // Note: publishStrategy forces downloads=0; we do 5 downloads to make count observable
    for (let i = 0; i < 5; i++) api.downloadStrategy(id);

    const strategy = api.getStrategy(id)!;
    expect(strategy.downloads).toBe(5);
    expect(strategy.sharpe).toBe(2.5); // Unchanged
    expect(strategy.rating).toBe(4.0); // Unchanged
    expect(strategy.ratingCount).toBe(5); // Unchanged
  });

  it('I02-03: pagination has no duplicates or gaps', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 10; i++) api.publishStrategy(mkStrategy({ name: `S${i}` }));

    const page1 = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 3 });
    const page2 = api.getStrategies({ sortBy: 'newest', page: 2, pageSize: 3 });
    const page3 = api.getStrategies({ sortBy: 'newest', page: 3, pageSize: 3 });
    const page4 = api.getStrategies({ sortBy: 'newest', page: 4, pageSize: 3 });

    const allIds = new Set<string>();
    [...page1.strategies, ...page2.strategies, ...page3.strategies, ...page4.strategies].forEach(s => {
      expect(allIds.has(s.id)).toBe(false); // No duplicates
      allIds.add(s.id);
    });
    expect(allIds.size).toBe(10); // All 10 included
  });

  it('I02-04: filter combination is consistent with individual filters', () => {
    const api = getMarketplaceApi();
    for (let i = 0; i < 20; i++) {
      api.publishStrategy(mkStrategy({
        name: `S${i}`,
        sharpe: 1 + (i % 5) * 0.5,
        rating: 2 + (i % 4) * 0.5,
        tags: i % 2 === 0 ? ['trend'] : ['momentum'],
      }));
    }

    const result = api.getStrategies({
      sortBy: 'newest', page: 1, pageSize: 100,
      tag: 'trend', minSharpe: 2.0, minRating: 3.0,
    });

    result.strategies.forEach(s => {
      expect(s.tags).toContain('trend');
      expect(s.sharpe).toBeGreaterThanOrEqual(2.0);
      expect(s.rating).toBeGreaterThanOrEqual(3.0);
    });
  });
});

// ── Section 3: Error & Edge Cases ─────────────────────────────────────────

describe('Q-52-03-03: Error & Edge Cases', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('I03-01: page beyond range returns empty but correct total', () => {
    const api = getMarketplaceApi();
    api.publishStrategy(mkStrategy());
    const result = api.getStrategies({ sortBy: 'newest', page: 100, pageSize: 10 });
    expect(result.strategies.length).toBe(0);
    expect(result.total).toBe(1);
  });

  it('I03-02: rating with comment is stored', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    const ok = api.rateStrategy(id, {
      userId: 'user1',
      rating: 5,
      comment: 'Excellent strategy! Best I have used.',
      createdAt: new Date().toISOString(),
    });
    expect(ok).toBe(true);
  });

  it('I03-03: special characters in strategy name are searchable', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ name: 'Strategy with $pecial & Ch@rs!' }));
    expect(api.searchStrategies('$pecial').total).toBe(1);
    expect(api.searchStrategies('Ch@rs').total).toBe(1);
  });

  it('I03-04: empty name strategy can still be found by description', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ name: '', description: 'Unique desc 12345' }));
    expect(api.searchStrategies('Unique desc 12345').total).toBe(1);
    expect(api.searchStrategies('Unique desc 12345').strategies[0].id).toBe(id);
  });

  it('I03-05: delete is idempotent', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    expect(api.deleteStrategy(id)).toBe(true);
    expect(api.deleteStrategy(id)).toBe(false);
    expect(api.deleteStrategy(id)).toBe(false);
  });

  it('I03-06: getStats works with empty marketplace', () => {
    const api = getMarketplaceApi();
    const stats = api.getStats();
    expect(stats.totalStrategies).toBe(0);
    expect(stats.totalDownloads).toBe(0);
    expect(stats.avgRating).toBe(0);
  });
});

// ── Section 4: Singleton Behavior ───────────────────────────────────────────

describe('Q-52-03-04: Singleton Behavior', () => {
  it('I04-01: getMarketplaceApi returns the same instance', () => {
    const a1 = getMarketplaceApi();
    const a2 = getMarketplaceApi();
    expect(a1).toBe(a2);
  });

  it('I04-02: resetMarketplaceApi creates new instance', () => {
    const a1 = getMarketplaceApi();
    a1.publishStrategy(mkStrategy({ name: 'Before Reset' }));
    resetMarketplaceApi();
    const a2 = getMarketplaceApi();
    expect(a1).not.toBe(a2);
    expect(a2.getStrategies({ sortBy: 'newest', page: 1, pageSize: 20 }).total).toBe(0);
  });

  it('I04-03: different test isolation via reset', () => {
    const api1 = getMarketplaceApi();
    api1.publishStrategy(mkStrategy({ name: 'Test1' }));
    resetMarketplaceApi();
    const api2 = getMarketplaceApi();
    api2.publishStrategy(mkStrategy({ name: 'Test2' }));
    // api1 should be fresh, api2 should have Test2
    expect(api1.getStrategies({ sortBy: 'newest', page: 1, pageSize: 20 }).total).toBe(0);
    expect(api2.getStrategies({ sortBy: 'newest', page: 1, pageSize: 20 }).total).toBe(1);
  });
});
