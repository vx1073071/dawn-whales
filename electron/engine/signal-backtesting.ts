/**
 * J-78-01: signal-backtesting.ts 完整引擎 (~280L)
 * replaces 27-line stub
 *
 * 历史信号与真实K线对齐回测 → BUY→SELL闭环PnL
 * 指标: 胜率/盈亏比/最大回撤/夏普比率/逐笔详情
 */

export interface SignalRecord {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  signalPrice: number;
  signalTime: number;
  signalStrength: number;
  strategy: string;
  metadata?: Record<string, unknown>;
}

export interface KLineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradeResult {
  signalId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPct: number;
  holdingDurationMs: number;
  exitReason: 'TP' | 'SL' | 'TIME' | 'SIGNAL_REVERSE' | 'END_OF_DATA';
  strategy: string;
}

export interface SignalBacktestResult {
  totalSignals: number;
  trades: TradeResult[];
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalPnl: number;
  totalPnlPct: number;
  avgHoldingMinutes: number;
  bestTrade: { pnlPct: number; symbol: string };
  worstTrade: { pnlPct: number; symbol: string };
  strategyBreakdown: Record<string, { count: number; winRate: number; totalPnlPct: number }>;
}

export interface SignalBacktesterConfig {
  takeProfitPct: number;
  stopLossPct: number;
  maxHoldingMs: number;
  slippagePct: number;
  riskFreeRate: number;
  minTradesForSharpe: number;
}

const DEFAULT_CONFIG: SignalBacktesterConfig = {
  takeProfitPct: 0.05,
  stopLossPct: 0.03,
  maxHoldingMs: 7 * 24 * 3600 * 1000,
  slippagePct: 0.001,
  riskFreeRate: 0.02,
  minTradesForSharpe: 10,
};

export class SignalBacktester {
  private config: SignalBacktesterConfig;
  private klineCache = new Map<string, KLineBar[]>();

  constructor(config?: Partial<SignalBacktesterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  loadKLineData(symbol: string, bars: KLineBar[]): void {
    this.klineCache.set(
      symbol,
      [...bars].sort((a, b) => a.timestamp - b.timestamp),
    );
  }

  matchSignalToExit(signal: SignalRecord, bars: KLineBar[]): TradeResult | null {
    const entryPrice = signal.signalPrice * (1 + this.config.slippagePct);
    const idx = bars.findIndex((b) => b.timestamp >= signal.signalTime);
    if (idx === -1 || idx >= bars.length - 1) return null;
    const entryTs = bars[idx].timestamp;

    for (let i = idx + 1; i < bars.length; i++) {
      const bar = bars[i],
        holdingMs = bar.timestamp - entryTs;
      if (bar.high >= entryPrice * (1 + this.config.takeProfitPct))
        return this.build(
          signal,
          entryPrice,
          entryPrice * (1 + this.config.takeProfitPct) * (1 - this.config.slippagePct),
          entryTs,
          bar.timestamp,
          holdingMs,
          'TP',
        );
      if (bar.low <= entryPrice * (1 - this.config.stopLossPct))
        return this.build(
          signal,
          entryPrice,
          entryPrice * (1 - this.config.stopLossPct) * (1 - this.config.slippagePct),
          entryTs,
          bar.timestamp,
          holdingMs,
          'SL',
        );
      if (holdingMs >= this.config.maxHoldingMs)
        return this.build(
          signal,
          entryPrice,
          bar.close * (1 - this.config.slippagePct),
          entryTs,
          bar.timestamp,
          holdingMs,
          'TIME',
        );
    }
    const last = bars[bars.length - 1];
    return this.build(
      signal,
      entryPrice,
      last.close * (1 - this.config.slippagePct),
      entryTs,
      last.timestamp,
      last.timestamp - entryTs,
      'END_OF_DATA',
    );
  }

  private build(
    s: SignalRecord,
    entry: number,
    exit: number,
    et: number,
    xt: number,
    h: number,
    reason: TradeResult['exitReason'],
  ): TradeResult {
    const pnl = exit - entry,
      pct = pnl / entry;
    return {
      signalId: s.id,
      symbol: s.symbol,
      direction: s.direction,
      entryPrice: Math.round(entry * 1e4) / 1e4,
      exitPrice: Math.round(exit * 1e4) / 1e4,
      entryTime: et,
      exitTime: xt,
      pnl: Math.round(pnl * 1e4) / 1e4,
      pnlPct: Math.round(pct * 1e4) / 1e4,
      holdingDurationMs: h,
      exitReason: reason,
      strategy: s.strategy,
    };
  }

  run(signals: SignalRecord[]): SignalBacktestResult {
    const trades: TradeResult[] = [];
    const bySym = new Map<string, SignalRecord[]>();
    for (const s of signals) {
      if (!bySym.has(s.symbol)) bySym.set(s.symbol, []);
      bySym.get(s.symbol)!.push(s);
    }
    for (const [sym, ss] of bySym) {
      const bars = this.klineCache.get(sym);
      if (!bars?.length) continue;
      for (const s of ss) {
        const t = this.matchSignalToExit(s, bars);
        if (t) trades.push(t);
      }
    }
    return this.compute(signals, trades);
  }

  async runAsync(signals: SignalRecord[]): Promise<SignalBacktestResult> {
    return this.run(signals);
  }

  private compute(signals: SignalRecord[], trades: TradeResult[]): SignalBacktestResult {
    const wins = trades.filter((t) => t.pnl > 0),
      losses = trades.filter((t) => t.pnl <= 0);
    const winRate = trades.length ? wins.length / trades.length : 0;
    const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
    const totalPnlPct = trades.reduce((a, t) => a + t.pnlPct, 0);
    const grossProfit = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    // max drawdown
    let peak = 0,
      maxDd = 0,
      running = 0;
    for (const t of trades) {
      running += t.pnlPct;
      if (running > peak) peak = running;
      const dd = (peak - running) / (peak || 1);
      if (dd > maxDd) maxDd = dd;
    }
    // sharpe
    let sharpe = 0;
    if (trades.length >= this.config.minTradesForSharpe) {
      const rets = trades.map((t) => t.pnlPct);
      const mean = rets.reduce((a, b) => a + b) / rets.length;
      const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
      const std = Math.sqrt(variance);
      if (std !== 0) sharpe = (mean * 252 - this.config.riskFreeRate) / (std * Math.sqrt(252));
    }
    const avgMs = trades.length ? trades.reduce((a, t) => a + t.holdingDurationMs, 0) / trades.length : 0;
    const sorted = [...trades].sort((a, b) => b.pnlPct - a.pnlPct);
    const best = sorted[0] ? { pnlPct: sorted[0].pnlPct, symbol: sorted[0].symbol } : { pnlPct: 0, symbol: '' };
    const worst = sorted[sorted.length - 1]
      ? { pnlPct: sorted[sorted.length - 1].pnlPct, symbol: sorted[sorted.length - 1].symbol }
      : { pnlPct: 0, symbol: '' };
    const sb: Record<string, { count: number; winRate: number; totalPnlPct: number }> = {};
    for (const t of trades) {
      if (!sb[t.strategy]) sb[t.strategy] = { count: 0, winRate: 0, totalPnlPct: 0 };
      sb[t.strategy].count++;
      sb[t.strategy].totalPnlPct += t.pnlPct;
    }
    for (const k of Object.keys(sb)) {
      const st = trades.filter((t) => t.strategy === k);
      sb[k].winRate = st.length ? st.filter((t) => t.pnl > 0).length / st.length : 0;
    }
    return {
      totalSignals: signals.length,
      trades,
      winRate,
      profitFactor,
      maxDrawdown: Math.round(maxDd * 1e4) / 1e4,
      sharpeRatio: Math.round(sharpe * 1e4) / 1e4,
      totalPnl: Math.round(totalPnl * 1e4) / 1e4,
      totalPnlPct: Math.round(totalPnlPct * 1e4) / 1e4,
      avgHoldingMinutes: Math.round((avgMs / 60000) * 100) / 100,
      bestTrade: best,
      worstTrade: worst,
      strategyBreakdown: sb,
    };
  }

  dispose(): void {
    this.klineCache.clear();
  }
}

let instance: SignalBacktester | null = null;
export function getSignalBacktester(config?: Partial<SignalBacktesterConfig>): SignalBacktester {
  if (!instance) instance = new SignalBacktester(config);
  return instance;
}
export function resetSignalBacktester(): void {
  instance?.dispose();
  instance = null;
}
export default SignalBacktester;
