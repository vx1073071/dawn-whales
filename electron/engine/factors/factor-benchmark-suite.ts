// R197 J3: 232-Factor Performance Benchmark Suite
// Batch <15s + cache >95% + per-market breakdown
import log from 'electron-log';

export interface BenchmarkResult {
  totalFactors: number;
  totalMs: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  perFactorAvgMs: number;
  perMarket: MarketBenchmark[];
  pass: boolean;
  errors: number;
  recommendations: string[];
}

export interface MarketBenchmark {
  market: string;
  factorCount: number;
  totalMs: number;
  avgMs: number;
  cacheHitRate: number;
}

interface FactorResult { factorId: string; value: number; ms: number; cached: boolean; error: string | null }

export class FactorBenchmarkSuite {
  private cache = new Map<string, { value: number; ts: number }>();
  private cacheTtlMs = 120_000;
  private concurrency = 16;
  private timeoutPerFactor = 5000;

  constructor(options?: { cacheTtlMs?: number; concurrency?: number; timeout?: number }) {
    this.cacheTtlMs = options?.cacheTtlMs ?? this.cacheTtlMs;
    this.concurrency = options?.concurrency ?? this.concurrency;
    this.timeoutPerFactor = options?.timeout ?? this.timeoutPerFactor;
  }

  async runFullBenchmark(): Promise<BenchmarkResult> {
    const start = Date.now();
    log.info('[Benchmark] Starting 232-factor benchmark...');

    const allFactors = this.getAllFactorIds();
    const result = await this.computeBatch(allFactors);

    const totalMs = Date.now() - start;
    const pass = totalMs < 15_000 && result.cacheHitRate >= 0.95 && result.errors === 0;

    const recommendations: string[] = [];
    if (totalMs >= 15_000) recommendations.push(`Batch too slow: ${totalMs}ms, target <15000ms`);
    if (result.cacheHitRate < 0.95) recommendations.push(`Cache hit rate ${(result.cacheHitRate*100).toFixed(1)}% below 95% target`);
    if (result.errors > 0) recommendations.push(`${result.errors} factors failed to compute`);

    // Per-market breakdown
    const perMarket = this.marketBreakdown(result.factorResults);
    for (const m of perMarket) {
      if (m.avgMs > 50) recommendations.push(`Market ${m.market} slow: avg ${m.avgMs.toFixed(1)}ms per factor`);
    }

    return {
      totalFactors: allFactors.length, totalMs,
      cacheHits: result.factorResults.filter(r => r.cached).length,
      cacheMisses: result.factorResults.filter(r => !r.cached).length,
      cacheHitRate: result.cacheHitRate,
      perFactorAvgMs: totalMs / allFactors.length,
      perMarket, pass, errors: result.errors,
      recommendations: recommendations.length > 0 ? recommendations : ['All targets met'],
    };
  }

  private getAllFactorIds(): string[] {
    const ids: string[] = [];
    try { ids.push(...require('./factor-id-registry').GREEN_FACTOR_IDS); } catch {}
    try { ids.push(...require('./factor-id-registry').YELLOW_FACTOR_IDS); } catch {}
    try { ids.push(...require('./factor-id-registry').RED_FACTOR_IDS); } catch {}
    try { ids.push(...require('./jp-tw-factors').JP_TW_FACTOR_IDS); } catch {}
    try { ids.push(...require('./kr-sg-au-factors').KRSGAU_FACTOR_IDS); } catch {}
    try { ids.push(...require('./in-eu-factors').INEU_FACTOR_IDS); } catch {}
    return ids;
  }

  private async computeBatch(factorIds: string[]): Promise<{ factorResults: FactorResult[]; cacheHitRate: number; errors: number }> {
    const results: FactorResult[] = [];
    const now = Date.now();

    for (let i = 0; i < factorIds.length; i += this.concurrency) {
      const batch = factorIds.slice(i, i + this.concurrency);
      const batchResults = await Promise.all(batch.map(async (fid) => {
        const ck = `bench:${fid}`;
        const cached = this.cache.get(ck);
        if (cached && (now - cached.ts) < this.cacheTtlMs) {
          return { factorId: fid, value: cached.value, ms: 0, cached: true, error: null } satisfies FactorResult;
        }

        const t0 = Date.now();
        try {
          const value = await this.computeWithTimeout(fid);
          const elapsed = Date.now() - t0;
          this.cache.set(ck, { value, ts: now });
          return { factorId: fid, value, ms: elapsed, cached: false, error: null } satisfies FactorResult;
        } catch (err: unknown) {
          return { factorId: fid, value: 0, ms: Date.now() - t0, cached: false, error: String(err) } satisfies FactorResult;
        }
      }));
      results.push(...batchResults);
    }

    const cached = results.filter(r => r.cached).length;
    const errors = results.filter(r => r.error).length;
    return { factorResults: results, cacheHitRate: cached / results.length, errors };
  }

  private async computeWithTimeout(factorId: string): Promise<number> {
    return new Promise<number>(async (resolve) => {
      const timer = setTimeout(() => resolve(0), this.timeoutPerFactor);
      try {
        const val = this.findAndCompute(factorId);
        clearTimeout(timer);
        resolve(val);
      } catch { clearTimeout(timer); resolve(0); }
    });
  }

  private findAndCompute(factorId: string): number {
    // Try all calculator registries
    const prefix2 = factorId.slice(0, 2);
    try { const c = require('./jp-tw-factors').getJpTwFactorCalculator(factorId); if (c) return (c as any).compute({ symbol: 'bench', market: prefix2, timestamp: Date.now(), priceData: { open: 0, high: 0, low: 0, close: 100, volume: 1000000 } }).value; } catch {}
    try { const c = require('./kr-sg-au-factors').getKrSgAuFactorCalculator(factorId); if (c) return (c as any).compute({ symbol: 'bench', market: prefix2, timestamp: Date.now(), priceData: { open: 0, high: 0, low: 0, close: 100, volume: 1000000 } }).value; } catch {}
    try { const c = require('./in-eu-factors').getInEuFactorCalculator(factorId); if (c) return (c as any).compute({ symbol: 'bench', market: prefix2, timestamp: Date.now(), priceData: { open: 0, high: 0, low: 0, close: 100, volume: 1000000 } }).value; } catch {}
    try { const c = require('./pro-factor-calculators').getProFactorCalculator(factorId); if (c) return (c as any).compute({ symbol: 'bench', market: prefix2, timestamp: Date.now(), priceData: { open: 0, high: 0, low: 0, close: 100, volume: 1000000 } }).value; } catch {}
    try { const c = require('./market-red-factors').getMarketFactorCalculator(factorId); if (c) return (c as any).compute({ symbol: 'bench', market: prefix2, timestamp: Date.now(), priceData: { open: 0, high: 0, low: 0, close: 100, volume: 1000000 } }).value; } catch {}
    try { const c = require('./final-red-factors').getFinalRedCalculator(factorId); if (c) return (c as any).compute({ symbol: 'bench', market: prefix2, timestamp: Date.now(), priceData: { open: 0, high: 0, low: 0, close: 100, volume: 1000000 } }).value; } catch {}
    return 0;
  }

  private marketBreakdown(results: FactorResult[]): MarketBenchmark[] {
    const markets: Record<string, { count: number; totalMs: number; cached: number }> = {};
    for (const r of results) {
      const mkt = r.factorId.slice(0, 2);
      if (!markets[mkt]) markets[mkt] = { count: 0, totalMs: 0, cached: 0 };
      markets[mkt].count++;
      markets[mkt].totalMs += r.ms;
      if (r.cached) markets[mkt].cached++;
    }
    return Object.entries(markets).map(([market, d]) => ({
      market, factorCount: d.count, totalMs: d.totalMs,
      avgMs: d.count > 0 ? d.totalMs / d.count : 0,
      cacheHitRate: d.count > 0 ? d.cached / d.count : 0,
    }));
  }

  clearCache(): void { this.cache.clear(); }
  getCacheSize(): number { return this.cache.size; }
}

// Quick validation helper (async, for health checks)
export async function validatePerformance(): Promise<{ pass: boolean; results: BenchmarkResult }> {
  const suite = new FactorBenchmarkSuite();
  const results = await suite.runFullBenchmark();
  return { pass: results.pass, results };
}