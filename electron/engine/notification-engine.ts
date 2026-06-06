import log from 'electron-log';

// ── EventEmitter polyfill (inline, no `import from 'events'`) ──────────────

type EventListener = (...args: any[]) => void;

class EventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[NotificationEngine] Listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type NotificationType = 'signal' | 'alert' | 'system' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationChannel = 'in_app' | 'email' | 'webhook';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  channels: NotificationChannel[];
  read: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
  expiresAt?: number;
}

export interface NotificationRule {
  id: string;
  name: string;
  type: NotificationType;
  condition: (event: any) => boolean;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  enabled: boolean;
  cooldownMs: number;
}

export interface NotificationFilter {
  type?: NotificationType;
  read?: boolean;
  limit?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<NotificationPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

// ── Engine ─────────────────────────────────────────────────────────────────

export class NotificationEngine extends EventEmitter {
  /** All stored notifications keyed by id */
  private notifications: Map<string, Notification> = new Map();

  /** Registered rules keyed by id */
  private rules: Map<string, NotificationRule> = new Map();

  /** Cooldown tracker: ruleId → last trigger timestamp */
  private cooldowns: Map<string, number> = new Map();

  /** Auto-increment counter for unique ids */
  private counter = 0;

  // ── Rule Management ────────────────────────────────────────────────────

  addRule(rule: NotificationRule): void {
    if (this.rules.has(rule.id)) {
      log.warn(`[NotificationEngine] Rule "${rule.id}" already exists, overwriting`);
    }
    this.rules.set(rule.id, { ...rule });
    log.info(`[NotificationEngine] Rule added: ${rule.name} (${rule.id})`);
    this.emit('rule:added', rule);
  }

  removeRule(ruleId: string): boolean {
    const existed = this.rules.delete(ruleId);
    if (existed) {
      this.cooldowns.delete(ruleId);
      log.info(`[NotificationEngine] Rule removed: ${ruleId}`);
      this.emit('rule:removed', ruleId);
    }
    return existed;
  }

  getRule(ruleId: string): NotificationRule | undefined {
    const r = this.rules.get(ruleId);
    return r ? { ...r } : undefined;
  }

  getRules(): NotificationRule[] {
    return Array.from(this.rules.values()).map((r) => ({ ...r }));
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = true;
    return true;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = false;
    return true;
  }

  // ── Event Processing ───────────────────────────────────────────────────

  processEvent(event: any): Notification[] {
    const created: Notification[] = [];
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Cooldown check
      const lastTrigger = this.cooldowns.get(rule.id);
      if (lastTrigger !== undefined && now - lastTrigger < rule.cooldownMs) {
        log.debug(
          `[NotificationEngine] Rule "${rule.name}" skipped (cooldown ${rule.cooldownMs}ms)`
        );
        continue;
      }

      // Condition evaluation
      let matched = false;
      try {
        matched = rule.condition(event);
      } catch (err) {
        log.error(`[NotificationEngine] Rule "${rule.name}" condition threw:`, err);
        continue;
      }

      if (!matched) continue;

      // Build notification
      const notification = this.createNotification(rule, event, now);
      this.notifications.set(notification.id, notification);
      this.cooldowns.set(rule.id, now);
      created.push(notification);

      log.info(
        `[NotificationEngine] Notification created: ${notification.id} ` +
          `(${rule.name}, priority=${notification.priority})`
      );
      this.emit('notification', notification);
    }

    if (created.length > 0) {
      this.emit('batch', created);
    }

    return created;
  }

  // ── Notification Access ────────────────────────────────────────────────

  getNotifications(filter?: NotificationFilter): Notification[] {
    let items = Array.from(this.notifications.values());

    if (filter) {
      if (filter.type !== undefined) {
        items = items.filter((n) => n.type === filter.type);
      }
      if (filter.read !== undefined) {
        items = items.filter((n) => n.read === filter.read);
      }
    }

    // Sort by priority desc, then timestamp desc
    items.sort((a, b) => {
      const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (pw !== 0) return pw;
      return b.timestamp - a.timestamp;
    });

    if (filter?.limit !== undefined && filter.limit > 0) {
      items = items.slice(0, filter.limit);
    }

    return items.map((n) => ({ ...n }));
  }

  getNotification(id: string): Notification | undefined {
    const n = this.notifications.get(id);
    return n ? { ...n } : undefined;
  }

  // ── Read State ─────────────────────────────────────────────────────────

  markRead(notificationId: string): boolean {
    const n = this.notifications.get(notificationId);
    if (!n) return false;
    if (!n.read) {
      n.read = true;
      this.emit('notification:read', notificationId);
    }
    return true;
  }

  markAllRead(): void {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (!n.read) {
        n.read = true;
        count++;
      }
    }
    if (count > 0) {
      log.info(`[NotificationEngine] Marked ${count} notifications as read`);
      this.emit('all:read', count);
    }
  }

  getUnreadCount(): number {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (!n.read) count++;
    }
    return count;
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): NotificationStats {
    const byType: Record<string, number> = {};
    let unread = 0;

    for (const n of this.notifications.values()) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
      if (!n.read) unread++;
    }

    return {
      total: this.notifications.size,
      unread,
      byType,
    };
  }

  // ── Pruning ────────────────────────────────────────────────────────────

  pruneExpired(): number {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, n] of this.notifications.entries()) {
      if (n.expiresAt !== undefined && n.expiresAt <= now) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.notifications.delete(id);
    }

    if (toRemove.length > 0) {
      log.info(`[NotificationEngine] Pruned ${toRemove.length} expired notifications`);
      this.emit('pruned', toRemove.length);
    }

    return toRemove.length;
  }

  // ── Bulk Operations ────────────────────────────────────────────────────

  clear(): void {
    const count = this.notifications.size;
    this.notifications.clear();
    this.cooldowns.clear();
    log.info(`[NotificationEngine] Cleared ${count} notifications`);
    this.emit('cleared', count);
  }

  clearRules(): void {
    const count = this.rules.size;
    this.rules.clear();
    this.cooldowns.clear();
    log.info(`[NotificationEngine] Cleared ${count} rules`);
    this.emit('rules:cleared', count);
  }

  deleteNotification(id: string): boolean {
    const existed = this.notifications.delete(id);
    if (existed) {
      this.emit('notification:deleted', id);
    }
    return existed;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private createNotification(
    rule: NotificationRule,
    event: any,
    now: number
  ): Notification {
    this.counter++;
    const id = `notif_${now}_${this.counter}`;

    const notification: Notification = {
      id,
      type: rule.type,
      priority: rule.priority,
      title: `[${rule.type.toUpperCase()}] ${rule.name}`,
      message:
        typeof event === 'object' && event?.message
          ? String(event.message)
          : `Triggered by rule: ${rule.name}`,
      channels: [...rule.channels],
      read: false,
      timestamp: now,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        event: typeof event === 'object' ? { ...event } : event,
      },
    };

    // Set default expiry based on priority
    if (rule.priority === 'critical') {
      notification.expiresAt = now + 24 * 60 * 60 * 1000; // 24h
    } else if (rule.priority === 'high') {
      notification.expiresAt = now + 12 * 60 * 60 * 1000; // 12h
    } else if (rule.priority === 'normal') {
      notification.expiresAt = now + 6 * 60 * 60 * 1000; // 6h
    } else {
      notification.expiresAt = now + 2 * 60 * 60 * 1000; // 2h
    }

    return notification;
  }
}

// ── Singleton convenience ──────────────────────────────────────────────────

let _instance: NotificationEngine | null = null;

export function getNotificationEngine(): NotificationEngine {
  if (!_instance) {
    _instance = new NotificationEngine();
    log.info('[NotificationEngine] Singleton instance created');
  }
  return _instance;
}

export function resetNotificationEngine(): void {
  if (_instance) {
    _instance.clear();
    _instance.clearRules();
    _instance.removeAllListeners();
    _instance = null;
  }
}

export default NotificationEngine;
