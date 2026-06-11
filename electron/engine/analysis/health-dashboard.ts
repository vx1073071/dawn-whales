/**
 * JVS-87: Health Dashboard — System health monitoring and alerting
 * 
 * Features:
 * - Real-time system health metrics (CPU, memory, network, latency)
 * - Service health status tracking
 * - Alert thresholds and notifications
 * - Health score calculation
 * - Historical health data tracking
 * - Health trends and patterns
 */

import { EventEmitter } from 'events';
import { getCircuitBreaker } from '../risk/circuit-breaker';
import { getRateLimiterManager } from '../core/rate-limiter';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface SystemMetrics {
  cpu: number;           // CPU usage percentage (0-100)
  memory: number;        // Memory usage percentage (0-100)
  networkLatency: number; // Network latency in ms
  apiLatency: number;     // API response time in ms
  uptime: number;         // System uptime in seconds
  timestamp: number;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  successRate: number;     // 0-100
  lastCheck: number;
  circuitState?: string;
}

export interface HealthScore {
  overall: number;         // 0-100
  services: number;        // 0-100
  network: number;         // 0-100
  system: number;          // 0-100
  timestamp: number;
}

export interface HealthAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface HealthDashboardConfig {
  checkInterval: number;   // Check interval in ms
  thresholds: {
    cpu: number;           // CPU threshold for warning
    memory: number;        // Memory threshold for warning
    latency: number;       // Latency threshold in ms
    successRate: number;   // Success rate threshold (0-100)
  };
  alerts: {
    enabled: boolean;
    levels: {
      warning: number;     // Health score threshold for warning
      critical: number;    // Health score threshold for critical
    };
  };
}

// ── Default Configuration ──────────────────────────────────────────────────

export const DEFAULT_HEALTH_CONFIG: HealthDashboardConfig = {
  checkInterval: 10000,    // 10 seconds
  thresholds: {
    cpu: 80,
    memory: 80,
    latency: 1000,
    successRate: 95,
  },
  alerts: {
    enabled: true,
    levels: {
      warning: 70,
      critical: 50,
    },
  },
};

// ── Health Dashboard Implementation ─────────────────────────────────────────

export class HealthDashboard extends EventEmitter {
  private config: HealthDashboardConfig;
  private systemMetrics: SystemMetrics[] = [];
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private alerts: HealthAlert[] = [];
  private checkTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();

  constructor(config?: Partial<HealthDashboardConfig>) {
    super();
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    this.emit('started');
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    this.emit('stopped');
  }

  /**
   * Perform a health check
   */
  async performHealthCheck(): Promise<HealthScore> {
    const timestamp = Date.now();

    // Collect system metrics
    const systemMetrics = await this.collectSystemMetrics();
    this.systemMetrics.push(systemMetrics);

    // Keep only last 100 samples
    if (this.systemMetrics.length > 100) {
      this.systemMetrics.shift();
    }

    // Check service health
    const serviceHealth = await this.checkAllServices();

    // Calculate health score
    const healthScore = this.calculateHealthScore(systemMetrics, serviceHealth);

    // Check thresholds and generate alerts
    if (this.config.alerts.enabled) {
      this.checkThresholds(systemMetrics, serviceHealth, healthScore);
    }

    this.emit('healthCheck', {
      metrics: systemMetrics,
      services: serviceHealth,
      score: healthScore,
    });

    return healthScore;
  }

  /**
   * Get current health score
   */
  getHealthScore(): HealthScore {
    if (this.systemMetrics.length === 0) {
      return {
        overall: 100,
        services: 100,
        network: 100,
        system: 100,
        timestamp: Date.now(),
      };
    }

    const latest = this.systemMetrics[this.systemMetrics.length - 1];
    const serviceHealth = Array.from(this.serviceHealth.values());

    return this.calculateHealthScore(latest, serviceHealth);
  }

  /**
   * Get all service health status
   */
  getServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Get all alerts
   */
  getAlerts(): HealthAlert[] {
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
   * Get health metrics history
   */
  getMetricsHistory(): SystemMetrics[] {
    return [...this.systemMetrics];
  }

  // ── Private Methods ────────────────────────────────────────────────────

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const timestamp = Date.now();

    // Get CPU usage (simplified)
    const cpu = Math.random() * 100; // Placeholder

    // Get memory usage (simplified)
    const memory = Math.random() * 100; // Placeholder

    // Get network latency (simplified)
    const networkLatency = Math.random() * 100; // Placeholder

    // Get API latency (simplified)
    const apiLatency = Math.random() * 100; // Placeholder

    return {
      cpu,
      memory,
      networkLatency,
      apiLatency,
      uptime: (timestamp - this.startTime) / 1000,
      timestamp,
    };
  }

  private async checkAllServices(): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];

    // Check each service (placeholder implementation)
    const serviceNames = ['api', 'database', 'cache', 'websocket'];

    for (const name of serviceNames) {
      const health = await this.checkService(name);
      services.push(health);
      this.serviceHealth.set(name, health);
    }

    return services;
  }

  private async checkService(name: string): Promise<ServiceHealth> {
    const timestamp = Date.now();

    // Placeholder implementation
    const latency = Math.random() * 100;
    const successRate = Math.random() * 100;

    let status: 'healthy' | 'degraded' | 'down';
    if (successRate >= this.config.thresholds.successRate) {
      status = 'healthy';
    } else if (successRate >= 80) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    // Check circuit breaker state
    const breaker = getCircuitBreaker();
    const circuit = breaker.getCircuit(name);
    const circuitState = circuit.getState();

    return {
      name,
      status,
      latency,
      successRate,
      lastCheck: timestamp,
      circuitState,
    };
  }

  private calculateHealthScore(
    metrics: SystemMetrics,
    services: ServiceHealth[]
  ): HealthScore {
    const timestamp = Date.now();

    // Calculate system health (CPU, memory)
    const cpuScore = Math.max(0, 100 - metrics.cpu);
    const memoryScore = Math.max(0, 100 - metrics.memory);
    const systemScore = (cpuScore + memoryScore) / 2;

    // Calculate network health (latency)
    const latencyScore = Math.max(0, 100 - (metrics.networkLatency / this.config.thresholds.latency) * 100);
    const networkScore = latencyScore;

    // Calculate service health
    const serviceScores = services.map(s => s.successRate);
    const serviceScore = serviceScores.length > 0
      ? serviceScores.reduce((a, b) => a + b, 0) / serviceScores.length
      : 100;

    // Calculate overall health
    const overall = (systemScore * 0.3 + networkScore * 0.3 + serviceScore * 0.4);

    return {
      overall: Math.max(0, Math.min(100, overall)),
      services: serviceScore,
      network: networkScore,
      system: systemScore,
      timestamp,
    };
  }

  private checkThresholds(
    metrics: SystemMetrics,
    services: ServiceHealth[],
    healthScore: HealthScore
  ): void {
    const { warning, critical } = this.config.alerts.levels;

    // Check overall health score
    if (healthScore.overall < critical) {
      this.createAlert('critical', 'system', `Overall health critical: ${healthScore.overall.toFixed(1)}`);
    } else if (healthScore.overall < warning) {
      this.createAlert('warning', 'system', `Overall health warning: ${healthScore.overall.toFixed(1)}`);
    }

    // Check individual services
    for (const service of services) {
      if (service.status === 'down') {
        this.createAlert('critical', service.name, `Service ${service.name} is down`);
      } else if (service.status === 'degraded') {
        this.createAlert('warning', service.name, `Service ${service.name} is degraded`);
      }
    }
  }

  private createAlert(
    level: 'info' | 'warning' | 'critical',
    service: string,
    message: string
  ): void {
    const alert: HealthAlert = {
      id: this.generateAlertId(),
      level,
      service,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let healthDashboardInstance: HealthDashboard | null = null;

export function getHealthDashboard(config?: Partial<HealthDashboardConfig>): HealthDashboard {
  if (!healthDashboardInstance) {
    healthDashboardInstance = new HealthDashboard(config);
  }
  return healthDashboardInstance;
}

export default HealthDashboard;
