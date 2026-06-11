/**
 * Risk Service — R108 S-34
 *
 * Risk management: alerts, config, NL parsing.
 *
 * @module services/risk-service
 */

import * as riskBridge from '../lib/bridge-api/risk';

export interface RiskConfig {
  maxPositionPct: number;
  maxDrawdownPct: number;
  dailyLossLimit: number;
  singleOrderLimit: number;
  stopLossPct: number;
  vixThreshold: number;
  enabled: boolean;
}

export interface RiskAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  symbol?: string;
  timestamp: string;
  acknowledged: boolean;
}

export const riskService = {
  /** Get active risk alerts */
  getAlerts: (): Promise<RiskAlert[]> => riskBridge.getRiskAlerts(),

  /** Get current risk config */
  getConfig: (): Promise<RiskConfig> => riskBridge.getRiskConfig(),

  /** Update risk configuration */
  updateConfig: (config: Partial<RiskConfig>) =>
    riskBridge.updateRiskConfig(config),

  // ── NL Parser ───────────────────────────────────────────────────────
  /** Parse natural language trading command */
  parseNL: (text: string) => riskBridge.parseNL(text),

  /** Get strategy templates available for NL parsing */
  getTemplates: () => riskBridge.getTemplates(),
};
