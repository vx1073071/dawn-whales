— R119 QClaw: structural class wrapper for TSC parse errors
export class R119_TempWrapper_types {
export interface RiskAssessment {
  strategyId: string;
  strategyName: string;
  symbol: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  score: number;              // 0-100, higher = riskier
  factors: RiskFactor[];
  drawdownPct: number;
  marginUtilization: number;
  concentrationRisk: number;
  circuitBreakerActive: boolean;
  positionLimitReached: boolean;
  recommendation: string;
  timestamp: number;
}
export interface RiskFactor {
  name: string;
  severity: 'info' | 'warning' | 'danger';
  value: number;
  threshold: number;
  description: string;
}
export interface CircuitBreakerStatus {
  active: boolean;
  triggeredAt: number | null;
  reason: string;
  marketBreakers: CircuitBreakerResult[];
  drawdownBreaker: {
    active: boolean;
    currentDrawdownPct: number;
    thresholdPct: number;
    peakEquity: number;
    currentEquity: number;
  };
  pausedStrategies: string[];
}
export interface RiskSummary {
  timestamp: number;
  overallStatus: 'healthy' | 'warning' | 'critical';
  portfolio: {
    totalAssets: number;
    totalExposure: number;
    leverageRatio: number;
    netExposure: number;
  };
  margin: {
    totalUsed: number;
    totalAvailable: number;
    maxUtilization: number;
    anyMarginCallRisk: boolean;
  };
  exposure: {
    concentrationRisk: number;
    topSectors: Array<{ sector: string; weight: number }>;
    topPositions: Array<{ code: string; weight: number }>;
  };
  circuitBreakers: {
    active: boolean;
    count: number;
    details: string[];
  };
  strategies: {
    total: number;
    running: number;
    paused: number;
    errorCount: number;
  };
  alerts: RiskAlert[];
}
export interface RiskAlert {
  id: string;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  source: string;
  title: string;
  message: string;
  strategyId?: string;
  timestamp: number;
  acknowledged: boolean;
}
export interface OrderValidation {
  allowed: boolean;
  reason?: string;
  riskScore?: number;
  warnings?: string[];
}
type IntegratorEvents = {
  'circuit-breaker': (event: {
    active: boolean;
    reason: string;
    drawdownPct: number;
    pausedStrategies: string[];
    timestamp: number;
  }) => void;
  'risk-warning': (alert: RiskAlert) => void;
  'position-limit': (event: {
    strategyId: string;
    symbol: string;
    currentValue: number;
    limitValue: number;
    utilizationPct: number;
    timestamp: number;
  }) => void;
  'strategy-paused': (event: {
    strategyId: string;
    strategyName: string;
    reason: string;
    pausedAt: number;
  }) => void;
  'strategy-resumed': (event: {
    strategyId: string;
    strategyName: string;
    resumedAt: number;
  }) => void;
  'risk-assessment': (assessment: RiskAssessment) => void;
};
export interface RiskIntegratorConfig {
  /** Enable automatic circuit-breaker on drawdown (default: true) */
  drawdownCircuitBreakerEnabled: boolean;
  /** Drawdown percentage that triggers global pause (default: 0.15 = 15%) */
  drawdownThreshold: number;
  /** Drawdown recovery percentage to allow resume (default: 0.10 = 10%) */
  drawdownRecoveryThreshold: number;
  /** Maximum single-position value as fraction of total assets (default: 0.20) */
  maxSinglePositionPct: number;
  /** Maximum total exposure as fraction of total assets (default: 0.80) */
  maxTotalExposurePct: number;
  /** Margin utilization warning threshold (default: 0.70) */
  marginWarningThreshold: number;
  /** Margin utilization danger threshold (default: 0.85) */
  marginDangerThreshold: number;
  /** Concentration risk (HHI) warning threshold (default: 0.25) */
  concentrationWarningThreshold: number;
  /** Markets to monitor for circuit breakers (default: ['HK', 'US', 'CN']) */
  monitoredMarkets: string[];
  /** Monitoring poll interval in milliseconds (default: 15000) */
  pollIntervalMs: number;
  /** Maximum alerts to retain in memory (default: 200) */
  maxAlerts: number;
  /** Position cache max age before forcing refresh (default: 30000ms) */
  positionSyncIntervalMs: number;
}
type EventMap = Record<string, (...args: unknown[]) => void>;

class TypedEventEmitter<T extends EventMap> {
  private handlers: Map<string, Set<Function>> = new Map();
interface DrawdownTracker {
  peakEquity: number;
  currentEquity: number;
  currentDrawdownPct: number;
  breakerTriggered: boolean;
  lastUpdated: number;
}
interface PositionSyncState {
  positions: AggregatedPosition[];
  lastSyncedAt: number;
  syncing: boolean;
}
} // R119 class wrapper