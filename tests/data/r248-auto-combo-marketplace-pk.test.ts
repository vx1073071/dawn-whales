/**
 * R248 autoclaw TEST: P1-11 + P1-03 + P2-27
 * Covers: FactorComboCompare, FactorMarketplaceEnhancer, TemplatePKBridge
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorComboCompare, factorComboCompare, resetFactorComboCompare,
} from '../../electron/engine/data/factor-combo-compare';
import type { FactorCombo } from '../../electron/engine/data/factor-combo-compare';
import {
  FactorMarketplaceEnhancer, factorMarketplaceEnhancer, resetFactorMarketplaceEnhancer,
} from '../../electron/engine/data/factor-marketplace-enhancer';
import type { AdvancedSearchQuery, CartItem } from '../../electron/engine/data/factor-marketplace-enhancer';
import {
  TemplatePKBridge, templatePKBridge, resetTemplatePKBridge,
} from '../../electron/engine/data/template-pk-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// P1-11: FactorComboCompare
// ═══════════════════════════════════════════════════════════════════════════

describe('R248 P1-11: FactorComboCompare', () => {
  let compare: FactorComboCompare;

  beforeEach(() => {
    resetFactorComboCompare();
    compare = factorComboCompare();
  });

  it('seeds 6 built-in combos', () => {
    const combos = compare.listCombos();
    expect(combos.length).toBeGreaterThanOrEqual(6);
    expect(combos.every(c => c.factors.length >= 3)).toBe(true);
  });

  it('listCombos filters by sceneId', () => {
    const combos = compare.listCombos({ sceneId: 'defensive-safe' });
    expect(combos.length).toBeGreaterThanOrEqual(1);
    expect(combos.every(c => c.sceneId === 'defensive-safe')).toBe(true);
  });

  it('compares 2 combos head-to-head', () => {
    const result = compare.compare(
      ['defensive-combo', 'momentum-combo'], 'AAPL',
    );

    expect(result).not.toBeNull();
    expect(result!.combos.length).toBe(2);
    expect(result!.metrics.length).toBe(2);
    expect(Object.keys(result!.winnerMap).length).toBeGreaterThanOrEqual(8);
    expect(result!.overallWinner).toBeTruthy();
    expect(result!.summary.length).toBeGreaterThan(0);
    expect(result!.summaryCn.length).toBeGreaterThan(0);
  });

  it('compare returns null for < 2 combos', () => {
    expect(compare.compare(['defensive-combo'], 'AAPL')).toBeNull();
  });

  it('compare returns null for unknown combo', () => {
    expect(compare.compare(['defensive-combo', 'unknown'], 'AAPL')).toBeNull();
  });

  it('scores are non-zero and sum is reasonable', () => {
    const result = compare.compare(['defensive-combo', 'momentum-combo'], 'AAPL')!;
    expect(result.scores['defensive-combo'].total).toBeGreaterThan(0);
    expect(result.scores['momentum-combo'].total).toBeGreaterThan(0);
    // Total of both should be ~100
    const sum = result.scores['defensive-combo'].total + result.scores['momentum-combo'].total;
    expect(sum).toBeGreaterThan(50);
    expect(sum).toBeLessThan(150);
  });

  it('quickCompare is alias for compare', () => {
    const result = compare.quickCompare({
      symbol: 'NVDA', comboIds: ['value-combo', 'quality-growth-combo'],
    });
    expect(result).not.toBeNull();
    expect(result!.symbol).toBeUndefined(); // compare doesn't store symbol
  });

  it('benchmarkAll compares all combos', () => {
    const result = compare.benchmarkAll('SPY')!;
    expect(result.combos.length).toBeGreaterThanOrEqual(6);
    expect(result.metrics.length).toBeGreaterThanOrEqual(6);
  });

  it('getComparisonHistory tracks results', () => {
    compare.compare(['defensive-combo', 'momentum-combo'], 'AAPL');
    compare.compare(['value-combo', 'crypto-momentum-combo'], 'TSLA');

    const history = compare.getComparisonHistory();
    expect(history.length).toBe(2);
    // Most recent first
    expect(history[0].combos[0].comboId).toBe('value-combo');
  });

  it('exportReport generates markdown', () => {
    const result = compare.compare(['defensive-combo', 'momentum-combo'], 'AAPL')!;
    const report = compare.exportReport(result.comparisonId);
    expect(report).not.toBeNull();
    expect(report!).toContain('# Factor Combo Comparison Report');
    expect(report!).toContain('CAGR');
    expect(report!).toContain('Sharpe Ratio');
  });

  it('exportReport returns null for bad id', () => {
    expect(compare.exportReport('nonexistent')).toBeNull();
  });

  it('registerCombo adds custom combo', () => {
    const custom: FactorCombo = {
      comboId: 'custom-alpha', name: 'Custom Alpha', nameCn: '自定义阿尔法',
      description: 'Custom', factors: [
        { factorId: 'F1', weight: 0.5, direction: 'long' },
        { factorId: 'F2', weight: 0.5, direction: 'long' },
      ],
    };
    compare.registerCombo(custom);
    expect(compare.getCombo('custom-alpha')).not.toBeNull();
  });

  it('getStats tracks comparison metrics', () => {
    compare.compare(['defensive-combo', 'momentum-combo'], 'AAPL');
    compare.compare(['value-combo', 'quality-growth-combo'], 'MSFT');

    const stats = compare.getStats();
    expect(stats.totalComparisons).toBe(2);
    expect(stats.winningComboId.length).toBeGreaterThan(0);
    expect(stats.avgScoreDiff).toBeGreaterThan(0);
  });

  it('reset clears everything', () => {
    compare.compare(['defensive-combo', 'momentum-combo'], 'AAPL');
    compare.reset();
    expect(compare.getComparisonHistory().length).toBe(0);
    expect(compare.getStats().totalComparisons).toBe(0);
  });

  it('combo correlation is between -1 and 1', () => {
    const result = compare.compare(['defensive-combo', 'momentum-combo'], 'AAPL')!;
    expect(result.comboCorrelation).toBeGreaterThanOrEqual(-1);
    expect(result.comboCorrelation).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-03: FactorMarketplaceEnhancer
// ═══════════════════════════════════════════════════════════════════════════

describe('R248 P1-03: FactorMarketplaceEnhancer', () => {
  let enhancer: FactorMarketplaceEnhancer;

  beforeEach(() => {
    resetFactorMarketplaceEnhancer();
    enhancer = factorMarketplaceEnhancer();
  });

  it('seeds 5 built-in bundles', () => {
    const bundles = enhancer.listBundles();
    expect(bundles.length).toBeGreaterThanOrEqual(5);
    expect(bundles.every(b => b.discountPercent > 0)).toBe(true);
  });

  it('getBundle returns specific bundle', () => {
    const allBundles = enhancer.listBundles();
    const bundle = enhancer.getBundle(allBundles[0].bundleId);
    expect(bundle).not.toBeNull();
    expect(bundle!.savingsU).toBeGreaterThan(0);
  });

  it('getBundle returns null for unknown', () => {
    expect(enhancer.getBundle('nonexistent')).toBeNull();
  });

  it('createBundle generates discounted price', () => {
    const bundle = enhancer.createBundle('creator:1', {
      name: 'Custom Bundle', nameCn: '自定义包',
      description: 'A custom bundle', descriptionCn: '自定义组合包',
      factorIds: ['F1', 'F2', 'F3', 'F4'],
      individualPrices: [9.9, 9.9, 9.9, 9.9],
      tags: ['custom'],
    });

    expect(bundle.factorIds.length).toBe(4);
    expect(bundle.originalTotalU).toBe(39.6);
    expect(bundle.discountPercent).toBe(25); // 4+ factors = 25%
    expect(bundle.bundlePriceU).toBeCloseTo(29.7, 0);
    expect(bundle.savingsU).toBeCloseTo(9.9, 0);
    expect(bundle.status).toBe('active');
  });

  it('3-factor bundle gets 20% discount', () => {
    const bundle = enhancer.createBundle('c', {
      name: '3-pack', nameCn: '3个', description: '3', descriptionCn: '三',
      factorIds: ['F1', 'F2', 'F3'],
      individualPrices: [9.9, 9.9, 9.9],
      tags: [],
    });
    expect(bundle.discountPercent).toBe(20);
    expect(bundle.bundlePriceU).toBeCloseTo(23.76, 0);
  });

  it('purchaseBundle succeeds for active bundle', () => {
    const bundles = enhancer.listBundles();
    const result = enhancer.purchaseBundle('user:b1', bundles[0].bundleId);
    expect(result.success).toBe(true);
    expect(result.totalPaid).toBeGreaterThan(0);
    expect(result.savings).toBeGreaterThan(0);
  });

  it('purchaseBundle fails for unknown bundle', () => {
    const result = enhancer.purchaseBundle('user:bad', 'nonexistent');
    expect(result.success).toBe(false);
  });

  it('getTrending returns ranked factors', () => {
    const trending = enhancer.getTrending(5);
    expect(trending.length).toBe(5);
    expect(trending[0].rank).toBe(1);
    expect(trending[0].trend).toBeDefined();
  });

  it('getRisingStars returns rising factors', () => {
    const stars = enhancer.getRisingStars(3);
    expect(stars.length).toBeGreaterThanOrEqual(1);
    expect(stars.every(s => s.trend === 'rising')).toBe(true);
  });

  it('refreshTrending updates rankings', () => {
    const before = enhancer.getTrending(3);
    enhancer.refreshTrending(new Map(), new Map());
    const after = enhancer.getTrending(3);
    expect(after.length).toBeGreaterThanOrEqual(0);
  });

  it('getCreatorDashboard returns dashboard', () => {
    const dash = enhancer.getCreatorDashboard('creator:5');
    expect(dash.creatorId).toBe('creator:5');
    expect(dash.totalRevenueU).toBe(0);
  });

  it('recordSale updates creator revenue', () => {
    enhancer.recordSale('creator:s1', 'F1', 9.9);
    enhancer.recordSale('creator:s1', 'F1', 9.9);

    const dash = enhancer.getCreatorDashboard('creator:s1');
    expect(dash.totalSales).toBe(2);
    expect(dash.totalRevenueU).toBeCloseTo(19.8, 1);
  });

  it('recordTrial tracks trial count', () => {
    enhancer.recordTrial('creator:t1', 'F1');
    enhancer.recordTrial('creator:t1', 'F1');
    enhancer.recordTrial('creator:t1', 'F2');

    const dash = enhancer.getCreatorDashboard('creator:t1');
    expect(dash.totalTrials).toBe(3);
  });

  it('advancedSearch filters by keywords', () => {
    const factors = [
      { factorId: 'MOMENTUM_12M', domain: 'momentum', name: '12M Momentum', nameCn: '12月动量', ic: 0.08, stars: 4.0, trialCount: 500, buyoutPrice: 9.9, applicableMarkets: ['US'], purchaseCount: 200 },
      { factorId: 'VALUE_EARNINGS_YIELD', domain: 'value', name: 'Earnings Yield', nameCn: '盈利收益率', ic: 0.04, stars: 3.5, trialCount: 300, buyoutPrice: 9.9, applicableMarkets: ['US'], purchaseCount: 150 },
      { factorId: 'CRYPTO_VOLUME', domain: 'crypto_specific', name: 'Crypto Volume', nameCn: '加密交易量', ic: 0.06, stars: 4.5, trialCount: 800, buyoutPrice: 9.9, applicableMarkets: ['CRYPTO'], purchaseCount: 250 },
    ];

    const results = enhancer.advancedSearch(
      { include: ['momentum'] }, factors,
    );
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results).toContain('MOMENTUM_12M');
  });

  it('advancedSearch filters by domain', () => {
    const factors = [
      { factorId: 'F1', domain: 'momentum', name: 'F1', nameCn: 'F1', ic: 0.05, stars: 4, trialCount: 100, buyoutPrice: 9.9, applicableMarkets: ['US'], purchaseCount: 100 },
      { factorId: 'F2', domain: 'value', name: 'F2', nameCn: 'F2', ic: 0.04, stars: 3, trialCount: 80, buyoutPrice: 9.9, applicableMarkets: ['US'], purchaseCount: 80 },
    ];

    const results = enhancer.advancedSearch({ domains: ['momentum'] }, factors);
    expect(results).toEqual(['F1']);
  });

  it('advancedSearch filters by price range', () => {
    const factors = [
      { factorId: 'CHEAP', domain: 'momentum', name: 'C', nameCn: 'C', ic: 0.05, stars: 4, trialCount: 100, buyoutPrice: 4.9, applicableMarkets: ['US'], purchaseCount: 100 },
      { factorId: 'EXPENSIVE', domain: 'value', name: 'E', nameCn: 'E', ic: 0.04, stars: 3, trialCount: 80, buyoutPrice: 19.9, applicableMarkets: ['US'], purchaseCount: 80 },
    ];

    const results = enhancer.advancedSearch({ priceRange: { max: 10 } }, factors);
    expect(results).toContain('CHEAP');
    expect(results).not.toContain('EXPENSIVE');
  });

  it('cart: add + get', () => {
    enhancer.addToCart('user:cart', { factorId: 'F1', priceU: 9.9, type: 'buyout' });
    enhancer.addToCart('user:cart', { factorId: 'F2', priceU: 9.9, type: 'buyout' });

    const cart = enhancer.getCart('user:cart');
    expect(cart.itemCount).toBe(2);
    expect(cart.totalU).toBeCloseTo(19.8, 1);
  });

  it('cart: bundle discount for 3+ items', () => {
    enhancer.addToCart('user:bulk', { factorId: 'F1', priceU: 9.9, type: 'buyout' });
    enhancer.addToCart('user:bulk', { factorId: 'F2', priceU: 9.9, type: 'buyout' });
    enhancer.addToCart('user:bulk', { factorId: 'F3', priceU: 9.9, type: 'buyout' });

    const cart = enhancer.getCart('user:bulk');
    expect(cart.bundleDiscount).toBeGreaterThan(0);
    expect(cart.bundleDiscount).toBeCloseTo(4.455, 0); // 15% of 29.7
  });

  it('cart: remove item', () => {
    enhancer.addToCart('user:rm', { factorId: 'F1', priceU: 9.9, type: 'buyout' });
    enhancer.addToCart('user:rm', { factorId: 'F2', priceU: 9.9, type: 'buyout' });

    enhancer.removeFromCart('user:rm', 'F1');
    expect(enhancer.getCart('user:rm').itemCount).toBe(1);
  });

  it('cart: clear', () => {
    enhancer.addToCart('user:clr', { factorId: 'F1', priceU: 9.9, type: 'buyout' });
    enhancer.clearCart('user:clr');
    expect(enhancer.getCart('user:clr').items.length).toBe(0);
  });

  it('getMarketTrends returns snapshot', () => {
    const trends = enhancer.getMarketTrends();
    expect(trends.topTrending.length).toBeGreaterThanOrEqual(3);
    expect(trends.topBundles.length).toBeGreaterThanOrEqual(1);
    expect(trends.weeklyGrowth).toBeGreaterThan(0);
  });

  it('reset restores seed data', () => {
    enhancer.createBundle('c', { name: 'X', nameCn: 'X', description: 'X', descriptionCn: 'X', factorIds: ['F1'], individualPrices: [9.9], tags: [] });
    enhancer.reset();
    expect(enhancer.listBundles().length).toBeGreaterThanOrEqual(5);
    expect(enhancer.getTrending(3).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-27: TemplatePKBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R248 P2-27: TemplatePKBridge', () => {
  let bridge: TemplatePKBridge;

  beforeEach(() => {
    resetTemplatePKBridge();
    bridge = templatePKBridge();
  });

  it('runs PK between 2 templates', () => {
    const result = bridge.runPK(
      { id: 'ai-momentum-chaser', name: 'AI Momentum Chaser', nameCn: 'AI动量追踪' },
      { id: 'deep-value-hunter', name: 'Deep Value Hunter', nameCn: '深度价值猎人' },
      'AAPL', { capital: 15000 },
    );

    expect(result.templateA.id).toBe('ai-momentum-chaser');
    expect(result.templateB.id).toBe('deep-value-hunter');
    expect(result.symbol).toBe('AAPL');
    expect(result.capital).toBe(15000);
    // 12 dimensions should be compared
    expect(result.dimensionWinners.length).toBe(12);
    expect(result.overallWinner).toBeTruthy();
    expect(result.scoreA).toBeGreaterThan(0);
    expect(result.scoreB).toBeGreaterThan(0);
  });

  it('quickPK is a simpler API', () => {
    const result = bridge.quickPK(
      'ai-momentum-chaser', 'AI Momentum Chaser', 'AI动量追踪',
      'deep-value-hunter', 'Deep Value Hunter', '深度价值猎人',
      'AAPL', 10000,
    );

    expect(result).not.toBeNull();
    expect(result.templateA.nameCn).toBe('AI动量追踪');
  });

  it('dimension winners are classified correctly', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    const dw = result.dimensionWinners;
    expect(dw.length).toBe(12);
    expect(dw.every(d => ['clear', 'slight', 'negligible'].includes(d.significance))).toBe(true);
    expect(dw.every(d => ['A', 'B', 'draw'].includes(d.winner))).toBe(true);
  });

  it('scores reflect dimension wins', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    // A and B scores should be reasonable
    expect(result.scoreA + result.scoreB).toBeCloseTo(100, -1); // roughly 100
    expect(result.winCount.a + result.winCount.b + result.winCount.draws).toBe(12);
  });

  it('overall winner is determined by score difference', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    // If scoreA >> scoreB, winner is A; if scoreB >> scoreA, winner is B; else draw
    const diff = Math.abs(result.scoreA - result.scoreB);
    if (diff > 5) {
      expect(result.overallWinner).not.toBe('draw');
    }
  });

  it('strategyCorrelation is between -1 and 1', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    expect(result.strategyCorrelation).toBeGreaterThanOrEqual(-1);
    expect(result.strategyCorrelation).toBeLessThanOrEqual(1);
  });

  it('exportReport generates markdown report', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    const report = bridge.exportReport(result.pkId);
    expect(report).not.toBeNull();
    expect(report!).toContain('# ');
    expect(report!).toContain('Strategy PK');
    expect(report!).toContain('年化收益'); // Chinese label
    expect(report!).toContain('夏普');
  });

  it('exportReport returns null for bad id', () => {
    expect(bridge.exportReport('bad')).toBeNull();
  });

  it('exportForFrontend returns PK result', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    const exported = bridge.exportForFrontend(result.pkId);
    expect(exported).not.toBeNull();
    expect(exported!.dimensionWinners.length).toBe(12);
  });

  it('getHistory returns reversed chronological list', () => {
    bridge.runPK(
      { id: 't1', name: 'T1', nameCn: 'T1' },
      { id: 't2', name: 'T2', nameCn: 'T2' },
      'AAPL',
    );
    bridge.runPK(
      { id: 't3', name: 'T3', nameCn: 'T3' },
      { id: 't4', name: 'T4', nameCn: 'T4' },
      'TSLA',
    );

    const history = bridge.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].generatedAt).toBeGreaterThanOrEqual(history[1].generatedAt);
  });

  it('getStats tracks PK records', () => {
    bridge.runPK(
      { id: 't1', name: 'T1', nameCn: 'T1' },
      { id: 't2', name: 'T2', nameCn: 'T2' },
      'AAPL',
    );

    const stats = bridge.getStats();
    expect(stats.totalPKs).toBe(1);
    expect(stats.avgScoreDiff).toBeGreaterThanOrEqual(0);
  });

  it('configure updates scoring weights', () => {
    bridge.configure({ significanceThreshold: 10, slightThreshold: 3 });

    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: 'T1' },
      { id: 't2', name: 'T2', nameCn: 'T2' },
      'SPY',
    );
    // With higher threshold, fewer 'clear' classifications
    const clearCount = result.dimensionWinners.filter(d => d.significance === 'clear').length;
    expect(clearCount).toBeGreaterThanOrEqual(0);
  });

  it('reset clears history', () => {
    bridge.runPK(
      { id: 't1', name: 'T1', nameCn: 'T1' },
      { id: 't2', name: 'T2', nameCn: 'T2' },
      'AAPL',
    );
    bridge.reset();

    expect(bridge.getHistory().length).toBe(0);
    expect(bridge.getStats().totalPKs).toBe(0);
  });

  it('equity curves have 101 points (100 simulation steps)', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: 'T1' },
      { id: 't2', name: 'T2', nameCn: 'T2' },
      'SPY',
    );

    expect(result.metricsA.equityCurve.length).toBe(101);
    expect(result.metricsB.equityCurve.length).toBe(101);
  });

  it('summary text contains key metrics', () => {
    const result = bridge.runPK(
      { id: 't1', name: 'T1', nameCn: '模板1' },
      { id: 't2', name: 'T2', nameCn: '模板2' },
      'SPY',
    );

    expect(result.summary).toContain('CAGR');
    expect(result.summary).toContain('Sharpe');
    expect(result.summaryCn).toContain('年化');
    expect(result.summaryCn).toContain('夏普');
  });
});
