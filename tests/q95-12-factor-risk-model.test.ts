/**
 * Q95-12: FactorRiskModel Tests
 * Coverage for factor risk model
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { FactorRiskModel } from '../electron/engine/factors/factor-risk-model';
import type { FactorExposure } from '../electron/engine/factors/factor-risk-model';

function makePosition(overrides: Record<string, unknown> = {}): any {
  return {
    symbol: 'AAPL',
    weight: 0.1,
    marketCap: 2_500_000_000_000,
    bvpm: 25,
    momentum6m: 0.12,
    adv20: 55_000_000,
    vol20: 0.22,
    earningsYield: 0.04,
    revenueGrowth: 0.15,
    roe: 0.35,
    dividendYield: 0.005,
    ...overrides,
  };
}

describe('Q95-12: FactorRiskModel', () => {
  describe('constructor', () => {
    it('should create model', () => {
      const model = new FactorRiskModel();
      expect(model).toBeDefined();
    });
  });

  describe('computeExposures', () => {
    it('should compute factor exposures for a portfolio', () => {
      const model = new FactorRiskModel();
      const positions = [
        makePosition({ symbol: 'AAPL', weight: 0.3 }),
        makePosition({ symbol: 'GOOGL', weight: 0.25 }),
        makePosition({ symbol: 'MSFT', weight: 0.25 }),
        makePosition({ symbol: 'AMZN', weight: 0.2 }),
      ];
      const exposures = model.computeExposures(positions);
      expect(exposures.length).toBeGreaterThan(0);
      exposures.forEach((exp: FactorExposure) => {
        expect(typeof exp.factor).toBe('string');
        expect(typeof exp.label).toBe('string');
        expect(typeof exp.exposure).toBe('number');
        expect(typeof exp.contribution).toBe('number');
      });
    });

    it('should handle single position', () => {
      const model = new FactorRiskModel();
      const positions = [makePosition()];
      const exposures = model.computeExposures(positions);
      expect(exposures.length).toBeGreaterThan(0);
    });

    it('should handle positions with missing optional fields', () => {
      const model = new FactorRiskModel();
      const positions = [
        { symbol: 'AAPL', weight: 0.5 },
        { symbol: 'GOOGL', weight: 0.5 },
      ];
      const exposures = model.computeExposures(positions);
      expect(exposures).toBeDefined();
    });
  });

  describe('generateReport', () => {
    it('should generate factor risk report', () => {
      const model = new FactorRiskModel();
      const positions = [
        makePosition({ symbol: 'AAPL', weight: 0.3, marketCap: 2_500_000_000_000 }),
        makePosition({ symbol: 'GOOGL', weight: 0.2, marketCap: 1_800_000_000_000 }),
        makePosition({ symbol: 'MSFT', weight: 0.3, marketCap: 2_300_000_000_000 }),
        makePosition({ symbol: 'AMZN', weight: 0.2, marketCap: 1_500_000_000_000 }),
      ];
      const report = model.generateReport('test_portfolio', positions, 0.02);
      expect(report).toBeDefined();
      expect(typeof report.portfolioId).toBe('string');
      expect(typeof report.totalRisk).toBe('number');
      expect(typeof report.systematicRisk).toBe('number');
      expect(typeof report.idiosyncraticRisk).toBe('number');
    });

    it('should use default totalVol when not provided', () => {
      const model = new FactorRiskModel();
      const positions = [makePosition({ symbol: 'AAPL', weight: 1.0 })];
      const report = model.generateReport('default_portfolio', positions);
      expect(report).toBeDefined();
      expect(typeof report.totalRisk).toBe('number');
    });

    it('should report includes various risk factors', () => {
      const model = new FactorRiskModel();
      const positions = [
        makePosition({ symbol: 'AAPL', weight: 0.5 }),
        makePosition({ symbol: 'KO', weight: 0.3, roe: 0.45, dividendYield: 0.03 }),
        makePosition({ symbol: 'XOM', weight: 0.2, dividendYield: 0.04 }),
      ];
      const report = model.generateReport('diversified', positions, 0.03);
      expect(report.totalRisk).toBeGreaterThanOrEqual(0);
    });
  });
});
