// R197 J1: 10-Market Adapter Performance Optimizer
// Cache + parallel + rate limiting → 10-market concurrent <5s
import log from 'electron-log';

export interface AdapterCallStats {
  market: string;
  calls: number;
  cacheHits: number;
  totalMs: number;
  avgMs: number;
  throttled: number;
}

export interface BatchAdapterRequest {
  market: string;
  symbols: string[];
  dataTypes: string[];
  priority?: number;
}

export class MultiMarketAdapterOptimizer {
  private cache = new Map<string, { data: unknown; ts: number }>();
  private rateLimiters = new Map<string, RateLimiter>();
  private stats = new Map<string, AdapterCallStats>();
  private concurrency = 10;
  private cacheTtlMs = 120_000;
  private maxRps: Record<string, number> = {};

  constructor(options?: { concurrency?: number; cacheTtlMs?: number; maxRps?: Record<string, number> }) {
    this.concurrency = options?.concurrency ?? this.concurrency;
    this.cacheTtlMs = options?.cacheTtlMs ?? this.cacheTtlMs;
    this.maxRps = options?.maxRps ?? this.defaultRps();
  }

  private defaultRps(): Record<string, number> {
    return { JP: 5, TW: 5, KR: 5, SG: 5, AU: 5, IN: 3, EU: 3, HK: 10, US: 10, CC: 10 };
  }

  getAllMarkets(): string[] {
    return Object.keys(this.maxRps);
  }

  private getLimiter(market: string): RateLimiter {
    if (!this.rateLimiters.has(market)) {
      this.rateLimiters.set(market, new RateLimiter(this.maxRps[market] ?? 5));
    }
    return this.rateLimiters.get(market)!;
  }

  private cacheKey(market: string, symbol: string, dataType: string): string {
    return `${market}:${symbol}:${dataType}`;
  }

  async fetchAllMarkets(requests: BatchAdapterRequest[], fetchFn: (m: string, s: string[], d: string) => Promise<Map<string, Record<string, number>>>): Promise<Map<string, Map<string, Record<string, number>>>> {
    const start = Date.now();
    const results = new Map<string, Map<string, Record<string, number>>>();

    // Group requests by market
    const grouped = new Map<string, BatchAdapterRequest[]>();
    for (const req of requests) {
      if (!grouped.has(req.market)) grouped.set(req.market, []);
      grouped.get(req.market)!.push(req);
    }

    // Execute per-market with rate limiting
    const tasks = Array.from(grouped.entries()).map(async ([market, reqs]) => {
      const limiter = this.getLimiter(market);
      const marketResults = new Map<string, Record<string, number>>();

      for (const req of reqs) {
        const symbols = req.symbols;
        for (const dataType of req.dataTypes) {
          // Check cache first
          const cached: Record<string, number> = {};
          const uncached: string[] = [];
          for (const sym of symbols) {
            const key = this.cacheKey(market, sym, dataType);
            const entry = this.cache.get(key);
            if (entry && (Date.now() - entry.ts) < this.cacheTtlMs) {
              cached[sym] = entry.data as number;
              this.recordHit(market);
            } else {
              uncached.push(sym);
            }
          }

          // Fetch uncached with rate limiting
          if (uncached.length > 0) {
            await limiter.wait(uncached.length);
            const t0 = Date.now();
            const fresh = await fetchFn(market, uncached, dataType);
            const elapsed = Date.now() - t0;
            this.recordCall(market, elapsed);

            for (const [sym, vals] of Array.from(fresh.entries())) {
              for (const [k, v] of Object.entries(vals)) {
                const key = this.cacheKey(market, sym, dataType + '.' + k);
                this.cache.set(key, { data: v, ts: Date.now() });
              }
              if (!marketResults.has(sym)) marketResults.set(sym, {});
              Object.assign(marketResults.get(sym)!, vals);
            }
          }

          for (const [sym, val] of Object.entries(cached)) {
            if (!marketResults.has(sym)) marketResults.set(sym, {});
            marketResults.get(sym)![dataType] = val;
          }
        }
      }

      return { market, results: marketResults };
    });

    const all = await Promise.all(tasks);
    for (const { market, results: r } of all) {
      results.set(market, r);
    }

    log.info(`[MultiMarketOptimizer] ${requests.length} requests across ${grouped.size} markets in ${Date.now() - start}ms`);
    return results;
  }

  private recordHit(market: string): void {
    if (!this.stats.has(market)) this.initStat(market);
    this.stats.get(market)!.cacheHits++;
  }

  private recordCall(market: string, ms: number): void {
    if (!this.stats.has(market)) this.initStat(market);
    const s = this.stats.get(market)!;
    s.calls++; s.totalMs += ms; s.avgMs = s.totalMs / s.calls;
  }

  private initStat(market: string): void {
    this.stats.set(market, { market, calls: 0, cacheHits: 0, totalMs: 0, avgMs: 0, throttled: 0 });
  }

  getStats(): AdapterCallStats[] { return Array.from(this.stats.values()); }

  getCacheHitRate(): number {
    const stats = this.getStats();
    const total = stats.reduce((s, x) => s + x.calls + x.cacheHits, 0);
    const hits = stats.reduce((s, x) => s + x.cacheHits, 0);
    return total > 0 ? hits / total : 0;
  }

  clearCache(): void { this.cache.clear(); }
  getCacheSize(): number { return this.cache.size; }
  resetStats(): void { this.stats.clear(); }
}

// === Rate Limiter ===
class RateLimiter {
  private maxRps: number;
  private tokens: number;
  private lastRefill: number;

  constructor(maxRps: number) {
    this.maxRps = maxRps;
    this.tokens = maxRps;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxRps, this.tokens + elapsed * this.maxRps);
    this.lastRefill = now;
  }

  async wait(count: number): Promise<void> {
    this.refill();
    const needed = count - this.tokens;
    if (needed > 0) {
      const waitMs = (needed / this.maxRps) * 1000;
      await new Promise(r => setTimeout(r, waitMs));
      this.refill();
    }
    this.tokens -= count;
  }
}

// === Factory: Get all 7 market adapters ===
export function getAllMarketAdapters(): Record<string, { getSupportedFactorIds: () => string[]; fetchMarketData: Function; fetchFinancials: Function }> {
  const adapters: Record<string, any> = {};
  try { adapters.JP = new (require('./jpx-adapter').JpxMarketAdapter)(); } catch {}
  try { adapters.TW = new (require('./twse-adapter').TwseMarketAdapter)(); } catch {}
  try { adapters.KR = new (require('./krx-adapter').KrxMarketAdapter)(); } catch {}
  try { adapters.SG = new (require('./sgx-adapter').SgxMarketAdapter)(); } catch {}
  try { adapters.AU = new (require('./asx-adapter').AsxMarketAdapter)(); } catch {}
  try { adapters.IN = new (require('./nse-adapter').NseMarketAdapter)(); } catch {}
  try { adapters.EU = new (require('./stoxx-adapter').StoxxMarketAdapter)(); } catch {}
  return adapters;
}