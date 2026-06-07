import { describe, it, expect } from 'vitest';
import { BacktestReplayEngine } from '../electron/engine/backtest-replay';
import { compareBacktests, summaryTable } from '../electron/engine/backtest-comparator';

/**
 * Q-44-04: Engine Performance Benchmark
 *
 * Tests that key operations complete within reasonable time bounds.
 * These prevent accidental O(n²) or memory blow-up regressions.
 */
describe('Q-44-04: Engine Performance Benchmarks', () => {

  // ── BacktestReplayEngine ───────────────────────────────────────────────
  describe('BacktestReplayEngine', () => {
    let engine: BacktestReplayEngine;

    afterEach(() => { engine?.stop?.(); });

    it('should load 1000 bars in < 200ms', () => {
      engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const bars = Array.from({ length: 1000 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));

      const start = Date.now();
      engine.load(bars);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
    });

    it('should seek within 1000 bars in < 50ms', () => {
      engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const bars = Array.from({ length: 1000 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));
      engine.load(bars);

      const start = Date.now();
      engine.seekTo(500);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should stepForward 100 bars in < 50ms', () => {
      engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const bars = Array.from({ length: 200 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));
      engine.load(bars);

      const start = Date.now();
      engine.stepForward(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should reset 1000-bar state in < 50ms', () => {
      engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const bars = Array.from({ length: 1000 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));
      engine.load(bars);

      const start = Date.now();
      engine.reset();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });

  // ── BacktestComparator ────────────────────────────────────────────────
  describe('BacktestComparator', () => {
    const makeResult = (id: string, ret: number, sharpe: number, mdd: number) => ({
      id, name: id, symbol: 'HK.00700', startDate: '2024-01-01', endDate: '2024-12-31',
      totalReturn: ret, sharpeRatio: sharpe, maxDrawdown: mdd, sortinoRatio: 1.5, calmarRatio: 1.2,
      winRate: 0.55, profitFactor: 1.8, totalTrades: 100, avgHoldingDays: 5,
      beta: 0.8, alpha: 2, turnover: 0.5,
    });

    it('should compare 10 strategies in < 200ms', () => {
      const results = Array.from({ length: 10 }, (_, i) =>
        makeResult(`s${i}`, 5 + i * 5, 0.5 + i * 0.2, -5 - i * 2)
      );

      const start = Date.now();
      const comp = compareBacktests(results);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(comp.perStrategy).toHaveLength(10);
    });

    it('should compare 50 strategies in < 500ms', () => {
      const results = Array.from({ length: 50 }, (_, i) =>
        makeResult(`s${i}`, 5 + i * 3, 0.5 + i * 0.05, -5 - i)
      );

      const start = Date.now();
      const comp = compareBacktests(results);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(comp.perStrategy).toHaveLength(50);
    });

    it('should produce summaryTable for 10 strategies in < 100ms', () => {
      const results = Array.from({ length: 10 }, (_, i) =>
        makeResult(`s${i}`, 5 + i * 5, 0.5 + i * 0.2, -5 - i * 2)
      );

      const start = Date.now();
      const table = summaryTable(results);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(table).toHaveLength(10);
    });

    it('should rank 100 strategies without degradation in < 1000ms', () => {
      const results = Array.from({ length: 100 }, (_, i) =>
        makeResult(`s${i}`, 5 + i * 2, 0.5 + i * 0.02, -5 - i * 0.5)
      );

      const start = Date.now();
      const comp = compareBacktests(results);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
      expect(comp.perStrategy).toHaveLength(100);
    });
  });

  // ── Speed regression: multiple load cycles ──────────────────────────
  describe('BacktestReplayEngine regression', () => {
    it('should not slow down on repeated load/reset cycles', () => {
      const engine = new BacktestReplayEngine();
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };

      // First batch
      const start1 = Date.now();
      for (let i = 0; i < 10; i++) {
        const bars = Array.from({ length: 100 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
        engine.load(bars);
        engine.reset();
      }
      const t1 = Date.now() - start1;

      // Subsequent batch — should not be significantly slower
      const start2 = Date.now();
      for (let i = 0; i < 10; i++) {
        const bars = Array.from({ length: 100 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
        engine.load(bars);
        engine.reset();
      }
      const t2 = Date.now() - start2;

      // Second batch should not take more than 3x first batch (generous margin)
      expect(t2).toBeLessThan(t1 * 3);
      engine.stop?.();
    });
  });
});
