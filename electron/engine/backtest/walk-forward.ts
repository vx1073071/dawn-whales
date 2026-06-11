// ── Walk-Forward Analysis Engine ────────────────────────────────────────────
// ：rollingbacktest
// IS() → OOS() → → OOS

import log from 'electron-log';
import { BacktestEngine } from './backtest-engine';
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

interface ParamRange {
  name: string;          // parameter名 (如 'shortPeriod')
  values: number[];      // 候选值 [5, 10, 15, 20]
}

export interface WFAConfig {
  symbol: string;
  strategy: StrategyConfig;
  paramRanges: ParamRange[];        // 要扫描的parameter范围
  initialCapital: number;
  commission: number;
  slippage: number;
  inSampleBars: number;             // IS 窗口大小 (如 252)
  outOfSampleBars: number;          // OOS 窗口大小 (如 63)
  stepSize: number;                 // 滑动步长 (如 21)
}

interface WindowResult {
  windowIndex: number;
  isStart: number;
  isEnd: number;
  oosStart: number;
  oosEnd: number;
  bestParams: Record<string, number>;
  isSharpe: number;
  oosSharpe: number;
  oosReturn: number;
  oosMaxDrawdown: number;
  decayRatio: number;               // OOS/IS 衰减比
  allISResults: ParamResult[];
  allOOSResults: ParamResult[];
}

interface ParamResult {
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

export interface WFAReport {
  success: boolean;
  summary: {
    totalWindows: number;
    avgOosSharpe: number;
    avgOosReturn: number;
    avgDecayRatio: number;          // 平均衰减比 (>0.5 说明稳健)
    stabilityScore: number;         // 0-100 稳定性评分
    robustnessGrade: string;        // S/A/B/C/D/F
  };
  windows: WindowResult[];
  heatmap: HeatmapData;             // parameterheatmap
  recommendation: string;
  warnings: string[];
}

interface HeatmapData {
  paramX: string;
  paramY: string;
  xValues: number[];
  yValues: number[];
  matrix: number[][];               // [x][y] → Sharpe
}

// ── Walk-Forward Engine ────────────────────────────────────────────────────

export class WalkForwardEngine {
  private backtestEngine: BacktestEngine;

  constructor() {
    this.backtestEngine = new BacktestEngine();
    log.info('[WalkForwardEngine] Initialized');
  }

  /**
   * execute Walk-Forward Analysis
   */
  async run(config: WFAConfig, klines: KLine[]): Promise<WFAReport> {
    log.info(`[WalkForward] Starting WFA: ${klines.length} bars, IS=${config.inSampleBars}, OOS=${config.outOfSampleBars}, step=${config.stepSize}`);

    if (klines.length < config.inSampleBars + config.outOfSampleBars + 50) {
      return {
        success: false,
        summary: { totalWindows: 0, avgOosSharpe: 0, avgOosReturn: 0, avgDecayRatio: 0, stabilityScore: 0, robustnessGrade: 'F' },
        windows: [],
        heatmap: { paramX: '', paramY: '', xValues: [], yValues: [], matrix: [] },
        recommendation: i18n.t('walkForward.k1'),
        warnings: [i18n.t('walkForward.k2')],
      };
    }

    const windows: WindowResult[] = [];
    let offset = 0;

 // rolling
    while (offset + config.inSampleBars + config.outOfSampleBars <= klines.length) {
      const isStart = offset;
      const isEnd = offset + config.inSampleBars;
      const oosStart = isEnd;
      const oosEnd = oosStart + config.outOfSampleBars;

      const isKlines = klines.slice(isStart, isEnd);
      const oosKlines = klines.slice(oosStart, oosEnd);

      log.info(`[WalkForward] Window ${windows.length + 1}: IS[${isStart}-${isEnd}] OOS[${oosStart}-${oosEnd}]`);

 // Step 1: IS parameter sweep，parameter
      const isResults = await this.scanParameters(config, isKlines);
      const bestIS = isResults.reduce((a, b) => a.sharpe > b.sharpe ? a : b);

 // Step 2: parameter OOS 
      const oosResults = await this.testParams(config, oosKlines, [bestIS.params]);
      const bestOOS = oosResults[0];

 // Step 3: 
      const decayRatio = bestIS.sharpe > 0 ? bestOOS.sharpe / bestIS.sharpe : 0;

      windows.push({
        windowIndex: windows.length,
        isStart: klines[isStart].time,
        isEnd: klines[isEnd - 1].time,
        oosStart: klines[oosStart].time,
        oosEnd: klines[oosEnd - 1].time,
        bestParams: bestIS.params,
        isSharpe: bestIS.sharpe,
        oosSharpe: bestOOS.sharpe,
        oosReturn: bestOOS.totalReturn,
        oosMaxDrawdown: bestOOS.maxDrawdown,
        decayRatio,
        allISResults: isResults,
        allOOSResults: oosResults,
      });

      offset += config.stepSize;
    }

    if (windows.length === 0) {
      return {
        success: false,
        summary: { totalWindows: 0, avgOosSharpe: 0, avgOosReturn: 0, avgDecayRatio: 0, stabilityScore: 0, robustnessGrade: 'F' },
        windows: [],
        heatmap: { paramX: '', paramY: '', xValues: [], yValues: [], matrix: [] },
        recommendation: i18n.t('walkForward.k3'),
        warnings: [i18n.t('walkForward.k4')],
      };
    }

 //
    const avgOosSharpe = windows.reduce((s, w) => s + w.oosSharpe, 0) / windows.length;
    const avgOosReturn = windows.reduce((s, w) => s + w.oosReturn, 0) / windows.length;
    const avgDecayRatio = windows.reduce((s, w) => s + w.decayRatio, 0) / windows.length;

 // (0-100)
    const decayScore = Math.min(100, Math.max(0, avgDecayRatio * 100));
    const consistencyScore = this.calculateConsistency(windows);
    const stabilityScore = Math.round(decayScore * 0.6 + consistencyScore * 0.4);

    const robustnessGrade = this.scoreToGrade(stabilityScore);

 // heatmap ( IS )
    const heatmap = this.generateHeatmap(config, windows[windows.length - 1].allISResults);

 // warning
    const recommendation = this.generateRecommendation(stabilityScore, avgOosSharpe, avgDecayRatio);
    const warnings = this.generateWarnings(windows, avgDecayRatio, stabilityScore);

    log.info(`[WalkForward] Done: ${windows.length} windows, avgOOS Sharpe=${avgOosSharpe.toFixed(2)}, decay=${avgDecayRatio.toFixed(2)}, grade=${robustnessGrade}`);

    return {
      success: true,
      summary: {
        totalWindows: windows.length,
        avgOosSharpe: Math.round(avgOosSharpe * 100) / 100,
        avgOosReturn: Math.round(avgOosReturn * 100) / 100,
        avgDecayRatio: Math.round(avgDecayRatio * 100) / 100,
        stabilityScore,
        robustnessGrade,
      },
      windows,
      heatmap,
      recommendation,
      warnings,
    };
  }

  // ── parameter sweep ──────────────────────────────────────────────────────────

  private async scanParameters(config: WFAConfig, klines: KLine[]): Promise<ParamResult[]> {
    const paramCombinations = this.generateParamCombinations(config.paramRanges);
    return this.testParams(config, klines, paramCombinations);
  }

  private async testParams(
    config: WFAConfig,
    klines: KLine[],
    paramSets: Record<string, number>[]
  ): Promise<ParamResult[]> {
    const results: ParamResult[] = [];

    for (const params of paramSets) {
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
          klines,
        });

        if (btResult.success && btResult.result) {
          results.push({
            params,
            sharpe: btResult.result.sharpeRatio,
            totalReturn: btResult.result.totalReturn,
            maxDrawdown: btResult.result.maxDrawdown,
            winRate: btResult.result.winRate,
            totalTrades: btResult.result.totalTrades,
          });
        }
      } catch (err: unknown) {
        log.warn(`[WalkForward] Param test failed:`, params, err.message);
      }
    }

    return results;
  }

  private generateParamCombinations(ranges: ParamRange[]): Record<string, number>[] {
    if (ranges.length === 0) return [{}];

    const combinations: Record<string, number>[] = [{}];

    for (const range of ranges) {
      const newCombinations: Record<string, number>[] = [];
      for (const combo of combinations) {
        for (const value of range.values) {
          newCombinations.push({ ...combo, [range.name]: value });
        }
      }
      combinations.length = 0;
      combinations.push(...newCombinations);
    }

    return combinations;
  }

 // ── consistency ──────────────────────────────────────────────────────────

  private calculateConsistency(windows: WindowResult[]): number {
    if (windows.length < 2) return 50;

 // OOS Sharpe consistency
    const oosSharpes = windows.map(w => w.oosSharpe);
    const avg = oosSharpes.reduce((a, b) => a + b, 0) / oosSharpes.length;
    const variance = oosSharpes.reduce((s, v) => s + (v - avg) ** 2, 0) / oosSharpes.length;
    const stdDev = Math.sqrt(variance);

 // CV = stdDev / |avg|，
    const cv = avg !== 0 ? stdDev / Math.abs(avg) : 1;
    const consistencyScore = Math.max(0, Math.min(100, 100 - cv * 50));

 //
    const positiveWindows = windows.filter(w => w.oosReturn > 0).length;
    const positiveRatio = positiveWindows / windows.length;

    return Math.round(consistencyScore * 0.5 + positiveRatio * 100 * 0.5);
  }

 // ── heatmap ──────────────────────────────────────────────────────────

  private generateHeatmap(config: WFAConfig, results: ParamResult[]): HeatmapData {
    if (config.paramRanges.length < 2 || results.length === 0) {
      return { paramX: '', paramY: '', xValues: [], yValues: [], matrix: [] };
    }

    const paramX = config.paramRanges[0];
    const paramY = config.paramRanges[1];

    const matrix: number[][] = [];
    for (let i = 0; i < paramX.values.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < paramY.values.length; j++) {
        const match = results.find(r =>
          r.params[paramX.name] === paramX.values[i] &&
          r.params[paramY.name] === paramY.values[j]
        );
        matrix[i][j] = match ? match.sharpe : 0;
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

  private scoreToGrade(score: number): string {
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private generateRecommendation(stabilityScore: number, avgOosSharpe: number, avgDecayRatio: number): string {
    if (stabilityScore >= 80 && avgDecayRatio >= 0.7) {
      return i18n.t('walkForward.k5');
    }
    if (stabilityScore >= 60 && avgDecayRatio >= 0.5) {
      return i18n.t('walkForward.k6');
    }
    if (stabilityScore >= 40) {
      return i18n.t('walkForward.k7');
    }
    return i18n.t('walkForward.k8');
  }

  private generateWarnings(windows: WindowResult[], avgDecayRatio: number, stabilityScore: number): string[] {
    const warnings: string[] = [];

    if (avgDecayRatio < 0.3) {
      warnings.push(i18n.t('walkForward.k9'));
    } else if (avgDecayRatio < 0.5) {
      warnings.push(i18n.t('walkForward.k10'));
    }

    if (stabilityScore < 40) {
      warnings.push(i18n.t('walkForward.k11'));
    }

    const negativeWindows = windows.filter(w => w.oosReturn < 0).length;
    if (negativeWindows > windows.length * 0.4) {
      warnings.push(i18n.t('walkForward.k12'));
    }

    return warnings;
  }
}
