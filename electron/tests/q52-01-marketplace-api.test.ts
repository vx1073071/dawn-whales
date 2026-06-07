/**
 * Q-52-01: Strategy Marketplace API Tests (R52 P0)
 * 策略市场 API 测试套件 — 发布/审核/搜索/订阅/评价全流程
 *
 * Tests: MarketplaceApi + StrategyMarketplaceSearch
 * Coverage: ≥350L, 35+ tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceApi } from '../../electron/engine/marketplace-api';
import { StrategyMarketplaceSearch } from '../../electron/engine/strategy-marketplace-search';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function createMockStrategy(overrides = {}) {
  return {
    name: 'Test Strategy',
    description: 'A test strategy for unit testing',
    author: 'test-author',
    rating: 0,
    ratingCount: 0,
    downloads: 0,
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

// ── Q-52-01-01: publishStrategy ─────────────────────────────────────────────

describe('Q-52-01-01: MarketplaceApi.publishStrategy', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('L01-01: returns a string ID when publishing a valid strategy', () => {
    const id = api.publishStrategy(createMockStrategy());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('L01-02: ID starts with "strat_" prefix', () => {
    const id = api.publishStrategy(createMockStrategy());
    expect(id.startsWith('strat_')).toBe(true);
  });

  it('L01-03: ID increments for each new strategy', () => {
    const id1 = api.publishStrategy(createMockStrategy({ name: 'S1' }));
    const id2 = api.publishStrategy(createMockStrategy({ name: 'S2' }));
    const id3 = api.publishStrategy(createMockStrategy({ name: 'S3' }));
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).toBe('strat_1');
    expect(id2).toBe('strat_2');
    expect(id3).toBe('strat_3');
  });

  it('L01-04: published strategy is retrievable via getStrategy', () => {
    const id = api.publishStrategy(createMockStrategy({ name: 'My Strategy' }));
    const strategy = api.getStrategy(id);
    expect(strategy).not.toBeNull();
    expect(strategy!.name).toBe('My Strategy');
  });

  it('L01-05: published strategy has correct default fields', () => {
    const id = api.publishStrategy(createMockStrategy({ sharpe: 2.0, maxDrawdown: -5 }));
    const strategy = api.getStrategy(id)!;
    expect(strategy.downloads).toBe(0);
    expect(strategy.rating).toBe(0);
    expect(strategy.ratingCount).toBe(0);
    expect(strategy.sharpe).toBe(2.0);
    expect(strategy.maxDrawdown).toBe(-5);
    expect(strategy.visibility).toBe('public');
  });

  it('L01-06: createdAt and updatedAt are ISO date strings', () => {
    const id = api.publishStrategy(createMockStrategy());
    const strategy = api.getStrategy(id)!;
    expect(new Date(strategy.createdAt).toISOString()).toBe(strategy.createdAt);
    expect(new Date(strategy.updatedAt).toISOString()).toBe(strategy.updatedAt);
  });

  it('L01-07: private visibility strategy is not returned by getStrategies', () => {
    const id = api.publishStrategy(createMockStrategy({ visibility: 'private' }));
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10 });
    const found = result.strategies.find(s => s.id === id);
    expect(found).toBeUndefined();
  });

  it('L01-08: strategy with price field is stored correctly', () => {
    const id = api.publishStrategy(createMockStrategy({ price: 99 }));
    const strategy = api.getStrategy(id)!;
    expect(strategy.price).toBe(99);
  });
});

// ── Q-52-01-02: getStrategies ────────────────────────────────────────────────

describe('Q-52-01-02: MarketplaceApi.getStrategies', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
    // Seed 5 strategies
    api.publishStrategy(createMockStrategy({ name: 'Strategy A', sharpe: 1.0, rating: 3.0, downloads: 100, tags: ['trend'] }));
    api.publishStrategy(createMockStrategy({ name: 'Strategy B', sharpe: 2.0, rating: 4.0, downloads: 200, tags: ['trend', 'momentum'] }));
    api.publishStrategy(createMockStrategy({ name: 'Strategy C', sharpe: 1.5, rating: 3.5, downloads: 50, tags: ['mean-reversion'] }));
    api.publishStrategy(createMockStrategy({ name: 'Strategy D', sharpe: 0.5, rating: 2.0, downloads: 10, tags: ['momentum'] }));
    api.publishStrategy(createMockStrategy({ name: 'Strategy E', sharpe: 2.5, rating: 4.5, downloads: 300, tags: ['trend'] }));
  });

  it('L02-01: returns all public strategies sorted by newest by default', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10 });
    expect(result.total).toBe(5);
    expect(result.strategies.length).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('L02-02: sorts by rating correctly (desc)', () => {
    const result = api.getStrategies({ sortBy: 'rating', page: 1, pageSize: 10 });
    expect(result.strategies[0].name).toBe('Strategy E'); // rating 4.5
    expect(result.strategies[1].name).toBe('Strategy B'); // rating 4.0
    expect(result.strategies[4].name).toBe('Strategy D'); // rating 2.0
  });

  it('L02-03: sorts by downloads correctly (desc)', () => {
    const result = api.getStrategies({ sortBy: 'downloads', page: 1, pageSize: 10 });
    expect(result.strategies[0].name).toBe('Strategy E'); // 300 downloads
    expect(result.strategies[1].name).toBe('Strategy B'); // 200 downloads
  });

  it('L02-04: sorts by sharpe correctly (desc)', () => {
    const result = api.getStrategies({ sortBy: 'sharpe', page: 1, pageSize: 10 });
    expect(result.strategies[0].sharpe).toBe(2.5);
    expect(result.strategies[1].sharpe).toBe(2.0);
  });

  it('L02-05: filters by tag correctly', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10, tag: 'trend' });
    expect(result.total).toBe(3);
    expect(result.strategies.every(s => s.tags.includes('trend'))).toBe(true);
  });

  it('L02-06: filters by minRating correctly', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10, minRating: 3.5 });
    expect(result.total).toBe(3);
    expect(result.strategies.every(s => s.rating >= 3.5)).toBe(true);
  });

  it('L02-07: filters by minSharpe correctly', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10, minSharpe: 1.5 });
    expect(result.total).toBe(3);
    expect(result.strategies.every(s => s.sharpe >= 1.5)).toBe(true);
  });

  it('L02-08: pagination works correctly (page 1)', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 2 });
    expect(result.strategies.length).toBe(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
  });

  it('L02-09: pagination works correctly (page 2)', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 2, pageSize: 2 });
    expect(result.strategies.length).toBe(2);
    expect(result.page).toBe(2);
  });

  it('L02-10: pagination works correctly (page 3, partial)', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 3, pageSize: 2 });
    expect(result.strategies.length).toBe(1);
    expect(result.page).toBe(3);
  });

  it('L02-11: returns empty when no strategies match filter', () => {
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10, tag: 'nonexistent' });
    expect(result.total).toBe(0);
    expect(result.strategies.length).toBe(0);
  });
});

// ── Q-52-01-03: getStrategy ──────────────────────────────────────────────────

describe('Q-52-01-03: MarketplaceApi.getStrategy', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('L03-01: returns strategy when ID exists', () => {
    const id = api.publishStrategy(createMockStrategy({ name: 'Find Me' }));
    expect(api.getStrategy(id)?.name).toBe('Find Me');
  });

  it('L03-02: returns null when ID does not exist', () => {
    expect(api.getStrategy('nonexistent_id')).toBeNull();
  });

  it('L03-03: returns null for empty string ID', () => {
    expect(api.getStrategy('')).toBeNull();
  });
});

// ── Q-52-01-04: rateStrategy ─────────────────────────────────────────────────

describe('Q-52-01-04: MarketplaceApi.rateStrategy', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('L04-01: rates a strategy and returns true', () => {
    const id = api.publishStrategy(createMockStrategy());
    const result = api.rateStrategy(id, { userId: 'user1', rating: 5 });
    expect(result).toBe(true);
  });

  it('L04-02: strategy rating updated after rating', () => {
    const id = api.publishStrategy(createMockStrategy());
    api.rateStrategy(id, { userId: 'user1', rating: 4 });
    api.rateStrategy(id, { userId: 'user2', rating: 5 });
    const strategy = api.getStrategy(id)!;
    expect(strategy.ratingCount).toBe(2);
    expect(strategy.rating).toBe(4.5); // (4+5)/2
  });

  it('L05-03: returns false when strategy not found', () => {
    const result = api.rateStrategy('nonexistent', { userId: 'user1', rating: 5 });
    expect(result).toBe(false);
  });

  it('L04-04: returns false for rating below 0', () => {
    const id = api.publishStrategy(createMockStrategy());
    const result = api.rateStrategy(id, { userId: 'user1', rating: -1 });
    expect(result).toBe(false);
  });

  it('L04-05: returns false for rating above 5', () => {
    const id = api.publishStrategy(createMockStrategy());
    const result = api.rateStrategy(id, { userId: 'user1', rating: 6 });
    expect(result).toBe(false);
  });

  it('L04-06: multiple ratings from same user accumulate', () => {
    const id = api.publishStrategy(createMockStrategy());
    api.rateStrategy(id, { userId: 'user1', rating: 3 });
    api.rateStrategy(id, { userId: 'user1', rating: 4 });
    const strategy = api.getStrategy(id)!;
    expect(strategy.ratingCount).toBe(2);
  });
});

// ── Q-52-01-05: downloadStrategy ─────────────────────────────────────────────

describe('Q-52-01-05: MarketplaceApi.downloadStrategy', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('L05-01: returns strategy when downloading existing strategy', () => {
    const id = api.publishStrategy(createMockStrategy({ name: 'Download Me' }));
    const downloaded = api.downloadStrategy(id);
    expect(downloaded?.name).toBe('Download Me');
  });

  it('L05-02: increments download count', () => {
    const id = api.publishStrategy(createMockStrategy({ downloads: 10 }));
    api.downloadStrategy(id);
    expect(api.getStrategy(id)?.downloads).toBe(11);
  });

  it('L05-03: returns null when strategy not found', () => {
    expect(api.downloadStrategy('nonexistent')).toBeNull();
  });

  it('L05-04: multiple downloads accumulate correctly', () => {
    const id = api.publishStrategy(createMockStrategy({ downloads: 0 }));
    api.downloadStrategy(id);
    api.downloadStrategy(id);
    api.downloadStrategy(id);
    expect(api.getStrategy(id)?.downloads).toBe(3);
  });
});

// ── Q-52-01-06: deleteStrategy ───────────────────────────────────────────────

describe('Q-52-01-06: MarketplaceApi.deleteStrategy', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('L06-01: returns true when deleting existing strategy', () => {
    const id = api.publishStrategy(createMockStrategy());
    expect(api.deleteStrategy(id)).toBe(true);
  });

  it('L06-02: strategy is no longer retrievable after deletion', () => {
    const id = api.publishStrategy(createMockStrategy());
    api.deleteStrategy(id);
    expect(api.getStrategy(id)).toBeNull();
  });

  it('L06-03: strategy no longer appears in getStrategies', () => {
    const id = api.publishStrategy(createMockStrategy({ name: 'To Delete' }));
    api.deleteStrategy(id);
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10 });
    expect(result.strategies.find(s => s.id === id)).toBeUndefined();
  });

  it('L06-04: returns false when deleting nonexistent strategy', () => {
    expect(api.deleteStrategy('nonexistent')).toBe(false);
  });
});

// ── Q-52-01-07: searchStrategies ─────────────────────────────────────────────

describe('Q-52-01-07: MarketplaceApi.searchStrategies', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
    api.publishStrategy(createMockStrategy({ name: 'Momentum Trend Strategy', description: 'High sharpe momentum', tags: ['momentum', 'trend'] }));
    api.publishStrategy(createMockStrategy({ name: 'Mean Reversion Strategy', description: 'Statistical arbitrage', tags: ['mean-reversion'] }));
    api.publishStrategy(createMockStrategy({ name: 'Trend Follower', description: 'Breakout strategy', tags: ['trend'] }));
    api.publishStrategy(createMockStrategy({ visibility: 'private', name: 'Private Strategy', tags: ['momentum'] }));
  });

  it('L07-01: returns all public strategies when query is empty', () => {
    const result = api.searchStrategies('');
    expect(result.total).toBe(3);
  });

  it('L07-02: searches by name (case-insensitive)', () => {
    const result = api.searchStrategies('momentum');
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('Momentum Trend Strategy');
  });

  it('L07-03: searches by description', () => {
    const result = api.searchStrategies('Breakout');
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('Trend Follower');
  });

  it('L07-04: searches by tag', () => {
    const result = api.searchStrategies('trend');
    expect(result.total).toBe(2);
  });

  it('L07-05: private strategies excluded from search', () => {
    const result = api.searchStrategies('momentum');
    const found = result.strategies.find(s => s.name === 'Private Strategy');
    expect(found).toBeUndefined();
  });

  it('L07-06: returns empty result when nothing matches', () => {
    const result = api.searchStrategies('nonexistent');
    expect(result.total).toBe(0);
    expect(result.strategies.length).toBe(0);
  });

  it('L07-07: combines query with filter (tag)', () => {
    const result = api.searchStrategies('strategy', { tag: 'trend', sortBy: 'newest', page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
    expect(result.strategies.every(s => s.tags.includes('trend'))).toBe(true);
  });
});

// ── Q-52-01-08: StrategyMarketplaceSearch ───────────────────────────────────

describe('Q-52-01-08: StrategyMarketplaceSearch', () => {
  let search: StrategyMarketplaceSearch;

  beforeEach(() => {
    search = new StrategyMarketplaceSearch();
    search.addStrategy(createMockMetric({ strategyId: 's1', name: 'Alpha Fund', sharpe: 2.0, rating: 4.5 }));
    search.addStrategy(createMockMetric({ strategyId: 's2', name: 'Beta Fund', sharpe: 1.2, rating: 3.8 }));
    search.addStrategy(createMockMetric({ strategyId: 's3', name: 'Gamma Fund', sharpe: 2.8, rating: 4.9 }));
  });

  it('L08-01: search returns results for keyword match', () => {
    const result = search.search({ keyword: 'Alpha' });
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('Alpha Fund');
  });

  it('L08-02: search filters by minSharpe', () => {
    const result = search.search({ minSharpe: 2.0 });
    expect(result.total).toBe(2);
    expect(result.strategies.every(s => s.sharpe >= 2.0)).toBe(true);
  });

  it('L08-03: search filters by maxRisk', () => {
    const result = search.search({ maxRisk: -5 });
    expect(result.total).toBe(2);
    expect(result.strategies.every(s => s.risk <= -5)).toBe(true);
  });

  it('L08-04: search sorts by sharpe (desc)', () => {
    const result = search.search({ sortBy: 'sharpe', sortOrder: 'desc' });
    expect(result.strategies[0].sharpe).toBe(2.8);
    expect(result.strategies[1].sharpe).toBe(2.0);
    expect(result.strategies[2].sharpe).toBe(1.2);
  });

  it('L08-05: search sorts by rating (desc)', () => {
    const result = search.search({ sortBy: 'rating', sortOrder: 'desc' });
    expect(result.strategies[0].name).toBe('Gamma Fund');
    expect(result.strategies[0].rating).toBe(4.9);
  });

  it('L08-06: pagination works', () => {
    const result = search.search({ page: 1, pageSize: 2 });
    expect(result.strategies.length).toBe(2);
    expect(result.totalPages).toBe(2);
  });

  it('L08-07: search by tag', () => {
    search.addStrategy(createMockMetric({ strategyId: 's4', name: 'Delta', tags: ['high-risk'] }));
    const result = search.search({ tags: ['high-risk'] });
    expect(result.total).toBe(1);
    expect(result.strategies[0].strategyId).toBe('s4');
  });

  it('L08-08: getTopStrategies returns sorted strategies', () => {
    const top = search.getTopStrategies(2);
    expect(top.length).toBe(2);
    expect(top[0].sharpe).toBeGreaterThanOrEqual(top[1].sharpe);
  });
});

// ── Q-52-01-09: Full Workflow ───────────────────────────────────────────────

describe('Q-52-01-09: MarketplaceApi Full Workflow', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    api = new MarketplaceApi();
  });

  it('L09-01: complete publish → search → rate → download → delete workflow', () => {
    // Publish
    const id = api.publishStrategy(createMockStrategy({ name: 'Workflow Test', sharpe: 3.0 }));
    expect(api.getStrategy(id)).not.toBeNull();

    // Search
    const searchResult = api.searchStrategies('Workflow');
    expect(searchResult.total).toBe(1);
    expect(searchResult.strategies[0].id).toBe(id);

    // Rate
    api.rateStrategy(id, { userId: 'u1', rating: 5 });
    api.rateStrategy(id, { userId: 'u2', rating: 4 });
    expect(api.getStrategy(id)!.rating).toBe(4.5);
    expect(api.getStrategy(id)!.ratingCount).toBe(2);

    // Download
    api.downloadStrategy(id);
    expect(api.getStrategy(id)!.downloads).toBe(1);

    // Delete
    expect(api.deleteStrategy(id)).toBe(true);
    expect(api.getStrategy(id)).toBeNull();
  });

  it('L09-02: rating affects sort order (strategy with higher rating ranks first)', () => {
    const id1 = api.publishStrategy(createMockStrategy({ name: 'Low Rated', sharpe: 2.0 }));
    const id2 = api.publishStrategy(createMockStrategy({ name: 'High Rated', sharpe: 2.0 }));
    api.rateStrategy(id1, { userId: 'u1', rating: 3 });
    api.rateStrategy(id2, { userId: 'u1', rating: 5 });
    const result = api.getStrategies({ sortBy: 'rating', page: 1, pageSize: 10 });
    expect(result.strategies[0].id).toBe(id2);
    expect(result.strategies[1].id).toBe(id1);
  });
});