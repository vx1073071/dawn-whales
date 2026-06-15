// R190 J3: Factor Batch Compute — parallel computation + cache warmup for 68 yellow factors
// Optimizes factor calculation pipeline: batch processing, concurrent execution, warm caches.
// Target: all 68 yellow factors computed <10s.
import type { FactorId } from './factor-id-registry';
import type { FactorInput, FactorOutput } from './factor-calculator';

export interface BatchComputeRequest {
  /** Factor IDs to compute */
  factorIds: FactorId[];
  /** Input data for all symbols */
  inputs: FactorInput[];
  /** Max concurrency (default: 8) */
  concurrency?: number;
  /** Enable cache lookup before compute */
  useCache?: boolean;
  /** Timeout per factor (ms, default: 500) */
  perFactorTimeoutMs?: number;
}

export interface BatchComputeResult {
  /** All computed outputs */
  outputs: FactorOutput[];
  /** Cache hit rate */
  cacheHitRate: number;
  /** Total compute time (ms) */
  totalTimeMs: number;
  /** Per-factor compute times */
  perFactorTimes: { factorId: FactorId; timeMs: number; cached: boolean }[];
  /** Errors (non-fatal per factor) */
  errors: { factorId: FactorId; error: string }[];
}

export interface BatchCacheEntry {
  factorId: FactorId;
  symbol: string;
  output: FactorOutput;
  timestamp: number;
}

export interface BatchComputeConfig {
  /** Default concurrency */
  defaultConcurrency?: number;
  /** Cache TTL (ms) */
  cacheTtlMs?: number;
  /** Max cache entries */
  maxCacheEntries?: number;
  /** Enable automatic cache warming */
  autoWarmup?: boolean;
  /** Warmup factor subset (top N by usage) */
  warmupTopN?: number;
}

export class FactorBatchCompute {
  private config: Required<BatchComputeConfig>;
  private cache = new Map<string, BatchCacheEntry>();
  private warmupDone = false;
  private factorUsageCounter = new Map<FactorId, number>();

  constructor(config: BatchComputeConfig = {}) {
    this.config = {
      defaultConcurrency: config.defaultConcurrency ?? 8,
      cacheTtlMs: config.cacheTtlMs ?? 300_000, // 5 min
      maxCacheEntries: config.maxCacheEntries ?? 10_000,
      autoWarmup: config.autoWarmup ?? true,
      warmupTopN: config.warmupTopN ?? 10,
    };
  }

  /** Run batch compute for multiple factors across symbols */
  async computeBatch(request: BatchComputeRequest): Promise<BatchComputeResult> {
    const t0 = Date.now();
    const concurrency = request.concurrency ?? this.config.defaultConcurrency;
    const useCache = request.useCache ?? true;
    const timeoutMs = request.perFactorTimeoutMs ?? 500;

    const outputs: FactorOutput[] = [];
    const perFactorTimes: BatchComputeResult['perFactorTimes'] = [];
    const errors: BatchComputeResult['errors'] = [];
    let cacheHits = 0;
    let totalCacheLookups = 0;

    // Sort factors by usage frequency (hot ones first) for cache locality
    const sortedFactors = [...request.factorIds].sort(
      (a, b) => (this.factorUsageCounter.get(b) ?? 0) - (this.factorUsageCounter.get(a) ?? 0)
    );

    // Process in parallel batches
    const batches = this.chunk(sortedFactors, concurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(async (factorId) => {
        const ft0 = Date.now();
        let cached = false;
        try {
          // Check cache first
          if (useCache) {
            for (const input of request.inputs) {
              totalCacheLookups++;
              const cacheKey = this.cacheKey(factorId, input.symbol);
              const cachedEntry = this.cache.get(cacheKey);
              if (cachedEntry && Date.now() - cachedEntry.timestamp < this.config.cacheTtlMs) {
                outputs.push(cachedEntry.output);
                cacheHits++;
                cached = true;
              }
            }
          }

          // Compute if not cached
          if (!cached) {
            const result = await this.computeSingleFactorWithTimeout(factorId, request.inputs, timeoutMs);
            outputs.push(...result.outputs);

            // Store in cache
            for (const out of result.outputs) {
              this.cache.set(this.cacheKey(factorId, out.symbol), {
                factorId, symbol: out.symbol, output: out, timestamp: Date.now(),
              });
            }
            this.evictIfNeeded();
          }

          // Track usage
          this.factorUsageCounter.set(factorId, (this.factorUsageCounter.get(factorId) ?? 0) + 1);

          perFactorTimes.push({ factorId, timeMs: Date.now() - ft0, cached });
        } catch (e) {
          errors.push({ factorId, error: (e as Error).message });
          perFactorTimes.push({ factorId, timeMs: Date.now() - ft0, cached: false });
        }
      });
      await Promise.allSettled(batchPromises);
    }

    // Evict expired entries
    this.evictExpired();

    return {
      outputs,
      cacheHitRate: totalCacheLookups > 0 ? cacheHits / totalCacheLookups : 0,
      totalTimeMs: Date.now() - t0,
      perFactorTimes,
      errors,
    };
  }

  /** Warm up cache for frequently used factors */
  async warmup(factorIds: FactorId[], inputs: FactorInput[]): Promise<void> {
    // Sort by usage and take top N
    const topFactors = factorIds
      .sort((a, b) => (this.factorUsageCounter.get(b) ?? 0) - (this.factorUsageCounter.get(a) ?? 0))
      .slice(0, this.config.warmupTopN);

    if (topFactors.length === 0) return;

    // Background warmup: compute all top factors for all inputs
    await this.computeBatch({
      factorIds: topFactors,
      inputs,
      concurrency: this.config.defaultConcurrency,
      useCache: false, // Force fresh computation
    });

    this.warmupDone = true;
  }

  /** Check if warmup has been done */
  isWarmupDone(): boolean {
    return this.warmupDone;
  }

  /** Get cache stats */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return { size: this.cache.size, maxSize: this.config.maxCacheEntries, hitRate: 0 };
  }

  /** Get most frequently used factors */
  getTopFactors(n: number = 10): { factorId: FactorId; count: number }[] {
    const entries = Array.from(this.factorUsageCounter.entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, n).map(([factorId, count]) => ({ factorId, count }));
  }

  /** Clear all caches */
  clearAll(): void {
    this.cache.clear();
    this.warmupDone = false;
  }

  /** Estimate compute time for N factors */
  estimateComputeTime(factorCount: number): { bestMs: number; worstMs: number } {
    const perFactorMs = 100; // ~100ms per factor
    const batches = Math.ceil(factorCount / this.config.defaultConcurrency);
    const bestMs = batches * perFactorMs;
    const worstMs = factorCount * perFactorMs;
    return { bestMs, worstMs };
  }

  private async computeSingleFactorWithTimeout(
    factorId: FactorId,
    inputs: FactorInput[],
    timeoutMs: number,
  ): Promise<{ outputs: FactorOutput[] }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('Timeout computing ' + factorId)); }
      }, timeoutMs);

      try {
        const outputs = inputs.map(input => this.mockCompute(factorId, input));
        if (!settled) { settled = true; clearTimeout(timer); resolve({ outputs }); }
      } catch (e) {
        if (!settled) { settled = true; clearTimeout(timer); reject(e); }
      }
    });
  }

  private mockCompute(factorId: FactorId, input: FactorInput): FactorOutput {
    // Placeholder: real computation delegates to factor calculators
    return {
      factorId,
      symbol: input.symbol,
      value: 0,
      zScore: 0,
      percentile: 0.5,
      confidence: 0.8,
      label: 'Batch computed — ' + factorId,
      timestamp: Date.now(),
    };
  }

  private cacheKey(factorId: FactorId, symbol: string): string {
    return factorId + '::' + symbol;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.config.maxCacheEntries) return;
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - this.config.maxCacheEntries);
    for (const [key] of toRemove) this.cache.delete(key);
  }

  private evictExpired(): void {
    const now = Date.now();
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && now - entry.timestamp > this.config.cacheTtlMs) {
        this.cache.delete(key);
      }
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  }
}

// Singleton
let defaultBatch: FactorBatchCompute | null = null;
export function getFactorBatchCompute(config?: BatchComputeConfig): FactorBatchCompute {
  if (!defaultBatch) defaultBatch = new FactorBatchCompute(config);
  return defaultBatch;
}
export function resetFactorBatchCompute(): void { defaultBatch = null; }