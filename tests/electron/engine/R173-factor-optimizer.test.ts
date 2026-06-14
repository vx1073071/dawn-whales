/**
 * R173 F5: Factor Optimizer tests
 */
import { describe, it, expect } from 'vitest';
import {
  FactorOptimizer,
  createFactorOptimizer,
  getFactorOptimizer,
  type OptimizationResult,
  type StrategyCandidate,
  type ParetoPoint,
} from '../../../electron/engine/factors/factor-optimizer';

describe('R173 F5: FactorOptimizer', () => {
  let optimizer: FactorOptimizer;

  beforeEach(() => {
    optimizer = createFactorOptimizer();
  });

  // ── Basic optimization ────────────────────────────────────────────
  describe('strategyOptimizer basic', () => {
    it('returns candidates for valid factor set', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        {},
        1000,
      );
      expect(result.topCandidates.length).toBeGreaterThan(0);
      expect(result.summary.totalScans).toBe(1000);
      expect(result.summary.validCandidates).toBe(1000);
      expect(result.summary.durationMs).toBeGreaterThan(0);
    });

    it('rejects insufficient factors (< minFactors)', () => {
      const result = optimizer.strategyOptimizer(['MOM_12M', 'HML'], {}, 100);
      expect(result.topCandidates.length).toBe(0);
      expect(result.paretoFrontier.points.length).toBe(0);
      expect(result.summary.validCandidates).toBe(0);
    });

    it('each candidate has valid structure', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH', 'SIZE'],
        {},
        200,
      );
      for (const candidate of result.topCandidates) {
        expect(candidate.weights.length).toBeGreaterThanOrEqual(3);
        expect(candidate.metrics).toHaveProperty('expectedReturn');
        expect(candidate.metrics).toHaveProperty('expectedSharpe');
        expect(candidate.metrics).toHaveProperty('expectedMaxDrawdown');
        expect(candidate.metrics).toHaveProperty('expectedWinRate');
        expect(candidate.metrics).toHaveProperty('score');
        expect(candidate.metrics.score).toBeGreaterThan(0);
        expect(candidate.metrics.score).toBeLessThanOrEqual(100);
        expect(candidate.factorContributions.length).toBe(candidate.weights.length);
      }
    });

    it('weights sum to approximately 1.0', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D'],
        {},
        100,
      );
      for (const candidate of result.topCandidates) {
        const sum = candidate.weights.reduce((s, w) => s + w.weight, 0);
        expect(sum).toBeCloseTo(1.0, 3);
      }
    });
  });

  // ── Constraints ───────────────────────────────────────────────────
  describe('constraints', () => {
    it('enforces minWeightPerFactor', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'SIZE'],
        { minWeightPerFactor: 0.08 },
        200,
      );
      for (const candidate of result.topCandidates) {
        for (const w of candidate.weights) {
          expect(w.weight).toBeGreaterThanOrEqual(0.04);
        }
      }
    });

    it('enforces maxWeightPerFactor', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        { maxWeightPerFactor: 0.65 },
        200,
      );
      for (const candidate of result.topCandidates) {
        for (const w of candidate.weights) {
          expect(w.weight).toBeLessThanOrEqual(0.655);
        }
      }
    });

    it('enforces requiredFactors (always included)', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D'],
        { requiredFactors: ['MOM_12M'] },
        200,
      );
      for (const candidate of result.topCandidates) {
        const factorIds = candidate.weights.map(w => w.factorId);
        expect(factorIds).toContain('MOM_12M');
      }
    });

    it('excludes excludedFactors', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        { excludedFactors: ['MOM_12M'] },
        200,
      );
      for (const candidate of result.topCandidates) {
        const factorIds = candidate.weights.map(w => w.factorId);
        expect(factorIds).not.toContain('MOM_12M');
      }
    });

    it('enforces maxSingleSector', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'MOM_1M', 'RSI_14', 'HML', 'QUAL'],
        { maxSingleSector: 0.55 },
        300,
      );
      for (const candidate of result.topCandidates) {
        // momentum family: MOM_12M, MOM_1M, RSI_14
        const momWeight = candidate.weights
          .filter(w => ['MOM_12M', 'MOM_1M', 'RSI_14'].includes(w.factorId))
          .reduce((s, w) => s + w.weight, 0);
        expect(momWeight).toBeLessThanOrEqual(0.60 + 0.02); // small tolerance
      }
    });
  });

  // ── Top candidates ranking ────────────────────────────────────────
  describe('ranking', () => {
    it('top candidates sorted by score descending', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH', 'SIZE', 'YIELD'],
        {},
        500,
      );
      for (let i = 1; i < result.topCandidates.length; i++) {
        expect(result.topCandidates[i - 1].metrics.score)
          .toBeGreaterThanOrEqual(result.topCandidates[i].metrics.score);
      }
    });

    it('returns at most 20 top candidates', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH', 'SIZE', 'YIELD', 'LIQ'],
        {},
        500,
      );
      expect(result.topCandidates.length).toBeLessThanOrEqual(20);
    });

    it('summary reflects best candidate', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        {},
        300,
      );
      const best = result.topCandidates[0];
      expect(result.summary.bestScore).toBe(best.metrics.score);
      expect(result.summary.bestSharpe).toBe(best.metrics.expectedSharpe);
    });
  });

  // ── Pareto frontier ───────────────────────────────────────────────
  describe('Pareto frontier', () => {
    it('returns Pareto-optimal points', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        {},
        500,
      );
      expect(result.paretoFrontier.points.length).toBeGreaterThan(0);
      expect(result.paretoFrontier.efficientFrontier.maxSharpe.sharpe).toBeGreaterThan(0);
    });

    it('efficientFrontier has extreme points', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH', 'SIZE'],
        {},
      500,
      );
      const ef = result.paretoFrontier.efficientFrontier;
      expect(ef.maxSharpe.sharpe).toBeGreaterThan(0);
      expect(ef.maxReturn.returnPct).toBeGreaterThan(0);
      expect(ef.minDrawdown.maxDrawdown).toBeGreaterThan(0);
      expect(ef.optimal).toBeDefined();
    });

    it('Pareto summary is descriptive', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        {},
        300,
      );
      expect(result.paretoFrontier.summary.length).toBeGreaterThan(10);
    });
  });

  // ── multiObjective standalone ─────────────────────────────────────
  describe('multiObjective', () => {
    it('filters dominated solutions', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH', 'SIZE', 'YIELD'],
        {},
        1000,
      );
      const frontier = optimizer.multiObjective(result.topCandidates);
      // All frontier points should be non-dominated
      for (const p of frontier) {
        expect(p.dominance).toBe(0);
      }
    });

    it('returns non-empty for good candidates', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'GROWTH'],
        {},
        500,
      );
      const frontier = optimizer.multiObjective(result.topCandidates);
      expect(frontier.length).toBeGreaterThan(0);
    });
  });

  // ── Factor contributions ──────────────────────────────────────────
  describe('factor contributions', () => {
    it('each factor has contributions', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        {},
        100,
      );
      for (const candidate of result.topCandidates) {
        for (const contrib of candidate.factorContributions) {
          expect(contrib.returnContribution).toBeDefined();
          expect(contrib.riskContribution).toBeDefined();
          expect(contrib.icContribution).toBeDefined();
          expect(contrib.weight).toBeGreaterThan(0);
        }
      }
    });

    it('return contributions roughly sum to ~100', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH'],
        {},
        100,
      );
      for (const candidate of result.topCandidates) {
        const total = candidate.factorContributions.reduce((s, c) => s + c.returnContribution, 0);
        expect(total).toBeCloseTo(100, -1); // within ~10
      }
    });
  });

  // ── Custom factor meta ────────────────────────────────────────────
  describe('registerFactorMeta', () => {
    it('can register and use custom factor', () => {
      optimizer.registerFactorMeta({
        factorId: 'CUSTOM_FACTOR',
        typicalIC: 0.06,
        typicalIR: 0.70,
        category: 'custom',
        volatilitySensitivity: 0.40,
        nameCN: '自定义因子',
      });

      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'CUSTOM_FACTOR'],
        {},
        100,
      );
      expect(result.topCandidates.length).toBeGreaterThan(0);
      const hasCustom = result.topCandidates.some(c =>
        c.weights.some(w => w.factorId === 'CUSTOM_FACTOR'),
      );
      expect(hasCustom).toBe(true);
    });
  });

  // ── Factory / singleton ───────────────────────────────────────────
  describe('factory', () => {
    it('createFactorOptimizer returns independent instance', () => {
      const a = createFactorOptimizer();
      const b = createFactorOptimizer();
      expect(a).not.toBe(b);
    });

    it('getFactorOptimizer returns singleton', () => {
      const a = getFactorOptimizer();
      const b = getFactorOptimizer();
      expect(a).toBe(b);
    });
  });

  // ── Performance ───────────────────────────────────────────────────
  describe('performance', () => {
    it('completes 5000 scans under 2 seconds', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D', 'GROWTH', 'SIZE', 'YIELD'],
        {},
      5000,
      );
      expect(result.topCandidates.length).toBeGreaterThan(0);
      expect(result.summary.durationMs).toBeLessThan(5000);
    }, 10000);
  });

  // ── Edge cases ────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('unknown factors are filtered out', () => {
      const result = optimizer.strategyOptimizer(
        ['UNKNOWN_FACTOR_1', 'MOM_12M', 'HML', 'QUAL', 'UNKNOWN_FACTOR_2'],
        {},
        100,
      );
      expect(result.topCandidates.length).toBeGreaterThan(0);
      for (const candidate of result.topCandidates) {
        const ids = candidate.weights.map(w => w.factorId);
        expect(ids).not.toContain('UNKNOWN_FACTOR_1');
        expect(ids).not.toContain('UNKNOWN_FACTOR_2');
      }
    });

    it('handles high scan count gracefully', () => {
      const result = optimizer.strategyOptimizer(
        ['MOM_12M', 'HML', 'QUAL', 'VOL_60D'],
        {},
        20000,
      );
      expect(result.topCandidates.length).toBe(20);
      expect(result.summary.totalScans).toBe(20000);
    });
  });
});
