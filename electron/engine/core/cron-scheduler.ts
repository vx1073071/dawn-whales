// ── CronScheduler — scheduled taskscheduler ────────────────────────────────────────
// Phase 4.1: 
// cron + interval， StrategyRunner
// ML-29-01 [P0]

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export interface CronTask {
  id: string;
  name: string;
  strategyId: string;
  schedule: CronSchedule;
  options: CronTaskOptions;
  status: CronTaskStatus;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  createdAt: number;
  updatedAt: number;
}

export type CronSchedule = CronExpression | SimpleInterval;

export interface CronExpression {
  type: 'cron';
  expression: string; // "0 9 * * 1-5" = weekday 9:00AM
}

export interface SimpleInterval {
  type: 'interval';
  everyMinutes: number;
}

export interface CronTaskOptions {
  dryRun: boolean;
  brokerId?: string;
  riskConfig?: { maxDailyLoss?: number; maxPositionPct?: number };
  enabled: boolean;
}

export type CronTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export type CronEventType = 'task_started' | 'task_completed' | 'task_failed' | 'task_paused' | 'task_resumed';

export interface CronEvent {
  type: CronEventType;
  taskId: string;
  timestamp: number;
  message?: string;
  result?: unknown;
}

// ── CronScheduler ──────────────────────────────────────────────────────────

export class CronScheduler {
  private tasks = new Map<string, CronTask>();
  private timers = new Map<string, NodeJS.Timeout>();
  private listeners: Array<(event: CronEvent) => void> = [];
  private strategyRunner?: StrategyRunnerInterface;

  /** Register a strategy runner callback (set by main process) */
  setStrategyRunner(runner: StrategyRunnerInterface): void {
    this.strategyRunner = runner;
  }

  /** Schedule a new cron task */
  schedule(task: Omit<CronTask, 'id' | 'status' | 'runCount' | 'createdAt' | 'updatedAt' | 'lastRun' | 'nextRun'>): CronTask {
    const id = `cron-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const nextRun = this.computeNextRun(task.schedule);

    const cronTask: CronTask = {
      ...task,
      id,
      status: task.options.enabled ? 'pending' : 'paused',
      runCount: 0,
      createdAt: now,
      updatedAt: now,
      nextRun,
    };

    this.tasks.set(id, cronTask);

    if (cronTask.options.enabled) {
      this.scheduleTimer(cronTask);
    }

    this.persist(cronTask);
    log.info(`[CronScheduler] Task scheduled: ${cronTask.name} (${id}), next: ${new Date(nextRun!).toISOString()}`);

    return cronTask;
  }

  /** Cancel (delete) a task */
  cancel(taskId: string): boolean {
    this.clearTimer(taskId);
    const existed = this.tasks.delete(taskId);
    if (existed) {
      this.removePersist(taskId);
      this.emit({ type: 'task_failed', taskId, timestamp: Date.now(), message: 'Task cancelled' });
    }
    return existed;
  }

  /** Pause a task */
  pause(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'paused') return false;
    this.clearTimer(taskId);
    task.status = 'paused';
    task.updatedAt = Date.now();
    this.persist(task);
    this.emit({ type: 'task_paused', taskId, timestamp: Date.now() });
    return true;
  }

  /** Resume a paused task */
  resume(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;
    task.status = 'pending';
    task.nextRun = this.computeNextRun(task.schedule);
    task.updatedAt = Date.now();
    this.scheduleTimer(task);
    this.persist(task);
    this.emit({ type: 'task_resumed', taskId, timestamp: Date.now() });
    return true;
  }

  /** List all tasks */
  list(): CronTask[] {
    return Array.from(this.tasks.values());
  }

  /** Get a single task */
  get(taskId: string): CronTask | undefined {
    return this.tasks.get(taskId);
  }

  /** Force-run a task immediately (manual trigger) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async trigger(taskId: string): Promise<{ success: boolean; error?: string; result?: any }> {
    const task = this.tasks.get(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    return this.executeTask(task);
  }

  /** Subscribe to cron events */
  onEvent(listener: (event: CronEvent) => void): void {
    this.listeners.push(listener);
  }

  /** Destroy all timers */
  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.tasks.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private computeNextRun(schedule: CronSchedule): number {
    if (schedule.type === 'interval') {
      return Date.now() + schedule.everyMinutes * 60 * 1000;
    }
    // cron: compute next matching time
    return this.nextCronTime(schedule.expression);
  }

  private nextCronTime(expression: string): number {
    // Parse "minute hour dayOfMonth month dayOfWeek"
    // Simple cron: supports *, numbers, ranges, single values
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) {
      // Default: every 15 minutes
      return Date.now() + 15 * 60 * 1000;
    }

    const [minStr, hourStr, domStr, monStr, dowStr] = parts;
    const now = new Date();

    // For simplicity: if specific hour/minute, set next time
    const minute = minStr === '*' ? now.getMinutes() + 1 : parseInt(minStr);
    const hour = hourStr === '*' ? now.getHours() : parseInt(hourStr);

    const next = new Date(now);
    next.setMinutes(minute, 0, 0);

    if (hourStr !== '*') {
      next.setHours(hour);
    }

    // Handle day-of-week filter (1=Monday, 5=Friday)
    if (dowStr !== '*') {
      const targetDow = parseInt(dowStr);
      const currentDow = now.getDay();
      // Find next matching day of week
      let daysForward = targetDow - currentDow;
      if (daysForward <= 0) daysForward += 7;
      if (next <= now) daysForward += 7;
      next.setDate(now.getDate() + daysForward);
    }

    if (next <= now) {
      // If next time is in the past (e.g., specific time today already passed), advance to tomorrow
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  }

  private scheduleTimer(task: CronTask): void {
    if (!task.nextRun) return;
    const delay = Math.max(0, task.nextRun - Date.now());
    this.clearTimer(task.id);
    const timer = setTimeout(() => this.executeTask(task), delay);
    this.timers.set(task.id, timer);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeTask(task: CronTask): Promise<{ success: boolean; error?: string; result?: any }> {
    task.status = 'running';
    task.lastRun = Date.now();
    task.updatedAt = Date.now();
    this.persist(task);

    this.emit({ type: 'task_started', taskId: task.id, timestamp: Date.now() });

    try {
      if (!this.strategyRunner) {
        throw new EngineError(ErrorCode.MONITORING_ERROR, 'StrategyRunner not registered');
      }

      const result = await this.strategyRunner.run({
        strategyId: task.strategyId,
        dryRun: task.options.dryRun,
        brokerId: task.options.brokerId,
      });

      task.status = 'completed';
      task.runCount++;
      task.updatedAt = Date.now();
      this.persist(task);

      this.emit({ type: 'task_completed', taskId: task.id, timestamp: Date.now(), result });
      log.info(`[CronScheduler] Task completed: ${task.name} (${task.id}), runs: ${task.runCount}`);

      // Re-schedule for next run
      task.nextRun = this.computeNextRun(task.schedule);
      this.scheduleTimer(task);

      return { success: true, result };
    } catch (err: unknown) {
      task.status = 'failed';
      task.runCount++;
      task.updatedAt = Date.now();
      this.persist(task);

      const errorMsg = err.message || 'Unknown error';
      this.emit({ type: 'task_failed', taskId: task.id, timestamp: Date.now(), message: errorMsg });
      log.error(`[CronScheduler] Task failed: ${task.name} (${task.id}): ${errorMsg}`);

      // Re-schedule for next run (even on failure, try again)
      task.nextRun = this.computeNextRun(task.schedule);
      this.scheduleTimer(task);

      return { success: false, error: errorMsg };
    }
  }

  private clearTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(taskId);
    }
  }

  private emit(event: CronEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  // ── Simple persistence (in-memory Map + optional SQLite) ─────────────────

  private persist(task: CronTask): void {
    // Store in persistent data — for now, in-memory is sufficient
    // Phase 4.2: migrate to SQLite via DatabaseManager
    this.tasks.set(task.id, task);
  }

  private removePersist(taskId: string): void {
    this.tasks.delete(taskId);
  }
}

// ── StrategyRunner Interface ───────────────────────────────────────────────

export interface StrategyRunnerInterface {
  run(opts: {
    strategyId: string;
    dryRun: boolean;
    brokerId?: string;
  }): Promise<{
    signal?: { side: 'BUY' | 'SELL'; symbol: string; quantity: number };
    order?: { orderId: string; status: string };
    riskPassed: boolean;
    duration: number;
  }>;
}
