// ── Data Quality Dashboard Aggregator (JVS-34) ──────────────────────────────
// Aggregates JVS-31 (stream monitor) + JVS-22 (quality monitor) for WB W51

import { getDataQualityMonitor } from './data-quality-monitor';
import { getDataQualityStream } from './data-quality-stream';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DataQualityDashboard {
  overallScore: number;       // 0-100 health score
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;

  // Module health summary
  modules: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
  };

  // Stream quality (from JVS-31)
  stream: {
    monitoring: boolean;
    totalTicks: number;
    validTicks: number;
    invalidTicks: number;
    validationRate: number;     // percentage
    alertsGenerated: number;
    averageLatency: number;     // ms
    uptime: number;             // ms
    recentAlerts: Array<{
      type: string;
      severity: string;
      code: string;
      message: string;
      timestamp: number;
    }>;
  };

  // Module health (from JVS-22)
  health: {
    lastCheck: number;
    overallStatus: string;
    moduleDetails: Array<{
      module: string;
      status: string;
      lastSuccess: number;
      latency: number;
      errorCount: number;
    }>;
  };

  // Alerts summary
  alerts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    recent: Array<{
      level: string;
      module: string;
      message: string;
      timestamp: number;
      acknowledged: boolean;
    }>;
  };
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export async function getDataQualityDashboard(): Promise<DataQualityDashboard> {
  const monitor = getDataQualityMonitor();
  const stream = getDataQualityStream();

  // Get stream status
  const streamStatus = stream.getStatus();

  // Get monitor status
  const healthReport = await monitor.getReport();

  // Calculate overall score
  const validationRate = streamStatus.metrics.totalTicks > 0
    ? (streamStatus.metrics.validTicks / streamStatus.metrics.totalTicks) * 100
    : 100;

  const moduleHealthScore = healthReport.modules.total > 0
    ? (healthReport.modules.healthy / healthReport.modules.total) * 100
    : 100;

  const alertPenalty = Math.min(30, streamStatus.metrics.alertsGenerated * 2);
  const overallScore = Math.max(0, Math.min(100,
    (validationRate * 0.4 + moduleHealthScore * 0.4 + (100 - alertPenalty) * 0.2)
  ));

  const overallGrade =
    overallScore >= 90 ? 'A' :
    overallScore >= 80 ? 'B' :
    overallScore >= 70 ? 'C' :
    overallScore >= 60 ? 'D' : 'F';

  // Format stream alerts
  const recentStreamAlerts = streamStatus.recentAlerts.slice(-10).map(a => ({
    type: a.type,
    severity: a.severity,
    code: a.code,
    message: a.message,
    timestamp: a.timestamp,
  }));

  // Format health alerts
  const healthAlerts = healthReport.alerts.slice(-20).map(a => ({
    level: a.level,
    module: a.module,
    message: a.message,
    timestamp: a.timestamp,
    acknowledged: a.acknowledged,
  }));

  const criticalCount = healthAlerts.filter(a => a.level === 'critical').length;
  const warningCount = healthAlerts.filter(a => a.level === 'warning').length;
  const infoCount = healthAlerts.filter(a => a.level === 'info').length;

  return {
    overallScore: Math.round(overallScore),
    overallGrade,
    timestamp: Date.now(),

    modules: {
      total: healthReport.modules.total,
      healthy: healthReport.modules.healthy,
      degraded: healthReport.modules.degraded,
      failed: healthReport.modules.failed,
    },

    stream: {
      monitoring: streamStatus.monitoring,
      totalTicks: streamStatus.metrics.totalTicks,
      validTicks: streamStatus.metrics.validTicks,
      invalidTicks: streamStatus.metrics.invalidTicks,
      validationRate: Math.round(validationRate * 100) / 100,
      alertsGenerated: streamStatus.metrics.alertsGenerated,
      averageLatency: Math.round(streamStatus.metrics.averageLatency),
      uptime: streamStatus.metrics.uptime,
      recentAlerts: recentStreamAlerts,
    },

    health: {
      lastCheck: healthReport.timestamp,
      overallStatus: healthReport.overallStatus,
      moduleDetails: healthReport.modules.details || [],
    },

    alerts: {
      total: healthAlerts.length + recentStreamAlerts.length,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      recent: healthAlerts.slice(-10),
    },
  };
}
