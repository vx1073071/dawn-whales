/**
 * BreakingNewsPushEngine — R246 P0-08
 * 
 * 分级实时新闻推送引擎。
 * 对接 WatchlistSmartNewsEngine 的 breaking news pipeline，
 * 通过 WebSocket 向已连接客户端推送 3 级（flash > urgent > breaking）新闻，
 * 支持 per-user watchlist 过滤、去重、TTL 过期管理。
 * 
 * Pricing: 免费（推送是平台基础能力）
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type BreakingLevel = 'flash' | 'urgent' | 'breaking';

export interface BreakingAlert {
  /** Unique alert ID */
  id: string;
  /** Severity level */
  level: BreakingLevel;
  /** Affected symbol */
  symbol: string;
  /** Market */
  market: string;
  /** Alert title */
  title: string;
  /** Alert summary */
  summary: string;
  /** Source name */
  source: string;
  /** Source authority score 0-1 */
  sourceAuthority: number;
  /** Number of corroborating sources */
  sourceCount: number;
  /** Aggregate sentiment -1 to 1 */
  consensusSentiment: number;
  /** Detection timestamp (ms) */
  detectedAt: number;
  /** Expiration timestamp (ms) */
  expiresAt: number;
  /** Whether already pushed to subscribers */
  pushed: boolean;
  /** Action link (optional) */
  actionUrl?: string;
}

export interface PushSubscription {
  /** Subscription ID */
  id: string;
  /** User ID */
  userId: string;
  /** Connected WebSocket ID */
  socketId: string;
  /** Watchlist symbols to filter by */
  symbols: string[];
  /** Minimum severity to receive */
  minLevel: BreakingLevel;
  /** Markets to watch */
  markets: string[];
  /** Created at */
  createdAt: number;
}

export interface PushEvent {
  /** Event type */
  type: 'breaking_alert' | 'alert_expired' | 'subscription_update';
  /** Alert data (for breaking_alert) */
  alert?: BreakingAlert;
  /** Subscription data */
  subscription?: PushSubscription;
  /** Server timestamp */
  serverTs: number;
}

export interface PushStats {
  /** Total alerts detected */
  totalAlerts: number;
  /** Alerts by level */
  byLevel: Record<BreakingLevel, number>;
  /** Total pushes delivered */
  totalPushes: number;
  /** Active subscriptions */
  activeSubscriptions: number;
  /** Alerts in active pool */
  activeAlerts: number;
  /** Average end-to-end latency (ms) */
  avgLatencyMs: number;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

/** TTL per level (ms) */
const ALERT_TTL: Record<BreakingLevel, number> = {
  flash: 15 * 60_000,    // 15 min
  urgent: 30 * 60_000,   // 30 min
  breaking: 60 * 60_000, // 1 hour
};

/** Minimum sources for each level */
const MIN_SOURCES: Record<BreakingLevel, number> = {
  flash: 1,
  urgent: 2,
  breaking: 3,
};

/** Sentiment threshold for each level */
const SENTIMENT_THRESHOLD: Record<BreakingLevel, number> = {
  flash: 0.8,
  urgent: 0.6,
  breaking: 0.4,
};

/** Max alerts kept in active pool */
const MAX_ACTIVE_ALERTS = 200;

/** Cleanup interval (ms) */
const CLEANUP_INTERVAL = 60_000;

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class BreakingNewsPushEngine {
  private static instance: BreakingNewsPushEngine;

  /** Active alert pool (keyed by alert id) */
  private alerts: Map<string, BreakingAlert> = new Map();
  /** Active subscriptions (keyed by subscription id) */
  private subscriptions: Map<string, PushSubscription> = new Map();
  /** Socket ID → subscription IDs mapping */
  private socketSubscriptions: Map<string, Set<string>> = new Map();
  /** Pushed alert ID set (dedup) */
  private pushedAlertIds: Set<string> = new Set();
  /** Stats */
  private stats: PushStats = this.createEmptyStats();
  /** Latency samples */
  private latencySamples: number[] = [];
  /** Cleanup timer */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  /** Push callback (set by consumer) */
  private onPush: ((event: PushEvent, socketId: string) => void) | null = null;

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): BreakingNewsPushEngine {
    if (!BreakingNewsPushEngine.instance) {
      BreakingNewsPushEngine.instance = new BreakingNewsPushEngine();
    }
    return BreakingNewsPushEngine.instance;
  }

  // ═════════════════════════════════════════════════════════
  // Push Callback Registration
  // ═════════════════════════════════════════════════════════

  /** Register push callback (WebSocket server integration point) */
  registerPushCallback(cb: (event: PushEvent, socketId: string) => void): void {
    this.onPush = cb;
  }

  // ═════════════════════════════════════════════════════════
  // Alert Ingestion
  // ═════════════════════════════════════════════════════════

  /**
   * Ingest a breaking alert from the news pipeline.
   * Determines level based on sentiment magnitude and source count,
   * deduplicates, and pushes to matching subscriptions.
   */
  ingestAlert(raw: {
    symbol: string; market: string; title: string; summary: string;
    source: string; sourceAuthority: number; sourceCount: number;
    sentiment: number; id?: string;
  }): BreakingAlert | null {
    const now = Date.now();
    const absSent = Math.abs(raw.sentiment);

    // Determine level
    let level: BreakingLevel | null = null;
    if (absSent >= SENTIMENT_THRESHOLD.flash && raw.sourceCount >= MIN_SOURCES.flash) {
      level = 'flash';
    } else if (absSent >= SENTIMENT_THRESHOLD.urgent && raw.sourceCount >= MIN_SOURCES.urgent) {
      level = 'urgent';
    } else if (absSent >= SENTIMENT_THRESHOLD.breaking && raw.sourceCount >= MIN_SOURCES.breaking) {
      level = 'breaking';
    }

    if (!level) return null;

    const alertId = raw.id || `ba-${raw.symbol}-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const dedupKey = `${raw.symbol}:${level}:${raw.source}:${Math.round(raw.sentiment * 100)}`;
    if (this.pushedAlertIds.has(dedupKey)) return null;

    const alert: BreakingAlert = {
      id: alertId,
      level,
      symbol: raw.symbol,
      market: raw.market,
      title: raw.title,
      summary: raw.summary,
      source: raw.source,
      sourceAuthority: Math.min(1, Math.max(0, raw.sourceAuthority)),
      sourceCount: raw.sourceCount,
      consensusSentiment: Math.round(raw.sentiment * 100) / 100,
      detectedAt: now,
      expiresAt: now + ALERT_TTL[level],
      pushed: false,
    };

    // Add to pool
    this.alerts.set(alertId, alert);
    this.pushedAlertIds.add(dedupKey);
    this.stats.totalAlerts++;
    this.stats.byLevel[level]++;

    // Enforce pool cap
    if (this.alerts.size > MAX_ACTIVE_ALERTS) {
      this.evictOldest();
    }

    // Push to matching subscribers
    this.pushToSubscribers(alert);

    return alert;
  }

  /**
   * Batch ingest from WatchlistSmartNews breaking scan output.
   */
  ingestBatch(alerts: Array<{
    symbol: string; market: string; title: string; summary: string;
    source: string; sourceAuthority: number; sourceCount: number;
    sentiment: number;
  }>): BreakingAlert[] {
    return alerts.map(a => this.ingestAlert(a)).filter(Boolean) as BreakingAlert[];
  }

  // ═════════════════════════════════════════════════════════
  // Subscription Management
  // ═════════════════════════════════════════════════════════

  /**
   * Subscribe to breaking news pushes.
   */
  subscribe(params: {
    userId: string; socketId: string; symbols: string[];
    minLevel?: BreakingLevel; markets?: string[];
  }): PushSubscription {
    const sub: PushSubscription = {
      id: `sub-${params.userId}-${params.socketId}-${Date.now()}`,
      userId: params.userId,
      socketId: params.socketId,
      symbols: params.symbols.map(s => s.toUpperCase()),
      minLevel: params.minLevel || 'breaking',
      markets: params.markets || ['US', 'HK', 'CRYPTO'],
      createdAt: Date.now(),
    };

    this.subscriptions.set(sub.id, sub);

    // Index by socket
    if (!this.socketSubscriptions.has(params.socketId)) {
      this.socketSubscriptions.set(params.socketId, new Set());
    }
    this.socketSubscriptions.get(params.socketId)!.add(sub.id);

    this.stats.activeSubscriptions = this.subscriptions.size;
    return sub;
  }

  /**
   * Unsubscribe.
   */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      this.socketSubscriptions.get(sub.socketId)?.delete(subscriptionId);
      this.subscriptions.delete(subscriptionId);
      this.stats.activeSubscriptions = this.subscriptions.size;
      return true;
    }
    return false;
  }

  /**
   * Unsubscribe all subscriptions for a socket.
   */
  unsubscribeBySocket(socketId: string): number {
    const subIds = this.socketSubscriptions.get(socketId);
    if (!subIds) return 0;
    let count = 0;
    for (const id of subIds) {
      this.subscriptions.delete(id);
      count++;
    }
    this.socketSubscriptions.delete(socketId);
    this.stats.activeSubscriptions = this.subscriptions.size;
    return count;
  }

  /**
   * Update watchlist for a subscription.
   */
  updateSymbols(subscriptionId: string, symbols: string[]): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    sub.symbols = symbols.map(s => s.toUpperCase());
    return true;
  }

  // ═════════════════════════════════════════════════════════
  // Query
  // ═════════════════════════════════════════════════════════

  /**
   * Get all active alerts.
   */
  getActiveAlerts(minLevel?: BreakingLevel): BreakingAlert[] {
    const alerts = Array.from(this.alerts.values())
      .filter(a => a.expiresAt > Date.now());
    if (minLevel) {
      const levels: BreakingLevel[] = ['flash', 'urgent', 'breaking'];
      const cutoff = levels.indexOf(minLevel);
      return alerts.filter(a => levels.indexOf(a.level) <= cutoff);
    }
    return alerts;
  }

  /**
   * Get active alerts for a specific symbol.
   */
  getAlertsForSymbol(symbol: string): BreakingAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.symbol === symbol.toUpperCase() && a.expiresAt > Date.now());
  }

  /**
   * Get subscription by ID.
   */
  getSubscription(subscriptionId: string): PushSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions for a user.
   */
  getUserSubscriptions(userId: string): PushSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId);
  }

  /**
   * Get engine stats.
   */
  getStats(): PushStats {
    this.stats.activeAlerts = this.getActiveAlerts().length;
    this.stats.activeSubscriptions = this.subscriptions.size;
    if (this.latencySamples.length > 0) {
      this.stats.avgLatencyMs = Math.round(
        this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      );
    }
    return { ...this.stats };
  }

  // ═════════════════════════════════════════════════════════
  // Bulk Delivery Management
  // ═════════════════════════════════════════════════════════

  /**
   * Replay un-pushed alerts to a new subscription.
   * Sends the last N active alerts matching the subscriber's criteria.
   */
  replayRecent(subscriptionId: string, count: number = 5): BreakingAlert[] {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return [];

    const matching = this.getActiveAlerts(sub.minLevel)
      .filter(a => sub.symbols.includes(a.symbol))
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .slice(0, count);

    for (const alert of matching) {
      this.deliverToSocket(alert, sub.socketId);
    }

    return matching;
  }

  // ═════════════════════════════════════════════════════════
  // Internal: Push Delivery
  // ═════════════════════════════════════════════════════════

  private pushToSubscribers(alert: BreakingAlert): void {
    const start = Date.now();
    let pushCount = 0;

    for (const [, sub] of this.subscriptions) {
      if (this.matchesSubscription(alert, sub)) {
        this.deliverToSocket(alert, sub.socketId);
        pushCount++;
      }
    }

    alert.pushed = true;
    this.stats.totalPushes += pushCount;

    // Track latency
    const latency = Date.now() - start;
    this.latencySamples.push(latency);
    if (this.latencySamples.length > 1000) {
      this.latencySamples.shift();
    }
  }

  private matchesSubscription(alert: BreakingAlert, sub: PushSubscription): boolean {
    // Level filter
    const levels: BreakingLevel[] = ['flash', 'urgent', 'breaking'];
    if (levels.indexOf(alert.level) > levels.indexOf(sub.minLevel)) {
      return false;
    }
    // Symbol filter
    if (sub.symbols.length > 0 && !sub.symbols.includes(alert.symbol)) {
      return false;
    }
    // Market filter
    if (sub.markets.length > 0 && !sub.markets.includes(alert.market)) {
      return false;
    }
    return true;
  }

  private deliverToSocket(alert: BreakingAlert, socketId: string): void {
    if (!this.onPush) return;
    const event: PushEvent = {
      type: 'breaking_alert',
      alert,
      serverTs: Date.now(),
    };
    this.onPush(event, socketId);
  }

  // ═════════════════════════════════════════════════════════
  // Internal: Maintenance
  // ═════════════════════════════════════════════════════════

  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.expiresAt <= now) {
        this.alerts.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      log.info(`[BreakingNewsPush] Cleaned up ${removed} expired alerts`);
    }
  }

  private evictOldest(): void {
    const sorted = Array.from(this.alerts.entries())
      .sort((a, b) => a[1].detectedAt - b[1].detectedAt);
    const toRemove = sorted.slice(0, Math.ceil(sorted.length * 0.2));
    for (const [id] of toRemove) {
      this.alerts.delete(id);
    }
  }

  private createEmptyStats(): PushStats {
    return {
      totalAlerts: 0,
      byLevel: { flash: 0, urgent: 0, breaking: 0 },
      totalPushes: 0,
      activeSubscriptions: 0,
      activeAlerts: 0,
      avgLatencyMs: 0,
    };
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.alerts.clear();
    this.subscriptions.clear();
    this.socketSubscriptions.clear();
    this.pushedAlertIds.clear();
    this.stats = this.createEmptyStats();
    this.latencySamples = [];
  }
}

export default BreakingNewsPushEngine;
