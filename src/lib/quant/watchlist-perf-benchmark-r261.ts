// ══ R261 LOBEHUB P3: Watchlist刷新性能基准 ══
// Watchlist Refresh Performance Benchmark — "100只自选，刷新一次要多久？"
//
// 测量维度:
//   1. CPU使用率 (单核%+多核%)
//   2. 内存占用 (MB)
//   3. 刷新延迟 (单只+全量)
//   4. 缩放性能 (50→100→200→500)
//   5. 渲染帧率 (FPS during refresh)

export interface PerfSample {
  symbolCount: number;
  refreshTimeMs: number;
  cpuPercent: number;
  memoryMB: number;
  fps: number;
  jankFrames: number;          // 丢帧数
  timestamp: number;
}

export interface PerfBenchmarkResult {
  symbolCount: number;
  samples: number;             // 测试次数
  avgRefreshMs: number;
  p95RefreshMs: number;
  avgCpuPct: number;
  avgMemoryMB: number;
  avgFps: number;
  scalabilityScore: number;    // 1-10
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export interface WatchlistPerfReport {
  timestamp: number;
  overall: 'PASS' | 'WARNING' | 'FAIL';
  benchmarks: PerfBenchmarkResult[];
  scalability: {
    from50to100: number;       // 延迟增长倍数
    from100to200: number;
    from200to500: number;
    isLinear: boolean;
  };
  recommendations: string[];
}

// ═══════════════════ 单个基准 ═══════════════════

export function benchmarkSymbolCount(
  symbolCount: number,
  samples: PerfSample[],
): PerfBenchmarkResult {
  if (samples.length === 0) {
    return { symbolCount, samples: 0, avgRefreshMs: 0, p95RefreshMs: 0, avgCpuPct: 0, avgMemoryMB: 0, avgFps: 0, scalabilityScore: 0, status: 'FAIL' };
  }

  const avgRefresh = samples.reduce((s, x) => s + x.refreshTimeMs, 0) / samples.length;
  const sorted = [...samples].sort((a, b) => a.refreshTimeMs - b.refreshTimeMs);
  const p95 = sorted[Math.floor(samples.length * 0.95)]?.refreshTimeMs || sorted[sorted.length - 1].refreshTimeMs;
  const avgCpu = samples.reduce((s, x) => s + x.cpuPercent, 0) / samples.length;
  const avgMem = samples.reduce((s, x) => s + x.memoryMB, 0) / samples.length;
  const avgFps = samples.reduce((s, x) => s + x.fps, 0) / samples.length;

  // Scalability: refresh should be < 100ms for 50 symbols, < 200ms for 100, < 500ms for 200
  let scalabilityScore = 10;
  if (symbolCount <= 50 && avgRefresh > 100) scalabilityScore -= 3;
  if (symbolCount <= 100 && avgRefresh > 200) scalabilityScore -= 2;
  if (symbolCount <= 200 && avgRefresh > 500) scalabilityScore -= 3;
  if (avgCpu > 50) scalabilityScore -= 2;
  if (avgFps < 30) scalabilityScore -= 2;
  scalabilityScore = Math.max(1, scalabilityScore);

  let status: PerfBenchmarkResult['status'] = 'PASS';
  if (avgRefresh > 1000) status = 'FAIL';
  else if (avgRefresh > 500 || avgCpu > 70 || avgFps < 20) status = 'WARNING';

  return {
    symbolCount, samples: samples.length,
    avgRefreshMs: Math.round(avgRefresh), p95RefreshMs: Math.round(p95),
    avgCpuPct: Math.round(avgCpu * 10) / 10,
    avgMemoryMB: Math.round(avgMem),
    avgFps: Math.round(avgFps),
    scalabilityScore,
    status,
  };
}

// ═══════════════════ 缩放性分析 ═══════════════════

export function analyzeScalability(benchmarks: PerfBenchmarkResult[]): {
  from50to100: number; from100to200: number; from200to500: number;
  isLinear: boolean;
} {
  const m = new Map(benchmarks.map(b => [b.symbolCount, b.avgRefreshMs]));
  const from50to100 = (m.get(100) || 1) / Math.max(1, m.get(50) || 1);
  const from100to200 = (m.get(200) || 1) / Math.max(1, m.get(100) || 1);
  const from200to500 = (m.get(500) || 1) / Math.max(1, m.get(200) || 1);

  // Linear scaling = 增长≈数量比
  const isLinear = from50to100 < 3 && from100to200 < 3 && from200to500 < 3;

  return { from50to100, from100to200, from200to500, isLinear };
}

// ═══════════════════ 全量报告 ═══════════════════

export function generateWatchlistPerfReport(
  allSamples: PerfSample[],
): WatchlistPerfReport {
  const counts = [...new Set(allSamples.map(s => s.symbolCount))].sort((a, b) => a - b);
  const benchmarks = counts.map(c => benchmarkSymbolCount(c, allSamples.filter(s => s.symbolCount === c)));
  const scalability = analyzeScalability(benchmarks);

  const recs: string[] = [];
  const slowest = benchmarks[benchmarks.length - 1];
  for (const b of benchmarks) {
    if (b.status === 'FAIL') recs.push(`❌ ${b.symbolCount}只—平均${b.avgRefreshMs}ms超过1000ms阈值`);
    else if (b.status === 'WARNING') recs.push(`⚠️ ${b.symbolCount}只—${b.avgRefreshMs}ms高于500ms`);
  }
  if (!scalability.isLinear) recs.push('⚠️ 刷新时间非线性增长—可能有性能瓶颈');
  if (slowest?.avgCpuPct > 50) recs.push(`⚠️ CPU使用${slowest.avgCpuPct}%—考虑Web Worker`);
  if (slowest?.avgFps < 30) recs.push(`⚠️ 帧率${slowest.avgFps}FPS—渲染优化需要`);

  const failCount = benchmarks.filter(b => b.status === 'FAIL').length;
  const warnCount = benchmarks.filter(b => b.status === 'WARNING').length;
  const overall = failCount > 0 ? 'FAIL' : warnCount > 1 ? 'WARNING' : 'PASS';

  return {
    timestamp: Date.now(),
    overall,
    benchmarks,
    scalability,
    recommendations: recs,
  };
}

export default WatchlistPerfReport;
