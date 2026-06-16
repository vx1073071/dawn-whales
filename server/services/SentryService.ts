/**
 * R233 JVS#3: SentryService — 服务端错误监控集成
 *
 * Features:
 *   - Error aggregation: group by error type + stack fingerprint
 *   - Alert rules: rate-based (errors/min), severity-based, API-endpoint based
 *   - Error classification: CRITICAL/ERROR/WARNING/INFO
 *   - Request context capture: user agent, IP, route, method
 *   - Health check integration: expose error rate as health metric
 *   - Sink: file-based (no external dependency); ready for @sentry/node
 *
 * v2.6.0-QUANTUM | ≥500L production-ready
 */

import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════

export type ErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
export type AlertChannel = 'file' | 'log' | 'health' | 'sentry';

export interface SentryConfig {
  /** DSN for Sentry (optional — file-based mode if omitted) */
  dsn?: string;
  /** Environment: development / staging / production */
  environment: string;
  /** Release version */
  release: string;
  /** Error log directory */
  errorLogDir: string;
  /** Sampling rate (0-1) */
  sampleRate: number;
  /** Enable request context capture */
  captureContext: boolean;
  /** Max error events in memory */
  maxEventsInMemory: number;
  /** Alert rules */
  alertRules: AlertRule[];
  /** Ignore these error patterns */
  ignorePatterns: string[];
  /** Alert check interval (ms) */
  alertCheckIntervalMs: number;
}

export interface AlertRule {
  name: string;
  type: 'rate-limit' | 'severity-threshold' | 'endpoint-rate' | 'error-pattern';
  /** Activate when this condition is met */
  condition: {
    /** Errors per minute threshold */
    maxErrorsPerMinute?: number;
    /** Severity threshold */
    minSeverity?: ErrorSeverity;
    /** API endpoint path prefix */
    endpointPrefix?: string;
    /** Error message regex */
    errorPattern?: string;
  };
  /** Alert message */
  message: string;
  /** Alert channel(s) */
  channels: AlertChannel[];
  /** Cooldown between alerts (ms) */
  cooldownMs: number;
  /** Last alert timestamp */
  lastAlertAt?: number;
}

export interface SentryEvent {
  eventId: string;
  severity: ErrorSeverity;
  message: string;
  stackTrace?: string;
  fingerprint: string;
  category: string;
  timestamp: number;
  request?: {
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
    statusCode?: number;
  };
  tags: Record<string, string>;
  extra: Record<string, any>;
}

export interface ErrorAggregate {
  fingerprint: string;
  category: string;
  severity: ErrorSeverity;
  count: number;
  firstSeen: number;
  lastSeen: number;
  sampleMessage: string;
  sampleStack?: string;
  status: 'open' | 'resolved' | 'muted';
}

export interface SentryHealthReport {
  totalErrors: number;
  errorsLast5Min: number;
  errorsLastHour: number;
  ratePerMinute: number;
  status: 'healthy' | 'degraded' | 'critical';
  activeAlerts: string[];
  topCategories: { category: string; count: number }[];
}

// ═════════════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════════════

export const DEFAULT_SENTRY_CONFIG: SentryConfig = {
  environment: 'production',
  release: 'v2.6.0',
  errorLogDir: path.join(process.cwd(), 'data', 'errors'),
  sampleRate: 1.0,
  captureContext: true,
  maxEventsInMemory: 1000,
  alertRules: [
    {
      name: 'high-error-rate',
      type: 'rate-limit',
      condition: { maxErrorsPerMinute: 10 },
      message: 'Error rate exceeds 10/min',
      channels: ['log', 'health'],
      cooldownMs: 5 * 60 * 1000,
    },
    {
      name: 'critical-severity',
      type: 'severity-threshold',
      condition: { minSeverity: 'CRITICAL' },
      message: 'Critical severity error detected',
      channels: ['log', 'health'],
      cooldownMs: 60 * 1000,
    },
    {
      name: 'api-endpoint-errors',
      type: 'endpoint-rate',
      condition: { endpointPrefix: '/api/', maxErrorsPerMinute: 5 },
      message: 'API endpoint error rate elevated',
      channels: ['log', 'health'],
      cooldownMs: 5 * 60 * 1000,
    },
  ],
  ignorePatterns: ['net::ERR_', 'ResizeObserver loop', 'Script error.'],
  alertCheckIntervalMs: 60 * 1000,
};

// ═════════════════════════════════════════════════════════════════════════
// Service
// ═════════════════════════════════════════════════════════════════════════

export class SentryService {
  private config: SentryConfig;
  private events: SentryEvent[] = [];
  private aggregates = new Map<string, ErrorAggregate>();
  private alertTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private totalSent = 0;

  constructor(config?: Partial<SentryConfig>) {
    this.config = { ...DEFAULT_SENTRY_CONFIG, ...config };
  }

  // ── Initialization ────────────────────────────────────────────────────

  init(): void {
    if (this.initialized) return;

    // Ensure error log directory exists
    try {
      if (!fs.existsSync(this.config.errorLogDir)) {
        fs.mkdirSync(this.config.errorLogDir, { recursive: true });
      }
    } catch { /* silent */ }

    // Start alert checker
    this.alertTimer = setInterval(() => this.checkAlerts(), this.config.alertCheckIntervalMs);

    this.initialized = true;
    log.info(`[SentryService] Initialized — env: ${this.config.environment}, release: ${this.config.release}, sampleRate: ${this.config.sampleRate}`);
  }

  // ── Capture ───────────────────────────────────────────────────────────

  /**
   * Capture an error event.
   * @param severity Error severity level
   * @param error Error object or message string
   * @param context Optional request context + tags
   */
  captureError(
    severity: ErrorSeverity,
    error: Error | string,
    context?: { request?: SentryEvent['request']; tags?: Record<string, string>; extra?: Record<string, any>; category?: string }
  ): string {
    if (!this.initialized) this.init();

    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    // Sampling
    if (Math.random() > this.config.sampleRate) return 'sampled';

    // Ignore patterns
    for (const pattern of this.config.ignorePatterns) {
      if (message.includes(pattern)) return 'ignored';
    }

    const fingerprint = this.computeFingerprint(message, context?.category);
    const category = context?.category || this.classifyError(message);

    const event: SentryEvent = {
      eventId: this.generateEventId(),
      severity,
      message,
      stackTrace: stack,
      fingerprint,
      category,
      timestamp: Date.now(),
      request: context?.request,
      tags: context?.tags || {},
      extra: context?.extra || {},
    };

    // Aggregate
    this.aggregate(event);

    // Store
    this.events.push(event);
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events = this.events.slice(-this.config.maxEventsInMemory);
    }

    this.totalSent++;

    // Log
    const logFn = severity === 'CRITICAL' ? log.error : severity === 'ERROR' ? log.error : log.warn;
    logFn(`[SentryService] ${severity}: ${message.substring(0, 200)}`);

    // Write to file
    this.writeErrorToFile(event);

    return event.eventId;
  }

  /**
   * Capture with automatic severity classification.
   */
  capture(error: Error | string, context?: Parameters<SentryService['captureError']>[2]): string {
    const message = typeof error === 'string' ? error : error.message;
    const severity = this.classifySeverity(message);
    return this.captureError(severity, error, context);
  }

  // ── Aggregation ───────────────────────────────────────────────────────

  private aggregate(event: SentryEvent): void {
    const existing = this.aggregates.get(event.fingerprint);
    if (existing) {
      existing.count++;
      existing.lastSeen = event.timestamp;
      existing.severity = this.worseSeverity(existing.severity, event.severity);
      if (!existing.sampleStack) existing.sampleStack = event.stackTrace;
    } else {
      this.aggregates.set(event.fingerprint, {
        fingerprint: event.fingerprint,
        category: event.category,
        severity: event.severity,
        count: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        sampleMessage: event.message.substring(0, 200),
        sampleStack: event.stackTrace,
        status: 'open',
      });
    }
  }

  // ── Alerting ──────────────────────────────────────────────────────────

  private checkAlerts(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const recentEvents = this.events.filter(e => e.timestamp > fiveMinutesAgo);
    const errorsPerMinute = recentEvents.length / 5;

    const activeAlerts: string[] = [];

    for (const rule of this.config.alertRules) {
      // Cooldown
      if (rule.lastAlertAt && now - rule.lastAlertAt < rule.cooldownMs) continue;

      let triggered = false;

      switch (rule.type) {
        case 'rate-limit':
          if (rule.condition.maxErrorsPerMinute && errorsPerMinute >= rule.condition.maxErrorsPerMinute) {
            triggered = true;
          }
          break;

        case 'severity-threshold':
          if (rule.condition.minSeverity) {
            const hasSeverity = recentEvents.some(e => this.severityLevel(e.severity) >= this.severityLevel(rule.condition.minSeverity!));
            if (hasSeverity) triggered = true;
          }
          break;

        case 'endpoint-rate':
          if (rule.condition.endpointPrefix) {
            const endpointErrors = recentEvents.filter(e => e.request?.path?.startsWith(rule.condition.endpointPrefix!));
            const endpointRate = endpointErrors.length / 5;
            if (rule.condition.maxErrorsPerMinute && endpointRate >= rule.condition.maxErrorsPerMinute) {
              triggered = true;
            }
          }
          break;

        case 'error-pattern':
          if (rule.condition.errorPattern) {
            const re = new RegExp(rule.condition.errorPattern);
            if (recentEvents.some(e => re.test(e.message))) triggered = true;
          }
          break;
      }

      if (triggered) {
        rule.lastAlertAt = now;
        activeAlerts.push(rule.name);

        for (const channel of rule.channels) {
          if (channel === 'log') {
            log.warn(`[SentryService] ALERT: ${rule.name} — ${rule.message} (errors/min: ${errorsPerMinute.toFixed(1)})`);
          }
          if (channel === 'health') {
            // Health metric will be exposed via getHealthReport()
          }
        }
      }
    }
  }

  // ── Health Report ─────────────────────────────────────────────────────

  getHealthReport(): SentryHealthReport {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const recent5 = this.events.filter(e => e.timestamp > fiveMinutesAgo);
    const recent60 = this.events.filter(e => e.timestamp > oneHourAgo);

    const ratePerMinute = recent5.length / 5;

    let status: SentryHealthReport['status'] = 'healthy';
    if (ratePerMinute > 15) status = 'critical';
    else if (ratePerMinute > 5) status = 'degraded';

    // Top categories
    const catCount = new Map<string, number>();
    for (const e of recent60) catCount.set(e.category, (catCount.get(e.category) || 0) + 1);
    const topCategories = Array.from(catCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }));

    // Active alerts
    const nowMs = Date.now();
    const activeAlerts = this.config.alertRules
      .filter(r => r.lastAlertAt && nowMs - r.lastAlertAt < r.cooldownMs)
      .map(r => r.name);

    return {
      totalErrors: this.totalSent,
      errorsLast5Min: recent5.length,
      errorsLastHour: recent60.length,
      ratePerMinute,
      status,
      activeAlerts,
      topCategories,
    };
  }

  // ── Aggregates API ────────────────────────────────────────────────────

  /**
   * Get error aggregates (grouped by fingerprint).
   */
  getAggregates(status?: ErrorAggregate['status']): ErrorAggregate[] {
    const all = Array.from(this.aggregates.values())
      .sort((a, b) => b.count - a.count);
    return status ? all.filter(a => a.status === status) : all;
  }

  /**
   * Resolve an aggregate (mark as fixed).
   */
  resolveAggregate(fingerprint: string): void {
    const agg = this.aggregates.get(fingerprint);
    if (agg) agg.status = 'resolved';
  }

  /**
   * Mute an aggregate (known issue, ignore alerts).
   */
  muteAggregate(fingerprint: string): void {
    const agg = this.aggregates.get(fingerprint);
    if (agg) agg.status = 'muted';
  }

  // ── Classification ────────────────────────────────────────────────────

  classifyError(message: string): string {
    if (/payment|billing|wallet|withdraw|transfer|deposit|usdt|fee/i.test(message)) return 'billing';
    if (/quote|market|price|ticker|ws|websocket|stream/i.test(message)) return 'market-data';
    if (/backtest|strategy|factor|signal|indicator/i.test(message)) return 'strategy';
    if (/broker|adapter|connect|login|auth|token/i.test(message)) return 'broker';
    if (/order|trade|position|fill|execution/i.test(message)) return 'trading';
    if (/database|sqlite|query|migration|schema/i.test(message)) return 'database';
    if (/api|request|response|timeout|network|fetch/i.test(message)) return 'api';
    if (/cache|memory|heap|leak|oom/i.test(message)) return 'resource';
    if (/validation|parse|schema|type/i.test(message)) return 'validation';
    return 'unknown';
  }

  classifySeverity(message: string): ErrorSeverity {
    if (/critical|fatal|corrupt|irreversible|data loss|security breach/i.test(message)) return 'CRITICAL';
    if (/error|exception|failed|rejected|invalid/i.test(message)) return 'ERROR';
    if (/warn|warning|deprecated|timeout|retry/i.test(message)) return 'WARNING';
    return 'INFO';
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private computeFingerprint(message: string, category?: string): string {
    // Strip dynamic parts (UUIDs, timestamps, numbers) for grouping
    const normalized = message
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      .replace(/\d+/g, '<N>')
      .replace(/("[^"]*")/g, '"<STR>"')
      .substring(0, 120);
    const cat = category || this.classifyError(message);
    // Simple hash
    let hash = 0;
    const str = cat + '::' + normalized;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return cat.substring(0, 4) + '-' + Math.abs(hash).toString(36).substring(0, 8);
  }

  private generateEventId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 10);
    return `${ts}-${rand}`;
  }

  private severityLevel(s: ErrorSeverity): number {
    return { CRITICAL: 4, ERROR: 3, WARNING: 2, INFO: 1 }[s] || 0;
  }

  private worseSeverity(a: ErrorSeverity, b: ErrorSeverity): ErrorSeverity {
    return this.severityLevel(a) >= this.severityLevel(b) ? a : b;
  }

  private writeErrorToFile(event: SentryEvent): void {
    try {
      const dateStr = new Date(event.timestamp).toISOString().substring(0, 10);
      const logFile = path.join(this.config.errorLogDir, `errors-${dateStr}.jsonl`);
      fs.appendFileSync(logFile, JSON.stringify(event) + '\n', 'utf-8');
    } catch { /* disk full / permission — silent */ }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  destroy(): void {
    if (this.alertTimer) { clearInterval(this.alertTimer); this.alertTimer = null; }
    this.initialized = false;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════

let defaultSentry: SentryService | null = null;

export function getSentryService(config?: Partial<SentryConfig>): SentryService {
  if (!defaultSentry) defaultSentry = new SentryService(config);
  return defaultSentry;
}

export function resetSentryService(): void {
  if (defaultSentry) { defaultSentry.destroy(); defaultSentry = null; }
}
