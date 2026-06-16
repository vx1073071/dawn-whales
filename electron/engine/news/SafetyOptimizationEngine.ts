/**
 * P2-18 SafetyOptimizationEngine — Safety Optimization Engine
 * R249 — P1 Closure Round
 * JVS / 引擎虾
 *
 * "保命优化" engine: monitors trading behavior and portfolio risk,
 * detects dangerous patterns, and provides actionable safety
 * recommendations. Covers position sizing, correlation concentration,
 * drawdown limits, leverage caps, and circuit breakers.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

export type RiskLevel = 'safe' | 'moderate' | 'elevated' | 'dangerous' | 'critical';

export type SafetyRuleType =
  | 'max_position_size'
  | 'max_leverage'
  | 'max_drawdown'
  | 'max_correlation'
  | 'max_concentration'
  | 'max_daily_trades'
  | 'min_win_rate'
  | 'max_single_loss'
  | 'circuit_breaker'
  | 'kill_switch';

export interface SafetyRule {
  id: string;
  type: SafetyRuleType;
  description: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  severity: RiskLevel;
  recommendation: string;
  lastChecked: number;
}

export interface PositionInfo {
  symbol: string;
  market: string;
  side: 'long' | 'short';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  notionalValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalEquity: number;
  totalNotional: number;
  cashBalance: number;
  margin: number;
  leverage: number;
  positions: PositionInfo[];
  totalUnrealizedPnl: number;
  dailyPnl: number;
  dailyTrades: number;
  winRate: number; // 0-1
  maxDrawdown: number; // percentage from peak
  currentDrawdown: number; // percentage from peak
}

export interface SafetyCheckResult {
  timestamp: number;
  portfolioValue: number;
  overallRisk: RiskLevel;
  rules: SafetyRule[];
  violations: SafetyRule[];
  recommendations: string[];
  /** Whether kill switch should be activated */
  killSwitchTriggered: boolean;
  /** Score 0-100 (0 = unsafe, 100 = perfectly safe) */
  safetyScore: number;
}

export interface SafetyConfig {
  maxPositionSizePct: number; // % of equity per position
  maxLeverage: number;
  maxDrawdownPct: number; // % from peak before forced stop
  maxCorrelation: number; // max avg pairwise correlation
  maxConcentrationPct: number; // max % in single sector/market
  maxDailyTrades: number;
  minWinRate: number; // minimum win rate before review
  maxSingleLossPct: number; // max loss per trade relative to equity
  circuitBreakerDrawdownPct: number; // immediate stop
  cooldownMinutes: number; // trading cooldown after big loss
}

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxPositionSizePct: 25,
  maxLeverage: 3,
  maxDrawdownPct: 30,
  maxCorrelation: 0.7,
  maxConcentrationPct: 50,
  maxDailyTrades: 20,
  minWinRate: 0.35,
  maxSingleLossPct: 5,
  circuitBreakerDrawdownPct: 10,
  cooldownMinutes: 30,
};

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class SafetyOptimizationEngine {
  private static instance: SafetyOptimizationEngine;

  private config: SafetyConfig = { ...DEFAULT_SAFETY_CONFIG };
  private snapshots: PortfolioSnapshot[] = [];
  private checkResults: SafetyCheckResult[] = [];
  private killSwitchActive = false;
  private killSwitchReason = '';
  private cooldownUntil = 0;
  private peakEquity = 0;
  private idCounter = 0;

  private constructor() {}

  static getInstance(): SafetyOptimizationEngine {
    if (!SafetyOptimizationEngine.instance) {
      SafetyOptimizationEngine.instance = new SafetyOptimizationEngine();
    }
    return SafetyOptimizationEngine.instance;
  }

  reset(): void {
    this.config = { ...DEFAULT_SAFETY_CONFIG };
    this.snapshots = [];
    this.checkResults = [];
    this.killSwitchActive = false;
    this.killSwitchReason = '';
    this.cooldownUntil = 0;
    this.peakEquity = 0;
    this.idCounter = 0;
  }

  private nextId(): string {
    return `safety-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Configuration
  // ═══════════════════════════════════════════════════════════════

  getConfig(): SafetyConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SafetyConfig>): SafetyConfig {
    Object.assign(this.config, updates);
    log.info(`[Safety] Config updated: ${JSON.stringify(updates)}`);
    return { ...this.config };
  }

  // ═══════════════════════════════════════════════════════════════
  // Portfolio Snapshot
  // ═══════════════════════════════════════════════════════════════

  snapshot(params: {
    totalEquity: number;
    cashBalance: number;
    margin: number;
    positions: PositionInfo[];
    dailyTrades: number;
    winRate: number;
  }): PortfolioSnapshot {
    const now = Date.now();

    const totalNotional = params.positions.reduce((s, p) => s + p.notionalValue, 0);
    const totalUnrealizedPnl = params.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const leverage = params.totalEquity > 0 ? totalNotional / params.totalEquity : 0;

    // Track peak equity
    this.peakEquity = Math.max(this.peakEquity, params.totalEquity);
    const drawdownFromPeak = this.peakEquity > 0
      ? (this.peakEquity - params.totalEquity) / this.peakEquity * 100
      : 0;

    // Daily PnL from previous snapshot
    const prevSnapshot = this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null;
    const dailyPnl = prevSnapshot
      ? params.totalEquity - prevSnapshot.totalEquity
      : 0;

    const snapshot: PortfolioSnapshot = {
      timestamp: now,
      totalEquity: params.totalEquity,
      totalNotional,
      cashBalance: params.cashBalance,
      margin: params.margin,
      leverage,
      positions: params.positions,
      totalUnrealizedPnl,
      dailyPnl,
      dailyTrades: params.dailyTrades,
      winRate: params.winRate,
      maxDrawdown: drawdownFromPeak,
      currentDrawdown: drawdownFromPeak,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  // ═══════════════════════════════════════════════════════════════
  // Safety Check (Main Entry Point)
  // ═══════════════════════════════════════════════════════════════

  checkSafety(snapshot: PortfolioSnapshot): SafetyCheckResult {
    const now = Date.now();
    const rules: SafetyRule[] = [];
    const recommendations: string[] = [];

    // Rule: max_position_size
    for (const pos of snapshot.positions) {
      const pct = snapshot.totalEquity > 0
        ? (pos.notionalValue / snapshot.totalEquity) * 100
        : 0;
      const triggered = pct > this.config.maxPositionSizePct;
      rules.push({
        id: this.nextId(),
        type: 'max_position_size',
        description: `Position size for ${pos.symbol}`,
        threshold: this.config.maxPositionSizePct,
        currentValue: Math.round(pct * 100) / 100,
        triggered,
        severity: pct > 50 ? 'critical' : pct > 35 ? 'dangerous' : 'elevated',
        recommendation: `Reduce ${pos.symbol} position to ≤${this.config.maxPositionSizePct}% of equity`,
        lastChecked: now,
      });
      if (triggered) {
        recommendations.push(`Reduce ${pos.symbol}: ${Math.round(pct)}% of equity (limit: ${this.config.maxPositionSizePct}%)`);
      }
    }

    // Rule: max_leverage
    const leverageTriggered = snapshot.leverage > this.config.maxLeverage;
    rules.push({
      id: this.nextId(),
      type: 'max_leverage',
      description: 'Total account leverage',
      threshold: this.config.maxLeverage,
      currentValue: Math.round(snapshot.leverage * 100) / 100,
      triggered: leverageTriggered,
      severity: snapshot.leverage > 5 ? 'critical' : snapshot.leverage > 4 ? 'dangerous' : 'elevated',
      recommendation: `Reduce leverage to ≤${this.config.maxLeverage}x`,
      lastChecked: now,
    });
    if (leverageTriggered) {
      recommendations.push(`Leverage ${snapshot.leverage.toFixed(1)}x exceeds cap ${this.config.maxLeverage}x`);
    }

    // Rule: max_drawdown
    const ddTriggered = snapshot.currentDrawdown > this.config.maxDrawdownPct;
    rules.push({
      id: this.nextId(),
      type: 'max_drawdown',
      description: 'Current drawdown from peak equity',
      threshold: this.config.maxDrawdownPct,
      currentValue: Math.round(snapshot.currentDrawdown * 100) / 100,
      triggered: ddTriggered,
      severity: snapshot.currentDrawdown > this.config.maxDrawdownPct * 1.5 ? 'critical' : 'dangerous',
      recommendation: `Stop trading. Current drawdown ${snapshot.currentDrawdown.toFixed(1)}% exceeds limit ${this.config.maxDrawdownPct}%.`,
      lastChecked: now,
    });
    if (ddTriggered) {
      recommendations.push(`Critical drawdown: ${snapshot.currentDrawdown.toFixed(1)}% (cap: ${this.config.maxDrawdownPct}%)`);
    }

    // Rule: max_correlation (simplified: check concentration = override)
    const uniqueMarkets = new Set(snapshot.positions.map(p => p.market));
    const concentrationByMarket = new Map<string, number>();
    for (const pos of snapshot.positions) {
      const current = concentrationByMarket.get(pos.market) || 0;
      concentrationByMarket.set(pos.market, current + pos.notionalValue);
    }
    let maxConcentration = 0;
    let maxConcentrationMarket = '';
    for (const [market, value] of concentrationByMarket) {
      const pct = snapshot.totalEquity > 0 ? (value / snapshot.totalEquity) * 100 : 0;
      if (pct > maxConcentration) {
        maxConcentration = pct;
        maxConcentrationMarket = market;
      }
    }

    const concTriggered = maxConcentration > this.config.maxConcentrationPct;
    rules.push({
      id: this.nextId(),
      type: 'max_concentration',
      description: `Concentration in ${maxConcentrationMarket || 'N/A'}`,
      threshold: this.config.maxConcentrationPct,
      currentValue: Math.round(maxConcentration * 100) / 100,
      triggered: concTriggered,
      severity: maxConcentration > 80 ? 'critical' : maxConcentration > 65 ? 'dangerous' : 'elevated',
      recommendation: `Diversify away from ${maxConcentrationMarket}. Reduce to ≤${this.config.maxConcentrationPct}%`,
      lastChecked: now,
    });
    if (concTriggered) {
      recommendations.push(`${maxConcentrationMarket} concentration ${maxConcentration.toFixed(1)}% exceeds limit ${this.config.maxConcentrationPct}%`);
    }

    // Rule: max_daily_trades
    const dailyTradesTriggered = snapshot.dailyTrades > this.config.maxDailyTrades;
    rules.push({
      id: this.nextId(),
      type: 'max_daily_trades',
      description: 'Daily trade count',
      threshold: this.config.maxDailyTrades,
      currentValue: snapshot.dailyTrades,
      triggered: dailyTradesTriggered,
      severity: snapshot.dailyTrades > 40 ? 'dangerous' : 'elevated',
      recommendation: 'Reduce trading frequency. Consider higher conviction setups.',
      lastChecked: now,
    });
    if (dailyTradesTriggered) {
      recommendations.push(`${snapshot.dailyTrades} trades today. Consider reducing frequency.`);
    }

    // Rule: min_win_rate
    const winRateTriggered = snapshot.winRate < this.config.minWinRate && snapshot.dailyTrades >= 5;
    rules.push({
      id: this.nextId(),
      type: 'min_win_rate',
      description: 'Win rate',
      threshold: this.config.minWinRate,
      currentValue: Math.round(snapshot.winRate * 100) / 100,
      triggered: winRateTriggered,
      severity: snapshot.winRate < 0.2 ? 'dangerous' : 'elevated',
      recommendation: 'Low win rate — review strategy logic. Consider paper trading.',
      lastChecked: now,
    });
    if (winRateTriggered) {
      recommendations.push(`Win rate ${(snapshot.winRate * 100).toFixed(0)}% below minimum ${(this.config.minWinRate * 100).toFixed(0)}%`);
    }

    // Rule: max_single_loss
    const singleLossTriggered = snapshot.positions.some(
      p => p.unrealizedPnlPct < -this.config.maxSingleLossPct,
    );
    if (singleLossTriggered) {
      const worst = snapshot.positions.reduce((a, b) =>
        a.unrealizedPnlPct < b.unrealizedPnlPct ? a : b);
      rules.push({
        id: this.nextId(),
        type: 'max_single_loss',
        description: `Largest single loss: ${worst.symbol}`,
        threshold: this.config.maxSingleLossPct,
        currentValue: Math.round(Math.abs(worst.unrealizedPnlPct) * 100) / 100,
        triggered: true,
        severity: worst.unrealizedPnlPct < -10 ? 'critical' : 'dangerous',
        recommendation: `Cut ${worst.symbol}. Single position loss ${Math.abs(worst.unrealizedPnlPct).toFixed(1)}% exceeds ${this.config.maxSingleLossPct}% cap.`,
        lastChecked: now,
      });
      recommendations.push(`Large loss on ${worst.symbol}: ${worst.unrealizedPnlPct.toFixed(1)}%`);
    }

    // Circuit breaker
    let killSwitchTriggered = false;
    if (snapshot.currentDrawdown > this.config.circuitBreakerDrawdownPct) {
      killSwitchTriggered = this.activateKillSwitch(
        `Drawdown ${snapshot.currentDrawdown.toFixed(1)}% exceeded circuit breaker ${this.config.circuitBreakerDrawdownPct}%`,
      );
      recommendations.push(`🛑 CIRCUIT BREAKER: Drawdown ${snapshot.currentDrawdown.toFixed(1)}% — trading halted`);
    }

    // Overall risk assessment
    const violations = rules.filter(r => r.triggered);
    let overallRisk: RiskLevel = 'safe';

    const criticalCount = violations.filter(r => r.severity === 'critical').length;
    const dangerousCount = violations.filter(r => r.severity === 'dangerous').length;
    const elevatedCount = violations.filter(r => r.severity === 'elevated').length;

    if (killSwitchTriggered || criticalCount >= 2) {
      overallRisk = 'critical';
    } else if (criticalCount >= 1 || dangerousCount >= 3) {
      overallRisk = 'dangerous';
    } else if (dangerousCount >= 1 || elevatedCount >= 3) {
      overallRisk = 'elevated';
    } else if (elevatedCount >= 1) {
      overallRisk = 'moderate';
    }

    // Safety score
    let safetyScore = 100;
    safetyScore -= violations.reduce((s, v) => {
      switch (v.severity) {
        case 'critical': return s + 30;
        case 'dangerous': return s + 20;
        case 'elevated': return s + 10;
        case 'moderate': return s + 5;
        default: return s;
      }
    }, 0);
    safetyScore = Math.max(0, Math.min(100, safetyScore));

    const result: SafetyCheckResult = {
      timestamp: now,
      portfolioValue: snapshot.totalEquity,
      overallRisk,
      rules,
      violations,
      recommendations,
      killSwitchTriggered,
      safetyScore,
    };

    this.checkResults.push(result);
    log.info(`[Safety] Check result: risk=${overallRisk}, score=${safetyScore}, violations=${violations.length}`);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Circuit Breakers
  // ═══════════════════════════════════════════════════════════════

  activateKillSwitch(reason: string): boolean {
    if (this.killSwitchActive) return false;
    this.killSwitchActive = true;
    this.killSwitchReason = reason;
    log.warn(`[Safety] KILL SWITCH ACTIVATED: ${reason}`);
    return true;
  }

  deactivateKillSwitch(): boolean {
    if (!this.killSwitchActive) return false;
    this.killSwitchActive = false;
    this.killSwitchReason = '';
    log.info('[Safety] Kill switch deactivated');
    return true;
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  getKillSwitchReason(): string {
    return this.killSwitchReason;
  }

  // ═══════════════════════════════════════════════════════════════
  // Cooldown
  // ═══════════════════════════════════════════════════════════════

  startCooldown(minutes?: number): void {
    const mins = minutes || this.config.cooldownMinutes;
    this.cooldownUntil = Date.now() + mins * 60 * 1000;
    log.info(`[Safety] Cooldown started: ${mins} minutes`);
  }

  isInCooldown(): boolean {
    return Date.now() < this.cooldownUntil;
  }

  getCooldownRemainingSeconds(): number {
    if (!this.isInCooldown()) return 0;
    return Math.ceil((this.cooldownUntil - Date.now()) / 1000);
  }

  // ═══════════════════════════════════════════════════════════════
  // Recommendations
  // ═══════════════════════════════════════════════════════════════

  getLatestCheck(): SafetyCheckResult | undefined {
    return this.checkResults.length > 0
      ? this.checkResults[this.checkResults.length - 1]
      : undefined;
  }

  getCheckHistory(limit?: number): SafetyCheckResult[] {
    return this.checkResults.slice(-(limit || 10));
  }

  getPositionSizeRecommendation(symbol: string, currentSize: number): {
    maxRecommended: number;
    remove: number;
    isOverLimit: boolean;
  } {
    const latest = this.getLatestCheck();
    const equity = latest?.portfolioValue || 100000;
    const maxRecommended = equity * (this.config.maxPositionSizePct / 100);
    const remove = Math.max(0, currentSize - maxRecommended);

    return {
      maxRecommended,
      remove,
      isOverLimit: remove > 0,
    };
  }
}
