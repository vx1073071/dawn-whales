// T79: Strategy Parameter Optimizer (Grid Search)
export interface ParameterGrid {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizationResult {
  params: Record<string, number>;
  score: number;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
}

export type ScoringFunction = (params: Record<string, number>) => Promise<{
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}>;

export class StrategyOptimizer {
  private scoreWeight: 'sharpe' | 'return' | 'calmar' | 'balanced' = 'sharpe';

  setScoreWeight(weight: 'sharpe' | 'return' | 'calmar' | 'balanced'): void {
    this.scoreWeight = weight;
  }

  generateCombinations(grid: ParameterGrid[]): Record<string, number>[] {
    const combos: Record<string, number>[] = [{}];

    for (const param of grid) {
      const newCombos: Record<string, number>[] = [];
      for (const combo of combos) {
        for (let v = param.min; v <= param.max; v += param.step) {
          newCombos.push({ ...combo, [param.name]: Math.round(v * 1000) / 1000 });
        }
      }
      combos.length = 0;
      combos.push(...newCombos);
    }

    return combos;
  }

  async optimize(
    grid: ParameterGrid[],
    scoreFn: ScoringFunction,
    maxCombinations = 100
  ): Promise<OptimizationResult[]> {
    let combos = this.generateCombinations(grid);
    if (combos.length > maxCombinations) {
      combos = combos.slice(0, maxCombinations);
    }

    const results: OptimizationResult[] = [];

    for (const params of combos) {
      const metrics = await scoreFn(params);
      results.push({
        params,
        score: this._score(metrics),
        metrics,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  async walkForward(
    trainGrid: ParameterGrid[],
    scoreFn: ScoringFunction,
    windows: number = 3
  ): Promise<OptimizationResult[]> {
    const allResults: OptimizationResult[] = [];
    const combos = this.generateCombinations(trainGrid);

    for (let w = 0; w < windows; w++) {
      for (const params of combos) {
        const metrics = await scoreFn(params);
        allResults.push({ params, score: this._score(metrics), metrics });
      }
    }

    return allResults.sort((a, b) => b.score - a.score);
  }

  private _score(metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  }): number {
    switch (this.scoreWeight) {
      case 'sharpe': return metrics.sharpeRatio;
      case 'return': return metrics.totalReturn;
      case 'calmar':
        return Math.abs(metrics.maxDrawdown) > 0
          ? metrics.totalReturn / Math.abs(metrics.maxDrawdown)
          : metrics.totalReturn * 10;
      case 'balanced':
        return metrics.sharpeRatio * metrics.winRate;
    }
  }
}
