// ── JVS-107: Smart Monitor — 统一智能监控告警系统 ─────────────────────────
// 多级别告警: info / warning / critical
// 告警源: 行情异动、风控事件、系统健康、策略信号
// 支持: 订阅/查询/确认/历史/统计

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertSource = 'market' | 'risk' | 'system' | 'strategy' | 'broker' | 'data';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

export interface SmartAlert {
  id: string;
  level: AlertLevel;
  source: AlertSource;
  category: string;       // e.g. 'price_anomaly', 'drawdown', 'connection'
  title: string;
  message: string;
  data?: Record<string, any>;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  ttl?: number;           // auto-expire after ttl seconds
  dedupeKey?: string;     // prevents duplicate alerts within dedupe window
  relatedEntityId?: string; // strategy_id, symbol, etc.
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  source: AlertSource;
  category: string;
  condition: AlertCondition;
  level: AlertLevel;
  cooldownSeconds: number;   // min seconds between same alert
  maxPerHour: number;        // max alerts of this type per hour
}

export interface AlertCondition {
  type: 'threshold' | 'change' | 'pattern' | 'custom';
  metric: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value?: number;
  windowMinutes?: number;    // for change detection
  customFn?: string;         // name of custom checker
}

export interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  byLevel: Record<AlertLevel, number>;
  bySource: Record<AlertSource, number>;
  byCategory: Record<string, number>;
  last24h: number;
  last1h: number;
}

export interface AlertQuery {
  level?: AlertLevel;
  source?: AlertSource;
  category?: string;
  status?: AlertStatus;
  since?: string;          // ISO timestamp
  until?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

// ── Smart Monitor Engine ───────────────────────────────────────────────────

export class SmartMonitor extends EventEmitter {
  private alerts: SmartAlert[] = [];
  private rules: AlertRule[] = [];
  private lastAlertTimes: Map<string, number> = new Map(); // dedupeKey -> timestamp
  private alertCounts: Map<string, number[]> = new Map();  // ruleId -> [timestamps]
  private maxAlertsInMemory = 5000;
  private gcInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.initDefaultRules();
    this.startGC();
  }

  // ── Default Rules ──────────────────────────────────────────────────────

  private initDefaultRules() {
    this.rules = [
      {
        id: 'rule-price-surge',
        name: '价格急涨',
        enabled: true,
        source: 'market',
        category: 'price_anomaly',
        condition: { type: 'change', metric: 'price', value: 5, windowMinutes: 5 },
        level: 'warning',
        cooldownSeconds: 300,
        maxPerHour: 6,
      },
      {
        id: 'rule-price-crash',
        name: '价格急跌',
        enabled: true,
        source: 'market',
        category: 'price_anomaly',
        condition: { type: 'change', metric: 'price', value: -5, windowMinutes: 5 },
        level: 'critical',
        cooldownSeconds: 300,
        maxPerHour: 6,
      },
      {
        id: 'rule-volume-spike',
        name: '成交量异常',
        enabled: true,
        source: 'market',
        category: 'volume_anomaly',
        condition: { type: 'threshold', metric: 'volume_ratio', operator: 'gt', value: 3 },
        level: 'warning',
        cooldownSeconds: 600,
        maxPerHour: 4,
      },
      {
        id: 'rule-drawdown',
        name: '策略回撤过大',
        enabled: true,
        source: 'risk',
        category: 'drawdown',
        condition: { type: 'threshold', metric: 'drawdown_pct', operator: 'gt', value: 10 },
        level: 'critical',
        cooldownSeconds: 1800,
        maxPerHour: 2,
      },
      {
        id: 'rule-daily-loss',
        name: '日亏损超限',
        enabled: true,
        source: 'risk',
        category: 'daily_loss',
        condition: { type: 'threshold', metric: 'daily_pnl_pct', operator: 'lt', value: -3 },
        level: 'critical',
        cooldownSeconds: 3600,
        maxPerHour: 1,
      },
      {
        id: 'rule-connection-lost',
        name: '行情连接断开',
        enabled: true,
        source: 'system',
        category: 'connection',
        condition: { type: 'pattern', metric: 'connection_status' },
        level: 'critical',
        cooldownSeconds: 60,
        maxPerHour: 30,
      },
      {
        id: 'rule-broker-error',
        name: '券商接口错误',
        enabled: true,
        source: 'broker',
        category: 'broker_error',
        condition: { type: 'pattern', metric: 'broker_error' },
        level: 'warning',
        cooldownSeconds: 120,
        maxPerHour: 10,
      },
      {
        id: 'rule-data-stale',
        name: '数据过期',
        enabled: true,
        source: 'data',
        category: 'data_freshness',
        condition: { type: 'threshold', metric: 'data_age_seconds', operator: 'gt', value: 300 },
        level: 'warning',
        cooldownSeconds: 300,
        maxPerHour: 6,
      },
      {
        id: 'rule-strategy-signal',
        name: '策略交易信号',
        enabled: true,
        source: 'strategy',
        category: 'trade_signal',
        condition: { type: 'pattern', metric: 'signal' },
        level: 'info',
        cooldownSeconds: 30,
        maxPerHour: 60,
      },
      {
        id: 'rule-order-rejected',
        name: '订单被拒',
        enabled: true,
        source: 'broker',
        category: 'order_rejection',
        condition: { type: 'pattern', metric: 'order_rejected' },
        level: 'critical',
        cooldownSeconds: 60,
        maxPerHour: 15,
      },
    ];
  }

  // ── Alert Creation ─────────────────────────────────────────────────────

  emitAlert(input: {
    level: AlertLevel;
    source: AlertSource;
    category: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    relatedEntityId?: string;
    ttl?: number;
  }): SmartAlert | null {
    const dedupeKey = `${input.source}:${input.category}:${input.relatedEntityId || 'global'}`;

    // Check cooldown
    const lastTime = this.lastAlertTimes.get(dedupeKey);
    if (lastTime) {
      const matchingRule = this.rules.find(
        r => r.source === input.source && r.category === input.category
      );
      const cooldown = matchingRule?.cooldownSeconds !== undefined ? matchingRule.cooldownSeconds : 60;
      const elapsed = (Date.now() - lastTime) / 1000;
      if (elapsed < cooldown) {
        return null; // suppressed by cooldown
      }
    }

    // Check hourly limit
    const ruleId = `rule-${input.source}-${input.category}`;
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recentCounts = (this.alertCounts.get(ruleId) || []).filter(t => t > hourAgo);
    const matchingRule = this.rules.find(
      r => r.source === input.source && r.category === input.category
    );
    const maxPerHour = matchingRule?.maxPerHour !== undefined ? matchingRule.maxPerHour : 30;
    if (recentCounts.length >= maxPerHour) {
      return null; // suppressed by rate limit
    }

    // Create alert
    const alert: SmartAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level: input.level,
      source: input.source,
      category: input.category,
      title: input.title,
      message: input.message,
      data: input.data,
      status: 'active',
      createdAt: new Date().toISOString(),
      ttl: input.ttl,
      dedupeKey,
      relatedEntityId: input.relatedEntityId,
    };

    // Add to store
    this.alerts.unshift(alert);

    // Update tracking
    this.lastAlertTimes.set(dedupeKey, now);
    this.alertCounts.set(ruleId, [...recentCounts, now]);

    // Trim memory
    if (this.alerts.length > this.maxAlertsInMemory) {
      this.alerts = this.alerts.slice(0, this.maxAlertsInMemory);
    }

    // Emit event
    this.emit('alert', alert);

    log.info(`[SmartMonitor] [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`);

    return alert;
  }

  // ── Market Data Checks ─────────────────────────────────────────────────

  checkPriceChange(symbol: string, currentPrice: number, previousPrice: number, windowMinutes: number = 5) {
    if (!previousPrice || previousPrice === 0) return;
    const changePct = ((currentPrice - previousPrice) / previousPrice) * 100;

    if (changePct >= 5) {
      this.emitAlert({
        level: 'warning',
        source: 'market',
        category: 'price_anomaly',
        title: `${symbol} 价格急涨 ${changePct.toFixed(2)}%`,
        message: `${symbol} 在 ${windowMinutes} 分钟内上涨 ${changePct.toFixed(2)}%，当前价 ${currentPrice}`,
        data: { symbol, currentPrice, previousPrice, changePct, windowMinutes },
        relatedEntityId: symbol,
      });
    }

    if (changePct <= -5) {
      this.emitAlert({
        level: 'critical',
        source: 'market',
        category: 'price_anomaly',
        title: `${symbol} 价格急跌 ${changePct.toFixed(2)}%`,
        message: `${symbol} 在 ${windowMinutes} 分钟内下跌 ${changePct.toFixed(2)}%，当前价 ${currentPrice}`,
        data: { symbol, currentPrice, previousPrice, changePct, windowMinutes },
        relatedEntityId: symbol,
      });
    }
  }

  checkVolumeSpike(symbol: string, currentVolume: number, avgVolume: number) {
    if (!avgVolume || avgVolume === 0) return;
    const ratio = currentVolume / avgVolume;

    if (ratio > 3) {
      this.emitAlert({
        level: 'warning',
        source: 'market',
        category: 'volume_anomaly',
        title: `${symbol} 成交量异常 (${ratio.toFixed(1)}x)`,
        message: `${symbol} 当前成交量为均量的 ${ratio.toFixed(1)} 倍`,
        data: { symbol, currentVolume, avgVolume, ratio },
        relatedEntityId: symbol,
      });
    }
  }

  // ── Risk Checks ────────────────────────────────────────────────────────

  checkDrawdown(strategyId: string, strategyName: string, drawdownPct: number) {
    if (drawdownPct > 10) {
      this.emitAlert({
        level: 'critical',
        source: 'risk',
        category: 'drawdown',
        title: `策略 "${strategyName}" 回撤 ${drawdownPct.toFixed(1)}%`,
        message: `策略 ${strategyName} (${strategyId}) 最大回撤已达 ${drawdownPct.toFixed(1)}%，超过 10% 阈值`,
        data: { strategyId, strategyName, drawdownPct },
        relatedEntityId: strategyId,
      });
    }
  }

  checkDailyPnL(dailyPnl: number, dailyPnlPct: number, totalCapital: number) {
    if (dailyPnlPct < -3) {
      this.emitAlert({
        level: 'critical',
        source: 'risk',
        category: 'daily_loss',
        title: `日亏损超限: ${dailyPnlPct.toFixed(2)}%`,
        message: `今日亏损 ¥${dailyPnl.toFixed(2)} (${dailyPnlPct.toFixed(2)}%)，超过 -3% 日亏损限制`,
        data: { dailyPnl, dailyPnlPct, totalCapital },
      });
    }
  }

  // ── System Checks ──────────────────────────────────────────────────────

  checkConnection(source: string, connected: boolean) {
    if (!connected) {
      this.emitAlert({
        level: 'critical',
        source: 'system',
        category: 'connection',
        title: `${source} 连接断开`,
        message: `${source} 连接已断开，请检查网络和服务状态`,
        data: { source, connected },
        relatedEntityId: source,
      });
    } else {
      // Auto-resolve matching active alerts
      this.resolveByEntity(source);
    }
  }

  checkDataFreshness(source: string, lastUpdateTime: string, maxAgeSeconds: number = 300) {
    const age = (Date.now() - new Date(lastUpdateTime).getTime()) / 1000;
    if (age > maxAgeSeconds) {
      this.emitAlert({
        level: 'warning',
        source: 'data',
        category: 'data_freshness',
        title: `${source} 数据过期 (${Math.round(age)}s)`,
        message: `${source} 最后更新距今 ${Math.round(age)} 秒，超过 ${maxAgeSeconds} 秒阈值`,
        data: { source, lastUpdateTime, ageSeconds: age, maxAgeSeconds },
        relatedEntityId: source,
      });
    }
  }

  // ── Strategy Signals ───────────────────────────────────────────────────

  recordStrategySignal(strategyId: string, strategyName: string, signal: string, symbol: string) {
    this.emitAlert({
      level: 'info',
      source: 'strategy',
      category: 'trade_signal',
      title: `策略信号: ${strategyName} ${signal}`,
      message: `${strategyName} 对 ${symbol} 发出 ${signal} 信号`,
      data: { strategyId, strategyName, signal, symbol },
      relatedEntityId: strategyId,
    });
  }

  // ── Alert Management ───────────────────────────────────────────────────

  acknowledge(alertId: string): SmartAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
      return alert;
    }
    return null;
  }

  acknowledgeAll(level?: AlertLevel): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (alert.status === 'active' && (!level || alert.level === level)) {
        alert.status = 'acknowledged';
        alert.acknowledgedAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  resolve(alertId: string): SmartAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && (alert.status === 'active' || alert.status === 'acknowledged')) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      return alert;
    }
    return null;
  }

  resolveByEntity(entityId: string): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (alert.relatedEntityId === entityId && (alert.status === 'active' || alert.status === 'acknowledged')) {
        alert.status = 'resolved';
        alert.resolvedAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  suppress(alertId: string): SmartAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'suppressed';
      return alert;
    }
    return null;
  }

  // ── Query ──────────────────────────────────────────────────────────────

  query(q: AlertQuery = {}): SmartAlert[] {
    let results = this.alerts;

    if (q.level) results = results.filter(a => a.level === q.level);
    if (q.source) results = results.filter(a => a.source === q.source);
    if (q.category) results = results.filter(a => a.category === q.category);
    if (q.status) results = results.filter(a => a.status === q.status);
    if (q.since) results = results.filter(a => a.createdAt >= q.since!);
    if (q.until) results = results.filter(a => a.createdAt <= q.until!);
    if (q.entityId) results = results.filter(a => a.relatedEntityId === q.entityId);

    const offset = q.offset || 0;
    const limit = q.limit || 100;
    return results.slice(offset, offset + limit);
  }

  getActive(): SmartAlert[] {
    return this.alerts.filter(a => a.status === 'active');
  }

  getCritical(): SmartAlert[] {
    return this.alerts.filter(a => a.level === 'critical' && a.status === 'active');
  }

  // ── Statistics ─────────────────────────────────────────────────────────

  getStats(): AlertStats {
    const now = Date.now();
    const h1 = now - 3600000;
    const h24 = now - 86400000;

    const stats: AlertStats = {
      total: this.alerts.length,
      active: 0,
      acknowledged: 0,
      resolved: 0,
      byLevel: { info: 0, warning: 0, critical: 0 },
      bySource: { market: 0, risk: 0, system: 0, strategy: 0, broker: 0, data: 0 },
      byCategory: {},
      last24h: 0,
      last1h: 0,
    };

    for (const a of this.alerts) {
      if (a.status === 'active') stats.active++;
      if (a.status === 'acknowledged') stats.acknowledged++;
      if (a.status === 'resolved') stats.resolved++;

      stats.byLevel[a.level]++;
      stats.bySource[a.source]++;
      stats.byCategory[a.category] = (stats.byCategory[a.category] || 0) + 1;

      const ts = new Date(a.createdAt).getTime();
      if (ts > h24) stats.last24h++;
      if (ts > h1) stats.last1h++;
    }

    return stats;
  }

  // ── Rules Management ───────────────────────────────────────────────────

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return rule;
    }
    return null;
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  enableRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  // ── Garbage Collection ─────────────────────────────────────────────────

  private startGC() {
    // Run every 5 minutes: expire TTL alerts, clean old resolved
    this.gcInterval = setInterval(() => {
      this.gc();
    }, 300000);
  }

  private gc() {
    const now = Date.now();

    // Expire TTL alerts
    for (const alert of this.alerts) {
      if (alert.ttl && alert.status === 'active') {
        const age = (now - new Date(alert.createdAt).getTime()) / 1000;
        if (age > alert.ttl) {
          alert.status = 'resolved';
          alert.resolvedAt = new Date().toISOString();
        }
      }
    }

    // Clean old resolved alerts (keep last 24h)
    const h24 = now - 86400000;
    this.alerts = this.alerts.filter(a => {
      if (a.status === 'resolved' || a.status === 'suppressed') {
        return new Date(a.createdAt).getTime() > h24;
      }
      return true;
    });
  }

  destroy() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    this.removeAllListeners();
  }
}
