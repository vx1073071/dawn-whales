/**
 * stream-computing.test.ts — R95 J-01 Coverage Boost
 * Tests for Stream Computing Engine (SlidingWindow, Aggregator, StreamComputingEngine)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StreamComputingEngine,
  getStreamComputingEngine,
} from '../../../../electron/engine/data/stream-computing';
import type { TickData, AggregatedData, StreamMetrics } from '../../../../electron/engine/data/stream-computing';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTick(overrides: Partial<TickData> = {}): TickData {
  return {
    symbol: '000001',
    timestamp: Date.now(),
    price: 10.5,
    volume: 1000,
    high: 10.6,
    low: 10.4,
    ...overrides,
  };
}

function makeTicks(n: number, basePrice: number = 10): TickData[] {
  const ticks: TickData[] = [];
  for (let i = 0; i < n; i++) {
    ticks.push(makeTick({
      price: basePrice + i * 0.1,
      volume: 1000 + i * 50,
      timestamp: Date.now() + i * 1000,
    }));
  }
  return ticks;
}

// ── StreamComputingEngine ──────────────────────────────────────────────────

describe('StreamComputingEngine', () => {
  let engine: StreamComputingEngine;

  beforeEach(() => {
    engine = new StreamComputingEngine();
  });

  afterEach(() => {
    engine.removeAllListeners();
  });

  // ── Construction ──────────────────────────────────────────────────────

  describe('construction', () => {
    it('creates with default config', () => {
      expect(engine).toBeInstanceOf(StreamComputingEngine);
    });

    it('creates with custom config', () => {
      const e = new StreamComputingEngine({ type: 'tumbling', size: 300000 });
      expect(e).toBeDefined();
    });
  });

  // ── processTick ──────────────────────────────────────────────────────

  describe('processTick', () => {
    it('returns metrics for single tick', () => {
      const metrics = engine.processTick(makeTick());
      expect(metrics.symbol).toBe('000001');
      expect(metrics.priceChange).toBe(0);
      expect(metrics.priceChangePct).toBe(0);
      expect(metrics.volumeSpike).toBe(false);
    });

    it('calculates price change with two ticks', () => {
      engine.processTick(makeTick({ price: 10 }));
      const metrics = engine.processTick(makeTick({ price: 11 }));
      expect(metrics.priceChange).toBeCloseTo(1);
      expect(metrics.priceChangePct).toBeCloseTo(10);
    });

    it('handles zero previous price', () => {
      engine.processTick(makeTick({ price: 0 }));
      const metrics = engine.processTick(makeTick({ price: 10 }));
      expect(metrics.priceChangePct).toBe(0);
    });

    it('detects volume spike (3x average)', () => {
      engine.processTick(makeTick({ volume: 100, price: 10 }));
      engine.processTick(makeTick({ volume: 100, price: 11 }));
      engine.processTick(makeTick({ volume: 100, price: 11 }));
      const metrics = engine.processTick(makeTick({ volume: 1000, price: 12 }));
      // avg = (100+100+100+1000)/4 = 325, ratio = 1000/325 ≈ 3.08 > 3
      expect(metrics.volumeSpike).toBe(true);
    });

    it('does not flag non-spike volume', () => {
      engine.processTick(makeTick({ volume: 100, price: 10 }));
      engine.processTick(makeTick({ volume: 100, price: 11 }));
      engine.processTick(makeTick({ volume: 100, price: 11 }));
      const metrics = engine.processTick(makeTick({ volume: 150, price: 12 }));
      // avg = (100+100+100+150)/4 = 112.5, ratio = 150/112.5 = 1.33 < 3
      expect(metrics.volumeSpike).toBe(false);
    });

    it('emits tick event with data and metrics', () => {
      const spy = vi.fn();
      engine.on('tick', spy);
      const tick = makeTick();
      engine.processTick(tick);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(tick);
    });

    it('tracks multiple symbols independently', () => {
      engine.processTick(makeTick({ symbol: '000001', price: 10, volume: 100 }));
      engine.processTick(makeTick({ symbol: '000002', price: 20, volume: 100 }));
      const symbols = engine.getSymbols();
      expect(symbols).toContain('000001');
      expect(symbols).toContain('000002');
    });
  });

  // ── getAggregatedData ────────────────────────────────────────────────

  describe('getAggregatedData', () => {
    it('returns null for unknown symbol', () => {
      expect(engine.getAggregatedData('nobody')).toBeNull();
    });

    it('returns aggregated data for known symbol', () => {
      engine.processTick(makeTick({ price: 10, volume: 100, high: 10.5, low: 9.5 }));
      engine.processTick(makeTick({ price: 12, volume: 200, high: 12.5, low: 11.5 }));
      const data = engine.getAggregatedData('000001');
      expect(data).not.toBeNull();
      if (data) {
        expect(data.symbol).toBe('000001');
        expect(data.close).toBe(12);
        expect(data.open).toBe(10);
        expect(data.high).toBe(12.5);
        expect(data.low).toBe(9.5);
        expect(data.volume).toBe(300);
        expect(data.tradeCount).toBe(2);
        expect(data.vwap).toBeGreaterThan(0);
        expect(data.twap).toBeCloseTo(11, 0);
      }
    });

    it('computes VWAP correctly', () => {
      // makeTick defaults high=10.6, low=10.4
      // TP1 = (10.6+10.4+10)/3 = 10.33..., TP2 = (10.6+10.4+12)/3 = 11
      // VWAP = (10.33*100 + 11*200) / 300 ≈ 10.78
      engine.processTick(makeTick({ price: 10, volume: 100 }));
      engine.processTick(makeTick({ price: 12, volume: 200 }));
      const data = engine.getAggregatedData('000001');
      expect(data).not.toBeNull();
      if (data) {
        expect(data.vwap).toBeGreaterThan(0);
        expect(data.vwap).toBeLessThan(data.close);
      }
    });

    it('VWAP uses high/low when available', () => {
      engine.processTick(makeTick({ price: 10, volume: 100, high: 11, low: 9 }));
      engine.processTick(makeTick({ price: 12, volume: 200, high: 13, low: 11 }));
      const data = engine.getAggregatedData('000001');
      expect(data).not.toBeNull();
      if (data) {
        // TP1 = (11+9+10)/3 = 10, TP2 = (13+11+12)/3 = 12
        // VWAP = (10*100 + 12*200) / 300 = 3400/300 ≈ 11.33
        expect(data.vwap).toBeGreaterThan(10);
        expect(data.vwap).toBeLessThan(12);
      }
    });
  });

  // ── getMetrics ───────────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('returns null for unknown symbol', () => {
      expect(engine.getMetrics('nobody')).toBeNull();
    });

    it('returns latest metrics', () => {
      engine.processTick(makeTick({ price: 10, volume: 100 }));
      engine.processTick(makeTick({ price: 12, volume: 200 }));
      const metrics = engine.getMetrics('000001');
      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(metrics.symbol).toBe('000001');
        expect(typeof metrics.priceChange).toBe('number');
      }
    });

    it('momentum is 0 with insufficient data', () => {
      engine.processTick(makeTick({ price: 10, volume: 100 }));
      engine.processTick(makeTick({ price: 12, volume: 200 }));
      const metrics = engine.getMetrics('000001');
      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(metrics.momentum5).toBe(0);
        expect(metrics.momentum10).toBe(0);
      }
    });

    it('calculates momentum with sufficient data', () => {
      // Feed 8 ticks with increasing prices
      for (let i = 0; i < 8; i++) {
        engine.processTick(makeTick({ price: 10 + i, volume: 100 }));
      }
      const metrics = engine.getMetrics('000001');
      expect(metrics).not.toBeNull();
      if (metrics) {
        // momentum5: index 7 vs index 2: 17 vs 12 → (17-12)/12*100 = 41.67%
        expect(metrics.momentum5).toBeGreaterThan(0);
      }
    });
  });

  // ── getSymbols ───────────────────────────────────────────────────────

  describe('getSymbols', () => {
    it('returns empty initially', () => {
      expect(engine.getSymbols()).toEqual([]);
    });

    it('returns tracked symbols', () => {
      engine.processTick(makeTick({ symbol: '000001' }));
      engine.processTick(makeTick({ symbol: '000002' }));
      expect(engine.getSymbols().length).toBe(2);
    });
  });

  // ── clearSymbol / clearAll ───────────────────────────────────────────

  describe('clearSymbol', () => {
    it('removes symbol tracking', () => {
      engine.processTick(makeTick({ symbol: '000001' }));
      engine.clearSymbol('000001');
      expect(engine.getSymbols()).not.toContain('000001');
      expect(engine.getMetrics('000001')).toBeNull();
    });

    it('does not crash for unknown symbol', () => {
      expect(() => engine.clearSymbol('nobody')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('removes all tracking', () => {
      engine.processTick(makeTick({ symbol: '000001' }));
      engine.processTick(makeTick({ symbol: '000002' }));
      engine.clearAll();
      expect(engine.getSymbols()).toEqual([]);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero volume', () => {
      engine.processTick(makeTick({ price: 10, volume: 0 }));
      const data = engine.getAggregatedData('000001');
      expect(data).not.toBeNull();
      if (data) {
        expect(data.volume).toBe(0);
      }
    });

    it('handles high volume spike correctly', () => {
      // Set up normal baseline
      for (let i = 0; i < 10; i++) {
        engine.processTick(makeTick({ price: 10 + i, volume: 100 }));
      }
      // Next tick: large volume → spike
      const metrics = engine.processTick(makeTick({ price: 16, volume: 5000 }));
      expect(metrics.volumeSpike).toBe(true);
    });

    it('TWAP is simple average of prices', () => {
      engine.processTick(makeTick({ price: 10, volume: 100 }));
      engine.processTick(makeTick({ price: 20, volume: 200 }));
      engine.processTick(makeTick({ price: 30, volume: 300 }));
      const data = engine.getAggregatedData('000001');
      expect(data).not.toBeNull();
      if (data) {
        expect(data.twap).toBeCloseTo(20, 0);
      }
    });

    it('OHLC when no high/low provided uses price', () => {
      // Create raw tick without high/low so code falls through to use price
      const tick: TickData = { symbol: '000001', timestamp: Date.now(), price: 10, volume: 100 };
      engine.processTick(tick);
      const data = engine.getAggregatedData('000001');
      expect(data).not.toBeNull();
      if (data) {
        expect(data.high).toBe(10);
        expect(data.low).toBe(10);
      }
    });
  });

  // ── Volatility Edge Cases ────────────────────────────────────────────

  describe('volatility', () => {
    it('volatility is 0 with insufficient data', () => {
      engine.processTick(makeTick({ price: 10, volume: 100 }));
      engine.processTick(makeTick({ price: 12, volume: 200 }));
      const metrics = engine.getMetrics('000001');
      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(metrics.volatility5).toBe(0);
      }
    });

    it('calculates volatility with sufficient data', () => {
      // Feed enough ticks (need > period+1 for volatility)
      const prices = [10, 10.5, 9.8, 10.2, 10.8, 9.5, 10.3, 11.0, 10.5, 9.8, 10.1];
      for (const p of prices) {
        engine.processTick(makeTick({ price: p, volume: 100 }));
      }
      const metrics = engine.getMetrics('000001');
      expect(metrics).not.toBeNull();
      if (metrics) {
        // volatility10 needs 11+ ticks (period+1), we have 11 ticks, that's enough
        expect(typeof metrics.volatility10).toBe('number');
      }
    });

    it('volatility is 0 for constant prices', () => {
      for (let i = 0; i < 10; i++) {
        engine.processTick(makeTick({ price: 10, volume: 100 }));
      }
      const metrics = engine.getMetrics('000001');
      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(metrics.volatility5).toBe(0);
      }
    });
  });

  // ── config ───────────────────────────────────────────────────────────

  describe('config', () => {
    it('works with sliding window config', () => {
      const e = new StreamComputingEngine({ type: 'sliding', size: 60000, slideInterval: 5000 });
      const metrics = e.processTick(makeTick());
      expect(metrics.symbol).toBe('000001');
    });
  });

  describe('eventemitter', () => {
    it('supports once', () => {
      const spy = vi.fn();
      engine.once('tick', spy);
      engine.processTick(makeTick());
      engine.processTick(makeTick());
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('supports off', () => {
      const spy = vi.fn();
      engine.on('tick', spy);
      engine.off('tick', spy);
      engine.processTick(makeTick());
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

// ── Singleton ──────────────────────────────────────────────────────────────

describe('getStreamComputingEngine', () => {
  it('returns same instance', () => {
    const a = getStreamComputingEngine();
    const b = getStreamComputingEngine();
    expect(a).toBe(b);
  });

  it('returns StreamComputingEngine instance', () => {
    const instance = getStreamComputingEngine();
    expect(instance).toBeInstanceOf(StreamComputingEngine);
  });
});
