// ══ R254 LOBEHUB QU-03: A/B 测试框架 ══
// Push推送标题/时间/富媒体分流 + CTR统计 + 显著性检验
// "用户最爱什么内容？A/B测试告诉你，别猜。"
//
// 测试维度:
//   1. 推送标题 (textA vs textB)
//   2. 推送时间 (timeA vs timeB)
//   3. 富媒体 (plain vs chart)
//   4. 语气 (简洁 vs 故事化)
//   5. 个性化 (通用 vs 含持仓名)

export type ABTestVariant = 'A' | 'B';

export interface ABTestConfig {
  testId: string;
  testName: string;
  dimension: 'title' | 'timing' | 'media' | 'tone' | 'personalization';
  variantA: {
    id: 'A';
    description: string;
    content: string;          // 推送内容或配置
    weight: number;           // 分流权重 0-1
  };
  variantB: {
    id: 'B';
    description: string;
    content: string;
    weight: number;           // 分流权重 0-1
  };
  targetMetric: 'ctr' | 'conversion' | 'revenue' | 'retention';
  minSampleSize: number;      // 最小样本量
  confidenceLevel: number;    // 显著性水平 (0.90 / 0.95 / 0.99)
  startedAt: number;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
}

export interface ABTestEvent {
  testId: string;
  variant: ABTestVariant;
  userId: string;
  eventType: 'IMPRESSION' | 'CLICK' | 'CONVERSION' | 'REVENUE';
  value?: number;             // 转化金额（只有REVENUE类型有值）
  timestamp: number;
  metadata?: Record<string, string>; // push标题/时间等上下文
}

export interface ABTestResult {
  testId: string;
  testName: string;
  status: 'INSUFFICIENT_DATA' | 'INCONCLUSIVE' | 'A_WINS' | 'B_WINS';
  variantA: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;             // 点击率
    cvr: number;             // 转化率
    arpu: number;            // 每用户收入
    confidenceInterval: [number, number]; // 95% CI
  };
  variantB: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cvr: number;
    arpu: number;
    confidenceInterval: [number, number];
  };
  winner?: ABTestVariant;
  lift: number;               // 提升百分比
  pValue: number;             // 统计学显著性
  recommendation: string;
}

// ═══════════════════ 测试创建 ═══════════════════

export function createABTest(
  testId: string,
  testName: string,
  dimension: ABTestConfig['dimension'],
  variantADesc: string, variantAContent: string,
  variantBDesc: string, variantBContent: string,
  weightA: number = 0.5, weightB: number = 0.5,
): ABTestConfig {
  return {
    testId, testName, dimension,
    variantA: { id: 'A', description: variantADesc, content: variantAContent, weight: weightA },
    variantB: { id: 'B', description: variantBDesc, content: variantBContent, weight: weightB },
    targetMetric: 'ctr',
    minSampleSize: 500,
    confidenceLevel: 0.95,
    startedAt: Date.now(),
    status: 'DRAFT',
  };
}

// ═══════════════════ 分流引擎 ═══════════════════

export function assignVariant(userId: string, config: ABTestConfig): ABTestVariant {
  const hash = simpleHash(userId + config.testId);
  const normalized = (hash % 10000) / 10000;
  return normalized < config.variantA.weight ? 'A' : 'B';
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// ═══════════════════ CTR/转化计算 ═══════════════════

export function calculateABTestResult(
  config: ABTestConfig,
  events: ABTestEvent[],
): ABTestResult {
  const testEvents = events.filter(e => e.testId === config.testId);

  const aEvents = testEvents.filter(e => e.variant === 'A');
  const bEvents = testEvents.filter(e => e.variant === 'B');

  const aImps = aEvents.filter(e => e.eventType === 'IMPRESSION').length;
  const bImps = bEvents.filter(e => e.eventType === 'IMPRESSION').length;
  const aClicks = aEvents.filter(e => e.eventType === 'CLICK').length;
  const bClicks = bEvents.filter(e => e.eventType === 'CLICK').length;
  const aConvs = aEvents.filter(e => e.eventType === 'CONVERSION').length;
  const bConvs = bEvents.filter(e => e.eventType === 'CONVERSION').length;
  const aRev = aEvents.filter(e => e.eventType === 'REVENUE').reduce((s, e) => s + (e.value || 0), 0);
  const bRev = bEvents.filter(e => e.eventType === 'REVENUE').reduce((s, e) => s + (e.value || 0), 0);

  const aCtr = aImps > 0 ? aClicks / aImps : 0;
  const bCtr = bImps > 0 ? bClicks / bImps : 0;
  const aCvr = aImps > 0 ? aConvs / aImps : 0;
  const bCvr = bImps > 0 ? bConvs / bImps : 0;
  const aArpu = aImps > 0 ? aRev / aImps : 0;
  const bArpu = bImps > 0 ? bRev / bImps : 0;

  // 95% CI via Wilson score (simplified)
  const aCi = wilsonCI(aCtr, aImps);
  const bCi = wilsonCI(bCtr, bImps);

  // Status
  const totalSample = aImps + bImps;
  let status: ABTestResult['status'];
  let winner: ABTestVariant | undefined;
  let lift = 0;
  let pValue = 1;

  if (totalSample < config.minSampleSize) {
    status = 'INSUFFICIENT_DATA';
  } else {
    // Simplified z-test for proportions
    const pooled = (aClicks + bClicks) / (aImps + bImps);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / aImps + 1 / bImps));
    const z = se > 0 ? (bCtr - aCtr) / se : 0;

    // Approximate p-value from z-score
    pValue = 2 * (1 - normalCDF(Math.abs(z)));

    if (pValue < 0.05) {
      status = Math.abs(bCtr - aCtr) > 0.001
        ? (bCtr > aCtr ? 'B_WINS' : 'A_WINS')
        : 'INCONCLUSIVE';
      winner = status === 'A_WINS' ? 'A' : status === 'B_WINS' ? 'B' : undefined;
    } else {
      status = 'INCONCLUSIVE';
    }

    lift = aImps > 0 && aCtr > 0 ? (bCtr - aCtr) / aCtr : 0;
  }

  return {
    testId: config.testId,
    testName: config.testName,
    status,
    variantA: {
      impressions: aImps, clicks: aClicks, conversions: aConvs, revenue: aRev,
      ctr: aCtr, cvr: aCvr, arpu: aArpu, confidenceInterval: aCi,
    },
    variantB: {
      impressions: bImps, clicks: bClicks, conversions: bConvs, revenue: bRev,
      ctr: bCtr, cvr: bCvr, arpu: bArpu, confidenceInterval: bCi,
    },
    winner,
    lift,
    pValue,
    recommendation: status === 'A_WINS'
      ? `🎯 A方案优于B，CTR提升${(lift*100).toFixed(1)}%。建议全面切换A方案。`
      : status === 'B_WINS'
        ? `🎯 B方案优于A，CTR提升${(Math.abs(lift)*100).toFixed(1)}%。建议全面切换B方案。`
        : status === 'INSUFFICIENT_DATA'
          ? `⏳ 数据不足（当前${totalSample}样本，目标${config.minSampleSize}）。继续收集。`
          : `🤷 无法区分——A/B差异不显著(p=${pValue.toFixed(3)})。可能需要更大样本或不同的测试内容。`,
  };
}

// ═══════════════════ Wilson CI ═══════════════════

function wilsonCI(p: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96; // 95%
  const denominator = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator;
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ═══════════════════ 多臂老虎机(MAB)动态分流 ═══════════════════

export interface MABBucket {
  variant: ABTestVariant;
  impressions: number;
  clicks: number;
  ctr: number;
  thompsonSample: number;  // Thompson sampling score
}

export function thompsonSampling(buckets: MABBucket[]): ABTestVariant {
  // Draw from Beta distribution for each variant
  const scored = buckets.map(b => ({
    ...b,
    thompsonSample: betaSample(b.clicks + 1, b.impressions - b.clicks + 1),
  }));
  scored.sort((a, b) => b.thompsonSample - a.thompsonSample);
  return scored[0].variant;
}

function betaSample(alpha: number, beta: number): number {
  // Simplified Beta sampler using Gamma
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function gammaSample(shape: number): number {
  // Marsaglia-Tsang method for Gamma(shape, 1)
  if (shape < 1) {
    const u = Math.random();
    return gammaSample(shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = normalRandom();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x * x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ═══════════════════ 预置测试模板 ═══════════════════

export const AB_TEST_TEMPLATES = {
  title: {
    name: '推送标题对比',
    dimension: 'title' as const,
    variants: [
      { id: 'A' as const, desc: '简洁标题', content: 'BTC暴涨5%！' },
      { id: 'B' as const, desc: '故事型标题', content: 'BTC刚在一小时内涨了5%——为什么？' },
    ],
  },
  timing: {
    name: '推送时间对比',
    dimension: 'timing' as const,
    variants: [
      { id: 'A' as const, desc: '开盘前15分钟(9:15)', content: '09:15' },
      { id: 'B' as const, desc: '开盘后5分钟(9:35)', content: '09:35' },
    ],
  },
  media: {
    name: '富媒体对比',
    dimension: 'media' as const,
    variants: [
      { id: 'A' as const, desc: '纯文字', content: 'text-only' },
      { id: 'B' as const, desc: '文字+图表', content: 'text+chart' },
    ],
  },
  tone: {
    name: '语气对比',
    dimension: 'tone' as const,
    variants: [
      { id: 'A' as const, desc: '专业简洁', content: 'BTC 技术面突破，看涨信号激活。' },
      { id: 'B' as const, desc: '对话感', content: '嘿，BTC刚突破了——你可能想看一眼🚀' },
    ],
  },
  personalization: {
    name: '个性化对比',
    dimension: 'personalization' as const,
    variants: [
      { id: 'A' as const, desc: '通用推送', content: '市场异动：某板块波动>3%' },
      { id: 'B' as const, desc: '含持仓名', content: '你关注的{stockName}异动了！' },
    ],
  },
};

// ═══════════════════ 导出 ═══════════════════

export default ABTestResult;
