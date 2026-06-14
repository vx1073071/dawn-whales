// ── R161 P0-U4: Factor Data Provider ──────────────────────────────────────
// Unified adapter layer for all factor data sources.
// Before: MultiFactorModel called 5 separate modules independently,
//         each with its own fetch/cache/error logic scattered across the class.
// After:  Single entry point: fetchFactors({symbol, period}) → FactorValues
//         Unified cache, degradation, error handling across all sources.
//
// Data sources covered:
//   1. Sentiment — market mood + NLP sentiment scoring
//   2. Capital Flow — main net inflow ranking
//   3. Institutional Flow — institutional/dragon-tiger board tracking
//   4. Fund Holdings — fund positions + increase ranking
//   5. Stock Diagnosis — fundamental grade + risk flags
//   6. Factor Research — IC/IR/exposure (from factor-research-engine)
//   7. Factor Exposure — Fama-French attribution (from factor-exposure)
//   8. Factor Compatibility — compatible factor filtering (from factor-compatibility-engine)
//   9. Factor Cloud — server-signed factor results (from factor-cloud-api)
//  10. Factor Asset Registry — asset-type factor subsets (from factor-asset-registry)

import log from 'electron-log';
import { type FactorId, resolveFactorId } from './factor-id-registry';
import { EngineError } from '../core/engine-error';

// ── Types ───────────────────────────────────────────────────────────────────

export type FactorSourceName =
  | 'sentiment'
  | 'capital_flow'
  | 'institutional_flow'
  | 'fund_holdings'
  | 'stock_diagnosis'
  | 'factor_research'
  | 'factor_exposure'
  | 'factor_compatibility'
  | 'factor_cloud'
  | 'factor_asset_registry';

export type FactorPeriod = '1d' | '5d' | '1m' | '3m' | '6m' | '1y';

export interface FactorValue {
  factorId: string;           // e.g., "MOM_12M", "sentiment"
  value: number;              // Raw factor value
  score: number;              // Normalized score (0-100)
  confidence: number;         // 0-1, how reliable is this value
  source: FactorSourceName;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface FactorValues {
  symbol: string;
  period: FactorPeriod;
  factors: Record<string, FactorValue>;  // factorId → FactorValue
  loadedAt: number;
  /** Which sources were available */
  sourcesAvailable: FactorSourceName[];
  /** Which sources degraded (returning defaults) */
  sourcesDegraded: FactorSourceName[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
}

export interface BatchFactorResult {
  symbols: FactorValues[];
  errors: Array<{ symbol: string; error: string }>;
  totalTimeMs: number;
}

export interface FactorDataProviderConfig {
  /** Default TTL for cached factor values (ms) */
  cacheTtlMs: Record<FactorSourceName, number>;
  /** Default value when a source is unavailable */
  defaultScore: number;
  /** Max concurrent fetches */
  maxConcurrency: number;
  /** Retry on failure */
  maxRetries: number;
  /** Retry delay base (ms, exponential backoff) */
  retryDelayMs: number;
  /** Enable perf logging */
  enablePerformanceLog: boolean;
}

// ── Default TTL per source ─────────────────────────────────────────────────

const DEFAULT_TTL: Record<FactorSourceName, number> = {
  sentiment: 60_000,               // 1 minute
  capital_flow: 120_000,           // 2 minutes
  institutional_flow: 120_000,     // 2 minutes
  fund_holdings: 300_000,          // 5 minutes (quarterly data)
  stock_diagnosis: 300_000,        // 5 minutes
  factor_research: 300_000,        // 5 minutes (daily IC computation)
  factor_exposure: 300_000,        // 5 minutes
  factor_compatibility: 600_000,   // 10 minutes (static definitions)
  factor_cloud: 120_000,           // 2 minutes
  factor_asset_registry: 600_000,  // 10 minutes
};

const DEFAULT_CONFIG: FactorDataProviderConfig = {
  cacheTtlMs: DEFAULT_TTL,
  defaultScore: 50,
  maxConcurrency: 5,
  maxRetries: 2,
  retryDelayMs: 200,
  enablePerformanceLog: false,
};

// ── Factor Data Provider ────────────────────────────────────────────────────

export class FactorDataProvider {
  private config: FactorDataProviderConfig;
  private cache = new Map<string, { data: FactorValues; expiresAt: number }>();
  private sourceCallbacks = new Map<FactorSourceName, (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>>();
  private inflight = new Map<string, Promise<Map<string, FactorValue>>>();

  constructor(config?: Partial<FactorDataProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[FactorDataProvider] Initialized with', Object.keys(DEFAULT_TTL).length, 'source slots');
  }

  // ── Source Registration ─────────────────────────────────────────────────

  /**
   * Register a factor data source. Each source must provide a callback that
   * accepts symbols[] + period and returns Map<symbol, FactorValue>.
   */
  registerSource(
    name: FactorSourceName,
    fetcher: (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>,
  ): void {
    this.sourceCallbacks.set(name, fetcher);
    log.info(`[FactorDataProvider] Source registered: ${name}`);
  }

  /** Check if a source is available */
  hasSource(name: FactorSourceName): boolean {
    return this.sourceCallbacks.has(name);
  }

  /** List all registered sources */
  getRegisteredSources(): FactorSourceName[] {
    return [...this.sourceCallbacks.keys()];
  }

  // ── Core Fetch ──────────────────────────────────────────────────────────

  /**
   * Fetch factor values for a single symbol.
   * Returns all available factor data from all registered sources.
   */
  async fetchFactors(
    symbol: string,
    period: FactorPeriod = '1m',
    options?: { sources?: FactorSourceName[]; forceRefresh?: boolean },
  ): Promise<FactorValues> {
    const cacheKey = `${symbol}:${period}:${(options?.sources ?? []).sort().join(',')}`;

    // Check cache
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }

    const startTime = Date.now();
    const warnings: string[] = [];
    const sourcesAvailable: FactorSourceName[] = [];
    const sourcesDegraded: FactorSourceName[] = [];
    const factors: Record<string, FactorValue> = {};

    const sources = options?.sources ?? this.getRegisteredSources();

    // Fetch from all requested sources in parallel with concurrency control
    if (this.config.enablePerformanceLog) {
      log.info(`[FactorDataProvider] Fetching ${sources.length} sources for ${symbol}`);
    }

    const results = await this.pooledFetch(symbol, sources, period);

    for (const source of sources) {
      const result = results.get(source);
      if (result) {
        sourcesAvailable.push(source);
        factors[result.factorId] = result;
      } else {
        sourcesDegraded.push(source);
        warnings.push(`Source '${source}' unavailable for ${symbol}, using default`);
        // Insert default value
        factors[`${source}::default`] = {
          factorId: source,
          value: 0,
          score: this.config.defaultScore,
          confidence: 0,
          source,
          timestamp: Date.now(),
          metadata: { degraded: true },
        };
      }
    }

    const factorValues: FactorValues = {
      symbol,
      period,
      factors,
      loadedAt: Date.now(),
      sourcesAvailable,
      sourcesDegraded,
      warnings,
    };

    // Cache result
    const minTtl = Math.min(
      ...sources.map(s => this.config.cacheTtlMs[s] ?? 60_000),
    );
    this.cache.set(cacheKey, { data: factorValues, expiresAt: Date.now() + minTtl });

    if (this.config.enablePerformanceLog) {
      log.info(`[FactorDataProvider] ${symbol} fetched in ${Date.now() - startTime}ms, ` +
        `${sourcesAvailable.length}/${sources.length} sources available`);
    }

    return factorValues;
  }

  /**
   * Batch fetch factor values for multiple symbols.
   * Uses concurrency limiting to prevent overwhelming data sources.
   */
  async fetchBatch(
    symbols: string[],
    period: FactorPeriod = '1m',
    options?: { sources?: FactorSourceName[]; forceRefresh?: boolean },
  ): Promise<BatchFactorResult> {
    const startTime = Date.now();
    const results: FactorValues[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    // Process in chunks to limit concurrency
    const chunkSize = this.config.maxConcurrency;
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map(sym =>
          this.fetchFactors(sym, period, options),
        ),
      );

      for (let j = 0; j < chunkResults.length; j++) {
        const result = chunkResults[j];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({ symbol: chunk[j], error: result.reason?.message ?? 'Unknown error' });
        }
      }
    }

    return {
      symbols: results,
      errors,
      totalTimeMs: Date.now() - startTime,
    };
  }

  // ── Specific Factor Accessors ───────────────────────────────────────────

  /**
   * Get composite score for a symbol (convenience).
   * Falls back through: compositeScore → weighted average → defaultScore.
   */
  async getScore(
    symbol: string,
    period?: FactorPeriod,
    options?: { sources?: FactorSourceName[]; weights?: Record<string, number> },
  ): Promise<number> {
    const values = await this.fetchFactors(symbol, period, options);
    return this.computeWeightedScore(values, options?.weights);
  }

  /**
   * Get scores for multiple symbols, sorted descending.
   * Returns top N by default.
   */
  async getTopScores(
    symbols: string[],
    topN: number = 20,
    period?: FactorPeriod,
    options?: { sources?: FactorSourceName[]; weights?: Record<string, number> },
  ): Promise<Array<{ symbol: string; score: number; values: FactorValues }>> {
    const batch = await this.fetchBatch(symbols, period, options);
    const scored = batch.symbols.map(v => ({
      symbol: v.symbol,
      score: this.computeWeightedScore(v, options?.weights),
      values: v,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  /**
   * Get a single factor value by factor ID.
   */
  async getFactorValue(
    symbol: string,
    factorId: string,
    period?: FactorPeriod,
  ): Promise<FactorValue | null> {
    const values = await this.fetchFactors(symbol, period);
    return values.factors[factorId] ?? null;
  }

  // ── Cache Management ────────────────────────────────────────────────────

  /** Get cache stats */
  getCacheStats(): { size: number; entries: Array<{ key: string; expiresAt: number }> } {
    const entries = [...this.cache.entries()].map(([key, val]) => ({
      key,
      expiresAt: val.expiresAt,
    }));
    return { size: this.cache.size, entries };
  }

  /** Clear all cached factor data */
  clearCache(): void {
    const count = this.cache.size;
    this.cache.clear();
    log.info(`[FactorDataProvider] Cache cleared (${count} entries)`);
  }

  /** Evict expired cache entries */
  evictExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, val] of this.cache) {
      if (val.expiresAt <= now) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      log.info(`[FactorDataProvider] Evicted ${count} expired entries`);
    }
    return count;
  }

  /** Prefetch factor data for a list of symbols (warmup) */
  async warmup(symbols: string[], period: FactorPeriod = '1m'): Promise<void> {
    log.info(`[FactorDataProvider] Warming up cache for ${symbols.length} symbols`);
    await this.fetchBatch(symbols, period);
    log.info(`[FactorDataProvider] Warmup complete`);
  }

  // ── Health Check ────────────────────────────────────────────────────────

  /**
   * Check health of all registered sources.
   * Returns per-source availability and latency.
   */
  async healthCheck(): Promise<Array<{
    source: FactorSourceName;
    available: boolean;
    error?: string;
  }>> {
    const testSymbol = 'US.AAPL';
    const results: Array<{
      source: FactorSourceName;
      available: boolean;
      error?: string;
    }> = [];

    for (const source of this.getRegisteredSources()) {
      try {
        const fetcher = this.sourceCallbacks.get(source);
        if (!fetcher) {
          results.push({ source, available: false, error: 'Fetcher not registered' });
          continue;
        }
        await fetcher([testSymbol], '1m');
        results.push({ source, available: true });
      } catch (err: unknown) {
        results.push({
          source,
          available: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Pooled concurrent fetch with per-source deduplication.
   * If the same source+symbol+period combo is already fetching, reuse the inflight promise.
   */
  private async pooledFetch(
    symbol: string,
    sources: FactorSourceName[],
    period: FactorPeriod,
  ): Promise<Map<FactorSourceName, FactorValue>> {
    const results = new Map<FactorSourceName, FactorValue>();

    // Build promises (deduplicating inflight requests)
    const promises = sources.map(async (source) => {
      const inflightKey = `${source}:${symbol}:${period}`;
      let promise = this.inflight.get(inflightKey);
      if (!promise) {
        const fetcher = this.sourceCallbacks.get(source);
        if (!fetcher) return { source, value: null as FactorValue | null };
        promise = this.fetchWithRetry(fetcher, [symbol], period).then(map => {
          this.inflight.delete(inflightKey);
          return map;
        }).catch(() => {
          this.inflight.delete(inflightKey);
          return new Map<string, FactorValue>();
        });
        this.inflight.set(inflightKey, promise);
      }
      const map = await promise;
      return { source, value: map.get(symbol) ?? null };
    });

    const settled = await Promise.allSettled(promises);
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value.value) {
        results.set(result.value.source, result.value.value);
      }
    }

    return results;
  }

  /** Exponential backoff retry wrapper */
  private async fetchWithRetry(
    fetcher: (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>,
    symbols: string[],
    period: FactorPeriod,
  ): Promise<Map<string, FactorValue>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fetcher(symbols, period);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          log.warn(`[FactorDataProvider] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /** Compute weighted composite score from factor values */
  private computeWeightedScore(
    values: FactorValues,
    weights?: Record<string, number>,
  ): number {
    const factors = Object.values(values.factors);
    if (factors.length === 0) return this.config.defaultScore;

    if (weights && Object.keys(weights).length > 0) {
      let totalWeight = 0;
      let weightedSum = 0;
      for (const fv of factors) {
        const w = weights[fv.factorId] ?? 0;
        if (w > 0) {
          weightedSum += fv.score * w;
          totalWeight += w;
        }
      }
      return totalWeight > 0 ? weightedSum / totalWeight : this.config.defaultScore;
    }

    // Equal weight fallback
    const sum = factors.reduce((s, fv) => s + fv.score, 0);
    return sum / factors.length;
  }

  /** Reset for testing */
  reset(): void {
    this.cache.clear();
    this.inflight.clear();
    this.sourceCallbacks.clear();
    log.info('[FactorDataProvider] Reset');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: FactorDataProvider | null = null;

/** Default export — get or create the singleton instance */
export function getFactorDataProvider(config?: Partial<FactorDataProviderConfig>): FactorDataProvider {
  if (!instance) {
    instance = new FactorDataProvider(config);
  } else if (config) {
    // Reinitialize if config provided
    instance.reset();
    instance = new FactorDataProvider(config);
  }
  return instance;
}

/** Reset singleton (tests, reinit) */
export function resetFactorDataProvider(): void {
  instance?.reset();
  instance = null;
}

// ── R170 A4: Initialization with wired sources ─────────────────────────────

/**
 * Initialize FactorDataProvider with all wired data sources.
 * This is the single entry point for production startup.
 *
 * Degradation chain per source:
 *   local_cache → (future: broker_api / cloud_api) → default_score
 */
export async function initializeFactorDataProvider(
  config?: Partial<FactorDataProviderConfig>,
): Promise<FactorDataProvider> {
  const provider = getFactorDataProvider(config);

  try {
    // Dynamically import LocalCacheSource to avoid circular deps
    const { getLocalCacheSource } = await import(
      './factor-data-sources/local-cache-source'
    );
    const cache = getLocalCacheSource();

    // Register local cache as the first real data source
    provider.registerSource('capital_flow', cache.createFetcher());

    log.info(
      `[FactorDataProvider] R170 A4: Wired ${provider.getRegisteredSources().length} source(s):`,
      provider.getRegisteredSources(),
    );
  } catch (err) {
    log.warn(
      '[FactorDataProvider] R170 A4: Failed to wire local cache source',
      err,
    );
  }

  return provider;
}

// ── Default Factor Values Helper ───────────────────────────────────────────

/**
 * Create a default FactorValue for degraded/missing data.
 * Used by source adapters when their underlying data source is unavailable.
 */
export function createDefaultFactorValue(
  factorId: string,
  source: FactorSourceName,
  score?: number,
): FactorValue {
  return {
    factorId,
    value: 0,
    score: score ?? 50,
    confidence: 0,
    source,
    timestamp: Date.now(),
    metadata: { degraded: true, reason: 'source_unavailable' },
  };
}

export default {
  FactorDataProvider,
  getFactorDataProvider,
  resetFactorDataProvider,
  initializeFactorDataProvider,
  createDefaultFactorValue,
};
