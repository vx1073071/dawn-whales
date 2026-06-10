// ── Q22: Portfolio Rebalancer ────────────────────────────────────────────────
// Periodically rebalance portfolio to target weights
// Kelly-optimized position sizing, collision detection, threshold-driven triggers

import { EventEmitter } from 'events';
import log from 'electron-log';
import { getKellyFraction } from './dynamic-sizer';
import type { LivePosition } from '../analysis/live-executor';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ───────────────────────────────────────────────────────────────────

export interface TargetWeight {
  strategyId: string;
  targetPct: number;      // 0-1, must sum to 1.0 across all targets
  symbol?: string;        // Optional: for single-symbol targets
}

export interface RebalanceConfig {
  targets: TargetWeight[];
  thresholdPct: number;   // 0.05 = rebalance when any weight drifts >5%
  frequency: 'daily' | 'weekly' | 'monthly';
  maxTurnoverPct: number; // 0.20 = max 20% portfolio turnover per rebalance
  useKelly: boolean;      // Apply Kelly criterion to sizes
  dryRun: boolean;        // Preview without executing
}

export interface DriftItem {
  strategyId: string;
  currentPct: number;
  targetPct: number;
  driftPct: number;       // absolute drift
  driftDirection: 'overweight' | 'underweight' | 'on_target';
  suggestedAction: 'BUY' | 'SELL' | 'HOLD';
  sharesToTrade: number;
  estimatedCost: number;
}

export interface RebalancePlan {
  timestamp: number;
  totalValue: number;
  drifts: DriftItem[];
  trades: RebalanceTrade[];
  turnoverPct: number;
  kellyCap: number;       // Kelly-capped total leverage
  warnings: string[];
  dryRun: boolean;
}

export interface RebalanceTrade {
  strategyId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  shares: number;
  price: number;
  estimatedCost: number;
  reason: string;
}

export interface RebalanceResult {
  success: boolean;
  plan: RebalancePlan;
  executedTrades: RebalanceTrade[];
  newWeights: Array<{ strategyId: string; weight: number }>;
  error?: string;
}

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RebalanceConfig = {
  targets: [],
  thresholdPct: 0.05,
  frequency: 'weekly',
  maxTurnoverPct: 0.20,
  useKelly: true,
  dryRun: false,
};

// ── Portfolio Rebalancer ────────────────────────────────────────────────────

export class PortfolioRebalancer extends EventEmitter {
  private config: RebalanceConfig;
  private lastRebalanceTime: number = 0;
  private lastWeights: Map<string, number> = new Map();

  constructor(config?: Partial<RebalanceConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[PortfolioRebalancer] Initialized', {
      threshold: (this.config.thresholdPct * 100).toFixed(0) + '%',
      useKelly: this.config.useKelly,
      dryRun: this.config.dryRun,
    });
  }

  // ── Config ───────────────────────────────────────────────────────────────

  updateTargets(targets: TargetWeight[]): void {
    const total = targets.reduce((sum, t) => sum + t.targetPct, 0);
    if (Math.abs(total - 1.0) > 0.001) {
      throw new EngineError(ErrorCode.PORTFOLIO_CALC_FAILED, `Target weights must sum to 1.0, got ${total.toFixed(4)}`);
    }
    this.config.targets = targets;
    log.info('[PortfolioRebalancer] Targets updated:', targets.map(t => `${t.strategyId}=${(t.targetPct*100).toFixed(0)}%`));
  }

  setDryRun(dryRun: boolean): void {
    this.config.dryRun = dryRun;
  }

  // ── Core: Compute Drift ────────────────────────────────────────────────

  computeDrift(positions: LivePosition[], totalValue: number): DriftItem[] {
    const currentWeights = new Map<string, number>();

    for (const pos of positions) {
      const value = pos.quantity * pos.avgCost;
      currentWeights.set(pos.strategyId, value / totalValue);
    }

    const drifts: DriftItem[] = [];

    for (const target of this.config.targets) {
      const current = currentWeights.get(target.strategyId) ?? 0;
      const drift = current - target.targetPct;
      const absDrift = Math.abs(drift);

      let direction: DriftItem['driftDirection'];
      let action: RebalanceItem['suggestedAction'];

      if (absDrift < 0.01) {
        direction = 'on_target';
        action = 'HOLD';
      } else if (drift > 0) {
        direction = 'overweight';
        action = 'SELL';
      } else {
        direction = 'underweight';
        action = 'BUY';
      }

      const pos = positions.find(p => p.strategyId === target.strategyId);
      const price = pos?.avgCost ?? 0;
      const currentValue = current * totalValue;
      const targetValue = target.targetPct * totalValue;
      const diffValue = Math.abs(targetValue - currentValue);
      const sharesToTrade = price > 0 ? Math.round(diffValue / price) : 0;
      const estimatedCost = sharesToTrade * price * 0.0003; // Commission

      drifts.push({
        strategyId: target.strategyId,
        currentPct: Math.round(current * 10000) / 100,
        targetPct: Math.round(target.targetPct * 10000) / 100,
        driftPct: Math.round(absDrift * 10000) / 100,
        driftDirection: direction,
        suggestedAction: action,
        sharesToTrade,
        estimatedCost,
      } as DriftItem);
    }

    return drifts;
  }

  // ── Core: Build Rebalance Plan ─────────────────────────────────────────

  buildPlan(positions: LivePosition[], totalValue: number, currentPrices?: Map<string, number>): RebalancePlan {
    const drifts = this.computeDrift(positions, totalValue);
    const warnings: string[] = [];

    // Filter to only significant drifts
    const actionable = drifts.filter(d => d.driftPct >= this.config.thresholdPct * 100);

    // Sort by drift magnitude (largest first)
    actionable.sort((a, b) => b.driftPct - a.driftPct);

    // Build trades
    const trades: RebalanceTrade[] = [];
    let totalTurnover = 0;

    for (const drift of actionable) {
      const target = this.config.targets.find(t => t.strategyId === drift.strategyId)!;
      const pos = positions.find(p => p.strategyId === drift.strategyId);
      const price = currentPrices?.get(drift.strategyId) ?? pos?.avgCost ?? 0;

      if (price <= 0) {
        warnings.push(`${drift.strategyId}: no price data, skip`);
        continue;
      }

      const targetValue = target.targetPct * totalValue;
      const currentValue = (drift.currentPct / 100) * totalValue;
      const diffValue = targetValue - currentValue;
      const shares = Math.round(Math.abs(diffValue) / price);

      if (shares === 0) continue;

      // Turnover check
      const tradeValue = shares * price;
      const newTurnover = totalTurnover + tradeValue / totalValue;

      if (newTurnover > this.config.maxTurnoverPct) {
        warnings.push(`${drift.strategyId}: trade blocked by maxTurnoverPct (${(newTurnover * 100).toFixed(1)}% > ${(this.config.maxTurnoverPct * 100).toFixed(0)}%)`);
        continue;
      }

      trades.push({
        strategyId: drift.strategyId,
        symbol: pos?.symbol || drift.strategyId,
        side: drift.suggestedAction === 'HOLD' ? 'BUY' : drift.suggestedAction as 'BUY' | 'SELL',
        shares,
        price,
        estimatedCost: tradeValue * 0.0003,
        reason: `${drift.driftDirection} ${drift.driftPct.toFixed(1)}% (target ${(target.targetPct * 100).toFixed(1)}%, current ${drift.currentPct.toFixed(1)}%)`,
      });

      totalTurnover += tradeValue / totalValue;
    }

    // Kelly cap
    const kellyCap = this.config.useKelly
      ? getKellyFraction(this.config.targets.map(t => ({ strategyId: t.strategyId, weight: t.targetPct })))
      : 1.0;

    return {
      timestamp: Date.now(),
      totalValue,
      drifts: actionable,
      trades,
      turnoverPct: Math.round(totalTurnover * 10000) / 100,
      kellyCap,
      warnings,
      dryRun: this.config.dryRun,
    };
  }

  // ── Rebalance ─────────────────────────────────────────────────────────

  rebalance(
    positions: LivePosition[],
    totalValue: number,
    currentPrices?: Map<string, number>
  ): RebalanceResult {
    log.info(`[PortfolioRebalancer] Rebalancing ${positions.length} positions, total ¥${totalValue.toFixed(2)}`);

    const plan = this.buildPlan(positions, totalValue, currentPrices);

    // Log summary
    log.info(`[PortfolioRebalancer] Plan: ${plan.trades.length} trades, turnover ${plan.turnoverPct.toFixed(2)}%, ${plan.warnings.length} warnings`);

    if (plan.dryRun) {
      log.info('[PortfolioRebalancer] Dry-run mode - no trades executed');
      return { success: true, plan, executedTrades: [], newWeights: [] };
    }

    // Execute trades (return trade list for broker to execute)
    this.lastRebalanceTime = Date.now();
    this.lastWeights.clear();
    for (const trade of plan.trades) {
      const pos = positions.find(p => p.strategyId === trade.strategyId);
      const newWeight = pos
        ? (pos.quantity + (trade.side === 'BUY' ? trade.shares : -trade.shares)) * trade.price / totalValue
        : trade.targetPct;
      this.lastWeights.set(trade.strategyId, newWeight);
    }

    this.emit('rebalancer:plan', plan);

    const newWeights = this.config.targets.map(t => ({
      strategyId: t.strategyId,
      weight: this.lastWeights.get(t.strategyId) ?? t.targetPct,
    }));

    return {
      success: true,
      plan,
      executedTrades: plan.trades,
      newWeights,
    };
  }

  // ── Trigger Check ─────────────────────────────────────────────────────

  needsRebalance(positions: LivePosition[], totalValue: number): boolean {
    if (this.config.targets.length === 0) return false;
    if (positions.length === 0) return false;

    const drifts = this.computeDrift(positions, totalValue);
    const maxDrift = Math.max(...drifts.map(d => d.driftPct), 0);

    return maxDrift >= this.config.thresholdPct * 100;
  }

  // ── Frequency Check ────────────────────────────────────────────────────

  shouldRun(): boolean {
    const now = Date.now();
    const since = now - this.lastRebalanceTime;

    switch (this.config.frequency) {
      case 'daily':
        return since > 24 * 60 * 60 * 1000;
      case 'weekly':
        return since > 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return since > 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  getStatus(): { lastRebalance: number; config: RebalanceConfig } {
    return {
      lastRebalance: this.lastRebalanceTime,
      config: this.config,
    };
  }
}

// ── RebalanceItem type alias ────────────────────────────────────────────────

type RebalanceItem = DriftItem;

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: PortfolioRebalancer | null = null;

export function getPortfolioRebalancer(): PortfolioRebalancer {
  if (!instance) instance = new PortfolioRebalancer();
  return instance;
}

export default PortfolioRebalancer;
