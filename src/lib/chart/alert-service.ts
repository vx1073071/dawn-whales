// DAWN WHALES R115 QTE-32 — AlertService
// PM: 价格/成交量/盘口/指标触发, 4通知渠道: System/Telegram/Toast/邮件, 100并发<100ms, 误触发<1%

export type AlertType = 'price' | 'volume' | 'orderbook' | 'indicator' | 'spread' | 'imbalance';
export type AlertChannel = 'system' | 'telegram' | 'toast' | 'email';
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
