// R193 J2: 188-Factor Batch Performance Optimization
// Targets: batch compute <15s, parallel execution, cache hit rate >95%
import { FactorCalculator } from './factor-calculator';

export interface BatchJob {
  factorId: string; calculator: FactorCalculator;
  input: import('./factor-calculator').FactorInput;
  priority?: number;
}

export interface BatchResult {
  factorId: string; value: number; rawValue?: number;
  elapsedMs: number; cached: boolean; error?: string;
}

export interface BatchStats {
  totalJobs: number; completed: number; failed: number;
  cacheHits: number; cacheMisses: number;
  totalMs: number; avgMs: number; p95Ms: number; p99Ms: number;
  cacheHitRate: number;
}

interface CacheEntry { result: BatchResult; timestamp: number; }

export class FactorBatchOptimizer {
  private cache = new Map<string, CacheEntry>();
  private cacheTTL: number;
  private maxCacheSize: number;
  private concurrency: number;
  private factorTimeoutMs: number;

  constructor(options?: { cacheTTL?: number; maxCacheSize?: number; concurrency?: number; timeoutMs?: number; }) {
    this.cacheTTL = options?.cacheTTL ?? 300_000; // 5 min
    this.maxCacheSize = options?.maxCacheSize ?? 5000;
    this.concurrency = Math.min(options?.concurrency ?? 8, 16);
    this.factorTimeoutMs = options?.timeoutMs ?? 5000;
  }

  async computeBatch(jobs: BatchJob[]): Promise<{ results: BatchResult[]; stats: BatchStats }> {
    const t0 = performance.now();
    const sorted = jobs.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    // Split into cached vs cold
    const cached: BatchResult[] = [];
    const coldJobs: BatchJob[] = [];

    for (const job of sorted) {
      const key = this.cacheKey(job.factorId, job.input.symbol);
      const hit = this.cache.get(key);
      if (hit && (Date.now() - hit.timestamp) < this.cacheTTL) {
        cached.push({ ...hit.result, cached: true });
      } else {
        coldJobs.push(job);
      }
    }

    // Parallel compute cold jobs in batches
    const coldResults: BatchResult[] = [];
    for (let i = 0; i < coldJobs.length; i += this.concurrency) {
      const chunk = coldJobs.slice(i, i + this.concurrency);
      const tChunk = performance.now();
      const promises = chunk.map(job => this.computeWithTimeout(job));
      const chunkResults = await Promise.all(promises);
      coldResults.push(...chunkResults);
    }

    const all = [...cached, ...coldResults];
    const failed = all.filter(r => r.error).length;
    const timings = all.map(r => r.elapsedMs).sort((a,b) => a - b);
    const totalMs = performance.now() - t0;

    const stats: BatchStats = {
      totalJobs: jobs.length, completed: all.length - failed, failed,
      cacheHits: cached.length, cacheMisses: coldJobs.length,
      totalMs, avgMs: all.length > 0 ? timings.reduce((a,b)=>a+b,0)/all.length : 0,
      p95Ms: this.percentile(timings, 0.95), p99Ms: this.percentile(timings, 0.99),
      cacheHitRate: jobs.length > 0 ? cached.length / jobs.length : 0,
    };
    return { results: all, stats };
  }

  async warmupCache(jobs: BatchJob[]): Promise<void> {
    const topN = jobs.sort((a,b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 200);
    await this.computeBatch(topN);
  }

  invalidateCache(factorId?: string, symbol?: string): void {
    if (factorId && symbol) {
      this.cache.delete(this.cacheKey(factorId, symbol));
    } else if (factorId) {
      const keys = Array.from(this.cache.keys());
      for (const k of keys) { if (k.startsWith(factorId + ':')) this.cache.delete(k); }
    } else {
      this.cache.clear();
    }
  }

  getCacheStats(): { size: number; hitRate: number } {
    return { size: this.cache.size, hitRate: 0 };
  }

  getCacheSize(): number { return this.cache.size; }

  private async computeWithTimeout(job: BatchJob): Promise<BatchResult> {
    const t0 = performance.now();
    try {
      const result = await Promise.race([
        this.computeAndCache(job),
        new Promise<BatchResult>((_, rej) => setTimeout(() => rej(new Error('timeout')), this.factorTimeoutMs)),
      ]);
      result.elapsedMs = performance.now() - t0;
      return result;
    } catch (e) {
      return { factorId: job.factorId, value: 0, elapsedMs: performance.now() - t0, cached: false, error: (e as Error).message };
    }
  }

  private async computeAndCache(job: BatchJob): Promise<BatchResult> {
    const t0 = performance.now();
    const output = (job.calculator as any).compute(job.input);
    const result: BatchResult = { factorId: job.factorId, value: output.value, rawValue: output.rawValue, elapsedMs: performance.now() - t0, cached: false };
    const key = this.cacheKey(job.factorId, job.input.symbol);
    this.cache.set(key, { result, timestamp: Date.now() });
    if (this.cache.size > this.maxCacheSize) this.evictOne();
    return result;
  }

  private evictOne(): void {
    const keys = Array.from(this.cache.keys());
    if (keys.length > 0) this.cache.delete(keys[0]); // LRU: oldest first
  }

  private cacheKey(factorId: string, symbol: string): string { return factorId + ':' + symbol; }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
  }
}

// 188-factor batch compute scheduler
export interface BatchScheduleConfig {
  maxFactorsPerBatch: number;
  cooldownMs: number;
  retryDelayMs: number;
  maxRetries: number;
}

export class BatchComputeScheduler {
  private optimizer: FactorBatchOptimizer;
  private config: BatchScheduleConfig;
  private lastBatchTime = 0;

  constructor(optimizer: FactorBatchOptimizer, config?: Partial<BatchScheduleConfig>) {
    this.optimizer = optimizer;
    this.config = { maxFactorsPerBatch: 64, cooldownMs: 100, retryDelayMs: 500, maxRetries: 2, ...config };
  }

  async scheduleAll(jobs: BatchJob[], onProgress?: (done: number, total: number) => void): Promise<{ results: BatchResult[]; stats: BatchStats }> {
    const allResults: BatchResult[] = [];
    let totalCached = 0, totalCold = 0;

    for (let i = 0; i < jobs.length; i += this.config.maxFactorsPerBatch) {
      const chunk = jobs.slice(i, i + this.config.maxFactorsPerBatch);
      if (i > 0) {
        const elapsed = Date.now() - this.lastBatchTime;
        if (elapsed < this.config.cooldownMs) {
          await new Promise(r => setTimeout(r, this.config.cooldownMs - elapsed));
        }
      }
      const { results, stats } = await this.optimizer.computeBatch(chunk);
      allResults.push(...results);
      totalCached += stats.cacheHits;
      totalCold += stats.cacheMisses;
      this.lastBatchTime = Date.now();
      onProgress?.(Math.min(i + this.config.maxFactorsPerBatch, jobs.length), jobs.length);
    }

    const finalStats: BatchStats = {
      totalJobs: jobs.length, completed: allResults.filter(r => !r.error).length,
      failed: allResults.filter(r => r.error).length,
      cacheHits: totalCached, cacheMisses: totalCold,
      totalMs: 0, avgMs: 0, p95Ms: 0, p99Ms: 0,
      cacheHitRate: jobs.length > 0 ? totalCached / jobs.length : 0,
    };
    return { results: allResults, stats: finalStats };
  }
}

export async function batchCompute188(
  optimizer: FactorBatchOptimizer,
  jobs: BatchJob[],
): Promise<boolean> {
  const scheduler = new BatchComputeScheduler(optimizer);
  const t0 = performance.now();
  const { stats } = await scheduler.scheduleAll(jobs);
  const elapsed = performance.now() - t0;
  return elapsed < 15000 && stats.cacheHitRate > 0.95;
}