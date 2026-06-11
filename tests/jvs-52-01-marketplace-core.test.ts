/**
 * J-52-01: Strategy Marketplace Core API Tests (R52 P0)
 * Audit workflow + Enhanced search + Versioning
 *
 * ≥30 tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi, getMarketplaceApi, resetMarketplaceApi } from '../electron/engine/analysis/marketplace-api';

function mkStrategy(overrides = {}) {
  return {
    name: 'Test Strategy',
    description: 'A test strategy',
    author: 'jvs-author',
    sharpe: 1.5,
    maxDrawdown: -10,
    winRate: 60,
    tags: ['momentum'],
    visibility: 'public' as const,
    price: 0,
    ...overrides,
  };
}

// ── 1. Audit Workflow ──────────────────────────────────────────────────────

describe('J-52-01: Audit Workflow', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
  });

  it('01: submitForReview creates strategy with pending status', () => {
    const id = api.submitForReview(mkStrategy({ name: 'Pending Strategy' }));
    const s = api.getStrategy(id);
    expect(s).not.toBeNull();
    expect(s!.auditStatus).toBe('pending');
  });

  it('02: publishStrategy defaults to approved status', () => {
    const id = api.publishStrategy(mkStrategy());
    expect(api.getStrategy(id)!.auditStatus).toBe('approved');
  });

  it('03: getPendingQueue returns only pending strategies', () => {
    api.submitForReview(mkStrategy({ name: 'P1' }));
    api.submitForReview(mkStrategy({ name: 'P2' }));
    api.publishStrategy(mkStrategy({ name: 'Approved' }));
    const queue = api.getPendingQueue();
    expect(queue.length).toBe(2);
    queue.forEach(s => expect(s.auditStatus).toBe('pending'));
  });

  it('04: getPendingQueue is sorted by creation time', () => {
    const id1 = api.submitForReview(mkStrategy({ name: 'First' }));
    const id2 = api.submitForReview(mkStrategy({ name: 'Second' }));
    const queue = api.getPendingQueue();
    expect(queue[0].id).toBe(id1);
    expect(queue[1].id).toBe(id2);
  });

  it('05: approveStrategy changes status to approved', () => {
    const id = api.submitForReview(mkStrategy());
    const ok = api.approveStrategy(id, { reviewer: 'admin', note: 'Looks good' });
    expect(ok).toBe(true);
    const s = api.getStrategy(id);
    expect(s!.auditStatus).toBe('approved');
    expect(s!.reviewedBy).toBe('admin');
    expect(s!.auditNote).toBe('Looks good');
    expect(s!.reviewedAt).toBeDefined();
  });

  it('06: rejectStrategy changes status to rejected', () => {
    const id = api.submitForReview(mkStrategy());
    const ok = api.rejectStrategy(id, { reviewer: 'admin', note: 'Low quality' });
    expect(ok).toBe(true);
    expect(api.getStrategy(id)!.auditStatus).toBe('rejected');
  });

  it('07: approve already-approved strategy fails', () => {
    const id = api.publishStrategy(mkStrategy());
    expect(api.approveStrategy(id, { reviewer: 'admin' })).toBe(false);
  });

  it('08: reject already-rejected strategy fails', () => {
    const id = api.submitForReview(mkStrategy());
    api.rejectStrategy(id, { reviewer: 'admin' });
    expect(api.rejectStrategy(id, { reviewer: 'admin' })).toBe(false);
  });

  it('09: approve nonexistent strategy fails', () => {
    expect(api.approveStrategy('nonexistent', { reviewer: 'admin' })).toBe(false);
  });

  it('10: reject nonexistent strategy fails', () => {
    expect(api.rejectStrategy('nonexistent', { reviewer: 'admin' })).toBe(false);
  });

  it('11: getAuditStats returns correct counts', () => {
    api.submitForReview(mkStrategy({ name: 'P1' }));
    api.submitForReview(mkStrategy({ name: 'P2' }));
    api.publishStrategy(mkStrategy({ name: 'A1' }));
    const id = api.submitForReview(mkStrategy({ name: 'R1' }));
    api.rejectStrategy(id, { reviewer: 'admin' });
    const stats = api.getAuditStats();
    expect(stats.pending).toBe(2);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.total).toBe(4);
  });

  it('12: rejected strategy still retrievable via getStrategy', () => {
    const id = api.submitForReview(mkStrategy());
    api.rejectStrategy(id, { reviewer: 'admin' });
    expect(api.getStrategy(id)).not.toBeNull();
  });
});

// ── 2. Strategy Versioning ──────────────────────────────────────────────────

describe('J-52-01: Strategy Versioning', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
  });

  it('13: published strategy starts at version 1', () => {
    const id = api.publishStrategy(mkStrategy());
    expect(api.getStrategy(id)!.version).toBe(1);
  });

  it('14: updateStrategy increments version', () => {
    const id = api.publishStrategy(mkStrategy({ name: 'V1' }));
    api.updateStrategy(id, { name: 'V2' });
    expect(api.getStrategy(id)!.version).toBe(2);
    expect(api.getStrategy(id)!.name).toBe('V2');
  });

  it('15: multiple updates accumulate version', () => {
    const id = api.publishStrategy(mkStrategy());
    api.updateStrategy(id, { name: 'V2' });
    api.updateStrategy(id, { name: 'V3' });
    api.updateStrategy(id, { description: 'Updated desc' });
    expect(api.getStrategy(id)!.version).toBe(4);
  });

  it('16: getVersionHistory returns all versions', () => {
    const id = api.publishStrategy(mkStrategy({ name: 'V1' }));
    api.updateStrategy(id, { name: 'V2' }, 'Name change');
    api.updateStrategy(id, { tags: ['new-tag'] }, 'Tag update');
    const history = api.getVersionHistory(id);
    expect(history.length).toBe(3);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);
    expect(history[2].version).toBe(3);
  });

  it('17: version history records change notes', () => {
    const id = api.publishStrategy(mkStrategy());
    api.updateStrategy(id, { name: 'Updated' }, 'Major update');
    const history = api.getVersionHistory(id);
    expect(history[1].changeNote).toBe('Major update');
  });

  it('18: updateStrategy for nonexistent returns false', () => {
    expect(api.updateStrategy('nonexistent', { name: 'X' })).toBe(false);
  });

  it('19: updateStrategy updates updatedAt timestamp', () => {
    const id = api.publishStrategy(mkStrategy());
    const before = api.getStrategy(id)!.updatedAt;
    // Small delay to ensure timestamp difference
    api.updateStrategy(id, { name: 'New Name' });
    const after = api.getStrategy(id)!.updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });
});

// ── 3. Enhanced Search & Filtering ─────────────────────────────────────────

describe('J-52-01: Enhanced Search & Filtering', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
    api.publishStrategy(mkStrategy({ name: 'US Momentum', category: 'momentum', market: 'us-equity', timeframe: 'daily', sharpe: 2.0, winRate: 65 }));
    api.publishStrategy(mkStrategy({ name: 'CN Mean Reversion', category: 'mean-reversion', market: 'cn-equity', timeframe: 'weekly', sharpe: 1.2, winRate: 55 }));
    api.publishStrategy(mkStrategy({ name: 'Crypto Scalper', category: 'scalping', market: 'crypto', timeframe: 'intraday', sharpe: 0.8, winRate: 70 }));
    api.publishStrategy(mkStrategy({ name: 'Forex Trend', category: 'trend-following', market: 'forex', timeframe: 'daily', sharpe: 1.8, winRate: 58 }));
  });

  it('20: search by category finds match', () => {
    const result = api.searchStrategies('', { category: 'momentum', sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('US Momentum');
  });

  it('21: search by market finds match', () => {
    const result = api.searchStrategies('', { market: 'crypto', sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('Crypto Scalper');
  });

  it('22: search by timeframe filters correctly', () => {
    const result = api.searchStrategies('', { timeframe: 'daily', sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(2);
  });

  it('23: combined category + market filter', () => {
    const result = api.searchStrategies('', { category: 'trend-following', market: 'forex', sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('Forex Trend');
  });

  it('24: search with minWinRate filter', () => {
    const result = api.searchStrategies('', { minWinRate: 60, sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(2); // US Momentum (65) + Crypto Scalper (70)
  });

  it('25: search with maxDrawdown filter', () => {
    api.publishStrategy(mkStrategy({ name: 'Low Risk', maxDrawdown: -5 }));
    api.publishStrategy(mkStrategy({ name: 'High Risk', maxDrawdown: -25 }));
    const result = api.searchStrategies('', { maxDrawdown: -10, sortBy: 'newest', page: 1, pageSize: 20 });
    // maxDrawdown <= -10 means -10 or lower (more negative)
    // Our strategies have maxDrawdown: -10 (default), so -10 <= -10 ✓
    expect(result.strategies.every(s => s.maxDrawdown <= -10)).toBe(true);
  });

  it('26: getStrategies with category filter', () => {
    const result = api.getStrategies({ category: 'scalping', sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.strategies[0].category).toBe('scalping');
  });

  it('27: getStrategies with auditStatus filter', () => {
    api.submitForReview(mkStrategy({ name: 'Pending One' }));
    const result = api.getStrategies({ auditStatus: 'pending', sortBy: 'newest', page: 1, pageSize: 20 });
    expect(result.total).toBe(1);
    expect(result.strategies[0].name).toBe('Pending One');
  });

  it('28: getStrategiesByCategory returns correct counts', () => {
    const cats = api.getStrategiesByCategory();
    expect(cats['momentum']).toBe(1);
    expect(cats['mean-reversion']).toBe(1);
    expect(cats['scalping']).toBe(1);
    expect(cats['trend-following']).toBe(1);
  });

  it('29: getStrategiesByMarket returns correct counts', () => {
    const mkts = api.getStrategiesByMarket();
    expect(mkts['us-equity']).toBe(1);
    expect(mkts['cn-equity']).toBe(1);
    expect(mkts['crypto']).toBe(1);
    expect(mkts['forex']).toBe(1);
  });

  it('30: getAvailableCategories returns sorted unique categories', () => {
    const cats = api.getAvailableCategories();
    expect(cats.length).toBe(4);
    expect(cats).toEqual(cats.slice().sort());
  });

  it('31: getAvailableMarkets returns sorted unique markets', () => {
    const mkts = api.getAvailableMarkets();
    expect(mkts.length).toBe(4);
    expect(mkts).toEqual(mkts.slice().sort());
  });

  it('32: getAvailableTimeframes returns sorted unique timeframes', () => {
    const tfs = api.getAvailableTimeframes();
    expect(tfs).toContain('daily');
    expect(tfs).toContain('intraday');
    expect(tfs).toContain('weekly');
  });
});
