// ── Q17: Paper Trader ──────────────────────────────────
// Simulate trading via quote:stream-tick (consumes JVS QuoteStreamService)
// Record all fills, calculate performance, compare slippage vs real

import log from 'electron-log';
import { EventEmitter } from 'events';
import type { QuoteTick } from './quote-stream';
import type { LiveOrder, LivePosition } from './live-executor';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PaperAccount {
  capital: number;           // Available cash (RMB)
  commissionRate: number;    // 0.0003 (0.03% one-way)
  stampDutyRate: number;   // 0.001 (0.1% sell only)
  slippageBps: number;       // 5 bps (0.05% slippage per fill)
  initialCapital: number;  // Starting capital (for reporting)
}

export interface PaperFill {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  fillPrice: number;        // Actual fill price (with slippage)
  commission: number;      // Commission paid
  stampDuty?: number;     // Stamp duty (sell only)
  slippage: number;         // Slippage cost
  timestamp: number;
  strategyId: string;
}

export interface PaperTrade {
  id: string;
  strategyId: string;
  symbol: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  pnl: number;
  pnlPct: number;
  commission: number;
  stampDuty: number;
  slippage: number;
  netPnl: number;          // P&L after costs
  holdingDays: number;
  exitReason: string;     // 'stop_loss' | 'take_profit' | 'signal' | 'manual'
}

export interface PaperPerformance {
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;          // 0-1
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;     // avgWin / |avgLoss|
  expectancy: number;       // winRate × avgWin - (1-winRate) × |avgLoss|
  totalReturn: number;     // %
  annualizedReturn: number; // %
  sharpeRatio: number;
  maxDrawdown: number;    // %
  recoveryFactor: number;   // totalReturn / |maxDrawdown|
  avgHoldingDays: number;
  totalCommission: number;
  totalStampDuty: number;
  totalSlippage: number;
}

export interface PaperReport {
  success: boolean;
  account: PaperAccount;
  currentCapital: number;
  totalEquity: number;
  positions: LivePosition[];
  trades: PaperTrade[];
  performance: PaperPerformance[];
  equityCurve: Array<{ timestamp: number; equit: number }>;
  error?: string;
}

// ── Default Account ─────────────────────────────────────────────────

const DEFAULT_ACCOUNT: PaperAccount = {
  capital: 1000000,      // ¥1M
  commissionRate: 0.0003, // 0.03%
  stampDutyRate: 0.001,  // 0.1% (sell only)
  slippageBps: 5,          // 5 bps
  initialCapital: 1000000,
};

// ── Paper Trader ─────────────────────────────────────────────────

export class PaperTrader extends EventEmitter {
  private account: PaperAccount;
  private positions = new Map<string, LivePosition>();  // strategyId → position
  private pendingOrders = new Map<string, LiveOrder>(); // orderId → order
  private fills: PaperFill[] = [];
  private trades: PaperTrade[] = [];
  private equityCurve: Array<{ timestamp: number; equit: number }> = [];
  private running = false;
  private subscriptions: Array<() => void> = [];

  constructor(account?: Partial<PaperAccount>) {
    super();
    this.account = { ...DEFAULT_ACCOUNT, ...account };
    log.info('[PaperTrader] Initialized with capital: ¥' + this.account.capital);
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  start(symbols?: string[]): void {
    if (this.running) {
      log.warn('[PaperTrader] Already running');
      return;
    }

    this.running = true;
    log.info(`[PaperTrader] Started, tracking ${symbols?.length || 'all'} symbols`);
    this.emit('papertrader:started');
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];
    log.info('[PaperTrader] Stopped');
    this.emit('papertrader:stopped');
  }

  reset(): void {
    this.stop();
    this.positions.clear();
    this.pendingOrders.clear();
    this.fills = [];
    this.trades = [];
    this.equityCurve = [];
    this.account.capital = this.account.initialCapital;
    log.info('[PaperTrader] Reset (capital → ¥' + this.account.initialCapital + ')');
    this.emit('papertrader:reset');
  }

  // ── Order Management ─────────────────────────────────────────

  submitOrder(order: LiveOrder): string {
    if (!this.running) {
      log.warn('[PaperTrader] Not running, order rejected');
      return '';
    }

    // Simulate immediate fill (market order) or pending (limit order)
    if (order.type === 'MARKET') {
      this.simulateFill(order, order.price!);
    } else {
      // Limit order: add to pending, fill when price hits
      this.pendingOrders.set(order.id, order);
      log.info(`[PaperTrader] Limit order ${order.id} pending @ ${order.price}`);
      this.emit('papertrader:orderPending', order);
    }

    return order.id;
  }

  cancelOrder(orderId: string): boolean {
    const removed = this.pendingOrders.delete(orderId);
    if (removed) {
      log.info(`[PaperTrader] Order ${orderId} cancelled`);
      this.emit('papertrader:orderCancelled', { orderId });
    }
    return removed;
  }

  // ── Quote Processing (consume quote:stream-tick) ─────────

  onQuotes(quotes: QuoteTick[]): void {
    if (!this.running) return;

    for (const quote of quotes) {
      // Check pending limit orders
      this.checkLimitOrders(quote);

      // Update position unrealized P&L
      this.updatePositionPnL(quote);
    }

    // Record equity snapshot
    const equity = this.calculateTotalEquity(quotes);
    this.equityCurve.push({ timestamp: Date.now(), equit: equity });
  }

  private checkLimitOrders(quote: QuoteTick): void {
    for (const [orderId, order] of this.pendingOrders) {
      if (order.symbol !== quote.code) continue;

      let shouldFill = false;
      if (order.side === 'BUY' && quote.price <= order.price!) {
        shouldFill = true;
      } else if (order.side === 'SELL' && quote.price >= order.price!) {
        shouldFill = true;
      }

      if (shouldFill) {
        this.simulateFill(order, quote.price);
        this.pendingOrders.delete(orderId);
      }
    }
  }

  // ── Fill Simulation ───────────────────────────────────────────

  private simulateFill(order: LiveOrder, marketPrice: number): void {
    // Apply slippage
    const slippage = this.account.slippageBps / 10000; // 5bps = 0.0005
    const fillPrice =
      order.side === 'BUY'
        ? marketPrice * (1 + slippage)
        : marketPrice * (1 - slippage);

    // Calculate costs
    const commission = fillPrice * order.quantity * this.account.commissionRate;
    const stampDuty =
      order.side === 'SELL' ? fillPrice * order.quantity * this.account.stampDutyRate : 0;
    const slippageCost = Math.abs(fillPrice - marketPrice) * order.quantity;

    const fill: PaperFill = {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.filledQty || order.quantity,
      fillPrice,
      commission,
      stampDuty: stampDuty || undefined,
      slippage: slippageCost,
      timestamp: Date.now(),
      strategyId: order.strategyId,
    };

    this.fills.push(fill);

    // Update position
    this.updatePositionAfterFill(fill);

    log.info(
      `[PaperTrader] Filled: ${order.side} ${fill.quantity} ${order.symbol} @ ¥${fillPrice.toFixed(2)} (slippage: ¥${slippageCost.toFixed(2)})`
    );
    this.emit('papertrader:fill', fill);
  }

  // ── Position Management ────────────────────────────────────────

  private updatePositionAfterFill(fill: PaperFill): void {
    const existing = this.positions.get(fill.strategyId);

    if (fill.side === 'BUY') {
      if (existing) {
        // Average up/down
        const totalQty = existing.quantity + fill.quantity;
        existing.avgCost =
          (existing.avgCost * existing.quantity + fill.fillPrice * fill.quantity) / totalQty;
        existing.quantity = totalQty;
      } else {
        // New position
        this.positions.set(fill.strategyId, {
          strategyId: fill.strategyId,
          symbol: fill.symbol,
          side: 'LONG',
          quantity: fill.quantity,
          avgCost: fill.fillPrice,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          entryTime: fill.timestamp,
        });
      }
    } else if (fill.side === 'SELL') {
      if (existing) {
        // Close (partial or full)
        const remaining = existing.quantity - fill.quantity;

        if (remaining <= 0) {
          // Full close → record trade
          this.recordTrade(fill.strategyId, fill.fillPrice, fill.quantity, 'signal');
          this.positions.delete(fill.strategyId);
        } else {
          existing.quantity = remaining;
        }
      }
    }
  }

  private updatePositionPnL(quote: QuoteTick): void {
    for (const [strategyId, pos] of this.positions) {
      if (pos.symbol !== quote.code) continue;

      const pnl = (quote.price - pos.avgCost) * pos.quantity;
      pos.unrealizedPnL = Math.round(pnl * 100) / 100;
      pos.unrealizedPnLPct = Math.round((pnl / (pos.avgCost * pos.quantity)) * 10000) / 100;
    }
  }

  // ── Trade Recording ──────────────────────────────────────────

  private recordTrade(strategyId: string, exitPrice: number, quantity: number, reason: string): void {
    const position = this.positions.get(strategyId)!;
    const entryTime = position.entryTime;
    const exitTime = Date.now();

    const pnl = (exitPrice - position.avgCost) * quantity;
    const pnlPct = (exitPrice - position.avgCost) / position.avgCost;

    // Calculate costs from fills
    const relatedFills = this.fills.filter(
      (f) => f.strategyId === strategyId && f.side === 'BUY'
    );
    const commission = relatedFills.reduce((sum, f) => sum + f.commission, 0);
    const stampDuty = relatedFills
      .filter((f) => f.side === 'SELL')
      .reduce((sum, f) => sum + (f.stampDuty || 0), 0);
    const slippage = relatedFills.reduce((sum, f) => sum + f.slippage, 0);

    const trade: PaperTrade = {
      id: `trade_${Date.now()}`,
      strategyId,
      symbol: position.symbol,
      entryTime,
      exitTime,
      entryPrice: position.avgCost,
      exitPrice,
      quantity,
      side: position.side,
      pnl,
      pnlPct,
      commission,
      stampDuty,
      slippage,
      netPnl: pnl - commission - stampDuty - slippage,
      holdingDays: Math.floor((exitTime - entryTime) / 8640000),
      exitReason: reason,
    };

    this.trades.push(trade);

    // Update capital
    this.account.capital += trade.netPnl;

    log.info(
      `[PaperTrader] Trade closed: ${strategyId} P&L: ¥${trade.netPnl.toFixed(2)} (${(
        trade.pnlPct * 100
      ).toFixed(2)}%)`
    );
    this.emit('papertrader:trade', trade);
  }

  // ── Performance Calculation ───────────────────────────────────

  calculatePerformance(strategyId?: string): PaperPerformance[] {
    const trades = strategyId
      ? this.trades.filter((t) => t.strategyId === strategyId)
      : this.trades;

    if (trades.length === 0) {
      return [];
    }

    const strategyPerf = new Map<string, PaperTrade[]>();

    for (const trade of trades) {
      const list = strategyPerf.get(trade.strategyId) || [];
      list.push(trade);
      strategyPerf.set(trade.strategyId, list);
    }

    const results: PaperPerformance[] = [];

    for (const [sid, tradeList] of strategyPerf) {
      const wins = tradeList.filter((t) => t.netPnl > 0);
      const losses = tradeList.filter((t) => t.netPnl <= 0);

      const totalReturn = tradeList.reduce((sum, t) => sum + t.netPnl, 0);
      const initial = this.account.initialCapital;
      const totalReturnPct = (totalReturn / initial) * 100;

      // Max drawdown
      let peak = initial;
      let maxDD = 0;
      let equity = initial;
      for (const t of tradeList.sort((a, b) => a.exitTime - b.exitTime)) {
        equity += t.netPnl;
        if (equity > peak) peak = equity;
        const dd = ((peak - equity) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      }

      const perf: PaperPerformance = {
        strategyId: sid,
        totalTrades: tradeList.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate: wins.length / tradeList.length,
        avgWin: wins.length > 0 ? wins.reduce((sum, t) => sum + t.netPnl, 0) / wins.length : 0,
        avgLoss: losses.length > 0 ? losses.reduce((sum, t) => sum + t.netPnl, 0) / losses.length : 0,
        largestWin: Math.max(...tradeList.map((t) => t.netPnl)),
        largestLoss: Math.min(...tradeList.map((t) => t.netPnl)),
        profitFactor:
          wins.length > 0 && losses.length > 0
            ? Math.abs(wins.reduce((sum, t) => sum + t.netPnl, 0) / losses.reduce((sum, t) => sum + t.netPnl, 0))
            : 0,
        expectancy:
          wins.length > 0 && losses.length > 0
            ? wins.reduce((sum, t) => sum + t.netPnl, 0) / wins.length -
              Math.abs(losses.reduce((sum, t) => sum + t.netPnl, 0) / losses.length)
            : 0,
        totalReturn: totalReturnPct,
        annualizedReturn: totalReturnPct * (252 / tradeList.length), // Simplied
        sharpeRatio: 0, // TODO: calculate from equity curve
        maxDrawdown: maxDD,
        recoveryFactor: maxDD > 0 ? totalReturnPct / maxDD : 0,
        avgHoldingDays: tradeList.reduce((sum, t) => sum + t.holdingDays, 0) / tradeList.length,
        totalCommission: tradeList.reduce((sum, t) => sum + t.commission, 0),
        totalStampDuty: tradeList.reduce((sum, t) => sum + t.stampDuty, 0),
        totalSlippage: tradeList.reduce((sum, t) => sum + t.slippage, 0),
      };

      results.push(perf);
    }

    return results;
  }

  // ── Reporting ──────────────────────────────────────────────────

  getReport(strategyId?: string): PaperReport {
    const currentCapital = this.account.capital;
    const positions = Array.from(this.positions.values());
    const totalPositionValue = positions.reduce(
      (sum, p) => sum + p.quantity * p.avgCost + p.unrealizedPnL,
      0
    );
    const totalEquity = currentCapital + totalPositionValue;

    const performance = this.calculatePerformance(strategyId);

    return {
      success: true,
      account: this.account,
      currentCapital,
      totalEquity,
      positions,
      trades: this.trades,
      performance,
      equityCurve: this.equityCurve,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private calculateTotalEquity(quotes: QuoteTick[]): number {
    let equity = this.account.capital;

    for (const pos of this.positions.values()) {
      const quote = quotes.find((q) => q.code === pos.symbol);
      const currentPrice = quote?.price || pos.avgCost;
      equity += (currentPrice - pos.avgCost) * pos.quantity;
    }

    return equity;
  }

  getAccount(): PaperAccount {
    return { ...this.account };
  }

  getPositions(): LivePosition[] {
    return Array.from(this.positions.values());
  }

  getTrades(strategyId?: string): PaperTrade[] {
    if (strategyId) {
      return this.trades.filter((t) => t.strategyId === strategyId);
    }
    return this.trades;
  }

  getFills(): PaperFill[] {
    return this.fills;
  }

  updateAccount(updates: Partial<PaperAccount>): void {
    this.account = { ...this.account, ...updates };
    log.info('[PaperTrader] Account updated:', updates);
  }
}

// ── Singleton ───────────────────────────────────────────────────────

let paperTraderInstance: PaperTrader | null = null;

export function initPaperTrader(account?: Partial<PaperAccount>): PaperTrader {
  if (!paperTraderInstance) {
    paperTraderInstance = new PaperTrader(account);
  }
  return paperTraderInstance;
}

export function getPaperTrader(strategyId?: string): PaperTrader | null {
  void strategyId; // Reserved for multi-account future
  return paperTraderInstance;
}

export default PaperTrader;
