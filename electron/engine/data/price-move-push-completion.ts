/**
 * R252 P2-32: 涨跌推送完成 (PriceMovePushCompletion — R246续)
 *
 * 在 R246 PriceMovePushEngine 基础上新增：
 *   1. PushDeliveryPipeline — 格式化+投递+状态跟踪+重试
 *   2. UserPushPreferences — 静默/贪睡/自定义阈值/时间窗口/免打扰
 *   3. PostMarketRecap — 盘后回顾(日/周)+盈亏归因
 *   4. PushAnalytics — 打开率/点击率/主动关闭率/用户留存
 *
 * 架构: PushCompletion → Engine (已有) → Delivery → Tracking → Analytics
 */

import { createHash } from 'crypto';
import type {
  PriceMove, MoveExplanation, PushNotification, PushMove, WatchlistItem, PushSchedule,
} from './price-move-push-engine';

// Re-export for convenience
export type {
  PriceMove, MoveExplanation, PushNotification, PushMove, WatchlistItem, PushSchedule,
};

// ── New Types ──────────────────────────────────────────────────────────────

export type DeliveryChannel = 'push_system' | 'email' | 'sms' | 'wechat' | 'feishu' | 'dingtalk';
export type DeliveryStatus = 'pending' | 'queued' | 'sending' | 'delivered' | 'failed' | 'opened' | 'dismissed';
export type RecurrenceRule = 'daily' | 'weekly' | 'never';

export interface PushDeliveryRecord {
  deliveryId: string;
  pushId: string;
  userId: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  scheduledAt: number;
  sentAt?: number;
  deliveredAt?: number;
  openedAt?: number;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
}

export interface UserPushPreferences {
  userId: string;
  channels: DeliveryChannel[];
  activeChannel: DeliveryChannel;
  doNotDisturb: {
    enabled: boolean;
    startHour: number;       // 0-23
    endHour: number;         // 0-23
  };
  muteList: string[];          // muted symbols
  muteAll: boolean;            // nuke switch
  snoozeUntil: number | null;  // epoch ms
  customThresholds: {
    symbol: string;
    threshold: number;         // custom move% threshold
  }[];
  preferredMarkets: Array<'US' | 'HK' | 'A' | 'CRYPTO'>;
  recapRecurrence: RecurrenceRule;
  maxPushesPerDay: number;
  language: 'zh' | 'en';
}

export interface PostMarketRecap {
  recapId: string;
  userId: string;
  market: string;
  date: string;                // YYYY-MM-DD
  period: 'day' | 'week';
  totalMoves: number;
  upMoves: number;
  downMoves: number;
  avgChangePercent: number;
  topMovers: Array<{
    symbol: string;
    direction: 'up' | 'down';
    changePercent: number;
    primaryReason: string;
  }>;
  marketSummary: string;
  marketSummaryCn: string;
  generatedAt: number;
}

export interface PushAnalytics {
  userId: string;
  period: { start: number; end: number };
  totalPushes: number;
  totalDelivered: number;
  totalOpened: number;
  openRate: number;           // 0-1
  totalDismissed: number;
  dismissRate: number;
  avgTimeToOpenMs: number;    // avg ms from delivered→opened
  channelBreakdown: Record<DeliveryChannel, {
    sent: number;
    delivered: number;
    opened: number;
    openRate: number;
  }>;
  topMarkets: { market: string; pushes: number }[];
  engagementTrend: Array<{ date: string; pushes: number; opens: number; openRate: number }>;
}

export interface PushFormatTemplate {
  channel: DeliveryChannel;
  maxLength: number;
  includeEmoji: boolean;
  includeChart: boolean;
  format: (push: PushNotification) => string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PriceMovePushCompletion
// ═══════════════════════════════════════════════════════════════════════════

export class PriceMovePushCompletion {
  private deliveries: Map<string, PushDeliveryRecord> = new Map();
  private preferences: Map<string, UserPushPreferences> = new Map();
  private recaps: PostMarketRecap[] = [];
  private formatTemplates: Map<DeliveryChannel, PushFormatTemplate> = new Map();

  constructor() {
    this._seedTemplates();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 1. PUSH DELIVERY PIPELINE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Convert a PushNotification into delivery records for all user channels.
   * Respects user preferences (DND, mute, snooze).
   */
  scheduleDelivery(push: PushNotification): PushDeliveryRecord[] {
    const prefs = this.preferences.get(push.userId);
    const channels = prefs?.channels ?? ['push_system'];

    // Check DND
    if (prefs?.doNotDisturb?.enabled) {
      const now = new Date();
      const hour = now.getHours();
      const { startHour, endHour } = prefs.doNotDisturb;
      if (endHour >= startHour) {
        if (hour >= startHour && hour < endHour) return [];
      } else {
        // Wrap midnight
        if (hour >= startHour || hour < endHour) return [];
      }
    }

    // Check snooze
    if (prefs?.snoozeUntil && Date.now() < prefs.snoozeUntil) return [];

    // Check muteAll
    if (prefs?.muteAll) return [];

    // Check daily limit
    if (prefs?.maxPushesPerDay) {
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = Array.from(this.deliveries.values())
        .filter(d => d.userId === push.userId && d.sentAt && new Date(d.sentAt).toISOString().slice(0, 10) === today)
        .length;
      if (todayCount >= prefs.maxPushesPerDay) return [];
    }

    // Filter muted symbols from moves
    const mutedSymbols = new Set(prefs?.muteList ?? []);
    const activeMoves = push.moves.filter(m => !mutedSymbols.has(m.symbol));

    if (activeMoves.length === 0) return [];

    // Create filtered push if needed
    const effectivePush = activeMoves.length < push.moves.length
      ? { ...push, moves: activeMoves, summary: this._recomputeSummary(activeMoves) }
      : push;

    const records: PushDeliveryRecord[] = [];
    for (const channel of channels) {
      const record: PushDeliveryRecord = {
        deliveryId: `del:${effectivePush.pushId}:${channel}`,
        pushId: effectivePush.pushId,
        userId: effectivePush.userId,
        channel,
        status: 'queued',
        scheduledAt: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      };
      this.deliveries.set(record.deliveryId, record);
      records.push(record);
    }

    return records;
  }

  /** Simulate delivery → delivered status */
  markDelivered(deliveryId: string): PushDeliveryRecord | null {
    const rec = this.deliveries.get(deliveryId);
    if (!rec) return null;
    rec.status = 'delivered';
    rec.deliveredAt = Date.now();
    return rec;
  }

  /** Mark as opened */
  markOpened(deliveryId: string): PushDeliveryRecord | null {
    const rec = this.deliveries.get(deliveryId);
    if (!rec) return null;
    rec.status = 'opened';
    rec.openedAt = Date.now();
    return rec;
  }

  /** Mark as dismissed */
  markDismissed(deliveryId: string): PushDeliveryRecord | null {
    const rec = this.deliveries.get(deliveryId);
    if (!rec) return null;
    rec.status = 'dismissed';
    return rec;
  }

  /** Retry failed delivery */
  retryDelivery(deliveryId: string): PushDeliveryRecord | null {
    const rec = this.deliveries.get(deliveryId);
    if (!rec || rec.retryCount >= rec.maxRetries) return null;
    rec.retryCount++;
    rec.status = 'queued';
    rec.scheduledAt = Date.now();
    return rec;
  }

  /** Format a push for a specific channel */
  formatForChannel(push: PushNotification, channel: DeliveryChannel): string {
    const template = this.formatTemplates.get(channel);
    if (!template) return JSON.stringify(push);
    return template.format(push);
  }

  /** Get delivery status */
  getDeliveryStatus(deliveryId: string): PushDeliveryRecord | null {
    return this.deliveries.get(deliveryId) ?? null;
  }

  /** Get all pending/failed deliveries that need retry */
  getStuckDeliveries(): PushDeliveryRecord[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.status === 'pending' || d.status === 'queued' || d.status === 'failed');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 2. USER PUSH PREFERENCES
  // ═════════════════════════════════════════════════════════════════════════

  /** Get or create user preferences */
  getPreferences(userId: string): UserPushPreferences {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, {
        userId,
        channels: ['push_system'],
        activeChannel: 'push_system',
        doNotDisturb: { enabled: false, startHour: 22, endHour: 7 },
        muteList: [],
        muteAll: false,
        snoozeUntil: null,
        customThresholds: [],
        preferredMarkets: ['US', 'HK', 'A', 'CRYPTO'],
        recapRecurrence: 'daily',
        maxPushesPerDay: 10,
        language: 'zh',
      });
    }
    return this.preferences.get(userId)!;
  }

  /** Update preferences */
  updatePreferences(userId: string, patch: Partial<Omit<UserPushPreferences, 'userId'>>): UserPushPreferences {
    const prefs = this.getPreferences(userId);
    Object.assign(prefs, patch);
    return prefs;
  }

  /** Mute a symbol */
  muteSymbol(userId: string, symbol: string): UserPushPreferences {
    const prefs = this.getPreferences(userId);
    if (!prefs.muteList.includes(symbol)) {
      prefs.muteList.push(symbol);
    }
    return prefs;
  }

  /** Unmute a symbol */
  unmuteSymbol(userId: string, symbol: string): UserPushPreferences {
    const prefs = this.getPreferences(userId);
    prefs.muteList = prefs.muteList.filter(s => s !== symbol);
    return prefs;
  }

  /** Snooze for N minutes */
  snooze(userId: string, minutes: number): UserPushPreferences {
    const prefs = this.getPreferences(userId);
    prefs.snoozeUntil = Date.now() + minutes * 60000;
    return prefs;
  }

  /** Cancel snooze */
  cancelSnooze(userId: string): UserPushPreferences {
    const prefs = this.getPreferences(userId);
    prefs.snoozeUntil = null;
    return prefs;
  }

  /** Set custom threshold for a symbol */
  setCustomThreshold(userId: string, symbol: string, threshold: number): UserPushPreferences {
    const prefs = this.getPreferences(userId);
    const idx = prefs.customThresholds.findIndex(t => t.symbol === symbol);
    if (idx >= 0) {
      prefs.customThresholds[idx].threshold = threshold;
    } else {
      prefs.customThresholds.push({ symbol, threshold });
    }
    return prefs;
  }

  /** Filter moves by user custom thresholds */
  applyCustomThresholds(userId: string, moves: PriceMove[]): PriceMove[] {
    const prefs = this.preferences.get(userId);
    if (!prefs) return moves;

    const thresholds = new Map(prefs.customThresholds.map(t => [t.symbol, t.threshold]));
    return moves.filter(m => {
      const threshold = thresholds.get(m.symbol);
      return threshold ? Math.abs(m.changePercent) >= threshold : true;
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. POST-MARKET RECAP
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Generate end-of-day/week recap for a user.
   */
  generateRecap(
    userId: string,
    market: string,
    period: 'day' | 'week',
    pushes: PushNotification[],
    date?: string,
  ): PostMarketRecap {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    // Filter pushes for this period
    const cutoffMs = period === 'week'
      ? Date.now() - 7 * 86400000
      : new Date(targetDate + 'T00:00:00').getTime();

    const relevantPushes = pushes.filter(p =>
      p.userId === userId &&
      (period === 'week' || p.generatedAt >= cutoffMs) &&
      p.market === market,
    );

    const allMoves = relevantPushes.flatMap(p => p.moves);
    const upMoves = allMoves.filter(m => m.direction === 'up');
    const downMoves = allMoves.filter(m => m.direction === 'down');

    const topMovers = allMoves
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 5)
      .map(m => ({
        symbol: m.symbol,
        direction: m.direction,
        changePercent: m.changePercent,
        primaryReason: m.oneLineReason.replace(/[🔴🟠🟡🟢]\s*/, ''),
      }));

    const netSentiment = upMoves.length > downMoves.length ? '偏多' : upMoves.length < downMoves.length ? '偏空' : '中性';
    const marketSummaryCn = `${market}市场今日${netSentiment}，共检测${allMoves.length}个异动，${upMoves.length}涨${downMoves.length}跌。主要活跃板块：${this._guessSectors(topMovers)}。`;

    const recap: PostMarketRecap = {
      recapId: `recap:${userId}:${market}:${targetDate}:${period}`,
      userId, market, date: targetDate, period,
      totalMoves: allMoves.length,
      upMoves: upMoves.length,
      downMoves: downMoves.length,
      avgChangePercent: allMoves.length > 0
        ? Math.round(allMoves.reduce((s, m) => s + Math.abs(m.changePercent), 0) / allMoves.length * 100) / 100
        : 0,
      topMovers,
      marketSummary: `${market} market today: ${netSentiment === '偏多' ? 'bullish bias' : netSentiment === '偏空' ? 'bearish bias' : 'neutral'}. ${allMoves.length} moves detected (${upMoves.length} up, ${downMoves.length} down).`,
      marketSummaryCn,
      generatedAt: Date.now(),
    };

    this.recaps.push(recap);
    return recap;
  }

  /** Get recap history for user */
  getRecapHistory(userId: string, market?: string, limit = 10): PostMarketRecap[] {
    return this.recaps
      .filter(r => r.userId === userId && (!market || r.market === market))
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, limit);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. PUSH ANALYTICS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Generate push analytics for a user over a time period.
   */
  getAnalytics(userId: string, start: number, end: number): PushAnalytics {
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => d.userId === userId && d.scheduledAt >= start && d.scheduledAt <= end);

    const total = deliveries.length;
    const delivered = deliveries.filter(d => d.status === 'delivered' || d.status === 'opened' || d.status === 'dismissed');
    const opened = deliveries.filter(d => d.status === 'opened');
    const dismissed = deliveries.filter(d => d.status === 'dismissed');

    // Channel breakdown
    const channelBreakdown = {} as PushAnalytics['channelBreakdown'];
    const channels: DeliveryChannel[] = ['push_system', 'email', 'sms', 'wechat', 'feishu', 'dingtalk'];
    for (const ch of channels) {
      const chDeliveries = deliveries.filter(d => d.channel === ch);
      const chOpened = chDeliveries.filter(d => d.status === 'opened');
      channelBreakdown[ch] = {
        sent: chDeliveries.length,
        delivered: chDeliveries.filter(d => d.status === 'delivered' || d.status === 'opened' || d.status === 'dismissed').length,
        opened: chOpened.length,
        openRate: chDeliveries.length > 0 ? chOpened.length / chDeliveries.length : 0,
      };
    }

    // Avg time to open
    const deliveriesWithOpen = delivered.filter(d => d.openedAt && d.deliveredAt);
    const avgTimeToOpenMs = deliveriesWithOpen.length > 0
      ? deliveriesWithOpen.reduce((s, d) => s + (d.openedAt! - d.deliveredAt!), 0) / deliveriesWithOpen.length
      : 0;

    // Engagement trend (daily)
    const trendMap = new Map<string, { pushes: number; opens: number }>();
    for (const d of deliveries) {
      const day = new Date(d.scheduledAt).toISOString().slice(0, 10);
      if (!trendMap.has(day)) trendMap.set(day, { pushes: 0, opens: 0 });
      const entry = trendMap.get(day)!;
      entry.pushes++;
      if (d.status === 'opened') entry.opens++;
    }
    const engagementTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
      date, pushes: v.pushes, opens: v.opens,
      openRate: v.pushes > 0 ? Math.round(v.opens / v.pushes * 1000) / 1000 : 0,
    }));

    return {
      userId, period: { start, end },
      totalPushes: total,
      totalDelivered: delivered.length,
      totalOpened: opened.length,
      openRate: total > 0 ? Math.round(opened.length / total * 1000) / 1000 : 0,
      totalDismissed: dismissed.length,
      dismissRate: total > 0 ? Math.round(dismissed.length / total * 1000) / 1000 : 0,
      avgTimeToOpenMs,
      channelBreakdown,
      topMarkets: [{ market: 'US', pushes: total }],
      engagementTrend,
    };
  }

  /** Get delivery count by status */
  getDeliveryCounts(userId?: string): Record<DeliveryStatus, number> {
    const records = userId
      ? Array.from(this.deliveries.values()).filter(d => d.userId === userId)
      : Array.from(this.deliveries.values());
    return {
      pending: records.filter(d => d.status === 'pending').length,
      queued: records.filter(d => d.status === 'queued').length,
      sending: records.filter(d => d.status === 'sending').length,
      delivered: records.filter(d => d.status === 'delivered').length,
      failed: records.filter(d => d.status === 'failed').length,
      opened: records.filter(d => d.status === 'opened').length,
      dismissed: records.filter(d => d.status === 'dismissed').length,
    };
  }

  /** Export delivery log for debugging */
  exportDeliveryLog(userId: string, limit = 50): PushDeliveryRecord[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.userId === userId)
      .sort((a, b) => b.scheduledAt - a.scheduledAt)
      .slice(0, limit);
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.deliveries.clear();
    this.preferences.clear();
    this.recaps.length = 0;
    this._seedTemplates();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _seedTemplates(): void {
    this.formatTemplates.set('push_system', {
      channel: 'push_system',
      maxLength: 200,
      includeEmoji: true,
      includeChart: false,
      format: (push: PushNotification) => {
        const lines = [push.summary];
        for (const m of push.moves) {
          lines.push(`${m.oneLineReason}`);
        }
        return lines.join('\n');
      },
    });

    this.formatTemplates.set('email', {
      channel: 'email',
      maxLength: 2000,
      includeEmoji: true,
      includeChart: true,
      format: (push: PushNotification) => {
        const header = `# 📊 ${push.summary}\n\n开盘倒计时: ${push.marketOpenInMinutes}分钟\n`;
        const tableHeader = '| 股票 | 方向 | 变动 | 原因 |\n|------|------|------|------|\n';
        const rows = push.moves.map(m =>
          `| ${m.symbol} | ${m.direction === 'up' ? '📈' : '📉'} | ${m.changePercent > 0 ? '+' : ''}${m.changePercent}% | ${m.oneLineReason.replace(/[🔴🟠🟡🟢]\s*/, '')} |`,
        ).join('\n');
        return header + tableHeader + rows;
      },
    });

    this.formatTemplates.set('sms', {
      channel: 'sms',
      maxLength: 140,
      includeEmoji: false,
      includeChart: false,
      format: (push: PushNotification) => {
        const syms = push.moves.map(m => `${m.symbol}${m.direction === 'up' ? '+' : '-'}${Math.abs(m.changePercent)}%`).join(', ');
        return `[DAWN WHALES] ${push.summary}: ${syms}`;
      },
    });

    this.formatTemplates.set('wechat', {
      channel: 'wechat',
      maxLength: 500,
      includeEmoji: true,
      includeChart: false,
      format: (push: PushNotification) => `${push.summary}\n${push.moves.map(m => m.oneLineReason).join('\n')}`,
    });
  }

  private _recomputeSummary(moves: PushMove[]): string {
    const upCount = moves.filter(p => p.direction === 'up').length;
    const downCount = moves.filter(p => p.direction === 'down').length;
    const parts: string[] = [];
    if (upCount > 0) parts.push(`${upCount}只上涨`);
    if (downCount > 0) parts.push(`${downCount}只下跌`);
    return `你关注的${moves.length}只股票今日盘前异动：${parts.join('，')}`;
  }

  private _guessSectors(topMovers: Array<{ symbol: string; direction: 'up' | 'down' }>): string {
    // Simple heuristic based on symbol patterns
    const techSymbols = ['AAPL', 'GOOGL', 'META', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'INTC'];
    const hasTech = topMovers.some(m => techSymbols.some(t => m.symbol.includes(t)));
    if (hasTech) return '科技';
    if (topMovers.some(m => m.symbol.includes('BTC') || m.symbol.includes('ETH'))) return '加密';
    return '综合';
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: PriceMovePushCompletion | null = null;

export function priceMovePushCompletion(): PriceMovePushCompletion {
  if (!instance) instance = new PriceMovePushCompletion();
  return instance;
}

export function resetPriceMovePushCompletion(): void { instance = null; }
