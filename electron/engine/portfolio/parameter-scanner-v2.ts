// ── Parameter Scanner v2 — 内存优化 + 流式处理 ───────────────────────────
// J3 优化：大规模参数扫描内存管理
// 改进点：
// 1. 流式处理（不一次性加载所有结果）
// 2. TopK 堆（只保留最优 K 个结果，节省 99% 内存）
// 3. 增量统计（在线计算均值/方差，不存储全部数据）
// 4. 自动分页（超大数据集分批次处理）
// 5. 并行回测（集成 ParallelBacktestEngine）

import log from 'electron-log';
import { BacktestEngine, ParallelBacktestEngine } from '../backtest/backtest-engine-parallel';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

interface KLine {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StrategyConfig {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'custom';
  params: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ParamRange {
  name: string;
  values: number[];
}

export interface ScannerConfig {
  symbol: string;
  strategy: StrategyConfig;
  paramRanges: ParamRange[];
  initialCapital: number;
  commission: number;
  slippage: number;
  klines: KLine[];
  optimizationTarget: 'sharpe' | 'return' | 'calmar' | 'profitFactor';
  maxMemory?: number;  // 最大内存使用（结果数量），默认 1000
}

interface ScanResult {
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  annualReturn: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgHoldingBars: number;
}

export interface ScannerReport {
  success: boolean;
  totalCombinations: number;
  validResults: number;
  best: ScanResult;
  robust: ScanResult;
  top10: ScanResult[];
  heatmap: HeatmapData;
  neighborhoodAnalysis: NeighborhoodResult;
  recommendation: string;
  warnings: string[];
  memoryUsage: {
    peakResults: number;
    finalResults: number;
    memorySaved: string;
  };
}

interface HeatmapData {
  paramX: string;
  paramY: string;
  xValues: number[];
  yValues: number[];
  matrix: number[][];
}

interface NeighborhoodResult {
  bestParams: Record<string, number>;
  bestSharpe: number;
  neighborAvgSharpe: number;
  neighborStdDev: number;
  robustnessRatio: number;
  robustnessGrade: string;
  details: {
    params: Record<string, number>;
    sharpe: number;
  }[];
}

// ── TopK 堆（最小堆，保留最大的 K 个元素）─────────────────────────────────

class TopKHeap {
  private heap: ScanResult[] = [];
  private k: number;
  private targetKey: (r: ScanResult) => number;

  constructor(k: number, target: string) {
    this.k = k;
    this.targetKey = this.getTargetFunction(target);
  }

  private getTargetFunction(target: string): (r: ScanResult) => number {
    switch (target) {
      case 'return': return r => r.totalReturn;
      case 'calmar': return r => r.maxDrawdown !== 0 ? r.annualReturn / Math.abs(r.maxDrawdown) : 0;
      case 'profitFactor': return r => r.profitFactor;
      default: return r => r.sharpe;
    }
  }

  push(result: ScanResult) {
    const value = this.targetKey(result);
    
    if (this.heap.length < this.k) {
      this.heap.push(result);
      this.bubbleUp(this.heap.length - 1);
    } else if (value > this.targetKey(this.heap[0])) {
      this.heap[0] = result;
      this.bubbleDown(0);
    }
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.targetKey(this.heap[idx]) >= this.targetKey(this.heap[parent])) break;
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    }
  }

  private bubbleDown(idx: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      
      if (left < n && this.targetKey(this.heap[left]) < this.targetKey(this.heap[smallest])) {
        smallest = left;
      }
      if (right < n && this.targetKey(this.heap[right]) < this.targetKey(this.heap[smallest])) {
        smallest = right;
      }
      
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }

  getAll(): ScanResult[] {
    return this.heap.sort((a, b) => this.targetKey(b) - this.targetKey(a));
  }

  size(): number {
    return this.heap.length;
  }
}

// ── 增量统计计算器 ───────────────────────────────────────────────────────

class IncrementalStats {
  private count = 0;
  private mean = 0;
  private m2 = 0;  // 用于计算方差

  push(value: number) {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  getMean(): number {
    return this.mean;
  }

  getVariance(): number {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0;
  }

  getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }

  getCount(): number {
    return this.count;
  }
}

// ── Parameter Scanner v2 ─────────────────────────────────────────────────

export class ParameterScanner {
  private parallelEngine: ParallelBacktestEngine;

  constructor(maxWorkers?: number) {
    this.parallelEngine = new ParallelBacktestEngine(maxWorkers);
    log.info('[ParameterScanner v2] Initialized with memory optimization');
  }

  /**
   * 执行参数扫描（内存优化版）
   */
  async run(config: ScannerConfig): Promise<ScannerReport> {
    const startTime = Date.now();
    const combinations = this.generateCombinations(config.paramRanges);
    const maxMemory = config.maxMemory ?? 1000;
    
    log.info(`[ParameterScanner v2] Scanning ${combinations.length} combinations (maxMemory=${maxMemory})`);

    if (combinations.length === 0) {
      return this.emptyReport(i18n.t('parameterScannerV2.k1'));
    }

    // 分批处理（每批 maxMemory 个）
    const batchSize = maxMemory;
    const topK = new TopKHeap(100, config.optimizationTarget);  // 保留 Top 100
    const allStats = new IncrementalStats();  // 增量统计
    let validCount = 0;
    let peakResults = 0;

    for (let i = 0; i < combinations.length; i += batchSize) {
      const batch = combinations.slice(i, i + batchSize);
      
      // 并行回测当前批次
      const batchConfigs = batch.map(params => ({
        symbol: config.symbol,
        initialCapital: config.initialCapital,
        commission: config.commission,
        slippage: config.slippage,
        strategy: {
          ...config.strategy,
          params: { ...config.strategy.params, ...params },
        },
        klines: config.klines,
      }));

      const batchResult = await this.parallelEngine.runParallel(batchConfigs);
      
      // 处理结果
      for (const result of batchResult.results) {
        if (result.success && result.result) {
          const scanResult: ScanResult = {
            params: batch[batchResult.results.indexOf(result)] || {},
            sharpe: result.result.sharpeRatio,
            totalReturn: result.result.totalReturn,
            annualReturn: result.result.annualReturn,
            maxDrawdown: result.result.maxDrawdown,
            winRate: result.result.winRate,
            profitFactor: result.result.profitFactor,
            totalTrades: result.result.totalTrades,
            avgHoldingBars: result.result.avgHoldingBars,
          };
          
          topK.push(scanResult);
          allStats.push(scanResult.sharpe);
          validCount++;
          
          if (topK.size() > peakResults) {
            peakResults = topK.size();
          }
        }
      }

      // 批次完成后释放内存（batchConfigs 会被 GC 回收）
      log.info(`[ParameterScanner v2] Batch ${Math.floor(i / batchSize) + 1} done, valid=${validCount}, topK=${topK.size()}`);
    }

    if (validCount === 0) {
      return this.emptyReport(i18n.t('parameterScannerV2.k2'));
    }

    const sorted = topK.getAll();
    const best = sorted[0];
    const top10 = sorted.slice(0, 10);

    // 稳健参数筛选（使用 Top 100 而非全部结果）
    const robust = this.findRobustParams(sorted, config.paramRanges);
    const heatmap = this.generateHeatmap(config.paramRanges, sorted, config.optimizationTarget);
    const neighborhood = this.analyzeNeighborhood(best, sorted, config.paramRanges);
    const recommendation = this.generateRecommendation(best, robust, neighborhood);
    const warnings = this.generateWarnings(sorted, best, neighborhood);

    const computationMs = Date.now() - startTime;
    const memorySaved = this.formatBytes((combinations.length - peakResults) * 1024);  // 估算

    log.info(`[ParameterScanner v2] Done: ${validCount}/${combinations.length} valid, best Sharpe=${best.sharpe.toFixed(2)}, time=${computationMs}ms`);

    return {
      success: true,
      totalCombinations: combinations.length,
      validResults: validCount,
      best,
      robust,
      top10,
      heatmap,
      neighborhoodAnalysis: neighborhood,
      recommendation,
      warnings,
      memoryUsage: {
        peakResults: peakResults,
        finalResults: sorted.length,
        memorySaved,
      },
    };
  }

  // ── 稳健参数筛选（优化：只搜索 TopK 结果）────────────────────────────────

  private findRobustParams(results: ScanResult[], ranges: ParamRange[]): ScanResult {
    if (results.length === 0) return { params: {}, sharpe: 0, totalReturn: 0, annualReturn: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, totalTrades: 0, avgHoldingBars: 0 };

    let bestRobust = results[0];
    let bestNeighborAvg = -Infinity;

    for (const r of results) {
      const neighbors = this.getNeighbors(r.params, results, ranges);
      if (neighbors.length === 0) continue;

      const neighborAvg = neighbors.reduce((s, n) => s + n.sharpe, 0) / neighbors.length;
      if (neighborAvg > bestNeighborAvg) {
        bestNeighborAvg = neighborAvg;
        bestRobust = r;
      }
    }

    return bestRobust;
  }

  private getNeighbors(
    params: Record<string, number>,
    allResults: ScanResult[],
    ranges: ParamRange[]
  ): ScanResult[] {
    return allResults.filter(r => {
      let adjacentCount = 0;
      let totalCount = 0;

      for (const range of ranges) {
        const name = range.name;
        if (params[name] !== undefined && r.params[name] !== undefined) {
          const idx = range.values.indexOf(params[name]);
          const rIdx = range.values.indexOf(r.params[name]);
          if (idx >= 0 && rIdx >= 0) {
            totalCount++;
            if (Math.abs(idx - rIdx) <= 1) {
              adjacentCount++;
            }
          }
        }
      }

      return adjacentCount === totalCount && JSON.stringify(r.params) !== JSON.stringify(params);
    });
  }

  // ── 邻域分析 ──────────────────────────────────────────────────────────

  private analyzeNeighborhood(
    best: ScanResult,
    allResults: ScanResult[],
    ranges: ParamRange[]
  ): NeighborhoodResult {
    const neighbors = this.getNeighbors(best.params, allResults, ranges);

    if (neighbors.length === 0) {
      return {
        bestParams: best.params,
        bestSharpe: best.sharpe,
        neighborAvgSharpe: best.sharpe,
        neighborStdDev: 0,
        robustnessRatio: 1,
        robustnessGrade: 'F',
        details: [],
      };
    }

    const neighborSharpes = neighbors.map(n => n.sharpe);
    const avg = neighborSharpes.reduce((a, b) => a + b, 0) / neighborSharpes.length;
    const variance = neighborSharpes.reduce((s, v) => s + (v - avg) ** 2, 0) / neighborSharpes.length;
    const stdDev = Math.sqrt(variance);
    const robustnessRatio = best.sharpe > 0 ? avg / best.sharpe : 0;

    let grade: string;
    if (robustnessRatio >= 0.85) grade = 'S';
    else if (robustnessRatio >= 0.75) grade = 'A';
    else if (robustnessRatio >= 0.65) grade = 'B';
    else if (robustnessRatio >= 0.50) grade = 'C';
    else if (robustnessRatio >= 0.30) grade = 'D';
    else grade = 'F';

    return {
      bestParams: best.params,
      bestSharpe: best.sharpe,
      neighborAvgSharpe: Math.round(avg * 100) / 100,
      neighborStdDev: Math.round(stdDev * 100) / 100,
      robustnessRatio: Math.round(robustnessRatio * 100) / 100,
      robustnessGrade: grade,
      details: neighbors.map(n => ({ params: n.params, sharpe: n.sharpe })).slice(0, 20),
    };
  }

  // ── 热力图 ────────────────────────────────────────────────────────────

  private generateHeatmap(
    ranges: ParamRange[],
    results: ScanResult[],
    target: string
  ): HeatmapData {
    if (ranges.length < 2 || results.length === 0) {
      return { paramX: '', paramY: '', xValues: [], yValues: [], matrix: [] };
    }

    const paramX = ranges[0];
    const paramY = ranges[1];

    const getTargetValue = (r: ScanResult): number => {
      switch (target) {
        case 'return': return r.totalReturn;
        case 'calmar': return r.maxDrawdown !== 0 ? r.annualReturn / Math.abs(r.maxDrawdown) : 0;
        case 'profitFactor': return r.profitFactor;
        default: return r.sharpe;
      }
    };

    const matrix: number[][] = [];
    for (let i = 0; i < paramX.values.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < paramY.values.length; j++) {
        const match = results.find(r =>
          r.params[paramX.name] === paramX.values[i] &&
          r.params[paramY.name] === paramY.values[j]
        );
        matrix[i][j] = match ? getTargetValue(match) : 0;
      }
    }

    return {
      paramX: paramX.name,
      paramY: paramY.name,
      xValues: paramX.values,
      yValues: paramY.values,
      matrix,
    };
  }

  // ── 组合生成 ──────────────────────────────────────────────────────────

  private generateCombinations(ranges: ParamRange[]): Record<string, number>[] {
    if (ranges.length === 0) return [{}];

    let combinations: Record<string, number>[] = [{}];

    for (const range of ranges) {
      const newCombinations: Record<string, number>[] = [];
      for (const combo of combinations) {
        for (const value of range.values) {
          newCombinations.push({ ...combo, [range.name]: value });
        }
      }
      combinations = newCombinations;
    }

    return combinations;
  }

  // ── 建议和警告 ──────────────────────────────────────────────────────────

  private generateRecommendation(
    best: ScanResult,
    robust: ScanResult,
    neighborhood: NeighborhoodResult
  ): string {
    if (neighborhood.robustnessGrade === 'S' || neighborhood.robustnessGrade === 'A') {
      const same = JSON.stringify(best.params) === JSON.stringify(robust.params);
      if (same) {
        return i18n.t('parameterScannerV2.k3');
      }
      return i18n.t('parameterScannerV2.k4');
    }
    if (neighborhood.robustnessGrade === 'B' || neighborhood.robustnessGrade === 'C') {
      return i18n.t('parameterScannerV2.k5');
    }
    return i18n.t('parameterScannerV2.k6');
  }

  private generateWarnings(
    results: ScanResult[],
    best: ScanResult,
    neighborhood: NeighborhoodResult
  ): string[] {
    const warnings: string[] = [];

    if (best.totalTrades < 20) {
      warnings.push(i18n.t('parameterScannerV2.k7'));
    }

    if (best.sharpe > 3) {
      warnings.push(i18n.t('parameterScannerV2.k8'));
    }

    if (neighborhood.robustnessRatio < 0.5) {
      warnings.push(i18n.t('parameterScannerV2.k9'));
    }

    const negativeResults = results.filter(r => r.totalReturn < 0).length;
    if (negativeResults > results.length * 0.7) {
      warnings.push(i18n.t('parameterScannerV2.k10'));
    }

    return warnings;
  }

  private emptyReport(reason: string): ScannerReport {
    return {
      success: false,
      totalCombinations: 0,
      validResults: 0,
      best: { params: {}, sharpe: 0, totalReturn: 0, annualReturn: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, totalTrades: 0, avgHoldingBars: 0 },
      robust: { params: {}, sharpe: 0, totalReturn: 0, annualReturn: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, totalTrades: 0, avgHoldingBars: 0 },
      top10: [],
      heatmap: { paramX: '', paramY: '', xValues: [], yValues: [], matrix: [] },
      neighborhoodAnalysis: {
        bestParams: {}, bestSharpe: 0, neighborAvgSharpe: 0, neighborStdDev: 0,
        robustnessRatio: 0, robustnessGrade: 'F', details: [],
      },
      recommendation: reason,
      warnings: [reason],
      memoryUsage: { peakResults: 0, finalResults: 0, memorySaved: '0 B' },
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
