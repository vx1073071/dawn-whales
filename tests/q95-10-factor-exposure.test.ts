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

function makeReturns(length: number, drift = 0.001, vol = 0.02): number[] {
  const values: number[] = [];
  for (let i = 0; i < length; i++) {
    values.push(drift + (Math.random() - 0.5) * vol * 2);
  }
  return values;
}

function makePosition(pnl: number): any {
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
  describe('constructor', () => {
    it('should create analyzer', () => {
      const analyzer = new FactorExposureAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  describe('estimateLoadings', () => {
    it('should estimate factor loadings from returns', () => {
      const analyzer = new FactorExposureAnalyzer();
      const returns = makeReturns(100);
      const benchmarkReturns = makeReturns(100);
      const loadings = analyzer.estimateLoadings(returns, benchmarkReturns);
      expect(loadings).toBeDefined();
      expect(typeof loadings.marketBeta).toBe('number');
      expect(typeof loadings.smbBeta).toBe('number');
      expect(typeof loadings.hmlBeta).toBe('number');
      expect(typeof loadings.rmwBeta).toBe('number');
      expect(typeof loadings.cmaBeta).toBe('number');
      expect(typeof loadings.momentumBeta).toBe('number');
      expect(typeof loadings.lowVolBeta).toBe('number');
      expect(typeof loadings.qualityBeta).toBe('number');
    });

    it('should handle zero benchmark returns', () => {
      const analyzer = new FactorExposureAnalyzer();
      const returns = makeReturns(100);
      const benchmark = Array.from({ length: 100 }, () => 0);
      const loadings = analyzer.estimateLoadings(returns, benchmark);
      expect(loadings).toBeDefined();
    });
  });

  describe('analyzeAttribution', () => {
    it('should analyze performance attribution', () => {
      const analyzer = new FactorExposureAnalyzer();
      const positions = [makePosition(500), makePosition(800), makePosition(-200)];
      const marketReturns = makeReturns(3, 0.005, 0.01);
      const report = analyzer.analyzeAttribution('test_strategy', positions, marketReturns);
      expect(report).toBeDefined();
      expect(typeof report.totalPnL).toBe('number');
      expect(report.loadings).toBeDefined();
      expect(typeof report.loadings.marketBeta).toBe('number');
    });

    it('should include factor returns and contributions', () => {
      const analyzer = new FactorExposureAnalyzer();
      const positions = [makePosition(500)];
      const marketReturns = makeReturns(1);
      const report = analyzer.analyzeAttribution('single', positions, marketReturns);
      expect(Array.isArray(report.factorReturns)).toBe(true);
      expect(Array.isArray(report.contributions)).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate text report', () => {
      const analyzer = new FactorExposureAnalyzer();
      const report: any = {
        strategyId: 'test',
        period: { start: '2025-01-01', end: '2025-06-30' },
        totalPnL: 15000,
        loadings: { marketBeta: 1.1, smbBeta: -0.2, hmlBeta: 0.3, rmwBeta: 0.1, cmaBeta: -0.1, momentumBeta: 0.05, lowVolBeta: -0.15, qualityBeta: 0.2 },
        factorReturns: [{ date: '2025-01-01', market: 0.01, smb: 0.002, hml: -0.003, rmw: 0.001, cma: 0 }],
        contributions: [{ factor: 'market', label: 'Market', avgBeta: 1.1, contributionPct: 80, contributionAbs: 12000, isDominant: true }],
        residualPnL: 500,
      };
      const text = analyzer.generateReport(report);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(10);
    });
  });

  describe('getFactorExposureAnalyzer', () => {
    it('should return singleton instance', () => {
      const a1 = getFactorExposureAnalyzer();
      const a2 = getFactorExposureAnalyzer();
      expect(a1).toBe(a2);
      expect(a1).toBeInstanceOf(FactorExposureAnalyzer);
    });
  });
});
