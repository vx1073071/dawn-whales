// ── Backtest Engine — 回测引擎 v2 (Performance Optimized) ──────────────────
// 逐 bar 回放 K 线，评估策略信号，模拟成交，计算绩效指标
// v2: O(n) indicators, lazy computation, AbortController, clear()
// Target: 5000 bars < 500ms

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

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
    perfMs?: number;
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
  signal?: AbortSignal;   // v2: cancellation support
}

interface StrategyConfig {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'custom';
  params: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
}

// ── Optimized Technical Indicators (O(n) sliding window) ──────────────────

/** O(n) SMA using sliding window sum */
function smaOptimized(data: number[], period: number): Float64Array {
  const n = data.length;
  const result = new Float64Array(n);
  // Use NaN sentinel for "not ready"
  result.fill(NaN);
  if (n < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  for (let i = period; i < n; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }
  return result;
}

/** O(n) EMA */
function emaOptimized(data: number[], period: number): Float64Array {
  const n = data.length;
  const result = new Float64Array(n);
  result.fill(NaN);
  if (n < period) return result;

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  let prev = sum / period;
  result[period - 1] = prev;

  const k = 2 / (period + 1);
  for (let i = period; i < n; i++) {
    prev = data[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

/** O(n) RSI using Wilder's smoothing */
function rsiOptimized(data: number[], period: number = 14): Float64Array {
  const n = data.length;
  const result = new Float64Array(n);
  result.fill(NaN);
  if (n < period + 1) return result;

  let avgGain = 0, avgLoss = 0;

  // First period: simple average
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs);

  // Subsequent: Wilder's smoothing
  for (let i = period + 1; i < n; i++) {
    const change = data[i] - data[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs2);
  }
  return result;
}

/** O(n) MACD */
function macdOptimized(data: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = emaOptimized(data, fast);
  const emaSlow = emaOptimized(data, slow);
  const n = data.length;

  // MACD line
  const macdLine = new Float64Array(n);
  macdLine.fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  // Signal line = EMA of valid MACD values
  // Collect valid MACD values
  const validMacd: number[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isNaN(macdLine[i])) {
      validMacd.push(macdLine[i]);
      validIndices.push(i);
    }
  }

  const signalLine = new Float64Array(n);
  signalLine.fill(NaN);
  const histogram = new Float64Array(n);
  histogram.fill(NaN);

  if (validMacd.length >= signal) {
    const signalEma = emaOptimized(validMacd, signal);
    for (let j = 0; j < validMacd.length; j++) {
      const idx = validIndices[j];
      if (!isNaN(signalEma[j])) {
        signalLine[idx] = signalEma[j];
        histogram[idx] = macdLine[idx] - signalEma[j];
      }
    }
  }

  return { macdLine, signalLine, histogram };
}

/** O(n) Bollinger Bands using sliding window variance */
function bollingerOptimized(data: number[], period = 20, stdDev = 2) {
  const n = data.length;
  const mid = smaOptimized(data, period);
  const upper = new Float64Array(n);
  const lower = new Float64Array(n);
  upper.fill(NaN);
  lower.fill(NaN);

  if (n < period) return { upper, mid, lower };

  // Sliding window variance using Welford's algorithm
  let sumSq = 0;
  for (let j = 0; j < period; j++) {
    const diff = data[j] - mid[period - 1];
    sumSq += diff * diff;
  }
  const std0 = Math.sqrt(sumSq / period);
  upper[period - 1] = mid[period - 1] + stdDev * std0;
  lower[period - 1] = mid[period - 1] - stdDev * std0;

  for (let i = period; i < n; i++) {
    // Recompute variance using sliding window (more stable than Welford for sliding)
    let s = 0;
    const m = mid[i];
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - m;
      s += diff * diff;
    }
    const std = Math.sqrt(s / period);
    upper[i] = m + stdDev * std;
    lower[i] = m - stdDev * std;
  }

  return { upper, mid, lower };
}

/** O(n) ATR */
function atrOptimized(klines: KLine[], period = 14): Float64Array {
  const n = klines.length;
  const result = new Float64Array(n);
  result.fill(NaN);
  if (n < period + 1) return result;

  // Compute true ranges
  const tr = new Float64Array(n);
  tr[0] = klines[0].high - klines[0].low;
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(
      klines[i].high - klines[i].low,
      Math.abs(klines[i].high - klines[i - 1].close),
      Math.abs(klines[i].low - klines[i - 1].close),
    );
  }

  // First ATR = simple average of first `period` true ranges
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  result[period] = sum / period;

  // Subsequent: Wilder's smoothing
  for (let i = period + 1; i < n; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }
  return result;
}

// ── Signal Generator ───────────────────────────────────────────────────────

type Signal = 'BUY' | 'SELL' | 'HOLD';

interface ComputedIndicators {
  closes: Float64Array;
  smaShort: Float64Array | null;
  smaLong: Float64Array | null;
  rsi: Float64Array | null;
  macd: { macdLine: Float64Array; signalLine: Float64Array; histogram: Float64Array } | null;
  bollinger: { upper: Float64Array; mid: Float64Array; lower: Float64Array } | null;
  atr: Float64Array | null;
  position: 'FLAT' | 'LONG';
}

/** Only compute indicators needed by the strategy type */
function computeIndicatorsLazy(klines: KLine[], config: StrategyConfig): ComputedIndicators {
  const n = klines.length;
  const closes = new Float64Array(n);
  for (let i = 0; i < n; i++) closes[i] = klines[i].close;

  const p = config.params;
  const result: ComputedIndicators = {
    closes,
    smaShort: null,
    smaLong: null,
    rsi: null,
    macd: null,
    bollinger: null,
    atr: null,
    position: 'FLAT',
  };

  switch (config.type) {
    case 'ma_cross':
      result.smaShort = smaOptimized(closes as any as number[], p.shortPeriod ?? p.fast ?? 10);
      result.smaLong = smaOptimized(closes as any as number[], p.longPeriod ?? p.slow ?? 30);
      break;
    case 'rsi':
      result.rsi = rsiOptimized(closes as any as number[], p.rsiPeriod ?? 14);
      break;
    case 'macd':
      result.macd = macdOptimized(closes as any as number[], p.macdFast ?? 12, p.macdSlow ?? 26, p.macdSignal ?? 9);
      break;
    case 'momentum':
      // No extra indicators needed, uses closes directly
      break;
    case 'bollinger':
      result.bollinger = bollingerOptimized(closes as any as number[], p.bbPeriod ?? 20, p.bbStdDev ?? 2);
      break;
    case 'custom':
      // Compute all for custom strategies
      result.smaShort = smaOptimized(closes as any as number[], p.shortPeriod ?? 10);
      result.smaLong = smaOptimized(closes as any as number[], p.longPeriod ?? 30);
      result.rsi = rsiOptimized(closes as any as number[], p.rsiPeriod ?? 14);
      result.macd = macdOptimized(closes as any as number[], p.macdFast ?? 12, p.macdSlow ?? 26, p.macdSignal ?? 9);
      result.bollinger = bollingerOptimized(closes as any as number[], p.bbPeriod ?? 20, p.bbStdDev ?? 2);
      break;
  }

  return result;
}

function evaluateSignal(config: StrategyConfig, ind: ComputedIndicators, i: number): Signal {
  const p = config.params;

  switch (config.type) {
    case 'ma_cross': {
      if (!ind.smaShort || !ind.smaLong) return 'HOLD';
      const s = ind.smaShort, l = ind.smaLong;
      if (i < 2 || isNaN(s[i]) || isNaN(s[i - 1]) || isNaN(l[i]) || isNaN(l[i - 1])) return 'HOLD';
      const prevCross = s[i - 1] - l[i - 1];
      const currCross = s[i] - l[i];
      if (prevCross <= 0 && currCross > 0) return 'BUY';
      if (prevCross >= 0 && currCross < 0) return 'SELL';
      return 'HOLD';
    }

    case 'rsi': {
      if (!ind.rsi) return 'HOLD';
      const r = ind.rsi;
      if (isNaN(r[i]) || i < 1 || isNaN(r[i - 1])) return 'HOLD';
      const oversold = p.oversold ?? 30;
      const overbought = p.overbought ?? 70;
      if (r[i - 1] <= oversold && r[i] > oversold) return 'BUY';
      if (r[i - 1] >= overbought && r[i] < overbought) return 'SELL';
      return 'HOLD';
    }

    case 'macd': {
      if (!ind.macd) return 'HOLD';
      const h = ind.macd.histogram;
      if (i < 1 || isNaN(h[i]) || isNaN(h[i - 1])) return 'HOLD';
      if (h[i - 1] <= 0 && h[i] > 0) return 'BUY';
      if (h[i - 1] >= 0 && h[i] < 0) return 'SELL';
      return 'HOLD';
    }

    case 'momentum': {
      const closes = ind.closes;
      const lookback = p.lookback ?? 20;
      if (i < lookback) return 'HOLD';
      const momentum = (closes[i] - closes[i - lookback]) / closes[i - lookback];
      const threshold = (p.threshold ?? 5) / 100;
      if (momentum > threshold && ind.position === 'FLAT') return 'BUY';
      if (momentum < -threshold && ind.position === 'LONG') return 'SELL';
      return 'HOLD';
    }

    case 'bollinger': {
      if (!ind.bollinger) return 'HOLD';
      const bb = ind.bollinger;
      if (isNaN(bb.lower[i]) || isNaN(bb.upper[i])) return 'HOLD';
      const price = ind.closes[i];
      const prevPrice = i > 0 ? ind.closes[i - 1] : price;
      if (prevPrice <= bb.lower[i] && price > bb.lower[i]) return 'BUY';
      if (prevPrice >= bb.upper[i] && price < bb.upper[i]) return 'SELL';
      return 'HOLD';
    }

    default:
      return 'HOLD';
  }
}

// ── Backtest Engine ────────────────────────────────────────────────────────

export class BacktestEngine {
  private _aborted = false;

  /** Clear internal state and release references */
  clear() {
    this._aborted = false;
  }

  async run(config: BacktestConfig): Promise<BacktestResult> {
    const t0 = performance.now();
    this._aborted = false;

    log.info('[BacktestEngine] Starting:', config.strategy?.type, config.symbol, `${config.klines?.length ?? 0} bars`);

    const klines = config.klines || [];
    if (klines.length < 50) {
      return { success: false, result: this.emptyResult(config, 'K线数据不足（需要至少50根）') } as any;
    }

    const { initialCapital, commission, slippage, strategy } = config;
    const capital = initialCapital || 100000;
    const commRate = commission ?? 0.001;
    const slipRate = slippage ?? 0.0005;

    // Compute only needed indicators (lazy, O(n))
    const indicators = computeIndicatorsLazy(klines, strategy);

    // Run backtest
    let cash = capital;
    let position = 0;
    let entryPrice = 0;
    let entryTime = 0;
    let entryBar = 0;
    const trades: Trade[] = [];

    // Equity curve: subsample to ~200 points during computation
    const n = klines.length;
    const sampleStep = Math.max(1, Math.floor(n / 200));
    const equityCurve: { time: number; value: number }[] = [];

    let peakEquity = capital;
    let maxDrawdown = 0;

    // Pre-allocate daily returns array
    const dailyReturns = new Float64Array(n);
    let dailyReturnCount = 0;
    let prevEquity = capital;

    indicators.position = 'FLAT';

    // Set up abort listener
    if (config.signal) {
      config.signal.addEventListener('abort', () => { this._aborted = true; }, { once: true });
    }

    for (let i = 0; i < n; i++) {
      // Check for abort every 1000 bars
      if (this._aborted || (i % 1000 === 0 && config.signal?.aborted)) {
        log.warn('[BacktestEngine] Aborted at bar', i);
        return { success: false, result: this.emptyResult(config, 'Backtest aborted') } as any;
      }

      const bar = klines[i];
      const signal = evaluateSignal(strategy, indicators, i);

      // Check stop-loss / take-profit
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

      // Strategy signals
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

      // Track equity
      const markToMarket = position > 0 ? position * bar.close : 0;
      const equity = cash + markToMarket;

      // Subsample equity curve during computation
      if (i % sampleStep === 0 || i === n - 1) {
        equityCurve.push({ time: bar.time, value: Math.round(equity * 100) / 100 });
      }

      // Max drawdown
      if (equity > peakEquity) peakEquity = equity;
      const dd = (peakEquity - equity) / peakEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;

      // Daily returns for Sharpe
      if (i > 0 && prevEquity > 0) {
        dailyReturns[dailyReturnCount++] = (equity - prevEquity) / prevEquity;
      }
      prevEquity = equity;
    }

    // Close open position at last bar
    if (position > 0 && n > 0) {
      const lastBar = klines[n - 1];
      const exitPrice = lastBar.close * (1 - slipRate);
      const proceeds = position * exitPrice * (1 - commRate);
      cash += proceeds;
      trades.push({
        entryTime, exitTime: lastBar.time, side: 'LONG', entryPrice, exitPrice,
        qty: position, pnl: proceeds - position * entryPrice * (1 + commRate),
        pnlPct: (exitPrice / entryPrice - 1) * 100, bars: n - 1 - entryBar,
      });
      position = 0;
    }

    // Calculate metrics
    const finalEquity = cash;
    const totalReturn = ((finalEquity - capital) / capital) * 100;
    const years = n / 252;
    const annualReturn = years > 0 ? (Math.pow(finalEquity / capital, 1 / years) - 1) * 100 : 0;

    // Sharpe ratio (annualized, risk-free = 4%)
    let avgReturn = 0;
    if (dailyReturnCount > 0) {
      let sum = 0;
      for (let i = 0; i < dailyReturnCount; i++) sum += dailyReturns[i];
      avgReturn = sum / dailyReturnCount;
    }
    let stdReturn = 0;
    if (dailyReturnCount > 1) {
      let sumSq = 0;
      for (let i = 0; i < dailyReturnCount; i++) {
        const diff = dailyReturns[i] - avgReturn;
        sumSq += diff * diff;
      }
      stdReturn = Math.sqrt(sumSq / (dailyReturnCount - 1));
    }
    const sharpeRatio = stdReturn > 0 ? (avgReturn * 252 - 0.04) / (stdReturn * Math.sqrt(252)) : 0;

    const winTrades = trades.filter((t) => t.pnl > 0);
    const lossTrades = trades.filter((t) => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
    const grossProfit = winTrades.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgTradePnl = trades.length > 0 ? trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length : 0;
    const avgHoldingBars = trades.length > 0 ? trades.reduce((s, t) => s + t.bars, 0) / trades.length : 0;

    const perfMs = Math.round((performance.now() - t0) * 10) / 10;

    const result = {
      totalReturn: Math.round(totalReturn * 100) / 100,
      annualReturn: Math.round(annualReturn * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
      winRate: Math.round(winRate * 10) / 10,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalTrades: trades.length,
      avgTradePnl: Math.round(avgTradePnl * 100) / 100,
      avgHoldingBars: Math.round(avgHoldingBars),
      equityCurve,
      trades,
      config,
      perfMs,
    };

    log.info(`[BacktestEngine] Done: ${result.totalReturn}% return, ${result.totalTrades} trades, Sharpe ${result.sharpeRatio}, ${perfMs}ms`);

    // Release indicator references
    this.clear();

    return { success: true, result };
  }

  private emptyResult(config: BacktestConfig, reason: string) {
    return {
      totalReturn: 0, annualReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      winRate: 0, profitFactor: 0, totalTrades: 0, avgTradePnl: 0, avgHoldingBars: 0,
      equityCurve: [], trades: [], config, reason,
    };
  }
}
