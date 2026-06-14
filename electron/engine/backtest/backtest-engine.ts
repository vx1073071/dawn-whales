// ── Backtest Engine — backtest engine v1 ──────────────────────────────────────────
// bar K ，strategy/policy metric
// Phase 1: TypeScript | Phase 2: Rust N-API（performance）

import log from 'electron-log';
import i18n from '../../../src/i18n';
// R173 D3: Factor backtest imports
import { getETFPriceSource } from '../factors/etf-price-source';
import { ETF_PAIRS, type FactorDailyReturn } from '../factors/etf-price-source';

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
    totalReturn: number;       // total return %
    annualReturn: number;      // annualized return %
    sharpeRatio: number;       // Sharpe ratio
    maxDrawdown: number;       // max drawdown %
    winRate: number;           // win rate %
    profitFactor: number;      // profit factor
    totalTrades: number;
    avgTradePnl: number;       // avg trade return %
    avgHoldingBars: number;    // avg holding bars
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
  commission: number;          // commission rate (0.001 = 0.1%)
  slippage: number;            // slippage (0.001 = 0.1%)
  strategy: StrategyConfig;
  klines?: KLine[];            // if provided, use directly; else fetch from OpenD
}

interface StrategyConfig {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'custom';
  params: Record<string, number>;
  stopLoss?: number;           // stop loss %
  takeProfit?: number;         // take profit %
}

// ── Technical Indicators ───────────────────────────────────────────────────

function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function ema(data: number[], period: number): (number | null)[] {
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

function rsi(data: number[], period: number = 14): (number | null)[] {
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

function macd(data: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(data, fast);
  const emaSlow = ema(data, slow);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    }
  }

  // Signal line = EMA of MACD line
  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalRaw = ema(validMacd, signal);
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

  // Histogram = MACD - Signal
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

function bollingerBands(data: number[], period = 20, stdDev = 2) {
  const mid = sma(data, period);
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

function atr(klines: KLine[], period = 14): (number | null)[] {
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

// ── Signal Generator ───────────────────────────────────────────────────────

type Signal = 'BUY' | 'SELL' | 'HOLD';

function evaluateSignal(config: StrategyConfig, indicators: Indicators, i: number): Signal {
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

interface Indicators {
  closes: number[];
  smaShort: (number | null)[];
  smaLong: (number | null)[];
  rsi: (number | null)[];
  macd: { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] };
  bollinger: { upper: (number | null)[]; mid: (number | null)[]; lower: (number | null)[] };
  atr: (number | null)[];
  position: 'FLAT' | 'LONG';
}

function computeIndicators(klines: KLine[], config: StrategyConfig): Indicators {
  const closes = klines.map((k) => k.close);
  const p = config.params;

  return {
    closes,
    smaShort: sma(closes, p.shortPeriod ?? p.fast ?? 10),
    smaLong: sma(closes, p.longPeriod ?? p.slow ?? 30),
    rsi: rsi(closes, p.rsiPeriod ?? 14),
    macd: macd(closes, p.macdFast ?? 12, p.macdSlow ?? 26, p.macdSignal ?? 9),
    bollinger: bollingerBands(closes, p.bbPeriod ?? 20, p.bbStdDev ?? 2),
    atr: atr(klines, p.atrPeriod ?? 14),
    position: 'FLAT',
  };
}

// ── Backtest Engine ────────────────────────────────────────────────────────

export class BacktestEngine {
  async run(config: BacktestConfig): Promise<BacktestResult> {
    log.info('[BacktestEngine] Starting:', config.strategy?.type, config.symbol, `${config.klines?.length ?? 0} bars`);

    const klines = config.klines || [];
    if (klines.length < 50) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { success: false, result: this.emptyResult(config, i18n.t('backtestEngine.k1')) } as any;
    }

    const { initialCapital, commission, slippage, strategy } = config;
    const capital = initialCapital || 100000;
    const commRate = commission ?? 0.001;
    const slipRate = slippage ?? 0.0005;

    // Compute all indicators upfront
    const indicators = computeIndicators(klines, strategy);

    // Run backtest
    let cash = capital;
    let position = 0;        // shares held
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
      const signal = evaluateSignal(strategy, indicators, i);

      // Check stop-loss / take-profit
      if (position > 0 && entryPrice > 0) {
        const pnlPct = (bar.close - entryPrice) / entryPrice;
        if (strategy.stopLoss && pnlPct <= -strategy.stopLoss / 100) {
          // Stop loss triggered
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
          // Take profit triggered
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
        const investPct = 0.95; // Use 95% of cash
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
      equityCurve.push({ time: bar.time, value: Math.round(equity * 100) / 100 });

      // Max drawdown
      if (equity > peakEquity) peakEquity = equity;
      const dd = (peakEquity - equity) / peakEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;

      // Daily returns for Sharpe
      if (i > 0 && prevEquity > 0) {
        dailyReturns.push((equity - prevEquity) / prevEquity);
      }
      prevEquity = equity;
    }

    // Close open position at last bar
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
      position = 0;
    }

    // Calculate metrics
    const finalEquity = cash;
    const totalReturn = ((finalEquity - capital) / capital) * 100;
    const tradingDays = klines.length;
    const years = tradingDays / 252;
    const annualReturn = years > 0 ? (Math.pow(finalEquity / capital, 1 / years) - 1) * 100 : 0;

    // Sharpe ratio (annualized, risk-free = 4%)
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
      equityCurve: equityCurve.filter((_, idx) => idx % Math.max(1, Math.floor(equityCurve.length / 200)) === 0 || idx === equityCurve.length - 1),
      trades,
      config,
    };

    log.info(`[BacktestEngine] Done: ${result.totalReturn}% return, ${result.totalTrades} trades, Sharpe ${result.sharpeRatio}`);
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

// ── R173 D3: Factor Portfolio Backtest ─────────────────────────────────────
// Runs a multi-factor portfolio backtest using real ETF price data.
// Connects to frontend C2 mini-backtest (weight-drag → instant preview).

/** Factor backtest input */
export interface FactorBacktestRequest {
  /** Factor IDs with weights (weights should sum to 1) */
  factorWeights: Record<string, number>;
  /** Start date YYYY-MM-DD (inclusive) */
  startDate: string;
  /** End date YYYY-MM-DD (inclusive) */
  endDate: string;
  /** Optional market filter */
  market?: string;
  /** Risk-free rate (annualized, default 0.04 = 4%) */
  riskFreeRate?: number;
  /** Rebalance frequency in trading days (default 20 = monthly) */
  rebalanceFreq?: number;
}

/** Factor contribution decomposition */
export interface FactorContribution {
  factorId: string;
  weight: number;
  annualizedReturn: number;
  annualizedVol: number;
  sharpeRatio: number;
  contributionToReturn: number;   // weight × annualReturn
  contributionToRisk: number;     // % of total portfolio risk
  maxDrawdown: number;
}

/** Factor backtest result */
export interface FactorBacktestResult {
  success: boolean;
  /** Total annualized return (%) */
  annualReturn: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Max drawdown (%) */
  maxDrawdown: number;
  /** Win rate (% of positive days) */
  winRate: number;
  /** Cumulative return (%) */
  cumulativeReturn: number;
  /** Annualized volatility (%) */
  annualVolatility: number;
  /** Calmar ratio (annualReturn / |maxDrawdown|) */
  calmarRatio: number;
  /** Number of trading days */
  tradingDays: number;
  /** Daily equity curve */
  equityCurve: Array<{ date: string; value: number }>;
  /** Daily returns for further analysis */
  dailyReturns: number[];
  /** Per-factor contribution breakdown */
  factorContributions: FactorContribution[];
  /** Input request echo */
  request: FactorBacktestRequest;
  /** Error message (if success=false) */
  error?: string;
}

/**
 * Run a factor portfolio backtest.
 *
 * Uses real ETF factor returns from etf-price-source.
 * Computes portfolio return = Σ(weight_i × factor_return_i) for each day.
 *
 * Connects to: ML C2 mini-backtest (drag weight → instant preview)
 */
export async function runFactorBacktest(
  request: FactorBacktestRequest,
): Promise<FactorBacktestResult> {
  const { factorWeights, startDate, endDate, riskFreeRate = 0.04, rebalanceFreq = 20 } = request;

  // Validate
  const totalWeight = Object.values(factorWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(totalWeight - 1) > 0.01) {
    return buildError(request, `权重总和必须为1.0，当前为${totalWeight.toFixed(3)}`);
  }

  const factorIds = Object.keys(factorWeights);
  if (factorIds.length === 0) {
    return buildError(request, '至少需要1个因子');
  }

  // Get ETF data source
  const etfSource = getETFPriceSource();
  await etfSource.initialize();

  // Get daily factor returns
  const allReturns = etfSource.computeFactorReturnsInRange(startDate, endDate);
  if (allReturns.length < 5) {
    return buildError(request, `数据不足: 仅${allReturns.length}个交易日，至少需要5天`);
  }

  // Filter to requested factors
  const validFactors = factorIds.filter(fid =>
    allReturns.some(r => r[fid] !== undefined),
  );
  if (validFactors.length === 0) {
    return buildError(request, `所选因子均无数据: ${factorIds.join(', ')}`);
  }

  // Compute portfolio daily returns
  const dailyReturns: number[] = [];
  const equityCurve: Array<{ date: string; value: number }> = [];
  const factorReturns: Record<string, number[]> = {};
  for (const fid of validFactors) {
    factorReturns[fid] = [];
  }

  let equity = 100; // Start at 100
  equityCurve.push({ date: allReturns[0].date, value: equity });

  // Rebalance: redistribute weights every rebalanceFreq days
  const rebalancedWeights = { ...factorWeights };

  for (let i = 0; i < allReturns.length; i++) {
    const day = allReturns[i];

    // Periodic rebalance
    if (i > 0 && i % rebalanceFreq === 0) {
      // Reset weights to original
      for (const fid of validFactors) {
        rebalancedWeights[fid] = (factorWeights[fid] / totalWeight);
      }
    }

    // Portfolio return = sum(weight_i × return_i)
    let portfolioReturn = 0;
    for (const fid of validFactors) {
      const ret = (day[fid] as number) || 0;
      portfolioReturn += (rebalancedWeights[fid] || 0) * ret;
      factorReturns[fid].push(ret);
      // Update rebalanced weights with drift
      rebalancedWeights[fid] = (rebalancedWeights[fid] || 0) * (1 + ret);
    }

    dailyReturns.push(portfolioReturn);
    equity *= (1 + portfolioReturn);
    equityCurve.push({ date: day.date, value: Math.round(equity * 100) / 100 });
  }

  // ── Compute metrics ──────────────────────────────────────────────────

  const n = dailyReturns.length;
  const totalReturn = equity / 100 - 1;
  const cumulativeReturn = totalReturn * 100;
  const years = n / 252;

  // Annualized return
  const annualReturn = years > 0
    ? (Math.pow(1 + totalReturn, 1 / years) - 1) * 100
    : 0;

  // Daily stats
  const dailyMean = n > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / n : 0;
  const dailyStd = n > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - dailyMean) ** 2, 0) / n)
    : 0;
  const annualVolatility = dailyStd * Math.sqrt(252) * 100;

  // Sharpe ratio
  const sharpeRatio = dailyStd > 0
    ? ((dailyMean * 252) - riskFreeRate) / (dailyStd * Math.sqrt(252))
    : 0;

  // Max drawdown
  let peak = equityCurve[0].value;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = (point.value - peak) / peak * 100;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  // Win rate
  const wins = dailyReturns.filter(r => r > 0).length;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  // Calmar ratio
  const calmarRatio = maxDrawdown < 0 ? annualReturn / Math.abs(maxDrawdown) : annualReturn / 0.01;

  // Factor contribution decomposition
  const factorContributions: FactorContribution[] = [];
  for (const fid of validFactors) {
    const rets = factorReturns[fid] || [];
    const fMean = rets.length > 0 ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
    const fStd = rets.length > 1
      ? Math.sqrt(rets.reduce((s, r) => s + (r - fMean) ** 2, 0) / rets.length)
      : 0;
    const fAnnualRet = fMean * 252 * 100;
    const fAnnualVol = fStd * Math.sqrt(252) * 100;
    const fSharpe = fStd > 0 ? (fMean * 252 - riskFreeRate) / (fStd * Math.sqrt(252)) : 0;

    // Factor drawdown
    let fPeak = 0;
    let fDD = 0;
    let fCum = 1;
    for (const r of rets) {
      fCum *= (1 + r);
      if (fCum > fPeak) fPeak = fCum;
      const dd = (fCum - fPeak) / fPeak * 100;
      if (dd < fDD) fDD = dd;
    }

    factorContributions.push({
      factorId: fid,
      weight: factorWeights[fid] || 0,
      annualizedReturn: Math.round(fAnnualRet * 100) / 100,
      annualizedVol: Math.round(fAnnualVol * 100) / 100,
      sharpeRatio: Math.round(fSharpe * 100) / 100,
      contributionToReturn: Math.round((factorWeights[fid] || 0) * fAnnualRet * 100) / 100,
      contributionToRisk: 0, // computed below
      maxDrawdown: Math.round(fDD * 100) / 100,
    });
  }

  // Risk contribution (simplified: weight × vol / total vol)
  const totalRiskContrib = factorContributions.reduce(
    (s, f) => s + Math.abs(f.weight * f.annualizedVol / 100), 0,
  );
  for (const fc of factorContributions) {
    fc.contributionToRisk = totalRiskContrib > 0
      ? Math.round((Math.abs(fc.weight * fc.annualizedVol / 100) / totalRiskContrib) * 10000) / 100
      : 0;
  }

  log.info(
    `[runFactorBacktest] ${validFactors.length} factors × ${n} days: ` +
    `ret=${annualReturn.toFixed(1)}%, Sharpe=${sharpeRatio.toFixed(2)}, MaxDD=${maxDrawdown.toFixed(1)}%`,
  );

  return {
    success: true,
    annualReturn: Math.round(annualReturn * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    winRate: Math.round(winRate * 10) / 10,
    cumulativeReturn: Math.round(cumulativeReturn * 100) / 100,
    annualVolatility: Math.round(annualVolatility * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    tradingDays: n,
    equityCurve: equityCurve.filter((_, idx) =>
      idx % Math.max(1, Math.floor(equityCurve.length / 200)) === 0 ||
      idx === equityCurve.length - 1,
    ),
    dailyReturns,
    factorContributions: factorContributions.sort(
      (a, b) => Math.abs(b.contributionToReturn) - Math.abs(a.contributionToReturn),
    ),
    request,
  };
}

function buildError(request: FactorBacktestRequest, msg: string): FactorBacktestResult {
  return {
    success: false,
    error: msg,
    annualReturn: 0, sharpeRatio: 0, maxDrawdown: 0, winRate: 0,
    cumulativeReturn: 0, annualVolatility: 0, calmarRatio: 0, tradingDays: 0,
    equityCurve: [], dailyReturns: [], factorContributions: [],
    request,
  };
}
