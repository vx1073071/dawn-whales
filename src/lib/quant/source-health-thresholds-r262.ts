// ══ R262 LOBEHUB P1: 源健康阈值校准 ══
// Source Health Threshold Calibrator — 4源延迟/可用率/数据质量告警阈值
//
// 4数据源: Yahoo WS / Binance WS / EastMoney / Investing RSS
// 每源: 延迟阈值 + 可用率阈值 + 数据质量阈值 + 自动切换规则

export type SourceId = 'yahoo' | 'binance' | 'eastmoney' | 'investing';

export interface SourceHealthThreshold {
  sourceId: SourceId;
  sourceName: string;
  latency: {
    healthy: number;      // ms, <此值=健康
    degraded: number;     // ms, <此值=降级
    down: number;         // ms, >此值=不可用
  };
  availability: {
    healthy: number;      // %, >此值=健康
    degraded: number;     // %, >此值=降级
    down: number;         // %, <此值=不可用
  };
  dataQuality: {
    missingRateHealthy: number;   // %, <此值=健康
    missingRateDegraded: number;  // %, <此值=降级
    accuracyHealthy: number;      // %, >此值=健康
  };
  checkIntervalMs: number;
  consecutiveFailures: number;   // 连续失败多少次→切换
  fallbackPriority: SourceId[];  // 故障时依次尝试的备源
  autoRecoverMinutes: number;    // 多久后自动尝试恢复
}

export interface SourceHealthState {
  sourceId: SourceId;
  currentLatencyP95: number;
  currentAvailability: number;
  currentMissingRate: number;
  currentAccuracy: number;
  consecutiveFailures: number;
  lastCheckAt: number;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'SWITCHED';
  activeSince: number;
  totalDowntime: number;
}

export interface SourceHealthDashboard {
  timestamp: number;
  sources: SourceHealthState[];
  activeSources: SourceId[];
  switchedSources: SourceId[];
  overallHealth: number;     // 0-100
  alerts: string[];
  recommendations: string[];
}

// ═══════════════════ 阈值配置 ═══════════════════

export const SOURCE_HEALTH_THRESHOLDS: SourceHealthThreshold[] = [
  {
    sourceId: 'yahoo', sourceName: 'Yahoo Finance WS',
    latency: { healthy: 100, degraded: 300, down: 1000 },
    availability: { healthy: 99.5, degraded: 98, down: 95 },
    dataQuality: { missingRateHealthy: 0.5, missingRateDegraded: 2, accuracyHealthy: 99.5 },
    checkIntervalMs: 30000, consecutiveFailures: 3,
    fallbackPriority: ['eastmoney', 'investing'],
    autoRecoverMinutes: 15,
  },
  {
    sourceId: 'binance', sourceName: 'Binance WS',
    latency: { healthy: 50, degraded: 200, down: 500 },
    availability: { healthy: 99.9, degraded: 99, down: 95 },
    dataQuality: { missingRateHealthy: 0.1, missingRateDegraded: 1, accuracyHealthy: 99.9 },
    checkIntervalMs: 15000, consecutiveFailures: 5,
    fallbackPriority: ['yahoo'],  // Binance独立→降到Yahoo
    autoRecoverMinutes: 10,
  },
  {
    sourceId: 'eastmoney', sourceName: '东方财富',
    latency: { healthy: 200, degraded: 500, down: 2000 },
    availability: { healthy: 98, degraded: 95, down: 85 },
    dataQuality: { missingRateHealthy: 1, missingRateDegraded: 5, accuracyHealthy: 98 },
    checkIntervalMs: 60000, consecutiveFailures: 2,
    fallbackPriority: ['yahoo', 'investing'],
    autoRecoverMinutes: 30,
  },
  {
    sourceId: 'investing', sourceName: 'Investing.com RSS',
    latency: { healthy: 500, degraded: 2000, down: 10000 },
    availability: { healthy: 95, degraded: 85, down: 70 },
    dataQuality: { missingRateHealthy: 5, missingRateDegraded: 15, accuracyHealthy: 95 },
    checkIntervalMs: 120000, consecutiveFailures: 1,
    fallbackPriority: ['yahoo', 'eastmoney'],
    autoRecoverMinutes: 60,
  },
];

// ═══════════════════ 健康评估 ═══════════════════

export function evaluateSourceHealth(
  state: SourceHealthState,
  threshold: SourceHealthThreshold,
): SourceHealthState {
  const now = Date.now();
  const result = { ...state, lastCheckAt: now };

  // Latency check
  if (state.currentLatencyP95 > threshold.latency.down) result.consecutiveFailures++;
  else if (state.currentLatencyP95 > threshold.latency.degraded) result.consecutiveFailures++;
  else result.consecutiveFailures = Math.max(0, result.consecutiveFailures - 1);

  // Availability check
  if (state.currentAvailability < threshold.availability.down) result.consecutiveFailures++;

  // Status determination
  const exceeded = result.consecutiveFailures >= threshold.consecutiveFailures;

  if (state.currentLatencyP95 <= threshold.latency.healthy
    && state.currentAvailability >= threshold.availability.healthy
    && state.currentMissingRate <= threshold.dataQuality.missingRateHealthy) {
    result.status = 'HEALTHY';
    result.consecutiveFailures = 0;
  } else if (exceeded || state.currentLatencyP95 > threshold.latency.down
    || state.currentAvailability < threshold.availability.down) {
    result.status = 'DOWN';
  } else if (state.currentLatencyP95 > threshold.latency.degraded
    || state.currentAvailability < threshold.availability.degraded) {
    result.status = 'DEGRADED';
  } else {
    result.status = 'HEALTHY';
  }

  if (result.status === 'DOWN') result.totalDowntime += threshold.checkIntervalMs;

  return result;
}

// ═══════════════════ 仪表盘 ═══════════════════

export function generateSourceHealthDashboard(
  states: SourceHealthState[],
): SourceHealthDashboard {
  const evaluated = states.map(s => {
    const th = SOURCE_HEALTH_THRESHOLDS.find(t => t.sourceId === s.sourceId)!;
    return evaluateSourceHealth(s, th);
  });

  const activeSources = evaluated.filter(s => s.status !== 'DOWN' && s.status !== 'SWITCHED').map(s => s.sourceId);
  const switchedSources = evaluated.filter(s => s.status === 'SWITCHED' || s.status === 'DOWN').map(s => s.sourceId);

  const healthyCount = evaluated.filter(s => s.status === 'HEALTHY').length;
  const overallHealth = Math.round((healthyCount / evaluated.length) * 100);

  const alerts: string[] = [];
  for (const s of evaluated) {
    if (s.status === 'DOWN') alerts.push(`❌ ${s.sourceId}不可用—P95=${s.currentLatencyP95}ms, 可用率=${s.currentAvailability}%`);
    else if (s.status === 'DEGRADED') alerts.push(`⚠️ ${s.sourceId}降级—P95=${s.currentLatencyP95}ms`);
  }

  const recs: string[] = [];
  for (const s of evaluated) {
    if (s.status === 'DOWN') {
      const th = SOURCE_HEALTH_THRESHOLDS.find(t => t.sourceId === s.sourceId)!;
      recs.push(`🔄 ${s.sourceId}→切换到${th.fallbackPriority[0]} (${th.autoRecoverMinutes}分钟后自动尝试恢复)`);
    }
  }
  if (overallHealth < 100) recs.push(`⚠️ 全局健康度${overallHealth}%—${switchedSources.length}个源离线`);
  else recs.push('✅ 4源全部健康');

  return {
    timestamp: Date.now(),
    sources: evaluated,
    activeSources,
    switchedSources,
    overallHealth,
    alerts,
    recommendations: recs,
  };
}

export default SourceHealthDashboard;
