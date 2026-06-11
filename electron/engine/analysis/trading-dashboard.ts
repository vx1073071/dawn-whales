// ── Q36: Trading Dashboard Summary ────────────────────────────────────────────
// Real-time P&L attribution + Exposure overview + Greeks summary
// Key risk metrics + Alerts + End-of-day report generation

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PositionSummary {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  dayPnL: number;
  weight: number;          // % of portfolio
}

export interface StrategySummary {
  strategyId: string;
  pnl: number;
  trades: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
}

export interface GreeksSummary {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  deltaExposure: number;
  gammaExposure: number;
  thetaDaily: number;
  vegaPerVol: number;
}

export interface RiskAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'risk' | 'pnl' | 'exposure' | 'liquidity' | 'signal';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface DashboardReport {
  // Time
  timestamp: number;
  marketHours: 'OPEN' | 'CLOSED' | 'PRE' | 'POST';
  lastUpdate: string;

  // P&L
  startingEquity: number;
  currentEquity: number;
  totalPnL: number;
  totalPnLPct: number;
  dayPnL: number;
  dayPnLPct: number;
  unrealizedPnL: number;
  realizedPnL: number;
  openPositions: number;

  // Positions
  positions: PositionSummary[];

  // Strategies
  strategies: StrategySummary[];

  // Greeks
  greeks: GreeksSummary;

  // Risk metrics
  portfolioVaR: number;
  portfolioCVaR: number;
  exposureByAsset: Record<string, number>;
  exposureBySector: Record<string, number>;
  largestPosition: string;
  largestPositionPct: number;

  // Alerts
  alerts: RiskAlert[];
  activeAlerts: number;

  // Recommendations
  tradingSuggestions: string[];

  // EOD report
  eodReport?: {
    summary: string;
    topWinner: { symbol: string; pnl: number };
    topLoser: { symbol: string; pnl: number };
    keyEvents: string[];
    nextActions: string[];
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function calcVaR(positions: PositionSummary[], confidence = 0.95): number {
  // Simple parametric VaR: 1.65 * σ * position_value
  if (positions.length === 0) return 0;
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
  // Placeholder volatility
  const portfolioVol = 0.015;
  const zScore = confidence === 0.99 ? 2.33 : 1.65;
  return Math.abs(totalValue) * portfolioVol * zScore;
}

// ── Trading Dashboard ──────────────────────────────────────────────────────

export class TradingDashboard {
  constructor() {
    log.info('[TradingDashboard] Initialized');
  }

  // ── Market Hours ──────────────────────────────────────────────────

  getMarketHours(region: 'HK' | 'US' | 'CN' = 'HK'): DashboardReport['marketHours'] {
    const now = new Date();
    const hkHour = now.getUTCHours() + 8;
    const day = now.getDay();

    if (day === 0 || day === 6) return 'CLOSED';
    if (hkHour >= 9 && hkHour < 12) return 'OPEN';  // morning
    if (hkHour >= 13 && hkHour < 16) return 'OPEN';  // afternoon
    if (hkHour >= 7 && hkHour < 9) return 'PRE';
    if (hkHour >= 16 && hkHour < 20) return 'POST';
    return 'CLOSED';
  }

  // ── Generate Full Report ──────────────────────────────────────────

  generateReport(
    positions: PositionSummary[],
    strategies: StrategySummary[],
    greeks: GreeksSummary,
    startingEquity: number,
    currentEquity: number,
    optionsAlerts: RiskAlert[] = []
  ): DashboardReport {
    const now = new Date();
    const totalPnL = currentEquity - startingEquity;
    const totalPnLPct = startingEquity > 0 ? (totalPnL / startingEquity) * 100 : 0;

    // Day P&L (from positions)
    const dayPnL = positions.reduce((s, p) => s + p.dayPnL, 0);
    const dayPnLPct = startingEquity > 0 ? (dayPnL / startingEquity) * 100 : 0;

    // Unrealized P&L
    const unrealizedPnL = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
    const realizedPnL = totalPnL - unrealizedPnL;

    // Exposure by asset
    const totalValue = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0) || 1;
    const exposureByAsset: Record<string, number> = {};
    for (const pos of positions) {
      exposureByAsset[pos.symbol] = Math.round((pos.marketValue / totalValue) * 10000) / 100;
    }

    // Largest position
    const largest = positions.reduce((best, p) =>
      p.marketValue > (best?.marketValue ?? 0) ? p : best
    , positions[0]);
    const largestPositionPct = largest ? (largest.marketValue / totalValue) * 100 : 0;

    // VaR / CVaR
    const portfolioVaR = calcVaR(positions);
    const portfolioCVaR = portfolioVaR * 1.5; // CVaR ≈ 1.5x VaR

    // Alerts
    const alerts: RiskAlert[] = [...optionsAlerts];

    // Risk-based alerts
    if (portfolioVaR > 500000) {
      alerts.push({
        id: 'var-breach',
        severity: 'CRITICAL',
        category: 'risk',
        message: `VaR exceeds limit: HK$${(portfolioVaR / 10000).toFixed(1)}${i18n.t('TradingDashboard.k0')}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
    if (unrealizedPnL < -startingEquity * 0.05) {
      alerts.push({
        id: 'dd-warning',
        severity: 'WARNING',
        category: 'pnl',
        message: `Unrealized loss ${(unrealizedPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k1')}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
    if (largestPositionPct > 30) {
      alerts.push({
        id: 'concentration',
        severity: 'WARNING',
        category: 'exposure',
        message: `${largest?.symbol ?? 'Position'} concentration: ${largestPositionPct.toFixed(1)}% of portfolio`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
    if (greeks.deltaExposure > 50000) {
      alerts.push({
        id: 'delta-high',
        severity: 'WARNING',
        category: 'risk',
        message: `High delta exposure: ${greeks.deltaExposure.toFixed(0)} shares`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }

    const activeAlerts = alerts.filter(a => !a.acknowledged && a.severity !== 'INFO').length;

    // Trading suggestions
    const suggestions: string[] = [];
    if (totalPnLPct > 3) suggestions.push('📈 Strong performance: consider locking in profits');
    if (totalPnLPct < -3) suggestions.push('📉 Significant drawdown: review positions and risk limits');
    if (unrealizedPnL > 0) suggestions.push(`💰 Unrealized gain: HK$${(unrealizedPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k2')}`);
    if (greeks.thetaDaily > 0) suggestions.push(`⏰ Positive theta: collecting premium daily`);
    if (greeks.gammaExposure > 500) suggestions.push('⚠️ High gamma: consider delta hedging');
    if (activeAlerts === 0) suggestions.push('✅ All risk metrics within limits');

    // EOD Report
    const eodReport: DashboardReport['eodReport'] = {
      summary: `Day P&L: HK$${(dayPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k3')}${dayPnLPct.toFixed(2)}%). Total P&L: HK$${(totalPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k4')}${totalPnLPct.toFixed(2)}%). ${positions.length} open positions.`,
      topWinner: largest && largest.unrealizedPnL > 0
        ? { symbol: largest.symbol, pnl: largest.unrealizedPnL }
        : { symbol: '--', pnl: 0 },
      topLoser: largest && largest.unrealizedPnL < 0
        ? { symbol: largest.symbol, pnl: largest.unrealizedPnL }
        : { symbol: '--', pnl: 0 },
      keyEvents: dayPnLPct > 2 ? ['Strong directional move detected'] : dayPnLPct < -2 ? ['Risk-off move detected'] : [],
      nextActions: activeAlerts > 0 ? [`Review ${activeAlerts} active alerts before EOD`] : ['Maintain current positioning'],
    };

    return {
      timestamp: Date.now(),
      marketHours: this.getMarketHours(),
      lastUpdate: now.toISOString(),
      startingEquity,
      currentEquity,
      totalPnL: Math.round(totalPnL * 100) / 100,
      totalPnLPct: Math.round(totalPnLPct * 100) / 100,
      dayPnL: Math.round(dayPnL * 100) / 100,
      dayPnLPct: Math.round(dayPnLPct * 100) / 100,
      unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
      realizedPnL: Math.round(realizedPnL * 100) / 100,
      openPositions: positions.length,
      positions,
      strategies,
      greeks,
      portfolioVaR: Math.round(portfolioVaR * 100) / 100,
      portfolioCVaR: Math.round(portfolioCVaR * 100) / 100,
      exposureByAsset,
      exposureBySector: {},
      largestPosition: largest?.symbol ?? 'none',
      largestPositionPct: Math.round(largestPositionPct * 100) / 100,
      alerts,
      activeAlerts,
      tradingSuggestions: suggestions,
      eodReport,
    };
  }

  // ── Format for Display ────────────────────────────────────────────

  formatSummary(report: DashboardReport): string {
    const lines = [
      `📊 Trading Dashboard (${report.lastUpdate.slice(11, 19)})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 Equity: HK$${(report.currentEquity / 10000).toFixed(1)}${i18n.t('TradingDashboard.k5')}`,
      `   Day P&L: HK$${(report.dayPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k6')}${report.dayPnLPct >= 0 ? '+' : ''}${report.dayPnLPct.toFixed(2)}%)`,
      `   Total P&L: HK$${(report.totalPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k7')}${report.totalPnLPct >= 0 ? '+' : ''}${report.totalPnLPct.toFixed(2)}%)`,
      `   Unrealized: HK$${(report.unrealizedPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k8')}`,
      `   Realized: HK$${(report.realizedPnL / 10000).toFixed(1)}${i18n.t('TradingDashboard.k9')}`,
      ``,
      `📈 Greeks:`,
      `   Δ ${report.greeks.delta.toFixed(0)}  Γ ${report.greeks.gamma.toFixed(0)}  Θ ${report.greeks.theta.toFixed(0)}  ν ${report.greeks.vega.toFixed(0)}`,
      ``,
      `⚠️ Alerts: ${report.activeAlerts} active`,
      ...report.alerts
        .filter(a => a.severity !== 'INFO')
        .slice(0, 3)
        .map(a => `   ${a.severity} ${a.message}`),
      ``,
      `🏦 VaR: HK$${(report.portfolioVaR / 10000).toFixed(1)}${i18n.t('TradingDashboard.k10')}${(report.portfolioCVaR / 10000).toFixed(1)}${i18n.t('TradingDashboard.k11')}`,
      `📍 Largest: ${report.largestPosition} (${report.largestPositionPct.toFixed(1)}%)`,
    ];
    return lines.join('\n');
  }
}

export default TradingDashboard;