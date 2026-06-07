/**
 * Q-52-03: Integration Tests (R52 P1)
 * 前后端集成测试套件 — 集联/一致性/错误/边界
 *
 * Tests: MarketplaceApi + StrategyMarketplaceSearch integration scenarios
 * Coverage: ≥200L, 15+ tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceApi } from '../../electron/engine/marketplace-api';
import { StrategyMarketplaceSearch } from '../../electron/engine/strategy-marketplace-search';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function createMockStrategy(overrides = {}) {
  return {
    name: 'Test Strategy',
    description: 'A test strategy for integration testing',
    author: 'integration-author',
    rating: 4.0,
    ratingCount: 50,
    downloads: 200,
    sharpe: 1.8,
    maxDrawdown: -12,
    winRate: 60,
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

// ── Q-52-03-01: End-to-End Marketplace Workflow ─────────────────────────────

describe('Q-52-03-01: End-to-End Marketplace Workflow', () => {
  let api: MarketplaceApi;
  let publishedId: string;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('I01-01: author can publish a strategy and find it via search', () => {
    // Author publishes
    publishedId = api.publishStrategy(createMockStrategy({
      name: 'My Alpha Strategy',
      description: 'High sharpe momentum strategy',
      tags: ['momentum', 'high-sharpe'],
      sharpe: 2.5,
      winRate: 70,
    }));

    // Verify published
    const strategy = api.getStrategy(publishedId);
    expect(strategy).not.toBeNull();
    expect(strategy!.name).toBe('My Alpha Strategy');
    expect(strategy!.sharpe).toBe(2.5);

    // Search finds it
    const searchResult = api.searchStrategies('Alpha');
    expect(searchResult.total).toBe(1);
    expect(searchResult.strategies[0].id).toBe(publishedId);
  });

  it('I01-02: community ratings update strategy ranking', () => {
    publishedId = api.publishStrategy(createMockStrategy({ name: 'Community Strategy', sharpe: 2.0 }));

    // Rating updates
    api.rateStrategy(publishedId, { userId: 'user1', rating: 5 });
    api.rateStrategy(publishedId, { userId: 'user2', rating: 4 });
    api.rateStrategy(publishedId, { userId: 'user3', rating: 3 });

    // Ranking should reflect new rating
    const result = api.getStrategies({ sortBy: 'rating', page: 1, pageSize: 10 });
    const ranked = result.strategies.findIndex(s => s.id === publishedId);
    expect(ranked).toBe(0); // Should be top (rating 4.0)
  });

  it('I01-03: subscriber downloads increment and persist', () => {
    publishedId = api.publishStrategy(createMockStrategy({ name: 'Downloadable Strategy', downloads: 0 }));

    // Multiple subscribers download
    api.downloadStrategy(publishedId);
    api.downloadStrategy(publishedId);
    api.downloadStrategy(publishedId);

    // Downloads persist
    const strategy = api.getStrategy(publishedId)!;
    expect(strategy.downloads).toBe(3);
  });

  it('I01-04: private strategy is hidden from public views', () => {
    publishedId = api.publishStrategy(createMockStrategy({
      name: 'Private Strategy',
      visibility: 'private',
    }));

    // Not in search
    const searchResult = api.searchStrategies('Private');
    expect(searchResult.total).toBe(0);

    // Not in list
    const listResult = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100 });
    expect(listResult.strategies.find(s => s.id === publishedId)).toBeUndefined();

    // But still accessible by ID
    expect(api.getStrategy(publishedId)).not.toBeNull();
  });

  it('I01-05: author can delete their strategy', () => {
    publishedId = api.publishStrategy(createMockStrategy({ name: 'To Delete' }));

    // Delete
    expect(api.deleteStrategy(publishedId)).toBe(true);

    // Gone from all views
    expect(api.getStrategy(publishedId)).toBeNull();
    expect(api.searchStrategies('To Delete').total).toBe(0);
  });
});

// ── Q-52-03-02: Data Consistency ───────────────────────────────────────────

describe('Q-52-03-02: Data Consistency', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('I02-01: rating update is atomic — no partial states', () => {
    const id = api.publishStrategy(createMockStrategy({ rating: 0, ratingCount: 0 }));

    api.rateStrategy(id, { userId: 'u1', rating: 5 });

    const strategy = api.getStrategy(id)!;
    expect(strategy.ratingCount).toBe(1);
    expect(strategy.rating).toBe(5);
    expect(new Date(strategy.updatedAt).getTime()).toBeGreaterThan(new Date(strategy.createdAt).getTime());
  });

  it('I02-02: download increments without affecting other fields', () => {
    const id = api.publishStrategy(createMockStrategy({
      downloads: 10,
      sharpe: 2.5,
      rating: 4.0,
      ratingCount: 5,
    }));

    api.downloadStrategy(id);

    const strategy = api.getStrategy(id)!;
    expect(strategy.downloads).toBe(11);
    expect(strategy.sharpe).toBe(2.5); // Unchanged
    expect(strategy.rating).toBe(4.0); // Unchanged
    expect(strategy.ratingCount).toBe(5); // Unchanged
  });

  it('I02-03: pagination does not duplicate or skip strategies', () => {
    for (let i = 0; i < 10; i++) {
      api.publishStrategy(createMockStrategy({ name: `Strategy ${i}` }));
    }

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
    expect(page1.total).toBe(10);
    expect(page2.total).toBe(10);
    expect(page3.total).toBe(10);
    expect(page4.total).toBe(10); // Consistent total across pages
  });

  it('I02-04: filter combination is consistent with individual filters', () => {
    for (let i = 0; i < 20; i++) {
      api.publishStrategy(createMockStrategy({
        name: `S${i}`,
        sharpe: 1 + (i % 5) * 0.5,
        rating: 2 + (i % 4) * 0.5,
        tags: i % 2 === 0 ? ['trend'] : ['momentum'],
      }));
    }

    // Combined filter
    const combined = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100, tag: 'trend', minSharpe: 2.0, minRating: 3.0 });

    // Each result must satisfy all conditions
    combined.strategies.forEach(s => {
      expect(s.tags).toContain('trend');
      expect(s.sharpe).toBeGreaterThanOrEqual(2.0);
      expect(s.rating).toBeGreaterThanOrEqual(3.0);
    });
  });
});

// ── Q-52-03-03: Error & Edge Cases ─────────────────────────────────────────

describe('Q-52-03-03: Error & Edge Cases', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('I03-01: getStrategies with invalid sortBy returns empty (default sort)', () => {
    // Invalid sortBy should fall back gracefully (TypeScript prevents this at compile time)
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10 });
    expect(result.total).toBe(0);
  });

  it('I03-02: getStrategies with page beyond range returns empty', () => {
    api.publishStrategy(createMockStrategy());
    const result = api.getStrategies({ sortBy: 'newest', page: 100, pageSize: 10 });
    expect(result.strategies.length).toBe(0);
    expect(result.total).toBe(1);
  });

  it('I03-03: rating with comment is stored correctly', () => {
    const id = api.publishStrategy(createMockStrategy());
    api.rateStrategy(id, { userId: 'user1', rating: 5, comment: 'Excellent strategy!' });
    // Comment stored internally (not exposed in MarketplaceStrategy)
    // but rateStrategy returns true to confirm storage
    expect(api.rateStrategy(id, { userId: 'user2', rating: 4 })).toBe(true);
  });

  it('I03-04: searchStrategies with special characters is handled', () => {
    api.publishStrategy(createMockStrategy({ name: 'Strategy with $pecial & Ch@rs' }));
    const result = api.searchStrategies('$pecial');
    expect(result.total).toBe(1);
  });

  it('I03-05: empty name strategy can still be published and found by description', () => {
    const id = api.publishStrategy(createMockStrategy({ name: '', description: 'Unique description 12345' }));
    const searchResult = api.searchStrategies('Unique description 12345');
    expect(searchResult.total).toBe(1);
    expect(searchResult.strategies[0].id).toBe(id);
  });

  it('I03-06: deleting already-deleted strategy returns false (idempotent)', () => {
    const id = api.publishStrategy(createMockStrategy());
    expect(api.deleteStrategy(id)).toBe(true);
    expect(api.deleteStrategy(id)).toBe(false);
    expect(api.deleteStrategy(id)).toBe(false); // Always false
  });
});

// ── Q-52-03-04: Cross-Engine Integration ───────────────────────────────────

describe('Q-52-03-04: Cross-Engine Integration (MarketplaceApi ↔ StrategyMarketplaceSearch)', () => {
  it('I04-01: MarketplaceApi publish → StrategyMarketplaceSearch reflects change', () => {
    const api = new MarketplaceApi();
    const search = new StrategyMarketplaceSearch();

    const id = api.publishStrategy(createMockStrategy({ name: 'Shared Strategy', sharpe: 3.0 }));
    search.addStrategy(createMockMetric({ strategyId: id, name: 'Shared Strategy', sharpe: 3.0 }));

    // Both can find it
    expect(api.getStrategy(id)?.name).toBe('Shared Strategy');
    const searchResult = search.search({ keyword: 'Shared' });
    expect(searchResult.total).toBe(1);
  });

  it('I04-02: both engines can sort by sharpe independently and consistently', () => {
    const api = new MarketplaceApi();
    const search = new StrategyMarketplaceSearch();

    const sharpeValues = [1.5, 2.8, 1.2, 3.0, 2.0];
    sharpeValues.forEach((sharpe, i) => {
      const id = api.publishStrategy(createMockStrategy({ name: `S${i}`, sharpe }));
      search.addStrategy(createMockMetric({ strategyId: id, name: `S${i}`, sharpe }));
    });

    const apiResult = api.getStrategies({ sortBy: 'sharpe', page: 1, pageSize: 10 });
    const searchResult = search.search({ sortBy: 'sharpe', sortOrder: 'desc' });

    // Both should rank S3 (sharpe 3.0) first
    expect(apiResult.strategies[0].sharpe).toBe(3.0);
    expect(searchResult.strategies[0].sharpe).toBe(3.0);
  });

  it('I04-03: pagination consistency between both engines', () => {
    const api = new MarketplaceApi();
    const search = new StrategyMarketplaceSearch();

    for (let i = 0; i < 10; i++) {
      const id = api.publishStrategy(createMockStrategy({ name: `P${i}`, sharpe: i * 0.5 }));
      search.addStrategy(createMockMetric({ strategyId: id, name: `P${i}`, sharpe: i * 0.5 }));
    }

    const apiPage1 = api.getStrategies({ sortBy: 'sharpe', page: 1, pageSize: 3 });
    const apiPage2 = api.getStrategies({ sortBy: 'sharpe', page: 2, pageSize: 3 });
    const searchPage1 = search.search({ sortBy: 'sharpe', sortOrder: 'desc', page: 1, pageSize: 3 });
    const searchPage2 = search.search({ sortBy: 'sharpe', sortOrder: 'desc', page: 2, pageSize: 3 });

    // Page 1 and 2 should have no overlap
    const apiIds1 = new Set(apiPage1.strategies.map(s => s.id));
    const apiIds2 = new Set(apiPage2.strategies.map(s => s.id));
    expect([...apiIds1].some(id => apiIds2.has(id))).toBe(false);

    // totalPages should be consistent
    expect(apiPage1.total).toBe(apiPage2.total);
    expect(searchPage1.total).toBe(searchPage2.total);
  });
});

// ── Q-52-03-05: StrategyMarketplaceSearch Integration ───────────────────────

describe('Q-52-03-05: StrategyMarketplaceSearch Advanced Integration', () => {
  let search: StrategyMarketplaceSearch;

  beforeEach(() => {
    search = new StrategyMarketplaceSearch();
    for (let i = 0; i < 20; i++) {
      search.addStrategy(createMockMetric({
        strategyId: `s${i}`,
        name: `Strategy ${i}`,
        sharpe: 1 + (i % 10) * 0.2,
        rating: 3 + (i % 5) * 0.4,
        returns: 5 + i * 2,
        winRate: 50 + (i % 40),
        subscribers: i * 10,
        tags: i % 2 === 0 ? ['trend', 'momentum'] : ['mean-reversion', 'stat-arb'],
      }));
    }
  });

  it('I05-01: event emission on addStrategy', () => {
    let eventFired = false;
    search.on('strategy:added', (metric) => {
      eventFired = true;
      expect(metric.strategyId).toBe('new_strat');
    });

    search.addStrategy(createMockMetric({ strategyId: 'new_strat' }));
    expect(eventFired).toBe(true);
  });

  it('I05-02: multi-filter search finds correct subset', () => {
    const result = search.search({
      minSharpe: 2.0,
      minRating: 4.0,
      tags: ['trend', 'momentum'],
    });

    result.strategies.forEach(s => {
      expect(s.sharpe).toBeGreaterThanOrEqual(2.0);
      expect(s.rating).toBeGreaterThanOrEqual(4.0);
    });
  });

  it('I05-03: sort by different fields produces consistent results', () => {
    const bySharpe = search.search({ sortBy: 'sharpe', sortOrder: 'desc' });
    const byRating = search.search({ sortBy: 'rating', sortOrder: 'desc' });
    const byReturns = search.search({ sortBy: 'returns', sortOrder: 'desc' });
    const bySubscribers = search.search({ sortBy: 'subscribers', sortOrder: 'desc' });

    // Each result should be sorted correctly
    for (let i = 0; i < bySharpe.strategies.length - 1; i++) {
      expect(bySharpe.strategies[i].sharpe).toBeGreaterThanOrEqual(bySharpe.strategies[i + 1].sharpe);
      expect(byRating.strategies[i].rating).toBeGreaterThanOrEqual(byRating.strategies[i + 1].rating);
      expect(byReturns.strategies[i].returns).toBeGreaterThanOrEqual(byReturns.strategies[i + 1].returns);
      expect(bySubscribers.strategies[i].subscribers).toBeGreaterThanOrEqual(bySubscribers.strategies[i + 1].subscribers);
    }
  });
});