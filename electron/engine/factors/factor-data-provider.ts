// ── R161 P0-U4: Factor Data Provider ──────────────────────────────────────
// Unified adapter layer for all factor data sources.
// ── R217-auto#2 (E2): 扩展 — 插件架构 + 零成本因子注册 ──────────────────

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
  factorId: string;
  value: number;
  score: number;
  confidence: number;
  source: FactorSourceName;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface FactorValues {
  symbol: string;
  period: FactorPeriod;
  factors: Record<string, FactorValue>;
  loadedAt: number;
  sourcesAvailable: FactorSourceName[];
  sourcesDegraded: FactorSourceName[];
  warnings: string[];
}

export interface BatchFactorResult {
  symbols: FactorValues[];
  errors: Array<{ symbol: string; error: string }>;
  totalTimeMs: number;
}

export interface FactorDataProviderConfig {
  cacheTtlMs: Record<FactorSourceName, number>;
  defaultScore: number;
  maxConcurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  enablePerformanceLog: boolean;
}

// ── Default TTL per source ─────────────────────────────────────────────────

const DEFAULT_TTL: Record<FactorSourceName, number> = {
  sentiment:              60_000,
  capital_flow:           120_000,
  institutional_flow:     120_000,
  fund_holdings:          300_000,
  stock_diagnosis:        300_000,
  factor_research:        300_000,
  factor_exposure:        300_000,
  factor_compatibility:   600_000,
  factor_cloud:           120_000,
  factor_asset_registry:  600_000,
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
  protected config: FactorDataProviderConfig;
  protected cache = new Map<string, { data: FactorValues; expiresAt: number }>();
  protected sourceCallbacks = new Map<FactorSourceName, (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>>();
  protected inflight = new Map<string, Promise<Map<string, FactorValue>>>();

  constructor(config?: Partial<FactorDataProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerSource(
    name: FactorSourceName,
    fetcher: (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>,
  ): void {
    this.sourceCallbacks.set(name, fetcher);
  }

  hasSource(name: FactorSourceName): boolean {
    return this.sourceCallbacks.has(name);
  }

  getRegisteredSources(): FactorSourceName[] {
    return Array.from(this.sourceCallbacks.keys());
  }

  async fetchFactors(
    symbol: string,
    period: FactorPeriod = '1m',
    options?: { sources?: FactorSourceName[]; forceRefresh?: boolean },
  ): Promise<FactorValues> {
    const cacheKey = `${symbol}:${period}:${(options?.sources ?? []).sort().join(',')}`;
    if (!options?.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) return cached.data;
    }

    const warnings: string[] = [];
    const sourcesAvailable: FactorSourceName[] = [];
    const sourcesDegraded: FactorSourceName[] = [];
    const factors: Record<string, FactorValue> = {};
    const sources = options?.sources ?? this.getRegisteredSources();

    const results = await this.pooledFetch(symbol, sources, period);

    for (const source of sources) {
      const result = results.get(source);
      if (result) {
        sourcesAvailable.push(source);
        factors[result.factorId] = result;
      } else {
        sourcesDegraded.push(source);
        warnings.push(`Source '${source}' unavailable for ${symbol}`);
        factors[`${source}::default`] = {
          factorId: source, value: 0, score: this.config.defaultScore,
          confidence: 0, source, timestamp: Date.now(), metadata: { degraded: true },
        };
      }
    }

    const factorValues: FactorValues = {
      symbol, period, factors, loadedAt: Date.now(),
      sourcesAvailable, sourcesDegraded, warnings,
    };

    const minTtl = Math.min(...sources.map(s => this.config.cacheTtlMs[s] ?? 60_000));
    this.cache.set(cacheKey, { data: factorValues, expiresAt: Date.now() + minTtl });
    return factorValues;
  }

  async fetchBatch(
    symbols: string[],
    period: FactorPeriod = '1m',
    options?: { sources?: FactorSourceName[]; forceRefresh?: boolean },
  ): Promise<BatchFactorResult> {
    const startTime = Date.now();
    const results: FactorValues[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];
    const chunkSize = this.config.maxConcurrency;

    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map(sym => this.fetchFactors(sym, period, options)),
      );
      for (let j = 0; j < chunkResults.length; j++) {
        const result = chunkResults[j];
        if (result.status === 'fulfilled') results.push(result.value);
        else errors.push({ symbol: chunk[j], error: result.reason?.message ?? 'Unknown error' });
      }
    }
    return { symbols: results, errors, totalTimeMs: Date.now() - startTime };
  }

  async getScore(symbol: string, period?: FactorPeriod, options?: { sources?: FactorSourceName[]; weights?: Record<string, number> }): Promise<number> {
    const values = await this.fetchFactors(symbol, period, options);
    return this.computeWeightedScore(values, options?.weights);
  }

  async getTopScores(symbols: string[], topN: number = 20, period?: FactorPeriod, options?: { sources?: FactorSourceName[]; weights?: Record<string, number> }): Promise<Array<{ symbol: string; score: number; values: FactorValues }>> {
    const batch = await this.fetchBatch(symbols, period, options);
    const scored = batch.symbols.map(v => ({
      symbol: v.symbol, score: this.computeWeightedScore(v, options?.weights), values: v,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  async getFactorValue(symbol: string, factorId: string, period?: FactorPeriod): Promise<FactorValue | null> {
    const values = await this.fetchFactors(symbol, period);
    return values.factors[factorId] ?? null;
  }

  getCacheStats(): { size: number; entries: Array<{ key: string; expiresAt: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, val]) => ({ key, expiresAt: val.expiresAt }));
    return { size: this.cache.size, entries };
  }

  clearCache(): void { this.cache.clear(); }
  evictExpired(): number {
    const now = Date.now(); let count = 0;
    for (const [key, val] of Array.from(this.cache)) { if (val.expiresAt <= now) { this.cache.delete(key); count++; } }
    return count;
  }

  async warmup(symbols: string[], period: FactorPeriod = '1m'): Promise<void> {
    await this.fetchBatch(symbols, period);
  }

  async healthCheck(): Promise<Array<{ source: FactorSourceName; available: boolean; error?: string }>> {
    const testSymbol = 'US.AAPL';
    const results: Array<{ source: FactorSourceName; available: boolean; error?: string }> = [];
    for (const source of Array.from(this.getRegisteredSources())) {
      try {
        const fetcher = this.sourceCallbacks.get(source);
        if (!fetcher) { results.push({ source, available: false, error: 'Fetcher not registered' }); continue; }
        await fetcher([testSymbol], '1m');
        results.push({ source, available: true });
      } catch (err: unknown) {
        results.push({ source, available: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }

  private async pooledFetch(symbol: string, sources: FactorSourceName[], period: FactorPeriod): Promise<Map<FactorSourceName, FactorValue>> {
    const results = new Map<FactorSourceName, FactorValue>();
    const promises = sources.map(async (source) => {
      const inflightKey = `${source}:${symbol}:${period}`;
      let promise = this.inflight.get(inflightKey);
      if (!promise) {
        const fetcher = this.sourceCallbacks.get(source);
        if (!fetcher) return { source, value: null as FactorValue | null };
        promise = this.fetchWithRetry(fetcher, [symbol], period).then(map => { this.inflight.delete(inflightKey); return map; }).catch(() => { this.inflight.delete(inflightKey); return new Map<string, FactorValue>(); });
        this.inflight.set(inflightKey, promise);
      }
      const map = await promise;
      return { source, value: map.get(symbol) ?? null };
    });
    const settled = await Promise.allSettled(promises);
    for (const result of settled) { if (result.status === 'fulfilled' && result.value.value) results.set(result.value.source, result.value.value); }
    return results;
  }

  private async fetchWithRetry(fetcher: (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>, symbols: string[], period: FactorPeriod): Promise<Map<string, FactorValue>> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try { return await fetcher(symbols, period); } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.config.maxRetries) await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * Math.pow(2, attempt)));
      }
    }
    throw lastError;
  }

  private computeWeightedScore(values: FactorValues, weights?: Record<string, number>): number {
    const factors = Object.values(values.factors);
    if (factors.length === 0) return this.config.defaultScore;
    if (weights && Object.keys(weights).length > 0) {
      let totalWeight = 0, weightedSum = 0;
      for (const fv of factors) { const w = weights[fv.factorId] ?? 0; if (w > 0) { weightedSum += fv.score * w; totalWeight += w; } }
      return totalWeight > 0 ? weightedSum / totalWeight : this.config.defaultScore;
    }
    const sum = factors.reduce((s, fv) => s + fv.score, 0);
    return sum / factors.length;
  }

  reset(): void { this.cache.clear(); this.inflight.clear(); this.sourceCallbacks.clear(); }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: FactorDataProvider | null = null;

export function getFactorDataProvider(config?: Partial<FactorDataProviderConfig>): FactorDataProvider {
  if (!instance) instance = new FactorDataProvider(config);
  else if (config) { instance.reset(); instance = new FactorDataProvider(config); }
  return instance;
}

export function resetFactorDataProvider(): void { instance?.reset(); instance = null; }

export async function initializeFactorDataProvider(config?: Partial<FactorDataProviderConfig>): Promise<FactorDataProvider> {
  const provider = getFactorDataProvider(config);
  try {
    const { getLocalCacheSource } = await import('./factor-data-sources/local-cache-source');
    const cache = getLocalCacheSource();
    provider.registerSource('capital_flow', cache.createFetcher());
  } catch (err) { log.warn('[FactorDataProvider] R170 A4: Failed to wire local cache source', err); }
  return provider;
}

export function createDefaultFactorValue(factorId: string, source: FactorSourceName, score?: number): FactorValue {
  return { factorId, value: 0, score: score ?? 50, confidence: 0, source, timestamp: Date.now(), metadata: { degraded: true, reason: 'source_unavailable' } };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── R217-auto#2 (E2): EXTENSIONS — 插件架构 + 零成本因子注册 ──────────────
// ═══════════════════════════════════════════════════════════════════════════

export type FactorCategory = 'momentum' | 'value' | 'quality' | 'sentiment' | 'capital_flow' | 'volatility' | 'growth' | 'dividend' | 'macro' | 'crypto' | 'commodity' | 'arbitrage' | 'cross_market' | 'custom';
export type FactorStatus = 'active' | 'deprecated' | 'experimental' | 'beta' | 'sunset';

export interface FactorMeta {
  factorId: string; name: string; nameCn: string; category: FactorCategory; unit: string;
  description: string; markets: string[]; sources: FactorSourceName[]; version: number;
  status: FactorStatus; deprecatedAt?: number; migratedTo?: string; pricePerQuery?: number;
  defaultWeight?: number; minValue?: number; maxValue?: number; tags: string[];
  createdAt: number; updatedAt: number;
}

export interface SourcePriorityConfig {
  chain: FactorSourceName[]; timeoutMs: Record<FactorSourceName, number>;
  cacheIntermediates: boolean; minConfidence: number;
}

export interface SourceChainResult {
  factorId: string; value: FactorValue; source: FactorSourceName;
  chainIndex: number; latencyMs: number; fallbackUsed: boolean; fallbackReason?: string;
}

export interface FactorSourcePlugin {
  pluginId: string; name: string; version: string; description: string;
  sourceName: FactorSourceName; markets: string[]; factorIds: string[];
  init: (config?: Record<string, unknown>) => Promise<void>;
  fetch: (symbols: string[], period: FactorPeriod) => Promise<Map<string, FactorValue>>;
  healthCheck: () => Promise<{ available: boolean; latencyMs: number; error?: string }>;
  configSchema?: Record<string, unknown>;
  destroy?: () => Promise<void>;
}

export interface PluginRegistry {
  pluginId: string; plugin: FactorSourcePlugin; registeredAt: number;
  status: 'active' | 'paused' | 'error';
  stats: { queries: number; errors: number; avgLatencyMs: number; lastUsedAt: number | null };
}

export interface FactorGroupQuery { factorIds: string[]; sources?: FactorSourceName[]; groupName?: string; }

export interface FactorGroupResult {
  groupName: string; symbols: string[]; results: Map<string, FactorValue[]>;
  latencyMs: number; errors: Array<{ symbol: string; factorId: string; error: string }>;
}

export interface SourceHealthRecord {
  source: FactorSourceName; totalQueries: number; successfulQueries: number; failedQueries: number;
  lastSuccessAt: number | null; lastFailureAt: number | null; lastError: string | null;
  avgLatencyMs: number; p95LatencyMs: number; p99LatencyMs: number;
  uptimePercent: number; status: 'healthy' | 'degraded' | 'down';
}

export interface FactorLifecycleEvent {
  factorId: string; event: 'created'|'updated'|'deprecated'|'sunset'|'migrated'|'reactivated';
  timestamp: number; details: string; migratedTo?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ExtendedFactorDataProvider — plugin architecture for zero-cost factor addition
// ═══════════════════════════════════════════════════════════════════════════

export class ExtendedFactorDataProvider {
  private factorMeta = new Map<string, FactorMeta>();
  private plugins = new Map<string, PluginRegistry>();
  private sourceChains = new Map<string, SourcePriorityConfig>();
  private sourceHealth = new Map<FactorSourceName, SourceHealthRecord>();
  private lifecycleLog: FactorLifecycleEvent[] = [];
  private latencySamples = new Map<FactorSourceName, number[]>();

  // ── Factor Metadata Registry ──────────────────────────────────────────

  registerFactor(meta: FactorMeta): void {
    if (this.factorMeta.has(meta.factorId)) {
      const existing = this.factorMeta.get(meta.factorId)!;
      if (existing.version >= meta.version) return;
      this.recordLifecycle(meta.factorId, 'updated', `v${existing.version} → v${meta.version}`);
    } else {
      this.recordLifecycle(meta.factorId, 'created', `v${meta.version}`);
    }
    this.factorMeta.set(meta.factorId, { ...meta, updatedAt: Date.now() });
  }

  registerFactors(metas: FactorMeta[]): void { metas.forEach(m => this.registerFactor(m)); }

  getFactorMeta(factorId: string): FactorMeta | null { return this.factorMeta.get(factorId) ?? null; }

  listFactors(options?: { category?: FactorCategory; status?: FactorStatus; market?: string }): FactorMeta[] {
    let factors = Array.from(this.factorMeta.values());
    if (options?.category) factors = factors.filter(f => f.category === options.category);
    if (options?.status) factors = factors.filter(f => f.status === options.status);
    if (options?.market) factors = factors.filter(f => f.markets.includes(options.market!));
    return factors.sort((a, b) => a.nameCn.localeCompare(b.nameCn));
  }

  deprecateFactor(factorId: string, migratedTo?: string): void {
    const meta = this.factorMeta.get(factorId);
    if (!meta) return;
    meta.status = 'deprecated'; meta.deprecatedAt = Date.now();
    if (migratedTo) meta.migratedTo = migratedTo;
    this.factorMeta.set(factorId, meta);
    this.recordLifecycle(factorId, 'deprecated', migratedTo ? `→ ${migratedTo}` : 'end-of-life');
  }

  reactivateFactor(factorId: string): void {
    const meta = this.factorMeta.get(factorId);
    if (!meta || meta.status !== 'deprecated') return;
    meta.status = 'active'; meta.deprecatedAt = undefined; meta.migratedTo = undefined;
    this.factorMeta.set(factorId, meta);
    this.recordLifecycle(factorId, 'reactivated', '');
  }

  // ── Plugin System ─────────────────────────────────────────────────────

  async registerPlugin(plugin: FactorSourcePlugin): Promise<void> {
    if (this.plugins.has(plugin.pluginId)) return;
    this.plugins.set(plugin.pluginId, {
      pluginId: plugin.pluginId, plugin, registeredAt: Date.now(), status: 'active',
      stats: { queries: 0, errors: 0, avgLatencyMs: 0, lastUsedAt: null },
    });
    try { await plugin.init(); }
    catch (err) { this.plugins.get(plugin.pluginId)!.status = 'error'; console.error(`[Plugin] ${plugin.pluginId} init failed:`, err); }
  }

  async unregisterPlugin(pluginId: string): Promise<void> {
    const reg = this.plugins.get(pluginId); if (!reg) return;
    try { await reg.plugin.destroy?.(); } catch (_) { /* best effort */ }
    this.plugins.delete(pluginId);
  }

  listPlugins(): PluginRegistry[] { return Array.from(this.plugins.values()); }

  async queryFactorViaPlugin(pluginId: string, symbols: string[], period: FactorPeriod): Promise<Map<string, FactorValue>> {
    const reg = this.plugins.get(pluginId);
    if (!reg || reg.status === 'error') throw new Error(`Plugin ${pluginId} not available`);
    const startMs = Date.now(); reg.stats.lastUsedAt = startMs;
    try {
      const result = await reg.plugin.fetch(symbols, period);
      const latencyMs = Date.now() - startMs;
      reg.stats.queries++;
      reg.stats.avgLatencyMs = (reg.stats.avgLatencyMs * (reg.stats.queries - 1) + latencyMs) / reg.stats.queries;
      this.recordSourceHealth(reg.plugin.sourceName, true, latencyMs);
      return result;
    } catch (err) {
      reg.stats.errors++;
      this.recordSourceHealth(reg.plugin.sourceName, false, 0, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  // ── Source Priority Chain ─────────────────────────────────────────────

  setSourcePriority(factorId: string, config: SourcePriorityConfig): void { this.sourceChains.set(factorId, config); }

  async fetchWithPriorityChain(factorId: string, symbols: string[], period: FactorPeriod): Promise<SourceChainResult[]> {
    const chainConfig = this.sourceChains.get(factorId);
    const results: SourceChainResult[] = [];

    if (!chainConfig) {
      for (const [, reg] of Array.from(this.plugins)) {
        if (reg.status !== 'active') continue;
        try {
          const startMs = Date.now();
          const map = await reg.plugin.fetch(symbols, period);
          for (const [, value] of Array.from(map)) {
            if (value.factorId === factorId || value.factorId.startsWith(factorId)) {
              results.push({ factorId, value, source: reg.plugin.sourceName, chainIndex: 0, latencyMs: Date.now() - startMs, fallbackUsed: false });
            }
          }
        } catch (_e) { /* try next */ }
      }
      return results;
    }

    for (let i = 0; i < chainConfig.chain.length; i++) {
      const source = chainConfig.chain[i];
      const timeout = chainConfig.timeoutMs[source] ?? 5000;
      const startMs = Date.now();
      try {
        const plugin = Array.from(this.plugins.values()).find(r => r.plugin.sourceName === source && r.status === 'active');
        if (!plugin) {
          results.push({ factorId, value: createDefaultFactorValue(factorId, source), source, chainIndex: i, latencyMs: 0, fallbackUsed: true, fallbackReason: `Source ${source} not registered` });
          continue;
        }
        const map = await this.withTimeout(plugin.plugin.fetch(symbols, period), timeout);
        for (const [, value] of Array.from(map)) {
          if ((value.factorId === factorId || value.factorId.startsWith(factorId)) && value.confidence >= chainConfig.minConfidence) {
            results.push({ factorId, value, source, chainIndex: i, latencyMs: Date.now() - startMs, fallbackUsed: i > 0, fallbackReason: i > 0 ? 'Fell back from primary' : undefined });
            break;
          }
        }
        if (results.length > 0) break;
      } catch (_err) { if (i >= chainConfig.chain.length - 1) { /* all exhausted */ } }
    }

    if (results.length === 0) {
      results.push({ factorId, value: createDefaultFactorValue(factorId, 'factor_cloud'), source: 'factor_cloud', chainIndex: -1, latencyMs: 0, fallbackUsed: true, fallbackReason: 'All sources failed' });
    }
    return results;
  }

  // ── Factor Group Query ────────────────────────────────────────────────

  async queryFactorGroup(group: FactorGroupQuery, symbols: string[], period: FactorPeriod): Promise<FactorGroupResult> {
    const startMs = Date.now();
    const results = new Map<string, FactorValue[]>();
    const errors: Array<{ symbol: string; factorId: string; error: string }> = [];

    for (const symbol of symbols) {
      const symbolResults: FactorValue[] = [];
      for (const factorId of group.factorIds) {
        try {
          const chainResults = await this.fetchWithPriorityChain(factorId, [symbol], period);
          if (chainResults.length > 0) symbolResults.push(chainResults[0].value);
        } catch (err) { errors.push({ symbol, factorId, error: err instanceof Error ? err.message : String(err) }); }
      }
      results.set(symbol, symbolResults);
    }
    return { groupName: group.groupName ?? `group_${group.factorIds.length}`, symbols, results, latencyMs: Date.now() - startMs, errors };
  }

  async queryFactorFamily(category: FactorCategory, symbols: string[], period: FactorPeriod): Promise<FactorGroupResult> {
    const factorIds = this.listFactors({ category, status: 'active' }).map(f => f.factorId);
    return this.queryFactorGroup({ factorIds, groupName: `family_${category}` }, symbols, period);
  }

  // ── Source Health Dashboard ────────────────────────────────────────────

  getSourceHealth(): SourceHealthRecord[] {
    const recs: SourceHealthRecord[] = [];
    for (const source of Array.from(this.getRegisteredSources())) {
      recs.push(this.sourceHealth.get(source) ?? this.createDefaultHealth(source));
    }
    return recs.sort((a, b) => b.uptimePercent - a.uptimePercent);
  }

  getSourceHealthSummary(): { totalSources: number; healthy: number; degraded: number; down: number; overallUptime: number } {
    const recs = this.getSourceHealth();
    const h = recs.filter(r => r.status === 'healthy').length;
    const d = recs.filter(r => r.status === 'degraded').length;
    const dn = recs.filter(r => r.status === 'down').length;
    const u = recs.length > 0 ? recs.reduce((s, r) => s + r.uptimePercent, 0) / recs.length : 100;
    return { totalSources: recs.length, healthy: h, degraded: d, down: dn, overallUptime: Math.round(u * 100) / 100 };
  }

  // ── Lifecycle Audit ───────────────────────────────────────────────────

  getFactorLifecycle(factorId: string): FactorLifecycleEvent[] { return this.lifecycleLog.filter(e => e.factorId === factorId); }

  getFullLifecycleLog(options?: { limit?: number; since?: number }): FactorLifecycleEvent[] {
    let events = [...this.lifecycleLog];
    if (options?.since) events = events.filter(e => e.timestamp >= options.since);
    events.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.limit) events = events.slice(0, options.limit);
    return events;
  }

  // ── Zero-Cost New Factor ──────────────────────────────────────────────

  async addNewFactor(meta: Omit<FactorMeta, 'createdAt'|'updatedAt'>): Promise<void> {
    const full: FactorMeta = { ...meta, createdAt: Date.now(), updatedAt: Date.now() };
    this.registerFactor(full);
    this.setSourcePriority(meta.factorId, {
      chain: meta.sources,
      timeoutMs: Object.fromEntries(meta.sources.map(s => [s, 5000])) as Record<FactorSourceName, number>,
      cacheIntermediates: true, minConfidence: 0.3,
    });
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private getRegisteredSources(): FactorSourceName[] {
    const s = new Set<FactorSourceName>();
    for (const r of Array.from(this.plugins.values())) s.add(r.plugin.sourceName);
    return Array.from(s);
  }

  private recordSourceHealth(source: FactorSourceName, success: boolean, latencyMs: number, error?: string): void {
    let h = this.sourceHealth.get(source);
    if (!h) { h = this.createDefaultHealth(source); this.sourceHealth.set(source, h); }
    h.totalQueries++;
    if (success) { h.successfulQueries++; h.lastSuccessAt = Date.now(); }
    else { h.failedQueries++; h.lastFailureAt = Date.now(); h.lastError = error ?? null; }
    h.avgLatencyMs = (h.avgLatencyMs * (h.totalQueries - 1) + latencyMs) / h.totalQueries;
    let samples = this.latencySamples.get(source);
    if (!samples) { samples = []; this.latencySamples.set(source, samples); }
    samples.push(latencyMs); if (samples.length > 1000) samples.shift();
    const sorted = [...samples].sort((a, b) => a - b);
    h.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    h.p99LatencyMs = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    h.uptimePercent = h.totalQueries > 0 ? (h.successfulQueries / h.totalQueries) * 100 : 100;
    const failRate = h.failedQueries / Math.max(1, h.totalQueries);
    if (failRate >= 0.5) h.status = 'down';
    else if (failRate >= 0.1) h.status = 'degraded';
    else h.status = 'healthy';
  }

  private createDefaultHealth(source: FactorSourceName): SourceHealthRecord {
    return { source, totalQueries: 0, successfulQueries: 0, failedQueries: 0, lastSuccessAt: null, lastFailureAt: null, lastError: null, avgLatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0, uptimePercent: 100, status: 'healthy' };
  }

  private recordLifecycle(factorId: string, event: FactorLifecycleEvent['event'], details: string): void {
    this.lifecycleLog.push({ factorId, event, timestamp: Date.now(), details });
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms))]);
  }

  reset(): void {
    this.factorMeta.clear(); this.plugins.clear(); this.sourceChains.clear();
    this.sourceHealth.clear(); this.lifecycleLog = []; this.latencySamples.clear();
  }
}

// ── Extended Singleton ─────────────────────────────────────────────────────

let _extendedInstance: ExtendedFactorDataProvider | null = null;

export function getExtendedFactorDataProvider(): ExtendedFactorDataProvider {
  if (!_extendedInstance) _extendedInstance = new ExtendedFactorDataProvider();
  return _extendedInstance;
}

export function resetExtendedFactorDataProvider(): void { _extendedInstance?.reset(); _extendedInstance = null; }

export async function registerNewFactor(params: {
  factorId: string; name: string; nameCn: string; category: FactorCategory; unit: string;
  description: string; markets: string[]; sources: FactorSourceName[];
  status?: FactorStatus; tags?: string[]; defaultWeight?: number; minValue?: number; maxValue?: number;
}): Promise<void> {
  await getExtendedFactorDataProvider().addNewFactor({
    factorId: params.factorId, name: params.name, nameCn: params.nameCn,
    category: params.category, unit: params.unit, description: params.description,
    markets: params.markets, sources: params.sources, version: 1,
    status: params.status ?? 'beta', pricePerQuery: 0,
    tags: params.tags ?? [], defaultWeight: params.defaultWeight,
    minValue: params.minValue, maxValue: params.maxValue,
  });
}

export function seedBuiltinFactors(): void {
  const p = getExtendedFactorDataProvider();
  const builtins: FactorMeta[] = [
    { factorId: 'MOM_12M', name: '12M Momentum', nameCn: '12月动量', category: 'momentum', unit: 'percentile', description: 'Trailing 12-month price return', markets: ['US','HK','JP','KR','TW','SG','AU','IN','EU'], sources: ['factor_research','factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['momentum','core'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'MOM_6M', name: '6M Momentum', nameCn: '6月动量', category: 'momentum', unit: 'percentile', description: 'Trailing 6-month price return', markets: ['US','HK','JP','KR','TW','SG','AU','IN','EU'], sources: ['factor_research','factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['momentum','core'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'MOM_1M', name: '1M Momentum', nameCn: '1月动量', category: 'momentum', unit: 'percentile', description: 'Trailing 1-month price return', markets: ['US','HK'], sources: ['factor_research'], version: 1, status: 'active', pricePerQuery: 0, tags: ['momentum','short-term'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'VALUE_PE', name: 'P/E Value', nameCn: '市盈率价值', category: 'value', unit: 'ratio', description: 'P/E ratio percentile', markets: ['US','HK','JP','KR','TW','SG','AU','IN','EU'], sources: ['factor_research','factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['value','core'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'VALUE_PB', name: 'P/B Value', nameCn: '市净率价值', category: 'value', unit: 'ratio', description: 'P/B ratio percentile', markets: ['US','HK','JP','KR','TW','SG','AU','IN','EU'], sources: ['factor_research','factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['value','core'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'QUALITY_ROE', name: 'ROE Quality', nameCn: 'ROE质量', category: 'quality', unit: 'percent', description: 'Return on equity (TTM)', markets: ['US','HK','JP','KR','TW','SG','AU','IN','EU'], sources: ['factor_research'], version: 1, status: 'active', pricePerQuery: 0, tags: ['quality','core'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'SENTIMENT_SOCIAL', name: 'Social Sentiment', nameCn: '社交媒体情绪', category: 'sentiment', unit: 'score', description: 'NLP social sentiment', markets: ['US','CRYPTO'], sources: ['sentiment'], version: 1, status: 'active', pricePerQuery: 0.1, tags: ['sentiment','nlp'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'FLOW_INSTITUTIONAL', name: 'Institutional Flow', nameCn: '机构资金流', category: 'capital_flow', unit: 'USD', description: 'Institutional net flow', markets: ['US','HK','JP','KR'], sources: ['institutional_flow','capital_flow'], version: 1, status: 'active', pricePerQuery: 0.05, tags: ['flow','institutional'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'CRYPTO_NVT', name: 'NVT Ratio', nameCn: 'NVT比率', category: 'crypto', unit: 'ratio', description: 'Network Value to Transactions', markets: ['CRYPTO'], sources: ['factor_cloud'], version: 1, status: 'active', pricePerQuery: 0.05, tags: ['crypto','onchain'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'CRYPTO_FUNDING_RATE', name: 'Funding Rate', nameCn: '资金费率', category: 'crypto', unit: 'percent', description: 'Perpetual swap funding rate', markets: ['CRYPTO'], sources: ['factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['crypto','derivatives'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'DIVIDEND_YIELD', name: 'Dividend Yield', nameCn: '股息率', category: 'dividend', unit: 'percent', description: 'TTM dividend yield', markets: ['US','HK','JP','SG','AU','EU'], sources: ['factor_research'], version: 1, status: 'active', pricePerQuery: 0, tags: ['dividend','income'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'VOLATILITY_30D', name: '30D Volatility', nameCn: '30日波动率', category: 'volatility', unit: 'percent', description: '30-day realized volatility', markets: ['US','HK','JP','KR','TW','CRYPTO'], sources: ['factor_research'], version: 1, status: 'active', pricePerQuery: 0, tags: ['volatility','risk'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'MACRO_PMI', name: 'PMI Trend', nameCn: 'PMI趋势', category: 'macro', unit: 'index', description: 'PMI trend', markets: ['US','HK','CN','JP','KR','EU'], sources: ['factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['macro','economic'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'CORRELATION_BTC_SP500', name: 'BTC-S&P500 Correlation', nameCn: 'BTC-标普相关性', category: 'cross_market', unit: 'coefficient', description: '30-day BTC vs S&P500 correlation', markets: ['CRYPTO'], sources: ['factor_cloud'], version: 1, status: 'active', pricePerQuery: 0, tags: ['cross','correlation'], createdAt: Date.now(), updatedAt: Date.now() },
    { factorId: 'ARBITRAGE_AH_PREMIUM', name: 'AH Premium', nameCn: 'AH溢价率', category: 'arbitrage', unit: 'percent', description: 'A-H share premium', markets: ['HK'], sources: ['factor_cloud'], version: 1, status: 'active', pricePerQuery: 0.05, tags: ['arbitrage','cross-market'], createdAt: Date.now(), updatedAt: Date.now() },
  ];
  p.registerFactors(builtins);
  console.log(`[FactorDataProvider] R217-E2: Seeded ${builtins.length} built-in factors`);
}

export default {
  FactorDataProvider, getFactorDataProvider, resetFactorDataProvider,
  initializeFactorDataProvider, createDefaultFactorValue,
  ExtendedFactorDataProvider, getExtendedFactorDataProvider, resetExtendedFactorDataProvider,
  registerNewFactor, seedBuiltinFactors,
};
