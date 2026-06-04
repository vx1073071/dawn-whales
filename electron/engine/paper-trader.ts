// ── Q17: Paper Trader (模拟实盘交易) ──────────────────────────────────────────
// Wraps LiveExecutor signals into simulated trades with:
//   - Virtual portfolio (cash, positions, P&L)
//   - Slippage / commission simulation
//   - Drawdown tracking
//   - Trade log with fills
//   - Performance report generation

import log from 'electron-log';
import { LiveExecutor, Signal, Order, LiveExecutorStatus } from './live-executor';

export { Signal, Order }; // re-export for convenience

// ── Types ───────────────────────────────────────────────────────────────────

export interface PaperAccount {
  cash: number;
  initialCash: number;
  totalValue: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  drawdown: number;
  maxDrawdown: number;
}

export interface PaperPosition {
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface PaperTrade {
  id: string;
  timestamp: number;
  code: string;
  name: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  slippage: number;
  commission: number;
  totalCost: number;
  pnl?: number;        // filled trade P&L
  signal?: Signal;
}

export interface PaperReport {
  account: PaperAccount;
  positions: PaperPosition[];
  recentTrades: PaperTrade[];
  tradeCount: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winLossRatio: number;
  period: { start: number; end: number };
  timestamp: number;
}

export interface PaperTradeConfig {
  initialCash?: number;      // default 1,000,000 CNY
  commission?: number;        // default 0.0003 (万三)
  slippage?: number;          // default 0.001 (千一)
  maxDrawdownPct?: number;   // default 0.15 (15% stop)
}

// ── Paper Trader ─────────────────────────────────────────────────────────────

export class PaperTrader {
  private liveExec: LiveExecutor | null = null;
  private config: Required<PaperTradeConfig>;
  private account: PaperAccount;
  private positions: Map<string, PaperPosition> = new Map();
  private tradeLog: PaperTrade[] = [];
  private tradeCounter = 0;
  private startedAt: number | null = null;
  private stopped = false;

  constructor(config: PaperTradeConfig = {}) {
    this.config = {
      initialCash: config.initialCash ?? 1_000_000,
      commission:  config.commission  ?? 0.0003,
      slippage:    config.slippage    ?? 0.001,
      maxDrawdownPct: config.maxDrawdownPct ?? 0.15,
    };
    this.account = this._freshAccount();
    log.info(`[PaperTrader] Initialized with ${this.config.initialCash} CNY paper money`);
  }

  // ── Account helpers ────────────────────────────────────────────────────

  private _freshAccount(): PaperAccount {
    return {
      cash: this.config.initialCash,
      initialCash: this.config.initialCash,
      totalValue: this.config.initialCash,
      totalPnL: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      drawdown: 0,
      maxDrawdown: 0,
    };
  }

  private _updatePrices(prices: Map<string, number>) {
    let totalUnrealized = 0;
    for (const [code, pos] of this.positions) {
      const price = prices.get(code) ?? pos.currentPrice;
      pos.currentPrice = price;
      pos.unrealizedPnL = (price - pos.avgCost) * pos.quantity * (pos.side === 'LONG' ? 1 : -1);
      totalUnrealized += pos.unrealizedPnL;
    }
    this.account.unrealizedPnL = totalUnrealized;
    this.account.totalValue = this.account.cash + totalUnrealized + this.account.realizedPnL;
    this.account.totalPnL = this.account.totalValue - this.account.initialCash;
    // Drawdown
    const peak = Math.max(this.account.initialCash, this.account.totalValue);
    this.account.drawdown = peak > 0 ? Math.max(0, (peak - this.account.totalValue) / peak) : 0;
    this.account.maxDrawdown = Math.max(this.account.maxDrawdown, this.account.drawdown);
  }

  // ── Price simulation ────────────────────────────────────────────────────

  private simulatePrice(code: string, signal: Signal): number {
    // Use signal.price if available, otherwise generate a realistic mock price
    const basePrice = signal.price ?? 100;
    const slippageBps = this.config.slippage * 100; // e.g. 10 bps
    const noise = (Math.random() - 0.5) * 2 * slippageBps / 10000 * basePrice;
    return Math.max(0.01, basePrice + noise);
  }

  // ── Execute a paper signal ─────────────────────────────────────────────

  executeSignal(signal: Signal, name?: string): PaperTrade | null {
    if (this.stopped) {
      log.warn('[PaperTrader] PaperTrader is stopped, ignoring signal');
      return null;
    }

    const price = this.simulatePrice(signal.code, signal);
    const slippage = Math.abs(price - (signal.price ?? price));
    const commission = price * signal.quantity * this.config.commission;
    const side = signal.side === 'BUY' ? 'BUY' : 'SELL';
    const totalCost = side === 'BUY'
      ? price * signal.quantity + commission
      : price * signal.quantity - commission;

    this.tradeCounter++;
    const trade: PaperTrade = {
      id: `PT-${Date.now()}-${this.tradeCounter}`,
      timestamp: Date.now(),
      code: signal.code,
      name: name ?? signal.code,
      side,
      quantity: signal.quantity,
      price,
      slippage,
      commission,
      totalCost,
      signal,
    };

    // ── BUY ──────────────────────────────────────────────────────────────
    if (side === 'BUY') {
      if (totalCost > this.account.cash) {
        log.warn(`[PaperTrader] Insufficient cash: need ${totalCost.toFixed(2)}, have ${this.account.cash.toFixed(2)}`);
        return null;
      }
      this.account.cash -= totalCost;
      const existing = this.positions.get(signal.code);
      if (existing) {
        const totalQty = existing.quantity + signal.quantity;
        existing.avgCost = (existing.avgCost * existing.quantity + price * signal.quantity) / totalQty;
        existing.quantity = totalQty;
        existing.side = 'LONG';
      } else {
        this.positions.set(signal.code, {
          code: signal.code,
          name: name ?? signal.code,
          quantity: signal.quantity,
          avgCost: price,
          currentPrice: price,
          unrealizedPnL: 0,
          realizedPnL: 0,
          side: 'LONG',
        });
      }
      log.info(`[PaperTrader] BUY ${signal.quantity} ${signal.code} @ ${price.toFixed(3)} (cost ${totalCost.toFixed(2)})`);

    // ── SELL ─────────────────────────────────────────────────────────────
    } else {
      const pos = this.positions.get(signal.code);
      if (!pos || pos.quantity < signal.quantity) {
        log.warn(`[PaperTrader] Insufficient position to sell: have ${pos?.quantity ?? 0}, want ${signal.quantity}`);
        return null;
      }
      this.account.cash += totalCost;
      const pnl = (price - pos.avgCost) * signal.quantity;
      pos.realizedPnL += pnl;
      this.account.realizedPnL += pnl;
      trade.pnl = pnl;
      pos.quantity -= signal.quantity;
      if (pos.quantity === 0) {
        this.positions.delete(signal.code);
      }
      log.info(`[PaperTrader] SELL ${signal.quantity} ${signal.code} @ ${price.toFixed(3)} (realized PnL ${pnl.toFixed(2)})`);
    }

    this.tradeLog.push(trade);

    // ── Drawdown stop check ─────────────────────────────────────────────
    if (this.account.drawdown >= this.config.maxDrawdownPct) {
      log.warn(`[PaperTrader] MAX DRAWDOWN STOP TRIGGERED: ${(this.account.drawdown * 100).toFixed(2)}%`);
      this.stopAll();
    }

    return trade;
  }

  // ── Stop all positions ─────────────────────────────────────────────────

  stopAll(): void {
    this.stopped = true;
    if (this.liveExec) {
      this.liveExec.stop();
    }
    log.info('[PaperTrader] Paper trading stopped. Closing all positions...');
    // Close all open positions at current prices
    for (const [code, pos] of this.positions) {
      const closeSignal: Signal = {
        code,
        side: 'SELL',
        quantity: pos.quantity,
        price: pos.currentPrice,
        timestamp: Date.now(),
        orderType: 'MARKET',
        strategyId: 'paper-stop',
      };
      this.executeSignal(closeSignal, pos.name);
    }
    this.positions.clear();
  }

  // ── Connect to LiveExecutor ────────────────────────────────────────────

  attachLiveExecutor(exec: LiveExecutor): void {
    this.liveExec = exec;
    this.startedAt = Date.now();
    log.info('[PaperTrader] Attached to LiveExecutor');
  }

  // ── Performance Report ──────────────────────────────────────────────────

  getReport(prices?: Map<string, number>): PaperReport {
    if (prices) this._updatePrices(prices);

    const closedTrades = this.tradeLog.filter(t => t.pnl != null);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = closedTrades.filter(t => (t.pnl ?? 0) < 0);
    const avgLossAmt = avgLoss.length > 0
      ? avgLoss.reduce((s, t) => s + (t.pnl ?? 0), 0) / avgLoss.length
      : 0;
    const winLossRatio = Math.abs(avgLossAmt) > 0 ? avgWin / Math.abs(avgLossAmt) : 0;

    // Simple Sharpe (using realized PnL series)
    const pnlSeries = closedTrades.map(t => t.pnl ?? 0);
    const mean = pnlSeries.length > 0 ? pnlSeries.reduce((a, b) => a + b, 0) / pnlSeries.length : 0;
    const variance = pnlSeries.length > 1
      ? pnlSeries.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnlSeries.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? (mean * 252) / (stdDev * Math.sqrt(252)) : 0;

    return {
      account: { ...this.account },
      positions: [...this.positions.values()],
      recentTrades: this.tradeLog.slice(-50),
      tradeCount: this.tradeLog.length,
      winRate: Math.round(winRate * 10000) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      maxDrawdown: Math.round(this.account.maxDrawdown * 10000) / 100,
      winLossRatio: Math.round(winLossRatio * 100) / 100,
      period: {
        start: this.startedAt ?? Date.now(),
        end: Date.now(),
      },
      timestamp: Date.now(),
    };
  }

  getStatus(): string {
    if (this.stopped) return 'STOPPED';
    return this.liveExec ? 'RUNNING' : 'IDLE';
  }

  reset(): void {
    this.stopped = false;
    this.liveExec = null;
    this.positions.clear();
    this.tradeLog = [];
    this.tradeCounter = 0;
    this.startedAt = null;
    this.account = this._freshAccount();
    log.info('[PaperTrader] Reset — fresh paper account');
  }
}

// ── Singleton manager ─────────────────────────────────────────────────────────

const traders: Map<string, PaperTrader> = new Map();

export function getPaperTrader(id = 'default'): PaperTrader {
  if (!traders.has(id)) traders.set(id, new PaperTrader());
  return traders.get(id)!;
}
