// ── Walk-Forward Engine — ─────────────────────────────────
// rolling/extension，done：
//   1. In-Sample parameter optimization
// 2. Out-of-Sample 
// 3. (OOS / IS)
// Phase 1: TypeScript 

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ── Inline EventEmitter polyfill (no node:events) ───────────────────────────

type EventCallback = (...args: unknown[]) => void;

class EventEmitter {
  private _listeners: Map<string, EventCallback[]> = new Map();

  on(event: string, fn: EventCallback): this {
    const list = this._listeners.get(event) ?? [];
    list.push(fn);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, fn: EventCallback): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(event, list.filter(f => f !== fn));
    }
    return this;
  }

  once(event: string, fn: EventCallback): this {
    const wrapped = (...args: unknown[]) => { this.off(event, wrapped); fn(...args); };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) fn(...args);
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
    return this;
  }

  listenerCount(event: string): number {
    return (this._listeners.get(event) ?? []).length;
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface KLine {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  entryTime: number;
  exitTime: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  bars: number;
}

export interface ParamRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface WalkForwardConfig {
  windows: number;                // 步进窗口数量
  inSampleRatio: number;          // 样本内数据占比 (0.5-0.9)
  optimizationObjective: 'sharpe' | 'return' | 'drawdown';
  windowType: 'rolling' | 'expanding';
  minTrades: number;              // 每个窗口最少交易笔数
}

export interface WalkForwardWindow {
  windowIndex: number;
  inSampleStart: number;
  inSampleEnd: number;
  oosStart: number;
  oosEnd: number;
  optimizedParams: Record<string, number>;
  isReturn: number;
  oosReturn: number;
  isSharpe: number;
  oosSharpe: number;
  isMaxDrawdown: number;
  oosMaxDrawdown: number;
  efficiency: number;
  isTrades: number;
  oosTrades: number;
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  overallEfficiency: number;
  avgOosReturn: number;
  avgOosSharpe: number;
  avgOosDrawdown: number;
  totalWindows: number;
  profitableWindows: number;
  profitabilityRate: number;
}

export interface WalkForwardReport {
  summary: WalkForwardResult;
  config: WalkForwardConfig;
  paramRanges: ParamRange[];
  timestamp: number;
  dataLength: number;
  recommendations: string[];
}

// ── Strategy callback type ──────────────────────────────────────────────────
// The caller provides a function that takes klines + params → trades
export type StrategyRunner = (data: KLine[], params: Record<string, number>) => Trade[];

// ── Default config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WalkForwardConfig = {
  windows: 5,
  inSampleRatio: 0.7,
  optimizationObjective: 'sharpe',
  windowType: 'rolling',
  minTrades: 3,
};

// ── Engine ──────────────────────────────────────────────────────────────────

export class WalkForwardEngine extends EventEmitter {
  private config: WalkForwardConfig;
  private strategyRunner: StrategyRunner;
  private paramRanges: ParamRange[];
  private running = false;

  constructor(
    strategyRunner: StrategyRunner,
    paramRanges: ParamRange[],
    config?: Partial<WalkForwardConfig>,
  ) {
    super();
    this.strategyRunner = strategyRunner;
    this.paramRanges = paramRanges;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validateConfig();
    log.info('[WalkForward] Engine initialized', {
      windows: this.config.windows,
      inSampleRatio: this.config.inSampleRatio,
      windowType: this.config.windowType,
      paramCount: paramRanges.length,
    });
  }

  // ── Config validation ───────────────────────────────────────────────────

  private validateConfig(): void {
    const c = this.config;
    if (c.windows < 2) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: windows must be >= 2');
    if (c.inSampleRatio < 0.5 || c.inSampleRatio > 0.9) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: inSampleRatio must be between 0.5 and 0.9');
    }
    if (c.minTrades < 1) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: minTrades must be >= 1');
    if (this.paramRanges.length === 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: at least one parameter range is required');
    }
    for (const p of this.paramRanges) {
      if (p.step <= 0) throw new EngineError(ErrorCode.INTERNAL_ERROR, `WalkForward: param "${p.name}" step must be > 0`);
      if (p.min > p.max) throw new EngineError(ErrorCode.INTERNAL_ERROR, `WalkForward: param "${p.name}" min > max`);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Run walk-forward analysis on historical kline data.
   */
  async run(data: KLine[]): Promise<WalkForwardResult> {
    if (this.running) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: engine is already running');
    if (data.length < 10) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: insufficient data (need >= 10 bars)');

    this.running = true;
    this.emit('start', { dataLength: data.length });
    log.info('[WalkForward] Starting analysis', { bars: data.length });

    // Yield once so concurrent callers can observe `running === true` and reject.
    // This makes the async contract meaningful for tests that race two `run()`
    // calls back-to-back.
    await Promise.resolve();

    try {
      const windowIndices = this.calculateWindowBoundaries(data.length);
      const windows: WalkForwardWindow[] = [];

      for (let i = 0; i < windowIndices.length; i++) {
        const boundary = windowIndices[i];
        this.emit('windowStart', { windowIndex: i, boundary });

        const window = this.processWindow(data, i, boundary);
        if (window) {
          windows.push(window);
          this.emit('windowComplete', {
            windowIndex: i,
            efficiency: window.efficiency,
            oosReturn: window.oosReturn,
          });
        } else {
          log.warn(`[WalkForward] Window ${i} skipped (insufficient trades)`);
          this.emit('windowSkipped', { windowIndex: i, reason: 'insufficient_trades' });
        }
      }

      const result = this.aggregateResults(windows);
      this.emit('complete', result);
      log.info('[WalkForward] Analysis complete', {
        totalWindows: result.totalWindows,
        profitableWindows: result.profitableWindows,
        overallEfficiency: result.overallEfficiency.toFixed(4),
      });
      return result;
    } finally {
      this.running = false;
    }
  }

  /**
   * Run walk-forward and generate a full report with recommendations.
   */
  async generateReport(data: KLine[]): Promise<WalkForwardReport> {
    const result = await this.run(data);
    const recommendations = this.generateRecommendations(result);
    const report: WalkForwardReport = {
      summary: result,
      config: { ...this.config },
      paramRanges: [...this.paramRanges],
      timestamp: Date.now(),
      dataLength: data.length,
      recommendations,
    };
    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Check if the engine is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current config.
   */
  getConfig(): Readonly<WalkForwardConfig> {
    return { ...this.config };
  }

  /**
   * Update config (only when not running).
   */
  updateConfig(config: Partial<WalkForwardConfig>): void {
    if (this.running) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: cannot update config while running');
    this.config = { ...this.config, ...config };
    this.validateConfig();
  }

  /**
   * Get parameter ranges.
   */
  getParamRanges(): Readonly<ParamRange[]> {
    return [...this.paramRanges];
  }

  // ── Window boundary calculation ─────────────────────────────────────────

  private calculateWindowBoundaries(dataLength: number): Array<{
    inSampleStart: number;
    inSampleEnd: number;
    oosStart: number;
    oosEnd: number;
  }> {
    const { windows, inSampleRatio, windowType } = this.config;
    const boundaries: Array<{
      inSampleStart: number;
      inSampleEnd: number;
      oosStart: number;
      oosEnd: number;
    }> = [];

    // Total segment size per window
    const segmentSize = Math.floor(dataLength / windows);
    if (segmentSize < 4) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'WalkForward: not enough data for the number of windows requested');
    }

    for (let w = 0; w < windows; w++) {
      let inSampleStart: number;
      let inSampleEnd: number;
      let oosStart: number;
      let oosEnd: number;

      if (windowType === 'expanding') {
        // Expanding window: IS grows with each step, OOS is the next segment
        inSampleStart = 0;
        inSampleEnd = Math.floor(segmentSize * (w + 1) * inSampleRatio);
        oosStart = inSampleEnd;
        oosEnd = Math.min(segmentSize * (w + 1), dataLength);
      } else {
        // Rolling window: fixed-size IS slides forward
        const windowStart = segmentSize * w;
        const windowEnd = Math.min(windowStart + segmentSize, dataLength);
        const windowSize = windowEnd - windowStart;
        const isSize = Math.floor(windowSize * inSampleRatio);

        inSampleStart = windowStart;
        inSampleEnd = windowStart + isSize;
        oosStart = inSampleEnd;
        oosEnd = windowEnd;
      }

      // Ensure OOS has at least some data
      if (oosEnd - oosStart < 2) continue;
      if (inSampleEnd - inSampleStart < 2) continue;

      boundaries.push({ inSampleStart, inSampleEnd, oosStart, oosEnd });
    }

    return boundaries;
  }

  // ── Process a single window ─────────────────────────────────────────────

  private processWindow(
    data: KLine[],
    windowIndex: number,
    boundary: { inSampleStart: number; inSampleEnd: number; oosStart: number; oosEnd: number },
  ): WalkForwardWindow | null {
    const isData = data.slice(boundary.inSampleStart, boundary.inSampleEnd);
    const oosData = data.slice(boundary.oosStart, boundary.oosEnd);

    // Step 1: Optimize parameters on in-sample data
    const optimizedParams = this.optimizeParams(isData);

    // Step 2: Run strategy with optimized params on IS and OOS
    const isTrades = this.strategyRunner(isData, optimizedParams);
    const oosTrades = this.strategyRunner(oosData, optimizedParams);

    // Check minimum trade requirement
    if (isTrades.length < this.config.minTrades || oosTrades.length < this.config.minTrades) {
      return null;
    }

    // Step 3: Calculate metrics
    const isMetrics = this.calculateMetrics(isTrades, isData);
    const oosMetrics = this.calculateMetrics(oosTrades, oosData);

    // Step 4: Calculate efficiency
    const efficiency = this.calculateEfficiency(isMetrics, oosMetrics);

    return {
      windowIndex,
      inSampleStart: boundary.inSampleStart,
      inSampleEnd: boundary.inSampleEnd,
      oosStart: boundary.oosStart,
      oosEnd: boundary.oosEnd,
      optimizedParams,
      isReturn: isMetrics.totalReturn,
      oosReturn: oosMetrics.totalReturn,
      isSharpe: isMetrics.sharpeRatio,
      oosSharpe: oosMetrics.sharpeRatio,
      isMaxDrawdown: isMetrics.maxDrawdown,
      oosMaxDrawdown: oosMetrics.maxDrawdown,
      efficiency,
      isTrades: isTrades.length,
      oosTrades: oosTrades.length,
    };
  }

  // ── Parameter optimization (grid search) ────────────────────────────────

  private optimizeParams(data: KLine[]): Record<string, number> {
    const paramSets = this.generateParamGrid();
    let bestParams: Record<string, number> = {};
    let bestScore = -Infinity;

    for (const params of paramSets) {
      const trades = this.strategyRunner(data, params);
      if (trades.length < this.config.minTrades) continue;

      const metrics = this.calculateMetrics(trades, data);
      const score = this.objectiveScore(metrics);

      if (score > bestScore) {
        bestScore = score;
        bestParams = { ...params };
      }
    }

    // If no param set produced enough trades, return midpoint params
    if (Object.keys(bestParams).length === 0) {
      bestParams = this.getMidpointParams();
    }

    return bestParams;
  }

  private generateParamGrid(): Record<string, number>[] {
    const sets: Record<string, number>[] = [];
    const paramValues: Array<{ name: string; values: number[] }> = [];

    for (const p of this.paramRanges) {
      const values: number[] = [];
      // Limit grid to max 20 points per param to keep perf reasonable
      const steps = Math.min(Math.round((p.max - p.min) / p.step), 20);
      for (let i = 0; i <= steps; i++) {
        values.push(p.min + i * p.step);
      }
      paramValues.push({ name: p.name, values });
    }

    // Cartesian product
    const cartesian = (arr: Array<{ name: string; values: number[] }>): Record<string, number>[] => {
      if (arr.length === 0) return [{}];
      const [first, ...rest] = arr;
      const restProduct = cartesian(rest);
      const result: Record<string, number>[] = [];
      for (const val of first.values) {
        for (const combo of restProduct) {
          result.push({ [first.name]: val, ...combo });
        }
      }
      return result;
    };

    return cartesian(paramValues);
  }

  private getMidpointParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const p of this.paramRanges) {
      // Round to step granularity so integer-typed params stay integral.
      const raw = p.min + (p.max - p.min) / 2;
      params[p.name] = Math.round(raw / p.step) * p.step;
    }
    return params;
  }

  private objectiveScore(metrics: TradeMetrics): number {
    switch (this.config.optimizationObjective) {
      case 'sharpe':
        return metrics.sharpeRatio;
      case 'return':
        return metrics.totalReturn;
      case 'drawdown':
        // Lower drawdown is better → negate
        return -metrics.maxDrawdown;
      default:
        return metrics.sharpeRatio;
    }
  }

  // ── Metrics calculation ─────────────────────────────────────────────────

  private calculateMetrics(trades: Trade[], data: KLine[]): TradeMetrics {
    if (trades.length === 0) {
      return { totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0 };
    }

    const totalReturn = trades.reduce((sum, t) => sum + t.pnlPct, 0);
    const returns = trades.map(t => t.pnlPct);

    // Sharpe ratio (annualized, assume 252 trading days)
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / Math.max(returns.length - 1, 1);
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    // Max drawdown from cumulative PnL curve
    const maxDrawdown = this.calculateMaxDrawdown(trades);

    // Win rate
    const wins = trades.filter(t => t.pnl > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    // Profit factor
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return { totalReturn, sharpeRatio, maxDrawdown, winRate, profitFactor };
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    let cumPnl = 0;
    let peak = 0;
    let maxDd = 0;

    for (const trade of trades) {
      cumPnl += trade.pnlPct;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak - cumPnl;
      if (dd > maxDd) maxDd = dd;
    }

    return maxDd;
  }

  // ── Efficiency calculation ──────────────────────────────────────────────

  private calculateEfficiency(isMetrics: TradeMetrics, oosMetrics: TradeMetrics): number {
    // Walk-forward efficiency = OOS performance / IS performance
    // Capped at [-1, 2] to avoid extreme values
    const { optimizationObjective } = this.config;

    let isVal: number;
    let oosVal: number;

    switch (optimizationObjective) {
      case 'return':
        isVal = isMetrics.totalReturn;
        oosVal = oosMetrics.totalReturn;
        break;
      case 'drawdown':
        isVal = isMetrics.maxDrawdown;
        oosVal = oosMetrics.maxDrawdown;
        break;
      case 'sharpe':
      default:
        isVal = isMetrics.sharpeRatio;
        oosVal = oosMetrics.sharpeRatio;
        break;
    }

    if (Math.abs(isVal) < 1e-9) {
      // IS performance is ~0 → if OOS is also ~0, efficiency = 1 (stable), else 0
      return Math.abs(oosVal) < 1e-9 ? 1 : 0;
    }

    let efficiency: number;
    if (optimizationObjective === 'drawdown') {
      // For drawdown: lower is better, so OOS <= IS is good → IS/OOS
      efficiency = isVal > 0 ? isVal / Math.max(oosVal, 0.001) : 0;
    } else {
      efficiency = oosVal / isVal;
    }

    // Clamp to [-1, 2]
    return Math.max(-1, Math.min(2, efficiency));
  }

  // ── Aggregate results ───────────────────────────────────────────────────

  private aggregateResults(windows: WalkForwardWindow[]): WalkForwardResult {
    if (windows.length === 0) {
      return {
        windows: [],
        overallEfficiency: 0,
        avgOosReturn: 0,
        avgOosSharpe: 0,
        avgOosDrawdown: 0,
        totalWindows: 0,
        profitableWindows: 0,
        profitabilityRate: 0,
      };
    }

    const n = windows.length;
    const overallEfficiency = windows.reduce((s, w) => s + w.efficiency, 0) / n;
    const avgOosReturn = windows.reduce((s, w) => s + w.oosReturn, 0) / n;
    const avgOosSharpe = windows.reduce((s, w) => s + w.oosSharpe, 0) / n;
    const avgOosDrawdown = windows.reduce((s, w) => s + w.oosMaxDrawdown, 0) / n;
    const profitableWindows = windows.filter(w => w.oosReturn > 0).length;
    const profitabilityRate = (profitableWindows / n) * 100;

    return {
      windows,
      overallEfficiency,
      avgOosReturn,
      avgOosSharpe,
      avgOosDrawdown,
      totalWindows: n,
      profitableWindows,
      profitabilityRate,
    };
  }

  // ── Report recommendations ──────────────────────────────────────────────

  private generateRecommendations(result: WalkForwardResult): string[] {
    const recs: string[] = [];

    if (result.totalWindows === 0) {
      recs.push('No valid windows produced. Consider increasing data or reducing window count.');
      return recs;
    }

    // Efficiency analysis
    if (result.overallEfficiency >= 0.7) {
      recs.push('Walk-forward efficiency is strong (≥0.7). Strategy parameters generalize well to unseen data.');
    } else if (result.overallEfficiency >= 0.4) {
      recs.push('Walk-forward efficiency is moderate (0.4-0.7). Consider reducing parameter count or widening search ranges.');
    } else {
      recs.push('Walk-forward efficiency is weak (<0.4). Strategy may be overfitting. Simplify the model or add regularization.');
    }

    // Profitability
    if (result.profitabilityRate >= 70) {
      recs.push(`High profitability rate (${result.profitabilityRate.toFixed(1)}%). Strategy is consistent across time periods.`);
    } else if (result.profitabilityRate < 50) {
      recs.push(`Low profitability rate (${result.profitabilityRate.toFixed(1)}%). Strategy is unreliable out-of-sample.`);
    }

    // Drawdown
    if (result.avgOosDrawdown > 15) {
      recs.push(`Average OOS max drawdown is ${result.avgOosDrawdown.toFixed(2)}%. Consider adding stop-loss or position sizing rules.`);
    }

    // Sharpe
    if (result.avgOosSharpe < 0.5) {
      recs.push(`Average OOS Sharpe ratio is ${result.avgOosSharpe.toFixed(2)}. Risk-adjusted return is below acceptable threshold.`);
    }

    // Window consistency
    const efficiencies = result.windows.map(w => w.efficiency);
    const effStd = Math.sqrt(
      efficiencies.reduce((s, e) => s + (e - result.overallEfficiency) ** 2, 0) / efficiencies.length
    );
    if (effStd > 0.5) {
      recs.push('High variance in per-window efficiency. Results may be regime-dependent.');
    }

    return recs;
  }
}

// ── Metrics interface ───────────────────────────────────────────────────────

interface TradeMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

// ── Utility: create default engine with simple MA crossover strategy ─────────

export function createDefaultWalkForwardEngine(
  config?: Partial<WalkForwardConfig>,
): WalkForwardEngine {
  const paramRanges: ParamRange[] = [
    { name: 'fastPeriod', min: 5, max: 20, step: 5 },
    { name: 'slowPeriod', min: 20, max: 60, step: 10 },
  ];

  const simpleMACrossover: StrategyRunner = (data: KLine[], params: Record<string, number>) => {
    const fast = params.fastPeriod ?? 10;
    const slow = params.slowPeriod ?? 30;
    if (data.length < slow + 1) return [];

    const trades: Trade[] = [];
    let inPosition = false;
    let entryPrice = 0;
    let entryTime = 0;
    let entryIdx = 0;

    for (let i = slow; i < data.length; i++) {
      const fastMa = calcSMA(data, i, fast);
      const slowMa = calcSMA(data, i, slow);
      const prevFastMa = calcSMA(data, i - 1, fast);
      const prevSlowMa = calcSMA(data, i - 1, slow);

      if (!inPosition && prevFastMa <= prevSlowMa && fastMa > slowMa) {
        inPosition = true;
        entryPrice = data[i].close;
        entryTime = data[i].time;
        entryIdx = i;
      } else if (inPosition && prevFastMa >= prevSlowMa && fastMa < slowMa) {
        inPosition = false;
        const exitPrice = data[i].close;
        const pnl = exitPrice - entryPrice;
        const pnlPct = (pnl / entryPrice) * 100;
        trades.push({
          entryTime,
          exitTime: data[i].time,
          side: 'LONG',
          entryPrice,
          exitPrice,
          qty: 1,
          pnl,
          pnlPct,
          bars: i - entryIdx,
        });
      }
    }

    return trades;
  };

  return new WalkForwardEngine(simpleMACrossover, paramRanges, config);
}

function calcSMA(data: KLine[], endIdx: number, period: number): number {
  if (endIdx >= data.length) endIdx = data.length - 1;
  if (endIdx < 0) return 0;
  let sum = 0;
  const start = Math.max(0, endIdx - period + 1);
  const count = endIdx - start + 1;
  for (let i = start; i <= endIdx; i++) {
    sum += data[i].close;
  }
  return count > 0 ? sum / count : 0;
}

export default WalkForwardEngine;
