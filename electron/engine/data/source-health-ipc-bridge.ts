/**
 * R262: SourceHealthIpcBridge — 源健康→前端仪表盘IPC桥接
 * 
 * 将 source-health-full-chain-verify 结果接入 IPC → 前端仪表盘
 * 
 * 功能:
 *   1. 30源健康状态实时IPC推送
 *   2. 健康仪表盘数据格式化 (表格/趋势/告警)
 *   3. 降级事件IPC通知
 *   4. 健康趋势历史 (7日/30日)
 *   5. 源健康摘要中英输出
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface HealthDashboardRow {
  sourceId: string;
  name: string;
  nameCn: string;
  region: string;
  category: string;
  priority: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'timeout' | 'unknown';
  statusColor: string;      // green/yellow/red/gray
  latencyMs: number;
  accuracy: number;
  availability: number;
  uptimePercent: number;
  lastChecked: number;
  trend: 'up' | 'down' | 'stable';
}

export interface HealthAlertEvent {
  eventId: string;
  sourceId: string;
  sourceName: string;
  sourceNameCn: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageCn: string;
  triggeredAt: number;
  acknowledged: boolean;
}

export interface HealthTrendPoint {
  timestamp: number;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  avgLatencyMs: number;
  avgAccuracy: number;
}

export interface HealthDashboardData {
  dashboardId: string;
  timestamp: number;
  summary: {
    total: number;
    healthy: number;
    degrated: number;
    unhealthy: number;
    timeout: number;
    overallStatus: 'PASS' | 'WARN' | 'FAIL';
  };
  rows: HealthDashboardRow[];
  alerts: HealthAlertEvent[];
  trend: HealthTrendPoint[];
  summaryEn: string;
  summaryCn: string;
}

// ── Source status to color mapping ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#eab308',
  unhealthy: '#ef4444',
  timeout: '#6b7280',
  unknown: '#9ca3af',
};

const STATUS_ICONS: Record<string, string> = {
  healthy: '🟢',
  degraded: '🟡',
  unhealthy: '🔴',
  timeout: '⚫',
  unknown: '⚪',
};

// ═══════════════════════════════════════════════════════════════════════════
// SourceHealthIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class SourceHealthIpcBridge {
  private dashboardData: Map<string, HealthDashboardRow> = new Map();
  private alerts: HealthAlertEvent[] = [];
  private trendHistory: HealthTrendPoint[] = [];
  private lastDashboard: HealthDashboardData | null = null;

  constructor() {}

  // ── Public API: Data Feed ───────────────────────────────────────────────

  /**
   * Feed source health result from the full-chain verifier.
   */
  feedSourceHealth(params: {
    sourceId: string;
    name: string;
    nameCn: string;
    region: string;
    category: string;
    priority: string;
    status: HealthDashboardRow['status'];
    latencyMs: number;
    accuracy: number;
    availability: number;
    uptimePercent: number;
  }): HealthDashboardRow {
    const prev = this.dashboardData.get(params.sourceId);
    const trend = prev
      ? prev.status === params.status ? 'stable'
      : (params.status === 'healthy' ? 'up' : 'down')
      : 'stable';

    const row: HealthDashboardRow = {
      sourceId: params.sourceId,
      name: params.name,
      nameCn: params.nameCn,
      region: params.region,
      category: params.category,
      priority: params.priority,
      status: params.status,
      statusColor: STATUS_COLORS[params.status] ?? STATUS_COLORS.unknown,
      latencyMs: params.latencyMs,
      accuracy: params.accuracy,
      availability: params.availability,
      uptimePercent: params.uptimePercent,
      lastChecked: Date.now(),
      trend: trend as 'up' | 'down' | 'stable',
    };

    this.dashboardData.set(params.sourceId, row);

    // Check for alert conditions
    if (params.status === 'unhealthy' || params.status === 'timeout') {
      this._createAlert(params.sourceId, params.name, params.nameCn, 'critical',
        `${params.name} is ${params.status}`,
        `${params.nameCn}状态异常：${params.status}`);
    } else if (params.status === 'degraded') {
      this._createAlert(params.sourceId, params.name, params.nameCn, 'warning',
        `${params.name} is degraded`,
        `${params.nameCn}已降级`);
    }

    return row;
  }

  /**
   * Batch feed from source-health-full-chain-verify report.
   */
  feedFromVerifier(report: {
    results: Array<{ sourceId: string; status: string; latencyMs: number; accuracy: number; availability: number }>;
  }): HealthDashboardRow[] {
    const rows: HealthDashboardRow[] = [];
    const sourceDefs = this._getSourceDefs();

    for (const result of report.results) {
      const def = sourceDefs.find(s => s.sourceId === result.sourceId);
      if (def) {
        rows.push(this.feedSourceHealth({
          sourceId: result.sourceId,
          name: def.name,
          nameCn: def.nameCn,
          region: def.region,
          category: def.category,
          priority: def.priority,
          status: result.status as HealthDashboardRow['status'],
          latencyMs: result.latencyMs,
          accuracy: result.accuracy,
          availability: result.availability,
          uptimePercent: result.availability * 100,
        }));
      }
    }

    return rows;
  }

  // ── Public API: Dashboard ───────────────────────────────────────────────

  /**
   * Generate full dashboard data for IPC → frontend.
   */
  generateDashboard(): HealthDashboardData {
    const rows = Array.from(this.dashboardData.values());
    const summary = {
      total: rows.length,
      healthy: rows.filter(r => r.status === 'healthy').length,
      degraded: rows.filter(r => r.status === 'degraded').length,
      unhealthy: rows.filter(r => r.status === 'unhealthy').length,
      timeout: rows.filter(r => r.status === 'timeout').length,
      overallStatus: 'PASS' as 'PASS' | 'WARN' | 'FAIL',
    };

    if (summary.unhealthy + summary.timeout > 2) summary.overallStatus = 'FAIL';
    else if (summary.unhealthy + summary.timeout > 0 || summary.degraded > 5) summary.overallStatus = 'WARN';

    // Generate trend point
    const avgLatency = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length) : 0;
    const avgAccuracy = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.accuracy, 0) / rows.length * 100) / 100 : 0;

    const trendPoint: HealthTrendPoint = {
      timestamp: Date.now(),
      healthyCount: summary.healthy,
      degradedCount: summary.degraded,
      unhealthyCount: summary.unhealthy,
      avgLatencyMs: avgLatency,
      avgAccuracy,
    };
    this.trendHistory.push(trendPoint);
    if (this.trendHistory.length > 720) this.trendHistory.shift(); // keep 30d of hourly points

    const dashboard: HealthDashboardData = {
      dashboardId: `healthdash:${Date.now()}`,
      timestamp: Date.now(),
      summary,
      rows,
      alerts: this.alerts.filter(a => !a.acknowledged).slice(-5),
      trend: this.trendHistory.slice(-24),
      summaryEn: summary.overallStatus === 'PASS'
        ? `All ${summary.total} sources healthy`
        : `${summary.unhealthy + summary.timeout} sources failing, ${summary.degraded} degraded`,
      summaryCn: summary.overallStatus === 'PASS'
        ? `全部${summary.total}个数据源健康`
        : `${summary.unhealthy + summary.timeout}个源故障，${summary.degraded}个降级`,
    };

    this.lastDashboard = dashboard;
    return dashboard;
  }

  // ── Public API: Alerts ──────────────────────────────────────────────────

  /** Acknowledge an alert */
  acknowledgeAlert(eventId: string): boolean {
    const alert = this.alerts.find(a => a.eventId === eventId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  /** Get active alerts */
  getActiveAlerts(): HealthAlertEvent[] {
    return this.alerts.filter(a => !a.acknowledged).slice(-20);
  }

  // ── Public API: IPC Payload ─────────────────────────────────────────────

  /**
   * Get minimal IPC payload for tray/menu updates.
   */
  getIpcPayload(): {
    status: string;
    statusColor: string;
    icon: string;
    healthyCount: number;
    totalCount: number;
    degradedSources: string[];
    lastUpdateMs: number;
  } {
    const rows = Array.from(this.dashboardData.values());
    const degraded = rows.filter(r => r.status !== 'healthy' && r.status !== 'unknown');
    const healthyCount = rows.filter(r => r.status === 'healthy').length;

    let status = 'healthy';
    let statusColor = STATUS_COLORS.healthy;
    let icon = '🟢';

    if (degraded.length > 5) { status = 'critical'; statusColor = STATUS_COLORS.unhealthy; icon = '🔴'; }
    else if (degraded.length > 0) { status = 'warning'; statusColor = STATUS_COLORS.degraded; icon = '🟡'; }

    return {
      status,
      statusColor,
      icon,
      healthyCount,
      totalCount: rows.length,
      degradedSources: degraded.map(r => r.nameCn),
      lastUpdateMs: Date.now(),
    };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get all dashboard rows */
  getRows(): HealthDashboardRow[] { return Array.from(this.dashboardData.values()); }

  /** Get trend history */
  getTrend(limit = 24): HealthTrendPoint[] { return this.trendHistory.slice(-limit); }

  /** Get last dashboard */
  getLastDashboard(): HealthDashboardData | null { return this.lastDashboard; }

  /** Reset */
  reset(): void {
    this.dashboardData.clear();
    this.alerts = [];
    this.trendHistory = [];
    this.lastDashboard = null;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _createAlert(
    sourceId: string, name: string, nameCn: string,
    severity: HealthAlertEvent['severity'],
    message: string, messageCn: string,
  ): void {
    // Dedup: don't repeat same alert within 5 minutes
    const recent = this.alerts.find(a =>
      a.sourceId === sourceId && a.severity === severity &&
      Date.now() - a.triggeredAt < 300_000
    );
    if (recent) return;

    const alert: HealthAlertEvent = {
      eventId: `halert:${sourceId}:${severity}:${Date.now()}`,
      sourceId, sourceName: name, sourceNameCn: nameCn,
      severity, message, messageCn,
      triggeredAt: Date.now(),
      acknowledged: false,
    };
    this.alerts.push(alert);
    if (this.alerts.length > 500) this.alerts.shift();
  }

  private _getSourceDefs() {
    return [
      { sourceId: 'yahoo_finance', name: 'Yahoo Finance', nameCn: '雅虎财经', region: 'global', category: 'aggregator', priority: 'P0' },
      { sourceId: 'eastmoney', name: 'EastMoney', nameCn: '东方财富', region: 'cn', category: 'aggregator', priority: 'P0' },
      { sourceId: 'binance', name: 'Binance', nameCn: '币安', region: 'crypto', category: 'exchange', priority: 'P0' },
      { sourceId: 'hkex', name: 'HKEX', nameCn: '港交所', region: 'hk', category: 'exchange', priority: 'P0' },
      { sourceId: 'sse', name: 'SSE', nameCn: '上交所', region: 'cn', category: 'exchange', priority: 'P0' },
      { sourceId: 'szse', name: 'SZSE', nameCn: '深交所', region: 'cn', category: 'exchange', priority: 'P0' },
      { sourceId: 'investing_com', name: 'Investing.com', nameCn: '英为财情', region: 'global', category: 'aggregator', priority: 'P0' },
      { sourceId: 'coinbase', name: 'Coinbase', nameCn: 'Coinbase', region: 'crypto', category: 'exchange', priority: 'P1' },
      { sourceId: 'okx', name: 'OKX', nameCn: '欧易', region: 'crypto', category: 'exchange', priority: 'P1' },
      { sourceId: 'bybit', name: 'Bybit', nameCn: 'Bybit', region: 'crypto', category: 'exchange', priority: 'P1' },
      { sourceId: 'newsapi', name: 'NewsAPI', nameCn: 'NewsAPI', region: 'global', category: 'news', priority: 'P0' },
      { sourceId: 'cls_telegraph', name: 'CLS Telegraph', nameCn: '财联社电报', region: 'cn', category: 'news', priority: 'P0' },
      { sourceId: 'xueqiu', name: 'Xueqiu', nameCn: '雪球', region: 'cn', category: 'social', priority: 'P0' },
      { sourceId: 'rss_feeds', name: 'RSS Feeds', nameCn: 'RSS订阅', region: 'global', category: 'news', priority: 'P1' },
      { sourceId: 'reddit', name: 'Reddit', nameCn: 'Reddit', region: 'us', category: 'social', priority: 'P1' },
      { sourceId: 'twitter', name: 'Twitter/X', nameCn: '推特', region: 'global', category: 'social', priority: 'P1' },
      { sourceId: 'weibo', name: 'Weibo', nameCn: '微博', region: 'cn', category: 'social', priority: 'P2' },
      { sourceId: 'discord', name: 'Discord', nameCn: 'Discord', region: 'crypto', category: 'social', priority: 'P2' },
      { sourceId: 'telegram', name: 'Telegram', nameCn: 'Telegram', region: 'crypto', category: 'social', priority: 'P2' },
      { sourceId: 'tradingview', name: 'TradingView', nameCn: 'TradingView', region: 'global', category: 'technical', priority: 'P1' },
      { sourceId: 'fred', name: 'FRED', nameCn: '美联储经济数据', region: 'us', category: 'macro', priority: 'P1' },
      { sourceId: 'nbs', name: 'NBS', nameCn: '国家统计局', region: 'cn', category: 'macro', priority: 'P1' },
      { sourceId: 'world_bank', name: 'World Bank', nameCn: '世界银行', region: 'global', category: 'macro', priority: 'P2' },
      { sourceId: 'imf', name: 'IMF', nameCn: '国际货币基金', region: 'global', category: 'macro', priority: 'P2' },
      { sourceId: 'binance_bridge', name: 'Binance API Bridge', nameCn: '币安桥接', region: 'crypto', category: 'internal', priority: 'P0' },
      { sourceId: 'yahoo_bridge', name: 'Yahoo Engine Bridge', nameCn: '雅虎桥接', region: 'us', category: 'internal', priority: 'P0' },
      { sourceId: 'push_ipc', name: 'Push IPC Bridge', nameCn: '推送桥接', region: 'global', category: 'internal', priority: 'P1' },
      { sourceId: 'macro_data', name: 'Macro Data Bridge', nameCn: '宏观数据桥接', region: 'global', category: 'internal', priority: 'P1' },
      { sourceId: 'investing_rss', name: 'Investing RSS Fetcher', nameCn: '英为RSS抓取', region: 'global', category: 'internal', priority: 'P0' },
      { sourceId: 'short_selling', name: 'Short Selling Pipeline', nameCn: '卖空管线', region: 'hk', category: 'internal', priority: 'P1' },
    ];
  }
}

export const sourceHealthIpcBridge = new SourceHealthIpcBridge();
