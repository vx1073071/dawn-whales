import { describe, it, expect } from 'vitest';
import {
  calcSMA, calcEMA, calcWMA, calcBOLL, calcMACD, calcRSI, calcKDJ,
  calcWR, calcCCI, calcATR, calcStdDev, calcOBV, calcVWAP, calcMFI,
  calcSAR, calcIchimoku, calcPivot, calcMAEnvelope, calcEMACross,
  computeIndicator, computeMACDSeries, computeBOLLSeries,
  computeKDJSeries, computeIchimokuSeries, computePivotSeries,
} from '../../../src/lib/chart/indicator-engine';
import type { KlineBar } from '../../../src/lib/chart/types';

function makeBars(n: number, startPrice = 100): KlineBar[] {
  const bars: KlineBar[] = [];
  let price = startPrice;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const change = (Math.random() - 0.5) * 2;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 1;
    const low = Math.min(open, close) - Math.random() * 1;
    bars.push({ time: now + i * 3600000, open, high, low, close, volume: Math.floor(Math.random() * 10000 + 1000) });
    price = close;
  }
  return bars;
}

function trendBars(n: number): KlineBar[] {
  const bars: KlineBar[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const price = 100 + i * 0.5;
    bars.push({ time: now + i * 3600000, open: price - 0.2, high: price + 0.5, low: price - 0.5, close: price, volume: 5000 });
  }
  return bars;
}

describe('Indicator Engine Core R113', () => {
  describe('Trend indicators', () => {
    it('calcSMA', () => {
      const bars = makeBars(100);
      const r = calcSMA(bars, 20);
      expect(r).toHaveLength(100);
      expect(r.slice(0, 19).every(v => v === null)).toBe(true);
      expect(r[19]).not.toBeNull();
      expect(r[99]).not.toBeNull();
    });
    it('calcEMA', () => {
      const bars = trendBars(50);
      const r = calcEMA(bars, 12);
      expect(r).toHaveLength(50);
      expect(r[49]).toBeGreaterThan(r[0]!);
    });
    it('calcWMA', () => {
      const bars = makeBars(60);
      const r = calcWMA(bars, 10);
      expect(r).toHaveLength(60);
      expect(r[9]).not.toBeNull();
    });
    it('calcBOLL', () => {
      const bars = makeBars(100);
      const [m, u, l] = calcBOLL(bars, 20, 2);
      expect(u[19]!).toBeGreaterThan(m[19]!);
      expect(l[19]!).toBeLessThan(m[19]!);
    });
  });
  describe('Momentum indicators', () => {
    it('calcMACD', () => {
      const bars = makeBars(200);
      const [d, e, h] = calcMACD(bars);
      expect(h[199]).not.toBeNull();
    });
    it('calcRSI bounds', () => {
      const bars = trendBars(50);
      const r = calcRSI(bars, 14);
      expect(r[13]!).toBeGreaterThanOrEqual(0);
      expect(r[13]!).toBeLessThanOrEqual(100);
    });
    it('calcKDJ', () => {
      const bars = makeBars(100);
      const [k, d, j] = calcKDJ(bars);
      expect(k[99]).not.toBeNull();
      expect(d[99]).not.toBeNull();
      expect(j[99]).not.toBeNull();
    });
    it('calcWR bounds', () => {
      const r = calcWR(makeBars(60), 14);
      expect(r[13]!).toBeLessThanOrEqual(0);
      expect(r[13]!).toBeGreaterThanOrEqual(-100);
    });
    it('calcCCI', () => {
      const r = calcCCI(trendBars(80), 20);
      expect(r[19]).not.toBeNull();
    });
  });
  describe('Volatility indicators', () => {
    it('calcATR', () => {
      const r = calcATR(makeBars(100), 14);
      expect(r[13]!).toBeGreaterThanOrEqual(0);
    });
    it('calcStdDev', () => {
      const r = calcStdDev(makeBars(60), 20);
      expect(r[19]!).toBeGreaterThanOrEqual(0);
    });
  });
  describe('Volume indicators', () => {
    it('calcOBV', () => {
      const r = calcOBV(makeBars(50));
      expect(r[0]).toBe(0);
    });
    it('calcVWAP', () => {
      const r = calcVWAP(makeBars(30));
      expect(r[29]).not.toBeNull();
    });
    it('calcMFI bounds', () => {
      const r = calcMFI(makeBars(100), 14);
      expect(r[13]!).toBeGreaterThanOrEqual(0);
      expect(r[13]!).toBeLessThanOrEqual(100);
    });
  });
  describe('Overlap indicators', () => {
    it('calcSAR', () => {
      const r = calcSAR(trendBars(30));
      expect(r[2]).not.toBeNull();
    });
    it('calcIchimoku 5 lines', () => {
      const lines = calcIchimoku(makeBars(200));
      expect(lines).toHaveLength(5);
    });
  });
  describe('Custom indicators', () => {
    it('calcPivot 7 levels', () => {
      const levels = calcPivot(makeBars(50));
      expect(levels).toHaveLength(7);
      expect(levels[3][1]!).not.toBeNull(); // pp
    });
    it('calcMAEnvelope', () => {
      const [u, m, l] = calcMAEnvelope(makeBars(60), 20, 3);
      expect(u[19]!).toBeGreaterThan(m[19]!);
    });
    it('calcEMACross', () => {
      const r = calcEMACross(trendBars(50), 5, 10);
      expect(r.every(v => v === null || [1, -1, 0].includes(v!))).toBe(true);
    });
  });
  describe('computeIndicator helper', () => {
    it('ma by id', () => {
      expect(computeIndicator('ma', makeBars(50), { period: 10 })[9]).not.toBeNull();
    });
    it('rsi by id', () => {
      expect(computeIndicator('rsi', makeBars(50), { period: 14 })).toHaveLength(50);
    });
    it('unknown returns empty', () => {
      expect(computeIndicator('x', makeBars(10), {})).toHaveLength(0);
    });
  });
  describe('Series helpers', () => {
    it('MACD series', () => {
      const [d, e, h] = computeMACDSeries(makeBars(200));
      expect(h).toHaveLength(200);
    });
    it('BOLL series', () => {
      const [m, u, l] = computeBOLLSeries(makeBars(100));
      expect(l).toHaveLength(100);
    });
    it('KDJ series', () => {
      const [k, d, j] = computeKDJSeries(makeBars(100));
      expect(j).toHaveLength(100);
    });
    it('Ichimoku series', () => {
      expect(computeIchimokuSeries(makeBars(200))).toHaveLength(5);
    });
    it('Pivot series', () => {
      expect(computePivotSeries(makeBars(50))).toHaveLength(7);
    });
  });
  describe('Edge cases', () => {
    it('empty bars', () => {
      expect(calcSMA([], 20)).toHaveLength(0);
    });
    it('single bar', () => {
      expect(calcSMA(makeBars(1), 20)[0]).toBeNull();
    });
    it('flat bars RSI=100', () => {
      const now = Date.now();
      const bars: KlineBar[] = Array.from({ length: 30 }, (_, i) => ({
        time: now + i * 3600000, open: 100, high: 100.1, low: 99.9, close: 100, volume: 1000,
      }));
      expect(calcRSI(bars, 14)[13]!).toBe(100);
    });
  });
});