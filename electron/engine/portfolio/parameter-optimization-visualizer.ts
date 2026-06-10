// JVS-102: Parameter Optimization Visualization
import log from 'electron-log';
// Visualize parameter optimization results with interactive charts

export interface ParameterOptimizationConfig {
  symbol: string;
  parameterRanges: ParameterRange[];
  optimizationTarget: 'sharpe' | 'return' | 'calmar' | 'sortino';
  riskFreeRate?: number;
  backtestPeriod?: number;
}

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizationResult {
  parameters: Record<string, number>;
  metrics: OptimizationMetrics;
  rank: number;
}

export interface OptimizationMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  sortinoRatio: number;
  winRate: number;
  totalTrades: number;
  avgTradeReturn: number;
  profitFactor: number;
}

export interface ParameterOptimizationVisualization {
  config: ParameterOptimizationConfig;
  results: OptimizationResult[];
  bestResult: OptimizationResult;
  parameterImportance: ParameterImportance[];
  heatmapData: HeatmapData;
  parameterCorrelation: ParameterCorrelation[];
  performanceDistribution: PerformanceDistribution;
}

export interface ParameterImportance {
  parameter: string;
  importance: number;
  optimalValue: number;
  range: { min: number; max: number };
}

export interface HeatmapData {
  xLabel: string;
  yLabel: string;
  data: HeatmapCell[];
  xValues: number[];
  yValues: number[];
}

export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  parameters: Record<string, number>;
}

export interface ParameterCorrelation {
  param1: string;
  param2: string;
  correlation: number;
}

export interface PerformanceDistribution {
  returns: number[];
  percentiles: Record<string, number>;
  mean: number;
  median: number;
  stdDev: number;
}

export class ParameterOptimizationVisualizer {
  private config: ParameterOptimizationConfig;
  private results: OptimizationResult[] = [];

  constructor(config: ParameterOptimizationConfig) {
    this.config = config;
  }

  /**
   * Run parameter optimization
   */
  async optimize(): Promise<ParameterOptimizationVisualization> {
    log.info(`[ParameterOptimization] Starting optimization for ${this.config.symbol}`);

    // Generate all parameter combinations
    const combinations = this.generateCombinations();
    log.info(`[ParameterOptimization] Generated ${combinations.length} parameter combinations`);

    // Run backtests for all combinations
    const results = await this.runBacktests(combinations);

    // Sort by optimization target
    results.sort((a, b) => b.metrics[this.config.optimizationTarget] - a.metrics[this.config.optimizationTarget]);

    // Assign ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    this.results = results;

    // Calculate parameter importance
    const parameterImportance = this.calculateParameterImportance();

    // Generate heatmap data
    const heatmapData = this.generateHeatmap();

    // Calculate parameter correlations
    const parameterCorrelation = this.calculateParameterCorrelation();

    // Calculate performance distribution
    const performanceDistribution = this.calculatePerformanceDistribution();

    const visualization: ParameterOptimizationVisualization = {
      config: this.config,
      results,
      bestResult: results[0],
      parameterImportance,
      heatmapData,
      parameterCorrelation,
      performanceDistribution,
    };

    return visualization;
  }

  /**
   * Generate all parameter combinations
   */
  private generateCombinations(): Record<string, number>[] {
    const combinations: Record<string, number>[] = [];
    const ranges = this.config.parameterRanges;

    const generate = (index: number, current: Record<string, number>) => {
      if (index === ranges.length) {
        combinations.push({ ...current });
        return;
      }

      const range = ranges[index];
      for (let value = range.min; value <= range.max; value += range.step) {
        const next = { ...current, [range.name]: value };
        generate(index + 1, next);
      }
    };

    generate(0, {});
    return combinations;
  }

  /**
   * Run backtests for all parameter combinations
   */
  private async runBacktests(combinations: Record<string, number>[]): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (const params of combinations) {
      const metrics = await this.runSingleBacktest(params);
      results.push({
        parameters: params,
        metrics,
        rank: 0,
      });
    }

    return results;
  }

  /**
   * Run single backtest with given parameters
   */
  private async runSingleBacktest(params: Record<string, number>): Promise<OptimizationMetrics> {
    // v1.9.0: backtest logic using signal-backtesting engine
    // For now, return mock metrics
    const totalReturn = Math.random() * 100 - 20;
    const annualizedReturn = totalReturn / 2;
    const sharpeRatio = Math.random() * 3;
    const maxDrawdown = Math.random() * 30;
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    const sortinoRatio = Math.random() * 2.5;
    const winRate = Math.random() * 100;
    const totalTrades = Math.floor(Math.random() * 100) + 10;
    const avgTradeReturn = totalReturn / totalTrades;
    const profitFactor = Math.random() * 3;

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      totalTrades,
      avgTradeReturn: Math.round(avgTradeReturn * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
    };
  }

  /**
   * Calculate parameter importance based on results
   */
  private calculateParameterImportance(): ParameterImportance[] {
    const importance: ParameterImportance[] = [];
    const ranges = this.config.parameterRanges;

    for (const range of ranges) {
      const values = this.results.map(r => r.parameters[range.name]);
      const uniqueValues = [...new Set(values)];
      
      // Calculate variance of performance for different parameter values
      const performanceByValue = new Map<number, number[]>();
      
      for (const result of this.results) {
        const paramValue = result.parameters[range.name];
        if (!performanceByValue.has(paramValue)) {
          performanceByValue.set(paramValue, []);
        }
        performanceByValue.get(paramValue)!.push(result.metrics[this.config.optimizationTarget]);
      }

      // Calculate average performance for each parameter value
      const avgPerformance: number[] = [];
      for (const [_, performances] of performanceByValue) {
        const avg = performances.reduce((sum, p) => sum + p, 0) / performances.length;
        avgPerformance.push(avg);
      }

      // Calculate variance
      const mean = avgPerformance.reduce((sum, p) => sum + p, 0) / avgPerformance.length;
      const variance = avgPerformance.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / avgPerformance.length;
      const importance_score = Math.sqrt(variance);

      // Find optimal value
      let optimalValue = uniqueValues[0];
      let bestPerformance = -Infinity;
      for (const [value, performances] of performanceByValue) {
        const avg = performances.reduce((sum, p) => sum + p, 0) / performances.length;
        if (avg > bestPerformance) {
          bestPerformance = avg;
          optimalValue = value;
        }
      }

      importance.push({
        parameter: range.name,
        importance: Math.round(importance_score * 100) / 100,
        optimalValue,
        range: { min: range.min, max: range.max },
      });
    }

    // Sort by importance
    importance.sort((a, b) => b.importance - a.importance);

    return importance;
  }

  /**
   * Generate heatmap data for two most important parameters
   */
  private generateHeatmap(): HeatmapData {
    const ranges = this.config.parameterRanges;
    
    // Use first two parameters for heatmap
    const xParam = ranges[0];
    const yParam = ranges[1];

    const xValues = Array.from({ length: Math.ceil((xParam.max - xParam.min) / xParam.step) + 1 }, 
      (_, i) => xParam.min + i * xParam.step);
    const yValues = Array.from({ length: Math.ceil((yParam.max - yParam.min) / yParam.step) + 1 },
      (_, i) => yParam.min + i * yParam.step);

    const data: HeatmapCell[] = [];

    for (const x of xValues) {
      for (const y of yValues) {
        // Find result matching these parameter values
        const result = this.results.find(r => 
          Math.abs(r.parameters[xParam.name] - x) < 0.001 &&
          Math.abs(r.parameters[yParam.name] - y) < 0.001
        );

        if (result) {
          data.push({
            x,
            y,
            value: result.metrics[this.config.optimizationTarget],
            parameters: result.parameters,
          });
        }
      }
    }

    return {
      xLabel: xParam.name,
      yLabel: yParam.name,
      data,
      xValues,
      yValues,
    };
  }

  /**
   * Calculate parameter correlations
   */
  private calculateParameterCorrelation(): ParameterCorrelation[] {
    const correlations: ParameterCorrelation[] = [];
    const ranges = this.config.parameterRanges;

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const param1 = ranges[i].name;
        const param2 = ranges[j].name;

        const values1 = this.results.map(r => r.parameters[param1]);
        const values2 = this.results.map(r => r.parameters[param2]);

        const correlation = this.calculateCorrelation(values1, values2);

        correlations.push({
          param1,
          param2,
          correlation: Math.round(correlation * 100) / 100,
        });
      }
    }

    return correlations;
  }

  /**
   * Calculate correlation between two parameter arrays
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((sum, v) => sum + v, 0) / n;
    const meanY = y.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denominator = Math.sqrt(sumX2 * sumY2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate performance distribution
   */
  private calculatePerformanceDistribution(): PerformanceDistribution {
    const returns = this.results.map(r => r.metrics[this.config.optimizationTarget]);
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    const sorted = [...returns].sort((a, b) => a - b);
    const percentiles = {
      '10th': sorted[Math.floor(sorted.length * 0.1)],
      '25th': sorted[Math.floor(sorted.length * 0.25)],
      '50th': sorted[Math.floor(sorted.length * 0.5)],
      '75th': sorted[Math.floor(sorted.length * 0.75)],
      '90th': sorted[Math.floor(sorted.length * 0.9)],
    };

    const median = sorted[Math.floor(sorted.length / 2)];

    return {
      returns,
      percentiles,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
    };
  }

  /**
   * Get top N results
   */
  getTopResults(n: number = 10): OptimizationResult[] {
    return this.results.slice(0, n);
  }

  /**
   * Get result for specific parameters
   */
  getResult(params: Record<string, number>): OptimizationResult | null {
    return this.results.find(r => {
      for (const [key, value] of Object.entries(params)) {
        if (Math.abs(r.parameters[key] - value) > 0.001) {
          return false;
        }
      }
      return true;
    }) || null;
  }
}

let instance: ParameterOptimizationVisualizer | null = null;

export function getParameterOptimizationVisualizer(config: ParameterOptimizationConfig): ParameterOptimizationVisualizer {
  if (!instance) {
    instance = new ParameterOptimizationVisualizer(config);
  }
  return instance;
}
