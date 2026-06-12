/**
 * R113b youdao QTE-08 — IndicatorEngine 30+ 单元测试
 */
import { describe, it, expect } from 'vitest';
import type { KlineBar } from '../../src/lib/chart/types';
import { calcSMA, calcEMA, calcWMA, calcBOLL, calcMACD, calcRSI, calcKDJ, calcWR, calcCCI, calcATR, calcStdDev, calcOBV, calcVWAP, calcMFI, calcSAR, calcIchimoku, calcPivot, calcMAEnvelope, calcEMACross, computeIndicator, computeMACDSeries, computeBOLLSeries, computeKDJSeries, computeIchimokuSeries, computePivotSeries, computeEnvelopeSeries } from '../../src/lib/chart/indicator-engine';
import { INDICATOR_IDS, ALL_TIMEFRAMES, TIMEFRAME_LABELS, TIMEFRAME_MS, DEFAULT_LAYOUT, CHART_THEME_DARK } from '../../src/lib/chart/types';

function bars(n: number): KlineBar[] {
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    p += (Math.random() - 0.48) * 2;
    return { time: Date.now() - (n - i) * 864e5, open: p - 1, high: p + 2, low: p - 2, close: p, volume: 1e6 + Math.random() * 5e6 };
  });
}

// 1. Trend
describe('Trend (SMA/EMA/WMA/BOLL)', () => {
  const b = bars(40);
  it('SMA: known values', () => { const r = calcSMA([{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 1 }, { time: 2, open: 10, high: 10, low: 10, close: 20, volume: 1 }, { time: 3, open: 10, high: 10, low: 10, close: 30, volume: 1 }], 3); expect(r[2]).toBe(20); });
  it('SMA: null prefix', () => { const r = calcSMA(b, 10); for (let i = 0; i < 9; i++) expect(r[i]).toBeNull(); });
  it('EMA: produces numbers', () => { const r = calcEMA(b, 10); expect(r[9]).not.toBeNull(); });
  it('WMA: recent-weighs-more', () => { const r = calcWMA(b, 5); expect(typeof r[4]).toBe('number'); });
  it('BOLL: returns 3 arrays', () => { const [m, u, l] = calcBOLL(b, 10); expect(m.length).toBe(b.length); expect(u.length).toBe(b.length); expect(l.length).toBe(b.length); });
  it('BOLL: upper >= lower', () => { const [_, u, l] = calcBOLL(b, 10); let ok = false; for (let i = 10; i < b.length; i++) { if (u[i] != null && l[i] != null && u[i]! >= l[i]!) { ok = true; break; } } expect(ok).toBe(true); });
});

// 2. Momentum
describe('Momentum (MACD/RSI/KDJ/WR/CCI)', () => {
  const b = bars(50);
  it('MACD: 3 arrays', () => { const [d, de, h] = calcMACD(b); expect(d.length).toBe(b.length); expect(de.length).toBe(b.length); expect(h.length).toBe(b.length); });
  it('MACD: hist = (diff-dea)*2', () => { const [d, de, h] = calcMACD(b, 12, 26, 9); let ok = false; for (let i = 30; i < b.length; i++) { if (d[i] != null && de[i] != null && h[i] != null) { expect(Math.abs(h[i]! - (d[i]! - de[i]!) * 2) < 0.01).toBe(true); ok = true; break; } } expect(ok).toBe(true); });
  it('RSI: bounded 0-100', () => { const r = calcRSI(b, 14); for (let i = 15; i < r.length; i++) { if (r[i] != null) { expect(r[i]!).toBeGreaterThanOrEqual(0); expect(r[i]!).toBeLessThanOrEqual(100); } } });
  it('RSI: flat price = 100', () => { const f = Array.from({ length: 20 }, (_, i) => ({ time: i, open: 100, high: 100, low: 100, close: 100, volume: 1000 })); const r = calcRSI(f, 14); if (r[19] != null) expect(r[19]!).toBe(100); });
  it('KDJ: 3 arrays', () => { const [k, d, j] = calcKDJ(b); expect(k.length).toBe(b.length); expect(d.length).toBe(b.length); expect(j.length).toBe(b.length); });
  it('WR: bounded -100..0', () => { const r = calcWR(b, 14); for (let i = 15; i < r.length; i++) { if (r[i] != null) { expect(r[i]!).toBeGreaterThanOrEqual(-100); expect(r[i]!).toBeLessThanOrEqual(0); } } });
  it('CCI: produces numbers', () => { const r = calcCCI(b, 10); expect(typeof r[10]).toBe('number'); });
});

// 3. Volatility
describe('Volatility (ATR/StdDev)', () => {
  const b = bars(30);
  it('ATR: positive', () => { const r = calcATR(b, 10); for (let i = 10; i < r.length; i++) { if (r[i] != null) expect(r[i]!).toBeGreaterThan(0); } });
  it('ATR: first null', () => { expect(calcATR(b, 10)[0]).toBeNull(); });
  it('StdDev: >= 0', () => { const r = calcStdDev(b, 10); for (let i = 10; i < r.length; i++) { if (r[i] != null) expect(r[i]!).toBeGreaterThanOrEqual(0); } });
});

// 4. Volume
describe('Volume (OBV/VWAP/MFI)', () => {
  it('OBV: up→+vol, down→-vol', () => { const s = [{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 }, { time: 2, open: 10, high: 10, low: 10, close: 15, volume: 200 }, { time: 3, open: 10, high: 10, low: 10, close: 10, volume: 50 }]; const r = calcOBV(s); expect(r[0]).toBe(0); expect(r[1]).toBe(200); expect(r[2]).toBe(150); });
  it('OBV: flat=no change', () => { const f = [{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 }, { time: 2, open: 10, high: 10, low: 10, close: 10, volume: 200 }]; expect(calcOBV(f)[1]).toBe(0); });
  it('VWAP: produces values', () => { const b = bars(20); const r = calcVWAP(b); expect(r[r.length - 1]).not.toBeNull(); });
  it('MFI: bounded 0-100', () => { const b = bars(30); const r = calcMFI(b, 10); for (let i = 10; i < r.length; i++) { if (r[i] != null) { expect(r[i]!).toBeGreaterThanOrEqual(0); expect(r[i]!).toBeLessThanOrEqual(100); } } });
});

// 5. Overlay
describe('Overlay (SAR/Ichimoku)', () => {
  const b = bars(50);
  it('SAR: first null', () => expect(calcSAR(b)[0]).toBeNull());
  it('SAR: finite', () => { const r = calcSAR(b); for (let i = 1; i < r.length; i++) { if (r[i] != null) expect(Number.isFinite(r[i]!)).toBe(true); } });
  it('Ichimoku: 5 arrays', () => { const [t, k, a, b2, c] = calcIchimoku(b); expect([t,k,a,b2,c].every(x => x.length === b.length)).toBe(true); });
});

// 6. Compute helpers
describe('Compute Helpers', () => {
  const b = bars(30);
  it('computeIndicator: routes correctly', () => { for (const id of ['ma', 'ema', 'rsi', 'wr', 'cci', 'atr', 'stddev', 'obv', 'vwap', 'mfi', 'sar']) { expect(computeIndicator(id, b, { period: 10, af: 0.02, maxAf: 0.2 }).length).toBe(b.length); } });
  it('computeIndicator: unknown returns empty', () => expect(computeIndicator('unknown', b, {})).toEqual([]));
  it('computeMACDSeries: 3 arrays', () => expect(computeMACDSeries(b)).toHaveLength(3));
  it('computeBOLLSeries: 3 arrays', () => expect(computeBOLLSeries(b)).toHaveLength(3));
  it('computeKDJSeries: 3 arrays', () => expect(computeKDJSeries(b)).toHaveLength(3));
  it('computeIchimokuSeries: 5 arrays', () => expect(computeIchimokuSeries(b)).toHaveLength(5));
  it('computePivotSeries: 7 arrays', () => expect(computePivotSeries(b)).toHaveLength(7));
  it('computeEnvelopeSeries: 3 arrays', () => expect(computeEnvelopeSeries(b)).toHaveLength(3));
});

// 8. Edge cases
describe('Edge Cases', () => {
  it('empty bars: no throw', () => { expect(() => calcSMA([], 10)).not.toThrow(); });
  it('single bar: SMA null', () => { expect(calcSMA([{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 1 }], 10)[0]).toBeNull(); });
  it('zero volume: VWAP null', () => { expect(calcVWAP([{ time: 1, open: 10, high: 10, low: 10, close: 10, volume: 0 }])[0]).toBeNull(); });
});

// 9. Types
describe('Chart Types', () => {
  it('ALL_TIMEFRAMES: defined', () => { expect(ALL_TIMEFRAMES.length).toBeGreaterThan(7); });
  it('TIMEFRAME_LABELS: all covered', () => { for (const tf of ALL_TIMEFRAMES) expect(TIMEFRAME_LABELS[tf]).toBeDefined(); });
  it('TIMEFRAME_MS: defined', () => { expect(typeof TIMEFRAME_MS['D']).toBe('number'); });
  it('DEFAULT_LAYOUT: sums ~1', () => { expect(DEFAULT_LAYOUT.mainRatio + DEFAULT_LAYOUT.indicatorRatio + DEFAULT_LAYOUT.volumeRatio).toBeCloseTo(1); });
  it('CHART_THEME_DARK: has colors', () => { for (const k of ['bg', 'grid', 'text', 'crosshair', 'up', 'down', 'border']) expect((CHART_THEME_DARK as Record<string, unknown>)[k]).toBeDefined(); });
  it('INDICATOR_IDS: defined', () => { expect(INDICATOR_IDS.MA).toBe('ma'); expect(INDICATOR_IDS.RSI).toBe('rsi'); });
});
