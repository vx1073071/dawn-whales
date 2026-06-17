// ══ R263 LOBEHUB P1: 真实数据质量基准v2 ══
// Live Data Quality Benchmark v2 — YahooLive + BinanceLive 复合基准
//
// v2升级 vs R261:
//   1. 双源实时(YahooLive WS + BinanceLive WS)
//   2. 端到端延迟(交易所→WebSocket→管道→IPC→前端)
//   3. 双源交叉验证(同标的Yahoo vs Binance价差)
//   4. 管线健康(背压+降级+断线恢复)
//   5. 3天连续运行统计

import {
  evaluateLatency,
  LatencyBenchmark, AccuracyBenchmark, CompletenessBenchmark,
} from './data-quality-benchmark-r261';

export interface DualSourceComparison {
  symbol: string;           // e.g. BTC-USD (crypto) or AAPL (US)
  yahooPrice: number;
  yahooLatency: number;
  binancePrice: number;
  binanceLatency: number;
  spreadPct: number;        // (Y - B) / B * 100
  crossValid: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'UNAVAILABLE';
  timestamp: number;
}

export interface PipelineHealthMetrics {
  totalMessages: number;
  droppedMessages: number;
  dropRate: number;          // %
  backpressureEvents: number;
  degradationEvents: number;
  recoveryEvents: number;
  avgEndToEndMs: number;     // exchange→UI
  p95EndToEndMs: number;
  status: 'HEALTHY' | 'STRESSED' | 'DEGRADED' | 'FAILED';
}

export interface ContinuousRunStats {
  durationHours: number;
  totalTicks: number;
  uniqueSymbols: number;
  avgTicksPerSecond: number;
  peakTicksPerSecond: number;
  memoryLeakMB: number;      // 启动时-结束时内存差值
  restarts: number;
  status: 'STABLE' | 'MINOR_ISSUES' | 'UNSTABLE' | 'CRASHED';
}

export interface DataQualityV2Report {
  timestamp: number;
  overall: 'PASS' | 'WARNING' | 'FAIL';
  yahoo: {
    latency: LatencyBenchmark[];
    accuracy: AccuracyBenchmark[];
    completeness: CompletenessBenchmark[];
  };
  binance: {
    latency: LatencyBenchmark[];
    accuracy: AccuracyBenchmark[];
    completeness: CompletenessBenchmark[];
  };
  dualSourceComparison: DualSourceComparison[];
  pipelineHealth: PipelineHealthMetrics;
  continuousRun: ContinuousRunStats;
  score: number;               // 0-100
  recommendations: string[];
  greenFlags: string[];
  redFlags: string[];
}

// ═══════════════════ 双源交叉验证 ═══════════════════

export function compareYahooVsBinance(
  symbol: string, yahooPrice: number, yahooLatency: number,
  binancePrice: number, binanceLatency: number,
): DualSourceComparison {
  const spreadPct = binancePrice > 0 ? (yahooPrice - binancePrice) / binancePrice * 100 : 0;
  const absSpread = Math.abs(spreadPct);

  let crossValid: DualSourceComparison['crossValid'];
  if (yahooPrice === 0 || binancePrice === 0) crossValid = 'UNAVAILABLE';
  else if (absSpread < 0.1) crossValid = 'MATCH';
  else if (absSpread < 1) crossValid = 'MINOR_DIFF';
  else crossValid = 'MAJOR_DIFF';

  return {
    symbol, yahooPrice, yahooLatency, binancePrice, binanceLatency,
    spreadPct: Math.round(spreadPct * 1000) / 1000,
    crossValid,
    timestamp: Date.now(),
  };
}

// ═══════════════════ 管线健康 ═══════════════════

export function evaluatePipelineHealth(
  totalMessages: number, droppedMessages: number,
  backpressureEvents: number, degradationEvents: number,
  recoveryEvents: number, endToEndSamples: number[],
): PipelineHealthMetrics {
  const dropRate = totalMessages > 0 ? droppedMessages / totalMessages * 100 : 0;
  const sorted = [...endToEndSamples].sort((a, b) => a - b);
  const avgE2E = endToEndSamples.length > 0 ? endToEndSamples.reduce((a, b) => a + b, 0) / endToEndSamples.length : 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

  let status: PipelineHealthMetrics['status'];
  if (dropRate < 0.01 && backpressureEvents < 5 && degradationEvents === 0) status = 'HEALTHY';
  else if (dropRate < 0.1 && degradationEvents < 10) status = 'STRESSED';
  else if (dropRate < 1) status = 'DEGRADED';
  else status = 'FAILED';

  return {
    totalMessages, droppedMessages,
    dropRate: Math.round(dropRate * 100) / 100,
    backpressureEvents, degradationEvents, recoveryEvents,
    avgEndToEndMs: Math.round(avgE2E),
    p95EndToEndMs: Math.round(p95),
    status,
  };
}

// ═══════════════════ 连续运行统计 ═══════════════════

export function evaluateContinuousRun(
  durationHours: number, totalTicks: number,
  uniqueSymbols: number, startMemoryMB: number, endMemoryMB: number,
  restarts: number,
): ContinuousRunStats {
  const avgTps = durationHours > 0 ? totalTicks / (durationHours * 3600) : 0;
  const peakTps = avgTps * 3;  // 峰值≈3x均值(经验)
  const memoryLeak = endMemoryMB - startMemoryMB;

  let status: ContinuousRunStats['status'];
  if (restarts === 0 && memoryLeak < 50) status = 'STABLE';
  else if (restarts <= 1 && memoryLeak < 100) status = 'MINOR_ISSUES';
  else if (restarts <= 3) status = 'UNSTABLE';
  else status = 'CRASHED';

  return {
    durationHours, totalTicks, uniqueSymbols,
    avgTicksPerSecond: Math.round(avgTps * 100) / 100,
    peakTicksPerSecond: Math.round(peakTps * 100) / 100,
    memoryLeakMB: Math.round(memoryLeak),
    restarts,
    status,
  };
}

// ═══════════════════ V2全量报告 ═══════════════════

export function generateDataQualityV2Report(
  yahooLatency: Map<string, number[]>,
  yahooAccuracy: AccuracyBenchmark[],
  yahooCompleteness: CompletenessBenchmark[],
  binanceLatency: Map<string, number[]>,
  binanceAccuracy: AccuracyBenchmark[],
  binanceCompleteness: CompletenessBenchmark[],
  dualComparisons: DualSourceComparison[],
  pipelineHealth: PipelineHealthMetrics,
  continuousRun: ContinuousRunStats,
): DataQualityV2Report {
  const yLat = Array.from(yahooLatency.entries()).map(([k, v]) => {
    const [e, s] = k.split(':'); return evaluateLatency(e, s, v);
  });
  const bLat = Array.from(binanceLatency.entries()).map(([k, v]) => {
    const [e, s] = k.split(':'); return evaluateLatency(e, s, v);
  });

  const greenFlags: string[] = [];
  const redFlags: string[] = [];
  const recs: string[] = [];

  // Score calculation
  let score = 100;

  // Latency
  const yP95 = yLat.reduce((a, b) => a + b.p95Ms, 0) / Math.max(1, yLat.length);
  if (yP95 > 500) { score -= 20; redFlags.push(`❌ Yahoo P95延迟${Math.round(yP95)}ms`); }
  else if (yP95 > 200) { score -= 10; recs.push(`⚠️ Yahoo P95延迟${Math.round(yP95)}ms`); }
  else greenFlags.push(`✅ Yahoo P95延迟${Math.round(yP95)}ms`);

  const bP95 = bLat.reduce((a, b) => a + b.p95Ms, 0) / Math.max(1, bLat.length);
  if (bP95 > 300) { score -= 15; redFlags.push(`❌ Binance P95延迟${Math.round(bP95)}ms`); }
  else greenFlags.push(`✅ Binance P95延迟${Math.round(bP95)}ms`);

  // Cross-validation
  const matchRate = dualComparisons.length > 0
    ? dualComparisons.filter(c => c.crossValid === 'MATCH' || c.crossValid === 'MINOR_DIFF').length / dualComparisons.length
    : 0;
  if (matchRate < 0.8) { score -= 20; redFlags.push(`❌ 双源交叉验证匹配率${(matchRate*100).toFixed(0)}%`); }
  else if (matchRate < 0.95) { score -= 10; recs.push(`⚠️ 双源匹配率${(matchRate*100).toFixed(0)}%`); }
  else greenFlags.push(`✅ 双源匹配率${(matchRate*100).toFixed(0)}%`);

  // Pipeline
  if (pipelineHealth.dropRate > 1) { score -= 25; redFlags.push(`❌ 管线丢弃率${pipelineHealth.dropRate.toFixed(1)}%`); }
  else if (pipelineHealth.dropRate > 0.1) { score -= 10; recs.push(`⚠️ 管线丢弃率${pipelineHealth.dropRate.toFixed(1)}%`); }
  if (pipelineHealth.backpressureEvents > 10) { score -= 10; recs.push(`⚠️ 背压事件${pipelineHealth.backpressureEvents}次`); }

  // Continuous run
  if (continuousRun.status === 'CRASHED') { score -= 30; redFlags.push('❌ 连续运行崩溃'); }
  else if (continuousRun.status === 'UNSTABLE') { score -= 15; recs.push('⚠️ 连续运行不稳定'); }
  if (continuousRun.memoryLeakMB > 100) { score -= 10; redFlags.push(`❌ 内存泄漏${continuousRun.memoryLeakMB}MB`); }
  else if (continuousRun.memoryLeakMB > 30) recs.push(`⚠️ 内存增长${continuousRun.memoryLeakMB}MB`);

  score = Math.max(0, Math.min(100, score));
  const overall = score >= 85 ? 'PASS' : score >= 60 ? 'WARNING' : 'FAIL';

  return {
    timestamp: Date.now(), overall,
    yahoo: { latency: yLat, accuracy: yahooAccuracy, completeness: yahooCompleteness },
    binance: { latency: bLat, accuracy: binanceAccuracy, completeness: binanceCompleteness },
    dualSourceComparison: dualComparisons,
    pipelineHealth,
    continuousRun,
    score,
    recommendations: recs,
    greenFlags,
    redFlags,
  };
}

export default DataQualityV2Report;
