// ── QUANT MOO — Backtest Enhancement (Sprint 2: P1) ───────────────────────
// period + parameter sweep + Walk-Forward + metric

import { BacktestEngine } from './backtest-engine';

export interface PeriodResult {
  label: string;
  startDate: string;
  endDate: string;
  totalReturn: number;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

export interface ParamSweepResult {
  params: Record<string, number>;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

export interface WalkForwardResult {
  inSample: {
    totalReturn: number;
    sharpeRatio: number;
    params: Record<string, number>;
  };
  outOfSample: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  stability: number; // 0-1, higher = more stable
  windows: Array<{
    trainPeriod: string;
    testPeriod: string;
    trainReturn: number;
    testReturn: number;
  }>;
}

export interface DeepRiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  sortinoRatio: number;
  calmarRatio: number;
  omegaRatio: number;
  maxDrawdownDuration: number; // bars
  maxRecoveryTime: number; // bars
  dailyStd: number;
  monthlyReturns: Array<{ month: string; return: number }>;
}

export class BacktestEnhancer {
  private engine: BacktestEngine;

  constructor(engine: BacktestEngine) {
    this.engine = engine;
  }

  // ── Multi-Period Comparison ───────────────────────────────────────

  async multiPeriodBacktest(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    klines: any[],
    strategyConfig: unknown,
    periods: Array<{ label: string; startIdx: number; endIdx: number }>
  ): Promise<PeriodResult[]> {
    const results: PeriodResult[] = [];

    for (const period of periods) {
      const slice = klines.slice(period.startIdx, period.endIdx + 1);
      if (slice.length < 50) continue;

      const btResult = await this.engine.run({
        strategyId: strategyConfig.strategyId,
        symbol: strategyConfig.symbol || 'US.TQQQ',
        period: strategyConfig.period || 'daily',
        initialCapital: strategyConfig.initialCapital || 100000,
        klines: slice,
      });

      if (btResult?.result) {
        results.push({
          label: period.label,
          startDate: new Date(slice[0].time * 1000).toISOString().slice(0, 10),
          endDate: new Date(slice[slice.length - 1].time * 1000).toISOString().slice(0, 10),
          ...btResult.result,
        });
      }
    }

    return results;
  }

  // ── Parameter Sweep (Grid Search) ─────────────────────────────────

  async parameterSweep(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    klines: any[],
    baseConfig: unknown,
    paramRanges: Record<string, { min: number; max: number; step: number }>,
    maxCombinations = 100
  ): Promise<ParamSweepResult[]> {
    const combinations = this.generateCombinations(paramRanges, maxCombinations);
    const results: ParamSweepResult[] = [];

    for (const params of combinations) {
      const config = { ...baseConfig };
      // Merge params into config DSL
      if (config.dsl_json) {
        const dsl = JSON.parse(config.dsl_json);
        for (const [key, val] of Object.entries(params)) {
          this.setNestedValue(dsl, key, val);
        }
        config.dsl_json = JSON.stringify(dsl);
      }

      const btResult = await this.engine.run({
        strategyId: config.id || baseConfig.strategyId,
        symbol: config.symbol || 'US.TQQQ',
        period: config.period || 'daily',
        initialCapital: config.initialCapital || 100000,
        klines,
      });

      if (btResult?.result) {
        results.push({
          params,
          totalReturn: btResult.result.totalReturn,
          sharpeRatio: btResult.result.sharpeRatio,
          maxDrawdown: btResult.result.maxDrawdown,
          winRate: btResult.result.winRate,
          totalTrades: btResult.result.totalTrades,
        });
      }
    }

    return results;
  }

  // ── Walk-Forward Analysis ─────────────────────────────────────────

  async walkForwardAnalysis(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    klines: any[],
    baseConfig: unknown,
    paramRanges: Record<string, { min: number; max: number; step: number }>,
    trainSize: number,
    testSize: number,
    maxWindows = 10
  ): Promise<WalkForwardResult> {
    const windows: WalkForwardResult['windows'] = [];
    let inSampleResults: ParamSweepResult[] = [];
    let outSampleReturns: number[] = [];

    let offset = 0;
    while (offset + trainSize + testSize <= klines.length && windows.length < maxWindows) {
      const trainData = klines.slice(offset, offset + trainSize);
      const testData = klines.slice(offset + trainSize, offset + trainSize + testSize);

      if (trainData.length < 50 || testData.length < 10) break;

      // Optimize on train data
      const sweepResults = await this.parameterSweep(trainData, baseConfig, paramRanges, 50);
      if (sweepResults.length > 0) {
        // Find best params by sharpe
        const best = sweepResults.reduce((a, b) => a.sharpeRatio > b.sharpeRatio ? a : b);
        inSampleResults.push(best);

        // Test on out-of-sample
        const testConfig = { ...baseConfig };
        if (testConfig.dsl_json) {
          const dsl = JSON.parse(testConfig.dsl_json);
          for (const [key, val] of Object.entries(best.params)) {
            this.setNestedValue(dsl, key, val);
          }
          testConfig.dsl_json = JSON.stringify(dsl);
        }

        const testResult = await this.engine.run({
          strategyId: testConfig.id || baseConfig.strategyId,
          symbol: testConfig.symbol || 'US.TQQQ',
          period: testConfig.period || 'daily',
          initialCapital: testConfig.initialCapital || 100000,
          klines: testData,
        });

        if (testResult?.result) {
          outSampleReturns.push(testResult.result.totalReturn);
          windows.push({
            trainPeriod: `${new Date(trainData[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(trainData[trainData.length - 1].time * 1000).toISOString().slice(0, 10)}`,
            testPeriod: `${new Date(testData[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(testData[testData.length - 1].time * 1000).toISOString().slice(0, 10)}`,
            trainReturn: best.totalReturn,
            testReturn: testResult.result.totalReturn,
          });
        }
      }

      offset += testSize; // rolling window forward
    }

    const avgInSampleReturn = inSampleResults.length > 0
      ? inSampleResults.reduce((s, r) => s + r.totalReturn, 0) / inSampleResults.length : 0;
    const avgOutSampleReturn = outSampleReturns.length > 0
      ? outSampleReturns.reduce((s, r) => s + r, 0) / outSampleReturns.length : 0;
    const avgInSampleSharpe = inSampleResults.length > 0
      ? inSampleResults.reduce((s, r) => s + r.sharpeRatio, 0) / inSampleResults.length : 0;

    // Stability: how close is out-of-sample to in-sample
    const stability = avgInSampleReturn !== 0
      ? Math.max(0, 1 - Math.abs(avgOutSampleReturn - avgInSampleReturn) / Math.abs(avgInSampleReturn))
      : 0;

    return {
      inSample: {
        totalReturn: avgInSampleReturn,
        sharpeRatio: avgInSampleSharpe,
        params: inSampleResults.length > 0 ? inSampleResults[0].params : {},
      },
      outOfSample: {
        totalReturn: avgOutSampleReturn,
        sharpeRatio: 0,
        maxDrawdown: 0,
      },
      stability: Math.round(stability * 100) / 100,
      windows,
    };
  }

  // ── Deep Risk Metrics ──────────────────────────────────────────────

  computeDeepRiskMetrics(equityCurve: number[], riskFreeRate = 0.03): DeepRiskMetrics {
    if (equityCurve.length < 10) {
      return { var95: 0, var99: 0, cvar95: 0, sortinoRatio: 0, calmarRatio: 0, omegaRatio: 0, maxDrawdownDuration: 0, maxRecoveryTime: 0, dailyStd: 0, monthlyReturns: [] };
    }

    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      dailyReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }

    const sorted = [...dailyReturns].sort((a, b) => a - b);

    // VaR
    const var95Idx = Math.floor(sorted.length * 0.05);
    const var99Idx = Math.floor(sorted.length * 0.01);
    const var95 = Math.abs(sorted[Math.max(0, var95Idx)] || 0);
    const var99 = Math.abs(sorted[Math.max(0, var99Idx)] || 0);

    // CVaR (average of losses beyond VaR)
    const losses95 = sorted.slice(0, Math.max(1, var95Idx));
    const cvar95 = losses95.length > 0 ? Math.abs(losses95.reduce((s, v) => s + v, 0) / losses95.length) : var95;

    // Sortino Ratio
    const dailyMean = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
    const downsideDev = Math.sqrt(
      dailyReturns.filter((v) => v < 0).reduce((s, v) => s + v * v, 0) / dailyReturns.length
    );
    const annualizedReturn = dailyMean * 252 - riskFreeRate;
    const annualizedDownside = downsideDev * Math.sqrt(252);
    const sortinoRatio = annualizedDownside > 0 ? annualizedReturn / annualizedDownside : 0;

    // Calmar Ratio
    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / (maxDrawdown / 100) : 0;

    // Omega Ratio
    const threshold = riskFreeRate / 252;
    const gains = dailyReturns.filter((v) => v > threshold).reduce((s, v) => s + (v - threshold), 0);
    const losses = dailyReturns.filter((v) => v < threshold).reduce((s, v) => s + (threshold - v), 0);
    const omegaRatio = losses > 0 ? gains / losses : 10;

    // Drawdown duration analysis
    const { maxDuration, maxRecovery } = this.analyzeDrawdownDuration(equityCurve);

    // Monthly returns
    const monthlyReturns = this.computeMonthlyReturns(equityCurve);

    // Daily Std Dev
    const dailyStd = Math.sqrt(dailyReturns.reduce((s, v) => s + Math.pow(v - dailyMean, 2), 0) / dailyReturns.length);

    return {
      var95: Math.round(var95 * 10000) / 100,
      var99: Math.round(var99 * 10000) / 100,
      cvar95: Math.round(cvar95 * 10000) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      omegaRatio: Math.round(omegaRatio * 100) / 100,
      maxDrawdownDuration: maxDuration,
      maxRecoveryTime: maxRecovery,
      dailyStd: Math.round(dailyStd * 10000) / 100,
      monthlyReturns,
    };
  }

  private calculateMaxDrawdown(equityCurve: number[]): number {
    let peak = equityCurve[0];
    let maxDd = 0;
    for (const v of equityCurve) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak * 100;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  }

  private analyzeDrawdownDuration(equityCurve: number[]): { maxDuration: number; maxRecovery: number } {
    let peak = equityCurve[0];
    let currentDrawdownStart = 0;
    let maxDuration = 0;
    let maxRecovery = 0;
    let inDrawdown = false;

    for (let i = 1; i < equityCurve.length; i++) {
      if (equityCurve[i] > peak) {
        peak = equityCurve[i];
        if (inDrawdown) {
          const recovery = i - currentDrawdownStart;
          if (recovery > maxRecovery) maxRecovery = recovery;
          inDrawdown = false;
        }
      } else if (equityCurve[i] < peak * 0.95) {
        if (!inDrawdown) {
          currentDrawdownStart = i;
          inDrawdown = true;
        }
        const duration = i - currentDrawdownStart + 1;
        if (duration > maxDuration) maxDuration = duration;
      }
    }

    return { maxDuration, maxRecovery };
  }

  private computeMonthlyReturns(equityCurve: number[]): Array<{ month: string; return: number }> {
    // Simplified: group by chunks of ~21 trading days
    const result: Array<{ month: string; return: number }> = [];
    const chunkSize = 21;
    for (let i = 0; i < equityCurve.length; i += chunkSize) {
      const chunk = equityCurve.slice(i, Math.min(i + chunkSize, equityCurve.length));
      if (chunk.length >= 10) {
        const ret = ((chunk[chunk.length - 1] - chunk[0]) / chunk[0]) * 100;
        result.push({ month: `M${Math.floor(i / chunkSize) + 1}`, return: Math.round(ret * 100) / 100 });
      }
    }
    return result;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private generateCombinations(
    ranges: Record<string, { min: number; max: number; step: number }>,
    maxCombinations: number
  ): Array<Record<string, number>> {
    const keys = Object.keys(ranges);
    if (keys.length === 0) return [{}];

    const values = keys.map((key) => {
      const { min, max, step } = ranges[key];
      const vals: number[] = [];
      for (let v = min; v <= max; v += step) vals.push(Math.round(v * 100) / 100);
      return vals;
    });

    // Cartesian product limited to maxCombinations
    const result: Array<Record<string, number>> = [];
    const stack: Array<{ idx: number; current: Record<string, number> }> = [{ idx: 0, current: {} }];

    while (stack.length > 0 && result.length < maxCombinations) {
      const { idx, current } = stack.pop()!;
      if (idx >= keys.length) {
        result.push({ ...current });
        continue;
      }
      const key = keys[idx];
      for (const val of values[idx]) {
        if (result.length >= maxCombinations) break;
        stack.push({ idx: idx + 1, current: { ...current, [key]: val } });
      }
    }

    return result;
  }

  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
}
