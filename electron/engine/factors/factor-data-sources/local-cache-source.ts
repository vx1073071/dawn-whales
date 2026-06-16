// ── R170 A4: Local Cache Data Source ────────────────────────────────────────
// First real data source wired into FactorDataProvider.
// Provides factor values from local file-based cache, supporting:
//   1. Pre-computed factor scores for common symbols
//   2. Offline fallback when external sources are unavailable
//   3. Degradation chain: local_cache → external → default_score
//
// This is the template pattern for all FactorDataProvider source registrations.

import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';
import { type FactorValue, type FactorSourceName } from '../factor-data-provider';
import { resolveFactorId, type FactorId, STANDARD_FACTOR_IDS } from '../factor-id-registry';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LocalCacheEntry {
  symbol: string;
  timestamp: number;
  source: string;
  factors: Record<string, {
    value: number;
    score: number;
    confidence: number;
    metadata?: Record<string, unknown>;
  }>;
}

export interface LocalCacheConfig {
  /** Directory to store cache files */
  cacheDir: string;
  /** Max cache age before considered stale (ms) */
  maxAgeMs: number;
  /** Auto-save interval (ms, 0 = manual only) */
  autoSaveIntervalMs: number;
}

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: LocalCacheConfig = {
  cacheDir: path.join(
    process.env.APPDATA || process.env.HOME || '/tmp',
    'quant-moo',
    'factor-cache'
  ),
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  autoSaveIntervalMs: 0,          // Manual save only by default
};

// ── Local Cache Source ──────────────────────────────────────────────────────

export class LocalCacheSource {
  private config: LocalCacheConfig;
  private cache = new Map<string, LocalCacheEntry>();
  private saveTimer: NodeJS.Timeout | null = null;
  public readonly sourceName: FactorSourceName = 'capital_flow';

  constructor(config?: Partial<LocalCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureCacheDir();
    this.loadFromDisk();
    log.info(`[LocalCacheSource] Initialized, dir=${this.config.cacheDir}`);
  }

  // ── Directory ───────────────────────────────────────────────────────────

  private ensureCacheDir(): void {
    try {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    } catch (e) {
      log.warn(`[LocalCacheSource] Cannot create cache dir: ${this.config.cacheDir}`, e);
    }
  }

  // ── Disk Persistence ────────────────────────────────────────────────────

  private cacheFilePath(): string {
    return path.join(this.config.cacheDir, 'factor-cache.json');
  }

  private loadFromDisk(): void {
    const fp = this.cacheFilePath();
    if (!fs.existsSync(fp)) {
      log.info('[LocalCacheSource] No existing cache file, starting fresh');
      return;
    }
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      const entries: LocalCacheEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        if (Date.now() - entry.timestamp < this.config.maxAgeMs) {
          this.cache.set(entry.symbol, entry);
        }
      }
      log.info(`[LocalCacheSource] Loaded ${this.cache.size} entries from disk`);
    } catch (e) {
      log.warn('[LocalCacheSource] Failed to load cache from disk', e);
    }
  }

  private saveToDisk(): void {
    const fp = this.cacheFilePath();
    try {
      const entries = [...this.cache.values()];
      fs.writeFileSync(fp, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (e) {
      log.warn('[LocalCacheSource] Failed to persist cache', e);
    }
  }

  // ── Cache Operations ────────────────────────────────────────────────────

  /**
   * Store factor data for a symbol.
   */
  store(
    symbol: string,
    factors: Record<string, { value: number; score: number; confidence: number; metadata?: Record<string, unknown> }>,
    source?: string,
  ): void {
    const entry: LocalCacheEntry = {
      symbol,
      timestamp: Date.now(),
      source: source || 'local_cache',
      factors,
    };
    this.cache.set(symbol, entry);

    // Debounced auto-save
    if (this.config.autoSaveIntervalMs > 0 && !this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveToDisk();
        this.saveTimer = null;
      }, this.config.autoSaveIntervalMs);
    }
  }

  /**
   * Update a single factor value for a symbol.
   */
  updateFactor(
    symbol: string,
    factorId: string,
    value: number,
    score: number,
    confidence: number,
  ): void {
    const resolved = resolveFactorId(factorId);
    const entry = this.cache.get(symbol);
    if (entry) {
      entry.factors[resolved] = { value, score, confidence };
      entry.timestamp = Date.now();
    } else {
      this.store(symbol, { [resolved]: { value, score, confidence } });
    }
  }

  /**
   * Retrieve all cached factors for a symbol.
   */
  get(symbol: string): LocalCacheEntry | null {
    const entry = this.cache.get(symbol);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.config.maxAgeMs) {
      this.cache.delete(symbol);
      return null;
    }
    return entry;
  }

  /**
   * Check if a symbol has cached data (and it's fresh).
   */
  has(symbol: string): boolean {
    return this.get(symbol) !== null;
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all cached symbols.
   */
  getCachedSymbols(): string[] {
    return [...this.cache.keys()];
  }

  /**
   * Force save to disk immediately.
   */
  flush(): void {
    this.saveToDisk();
  }

  // ── FactorDataProvider Fetcher ──────────────────────────────────────────

  /**
   * Returns a fetcher function compatible with FactorDataProvider.registerSource().
   * This is the bridge between LocalCacheSource and FactorDataProvider.
   */
  createFetcher(): (
    symbols: string[],
    period: string,
  ) => Promise<Map<string, FactorValue>> {
    return async (symbols: string[], period: string): Promise<Map<string, FactorValue>> => {
      const result = new Map<string, FactorValue>();

      for (const symbol of symbols) {
        const entry = this.get(symbol);
        if (!entry) continue;

        for (const [factorId, data] of Object.entries(entry.factors)) {
          const resolvedId = resolveFactorId(factorId);
          // FactorValue key: "factorId|symbol"
          const key = `${symbol}|${resolvedId}`;
          result.set(key, {
            factorId: resolvedId,
            value: data.value,
            score: data.score,
            confidence: data.confidence,
            source: this.sourceName,
            timestamp: entry.timestamp,
            metadata: data.metadata,
          });
        }
      }

      return result;
    };
  }

  // ── Seeding Helper ──────────────────────────────────────────────────────

  /**
   * Seed the cache with pre-computed factor values for common symbols.
   * Useful for development and testing without real data sources.
   *
   * NOTE: These are SEEDED values — isSimulated=true should be set
   * when these values are used in production reports.
   */
  seedDefaults(): void {
    const commonSymbols: Array<{
      symbol: string;
      factors: Record<string, { value: number; score: number; confidence: number }>;
    }> = [
      {
        symbol: 'HK:00700',
        factors: {
          [STANDARD_FACTOR_IDS.MOM_12M]: { value: 0.45, score: 85, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.MOM_1M]: { value: 0.12, score: 62, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.VOL_60D]: { value: 0.32, score: 45, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.RSI_14]: { value: 58, score: 72, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.QUAL]: { value: 0.18, score: 78, confidence: 0.6 },
          [STANDARD_FACTOR_IDS.HKEX_SOUTHBOUND]: { value: 0.35, score: 88, confidence: 0.5 },
        },
      },
      {
        symbol: 'US:AAPL',
        factors: {
          [STANDARD_FACTOR_IDS.MOM_12M]: { value: 0.28, score: 68, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.VOL_60D]: { value: 0.22, score: 75, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.QUAL]: { value: 0.95, score: 92, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.SIZE]: { value: 0.05, score: 30, confidence: 0.8 },
          [STANDARD_FACTOR_IDS.US_INST_HOLD]: { value: 0.62, score: 70, confidence: 0.5 },
        },
      },
      {
        symbol: 'HK:09988',
        factors: {
          [STANDARD_FACTOR_IDS.MOM_12M]: { value: 0.18, score: 55, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.MOM_1M]: { value: -0.05, score: 38, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.VOL_60D]: { value: 0.38, score: 35, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.RSI_14]: { value: 42, score: 48, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.GROWTH]: { value: 0.08, score: 55, confidence: 0.6 },
        },
      },
      {
        symbol: 'US:TSLA',
        factors: {
          [STANDARD_FACTOR_IDS.MOM_12M]: { value: 0.72, score: 92, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.MOM_1M]: { value: 0.35, score: 85, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.VOL_60D]: { value: 0.65, score: 18, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.RSI_14]: { value: 72, score: 82, confidence: 0.7 },
          [STANDARD_FACTOR_IDS.QUAL]: { value: -0.10, score: 25, confidence: 0.6 },
        },
      },
    ];

    for (const { symbol, factors } of commonSymbols) {
      const entry: LocalCacheEntry = {
        symbol,
        timestamp: Date.now(),
        source: 'seed_defaults',
        factors: Object.fromEntries(
          Object.entries(factors).map(([id, data]) => [
            id,
            {
              value: data.value,
              score: data.score,
              confidence: data.confidence,
              metadata: { seeded: true, isSimulated: true },
            },
          ])
        ),
      };
      this.cache.set(symbol, entry);
    }

    log.info(`[LocalCacheSource] Seeded ${commonSymbols.length * 5} default factor values`);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _localCacheSource: LocalCacheSource | null = null;

export function getLocalCacheSource(): LocalCacheSource {
  if (!_localCacheSource) {
    _localCacheSource = new LocalCacheSource();
    _localCacheSource.seedDefaults();
  }
  return _localCacheSource;
}
