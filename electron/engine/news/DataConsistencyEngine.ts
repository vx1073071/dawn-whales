/**
 * DataConsistencyEngine — Cross-Engine Data Consistency Validator
 * R252 — Final Round / 终局之战
 * JVS / 引擎虾
 *
 * Validates data consistency across the engine ecosystem. Checks that
 * symbol mappings, quote data, position values, and computed metrics are
 * consistent between engines. Detects stale data, version mismatches,
 * and data integrity issues. Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ConsistencyCheck =
  | 'symbol_mapping'
  | 'quote_freshness'
  | 'position_accuracy'
  | 'metric_calculation'
  | 'timestamp_sync'
  | 'data_version'
  | 'source_agreement'
  | 'cache_coherence';

export type ConsistencyStatus = 'consistent' | 'stale' | 'divergent' | 'missing' | 'error';

export interface ConsistencyResult {
  check: ConsistencyCheck;
  status: ConsistencyStatus;
  engineA: string;
  engineB: string;
  key: string; // e.g. symbol
  expectedValue: unknown;
  actualValue: unknown;
  driftPct?: number;
  message: string;
  checkedAt: number;
}

export interface DataSnapshot {
  engineId: string;
  timestamp: number;
  symbols: Set<string>;
  // symbol → value map
  data: Map<string, unknown>;
  version: number;
  source: string;
}

export interface ConsistencyReport {
  id: string;
  generatedAt: number;
  totalChecks: number;
  consistentCount: number;
  staleCount: number;
  divergentCount: number;
  results: ConsistencyResult[];
  overallStatus: ConsistencyStatus;
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class DataConsistencyEngine {
  private static instance: DataConsistencyEngine;

  private snapshots: Map<string, DataSnapshot[]> = new Map(); // engineId → history
  private reports: ConsistencyReport[] = [];
  private idCounter = 0;

  // Staleness thresholds (configurable)
  private thresholds = {
    quoteStalenessMs: 60000,        // 1 minute for quotes
    positionStalenessMs: 300000,    // 5 minutes for positions
    metricStalenessMs: 300000,      // 5 minutes for computed metrics
    divergentThresholdPct: 5,       // 5% drift = divergent
    timestampToleranceMs: 5000,     // 5s clock skew tolerance
  };

  private constructor() {}

  static getInstance(): DataConsistencyEngine {
    if (!DataConsistencyEngine.instance) {
      DataConsistencyEngine.instance = new DataConsistencyEngine();
    }
    return DataConsistencyEngine.instance;
  }

  reset(): void {
    this.snapshots.clear();
    this.reports = [];
    this.idCounter = 0;
  }

  private nextId(): string { return `dce-${++this.idCounter}`; }

  // ═══════════════════════════════════════════════════════════════
  // Snapshot Registration
  // ═══════════════════════════════════════════════════════════════

  registerSnapshot(params: {
    engineId: string;
    symbols: string[];
    data: Record<string, unknown>;
    version: number;
    source: string;
    timestamp?: number;
  }): DataSnapshot {
    const snapshot: DataSnapshot = {
      engineId: params.engineId,
      timestamp: params.timestamp || Date.now(),
      symbols: new Set(params.symbols.map(s => s.toUpperCase())),
      data: new Map(Object.entries(params.data)),
      version: params.version,
      source: params.source,
    };

    if (!this.snapshots.has(params.engineId)) {
      this.snapshots.set(params.engineId, []);
    }
    this.snapshots.get(params.engineId)!.push(snapshot);

    // Keep only last 10 snapshots per engine
    const history = this.snapshots.get(params.engineId)!;
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    return snapshot;
  }

  getSnapshot(engineId: string): DataSnapshot | undefined {
    const history = this.snapshots.get(engineId);
    return history?.length ? history[history.length - 1] : undefined;
  }

  // ═══════════════════════════════════════════════════════════════
  // Symbol Mapping Consistency
  // ═══════════════════════════════════════════════════════════════

  checkSymbolMapping(engineA: string, engineB: string): ConsistencyResult[] {
    const snapA = this.getSnapshot(engineA);
    const snapB = this.getSnapshot(engineB);
    const results: ConsistencyResult[] = [];
    const now = Date.now();

    if (!snapA || !snapB) {
      results.push({
        check: 'symbol_mapping', status: 'missing',
        engineA, engineB, key: '*',
        expectedValue: 'snapshot', actualValue: snapA ? 'B missing' : 'A missing',
        message: `${!snapA ? engineA : engineB} has no snapshot`,
        checkedAt: now,
      });
      return results;
    }

    // Check for symbols in A but not in B
    for (const sym of snapA.symbols) {
      if (!snapB.symbols.has(sym)) {
        results.push({
          check: 'symbol_mapping', status: 'divergent',
          engineA, engineB, key: sym,
          expectedValue: 'present', actualValue: 'missing',
          message: `${sym} exists in ${engineA} but not in ${engineB}`,
          checkedAt: now,
        });
      }
    }

    // Check for symbols in B but not in A
    for (const sym of snapB.symbols) {
      if (!snapA.symbols.has(sym)) {
        results.push({
          check: 'symbol_mapping', status: 'divergent',
          engineA, engineB, key: sym,
          expectedValue: 'present', actualValue: 'missing',
          message: `${sym} exists in ${engineB} but not in ${engineA}`,
          checkedAt: now,
        });
      }
    }

    if (results.length === 0) {
      results.push({
        check: 'symbol_mapping', status: 'consistent',
        engineA, engineB, key: '*',
        expectedValue: snapA.symbols.size, actualValue: snapB.symbols.size,
        message: `${snapA.symbols.size} symbols in both engines`,
        checkedAt: now,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // Quote Freshness Check
  // ═══════════════════════════════════════════════════════════════

  checkQuoteFreshness(engineId: string): ConsistencyResult[] {
    const history = this.snapshots.get(engineId);
    const now = Date.now();
    const results: ConsistencyResult[] = [];

    if (!history || history.length === 0) {
      return [{
        check: 'quote_freshness', status: 'missing',
        engineA: engineId, engineB: 'n/a', key: '*',
        expectedValue: 'recent snapshot', actualValue: 'none',
        message: `No snapshots for ${engineId}`,
        checkedAt: now,
      }];
    }

    const latest = history[history.length - 1];
    const age = now - latest.timestamp;

    let status: ConsistencyStatus;
    if (age > this.thresholds.quoteStalenessMs * 3) status = 'stale';
    else if (age > this.thresholds.quoteStalenessMs) status = 'stale';
    else status = 'consistent';

    results.push({
      check: 'quote_freshness', status,
      engineA: engineId, engineB: 'clock', key: '*',
      expectedValue: `<${this.thresholds.quoteStalenessMs}ms`, actualValue: `${age}ms`,
      message: status === 'consistent'
        ? `Quote data fresh (${age}ms old)`
        : `Quote data stale (${(age/1000).toFixed(0)}s old, threshold ${this.thresholds.quoteStalenessMs/1000}s)`,
      checkedAt: now,
    });

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // Value Drift Between Engines
  // ═══════════════════════════════════════════════════════════════

  checkValueDrift(engineA: string, engineB: string, key: string): ConsistencyResult {
    const snapA = this.getSnapshot(engineA);
    const snapB = this.getSnapshot(engineB);
    const now = Date.now();

    if (!snapA || !snapB) {
      return {
        check: 'metric_calculation', status: 'missing',
        engineA, engineB, key,
        expectedValue: 'value', actualValue: 'missing snapshot',
        message: 'One or both snapshots missing',
        checkedAt: now,
      };
    }

    const valA = snapA.data.get(key);
    const valB = snapB.data.get(key);

    if (valA === undefined || valB === undefined) {
      return {
        check: 'metric_calculation', status: 'missing',
        engineA, engineB, key,
        expectedValue: valA ?? 'defined', actualValue: valB ?? 'undefined',
        message: `Key ${key} missing in ${valA === undefined ? engineA : engineB}`,
        checkedAt: now,
      };
    }

    // Compare numeric values
    if (typeof valA === 'number' && typeof valB === 'number') {
      const driftPct = valA !== 0 ? Math.abs((valA - valB) / valA) * 100 : 0;
      let status: ConsistencyStatus;

      if (driftPct > this.thresholds.divergentThresholdPct * 2) status = 'error';
      else if (driftPct > this.thresholds.divergentThresholdPct) status = 'divergent';
      else status = 'consistent';

      return {
        check: 'metric_calculation', status, engineA, engineB, key,
        expectedValue: valA, actualValue: valB,
        driftPct: Math.round(driftPct * 100) / 100,
        message: status === 'consistent'
          ? `Values match within ${driftPct.toFixed(1)}%`
          : `Value divergence ${driftPct.toFixed(1)}% exceeds threshold ${this.thresholds.divergentThresholdPct}%`,
        checkedAt: now,
      };
    }

    // Compare non-numeric values
    const equal = JSON.stringify(valA) === JSON.stringify(valB);
    return {
      check: 'metric_calculation', status: equal ? 'consistent' : 'divergent',
      engineA, engineB, key,
      expectedValue: valA, actualValue: valB,
      message: equal ? 'Values match' : 'Values differ',
      checkedAt: now,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Cache Coherence Check
  // ═══════════════════════════════════════════════════════════════

  checkCacheCoherence(engineIds: string[]): ConsistencyResult[] {
    const results: ConsistencyResult[] = [];
    const now = Date.now();

    // Check that all engines have similar timestamps
    const snapshots = engineIds
      .map(id => this.getSnapshot(id))
      .filter((s): s is DataSnapshot => s !== undefined);

    if (snapshots.length < 2) {
      return [{
        check: 'cache_coherence', status: 'missing',
        engineA: engineIds[0] || 'n/a', engineB: engineIds[1] || 'n/a', key: '*',
        expectedValue: `${engineIds.length} engines`, actualValue: `${snapshots.length} with data`,
        message: 'Not enough snapshots for cache coherence check',
        checkedAt: now,
      }];
    }

    const timestamps = snapshots.map(s => s.timestamp);
    const maxTs = Math.max(...timestamps);
    const minTs = Math.min(...timestamps);
    const skew = maxTs - minTs;

    if (skew > this.thresholds.timestampToleranceMs) {
      results.push({
        check: 'cache_coherence', status: 'stale',
        engineA: engineIds[0], engineB: engineIds[engineIds.length - 1], key: 'timestamp_skew',
        expectedValue: `<${this.thresholds.timestampToleranceMs}ms`, actualValue: `${skew}ms`,
        message: `Cache timestamp skew ${skew}ms exceeds ${this.thresholds.timestampToleranceMs}ms tolerance`,
        checkedAt: now,
      });
    } else {
      results.push({
        check: 'cache_coherence', status: 'consistent',
        engineA: 'all', engineB: 'all', key: 'timestamp_skew',
        expectedValue: `<${this.thresholds.timestampToleranceMs}ms`, actualValue: `${skew}ms`,
        message: `All caches in sync (${skew}ms skew)`,
        checkedAt: now,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // Full Consistency Report
  // ═══════════════════════════════════════════════════════════════

  generateReport(enginePairs?: [string, string][]): ConsistencyReport {
    const allResults: ConsistencyResult[] = [];
    const now = Date.now();
    const engineIds = Array.from(this.snapshots.keys());

    // If specific pairs provided, use those; otherwise check all
    const pairs = enginePairs || this.generatePairs(engineIds);

    // Symbol mapping check between pairs
    for (const [a, b] of pairs) {
      allResults.push(...this.checkSymbolMapping(a, b));
    }

    // Quote freshness per engine
    for (const id of engineIds) {
      allResults.push(...this.checkQuoteFreshness(id));
    }

    // Cache coherence across all
    if (engineIds.length >= 2) {
      allResults.push(...this.checkCacheCoherence(engineIds));
    }

    // Value drift for common keys between pairs
    for (const [a, b] of pairs) {
      const snapA = this.getSnapshot(a);
      const snapB = this.getSnapshot(b);
      if (!snapA || !snapB) continue;

      // Find common keys
      const commonKeys = new Set<string>();
      for (const key of snapA.data.keys()) {
        if (snapB.data.has(key)) commonKeys.add(key);
      }

      for (const key of commonKeys) {
        allResults.push(this.checkValueDrift(a, b, key));
      }
    }

    const consistentCount = allResults.filter(r => r.status === 'consistent').length;
    const staleCount = allResults.filter(r => r.status === 'stale').length;
    const divergentCount = allResults.filter(r => r.status === 'divergent' || r.status === 'error').length;

    let overallStatus: ConsistencyStatus;
    if (divergentCount > 2) overallStatus = 'divergent';
    else if (staleCount > 3) overallStatus = 'stale';
    else if (consistentCount === allResults.length) overallStatus = 'consistent';
    else overallStatus = 'consistent';

    const recommendations: string[] = [];
    for (const r of allResults) {
      if (r.status === 'divergent' || r.status === 'error') {
        recommendations.push(`[${r.check}] ${r.message}`);
      }
    }
    if (staleCount > 0) {
      recommendations.push(`[stale] ${staleCount} checks found stale data. Refresh data pipeline.`);
    }
    if (recommendations.length === 0) {
      recommendations.push('All data consistency checks passed. No issues found.');
    }

    const report: ConsistencyReport = {
      id: this.nextId(),
      generatedAt: now,
      totalChecks: allResults.length,
      consistentCount,
      staleCount,
      divergentCount,
      results: allResults,
      overallStatus,
      recommendations,
    };

    this.reports.push(report);
    log.info(`[DataConsistency] Report: ${overallStatus}, ${allResults.length} checks, ${divergentCount} divergent`);
    return report;
  }

  private generatePairs(ids: string[]): [string, string][] {
    const pairs: [string, string][] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push([ids[i], ids[j]]);
      }
    }
    return pairs;
  }

  // ═══════════════════════════════════════════════════════════════
  // Threshold Configuration
  // ═══════════════════════════════════════════════════════════════

  setThresholds(updates: Partial<typeof this.thresholds>): void {
    Object.assign(this.thresholds, updates);
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getLatestReport(): ConsistencyReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  getReportHistory(limit?: number): ConsistencyReport[] {
    return this.reports.slice(-(limit || 10));
  }

  getEngineIds(): string[] {
    return Array.from(this.snapshots.keys());
  }
}
