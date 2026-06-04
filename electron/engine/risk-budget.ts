// ── Q30: Risk Budget Allocator ────────────────────────────────────────────────
// VaR/CVaR decomposition by strategy and asset
// Risk budget quotas with limit monitoring and risk-weighted scoring

import log from 'electron-log';
import type { LivePosition } from './live-executor';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskBudgetUnit {
  unitId: string;           // Strategy ID or asset
  unitType: 'strategy' | 'asset' | 'sector';
  allocation: number;       // HKD budget
  used: number;             // Currently used (VaR)
  available: number;         // allocation - used
  utilizationPct: number;  // 0-100%
  status: 'GREEN' | 'YELLOW' | 'RED' | 'BREACH';
  performanceScore: number; // Risk-adjusted return
}

export interface RiskBudgetReport {
  totalBudget: number;
  totalUsed: number;
  totalAvailable: number;
  utilizationPct: number;
  overallStatus: 'GREEN' | 'YELLOW' | 'RED' | 'BREACH';

  units: RiskBudgetUnit[];
  breachingUnits: string[];
  warnings: string[];

  // Risk-adjusted scoring
  riskWeightedReturn: number;
  bestUnit: string;
  worstUnit: string;
  timestamp: number;
}

export interface RiskBudgetConfig {
  totalBudget: number;      // Total portfolio risk budget (VaR limit)
  warningThreshold: number; // 70% → YELLOW
  dangerThreshold: number;  // 90% → RED
  breachThreshold: number;  // 100% → BREACH
  lookbackDays: number;     // For VaR calculation
  confidenceLevel: number; // 0.95 default
}

// ── Thresholds ────────────────────────────────────────────────────────────

const STATUS_THRESHOLDS = { GREEN: 70, YELLOW: 90, RED: 100 };

// ── Risk Budget Allocator ──────────────────────────────────────────────────

export class RiskBudgetAllocator {
  private config: RiskBudgetConfig;

  constructor(config?: Partial<RiskBudgetConfig>) {
    this.config = {
      totalBudget: 1000000, // ¥1M default
      warningThreshold: 70,
      dangerThreshold: 90,
      breachThreshold: 100,
      lookbackDays: 20,
      confidenceLevel: 0.95,
      ...config,
    };
    log.info('[RiskBudgetAllocator] Initialized', this.config);
  }

  // ── Calculate Unit Risk ─────────────────────────────────────────────

  calcUnitVaR(position: LivePosition, lookbackDays = 20): number {
    // Simplified: use position value × vol percentile × z-score
    const vol = 0.02; // Placeholder: 2% daily vol
    const zScore = 1.65; // 95% confidence
    const value = position.quantity * position.avgCost;
    return Math.abs(value) * vol * zScore * Math.sqrt(lookbackDays);
  }

  // ── Allocate Budget ─────────────────────────────────────────────────

  allocate(
    positions: LivePosition[],
    perfScores: Record<string, number>,  // unitId → risk-adj return
    overrideBudget?: Record<string, number>
  ): RiskBudgetReport {
    const units: RiskBudgetUnit[] = [];
    const totalValue = positions.reduce((s, p) => s + p.quantity * p.avgCost, 0) || 1;

    // Group by strategy
    const byStrategy = new Map<string, LivePosition[]>();
    for (const pos of positions) {
      const arr = byStrategy.get(pos.strategyId) ?? [];
      arr.push(pos);
      byStrategy.set(pos.strategyId, arr);
    }

    let totalUsed = 0;
    const breachingUnits: string[] = [];
    const warnings: string[] = [];

    for (const [unitId, posList] of byStrategy) {
      const value = posList.reduce((s, p) => s + p.quantity * p.avgCost, 0);
      const baseBudget = overrideBudget?.[unitId] ?? totalValue * 0.15; // 15% default per strategy
      const used = this.calcUnitVaR(posList[0], this.config.lookbackDays);
      const available = baseBudget - used;
      const utilPct = baseBudget > 0 ? (used / baseBudget) * 100 : 0;
      totalUsed += used;

      let status: RiskBudgetUnit['status'];
      if (utilPct >= 100) status = 'BREACH';
      else if (utilPct >= 90) status = 'RED';
      else if (utilPct >= 70) status = 'YELLOW';
      else status = 'GREEN';

      const unit: RiskBudgetUnit = {
        unitId,
        unitType: 'strategy',
        allocation: Math.round(baseBudget * 100) / 100,
        used: Math.round(used * 100) / 100,
        available: Math.round(available * 100) / 100,
        utilizationPct: Math.round(utilPct * 100) / 100,
        status,
        performanceScore: perfScores[unitId] ?? 0,
      };

      units.push(unit);
      if (status === 'BREACH') breachingUnits.push(unitId);
      if (status === 'RED') warnings.push(`⚠️ ${unitId}: RED (${utilPct.toFixed(1)}% utilized)`);
      if (status === 'YELLOW') warnings.push(`⚡ ${unitId}: YELLOW (${utilPct.toFixed(1)}% utilized)`);
    }

    const totalAvailable = this.config.totalBudget - totalUsed;
    const utilizationPct = (totalUsed / this.config.totalBudget) * 100;

    let overallStatus: RiskBudgetReport['overallStatus'];
    if (utilizationPct >= 100) overallStatus = 'BREACH';
    else if (utilizationPct >= 90) overallStatus = 'RED';
    else if (utilizationPct >= 70) overallStatus = 'YELLOW';
    else overallStatus = 'GREEN';

    // Risk-weighted return
    const riskWeightedReturn = units.reduce((s, u) =>
      s + u.performanceScore / Math.max(u.utilizationPct, 1), 0
    ) / Math.max(units.length, 1);

    const bestUnit = units.reduce((best, u) =>
      u.performanceScore > (best?.performanceScore ?? -Infinity) ? u : best
    , units[0])?.unitId ?? 'none';
    const worstUnit = units.reduce((worst, u) =>
      u.performanceScore < (worst?.performanceScore ?? Infinity) ? u : worst
    , units[0])?.unitId ?? 'none';

    if (overallStatus === 'BREACH') {
      warnings.unshift(`🚨 BREACH: Total risk utilization ${utilizationPct.toFixed(1)}% exceeds budget!`);
    }

    return {
      totalBudget: Math.round(this.config.totalBudget * 100) / 100,
      totalUsed: Math.round(totalUsed * 100) / 100,
      totalAvailable: Math.round(totalAvailable * 100) / 100,
      utilizationPct: Math.round(utilizationPct * 100) / 100,
      overallStatus,
      units,
      breachingUnits,
      warnings,
      riskWeightedReturn: Math.round(riskWeightedReturn * 100) / 100,
      bestUnit,
      worstUnit,
      timestamp: Date.now(),
    };
  }

  // ── Suggest Rebalancing ─────────────────────────────────────────────

  suggestRebalance(report: RiskBudgetReport): Array<{
    action: 'REDUCE' | 'INCREASE' | 'HOLD';
    unitId: string;
    targetAllocation: number;
    currentAllocation: number;
    reason: string;
  }> {
    const suggestions = [];
    for (const unit of report.units) {
      if (unit.status === 'BREACH' || unit.status === 'RED') {
        suggestions.push({
          action: 'REDUCE' as const,
          unitId: unit.unitId,
          targetAllocation: unit.allocation * 0.7,
          currentAllocation: unit.allocation,
          reason: `${unit.status}: ${unit.utilizationPct.toFixed(1)}% utilization`,
        });
      } else if (unit.status === 'GREEN' && unit.performanceScore > 0.1) {
        suggestions.push({
          action: 'INCREASE' as const,
          unitId: unit.unitId,
          targetAllocation: unit.allocation * 1.2,
          currentAllocation: unit.allocation,
          reason: `Strong performance (${unit.performanceScore.toFixed(2)}) with low risk`,
        });
      } else {
        suggestions.push({
          action: 'HOLD' as const,
          unitId: unit.unitId,
          targetAllocation: unit.allocation,
          currentAllocation: unit.allocation,
          reason: `Normal utilization (${unit.status})`,
        });
      }
    }
    return suggestions;
  }

  getStatus(): RiskBudgetConfig {
    return { ...this.config };
  }
}

export default RiskBudgetAllocator;