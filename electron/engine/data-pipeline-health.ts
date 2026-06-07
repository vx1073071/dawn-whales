// JVS-46-03: Data Pipeline Health Monitor
// Monitors data pipeline health status, detects anomalies, and triggers alerts

import log from 'electron-log';

export interface PipelineSource {
  id: string;
  name: string;
  type: 'api' | 'websocket' | 'file' | 'database';
  status: 'active' | 'inactive' | 'error';
  lastUpdate: number;
  successRate: number;
  latency: number;
  errorCount: number;
}

export interface HealthCheckResult {
  timestamp: number;
  sourceId: string;
  status: 'healthy' | 'warning' | 'error';
  latency: number;
  successRate: number;
  message?: string;
}

export interface PipelineAlert {
  id: string;
  timestamp: number;
  sourceId: string;
  type: 'latency' | 'error_rate' | 'availability' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
}

export class DataPipelineHealthMonitor {
  private sources: Map<string, PipelineSource> = new Map();
  private healthChecks: Map<string, HealthCheckResult[]> = new Map();
  private alerts: PipelineAlert[] = [];
  private thresholds = {
    latencyWarning: 1000, // ms
    latencyCritical: 5000,
    errorRateWarning: 0.05, // 5%
    errorRateCritical: 0.10,
    availabilityWarning: 0.95,
    availabilityCritical: 0.90,
  };

  constructor() {
    log.info('[DataPipelineHealthMonitor] initialized');
  }

  /**
   * Register a data source
   */
  registerSource(source: PipelineSource): void {
    this.sources.set(source.id, { ...source });
    this.healthChecks.set(source.id, []);
    log.info(`[DataPipelineHealthMonitor] Registered source: ${source.id}`);
  }

  /**
   * Update source metrics
   */
  updateSourceMetrics(
    sourceId: string,
    metrics: Partial<Pick<PipelineSource, 'status' | 'latency' | 'errorCount'>>
  ): void {
    const source = this.sources.get(sourceId);
    if (!source) {
      log.warn(`[DataPipelineHealthMonitor] Source not found: ${sourceId}`);
      return;
    }

    Object.assign(source, metrics);
    source.lastUpdate = Date.now();

    // Recalculate success rate
    if (metrics.errorCount !== undefined) {
      const totalRequests = source.successRate * 100 + metrics.errorCount;
      source.successRate = Math.max(0, 1 - metrics.errorCount / Math.max(1, totalRequests));
    }

    log.debug(`[DataPipelineHealthMonitor] Updated metrics for ${sourceId}`);
  }

  /**
   * Perform health check on a source
   */
  checkHealth(sourceId: string): HealthCheckResult | null {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let message: string | undefined;

    // Check availability
    if (source.status === 'error' || source.status === 'inactive') {
      status = 'error';
      message = `Source ${sourceId} is ${source.status}`;
    }

    // Check latency
    if (source.latency > this.thresholds.latencyCritical) {
      status = 'error';
      message = `Critical latency: ${source.latency}ms`;
    } else if (source.latency > this.thresholds.latencyWarning) {
      status = status === 'error' ? 'error' : 'warning';
      message = `High latency: ${source.latency}ms`;
    }

    // Check error rate
    if (source.successRate < this.thresholds.availabilityCritical) {
      status = 'error';
      message = `Critical availability: ${(source.successRate * 100).toFixed(2)}%`;
    } else if (source.successRate < this.thresholds.availabilityWarning) {
      status = status === 'error' ? 'error' : 'warning';
      message = message || `Low availability: ${(source.successRate * 100).toFixed(2)}%`;
    }

    const result: HealthCheckResult = {
      timestamp: Date.now(),
      sourceId,
      status,
      latency: source.latency,
      successRate: source.successRate,
      message,
    };

    // Store health check result
    const checks = this.healthChecks.get(sourceId) || [];
    checks.push(result);
    if (checks.length > 100) checks.shift(); // Keep last 100 checks
    this.healthChecks.set(sourceId, checks);

    // Generate alert if needed
    if (status !== 'healthy') {
      this.generateAlert(sourceId, status, message || 'Health check failed');
    }

    return result;
  }

  /**
   * Check health of all sources
   */
  checkAllSources(): Map<string, HealthCheckResult> {
    const results = new Map<string, HealthCheckResult>();
    for (const sourceId of this.sources.keys()) {
      const result = this.checkHealth(sourceId);
      if (result) results.set(sourceId, result);
    }
    return results;
  }

  /**
   * Generate alert for issues
   */
  private generateAlert(
    sourceId: string,
    severity: 'warning' | 'error',
    message: string
  ): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    // Determine alert type
    let type: PipelineAlert['type'] = 'error_rate';
    if (source.latency > this.thresholds.latencyWarning) {
      type = 'latency';
    } else if (source.status === 'error' || source.status === 'inactive') {
      type = 'availability';
    }

    const alert: PipelineAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      sourceId,
      type,
      severity,
      message,
      metadata: {
        latency: source.latency,
        successRate: source.successRate,
        status: source.status,
      },
    };

    this.alerts.push(alert);
    if (this.alerts.length > 1000) this.alerts.shift();

    log.warn(`[DataPipelineHealthMonitor] Alert: ${message}`);
  }

  /**
   * Detect anomalies in data patterns
   */
  detectAnomalies(sourceId: string): PipelineAlert[] {
    const source = this.sources.get(sourceId);
    if (!source) return [];

    const checks = this.healthChecks.get(sourceId) || [];
    if (checks.length < 10) return []; // Need enough data

    const anomalies: PipelineAlert[] = [];
    const recentChecks = checks.slice(-20); // Last 20 checks

    // Calculate baseline
    const avgLatency = recentChecks.reduce((sum, c) => sum + c.latency, 0) / recentChecks.length;
    const avgSuccessRate = recentChecks.reduce((sum, c) => sum + c.successRate, 0) / recentChecks.length;

    // Check latest check
    const latest = checks[checks.length - 1];
    if (!latest) return [];

    // Detect latency spike (> 3x average)
    if (latest.latency > avgLatency * 3) {
      anomalies.push({
        id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        sourceId,
        type: 'anomaly',
        severity: 'warning',
        message: `Latency spike: ${latest.latency}ms (avg: ${avgLatency.toFixed(2)}ms)`,
        metadata: { baseline: avgLatency, current: latest.latency },
      });
    }

    // Detect success rate drop (> 20% drop from average)
    if (latest.successRate < avgSuccessRate * 0.8) {
      anomalies.push({
        id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        sourceId,
        type: 'anomaly',
        severity: 'warning',
        message: `Success rate drop: ${(latest.successRate * 100).toFixed(2)}% (avg: ${(avgSuccessRate * 100).toFixed(2)}%)`,
        metadata: { baseline: avgSuccessRate, current: latest.successRate },
      });
    }

    // Store anomalies as alerts
    for (const anomaly of anomalies) {
      this.alerts.push(anomaly);
      log.info(`[DataPipelineHealthMonitor] Anomaly detected: ${anomaly.message}`);
    }

    return anomalies;
  }

  /**
   * Get source by ID
   */
  getSource(sourceId: string): PipelineSource | null {
    return this.sources.get(sourceId) || null;
  }

  /**
   * Get all sources
   */
  getAllSources(): PipelineSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get health check history for a source
   */
  getHealthHistory(sourceId: string, limit?: number): HealthCheckResult[] {
    const checks = this.healthChecks.get(sourceId) || [];
    return limit ? checks.slice(-limit) : checks;
  }

  /**
   * Get alerts
   */
  getAlerts(limit?: number, severity?: PipelineAlert['severity']): PipelineAlert[] {
    let alerts = this.alerts;
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    return limit ? alerts.slice(-limit) : alerts;
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    log.info('[DataPipelineHealthMonitor] Alerts cleared');
  }

  /**
   * Get overall pipeline health status
   */
  getOverallStatus(): {
    status: 'healthy' | 'warning' | 'error';
    healthySources: number;
    warningSources: number;
    errorSources: number;
    totalSources: number;
  } {
    let healthy = 0;
    let warning = 0;
    let error = 0;

    for (const sourceId of this.sources.keys()) {
      const checks = this.healthChecks.get(sourceId) || [];
      const latest = checks[checks.length - 1];
      if (!latest) {
        healthy++;
      } else if (latest.status === 'error') {
        error++;
      } else if (latest.status === 'warning') {
        warning++;
      } else {
        healthy++;
      }
    }

    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    if (error > 0) overallStatus = 'error';
    else if (warning > 0) overallStatus = 'warning';

    return {
      status: overallStatus,
      healthySources: healthy,
      warningSources: warning,
      errorSources: error,
      totalSources: this.sources.size,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSources: number;
    avgLatency: number;
    avgSuccessRate: number;
    totalAlerts: number;
    criticalAlerts: number;
  } {
    let totalLatency = 0;
    let totalSuccessRate = 0;
    let sourceCount = 0;

    for (const source of this.sources.values()) {
      totalLatency += source.latency;
      totalSuccessRate += source.successRate;
      sourceCount++;
    }

    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;

    return {
      totalSources: this.sources.size,
      avgLatency: sourceCount > 0 ? totalLatency / sourceCount : 0,
      avgSuccessRate: sourceCount > 0 ? totalSuccessRate / sourceCount : 0,
      totalAlerts: this.alerts.length,
      criticalAlerts,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.sources.clear();
    this.healthChecks.clear();
    this.alerts = [];
    log.info('[DataPipelineHealthMonitor] Cleared all data');
  }

  /**
   * Get source count
   */
  get size(): number {
    return this.sources.size;
  }
}

// Singleton
let instance: DataPipelineHealthMonitor | null = null;

export function getDataPipelineHealthMonitor(): DataPipelineHealthMonitor {
  if (!instance) {
    instance = new DataPipelineHealthMonitor();
  }
  return instance;
}

export default DataPipelineHealthMonitor;
