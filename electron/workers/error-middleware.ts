// T61: Error Boundary + Retry Middleware + Error Reporter
import log from 'electron-log';

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  severity: 'error' | 'warn' | 'info';
  timestamp: number;
}

export type ErrorHandlerFn = (report: ErrorReport) => void;

class ErrorReporter {
  private handlers: ErrorHandlerFn[] = [];
  private history: ErrorReport[] = [];
  private maxHistory = 100;

  onError(fn: ErrorHandlerFn): () => void {
    this.handlers.push(fn);
    return () => { this.handlers = this.handlers.filter(h => h !== fn); };
  }

  report(error: Error | string, context?: Record<string, any>, severity: ErrorReport['severity'] = 'error'): void {
    const report: ErrorReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: typeof error === 'string' ? error : error.message,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      severity,
      timestamp: Date.now(),
    };
    this.history.unshift(report);
    if (this.history.length > this.maxHistory) this.history.pop();
    for (const h of this.handlers) h(report);

    if (severity === 'error') {
      log.error('[ErrorReporter]', report);
    }
  }

  getHistory(count = 20): ErrorReport[] {
    return this.history.slice(0, count);
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const errorReporter = new ErrorReporter();

// Retry middleware
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries && shouldRetry(e)) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        errorReporter.report(
          `Retry attempt ${attempt + 1}/${maxRetries}: ${e.message}`,
          { error: e.message },
          'warn'
        );
        await new Promise(r => setTimeout(r, jitter));
      }
    }
  }

  throw lastError;
}

// Safe wrapper
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errorReporter.report(e, context);
    return fallback;
  }
}
