// ── Q17: Paper Trader ──────────────────────────────────
// Simulate trading via quote:stream-tick (consumes JVS QuoteStreamService)
// Record all fills, calculate performance, compare slippage vs real

import log from 'electron-log';
import type { QuoteTick } from './quote-stream';
import type { LiveOrder, LivePosition } from './live-executor';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PaperAccount {
  capital: number;           // Available cash (RMB)
  commissionRate: number;   // 0.0003 (0.03% one-way)
  stampDutyRate: number;    // 0.001 (0.1% sell only)
  slippageBps: number;      // 5 bps (0.05% slippage per fill)
  initialCapital: number;   // Starting capital (for reporting)
}

export interface PaperFill {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  fillPrice: number;
  commission: number;
  stampDuty?: number;
  slippage: number;
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
  netPnl: number;
  holdingDays: number;
  exitReason: string;
}

export interface PaperPerformance {
  strategyId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  expectancy: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
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
  equityCurve: Array<{ timestamp: number; equity: number }>;
  error?: string;
}

// ── Default Account ─────────────────────────────────────────────────

const DEFAULT_ACCOUNT: PaperAccount = {
  capital: 1000000,
  commissionRate: 0.0003,
  stampDutyRate: 0.001,
  slippageBps: 5,
  initialCapital: 1000000,
};

// ── Event Emitter Interface (for test injection) ─────────────────────

interface EmitterLike {
  on(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
  once(event: string, listener: (...args: unknown[]) => void): this;
  removeAllListeners(event?: string): this;
}

// ── Paper Trader ─────────────────────────────────────────────────

export class PaperTrader {
  // Composition: internal EventEmitter (injected in tests)
  private _emitter: EmitterLike;

  private account: PaperAccount;
  private positions = new Map<string, LivePosition>();
  private pendingOrders = new Map<string, LiveOrder>();
  private fills: PaperFill[] = [];
  private trades: PaperTrade[] = [];
  private equityCurve: Array<{ timestamp: number; equity: number }> = [];
  private running = false;
  private subscriptions: Array<() => void> = [];

  constructor(account?: Partial<PaperAccount>, emitter?: EmitterLike) {
    // Allow test injection; fall back to real Node EventEmitter
    if (emitter) {
      this._emitter = emitter;
    } else {
      try {
        const { EventEmitter } = require('events');
        this._emitter = new EventEmitter();
      } catch {
        this._emitter = createNoopEmitter();
      }
    }
    this.account = { ...DEFAULT_ACCOUNT, ...account };
    log.info('[PaperTrader] Initialized with capital: ¥' + this.account.capital);
  }

  // ── Event Delegation ──────────────────────────────────────────────

  on(event: string, listener: (...args: unknown[]) => void): this {
    this._emitter.on(event, listener);
    return this;
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    this._emitter.once(event, listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this._emitter.off(event, listener);
    return this;
  }

  protected emit(event: string, ...args: unknown[]): boolean {
    return this._emitter.emit(event, ...args);
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
    if (order.type === 'MARKET') {
      this.simulateFill(order, order.price!);
    } else {
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

  // ── Quote Processing ────────────────────────────────────────

  onQuotes(quotes: QuoteTick[]): void {
    if (!this.running) return;
    for (const quote of quotes) {
      this.checkLimitOrders(quote);
      this.updatePositionPnL(quote);
    }
    const equity = this.calculateTotalEquity(quotes);
    this.equityCurve.push({ timestamp: Date.now(), equity });
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

  // ── Fill Simulation ─────────────────────────────────────────

  private simulateFill(order: LiveOrder, marketPrice: number): void {
    const slippage = this.account.slippageBps / 10000;
    const fillPrice =
      order.side === 'BUY'
        ? marketPrice * (1 + slippage)
        : marketPrice * (1 - slippage);

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
    this.updatePositionAfterFill(fill);

    log.info(
      `[PaperTrader] Filled: ${order.side} ${fill.quantity} ${order.symbol} @ ¥${fillPrice.toFixed(2)} (slippage: ¥${slippageCost.toFixed(2)})`
    );
    this.emit('papertrader:fill', fill);
  }

  // ── Position Management ─────────────────────────────────────

  private updatePositionAfterFill(fill: PaperFill): void {
    const existing = this.positions.get(fill.strategyId);

    if (fill.side === 'BUY') {
      if (existing) {
        const totalQty = existing.quantity + fill.quantity;
        existing.avgCost =
          (existing.avgCost * existing.quantity + fill.fillPrice * fill.quantity) / totalQty;
        existing.quantity = totalQty;
      } else {
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
        const remaining = existing.quantity - fill.quantity;
        if (remaining <= 0) {
          this.recordTrade(fill.strategyId, fill.fillPrice, fill.quantity, 'signal');
          this.positions.delete(fill.strategyId);
        } else {
          existing.quantity = remaining;
        }
      }
    }
  }

  private updatePositionPnL(quote: QuoteTick): void {
    for (const [, pos] of this.positions) {
      if (pos.symbol !== quote.code) continue;
      const pnl = (quote.price - pos.avgCost) * pos.quantity;
      pos.unrealizedPnL = Math.round(pnl * 100) / 100;
      pos.unrealizedPnLPct = Math.round((pnl / (pos.avgCost * pos.quantity)) * 10000) / 100;
    }
  }

  // ── Trade Recording ─────────────────────────────────────────

  private recordTrade(strategyId: string, exitPrice: number, quantity: number, reason: string): void {
    const position = this.positions.get(strategyId)!;
    const entryTime = position.entryTime;
    const exitTime = Date.now();

    const pnl = (exitPrice - position.avgCost) * quantity;
    const pnlPct = (exitPrice - position.avgCost) / position.avgCost;

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
    this.account.capital += trade.netPnl;

    log.info(
      `[PaperTrader] Trade closed: ${strategyId} P&L: ¥${trade.netPnl.toFixed(2)} (${(trade.pnlPct * 100).toFixed(2)}%)`
    );
    this.emit('papertrader:trade', trade);
  }

  // ── Performance Calculation ─────────────────────────────────

  calculatePerformance(strategyId?: string): PaperPerformance[] {
    const trades = strategyId
      ? this.trades.filter((t) => t.strategyId === strategyId)
      : this.trades;

    if (trades.length === 0) return [];

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
        annualizedReturn: totalReturnPct * (252 / tradeList.length),
        sharpeRatio: 0,
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

  // ── Reporting ─────────────────────────────────────────────────

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

  // ── Helpers ─────────────────────────────────────────────────

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
    return strategyId ? this.trades.filter((t) => t.strategyId === strategyId) : this.trades;
  }

  getFills(): PaperFill[] {
    return this.fills;
  }

  updateAccount(updates: Partial<PaperAccount>): void {
    this.account = { ...this.account, ...updates };
    log.info('[PaperTrader] Account updated:', updates);
  }
}

// ── Noop Emitter (fallback when 'events' unavailable) ────────────────

function createNoopEmitter(): EmitterLike {
  return {
    on() { return this; },
    off() { return this; },
    emit() { return false; },
    once() { return this; },
    removeAllListeners() { return this; },
  };
}

// ── Singleton ───────────────────────────────────────────────────────

let paperTraderInstance: PaperTrader | null = null;

export function initPaperTrader(account?: Partial<PaperAccount>): PaperTrader {
  if (!paperTraderInstance) {
    paperTraderInstance = new PaperTrader(account);
  }
  return paperTraderInstance;
}

export function getPaperTrader(): PaperTrader | null {
  return paperTraderInstance;
}

export default PaperTrader;
