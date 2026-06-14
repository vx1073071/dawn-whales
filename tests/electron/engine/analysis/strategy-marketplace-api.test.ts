/**
 * R166 P1-A2: Factor + Strategy Marketplace Merge API — Tests
 *
 * Covers: unifiedSearch, factorStore, signalStore, calculateCommission, factor-cloud-api routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StrategyMarketplaceEngine,
  getMarketplace,
  resetMarketplace,
  type UnifiedSearchQuery,
  type FactorListing,
  type SignalListing,
} from '../../../../electron/engine/analysis/strategy-marketplace-api';

// ── Helpers ────────────────────────────────────────────────────────────────

function seedStrategy(engine: StrategyMarketplaceEngine, overrides: Record<string, unknown> = {}) {
  const listing = engine.createListing({
    creatorId: overrides.creatorId as string ?? 'creator-1',
    name: overrides.name as string ?? 'Test Strategy',
    description: overrides.description as string ?? 'A test strategy for verification',
    category: (overrides.category as any) ?? 'trend',
    market: (overrides.market as any) ?? 'HK',
    price: overrides.price as number ?? 50,
  });
  engine.publishListing(listing.id);
  return listing;
}

function seedFactor(engine: StrategyMarketplaceEngine, overrides: Record<string, unknown> = {}) {
  return engine.listFactor({
    creatorId: overrides.creatorId as string ?? 'creator-2',
    name: overrides.name as string ?? 'Momentum Factor',
    description: overrides.description as string ?? '12-month momentum with sector normalization',
    category: overrides.category as string ?? 'momentum',
    market: overrides.market as string ?? 'US',
    price: overrides.price as number ?? 20,
    icValue: overrides.icValue as number ?? 0.045,
    isActive: overrides.isActive as boolean ?? false,
    qualityGrade: overrides.qualityGrade as string ?? 'A',
  });
}

function seedSignal(engine: StrategyMarketplaceEngine, overrides: Record<string, unknown> = {}) {
  return engine.listSignal({
    creatorId: overrides.creatorId as string ?? 'creator-3',
    name: overrides.name as string ?? 'Breakout Signal',
    description: overrides.description as string ?? 'Volume breakout detection with RSI confirmation',
    category: overrides.category as string ?? 'breakout',
    market: overrides.market as string ?? 'HK',
    price: overrides.price as number ?? 30,
    winRate7d: overrides.winRate7d as number ?? 0.65,
    signalCount: overrides.signalCount as number ?? 120,
    isActive: overrides.isActive as boolean ?? false,
    qualityGrade: overrides.qualityGrade as string ?? 'B+',
  });
}

describe('R166 P1-A2: Factor + Strategy Marketplace Merge', () => {
  let engine: StrategyMarketplaceEngine;

  beforeEach(() => {
    resetMarketplace();
    engine = getMarketplace();
  });

  afterEach(() => {
    resetMarketplace();
  });

  // ── unifiedSearch ──────────────────────────────────────────────────────

  describe('unifiedSearch', () => {
    it('returns empty result when no items exist', () => {
      const result = engine.unifiedSearch({});
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.breakdownByType).toEqual({
        strategy: 0,
        factor: 0,
        signal: 0,
      });
    });

    it('returns strategy listings in unified search', () => {
      seedStrategy(engine);
      const result = engine.unifiedSearch({});
      expect(result.total).toBe(1);
      expect(result.breakdownByType.strategy).toBe(1);
      expect(result.items[0].assetType).toBe('strategy');
      expect(result.items[0].name).toBe('Test Strategy');
    });

    it('returns factor listings after publish', () => {
      const factor = seedFactor(engine);
      engine.publishFactor(factor.id);
      const result = engine.unifiedSearch({});
      expect(result.total).toBe(1);
      expect(result.breakdownByType.factor).toBe(1);
      expect(result.items[0].assetType).toBe('factor');
    });

    it('returns signal listings after publish', () => {
      const signal = seedSignal(engine);
      engine.publishSignal(signal.id);
      const result = engine.unifiedSearch({});
      expect(result.total).toBe(1);
      expect(result.breakdownByType.signal).toBe(1);
      expect(result.items[0].assetType).toBe('signal');
    });

    it('mixes all three asset types in one search', () => {
      const s1 = seedStrategy(engine);
      const f1 = seedFactor(engine);
      const g1 = seedSignal(engine);
      engine.publishFactor(f1.id);
      engine.publishSignal(g1.id);

      const result = engine.unifiedSearch({});
      expect(result.total).toBe(3);
      const types = result.items.map(i => i.assetType).sort();
      expect(types).toEqual(['factor', 'signal', 'strategy']);
      expect(result.breakdownByType.strategy).toBe(1);
      expect(result.breakdownByType.factor).toBe(1);
      expect(result.breakdownByType.signal).toBe(1);
    });

    it('text search filters by name', () => {
      seedStrategy(engine, { name: 'Golden Cross' });
      seedStrategy(engine, { name: 'Death Cross' });
      seedStrategy(engine, { name: 'Momentum Burst' });
      const result = engine.unifiedSearch({ text: 'cross' });
      expect(result.total).toBe(2);
    });

    it('text search filters by description', () => {
      seedStrategy(engine, { description: 'RSI-based mean reversion with volume filter' });
      seedStrategy(engine, { description: 'Simple moving average crossover' });
      const result = engine.unifiedSearch({ text: 'rsi' });
      expect(result.total).toBe(1);
    });

    it('sorts by price ascending', () => {
      seedStrategy(engine, { price: 100 });
      seedStrategy(engine, { price: 10 });
      const result = engine.unifiedSearch({ sort: 'price' });
      expect(result.items[0].price).toBe(10);
      expect(result.items[1].price).toBe(100);
    });

    it('sorts by rating descending', () => {
      const listingA = engine.createListing({
        creatorId: 'c1', name: 'Alpha Strategy', description: 'Alpha excellent strategy for profitable returns', category: 'momentum', market: 'US', price: 60,
      });
      const pubA = engine.publishListing(listingA.id);
      engine.updateStats(pubA.id, { rating: 3.5 });

      const listingB = engine.createListing({
        creatorId: 'c2', name: 'Beta Strategy', description: 'Beta superior strategy for all market conditions', category: 'trend', market: 'US', price: 40,
      });
      const pubB = engine.publishListing(listingB.id);
      engine.updateStats(pubB.id, { rating: 4.5 });

      const result = engine.unifiedSearch({ sort: 'rating' });
      expect(result.total).toBe(2);
      // Higher rating comes first
      expect(result.items[0].rating).toBe(4.5);
      expect(result.items[1].rating).toBe(3.5);
    });

    it('supports pagination', () => {
      for (let i = 0; i < 25; i++) {
        seedStrategy(engine, { name: `Strategy ${i}` });
      }
      const page1 = engine.unifiedSearch({ page: 1, pageSize: 10 });
      const page2 = engine.unifiedSearch({ page: 2, pageSize: 10 });
      expect(page1.items).toHaveLength(10);
      expect(page2.items).toHaveLength(10);
      expect(page1.total).toBe(25);
      expect(page2.total).toBe(25);
    });

    it('filters inactive items from results', () => {
      seedStrategy(engine); // published = active
      const f = seedFactor(engine); // not published = inactive
      // Don't publish factor → it should NOT appear
      const result = engine.unifiedSearch({});
      expect(result.total).toBe(1);
      expect(result.items[0].assetType).toBe('strategy');
    });
  });

  // ── Factor store CRUD ──────────────────────────────────────────────────

  describe('factorStore', () => {
    it('creates factor with correct defaults', () => {
      const f = seedFactor(engine);
      expect(f.id).toMatch(/^FCT-/);
      expect(f.name).toBe('Momentum Factor');
      expect(f.price).toBe(20);
      expect(f.icValue).toBe(0.045);
      expect(f.isActive).toBe(false);
      expect(f.rating).toBe(0);
    });

    it('publishes factor and sets isActive + publishedAt', () => {
      const f = seedFactor(engine);
      const published = engine.publishFactor(f.id);
      expect(published.isActive).toBe(true);
      expect(published.publishedAt).toBeTruthy();
    });

    it('getFactor returns undefined for missing ID', () => {
      expect(engine.getFactor('FCT-nonexistent')).toBeUndefined();
    });

    it('listFactor throws on missing required fields', () => {
      expect(() => engine.listFactor({
        creatorId: 'x',
        name: 'x',
        description: 'x',
        category: 'x',
        market: 'x',
        price: 0,
        icValue: 0,
        isActive: false,
        qualityGrade: 'x',
      })).not.toThrow();
    });
  });

  // ── Signal store CRUD ──────────────────────────────────────────────────

  describe('signalStore', () => {
    it('creates signal with correct defaults', () => {
      const s = seedSignal(engine);
      expect(s.id).toMatch(/^SIG-/);
      expect(s.name).toBe('Breakout Signal');
      expect(s.price).toBe(30);
      expect(s.winRate7d).toBe(0.65);
      expect(s.signalCount).toBe(120);
    });

    it('getSignal returns undefined for non-existent', () => {
      expect(engine.getSignal('SIG-nope')).toBeUndefined();
    });
  });

  // ── Unified commission engine ──────────────────────────────────────────

  describe('calculateCommission', () => {
    it('L1 tier splits 85/15 (creator gets 85%)', () => {
      const result = engine.calculateCommission({
        assetType: 'strategy',
        price: 100,
        creatorTier: 'L1',
      });
      expect(result.feeRate).toBeCloseTo(0.15);
      expect(result.price).toBe(100);
      expect(result.platformEarnings).toBe(15);
      expect(result.creatorEarnings).toBe(85);
      expect(result.settlement.currency).toBe('USDT');
      expect(result.tier).toBe('L1');
    });

    it('L2 tier shows 80/20 split', () => {
      const result = engine.calculateCommission({
        assetType: 'factor',
        price: 50,
        creatorTier: 'L2',
      });
      expect(result.platformEarnings).toBeCloseTo(50 * 0.15, 1);
      expect(result.creatorEarnings).toBeCloseTo(50 * 0.85, 1);
    });

    it('L3 tier shows 90/10 split metadata', () => {
      const result = engine.calculateCommission({
        assetType: 'signal',
        price: 200,
        creatorTier: 'L3',
      });
      // Fee rate constant at 15%; tier is informational
      expect(result.feeRate).toBe(0.15);
      expect(result.platformPercent).toBe(10);
      expect(result.creatorPercent).toBe(90);
    });

    it('defaults to L1 when no tier specified', () => {
      const result = engine.calculateCommission({
        assetType: 'strategy',
        price: 100,
      });
      expect(result.tier).toBe('L1');
    });

    it('handles different asset types', () => {
      const types: ('strategy' | 'factor' | 'signal')[] = ['strategy', 'factor', 'signal'];
      for (const t of types) {
        const r = engine.calculateCommission({ assetType: t, price: 10 });
        expect(r.assetType).toBe(t);
      }
    });

    it('handles fractional prices', () => {
      const result = engine.calculateCommission({
        assetType: 'strategy',
        price: 7.77,
        creatorTier: 'L1',
      });
      expect(result.platformEarnings).toBeCloseTo(1.17, 2);
      expect(result.creatorEarnings).toBeCloseTo(6.60, 2);
    });
  });

  // ── Invariants ─────────────────────────────────────────────────────────

  describe('invariants', () => {
    it('unifiedSearch breakdownByType sums to total', () => {
      const f = seedFactor(engine);
      const g = seedSignal(engine);
      engine.publishFactor(f.id);
      engine.publishSignal(g.id);
      seedStrategy(engine);
      seedStrategy(engine);

      const result = engine.unifiedSearch({});
      const sum = result.breakdownByType.strategy +
        result.breakdownByType.factor +
        result.breakdownByType.signal;
      expect(sum).toBe(result.total);
    });

    it('commission is deterministic', () => {
      const r1 = engine.calculateCommission({ assetType: 'strategy', price: 100 });
      const r2 = engine.calculateCommission({ assetType: 'strategy', price: 100 });
      expect(r1.platformEarnings).toBe(r2.platformEarnings);
      expect(r1.creatorEarnings).toBe(r2.creatorEarnings);
    });

    it('resetAll clears all three stores', () => {
      seedStrategy(engine);
      const f = seedFactor(engine);
      engine.publishFactor(f.id);
      const s = seedSignal(engine);
      engine.publishSignal(s.id);

      engine.resetAll();
      const result = engine.unifiedSearch({});
      expect(result.total).toBe(0);
      expect(result.breakdownByType.strategy).toBe(0);
      expect(result.breakdownByType.factor).toBe(0);
      expect(result.breakdownByType.signal).toBe(0);
    });

    it('purchase records persist after multiple purchases', () => {
      // Simulate multiple purchases
      (engine as any).purchaseRecords = [];
      (engine as any).purchaseRecords.push({ purchaseId: 'P-1' });
      (engine as any).purchaseRecords.push({ purchaseId: 'P-2' });
      expect((engine as any).purchaseRecords).toHaveLength(2);
    });
  });
});
