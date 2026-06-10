// electron/engine/price-trigger.ts
// PriceTriggerEngine — 价格条件触发模块
// J-30-01 ConditionEngine 子模块
// 负责：above / below / crosses_above / crosses_below / breakout 五种价格触发逻辑

import log from 'electron-log';
import type { TriggerResult } from '../types/condition.js';

// ── Interfaces ────────────────────────────────────────────────────────────

export type PriceOperator =
  | 'above'
  | 'below'
  | 'crosses_above'
  | 'crosses_below'
  | 'breakout';

export interface PriceRule {
  id?: string;
  code: string;
  operator: PriceOperator;
  /** 触发阈值价格（breakout 时不使用） */
  threshold?: number;
  /** breakout 范围：[low, high] */
  range?: [number, number];
  /** 冷却时间（ms），同一规则两次触发之间的最小间隔 */
  cooldownMs?: number;
  /** 每日最大触发次数 */
  maxTriggersPerDay?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 备注描述 */
  description?: string;
}

export interface PriceTriggerResult extends TriggerResult {
  code: string;
  operator: PriceOperator;
  currentPrice: number;
  threshold?: number;
  range?: [number, number];
}

interface PriceRuleInternal {
  id: string;
  code: string;
  operator: PriceOperator;
  threshold: number | undefined;
  range: [number, number] | undefined;
  cooldownMs: number;
  maxTriggersPerDay: number;
  enabled: boolean;
  description: string;
  createdAt: number;
  lastTriggeredAt: number | undefined;
  triggerCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function generateRuleId(): string {
  return `ptr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isSameDay(ms: number): boolean {
  const now = new Date();
  const d = new Date(ms);
  return (
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate()
  );
}

// ── PriceTriggerEngine ────────────────────────────────────────────────────

export class PriceTriggerEngine {
  /** 所有规则 */
  private rules: Map<string, PriceRuleInternal> = new Map();

  /** 每只标的上一次价格（用于 crosses 检测） */
  private lastPriceMap: Map<string, number> = new Map();

  /** 触发历史记录 */
  private triggerHistory: PriceTriggerResult[] = [];

  constructor() {
    log.info('[PriceTriggerEngine] initialized');
  }

  // ── CRUD ─────────────────────────────────────────────

  /**
   * 添加一条价格触发规则，返回规则 ID
   */
  addRule(rule: PriceRule): string {
    const id = rule.id ?? generateRuleId();
    const internal: PriceRuleInternal = {
      id,
      code: rule.code,
      operator: rule.operator,
      threshold: rule.threshold,
      range: rule.range,
      cooldownMs: rule.cooldownMs ?? 0,
      maxTriggersPerDay: rule.maxTriggersPerDay ?? Infinity,
      enabled: rule.enabled ?? true,
      description: rule.description ?? '',
      createdAt: Date.now(),
      lastTriggeredAt: undefined,
      triggerCount: 0,
    };
    this.rules.set(id, internal);
    log.info(`[PriceTriggerEngine] rule added: ${id} — ${rule.operator} on ${rule.code}`);
    return id;
  }

  /**
   * 移除规则，返回是否成功
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      log.info(`[PriceTriggerEngine] rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * 获取所有规则（只读副本）
   */
  getRules(): PriceRule[] {
    return Array.from(this.rules.values()).map((r) => ({
      id: r.id,
      code: r.code,
      operator: r.operator,
      threshold: r.threshold,
      range: r.range,
      cooldownMs: r.cooldownMs,
      maxTriggersPerDay: r.maxTriggersPerDay,
      enabled: r.enabled,
      description: r.description,
    }));
  }

  /**
   * 清空所有状态（lastPrice 和 history），规则保留
   */
  clearState(): void {
    this.lastPriceMap.clear();
    this.triggerHistory = [];
    log.info('[PriceTriggerEngine] state cleared (lastPrice + history)');
  }

  /**
   * 清空所有规则 + 状态
   */
  clearAll(): void {
    this.rules.clear();
    this.lastPriceMap.clear();
    this.triggerHistory = [];
    log.info('[PriceTriggerEngine] all rules and state cleared');
  }

  // ── Evaluate ─────────────────────────────────────────

  /**
   * 评估指定标的所有价格规则，返回触发结果数组
   */
  evaluate(code: string, currentPrice: number): PriceTriggerResult[] {
    const prevPrice = this.lastPriceMap.get(code);
    this.lastPriceMap.set(code, currentPrice);

    const matchingRules = Array.from(this.rules.values()).filter(
      (r) => r.code === code && r.enabled
    );

    const results: PriceTriggerResult[] = [];

    for (const rule of matchingRules) {
      const result = this.evaluateRule(rule, code, currentPrice, prevPrice);
      results.push(result);
    }

    return results;
  }

  // ── Private evaluation ───────────────────────────────

  private evaluateRule(
    rule: PriceRuleInternal,
    code: string,
    currentPrice: number,
    prevPrice: number | undefined
  ): PriceTriggerResult {
    const now = Date.now();

    // 冷却检查
    if (rule.lastTriggeredAt !== undefined && rule.cooldownMs > 0) {
      const elapsed = now - rule.lastTriggeredAt;
      if (elapsed < rule.cooldownMs) {
        return this.makeResult(rule, code, currentPrice, false, {
          cooldownActive: true,
          reason: `cooldown: ${Math.round(rule.cooldownMs - elapsed)}ms remaining`,
        });
      }
    }

    // 每日最大触发次数检查
    if (rule.maxTriggersPerDay < Infinity) {
      const todayCount = this.triggerHistory.filter(
        (e) => e.ruleId === rule.id && isSameDay(e.triggeredAt ?? 0)
      ).length;
      if (todayCount >= rule.maxTriggersPerDay) {
        return this.makeResult(rule, code, currentPrice, false, {
          cooldownActive: false,
          reason: `maxTriggersPerDay(${rule.maxTriggersPerDay}) reached`,
        });
      }
    }

    // 条件判断
    const triggered = this.checkCondition(rule, currentPrice, prevPrice);

    if (triggered) {
      // 更新规则内部状态
      rule.lastTriggeredAt = now;
      rule.triggerCount += 1;

      const result = this.makeResult(rule, code, currentPrice, true, {
        cooldownActive: false,
        reason: `triggered: ${rule.operator}`,
        triggeredAt: now,
        priceAtTrigger: currentPrice,
      });

      this.triggerHistory.push(result);
      log.info(
        `[PriceTriggerEngine] TRIGGERED — ${rule.id} | ${code} ${rule.operator} @ ${currentPrice}`
      );
      return result;
    }

    return this.makeResult(rule, code, currentPrice, false, {
      cooldownActive: false,
      reason: `not triggered: ${rule.operator}`,
    });
  }

  private checkCondition(
    rule: PriceRuleInternal,
    currentPrice: number,
    prevPrice: number | undefined
  ): boolean {
    switch (rule.operator) {
      case 'above':
        if (rule.threshold === undefined) return false;
        return currentPrice > rule.threshold;

      case 'below':
        if (rule.threshold === undefined) return false;
        return currentPrice < rule.threshold;

      case 'crosses_above':
        if (rule.threshold === undefined || prevPrice === undefined) return false;
        return prevPrice <= rule.threshold && currentPrice > rule.threshold;

      case 'crosses_below':
        if (rule.threshold === undefined || prevPrice === undefined) return false;
        return prevPrice >= rule.threshold && currentPrice < rule.threshold;

      case 'breakout':
        if (!rule.range) return false;
        return currentPrice < rule.range[0] || currentPrice > rule.range[1];

      default:
        return false;
    }
  }

  private makeResult(
    rule: PriceRuleInternal,
    code: string,
    currentPrice: number,
    triggered: boolean,
    extra: Partial<PriceTriggerResult>
  ): PriceTriggerResult {
    return {
      ruleId: rule.id,
      code,
      operator: rule.operator,
      currentPrice,
      threshold: rule.threshold,
      range: rule.range,
      triggered,
      cooldownActive: extra.cooldownActive ?? false,
      reason: extra.reason,
      priceAtTrigger: extra.priceAtTrigger,
      triggeredAt: extra.triggeredAt,
    };
  }

  // ── History ──────────────────────────────────────────

  /**
   * 获取触发历史
   */
  getHistory(filter?: { ruleId?: string; code?: string }): PriceTriggerResult[] {
    let results = this.triggerHistory;
    if (filter?.ruleId) {
      results = results.filter((r) => r.ruleId === filter.ruleId);
    }
    if (filter?.code) {
      results = results.filter((r) => r.code === filter.code);
    }
    return results;
  }

  /**
   * 获取某标的上一次记录的价格（用于外部调试）
   */
  getLastPrice(code: string): number | undefined {
    return this.lastPriceMap.get(code);
  }

  /**
   * 获取规则详情
   */
  getRule(ruleId: string): PriceRule | undefined {
    const r = this.rules.get(ruleId);
    if (!r) return undefined;
    return {
      id: r.id,
      code: r.code,
      operator: r.operator,
      threshold: r.threshold,
      range: r.range,
      cooldownMs: r.cooldownMs,
      maxTriggersPerDay: r.maxTriggersPerDay,
      enabled: r.enabled,
      description: r.description,
    };
  }

  /**
   * 启用/禁用规则
   */
  setEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /**
   * 获取规则总数
   */
  get ruleCount(): number {
    return this.rules.size;
  }
}
