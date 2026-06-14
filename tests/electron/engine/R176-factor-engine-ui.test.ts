/**
 * R176 JVS: factor-optimizer UI output + GRS summary + rolling IC JSON + turnover cost JSON
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorOptimizer,
  createFactorOptimizer,
  type OptimizationResult,
  type ParetoFrontier,
} from '../../../electron/engine/factors/factor-optimizer';
import {
  FactorResearchEngine,
  createFactorResearchEngine,
} from '../../../electron/engine/factors/factor-research-engine';
import {
  TurnoverCostEngine,
  createTurnoverCostEngine,
} from '../../../electron/engine/analysis/turnover-cost-model';

// ============================================================================
// Seeded PRNG for deterministic data
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
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
    arr.push(mean + std * z);
  }
  return arr;
}

// ============================================================================
// F5续: FactorOptimizer getOptimizerSummary + getParetoFrontierJSON
// ============================================================================
describe('R176 F5续: FactorOptimizer UI output', () => {
  let opt: FactorOptimizer;

  beforeEach(() => {
    opt = createFactorOptimizer();
  });

  it('getOptimizerSummary returns valid structure with defaults', () => {
    const summary = opt.getOptimizerSummary();
    expect(summary.totalScans).toBe(5000);
    expect(summary.validCandidates).toBe(5000);
    expect(summary.durationMs).toBe(0);
    expect(summary.bestScore).toBe(0);
    expect(summary.convergenceRate).toBe(100);
    expect(summary.top3Combos).toHaveLength(0);
  });

  it('getOptimizerSummary uses provided OptimizationResult', () => {
    const mockResult: OptimizationResult = {
      topCandidates: [
        {
          weights: [
            { factorId: 'MOM_12M', weight: 0.4, nameCN: '12月动量' },
            { factorId: 'QUAL', weight: 0.35, nameCN: '质量因子' },
            { factorId: 'VOL_60D', weight: 0.25, nameCN: '60日波动率' },
          ],
          metrics: {
            expectedReturn: 12.5,
            expectedSharpe: 1.2,
            expectedMaxDrawdown: 15,
            expectedWinRate: 58,
            expectedVolatility: 14,
            score: 82,
          },
          factorContributions: [],
        },
        {
          weights: [
            { factorId: 'HML', weight: 0.5, nameCN: '价值因子' },
            { factorId: 'YIELD', weight: 0.5, nameCN: '股息因子' },
          ],
          metrics: {
            expectedReturn: 8.0,
            expectedSharpe: 0.9,
            expectedMaxDrawdown: 12,
            expectedWinRate: 55,
            expectedVolatility: 11,
            score: 72,
          },
          factorContributions: [],
        },
        {
          weights: [
            { factorId: 'GROWTH', weight: 0.6, nameCN: '成长因子' },
            { factorId: 'MOM_1M', weight: 0.4, nameCN: '1月动量' },
          ],
          metrics: {
            expectedReturn: 15.0,
            expectedSharpe: 1.1,
            expectedMaxDrawdown: 18,
            expectedWinRate: 52,
            expectedVolatility: 16,
            score: 75,
          },
          factorContributions: [],
        },
      ],
      paretoFrontier: {
        points: [],
        efficientFrontier: {
          maxSharpe: {} as any,
          maxReturn: {} as any,
          minDrawdown: {} as any,
          optimal: {} as any,
        },
        summary: '',
      },
      summary: {
        totalScans: 5000,
        validCandidates: 3421,
        durationMs: 450,
        bestScore: 82,
        bestSharpe: 1.2,
        bestReturn: 15.0,
        bestDrawdown: 12,
      },
    };

    const summary = opt.getOptimizerSummary(mockResult);
    expect(summary.totalScans).toBe(5000);
    expect(summary.validCandidates).toBe(3421);
    expect(summary.durationMs).toBe(450);
    expect(summary.bestScore).toBe(82);
    expect(summary.bestSharpe).toBe(1.2);
    expect(summary.bestReturn).toBe(15);
    expect(summary.bestDrawdown).toBe(12);
    expect(summary.convergenceRate).toBeGreaterThan(0);
    expect(summary.convergenceRate).toBeLessThan(100);
    expect(summary.top3Combos).toHaveLength(3);
    expect(summary.top3Combos[0].factors).toEqual(['MOM_12M', 'QUAL', 'VOL_60D']);
    expect(summary.top3Combos[0].sharpe).toBe(1.2);
  });

  it('getParetoFrontierJSON returns chart-friendly structure', () => {
    const mockFrontier: ParetoFrontier = {
      points: [
        { weights: [], sharpe: 0.8, returnPct: 10, maxDrawdown: 15, dominance: 2 },
        { weights: [], sharpe: 1.0, returnPct: 12, maxDrawdown: 14, dominance: 3 },
        { weights: [], sharpe: 1.2, returnPct: 9, maxDrawdown: 12, dominance: 5 },
        { weights: [], sharpe: 0.6, returnPct: 14, maxDrawdown: 20, dominance: 1 },
      ],
      efficientFrontier: {
        maxSharpe: { weights: [], sharpe: 1.2, returnPct: 9, maxDrawdown: 12, dominance: 5 },
        maxReturn: { weights: [], sharpe: 0.6, returnPct: 14, maxDrawdown: 20, dominance: 1 },
        minDrawdown: { weights: [], sharpe: 1.0, returnPct: 12, maxDrawdown: 14, dominance: 3 },
        optimal: { weights: [], sharpe: 1.0, returnPct: 12, maxDrawdown: 14, dominance: 3 },
      },
      summary: '测试前沿',
    };

    const json = opt.getParetoFrontierJSON(mockFrontier);
    expect(json.labels).toEqual(['S1', 'S2', 'S3', 'S4']);
    expect(json.datasets).toHaveLength(2);
    expect(json.datasets[0].label).toBe('All candidates');
    expect(json.datasets[0].data).toHaveLength(4);
    expect(json.datasets[1].label).toBe('Efficient frontier');
    expect(json.efficientPoints).toHaveLength(4);
    expect(json.summary).toBe('测试前沿');

    // Check efficient point values
    const maxSharpePt = json.efficientPoints.find(p => p.label === 'maxSharpe');
    expect(maxSharpePt).toBeDefined();
    expect(maxSharpePt!.sharpe).toBe(1.2);
  });

  it('getParetoFrontierJSON handles empty frontier gracefully', () => {
    const json = opt.getParetoFrontierJSON();
    expect(json.labels).toEqual([]);
    expect(json.datasets[0].data).toEqual([]);
    expect(json.efficientPoints).toEqual([]);
    expect(json.summary).toContain('No Pareto frontier');
  });
});

// ============================================================================
// F7续: FactorResearchEngine getGRSSummary + getRollingICJSON
// ============================================================================
describe('R176 F7续: FactorResearchEngine UI output', () => {
  let engine: FactorResearchEngine;

  beforeEach(() => {
    engine = createFactorResearchEngine();
  });

  it('getGRSSummary returns structure for valid inputs', () => {
    // 1 factor, 1 asset, 100 periods
    const factorReturns = [generateReturns(100, 0.005, 0.015, 42)];
    const assetReturns = [generateReturns(100, 0.008, 0.020, 99)];

    const summary = engine.getGRSSummary(assetReturns, factorReturns);
    expect(summary).toHaveProperty('grs');
    expect(summary).toHaveProperty('pValue');
    expect(summary).toHaveProperty('df1');
    expect(summary).toHaveProperty('df2');
    expect(summary).toHaveProperty('isRejected');
    expect(summary).toHaveProperty('interpretation');
    expect(summary).toHaveProperty('detail');
    expect(typeof summary.grs).toBe('number');
    expect(typeof summary.pValue).toBe('number');
    expect(summary.detail.length).toBeGreaterThan(10);
  });

  it('getGRSSummary handles empty inputs', () => {
    const summary = engine.getGRSSummary([], []);
    expect(summary.grs).toBe(0);
    expect(summary.pValue).toBe(1);
    expect(summary.isRejected).toBe(false);
    expect(summary.df1).toBe(0);
    expect(summary.interpretation).toContain('Insufficient');
  });

  it('getRollingICJSON returns chart-friendly series', () => {
    const factorValues = generateReturns(120, 0.005, 0.015, 42);
    const forwardReturns = generateReturns(120, 0.008, 0.020, 99);

    const json = engine.getRollingICJSON(factorValues, forwardReturns, 60, 'MOM_12M');
    expect(json.factorName).toBe('MOM_12M');
    expect(json.windowSize).toBe(60);
    expect(json.observations).toBeGreaterThan(0);
    expect(json.observations).toBeLessThanOrEqual(120);
    expect(json.series.length).toBe(json.observations);
    expect(json.series[0]).toHaveProperty('index');
    expect(json.series[0]).toHaveProperty('ic');

    // Summary stats
    expect(json.summary.meanIC).toBeDefined();
    expect(json.summary.stdIC).toBeGreaterThanOrEqual(0);
    expect(json.summary.maxIC).toBeGreaterThanOrEqual(json.summary.minIC);
    expect(json.summary.positiveRatio).toBeGreaterThanOrEqual(0);
    expect(json.summary.positiveRatio).toBeLessThanOrEqual(1);
  });

  it('getRollingICJSON handles insufficient data', () => {
    const factorValues = generateReturns(30, 0.005, 0.015, 42);
    const forwardReturns = generateReturns(30, 0.008, 0.020, 99);

    const json = engine.getRollingICJSON(factorValues, forwardReturns, 60);
    expect(json.observations).toBe(0);
    expect(json.series).toEqual([]);
    expect(json.summary.meanIC).toBe(0);
  });

  it('getRollingICJSON with default factor name', () => {
    const fv = generateReturns(80, 0.005, 0.015, 42);
    const fr = generateReturns(80, 0.008, 0.020, 99);

    const json = engine.getRollingICJSON(fv, fr);
    expect(json.factorName).toBe('Unnamed');
    expect(json.windowSize).toBe(60);
  });
});

// ============================================================================
// F8续: TurnoverCostEngine getTurnoverCostJSON
// ============================================================================
describe('R176 F8续: TurnoverCostEngine UI output', () => {
  let engine: TurnoverCostEngine;

  beforeEach(() => {
    engine = createTurnoverCostEngine();
  });

  it('getTurnoverCostJSON returns valid structure', () => {
    const current = [
      { factorId: 'MOM_12M', weight: 0.3 },
      { factorId: 'QUAL', weight: 0.4 },
      { factorId: 'VOL_60D', weight: 0.3 },
    ];
    const target = [
      { factorId: 'MOM_12M', weight: 0.25 },
      { factorId: 'QUAL', weight: 0.35 },
      { factorId: 'VOL_60D', weight: 0.4 },
    ];

    const json = engine.getTurnoverCostJSON(current, target, 'US', 100000);
    expect(json.summary).toBeDefined();
    expect(json.summary.totalTurnoverPct).toBeGreaterThan(0);
    expect(json.summary.estimatedCostBps).toBeGreaterThan(0);
    expect(json.summary.estimatedCostUSD).toBeGreaterThan(0);
    expect(typeof json.summary.feasible).toBe('boolean');
    expect(json.summary.recommendation.length).toBeGreaterThan(5);
    expect(json.details).toHaveLength(3);
    expect(json.market).toBe('US');
    expect(json.marketValue).toBe(100000);
    expect(json.timestamp).toBeGreaterThan(0);

    // Check detail structure
    const detail = json.details[0];
    expect(detail).toHaveProperty('factorId');
    expect(detail).toHaveProperty('currentWeight');
    expect(detail).toHaveProperty('targetWeight');
    expect(detail).toHaveProperty('changePct');
    expect(detail).toHaveProperty('annualTurnover');
    expect(detail).toHaveProperty('costPerFactorBps');
  });

  it('getTurnoverCostJSON with zero change returns low cost', () => {
    const weights = [
      { factorId: 'MOM_12M', weight: 0.33 },
      { factorId: 'QUAL', weight: 0.34 },
      { factorId: 'VOL_60D', weight: 0.33 },
    ];

    const json = engine.getTurnoverCostJSON(weights, weights, 'US', 50000);
    expect(json.summary.totalTurnoverPct).toBe(0);
    expect(json.summary.estimatedCostBps).toBe(0);
    expect(json.summary.estimatedCostUSD).toBe(0);
    expect(json.summary.feasible).toBe(true);
  });

  it('getTurnoverCostJSON handles different markets', () => {
    const current = [{ factorId: 'MOM_12M', weight: 0.5 }];
    const target = [{ factorId: 'QUAL', weight: 1.0 }];

    const jsonUS = engine.getTurnoverCostJSON(current, target, 'US', 100000);
    const jsonCRYPTO = engine.getTurnoverCostJSON(current, target, 'CRYPTO', 100000);

    // Different markets have different costs
    expect(jsonUS.market).toBe('US');
    expect(jsonCRYPTO.market).toBe('CRYPTO');
    // Turnover should be the same (same weight delta)
    expect(jsonUS.summary.totalTurnoverPct).toBe(jsonCRYPTO.summary.totalTurnoverPct);
  });

  it('getTurnoverCostJSON recommends batch execution for high turnover', () => {
    // Full position change = high turnover (different factor IDs get different weights)
    const current = [
      { factorId: 'MOM_12M', weight: 0.4 },
      { factorId: 'QUAL', weight: 0.3 },
      { factorId: 'VOL_60D', weight: 0.3 },
    ];
    const target = [
      { factorId: 'GROWTH', weight: 0.5 },
      { factorId: 'HML', weight: 0.3 },
      { factorId: 'YIELD', weight: 0.2 },
    ];

    const json = engine.getTurnoverCostJSON(current, target, 'US', 100000);
    // Full rebalance = high turnover
    expect(json.summary.totalTurnoverPct).toBeGreaterThan(0);
    expect(json.summary.recommendation).toBeTruthy();
  });

  it('getTurnoverCostJSON handles empty weights', () => {
    const json = engine.getTurnoverCostJSON([], [], 'US', 100000);
    expect(json.summary.totalTurnoverPct).toBe(0);
    expect(json.details).toEqual([]);
    expect(json.summary.feasible).toBe(true);
  });
});
