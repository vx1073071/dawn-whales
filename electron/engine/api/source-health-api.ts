/**
 * R245 P1-23: SourceHealthAPI — 源健康监控API
 * LOBEHUB | v2.8.0
 *
 * 为前端源健康仪表盘提供REST API接口。
 * 依赖: SourceHealthMonitor (R244 P1-23)
 *
 * API 端点:
 *   GET  /api/source-health/stats    — 总览统计
 *   GET  /api/source-health/records  — 全量记录
 *   GET  /api/source-health/records/:category — 按类别过滤
 *   GET  /api/source-health/alerts   — 活跃告警
 *   POST /api/source-health/alerts/acknowledge — 确认告警
 *   GET  /api/source-health/history  — 最近24h各源历史状态
 *
 * 约束: 纯TypeScript, 与SourceHealthMonitor集成, ≥350L
 */

import log from 'electron-log';
import type { SourceHealthMonitor, SourceHealthRecord, SourceHealthStats, SourceHealthAlert } from '../data/source-health-monitor';

// ── Types ────────────────────────────────────────────────────────────────

export interface HealthStatsResponse {
  success: boolean;
  data: SourceHealthStats;
  timestamp: number;
}

export interface HealthRecordsResponse {
  success: boolean;
  data: SourceHealthRecord[];
  total: number;
  filters?: {
    category?: string;
    status?: string;
    tier?: string;
  };
  timestamp: number;
}

export interface HealthAlertsResponse {
  success: boolean;
  data: SourceHealthAlert[];
  total: number;
  unacknowledged: number;
  timestamp: number;
}

export interface AcknowledgeAlertRequest {
  timestamp: number;
}

export interface AcknowledgeAlertResponse {
  success: boolean;
  message: string;
  timestamp: number;
}

export interface HealthHistoryPoint {
  sourceId: string;
  name: string;
  timestamp: number;
  healthy: boolean;
  latencyMs: number;
  status: string;
}

export interface HealthHistoryResponse {
  success: boolean;
  data: HealthHistoryPoint[];
  window: string;  // "24h"
  timestamp: number;
}

export interface ApiError {
  success: false;
  error: string;
  code: number;
  timestamp: number;
}

// ── SourceHealthAPI ───────────────────────────────────────────────────────

export class SourceHealthAPI {
  readonly id = 'source_health_api';
  readonly version = '2.8.0';

  private monitor: SourceHealthMonitor;
  private historyPoints: HealthHistoryPoint[] = [];
  private historySnapshotInterval: ReturnType<typeof setInterval> | null = null;
  private readonly maxHistoryPoints = 10000;  // 最多保留1万条

  constructor(monitor: SourceHealthMonitor) {
    this.monitor = monitor;
  }

  // ── 生命周期 ───────────────────────────────────────────────────────────

  /** 启动历史快照 (每5分钟) */
  startHistorySnapshot(): void {
    if (this.historySnapshotInterval) return;
    this.historySnapshotInterval = setInterval(() => this.snapshotAll(), 300000);  // 5min
    log.info('[SourceHealthAPI] History snapshot started (every 5min)');
  }

  /** 停止历史快照 */
  stopHistorySnapshot(): void {
    if (this.historySnapshotInterval) {
      clearInterval(this.historySnapshotInterval);
      this.historySnapshotInterval = null;
    }
  }

  // ── GET /stats ─────────────────────────────────────────────────────────

  getStats(): HealthStatsResponse | ApiError {
    try {
      const stats = this.monitor.getStats();
      return {
        success: true,
        data: stats,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      log.error('[SourceHealthAPI] getStats failed:', error.message);
      return { success: false, error: error.message, code: 500, timestamp: Date.now() };
    }
  }

  // ── GET /records ───────────────────────────────────────────────────────

  getRecords(params?: {
    category?: string;
    status?: string;
    tier?: string;
  }): HealthRecordsResponse | ApiError {
    try {
      let records = this.monitor.getAllRecords();

      // 过滤
      if (params?.category) {
        records = records.filter(r => r.category === params.category);
      }
      if (params?.status) {
        records = records.filter(r => r.status === params.status);
      }
      if (params?.tier) {
        records = records.filter(r => r.tier === params.tier);
      }

      // 按状态排序: unhealthy → degraded → healthy → unknown → disabled
      const order = { unhealthy: 0, degraded: 1, unknown: 2, healthy: 3, disabled: 4 };
      records.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));

      return {
        success: true,
        data: records,
        total: records.length,
        filters: params,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      log.error('[SourceHealthAPI] getRecords failed:', error.message);
      return { success: false, error: error.message, code: 500, timestamp: Date.now() };
    }
  }

  // ── GET /records/:category ─────────────────────────────────────────────

  getRecordsByCategory(category: string): HealthRecordsResponse | ApiError {
    return this.getRecords({ category });
  }

  // ── GET /alerts ────────────────────────────────────────────────────────

  getAlerts(): HealthAlertsResponse | ApiError {
    try {
      const stats = this.monitor.getStats();
      const allAlerts = stats.alerts;
      const unacknowledged = allAlerts.filter(a => !a.acknowledged).length;

      // 按严重度+时间排序
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const sorted = [...allAlerts].sort((a, b) =>
        (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3) ||
        b.timestamp - a.timestamp);

      return {
        success: true,
        data: sorted,
        total: sorted.length,
        unacknowledged,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      log.error('[SourceHealthAPI] getAlerts failed:', error.message);
      return { success: false, error: error.message, code: 500, timestamp: Date.now() };
    }
  }

  // ── POST /alerts/acknowledge ────────────────────────────────────────────

  acknowledgeAlert(request: AcknowledgeAlertRequest): AcknowledgeAlertResponse | ApiError {
    try {
      if (!request.timestamp || isNaN(request.timestamp)) {
        return { success: false, error: 'Invalid timestamp', code: 400, timestamp: Date.now() };
      }
      this.monitor.acknowledgeAlert(request.timestamp);
      return {
        success: true,
        message: 'Alert acknowledged',
        timestamp: request.timestamp,
      };
    } catch (error: any) {
      log.error('[SourceHealthAPI] acknowledgeAlert failed:', error.message);
      return { success: false, error: error.message, code: 500, timestamp: Date.now() };
    }
  }

  // ── GET /history ───────────────────────────────────────────────────────

  /**
   * 获取最近24小时各源的健康历史
   * 用于折线图/时间线展示
   */
  getHistory(params?: {
    sourceId?: string;
    since?: number;  // 起始时间戳
    until?: number;  // 截止时间戳
  }): HealthHistoryResponse | ApiError {
    try {
      const since = params?.since || (Date.now() - 86400000);  // 默认24h
      const until = params?.until || Date.now();

      let points = this.historyPoints.filter(
        p => p.timestamp >= since && p.timestamp <= until,
      );

      if (params?.sourceId) {
        points = points.filter(p => p.sourceId === params.sourceId);
      }

      // 按时间排�序
      points.sort((a, b) => a.timestamp - b.timestamp);

      const windowHours = Math.round((until - since) / 3600000);

      return {
        success: true,
        data: points,
        window: `${windowHours}h`,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      log.error('[SourceHealthAPI] getHistory failed:', error.message);
      return { success: false, error: error.message, code: 500, timestamp: Date.now() };
    }
  }

  // ── 健康检查端点 ──────────────────────────────────────────────────────

  /** 快速健康检查 (ping) */
  healthCheck(): { status: string; sourcesChecked: number; timestamp: number } {
    const stats = this.monitor.getStats();
    return {
      status: stats.overallAvailability > 0.9 ? 'ok' : stats.overallAvailability > 0.7 ? 'degraded' : 'critical',
      sourcesChecked: stats.totalSources,
      timestamp: Date.now(),
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private snapshotAll(): void {
    const records = this.monitor.getAllRecords();
    const ts = Date.now();
    for (const record of records) {
      this.historyPoints.push({
        sourceId: record.sourceId,
        name: record.name,
        timestamp: ts,
        healthy: record.healthy,
        latencyMs: record.lastLatencyMs,
        status: record.status,
      });
    }

    // 裁剪
    if (this.historyPoints.length > this.maxHistoryPoints) {
      this.historyPoints = this.historyPoints.slice(-this.maxHistoryPoints);
    }
  }
}

// ── Express 路由绑定工具 ─────────────────────────────────────────────────

/**
 * 快速绑定API到Express app。
 *
 * Usage:
 *   import { SourceHealthMonitor } from './source-health-monitor';
 *   const monitor = new SourceHealthMonitor();
 *   const api = new SourceHealthAPI(monitor);
 *   bindToExpress(app, '/api/source-health', api);
 */
export function bindSourceHealthRoutes(
  app: any,  // Express app
  basePath: string,
  api: SourceHealthAPI,
): void {
  app.get(`${basePath}/stats`, (_req: any, res: any) => {
    const result = api.getStats();
    res.status(result.success ? 200 : result.code || 500).json(result);
  });

  app.get(`${basePath}/records`, (req: any, res: any) => {
    const { category, status, tier } = req.query || {};
    const result = api.getRecords({ category, status, tier });
    res.status(result.success ? 200 : result.code || 500).json(result);
  });

  app.get(`${basePath}/records/:category`, (req: any, res: any) => {
    const result = api.getRecordsByCategory(req.params.category);
    res.status(result.success ? 200 : result.code || 500).json(result);
  });

  app.get(`${basePath}/alerts`, (_req: any, res: any) => {
    const result = api.getAlerts();
    res.status(result.success ? 200 : result.code || 500).json(result);
  });

  app.post(`${basePath}/alerts/acknowledge`, (req: any, res: any) => {
    const result = api.acknowledgeAlert(req.body);
    res.status(result.success ? 200 : result.code || 500).json(result);
  });

  app.get(`${basePath}/history`, (req: any, res: any) => {
    const { sourceId, since, until } = req.query || {};
    const result = api.getHistory({
      sourceId,
      since: since ? parseInt(since, 10) : undefined,
      until: until ? parseInt(until, 10) : undefined,
    });
    res.status(result.success ? 200 : result.code || 500).json(result);
  });

  app.get(`${basePath}/ping`, (_req: any, res: any) => {
    res.json(api.healthCheck());
  });
}

export default SourceHealthAPI;
