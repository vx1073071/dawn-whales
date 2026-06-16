/**
 * Adaptive Parameter Adjustment Engine
 * Dawn Whales Project (J-38-01)
 *
 * Automatically adjusts strategy parameters based on historical performance data.
 * Supports multiple optimization methods: grid search, random search, gradient descent,
 * bayesian, and genetic algorithms.
 *
 * Uses an inline EventEmitter polyfill for jsdom compatibility (no 'events' import).
 */

import log from 'electron-log';
import { EngineError } from '../core/engine-error';


// ============================================================================
// EventEmitter Polyfill (inline, no 'events' import)
// ============================================================================

type EventListener = (...args: unknown[]) => void;

class EventEmitterPolyfill {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this._listeners.delete(event);
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[AdaptiveParamEngine] Event listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export type OptimizationMethod =
  | 'grid_search'
  | 'bayesian'
  | 'genetic'
  | 'gradient_descent'
  | 'random_search';

export type AdaptationMode = 'conservative' | 'balanced' | 'aggressive';

export interface ParamRange {
  name: string;
  min: number;
  max: number;
  step: number;
  current: number;
}

export interface OptimizationResult {
  method: OptimizationMethod;
  bestParams: Record<string, number>;
  bestFitness: number;
  iterations: number;
  durationMs: number;
  history: {
    iteration: number;
    fitness: number;
    params: Record<string, number>;
  }[];
}

export interface PerformanceRecord {
  timestamp: number;
  params: Record<string, number>;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  winRate: number;
  totalReturn: number;
  tradeCount: number;
}

export interface AdaptationConfig {
  method: OptimizationMethod;
  mode: AdaptationMode;
  maxIterations: number;
  lookbackPeriod: number; // number of performance records to look back
  adaptationRate: number; // 0-1, how aggressively to adjust
  minImprovement: number; // minimum improvement to accept new params
  cooldownPeriod: number; // minimum seconds between adaptations
}

export interface AdaptationLogEntry {
  timestamp: number;
  oldParams: Record<string, number>;
  newParams: Record<string, number>;
  improvement: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: AdaptationConfig = {
  method: 'gradient_descent',
  mode: 'balanced',
  maxIterations: 200,
  lookbackPeriod: 50,
  adaptationRate: 0.3,
  minImprovement: 0.01,
  cooldownPeriod: 60,
};

const MODE_RATE_MAP: Record<AdaptationMode, number> = {
  conservative: 0.1,
  balanced: 0.3,
  aggressive: 0.5,
};

// Fitness function weights
const FITNESS_WEIGHTS = {
  sharpe: 0.4,
  sortino: 0.2,
  drawdownPenalty: 0.25,
  winRate: 0.1,
  returnBonus: 0.05,
};

// Gradient descent learning rate
const GD_LEARNING_RATE = 0.01;
const GD_EPSILON = 1e-6;
const GD_MOMENTUM = 0.9;

// Genetic algorithm constants
const GA_POPULATION_SIZE = 40;
const GA_ELITE_COUNT = 5;
const GA_MUTATION_RATE = 0.15;
const GA_CROSSOVER_RATE = 0.7;

// Bayesian-like exploration constants
const BAYESIAN_EXPLORATION_RATE = 0.3;
const BAYESIAN_EXPLOITATION_RATE = 0.7;

// ============================================================================
// AdaptiveParamEngine
// ============================================================================

export class AdaptiveParamEngine extends EventEmitterPolyfill {
  private paramRanges: ParamRange[] = [];
  private currentParams: Record<string, number> = {};
  private performanceHistory: PerformanceRecord[] = [];
  private adaptationLog: AdaptationLogEntry[] = [];
  private config: AdaptationConfig;
  private lastAdaptationTime: number = 0;
  private iterationCount: number = 0;

  // Cache for fitness evaluations during optimization
  private fitnessCache: Map<string, number> = new Map();

  constructor(config?: Partial<AdaptationConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[AdaptiveParamEngine] Initialized with config:', JSON.stringify(this.config));
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Set the parameter ranges for optimization.
   * Each param must have min, max, step, and a current value.
   */
  setParamRanges(ranges: ParamRange[]): void {
    this.paramRanges = ranges.map((r) => ({ ...r }));
    this.currentParams = {};
    for (const r of this.paramRanges) {
      this.currentParams[r.name] = r.current;
    }
    this.fitnessCache.clear();
    log.info(
      `[AdaptiveParamEngine] Param ranges set: ${ranges.length} parameters configured`
    );
    this.emit('params-updated', { ...this.currentParams });
  }

  /**
   * Record a performance data point for the current parameter set.
   */
  recordPerformance(record: PerformanceRecord): void {
    this.performanceHistory.push({ ...record });

    // Keep history bounded to 10x lookback period
    const maxHistory = this.config.lookbackPeriod * 10;
    if (this.performanceHistory.length > maxHistory) {
      this.performanceHistory = this.performanceHistory.slice(-maxHistory);
    }

    log.debug(
      `[AdaptiveParamEngine] Performance recorded: sharpe=${record.sharpe.toFixed(3)}, ` +
        `return=${(record.totalReturn * 100).toFixed(2)}%, trades=${record.tradeCount}`
    );
  }

  /**
   * Run optimization using the specified (or configured) method.
   * Returns the optimization result with best parameters and fitness history.
   */
  optimize(method?: OptimizationMethod): OptimizationResult {
    const m = method ?? this.config.method;
    log.info(`[AdaptiveParamEngine] Starting optimization with method: ${m}`);

    this.fitnessCache.clear();
    let result: OptimizationResult;

    switch (m) {
      case 'grid_search':
        result = this.gridSearch();
        break;
      case 'random_search':
        result = this.randomSearch();
        break;
      case 'gradient_descent':
        result = this.gradientDescent();
        break;
      case 'bayesian':
        result = this.bayesianOptimization();
        break;
      case 'genetic':
        result = this.geneticOptimization();
        break;
      default:
        log.warn(`[AdaptiveParamEngine] Unknown method "${m}", falling back to random_search`);
        result = this.randomSearch();
        break;
    }

    log.info(
      `[AdaptiveParamEngine] Optimization complete: bestFitness=${result.bestFitness.toFixed(4)}, ` +
        `iterations=${result.iterations}, duration=${result.durationMs.toFixed(0)}ms`
    );

    this.emit('optimization-complete', result);
    return result;
  }

  /**
   * Adapt parameters based on recent performance.
   * Respects cooldown period and minimum improvement threshold.
   * Returns suggested new parameters.
   */
  adapt(): Record<string, number> {
    const now = Date.now();
    const cooldownMs = this.config.cooldownPeriod * 1000;

    // Check cooldown
    if (now - this.lastAdaptationTime < cooldownMs) {
      const remainingSec = ((cooldownMs - (now - this.lastAdaptationTime)) / 1000).toFixed(1);
      log.info(
        `[AdaptiveParamEngine] Adaptation skipped: cooldown active, ${remainingSec}s remaining`
      );
      return { ...this.currentParams };
    }

    // Need enough performance data
    if (this.performanceHistory.length < 3) {
      log.info('[AdaptiveParamEngine] Adaptation skipped: insufficient performance data');
      return { ...this.currentParams };
    }

    const oldParams = { ...this.currentParams };

    // Compute current baseline fitness from recent history
    const baselineFitness = this.computeBaselineFitness();

    // Run optimization
    const result = this.optimize();

    // Calculate improvement
    const improvement = result.bestFitness - baselineFitness;

    if (improvement < this.config.minImprovement) {
      log.info(
        `[AdaptiveParamEngine] Adaptation skipped: improvement ${improvement.toFixed(4)} ` +
          `below threshold ${this.config.minImprovement}`
      );
      return { ...this.currentParams };
    }

    // Apply adaptation rate to blend old and new params
    const rate = this.config.adaptationRate;
    const newParams: Record<string, number> = {};

    for (const key of Object.keys(this.currentParams)) {
      const oldVal = oldParams[key];
      const optVal = result.bestParams[key] ?? oldVal;
      newParams[key] = oldVal + rate * (optVal - oldVal);
    }

    // Clamp to valid ranges
    const clampedParams = this.clampParams(newParams);

    // Update current params
    this.currentParams = clampedParams;
    this.lastAdaptationTime = now;

    // Log adaptation
    const logEntry: AdaptationLogEntry = {
      timestamp: now,
      oldParams,
      newParams: clampedParams,
      improvement,
    };
    this.adaptationLog.push(logEntry);

    log.info(
      `[AdaptiveParamEngine] Adaptation applied: improvement=${improvement.toFixed(4)}, ` +
        `params updated`
    );

    this.emit('adaptation', logEntry);
    this.emit('params-updated', { ...clampedParams });

    return { ...clampedParams };
  }

  /**
   * Get a copy of the current parameter values.
   */
  getCurrentParams(): Record<string, number> {
    return { ...this.currentParams };
  }

  /**
   * Update configuration. Merges with existing config.
   * If mode is changed, adaptationRate is automatically updated.
   */
  setConfig(config: Partial<AdaptationConfig>): void {
    const prevMode = this.config.mode;
    this.config = { ...this.config, ...config };

    // Auto-update adaptation rate if mode changed and rate wasn't explicitly set
    if (config.mode && config.mode !== prevMode && !config.adaptationRate) {
      this.config.adaptationRate = MODE_RATE_MAP[this.config.mode];
    }

    log.info('[AdaptiveParamEngine] Config updated:', JSON.stringify(this.config));
  }

  /**
   * Get performance history, optionally limited to the last N records.
   */
  getHistory(limit?: number): PerformanceRecord[] {
    if (limit !== undefined && limit > 0) {
      return this.performanceHistory.slice(-limit).map((r) => ({ ...r }));
    }
    return this.performanceHistory.map((r) => ({ ...r }));
  }

  /**
   * Get the full adaptation log.
   */
  getAdaptationLog(): AdaptationLogEntry[] {
    return this.adaptationLog.map((e) => ({
      ...e,
      oldParams: { ...e.oldParams },
      newParams: { ...e.newParams },
    }));
  }

  /**
   * Reset the engine to initial state.
   */
  reset(): void {
    this.performanceHistory = [];
    this.adaptationLog = [];
    this.fitnessCache.clear();
    this.lastAdaptationTime = 0;
    this.iterationCount = 0;

    // Reset current params to range defaults
    this.currentParams = {};
    for (const r of this.paramRanges) {
      this.currentParams[r.name] = r.current;
    }

    log.info('[AdaptiveParamEngine] Engine reset');
    this.emit('params-updated', { ...this.currentParams });
  }

  // --------------------------------------------------------------------------
  // Optimization Methods (Internal)
  // --------------------------------------------------------------------------

  /**
   * Grid Search: exhaustively evaluates all parameter combinations
   * defined by the step sizes in paramRanges.
   */
  private gridSearch(): OptimizationResult {
    const startTime = performance.now();
    const history: OptimizationResult['history'] = [];
    let bestFitness = -Infinity;
    let bestParams: Record<string, number> = { ...this.currentParams };
    let iterations = 0;

    // Generate all combinations
    const paramValues: { name: string; values: number[] }[] = this.paramRanges.map((r) => {
      const vals: number[] = [];
      for (let v = r.min; v <= r.max + GD_EPSILON; v += r.step) {
        vals.push(parseFloat(v.toFixed(10)));
      }
      return { name: r.name, values: vals };
    });

    // Calculate total combinations
    const totalCombinations = paramValues.reduce((acc, p) => acc * p.values.length, 1);
    log.info(`[AdaptiveParamEngine][GridSearch] Total combinations: ${totalCombinations}`);

    // Cap at maxIterations to prevent runaway
    const maxEvals = Math.min(totalCombinations, this.config.maxIterations);

    // Recursive combination generator
    const evaluate = (paramIdx: number, current: Record<string, number>): void => {
      if (iterations >= maxEvals) return;

      if (paramIdx === paramValues.length) {
        iterations++;
        const fitness = this.evaluateParams(current);
        history.push({
          iteration: iterations,
          fitness,
          params: { ...current },
        });

        if (fitness > bestFitness) {
          bestFitness = fitness;
          bestParams = { ...current };
        }
        return;
      }

      const param = paramValues[paramIdx];
      for (const val of param.values) {
        if (iterations >= maxEvals) break;
        current[param.name] = val;
        evaluate(paramIdx + 1, current);
      }
    };

    evaluate(0, {});

    const durationMs = performance.now() - startTime;
    this.iterationCount += iterations;

    return {
      method: 'grid_search',
      bestParams,
      bestFitness,
      iterations,
      durationMs,
      history,
    };
  }

  /**
   * Random Search: samples random parameter combinations within ranges.
   * Surprisingly effective for high-dimensional spaces.
   */
  private randomSearch(): OptimizationResult {
    const startTime = performance.now();
    const history: OptimizationResult['history'] = [];
    let bestFitness = -Infinity;
    let bestParams: Record<string, number> = { ...this.currentParams };

    for (let i = 0; i < this.config.maxIterations; i++) {
      const candidate: Record<string, number> = {};

      for (const r of this.paramRanges) {
        // Random value within range, snapped to step
        const rawVal = r.min + Math.random() * (r.max - r.min);
        const stepped = Math.round((rawVal - r.min) / r.step) * r.step + r.min;
        candidate[r.name] = parseFloat(Math.min(r.max, Math.max(r.min, stepped)).toFixed(10));
      }

      const fitness = this.evaluateParams(candidate);
      history.push({
        iteration: i + 1,
        fitness,
        params: { ...candidate },
      });

      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestParams = { ...candidate };
      }
    }

    const durationMs = performance.now() - startTime;
    this.iterationCount += this.config.maxIterations;

    return {
      method: 'random_search',
      bestParams,
      bestFitness,
      iterations: this.config.maxIterations,
      durationMs,
      history,
    };
  }

  /**
   * Gradient Descent: numerical gradient estimation with momentum.
   * Uses finite differences to approximate the gradient in parameter space.
   */
  private gradientDescent(): OptimizationResult {
    const startTime = performance.now();
    const history: OptimizationResult['history'] = [];

    let params: Record<string, number> = { ...this.currentParams };
    let fitness = this.evaluateParams(params);
    let bestFitness = fitness;
    let bestParams: Record<string, number> = { ...params };

    // Momentum velocities
    const velocity: Record<string, number> = {};
    for (const r of this.paramRanges) {
      velocity[r.name] = 0;
    }

    let iterations = 0;
    let stagnantCount = 0;
    const stagnationLimit = Math.max(20, Math.floor(this.config.maxIterations * 0.15));

    for (let i = 0; i < this.config.maxIterations; i++) {
      iterations++;
      const gradient: Record<string, number> = {};

      // Compute numerical gradient for each parameter
      for (const r of this.paramRanges) {
        const h = Math.max(r.step * 0.1, GD_EPSILON * 10);

        const paramsPlus = { ...params };
        paramsPlus[r.name] = Math.min(r.max, params[r.name] + h);

        const paramsMinus = { ...params };
        paramsMinus[r.name] = Math.max(r.min, params[r.name] - h);

        const fPlus = this.evaluateParams(paramsPlus);
        const fMinus = this.evaluateParams(paramsMinus);

        gradient[r.name] = (fPlus - fMinus) / (2 * h);
      }

      // Update with momentum
      for (const r of this.paramRanges) {
        velocity[r.name] =
          GD_MOMENTUM * velocity[r.name] +
          GD_LEARNING_RATE * gradient[r.name] * (r.max - r.min); // Scale by range

        params[r.name] = params[r.name] + velocity[r.name];
      }

      // Clamp
      params = this.clampParams(params);

      fitness = this.evaluateParams(params);
      history.push({
        iteration: iterations,
        fitness,
        params: { ...params },
      });

      if (fitness > bestFitness) {
        const delta = fitness - bestFitness;
        bestFitness = fitness;
        bestParams = { ...params };
        stagnantCount = 0;

        // Adaptive learning rate: reduce if we're making tiny improvements
        if (delta < this.config.minImprovement * 0.1 && i > 10) {
          stagnantCount++;
        }
      } else {
        stagnantCount++;
      }

      // Early stopping if stagnant
      if (stagnantCount >= stagnationLimit) {
        log.info(
          `[AdaptiveParamEngine][GradientDescent] Early stop at iteration ${iterations} ` +
            `(stagnant for ${stagnantCount} iterations)`
        );
        break;
      }
    }

    const durationMs = performance.now() - startTime;
    this.iterationCount += iterations;

    return {
      method: 'gradient_descent',
      bestParams,
      bestFitness,
      iterations,
      durationMs,
      history,
    };
  }

  /**
   * Bayesian-inspired optimization.
   * Maintains a set of evaluated points and alternates between exploration
   * (sampling far from evaluated points) and exploitation (refining near best).
   */
  private bayesianOptimization(): OptimizationResult {
    const startTime = performance.now();
    const history: OptimizationResult['history'] = [];
    let bestFitness = -Infinity;
    let bestParams: Record<string, number> = { ...this.currentParams };

    // Evaluated points for distance calculations
    const evaluated: { params: Record<string, number>; fitness: number }[] = [];

    // Seed with current params
    const seedFitness = this.evaluateParams(this.currentParams);
    evaluated.push({ params: { ...this.currentParams }, fitness: seedFitness });
    if (seedFitness > bestFitness) {
      bestFitness = seedFitness;
      bestParams = { ...this.currentParams };
    }
    history.push({ iteration: 1, fitness: seedFitness, params: { ...this.currentParams } });

    for (let i = 1; i < this.config.maxIterations; i++) {
      const isExploration = Math.random() < BAYESIAN_EXPLORATION_RATE;
      const candidate: Record<string, number> = {};

      if (isExploration) {
        // Exploration: sample in low-density regions
        for (const r of this.paramRanges) {
          const rawVal = r.min + Math.random() * (r.max - r.min);
          const stepped = Math.round((rawVal - r.min) / r.step) * r.step + r.min;
          candidate[r.name] = parseFloat(
            Math.min(r.max, Math.max(r.min, stepped)).toFixed(10)
          );
        }
      } else {
        // Exploitation: perturb around current best with decreasing radius
        const radius = 1 - i / this.config.maxIterations; // Shrinks over time
        for (const r of this.paramRanges) {
          const range = r.max - r.min;
          const perturbation = (Math.random() - 0.5) * 2 * radius * range * 0.3;
          const rawVal = bestParams[r.name] + perturbation;
          const stepped = Math.round((rawVal - r.min) / r.step) * r.step + r.min;
          candidate[r.name] = parseFloat(
            Math.min(r.max, Math.max(r.min, stepped)).toFixed(10)
          );
        }
      }

      // Minimum distance check to avoid redundant evaluations
      const minDist = this.getMinDistance(candidate, evaluated.map((e) => e.params));
      if (minDist < GD_EPSILON * 100) {
        // Too close to existing point, re-sample
        for (const r of this.paramRanges) {
          candidate[r.name] = parseFloat(
            Math.min(r.max, Math.max(r.min, r.min + Math.random() * (r.max - r.min))).toFixed(10)
          );
        }
      }

      const fitness = this.evaluateParams(candidate);
      evaluated.push({ params: { ...candidate }, fitness });

      history.push({
        iteration: i + 1,
        fitness,
        params: { ...candidate },
      });

      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestParams = { ...candidate };
      }
    }

    const durationMs = performance.now() - startTime;
    this.iterationCount += this.config.maxIterations;

    return {
      method: 'bayesian',
      bestParams,
      bestFitness,
      iterations: this.config.maxIterations,
      durationMs,
      history,
    };
  }

  /**
   * Genetic Algorithm optimization.
   * Maintains a population, applies selection, crossover, and mutation.
   */
  private geneticOptimization(): OptimizationResult {
    const startTime = performance.now();
    const history: OptimizationResult['history'] = [];
    const popSize = GA_POPULATION_SIZE;

    // Initialize population
    interface Individual {
      genes: Record<string, number>;
      fitness: number;
    }

    let population: Individual[] = [];

    // Seed one individual with current params
    population.push({
      genes: { ...this.currentParams },
      fitness: this.evaluateParams(this.currentParams),
    });

    // Fill rest randomly
    while (population.length < popSize) {
      const genes: Record<string, number> = {};
      for (const r of this.paramRanges) {
        const rawVal = r.min + Math.random() * (r.max - r.min);
        const stepped = Math.round((rawVal - r.min) / r.step) * r.step + r.min;
        genes[r.name] = parseFloat(Math.min(r.max, Math.max(r.min, stepped)).toFixed(10));
      }
      population.push({
        genes,
        fitness: this.evaluateParams(genes),
      });
    }

    // Sort by fitness descending
    population.sort((a, b) => b.fitness - a.fitness);

    let bestFitness = population[0].fitness;
    let bestParams: Record<string, number> = { ...population[0].genes };
    let iterations = 0;

    history.push({
      iteration: 0,
      fitness: bestFitness,
      params: { ...bestParams },
    });

    const generations = Math.ceil(this.config.maxIterations / popSize);

    for (let gen = 0; gen < generations; gen++) {
      const newPopulation: Individual[] = [];

      // Elitism: keep top individuals
      for (let i = 0; i < GA_ELITE_COUNT && i < population.length; i++) {
        newPopulation.push({
          genes: { ...population[i].genes },
          fitness: population[i].fitness,
        });
      }

      // Breed the rest
      while (newPopulation.length < popSize) {
        // Tournament selection
        const parent1 = this.tournamentSelect(population);
        const parent2 = this.tournamentSelect(population);

        let childGenes: Record<string, number>;

        if (Math.random() < GA_CROSSOVER_RATE) {
          // Uniform crossover
          childGenes = {};
          for (const r of this.paramRanges) {
            childGenes[r.name] =
              Math.random() < 0.5 ? parent1.genes[r.name] : parent2.genes[r.name];
          }
        } else {
          // Clone parent1
          childGenes = { ...parent1.genes };
        }

        // Mutation
        if (Math.random() < GA_MUTATION_RATE) {
          const mutationTarget =
            this.paramRanges[Math.floor(Math.random() * this.paramRanges.length)];
          const rawVal =
            mutationTarget.min + Math.random() * (mutationTarget.max - mutationTarget.min);
          const stepped =
            Math.round((rawVal - mutationTarget.min) / mutationTarget.step) *
              mutationTarget.step +
            mutationTarget.min;
          childGenes[mutationTarget.name] = parseFloat(
            Math.min(
              mutationTarget.max,
              Math.max(mutationTarget.min, stepped)
            ).toFixed(10)
          );
        }

        const clamped = this.clampParams(childGenes);
        const fitness = this.evaluateParams(clamped);

        newPopulation.push({ genes: clamped, fitness });
        iterations++;

        if (fitness > bestFitness) {
          bestFitness = fitness;
          bestParams = { ...clamped };
        }
      }

      population = newPopulation;
      population.sort((a, b) => b.fitness - a.fitness);

      history.push({
        iteration: gen + 1,
        fitness: population[0].fitness,
        params: { ...population[0].genes },
      });
    }

    const durationMs = performance.now() - startTime;
    this.iterationCount += iterations;

    return {
      method: 'genetic',
      bestParams,
      bestFitness,
      iterations,
      durationMs,
      history,
    };
  }

  // --------------------------------------------------------------------------
  // Fitness & Evaluation
  // --------------------------------------------------------------------------

  /**
   * Evaluate a set of parameters using a composite fitness function.
   *
   * The fitness function combines:
   * - Sharpe ratio contribution (weighted)
   * - Sortino ratio contribution
   * - Max drawdown penalty (lower drawdown = higher fitness)
   * - Win rate bonus
   * - Total return bonus
   *
   * When performance history is available, parameters are evaluated by
   * computing a weighted similarity to historically successful parameter sets
   * and combining with the param-space smoothness heuristic.
   */
  evaluateParams(params: Record<string, number>): number {
    const cacheKey = JSON.stringify(params);
    const cached = this.fitnessCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let fitness: number;

    if (this.performanceHistory.length >= 3) {
      fitness = this.computeHistoryBasedFitness(params);
    } else {
      // Without enough history, use param-space heuristics
      fitness = this.computeHeuristicFitness(params);
    }

    this.fitnessCache.set(cacheKey, fitness);
    return fitness;
  }

  /**
   * Compute fitness based on historical performance similarity.
   * Parameters similar to historically successful configurations score higher.
   */
  private computeHistoryBasedFitness(params: Record<string, number>): number {
    const lookback = this.config.lookbackPeriod;
    const recentRecords = this.performanceHistory.slice(-lookback);

    if (recentRecords.length === 0) return this.computeHeuristicFitness(params);

    // Compute weighted average performance metrics, weighted by recency
    let weightedSharpe = 0;
    let weightedSortino = 0;
    let weightedDrawdown = 0;
    let weightedWinRate = 0;
    let weightedReturn = 0;
    let totalWeight = 0;

    for (let i = 0; i < recentRecords.length; i++) {
      const record = recentRecords[i];
      const recencyWeight = (i + 1) / recentRecords.length; // More recent = higher weight

      // Compute parameter similarity (Gaussian kernel)
      const paramSimilarity = this.computeParamSimilarity(params, record.params);
      const weight = recencyWeight * paramSimilarity;

      weightedSharpe += record.sharpe * weight;
      weightedSortino += record.sortino * weight;
      weightedDrawdown += record.maxDrawdown * weight;
      weightedWinRate += record.winRate * weight;
      weightedReturn += record.totalReturn * weight;
      totalWeight += weight;
    }

    if (totalWeight < GD_EPSILON) {
      // No similar historical records, fall back to heuristic
      return this.computeHeuristicFitness(params);
    }

    const avgSharpe = weightedSharpe / totalWeight;
    const avgSortino = weightedSortino / totalWeight;
    const avgDrawdown = weightedDrawdown / totalWeight;
    const avgWinRate = weightedWinRate / totalWeight;
    const avgReturn = weightedReturn / totalWeight;

    return this.computeCompositeFitness(avgSharpe, avgSortino, avgDrawdown, avgWinRate, avgReturn);
  }

  /**
   * Heuristic fitness for when no performance history is available.
   * Favors parameters near the center of their ranges (safe defaults).
   */
  private computeHeuristicFitness(params: Record<string, number>): number {
    let score = 0;
    const n = this.paramRanges.length;

    if (n === 0) return 0;

    for (const r of this.paramRanges) {
      const val = params[r.name] ?? r.current;
      const range = r.max - r.min;
      if (range <= 0) continue;

      // Distance from center, normalized to [0, 1]
      const center = (r.max + r.min) / 2;
      const distFromCenter = Math.abs(val - center) / (range / 2);

      // Gaussian-like penalty for being far from center
      score += Math.exp(-2 * distFromCenter * distFromCenter);
    }

    return score / n;
  }

  /**
   * Composite fitness from raw metrics.
   */
  private computeCompositeFitness(
    sharpe: number,
    sortino: number,
    maxDrawdown: number,
    winRate: number,
    totalReturn: number
  ): number {
    const w = FITNESS_WEIGHTS;

    // Sharpe component: positive is good, typical range [-2, 3]
    const sharpeComponent = this.sigmoidNormalize(sharpe, 0, 1.5);

    // Sortino component: similar to sharpe but focuses on downside
    const sortinoComponent = this.sigmoidNormalize(sortino, 0, 2);

    // Drawdown penalty: lower drawdown is better. maxDrawdown is typically negative
    // Convert: 0 drawdown = 1.0, -50% drawdown ≈ 0.1
    const drawdownComponent = 1 - Math.min(1, Math.abs(maxDrawdown) * 2);

    // Win rate: 0 to 1, higher is better
    const winRateComponent = winRate;

    // Return bonus: normalized with sigmoid
    const returnComponent = this.sigmoidNormalize(totalReturn, 0, 0.5);

    const fitness =
      w.sharpe * sharpeComponent +
      w.sortino * sortinoComponent +
      w.drawdownPenalty * drawdownComponent +
      w.winRate * winRateComponent +
      w.returnBonus * returnComponent;

    return fitness;
  }

  /**
   * Compute parameter similarity using a Gaussian kernel.
   * Returns a value in (0, 1] where 1 = identical parameters.
   */
  private computeParamSimilarity(
    a: Record<string, number>,
    b: Record<string, number>
  ): number {
    let sumSqDist = 0;
    let count = 0;

    for (const r of this.paramRanges) {
      const va = a[r.name] ?? r.current;
      const vb = b[r.name] ?? r.current;
      const range = r.max - r.min;
      if (range <= 0) continue;

      const normalizedDist = (va - vb) / range;
      sumSqDist += normalizedDist * normalizedDist;
      count++;
    }

    if (count === 0) return 0;

    // Gaussian kernel with bandwidth parameter
    const bandwidth = 0.5;
    return Math.exp(-sumSqDist / (2 * bandwidth * bandwidth * count));
  }

  /**
   * Sigmoid normalization: maps a value to [0, 1] using a sigmoid curve.
   * `center` is the midpoint, `scale` controls the steepness.
   */
  private sigmoidNormalize(value: number, center: number, scale: number): number {
    if (scale <= 0) return value > center ? 1 : 0;
    return 1 / (1 + Math.exp(-(value - center) / scale));
  }

  /**
   * Compute baseline fitness from the most recent performance records.
   */
  private computeBaselineFitness(): number {
    const lookback = Math.min(
      this.config.lookbackPeriod,
      this.performanceHistory.length
    );
    const recent = this.performanceHistory.slice(-lookback);

    if (recent.length === 0) return 0;

    // Weighted average with recency bias
    let totalWeight = 0;
    let weightedFitness = 0;

    for (let i = 0; i < recent.length; i++) {
      const r = recent[i];
      const weight = (i + 1) / recent.length;
      const f = this.computeCompositeFitness(
        r.sharpe,
        r.sortino,
        r.maxDrawdown,
        r.winRate,
        r.totalReturn
      );
      weightedFitness += f * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedFitness / totalWeight : 0;
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Clamp parameters to their valid ranges.
   */
  clampParams(params: Record<string, number>): Record<string, number> {
    const clamped: Record<string, number> = {};

    for (const r of this.paramRanges) {
      let val = params[r.name] ?? r.current;

      // Clamp to range
      val = Math.min(r.max, Math.max(r.min, val));

      // Snap to step grid
      if (r.step > 0) {
        val = Math.round((val - r.min) / r.step) * r.step + r.min;
        // Ensure we don't exceed max after rounding
        val = Math.min(r.max, val);
      }

      // Clean floating point artifacts
      clamped[r.name] = parseFloat(val.toFixed(10));
    }

    return clamped;
  }

  /**
   * Tournament selection for genetic algorithm.
   * Picks k random individuals and returns the fittest.
   */
  private tournamentSelect(population: { genes: Record<string, number>; fitness: number }[]): {
    genes: Record<string, number>;
    fitness: number;
  } {
    const tournamentSize = 3;
    let best: typeof population[0] | null = null;

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      const candidate = population[idx];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }

    return best!;
  }

  /**
   * Compute minimum Euclidean distance (normalized) from a point to a set of points.
   */
  private getMinDistance(
    point: Record<string, number>,
    others: Record<string, number>[]
  ): number {
    if (others.length === 0) return Infinity;

    let minDist = Infinity;

    for (const other of others) {
      let dist = 0;
      let count = 0;

      for (const r of this.paramRanges) {
        const va = point[r.name] ?? 0;
        const vb = other[r.name] ?? 0;
        const range = r.max - r.min;
        if (range <= 0) continue;

        const d = (va - vb) / range;
        dist += d * d;
        count++;
      }

      if (count > 0) {
        const normalizedDist = Math.sqrt(dist / count);
        minDist = Math.min(minDist, normalizedDist);
      }
    }

    return minDist;
  }

  // --------------------------------------------------------------------------
  // Introspection & Debugging
  // --------------------------------------------------------------------------

  /**
   * Get a summary of the engine's current state.
   */
  getState(): {
    paramCount: number;
    historyLength: number;
    adaptationCount: number;
    totalIterations: number;
    config: AdaptationConfig;
    currentParams: Record<string, number>;
    lastAdaptationTime: number;
    cooldownActive: boolean;
  } {
    const now = Date.now();
    const cooldownMs = this.config.cooldownPeriod * 1000;

    return {
      paramCount: this.paramRanges.length,
      historyLength: this.performanceHistory.length,
      adaptationCount: this.adaptationLog.length,
      totalIterations: this.iterationCount,
      config: { ...this.config },
      currentParams: { ...this.currentParams },
      lastAdaptationTime: this.lastAdaptationTime,
      cooldownActive: now - this.lastAdaptationTime < cooldownMs,
    };
  }

  /**
   * Get parameter sensitivity analysis.
   * Evaluates how much each parameter affects fitness by varying one at a time.
   */
  getParamSensitivity(): Record<string, number> {
    const sensitivity: Record<string, number> = {};
    const baselineFitness = this.evaluateParams(this.currentParams);

    for (const r of this.paramRanges) {
      const range = r.max - r.min;
      if (range <= 0) {
        sensitivity[r.name] = 0;
        continue;
      }

      // Evaluate at min and max
      const atMin = { ...this.currentParams };
      atMin[r.name] = r.min;
      const fitnessMin = this.evaluateParams(atMin);

      const atMax = { ...this.currentParams };
      atMax[r.name] = r.max;
      const fitnessMax = this.evaluateParams(atMax);

      // Sensitivity = range of fitness change / param range
      sensitivity[r.name] = Math.abs(fitnessMax - fitnessMin);
    }

    return sensitivity;
  }

  /**
   * Get performance statistics from the history.
   */
  getPerformanceStats(): {
    avgSharpe: number;
    avgSortino: number;
    avgDrawdown: number;
    avgWinRate: number;
    avgReturn: number;
    totalTrades: number;
    bestSharpe: number;
    worstDrawdown: number;
    recordCount: number;
  } | null {
    if (this.performanceHistory.length === 0) return null;

    const n = this.performanceHistory.length;
    let sumSharpe = 0;
    let sumSortino = 0;
    let sumDrawdown = 0;
    let sumWinRate = 0;
    let sumReturn = 0;
    let totalTrades = 0;
    let bestSharpe = -Infinity;
    let worstDrawdown = 0;

    for (const r of this.performanceHistory) {
      sumSharpe += r.sharpe;
      sumSortino += r.sortino;
      sumDrawdown += r.maxDrawdown;
      sumWinRate += r.winRate;
      sumReturn += r.totalReturn;
      totalTrades += r.tradeCount;
      bestSharpe = Math.max(bestSharpe, r.sharpe);
      worstDrawdown = Math.min(worstDrawdown, r.maxDrawdown);
    }

    return {
      avgSharpe: sumSharpe / n,
      avgSortino: sumSortino / n,
      avgDrawdown: sumDrawdown / n,
      avgWinRate: sumWinRate / n,
      avgReturn: sumReturn / n,
      totalTrades,
      bestSharpe,
      worstDrawdown,
      recordCount: n,
    };
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default AdaptiveParamEngine;
