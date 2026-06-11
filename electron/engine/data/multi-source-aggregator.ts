/**
 * Multi-Source Data Aggregator (JVS-41-01)
 *
 * Combines data from 4 financial data sources with priority-based fallback,
 * health monitoring, and consensus scoring.
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';
import i18n from '../../../src/i18n';


// ============================================================================
// Inline EventEmitter Polyfill
// ============================================================================

type EventListener = (...args: unknown[]) => void;

class SimpleEventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(
        event,
        list.filter((fn) => fn !== listener)
      );
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapped: EventListener = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[EventEmitter] Listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types
// ============================================================================

export type DataSourceId = 'eastmoney' | 'sina' | 'tencent' | 'xueqiu';
export type DataQuality = 'high' | 'medium' | 'low' | 'unavailable';

export interface DataSourceConfig {
  id: DataSourceId;
  name: string;
  priority: number; // lower = higher priority
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  healthCheckIntervalMs: number;
}

export interface DataPoint {
  symbol: string;
  source: DataSourceId;
  price: number;
  volume: number;
  timestamp: number;
  quality: DataQuality;
  confidence: number; // 0-1
}

export interface SourceHealth {
  id: DataSourceId;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  successRate: number; // 0-1
  lastCheck: number;
  errorCount: number;
}

export interface AggregationResult {
  symbol: string;
  bestData: DataPoint;
  allSources: DataPoint[];
  consensus: number; // agreement score 0-1
  timestamp: number;
}

export interface SourceStats {
  requests: number;
  errors: number;
  avgLatency: number;
}

// ============================================================================
// Internal Interfaces
// ============================================================================

interface RegisteredSource {
  config: DataSourceConfig;
  fetcher: (symbol: string) => Promise<DataPoint>;
  health: SourceHealth;
  stats: SourceStats & { totalLatency: number };
  healthCheckTimer: ReturnType<typeof setInterval> | null;
}

interface FetchAttemptResult {
  success: boolean;
  data?: DataPoint;
  error?: Error;
  latencyMs: number;
}

// ============================================================================
// Enhancement Types (JVS-41-01 Extensions)
// ============================================================================

export interface ValidationConfig {
  minPrice: number;
  maxPrice: number;
  maxVolumeRatio: number;
  maxTimestampAgeMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AnomalyRecord {
  symbol: string;
  source: DataSourceId;
  price: number;
  zScore: number;
  timestamp: number;
  flagged: boolean;
}

export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  samples: number;
}

export interface BatchFetchResult {
  symbol: string;
  success: boolean;
  data?: DataPoint;
  error?: string;
}

export interface SourceWeightEntry {
  timestamp: number;
  symbol: string;
  selectedSource: DataSourceId;
  allSources: DataSourceId[];
  reason: string;
}

// ============================================================================
// Constants
// ============================================================================

const FETCH_TIMEOUT_DEFAULT = 5_000;
const MAX_RETRIES_DEFAULT = 2;
const QUALITY_WEIGHTS: Record<DataQuality, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
  unavailable: 0.0,
};

const CONSENSUS_THRESHOLD = 0.05; // 5% price deviation for consensus

// ============================================================================
// MultiSourceAggregator
// ============================================================================

export class MultiSourceAggregator extends SimpleEventEmitter {
  private sources: Map<DataSourceId, RegisteredSource> = new Map();

  // Enhancement fields (JVS-41-01 Extensions)
  private _sourceWeightHistory: SourceWeightEntry[] = [];
  private _validationConfig: ValidationConfig = {
    minPrice: 0.001,
    maxPrice: 1_000_000,
    maxVolumeRatio: 100,
    maxTimestampAgeMs: 300_000, // 5 minutes
  };
  private _anomalyRecords: AnomalyRecord[] = [];
  private _maxAnomalyRecords = 1000;
  private _latencySamples: Map<DataSourceId, number[]> = new Map();

  constructor() {
    super();
    log.info('[MultiSourceAggregator] Initialized');
  }

  // --------------------------------------------------------------------------
  // Source Management
  // --------------------------------------------------------------------------

  /**
   * Register a data source with its configuration and fetcher function.
   * Starts periodic health checks if configured.
   */
  addSource(
    config: DataSourceConfig,
    fetcher: (symbol: string) => Promise<DataPoint>
  ): void {
    if (this.sources.has(config.id)) {
      log.warn(`[MultiSourceAggregator] Source "${config.id}" already registered, replacing`);
      this.removeSource(config.id);
    }

    const health: SourceHealth = {
      id: config.id,
      status: 'healthy',
      latencyMs: 0,
      successRate: 1.0,
      lastCheck: Date.now(),
      errorCount: 0,
    };

    const stats: SourceStats & { totalLatency: number } = {
      requests: 0,
      errors: 0,
      avgLatency: 0,
      totalLatency: 0,
    };

    const registered: RegisteredSource = {
      config,
      fetcher,
      health,
      stats,
      healthCheckTimer: null,
    };

    this.sources.set(config.id, registered);

    // Start health check interval
    if (config.enabled && config.healthCheckIntervalMs > 0) {
      registered.healthCheckTimer = setInterval(() => {
        this.runHealthCheck(config.id).catch((err) => {
          log.error(`[MultiSourceAggregator] Health check failed for ${config.id}:`, err);
        });
      }, config.healthCheckIntervalMs);
    }

    this.emit('source-added', config.id);
    log.info(`[MultiSourceAggregator] Source added: ${config.name} (${config.id}), priority=${config.priority}`);
  }

  /**
   * Remove a registered source and stop its health checks.
   */
  removeSource(id: DataSourceId): boolean {
    const source = this.sources.get(id);
    if (!source) {
      log.warn(`[MultiSourceAggregator] Cannot remove source "${id}": not found`);
      return false;
    }

    if (source.healthCheckTimer) {
      clearInterval(source.healthCheckTimer);
      source.healthCheckTimer = null;
    }

    this.sources.delete(id);
    this.emit('source-removed', id);
    log.info(`[MultiSourceAggregator] Source removed: ${source.config.name} (${id})`);
    return true;
  }

  /**
   * Enable or disable a source at runtime.
   */
  setSourceEnabled(id: DataSourceId, enabled: boolean): boolean {
    const source = this.sources.get(id);
    if (!source) return false;
    source.config.enabled = enabled;
    this.emit('source-toggled', id, enabled);
    log.info(`[MultiSourceAggregator] Source ${id} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Get the configuration for a source.
   */
  getSourceConfig(id: DataSourceId): DataSourceConfig | undefined {
    return this.sources.get(id)?.config;
  }

  /**
   * Get list of all registered source IDs.
   */
  getSourceIds(): DataSourceId[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Get the number of registered sources.
   */
  get sourceCount(): number {
    return this.sources.size;
  }

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------

  /**
   * Fetch data from the highest-priority healthy source.
   * Falls back to lower-priority sources if the primary fails.
   */
  async fetchBest(symbol: string): Promise<DataPoint> {
    const sorted = this.getSortedEnabledSources();

    if (sorted.length === 0) {
      const err = new Error('No enabled sources available');
      this.emit('fetch-error', symbol, err);
      throw err;
    }

    const errors: Array<{ source: DataSourceId; error: Error }> = [];

    for (const source of sorted) {
      if (!this.isSourceAvailable(source)) {
        continue;
      }

      try {
        const result = await this.fetchFromSource(source, symbol);
        if (result.success && result.data) {
          // Track latency and source weight (JVS-41-01 Extensions)
          this.recordLatency(source.config.id, result.latencyMs);
          this.recordSourceSelection(
            symbol,
            source.config.id,
            sorted.map((s) => s.config.id),
            'best-priority'
          );
          this.emit('fetch-success', symbol, source.config.id, result.data);
          return result.data;
        }
        if (result.error) {
          errors.push({ source: source.config.id, error: result.error });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push({ source: source.config.id, error });
      }
    }

    const fallbackErr = new Error(
      `All sources failed for symbol "${symbol}": ${errors.map((e) => `${e.source}: ${e.error.message}`).join('; ')}`
    );
    this.emit('fetch-error', symbol, fallbackErr);
    throw fallbackErr;
  }

  /**
   * Fetch data from ALL enabled sources and compute consensus.
   * Returns aggregation result with best data point and consensus score.
   */
  async fetchAll(symbol: string): Promise<AggregationResult> {
    const sources = this.getSortedEnabledSources();

    if (sources.length === 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'No enabled sources available');
    }

    const results = await Promise.allSettled(
      sources.map((s) => this.fetchFromSource(s, symbol))
    );

    const dataPoints: DataPoint[] = [];
    const failures: Array<{ source: DataSourceId; reason: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = sources[i];

      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        dataPoints.push(result.value.data);
        // Track latency for successful fetches (JVS-41-01 Extension)
        this.recordLatency(source.config.id, result.value.latencyMs);
      } else {
        const reason =
          result.status === 'rejected'
            ? String(result.reason)
            : result.value?.error?.message ?? 'Unknown failure';
        failures.push({ source: source.config.id, reason });
      }
    }

    if (dataPoints.length === 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `All sources failed for "${symbol}": ${failures.map((f) => `${f.source}: ${f.reason}`).join('; ')}`);
    }

    // Sort by priority (lower number = higher priority)
    dataPoints.sort((a, b) => {
      const sourceA = this.sources.get(a.source);
      const sourceB = this.sources.get(b.source);
      return (sourceA?.config.priority ?? 999) - (sourceB?.config.priority ?? 999);
    });

    // Pick best: prioritize quality, then confidence, then priority
    const bestData = this.selectBestDataPoint(dataPoints);
    const consensus = this.getConsensus(dataPoints);

    const aggregationResult: AggregationResult = {
      symbol,
      bestData,
      allSources: dataPoints,
      consensus,
      timestamp: Date.now(),
    };

    this.emit('fetch-all-complete', symbol, aggregationResult);
    return aggregationResult;
  }

  /**
   * Fetch from a single source with timeout and retry logic.
   */
  private async fetchFromSource(
    source: RegisteredSource,
    symbol: string
  ): Promise<FetchAttemptResult> {
    const { config, fetcher } = source;
    const maxRetries = config.maxRetries > 0 ? config.maxRetries : MAX_RETRIES_DEFAULT;
    const timeoutMs = config.timeoutMs > 0 ? config.timeoutMs : FETCH_TIMEOUT_DEFAULT;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        log.debug(`[MultiSourceAggregator] Retry ${attempt}/${maxRetries} for ${config.id} [${symbol}]`);
        // Exponential backoff
        await this.sleep(Math.min(100 * Math.pow(2, attempt - 1), 2000));
      }

      const startTime = performance.now();

      try {
        const data = await this.withTimeout(
          fetcher(symbol),
          timeoutMs,
          `Source ${config.id} timed out after ${timeoutMs}ms`
        );

        const latencyMs = performance.now() - startTime;
        this.recordSuccess(source, latencyMs);

        return { success: true, data, latencyMs };
      } catch (err) {
        const latencyMs = performance.now() - startTime;
        lastError = err instanceof Error ? err : new Error(String(err));
        this.recordError(source, latencyMs);
        log.warn(
          `[MultiSourceAggregator] Source ${config.id} attempt ${attempt + 1} failed [${symbol}]: ${lastError.message}`
        );
      }
    }

    return { success: false, error: lastError, latencyMs: 0 };
  }

  /**
   * Select the best data point from a set of results.
   * Scoring: quality weight * 0.4 + confidence * 0.35 + priority rank * 0.25
   */
  private selectBestDataPoint(dataPoints: DataPoint[]): DataPoint {
    if (dataPoints.length === 1) return dataPoints[0];

    let bestScore = -1;
    let best = dataPoints[0];

    for (const dp of dataPoints) {
      const source = this.sources.get(dp.source);
      const priorityRank = source ? 1 / (source.config.priority + 1) : 0.5;
      const qualityWeight = QUALITY_WEIGHTS[dp.quality];
      const confidence = dp.confidence;

      const score = qualityWeight * 0.4 + confidence * 0.35 + priorityRank * 0.25;

      if (score > bestScore) {
        bestScore = score;
        best = dp;
      }
    }

    return best;
  }

  // --------------------------------------------------------------------------
  // Health Monitoring
  // --------------------------------------------------------------------------

  /**
   * Get health status of all registered sources.
   */
  getHealth(): SourceHealth[] {
    return Array.from(this.sources.values()).map((s) => ({ ...s.health }));
  }

  /**
   * Get health for a specific source.
   */
  getSourceHealth(id: DataSourceId): SourceHealth | undefined {
    const source = this.sources.get(id);
    return source ? { ...source.health } : undefined;
  }

  /**
   * Run a health check probe on a specific source.
   * Uses a special symbol "__healthcheck__" to test connectivity.
   */
  private async runHealthCheck(id: DataSourceId): Promise<void> {
    const source = this.sources.get(id);
    if (!source || !source.config.enabled) return;

    const startTime = performance.now();
    try {
      await this.withTimeout(
        source.fetcher('__healthcheck__'),
        source.config.timeoutMs,
        `Health check timeout for ${id}`
      );
      const latencyMs = performance.now() - startTime;
      source.health.latencyMs = latencyMs;
      source.health.lastCheck = Date.now();

      // Improve status if degraded
      if (source.health.status === 'degraded') {
        source.health.status = 'healthy';
        this.emit('source-recovered', id);
        log.info(`[MultiSourceAggregator] Source ${id} recovered`);
      }
    } catch {
      source.health.errorCount++;
      source.health.lastCheck = Date.now();

      if (source.health.errorCount >= 3) {
        source.health.status = 'unavailable';
        this.emit('source-unavailable', id);
        log.warn(`[MultiSourceAggregator] Source ${id} marked unavailable after ${source.health.errorCount} errors`);
      } else {
        source.health.status = 'degraded';
        this.emit('source-degraded', id);
      }
    }
  }

  /**
   * Manually trigger health checks on all sources.
   */
  async checkAllSources(): Promise<SourceHealth[]> {
    const checks = Array.from(this.sources.keys()).map((id) =>
      this.runHealthCheck(id).catch((err) => {
        log.error(`[MultiSourceAggregator] Health check error for ${id}:`, err);
      })
    );
    await Promise.all(checks);
    return this.getHealth();
  }

  /**
   * Reset health state for a source.
   */
  resetHealth(id: DataSourceId): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    source.health = {
      id,
      status: 'healthy',
      latencyMs: 0,
      successRate: 1.0,
      lastCheck: Date.now(),
      errorCount: 0,
    };
    source.stats = { requests: 0, errors: 0, avgLatency: 0, totalLatency: 0 };
    this.emit('health-reset', id);
    return true;
  }

  /**
   * Check if a source is available for fetching.
   */
  private isSourceAvailable(source: RegisteredSource): boolean {
    return source.config.enabled && source.health.status !== 'unavailable';
  }

  // --------------------------------------------------------------------------
  // Consensus
  // --------------------------------------------------------------------------

  /**
   * Compute consensus score (0-1) for a set of data points.
   *
   * Consensus measures how much sources agree on the price.
   * 1.0 = perfect agreement, 0.0 = total disagreement.
   *
   * Algorithm:
   * - Calculate mean price
   * - For each source, compute deviation from mean as a fraction
   * - Score = 1 - (average deviation / threshold), clamped to [0, 1]
   */
  getConsensus(sources: DataPoint[]): number {
    if (sources.length === 0) return 0;
    if (sources.length === 1) return 1;

    // Filter out unavailable quality
    const valid = sources.filter((s) => s.quality !== 'unavailable');
    if (valid.length === 0) return 0;
    if (valid.length === 1) return 1;

    const meanPrice = valid.reduce((sum, s) => sum + s.price, 0) / valid.length;

    if (meanPrice === 0) return 0;

    const deviations = valid.map((s) => Math.abs(s.price - meanPrice) / meanPrice);
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;

    // Normalize: 0 deviation = 1.0, threshold deviation = 0.0
    const score = Math.max(0, 1 - avgDeviation / CONSENSUS_THRESHOLD);
    return Math.round(score * 10000) / 10000; // 4 decimal places
  }

  /**
   * Get the price spread (max - min) across sources.
   */
  getPriceSpread(sources: DataPoint[]): { min: number; max: number; spread: number; spreadPct: number } {
    if (sources.length === 0) {
      return { min: 0, max: 0, spread: 0, spreadPct: 0 };
    }

    const prices = sources.map((s) => s.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = max - min;
    const spreadPct = min > 0 ? (spread / min) * 100 : 0;

    return { min, max, spread, spreadPct };
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get request/error/latency statistics for all sources.
   */
  getSourceStats(): Record<DataSourceId, SourceStats> {
    const result = {} as Record<DataSourceId, SourceStats>;

    for (const [id, source] of this.sources) {
      result[id] = {
        requests: source.stats.requests,
        errors: source.stats.errors,
        avgLatency: source.stats.avgLatency,
      };
    }

    return result;
  }

  /**
   * Get stats for a single source.
   */
  getSingleSourceStats(id: DataSourceId): SourceStats | undefined {
    const source = this.sources.get(id);
    if (!source) return undefined;
    return {
      requests: source.stats.requests,
      errors: source.stats.errors,
      avgLatency: source.stats.avgLatency,
    };
  }

  /**
   * Get the overall error rate across all sources.
   */
  getOverallErrorRate(): number {
    let totalRequests = 0;
    let totalErrors = 0;

    for (const source of this.sources.values()) {
      totalRequests += source.stats.requests;
      totalErrors += source.stats.errors;
    }

    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  /**
   * Get aggregate statistics summary.
   */
  getStatsSummary(): {
    totalSources: number;
    enabledSources: number;
    healthySources: number;
    degradedSources: number;
    unavailableSources: number;
    totalRequests: number;
    totalErrors: number;
    overallErrorRate: number;
  } {
    let enabled = 0;
    let healthy = 0;
    let degraded = 0;
    let unavailable = 0;
    let totalRequests = 0;
    let totalErrors = 0;

    for (const source of this.sources.values()) {
      if (source.config.enabled) enabled++;
      switch (source.health.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unavailable':
          unavailable++;
          break;
      }
      totalRequests += source.stats.requests;
      totalErrors += source.stats.errors;
    }

    return {
      totalSources: this.sources.size,
      enabledSources: enabled,
      healthySources: healthy,
      degradedSources: degraded,
      unavailableSources: unavailable,
      totalRequests,
      totalErrors,
      overallErrorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
    };
  }

  // --------------------------------------------------------------------------
  // Recording
  // --------------------------------------------------------------------------

  private recordSuccess(source: RegisteredSource, latencyMs: number): void {
    source.stats.requests++;
    source.stats.totalLatency += latencyMs;
    source.stats.avgLatency = source.stats.totalLatency / source.stats.requests;

    // Update health success rate (exponential moving average)
    const alpha = 0.1;
    source.health.successRate = source.health.successRate * (1 - alpha) + 1.0 * alpha;
    source.health.latencyMs = latencyMs;
    source.health.lastCheck = Date.now();

    // Recover from degraded if success rate is good
    if (source.health.status === 'degraded' && source.health.successRate > 0.8) {
      source.health.status = 'healthy';
      this.emit('source-recovered', source.config.id);
    }
  }

  private recordError(source: RegisteredSource, latencyMs: number): void {
    source.stats.requests++;
    source.stats.errors++;
    source.stats.totalLatency += latencyMs;
    source.stats.avgLatency = source.stats.totalLatency / source.stats.requests;

    source.health.errorCount++;
    source.health.lastCheck = Date.now();

    // Update success rate
    const alpha = 0.1;
    source.health.successRate = source.health.successRate * (1 - alpha) + 0.0 * alpha;

    // Degrade if too many errors
    if (source.health.errorCount >= 5) {
      source.health.status = 'unavailable';
      this.emit('source-unavailable', source.config.id);
    } else if (source.health.errorCount >= 2) {
      source.health.status = 'degraded';
      this.emit('source-degraded', source.config.id);
    }
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  /**
   * Get sources sorted by priority (lower number = higher priority).
   */
  private getSortedEnabledSources(): RegisteredSource[] {
    return Array.from(this.sources.values())
      .filter((s) => s.config.enabled)
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  /**
   * Wrap a promise with a timeout.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Sleep for a given duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --------------------------------------------------------------------------
  // Data Deduplication (JVS-41-01 Extension)
  // --------------------------------------------------------------------------

  /**
   * Detect and remove duplicate data points across sources.
   * Two data points are considered duplicates if they share the same symbol,
   * source, and have prices within `tolerance` of each other.
   */
  deduplicateDataPoints(dataPoints: DataPoint[], tolerance: number = 0.001): DataPoint[] {
    if (dataPoints.length <= 1) return [...dataPoints];

    const unique: DataPoint[] = [];
    const seen = new Set<string>();

    for (const dp of dataPoints) {
      // Create a normalized key: symbol + source + rounded price
      const priceBucket = Math.round(dp.price / tolerance) * tolerance;
      const key = `${dp.symbol}:${dp.source}:${priceBucket}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(dp);
      } else {
        // Keep the one with higher confidence
        const existingIdx = unique.findIndex(
          (u) => u.symbol === dp.symbol && u.source === dp.source
        );
        if (existingIdx >= 0 && dp.confidence > unique[existingIdx].confidence) {
          unique[existingIdx] = dp;
        }
      }
    }

    return unique;
  }

  /**
   * Get count of duplicates that would be removed.
   */
  countDuplicates(dataPoints: DataPoint[], tolerance: number = 0.001): number {
    return dataPoints.length - this.deduplicateDataPoints(dataPoints, tolerance).length;
  }

  // --------------------------------------------------------------------------
  // Data Validation Layer (JVS-41-01 Extension)
  // --------------------------------------------------------------------------

  /**
   * Get the current validation configuration.
   */
  getValidationConfig(): ValidationConfig {
    return { ...this._validationConfig };
  }

  /**
   * Set the validation configuration.
   */
  setValidationConfig(config: Partial<ValidationConfig>): void {
    this._validationConfig = { ...this._validationConfig, ...config };
  }

  /**
   * Validate a single data point against configured rules.
   * Checks price range, volume sanity, and timestamp freshness.
   */
  validateDataPoint(dp: DataPoint): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cfg = this._validationConfig;

    // Price range validation
    if (dp.price <= 0) {
      errors.push(`Invalid price: ${dp.price} (must be > 0)`);
    }
    if (dp.price < cfg.minPrice) {
      warnings.push(`Price ${dp.price} below minimum threshold ${cfg.minPrice}`);
    }
    if (dp.price > cfg.maxPrice) {
      errors.push(`Price ${dp.price} exceeds maximum ${cfg.maxPrice}`);
    }

    // Volume sanity check
    if (dp.volume < 0) {
      errors.push(`Negative volume: ${dp.volume}`);
    }
    if (dp.volume > cfg.maxVolumeRatio * 1_000_000_000) {
      warnings.push(`Unusually high volume: ${dp.volume}`);
    }

    // Timestamp freshness check
    const age = Date.now() - dp.timestamp;
    if (age > cfg.maxTimestampAgeMs) {
      warnings.push(`Stale data: ${Math.round(age / 1000)}s old (max ${Math.round(cfg.maxTimestampAgeMs / 1000)}s)`);
    }
    if (dp.timestamp > Date.now() + 60000) {
      errors.push(`Future timestamp: ${dp.timestamp}`);
    }

    // Confidence range check
    if (dp.confidence < 0 || dp.confidence > 1) {
      errors.push(`Confidence out of range: ${dp.confidence} (must be 0-1)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate an array of data points, returning per-point results.
   */
  validateAll(dataPoints: DataPoint[]): Array<{ point: DataPoint; result: ValidationResult }> {
    return dataPoints.map((dp) => ({ point: dp, result: this.validateDataPoint(dp) }));
  }

  /**
   * Filter data points to only valid ones.
   */
  filterValid(dataPoints: DataPoint[]): DataPoint[] {
    return dataPoints.filter((dp) => this.validateDataPoint(dp).valid);
  }

  // --------------------------------------------------------------------------
  // Price Anomaly Detection (JVS-41-01 Extension)
  // --------------------------------------------------------------------------

  /**
   * Detect price anomalies using the Z-score method.
   * A data point is flagged as anomalous if its z-score exceeds the threshold.
   */
  detectPriceAnomalies(dataPoints: DataPoint[], zScoreThreshold: number = 2.0): AnomalyRecord[] {
    if (dataPoints.length < 2) return [];

    const prices = dataPoints.map((dp) => dp.price);
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
    const stdDev = Math.sqrt(
      prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length
    );

    if (stdDev === 0) return [];

    const records: AnomalyRecord[] = dataPoints.map((dp) => {
      const zScore = Math.abs((dp.price - mean) / stdDev);
      return {
        symbol: dp.symbol,
        source: dp.source,
        price: dp.price,
        zScore: Math.round(zScore * 10000) / 10000,
        timestamp: Date.now(),
        flagged: zScore > zScoreThreshold,
      };
    });

    // Store records (with ring buffer cap)
    for (const record of records) {
      this._anomalyRecords.push(record);
    }
    while (this._anomalyRecords.length > this._maxAnomalyRecords) {
      this._anomalyRecords.shift();
    }

    return records;
  }

  /**
   * Detect anomalies using the IQR (Interquartile Range) method.
   * Values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR are flagged as outliers.
   */
  detectAnomaliesIQR(dataPoints: DataPoint[]): AnomalyRecord[] {
    if (dataPoints.length < 4) return [];

    const sorted = [...dataPoints].sort((a, b) => a.price - b.price);
    const n = sorted.length;

    const q1 = sorted[Math.floor(n * 0.25)].price;
    const q3 = sorted[Math.floor(n * 0.75)].price;
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return dataPoints.map((dp) => {
      const isOutlier = dp.price < lowerBound || dp.price > upperBound;
      const deviation = isOutlier
        ? dp.price < lowerBound
          ? (lowerBound - dp.price) / (iqr || 1)
          : (dp.price - upperBound) / (iqr || 1)
        : 0;

      return {
        symbol: dp.symbol,
        source: dp.source,
        price: dp.price,
        zScore: Math.round(deviation * 10000) / 10000,
        timestamp: Date.now(),
        flagged: isOutlier,
      };
    });
  }

  /**
   * Get all recorded anomaly records.
   */
  getAnomalyRecords(): AnomalyRecord[] {
    return [...this._anomalyRecords];
  }

  /**
   * Clear anomaly records.
   */
  clearAnomalyRecords(): void {
    this._anomalyRecords = [];
  }

  // --------------------------------------------------------------------------
  // Source Weight History (JVS-41-01 Extension)
  // --------------------------------------------------------------------------

  /**
   * Record a source selection event for analytics.
   */
  recordSourceSelection(
    symbol: string,
    selectedSource: DataSourceId,
    allSources: DataSourceId[],
    reason: string = 'best-priority'
  ): void {
    this._sourceWeightHistory.push({
      timestamp: Date.now(),
      symbol,
      selectedSource,
      allSources,
      reason,
    });
  }

  /**
   * Get the full source weight history.
   */
  getSourceWeightHistory(): SourceWeightEntry[] {
    return [...this._sourceWeightHistory];
  }

  /**
   * Get aggregated source weight distribution.
   * Returns how many times each source was selected.
   */
  getSourceWeightDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const entry of this._sourceWeightHistory) {
      dist[entry.selectedSource] = (dist[entry.selectedSource] || 0) + 1;
    }
    return dist;
  }

  /**
   * Clear source weight history.
   */
  clearSourceWeightHistory(): void {
    this._sourceWeightHistory = [];
  }

  // --------------------------------------------------------------------------
  // Source Latency Tracking (JVS-41-01 Extension)
  // --------------------------------------------------------------------------

  /**
   * Record a latency measurement for a source.
   */
  recordLatency(sourceId: DataSourceId, latencyMs: number): void {
    if (!this._latencySamples.has(sourceId)) {
      this._latencySamples.set(sourceId, []);
    }
    const samples = this._latencySamples.get(sourceId)!;
    samples.push(latencyMs);
    // Keep max 1000 samples per source (ring buffer)
    if (samples.length > 1000) {
      samples.shift();
    }
  }

  /**
   * Get latency percentiles for a specific source.
   * Returns p50, p95, p99 latency values.
   */
  getLatencyStats(sourceId: DataSourceId): LatencyStats | undefined {
    const samples = this._latencySamples.get(sourceId);
    if (!samples || samples.length === 0) return undefined;

    const sorted = [...samples].sort((a, b) => a - b);
    return {
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      samples: sorted.length,
    };
  }

  /**
   * Get latency stats for all sources.
   */
  getAllLatencyStats(): Record<string, LatencyStats> {
    const result: Record<string, LatencyStats> = {};
    for (const [id] of this._latencySamples) {
      const stats = this.getLatencyStats(id);
      if (stats) {
        result[id] = stats;
      }
    }
    return result;
  }

  /**
   * Clear latency tracking data.
   */
  clearLatencyStats(): void {
    this._latencySamples.clear();
  }

  /**
   * Clear latency stats for a specific source.
   */
  clearLatencyStatsForSource(sourceId: DataSourceId): boolean {
    return this._latencySamples.delete(sourceId);
  }

  /**
   * Calculate the Nth percentile from a sorted array.
   */
  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    if (sortedArr.length === 1) return sortedArr[0];
    const idx = (p / 100) * (sortedArr.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sortedArr[lower];
    const frac = idx - lower;
    return Math.round((sortedArr[lower] * (1 - frac) + sortedArr[upper] * frac) * 100) / 100;
  }

  // --------------------------------------------------------------------------
  // Batch Fetch (JVS-41-01 Extension)
  // --------------------------------------------------------------------------

  /**
   * Fetch data for multiple symbols in parallel with a configurable concurrency limit.
   * Uses fetchBest for each symbol.
   */
  async batchFetch(
    symbols: string[],
    concurrencyLimit: number = 5
  ): Promise<BatchFetchResult[]> {
    if (symbols.length === 0) return [];

    const results: BatchFetchResult[] = [];
    const queue = [...symbols];
    const executing: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      const symbol = queue.shift();
      if (!symbol) return;

      try {
        const data = await this.fetchBest(symbol);
        results.push({ symbol, success: true, data });
      } catch (err) {
        results.push({
          symbol,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Process next item in queue if any remain
      if (queue.length > 0) {
        const next = processNext();
        executing.push(next);
        await next;
      }
    };

    // Start initial batch up to concurrency limit
    const initialBatchSize = Math.min(concurrencyLimit, symbols.length);
    for (let i = 0; i < initialBatchSize; i++) {
      const p = processNext();
      executing.push(p);
    }
    await Promise.all(executing);

    this.emit('batch-fetch-complete', results);
    return results;
  }

  /**
   * Fetch all sources for a symbol with deduplication and validation applied.
   * Returns enhanced aggregation result.
   */
  async fetchAllWithDedup(symbol: string): Promise<AggregationResult & {
    duplicatesRemoved: number;
    validationResults: ValidationResult[];
    anomalies: AnomalyRecord[];
  }> {
    const result = await this.fetchAll(symbol);

    // Deduplicate
    const beforeDedup = result.allSources.length;
    const deduped = this.deduplicateDataPoints(result.allSources);
    const duplicatesRemoved = beforeDedup - deduped.length;

    // Validate
    const validationResults = deduped.map((dp) => this.validateDataPoint(dp));

    // Detect anomalies
    const anomalies = this.detectPriceAnomalies(deduped);

    // Record source weight
    this.recordSourceSelection(
      symbol,
      result.bestData.source,
      deduped.map((d) => d.source),
      'best-score'
    );

    return {
      ...result,
      allSources: deduped,
      duplicatesRemoved,
      validationResults,
      anomalies,
    };
  }

  /**
   * Destroy the aggregator: stop all health checks and remove listeners.
   */
  destroy(): void {
    for (const source of this.sources.values()) {
      if (source.healthCheckTimer) {
        clearInterval(source.healthCheckTimer);
        source.healthCheckTimer = null;
      }
    }
    this.sources.clear();
    this.removeAllListeners();
    log.info('[MultiSourceAggregator] Destroyed');
    this.emit('destroyed');
  }

  /**
   * Create a snapshot of the current aggregator state (for debugging).
   */
  toJSON(): object {
    return {
      sources: Array.from(this.sources.entries()).map(([id, s]) => ({
        id,
        name: s.config.name,
        priority: s.config.priority,
        enabled: s.config.enabled,
        health: { ...s.health },
        stats: { ...s.stats },
      })),
      // Enhancement state (JVS-41-01 Extensions)
      sourceWeightHistory: [...this._sourceWeightHistory],
      sourceWeightDistribution: this.getSourceWeightDistribution(),
      anomalyRecordCount: this._anomalyRecords.length,
      latencyStats: this.getAllLatencyStats(),
      validationConfig: { ...this._validationConfig },
    };
  }
}

// ============================================================================
// Factory Helper
// ============================================================================

/**
 * Create a pre-configured MultiSourceAggregator with default source configs.
 */
export function createDefaultAggregator(): MultiSourceAggregator {
  const aggregator = new MultiSourceAggregator();

  const defaultConfigs: DataSourceConfig[] = [
    {
      id: 'eastmoney',
      name: i18n.t('MultiSourceAggregator.k0'),
      priority: 1,
      enabled: true,
      timeoutMs: 5000,
      maxRetries: 2,
      healthCheckIntervalMs: 30000,
    },
    {
      id: 'sina',
      name: i18n.t('MultiSourceAggregator.k1'),
      priority: 2,
      enabled: true,
      timeoutMs: 5000,
      maxRetries: 2,
      healthCheckIntervalMs: 30000,
    },
    {
      id: 'tencent',
      name: i18n.t('MultiSourceAggregator.k2'),
      priority: 3,
      enabled: true,
      timeoutMs: 6000,
      maxRetries: 2,
      healthCheckIntervalMs: 30000,
    },
    {
      id: 'xueqiu',
      name: i18n.t('MultiSourceAggregator.k3'),
      priority: 4,
      enabled: true,
      timeoutMs: 8000,
      maxRetries: 1,
      healthCheckIntervalMs: 60000,
    },
  ];

  // Register with placeholder fetchers (to be replaced by real implementations)
  for (const config of defaultConfigs) {
    aggregator.addSource(config, async () => {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Source ${config.id} fetcher not implemented`);
    });
  }

  return aggregator;
}

export default MultiSourceAggregator;
