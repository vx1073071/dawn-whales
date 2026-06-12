// DAWN WHALES R115 QTE-32 — AlertService
// PM: 价格/成交量/盘口/指标触发, 4通知渠道: System/Telegram/Toast/邮件, 100并发<100ms, 误触发<1%

export type AlertType = 'price' | 'volume' | 'orderbook' | 'indicator' | 'spread' | 'imbalance';
export type AlertChannel = 'system' | 'telegram' | 'feishu' | 'email';
export type AlertOperator = '>' | '<' | '>=' | '<=' | '=' | 'cross_above' | 'cross_below';

export interface AlertRule {
  id: string;
  type: AlertType;
  symbol: string;
  brokerId?: string;
  field: string;        // 'price', 'volume', 'bid', 'ask', 'spread', 'imbalance', 'liquidity', indicator id
  operator: AlertOperator;
  value: number;
  channels: AlertChannel[];
  cooldownMs: number;   // minimum time between triggers
  enabled: boolean;
  label?: string;
  createdAt: number;
  lastTriggeredAt?: number;
  triggerCount: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  type: AlertType;
  symbol: string;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  channel: AlertChannel;
  acknowledged: boolean;
}

export interface AlertStats {
  totalRules: number;
  enabledRules: number;
  totalTriggers: number;
  lastTriggerAt: number | null;
  byType: Map<AlertType, number>;
}

type ChannelHandler = (event: AlertEvent) => void;

// ═══════════ AlertService ═══════════

export class AlertService {
  private rules: Map<string, AlertRule> = new Map();
  private events: AlertEvent[] = [];
  private channelHandlers: Map<AlertChannel, ChannelHandler[]> = new Map();
  private previousValues: Map<string, number> = new Map(); // for cross detection
  private eventIdCounter = 0;

  /** Register a channel handler */
  on(channel: AlertChannel, handler: ChannelHandler): void {
    const handlers = this.channelHandlers.get(channel) || [];
    handlers.push(handler);
    this.channelHandlers.set(channel, handlers);
  }

  /** Add or update a rule */
  addRule(rule: Omit<AlertRule, 'triggerCount' | 'lastTriggeredAt' | 'createdAt'>): AlertRule {
    const existing = this.rules.get(rule.id);
    const full: AlertRule = {
      ...rule,
      createdAt: existing?.createdAt ?? Date.now(),
      triggerCount: existing?.triggerCount ?? 0,
      lastTriggeredAt: existing?.lastTriggeredAt,
    };
    this.rules.set(rule.id, full);
    return full;
  }

  /** Remove a rule */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /** Enable/disable a rule */
  toggleRule(id: string, enabled?: boolean): AlertRule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;
    rule.enabled = enabled ?? !rule.enabled;
    return rule;
  }

  /** Check a value against all applicable rules */
  check(symbol: string, field: string, value: number, brokerId?: string): AlertEvent[] {
    const triggered: AlertEvent[] = [];
    const now = Date.now();
    const key = `${symbol}:${field}:${brokerId ?? ''}`;
    const prevValue = this.previousValues.get(key);

    for (const [, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (rule.symbol !== '*') {
        // Wildcard support
        const parts = rule.symbol.split('*');
        let match = true;
        for (const p of parts) {
          if (p && !symbol.includes(p)) { match = false; break; }
        }
        if (!match) continue;
      }
      if (rule.brokerId && rule.brokerId !== brokerId) continue;
      if (rule.field !== field) continue;

      // Cooldown check
      if (rule.lastTriggeredAt && now - rule.lastTriggeredAt < rule.cooldownMs) continue;

      // Operator check
      const shouldTrigger = this.evaluate(rule.operator, value, rule.value, prevValue ?? undefined);
      if (!shouldTrigger) continue;

      // Fire
      const event: AlertEvent = {
        id: `alert-${this.eventIdCounter++}-${Date.now()}`,
        ruleId: rule.id,
        type: rule.type,
        symbol,
        message: rule.label || `${symbol} ${field} ${rule.operator} ${rule.value}: current ${value}`,
        currentValue: value,
        threshold: rule.value,
        timestamp: now,
        channel: rule.channels[0],
        acknowledged: false,
      };

      rule.lastTriggeredAt = now;
      rule.triggerCount++;
      this.events.push(event);

      // Dispatch
      for (const ch of rule.channels) {
        const handlers = this.channelHandlers.get(ch) || [];
        for (const h of handlers) h(event);
        // Also emit generic event with channel info
        event.channel = ch;
      }

      triggered.push(event);
    }

    this.previousValues.set(key, value);
    return triggered;
  }

  /** Batch check multiple fields at once */
  checkBatch(symbol: string, fields: Record<string, number>, brokerId?: string): AlertEvent[] {
    const all: AlertEvent[] = [];
    for (const [field, value] of Object.entries(fields)) {
      const triggered = this.check(symbol, field, value, brokerId);
      all.push(...triggered);
    }
    return all;
  }

  /** Acknowledge an alert */
  acknowledge(eventId: string): void {
    const event = this.events.find((e) => e.id === eventId);
    if (event) event.acknowledged = true;
  }

  /** Get recent events */
  getEvents(limit = 100, type?: AlertType): AlertEvent[] {
    let filtered = this.events;
    if (type) filtered = filtered.filter((e) => e.type === type);
    return filtered.slice(-limit);
  }

  /** Get unacknowledged events */
  getUnacknowledged(): AlertEvent[] {
    return this.events.filter((e) => !e.acknowledged);
  }

  /** Get all rules */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /** Get stats */
  getStats(): AlertStats {
    const byType = new Map<AlertType, number>();
    let enabled = 0, total = 0, maxTriggerAt: number | null = null;
    for (const [, r] of this.rules) {
      total++;
      if (r.enabled) enabled++;
      byType.set(r.type, (byType.get(r.type) || 0) + 1);
      if (r.lastTriggeredAt && (maxTriggerAt === null || r.lastTriggeredAt > maxTriggerAt)) {
        maxTriggerAt = r.lastTriggeredAt;
      }
    }
    return {
      totalRules: total,
      enabledRules: enabled,
      totalTriggers: this.events.length,
      lastTriggerAt: maxTriggerAt,
      byType,
    };
  }

  /** Clear all events (keep rules) */
  clearEvents(): void {
    this.events = [];
  }

  /** Reset everything */
  reset(): void {
    this.rules.clear();
    this.events = [];
    this.previousValues.clear();
  }

  private evaluate(op: AlertOperator, current: number, threshold: number, prev?: number): boolean {
    switch (op) {
      case '>': return current > threshold;
      case '<': return current < threshold;
      case '>=': return current >= threshold;
      case '<=': return current <= threshold;
      case '=': return Math.abs(current - threshold) < 0.0001;
      case 'cross_above': return prev != null && prev <= threshold && current > threshold;
      case 'cross_below': return prev != null && prev >= threshold && current < threshold;
      default: return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-33 PM: CHANNEL ADAPTERS (System/Telegram/飞书/Email)
// ═══════════════════════════════════════════════════════════════════════

export interface ChannelConfig {
  enabled: boolean;
  /** System notification (Electron Notification API) */
  system?: { requireInteraction?: boolean };
  /** Telegram Bot */
  telegram?: { botToken: string; chatId: string };
  /** 飞书 Webhook */
  feishu?: { webhookUrl: string; secret?: string };
  /** Email (SMTP) */
  email?: { smtp: string; port: number; user: string; pass: string; to: string };
}

export class ChannelManager {
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<ChannelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async send(event: AlertEvent, channels: AlertChannel[]): Promise<void> {
    const text = `[${event.type.toUpperCase()}] ${event.message}`;
    const detail = `Symbol: ${event.symbol}\nValue: ${event.currentValue}\nThreshold: ${event.threshold}\nTime: ${new Date(event.timestamp).toISOString()}`;

    for (const ch of channels) {
      try {
        switch (ch) {
          case 'system':
            this.sendSystem(text, detail);
            break;
          case 'telegram':
            if (this.config.telegram) await this.sendTelegram(text, detail);
            break;
          case 'feishu':
            if (this.config.feishu) await this.sendFeishu(text, detail);
            break;
          case 'email':
            if (this.config.email) await this.sendEmail(text, detail);
            break;
        }
      } catch {
        // Channel failure doesn't block other channels
      }
    }
  }

  private sendSystem(text: string, detail: string): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(text, { body: detail, requireInteraction: true });
      }
    }
    // Electron main process fallback
    if (typeof process !== 'undefined' && (process as any).type === 'browser') {
      const { Notification } = require('electron');
      new Notification({ title: text, body: detail });
    }
  }

  private async sendTelegram(text: string, detail: string): Promise<void> {
    if (!this.config.telegram) return;
    const { botToken, chatId } = this.config.telegram;
    const msg = `${text}\n\n${detail}`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    });
  }

  private async sendFeishu(text: string, detail: string): Promise<void> {
    if (!this.config.feishu) return;
    const { webhookUrl } = this.config.feishu;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { content: text, tag: 'plain_text' } },
          elements: [{ tag: 'div', text: { content: detail, tag: 'plain_text' } }],
        },
      }),
    });
  }

  private async sendEmail(text: string, detail: string): Promise<void> {
    // SMTP email via backend proxy (避免客户端泄露密码)
    // This is a placeholder - actual SMTP should go through IPC to main process
    console.log(`[Email Alert] ${text}\n${detail}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-33 PM: SPREAD ALERT (跨所价差警报)
// ═══════════════════════════════════════════════════════════════════════

export interface SpreadAlertConfig {
  /** 价差阈值 (百分比) */
  thresholdPct: number;
  /** 检查间隔 (ms) */
  intervalMs: number;
  /** 最小成交量要求 */
  minVolume?: number;
}

/**
 * 跨所价差警报 - 对接CBBO数据
 * 当同一标的在不同券商的买卖价差超过阈值时触发
 */
export class SpreadAlertService {
  private alertService: AlertService;
  private config: SpreadAlertConfig;

  constructor(
    alertService: AlertService,
    config: SpreadAlertConfig,
  ) {
    this.alertService = alertService;
    this.config = config;
  }

  /**
   * 检查跨所价差
   * @param symbol 标准代码
   * @param bids 各券商最佳买价 [{brokerId, price, volume}]
   * @param asks 各券商最佳卖价 [{brokerId, price, volume}]
   */
  checkSpread(
    symbol: string,
    bids: { brokerId: string; price: number; volume: number }[],
    asks: { brokerId: string; price: number; volume: number }[],
  ): void {
    if (bids.length < 2 || asks.length < 2) return;

    const bestBid = bids.reduce((max, b) => b.price > max.price ? b : max, bids[0]);
    const bestAsk = asks.reduce((min, a) => a.price < min.price ? a : min, asks[0]);

    const spread = (bestAsk.price - bestBid.price) / bestBid.price;
    if (spread <= this.config.thresholdPct) return;

    const minVol = this.config.minVolume || 0;
    if (bestBid.volume < minVol || bestAsk.volume < minVol) return;

    // 触发价差警报
    const ruleId = `spread_${symbol}`;
    this.alertService.addRule({
      id: ruleId,
      type: 'spread',
      symbol,
      field: 'spread',
      operator: '>',
      value: this.config.thresholdPct,
      channels: ['system', 'feishu'],
      cooldownMs: 30000,
      enabled: true,
      label: `${symbol} 跨所价差 ${(spread * 100).toFixed(2)}% (B:${bestBid.brokerId}@${bestBid.price} A:${bestAsk.brokerId}@${bestAsk.price})`,
    });
  }
}
