/**
 * Q95-09: ParallelBacktestEngine Tests
 * Coverage for parallel backtest execution
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ParallelBacktestEngine } from '../electron/engine/backtest/backtest-engine-parallel';
import type { BacktestConfig } from '../electron/engine/backtest/backtest-engine';

function makeConfig(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol: 'AAPL',
    strategy: 'sma_crossover',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    initialCapital: 100_000,
    params: { smaShort: 10, smaLong: 50 },
    ...overrides,
  };
}

describe('Q95-09: ParallelBacktestEngine', () => {
  // ── Constructor ───────────────────────────────────────────────
  describe('constructor', () => {
    it('should create engine with default workers', () => {
      const engine = new ParallelBacktestEngine();
      expect(engine).toBeDefined();
    });

    it('should create engine with custom worker count', () => {
      const engine = new ParallelBacktestEngine(2);
      expect(engine).toBeDefined();
    });
  });

  // ── run (single) ─────────────────────────────────────────────
  describe('run (single)', () => {
    it('should run single backtest', async () => {
      const engine = new ParallelBacktestEngine(1);
      const config = makeConfig();
      const result = await engine.run(config);
      expect(result).toBeDefined();
      // BacktestResult shape
      expect(result.result.totalReturn).toBeGreaterThanOrEqual(-100);
    });
  });

  // ── runParallel ──────────────────────────────────────────────
  describe('runParallel', () => {
    it('should run multiple backtests in parallel', async () => {
      const engine = new ParallelBacktestEngine(2);
      const configs = [
        makeConfig({ symbol: 'AAPL' }),
        makeConfig({ symbol: 'GOOGL', params: { smaShort: 20, smaLong: 60 } }),
      ];
      const result = await engine.runParallel(configs);
      expect(result).toBeDefined();
      expect(result.totalJobs).toBe(2);
      expect(result.results).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should count successful and failed jobs', async () => {
      const engine = new ParallelBacktestEngine(2);
      const configs = [
        makeConfig({ symbol: 'AAPL' }),
        makeConfig({ symbol: 'MSFT' }),
      ];
      const result = await engine.runParallel(configs);
      expect(result.successfulJobs).toBeGreaterThanOrEqual(0);
      expect(typeof result.failedJobs).toBe('number');
      expect(result.successfulJobs + result.failedJobs).toBe(result.totalJobs);
    });
  });

  // ── runBatch ─────────────────────────────────────────────────
  describe('runBatch', () => {
    it('should run batch of configs', async () => {
      const engine = new ParallelBacktestEngine(2);
      const configs = [
        makeConfig({ symbol: 'NVDA' }),
        makeConfig({ symbol: 'META' }),
        makeConfig({ symbol: 'TSLA' }),
      ];
      const result = await engine.runBatch(configs);
      expect(result).toBeDefined();
      expect(result.totalJobs).toBe(3);
      expect(result.results.length).toBe(3);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle empty config array', async () => {
      const engine = new ParallelBacktestEngine(1);
      const result = await engine.runParallel([]);
      expect(result.totalJobs).toBe(0);
      expect(result.results.length).toBe(0);
    });

    it('should handle single config', async () => {
      const engine = new ParallelBacktestEngine(1);
      const configs = [makeConfig()];
      const result = await engine.runBatch(configs);
      expect(result.totalJobs).toBe(1);
    });

    it('should handle 10 configs', async () => {
      const engine = new ParallelBacktestEngine(4);
      const configs = Array.from({ length: 10 }, (_, i) => makeConfig({ symbol: `STOCK${i}` }));
      const result = await engine.runBatch(configs);
      expect(result.totalJobs).toBe(10);
    });
  });
});
