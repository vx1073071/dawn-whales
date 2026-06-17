// ══ R258 LOBEHUB P1-02: AI快评置信度校准引擎 ══
// AI Quick Review Confidence Calibrator — 评分不是乱给，要有置信度
//
// 方法:
//   1. 多源信息一致性 → 信号质量
//   2. 数据新鲜度 → 时间衰减
//   3. 模型不确定性 → 历史准确率反馈
//   4. 市场状态 → 环境复杂度
//   5. 置信度分数 → 用户展示(高/中/低) + 是否推送

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface CalibrationInput {
  symbol: string;
  market: string;
  reviewType: 'FAST' | 'BRIEFING' | 'ATTRIBUTION';
  factorSignals: Array<{
    factorId: string;
    factorName: string;
    IC: number;          // 信息系数
    signal: string;      // BULLISH / BEARISH / NEUTRAL
    strength: number;    // 0-1
  }>;
  dataFreshness: {
    priceAgeSeconds: number;       // 价格数据延迟
    fundamentalAgeDays: number;    // 基本面数据天数
    newsAgeMinutes: number;        // 新闻新鲜度
  };
  marketComplexity: {
    vix: number;
    regime: string;
    volatilityPercentile: number; // 0-100
  };
  historicalAccuracy?: number;    // 该类型AI的历史准确率 (0-1)
}

export interface CalibrationResult {
  symbol: string;
  reviewType: string;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;          // 0-100
  breakdown: {
    signalConsistency: number;      // 0-30: 因子信号一致度
    dataFreshness: number;          // 0-25: 数据新鲜度
    marketStability: number;        // 0-20: 市场稳定性
    historicalPerformance: number;  // 0-15: 历史准确率
    signalStrength: number;         // 0-10: 信号强度
  };
  isReliable: boolean;              // 总分>60才算可靠
  displayLabel: string;             // "高置信度" / "仅供参考"
  recommendation: string;
}

// ═══════════════════ 校准引擎 ═══════════════════

export function calibrateConfidence(input: CalibrationInput): CalibrationResult {
  // 1. 信号一致性 (0-30)
  const signals = input.factorSignals;
  let signalConsistency = 0;
  if (signals.length >= 3) {
    const bullish = signals.filter(s => s.signal === 'BULLISH').length;
    const bearish = signals.filter(s => s.signal === 'BEARISH').length;
    const agreement = Math.max(bullish, bearish) / signals.length;
    signalConsistency = Math.round(agreement * 30);
  } else if (signals.length > 0) {
    signalConsistency = 15; // 因子太少，给中等分
  }

  // 2. 数据新鲜度 (0-25)
  const priceScore = Math.max(0, 15 - input.dataFreshness.priceAgeSeconds / 60);  // <1分钟=15分
  const fundamentalScore = input.dataFreshness.fundamentalAgeDays < 30 ? 5 : input.dataFreshness.fundamentalAgeDays < 90 ? 3 : 0;
  const newsScore = input.dataFreshness.newsAgeMinutes < 60 ? 5 : input.dataFreshness.newsAgeMinutes < 240 ? 3 : 0;
  const dataFreshness = Math.round(Math.min(25, priceScore + fundamentalScore + newsScore));

  // 3. 市场稳定性 (0-20)
  let marketStability = 0;
  if (input.marketComplexity.volatilityPercentile < 30) marketStability = 20;
  else if (input.marketComplexity.volatilityPercentile < 50) marketStability = 16;
  else if (input.marketComplexity.volatilityPercentile < 70) marketStability = 12;
  else if (input.marketComplexity.volatilityPercentile < 85) marketStability = 7;
  else marketStability = 3;

  // VIX额外惩罚
  if (input.marketComplexity.vix > 35) marketStability = Math.max(0, marketStability - 5);
  if (input.marketComplexity.vix > 50) marketStability = Math.max(0, marketStability - 5);

  // 4. 历史准确率 (0-15)
  const acc = input.historicalAccuracy || 0.5;
  const historicalPerformance = Math.round(acc * 15);

  // 5. 信号强度 (0-10)
  const avgStrength = signals.length > 0
    ? signals.reduce((s, f) => s + f.strength, 0) / signals.length
    : 0.3;
  const signalStrength = Math.round(avgStrength * 10);

  // 总分
  const total = signalConsistency + dataFreshness + marketStability + historicalPerformance + signalStrength;

  // 置信度分级
  let confidenceLevel: ConfidenceLevel;
  if (total >= 75) confidenceLevel = 'HIGH';
  else if (total >= 50) confidenceLevel = 'MEDIUM';
  else if (total >= 30) confidenceLevel = 'LOW';
  else confidenceLevel = 'INSUFFICIENT';

  const isReliable = total >= 60;

  const displayLabels: Record<ConfidenceLevel, string> = {
    HIGH: '🟢 高置信度',
    MEDIUM: '🟡 中等置信',
    LOW: '🟠 低置信——仅供参考',
    INSUFFICIENT: '🔴 数据不足',
  };

  const recommendations: Record<ConfidenceLevel, string> = {
    HIGH: '分析质量优秀，可直接推送或展示',
    MEDIUM: '可展示但建议标注"AI分析仅供参考"',
    LOW: '建议等待更多数据或降低展示权重',
    INSUFFICIENT: '不宜推送。需要：更实时的价格数据/更多因子/更低波动环境',
  };

  return {
    symbol: input.symbol,
    reviewType: input.reviewType,
    confidenceLevel,
    confidenceScore: total,
    breakdown: { signalConsistency, dataFreshness, marketStability, historicalPerformance, signalStrength },
    isReliable,
    displayLabel: displayLabels[confidenceLevel],
    recommendation: recommendations[confidenceLevel],
  };
}

// ═══════════════════ 批量校准+排序 ═══════════════════

export interface CalibrationReport {
  timestamp: number;
  total: number;
  reliableCount: number;
  unreliableCount: number;
  byLevel: Record<ConfidenceLevel, number>;
  topSignals: CalibrationResult[];
  worstSignals: CalibrationResult[];
  summary: string;
}

export function batchCalibrate(inputs: CalibrationInput[]): CalibrationReport {
  const results = inputs.map(calibrateConfidence);
  results.sort((a, b) => b.confidenceScore - a.confidenceScore);

  const byLevel: CalibrationReport['byLevel'] = { HIGH: 0, MEDIUM: 0, LOW: 0, INSUFFICIENT: 0 };
  for (const r of results) byLevel[r.confidenceLevel]++;

  return {
    timestamp: Date.now(),
    total: results.length,
    reliableCount: results.filter(r => r.isReliable).length,
    unreliableCount: results.filter(r => !r.isReliable).length,
    byLevel,
    topSignals: results.slice(0, 5),
    worstSignals: results.slice(-5).reverse(),
    summary: `共${results.length}条AI分析：${byLevel.HIGH}高/${byLevel.MEDIUM}中/${byLevel.LOW}低/${byLevel.INSUFFICIENT}不足。可靠率${(results.filter(r=>r.isReliable).length/results.length*100).toFixed(1)}%`,
  };
}

export default CalibrationResult;
