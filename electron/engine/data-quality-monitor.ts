// ── JVS-22: Data Quality Monitor (数据质量监控) ───────────────────────────
// Monitor health status of all 21 JVS data modules
// Auto-degrade to fallback when API fails
// Alert when data freshness exceeds TTL

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ModuleHealthStatus {
  module: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  lastCheck: number;
  responseTimeMs: number;
  errorMessage?: string;
  fallbackUsed: boolean;
  dataAge: number;          // Age of cached data in ms
  ttlMs: number;            // Expected TTL for this module
  isFresh: boolean;         // Whether data is within TTL
}

export interface DataQualityReport {
  timestamp: number;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  modules: ModuleHealthStatus[];
  alerts: DataQualityAlert[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    error: number;
    unknown: number;
  };
}

export interface DataQualityAlert {
  level: 'info' | 'warning' | 'critical';
  module: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// ── Module Registry ────────────────────────────────────────────────────────

interface ModuleConfig {
  name: string;
  checkFn: () => Promise<{ success: boolean; fallbackUsed?: boolean; dataAge?: number }>;
  ttlMs: number;
}

const MODULE_REGISTRY: ModuleConfig[] = [];

export function registerModule(config: ModuleConfig): void {
  MODULE_REGISTRY.push(config);
  log.info(`[DataQuality] Registered module: ${config.name}`);
}

// ── Health Check Functions ─────────────────────────────────────────────────

async function checkModuleHealth(config: ModuleConfig): Promise<ModuleHealthStatus> {
  const startTime = Date.now();
  let status: ModuleHealthStatus['status'] = 'unknown';
  let errorMessage: string | undefined;
  let fallbackUsed = false;
  let dataAge = 0;

  try {
    const result = await config.checkFn();
    const responseTimeMs = Date.now() - startTime;

    if (result.success) {
      status = result.fallbackUsed ? 'degraded' : 'healthy';
      fallbackUsed = result.fallbackUsed || false;
      dataAge = result.dataAge || 0;
    } else {
      status = 'error';
      errorMessage = 'Check failed';
    }

    return {
      module: config.name,
      status,
      lastCheck: Date.now(),
      responseTimeMs,
      errorMessage,
      fallbackUsed,
      dataAge,
      ttlMs: config.ttlMs,
      isFresh: dataAge <= config.ttlMs,
    };
  } catch (err: any) {
    return {
      module: config.name,
      status: 'error',
      lastCheck: Date.now(),
      responseTimeMs: Date.now() - startTime,
      errorMessage: err.message,
      fallbackUsed: false,
      dataAge: 0,
      ttlMs: config.ttlMs,
      isFresh: false,
    };
  }
}

// ── Data Quality Monitor Service ───────────────────────────────────────────

export class DataQualityMonitor {
  private alerts: DataQualityAlert[] = [];
  private lastReport: DataQualityReport | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    log.info('[DataQuality] Monitor initialized');
  }

  /**
   * Run health check on all registered modules
   */
  async runHealthCheck(): Promise<DataQualityReport> {
    log.info(`[DataQuality] Running health check on ${MODULE_REGISTRY.length} modules`);

    const checks = MODULE_REGISTRY.map(config => checkModuleHealth(config));
    const modules = await Promise.all(checks);

    // Generate alerts
    const newAlerts: DataQualityAlert[] = [];

    for (const module of modules) {
      // Alert for errors
      if (module.status === 'error') {
        newAlerts.push({
          level: 'critical',
          module: module.module,
          message: `Module failed: ${module.errorMessage || 'Unknown error'}`,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Alert for degraded (fallback used)
      if (module.status === 'degraded') {
        newAlerts.push({
          level: 'warning',
          module: module.module,
          message: `Module using fallback: ${module.module}`,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Alert for stale data
      if (!module.isFresh && module.status !== 'error') {
        newAlerts.push({
          level: 'info',
          module: module.module,
          message: `Data stale: ${Math.round(module.dataAge / 60000)}min old (TTL: ${Math.round(module.ttlMs / 60000)}min)`,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }
    }

    this.alerts.push(...newAlerts);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Calculate summary
    const summary = {
      total: modules.length,
      healthy: modules.filter(m => m.status === 'healthy').length,
      degraded: modules.filter(m => m.status === 'degraded').length,
      error: modules.filter(m => m.status === 'error').length,
      unknown: modules.filter(m => m.status === 'unknown').length,
    };

    // Overall status
    let overallStatus: DataQualityReport['overallStatus'] = 'healthy';
    if (summary.error > 0) {
      overallStatus = 'critical';
    } else if (summary.degraded > 0 || summary.unknown > 0) {
      overallStatus = 'degraded';
    }

    const report: DataQualityReport = {
      timestamp: Date.now(),
      overallStatus,
      modules,
      alerts: this.alerts,
      summary,
    };

    this.lastReport = report;

    log.info(`[DataQuality] Health check complete: ${overallStatus} (${summary.healthy}/${summary.total} healthy)`);

    return report;
  }

  /**
   * Get last health check report
   */
  getLastReport(): DataQualityReport | null {
    return this.lastReport;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertIndex: number): void {
    if (alertIndex >= 0 && alertIndex < this.alerts.length) {
      this.alerts[alertIndex].acknowledged = true;
    }
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    this.alerts = this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Start periodic health checks
   */
  startPeriodicCheck(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.runHealthCheck().catch(err => {
        log.error('[DataQuality] Periodic check failed:', err);
      });
    }, intervalMs);

    log.info(`[DataQuality] Periodic check started (interval: ${intervalMs}ms)`);

    // Run immediately
    this.runHealthCheck().catch(err => {
      log.error('[DataQuality] Initial check failed:', err);
    });
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('[DataQuality] Periodic check stopped');
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let monitorInstance: DataQualityMonitor | null = null;

export function getDataQualityMonitor(): DataQualityMonitor {
  if (!monitorInstance) {
    monitorInstance = new DataQualityMonitor();
  }
  return monitorInstance;
}
