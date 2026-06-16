/**
 * P1-05 AINotificationEngine — Smart AI Notification Engine
 * R247 — AI Intelligence Sprint
 * JVS / 引擎虾
 *
 * 5 trigger types: position analysis, strategy suggestion, spending report,
 * dividends, 3-day inactive. Intelligent notification scheduling with
 * frequency control, priority ranking, and delivery channels.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Notification trigger type */
export type NotificationTrigger =
  | 'position_analysis'
  | 'strategy_suggestion'
  | 'spending_report'
  | 'dividend_alert'
  | 'inactive_reminder';

/** Notification priority */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/** Notification delivery channel */
export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';

/** A notification template */
export interface NotificationTemplate {
  id: string;
  trigger: NotificationTrigger;
  title: string;
  body: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  /** Whether user can dismiss */
  dismissible: boolean;
  /** Auto-expire after ms (0 = never) */
  ttlMs: number;
  /** Min interval between notifications of this type (ms, 0 = no limit) */
  cooldownMs: number;
}

/** A generated notification */
export interface Notification {
  id: string;
  userId: string;
  templateId: string;
  trigger: NotificationTrigger;
  title: string;
  body: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  data?: Record<string, unknown>;
  createdAt: number;
  deliveredAt?: number;
  readAt?: number;
  dismissedAt?: number;
  expiresAt: number;
  status: 'pending' | 'delivered' | 'read' | 'dismissed' | 'expired';
}

/** User notification preferences */
export interface UserNotificationPrefs {
  userId: string;
  /** Enabled triggers */
  enabledTriggers: NotificationTrigger[];
  /** Preferred channels */
  preferredChannels: NotificationChannel[];
  /** Quiet hours: [startHour, endHour] in UTC */
  quietHours?: [number, number];
  /** Max notifications per day */
  maxPerDay: number;
  /** Whether to aggregate into digest */
  digestEnabled: boolean;
  /** Digest delivery time (hour UTC, 0-23) */
  digestHour?: number;
}

/** Notification delivery stats */
export interface NotificationStats {
  totalGenerated: number;
  totalDelivered: number;
  totalRead: number;
  totalDismissed: number;
  byTrigger: Record<NotificationTrigger, number>;
  byPriority: Record<NotificationPriority, number>;
}

/** Position analysis input */
export interface PositionAnalysisInput {
  userId: string;
  symbols: string[];
  summary: string;
  metrics?: Record<string, number>;
}

/** Strategy suggestion input */
export interface StrategySuggestionInput {
  userId: string;
  strategyName: string;
  performance: string;
  recommendation: string;
}

/** Spending report input */
export interface SpendingReportInput {
  userId: string;
  period: string;
  totalSpent: number;
  breakdown: Array<{ category: string; amount: number }>;
}

/** Dividend alert input */
export interface DividendAlertInput {
  userId: string;
  symbol: string;
  companyName: string;
  amountPerShare: number;
  exDate: string;
  payDate: string;
  yield: number;
}

/** Inactive reminder input */
export interface InactiveReminderInput {
  userId: string;
  daysInactive: number;
  lastLoginDate: string;
  highlights?: string[];
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tpl-position-analysis',
    trigger: 'position_analysis',
    title: 'Position Analysis: {{symbols}}',
    body: 'Here is your position analysis for {{symbols}}: {{summary}}',
    priority: 'medium',
    channels: ['in_app', 'push'],
    dismissible: true,
    ttlMs: 24 * 60 * 60 * 1000, // 24h
    cooldownMs: 6 * 60 * 60 * 1000, // 6h
  },
  {
    id: 'tpl-strategy-suggestion',
    trigger: 'strategy_suggestion',
    title: 'Strategy Suggestion: {{strategyName}}',
    body: 'Performance: {{performance}}. Recommendation: {{recommendation}}',
    priority: 'high',
    channels: ['in_app', 'push', 'email'],
    dismissible: true,
    ttlMs: 48 * 60 * 60 * 1000, // 48h
    cooldownMs: 3 * 60 * 60 * 1000, // 3h
  },
  {
    id: 'tpl-spending-report',
    trigger: 'spending_report',
    title: 'Monthly Spending Report — {{period}}',
    body: 'Total spent: {{totalSpent}} USDT. Top category: {{topCategory}}',
    priority: 'low',
    channels: ['in_app', 'email'],
    dismissible: true,
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    cooldownMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  {
    id: 'tpl-dividend-alert',
    trigger: 'dividend_alert',
    title: 'Dividend Alert: {{companyName}} ({{symbol}})',
    body: '{{amountPerShare}}/share, Ex-date: {{exDate}}, Pay-date: {{payDate}}, Yield: {{yield}}%',
    priority: 'high',
    channels: ['in_app', 'push'],
    dismissible: true,
    ttlMs: 14 * 24 * 60 * 60 * 1000, // 14 days
    cooldownMs: 0, // No cooldown — each dividend is unique
  },
  {
    id: 'tpl-inactive-reminder',
    trigger: 'inactive_reminder',
    title: 'Haven\'t seen you in {{daysInactive}} days!',
    body: 'Check out what you missed: {{highlights}}',
    priority: 'medium',
    channels: ['in_app', 'push', 'email'],
    dismissible: true,
    ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    cooldownMs: 3 * 24 * 60 * 60 * 1000, // 3 days
  },
];

/** Default user preferences */
const DEFAULT_USER_PREFS: Omit<UserNotificationPrefs, 'userId'> = {
  enabledTriggers: ['position_analysis', 'strategy_suggestion', 'spending_report', 'dividend_alert', 'inactive_reminder'],
  preferredChannels: ['in_app', 'push'],
  maxPerDay: 20,
  digestEnabled: false,
};

/** Max notifications to store per user */
const MAX_HISTORY_PER_USER = 500;

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class AINotificationEngine {
  private static instance: AINotificationEngine;

  /** Notification templates */
  private templates: Map<string, NotificationTemplate> = new Map();
  /** Generated notifications: userId → Notification[] */
  private notifications: Map<string, Notification[]> = new Map();
  /** User preferences */
  private prefs: Map<string, UserNotificationPrefs> = new Map();
  /** Cooldown tracker: userId:trigger → lastNotificationTime */
  private cooldowns: Map<string, number> = new Map();
  /** Daily counter: userId:YYYY-MM-DD → count */
  private dailyCounts: Map<string, number> = new Map();
  /** Notification ID counter */
  private idCounter = 0;
  /** Delivery callback */
  private deliveryCallback: ((notification: Notification) => void) | null = null;

  private constructor() {
    for (const tpl of DEFAULT_TEMPLATES) {
      this.templates.set(tpl.id, tpl);
    }
  }

  static getInstance(): AINotificationEngine {
    if (!AINotificationEngine.instance) {
      AINotificationEngine.instance = new AINotificationEngine();
    }
    return AINotificationEngine.instance;
  }

  /** Reset for testing */
  reset(): void {
    this.templates.clear();
    this.notifications.clear();
    this.prefs.clear();
    this.cooldowns.clear();
    this.dailyCounts.clear();
    this.idCounter = 0;
    this.deliveryCallback = null;
    for (const tpl of DEFAULT_TEMPLATES) {
      this.templates.set(tpl.id, tpl);
    }
  }

  /** Register delivery callback */
  onDelivery(cb: (notification: Notification) => void): void {
    this.deliveryCallback = cb;
  }

  // ═══════════════════════════════════════════════════════════════
  // Template Management
  // ═══════════════════════════════════════════════════════════════

  /** Get all templates */
  getTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /** Get a template by id */
  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  /** Register a custom template */
  registerTemplate(tpl: NotificationTemplate): NotificationTemplate {
    this.templates.set(tpl.id, tpl);
    return tpl;
  }

  // ═══════════════════════════════════════════════════════════════
  // User Preferences
  // ═══════════════════════════════════════════════════════════════

  /** Get or create user preferences */
  getPrefs(userId: string): UserNotificationPrefs {
    if (!this.prefs.has(userId)) {
      this.prefs.set(userId, { userId, ...DEFAULT_USER_PREFS });
    }
    return this.prefs.get(userId)!;
  }

  /** Update user preferences */
  updatePrefs(userId: string, updates: Partial<UserNotificationPrefs>): UserNotificationPrefs {
    const prefs = this.getPrefs(userId);
    Object.assign(prefs, updates);
    this.prefs.set(userId, prefs);
    return prefs;
  }

  // ═══════════════════════════════════════════════════════════════
  // Notification Generation
  // ═══════════════════════════════════════════════════════════════

  /** Generate a position analysis notification */
  notifyPositionAnalysis(input: PositionAnalysisInput): Notification | null {
    return this.createNotification('tpl-position-analysis', input.userId, {
      symbols: input.symbols.join(', '),
      summary: input.summary,
    });
  }

  /** Generate a strategy suggestion notification */
  notifyStrategySuggestion(input: StrategySuggestionInput): Notification | null {
    return this.createNotification('tpl-strategy-suggestion', input.userId, {
      strategyName: input.strategyName,
      performance: input.performance,
      recommendation: input.recommendation,
    });
  }

  /** Generate a monthly spending report notification */
  notifySpendingReport(input: SpendingReportInput): Notification | null {
    const topCategory = input.breakdown.length > 0
      ? input.breakdown.reduce((a, b) => a.amount > b.amount ? a : b)
      : null;

    return this.createNotification('tpl-spending-report', input.userId, {
      period: input.period,
      totalSpent: input.totalSpent.toFixed(2),
      topCategory: topCategory ? `${topCategory.category} (${topCategory.amount.toFixed(2)} USDT)` : 'N/A',
    }, { breakdown: input.breakdown });
  }

  /** Generate a dividend alert notification */
  notifyDividend(input: DividendAlertInput): Notification | null {
    return this.createNotification('tpl-dividend-alert', input.userId, {
      companyName: input.companyName,
      symbol: input.symbol,
      amountPerShare: input.amountPerShare.toFixed(4),
      exDate: input.exDate,
      payDate: input.payDate,
      yield: input.yield.toFixed(2),
    });
  }

  /** Generate an inactive reminder */
  notifyInactiveReminder(input: InactiveReminderInput): Notification | null {
    return this.createNotification('tpl-inactive-reminder', input.userId, {
      daysInactive: String(input.daysInactive),
      highlights: (input.highlights || ['market updates', 'new strategies', 'portfolio changes']).join(', '),
    });
  }

  /** Core notification creation with all guards */
  private createNotification(
    templateId: string,
    userId: string,
    vars: Record<string, string>,
    extraData?: Record<string, unknown>,
  ): Notification | null {
    const tpl = this.templates.get(templateId);
    if (!tpl) {
      log.warn(`[AINotification] Template not found: ${templateId}`);
      return null;
    }

    // Check user preferences
    const prefs = this.getPrefs(userId);
    if (!prefs.enabledTriggers.includes(tpl.trigger)) {
      return null; // User disabled this trigger
    }

    // Check cooldown
    const cooldownKey = `${userId}:${tpl.trigger}`;
    const lastSent = this.cooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    if (tpl.cooldownMs > 0 && now - lastSent < tpl.cooldownMs) {
      return null; // Still in cooldown
    }

    // Check daily limit
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `${userId}:${today}`;
    const dailyCount = this.dailyCounts.get(dailyKey) || 0;
    if (dailyCount >= prefs.maxPerDay) {
      return null; // Daily limit reached
    }

    // Check quiet hours
    if (prefs.quietHours) {
      const [start, end] = prefs.quietHours;
      const currentHour = new Date().getUTCHours();
      if (start < end) {
        if (currentHour >= start && currentHour < end) {
          return null; // Quiet hours
        }
      } else {
        // Wraps around midnight
        if (currentHour >= start || currentHour < end) {
          return null; // Quiet hours
        }
      }
    }

    // Fill template
    let title = tpl.title;
    let body = tpl.body;
    for (const [key, val] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      title = title.replace(pattern, val);
      body = body.replace(pattern, val);
    }

    // Resolve channels (intersection of template channels + user preferred channels)
    const channels = tpl.channels.filter(c => prefs.preferredChannels.includes(c));

    const notification: Notification = {
      id: `notif-${++this.idCounter}`,
      userId,
      templateId,
      trigger: tpl.trigger,
      title,
      body,
      priority: tpl.priority,
      channels,
      data: extraData,
      createdAt: now,
      expiresAt: now + tpl.ttlMs,
      status: 'pending',
    };

    // Store
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, []);
    }
    const userNotifications = this.notifications.get(userId)!;
    userNotifications.push(notification);
    if (userNotifications.length > MAX_HISTORY_PER_USER) {
      // Remove oldest
      userNotifications.splice(0, userNotifications.length - MAX_HISTORY_PER_USER);
    }

    // Update cooldown
    this.cooldowns.set(cooldownKey, now);

    // Increment daily count
    this.dailyCounts.set(dailyKey, dailyCount + 1);

    // Deliver
    notification.status = 'delivered';
    notification.deliveredAt = now;
    if (this.deliveryCallback) {
      this.deliveryCallback(notification);
    }

    log.info(`[AINotification] Generated ${notification.id}: ${tpl.trigger} for ${userId}`);
    return notification;
  }

  // ═══════════════════════════════════════════════════════════════
  // Notification Actions
  // ═══════════════════════════════════════════════════════════════

  /** Mark notification as read */
  markRead(userId: string, notifId: string): boolean {
    const notif = this.findNotification(userId, notifId);
    if (!notif) return false;
    notif.status = 'read';
    notif.readAt = Date.now();
    return true;
  }

  /** Mark notification as dismissed */
  dismiss(userId: string, notifId: string): boolean {
    const notif = this.findNotification(userId, notifId);
    if (!notif) return false;
    notif.status = 'dismissed';
    notif.dismissedAt = Date.now();
    return true;
  }

  /** Mark all notifications for a user as read */
  markAllRead(userId: string): number {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return 0;
    let count = 0;
    const now = Date.now();
    for (const n of userNotifications) {
      if (n.status === 'delivered' || n.status === 'pending') {
        n.status = 'read';
        n.readAt = now;
        count++;
      }
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════
  // Notification Retrieval
  // ═══════════════════════════════════════════════════════════════

  /** Find a specific notification */
  private findNotification(userId: string, notifId: string): Notification | undefined {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return undefined;
    return userNotifications.find(n => n.id === notifId);
  }

  /** Get notifications for a user */
  getUserNotifications(
    userId: string,
    options?: {
      status?: Notification['status'];
      trigger?: NotificationTrigger;
      priority?: NotificationPriority;
      limit?: number;
      offset?: number;
    },
  ): { notifications: Notification[]; total: number } {
    const userNotifications = this.notifications.get(userId) || [];
    let filtered = [...userNotifications];

    if (options?.status) {
      filtered = filtered.filter(n => n.status === options.status);
    }
    if (options?.trigger) {
      filtered = filtered.filter(n => n.trigger === options.trigger);
    }
    if (options?.priority) {
      filtered = filtered.filter(n => n.priority === options.priority);
    }

    // Sort newest first
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const total = filtered.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    filtered = filtered.slice(offset, offset + limit);

    return { notifications: filtered, total };
  }

  /** Get unread count for a user */
  getUnreadCount(userId: string): number {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return 0;
    return userNotifications.filter(n => n.status === 'delivered').length;
  }

  /** Get notification stats for a user */
  getUserStats(userId: string): NotificationStats {
    const userNotifications = this.notifications.get(userId) || [];
    const byTrigger: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    let delivered = 0, read = 0, dismissed = 0;
    for (const n of userNotifications) {
      if (n.status === 'delivered' || n.status === 'read') delivered++;
      if (n.status === 'read') read++;
      if (n.status === 'dismissed') dismissed++;

      byTrigger[n.trigger] = (byTrigger[n.trigger] || 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    }

    return {
      totalGenerated: userNotifications.length,
      totalDelivered: delivered,
      totalRead: read,
      totalDismissed: dismissed,
      byTrigger: byTrigger as Record<NotificationTrigger, number>,
      byPriority: byPriority as Record<NotificationPriority, number>,
    };
  }

  /** Clean up expired notifications */
  cleanupExpired(): number {
    let removed = 0;
    const now = Date.now();
    for (const [, userNotifications] of this.notifications) {
      const before = userNotifications.length;
      for (const n of userNotifications) {
        if (n.expiresAt > 0 && now > n.expiresAt && n.status !== 'expired') {
          n.status = 'expired';
        }
      }
    }
    return removed;
  }

  /** Get engine-wide stats */
  getGlobalStats(): { totalUsers: number; totalNotifications: number; avgPerUser: number } {
    const users = this.notifications.size;
    let totalNotifications = 0;
    for (const [, notifs] of this.notifications) {
      totalNotifications += notifs.length;
    }
    return {
      totalUsers: users,
      totalNotifications,
      avgPerUser: users > 0 ? Math.round(totalNotifications / users * 10) / 10 : 0,
    };
  }
}
