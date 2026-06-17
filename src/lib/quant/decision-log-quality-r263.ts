// ══ R263 LOBEHUB P3: 决策日志质量评估规则 ══
// Decision Log Quality Evaluator — "AI的推荐靠谱吗？日志说了什么？"
//
// 评估维度:
//   1. 推荐准确率 — 事后验证
//   2. 置信度校准 — 高置信=高准确？
//   3. 因子权重合理性 — 权重和IC一致？
//   4. 思考链完整性 — 是否有断链
//   5. 不确定性标注质量

export interface DecisionLogEntry {
  decisionId: string;
  symbol: string;
  market: string;
  decisionType: 'BUY_RECOMMENDATION' | 'SELL_RECOMMENDATION' | 'SECTOR_FAVOR' | 'STRATEGY_SELECT' | 'CRASH_ALERT';
  timestamp: number;
  factorsUsed: Array<{
    factorId: string;
    factorName: string;
    IC: number;
    weight: number;           // 在决策中的权重
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }>;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoningChain: string[];   // 推理步骤
  uncertaintyFlags: string[]; // 不确定性标注
  actualOutcome?: {
    direction: 'UP' | 'DOWN' | 'FLAT';
    magnitude: number;        // %
    verified: boolean;
  };
}

export interface DecisionLogQuality {
  decisionId: string;
  totalScore: number;          // 0-100
  accuracyScore: number;        // 推荐正确? (0-40)
  calibrationScore: number;     // 置信度匹配? (0-25)
  factorRationality: number;    // 权重合理? (0-20)
  chainCompleteness: number;    // 思考链完整? (0-10)
  uncertaintyQuality: number;   // 不确定性标注好? (0-5)
  flags: string[];
}

export interface DecisionLogQualityReport {
  timestamp: number;
  totalDecisions: number;
  overallAccuracy: number;       // 事后验证正确率
  calibrationCurve: Array<{
    confidenceLevel: string;
    count: number;
    accuracy: number;
    calibrated: boolean;
  }>;
  factorWeightCorrelation: number;  // 因子IC vs 权重相关度
  chainCompletenessRate: number;    // 有完整思考链的比例
  recommendations: string[];
}

// ═══════════════════ 单条评估 ═══════════════════

export function evaluateDecisionLog(entry: DecisionLogEntry): DecisionLogQuality {
  let accuracyScore = 0;
  let calibrationScore = 0;
  let factorRationality = 0;
  let chainCompleteness = 0;
  let uncertaintyQuality = 0;
  const flags: string[] = [];

  // 1. Accuracy (0-40) — 事后验证
  if (entry.actualOutcome?.verified) {
    const correct =
      (entry.decisionType === 'BUY_RECOMMENDATION' && entry.actualOutcome.direction === 'UP') ||
      (entry.decisionType === 'SELL_RECOMMENDATION' && entry.actualOutcome.direction === 'DOWN') ||
      (entry.decisionType === 'CRASH_ALERT' && entry.actualOutcome.direction === 'DOWN');
    accuracyScore = correct ? 40 : entry.actualOutcome.direction === 'FLAT' ? 20 : 0;
  }

  // 2. Calibration (0-25) — 高置信应该有高准确
  if (entry.confidenceLevel === 'HIGH') calibrationScore = 20;
  else if (entry.confidenceLevel === 'MEDIUM') calibrationScore = 15;
  else calibrationScore = 10;

  if (entry.actualOutcome?.verified && !(entry.confidenceLevel === 'HIGH' && entry.actualOutcome.direction === 'FLAT')) {
    calibrationScore = Math.min(25, calibrationScore + 5);
  }
  if (entry.confidenceLevel === 'HIGH' && entry.factorsUsed.length < 3) {
    flags.push('⚠️ 高置信但因子<3个');
    calibrationScore = Math.max(0, calibrationScore - 10);
  }

  // 3. Factor rationality (0-20) — IC高=权重高？
  if (entry.factorsUsed.length === 0) {
    flags.push('❌ 无因子');
  } else {
    // Check: 高IC因子应该有高权重
    const sortedByIC = [...entry.factorsUsed].sort((a, b) => Math.abs(b.IC) - Math.abs(a.IC));
    const topFactors = sortedByIC.slice(0, Math.min(3, sortedByIC.length));
    const topFactorsOk = topFactors.every(f => f.weight > 0.1);
    if (topFactorsOk) factorRationality = 20;
    else {
      factorRationality = 10;
      flags.push('⚠️ 高IC因子权重不足');
    }
  }

  // 4. Chain completeness (0-10)
  if (entry.reasoningChain.length >= 3) chainCompleteness = 10;
  else if (entry.reasoningChain.length >= 1) chainCompleteness = 5;
  else flags.push('❌ 思考链缺失');

  // 5. Uncertainty quality (0-5)
  if (entry.uncertaintyFlags.length > 0) uncertaintyQuality = 5;
  else if (entry.confidenceLevel === 'LOW') uncertaintyQuality = 3;
  else { flags.push('⚠️ 未标注不确定性'); uncertaintyQuality = 0; }

  const total = accuracyScore + calibrationScore + factorRationality + chainCompleteness + uncertaintyQuality;

  return {
    decisionId: entry.decisionId,
    totalScore: total,
    accuracyScore, calibrationScore, factorRationality, chainCompleteness, uncertaintyQuality,
    flags,
  };
}

// ═══════════════════ 批量评估 ═══════════════════

export function generateDecisionLogQualityReport(
  entries: DecisionLogEntry[],
): DecisionLogQualityReport {
  entries.map(evaluateDecisionLog);

  const verifiedEntries = entries.filter(e => e.actualOutcome?.verified);
  const correctEntries = verifiedEntries.filter(e =>
    (e.decisionType === 'BUY_RECOMMENDATION' && e.actualOutcome!.direction === 'UP') ||
    (e.decisionType === 'SELL_RECOMMENDATION' && e.actualOutcome!.direction === 'DOWN')
  );
  const overallAccuracy = verifiedEntries.length > 0 ? correctEntries.length / verifiedEntries.length : 0;

  // Calibration curve
  const calibrationCurve = ['HIGH', 'MEDIUM', 'LOW'].map(level => {
    const levelEntries = entries.filter(e => e.confidenceLevel === level);
    const levelVerified = levelEntries.filter(e => e.actualOutcome?.verified);
    const levelCorrect = levelEntries.filter(e =>
      (e.decisionType === 'BUY_RECOMMENDATION' && e.actualOutcome?.direction === 'UP') ||
      (e.decisionType === 'SELL_RECOMMENDATION' && e.actualOutcome?.direction === 'DOWN')
    );

    const accuracy = levelVerified.length > 0 ? levelCorrect.length / levelVerified.length : 0;
    const calibrated = (level === 'HIGH' && accuracy >= 0.8) ||
      (level === 'MEDIUM' && accuracy >= 0.6) ||
      (level === 'LOW' && accuracy >= 0.4);

    return {
      confidenceLevel: level,
      count: levelEntries.length,
      accuracy: Math.round(accuracy * 1000) / 10,
      calibrated,
    };
  });

  // Factor weight correlation (simplified)
  let factorWeightCorrelation = 0;
  let corrCount = 0;
  for (const e of entries) {
    for (const f of e.factorsUsed) {
      if (Math.abs(f.IC) > 0.02 && f.weight > 0.1) factorWeightCorrelation++;
      corrCount++;
    }
  }
  const fwCorr = corrCount > 0 ? factorWeightCorrelation / corrCount : 0;

  const chainCompletenessRate = entries.filter(e => e.reasoningChain.length >= 3).length / Math.max(1, entries.length);

  const recs: string[] = [];
  if (overallAccuracy < 0.5) recs.push('❌ AI推荐准确率<50%—需要重新训练或降低置信标注');
  if (calibrationCurve.filter(c => !c.calibrated).length > 0) recs.push('⚠️ 置信度校准偏离—高置信≠高准确');
  if (fwCorr < 0.6) recs.push('⚠️ 因子权重与IC低相关—权重可能不合理');
  if (chainCompletenessRate < 0.8) recs.push('⚠️ 思考链完整率<80%—部分推荐缺解释');

  return {
    timestamp: Date.now(),
    totalDecisions: entries.length,
    overallAccuracy,
    calibrationCurve,
    factorWeightCorrelation: Math.round(fwCorr * 1000) / 1000,
    chainCompletenessRate: Math.round(chainCompletenessRate * 1000) / 1000,
    recommendations: recs,
  };
}

export default DecisionLogQualityReport;
