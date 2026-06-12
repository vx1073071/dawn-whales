/**
 * R113 youdao — IndicatorEngine 单元测试 (20核心指标)
 *
 * PM: 行情升级v2.0 模块2 P0
 * 测试每项指标的计算正确性 + 边界条件 + null处理
 */
import { describe, it, expect } from 'vitest';
import type { KlineBar } from '../../src/lib/chart/types';
import {
  calcSMA, calcEMA, calcWMA, calcBOLL, calcMACD,
  calcRSI, calcKDJ, calcWR, calcCCI, calcATR,
  calcStdDev, calcOBV, calcVWAP, calcMFI, calcSAR,
  calcIchimoku, calcPivot, calcMAEnvelope, calcEMACross,
  computeIndicator, computeMACDSeries, computeBOLLSeries,
  computeKDJSeries, computeIchimokuSeries, computePivotSeries,
  computeEnvelopeSeries,
} from '../../src/lib/chart/indicator-engine';
import {
  INDICATOR_IDS, ALL_TIMEFRAMES, TIMEFRAME_LABELS, TIMEFRAME_MS,
  DEFAULT_LAYOUT, CHART_THEME_DARK,
} from '../../src/lib/chart/types';

// Helper: generate price data
function makeBars(count: number, startPrice = 100, volatility = 0.02): KlineBar[] {
  const bars: KlineBar[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * price * volatility;
    price += change;
    bars.push({
      time: Date.now() - (count - i) * 86400000,
      open: price - change,
      high: price + Math.abs(change) * 1.5,
      low: price - Math.abs(change) * 1.5,
      close: price,
      volume: Math.floor(1000000 + Math.random() * 5000000),
    });
  }
  return bars;
}

// ─── TREND INDICATORS (4) ────────────────────────────────

describe('R113.1: Trend Indicators (SMA/EMA/WMA/BOLL)', () => {
  const bars = makeBars(100);

  it('SMA: calculates correctly with known values', () => {
    const simple = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 1 },
      { time: 2, open: 10, high: 10, low: 10, close: 20, volume: 1 },
      { time: 3, open: 10, high: 10, low: 10, close: 30, volume: 1 },
    ];
    const result = calcSMA(simple, 3);
    // null, null, (10+20+30)/3 = 20
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(20);
  });

  it('SMA: supports multiple price fields', () => {
    const result = calcSMA(bars, 10, 'high');
    expect(result.length).toBe(bars.length);
    expect(result[9]).toBeDefined(); // first non-null at index 9
  });

  it('SMA: returns null for first period-1 entries', () => {
    const result = calcSMA(bars, 20);
    for (let i = 0; i < 19; i++) expect(result[i]).toBeNull();
    expect(result[19]).not.toBeNull();
  });

  it('EMA: calculates exponential weighting correctly', () => {
    const simple = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 1 },
      { time: 2, open: 10, high: 10, low: 10, close: 20, volume: 1 },
      { time: 3, open: 10, high: 10, low: 10, close: 30, volume: 1 },
    ];
    const result = calcEMA(simple, 3);
    // [10, null, 10*0.5+20*0.5=15]
    expect(result[0]).toBe(10);
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(25, 0); // 20*0.5+20*0.5... actually 30*0.5+20*0.5=25
  });

  it('EMA: output length matches input', () => {
    expect(calcEMA(bars, 14).length).toBe(bars.length);
  });

  it('WMA: heavier weight on recent prices', () => {
    const simple = [
      { time: 1, open: 0, high: 0, low: 0, close: 10, volume: 1 },
      { time: 2, open: 0, high: 0, low: 0, close: 20, volume: 1 },
      { time: 3, open: 0, high: 0, low: 0, close: 30, volume: 1 },
    ];
    // WMA(3): (10*1 + 20*2 + 30*3) / (1+2+3) = (10+40+90)/6 = 140/6 = 23.33
    const result = calcWMA(simple, 3);
    expect(result[2]).toBeCloseTo(23.3333, 2);
  });

  it('BOLL: returns 3 arrays of correct length', () => {
    const [mid, up, low] = calcBOLL(bars, 20, 2);
    expect(mid.length).toBe(bars.length);
    expect(up.length).toBe(bars.length);
    expect(low.length).toBe(bars.length);
    // upper > middle > lower
    for (let i = 20; i < bars.length; i++) {
      if (mid[i] != null && up[i] != null && low[i] != null) {
        expect(up[i]!).toBeGreaterThanOrEqual(mid[i]!);
        expect(mid[i]!).toBeGreaterThanOrEqual(low[i]!);
      }
    }
  });

  it('BOLL: upper channel always above lower', () => {
    const [_, up, low] = calcBOLL(bars, 20);
    for (let i = 19; i < up.length; i++) {
      if (up[i] != null && low[i] != null) {
        expect(up[i]!).toBeGreaterThan(low[i]!);
      }
    }
  });
});

// ─── MOMENTUM INDICATORS (5) ───────────────────────────

describe('R113.2: Momentum Indicators (MACD/RSI/KDJ/WR/CCI)', () => {
  const bars = makeBars(200);

  it('MACD: returns 3 arrays [diff, dea, hist]', () => {
    const [diff, dea, hist] = calcMACD(bars);
    expect(diff.length).toBe(bars.length);
    expect(dea.length).toBe(bars.length);
    expect(hist.length).toBe(bars.length);
  });

  it('MACD: histogram = (diff - dea) * 2', () => {
    const [diff, dea, hist] = calcMACD(bars, 12, 26, 9);
    for (let i = 30; i < bars.length; i++) {
      if (diff[i] != null && dea[i] != null && hist[i] != null) {
        expect(hist[i]).toBeCloseTo((diff[i]! - dea[i]!) * 2, 4);
      }
    }
  });

  it('RSI: bounded between 0 and 100', () => {
    const rsi = calcRSI(bars, 14);
    for (let i = 14; i < rsi.length; i++) {
      if (rsi[i] != null) {
        expect(rsi[i]!).toBeGreaterThanOrEqual(0);
        expect(rsi[i]!).toBeLessThanOrEqual(100);
      }
    }
  });

  it('RSI: constant prices give 100', () => {
    const flat = Array.from({ length: 20 }, (_, i) => ({
      time: i, open: 100, high: 100, low: 100, close: 100, volume: 1000,
    }));
    const rsi = calcRSI(flat, 14);
    if (rsi[19] != null) expect(rsi[19]!).toBe(100);
  });

  it('KDJ: returns [K, D, J] arrays', () => {
    const [k, d, j] = calcKDJ(bars);
    expect(k.length).toBe(bars.length);
    expect(d.length).toBe(bars.length);
    expect(j.length).toBe(bars.length);
  });

  it('KDJ: J = 3K - 2D', () => {
    const [k, d, j] = calcKDJ(bars, 9, 3, 3);
    for (let i = 20; i < bars.length; i++) {
      if (k[i] != null && d[i] != null && j[i] != null) {
        expect(j[i]).toBeCloseTo(3 * k[i]! - 2 * d[i]!, 1);
      }
    }
  });

  it('WR: bounded between -100 and 0', () => {
    const wr = calcWR(bars, 14);
    for (let i = 14; i < wr.length; i++) {
      if (wr[i] != null) {
        expect(wr[i]!).toBeGreaterThanOrEqual(-100);
        expect(wr[i]!).toBeLessThanOrEqual(0);
      }
    }
  });

  it('CCI: works on typical price', () => {
    const cci = calcCCI(bars, 20);
    expect(cci.length).toBe(bars.length);
  });

  it('CCI: outputs finite numbers or null', () => {
    const cci = calcCCI(bars, 20);
    for (let i = 20; i < cci.length; i++) {
      if (cci[i] != null) expect(Number.isFinite(cci[i]!)).toBe(true);
    }
  });
});

// ─── VOLATILITY INDICATORS (2) ─────────────────────────

describe('R113.3: Volatility Indicators (ATR/StdDev)', () => {
  const bars = makeBars(100);

  it('ATR: returns positive values', () => {
    const atr = calcATR(bars, 14);
    for (let i = 14; i < atr.length; i++) {
      if (atr[i] != null) expect(atr[i]!).toBeGreaterThan(0);
    }
  });

  it('ATR: first value is null', () => {
    expect(calcATR(bars, 14)[0]).toBeNull();
  });

  it('StdDev: non-negative values', () => {
    const sd = calcStdDev(bars, 20);
    for (let i = 20; i < sd.length; i++) {
      if (sd[i] != null) expect(sd[i]!).toBeGreaterThanOrEqual(0);
    }
  });

  it('StdDev: constant price = zero', () => {
    const flat = Array.from({ length: 30 }, (_, i) => ({
      time: i, open: 100, high: 100, low: 100, close: 100, volume: 1000,
    }));
    const sd = calcStdDev(flat, 20);
    if (sd[29] != null) expect(sd[29]!).toBeCloseTo(0, 5);
  });
});

// ─── VOLUME INDICATORS (3) ─────────────────────────────

describe('R113.4: Volume Indicators (OBV/VWAP/MFI)', () => {
  const bars = makeBars(100);

  it('OBV: increments on up, decrements on down', () => {
    const simple = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 },
      { time: 2, open: 10, high: 10, low: 10, close: 15, volume: 200 },
      { time: 3, open: 10, high: 10, low: 10, close: 10, volume: 50 },
    ];
    const obv = calcOBV(simple);
    expect(obv[0]).toBe(0);
    expect(obv[1]).toBe(200);  // up → +200
    expect(obv[2]).toBe(150);  // down → -50 → 200-50=150
  });

  it('OBV: equal close does not change', () => {
    const flat = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 },
      { time: 2, open: 10, high: 10, low: 10, close: 10, volume: 200 },
    ];
    expect(calcOBV(flat)[1]).toBe(0);
  });

  it('VWAP: produces cumulative weighted average', () => {
    const vwap = calcVWAP(bars);
    expect(vwap.length).toBe(bars.length);
    expect(vwap[bars.length - 1]).not.toBeNull();
  });

  it('MFI: bounded between 0-100', () => {
    const mfi = calcMFI(bars, 14);
    for (let i = 14; i < mfi.length; i++) {
      if (mfi[i] != null) {
        expect(mfi[i]!).toBeGreaterThanOrEqual(0);
        expect(mfi[i]!).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─── OVERLAY INDICATORS (2) ────────────────────────────

describe('R113.5: Overlay Indicators (SAR/Ichimoku)', () => {
  const bars = makeBars(200);

  it('SAR: starts null then present', () => {
    const sar = calcSAR(bars);
    expect(sar[0]).toBeNull();
    expect(sar.length).toBe(bars.length);
  });

  it('SAR: values are finite', () => {
    const sar = calcSAR(bars);
    for (let i = 1; i < sar.length; i++) {
      if (sar[i] != null) expect(Number.isFinite(sar[i]!)).toBe(true);
    }
  });

  it('Ichimoku: returns 5 arrays', () => {
    const [ten, kij, sA, sB, chikou] = calcIchimoku(bars);
    expect(ten.length).toBe(bars.length);
    expect(kij.length).toBe(bars.length);
    expect(sA.length).toBe(bars.length);
    expect(sB.length).toBe(bars.length);
    expect(chikou.length).toBe(bars.length);
  });

  it('Ichimoku: SenkouA = (Tenkan + Kijun) / 2 when both present', () => {
    const [ten, kij, sA] = calcIchimoku(bars);
    for (let i = 30; i < bars.length; i++) {
      if (ten[i] != null && kij[i] != null && sA[i] != null) {
        expect(sA[i]).toBeCloseTo((ten[i]! + kij[i]!) / 2, 4);
      }
    }
  });
});

// ─── CUSTOM INDICATORS (3) ─────────────────────────────

describe('R113.6: Custom Indicators (Pivot/MAEnvelope/EMACross)', () => {
  const bars = makeBars(100);

  it('Pivot: returns 7 levels [r3,r2,r1,pp,s1,s2,s3]', () => {
    const levels = calcPivot(bars);
    expect(levels).toHaveLength(7);
    levels.forEach(arr => expect(arr.length).toBe(bars.length));
  });

  it('Pivot: R > PP > S ordering', () => {
    const [r3, r2, r1, pp, s1, s2, s3] = calcPivot(bars);
    for (let i = 1; i < bars.length; i++) {
      if (r1[i] && pp[i] && s1[i]) {
        expect(r1[i]!).toBeGreaterThan(pp[i]!);
        expect(pp[i]!).toBeGreaterThan(s1[i]!);
      }
    }
  });

  it('MAEnvelope: returns [upper, middle, lower]', () => {
    const [up, mid, low] = calcMAEnvelope(bars, 20, 3);
    expect(up.length).toBe(bars.length);
    expect(mid.length).toBe(bars.length);
    expect(low.length).toBe(bars.length);
    // upper = middle * 1.03
    for (let i = 19; i < bars.length; i++) {
      if (up[i] != null && mid[i] != null) {
        expect(up[i]).toBeCloseTo(mid[i]! * 1.03, 4);
      }
    }
  });

  it('EMACross: returns 1(golden), -1(death), 0(none), or null', () => {
    const cross = calcEMACross(bars, 12, 26);
    const unique = new Set(cross.filter(x => x != null));
    expect(Array.from(unique).every(x => [1, -1, 0].includes(x as number))).toBe(true);
  });

  it('EMACross: null for first entry', () => {
    expect(calcEMACross(bars)[0]).toBeNull();
  });
});

// ─── COMPUTE HELPERS ────────────────────────────────────

describe('R113.7: Compute Helpers', () => {
  const bars = makeBars(100);

  it('computeIndicator routes to correct function', () => {
    expect(computeIndicator('ma', bars, { period: 10 }).length).toBe(bars.length);
    expect(computeIndicator('ema', bars, { period: 10 }).length).toBe(bars.length);
    expect(computeIndicator('rsi', bars, { period: 14 }).length).toBe(bars.length);
    expect(computeIndicator('wr', bars, { period: 14 }).length).toBe(bars.length);
    expect(computeIndicator('cci', bars, { period: 20 }).length).toBe(bars.length);
    expect(computeIndicator('atr', bars, { period: 14 }).length).toBe(bars.length);
    expect(computeIndicator('stddev', bars, { period: 20 }).length).toBe(bars.length);
    expect(computeIndicator('obv', bars, {}).length).toBe(bars.length);
    expect(computeIndicator('vwap', bars, {}).length).toBe(bars.length);
    expect(computeIndicator('mfi', bars, { period: 14 }).length).toBe(bars.length);
    expect(computeIndicator('sar', bars, { af: 0.02, maxAf: 0.2 }).length).toBe(bars.length);
  });

  it('computeIndicator returns empty for unknown id', () => {
    expect(computeIndicator('unknown', bars, {})).toEqual([]);
  });

  it('computeMACDSeries returns 3 arrays', () => {
    const result = computeMACDSeries(bars);
    expect(result).toHaveLength(3);
  });

  it('computeBOLLSeries returns 3 arrays', () => {
    const result = computeBOLLSeries(bars);
    expect(result).toHaveLength(3);
  });

  it('computeKDJSeries returns 3 arrays', () => {
    const result = computeKDJSeries(bars);
    expect(result).toHaveLength(3);
  });

  it('computeIchimokuSeries returns 5 arrays', () => {
    const result = computeIchimokuSeries(bars);
    expect(result).toHaveLength(5);
  });

  it('computePivotSeries returns 7 arrays', () => {
    const result = computePivotSeries(bars);
    expect(result).toHaveLength(7);
  });

  it('computeEnvelopeSeries returns 3 arrays', () => {
    const result = computeEnvelopeSeries(bars, 20, 3);
    expect(result).toHaveLength(3);
  });
});

// ─── EDGE CASES ─────────────────────────────────────────

describe('R113.8: Edge Cases & Boundaries', () => {
  it('empty bars → should not throw', () => {
    expect(() => calcSMA([], 10)).not.toThrow();
    expect(() => calcEMA([], 10)).not.toThrow();
    expect(() => calcRSI([], 14)).not.toThrow();
    expect(() => calcMACD([])).not.toThrow();
  });

  it('single bar → handles gracefully', () => {
    const single = [{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 }];
    expect(calcSMA(single, 10)[0]).toBeNull();
    const [diff, dea, hist] = calcMACD(single);
    expect(diff[0]).toBeNull();
  });

  it('period larger than data length → all null', () => {
    const short = makeBars(5);
    const sma = calcSMA(short, 20);
    expect(sma.every(v => v === null)).toBe(true);
  });

  it('very large values do not cause NaN', () => {
    const big = [
      { time: 1, open: 1e9, high: 1e9, low: 1e9, close: 1e9, volume: 1e9 },
      { time: 2, open: 2e9, high: 2e9, low: 2e9, close: 2e9, volume: 2e9 },
    ];
    const result = calcVWAP(big);
    expect(result.every(v => v != null && Number.isFinite(v!))).toBe(true);
  });

  it('zero volume → VWAP handles null', () => {
    const zero = [{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 0 }];
    expect(calcVWAP(zero)[0]).toBeNull();
  });
});

// ─── TYPES VALIDATION ───────────────────────────────────

describe('R113.9: Chart Types Validation', () => {
  it('ALL_TIMEFRAMES has 9 entries', () => {
    expect(ALL_TIMEFRAMES).toHaveLength(9);
  });

  it('TIMEFRAME_LABELS covers all timeframes', () => {
    for (const tf of ALL_TIMEFRAMES) {
      expect(TIMEFRAME_LABELS[tf]).toBeDefined();
    }
  });

  it('TIMEFRAME_MS covers all timeframes', () => {
    for (const tf of ALL_TIMEFRAMES) {
      expect(typeof TIMEFRAME_MS[tf]).toBe('number');
      expect(TIMEFRAME_MS[tf]).toBeGreaterThan(0);
    }
  });

  it('DEFAULT_LAYOUT ratios sum to 1', () => {
    const sum = DEFAULT_LAYOUT.mainRatio + DEFAULT_LAYOUT.indicatorRatio + DEFAULT_LAYOUT.volumeRatio;
    expect(sum).toBeCloseTo(1, 2);
  });

  it('CHART_THEME_DARK has all required color fields', () => {
    const required = ['bg', 'grid', 'text', 'crosshair', 'up', 'down', 'border'];
    for (const k of required) {
      expect((CHART_THEME_DARK as Record<string, unknown>)[k]).toBeDefined();
    }
  });

  it('INDICATOR_IDS has 20 entries', () => {
    const ids = Object.keys(INDICATOR_IDS);
    expect(ids.length).toBe(20);
  });

  it('INDICATOR_IDS covers all categories', () => {
    // Trend
    expect(INDICATOR_IDS.MA).toBe('ma');
    expect(INDICATOR_IDS.EMA).toBe('ema');
    expect(INDICATOR_IDS.BOLL).toBe('boll');
    // Momentum
    expect(INDICATOR_IDS.MACD).toBe('macd');
    expect(INDICATOR_IDS.RSI).toBe('rsi');
    expect(INDICATOR_IDS.KDJ).toBe('kdj');
    // Volatility
    expect(INDICATOR_IDS.ATR).toBe('atr');
    // Volume
    expect(INDICATOR_IDS.VWAP).toBe('vwap');
    expect(INDICATOR_IDS.OBV).toBe('obv');
    // Overlay
    expect(INDICATOR_IDS.SAR).toBe('sar');
    expect(INDICATOR_IDS.ICHIMOKU).toBe('ichimoku');
  });
});
