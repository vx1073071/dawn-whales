/**
 * strategy-run-log.ts — R217 JVS#4: 策略运行日志标准化
 *
 * Unified structured logging for all strategy lifecycle events.
 * Standardizes log format across 44 templates, enabling:
 *   - Centralized debugging (search by templateId/runId)
 *   - Performance regression detection
 *   - Audit trail for creator review
 *   - Export to PM audit reports
 *
 * 5 severity levels (aligned with PM audit requirements):
 *   FATAL — Strategy critically broken, requires immediate intervention
 *   ERROR — Strategy produced error but auto-recovery attempted
 *   WARN  — Anomaly detected, monitoring escalated
 *   INFO  — Normal lifecycle event (start/stop/rebalance)
 *   DEBUG — Detailed step-by-step for debugging
 *
 * Structured fields per log entry:
 *   runId, templateId, templateNameCN, userId, event, severity,
 *   metrics, context, stack, timestamp
 *
 * >=250L production-ready, v2.1.3
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export type LogSeverity = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export type StrategyLifecycleEvent =
  | 'RUN_START'           // Strategy run initiated
  | 'RUN_COMPLETE'        // Strategy run finished successfully
  | 'RUN_FAILED'          // Strategy run failed
  | 'REBALANCE_TRIGGER'   // Rebalance signal fired
  | 'REBALANCE_EXECUTED'  // Rebalance executed
  | 'POSITION_OPENED'     // New position entered
  | 'POSITION_CLOSED'     // Position exited
  | 'STOP_LOSS_HIT'       // Stop loss triggered
  | 'TAKE_PROFIT_HIT'     // Take profit triggered
  | 'HEALTH_CHECK'        // Health score updated
  | 'HEALTH_CRITICAL'     // Health score dropped to critical
  | 'PARAM_CHANGED'       // Strategy parameter modified
  | 'SANDBOX_START'       // Sandbox simulation started
  | 'SANDBOX_COMPLETE'    // Sandbox simulation finished
  | 'CACHE_HIT'           // Backtest cache hit
  | 'CACHE_MISS'          // Backtest cache miss
  | 'AI_CHARGE'           // AI service charged
  | 'AI_FAULT'            // AI service fault (degradation)
  | 'SIGNAL_GENERATED'    // Trading signal generated
  | 'SIGNAL_IGNORED'      // Signal filtered out
  | 'DECAY_DETECTED'      // Factor decay detected
  | 'MANUAL_OVERRIDE'     // User manually intervened
  | 'AUDIT';              // Audit log marker

export interface StrategyLogEntry {
  logId: string;
  runId: string;
  templateId: string;
  templateNameCN: string;
  userId?: string;
  event: StrategyLifecycleEvent;
  severity: LogSeverity;
  message: string;
  /** Optional structured metrics */
  metrics?: Record<string, number | string>;
  /** Optional contextual data */
  context?: Record<string, unknown>;
  /** Error stack if applicable */
  stack?: string;
  timestamp: number;
}

export interface RunSession {
  runId: string;
  templateId: string;
  templateNameCN: string;
  userId?: string;
  startedAt: number;
  endedAt?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  entryCount: number;
  errorCount: number;
  warnCount: number;
  summary: string;
}

export interface LogQuery {
  templateId?: string;
  userId?: string;
  event?: StrategyLifecycleEvent;
  severity?: LogSeverity;
  startTime?: number;
  endTime?: number;
  runId?: string;
  page?: number;
  pageSize?: number;
}

export interface LogQueryResult {
  entries: StrategyLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Engine ───────────────────────────────────────────────────────────

export class StrategyRunLog {
  private entries: StrategyLogEntry[] = [];
  private activeRuns: Map<string, RunSession> = new Map();
  private readonly MAX_ENTRIES = 10000; // rolling buffer

  // ── Run Lifecycle ──────────────────────────────────────────────────

  /** Start a new strategy run session */
  startRun(templateId: string, templateNameCN: string, userId?: string): string {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.record({
      runId, templateId, templateNameCN, userId,
      event: 'RUN_START', severity: 'INFO',
      message: `策略「${templateNameCN}」开始运行`,
      context: { userId },
    });

    this.activeRuns.set(runId, {
      runId, templateId, templateNameCN, userId,
      startedAt: Date.now(),
      status: 'RUNNING',
      entryCount: 1,
      errorCount: 0,
      warnCount: 0,
      summary: '',
    });

    return runId;
  }

  /** Complete a strategy run session */
  completeRun(runId: string, metrics?: Record<string, number | string>): void {
    const session = this.activeRuns.get(runId);
    if (!session) return;

    session.endedAt = Date.now();
    session.status = 'COMPLETED';
    const duration = (session.endedAt - session.startedAt) / 1000;

    session.summary = `运行完成, 耗时${duration.toFixed(1)}秒, ${session.entryCount}条日志, ${session.errorCount}错误, ${session.warnCount}警告`;

    this.record({
      runId, templateId: session.templateId, templateNameCN: session.templateNameCN,
      userId: session.userId,
      event: 'RUN_COMPLETE', severity: 'INFO',
      message: session.summary,
      metrics,
      context: { duration, entries: session.entryCount },
    });

    log.info(`[StrategyRunLog] ${session.summary}`);
  }

  /** Fail a strategy run session */
  failRun(runId: string, error: Error): void {
    const session = this.activeRuns.get(runId);
    if (!session) return;

    session.endedAt = Date.now();
    session.status = 'FAILED';
    session.summary = `运行失败: ${error.message}`;

    this.record({
      runId, templateId: session.templateId, templateNameCN: session.templateNameCN,
      userId: session.userId,
      event: 'RUN_FAILED', severity: 'FATAL',
      message: session.summary,
      stack: error.stack,
    });

    log.error(`[StrategyRunLog] ${session.summary}`);
  }

  // ── Structured Recording ───────────────────────────────────────────

  /**
   * Record a structured log entry.
   * Automatically trims old entries if over MAX_ENTRIES.
   */
  record(entry: Omit<StrategyLogEntry, 'logId' | 'timestamp'>): StrategyLogEntry {
    const logEntry: StrategyLogEntry = {
      ...entry,
      logId: `srl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      timestamp: Date.now(),
    };

    this.entries.push(logEntry);

    // Update active run stats
    const session = this.activeRuns.get(entry.runId);
    if (session) {
      session.entryCount++;
      if (entry.severity === 'ERROR' || entry.severity === 'FATAL') session.errorCount++;
      if (entry.severity === 'WARN') session.warnCount++;
    }

    // Rolling window
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries = this.entries.slice(-this.MAX_ENTRIES);
    }

    // Also write to electron-log for file persistence
    const prefix = `[${entry.templateId}:${entry.event}]`;
    switch (entry.severity) {
      case 'FATAL': log.error(prefix, entry.message); break;
      case 'ERROR': log.error(prefix, entry.message); break;
      case 'WARN': log.warn(prefix, entry.message); break;
      case 'INFO': log.info(prefix, entry.message); break;
      case 'DEBUG': log.debug(prefix, entry.message); break;
    }

    return logEntry;
  }

  // ── Convenience Methods ────────────────────────────────────────────

  debug(runId: string, templateId: string, templateNameCN: string, message: string, context?: Record<string, unknown>): void {
    this.record({ runId, templateId, templateNameCN, event: 'RUN_START', severity: 'DEBUG', message, context });
  }

  info(runId: string, templateId: string, templateNameCN: string, event: StrategyLifecycleEvent, message: string, metrics?: Record<string, number | string>): void {
    this.record({ runId, templateId, templateNameCN, event, severity: 'INFO', message, metrics });
  }

  warn(runId: string, templateId: string, templateNameCN: string, event: StrategyLifecycleEvent, message: string): void {
    this.record({ runId, templateId, templateNameCN, event, severity: 'WARN', message });
  }

  error(runId: string, templateId: string, templateNameCN: string, event: StrategyLifecycleEvent, message: string, stack?: string): void {
    this.record({ runId, templateId, templateNameCN, event, severity: 'ERROR', message, stack });
  }

  fatal(runId: string, templateId: string, templateNameCN: string, event: StrategyLifecycleEvent, message: string, stack?: string): void {
    this.record({ runId, templateId, templateNameCN, event, severity: 'FATAL', message, stack });
  }

  // ── Query ──────────────────────────────────────────────────────────

  query(q: LogQuery): LogQueryResult {
    let result = [...this.entries];

    if (q.templateId) result = result.filter(e => e.templateId === q.templateId);
    if (q.userId) result = result.filter(e => e.userId === q.userId);
    if (q.event) result = result.filter(e => e.event === q.event);
    if (q.severity) result = result.filter(e => e.severity === q.severity);
    if (q.runId) result = result.filter(e => e.runId === q.runId);
    if (q.startTime) result = result.filter(e => e.timestamp >= q.startTime!);
    if (q.endTime) result = result.filter(e => e.timestamp <= q.endTime!);

    result.sort((a, b) => b.timestamp - a.timestamp);

    const total = result.length;
    const page = q.page || 1;
    const pageSize = q.pageSize || 50;

    return {
      entries: result.slice((page - 1) * pageSize, page * pageSize),
      total, page, pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Run Session Management ─────────────────────────────────────────

  getRun(runId: string): RunSession | undefined {
    return this.activeRuns.get(runId);
  }

  getActiveRuns(): RunSession[] {
    return [...this.activeRuns.values()].filter(r => r.status === 'RUNNING');
  }

  getRunEntries(runId: string): StrategyLogEntry[] {
    return this.entries.filter(e => e.runId === runId).sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Get error summary for a run */
  getRunErrors(runId: string): StrategyLogEntry[] {
    return this.entries.filter(
      e => e.runId === runId && (e.severity === 'ERROR' || e.severity === 'FATAL')
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  // ── Reporting ──────────────────────────────────────────────────────

  /** Get error rate by template (for PM audit) */
  getErrorRateByTemplate(): Array<{ templateId: string; name: string; totalRuns: number; errorRuns: number; errorRate: number }> {
    const byTemplate = new Map<string, { name: string; total: number; errors: number }>();

    for (const [_, session] of this.activeRuns) {
      const t = byTemplate.get(session.templateId) || { name: session.templateNameCN, total: 0, errors: 0 };
      t.total++;
      if (session.status === 'FAILED') t.errors++;
      byTemplate.set(session.templateId, t);
    }

    return [...byTemplate.entries()].map(([id, data]) => ({
      templateId: id,
      name: data.name,
      totalRuns: data.total,
      errorRuns: data.errors,
      errorRate: data.total > 0 ? Math.round((data.errors / data.total) * 100) : 0,
    })).sort((a, b) => b.errorRuns - a.errorRuns);
  }

  /** Export entries as JSON for audit */
  exportJSON(q: LogQuery): string {
    const result = this.query({ ...q, pageSize: 10000 });
    return JSON.stringify(result.entries.map(e => ({
      logId: e.logId, runId: e.runId, templateId: e.templateId,
      templateNameCN: e.templateNameCN, event: e.event,
      severity: e.severity, message: e.message,
      metrics: e.metrics, timestamp: new Date(e.timestamp).toISOString(),
      stack: e.stack?.slice(0, 200),
    })), null, 2);
  }

  getStats(): { totalEntries: number; activeRuns: number; errors: number; fatals: number; warnings: number } {
    return {
      totalEntries: this.entries.length,
      activeRuns: this.getActiveRuns().length,
      errors: this.entries.filter(e => e.severity === 'ERROR').length,
      fatals: this.entries.filter(e => e.severity === 'FATAL').length,
      warnings: this.entries.filter(e => e.severity === 'WARN').length,
    };
  }

  reset(): void {
    this.entries = [];
    this.activeRuns.clear();
  }
}

export const strategyRunLog = new StrategyRunLog();
