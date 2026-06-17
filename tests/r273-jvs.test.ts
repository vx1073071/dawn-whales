// ── R273 JVS 测试文件 ── 覆盖: INFuturesOptionsEngine + FII_DIIEngine + ThreeInstitutionalEngine + MultiCurrencyQuoteEngine

import { describe, it, expect, beforeEach } from 'vitest';
import { INFuturesOptionsEngine, getINFuturesOptionsEngine, resetINFuturesOptionsEngine, type FnOContract } from '../electron/engine/analysis/in-fno-engine';
import { FII_DIIEngine, getFII_DIIEngine, resetFII_DIIEngine } from '../electron/engine/analysis/fii-dii-engine';
import { ThreeInstitutionalEngine, getThreeInstitutionalEngine, resetThreeInstitutionalEngine } from '../electron/engine/analysis/three-institutional-engine';
import { MultiCurrencyQuoteEngine, getMultiCurrencyQuoteEngine, resetMultiCurrencyQuoteEngine, ALL_CURRENCIES } from '../electron/engine/analysis/multi-currency-quote-engine';

// ═══════════════════════════════════════════════
// INFuturesOptionsEngine
// ═══════════════════════════════════════════════

describe('INFuturesOptionsEngine', () => {
  let e: INFuturesOptionsEngine;
  beforeEach(() => { resetINFuturesOptionsEngine(); e = getINFuturesOptionsEngine(); });

  it('seed populates snapshots', () => {
    const snaps = e.seed();
    expect(snaps.length).toBe(10);
    snaps.forEach(s => { expect(s.pcr).toBeGreaterThan(0); expect(s.ivAverage).toBeGreaterThan(0); });
  });

  it('query filters by type', () => {
    e.seed();
    const ceOnly = e.query('NIFTY', { type: 'CE' });
    expect(ceOnly.length).toBeGreaterThan(0);
    expect(ceOnly.every(c => c.type === 'CE')).toBe(true);
  });

  it('query filters by minOI', () => {
    e.seed();
    const highOI = e.query('NIFTY', { minOI: 200000 });
    expect(highOI.every(c => c.openInterest >= 200000)).toBe(true);
  });

  it('buildSnapshot produces valid structure', () => {
    e.seed();
    const snap = e.buildSnapshot('NIFTY')!;
    expect(snap.pcr).toBeGreaterThan(0);
    expect(snap.maxCallOI.strike).toBeGreaterThan(0);
    expect(snap.maxPutOI.strike).toBeGreaterThan(0);
    expect(snap.ivTermStructure.length).toBeGreaterThanOrEqual(0);
  });

  it('OI buildup detection', () => {
    e.seed();
    const buildup = e.detectOIBuildup('NIFTY');
    expect(Array.isArray(buildup.bullishBuildup)).toBe(true);
    expect(Array.isArray(buildup.bearishBuildup)).toBe(true);
  });

  it('PCR analysis returns interpretation', () => {
    e.seed();
    const pcr = e.getPCR('NIFTY');
    expect(pcr.pcr).toBeGreaterThan(0);
    expect(['oversold', 'overbought', 'neutral']).toContain(pcr.interpretation);
  });

  it('max pain computed', () => {
    e.seed();
    const pain = e.computeMaxPain('NIFTY');
    expect(pain).toBeGreaterThan(0);
  });

  it('detectSignals returns array', () => {
    e.seed();
    const signals = e.detectSignals('NIFTY');
    expect(Array.isArray(signals)).toBe(true);
  });

  it('analyze returns full report', () => {
    e.seed();
    const report = e.analyze('NIFTY');
    expect(report).toBeDefined();
    expect(report!.sentiment).toBeTruthy();
    expect(report!.supportLevels.length).toBeGreaterThanOrEqual(0);
    expect(typeof report!.maxPain).toBe('number');
  });

  it('rollover summary', () => {
    e.seed();
    const ro = e.getRolloverSummary();
    expect(ro.length).toBeGreaterThanOrEqual(5);
    expect(typeof ro[0].rolloverPercent).toBe('number');
  });
});

// ═══════════════════════════════════════════════
// FII_DIIEngine
// ═══════════════════════════════════════════════

describe('FII_DIIEngine', () => {
  let e: FII_DIIEngine;
  beforeEach(() => { resetFII_DIIEngine(); e = getFII_DIIEngine(); });

  it('seed loads data', () => {
    const count = e.seed();
    expect(count).toBeGreaterThan(50);
  });

  it('daily summary has all fields', () => {
    e.seed();
    const s = e.getDailySummary()!;
    expect(s.fiiNetTotal).toBeDefined();
    expect(s.diiNetTotal).toBeDefined();
    expect(s.sentiment).toBeTruthy();
    expect(s.fiiActivityScore).toBeGreaterThanOrEqual(0);
    expect(s.fiiActivityScore).toBeLessThanOrEqual(100);
    expect(s.consecutiveFIIBuy || s.consecutiveFIISell).toBeDefined();
  });

  it('trend returns period data', () => {
    e.seed();
    const t = e.getTrend(10);
    expect(t.period).toBe('10d');
    expect(typeof t.fiiCumulative).toBe('number');
  });

  it('cross-market flow', () => {
    e.seed();
    const flow = e.getCrossMarketFlow();
    expect(flow.length).toBeGreaterThanOrEqual(1);
  });

  it('alerts detected', () => {
    e.seed(60);
    const alerts = e.detectAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// ThreeInstitutionalEngine
// ═══════════════════════════════════════════════

describe('ThreeInstitutionalEngine', () => {
  let e: ThreeInstitutionalEngine;
  beforeEach(() => { resetThreeInstitutionalEngine(); e = getThreeInstitutionalEngine(); });

  it('seed loads TW and KR data', () => {
    e.seed();
    const tw = e.getDailySummary('TW');
    const kr = e.getDailySummary('KR');
    expect(tw).toBeDefined();
    expect(kr).toBeDefined();
    expect(tw!.mainIndex).toBe('TAIEX');
    expect(kr!.mainIndex).toBe('KOSPI');
  });

  it('daily summary has sentiment', () => {
    e.seed();
    const tw = e.getDailySummary('TW')!;
    expect(tw.sentiment.consensus).toBeTruthy();
    expect(typeof tw.sentiment.score).toBe('number');
    expect(tw.foreignSentiment).toBeTruthy();
  });

  it('trend analysis', () => {
    e.seed();
    const trend = e.getTrend('TW', 10)!;
    expect(trend.period).toBe('10d');
    expect(typeof trend.indexReturn).toBe('number');
  });

  it('cross-country comparison', () => {
    e.seed();
    const comp = e.compare();
    expect(comp.tw).toBeDefined();
    expect(comp.kr).toBeDefined();
    expect(comp.relativeStrength).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════
// MultiCurrencyQuoteEngine
// ═══════════════════════════════════════════════

describe('MultiCurrencyQuoteEngine', () => {
  let e: MultiCurrencyQuoteEngine;
  beforeEach(() => { resetMultiCurrencyQuoteEngine(); e = getMultiCurrencyQuoteEngine(); });

  it('ALL_CURRENCIES has 24 codes', () => {
    expect(ALL_CURRENCIES.length).toBe(24);
  });

  it('seed populates 23 rates', () => {
    const count = e.seed();
    expect(count).toBe(23);
  });

  it('conversion USD→JPY returns result', () => {
    e.seed();
    const result = e.convert(1000, 'USD', 'JPY');
    expect(result).toBeDefined();
    expect(result!.to.amount).toBeGreaterThan(100000);
  });

  it('conversion same currency = identity', () => {
    e.seed();
    const result = e.convert(500, 'USD', 'USD');
    expect(result!.to.amount).toBe(500);
  });

  it('toUSD converts all currencies', () => {
    e.seed();
    const usdValue = e.toUSD(100000, 'JPY');
    expect(usdValue).toBeGreaterThan(0);
    expect(usdValue).toBeLessThan(1000);
  });

  it('triangulation works for non-USD pairs', () => {
    e.seed();
    const result = e.convert(100, 'EUR', 'JPY');
    expect(result).toBeDefined();
    expect(result!.to.amount).toBeGreaterThan(10000);
  });

  it('portfolio exposure computes correctly', () => {
    e.seed();
    const exp = e.computePortfolioExposure([
      { currency: 'USD', amount: 10000 },
      { currency: 'JPY', amount: 1000000 },
      { currency: 'EUR', amount: 5000 },
    ])!;
    expect(exp.totalValueUSD).toBeGreaterThan(15000);
    expect(exp.currencies.length).toBe(3);
    expect(exp.var95).toBeGreaterThan(0);
  });

  it('heatmap builds correctly', () => {
    e.seed();
    const hm = e.buildHeatmap()!;
    expect(hm.matrix.length).toBe(10);
    expect(hm.strongest).toBeTruthy();
    expect(hm.weakest).toBeTruthy();
    expect(typeof hm.volatility).toBe('number');
  });

  it('most volatile pairs', () => {
    e.seed();
    const vol = e.getMostVolatile(5);
    expect(vol.length).toBe(5);
    expect(vol[0].rate.volatility).toBeGreaterThanOrEqual(vol[4].rate.volatility);
  });
});
