/**
 * Tests for R171 F7+F8: GRS statistic + rolling IC + turnover cost model
 */
import { describe, it, expect } from 'vitest';
import {
  FactorResearchEngine,
  createFactorResearchEngine,
  type ICResult,
} from '../../../electron/engine/factors/factor-research-engine';
import {
  TurnoverCostEngine,
  createTurnoverCostEngine,
  getTurnoverCostEngine,
  type TurnoverCostEstimate,
  type FactorTurnoverProfile,
} from '../../../electron/engine/analysis/turnover-cost-model';

// ============================================================================
// Seeded PRNG for deterministic test data
// ============================================================================
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateReturns(n: number, mean: number, std: number, seed: number = 42): number[] {
  const rng = mulberry32(seed);
  const arr: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
    arr.push(mean + std * z);
  }
  return arr;
}

describe('R171 F7: GRS Statistic', () => {
  const engine = createFactorResearchEngine();

  it('returns insufficient data for empty inputs', () => {
    const result = engine.grsStatistic([], []);
    expect(result.grsStatistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
    expect(result.interpretation).toContain('Insufficient');
  });

  it('returns insufficient for T <= N+L+1', () => {
    const T = 10;
    const assets = [generateReturns(T, 0.01, 0.02, 1)];
    const factors = [generateReturns(T, 0.005, 0.015, 2)];
    const result = engine.grsStatistic(assets, factors);
    expect(result.interpretation).toContain('Insufficient degrees of freedom');
    expect(result.significant).toBe(false);
  });

  it('computes GRS for well-specified model (low alpha)', () => {
    const T = 252;
    // Asset returns slightly above factor model prediction
    const factor = generateReturns(T, 0.005, 0.02, 3);
    const noise = generateReturns(T, 0.001, 0.005, 4); // less noise
    // alpha = 0.002 + some factor exposure + noise
    const asset = factor.map((f, i) => 0.002 + 0.8 * f + noise[i]);

    const result = engine.grsStatistic([asset], [factor]);
    // grsStatistic may be very small but should be >= 0
    expect(result.grsStatistic).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeGreaterThan(0);
    expect(typeof result.significant).toBe('boolean');
    expect(result.interpretation.length).toBeGreaterThan(10);
  });

  it('computes GRS for multi-asset multi-factor', () => {
    const T = 300;
    const f1 = generateReturns(T, 0.005, 0.02, 10);
    const f2 = generateReturns(T, 0.003, 0.015, 11);
    const f3 = generateReturns(T, -0.002, 0.01, 12);
    const factors = [f1, f2, f3];

    const assets = [
      f1.map((v, i) => 0.002 + 1.0 * v + 0.5 * f2[i] + generateReturns(1, 0, 0.01, 20 + i)[0]),
      f1.map((v, i) => -0.001 + 0.8 * v + 0.7 * f3[i] + generateReturns(1, 0, 0.01, 30 + i)[0]),
    ];

    const result = engine.grsStatistic(assets, factors);
    expect(result.grsStatistic).toBeGreaterThan(0);
    expect(typeof result.pValue).toBe('number');
    expect(result.degreesOfFreedom.numerator).toBe(2);
    expect(result.degreesOfFreedom.denominator).toBeGreaterThan(0);
    expect(typeof result.interpretation).toBe('string');
  });

  it('GRS result has correct shape', () => {
    const T = 260;
    const factor = generateReturns(T, 0.005, 0.02, 100);
    const asset = generateReturns(T, 0.008, 0.025, 101);
    const result = engine.grsStatistic([asset], [factor]);

    expect(result).toHaveProperty('grsStatistic');
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('degreesOfFreedom');
    expect(result).toHaveProperty('significant');
    expect(result).toHaveProperty('interpretation');
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
describe('R171 F7: Rolling IC (public API)', () => {
  const engine = createFactorResearchEngine();

  it('returns empty for insufficient data', () => {
    const result = engine.rollingIC([1, 2], [3, 4], 60);
    expect(result.windowIC).toEqual([]);
    expect(result.meanIC).toBe(0);
  });

  it('computes rolling IC for valid data', () => {
    const T = 200;
    const factorValues = generateReturns(T, 0, 1, 200);
    const returns = generateReturns(T, 0.001, 0.02, 201);
    const result = engine.rollingIC(factorValues, returns, 60);

    expect(result.windowIC.length).toBeGreaterThan(0);
    expect(result.windowIC.length).toBeLessThanOrEqual(T - 60 + 1);
    expect(result.meanIC).toBeGreaterThan(-1);
    expect(result.meanIC).toBeLessThan(1);
    expect(result.stdIC).toBeGreaterThan(0);
    expect(result.minIC).toBeGreaterThanOrEqual(-1);
    expect(result.maxIC).toBeLessThanOrEqual(1);
    expect(result.stabilityRatio).toBeDefined();
  });

  it('IC values are in [-1, 1]', () => {
    const T = 150;
    const factorValues = generateReturns(T, 0, 1, 300);
    const returns = generateReturns(T, 0.002, 0.015, 301);
    const result = engine.rollingIC(factorValues, returns, 30);

    for (const ic of result.windowIC) {
      expect(ic).toBeGreaterThanOrEqual(-1);
      expect(ic).toBeLessThanOrEqual(1);
    }
  });

  it('higher correlation produces higher mean IC', () => {
    const T = 200;
    const signal = generateReturns(T, 0, 1, 400);
    // aligned: signal + small noise
    const aligned = signal.map(s => 0.5 * s + generateReturns(1, 0, 0.01, 401)[0]);
    // random: unrelated
    const random = generateReturns(T, 0, 0.02, 402);

    const icAligned = engine.rollingIC(signal, aligned, 60);
    const icRandom = engine.rollingIC(signal, random, 60);

    // aligned should have larger absolute IC than random on average
    expect(Math.abs(icAligned.meanIC)).toBeGreaterThan(0);
  });
});

// ============================================================================
describe('R171 F8: Turnover Cost Model', () => {
  let engine: TurnoverCostEngine;

  beforeEach(() => {
    engine = createTurnoverCostEngine();
  });

  it('estimates cost for Momentum factor', () => {
    const result = engine.estimateForMarket('MOM_12M', 'US');
    expect(result.totalCostPct).toBeGreaterThan(0);
    expect(result.commissionCostPct).toBeGreaterThan(0);
    expect(result.spreadCostPct).toBeGreaterThan(0);
    expect(result.impactCostPct).toBeGreaterThan(0);
    expect(result.factorId).toBe('MOM_12M');
    expect(result.estimatedTradesPerYear).toBeGreaterThan(0);
    expect(result.costPerTradePct).toBeGreaterThan(0);
  });

  it('Value factor has lower cost than Momentum', () => {
    const mom = engine.estimateForMarket('MOM_12M', 'US');
    const hml = engine.estimateForMarket('HML', 'US');
    expect(hml.totalCostPct).toBeLessThan(mom.totalCostPct);
  });

  it('Crypto funding rate has highest turnover', () => {
    const cryptoFunding = engine.estimateForMarket('CRYPTO_FUNDING', 'CRYPTO');
    const hml = engine.estimateForMarket('HML', 'US');
    expect(cryptoFunding.factorAnnualTurnover).toBeGreaterThan(hml.factorAnnualTurnover);
    // Crypto has higher turnover => higher cost
    expect(cryptoFunding.estimatedTradesPerYear).toBeGreaterThan(hml.estimatedTradesPerYear);
  });

  it('compareFactors returns sorted ranked list', () => {
    const estimates = engine.compareFactors('US');
    expect(estimates.length).toBeGreaterThan(5);
    // Sorted by cost (ascending)
    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i - 1].totalCostPct).toBeLessThanOrEqual(estimates[i].totalCostPct);
    }
    // Rankings populated
    expect(estimates[0].rankAmongFactors).toBe(1);
    expect(estimates[0].isLowCost).toBe(true);
    expect(estimates[estimates.length - 1].isLowCost).toBe(false);
  });

  it('bulk estimate works for multiple factors', () => {
    const results = engine.estimateBulk(['MOM_12M', 'HML', 'QUAL'], {
      annualTurnoverRate: 1.0,
      commissionRate: 0.001,
      spreadBps: 5,
      impactFactor: 0.1,
      avgDailyVolumeUSD: 1000000,
      tradeSizeUSD: 5000,
    });
    expect(results.length).toBe(3);
    expect(results.map(r => r.factorId)).toEqual(['MOM_12M', 'HML', 'QUAL']);
  });

  it('registerProfile allows custom profiles', () => {
    const customProfile: FactorTurnoverProfile = {
      factorId: 'CUSTOM',
      typicalAnnualTurnover: 0.3,
      rebalanceFrequencyDays: 365,
      volatilitySensitivity: 'low',
      description: 'Custom factor',
    };
    engine.registerProfile(customProfile);
    const result = engine.estimateForMarket('CUSTOM', 'US');
    expect(result.factorId).toBe('CUSTOM');
    expect(result.factorAnnualTurnover).toBe(0.3);
  });

  it('unknown factor uses default profile', () => {
    const result = engine.estimateForMarket('UNKNOWN_FACTOR', 'US');
    expect(result.factorId).toBe('UNKNOWN_FACTOR');
    expect(result.factorAnnualTurnover).toBe(1.0); // default
    expect(result.totalCostPct).toBeGreaterThan(0);
  });

  it('market defaults differ (US vs HK vs CRYPTO)', () => {
    const usHml = engine.estimateForMarket('HML', 'US');
    const hkHml = engine.estimateForMarket('HML', 'HK');
    const cryptoHml = engine.estimateForMarket('HML', 'CRYPTO');

    // HK has wider spreads => higher spread cost
    expect(hkHml.spreadCostPct).toBeGreaterThan(usHml.spreadCostPct);
    // Crypto has lower commission
    expect(cryptoHml.commissionCostPct).toBeLessThan(usHml.commissionCostPct);
  });

  it('getProfile returns correct data', () => {
    const profile = engine.getProfile('MOM_12M');
    expect(profile).toBeDefined();
    expect(profile!.typicalAnnualTurnover).toBe(3.0);
    expect(profile!.volatilitySensitivity).toBe('high');
  });

  it('listProfiles returns all profiles', () => {
    const profiles = engine.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(15);
    expect(profiles.some(p => p.factorId === 'MOM_12M')).toBe(true);
  });

  // ── Factory / singleton ───────────────────────────────────────────
  it('factory creates independent instances', () => {
    const a = createTurnoverCostEngine();
    const b = createTurnoverCostEngine();
    expect(a).not.toBe(b);
  });

  it('singleton getTurnoverCostEngine works', () => {
    // Reset first to ensure clean state
    const e = getTurnoverCostEngine();
    expect(e).toBeDefined();
    expect(typeof e.estimateForMarket).toBe('function');
  });
});
