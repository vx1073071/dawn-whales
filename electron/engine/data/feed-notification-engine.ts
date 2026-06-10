// ── J-72-02: Feed + Notification Engine ──────────────────────────────────
// Follow feed + system notifications + WebSocket push + offline message queue

// ── Types ────────────────────────────────────────────────────────────────

export interface FeedEvent {
  id: string;
  type: "new_signal" | "new_strategy" | "new_comment" | "like" | "follow" | "share";
  actorId: string;
  targetType: "strategy" | "signal" | "comment" | "benchmark";
  targetId: string;
  targetSummary: string;
  createdAt: number;
}

export interface SystemNotification {
  id: string;
  userId: string;
  type: "subscription_expiring" | "signal_update" | "weekly_report" | "admin_notice" | "alert";
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  expiresAt?: number;
}

export interface NotificationChannel {
  id: string;
  userId: string;
  type: "websocket" | "push" | "email";
  connectionId?: string;
  lastActive: number;
  enabled: boolean;
}

export interface OfflineMessage {
  id: string;
  userId: string;
  event: FeedEvent | SystemNotification;
  queuedAt: number;
  delivered: boolean;
}

// ── Feed Engine ──────────────────────────────────────────────────────────

export class FeedEngine {
  private events: FeedEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  push(event: Omit<FeedEvent, "id" | "createdAt">): FeedEvent {
    const full: FeedEvent = {
      ...event,
      id: `feed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    this.events.push(full);
    // Keep buffer
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
    return full;
  }

  getFeed(
    followingIds: string[],
    options?: { offset?: number; limit?: number; since?: number },
  ): FeedEvent[] {
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 30;
    const since = options?.since ?? 0;

    const following = new Set(followingIds);
    return this.events
      .filter((e) => following.has(e.actorId) && e.createdAt >= since)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit);
  }

  getUserEvents(
    userId: string,
    options?: { offset?: number; limit?: number },
  ): FeedEvent[] {
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 20;
    return this.events
      .filter((e) => e.actorId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit);
  }

  getEventCount(followingIds: string[], since: number): number {
    const following = new Set(followingIds);
    return this.events.filter((e) => following.has(e.actorId) && e.createdAt >= since).length;
  }

  reset(): void {
    this.events = [];
  }
}

// ── Notification Engine ──────────────────────────────────────────────────

export class NotificationEngine {
  private notifications: Map<string, SystemNotification[]> = new Map();
  private channels: Map<string, NotificationChannel[]> = new Map();
  private offlineQueue: OfflineMessage[] = [];
  private readonly MAX_NOTIFICATIONS = 200;
  private readonly MAX_OFFLINE_QUEUE = 5000;

  // ── Notifications ──────────────────────────────────────────────────────

  notify(
    userId: string,
    type: SystemNotification["type"],
    title: string,
    body: string,
    expiresAt?: number,
  ): SystemNotification {
    const notif: SystemNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      type,
      title,
      body,
      read: false,
      createdAt: Date.now(),
      expiresAt,
    };

    const userNotifs = this.notifications.get(userId) ?? [];
    userNotifs.push(notif);
    if (userNotifs.length > this.MAX_NOTIFICATIONS) {
      userNotifs.splice(0, userNotifs.length - this.MAX_NOTIFICATIONS);
    }
    this.notifications.set(userId, userNotifs);

    // Offline delivery check
    this.tryDeliver(userId, notif);

    return notif;
  }

  getNotifications(
    userId: string,
    options?: { offset?: number; limit?: number; unreadOnly?: boolean },
  ): SystemNotification[] {
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 20;
    const unreadOnly = options?.unreadOnly ?? false;

    let list = this.notifications.get(userId) ?? [];
    if (unreadOnly) list = list.filter((n) => !n.read);
    return list
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit);
  }

  markRead(userId: string, notifId: string): { ok: boolean } {
    const list = this.notifications.get(userId);
    if (!list) return { ok: false };
    const n = list.find((n) => n.id === notifId);
    if (n) n.read = true;
    return { ok: true };
  }

  markAllRead(userId: string): { ok: boolean; count: number } {
    const list = this.notifications.get(userId);
    if (!list) return { ok: true, count: 0 };
    let count = 0;
    for (const n of list) {
      if (!n.read) { n.read = true; count++; }
    }
    return { ok: true, count };
  }

  getUnreadCount(userId: string): number {
    return (this.notifications.get(userId) ?? []).filter((n) => !n.read).length;
  }

  // ── Channels / WebSocket ──────────────────────────────────────────────

  registerChannel(userId: string, type: NotificationChannel["type"]): NotificationChannel {
    const channel: NotificationChannel = {
      id: `ch_${userId}_${type}_${Date.now()}`,
      userId,
      type,
      lastActive: Date.now(),
      enabled: true,
    };
    const list = this.channels.get(userId) ?? [];
    list.push(channel);
    this.channels.set(userId, list);
    return channel;
  }

  isOnline(userId: string): boolean {
    const channels = this.channels.get(userId) ?? [];
    const now = Date.now();
    return channels.some((ch) => ch.enabled && now - ch.lastActive < 120_000);
  }

  disconnectChannel(channelId: string): { ok: boolean } {
    for (const [userId, list] of this.channels) {
      const idx = list.findIndex((ch) => ch.id === channelId);
      if (idx >= 0) {
        list[idx].enabled = false;
        return { ok: true };
      }
    }
    return { ok: false };
  }

  // ── Offline Queue ─────────────────────────────────────────────────────

  private tryDeliver(userId: string, event: FeedEvent | SystemNotification): void {
    if (this.isOnline(userId)) return; // Delivered via WS

    const msg: OfflineMessage = {
      id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      event,
      queuedAt: Date.now(),
      delivered: false,
    };
    this.offlineQueue.push(msg);
    if (this.offlineQueue.length > this.MAX_OFFLINE_QUEUE) {
      this.offlineQueue = this.offlineQueue.slice(-this.MAX_OFFLINE_QUEUE);
    }
  }

  getOfflineMessages(userId: string, options?: { limit?: number }): OfflineMessage[] {
    const limit = options?.limit ?? 50;
    return this.offlineQueue
      .filter((m) => m.userId === userId && !m.delivered)
      .sort((a, b) => a.queuedAt - b.queuedAt)
      .slice(0, limit);
  }

  deliverOffline(userId: string): { delivered: number } {
    let count = 0;
    for (const msg of this.offlineQueue) {
      if (msg.userId === userId && !msg.delivered) {
        msg.delivered = true;
        count++;
      }
    }
    return { delivered: count };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [userId, list] of this.notifications) {
      const before = list.length;
      const filtered = list.filter((n) => !n.expiresAt || n.expiresAt > now);
      this.notifications.set(userId, filtered);
      removed += before - filtered.length;
    }
    return removed;
  }

  reset(): void {
    this.notifications.clear();
    this.channels.clear();
    this.offlineQueue = [];
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createFeedEngine(): FeedEngine {
  return new FeedEngine();
}

export function createNotificationEngine(): NotificationEngine {
  return new NotificationEngine();
}
