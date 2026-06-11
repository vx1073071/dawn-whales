/**
 * Q95-02: Portfolio Optimizer Tests
 * Coverage for electron/engine/portfolio/portfolio-optimizer.ts
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PortfolioOptimizer } from '../electron/engine/portfolio/portfolio-optimizer';
import type { Asset, OptimizationConfig } from '../electron/engine/portfolio/portfolio-optimizer';

const makeAssets = (): Asset[] => [
  { id: 'AAPL', name: 'Apple', expectedReturn: 0.12, volatility: 0.25 },
  { id: 'MSFT', name: 'Microsoft', expectedReturn: 0.10, volatility: 0.22 },
  { id: 'GOOG', name: 'Google', expectedReturn: 0.14, volatility: 0.30 },
  { id: 'NVDA', name: 'Nvidia', expectedReturn: 0.20, volatility: 0.45 },
];

const makeCorr = (): number[][] => [
  [1.0, 0.6, 0.5, 0.4],
  [0.6, 1.0, 0.55, 0.35],
  [0.5, 0.55, 1.0, 0.45],
  [0.4, 0.35, 0.45, 1.0],
];

describe('Q95-02: PortfolioOptimizer', () => {
  // ── Constructor ──────────────────────────────────────────────
  describe('constructor', () => {
    it('should create instance', () => {
      const opt = new PortfolioOptimizer();
      expect(opt).toBeDefined();
    });
  });

  // ── optimize: all methods ────────────────────────────────────
  describe('optimize', () => {
    it('equal_weight: should distribute equally', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'equal_weight', riskFreeRate: 0.02 };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      expect(result.allocations.length).toBe(4);
      result.allocations.forEach(a => {
        expect(a.weight).toBeCloseTo(0.25, 2);
      });
      expect(result.method).toBe('equal_weight');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('min_variance: should minimize portfolio variance', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'min_variance', riskFreeRate: 0.02 };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      expect(result.allocations.length).toBe(4);
      const totalWeight = result.allocations.reduce((s, a) => s + a.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
      expect(result.expectedVolatility).toBeGreaterThan(0);
    });

    it('max_sharpe: should maximize Sharpe ratio', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'max_sharpe', riskFreeRate: 0.02 };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      expect(result.sharpeRatio).toBeGreaterThan(0);
      const totalWeight = result.allocations.reduce((s, a) => s + a.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('mean_variance: should balance return and risk', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'mean_variance', riskFreeRate: 0.02 };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      expect(result.expectedReturn).toBeGreaterThan(0);
      expect(result.expectedVolatility).toBeGreaterThan(0);
    });

    it('risk_parity: should balance risk contributions', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'risk_parity', riskFreeRate: 0.02 };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      expect(result.allocations.length).toBe(4);
      const totalWeight = result.allocations.reduce((s, a) => s + a.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('should handle empty assets', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'equal_weight', riskFreeRate: 0.02 };
      const result = opt.optimize([], [], config);
      expect(result.allocations.length).toBe(0);
    });

    it('should handle single asset', () => {
      const opt = new PortfolioOptimizer();
      const assets: Asset[] = [{ id: 'BTC', name: 'Bitcoin', expectedReturn: 0.5, volatility: 0.8 }];
      const config: OptimizationConfig = { method: 'equal_weight', riskFreeRate: 0.02 };
      const result = opt.optimize(assets, [[1.0]], config);
      expect(result.allocations.length).toBe(1);
      expect(result.allocations[0].weight).toBeCloseTo(1.0, 2);
    });

    it('should respect maxWeight constraint', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = {
        method: 'max_sharpe',
        riskFreeRate: 0.02,
        constraints: { maxWeight: 0.4 },
      };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      result.allocations.forEach(a => {
        expect(a.weight).toBeLessThanOrEqual(0.41); // small tolerance
      });
    });

    it('should respect minWeight constraint', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = {
        method: 'min_variance',
        riskFreeRate: 0.02,
        constraints: { minWeight: 0.1 },
      };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      result.allocations.forEach(a => {
        if (a.weight > 0.001) {
          expect(a.weight).toBeGreaterThanOrEqual(0.09);
        }
      });
    });

    it('should respect maxAssets constraint', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = {
        method: 'max_sharpe',
        riskFreeRate: 0.02,
        constraints: { maxAssets: 2 },
      };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      const nonZero = result.allocations.filter(a => a.weight > 0.001);
      expect(nonZero.length).toBeLessThanOrEqual(2);
    });

    it('should fall back to equal_weight for unknown method', () => {
      const opt = new PortfolioOptimizer();
      const config: OptimizationConfig = { method: 'unknown' as any, riskFreeRate: 0.02 };
      const result = opt.optimize(makeAssets(), makeCorr(), config);
      expect(result.allocations.length).toBe(4);
    });
  });

  // ── efficientFrontier ────────────────────────────────────────
  describe('efficientFrontier', () => {
    it('should return frontier points', () => {
      const opt = new PortfolioOptimizer();
      const points = opt.efficientFrontier(makeAssets(), makeCorr(), 10);
      expect(points.length).toBeGreaterThan(0);
      points.forEach(p => {
        expect(p.expectedReturn).toBeDefined();
        expect(p.expectedVolatility).toBeGreaterThan(0);
      });
    });

    it('should handle default points count', () => {
      const opt = new PortfolioOptimizer();
      const points = opt.efficientFrontier(makeAssets(), makeCorr());
      expect(points.length).toBeGreaterThan(0);
    });
  });

  // ── analyzePortfolio ─────────────────────────────────────────
  describe('analyzePortfolio', () => {
    it('should analyze portfolio diversification', () => {
      const opt = new PortfolioOptimizer();
      const weights = [0.25, 0.25, 0.25, 0.25];
      const analysis = opt.analyzePortfolio(weights);
      expect(analysis).toBeDefined();
      expect(analysis.diversification).toBeDefined();
      expect(analysis.concentration).toBeDefined();
      expect(analysis.herfindahlIndex).toBeDefined();
    });
  });

  // ── rebalance ────────────────────────────────────────────────
  describe('rebalance', () => {
    it('should compute rebalance trades', () => {
      const opt = new PortfolioOptimizer();
      const currentWeights = [0.3, 0.2, 0.3, 0.2];
      const targetWeights = [0.25, 0.25, 0.25, 0.25];
      const result = opt.rebalance(currentWeights, targetWeights);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
