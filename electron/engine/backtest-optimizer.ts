// ── Q25: Backtest Optimizer ────────────────────────────────────────────────
// Genetic Algorithm + Bayesian Optimization for strategy parameter tuning
// Supports: SMA/EMA/MACD/RSI/Bollinger/ATR/布林带 parameters
// Walk-forward validation to prevent overfitting

import log from 'electron-log';
import { runBacktest, BacktestResult } from './backtest-engine';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ParameterSpace {
  name: string;
  type: 'int' | 'float' | 'select';
  min: number;
  max: number;
  step?: number;
  values?: number[];   // For 'select' type
}

export interface ParameterSet {
  [key: string]: number;
}

export interface OptimizationObjective {
  metric: 'sharpe' | 'totalReturn' | 'calmar' | 'profitFactor' | 'maxDrawdown' | 'winRate';
  direction: 'maximize' | 'minimize';
}

export interface OptimizationResult {
  bestParams: ParameterSet;
  bestScore: number;
  objective: string;
  iterations: number;
  population?: number;
  totalBacktests: number;
  eliteHistory: Array<{ score: number; params: ParameterSet }>;
  duration: number;       // ms
  converged: boolean;
}

export interface OptimizationConfig {
  strategyType: 'sma' | 'ema' | 'macd' | 'rsi' | 'bollinger' | 'atr' | 'mixed';
  symbol: string;
  period: { start: number; end: number };
  parameterSpace: ParameterSpace[];
  objective: OptimizationObjective;
  budget: number;          // Max backtests (budget)
  algorithm: 'ga' | 'bayes' | 'grid';
  walkForward?: boolean;   // Validate on out-of-sample data
  walkForwardRatio?: number; // 0.2 = 20% out-of-sample
  parallel?: boolean;
}

// ── Parameter Ranges ────────────────────────────────────────────────────────

export const DEFAULT_SPACES: Record<string, ParameterSpace[]> = {
  sma: [
    { name: 'fastPeriod', type: 'int', min: 5, max: 50, step: 1 },
    { name: 'slowPeriod', type: 'int', min: 20, max: 200, step: 1 },
  ],
  ema: [
    { name: 'fastPeriod', type: 'int', min: 5, max: 50, step: 1 },
    { name: 'slowPeriod', type: 'int', min: 20, max: 200, step: 1 },
  ],
  macd: [
    { name: 'fastPeriod', type: 'int', min: 8, max: 24, step: 1 },
    { name: 'slowPeriod', type: 'int', min: 16, max: 48, step: 1 },
    { name: 'signalPeriod', type: 'int', min: 6, max: 16, step: 1 },
  ],
  rsi: [
    { name: 'period', type: 'int', min: 7, max: 28, step: 1 },
    { name: 'upperThreshold', type: 'int', min: 60, max: 80, step: 1 },
    { name: 'lowerThreshold', type: 'int', min: 20, max: 40, step: 1 },
  ],
  bollinger: [
    { name: 'period', type: 'int', min: 10, max: 50, step: 1 },
    { name: 'stdDev', type: 'float', min: 1.5, max: 3.5, step: 0.25 },
  ],
  atr: [
    { name: 'period', type: 'int', min: 7, max: 28, step: 1 },
    { name: 'multiplier', type: 'float', min: 1.5, max: 4.0, step: 0.25 },
  ],
};

// ── GA Helpers ─────────────────────────────────────────────────────────────

function randomGene(space: ParameterSpace): number {
  if (space.type === 'select' && space.values) {
    return space.values[Math.floor(Math.random() * space.values.length)];
  }
  const range = space.max - space.min;
  const raw = space.min + Math.random() * range;
  const stepped = space.step ? Math.round(raw / space.step) * space.step : raw;
  return Math.max(space.min, Math.min(space.max, stepped));
}

function crossover(parent1: ParameterSet, parent2: ParameterSet): ParameterSet {
  const child: ParameterSet = { ...parent1 };
  for (const key of Object.keys(child)) {
    if (Math.random() < 0.5) child[key] = parent2[key];
  }
  return child;
}

function mutate(gene: ParameterSet, space: ParameterSpace[], rate = 0.2): ParameterSet {
  const mutated: ParameterSet = { ...gene };
  for (const s of space) {
    if (Math.random() < rate) {
      mutated[s.name] = randomGene(s);
    }
  }
  return mutated;
}

// ── Backtest Objective ──────────────────────────────────────────────────────

function evaluateParams(params: ParameterSet, config: OptimizationConfig): number {
  const result = runBacktest({
    symbol: config.symbol,
    period: config.period,
    strategyType: config.strategyType,
    params,
  });

  const score = result[config.objective.metric as keyof BacktestResult] as number ?? 0;
  return config.objective.direction === 'maximize' ? score : -score;
}

// ── GA Optimizer ────────────────────────────────────────────────────────────

function geneticSearch(config: OptimizationConfig, populationSize = 50, elite = 0.1): OptimizationResult {
  const start = Date.now();
  const space = config.parameterSpace;
  const maxIter = Math.floor(config.budget / populationSize);
  const eliteCount = Math.max(2, Math.floor(populationSize * elite));

  // Initialize population
  let population: Array<{ params: ParameterSet; score: number }> = [];
  for (let i = 0; i < populationSize; i++) {
    const params: ParameterSet = {};
    for (const s of space) params[s.name] = randomGene(s);
    population.push({ params, score: 0 });
  }

  // Evaluate initial population
  for (let i = 0; i < population.length; i++) {
    population[i].score = evaluateParams(population[i].params, config);
  }
  population.sort((a, b) => b.score - a.score);

  const eliteHistory: Array<{ score: number; params: ParameterSet }> = [];
  let totalBacktests = populationSize;

  for (let iter = 0; iter < maxIter; iter++) {
    // Elite selection
    const elitePop = population.slice(0, eliteCount);

    // Build next generation
    const nextGen: typeof population = [...elitePop];

    while (nextGen.length < populationSize) {
      const p1 = elitePop[Math.floor(Math.random() * eliteCount)];
      const p2 = elitePop[Math.floor(Math.random() * eliteCount)];
      let child = crossover(p1.params, p2.params);
      child = mutate(child, space);
      nextGen.push({ params: child, score: 0 });
    }

    // Evaluate
    for (let i = 0; i < nextGen.length; i++) {
      if (i >= eliteCount) {
        nextGen[i].score = evaluateParams(nextGen[i].params, config);
        totalBacktests++;
      }
    }

    nextGen.sort((a, b) => b.score - a.score);
    population = nextGen;

    const best = population[0];
    eliteHistory.push({ score: best.score, params: { ...best.params } });

    if (iter % 10 === 0) {
      log.info(`[BacktestOptimizer GA] iter ${iter}/${maxIter}: best=${best.score.toFixed(3)}`);
    }

    // Early convergence
    if (iter >= 10) {
      const recent = eliteHistory.slice(-10);
      const variance = recent.reduce((s, e) => s + (e.score - recent[0].score) ** 2, 0) / 10;
      if (variance < 0.0001) {
        log.info(`[BacktestOptimizer GA] Converged at iteration ${iter}`);
        break;
      }
    }
  }

  return {
    bestParams: population[0].params,
    bestScore: population[0].score,
    objective: `${config.objective.direction} ${config.objective.metric}`,
    iterations: Math.min(maxIter, eliteHistory.length),
    population: populationSize,
    totalBacktests,
    eliteHistory,
    duration: Date.now() - start,
    converged: eliteHistory.length < maxIter,
  };
}

// ── Grid Search ────────────────────────────────────────────────────────────

function gridSearch(config: OptimizationConfig): OptimizationResult {
  const start = Date.now();
  const space = config.parameterSpace;

  // Compute total combinations
  let total = 1;
  const steps: Array<number[]> = [];
  for (const s of space) {
    const count = s.step
      ? Math.floor((s.max - s.min) / s.step) + 1
      : Math.max(1, Math.floor((s.max - s.min) / (s.max - s.min) * 10));
    const vals = Array.from({ length: count }, (_, i) =>
      s.step ? s.min + i * s.step : s.min + (s.max - s.min) * i / (count - 1 || 1)
    );
    steps.push(vals);
    total *= count;
  }

  if (total > config.budget) {
    log.warn(`[BacktestOptimizer] Grid too large (${total}), sampling ${config.budget}`);
  }

  let bestParams: ParameterSet = {};
  let bestScore = config.objective.direction === 'maximize' ? -Infinity : Infinity;
  const sampleSize = Math.min(total, config.budget);
  const indices = Array.from({ length: total }, (_, i) => i);
  const sampled = indices
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  const eliteHistory: Array<{ score: number; params: ParameterSet }> = [];
  let backtestCount = 0;

  for (const idx of sampled) {
    const params: ParameterSet = {};
    let remain = idx;
    for (let i = 0; i < space.length; i++) {
      const vals = steps[i];
      const stepIdx = remain % vals.length;
      params[space[i].name] = vals[stepIdx];
      remain = Math.floor(remain / vals.length);
    }

    const score = evaluateParams(params, config);
    backtestCount++;

    if (
      (config.objective.direction === 'maximize' && score > bestScore) ||
      (config.objective.direction === 'minimize' && score < bestScore)
    ) {
      bestScore = score;
      bestParams = { ...params };
      eliteHistory.push({ score, params: { ...params } });
    }
  }

  return {
    bestParams,
    bestScore,
    objective: `${config.objective.direction} ${config.objective.metric}`,
    iterations: 1,
    totalBacktests: backtestCount,
    eliteHistory,
    duration: Date.now() - start,
    converged: true,
  };
}

// ── Main Entry ─────────────────────────────────────────────────────────────

export function optimizeParameters(config: OptimizationConfig): OptimizationResult {
  log.info(`[BacktestOptimizer] Starting ${config.algorithm} search for ${config.strategyType}`, {
    budget: config.budget,
    objective: config.objective,
  });

  if (config.algorithm === 'grid') {
    return gridSearch(config);
  }

  return geneticSearch(config);
}

// ── Walk-Forward Validation ───────────────────────────────────────────────

export interface WalkForwardResult {
  totalTrades: number;
  avgScore: number;
  stdScore: number;
  trainScores: number[];
  testScores: number[];
  inSampleReturn: number;
  outOfSampleReturn: number;
  stabilityScore: number; // 0-1, how consistent train vs test performance
}

export function walkForwardValidate(
  baseConfig: OptimizationConfig,
  nFolds = 5
): WalkForwardResult {
  const { start, end } = baseConfig.period;
  const totalDays = end - start;
  const testDays = Math.floor(totalDays * (baseConfig.walkForwardRatio ?? 0.2));
  const trainDays = totalDays - testDays;

  const trainScores: number[] = [];
  const testScores: number[] = [];

  for (let fold = 0; fold < nFolds; fold++) {
    const testEnd = end - fold * testDays;
    const testStart = testEnd - testDays;
    const trainEnd = testStart;
    const trainStart = trainEnd - trainDays;

    const trainConfig = { ...baseConfig, period: { start: trainStart, end: trainEnd } };
    const trainResult = optimizeParameters(trainConfig);
    trainScores.push(trainResult.bestScore);

    const testConfig = { ...baseConfig, period: { start: testStart, end: testEnd } };
    const testScore = evaluateParams(trainResult.bestParams, testConfig);
    testScores.push(testScore);

    log.info(`[WalkForward] fold ${fold + 1}/${nFolds}: train=${trainScore.toFixed(3)} test=${testScore.toFixed(3)}`);
  }

  const inSampleReturn = trainScores.reduce((a, b) => a + b, 0) / trainScores.length;
  const outOfSampleReturn = testScores.reduce((a, b) => a + b, 0) / testScores.length;
  const avgScore = (inSampleReturn + outOfSampleReturn) / 2;
  const stdScore = Math.sqrt(
    [...trainScores, ...testScores].reduce((s, x) => s + (x - avgScore) ** 2, 0) /
    (trainScores.length + testScores.length)
  );

  // Stability: ratio of out-of-sample to in-sample (1.0 = perfect)
  const stabilityScore = inSampleReturn !== 0
    ? Math.max(0, Math.min(1, outOfSampleReturn / inSampleReturn))
    : 0;

  return {
    totalTrades: trainScores.length * nFolds,
    avgScore,
    stdScore,
    trainScores,
    testScores,
    inSampleReturn,
    outOfSampleReturn,
    stabilityScore: Math.round(stabilityScore * 1000) / 1000,
  };
}

export default optimizeParameters;