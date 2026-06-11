/**
 * Q-52-01: Strategy Marketplace API Tests (R52 P0)
 * 策略市场 API 测试套件 — 发布/审核/搜索/订阅/评价全流程
 *
 * Coverage: ≥350L, 35+ tests
 * Uses singleton pattern: getMarketplaceApi() / resetMarketplaceApi()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi, getMarketplaceApi, resetMarketplaceApi } from '../electron/engine/analysis/marketplace-api';

// ── Test Fixtures ────────────────────────────────────────────────────────────

function mkStrategy(overrides = {}) {
  return {
    name: 'Test Strategy',
    description: 'A test strategy for unit testing',
    author: 'qtest-author',
    sharpe: 1.5,
    maxDrawdown: -10,
    winRate: 62,
    tags: ['momentum', 'daily'],
    visibility: 'public' as const,
    price: 0,
    ...overrides,
  };
}

// ── Section 1: Publish ───────────────────────────────────────────────────────

describe('Q-52-01-01: Publish Strategy', () => {
  beforeEach(() => { resetMarketplaceApi(); });

  it('A01-01: publishStrategy returns a valid id', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.startsWith('strat_')).toBe(true);
  });

  it('A01-02: published strategy is retrievable', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ name: 'My Strategy' }));
    const strategy = api.getStrategy(id);
    expect(strategy).not.toBeNull();
    expect(strategy!.name).toBe('My Strategy');
    expect(strategy!.author).toBe('qtest-author');
    expect(strategy!.downloads).toBe(0);
    expect(strategy!.rating).toBe(0);
    expect(strategy!.ratingCount).toBe(0);
    expect(strategy!.visibility).toBe('public');
  });

  it('A01-03: published strategy auto-generates timestamps', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy());
    const strategy = api.getStrategy(id)!;
    expect(strategy.createdAt).toBeDefined();
    expect(strategy.updatedAt).toBeDefined();
    expect(new Date(strategy.createdAt).getTime()).toBeGreaterThan(0);
    expect(strategy.createdAt).toBe(strategy.updatedAt);
  });

  it('A01-04: multiple publishes get unique ids', () => {
    const api = getMarketplaceApi();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(api.publishStrategy(mkStrategy({ name: `S${i}` })));
    }
    expect(ids.size).toBe(50);
  });

  it('A01-05: private strategy is stored', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ name: 'Private', visibility: 'private' }));
    const strategy = api.getStrategy(id);
    expect(strategy).not.toBeNull();
    expect(strategy!.visibility).toBe('private');
  });
});

// ── Section 2: Get Strategies & Pagination ───────────────────────────────────

describe('Q-52-01-02: Get Strategies & Pagination', () => {
  beforeEach(() => {
    resetMarketplaceApi();
    const api = getMarketplaceApi();
    for (let i = 0; i < 25; i++) {
      api.publishStrategy(mkStrategy({
        name: `Strategy ${i}`,
        sharpe: 1 + i * 0.1,
        rating: i < 10 ? 4.0 : 3.0,
        tags: i % 2 === 0 ? ['trend'] : ['momentum'],
      }));
    }
  });

  it('B01-01: returns all public strategies by default', () => {
    const api = getMarketplaceApi();
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(25);
    expect(result.strategies.length).toBe(20);
  });

  it('B01-02: page 2 retrieves remaining strategies', () => {
    const api = getMarketplaceApi();
    const result = api.getStrategies({ sortBy: 'newest', page: 2, pageSize: 20 });
    expect(result.total).toBe(25);
    expect(result.strategies.length).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
  });

  it('B01-03: sort by sharpe descending', () => {
    const api = getMarketplaceApi();
    const result = api.getStrategies({ sortBy: 'sharpe', page: 1, pageSize: 25 });
    for (let i = 0; i < result.strategies.length - 1; i++) {
      expect(result.strategies[i].sharpe).toBeGreaterThanOrEqual(result.strategies[i + 1].sharpe);
    }
  });

  it('B01-04: sort by rating descending', () => {
    const api = getMarketplaceApi();
    const result = api.getStrategies({ sortBy: 'rating', page: 1, pageSize: 25 });
    for (let i = 0; i < result.strategies.length - 1; i++) {
      expect(result.strategies[i].rating).toBeGreaterThanOrEqual(result.strategies[i + 1].rating);
    }
  });

  it('B01-05: filter by tag returns correct subset', () => {
    const api = getMarketplaceApi();
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100, tag: 'trend' });
    expect(result.strategies.length).toBe(13); // 0,2,4,...,24
    result.strategies.forEach(s => expect(s.tags).toContain('trend'));
  });

  it('B01-06: filter by minRating returns only high-rated', () => {
    // Isolated test — publish fresh strategies and rate them
    resetMarketplaceApi();
    const api = getMarketplaceApi();
    for (let i = 0; i < 15; i++) api.publishStrategy(mkStrategy({ name: `S${i}` }));
    const all = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100 });
    // Rate exactly the first 10 to 5
    all.strategies.slice(0, 10).forEach((s, i) => {
      api.rateStrategy(s.id, { userId: `u${i}`, rating: 5, createdAt: new Date().toISOString() });
    });
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 100, minRating: 4 });
    expect(result.total).toBe(10);
    result.strategies.forEach(s => expect(s.rating).toBeGreaterThanOrEqual(4));
  });

  it('B01-07: empty page beyond range returns empty array', () => {
    const api = getMarketplaceApi();
    const result = api.getStrategies({ sortBy: 'newest', page: 100, pageSize: 20 });
    expect(result.strategies.length).toBe(0);
    expect(result.total).toBe(25);
  });
});

// ── Section 3: Rating ────────────────────────────────────────────────────────

describe('Q-52-01-03: Rating Strategy', () => {
  let api: MarketplaceApi;
  let strategyId: string;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
    strategyId = api.publishStrategy(mkStrategy({ name: 'Rateable' }));
  });

  it('C01-01: rateStrategy returns true on success', () => {
    const ok = api.rateStrategy(strategyId, {
      userId: 'user1', rating: 5, createdAt: new Date().toISOString(),
    });
    expect(ok).toBe(true);
  });

  it('C01-02: rating updates strategy', () => {
    api.rateStrategy(strategyId, { userId: 'user1', rating: 5, createdAt: new Date().toISOString() });
    const strategy = api.getStrategy(strategyId)!;
    expect(strategy.rating).toBe(5);
    expect(strategy.ratingCount).toBe(1);
  });

  it('C01-03: multiple ratings calculate average', () => {
    api.rateStrategy(strategyId, { userId: 'u1', rating: 5, createdAt: new Date().toISOString() });
    api.rateStrategy(strategyId, { userId: 'u2', rating: 3, createdAt: new Date().toISOString() });
    api.rateStrategy(strategyId, { userId: 'u3', rating: 4, createdAt: new Date().toISOString() });
    const strategy = api.getStrategy(strategyId)!;
    expect(strategy.rating).toBe(4); // (5+3+4)/3 = 4.0
    expect(strategy.ratingCount).toBe(3);
  });

  it('C01-04: rating 0 is valid (reset expectation)', () => {
    const ok = api.rateStrategy(strategyId, { userId: 'u1', rating: 0, createdAt: new Date().toISOString() });
    expect(ok).toBe(true);
    expect(api.getStrategy(strategyId)!.rating).toBe(0);
  });

  it('C01-05: rating 5 is valid', () => {
    const ok = api.rateStrategy(strategyId, { userId: 'u1', rating: 5, createdAt: new Date().toISOString() });
    expect(ok).toBe(true);
    expect(api.getStrategy(strategyId)!.rating).toBe(5);
  });

  it('C01-06: rating below 0 is rejected', () => {
    const ok = api.rateStrategy(strategyId, { userId: 'u1', rating: -1, createdAt: new Date().toISOString() });
    expect(ok).toBe(false);
  });

  it('C01-07: rating above 5 is rejected', () => {
    const ok = api.rateStrategy(strategyId, { userId: 'u1', rating: 6, createdAt: new Date().toISOString() });
    expect(ok).toBe(false);
  });

  it('C01-08: rating nonexistent strategy returns false', () => {
    const ok = api.rateStrategy('nonexistent', { userId: 'u1', rating: 5, createdAt: new Date().toISOString() });
    expect(ok).toBe(false);
  });

  it('C01-09: rating with comment is stored', () => {
    const ok = api.rateStrategy(strategyId, {
      userId: 'u1', rating: 5,
      comment: 'Excellent! Best strategy ever!',
      createdAt: new Date().toISOString(),
    });
    expect(ok).toBe(true);
  });
});

// ── Section 4: Download ───────────────────────────────────────────────────────

describe('Q-52-01-04: Download Strategy', () => {
  let api: MarketplaceApi;
  let strategyId: string;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
    strategyId = api.publishStrategy(mkStrategy());
  });

  it('D01-01: download increments counter', () => {
    const result = api.downloadStrategy(strategyId);
    expect(result).not.toBeNull();
    expect(result!.downloads).toBe(1);
  });

  it('D01-02: multiple downloads accumulate', () => {
    for (let i = 0; i < 10; i++) api.downloadStrategy(strategyId);
    expect(api.getStrategy(strategyId)!.downloads).toBe(10);
  });

  it('D01-03: download nonexistent returns null', () => {
    expect(api.downloadStrategy('nonexistent')).toBeNull();
  });

  it('D01-04: download returns updated strategy', () => {
    const result = api.downloadStrategy(strategyId)!;
    expect(result.downloads).toBe(1);
    // updatedAt should reflect download; verify it exists
    expect(result.updatedAt).toBeDefined();
  });
});

// ── Section 5: Delete ────────────────────────────────────────────────────────

describe('Q-52-01-05: Delete Strategy', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
  });

  it('E01-01: delete returns true on success', () => {
    const id = api.publishStrategy(mkStrategy());
    expect(api.deleteStrategy(id)).toBe(true);
  });

  it('E01-02: deleted strategy is not retrievable', () => {
    const id = api.publishStrategy(mkStrategy());
    api.deleteStrategy(id);
    expect(api.getStrategy(id)).toBeNull();
  });

  it('E01-03: delete nonexistent returns false', () => {
    expect(api.deleteStrategy('nonexistent')).toBe(false);
  });

  it('E01-04: double delete returns false', () => {
    const id = api.publishStrategy(mkStrategy());
    expect(api.deleteStrategy(id)).toBe(true);
    expect(api.deleteStrategy(id)).toBe(false);
    expect(api.deleteStrategy(id)).toBe(false);
  });

  it('E01-05: deleted strategy absent from list', () => {
    const id = api.publishStrategy(mkStrategy({ name: 'ToDelete' }));
    api.publishStrategy(mkStrategy({ name: 'ToKeep' }));
    api.deleteStrategy(id);
    const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 10 });
    expect(result.strategies.find(s => s.id === id)).toBeUndefined();
    expect(result.total).toBe(1);
  });
});

// ── Section 6: Search ───────────────────────────────────────────────────────

describe('Q-52-01-06: Search Strategies', () => {
  beforeEach(() => {
    resetMarketplaceApi();
    const api = getMarketplaceApi();
    api.publishStrategy(mkStrategy({ name: 'MA Cross Strategy', description: 'Moving average crossover', tags: ['ma', 'momentum'] }));
    api.publishStrategy(mkStrategy({ name: 'RSI Reversal', description: 'RSI mean reversion', tags: ['rsi', 'reversal'] }));
    api.publishStrategy(mkStrategy({ name: 'Bollinger Band', description: 'Bollinger Bands breakout', tags: ['bollinger', 'breakout'] }));
    api.publishStrategy(mkStrategy({ name: 'MACD Trend', description: 'MACD momentum', tags: ['macd', 'momentum'] }));
  });

  it('F01-01: search by name finds match', () => {
    const api = getMarketplaceApi();
    const result = api.searchStrategies('MA Cross');
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('MA Cross Strategy');
  });

  it('F01-02: search by description finds match', () => {
    const api = getMarketplaceApi();
    const result = api.searchStrategies('mean reversion');
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('RSI Reversal');
  });

  it('F01-03: search by tag finds match', () => {
    const api = getMarketplaceApi();
    const result = api.searchStrategies('momentum');
    expect(result.total).toBe(2);
  });

  it('F01-04: search is case-insensitive', () => {
    const api = getMarketplaceApi();
    expect(api.searchStrategies('macd').total).toBe(1);
    expect(api.searchStrategies('MACD').total).toBe(1);
    expect(api.searchStrategies('Macd').total).toBe(1);
  });

  it('F01-05: search with no match returns empty', () => {
    const api = getMarketplaceApi();
    const result = api.searchStrategies('nonexistent xyz');
    expect(result.total).toBe(0);
    expect(result.strategies.length).toBe(0);
  });

  it('F01-06: search with filter minRating works', () => {
    const api = getMarketplaceApi();
    const id = api.publishStrategy(mkStrategy({ name: 'High Rated' }));
    api.rateStrategy(id, { userId: 'u1', rating: 5, createdAt: new Date().toISOString() });
    const result = api.searchStrategies('', { minRating: 4, sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('High Rated');
  });

  it('F01-07: empty search string returns all public', () => {
    const api = getMarketplaceApi();
    const result = api.searchStrategies('');
    expect(result.total).toBe(4);
  });
});

// ── Section 7: Top Strategies ───────────────────────────────────────────────

describe('Q-52-01-07: Top Strategies', () => {
  beforeEach(() => {
    resetMarketplaceApi();
    const api = getMarketplaceApi();
    for (let i = 0; i < 5; i++) {
      const id = api.publishStrategy(mkStrategy({ name: `S${i}`, sharpe: 1 + i }));
      if (i < 2) {
        api.rateStrategy(id, { userId: `u${i}`, rating: 5 - i, createdAt: new Date().toISOString() });
      }
    }
  });

  it('G01-01: getTopStrategies returns sorted by rating', () => {
    const api = getMarketplaceApi();
    const top = api.getTopStrategies(10);
    expect(top.length).toBe(5);
    for (let i = 0; i < top.length - 1; i++) {
      expect(top[i].rating).toBeGreaterThanOrEqual(top[i + 1].rating);
    }
  });

  it('G01-02: getTopStrategies respects limit', () => {
    const api = getMarketplaceApi();
    expect(api.getTopStrategies(3).length).toBe(3);
  });
});

// ── Section 8: Statistics & Tags ────────────────────────────────────────────

describe('Q-52-01-08: Statistics & Tags', () => {
  beforeEach(() => {
    resetMarketplaceApi();
    const api = getMarketplaceApi();
    api.publishStrategy(mkStrategy({ name: 'S1', tags: ['momentum', 'ma'] }));
    api.publishStrategy(mkStrategy({ name: 'S2', tags: ['momentum', 'rsi'] }));
    api.publishStrategy(mkStrategy({ name: 'S3', tags: ['mean-reversion'] }));
  });

  it('H01-01: getStats returns correct totals', () => {
    const api = getMarketplaceApi();
    const stats = api.getStats();
    expect(stats.totalStrategies).toBe(3);
    expect(stats.avgSharpe).toBe(1.5);
  });

  it('H01-02: getAllTags returns unique sorted tags', () => {
    const api = getMarketplaceApi();
    const tags = api.getAllTags();
    expect(tags).toContain('momentum');
    expect(tags).toContain('ma');
    expect(tags).toContain('rsi');
    expect(tags).toContain('mean-reversion');
    expect(tags.length).toBe(4);
    expect(tags).toEqual(tags.slice().sort());
  });

  it('H01-03: clearAll removes everything', () => {
    const api = getMarketplaceApi();
    api.clearAll();
    expect(api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 20 }).total).toBe(0);
    expect(api.getStats().totalStrategies).toBe(0);
  });
});
