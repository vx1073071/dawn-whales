// ── Risk-Strategy Integrator — Deep Integration Layer ──────────────────────
// J-30-02: Dawn Whales
//
// Bridges RiskEngineV3 (multi-broker risk aggregation) with StrategyRunner
// (automated strategy execution) via UnifiedAccountManager (cross-broker
// account/position management).
//
// Responsibilities:
//   1. Circuit-breaker triggers — halt all strategies when drawdown or market
//      decline exceeds configurable thresholds
//   2. Position-limit enforcement — validate broker positions before allowing
//      new orders to prevent over-concentration
//   3. Global risk alerts — aggregate warnings from risk engine, margin
//      utilization, exposure concentration, and circuit breakers
//   4. Broker position sync — ensure position data is fresh across all
//      connected brokers before running risk checks
//
// Architecture:
//   RiskEngineV3 ──┐
//                   ├── RiskStrategyIntegrator ──→ Events (UI / IPC / log)
//   StrategyRunner ─┘         │
//                             │
//   UnifiedAccountManager ────┘
//
// Usage:
//   const integrator = new RiskStrategyIntegrator(riskEngine, strategyRunner, uam);
//   integrator.start();
//   integrator.on('circuit-breaker', (evt) => notifyUI(evt));
//   // later...
//   integrator.stop();

import log from 'electron-log';
import { RiskEngineV3 } from './risk-engine-v3';
import type {
  AggregatedPortfolio,
  CircuitBreakerResult,
  ExposureResult,
  PortfolioMarginResult,
} from './risk-engine-v3';
import { StrategyRunner } from '../analysis/strategy-runner';
import type { UnifiedAccountManager, AggregatedPosition } from '../../broker/unified-account-manager';

// ── Exported Types ─────────────────────────────────────────────────────────

/** Risk assessment for a single strategy */
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

/** Individual risk factor contributing to assessment */
export interface RiskFactor {
  name: string;
  severity: 'info' | 'warning' | 'danger';
  value: number;
  threshold: number;
  description: string;
}

/** Circuit breaker status for the integrator */
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

/** Comprehensive risk summary across all systems */
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

/** A risk alert emitted by the integrator */
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

/** Order validation result */
export interface OrderValidation {
  allowed: boolean;
  reason?: string;
  riskScore?: number;
  warnings?: string[];
}

// ── Event Types ────────────────────────────────────────────────────────────

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

// ── Configuration ──────────────────────────────────────────────────────────

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

const DEFAULT_CONFIG: RiskIntegratorConfig = {
  drawdownCircuitBreakerEnabled: true,
  drawdownThreshold: 0.15,
  drawdownRecoveryThreshold: 0.10,
  maxSinglePositionPct: 0.20,
  maxTotalExposurePct: 0.80,
  marginWarningThreshold: 0.70,
  marginDangerThreshold: 0.85,
  concentrationWarningThreshold: 0.25,
  monitoredMarkets: ['HK', 'US', 'CN'],
  pollIntervalMs: 15_000,
  maxAlerts: 200,
  positionSyncIntervalMs: 30_000,
};

// ── Typed Event Emitter ────────────────────────────────────────────────────

type EventMap = Record<string, (...args: unknown[]) => void>;

class TypedEventEmitter<T extends EventMap> {
  private handlers: Map<string, Set<Function>> = new Map();

  on<K extends keyof T & string>(event: K, listener: T[K]): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(listener);
    return () => {
      this.handlers.get(event)?.delete(listener);
    };
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): void {
    this.handlers.get(event)?.delete(listener);
  }

  protected emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(...args);
      } catch (err) {
        log.error(`[RiskStrategyIntegrator] Event listener error for "${event}":`, err);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

// ── Internal State ─────────────────────────────────────────────────────────

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

// ════════════════════════════════════════════════════════════════════════════
//  RiskStrategyIntegrator
// ════════════════════════════════════════════════════════════════════════════

/**
 * Deep integration layer between RiskEngineV3, StrategyRunner, and
 * UnifiedAccountManager. Provides:
 *
 * - Automatic circuit-breaker triggers that pause all strategies when
 *   drawdown or market decline exceeds thresholds
 * - Position-limit enforcement checked before every order
 * - Global risk alert aggregation from all subsystems
 * - Broker position synchronization before risk evaluations
 *
 * The integrator runs a periodic monitoring loop that polls all subsystems,
 * evaluates risk holistically, and emits typed events for UI/IPC consumers.
 */
export class RiskStrategyIntegrator extends TypedEventEmitter<IntegratorEvents> {
  private riskEngine: RiskEngineV3;
  private strategyRunner: StrategyRunner;
  private uam: UnifiedAccountManager;
  private config: RiskIntegratorConfig;

  /** Monitoring loop timer */
  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  /** Whether the integrator is actively monitoring */
  private running = false;

  /** Track drawdown state across evaluations */
  private drawdownTracker: DrawdownTracker = {
    peakEquity: 0,
    currentEquity: 0,
    currentDrawdownPct: 0,
    breakerTriggered: false,
    lastUpdated: 0,
  };

  /** Cached position sync state */
  private positionSync: PositionSyncState = {
    positions: [],
    lastSyncedAt: 0,
    syncing: false,
  };

  /** Set of strategy IDs paused by the integrator (circuit breaker) */
  private pausedStrategies: Set<string> = new Set();

  /** Strategy IDs that were running before we paused them (for resume) */
  private previouslyRunning: Set<string> = new Set();

  /** Alert history */
  private alerts: RiskAlert[] = [];

  /** Alert ID counter */
  private alertCounter = 0;

  /** Last known margin result */
  private lastMarginResult: PortfolioMarginResult | null = null;

  /** Last known exposure result */
  private lastExposureResult: ExposureResult | null = null;

  /** Last known portfolio */
  private lastPortfolio: AggregatedPortfolio | null = null;

  /** Last known circuit breaker results */
  private lastCircuitBreakers: CircuitBreakerResult[] = [];

  // ── Constructor ──────────────────────────────────────────────────────────

  /**
   * @param riskEngine     RiskEngineV3 instance for multi-broker risk checks
   * @param strategyRunner StrategyRunner instance for strategy lifecycle control
   * @param uam            UnifiedAccountManager for cross-broker position/account data
   * @param config         Optional partial config (merged with defaults)
   */
  constructor(
    riskEngine: RiskEngineV3,
    strategyRunner: StrategyRunner,
    uam: UnifiedAccountManager,
    config?: Partial<RiskIntegratorConfig>,
  ) {
    super();
    this.riskEngine = riskEngine;
    this.strategyRunner = strategyRunner;
    this.uam = uam;
    this.config = { ...DEFAULT_CONFIG, ...config };

    log.info(
      `[RiskStrategyIntegrator] Initialized — drawdown threshold: ` +
      `${(this.config.drawdownThreshold * 100).toFixed(0)}%, ` +
      `poll interval: ${this.config.pollIntervalMs}ms, ` +
      `monitored markets: [${this.config.monitoredMarkets.join(', ')}]`,
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Start the monitoring loop. Polls subsystems at the configured interval,
   * evaluates risk, syncs positions, and triggers circuit breakers as needed.
   */
  start(): void {
    if (this.running) {
      log.warn('[RiskStrategyIntegrator] Already running');
      return;
    }

    this.running = true;
    log.info('[RiskStrategyIntegrator] 🟢 Monitoring started');

    // Run an initial evaluation immediately
    this.runMonitorCycle().catch((err) => {
      log.error('[RiskStrategyIntegrator] Initial monitor cycle failed:', err);
    });

    // Start periodic monitoring
    this.monitorTimer = setInterval(() => {
      this.runMonitorCycle().catch((err) => {
        log.error('[RiskStrategyIntegrator] Monitor cycle error:', err);
      });
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop the monitoring loop. Does NOT automatically resume paused strategies.
   * Call resumeAllStrategies() explicitly if desired.
   */
  stop(): void {
    if (!this.running) {
      log.warn('[RiskStrategyIntegrator] Not running');
      return;
    }

    this.running = false;

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    log.info('[RiskStrategyIntegrator] 🔴 Monitoring stopped');
  }

  /**
   * Clean up all state, stop monitoring, remove listeners.
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.alerts = [];
    this.pausedStrategies.clear();
    this.previouslyRunning.clear();
    log.info('[RiskStrategyIntegrator] Destroyed');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  MONITORING CYCLE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Single monitoring cycle. Runs all checks in sequence:
   * 1. Sync broker positions
   * 2. Aggregate portfolio
   * 3. Check margin utilization
   * 4. Check portfolio exposure
   * 5. Check market circuit breakers
   * 6. Evaluate drawdown
   * 7. Generate alerts and emit events
   */
  private async runMonitorCycle(): Promise<void> {
    if (!this.running) return;

    log.debug('[RiskStrategyIntegrator] ── Monitor cycle start ──');

    // 1. Sync positions across brokers
    await this.syncBrokerPositions();

    // 2. Aggregate portfolio (all brokers)
    await this.refreshPortfolio();

    // 3. Margin utilization check
    await this.checkMarginUtilization();

    // 4. Exposure / concentration check
    await this.checkExposure();

    // 5. Market circuit breakers
    await this.checkMarketCircuitBreakers();

    // 6. Drawdown evaluation (may trigger circuit breaker)
    if (this.config.drawdownCircuitBreakerEnabled) {
      this.evaluateDrawdown();
    }

    // 7. Check if any position limits are breached for running strategies
    this.checkPositionLimitsForRunningStrategies();

    log.debug('[RiskStrategyIntegrator] ── Monitor cycle complete ──');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  1. BROKER POSITION SYNC
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Synchronize positions across all connected brokers via UAM.
   * Respects the positionSyncIntervalMs to avoid excessive API calls.
   * Invalidates RiskEngineV3 cache when fresh data is fetched.
   */
  private async syncBrokerPositions(): Promise<void> {
    const now = Date.now();
    const age = now - this.positionSync.lastSyncedAt;

    if (age < this.config.positionSyncIntervalMs && this.positionSync.positions.length > 0) {
      log.debug('[RiskStrategyIntegrator] Position cache still fresh, skipping sync');
      return;
    }

    if (this.positionSync.syncing) {
      log.debug('[RiskStrategyIntegrator] Position sync already in progress');
      return;
    }

    this.positionSync.syncing = true;

    try {
      const positions = await this.uam.getAggregatedPositions();
      this.positionSync.positions = positions;
      this.positionSync.lastSyncedAt = Date.now();

      // Invalidate RiskEngineV3 cache so next aggregation gets fresh data
      this.riskEngine.invalidateCache();

      log.debug(
        `[RiskStrategyIntegrator] Synced ${positions.length} aggregated positions from brokers`,
      );
    } catch (err) {
      log.error('[RiskStrategyIntegrator] Position sync failed:', err);
    } finally {
      this.positionSync.syncing = false;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  2. PORTFOLIO AGGREGATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Refresh the aggregated portfolio view from RiskEngineV3.
   */
  private async refreshPortfolio(): Promise<void> {
    try {
      const brokerIds = this.config.monitoredMarkets.length > 0
        ? ['futu', 'moomoo', 'ib', 'longbridge']
        : [];

      const result = await this.riskEngine.aggregateAccounts({
        brokerIds,
        forceRefresh: false,
      });

      if (result.portfolio) {
        this.lastPortfolio = result.portfolio;
        log.debug(
          `[RiskStrategyIntegrator] Portfolio: $${result.portfolio.totalAssets.toFixed(2)} total, ` +
          `leverage ${result.portfolio.leverageRatio.toFixed(2)}`,
        );
      }

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          this.addAlert('warning', 'portfolio', 'Broker Aggregation Error',
            `Broker "${err.brokerId}": ${err.error}`);
        }
      }
    } catch (err) {
      log.error('[RiskStrategyIntegrator] Portfolio refresh failed:', err);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  3. MARGIN UTILIZATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check margin utilization across all brokers.
   * Emits risk-warning alerts when thresholds are breached.
   */
  private async checkMarginUtilization(): Promise<void> {
    try {
      const margin = await this.riskEngine.getMarginUtilization();
      this.lastMarginResult = margin;

      if (margin.anyMarginCallRisk) {
        for (const account of margin.accounts) {
          if (account.marginCallRisk === 'danger') {
            this.addAlert(
              'danger',
              'margin',
              'Margin Call Danger',
              `Broker "${account.brokerId}" account ${account.accountId}: ` +
              `margin utilization ${(account.utilizationRatio * 100).toFixed(1)}% — ` +
              `immediate risk of margin call`,
            );
          } else if (account.marginCallRisk === 'warning') {
            this.addAlert(
              'warning',
              'margin',
              'Margin Utilization Warning',
              `Broker "${account.brokerId}" account ${account.accountId}: ` +
              `margin utilization ${(account.utilizationRatio * 100).toFixed(1)}%`,
            );
          }
        }
      }

      log.debug(
        `[RiskStrategyIntegrator] Margin: max utilization ${margin.maxUtilization.toFixed(1)}%, ` +
        `any risk: ${margin.anyMarginCallRisk}`,
      );
    } catch (err) {
      log.error('[RiskStrategyIntegrator] Margin check failed:', err);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  4. EXPOSURE / CONCENTRATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check portfolio exposure distribution and concentration risk.
   */
  private async checkExposure(): Promise<void> {
    try {
      const exposure = await this.riskEngine.getPortfolioExposure();
      this.lastExposureResult = exposure;

      // Concentration risk warning
      if (exposure.concentrationRisk > this.config.concentrationWarningThreshold) {
        this.addAlert(
          'warning',
          'exposure',
          'High Concentration Risk',
          `HHI index: ${exposure.concentrationRisk.toFixed(2)} ` +
          `(threshold: ${this.config.concentrationWarningThreshold.toFixed(2)}). ` +
          `Portfolio is overly concentrated in specific sectors.`,
        );
      }

      // Check individual sector weights
      for (const [sector, weight] of Object.entries(exposure.bySector)) {
        const weightPct = weight / 100; // exposure values are in percentage form
        if (weightPct > this.config.maxSinglePositionPct) {
          this.addAlert(
            'warning',
            'exposure',
            `Sector Over-Weight: ${sector}`,
            `Sector "${sector}" weight: ${(weightPct * 100).toFixed(1)}% ` +
            `(limit: ${(this.config.maxSinglePositionPct * 100).toFixed(0)}%)`,
          );
        }
      }

      log.debug(
        `[RiskStrategyIntegrator] Exposure: HHI=${exposure.concentrationRisk.toFixed(2)}, ` +
        `top sectors: ${Object.keys(exposure.bySector).slice(0, 3).join(', ')}`,
      );
    } catch (err) {
      log.error('[RiskStrategyIntegrator] Exposure check failed:', err);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  5. MARKET CIRCUIT BREAKERS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check circuit breaker status for all monitored markets.
   */
  private async checkMarketCircuitBreakers(): Promise<void> {
    const results: CircuitBreakerResult[] = [];

    for (const market of this.config.monitoredMarkets) {
      try {
        const result = await this.riskEngine.checkCircuitBreaker(market);
        results.push(result);

        if (result.status === 'halted') {
          this.addAlert(
            'critical',
            'circuit-breaker',
            `Market Halted: ${market}`,
            result.reason ?? `Market ${market} circuit breaker activated at level ${result.triggerLevel}`,
          );

          // A halted market triggers the global circuit breaker
          if (!this.drawdownTracker.breakerTriggered) {
            this.triggerCircuitBreaker(
              `Market circuit breaker: ${market} halted (Level ${result.triggerLevel})`,
            );
          }
        } else if (result.status === 'resume_pending') {
          this.addAlert(
            'warning',
            'circuit-breaker',
            `Market Circuit Breaker Warning: ${market}`,
            result.reason ?? `Market ${market} Level ${result.triggerLevel} warning`,
          );
        }
      } catch (err) {
        log.error(`[RiskStrategyIntegrator] Circuit breaker check failed for ${market}:`, err);
      }
    }

    this.lastCircuitBreakers = results;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  6. DRAWDOWN EVALUATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Evaluate portfolio drawdown. If it exceeds the configured threshold,
   * trigger the global circuit breaker and pause all strategies.
   */
  private evaluateDrawdown(): void {
    if (!this.lastPortfolio) return;

    const currentEquity = this.lastPortfolio.totalAssets;
    if (currentEquity <= 0) return;

    const tracker = this.drawdownTracker;

    // Update peak equity
    if (currentEquity > tracker.peakEquity) {
      tracker.peakEquity = currentEquity;
    }

    // Calculate drawdown from peak
    const drawdownPct = tracker.peakEquity > 0
      ? (tracker.peakEquity - currentEquity) / tracker.peakEquity
      : 0;

    tracker.currentEquity = currentEquity;
    tracker.currentDrawdownPct = drawdownPct;
    tracker.lastUpdated = Date.now();

    // Check if drawdown exceeds threshold
    if (drawdownPct >= this.config.drawdownThreshold && !tracker.breakerTriggered) {
      log.warn(
        `[RiskStrategyIntegrator] ⚠️ Drawdown ${(drawdownPct * 100).toFixed(1)}% ` +
        `exceeds threshold ${(this.config.drawdownThreshold * 100).toFixed(0)}% — ` +
        `triggering circuit breaker`,
      );
      tracker.breakerTriggered = true;
      this.triggerCircuitBreaker(
        `Portfolio drawdown ${(drawdownPct * 100).toFixed(1)}% from peak ` +
        `$${tracker.peakEquity.toFixed(2)} → $${currentEquity.toFixed(2)}`,
      );
    }

    // Check if drawdown has recovered enough to allow resume
    if (tracker.breakerTriggered && drawdownPct <= this.config.drawdownRecoveryThreshold) {
      log.info(
        `[RiskStrategyIntegrator] ✅ Drawdown recovered to ${(drawdownPct * 100).toFixed(1)}% ` +
        `(below recovery threshold ${(this.config.drawdownRecoveryThreshold * 100).toFixed(0)}%)`,
      );
      // Note: We do NOT auto-resume. The user must call resumeAllStrategies() explicitly.
      // But we do reset the breaker flag so it can trigger again if drawdown worsens.
      tracker.breakerTriggered = false;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  CIRCUIT BREAKER ACTIONS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Trigger the global circuit breaker: pause all running strategies,
   * emit events, and log the incident.
   */
  private triggerCircuitBreaker(reason: string): void {
    log.warn(`[RiskStrategyIntegrator] 🚨 CIRCUIT BREAKER TRIGGERED: ${reason}`);

    // Record which strategies are currently running so we can resume them later
    const runningStatuses = this.strategyRunner.getStatus();
    this.previouslyRunning.clear();
    for (const status of runningStatuses) {
      if (status.running) {
        this.previouslyRunning.add(status.strategyId);
      }
    }

    // Pause all running strategies
    this.pauseAllStrategies();

    // Emit circuit-breaker event
    this.emit('circuit-breaker', {
      active: true,
      reason,
      drawdownPct: this.drawdownTracker.currentDrawdownPct,
      pausedStrategies: Array.from(this.pausedStrategies),
      timestamp: Date.now(),
    });

    // Add critical alert
    this.addAlert('critical', 'circuit-breaker', 'Global Circuit Breaker Activated', reason);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  7. POSITION LIMIT ENFORCEMENT (for running strategies)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check if any running strategies are violating position limits.
   * Emits position-limit events for violations.
   */
  private checkPositionLimitsForRunningStrategies(): void {
    if (!this.lastPortfolio || this.lastPortfolio.totalAssets <= 0) return;

    const runningStatuses = this.strategyRunner.getStatus();

    for (const status of runningStatuses) {
      if (!status.running) continue;

      // Check total exposure limit
      const exposurePct = this.lastPortfolio.totalExposure / this.lastPortfolio.totalAssets;
      if (exposurePct >= this.config.maxTotalExposurePct) {
        this.emit('position-limit', {
          strategyId: status.strategyId,
          symbol: status.symbol,
          currentValue: this.lastPortfolio.totalExposure,
          limitValue: this.lastPortfolio.totalAssets * this.config.maxTotalExposurePct,
          utilizationPct: exposurePct,
          timestamp: Date.now(),
        });

        this.addAlert(
          'warning',
          'position-limit',
          `Total Exposure Limit Reached`,
          `Strategy "${status.strategyName}" (${status.symbol}): ` +
          `total exposure ${(exposurePct * 100).toFixed(1)}% ` +
          `exceeds limit ${(this.config.maxTotalExposurePct * 100).toFixed(0)}%`,
          status.strategyId,
        );
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Risk Evaluation
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Evaluate risk for a specific strategy. Returns a comprehensive
   * RiskAssessment with risk score, contributing factors, and recommendation.
   *
   * @param strategyId The strategy to evaluate
   */
  evaluateRisk(strategyId: string): RiskAssessment {
    const statuses = this.strategyRunner.getStatus(strategyId);
    const status = statuses.length > 0 ? statuses[0] : null;

    const factors: RiskFactor[] = [];
    let score = 0;

    // Factor 1: Drawdown
    const drawdownPct = this.drawdownTracker.currentDrawdownPct;
    const drawdownScore = Math.min(30, drawdownPct * 200); // 15% drawdown → 30 points
    score += drawdownScore;
    if (drawdownPct > 0.05) {
      factors.push({
        name: 'Portfolio Drawdown',
        severity: drawdownPct >= this.config.drawdownThreshold ? 'danger' : 'warning',
        value: drawdownPct,
        threshold: this.config.drawdownThreshold,
        description: `Current drawdown: ${(drawdownPct * 100).toFixed(1)}%`,
      });
    }

    // Factor 2: Margin utilization
    const marginUtil = this.lastMarginResult?.maxUtilization ?? 0;
    const marginScore = marginUtil > this.config.marginDangerThreshold ? 30
      : marginUtil > this.config.marginWarningThreshold ? 15 : 0;
    score += marginScore;
    if (marginUtil > this.config.marginWarningThreshold) {
      factors.push({
        name: 'Margin Utilization',
        severity: marginUtil >= this.config.marginDangerThreshold ? 'danger' : 'warning',
        value: marginUtil,
        threshold: this.config.marginDangerThreshold,
        description: `Max margin utilization: ${(marginUtil * 100).toFixed(1)}%`,
      });
    }

    // Factor 3: Concentration risk
    const concentration = this.lastExposureResult?.concentrationRisk ?? 0;
    const concentrationScore = concentration > this.config.concentrationWarningThreshold ? 20 : 0;
    score += concentrationScore;
    if (concentration > this.config.concentrationWarningThreshold) {
      factors.push({
        name: 'Concentration Risk',
        severity: 'warning',
        value: concentration,
        threshold: this.config.concentrationWarningThreshold,
        description: `HHI index: ${concentration.toFixed(2)}`,
      });
    }

    // Factor 4: Circuit breaker status
    const cbActive = this.drawdownTracker.breakerTriggered ||
      this.lastCircuitBreakers.some((cb) => cb.status === 'halted');
    if (cbActive) {
      score += 20;
      factors.push({
        name: 'Circuit Breaker',
        severity: 'danger',
        value: 1,
        threshold: 0,
        description: 'Circuit breaker is active — trading halted',
      });
    }

    // Factor 5: Position limit
    const positionLimitReached = this.isPositionLimitReached();
    if (positionLimitReached) {
      score += 15;
      factors.push({
        name: 'Position Limit',
        severity: 'warning',
        value: this.lastPortfolio?.leverageRatio ?? 0,
        threshold: this.config.maxTotalExposurePct,
        description: 'Total exposure limit reached',
      });
    }

    // Factor 6: Strategy error count
    if (status && status.errorCount > 0) {
      const errorScore = Math.min(10, status.errorCount * 2);
      score += errorScore;
      factors.push({
        name: 'Strategy Errors',
        severity: status.errorCount > 3 ? 'warning' : 'info',
        value: status.errorCount,
        threshold: 5,
        description: `${status.errorCount} errors recorded`,
      });
    }

    // Cap score at 100
    score = Math.min(100, Math.round(score));

    // Determine overall risk level
    let overallRisk: RiskAssessment['overallRisk'];
    if (score >= 70) overallRisk = 'critical';
    else if (score >= 45) overallRisk = 'high';
    else if (score >= 20) overallRisk = 'medium';
    else overallRisk = 'low';

    // Generate recommendation
    const recommendation = this.generateRecommendation(overallRisk, factors);

    const assessment: RiskAssessment = {
      strategyId,
      strategyName: status?.strategyName ?? strategyId,
      symbol: status?.symbol ?? '',
      overallRisk,
      score,
      factors,
      drawdownPct,
      marginUtilization: marginUtil,
      concentrationRisk: concentration,
      circuitBreakerActive: cbActive,
      positionLimitReached,
      recommendation,
      timestamp: Date.now(),
    };

    this.emit('risk-assessment', assessment);
    return assessment;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Order Validation
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check whether an order should be allowed based on current risk state.
   * Evaluates circuit breaker status, position limits, margin, and exposure.
   *
   * @param strategyId The strategy requesting the order
   * @param order      The order details (code, side, qty, price, etc.)
   */
  shouldAllowOrder(strategyId: string, order: unknown): OrderValidation {
    const warnings: string[] = [];

    // Check 1: Circuit breaker
    if (this.drawdownTracker.breakerTriggered) {
      return {
        allowed: false,
        reason: `Circuit breaker active — drawdown ${(this.drawdownTracker.currentDrawdownPct * 100).toFixed(1)}%`,
        riskScore: 100,
        warnings,
      };
    }

    // Check 2: Market circuit breakers
    const haltedMarket = this.lastCircuitBreakers.find((cb) => cb.status === 'halted');
    if (haltedMarket) {
      return {
        allowed: false,
        reason: `Market circuit breaker: ${haltedMarket.market} halted — ${haltedMarket.reason}`,
        riskScore: 95,
        warnings,
      };
    }

    // Check 3: Strategy is paused
    if (this.pausedStrategies.has(strategyId)) {
      return {
        allowed: false,
        reason: `Strategy "${strategyId}" is paused by risk integrator`,
        riskScore: 90,
        warnings,
      };
    }

    // Check 4: Total exposure limit
    if (this.lastPortfolio && this.lastPortfolio.totalAssets > 0) {
      const exposurePct = this.lastPortfolio.totalExposure / this.lastPortfolio.totalAssets;
      if (exposurePct >= this.config.maxTotalExposurePct) {
        return {
          allowed: false,
          reason: `Total exposure ${(exposurePct * 100).toFixed(1)}% exceeds limit ` +
            `${(this.config.maxTotalExposurePct * 100).toFixed(0)}%`,
          riskScore: 80,
          warnings,
        };
      }
    }

    // Check 5: Margin danger
    if (this.lastMarginResult?.anyMarginCallRisk) {
      const maxUtil = this.lastMarginResult.maxUtilization;
      if (maxUtil >= this.config.marginDangerThreshold) {
        return {
          allowed: false,
          reason: `Margin utilization ${(maxUtil * 100).toFixed(1)}% in danger zone`,
          riskScore: 75,
          warnings,
        };
      }
      warnings.push(`Margin utilization elevated: ${(maxUtil * 100).toFixed(1)}%`);
    }

    // Check 6: Single position concentration (if order has a code)
    if (order?.code && this.lastPortfolio && this.lastPortfolio.totalAssets > 0) {
      const existingPosition = this.positionSync.positions.find((p) => p.code === order.code);
      if (existingPosition) {
        const positionPct = existingPosition.totalValue / this.lastPortfolio.totalAssets;
        if (positionPct >= this.config.maxSinglePositionPct) {
          return {
            allowed: false,
            reason: `Position "${order.code}" already at ${(positionPct * 100).toFixed(1)}% ` +
              `(limit: ${(this.config.maxSinglePositionPct * 100).toFixed(0)}%)`,
            riskScore: 65,
            warnings,
          };
        }
      }
    }

    // All checks passed — calculate a risk score based on current state
    let riskScore = 0;
    riskScore += Math.min(20, this.drawdownTracker.currentDrawdownPct * 100);
    riskScore += (this.lastMarginResult?.maxUtilization ?? 0) * 15;
    riskScore += (this.lastExposureResult?.concentrationRisk ?? 0) * 10;
    riskScore = Math.min(100, Math.round(riskScore));

    if (riskScore > 40) {
      warnings.push(`Elevated risk score: ${riskScore}`);
    }

    return {
      allowed: true,
      riskScore,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Circuit Breaker Status
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Get the current circuit breaker status including both market-level
   * and drawdown-based breakers.
   */
  getCircuitBreakerStatus(): CircuitBreakerStatus {
    const tracker = this.drawdownTracker;

    return {
      active: tracker.breakerTriggered ||
        this.lastCircuitBreakers.some((cb) => cb.status === 'halted'),
      triggeredAt: tracker.breakerTriggered ? tracker.lastUpdated : null,
      reason: tracker.breakerTriggered
        ? `Drawdown ${(tracker.currentDrawdownPct * 100).toFixed(1)}% from peak $${tracker.peakEquity.toFixed(2)}`
        : this.lastCircuitBreakers
            .filter((cb) => cb.status === 'halted')
            .map((cb) => cb.reason ?? `${cb.market} halted`)
            .join('; ') || 'No active circuit breaker',
      marketBreakers: [...this.lastCircuitBreakers],
      drawdownBreaker: {
        active: tracker.breakerTriggered,
        currentDrawdownPct: tracker.currentDrawdownPct,
        thresholdPct: this.config.drawdownThreshold,
        peakEquity: tracker.peakEquity,
        currentEquity: tracker.currentEquity,
      },
      pausedStrategies: Array.from(this.pausedStrategies),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Risk Summary
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Get a comprehensive risk summary aggregating data from all subsystems.
   */
  getRiskSummary(): RiskSummary {
    const portfolio = this.lastPortfolio;
    const margin = this.lastMarginResult;
    const exposure = this.lastExposureResult;
    const cbStatus = this.getCircuitBreakerStatus();
    const runningStatuses = this.strategyRunner.getStatus();

    // Determine overall status
    let overallStatus: RiskSummary['overallStatus'] = 'healthy';
    if (cbStatus.active || this.alerts.some((a) => a.severity === 'critical' && !a.acknowledged)) {
      overallStatus = 'critical';
    } else if (this.alerts.some((a) => a.severity === 'danger' && !a.acknowledged)) {
      overallStatus = 'critical';
    } else if (this.alerts.some((a) => a.severity === 'warning' && !a.acknowledged)) {
      overallStatus = 'warning';
    }

    // Build top sectors from exposure
    const topSectors = exposure
      ? Object.entries(exposure.bySector)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([sector, weight]) => ({ sector, weight }))
      : [];

    // Build top positions from exposure
    const topPositions = exposure
      ? exposure.topPositions.slice(0, 5).map((p) => ({ code: p.code, weight: p.weight }))
      : [];

    // Circuit breaker details
    const cbDetails: string[] = [];
    if (cbStatus.drawdownBreaker.active) {
      cbDetails.push(
        `Drawdown: ${(cbStatus.drawdownBreaker.currentDrawdownPct * 100).toFixed(1)}%`,
      );
    }
    for (const cb of cbStatus.marketBreakers) {
      if (cb.status !== 'open') {
        cbDetails.push(`${cb.market}: ${cb.status} (Level ${cb.triggerLevel})`);
      }
    }

    // Count paused vs running strategies
    const totalStrategies = runningStatuses.length;
    const runningStrategies = runningStatuses.filter((s) => s.running && !this.pausedStrategies.has(s.strategyId)).length;
    const pausedCount = this.pausedStrategies.size;
    const errorCount = runningStatuses.reduce((sum, s) => sum + s.errorCount, 0);

    return {
      timestamp: Date.now(),
      overallStatus,
      portfolio: {
        totalAssets: portfolio?.totalAssets ?? 0,
        totalExposure: portfolio?.totalExposure ?? 0,
        leverageRatio: portfolio?.leverageRatio ?? 0,
        netExposure: portfolio?.netExposure ?? 0,
      },
      margin: {
        totalUsed: margin?.totalMarginUsed ?? 0,
        totalAvailable: margin?.totalMarginAvailable ?? 0,
        maxUtilization: margin?.maxUtilization ?? 0,
        anyMarginCallRisk: margin?.anyMarginCallRisk ?? false,
      },
      exposure: {
        concentrationRisk: exposure?.concentrationRisk ?? 0,
        topSectors,
        topPositions,
      },
      circuitBreakers: {
        active: cbStatus.active,
        count: cbDetails.length,
        details: cbDetails,
      },
      strategies: {
        total: totalStrategies,
        running: runningStrategies,
        paused: pausedCount,
        errorCount,
      },
      alerts: this.getRecentAlerts(20),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Strategy Pause / Resume
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Emergency pause: stop all running strategies immediately.
   * Records which strategies were paused so they can be resumed later.
   */
  pauseAllStrategies(): void {
    const runningStatuses = this.strategyRunner.getStatus();
    let pausedCount = 0;

    for (const status of runningStatuses) {
      if (!status.running) continue;
      if (this.pausedStrategies.has(status.strategyId)) continue;

      this.strategyRunner.stop(status.strategyId);
      this.pausedStrategies.add(status.strategyId);
      pausedCount++;

      this.emit('strategy-paused', {
        strategyId: status.strategyId,
        strategyName: status.strategyName,
        reason: 'Circuit breaker — global pause',
        pausedAt: Date.now(),
      });

      log.info(
        `[RiskStrategyIntegrator] ⏸️ Paused strategy: ${status.strategyId} "${status.strategyName}"`,
      );
    }

    log.info(`[RiskStrategyIntegrator] Paused ${pausedCount} strategies`);
  }

  /**
   * Resume all strategies that were previously paused by the integrator.
   * Only resumes strategies that were running before the pause.
   */
  resumeAllStrategies(): void {
    if (this.pausedStrategies.size === 0) {
      log.info('[RiskStrategyIntegrator] No strategies to resume');
      return;
    }

    // Check if circuit breaker is still active
    const cbStatus = this.getCircuitBreakerStatus();
    if (cbStatus.active) {
      log.warn(
        '[RiskStrategyIntegrator] Cannot resume: circuit breaker still active. ' +
        'Resolve the underlying issue first.',
      );
      return;
    }

    let resumedCount = 0;

    for (const strategyId of this.pausedStrategies) {
      if (!this.previouslyRunning.has(strategyId)) continue;

      this.strategyRunner.start(strategyId, 'live-run');
      resumedCount++;

      const status = this.strategyRunner.getStatus(strategyId);
      const name = status.length > 0 ? status[0].strategyName : strategyId;

      this.emit('strategy-resumed', {
        strategyId,
        strategyName: name,
        resumedAt: Date.now(),
      });

      log.info(`[RiskStrategyIntegrator] ▶️ Resumed strategy: ${strategyId} "${name}"`);
    }

    this.pausedStrategies.clear();
    this.previouslyRunning.clear();

    log.info(`[RiskStrategyIntegrator] Resumed ${resumedCount} strategies`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Alert Management
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Get recent alerts, optionally filtered by severity.
   * Most recent first.
   */
  getRecentAlerts(limit = 50, severity?: RiskAlert['severity']): RiskAlert[] {
    let filtered = [...this.alerts];
    if (severity) {
      filtered = filtered.filter((a) => a.severity === severity);
    }
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    return filtered.slice(0, limit);
  }

  /**
   * Acknowledge an alert by ID.
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Acknowledge all unacknowledged alerts.
   */
  acknowledgeAllAlerts(): void {
    for (const alert of this.alerts) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get the count of unacknowledged alerts by severity.
   */
  getUnacknowledgedCount(): Record<RiskAlert['severity'], number> {
    const counts: Record<RiskAlert['severity'], number> = {
      info: 0,
      warning: 0,
      danger: 0,
      critical: 0,
    };

    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        counts[alert.severity]++;
      }
    }

    return counts;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Configuration
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Update configuration at runtime. Partial merge with existing config.
   */
  updateConfig(partial: Partial<RiskIntegratorConfig>): void {
    const oldPollInterval = this.config.pollIntervalMs;
    this.config = { ...this.config, ...partial };

    // If poll interval changed, restart the timer
    if (partial.pollIntervalMs && partial.pollIntervalMs !== oldPollInterval && this.running) {
      log.info(
        `[RiskStrategyIntegrator] Poll interval changed: ${oldPollInterval}ms → ${this.config.pollIntervalMs}ms`,
      );
      this.stop();
      this.start();
    }

    log.info('[RiskStrategyIntegrator] Configuration updated');
  }

  /**
   * Get the current configuration (read-only copy).
   */
  getConfig(): Readonly<RiskIntegratorConfig> {
    return { ...this.config };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API — Status Queries
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check if the integrator is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the set of strategy IDs currently paused by the integrator.
   */
  getPausedStrategyIds(): string[] {
    return Array.from(this.pausedStrategies);
  }

  /**
   * Check if a specific strategy is paused by the integrator.
   */
  isStrategyPaused(strategyId: string): boolean {
    return this.pausedStrategies.has(strategyId);
  }

  /**
   * Get the current drawdown tracker state.
   */
  getDrawdownState(): Readonly<DrawdownTracker> {
    return { ...this.drawdownTracker };
  }

  /**
   * Get the last synced positions.
   */
  getLastSyncedPositions(): AggregatedPosition[] {
    return [...this.positionSync.positions];
  }

  /**
   * Reset the drawdown peak tracker. Use with caution — typically only
   * after a new trading session begins.
   */
  resetDrawdownTracker(): void {
    this.drawdownTracker = {
      peakEquity: this.lastPortfolio?.totalAssets ?? 0,
      currentEquity: this.lastPortfolio?.totalAssets ?? 0,
      currentDrawdownPct: 0,
      breakerTriggered: false,
      lastUpdated: Date.now(),
    };
    log.info('[RiskStrategyIntegrator] Drawdown tracker reset');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Check if total position limit has been reached.
   */
  private isPositionLimitReached(): boolean {
    if (!this.lastPortfolio || this.lastPortfolio.totalAssets <= 0) return false;
    const exposurePct = this.lastPortfolio.totalExposure / this.lastPortfolio.totalAssets;
    return exposurePct >= this.config.maxTotalExposurePct;
  }

  /**
   * Add a risk alert to the history and emit the risk-warning event.
   * Trims old alerts when the buffer exceeds maxAlerts.
   */
  private addAlert(
    severity: RiskAlert['severity'],
    source: string,
    title: string,
    message: string,
    strategyId?: string,
  ): void {
    this.alertCounter++;
    const alert: RiskAlert = {
      id: `alert_${Date.now().toString(36)}_${this.alertCounter.toString(36)}`,
      severity,
      source,
      title,
      message,
      strategyId,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Trim old alerts
    while (this.alerts.length > this.config.maxAlerts) {
      this.alerts.shift();
    }

    // Emit event
    this.emit('risk-warning', alert);

    // Also log
    const logFn = severity === 'critical' || severity === 'danger'
      ? log.warn
      : severity === 'warning'
        ? log.info
        : log.debug;

    logFn(`[RiskStrategyIntegrator] [${severity.toUpperCase()}] ${title}: ${message}`);
  }

  /**
   * Generate a human-readable recommendation based on risk assessment.
   */
  private generateRecommendation(
    overallRisk: RiskAssessment['overallRisk'],
    factors: RiskFactor[],
  ): string {
    switch (overallRisk) {
      case 'critical':
        return 'STOP TRADING immediately. Critical risk levels detected. ' +
          `Key concerns: ${factors.filter((f) => f.severity === 'danger').map((f) => f.name).join(', ')}. ` +
          'Review all open positions and reduce exposure.';

      case 'high':
        return 'REDUCE position sizes and avoid new entries. ' +
          `Elevated risk from: ${factors.filter((f) => f.severity !== 'info').map((f) => f.name).join(', ')}. ` +
          'Consider tightening stop-losses.';

      case 'medium':
        return 'PROCEED WITH CAUTION. Monitor closely. ' +
          `Watch: ${factors.map((f) => f.name).join(', ')}. ` +
          'Maintain current position sizes or reduce slightly.';

      case 'low':
        return 'Normal operations. Risk levels are within acceptable parameters.';

      default:
        return 'Unable to generate recommendation.';
    }
  }
}
