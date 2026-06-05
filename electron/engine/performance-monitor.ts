// JVS-107: Performance Monitoring Dashboard
// Monitor system performance metrics in real-time

import { EventEmitter } from 'events';

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

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private alerts: PerformanceAlert[];
  private history: PerformanceMetrics[];
  private thresholds: PerformanceThresholds;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 100) {
    super();
    this.maxHistorySize = maxHistorySize;
    this.metrics = this.initializeMetrics();
    this.alerts = [];
    this.history = [];
    this.thresholds = this.getDefaultThresholds();
  }

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

let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }
  return monitorInstance;
}
