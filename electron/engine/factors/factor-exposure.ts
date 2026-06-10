// ── Q23: Factor Exposure Analyzer ────────────────────────────────────────────
// Multi-factor attribution: decompose P&L into factor contributions
// 5 Fama-French factors: Market / SMB (size) / HML (value) / RMW (profitability) / CMA (investment)
// Plus 3 custom: Momentum / LowVol / Quality

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorLoadings {
  marketBeta: number;      // MKT: sensitivity to market returns
  smbBeta: number;         // SMB: small minus big (size factor)
  hmlBeta: number;         // HML: high minus low (value factor)
  rmwBeta: number;         // RMW: robust minus weak (profitability)
  cmaBeta: number;         // CMA: conservative minus aggressive (investment)
  momentumBeta: number;     // Momentum: 12-month return momentum
  lowVolBeta: number;       // Low volatility: inverse vol factor
  qualityBeta: number;       // Quality: fundamental score
}

export interface FactorReturn {
  date: string;
  market: number;          // Risk-free rate included
  smb: number;
  hml: number;
  rmw: number;
  cma: number;
  momentum: number;
  lowVol: number;
  quality: number;
}

export interface FactorContribution {
  factor: string;
  label: string;
  avgBeta: number;
  contributionPct: number;   // % of total P&L explained by this factor
  contributionAbs: number;  // ¥ amount
  isDominant: boolean;
}

export interface FactorAttributionReport {
  strategyId: string;
  period: { start: string; end: string };
  totalPnL: number;

  // Factor loadings (betas)
  loadings: FactorLoadings;

  // Factor returns over period
  factorReturns: FactorReturn[];

  // P&L attribution
  contributions: FactorContribution[];

  // Idiosyncratic (unexplained)
  residualPnL: number;
  rSquared: number;        // Model fit (0-1)

  // Summary
  dominantFactor: string;
  unexplainedRisk: number;   // Residual volatility

  timestamp: number;
}

// ── Default Factor Returns (simplified historical averages) ─────────────────

const ANNUAL_FACTOR_RETURNS: Record<keyof Omit<FactorReturn, 'date'>, number> = {
  market: 0.08,    // 8% annual market return
  smb: 0.02,       // 2% SMB premium
  hml: 0.03,       // 3% value premium
  rmw: 0.02,       // 2% profitability premium
  cma: 0.01,       // 1% investment premium
  momentum: 0.05,   // 5% momentum premium
  lowVol: 0.02,    // 2% low-vol premium
  quality: 0.03,    // 3% quality premium
};

// ── Factor Analyzer ─────────────────────────────────────────────────────────

export class FactorExposureAnalyzer {
  constructor() {
    log.info('[FactorExposure] Initialized');
  }

  // ── Estimate Factor Loadings ──────────────────────────────────────────

  estimateLoadings(
    returns: number[],
    benchmarkReturns: number[]
  ): FactorLoadings {
    if (returns.length < 20 || benchmarkReturns.length < 20) {
      return this.defaultLoadings();
    }

    // Simplified OLS betas using benchmark as market proxy
    const marketBeta = this.olsBeta(returns, benchmarkReturns);

    // Factor loadings are relative to market + size/value proxy
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const marketAvg = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;

    // Size proxy: higher returns → smaller cap tilt
    const smbBeta = Math.min(1, Math.max(-1, (avgReturn - marketAvg) * 3));

    // Value proxy: based on P/E / P/B proxy (use return level as heuristic)
    const hmlBeta = this.estimateHMLBeta(returns);

    // Profitability / Investment: estimate from return volatility
    const rmwBeta = this.estimateRMWBeta(returns, marketBeta);
    const cmaBeta = this.estimateCMABeta(returns);

    // Momentum: 6-month vs 12-month return
    const momentumBeta = this.estimateMomentumBeta(returns);

    // Low-vol: inverse of realized volatility
    const vol = this.realizedVol(returns);
    const lowVolBeta = Math.min(1, Math.max(-1, 0.3 - vol * 2));

    // Quality: assume positive for positive alpha strategies
    const alpha = avgReturn - marketBeta * marketAvg;
    const qualityBeta = Math.min(1, Math.max(-1, alpha * 5 + 0.3));

    return {
      marketBeta: Math.round(marketBeta * 1000) / 1000,
      smbBeta: Math.round(smbBeta * 1000) / 1000,
      hmlBeta: Math.round(hmlBeta * 1000) / 1000,
      rmwBeta: Math.round(rmwBeta * 1000) / 1000,
      cmaBeta: Math.round(cmaBeta * 1000) / 1000,
      momentumBeta: Math.round(momentumBeta * 1000) / 1000,
      lowVolBeta: Math.round(lowVolBeta * 1000) / 1000,
      qualityBeta: Math.round(qualityBeta * 1000) / 1000,
    };
  }

  // ── Analyze Attribution ────────────────────────────────────────────────

  analyzeAttribution(
    strategyId: string,
    positions: Array<{
      strategyId: string;
      entryTime: number;
      exitTime: number;
      entryPrice: number;
      exitPrice: number;
      pnl: number;
    }>,
    marketReturns: number[]
  ): FactorAttributionReport {
    log.info(`[FactorExposure] Analyzing ${positions.length} trades for ${strategyId}`);

    if (positions.length === 0) {
      return this.emptyReport(strategyId);
    }

    const startDate = new Date(Math.min(...positions.map(p => p.entryTime))).toISOString().split('T')[0];
    const endDate = new Date(Math.max(...positions.map(p => p.exitTime))).toISOString().split('T')[0];

    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

    // Generate synthetic returns for each position period
    const returns = positions.map(p => (p.exitPrice - p.entryPrice) / p.entryPrice);
    const loadings = this.estimateLoadings(returns, marketReturns);

    // Calculate factor contributions (simplified)
    const factorReturns = this.estimateFactorReturns(startDate, endDate);
    const contributions = this.attributePnL(loadings, factorReturns, totalPnL);

    // Residual P&L
    const explainedPnL = contributions.reduce((sum, c) => sum + c.contributionAbs, 0);
    const residualPnL = totalPnL - explainedPnL;

    // R-squared approximation
    const explained = Math.abs(explainedPnL);
    const total = Math.abs(totalPnL);
    const rSquared = total > 0 ? Math.min(0.99, explained / total) : 0;

    const dominantFactor = contributions.reduce((best, c) =>
      c.contributionAbs > best.contributionAbs ? c : best
    , contributions[0]);

    return {
      strategyId,
      period: { start: startDate, end: endDate },
      totalPnL: Math.round(totalPnL * 100) / 100,
      loadings,
      factorReturns,
      contributions,
      residualPnL: Math.round(residualPnL * 100) / 100,
      rSquared: Math.round(rSquared * 1000) / 1000,
      dominantFactor: dominantFactor?.factor || 'none',
      unexplainedRisk: Math.round(this.realizedVol(returns) * 10000) / 100,
      timestamp: Date.now(),
    };
  }

  // ── Report Formatting ─────────────────────────────────────────────────

  generateReport(report: FactorAttributionReport): string {
    const lines: string[] = [];
    lines.push(`═══════════════════════════════════════════`);
    lines.push(`  Factor Exposure Report: ${report.strategyId}`);
    lines.push(`  Period: ${report.period.start} → ${report.period.end}`);
    lines.push(`  Total P&L: ¥${report.totalPnL.toFixed(2)}`);
    lines.push(`═══════════════════════════════════════════`);
    lines.push(`\n📊 Factor Loadings (Betas):`);
    lines.push(`  Market β     : ${report.loadings.marketBeta.toFixed(3)}`);
    lines.push(`  SMB (Size)   : ${report.loadings.smbBeta.toFixed(3)}`);
    lines.push(`  HML (Value)  : ${report.loadings.hmlBeta.toFixed(3)}`);
    lines.push(`  RMW (Profit) : ${report.loadings.rmwBeta.toFixed(3)}`);
    lines.push(`  CMA (Invest) : ${report.loadings.cmaBeta.toFixed(3)}`);
    lines.push(`  Momentum     : ${report.loadings.momentumBeta.toFixed(3)}`);
    lines.push(`  LowVol       : ${report.loadings.lowVolBeta.toFixed(3)}`);
    lines.push(`  Quality      : ${report.loadings.qualityBeta.toFixed(3)}`);
    lines.push(`\n💰 P&L Attribution:`);

    for (const c of report.contributions) {
      const flag = c.isDominant ? ' ◀◀' : '';
      lines.push(`  ${c.label.padEnd(12)}: ${(c.contributionPct * 100).toFixed(1).padStart(5)}%  (¥${c.contributionAbs.toFixed(2)})${flag}`);
    }

    lines.push(`\n  Residual     : ¥${report.residualPnL.toFixed(2)} (${((report.residualPnL / Math.max(Math.abs(report.totalPnL), 1)) * 100).toFixed(1)}% unexplained)`);
    lines.push(`  R²           : ${(report.rSquared * 100).toFixed(1)}%`);
    lines.push(`\n  Dominant Factor: ${report.dominantFactor}`);
    lines.push(`═══════════════════════════════════════════`);

    return lines.join('\n');
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private olsBeta(y: number[], x: number[]): number {
    const n = Math.min(y.length, x.length);
    if (n < 2) return 1.0;

    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const xMean = x.reduce((a, b) => a + b, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (y[i] - yMean) * (x[i] - xMean);
      den += (x[i] - xMean) ** 2;
    }

    return den > 0 ? num / den : 1.0;
  }

  private realizedVol(returns: number[]): number {
    if (returns.length < 2) return 0.15;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized
  }

  private defaultLoadings(): FactorLoadings {
    return {
      marketBeta: 1.0,
      smbBeta: 0,
      hmlBeta: 0,
      rmwBeta: 0,
      cmaBeta: 0,
      momentumBeta: 0,
      lowVolBeta: 0,
      qualityBeta: 0,
    };
  }

  private estimateHMLBeta(returns: number[]): number {
    // Value stocks tend to outperform in downturns
    const avgRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    // Conservative estimate: lean slightly toward growth
    return Math.min(0.5, Math.max(-0.5, -avgRet * 2));
  }

  private estimateRMWBeta(returns: number[], marketBeta: number): number {
    // Profitable companies: lower beta, positive alpha
    return Math.min(0.5, Math.max(-0.5, (1 - Math.abs(marketBeta)) * 0.3));
  }

  private estimateCMABeta(returns: number[]): number {
    const vol = this.realizedVol(returns);
    // Conservative investors: lower vol
    return Math.min(0.3, Math.max(-0.3, -vol));
  }

  private estimateMomentumBeta(returns: number[]): number {
    if (returns.length < 6) return 0;
    // Recent vs older returns
    const recent = returns.slice(-6);
    const older = returns.slice(0, Math.min(6, returns.length - 6));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : 0;
    return Math.min(1, Math.max(-1, (recentAvg - olderAvg) * 3));
  }

  private estimateFactorReturns(start: string, end: string): FactorReturn[] {
    // Generate daily synthetic factor returns
    const days = Math.max(1, Math.floor((Date.parse(end) - Date.parse(start)) / 86400000));
    const returns: FactorReturn[] = [];

    for (let i = 0; i < Math.min(days, 252); i++) {
      const date = new Date(Date.parse(start) + i * 86400000).toISOString().split('T')[0];
      returns.push({
        date,
        market: (ANNUAL_FACTOR_RETURNS.market / 252) * (1 + (Math.random() - 0.5) * 0.5),
        smb: (ANNUAL_FACTOR_RETURNS.smb / 252) * (1 + (Math.random() - 0.5) * 0.5),
        hml: (ANNUAL_FACTOR_RETURNS.hml / 252) * (1 + (Math.random() - 0.5) * 0.5),
        rmw: (ANNUAL_FACTOR_RETURNS.rmw / 252) * (1 + (Math.random() - 0.5) * 0.5),
        cma: (ANNUAL_FACTOR_RETURNS.cma / 252) * (1 + (Math.random() - 0.5) * 0.5),
        momentum: (ANNUAL_FACTOR_RETURNS.momentum / 252) * (1 + (Math.random() - 0.5) * 0.5),
        lowVol: (ANNUAL_FACTOR_RETURNS.lowVol / 252) * (1 + (Math.random() - 0.5) * 0.5),
        quality: (ANNUAL_FACTOR_RETURNS.quality / 252) * (1 + (Math.random() - 0.5) * 0.5),
      });
    }

    return returns;
  }

  private attributePnL(
    loadings: FactorLoadings,
    factorReturns: FactorReturn[],
    totalPnL: number
  ): FactorContribution[] {
    const factors: Array<{ key: keyof FactorLoadings; label: string }> = [
      { key: 'marketBeta', label: 'Market (MKT)' },
      { key: 'smbBeta', label: 'Size (SMB)' },
      { key: 'hmlBeta', label: 'Value (HML)' },
      { key: 'rmwBeta', label: 'Profit (RMW)' },
      { key: 'cmaBeta', label: 'Invest (CMA)' },
      { key: 'momentumBeta', label: 'Momentum' },
      { key: 'lowVolBeta', label: 'LowVol' },
      { key: 'qualityBeta', label: 'Quality' },
    ];

    // Average factor returns over period
    const avgReturns: Record<string, number> = {};
    for (const f of factors) {
      const key = f.key.replace('Beta', '').toLowerCase();
      if (f.key === 'marketBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.market, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'smbBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.smb, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'hmlBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.hml, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'rmwBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.rmw, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'cmaBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.cma, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'momentumBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.momentum, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'lowVolBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.lowVol, 0) / Math.max(1, factorReturns.length);
      } else if (f.key === 'qualityBeta') {
        avgReturns[f.key] = factorReturns.reduce((s, r) => s + r.quality, 0) / Math.max(1, factorReturns.length);
      }
    }

    const contributions: FactorContribution[] = [];
    let totalExplained = 0;

    for (const f of factors) {
      const beta = loadings[f.key];
      const avgRet = avgReturns[f.key] ?? 0;
      const contributionAbs = beta * avgRet * Math.abs(totalPnL);
      totalExplained += contributionAbs;
    }

    // Normalize to sum to explained P&L
    let maxAbs = 0;
    for (const f of factors) {
      const beta = loadings[f.key];
      const avgRet = avgReturns[f.key] ?? 0;
      const absContribution = Math.abs(beta * avgRet * totalPnL);
      if (absContribution > maxAbs) maxAbs = absContribution;
    }

    let dominant: FactorContribution | null = null;

    for (const f of factors) {
      const beta = loadings[f.key];
      const avgRet = avgReturns[f.key] ?? 0;
      const absContrib = Math.abs(beta * avgRet * totalPnL);
      const contributionPct = maxAbs > 0 ? absContrib / maxAbs : 0;

      const contrib: FactorContribution = {
        factor: f.key,
        label: f.label,
        avgBeta: beta,
        contributionPct: contributionPct,
        contributionAbs: Math.sign(beta * avgRet) * absContrib,
        isDominant: false,
      };

      if (!dominant || absContrib > Math.abs(dominant.contributionAbs)) {
        dominant = contrib;
      }

      contributions.push(contrib);
    }

    // Mark dominant
    if (dominant) {
      const idx = contributions.findIndex(c => c.factor === dominant!.factor);
      if (idx >= 0) contributions[idx].isDominant = true;
    }

    // Sort by absolute contribution
    contributions.sort((a, b) => Math.abs(b.contributionAbs) - Math.abs(a.contributionAbs));

    return contributions;
  }

  private emptyReport(strategyId: string): FactorAttributionReport {
    return {
      strategyId,
      period: { start: '', end: '' },
      totalPnL: 0,
      loadings: this.defaultLoadings(),
      factorReturns: [],
      contributions: [],
      residualPnL: 0,
      rSquared: 0,
      dominantFactor: 'none',
      unexplainedRisk: 0,
      timestamp: Date.now(),
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: FactorExposureAnalyzer | null = null;

export function getFactorExposureAnalyzer(): FactorExposureAnalyzer {
  if (!instance) instance = new FactorExposureAnalyzer();
  return instance;
}

export default FactorExposureAnalyzer;
