/**
 * JVS-95: Performance Monitoring Dashboard
 * 
 * Real-time performance monitoring for the entire system
 * Features:
 * - System metrics (CPU, memory, network I/O)
 * - Process-level metrics (IPC latency, queue depth, worker pool)
 * - Data pipeline metrics (throughput, latency, error rate)
 * - Alert system for performance degradation
 * - Historical metrics tracking and visualization
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;           // CPU usage percentage (0-100)
    loadAvg: number[];       // Load averages [1min, 5min, 15min]
    numCPUs: number;
  };
  memory: {
    total: number;           // Total memory (bytes)
    used: number;            // Used memory (bytes)
    free: number;            // Free memory (bytes)
    usagePercent: number;    // Usage percentage (0-100)
  };
  network: {
    rxBytes: number;         // Bytes received
    txBytes: number;         // Bytes transmitted
  };
  process: {
    memoryUsage: number;     // Process memory usage (bytes)
    cpuUsage: number;        // Process CPU usage percentage
    uptime: number;          // Process uptime (seconds)
  };
}

export interface PipelineMetrics {
  timestamp: number;
  throughput: number;        // Messages per second
  latency: number;           // Average latency (ms)
  errorRate: number;         // Error rate percentage (0-100)
  queueDepth: number;        // Current queue depth
  processedCount: number;    // Total messages processed
  errorCount: number;        // Total errors
}

export interface WorkerPoolMetrics {
  timestamp: number;
  activeWorkers: number;     // Number of active workers
  idleWorkers: number;       // Number of idle workers
  queueLength: number;       // Task queue length
  avgTaskDuration: number;   // Average task duration (ms)
  totalTasksProcessed: number;
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'critical';
  category: 'cpu' | 'memory' | 'network' | 'pipeline' | 'worker';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface PerformanceMonitoringConfig {
  enabled: boolean;
  interval: number;          // Collection interval (ms)
  retentionDays: number;     // How long to keep metrics
  alerts: {
    enabled: boolean;
    cpuThreshold: number;    // CPU usage threshold (%)
    memoryThreshold: number; // Memory usage threshold (%)
    latencyThreshold: number; // Latency threshold (ms)
    errorRateThreshold: number; // Error rate threshold (%)
  };
}

const DEFAULT_CONFIG: PerformanceMonitoringConfig = {
  enabled: true,
  interval: 5000,            // 5 seconds
  retentionDays: 7,
  alerts: {
    enabled: true,
    cpuThreshold: 80,
    memoryThreshold: 85,
    latencyThreshold: 1000,
    errorRateThreshold: 5,
  },
};

// ── Performance Monitoring Dashboard ───────────────────────────────────────

export class PerformanceMonitoringDashboard extends EventEmitter {
  private config: PerformanceMonitoringConfig;
  private systemMetricsHistory: SystemMetrics[] = [];
  private pipelineMetricsHistory: PipelineMetrics[] = [];
  private workerMetricsHistory: WorkerPoolMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private collectionTimer?: NodeJS.Timeout;
  private maxHistorySize = 1000;

  // Network tracking
  private lastRxBytes = 0;
  private lastTxBytes = 0;
  private lastNetworkCheck = Date.now();

  // Process CPU tracking
  private lastCpuUsage = process.cpuUsage();
  private lastCpuCheck = Date.now();

  constructor(config?: Partial<PerformanceMonitoringConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.collectionTimer) {
      this.stop();
    }

    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.interval);

    log.info(`[PerformanceMonitoring] Started with interval ${this.config.interval}ms`);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
      log.info('[PerformanceMonitoring] Stopped');
    }
  }

  /**
   * Collect system metrics
   */
  private collectMetrics(): void {
    const timestamp = Date.now();

    // CPU metrics
    const cpus = os.cpus();
    const cpuUsage = this.calculateCPUUsage();
    const loadAvg = os.loadavg();

    // Memory metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    // Network metrics
    const networkInfo = os.networkInterfaces();
    let rxBytes = 0;
    let txBytes = 0;
    for (const iface of Object.values(networkInfo)) {
      if (iface) {
        for (const nic of iface) {
          rxBytes += nic.bytesReceived || 0;
          txBytes += nic.bytesSent || 0;
        }
      }
    }

    // Process metrics
    const memUsage = process.memoryUsage();
    const processCpuUsage = this.calculateProcessCPUUsage();

    const systemMetrics: SystemMetrics = {
      timestamp,
      cpu: {
        usage: cpuUsage,
        loadAvg,
        numCPUs: cpus.length,
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: memoryUsagePercent,
      },
      network: {
        rxBytes,
        txBytes,
      },
      process: {
        memoryUsage: memUsage.heapUsed,
        cpuUsage: processCpuUsage,
        uptime: process.uptime(),
      },
    };

    this.systemMetricsHistory.push(systemMetrics);
    if (this.systemMetricsHistory.length > this.maxHistorySize) {
      this.systemMetricsHistory.shift();
    }

    // Check alerts
    if (this.config.alerts.enabled) {
      this.checkAlerts(systemMetrics);
    }

    this.emit('metrics', systemMetrics);
  }

  /**
   * Collect pipeline metrics
   */
  collectPipelineMetrics(metrics: {
    throughput: number;
    latency: number;
    errorRate: number;
    queueDepth: number;
    processedCount: number;
    errorCount: number;
  }): void {
    const pipelineMetrics: PipelineMetrics = {
      timestamp: Date.now(),
      ...metrics,
    };

    this.pipelineMetricsHistory.push(pipelineMetrics);
    if (this.pipelineMetricsHistory.length > this.maxHistorySize) {
      this.pipelineMetricsHistory.shift();
    }

    // Check alerts
    if (this.config.alerts.enabled) {
      this.checkPipelineAlerts(pipelineMetrics);
    }

    this.emit('pipeline-metrics', pipelineMetrics);
  }

  /**
   * Collect worker pool metrics
   */
  collectWorkerMetrics(metrics: {
    activeWorkers: number;
    idleWorkers: number;
    queueLength: number;
    avgTaskDuration: number;
    totalTasksProcessed: number;
  }): void {
    const workerMetrics: WorkerPoolMetrics = {
      timestamp: Date.now(),
      ...metrics,
    };

    this.workerMetricsHistory.push(workerMetrics);
    if (this.workerMetricsHistory.length > this.maxHistorySize) {
      this.workerMetricsHistory.shift();
    }

    this.emit('worker-metrics', workerMetrics);
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idlePercent = (totalIdle / totalTick) * 100;
    return 100 - idlePercent;
  }

  /**
   * Calculate process CPU usage
   */
  private calculateProcessCPUUsage(): number {
    const currentUsage = process.cpuUsage();
    const currentTime = Date.now();
    const elapsedMs = currentTime - this.lastCpuCheck;

    if (elapsedMs === 0) return 0;

    const userDiff = currentUsage.user - this.lastCpuUsage.user;
    const systemDiff = currentUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;

    // Convert to percentage (microseconds to milliseconds to percentage)
    const cpuPercent = (totalDiff / 1000 / elapsedMs) * 100;

    this.lastCpuUsage = currentUsage;
    this.lastCpuCheck = currentTime;

    return cpuPercent;
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: SystemMetrics): void {
    // CPU alert
    if (metrics.cpu.usage > this.config.alerts.cpuThreshold) {
      this.createAlert(
        'warning',
        'cpu',
        `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        'cpu',
        metrics.cpu.usage,
        this.config.alerts.cpuThreshold
      );
    }

    // Memory alert
    if (metrics.memory.usagePercent > this.config.alerts.memoryThreshold) {
      this.createAlert(
        'warning',
        'memory',
        `High memory usage: ${metrics.memory.usagePercent.toFixed(1)}%`,
        'memory',
        metrics.memory.usagePercent,
        this.config.alerts.memoryThreshold
      );
    }
  }

  /**
   * Check for pipeline alerts
   */
  private checkPipelineAlerts(metrics: PipelineMetrics): void {
    // Latency alert
    if (metrics.latency > this.config.alerts.latencyThreshold) {
      this.createAlert(
        'warning',
        'pipeline',
        `High pipeline latency: ${metrics.latency.toFixed(0)}ms`,
        'latency',
        metrics.latency,
        this.config.alerts.latencyThreshold
      );
    }

    // Error rate alert
    if (metrics.errorRate > this.config.alerts.errorRateThreshold) {
      this.createAlert(
        'warning',
        'pipeline',
        `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        'errorRate',
        metrics.errorRate,
        this.config.alerts.errorRateThreshold
      );
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    level: PerformanceAlert['level'],
    category: PerformanceAlert['category'],
    message: string,
    metric: string,
    value: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      metric,
      value,
      threshold,
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  /**
   * Get system metrics history
   */
  getSystemMetricsHistory(limit?: number): SystemMetrics[] {
    if (limit) {
      return this.systemMetricsHistory.slice(-limit);
    }
    return [...this.systemMetricsHistory];
  }

  /**
   * Get pipeline metrics history
   */
  getPipelineMetricsHistory(limit?: number): PipelineMetrics[] {
    if (limit) {
      return this.pipelineMetricsHistory.slice(-limit);
    }
    return [...this.pipelineMetricsHistory];
  }

  /**
   * Get worker pool metrics history
   */
  getWorkerMetricsHistory(limit?: number): WorkerPoolMetrics[] {
    if (limit) {
      return this.workerMetricsHistory.slice(-limit);
    }
    return [...this.workerMetricsHistory];
  }

  /**
   * Get all alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    this.alerts = this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get summary
   */
  getSummary(): {
    systemMetricsCount: number;
    pipelineMetricsCount: number;
    workerMetricsCount: number;
    alertCount: number;
    unacknowledgedAlerts: number;
  } {
    return {
      systemMetricsCount: this.systemMetricsHistory.length,
      pipelineMetricsCount: this.pipelineMetricsHistory.length,
      workerMetricsCount: this.workerMetricsHistory.length,
      alertCount: this.alerts.length,
      unacknowledgedAlerts: this.alerts.filter(a => !a.acknowledged).length,
    };
  }
}

// Singleton
let performanceMonitoringInstance: PerformanceMonitoringDashboard | null = null;

export function getPerformanceMonitoringDashboard(config?: Partial<PerformanceMonitoringConfig>): PerformanceMonitoringDashboard {
  if (!performanceMonitoringInstance) {
    performanceMonitoringInstance = new PerformanceMonitoringDashboard(config);
  }
  return performanceMonitoringInstance;
}
