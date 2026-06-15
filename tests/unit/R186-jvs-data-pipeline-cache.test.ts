// R186 JVS Tests: DataProvider + Preprocessor + Cache Layer
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HKDataAdapter,
  USDataAdapter,
  CryptoDataAdapter,
  FactorDataProviderV2,
  getFactorDataProviderV2,
  resetFactorDataProviderV2,
} from '../../electron/engine/factors/factor-data-provider-v2';
import {
  FactorPreprocessorV1,
  WINSORIZE_STEP,
  MIN_MAX_SCALE_STEP,
} from '../../electron/engine/factors/factor-preprocessor-v1';
import {
  FactorCacheLayer,
  TypedFactorCache,
  getFactorCache,
  resetFactorCache,
} from '../../electron/engine/factors/factor-cache-layer';

describe('FactorDataProviderV2', () => {
  beforeEach(() => resetFactorDataProviderV2());

  it('should create provider with 3 adapters', () => {
    const provider = getFactorDataProviderV2();
    const markets = provider.getAvailableMarkets();
    expect(markets).toEqual(['HK', 'US', 'CRYPTO']);
    expect(provider.getAdapter('HK')).toBeInstanceOf(HKDataAdapter);
    expect(provider.getAdapter('US')).toBeInstanceOf(USDataAdapter);
    expect(provider.getAdapter('CRYPTO')).toBeInstanceOf(CryptoDataAdapter);
  });

  it('HKDataAdapter should fetch price data for symbols', async () => {
    const adapter = new HKDataAdapter();
    const result = await adapter.fetchData({ market: 'HK', symbols: ['0700.HK', '0388.HK'], lookbackDays: 20 });
    expect(result.inputs.length).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(result.market).toBe('HK');
    expect(result.inputs[0].priceData.close).toBeGreaterThan(0);
    expect(result.inputs[0].fundamental?.eps).toBeDefined();
  });

  it('HKDataAdapter should have price history in extra', async () => {
    const adapter = new HKDataAdapter();
    const result = await adapter.fetchData({ market: 'HK', symbols: ['0700.HK'], lookbackDays: 30 });
    const history = result.inputs[0].extra?.priceHistory as any[];
    expect(history).toBeDefined();
    expect(history!.length).toBeGreaterThanOrEqual(25);
  });

  it('USDataAdapter should fetch fundamental data', async () => {
    const adapter = new USDataAdapter();
    const result = await adapter.fetchData({ market: 'US', symbols: ['AAPL', 'TSLA'] });
    expect(result.inputs.length).toBe(2);
    expect(result.inputs[0].fundamental?.roe).toBeGreaterThan(0);
    expect(result.inputs[0].fundamental?.grossMargin).toBeGreaterThan(0);
  });

  it('CryptoDataAdapter should fetch on-chain data', async () => {
    const adapter = new CryptoDataAdapter();
    const result = await adapter.fetchData({ market: 'CRYPTO', symbols: ['BTC-USDT', 'ETH-USDT'], includeOnChain: true });
    expect(result.inputs.length).toBe(2);
    expect(result.inputs[0].onChain?.mvrv).toBeDefined();
    expect(result.inputs[0].onChain?.nvt).toBeDefined();
    expect(result.inputs[0].onChain?.activeAddresses).toBeGreaterThan(0);
    expect(result.inputs[0].onChain?.exchangeNetFlow).toBeDefined();
  });

  it('should handle missing symbol gracefully', async () => {
    const adapter = new HKDataAdapter();
    const result = await adapter.fetchData({ market: 'HK', symbols: ['0700.HK', 'INVALID'] });
    expect(result.inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('should fetch all 3 markets in parallel', async () => {
    const provider = getFactorDataProviderV2();
    const results = await provider.fetchAllMarkets({
      HK: ['0700.HK'],
      US: ['AAPL'],
      CRYPTO: ['BTC-USDT'],
    });
    expect(results.length).toBe(3);
    expect(results.every(r => r.errors.length === 0)).toBe(true);
  });

  it('should return supported factors per market', () => {
    const provider = getFactorDataProviderV2();
    expect(provider.getSupportedFactors('HK').length).toBeGreaterThan(5);
    expect(provider.getSupportedFactors('US').length).toBeGreaterThan(5);
    expect(provider.getSupportedFactors('CRYPTO').length).toBeGreaterThan(3);
  });
});

describe('FactorPreprocessorV1', () => {
  it('should return same length of valid data', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 101, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const result = FactorPreprocessorV1.quickPreprocess(values);
    expect(result.values.length).toBeGreaterThanOrEqual(values.length - 1);
  });

  it('should detect and clip outliers via MAD', () => {
    const values = new Array(50).fill(0).map((_, i) => i + 1);
    values[0] = 1000; // Extreme outlier
    values[1] = -500;
    const result = FactorPreprocessorV1.quickPreprocess(values);
    expect(result.outliersDetected).toBeGreaterThanOrEqual(1);
    // After clipping, extremes should be closer to median
    expect(Math.max(...result.values)).toBeLessThan(1000);
  });

  it('should remove NaN and Infinity', () => {
    const values = [1, 2, NaN, 4, Infinity, 6, -Infinity, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const result = FactorPreprocessorV1.quickPreprocess(values);
    expect(result.stats.missingCount).toBeGreaterThan(0);
    expect(result.values.every(v => isFinite(v) && !isNaN(v))).toBe(true);
  });

  it('should return z-score normalized values', () => {
    const values = new Array(100).fill(0).map((_, i) => i * 10);
    const result = FactorPreprocessorV1.quickPreprocess(values);
    expect(Math.abs(result.processedMean)).toBeLessThan(0.1);
    expect(Math.abs(result.processedStdDev - 1)).toBeLessThan(0.1);
  });

  it('should handle insufficient data', () => {
    const values = [1, 2, 3];
    const result = FactorPreprocessorV1.quickPreprocess(values);
    expect(result.appliedSteps).toEqual(['clean']);
  });

  it('should apply winsorize custom step', () => {
    const ppl = new FactorPreprocessorV1({ customSteps: [WINSORIZE_STEP] });
    const values = new Array(100).fill(0).map((_, i) => i);
    values[0] = -999;
    values[99] = 9999;
    const result = ppl.preprocess(values);
    expect(result.appliedSteps).toContain('winsorize');
    expect(result.values[0]).toBeGreaterThan(-999);
    expect(result.values[99]).toBeLessThan(9999);
  });

  it('should handle min-max scaling', () => {
    const ppl = new FactorPreprocessorV1({ enableMAD: false, enableZScore: false, customSteps: [MIN_MAX_SCALE_STEP] });
    const values = [0, 50, 100];
    const result = ppl.preprocess(values);
    expect(result.values[0]).toBeCloseTo(0, 1);
    expect(result.values[2]).toBeCloseTo(1, 1);
  });

  it('should compute correct statistics', () => {
    const values = [10, 20, 30, 40, 50];
    const stats = FactorPreprocessorV1.computeStats(values);
    expect(stats.mean).toBeCloseTo(30, 0);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.median).toBe(30);
    expect(stats.q1).toBeGreaterThan(10);
    expect(stats.q3).toBeLessThan(50);
  });
});

describe('FactorCacheLayer', () => {
  let cache: FactorCacheLayer;

  beforeEach(() => {
    cache = new FactorCacheLayer({ ttlMs: 60_000, maxEntries: 100 });
  });

  it('should store and retrieve values', () => {
    const key = cache.buildKey('factor-result', 'EP_RATIO', 'HK', '0700.HK');
    cache.set(key, { score: 0.85, confidence: 0.9 });
    const value = cache.get(key);
    expect(value).toEqual({ score: 0.85, confidence: 0.9 });
  });

  it('should return undefined for miss', () => {
    const key = cache.buildKey('factor-result', 'EP_RATIO', 'HK', 'NONEXIST');
    const value = cache.get(key);
    expect(value).toBeUndefined();
  });

  it('should expire entries after TTL', async () => {
    const shortCache = new FactorCacheLayer({ ttlMs: 10, maxEntries: 10 });
    const key = shortCache.buildKey('factor-result', 'EP_RATIO', 'US', 'AAPL');
    shortCache.set(key, { value: 1 });
    expect(shortCache.get(key)).toEqual({ value: 1 });
    await new Promise(r => setTimeout(r, 15));
    expect(shortCache.get(key)).toBeUndefined();
  });

  it('should track hit/miss rates', () => {
    const key = cache.buildKey('factor-result', 'HML', 'US', 'AAPL');
    cache.set(key, { value: 1 });
    cache.get(key); // hit
    cache.get(key); // hit
    cache.get('bad:key'); // miss
    const stats = cache.getStats();
    expect(stats.totalHits).toBe(2);
    expect(stats.totalMisses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3, 1);
  });

  it('should invalidate by factor', () => {
    cache.set(cache.buildKey('factor-result', 'EP_RATIO', 'HK', 'S1'), { v: 1 });
    cache.set(cache.buildKey('factor-result', 'HML', 'HK', 'S2'), { v: 2 });
    const count = cache.invalidateFactor('EP_RATIO');
    expect(count).toBe(1);
    expect(cache.get(cache.buildKey('factor-result', 'EP_RATIO', 'HK', 'S1'))).toBeUndefined();
    expect(cache.get(cache.buildKey('factor-result', 'HML', 'HK', 'S2'))).toEqual({ v: 2 });
  });

  it('should invalidate by type', () => {
    cache.set(cache.buildKey('factor-result', 'EP_RATIO', 'HK', 'A'), { v: 1 });
    cache.set(cache.buildKey('ic-result', 'EP_RATIO'), { ic: 0.1 });
    const count = cache.invalidateType('factor-result');
    expect(count).toBe(1);
    expect(cache.get(cache.buildKey('ic-result', 'EP_RATIO'))).toEqual({ ic: 0.1 });
  });

  it('should evict LRU when max entries reached', () => {
    const tinyCache = new FactorCacheLayer({ maxEntries: 3, ttlMs: 60000 });
    for (let i = 0; i < 5; i++) {
      tinyCache.set('key' + i, { v: i });
    }
    expect(tinyCache.size).toBeLessThanOrEqual(3);
  });

  it('should report meetsHitRateTarget correctly', () => {
    const key = cache.buildKey('factor-result', 'HML', 'US', 'AAPL');
    cache.set(key, { v: 1 });
    // 99 hits, 1 miss = 99%
    for (let i = 0; i < 99; i++) cache.get(key);
    cache.get('miss');
    expect(cache.meetsHitRateTarget(0.9)).toBe(true);
  });

  it('should clear all data', () => {
    cache.set('k1', { v: 1 });
    cache.set('k2', { v: 2 });
    cache.clear();
    expect(cache.size).toBe(0);
    const stats = cache.getStats();
    expect(stats.totalHits).toBe(0);
  });
});

describe('TypedFactorCache', () => {
  beforeEach(() => {
    resetFactorCache();
  });

  it('should store and retrieve factor results by type', () => {
    const cache = getFactorCache();
    cache.setFactorResult('EP_RATIO', 'HK', '0700.HK', { symbol: '0700.HK', factorId: 'EP_RATIO', value: 0.85, zScore: 0.5, percentile: 70 } as any, 10000);
    const result = cache.getFactorResult('EP_RATIO', 'HK', '0700.HK');
    expect(result).toBeDefined();
    expect(result!.value).toBe(0.85);
  });

  it('should store and retrieve IC results', () => {
    const cache = getFactorCache();
    cache.setICResult('EP_RATIO', { factorId: 'EP_RATIO', ic: 0.12, signalLight: 'green' } as any, 10000);
    const result = cache.getICResult('EP_RATIO');
    expect(result).toBeDefined();
    expect(result!.ic).toBe(0.12);
    expect(result!.signalLight).toBe('green');
  });

  it('should verify hit rate target', () => {
    const cache = getFactorCache();
    expect(cache.meetsHitRateTarget()).toBe(true);
  });
});

describe('R186 Integration: DataProvider -> Preprocessor -> Cache', () => {
  it('should go full pipeline: fetch -> preprocess -> cache', async () => {
    resetFactorDataProviderV2();
    resetFactorCache();

    const provider = getFactorDataProviderV2();
    const result = await provider.fetchMarketData('HK', { market: 'HK', symbols: ['0700.HK', '0388.HK', '0005.HK'] });

    // Preprocess PE values
    const pp = new FactorPreprocessorV1();
    const peValues = result.inputs.map(inp => inp.priceData.close / (inp.fundamental?.eps ?? 1));
    const ppResult = pp.preprocess(peValues);

    expect(ppResult.values.length).toBeGreaterThanOrEqual(2);
    expect(ppResult.outliersDetected).toBeGreaterThanOrEqual(0);

    const cache = getFactorCache();
    cache.setCrossSection('EP_RATIO', 'HK', ppResult as any, 300_000);

    const cached = cache.getCrossSection('EP_RATIO', 'HK');
    expect(cached).toBeDefined();

    const stats = cache.getStats();
    expect(stats.hitRate).toBeGreaterThanOrEqual(0);
  });

  it('should show hit rate above 90% after warm-up', async () => {
    resetFactorCache();
    const cache = getFactorCache();

    // Warm up: 95 hits, 5 misses = 95%
    for (let i = 0; i < 95; i++) {
      cache.setFactorResult('HML', 'US', 'AAPL', { symbol: 'AAPL', factorId: 'HML', value: i * 0.01, zScore: 0, percentile: 50 } as any, 60_000);
      cache.getFactorResult('HML', 'US', 'AAPL');
    }
    for (let i = 0; i < 5; i++) {
      cache.getFactorResult('MISS', 'HK', 'MISS');
    }

    const stats = cache.getStats();
    expect(stats.hitRate).toBeGreaterThan(0.9);
    expect(cache.meetsHitRateTarget()).toBe(true);
  });
});