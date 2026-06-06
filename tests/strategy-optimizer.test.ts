// J-39-01: StrategyOptimizer Tests
import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategyOptimizer,
  ParamSpec,
  EvalResult,
  OptimizationConfig,
} from '../electron/engine/strategy-optimizer';

describe('J-39-01: StrategyOptimizer', () => {
  let optimizer: StrategyOptimizer;

  const defaultParams: ParamSpec[] = [
    { name: 'fast_period', min: 5, max: 20, step: 1, default: 10 },
    { name: 'slow_period', min: 20, max: 50, step: 1, default: 30 },
    { name: 'threshold', min: 0.1, max: 1.0, step: 0.1, default: 0.5 },
  ];

  // Mock evaluation function
  const mockEvaluate = (params: Record<string, number>): EvalResult => {
    const fast = params.fast_period ?? 10;
    const slow = params.slow_period ?? 30;
    const threshold = params.threshold ?? 0.5;

    // Simulate: optimal around fast=12, slow=35, threshold=0.6
    const fastScore = 1 - Math.abs(fast - 12) / 20;
    const slowScore = 1 - Math.abs(slow - 35) / 50;
    const thresholdScore = 1 - Math.abs(threshold - 0.6) / 1.0;

    const sharpe = (fastScore * 0.4 + slowScore * 0.3 + thresholdScore * 0.3) * 2;
    const totalReturn = sharpe * 30;
    const maxDrawdown = Math.max(5, 30 - sharpe * 10);
    const winRate = 40 + sharpe * 15;
    const tradeCount = Math.floor(50 + fast * 2);

    return {
      params,
      sharpe,
      totalReturn,
      maxDrawdown,
      winRate,
      tradeCount,
      fitness: 0, // Will be calculated by optimizer
      evaluationTimeMs: 1,
    };
  };

  beforeEach(() => {
    optimizer = new StrategyOptimizer({
      maxIterations: 20,
      maxEvaluations: 50,
      earlyStopIterations: 10,
    });
    optimizer.setParamSpecs(defaultParams);
    optimizer.setEvaluateFunction(mockEvaluate);
  });

  // ── Configuration Tests ───────────────────────────────────────────

  it('should initialize with default config', () => {
    const config = optimizer.getConfig();
    expect(config.mode).toBe('bayesian');
    expect(config.objectives).toBe('composite');
    expect(config.weights.sharpe).toBe(0.35);
  });

  it('should set parameter specs', () => {
    const specs = optimizer.getParamSpecs();
    expect(specs).toHaveLength(3);
    expect(specs[0].name).toBe('fast_period');
    expect(specs[1].min).toBe(20);
    expect(specs[2].step).toBe(0.1);
  });

  it('should update config', () => {
    optimizer.setConfig({ mode: 'grid_search', maxIterations: 50 });
    const config = optimizer.getConfig();
    expect(config.mode).toBe('grid_search');
    expect(config.maxIterations).toBe(50);
  });

  it('should update weights', () => {
    optimizer.setConfig({ weights: { sharpe: 0.5, return: 0.2, drawdown: 0.2, winRate: 0.1 } });
    const config = optimizer.getConfig();
    expect(config.weights.sharpe).toBe(0.5);
    expect(config.weights.return).toBe(0.2);
  });

  // ── Grid Search Tests ───────────────────────────────────────────

  it('should run grid search optimization', async () => {
    optimizer.setConfig({ mode: 'grid_search', maxIterations: 100 });
    const result = await optimizer.optimize();

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('grid_search');
    expect(result.totalEvaluations).toBeGreaterThan(0);
    expect(result.bestParams).toBeDefined();
    expect(result.bestFitness).toBeGreaterThan(0);
  });

  it('should generate grid combinations', async () => {
    optimizer.setParamSpecs([
      { name: 'a', min: 1, max: 3, step: 1, default: 2 },
      { name: 'b', min: 10, max: 20, step: 5, default: 15 },
    ]);
    optimizer.setConfig({ mode: 'grid_search', maxIterations: 1000, maxEvaluations: 1000 });

    const result = await optimizer.optimize();
    // 3 values for a (1,2,3) * 3 values for b (10,15,20) = 9 combinations
    expect(result.totalEvaluations).toBe(9);
  });

  // ── Random Search Tests ──────────────────────────────────────────

  it('should run random search optimization', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 30 });
    const result = await optimizer.optimize();

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('random_search');
    expect(result.totalEvaluations).toBeGreaterThan(0);
    expect(result.bestParams.fast_period).toBeGreaterThanOrEqual(5);
    expect(result.bestParams.fast_period).toBeLessThanOrEqual(20);
  });

  it('should early stop when no improvement', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 100, earlyStopIterations: 5 });

    // Use a constant function where no improvement is possible
    const constantEval = (params: Record<string, number>): EvalResult => ({
      params,
      sharpe: 1.0,
      totalReturn: 10,
      maxDrawdown: 15,
      winRate: 55,
      tradeCount: 50,
      fitness: 0,
      evaluationTimeMs: 1,
    });
    optimizer.setEvaluateFunction(constantEval);

    const result = await optimizer.optimize();
    expect(result.convergenceReached).toBe(true);
  });

  // ── Bayesian Optimization Tests ──────────────────────────────────

  it('should run bayesian optimization', async () => {
    optimizer.setConfig({ mode: 'bayesian', maxIterations: 25 });
    const result = await optimizer.optimize();

    expect(result.status).toBe('completed');
    expect(result.mode).toBe('bayesian');
    expect(result.totalEvaluations).toBeGreaterThan(0);
  });

  it('should improve over iterations in bayesian mode', async () => {
    optimizer.setConfig({ mode: 'bayesian', maxIterations: 30 });
    const result = await optimizer.optimize();

    // Best fitness should be better than average
    expect(result.bestFitness).toBeGreaterThan(result.statistics.meanFitness);
  });

  // ── Fitness Calculation Tests ────────────────────────────────────

  it('should calculate composite fitness', () => {
    const fitness = optimizer.calculateFitness({
      params: {},
      sharpe: 1.5,
      totalReturn: 25,
      maxDrawdown: 10,
      winRate: 60,
      tradeCount: 100,
    });

    expect(fitness).toBeGreaterThan(0);
    expect(fitness).toBeLessThan(1);
  });

  it('should calculate sharpe-only fitness', () => {
    optimizer.setConfig({ objectives: 'sharpe' });
    const fitness = optimizer.calculateFitness({
      params: {},
      sharpe: 2.0,
      totalReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      tradeCount: 0,
    });

    expect(fitness).toBeGreaterThan(0);
  });

  it('should calculate drawdown fitness (lower is better)', () => {
    optimizer.setConfig({ objectives: 'drawdown' });

    const lowDD = optimizer.calculateFitness({
      params: {},
      sharpe: 0,
      totalReturn: 0,
      maxDrawdown: 5,
      winRate: 0,
      tradeCount: 0,
    });

    const highDD = optimizer.calculateFitness({
      params: {},
      sharpe: 0,
      totalReturn: 0,
      maxDrawdown: 50,
      winRate: 0,
      tradeCount: 0,
    });

    expect(lowDD).toBeGreaterThan(highDD);
  });

  // ── Progress & Status Tests ──────────────────────────────────────

  it('should track optimization progress', async () => {
    const progressUpdates: any[] = [];
    optimizer.on('optimization:progress', (p: any) => progressUpdates.push(p));

    optimizer.setConfig({ mode: 'random_search', maxIterations: 10 });
    await optimizer.optimize();

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[0].status).toBe('running');
    expect(progressUpdates[0].iteration).toBeGreaterThan(0);
  });

  it('should emit improvement events', async () => {
    const improvements: any[] = [];
    optimizer.on('optimization:improvement', (i: any) => improvements.push(i));

    optimizer.setConfig({ mode: 'random_search', maxIterations: 20 });
    await optimizer.optimize();

    expect(improvements.length).toBeGreaterThan(0);
    expect(improvements[0].fitness).toBeGreaterThan(0);
  });

  it('should report correct status transitions', async () => {
    expect(optimizer.getStatus()).toBe('idle');

    optimizer.setConfig({ mode: 'random_search', maxIterations: 5 });
    const promise = optimizer.optimize();

    // Status should be running during optimization
    const progress = optimizer.getProgress();
    expect(progress.status).toBe('running');

    await promise;
    expect(optimizer.getStatus()).toBe('completed');
  });

  // ── Cancellation Tests ───────────────────────────────────────────

  it('should cancel optimization', () => {
    // Verify cancel sets status correctly when called during 'running' state
    // We test the cancel mechanism directly since async cancellation is timing-dependent
    const cancelOptimizer = new StrategyOptimizer({ mode: 'random_search', maxIterations: 5 });
    cancelOptimizer.setParamSpecs(defaultParams);
    cancelOptimizer.setEvaluateFunction(mockEvaluate);

    // Manually set to running (simulating mid-optimization)
    (cancelOptimizer as any).status = 'running';
    expect(cancelOptimizer.getStatus()).toBe('running');

    cancelOptimizer.cancel();
    expect(cancelOptimizer.getStatus()).toBe('cancelled');
  });

  // ── Analytics Tests ──────────────────────────────────────────────

  it('should generate heatmap data', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 20 });
    await optimizer.optimize();

    const heatmap = optimizer.generateHeatmap('fast_period', 'slow_period', 5);
    expect(heatmap.paramX).toBe('fast_period');
    expect(heatmap.paramY).toBe('slow_period');
    expect(heatmap.grid.length).toBeGreaterThan(0);
    expect(heatmap.grid[0]).toHaveProperty('x');
    expect(heatmap.grid[0]).toHaveProperty('y');
    expect(heatmap.grid[0]).toHaveProperty('fitness');
  });

  it('should compute Pareto front', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 30 });
    await optimizer.optimize();

    const pareto = optimizer.getParetoFront();
    expect(pareto.length).toBeGreaterThan(0);
    expect(pareto.length).toBeLessThanOrEqual(optimizer.getHistory().length);
  });

  it('should calculate parameter importance', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 30 });
    await optimizer.optimize();

    const importance = optimizer.getParamImportance();
    expect(importance).toHaveLength(3);
    expect(importance[0]).toHaveProperty('name');
    expect(importance[0]).toHaveProperty('importance');
    expect(importance[0].importance).toBeGreaterThanOrEqual(0);
    expect(importance[0].importance).toBeLessThanOrEqual(1);
  });

  it('should return empty importance for no history', () => {
    const importance = optimizer.getParamImportance();
    expect(importance).toHaveLength(3);
    expect(importance[0].importance).toBe(0);
  });

  // ── Error Handling Tests ─────────────────────────────────────────

  it('should throw error when no param specs', async () => {
    const emptyOptimizer = new StrategyOptimizer();
    emptyOptimizer.setEvaluateFunction(mockEvaluate);

    await expect(emptyOptimizer.optimize()).rejects.toThrow('No parameter specs configured');
  });

  it('should throw error when no evaluate function', async () => {
    const noEvalOptimizer = new StrategyOptimizer();
    noEvalOptimizer.setParamSpecs(defaultParams);

    await expect(noEvalOptimizer.optimize()).rejects.toThrow('No evaluation function configured');
  });

  // ── Result Statistics Tests ──────────────────────────────────────

  it('should compute result statistics', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 20 });
    const result = await optimizer.optimize();

    expect(result.statistics.meanFitness).toBeGreaterThanOrEqual(0);
    expect(result.statistics.stdFitness).toBeGreaterThanOrEqual(0);
    expect(result.statistics.minFitness).toBeLessThanOrEqual(result.statistics.maxFitness);
    expect(typeof result.statistics.improvementRate).toBe('number');
  });

  it('should include best evaluation in result', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 15 });
    const result = await optimizer.optimize();

    expect(result.bestEvaluation).toBeDefined();
    expect(result.bestEvaluation.params).toBeDefined();
    expect(result.bestEvaluation.sharpe).toBeDefined();
    expect(result.bestEvaluation.fitness).toBe(result.bestFitness);
  });

  // ── Reset & Cleanup Tests ────────────────────────────────────────

  it('should reset all state', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 10 });
    await optimizer.optimize();

    optimizer.resetAll();
    expect(optimizer.getStatus()).toBe('idle');
    expect(optimizer.getHistory()).toHaveLength(0);
    expect(optimizer.getBestResult()).toBeNull();
  });

  it('should destroy cleanly', async () => {
    optimizer.setConfig({ mode: 'random_search', maxIterations: 10 });
    await optimizer.optimize();

    optimizer.destroy();
    expect(optimizer.getStatus()).toBe('idle');
    expect(optimizer.listenerCount('optimization:progress')).toBe(0);
  });
});
