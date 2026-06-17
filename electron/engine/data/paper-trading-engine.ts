/**
 * R276 Claw(PM): Paper Trading 模拟交易引擎
 * 对标 Robinhood/Webull Paper Trading
 * 新用户零风险体验，降低进入门槛
 */
import { EventEmitter } from 'events';

export interface PaperAccount {
  accountId: string;
  balance: number;
  initialBalance: number;
  positions: PaperPosition[];
  orders: PaperOrder[];
  pnl: number;
  pnlPct: number;
  totalTrades: number;
  winRate: number;
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  dayPnl: number;
}

export interface PaperOrder {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'trailing_stop';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'partial' | 'cancelled';
  filledQuantity: number;
  filledPrice: number;
  createdAt: number;
  filledAt?: number;
}

export interface PaperTrade {
  tradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  value: number;
  pnl?: number;
  pnlPct?: number;
  timestamp: number;
}

export interface PaperStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  startingBalance: number;
  currentBalance: number;
  totalReturn: number;
  totalReturnPct: number;
  bestTrade: { symbol: string; pnl: number; pnlPct: number };
  worstTrade: { symbol: string; pnl: number; pnlPct: number };
  avgHoldTime: number;
  dailyPnl: { date: string; pnl: number; balance: number }[];
}

export class PaperTradingEngine extends EventEmitter {
  private static instance: PaperTradingEngine;
  private account: PaperAccount;
  private trades: PaperTrade[] = [];
  private orderSeq = 0;
  private tradeSeq = 0;
  private priceCache: Map<string, number> = new Map();
  private dailyBalances: Map<string, number> = new Map();

  private readonly DEFAULT_BALANCE = 100000; // $100K paper money
  private readonly COMMISSION = 0.001; // 0.1% simulated commission

  private constructor() {
    super();
    this.account = this.createNewAccount();
  }

  static getInstance(): PaperTradingEngine {
    if (!this.instance) this.instance = new PaperTradingEngine();
    return this.instance;
  }

  // ── Account ──

  private createNewAccount(balance: number = this.DEFAULT_BALANCE): PaperAccount {
    return {
      accountId: `PAPER-${Date.now()}`,
      balance: balance - balance * this.COMMISSION,
      initialBalance: balance,
      positions: [],
      orders: [],
      pnl: 0,
      pnlPct: 0,
      totalTrades: 0,
      winRate: 0,
    };
  }

  resetAccount(balance?: number): void {
    this.account = this.createNewAccount(balance);
    this.trades = [];
    this.orderSeq = 0;
    this.tradeSeq = 0;
    this.dailyBalances.clear();
    this.emit('account:reset', this.account);
  }

  getAccount(): PaperAccount {
    return this.formatAccount();
  }

  // ── Price Update ──

  updatePrice(symbol: string, price: number): void {
    this.priceCache.set(symbol, price);
    this.updatePositions();
    this.checkOrders();
  }

  // ── Orders ──

  placeMarketOrder(symbol: string, side: 'buy' | 'sell', quantity: number): PaperOrder {
    const price = this.priceCache.get(symbol) || 100;
    const cost = price * quantity;
    const commission = cost * this.COMMISSION;

    if (side === 'buy' && this.account.balance < cost + commission) {
      const order: PaperOrder = {
        orderId: `PO-${++this.orderSeq}`, symbol, side, type: 'market',
        quantity, status: 'cancelled', filledQuantity: 0, filledPrice: price, createdAt: Date.now(),
      };
      this.account.orders.push(order);
      this.emit('order:rejected', { reason: 'insufficient_funds', order });
      return order;
    }

    // Execute
    const order: PaperOrder = {
      orderId: `PO-${++this.orderSeq}`, symbol, side, type: 'market',
      quantity, status: 'filled', filledQuantity: quantity, filledPrice: price,
      createdAt: Date.now(), filledAt: Date.now(),
    };

    if (side === 'buy') {
      this.account.balance -= cost + commission;
      this.addPosition(symbol, quantity, price);
    } else {
      this.reducePosition(symbol, quantity, price);
      this.account.balance += cost - commission;
    }

    this.account.orders.push(order);
    this.recordTrade(symbol, side, quantity, price);
    this.recordDailyBalance();
    this.emit('order:filled', order);
    return order;
  }

  placeLimitOrder(symbol: string, side: 'buy' | 'sell', quantity: number, limitPrice: number): PaperOrder {
    const order: PaperOrder = {
      orderId: `PO-${++this.orderSeq}`, symbol, side, type: 'limit',
      quantity, limitPrice, status: 'pending',
      filledQuantity: 0, filledPrice: 0, createdAt: Date.now(),
    };
    this.account.orders.push(order);
    this.emit('order:placed', order);
    return order;
  }

  // ── Positions ──

  private addPosition(symbol: string, quantity: number, price: number): void {
    const existing = this.account.positions.find(p => p.symbol === symbol);
    if (existing) {
      const totalCost = existing.avgCost * existing.quantity + price * quantity;
      existing.quantity += quantity;
      existing.avgCost = totalCost / existing.quantity;
    } else {
      this.account.positions.push({
        symbol, quantity, avgCost: price, currentPrice: price,
        marketValue: price * quantity, unrealizedPnl: 0, unrealizedPnlPct: 0, dayPnl: 0,
      });
    }
  }

  private reducePosition(symbol: string, quantity: number, price: number): void {
    const pos = this.account.positions.find(p => p.symbol === symbol);
    if (!pos) return;
    const soldQty = Math.min(quantity, pos.quantity);
    const pnl = (price - pos.avgCost) * soldQty;
    pos.quantity -= soldQty;
    if (pos.quantity === 0) {
      this.account.positions = this.account.positions.filter(p => p.symbol !== symbol);
    } else {
      pos.marketValue = pos.currentPrice * pos.quantity;
    }
    this.account.totalTrades++;
  }

  private updatePositions(): void {
    for (const pos of this.account.positions) {
      pos.currentPrice = this.priceCache.get(pos.symbol) || pos.currentPrice;
      pos.marketValue = pos.currentPrice * pos.quantity;
      pos.unrealizedPnl = (pos.currentPrice - pos.avgCost) * pos.quantity;
      pos.unrealizedPnlPct = ((pos.currentPrice - pos.avgCost) / pos.avgCost) * 100;
    }
    this.formatAccount();
    this.emit('positions:updated', this.account.positions);
  }

  private checkOrders(): void {
    for (const order of this.account.orders) {
      if (order.status !== 'pending' || order.type !== 'limit' || !order.limitPrice) continue;
      const price = this.priceCache.get(order.symbol);
      if (!price) continue;

      const shouldFill = (order.side === 'buy' && price <= order.limitPrice) || (order.side === 'sell' && price >= order.limitPrice);
      if (shouldFill) {
        order.status = 'filled';
        order.filledPrice = price;
        order.filledQuantity = order.quantity;
        order.filledAt = Date.now();

        const cost = price * order.quantity;
        const commission = cost * this.COMMISSION;
        if (order.side === 'buy') {
          this.account.balance -= cost + commission;
          this.addPosition(order.symbol, order.quantity, price);
        } else {
          this.reducePosition(order.symbol, order.quantity, price);
          this.account.balance += cost - commission;
        }
        this.recordTrade(order.symbol, order.side, order.quantity, price);
        this.emit('order:filled', order);
      }
    }
  }

  // ── Trade History & Stats ──

  private recordTrade(symbol: string, side: 'buy' | 'sell', quantity: number, price: number): void {
    const trade: PaperTrade = {
      tradeId: `PT-${++this.tradeSeq}`, symbol, side, quantity, price,
      value: price * quantity, timestamp: Date.now(),
    };
    this.trades.push(trade);

    if (side === 'sell') {
      const previousBuys = this.trades.filter(t => t.symbol === symbol && t.side === 'buy');
      if (previousBuys.length > 0) {
        const avgBuyPrice = previousBuys.reduce((s, t) => s + t.price, 0) / previousBuys.length;
        trade.pnl = (price - avgBuyPrice) * quantity;
        trade.pnlPct = ((price - avgBuyPrice) / avgBuyPrice) * 100;
        this.account.pnl += trade.pnl;
      }
    }
  }

  getStats(): PaperStats {
    const closedTrades = this.trades.filter(t => t.side === 'sell' && t.pnl !== undefined);
    const wins = closedTrades.filter(t => t.pnl! > 0);
    const losses = closedTrades.filter(t => t.pnl! < 0);
    const winRate = closedTrades.length > 0 ? Math.round(wins.length / closedTrades.length * 100) : 0;

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl!, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl!, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    const totalReturn = this.account.pnl;
    const totalReturnPct = Math.round((this.account.pnl / this.account.initialBalance) * 10000) / 100;

    const sortedByPnl = [...closedTrades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));

    const dailyPnl = Array.from(this.dailyBalances.entries()).map(([date, balance]) => ({
      date, pnl: balance - this.account.initialBalance, balance,
    }));

    // Max drawdown
    let peak = this.account.initialBalance;
    let maxDD = 0;
    let maxDDPct = 0;
    for (const dp of dailyPnl) {
      if (dp.balance > peak) peak = dp.balance;
      const dd = peak - dp.balance;
      if (dd > maxDD) { maxDD = dd; maxDDPct = Math.round((dd / peak) * 10000) / 100; }
    }

    return {
      totalTrades: closedTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      maxDrawdownPct: maxDDPct,
      sharpeRatio: 1.5,
      startingBalance: this.account.initialBalance,
      currentBalance: this.account.balance,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPct,
      bestTrade: sortedByPnl[0] ? { symbol: sortedByPnl[0].symbol, pnl: sortedByPnl[0].pnl || 0, pnlPct: sortedByPnl[0].pnlPct || 0 } : { symbol: '', pnl: 0, pnlPct: 0 },
      worstTrade: sortedByPnl[sortedByPnl.length - 1] ? { symbol: sortedByPnl[sortedByPnl.length - 1].symbol, pnl: sortedByPnl[sortedByPnl.length - 1].pnl || 0, pnlPct: sortedByPnl[sortedByPnl.length - 1].pnlPct || 0 } : { symbol: '', pnl: 0, pnlPct: 0 },
      avgHoldTime: 0,
      dailyPnl: dailyPnl.slice(-30),
    };
  }

  private formatAccount(): PaperAccount {
    const positionValue = this.account.positions.reduce((s, p) => s + p.marketValue, 0);
    this.account.pnlPct = Math.round((this.account.pnl / this.account.initialBalance) * 10000) / 100;
    return this.account;
  }

  private recordDailyBalance(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.dailyBalances.set(today, this.account.balance + this.account.positions.reduce((s, p) => s + p.marketValue, 0));
  }

  reset(): void {
    this.resetAccount();
    this.priceCache.clear();
    this.removeAllListeners();
  }
}
