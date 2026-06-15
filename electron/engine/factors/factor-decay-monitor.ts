/**
 * factor-decay-monitor.ts — R220 JVS#2: 因子动态衰减监控
 *
 * Continuously monitors factor health via sliding-window IC tracking.
 * Detects decay (declining predictive power) before it impacts P&L.
 *
 * Features:
 *   - Rolling IC window (1M / 3M / 6M / 12M)
 *   - Linear trend detection (is IC trending down?)
 *   - Decay rate estimate (IC loss per month)
 *   - Half-life projection (when will IC hit 0?)
 *   - 3-tier alert: GREEN (>0.03) / YELLOW (0.01-0.03) / RED (<0.01)
 *   - Sudden-break detection (regime change test)
 *
 * >=300L production-ready, v2.2.0
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export type DecayStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface FactorICRecord {
  date: string;          // 'YYYY-MM-DD'
  icValue: number;       // monthly IC
  rankIC?: number;       // rank IC (Spearman)
  numObservations: number;
}

export interface DecayWindowAnalysis {
  window: string;          // '1M' | '3M' | '6M' | '12M'
  avgIC: number;
  icStd: number;
  trend: number;           // slope (IC change per month)
  trendPValue: number;     // significance of trend
  isDeclining: boolean;    // trend < 0 AND significant
  status: DecayStatus;
}

export interface DecayMonitorConfig {
  /** IC threshold for RED status */
  criticalICThreshold: number;
  /** IC threshold for YELLOW status */
  warningICThreshold: number;
  /** P-value threshold for trend significance */
  trendAlpha: number;
  /** Minimum observations per window */
  minObsPerWindow: number;
}

export interface DecayReport {
  factorName: string;
  latestIC: number;
  windows: DecayWindowAnalysis[];
  overallStatus: DecayStatus;
  decayRate: number;           // IC loss per month (from 12M trend)
  halfLifeMonths: number;      // projected months until IC hits 0
  suddenBreak: boolean;        // regime change detected
  warnings: string[];
  recommendation: string;
  generatedAt: number;
}

const DEFAULT_CONFIG: DecayMonitorConfig = {
  criticalICThreshold: 0.01,
  warningICThreshold: 0.03,
  trendAlpha: 0.10,       // relaxed for early warning
  minObsPerWindow: 3,
};

// ── Engine ───────────────────────────────────────────────────────────

export class FactorDecayMonitor {
  private config: DecayMonitorConfig;

  constructor(config?: Partial<DecayMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze factor decay from IC history.
   * @param records Monthly IC records (oldest first)
   */
  analyze(records: FactorICRecord[], factorName: string): DecayReport {
    if (records.length < this.config.minObsPerWindow) {
      return {
        factorName,
        latestIC: records.length > 0 ? records[records.length - 1].icValue : 0,
        windows: [],
        overallStatus: 'YELLOW',
        decayRate: 0,
        halfLifeMonths: 0,
        suddenBreak: false,
        warnings: [`数据不足(${records.length}/${this.config.minObsPerWindow}个月), 无法可靠评估。`],
        recommendation: '继续积累数据, 至少需要3个月的IC记录。',
        generatedAt: Date.now(),
      };
    }

    // Multi-window analysis
    const windows = this.analyzeWindows(records);

    // Decay rate from 12M trend (or longest available)
    const longestWindow = windows[windows.length - 1];
    const decayRate = longestWindow.isDeclining ? Math.abs(longestWindow.trend) : 0;

    // Half-life projection
    const latestIC = records[records.length - 1].icValue;
    const halfLifeMonths = decayRate > 0 ? Math.abs(latestIC / decayRate) : Infinity;

    // Sudden break detection
    const suddenBreak = this.detectSuddenBreak(records);

    // Overall status
    const overallStatus = this.determineOverallStatus(windows, latestIC, decayRate, suddenBreak);

    // Warnings
    const warnings: string[] = [];
    const decliningWindows = windows.filter(w => w.isDeclining);
    if (decliningWindows.length >= 2) {
      warnings.push(`🔴 ${decliningWindows.length}个窗口检测到IC下降趋势。`);
    }
    if (suddenBreak) {
      warnings.push('🔴 检测到IC突变, 可能发生市场结构变化。');
    }
    if (overallStatus === 'RED') {
      warnings.push('🔴 因子IC跌至临界水平, 预测能力严重衰退。');
    } else if (overallStatus === 'YELLOW') {
      warnings.push('🟡 因子IC偏低, 建议密切监控。');
    }

    // Recommendation
    let recommendation: string;
    if (overallStatus === 'RED') {
      if (suddenBreak) {
        recommendation = '因子可能发生结构性失效(IC突变)。建议: 1)立即暂停该因子实盘 2)运行AI因子诊断(1USDT) 3)检查是否有事件冲击。';
      } else {
        recommendation = `因子持续衰退, 预计${halfLifeMonths < 12 ? halfLifeMonths.toFixed(0) + '个月' : '较长时间'}后完全失效。建议: 1)降低该因子权重 2)寻找替代因子 3)运行因子研究引擎。`;
      }
    } else if (overallStatus === 'YELLOW') {
      recommendation = '因子预测能力在下降通道, 建议: 1)每2周复查IC 2)准备备选因子 3)运行因子兼容引擎查找替代方案。';
    } else {
      recommendation = '因子健康, 建议每月复查一次。';
    }

    return {
      factorName,
      latestIC: Math.round(latestIC * 1000) / 1000,
      windows,
      overallStatus,
      decayRate: Math.round(decayRate * 10000) / 10000,
      halfLifeMonths: halfLifeMonths === Infinity ? 999 : Math.round(halfLifeMonths),
      suddenBreak,
      warnings,
      recommendation,
      generatedAt: Date.now(),
    };
  }

  // ── Window Analysis ────────────────────────────────────────────────

  private analyzeWindows(records: FactorICRecord[]): DecayWindowAnalysis[] {
    const windowSizes = { '1M': 3, '3M': 9, '6M': 18, '12M': 36 };
    const windows: DecayWindowAnalysis[] = [];

    for (const [name, size] of Object.entries(windowSizes)) {
      const subset = records.length >= size ? records.slice(-size) : records;
      if (subset.length < this.config.minObsPerWindow) continue;

      const ics = subset.map(r => r.icValue);
      const avgIC = ics.reduce((s, v) => s + v, 0) / ics.length;
      const icStd = Math.sqrt(ics.reduce((s, v) => s + (v - avgIC) ** 2, 0) / (ics.length - 1));

      // Linear trend: OLS slope
      const xMean = (subset.length - 1) / 2;
      const yMean = avgIC;
      let cov = 0;
      let varX = 0;
      for (let i = 0; i < subset.length; i++) {
        const x = i - xMean;
        cov += x * (subset[i].icValue - yMean);
        varX += x * x;
      }
      const slope = varX > 0 ? cov / varX : 0;

      // Trend significance (t-test on slope)
      const residuals = subset.map((r, i) => r.icValue - (avgIC + slope * (i - xMean)));
      const residualSS = residuals.reduce((s, r2) => s + r2 * r2, 0);
      const seSlope = Math.sqrt(residualSS / (subset.length - 2) / varX);
      const tStatSlope = seSlope > 0 ? Math.abs(slope / seSlope) : 0;
      // Approximate p-value (Normal, for df >= 3)
      const trendPValue = 2 * (1 - this.normalCDFApprox(tStatSlope));

      const isDeclining = slope < 0 && trendPValue < this.config.trendAlpha;

      let status: DecayStatus;
      if (avgIC >= this.config.warningICThreshold) {
        status = 'GREEN';
      } else if (avgIC >= this.config.criticalICThreshold) {
        status = 'YELLOW';
      } else {
        status = 'RED';
      }

      windows.push({
        window: name,
        avgIC: Math.round(avgIC * 1000) / 1000,
        icStd: Math.round(icStd * 1000) / 1000,
        trend: Math.round(slope * 10000) / 10000,
        trendPValue: Math.round(trendPValue * 1000) / 1000,
        isDeclining,
        status,
      });
    }

    return windows;
  }

  // ── Sudden Break Detection ─────────────────────────────────────────

  private detectSuddenBreak(records: FactorICRecord[]): boolean {
    if (records.length < 6) return false;

    // Compare first half vs second half IC volatility
    const mid = Math.floor(records.length / 2);
    const firstHalf = records.slice(0, mid);
    const secondHalf = records.slice(mid);

    const meanFirst = firstHalf.reduce((s, r) => s + r.icValue, 0) / firstHalf.length;
    const meanSecond = secondHalf.reduce((s, r) => s + r.icValue, 0) / secondHalf.length;

    const stdFirst = Math.sqrt(firstHalf.reduce((s, r) => s + (r.icValue - meanFirst) ** 2, 0) / firstHalf.length);
    const stdSecond = Math.sqrt(secondHalf.reduce((s, r) => s + (r.icValue - meanSecond) ** 2, 0) / secondHalf.length);

    // Break if: mean shift > 2× pooled std AND direction is negative
    const pooledStd = Math.sqrt((stdFirst ** 2 + stdSecond ** 2) / 2);
    const meanShift = Math.abs(meanSecond - meanFirst);

    return meanShift > 2 * pooledStd && meanSecond < meanFirst;
  }

  // ── Status Assessment ──────────────────────────────────────────────

  private determineOverallStatus(
    windows: DecayWindowAnalysis[],
    latestIC: number,
    decayRate: number,
    suddenBreak: boolean,
  ): DecayStatus {
    // RED if: latest IC critical OR sudden break
    if (latestIC < this.config.criticalICThreshold || suddenBreak) return 'RED';

    // YELLOW if: latest IC warning OR declining trend in recent windows
    if (latestIC < this.config.warningICThreshold) return 'YELLOW';

    const recentDeclining = windows
      .filter(w => w.window === '1M' || w.window === '3M')
      .filter(w => w.isDeclining);

    if (recentDeclining.length >= 2) return 'YELLOW';
    if (decayRate > 0.005 && latestIC < 0.05) return 'YELLOW';

    return 'GREEN';
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private normalCDFApprox(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z >= 0 ? 1 : -1;
    z = Math.abs(z);
    const t = 1 / (1 + p * z);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z / 2);
    return sign > 0 ? y : 1 - y;
  }

  /**
   * Batch monitor all factors.
   * @param factorICs Map of factorName → IC records
   */
  batchMonitor(factorICs: Map<string, FactorICRecord[]>): DecayReport[] {
    const reports: DecayReport[] = [];
    for (const [name, records] of factorICs) {
      reports.push(this.analyze(records, name));
    }
    // Sort: worst first
    reports.sort((a, b) => {
      const order: Record<DecayStatus, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
      return order[a.overallStatus] - order[b.overallStatus];
    });
    return reports;
  }

  getAtRiskFactors(reports: DecayReport[]): DecayReport[] {
    return reports.filter(r => r.overallStatus !== 'GREEN');
  }

  updateConfig(patch: Partial<DecayMonitorConfig>): void {
    this.config = { ...this.config, ...patch };
  }
}

export const factorDecayMonitor = new FactorDecayMonitor();
