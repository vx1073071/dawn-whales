/**
 * R253 DQ: DataQualityBaseline — 数据质量基准
 * LOBEHUB | v3.0.0 QUANT MOO
 *
 * 为3个新数据源 (Yahoo WS/Binance WS/东方财富) 定义质量基准。
 * 检查: 延迟/完整性/准确性/新鲜度/去重率
 *
 * 源质量评分: 0-100, 用于自动降级决策
 * >=400L
 */

import log from 'electron-log';

export type DataSourceType = 'websocket' | 'rest' | 'rss';

export interface DataQualityMetrics {
  sourceId: string; sourceType: DataSourceType;
  // 延迟
  avgLatencyMs: number; p95LatencyMs: number; p99LatencyMs: number;
  // 完整性
  completeness: number;      // 0-1, 收到的数据点/预期数据点
  missingSymbols: string[];
  // 准确性
  accuracy: number;          // 0-1, 与基准源的价格偏差<0.1%
  outlierCount: number;
  // 新鲜度
  stalenessMs: number;       // 最近数据距今多久
  lastUpdateTime: number;
  // 去重
  dedupRate: number;         // 0-1
  duplicateCount: number;
  // 综合
  qualityScore: number;      // 0-100
  grade: 'A'|'B'|'C'|'D'|'F';
  recommendation: string;
}

export class DataQualityBaseline {
  readonly id = 'data_quality_baseline'; readonly version = '3.0.0';

  readonly baselines: Record<string, Partial<DataQualityMetrics>> = {
    // Yahoo Finance WebSocket (主力行情)
    yahoo_ws: {
      sourceType: 'websocket',
      avgLatencyMs: 150, p95LatencyMs: 300, p99LatencyMs: 500,
      completeness: 0.99, accuracy: 0.998,
      stalenessMs: 5000, dedupRate: 0.02,
    },
    // Binance WebSocket (加密行情)
    binance_ws: {
      sourceType: 'websocket',
      avgLatencyMs: 80, p95LatencyMs: 200, p99LatencyMs: 400,
      completeness: 0.995, accuracy: 0.999,
      stalenessMs: 3000, dedupRate: 0.01,
    },
    // 东方财富 REST API (中文行情)
    eastmoney_rest: {
      sourceType: 'rest',
      avgLatencyMs: 500, p95LatencyMs: 1200, p99LatencyMs: 3000,
      completeness: 0.95, accuracy: 0.99,
      stalenessMs: 30000, dedupRate: 0.05,
    },
    // RSS 新闻源 (通用基准)
    rss_standard: {
      sourceType: 'rss',
      avgLatencyMs: 800, p95LatencyMs: 2000, p99LatencyMs: 5000,
      completeness: 0.90, accuracy: 0.95,
      stalenessMs: 120000, dedupRate: 0.10,
    },
  };

  /**
   * 综合质量评分
   * 权重: 延迟25% + 完整性30% + 准确性25% + 新鲜度15% + 去重5%
   */
  score(metrics: Partial<DataQualityMetrics>, baseline: Partial<DataQualityMetrics>): DataQualityMetrics {
    const m = { ...baseline, ...metrics } as DataQualityMetrics;

    const latencyScore = Math.max(0, 1 - (m.avgLatencyMs / 3000)) * 25;
    const completenessScore = m.completeness * 30;
    const accuracyScore = m.accuracy * 25;
    const freshnessScore = Math.max(0, 1 - (m.stalenessMs / 120000)) * 15;
    const dedupScore = (1 - m.dedupRate) * 5;

    const qualityScore = Math.round(latencyScore + completenessScore + accuracyScore + freshnessScore + dedupScore);

    const grade = qualityScore >= 90 ? 'A' : qualityScore >= 75 ? 'B'
      : qualityScore >= 60 ? 'C' : qualityScore >= 40 ? 'D' : 'F';

    const recommendation = grade === 'A' ? '可作为主力源'
      : grade === 'B' ? '可用，定期监控'
      : grade === 'C' ? '建议配置备选源'
      : grade === 'D' ? '需改善后使用'
      : '不可用于生产';

    return { ...m, qualityScore, grade, recommendation };
  }

  getBaseline(sourceId: string): Partial<DataQualityMetrics> {
    return this.baselines[sourceId] || this.baselines.rss_standard || {};
  }

  /** 检查实际指标是否达标 */
  check(sourceId: string, actual: Partial<DataQualityMetrics>): { pass: boolean; failedChecks: string[] } {
    const baseline = this.getBaseline(sourceId);
    const failed: string[] = [];

    if (actual.avgLatencyMs && baseline.avgLatencyMs && actual.avgLatencyMs > baseline.avgLatencyMs * 2)
      failed.push(`延迟超标: ${actual.avgLatencyMs}ms > ${baseline.avgLatencyMs! * 2}ms`);
    if (actual.completeness && baseline.completeness && actual.completeness < baseline.completeness * 0.9)
      failed.push(`完整性不足: ${(actual.completeness*100).toFixed(0)}% < ${(baseline.completeness*90).toFixed(0)}%`);
    if (actual.accuracy && baseline.accuracy && actual.accuracy < baseline.accuracy * 0.95)
      failed.push(`准确性不足: ${(actual.accuracy*100).toFixed(1)}% < ${(baseline.accuracy*95).toFixed(1)}%`);

    return { pass: failed.length === 0, failedChecks: failed };
  }

  /** 生成质量报告 */
  report(metricsBySource: Record<string, Partial<DataQualityMetrics>>) {
    const results: Record<string, DataQualityMetrics> = {};
    for (const [id, m] of Object.entries(metricsBySource)) {
      results[id] = this.score(m, this.getBaseline(id));
    }
    return results;
  }
}

export default DataQualityBaseline;
