// ══ R262 LOBEHUB P2: 行情KPI仪表盘 ══
// Market Data KPI Dashboard — P50/P99延迟+准确率+可用率+源覆盖
//
// 从R261的数据质量基准+源健康状态→综合仪表盘

// R262: 行情KPI仪表盘 — 聚合器

import {
  LatencyBenchmark, AccuracyBenchmark,
  CompletenessBenchmark,
} from './data-quality-benchmark-r261';

import {
  SourceHealthState, SOURCE_HEALTH_THRESHOLDS,
} from './source-health-thresholds-r262';

export interface SourceKPI {
  sourceId: string;
  sourceName: string;
  p50Ms: number;
  p95Ms: number;
  availabilityPct: number;
  accuracyMatchPct: number;
  missingRatePct: number;
  activeSymbols: number;
  totalExchanges: number;
  coveragePct: number;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptime: string;         // "99.7% / 23h59m"
}

export interface MarketDataKPI {
  timestamp: number;
  overallScore: number;       // 0-100
  overallStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  sources: SourceKPI[];
  globalMetrics: {
    avgP95Latency: number;
    avgAvailability: number;
    avgAccuracy: number;
    avgMissingRate: number;
    totalSymbols: number;
    totalExchanges: number;
    overallCoverage: number;  // 0-1, 覆盖29个市场的比例
  };
  topIssues: string[];
  trends: string[];
}

// ═══════════════════ 来源KPI计算 ═══════════════════

export function computeSourceKPI(
  sourceId: string,
  sourceName: string,
  latency: LatencyBenchmark[],
  accuracy: AccuracyBenchmark[],
  completeness: CompletenessBenchmark[],
  healthState: SourceHealthState,
): SourceKPI {
  const avgP50 = latency.reduce((s, l) => s + l.p50Ms, 0) / Math.max(1, latency.length);
  const avgP95 = latency.reduce((s, l) => s + l.p95Ms, 0) / Math.max(1, latency.length);
  const avgAvail = completeness.reduce((s, c) => s + (1 - c.missingRate), 0) / Math.max(1, completeness.length) * 100;
  const matchCount = accuracy.filter(a => a.status === 'MATCH' || a.status === 'TOLERABLE').length;
  const avgMatch = accuracy.length > 0 ? matchCount / accuracy.length * 100 : 0;
  const avgMissing = completeness.reduce((s, c) => s + c.missingRate, 0) / Math.max(1, completeness.length) * 100;
  const exchanges = [...new Set(latency.map(l => l.exchange))];

  return {
    sourceId, sourceName,
    p50Ms: Math.round(avgP50), p95Ms: Math.round(avgP95),
    availabilityPct: Math.round(avgAvail * 100) / 100,
    accuracyMatchPct: Math.round(avgMatch * 100) / 100,
    missingRatePct: Math.round(avgMissing * 100) / 100,
    activeSymbols: latency.length,
    totalExchanges: exchanges.length,
    coveragePct: exchanges.length / 29 * 100,
    status: healthState.status === 'DOWN' ? 'DOWN' : healthState.status === 'DEGRADED' ? 'DEGRADED' : 'HEALTHY',
    uptime: `${(100 - avgMissing).toFixed(1)}%`,
  };
}

// ═══════════════════ 仪表盘生成 ═══════════════════

export function generateMarketDataKPI(
  sourceLatency: Map<string, LatencyBenchmark[]>,
  sourceAccuracy: Map<string, AccuracyBenchmark[]>,
  sourceCompleteness: Map<string, CompletenessBenchmark[]>,
  healthStates: SourceHealthState[],
): MarketDataKPI {
  const sources: SourceKPI[] = [];

  for (const hs of healthStates) {
    const lat = sourceLatency.get(hs.sourceId) || [];
    const acc = sourceAccuracy.get(hs.sourceId) || [];
    const comp = sourceCompleteness.get(hs.sourceId) || [];
    const name = SOURCE_HEALTH_THRESHOLDS.find(t => t.sourceId === hs.sourceId)?.sourceName || hs.sourceId;
    sources.push(computeSourceKPI(hs.sourceId, name, lat, acc, comp, hs));
  }

  const avgP95 = sources.reduce((s, src) => s + src.p95Ms, 0) / Math.max(1, sources.length);
  const avgAvail = sources.reduce((s, src) => s + src.availabilityPct, 0) / Math.max(1, sources.length);
  const avgAcc = sources.reduce((s, src) => s + src.accuracyMatchPct, 0) / Math.max(1, sources.length);
  const avgMissing = sources.reduce((s, src) => s + src.missingRatePct, 0) / Math.max(1, sources.length);
  const totalSymbols = sources.reduce((s, src) => s + src.activeSymbols, 0);

  const allExchanges = new Set<string>();
  for (const lat of sourceLatency.values()) for (const l of lat) allExchanges.add(l.exchange);
  const totalExchanges = allExchanges.size;
  const overallCoverage = totalExchanges / 29;

  // Overall score
  let overallScore = 100;
  if (avgP95 > 500) overallScore -= 20;
  else if (avgP95 > 200) overallScore -= 10;
  if (avgAvail < 98) overallScore -= 20;
  else if (avgAvail < 95) overallScore -= 30;
  if (avgAcc < 98) overallScore -= 15;
  if (overallCoverage < 0.8) overallScore -= 15;
  if (healthStates.filter(h => h.status === 'DOWN').length > 0) overallScore -= 20;
  overallScore = Math.max(0, Math.min(100, overallScore));

  const overallStatus: MarketDataKPI['overallStatus'] =
    overallScore >= 90 ? 'EXCELLENT' :
    overallScore >= 70 ? 'GOOD' :
    overallScore >= 50 ? 'FAIR' : 'POOR';

  const topIssues: string[] = [];
  for (const s of sources) {
    if (s.status === 'DOWN') topIssues.push(`❌ ${s.sourceName}不可用`);
    else if (s.p95Ms > 500) topIssues.push(`⚠️ ${s.sourceName}延迟过高—P95=${s.p95Ms}ms`);
    if (s.accuracyMatchPct < 95) topIssues.push(`⚠️ ${s.sourceName}准确率仅${s.accuracyMatchPct.toFixed(1)}%`);
  }

  const trends: string[] = [];
  if (overallScore >= 90) trends.push('✅ 行情KPI优秀—可放心上线v3.0.0');
  else if (overallScore >= 70) trends.push('⚠️ 行情KPI良好—有可改进空间');
  else trends.push('❌ 行情KPI不合格—不宜发布');

  return {
    timestamp: Date.now(),
    overallScore,
    overallStatus,
    sources,
    globalMetrics: {
      avgP95Latency: Math.round(avgP95),
      avgAvailability: Math.round(avgAvail * 100) / 100,
      avgAccuracy: Math.round(avgAcc * 100) / 100,
      avgMissingRate: Math.round(avgMissing * 100) / 100,
      totalSymbols,
      totalExchanges,
      overallCoverage,
    },
    topIssues,
    trends,
  };
}

export default MarketDataKPI;
