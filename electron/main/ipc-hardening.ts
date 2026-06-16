// ── QUANT MOO — IPC Hardening Layer (R91 J-03) ─────────────────────────
// Provides: input validation, EngineError wrapping, timeout, re-entry guard
// Usage: import { safeHandle, withTimeout, ReentryGuard } from './ipc-hardening';

import { ipcMain } from 'electron';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
import log from 'electron-log';
import type { ZodSchema } from 'zod';

// ── Configuration ──────────────────────────────────────────────────────

export interface SafeHandleOptions<T = unknown> {
  /** Zod schema for input validation */
  schema?: ZodSchema<T>;
  /** Timeout in ms (0 = no timeout, default: 30000) */
  timeout?: number;
  /** Prevent concurrent execution of the same handler */
  preventReentry?: boolean;
  /** Custom error domain (default: SYSTEM) */
  domain?: ErrorDomain;
  /** Handler description for logging */
  description?: string;
}

// ── Re-entry Guard ─────────────────────────────────────────────────────

export class ReentryGuard {
  private running = new Set<string>();

  /** Try to acquire lock. Returns true if acquired, false if already running. */
  acquire(key: string): boolean {
    if (this.running.has(key)) return false;
    this.running.add(key);
    return true;
  }

  /** Release lock */
  release(key: string): void {
    this.running.delete(key);
  }

  /** Check if a handler is currently running */
  isRunning(key: string): boolean {
    return this.running.has(key);
  }

  /** Get all currently running handler keys */
  getRunningKeys(): string[] {
    return Array.from(this.running);
  }
}

// Global re-entry guard instance
export const globalGuard = new ReentryGuard();

// ── Timeout Wrapper ────────────────────────────────────────────────────

/** Wrap a promise with a timeout. Rejects with EngineError on timeout. */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
  domain: ErrorDomain = ErrorDomain.SYSTEM
): Promise<T> {
  if (timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new EngineError(domain, ErrorCode.AI_TIMEOUT,
        `IPC operation '${operationName}' timed out after ${timeoutMs}ms`,
        { context: { operation: operationName, timeoutMs } }
      ));
    }, timeoutMs);

    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

// ── Input Validator ────────────────────────────────────────────────────

/** Validate input against a Zod schema. Throws EngineError on failure. */
export function validateInput<T>(
  data: unknown,
  schema: ZodSchema<T>,
  operationName: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `IPC input validation failed for '${operationName}': ${issues}`,
      { context: { operation: operationName, issues: result.error.issues } }
    );
  }
  return result.data;
}

// ── Safe IPC Handler ───────────────────────────────────────────────────

/**
 * Register an IPC handler with full hardening:
 * - Input validation (Zod schema)
 * - EngineError wrapping (all errors → EngineError)
 * - Timeout mechanism (configurable, default 30s)
 * - Re-entry prevention (optional)
 *
 * @param channel - IPC channel name
 * @param handler - Async handler function
 * @param options - Hardening options
 */
export function safeHandle<TInput = unknown, TResult = unknown>(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, args: TInput) => Promise<TResult>,
  options: SafeHandleOptions<TInput> = {}
): void {
  const {
    schema,
    timeout = 30000,
    preventReentry = false,
    domain = ErrorDomain.SYSTEM,
    description = channel,
  } = options;

  ipcMain.handle(channel, async (event, rawArgs) => {
    const startTime = Date.now();

    // 1. Re-entry check
    if (preventReentry && !globalGuard.acquire(channel)) {
      log.warn(`[IPC:${channel}] Re-entry blocked (already running)`);
      throw new EngineError(domain, ErrorCode.INVALID_PARAM,
        `Operation '${description}' is already in progress`,
        { context: { channel } }
      );
    }

    try {
      // 2. Input validation
      const args = schema
        ? validateInput(rawArgs, schema, description)
        : rawArgs as TInput;

      // 3. Execute with timeout
      const result = await withTimeout(
        handler(event, args),
        timeout,
        description,
        domain
      );

      const elapsed = Date.now() - startTime;
      if (elapsed > 5000) {
        log.warn(`[IPC:${channel}] Slow operation: ${elapsed}ms`);
      }

      return result;
    } catch (error) {
      // 4. EngineError wrapping
      if (error instanceof EngineError) {
        log.error(`[IPC:${channel}] ${error.domain}:${error.code} — ${error.message}`);
        throw error;
      }

      const wrappedError = new EngineError(
        domain,
        ErrorCode.INTERNAL_ERROR,
        `IPC handler '${description}' failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          context: { channel, elapsed: Date.now() - startTime },
          cause: error instanceof Error ? error : undefined,
        }
      );

      log.error(`[IPC:${channel}] Unhandled error → ${wrappedError.message}`);
      throw wrappedError;
    } finally {
      // 5. Release re-entry lock
      if (preventReentry) {
        globalGuard.release(channel);
      }
    }
  });
}

// ── Batch Safe Handle ──────────────────────────────────────────────────

/**
 * Register multiple IPC handlers with the same options.
 */
export function safeHandleBatch(
  handlers: Record<string, (event: Electron.IpcMainInvokeEvent, args: any) => Promise<any>>,
  options: SafeHandleOptions = {}
): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    safeHandle(channel, handler, options);
  }
}

// ── IPC Health Monitor ─────────────────────────────────────────────────

export interface IPCHealthStats {
  totalCalls: number;
  totalErrors: number;
  totalTimeouts: number;
  totalReentryBlocks: number;
  avgLatencyMs: number;
  slowestChannel: string;
  errorRate: number;
}

class IPCHealthTracker {
  private calls = 0;
  private errors = 0;
  private timeouts = 0;
  private reentryBlocks = 0;
  private latencies: number[] = [];
  private channelLatencies = new Map<string, number[]>();

  recordCall(channel: string, latencyMs: number, error = false, timeout = false, reentry = false): void {
    this.calls++;
    this.latencies.push(latencyMs);
    if (error) this.errors++;
    if (timeout) this.timeouts++;
    if (reentry) this.reentryBlocks++;

    const chLat = this.channelLatencies.get(channel) || [];
    chLat.push(latencyMs);
    this.channelLatencies.set(channel, chLat);
  }

  getStats(): IPCHealthStats {
    const avg = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;

    let slowest = '';
    let maxAvg = 0;
    for (const [ch, lats] of this.channelLatencies) {
      const chAvg = lats.reduce((a, b) => a + b, 0) / lats.length;
      if (chAvg > maxAvg) { maxAvg = chAvg; slowest = ch; }
    }

    return {
      totalCalls: this.calls,
      totalErrors: this.errors,
      totalTimeouts: this.timeouts,
      totalReentryBlocks: this.reentryBlocks,
      avgLatencyMs: Math.round(avg),
      slowestChannel: slowest,
      errorRate: this.calls > 0 ? this.errors / this.calls : 0,
    };
  }
}

export const ipcHealth = new IPCHealthTracker();
