/**
 * Tests for Factor Exposure Analyzer
 * JVS R159 P0-D2: Real multivariate OLS regression
 */
import { describe, it, expect } from 'vitest';
import { FactorExposureAnalyzer } from '../../../../electron/engine/factors/factor-exposure';

// ============================================================================
// Helpers
// ============================================================================

/** Simple deterministic pseudo-random number generator (Mulberry32) */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal from uniform [0,1) */
function normalRandom(rand: () => number): number {
  const u1 = rand();
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

/** Generate independent synthetic factor return columns using mulberry32 PRNG */
function syntheticFactorMatrixPRNG(n: number, k: number): number[][] {
  const matrix: number[][] = [];
  const annualVols = [0.15, 0.10, 0.12, 0.09, 0.08, 0.11, 0.07, 0.10];
  const annualMeans = [0.08, 0.02, 0.03, 0.02, 0.01, 0.05, 0.02, 0.03];
  const tradingDays = 252;

  for (let j = 0; j < k; j++) {
    const rand = mulberry32(j * 10000 + 42);
    const dailyMean = annualMeans[j % 8] / tradingDays;
    const dailyStd = annualVols[j % 8] / Math.sqrt(tradingDays);
    for (let i = 0; i < n; i++) {
      if (j === 0) matrix[i] = [];
      const ret = dailyMean + normalRandom(rand) * dailyStd;
      // Clamp to realistic daily return range [-10%, +10%]
      matrix[i][j] = Number(Math.max(-0.1, Math.min(0.1, ret)).toFixed(8));
    }
  }
  return matrix;
}

/** Generate synthetic asset returns as linear combo of factor matrix * betas + small white noise */
function syntheticAssetReturns(
  factorMatrix: number[][],
  betas: number[]
): number[] {
  const n = factorMatrix.length;
  const k = factorMatrix[0].length;
  const rand = mulberry32(54321);
  const returns: number[] = [];
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let j = 0; j < k; j++) {
      r += factorMatrix[i][j] * betas[j];
    }
    // White noise ~0.0005 daily (about 1% error on typical daily returns)
    r += (rand() - 0.5) * 0.001;
    returns.push(Number(r.toFixed(8)));
  }
  return returns;
}

// ============================================================================
// Tests
// ============================================================================

describe('FactorExposureAnalyzer', () => {

  // ── R159 calculateRSquared ──────────────────────────────────────────

  describe('calculateRSquared', () => {
    const analyzer = new FactorExposureAnalyzer();

    it('returns 1.0 for perfect fit', () => {
      const actual = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03];
      const predicted = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03];
      expect(analyzer.calculateRSquared(actual, predicted)).toBe(1);
    });

    it('returns 0 for zero-variance predictions', () => {
      const actual = [0.01, -0.02, 0.03, -0.01, 0.02];
      const predicted = [0, 0, 0, 0, 0];
      const r2 = analyzer.calculateRSquared(actual, predicted);
      expect(r2).toBeLessThanOrEqual(0);
    });

    it('returns 0 for n<2', () => {
      expect(analyzer.calculateRSquared([0.01], [0.01])).toBe(0);
    });

    it('handles negative R² (worse than mean)', () => {
      const actual = [0.1, -0.1, 0.1, -0.1, 0.1];
      const predicted = [-0.1, 0.1, -0.1, 0.1, -0.1]; // anti-correlated
      const r2 = analyzer.calculateRSquared(actual, predicted);
      expect(r2).toBeLessThan(0);
    });

    it('returns reasonable R² for partial fit', () => {
      const actual = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.01, -0.02, 0.03, -0.01];
      const predicted = [0.008, -0.018, 0.028, -0.008, 0.018, -0.028, 0.008, -0.018, 0.028, -0.008];
      const r2 = analyzer.calculateRSquared(actual, predicted);
      expect(r2).toBeGreaterThan(0.9);
      expect(r2).toBeLessThan(1);
    });
  });

  // ── R159 isValidExposure ────────────────────────────────────────────

  describe('isValidExposure', () => {
    const analyzer = new FactorExposureAnalyzer();

    it('valid when R² > 0.3 and n >= 20', () => {
      expect(analyzer.isValidExposure(0.31, 20)).toBe(true);
      expect(analyzer.isValidExposure(0.5, 60)).toBe(true);
      expect(analyzer.isValidExposure(0.9, 100)).toBe(true);
    });

    it('invalid when R² <= 0.3', () => {
      expect(analyzer.isValidExposure(0.3, 60)).toBe(false);
      expect(analyzer.isValidExposure(0.29, 60)).toBe(false);
      expect(analyzer.isValidExposure(0, 100)).toBe(false);
      expect(analyzer.isValidExposure(-1, 100)).toBe(false);
    });

    it('invalid when n < 20 even with high R²', () => {
      expect(analyzer.isValidExposure(0.9, 19)).toBe(false);
      expect(analyzer.isValidExposure(0.8, 10)).toBe(false);
      expect(analyzer.isValidExposure(0.99, 1)).toBe(false);
    });
  });

  // ── R159 estimateLoadings (backward-compat single-factor OLS) ───────

  describe('estimateLoadings', () => {
    it('returns default loadings for insufficient data', () => {
      const a = new FactorExposureAnalyzer();
      const r = a.estimateLoadings([0.01], [0.01]);
      expect(r.marketBeta).toBe(1.0);
      expect(r.smbBeta).toBe(0);
    });

    it('computes positive market beta for correlated series', () => {
      const a = new FactorExposureAnalyzer();
      // Asset returns = 1.5 × market returns (strong positive beta)
      const market = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.015, -0.01, 0.025, -0.015,
        0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.015, -0.01, 0.025, -0.015];
      const asset = market.map(r => r * 1.5);
      const loadings = a.estimateLoadings(asset, market);
      expect(loadings.marketBeta).toBeCloseTo(1.5, 1);
    });

    it('computes negative market beta for inverse series', () => {
      const a = new FactorExposureAnalyzer();
      const market = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.015, -0.01, 0.025, -0.015,
        0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.015, -0.01, 0.025, -0.015];
      const asset = market.map(r => -r); // perfect inverse
      const loadings = a.estimateLoadings(asset, market);
      expect(loadings.marketBeta).toBeCloseTo(-1, 1);
    });

    it('returns marketBeta ~0 for uncorrelated series', () => {
      const a = new FactorExposureAnalyzer();
      const market = [0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.015, -0.01, 0.025, -0.015,
        0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0.015, -0.01, 0.025, -0.015];
      // Asset with near-zero market correlation
      const asset = [0.001, -0.003, 0.002, -0.001, 0.004, -0.002, 0.001, -0.003, 0.002, -0.001,
        0.001, -0.003, 0.002, -0.001, 0.004, -0.002, 0.001, -0.003, 0.002, -0.001];
      const loadings = a.estimateLoadings(asset, market);
      // near-zero correlation should give near-zero beta
      expect(Math.abs(loadings.marketBeta)).toBeLessThan(0.5);
    });
  });

  // ── R159 estimateLoadingsMulti (main multivariate OLS) ──────────────

  describe('estimateLoadingsMulti', () => {
    it('recovers known betas from synthetic data (3-factor)', () => {
      const a = new FactorExposureAnalyzer();
      const n = 100;
      const k = 3;
      const factorMatrix = syntheticFactorMatrixPRNG(n, k);
      // Known betas: [MKT, SMB, HML]
      const knownBetas = [1.2, 0.5, -0.3];
      const assetReturns = syntheticAssetReturns(factorMatrix, knownBetas);

      const result = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.rSquared).toBeGreaterThan(0.8);
        expect(result.valid).toBe(true);
        expect(result.loadings.marketBeta).toBeCloseTo(knownBetas[0], 1);
        expect(result.loadings.smbBeta).toBeCloseTo(knownBetas[1], 1);
        expect(result.loadings.hmlBeta).toBeCloseTo(knownBetas[2], 1);
      }
    }, 10000);

    it('recovers known betas from synthetic data (8-factor)', () => {
      const a = new FactorExposureAnalyzer();
      const n = 200;
      const k = 8;
      const factorMatrix = syntheticFactorMatrixPRNG(n, k);
      // Known betas: [MKT, SMB, HML, RMW, CMA, MOM, LVol, Qual]
      const knownBetas = [1.0, 0.3, -0.4, 0.2, 0.1, 0.5, -0.2, 0.15];
      const assetReturns = syntheticAssetReturns(factorMatrix, knownBetas);

      const result = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.rSquared).toBeGreaterThan(0.7);
        expect(result.valid).toBe(true);
        expect(result.loadings.marketBeta).toBeCloseTo(knownBetas[0], 1);
        expect(result.loadings.smbBeta).toBeCloseTo(knownBetas[1], 1);
        expect(result.loadings.hmlBeta).toBeCloseTo(knownBetas[2], 1);
        expect(result.loadings.rmwBeta).toBeCloseTo(knownBetas[3], 1);
        expect(result.loadings.cmaBeta).toBeCloseTo(knownBetas[4], 1);
        expect(result.loadings.momentumBeta).toBeCloseTo(knownBetas[5], 1);
        expect(result.loadings.lowVolBeta).toBeCloseTo(knownBetas[6], 1);
        expect(result.loadings.qualityBeta).toBeCloseTo(knownBetas[7], 1);
      }
    }, 10000);

    it('marks invalid when n < 20', () => {
      const a = new FactorExposureAnalyzer();
      const factorMatrix = syntheticFactorMatrixPRNG(10, 3);
      const betas = [1.0, 0.5, -0.3];
      const assetReturns = syntheticAssetReturns(factorMatrix, betas);
      expect(a.estimateLoadingsMulti(assetReturns, factorMatrix)).toBeNull();
    });

    it('returns null when fewer than 3 factors', () => {
      const a = new FactorExposureAnalyzer();
      const factorMatrix = syntheticFactorMatrixPRNG(100, 2);
      const betas = [1.0, 0.5];
      const assetReturns = syntheticAssetReturns(factorMatrix, betas);
      expect(a.estimateLoadingsMulti(assetReturns, factorMatrix)).toBeNull();
    });

    it('marks invalid when R² <= 0.3', () => {
      const a = new FactorExposureAnalyzer();
      const n = 100;
      // Generate pure-noise factor returns → no systematic exposure
      const factorMatrix = syntheticFactorMatrixPRNG(n, 3);
      // Asset returns: pure white noise, unrelated to any factor
      const rand = mulberry32(99999);
      const assetReturns: number[] = [];
      for (let i = 0; i < n; i++) {
        assetReturns.push((rand() - 0.5) * 0.01);
      }
      const result = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      // With pure noise, R² should be very low
      if (result) {
        expect(result.valid).toBe(false);
        expect(result.rSquared).toBeLessThanOrEqual(0.3);
      }
    });

    it('handles min-length (20 obs, 3-factor) edge case', () => {
      const a = new FactorExposureAnalyzer();
      const n = 21; // need n > k+1 for 3-factor (k=3, need >=5) but code says <3 factors => can't, so 3+1=4 min
      const k = 3;
      const factorMatrix = syntheticFactorMatrixPRNG(n, k);
      const knownBetas = [1.0, 0.3, -0.2];
      const assetReturns = syntheticAssetReturns(factorMatrix, knownBetas);
      const result = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.rSquared).toBeGreaterThanOrEqual(0.3);
        expect(result.valid).toBe(true);
      }
    }, 10000);

    it('observations must exceed factors+intercept (n > k+1)', () => {
      const a = new FactorExposureAnalyzer();
      // 3 factors + 1 intercept = 4 params, n=4 is not enough (n < k+2)
      const factorMatrix = syntheticFactorMatrixPRNG(4, 3);
      const betas = [1.0, 0.5, -0.3];
      const assetReturns = syntheticAssetReturns(factorMatrix, betas);
      expect(a.estimateLoadingsMulti(assetReturns, factorMatrix)).toBeNull();
    });
  });

  // ── R159 analyzeAttribution ────────────────────────────────────────

  describe('analyzeAttribution', () => {
    it('returns empty report for no positions', () => {
      const a = new FactorExposureAnalyzer();
      const report = a.analyzeAttribution('strategy-1', [], [0.01, -0.02]);
      expect(report.strategyId).toBe('strategy-1');
      expect(report.totalPnL).toBe(0);
      expect(report.contributions).toHaveLength(0);
      expect(report.dominantFactor).toBe('none');
    });

    it('returns attribution with OLS-based R² for real positions', () => {
      const a = new FactorExposureAnalyzer();
      const positions = [
        { strategyId: 's1', entryTime: Date.now() - 86400000 * 30, exitTime: Date.now() - 86400000 * 20,
          entryPrice: 100, exitPrice: 110, pnl: 10 },
        { strategyId: 's1', entryTime: Date.now() - 86400000 * 20, exitTime: Date.now() - 86400000 * 10,
          entryPrice: 110, exitPrice: 105, pnl: -5 },
      ];
      const marketReturns: number[] = [];
      for (let i = 0; i < 100; i++) {
        marketReturns.push(Math.sin(i * 0.2) * 0.01);
      }

      const report = a.analyzeAttribution('s1', positions, marketReturns);
      expect(report.strategyId).toBe('s1');
      expect(report.totalPnL).toBe(5);
      expect(report.loadings).toBeDefined();
      expect(report.loadings.marketBeta).toBeDefined();
      expect(report.contributions.length).toBeGreaterThan(0);
      expect(report.factorReturns.length).toBeGreaterThan(0);
      // R159: rSquared must be present
      expect(typeof report.rSquared).toBe('number');
      // R159: data source transparency fields
      expect(typeof report.isSimulated).toBe('boolean');
      expect(typeof report.dataSource).toBe('string');
    });

    it('identifies a dominant factor when betas vary significantly', () => {
      const a = new FactorExposureAnalyzer();
      const positions = [
        { strategyId: 's2', entryTime: Date.now() - 86400000 * 60, exitTime: Date.now() - 86400000 * 30,
          entryPrice: 50, exitPrice: 55, pnl: 5 },
        { strategyId: 's2', entryTime: Date.now() - 86400000 * 30, exitTime: Date.now(),
          entryPrice: 55, exitPrice: 60, pnl: 5 },
      ];
      const marketReturns: number[] = [];
      for (let i = 0; i < 100; i++) {
        marketReturns.push(Math.sin(i * 0.15) * 0.01);
      }
      const report = a.analyzeAttribution('s2', positions, marketReturns);
      expect(report.dominantFactor).toBeDefined();
      expect(typeof report.dominantFactor).toBe('string');
      const hasDominant = report.contributions.some(c => c.isDominant);
      expect(hasDominant).toBe(true);
    });
  });

  // ── R159 invariants / edge cases ────────────────────────────────────

  describe('invariants', () => {
    it('estimateLoadingsMulti returns loadings with all 8 betas', () => {
      const a = new FactorExposureAnalyzer();
      const n = 200;
      const k = 8;
      const factorMatrix = syntheticFactorMatrixPRNG(n, k);
      const betas = [1.0, 0.2, 0.1, 0.05, 0.03, 0.15, -0.1, 0.08];
      const assetReturns = syntheticAssetReturns(factorMatrix, betas);

      const result = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      expect(result).not.toBeNull();
      if (result) {
        const keys: (keyof typeof result.loadings)[] = [
          'marketBeta', 'smbBeta', 'hmlBeta', 'rmwBeta', 'cmaBeta',
          'momentumBeta', 'lowVolBeta', 'qualityBeta'
        ];
        for (const k of keys) {
          expect(typeof result.loadings[k]).toBe('number');
        }
      }
    }, 10000);

    it('deterministic: same inputs produce same output', () => {
      const a = new FactorExposureAnalyzer();
      const n = 100;
      const k = 5;
      const factorMatrix = syntheticFactorMatrixPRNG(n, k);
      const betas = [0.8, 0.3, -0.5, 0.1, 0.2];
      const assetReturns = syntheticAssetReturns(factorMatrix, betas);

      const r1 = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      const r2 = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      if (r1 && r2) {
        expect(r1.rSquared).toBe(r2.rSquared);
        expect(r1.valid).toBe(r2.valid);
        expect(r1.loadings.marketBeta).toBe(r2.loadings.marketBeta);
        expect(r1.loadings.hmlBeta).toBe(r2.loadings.hmlBeta);
      }
    }, 10000);

    it('R² is always between 0 and 1 for good fit', () => {
      const a = new FactorExposureAnalyzer();
      const factorMatrix = syntheticFactorMatrixPRNG(200, 6);
      const betas = [1.0, 0.4, -0.3, 0.2, 0.1, 0.15];
      const assetReturns = syntheticAssetReturns(factorMatrix, betas);

      const result = a.estimateLoadingsMulti(assetReturns, factorMatrix);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.rSquared).toBeGreaterThanOrEqual(0);
        expect(result.rSquared).toBeLessThanOrEqual(1);
      }
    }, 10000);
  });

  // ── single-factor OLS edge cases ────────────────────────────────────

  describe('single-factor OLS (backward compat)', () => {
    it('estimateLoadings returns marketBeta from OLS not random', () => {
      const a = new FactorExposureAnalyzer();
      // Create asset returns = 2.0 * market + noise
      const rng = mulberry32(42);
      const market: number[] = [];
      const asset: number[] = [];
      for (let i = 0; i < 60; i++) {
        const m = (rng() - 0.5) * 0.04;
        market.push(m);
        asset.push(m * 2.0 + (rng() - 0.5) * 0.002);
      }
      const loadings = a.estimateLoadings(asset, market);
      // OLS beta should be close to 2.0
      expect(loadings.marketBeta).toBeGreaterThan(1.5);
      expect(loadings.marketBeta).toBeLessThan(2.5);
    });
  });

  // ── R161: Cached Attribution Analysis ─────────────────────────────────

  describe('analyzeAttributionCached (R161)', () => {
    const a = new FactorExposureAnalyzer();

    it('returns report for valid positions', async () => {
      const positions = [{
        strategyId: 'test-strat',
        entryTime: new Date('2026-01-02').getTime(),
        exitTime: new Date('2026-01-31').getTime(),
        entryPrice: 100,
        exitPrice: 110,
        pnl: 10,
      }];
      const marketReturns = generateReturns(25, 42);

      const report = await a.analyzeAttributionCached('test-strat', positions, marketReturns);
      expect(report.strategyId).toBe('test-strat');
      expect(report.totalPnL).toBeGreaterThanOrEqual(0);
      expect(report).toHaveProperty('loadings');
      expect(report).toHaveProperty('contributions');
      expect(report.dataSource).toBe('ETF_PROXY');
    });

    it('returns same report on second call (cache hit)', async () => {
      const positions = [{
        strategyId: 'cache-test',
        entryTime: new Date('2026-02-01').getTime(),
        exitTime: new Date('2026-02-28').getTime(),
        entryPrice: 50,
        exitPrice: 55,
        pnl: 5,
      }];
      const marketReturns = generateReturns(20, 123);

      const r1 = await a.analyzeAttributionCached('cache-test', positions, marketReturns);
      const r2 = await a.analyzeAttributionCached('cache-test', positions, marketReturns);

      expect(r1.strategyId).toBe(r2.strategyId);
      expect(r1.totalPnL).toBe(r2.totalPnL);
      expect(r1.loadings.marketBeta).toBe(r2.loadings.marketBeta);
    });

    it('clearCache works', async () => {
      await a.clearCache();
      // After cache clear, recompute should still work
      const positions = [{
        strategyId: 'clear-test',
        entryTime: new Date('2026-03-01').getTime(),
        exitTime: new Date('2026-03-15').getTime(),
        entryPrice: 200,
        exitPrice: 210,
        pnl: 10,
      }];
      const result = await a.analyzeAttributionCached('clear-test', positions, generateReturns(15, 77));
      expect(result.strategyId).toBe('clear-test');
    });

    it('handles empty positions list', async () => {
      const report = await a.analyzeAttributionCached('empty-strat', [], []);
      expect(report.strategyId).toBe('empty-strat');
      expect(report.totalPnL).toBe(0);
    });

    it('different strategyIds get different reports', async () => {
      const pos = [{
        strategyId: 'diff-1',
        entryTime: new Date('2026-01-05').getTime(),
        exitTime: new Date('2026-01-20').getTime(),
        entryPrice: 300,
        exitPrice: 330,
        pnl: 30,
      }];
      const mr = generateReturns(15, 42);

      const r1 = await a.analyzeAttributionCached('diff-1', pos, mr);
      const r2 = await a.analyzeAttributionCached('diff-2', pos, mr);

      expect(r1.strategyId).not.toBe(r2.strategyId);
    });
  });
});
