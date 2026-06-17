// ── R275 JVS 测试文件 ── 覆盖: JP_IN_BR_13Engine + KR_TW_EU_SA_13Engine + GlobalPerfOptimizer

import { describe, it, expect, beforeEach } from 'vitest';
import { JP_IN_BR_13Engine, getJP_IN_BR_13Engine, resetJP_IN_BR_13Engine } from '../electron/engine/analysis/jp-in-br-13-engine';
import { KR_TW_EU_SA_13Engine, getKR_TW_EU_SA_13Engine, resetKR_TW_EU_SA_13Engine } from '../electron/engine/analysis/kr-tw-eu-sa-13-engine';
import { GlobalPerfOptimizer, getGlobalPerfOptimizer, resetGlobalPerfOptimizer } from '../electron/engine/analysis/global-perf-optimizer';

// ═══════════════════════════════════════════════
// JP_IN_BR_13Engine
// ═══════════════════════════════════════════════

describe('JP_IN_BR_13Engine', () => {
  let e: JP_IN_BR_13Engine;
  beforeEach(() => { resetJP_IN_BR_13Engine(); e = getJP_IN_BR_13Engine(); });

  it('seed loads all 13 indicators', () => {
    e.seed();
    expect(e.getLatestTankan()).toBeDefined();
    expect(e.getLatestTrust()).toBeDefined();
    expect(e.getLatestJPExport()).toBeDefined();
    expect(e.getLatestPER()).toBeDefined();
    expect(e.getLatestTopixDir()).toBeDefined();
    expect(e.getLatestPB()).toBeDefined();
    expect(e.getLatestGST()).toBeDefined();
    expect(e.getLatestIIP()).toBeDefined();
    expect(e.getLatestForex()).toBeDefined();
    expect(e.getLatestCPI()).toBeDefined();
    expect(e.getLatestSelic()).toBeDefined();
    expect(e.getLatestPMI()).toBeDefined();
    expect(e.getLatestBRFlow()).toBeDefined();
  });

  it('JP Tankan analysis', () => {
    e.seed(); const a = e.analyzeTankan();
    expect(typeof a.allIndustry).toBe('number');
    expect(a.signal).toBeTruthy();
  });

  it('JP Trust analysis', () => {
    e.seed(); const a = e.analyzeTrust();
    expect(a.trustNet).toBeDefined();
    expect(typeof a.foreignNet).toBe('number');
  });

  it('JP Trade balance returns yen sensitivity', () => {
    e.seed(); const a = e.analyzeTradeBalance();
    expect(a.balance).toBeDefined();
    expect(typeof a.exportYoY).toBe('number');
  });

  it('JP PER zScore analysis', () => {
    e.seed(); const a = e.analyzePER();
    expect(typeof a.zScore).toBe('number');
    expect(['overvalued', 'fair', 'undervalued']).toContain(a.signal);
  });

  it('JP Margin buy/sell ratio', () => {
    e.seed(); const a = e.analyzeMarginBuySell();
    expect(a.marginRatio).toBeGreaterThan(0);
  });

  it('JP PB analysis returns belowBook %', () => {
    e.seed(); const a = e.analyzePB();
    expect(a.topixPB).toBeGreaterThan(0);
    expect(typeof a.belowBook).toBe('number');
  });

  it('IN GST fiscal health', () => {
    e.seed(); const a = e.analyzeGST();
    expect(a.collection).toBeGreaterThan(0);
  });

  it('IN IIP analysis', () => {
    e.seed(); const a = e.analyzeIIP();
    expect(a.iip).toBeGreaterThan(100);
  });

  it('IN Forex adequacy score', () => {
    e.seed(); const a = e.analyzeForex();
    expect(a.adequacy).toBeGreaterThan(50);
  });

  it('IN CPI within RBI band', () => {
    e.seed(); const a = e.analyzeCPI();
    expect(typeof a.withinBand).toBe('boolean');
  });

  it('BR Selic policy stance', () => {
    e.seed(); const a = e.analyzeSelic();
    expect(a.rate).toBeGreaterThan(5);
  });

  it('BR PMI composite', () => {
    e.seed(); const a = e.analyzePMI();
    expect(a.composite).toBeGreaterThan(45);
  });

  it('BR Foreign flow signal', () => {
    e.seed(); const a = e.analyzeBRFlow();
    expect(typeof a.signal).toBe('string');
  });

  it('Dashboards return data', () => {
    e.seed();
    expect(e.getJP_Dashboard().tankan).toBeDefined();
    expect(e.getIN_Dashboard().gst).toBeDefined();
    expect(e.getBR_Dashboard().selic).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// KR_TW_EU_SA_13Engine
// ═══════════════════════════════════════════════

describe('KR_TW_EU_SA_13Engine', () => {
  let e: KR_TW_EU_SA_13Engine;
  beforeEach(() => { resetKR_TW_EU_SA_13Engine(); e = getKR_TW_EU_SA_13Engine(); });

  it('seed loads all 13 indicators', () => {
    e.seed();
    expect(e.getLatestSemi()).toBeDefined();
    expect(e.getLatestKRBond()).toBeDefined();
    expect(e.getLatestConsumer()).toBeDefined();
    expect(e.getLatestExportOrder()).toBeDefined();
    expect(e.getLatestElectronics()).toBeDefined();
    expect(e.getLatestM1B()).toBeDefined();
    expect(e.getLatestEUPMI()).toBeDefined();
    expect(e.getLatestZEW()).toBeDefined();
    expect(e.getLatestEUInf()).toBeDefined();
    expect(e.getLatestBankLend()).toBeDefined();
    expect(e.getLatestOil()).toBeDefined();
    expect(e.getLatestSAForex()).toBeDefined();
    expect(e.getLatestSAPMI()).toBeDefined();
  });

  it('KR Semi cycle detection', () => {
    e.seed(); const a = e.analyzeSemi();
    expect(a.export).toBeGreaterThan(0);
    expect(a.cycle).toBeTruthy();
  });

  it('KR Bond carry trade metric', () => {
    e.seed(); const a = e.analyzeKRBond();
    expect(a.holdings).toBeGreaterThan(100);
  });

  it('KR Consumer CCS index', () => {
    e.seed(); const a = e.analyzeConsumer();
    expect(a.ccs).toBeGreaterThan(70);
  });

  it('TW Export orders YoY', () => {
    e.seed(); const a = e.analyzeExportOrder();
    expect(a.orders).toBeGreaterThan(30);
  });

  it('TW Electronics foundry utilization', () => {
    e.seed(); const a = e.analyzeElectronics();
    expect(a.foundryUtil).toBeGreaterThan(50);
  });

  it('TW M1B golden cross detection', () => {
    e.seed(); const a = e.analyzeM1B();
    expect(typeof a.goldenCross).toBe('boolean');
  });

  it('EU PMI country breakdown', () => {
    e.seed(); const a = e.analyzeEUPMI();
    expect(a.best).toBeTruthy();
    expect(a.recessionProb).toBeGreaterThanOrEqual(0);
  });

  it('EU ZEW outlook', () => {
    e.seed(); const a = e.analyzeZEW();
    expect(a.outlook).toBeTruthy();
    expect(typeof a.index).toBe('number');
  });

  it('EU Inflation ECB action', () => {
    e.seed(); const a = e.analyzeEUInf();
    expect(a.ecbAction).toBeTruthy();
    expect(a.fiveY5Y).toBeGreaterThan(1);
  });

  it('EU Bank lending credit impulse', () => {
    e.seed(); const a = e.analyzeBankLend();
    expect(a.corporate).toBeDefined();
    expect(typeof a.creditImpulse).toBe('number');
  });

  it('SA Oil fiscal surplus ratio', () => {
    e.seed(); const a = e.analyzeOil();
    expect(a.brent).toBeGreaterThan(50);
  });

  it('SA SAR peg health', () => {
    e.seed(); const a = e.analyzeSAForex();
    expect(a.pegHealth).toBeGreaterThan(0);
    expect(a.pegPressure).toBeTruthy();
  });

  it('SA PMI non-oil', () => {
    e.seed(); const a = e.analyzeSAPMI();
    expect(a.pmi).toBeGreaterThan(45);
    expect(a.nonOil).toBeGreaterThan(0);
  });

  it('Dashboards return data', () => {
    e.seed();
    expect(e.getKR_Dashboard().semi).toBeDefined();
    expect(e.getTW_Dashboard().export).toBeDefined();
    expect(e.getEU_Dashboard().pmi).toBeDefined();
    expect(e.getSA_Dashboard().oil).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// GlobalPerfOptimizer
// ═══════════════════════════════════════════════

describe('GlobalPerfOptimizer', () => {
  let e: GlobalPerfOptimizer;
  beforeEach(() => { resetGlobalPerfOptimizer(); e = getGlobalPerfOptimizer(); });

  it('cache set/get works', () => {
    e.cacheSet('test', { value: 42 });
    expect(e.cacheGet('test')).toEqual({ value: 42 });
    expect(e.cacheSize()).toBe(1);
  });

  it('cache TTL expires', async () => {
    e.cacheSet('ephemeral', 'data', 10);
    await new Promise(r => setTimeout(r, 15));
    expect(e.cacheGet('ephemeral')).toBeUndefined();
  });

  it('cache delete removes entry', () => {
    e.cacheSet('x', 1);
    expect(e.cacheDelete('x')).toBe(true);
    expect(e.cacheGet('x')).toBeUndefined();
  });

  it('cache invalidateByPrefix', () => {
    e.cacheSet('quote:AAPL', 100);
    e.cacheSet('quote:TSLA', 200);
    e.cacheSet('news:XYZ', 300);
    const removed = e.cacheInvalidatePrefix('quote:');
    expect(removed).toBe(2);
    expect(e.cacheSize()).toBe(1);
  });

  it('cache stats track hits/misses', () => {
    e.cacheSet('a', 1);
    e.cacheGet('a');
    e.cacheGet('b');
    const snap = e.snapshot();
    expect(snap.cacheHits).toBe(1);
    expect(snap.cacheMisses).toBe(1);
    expect(snap.cacheHitRate).toBe(0.5);
  });

  it('batch executor runs batch', async () => {
    const batcher = e.createBatcher<number, number>('doubler', async (nums) => nums.map(n => n * 2));
    const results = await Promise.all([batcher(5), batcher(10)]);
    expect(results).toEqual([10, 20]);
  });

  it('subscription throttler deduplicates emits', () => {
    const calls: number[] = [];
    const unsub = e.throttleSubscribe('test', ['AAPL'], (d: any) => calls.push(d), 500);
    e.throttleEmit('test', 1);
    e.throttleEmit('test', 2); // should be throttled
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe(1);
    unsub();
  });

  it('memoize caches results', () => {
    let execCount = 0;
    const fn = e.memoize((a: number, b: number) => { execCount++; return a + b; }, { ttlMs: 10000 });
    expect(fn(1, 2)).toBe(3); expect(execCount).toBe(1);
    expect(fn(1, 2)).toBe(3); expect(execCount).toBe(1); // cached
    expect(fn(3, 4)).toBe(7); expect(execCount).toBe(2); // new args
  });

  it('gc collects expired entries', async () => {
    e.cacheSet('old', 'data', 5); // expires after 5ms
    expect(e.cacheSize()).toBe(1);
    await new Promise(r => setTimeout(r, 10)); // wait for expiry
    const removed = e.gc();
    expect(e.cacheSize()).toBe(0); // cache should be empty after GC
  });
});
