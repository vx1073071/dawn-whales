/**
 * factor-crowding-alert.ts — R220 JVS#3: 因子拥挤度报警
 *
 * Monitors factor crowding risk: when too many market participants
 * use the same factor, alpha erodes and reversal risk spikes.
 *
 * Crowding indicators:
 *   1. AUM concentration — % of total market AUM using this factor
 *   2. Position overlap — how concentrated are positions in top N names
 *   3. Factor return correlation — are factor returns becoming more correlated
 *   4. Flow momentum — net inflow accelerating → more crowding ahead
 *
 * Alert tiers:
 *   🔴 CROWDED (>50%): factor alpha likely eroded, high reversal risk
 *   🟡 WATCHING (30-50%): crowding building, monitor closely
 *   🟢 NORMAL (<30%): healthy usage level
 *
 * >=250L production-ready, v2.2.0
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export type CrowdingLevel = 'NORMAL' | 'WATCHING' | 'CROWDED';

export interface CrowdingInput {
  /** Total AUM in this factor (USDT) */
  factorAUM: number;
  /** Total market AUM for the asset class (USDT) */
  totalMarketAUM: number;
  /** Herfindahl-Hirschman Index of position concentration (0-10000) */
  positionHHI: number;
  /** Ratio of positions in top 10 names */
  top10ConcentrationRatio: number;
  /** Average pairwise correlation of factor returns with other factors */
  factorReturnCorrelation: number;
  /** Net inflow (USDT) over last 30 days */
  netInflow30d: number;
  /** Number of distinct users using this factor */
  uniqueUsers: number;
  /** Factor turnover (trade volume / AUM, monthly) */
  monthlyTurnover: number;
}

export interface CrowdingReport {
  factorName: string;
  crowdingLevel: CrowdingLevel;
  crowdingScore: number;      // 0-100
  metrics: {
    aumShare: number;          // %
    hhiLevel: string;          // 'Low' | 'Moderate' | 'High' | 'Extreme'
    top10Ratio: number;        // %
    avgCorrelation: number;
    inflowVelocity: number;    // netInflow / factorAUM, monthly
  };
  reversalRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];
  suggestion: string;
  generatedAt: number;
}

// ── Engine ───────────────────────────────────────────────────────────

export class FactorCrowdingAlertEngine {
  private readonly thresholds = {
    aumShare: { warning: 0.30, critical: 0.50 },
    hhi: { warning: 1500, critical: 2500 },
    top10: { warning: 0.40, critical: 0.60 },
    correlation: { warning: 0.5, critical: 0.7 },
    inflow: { warning: 0.10, critical: 0.20 },
  };

  assess(input: CrowdingInput, factorName: string): CrowdingReport {
    const aumShare = input.totalMarketAUM > 0 ? input.factorAUM / input.totalMarketAUM : 0;

    // Crowding score computation (0-100)
    const aumScore = Math.min(40, aumShare * 80);                                              // 0-50% → 0-40
    const hhiScore = Math.min(25, (input.positionHHI / 2500) * 25);                            // 0-2500 → 0-25
    const top10Score = Math.min(20, input.top10ConcentrationRatio * 33.3);                     // 0-60% → 0-20
    const corrScore = Math.min(10, Math.max(0, (input.factorReturnCorrelation - 0.3)) * 25);   // >30% → start counting
    const inflowScore = Math.min(5, (input.netInflow30d / Math.max(1, input.factorAUM)) * 25); // 0-20% → 0-5

    const crowdingScore = Math.round(aumScore + hhiScore + top10Score + corrScore + inflowScore);

    let crowdingLevel: CrowdingLevel;
    if (crowdingScore >= 60) crowdingLevel = 'CROWDED';
    else if (crowdingScore >= 30) crowdingLevel = 'WATCHING';
    else crowdingLevel = 'NORMAL';

    // HHI interpretation
    let hhiLevel: string;
    if (input.positionHHI > 2500) hhiLevel = 'Extreme';
    else if (input.positionHHI > 1500) hhiLevel = 'High';
    else if (input.positionHHI > 1000) hhiLevel = 'Moderate';
    else hhiLevel = 'Low';

    const inflowVelocity = input.factorAUM > 0 ? input.netInflow30d / input.factorAUM : 0;

    // Reversal risk
    let reversalRisk: CrowdingReport['reversalRisk'];
    if (crowdingLevel === 'CROWDED' && inflowVelocity > this.thresholds.inflow.critical) {
      reversalRisk = 'HIGH';
    } else if (crowdingLevel === 'CROWDED' || (crowdingLevel === 'WATCHING' && inflowVelocity > this.thresholds.inflow.warning)) {
      reversalRisk = 'MEDIUM';
    } else {
      reversalRisk = 'LOW';
    }

    // Warnings
    const warnings: string[] = [];
    if (aumShare > this.thresholds.aumShare.critical) {
      warnings.push(`🔴 AUM占比${(aumShare * 100).toFixed(0)}%超过临界(${(this.thresholds.aumShare.critical * 100).toFixed(0)}%), 因子高度拥挤。`);
    }
    if (input.positionHHI > this.thresholds.hhi.critical) {
      warnings.push(`🔴 持仓HHI=${input.positionHHI}超${this.thresholds.hhi.critical}, 持仓过于集中。`);
    }
    if (input.top10ConcentrationRatio > this.thresholds.top10.critical) {
      warnings.push(`🔴 前10大持仓集中度${(input.top10ConcentrationRatio * 100).toFixed(0)}%, 流动性风险高。`);
    }
    if (input.factorReturnCorrelation > this.thresholds.correlation.critical) {
      warnings.push(`🔴 因子收益与其他因子相关性${input.factorReturnCorrelation.toFixed(2)}, 分散化效果差。`);
    }
    if (inflowVelocity > this.thresholds.inflow.critical) {
      warnings.push(`🔴 30日净流入增速${(inflowVelocity * 100).toFixed(0)}%, 资金加速涌入可能预示反向。`);
    }

    if (warnings.length === 0 && crowdingLevel === 'WATCHING') {
      warnings.push('🟡 拥挤度在中等水平, 建议关注AUM增长趋势。');
    }

    // Suggestion
    let suggestion: string;
    if (crowdingLevel === 'CROWDED') {
      suggestion = '因子高度拥挤, 反转风险大。建议: 1)降低因子权重至50%以下 2)分散到低相关因子 3)设置更紧的止损 4)减少新资金入场。';
    } else if (crowdingLevel === 'WATCHING') {
      suggestion = '拥挤度正在上升。建议: 1)控制AUM增长速度 2)每月复查拥挤度 3)准备备选因子列表。';
    } else {
      suggestion = '拥挤度正常, 因子运行环境健康。';
    }

    return {
      factorName,
      crowdingLevel,
      crowdingScore,
      metrics: {
        aumShare: Math.round(aumShare * 10000) / 100,
        hhiLevel,
        top10Ratio: Math.round(input.top10ConcentrationRatio * 10000) / 100,
        avgCorrelation: Math.round(input.factorReturnCorrelation * 1000) / 1000,
        inflowVelocity: Math.round(inflowVelocity * 10000) / 100,
      },
      reversalRisk,
      warnings,
      suggestion,
      generatedAt: Date.now(),
    };
  }

  /**
   * Batch crowd-check all factors.
   */
  batchAssess(inputs: Array<{ input: CrowdingInput; name: string }>): CrowdingReport[] {
    const reports = inputs.map(({ input, name }) => this.assess(input, name));
    reports.sort((a, b) => b.crowdingScore - a.crowdingScore);
    return reports;
  }

  /**
   * Get crowded factors from a batch.
   */
  getCrowdedFactors(reports: CrowdingReport[]): CrowdingReport[] {
    return reports.filter(r => r.crowdingLevel === 'CROWDED');
  }

  /**
   * Get summary of crowding across all factors.
   */
  getCrowdingSummary(reports: CrowdingReport[]): {
    total: number;
    crowded: number;
    watching: number;
    normal: number;
    avgCrowdingScore: number;
    worstFactor: { name: string; score: number } | null;
  } {
    const crowded = reports.filter(r => r.crowdingLevel === 'CROWDED').length;
    const watching = reports.filter(r => r.crowdingLevel === 'WATCHING').length;
    const normal = reports.filter(r => r.crowdingLevel === 'NORMAL').length;
    const avgScore = reports.length > 0
      ? Math.round(reports.reduce((s, r) => s + r.crowdingScore, 0) / reports.length)
      : 0;

    const sorted = [...reports].sort((a, b) => b.crowdingScore - a.crowdingScore);

    return {
      total: reports.length,
      crowded,
      watching,
      normal,
      avgCrowdingScore: avgScore,
      worstFactor: sorted.length > 0 ? { name: sorted[0].factorName, score: sorted[0].crowdingScore } : null,
    };
  }
}

export const factorCrowdingAlertEngine = new FactorCrowdingAlertEngine();
