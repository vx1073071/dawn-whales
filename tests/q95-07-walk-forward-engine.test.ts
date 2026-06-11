/**
 * Q95-07: WalkForwardEngine Tests
 * Coverage for walk-forward optimization engine
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { WalkForwardEngine, createDefaultWalkForwardEngine } from '../electron/engine/backtest/walk-forward-engine';
import type { ParamRange, KLine, Trade } from '../electron/engine/backtest/walk-forward-engine';

// StrategyRunner is a function type: (data: KLine[], params: Record<string, number>) => Trade[]
function strategyRunner(_data: KLine[], params: Record<string, number>): Trade[] {
  const smaShort = Number(params.smaShort) || 10;
  const smaLong = Number(params.smaLong) || 50;
  return [
    { symbol: 'AAPL', entryTime: 1704067200000, exitTime: 1704153600000, entryPrice: 100, exitPrice: 105, pnl: 5, side: 'long', quantity: 100 },
    { symbol: 'AAPL', entryTime: 1704240000000, exitTime: 1704326400000, entryPrice: 106, exitPrice: 110, pnl: 4, side: 'long', quantity: 100 },
  ];
}

function makeKLine(overrides: Partial<KLine> = {}): KLine {
  return {
    time: 1704067200000,
    open: 100,
    high: 105,
    low: 98,
    close: 102,
    volume: 1_000_000,
    ...overrides,
  };
}

function makeParamRanges(): ParamRange[] {
  return [
    { name: 'smaShort', min: 5, max: 20, step: 5 },
    { name: 'smaLong', min: 30, max: 60, step: 10 },
  ];
}

describe('Q95-07: WalkForwardEngine', () => {
  // ── Constructor & Config ─────────────────────────────────────
  describe('constructor & config', () => {
    it('should create engine with default config', () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges(), {
        windowSize: 30,
        stepSize: 10,
        minWindowSize: 20,
      });
      expect(engine).toBeDefined();
    });

    it('should return config', () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges(), {
        windowSize: 30,
        stepSize: 10,
        minWindowSize: 20,
      });
      const config = engine.getConfig();
      expect(config.windowSize).toBe(30);
      expect(config.stepSize).toBe(10);
      expect(config.minWindowSize).toBe(20);
    });

    it('should update config partially', () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges(), {
        windowSize: 30,
        stepSize: 10,
        minWindowSize: 20,
      });
      engine.updateConfig({ windowSize: 50, stepSize: 15 });
      expect(engine.getConfig().windowSize).toBe(50);
      expect(engine.getConfig().stepSize).toBe(15);
    });

    it('should return param ranges', () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges());
      const ranges = engine.getParamRanges();
      expect(ranges.length).toBe(2);
      expect(ranges[0].name).toBe('smaShort');
    });

    it('should not be running initially', () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges());
      expect(engine.isRunning()).toBe(false);
    });
  });

  // ── Run ───────────────────────────────────────────────────────
  describe('run', () => {
    it('should run walk-forward on kline data', async () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges(), { windowSize: 30, stepSize: 10, minWindowSize: 20 });
      const data: KLine[] = Array.from({ length: 100 }, (_, i) =>
        makeKLine({ time: 1704067200000 + i * 86400000, close: 100 + i * 0.5 })
      );
      const result = await engine.run(data);
      expect(result).toBeDefined();
      expect(result.windows).toBeDefined();
      expect(Array.isArray(result.windows)).toBe(true);
    });
  });

  // ── Generate Report ───────────────────────────────────────────
  describe('generateReport', () => {
    it('should generate a report from kline data', async () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges(), { windowSize: 30, stepSize: 10, minWindowSize: 20 });
      const data: KLine[] = Array.from({ length: 60 }, (_, i) =>
        makeKLine({ time: 1704067200000 + i * 86400000 })
      );
      const report = await engine.generateReport(data);
      expect(report).toBeDefined();
      expect(typeof report.bestParams).toBe('object');
      expect(typeof report.totalReturn).toBe('number');
    });
  });

  // ── Factory ──────────────────────────────────────────────────
  describe('createDefaultWalkForwardEngine', () => {
    it('should create a default engine', () => {
      const defaultEngine = createDefaultWalkForwardEngine(strategyRunner);
      expect(defaultEngine).toBeDefined();
      expect(defaultEngine.getConfig().windowSize).toBeDefined();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle empty data gracefully', async () => {
      const engine = new WalkForwardEngine(strategyRunner, makeParamRanges(), { windowSize: 30, stepSize: 10, minWindowSize: 20 });
      const result = await engine.run([]);
      expect(result).toBeDefined();
    });

    it('should handle single param range', () => {
      const ranges: ParamRange[] = [{ name: 'threshold', min: 0.1, max: 0.5, step: 0.1 }];
      const engine = new WalkForwardEngine(strategyRunner, ranges);
      expect(engine.getParamRanges().length).toBe(1);
    });
  });
});
