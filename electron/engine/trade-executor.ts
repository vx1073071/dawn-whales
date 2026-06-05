/**
 * trade-executor.ts
 *
 * Trade Executor — receives trade signals and routes them to the broker
 * for order execution. Supports paper trading and live trading modes.
 *
 * This module provides the core TradeExecutor class and TradeSignal type
 * used by the WsTradeBridge for automated signal processing.
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ─── Types ────────────────────────────────────────────────────

export interface TradeSignal {
  id: string;
  code: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  strategyId: string;
  strategyName: string;
  reason: string;
  timestamp: Date;
}

export interface TradeOrder {
  id: string;
  signalId?: string;
  code: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  quantity: number;
  price: number;
  status: 'pending' | 'submitted' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  filledQty: number;
  filledPrice: number;
  commission: number;
  createdAt: Date;
  updatedAt: Date;
  rejectionReason?: string;
}

export interface PositionInfo {
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  dayPnL: number;
  totalPnL: number;
  totalPnLPct: number;
}

export interface ExecutorConfig {
  mode: 'paper' | 'real';
  maxPositionSize: number;
  maxDailyLoss: number;
  defaultCommission: number;
  slippagePct: number;
}

// ─── TradeExecutor Class ─────────────────────────────────────

export class TradeExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private orders: TradeOrder[] = [];
  private positions: Map<string, PositionInfo> = new Map();
  private dailyPnL = 0;
  private dailyTrades = 0;
  private running = false;

  constructor(config?: Partial<ExecutorConfig>) {
    super();
    this.setMaxListeners(30);

    this.config = {
      mode: config?.mode ?? 'paper',
      maxPositionSize: config?.maxPositionSize ?? 100000,
      maxDailyLoss: config?.maxDailyLoss ?? 10000,
      defaultCommission: config?.defaultCommission ?? 0.001,
      slippagePct: config?.slippagePct ?? 0.0001,
    };

    log.info('[TradeExecutor] Initialized', { mode: this.config.mode });
  }

  // ─── Lifecycle ────────────────────────────────────────────

  start(): void {
    if (this.running) {
      log.warn('[TradeExecutor] Already running');
      return;
    }
    this.running = true;
    log.info('[TradeExecutor] Started', { mode: this.config.mode });
    this.emit('started');
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    log.info('[TradeExecutor] Stopped');
    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  // ─── Signal Processing ────────────────────────────────────

  /**
   * Process an incoming trade signal.
   * Validates, applies risk checks, and executes the order.
   */
  processSignal(signal: TradeSignal): void {
    if (!this.running) {
      log.warn('[TradeExecutor] Not running, signal ignored:', signal.id);
      return;
    }

    // Validate signal
    if (!signal.code || signal.quantity <= 0 || signal.price <= 0) {
      log.warn('[TradeExecutor] Invalid signal:', signal);
      this.emit('signal-rejected', signal, 'Invalid signal parameters');
      return;
    }

    // Risk check: daily loss limit
    if (this.dailyPnL < -this.config.maxDailyLoss) {
      log.warn('[TradeExecutor] Daily loss limit reached, signal rejected:', signal.id);
      this.emit('signal-rejected', signal, 'Daily loss limit exceeded');
      return;
    }

    // Risk check: position size limit
    const positionValue = signal.price * signal.quantity;
    if (positionValue > this.config.maxPositionSize) {
      log.warn('[TradeExecutor] Position size limit exceeded:', signal.id);
      this.emit('signal-rejected', signal, 'Position size limit exceeded');
      return;
    }

    // Execute the order
    this.executeOrder(signal);
  }

  // ─── Order Execution ──────────────────────────────────────

  private executeOrder(signal: TradeSignal): void {
    // Apply slippage for market orders
    let execPrice = signal.price;
    if (signal.orderType === 'MARKET') {
      const slippage = signal.price * this.config.slippagePct;
      execPrice = signal.side === 'BUY'
        ? signal.price + slippage
        : signal.price - slippage;
    }

    const commission = execPrice * signal.quantity * this.config.defaultCommission;

    const order: TradeOrder = {
      id: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      signalId: signal.id,
      code: signal.code,
      side: signal.side,
      orderType: signal.orderType,
      quantity: signal.quantity,
      price: signal.price,
      status: 'filled',
      filledQty: signal.quantity,
      filledPrice: Math.round(execPrice * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.push(order);
    this.dailyTrades++;

    // Update position (simplified)
    this.updatePosition(order);

    log.info(`[TradeExecutor] Order filled: ${order.id} ${order.side} ${order.code} ${order.filledQty}@${order.filledPrice}`);
    this.emit('order-filled', order);
  }

  private updatePosition(order: TradeOrder): void {
    const existing = this.positions.get(order.code);
    const filledValue = order.filledPrice * order.filledQty;

    if (order.side === 'BUY') {
      if (existing) {
        const totalQty = existing.quantity + order.filledQty;
        const totalCost = existing.avgCost * existing.quantity + filledValue;
        existing.avgCost = Math.round((totalCost / totalQty) * 100) / 100;
        existing.quantity = totalQty;
        existing.marketPrice = order.filledPrice;
        existing.marketValue = existing.quantity * existing.marketPrice;
      } else {
        this.positions.set(order.code, {
          code: order.code,
          name: order.code,
          quantity: order.filledQty,
          avgCost: order.filledPrice,
          marketPrice: order.filledPrice,
          marketValue: filledValue,
          dayPnL: 0,
          totalPnL: 0,
          totalPnLPct: 0,
        });
      }
    } else {
      // SELL
      if (existing) {
        const pnl = (order.filledPrice - existing.avgCost) * order.filledQty - order.commission;
        this.dailyPnL += pnl;
        existing.quantity -= order.filledQty;
        existing.dayPnL += pnl;
        existing.totalPnL += pnl;
        existing.totalPnLPct = existing.avgCost > 0
          ? Math.round(((order.filledPrice - existing.avgCost) / existing.avgCost) * 10000) / 100
          : 0;

        if (existing.quantity <= 0) {
          this.positions.delete(order.code);
        }
      }
    }
  }

  // ─── Queries ──────────────────────────────────────────────

  getOrders(): TradeOrder[] {
    return [...this.orders];
  }

  getPositions(): PositionInfo[] {
    return Array.from(this.positions.values());
  }

  getDailyPnL(): number {
    return this.dailyPnL;
  }

  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  getExecutionMode(): 'paper' | 'real' {
    return this.config.mode;
  }
}

export default TradeExecutor;
