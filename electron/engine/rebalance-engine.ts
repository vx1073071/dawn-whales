/**
 * Rebalance Engine - 投资组合再平衡引擎 (Phase 4.3)
 * 根据目标权重自动调整持仓
 * 
 * 策略类型: equal_weight / target_weight / risk_parity / minimum_variance / custom
 * 触发方式: periodic / threshold / signal / manual
 * 约束引擎: min/max trade size, max positions, max turnover, cash buffer
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type RebalanceMode = 'threshold' | 'periodic' | 'drift' | 'signal' | 'manual';
export type RebalanceStrategy = 'equal_weight' | 'target_weight' | 'risk_parity' | 'minimum_variance' | 'custom';
export type TriggerType = 'periodic' | 'threshold' | 'signal' | 'manual';

export interface TargetWeight {
  code: string;
  weight: number;  // 0-1 (percentage)
}

export interface Position {
  code: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  weight: number;  // current weight (0-1)
}

export interface RebalanceOrder {
  code: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  targetQuantity: number;
  currentQuantity: number;
  price: number;
  reason: string;
  estimatedCost: number;
}

export interface RebalanceResult {
  timestamp: number;
  totalValue: number;
  orders: RebalanceOrder[];
  beforeWeights: Map<string, number>;
  afterWeights: Map<string, number>;
  driftBefore: number;
  driftAfter: number;
  driftCorrected: number;
  totalCost: number;
  triggerType: TriggerType;
  strategy: RebalanceStrategy;
}

export interface RebalanceConfig {
  mode: RebalanceMode;
  strategy: RebalanceStrategy;
  thresholdPct: number;        // trigger rebalance when drift exceeds this %
  periodicIntervalDays: number; // for periodic mode
  minRebalanceAmount: number;  // minimum trade amount to execute
  maxSlippagePct: number;
  autoExecute: boolean;
  requireConfirmation: boolean;
  constraints: ConstraintConfig;
}

export interface ConstraintConfig {
  minTradeSize: number;        // minimum trade value
  maxTradeSize: number;        // maximum trade value
  maxPositions: number;        // maximum number of positions
  maxTurnoverPct: number;      // maximum turnover percentage per rebalance
  cashBufferPct: number;       // minimum cash buffer percentage
  allowPartialRebalance: boolean;
}

export interface RebalanceStats {
  totalRebalances: number;
  avgDriftBefore: number;
  avgDriftAfter: number;
  avgOrdersPerRebalance: number;
  lastRebalanceTime: number;
  totalRebalanceCost: number;
  avgTurnoverPct: number;
  rebalancesByStrategy: Record<RebalanceStrategy, number>;
  rebalancesByTrigger: Record<TriggerType, number>;
}

// ── RebalanceEngine Class ──────────────────────────────────────────────────

export class RebalanceEngine extends EventEmitter {
  private config: RebalanceConfig;
  private targetWeights: TargetWeight[] = [];
  private positions: Map<string, Position> = new Map();
  private rebalanceHistory: RebalanceResult[] = [];
  private lastRebalanceTime: number = 0;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<RebalanceConfig>) {
    super();
    this.config = {
      mode: 'threshold',
      strategy: 'target_weight',
      thresholdPct: 5,
      periodicIntervalDays: 30,
      minRebalanceAmount: 100,
      maxSlippagePct: 0.5,
      autoExecute: false,
      requireConfirmation: true,
      constraints: {
        minTradeSize: 100,
        maxTradeSize: 100000,
        maxPositions: 20,
        maxTurnoverPct: 30,
        cashBufferPct: 5,
        allowPartialRebalance: true,
      },
      ...config,
    };
    log.info('[RebalanceEngine] Initialized', this.config);
  }

  // ── Target Management ──────────────────────────────────────────────────

  setTargets(targets: TargetWeight[]): void {
    const totalWeight = targets.reduce((sum, t) => sum + t.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      log.warn(`[RebalanceEngine] Target weights sum to ${totalWeight}, normalizing to 1.0`);
      const factor = 1.0 / totalWeight;
      targets.forEach(t => t.weight *= factor);
    }
    this.targetWeights = [...targets];
    log.info(`[RebalanceEngine] Targets set: ${targets.length} assets`);
    this.emit('targets:updated', this.targetWeights);
  }

  getTargets(): TargetWeight[] {
    return [...this.targetWeights];
  }

  setEqualWeights(codes: string[]): void {
    const weight = 1.0 / codes.length;
    this.targetWeights = codes.map(code => ({ code, weight }));
    log.info(`[RebalanceEngine] Equal weights set: ${weight.toFixed(4)} for ${codes.length} assets`);
    this.emit('targets:updated', this.targetWeights);
  }

  setCustomWeights(weights: Record<string, number>): void {
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      log.warn(`[RebalanceEngine] Custom weights sum to ${totalWeight}, normalizing to 1.0`);
      const factor = 1.0 / totalWeight;
      Object.keys(weights).forEach(k => weights[k] *= factor);
    }
    this.targetWeights = Object.entries(weights).map(([code, weight]) => ({ code, weight }));
    log.info(`[RebalanceEngine] Custom weights set: ${this.targetWeights.length} assets`);
    this.emit('targets:updated', this.targetWeights);
  }

  // ── Position Management ────────────────────────────────────────────────

  updatePositions(positions: Position[]): void {
    this.positions.clear();
    positions.forEach(p => {
      this.positions.set(p.code, { ...p });
    });
    log.info(`[RebalanceEngine] Positions updated: ${positions.length} assets`);
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPosition(code: string): Position | undefined {
    return this.positions.get(code);
  }

  // ── Rebalance Logic ────────────────────────────────────────────────────

  shouldRebalance(triggerType?: TriggerType): boolean {
    const trigger = triggerType || this.mapModeToTrigger();

    switch (trigger) {
      case 'periodic':
        const daysSinceLastRebalance = (Date.now() - this.lastRebalanceTime) / (1000 * 60 * 60 * 24);
        return daysSinceLastRebalance >= this.config.periodicIntervalDays;

      case 'threshold':
        return this.calculateDrift() > this.config.thresholdPct;

      case 'signal':
        // Signal-based rebalance is triggered externally
        return true;

      case 'manual':
        return true;

      default:
        return false;
    }
  }

  private mapModeToTrigger(): TriggerType {
    switch (this.config.mode) {
      case 'threshold': return 'threshold';
      case 'periodic': return 'periodic';
      case 'signal': return 'signal';
      case 'manual': return 'manual';
      case 'drift': return 'threshold';
      default: return 'manual';
    }
  }

  calculateDrift(): number {
    if (this.targetWeights.length === 0) return 0;

    let totalDrift = 0;
    for (const target of this.targetWeights) {
      const position = this.positions.get(target.code);
      const currentWeight = position?.weight || 0;
      const drift = Math.abs(currentWeight - target.weight);
      totalDrift += drift;
    }

    return (totalDrift / this.targetWeights.length) * 100;
  }

  calculateRebalanceOrders(totalValue: number): RebalanceOrder[] {
    const orders: RebalanceOrder[] = [];
    const constraints = this.config.constraints;
    const cashBufferValue = totalValue * (constraints.cashBufferPct / 100);
    const availableValue = totalValue - cashBufferValue;

    // Calculate target values based on strategy
    const targetValues = this.calculateTargetValues(totalValue, availableValue);

    for (const target of targetValues) {
      const position = this.positions.get(target.code);
      const currentQuantity = position?.quantity || 0;
      const currentPrice = position?.currentPrice || 0;
      const currentValue = position?.marketValue || 0;
      const targetValue = target.targetValue;
      const targetQuantity = currentPrice > 0 ? Math.round(targetValue / currentPrice) : 0;
      const quantityDiff = targetQuantity - currentQuantity;
      const tradeValue = Math.abs(quantityDiff * currentPrice);

      // Skip if below minimum trade size
      if (tradeValue < constraints.minTradeSize) {
        continue;
      }

      // Skip if above maximum trade size
      if (tradeValue > constraints.maxTradeSize) {
        if (!constraints.allowPartialRebalance) continue;
        // Partial rebalance: adjust quantity to max trade size
        const adjustedQuantity = Math.floor(constraints.maxTradeSize / currentPrice);
        if (adjustedQuantity === 0) continue;
        
        orders.push(this.createOrder(target.code, quantityDiff > 0 ? 'BUY' : 'SELL', 
          adjustedQuantity, targetQuantity, currentQuantity, currentPrice,
          `Partial rebalance (max trade size limit)`));
        continue;
      }

      // Check max positions constraint
      if (quantityDiff > 0 && currentQuantity === 0 && this.positions.size >= constraints.maxPositions) {
        log.warn(`[RebalanceEngine] Skipping ${target.code}: max positions reached`);
        continue;
      }

      const order = this.createOrder(
        target.code,
        quantityDiff > 0 ? 'BUY' : 'SELL',
        Math.abs(quantityDiff),
        targetQuantity,
        currentQuantity,
        currentPrice,
        `Rebalance: target ${(target.weight * 100).toFixed(2)}%, current ${((position?.weight || 0) * 100).toFixed(2)}%`
      );
      orders.push(order);
    }

    // Check max turnover constraint
    const totalTradeValue = orders.reduce((sum, o) => sum + o.estimatedCost, 0);
    const turnoverPct = (totalTradeValue / totalValue) * 100;
    if (turnoverPct > constraints.maxTurnoverPct && !constraints.allowPartialRebalance) {
      log.warn(`[RebalanceEngine] Turnover ${turnoverPct.toFixed(2)}% exceeds max ${constraints.maxTurnoverPct}%, skipping rebalance`);
      return [];
    }

    return orders;
  }

  private createOrder(
    code: string, side: 'BUY' | 'SELL', quantity: number,
    targetQuantity: number, currentQuantity: number, price: number, reason: string
  ): RebalanceOrder {
    return {
      code,
      side,
      quantity,
      targetQuantity,
      currentQuantity,
      price,
      reason,
      estimatedCost: quantity * price * (1 + this.config.maxSlippagePct / 100),
    };
  }

  private calculateTargetValues(totalValue: number, availableValue: number): Array<TargetWeight & { targetValue: number }> {
    switch (this.config.strategy) {
      case 'equal_weight':
        const equalWeight = 1.0 / this.targetWeights.length;
        return this.targetWeights.map(t => ({
          ...t,
          weight: equalWeight,
          targetValue: availableValue * equalWeight,
        }));

      case 'target_weight':
        return this.targetWeights.map(t => ({
          ...t,
          targetValue: availableValue * t.weight,
        }));

      case 'risk_parity':
        // Simplified risk parity: inverse volatility weighting
        // In real implementation, would calculate actual volatility
        const riskAdjusted = this.targetWeights.map(t => ({
          ...t,
          adjustedWeight: 1.0 / this.targetWeights.length, // Simplified
        }));
        const totalAdjusted = riskAdjusted.reduce((sum, t) => sum + t.adjustedWeight, 0);
        return riskAdjusted.map(t => ({
          ...t,
          weight: t.adjustedWeight / totalAdjusted,
          targetValue: availableValue * (t.adjustedWeight / totalAdjusted),
        }));

      case 'minimum_variance':
        // Simplified minimum variance: equal weight as fallback
        return this.targetWeights.map(t => ({
          ...t,
          targetValue: availableValue * t.weight,
        }));

      case 'custom':
        return this.targetWeights.map(t => ({
          ...t,
          targetValue: availableValue * t.weight,
        }));

      default:
        return this.targetWeights.map(t => ({
          ...t,
          targetValue: availableValue * t.weight,
        }));
    }
  }

  executeRebalance(totalValue: number, triggerType?: TriggerType): RebalanceResult {
    const trigger = triggerType || this.mapModeToTrigger();
    
    const beforeWeights = new Map<string, number>();
    this.positions.forEach((p, code) => {
      beforeWeights.set(code, p.weight);
    });

    const orders = this.calculateRebalanceOrders(totalValue);
    const driftBefore = this.calculateDrift();

    // Simulate order execution
    for (const order of orders) {
      const position = this.positions.get(order.code);
      if (order.side === 'BUY') {
        const newQuantity = (position?.quantity || 0) + order.quantity;
        const newPrice = order.price;
        const newValue = newQuantity * newPrice;
        this.positions.set(order.code, {
          code: order.code,
          quantity: newQuantity,
          currentPrice: newPrice,
          marketValue: newValue,
          weight: newValue / totalValue,
        });
      } else {
        if (position) {
          const newQuantity = position.quantity - order.quantity;
          if (newQuantity > 0) {
            const newValue = newQuantity * position.currentPrice;
            this.positions.set(order.code, {
              ...position,
              quantity: newQuantity,
              marketValue: newValue,
              weight: newValue / totalValue,
            });
          } else {
            this.positions.delete(order.code);
          }
        }
      }
    }

    const afterWeights = new Map<string, number>();
    this.positions.forEach((p, code) => {
      afterWeights.set(code, p.weight);
    });

    const driftAfter = this.calculateDrift();
    const driftCorrected = driftBefore - driftAfter;
    const totalCost = orders.reduce((sum, o) => sum + o.estimatedCost, 0);

    const result: RebalanceResult = {
      timestamp: Date.now(),
      totalValue,
      orders,
      beforeWeights,
      afterWeights,
      driftBefore,
      driftAfter,
      driftCorrected,
      totalCost,
      triggerType: trigger,
      strategy: this.config.strategy,
    };

    this.rebalanceHistory.push(result);
    this.lastRebalanceTime = Date.now();

    log.info(`[RebalanceEngine] Rebalance executed: ${orders.length} orders, drift corrected: ${driftCorrected.toFixed(2)}%`);
    this.emit('rebalance:executed', result);

    return result;
  }

  // ── Periodic Rebalance ─────────────────────────────────────────────────

  startPeriodicRebalance(): void {
    if (this.periodicTimer) return;
    
    const intervalMs = this.config.periodicIntervalDays * 24 * 60 * 60 * 1000;
    this.periodicTimer = setInterval(() => {
      if (this.shouldRebalance('periodic')) {
        log.info('[RebalanceEngine] Periodic rebalance triggered');
        this.emit('rebalance:triggered', { triggerType: 'periodic' });
      }
    }, intervalMs);
    
    log.info(`[RebalanceEngine] Periodic rebalance started (interval: ${this.config.periodicIntervalDays} days)`);
  }

  stopPeriodicRebalance(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
      log.info('[RebalanceEngine] Periodic rebalance stopped');
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getRebalanceHistory(limit?: number): RebalanceResult[] {
    const sorted = [...this.rebalanceHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getStats(): RebalanceStats {
    const totalRebalances = this.rebalanceHistory.length;
    const avgDriftBefore = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => sum + r.driftBefore, 0) / this.rebalanceHistory.length
      : 0;

    const avgDriftAfter = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => sum + r.driftAfter, 0) / this.rebalanceHistory.length
      : 0;

    const avgOrdersPerRebalance = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => sum + r.orders.length, 0) / this.rebalanceHistory.length
      : 0;

    const totalRebalanceCost = this.rebalanceHistory.reduce((sum, r) => sum + r.totalCost, 0);

    const avgTurnoverPct = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => {
          const turnover = r.orders.reduce((s, o) => s + o.estimatedCost, 0) / r.totalValue * 100;
          return sum + turnover;
        }, 0) / this.rebalanceHistory.length
      : 0;

    const rebalancesByStrategy: Record<RebalanceStrategy, number> = {
      equal_weight: 0, target_weight: 0, risk_parity: 0, minimum_variance: 0, custom: 0,
    };
    this.rebalanceHistory.forEach(r => {
      rebalancesByStrategy[r.strategy] = (rebalancesByStrategy[r.strategy] || 0) + 1;
    });

    const rebalancesByTrigger: Record<TriggerType, number> = {
      periodic: 0, threshold: 0, signal: 0, manual: 0,
    };
    this.rebalanceHistory.forEach(r => {
      rebalancesByTrigger[r.triggerType] = (rebalancesByTrigger[r.triggerType] || 0) + 1;
    });

    return {
      totalRebalances,
      avgDriftBefore,
      avgDriftAfter,
      avgOrdersPerRebalance,
      lastRebalanceTime: this.lastRebalanceTime,
      totalRebalanceCost,
      avgTurnoverPct,
      rebalancesByStrategy,
      rebalancesByTrigger,
    };
  }

  // ── Control ────────────────────────────────────────────────────────────

  updateConfig(config: Partial<RebalanceConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('[RebalanceEngine] Config updated');
    this.emit('config:updated', this.config);
  }

  getConfig(): RebalanceConfig {
    return { ...this.config };
  }

  clearHistory(): void {
    this.rebalanceHistory = [];
    log.info('[RebalanceEngine] History cleared');
    this.emit('history:cleared');
  }

  destroy(): void {
    this.stopPeriodicRebalance();
    this.removeAllListeners();
    log.info('[RebalanceEngine] Destroyed');
  }
}
