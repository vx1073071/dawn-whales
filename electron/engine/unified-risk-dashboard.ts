// ── Q65: Unified Risk Dashboard Engine ────────────────────────────────────────
// Consolidates all risk engines into a single real-time risk view
// VaR / ATR / Risk Budget / Cross-Asset Risk / Greeks / Drawdown / Liquidity

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskStatus {
  level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'BREACH';
  score: number;       // 0-100 (100 = safest)
  message: string;
  since?: number;      // ms since last status change
}

export interface RiskMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: RiskStatus['level'];
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  description: string;
}

export interface SectorRisk {
  sector: string;
  exposure: number;      // HKD
  var: number;           // HKD
  stressLoss: number;    // HKD
  contribution: number;  // % of total risk
  status: RiskStatus['level'];
}

export interface UnifiedRiskDashboard {
  // Overall status
  overallStatus: RiskStatus;
  riskScore: number;       // 0-100 composite
  lastUpdated: number;

  // Core metrics
  var: RiskMetric;
  cvar: RiskMetric;
  stressTest: RiskMetric;
  drawdown: RiskMetric;
  leverage: RiskMetric;
  liquidity: RiskMetric;
  concentration: RiskMetric;

  // Greeks
  portfolioDelta: number;
  portfolioGamma: number;
  portfolioTheta: number;
  portfolioVega: number;

  // P&L attribution
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  ytdPnL: number;
  unrealizedPnL: number;

  // Sector breakdown
  bySector: SectorRisk[];

  // Active alerts
  activeAlerts: RiskAlert[];

  // Recommendations
  recommendations: string[];
  hedgingSuggestions: string[];

  // Status history
  statusHistory: Array<{ timestamp: number; status: RiskStatus['level']; score: number }>;
}

export interface RiskAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: string;
  message: string;
  metric?: string;
  triggeredAt: number;
  acknowledged: boolean;
  suggestedAction?: string;
}

// ── Score Helpers ──────────────────────────────────────────────────────────

function varStatus(varHKD: number, portfolioValue: number): RiskStatus['level'] {
  const ratio = varHKD / portfolioValue;
  if (ratio > 0.05) return 'BREACH';   // >5% = breach
  if (ratio > 0.03) return 'RED';
  if (ratio > 0.02) return 'ORANGE';
  if (ratio > 0.01) return 'YELLOW';
  return 'GREEN';
}

function ddStatus(ddPct: number): RiskStatus['level'] {
  if (ddPct <= -0.20) return 'BREACH';
  if (ddPct <= -0.15) return 'RED';
  if (ddPct <= -0.10) return 'ORANGE';
  if (ddPct <= -0.05) return 'YELLOW';
  return 'GREEN';
}

function levStatus(lev: number): RiskStatus['level'] {
  if (lev > 3.0) return 'BREACH';
  if (lev > 2.0) return 'RED';
  if (lev > 1.5) return 'ORANGE';
  if (lev > 1.2) return 'YELLOW';
  return 'GREEN';
}

function liqStatus(liqScore: number): RiskStatus['level'] {
  if (liqScore < 20) return 'BREACH';
  if (liqScore < 40) return 'RED';
  if (liqScore < 60) return 'ORANGE';
  if (liqScore < 80) return 'YELLOW';
  return 'GREEN';
}

function concStatus(hhi: number): RiskStatus['level'] {
  if (hhi > 5000) return 'BREACH';
  if (hhi > 3000) return 'RED';
  if (hhi > 2000) return 'ORANGE';
  if (hhi > 1500) return 'YELLOW';
  return 'GREEN';
}

function compositeScore(metrics: RiskMetric[]): number {
  const weights: Record<string, number> = {
    var: 0.25, cvar: 0.15, stressTest: 0.15, drawdown: 0.15,
    leverage: 0.10, liquidity: 0.10, concentration: 0.10,
  };
  let total = 0, weightSum = 0;
  for (const m of metrics) {
    const w = weights[m.name] ?? 0.05;
    const score = m.status === 'GREEN' ? 100 : m.status === 'YELLOW' ? 75 :
      m.status === 'ORANGE' ? 50 : m.status === 'RED' ? 25 : 0;
    total += score * w;
    weightSum += w;
  }
  return Math.round(total / weightSum);
}

function overallStatus(score: number): RiskStatus {
  if (score >= 90) return { level: 'GREEN', score, message: 'Risk within acceptable limits' };
  if (score >= 75) return { level: 'YELLOW', score, message: 'Elevated risk — monitor closely' };
  if (score >= 60) return { level: 'ORANGE', score, message: 'High risk — consider risk reduction' };
  if (score >= 40) return { level: 'RED', score, message: 'Very high risk — immediate action required' };
  return { level: 'BREACH', score, message: 'Risk limit breach — emergency action needed' };
}

// ── Unified Risk Dashboard Engine ─────────────────────────────────────────

export class UnifiedRiskDashboard {
  private statusHistory: Array<{ timestamp: number; status: RiskStatus['level']; score: number }> = [];
  private alerts: RiskAlert[] = [];
  private alertIdCounter = 0;

  constructor() {
    log.info('[UnifiedRiskDashboard] Initialized');
  }

  // ── Build Full Dashboard ──────────────────────────────────────────────

  buildDashboard(input: {
    // Portfolio
    totalValue: number;          // HKD
    cashBalance: number;         // HKD
    dailyPnL: number;
    weeklyPnL: number;
    monthlyPnL: number;
    ytdPnL: number;
    unrealizedPnL: number;

    // Risk metrics
    var1d: number;              // HKD 1-day VaR 95
    var5d: number;              // HKD 5-day VaR 95
    cvar99: number;              // HKD CVaR 99
    stressLoss: number;          // HKD (worst of 4 scenarios)
    currentDrawdown: number;     // decimal (e.g. -0.08 = -8%)
    maxDrawdown: number;         // decimal (e.g. -0.15 = -15%)
    leverage: number;            // e.g. 1.85

    // Greeks
    portfolioDelta: number;
    portfolioGamma: number;
    portfolioTheta: number;
    portfolioVega: number;

    // Liquidity
    liquidityScore: number;      // 0-100
    illiquidPositions: number;   // count

    // Concentration
    hhi: number;                 // Herfindahl index
    topPositionPct: number;
    topSectorPct: number;

    // Sector exposure
    sectorExposures: Array<{ sector: string; exposure: number; var: number }>;
  }): UnifiedRiskDashboard {
    const now = Date.now();

    // Core metrics
    const var1dMetric: RiskMetric = {
      name: 'var', value: input.var1d,
      unit: 'HKD', threshold: input.totalValue * 0.02,
      status: varStatus(input.var1d, input.totalValue),
      trend: 'STABLE',
      description: `1-day 95% VaR: ${(input.var1d / 1e6).toFixed(1)}M HKD (${(input.var1d / input.totalValue * 100).toFixed(1)}% of portfolio)`,
    };

    const cvarMetric: RiskMetric = {
      name: 'cvar', value: input.cvar99,
      unit: 'HKD', threshold: input.totalValue * 0.03,
      status: varStatus(input.cvar99 * 0.8, input.totalValue),  // CVaR is 20% higher than VaR
      trend: 'STABLE',
      description: `CVaR 99%: ${(input.cvar99 / 1e6).toFixed(1)}M HKD`,
    };

    const stressMetric: RiskMetric = {
      name: 'stressTest', value: input.stressLoss,
      unit: 'HKD', threshold: input.totalValue * 0.10,
      status: input.stressLoss > input.totalValue * 0.10 ? 'BREACH' :
        input.stressLoss > input.totalValue * 0.07 ? 'RED' :
        input.stressLoss > input.totalValue * 0.05 ? 'ORANGE' :
        input.stressLoss > input.totalValue * 0.03 ? 'YELLOW' : 'GREEN',
      trend: 'STABLE',
      description: `Worst-case stress loss: ${(input.stressLoss / 1e6).toFixed(1)}M HKD (${(input.stressLoss / input.totalValue * 100).toFixed(1)}% of portfolio)`,
    };

    const ddMetric: RiskMetric = {
      name: 'drawdown', value: input.currentDrawdown,
      unit: '%', threshold: -0.10,
      status: ddStatus(input.currentDrawdown),
      trend: input.currentDrawdown > input.maxDrawdown * 0.8 ? 'WORSENING' :
        input.currentDrawdown < input.maxDrawdown * 0.5 ? 'IMPROVING' : 'STABLE',
      description: `Current drawdown: ${(input.currentDrawdown * 100).toFixed(1)}% (max: ${(input.maxDrawdown * 100).toFixed(1)}%)`,
    };

    const levMetric: RiskMetric = {
      name: 'leverage', value: input.leverage,
      unit: 'x', threshold: 2.0,
      status: levStatus(input.leverage),
      trend: 'STABLE',
      description: `Gross leverage: ${input.leverage.toFixed(2)}x (${(input.leverage * 100).toFixed(0)}% exposure vs ${input.totalValue.toFixed(0)} HKD equity)`,
    };

    const liqMetric: RiskMetric = {
      name: 'liquidity', value: input.liquidityScore,
      unit: 'score', threshold: 60,
      status: liqStatus(input.liquidityScore),
      trend: 'STABLE',
      description: `Liquidity score: ${input.liquidityScore}/100${input.illiquidPositions > 0 ? ` (${input.illiquidPositions} illiquid positions)` : ''}`,
    };

    const concMetric: RiskMetric = {
      name: 'concentration', value: input.hhi,
      unit: 'HHI', threshold: 2500,
      status: concStatus(input.hhi),
      trend: 'STABLE',
      description: `Concentration (HHI): ${input.hhi} | Top position: ${(input.topPositionPct * 100).toFixed(0)}% | Top sector: ${(input.topSectorPct * 100).toFixed(0)}%`,
    };

    const metrics = [var1dMetric, cvarMetric, stressMetric, ddMetric, levMetric, liqMetric, concMetric];
    const riskScore = compositeScore(metrics);

    // Update status history
    const statusEntry = { timestamp: now, status: overallStatus(riskScore).level, score: riskScore };
    this.statusHistory.push(statusEntry);
    if (this.statusHistory.length > 30) this.statusHistory.shift();

    // Generate alerts
    this.checkAlerts(metrics, now);

    // Sector breakdown
    const totalSectorVar = input.sectorExposures.reduce((s, x) => s + x.var, 0);
    const bySector: SectorRisk[] = input.sectorExposures.map(s => ({
      sector: s.sector,
      exposure: s.exposure,
      var: s.var,
      stressLoss: s.exposure * 0.15,
      contribution: totalSectorVar > 0 ? Math.round(s.var / totalSectorVar * 100) : 0,
      status: s.var / s.exposure > 0.05 ? 'RED' : s.var / s.exposure > 0.03 ? 'ORANGE' : 'GREEN',
    })).sort((a, b) => b.contribution - a.contribution);

    // Recommendations
    const recommendations: string[] = [];
    const hedgingSuggestions: string[] = [];

    if (input.leverage > 2.0) {
      recommendations.push('⚠️ Leverage above 2x — consider reducing positions or adding hedges');
      hedgingSuggestions.push('Buy put options on top 3 holdings to cap downside');
    }
    if (input.currentDrawdown < -0.10) {
      recommendations.push('🚨 Drawdown exceeds 10% — review stop-loss levels');
    }
    if (input.var1d / input.totalValue > 0.03) {
      recommendations.push('📊 VaR is elevated — reduce position sizes by 20%');
    }
    if (input.hhi > 3000) {
      recommendations.push('📊 High concentration — consider diversifying into uncorrelated sectors');
    }
    if (input.liquidityScore < 60) {
      recommendations.push('💧 Low liquidity score — avoid large trades in current positions');
    }
    if (recommendations.length === 0) {
      recommendations.push('✅ Risk metrics within normal ranges — maintain current risk management');
    }

    return {
      overallStatus: overallStatus(riskScore),
      riskScore,
      lastUpdated: now,
      var: var1dMetric,
      cvar: cvarMetric,
      stressTest: stressMetric,
      drawdown: ddMetric,
      leverage: levMetric,
      liquidity: liqMetric,
      concentration: concMetric,
      portfolioDelta: input.portfolioDelta,
      portfolioGamma: input.portfolioGamma,
      portfolioTheta: input.portfolioTheta,
      portfolioVega: input.portfolioVega,
      dailyPnL: input.dailyPnL,
      weeklyPnL: input.weeklyPnL,
      monthlyPnL: input.monthlyPnL,
      ytdPnL: input.ytdPnL,
      unrealizedPnL: input.unrealizedPnL,
      bySector,
      activeAlerts: this.alerts.filter(a => !a.acknowledged),
      recommendations,
      hedgingSuggestions,
      statusHistory: this.statusHistory,
    };
  }

  // ── Alert Checking ───────────────────────────────────────────────────

  private checkAlerts(metrics: RiskMetric[], now: number): void {
    for (const m of metrics) {
      if (m.status === 'BREACH' || m.status === 'RED') {
        const existing = this.alerts.find(a => a.metric === m.name && !a.acknowledged);
        if (!existing) {
          this.alerts.push({
            id: `alert-${++this.alertIdCounter}`,
            severity: m.status === 'BREACH' ? 'CRITICAL' : 'WARNING',
            category: m.name,
            message: `${m.name.toUpperCase()} ${m.status}: ${m.value} ${m.unit}`,
            metric: m.name,
            triggeredAt: now,
            acknowledged: false,
            suggestedAction: this.getSuggestedAction(m.name),
          });
        }
      }
    }
    // Clean up old acknowledged alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-30);
    }
  }

  private getSuggestedAction(metric: string): string {
    const actions: Record<string, string> = {
      var: 'Reduce position sizes or add hedges to lower VaR',
      drawdown: 'Tighten stop-losses or reduce exposure',
      leverage: 'Reduce borrowed capital or close margin positions',
      liquidity: 'Avoid large trades; build cash buffer',
      concentration: 'Diversify into uncorrelated assets',
      stressTest: 'Review scenario assumptions; consider portfolio insurance',
    };
    return actions[metric] ?? 'Review this risk metric immediately';
  }

  // ── Acknowledge Alert ─────────────────────────────────────────────────

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) { alert.acknowledged = true; return true; }
    return false;
  }

  // ── Quick Health Check ────────────────────────────────────────────────

  quickHealthCheck(portfolioValue: number, var1d: number, leverage: number, drawdown: number): RiskStatus {
    const varRatio = var1d / portfolioValue;
    const levScore = leverage > 2.0 ? 30 : leverage > 1.5 ? 60 : 80;
    const ddScore = drawdown < -0.15 ? 0 : drawdown < -0.10 ? 30 : drawdown < -0.05 ? 60 : 90;
    const varScore = varRatio > 0.05 ? 0 : varRatio > 0.03 ? 30 : varRatio > 0.02 ? 60 : 90;
    const score = Math.round((varScore * 0.4 + levScore * 0.3 + ddScore * 0.3));

    const status = overallStatus(score);
    log.info(`[UnifiedRiskDashboard] Health check: ${status.level} (score=${score})`);
    return status;
  }
}

export default UnifiedRiskDashboard;