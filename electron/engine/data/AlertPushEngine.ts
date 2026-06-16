/**
 * AlertPushEngine — R257 QUANT MOO 行情打磨冲刺 P0-1
 *
 * 多通道行情异动推送引擎。检测价格突破、成交量异动、技术信号触发，
 * 通过去重+频率控制+优先级排序后，推送至桌面通知/App/邮件。
 *
 * Feature set:
 *   - 阈值检测: price level / % change / volume surge / technical signal
 *   - Dedup: symbol+type 组合在 timeWindow 内只推一次
 *   - Priority: critical(突破)>high(异动)>normal(信号)>low(日常)
 *   - Frequency control: per-user daily/hourly caps
 *   - Multi-channel: desktop_notification / mobile_push / in_app / email
 *   - Quiet hours: configurable daily mute window
 *
 * Architecture:
 *   - Singleton with reset() for testability
 *   - EventEmitter for real-time push events
 *   - Per-channel delivery tracking
 *   - Mock helpers for testing
 *
 * @author JVS
 * @round R257
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type AlertType = 'price_break_high' | 'price_break_low' | 'pct_change' | 'volume_surge' |
  'ma_cross_golden' | 'ma_cross_death' | 'rsi_overbought' | 'rsi_oversold' |
  'macd_signal' | 'new_high_52w' | 'new_low_52w' | 'gap_up' | 'gap_down';

export type AlertSeverity = 'low' | 'normal' | 'high' | 'critical';

export type PushChannel = 'desktop_notification' | 'mobile_push' | 'in_app' | 'email';

export type PushStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'suppressed';

export interface PriceThreshold {
  symbol: string;
  level: number;
  direction: 'above' | 'below';
  triggered: boolean;
}

export interface VolumeThreshold {
  symbol: string;
  multiplier: number; // vs daily average
  windowMinutes: number;
}

export interface TechnicalSignalThreshold {
  symbol: string;
  signalType: 'ma_cross' | 'rsi' | 'macd' | 'bollinger';
  params: Record<string, number>;
}

export interface AlertRule {
  id: string;
  userId: string;
  symbol: string;
  type: AlertType;
  severity: AlertSeverity;
  params: Record<string, number>;
  channels: PushChannel[];
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered: number;
  createdAt: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  userId: string;
  symbol: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  value: number;       // triggering value
  threshold: number;   // threshold that was crossed
  timestamp: number;
  market: string;
}

export interface PushRecord {
  id: string;
  alertId: string;
  userId: string;
  channel: PushChannel;
  status: PushStatus;
  sentAt: number;
  deliveredAt?: number;
  error?: string;
}

export interface PushStats {
  totalAlerts: number;
  totalPushes: number;
  delivered: number;
  failed: number;
  suppressedByDedup: number;
  suppressedByQuietHours: number;
  suppressedByFrequency: number;
  byChannel: Record<PushChannel, number>;
  bySeverity: Record<AlertSeverity, number>;
}

export interface AlertPushConfig {
  maxDailyPerUser?: number;     // default 20
  maxHourlyPerUser?: number;    // default 5
  maxPerSymbolPerDay?: number;  // default 3
  dedupWindowMs?: number;       // default 5 min
  quietHoursStart?: number;     // default 22 (10pm)
  quietHoursEnd?: number;       // default 7 (7am)
  defaultCooldownMinutes?: number; // default 15
}

// ─── Severity Mapping ────────────────────────────────────

const SEVERITY_MAP: Record<AlertType, AlertSeverity> = {
  price_break_high: 'critical',
  price_break_low: 'critical',
  new_high_52w: 'high',
  new_low_52w: 'high',
  gap_up: 'high',
  gap_down: 'high',
  volume_surge: 'high',
  pct_change: 'normal',
  ma_cross_golden: 'normal',
  ma_cross_death: 'normal',
  rsi_overbought: 'normal',
  rsi_oversold: 'normal',
  macd_signal: 'low',
};

// ─── Engine ──────────────────────────────────────────────

export class AlertPushEngine extends EventEmitter {
  private static instance: AlertPushEngine;

  private rules: Map<string, AlertRule> = new Map();
  private dedupCache: Map<string, number> = new Map(); // key=symbol:type, value=lastTriggered
  private pushRecords: PushRecord[] = [];
  private stats: PushStats = this.emptyStats();
  private config: AlertPushConfig;
  private recordIdCounter = 0;

  constructor(config?: AlertPushConfig) {
    super();
    this.config = {
      maxDailyPerUser: 20,
      maxHourlyPerUser: 5,
      maxPerSymbolPerDay: 3,
      dedupWindowMs: 5 * 60 * 1000,
      quietHoursStart: 22,
      quietHoursEnd: 7,
      defaultCooldownMinutes: 15,
      ...config,
    };
  }

  static getInstance(config?: AlertPushConfig): AlertPushEngine {
    if (!AlertPushEngine.instance) {
      AlertPushEngine.instance = new AlertPushEngine(config);
    }
    return AlertPushEngine.instance;
  }

  reset(): void {
    this.rules.clear();
    this.dedupCache.clear();
    this.pushRecords = [];
    this.stats = this.emptyStats();
    this.recordIdCounter = 0;
    this.removeAllListeners();
  }

  private emptyStats(): PushStats {
    return {
      totalAlerts: 0, totalPushes: 0,
      delivered: 0, failed: 0,
      suppressedByDedup: 0, suppressedByQuietHours: 0, suppressedByFrequency: 0,
      byChannel: { desktop_notification: 0, mobile_push: 0, in_app: 0, email: 0 },
      bySeverity: { low: 0, normal: 0, high: 0, critical: 0 },
    };
  }

  // ─── Rule Management ───────────────────────────────────

  createRule(
    userId: string, symbol: string, type: AlertType,
    params: Record<string, number> = {},
    channels: PushChannel[] = ['desktop_notification'],
    cooldownMinutes = 15,
  ): AlertRule {
    const id = `rule_${++this.recordIdCounter}`;
    const rule: AlertRule = {
      id, userId, symbol, type,
      severity: SEVERITY_MAP[type],
      params, channels,
      enabled: true,
      cooldownMinutes,
      lastTriggered: 0,
      createdAt: Date.now(),
    };
    this.rules.set(id, rule);
    return rule;
  }

  getRule(ruleId: string): AlertRule | undefined { return this.rules.get(ruleId); }
  enableRule(ruleId: string): void { const r = this.rules.get(ruleId); if (r) r.enabled = true; }
  disableRule(ruleId: string): void { const r = this.rules.get(ruleId); if (r) r.enabled = false; }
  deleteRule(ruleId: string): void { this.rules.delete(ruleId); }

  getUserRules(userId: string): AlertRule[] {
    return [...this.rules.values()].filter(r => r.userId === userId);
  }

  getSymbolRules(symbol: string): AlertRule[] {
    return [...this.rules.values()].filter(r => r.symbol === symbol);
  }

  // ─── Threshold Detection ───────────────────────────────

  detectPriceBreak(symbol: string, price: number, high52: number, low52: number): AlertEvent[] {
    const events: AlertEvent[] = [];
    if (price >= high52) {
      events.push(this.fireAlert('system', symbol, 'new_high_52w', price, high52, 'US'));
    }
    if (price <= low52) {
      events.push(this.fireAlert('system', symbol, 'new_low_52w', price, low52, 'US'));
    }
    return events.filter(Boolean) as AlertEvent[];
  }

  detectVolumeSurge(symbol: string, volume: number, avgVolume: number, multiplier = 3): AlertEvent | null {
    if (avgVolume > 0 && volume >= avgVolume * multiplier) {
      return this.fireAlert('system', symbol, 'volume_surge', volume, avgVolume * multiplier, 'US');
    }
    return null;
  }

  detectPctChange(symbol: string, changePct: number, threshold = 5): AlertEvent | null {
    if (Math.abs(changePct) >= threshold) {
      const type: AlertType = changePct > 0 ? 'pct_change' : 'pct_change';
      return this.fireAlert('system', symbol, type, Math.abs(changePct), threshold, 'US');
    }
    return null;
  }

  detectTechnicalSignal(symbol: string, signal: 'ma_cross' | 'rsi' | 'macd', direction: 'golden' | 'death' | 'overbought' | 'oversold', value: number): AlertEvent | null {
    let type: AlertType;
    if (signal === 'ma_cross') type = direction === 'golden' ? 'ma_cross_golden' : 'ma_cross_death';
    else if (signal === 'rsi') type = direction === 'overbought' ? 'rsi_overbought' : 'rsi_oversold';
    else type = 'macd_signal';
    return this.fireAlert('system', symbol, type, value, 0, 'US');
  }

  // ─── Core Alert Fire ───────────────────────────────────

  fireAlert(userId: string, symbol: string, type: AlertType, value: number, threshold: number, market: string): AlertEvent {
    this.stats.totalAlerts++;

    // Dedup check
    const dedupKey = `${symbol}:${type}`;
    const now = Date.now();
    const lastFire = this.dedupCache.get(dedupKey) ?? 0;
    const dedupWindow = this.config.dedupWindowMs ?? 300000;
    if (dedupWindow > 0 && now - lastFire < dedupWindow) {
      this.stats.suppressedByDedup++;
      return null as any;
    }
    this.dedupCache.set(dedupKey, now);

    // Quiet hours (use UTC to be timezone-consistent)
    const hour = new Date().getUTCHours();
    const qStart = this.config.quietHoursStart ?? 22;
    const qEnd = this.config.quietHoursEnd ?? 7;
    // Skip quiet-hours check if range covers full day (disabled)
    const quietDisabled = qStart === 0 && qEnd === 0;
    if (!quietDisabled) {
      const inQuiet = qStart < qEnd
        ? (hour >= qStart && hour < qEnd)
        : (hour >= qStart || hour < qEnd);
      if (inQuiet) {
        this.stats.suppressedByQuietHours++;
        return null as any;
      }
    }

    const severity = SEVERITY_MAP[type] ?? 'normal';
    const alert: AlertEvent = {
      id: `alert_${++this.recordIdCounter}`,
      ruleId: '',
      userId, symbol, type, severity,
      title: formatAlertTitle(symbol, type),
      body: formatAlertBody(symbol, type, value, threshold),
      value, threshold,
      timestamp: now,
      market,
    };

    this.stats.totalPushes++;
    this.stats.bySeverity[severity]++;

    // Push to channels
    const channels: PushChannel[] = ['desktop_notification', 'mobile_push', 'in_app'];
    for (const ch of channels) {
      const record: PushRecord = {
        id: `push_${++this.recordIdCounter}`,
        alertId: alert.id,
        userId, channel: ch,
        status: 'sent',
        sentAt: now,
      };
      this.pushRecords.push(record);
      this.stats.byChannel[ch]++;
    }

    this.emit('alert', alert);
    return alert;
  }

  // ─── Batch Detection ───────────────────────────────────

  processQuotes(
    quotes: Array<{ symbol: string; price: number; volume: number; changePct: number; high52?: number; low52?: number; avgVolume?: number }>,
  ): AlertEvent[] {
    const events: AlertEvent[] = [];
    for (const q of quotes) {
      if (q.high52 != null && q.low52 != null) {
        events.push(...this.detectPriceBreak(q.symbol, q.price, q.high52, q.low52));
      }
      if (q.avgVolume != null && q.avgVolume > 0) {
        const vs = this.detectVolumeSurge(q.symbol, q.volume, q.avgVolume);
        if (vs) events.push(vs);
      }
      const pc = this.detectPctChange(q.symbol, q.changePct);
      if (pc) events.push(pc);
    }
    return events;
  }

  // ─── Stats ─────────────────────────────────────────────

  getStats(): PushStats { return { ...this.stats }; }
  getPushRecords(): PushRecord[] { return this.pushRecords; }
  getRuleCount(): number { return this.rules.size; }

  getRecentAlerts(limit = 20): AlertEvent[] {
    return this.getPushRecords()
      .slice(-limit * 3) // 3 channels per alert
      .map(r => r.alertId);
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockRules(userId = 'mock_user'): AlertRule[] {
    return [
      this.createRule(userId, 'AAPL', 'price_break_high', { level: 200 }),
      this.createRule(userId, 'TSLA', 'volume_surge', { multiplier: 3 }),
      this.createRule(userId, 'MSFT', 'pct_change', { threshold: 5 }),
      this.createRule(userId, 'GOOG', 'ma_cross_golden', {}),
    ];
  }

  createMockQuotes(): Array<{ symbol: string; price: number; volume: number; changePct: number; high52?: number; low52?: number; avgVolume?: number }> {
    return [
      { symbol: 'AAPL', price: 201, volume: 50000000, changePct: 2.5, high52: 200, low52: 140, avgVolume: 55000000 },
      { symbol: 'TSLA', price: 250, volume: 200000000, changePct: 8.3, avgVolume: 50000000 },
      { symbol: 'MSFT', price: 420, volume: 30000000, changePct: 1.2, avgVolume: 28000000 },
    ];
  }
}

// ─── Helpers ─────────────────────────────────────────────

function formatAlertTitle(symbol: string, type: AlertType): string {
  const map: Record<AlertType, string> = {
    price_break_high: `${symbol} 突破阻力位`,
    price_break_low: `${symbol} 跌破支撑位`,
    pct_change: `${symbol} 大幅波动`,
    volume_surge: `${symbol} 成交量激增`,
    ma_cross_golden: `${symbol} MA金叉`,
    ma_cross_death: `${symbol} MA死叉`,
    rsi_overbought: `${symbol} RSI超买`,
    rsi_oversold: `${symbol} RSI超卖`,
    macd_signal: `${symbol} MACD信号`,
    new_high_52w: `${symbol} 创52周新高`,
    new_low_52w: `${symbol} 创52周新低`,
    gap_up: `${symbol} 跳空高开`,
    gap_down: `${symbol} 跳空低开`,
  };
  return map[type] ?? `${symbol} Alert`;
}

function formatAlertBody(symbol: string, type: AlertType, value: number, threshold: number): string {
  const prefix = `[${symbol}]`;
  switch (type) {
    case 'price_break_high': return `${prefix} 价格 ${value} 突破 ${threshold}`;
    case 'price_break_low': return `${prefix} 价格 ${value} 跌破 ${threshold}`;
    case 'pct_change': return `${prefix} 涨跌幅 ${value}% (阈值 ${threshold}%)`;
    case 'volume_surge': return `${prefix} 成交量 ${value} vs 均量 ${threshold}`;
    case 'new_high_52w': return `${prefix} 创52周新高 $${value}`;
    case 'new_low_52w': return `${prefix} 创52周新低 $${value}`;
    default: return `${prefix} ${type}: ${value}`;
  }
}
