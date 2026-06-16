// ── R230 auto#1 (A1): Data Source Reliability Engine ────────────────────
// Multi-source fallback + cross-validation + health check loop.
// Ensures no single data source failure breaks factor computation.
//
// Architecture:
//   DataSourceManager
//   ├── SourceRegistry (3 sources per data type: primary → secondary → tertiary)
//   ├── CrossValidator (compare values across sources, flag discrepancies)
//   ├── HealthChecker (periodic ping loop, 30s default interval)
//   └── FallbackChain (primary fails → secondary → tertiary → cached)
//
// Integrates with: FactorDataProvider, FactorSignalPipeline

import log from 'electron-log';
import {
  FactorDataProvider,
  type FactorSourceName,
  type FactorValue,
  type FactorValues,
  type FactorPeriod,
} from './factor-data-provider';
import { type FactorId } from './factor-id-registry';

// ═══════════ Types ═══════════════════════════════════════════════════════

export type DataSourceTier = 'primary' | 'secondary' | 'tertiary' | 'cache';

export type SourceStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface DataSourceConfig {
  name: string;
  tier: DataSourceTier;
  url?: string;
  type: 'rest' | 'websocket' | 'file' | 'computed';
  timeoutMs: number;
  retryCount: number;
  weight: number; // 1-100, for cross-validation consensus
}

export interface CrossValidationResult {
  factorId: string;
  values: Array<{ source: string; value: number; tier: DataSourceTier }>;
  consensus: number | null; // Agreed value, null if no consensus
  deviation: number;       // Max deviation between sources (%)
  passed: boolean;         // Within acceptable threshold
  severity: 'ok' | 'minor' | 'major' | 'critical';
  checkedAt: number;
}

export interface SourceHealthStatus {
  sourceName: string;
  status: SourceStatus;
  lastPing: number;
  latencyMs: number;
  successRate: number;     // 0-1 over last 100 requests
  consecutiveFailures: number;
  lastError?: string;
  degradedSince?: number;
}

export interface FallbackAttempt {
  factorId: string;
  timestamp: number;
  attemptedSources: string[];
  usedSource: string;
  succeeded: boolean;
  latencyMs: number;
}

// ═══════════ Source Registry ═════════════════════════════════════════════

export class DataSourceRegistry {
  private sources = new Map<string, DataSourceConfig[]>();

  registerSource(factorSourceType: string, config: DataSourceConfig): void {
    const existing = this.sources.get(factorSourceType) || [];
    // Ensure no duplicate tiers
    const filtered = existing.filter(s => s.tier !== config.tier);
    filtered.push(config);
    // Sort by tier priority: primary → secondary → tertiary → cache
    filtered.sort((a, b) => {
      const order: Record<DataSourceTier, number> = { primary: 0, secondary: 1, tertiary: 2, cache: 3 };
      return order[a.tier] - order[b.tier];
    });
    this.sources.set(factorSourceType, filtered);
  }

  getSources(factorSourceType: string): DataSourceConfig[] {
    return this.sources.get(factorSourceType) || [];
  }

  getActiveSources(): string[] {
    const names = new Set<string>();
    for (const [, sources] of this.sources) {
      sources.forEach(s => names.add(s.name));
    }
    return [...names];
  }

  getSourceCount(type?: string): number {
    if (type) return this.sources.get(type)?.length || 0;
    let count = 0;
    for (const [, sources] of this.sources) count += sources.length;
    return count;
  }
}

// ═══════════ Cross Validator ═════════════════════════════════════════════

export class CrossValidator {
  private maxDeviationPct = 15; // Max acceptable deviation between sources (%)

  /**
   * Validate a factor value across multiple data sources.
   * Returns consensus if majority of weighted sources agree within threshold.
   */
  validate(factorId: string, sourceValues: Array<{
    source: string;
    value: number;
    tier: DataSourceTier;
    weight: number;
  }>): CrossValidationResult {
    if (sourceValues.length === 0) {
      return {
        factorId,
        values: [],
        consensus: null,
        deviation: 0,
        passed: false,
        severity: 'critical',
        checkedAt: Date.now(),
      };
    }

    if (sourceValues.length === 1) {
      return {
        factorId,
        values: sourceValues.map(s => ({
          source: s.source,
          value: s.value,
          tier: s.tier,
        })),
        consensus: sourceValues[0].value,
        deviation: 0,
        passed: true,
        severity: 'minor',
        checkedAt: Date.now(),
      };
    }

    // Weighted consensus: primary weight ×2, secondary ×1.5, tertiary ×1
    const tierWeight: Record<DataSourceTier, number> = {
      primary: 2,
      secondary: 1.5,
      tertiary: 1,
      cache: 0.5,
    };

    const weightedSum = sourceValues.reduce((sum, s) =>
      sum + s.value * s.weight * (tierWeight[s.tier] || 1), 0);
    const totalWeight = sourceValues.reduce((sum, s) =>
      sum + s.weight * (tierWeight[s.tier] || 1), 0);
    const consensus = totalWeight > 0 ? weightedSum / totalWeight : null;

    // Max deviation: largest % diff between any two sources
    let maxDev = 0;
    for (let i = 0; i < sourceValues.length; i++) {
      for (let j = i + 1; j < sourceValues.length; j++) {
        if (sourceValues[i].value === 0 && sourceValues[j].value === 0) continue;
        const avgAbs = (Math.abs(sourceValues[i].value) + Math.abs(sourceValues[j].value)) / 2;
        if (avgAbs === 0) continue;
        const dev = Math.abs(sourceValues[i].value - sourceValues[j].value) / avgAbs * 100;
        maxDev = Math.max(maxDev, dev);
      }
    }

    const passed = maxDev <= this.maxDeviationPct;
    let severity: CrossValidationResult['severity'] = 'ok';
    if (!passed) {
      severity = maxDev > 100 ? 'critical' : maxDev > 50 ? 'major' : 'minor';
    }

    return {
      factorId,
      values: sourceValues.map(s => ({
        source: s.source,
        value: s.value,
        tier: s.tier,
      })),
      consensus,
      deviation: Math.round(maxDev * 100) / 100,
      passed,
      severity,
      checkedAt: Date.now(),
    };
  }

  setMaxDeviation(pct: number): void {
    this.maxDeviationPct = pct;
  }
}

// ═══════════ Health Checker ══════════════════════════════════════════════

export class SourceHealthChecker {
  private health = new Map<string, SourceHealthStatus>();
  private checkIntervalMs = 30000; // 30s default
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private pingFn: ((sourceName: string) => Promise<number>) | null = null;

  onStatusChange?: (sourceName: string, oldStatus: SourceStatus, newStatus: SourceStatus) => void;
  onDegraded?: (sourceName: string, status: SourceHealthStatus) => void;
  onOffline?: (sourceName: string, status: SourceHealthStatus) => void;

  registerSource(sourceName: string): void {
    if (!this.health.has(sourceName)) {
      this.health.set(sourceName, {
        sourceName,
        status: 'unknown',
        lastPing: 0,
        latencyMs: 0,
        successRate: 1,
        consecutiveFailures: 0,
      });
    }
  }

  setPingFunction(fn: (sourceName: string) => Promise<number>): void {
    this.pingFn = fn;
  }

  start(checkIntervalMs?: number): void {
    if (checkIntervalMs) this.checkIntervalMs = checkIntervalMs;
    if (this.intervalHandle) return;

    this.intervalHandle = setInterval(() => {
      this.pingAll();
    }, this.checkIntervalMs);
    log.info(`[R230] Health checker started (interval: ${this.checkIntervalMs}ms)`);

    // Immediate first check
    this.pingAll();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async pingAll(): Promise<void> {
    const entries = [...this.health.entries()];
    await Promise.allSettled(entries.map(async ([name, status]) => {
      if (!this.pingFn) return;
      try {
        const start = Date.now();
        const latencyMs = await this.pingFn(name);
        this.updateStatus(name, 'online', latencyMs || Date.now() - start);
      } catch (e: any) {
        this.updateStatus(name, 'offline', 0, e?.message);
      }
    }));
  }

  private updateStatus(
    name: string,
    newStatus: SourceStatus,
    latencyMs: number,
    errorMsg?: string,
  ): void {
    const current = this.health.get(name);
    if (!current) return;

    const oldStatus = current.status;
    current.status = newStatus;
    current.lastPing = Date.now();
    current.latencyMs = latencyMs;
    current.lastError = errorMsg;

    if (newStatus === 'online') {
      current.consecutiveFailures = 0;
      // Exponential decay success rate
      current.successRate = current.successRate * 0.9 + 0.1;
      delete current.degradedSince;
    } else {
      current.consecutiveFailures++;
      current.successRate *= 0.9; // Decay
      if (current.consecutiveFailures >= 3) {
        current.degradedSince = current.degradedSince || Date.now();
      }
    }

    if (oldStatus !== newStatus) {
      this.onStatusChange?.(name, oldStatus, newStatus);
      if (newStatus === 'offline') {
        this.onOffline?.(name, current);
        log.warn(`[R230] Source OFFLINE: ${name} (${errorMsg || 'no response'})`);
      }
    }
  }

  getSourceHealth(sourceName: string): SourceHealthStatus | undefined {
    return this.health.get(sourceName);
  }

  getAllHealth(): SourceHealthStatus[] {
    return [...this.health.values()];
  }

  getUnhealthySources(): SourceHealthStatus[] {
    return [...this.health.values()].filter(s => s.status === 'offline');
  }

  getOverallHealth(): { online: number; degraded: number; offline: number; total: number } {
    let online = 0, degraded = 0, offline = 0;
    for (const [, status] of this.health) {
      if (status.status === 'online') online++;
      else if (status.status === 'degraded') degraded++;
      else offline++;
    }
    return { online, degraded, offline, total: this.health.size };
  }
}

// ═══════════ Data Source Manager (Main Entry Point) ══════════════════════

export class DataSourceManager {
  readonly registry: DataSourceRegistry;
  readonly crossValidator: CrossValidator;
  readonly healthChecker: SourceHealthChecker;
  private fallbackLog: FallbackAttempt[] = [];
  private maxFallbackLog = 1000;

  constructor() {
    this.registry = new DataSourceRegistry();
    this.crossValidator = new CrossValidator();
    this.healthChecker = new SourceHealthChecker();

    // Wire health checker notifications
    this.healthChecker.onOffline = (sourceName, status) => {
      log.warn(`[R230] Health alert: ${sourceName} offline (failures: ${status.consecutiveFailures})`);
    };
    this.healthChecker.onDegraded = (sourceName) => {
      log.warn(`[R230] Health alert: ${sourceName} degraded`);
    };
  }

  /**
   * Initialize data sources with default 3-tier fallback config.
   */
  initialize(): void {
    // Register all data source types with fallback chains
    const sourceTypes: Array<{
      type: string;
      sources: Array<{ name: string; tier: DataSourceTier; url?: string; type: DataSourceConfig['type'] }>;
    }> = [
      {
        type: 'market_quote',
        sources: [
          { name: 'broker-primary', tier: 'primary', type: 'websocket' },
          { name: 'broker-secondary', tier: 'secondary', type: 'rest' },
          { name: 'local-cache', tier: 'cache', type: 'file' },
        ],
      },
      {
        type: 'factor_compute',
        sources: [
          { name: 'engine-compute', tier: 'primary', type: 'computed' },
          { name: 'cloud-fallback', tier: 'secondary', url: '/api/factors/compute', type: 'rest' },
          { name: 'snapshot-cache', tier: 'cache', type: 'file' },
        ],
      },
      {
        type: 'sentiment',
        sources: [
          { name: 'api-primary', tier: 'primary', url: '/api/sentiment', type: 'rest' },
          { name: 'social-scrape', tier: 'secondary', type: 'rest' },
          { name: 'news-fallback', tier: 'tertiary', type: 'rest' },
        ],
      },
      {
        type: 'capital_flow',
        sources: [
          { name: 'exchange-api', tier: 'primary', url: '/api/capital-flow', type: 'rest' },
          { name: 'broker-derived', tier: 'secondary', type: 'computed' },
          { name: 'cache', tier: 'cache', type: 'file' },
        ],
      },
      {
        type: 'fundamental',
        sources: [
          { name: 'financial-api', tier: 'primary', url: '/api/fundamental', type: 'rest' },
          { name: 'edgar-scrape', tier: 'secondary', type: 'rest' },
          { name: 'cache', tier: 'cache', type: 'file' },
        ],
      },
      {
        type: 'onchain',
        sources: [
          { name: 'blockchain-rpc', tier: 'primary', type: 'websocket' },
          { name: 'graphql-indexer', tier: 'secondary', url: '/api/onchain', type: 'rest' },
          { name: 'cache', tier: 'cache', type: 'file' },
        ],
      },
    ];

    for (const { type, sources } of sourceTypes) {
      for (const src of sources) {
        this.registry.registerSource(type, {
          name: src.name,
          tier: src.tier,
          url: src.url,
          type: src.type,
          timeoutMs: src.tier === 'primary' ? 5000 : 10000,
          retryCount: src.tier === 'primary' ? 1 : 2,
          weight: src.tier === 'primary' ? 100 : src.tier === 'secondary' ? 60 : 30,
        });
      }
    }

    log.info(`[R230] DataSourceManager initialized: ${this.registry.getSourceCount()} sources across ${sourceTypes.length} types`);
  }

  /**
   * Execute a factor data fetch with automatic fallback.
   * Primary → Secondary → Tertiary → Cache
   */
  async fetchWithFallback(
    factorId: string,
    sourceType: string,
    fetchFn: (source: DataSourceConfig) => Promise<number | null>,
  ): Promise<{ value: number | null; usedSource: string; attempts: number; validated: boolean }> {
    const sources = this.registry.getSources(sourceType);
    if (sources.length === 0) {
      return { value: null, usedSource: 'none', attempts: 0, validated: false };
    }

    const values: Array<{ source: string; value: number; tier: DataSourceTier; weight: number }> = [];
    let usedSource = 'none';
    let attempts = 0;

    for (const source of sources) {
      // Skip offline sources
      const health = this.healthChecker.getSourceHealth(source.name);
      if (health?.status === 'offline' && source.tier !== 'cache') {
        log.debug(`[R230] Skipping offline source: ${source.name}`);
        continue;
      }

      attempts++;
      const start = Date.now();
      try {
        const value = await fetchFn(source);
        if (value !== null && !isNaN(value)) {
          values.push({ source: source.name, value, tier: source.tier, weight: source.weight });

          if (!usedSource || usedSource === 'none') {
            usedSource = source.name;
          }

          // If we got primary and secondary, we have enough for cross-validation
          if (values.length >= 2) break;
        }
      } catch (err: any) {
        log.debug(`[R230] Source ${source.name} failed: ${err.message}`);
      }

      // Log fallback
      this.fallbackLog.push({
        factorId,
        timestamp: Date.now(),
        attemptedSources: sources.slice(0, attempts).map(s => s.name),
        usedSource: values.length > 0 ? values[values.length - 1].source : 'none',
        succeeded: values.length > 0,
        latencyMs: Date.now() - start,
      });

      // Trim log
      if (this.fallbackLog.length > this.maxFallbackLog) {
        this.fallbackLog = this.fallbackLog.slice(-this.maxFallbackLog);
      }
    }

    // Cross-validate if we have multiple values
    let validated = true;
    if (values.length >= 2) {
      const validation = this.crossValidator.validate(factorId, values);
      validated = validation.passed;
      if (!validated) {
        log.warn(`[R230] Cross-validation FAILED for ${factorId}: deviation=${validation.deviation}%, severity=${validation.severity}`);
      }
    }

    const bestValue = values.length > 0 ?
      this.crossValidator.validate(factorId, values).consensus :
      null;

    return { value: bestValue, usedSource, attempts, validated };
  }

  /** Get fallback execution log */
  getFallbackLog(limit?: number): FallbackAttempt[] {
    return this.fallbackLog.slice(-(limit || 100));
  }

  /** Get data source reliability report */
  getReliabilityReport(): {
    uptime: Record<string, number>;
    fallbackRate: number;
    crossValidationPassRate: number;
  } {
    const uptime: Record<string, number> = {};
    this.healthChecker.getAllHealth().forEach(h => {
      uptime[h.sourceName] = h.successRate;
    });

    const totalFallbacks = this.fallbackLog.length;
    const fallbackUses = this.fallbackLog.filter(f => f.succeeded).length;
    const fallbackRate = totalFallbacks > 0 ? fallbackUses / totalFallbacks : 1;

    return {
      uptime,
      fallbackRate: Math.round(fallbackRate * 10000) / 100,
      crossValidationPassRate: 100, // Will be updated with real data
    };
  }
}

// ═══════════ Singleton ═══════════════════════════════════════════════════

let _instance: DataSourceManager | null = null;

export function getDataSourceManager(): DataSourceManager {
  if (!_instance) {
    _instance = new DataSourceManager();
    _instance.initialize();
  }
  return _instance;
}

export function resetDataSourceManager(): void {
  _instance?.healthChecker.stop();
  _instance = null;
}
