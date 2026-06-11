/**
 * Q95-04: AI Report Generator Extended Tests
 * Coverage for generateBacktestReport + generateQuickReport
 * (extends jvs-44-01 which covers daily/weekly/monthly)
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateBacktestReport,
  generateQuickReport,
} from '../electron/engine/agents/ai-report-generator';

// Create a BacktestResult-shaped object matching the interface in backtest-engine.ts
function makeBacktestResult(overrides: Record<string, unknown> = {}): any {
  return {
    success: true,
    result: {
      totalReturn: 25.0,
      annualReturn: 22.0,
      sharpeRatio: 1.5,
      maxDrawdown: -12.0,
      winRate: 58.0,
      profitFactor: 1.8,
      totalTrades: 48,
      avgTradePnl: 0.5,
      avgHoldingBars: 5,
      equityCurve: [
        { time: 1704067200000, value: 100000 },
        { time: 1706745600000, value: 112000 },
        { time: 1709251200000, value: 125000 },
      ],
      trades: [
        { symbol: 'AAPL', side: 'buy', entryPrice: 150, exitPrice: 160, pnl: 1000, entryTime: 1704067200000, exitTime: 1704153600000, bars: 3 },
      ],
      config: {
        symbol: 'AAPL',
        strategy: 'sma_crossover',
        startDate: '2025-01-01',
        endDate: '2026-01-01',
        initialCapital: 100000,
        params: { smaShort: 10, smaLong: 50 },
      },
      ...overrides,
    },
  };
}

describe('Q95-04: AI Report Generator Extended', () => {
  // ── generateBacktestReport ──────────────────────────────────
  describe('generateBacktestReport', () => {
    it('should generate a backtest report with full metrics', async () => {
      const results = [makeBacktestResult()];
      const report = await generateBacktestReport(results);
      expect(report).toBeDefined();
      expect(typeof report).toBe('object');
      expect(report.title).toBeDefined();
      expect(report.sections).toBeDefined();
      expect(report.sections.length).toBeGreaterThan(0);
    });

    it('should handle multiple backtest results', async () => {
      const results = [
        makeBacktestResult(),
        makeBacktestResult({ totalReturn: 15.0, sharpeRatio: 1.2 }),
      ];
      const report = await generateBacktestReport(results);
      expect(report).toBeDefined();
      expect(report.sections.length).toBeGreaterThan(0);
    });

    it('should handle empty results array', async () => {
      const report = await generateBacktestReport([]);
      expect(report).toBeDefined();
      expect(report.title).toBe('No Data');
    });

    it('should handle negative returns', async () => {
      const results = [makeBacktestResult({
        totalReturn: -15.0,
        sharpeRatio: -0.5,
        maxDrawdown: -30.0,
        winRate: 35.0,
      })];
      const report = await generateBacktestReport(results);
      expect(report).toBeDefined();
    });

    it('should set fallback flag on timeout', async () => {
      const results = [makeBacktestResult()];
      const report = await generateBacktestReport(results, 'AAPL', 1); // 1ms timeout
      expect(report).toBeDefined();
      // Should fallback since LLM call will timeout
      expect(report.fallback).toBe(true);
    });

    it('should include generatedAt timestamp', async () => {
      const results = [makeBacktestResult()];
      const report = await generateBacktestReport(results);
      expect(typeof report.generatedAt).toBe('number');
      expect(report.generatedAt).toBeGreaterThan(0);
    });
  });

  // ── generateQuickReport ─────────────────────────────────────
  describe('generateQuickReport', () => {
    it('should generate a quick report from single result', async () => {
      const result = makeBacktestResult();
      const report = await generateQuickReport(result);
      expect(report).toBeDefined();
      expect(typeof report).toBe('object');
      expect(report.title).toBeDefined();
    });

    it('should pass symbol from config', async () => {
      const result = makeBacktestResult();
      result.result.config.symbol = 'NVDA';
      const report = await generateQuickReport(result);
      expect(report).toBeDefined();
    });
  });
});
