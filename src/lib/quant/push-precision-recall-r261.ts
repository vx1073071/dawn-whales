// ══ R261 LOBEHUB P2: 推送准确率/召回率评估 ══
// Push Precision & Recall Evaluator — "推送准不准？漏没漏？"
//
// 评估维度:
//   1. 准确率(Precision) = 正确推送 / 所有推送
//   2. 召回率(Recall) = 正确推送 / 应该是推送的
//   3. 去重有效率 — 重复推送被过滤掉了多少
//   4. 假阳性分析 — 什么情况下推送了不该推的
//   5. 假阴性分析 — 什么情况下没推应该推的

export interface PushEvalSample {
  symbol: string;
  market: string;
  timestamp: number;
  pushType: string;             // 异动/崩盘/简报/策略信号
  thresholdTriggered: boolean;  // 阈值是否触发
  pushSent: boolean;            // 是否实际推送
  userClicked: boolean;         // 用户是否点击
  shouldHaveSent: boolean;      // 事后判断"应该推送吗"
}

export interface PrecisionRecallResult {
  pushType: string;
  totalSamples: number;
  truePositives: number;       // 应该推且推了
  falsePositives: number;      // 不应该推但推了
  falseNegatives: number;      // 应该推但没推
  trueNegatives: number;       // 不应该推且没推
  precision: number;           // TP/(TP+FP)
  recall: number;              // TP/(TP+FN)
  f1Score: number;             // 2*P*R/(P+R)
  dedupRate: number;           // 被去重过滤的推送比例
  analysis: string;
}

export interface PushQualityReport {
  timestamp: number;
  overall: PrecisionRecallResult;
  byType: PrecisionRecallResult[];
  topFalsePositives: PushEvalSample[];
  topFalseNegatives: PushEvalSample[];
  recommendations: string[];
}

// ═══════════════════ 评估引擎 ═══════════════════

export function evaluatePushPrecisionRecall(
  pushType: string,
  samples: PushEvalSample[],
  dedupRate: number = 0,
): PrecisionRecallResult {
  const tp = samples.filter(s => s.shouldHaveSent && s.pushSent).length;
  const fp = samples.filter(s => !s.shouldHaveSent && s.pushSent).length;
  const fn = samples.filter(s => s.shouldHaveSent && !s.pushSent).length;
  const tn = samples.filter(s => !s.shouldHaveSent && !s.pushSent).length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  let analysis = '';
  if (f1 >= 0.85) analysis = `✅ ${pushType}—F1=${(f1*100).toFixed(0)}%优秀。准确率${(precision*100).toFixed(0)}%/召回率${(recall*100).toFixed(0)}%`;
  else if (f1 >= 0.70) analysis = `⚠️ ${pushType}—F1=${(f1*100).toFixed(0)}%中等。`;
  else analysis = `❌ ${pushType}—F1=${(f1*100).toFixed(0)}%需优化。`;

  if (precision < 0.7) analysis += ' 准确率低→假阳性多→用户烦。';
  if (recall < 0.7) analysis += ' 召回率低→漏推多→错失机会。';
  if (fp > tp * 0.3) analysis += ' 假阳性>真阳性30%—阈值太宽。';

  return {
    pushType, totalSamples: samples.length,
    truePositives: tp, falsePositives: fp, falseNegatives: fn, trueNegatives: tn,
    precision, recall, f1Score: f1, dedupRate,
    analysis,
  };
}

// ═══════════════════ 假阳性/假阴性分析 ═══════════════════

export function analyzeFalsePositives(samples: PushEvalSample[]): PushEvalSample[] {
  return samples
    .filter(s => !s.shouldHaveSent && s.pushSent)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
}

export function analyzeFalseNegatives(samples: PushEvalSample[]): PushEvalSample[] {
  return samples
    .filter(s => s.shouldHaveSent && !s.pushSent)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
}

// ═══════════════════ 全量质量报告 ═══════════════════

export function generatePushQualityReport(
  allSamples: PushEvalSample[],
  dedupRates: Record<string, number> = {},
): PushQualityReport {
  // Group by type
  const types = [...new Set(allSamples.map(s => s.pushType))];
  const byType = types.map(t => {
    const typeSamples = allSamples.filter(s => s.pushType === t);
    return evaluatePushPrecisionRecall(t, typeSamples, dedupRates[t] || 0);
  });

  // Overall
  const overall = evaluatePushPrecisionRecall('ALL', allSamples,
    Object.values(dedupRates).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(dedupRates).length));

  const recs: string[] = [];
  for (const r of byType) {
    if (r.f1Score < 0.7) recs.push(`🔧 ${r.pushType}—F1只有${(r.f1Score*100).toFixed(0)}%`);
    if (r.precision < 0.6) recs.push(`⚠️ ${r.pushType}—准确率太低(${(r.precision*100).toFixed(0)}%)，提高阈值`);
    if (r.recall < 0.6) recs.push(`⚠️ ${r.pushType}—召回率太低(${(r.recall*100).toFixed(0)}%)，降低阈值`);
    if (r.dedupRate > 0.3) recs.push(`💡 ${r.pushType}—去重率${(r.dedupRate*100).toFixed(0)}%(可能太激进)`);
  }

  const topFP = analyzeFalsePositives(allSamples);
  const topFN = analyzeFalseNegatives(allSamples);

  return {
    timestamp: Date.now(),
    overall,
    byType,
    topFalsePositives: topFP,
    topFalseNegatives: topFN,
    recommendations: recs,
  };
}

export default PushQualityReport;
