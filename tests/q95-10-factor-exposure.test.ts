/**
 * Q95-10: FactorExposureAnalyzer Tests
 * Coverage for factor exposure analysis
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  FactorExposureAnalyzer,
  getFactorExposureAnalyzer,
} from '../electron/engine/factors/factor-exposure';
import type { FactorAttributionReport } from '../electron/engine/factors/factor-exposure';

function makeReturns(length: number, drift = 0.001, vol = 0.02): number[] {
  const values: number[] = [];
  for (let i = 0; i < length; i++) {
    values.push(drift + (Math.random() - 0.5) * vol * 2);
  }
  return values;
}

function makePosition(symbol: string, pnl: number): any {
  return {
    strategyId: 'test_strategy',
    entryTime: 1704067200000,
    exitTime: 1704153600000,
    entryPrice: 100,
    exitPrice: 100 + pnl,
    pnl,
  };
}

describe('Q95-10: FactorExposureAnalyzer', () => {
  // ── Constructor ───────────────────────────────────────────────
  describe('constructor', () => {
    it('should create analyzer', () => {
      const analyzer = new FactorExposureAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  // ── estimateLoadings ─────────────────────────────────────────
  describe('estimateLoadings', () => {
    it('should estimate factor loadings from returns', () => {
      const analyzer = new FactorExposureAnalyzer();
      const returns = makeReturns(100);
      const benchmarkReturns = makeReturns(100);
      const loadings = analyzer.estimateLoadings(returns, benchmarkReturns);
      expect(loadings).toBeDefined();
      expect(typeof loadings.alpha).toBe('number');
      expect(typeof loadings.beta).toBe('number');
      expect(typeof loadings.rSquared).toBe('number');
      expect(typeof loadings.residualVol).toBe('number');
    });

    it('should handle identical returns', () => {
      const analyzer = new FactorExposureAnalyzer();
      const returns = Array.from({ length: 50 }, () => 0.01);
      const benchmark = Array.from({ length: 50 }, () => 0.01);
      const loadings = analyzer.estimateLoadings(returns, benchmark);
      expect(loadings.rSquared).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero benchmark returns', () => {
      const analyzer = new FactorExposureAnalyzer();
      const returns = makeReturns(100);
      const benchmark = Array.from({ length: 100 }, () => 0);
      const loadings = analyzer.estimateLoadings(returns, benchmark);
      expect(loadings).toBeDefined();
      expect(typeof loadings.beta).toBe('number');
    });
  });

  // ── analyzeAttribution ────────────────────────────────────────
  describe('analyzeAttribution', () => {
    it('should analyze performance attribution', () => {
      const analyzer = new FactorExposureAnalyzer();
      const positions = [
        makePosition('AAPL', 500),
        makePosition('GOOGL', 800),
        makePosition('MSFT', -200),
      ];
      const marketReturns = makeReturns(3, 0.005, 0.01);
      const report = analyzer.analyzeAttribution('test_strategy', positions, marketReturns);
      expect(report).toBeDefined();
      expect(typeof report.totalReturn).toBe('number');
      expect(typeof report.marketReturn).toBe('number');
      expect(typeof report.alpha).toBe('number');
      expect(typeof report.beta).toBe('number');
    });

    it('should handle single position', () => {
      const analyzer = new FactorExposureAnalyzer();
      const positions = [makePosition('AAPL', 1000)];
      const marketReturns = makeReturns(1, 0.003);
      const report = analyzer.analyzeAttribution('single', positions, marketReturns);
      expect(report).toBeDefined();
    });
  });

  // ── generateReport ───────────────────────────────────────────
  describe('generateReport', () => {
    it('should generate text report', () => {
      const analyzer = new FactorExposureAnalyzer();
      const report: FactorAttributionReport = {
        totalReturn: 15.5,
        marketReturn: 10.0,
        alpha: 5.5,
        beta: 1.2,
        factorAttributions: [
          { factor: 'market', contribution: 10.0 },
          { factor: 'alpha', contribution: 5.5 },
        ],
        sharpe: 1.5,
        sortino: 2.1,
        maxDrawdown: -8.0,
      };
      const text = analyzer.generateReport(report);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(10);
    });

    it('should handle negative returns', () => {
      const analyzer = new FactorExposureAnalyzer();
      const report: FactorAttributionReport = {
        totalReturn: -10.0,
        marketReturn: 5.0,
        alpha: -15.0,
        beta: 1.1,
        factorAttributions: [],
        sharpe: -0.5,
        sortino: -0.3,
        maxDrawdown: -25.0,
      };
      const text = analyzer.generateReport(report);
      expect(typeof text).toBe('string');
    });
  });

  // ── Factory ───────────────────────────────────────────────────
  describe('getFactorExposureAnalyzer', () => {
    it('should return a FactorExposureAnalyzer instance', () => {
      const analyzer = getFactorExposureAnalyzer();
      expect(analyzer).toBeInstanceOf(FactorExposureAnalyzer);
    });
  });
});
