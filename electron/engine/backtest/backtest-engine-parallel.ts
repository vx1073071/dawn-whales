// ── Backtest Engine — v2 ──────────────────────────────────────
// worker_threads backtest，parameter sweepstrategy/policyperformance
// Phase 1: TypeScript Worker | Phase 2: Rust N-API（performance）

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import log from 'electron-log';
import path from 'path';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


// ── Types () ───────────────────────────────────────────────────

interface KLine {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  entryTime: number;
  exitTime: number;
  side: 'LONG';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  bars: number;
}

interface BacktestResult {
  success: boolean;
  result: {
    totalReturn: number;
    annualReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgTradePnl: number;
    avgHoldingBars: number;
    equityCurve: { time: number; value: number }[];
    trades: Trade[];
    config: BacktestConfig;
  };
}

interface BacktestConfig {
  strategyId?: string;
  strategyName?: string;
  symbol: string;
  startDate?: string;
  endDate?: string;
  initialCapital: number;
  commission: number;
  slippage: number;
  strategy: StrategyConfig;
  klines?: KLine[];
}

interface StrategyConfig {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'custom';
  params: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
}

// ── Worker message ────────────────────────────────────────────────────────

interface WorkerRequest {
  jobId: string;
  config: BacktestConfig;
}

interface WorkerResponse {
  jobId: string;
  result: BacktestResult;
  error?: string;
}

// ── Worker （ worker ）──────────────────────────────────────

if (!isMainThread && parentPort) {
  const { jobId, config } = workerData as WorkerRequest;
  
  try {
    const engine = new BacktestEngineCore();
    const result = engine.run(config);
    parentPort.postMessage({ jobId, result } as WorkerResponse);
  } catch (error) {
    parentPort.postMessage({ 
      jobId, 
      result: { success: false, result: null as any },
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse);
  }
}

// ── backtest engine ──────────────────────────────────────────

class BacktestEngineCore {
  run(config: BacktestConfig): BacktestResult {
    const klines = config.klines || [];
    if (klines.length < 50) {
      return { 
        success: false, 
        result: this.emptyResult(config, i18n.t('backtestEngineParallel.k1'))
      } as any;
    }

    const { initialCapital, commission, slippage, strategy } = config;
    const capital = initialCapital || 100000;
    const commRate = commission ?? 0.001;
    const slipRate = slippage ?? 0.0005;

    const indicators = this.computeIndicators(klines, strategy);
    let cash = capital;
    let position = 0;
    let entryPrice = 0;
    let entryTime = 0;
    let entryBar = 0;
    const trades: Trade[] = [];
    const equityCurve: { time: number; value: number }[] = [];
    let peakEquity = capital;
    let maxDrawdown = 0;
    const dailyReturns: number[] = [];
    let prevEquity = capital;

    indicators.position = 'FLAT';

    for (let i = 0; i < klines.length; i++) {
      const bar = klines[i];
      const signal = this.evaluateSignal(strategy, indicators, i);

      if (position > 0 && entryPrice > 0) {
        const pnlPct = (bar.close - entryPrice) / entryPrice;
        if (strategy.stopLoss && pnlPct <= -strategy.stopLoss / 100) {
          const exitPrice = entryPrice * (1 - strategy.stopLoss / 100) * (1 - slipRate);
          const proceeds = position * exitPrice * (1 - commRate);
          cash += proceeds;
          trades.push({
            entryTime, exitTime: bar.time, side: 'LONG', entryPrice, exitPrice,
            qty: position, pnl: proceeds - position * entryPrice * (1 + commRate),
            pnlPct: (exitPrice / entryPrice - 1) * 100, bars: i - entryBar,
          });
          position = 0;
          entryPrice = 0;
          indicators.position = 'FLAT';
        } else if (strategy.takeProfit && pnlPct >= strategy.takeProfit / 100) {
          const exitPrice = entryPrice * (1 + strategy.takeProfit / 100) * (1 - slipRate);
          const proceeds = position * exitPrice * (1 - commRate);
          cash += proceeds;
          trades.push({
            entryTime, exitTime: bar.time, side: 'LONG', entryPrice, exitPrice,
            qty: position, pnl: proceeds - position * entryPrice * (1 + commRate),
            pnlPct: (exitPrice / entryPrice - 1) * 100, bars: i - entryBar,
          });
          position = 0;
          entryPrice = 0;
          indicators.position = 'FLAT';
        }
      }

      if (signal === 'BUY' && position === 0) {
        const buyPrice = bar.close * (1 + slipRate);
        const investPct = 0.95;
        const qty = Math.floor((cash * investPct) / (buyPrice * (1 + commRate)));
        if (qty > 0) {
          const cost = qty * buyPrice * (1 + commRate);
          cash -= cost;
          position = qty;
          entryPrice = buyPrice;
          entryTime = bar.time;
          entryBar = i;
          indicators.position = 'LONG';
        }
      } else if (signal === 'SELL' && position > 0) {
        const sellPrice = bar.close * (1 - slipRate);
        const proceeds = position * sellPrice * (1 - commRate);
        cash += proceeds;
        trades.push({
          entryTime, exitTime: bar.time, side: 'LONG', entryPrice, exitPrice: sellPrice,
          qty: position, pnl: proceeds - position * entryPrice * (1 + commRate),
          pnlPct: (sellPrice / entryPrice - 1) * 100, bars: i - entryBar,
        });
        position = 0;
        entryPrice = 0;
        indicators.position = 'FLAT';
      }

      const markToMarket = position > 0 ? position * bar.close : 0;
      const equity = cash + markToMarket;
      equityCurve.push({ time: bar.time, value: Math.round(equity * 100) / 100 });

      if (equity > peakEquity) peakEquity = equity;
      const dd = (peakEquity - equity) / peakEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (i > 0 && prevEquity > 0) {
        dailyReturns.push((equity - prevEquity) / prevEquity);
      }
      prevEquity = equity;
    }

    if (position > 0 && klines.length > 0) {
      const lastBar = klines[klines.length - 1];
      const exitPrice = lastBar.close * (1 - slipRate);
      const proceeds = position * exitPrice * (1 - commRate);
      cash += proceeds;
      trades.push({
        entryTime, exitTime: lastBar.time, side: 'LONG', entryPrice, exitPrice,
        qty: position, pnl: proceeds - position * entryPrice * (1 + commRate),
        pnlPct: (exitPrice / entryPrice - 1) * 100, bars: klines.length - 1 - entryBar,
      });
    }

    const finalEquity = cash;
    const totalReturn = ((finalEquity - capital) / capital) * 100;
    const tradingDays = klines.length;
    const years = tradingDays / 252;
    const annualReturn = years > 0 ? (Math.pow(finalEquity / capital, 1 / years) - 1) * 100 : 0;

    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const stdReturn = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
      : 0;
    const sharpeRatio = stdReturn > 0 ? (avgReturn * 252 - 0.04) / (stdReturn * Math.sqrt(252)) : 0;

    const winTrades = trades.filter((t) => t.pnl > 0);
    const lossTrades = trades.filter((t) => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
    const grossProfit = winTrades.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgTradePnl = trades.length > 0 ? trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length : 0;
    const avgHoldingBars = trades.length > 0 ? trades.reduce((s, t) => s + t.bars, 0) / trades.length : 0;

    return {
      success: true,
      result: {
        totalReturn: Math.round(totalReturn * 100) / 100,
        annualReturn: Math.round(annualReturn * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
        winRate: Math.round(winRate * 10) / 10,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalTrades: trades.length,
        avgTradePnl: Math.round(avgTradePnl * 100) / 100,
        avgHoldingBars: Math.round(avgHoldingBars),
        equityCurve: equityCurve.filter((_, idx) => idx % Math.max(1, Math.floor(equityCurve.length / 200)) === 0 || idx === equityCurve.length - 1),
        trades,
        config,
      },
    };
  }

  private computeIndicators(klines: KLine[], config: StrategyConfig) {
    const closes = klines.map((k) => k.close);
    const p = config.params;

    return {
      closes,
      smaShort: this.sma(closes, p.shortPeriod ?? p.fast ?? 10),
      smaLong: this.sma(closes, p.longPeriod ?? p.slow ?? 30),
      rsi: this.rsi(closes, p.rsiPeriod ?? 14),
      macd: this.macd(closes, p.macdFast ?? 12, p.macdSlow ?? 26, p.macdSignal ?? 9),
      bollinger: this.bollingerBands(closes, p.bbPeriod ?? 20, p.bbStdDev ?? 2),
      atr: this.atr(klines, p.atrPeriod ?? 14),
      position: 'FLAT' as 'FLAT' | 'LONG',
    };
  }

  private sma(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      result.push(sum / period);
    }
    return result;
  }

  private ema(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const k = 2 / (period + 1);
    let prev: number | null = null;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      if (prev === null) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        prev = sum / period;
      } else {
        prev = data[i] * k + prev * (1 - k);
      }
      result.push(prev);
    }
    return result;
  }

  private rsi(data: number[], period: number = 14): (number | null)[] {
    const result: (number | null)[] = [null];
    let avgGain = 0, avgLoss = 0;

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      if (i < period) {
        avgGain += gain;
        avgLoss += loss;
        result.push(null);
        continue;
      }
      if (i === period) {
        avgGain = (avgGain + gain) / period;
        avgLoss = (avgLoss + loss) / period;
      } else {
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
      }

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
    return result;
  }

  private macd(data: number[], fast = 12, slow = 26, signal = 9) {
    const emaFast = this.ema(data, fast);
    const emaSlow = this.ema(data, slow);
    const macdLine: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
      if (emaFast[i] === null || emaSlow[i] === null) {
        macdLine.push(null);
      } else {
        macdLine.push(emaFast[i]! - emaSlow[i]!);
      }
    }

    const validMacd = macdLine.filter((v): v is number => v !== null);
    const signalRaw = this.ema(validMacd, signal);
    const signalLine: (number | null)[] = [];
    let validIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null) {
        signalLine.push(null);
      } else {
        signalLine.push(signalRaw[validIdx] ?? null);
        validIdx++;
      }
    }

    const histogram: (number | null)[] = [];
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) {
        histogram.push(null);
      } else {
        histogram.push(macdLine[i]! - signalLine[i]!);
      }
    }

    return { macdLine, signalLine, histogram };
  }

  private bollingerBands(data: number[], period = 20, stdDev = 2) {
    const mid = this.sma(data, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
      if (mid[i] === null) { upper.push(null); lower.push(null); continue; }
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += (data[j] - mid[i]!) ** 2;
      }
      const std = Math.sqrt(sumSq / period);
      upper.push(mid[i]! + stdDev * std);
      lower.push(mid[i]! - stdDev * std);
    }

    return { upper, mid, lower };
  }

  private atr(klines: KLine[], period = 14): (number | null)[] {
    const result: (number | null)[] = [null];
    let prevAtr: number | null = null;

    for (let i = 1; i < klines.length; i++) {
      const tr = Math.max(
        klines[i].high - klines[i].low,
        Math.abs(klines[i].high - klines[i - 1].close),
        Math.abs(klines[i].low - klines[i - 1].close),
      );

      if (i < period) { result.push(null); continue; }
      if (prevAtr === null) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const t = Math.max(
            klines[j].high - klines[j].low,
            j > 0 ? Math.abs(klines[j].high - klines[j - 1].close) : 0,
            j > 0 ? Math.abs(klines[j].low - klines[j - 1].close) : 0,
          );
          sum += t;
        }
        prevAtr = sum / period;
      } else {
        prevAtr = (prevAtr * (period - 1) + tr) / period;
      }
      result.push(prevAtr);
    }
    return result;
  }

  private evaluateSignal(config: StrategyConfig, indicators: unknown, i: number): 'BUY' | 'SELL' | 'HOLD' {
    const p = config.params;

    switch (config.type) {
      case 'ma_cross': {
        const shortMA = indicators.smaShort;
        const longMA = indicators.smaLong;
        if (i < 2 || shortMA[i] === null || shortMA[i - 1] === null || longMA[i] === null || longMA[i - 1] === null) return 'HOLD';
        const prevCross = shortMA[i - 1]! - longMA[i - 1]!;
        const currCross = shortMA[i]! - longMA[i]!;
        if (prevCross <= 0 && currCross > 0) return 'BUY';
        if (prevCross >= 0 && currCross < 0) return 'SELL';
        return 'HOLD';
      }
      case 'rsi': {
        const r = indicators.rsi;
        if (r[i] === null || i < 1 || r[i - 1] === null) return 'HOLD';
        const oversold = p.oversold ?? 30;
        const overbought = p.overbought ?? 70;
        if (r[i - 1]! <= oversold && r[i]! > oversold) return 'BUY';
        if (r[i - 1]! >= overbought && r[i]! < overbought) return 'SELL';
        return 'HOLD';
      }
      case 'macd': {
        const h = indicators.macd.histogram;
        if (i < 1 || h[i] === null || h[i - 1] === null) return 'HOLD';
        if (h[i - 1]! <= 0 && h[i]! > 0) return 'BUY';
        if (h[i - 1]! >= 0 && h[i]! < 0) return 'SELL';
        return 'HOLD';
      }
      case 'momentum': {
        const closes = indicators.closes;
        const lookback = p.lookback ?? 20;
        if (i < lookback) return 'HOLD';
        const momentum = (closes[i] - closes[i - lookback]) / closes[i - lookback];
        const threshold = (p.threshold ?? 5) / 100;
        if (momentum > threshold && indicators.position === 'FLAT') return 'BUY';
        if (momentum < -threshold && indicators.position === 'LONG') return 'SELL';
        return 'HOLD';
      }
      case 'bollinger': {
        const bb = indicators.bollinger;
        if (bb.lower[i] === null || bb.upper[i] === null) return 'HOLD';
        const price = indicators.closes[i];
        const prevPrice = i > 0 ? indicators.closes[i - 1] : price;
        if (prevPrice <= bb.lower[i]! && price > bb.lower[i]!) return 'BUY';
        if (prevPrice >= bb.upper[i]! && price < bb.upper[i]!) return 'SELL';
        return 'HOLD';
      }
      default:
        return 'HOLD';
    }
  }

  private emptyResult(config: BacktestConfig, reason: string) {
    return {
      totalReturn: 0, annualReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      winRate: 0, profitFactor: 0, totalTrades: 0, avgTradePnl: 0, avgHoldingBars: 0,
      equityCurve: [], trades: [], config, reason,
    };
  }
}

// ── backtest engine ───────────────────────────────────────────────

export interface ParallelBacktestConfig extends BacktestConfig {
  maxWorkers?: number;  // ，default CPU
}

export interface ParallelBacktestResult {
  results: BacktestResult[];
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  durationMs: number;
}

export class ParallelBacktestEngine {
  private maxWorkers: number;

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers || require('os').cpus().length;
  }

  /**
 * backtest
 * @param configs backtestconfig
 * @returns backtest result
   */
  async runParallel(configs: BacktestConfig[]): Promise<ParallelBacktestResult> {
    const startTime = Date.now();
    const results: BacktestResult[] = [];
    const failedJobs: string[] = [];

 // ，concurrency
    const batchSize = this.maxWorkers;
    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((config, idx) => this.runInWorker(config, i + idx))
      );
      
      batchResults.forEach((result, idx) => {
        if (result.success) {
          results.push(result);
        } else {
          failedJobs.push(`Job ${i + idx}: ${result.result?.reason || i18n.t('backtestEngineParallel.k2')}`);
        }
      });
    }

    const durationMs = Date.now() - startTime;
    
    log.info(i18n.t('backtestEngineParallel.k3'));
    
    if (failedJobs.length > 0) {
      log.warn(i18n.t('backtestEngineParallel.k4'), failedJobs.join(', '));
    }

    return {
      results,
      totalJobs: configs.length,
      successfulJobs: results.length,
      failedJobs: failedJobs.length,
      durationMs,
    };
  }

  /**
 *
   */
  private runInWorker(config: BacktestConfig, jobId: number): Promise<BacktestResult> {
    return new Promise((resolve) => {
      const workerPath = path.resolve(__filename);
      
      const worker = new Worker(workerPath, {
        workerData: { jobId: `job-${jobId}`, config } as WorkerRequest,
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        resolve({ 
          success: false, 
          result: { reason: i18n.t('backtestEngineParallel.k5') } as any
        });
      }, 60000); // 60 timeout

      worker.on('message', (response: WorkerResponse) => {
        clearTimeout(timeout);
        resolve(response.result);
        worker.terminate();
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ 
          success: false, 
          result: { reason: error.message } as any
        });
        worker.terminate();
      });
    });
  }
}

// ── export（ API ）──────────────────────────────────────

export class BacktestEngine {
  private parallelEngine: ParallelBacktestEngine;

  constructor(maxWorkers?: number) {
    this.parallelEngine = new ParallelBacktestEngine(maxWorkers);
  }

  async run(config: BacktestConfig): Promise<BacktestResult> {
    log.info(i18n.t('backtestEngineParallel.k6'), config.strategy?.type, config.symbol);
    
 // ， worker
    const core = new BacktestEngineCore();
    return core.run(config);
  }

  /**
 * backtest
   */
  async runBatch(configs: BacktestConfig[]): Promise<ParallelBacktestResult> {
    log.info(i18n.t('backtestEngineParallel.k7'), configs.length, i18n.t('backtestEngineParallel.k8'));
    return this.parallelEngine.runParallel(configs);
  }
}
