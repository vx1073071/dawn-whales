/**
 * R282 autoclaw#1: 因子闹钟→推送IPC桥接 (FactorAlarmPushBridge) v1.0
 *
 * QUANT MOO — Factor Alarm Clock → Push Notification Bridge.
 *
 * Problem: Factor alerts exist in engine (factor-alert-service, factor-crowding-alert)
 * but users aren't notified in real-time. Users want to set "alarm clocks" on their
 * watched factors and get desktop notifications when conditions trigger.
 *
 * Flow:
 *   User sets alarm (factorId + condition + threshold)
 *   → Alarm engine polls factor data
 *   → Condition triggers → FactorAlarmPushBridge
 *   → PushIpcBridge → Desktop notification
 *
 * Features:
 *   1. User alarm CRUD (create / edit / snooze / delete / list)
 *   2. 5 alarm condition types: IC drop, IC threshold, crowding, decay, signal change
 *   3. Alarm evaluation engine (poll factor state → check conditions → fire)
 *   4. Push dispatch via push-ipc-bridge (reuses existing PushCategory.FACTOR_SIGNAL)
 *   5. Snooze & cooldown management
 *   6. Alarm history & analytics
 *   7. Integration with factor-subscription-push-bridge (coexists, don't duplicate pushes)
 *
 * Upstream: factor-alert-service.ts, factor-crowding-alert.ts, factor-decay-monitor.ts
 * Downstream: push-ipc-bridge.ts, factor-subscription-push-bridge.ts
 */

import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type AlarmConditionType =
  | 'ic_drop'        // IC drops below threshold
  | 'ic_absolute'    // |IC| crosses threshold
  | 'crowding'       // Crowding level reaches threshold
  | 'decay_warning'  // Factor alpha decay rate exceeds threshold
  | 'signal_change'  // Factor signal direction flips

export type AlarmSeverity = 'info' | 'warning' | 'critical';

export type AlarmStatus = 'active' | 'snoozed' | 'triggered' | 'disabled' | 'expired';

export interface FactorAlarm {
  alarmId: string;
  userId: string;
  factorId: string;
  factorName: string;
  factorNameCn: string;
  /** Human-readable alarm name */
  label: string;
  conditionType: AlarmConditionType;
  condition: AlarmCondition;
  severity: AlarmSeverity;
  status: AlarmStatus;
  /** Push channels to use when triggered */
  pushChannels: Array<'system' | 'toast' | 'tray'>;
  /** Cooldown between repeated triggers (ms) */
  cooldownMs: number;
  /** Snooze duration (ms), 0 = no snooze */
  snoozeMs: number;
  snoozedUntil: number | null;
  /** Max trigger count, -1 = unlimited */
  maxTriggers: number;
  triggerCount: number;
  lastTriggeredAt: number;
  createdAt: number;
  updatedAt: number;
  /** Alarm notes / user comments */
  notes?: string;
}

export interface AlarmCondition {
  // For ic_drop: IC dropped by this % vs historical avg
  dropPercent?: number;
  // For ic_absolute: |IC| below this value triggers
  icThreshold?: number;
  // For crowding: crowding level at or above this triggers
  crowdingLevel?: 'NORMAL' | 'WATCHING' | 'CROWDED';
  // For decay_warning: decay rate above this triggers
  decayRateThreshold?: number;
  // For signal_change: direction change triggers
  signalDirection?: 'long_to_short' | 'short_to_long' | 'neutral_to_active' | 'any';
  /** Custom comparison operator for numeric conditions */
  operator?: 'gt' | 'lt' | 'gte' | 'lte';
}

export interface AlarmTriggerEvent {
  eventId: string;
  alarmId: string;
  userId: string;
  factorId: string;
  factorName: string;
  conditionType: AlarmConditionType;
  severity: AlarmSeverity;
  title: string;
  body: string;
  /** Current factor state at trigger time */
  snapshot: AlarmFactorSnapshot;
  triggeredAt: number;
  /** Whether this was pushed via IPC */
  pushDispatched: boolean;
  pushChannels: string[];
  pushResults?: Array<{ channel: string; success: boolean; error?: string }>;
}

export interface AlarmFactorSnapshot {
  factorId: string;
  currentIC: number;
  historicalAvgIC: number;
  decayRate: number;
  crowdingLevel: string;
  lastSignalDirection: string;
  timestamp: number;
}

export interface AlarmStats {
  totalAlarms: number;
  activeAlarms: number;
  triggeredToday: number;
  snoozedAlarms: number;
  byConditionType: Record<string, number>;
  bySeverity: Record<string, number>;
  recentTriggers: AlarmTriggerEvent[];
}

// ═══════════════════════════════════════════════════════════════════
// ALARM CLOCK ENGINE
// ═══════════════════════════════════════════════════════════════════

class FactorAlarmClockEngine {
  private alarms: FactorAlarm[] = [];
  private triggerHistory: AlarmTriggerEvent[] = [];
  private pushDispatchFn: ((payload: {
    title: string;
    body: string;
    priority: 'high' | 'normal' | 'low';
    category: string;
    data: Record<string, unknown>;
  }) => Array<{ channel: string; success: boolean }>) | null = null;

  // ── Alarm CRUD ─────────────────────────────────────────────────

  createAlarm(params: {
    userId: string;
    factorId: string;
    factorName: string;
    factorNameCn?: string;
    label: string;
    conditionType: AlarmConditionType;
    condition: AlarmCondition;
    severity?: AlarmSeverity;
    pushChannels?: Array<'system' | 'toast' | 'tray'>;
    cooldownMs?: number;
    maxTriggers?: number;
    notes?: string;
  }): FactorAlarm {
    const now = Date.now();
    const alarm: FactorAlarm = {
      alarmId: `alarm_${createHash('md5').update(`${params.userId}_${params.factorId}_${params.conditionType}_${now}`).digest('hex').slice(0, 12)}`,
      userId: params.userId,
      factorId: params.factorId,
      factorName: params.factorName,
      factorNameCn: params.factorNameCn || params.factorName,
      label: params.label,
      conditionType: params.conditionType,
      condition: params.condition,
      severity: params.severity || 'warning',
      status: 'active',
      pushChannels: params.pushChannels || ['system', 'toast'],
      cooldownMs: params.cooldownMs || 300_000, // 5 min default
      snoozeMs: 0,
      snoozedUntil: null,
      maxTriggers: params.maxTriggers || -1,
      triggerCount: 0,
      lastTriggeredAt: 0,
      createdAt: now,
      updatedAt: now,
      notes: params.notes,
    };
    this.alarms.push(alarm);
    return alarm;
  }

  getAlarm(alarmId: string): FactorAlarm | null {
    return this.alarms.find(a => a.alarmId === alarmId) || null;
  }

  listAlarms(userId?: string, factorId?: string): FactorAlarm[] {
    let result = [...this.alarms];
    if (userId) result = result.filter(a => a.userId === userId);
    if (factorId) result = result.filter(a => a.factorId === factorId);
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  updateAlarm(alarmId: string, patch: Partial<Pick<FactorAlarm, 'label' | 'condition' | 'severity' | 'pushChannels' | 'cooldownMs' | 'maxTriggers' | 'notes' | 'status'>>): FactorAlarm | null {
    const alarm = this.alarms.find(a => a.alarmId === alarmId);
    if (!alarm) return null;
    Object.assign(alarm, patch, { updatedAt: Date.now() });
    return alarm;
  }

  deleteAlarm(alarmId: string): boolean {
    const idx = this.alarms.findIndex(a => a.alarmId === alarmId);
    if (idx === -1) return false;
    this.alarms.splice(idx, 1);
    return true;
  }

  snoozeAlarm(alarmId: string, durationMs: number): FactorAlarm | null {
    const alarm = this.alarms.find(a => a.alarmId === alarmId);
    if (!alarm) return null;
    alarm.status = 'snoozed';
    alarm.snoozeMs = durationMs;
    alarm.snoozedUntil = Date.now() + durationMs;
    alarm.updatedAt = Date.now();
    return alarm;
  }

  unsnoozeAlarm(alarmId: string): FactorAlarm | null {
    const alarm = this.alarms.find(a => a.alarmId === alarmId);
    if (!alarm) return null;
    alarm.status = 'active';
    alarm.snoozedUntil = null;
    alarm.snoozeMs = 0;
    alarm.updatedAt = Date.now();
    return alarm;
  }

  // ── Condition Evaluation ────────────────────────────────────────

  /**
   * Evaluate all active alarms against current factor snapshots.
   * Returns triggered events. Call this periodically (e.g., every 60s).
   */
  evaluateAlarms(snapshots: AlarmFactorSnapshot[]): AlarmTriggerEvent[] {
    const now = Date.now();
    const triggered: AlarmTriggerEvent[] = [];

    // Auto-unsnooze expired snoozes
    this.alarms.forEach(a => {
      if (a.status === 'snoozed' && a.snoozedUntil && now >= a.snoozedUntil) {
        a.status = 'active';
        a.snoozedUntil = null;
      }
    });

    // Filter to active only
    const active = this.alarms.filter(a => a.status === 'active');

    for (const alarm of active) {
      // Check max triggers
      if (alarm.maxTriggers > 0 && alarm.triggerCount >= alarm.maxTriggers) {
        alarm.status = 'expired';
        continue;
      }

      // Check cooldown
      if (alarm.lastTriggeredAt > 0 && (now - alarm.lastTriggeredAt) < alarm.cooldownMs) {
        continue;
      }

      // Find matching snapshot
      const snapshot = snapshots.find(s => s.factorId === alarm.factorId);
      if (!snapshot) continue;

      // Evaluate condition
      if (this._evaluateCondition(alarm.conditionType, alarm.condition, snapshot)) {
        const event = this._createTriggerEvent(alarm, snapshot, now);
        triggered.push(event);
        alarm.triggerCount++;
        alarm.lastTriggeredAt = now;
        alarm.status = 'triggered';
        
        // Auto-advance status: active if unlimited or not yet maxed, expired if done
        if (alarm.maxTriggers <= 0) {
          alarm.status = 'active';  // unlimited alarms stay active
        } else if (alarm.triggerCount >= alarm.maxTriggers) {
          alarm.status = 'expired'; // hit max, stop watching
        } else {
          alarm.status = 'active';  // still have triggers left
        }
        
        this.triggerHistory.push(event);
      }
    }

    // Dispatch pushes for triggered events
    triggered.forEach(event => {
      if (this.pushDispatchFn) {
        event.pushResults = this.pushDispatchFn({
          title: event.title,
          body: event.body,
          priority: event.severity === 'critical' ? 'high' : event.severity === 'warning' ? 'normal' : 'low',
          category: 'factor_signal',
          data: {
            alarmId: event.alarmId,
            factorId: event.factorId,
            eventId: event.eventId,
            snapshot: event.snapshot,
          },
        });
        event.pushDispatched = event.pushResults?.some(r => r.success) || false;
      }
    });

    return triggered;
  }

  private _evaluateCondition(type: AlarmConditionType, condition: AlarmCondition, snap: AlarmFactorSnapshot): boolean {
    const op = condition.operator || 'lt';

    switch (type) {
      case 'ic_drop': {
        if (!condition.dropPercent || !snap.historicalAvgIC || snap.historicalAvgIC === 0) return false;
        const dropPct = ((snap.historicalAvgIC - snap.currentIC) / snap.historicalAvgIC) * 100;
        return op === 'gte' ? dropPct >= condition.dropPercent : dropPct > condition.dropPercent;
      }

      case 'ic_absolute': {
        if (condition.icThreshold === undefined) return false;
        const absIC = Math.abs(snap.currentIC);
        if (op === 'lt' || op === 'lte') return op === 'lte' ? absIC <= condition.icThreshold : absIC < condition.icThreshold;
        return op === 'gte' ? absIC >= condition.icThreshold : absIC > condition.icThreshold;
      }

      case 'crowding': {
        if (!condition.crowdingLevel) return false;
        const levels = { NORMAL: 0, WATCHING: 1, CROWDED: 2 };
        const current = levels[snap.crowdingLevel as keyof typeof levels] || 0;
        const threshold = levels[condition.crowdingLevel];
        return current >= threshold;
      }

      case 'decay_warning': {
        if (condition.decayRateThreshold === undefined) return false;
        return op === 'gte' ? snap.decayRate >= condition.decayRateThreshold : snap.decayRate > condition.decayRateThreshold;
      }

      case 'signal_change': {
        if (!condition.signalDirection) return false;
        const dir = snap.lastSignalDirection;
        switch (condition.signalDirection) {
          case 'any': return true;
          case 'long_to_short': return dir === 'short';
          case 'short_to_long': return dir === 'long';
          case 'neutral_to_active': return dir === 'long' || dir === 'short';
          default: return false;
        }
      }

      default:
        return false;
    }
  }

  private _createTriggerEvent(alarm: FactorAlarm, snap: AlarmFactorSnapshot, now: number): AlarmTriggerEvent {
    const { title, body } = this._formatMessage(alarm, snap);

    return {
      eventId: `alarm_evt_${createHash('md5').update(`${alarm.alarmId}_${now}`).digest('hex').slice(0, 10)}`,
      alarmId: alarm.alarmId,
      userId: alarm.userId,
      factorId: alarm.factorId,
      factorName: alarm.factorName,
      conditionType: alarm.conditionType,
      severity: alarm.severity,
      title,
      body,
      snapshot: { ...snap },
      triggeredAt: now,
      pushDispatched: false,
      pushChannels: [...alarm.pushChannels],
    };
  }

  private _formatMessage(alarm: FactorAlarm, snap: AlarmFactorSnapshot): { title: string; body: string } {
    const prefix = alarm.severity === 'critical' ? '🔴' : alarm.severity === 'warning' ? '🟡' : '🔵';

    switch (alarm.conditionType) {
      case 'ic_drop':
        return {
          title: `${prefix} 因子IC下降: ${alarm.factorNameCn || alarm.factorName}`,
          body: `${alarm.factorName} IC从${snap.historicalAvgIC.toFixed(3)}降至${snap.currentIC.toFixed(3)}，下降${(((snap.historicalAvgIC - snap.currentIC) / snap.historicalAvgIC) * 100).toFixed(0)}%。闹钟: "${alarm.label}"`,
        };
      case 'ic_absolute':
        return {
          title: `${prefix} 因子IC阈值: ${alarm.factorNameCn || alarm.factorName}`,
          body: `${alarm.factorName} |IC|=|${snap.currentIC.toFixed(3)}| ${alarm.condition.operator === 'lt' ? '低于' : '超过'}阈值${alarm.condition.icThreshold}。闹钟: "${alarm.label}"`,
        };
      case 'crowding':
        return {
          title: `${prefix} 因子拥挤: ${alarm.factorNameCn || alarm.factorName}`,
          body: `${alarm.factorName} 拥挤度达到 ${snap.crowdingLevel}。闹钟: "${alarm.label}"`,
        };
      case 'decay_warning':
        return {
          title: `${prefix} 因子衰减: ${alarm.factorNameCn || alarm.factorName}`,
          body: `${alarm.factorName} 衰减速率 ${snap.decayRate.toFixed(3)} 超过阈值。闹钟: "${alarm.label}"`,
        };
      case 'signal_change':
        return {
          title: `${prefix} 因子信号翻转: ${alarm.factorNameCn || alarm.factorName}`,
          body: `${alarm.factorName} 信号方向变为 ${snap.lastSignalDirection}。闹钟: "${alarm.label}"`,
        };
      default:
        return {
          title: `${prefix} 因子闹钟: ${alarm.factorNameCn || alarm.factorName}`,
          body: `闹钟 "${alarm.label}" 已触发`,
        };
    }
  }

  // ── Push Integration ────────────────────────────────────────────

  /** Register the push dispatch function (connect to PushIpcBridge) */
  registerPushDispatcher(
    fn: (payload: {
      title: string;
      body: string;
      priority: 'high' | 'normal' | 'low';
      category: string;
      data: Record<string, unknown>;
    }) => Array<{ channel: string; success: boolean }>,
  ): void {
    this.pushDispatchFn = fn;
  }

  // ── History & Stats ─────────────────────────────────────────────

  getTriggerHistory(alarmId?: string, limit = 50): AlarmTriggerEvent[] {
    let history = [...this.triggerHistory];
    if (alarmId) history = history.filter(e => e.alarmId === alarmId);
    return history.slice(-limit).reverse();
  }

  getStats(userId?: string): AlarmStats {
    const userAlarms = userId ? this.alarms.filter(a => a.userId === userId) : this.alarms;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const byConditionType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    userAlarms.forEach(a => {
      byConditionType[a.conditionType] = (byConditionType[a.conditionType] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    });

    return {
      totalAlarms: userAlarms.length,
      activeAlarms: userAlarms.filter(a => a.status === 'active').length,
      triggeredToday: this.triggerHistory.filter(e => e.triggeredAt >= todayStart && (!userId || e.userId === userId)).length,
      snoozedAlarms: userAlarms.filter(a => a.status === 'snoozed').length,
      byConditionType,
      bySeverity,
      recentTriggers: this.triggerHistory.filter(e => !userId || e.userId === userId).slice(-10).reverse(),
    };
  }

  // ── Bulk Operations ─────────────────────────────────────────────

  /** Create alarm clock presets for common use cases */
  createPresetAlarms(userId: string, factorId: string, factorName: string, factorNameCn?: string): FactorAlarm[] {
    return [
      this.createAlarm({
        userId, factorId, factorName, factorNameCn,
        label: 'IC大幅下降',
        conditionType: 'ic_drop',
        condition: { dropPercent: 40, operator: 'gte' },
        severity: 'warning',
      }),
      this.createAlarm({
        userId, factorId, factorName, factorNameCn,
        label: '因子失效',
        conditionType: 'ic_absolute',
        condition: { icThreshold: 0.01, operator: 'lt' },
        severity: 'critical',
      }),
      this.createAlarm({
        userId, factorId, factorName, factorNameCn,
        label: '因子拥挤',
        conditionType: 'crowding',
        condition: { crowdingLevel: 'CROWDED' },
        severity: 'warning',
      }),
      this.createAlarm({
        userId, factorId, factorName, factorNameCn,
        label: '快速衰减',
        conditionType: 'decay_warning',
        condition: { decayRateThreshold: 0.5, operator: 'gte' },
        severity: 'info',
      }),
    ];
  }

  // ── Reset ───────────────────────────────────────────────────────

  reset(): void {
    this.alarms = [];
    this.triggerHistory = [];
    this.pushDispatchFn = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// BRIDGE CLASS — connects FactorAlarmClock → PushIPC
// ═══════════════════════════════════════════════════════════════════

class FactorAlarmPushBridge {
  private _initialized = false;

  /** Underlying alarm clock engine */
  readonly engine = new FactorAlarmClockEngine();

  // ── Public API ──────────────────────────────────────────────────

  /** Initialize bridge with push dispatch capability */
  initialize(pushDispatch: (payload: {
    title: string;
    body: string;
    priority: 'high' | 'normal' | 'low';
    category: string;
    data: Record<string, unknown>;
  }) => Array<{ channel: string; success: boolean }>): void {
    if (this._initialized) return;
    this.engine.registerPushDispatcher(pushDispatch);
    this._initialized = true;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  // ── Delegation to engine ────────────────────────────────────────

  /** Create a factor alarm clock */
  createAlarm(params: Parameters<FactorAlarmClockEngine['createAlarm']>[0]): FactorAlarm {
    return this.engine.createAlarm(params);
  }

  /** Get single alarm by ID */
  getAlarm(alarmId: string): FactorAlarm | null {
    return this.engine.getAlarm(alarmId);
  }

  /** List alarms, optionally filtered */
  listAlarms(userId?: string, factorId?: string): FactorAlarm[] {
    return this.engine.listAlarms(userId, factorId);
  }

  /** Update alarm configuration */
  updateAlarm(alarmId: string, patch: Parameters<FactorAlarmClockEngine['updateAlarm']>[1]): FactorAlarm | null {
    return this.engine.updateAlarm(alarmId, patch);
  }

  /** Delete an alarm */
  deleteAlarm(alarmId: string): boolean {
    return this.engine.deleteAlarm(alarmId);
  }

  /** Snooze an alarm for a duration */
  snoozeAlarm(alarmId: string, durationMs: number): FactorAlarm | null {
    return this.engine.snoozeAlarm(alarmId, durationMs);
  }

  /** Unsnooze an alarm */
  unsnoozeAlarm(alarmId: string): FactorAlarm | null {
    return this.engine.unsnoozeAlarm(alarmId);
  }

  /** Evaluate all active alarms against current factor state */
  evaluateAlarms(snapshots: AlarmFactorSnapshot[]): AlarmTriggerEvent[] {
    return this.engine.evaluateAlarms(snapshots);
  }

  /** Get trigger history */
  getTriggerHistory(alarmId?: string, limit?: number): AlarmTriggerEvent[] {
    return this.engine.getTriggerHistory(alarmId, limit);
  }

  /** Get alarm statistics */
  getStats(userId?: string): AlarmStats {
    return this.engine.getStats(userId);
  }

  /** Create preset alarms for a factor */
  createPresetAlarms(userId: string, factorId: string, factorName: string, factorNameCn?: string): FactorAlarm[] {
    return this.engine.createPresetAlarms(userId, factorId, factorName, factorNameCn);
  }

  /** Reset everything (for testing) */
  reset(): void {
    this._initialized = false;
    this.engine.reset();
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

const _instance = new FactorAlarmPushBridge();

export function getAlarmPushBridge(): FactorAlarmPushBridge {
  return _instance;
}

export function resetAlarmPushBridge(): void {
  _instance.reset();
}

export { FactorAlarmPushBridge, FactorAlarmClockEngine };

export default _instance;
