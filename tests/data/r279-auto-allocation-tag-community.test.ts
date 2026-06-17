/**
 * R279 autoclaw test — GlobalAllocation + StrategyMarketFactorTag + FactorCommunityIPC
 * 
 * Coverage:
 *   auto#1: GlobalAllocationBridge (20 tests)
 *     - universe: getUniverse/getAsset/addAsset/removeAsset/getByAssetClass/getByCountry
 *     - correlation: getCorrelations/getCorrelation/setCorrelation
 *     - constraints: add/remove/get/clearConstraints/generateDefaultConstraints
 *     - optimization: equal_weight/risk_parity/min_variance/mean_variance + applyConstraints
 *     - rebalance: computeRebalance/drift calculation
 *     - scenario: runScenario/presets/getScenario
 *     - attribution: computeAttribution with benchmark
 *     - analytics: riskDecomposition/efficientFrontier
 *     - benchmark: setBenchmark/setStandardBenchmark
 *     - lifecycle: stats/onOptimize/onRebalance/reset
 * 
 *   auto#2: StrategyMarketFactorTagBridge (15 tests)
 *     - register: registerStrategy/getStrategy/getAllStrategies/getByCategory
 *     - tagging: addTag/getTags/getTagsByType/getPrimaryFactors/removeTag
 *     - auto-tag: auto-tags on register by category
 *     - reverse lookup: getStrategiesByFactor/getStrategiesByFactorRanked
 *     - multi-factor: getStrategiesByFactors
 *     - recommendation: recommendByExposure/recommendBySignals
 *     - analytics: computeFactorUsage/computeAnalysis/getCoverageHeatmap
 *     - search/filter: searchStrategies/filterByRisk/filterByPrice/getTopRated
 *     - lifecycle: stats/reset
 * 
 *   auto#3: FactorCommunityIPCBridge (15 tests)
 *     - combo CRUD: publishCombo/getCombo/getAllCombos/searchCombos/deleteCombo
 *     - rating/download/fork: rateCombo/downloadCombo/forkCombo
 *     - verification: verifyCombo
 *     - comments: addComment/getComments/likeComment
 *     - kits: createKit/getKit/getAllKits/getKitsByScene
 *     - leaderboard: getLeaderboard/getTopContributors
 *     - reputation: getUserReputation
 *     - export/import: exportAsKit/importKit
 *     - events: getEvents/getEventsByType/getRecentEvents
 *     - weekly spotlight
 *     - lifecycle: stats/onEvent/reset
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { GlobalAllocationBridge, getAllocationBridge, resetAllocationBridge } from '../../electron/engine/data/global-allocation-bridge';
import { StrategyMarketFactorTagBridge, getTagBridge, resetTagBridge } from '../../electron/engine/data/strategy-market-factor-tag-bridge';
import { FactorCommunityIPCBridge, getCommunityIPC, resetCommunityIPC } from '../../electron/engine/data/factor-community-ipc-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// auto#1: GlobalAllocationBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R279-auto#1 GlobalAllocationBridge', () => {
  let bridge: GlobalAllocationBridge;

  beforeEach(() => {
    resetAllocationBridge();
    bridge = getAllocationBridge();
  });

  // ── Universe ────────────────────────────────────────────────────────────

  describe('universe', () => {
    it('should have default universe (13 assets)', () => {
      const universe = bridge.getUniverse();
      expect(universe.length).toBe(13);
      expect(universe.map(a => a.id)).toContain('SPY');
      expect(universe.map(a => a.id)).toContain('BTC');
    });

    it('should get single asset by id', () => {
      const spy = bridge.getAsset('SPY');
      expect(spy).not.toBeNull();
      expect(spy!.assetClass).toBe('equity_us');
    });

    it('should add and remove assets', () => {
      bridge.addAsset({
        id:'TEST', name:'Test', nameCn:'测试', assetClass:'cash', country:'US',
        currency:'USD', expectedReturn:0.01, volatility:0.02, sharpeRatio:0.5,
        maxDrawdown:0.01, liquidity:1.0, esgScore:7, factorExposures:{},
      });
      expect(bridge.getAsset('TEST')).not.toBeNull();

      bridge.removeAsset('TEST');
      expect(bridge.getAsset('TEST')).toBeNull();
    });

    it('should filter by asset class', () => {
      const eq = bridge.getByAssetClass('equity_us');
      expect(eq.length).toBeGreaterThanOrEqual(2);
      expect(eq.every(a => a.assetClass === 'equity_us')).toBe(true);
    });

    it('should filter by country', () => {
      const us = bridge.getByCountry('US');
      expect(us.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Correlation ─────────────────────────────────────────────────────────

  describe('correlation', () => {
    it('should get all correlations', () => {
      const corrs = bridge.getCorrelations();
      expect(corrs.length).toBeGreaterThanOrEqual(10);
    });

    it('should get correlation between two assets', () => {
      const corr = bridge.getCorrelation('SPY', 'AGG');
      expect(corr).toBe(-0.2);
    });

    it('should set custom correlation', () => {
      bridge.setCorrelation('SPY', 'GLD', 0.5);
      expect(bridge.getCorrelation('SPY', 'GLD')).toBe(0.5);
    });
  });

  // ── Constraints ─────────────────────────────────────────────────────────

  describe('constraints', () => {
    it('should add and remove constraints', () => {
      bridge.addConstraint({ type:'max_weight', value:0.25 });
      expect(bridge.getConstraints().length).toBe(1);

      bridge.removeConstraint(0);
      expect(bridge.getConstraints().length).toBe(0);
    });

    it('should generate default constraints by profile', () => {
      bridge.generateDefaultConstraints('conservative');
      expect(bridge.getConstraints().length).toBeGreaterThan(3);
    });
  });

  // ── Optimization ────────────────────────────────────────────────────────

  describe('optimization', () => {
    it('should equal-weight optimize', () => {
      const result = bridge.optimize('equal_weight');
      expect(result.method).toBe('equal_weight');
      expect(result.efficient).toBe(true);

      // Weights should sum to ~1
      const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1, 2);
    });

    it('should risk-parity optimize', () => {
      // Lower vol assets should have higher weight
      const result = bridge.optimize('risk_parity');
      expect(result.method).toBe('risk_parity');
      expect(result.weights['SHY']).toBeGreaterThan(result.weights['BTC']);
    });

    it('should min-variance optimize', () => {
      const result = bridge.optimize('min_variance');
      expect(result.method).toBe('min_variance');
      expect(result.volatility).toBeLessThan(0.3);
    });

    it('should mean-variance optimize', () => {
      const result = bridge.optimize('mean_variance');
      expect(result.method).toBe('mean_variance');
      expect(result.expectedReturn).toBeGreaterThan(0);
      expect(result.sharpeRatio).toBeGreaterThan(0);
    });

    it('should apply allocation constraints', () => {
      bridge.addConstraint({ type:'max_weight', value:0.10 });
      const result = bridge.optimize('equal_weight');
      const maxW = Math.max(...Object.values(result.weights));
      expect(maxW).toBeLessThanOrEqual(0.11); // tolerance
    });

    it('should report asset class + country weights', () => {
      const result = bridge.optimize('equal_weight');
      expect(Object.keys(result.assetClassWeights).length).toBeGreaterThan(0);
      expect(result.assetClassWeights.equity_us).toBeGreaterThan(0);
    });
  });

  // ── Rebalancing ─────────────────────────────────────────────────────────

  describe('rebalancing', () => {
    it('should compute rebalance decisions', () => {
      const result = bridge.optimize('equal_weight');
      const current = { SPY:0.5, AGG:0.5 };
      const decisions = bridge.computeRebalance(current, result.weights, 0.01);

      expect(decisions.length).toBeGreaterThan(0);
      const buys = decisions.filter(d => d.action === 'buy');
      const sells = decisions.filter(d => d.action === 'sell');
      expect(buys.length + sells.length).toBeGreaterThan(0);
    });

    it('should compute drift', () => {
      const target = bridge.optimize('equal_weight').weights;
      const current: Record<string, number> = {};
      for (const id of Object.keys(target)) current[id] = target[id];
      current['SPY'] = (target['SPY'] ?? 0.1) + 0.05;

      const drift = bridge.computeDrift(current, target);
      expect(drift).toBeGreaterThan(0);
    });
  });

  // ── Scenario Analysis ───────────────────────────────────────────────────

  describe('scenario analysis', () => {
    it('should run a single scenario', () => {
      bridge.optimize('equal_weight');
      const result = bridge.runScenario('Test Crash', '测试崩盘', 'stress_test', 'Testing', {
        SPY:-0.40, QQQ:-0.45, AGG:0.02, EFA:-0.38, EEM:-0.45, HYG:-0.25,
        EMB:-0.30, TLT:0.20, DBC:-0.35, VNQ:-0.45, GLD:0.15, BTC:-0.50, SHY:0.01,
      });

      expect(result.portfolioReturn).toBeLessThan(0); // crash
      expect(result.type).toBe('stress_test');
    });

    it('should run preset scenarios', () => {
      bridge.optimize('equal_weight');
      const results = bridge.runPresetScenarios();
      expect(results.length).toBe(4);
      expect(results.map(r => r.name)).toContain('2008 GFC');
      expect(results.map(r => r.name)).toContain('2020 COVID');
    });

    it('should retrieve scenario by id', () => {
      bridge.optimize('equal_weight');
      const r = bridge.runScenario('S', 'S', 'historical', 'D', { SPY:-0.1, AGG:0.01 });
      expect(bridge.getScenario(r.scenarioId)).not.toBeNull();
    });
  });

  // ── Attribution ─────────────────────────────────────────────────────────

  describe('attribution', () => {
    it('should compute Brinson attribution', () => {
      bridge.optimize('equal_weight');
      const result = bridge.computeAttribution(
        'Q1 2026',
        { SPY:0.5, AGG:0.5 },
        { SPY:0.08, AGG:0.02 },
        { SPY:0.6, AGG:0.4 },
      );

      expect(result.totalReturn).toBeGreaterThan(0);
      expect(result.benchmarkReturn).toBeGreaterThan(0);
      expect(typeof result.allocationEffect).toBe('number');
      expect(typeof result.selectionEffect).toBe('number');
    });
  });

  // ── Analytics ───────────────────────────────────────────────────────────

  describe('analytics', () => {
    it('should compute risk decomposition', () => {
      bridge.optimize('equal_weight');
      const decomp = bridge.riskDecomposition(bridge.getAllocation()!.weights);
      expect(decomp.length).toBeGreaterThan(0);
      expect(decomp[0].pctContribution).toBeGreaterThan(0);
    });

    it('should compute efficient frontier points', () => {
      const frontier = bridge.efficientFrontier(10);
      expect(frontier.length).toBe(10);
      // Higher return should generally mean higher risk
      expect(frontier[9].return_).toBeGreaterThanOrEqual(frontier[0].return_);
    });
  });

  // ── Benchmark ───────────────────────────────────────────────────────────

  describe('benchmark', () => {
    it('should set and get custom benchmark', () => {
      bridge.setBenchmark({ SPY:0.5, AGG:0.3, GLD:0.2 });
      const b = bridge.getBenchmark();
      expect(b['SPY']).toBe(0.5);
    });

    it('should set 60/40 standard benchmark', () => {
      bridge.setStandardBenchmark();
      const b = bridge.getBenchmark();
      expect(b['SPY']).toBe(0.4);
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should track stats', () => {
      bridge.optimize('equal_weight');
      const stats = bridge.getStats();
      expect(stats.assetCount).toBe(13);
      expect(stats.lastOptimization).toBeGreaterThan(0);
    });

    it('should notify on optimize', () => {
      const results: string[] = [];
      bridge.onOptimize(r => results.push(r.method));
      bridge.optimize('risk_parity');
      expect(results).toContain('risk_parity');
    });

    it('should reset all state', () => {
      bridge.optimize('equal_weight');
      bridge.addConstraint({ type:'max_weight', value:0.1 });
      bridge.reset();
      expect(bridge.getAllocation()).toBeNull();
      expect(bridge.getConstraints().length).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auto#2: StrategyMarketFactorTagBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R279-auto#2 StrategyMarketFactorTagBridge', () => {
  let tagBridge: StrategyMarketFactorTagBridge;

  const makeStrategy = (overrides?: Partial<{
    id: string; name: string; nameCn: string; category: string; riskLevel: string;
  }>) => ({
    strategyId: overrides?.id ?? 'S001',
    name: overrides?.name ?? 'Value Momentum',
    nameCn: overrides?.nameCn ?? '价值动量',
    author: 'user1',
    category: (overrides?.category as any) ?? 'multi_factor',
    riskLevel: (overrides?.riskLevel as any) ?? 'medium',
    description: 'A test strategy',
    descriptionCn: '测试策略',
    tags: [] as any[],
    performance: { annualReturn:0.15, volatility:0.12, sharpeRatio:1.25, maxDrawdown:0.15, winRate:0.60 },
    factorExposures: { BEME:0.5, MOM12M:0.8 },
    createdAt: Date.now(), updatedAt: Date.now(),
    version: '1.0', price: 5, rating: 4.2, downloads: 150,
  });

  beforeEach(() => {
    resetTagBridge();
    tagBridge = getTagBridge();
  });

  // ── Strategy Registration ───────────────────────────────────────────────

  describe('registration', () => {
    it('should register and retrieve a strategy', () => {
      tagBridge.registerStrategy(makeStrategy());
      const s = tagBridge.getStrategy('S001');
      expect(s).not.toBeNull();
      expect(s!.name).toBe('Value Momentum');
    });

    it('should auto-tag based on category', () => {
      // momentum category auto-tags MOM12M
      tagBridge.registerStrategy(makeStrategy({ id:'S1', category:'momentum' }));
      const tags = tagBridge.getTags('S1');
      const primary = tags.filter(t => t.tagType === 'primary');
      expect(primary.length).toBeGreaterThanOrEqual(1);
      expect(primary.some(t => t.factorId === 'MOM12M')).toBe(true);
    });

    it('should auto-tag based on risk level', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S_high', riskLevel:'high' }));
      const tags = tagBridge.getTags('S_high');
      expect(tags.some(t => t.tagType === 'risk')).toBe(true);
    });

    it('should get strategies by category', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'V1', category:'value' }));
      tagBridge.registerStrategy(makeStrategy({ id:'M1', category:'momentum' }));

      expect(tagBridge.getStrategiesByCategory('value').length).toBe(1);
    });
  });

  // ── Tagging ─────────────────────────────────────────────────────────────

  describe('tagging', () => {
    it('should add manual tags', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      const tag = tagBridge.addTag('S1', 'F_SCORE', 'F-Score', 'F评分', 'primary', 0.8, 'long', 0.9);
      expect(tag).not.toBeNull();
      expect(tag!.factorId).toBe('F_SCORE');
    });

    it('should get tags by type', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      tagBridge.addTag('S1', 'F1', 'F1', 'F1', 'primary', 0.8, 'long');
      tagBridge.addTag('S1', 'F2', 'F2', 'F2', 'risk', 0.5, 'neutral');

      expect(tagBridge.getPrimaryFactors('S1').length).toBeGreaterThanOrEqual(1);
      expect(tagBridge.getTagsByType('S1', 'risk').length).toBeGreaterThanOrEqual(1);
    });

    it('should remove tags', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      tagBridge.addTag('S1', 'F1', 'F1', 'F1', 'secondary', 0.5, 'long');
      expect(tagBridge.removeTag('S1', 'F1')).toBe(true);
      expect(tagBridge.getTags('S1').filter(t => t.factorId === 'F1').length).toBe(0);
    });
  });

  // ── Factor → Strategy ───────────────────────────────────────────────────

  describe('factor-to-strategy lookup', () => {
    it('should find strategies by factor', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', category:'value' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', category:'momentum' }));
      tagBridge.addTag('S2', 'BEME', 'BEME', 'BEME', 'secondary', 0.3, 'long');

      // BEME should appear in value strategy (auto)
      const strategies = tagBridge.getStrategiesByFactor('BEME');
      expect(strategies.length).toBeGreaterThanOrEqual(1);
    });

    it('should rank strategies by factor weight', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2' }));
      tagBridge.addTag('S1', 'F1', 'F1', 'F1', 'primary', 0.9, 'long');
      tagBridge.addTag('S2', 'F1', 'F1', 'F1', 'secondary', 0.3, 'long');

      const ranked = tagBridge.getStrategiesByFactorRanked('F1');
      expect(ranked[0].strategyId).toBe('S1');
    });

    it('should find strategies with multiple factors', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2' }));
      tagBridge.addTag('S1', 'F1', 'F1', 'F1', 'primary', 0.9, 'long');
      tagBridge.addTag('S1', 'F2', 'F2', 'F2', 'secondary', 0.5, 'long');
      tagBridge.addTag('S2', 'F1', 'F1', 'F1', 'secondary', 0.3, 'long');

      const both = tagBridge.getStrategiesByFactors(['F1', 'F2']);
      expect(both.length).toBe(1);
      expect(both[0]).toBe('S1');
    });
  });

  // ── Recommendations ────────────────────────────────────────────────────

  describe('recommendations', () => {
    it('should recommend by factor exposure', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', category:'value' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', category:'momentum' }));

      const recs = tagBridge.recommendByExposure({
        BEME:{ direction:'long', weight:1.0 },
      }, 5);

      expect(recs.length).toBeGreaterThanOrEqual(1);
      expect(recs[0].relevance).toBeGreaterThan(0);
    });

    it('should recommend by active signals', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', category:'value' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', category:'momentum' }));

      const recs = tagBridge.recommendBySignals([
        { factorId:'MOM12M', direction:'bullish', strength:0.8 },
      ]);

      expect(recs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Analytics ───────────────────────────────────────────────────────────

  describe('analytics', () => {
    it('should compute factor usage stats', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', category:'value' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', category:'momentum' }));

      const usage = tagBridge.computeFactorUsage();
      expect(usage.length).toBeGreaterThan(0);
    });

    it('should compute full analysis', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', category:'value' }));
      const analysis = tagBridge.computeAnalysis();
      expect(analysis.totalStrategies).toBeGreaterThanOrEqual(1);
      expect(analysis.categoriesCovered.length).toBeGreaterThan(0);
    });
  });

  // ── Search & Filter ────────────────────────────────────────────────────

  describe('search & filter', () => {
    it('should search strategies by name', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', name:'Alpha Momentum', nameCn:'阿尔法动量' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', name:'Deep Value', nameCn:'深度价值' }));

      expect(tagBridge.searchStrategies('momentum').length).toBe(1);
      expect(tagBridge.searchStrategies('动量').length).toBe(1);
    });

    it('should filter by risk level', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', riskLevel:'high' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', riskLevel:'low' }));
      expect(tagBridge.filterByRisk('high').length).toBe(1);
    });

    it('should get top rated', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1', name:'S1', nameCn:'S1' }));
      tagBridge.registerStrategy(makeStrategy({ id:'S2', name:'S2', nameCn:'S2' }));
      const top = tagBridge.getTopRated(5);
      expect(top.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should report stats', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      const stats = tagBridge.getStats();
      expect(stats.strategyCount).toBe(1);
    });

    it('should reset all state', () => {
      tagBridge.registerStrategy(makeStrategy({ id:'S1' }));
      tagBridge.reset();
      expect(tagBridge.getStats().strategyCount).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auto#3: FactorCommunityIPCBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R279-auto#3 FactorCommunityIPCBridge', () => {
  let ipc: FactorCommunityIPCBridge;

  const makeCombo = (overrides?: Partial<{ id: string; name: string; author: string }>) => ({
    comboId: overrides?.id ?? 'c001',
    name: overrides?.name ?? 'Quality Momentum',
    nameCn: '质量动量',
    author: overrides?.author ?? 'alice',
    status: 'draft' as const,
    factors: [
      { factorId:'ROE', factorName:'ROE', factorNameCn:'ROE', weight:0.6, direction:'long' as const, category:'quality' },
      { factorId:'MOM12M', factorName:'12M Momentum', factorNameCn:'12月动量', weight:0.4, direction:'long' as const, category:'momentum' },
    ],
    description: 'Quality + Momentum blend',
    descriptionCn: '质量与动量混合',
    tags: ['quality', 'momentum', 'balanced'],
    performance: {
      totalReturn:0.25, annualReturn:0.18, volatility:0.14, sharpeRatio:1.28,
      maxDrawdown:0.12, calmarRatio:1.5, winRate:0.65,
      backtestPeriod:'2018-2026', lastBacktest: Date.now(),
    },
    meta: {
      stars:4.5, ratingCount:20, downloads:500, forks:15,
      verifiedBy:['validator1'],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    usage: {
      compatibleMarkets:['US', 'HK'], rebalanceFreq:'monthly' as const,
      minCapital:10000, complexity:'intermediate' as const,
    },
  });

  beforeEach(() => {
    resetCommunityIPC();
    ipc = getCommunityIPC();
  });

  // ── Combo CRUD ──────────────────────────────────────────────────────────

  describe('combo CRUD', () => {
    it('should publish and retrieve a combo', () => {
      const c = ipc.publishCombo(makeCombo());
      expect(c.status).toBe('published');

      const got = ipc.getCombo('c001');
      expect(got).not.toBeNull();
      expect(got!.name).toBe('Quality Momentum');
    });

    it('should update a combo', () => {
      ipc.publishCombo(makeCombo());
      const updated = ipc.updateCombo('c001', { name:'Super Momentum', nameCn:'超级动量' });
      expect(updated!.name).toBe('Super Momentum');
    });

    it('should filter by status', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      expect(ipc.getAllCombos('published').length).toBe(1);
    });

    it('should search combos', () => {
      ipc.publishCombo(makeCombo({ id:'c1', name:'Deep Value' }));
      ipc.publishCombo(makeCombo({ id:'c2', name:'Market Neutral' }));

      expect(ipc.searchCombos('value').length).toBe(1);
    });

    it('should delete combos', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      expect(ipc.deleteCombo('c1')).toBe(true);
      expect(ipc.getCombo('c1')).toBeNull();
    });
  });

  // ── Rating / Download / Fork ────────────────────────────────────────────

  describe('engagement', () => {
    it('should rate a combo', () => {
      ipc.publishCombo(makeCombo());
      const r = ipc.rateCombo('c001', 5, 'bob');
      expect(r).not.toBeNull();
      expect(r!.meta.ratingCount).toBe(21);
      expect(r!.meta.stars).toBeGreaterThan(4);
    });

    it('should download a combo', () => {
      ipc.publishCombo(makeCombo());
      const r = ipc.downloadCombo('c001');
      expect(r!.meta.downloads).toBe(501);
    });

    it('should fork a combo', () => {
      ipc.publishCombo(makeCombo());
      const fork = ipc.forkCombo('c001', 'charlie', 'Forked QM', '分叉质动');
      expect(fork).not.toBeNull();
      expect(fork!.author).toBe('charlie');
      expect(ipc.getCombo('c001')!.meta.forks).toBe(16);
    });
  });

  // ── Verification ────────────────────────────────────────────────────────

  describe('verification', () => {
    it('should verify a combo with multiple verifiers', () => {
      ipc.publishCombo(makeCombo());
      
      ipc.verifyCombo('c001', 'v1');
      ipc.verifyCombo('c001', 'v2');
      
      const c = ipc.verifyCombo('c001', 'v3');
      expect(c!.status).toBe('verified');
      expect(c!.meta.verifiedBy.length).toBe(4); // initial validator1 + 3 verifiers
    });
  });

  // ── Comments ────────────────────────────────────────────────────────────

  describe('comments', () => {
    it('should add and retrieve comments', () => {
      ipc.publishCombo(makeCombo());
      const cmt = ipc.addComment('c001', 'bob', 'Great combo!', 4);
      expect(cmt).not.toBeNull();
      expect(ipc.getComments('c001').length).toBe(1);
    });

    it('should like comments', () => {
      ipc.publishCombo(makeCombo());
      const cmt = ipc.addComment('c001', 'bob', 'Nice')!;
      ipc.likeComment(cmt.commentId);
      expect(ipc.getComments('c001')[0].likes).toBe(1);
    });
  });

  // ── Factor Kits ─────────────────────────────────────────────────────────

  describe('factor kits', () => {
    it('should create and retrieve kits', () => {
      const kit = ipc.createKit({
        kitId:'kit1', name:'Bear Market Kit', nameCn:'熊市工具包',
        author:'alice', description:'Bear market defense combos',
        descriptionCn:'熊市防御组合',
        scene:'bear_market', sceneCn:'熊市',
        combos:[], downloads:0, rating:0, createdAt: Date.now(),
      });

      expect(kit.kitId).toBe('kit1');
      expect(ipc.getKit('kit1')).not.toBeNull();
      expect(ipc.getKitsByScene('bear_market').length).toBe(1);
    });
  });

  // ── Leaderboard ─────────────────────────────────────────────────────────

  describe('leaderboard', () => {
    it('should rank combos by sharpe', () => {
      const c1 = makeCombo({ id:'c1' });
      c1.performance.sharpeRatio = 2.5;
      
      const c2 = makeCombo({ id:'c2', name:'Low Vol' });
      c2.performance.sharpeRatio = 1.5;

      ipc.publishCombo(c1);
      ipc.publishCombo(c2);

      const lb = ipc.getLeaderboard('sharpe', 5);
      expect(lb.length).toBe(2);
      expect(lb[0].metrics.sharpe).toBeGreaterThanOrEqual(lb[1].metrics.sharpe);
    });

    it('should get top contributors', () => {
      ipc.publishCombo(makeCombo({ id:'c1', author:'alice' }));
      ipc.publishCombo(makeCombo({ id:'c2', author:'bob', name:'B Combo' }));

      const top = ipc.getTopContributors(5);
      expect(top.length).toBeGreaterThanOrEqual(1);
      expect(top.some(t => t.userId === 'alice')).toBe(true);
    });
  });

  // ── Reputation ──────────────────────────────────────────────────────────

  describe('reputation', () => {
    it('should track user reputation points', () => {
      ipc.publishCombo(makeCombo({ id:'c1', author:'alice' }));
      const rep = ipc.getUserReputation('alice');
      expect(rep).not.toBeNull();
      expect(rep!.points).toBeGreaterThanOrEqual(10); // combo_published = 10
    });
  });

  // ── Export / Import ─────────────────────────────────────────────────────

  describe('export/import', () => {
    it('should export all combos as a kit', () => {
      ipc.publishCombo(makeCombo({ id:'c1', author:'alice' }));
      ipc.publishCombo(makeCombo({ id:'c2', author:'alice', name:'C2' }));

      const kit = ipc.exportAsKit('alice', 'Alice Kit', 'Alice工具包');
      expect(kit).not.toBeNull();
      expect(kit!.combos.length).toBe(2);
    });

    it('should import a kit', () => {
      ipc.publishCombo(makeCombo({ id:'c1', author:'alice' }));
      const kit = ipc.exportAsKit('alice', 'Test Kit', '测试包')!;

      const imported = ipc.importKit(kit.kitId, 'dave');
      expect(imported.length).toBe(1);
    });
  });

  // ── Events ──────────────────────────────────────────────────────────────

  describe('events', () => {
    it('should emit events on combo publish', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      const events = ipc.getEvents();
      expect(events.some(e => e.type === 'combo_published')).toBe(true);
    });

    it('should filter events by type', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      ipc.rateCombo('c1', 5, 'bob');

      expect(ipc.getEventsByType('combo_rated').length).toBeGreaterThanOrEqual(1);
    });

    it('should filter events by recency', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      const recent = ipc.getRecentEvents(60000); // last minute
      expect(recent.length).toBeGreaterThanOrEqual(1);
    });

    it('should notify event handlers', () => {
      const received: string[] = [];
      ipc.onEvent(evt => received.push(evt.type));
      ipc.publishCombo(makeCombo());
      expect(received).toContain('combo_published');
    });

    it('should generate weekly spotlight', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      const spotlight = ipc.weeklySpotlight(3);
      expect(spotlight.length).toBeGreaterThanOrEqual(1);
      expect(ipc.getEventsByType('weekly_spotlight').length).toBe(1);
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('should track stats', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      const stats = ipc.getStats();
      expect(stats.comboCount).toBe(1);
      expect(stats.publishedCount).toBe(1);
    });

    it('should reset all state', () => {
      ipc.publishCombo(makeCombo({ id:'c1' }));
      ipc.reset();
      expect(ipc.getStats().comboCount).toBe(0);
    });
  });
});
