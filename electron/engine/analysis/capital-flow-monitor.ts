// ── JVS-12: Real-time Capital Flow Push (实时资金流推送) ───────────────────
// Monitors real-time capital flow changes and pushes alerts
// Integrates with QuoteStream (JVS-9) for tick-level updates

import log from 'electron-log';
import i18n from '../../../src/i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface CapitalFlowAlert {
  type: 'main_force_inflow' | 'main_force_outflow' | 'large_order' | 'unusual_activity';
  code: string;
  name: string;
  amount: number;          // 金额 (万元)
  changePct: number;       // 涨跌幅 %
  description: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FlowMonitorConfig {
  mainForceThreshold: number;     // 主力净流入阈值 (万元), default 5000
  largeOrderThreshold: number;    // 大单阈值 (万元), default 1000
  alertInterval: number;          // 同一股票告警间隔 (ms), default 300000 (5min)
  enabled: boolean;
}

interface AlertCache {
  code: string;
  type: string;
  timestamp: number;
}

// ── Capital Flow Monitor ───────────────────────────────────────────────────

export class CapitalFlowMonitor {
  private config: FlowMonitorConfig;
  private alertHistory: AlertCache[] = [];
  private listeners: ((alert: CapitalFlowAlert) => void)[] = [];

  constructor(config?: Partial<FlowMonitorConfig>) {
    this.config = {
      mainForceThreshold: 5000,   // 5000万
      largeOrderThreshold: 1000,  // 1000万
      alertInterval: 300000,      // 5 minutes
      enabled: true,
      ...config,
    };

    log.info(i18n.t('capitalFlowMonitor.k1'));
  }

  /**
   * Process capital flow data and generate alerts
   */
  process(items: any[]): CapitalFlowAlert[] {
    if (!this.config.enabled) return [];

    const alerts: CapitalFlowAlert[] = [];

    for (const item of items) {
      // Check main force net inflow
      if (item.mainNetInflow && Math.abs(item.mainNetInflow) >= this.config.mainForceThreshold) {
        const type = item.mainNetInflow > 0 ? 'main_force_inflow' : 'main_force_outflow';
        
        if (!this.isAlertSuppressed(item.code, type)) {
          const alert: CapitalFlowAlert = {
            type,
            code: item.code,
            name: item.name,
            amount: Math.abs(item.mainNetInflow),
            changePct: item.changePct || 0,
            description: item.mainNetInflow > 0
              ? i18n.t('capitalFlowMonitor.k2')
              : i18n.t('capitalFlowMonitor.k3'),
            timestamp: Date.now(),
            severity: Math.abs(item.mainNetInflow) > 10000 ? 'high' : 'medium',
          };

          alerts.push(alert);
          this.recordAlert(item.code, type);
        }
      }

      // Check super large orders
      if (item.superLargeIn && Math.abs(item.superLargeIn) >= this.config.largeOrderThreshold) {
        const type = 'large_order';
        
        if (!this.isAlertSuppressed(item.code, type)) {
          const alert: CapitalFlowAlert = {
            type,
            code: item.code,
            name: item.name,
            amount: Math.abs(item.superLargeIn),
            changePct: item.changePct || 0,
            description: `${i18n.t('CapitalFlowMonitor.k0')} ${item.superLargeIn > 0 ? i18n.t('capitalFlowMonitor.k4') : i18n.t('capitalFlowMonitor.k5')} ${this.formatAmount(item.superLargeIn)}${i18n.t('CapitalFlowMonitor.k1')}`,
            timestamp: Date.now(),
            severity: Math.abs(item.superLargeIn) > 5000 ? 'high' : 'medium',
          };

          alerts.push(alert);
          this.recordAlert(item.code, type);
        }
      }

      // Check unusual activity (high turnover with large flow)
      if (item.turnover && item.mainNetInflow) {
        const ratio = Math.abs(item.mainNetInflow) / item.turnover;
        if (ratio > 0.3 && item.turnover > 10000) {  // 主力占比>30% 且 成交额>1亿
          const type = 'unusual_activity';
          
          if (!this.isAlertSuppressed(item.code, type)) {
            const alert: CapitalFlowAlert = {
              type,
              code: item.code,
              name: item.name,
              amount: Math.abs(item.mainNetInflow),
              changePct: item.changePct || 0,
              description: i18n.t('capitalFlowMonitor.k6'),
              timestamp: Date.now(),
              severity: 'high',
            };

            alerts.push(alert);
            this.recordAlert(item.code, type);
          }
        }
      }
    }

    // Notify listeners
    alerts.forEach(alert => {
      this.listeners.forEach(listener => listener(alert));
    });

    if (alerts.length > 0) {
      log.info(`[CapitalFlowMonitor] Generated ${alerts.length} alerts`);
    }

    return alerts;
  }

  /**
   * Register alert listener
   */
  onAlert(listener: (alert: CapitalFlowAlert) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove alert listener
   */
  offAlert(listener: (alert: CapitalFlowAlert) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FlowMonitorConfig>): void {
    this.config = { ...this.config, ...config };
    log.info(i18n.t('capitalFlowMonitor.k7'));
  }

  /**
   * Get current configuration
   */
  getConfig(): FlowMonitorConfig {
    return { ...this.config };
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
    log.info('[CapitalFlowMonitor] Alert history cleared');
  }

  // ── Private Methods ────────────────────────────────────────────────────

  private isAlertSuppressed(code: string, type: string): boolean {
    const now = Date.now();
    return this.alertHistory.some(
      h => h.code === code && h.type === type && (now - h.timestamp) < this.config.alertInterval
    );
  }

  private recordAlert(code: string, type: string): void {
    this.alertHistory.push({ code, type, timestamp: Date.now() });

    // Clean old entries
    const cutoff = Date.now() - this.config.alertInterval;
    this.alertHistory = this.alertHistory.filter(h => h.timestamp > cutoff);
  }

  private formatAmount(amount: number): string {
    if (Math.abs(amount) >= 10000) {
      return (amount / 10000).toFixed(2) + i18n.t('capitalFlowMonitor.k8');
    }
    return amount.toFixed(0);
  }
}

// ── Singleton Instance ─────────────────────────────────────────────────────

let capitalFlowMonitorInstance: CapitalFlowMonitor | null = null;

export function getCapitalFlowMonitor(config?: Partial<FlowMonitorConfig>): CapitalFlowMonitor {
  if (!capitalFlowMonitorInstance) {
    capitalFlowMonitorInstance = new CapitalFlowMonitor(config);
  }
  return capitalFlowMonitorInstance;
}
