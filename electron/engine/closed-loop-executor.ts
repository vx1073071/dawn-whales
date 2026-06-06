/**
 * Closed-Loop Executor - 闭环交易执行器
 * 实现策略信号到交易执行的完整闭环
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type OrderStatus = 'pending' | 'filled' | 'failed' | 'cancelled';

export interface Signal {
  id: string;
  strategyId: string;
  code: string;
  type: SignalType;
  price: number;
  timestamp: number;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface Order {
  id: string;
  signalId: string;
  code: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: OrderStatus;
  filledPrice?: number;
  filledQuantity?: number;
  timestamp: number;
  filledAt?: number;
  error?: string;
}

export interface Position {
  code: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
}

export interface ExecutorConfig {
  enabled: boolean;
  autoExecute: boolean;
  maxPositionSize: number;
  maxDailyOrders: number;
  cooldownMinutes: number;
  requireConfirmation: boolean;
  riskCheckEnabled: boolean;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  signal?: Signal;
  order?: Order;
  error?: string;
  riskCheckPassed?: boolean;
  riskReason?: string;
}

export interface ExecutorStats {
  totalSignals: number;
  executedOrders: number;
  successRate: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  maxDrawdown: number;
}

// ── ClosedLoopExecutor Class ───────────────────────────────────────────────

export class ClosedLoopExecutor {
  private config: ExecutorConfig;
  private signals: Signal[] = [];
  private orders: Order[] = [];
  private positions: Map<string, Position> = new Map();
  private dailyOrderCount: number = 0;
  private lastOrderTime: number = 0;
  private enabled: boolean = true;

  constructor(config?: Partial<ExecutorConfig>) {
    this.config = {
      enabled: true,
      autoExecute: false,
      maxPositionSize: 1000,
      maxDailyOrders: 50,
      cooldownMinutes: 1,
      requireConfirmation: true,
      riskCheckEnabled: true,
      ...config,
    };
    this.enabled = this.config.enabled;
    log.info('[ClosedLoopExecutor] Initialized', this.config);
  }

  // ── Signal Processing ──────────────────────────────────────────────────

  addSignal(signal: Signal): ExecutionResult {
    this.signals.push(signal);
    log.info(`[ClosedLoopExecutor] Signal added: ${signal.type} ${signal.code} @ ${signal.price}`);

    if (!this.enabled) {
      return { success: false, signal, error: 'Executor disabled' };
    }

    if (signal.type === 'HOLD') {
      return { success: true, signal, riskCheckPassed: true };
    }

    // Risk check
    const riskCheck = this.performRiskCheck(signal);
    if (!riskCheck.passed) {
      log.warn(`[ClosedLoopExecutor] Risk check failed: ${riskCheck.reason}`);
      return {
        success: false,
        signal,
        riskCheckPassed: false,
        riskReason: riskCheck.reason,
      };
    }

    // Cooldown check
    const now = Date.now();
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    if (now - this.lastOrderTime < cooldownMs) {
      return {
        success: false,
        signal,
        riskCheckPassed: true,
        error: `Cooldown active (${this.config.cooldownMinutes}min)`,
      };
    }

    // Daily limit check
    if (this.dailyOrderCount >= this.config.maxDailyOrders) {
      return {
        success: false,
        signal,
        riskCheckPassed: true,
        error: `Daily order limit reached (${this.config.maxDailyOrders})`,
      };
    }

    // Auto-execute if enabled
    if (this.config.autoExecute && !this.config.requireConfirmation) {
      return this.executeSignal(signal);
    }

    return { success: true, signal, riskCheckPassed: true };
  }

  executeSignal(signal: Signal): ExecutionResult {
    if (signal.type === 'HOLD') {
      return { success: true, signal };
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    const quantity = this.calculatePositionSize(signal.price);

    const order: Order = {
      id: orderId,
      signalId: signal.id,
      code: signal.code,
      side: signal.type,
      quantity,
      price: signal.price,
      status: 'pending',
      timestamp: Date.now(),
    };

    this.orders.push(order);
    this.lastOrderTime = Date.now();
    this.dailyOrderCount++;

    log.info(`[ClosedLoopExecutor] Order created: ${order.side} ${quantity} ${order.code} @ ${order.price}`);

    // Simulate order execution (in real implementation, this would call broker API)
    setTimeout(() => {
      this.simulateOrderExecution(order);
    }, 100);

    return { success: true, signal, order };
  }

  private simulateOrderExecution(order: Order): void {
    // Simulate 95% success rate
    const success = Math.random() > 0.05;

    if (success) {
      order.status = 'filled';
      order.filledPrice = order.price * (1 + (Math.random() - 0.5) * 0.001); // Small slippage
      order.filledQuantity = order.quantity;
      order.filledAt = Date.now();

      // Update position
      this.updatePosition(order);

      log.info(`[ClosedLoopExecutor] Order filled: ${order.id} @ ${order.filledPrice}`);
    } else {
      order.status = 'failed';
      order.error = 'Simulated execution failure';
      log.error(`[ClosedLoopExecutor] Order failed: ${order.id}`);
    }
  }

  private updatePosition(order: Order): void {
    const existing = this.positions.get(order.code);
    const filledPrice = order.filledPrice || order.price;

    if (order.side === 'BUY') {
      if (existing) {
        const totalQty = existing.quantity + order.quantity!;
        const totalCost = existing.quantity * existing.avgPrice + order.quantity! * filledPrice;
        existing.avgPrice = totalCost / totalQty;
        existing.quantity = totalQty;
        existing.currentPrice = filledPrice;
        existing.pnl = (filledPrice - existing.avgPrice) * existing.quantity;
        existing.pnlPct = ((filledPrice - existing.avgPrice) / existing.avgPrice) * 100;
      } else {
        this.positions.set(order.code, {
          code: order.code,
          quantity: order.quantity!,
          avgPrice: filledPrice,
          currentPrice: filledPrice,
          pnl: 0,
          pnlPct: 0,
        });
      }
    } else {
      // SELL
      if (existing) {
        existing.quantity -= order.quantity!;
        if (existing.quantity <= 0) {
          this.positions.delete(order.code);
        } else {
          existing.pnl = (filledPrice - existing.avgPrice) * existing.quantity;
          existing.pnlPct = ((filledPrice - existing.avgPrice) / existing.avgPrice) * 100;
        }
      }
    }
  }

  // ── Risk Checks ────────────────────────────────────────────────────────

  private performRiskCheck(signal: Signal): { passed: boolean; reason: string } {
    if (!this.config.riskCheckEnabled) {
      return { passed: true, reason: '' };
    }

    // Position size check
    const positionSize = this.calculatePositionSize(signal.price);
    if (positionSize > this.config.maxPositionSize) {
      return {
        passed: false,
        reason: `Position size ${positionSize} exceeds max ${this.config.maxPositionSize}`,
      };
    }

    // Check if already have max positions
    if (this.positions.size >= 20) {
      return {
        passed: false,
        reason: `Max positions reached (20)`,
      };
    }

    return { passed: true, reason: '' };
  }

  private calculatePositionSize(price: number): number {
    const baseSize = Math.floor(this.config.maxPositionSize / price);
    return Math.max(1, Math.min(baseSize, this.config.maxPositionSize));
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getSignals(limit?: number): Signal[] {
    const sorted = [...this.signals].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getOrders(limit?: number): Order[] {
    const sorted = [...this.orders].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getStats(): ExecutorStats {
    const filledOrders = this.orders.filter(o => o.status === 'filled');
    const winningOrders = filledOrders.filter(o => (o.filledPrice || 0) > o.price);
    const totalPnl = filledOrders.reduce((sum, o) => {
      const pnl = ((o.filledPrice || o.price) - o.price) * (o.filledQuantity || 0);
      return sum + pnl;
    }, 0);

    return {
      totalSignals: this.signals.length,
      executedOrders: filledOrders.length,
      successRate: this.orders.length > 0 ? (filledOrders.length / this.orders.length) * 100 : 0,
      totalPnl,
      winRate: filledOrders.length > 0 ? (winningOrders.length / filledOrders.length) * 100 : 0,
      avgPnl: filledOrders.length > 0 ? totalPnl / filledOrders.length : 0,
      maxDrawdown: 0, // Would need equity curve tracking
    };
  }

  // ── Control ────────────────────────────────────────────────────────────

  enable(): void {
    this.enabled = true;
    log.info('[ClosedLoopExecutor] Enabled');
  }

  disable(): void {
    this.enabled = false;
    log.info('[ClosedLoopExecutor] Disabled');
  }

  resetDailyCount(): void {
    this.dailyOrderCount = 0;
    log.info('[ClosedLoopExecutor] Daily order count reset');
  }

  clearHistory(): void {
    this.signals = [];
    this.orders = [];
    this.positions.clear();
    log.info('[ClosedLoopExecutor] History cleared');
  }

  updateConfig(config: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...config };
    this.enabled = this.config.enabled;
    log.info('[ClosedLoopExecutor] Config updated', this.config);
  }

  getConfig(): ExecutorConfig {
    return { ...this.config };
  }
}
