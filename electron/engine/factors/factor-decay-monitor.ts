// ── R169 P2-D4: Factor Decay Monitor — 因子衰减监控引擎 ────────────────
// Tracks factor efficacy decay via rolling IC windows, half-life estimation,
// and decay acceleration detection. Alerts when a factor crosses warning/critical
// thresholds with actionable reports.
//
// Builds on R159 IC Worker and R165 Layer Test concepts.
// No external AI dependency — pure statistical decay analysis.

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type DecayStatus = 'stable' | 'declining' | 'accelerating' | 'recovering';

export interface DecayConfig {
  /** Rolling window size for IC estimation (days) */
  rollingWindowDays: number;
  /** Minimum observations to start monitoring */
  minObservations: number;
  /** IC half-life warning threshold (below this = warning) */
  warningHalfLifeDays: number;
  /** IC half-life critical threshold (below this = critical) */
  criticalHalfLifeDays: number;
  /** Decay acceleration: abs(ΔIC/month) above this → accelerating */
  accelerationThreshold: number;
  /** Recovery detection: IC rise over N periods to be "recovering" */
  recoveryPeriods: number;
  /** Recovery threshold: IC must rise above this fraction of historical max */
  recoveryThreshold: number;
  /** Smoothing alpha for IC EMA */
  icEmaAlpha: number;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  rollingWindowDays: 252,
  minObservations: 20,
  warningHalfLifeDays: 90,
  criticalHalfLifeDays: 30,
  accelerationThreshold: 0.015,
  recoveryPeriods: 3,
  recoveryThreshold: 0.7,
  icEmaAlpha: 0.1,
};

/** Single observation point in the IC time series */
export interface ICObservation {
  date: string;         // YYYY-MM-DD
  ic: number;           // rank IC at this date
  decayHalfLife: number; // estimated half-life (days) at this point
  ema: number;          // EMA-smoothed IC
}

export interface HalfLifeEstimate {
  currentHalfLife: number;  // days
  trend: 'lengthening' | 'stable' | 'shortening';
  warningLevel: 'none' | 'warning' | 'critical';
  /** Half-life trend over last 4 observations */
  halfLifeSeries: number[];
  /** Half-life change rate (days per month) */
  halfLifeChangeRate: number;
}

export interface ICStability {
  /** IC mean over rolling window */
  rollingMean: number;
  /** IC std over rolling window */
  rollingStd: number;
  /** IC information ratio (mean/std) */
  icIR: number;
  /** IC trend slope (linear regression, IC/day) */
  icTrend: number;
  /** IC acceleration: second derivative of rolling means */
  icAcceleration: number;
  /** t-statistic of IC mean */
  icTStat: number;
}

export interface DecayAlert {
  factorName: string;
  factorNameCN: string;
  status: DecayStatus;
  severity: 'ok' | 'warning' | 'critical';
  icon: string;         // 🟢 🟡 🔴
  /** When decay was first detected */
  firstDetectedAt: string;
  /** Current IC mean */
  currentIC: number;
  /** Estimated remaining useful life (days until IC < 0.01) */
  remainingLifeDays: number | null;
  /** Whether decay is accelerating */
  isAccelerating: boolean;
  /** Decay rate (IC loss per month) */
  decayRatePerMonth: number;
  /** Recommendation */
  recommendation: string;
}

export interface DecayTrendReport {
  factorName: string;
  factorNameCN: string;
  generatedAt: string;
  period: { start: string; end: string };
  observations: number;
  currentStatus: DecayStatus;
  icStability: ICStability;
  halfLife: HalfLifeEstimate;
  alerts: DecayAlert[];
  /** Suggested action */
  suggestedAction: string;
  /** Should this factor be retained, watched, or replaced? */
  disposition: 'retain' | 'watch' | 'replace';
}

// ═══════════════════════════════════════════════════════════════════════════
// Factor Decay Monitor Engine
// ═══════════════════════════════════════════════════════════════════════════

export class FactorDecayMonitor {
  private config: DecayConfig;

  constructor(config?: Partial<DecayConfig>) {
    this.config = { ...DEFAULT_DECAY_CONFIG, ...config };
    log.info('[FactorDecayMonitor] Initialized');
  }

  /**
   * Feed IC observations and get a full decay trend report.
   *
   * @param factorName  Factor identifier
   * @param factorNameCN  Chinese name
   * @param observations  IC observations, sorted by date ascending
   */
  analyze(factorName: string, factorNameCN: string, observations: ICObservation[]): DecayTrendReport {
    if (observations.length < this.config.minObservations) {
      return this.emptyReport(factorName, factorNameCN, observations);
    }

    const icStability = this.computeICStability(observations);
    const halfLife = this.estimateHalfLife(observations);
    const status = this.determineStatus(icStability, halfLife);
    const alerts = this.generateAlerts(factorName, factorNameCN, icStability, halfLife, status);
    const disposition = this.determineDisposition(icStability, halfLife, alerts);

    const suggestedAction = this.buildAction(disposition, status, halfLife, icStability);

    return {
      factorName,
      factorNameCN,
      generatedAt: new Date().toISOString(),
      period: {
        start: observations[0].date,
        end: observations[observations.length - 1].date,
      },
      observations: observations.length,
      currentStatus: status,
      icStability,
      halfLife,
      alerts,
      suggestedAction,
      disposition,
    };
  }

  /**
   * Batch analyze multiple factors.
   */
  batchAnalyze(
    factors: Array<{ name: string; nameCN: string; observations: ICObservation[] }>,
  ): DecayTrendReport[] {
    return factors.map((f) => this.analyze(f.name, f.nameCN, f.observations));
  }

  /**
   * Quick decay check: returns simple OK/WARN/CRIT status.
   */
  quickCheck(observations: ICObservation[]): { status: string; icon: string; message: string } {
    if (observations.length < this.config.minObservations) {
      return { status: 'INSUFFICIENT', icon: '⚪', message: '数据不足' };
    }

    const icStab = this.computeICStability(observations);
    const hl = this.estimateHalfLife(observations);

    if (hl.warningLevel === 'critical' && icStab.icAcceleration < -0.01) {
      return { status: 'CRITICAL', icon: '🔴', message: `IC加速衰减(半衰期${hl.currentHalfLife.toFixed(0)}天)` };
    }
    if (hl.warningLevel === 'critical' || icStab.icTrend < -0.001) {
      return { status: 'WARN', icon: '🟡', message: `半衰期下降至${hl.currentHalfLife.toFixed(0)}天` };
    }
    return { status: 'OK', icon: '🟢', message: `IC稳定(均值${icStab.rollingMean.toFixed(3)})` };
  }

  /**
   * Estimate remaining useful life: projected days until IC mean crosses below 0.
   */
  estimateRemainingLife(observations: ICObservation[]): number | null {
    if (observations.length < 20) return null;

    const icStab = this.computeICStability(observations);
    if (icStab.icTrend >= 0) return null; // not declining

    const daysToZero = Math.abs(icStab.rollingMean / icStab.icTrend);
    return Math.round(daysToZero);
  }

  // ── IC Stability ───────────────────────────────────────────────────────

  private computeICStability(observations: ICObservation[]): ICStability {
    const n = observations.length;
    const windowSize = Math.min(n, this.config.rollingWindowDays);
    const window = observations.slice(-windowSize);
    const ics = window.map((o) => o.ic);
    const m = ics.length;

    const mean = ics.reduce((s, v) => s + v, 0) / m;
    const std = Math.sqrt(ics.reduce((s, v) => s + (v - mean) ** 2, 0) / m);
    const icIR = std > 0 ? mean / std : 0;
    const tStat = std > 0 ? mean / (std / Math.sqrt(m)) : 0;

    // Linear trend: IC = a + b*t (t in days)
    let sumT = 0, sumIC = 0, sumTIC = 0, sumT2 = 0;
    for (let i = 0; i < m; i++) {
      const t = i - m + 1; // center t around 0
      sumT += t;
      sumIC += ics[i];
      sumTIC += t * ics[i];
      sumT2 += t * t;
    }
    const denom = m * sumT2 - sumT * sumT;
    const trend = denom !== 0 ? (m * sumTIC - sumT * sumIC) / denom : 0;

    // Acceleration: second derivative via rolling means
    const rollingSize = Math.max(5, Math.floor(m / 10));
    const rollingMeans: number[] = [];
    for (let i = rollingSize - 1; i < m; i++) {
      const slice = ics.slice(i - rollingSize + 1, i + 1);
      rollingMeans.push(slice.reduce((s, v) => s + v, 0) / rollingSize);
    }
    let acceleration = 0;
    if (rollingMeans.length >= 3) {
      const recent = rollingMeans.slice(-3);
      acceleration = (recent[2] - 2 * recent[1] + recent[0]);
    }

    return {
      rollingMean: Math.round(mean * 10000) / 10000,
      rollingStd: Math.round(std * 10000) / 10000,
      icIR: Math.round(icIR * 100) / 100,
      icTrend: Math.round(trend * 100000) / 100000,
      icAcceleration: Math.round(acceleration * 100000) / 100000,
      icTStat: Math.round(tStat * 100) / 100,
    };
  }

  // ── Half-Life Estimation ───────────────────────────────────────────────

  private estimateHalfLife(observations: ICObservation[]): HalfLifeEstimate {
    const n = observations.length;

    // Current half-life: EMA at the most recent observation
    // If observations already include decayHalfLife, use the EMA-smoothed value
    const recentEmas = observations.slice(-Math.min(n, 20)).map((o) => o.ema);
    const currentHalfLife = recentEmas.length > 0
      ? recentEmas[recentEmas.length - 1]
      : (observations[n - 1]?.decayHalfLife ?? 0);

    // Half-life trend: compare last 4 half-life snapshots
    const step = Math.max(1, Math.floor(n / 4));
    const halfLifeSeries: number[] = [];
    for (let i = Math.max(0, n - 4 * step); i < n; i += step) {
      halfLifeSeries.push(observations[Math.min(i, n - 1)].decayHalfLife);
    }

    // Trend direction
    let trend: 'lengthening' | 'stable' | 'shortening';
    let changeRate = 0;
    if (halfLifeSeries.length >= 3) {
      const first = halfLifeSeries[0];
      const last = halfLifeSeries[halfLifeSeries.length - 1];
      changeRate = (last - first) / halfLifeSeries.length;
      if (changeRate > 0.5) trend = 'lengthening';
      else if (changeRate < -0.5) trend = 'shortening';
      else trend = 'stable';
    } else {
      trend = 'stable';
    }

    // Warning level
    let warningLevel: 'none' | 'warning' | 'critical' = 'none';
    if (currentHalfLife < this.config.criticalHalfLifeDays) warningLevel = 'critical';
    else if (currentHalfLife < this.config.warningHalfLifeDays) warningLevel = 'warning';

    return {
      currentHalfLife: Math.round(currentHalfLife),
      trend,
      warningLevel,
      halfLifeSeries: halfLifeSeries.map((v) => Math.round(v)),
      halfLifeChangeRate: Math.round(changeRate * 100) / 100,
    };
  }

  // ── Status Detection ───────────────────────────────────────────────────

  private determineStatus(icStab: ICStability, halfLife: HalfLifeEstimate): DecayStatus {
    // Recovering: IC trend positive + half-life stable or lengthening
    if (icStab.icTrend > 0.0005 && halfLife.trend !== 'shortening') {
      return 'recovering';
    }

    // Accelerating: IC dropping fast + half-life critical + acceleration < 0
    if (
      icStab.icAcceleration < -0.005 &&
      halfLife.warningLevel === 'critical' &&
      icStab.icTrend < -0.001
    ) {
      return 'accelerating';
    }

    // Declining: IC trend negative or half-life shortening
    if (icStab.icTrend < -0.0003 || halfLife.warningLevel !== 'none') {
      return 'declining';
    }

    return 'stable';
  }

  // ── Alert Generation ───────────────────────────────────────────────────

  private generateAlerts(
    factorName: string,
    factorNameCN: string,
    icStab: ICStability,
    halfLife: HalfLifeEstimate,
    status: DecayStatus,
  ): DecayAlert[] {
    const alerts: DecayAlert[] = [];

    const severityMap: Record<DecayStatus, DecayAlert['severity']> = {
      stable: 'ok',
      recovering: 'ok',
      declining: 'warning',
      accelerating: 'critical',
    };

    const iconMap: Record<DecayStatus, string> = {
      stable: '🟢',
      recovering: '🟢',
      declining: '🟡',
      accelerating: '🔴',
    };

    const remainingLifeDays = status === 'stable' || status === 'recovering' ? null
      : icStab.icTrend < 0
        ? Math.round(Math.abs(icStab.rollingMean / icStab.icTrend))
        : null;

    const decayRatePerMonth = icStab.icTrend < 0
      ? Math.abs(icStab.icTrend * 21) // ~21 trading days per month
      : 0;

    let recommendation = '';
    if (status === 'accelerating') {
      recommendation = `${factorNameCN} IC加速衰减，建议立即替换或降低权重至原策略的50%以下`;
    } else if (status === 'declining') {
      recommendation = halfLife.warningLevel === 'critical'
        ? `${factorNameCN} 半衰期仅${halfLife.currentHalfLife}天，建议降低权重并寻找替代因子`
        : `${factorNameCN} IC趋势减弱，建议持续观察${this.config.warningHalfLifeDays}天`;
    } else if (status === 'stable') {
      recommendation = `${factorNameCN} IC稳定，可维持当前权重`;
    } else {
      recommendation = `${factorNameCN} 正在恢复，可适度增加权重`;
    }

    alerts.push({
      factorName,
      factorNameCN,
      status,
      severity: severityMap[status],
      icon: iconMap[status],
      firstDetectedAt: new Date().toISOString().slice(0, 10),
      currentIC: icStab.rollingMean,
      remainingLifeDays,
      isAccelerating: status === 'accelerating',
      decayRatePerMonth: Math.round(decayRatePerMonth * 10000) / 10000,
      recommendation,
    });

    return alerts;
  }

  // ── Disposition ─────────────────────────────────────────────────────────

  private determineDisposition(
    _icStab: ICStability,
    halfLife: HalfLifeEstimate,
    alerts: DecayAlert[],
  ): 'retain' | 'watch' | 'replace' {
    if (alerts.some((a) => a.severity === 'critical')) return 'replace';
    if (alerts.some((a) => a.severity === 'warning') || halfLife.warningLevel !== 'none') return 'watch';
    return 'retain';
  }

  private buildAction(
    disposition: string,
    status: DecayStatus,
    halfLife: HalfLifeEstimate,
    icStab: ICStability,
  ): string {
    const statusText: Record<DecayStatus, string> = {
      stable: '保持',
      recovering: '恢复中',
      declining: '衰退',
      accelerating: '加速衰减',
    };

    return [
      `因子状态: ${statusText[status]}`,
      `IC均值: ${icStab.rollingMean.toFixed(4)} (IR=${icStab.icIR})`,
      `半衰期: ${halfLife.currentHalfLife}天 (${halfLife.trend === 'shortening' ? '缩短中' : halfLife.trend === 'lengthening' ? '增长中' : '稳定'})`,
      `处置建议: ${disposition === 'retain' ? '保留并维持权重' : disposition === 'watch' ? '降低权重并持续观察' : '建议替换因子'}`,
    ].join(' | ');
  }

  private emptyReport(factorName: string, factorNameCN: string, observations: ICObservation[]): DecayTrendReport {
    return {
      factorName,
      factorNameCN,
      generatedAt: new Date().toISOString(),
      period: {
        start: observations[0]?.date ?? 'N/A',
        end: observations[observations.length - 1]?.date ?? 'N/A',
      },
      observations: observations.length,
      currentStatus: 'stable',
      icStability: { rollingMean: 0, rollingStd: 0, icIR: 0, icTrend: 0, icAcceleration: 0, icTStat: 0 },
      halfLife: { currentHalfLife: 0, trend: 'stable', warningLevel: 'none', halfLifeSeries: [], halfLifeChangeRate: 0 },
      alerts: [],
      suggestedAction: `观测数据不足(${observations.length}/${this.config.minObservations})，需更多数据`,
      disposition: 'watch',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory & Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _monitor: FactorDecayMonitor | null = null;

export function getDecayMonitor(config?: Partial<DecayConfig>): FactorDecayMonitor {
  if (!_monitor) _monitor = new FactorDecayMonitor(config);
  return _monitor;
}

export function createDecayMonitor(config?: Partial<DecayConfig>): FactorDecayMonitor {
  return new FactorDecayMonitor(config);
}

export function resetDecayMonitor(): void {
  _monitor = null;
}

export default {
  FactorDecayMonitor,
  getDecayMonitor,
  createDecayMonitor,
  resetDecayMonitor,
};
