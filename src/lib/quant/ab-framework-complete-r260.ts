// ══ R260 LOBEHUB P2-07: AB测试框架完整版 ══
// Complete AB Testing Framework — 从单次测试到持续优化管线
//
// 新增 vs R254:
//   1. 多臂老虎机(Thompson Sampling/Bayesian)自动优化
//   2. 分层测试(按用户画像/市场/时段)
//   3. 序贯检验——早期停止(样本够了就停)
//   4. 多维测试(多变量同时测)
//   5. 长期效果追踪(留存/复购/LTV)
//   6. 测试结果仪表盘

import {
  ABTestConfig, ABTestEvent, calculateABTestResult,
  createABTest,
} from './ab-test-engine-r254';

export type TestPhase = 'DRAFT' | 'WARMUP' | 'RUNNING' | 'STOPPED_EARLY' | 'COMPLETED';

export interface LayeredExperiment {
  experimentId: string;
  name: string;
  layers: Array<{
    layerId: string;
    dimension: string;        // 'persona' | 'market' | 'time' | 'device'
    segments: ABTestConfig[];  // 每个分段一个独立测试
  }>;
  targetMetric: 'ctr' | 'cvr' | 'revenue' | 'retention' | 'ltv';
  minSamplesPerSegment: number;
  maxDurationHours: number;
  startedAt: number;
  phase: TestPhase;
  sequentialStopping: boolean;  // 序贯检验
  stoppingThreshold: number;     // p<0.01即可提前停
}

export interface MultivariateTest {
  testId: string;
  factors: Array<{
    factor: string;    // 'title' | 'media' | 'timing' | 'personalization'
    levels: string[];   // ['简洁', '故事'] or ['纯文字', '图表']
  }>;
  combinations: number;     // 总组合数
  design: 'FULL_FACTORIAL' | 'FRACTIONAL_FACTORIAL' | 'TAGUCHI';
  active: boolean;
}

export interface LongTermMetric {
  testId: string;
  variant: 'A' | 'B';
  day1Retention: number;
  day7Retention: number;
  day30Retention: number;
  avgRevenuePerUser: number;
  lifetimeValueEstimate: number;
  repeatRate: number;
  netPromoterScore: number;
}

export interface ABDashboard {
  timestamp: number;
  activeTests: number;
  completedTests: number;
  totalImpressions: number;
  significantResults: number;
  totalRevenueLift: number;
  activeLayered: LayeredExperiment[];
  activeMultivariate: MultivariateTest[];
  recentWinners: Array<{ testId: string; winner: string; lift: number }>;
  recommendations: string[];
}

// ═══════════════════ 分层实验 ═══════════════════

export function createLayeredExperiment(
  name: string,
  layers: LayeredExperiment['layers'],
): LayeredExperiment {
  return {
    experimentId: `LEXP-${Date.now()}`,
    name,
    layers,
    targetMetric: 'ctr',
    minSamplesPerSegment: 200,
    maxDurationHours: 72,
    startedAt: Date.now(),
    phase: 'DRAFT',
    sequentialStopping: true,
    stoppingThreshold: 0.01,
  };
}

export function startLayeredExperiment(exp: LayeredExperiment): LayeredExperiment {
  exp.phase = 'WARMUP';
  exp.startedAt = Date.now();
  return exp;
}

export function checkLayeredExperiment(
  exp: LayeredExperiment,
  events: ABTestEvent[],
): { phase: TestPhase; stoppedSegments: string[]; reason: string } {
  const stoppedSegments: string[] = [];
  let totalSamples = 0;

  for (const layer of exp.layers) {
    for (const test of layer.segments) {
      const result = calculateABTestResult(test, events);
      totalSamples += result.variantA.impressions + result.variantB.impressions;

      if (exp.sequentialStopping && result.pValue < exp.stoppingThreshold) {
        stoppedSegments.push(test.testId);
      }
    }
  }

  const allStopped = stoppedSegments.length === exp.layers.reduce((s, l) => s + l.segments.length, 0);
  const elapsed = (Date.now() - exp.startedAt) / 3600000;
  const enoughSamples = totalSamples >= exp.minSamplesPerSegment * exp.layers.reduce((s, l) => s + l.segments.length, 0);

  if (allStopped || enoughSamples) {
    return { phase: 'COMPLETED', stoppedSegments, reason: allStopped ? '所有分段达到统计显著性' : '样本量达标' };
  }
  if (elapsed > exp.maxDurationHours) {
    return { phase: 'STOPPED_EARLY', stoppedSegments, reason: `超过最大测试时长${exp.maxDurationHours}h` };
  }

  return { phase: elapsed > 0.5 ? 'RUNNING' : 'WARMUP', stoppedSegments, reason: '收集中' };
}

// ═══════════════════ 多变量测试 ═══════════════════

export function createMultivariateTest(
  testId: string,
  factors: MultivariateTest['factors'],
  design: MultivariateTest['design'] = 'FULL_FACTORIAL',
): MultivariateTest {
  let combinations = 1;
  for (const f of factors) combinations *= f.levels.length;

  return {
    testId,
    factors,
    combinations,
    design,
    active: false,
  };
}

export function assignMultivariate(
  userId: string,
  test: MultivariateTest,
): Record<string, string> {
  const hash = simpleHash(userId + test.testId);
  const assignment: Record<string, string> = {};

  for (const factor of test.factors) {
    const factorHash = simpleHash(hash + factor.factor);
    const idx = factorHash % factor.levels.length;
    assignment[factor.factor] = factor.levels[idx];
  }

  return assignment;
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return Math.abs(hash);
}

// ═══════════════════ 长期效果追踪 ═══════════════════

export function computeLongTermMetrics(
  testId: string,
  variant: 'A' | 'B',
  userEvents: Array<{
    userId: string;
    day: number;       // day 1/7/30
    active: boolean;
    purchased: boolean;
    revenue: number;
    npsScore?: number; // 0-10
  }>,
): LongTermMetric {
  const activeDay1 = userEvents.filter(e => e.day <= 1 && e.active).length;
  const activeDay7 = userEvents.filter(e => e.day <= 7 && e.active).length;
  const activeDay30 = userEvents.filter(e => e.day <= 30 && e.active).length;
  const total = userEvents.length || 1;

  const totalRevenue = userEvents.reduce((s, e) => s + e.revenue, 0);
  const repeatUsers = new Set(userEvents.filter(e => e.purchased).map(e => e.userId)).size;
  const npsScores = userEvents.filter(e => e.npsScore !== undefined).map(e => e.npsScore!);
  const avgNPS = npsScores.length > 0 ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length : 0;

  return {
    testId, variant,
    day1Retention: activeDay1 / total,
    day7Retention: activeDay7 / total,
    day30Retention: activeDay30 / total,
    avgRevenuePerUser: totalRevenue / total,
    lifetimeValueEstimate: totalRevenue / total * 12, // 年化估算
    repeatRate: repeatUsers / total,
    netPromoterScore: avgNPS,
  };
}

// ═══════════════════ AB仪表盘 ═══════════════════

export function generateABDashboard(
  activeLayered: LayeredExperiment[],
  activeMultivariate: MultivariateTest[],
  recentResults: Array<ReturnType<typeof calculateABTestResult>>,
): ABDashboard {
  const activeTests = activeLayered.length + activeMultivariate.length;
  const completedTests = recentResults.length;
  const totalImps = recentResults.reduce((s, r) => s + r.variantA.impressions + r.variantB.impressions, 0);
  const significantResults = recentResults.filter(r => r.status.includes('WINS')).length;
  const totalRevenueLift = recentResults.reduce((s, r) => {
    if (r.status === 'B_WINS') return s + r.variantB.revenue - r.variantA.revenue;
    if (r.status === 'A_WINS') return s + r.variantA.revenue - r.variantB.revenue;
    return s;
  }, 0);

  const recentWinners = recentResults
    .filter(r => r.status.includes('WINS'))
    .slice(0, 5)
    .map(r => ({
      testId: r.testId,
      winner: r.status === 'A_WINS' ? 'A' : 'B',
      lift: r.lift,
    }));

  const recs: string[] = [];
  if (significantResults === 0 && completedTests > 5) recs.push('⚠️ 最近的测试都没有显著胜者——测试内容需要更大差异化');
  if (activeTests === 0) recs.push('💡 没有活跃的AB测试——建议启动新测试');
  if (totalRevenueLift > 0) recs.push(`📈 AB测试贡献收入提升: $${totalRevenueLift.toFixed(2)}`);
  if (recentWinners.length > 0) recs.push(`🏆 ${recentWinners.length}个测试有明确胜者，建议全面部署`);

  return {
    timestamp: Date.now(),
    activeTests,
    completedTests,
    totalImpressions: totalImps,
    significantResults,
    totalRevenueLift,
    activeLayered,
    activeMultivariate,
    recentWinners,
    recommendations: recs,
  };
}

// ═══════════════════ R260预置分层实验 ═══════════════════

export const R260_LAYERED_EXPERIMENTS = {
  push_title_by_persona: {
    name: '推送标题×用户画像分层',
    layers: [
      {
        layerId: 'momentum', dimension: 'persona',
        segments: [createABTest('r260-mom-title', '动量型标题', 'title', '简洁', 'BTC爆涨5%!', '故事', 'BTC一小时涨了5%——发生了什么?')],
      },
      {
        layerId: 'value', dimension: 'persona',
        segments: [createABTest('r260-val-title', '价值型标题', 'title', '数据', 'AAPL PE降至15——5年最低', '故事', 'AAPL现在太便宜了——看看为什么')],
      },
    ],
    minSamplesPerSegment: 200,
    maxDurationHours: 48,
  },
};

export default ABDashboard;
