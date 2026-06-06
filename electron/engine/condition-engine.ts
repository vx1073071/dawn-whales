// electron/engine/condition-engine.ts
// ConditionEngine — 条件触发核心引擎
// Phase 4.2: PriceCondition evaluate + cooldown + maxTriggersPerDay

import {
  ConditionRule,
  Condition,
  PriceCondition,
  TriggerResult,
  MarketSnapshot,
  TriggerEvent,
} from '../types/condition.js';

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isPriceCondition(c: Condition): c is PriceCondition {
  return c.type === 'price';
}

function isToday(ms: number): boolean {
  const now = new Date();
  const d = new Date(ms);
  return (
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate()
  );
}

export class ConditionEngine {
  private rules: Map<string, ConditionRule> = new Map();
  // 每 symbol 的上一个价格（用于 crosses 检测）
  private lastPrice: Map<string, number> = new Map();
  // 触发历史
  private history: TriggerEvent[] = [];

  constructor() {}

  // ── CRUD ──────────────────────────────────────────────

  createRule(
    input: Omit<ConditionRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'>
  ): ConditionRule {
    const rule: ConditionRule = {
      ...input,
      id: generateId(),
      createdAt: new Date(),
      lastTriggeredAt: undefined,
      triggerCount: 0,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  updateRule(
    ruleId: string,
    patch: Partial<Omit<ConditionRule, 'id' | 'createdAt'>>
  ): ConditionRule | null {
    const existing = this.rules.get(ruleId);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.rules.set(ruleId, updated);
    return updated;
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    this.rules.set(ruleId, { ...rule, enabled: true });
    return true;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    this.rules.set(ruleId, { ...rule, enabled: false });
    return true;
  }

  listRules(filter?: {
    symbol?: string;
    enabled?: boolean;
    type?: string;
  }): ConditionRule[] {
    const all = Array.from(this.rules.values());
    if (!filter) return all;
    return all.filter((r) => {
      if (filter.symbol && r.symbol !== filter.symbol) return false;
      if (filter.enabled !== undefined && r.enabled !== filter.enabled) return false;
      if (filter.type && r.condition.type !== filter.type) return false;
      return true;
    });
  }

  clearAll(): void {
    this.rules.clear();
    this.lastPrice.clear();
    this.history = [];
  }

  // ── Evaluate ─────────────────────────────────────────

  /**
   * 评估所有与 symbol 相关的规则，返回每个规则的触发结果
   */
  evaluate(symbol: string, data: MarketSnapshot): TriggerResult[] {
    const rules = this.listRules({ symbol, enabled: true });
    const price = data.close;
    const now = Date.now();

    // 更新 lastPrice（评估前先记录，便于 crosses 检测）
    const prevPrice = this.lastPrice.get(symbol);
    this.lastPrice.set(symbol, price);

    return rules.map((rule) => this.evaluateRule(rule, data, price, prevPrice, now));
  }

  private evaluateRule(
    rule: ConditionRule,
    data: MarketSnapshot,
    price: number,
    prevPrice: number | undefined,
    now: number
  ): TriggerResult {
    // 1. cooldown 检查
    if (rule.lastTriggeredAt !== undefined) {
      const elapsed = now - rule.lastTriggeredAt;
      if (elapsed < rule.cooldownMs) {
        return {
          ruleId: rule.id,
          triggered: false,
          cooldownActive: true,
          reason: `cooldown: ${Math.round(rule.cooldownMs - elapsed)}ms remaining`,
        };
      }
    }

    // 2. maxTriggersPerDay 检查
    const todayTriggers = this.history.filter(
      (e) => e.ruleId === rule.id && isToday(e.triggeredAt)
    ).length;
    if (todayTriggers >= rule.maxTriggersPerDay) {
      return {
        ruleId: rule.id,
        triggered: false,
        cooldownActive: false,
        reason: `maxTriggersPerDay(${rule.maxTriggersPerDay}) reached`,
      };
    }

    // 3. 条件评估
    const triggered = this.checkCondition(rule.condition, data, price, prevPrice);

    if (triggered) {
      // 记录触发
      const updated: ConditionRule = {
        ...rule,
        lastTriggeredAt: now,
        triggerCount: rule.triggerCount + 1,
      };
      this.rules.set(rule.id, updated);

      const event: TriggerEvent = {
        ruleId: rule.id,
        symbol: rule.symbol,
        condition: rule.condition,
        triggeredAt: now,
        priceAtTrigger: price,
        cooldownEndsAt: now + rule.cooldownMs,
      };
      this.history.push(event);

      return {
        ruleId: rule.id,
        triggered: true,
        cooldownActive: false,
        priceAtTrigger: price,
        triggeredAt: now,
        reason: `triggered: ${this.describeCondition(rule.condition)}`,
      };
    }

    return {
      ruleId: rule.id,
      triggered: false,
      cooldownActive: false,
      reason: `not triggered: ${this.describeCondition(rule.condition)}`,
    };
  }

  private checkCondition(
    condition: Condition,
    data: MarketSnapshot,
    price: number,
    prevPrice: number | undefined
  ): boolean {
    if (!isPriceCondition(condition)) {
      // 其他类型暂不支持（Phase 4.2 仅 PriceCondition）
      return false;
    }

    const ref = condition.reference || 'close';
    const value = this.getRefValue(data, ref);

    switch (condition.operator) {
      case 'above':
        return value > condition.targetPrice;
      case 'below':
        return value < condition.targetPrice;
      case 'crosses_above':
        if (prevPrice === undefined) return false;
        return prevPrice <= condition.targetPrice && value > condition.targetPrice;
      case 'crosses_below':
        if (prevPrice === undefined) return false;
        return prevPrice >= condition.targetPrice && value < condition.targetPrice;
      default:
        return false;
    }
  }

  private getRefValue(data: MarketSnapshot, ref: string): number {
    switch (ref) {
      case 'open':   return data.open ?? data.close;
      case 'high':   return data.high ?? data.close;
      case 'low':    return data.low ?? data.close;
      case 'vwap':   return data.vwap ?? data.close;
      case 'close':  return data.close;
      default:        return data.close;
    }
  }

  private describeCondition(c: Condition): string {
    if (!isPriceCondition(c)) return `${c.type}`;
    return `price ${c.operator} ${c.targetPrice} (ref: ${c.reference || 'close'})`;
  }

  // ── History ────────────────────────────────────────────

  getHistory(filter?: { ruleId?: string; since?: number }): TriggerEvent[] {
    let all = this.history;
    if (filter?.ruleId) {
      all = all.filter((e) => e.ruleId === filter.ruleId);
    }
    if (filter?.since !== undefined) {
      all = all.filter((e) => e.triggeredAt >= filter.since);
    }
    return all;
  }

  getRule(ruleId: string): ConditionRule | undefined {
    return this.rules.get(ruleId);
  }

  /** 仅供测试：直接注入上一笔价格（绕过 evaluate 先记录的问题） */
  _setLastPrice(symbol: string, price: number): void {
    this.lastPrice.set(symbol, price);
  }

  /** 仅供测试：获取当前 cooldown 剩余 */
  _getCooldownRemaining(ruleId: string): number {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.lastTriggeredAt === undefined) return 0;
    const elapsed = Date.now() - rule.lastTriggeredAt;
    return Math.max(0, rule.cooldownMs - elapsed);
  }
}
