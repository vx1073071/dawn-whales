// ── R162 P0-H1b: Factor Summary Engine ────────────────────────────────────
// Generates human-readable factor analysis summaries.
// Input:  FactorValues (from FactorDataProvider) + optional FactorAttributionReport
// Output: HumanSummary — structured plain-zh text suitable for UI cards and AI prompts.
//
// Design principles (from Youdao UX audit):
//   - One-sentence summary at top (Chinese)
//   - Progressive detail: radar → drill-down → comparison
//   - No raw p-values/regression outputs in default view (hidden behind expand)
//   - Green/yellow/red color bands aligned with factor-i18n-map thresholds

import log from 'electron-log';
import type { FactorValues, FactorValue } from './factor-data-provider';
import { getFactorI18n, getFactorColor } from './factor-i18n-map';

// ── Types ───────────────────────────────────────────────────────────────────

export interface HumanSummary {
  /** Strategy or portfolio identifier */
  targetId: string;
  /** Period label (e.g., "2025-01-15 → 2025-03-15") */
  periodLabel: string;
  /** Overall composite score (0-100) */
  overallScore: number;
  /** One-sentence overall assessment */
  overallOneLine: string;
  /** 2-3 sentence analysis paragraph */
  analysis: string;
  /** Top 3 contributing factors (positive) */
  topPositives: FactorHighlight[];
  /** Top 3 drag factors (negative) */
  topNegatives: FactorHighlight[];
  /** Risk flags (if any) */
  riskFlags: RiskFlag[];
  /** Recommended action */
  recommendation: string;
  /** Generated timestamp */
  generatedAt: string;
}

export interface FactorHighlight {
  factorId: string;
  nameCN: string;
  score: number;
  color: 'green' | 'yellow' | 'red';
  oneLine: string;
  contribution: string;
  /** R163: Net drag percentage (negative = dragging composite down) */
  dragPct?: number;
}

export interface RiskFlag {
  type: 'warning' | 'danger' | 'info';
  factorId: string;
  message: string;
}

export interface SummaryRequest {
  targetId: string;
  factorValues: FactorValues;
  /** Optional: attribution report for P&L decomposition */
  attributionData?: {
    totalPnL?: number;
    rSquared?: number;
    dominantFactor?: string;
  };
  /** Language preference (default zh) */
  lang?: 'zh' | 'en';
}

// ── Factor Summary Engine ─────────────────────────────────────────────────

export class FactorSummaryEngine {
  constructor() {
    log.info('[FactorSummaryEngine] Initialized');
  }

  /**
   * Generate a human-readable summary from factor values.
   */
  generateSummary(request: SummaryRequest): HumanSummary {
    const { targetId, factorValues, attributionData, lang = 'zh' } = request;
    const factors = Object.values(factorValues.factors);
    const langFn = lang === 'zh' ? zh : en;

    // Sort factors by score descending
    const sorted = [...factors].sort((a, b) => b.score - a.score);

    // Compute overall score (weighted by confidence)
    const overallScore = this.computeOverallScore(factors);

    // Identify top positives and negatives
    const topPositives = sorted.filter(f => f.score >= 60).slice(0, 3);
    const topNegatives = sorted.filter(f => f.score <= 40).slice(-3).reverse();

    // Detect risk flags
    const riskFlags = this.detectRiskFlags(sorted);

    // Build highlights
    const positiveHighlights = this.buildHighlights(topPositives);
    const negativeHighlights = this.buildHighlights(topNegatives);

    // Generate text sections
    const overallOneLine = langFn.overallAssessment(overallScore, factors.length);
    const analysis = langFn.detailAnalysis(overallScore, topPositives, topNegatives, attributionData);
    const recommendation = langFn.recommendation(overallScore, riskFlags);

    return {
      targetId,
      periodLabel: `${factorValues.symbol} (${factorValues.period})`,
      overallScore: Math.round(overallScore * 100) / 100,
      overallOneLine,
      analysis,
      topPositives: positiveHighlights,
      topNegatives: negativeHighlights,
      riskFlags,
      recommendation,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a compact one-line summary (for notification/chat contexts).
   */
  generateQuickSummary(request: SummaryRequest): string {
    const summary = this.generateSummary(request);
    const pos = summary.topPositives.slice(0, 2).map(p => p.nameCN).join('、') || '无突出因子';
    const neg = summary.topNegatives.slice(0, 2).map(p => p.nameCN).join('、') || '无拖累';
    const scoreStr = summary.overallScore.toFixed(0);
    return `${summary.targetId} 综合评分${scoreStr}分 | 优势: ${pos} | 注意: ${neg} | ${summary.recommendation}`;
  }

  /**
   * Generate comparison summary between two factor snapshots.
   */
  generateComparisonSummary(
    labelA: string, valuesA: FactorValues,
    labelB: string, valuesB: FactorValues,
  ): string {
    const scoreA = this.computeOverallScore(Object.values(valuesA.factors));
    const scoreB = this.computeOverallScore(Object.values(valuesB.factors));
    const delta = scoreB - scoreA;
    const direction = delta > 0 ? '提升' : '下降';
    const absDelta = Math.abs(delta);

    // Find factors that changed most
    const changedFactors: Array<{ id: string; nameCN: string; delta: number }> = [];
    for (const key of Object.keys(valuesA.factors)) {
      const a = valuesA.factors[key]?.score ?? 50;
      const b = valuesB.factors[key]?.score ?? 50;
      if (Math.abs(b - a) >= 5) {
        changedFactors.push({
          id: key,
          nameCN: getFactorI18n(key)?.nameCN ?? key,
          delta: b - a,
        });
      }
    }

    changedFactors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const changeParts = changedFactors.slice(0, 3).map(f => {
      const arrow = f.delta > 0 ? '↑' : '↓';
      return `${f.nameCN}${arrow}${Math.abs(f.delta).toFixed(0)}`;
    }).join('，');

    return `${labelA}→${labelB}: 综合评分${direction}${absDelta.toFixed(0)}分(${scoreA.toFixed(0)}→${scoreB.toFixed(0)})。主要变化: ${changeParts || '无明显变化'}`;
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private computeOverallScore(factors: FactorValue[]): number {
    if (factors.length === 0) return 50;
    // Weight by confidence: higher confidence → more weight
    let totalWeight = 0;
    let weightedSum = 0;
    for (const f of factors) {
      const w = Math.max(0.1, f.confidence);
      weightedSum += f.score * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 50;
  }

  private buildHighlights(factors: FactorValue[]): FactorHighlight[] {
    return factors.map(f => {
      const i18n = getFactorI18n(f.factorId);
      const color = getFactorColor(f.factorId, f.score);
      const NEUTRAL = 50;
      const dragPct = f.score - NEUTRAL; // positive = help, negative = drag
      let contribution: string;
      if (f.score >= 60) {
        contribution = `正向贡献 +${dragPct.toFixed(1)}%`;
      } else if (f.score <= 40) {
        contribution = `拖累 ${dragPct.toFixed(1)}%, 建议降低权重`;
      } else {
        contribution = '中性';
      }
      return {
        factorId: f.factorId,
        nameCN: i18n?.nameCN ?? f.factorId,
        score: f.score,
        color,
        oneLine: i18n?.oneLine ?? '',
        contribution,
        dragPct: Math.round(dragPct * 10) / 10,
      };
    });
  }

  private detectRiskFlags(factors: FactorValue[]): RiskFlag[] {
    const flags: RiskFlag[] = [];

    // Data source warnings
    let degradedCount = 0;
    for (const f of factors) {
      if (f.metadata?.degraded) {
        degradedCount++;
      }
    }
    if (degradedCount > 0) {
      flags.push({
        type: 'warning',
        factorId: 'SYSTEM',
        message: `${degradedCount}个数据源不可用，部分因子使用默认估值`,
      });
    }

    // Extreme concentration risk
    const highCount = factors.filter(f => f.score >= 80).length;
    const lowCount = factors.filter(f => f.score <= 20).length;
    if (highCount >= 5) {
      flags.push({
        type: 'info',
        factorId: 'MULTI',
        message: `多因子同时高分(${highCount}个≥80)，需警惕过拟合或风格集中风险`,
      });
    }
    if (lowCount >= 5) {
      flags.push({
        type: 'danger',
        factorId: 'MULTI',
        message: `多因子同时低分(${lowCount}个≤20)，综合质量严重不足`,
      });
    }

    // RSI extreme
    const rsi = factors.find(f => f.factorId === 'RSI_14');
    if (rsi && rsi.score >= 80) {
      flags.push({ type: 'warning', factorId: 'RSI_14', message: 'RSI处于超买区域，短期回调风险高' });
    }
    if (rsi && rsi.score <= 20) {
      flags.push({ type: 'info', factorId: 'RSI_14', message: 'RSI处于超卖区域，可能有反弹机会' });
    }

    // VIX extreme
    const vix = factors.find(f => f.factorId === 'US_VIX');
    if (vix && vix.score >= 80) {
      flags.push({ type: 'danger', factorId: 'US_VIX', message: 'VIX处于极高水平，市场恐慌，波动剧烈' });
    }

    // Crypto funding extreme
    const funding = factors.find(f => f.factorId === 'CRYPTO_FUNDING');
    if (funding && funding.score >= 80) {
      flags.push({ type: 'warning', factorId: 'CRYPTO_FUNDING', message: '资金费率极高，多头拥挤，警惕多杀多' });
    }

    // VOL_60D extreme
    const vol = factors.find(f => f.factorId === 'VOL_60D');
    if (vol && vol.score >= 80) {
      flags.push({ type: 'warning', factorId: 'VOL_60D', message: '60日波动率极高，价格极不稳定' });
    }

    return flags;
  }
}

// ── Language Functions ─────────────────────────────────────────────────────

const zh = {
  overallAssessment(score: number, factorCount: number): string {
    if (score >= 75) return `综合评分${score.toFixed(0)}分，因子质量优秀，多数指标处于健康区间`;
    if (score >= 60) return `综合评分${score.toFixed(0)}分，因子质量良好，整体偏积极但有少数拖累项`;
    if (score >= 45) return `综合评分${score.toFixed(0)}分，因子质量中性，多空力量均衡，方向不明确`;
    if (score >= 30) return `综合评分${score.toFixed(0)}分，因子质量偏弱，多项指标处于弱势区间`;
    return `综合评分${score.toFixed(0)}分，因子质量较差，多数指标警示风险`;
  },
  detailAnalysis(
    score: number,
    positives: FactorValue[], negatives: FactorValue[],
    attribution?: { totalPnL?: number; rSquared?: number; dominantFactor?: string },
  ): string {
    const parts: string[] = [];

    if (positives.length > 0) {
      const posNames = positives.map(f => getFactorI18n(f.factorId)?.nameCN ?? f.factorId).join('、');
      parts.push(`优势因子为${posNames}，这些因子处于健康区间，表明当前策略在这些维度上表现良好。`);
    }

    if (negatives.length > 0) {
      const negNames = negatives.map(f => {
        const name = getFactorI18n(f.factorId)?.nameCN ?? f.factorId;
        const drag = (f.score - 50).toFixed(1);
        return `${name}(${drag}%)`;
      }).join('、');
      parts.push(`拖累因子为${negNames}，这些因子低于中性线，建议在回测中降低权重或替换为更优因子。`);
    }

    if (attribution?.rSquared !== undefined) {
      const r2Pct = (attribution.rSquared * 100).toFixed(1);
      const r2Comment = attribution.rSquared >= 0.5
        ? `因子模型能够解释${r2Pct}%的收益波动，拟合度良好`
        : `因子模型仅能解释${r2Pct}%的收益波动，存在较大的特异性风险`;
      parts.push(r2Comment + '。');
    }

    if (attribution?.dominantFactor) {
      const domName = getFactorI18n(attribution.dominantFactor)?.nameCN ?? attribution.dominantFactor;
      parts.push(`主导因子为${domName}，策略收益受该因子影响最大。`);
    }

    return parts.join('');
  },
  recommendation(score: number, flags: RiskFlag[]): string {
    const dangers = flags.filter(f => f.type === 'danger');
    const warnings = flags.filter(f => f.type === 'warning');

    if (dangers.length > 0) {
      return `建议谨慎操作，重点关注: ${dangers.map(d => d.message).join('；')}`;
    }
    if (warnings.length > 0) {
      return `可适度配置，注意: ${warnings.map(w => w.message).join('；')}`;
    }
    if (score >= 60) {
      return '因子质量良好，可作为核心策略配置';
    }
    if (score >= 45) {
      return '建议观望或在回测优化后使用，当前因子信号不够明确';
    }
    return '建议回避或大幅降低权重，当前因子组合风险较高';
  },
};

const en = {
  overallAssessment(score: number, _factorCount: number): string {
    if (score >= 75) return `Overall score ${score.toFixed(0)}, excellent factor quality`;
    if (score >= 60) return `Overall score ${score.toFixed(0)}, good factor quality with minor drags`;
    if (score >= 45) return `Overall score ${score.toFixed(0)}, neutral, mixed signals`;
    if (score >= 30) return `Overall score ${score.toFixed(0)}, weak, multiple risk factors`;
    return `Overall score ${score.toFixed(0)}, poor, significant risks detected`;
  },
  detailAnalysis(score: number, positives: FactorValue[], negatives: FactorValue[]): string {
    const parts: string[] = [];
    if (positives.length > 0) {
      const names = positives.map(f => f.factorId).join(', ');
      parts.push(`Positive factors: ${names}.`);
    }
    if (negatives.length > 0) {
      const names = negatives.map(f => f.factorId).join(', ');
      parts.push(`Negative factors: ${names}.`);
    }
    return parts.join(' ');
  },
  recommendation(score: number, flags: RiskFlag[]): string {
    if (flags.filter(f => f.type === 'danger').length > 0) return 'Exercise caution';
    if (score >= 60) return 'Favorable for core allocation';
    return 'Consider reducing weight or avoiding';
  },
};

// ── Factory ─────────────────────────────────────────────────────────────────

export function createFactorSummaryEngine(): FactorSummaryEngine {
  return new FactorSummaryEngine();
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: FactorSummaryEngine | null = null;

export function getFactorSummaryEngine(): FactorSummaryEngine {
  if (!instance) instance = new FactorSummaryEngine();
  return instance;
}

export function resetFactorSummaryEngine(): void {
  instance = null;
}

export default {
  FactorSummaryEngine,
  createFactorSummaryEngine,
  getFactorSummaryEngine,
  resetFactorSummaryEngine,
};
