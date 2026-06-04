// ── Parallel Backtest Manager ──────────────────────────────────────────────
// 管理多个Web Worker并行执行回测任务
// Target: 10策略 × 5000 bars 并行 < 3s

import { BacktestEngine } from './backtest-engine';

export interface ParallelBacktestConfig {
  configs: any[];
  maxWorkers?: number;
  timeout?: number;
}

export interface ParallelBacktestResult {
  results: Array<{
    index: number;
    config: any;
    result: any;
    error?: string;
    perfMs?: number;
  }>;
  totalPerfMs: number;
  avgPerfMs: number;
  successCount: number;
  errorCount: number;
}

/**
 * 并行执行多个回测任务
 * 由于Electron主进程无法使用Web Worker，使用Promise.all并行执行
 */
export async function runParallelBacktests(config: ParallelBacktestConfig): Promise<ParallelBacktestResult> {
  const { configs, maxWorkers = 4, timeout = 30000 } = config;
  const t0 = performance.now();
  
  // 分批执行，每批maxWorkers个
  const results: ParallelBacktestResult['results'] = [];
  const batches = [];
  
  for (let i = 0; i < configs.length; i += maxWorkers) {
    batches.push(configs.slice(i, i + maxWorkers));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStart = batchIndex * maxWorkers;
    
    const batchPromises = batch.map(async (cfg, idx) => {
      const globalIndex = batchStart + idx;
      const t1 = performance.now();
      
      try {
        const engine = new BacktestEngine();
        const result = await engine.run(cfg);
        const perfMs = performance.now() - t1;
        
        return {
          index: globalIndex,
          config: cfg,
          result,
          perfMs,
        };
      } catch (error: any) {
        return {
          index: globalIndex,
          config: cfg,
          result: null,
          error: error.message,
          perfMs: performance.now() - t1,
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  const totalPerfMs = performance.now() - t0;
  const avgPerfMs = results.reduce((sum, r) => sum + (r.perfMs || 0), 0) / results.length;
  const successCount = results.filter(r => r.result && !r.error).length;
  const errorCount = results.length - successCount;
  
  return {
    results,
    totalPerfMs,
    avgPerfMs,
    successCount,
    errorCount,
  };
}

/**
 * 参数扫描并行执行
 * 生成参数组合并并行回测
 */
export async function runParameterScan(baseConfig: any, paramRanges: Record<string, number[]>): Promise<ParallelBacktestResult> {
  // 生成所有参数组合
  const combinations = generateCombinations(paramRanges);
  
  // 为每个组合生成完整配置
  const configs = combinations.map(params => ({
    ...baseConfig,
    strategy: {
      ...baseConfig.strategy,
      params: {
        ...baseConfig.strategy.params,
        ...params,
      },
    },
  }));
  
  return runParallelBacktests({ configs });
}

/**
 * 生成参数组合
 */
function generateCombinations(paramRanges: Record<string, number[]>): Record<string, number>[] {
  const keys = Object.keys(paramRanges);
  if (keys.length === 0) return [{}];
  
  const [firstKey, ...restKeys] = keys;
  const firstValues = paramRanges[firstKey];
  const restCombinations = generateCombinations(
    restKeys.reduce((acc, key) => {
      acc[key] = paramRanges[key];
      return acc;
    }, {} as Record<string, number[]>)
  );
  
  const combinations: Record<string, number>[] = [];
  for (const value of firstValues) {
    for (const rest of restCombinations) {
      combinations.push({
        [firstKey]: value,
        ...rest,
      });
    }
  }
  
  return combinations;
}

/**
 * Walk-Forward分析并行执行
 * 并行执行多个时间窗口的回测
 */
export async function runWalkForwardParallel(
  baseConfig: any,
  windows: Array<{ trainStart: string; trainEnd: string; testStart: string; testEnd: string }>
): Promise<ParallelBacktestResult> {
  const configs = windows.map(window => ({
    ...baseConfig,
    startDate: window.trainStart,
    endDate: window.trainEnd,
    _testWindow: { start: window.testStart, end: window.testEnd },
  }));
  
  return runParallelBacktests({ configs });
}
