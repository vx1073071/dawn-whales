// ── Q12: Stress Tester ────────────────────────────────────────────────────────
// Historical scenario replay + multi-factor shock simulation + VaR/CVaR decomposition
// IPC: risk:stress-test

import log from 'electron-log';

export {};

// ── Types ──────────────────────────────────────────────────────────────────

export interface Scenario {
  name: string;
  startDate: string;      // ISO date
  endDate: string;
  description: string;
  tags: string[];
  // Asset class shock factors (multiplier)
  equities: number;        // e.g. 0.75 = -25%
  bonds: number;          // e.g. 1.10 = +10%
  commodities: number;     // e.g. 0.90 = -10%
  forex: Record<string, number>; // currency shocks (vs USD)
  vixMultiplier: number;  // VIX shock multiplier
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
  beta: number;           // to S&P 500
  assetClass: 'equity' | 'bond' | 'commodity' | 'fx';
  currency: string;
}

export interface StressTestResult {
  scenario: string;
  totalLoss: number;        // absolute loss in portfolio currency
  totalLossPct: number;     // % of portfolio value
  var: number;              // Value at Risk (1-day, 95%)
  cvar: number;             // Conditional VaR (CVaR)
  positions: PositionStressResult[];
  kellyFraction: number;    // Kelly fraction derived from scenario
  recoveryDays: number;      // estimated days to recovery at current run-rate
}

export interface PositionStressResult {
  symbol: string;
  originalMktVal: number;
  stressedMktVal: number;
  loss: number;
  lossPct: number;
  var: number;
}

// ── Built-in Historical Scenarios ────────────────────────────────────────────

export const HISTORICAL_SCENARIOS: Scenario[] = [
  {
    name: '2008 Financial Crisis',
    startDate: '2008-09-01',
    endDate: '2009-03-31',
    description: 'Lehman Brothers collapse, global credit crunch',
    tags: ['credit', 'systemic', 'equities'],
    equities: 0.52,
    bonds: 1.05,
    commodities: 0.75,
    forex: { EUR: 0.85, GBP: 0.80, JPY: 0.95, CNY: 0.92, HKD: 0.98 },
    vixMultiplier: 4.5,
  },
  {
    name: '2020 COVID Crash',
    startDate: '2020-02-01',
    endDate: '2020-03-31',
    description: 'Global pandemic sell-off, fastest bear market in history',
    tags: ['pandemic', 'systemic', 'equities'],
    equities: 0.68,
    bonds: 1.08,
    commodities: 0.80,
    forex: { EUR: 0.98, GBP: 0.95, JPY: 1.02, CNY: 0.98, HKD: 0.99 },
    vixMultiplier: 5.0,
  },
  {
    name: '2022 Market Rout',
    startDate: '2022-01-01',
    endDate: '2022-10-31',
    description: 'Fed rate hikes, inflation peak, tech sell-off',
    tags: ['rate-hike', 'inflation', 'equities'],
    equities: 0.78,
    bonds: 0.88,
    commodities: 1.15,
    forex: { EUR: 0.96, GBP: 0.88, JPY: 0.85, CNY: 0.87, HKD: 1.00 },
    vixMultiplier: 2.5,
  },
  {
    name: '2015 China Deval',
    startDate: '2015-08-11',
    endDate: '2016-02-29',
    description: 'China yuan devaluation, global equity rout',
    tags: ['china', 'fx', 'emerging-markets'],
    equities: 0.85,
    bonds: 0.98,
    commodities: 0.78,
    forex: { EUR: 1.02, GBP: 1.01, JPY: 1.05, CNY: 0.90, HKD: 1.00 },
    vixMultiplier: 2.2,
  },
  {
    name: '2023 Banking Stress',
    startDate: '2023-03-01',
    endDate: '2023-05-31',
    description: 'SVB/Credit Suisse collapse, regional bank crisis',
    tags: ['banking', 'credit', 'bonds'],
    equities: 0.88,
    bonds: 0.92,
    commodities: 0.98,
    forex: { EUR: 1.02, GBP: 1.01, JPY: 1.00, CNY: 0.99, HKD: 1.00 },
    vixMultiplier: 2.8,
  },
];

// ── VaR / CVaR Helpers ───────────────────────────────────────────────────────

function normalVar(pct: number, mu: number, sigma: number): number {
  // 95% or 99% VaR from normal distribution
  const z = pct === 0.95 ? 1.645 : 2.326;
  return -(mu + z * sigma);
}

function historicalVaR(returns: number[], confidence: number): number {
  if (returns.length < 20) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return -sorted[idx];
}

function cVaR(returns: number[], confidence: number): number {
  if (returns.length < 20) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const varIdx = Math.floor((1 - confidence) * sorted.length);
  const tailReturns = sorted.slice(0, varIdx + 1);
  if (tailReturns.length === 0) return 0;
  return -(tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length);
}

// ── Kelly Criterion ─────────────────────────────────────────────────────────

function kellyFromScenario(scenario: Scenario): number {
  // Estimate Kelly fraction from equity shock
  // Kelly = (b*p - q) / b where b=win ratio, p=win prob, q=1-p
  // Simplify: assume 50/50 win/loss, b = 1/(1-shock)
  const shock = 1 - scenario.equities;
  if (shock <= 0) return 0.5;
  const b = 1 / shock;
  const p = 0.4; // rough win probability under stress
  const kelly = (b * p - (1 - p)) / b;
  return Math.max(0, Math.min(1, Math.round(kelly * 1000) / 1000));
}

// ── Asset Class Shocker ──────────────────────────────────────────────────────

function shockAssetClass(
  scenario: Scenario,
  assetClass: PortfolioPosition['assetClass'],
  currency: string
): number {
  let factor: number;
  switch (assetClass) {
    case 'equity':    factor = scenario.equities; break;
    case 'bond':      factor = scenario.bonds; break;
    case 'commodity': factor = scenario.commodities; break;
    case 'fx':        factor = scenario.forex[currency] ?? 1.0; break;
  }
  return factor;
}

// ── Main: Run Stress Test ───────────────────────────────────────────────────

export function runStressTest(
  positions: PortfolioPosition[],
  scenario: Scenario
): StressTestResult {
  log.info('[StressTester] Running stress test for scenario:', scenario.name);

  if (positions.length === 0) {
    return {
      scenario: scenario.name,
      totalLoss: 0, totalLossPct: 0, var: 0, cvar: 0,
      kellyFraction: kellyFromScenario(scenario),
      recoveryDays: 0,
      positions: [],
    };
  }

  const totalMktVal = positions.reduce((s, p) => s + p.marketValue, 0);

  const positionResults: PositionStressResult[] = [];
  let totalLoss = 0;

  for (const pos of positions) {
    const shockFactor = shockAssetClass(scenario, pos.assetClass, pos.currency);
    const stressedMktVal = pos.marketValue * shockFactor;
    const loss = stressedMktVal - pos.marketValue;
    totalLoss += loss;

    // Individual VaR = position * beta * scenario sigma (approx)
    const scenarioSigma = 1 - scenario.equities; // rough vol estimate from shock
    const individualVaR = pos.marketValue * pos.beta * scenarioSigma * 1.645;

    positionResults.push({
      symbol: pos.symbol,
      originalMktVal: Math.round(pos.marketValue * 100) / 100,
      stressedMktVal: Math.round(stressedMktVal * 100) / 100,
      loss: Math.round(loss * 100) / 100,
      lossPct: Math.round(((loss / pos.marketValue) * 10000)) / 100,
      var: Math.round(individualVaR * 100) / 100,
    });
  }

  const totalLossPct = totalMktVal > 0 ? (totalLoss / totalMktVal) * 100 : 0;

  // Aggregate VaR/CVaR
  const var_agg = positions.reduce((s, p) => {
    const sigma = 1 - scenario.equities;
    return s + p.marketValue * p.beta * sigma * 1.645;
  }, 0);

  const cvar_agg = var_agg * 1.3; // CVaR ≈ 1.2-1.4x VaR for normal distributions

  // Recovery days
  const dailyRecoveryRate = 0.008; // ~0.8% per day recovery (historical avg)
  const recoveryDays = Math.abs(totalLossPct) > 0
    ? Math.ceil(Math.abs(totalLossPct) / dailyRecoveryRate)
    : 0;

  log.info(`[StressTester] ${scenario.name}: loss=${totalLoss.toFixed(0)}, VaR=${var_agg.toFixed(0)}`);

  return {
    scenario: scenario.name,
    totalLoss: Math.round(totalLoss * 100) / 100,
    totalLossPct: Math.round(totalLossPct * 100) / 100,
    var: Math.round(var_agg * 100) / 100,
    cvar: Math.round(cvar_agg * 100) / 100,
    positions: positionResults,
    kellyFraction: kellyFromScenario(scenario),
    recoveryDays,
  };
}

// ── Custom Multi-Factor Shock ─────────────────────────────────────────────────

export interface FactorShock {
  factor: string;
  shock: number; // multiplier
  description: string;
}

export function runCustomShock(
  positions: PortfolioPosition[],
  factors: FactorShock[],
  portfolio: { totalValue: number; dailyVol: number }
): StressTestResult {
  log.info('[StressTester] Running custom shock with', factors.length, 'factors');

  const combinedEquityShock = factors
    .filter(f => ['equity', 'market', 'beta'].includes(f.factor))
    .reduce((s, f) => s * f.shock, 1);

  const combinedBondShock = factors
    .filter(f => ['rate', 'bond', 'duration'].includes(f.factor))
    .reduce((s, f) => s * f.shock, 1);

  let totalLoss = 0;
  const positionResults: PositionStressResult[] = [];

  for (const pos of positions) {
    const shockFactor = pos.assetClass === 'bond'
      ? combinedBondShock
      : combinedEquityShock;
    const stressedMktVal = pos.marketValue * shockFactor;
    const loss = stressedMktVal - pos.marketValue;
    totalLoss += loss;

    const individualVaR = pos.marketValue * pos.beta * portfolio.dailyVol * 1.645;
    positionResults.push({
      symbol: pos.symbol,
      originalMktVal: Math.round(pos.marketValue * 100) / 100,
      stressedMktVal: Math.round(stressedMktVal * 100) / 100,
      loss: Math.round(loss * 100) / 100,
      lossPct: Math.round(((loss / pos.marketValue) * 10000)) / 100,
      var: Math.round(individualVaR * 100) / 100,
    });
  }

  const totalLossPct = portfolio.totalValue > 0 ? (totalLoss / portfolio.totalValue) * 100 : 0;
  const var_agg = positions.reduce((s, p) => {
    return s + p.marketValue * p.beta * portfolio.dailyVol * 1.645;
  }, 0);

  return {
    scenario: `Custom (${factors.map(f => `${f.factor}=${f.shock}`).join(', ')})`,
    totalLoss: Math.round(totalLoss * 100) / 100,
    totalLossPct: Math.round(totalLossPct * 100) / 100,
    var: Math.round(var_agg * 100) / 100,
    cvar: Math.round(var_agg * 1.3 * 100) / 100,
    positions: positionResults,
    kellyFraction: Math.max(0, Math.min(1, 1 - Math.abs(totalLossPct) / 100)),
    recoveryDays: Math.ceil(Math.abs(totalLossPct) / 0.8),
  };
}
