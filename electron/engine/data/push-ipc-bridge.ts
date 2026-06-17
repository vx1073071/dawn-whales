/**
 * R257 P0-1: 推送桥接 (PushIpcBridge)
 * 
 * 连接推送引擎 → Electron 主进程桌面通知
 * IPC推送通道 + 桌面通知格式化
 * 
 * 功能:
 *   1. IPC推送通道管理 (registerChannel / send)
 *   2. 桌面通知格式化 (平台适配: Windows/macOS/Linux)
 *   3. 推送优先级调度 (high/normal/low)
 *   4. 推送历史与去重
 *   5. 多通道分发 (系统通知 + 应用内toast + 托盘闪烁)
 * 
 * 上游: price-move-push-engine.ts, move-attribution-engine.ts
 * 下游: Electron main process (ipcMain), Notification API
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type PushChannel = 'system' | 'toast' | 'tray' | 'sound';

export type PushPriority = 'high' | 'normal' | 'low';

export interface PushPayload {
  pushId: string;
  title: string;
  body: string;
  subtitle?: string;
  priority: PushPriority;
  channels: PushChannel[];
  category: PushCategory;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type PushCategory =
  | 'price_alert'       // 价格异动
  | 'volume_surge'      // 放量提醒
  | 'news_breaking'     // 突发新闻
  | 'factor_signal'     // 因子信号
  | 'strategy_alert'    // 策略提醒
  | 'calendar_event'    // 宏观日历
  | 'system_health'     // 系统健康
  | 'briefing_ready';   // 简报就绪

export interface PushChannelStats {
  channel: PushChannel;
  sent: number;
  failed: number;
  lastSentAt: number;
}

export interface PushDispatchResult {
  pushId: string;
  channel: PushChannel;
  success: boolean;
  error?: string;
}

export interface PushIpcConfig {
  /** Max pushes per hour per user */
  maxPerHour: number;
  /** Dedup window in ms (duplicate pushes within this window are merged) */
  dedupWindowMs: number;
  /** Minimum interval between pushes of same category (ms) */
  categoryCooldownMs: Record<PushCategory, number>;
  /** Quiet hours: no push during [start, end] in local 24h */
  quietHours?: { start: number; end: number };
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PushIpcConfig = {
  maxPerHour: 10,
  dedupWindowMs: 60_000, // 1 min
  categoryCooldownMs: {
    price_alert: 30_000,       // 30s
    volume_surge: 60_000,      // 1 min
    news_breaking: 120_000,    // 2 min
    factor_signal: 60_000,
    strategy_alert: 300_000,   // 5 min
    calendar_event: 600_000,   // 10 min
    system_health: 600_000,    // 10 min
    briefing_ready: 600_000,   // 10 min
  },
};

// ── Platform notification template ──────────────────────────────────────────

interface PlatformTemplate {
  icon: string;
  urgency: 'critical' | 'normal' | 'low';
  timeout: number;  // ms
}

const PLATFORM_TEMPLATES: Record<PushCategory, PlatformTemplate> = {
  price_alert:    { icon: '📈', urgency: 'critical', timeout: 8_000 },
  volume_surge:   { icon: '📊', urgency: 'critical', timeout: 8_000 },
  news_breaking:  { icon: '📰', urgency: 'critical', timeout: 10_000 },
  factor_signal:  { icon: '🔬', urgency: 'normal',   timeout: 6_000 },
  strategy_alert: { icon: '🎯', urgency: 'critical', timeout: 10_000 },
  calendar_event: { icon: '📅', urgency: 'normal',   timeout: 6_000 },
  system_health:  { icon: '⚙️', urgency: 'low',      timeout: 4_000 },
  briefing_ready: { icon: '📋', urgency: 'normal',   timeout: 6_000 },
};

// ═══════════════════════════════════════════════════════════════════════════
// PushIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class PushIpcBridge {
  private config: PushIpcConfig;
  private pushHistory: PushPayload[] = [];
  private lastCategoryPush: Map<PushCategory, number> = new Map();
  private channelStats: PushChannelStats[] = [];
  private hourlyCounter: { count: number; resetAt: number } = { count: 0, resetAt: 0 };
  private pendingQueue: PushPayload[] = [];
  private registeredChannels: Set<PushChannel> = new Set(['system', 'toast']);

  constructor(config?: Partial<PushIpcConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._resetChannelStats();
  }

  // ── Public API: Push Dispatch ───────────────────────────────────────────

  /**
   * Create and dispatch a push notification.
   * Applies dedup, rate limiting, quiet hours, and multi-channel dispatch.
   */
  dispatch(params: {
    title: string;
    body: string;
    subtitle?: string;
    priority?: PushPriority;
    category: PushCategory;
    channels?: PushChannel[];
    data?: Record<string, unknown>;
  }): PushDispatchResult[] {
    // Rate limit check
    if (!this._checkRateLimit()) {
      return [{
        pushId: 'rate_limited',
        channel: 'system',
        success: false,
        error: 'Hourly rate limit exceeded',
      }];
    }

    // Quiet hours check
    if (this._inQuietHours()) {
      // Queue for later delivery
      const pushId = this._generateId(params.title + params.body);
      this.pendingQueue.push({
        pushId,
        title: params.title,
        body: params.body,
        subtitle: params.subtitle,
        priority: params.priority ?? 'normal',
        channels: params.channels ?? ['system'],
        category: params.category,
        data: params.data,
        timestamp: Date.now(),
      });
      return [{
        pushId,
        channel: 'system',
        success: true,
        error: 'Queued for quiet hours',
      }];
    }

    // Dedup check — use formatted title for matching against pushHistory
    const formattedTitle = this._formatTitle(params.title, params.category);
    if (this._isDuplicate(formattedTitle + params.body)) {
      return [{
        pushId: 'dedup',
        channel: 'system',
        success: false,
        error: 'Duplicate push suppressed',
      }];
    }

    // Category cooldown
    if (this._inCategoryCooldown(params.category)) {
      return [{
        pushId: 'cooldown',
        channel: 'system',
        success: false,
        error: `Category ${params.category} in cooldown`,
      }];
    }

    const pushId = this._generateId(params.title + params.body);
    const channels = params.channels ?? ['system'];

    const payload: PushPayload = {
      pushId,
      title: this._formatTitle(params.title, params.category),
      body: params.body,
      subtitle: params.subtitle,
      priority: params.priority ?? this._defaultPriority(params.category),
      channels,
      category: params.category,
      data: params.data,
      timestamp: Date.now(),
    };

    this.pushHistory.push(payload);
    if (this.pushHistory.length > 500) this.pushHistory.shift();
    this.lastCategoryPush.set(params.category, Date.now());
    this.hourlyCounter.count++;

    // Dispatch to each channel
    return channels.map(ch => this._dispatchToChannel(payload, ch));
  }

  /**
   * Flush pending queue (call after quiet hours end).
   */
  flushQueue(): PushDispatchResult[] {
    const results: PushDispatchResult[] = [];
    const queue = [...this.pendingQueue];
    this.pendingQueue = [];

    for (const payload of queue) {
      this.pushHistory.push(payload);
      for (const ch of payload.channels) {
        results.push(this._dispatchToChannel(payload, ch));
      }
    }

    return results;
  }

  /**
   * Register a push channel for the IPC bridge.
   */
  registerChannel(channel: PushChannel): void {
    this.registeredChannels.add(channel);
    if (!this.channelStats.some(s => s.channel === channel)) {
      this.channelStats.push({
        channel,
        sent: 0,
        failed: 0,
        lastSentAt: 0,
      });
    }
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get push history for a user (most recent first) */
  getHistory(limit = 50): PushPayload[] {
    return this.pushHistory.slice(-limit).reverse();
  }

  /** Get pending queue items */
  getPendingQueue(): PushPayload[] {
    return [...this.pendingQueue];
  }

  /** Get channel statistics */
  getChannelStats(): PushChannelStats[] {
    return this.channelStats.map(s => ({ ...s }));
  }

  /** Get current config */
  getConfig(): PushIpcConfig {
    return { ...this.config };
  }

  /** Update config at runtime */
  updateConfig(patch: Partial<PushIpcConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /** Reset all state */
  reset(): void {
    this.pushHistory = [];
    this.lastCategoryPush.clear();
    this.pendingQueue = [];
    this.hourlyCounter = { count: 0, resetAt: 0 };
    this._resetChannelStats();
  }

  // ── Private: Dispatch Logic ─────────────────────────────────────────────

  private _dispatchToChannel(payload: PushPayload, channel: PushChannel): PushDispatchResult {
    const stat = this.channelStats.find(s => s.channel === channel);
    if (!this.registeredChannels.has(channel)) {
      if (stat) stat.failed++;
      return { pushId: payload.pushId, channel, success: false, error: 'Channel not registered' };
    }

    // Platform-specific formatting
    const formatted = this._formatForPlatform(payload, channel);

    // In production, this would call Electron IPC:
    // ipcRenderer.send('push:notify', formatted)
    // or mainWindow.webContents.send('push:show', formatted)

    if (stat) {
      stat.sent++;
      stat.lastSentAt = Date.now();
    }

    return {
      pushId: payload.pushId,
      channel,
      success: true,
    };
  }

  private _formatForPlatform(payload: PushPayload, channel: PushChannel): Record<string, unknown> {
    const template = PLATFORM_TEMPLATES[payload.category];

    switch (channel) {
      case 'system':
        return {
          type: 'system_notification',
          title: `${template.icon} ${payload.title}`,
          body: payload.body,
          subtitle: payload.subtitle,
          urgency: payload.priority === 'high' ? 'critical' : template.urgency,
          timeout: template.timeout,
          icon: this._platformIcon(payload.category),
          data: payload.data,
          timestamp: payload.timestamp,
        };

      case 'toast':
        return {
          type: 'toast',
          title: `${template.icon} ${payload.title}`,
          body: payload.body,
          priority: payload.priority,
          timeout: template.timeout,
          actionButtons: this._actionButtons(payload.category),
          timestamp: payload.timestamp,
        };

      case 'tray':
        return {
          type: 'tray_flash',
          title: payload.title,
          body: payload.body,
          flashInterval: payload.priority === 'high' ? 500 : 1000,
          timestamp: payload.timestamp,
        };

      case 'sound':
        return {
          type: 'sound_play',
          soundId: payload.priority === 'high' ? 'alert_high' : 'alert_normal',
          timestamp: payload.timestamp,
        };

      default:
        return { type: 'unknown', ...payload };
    }
  }

  private _platformIcon(category: PushCategory): string {
    const icons: Record<PushCategory, string> = {
      price_alert: 'assets/icons/push-price.png',
      volume_surge: 'assets/icons/push-volume.png',
      news_breaking: 'assets/icons/push-news.png',
      factor_signal: 'assets/icons/push-factor.png',
      strategy_alert: 'assets/icons/push-strategy.png',
      calendar_event: 'assets/icons/push-calendar.png',
      system_health: 'assets/icons/push-system.png',
      briefing_ready: 'assets/icons/push-briefing.png',
    };
    return icons[category];
  }

  private _actionButtons(category: PushCategory): Array<{ label: string; action: string }> {
    const buttons: Record<PushCategory, Array<{ label: string; action: string }>> = {
      price_alert:    [{ label: '查看详情', action: 'open_chart' }, { label: '添加提醒', action: 'add_alert' }],
      volume_surge:   [{ label: '查看量比', action: 'open_volume' }, { label: '查看龙虎榜', action: 'open_lhb' }],
      news_breaking:  [{ label: '阅读全文', action: 'open_news' }, { label: '加入自选', action: 'add_watchlist' }],
      factor_signal:  [{ label: '查看因子', action: 'open_factors' }, { label: '一键回测', action: 'start_backtest' }],
      strategy_alert: [{ label: '查看策略', action: 'open_strategy' }, { label: '模拟跟踪', action: 'sim_track' }],
      calendar_event: [{ label: '查看日历', action: 'open_calendar' }, { label: '设置提醒', action: 'set_reminder' }],
      system_health:  [{ label: '查看状态', action: 'open_health' }],
      briefing_ready: [{ label: '查看简报', action: 'open_briefing' }],
    };
    return buttons[category];
  }

  // ── Private: Rate Limiting ──────────────────────────────────────────────

  private _checkRateLimit(): boolean {
    const now = Date.now();
    if (now >= this.hourlyCounter.resetAt) {
      this.hourlyCounter = { count: 0, resetAt: now + 3_600_000 };
    }
    return this.hourlyCounter.count < this.config.maxPerHour;
  }

  private _isDuplicate(content: string): boolean {
    const cutoff = Date.now() - this.config.dedupWindowMs;
    const hash = this._hash(content);
    return this.pushHistory.some(
      p => p.timestamp > cutoff && this._hash(p.title + p.body) === hash,
    );
  }

  private _inCategoryCooldown(category: PushCategory): boolean {
    const last = this.lastCategoryPush.get(category);
    if (!last) return false;
    return (Date.now() - last) < (this.config.categoryCooldownMs[category] ?? 0);
  }

  private _inQuietHours(): boolean {
    if (!this.config.quietHours) return false;
    const hour = new Date().getHours();
    const { start, end } = this.config.quietHours;
    if (start <= end) {
      return hour >= start && hour < end;
    } else {
      return hour >= start || hour < end; // overnight range
    }
  }

  private _defaultPriority(category: PushCategory): PushPriority {
    switch (category) {
      case 'price_alert':
      case 'news_breaking':
      case 'strategy_alert':
        return 'high';
      case 'system_health':
        return 'low';
      default:
        return 'normal';
    }
  }

  private _formatTitle(title: string, category: PushCategory): string {
    const prefix = PLATFORM_TEMPLATES[category]?.icon ?? '';
    return prefix ? `${prefix} ${title}` : title;
  }

  // ── Private: Utilities ──────────────────────────────────────────────────

  private _generateId(seed: string): string {
    return `push:${this._hash(seed + Date.now()).toString(36).slice(0, 8)}`;
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }

  private _resetChannelStats(): void {
    this.channelStats = [
      { channel: 'system', sent: 0, failed: 0, lastSentAt: 0 },
      { channel: 'toast',  sent: 0, failed: 0, lastSentAt: 0 },
      { channel: 'tray',   sent: 0, failed: 0, lastSentAt: 0 },
      { channel: 'sound',  sent: 0, failed: 0, lastSentAt: 0 },
    ];
  }
}

export const pushIpcBridge = new PushIpcBridge();
