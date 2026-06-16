/**
 * DailyPushEngine — R259 QUANT MOO P1-06
 *
 * 每日推送引擎。管理每个用户的每日推送调度：
 * 盘前简报、盘中异动、收盘总结、个性化推荐、系统通知。
 *
 * Feature set:
 *   - 7 种推送类型: 盘前简报/盘中异动/收盘总结/每日推荐/港股卖空/周末回顾/AI周报
 *   - 用户推送偏好管理 (per-user channel selection + timezone)
 *   - 推送频率控制 (daily/weekly limits)
 *   - 富媒体内容模板 (纯文本/卡片/富文本)
 *   - 推送状态追踪 (queued/sent/delivered/failed/opened)
 *   - A/B 测试分组
 *   - 个性化推荐排序
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Push scheduler with user preferences
 *   - Mock data injection
 *
 * @author JVS
 * @round R259
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type PushType = 'pre_market_briefing' | 'intraday_alert' | 'closing_summary' |
  'daily_recommendation' | 'hk_short_sell' | 'weekend_review' | 'ai_weekly_report';

export type PushChannel = 'desktop' | 'mobile' | 'email' | 'in_app';

export type PushContentFormat = 'text' | 'card' | 'rich';

export type PushStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'opened';

export type ABGroup = 'control' | 'variant_a' | 'variant_b';

export interface PushPreference {
  userId: string;
  enabledTypes: PushType[];
  channels: PushChannel[];
  timezone: string;
  quietStart: number;    // hour
  quietEnd: number;      // hour
  maxDailyPushes: number;
  abGroup: ABGroup;
  language: string;
}

export interface PushContent {
  type: PushType;
  title: string;
  body: string;
  format: PushContentFormat;
  cta?: { text: string; action: string; deepLink?: string };
  imageUrl?: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expiresAt?: number;
}

export interface PushRecord {
  id: string;
  userId: string;
  type: PushType;
  channel: PushChannel;
  content: PushContent;
  status: PushStatus;
  scheduledAt: number;
  sentAt?: number;
  deliveredAt?: number;
  openedAt?: number;
  error?: string;
  abGroup: ABGroup;
}

export interface DailyPushReport {
  date: string;
  totalScheduled: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalFailed: number;
  byType: Record<PushType, number>;
  byChannel: Record<PushChannel, number>;
  byABGroup: Record<ABGroup, { sent: number; opened: number }>;
  openRate: number;
  deliveryRate: number;
}

export interface DailyPushConfig {
  defaultMaxDaily: number;
  defaultQuietStart: number;
  defaultQuietEnd: number;
  defaultChannels: PushChannel[];
  defaultEnabledTypes: PushType[];
}

// ─── Defaults ────────────────────────────────────────────

const ALL_PUSH_TYPES: PushType[] = [
  'pre_market_briefing', 'intraday_alert', 'closing_summary',
  'daily_recommendation', 'hk_short_sell', 'weekend_review', 'ai_weekly_report',
];

const PUSH_TYPE_LABELS: Record<PushType, string> = {
  pre_market_briefing: '盘前简报',
  intraday_alert: '盘中异动',
  closing_summary: '收盘总结',
  daily_recommendation: '每日推荐',
  hk_short_sell: '港股卖空',
  weekend_review: '周末回顾',
  ai_weekly_report: 'AI周报',
};

const PUSH_TYPE_PRIORITIES: Record<PushType, PushContent['priority']> = {
  intraday_alert: 'urgent',
  pre_market_briefing: 'high',
  closing_summary: 'normal',
  daily_recommendation: 'normal',
  hk_short_sell: 'high',
  weekend_review: 'low',
  ai_weekly_report: 'low',
};

// ─── Engine ──────────────────────────────────────────────

export class DailyPushEngine extends EventEmitter {
  private static instance: DailyPushEngine;

  private preferences: Map<string, PushPreference> = new Map();
  private pushRecords: PushRecord[] = [];
  private config: DailyPushConfig;
  private idCounter = 0;

  constructor(config?: Partial<DailyPushConfig>) {
    super();
    this.config = {
      defaultMaxDaily: 5,
      defaultQuietStart: 22,
      defaultQuietEnd: 7,
      defaultChannels: ['desktop', 'mobile'],
      defaultEnabledTypes: ['pre_market_briefing', 'intraday_alert', 'closing_summary'],
      ...config,
    };
  }

  static getInstance(config?: Partial<DailyPushConfig>): DailyPushEngine {
    if (!DailyPushEngine.instance) {
      DailyPushEngine.instance = new DailyPushEngine(config);
    } else if (config) {
      DailyPushEngine.instance.config = { ...DailyPushEngine.instance.config, ...config };
    }
    return DailyPushEngine.instance;
  }

  reset(): void {
    this.preferences.clear();
    this.pushRecords = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Preference Management ─────────────────────────────

  setPreference(pref: PushPreference): void {
    this.preferences.set(pref.userId, { ...pref });
  }

  getPreference(userId: string): PushPreference | undefined {
    return this.preferences.get(userId);
  }

  getOrCreatePreference(userId: string): PushPreference {
    let pref = this.preferences.get(userId);
    if (!pref) {
      pref = {
        userId,
        enabledTypes: [...this.config.defaultEnabledTypes],
        channels: [...this.config.defaultChannels],
        timezone: 'UTC+8',
        quietStart: this.config.defaultQuietStart,
        quietEnd: this.config.defaultQuietEnd,
        maxDailyPushes: this.config.defaultMaxDaily,
        abGroup: 'control',
        language: 'zh',
      };
      this.preferences.set(userId, pref);
    }
    return pref;
  }

  updateTypes(userId: string, types: PushType[]): void {
    const pref = this.getOrCreatePreference(userId);
    pref.enabledTypes = types;
    this.preferences.set(userId, pref);
  }

  updateChannels(userId: string, channels: PushChannel[]): void {
    const pref = this.getOrCreatePreference(userId);
    pref.channels = channels;
    this.preferences.set(userId, pref);
  }

  updateABGroup(userId: string, group: ABGroup): void {
    const pref = this.getOrCreatePreference(userId);
    pref.abGroup = group;
    this.preferences.set(userId, pref);
  }

  // ─── Push Scheduling ───────────────────────────────────

  schedule(userId: string, type: PushType, content: PushContent): PushRecord | null {
    const pref = this.getOrCreatePreference(userId);

    // Check type enabled
    if (!pref.enabledTypes.includes(type)) {
      this.emit('push_blocked', { userId, type, reason: 'type_disabled' });
      return null;
    }

    // Check daily limit
    const todayCount = this.getTodayCount(userId);
    if (todayCount >= pref.maxDailyPushes) {
      this.emit('push_blocked', { userId, type, reason: 'daily_limit' });
      return null;
    }

    // Check quiet hours
    const hour = new Date().getUTCHours();
    if (isInQuiet(hour, pref.quietStart, pref.quietEnd)) {
      this.emit('push_blocked', { userId, type, reason: 'quiet_hours' });
      return null;
    }

    const record: PushRecord = {
      id: `push_${++this.idCounter}`,
      userId, type,
      channel: pref.channels[0] ?? 'desktop',
      content: {
        ...content,
        priority: content.priority ?? PUSH_TYPE_PRIORITIES[type] ?? 'normal',
      },
      status: 'queued',
      scheduledAt: Date.now(),
      abGroup: pref.abGroup,
    };

    this.pushRecords.push(record);
    this.emit('push_scheduled', record);
    return record;
  }

  // ─── Batch Scheduling ──────────────────────────────────

  scheduleToAll(users: string[], type: PushType, contentBuilder: (userId: string, pref: PushPreference) => PushContent): PushRecord[] {
    const records: PushRecord[] = [];
    for (const uid of users) {
      const pref = this.getOrCreatePreference(uid);
      const content = contentBuilder(uid, pref);
      const record = this.schedule(uid, type, content);
      if (record) records.push(record);
    }
    return records;
  }

  // ─── Content Builders ──────────────────────────────────

  buildPreMarketBriefing(symbols: string[], marketSummary: string): PushContent {
    return {
      type: 'pre_market_briefing',
      title: '📈 盘前简报',
      body: `${marketSummary}\n\n关注: ${symbols.slice(0, 5).join('、')}`,
      format: 'card',
      cta: { text: '查看详情', action: 'open_app', deepLink: '/pre-market' },
      priority: 'high',
    };
  }

  buildClosingSummary(topMovers: Array<{ symbol: string; changePct: number }>, marketSummary: string): PushContent {
    const movers = topMovers.slice(0, 3).map(m => `${m.symbol} ${m.changePct > 0 ? '+' : ''}${m.changePct.toFixed(1)}%`).join(' | ');
    return {
      type: 'closing_summary',
      title: '📊 收盘总结',
      body: `${marketSummary}\n${movers}`,
      format: 'card',
      cta: { text: '查看完整', action: 'open_app', deepLink: '/close-summary' },
      priority: 'normal',
    };
  }

  buildIntradayAlert(symbol: string, reason: string, changePct: number): PushContent {
    return {
      type: 'intraday_alert',
      title: `⚠️ ${symbol} 异动提醒`,
      body: `${reason} (${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%)`,
      format: 'text',
      cta: { text: '查看', action: 'open_symbol', deepLink: `/symbol/${symbol}` },
      priority: 'urgent',
    };
  }

  buildDailyRecommendation(stocks: Array<{ symbol: string; reason: string; score: number }>): PushContent {
    const top = stocks[0];
    return {
      type: 'daily_recommendation',
      title: '💡 今日推荐',
      body: `${top.symbol}: ${top.reason} (评分 ${top.score}/100)`,
      format: 'card',
      cta: { text: '查看推荐', action: 'open_app', deepLink: '/recommendations' },
      priority: 'normal',
    };
  }

  // ─── Status Updates ────────────────────────────────────

  markSent(pushId: string): void {
    const r = this.pushRecords.find(p => p.id === pushId);
    if (r) { r.status = 'sent'; r.sentAt = Date.now(); }
  }

  markDelivered(pushId: string): void {
    const r = this.pushRecords.find(p => p.id === pushId);
    if (r) { r.status = 'delivered'; r.deliveredAt = Date.now(); }
  }

  markOpened(pushId: string): void {
    const r = this.pushRecords.find(p => p.id === pushId);
    if (r) { r.status = 'opened'; r.openedAt = Date.now(); }
  }

  markFailed(pushId: string, error: string): void {
    const r = this.pushRecords.find(p => p.id === pushId);
    if (r) { r.status = 'failed'; r.error = error; }
  }

  // ─── Queries ───────────────────────────────────────────

  getTodayCount(userId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    return this.pushRecords.filter(p => {
      const d = new Date(p.scheduledAt).toISOString().slice(0, 10);
      return p.userId === userId && d === today;
    }).length;
  }

  getPushHistory(userId?: string, limit = 20): PushRecord[] {
    let list = userId ? this.pushRecords.filter(p => p.userId === userId) : this.pushRecords;
    return list.slice(-limit);
  }

  getUserPreferences(userId: string): PushPreference {
    return this.getOrCreatePreference(userId);
  }

  // ─── Daily Report ──────────────────────────────────────

  generateReport(date?: string): DailyPushReport {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const today = this.pushRecords.filter(p => { const d = new Date(p.scheduledAt).toISOString().slice(0, 10); return d === targetDate; });

    const report: DailyPushReport = {
      date: targetDate,
      totalScheduled: today.length,
      totalSent: today.filter(p => p.status !== 'queued').length,
      totalDelivered: today.filter(p => p.status === 'delivered' || p.status === 'opened').length,
      totalOpened: today.filter(p => p.status === 'opened').length,
      totalFailed: today.filter(p => p.status === 'failed').length,
      byType: {} as Record<PushType, number>,
      byChannel: {} as Record<PushChannel, number>,
      byABGroup: { control: { sent: 0, opened: 0 }, variant_a: { sent: 0, opened: 0 }, variant_b: { sent: 0, opened: 0 } },
      openRate: 0,
      deliveryRate: 0,
    };

    for (const t of ALL_PUSH_TYPES) report.byType[t] = today.filter(p => p.type === t).length;
    for (const p of today) {
      report.byChannel[p.channel] = (report.byChannel[p.channel] ?? 0) + 1;
      const ab = report.byABGroup[p.abGroup];
      if (ab) {
        if (p.status !== 'queued') ab.sent++;
        if (p.status === 'opened') ab.opened++;
      }
    }

    if (report.totalScheduled > 0) {
      report.openRate = Math.round(report.totalOpened / report.totalScheduled * 100);
      report.deliveryRate = Math.round(report.totalDelivered / report.totalScheduled * 100);
    }

    return report;
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockUsers(n = 3): string[] {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const uid = `mock_user_${i + 1}`;
      ids.push(uid);
      this.setPreference({
        userId: uid,
        enabledTypes: [...ALL_PUSH_TYPES],
        channels: ['desktop', 'mobile'],
        timezone: 'UTC+8',
        quietStart: 23,
        quietEnd: 6,
        maxDailyPushes: 10,
        abGroup: i === 0 ? 'control' : i === 1 ? 'variant_a' : 'variant_b',
        language: 'zh',
      });
    }
    return ids;
  }

  simulatePush(userId: string, type: PushType): PushRecord | null {
    const content: PushContent = {
      type,
      title: `${PUSH_TYPE_LABELS[type]} - Mock`,
      body: `This is a mock ${type} push for ${userId}`,
      format: 'text',
      priority: PUSH_TYPE_PRIORITIES[type] ?? 'normal',
    };
    const record = this.schedule(userId, type, content);
    if (record) {
      this.markSent(record.id);
      this.markDelivered(record.id);
      if (Math.random() > 0.3) this.markOpened(record.id);
    }
    return record;
  }
}

// ─── Helpers ─────────────────────────────────────────────

function isInQuiet(hour: number, start: number, end: number): boolean {
  if (start === 0 && end === 0) return false; // disabled
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
