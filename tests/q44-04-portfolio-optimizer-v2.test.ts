import { describe, it, expect } from 'vitest';
import {
  BlackLitterman,
  PortfolioOptimizerV2,
  Asset,
  OptimizationConstraints,
  OptimizationResult,
} from '../electron/engine/portfolio-optimizer-v2';

describe('PortfolioOptimizerV2', () => {
  describe('BlackLitterman', () => {
    const marketCaps: Record<string, number> = {
      'HK.00700': 3000000000000,
      'HK.09988': 2000000000000,
      'HK.01810': 1000000000000,
    };

    it('should compute implied returns from market caps', () => {
      const bl = new BlackLitterman(marketCaps, 0.02);
      const covMatrix: number[][] = [[0.0625, 0.03, 0.04], [0.03, 0.09, 0.05], [0.04, 0.05, 0.16]];
      const weights = [0.3, 0.2, 0.1];
      const implied = bl.computeImpliedReturns(covMatrix, weights);
      expect(implied).toBeInstanceOf(Object);
      expect(implied['HK.00700']).toBeGreaterThan(0);
    });

    it('should integrate views into implied returns', () => {
      const bl = new BlackLitterman(marketCaps, 0.02);
      const covMatrix: number[][] = [[0.0625, 0.03, 0.04], [0.03, 0.09, 0.05], [0.04, 0.05, 0.16]];
      const weights = [0.3, 0.2, 0.1];
      const implied = bl.computeImpliedReturns(covMatrix, weights);
      const views = [{ assets: ['HK.00700'], return: 0.20, confidence: 0.5 }];
      const output = bl.integrateViews(implied, views, covMatrix);
      expect(output).toHaveProperty('posteriorReturns');
      expect(output).toHaveProperty('impliedReturns');
      expect(output).toHaveProperty('views');
      expect(output.posteriorReturns['HK.00700']).not.toBe(implied['HK.00700']);
    });
  });

  describe('PortfolioOptimizerV2', () => {
    const sampleAssets: Asset[] = [
      { symbol: 'HK.00700', name: 'Tencent', expectedReturn: 0.12, volatility: 0.25 },
      { symbol: 'HK.09988', name: 'Alibaba', expectedReturn: 0.10, volatility: 0.30 },
      { symbol: 'HK.01810', name: 'Xiaomi', expectedReturn: 0.15, volatility: 0.40 },
    ];

    const defaultConstraints: OptimizationConstraints = {
      maxWeight: 0.5,
      minWeight: 0.05,
      maxVolatility: 0.3,
      riskFreeRate: 0.02,
    };

    it('should initialize without error', () => {
      const optimizer = new PortfolioOptimizerV2();
      expect(optimizer).toBeDefined();
    });

    it('should optimize with CVaR method', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeCVaR(sampleAssets, defaultConstraints);
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('expectedReturn');
      expect(result).toHaveProperty('expectedVolatility');
      expect(result).toHaveProperty('sharpeRatio');
      expect(result).toHaveProperty('cvar95');
    });

    it('should return Record<string, number> weights', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeCVaR(sampleAssets, defaultConstraints);
      expect(result.weights).toBeInstanceOf(Object);
      expect(result.weights['HK.00700']).toBeGreaterThanOrEqual(0);
    });

    it('should respect maxWeight constraint', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeCVaR(sampleAssets, defaultConstraints);
      for (const w of Object.values(result.weights)) {
        expect(w).toBeLessThanOrEqual((defaultConstraints.maxWeight ?? 1) + 0.01);
      }
    });

    it('should return empty result for empty assets', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeCVaR([], defaultConstraints);
      expect(result.weights).toEqual({});
    });

    it('should optimize with robust method', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeRobust(sampleAssets, defaultConstraints);
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('sharpeRatio');
    });

    it('should optimize with Black-Litterman integration', () => {
      const optimizer = new PortfolioOptimizerV2();
      const views = [{ assets: ['HK.00700'], return: 0.20, confidence: 0.5 }];
      const marketCaps = {
        'HK.00700': 3000000000000,
        'HK.09988': 2000000000000,
        'HK.01810': 1000000000000,
      };
      const result = optimizer.optimizeWithBL(sampleAssets, defaultConstraints, marketCaps, views);
      expect(result).toHaveProperty('weights');
      expect(result).toHaveProperty('expectedReturn');
    });

    it('should include all required fields in OptimizationResult', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeCVaR(sampleAssets, defaultConstraints);
      expect(typeof result.expectedReturn).toBe('number');
      expect(typeof result.expectedVolatility).toBe('number');
      expect(typeof result.sharpeRatio).toBe('number');
      expect(typeof result.cvar95).toBe('number');
      expect(typeof result.var95).toBe('number');
      expect(typeof result.turnover).toBe('number');
      expect(typeof result.method).toBe('string');
    });

    it('should handle single asset', () => {
      const optimizer = new PortfolioOptimizerV2();
      const result = optimizer.optimizeCVaR([sampleAssets[0]], defaultConstraints);
      expect(result.weights['HK.00700']).toBeCloseTo(1, 1);
    });
  });

  describe('OptimizationResult interface compliance', () => {
    it('should satisfy OptimizationResult shape', () => {
      const result: OptimizationResult = {
        weights: { 'HK.00700': 0.6, 'HK.09988': 0.4 },
        expectedReturn: 0.12,
        expectedVolatility: 0.20,
        sharpeRatio: 0.5,
        cvar95: 0.15,
        var95: 0.10,
        turnover: 0.5,
        method: 'cvar',
        metadata: {},
      };
      expect(Object.keys(result.weights)).toHaveLength(2);
      expect(result.sharpeRatio).toBeCloseTo(0.5);
    });
  });
});
