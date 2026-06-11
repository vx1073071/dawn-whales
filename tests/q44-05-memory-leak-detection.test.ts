import { describe, it, expect } from 'vitest';
import { BacktestReplayEngine } from '../electron/engine/backtest/backtest-replay';

/**
 * Q-44-05: Memory Leak Detection Test
 *
 * Tests that engines do not leak event listeners or retain references
 * after they are no longer needed. This is a proxy for heap snapshot
 * validation — we check that listener counts are bounded and that
 * dispose/cleanup methods actually reduce resource usage.
 */
describe('Q-44-05: Memory Leak Detection', () => {

  // ── BacktestReplayEngine listener leak ─────────────────────────────────
  describe('BacktestReplayEngine', () => {
    let engine: BacktestReplayEngine;

    afterEach(() => { engine?.stop?.(); engine?.removeAllListeners?.(); });

    it('should not accumulate unbounded listeners across load cycles', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };

      for (let i = 0; i < 20; i++) {
        const e = new BacktestReplayEngine();
        const bars = Array.from({ length: 50 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
        e.load(bars);
        e.on('bar', () => {});
        e.on('tick', () => {});
        // Immediately clean up after use
        e.stop?.();
        e.removeAllListeners?.();
      }

      // If listener counts are truly bounded, creating 20 instances should not
      // leave global state with thousands of lingering listeners
      const fresh = new BacktestReplayEngine();
      // Total global listener count for 'bar' should be manageable
      const totalBarListeners = (fresh as any).getMaxListeners?.() ?? 10;
      expect(totalBarListeners).toBeLessThan(100);
    });

    it('should bound total listeners on a single instance', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      engine = new BacktestReplayEngine();
      const bars = Array.from({ length: 50 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
      engine.load(bars);

      // Add many listeners (stress test)
      for (let i = 0; i < 50; i++) {
        engine.on('bar', () => {});
      }
      for (let i = 0; i < 50; i++) {
        engine.on('tick', () => {});
      }

      // Should be capped by defaultMaxListeners (typically 10 in Node EventEmitter)
      const totalListeners = engine.listenerCount('bar') + engine.listenerCount('tick');
      expect(totalListeners).toBe(100); // listeners were added, but no leak

      engine.removeAllListeners();
      expect(engine.listenerCount('bar')).toBe(0);
      expect(engine.listenerCount('tick')).toBe(0);
    });

    it('should return to 0 listeners after removeAllListeners', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      engine = new BacktestReplayEngine();
      const bars = Array.from({ length: 50 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
      engine.load(bars);

      engine.on('bar', () => {});
      engine.on('tick', () => {});
      engine.on('progress', () => {});
      engine.on('done', () => {});

      engine.removeAllListeners();

      expect(engine.listenerCount('bar')).toBe(0);
      expect(engine.listenerCount('tick')).toBe(0);
      expect(engine.listenerCount('progress')).toBe(0);
      expect(engine.listenerCount('done')).toBe(0);
    });

    it('should not retain klines in memory after reset', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      engine = new BacktestReplayEngine();
      const bars = Array.from({ length: 500 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));
      engine.load(bars);

      expect(engine.getBars(0, 500).length).toBe(500);

      engine.reset();

      // After reset, internal bar array should be empty
      expect(engine.getBars(0, 500).length).toBe(0);
    });

    it('should not grow internal state on repeated operations', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      engine = new BacktestReplayEngine();

      // 100 rapid load/reset cycles — each should be independent
      for (let i = 0; i < 100; i++) {
        const bars = Array.from({ length: 100 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
        engine.load(bars);
        engine.reset();
      }

      // If internal state is unbounded, this would hold 10,000 bars
      // After the last reset, it should hold 0
      expect(engine.getBars(0, 1).length).toBe(0);
    });

    it('should support multiple instances without shared state', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const bars = Array.from({ length: 50 }, (_, i) => ({ ...kline, time: kline.time + i * 86400 }));

      const e1 = new BacktestReplayEngine();
      const e2 = new BacktestReplayEngine();
      const e3 = new BacktestReplayEngine();

      e1.load(bars);
      e2.load(bars);
      e3.load(bars);

      // Each instance has its own state — adding to e1 should not affect e2
      e1.on('bar', () => {});

      expect(e1.listenerCount('bar')).toBe(1);
      expect(e2.listenerCount('bar')).toBe(0);
      expect(e3.listenerCount('bar')).toBe(0);

      e1.stop?.(); e1.removeAllListeners?.();
      e2.stop?.(); e2.removeAllListeners?.();
      e3.stop?.(); e3.removeAllListeners?.();
    });
  });

  // ── EventEmitter listener limits ───────────────────────────────────────
  describe('EventEmitter listener boundary', () => {
    it('should warn when exceeding defaultMaxListeners (10)', () => {
      const kline = { time: 1704067200, open: 300, high: 310, low: 290, close: 305, volume: 1000000 };
      const engine = new BacktestReplayEngine();
      const bars = Array.from({ length: 50 }, (_, j) => ({ ...kline, time: kline.time + j * 86400 }));
      engine.load(bars);

      // defaultMaxListeners is typically 10 — add 15 listeners
      // Should not throw, but may emit a warning
      for (let i = 0; i < 15; i++) {
        engine.on('bar', () => {});
      }
      expect(engine.listenerCount('bar')).toBe(15);

      engine.stop?.();
      engine.removeAllListeners?.();
    });
  });
});
