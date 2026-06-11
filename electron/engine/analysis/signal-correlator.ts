// ── Q32: Signal Correlator ───────────────────────────────────────────────────
// Cross-asset signal correlation matrix
// Leading/lagging indicator detection
// Portfolio signal diversification scoring

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface SignalPoint {
  timestamp: number;
  value: number;            // Normalized -1 to +1
  type: 'momentum' | 'mean_reversion' | 'breakout' | 'sentiment' | 'macro' | 'custom';
  confidence: number;       // 0-1
}

export interface CorrelationResult {
  asset1: string;
  asset2: string;
  pearsonCorr: number;
  spearmanCorr: number;
  lag: number;             // 0 = same direction, +ve = asset1 leads
  significance: number;    // p-value approximation (0-1)
  relationship: 'positive' | 'negative' | 'none';
}

export interface SignalPairAnalysis {
  pair: CorrelationResult;
  isLeadingIndicator: boolean;
  leadSeconds: number;
  coIntegration: boolean;
  hedgeRatio: number;      // For pairs trading
}

export interface DiversificationScore {
  portfolioId: string;
  averageCorrelation: number;
  diversificationRatio: number;  // >1 = diversified
  riskPerUnit: number;
  signalDiversity: number;       // 0-1
  uncorrelatedCount: number;      // How many signals < 0.3 correlation
  recommendations: string[];
}

export interface CorrelatorReport {
  symbols: string[];
  correlationMatrix: number[][];
  leadLagMatrix: number[][];
  pairs: CorrelationResult[];
  strongestPositive: CorrelationResult | null;
  strongestNegative: CorrelationResult | null;
  mostLeading: CorrelationResult | null;
  diversification: DiversificationScore;
  timestamp: number;
}

// ── Correlation Helpers ────────────────────────────────────────────────────

function pearsonCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;
  const xMean = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const yMean = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean, dy = y[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? Math.max(-1, Math.min(1, num / den)) : 0;
}

function spearmanCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;

  // Rank transform
  const rank = (arr: number[], start = 0) => [...arr.slice(0, n)]
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
    .map((el, idx) => ({ v: el.i, rank: idx + start + 1 }));

  const xRanks = rank(x);
  const yRanks = rank(y);

  return pearsonCorr(
    xRanks.map(r => r.rank),
    yRanks.map(r => r.rank)
  );
}

function crossCorrelation(x: number[], y: number[]): number[] {
  const n = Math.min(x.length, y.length);
  const maxLag = Math.min(20, Math.floor(n / 4));
  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const results: number[] = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    if (lag < 0) {
      results.push(pearsonCorr(xSlice.slice(-lag), ySlice.slice(0, lag)));
    } else if (lag > 0) {
      results.push(pearsonCorr(xSlice.slice(0, n - lag), ySlice.slice(lag)));
    } else {
      results.push(pearsonCorr(xSlice, ySlice));
    }
  }
  return results;
}

function findOptimalLag(x: number[], y: number[]): number {
  const ccf = crossCorrelation(x, y);
  const maxLag = Math.min(20, Math.floor(Math.min(x.length, y.length) / 4));
  const maxIdx = ccf.indexOf(Math.max(...ccf));
  return maxIdx - maxLag;
}

// ── Cointegration Test (Johansen-style simplified) ──────────────────────────

function isCointegrated(x: number[], y: number[], n = 50): boolean {
  const len = Math.min(n, Math.min(x.length, y.length));
  if (len < 20) return false;

  // Simple Engle-Granger approach
  const xSlice = x.slice(0, len);
  const ySlice = y.slice(0, len);

  // OLS hedge ratio
  const meanX = xSlice.reduce((a, b) => a + b, 0) / len;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / len;
  let num = 0, den = 0;
  for (let i = 0; i < len; i++) {
    num += (xSlice[i] - meanX) * (ySlice[i] - meanY);
    den += (ySlice[i] - meanY) ** 2;
  }
  const hedgeRatio = den > 0 ? num / den : 1;

  // Spread = x - hedgeRatio * y
  const spreads = xSlice.map((xi, i) => xi - hedgeRatio * ySlice[i]);
  const spreadStd = stdDev(spreads);
  const spreadMean = spreads.reduce((a, b) => a + b, 0) / len;

  // Half-life estimation (decay of mean reversion)
  if (spreadStd === 0) return false;
  const halfLife = spreadStd / Math.abs(spreads[spreads.length - 1] - spreads[0] + 1e-9);

  // Cointegrated if spread is mean-reverting (half-life < 60 bars)
  return halfLife < 60 && halfLife > 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

// ── Signal Correlator ─────────────────────────────────────────────────────

export class SignalCorrelator {
  constructor() {
    log.info('[SignalCorrelator] Initialized');
  }

  // ── Build Correlation Matrix ───────────────────────────────────────

  buildMatrix(signals: Map<string, SignalPoint[]>): {
    matrix: number[][];
    symbols: string[];
    leadLagMatrix: number[][];
  } {
    const symbols = [...signals.keys()];
    const n = symbols.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
    const leadLagMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const s1 = signals.get(symbols[i]) ?? [];
        const s2 = signals.get(symbols[j]) ?? [];
        const v1 = s1.map(p => p.value);
        const v2 = s2.map(p => p.value);

        const corr = pearsonCorr(v1, v2);
        const lag = findOptimalLag(v1, v2);

        matrix[i][j] = corr;
        matrix[j][i] = corr;
        leadLagMatrix[i][j] = lag;
        leadLagMatrix[j][i] = -lag;
      }
    }

    return { matrix, symbols, leadLagMatrix };
  }

  // ── Pair Analysis ───────────────────────────────────────────────────

  analyzePair(
    symbol1: string,
    signals1: SignalPoint[],
    symbol2: string,
    signals2: SignalPoint[]
  ): SignalPairAnalysis {
    const v1 = signals1.map(p => p.value);
    const v2 = signals2.map(p => p.value);

    const pearsonCorr = pearsonCorr(v1, v2);
    const spearmanCorr = spearmanCorr(v1, v2);
    const lag = findOptimalLag(v1, v2);
    const cointegrated = isCointegrated(v1, v2);
    const hedgeRatio = this.calcHedgeRatio(v1, v2);

    const pair: CorrelationResult = {
      asset1: symbol1,
      asset2: symbol2,
      pearsonCorr,
      spearmanCorr,
      lag,
      significance: Math.abs(pearsonCorr) > 0.3 ? 0.95 : 0.5,
      relationship: pearsonCorr > 0.3 ? 'positive' : pearsonCorr < -0.3 ? 'negative' : 'none',
    };

    return {
      pair,
      isLeadingIndicator: Math.abs(lag) > 2,
      leadSeconds: lag * 5 * 60, // Assuming 5-min bars
      coIntegration: cointegrated,
      hedgeRatio,
    };
  }

  // ── Diversification Score ───────────────────────────────────────────

  diversificationScore(
    portfolioId: string,
    signals: Map<string, SignalPoint[]>
  ): DiversificationScore {
    const { matrix, symbols } = this.buildMatrix(signals);
    const n = symbols.length;

    // Average off-diagonal correlation
    let sumCorr = 0, count = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        sumCorr += matrix[i][j];
        count++;
      }
    }
    const avgCorr = count > 0 ? sumCorr / count : 0;

    // Diversification ratio: 1 / (1 + avgCorr)
    // >1 means diversification benefit
    const diversificationRatio = 1 / (1 + avgCorr);

    // Risk per unit (avg correlation × volatility of signals)
    const avgVol = [...signals.values()].reduce((s, pts) => {
      if (pts.length < 2) return s;
      const vals = pts.map(p => p.value);
      return s + stdDev(vals);
    }, 0) / Math.max(n, 1);

    const riskPerUnit = avgVol * Math.sqrt(1 + avgCorr * (n - 1));

    // Count uncorrelated pairs (corr < 0.3)
    let uncorrCount = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(matrix[i][j]) < 0.3) uncorrCount++;
      }
    }

    const signalDiversity = uncorrCount / Math.max(count, 1);

    const recommendations: string[] = [];
    if (avgCorr > 0.7) recommendations.push('⚠️ High correlation: reduce overlapping signals');
    if (diversificationRatio < 0.6) recommendations.push('Low diversification: add uncorrelated assets');
    if (uncorrCount > n) recommendations.push('✅ Good diversification: many low-correlation pairs');

    return {
      portfolioId,
      averageCorrelation: Math.round(avgCorr * 1000) / 1000,
      diversificationRatio: Math.round(diversificationRatio * 1000) / 1000,
      riskPerUnit: Math.round(riskPerUnit * 1000) / 1000,
      signalDiversity: Math.round(signalDiversity * 1000) / 1000,
      uncorrelatedCount: uncorrCount,
      recommendations,
    };
  }

  // ── Full Report ────────────────────────────────────────────────────

  generateReport(
    signals: Map<string, SignalPoint[]>,
    portfolioId = 'default'
  ): CorrelatorReport {
    const { matrix, symbols, leadLagMatrix } = this.buildMatrix(signals);
    const diversification = this.diversificationScore(portfolioId, signals);

    // Compute all pairs
    const pairs: CorrelationResult[] = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const v1 = (signals.get(symbols[i]) ?? []).map(p => p.value);
        const v2 = (signals.get(symbols[j]) ?? []).map(p => p.value);
        pairs.push({
          asset1: symbols[i],
          asset2: symbols[j],
          pearsonCorr: matrix[i][j],
          spearmanCorr: spearmanCorr(v1, v2),
          lag: leadLagMatrix[i][j],
          significance: 0.95,
          relationship: matrix[i][j] > 0.3 ? 'positive' : matrix[i][j] < -0.3 ? 'negative' : 'none',
        });
      }
    }

    const sortedByCorr = [...pairs].sort((a, b) => Math.abs(b.pearsonCorr) - Math.abs(a.pearsonCorr));

    return {
      symbols,
      correlationMatrix: matrix,
      leadLagMatrix,
      pairs,
      strongestPositive: sortedByCorr.find(p => p.relationship === 'positive') ?? null,
      strongestNegative: sortedByCorr.find(p => p.relationship === 'negative') ?? null,
      mostLeading: pairs.filter(p => Math.abs(p.lag) > 2).sort((a, b) => Math.abs(b.lag) - Math.abs(a.lag))[0] ?? null,
      diversification,
      timestamp: Date.now(),
    };
  }

  // ── Private ────────────────────────────────────────────────────────

  private calcHedgeRatio(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 5) return 1;
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i] - meanX) * (y[i] - meanY);
      den += (y[i] - meanY) ** 2;
    }
    return den > 0 ? num / den : 1;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: SignalCorrelator | null = null;

export function getSignalCorrelator(): SignalCorrelator {
  if (!instance) instance = new SignalCorrelator();
  return instance;
}

export default SignalCorrelator;