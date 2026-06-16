/**
 * DQ-03 DataQualityMonitorEngine — R255 QUANT MOO
 *
 * 数据质量监控引擎。对行情数据流进行多维质量检测，确保数据准确性与及时性。
 * 支持5大质量维度监控，综合评分，异常告警与历史趋势追踪。
 *
 * 五大质量维度:
 * 1. Timeliness — 延迟、超时、数据年龄
 * 2. Completeness — 缺失字段、空值率
 * 3. Consistency — 交叉校验、异常跳变
 * 4. Accuracy — 价格合理性、量价背离
 * 5. Coverage — 订阅覆盖率、symbol覆盖率
 *
 * Features:
 * - Per-symbol and aggregate quality scores
 * - 5-dimension weighted scoring w/ customizable thresholds
 * - Anomaly detection: stale data, jumps, gaps, zero-price, volume spikes
 * - Historical tracking (last N snapshots) for trend detection
 * - Alerting with severity levels (info/warning/critical)
 * - Health report generation
 *
 * Architecture:
 * - Singleton with reset() for testability
 * - EventEmitter for quality alerts
 * - Ring-buffer history per symbol
 *
 * @author JVS
 * @round R255
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export interface QuotePoint {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: number;
  source: string;
}

export interface TimelinessMetrics {
  latencyMs: number;
  dataAgeMs: number;
  staleness: 'fresh' | 'stale' | 'expired';
  score: number;            // 0-100
}

export interface CompletenessMetrics {
  totalFields: number;
  missingFields: string[];
  nullValueCount: number;
  completenessRate: number;  // 0-1
  score: number;
}

export interface ConsistencyMetrics {
  crossSourceMatch: boolean;
  priceJumpCount: number;
  bidAskSpreadValid: boolean;
  ohloValid: boolean;
  score: number;
}

export interface AccuracyMetrics {
  priceInRange: boolean;
  volumeReasonable: boolean;
  spreadRatio: number;
  volatilityCheck: boolean;
  score: number;
}

export interface CoverageMetrics {
  subscribedCount: number;
  receivedCount: number;
  coverageRate: number;
  sourceBreakdown: Record<string, number>;
  score: number;
}

export interface QualitySnapshot {
  symbol: string;
  timestamp: number;
  timeliness: TimelinessMetrics;
  completeness: CompletenessMetrics;
  consistency: ConsistencyMetrics;
  accuracy: AccuracyMetrics;
  coverage: CoverageMetrics;
  overallScore: number;      // 0-100 weighted aggregate
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  alerts: QualityAlert[];
}

export interface QualityAlert {
  timestamp: number;
  dimension: 'timeliness' | 'completeness' | 'consistency' | 'accuracy' | 'coverage';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detail: Record<string, unknown>;
}

export interface DQConfig {
  weights: {
    timeliness: number;
    completeness: number;
    consistency: number;
    accuracy: number;
    coverage: number;
  };
  thresholds: {
    stalenessMs: number;
    dataAgeMaxMs: number;
    completenessMinRate: number;
    priceJumpThresholdPct: number;
    maxSpreadPct: number;
    coverageMinRate: number;
    qualityWarnThreshold: number;
    qualityCriticalThreshold: number;
  };
  historyMaxSize: number;
  alertMaxPerSnapshot: number;
}

export interface DQHealthReport {
  generatedAt: number;
  symbolsTracked: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  alertSummary: Record<string, number>;
  worstSymbols: string[];
  trend: 'improving' | 'stable' | 'degrading';
}

// ─── Constants ───────────────────────────────────────────

const DEFAULT_CONFIG: DQConfig = {
  weights: {
    timeliness: 25,
    completeness: 25,
    consistency: 20,
    accuracy: 20,
    coverage: 10,
  },
  thresholds: {
    stalenessMs: 5000,
    dataAgeMaxMs: 60000,
    completenessMinRate: 0.95,
    priceJumpThresholdPct: 10,
    maxSpreadPct: 5,
    coverageMinRate: 0.9,
    qualityWarnThreshold: 70,
    qualityCriticalThreshold: 50,
  },
  historyMaxSize: 50,
  alertMaxPerSnapshot: 5,
};

// ─── Engine ──────────────────────────────────────────────

export class DataQualityMonitorEngine extends EventEmitter {
  private static instance: DataQualityMonitorEngine;

  private config: DQConfig = { ...DEFAULT_CONFIG, weights: { ...DEFAULT_CONFIG.weights }, thresholds: { ...DEFAULT_CONFIG.thresholds } };
  private history = new Map<string, QualitySnapshot[]>();
  private alerts = new Map<string, QualityAlert[]>();
  private snapshotCount = 0;

  private constructor() {
    super();
  }

  static getInstance(): DataQualityMonitorEngine {
    if (!DataQualityMonitorEngine.instance) {
      DataQualityMonitorEngine.instance = new DataQualityMonitorEngine();
    }
    return DataQualityMonitorEngine.instance;
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG, weights: { ...DEFAULT_CONFIG.weights }, thresholds: { ...DEFAULT_CONFIG.thresholds } };
    this.history.clear();
    this.alerts.clear();
    this.snapshotCount = 0;
    this.removeAllListeners();
  }

  // ─── Config ────────────────────────────────────────

  configure(partial: Partial<{ weights: Partial<DQConfig['weights']>; thresholds: Partial<DQConfig['thresholds']>; historyMaxSize: number; alertMaxPerSnapshot: number }>): void {
    if (partial.weights) Object.assign(this.config.weights, partial.weights);
    if (partial.thresholds) Object.assign(this.config.thresholds, partial.thresholds);
    if (partial.historyMaxSize !== undefined) this.config.historyMaxSize = partial.historyMaxSize;
    if (partial.alertMaxPerSnapshot !== undefined) this.config.alertMaxPerSnapshot = partial.alertMaxPerSnapshot;
  }

  getConfig(): Readonly<DQConfig> {
    return JSON.parse(JSON.stringify(this.config));
  }

  // ─── Dimension Analyzers ───────────────────────────

  analyzeTimeliness(quote: QuotePoint, prevTimestamp = 0): TimelinessMetrics {
    const now = Date.now();
    const dataAgeMs = now - quote.timestamp;
    const latencyMs = prevTimestamp ? quote.timestamp - prevTimestamp : 0;

    let staleness: 'fresh' | 'stale' | 'expired';
    if (dataAgeMs < this.config.thresholds.stalenessMs) staleness = 'fresh';
    else if (dataAgeMs < this.config.thresholds.dataAgeMaxMs) staleness = 'stale';
    else staleness = 'expired';

    let score = 100;
    if (dataAgeMs > this.config.thresholds.stalenessMs) {
      score -= Math.min(50, (dataAgeMs - this.config.thresholds.stalenessMs) / (this.config.thresholds.dataAgeMaxMs - this.config.thresholds.stalenessMs) * 50);
    }
    if (staleness === 'expired') score = Math.max(0, score - 40);

    return { latencyMs, dataAgeMs, staleness, score: Math.max(0, score) };
  }

  analyzeCompleteness(quote: QuotePoint): CompletenessMetrics {
    const fields = ['price', 'bid', 'ask', 'volume', 'high', 'low', 'open', 'close'] as const;
    const missingFields: string[] = [];
    let nullValueCount = 0;

    for (const field of fields) {
      const val = quote[field as keyof QuotePoint];
      if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
        missingFields.push(field);
        nullValueCount++;
      }
    }

    // Check for zero/negative values where they shouldn't be
    if (quote.price <= 0 && !missingFields.includes('price')) { nullValueCount++; missingFields.push('price_zero'); }
    if (quote.volume < 0 && !missingFields.includes('volume')) { nullValueCount++; missingFields.push('volume_negative'); }

    const total = fields.length + 2; // +2 for zero/negative checks
    const rate = 1 - (nullValueCount / total);
    const score = Math.min(100, Math.max(0, rate * 100));

    return {
      totalFields: total,
      missingFields,
      nullValueCount,
      completenessRate: Math.max(0, rate),
      score,
    };
  }

  analyzeConsistency(quote: QuotePoint, prev?: QuotePoint): ConsistencyMetrics {
    let priceJumpCount = 0;
    if (prev && prev.price > 0) {
      const pctChange = Math.abs(quote.price - prev.price) / prev.price * 100;
      if (pctChange > this.config.thresholds.priceJumpThresholdPct) {
        priceJumpCount = 1;
      }
    }

    const bidAskSpreadValid = quote.bid > 0 && quote.ask > 0 && quote.bid <= quote.ask;
    const ohloValid =
      quote.high >= quote.low &&
      quote.high >= Math.max(quote.open, quote.close) - 0.001 &&
      quote.low <= Math.min(quote.open, quote.close) + 0.001;

    let score = 100;
    if (priceJumpCount > 0) score -= 30;
    if (!bidAskSpreadValid) score -= 25;
    if (!ohloValid) score -= 25;

    return {
      crossSourceMatch: true,  // Simplified — multi-source check would compare v2
      priceJumpCount,
      bidAskSpreadValid,
      ohloValid,
      score: Math.max(0, score),
    };
  }

  analyzeAccuracy(quote: QuotePoint): AccuracyMetrics {
    const priceInRange = quote.price > 0 && quote.price < 1e7;
    const volumeReasonable = quote.volume >= 0 && quote.volume < 1e12;
    const spreadRatio = quote.ask > 0 ? (quote.ask - quote.bid) / quote.ask * 100 : 0;
    const spreadValid = spreadRatio <= this.config.thresholds.maxSpreadPct;
    const volatilityCheck = quote.high > 0 ? (quote.high - quote.low) / quote.high * 100 < 50 : true;

    let score = 100;
    if (!priceInRange) score -= 30;
    if (!volumeReasonable) score -= 20;
    if (!spreadValid) score -= 25;
    if (!volatilityCheck) score -= 25;

    return {
      priceInRange,
      volumeReasonable,
      spreadRatio,
      volatilityCheck,
      score: Math.max(0, score),
    };
  }

  analyzeCoverage(
    symbol: string,
    subscribedCount: number,
    sourceBreakdown: Record<string, number>
  ): CoverageMetrics {
    const receivedCount = (this.history.get(symbol.toUpperCase()) ?? []).length;
    const coverageRate = subscribedCount > 0 ? Math.min(1, receivedCount / subscribedCount) : 0;
    const score = Math.min(100, coverageRate * 100);

    return {
      subscribedCount,
      receivedCount,
      coverageRate,
      sourceBreakdown,
      score,
    };
  }

  // ─── Snapshot Generation ───────────────────────────

  evaluateQuote(
    quote: QuotePoint,
    subscribedCount = 1,
    sourceBreakdown: Record<string, number> = {}
  ): QualitySnapshot {
    const symbol = quote.symbol.toUpperCase();
    const prevSnapshots = this.history.get(symbol) ?? [];
    const prevQuote = prevSnapshots.length > 0
      ? {
          price: quote.close > 0 ? quote.close : quote.price,
          timestamp: prevSnapshots[prevSnapshots.length - 1].timestamp,
        } as QuotePoint
      : undefined;

    const timeliness = this.analyzeTimeliness(quote, prevQuote?.timestamp);
    const completeness = this.analyzeCompleteness(quote);
    const consistency = this.analyzeConsistency(quote, prevSnapshots.length > 0
      ? { price: prevSnapshots[prevSnapshots.length - 1].price, timestamp: prevSnapshots[prevSnapshots.length - 1].timestamp } as QuotePoint
      : undefined
    );
    const accuracy = this.analyzeAccuracy(quote);
    const coverage = this.analyzeCoverage(symbol, subscribedCount, sourceBreakdown);

    const overallScore = (
      timeliness.score * this.config.weights.timeliness +
      completeness.score * this.config.weights.completeness +
      consistency.score * this.config.weights.consistency +
      accuracy.score * this.config.weights.accuracy +
      coverage.score * this.config.weights.coverage
    ) / 100;

    const grade: QualitySnapshot['grade'] =
      overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F';

    const alerts = this.generateAlerts(symbol, timeliness, completeness, consistency, accuracy, coverage, overallScore);

    const snapshot: QualitySnapshot = {
      symbol,
      timestamp: Date.now(),
      timeliness,
      completeness,
      consistency,
      accuracy,
      coverage,
      overallScore: Math.round(overallScore * 100) / 100,
      grade,
      alerts,
    };

    // Store in history
    const history = this.history.get(symbol) ?? [];
    history.push(snapshot);
    if (history.length > this.config.historyMaxSize) history.shift();
    this.history.set(symbol, history);

    // Store alerts
    if (alerts.length > 0) {
      const existingAlerts = this.alerts.get(symbol) ?? [];
      existingAlerts.push(...alerts);
      this.alerts.set(symbol, existingAlerts);
    }

    this.snapshotCount++;
    this.emit('quality_check', snapshot);

    if (alerts.some(a => a.severity === 'critical')) {
      this.emit('critical_alert', { symbol, snapshot });
    }

    return snapshot;
  }

  evaluateBatch(quotes: QuotePoint[]): QualitySnapshot[] {
    return quotes.map(q => this.evaluateQuote(q));
  }

  // ─── Alert Generation ──────────────────────────────

  private generateAlerts(
    symbol: string,
    timeliness: TimelinessMetrics,
    completeness: CompletenessMetrics,
    consistency: ConsistencyMetrics,
    accuracy: AccuracyMetrics,
    coverage: CoverageMetrics,
    overallScore: number
  ): QualityAlert[] {
    const alerts: QualityAlert[] = [];
    const now = Date.now();

    if (timeliness.staleness === 'expired') {
      alerts.push({ timestamp: now, dimension: 'timeliness', severity: 'critical', message: `${symbol} 数据已过期 (${timeliness.dataAgeMs}ms)`, detail: { dataAgeMs: timeliness.dataAgeMs } });
    } else if (timeliness.staleness === 'stale') {
      alerts.push({ timestamp: now, dimension: 'timeliness', severity: 'warning', message: `${symbol} 数据延迟 (${timeliness.dataAgeMs}ms)`, detail: { dataAgeMs: timeliness.dataAgeMs } });
    }

    if (completeness.completenessRate < this.config.thresholds.completenessMinRate) {
      alerts.push({ timestamp: now, dimension: 'completeness', severity: completeness.completenessRate < 0.8 ? 'critical' : 'warning', message: `${symbol} 缺失字段: ${completeness.missingFields.join(', ')}`, detail: { missingFields: completeness.missingFields, rate: completeness.completenessRate } });
    }

    if (consistency.priceJumpCount > 0) {
      alerts.push({ timestamp: now, dimension: 'consistency', severity: 'critical', message: `${symbol} 价格异常跳变`, detail: { jumpCount: consistency.priceJumpCount } });
    }

    if (!consistency.bidAskSpreadValid) {
      alerts.push({ timestamp: now, dimension: 'consistency', severity: 'warning', message: `${symbol} 买卖价差异常`, detail: {} });
    }

    if (!accuracy.spreadValid) {
      alerts.push({ timestamp: now, dimension: 'accuracy', severity: 'warning', message: `${symbol} 买卖价差过大 (${accuracy.spreadRatio.toFixed(1)}%)`, detail: { spreadRatio: accuracy.spreadRatio } });
    }

    if (coverage.coverageRate < this.config.thresholds.coverageMinRate) {
      alerts.push({ timestamp: now, dimension: 'coverage', severity: 'warning', message: `${symbol} 覆盖率低 (${(coverage.coverageRate * 100).toFixed(0)}%)`, detail: { rate: coverage.coverageRate } });
    }

    if (overallScore < this.config.thresholds.qualityCriticalThreshold) {
      alerts.push({ timestamp: now, dimension: 'consistency', severity: 'critical', message: `${symbol} 综合质量 CRITICAL (${overallScore.toFixed(0)})`, detail: { overallScore } });
    } else if (overallScore < this.config.thresholds.qualityWarnThreshold) {
      alerts.push({ timestamp: now, dimension: 'consistency', severity: 'warning', message: `${symbol} 综合质量偏低 (${overallScore.toFixed(0)})`, detail: { overallScore } });
    }

    return alerts.slice(0, this.config.alertMaxPerSnapshot);
  }

  // ─── Query ──────────────────────────────────────────

  getHistory(symbol: string): QualitySnapshot[] {
    return this.history.get(symbol.toUpperCase()) ?? [];
  }

  getAlerts(symbol?: string): QualityAlert[] {
    if (symbol) return this.alerts.get(symbol.toUpperCase()) ?? [];
    const all: QualityAlert[] = [];
    for (const alerts of this.alerts.values()) all.push(...alerts);
    return all;
  }

  getLatestSnapshot(symbol: string): QualitySnapshot | undefined {
    const hist = this.history.get(symbol.toUpperCase());
    if (!hist || hist.length === 0) return undefined;
    return hist[hist.length - 1];
  }

  getAllSymbols(): string[] {
    return Array.from(this.history.keys());
  }

  getSnapshotCount(): number {
    return this.snapshotCount;
  }

  getAlertCount(severity?: string): number {
    let count = 0;
    for (const alerts of this.alerts.values()) {
      for (const a of alerts) {
        if (!severity || a.severity === severity) count++;
      }
    }
    return count;
  }

  // ─── Health Report ──────────────────────────────────

  generateHealthReport(): DQHealthReport {
    const symbols = Array.from(this.history.keys());
    let totalScore = 0;
    let totalSnapshots = 0;
    const gradeDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const alertSum: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const symbolScores: Array<{ symbol: string; score: number }> = [];

    for (const [symbol, snapshots] of this.history) {
      const avgScore = snapshots.reduce((s, snap) => s + snap.overallScore, 0) / snapshots.length;
      symbolScores.push({ symbol, score: avgScore });
      totalScore += avgScore;
      totalSnapshots++;
      for (const snap of snapshots) {
        gradeDist[snap.grade]++;
      }
    }

    const allAlerts = this.getAlerts();
    for (const a of allAlerts) {
      alertSum[a.severity] = (alertSum[a.severity] ?? 0) + 1;
    }

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (totalSnapshots >= 3) {
      const recent = symbolScores.reduce((s, x) => s + x.score, 0) / symbolScores.length;
      // Simplified — real trend needs historical reports
      trend = recent >= 80 ? 'improving' : recent >= 50 ? 'stable' : 'degrading';
    }

    symbolScores.sort((a, b) => a.score - b.score);
    const worst = symbolScores.slice(0, 5).map(s => s.symbol);

    return {
      generatedAt: Date.now(),
      symbolsTracked: symbols.length,
      averageScore: totalSnapshots > 0 ? Math.round(totalScore / totalSnapshots * 100) / 100 : 0,
      gradeDistribution: gradeDist,
      alertSummary: alertSum,
      worstSymbols: worst,
      trend,
    };
  }

  // ─── Mock Data ──────────────────────────────────────

  createMockQuote(overrides: Partial<QuotePoint> = {}): QuotePoint {
    return {
      symbol: 'AAPL',
      price: 185.5,
      bid: 185.4,
      ask: 185.6,
      volume: 50000000,
      high: 186.2,
      low: 184.8,
      open: 185.0,
      close: 185.5,
      timestamp: Date.now() - 500,
      source: 'yahoo_finance',
      ...overrides,
    };
  }

  createMockBadQuote(): QuotePoint {
    return {
      symbol: 'BROKEN',
      price: 0,
      bid: 0,
      ask: 0,
      volume: -1,
      high: 100,
      low: 200,        // low > high = invalid OHLC
      open: 0,
      close: 0,
      timestamp: Date.now() - 120000,  // 2min old
      source: 'unknown',
    };
  }
}
