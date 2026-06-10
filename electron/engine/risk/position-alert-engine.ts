// ── Q68: Position Alert Engine ────────────────────────────────────────────────
import log from 'electron-log';
// Real-time monitoring of position-level alerts
// Price alerts / Volume alerts / VaR alerts / P&L alerts / Risk limit alerts

import log = require('electron-log');

// ── Types ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
export type AlertCategory = 'PRICE' | 'VOLUME' | 'PNL' | 'RISK' | 'LIQUIDITY' | 'GREEKS' | 'REGIME';

export interface AlertRule {
  id: string;
  symbol?: string;              // undefined = all symbols
  category: AlertCategory;
  condition: 'ABOVE' | 'BELOW' | 'CHANGE_PCT' | 'SPIKE' | 'CROSS' | 'BREACH';
  threshold: number;
  severity: AlertSeverity;
  message: string;
  enabled: boolean;
  cooldownMs: number;           // minimum ms between alerts
}

export interface PositionAlert {
  id: string;
  ruleId: string;
  symbol: string;
  category: AlertCategory;
  severity: AlertSeverity;
  message: string;
  triggeredValue: number;
  threshold: number;
  triggeredAt: number;
  acknowledged: boolean;
  actionTaken?: string;
}

export interface AlertSummary {
  totalActive: number;
  byCategory: Record<AlertCategory, number>;
  bySeverity: Record<AlertSeverity, number>;
  unacknowledged: number;
  critical: PositionAlert[];
  recent: PositionAlert[];     // last 10
}

// ── Price levels ─────────────────────────────────────────────────────────

function priceAlertType(current: number, prevClose: number): 'GAP_UP' | 'GAP_DOWN' | 'CIRCUIT_BREAKER' | null {
  const changePct = (current - prevClose) / prevClose;
  if (changePct > 0.10) return 'CIRCUIT_BREAKER';
  if (current > prevClose * 1.05) return 'GAP_UP';
  if (current < prevClose * 0.95) return 'GAP_DOWN';
  return null;
}

// ── Alert Engine ─────────────────────────────────────────────────────────

export class PositionAlertEngine {
  private rules: AlertRule[] = [];
  private alerts: PositionAlert[] = [];
  private alertIdCounter = 0;
  private lastTriggered: Record<string, number> = {}; // ruleId -> timestamp

  constructor() {
    this.initDefaultRules();
    log.info('[PositionAlertEngine] Initialized with default rules');
  }

  // ── Default Rules ────────────────────────────────────────────────────

  private initDefaultRules(): void {
    this.rules = [
      { id: 'price-drop-5', category: 'PRICE', condition: 'CHANGE_PCT', threshold: -0.05, severity: 'WARNING', message: 'Position down 5%', enabled: true, cooldownMs: 300000 },
      { id: 'price-drop-10', category: 'PRICE', condition: 'CHANGE_PCT', threshold: -0.10, severity: 'CRITICAL', message: 'Position down 10%', enabled: true, cooldownMs: 600000 },
      { id: 'price-drop-20', category: 'PRICE', condition: 'CHANGE_PCT', threshold: -0.20, severity: 'EMERGENCY', message: 'Position down 20% — stop-loss triggered', enabled: true, cooldownMs: 0 },
      { id: 'price-rise-10', category: 'PRICE', condition: 'CHANGE_PCT', threshold: 0.10, severity: 'INFO', message: 'Position up 10% — consider taking profit', enabled: true, cooldownMs: 3600000 },
      { id: 'volume-spike-3x', category: 'VOLUME', condition: 'SPIKE', threshold: 3, severity: 'WARNING', message: 'Volume 3x average — unusual activity', enabled: true, cooldownMs: 1800000 },
      { id: 'volume-spike-5x', category: 'VOLUME', condition: 'SPIKE', threshold: 5, severity: 'CRITICAL', message: 'Volume 5x average — potential breakout or dump', enabled: true, cooldownMs: 3600000 },
      { id: 'pnl-limit-10000', category: 'PNL', condition: 'BELOW', threshold: -10000, severity: 'WARNING', message: 'Position P&L below -HKD 10,000', enabled: true, cooldownMs: 600000 },
      { id: 'pnl-limit-50000', category: 'PNL', condition: 'BELOW', threshold: -50000, severity: 'CRITICAL', message: 'Position P&L below -HKD 50,000', enabled: true, cooldownMs: 0 },
      { id: 'var-breach', category: 'RISK', condition: 'BREACH', threshold: 0.05, severity: 'EMERGENCY', message: 'VaR limit breach', enabled: true, cooldownMs: 0 },
      { id: 'leverage-breach', category: 'RISK', condition: 'BREACH', threshold: 2.5, severity: 'EMERGENCY', message: 'Leverage exceeds 2.5x limit', enabled: true, cooldownMs: 0 },
      { id: 'dd-breach-15', category: 'RISK', condition: 'BREACH', threshold: -0.15, severity: 'CRITICAL', message: 'Drawdown exceeds 15%', enabled: true, cooldownMs: 0 },
      { id: 'iv-spike', category: 'GREEKS', condition: 'SPIKE', threshold: 1.5, severity: 'WARNING', message: 'Implied volatility spiked 50%', enabled: true, cooldownMs: 1800000 },
    ];
  }

  // ── Check Position ──────────────────────────────────────────────────

  checkPosition(
    symbol: string,
    currentPrice: number,
    prevClose: number,
    openPrice: number,
    quantity: number,
    avgCost: number,
    currentVolume: number,
    avgVolume: number,
    unrealizedPnL: number,
    portfolioVaR: number,
    portfolioLeverage: number,
    portfolioDrawdown: number,
    ivCurrent: number,
    ivPrevious: number,
    marketRegime: string,
    marketIV: number
  ): PositionAlert[] {
    const triggered: PositionAlert[] = [];
    const now = Date.now();

    const changePct = prevClose > 0 ? (currentPrice - prevClose) / prevClose : 0;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const ivRatio = ivPrevious > 0 ? ivCurrent / ivPrevious : 1;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.symbol && rule.symbol !== symbol) continue;

      // Cooldown check
      const lastTime = this.lastTriggered[rule.id] ?? 0;
      if (now - lastTime < rule.cooldownMs) continue;

      let triggered2 = false;
      let value = 0;

      switch (rule.category) {
        case 'PRICE':
          if (rule.condition === 'CHANGE_PCT' && Math.abs(changePct) >= Math.abs(rule.threshold)) {
            triggered2 = true; value = changePct;
          } else if (rule.condition === 'BELOW' && currentPrice < rule.threshold) {
            triggered2 = true; value = currentPrice;
          }
          break;

        case 'VOLUME':
          if (rule.condition === 'SPIKE' && volumeRatio >= rule.threshold) {
            triggered2 = true; value = volumeRatio;
          }
          break;

        case 'PNL':
          if (rule.condition === 'BELOW' && unrealizedPnL < rule.threshold) {
            triggered2 = true; value = unrealizedPnL;
          }
          break;

        case 'RISK':
          if (rule.condition === 'BREACH') {
            if (rule.id.includes('var') && portfolioVaR > rule.threshold) { triggered2 = true; value = portfolioVaR; }
            if (rule.id.includes('leverage') && portfolioLeverage > rule.threshold) { triggered2 = true; value = portfolioLeverage; }
            if (rule.id.includes('dd') && portfolioDrawdown < rule.threshold) { triggered2 = true; value = portfolioDrawdown; }
          }
          break;

        case 'GREEKS':
          if (rule.condition === 'SPIKE' && ivRatio >= rule.threshold) {
            triggered2 = true; value = ivRatio;
          }
          break;
      }

      if (triggered2) {
        const alert: PositionAlert = {
          id: `alert-${++this.alertIdCounter}`,
          ruleId: rule.id,
          symbol,
          category: rule.category,
          severity: rule.severity,
          message: rule.message,
          triggeredValue: value,
          threshold: rule.threshold,
          triggeredAt: now,
          acknowledged: false,
          actionTaken: this.suggestAction(rule, value),
        };
        this.alerts.push(alert);
        this.lastTriggered[rule.id] = now;
        triggered.push(alert);
        log.warn(`[PositionAlertEngine] ALERT: ${rule.severity} ${rule.category} ${symbol}: ${rule.message} (value=${value})`);
      }
    }

    // Special circuit breaker check
    const gapType = priceAlertType(currentPrice, prevClose);
    if (gapType === 'CIRCUIT_BREAKER') {
      triggered.push({
        id: `alert-${++this.alertIdCounter}`,
        ruleId: 'circuit-breaker',
        symbol,
        category: 'PRICE',
        severity: 'EMERGENCY',
        message: `Circuit breaker: ${symbol} gapped ${changePct > 0 ? '+' : ''}${(changePct * 100).toFixed(1)}%`,
        triggeredValue: changePct,
        threshold: 0.10,
        triggeredAt: now,
        acknowledged: false,
        actionTaken: 'HALT trading — investigate cause before acting',
      });
    }

    // Limit to last 200 alerts
    if (this.alerts.length > 200) this.alerts = this.alerts.slice(-150);

    return triggered;
  }

  // ── Acknowledge ──────────────────────────────────────────────────────

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) { alert.acknowledged = true; return true; }
    return false;
  }

  acknowledgeAll(olderThanMs?: number): number {
    const cutoff = olderThanMs ? Date.now() - olderThanMs : 0;
    let count = 0;
    for (const a of this.alerts) {
      if (!a.acknowledged && a.triggeredAt < cutoff) {
        a.acknowledged = true; count++;
      }
    }
    return count;
  }

  // ── Rule Management ───────────────────────────────────────────────────

  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const r: AlertRule = { ...rule, id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    this.rules.push(r);
    return r;
  }

  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex(r => r.id === ruleId);
    if (idx >= 0) { this.rules.splice(idx, 1); return true; }
    return false;
  }

  getRules(): AlertRule[] { return [...this.rules]; }

  enableRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) { rule.enabled = enabled; return true; }
    return false;
  }

  // ── Summary ──────────────────────────────────────────────────────────

  getSummary(): AlertSummary {
    const unacknowledged = this.alerts.filter(a => !a.acknowledged);
    const byCategory: Record<AlertCategory, number> = { PRICE: 0, VOLUME: 0, PNL: 0, RISK: 0, LIQUIDITY: 0, GREEKS: 0, REGIME: 0 };
    const bySeverity: Record<AlertSeverity, number> = { INFO: 0, WARNING: 0, CRITICAL: 0, EMERGENCY: 0 };

    for (const a of unacknowledged) {
      byCategory[a.category]++;
      bySeverity[a.severity]++;
    }

    return {
      totalActive: unacknowledged.length,
      byCategory,
      bySeverity,
      unacknowledged: unacknowledged.length,
      critical: unacknowledged.filter(a => a.severity === 'CRITICAL' || a.severity === 'EMERGENCY'),
      recent: [...unacknowledged].sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, 10),
    };
  }

  // ── Suggest Action ───────────────────────────────────────────────────

  private suggestAction(rule: AlertRule, value: number): string {
    if (rule.category === 'PRICE' && value < 0) {
      if (Math.abs(value) > 0.15) return 'STOP-LOSS triggered — consider hard stop';
      if (Math.abs(value) > 0.05) return 'Reduce position by 25-50% or tighten stop';
      return 'Monitor — no action required yet';
    }
    if (rule.category === 'VOLUME') {
      return 'Investigate cause: news/event/short squeeze — adjust position size accordingly';
    }
    if (rule.category === 'PNL' && value < -50000) {
      return 'EMERGENCY — exit position immediately, review risk limits';
    }
    if (rule.category === 'RISK' && rule.condition === 'BREACH') {
      return 'STOP TRADING — reduce leverage immediately, notify risk team';
    }
    return 'Acknowledge and monitor';
  }
}

export default PositionAlertEngine;