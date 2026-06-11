// ── Parameter Scanner — parametersearch + ─────────────────────────
// parameter，parameter

import log from 'electron-log';
import { BacktestEngine } from '../backtest/backtest-engine';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


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
  best: ScanResult;                              // 最优parameter
  robust: ScanResult;                            // 最稳健parameter
  top10: ScanResult[];                           // Top 10 parameter组合
  heatmap: HeatmapData;                          // parameterheatmap
  neighborhoodAnalysis: NeighborhoodResult;      // 邻域分析
  recommendation: string;
  warnings: string[];
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
  robustnessRatio: number;   // neighborAvg / bestSharpe (>0.7 稳健)
  robustnessGrade: string;   // S/A/B/C/D/F
  details: {
    params: Record<string, number>;
    sharpe: number;
  }[];
}

// ── Parameter Scanner ──────────────────────────────────────────────────────

export class ParameterScanner {
  private backtestEngine: BacktestEngine;

  constructor() {
    this.backtestEngine = new BacktestEngine();
    log.info('[ParameterScanner] Initialized');
  }

  /**
   * executeparameter sweep
   */
  async run(config: ScannerConfig): Promise<ScannerReport> {
    const combinations = this.generateCombinations(config.paramRanges);
    log.info(`[ParameterScanner] Scanning ${combinations.length} parameter combinations...`);

    if (combinations.length === 0) {
      return this.emptyReport(i18n.t('parameterScanner.k1'));
    }

    if (combinations.length > 5000) {
      log.warn(`[ParameterScanner] Large scan: ${combinations.length} combinations, may take time`);
    }

 // backtestparameter
    const results: ScanResult[] = [];

    for (const params of combinations) {
      const strategy: StrategyConfig = {
        ...config.strategy,
        params: { ...config.strategy.params, ...params },
      };

      try {
        const btResult = await this.backtestEngine.run({
          symbol: config.symbol,
          initialCapital: config.initialCapital,
          commission: config.commission,
          slippage: config.slippage,
          strategy,
          klines: config.klines,
        });

        if (btResult.success && btResult.result) {
          results.push({
            params,
            sharpe: btResult.result.sharpeRatio,
            totalReturn: btResult.result.totalReturn,
            annualReturn: btResult.result.annualReturn,
            maxDrawdown: btResult.result.maxDrawdown,
            winRate: btResult.result.winRate,
            profitFactor: btResult.result.profitFactor,
            totalTrades: btResult.result.totalTrades,
            avgHoldingBars: btResult.result.avgHoldingBars,
          });
        }
      } catch (err: unknown) {
        log.warn('[ParameterScanner] Backtest failed for params:', params, err.message);
      }
    }

    if (results.length === 0) {
      return this.emptyReport(i18n.t('parameterScanner.k2'));
    }

 // sort ()
    const sorted = this.sortByTarget(results, config.optimizationTarget);
    const best = sorted[0];
    const top10 = sorted.slice(0, Math.min(10, sorted.length));

 // parameter ()
    const robust = this.findRobustParams(results, config.paramRanges);

    // heatmap
    const heatmap = this.generateHeatmap(config.paramRanges, results, config.optimizationTarget);

 //
    const neighborhood = this.analyzeNeighborhood(best, results, config.paramRanges);

 // warning
    const recommendation = this.generateRecommendation(best, robust, neighborhood);
    const warnings = this.generateWarnings(results, best, neighborhood);

    log.info(`[ParameterScanner] Done: ${results.length}/${combinations.length} valid, best Sharpe=${best.sharpe.toFixed(2)}, robust=${neighborhood.robustnessGrade}`);

    return {
      success: true,
      totalCombinations: combinations.length,
      validResults: results.length,
      best,
      robust,
      top10,
      heatmap,
      neighborhoodAnalysis: neighborhood,
      recommendation,
      warnings,
    };
  }

  // ── sort ──────────────────────────────────────────────────────────────

  private sortByTarget(results: ScanResult[], target: string): ScanResult[] {
    const sorted = [...results];
    switch (target) {
      case 'sharpe':
        return sorted.sort((a, b) => b.sharpe - a.sharpe);
      case 'return':
        return sorted.sort((a, b) => b.totalReturn - a.totalReturn);
      case 'calmar':
        return sorted.sort((a, b) => {
          const calmarA = a.maxDrawdown !== 0 ? a.annualReturn / Math.abs(a.maxDrawdown) : 0;
          const calmarB = b.maxDrawdown !== 0 ? b.annualReturn / Math.abs(b.maxDrawdown) : 0;
          return calmarB - calmarA;
        });
      case 'profitFactor':
        return sorted.sort((a, b) => b.profitFactor - a.profitFactor);
      default:
        return sorted.sort((a, b) => b.sharpe - a.sharpe);
    }
  }

 // ── parameterfilter ──────────────────────────────────────────────────────

  private findRobustParams(results: ScanResult[], ranges: ParamRange[]): ScanResult {
 // ， Sharpe
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

 // = parameter ()
      return adjacentCount === totalCount && JSON.stringify(r.params) !== JSON.stringify(params);
    });
  }

 // ── ──────────────────────────────────────────────────────────

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

  // ── heatmap ────────────────────────────────────────────────────────────

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

 // ── ──────────────────────────────────────────────────────────

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

 // ── warning ──────────────────────────────────────────────────────────

  private generateRecommendation(
    best: ScanResult,
    robust: ScanResult,
    neighborhood: NeighborhoodResult
  ): string {
    if (neighborhood.robustnessGrade === 'S' || neighborhood.robustnessGrade === 'A') {
      const same = JSON.stringify(best.params) === JSON.stringify(robust.params);
      if (same) {
        return i18n.t('parameterScanner.k3');
      }
      return i18n.t('parameterScanner.k4');
    }
    if (neighborhood.robustnessGrade === 'B' || neighborhood.robustnessGrade === 'C') {
      return i18n.t('parameterScanner.k5');
    }
    return i18n.t('parameterScanner.k6');
  }

  private generateWarnings(
    results: ScanResult[],
    best: ScanResult,
    neighborhood: NeighborhoodResult
  ): string[] {
    const warnings: string[] = [];

    if (best.totalTrades < 20) {
      warnings.push(i18n.t('parameterScanner.k7'));
    }

    if (best.sharpe > 3) {
      warnings.push(i18n.t('parameterScanner.k8'));
    }

    if (neighborhood.robustnessRatio < 0.5) {
      warnings.push(i18n.t('parameterScanner.k9'));
    }

    const negativeResults = results.filter(r => r.totalReturn < 0).length;
    if (negativeResults > results.length * 0.7) {
      warnings.push(i18n.t('parameterScanner.k10'));
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
    };
  }
}
