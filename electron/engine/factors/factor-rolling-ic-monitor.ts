// R190 J1: Factor Rolling IC Monitor — 12-month IC trend + decay detection + auto-flag
// Monitors rolling Information Coefficient for all 68 yellow factors.
// Detects IC decay (declining effectiveness) and flags factors for review.
import type { FactorId } from './factor-id-registry';

export interface RollingICPoint {
  month: string; // ISO month label: "2026-06"
  ic: number;
  rankIc: number;
  sampleSize: number;
  tStat: number;
}

export interface ICHealthStatus {
  factorId: FactorId;
  /** Current 1-month IC */
  currentIC: number;
  /** 12-month average IC */
  averageIC: number;
  /** 12-month IC standard deviation */
  icStd: number;
  /** IC Information Ratio */
  icIr: number;
  /** IC decay trend (month-over-month slope) */
  icDecayTrend: number;
  /** Decay severity: 'none' | 'warning' | 'critical' */
  decayLevel: 'none' | 'warning' | 'critical';
  /** Is factor currently declining? */
  isDeclining: boolean;
  /** Last 6 months IC direction (+1 up, -1 down) */
  recentDirection: number;
  /** Auto-flag for review */
  flagged: boolean;
  /** Flag reason (if flagged) */
  flagReason?: string;
  /** Rolling 12-month IC series */
  rollingIC: RollingICPoint[];
  /** Correlation with market returns */
  marketCorrelation: number;
  /** Monthly turnover (decay stability metric) */
  monthlyTurnover: number;
}

export interface ICMonitorConfig {
  /** Rolling window months (default 12) */
  lookbackMonths?: number;
  /** Minimum IC absolute value for healthy factor */
  minAbsoluteIC?: number;
  /** IC decay slope threshold for warning */
  decayWarningSlope?: number;
  /** IC decay slope threshold for critical */
  decayCriticalSlope?: number;
  /** Minimum months of data before flagging */
  minMonthsForFlag?: number;
  /** Enable auto-flagging */
  autoFlag?: boolean;
}

export class FactorRollingICMonitor {
  private config: Required<ICMonitorConfig>;
  private icHistory = new Map<FactorId, RollingICPoint[]>();

  constructor(config: ICMonitorConfig = {}) {
    this.config = {
      lookbackMonths: config.lookbackMonths ?? 12,
      minAbsoluteIC: config.minAbsoluteIC ?? 0.02,
      decayWarningSlope: config.decayWarningSlope ?? -0.005,
      decayCriticalSlope: config.decayCriticalSlope ?? -0.01,
      minMonthsForFlag: config.minMonthsForFlag ?? 3,
      autoFlag: config.autoFlag ?? true,
    };
  }

  /** Record a new monthly IC point for a factor */
  recordIC(factorId: FactorId, point: RollingICPoint): void {
    const history = this.icHistory.get(factorId) ?? [];
    history.push(point);
    if (history.length > this.config.lookbackMonths * 2) {
      history.splice(0, 1);
    }
    this.icHistory.set(factorId, history);
  }

  /** Bulk record IC points from a monthly factor universe scan */
  recordBulk(points: { factorId: FactorId; point: RollingICPoint }[]): void {
    for (const { factorId, point } of points) {
      this.recordIC(factorId, point);
    }
  }

  /** Get health status for a single factor */
  getHealth(factorId: FactorId): ICHealthStatus | null {
    const history = this.icHistory.get(factorId);
    if (!history || history.length < this.config.minMonthsForFlag) return null;

    // Use last 12 months (or all if less)
    const window = history.slice(-this.config.lookbackMonths);
    const ics = window.map(p => p.ic);
    const avgIC = ics.reduce((a, b) => a + b, 0) / ics.length;
    const icStd = ics.length > 1 ? Math.sqrt(ics.reduce((s, v) => s + (v - avgIC) ** 2, 0) / (ics.length - 1)) : 0;
    const icIr = icStd > 0 ? avgIC / icStd : 0;

    // Decay trend: linear regression slope over last 6 months
    const recent = ics.slice(-6);
    const decaySlope = this.computeDecaySlope(recent);

    // Determine decay level
    let decayLevel: ICHealthStatus['decayLevel'] = 'none';
    if (decaySlope < this.config.decayCriticalSlope) decayLevel = 'critical';
    else if (decaySlope < this.config.decayWarningSlope) decayLevel = 'warning';

    // Direction of recent IC
    const recentDir = recent.length >= 3 ? (recent[recent.length - 1] - recent[0] > 0 ? 1 : -1) : 0;

    // Flagging
    let flagged = false;
    let flagReason: string | undefined;
    if (this.config.autoFlag && history.length >= this.config.minMonthsForFlag) {
      if (decayLevel === 'critical') {
        flagged = true;
        flagReason = 'IC decay critical: slope=' + decaySlope.toFixed(4);
      } else if (Math.abs(avgIC) < this.config.minAbsoluteIC) {
        flagged = true;
        flagReason = 'Low effectiveness: avg|IC|=' + avgIC.toFixed(4) + ' < ' + this.config.minAbsoluteIC;
      } else if (icIr < 0.3) {
        flagged = true;
        flagReason = 'Low IC IR: ' + icIr.toFixed(3);
      }
    }

    return {
      factorId,
      currentIC: ics[ics.length - 1],
      averageIC: avgIC,
      icStd,
      icIr,
      icDecayTrend: decaySlope,
      decayLevel,
      isDeclining: decaySlope < 0,
      recentDirection: recentDir,
      flagged,
      flagReason,
      rollingIC: window,
      marketCorrelation: this.calcMarketCorrelation(window),
      monthlyTurnover: this.calcMonthlyTurnover(history),
    };
  }

  /** Get health status for all tracked factors */
  getAllHealth(): ICHealthStatus[] {
    const results: ICHealthStatus[] = [];
    const factorIds = Array.from(this.icHistory.keys());
    for (const fid of factorIds) {
      const status = this.getHealth(fid);
      if (status) results.push(status);
    }
    return results.sort((a, b) => a.icIr - b.icIr);
  }

  /** Get flagged (problematic) factors */
  getFlaggedFactors(): ICHealthStatus[] {
    return this.getAllHealth().filter(h => h.flagged);
  }

  /** Get top N factors by IC IR */
  getTopFactorsByICIR(n: number = 10): ICHealthStatus[] {
    return this.getAllHealth().sort((a, b) => b.icIr - a.icIr).slice(0, n);
  }

  /** Get factors sorted by decay severity */
  getDecayingFactors(): ICHealthStatus[] {
    return this.getAllHealth()
      .filter(h => h.decayLevel !== 'none')
      .sort((a, b) => a.icDecayTrend - b.icDecayTrend);
  }

  /** Clear history for a factor */
  clearFactor(factorId: FactorId): void { this.icHistory.delete(factorId); }

  /** Clear all history */
  clearAll(): void { this.icHistory.clear(); }

  /** Get count of tracked factors */
  getTrackedFactorCount(): number { return this.icHistory.size; }

  /** Generate mock monthly IC data for testing/demo */
  generateMockData(factorIds: FactorId[], months: number = 12): void {
    for (const fid of factorIds) {
      // Seed from factor ID hash for reproducibility
      let h = 0;
      for (let i = 0; i < fid.length; i++) h = (h * 31 + fid.charCodeAt(i)) & 0xffffffff;
      const seed = (h % 1000) / 1000;
      const baseIC = 0.02 + seed * 0.06; // Base IC 0.02-0.08
      const decayRate = -0.001 + seed * -0.004; // Some decay, some not

      for (let m = 0; m < months; m++) {
        const noise = (Math.random() - 0.5) * 0.04;
        const ic = baseIC + decayRate * m + noise;
        const year = 2026 - Math.floor((months - 1 - m) / 12);
        const month = ((12 - (months - 1 - m) % 12 - 1) % 12) + 1;
        this.recordIC(fid, {
          month: year + '-' + String(month).padStart(2, '0'),
          ic,
          rankIc: ic + (Math.random() - 0.5) * 0.02,
          sampleSize: 200 + Math.floor(seed * 800),
          tStat: Math.abs(ic) / (0.01 + Math.random() * 0.02),
        });
      }
    }
  }

  private computeDecaySlope(ics: number[]): number {
    if (ics.length < 2) return 0;
    const n = ics.length;
    const xMean = (n - 1) / 2;
    const yMean = ics.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const x = i - xMean;
      num += x * (ics[i] - yMean);
      den += x * x;
    }
    return den > 0 ? num / den : 0;
  }

  private calcMarketCorrelation(rolling: RollingICPoint[]): number {
    // Mock: correlate IC series with a simulated market return series
    if (rolling.length < 5) return 0;
    const ics = rolling.map(r => r.ic);
    const mkt = ics.map((_, i) => 0.05 + (i - rolling.length / 2) * 0.002);
    return FactorRollingICMonitor.pearson(ics, mkt);
  }

  private calcMonthlyTurnover(history: RollingICPoint[]): number {
    if (history.length < 6) return 0;
    const recent = history.slice(-6);
    const changes = [];
    for (let i = 1; i < recent.length; i++) {
      changes.push(Math.abs(recent[i].ic - recent[i - 1].ic));
    }
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  static pearson(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2 || n !== y.length) return 0;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
    const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
    const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den > 0 && isFinite(den) ? Math.max(-1, Math.min(1, num / den)) : 0;
  }
}

// Singleton
let defaultMonitor: FactorRollingICMonitor | null = null;
export function getRollingICMonitor(config?: ICMonitorConfig): FactorRollingICMonitor {
  if (!defaultMonitor) defaultMonitor = new FactorRollingICMonitor(config);
  return defaultMonitor;
}
export function resetRollingICMonitor(): void { defaultMonitor = null; }

// Exported decay analysis helper
export function analyzeICDecay(rolling: RollingICPoint[]): {
  slope: number;
  severity: 'none' | 'warning' | 'critical';
  halfLife: number | null;
} {
  if (rolling.length < 3) return { slope: 0, severity: 'none', halfLife: null };
  const ics = rolling.map(r => r.ic);
  const n = ics.length;
  const xMean = (n - 1) / 2;
  const yMean = ics.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xMean) * (ics[i] - yMean); den += (i - xMean) ** 2; }
  const slope = den > 0 ? num / den : 0;
  const severity = slope < -0.01 ? 'critical' : slope < -0.005 ? 'warning' : 'none';
  const halfLife = slope < 0 ? Math.log(0.5) / slope : null;
  return { slope, severity, halfLife };
}