// ══ R261 LOBEHUB P1: 真实数据质量基准引擎 ══
// Live Market Data Quality Benchmark — "Yahoo WS真实数据的质量到底如何？"
//
// 测量维度:
//   1. 延迟分布 (交易所→Yahoo WS→我们的管线) — P50/P95/P99
//   2. 准确率 (vs 其他数据源交叉验证)
//   3. 缺失率 (tick完整性)
//   4. 断线恢复 (重连时间+数据补齐)
//   5. 交易所覆盖 (22交易所×15种子符号)

export interface LatencyBenchmark {
  exchange: string;                // 'NASDAQ' | 'NYSE' | 'HKEX' | 'TSE' ...
  symbol: string;
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  minMs: number;
  avgMs: number;
  status: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'SLOW' | 'UNUSABLE';
}

export interface AccuracyBenchmark {
  exchange: string;
  symbol: string;
  yahooPrice: number;
  referencePrice: number;           // 来自其他源的参考价
  sourceName: string;               // 'Binance' | 'EastMoney' | 'IB' | 'Google'
  deviationPct: number;
  status: 'MATCH' | 'TOLERABLE' | 'DEVIATED' | 'CONFLICT';
}

export interface CompletenessBenchmark {
  exchange: string;
  totalExpectedTicks: number;
  actualTicks: number;
  missingRate: number;
  gapDuration: number;           // 最长空白期(秒)
  status: 'FULL' | 'MINOR_GAPS' | 'MAJOR_GAPS' | 'DISCONNECTED';
}

export interface RecoveryBenchmark {
  exchange: string;
  disconnectTime: number;        // 断线时长(ms)
  reconnectTime: number;         // 重连时长(ms)
  dataBackfill: boolean;         // 是否补齐了断线期间数据
  backfillLatency: number;       // 补数据延迟(ms)
  status: 'FAST' | 'NORMAL' | 'SLOW' | 'FAILED';
}

export interface DataQualityReport {
  timestamp: number;
  overall: 'PASS' | 'WARNING' | 'FAIL';
  latency: {
    results: LatencyBenchmark[];
    avgP50: number;
    avgP95: number;
    slowestExchange: string;
    fastestExchange: string;
  };
  accuracy: {
    results: AccuracyBenchmark[];
    matchRate: number;
    maxDeviation: number;
  };
  completeness: {
    results: CompletenessBenchmark[];
    overallMissingRate: number;
  };
  recovery: {
    results: RecoveryBenchmark[];
    avgReconnectMs: number;
  };
  recommendations: string[];
  greenFlags: string[];
  redFlags: string[];
}

// ═══════════════════ 延迟基准 ═══════════════════

export function evaluateLatency(
  exchange: string, symbol: string,
  samples: number[],  // 延迟采样(ms)
): LatencyBenchmark {
  if (samples.length === 0) return { exchange, symbol, sampleCount: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, minMs: 0, avgMs: 0, status: 'UNUSABLE' };

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const p50 = sorted[Math.floor(n * 0.50)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const p99 = sorted[Math.floor(n * 0.99)];
  const avg = samples.reduce((a, b) => a + b, 0) / n;

  let status: LatencyBenchmark['status'];
  if (p95 < 100) status = 'EXCELLENT';
  else if (p95 < 200) status = 'GOOD';
  else if (p95 < 500) status = 'ACCEPTABLE';
  else if (p95 < 1000) status = 'SLOW';
  else status = 'UNUSABLE';

  return {
    exchange, symbol, sampleCount: n,
    p50Ms: p50, p95Ms: p95, p99Ms: p99,
    maxMs: sorted[n - 1], minMs: sorted[0], avgMs: Math.round(avg),
    status,
  };
}

// ═══════════════════ 准确率基准 ═══════════════════

export function evaluateAccuracy(
  exchange: string, symbol: string,
  yahooPrice: number,
  referencePrice: number,
  sourceName: string,
): AccuracyBenchmark {
  const deviationPct = referencePrice > 0
    ? Math.abs(yahooPrice - referencePrice) / referencePrice * 100
    : 0;

  let status: AccuracyBenchmark['status'];
  if (deviationPct < 0.01) status = 'MATCH';
  else if (deviationPct < 0.1) status = 'TOLERABLE';
  else if (deviationPct < 1) status = 'DEVIATED';
  else status = 'CONFLICT';

  return {
    exchange, symbol, yahooPrice, referencePrice, sourceName,
    deviationPct: Math.round(deviationPct * 1000) / 1000,
    status,
  };
}

// ═══════════════════ 完整性基准 ═══════════════════

export function evaluateCompleteness(
  exchange: string,
  totalExpectedTicks: number,
  actualTicks: number,
  gapDuration: number,
): CompletenessBenchmark {
  const missingRate = totalExpectedTicks > 0
    ? (totalExpectedTicks - actualTicks) / totalExpectedTicks
    : 0;

  let status: CompletenessBenchmark['status'];
  if (missingRate < 0.001) status = 'FULL';
  else if (missingRate < 0.01) status = 'MINOR_GAPS';
  else if (missingRate < 0.05) status = 'MAJOR_GAPS';
  else status = 'DISCONNECTED';

  return {
    exchange, totalExpectedTicks, actualTicks,
    missingRate: Math.round(missingRate * 10000) / 100,
    gapDuration,
    status,
  };
}

// ═══════════════════ 断线恢复 ═══════════════════

export function evaluateRecovery(
  exchange: string,
  disconnectTime: number,
  reconnectTime: number,
  dataBackfill: boolean,
  backfillLatency: number,
): RecoveryBenchmark {
  let status: RecoveryBenchmark['status'];
  if (reconnectTime < 1000) status = 'FAST';
  else if (reconnectTime < 5000) status = 'NORMAL';
  else if (reconnectTime < 30000) status = 'SLOW';
  else status = 'FAILED';

  return {
    exchange, disconnectTime, reconnectTime,
    dataBackfill, backfillLatency, status,
  };
}

// ═══════════════════ 全量质量报告 ═══════════════════

export function generateDataQualityReport(
  latencySamples: Map<string, number[]>,
  accuracySamples: AccuracyBenchmark[],
  completenessResults: CompletenessBenchmark[],
  recoveryResults: RecoveryBenchmark[],
): DataQualityReport {
  // Latency
  const latencyResults = Array.from(latencySamples.entries()).map(([key, samples]) => {
    const [exchange, symbol] = key.split(':');
    return evaluateLatency(exchange, symbol, samples);
  });
  const avgP50 = latencyResults.reduce((s, r) => s + r.p50Ms, 0) / Math.max(1, latencyResults.length);
  const avgP95 = latencyResults.reduce((s, r) => s + r.p95Ms, 0) / Math.max(1, latencyResults.length);
  const sortedByLat = [...latencyResults].sort((a, b) => b.p95Ms - a.p95Ms);
  const slowest = sortedByLat[0]?.exchange || '';
  const fastest = sortedByLat[sortedByLat.length - 1]?.exchange || '';

  // Accuracy
  const matchRate = accuracySamples.length > 0
    ? accuracySamples.filter(a => a.status === 'MATCH' || a.status === 'TOLERABLE').length / accuracySamples.length
    : 0;
  const maxDev = accuracySamples.reduce((m, a) => Math.max(m, a.deviationPct), 0);

  // Completeness
  const overallMissingRate = completenessResults.length > 0
    ? completenessResults.reduce((s, r) => s + r.missingRate, 0) / completenessResults.length
    : 0;

  // Recovery
  const avgReconnect = recoveryResults.length > 0
    ? recoveryResults.reduce((s, r) => s + r.reconnectTime, 0) / recoveryResults.length
    : 0;

  const recs: string[] = [];
  const greenFlags: string[] = [];
  const redFlags: string[] = [];

  if (avgP95 < 200) greenFlags.push(`✅ P95延迟${Math.round(avgP95)}ms — 满足实时交易要求`);
  else if (avgP95 < 500) recs.push(`⚠️ P95延迟${Math.round(avgP95)}ms — 高频策略可能受影响`);
  else redFlags.push(`❌ P95延迟${Math.round(avgP95)}ms — 超过实时阈值`);

  if (overallMissingRate < 0.01) greenFlags.push(`✅ tick缺失率${(overallMissingRate*100).toFixed(2)}%`);
  else redFlags.push(`❌ tick缺失率${(overallMissingRate*100).toFixed(1)}% — 数据不完整`);

  if (matchRate > 0.95) greenFlags.push(`✅ 价格准确率${(matchRate*100).toFixed(0)}%`);
  else recs.push(`⚠️ 价格准确率${(matchRate*100).toFixed(0)}% — 建议增加交叉验证源`);

  if (avgReconnect < 2000) greenFlags.push(`✅ 断线重连${Math.round(avgReconnect)}ms`);
  else redFlags.push(`❌ 断线重连${Math.round(avgReconnect)}ms — 太长`);

  const failCount = redFlags.length;
  const warnCount = recs.length;
  const overall = failCount > 0 ? 'FAIL' : warnCount > 2 ? 'WARNING' : 'PASS';

  return {
    timestamp: Date.now(),
    overall,
    latency: { results: latencyResults, avgP50, avgP95, slowestExchange: slowest, fastestExchange: fastest },
    accuracy: { results: accuracySamples, matchRate, maxDeviation: maxDev },
    completeness: { results: completenessResults, overallMissingRate },
    recovery: { results: recoveryResults, avgReconnectMs: avgReconnect },
    recommendations: recs,
    greenFlags,
    redFlags,
  };
}

export default DataQualityReport;
