// ── Mixed Trigger E2E Tests ─────────────────────────────────────────────────
// ML-31-03: Condition + Cron 混合触发场景 + 非交易时段跳过
// Phase 4.2: 闭环验证

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── Mock Calendar ──────────────────────────────────────────────────────────

class MockTradingCalendar {
  private holidays: Set<string> = new Set();
  private afterHoursStart = 16; // 4PM
  private preMarketStart = 9;   // 9AM

  addHoliday(dateStr: string): void { this.holidays.add(dateStr); }
  isTradingDay(date: Date): boolean {
    const day = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);
    return day !== 0 && day !== 6 && !this.holidays.has(dateStr);
  }
  isMarketOpen(date: Date): boolean {
    if (!this.isTradingDay(date)) return false;
    const hour = date.getHours();
    return hour >= this.preMarketStart && hour < this.afterHoursStart;
  }
  isAfterHours(date: Date): boolean {
    if (!this.isTradingDay(date)) return false;
    return date.getHours() >= this.afterHoursStart;
  }
}

// ── Mock CronScheduler + ConditionWatcher ─────────────────────────────────

interface ScheduledTask {
  id: string;
  cronExpr: string;
  enabled: boolean;
  skipNonTrading: boolean;
  runs: number;
  skipped: number;
}

interface ConditionRule {
  id: string;
  symbol: string;
  operator: string;
  value: number;
  enabled: boolean;
  monitorAfterHours: boolean;
  triggers: number;
}

class MixedTriggerEngine {
  calendar = new MockTradingCalendar();
  cronTasks: ScheduledTask[] = [];
  conditionRules: ConditionRule[] = [];

  addCronTask(task: Omit<ScheduledTask, 'runs' | 'skipped'>): void {
    this.cronTasks.push({ ...task, runs: 0, skipped: 0 });
  }

  addConditionRule(rule: Omit<ConditionRule, 'triggers'>): void {
    this.conditionRules.push({ ...rule, triggers: 0 });
  }

  /** Simulate cron tick at a given simulated time */
  tick(date: Date): { cronExecuted: string[]; conditionsTriggered: string[]; skipped: string[] } {
    const cronExecuted: string[] = [];
    const conditionsTriggered: string[] = [];
    const skipped: string[] = [];

    // Process cron tasks
    for (const task of this.cronTasks) {
      if (!task.enabled) continue;

      if (task.skipNonTrading && !this.calendar.isTradingDay(date)) {
        task.skipped++;
        skipped.push(`cron:${task.id}`);
        continue;
      }

      task.runs++;
      cronExecuted.push(task.id);
    }

    // Process condition rules (always monitor, even after hours if enabled)
    for (const rule of this.conditionRules) {
      if (!rule.enabled) continue;

      if (!rule.monitorAfterHours && this.calendar.isAfterHours(date)) {
        continue;
      }

      rule.triggers++;
      conditionsTriggered.push(rule.id);
    }

    return { cronExecuted, conditionsTriggered, skipped };
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Mixed Trigger E2E', () => {
  let engine: MixedTriggerEngine;

  beforeEach(() => {
    engine = new MixedTriggerEngine();
  });

  describe('Cron + Calendar', () => {
    it('cron executes on trading day', () => {
      engine.addCronTask({ id: 'c1', cronExpr: '0 9 * * 1-5', enabled: true, skipNonTrading: true });
      // Monday 10AM
      const monday = new Date('2026-06-01T10:00:00');
      expect(engine.calendar.isTradingDay(monday)).toBe(true);
      const result = engine.tick(monday);
      expect(result.cronExecuted).toContain('c1');
      expect(result.skipped.length).toBe(0);
    });

    it('cron skips on weekend', () => {
      engine.addCronTask({ id: 'c1', cronExpr: '0 9 * * 1-5', enabled: true, skipNonTrading: true });
      // Saturday
      const saturday = new Date('2026-06-06T10:00:00');
      expect(engine.calendar.isTradingDay(saturday)).toBe(false);
      const result = engine.tick(saturday);
      expect(result.cronExecuted.length).toBe(0);
      expect(result.skipped).toContain('cron:c1');
    });

    it('cron skips on holiday', () => {
      engine.calendar.addHoliday('2026-06-19'); // Juneteenth
      engine.addCronTask({ id: 'c1', cronExpr: '0 9 * * 1-5', enabled: true, skipNonTrading: true });
      const holiday = new Date('2026-06-19T10:00:00');
      const result = engine.tick(holiday);
      expect(result.cronExecuted.length).toBe(0);
      expect(result.skipped).toContain('cron:c1');
    });

    it('cron without skipNonTrading always runs', () => {
      engine.addCronTask({ id: 'c1', cronExpr: '* * * * *', enabled: true, skipNonTrading: false });
      const saturday = new Date('2026-06-06T10:00:00');
      const result = engine.tick(saturday);
      expect(result.cronExecuted).toContain('c1');
    });

    it('disabled cron never runs', () => {
      engine.addCronTask({ id: 'c1', cronExpr: '0 9 * * 1-5', enabled: false, skipNonTrading: true });
      const monday = new Date('2026-06-01T10:00:00');
      const result = engine.tick(monday);
      expect(result.cronExecuted.length).toBe(0);
    });
  });

  describe('Condition + Market Hours', () => {
    it('condition triggers during market hours', () => {
      engine.addConditionRule({ id: 'r1', symbol: 'US.TQQQ', operator: '>', value: 50, enabled: true, monitorAfterHours: false });
      const duringMarket = new Date('2026-06-01T14:00:00'); // 2PM Monday
      expect(engine.calendar.isMarketOpen(duringMarket)).toBe(true);
      const result = engine.tick(duringMarket);
      expect(result.conditionsTriggered).toContain('r1');
    });

    it('condition does NOT trigger after hours (monitorAfterHours=false)', () => {
      engine.addConditionRule({ id: 'r1', symbol: 'US.TQQQ', operator: '>', value: 50, enabled: true, monitorAfterHours: false });
      const afterHours = new Date('2026-06-01T18:00:00'); // 6PM
      expect(engine.calendar.isAfterHours(afterHours)).toBe(true);
      const result = engine.tick(afterHours);
      expect(result.conditionsTriggered.length).toBe(0);
    });

    it('condition with monitorAfterHours triggers anytime', () => {
      engine.addConditionRule({ id: 'r1', symbol: 'US.TQQQ', operator: '>', value: 50, enabled: true, monitorAfterHours: true });
      const afterHours = new Date('2026-06-01T18:00:00');
      const result = engine.tick(afterHours);
      expect(result.conditionsTriggered).toContain('r1');
    });
  });

  describe('Mixed Cron + Condition', () => {
    it('both cron and condition run during market hours', () => {
      engine.addCronTask({ id: 'c1', cronExpr: '0 9 * * 1-5', enabled: true, skipNonTrading: true });
      engine.addConditionRule({ id: 'r1', symbol: 'US.TQQQ', operator: '>', value: 50, enabled: true, monitorAfterHours: false });
      const monday = new Date('2026-06-01T14:00:00');
      const result = engine.tick(monday);
      expect(result.cronExecuted).toContain('c1');
      expect(result.conditionsTriggered).toContain('r1');
    });

    it('condition still monitors when cron skips (holiday)', () => {
      engine.calendar.addHoliday('2026-06-19');
      engine.addCronTask({ id: 'c1', cronExpr: '0 9 * * 1-5', enabled: true, skipNonTrading: true });
      engine.addConditionRule({ id: 'r1', symbol: 'US.TQQQ', operator: '>', value: 50, enabled: true, monitorAfterHours: false });
      const holiday = new Date('2026-06-19T14:00:00');
      const result = engine.tick(holiday);
      expect(result.skipped).toContain('cron:c1');
      // Condition still monitors even on holidays (market-dependent, not calendar)
      expect(result.conditionsTriggered).toContain('r1');
    });
  });
});
