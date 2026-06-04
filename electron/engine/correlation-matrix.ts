// ── Correlation Matrix Engine ─────────────────────────────────────────────
// Q2: Strategy/Symbol Correlation Matrix for portfolio diversification
// Computes pairwise Pearson correlation from equity curves (daily returns)
// Output: matrix, clustered ordering, and diversification score

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EquityPoint {
  time: number;   // unix ms timestamp
  value: number;  // equity value
}

export interface CorrelationEntry {
  idA: string;
  idB: string;
  corr: number;   // Pearson correlation -1 to 1
  avgReturnA: number;
  avgReturnB: number;
}

export interface CorrelationMatrixResult {
  ids: string[];           // ordered list of strategy/symbol IDs
  matrix: number[][];       // N×N symmetric correlation matrix
  entries: CorrelationEntry[];
  diversificationScore: number;  // avg pairwise correlation (lower = better)
  minCorrelation: number;       // most uncorrelated pair
  maxCorrelation: number;        // most correlated pair (risk concentration)
}

// ── Helper: Pearson Correlation ─────────────────────────────────────────────

function pearsonCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;   // need at least 5 data points

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

// ── Helper: Equity → Daily Returns ─────────────────────────────────────────

function toDailyReturns(curve: EquityPoint[]): number[] {
  if (curve.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].value;
    const curr = curve[i].value;
    if (prev !== 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

// ── Helper: Average Return ──────────────────────────────────────────────────

function avgReturn(curve: EquityPoint[]): number {
  const rets = toDailyReturns(curve);
  if (rets.length === 0) return 0;
  return rets.reduce((a, b) => a + b, 0) / rets.length;
}

// ── Helper: Align curves to common timestamps ───────────────────────────────

function alignCurves(
  curves: Map<string, EquityPoint[]>
): Map<string, number[]> {
  const aligned = new Map<string, number[]>();
  // Get all unique timestamps (daily buckets)
  const allTimes = new Set<number>();
  for (const curve of curves.values()) {
    for (const pt of curve) {
      // Normalize to day (floor to 86400000 ms)
      const day = Math.floor(pt.time / 86400000) * 86400000;
      allTimes.add(day);
    }
  }
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
  const timeIndex = new Map(sortedTimes.map((t, i) => [t, i]));

  for (const [id, curve] of curves) {
    const dailyVals: number[] = new Array(sortedTimes.length).fill(0);
    for (const pt of curve) {
      const day = Math.floor(pt.time / 86400000) * 86400000;
      const idx = timeIndex.get(day);
      if (idx !== undefined) dailyVals[idx] = pt.value;
    }
    // Forward-fill zeros
    let last = 0;
    for (let i = 0; i < dailyVals.length; i++) {
      if (dailyVals[i] !== 0) last = dailyVals[i];
      else dailyVals[i] = last;
    }
    aligned.set(id, dailyVals);
  }
  return aligned;
}

// ── Main: Compute Correlation Matrix ───────────────────────────────────────

export function computeCorrelationMatrix(
  inputs: { id: string; equityCurve: EquityPoint[] }[]
): CorrelationMatrixResult {
  log.info('[CorrelationMatrix] Computing for', inputs.length, 'strategies');

  if (inputs.length === 0) {
    return { ids: [], matrix: [], entries: [], diversificationScore: 0, minCorrelation: 0, maxCorrelation: 0 };
  }
  if (inputs.length === 1) {
    return {
      ids: [inputs[0].id],
      matrix: [[1]],
      entries: [],
      diversificationScore: 0,
      minCorrelation: 0,
      maxCorrelation: 1,
    };
  }

  // Step 1: Build daily-aligned value arrays
  const curvesMap = new Map(inputs.map(i => [i.id, i.equityCurve]));
  const aligned = alignCurves(curvesMap);

  // Step 2: Convert to return series
  const returnSeries = new Map<string, number[]>();
  for (const [id, vals] of aligned) {
    const rets = toDailyReturns(vals.map((v, i) => ({ time: i * 86400000, value: v })));
    returnSeries.set(id, rets);
  }

  // Step 3: Compute N×N correlation matrix
  const ids = inputs.map(i => i.id);
  const n = ids.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
  const entries: CorrelationEntry[] = [];

  let sumCorr = 0;
  let minCorr = 1;
  let maxCorr = -1;
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s1 = returnSeries.get(ids[i]) ?? [];
      const s2 = returnSeries.get(ids[j]) ?? [];
      const corr = pearsonCorr(s1, s2);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
      const avgA = avgReturn(inputs[i].equityCurve);
      const avgB = avgReturn(inputs[j].equityCurve);
      entries.push({ idA: ids[i], idB: ids[j], corr, avgReturnA: avgA, avgReturnB: avgB });
      sumCorr += Math.abs(corr);
      pairCount++;
      if (corr < minCorr) minCorr = corr;
      if (corr > maxCorr) maxCorr = corr;
    }
  }

  const diversificationScore = pairCount > 0
    ? Math.round((1 - sumCorr / pairCount) * 1000) / 1000
    : 0;

  log.info(`[CorrelationMatrix] Done. Diversification score: ${diversificationScore} (min=${minCorr}, max=${maxCorr})`);

  return {
    ids,
    matrix,
    entries: entries.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr)),
    diversificationScore,
    minCorrelation: Math.round(minCorr * 1000) / 1000,
    maxCorrelation: Math.round(maxCorr * 1000) / 1000,
  };
}

// ── Quick single-symbol helper ─────────────────────────────────────────────
// Returns correlation to market benchmark (S&P 500 proxy) using same-period data

export function correlationToBenchmark(
  equityCurve: EquityPoint[],
  benchmarkCurve: EquityPoint[]
): number {
  const retsA = toDailyReturns(equityCurve);
  const retsB = toDailyReturns(benchmarkCurve);
  return pearsonCorr(retsA, retsB);
}