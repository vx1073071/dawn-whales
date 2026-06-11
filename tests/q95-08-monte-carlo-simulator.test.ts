/**
 * Q95-08: MonteCarloSimulator Tests
 * Coverage for Monte Carlo simulation engine
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  MonteCarloSimulator,
  createSimulator,
} from '../electron/engine/backtest/monte-carlo-simulator';
import type { SimConfig, ScenarioResult } from '../electron/engine/backtest/monte-carlo-simulator';

function makeConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    initialCapital: 100_000,
    expectedReturn: 0.08,
    volatility: 0.2,
    horizon: 252,
    simulations: 1000,
    distribution: 'normal',
    riskFreeRate: 0.03,
    ...overrides,
  };
}

describe('Q95-08: MonteCarloSimulator', () => {
  describe('constructor & seed', () => {
    it('should create with default seed', () => {
      const sim = new MonteCarloSimulator();
      expect(sim).toBeDefined();
      expect(typeof sim.getSeed()).toBe('number');
    });

    it('should create with fixed seed for reproducibility', () => {
      const sim1 = new MonteCarloSimulator(42);
      const sim2 = new MonteCarloSimulator(42);
      const paths1 = sim1.generatePaths(makeConfig({ simulations: 10 }));
      const paths2 = sim2.generatePaths(makeConfig({ simulations: 10 }));
      expect(paths1[0].finalValue).toBe(paths2[0].finalValue);
    });

    it('should reseed', () => {
      const sim = new MonteCarloSimulator(0);
      sim.reseed(99);
      expect(sim.getSeed()).toBe(99);
    });
  });

  describe('randomNormal', () => {
    it('should generate values around 0', () => {
      const sim = new MonteCarloSimulator(42);
      const values = Array.from({ length: 1000 }, () => sim.randomNormal());
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(Math.abs(mean)).toBeLessThan(0.1);
    });
  });

  describe('randomFatTail', () => {
    it('should generate fat-tail values', () => {
      const sim = new MonteCarloSimulator(42);
      const val = sim.randomFatTail();
      expect(typeof val).toBe('number');
      expect(!isNaN(val)).toBe(true);
    });
  });

  describe('geometricBrownianMotion', () => {
    it('should generate a price path', () => {
      const sim = new MonteCarloSimulator(42);
      const path = sim.geometricBrownianMotion(100, 0.08, 0.2, 1 / 252, 252);
      expect(path.length).toBe(253);
      expect(path[0]).toBe(100);
    });

    it('should handle zero volatility', () => {
      const sim = new MonteCarloSimulator(42);
      const path = sim.geometricBrownianMotion(100, 0.08, 0, 1 / 252, 10);
      expect(path.length).toBe(11);
      expect(path[0]).toBe(100);
    });
  });

  describe('generatePaths', () => {
    it('should generate requested number of paths', () => {
      const sim = new MonteCarloSimulator(42);
      const paths = sim.generatePaths(makeConfig({ simulations: 50, horizon: 10 }));
      expect(paths.length).toBe(50);
      expect(paths[0].path).toBeDefined();
      expect(paths[0].finalValue).toBeGreaterThan(0);
    });

    it('should handle fat_tail distribution', () => {
      const sim = new MonteCarloSimulator(42);
      const paths = sim.generatePaths(makeConfig({ distribution: 'fat_tail', simulations: 100, horizon: 20 }));
      expect(paths.length).toBe(100);
    });

    it('should handle lognormal distribution', () => {
      const sim = new MonteCarloSimulator(42);
      const paths = sim.generatePaths(makeConfig({ distribution: 'lognormal', simulations: 100, horizon: 20 }));
      expect(paths.length).toBe(100);
    });
  });

  describe('simulate', () => {
    it('should return full SimResult with statistics', () => {
      const sim = new MonteCarloSimulator(42);
      const result = sim.simulate(makeConfig({ simulations: 200, horizon: 20 }));
      expect(result.finalValues.length).toBe(200);
      expect(result.statistics).toBeDefined();
      expect(typeof result.statistics.mean).toBe('number');
      expect(typeof result.statistics.median).toBe('number');
      expect(typeof result.statistics.percentile5).toBe('number');
      expect(typeof result.statistics.percentile95).toBe('number');
      expect(typeof result.var95).toBe('number');
      expect(typeof result.cvar95).toBe('number');
      expect(result.maxDrawdowns.length).toBe(200);
      expect(result.equityCurves.length).toBe(200);
    });

    it('should have probability between 0 and 1', () => {
      const sim = new MonteCarloSimulator(42);
      const result = sim.simulate(makeConfig({ simulations: 500, horizon: 30 }));
      expect(result.probabilityOfProfit).toBeGreaterThanOrEqual(0);
      expect(result.probabilityOfProfit).toBeLessThanOrEqual(1);
    });
  });

  describe('compareScenarios', () => {
    it('should compare multiple scenarios', () => {
      const sim = new MonteCarloSimulator(42);
      const scenarios: ScenarioResult[] = [
        { name: 'bull', config: { expectedReturn: 0.15 }, result: sim.simulate(makeConfig({ simulations: 100, horizon: 10, expectedReturn: 0.15 })) },
        { name: 'base', config: { expectedReturn: 0.08 }, result: sim.simulate(makeConfig({ simulations: 100, horizon: 10 })) },
        { name: 'bear', config: { expectedReturn: 0.02 }, result: sim.simulate(makeConfig({ simulations: 100, horizon: 10, expectedReturn: 0.02 })) },
      ];
      const comp = sim.compareScenarios(scenarios);
      expect(comp.scenarios.length).toBe(3);
      expect(typeof comp.best).toBe('string');
      expect(typeof comp.worst).toBe('string');
    });

    it('should handle empty scenarios', () => {
      const sim = new MonteCarloSimulator(42);
      const comp = sim.compareScenarios([]);
      expect(comp.scenarios.length).toBe(0);
    });
  });

  describe('sensitivityAnalysis', () => {
    it('should analyze parameter sensitivity', () => {
      const sim = new MonteCarloSimulator(42);
      const config = makeConfig({ simulations: 100, horizon: 10 });
      const points = sim.sensitivityAnalysis(config, 'expectedReturn', [0.05, 0.10, 0.15, 0.20]);
      expect(points.length).toBe(4);
      expect(typeof points[0].mean).toBe('number');
    });
  });

  describe('computeSharpeRatio', () => {
    it('should compute sharpe from SimResult', () => {
      const sim = new MonteCarloSimulator(42);
      const result = sim.simulate(makeConfig({ simulations: 200, horizon: 30 }));
      const sharpe = sim.computeSharpeRatio(result, 0.03);
      expect(typeof sharpe).toBe('number');
    });
  });

  describe('computeSortinoRatio', () => {
    it('should compute sortino ratio', () => {
      const sim = new MonteCarloSimulator(42);
      const result = sim.simulate(makeConfig({ simulations: 200, horizon: 30 }));
      const sortino = sim.computeSortinoRatio(result.finalValues, 100_000, 0.03);
      expect(typeof sortino).toBe('number');
    });
  });

  describe('convergenceCheck', () => {
    it('should check convergence', () => {
      const sim = new MonteCarloSimulator(42);
      const result = sim.simulate(makeConfig({ simulations: 500, horizon: 20 }));
      const conv = sim.convergenceCheck(result.finalValues, 50);
      expect(typeof conv).toBe('number');
    });
  });

  describe('createSimulator', () => {
    it('should create simulator with seed', () => {
      const sim = createSimulator(123);
      expect(sim).toBeInstanceOf(MonteCarloSimulator);
      expect(sim.getSeed()).toBe(123);
    });
  });
});
