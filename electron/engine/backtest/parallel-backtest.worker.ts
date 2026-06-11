// ── DAWN WHALES — Parallel Backtest Worker (J2) ─────────────────────────────
// parameter sweep 100 → 10x
// (strategy, params[], klines[]) 4 ， Worker 25

import { parentPort, workerData } from 'worker_threads';
import type { BacktestConfig, BacktestResult } from './backtest-engine';

interface WorkerTask {
  configs: BacktestConfig[];
  id: number;
}

const task: WorkerTask = workerData;

function runBacktestSync(config: BacktestConfig): BacktestResult {
  const klines = config.klines || [];

  // ── Phase 1: Compute indicators ─────────────────────────────────────
  const closes = klines.map((k: unknown) => k.close);
  const highs = klines.map((k: unknown) => k.high);
  const lows = klines.map((k: unknown) => k.low);

  // MA
  const shortMA = calcMA(closes, config.params?.shortPeriod || 5);
  const longMA = calcMA(closes, config.params?.longPeriod || 20);

  // RSI
  const rsi = calcRSI(closes, 14);

  // MACD
  const [macdLine, signalLine, macdHist] = calcMACD(closes, 12, 26, 9);

  // Bollinger
  const [bbMid, bbUpper, bbLower] = calcBollinger(closes, config.params?.bbPeriod || 20, config.params?.bbStddev || 2);

  // Volume
  const volumeMA = calcMA(klines.map((k: unknown) => k.volume), 20);

  // ── Phase 2: Generate signals ───────────────────────────────────────
  const signals: boolean[] = new Array(klines.length).fill(false);
  const signalTypes: string[] = [];

  for (let i = 1; i < klines.length; i++) {
    let shouldEnter = false;

    if (config.strategyId === 'ma_cross' || config.type === 'ma_cross') {
      shouldEnter = shortMA[i - 1] <= longMA[i - 1] && shortMA[i] > longMA[i];
    } else if (config.strategyId === 'rsi' || config.type === 'rsi') {
      shouldEnter = rsi[i - 1] >= (config.params?.oversold || 30) && rsi[i] < (config.params?.oversold || 30);
    } else if (config.strategyId === 'macd' || config.type === 'macd') {
      shouldEnter = macdHist[i - 1] <= 0 && macdHist[i] > 0;
    } else if (config.strategyId === 'bollinger' || config.type === 'bollinger') {
      shouldEnter = closes[i - 1] >= bbLower[i - 1] && closes[i] < bbLower[i];
    }

    signals[i] = shouldEnter;
    if (shouldEnter) signalTypes.push(config.strategyId);
  }

  // ── Phase 3: Simulate trades ────────────────────────────────────────
  const trades: any[] = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryBar = 0;
  let capital = config.initialCapital || 100000;
  let peak = capital;
  let maxDrawdown = 0;
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  let totalWinPnl = 0;
  let totalLossPnl = 0;

  const stopLoss = config.params?.stopLoss || 0.05;
  const takeProfit = config.params?.takeProfit || 0.15;
  const maxHoldingBars = config.params?.maxHoldingBars || 20;

  for (let i = 0; i < klines.length; i++) {
    if (!inPosition && signals[i]) {
      inPosition = true;
      entryPrice = klines[i].close;
      entryBar = i;
      capital -= 0; // mark (capital unchanged by entry)
      continue;
    }

    if (inPosition) {
      const exitFlag =
        (entryPrice - klines[i].low) / entryPrice >= stopLoss
        || (klines[i].high - entryPrice) / entryPrice >= takeProfit
        || (i - entryBar) >= maxHoldingBars;

      if (exitFlag || i === klines.length - 1) {
        const exitPrice = exitFlag ? klines[i].close : klines[i].close;
        const pnl = (exitPrice - entryPrice) * 100;
        const pnlPct = (exitPrice - entryPrice) / entryPrice;

        trades.push({
          entryTime: klines[entryBar].time,
          exitTime: klines[i].time,
          side: 'LONG',
          entryPrice,
          exitPrice,
          qty: 100,
          pnl,
          pnlPct,
          bars: i - entryBar,
        });

        totalPnl += pnl;
        capital += pnl;
        if (capital > peak) peak = capital;
        const dd = (peak - capital) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (pnl > 0) { wins++; totalWinPnl += pnl; }
        else { losses++; totalLossPnl += Math.abs(pnl); }

        inPosition = false;
      }
    }
  }

  // ── Phase 4: Performance metrics ────────────────────────────────────
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? wins / totalTrades : 0;
  const avgWin = wins > 0 ? totalWinPnl / wins : 0;
  const avgLoss = losses > 0 ? totalLossPnl / losses : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : Infinity;

  // Sharpe (simplified, daily frequency assumed)
  const returns = trades.map(t => t.pnlPct);
  const avgReturn = returns.length > 0 ? returns.reduce((a: number, b: number) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((a: number, b: number) => a + (b - avgReturn) ** 2, 0) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    identifier: `worker_${config.strategyId || config.type}_${Math.random().toString(36).substring(2, 6)}`,
    symbol: config.symbol || '---',
    period: config.period || 'daily',
    strategyId: config.strategyId || config.type || 'unknown',
    totalReturn: ((capital - (config.initialCapital || 100000)) / (config.initialCapital || 100000)) * 100,
    totalReturnPct: ((capital - (config.initialCapital || 100000)) / (config.initialCapital || 100000)) * 100,
    annualizedReturn: 0,
    maxDrawdown: maxDrawdown * 100,
    sharpe,
    sortino: sharpe * 0.9,
    winRate: winRate * 100,
    profitFactor,
    payoffRatio,
    calmar: 0,
    totalTrades,
    winningTrades: wins,
    losingTrades: losses,
    avgWin,
    avgLoss,
    avgHoldingBars: trades.length > 0 ? trades.reduce((a: number, t: unknown) => a + t.bars, 0) / trades.length : 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    equity: [],
    trades,
    config: config,
  };
}

// ── Indicator helpers (self-contained, no imports needed in Worker) ────────

function calcMA(data: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    result.push(i >= period - 1 ? sum / period : NaN);
  }
  return result;
}

function calcRSI(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  return result;
}

function calcEMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  result[period - 1] = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function calcMACD(closes: number[], fast: number, slow: number, signal: number): [number[], number[], number[]] {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macd: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macd.push(isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]);
  }
  const signalLine = calcEMA(macd.filter(x => !isNaN(x)), signal);
  const padLen = macd.length - signalLine.length;
  const paddedSignal = [...new Array(padLen).fill(NaN), ...signalLine.slice(Math.max(0, padLen))];
  const hist = paddedSignal.map((s, i) => isNaN(macd[i]) || isNaN(s) ? NaN : macd[i] - s);
  return [macd, paddedSignal, hist];
}

function calcSMA(data: number[], period: number): number[] {
  return calcMA(data, period);
}

function calcStdDev(data: number[], period: number): number[] {
  const sma = calcMA(data, period);
  const result: number[] = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j] - sma[i]) ** 2;
    result[i] = Math.sqrt(sumSq / period);
  }
  return result;
}

function calcBollinger(closes: number[], period: number, stddev: number): [number[], number[], number[]] {
  const mid = calcSMA(closes, period);
  const dev = calcStdDev(closes, period);
  const upper = mid.map((m, i) => isNaN(m) || isNaN(dev[i]) ? NaN : m + stddev * dev[i]);
  const lower = mid.map((m, i) => isNaN(m) || isNaN(dev[i]) ? NaN : m - stddev * dev[i]);
  return [mid, upper, lower];
}

// ── Execute ────────────────────────────────────────────────────────────────
const results: { config: BacktestConfig; result: BacktestResult }[] = [];
for (const cfg of task.configs) {
  const r = runBacktestSync(cfg);
  results.push({ config: cfg, result: r });
}
parentPort?.postMessage(results);
