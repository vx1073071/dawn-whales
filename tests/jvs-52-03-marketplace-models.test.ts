/**
 * J-52-03: Strategy Marketplace Data Model Tests (R52 P1)
 * Validation + Factory + Migration
 *
 * ≥15 tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateStrategy,
  validateReview,
  validateSubscription,
  createStrategy,
  createSubscription,
  createReview,
  createEarningRecord,
  runMigration,
  getMigrationHistory,
  resetIdCounter,
  resetMigrationHistory,
  SCHEMA_VERSION,
} from '../electron/engine/analysis/marketplace-models';

beforeEach(() => {
  resetIdCounter();
  resetMigrationHistory();
});

// ── Section 1: Strategy Validation ─────────────────────────────────────────

describe('J-52-03: Strategy Validation', () => {
  it('01: valid strategy passes', () => {
    const result = validateStrategy({
      name: 'Test Strategy',
      description: 'A test strategy',
      authorId: 'author-1',
      category: 'momentum',
      market: 'us-equity',
      sharpe: 1.5,
      winRate: 60,
    });
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('02: empty name fails', () => {
    const result = validateStrategy({ name: '', authorId: 'a1' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('03: missing authorId fails', () => {
    const result = validateStrategy({ name: 'Test', authorId: '' });
    expect(result.valid).toBe(false);
  });

  it('04: invalid category fails', () => {
    const result = validateStrategy({ name: 'Test', authorId: 'a1', category: 'invalid' as any });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'category')).toBe(true);
  });

  it('05: invalid market fails', () => {
    const result = validateStrategy({ name: 'Test', authorId: 'a1', market: 'invalid' as any });
    expect(result.valid).toBe(false);
  });

  it('06: negative price fails', () => {
    const result = validateStrategy({ name: 'Test', authorId: 'a1', price: -10 });
    expect(result.valid).toBe(false);
  });

  it('07: winRate out of range fails', () => {
    const result = validateStrategy({ name: 'Test', authorId: 'a1', winRate: 150 });
    expect(result.valid).toBe(false);
  });

  it('08: too many tags fails', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    const result = validateStrategy({ name: 'Test', authorId: 'a1', tags });
    expect(result.valid).toBe(false);
  });

  it('09: name >= 50 chars fails', () => {
    const result = validateStrategy({ name: 'A'.repeat(201), authorId: 'a1' });
    expect(result.valid).toBe(false);
  });

  it('10: description > 5000 chars fails', () => {
    const result = validateStrategy({ name: 'Test', authorId: 'a1', description: 'X'.repeat(5001) });
    expect(result.valid).toBe(false);
  });
});

// ── Section 2: Review & Subscription Validation ────────────────────────────

describe('J-52-03: Review & Subscription Validation', () => {
  it('11: valid review passes', () => {
    const result = validateReview({ strategyId: 's1', userId: 'u1', rating: 4 });
    expect(result.valid).toBe(true);
  });

  it('12: review with rating > 5 fails', () => {
    const result = validateReview({ strategyId: 's1', userId: 'u1', rating: 6 });
    expect(result.valid).toBe(false);
  });

  it('13: valid subscription passes', () => {
    const result = validateSubscription({ strategyId: 's1', userId: 'u1', tier: 'basic', platformFee: 15, authorRevenue: 85 });
    expect(result.valid).toBe(true);
  });

  it('14: subscription with revenue > 100% fails', () => {
    const result = validateSubscription({ strategyId: 's1', userId: 'u1', platformFee: 50, authorRevenue: 60 });
    expect(result.valid).toBe(false);
  });

  it('15: subscription with invalid tier fails', () => {
    const result = validateSubscription({ strategyId: 's1', userId: 'u1', tier: 'gold' as any });
    expect(result.valid).toBe(false);
  });
});

// ── Section 3: Factory Functions ───────────────────────────────────────────

describe('J-52-03: Factory Functions', () => {
  it('16: createStrategy generates complete model', () => {
    const s = createStrategy({ name: 'Test', authorId: 'a1', authorName: 'Alice' });
    expect(s.id).toMatch(/^strat_/);
    expect(s.version).toBe(1);
    expect(s.status).toBe('draft');
    expect(s.rating).toBe(0);
    expect(s.subscriberCount).toBe(0);
    expect(s.createdAt).toBeDefined();
  });

  it('17: createSubscription with default values', () => {
    const sub = createSubscription({ strategyId: 's1', userId: 'u1' });
    expect(sub.tier).toBe('free');
    expect(sub.status).toBe('active');
    expect(sub.platformFee).toBe(15);
    expect(sub.authorRevenue).toBe(85);
  });

  it('18: createReview generates pending review', () => {
    const rev = createReview({ strategyId: 's1', userId: 'u1', userName: 'Alice', rating: 5 });
    expect(rev.status).toBe('pending');
    expect(rev.helpful).toBe(0);
  });

  it('19: createEarningRecord calculates platform fee', () => {
    const e = createEarningRecord({ strategyId: 's1', authorId: 'a1', period: 'monthly', grossRevenue: 100 });
    expect(e.platformFee).toBe(15);
    expect(e.netRevenue).toBe(85);
    expect(e.status).toBe('pending');
  });
});

// ── Section 4: Migration ───────────────────────────────────────────────────

describe('J-52-03: Migration V1 → V2', () => {
  it('20: migrates V1 data to V2 schema', () => {
    const v1Data = [
      { id: 'old_1', name: 'Old Strategy', author: 'alice', downloads: 10, subscribers: 5 },
      { id: 'old_2', name: 'Another', author: 'bob', returns: 15.5, trades: 200 },
    ];
    const { migrated, record } = runMigration(1, v1Data);
    expect(migrated.length).toBe(2);
    expect(migrated[0].version).toBe(2);
    expect(migrated[0].authorId).toBe('alice');
    expect(migrated[0].authorName).toBe('alice');
    expect(migrated[0].downloadCount).toBe(10);
    expect(migrated[0].subscriberCount).toBe(5);
    expect(migrated[1].annualReturn).toBe(15.5);
    expect(migrated[1].totalTrades).toBe(200);
    expect(record.success).toBe(true);
    expect(record.version).toBe(2);
  });

  it('21: migration records history', () => {
    runMigration(1, [{ name: 'Test', author: 'x' }]);
    const history = getMigrationHistory();
    expect(history.length).toBe(1);
    expect(history[0].version).toBe(2);
    expect(history[0].success).toBe(true);
  });

  it('22: unsupported migration version returns failure', () => {
    const { migrated, record } = runMigration(99, []);
    expect(migrated.length).toBe(0);
    expect(record.success).toBe(false);
  });

  it('23: SCHEMA_VERSION is 2', () => {
    expect(SCHEMA_VERSION).toBe(2);
  });
});
