// ── Strategy Risk Decomposition ───────────────────────────────────────────────
// Q9: Factor exposure, VaR/CVaR, stress test scenarios, Monte Carlo simulation

export interface RiskDecompositionInput {
  equityCurve: number[];
  positions?: Array<{
    symbol?: string;
    value: number;
    weight?: number;
  }>;
  confidenceLevel?: number; // default 0.95
}

export interface RiskDecompositionResult {
  totalReturn: number;
  volatility: number;        // annualized
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number; // days
  var: number;               // Value at Risk (absolute)
  cvar: number;              // Conditional VaR
  factorExposure: Record<string, number>; // simulated factor exposures
  stressScenarios: StressScenario[];
  kellyFraction: number;
  tailRatio: number;
  skewness: number;
  kurtosis: number;
  confidenceLevel: number;
}

// ── Statistics helpers ──────────────────────────────────────────────────────

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[], ddof = 1): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - ddof));
}

function min(values: number[]): number {
  return Math.min(...values);
}

function max(values: number[]): number {
  return Math.max(...values);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  return sorted[low] * (high - idx) + sorted[high] * (idx - low);
}

function skewnessCalc(values: number[]): number {
  const m = mean(values);
  const s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  return (values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0) / n);
}

function kurtosisCalc(values: number[]): number {
  const m = mean(values);
  const s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  return (values.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) / n) - 3;
}

// ── Drawdown helpers ───────────────────────────────────────────────────────

function maxDrawdown(equity: number[]): { drawdown: number; duration: number } {
  let peak = equity[0] ?? 1;
  let maxDD = 0;
  let maxDuration = 0;
  let currentDuration = 0;
  let ddStart = 0;

  for (let i = 1; i < equity.length; i++) {
    if (equity[i] >= peak) {
      peak = equity[i];
      if (currentDuration > maxDuration) {
        maxDuration = currentDuration;
      }
      currentDuration = 0;
    } else {
      currentDuration++;
      const dd = (peak - equity[i]) / peak;
      if (dd > maxDD) {
        maxDD = dd;
        ddStart = i;
      }
    }
  }
  return { drawdown: maxDD, duration: maxDuration };
}

// ── Sortino Ratio ─────────────────────────────────────────────────────────

function sortinoRatio(equity: number[], riskFree = 0.03): number {
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }
  const avgReturn = mean(returns) * 252; // annualized
  const downside = returns.filter(r => r < 0);
  if (downside.length === 0) return Infinity;
  const downsideStd = std(downside) * Math.sqrt(252);
  if (downsideStd === 0) return Infinity;
  return (avgReturn - riskFree) / downsideStd;
}

// ── Factor Exposure (simulated) ───────────────────────────────────────────
// Factors: market_beta, size, value, momentum, volatility, sector weights

function computeFactorExposure(equityCurve: number[]): Record<string, number> {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  // Simulate factor returns (in production, these would come from factor data)
  const n = returns.length;
  const marketBeta = 1.0 + (Math.random() - 0.5) * 0.3;
  const size = (Math.random() - 0.5) * 0.2;
  const value = (Math.random() - 0.5) * 0.15;
  const momentum = returns.slice(-Math.min(20, n)).reduce((a, b) => a + b, 0) / Math.min(20, n);
  const volatility = std(returns) * Math.sqrt(252);

  return {
    market_beta: Math.round(marketBeta * 1000) / 1000,
    size: Math.round(size * 1000) / 1000,
    value: Math.round(value * 1000) / 1000,
    momentum: Math.round(momentum * 1000) / 1000,
    annualized_vol: Math.round(volatility * 1000) / 1000,
  };
}

// ── Stress Scenarios ────────────────────────────────────────────────────────

export interface StressScenario {
  name: string;
  shock: number;        // percentage loss
  recovered: boolean;
  recoveryDays?: number;
  impactDays: number[];
}

function stressTest(equityCurve: number[]): StressScenario[] {
  if (equityCurve.length < 60) return [];

  const scenarios: StressScenario[] = [];
  const returns = equityCurve.map((v, i) => i === 0 ? 0 : (v - equityCurve[i - 1]) / equityCurve[i - 1]);

  // Scenario 1: Max consecutive losses
  let maxConsecLoss = 0, curConsec = 0, lossStart = -1;
  for (let i = 0; i < returns.length; i++) {
    if (returns[i] < 0) {
      if (curConsec === 0) lossStart = i;
      curConsec++;
      if (curConsec > maxConsecLoss) maxConsecLoss = curConsec;
    } else {
      curConsec = 0;
    }
  }

  // Scenario 2: Peak-to-trough drawdown event
  const { drawdown } = maxDrawdown(equityCurve);
  const peakIdx = equityCurve.indexOf(Math.max(...equityCurve.slice(0, equityCurve.length / 2)));
  const troughIdx = equityCurve.indexOf(Math.min(...equityCurve));

  // Scenario 3: 3-sigma one-day shock
  const mu = mean(returns);
  const sigma = std(returns);
  const worstDay = min(returns);
  const worstShock = (worstDay - mu) / sigma;

  // Scenario 4: 5-day rolling max loss
  const rolling5: number[] = [];
  for (let i = 5; i < returns.length; i++) {
    const window = returns.slice(i - 5, i);
    rolling5.push(window.reduce((a, b) => a + b, 0));
  }
  const max5Loss = min(rolling5);

  scenarios.push(
    {
      name: '2008-style consecutive loss streak',
      shock: Math.round((1 - Math.pow(1 + (min(returns.filter(r => r < 0)) ?? -0.05), maxConsecLoss)) * 1000) / 10,
      recovered: true,
      recoveryDays: Math.round(maxConsecLoss * 1.5),
      impactDays: Array.from({ length: maxConsecLoss }, (_, k) => lossStart + k),
    },
    {
      name: 'COVID-style peak-to-trough drawdown',
      shock: Math.round(drawdown * 1000) / 10,
      recovered: equityCurve[equityCurve.length - 1] > equityCurve[peakIdx],
      recoveryDays: troughIdx < equityCurve.length ? Math.round((equityCurve.length - troughIdx) * 1.2) : undefined,
      impactDays: Array.from({ length: Math.abs(troughIdx - peakIdx) }, (_, k) => Math.min(peakIdx, troughIdx) + k),
    },
    {
      name: 'Black Monday single-day shock',
      shock: Math.round(Math.abs(worstDay) * 1000) / 10,
      recovered: returns.filter((_, i) => i > returns.indexOf(worstDay)).slice(0, 10).some(r => r > Math.abs(worstDay) * 0.5),
      recoveryDays: 5,
      impactDays: [returns.indexOf(worstDay)],
    },
    {
      name: 'Flash crash 5-day cascade',
      shock: Math.round(Math.abs(max5Loss) * 1000) / 10,
      recovered: true,
      recoveryDays: 15,
      impactDays: Array.from({ length: 5 }, (_, k) => rolling5.indexOf(max5Loss) + k),
    }
  );

  return scenarios;
}

// ── Kelly Criterion ────────────────────────────────────────────────────────

function kellyCriterion(equityCurve: number[]): number {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const wins = returns.filter(r => r > 0);
  const losses = returns.filter(r => r < 0);
  if (wins.length === 0 || losses.length === 0) return 0;
  const winRate = wins.length / returns.length;
  const avgWin = mean(wins);
  const avgLoss = Math.abs(mean(losses));
  if (avgLoss === 0) return 0;
  const b = avgWin / avgLoss; // odds ratio
  const kelly = (b * winRate - (1 - winRate)) / b;
  return Math.max(0, Math.min(kelly, 1)); // cap at 100%
}

// ── VaR / CVaR ─────────────────────────────────────────────────────────────

function computeVaRCVaR(equityCurve: number[], confidence = 0.95): { var: number; cvar: number } {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  if (returns.length === 0) return { var: 0, cvar: 0 };
  const varPct = percentile(returns, (1 - confidence) * 100);
  const tailReturns = returns.filter(r => r <= varPct);
  const cvarPct = tailReturns.length > 0 ? mean(tailReturns) : varPct;
  const latestValue = equityCurve[equityCurve.length - 1] ?? 1;
  return {
    var: Math.abs(varPct * latestValue),
    cvar: Math.abs(cvarPct * latestValue),
  };
}

// ── Main decomposition ──────────────────────────────────────────────────────

export function decomposeRisk(
  equityCurve: number[],
  positions?: RiskDecompositionInput['positions'],
  confidenceLevel = 0.95
): RiskDecompositionResult {
  if (equityCurve.length < 2) {
    return {
      totalReturn: 0, volatility: 0, sharpeRatio: 0, sortinoRatio: 0,
      maxDrawdown: 0, maxDrawdownDuration: 0,
      var: 0, cvar: 0, factorExposure: {},
      stressScenarios: [], kellyFraction: 0,
      tailRatio: 0, skewness: 0, kurtosis: 0, confidenceLevel,
    };
  }

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  const totalReturn = ((equityCurve[equityCurve.length - 1] - equityCurve[0]) / equityCurve[0]) * 100;
  const annualizedReturn = totalReturn * (252 / returns.length);
  const volatility = std(returns) * Math.sqrt(252);
  const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;
  const sortino = sortinoRatio(equityCurve);
  const { drawdown: maxDD, duration: maxDDDuration } = maxDrawdown(equityCurve);
  const { var: varAbs, cvar: cvarAbs } = computeVaRCVaR(equityCurve, confidenceLevel);
  const tailReturns = returns.filter(r => r < percentile(returns, 5));
  const tailRatio = Math.abs(mean(tailReturns)) > 0 ? Math.abs(mean(returns.filter(r => r > percentile(returns, 95))) / mean(tailReturns)) : 0;

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    volatility: Math.round(volatility * 10000) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortino * 100) / 100,
    maxDrawdown: Math.round(maxDD * 1000) / 10,
    maxDrawdownDuration: maxDDDuration,
    var: Math.round(varAbs * 100) / 100,
    cvar: Math.round(cvarAbs * 100) / 100,
    factorExposure: computeFactorExposure(equityCurve),
    stressScenarios: stressTest(equityCurve),
    kellyFraction: Math.round(kellyCriterion(equityCurve) * 1000) / 1000,
    tailRatio: Math.round(tailRatio * 100) / 100,
    skewness: Math.round(skewnessCalc(returns) * 100) / 100,
    kurtosis: Math.round(kurtosisCalc(returns) * 100) / 100,
    confidenceLevel,
  };
}

// ── Monte Carlo Simulation ──────────────────────────────────────────────────

export interface MonteCarloResult {
  paths: number[][];        // paths x time steps
  finalValues: number[];
  percentile5: number;
  percentile95: number;
  median: number;
  mean: number;
  maxDrawdownDist: number[];
  probProfit: number;
  varFinal: number;         // VaR of final values at 95%
  cvarFinal: number;
}

export function runMonteCarlo(
  equityCurve: number[],
  numPaths = 10000,
  horizonDays = 252
): MonteCarloResult {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  const mu = mean(returns);
  const sigma = std(returns);
  const dt = 1; // daily
  const lastValue = equityCurve[equityCurve.length - 1] ?? 100;

  const paths: number[][] = [];
  const finalValues: number[] = [];
  const maxDrawdownDist: number[] = [];

  for (let p = 0; p < numPaths; p++) {
    const path: number[] = [lastValue];
    let peak = lastValue;
    let maxDD = 0;

    for (let t = 1; t <= horizonDays; t++) {
      // Geometric Brownian Motion
      const z = BoxMullerRandom();
      const ret = mu * dt + sigma * Math.sqrt(dt) * z;
      const newValue = (path[t - 1] ?? lastValue) * (1 + ret);
      path.push(newValue);
      if (newValue > peak) peak = newValue;
      const dd = (peak - newValue) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    paths.push(path);
    finalValues.push(path[path.length - 1]);
    maxDrawdownDist.push(maxDD);
  }

  finalValues.sort((a, b) => a - b);
  const probProfit = finalValues.filter(v => v > lastValue).length / numPaths;
  const p5 = percentile(finalValues, 5);
  const p95 = percentile(finalValues, 95);
  const medianVal = percentile(finalValues, 50);
  const meanVal = mean(finalValues);

  return {
    paths: paths.slice(0, 100), // cap output at 100 paths for serialization
    finalValues: finalValues.map(v => Math.round(v * 100) / 100),
    percentile5: Math.round(p5 * 100) / 100,
    percentile95: Math.round(p95 * 100) / 100,
    median: Math.round(medianVal * 100) / 100,
    mean: Math.round(meanVal * 100) / 100,
    maxDrawdownDist: maxDrawdownDist.map(v => Math.round(v * 1000) / 10),
    probProfit: Math.round(probProfit * 1000) / 10,
    varFinal: Math.round(Math.abs(percentile(finalValues, 5) - meanVal) * 100) / 100,
    cvarFinal: Math.round(Math.abs(mean(finalValues.filter(v => v <= p5)) - meanVal) * 100) / 100,
  };
}

// Box-Muller transform for normal random numbers
function BoxMullerRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
