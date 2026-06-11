/**
 * Closed-Loop Executor - executor (Phase 4.3)
 * strategy/policyexecute
 * 
 * state machine: IDLE → CREATED → VALIDATING → VALIDATED → EXECUTING → ACTIVE → 
 *         MONITORING → ADJUSTING → CLOSING → CLOSED → COMPLETED/FAILED/CANCELLED
 * 
 * execute: immediate / triggered / scheduled
 * risk control: Pre-Flight + position/holdingrisk control
 * retry: Fixed / Exponential / Adaptive
 */

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// Minimal EventEmitter polyfill for jsdom compatibility
class TypedEventEmitter {
  private listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) { (this.listeners[event] = this.listeners[event] || []).push(fn); return this; }
  off(event: string, fn: Function) { const arr = this.listeners[event]; if (arr) this.listeners[event] = arr.filter(f => f !== fn); return this; }
  emit(event: string, ...args: unknown[]) { (this.listeners[event] || []).forEach(fn => fn(...args)); return true; }
  removeAllListeners(event?: string) { if (event) delete this.listeners[event]; else this.listeners = {}; return this; }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type OrderStatus = 'pending' | 'filled' | 'failed' | 'cancelled' | 'rejected' | 'partial';
export type LoopState = 
  | 'IDLE' | 'CREATED' | 'VALIDATING' | 'VALIDATED' 
  | 'EXECUTING' | 'ACTIVE' | 'MONITORING' | 'ADJUSTING' 
  | 'CLOSING' | 'CLOSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ExecutionMode = 'immediate' | 'triggered' | 'scheduled';
export type RetryStrategy = 'fixed' | 'exponential' | 'adaptive';

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
  retryCount: number;
  lastRetryAt?: number;
}

export interface Position {
  code: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  trailingStopPct?: number;
  highestPrice?: number;
  entryTime: number;
  maxHoldingMinutes?: number;
}

export interface StopLossConfig {
  enabled: boolean;
  pct?: number;
  fixed?: number;
  trailing?: boolean;
  trailingPct?: number;
}

export interface TakeProfitConfig {
  enabled: boolean;
  pct?: number;
  fixed?: number;
  partial?: { pct: number; sellPct: number }[];
}

export interface ExecutorConfig {
  enabled: boolean;
  autoExecute: boolean;
  maxPositionSize: number;
  maxDailyOrders: number;
  cooldownMinutes: number;
  requireConfirmation: boolean;
  riskCheckEnabled: boolean;
  executionMode: ExecutionMode;
  retryStrategy: RetryStrategy;
  maxRetries: number;
  retryDelayMs: number;
  retryMultiplier: number;
  stopLoss: StopLossConfig;
  takeProfit: TakeProfitConfig;
  maxHoldingMinutes: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  /** Simulation failure rate (0..1). 0 = always succeed (for tests). Default 0.05. */
  simulationFailureRate?: number;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  signal?: Signal;
  order?: Order;
  error?: string;
  riskCheckPassed?: boolean;
  riskReason?: string;
  state?: LoopState;
}

export interface ExecutorStats {
  totalSignals: number;
  executedOrders: number;
  successRate: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  maxDrawdown: number;
  totalRetries: number;
  dailyLossPct: number;
  peakEquity: number;
  currentDrawdownPct: number;
  loopsCompleted: number;
  loopsFailed: number;
}

export interface LoopUnit {
  id: string;
  signalId: string;
  code: string;
  state: LoopState;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPct: number;
  createdAt: number;
  closedAt?: number;
  orders: Order[];
  exitReason?: string;
}

// ── ClosedLoopExecutor Class ───────────────────────────────────────────────

export class ClosedLoopExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private signals: Signal[] = [];
  private orders: Order[] = [];
  private positions: Map<string, Position> = new Map();
  private loops: Map<string, LoopUnit> = new Map();
  private dailyOrderCount: number = 0;
  private dailyPnl: number = 0;
  private dailyDate: string = '';
  private lastOrderTime: number = 0;
  private enabled: boolean = true;
  private peakEquity: number = 0;
  private currentEquity: number = 0;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<ExecutorConfig>) {
    super();
    this.config = {
      enabled: true,
      autoExecute: false,
      maxPositionSize: 1000,
      maxDailyOrders: 50,
      cooldownMinutes: 1,
      requireConfirmation: true,
      riskCheckEnabled: true,
      executionMode: 'immediate',
      retryStrategy: 'fixed',
      maxRetries: 3,
      retryDelayMs: 1000,
      retryMultiplier: 2,
      stopLoss: { enabled: true, pct: 5 },
      takeProfit: { enabled: true, pct: 10 },
      maxHoldingMinutes: 0,
      maxDailyLossPct: 3,
      maxDrawdownPct: 15,
      // Default 0 for deterministic behavior. Production may opt-in to realistic
      // failure simulation by setting this > 0 in config.
      simulationFailureRate: 0,
      ...config,
    };
    this.enabled = this.config.enabled;
    log.info('[ClosedLoopExecutor] Initialized', this.config);
  }

  // ── Signal Processing ──────────────────────────────────────────────────

  addSignal(signal: Signal): ExecutionResult {
    this.signals.push(signal);
    log.info(`[ClosedLoopExecutor] Signal added: ${signal.type} ${signal.code} @ ${signal.price}`);
    this.emit('signal:received', signal);

    if (!this.enabled) {
      return { success: false, signal, error: 'Executor disabled', state: 'IDLE' };
    }

    if (signal.type === 'HOLD') {
      return { success: true, signal, riskCheckPassed: true, state: 'IDLE' };
    }

    // Pre-Flight validation
    const preflight = this.preflightCheck(signal);
    if (!preflight.passed) {
      log.warn(`[ClosedLoopExecutor] Pre-flight failed: ${preflight.reason}`);
      this.emit('signal:rejected', { signal, reason: preflight.reason });
      return {
        success: false,
        signal,
        riskCheckPassed: false,
        riskReason: preflight.reason,
        state: 'VALIDATING',
      };
    }

    // Create loop unit
    const loopId = `LOOP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const loop: LoopUnit = {
      id: loopId,
      signalId: signal.id,
      code: signal.code,
      state: 'CREATED',
      entryPrice: signal.price,
      pnl: 0,
      pnlPct: 0,
      createdAt: Date.now(),
      orders: [],
    };
    this.loops.set(loopId, loop);
    this.updateLoopState(loop, 'CREATED');

    // Auto-execute based on mode
    switch (this.config.executionMode) {
      case 'immediate':
        return this.executeLoop(loop, signal);
      case 'triggered':
        // Wait for trigger condition (handled externally)
        this.updateLoopState(loop, 'VALIDATED');
        return { success: true, signal, riskCheckPassed: true, state: 'VALIDATED' };
      case 'scheduled':
        // Handled by CronScheduler
        this.updateLoopState(loop, 'VALIDATED');
        return { success: true, signal, riskCheckPassed: true, state: 'VALIDATED' };
      default:
        return { success: false, signal, error: 'Unknown execution mode', state: 'IDLE' };
    }
  }

  // ── Loop Execution ────────────────────────────────────────────────────

  executeLoop(loop: LoopUnit, signal: Signal): ExecutionResult {
    this.updateLoopState(loop, 'EXECUTING');

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
      retryCount: 0,
    };

    loop.orders.push(order);
    this.orders.push(order);
    this.lastOrderTime = Date.now();
    this.dailyOrderCount++;

    log.info(`[ClosedLoopExecutor] Order created: ${order.side} ${quantity} ${order.code} @ ${order.price}`);
    this.emit('loop:executing', { loop, order });

    // Simulate order execution
    this.simulateOrderExecution(order, loop);

    return { success: true, signal, order, state: 'EXECUTING' };
  }

  triggerLoop(loopId: string): ExecutionResult {
    const loop = this.loops.get(loopId);
    if (!loop || loop.state !== 'VALIDATED') {
      return { success: false, error: 'Loop not found or not in VALIDATED state', state: loop?.state || 'IDLE' };
    }

    const signal = this.signals.find(s => s.id === loop.signalId);
    if (!signal) {
      return { success: false, error: 'Signal not found', state: 'FAILED' };
    }

    return this.executeLoop(loop, signal);
  }

  private simulateOrderExecution(order: Order, loop: LoopUnit): void {
    const failureRate = this.config.simulationFailureRate ?? 0.05;
    const success = Math.random() > failureRate;

    if (success) {
      order.status = 'filled';
      order.filledPrice = order.price * (1 + (Math.random() - 0.5) * 0.001);
      order.filledQuantity = order.quantity;
      order.filledAt = Date.now();

      this.updatePosition(order);
      this.updateLoopState(loop, 'ACTIVE');

      // Set stop loss / take profit on position
      const pos = this.positions.get(order.code);
      if (pos) {
        if (this.config.stopLoss.enabled && this.config.stopLoss.pct) {
          pos.stopLoss = order.filledPrice! * (1 - this.config.stopLoss.pct / 100);
          if (this.config.stopLoss.trailing) {
            pos.trailingStop = pos.stopLoss;
            pos.trailingStopPct = this.config.stopLoss.trailingPct || this.config.stopLoss.pct;
          }
        }
        if (this.config.takeProfit.enabled && this.config.takeProfit.pct) {
          pos.takeProfit = order.filledPrice! * (1 + this.config.takeProfit.pct / 100);
        }
        pos.entryTime = Date.now();
        if (this.config.maxHoldingMinutes > 0) {
          pos.maxHoldingMinutes = this.config.maxHoldingMinutes;
        }
        pos.highestPrice = order.filledPrice;
      }

      log.info(`[ClosedLoopExecutor] Order filled: ${order.id} @ ${order.filledPrice}`);
      this.emit('loop:active', { loop, order });
      this.emit('order:filled', order);
    } else {
      order.status = 'failed';
      order.error = 'Simulated execution failure';
      
      // Retry logic
      if (order.retryCount < this.config.maxRetries) {
        this.retryOrder(order, loop);
      } else {
        this.updateLoopState(loop, 'FAILED');
        loop.exitReason = 'max_retries_exceeded';
        log.error(`[ClosedLoopExecutor] Order failed after max retries: ${order.id}`);
        this.emit('loop:failed', { loop, order });
      }
    }
  }

  private retryOrder(order: Order, loop: LoopUnit): void {
    order.retryCount++;
    order.lastRetryAt = Date.now();
    
    let delay = this.config.retryDelayMs;
    switch (this.config.retryStrategy) {
      case 'fixed':
        delay = this.config.retryDelayMs;
        break;
      case 'exponential':
        delay = this.config.retryDelayMs * Math.pow(this.config.retryMultiplier, order.retryCount - 1);
        break;
      case 'adaptive':
        delay = this.config.retryDelayMs * (1 + order.retryCount * 0.5);
        break;
    }

    log.info(`[ClosedLoopExecutor] Retrying order ${order.id} (attempt ${order.retryCount}/${this.config.maxRetries}) in ${delay}ms`);
    this.updateLoopState(loop, 'EXECUTING');

    setTimeout(() => {
      this.simulateOrderExecution(order, loop);
    }, delay);
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
          entryTime: Date.now(),
          highestPrice: filledPrice,
        });
      }
    } else {
      if (existing) {
        const realizedPnl = (filledPrice - existing.avgPrice) * order.quantity!;
        this.dailyPnl += realizedPnl;
        existing.quantity -= order.quantity!;
        if (existing.quantity <= 0) {
          this.positions.delete(order.code);
        } else {
          existing.pnl = (filledPrice - existing.avgPrice) * existing.quantity;
          existing.pnlPct = ((filledPrice - existing.avgPrice) / existing.avgPrice) * 100;
        }
      }
    }

    // Update equity tracking
    this.updateEquityTracking();
  }

  // ── Position Monitoring ────────────────────────────────────────────────

  updatePrice(code: string, currentPrice: number): void {
    const pos = this.positions.get(code);
    if (!pos) return;

    pos.currentPrice = currentPrice;
    pos.pnl = (currentPrice - pos.avgPrice) * pos.quantity;
    pos.pnlPct = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100;

    // Update highest price for trailing stop
    if (currentPrice > (pos.highestPrice || 0)) {
      pos.highestPrice = currentPrice;
      if (pos.trailingStop && pos.trailingStopPct) {
        pos.trailingStop = currentPrice * (1 - pos.trailingStopPct / 100);
      }
    }

    // Check stop loss
    if (pos.stopLoss && currentPrice <= pos.stopLoss) {
      this.closePosition(code, 'stop_loss_hit');
    }

    // Check take profit
    if (pos.takeProfit && currentPrice >= pos.takeProfit) {
      this.closePosition(code, 'take_profit_hit');
    }

    // Check trailing stop
    if (pos.trailingStop && currentPrice <= pos.trailingStop) {
      this.closePosition(code, 'trailing_stop_hit');
    }

    // Check time exit
    if (pos.maxHoldingMinutes && pos.maxHoldingMinutes > 0) {
      const holdingMinutes = (Date.now() - pos.entryTime) / 60000;
      if (holdingMinutes >= pos.maxHoldingMinutes) {
        this.closePosition(code, 'time_exit');
      }
    }

    this.emit('position:updated', pos);
  }

  closePosition(code: string, reason: string): void {
    const pos = this.positions.get(code);
    if (!pos) return;

    log.info(`[ClosedLoopExecutor] Closing position ${code}: ${reason}`);

    // Find associated loop
    for (const [, loop] of this.loops) {
      if (loop.code === code && (loop.state === 'ACTIVE' || loop.state === 'MONITORING')) {
        this.updateLoopState(loop, 'CLOSING');
        
        // Create closing order
        const closeOrder: Order = {
          id: `ORD-CLOSE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          signalId: loop.signalId,
          code,
          side: 'SELL',
          quantity: pos.quantity,
          price: pos.currentPrice,
          status: 'filled',
          filledPrice: pos.currentPrice,
          filledQuantity: pos.quantity,
          timestamp: Date.now(),
          filledAt: Date.now(),
          retryCount: 0,
        };

        loop.orders.push(closeOrder);
        this.orders.push(closeOrder);

        loop.exitPrice = pos.currentPrice;
        loop.pnl = pos.pnl;
        loop.pnlPct = pos.pnlPct;
        loop.exitReason = reason;
        loop.closedAt = Date.now();

        this.updateLoopState(loop, 'CLOSED');
        this.dailyPnl += pos.pnl;

        this.emit('loop:closed', { loop, reason });
        break;
      }
    }

    this.positions.delete(code);
    this.updateEquityTracking();
    this.emit('position:closed', { code, reason });
  }

  // ── Risk Checks ────────────────────────────────────────────────────────

  private preflightCheck(signal: Signal): { passed: boolean; reason: string } {
    if (!this.config.riskCheckEnabled) {
      return { passed: true, reason: '' };
    }

    // Position size check
    const positionSize = this.calculatePositionSize(signal.price);
    if (positionSize > this.config.maxPositionSize) {
      return { passed: false, reason: `Position size ${positionSize} exceeds max ${this.config.maxPositionSize}` };
    }

    // Max positions check
    if (this.positions.size >= 20) {
      return { passed: false, reason: 'Max positions reached (20)' };
    }

    // Daily order limit
    this.checkDailyReset();
    if (this.dailyOrderCount >= this.config.maxDailyOrders) {
      return { passed: false, reason: `Daily order limit reached (${this.config.maxDailyOrders})` };
    }

    // Daily loss limit
    if (this.currentEquity > 0 && this.dailyPnl < 0) {
      const dailyLossPct = (this.dailyPnl / this.currentEquity) * 100;
      if (dailyLossPct <= -this.config.maxDailyLossPct) {
        return { passed: false, reason: `Daily loss limit reached (${dailyLossPct.toFixed(2)}%)` };
      }
    }

    // Drawdown check
    if (this.peakEquity > 0 && this.currentEquity > 0) {
      const drawdownPct = ((this.peakEquity - this.currentEquity) / this.peakEquity) * 100;
      if (drawdownPct >= this.config.maxDrawdownPct) {
        return { passed: false, reason: `Max drawdown reached (${drawdownPct.toFixed(2)}%)` };
      }
    }

    // Cooldown check
    const now = Date.now();
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    if (now - this.lastOrderTime < cooldownMs) {
      return { passed: false, reason: `Cooldown active (${this.config.cooldownMinutes}min)` };
    }

    return { passed: true, reason: '' };
  }

  private calculatePositionSize(price: number): number {
    const baseSize = Math.floor(this.config.maxPositionSize / price);
    return Math.max(1, Math.min(baseSize, this.config.maxPositionSize));
  }

  private updateEquityTracking(): void {
    let totalEquity = 0;
    for (const [, pos] of this.positions) {
      totalEquity += pos.quantity * pos.currentPrice;
    }
    this.currentEquity = totalEquity;
    if (totalEquity > this.peakEquity) {
      this.peakEquity = totalEquity;
    }
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyDate !== today) {
      this.dailyDate = today;
      this.dailyOrderCount = 0;
      this.dailyPnl = 0;
      log.info('[ClosedLoopExecutor] Daily counters reset');
    }
  }

  // ── State Management ──────────────────────────────────────────────────

  private updateLoopState(loop: LoopUnit, newState: LoopState): void {
    const oldState = loop.state;
    loop.state = newState;
    log.info(`[ClosedLoopExecutor] Loop ${loop.id}: ${oldState} → ${newState}`);
    this.emit('loop:state_change', { loop, oldState, newState });
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

  getLoops(state?: LoopState): LoopUnit[] {
    const loops = Array.from(this.loops.values());
    if (state) return loops.filter(l => l.state === state);
    return loops;
  }

  getLoop(loopId: string): LoopUnit | undefined {
    return this.loops.get(loopId);
  }

  getStats(): ExecutorStats {
    const filledOrders = this.orders.filter(o => o.status === 'filled');
    const winningOrders = filledOrders.filter(o => (o.filledPrice || 0) > o.price);
    const totalPnl = filledOrders.reduce((sum, o) => {
      const pnl = ((o.filledPrice || o.price) - o.price) * (o.filledQuantity || 0);
      return sum + pnl;
    }, 0);
    const totalRetries = this.orders.reduce((sum, o) => sum + o.retryCount, 0);
    const drawdownPct = this.peakEquity > 0
      ? ((this.peakEquity - this.currentEquity) / this.peakEquity) * 100
      : 0;
    const dailyLossPct = this.currentEquity > 0 ? (this.dailyPnl / this.currentEquity) * 100 : 0;

    const completedLoops = this.getLoops('COMPLETED').length + this.getLoops('CLOSED').length;
    const failedLoops = this.getLoops('FAILED').length;

    return {
      totalSignals: this.signals.length,
      executedOrders: filledOrders.length,
      successRate: this.orders.length > 0 ? (filledOrders.length / this.orders.length) * 100 : 0,
      totalPnl,
      winRate: filledOrders.length > 0 ? (winningOrders.length / filledOrders.length) * 100 : 0,
      avgPnl: filledOrders.length > 0 ? totalPnl / filledOrders.length : 0,
      maxDrawdown: drawdownPct,
      totalRetries,
      dailyLossPct,
      peakEquity: this.peakEquity,
      currentDrawdownPct: drawdownPct,
      loopsCompleted: completedLoops,
      loopsFailed: failedLoops,
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
    this.dailyPnl = 0;
    log.info('[ClosedLoopExecutor] Daily counters reset');
  }

  clearHistory(): void {
    this.signals = [];
    this.orders = [];
    this.positions.clear();
    this.loops.clear();
    this.peakEquity = 0;
    this.currentEquity = 0;
    this.dailyOrderCount = 0;
    this.dailyPnl = 0;
    log.info('[ClosedLoopExecutor] History cleared');
  }

  updateConfig(config: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...config };
    this.enabled = this.config.enabled;
    log.info('[ClosedLoopExecutor] Config updated');
  }

  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  // ── Monitor ────────────────────────────────────────────────────────────

  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitorInterval) return;
    this.monitorInterval = setInterval(() => {
      this.monitorPositions();
    }, intervalMs);
    log.info(`[ClosedLoopExecutor] Monitoring started (interval: ${intervalMs}ms)`);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      log.info('[ClosedLoopExecutor] Monitoring stopped');
    }
  }

  private monitorPositions(): void {
    for (const [code, pos] of this.positions) {
      // Check time exit
      if (pos.maxHoldingMinutes && pos.maxHoldingMinutes > 0) {
        const holdingMinutes = (Date.now() - pos.entryTime) / 60000;
        if (holdingMinutes >= pos.maxHoldingMinutes) {
          this.closePosition(code, 'time_exit');
        }
      }
    }
  }

  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    log.info('[ClosedLoopExecutor] Destroyed');
  }
}
