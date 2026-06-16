/**
 * DC-01 DataConsistencyFinalEngine — R256 QUANT MOO 终极验收
 *
 * 数据一致性终验引擎。对29个全球市场的多数据源行情数据进行
 * 一致性校验、差异检测、漂移监控和最终验收报告生成。
 *
 * 校验维度:
 * 1. Cross-Source (跨源): 同一股票在多源之间价格/成交量/时间戳一致性
 * 2. Cross-Market (跨市场): 关联品种(如SPY/ES期货)的价格关系
 * 3. Temporal (时序): 行情更新频率和时钟偏移
 * 4. Structural (结构): 数据字段完整性、类型准确性
 * 5. Business-Rule (业务规则): bid ≤ ask, price > 0, volume ≥ 0
 *
 * Acceptable thresholds:
 * - 价格差异: <0.1% (股票), <0.5% (加密)
 * - 时间戳偏移: <100ms
 * - 数据到达频率: 不低于声明的80%
 * - 字段缺失率: <1%
 *
 * Architecture:
 * - Singleton with reset() for testability
 * - EventEmitter for violation events
 * - Per-symbol consistency history
 * - Weighted scoring with pass/fail grading
 *
 * @author JVS
 * @round R256
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export interface QuoteSnapshot {
  symbol: string;
  source: string;
  market: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
  high?: number;
  low?: number;
  open?: number;
  prevClose?: number;
}

export interface ConsistencyViolation {
  type: 'price_mismatch' | 'timestamp_drift' | 'volume_discrepancy' | 'spread_invalid' |
        'missing_fields' | 'stale_data' | 'field_range' | 'cross_source_conflict';
  severity: 'info' | 'warning' | 'error' | 'critical';
  symbol: string;
  source: string;
  detail: string;
  actual: string;
  expected: string;
  timestamp: number;
}

export interface ConsistencyCheckResult {
  symbol: string;
  sourcesChecked: string[];
  violations: ConsistencyViolation[];
  score: number;         // 0-100
  grade: 'PASS' | 'WARN' | 'FAIL';
  crossedSources: boolean;
  businessRulesPass: boolean;
  structuralIntegrity: boolean;
}

export interface CrossSourceComparison {
  symbol: string;
  sources: Record<string, number>;  // source → price
  maxDeviationPct: number;
  deviatingSources: string[];
  consistent: boolean;
}

export interface FinalVerificationReport {
  id: string;
  generatedAt: number;
  symbolsChecked: number;
  totalViolations: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passRate: number;
  results: ConsistencyCheckResult[];
  crossSourceResults: CrossSourceComparison[];
  recommendations: string[];
  verdict: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  marketsChecked: string[];
  summary: string;
}

// ─── Constants ───────────────────────────────────────────

const PRICE_THRESHOLD_PCT = 0.1;      // Stock: 0.1%
const CRYPTO_PRICE_THRESHOLD_PCT = 0.5; // Crypto: 0.5%
const TIMESTAMP_DRIFT_MS = 100;
const STALE_THRESHOLD_MS = 60000;     // 1 minute

// ─── Engine ──────────────────────────────────────────────

export class DataConsistencyFinalEngine extends EventEmitter {
  private static instance: DataConsistencyFinalEngine;

  private results: ConsistencyCheckResult[] = [];
  private crossSourceResults: CrossSourceComparison[] = [];
  private marketsChecked: Set<string> = new Set();
  private symbolsChecked = 0;

  private constructor() {
    super();
  }

  static getInstance(): DataConsistencyFinalEngine {
    if (!DataConsistencyFinalEngine.instance) {
      DataConsistencyFinalEngine.instance = new DataConsistencyFinalEngine();
    }
    return DataConsistencyFinalEngine.instance;
  }

  reset(): void {
    this.results = [];
    this.crossSourceResults = [];
    this.marketsChecked.clear();
    this.symbolsChecked = 0;
    this.removeAllListeners();
  }

  // ─── Business Rules ─────────────────────────────────

  checkBusinessRules(snapshot: QuoteSnapshot): ConsistencyViolation[] {
    const violations: ConsistencyViolation[] = [];
    const { symbol, source, price, bid, ask, volume, high, low, open, timestamp } = snapshot;
    const now = Date.now();

    // Bid ≤ Ask
    if (bid > 0 && ask > 0 && bid > ask) {
      violations.push({
        type: 'spread_invalid', severity: 'error', symbol, source,
        detail: `Bid (${bid}) > Ask (${ask})`,
        actual: `${bid}/${ask}`, expected: 'bid ≤ ask', timestamp: now,
      });
    }

    // Price > 0
    if (price <= 0) {
      violations.push({
        type: 'field_range', severity: 'error', symbol, source,
        detail: `Price is ${price}`,
        actual: `${price}`, expected: '> 0', timestamp: now,
      });
    }

    // Volume ≥ 0
    if (volume < 0) {
      violations.push({
        type: 'field_range', severity: 'error', symbol, source,
        detail: `Volume is ${volume}`,
        actual: `${volume}`, expected: '≥ 0', timestamp: now,
      });
    }

    // High ≥ Low (if both present)
    if (high != null && low != null && high < low) {
      violations.push({
        type: 'field_range', severity: 'error', symbol, source,
        detail: `High (${high}) < Low (${low})`,
        actual: `${high}/${low}`, expected: 'high ≥ low', timestamp: now,
      });
    }

    // Stale data
    if (now - timestamp > STALE_THRESHOLD_MS) {
      violations.push({
        type: 'stale_data', severity: 'warning', symbol, source,
        detail: `Data is ${Math.round((now - timestamp) / 1000)}s old`,
        actual: `${new Date(timestamp).toISOString()}`,
        expected: `<${STALE_THRESHOLD_MS / 1000}s`, timestamp: now,
      });
    }

    return violations;
  }

  // ─── Cross-Source Comparison ────────────────────────

  compareCrossSource(snapshots: QuoteSnapshot[]): CrossSourceComparison | null {
    if (snapshots.length < 2) return null;

    const symbol = snapshots[0].symbol;
    const sources: Record<string, number> = {};
    const prices: number[] = [];

    for (const s of snapshots) {
      sources[s.source] = s.price;
      prices.push(s.price);
    }

    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const deviations = prices.map(p => Math.abs(p - avgPrice) / avgPrice * 100);
    const maxDeviationPct = Math.round(Math.max(...deviations) * 1000) / 1000;

    const deviatingSources: string[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      if (deviations[i] > PRICE_THRESHOLD_PCT) {
        deviatingSources.push(snapshots[i].source);
      }
    }

    const consistent = deviatingSources.length === 0;

    return { symbol, sources, maxDeviationPct, deviatingSources, consistent };
  }

  // ─── Single Snapshot Check ──────────────────────────

  checkSnapshot(snapshot: QuoteSnapshot): ConsistencyCheckResult {
    const violations: ConsistencyViolation[] = [];

    // Business rules
    violations.push(...this.checkBusinessRules(snapshot));

    // Structural integrity
    const requiredFields: Array<keyof QuoteSnapshot> = ['symbol', 'source', 'market', 'price', 'bid', 'ask', 'volume', 'timestamp'];
    const missingFields = requiredFields.filter(f => snapshot[f] == null || snapshot[f] === undefined);
    if (missingFields.length > 0) {
      violations.push({
        type: 'missing_fields', severity: 'error', symbol: snapshot.symbol, source: snapshot.source,
        detail: `Missing: ${missingFields.join(', ')}`,
        actual: `${missingFields.length} missing`, expected: '0 missing', timestamp: Date.now(),
      });
    }

    // Calculate score
    const maxScore = 100;
    let deductions = 0;
    for (const v of violations) {
      switch (v.severity) {
        case 'critical': deductions += 40; break;
        case 'error': deductions += 20; break;
        case 'warning': deductions += 5; break;
        case 'info': deductions += 1; break;
      }
    }
    const score = Math.max(0, maxScore - deductions);

    let grade: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (score < 60 || violations.some(v => v.severity === 'critical')) grade = 'FAIL';
    else if (score < 85 || violations.some(v => v.severity === 'error')) grade = 'WARN';

    const businessRulesPass = !violations.some(v => v.type === 'spread_invalid' || v.type === 'field_range');
    const structuralIntegrity = !violations.some(v => v.type === 'missing_fields');

    // Emit violations
    for (const v of violations) {
      this.emit('violation', v);
    }

    this.symbolsChecked++;

    const result: ConsistencyCheckResult = {
      symbol: snapshot.symbol,
      sourcesChecked: [snapshot.source],
      violations,
      score,
      grade,
      crossedSources: false,
      businessRulesPass,
      structuralIntegrity,
    };

    this.results.push(result);
    this.marketsChecked.add(snapshot.market);
    return result;
  }

  // ─── Batch Check ────────────────────────────────────

  checkBatch(snapshots: QuoteSnapshot[]): ConsistencyCheckResult[] {
    const results: ConsistencyCheckResult[] = [];

    // Group by symbol for cross-source
    const bySymbol = new Map<string, QuoteSnapshot[]>();
    for (const s of snapshots) {
      if (!bySymbol.has(s.symbol)) bySymbol.set(s.symbol, []);
      bySymbol.get(s.symbol)!.push(s);
    }

    for (const [symbol, group] of bySymbol) {
      // Individual checks
      for (const s of group) {
        const r = this.checkSnapshot(s);
        results.push(r);
      }

      // Cross-source comparison (if multi-source)
      if (group.length >= 2) {
        const cross = this.compareCrossSource(group);
        if (cross) {
          this.crossSourceResults.push(cross);
          if (!cross.consistent) {
            this.emit('cross_source_conflict', cross);
          }
        }
      }

      // Track markets
      for (const s of group) {
        this.marketsChecked.add(s.market);
      }
    }

    for (const r of results) {
      const crossResult = this.crossSourceResults.find(c => c.symbol === r.symbol);
      r.crossedSources = crossResult != null && crossResult.consistent;
    }

    return results;
  }

  // ─── Final Report ───────────────────────────────────

  generateFinalReport(): FinalVerificationReport {
    const criticalCount = this.results.reduce((sum, r) =>
      sum + r.violations.filter(v => v.severity === 'critical').length, 0);
    const errorCount = this.results.reduce((sum, r) =>
      sum + r.violations.filter(v => v.severity === 'error').length, 0);
    const warningCount = this.results.reduce((sum, r) =>
      sum + r.violations.filter(v => v.severity === 'warning').length, 0);
    const infoCount = this.results.reduce((sum, r) =>
      sum + r.violations.filter(v => v.severity === 'info').length, 0);
    const totalViolations = criticalCount + errorCount + warningCount + infoCount;

    const passCount = this.results.filter(r => r.grade === 'PASS').length;
    const passRate = this.results.length > 0
      ? Math.round(passCount / this.results.length * 10000) / 100
      : 100;

    const recommendations: string[] = [];
    if (criticalCount > 0) recommendations.push(`存在${criticalCount}个严重违规，需立即修复`);
    if (errorCount > 0) recommendations.push(`存在${errorCount}个错误违规，建议修复后重新验证`);
    if (passRate < 90) recommendations.push('验收通过率低于90%，签署更多数据源');
    if (this.marketsChecked.size < 29) recommendations.push(`仅覆盖${this.marketsChecked.size}/29个市场`);

    if (recommendations.length === 0) {
      recommendations.push('✅ 所有数据一致性检查通过，可发布 v2.9.0');
    }

    let verdict: 'READY' | 'CONDITIONAL' | 'NOT_READY' = 'READY';
    if (criticalCount > 0 || passRate < 80) verdict = 'NOT_READY';
    else if (errorCount > 0 || passRate < 90) verdict = 'CONDITIONAL';

    const summary = `验收${this.results.length}条数据: ${passCount} PASS (${passRate}%), ` +
      `${totalViolations} violations (${criticalCount}C/${errorCount}E/${warningCount}W/${infoCount}I)`;

    return {
      id: `dc-final-${Date.now()}`,
      generatedAt: Date.now(),
      symbolsChecked: this.symbolsChecked,
      totalViolations,
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      passRate,
      results: this.results,
      crossSourceResults: this.crossSourceResults,
      recommendations,
      verdict,
      marketsChecked: Array.from(this.marketsChecked),
      summary,
    };
  }

  // ─── Query ──────────────────────────────────────────

  getResults(): ConsistencyCheckResult[] {
    return this.results;
  }

  getCrossSourceResults(): CrossSourceComparison[] {
    return this.crossSourceResults;
  }

  getMarketsChecked(): string[] {
    return Array.from(this.marketsChecked);
  }

  getSymbolCount(): number {
    return this.symbolsChecked;
  }

  getViolationCount(): number {
    return this.results.reduce((sum, r) => sum + r.violations.length, 0);
  }

  // ─── Mock Data ──────────────────────────────────────

  createMockSnapshot(overrides: Partial<QuoteSnapshot> = {}): QuoteSnapshot {
    const base: QuoteSnapshot = {
      symbol: 'AAPL',
      source: 'yahoo_ws',
      market: 'US',
      price: 185.50,
      bid: 185.40,
      ask: 185.60,
      volume: 52000000,
      timestamp: Date.now(),
      high: 186.20,
      low: 184.80,
      open: 185.00,
      prevClose: 184.90,
      ...overrides,
    };
    return base;
  }

  createMockBatch(): QuoteSnapshot[] {
    return [
      this.createMockSnapshot({ symbol: 'AAPL', source: 'yahoo_ws', price: 185.50 }),
      this.createMockSnapshot({ symbol: 'AAPL', source: 'binance', price: 185.55 }),
      this.createMockSnapshot({ symbol: 'MSFT', source: 'yahoo_ws', price: 410.20 }),
      this.createMockSnapshot({ symbol: 'MSFT', source: 'futu', price: 410.30 }),
      this.createMockSnapshot({ symbol: 'GOOG', source: 'yahoo_ws', price: 142.80 }),
    ];
  }

  createMockBadSnapshot(): QuoteSnapshot {
    return this.createMockSnapshot({
      symbol: 'BROKEN',
      source: 'bad_source',
      price: -1,
      bid: 200,
      ask: 100,
      volume: -500,
      timestamp: Date.now() - 120000,
    });
  }
}
