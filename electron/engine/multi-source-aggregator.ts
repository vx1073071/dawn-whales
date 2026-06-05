/**
 * JVS-83: Multi-Source Data Aggregator
 *
 * Unified data fetching from multiple sources with priority-based fallback,
 * circuit breaker pattern, rate limiting, result caching with TTL,
 * latency tracking, and multi-source merge strategy.
 */

import log from 'electron-log';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DataSource {
  id: string;
  name: string;
  priority: number; // lower = higher priority
  enabled: boolean;
  rateLimitMs: number; // min ms between requests
  lastRequestTime: number;
  errorCount: number;
  successCount: number;
  timeoutMs: number;
}

export interface AggregatedData<T> {
  data: T;
  source: string;
  confidence: number; // 0-1 based on source reliability
  fetchedAt: string;
  latency: number; // ms
  merged?: boolean; // true if merged from multiple sources
}

export interface DataSourceConfig {
  id: string;
  name: string;
  priority: number;
  rateLimitMs: number;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
}

export interface HealthReportEntry {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
  circuitBreakerOpen: boolean;
  circuitBreakerResetAt: string | null;
  cacheHits: number;
  cacheMisses: number;
}

export interface HealthReport {
  sources: HealthReportEntry[];
  totalCacheHits: number;
  totalCacheMisses: number;
  cacheHitRate: number;
  generatedAt: string;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

type FetcherFn = (symbol: string, type: string) => Promise<any>;

interface SourceEntry {
  config: DataSourceConfig;
  source: DataSource;
  fetcher: FetcherFn;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  circuitBreakerResetAt: number | null;
  latencySamples: number[];
  cacheHits: number;
  cacheMisses: number;
}

interface CacheEntry<T = any> {
  data: T;
  source: string;
  confidence: number;
  fetchedAt: string;
  latency: number;
  expiresAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;
const DEFAULT_CACHE_TTL_MS = 30_000;
const MAX_LATENCY_SAMPLES = 100;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a cache key from symbol and data type.
 */
function buildCacheKey(symbol: string, dataType: string): string {
  return `${symbol}:${dataType}`;
}

/**
 * Compute a confidence score for a source based on its success rate.
 * Returns a value between 0 and 1.
 */
function computeConfidence(source: DataSource): number {
  const total = source.successCount + source.errorCount;
  if (total === 0) return 0.5; // no data yet, neutral confidence
  return Math.min(1, Math.max(0, source.successCount / total));
}

/**
 * Calculate average of a numeric array.
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Deep-merge two plain objects. Arrays and primitives from `override` win.
 * Used for merging partial data from secondary sources into primary data.
 */
function deepMerge(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];

    if (
      baseVal !== null &&
      overrideVal !== null &&
      typeof baseVal === 'object' &&
      typeof overrideVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (baseVal === undefined || baseVal === null || baseVal === '' || baseVal === 0) {
      // Fill gaps: only override if base value is missing / empty
      result[key] = overrideVal;
    }
    // Otherwise keep the base value (higher-confidence source wins)
  }

  return result;
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  resetTimer: number | null;
}

/**
 * Lightweight per-source circuit breaker tracker.
 * - CLOSED: requests flow normally
 * - OPEN: requests are blocked until cooldown expires
 * - HALF_OPEN: a single probe request is allowed through; success closes the
 *   circuit, failure reopens it.
 */
class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreakerState> = new Map();

  getState(sourceId: string): CircuitBreakerState {
    if (!this.breakers.has(sourceId)) {
      this.breakers.set(sourceId, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        resetTimer: null,
      });
    }
    const breaker = this.breakers.get(sourceId)!;

    // Auto-transition OPEN → HALF_OPEN after cooldown
    if (
      breaker.state === CircuitState.OPEN &&
      breaker.lastFailureTime > 0 &&
      Date.now() - breaker.lastFailureTime >= CIRCUIT_BREAKER_COOLDOWN_MS
    ) {
      log.info(`[CircuitBreaker] ${sourceId}: OPEN → HALF_OPEN (cooldown expired)`);
      breaker.state = CircuitState.HALF_OPEN;
    }

    return breaker;
  }

  isOpen(sourceId: string): boolean {
    const state = this.getState(sourceId);
    return state.state === CircuitState.OPEN;
  }

  isHalfOpen(sourceId: string): boolean {
    const state = this.getState(sourceId);
    return state.state === CircuitState.HALF_OPEN;
  }

  recordSuccess(sourceId: string): void {
    const state = this.getState(sourceId);
    if (state.state === CircuitState.HALF_OPEN) {
      log.info(`[CircuitBreaker] ${sourceId}: HALF_OPEN → CLOSED (probe succeeded)`);
    }
    state.state = CircuitState.CLOSED;
    state.failureCount = 0;
    state.resetTimer = null;
  }

  recordFailure(sourceId: string): void {
    const state = this.getState(sourceId);
    state.failureCount += 1;
    state.lastFailureTime = Date.now();

    if (state.state === CircuitState.HALF_OPEN) {
      // Probe failed → reopen immediately
      log.warn(`[CircuitBreaker] ${sourceId}: HALF_OPEN → OPEN (probe failed)`);
      state.state = CircuitState.OPEN;
      return;
    }

    if (state.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      log.warn(
        `[CircuitBreaker] ${sourceId}: OPEN (consecutive failures: ${state.failureCount})`
      );
      state.state = CircuitState.OPEN;
    }
  }

  getResetTime(sourceId: string): string | null {
    const state = this.getState(sourceId);
    if (state.state !== CircuitState.OPEN || state.lastFailureTime === 0) return null;
    const resetAt = new Date(state.lastFailureTime + CIRCUIT_BREAKER_COOLDOWN_MS);
    return resetAt.toISOString();
  }

  reset(sourceId: string): void {
    this.breakers.delete(sourceId);
  }

  resetAll(): void {
    this.breakers.clear();
  }
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

/**
 * Per-source token-bucket style rate limiter.
 * Ensures at least `rateLimitMs` elapses between consecutive requests
 * for a given source.
 */
class RateLimiter {
  private lastRequestTimes: Map<string, number> = new Map();

  /**
   * Wait until the source is eligible for the next request.
   * Returns immediately if enough time has passed.
   */
  async waitForSlot(sourceId: string, rateLimitMs: number): Promise<void> {
    if (rateLimitMs <= 0) return;

    const lastTime = this.lastRequestTimes.get(sourceId) ?? 0;
    const now = Date.now();
    const elapsed = now - lastTime;

    if (elapsed < rateLimitMs) {
      const waitMs = rateLimitMs - elapsed;
      log.debug(`[RateLimiter] ${sourceId}: waiting ${waitMs}ms (rate limit)`);
      await sleep(waitMs);
    }

    this.lastRequestTimes.set(sourceId, Date.now());
  }

  /**
   * Record that a request was made for the given source.
   */
  recordRequest(sourceId: string): void {
    this.lastRequestTimes.set(sourceId, Date.now());
  }

  /**
   * Get time in ms until the source is next eligible.
   */
  getWaitTime(sourceId: string, rateLimitMs: number): number {
    const lastTime = this.lastRequestTimes.get(sourceId) ?? 0;
    const elapsed = Date.now() - lastTime;
    return Math.max(0, rateLimitMs - elapsed);
  }

  reset(sourceId: string): void {
    this.lastRequestTimes.delete(sourceId);
  }

  resetAll(): void {
    this.lastRequestTimes.clear();
  }
}

// ─── Cache Store ──────────────────────────────────────────────────────────────

/**
 * In-memory result cache with per-entry TTL.
 * Supports tag-based invalidation for symbol-level or type-level purges.
 */
class ResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = DEFAULT_CACHE_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Store a result in the cache.
   */
  set<T>(key: string, entry: Omit<CacheEntry<T>, 'expiresAt'>, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const cacheEntry: CacheEntry<T> = {
      ...entry,
      expiresAt: Date.now() + ttl,
    };
    this.cache.set(key, cacheEntry as CacheEntry);
    log.debug(`[Cache] SET ${key} (TTL ${ttl}ms)`);
  }

  /**
   * Retrieve a cached result. Returns null if missing or expired.
   */
  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      log.debug(`[Cache] EXPIRED ${key}`);
      return null;
    }
    log.debug(`[Cache] HIT ${key}`);
    return entry as CacheEntry<T>;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove a specific key.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all entries whose key starts with a given prefix.
   * Useful for purging all data for a symbol: `invalidatePrefix('AAPL:')`.
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      log.info(`[Cache] Invalidated ${count} entries with prefix "${prefix}"`);
    }
    return count;
  }

  /**
   * Remove all expired entries (garbage collection).
   */
  gc(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    log.info('[Cache] All entries cleared');
  }

  /**
   * Return number of entries (including potentially expired ones not yet GC'd).
   */
  get size(): number {
    return this.cache.size;
  }
}

// ─── Multi-Source Aggregator ──────────────────────────────────────────────────

/**
 * MultiSourceAggregator orchestrates data fetching across multiple sources
 * with priority-based selection, automatic fallback, circuit breaker protection,
 * per-source rate limiting, result caching, latency tracking, and multi-source
 * data merging.
 *
 * Usage:
 * ```ts
 * const agg = new MultiSourceAggregator();
 * agg.addSource({ id: 'eastmoney', name: 'EastMoney', priority: 1, ... }, fetcherFn);
 * const result = await agg.fetch('600519', 'quote');
 * ```
 */
export class MultiSourceAggregator {
  private sources: Map<string, SourceEntry> = new Map();
  private circuitBreaker: CircuitBreakerManager;
  private rateLimiter: RateLimiter;
  private cache: ResultCache;
  private cacheTtlMs: number;

  constructor(options?: { cacheTtlMs?: number }) {
    this.cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.circuitBreaker = new CircuitBreakerManager();
    this.rateLimiter = new RateLimiter();
    this.cache = new ResultCache(this.cacheTtlMs);

    log.info('[MultiSourceAggregator] Initialized');
  }

  // ─── Source Management ────────────────────────────────────────────────────

  /**
   * Register a new data source with its configuration and fetcher function.
   * If a source with the same id already exists, it will be replaced.
   */
  addSource(config: DataSourceConfig, fetcher: FetcherFn): void {
    if (!config.id || typeof config.id !== 'string') {
      throw new Error('Source config must include a valid string id');
    }
    if (typeof fetcher !== 'function') {
      throw new Error('Fetcher must be a function (symbol, type) => Promise<any>');
    }

    const source: DataSource = {
      id: config.id,
      name: config.name || config.id,
      priority: config.priority ?? 99,
      enabled: true,
      rateLimitMs: config.rateLimitMs ?? 0,
      lastRequestTime: 0,
      errorCount: 0,
      successCount: 0,
      timeoutMs: config.timeoutMs ?? 10_000,
    };

    const entry: SourceEntry = {
      config: {
        retryCount: config.retryCount ?? DEFAULT_RETRY_COUNT,
        retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
        ...config,
      },
      source,
      fetcher,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      circuitBreakerResetAt: null,
      latencySamples: [],
      cacheHits: 0,
      cacheMisses: 0,
    };

    this.sources.set(config.id, entry);
    this.circuitBreaker.reset(config.id);
    this.rateLimiter.reset(config.id);

    log.info(
      `[MultiSourceAggregator] Source added: ${config.name} (${config.id}) ` +
        `priority=${config.priority} rateLimit=${config.rateLimitMs}ms ` +
        `timeout=${source.timeoutMs}ms`
    );
  }

  /**
   * Remove a source by its id. Also cleans up associated circuit breaker
   * and rate limiter state.
   */
  removeSource(id: string): boolean {
    if (!this.sources.has(id)) {
      log.warn(`[MultiSourceAggregator] removeSource: "${id}" not found`);
      return false;
    }

    this.sources.delete(id);
    this.circuitBreaker.reset(id);
    this.rateLimiter.reset(id);

    log.info(`[MultiSourceAggregator] Source removed: ${id}`);
    return true;
  }

  /**
   * Update the priority of an existing source.
   */
  setSourcePriority(id: string, priority: number): boolean {
    const entry = this.sources.get(id);
    if (!entry) {
      log.warn(`[MultiSourceAggregator] setSourcePriority: "${id}" not found`);
      return false;
    }
    entry.source.priority = priority;
    entry.config.priority = priority;
    log.info(`[MultiSourceAggregator] Source "${id}" priority updated to ${priority}`);
    return true;
  }

  /**
   * Enable or disable a source. Disabled sources are skipped during fetch.
   */
  enableSource(id: string, enabled: boolean): boolean {
    const entry = this.sources.get(id);
    if (!entry) {
      log.warn(`[MultiSourceAggregator] enableSource: "${id}" not found`);
      return false;
    }
    entry.source.enabled = enabled;
    log.info(`[MultiSourceAggregator] Source "${id}" ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Get a source entry by id (internal helper).
   */
  private getSourceEntry(id: string): SourceEntry | undefined {
    return this.sources.get(id);
  }

  /**
   * Return all sources sorted by priority (lower number = higher priority).
   */
  private getSortedSources(): SourceEntry[] {
    return Array.from(this.sources.values()).sort(
      (a, b) => a.source.priority - b.source.priority
    );
  }

  /**
   * Return all enabled sources sorted by priority.
   */
  private getEnabledSources(): SourceEntry[] {
    return this.getSortedSources().filter((e) => e.source.enabled);
  }

  // ─── Core Fetch Logic ───────────────────────────────────────────────────

  /**
   * Execute a single fetch against one source, respecting rate limiting,
   * circuit breaker, timeout, and retry logic.
   *
   * Returns the fetched data or throws if all attempts fail.
   */
  private async executeFetch(
    entry: SourceEntry,
    symbol: string,
    dataType: string
  ): Promise<{ data: any; latency: number }> {
    const { source, config, fetcher } = entry;

    // Check circuit breaker
    if (this.circuitBreaker.isOpen(source.id)) {
      const resetAt = this.circuitBreaker.getResetTime(source.id);
      throw new Error(
        `Circuit breaker OPEN for "${source.name}" (${source.id}). ` +
          `Reset expected at ${resetAt ?? 'unknown'}.`
      );
    }

    // Wait for rate limiter slot
    await this.rateLimiter.waitForSlot(source.id, source.rateLimitMs);

    const retryCount = config.retryCount ?? DEFAULT_RETRY_COUNT;
    const retryDelay = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      if (attempt > 0) {
        log.debug(
          `[MultiSourceAggregator] Retry ${attempt}/${retryCount} for ` +
            `"${source.name}" (${symbol}:${dataType})`
        );
        await sleep(retryDelay * attempt); // exponential-ish backoff
      }

      const startTime = performance.now();

      try {
        // Race the fetcher against the timeout
        const data = await this.withTimeout(
          fetcher(symbol, dataType),
          source.timeoutMs,
          `"${source.name}" timed out after ${source.timeoutMs}ms`
        );

        const latency = Math.round(performance.now() - startTime);

        // Record success
        source.successCount++;
        source.lastRequestTime = Date.now();
        entry.consecutiveFailures = 0;
        this.circuitBreaker.recordSuccess(source.id);
        this.recordLatency(entry, latency);
        this.rateLimiter.recordRequest(source.id);

        log.debug(
          `[MultiSourceAggregator] "${source.name}" OK (${symbol}:${dataType}) ` +
            `${latency}ms`
        );

        return { data, latency };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const latency = Math.round(performance.now() - startTime);

        log.warn(
          `[MultiSourceAggregator] "${source.name}" attempt ${attempt + 1} failed ` +
            `(${symbol}:${dataType}) ${latency}ms: ${lastError.message}`
        );
      }
    }

    // All attempts failed
    source.errorCount++;
    source.lastRequestTime = Date.now();
    entry.consecutiveFailures++;
    this.circuitBreaker.recordFailure(source.id);
    this.rateLimiter.recordRequest(source.id);

    throw lastError ?? new Error(`All ${retryCount + 1} attempts failed for "${source.name}"`);
  }

  /**
   * Wrap a promise with a timeout.
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMsg: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMsg));
      }, timeoutMs);

      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Record a latency sample for a source (bounded ring buffer).
   */
  private recordLatency(entry: SourceEntry, latencyMs: number): void {
    entry.latencySamples.push(latencyMs);
    if (entry.latencySamples.length > MAX_LATENCY_SAMPLES) {
      entry.latencySamples.shift();
    }
  }

  // ─── Public Fetch Methods ───────────────────────────────────────────────

  /**
   * Fetch data for a symbol from the highest-priority available source.
   * Falls back to the next source on failure.
   *
   * Checks cache first; caches the result on success.
   */
  async fetch<T = any>(symbol: string, dataType: string): Promise<AggregatedData<T>> {
    const cacheKey = buildCacheKey(symbol, dataType);

    // Check cache first
    const cached = this.cache.get<T>(cacheKey);
    if (cached) {
      // Record cache hit on the source that originally provided the data
      const sourceEntry = this.sources.get(cached.source);
      if (sourceEntry) {
        sourceEntry.cacheHits++;
      }
      log.debug(
        `[MultiSourceAggregator] Cache hit for ${cacheKey} (source: ${cached.source})`
      );
      return {
        data: cached.data,
        source: cached.source,
        confidence: cached.confidence,
        fetchedAt: cached.fetchedAt,
        latency: cached.latency,
        merged: false,
      };
    }

    const enabledSources = this.getEnabledSources();
    if (enabledSources.length === 0) {
      throw new Error('No enabled data sources available');
    }

    const errors: Array<{ source: string; error: string }> = [];

    for (const entry of enabledSources) {
      // Check if circuit breaker is open
      if (this.circuitBreaker.isOpen(entry.source.id)) {
        log.debug(
          `[MultiSourceAggregator] Skipping "${entry.source.name}" - circuit breaker open`
        );
        errors.push({
          source: entry.source.id,
          error: 'Circuit breaker open',
        });
        continue;
      }

      // Record cache miss
      entry.cacheMisses++;

      try {
        const { data, latency } = await this.executeFetch(entry, symbol, dataType);
        const confidence = computeConfidence(entry.source);
        const fetchedAt = new Date().toISOString();

        const result: AggregatedData<T> = {
          data,
          source: entry.source.id,
          confidence,
          fetchedAt,
          latency,
          merged: false,
        };

        // Cache the result
        this.cache.set(cacheKey, {
          data,
          source: entry.source.id,
          confidence,
          fetchedAt,
          latency,
        });

        return result;
      } catch (err: any) {
        errors.push({
          source: entry.source.id,
          error: err.message ?? String(err),
        });
        log.warn(
          `[MultiSourceAggregator] Source "${entry.source.name}" failed, ` +
            `trying next (remaining: ${enabledSources.indexOf(entry)} of ${enabledSources.length})`
        );
        // Continue to next source (fallback)
      }
    }

    // All sources failed
    const errorSummary = errors.map((e) => `  ${e.source}: ${e.error}`).join('\n');
    throw new Error(
      `All sources failed for ${symbol}:${dataType}\n${errorSummary}`
    );
  }

  /**
   * Fetch data from ALL enabled sources in parallel, then merge results.
   * Uses the highest-confidence source as the base and fills gaps from
   * lower-confidence sources.
   *
   * Sources that fail are silently excluded (partial results are still returned
   * as long as at least one source succeeds).
   */
  async fetchAll<T = any>(symbol: string, dataType: string): Promise<AggregatedData<T>> {
    const enabledSources = this.getEnabledSources();
    if (enabledSources.length === 0) {
      throw new Error('No enabled data sources available');
    }

    log.info(
      `[MultiSourceAggregator] fetchAll: querying ${enabledSources.length} sources ` +
        `for ${symbol}:${dataType}`
    );

    // Fire all fetches in parallel
    const fetchPromises = enabledSources.map(async (entry) => {
      try {
        entry.cacheMisses++;
        const { data, latency } = await this.executeFetch(entry, symbol, dataType);
        const confidence = computeConfidence(entry.source);
        return {
          entry,
          data,
          latency,
          confidence,
          error: null as string | null,
        };
      } catch (err: any) {
        entry.cacheMisses++;
        log.warn(
          `[MultiSourceAggregator] fetchAll: "${entry.source.name}" failed: ${err.message}`
        );
        return {
          entry,
          data: null,
          latency: 0,
          confidence: 0,
          error: err.message ?? String(err),
        };
      }
    });

    const results = await Promise.all(fetchPromises);
    const successful = results.filter((r) => r.error === null && r.data !== null);
    const failed = results.filter((r) => r.error !== null);

    if (successful.length === 0) {
      const errorSummary = failed.map((r) => `  ${r.entry.source.id}: ${r.error}`).join('\n');
      throw new Error(
        `All sources failed for fetchAll ${symbol}:${dataType}\n${errorSummary}`
      );
    }

    // Sort by confidence descending, then by priority ascending
    successful.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.entry.source.priority - b.entry.source.priority;
    });

    const primary = successful[0];
    const fetchedAt = new Date().toISOString();
    const isMerged = successful.length > 1;

    let mergedData = primary.data;
    let totalLatency = primary.latency;

    // Merge strategy: use highest confidence as base, fill gaps from others
    if (isMerged && typeof primary.data === 'object' && primary.data !== null) {
      for (let i = 1; i < successful.length; i++) {
        const secondary = successful[i];
        if (typeof secondary.data === 'object' && secondary.data !== null) {
          mergedData = deepMerge(mergedData, secondary.data);
        }
        totalLatency = Math.max(totalLatency, secondary.latency);
      }
      log.info(
        `[MultiSourceAggregator] Merged ${successful.length} sources for ` +
          `${symbol}:${dataType} (primary: ${primary.entry.source.name})`
      );
    }

    const result: AggregatedData<T> = {
      data: mergedData,
      source: primary.entry.source.id,
      confidence: primary.confidence,
      fetchedAt,
      latency: totalLatency,
      merged: isMerged,
    };

    // Cache the merged result
    const cacheKey = buildCacheKey(symbol, dataType);
    this.cache.set(cacheKey, {
      data: mergedData,
      source: primary.entry.source.id,
      confidence: primary.confidence,
      fetchedAt,
      latency: totalLatency,
    });

    if (failed.length > 0) {
      log.warn(
        `[MultiSourceAggregator] fetchAll: ${failed.length} source(s) failed: ` +
          failed.map((r) => r.entry.source.name).join(', ')
      );
    }

    return result;
  }

  // ─── Health & Monitoring ────────────────────────────────────────────────

  /**
   * Generate a comprehensive health report for all registered sources.
   */
  getHealthReport(): HealthReport {
    const sources: HealthReportEntry[] = [];
    let totalCacheHits = 0;
    let totalCacheMisses = 0;

    for (const entry of this.getSortedSources()) {
      const { source, config, latencySamples, cacheHits, cacheMisses } = entry;
      const total = source.successCount + source.errorCount;
      const isCircuitOpen = this.circuitBreaker.isOpen(source.id);
      const resetTime = this.circuitBreaker.getResetTime(source.id);

      totalCacheHits += cacheHits;
      totalCacheMisses += cacheMisses;

      sources.push({
        id: source.id,
        name: source.name,
        enabled: source.enabled,
        priority: source.priority,
        totalRequests: total,
        successCount: source.successCount,
        errorCount: source.errorCount,
        successRate: total > 0 ? source.successCount / total : 1,
        avgLatencyMs: Math.round(average(latencySamples)),
        lastLatencyMs: latencySamples.length > 0 ? latencySamples[latencySamples.length - 1] : 0,
        circuitBreakerOpen: isCircuitOpen,
        circuitBreakerResetAt: resetTime,
        cacheHits,
        cacheMisses,
      });
    }

    const totalRequests = totalCacheHits + totalCacheMisses;
    const cacheHitRate = totalRequests > 0 ? totalCacheHits / totalRequests : 0;

    return {
      sources,
      totalCacheHits,
      totalCacheMisses,
      cacheHitRate,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Print a formatted health summary to the log.
   */
  logHealthSummary(): void {
    const report = this.getHealthReport();
    log.info('═══════════════════════════════════════════════════════════');
    log.info('  Multi-Source Aggregator Health Report');
    log.info('═══════════════════════════════════════════════════════════');

    for (const s of report.sources) {
      const status = s.enabled ? (s.circuitBreakerOpen ? '⚠ OPEN' : '✓ OK') : '✗ DISABLED';
      const rate = `${(s.successRate * 100).toFixed(1)}%`;
      log.info(
        `  [${status}] ${s.name} (pri:${s.priority}) | ` +
          `reqs:${s.totalRequests} ok:${s.successCount} err:${s.errorCount} | ` +
          `success:${rate} avg:${s.avgLatencyMs}ms last:${s.lastLatencyMs}ms | ` +
          `cache:${s.cacheHits}h/${s.cacheMisses}m`
      );
    }

    log.info(
      `  Cache: ${report.totalCacheHits} hits / ${report.totalCacheMisses} misses ` +
        `(${(report.cacheHitRate * 100).toFixed(1)}% hit rate)`
    );
    log.info('═══════════════════════════════════════════════════════════');
  }

  // ─── Cache Management ───────────────────────────────────────────────────

  /**
   * Manually invalidate cache entries for a specific symbol.
   */
  invalidateCache(symbol: string): number {
    return this.cache.invalidatePrefix(`${symbol}:`);
  }

  /**
   * Clear the entire result cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Run garbage collection on the cache, removing expired entries.
   */
  gcCache(): number {
    return this.cache.gc();
  }

  /**
   * Get current cache size.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Reset all internal state: sources, circuit breakers, rate limiters, cache.
   * Useful for testing.
   */
  reset(): void {
    this.sources.clear();
    this.circuitBreaker.resetAll();
    this.rateLimiter.resetAll();
    this.cache.clear();
    log.info('[MultiSourceAggregator] Full reset completed');
  }

  /**
   * Get the number of registered sources.
   */
  get sourceCount(): number {
    return this.sources.size;
  }

  /**
   * Check if a source with the given id exists.
   */
  hasSource(id: string): boolean {
    return this.sources.has(id);
  }

  /**
   * Get raw source info (for debugging / testing).
   */
  getSourceInfo(id: string): DataSource | null {
    const entry = this.sources.get(id);
    return entry ? { ...entry.source } : null;
  }
}

// ─── Built-in Source Factories ────────────────────────────────────────────────

/**
 * Create a simulated EastMoney data source configuration.
 * In production, the fetcher would call EastMoney APIs for A-share data.
 */
export function createEastMoneyConfig(): DataSourceConfig {
  return {
    id: 'eastmoney',
    name: 'EastMoney',
    priority: 1,
    rateLimitMs: 200,
    timeoutMs: 8_000,
    retryCount: 2,
    retryDelayMs: 500,
  };
}

/**
 * Create a simulated FutuOpenD data source configuration.
 * In production, the fetcher would connect to Futu OpenD for US/HK stock data.
 */
export function createFutuOpenDConfig(): DataSourceConfig {
  return {
    id: 'futuopend',
    name: 'FutuOpenD',
    priority: 2,
    rateLimitMs: 100,
    timeoutMs: 10_000,
    retryCount: 2,
    retryDelayMs: 1_000,
  };
}

/**
 * Create a simulated Yahoo Finance data source configuration.
 * In production, the fetcher would call Yahoo Finance API as a fallback.
 */
export function createYahooFinanceConfig(): DataSourceConfig {
  return {
    id: 'yahoofinance',
    name: 'YahooFinance',
    priority: 3,
    rateLimitMs: 500,
    timeoutMs: 15_000,
    retryCount: 1,
    retryDelayMs: 2_000,
  };
}

/**
 * Create a CacheStore data source configuration.
 * This source checks a persistent local cache before hitting remote APIs.
 */
export function createCacheStoreConfig(): DataSourceConfig {
  return {
    id: 'cachestore',
    name: 'CacheStore',
    priority: 0,
    rateLimitMs: 0,
    timeoutMs: 2_000,
    retryCount: 0,
    retryDelayMs: 0,
  };
}

/**
 * Create a mock fetcher that returns simulated market data.
 * Useful for testing and development without real API calls.
 */
export function createMockFetcher(
  sourceName: string,
  baseData: Record<string, any> = {}
): FetcherFn {
  return async (symbol: string, dataType: string): Promise<any> => {
    // Simulate network latency
    const delay = 50 + Math.random() * 200;
    await sleep(delay);

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error(`${sourceName}: simulated transient error`);
    }

    return {
      symbol,
      dataType,
      source: sourceName,
      timestamp: new Date().toISOString(),
      ...baseData,
      price: baseData.price ?? 100 + Math.random() * 50,
      volume: baseData.volume ?? Math.floor(Math.random() * 1_000_000),
      change: baseData.change ?? (Math.random() - 0.5) * 5,
      changePercent: baseData.changePercent ?? (Math.random() - 0.5) * 3,
    };
  };
}

/**
 * Create a MultiSourceAggregator pre-configured with all built-in
 * simulated sources (EastMoney, FutuOpenD, YahooFinance, CacheStore).
 *
 * This is primarily for testing and demo purposes.
 */
export function createDefaultAggregator(): MultiSourceAggregator {
  const aggregator = new MultiSourceAggregator();

  // CacheStore (priority 0 - checked first)
  aggregator.addSource(
    createCacheStoreConfig(),
    createMockFetcher('CacheStore', { cached: true })
  );

  // EastMoney (priority 1 - A-shares)
  aggregator.addSource(
    createEastMoneyConfig(),
    createMockFetcher('EastMoney', { market: 'A-share' })
  );

  // FutuOpenD (priority 2 - US/HK)
  aggregator.addSource(
    createFutuOpenDConfig(),
    createMockFetcher('FutuOpenD', { market: 'US/HK' })
  );

  // YahooFinance (priority 3 - fallback)
  aggregator.addSource(
    createYahooFinanceConfig(),
    createMockFetcher('YahooFinance', { market: 'global' })
  );

  log.info('[MultiSourceAggregator] Default aggregator created with 4 built-in sources');

  return aggregator;
}

export default MultiSourceAggregator;
