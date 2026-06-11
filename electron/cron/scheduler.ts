/**
 * electron/cron/scheduler.ts — R108 S-36+37 Cron Job Scheduler
 *
 * Uses setInterval (no external cron dependency needed in Electron).
 * Jobs:
 *   reconciliation — daily at UTC 00:00, 3 retries on failure with dead letter queue
 *   exchangeRate — every 6h, CoinGecko→Binance→static fallback with health monitoring
 */
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────

export interface CronJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  maxRetries: number;
  retryDelayMs: number;
  enabled: boolean;
}

export interface CronStatus {
  name: string;
  lastRun: number | null;
  lastSuccess: number | null;
  consecutiveFailures: number;
  totalRuns: number;
  totalFailures: number;
}

interface DeadLetter {
  jobName: string;
  error: string;
  timestamp: number;
  retryCount: number;
}

// ── Scheduler ──────────────────────────────────────────────

class CronScheduler {
  private jobs = new Map<string, { config: CronJob; timer: ReturnType<typeof setInterval> | null }>();
  private statuses = new Map<string, CronStatus>();
  private deadLetters: DeadLetter[] = [];
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = false;

  /** Register a cron job */
  register(job: CronJob): void {
    if (this.jobs.has(job.name)) {
      log.warn(`[CronScheduler] Job "${job.name}" already registered, replacing`);
    }
    this.jobs.set(job.name, { config: job, timer: null });
    this.statuses.set(job.name, {
      name: job.name,
      lastRun: null,
      lastSuccess: null,
      consecutiveFailures: 0,
      totalRuns: 0,
      totalFailures: 0,
    });
    log.info(`[CronScheduler] Registered job: ${job.name} (every ${job.intervalMs}ms)`);
  }

  /** Start all registered jobs */
  startAll(): void {
    if (this.running) return;
    this.running = true;

    for (const [name, { config }] of this.jobs) {
      if (!config.enabled) continue;
      this.startJob(name);
    }
    log.info('[CronScheduler] All jobs started');
  }

  /** Start a single job */
  private startJob(name: string): void {
    const entry = this.jobs.get(name);
    if (!entry) return;

    if (entry.timer) clearInterval(entry.timer);

    // Run immediately first time
    this.executeJob(name);

    // Then schedule periodic execution
    entry.timer = setInterval(() => {
      this.executeJob(name);
    }, entry.config.intervalMs);

    log.info(`[CronScheduler] Job "${name}" started (interval: ${entry.config.intervalMs}ms)`);
  }

  /** Execute a job with retry logic */
  private async executeJob(name: string, retryCount = 0): Promise<void> {
    const entry = this.jobs.get(name);
    const status = this.statuses.get(name);
    if (!entry || !status) return;

    status.lastRun = Date.now();
    status.totalRuns++;

    try {
      await entry.config.handler();
      status.lastSuccess = Date.now();
      status.consecutiveFailures = 0;
      log.info(`[CronScheduler] Job "${name}" completed successfully`);

      // Retry any dead letters for this job
      this.retryDeadLetters(name);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      status.totalFailures++;
      status.consecutiveFailures++;
      log.error(`[CronScheduler] Job "${name}" failed: ${errorMsg}`);

      // Enqueue dead letter
      this.deadLetters.push({
        jobName: name,
        error: errorMsg,
        timestamp: Date.now(),
        retryCount,
      });

      // Retry if under maxRetries
      if (retryCount < entry.config.maxRetries) {
        const delay = entry.config.retryDelayMs * (retryCount + 1);
        log.warn(`[CronScheduler] Job "${name}" retrying in ${delay}ms (attempt ${retryCount + 1}/${entry.config.maxRetries})`);

        const timerKey = `${name}-retry-${retryCount}`;
        const timer = setTimeout(() => {
          this.retryTimers.delete(timerKey);
          this.executeJob(name, retryCount + 1);
        }, delay);
        this.retryTimers.set(timerKey, timer);
      } else {
        log.error(`[CronScheduler] Job "${name}" exhausted all ${entry.config.maxRetries} retries`);
      }
    }
  }

  /** Retry dead letters for a job */
  private async retryDeadLetters(jobName: string): Promise<void> {
    const pending = this.deadLetters.filter(d => d.jobName === jobName && d.retryCount < 3);
    for (const dl of pending) {
      try {
        const entry = this.jobs.get(jobName);
        if (entry) {
          await entry.config.handler();
          log.info(`[CronScheduler] Dead letter retry successful for ${jobName}`);
        }
      } catch {
        dl.retryCount++;
        log.warn(`[CronScheduler] Dead letter retry ${dl.retryCount} failed for ${jobName}`);
      }
    }
    // Remove successfully retried dead letters
    this.deadLetters = this.deadLetters.filter(d => d.jobName !== jobName || d.retryCount >= 3);
  }

  /** Stop all jobs */
  stopAll(): void {
    this.running = false;
    for (const [, entry] of this.jobs) {
      if (entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
      }
    }
    for (const [, timer] of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    log.info('[CronScheduler] All jobs stopped');
  }

  /** Get status for a specific job */
  getStatus(name: string): CronStatus | undefined {
    return this.statuses.get(name);
  }

  /** Get all statuses */
  getAllStatuses(): CronStatus[] {
    return Array.from(this.statuses.values());
  }

  /** Get dead letter queue */
  getDeadLetters(): DeadLetter[] {
    return [...this.deadLetters];
  }

  /** Clear dead letters */
  clearDeadLetters(): void {
    this.deadLetters = [];
  }

  /** Manually trigger a job */
  async triggerJob(name: string): Promise<void> {
    await this.executeJob(name);
  }
}

// ── Singleton ──────────────────────────────────────────────

const scheduler = new CronScheduler();

// ── Pre-configured jobs ─────────────────────────────────────

/** Reconciliation job: runs daily at startup, then every 24h */
export async function reconciliationRun(): Promise<void> {
  try {
    const { getReconciliationEngine } = await import('../engine/data/reconciliation-engine');
    const recon = getReconciliationEngine();
    const result = recon.reconcile();
    log.info(`[Cron:Reconciliation] Result: pass=${result.pass}, diff=${result.diff?.toFixed(6)}`);
  } catch (err: unknown) {
    log.error(`[Cron:Reconciliation] Failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

/** Exchange rate refresh job: fetches fresh rates every 6h */
export async function exchangeRateRun(): Promise<void> {
  try {
    const { ExchangeRateEngine } = await import('../engine/data/exchange-rate-engine');
    const engine = new ExchangeRateEngine();
    const rates = await engine.refresh();
    log.info(`[Cron:ExchangeRate] Refreshed ${Object.keys(rates).length} rates, source: ${engine.getSource()}`);
  } catch (err: unknown) {
    log.error(`[Cron:ExchangeRate] Failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

// ── Health check ────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES = 3;

/** Check if exchange rate refresh is healthy */
export function isExchangeRateHealthy(): { healthy: boolean; message: string } {
  const status = scheduler.getStatus('exchangeRate');
  if (!status) return { healthy: true, message: 'Exchange rate job not registered' };
  if (status.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    return { healthy: false, message: `Exchange rate refresh failed ${status.consecutiveFailures} times consecutively. Check network/API.` };
  }
  return { healthy: true, message: 'Exchange rate refresh OK' };
}

/** Get last exchange rate update timestamp */
export function getLastExchangeRateUpdate(): number | null {
  return scheduler.getStatus('exchangeRate')?.lastSuccess ?? null;
}

// ── Initialize default jobs ─────────────────────────────────

export function initCronScheduler(): CronScheduler {
  // Register reconciliation (daily = 86400000ms)
  scheduler.register({
    name: 'reconciliation',
    intervalMs: 24 * 60 * 60 * 1000, // 24h
    handler: reconciliationRun,
    maxRetries: 3,
    retryDelayMs: 60 * 60 * 1000, // 1h between retries
    enabled: true,
  });

  // Register exchange rate refresh (every 6h)
  scheduler.register({
    name: 'exchangeRate',
    intervalMs: 6 * 60 * 60 * 1000, // 6h
    handler: exchangeRateRun,
    maxRetries: 3,
    retryDelayMs: 15 * 60 * 1000, // 15min between retries
    enabled: true,
  });

  return scheduler;
}

export { scheduler as cronScheduler };
export default CronScheduler;
