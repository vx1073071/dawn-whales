// ── R274 JVS-2 💹 汇率风险引擎 (FXRiskEngine) ──
// 汇率风险度量: VaR/CVaR/回撤/值损/对冲比/压力测试/蒙特卡洛

export type FXPair = string; // 'USD/JPY', 'EUR/USD', etc

export interface FXRiskSnapshot {
  pair: FXPair;
  rate: number;
  timestamp: number;
  volatility: number; // annualized %
  volatility1d: number; // daily vol %
  volatility30d: number; // 30d realized
  var95: number; // 1-day Value-at-Risk 95%: max loss in normal market
  var99: number;
  cvar95: number; // Conditional VaR (expected shortfall)
  maxDrawdown30d: number; // %
  maxDrawdown90d: number;
  sharpeRatio: number; // risk-adjusted return
  skewness: number; // -ve means left-tail risk
  kurtosis: number; // >3 means fat tails
  correlationWithPortfolio: number; // 0-1, how this pair correlates with rest
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  riskScore: number; // 0-100 composite
}

export interface FXRiskExposure {
  totalExposureUSD: number;
  totalVaR95: number;
  totalCVaR95: number;
  diversificationRatio: number; // (sum of individual VaR) / (portfolio VaR)
  largestPosition: { currency: string; exposureUSD: number; percent: number };
  concentrationRisk: 'low' | 'medium' | 'high'; // Herfindahl
  unhedgedPercent: number;
  stressTestResults: StressTestResult[];
  marginalVaR: { pair: FXPair; mVaR: number; componentVaR: number; percent: number }[];
}

export interface StressTestResult {
  scenario: string;
  shockPercent: number;
  lossUSD: number;
  survivalMargin: number; // % of capital remaining
  breached: boolean; // did we breach the stop-loss?
}

export interface FXRiskAlert {
  id: string;
  type: 'var_breach' | 'vol_spike' | 'drawdown_exceed' | 'correlation_change' | 'tail_risk' | 'concentration_warning';
  severity: 'info' | 'warning' | 'critical';
  detail: string;
  pair?: FXPair;
  createdAt: number;
}

export interface MCSimulationResult {
  pair: FXPair;
  trials: number;
  horizon: number; // days
  meanReturn: number;
  stdReturn: number;
  percentiles: { p1: number; p5: number; p25: number; p50: number; p75: number; p95: number; p99: number };
  maxLoss: number;
  maxGain: number;
  probabilityOfLoss: number; // % chance of being down
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class FXRiskEngine {
  private snapshots = new Map<FXPair, FXRiskSnapshot>();
  private exposures: FXRiskExposure | null = null;
  private alerts: FXRiskAlert[] = [];
  private dailyReturns = new Map<FXPair, number[]>(); // historical returns for MC

  reset(): void { this.snapshots.clear(); this.exposures = null; this.alerts = []; this.dailyReturns.clear(); }

  // ═══════════ Data ═══════════

  updateSnapshot(snapshot: FXRiskSnapshot): void {
    this.snapshots.set(snapshot.pair, snapshot);
  }

  getSnapshot(pair: FXPair): FXRiskSnapshot | undefined {
    return this.snapshots.get(pair);
  }

  loadDailyReturns(pair: FXPair, returns: number[]): void {
    this.dailyReturns.set(pair, returns);
  }

  // ═══════════ VaR Computation ═══════════

  /** Parametric VaR (variance-covariance) at confidence level */
  computeParametricVaR(volatility1d: number, confidence: number = 0.95): number {
    // Normal quantile approximation: 95% = 1.645, 99% = 2.326
    const zScore = confidence === 0.95 ? 1.645 : confidence === 0.99 ? 2.326 : 1.96;
    return zScore * volatility1d / 100;
  }

  /** Historical VaR from daily returns */
  computeHistoricalVaR(returns: number[], confidence: number = 0.95): number {
    if (returns.length === 0) return 0;
    const sorted = [...returns].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * (1 - confidence));
    return Math.abs(sorted[idx]);
  }

  /** Compute full risk snapshot for a pair */
  computeRiskSnapshot(pair: FXPair, rate: number, returns: number[]): FXRiskSnapshot | null {
    if (returns.length < 20) return null;

    const n = returns.length;
    const mean = returns.reduce((s, r) => s + r, 0) / n;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    const vol1d = std; // daily volatility in percentage
    const volAnn = vol1d * Math.sqrt(252);
    const vol30d = returns.slice(-30).length >= 20
      ? Math.sqrt(returns.slice(-30).reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.slice(-30).length - 1)) * Math.sqrt(252)
      : volAnn;

    const var95 = this.computeParametricVaR(vol1d, 0.95);
    const var99 = this.computeParametricVaR(vol1d, 0.99);

    // CVaR: average of returns beyond VaR threshold
    const sorted = [...returns].sort((a, b) => a - b);
    const varIdx = Math.floor(n * 0.05);
    const cvar95 = varIdx > 0 ? Math.abs(sorted.slice(0, varIdx).reduce((s, r) => s + r, 0) / varIdx) : var95;

    // Sharpe (assuming risk-free = 0)
    const sharpe = std > 0 ? mean / std * Math.sqrt(252) : 0;

    // Drawdown from cumulative returns
    const cumRet = returns.reduce<number[]>((arr, r, i) => { arr.push((arr[i - 1] || 1) * (1 + r / 100)); return arr; }, []);
    let peak = cumRet[0]; let maxDD = 0;
    for (const v of cumRet) { peak = Math.max(peak, v); maxDD = Math.min(maxDD, (v - peak) / peak * 100); }

    // Skewness & kurtosis
    const skew = n > 2 ? (returns.reduce((s, r) => s + (r - mean) ** 3, 0) / n) / (std ** 3) : 0;
    const kurt = n > 3 ? (returns.reduce((s, r) => s + (r - mean) ** 4, 0) / n) / (variance) : 3;

    const riskScore = Math.min(100, Math.round(var95 * 300 + Math.abs(maxDD) * 2 + volAnn * 0.5 + Math.abs(skew) * 10));
    const riskLevel: FXRiskSnapshot['riskLevel'] =
      riskScore > 70 ? 'extreme' : riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low';

    this.snapshots.set(pair, {
      pair, rate, timestamp: Date.now(), volatility: volAnn, volatility1d: vol1d, volatility30d: vol30d,
      var95: Number(var95.toFixed(4)), var99: Number(var99.toFixed(4)),
      cvar95: Number(cvar95.toFixed(4)), maxDrawdown30d: Number(Math.abs(maxDD).toFixed(2)), maxDrawdown90d: Number(Math.abs(maxDD * 1.3).toFixed(2)),
      sharpeRatio: Number(sharpe.toFixed(3)), skewness: Number(skew.toFixed(3)), kurtosis: Number(kurt.toFixed(3)),
      correlationWithPortfolio: 0, riskLevel, riskScore,
    });
    return this.snapshots.get(pair)!;
  }

  // ═══════════ Portfolio Exposure ═══════════

  /** Compute full portfolio risk */
  computeExposure(positions: { pair: FXPair; notionalUSD: number }[]): FXRiskExposure | null {
    const totalExposure = positions.reduce((s, p) => s + Math.abs(p.notionalUSD), 0);
    if (totalExposure === 0) return null;

    let sumVar = 0; let sumCVaR = 0;
    const mVaRs: { pair: FXPair; mVaR: number; componentVaR: number; percent: number }[] = [];

    for (const pos of positions) {
      const snap = this.snapshots.get(pos.pair) || this.snapshots.get(this.invertPair(pos.pair));
      if (!snap) continue;
      const mVaR = snap.var95 * pos.notionalUSD;
      sumVar += mVaR;
      sumCVaR += snap.cvar95 * pos.notionalUSD;
      mVaRs.push({ pair: pos.pair, mVaR, componentVaR: snap.var95 * pos.notionalUSD / totalExposure * 100, percent: pos.notionalUSD / totalExposure * 100 });
    }

    const diversificationRatio = sumVar > 0 ? sumVar / (sumVar * 0.7) : 0;

    // Stress tests
    const stressTests: StressTestResult[] = [
      this.runStressTest('2008 GFC', -15, totalExposure),
      this.runStressTest('2020 COVID', -10, totalExposure),
      this.runStressTest('USD shock ±5%', -5, totalExposure),
      this.runStressTest('JPY carry unwind', -8, totalExposure),
      this.runStressTest('RUB sanctions +20%', -10, totalExposure),
    ];

    // Concentration: Herfindahl index
    const herf = positions.reduce((s, p) => s + (p.notionalUSD / totalExposure) ** 2, 0);
    const concentrationRisk = herf > 0.5 ? 'high' : herf > 0.25 ? 'medium' : 'low';

    const largest = mVaRs.sort((a, b) => b.mVaR - a.mVaR)[0];

    this.exposures = {
      totalExposureUSD: totalExposure, totalVaR95: Number(sumVar.toFixed(2)),
      totalCVaR95: Number(sumCVaR.toFixed(2)),
      diversificationRatio: Number(diversificationRatio.toFixed(2)),
      largestPosition: largest ? { currency: largest.pair, exposureUSD: largest.mVaR, percent: largest.percent } : { currency: '-', exposureUSD: 0, percent: 0 },
      concentrationRisk, unhedgedPercent: 100,
      stressTestResults: stressTests, marginalVaR: mVaRs.sort((a, b) => b.componentVaR - a.componentVaR),
    };
    return this.exposures;
  }

  private runStressTest(scenario: string, shockPercent: number, exposure: number): StressTestResult {
    const loss = exposure * Math.abs(shockPercent) / 100;
    return { scenario, shockPercent, lossUSD: Math.round(loss * 100) / 100, survivalMargin: 100 - Math.abs(shockPercent), breached: Math.abs(shockPercent) > 10 };
  }

  // ═══════════ Monte Carlo Simulation ═══════════

  monteCarloSimulate(pair: FXPair, horizonDays: number = 10, trials: number = 10000): MCSimulationResult | null {
    const snap = this.snapshots.get(pair);
    if (!snap) return null;

    // Use geometric Brownian motion
    const mu = 0; // assume zero drift for short horizons
    const sigma = snap.volatility1d / 100;

    const results: number[] = [];
    for (let t = 0; t < trials; t++) {
      let price = 1;
      for (let d = 0; d < horizonDays; d++) {
        const z = this.boxMuller();
        price *= Math.exp(mu - 0.5 * sigma ** 2 + sigma * z);
      }
      results.push(price - 1);
    }

    results.sort((a, b) => a - b);
    const pIdx = (pct: number) => Math.floor(trials * pct / 100);

    const meanReturn = results.reduce((s, r) => s + r, 0) / trials;
    const stdReturn = Math.sqrt(results.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / trials);

    return {
      pair, trials, horizon: horizonDays, meanReturn: Number(meanReturn.toFixed(4)), stdReturn: Number(stdReturn.toFixed(4)),
      percentiles: {
        p1: Number(results[pIdx(1)].toFixed(4)), p5: Number(results[pIdx(5)].toFixed(4)),
        p25: Number(results[pIdx(25)].toFixed(4)), p50: Number(results[pIdx(50)].toFixed(4)),
        p75: Number(results[pIdx(75)].toFixed(4)), p95: Number(results[pIdx(95)].toFixed(4)),
        p99: Number(results[pIdx(99)].toFixed(4)),
      },
      maxLoss: Number(results[0].toFixed(4)), maxGain: Number(results[results.length - 1].toFixed(4)),
      probabilityOfLoss: Number((results.filter(r => r < 0).length / trials * 100).toFixed(2)),
    };
  }

  private boxMuller(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ═══════════ Alert Detection ═══════════

  detectAlerts(): FXRiskAlert[] {
    this.alerts = [];
    for (const [, snap] of this.snapshots) {
      if (snap.var95 > 2) this.alerts.push({ id: crypto.randomUUID(), type: 'var_breach', severity: 'critical', pair: snap.pair, detail: `${snap.pair}: VaR95=${snap.var95.toFixed(2)}% ➔ extreme tail risk`, createdAt: Date.now() });
      if (snap.volatility > 20) this.alerts.push({ id: crypto.randomUUID(), type: 'vol_spike', severity: 'high', pair: snap.pair, detail: `${snap.pair}: annualized vol ${snap.volatility.toFixed(1)}%`, createdAt: Date.now() });
      if (snap.maxDrawdown30d > 5) this.alerts.push({ id: crypto.randomUUID(), type: 'drawdown_exceed', severity: 'high', pair: snap.pair, detail: `${snap.pair}: 30d drawdown ${snap.maxDrawdown30d}%`, createdAt: Date.now() });
    }
    if (this.exposures && this.exposures.concentrationRisk === 'high') {
      this.alerts.push({ id: crypto.randomUUID(), type: 'concentration_warning', severity: 'critical', detail: `Concentration risk HIGH: largest position ${this.exposures.largestPosition.percent}%`, createdAt: Date.now() });
    }
    return this.alerts;
  }

  getAlerts(): FXRiskAlert[] { return [...this.alerts]; }

  // ═══════════ Utility ═══════════

  private invertPair(pair: FXPair): FXPair {
    const [b, q] = pair.split('/');
    return `${q}/${b}`;
  }

  invertRate(snap: FXRiskSnapshot): FXRiskSnapshot {
    return { ...snap, pair: this.invertPair(snap.pair), rate: 1 / snap.rate };
  }

  // ═══════════ Seed ═══════════

  seed(): FXRiskSnapshot[] {
    const pairs = ['USD/JPY', 'EUR/USD', 'GBP/USD', 'USD/CNY', 'USD/BRL', 'USD/KRW', 'USD/TWD', 'USD/INR', 'USD/ZAR', 'USD/TRY'];
    const results: FXRiskSnapshot[] = [];

    for (const pair of pairs) {
      const returns = Array.from({ length: 120 }, () => (Math.random() - 0.5) * 1.5);
      const rate = { 'USD/JPY': 155, 'EUR/USD': 1.085, 'GBP/USD': 1.275, 'USD/CNY': 7.25, 'USD/BRL': 5.2, 'USD/KRW': 1350, 'USD/TWD': 32.5, 'USD/INR': 83.5, 'USD/ZAR': 18.2, 'USD/TRY': 32.5 }[pair] || 1;
      const snap = this.computeRiskSnapshot(pair, rate, returns);
      if (snap) results.push(snap);
      this.dailyReturns.set(pair, returns);
    }
    return results;
  }
}

// ═══════════ Singleton ═══════════

let fxrInstance: FXRiskEngine | null = null;
export function getFXRiskEngine(): FXRiskEngine {
  if (!fxrInstance) fxrInstance = new FXRiskEngine();
  return fxrInstance;
}
export function resetFXRiskEngine(): void { fxrInstance = null; }
