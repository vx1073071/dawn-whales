/**
 * R165 P1-B2: Strategy Optimizer — Factor Weight Scanning + Pareto Enhancement
 * Tests: scanFactorWeights, getParetoSummary, comparePareto
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StrategyOptimizer,
  resetStrategyOptimizer,
  type ParamSpec,
  type EvalResult,
  type ICWeightOptimization,
  type ParetoSummary,
  type ParetoComparison,
} from '../../../../electron/engine/analysis/strategy-optimizer';

// Simple evaluation function for testing
function makeEvalFn(baseSharpe = 1.5, baseReturn = 25, baseDD = 15, baseWR = 60) {
  return (params: Record<string, number>): Omit<EvalResult, 'fitness' | 'evaluationTimeMs'> => {
    const fastMa = params.fastMA ?? 5;
    const slowMa = params.slowMA ?? 20;
    const rsiPeriod = params.rsiPeriod ?? 14;

    // Simulate: better params = better results
    const maQuality = Math.max(0, 1 - Math.abs((slowMa - fastMa) / slowMa - 0.6));
    const rsiQuality = Math.max(0, 1 - Math.abs(rsiPeriod - 14) / 20);

    const quality = (maQuality + rsiQuality) / 2;

    return {
      params,
      sharpe: baseSharpe * (0.6 + 0.4 * quality),
      totalReturn: baseReturn * (0.6 + 0.4 * quality),
      maxDrawdown: baseDD * (1.4 - 0.4 * quality),
      winRate: baseWR * (0.7 + 0.3 * quality),
      tradeCount: Math.round(100 * quality),
    };
  };
}

describe('StrategyOptimizer — R165 Factor Weight Scanning', () => {
  let optimizer: StrategyOptimizer;

  beforeEach(() => {
    resetStrategyOptimizer();
    optimizer = new StrategyOptimizer({
      mode: 'random_search',
      maxIterations: 30,
      earlyStopIterations: 15,
    });
    optimizer.setEvaluateFunction(makeEvalFn());
    optimizer.setParamSpecs([
      { name: 'fastMA', min: 3, max: 20, step: 1, default: 5 },
      { name: 'slowMA', min: 10, max: 60, step: 1, default: 20 },
      { name: 'rsiPeriod', min: 5, max: 30, step: 1, default: 14 },
    ]);
  });

  afterEach(() => {
    resetStrategyOptimizer();
  });

  // ── scanFactorWeights ────────────────────────────────────────────

  describe('scanFactorWeights', () => {
    it('returns ICWeightOptimization with correct structure', async () => {
      const factorWeights: Record<string, ParamSpec> = {
        MOM_12M: { name: 'fw_MOM_12M', min: 0.05, max: 0.4, step: 0.05, default: 0.15 },
        VALUE_PE: { name: 'fw_VALUE_PE', min: 0.05, max: 0.3, step: 0.05, default: 0.10 },
      };
      const factorICs: Record<string, number> = {
        MOM_12M: 0.045,
        VALUE_PE: 0.035,
      };

      const result = await optimizer.scanFactorWeights(factorWeights, factorICs, 'ic_weighted');

      expect(result).toBeDefined();
      expect(result.mode).toBe('ic_weighted');
      expect(result.factorIds).toEqual(['MOM_12M', 'VALUE_PE']);
      expect(typeof result.bestFitness).toBe('number');
      expect(typeof result.totalEvaluations).toBe('number');
      expect(typeof result.durationMs).toBe('number');
      expect(result.optimizedWeights).toBeDefined();
      expect(result.icBaselineWeights).toBeDefined();
      expect(result.weightEvals).toHaveLength(2);
      expect(result.history).toBeDefined();
      expect(result.paretoFront).toBeDefined();
    });

    it('IC baseline weights sum to 1', async () => {
      const fw: Record<string, ParamSpec> = {
        A: { name: 'fw_A', min: 0, max: 1, step: 0.1, default: 0.5 },
        B: { name: 'fw_B', min: 0, max: 1, step: 0.1, default: 0.5 },
      };
      const ics = { A: 0.05, B: 0.03 };

      const result = await optimizer.scanFactorWeights(fw, ics, 'ic_weighted');

      const sum = Object.values(result.icBaselineWeights).reduce((s, w) => s + w, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('weightEvals entries have all required fields', async () => {
      const fw: Record<string, ParamSpec> = {
        TEST: { name: 'fw_TEST', min: 0.1, max: 0.5, step: 0.1, default: 0.2 },
      };
      const ics = { TEST: 0.04 };

      const result = await optimizer.scanFactorWeights(fw, ics, 'random');

      const entry = result.weightEvals[0];
      expect(entry.factorId).toBe('TEST');
      expect(typeof entry.icValue).toBe('number');
      expect(typeof entry.icWeight).toBe('number');
      expect(typeof entry.optimizedWeight).toBe('number');
      expect(typeof entry.bestFitness).toBe('number');
      expect(typeof entry.evaluations).toBe('number');
      expect(entry.evaluations).toBeGreaterThan(0);
    });

    it('supports all three scan modes', async () => {
      const fw: Record<string, ParamSpec> = {
        X: { name: 'fw_X', min: 0, max: 1, step: 0.2, default: 0.5 },
      };
      const ics = { X: 0.05 };

      for (const mode of ['grid', 'random', 'ic_weighted'] as const) {
        const result = await optimizer.scanFactorWeights(fw, ics, mode);
        expect(result.mode).toBe(mode);
        expect(result.totalEvaluations).toBeGreaterThan(0);
      }
    });

    it('restores original state after scan', async () => {
      const origSpecs = optimizer.getParamSpecs();
      const fw: Record<string, ParamSpec> = {
        Y: { name: 'fw_Y', min: 0.1, max: 0.5, step: 0.1, default: 0.3 },
      };
      const ics = { Y: 0.04 };

      await optimizer.scanFactorWeights(fw, ics, 'ic_weighted');

      const restoredSpecs = optimizer.getParamSpecs();
      expect(restoredSpecs.length).toBe(origSpecs.length);
      for (const spec of origSpecs) {
        const match = restoredSpecs.find((s) => s.name === spec.name);
        expect(match).toBeDefined();
        expect(match!.min).toBe(spec.min);
        expect(match!.max).toBe(spec.max);
      }
    });
  });

  // ── getParetoSummary ───────────────────────────────────────────────

  describe('getParetoSummary', () => {
    it('returns empty summary when no optimization has run', () => {
      const summary = optimizer.getParetoSummary();
      expect(summary.count).toBe(0);
      expect(summary.points).toEqual([]);
    });

    it('returns populated ParetoSummary after optimization', async () => {
      await optimizer.optimize();
      const summary = optimizer.getParetoSummary();

      expect(summary.count).toBeGreaterThan(0);
      expect(summary.points.length).toBe(summary.count);
      expect(summary.recommendation).toBeTruthy();
      expect(summary.objectiveRanges.sharpe).toHaveLength(2);
      expect(summary.objectiveRanges.totalReturn).toHaveLength(2);
      expect(summary.objectiveRanges.maxDrawdown).toHaveLength(2);
      expect(summary.objectiveRanges.winRate).toHaveLength(2);
    });

    it('ParetoPoints have all required fields', async () => {
      await optimizer.optimize();
      const summary = optimizer.getParetoSummary();

      if (summary.count > 0) {
        const p = summary.points[0];
        expect(typeof p.rank).toBe('number');
        expect(typeof p.params).toBe('object');
        expect(typeof p.sharpe).toBe('number');
        expect(typeof p.totalReturn).toBe('number');
        expect(typeof p.maxDrawdown).toBe('number');
        expect(typeof p.winRate).toBe('number');
        expect(typeof p.fitness).toBe('number');
        expect(typeof p.tradeCount).toBe('number');
      }
    });

    it('non-dominated points are sorted by fitness descending', async () => {
      await optimizer.optimize();
      const summary = optimizer.getParetoSummary();

      if (summary.count > 1) {
        for (let i = 1; i < summary.points.length; i++) {
          expect(summary.points[i - 1].fitness).toBeGreaterThanOrEqual(summary.points[i].fitness);
        }
      }
    });
  });

  // ── comparePareto ──────────────────────────────────────────────────

  describe('comparePareto', () => {
    it('returns baseline-only message when no second front', () => {
      const cmp = optimizer.comparePareto();
      expect(cmp.comparison).toBe('No data available');
    });

    it('compares two Pareto fronts with improvements', async () => {
      // Run first optimization
      optimizer.setEvaluateFunction(makeEvalFn(1.0, 15, 25, 50));
      await optimizer.optimize();
      const frontA = optimizer.getParetoFront();

      // Run second optimization with better baseline
      resetStrategyOptimizer();
      const optimizer2 = new StrategyOptimizer({
        mode: 'random_search',
        maxIterations: 30,
        earlyStopIterations: 15,
      });
      optimizer2.setEvaluateFunction(makeEvalFn(2.0, 35, 10, 70));
      optimizer2.setParamSpecs([
        { name: 'fastMA', min: 3, max: 20, step: 1, default: 5 },
        { name: 'slowMA', min: 10, max: 60, step: 1, default: 20 },
        { name: 'rsiPeriod', min: 5, max: 30, step: 1, default: 14 },
      ]);
      await optimizer2.optimize();
      const frontB = optimizer2.getParetoFront();

      const cmp = optimizer.comparePareto(
        { paretoFront: frontA } as any,
        { paretoFront: frontB } as any,
      );

      expect(cmp.comparison).toBeDefined();
      expect(cmp.improvements).toBeDefined();
      expect(cmp.regressions).toBeDefined();
      expect(cmp.summary).toBeTruthy();
    });

    it('comparison strings are valid', async () => {
      await optimizer.optimize();
      const frontA = optimizer.getParetoFront();

      const cmp = optimizer.comparePareto(
        { paretoFront: frontA } as any,
        { paretoFront: frontA } as any,
      );

      const validComparisons = [
        'B dominates A', 'A dominates B',
        'B slightly better', 'A slightly better',
        'Comparable — trade-offs exist', 'First run — baseline only',
      ];
      expect(validComparisons).toContain(cmp.comparison);
    });
  });

  // ── Invariants ─────────────────────────────────────────────────────

  describe('invariants', () => {
    it('empty factorWeights throws', async () => {
      await expect(
        optimizer.scanFactorWeights({}, {}, 'ic_weighted'),
      ).rejects.toThrow('No factor weights');
    });

    it('scanFactorWeights respects maxIterations', async () => {
      const fw: Record<string, ParamSpec> = {
        Z: { name: 'fw_Z', min: 0, max: 1, step: 0.2, default: 0.5 },
      };
      const ics = { Z: 0.05 };

      const result = await optimizer.scanFactorWeights(fw, ics, 'random');
      expect(result.totalEvaluations).toBeLessThanOrEqual(100);
    });

    it('Pareto front from scanFactorWeights is non-empty', async () => {
      const fw: Record<string, ParamSpec> = {
        P: { name: 'fw_P', min: 0, max: 1, step: 0.2, default: 0.5 },
      };
      const ics = { P: 0.05 };

      const result = await optimizer.scanFactorWeights(fw, ics, 'ic_weighted');
      expect(result.paretoFront.length).toBeGreaterThan(0);
    });
  });
});
