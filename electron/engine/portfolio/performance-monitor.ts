// JVS-107: Performance Monitoring Dashboard
// JVS-43-01: Enhanced with real-time metrics, multi-account comparison,
//            alert rules engine, and trend analysis
// Monitor system performance metrics in real-time

import log from 'electron-log';
import { EngineError, ErrorCode } from '../errors';


// ---------------------------------------------------------------------------
// Inline EventEmitter polyfill (no import from 'events')
// ---------------------------------------------------------------------------
class EventEmitter {
  private _events: Map<string | symbol, Set<Function>> = new Map();

  on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event)!.add(listener);
    return this;
  }

  once(event: string | symbol, listener: (...args: unknown[]) => void): this {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string | symbol, listener: (...args: unknown[]) => void): this {
    this._events.get(event)?.delete(listener);
    return this;
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.forEach(fn => fn(...args));
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  listenerCount(event: string | symbol): number {
    return this._events.get(event)?.size ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Original interfaces (JVS-107)
// ---------------------------------------------------------------------------

export interface PerformanceMetrics {
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  database: DatabaseMetrics;
  websocket: WebSocketMetrics;
}

export interface CPUMetrics {
  usage: number;
  loadAverage: number[];
  coreCount: number;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  connections: number;
  latency: number;
}

export interface DatabaseMetrics {
  queryCount: number;
  avgQueryTime: number;
  connectionPool: number;
  cacheHitRate: number;
}

export interface WebSocketMetrics {
  connections: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  errors: number;
}

export interface PerformanceAlert {
  type: 'cpu' | 'memory' | 'network' | 'database' | 'websocket';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface PerformanceDashboard {
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  history: PerformanceMetrics[];
}

export interface PerformanceThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  network: { latencyWarning: number; latencyCritical: number };
  database: { queryTimeWarning: number; queryTimeCritical: number };
  websocket: { connectionsWarning: number; connectionsCritical: number };
}

export interface HealthSummary {
  overall: 'healthy' | 'warning' | 'critical';
  cpu: 'healthy' | 'warning' | 'critical';
  memory: 'healthy' | 'warning' | 'critical';
  network: 'healthy' | 'warning' | 'critical';
  database: 'healthy' | 'warning' | 'critical';
  websocket: 'healthy' | 'warning' | 'critical';
  alertCount: number;
}

// ---------------------------------------------------------------------------
// New interfaces (JVS-43-01)
// ---------------------------------------------------------------------------

/** Real-time performance metrics snapshot */
export interface RealtimeMetrics {
  timestamp: number;
  cpuUsage: number;        // 0-100 (%)
  memoryUsage: number;     // 0-1000 (MB)
  latencyMs: number;       // 0-500 (ms)
  qps: number;             // queries per second
}

/** Per-account metrics for comparison */
export interface AccountMetrics {
  accountId: string;
  cpuUsage: number;
  memoryUsage: number;
  latencyMs: number;
  qps: number;
  timestamp: number;
}

/** Result of multi-account comparison */
export interface AccountComparisonResult {
  accounts: AccountMetrics[];
  averages: {
    cpuUsage: number;
    memoryUsage: number;
    latencyMs: number;
    qps: number;
  };
  best: {
    cpuUsage: string;      // accountId with lowest CPU
    memoryUsage: string;   // accountId with lowest memory
    latencyMs: string;     // accountId with lowest latency
    qps: string;           // accountId with highest QPS
  };
  worst: {
    cpuUsage: string;      // accountId with highest CPU
    memoryUsage: string;   // accountId with highest memory
    latencyMs: string;     // accountId with highest latency
    qps: string;           // accountId with lowest QPS
  };
  timestamp: number;
}

/** Alert type enumeration */
export type AlertType = 'CPU_HIGH' | 'MEMORY_HIGH' | 'LATENCY_HIGH' | 'QPS_LOW';

/** Alert severity */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** A triggered alert from the rules engine */
export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

/** A configurable alert rule */
export interface AlertRule {
  type: AlertType;
  metric: 'cpuUsage' | 'memoryUsage' | 'latencyMs' | 'qps';
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

/** Trend direction */
export type TrendDirection = 'increasing' | 'decreasing' | 'stable';

/** Result of trend analysis */
export interface TrendResult {
  metricName: string;
  direction: TrendDirection;
  slope: number;
  dataPoints: number[];
  windowSize: number;
  average: number;
  min: number;
  max: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// PerformanceMonitor class (original + enhanced)
// ---------------------------------------------------------------------------

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private alerts: PerformanceAlert[];
  private history: PerformanceMetrics[];
  private thresholds: PerformanceThresholds;
  private maxHistorySize: number;

  // JVS-43-01: New internal state
  private realtimeHistory: RealtimeMetrics[];
  private maxRealtimeHistory: number;
  private accountMetricsMap: Map<string, AccountMetrics>;
  private alertRules: AlertRule[];

  constructor(maxHistorySize: number = 100) {
    super();
    this.maxHistorySize = maxHistorySize;
    this.metrics = this.initializeMetrics();
    this.alerts = [];
    this.history = [];
    this.thresholds = this.getDefaultThresholds();

    // JVS-43-01: Initialize new state
    this.realtimeHistory = [];
    this.maxRealtimeHistory = 1000;
    this.accountMetricsMap = new Map();
    this.alertRules = this.getDefaultAlertRules();
  }

  // =========================================================================
  // Original methods (JVS-107) — preserved
  // =========================================================================

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
        coreCount: 0,
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
        heapUsed: 0,
        heapTotal: 0,
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        connections: 0,
        latency: 0,
      },
      database: {
        queryCount: 0,
        avgQueryTime: 0,
        connectionPool: 0,
        cacheHitRate: 0,
      },
      websocket: {
        connections: 0,
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        errors: 0,
      },
    };
  }

  /**
   * Get default performance thresholds
   */
  private getDefaultThresholds(): PerformanceThresholds {
    return {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 75, critical: 90 },
      network: { latencyWarning: 500, latencyCritical: 1000 },
      database: { queryTimeWarning: 100, queryTimeCritical: 500 },
      websocket: { connectionsWarning: 100, connectionsCritical: 500 },
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...metrics,
      timestamp: Date.now(),
    };

    // Add to history
    this.history.push({ ...this.metrics });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    const timestamp = Date.now();

    // Check CPU usage
    if (this.metrics.cpu.usage >= this.thresholds.cpu.critical) {
      this.addAlert({
        type: 'cpu',
        severity: 'critical',
        message: `CPU usage critical: ${this.metrics.cpu.usage}%`,
        value: this.metrics.cpu.usage,
        threshold: this.thresholds.cpu.critical,
        timestamp,
      });
    } else if (this.metrics.cpu.usage >= this.thresholds.cpu.warning) {
      this.addAlert({
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage high: ${this.metrics.cpu.usage}%`,
        value: this.metrics.cpu.usage,
        threshold: this.thresholds.cpu.warning,
        timestamp,
      });
    }

    // Check memory usage
    if (this.metrics.memory.percentage >= this.thresholds.memory.critical) {
      this.addAlert({
        type: 'memory',
        severity: 'critical',
        message: `Memory usage critical: ${this.metrics.memory.percentage}%`,
        value: this.metrics.memory.percentage,
        threshold: this.thresholds.memory.critical,
        timestamp,
      });
    } else if (this.metrics.memory.percentage >= this.thresholds.memory.warning) {
      this.addAlert({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage high: ${this.metrics.memory.percentage}%`,
        value: this.metrics.memory.percentage,
        threshold: this.thresholds.memory.warning,
        timestamp,
      });
    }

    // Check network latency
    if (this.metrics.network.latency >= this.thresholds.network.latencyCritical) {
      this.addAlert({
        type: 'network',
        severity: 'critical',
        message: `Network latency critical: ${this.metrics.network.latency}ms`,
        value: this.metrics.network.latency,
        threshold: this.thresholds.network.latencyCritical,
        timestamp,
      });
    } else if (this.metrics.network.latency >= this.thresholds.network.latencyWarning) {
      this.addAlert({
        type: 'network',
        severity: 'warning',
        message: `Network latency high: ${this.metrics.network.latency}ms`,
        value: this.metrics.network.latency,
        threshold: this.thresholds.network.latencyWarning,
        timestamp,
      });
    }

    // Check database query time
    if (this.metrics.database.avgQueryTime >= this.thresholds.database.queryTimeCritical) {
      this.addAlert({
        type: 'database',
        severity: 'critical',
        message: `Database query time critical: ${this.metrics.database.avgQueryTime}ms`,
        value: this.metrics.database.avgQueryTime,
        threshold: this.thresholds.database.queryTimeCritical,
        timestamp,
      });
    } else if (this.metrics.database.avgQueryTime >= this.thresholds.database.queryTimeWarning) {
      this.addAlert({
        type: 'database',
        severity: 'warning',
        message: `Database query time high: ${this.metrics.database.avgQueryTime}ms`,
        value: this.metrics.database.avgQueryTime,
        threshold: this.thresholds.database.queryTimeWarning,
        timestamp,
      });
    }

    // Check WebSocket connections
    if (this.metrics.websocket.connections >= this.thresholds.websocket.connectionsCritical) {
      this.addAlert({
        type: 'websocket',
        severity: 'critical',
        message: `WebSocket connections critical: ${this.metrics.websocket.connections}`,
        value: this.metrics.websocket.connections,
        threshold: this.thresholds.websocket.connectionsCritical,
        timestamp,
      });
    } else if (this.metrics.websocket.connections >= this.thresholds.websocket.connectionsWarning) {
      this.addAlert({
        type: 'websocket',
        severity: 'warning',
        message: `WebSocket connections high: ${this.metrics.websocket.connections}`,
        value: this.metrics.websocket.connections,
        threshold: this.thresholds.websocket.connectionsWarning,
        timestamp,
      });
    }
  }

  /**
   * Add a performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    // Notify listeners
    this.emit('alert', alert);
  }

  /** Register a callback for new performance alerts */
  onAlert(handler: (alert: PerformanceAlert) => void): void {
    this.on('alert', handler);
  }

  /**
   * Get current dashboard data
   */
  getDashboard(): PerformanceDashboard {
    return {
      metrics: this.metrics,
      alerts: this.alerts,
      history: this.history,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  /**
   * Get recent alerts
   */
  getAlerts(): PerformanceAlert[] {
    return this.alerts;
  }

  /**
   * Get performance history
   */
  getHistory(): PerformanceMetrics[] {
    return this.history;
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): HealthSummary {
    const cpuStatus = this.getStatusLevel(this.metrics.cpu.usage, this.thresholds.cpu);
    const memoryStatus = this.getStatusLevel(this.metrics.memory.percentage, this.thresholds.memory);
    const networkStatus = this.getNetworkStatus();
    const databaseStatus = this.getDatabaseStatus();
    const websocketStatus = this.getWebSocketStatus();

    const overallStatus = this.getOverallStatus([cpuStatus, memoryStatus, networkStatus, databaseStatus, websocketStatus]);

    return {
      overall: overallStatus,
      cpu: cpuStatus,
      memory: memoryStatus,
      network: networkStatus,
      database: databaseStatus,
      websocket: websocketStatus,
      alertCount: this.alerts.length,
    };
  }

  /**
   * Get status level based on value and thresholds
   */
  private getStatusLevel(value: number, thresholds: { warning: number; critical: number }): 'healthy' | 'warning' | 'critical' {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'healthy';
  }

  /**
   * Get network status
   */
  private getNetworkStatus(): 'healthy' | 'warning' | 'critical' {
    if (this.metrics.network.latency >= this.thresholds.network.latencyCritical) return 'critical';
    if (this.metrics.network.latency >= this.thresholds.network.latencyWarning) return 'warning';
    return 'healthy';
  }

  /**
   * Get database status
   */
  private getDatabaseStatus(): 'healthy' | 'warning' | 'critical' {
    if (this.metrics.database.avgQueryTime >= this.thresholds.database.queryTimeCritical) return 'critical';
    if (this.metrics.database.avgQueryTime >= this.thresholds.database.queryTimeWarning) return 'warning';
    return 'healthy';
  }

  /**
   * Get WebSocket status
   */
  private getWebSocketStatus(): 'healthy' | 'warning' | 'critical' {
    if (this.metrics.websocket.connections >= this.thresholds.websocket.connectionsCritical) return 'critical';
    if (this.metrics.websocket.connections >= this.thresholds.websocket.connectionsWarning) return 'warning';
    return 'healthy';
  }

  /**
   * Get overall system status
   */
  private getOverallStatus(statuses: ('healthy' | 'warning' | 'critical')[]): 'healthy' | 'warning' | 'critical' {
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  // =========================================================================
  // NEW methods (JVS-43-01): Real-time Performance Metrics Collection
  // =========================================================================

  /**
   * Collect real-time performance metrics (simulated).
   * Generates a snapshot with CPU (0-100%), memory (0-1000MB),
   * latency (0-500ms), and QPS values.
   */
  collectMetrics(): RealtimeMetrics {
    const snapshot: RealtimeMetrics = {
      timestamp: Date.now(),
      cpuUsage: Math.round(Math.random() * 10000) / 100,        // 0.00 - 100.00
      memoryUsage: Math.round(Math.random() * 100000) / 100,     // 0.00 - 1000.00 MB
      latencyMs: Math.round(Math.random() * 50000) / 100,        // 0.00 - 500.00 ms
      qps: Math.round(Math.random() * 10000),                     // 0 - 10000
    };

    this.realtimeHistory.push(snapshot);
    if (this.realtimeHistory.length > this.maxRealtimeHistory) {
      this.realtimeHistory.shift();
    }

    log.info(`[PerformanceMonitor] Collected metrics: CPU=${snapshot.cpuUsage}%, MEM=${snapshot.memoryUsage}MB, LAT=${snapshot.latencyMs}ms, QPS=${snapshot.qps}`);
    this.emit('realtime-metrics', snapshot);
    return snapshot;
  }

  /**
   * Collect metrics with specific values (for testing/deterministic scenarios).
   */
  collectMetricsWithValues(values: Partial<RealtimeMetrics>): RealtimeMetrics {
    const snapshot: RealtimeMetrics = {
      timestamp: values.timestamp ?? Date.now(),
      cpuUsage: values.cpuUsage ?? Math.round(Math.random() * 10000) / 100,
      memoryUsage: values.memoryUsage ?? Math.round(Math.random() * 100000) / 100,
      latencyMs: values.latencyMs ?? Math.round(Math.random() * 50000) / 100,
      qps: values.qps ?? Math.round(Math.random() * 10000),
    };

    this.realtimeHistory.push(snapshot);
    if (this.realtimeHistory.length > this.maxRealtimeHistory) {
      this.realtimeHistory.shift();
    }

    log.info(`[PerformanceMonitor] Collected metrics (manual): CPU=${snapshot.cpuUsage}%, MEM=${snapshot.memoryUsage}MB, LAT=${snapshot.latencyMs}ms, QPS=${snapshot.qps}`);
    this.emit('realtime-metrics', snapshot);
    return snapshot;
  }

  /**
   * Get the latest real-time metrics snapshot.
   * Returns null if no metrics have been collected yet.
   */
  getLatestMetrics(): RealtimeMetrics | null {
    if (this.realtimeHistory.length === 0) {
      return null;
    }
    return this.realtimeHistory[this.realtimeHistory.length - 1];
  }

  /**
   * Get the full history of real-time metrics.
   */
  getMetricsHistory(): RealtimeMetrics[] {
    return [...this.realtimeHistory];
  }

  /**
   * Set the maximum number of realtime history entries to retain.
   */
  setMaxRealtimeHistory(max: number): void {
    this.maxRealtimeHistory = max;
    while (this.realtimeHistory.length > this.maxRealtimeHistory) {
      this.realtimeHistory.shift();
    }
  }

  /**
   * Get the maximum realtime history size.
   */
  getMaxRealtimeHistory(): number {
    return this.maxRealtimeHistory;
  }

  /**
   * Clear all realtime metrics history.
   */
  clearRealtimeHistory(): void {
    this.realtimeHistory = [];
  }

  // =========================================================================
  // NEW methods (JVS-43-01): Multi-Account Performance Comparison
  // =========================================================================

  /**
   * Set metrics for a specific account.
   */
  setAccountMetrics(accountId: string, metrics: Partial<AccountMetrics>): void {
    const existing = this.accountMetricsMap.get(accountId);
    const updated: AccountMetrics = {
      accountId,
      cpuUsage: metrics.cpuUsage ?? existing?.cpuUsage ?? 0,
      memoryUsage: metrics.memoryUsage ?? existing?.memoryUsage ?? 0,
      latencyMs: metrics.latencyMs ?? existing?.latencyMs ?? 0,
      qps: metrics.qps ?? existing?.qps ?? 0,
      timestamp: metrics.timestamp ?? Date.now(),
    };
    this.accountMetricsMap.set(accountId, updated);
    log.info(`[PerformanceMonitor] Updated account ${accountId} metrics`);
  }

  /**
   * Get metrics for a specific account.
   */
  getAccountMetrics(accountId: string): AccountMetrics | null {
    return this.accountMetricsMap.get(accountId) ?? null;
  }

  /**
   * Remove an account from tracking.
   */
  removeAccount(accountId: string): boolean {
    return this.accountMetricsMap.delete(accountId);
  }

  /**
   * Compare performance metrics across multiple accounts.
   * If an account has no stored metrics, simulated values are generated.
   */
  compareAccounts(accountIds: string[]): AccountComparisonResult {
    const accounts: AccountMetrics[] = accountIds.map(id => {
      const stored = this.accountMetricsMap.get(id);
      if (stored) return stored;
      // Generate simulated metrics for unknown accounts
      const simulated: AccountMetrics = {
        accountId: id,
        cpuUsage: Math.round(Math.random() * 10000) / 100,
        memoryUsage: Math.round(Math.random() * 100000) / 100,
        latencyMs: Math.round(Math.random() * 50000) / 100,
        qps: Math.round(Math.random() * 10000),
        timestamp: Date.now(),
      };
      this.accountMetricsMap.set(id, simulated);
      return simulated;
    });

    const count = accounts.length;
    const averages = {
      cpuUsage: count > 0 ? accounts.reduce((s, a) => s + a.cpuUsage, 0) / count : 0,
      memoryUsage: count > 0 ? accounts.reduce((s, a) => s + a.memoryUsage, 0) / count : 0,
      latencyMs: count > 0 ? accounts.reduce((s, a) => s + a.latencyMs, 0) / count : 0,
      qps: count > 0 ? accounts.reduce((s, a) => s + a.qps, 0) / count : 0,
    };

    // Round averages
    averages.cpuUsage = Math.round(averages.cpuUsage * 100) / 100;
    averages.memoryUsage = Math.round(averages.memoryUsage * 100) / 100;
    averages.latencyMs = Math.round(averages.latencyMs * 100) / 100;
    averages.qps = Math.round(averages.qps);

    // Best: lowest cpu, lowest memory, lowest latency, highest qps
    const best = {
      cpuUsage: accounts.reduce((best, a) => a.cpuUsage < best.cpuUsage ? a : best, accounts[0]).accountId,
      memoryUsage: accounts.reduce((best, a) => a.memoryUsage < best.memoryUsage ? a : best, accounts[0]).accountId,
      latencyMs: accounts.reduce((best, a) => a.latencyMs < best.latencyMs ? a : best, accounts[0]).accountId,
      qps: accounts.reduce((best, a) => a.qps > best.qps ? a : best, accounts[0]).accountId,
    };

    // Worst: highest cpu, highest memory, highest latency, lowest qps
    const worst = {
      cpuUsage: accounts.reduce((worst, a) => a.cpuUsage > worst.cpuUsage ? a : worst, accounts[0]).accountId,
      memoryUsage: accounts.reduce((worst, a) => a.memoryUsage > worst.memoryUsage ? a : worst, accounts[0]).accountId,
      latencyMs: accounts.reduce((worst, a) => a.latencyMs > worst.latencyMs ? a : worst, accounts[0]).accountId,
      qps: accounts.reduce((worst, a) => a.qps < worst.qps ? a : worst, accounts[0]).accountId,
    };

    const result: AccountComparisonResult = {
      accounts,
      averages,
      best,
      worst,
      timestamp: Date.now(),
    };

    log.info(`[PerformanceMonitor] Compared ${count} accounts`);
    this.emit('account-comparison', result);
    return result;
  }

  /**
   * Get all tracked account IDs.
   */
  getTrackedAccountIds(): string[] {
    return Array.from(this.accountMetricsMap.keys());
  }

  // =========================================================================
  // NEW methods (JVS-43-01): Performance Alert Rules Engine
  // =========================================================================

  /**
   * Get default alert rules.
   */
  private getDefaultAlertRules(): AlertRule[] {
    return [
      { type: 'CPU_HIGH', metric: 'cpuUsage', operator: '>', threshold: 80, severity: 'warning', enabled: true },
      { type: 'CPU_HIGH', metric: 'cpuUsage', operator: '>', threshold: 95, severity: 'critical', enabled: true },
      { type: 'MEMORY_HIGH', metric: 'memoryUsage', operator: '>', threshold: 800, severity: 'warning', enabled: true },
      { type: 'MEMORY_HIGH', metric: 'memoryUsage', operator: '>', threshold: 950, severity: 'critical', enabled: true },
      { type: 'LATENCY_HIGH', metric: 'latencyMs', operator: '>', threshold: 300, severity: 'warning', enabled: true },
      { type: 'LATENCY_HIGH', metric: 'latencyMs', operator: '>', threshold: 450, severity: 'critical', enabled: true },
      { type: 'QPS_LOW', metric: 'qps', operator: '<', threshold: 100, severity: 'warning', enabled: true },
      { type: 'QPS_LOW', metric: 'qps', operator: '<', threshold: 10, severity: 'critical', enabled: true },
    ];
  }

  /**
   * Get current alert rules.
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Set alert rules (replaces all existing rules).
   */
  setAlertRules(rules: AlertRule[]): void {
    this.alertRules = [...rules];
    log.info(`[PerformanceMonitor] Alert rules updated: ${rules.length} rules`);
  }

  /**
   * Add a single alert rule.
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    log.info(`[PerformanceMonitor] Added alert rule: ${rule.type} ${rule.operator} ${rule.threshold}`);
  }

  /**
   * Remove alert rules by type.
   */
  removeAlertRulesByType(type: AlertType): number {
    const before = this.alertRules.length;
    this.alertRules = this.alertRules.filter(r => r.type !== type);
    const removed = before - this.alertRules.length;
    log.info(`[PerformanceMonitor] Removed ${removed} rules of type ${type}`);
    return removed;
  }

  /**
   * Enable or disable alert rules by type.
   */
  setAlertRuleEnabled(type: AlertType, enabled: boolean): void {
    this.alertRules.forEach(r => {
      if (r.type === type) r.enabled = enabled;
    });
  }

  /**
   * Evaluate all enabled alert rules against the latest real-time metrics.
   * Returns an array of triggered alerts.
   */
  evaluateAlertRules(): Alert[] {
    const latest = this.getLatestMetrics();
    if (!latest) {
      log.warn('[PerformanceMonitor] No metrics available for alert evaluation');
      return [];
    }

    const triggered: Alert[] = [];

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const value = latest[rule.metric];
      let conditionMet = false;

      switch (rule.operator) {
        case '>':  conditionMet = value > rule.threshold; break;
        case '<':  conditionMet = value < rule.threshold; break;
        case '>=': conditionMet = value >= rule.threshold; break;
        case '<=': conditionMet = value <= rule.threshold; break;
      }

      if (conditionMet) {
        const alert: Alert = {
          type: rule.type,
          severity: rule.severity,
          message: `${rule.type}: ${rule.metric} is ${value} (${rule.operator} ${rule.threshold})`,
          value,
          threshold: rule.threshold,
          timestamp: Date.now(),
        };
        triggered.push(alert);
        log.warn(`[PerformanceMonitor] Alert triggered: ${alert.message}`);
      }
    }

    this.emit('alerts-evaluated', triggered);
    return triggered;
  }

  // =========================================================================
  // NEW methods (JVS-43-01): Performance Trend Analysis
  // =========================================================================

  /**
   * Analyze the trend of a specific metric over a given window size.
   * Uses simple linear regression to determine trend direction.
   *
   * @param metricName - One of: 'cpuUsage', 'memoryUsage', 'latencyMs', 'qps'
   * @param windowSize - Number of recent data points to analyze (default: 10)
   */
  analyzeTrend(metricName: string, windowSize: number = 10): TrendResult {
    const validMetrics = ['cpuUsage', 'memoryUsage', 'latencyMs', 'qps'];
    if (!validMetrics.includes(metricName)) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `Invalid metric name: ${metricName}. Must be one of: ${validMetrics.join(', ')}`);
    }

    if (windowSize < 2) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, 'Window size must be at least 2');
    }

    // Extract the metric values from history
    const allValues = this.realtimeHistory.map(m => m[metricName as keyof RealtimeMetrics] as number);

    // Take the last `windowSize` data points
    const dataPoints = allValues.slice(-windowSize);

    if (dataPoints.length < 2) {
      return {
        metricName,
        direction: 'stable',
        slope: 0,
        dataPoints,
        windowSize,
        average: dataPoints.length > 0 ? dataPoints[0] : 0,
        min: dataPoints.length > 0 ? dataPoints[0] : 0,
        max: dataPoints.length > 0 ? dataPoints[0] : 0,
        timestamp: Date.now(),
      };
    }

    // Simple linear regression: y = mx + b
    const n = dataPoints.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = dataPoints.reduce((s, v) => s + v, 0);
    const sumXY = dataPoints.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

    // Determine trend direction with a threshold for "stable"
    const avg = sumY / n;
    const normalizedSlope = avg !== 0 ? slope / avg : slope;
    const stableThreshold = 0.01; // 1% change per step

    let direction: TrendDirection;
    if (normalizedSlope > stableThreshold) {
      direction = 'increasing';
    } else if (normalizedSlope < -stableThreshold) {
      direction = 'decreasing';
    } else {
      direction = 'stable';
    }

    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);

    const result: TrendResult = {
      metricName,
      direction,
      slope: Math.round(slope * 10000) / 10000,
      dataPoints,
      windowSize,
      average: Math.round(avg * 100) / 100,
      min,
      max,
      timestamp: Date.now(),
    };

    log.info(`[PerformanceMonitor] Trend analysis for ${metricName}: ${direction} (slope=${result.slope})`);
    return result;
  }

  /**
   * Analyze trends for all metrics at once.
   */
  analyzeAllTrends(windowSize: number = 10): Record<string, TrendResult> {
    return {
      cpuUsage: this.analyzeTrend('cpuUsage', windowSize),
      memoryUsage: this.analyzeTrend('memoryUsage', windowSize),
      latencyMs: this.analyzeTrend('latencyMs', windowSize),
      qps: this.analyzeTrend('qps', windowSize),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton (original)
// ---------------------------------------------------------------------------

let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}
