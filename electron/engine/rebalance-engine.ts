/**
 * Rebalance Engine - 投资组合再平衡引擎
 * 根据目标权重自动调整持仓
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type RebalanceMode = 'threshold' | 'periodic' | 'drift';
export type RebalanceStrategy = 'equal' | 'market_cap' | 'custom';

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
}

export interface RebalanceResult {
  timestamp: number;
  totalValue: number;
  orders: RebalanceOrder[];
  beforeWeights: Map<string, number>;
  afterWeights: Map<string, number>;
  driftCorrected: number;
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
}

export interface RebalanceStats {
  totalRebalances: number;
  avgDriftBefore: number;
  avgDriftAfter: number;
  avgOrdersPerRebalance: number;
  lastRebalanceTime: number;
  totalRebalanceCost: number;
}

// ── RebalanceEngine Class ──────────────────────────────────────────────────

export class RebalanceEngine {
  private config: RebalanceConfig;
  private targetWeights: TargetWeight[] = [];
  private positions: Map<string, Position> = new Map();
  private rebalanceHistory: RebalanceResult[] = [];
  private lastRebalanceTime: number = 0;

  constructor(config?: Partial<RebalanceConfig>) {
    this.config = {
      mode: 'threshold',
      strategy: 'equal',
      thresholdPct: 5,
      periodicIntervalDays: 30,
      minRebalanceAmount: 100,
      maxSlippagePct: 0.5,
      autoExecute: false,
      requireConfirmation: true,
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
  }

  getTargets(): TargetWeight[] {
    return [...this.targetWeights];
  }

  setEqualWeights(codes: string[]): void {
    const weight = 1.0 / codes.length;
    this.targetWeights = codes.map(code => ({ code, weight }));
    log.info(`[RebalanceEngine] Equal weights set: ${weight.toFixed(4)} for ${codes.length} assets`);
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

  // ── Rebalance Logic ────────────────────────────────────────────────────

  shouldRebalance(): boolean {
    if (this.config.mode === 'periodic') {
      const daysSinceLastRebalance = (Date.now() - this.lastRebalanceTime) / (1000 * 60 * 60 * 24);
      return daysSinceLastRebalance >= this.config.periodicIntervalDays;
    }

    if (this.config.mode === 'threshold') {
      return this.calculateDrift() > this.config.thresholdPct;
    }

    return false;
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

    for (const target of this.targetWeights) {
      const position = this.positions.get(target.code);
      const currentQuantity = position?.quantity || 0;
      const currentPrice = position?.currentPrice || 0;
      const targetValue = totalValue * target.weight;
      const targetQuantity = Math.round(targetValue / currentPrice);
      const quantityDiff = targetQuantity - currentQuantity;

      // Skip if below minimum rebalance amount
      if (Math.abs(quantityDiff * currentPrice) < this.config.minRebalanceAmount) {
        continue;
      }

      if (quantityDiff > 0) {
        orders.push({
          code: target.code,
          side: 'BUY',
          quantity: quantityDiff,
          targetQuantity,
          currentQuantity,
          price: currentPrice,
          reason: `Rebalance: target ${target.weight * 100}%, current ${((position?.weight || 0) * 100).toFixed(2)}%`,
        });
      } else if (quantityDiff < 0) {
        orders.push({
          code: target.code,
          side: 'SELL',
          quantity: Math.abs(quantityDiff),
          targetQuantity,
          currentQuantity,
          price: currentPrice,
          reason: `Rebalance: target ${target.weight * 100}%, current ${((position?.weight || 0) * 100).toFixed(2)}%`,
        });
      }
    }

    return orders;
  }

  executeRebalance(totalValue: number): RebalanceResult {
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

    const result: RebalanceResult = {
      timestamp: Date.now(),
      totalValue,
      orders,
      beforeWeights,
      afterWeights,
      driftCorrected,
    };

    this.rebalanceHistory.push(result);
    this.lastRebalanceTime = Date.now();

    log.info(`[RebalanceEngine] Rebalance executed: ${orders.length} orders, drift corrected: ${driftCorrected.toFixed(2)}%`);

    return result;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getRebalanceHistory(limit?: number): RebalanceResult[] {
    const sorted = [...this.rebalanceHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getStats(): RebalanceStats {
    const totalRebalances = this.rebalanceHistory.length;
    const avgDriftBefore = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => {
          const drift = Array.from(r.beforeWeights.entries()).reduce((s, [code, w]) => {
            const target = this.targetWeights.find(t => t.code === code);
            return s + Math.abs(w - (target?.weight || 0));
          }, 0) / this.targetWeights.length;
          return sum + drift;
        }, 0) / this.rebalanceHistory.length
      : 0;

    const avgDriftAfter = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => {
          const drift = Array.from(r.afterWeights.entries()).reduce((s, [code, w]) => {
            const target = this.targetWeights.find(t => t.code === code);
            return s + Math.abs(w - (target?.weight || 0));
          }, 0) / this.targetWeights.length;
          return sum + drift;
        }, 0) / this.rebalanceHistory.length
      : 0;

    const avgOrdersPerRebalance = this.rebalanceHistory.length > 0
      ? this.rebalanceHistory.reduce((sum, r) => sum + r.orders.length, 0) / this.rebalanceHistory.length
      : 0;

    const totalRebalanceCost = this.rebalanceHistory.reduce((sum, r) => {
      const cost = r.orders.reduce((s, o) => s + o.quantity * o.price * this.config.maxSlippagePct / 100, 0);
      return sum + cost;
    }, 0);

    return {
      totalRebalances,
      avgDriftBefore: avgDriftBefore * 100,
      avgDriftAfter: avgDriftAfter * 100,
      avgOrdersPerRebalance,
      lastRebalanceTime: this.lastRebalanceTime,
      totalRebalanceCost,
    };
  }

  // ── Control ────────────────────────────────────────────────────────────

  updateConfig(config: Partial<RebalanceConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('[RebalanceEngine] Config updated', this.config);
  }

  getConfig(): RebalanceConfig {
    return { ...this.config };
  }

  clearHistory(): void {
    this.rebalanceHistory = [];
    log.info('[RebalanceEngine] History cleared');
  }
}
