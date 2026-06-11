/**
 * Tests for RealtimeIndicatorCalculator — technical indicators.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RealtimeIndicatorCalculator,
  getRealtimeIndicatorCalculator,
  type KLine,
} from '../../../../electron/engine/data/realtime-indicators';

// Suppress noisy logs
vi.spyOn(console, 'log').mockImplementation(() => {});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeKLine(overrides: Partial<KLine> = {}): KLine {
  return {
    timestamp: Date.now(),
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    ...overrides,
  };
}

/** Generate n klines with trending close prices (start + i*step). */
function generateKLines(n: number, start = 100, step = 1): KLine[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: 1000000 + i * 60000,
    open: start + i * step,
    high: start + i * step + 5,
    low: start + i * step - 5,
    close: start + i * step + 2,
    volume: 1000 + i * 10,
  }));
}

// ── Construction & Singleton ─────────────────────────────────────────────────

describe('RealtimeIndicatorCalculator — construction', () => {
  it('creates instance', () => {
    const calc = new RealtimeIndicatorCalculator();
    expect(calc).toBeInstanceOf(RealtimeIndicatorCalculator);
  });

  it('getRealtimeIndicatorCalculator returns singleton', () => {
    const a = getRealtimeIndicatorCalculator();
    const b = getRealtimeIndicatorCalculator();
    expect(a).toBe(b);
  });
});

// ── addKLine ─────────────────────────────────────────────────────────────────

describe('RealtimeIndicatorCalculator — addKLine', () => {
  let calc: RealtimeIndicatorCalculator;

  beforeEach(() => {
    calc = new RealtimeIndicatorCalculator();
  });

  it('adds kline to buffer and returns indicators', () => {
    const result = calc.addKLine('AAPL', makeKLine());
    expect(result.symbol).toBe('AAPL');
    expect(result).toHaveProperty('ma');
    expect(result).toHaveProperty('ema');
    expect(result).toHaveProperty('macd');
    expect(result).toHaveProperty('rsi');
    expect(result).toHaveProperty('kdj');
    expect(result).toHaveProperty('bollinger');
    expect(result).toHaveProperty('atr');
  });

  it('emits indicators-updated event', () => {
    const handler = vi.fn();
    calc.on('indicators-updated', handler);
    calc.addKLine('AAPL', makeKLine());
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('AAPL', expect.any(Object));
  });

  it('buffer grows with each addKLine', () => {
    calc.addKLine('AAPL', makeKLine({ timestamp: 1 }));
    calc.addKLine('AAPL', makeKLine({ timestamp: 2 }));
    calc.addKLine('AAPL', makeKLine({ timestamp: 3 }));
    expect(calc.getKLineBuffer('AAPL').length).toBe(3);
  });

  it('buffer truncates at maxBufferSize (500)', () => {
    for (let i = 0; i < 510; i++) {
      calc.addKLine('AAPL', makeKLine({ timestamp: i }));
    }
    expect(calc.getKLineBuffer('AAPL').length).toBe(500);
  });

  it('returns null for MA when insufficient data', () => {
    const result = calc.addKLine('AAPL', makeKLine());
    expect(result.ma.ma5).toBeNull();
    expect(result.ma.ma20).toBeNull();
  });

  it('calculates MA5 when 5 klines available', () => {
    const klines = generateKLines(5);
    klines.forEach(k => calc.addKLine('AAPL', k));
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 999999, close: 110 }));
    expect(result.ma.ma5).not.toBeNull();
  });
});

// ── addKLines (batch) ────────────────────────────────────────────────────────

describe('RealtimeIndicatorCalculator — addKLines', () => {
  let calc: RealtimeIndicatorCalculator;

  beforeEach(() => {
    calc = new RealtimeIndicatorCalculator();
  });

  it('adds multiple klines at once', () => {
    const klines = generateKLines(30);
    const result = calc.addKLines('AAPL', klines);
    expect(calc.getKLineBuffer('AAPL').length).toBe(30);
    expect(result.symbol).toBe('AAPL');
  });

  it('emits indicators-updated once', () => {
    const handler = vi.fn();
    calc.on('indicators-updated', handler);
    calc.addKLines('AAPL', generateKLines(10));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('truncates buffer at 500', () => {
    calc.addKLines('AAPL', generateKLines(300));
    calc.addKLines('AAPL', generateKLines(300));
    expect(calc.getKLineBuffer('AAPL').length).toBeLessThanOrEqual(500);
  });
});

// ── Individual Indicator Calculations ────────────────────────────────────────

describe('Indicator calculations with sufficient data', () => {
  let calc: RealtimeIndicatorCalculator;

  beforeEach(() => {
    calc = new RealtimeIndicatorCalculator();
    // Feed 30 klines to have enough for most indicators
    calc.addKLines('AAPL', generateKLines(30));
  });

  it('MA: ma5 and ma10 populated, ma60 null', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.ma.ma5).not.toBeNull();
    expect(result.ma.ma10).not.toBeNull();
    expect(result.ma.ma60).toBeNull(); // only 31 points
  });

  it('EMA: ema12 and ema26 populated', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.ema.ema12).not.toBeNull();
    expect(result.ema.ema26).not.toBeNull();
  });

  it('MACD: dif populated, dea/macd may be null with insufficient DIF history', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.macd.dif).not.toBeNull();
    // DEA = EMA9 of DIF history; DIF history starts at index 25, need 25+9-1=33 points minimum
    // With 31 points, difHistory has ~6 entries → not enough for EMA9 → dea and macd are null
    // Just verify the structure exists with correct field types
    expect(result.macd).toHaveProperty('dif');
    expect(result.macd).toHaveProperty('dea');
    expect(result.macd).toHaveProperty('macd');
  });

  it('RSI: rsi6 populated', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.rsi.rsi6).not.toBeNull();
    expect(result.rsi.rsi6!).toBeGreaterThanOrEqual(0);
    expect(result.rsi.rsi6!).toBeLessThanOrEqual(100);
  });

  it('KDJ: k, d, j populated', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.kdj.k).not.toBeNull();
    expect(result.kdj.d).not.toBeNull();
    expect(result.kdj.j).not.toBeNull();
  });

  it('Bollinger Bands: upper/middle/lower/width populated', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.bollinger.upper).not.toBeNull();
    expect(result.bollinger.middle).not.toBeNull();
    expect(result.bollinger.lower).not.toBeNull();
    expect(result.bollinger.width).not.toBeNull();
    // upper >= lower
    expect(result.bollinger.upper!).toBeGreaterThanOrEqual(result.bollinger.lower!);
    // width = upper - lower
    expect(result.bollinger.width!).toBeCloseTo(result.bollinger.upper! - result.bollinger.lower!, 5);
  });

  it('ATR: populated with enough data', () => {
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999 }));
    expect(result.atr.atr).not.toBeNull();
    expect(result.atr.atr!).toBeGreaterThan(0);
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe('Indicator edge cases', () => {
  let calc: RealtimeIndicatorCalculator;

  beforeEach(() => {
    calc = new RealtimeIndicatorCalculator();
  });

  it('RSI = 100 for monotonically increasing prices', () => {
    const klines = generateKLines(20, 100, 5); // each close = start + i*step + 2
    calc.addKLines('AAPL', klines);
    const result = calc.addKLine('AAPL', makeKLine({ timestamp: 9999999, close: 200 }));
    expect(result.rsi.rsi6).toBe(100);
  });

  it('getKLineBuffer returns empty for unknown symbol', () => {
    expect(calc.getKLineBuffer('UNKNOWN')).toEqual([]);
  });

  it('clearBuffer removes specific symbol', () => {
    calc.addKLines('AAPL', generateKLines(5));
    calc.addKLines('GOOG', generateKLines(3));
    calc.clearBuffer('AAPL');
    expect(calc.getKLineBuffer('AAPL')).toEqual([]);
    expect(calc.getKLineBuffer('GOOG').length).toBe(3);
  });

  it('clearAllBuffers removes everything', () => {
    calc.addKLines('AAPL', generateKLines(5));
    calc.addKLines('GOOG', generateKLines(3));
    calc.clearAllBuffers();
    expect(calc.getKLineBuffer('AAPL')).toEqual([]);
    expect(calc.getKLineBuffer('GOOG')).toEqual([]);
  });
});

// ── Helper Function Correctness ──────────────────────────────────────────────

describe('Indicator math correctness', () => {
  let calc: RealtimeIndicatorCalculator;

  beforeEach(() => {
    calc = new RealtimeIndicatorCalculator();
  });

  it('MA5 = average of last 5 closes', () => {
    const klines: KLine[] = [
      { timestamp: 1, open: 10, high: 12, low: 8, close: 10, volume: 100 },
      { timestamp: 2, open: 10, high: 12, low: 8, close: 20, volume: 100 },
      { timestamp: 3, open: 10, high: 12, low: 8, close: 30, volume: 100 },
      { timestamp: 4, open: 10, high: 12, low: 8, close: 40, volume: 100 },
      { timestamp: 5, open: 10, high: 12, low: 8, close: 50, volume: 100 },
    ];
    calc.addKLines('X', klines);
    const result = calc.addKLine('X', makeKLine({ timestamp: 6, close: 60 }));
    // last 5 closes: [20, 30, 40, 50, 60] → avg = 40
    expect(result.ma.ma5).toBe(40);
  });

  it('Bollinger width is 0 for constant prices', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      makeKLine({ timestamp: i, close: 100, open: 100, high: 100, low: 100 })
    );
    calc.addKLines('X', klines);
    const result = calc.addKLine('X', makeKLine({ timestamp: 99, close: 100 }));
    expect(result.bollinger.width).toBe(0);
    expect(result.bollinger.upper).toBe(100);
    expect(result.bollinger.lower).toBe(100);
  });

  it('ATR is positive for typical klines', () => {
    // 16 klines with high-low=10, close in middle → trueRange varies due to prevClose gaps
    const klines = Array.from({ length: 16 }, (_, i) => ({
      timestamp: i,
      open: 100,
      high: 110,
      low: 100,
      close: 105,
      volume: 100,
    }));
    calc.addKLines('X', klines);
    const result = calc.addKLine('X', makeKLine({ timestamp: 99, close: 105 }));
    expect(result.atr.atr).not.toBeNull();
    expect(result.atr.atr!).toBeGreaterThan(0);
  });
});
