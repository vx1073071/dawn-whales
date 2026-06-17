/**
 * R266: CostBasisPushBridge — 成本线→推送IPC桥接
 * 
 * 功能:
 *   1. 持仓成本线实时追踪 (均价/持仓天数/浮动盈亏)
 *   2. 盈亏里程碑推送 (+10%/+30%/+50%/-5%/-10%)
 *   3. 成本线穿越提醒 (价格回到成本线)
 *   4. 盈亏比例实时计算 + 持有天数统计
 *   5. 推送对接 push-ipc-bridge
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Position {
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  avgCost: number;            // average entry price
  quantity: number;
  entryDate: number;          // Unix ms
  currentPrice: number;       // latest price
  pnl: number;                // absolute P&L
  pnlPercent: number;         // P&L %
  holdingDays: number;
  costLine: number;           // cost basis line
  breakEvenPrice: number;     // break-even (cost + fees)
  milestoneHits: MilestoneHit[];
  lastUpdate: number;
}

export interface MilestoneHit {
  milestone: string;
  milestoneCn: string;
  level: number;            // +10, +30, -5, etc
  hitAt: number;
  hitPrice: number;
  pushSent: boolean;
}

export interface CostBasisAlert {
  alertId: string;
  positionId: string;
  symbol: string;
  type: CostAlertType;
  price: number;
  message: string;
  messageCn: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  timestamp: number;
  pushSent: boolean;
}

export type CostAlertType =
  | 'cost_line_cross_up'     // price crosses above cost
  | 'cost_line_cross_down'   // price crosses below cost
  | 'milestone_profit_10'    // +10%
  | 'milestone_profit_30'    // +30%
  | 'milestone_profit_50'    // +50%
  | 'milestone_profit_100'   // +100% (double)
  | 'milestone_loss_5'       // -5%
  | 'milestone_loss_10'      // -10%
  | 'milestone_loss_20'      // -20% stop-loss
  | 'breakeven_reached';     // reaches break-even

export interface CostBasisSummary {
  symbol: string;
  totalPositions: number;
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgHoldingDays: number;
  winningPositions: number;
  losingPositions: number;
}

// ── Milestone definitions ──────────────────────────────────────────────────

const PROFIT_MILESTONES = [
  { level: 10, type: 'milestone_profit_10' as CostAlertType, label: '+10% Profit', labelCn: '盈利10%', severity: 'success' as const },
  { level: 30, type: 'milestone_profit_30' as CostAlertType, label: '+30% Profit', labelCn: '盈利30%', severity: 'success' as const },
  { level: 50, type: 'milestone_profit_50' as CostAlertType, label: '+50% Profit', labelCn: '盈利50%', severity: 'success' as const },
  { level: 100, type: 'milestone_profit_100' as CostAlertType, label: '+100% Doubled!', labelCn: '翻倍100%！', severity: 'success' as const },
];

const LOSS_MILESTONES = [
  { level: -5, type: 'milestone_loss_5' as CostAlertType, label: '-5% Loss', labelCn: '亏损5%', severity: 'warning' as const },
  { level: -10, type: 'milestone_loss_10' as CostAlertType, label: '-10% Stop-Loss', labelCn: '止损-10%', severity: 'critical' as const },
  { level: -20, type: 'milestone_loss_20' as CostAlertType, label: '-20% Deep Loss', labelCn: '深跌-20%', severity: 'critical' as const },
];

// ═══════════════════════════════════════════════════════════════════════════
// CostBasisPushBridge
// ═══════════════════════════════════════════════════════════════════════════

export class CostBasisPushBridge {
  private positions: Map<string, Position> = new Map();
  private alerts: CostBasisAlert[] = [];
  private stats_ = { totalPositions: 0, totalAlerts: 0, milestonesHit: 0 };

  constructor() {}

  // ── Public API: Position Management ─────────────────────────────────────

  /**
   * Register a new position for cost tracking.
   */
  registerPosition(params: {
    positionId: string;
    symbol: string;
    side: 'long' | 'short';
    avgCost: number;
    quantity: number;
    entryDate: number;
    currentPrice?: number;
    breakEvenPrice?: number;
  }): Position {
    const currentPrice = params.currentPrice ?? params.avgCost;
    const pnl = (currentPrice - params.avgCost) * params.quantity * (params.side === 'short' ? -1 : 1);
    const pnlPercent = params.avgCost > 0
      ? +(((currentPrice - params.avgCost) / params.avgCost * 100) * (params.side === 'short' ? -1 : 1)).toFixed(2)
      : 0;
    const holdingDays = Math.max(1, Math.ceil((Date.now() - params.entryDate) / 86400000));

    const position: Position = {
      positionId: params.positionId,
      symbol: params.symbol,
      side: params.side,
      avgCost: params.avgCost,
      quantity: params.quantity,
      entryDate: params.entryDate,
      currentPrice,
      pnl,
      pnlPercent,
      holdingDays,
      costLine: params.avgCost,
      breakEvenPrice: params.breakEvenPrice ?? params.avgCost * 1.001, // +0.1% fees
      milestoneHits: [],
      lastUpdate: Date.now(),
    };

    this.positions.set(params.positionId, position);
    this.stats_.totalPositions++;
    return position;
  }

  /**
   * Update position with latest price → returns any triggered alerts.
   */
  updatePrice(params: {
    positionId: string;
    currentPrice: number;
  }): { position: Position | null; alerts: CostBasisAlert[] } {
    const position = this.positions.get(params.positionId);
    if (!position) return { position: null, alerts: [] };

    const prevPrice = position.currentPrice;
    position.currentPrice = params.currentPrice;
    position.pnl = (params.currentPrice - position.avgCost) * position.quantity * (position.side === 'short' ? -1 : 1);
    position.pnlPercent = +(position.pnlPercent = position.avgCost > 0
      ? +(((params.currentPrice - position.avgCost) / position.avgCost * 100) * (position.side === 'short' ? -1 : 1)).toFixed(2)
      : 0);
    position.holdingDays = Math.max(1, Math.ceil((Date.now() - position.entryDate) / 86400000));
    position.lastUpdate = Date.now();

    const newAlerts = this._checkAlerts(position, prevPrice);
    this.alerts.push(...newAlerts);
    if (this.alerts.length > 500) this.alerts = this.alerts.slice(-300);
    this.stats_.totalAlerts += newAlerts.length;

    return { position, alerts: newAlerts };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get position */
  getPosition(positionId: string): Position | null {
    return this.positions.get(positionId) ?? null;
  }

  /** Get all positions for a symbol */
  getPositionsBySymbol(symbol: string): Position[] {
    return Array.from(this.positions.values()).filter(p => p.symbol === symbol);
  }

  /** Get all positions */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /** Get pending alerts (not yet pushed) */
  getPendingAlerts(limit = 20): CostBasisAlert[] {
    return this.alerts.filter(a => !a.pushSent).slice(-limit).reverse();
  }

  /** Mark alert as pushed */
  markPushSent(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (!alert) return false;
    alert.pushSent = true;
    return true;
  }

  /** Generate summary for a symbol */
  getSummary(symbol: string): CostBasisSummary | null {
    const positions = this.getPositionsBySymbol(symbol);
    if (positions.length === 0) return null;

    const totalCost = positions.reduce((s, p) => s + p.avgCost * p.quantity, 0);
    const totalValue = positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
    const winning = positions.filter(p => p.pnl > 0).length;

    return {
      symbol,
      totalPositions: positions.length,
      totalCost,
      totalValue,
      totalPnl: totalValue - totalCost,
      totalPnlPercent: totalCost > 0 ? +((totalValue - totalCost) / totalCost * 100).toFixed(2) : 0,
      avgHoldingDays: Math.round(positions.reduce((s, p) => s + p.holdingDays, 0) / positions.length),
      winningPositions: winning,
      losingPositions: positions.length - winning,
    };
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset position */
  removePosition(positionId: string): void {
    this.positions.delete(positionId);
  }

  /** Reset all */
  reset(): void {
    this.positions.clear();
    this.alerts = [];
    this.stats_ = { totalPositions: 0, totalAlerts: 0, milestonesHit: 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _checkAlerts(position: Position, prevPrice: number): CostBasisAlert[] {
    const alerts: CostBasisAlert[] = [];
    const now = Date.now();
    const current = position.currentPrice;
    const cost = position.avgCost;

    // Cost line cross detection (price crosses above/below cost)
    const prevAboveCost = prevPrice > cost;
    const nowAboveCost = current > cost;
    if (prevAboveCost !== nowAboveCost) {
      const alertType: CostAlertType = nowAboveCost ? 'cost_line_cross_up' : 'cost_line_cross_down';
      const icon = nowAboveCost ? '🟢' : '🔴';

      alerts.push({
        alertId: `cba:${position.positionId}:cost_cross:${now}`,
        positionId: position.positionId,
        symbol: position.symbol,
        type: alertType,
        price: current,
        message: `${icon} [${position.symbol}] Price crossed ${nowAboveCost ? 'above' : 'below'} cost @ $${current}`,
        messageCn: `${icon} [${position.symbol}] 价格${nowAboveCost ? '突破成本线' : '跌破成本线'} @ ${current}`,
        severity: nowAboveCost ? 'info' : 'warning',
        timestamp: now,
        pushSent: false,
      });
    }

    // Check milestone hits
    const allMilestones = [
      ...PROFIT_MILESTONES.map(m => ({ ...m, direction: 1 })),
      ...LOSS_MILESTONES.map(m => ({ ...m, direction: -1 })),
    ];

    for (const ms of allMilestones) {
      const prevPct = position.avgCost > 0
        ? ((prevPrice - cost) / cost * 100) * (position.side === 'short' ? -1 : 1)
        : 0;
      const currentPct = position.pnlPercent;

      // Check if threshold was just crossed
      const prevHit = Math.abs(prevPct) >= Math.abs(ms.level) && prevPct * ms.direction > 0;
      const nowHit = Math.abs(currentPct) >= Math.abs(ms.level) && currentPct * ms.direction > 0;
      const justCrossed = !prevHit && nowHit;

      // Check if already hit this milestone for this position
      const alreadyHit = position.milestoneHits.some(h => h.milestone === ms.type);

      if (justCrossed && !alreadyHit) {
        // Record milestone hit
        position.milestoneHits.push({
          milestone: ms.type,
          milestoneCn: ms.labelCn,
          level: ms.level,
          hitAt: now,
          hitPrice: current,
          pushSent: false,
        });
        this.stats_.milestonesHit++;

        alerts.push({
          alertId: `cba:${position.positionId}:ms:${ms.type}:${now}`,
          positionId: position.positionId,
          symbol: position.symbol,
          type: ms.type,
          price: current,
          message: `[${position.symbol}] ${ms.label} reached @ $${current} (${position.holdingDays}d hold)`,
          messageCn: `[${position.symbol}] ${ms.labelCn}达成 @ ${current} (持有${position.holdingDays}天)`,
          severity: ms.severity,
          timestamp: now,
          pushSent: false,
        });
      }
    }

    // Breakeven check
    if (position.breakEvenPrice !== position.avgCost) {
      const prevAboveBE = prevPrice > position.breakEvenPrice;
      const nowAboveBE = current > position.breakEvenPrice;
      if (prevAboveBE !== nowAboveBE && nowAboveBE && current < position.breakEvenPrice * 1.01) {
        alerts.push({
          alertId: `cba:${position.positionId}:be:${now}`,
          positionId: position.positionId,
          symbol: position.symbol,
          type: 'breakeven_reached',
          price: current,
          message: `[${position.symbol}] Break-even reached @ $${current}`,
          messageCn: `[${position.symbol}] 回到成本线 @ ${current}`,
          severity: 'info',
          timestamp: now,
          pushSent: false,
        });
      }
    }

    return alerts;
  }
}

export const costBasisPushBridge = new CostBasisPushBridge();
