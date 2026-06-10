// electron/engine/volume-trigger.ts
// VolumeTriggerEngine — 成交量触发模块
// J-30-01 ConditionEngine 子模块
// 负责：volume_spike / volume_anomaly / volume_trend 三种成交量触发逻辑

import log from 'electron-log';
import type { TriggerResult } from '../../types/condition.js';

// ── Interfaces ────────────────────────────────────────────────────────────

export type VolumeOperator = 'volume_spike' | 'volume_anomaly' | 'volume_trend';
export type VolumeTrendDirection = 'increasing' | 'decreasing';

export interface VolumeRule {
  id?: string;
  code: string;
  operator: VolumeOperator;

  /** volume_spike: 当前成交量 > multiplier * 平均成交量 */
  multiplier?: number;        // 默认 2.0
  /** volume_spike: 计算平均成交量的周期 */
  avgPeriod?: number;         // 默认 20

  /** volume_anomaly: 成交量变化率阈值 (如 3.0 = 300%) */
  anomalyThreshold?: number;  // 默认 3.0

  /** volume_trend: 趋势方向 */
  trendDirection?: VolumeTrendDirection;
  /** volume_trend: 连续观察期数 */
  trendPeriods?: number;      // 默认 5

  cooldownMs?: number;
  maxTriggersPerDay?: number;
  enabled?: boolean;
  description?: string;
}

export interface VolumeTriggerResult extends TriggerResult {
  code: string;
  operator: VolumeOperator;
  currentVolume: number;
  /** 参考值（如平均成交量） */
  referenceVolume?: number;
  /** 比率（current / reference） */
  ratio?: number;
  /** trend 方向（仅 volume_trend） */
  trendDirection?: VolumeTrendDirection;
}

interface VolumeRuleInternal {
  id: string;
  code: string;
  operator: VolumeOperator;
  multiplier: number;
  avgPeriod: number;
  anomalyThreshold: number;
  trendDirection: VolumeTrendDirection;
  trendPeriods: number;
  cooldownMs: number;
  maxTriggersPerDay: number;
  enabled: boolean;
  description: string;
  lastTriggeredAt: number | undefined;
  triggerCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function generateVolumeRuleId(): string {
  return `vtr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

/**
 * 计算数组的平均值
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * 计算标准差
 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = average(arr);
  const squaredDiffs = arr.map((v) => (v - avg) ** 2);
  return Math.sqrt(average(squaredDiffs));
}

/**
 * 判断成交量是否呈单调递增趋势
 */
function isIncreasing(volumes: number[]): boolean {
  for (let i = 1; i < volumes.length; i++) {
    if (volumes[i] <= volumes[i - 1]) return false;
  }
  return true;
}

/**
 * 判断成交量是否呈单调递减趋势
 */
function isDecreasing(volumes: number[]): boolean {
  for (let i = 1; i < volumes.length; i++) {
    if (volumes[i] >= volumes[i - 1]) return false;
  }
  return true;
}

/**
 * 检测成交量异常：当前成交量偏离历史均值超过 N 倍标准差
 */
function isAnomaly(
  currentVolume: number,
  historicalVolumes: number[],
  threshold: number
): { anomaly: boolean; zScore: number } {
  if (historicalVolumes.length < 2) {
    return { anomaly: false, zScore: 0 };
  }
  const avg = average(historicalVolumes);
  const sd = stdDev(historicalVolumes);
  if (sd === 0) return { anomaly: false, zScore: 0 };
  const zScore = Math.abs(currentVolume - avg) / sd;
  return { anomaly: zScore >= threshold, zScore };
}

// ── VolumeTriggerEngine ───────────────────────────────────────────────────

export class VolumeTriggerEngine {
  private rules: Map<string, VolumeRuleInternal> = new Map();
  private triggerHistory: VolumeTriggerResult[] = [];

  constructor() {
    log.info('[VolumeTriggerEngine] initialized');
  }

  // ── CRUD ─────────────────────────────────────────────

  /**
   * 添加成交量触发规则，返回规则 ID
   */
  addRule(rule: VolumeRule): string {
    const id = rule.id ?? generateVolumeRuleId();
    const internal: VolumeRuleInternal = {
      id,
      code: rule.code,
      operator: rule.operator,
      multiplier: rule.multiplier ?? 2.0,
      avgPeriod: rule.avgPeriod ?? 20,
      anomalyThreshold: rule.anomalyThreshold ?? 3.0,
      trendDirection: rule.trendDirection ?? 'increasing',
      trendPeriods: rule.trendPeriods ?? 5,
      cooldownMs: rule.cooldownMs ?? 0,
      maxTriggersPerDay: rule.maxTriggersPerDay ?? Infinity,
      enabled: rule.enabled ?? true,
      description: rule.description ?? '',
      lastTriggeredAt: undefined,
      triggerCount: 0,
    };
    this.rules.set(id, internal);
    log.info(
      `[VolumeTriggerEngine] rule added: ${id} — ${rule.operator} on ${rule.code}`
    );
    return id;
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      log.info(`[VolumeTriggerEngine] rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * 获取所有规则
   */
  getRules(): VolumeRule[] {
    return Array.from(this.rules.values()).map((r) => ({
      id: r.id,
      code: r.code,
      operator: r.operator,
      multiplier: r.multiplier,
      avgPeriod: r.avgPeriod,
      anomalyThreshold: r.anomalyThreshold,
      trendDirection: r.trendDirection,
      trendPeriods: r.trendPeriods,
      cooldownMs: r.cooldownMs,
      maxTriggersPerDay: r.maxTriggersPerDay,
      enabled: r.enabled,
      description: r.description,
    }));
  }

  /**
   * 清空所有规则和历史
   */
  clearAll(): void {
    this.rules.clear();
    this.triggerHistory = [];
    log.info('[VolumeTriggerEngine] all rules and history cleared');
  }

  // ── Evaluate ─────────────────────────────────────────

  /**
   * 评估指定标的所有成交量规则
   * @param code 标的代码
   * @param currentVolume 当前成交量
   * @param historicalVolumes 历史成交量数组（从旧到新排列）
   */
  evaluate(
    code: string,
    currentVolume: number,
    historicalVolumes: number[]
  ): VolumeTriggerResult[] {
    const matchingRules = Array.from(this.rules.values()).filter(
      (r) => r.code === code && r.enabled
    );

    const results: VolumeTriggerResult[] = [];

    for (const rule of matchingRules) {
      const result = this.evaluateRule(rule, code, currentVolume, historicalVolumes);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // ── Private evaluation ───────────────────────────────

  private evaluateRule(
    rule: VolumeRuleInternal,
    code: string,
    currentVolume: number,
    historicalVolumes: number[]
  ): VolumeTriggerResult | null {
    const now = Date.now();

    // 冷却检查
    if (rule.lastTriggeredAt !== undefined && rule.cooldownMs > 0) {
      const elapsed = now - rule.lastTriggeredAt;
      if (elapsed < rule.cooldownMs) {
        return this.makeResult(rule, code, currentVolume, false, {
          cooldownActive: true,
          reason: `cooldown: ${Math.round(rule.cooldownMs - elapsed)}ms remaining`,
        });
      }
    }

    // 每日最大触发检查
    if (rule.maxTriggersPerDay < Infinity) {
      const todayCount = this.triggerHistory.filter(
        (e) => e.ruleId === rule.id && isSameDay(e.triggeredAt ?? 0)
      ).length;
      if (todayCount >= rule.maxTriggersPerDay) {
        return this.makeResult(rule, code, currentVolume, false, {
          cooldownActive: false,
          reason: `maxTriggersPerDay(${rule.maxTriggersPerDay}) reached`,
        });
      }
    }

    // 按 operator 类型评估
    let triggered = false;
    let referenceVolume: number | undefined;
    let ratio: number | undefined;
    let trendDirection: VolumeTrendDirection | undefined;

    switch (rule.operator) {
      case 'volume_spike': {
        // 取最近 avgPeriod 条历史成交量计算均值
        const period = Math.min(rule.avgPeriod, historicalVolumes.length);
        const recentVolumes = historicalVolumes.slice(-period);
        const avgVol = average(recentVolumes);
        referenceVolume = avgVol;
        ratio = avgVol > 0 ? currentVolume / avgVol : 0;
        triggered = currentVolume > rule.multiplier * avgVol;
        break;
      }

      case 'volume_anomaly': {
        const { anomaly, zScore } = isAnomaly(
          currentVolume,
          historicalVolumes,
          rule.anomalyThreshold
        );
        const avgVol = average(historicalVolumes);
        referenceVolume = avgVol;
        ratio = avgVol > 0 ? currentVolume / avgVol : 0;
        triggered = anomaly;
        // 将 zScore 放入 ratio 作为额外信息
        if (anomaly) {
          ratio = zScore;
        }
        break;
      }

      case 'volume_trend': {
        const periods = Math.min(rule.trendPeriods, historicalVolumes.length);
        if (periods < 2) return null;
        const recentVolumes = historicalVolumes.slice(-periods);
        trendDirection = rule.trendDirection;

        if (rule.trendDirection === 'increasing') {
          // 检查 recentVolumes + currentVolume 是否递增
          const sequence = [...recentVolumes, currentVolume];
          triggered = isIncreasing(sequence);
        } else {
          const sequence = [...recentVolumes, currentVolume];
          triggered = isDecreasing(sequence);
        }

        referenceVolume = average(recentVolumes);
        ratio = referenceVolume > 0 ? currentVolume / referenceVolume : 0;
        break;
      }

      default:
        return null;
    }

    if (triggered) {
      rule.lastTriggeredAt = now;
      rule.triggerCount += 1;

      const result = this.makeResult(rule, code, currentVolume, true, {
        cooldownActive: false,
        reason: `triggered: ${rule.operator}`,
        triggeredAt: now,
        referenceVolume,
        ratio,
        trendDirection,
      });
      this.triggerHistory.push(result);
      log.info(
        `[VolumeTriggerEngine] TRIGGERED — ${rule.id} | ${code} ${rule.operator} vol=${currentVolume}`
      );
      return result;
    }

    return this.makeResult(rule, code, currentVolume, false, {
      cooldownActive: false,
      reason: `not triggered: ${rule.operator}`,
      referenceVolume,
      ratio,
      trendDirection,
    });
  }

  private makeResult(
    rule: VolumeRuleInternal,
    code: string,
    currentVolume: number,
    triggered: boolean,
    extra: Partial<VolumeTriggerResult>
  ): VolumeTriggerResult {
    return {
      ruleId: rule.id,
      code,
      operator: rule.operator,
      currentVolume,
      triggered,
      cooldownActive: extra.cooldownActive ?? false,
      reason: extra.reason,
      triggeredAt: extra.triggeredAt,
      referenceVolume: extra.referenceVolume,
      ratio: extra.ratio,
      trendDirection: extra.trendDirection,
    };
  }

  // ── History / Accessors ──────────────────────────────

  getHistory(filter?: { ruleId?: string; code?: string }): VolumeTriggerResult[] {
    let results = this.triggerHistory;
    if (filter?.ruleId) results = results.filter((r) => r.ruleId === filter.ruleId);
    if (filter?.code) results = results.filter((r) => r.code === filter.code);
    return results;
  }

  getRule(ruleId: string): VolumeRule | undefined {
    const r = this.rules.get(ruleId);
    if (!r) return undefined;
    return {
      id: r.id,
      code: r.code,
      operator: r.operator,
      multiplier: r.multiplier,
      avgPeriod: r.avgPeriod,
      anomalyThreshold: r.anomalyThreshold,
      trendDirection: r.trendDirection,
      trendPeriods: r.trendPeriods,
      cooldownMs: r.cooldownMs,
      maxTriggersPerDay: r.maxTriggersPerDay,
      enabled: r.enabled,
      description: r.description,
    };
  }

  setEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  get ruleCount(): number {
    return this.rules.size;
  }
}
