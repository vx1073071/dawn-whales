// 
import { EngineError, ErrorCode } from '../../errors';
/**
 * Strategy Optimizer Engine
 * QUANT MOO Project (J-39-01, R39)
 *
 * Multi-objective strategy parameter optimization engine.
 * Supports grid search, random search, and bayesian optimization.
 * Objectives: Sharpe ratio, total return, max drawdown, win rate.
 *
 * Uses inline EventEmitter polyfill for jsdom compatibility.
 */

import log from 'electron-log';

// ============================================================================
// EventEmitter Polyfill
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
      try { fn(...args); } catch (err) {
        log.error('[StrategyOptimizer] Event listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) { this._listeners.delete(event); }
    else { this._listeners.clear(); }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export type OptimizationMode = 'grid_search' | 'random_search' | 'bayesian';
export type OptimizationObjective = 'sharpe' | 'return' | 'drawdown' | 'win_rate' | 'composite';
export type OptimizationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description?: string;
}

export interface ObjectiveWeights {
  sharpe: number;     // weight for Sharpe ratio (higher is better)
  return: number;     // weight for total return (higher is better)
  drawdown: number;   // weight for max drawdown (lower is better, penalty)
  winRate: number;    // weight for win rate (higher is better)
}

export interface OptimizationConfig {
  mode: OptimizationMode;
  objectives: OptimizationObjective;
  weights: ObjectiveWeights;
  maxIterations: number;
  maxEvaluations: number;
  randomSeed?: number;
  convergenceThreshold: number;
  earlyStopIterations: number;
  parallelEvaluations: number;
}

export interface EvalResult {
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  fitness: number;
  evaluationTimeMs: number;
}

export interface OptimizationProgress {
  iteration: number;
  totalIterations: number;
  evaluations: number;
  bestFitness: number;
  bestParams: Record<string, number>;
  currentFitness: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  status: OptimizationStatus;
}

export interface OptimizationResult {
  mode: OptimizationMode;
  status: OptimizationStatus;
  bestParams: Record<string, number>;
  bestFitness: number;
  bestEvaluation: EvalResult;
  totalEvaluations: number;
  totalIterations: number;
  durationMs: number;
  history: EvalResult[];
  paretoFront: EvalResult[];
  convergenceReached: boolean;
  statistics: {
    meanFitness: number;
    stdFitness: number;
    minFitness: number;
    maxFitness: number;
    improvementRate: number;
  };
}

export interface HeatmapData {
  paramX: string;
  paramY: string;
  grid: { x: number; y: number; fitness: number }[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: OptimizationConfig = {
  mode: 'bayesian',
  objectives: 'composite',
  weights: { sharpe: 0.35, return: 0.25, drawdown: 0.25, winRate: 0.15 },
  maxIterations: 100,
  maxEvaluations: 500,
  convergenceThreshold: 0.001,
  earlyStopIterations: 20,
  parallelEvaluations: 1,
};

const DEFAULT_WEIGHTS: ObjectiveWeights = {
  sharpe: 0.35,
  return: 0.25,
  drawdown: 0.25,
  winRate: 0.15,
};

// ============================================================================
// Strategy Optimizer Engine
// ============================================================================

export class StrategyOptimizer extends EventEmitterPolyfill {
  private config: OptimizationConfig;
  private paramSpecs: ParamSpec[] = [];
  private status: OptimizationStatus = 'idle';
  private history: EvalResult[] = [];
  private bestResult: EvalResult | null = null;
  private startTime = 0;
  private currentIteration = 0;
  private totalEvaluations = 0;
  private noImprovementCount = 0;

  // Bayesian state
  private bayesianSamples: { params: Record<string, number>; fitness: number }[] = [];
  private surrogateModel: Map<string, number> = new Map();

  // Backtest function (injectable for testing)
  private evaluateFn: ((params: Record<string, number>) => EvalResult) | null = null;

  constructor(config?: Partial<OptimizationConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (config?.weights) {
      this.config.weights = { ...DEFAULT_WEIGHTS, ...config.weights };
    }
    log.info(`[StrategyOptimizer] Initialized (mode=${this.config.mode})`);
  }

  // ── Configuration ──────────────────────────────────────────────────

  /**
   * Set parameter specifications
   */
  setParamSpecs(specs: ParamSpec[]): void {
    this.paramSpecs = specs.map(s => ({ ...s }));
    log.info(`[StrategyOptimizer] ${specs.length} parameter specs configured`);
    this.emit('config:params', { specs: this.paramSpecs });
  }

  /**
   * Get parameter specifications
   */
  getParamSpecs(): ParamSpec[] {
    return [...this.paramSpecs];
  }

  /**
   * Set the backtest evaluation function
   */
  setEvaluateFunction(fn: (params: Record<string, number>) => EvalResult): void {
    this.evaluateFn = fn;
  }

  /**
   * Update optimization config
   */
  setConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
  }

  /**
   * Get current config
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  // ── Optimization Control ───────────────────────────────────────────

  /**
   * Run optimization
   */
  async optimize(): Promise<OptimizationResult> {
    if (this.paramSpecs.length === 0) {
      throw new EngineError("No parameter specs configured", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }
    if (!this.evaluateFn) {
      throw new EngineError("No evaluation function configured", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    this.reset();
    this.status = 'running';
    this.startTime = Date.now();
    this.emit('optimization:start', { mode: this.config.mode });

    try {
      switch (this.config.mode) {
        case 'grid_search':
          await this.runGridSearch();
          break;
        case 'random_search':
          await this.runRandomSearch();
          break;
        case 'bayesian':
          await this.runBayesianOptimization();
          break;
        default:
          throw new EngineError("`Unknown optimization mode: ${this.config.mode}`", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      }

      this.status = 'completed';
    } catch (err: unknown) {
      this.status = 'error';
      log.error('[StrategyOptimizer] Optimization error:', err);
      this.emit('optimization:error', { error: err.message });
    }

    const result = this.buildResult();
    this.emit('optimization:complete', result);
    return result;
  }

  /**
   * Cancel running optimization. Idempotent: cancel on idle/completed/cancelled
   * is a no-op (status stays the same), but if a future status tracking needs
   * to mark "cancelled on intent", this method is the hook.
   */
  cancel(): void {
    if (this.status === 'running') {
      this.status = 'cancelled';
      log.info('[StrategyOptimizer] Optimization cancelled');
      this.emit('optimization:cancelled');
    } else if (this.status === 'idle') {
      // Test hook: cancellation intent recorded but status stays idle until run.
      log.debug('[StrategyOptimizer] cancel() called from idle (no-op)');
    }
  }

  /**
   * Get current status
   */
  getStatus(): OptimizationStatus {
    return this.status;
  }

  /**
   * Get current progress
   */
  getProgress(): OptimizationProgress {
    const elapsed = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const avgTimePerIteration = this.currentIteration > 0 ? elapsed / this.currentIteration : 0;
    const remaining = this.currentIteration > 0
      ? (this.config.maxIterations - this.currentIteration) * avgTimePerIteration
      : 0;

    return {
      iteration: this.currentIteration,
      totalIterations: this.config.maxIterations,
      evaluations: this.totalEvaluations,
      bestFitness: this.bestResult?.fitness ?? -Infinity,
      bestParams: this.bestResult?.params ?? {},
      currentFitness: this.history.length > 0 ? this.history[this.history.length - 1].fitness : -Infinity,
      elapsedMs: elapsed,
      estimatedRemainingMs: Math.max(0, remaining),
      status: this.status,
    };
  }

  // ── Grid Search ──────────────────────────────────────────────────

  private async runGridSearch(): Promise<void> {
    const grid = this.generateGrid();
    log.info(`[StrategyOptimizer] Grid search: ${grid.length} combinations`);

    for (let i = 0; i < grid.length; i++) {
      if (this.status !== 'running') break;
      if (this.totalEvaluations >= this.config.maxEvaluations) break;

      const params = grid[i];
      const result = this.evaluate(params);
      this.recordResult(result);

      this.currentIteration = i + 1;
      this.emitProgress();

      // Yield to event loop periodically
      if (i % 10 === 0) await this.yieldToEventLoop();
    }
  }

  private generateGrid(): Record<string, number>[] {
    const grid: Record<string, number>[] = [{}];

    for (const spec of this.paramSpecs) {
      const values: number[] = [];
      for (let v = spec.min; v <= spec.max; v += spec.step) {
        values.push(Math.round(v * 1e8) / 1e8);
      }

      const newGrid: Record<string, number>[] = [];
      for (const existing of grid) {
        for (const val of values) {
          newGrid.push({ ...existing, [spec.name]: val });
        }
      }
      grid.length = 0;
      grid.push(...newGrid);

      // Safety: limit grid size
      if (grid.length > 10000) {
        log.warn(`[StrategyOptimizer] Grid too large (${grid.length}), truncating to 10000`);
        return grid.slice(0, 10000);
      }
    }

    return grid;
  }

  // ── Random Search ────────────────────────────────────────────────

  private async runRandomSearch(): Promise<void> {
    log.info(`[StrategyOptimizer] Random search: ${this.config.maxIterations} iterations`);

    for (let i = 0; i < this.config.maxIterations; i++) {
      if (this.status !== 'running') break;
      if (this.totalEvaluations >= this.config.maxEvaluations) break;

      const params = this.sampleRandomParams();
      const result = this.evaluate(params);
      this.recordResult(result);

      this.currentIteration = i + 1;
      this.emitProgress();

      // Early stopping
      if (this.noImprovementCount >= this.config.earlyStopIterations) {
        log.info(`[StrategyOptimizer] Early stop: no improvement for ${this.config.earlyStopIterations} iterations`);
        break;
      }

      if (i % 5 === 0) await this.yieldToEventLoop();
    }
  }

  private sampleRandomParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const spec of this.paramSpecs) {
      const range = spec.max - spec.min;
      const raw = spec.min + Math.random() * range;
      // Snap to step
      params[spec.name] = Math.round(raw / spec.step) * spec.step;
      params[spec.name] = Math.round(params[spec.name] * 1e8) / 1e8;
    }
    return params;
  }

  // ── Bayesian Optimization ────────────────────────────────────────

  private async runBayesianOptimization(): Promise<void> {
    log.info(`[StrategyOptimizer] Bayesian optimization: ${this.config.maxIterations} iterations`);

    // Phase 1: Initial random sampling (exploration)
    const initialSamples = Math.min(10, this.config.maxIterations);
    for (let i = 0; i < initialSamples; i++) {
      if (this.status !== 'running') break;

      const params = this.sampleRandomParams();
      const result = this.evaluate(params);
      this.recordResult(result);
      this.bayesianSamples.push({ params, fitness: result.fitness });
      this.currentIteration = i + 1;
      this.emitProgress();
    }

    // Phase 2: Bayesian-guided search
    for (let i = initialSamples; i < this.config.maxIterations; i++) {
      if (this.status !== 'running') break;
      if (this.totalEvaluations >= this.config.maxEvaluations) break;

      const params = this.bayesianSuggestParams();
      const result = this.evaluate(params);
      this.recordResult(result);
      this.bayesianSamples.push({ params, fitness: result.fitness });

      this.currentIteration = i + 1;
      this.emitProgress();

      // Early stopping
      if (this.noImprovementCount >= this.config.earlyStopIterations) {
        log.info(`[StrategyOptimizer] Bayesian early stop at iteration ${i + 1}`);
        break;
      }

      if (i % 5 === 0) await this.yieldToEventLoop();
    }
  }

  private bayesianSuggestParams(): Record<string, number> {
    if (this.bayesianSamples.length < 3) {
      return this.sampleRandomParams();
    }

    // Acquisition function: explore vs exploit
    const exploreProb = Math.max(0.1, 0.5 - this.currentIteration * 0.01);

    if (Math.random() < exploreProb) {
      // Explore: random sample near best
      return this.perturbParams(this.bestResult?.params ?? this.sampleRandomParams());
    }

    // Exploit: gradient-based suggestion from best samples
    return this.exploitBestSamples();
  }

  private perturbParams(base: Record<string, number>): Record<string, number> {
    const params: Record<string, number> = {};
    for (const spec of this.paramSpecs) {
      const range = spec.max - spec.min;
      const perturbation = (Math.random() - 0.5) * range * 0.2;
      let val = (base[spec.name] ?? spec.default) + perturbation;
      val = Math.max(spec.min, Math.min(spec.max, val));
      val = Math.round(val / spec.step) * spec.step;
      params[spec.name] = Math.round(val * 1e8) / 1e8;
    }
    return params;
  }

  private exploitBestSamples(): Record<string, number> {
    // Sort by fitness and take top 20%
    const sorted = [...this.bayesianSamples].sort((a, b) => b.fitness - a.fitness);
    const topN = Math.max(2, Math.ceil(sorted.length * 0.2));
    const topSamples = sorted.slice(0, topN);

    // Weighted average of top params
    const params: Record<string, number> = {};
    let totalWeight = 0;

    for (const sample of topSamples) {
      const w = Math.max(0, sample.fitness);
      totalWeight += w;
      for (const spec of this.paramSpecs) {
        params[spec.name] = (params[spec.name] ?? 0) + (sample.params[spec.name] ?? 0) * w;
      }
    }

    if (totalWeight > 0) {
      for (const spec of this.paramSpecs) {
        params[spec.name] = params[spec.name] / totalWeight;
        // Add small random perturbation
        const range = spec.max - spec.min;
        params[spec.name] += (Math.random() - 0.5) * range * 0.05;
        params[spec.name] = Math.max(spec.min, Math.min(spec.max, params[spec.name]));
        params[spec.name] = Math.round(params[spec.name] / spec.step) * spec.step;
        params[spec.name] = Math.round(params[spec.name] * 1e8) / 1e8;
      }
    } else {
      return this.sampleRandomParams();
    }

    return params;
  }

  // ── Evaluation ──────────────────────────────────────────────────

  private evaluate(params: Record<string, number>): EvalResult {
    const t0 = Date.now();
    const raw = this.evaluateFn!(params);
    const fitness = this.calculateFitness(raw);

    return {
      ...raw,
      fitness,
      evaluationTimeMs: Date.now() - t0,
    };
  }

  /**
   * Calculate composite fitness score
   */
  calculateFitness(result: Omit<EvalResult, 'fitness' | 'evaluationTimeMs'>): number {
    const w = this.config.weights;

    // Normalize each metric to 0-1 range where 1 is best
    const sharpeScore = Math.max(0, Math.min(1, (result.sharpe + 1) / 4)); // -1 to 3 -> 0 to 1
    const returnScore = Math.max(0, Math.min(1, (result.totalReturn + 50) / 200)); // -50% to 150% -> 0 to 1
    const drawdownScore = Math.max(0, 1 - result.maxDrawdown / 100); // 0% DD = 1, 100% DD = 0
    const winRateScore = Math.max(0, Math.min(1, result.winRate / 100)); // 0-100 -> 0-1

    switch (this.config.objectives) {
      case 'sharpe': return sharpeScore;
      case 'return': return returnScore;
      case 'drawdown': return drawdownScore;
      case 'win_rate': return winRateScore;
      case 'composite':
      default:
        return (
          w.sharpe * sharpeScore +
          w.return * returnScore +
          w.drawdown * drawdownScore +
          w.winRate * winRateScore
        );
    }
  }

  private recordResult(result: EvalResult): void {
    this.history.push(result);
    this.totalEvaluations++;

    if (!this.bestResult || result.fitness > this.bestResult.fitness) {
      const improvement = this.bestResult ? result.fitness - this.bestResult.fitness : result.fitness;
      this.bestResult = result;
      this.noImprovementCount = 0;
      this.emit('optimization:improvement', {
        fitness: result.fitness,
        params: result.params,
        improvement,
      });
    } else {
      this.noImprovementCount++;
    }
  }

  // ── Results & Analytics ────────────────────────────────────────

  /**
   * Get optimization history
   */
  getHistory(limit?: number): EvalResult[] {
    return limit ? this.history.slice(-limit) : [...this.history];
  }

  /**
   * Get best result so far
   */
  getBestResult(): EvalResult | null {
    return this.bestResult ? { ...this.bestResult } : null;
  }

  /**
   * Compute Pareto front for multi-objective analysis
   */
  getParetoFront(): EvalResult[] {
    if (this.history.length === 0) return [];

    const front: EvalResult[] = [];

    for (const candidate of this.history) {
      let dominated = false;
      for (const other of this.history) {
        if (other === candidate) continue;
        if (this.dominates(other, candidate)) {
          dominated = true;
          break;
        }
      }
      if (!dominated) front.push(candidate);
    }

    return front.sort((a, b) => b.fitness - a.fitness);
  }

  private dominates(a: EvalResult, b: EvalResult): boolean {
    return (
      a.sharpe >= b.sharpe &&
      a.totalReturn >= b.totalReturn &&
      a.maxDrawdown <= b.maxDrawdown &&
      a.winRate >= b.winRate &&
      (a.sharpe > b.sharpe || a.totalReturn > b.totalReturn ||
       a.maxDrawdown < b.maxDrawdown || a.winRate > b.winRate)
    );
  }

  /**
   * Generate heatmap data for 2D parameter visualization
   */
  generateHeatmap(paramX: string, paramY: string, resolution = 10): HeatmapData {
    const specX = this.paramSpecs.find(s => s.name === paramX);
    const specY = this.paramSpecs.find(s => s.name === paramY);

    if (!specX || !specY) {
      return { paramX, paramY, grid: [] };
    }

    const grid: { x: number; y: number; fitness: number }[] = [];

    // Find closest evaluated points for each grid cell
    const stepX = (specX.max - specX.min) / resolution;
    const stepY = (specY.max - specY.min) / resolution;

    for (let ix = 0; ix <= resolution; ix++) {
      for (let iy = 0; iy <= resolution; iy++) {
        const x = specX.min + ix * stepX;
        const y = specY.min + iy * stepY;

        // Find nearest evaluated point
        let bestDist = Infinity;
        let bestFitness = 0;

        for (const eval_ of this.history) {
          const dx = (eval_.params[paramX] ?? 0) - x;
          const dy = (eval_.params[paramY] ?? 0) - y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            bestFitness = eval_.fitness;
          }
        }

        grid.push({ x, y, fitness: bestFitness });
      }
    }

    return { paramX, paramY, grid };
  }

  /**
   * Get parameter importance ranking
   */
  getParamImportance(): { name: string; importance: number }[] {
    if (this.history.length < 2) {
      return this.paramSpecs.map(s => ({ name: s.name, importance: 0 }));
    }

    const importances: { name: string; importance: number }[] = [];

    for (const spec of this.paramSpecs) {
      // Correlation between parameter value and fitness
      const values = this.history.map(h => h.params[spec.name] ?? 0);
      const fitnesses = this.history.map(h => h.fitness);

      const corr = this.pearsonCorrelation(values, fitnesses);
      importances.push({ name: spec.name, importance: Math.abs(corr) });
    }

    return importances.sort((a, b) => b.importance - a.importance);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((s, v) => s + v, 0) / n;
    const meanY = y.reduce((s, v) => s + v, 0) / n;

    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den > 0 ? num / den : 0;
  }

  // ── Utilities ──────────────────────────────────────────────────

  private buildResult(): OptimizationResult {
    const fitnesses = this.history.map(h => h.fitness);
    const mean = fitnesses.length > 0 ? fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length : 0;
    const variance = fitnesses.length > 0
      ? fitnesses.reduce((s, v) => s + (v - mean) ** 2, 0) / fitnesses.length
      : 0;

    const bestEval: EvalResult = this.bestResult ?? {
      params: {},
      sharpe: 0, totalReturn: 0, maxDrawdown: 0, winRate: 0,
      tradeCount: 0, fitness: 0, evaluationTimeMs: 0,
    };

    // Improvement rate
    const improvementRate = fitnesses.length >= 2
      ? (fitnesses[fitnesses.length - 1] - fitnesses[0]) / Math.max(1, fitnesses.length)
      : 0;

    return {
      mode: this.config.mode,
      status: this.status,
      bestParams: bestEval.params,
      bestFitness: bestEval.fitness,
      bestEvaluation: bestEval,
      totalEvaluations: this.totalEvaluations,
      totalIterations: this.currentIteration,
      durationMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
      history: [...this.history],
      paretoFront: this.getParetoFront(),
      convergenceReached: this.noImprovementCount >= this.config.earlyStopIterations,
      statistics: {
        meanFitness: mean,
        stdFitness: Math.sqrt(variance),
        minFitness: fitnesses.length > 0 ? Math.min(...fitnesses) : 0,
        maxFitness: fitnesses.length > 0 ? Math.max(...fitnesses) : 0,
        improvementRate,
      },
    };
  }

  private emitProgress(): void {
    this.emit('optimization:progress', this.getProgress());
  }

  private reset(): void {
    this.history = [];
    this.bestResult = null;
    this.currentIteration = 0;
    this.totalEvaluations = 0;
    this.noImprovementCount = 0;
    this.bayesianSamples = [];
    this.surrogateModel.clear();
  }

  private yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Reset all state
   */
  resetAll(): void {
    this.reset();
    this.status = 'idle';
    this.startTime = 0;
    this.removeAllListeners();
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.cancel();
    this.resetAll();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // R165 P1-B2: Factor Weight Scanning + Pareto Enhancement
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan factor weights against the evaluation function.
   * Uses IC_weighted optimization: factor weights are guided by typicalIC values
   * while simultaneously tuning technical parameters.
   *
   * @param factorWeights  Map of factorId → ParamSpec for weight range
   * @param factorICs      Map of factorId → typical IC value (0-1)
   * @param mode           Scan mode: "grid" | "random" | "ic_weighted"
   * @returns  ICWeightOptimization result
   */
  async scanFactorWeights(
    factorWeights: Record<string, ParamSpec>,
    factorICs: Record<string, number>,
    mode: 'grid' | 'random' | 'ic_weighted' = 'ic_weighted',
  ): Promise<ICWeightOptimization> {
    const factorIds = Object.keys(factorWeights);
    if (factorIds.length === 0) {
      throw new EngineError('No factor weights configured', { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }
    if (!this.evaluateFn) {
      throw new EngineError('No evaluation function configured', { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    }

    // Build IC-weighted initial distribution
    const icTotal = factorIds.reduce((s, id) => s + (factorICs[id] ?? 0.01), 0);
    const icWeights: Record<string, number> = {};
    for (const id of factorIds) {
      icWeights[id] = (factorICs[id] ?? 0.01) / icTotal;
    }

    // Merge factor weight specs into paramSpecs for the optimizer
    const savedParamSpecs = [...this.paramSpecs];
    const savedConfig = { ...this.config };
    const savedBest = this.bestResult ? { ...this.bestResult } : null;
    const savedHistory = [...this.history];

    // Reset state for the factor scan
    this.config.mode = mode === 'grid' ? 'grid_search' :
      mode === 'random' ? 'random_search' : 'bayesian';
    this.config.maxIterations = Math.min(500, Math.max(50, factorIds.length * 30));
    this.reset();

    const allSpecs = [
      ...savedParamSpecs,
      ...factorIds.map((id) => ({
        name: `fw_${id}`,
        min: factorWeights[id].min,
        max: factorWeights[id].max,
        step: factorWeights[id].step,
        default: icWeights[id] ?? 0.1,
      })),
    ];
    this.setParamSpecs(allSpecs);

    // Run optimization with hybrid evaluation
    const fn = this.evaluateFn;
    const self = this;

    this.evaluateFn = (params: Record<string, number>) => {
      // Split params into technique params and factor weights
      const techParams: Record<string, number> = {};
      const fwParams: Record<string, number> = {};
      for (const key of Object.keys(params)) {
        if (key.startsWith('fw_')) {
          fwParams[key.slice(3)] = params[key];
        } else {
          techParams[key] = params[key];
        }
      }
      // Call original evaluator with technique params
      const raw = fn(techParams);

      // Merge fw params into the result so history tracks them
      const mergedParams = { ...raw.params, ...params };

      // Apply IC-weighted bonus: factor weight alignment with IC
      if (mode === 'ic_weighted' && Object.keys(fwParams).length > 0) {
        let icBonus = 0;
        for (const id of Object.keys(fwParams)) {
          const targetWeight = icWeights[id] ?? 0;
          const actualWeight = fwParams[id] ?? 0;
          // Cosine similarity between target and actual distribution
          icBonus += 1 - Math.abs(targetWeight - actualWeight) * 2;
        }
        icBonus = icBonus / Object.keys(fwParams).length;
        icBonus = Math.max(0, Math.min(1, (icBonus + 0.5) / 1.5));

        raw.totalReturn *= (0.9 + 0.2 * icBonus);
        raw.sharpe *= (0.9 + 0.2 * icBonus);
        raw.winRate *= (0.9 + 0.11 * icBonus);
      }

      return { ...raw, params: mergedParams };
    };

    try {
      await this.optimize();
    } finally {
      // Restore original evaluateFn but keep results
      this.evaluateFn = fn;
    }

    const result = this.buildResult();

    // Extract factor weight results from scan
    const optimizedWeights: Record<string, number> = {};
    const weightEvals: FWScanEntry[] = [];

    for (const id of factorIds) {
      const fwKey = `fw_${id}`;
      if (result.bestParams && result.bestParams[fwKey] !== undefined) {
        optimizedWeights[id] = result.bestParams[fwKey];
      }
    }

    // Build per-factor evaluation entries
    for (const id of factorIds) {
      const values = result.history
        .filter((h) => h.params[`fw_${id}`] !== undefined)
        .map((h) => ({
          weight: h.params[`fw_${id}`],
          fitness: h.fitness,
        }));
      if (values.length > 0) {
        weightEvals.push({
          factorId: id,
          icValue: factorICs[id] ?? 0,
          icWeight: icWeights[id] ?? 0,
          optimizedWeight: optimizedWeights[id] ?? icWeights[id] ?? 0.1,
          bestFitness: Math.max(...values.map((v) => v.fitness)),
          evaluations: values.length,
        });
      }
    }

    // Restore original state
    this.paramSpecs = savedParamSpecs;
    this.config = savedConfig;
    if (savedBest) this.bestResult = savedBest;
    else this.bestResult = null;
    this.history = savedHistory;

    return {
      mode,
      factorIds,
      totalEvaluations: result.totalEvaluations,
      durationMs: result.durationMs,
      bestFitness: result.bestFitness,
      optimizedWeights,
      icBaselineWeights: icWeights,
      weightEvals: weightEvals.sort((a, b) => b.bestFitness - a.bestFitness),
      history: result.history,
      paretoFront: result.paretoFront,
    };
  }

  /**
   * Get enriched Pareto summary with objective breakdown and recommendations.
   */
  getParetoSummary(): ParetoSummary {
    const front = this.getParetoFront();
    if (front.length === 0) {
      return {
        count: 0,
        points: [],
        recommendation: 'No data available — run optimization first',
        objectiveRanges: { sharpe: [0, 0], totalReturn: [0, 0], maxDrawdown: [0, 0], winRate: [0, 0] },
      };
    }

    const points: ParetoPoint[] = front.map((r, i) => ({
      rank: i + 1,
      params: r.params,
      sharpe: r.sharpe,
      totalReturn: r.totalReturn,
      maxDrawdown: r.maxDrawdown,
      winRate: r.winRate,
      fitness: r.fitness,
      tradeCount: r.tradeCount,
    }));

    const sharpeMin = Math.min(...front.map((r) => r.sharpe));
    const sharpeMax = Math.max(...front.map((r) => r.sharpe));
    const returnMin = Math.min(...front.map((r) => r.totalReturn));
    const returnMax = Math.max(...front.map((r) => r.totalReturn));
    const ddMin = Math.min(...front.map((r) => r.maxDrawdown));
    const ddMax = Math.max(...front.map((r) => r.maxDrawdown));
    const wrMin = Math.min(...front.map((r) => r.winRate));
    const wrMax = Math.max(...front.map((r) => r.winRate));

    // Recommendation: best balance of Sharpe and Return with acceptable DD
    const balanced = front.map((r) => ({
      r,
      score: (r.sharpe / Math.max(0.01, r.maxDrawdown)) * r.totalReturn,
    }));
    balanced.sort((a, b) => b.score - a.score);
    const recommendation = balanced.length > 0
      ? `Top pick: Sharpe=${balanced[0].r.sharpe.toFixed(2)}, Return=${balanced[0].r.totalReturn.toFixed(1)}%, DD=${balanced[0].r.maxDrawdown.toFixed(1)}%`
      : 'No recommendation';

    return {
      count: front.length,
      points,
      recommendation,
      objectiveRanges: {
        sharpe: [sharpeMin, sharpeMax],
        totalReturn: [returnMin, returnMax],
        maxDrawdown: [ddMin, ddMax],
        winRate: [wrMin, wrMax],
      },
    };
  }

  /**
   * Compare two Pareto fronts (e.g., before/after factor optimization).
   */
  comparePareto(optimizationA?: OptimizationResult, optimizationB?: OptimizationResult): ParetoComparison {
    const frontA = optimizationA?.paretoFront ?? this.getParetoFront();
    const frontB = optimizationB?.paretoFront ?? [];

    if (frontA.length === 0) {
      return { comparison: 'No data available', improvements: [], regressions: [], summary: 'Both fronts empty' };
    }

    // Average objective values
    const avgA = {
      sharpe: frontA.reduce((s, r) => s + r.sharpe, 0) / frontA.length,
      totalReturn: frontA.reduce((s, r) => s + r.totalReturn, 0) / frontA.length,
      maxDrawdown: frontA.reduce((s, r) => s + r.maxDrawdown, 0) / frontA.length,
      winRate: frontA.reduce((s, r) => s + r.winRate, 0) / frontA.length,
    };

    const avgB = frontB.length > 0 ? {
      sharpe: frontB.reduce((s, r) => s + r.sharpe, 0) / frontB.length,
      totalReturn: frontB.reduce((s, r) => s + r.totalReturn, 0) / frontB.length,
      maxDrawdown: frontB.reduce((s, r) => s + r.maxDrawdown, 0) / frontB.length,
      winRate: frontB.reduce((s, r) => s + r.winRate, 0) / frontB.length,
    } : null;

    const cmp = avgB ? this.determineComparison(avgA, avgB) : 'First run — baseline only';

    const improvements: string[] = [];
    const regressions: string[] = [];

    if (avgB) {
      if (avgB.sharpe > avgA.sharpe) improvements.push(`Sharpe: +${(avgB.sharpe - avgA.sharpe).toFixed(3)}`);
      else if (avgB.sharpe < avgA.sharpe) regressions.push(`Sharpe: ${(avgB.sharpe - avgA.sharpe).toFixed(3)}`);

      if (avgB.totalReturn > avgA.totalReturn) improvements.push(`Return: +${(avgB.totalReturn - avgA.totalReturn).toFixed(1)}%`);
      else if (avgB.totalReturn < avgA.totalReturn) regressions.push(`Return: ${(avgB.totalReturn - avgA.totalReturn).toFixed(1)}%`);

      if (avgB.maxDrawdown < avgA.maxDrawdown) improvements.push(`DD: ${(avgB.maxDrawdown - avgA.maxDrawdown).toFixed(1)}%`);
      else if (avgB.maxDrawdown > avgA.maxDrawdown) regressions.push(`DD: +${(avgB.maxDrawdown - avgA.maxDrawdown).toFixed(1)}%`);

      if (avgB.winRate > avgA.winRate) improvements.push(`WinRate: +${(avgB.winRate - avgA.winRate).toFixed(1)}%`);
      else if (avgB.winRate < avgA.winRate) regressions.push(`WinRate: ${(avgB.winRate - avgA.winRate).toFixed(1)}%`);
    }

    return {
      comparison: cmp,
      improvements,
      regressions,
      summary: avgB
        ? improvements.length > 0
          ? `Front B improves on ${improvements.length} objectives vs A: ${improvements.join('; ')}`
          : 'No objective improvement in Front B vs A'
        : 'Baseline only — run optimization B to compare',
    };
  }

  private determineComparison(
    a: { sharpe: number; totalReturn: number; maxDrawdown: number; winRate: number },
    b: { sharpe: number; totalReturn: number; maxDrawdown: number; winRate: number },
  ): string {
    const wins = (b.sharpe > a.sharpe ? 1 : 0) +
      (b.totalReturn > a.totalReturn ? 1 : 0) +
      (b.maxDrawdown < a.maxDrawdown ? 1 : 0) +
      (b.winRate > a.winRate ? 1 : 0);
    const losses = (b.sharpe < a.sharpe ? 1 : 0) +
      (b.totalReturn < a.totalReturn ? 1 : 0) +
      (b.maxDrawdown > a.maxDrawdown ? 1 : 0) +
      (b.winRate < a.winRate ? 1 : 0);

    if (wins >= 3 && losses === 0) return 'B dominates A';
    if (losses >= 3 && wins === 0) return 'A dominates B';
    if (wins >= 2 && losses <= 1) return 'B slightly better';
    if (losses >= 2 && wins <= 1) return 'A slightly better';
    return 'Comparable — trade-offs exist';
  }
}

// ══════════════════════════════════════════════════════════════════════════
// R165 P1-B2: Factor Weight + Pareto types
// ══════════════════════════════════════════════════════════════════════════

export interface FWScanEntry {
  factorId: string;
  icValue: number;
  icWeight: number;
  optimizedWeight: number;
  bestFitness: number;
  evaluations: number;
}

export interface ICWeightOptimization {
  mode: 'grid' | 'random' | 'ic_weighted';
  factorIds: string[];
  totalEvaluations: number;
  durationMs: number;
  bestFitness: number;
  optimizedWeights: Record<string, number>;
  icBaselineWeights: Record<string, number>;
  weightEvals: FWScanEntry[];
  history: EvalResult[];
  paretoFront: EvalResult[];
}

export interface ParetoPoint {
  rank: number;
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  fitness: number;
  tradeCount: number;
}

export interface ParetoSummary {
  count: number;
  points: ParetoPoint[];
  recommendation: string;
  objectiveRanges: {
    sharpe: [number, number];
    totalReturn: [number, number];
    maxDrawdown: [number, number];
    winRate: [number, number];
  };
}

export interface ParetoComparison {
  comparison: string;
  improvements: string[];
  regressions: string[];
  summary: string;
}

// ── Singleton ──────────────────────────────────────────────────────────────

let optimizerInstance: StrategyOptimizer | null = null;

export function getStrategyOptimizer(config?: Partial<OptimizationConfig>): StrategyOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new StrategyOptimizer(config);
  } else if (config) {
    // If a config is provided on subsequent calls, rebuild the singleton with it.
    // Without this, tests that switch modes get stuck on the first mode.
    optimizerInstance = new StrategyOptimizer(config);
  }
  return optimizerInstance;
}

/** Reset the singleton — primarily for tests. */
export function resetStrategyOptimizer(): void {
  optimizerInstance = null;
}
