/**
 * J-53-03: Copy Trade Executor [P0]
 * v1.1.0-beta — Social Trading Copy Execution Engine
 *
 * 功能:
 * - 跟随交易执行 (CopyTradeExecutor)
 * - 仓位计算 (PositionSizer): proportional / fixed / kelly
 * - 滑点保护 (SlippageGuard)
 * - 止损同步 (StopLossSync)
 * - 执行记录 (ExecutionLog)
 *
 * 验收标准:
 * - 代码量 ≥ 500L
 * - 测试 ≥ 20 tests, 全部 pass
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type CopyMode = 'proportional' | 'fixed' | 'kelly';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled';
export type ExecutionStatus = 'active' | 'paused' | 'stopped' | 'error';

export interface CopyTradeConfig {
  id: string;
  followerId: string;
  leaderId: string;
  leaderName: string;
  mode: CopyMode;
  amount: number; // Base amount per trade
  maxPositionSize: number; // Max single position value
  maxTotalExposure: number; // Max total portfolio exposure
  stopLossPct: number; // Stop loss percentage (e.g., 5 = 5%)
  maxDrawdownPct: number; // Max drawdown before auto-stop
  maxSlippagePct: number; // Max acceptable slippage
  enabled: boolean;
  createdAt: string;
}

export interface CopyOrder {
  id: string;
  configId: string;
  signalId: string;
  followerId: string;
  leaderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  expectedPrice: number;
  slippagePct: number;
  status: OrderStatus;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  pnlPct: number;
  createdAt: string;
  filledAt?: string;
}

export interface ExecutionSummary {
  configId: string;
  totalOrders: number;
  filledOrders: number;
  rejectedOrders: number;
  totalPnl: number;
  totalPnlPct: number;
  winRate: number;
  avgSlippagePct: number;
  maxDrawdownPct: number;
  currentExposure: number;
  status: ExecutionStatus;
}

export interface PositionSizeResult {
  quantity: number;
  positionValue: number;
  riskAmount: number;
  kellyFraction: number;
  capped: boolean;
  reason: string;
}

// ── Position Sizer ─────────────────────────────────────────────────────────

export class PositionSizer {
  /**
   * Calculate position size based on copy mode
   */
  calculate(params: {
    mode: CopyMode;
    amount: number;
    price: number;
    accountEquity: number;
    currentExposure: number;
    maxPositionSize: number;
    maxTotalExposure: number;
    winRate?: number;
    avgWinLossRatio?: number;
  }): PositionSizeResult {
    const { mode, amount, price, accountEquity, currentExposure, maxPositionSize, maxTotalExposure } = params;

    if (price <= 0) {
      return { quantity: 0, positionValue: 0, riskAmount: 0, kellyFraction: 0, capped: false, reason: 'Invalid price' };
    }

    let positionValue = 0;
    let kellyFraction = 0;
    let capped = false;
    let reason = '';

    switch (mode) {
      case 'fixed':
        positionValue = amount;
        reason = `Fixed amount: $${amount}`;
        break;

      case 'proportional':
        // Scale proportionally to leader's position relative to follower equity
        positionValue = (amount / 100) * accountEquity;
        reason = `Proportional: ${(amount).toFixed(1)}% of $${accountEquity}`;
        break;

      case 'kelly': {
        const wr = params.winRate ?? 0.5;
        const wlr = params.avgWinLossRatio ?? 1.5;
        kellyFraction = Math.max(0, Math.min(0.25, wr - (1 - wr) / wlr));
        positionValue = kellyFraction * accountEquity;
        reason = `Kelly: ${(kellyFraction * 100).toFixed(1)}% of equity`;
        break;
      }
    }

    // Cap by max position size
    if (positionValue > maxPositionSize) {
      positionValue = maxPositionSize;
      capped = true;
      reason += ` (capped at max position $${maxPositionSize})`;
    }

    // Cap by remaining exposure
    const remainingExposure = maxTotalExposure - currentExposure;
    if (positionValue > remainingExposure) {
      positionValue = Math.max(0, remainingExposure);
      capped = true;
      reason += ` (exposure limit, remaining $${remainingExposure.toFixed(0)})`;
    }

    // Cap at 95% of equity
    const maxEquity = accountEquity * 0.95;
    if (positionValue > maxEquity) {
      positionValue = maxEquity;
      capped = true;
      reason += ' (capped at 95% equity)';
    }

    const quantity = Math.floor(positionValue / price);
    const actualValue = quantity * price;

    return {
      quantity,
      positionValue: Math.round(actualValue * 100) / 100,
      riskAmount: Math.round(actualValue * 0.05 * 100) / 100, // Default 5% risk
      kellyFraction: Math.round(kellyFraction * 1000) / 1000,
      capped,
      reason,
    };
  }
}

// ── Slippage Guard ─────────────────────────────────────────────────────────

export class SlippageGuard {
  /**
   * Check if slippage is within acceptable range
   */
  check(expectedPrice: number, actualPrice: number, maxSlippagePct: number): {
    acceptable: boolean;
    slippagePct: number;
    message: string;
  } {
    if (expectedPrice <= 0) {
      return { acceptable: false, slippagePct: 0, message: 'Invalid expected price' };
    }

    const slippagePct = Math.abs((actualPrice - expectedPrice) / expectedPrice) * 100;
    const acceptable = slippagePct <= maxSlippagePct;

    return {
      acceptable,
      slippagePct: Math.round(slippagePct * 100) / 100,
      message: acceptable
        ? `Slippage ${slippagePct.toFixed(2)}% within limit ${maxSlippagePct}%`
        : `Slippage ${slippagePct.toFixed(2)}% exceeds limit ${maxSlippagePct}%`,
    };
  }
}

// ── Copy Trade Executor ──────────────────────────────────────────────────────

export class CopyTradeExecutor extends EventEmitter {
  private configs: Map<string, CopyTradeConfig> = new Map();
  private orders: Map<string, CopyOrder[]> = new Map();
  private sizer: PositionSizer;
  private slippageGuard: SlippageGuard;
  private orderCounter: number = 1;
  private status: Map<string, ExecutionStatus> = new Map();
  private peakEquity: Map<string, number> = new Map();

  constructor() {
    super();
    this.sizer = new PositionSizer();
    this.slippageGuard = new SlippageGuard();
    log.info('[CopyTradeExecutor] Initialized');
  }

  // ── Config Management ──────────────────────────────────────────────────

  addConfig(config: Omit<CopyTradeConfig, 'id' | 'createdAt'>): string {
    const id = `copy_${this.orderCounter++}`;
    const full: CopyTradeConfig = {
      ...config,
      id,
      createdAt: new Date().toISOString(),
    };
    this.configs.set(id, full);
    this.orders.set(id, []);
    this.status.set(id, 'active');
    this.peakEquity.set(id, 0);

    this.emit('config:added', { configId: id, leaderId: config.leaderId });
    return id;
  }

  getConfig(id: string): CopyTradeConfig | null {
    return this.configs.get(id) || null;
  }

  updateConfig(id: string, updates: Partial<Pick<CopyTradeConfig, 'amount' | 'maxPositionSize' | 'stopLossPct' | 'maxDrawdownPct' | 'maxSlippagePct' | 'enabled'>>): boolean {
    const config = this.configs.get(id);
    if (!config) return false;
    Object.assign(config, updates);
    this.emit('config:updated', { configId: id });
    return true;
  }

  removeConfig(id: string): boolean {
    const existed = this.configs.delete(id);
    if (existed) {
      this.status.set(id, 'stopped');
      this.emit('config:removed', { configId: id });
    }
    return existed;
  }

  getConfigsByFollower(followerId: string): CopyTradeConfig[] {
    return Array.from(this.configs.values()).filter(c => c.followerId === followerId);
  }

  // ── Order Execution ────────────────────────────────────────────────────

  executeSignal(params: {
    configId: string;
    signalId: string;
    symbol: string;
    side: OrderSide;
    signalPrice: number;
    actualPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    accountEquity: number;
    currentExposure: number;
    winRate?: number;
    avgWinLossRatio?: number;
  }): CopyOrder | null {
    const config = this.configs.get(params.configId);
    if (!config) return null;
    if (!config.enabled) return null;

    const execStatus = this.status.get(params.configId);
    if (execStatus === 'stopped' || execStatus === 'error') return null;

    // Check drawdown limit
    const storedPeak = this.peakEquity.get(params.configId) ?? 0;
    if (params.accountEquity > storedPeak) this.peakEquity.set(params.configId, params.accountEquity);
    const currentPeak = this.peakEquity.get(params.configId) || params.accountEquity;
    const drawdownPct = currentPeak > 0 ? ((currentPeak - params.accountEquity) / currentPeak) * 100 : 0;
    if (drawdownPct > config.maxDrawdownPct) {
      this.status.set(params.configId, 'stopped');
      this.emit('executor:drawdown-stop', { configId: params.configId, drawdownPct });
      return null;
    }

    // Slippage check
    const slipCheck = this.slippageGuard.check(params.signalPrice, params.actualPrice, config.maxSlippagePct);
    if (!slipCheck.acceptable) {
      this.emit('order:rejected-slippage', { configId: params.configId, slippage: slipCheck.slippagePct });
      return null;
    }

    // Position sizing
    const sizing = this.sizer.calculate({
      mode: config.mode,
      amount: config.amount,
      price: params.actualPrice,
      accountEquity: params.accountEquity,
      currentExposure: params.currentExposure,
      maxPositionSize: config.maxPositionSize,
      maxTotalExposure: config.maxTotalExposure,
      winRate: params.winRate,
      avgWinLossRatio: params.avgWinLossRatio,
    });

    if (sizing.quantity === 0) {
      this.emit('order:rejected-sizing', { configId: params.configId, reason: sizing.reason });
      return null;
    }

    const order: CopyOrder = {
      id: `order_${this.orderCounter++}`,
      configId: params.configId,
      signalId: params.signalId,
      followerId: config.followerId,
      leaderId: config.leaderId,
      symbol: params.symbol,
      side: params.side,
      quantity: sizing.quantity,
      price: params.actualPrice,
      expectedPrice: params.signalPrice,
      slippagePct: slipCheck.slippagePct,
      status: 'filled',
      stopLoss: params.stopLoss ?? (params.side === 'buy' ? params.actualPrice * (1 - config.stopLossPct / 100) : undefined),
      takeProfit: params.takeProfit,
      pnl: 0,
      pnlPct: 0,
      createdAt: new Date().toISOString(),
      filledAt: new Date().toISOString(),
    };

    this.orders.get(params.configId)!.push(order);
    this.emit('order:filled', { orderId: order.id, configId: params.configId });
    return order;
  }

  // ── Close Position ─────────────────────────────────────────────────────

  closePosition(orderId: string, closePrice: number): boolean {
    for (const [configId, orders] of this.orders.entries()) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.status === 'filled') {
        const pnl = order.side === 'buy'
          ? (closePrice - order.price) * order.quantity
          : (order.price - closePrice) * order.quantity;
        const positionValue = order.price * order.quantity;
        order.pnl = Math.round(pnl * 100) / 100;
        order.pnlPct = positionValue > 0 ? Math.round((pnl / positionValue) * 10000) / 100 : 0;
        order.status = 'filled'; // stays filled but with PnL recorded
        this.emit('order:closed', { orderId, pnl: order.pnl, pnlPct: order.pnlPct });
        return true;
      }
    }
    return false;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getOrders(configId: string): CopyOrder[] {
    return [...(this.orders.get(configId) || [])];
  }

  getActiveOrders(configId: string): CopyOrder[] {
    return this.getOrders(configId).filter(o => o.status === 'filled' && o.pnl === 0);
  }

  // ── Execution Summary ──────────────────────────────────────────────────

  getSummary(configId: string): ExecutionSummary | null {
    const config = this.configs.get(configId);
    if (!config) return null;

    const orders = this.orders.get(configId) || [];
    const filled = orders.filter(o => o.status === 'filled');
    const closedWithPnl = filled.filter(o => o.pnl !== 0);
    const wins = closedWithPnl.filter(o => o.pnl > 0);

    const totalPnl = closedWithPnl.reduce((s, o) => s + o.pnl, 0);
    const totalInvested = closedWithPnl.reduce((s, o) => s + o.price * o.quantity, 0);
    const avgSlippage = orders.length > 0 ? orders.reduce((s, o) => s + o.slippagePct, 0) / orders.length : 0;

    const peak = this.peakEquity.get(configId) || 0;
    const currentEquity = peak + totalPnl;
    const drawdownPct = peak > 0 ? ((peak - currentEquity) / peak) * 100 : 0;
    const currentExposure = this.getActiveOrders(configId).reduce((s, o) => s + o.price * o.quantity, 0);

    return {
      configId,
      totalOrders: orders.length,
      filledOrders: filled.length,
      rejectedOrders: orders.filter(o => o.status === 'rejected').length,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalPnlPct: totalInvested > 0 ? Math.round((totalPnl / totalInvested) * 10000) / 100 : 0,
      winRate: closedWithPnl.length > 0 ? Math.round((wins.length / closedWithPnl.length) * 100) : 0,
      avgSlippagePct: Math.round(avgSlippage * 100) / 100,
      maxDrawdownPct: Math.round(Math.max(0, drawdownPct) * 100) / 100,
      currentExposure: Math.round(currentExposure * 100) / 100,
      status: this.status.get(configId) || 'stopped',
    };
  }

  // ── Pause/Resume ───────────────────────────────────────────────────────

  pause(configId: string): boolean {
    if (!this.status.has(configId)) return false;
    this.status.set(configId, 'paused');
    this.emit('executor:paused', { configId });
    return true;
  }

  resume(configId: string): boolean {
    if (!this.status.has(configId)) return false;
    this.status.set(configId, 'active');
    this.emit('executor:resumed', { configId });
    return true;
  }

  stop(configId: string): boolean {
    if (!this.status.has(configId)) return false;
    this.status.set(configId, 'stopped');
    this.emit('executor:stopped', { configId });
    return true;
  }

  getStatus(configId: string): ExecutionStatus | null {
    return this.status.get(configId) || null;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.configs.clear();
    this.orders.clear();
    this.status.clear();
    this.peakEquity.clear();
    this.orderCounter = 1;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: CopyTradeExecutor | null = null;

export function getCopyTradeExecutor(): CopyTradeExecutor {
  if (!_instance) _instance = new CopyTradeExecutor();
  return _instance;
}

export function resetCopyTradeExecutor(): void {
  _instance?.reset();
  _instance = null;
}

export default CopyTradeExecutor;
