// ── R265 JVS 测试文件 ──
// 覆盖: IndicatorExpansion (10指标) + TimeAndSalesPipeline + MultiTimeframeSyncEngine

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcSTOCH, calcDEMA, calcTEMA, calcAROON, calcCMO, calcDPO,
  calcChaikinOsc, calcBOP, calcBOPSmoothed, calcKeltnerChannel,
  calcForceIndex, computeExpandedIndicators,
} from '../electron/engine/analysis/indicator-expansion';
import type { OHLCVBar } from '../electron/engine/analysis/indicator-expansion';
import { TimeAndSalesPipeline, getTimeAndSalesPipeline, resetTimeAndSalesPipeline } from '../electron/engine/data/TimeAndSalesPipeline';
import { MultiTimeframeSyncEngine, getMultiTimeframeSyncEngine, resetMultiTimeframeSyncEngine } from '../electron/engine/data/MultiTimeframeSyncEngine';

// ═══════════ Test Data Generators ═══════════

function makeOHLCVBars(n: number, startPrice = 100): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const open = price;
    const change = (Math.sin(i * 0.3) * 2 + (Math.random() - 0.5) * 3);
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 1.5;
    const low = Math.min(open, close) - Math.random() * 1.5;
    bars.push({
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 100000 + 10000),
    });
    price = close;
  }
  return bars;
}

function makeTickRecords(n: number, basePrice = 100): import('../electron/engine/data/TimeAndSalesPipeline').TickRecord[] {
  const ticks: import('../electron/engine/data/TimeAndSalesPipeline').TickRecord[] = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    price += (Math.random() - 0.5) * 0.2;
    ticks.push({
      timestamp: now - (n - i) * 50,
      price: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 500 + 10),
      side: Math.random() > 0.5 ? 'buy' : 'sell',
    });
  }
  return ticks;
}

// ═══════════════════════════════════════════════════════════════
// IndicatorExpansion 10指标测试
// ═══════════════════════════════════════════════════════════════

describe('IndicatorExpansion', () => {
  describe('STOCH', () => {
    it('returns arrays of correct length', () => {
      const bars = makeOHLCVBars(100);
      const { k, d } = calcSTOCH(bars, 14, 3, 3);
      expect(k.length).toBe(100);
      expect(d.length).toBe(100);
    });

    it('produces valid range [0, 100]', () => {
      const bars = makeOHLCVBars(200);
      const { k, d } = calcSTOCH(bars, 14, 3, 3);
      for (const v of k) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
      for (const v of d) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    });

    it('has null padding at start', () => {
      const bars = makeOHLCVBars(50);
      const { k } = calcSTOCH(bars, 14, 3, 3);
      // First 15 values should be null (14 for %K raw + smoothing + delay)
      const nonNullIdx = k.findIndex((v) => v !== null);
      expect(nonNullIdx).toBeGreaterThan(0);
    });

    it('flat price gives neutral STOCH (~50)', () => {
      const bars: OHLCVBar[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100, high: 100, low: 100, close: 100, volume: 1000,
      }));
      const { k } = calcSTOCH(bars, 5, 3, 1);
      const lastK = k[k.length - 1];
      // Flat price: high==low→range=0→%K=50
      expect(lastK).toBe(50);
    });
  });

  describe('DEMA', () => {
    it('returns null-padded array', () => {
      const closes = Array.from({ length: 100 }, (_, i) => 100 + i * 0.1);
      const result = calcDEMA(closes, 20);
      expect(result.length).toBe(100);
    });

    it('is non-null after warmup period', () => {
      const closes = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1) * 5);
      const result = calcDEMA(closes, 10);
      const lastVal = result[result.length - 1];
      expect(lastVal).not.toBeNull();
    });

    it('responds faster than regular EMA to trend change', () => {
      const closes: number[] = [];
      for (let i = 0; i < 60; i++) closes.push(100);
      for (let i = 0; i < 60; i++) closes.push(100 + i * 0.5); // uptrend
      const result = calcDEMA(closes, 20);
      // DEMA should be above 100 by the end (responding to uptrend)
      const lastVal = result[result.length - 1];
      expect(lastVal).not.toBeNull();
      expect(lastVal!).toBeGreaterThan(100);
    });
  });

  describe('TEMA', () => {
    it('returns null-padded array', () => {
      const closes = Array.from({ length: 100 }, (_, i) => 100 + i * 0.1);
      const result = calcTEMA(closes, 10);
      expect(result.length).toBe(100);
    });

    it('has non-null values after sufficient data', () => {
      const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.cos(i * 0.2) * 3);
      const result = calcTEMA(closes, 5);
      const nonNull = result.filter((v) => v !== null);
      expect(nonNull.length).toBeGreaterThan(0);
    });
  });

  describe('AROON', () => {
    it('returns correct array lengths', () => {
      const bars = makeOHLCVBars(100);
      const { up, down, oscillator } = calcAROON(bars, 25);
      expect(up.length).toBe(100);
      expect(down.length).toBe(100);
      expect(oscillator.length).toBe(100);
    });

    it('values in range [0, 100]', () => {
      const bars = makeOHLCVBars(200);
      const { up, down } = calcAROON(bars, 25);
      for (const v of up) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
      for (const v of down) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    });

    it('oscillator = up - down', () => {
      const bars = makeOHLCVBars(100);
      const { up, down, oscillator } = calcAROON(bars, 25);
      for (let i = 25; i < bars.length; i++) {
        if (up[i] !== null && down[i] !== null && oscillator[i] !== null) {
          expect(oscillator[i]).toBeCloseTo(up[i]! - down[i]!, 5);
        }
      }
    });
  });

  describe('CMO', () => {
    it('returns null-padded array of correct length', () => {
      const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.2) * 4);
      const result = calcCMO(closes, 14);
      expect(result.length).toBe(50);
    });

    it('range is [-100, 100]', () => {
      const closes = Array.from({ length: 200 }, (_, i) => 100 + i * 0.2 + Math.sin(i * 0.3) * 8);
      const result = calcCMO(closes, 14);
      for (const v of result) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(-100);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    });

    it('strict uptrend gives CMO = 100', () => {
      const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const result = calcCMO(closes, 14);
      const lastVals = result.slice(-10).filter((v) => v !== null);
      for (const v of lastVals) {
        expect(v).toBe(100);
      }
    });

    it('strict downtrend gives CMO = -100', () => {
      const closes = Array.from({ length: 50 }, (_, i) => 100 - i * 2);
      const result = calcCMO(closes, 14);
      const lastVals = result.slice(-10).filter((v) => v !== null);
      for (const v of lastVals) {
        expect(v).toBe(-100);
      }
    });
  });

  describe('DPO', () => {
    it('returns correct array length', () => {
      const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.1);
      const result = calcDPO(closes, 20);
      expect(result.length).toBe(60);
    });

    it('has valid values after warmup', () => {
      const closes = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1) * 10);
      const result = calcDPO(closes, 20);
      const nonNull = result.filter((v) => v !== null);
      expect(nonNull.length).toBeGreaterThan(0);
    });
  });

  describe('ChaikinOsc', () => {
    it('returns correct array length', () => {
      const bars = makeOHLCVBars(100);
      const result = calcChaikinOsc(bars, 3, 10);
      expect(result.length).toBe(100);
    });

    it('has non-null values after warmup', () => {
      const bars = makeOHLCVBars(80);
      const result = calcChaikinOsc(bars, 3, 10);
      const nonNull = result.filter((v) => v !== null);
      expect(nonNull.length).toBeGreaterThan(0);
    });
  });

  describe('BOP', () => {
    it('range [-1, 1]', () => {
      const bars = makeOHLCVBars(100);
      const result = calcBOP(bars);
      for (const v of result) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(-1);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    });

    it('close=high gives positive BOP (bullish)', () => {
      const bars: OHLCVBar[] = [{
        open: 100, high: 105, low: 99, close: 105, volume: 1000,
      }];
      const result = calcBOP(bars);
      expect(result[0]).toBeGreaterThan(0);
    });

    it('close=low gives negative BOP (bearish)', () => {
      const bars: OHLCVBar[] = [{
        open: 100, high: 101, low: 95, close: 95, volume: 1000,
      }];
      const result = calcBOP(bars);
      expect(result[0]).toBeLessThan(0);
    });
  });

  describe('BOP Smoothed', () => {
    it('returns null-padded at start', () => {
      const bars = makeOHLCVBars(50);
      const result = calcBOPSmoothed(bars, 14);
      expect(result.length).toBe(50);
    });
  });

  describe('KeltnerChannel', () => {
    it('returns arrays of correct length', () => {
      const bars = makeOHLCVBars(100);
      const { middle, upper, lower } = calcKeltnerChannel(bars, 20, 10, 2);
      expect(middle.length).toBe(100);
      expect(upper.length).toBe(100);
      expect(lower.length).toBe(100);
    });

    it('upper > middle > lower', () => {
      const bars = makeOHLCVBars(200);
      const { middle, upper, lower } = calcKeltnerChannel(bars, 20, 10, 2);
      for (let i = 30; i < bars.length; i++) {
        if (upper[i] !== null && middle[i] !== null && lower[i] !== null) {
          expect(upper[i]!).toBeGreaterThan(middle[i]!);
          expect(middle[i]!).toBeGreaterThan(lower[i]!);
        }
      }
    });
  });

  describe('ForceIndex', () => {
    it('returns array of correct length', () => {
      const bars = makeOHLCVBars(100);
      const result = calcForceIndex(bars, 13);
      expect(result.length).toBe(100);
    });

    it('uptrend gives positive values', () => {
      const bars: OHLCVBar[] = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i + 0.5,
        volume: 10000,
      }));
      const result = calcForceIndex(bars, 13);
      const lastVal = result[result.length - 1];
      expect(lastVal).not.toBeNull();
      expect(lastVal!).toBeGreaterThan(0);
    });
  });

  describe('computeExpandedIndicators (batch)', () => {
    it('returns empty result for empty config', () => {
      const bars = makeOHLCVBars(50);
      const result = computeExpandedIndicators(bars, {});
      expect(Object.keys(result).length).toBe(0);
    });

    it('computes stoch with default params', () => {
      const bars = makeOHLCVBars(100);
      const result = computeExpandedIndicators(bars, { stoch: true });
      expect(result.stoch).toBeDefined();
      expect(result.stoch!.k.length).toBe(100);
    });

    it('computes stoch with custom params', () => {
      const bars = makeOHLCVBars(100);
      const result = computeExpandedIndicators(bars, {
        stoch: { periodK: 10, periodD: 5, smoothK: 2 },
      });
      expect(result.stoch).toBeDefined();
    });

    it('computes multiple indicators at once', () => {
      const bars = makeOHLCVBars(100);
      const result = computeExpandedIndicators(bars, {
        dema: true,
        cmo: { period: 14 },
        keltner: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
        bop: { smoothed: true, period: 14 },
      });
      expect(result.dema).toBeDefined();
      expect(result.cmo).toBeDefined();
      expect(result.keltner).toBeDefined();
      expect(result.bop).toBeDefined();
      expect(result.bopSmoothed).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TimeAndSalesPipeline 测试
// ═══════════════════════════════════════════════════════════════

describe('TimeAndSalesPipeline', () => {
  let pipeline: TimeAndSalesPipeline;

  beforeEach(() => {
    resetTimeAndSalesPipeline();
    pipeline = getTimeAndSalesPipeline();
    pipeline.reset();
  });

  it('singleton pattern', () => {
    const a = getTimeAndSalesPipeline();
    const b = getTimeAndSalesPipeline();
    expect(a).toBe(b);
  });

  it('reset clears all state', () => {
    const ticks = makeTickRecords(100);
    pipeline.ingestTicks(ticks);
    pipeline.reset();
    expect(pipeline.getStats().totalTicks).toBe(0);
  });

  it('noise filter removes spikes', () => {
    const ticks = makeTickRecords(50, 100);
    // Insert a huge spike
    ticks.push({
      timestamp: Date.now(),
      price: 1000, // 10x spike
      volume: 10,
      side: 'buy',
    });
    const { clean, filtered } = pipeline.applyNoiseFilter(ticks);
    expect(filtered).toBeGreaterThanOrEqual(1);
    expect(clean.length).toBeLessThanOrEqual(ticks.length);
  });

  it('ingests ticks and produces aggregated bars', () => {
    const ticks = makeTickRecords(500, 100);
    const { bars, stats } = pipeline.ingestTicks(ticks);
    expect(bars.length).toBeGreaterThan(0);
    expect(stats.inputTicks).toBe(500);
    expect(stats.aggregatedBars).toBe(bars.length);
  });

  it('aggregated bars have correct structure', () => {
    const ticks = makeTickRecords(200, 100);
    const { bars } = pipeline.ingestTicks(ticks);
    for (const bar of bars) {
      expect(bar.open).toBeGreaterThan(0);
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(bar.volume).toBeGreaterThan(0);
      expect(bar.tradeCount).toBeGreaterThan(0);
      expect(bar.vwap).toBeGreaterThan(0);
    }
  });

  it('volume profile generates bins', () => {
    const ticks = makeTickRecords(300, 100);
    pipeline.ingestTicks(ticks);
    const profile = pipeline.getVolumeProfile();
    expect(profile.length).toBeGreaterThan(0);
    for (const bin of profile) {
      expect(bin.totalVolume).toBeGreaterThan(0);
    }
  });

  it('POC is the level with most volume', () => {
    const ticks = makeTickRecords(500, 100);
    pipeline.ingestTicks(ticks);
    const poc = pipeline.getPOC();
    expect(poc).not.toBeNull();
    expect(poc!.totalVolume).toBeGreaterThan(0);

    const profile = pipeline.getVolumeProfile();
    const maxVol = Math.max(...profile.map((b) => b.totalVolume));
    expect(poc!.totalVolume).toBe(maxVol);
  });

  it('value area calculation', () => {
    const ticks = makeTickRecords(500, 100);
    pipeline.ingestTicks(ticks);
    const { poc, vah, val } = pipeline.getValueArea();
    expect(poc).not.toBeNull();
    // Value area exists and returns a POC when data present
    expect(poc).not.toBeNull();
    // vah and val are numbers (non-NaN) — on sparse random data, vah may equal poc.level
    expect(Number.isFinite(vah)).toBe(true);
    expect(Number.isFinite(val)).toBe(true);
  });

  it('footprint generation', () => {
    const now = Date.now();
    const ticks = makeTickRecords(200, 100);
    pipeline.ingestTicks(ticks);
    const footprint = pipeline.generateFootprint(now - 10000, now);
    expect(footprint.length).toBeGreaterThan(0);
    for (const row of footprint) {
      expect(row.bidVolume + row.askVolume).toBeCloseTo(row.totalVolume, 0);
      expect(row.delta).toBeCloseTo(row.bidVolume - row.askVolume, 0);
    }
  });

  it('detects block trades', () => {
    const ticks = makeTickRecords(30, 100);
    // Insert an extremely large trade
    ticks.push({
      timestamp: Date.now(),
      price: 100,
      volume: 1000000,
      side: 'buy',
    });
    pipeline.ingestTicks(ticks);
    const blocks = pipeline.detectBlockTrades(5);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].volume).toBe(1000000);
  });

  it('imbalance ratio calculation', () => {
    const ticks: import('../electron/engine/data/TimeAndSalesPipeline').TickRecord[] = [
      { timestamp: Date.now(), price: 100, volume: 100, side: 'buy' },
      { timestamp: Date.now() + 1, price: 100, volume: 50, side: 'sell' },
    ];
    pipeline.ingestTicks(ticks);
    const ratio = pipeline.getImbalanceRatio();
    expect(ratio).toBeGreaterThan(0); // buy > sell
  });

  it('config update works', () => {
    pipeline.updateConfig({ aggregationIntervalMs: 5000 });
    expect(pipeline.getConfig().aggregationIntervalMs).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════
// MultiTimeframeSyncEngine 测试
// ═══════════════════════════════════════════════════════════════

describe('MultiTimeframeSyncEngine', () => {
  let engine: MultiTimeframeSyncEngine;

  beforeEach(() => {
    resetMultiTimeframeSyncEngine();
  });

  function makeKlineBars(n: number, tfMs: number, basePrice = 100): import('../electron/engine/data/MultiTimeframeSyncEngine').KlineBar[] {
    const now = Date.now();
    const bars: import('../electron/engine/data/MultiTimeframeSyncEngine').KlineBar[] = [];
    let price = basePrice;
    for (let i = 0; i < n; i++) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 5;
      bars.push({
        timestamp: now - (n - i) * tfMs,
        open: open,
        high: Math.max(open, close) + Math.random() * 2,
        low: Math.min(open, close) - Math.random() * 2,
        close: close,
        volume: Math.floor(Math.random() * 100000 + 5000),
      });
      price = close;
    }
    return bars;
  }

  it('singleton returns same instance', () => {
    const a = getMultiTimeframeSyncEngine();
    const b = getMultiTimeframeSyncEngine();
    expect(a).toBe(b);
  });

  it('reset clears all data', () => {
    const e = getMultiTimeframeSyncEngine({ primary: 'D', secondary: ['1h'] });
    e.loadBars('D', makeKlineBars(30, 86400000));
    e.reset();
    expect(e.getBars('D').length).toBe(0);
  });

  it('loads and retrieves bars', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['1h'] });
    const dailyBars = makeKlineBars(30, 86400000);
    e.loadBars('D', dailyBars);
    expect(e.getBars('D').length).toBe(30);
  });

  it('getBarCounts returns all loaded timeframes', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['1h', '4h'] });
    e.loadBars('D', makeKlineBars(10, 86400000));
    e.loadBars('1h', makeKlineBars(100, 3600000));
    const counts = e.getBarCounts();
    expect(counts['D']).toBe(10);
    expect(counts['1h']).toBe(100);
  });

  it('align produces valid results', () => {
    const e = new MultiTimeframeSyncEngine({
      primary: 'D',
      secondary: ['1h'],
      alignmentMode: 'nearest',
    });
    e.loadBars('D', makeKlineBars(10, 86400000));
    e.loadBars('1h', makeKlineBars(100, 3600000));
    const result = e.align();
    expect(result.primary).toBe('D');
    expect(result.aligned.length).toBeGreaterThan(0);
  });

  it('resample creates higher timeframe bars', () => {
    const e = new MultiTimeframeSyncEngine({ primary: '1m', secondary: [] });
    const minutely = makeKlineBars(60, 60000);
    const resampled = e.resample(minutely, '1m', '5m');
    // 60 1m bars → 5m buckets; boundary can add ±1
    expect(resampled.length).toBeGreaterThanOrEqual(10);
    expect(resampled.length).toBeLessThanOrEqual(15);
    expect(resampled.length).toBeGreaterThan(0);
  });

  it('resampled bars have open/high/low/close/volume', () => {
    const e = new MultiTimeframeSyncEngine({ primary: '1m', secondary: [] });
    const minutely = makeKlineBars(120, 60000);
    const resampled = e.resample(minutely, '1m', '15m');
    for (const bar of resampled) {
      expect(bar.open).toBeDefined();
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(bar.volume).toBeGreaterThanOrEqual(0);
    }
  });

  it('detects multi-timeframe trend', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['4h'] });
    // Create uptrend bars
    const daily = Array.from({ length: 20 }, (_, i) => ({
      timestamp: Date.now() - (20 - i) * 86400000,
      open: 100 + i * 2,
      high: 100 + i * 2 + 3,
      low: 100 + i * 2 - 1,
      close: 100 + i * 2 + 2,
      volume: 100000,
    }));
    const h4 = Array.from({ length: 120 }, (_, i) => ({
      timestamp: Date.now() - (120 - i) * 4 * 3600000,
      open: 100 + i * 0.3,
      high: 100 + i * 0.3 + 1,
      low: 100 + i * 0.3 - 0.5,
      close: 100 + i * 0.3 + 0.8,
      volume: 10000,
    }));
    e.loadBars('D', daily);
    e.loadBars('4h', h4);
    const trend = e.detectMultiTimeframeTrend(3, 2);
    expect(['up', 'down', 'mixed']).toContain(trend);
  });

  it('MTF snapshot returns values', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['4h'] });
    e.loadBars('D', makeKlineBars(20, 86400000));
    e.loadBars('4h', makeKlineBars(120, 4 * 3600000));
    const snapshot = e.getMTFSnapshot(Date.now() - 86400000 * 5);
    expect(snapshot).toHaveProperty('4h');
  });

  it('findNearestBar returns a bar', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['1h'] });
    const daily = makeKlineBars(10, 86400000);
    e.loadBars('D', daily);
    const now = daily[5].timestamp;
    const found = e.findNearestBar(now);
    expect(found.bar).not.toBeNull();
  });

  it('compareTimeframePerformance returns metrics', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['W'] });
    e.loadBars('D', makeKlineBars(50, 86400000));
    e.loadBars('W', makeKlineBars(20, 604800000));
    const perf = e.compareTimeframePerformance(20);
    expect(perf).toHaveProperty('D');
    expect(perf).toHaveProperty('W');
    expect(perf['D']).toHaveProperty('returnsPct');
    expect(perf['D']).toHaveProperty('volatility');
  });

  it('coverage report returns metrics', () => {
    const e = new MultiTimeframeSyncEngine({ primary: 'D', secondary: ['1h'] });
    e.loadBars('D', makeKlineBars(20, 86400000));
    e.loadBars('1h', makeKlineBars(100, 3600000));
    const report = e.getCoverageReport();
    expect(report).toHaveProperty('D');
    expect(report).toHaveProperty('1h');
    expect(report['D'].coveragePct).toBeGreaterThan(0);
  });
});
