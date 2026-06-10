// ── Backtest Engine — 回测引擎 v1 ──────────────────────────────────────────
// 逐 bar 回放 K 线，评估策略信号，模拟成交，计算绩效指标
// Phase 1: TypeScript | Phase 2: Rust N-API（性能热点）

import log from 'electron-log';
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
    totalReturn: number;       // 总收益率 %
    annualReturn: number;      // 年化收益率 %
    sharpeRatio: number;       // 夏普比率
    maxDrawdown: number;       // 最大回撤 %
    winRate: number;           // 胜率 %
    profitFactor: number;      // 盈亏比
    totalTrades: number;
    avgTradePnl: number;       // 平均交易收益 %
    avgHoldingBars: number;    // 平均持仓 bar 数
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
  commission: number;          // 手续费率 (0.001 = 0.1%)
  slippage: number;            // 滑点 (0.001 = 0.1%)
  strategy: StrategyConfig;
  klines?: KLine[];            // 如果已提供，直接用；否则从 OpenD 拉
}

interface StrategyConfig {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'custom';
  params: Record<string, number>;
  stopLoss?: number;           // 止损 %
  takeProfit?: number;         // 止盈 %
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
