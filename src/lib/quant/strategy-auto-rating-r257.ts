// ══ R257 LOBEHUB QU-07: 策略自动评级脚本 ══
// Strategy Auto-Rating Script — 112策略遍历A/B/C/D/F分类+衰减告警
// "让策略自己去评级——自动化，不靠人"

import type { StrategyRatingInput, StrategyRating } from './strategy-credit-rating-r253';
import { batchRateStrategies, RATING_DESCRIPTIONS } from './strategy-credit-rating-r253';

export interface StrategyRatingReport {
  timestamp: number;
  totalStrategies: number;
  rated: number;
  distribution: { A: number; B: number; C: number; D: number; F: number };
  newUpgrades: StrategyRating[];    // 本期升至A/B
  newDowngrades: StrategyRating[];  // 本期降至D/F
  decayAlerts: StrategyRating[];    // 连续2期衰减
  top3: StrategyRating[];
  worst3: StrategyRating[];
  summary: string;
}

export function autoRateAllStrategies(
  strategies: StrategyRatingInput[],
  previousRatings?: Map<string, StrategyRating>,
): StrategyRatingReport {
  const summary = batchRateStrategies(strategies);

  const newUpgrades: StrategyRating[] = [];
  const newDowngrades: StrategyRating[] = [];
  const decayAlerts: StrategyRating[] = [];

  if (previousRatings) {
    for (const current of summary.top3.concat(summary.worst3)) {
      const prev = previousRatings.get(current.strategyId);
      if (!prev) continue;

      const wasLow = ['D', 'F'].includes(prev.rating);
      const nowHigh = ['A', 'B'].includes(current.rating);
      if (wasLow && nowHigh) newUpgrades.push(current);

      const wasHigh = ['A', 'B'].includes(prev.rating);
      const nowLow = ['D', 'F'].includes(current.rating);
      if (wasHigh && nowLow) newDowngrades.push(current);

      if (current.totalScore < prev.totalScore - 10) decayAlerts.push(current);
    }
  }

  return {
    timestamp: Date.now(),
    totalStrategies: strategies.length,
    rated: summary.total,
    distribution: summary.distribution,
    newUpgrades,
    newDowngrades,
    decayAlerts,
    top3: summary.top3,
    worst3: summary.worst3,
    summary: summary.recommendations.join('\n'),
  };
}

export function formatRatingReport(report: StrategyRatingReport): string {
  const lines: string[] = [
    `# 🏆 策略信用评级报告`,
    `> ${new Date(report.timestamp).toISOString()}`,
    '',
    `## 📊 评级分布`,
    `| 评级 | 数量 | 占比 |`,
    `|------|------|------|`,
    `| ${RATING_DESCRIPTIONS.A.emoji} A | ${report.distribution.A} | ${(report.distribution.A/report.totalStrategies*100).toFixed(1)}% |`,
    `| ${RATING_DESCRIPTIONS.B.emoji} B | ${report.distribution.B} | ${(report.distribution.B/report.totalStrategies*100).toFixed(1)}% |`,
    `| ${RATING_DESCRIPTIONS.C.emoji} C | ${report.distribution.C} | ${(report.distribution.C/report.totalStrategies*100).toFixed(1)}% |`,
    `| ${RATING_DESCRIPTIONS.D.emoji} D | ${report.distribution.D} | ${(report.distribution.D/report.totalStrategies*100).toFixed(1)}% |`,
    `| ${RATING_DESCRIPTIONS.F.emoji} F | ${report.distribution.F} | ${(report.distribution.F/report.totalStrategies*100).toFixed(1)}% |`,
    '',
    `## 🌟 Top 3`,
    ...report.top3.map((s, i) => `- ${i+1}. **${s.strategyName}** — ${s.rating}(${s.totalScore}分) ${s.warnings.length > 0 ? '⚠️'+s.warnings[0] : ''}`),
    '',
    report.decayAlerts.length > 0 ? `## ⚠️ 衰减告警 (连续2期下降)` : '',
    ...report.decayAlerts.map(s => `- ${s.strategyName} ${s.totalScore}分: ${s.warnings.join('; ')}`),
    '',
  ].filter(l => l !== '');
  return lines.join('\n');
}

export default StrategyRatingReport;
