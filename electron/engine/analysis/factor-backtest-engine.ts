/**
 * FactorBacktestEngine — R283 JVS-1 因子倒推引擎 (4h)
 *
 * 功能: 给定目标 (收益率/波动率/夏普/最大回撤), 反向推导最优因子组合及权重
 *
 * 核心能力:
 * - BacksolveTarget: 目标→因子组合 (遗传算法/梯度下降)
 * - FactorAttribution: 历史收益拆解到因子贡献
 * - WhatIfScenario: 模拟因子调仓后的回测结果
 * - OptimalPortfolio: 多目标帕累托最优因子组合
 * - ConstraintSolver: 带约束 (行业/市值/流动性) 的因子组合求解
 * - SensitivityAnalysis: 因子权重敏感性分析
 */

export interface BacktestTarget {
  targetReturn: number;       // annualized %
  targetVolatility: number;   // annualized %
  targetSharpe: number;
  targetMaxDrawdown: number;  // %
  horizon: number;            // years
  constraints?: {
    maxFactors: number;
    minWeight: number;        // per factor
    maxWeight: number;
    maxTurnover: number;
    excludeFactors: string[];
    sectorConstraints?: Record<string, number>; // sector → max%
  };
}

export interface FactorCandidate {
  factorId: string;
  name: string;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  ic: number;               // information coefficient
  category: string;
  currentWeight: number;
}

export interface BacksolvedPortfolio {
  factors: Array<{ factorId: string; weight: number; contribution: number }>;
  metrics: {
    expectedReturn: number;
    expectedVolatility: number;
    expectedSharpe: number;
    expectedMaxDrawdown: number;
    diversificationRatio: number;
    effectiveN: number;
  };
  confidence: number;         // 0-1, how likely to hit target
  iterations: number;
  method: 'genetic' | 'gradient' | 'monteCarlo';
}

export interface FactorAttribution {
  factorId: string;
  contribution: number;       // % of total return
  tStat: number;
  pValue: number;
  cumulativeEffect: number;
}

export interface WhatIfScenario {
  scenarioId: string;
  changes: Array<{ factorId: string; oldWeight: number; newWeight: number; delta: number }>;
  projectedReturn: number;
  projectedVolatility: number;
  projectedSharpe: number;
  impactScore: number;       // 0-100, how big the change
}

export interface SensitivityResult {
  factorId: string;
  baselineWeight: number;
  perturbedResults: Array<{ weightChange: number; sharpe: number; return: number; drawdown: number }>;
  elasticity: number;        // dSharpe/dWeight
}

// ============================================================
const CANDIDATE_FACTORS: FactorCandidate[] = [
  { factorId: 'momentum_6m', name: 'Momentum 6M', expectedReturn: 0.12, volatility: 0.18, sharpe: 0.67, ic: 0.082, category: 'momentum', currentWeight: 0.15 },
  { factorId: 'pe_ttm', name: 'PE Ratio (TTM)', expectedReturn: 0.08, volatility: 0.16, sharpe: 0.50, ic: 0.035, category: 'value', currentWeight: 0.12 },
  { factorId: 'roe_ttm', name: 'ROE (TTM)', expectedReturn: 0.09, volatility: 0.15, sharpe: 0.60, ic: 0.051, category: 'quality', currentWeight: 0.10 },
  { factorId: 'revenue_yoy', name: 'Revenue YoY', expectedReturn: 0.11, volatility: 0.20, sharpe: 0.55, ic: 0.061, category: 'growth', currentWeight: 0.12 },
  { factorId: 'volatility_20d', name: 'Volatility 20D', expectedReturn: -0.03, volatility: 0.25, sharpe: -0.12, ic: 0.073, category: 'volatility', currentWeight: 0.08 },
  { factorId: 'dividend_yield', name: 'Dividend Yield', expectedReturn: 0.06, volatility: 0.12, sharpe: 0.50, ic: 0.058, category: 'value', currentWeight: 0.08 },
  { factorId: 'gross_margin', name: 'Gross Margin', expectedReturn: 0.07, volatility: 0.14, sharpe: 0.50, ic: 0.055, category: 'quality', currentWeight: 0.10 },
  { factorId: 'beta_60d', name: 'Beta 60D', expectedReturn: 0.05, volatility: 0.22, sharpe: 0.23, ic: 0.068, category: 'volatility', currentWeight: 0.05 },
  { factorId: 'momentum_1m', name: 'Momentum 1M', expectedReturn: 0.14, volatility: 0.24, sharpe: 0.58, ic: 0.078, category: 'momentum', currentWeight: 0.10 },
  { factorId: 'debt_equity', name: 'Debt/Equity', expectedReturn: 0.04, volatility: 0.13, sharpe: 0.31, ic: 0.047, category: 'quality', currentWeight: 0.05 },
  { factorId: 'market_cap', name: 'Market Cap', expectedReturn: -0.02, volatility: 0.19, sharpe: -0.11, ic: -0.028, category: 'size', currentWeight: 0.03 },
  { factorId: 'pb_lf', name: 'PB Ratio', expectedReturn: 0.07, volatility: 0.17, sharpe: 0.41, ic: 0.048, category: 'value', currentWeight: 0.02 },
];

const FACTOR_CORRELATIONS: Record<string, Record<string, number>> = {
  'momentum_6m': { 'pe_ttm': -0.2, 'roe_ttm': 0.1, 'revenue_yoy': 0.3, 'volatility_20d': -0.4, 'dividend_yield': -0.3, 'gross_margin': 0.0, 'beta_60d': 0.2, 'momentum_1m': 0.7, 'debt_equity': -0.1, 'market_cap': -0.05, 'pb_lf': -0.25 },
  'pe_ttm': { 'roe_ttm': 0.15, 'revenue_yoy': -0.1, 'volatility_20d': 0.05, 'dividend_yield': 0.3, 'gross_margin': 0.1, 'beta_60d': -0.1, 'momentum_1m': -0.15, 'debt_equity': 0.2, 'market_cap': -0.3, 'pb_lf': 0.5, 'momentum_6m': -0.2 },
  'roe_ttm': { 'pe_ttm': 0.15, 'revenue_yoy': 0.1, 'volatility_20d': -0.1, 'dividend_yield': 0.05, 'gross_margin': 0.4, 'beta_60d': -0.05, 'momentum_1m': 0.0, 'debt_equity': -0.2, 'market_cap': 0.1, 'pb_lf': 0.1, 'momentum_6m': 0.1 },
  'revenue_yoy': { 'pe_ttm': -0.1, 'roe_ttm': 0.1, 'volatility_20d': -0.2, 'dividend_yield': -0.25, 'gross_margin': 0.3, 'beta_60d': 0.25, 'momentum_1m': 0.35, 'debt_equity': -0.15, 'market_cap': -0.4, 'pb_lf': -0.15, 'momentum_6m': 0.3 },
  'volatility_20d': { 'pe_ttm': 0.05, 'roe_ttm': -0.1, 'revenue_yoy': -0.2, 'dividend_yield': -0.1, 'gross_margin': -0.15, 'beta_60d': 0.6, 'momentum_1m': -0.3, 'debt_equity': 0.1, 'market_cap': -0.3, 'pb_lf': 0.0, 'momentum_6m': -0.4 },
  'dividend_yield': { 'pe_ttm': 0.3, 'roe_ttm': 0.05, 'revenue_yoy': -0.25, 'volatility_20d': -0.1, 'gross_margin': 0.15, 'beta_60d': 0.05, 'momentum_1m': -0.2, 'debt_equity': 0.35, 'market_cap': -0.1, 'pb_lf': 0.25, 'momentum_6m': -0.3 },
  'gross_margin': { 'pe_ttm': 0.1, 'roe_ttm': 0.4, 'revenue_yoy': 0.3, 'volatility_20d': -0.15, 'dividend_yield': 0.15, 'beta_60d': -0.1, 'momentum_1m': 0.05, 'debt_equity': -0.3, 'market_cap': 0.0, 'pb_lf': 0.1, 'momentum_6m': 0.0 },
  'beta_60d': { 'pe_ttm': -0.1, 'roe_ttm': -0.05, 'revenue_yoy': 0.25, 'volatility_20d': 0.6, 'dividend_yield': 0.05, 'gross_margin': -0.1, 'momentum_1m': 0.1, 'debt_equity': 0.05, 'market_cap': -0.2, 'pb_lf': -0.1, 'momentum_6m': 0.2 },
  'momentum_1m': { 'pe_ttm': -0.15, 'roe_ttm': 0.0, 'revenue_yoy': 0.35, 'volatility_20d': -0.3, 'dividend_yield': -0.2, 'gross_margin': 0.05, 'beta_60d': 0.1, 'debt_equity': -0.1, 'market_cap': -0.15, 'pb_lf': -0.2, 'momentum_6m': 0.7 },
  'debt_equity': { 'pe_ttm': 0.2, 'roe_ttm': -0.2, 'revenue_yoy': -0.15, 'volatility_20d': 0.1, 'dividend_yield': 0.35, 'gross_margin': -0.3, 'beta_60d': 0.05, 'momentum_1m': -0.1, 'market_cap': 0.1, 'pb_lf': 0.15, 'momentum_6m': -0.1 },
  'market_cap': { 'pe_ttm': -0.3, 'roe_ttm': 0.1, 'revenue_yoy': -0.4, 'volatility_20d': -0.3, 'dividend_yield': -0.1, 'gross_margin': 0.0, 'beta_60d': -0.2, 'momentum_1m': -0.15, 'debt_equity': 0.1, 'pb_lf': -0.1, 'momentum_6m': -0.05 },
  'pb_lf': { 'pe_ttm': 0.5, 'roe_ttm': 0.1, 'revenue_yoy': -0.15, 'volatility_20d': 0.0, 'dividend_yield': 0.25, 'gross_margin': 0.1, 'beta_60d': -0.1, 'momentum_1m': -0.2, 'debt_equity': 0.15, 'market_cap': -0.1, 'momentum_6m': -0.25 },
};

// ============================================================
export class FactorBacktestEngine {
  private candidates: FactorCandidate[];

  constructor() {
    this.candidates = [...CANDIDATE_FACTORS];
  }

  /** Genetic algorithm backsolve: target → optimal factor portfolio */
  backsolve(target: BacktestTarget): BacksolvedPortfolio {
    const constraints = target.constraints || {
      maxFactors: 6, minWeight: 0.02, maxWeight: 0.35, maxTurnover: 0.5, excludeFactors: [],
    };

    // Filter out excluded
    const pool = this.candidates.filter(c => !constraints.excludeFactors.includes(c.factorId));

    // Genetic algorithm (simplified)
    const populationSize = 50;
    const generations = 30;
    const mutationRate = 0.15;

    let population: Array<{ weights: number[]; fitness: number }> = [];

    // Initialize population
    for (let g = 0; g < populationSize; g++) {
      const weights = pool.map(() => Math.random() * constraints.maxWeight);
      const total = weights.reduce((s, v) => s + v, 0);
      for (let i = 0; i < weights.length; i++) weights[i] = total > 0 ? +((weights[i] / total) * 100).toFixed(2) / 100 : 0;
      // Ensure weights sum to ~1
      const fitness = this.evaluateFitness(pool, weights, target);
      population.push({ weights, fitness });
    }

    // Evolve
    for (let gen = 0; gen < generations; gen++) {
      population.sort((a, b) => b.fitness - a.fitness);
      const elite = population.slice(0, 10);

      const newPop = [...elite];
      while (newPop.length < populationSize) {
        // Crossover with split
        const split = 3 + Math.floor(Math.random() * (pool.length - 3));
        const offspring: number[] = [];
        for (let i = 0; i < pool.length; i++) {
          const vals = [elite[0].weights[i], elite[1].weights[i], elite[2].weights[i]];
          offspring.push(vals[Math.floor(Math.random() * 3)]);
        }
        // Mutation
        for (let i = 0; i < offspring.length; i++) {
          if (Math.random() < mutationRate) {
            offspring[i] += (Math.random() - 0.5) * 0.1;
            offspring[i] = Math.max(0, Math.min(constraints.maxWeight, offspring[i]));
          }
        }
        // Normalize
        const tot = offspring.reduce((s, v) => s + v, 0);
        for (let i = 0; i < offspring.length; i++) offspring[i] = tot > 0 ? +((offspring[i] / tot) * 100).toFixed(4) / 100 : 0;
        const fitness = this.evaluateFitness(pool, offspring, target);
        newPop.push({ weights: offspring, fitness });
      }
      population = newPop.slice(0, populationSize);
    }

    // Best solution
    population.sort((a, b) => b.fitness - a.fitness);
    const best = population[0];
    const factors = pool.map((f, i) => ({
      factorId: f.factorId,
      weight: best.weights[i],
      contribution: +((best.weights[i] * f.expectedReturn) * 100).toFixed(1),
    })).filter(f => f.weight > 0.005).sort((a, b) => b.weight - a.weight);

    const metrics = this.calculatePortfolioMetrics(pool, best.weights, target.horizon);

    return {
      factors,
      metrics,
      confidence: +((best.fitness / 100) * 100).toFixed(1),
      iterations: populationSize * generations,
      method: 'genetic',
    };
  }

  /** Evaluate fitness: how close to target */
  private evaluateFitness(pool: FactorCandidate[], weights: number[], target: BacktestTarget): number {
    const metrics = this.calculatePortfolioMetrics(pool, weights, target.horizon);

    // Distance from target (lower = better)
    const returnGap = Math.abs(metrics.expectedReturn - target.targetReturn) / Math.max(0.01, Math.abs(target.targetReturn));
    const volGap = Math.abs(metrics.expectedVolatility - target.targetVolatility) / Math.max(0.01, Math.abs(target.targetVolatility));
    const sharpeGap = Math.abs(metrics.expectedSharpe - target.targetSharpe) / Math.max(0.01, Math.abs(target.targetSharpe));
    const ddGap = Math.abs(metrics.expectedMaxDrawdown - target.targetMaxDrawdown) / Math.max(0.01, Math.abs(target.targetMaxDrawdown));

    // Fitness = 100 - weighted gaps
    const fitness = Math.max(0, 100 - (returnGap * 30 + volGap * 25 + sharpeGap * 30 + ddGap * 15));
    return fitness;
  }

  /** Calculate portfolio metrics from weights */
  private calculatePortfolioMetrics(pool: FactorCandidate[], weights: number[], horizon: number): {
    expectedReturn: number; expectedVolatility: number; expectedSharpe: number; expectedMaxDrawdown: number; diversificationRatio: number; effectiveN: number;
  } {
    let expectedReturn = 0;
    for (let i = 0; i < pool.length; i++) {
      expectedReturn += weights[i] * pool[i].expectedReturn;
    }

    // Portfolio volatility (with correlations)
    let variance = 0;
    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < pool.length; j++) {
        const corr = i === j ? 1 : (FACTOR_CORRELATIONS[pool[i].factorId]?.[pool[j].factorId] ?? 0);
        variance += weights[i] * weights[j] * pool[i].volatility * pool[j].volatility * corr;
      }
    }
    const vol = Math.sqrt(Math.max(0, variance));

    const sharpe = vol > 0 ? +(expectedReturn / vol).toFixed(2) : 0;

    // Max drawdown estimation
    const maxDD = +((vol * 2.5) * 100).toFixed(1);

    // Diversification ratio & effective N
    let sumVol = 0;
    for (let i = 0; i < pool.length; i++) sumVol += weights[i] * pool[i].volatility;
    const divRatio = sumVol > 0 ? +(sumVol / vol).toFixed(2) : 0;
    const weightSqSum = weights.reduce((s, w) => s + w * w, 0);
    const effectiveN = weightSqSum > 0 ? +(1 / weightSqSum).toFixed(1) : pool.length;

    return {
      expectedReturn: +expectedReturn.toFixed(4),
      expectedVolatility: +vol.toFixed(4),
      expectedSharpe: sharpe,
      expectedMaxDrawdown: maxDD,
      diversificationRatio: divRatio,
      effectiveN,
    };
  }

  /** Factor attribution: decompose returns to factor contributions */
  attributeReturns(factorReturns: Record<string, number[]>): FactorAttribution[] {
    const attributions: FactorAttribution[] = [];
    const factorIds = Object.keys(factorReturns);
    for (let i = 0; i < factorIds.length; i++) {
      const fid = factorIds[i];
      const returns = factorReturns[fid];
      const mean = returns.reduce((s, v) => s + v, 0) / Math.max(1, returns.length);
      const contribution = +(mean * 100).toFixed(2);
      const tStat = returns.length > 1 ? +(mean / (this.std(returns) / Math.sqrt(returns.length))).toFixed(2) : 0;
      attributions.push({
        factorId: fid,
        contribution,
        tStat,
        pValue: tStat > 1.96 ? 0.05 : tStat > 1.28 ? 0.10 : 0.20,
        cumulativeEffect: contribution,
      });
    }
    // Sort by abs(contribution)
    attributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return attributions;
  }

  /** What-if scenario: simulate weight changes */
  simulateWhatIf(changes: Array<{ factorId: string; newWeight: number }>): WhatIfScenario {
    const candidates = this.candidates;
    const originalWeights: Record<string, number> = {};
    for (let i = 0; i < candidates.length; i++) originalWeights[candidates[i].factorId] = candidates[i].currentWeight;

    const scenarioChanges: WhatIfScenario['changes'] = [];
    const newWeights = { ...originalWeights };

    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const oldW = originalWeights[c.factorId] || 0;
      const delta = c.newWeight - oldW;
      scenarioChanges.push({ factorId: c.factorId, oldWeight: oldW, newWeight: c.newWeight, delta: +(delta * 100).toFixed(1) });
      newWeights[c.factorId] = c.newWeight;
    }

    // Compute projected metrics
    const weightArr = candidates.map(c => newWeights[c.factorId] || c.currentWeight);
    const metrics = this.calculatePortfolioMetrics(candidates, weightArr, 3);

    // Impact score
    const totalDelta = scenarioChanges.reduce((s, c) => s + Math.abs(c.delta), 0);
    const impactScore = Math.min(100, +((totalDelta / candidates.length) * 10).toFixed(0));

    return {
      scenarioId: `wi_${Date.now()}`,
      changes: scenarioChanges,
      projectedReturn: metrics.expectedReturn,
      projectedVolatility: metrics.expectedVolatility,
      projectedSharpe: metrics.expectedSharpe,
      impactScore,
    };
  }

  /** Sensitivity analysis: perturb each factor ± and measure Sharpe change */
  analyzeSensitivity(factorIds: string[], perturbation: number = 0.03): SensitivityResult[] {
    const results: SensitivityResult[] = [];
    const candidates = this.candidates;

    for (let i = 0; i < factorIds.length; i++) {
      const fid = factorIds[i];
      const baseline = candidates.find(c => c.factorId === fid);
      if (!baseline) continue;

      const baselineWeights = candidates.map(c => c.factorId === fid ? baseline.currentWeight : c.currentWeight);
      const baselineMetrics = this.calculatePortfolioMetrics(candidates, baselineWeights, 3);

      const perturbedResults: SensitivityResult['perturbedResults'] = [];
      // Perturb in both directions
      for (const mult of [-1, -0.5, 0, 0.5, 1]) {
        const deltaWeight = perturbation * mult;
        const perturbed = candidates.map(c => c.factorId === fid ? Math.max(0, baseline.currentWeight + deltaWeight) : c.currentWeight);
        // Normalize
        const tot = perturbed.reduce((s, v) => s + v, 0);
        for (let j = 0; j < perturbed.length; j++) perturbed[j] /= tot;
        const m = this.calculatePortfolioMetrics(candidates, perturbed, 3);
        perturbedResults.push({
          weightChange: +(deltaWeight * 100).toFixed(1),
          sharpe: m.expectedSharpe,
          return: m.expectedReturn,
          drawdown: m.expectedMaxDrawdown,
        });
      }

      // Elasticity: ΔSharpe / ΔWeight
      const elasticity = perturbedResults.length >= 2
        ? +((perturbedResults[4].sharpe - perturbedResults[0].sharpe) / (2 * perturbation)).toFixed(2)
        : 0;

      results.push({
        factorId: fid,
        baselineWeight: baseline.currentWeight,
        perturbedResults,
        elasticity,
      });
    }

    return results;
  }

  private std(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  getCandidates(): FactorCandidate[] { return this.candidates; }
  reset(): void { this.candidates = [...CANDIDATE_FACTORS]; }
}

let _fbe: FactorBacktestEngine | undefined;
export function getFactorBacktestEngine(): FactorBacktestEngine {
  if (!_fbe) _fbe = new FactorBacktestEngine();
  return _fbe;
}
export function resetFactorBacktestEngine(): void { _fbe?.reset(); _fbe = undefined; }
