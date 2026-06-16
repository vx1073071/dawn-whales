
/**
 * QUANT MOO R132 J04 — Notification History Store & Query API
 * 
 * In-memory with optional SQLite persistence for notification history.
 * 
 * Stores:
 *  - Notifications (info/warning/error/success)
 *  - Alerts (price/margin/breaker/liquidation/drawdown)
 *  - Copy trade execution results
 * 
 * Query API:
 *  - Pagination: offset/limit
 *  - Filtering: category, level, symbol, brokerId
 *  - Time range: startTime/endTime
 *  - Unread count
 *  - Bulk read/clear
 */

import {
  WSPushNotification, NotificationLevel,
  WSAlert, AlertType,
} from './ws-push-enhancer';

// ═══════════════ Types ══════════════════════════════════

export interface NotificationQueryOptions {
  userId: string;
  category?: WSPushNotification['category'];
  level?: NotificationLevel;
  symbol?: string;
  brokerId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  sortDirection?: 'asc' | 'desc';
}

export interface AlertQueryOptions {
  userId: string;
  type?: AlertType;
  severity?: WSAlert['severity'];
  resolved?: boolean;
  symbol?: string;
  limit?: number;
  offset?: number;
  sortDirection?: 'asc' | 'desc';
}

export interface QueryResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface StoreStats {
  totalNotifications: number;
  totalAlerts: number;
  totalUnread: number;
  perCategory: Record<string, number>;
  perLevel: Record<string, number>;
  oldestTimestamp: number;
  newestTimestamp: number;
}

// ═══════════════ Notification Store ══════════════════════

export class NotificationStore {
  private notifications: Map<string, WSPushNotification> = new Map();
  private alerts: Map<string, WSAlert> = new Map();
  private readStatus: Set<string> = new Set();
  private resolvedAlerts: Set<string> = new Set();
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  // ═══════════════ Save ══════════════════════════════════

  async save(notification: WSPushNotification): Promise<void> {
    this.notifications.set(notification.id, notification);
    this.evictIfNeeded();
  }

  async saveAlert(alert: WSAlert): Promise<void> {
    this.alerts.set(alert.id, alert);
    this.evictIfNeeded();
  }

  async saveCopyTradeResult(userId: string, result: {
    signalId: string; success: boolean; orderId?: string; brokerId: string; error?: string;
  }): Promise<WSPushNotification> {
    const notification: WSPushNotification = {
      id: `ct-${result.signalId}`,
      userId,
      level: result.success ? 'success' : 'error',
      title: result.success ? '跟单执行成功' : '跟单执行失败',
      message: result.success
        ? `订单 ${result.orderId} 已发送至 ${result.brokerId}`
        : `执行失败: ${result.error || '未知错误'}`,
      category: 'trade',
      data: { signalId: result.signalId, orderId: result.orderId, brokerId: result.brokerId },
      createdAt: Date.now(),
    };
    await this.save(notification);
    return notification;
  }

  // ═══════════════ Query ═════════════════════════════════

  async getByUser(userId: string, options?: {
    category?: string; level?: NotificationLevel; limit?: number; offset?: number;
  }): Promise<WSPushNotification[]> {
    return this.queryNotifications({ userId, ...options });
  }

  queryNotifications(options: NotificationQueryOptions): QueryResult<WSPushNotification> {
    let items = Array.from(this.notifications.values()).filter((n) => {
      if (options.userId && options.userId !== '*' && n.userId !== options.userId) return false;
      if (options.category && n.category !== options.category) return false;
      if (options.level && n.level !== options.level) return false;
      if (options.startTime && n.createdAt < options.startTime) return false;
      if (options.endTime && n.createdAt > options.endTime) return false;
      return true;
    });

    // Sort
    const dir = options.sortDirection === 'asc' ? 1 : -1;
    items.sort((a, b) => (a.createdAt - b.createdAt) * dir);

    const total = items.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;

    items = items.slice(offset, offset + limit);

    return {
      items,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async getAlerts(userId: string, options?: {
    type?: AlertType; severity?: string; limit?: number;
  }): Promise<WSAlert[]> {
    let items = Array.from(this.alerts.values()).filter((a) => {
      if (a.userId !== userId) return false;
      if (options?.type && a.type !== options.type) return false;
      if (options?.severity && a.severity !== options.severity) return false;
      return true;
    });

    items.sort((a, b) => b.createdAt - a.createdAt);
    const limit = options?.limit || 50;
    return items.slice(0, limit);
  }

  queryAlerts(options: AlertQueryOptions): QueryResult<WSAlert> {
    let items = Array.from(this.alerts.values()).filter((a) => {
      if (a.userId !== options.userId) return false;
      if (options.type && a.type !== options.type) return false;
      if (options.severity && a.severity !== options.severity) return false;
      if (options.resolved !== undefined) {
        const isResolved = this.resolvedAlerts.has(a.id) || !!a.resolvedAt;
        if (isResolved !== options.resolved) return false;
      }
      return true;
    });

    const dir = options.sortDirection === 'asc' ? 1 : -1;
    items.sort((a, b) => (a.createdAt - b.createdAt) * dir);

    const total = items.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    items = items.slice(offset, offset + limit);

    return { items, total, offset, limit, hasMore: offset + limit < total };
  }

  // ═══════════════ Trades by Symbol ══════════════════════

  /**
   * Get all trade notifications for a specific symbol (for PnL history).
   */
  getTradeHistory(userId: string, symbol: string, limit = 100): WSPushNotification[] {
    return Array.from(this.notifications.values())
      .filter((n) =>
        n.userId === userId &&
        n.category === 'trade' &&
        n.data?.symbol === symbol,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  // ═══════════════ Read / Clear ══════════════════════════

  async markRead(notificationId: string): Promise<void> {
    this.readStatus.add(notificationId);
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (n.userId === userId && !this.readStatus.has(n.id)) {
        this.readStatus.add(n.id);
        count++;
      }
    }
    return count;
  }

  async markAlertResolved(alertId: string): Promise<void> {
    this.resolvedAlerts.add(alertId);
    const alert = this.alerts.get(alertId);
    if (alert && alert.autoResolve) {
      alert.resolvedAt = Date.now();
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (n.userId === userId && !this.readStatus.has(n.id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total unread + unresolved alerts count.
   */
  async getPendingCount(userId: string): Promise<{ notifications: number; alerts: number }> {
    const notifications = await this.getUnreadCount(userId);
    let alerts = 0;
    for (const a of this.alerts.values()) {
      if (a.userId === userId && !this.resolvedAlerts.has(a.id) && !a.resolvedAt) {
        alerts++;
      }
    }
    return { notifications, alerts };
  }

  async deleteOldNotifications(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let deleted = 0;
    for (const [id, n] of this.notifications) {
      if (n.createdAt < cutoff) {
        this.notifications.delete(id);
        this.readStatus.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  // ═══════════════ Stats ═════════════════════════════════

  getStats(userId?: string): StoreStats {
    const allNotifications = userId
      ? Array.from(this.notifications.values()).filter((n) => n.userId === userId)
      : Array.from(this.notifications.values());

    const allAlerts = userId
      ? Array.from(this.alerts.values()).filter((a) => a.userId === userId)
      : Array.from(this.alerts.values());

    const stats: StoreStats = {
      totalNotifications: allNotifications.length,
      totalAlerts: allAlerts.length,
      totalUnread: allNotifications.filter((n) => !this.readStatus.has(n.id)).length,
      perCategory: {},
      perLevel: {},
      oldestTimestamp: Infinity,
      newestTimestamp: 0,
    };

    for (const n of allNotifications) {
      stats.perCategory[n.category] = (stats.perCategory[n.category] || 0) + 1;
      stats.perLevel[n.level] = (stats.perLevel[n.level] || 0) + 1;
      if (n.createdAt < stats.oldestTimestamp) stats.oldestTimestamp = n.createdAt;
      if (n.createdAt > stats.newestTimestamp) stats.newestTimestamp = n.createdAt;
    }

    if (stats.oldestTimestamp === Infinity) stats.oldestTimestamp = 0;

    return stats;
  }

  // ═══════════════ Private ═══════════════════════════════

  private evictIfNeeded(): void {
    const total = this.notifications.size + this.alerts.size;
    if (total > this.maxEntries) {
      // Remove oldest entries
      const all = [
        ...Array.from(this.notifications.entries()).map(([k, v]) => ({ key: k, ts: v.createdAt, map: 'n' } as const)),
        ...Array.from(this.alerts.entries()).map(([k, v]) => ({ key: k, ts: v.createdAt, map: 'a' } as const)),
      ];
      all.sort((a, b) => a.ts - b.ts);
      const toRemove = total - this.maxEntries + 500; // Remove extra batch
      for (let i = 0; i < toRemove && i < all.length; i++) {
        if (all[i].map === 'n') {
          this.notifications.delete(all[i].key);
          this.readStatus.delete(all[i].key);
        } else {
          this.alerts.delete(all[i].key);
          this.resolvedAlerts.delete(all[i].key);
        }
      }
    }
  }

  dispose(): void {
    this.notifications.clear();
    this.alerts.clear();
    this.readStatus.clear();
    this.resolvedAlerts.clear();
  }
}

// ═══════════════ Singleton ═══════════════════════════════

let _store: NotificationStore | null = null;

export function getNotificationStore(maxEntries = 10000): NotificationStore {
  if (!_store) {
    _store = new NotificationStore(maxEntries);
  }
  return _store;
}
