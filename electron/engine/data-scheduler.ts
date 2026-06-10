// ── Data Scheduler — Periodic Data Refresh Service ─────────────────────────
// Automatically refreshes market data during trading hours
// Ensures fresh data for heatmap, macro, sentiment, anomaly, and rotation

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  // Trading hours (24h format, Asia/Shanghai timezone)
  tradingStartHour: number;    // Default: 9
  tradingStartMinute: number;  // Default: 15
  tradingEndHour: number;      // Default: 15
  tradingEndMinute: number;    // Default: 5

  // Refresh intervals (milliseconds)
  heatmapIntervalMs: number;   // Default: 5 min (trading), 30 min (idle)
  macroIntervalMs: number;     // Default: 60 min
  sentimentIntervalMs: number; // Default: 10 min (trading), 30 min (idle)
  anomalyIntervalMs: number;   // Default: 30 sec (trading)
  rotationIntervalMs: number;  // Default: 30 min (trading)
  newsIntervalMs: number;      // Default: 15 min
  hotspotIntervalMs: number;   // Default: 15 min

  enabled: boolean;
}

export interface SchedulerStatus {
  running: boolean;
  enabled: boolean;
  lastRefresh: Record<string, number>;   // module -> timestamp
  nextRefresh: Record<string, number>;   // module -> timestamp
  refreshCount: Record<string, number>;  // module -> count
  isTradingHours: boolean;
  uptime: number;
}

export type RefreshCallback = () => Promise<void>;

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SchedulerConfig = {
  tradingStartHour: 9,
  tradingStartMinute: 15,
  tradingEndHour: 15,
  tradingEndMinute: 5,

  heatmapIntervalMs: 5 * 60 * 1000,
  macroIntervalMs: 60 * 60 * 1000,
  sentimentIntervalMs: 10 * 60 * 1000,
  anomalyIntervalMs: 30 * 1000,
  rotationIntervalMs: 30 * 60 * 1000,
  newsIntervalMs: 15 * 60 * 1000,
  hotspotIntervalMs: 15 * 60 * 1000,

  enabled: true,
};

// ── Data Scheduler Service ─────────────────────────────────────────────────

export class DataSchedulerService {
  private config: SchedulerConfig;
  private timers = new Map<string, NodeJS.Timeout>();
  private callbacks = new Map<string, RefreshCallback>();
  private lastRefresh = new Map<string, number>();
  private refreshCount = new Map<string, number>();
  private running = false;
  private startTime = 0;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[DataScheduler] Initialized, enabled:', this.config.enabled);
  }

  /**
   * Register a refresh callback for a data module
   */
  register(module: string, callback: RefreshCallback): void {
    this.callbacks.set(module, callback);
    this.refreshCount.set(module, 0);
    log.info(`[DataScheduler] Registered: ${module}`);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    if (!this.config.enabled) {
      log.info('[DataScheduler] Disabled, not starting');
      return;
    }

    this.running = true;
    this.startTime = Date.now();
    log.info(`[DataScheduler] Starting with ${this.callbacks.size} modules`);

    // Schedule each module
    for (const [module] of this.callbacks) {
      this.scheduleModule(module);
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;
    for (const [module, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();
    log.info('[DataScheduler] Stopped');
  }

  /**
   * Get current status
   */
  getStatus(): SchedulerStatus {
    const now = Date.now();
    const lastRefreshObj: Record<string, number> = {};
    const nextRefreshObj: Record<string, number> = {};
    const refreshCountObj: Record<string, number> = {};

    for (const [module, ts] of this.lastRefresh) {
      lastRefreshObj[module] = ts;
    }

    for (const [module] of this.callbacks) {
      const interval = this.getInterval(module);
      const last = this.lastRefresh.get(module) || 0;
      nextRefreshObj[module] = last + interval;
      refreshCountObj[module] = this.refreshCount.get(module) || 0;
    }

    return {
      running: this.running,
      enabled: this.config.enabled,
      lastRefresh: lastRefreshObj,
      nextRefresh: nextRefreshObj,
      refreshCount: refreshCountObj,
      isTradingHours: this.isTradingHours(),
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Manually trigger a refresh for a module
   */
  async refreshNow(module: string): Promise<boolean> {
    const callback = this.callbacks.get(module);
    if (!callback) return false;

    try {
      await callback();
      this.lastRefresh.set(module, Date.now());
      this.refreshCount.set(module, (this.refreshCount.get(module) || 0) + 1);
      log.info(`[DataScheduler] Manual refresh: ${module}`);
      return true;
    } catch (err: unknown) {
      log.warn(`[DataScheduler] Manual refresh failed: ${module}`, err.message);
      return false;
    }
  }

  /**
   * Refresh all modules immediately
   */
  async refreshAll(): Promise<void> {
    log.info('[DataScheduler] Refreshing all modules...');
    const promises = Array.from(this.callbacks.keys()).map(module =>
      this.refreshNow(module).catch(err =>
        log.warn(`[DataScheduler] Refresh failed: ${module}`, err.message)
      )
    );
    await Promise.allSettled(promises);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };

    if (!config.enabled && this.running) {
      this.stop();
    } else if (config.enabled && !this.running) {
      this.start();
    }

    // Reschedule if intervals changed
    if (this.running) {
      for (const [module] of this.callbacks) {
        this.rescheduleModule(module);
      }
    }
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  private scheduleModule(module: string): void {
    const interval = this.getInterval(module);

    const timer = setInterval(async () => {
      if (!this.running) return;
      await this.executeRefresh(module);
    }, interval);

    this.timers.set(module, timer);

    // Also do an immediate refresh on start
    setTimeout(() => {
      if (this.running) this.executeRefresh(module);
    }, Math.random() * 5000); // Stagger initial refreshes
  }

  private rescheduleModule(module: string): void {
    const existing = this.timers.get(module);
    if (existing) clearInterval(existing);
    this.scheduleModule(module);
  }

  private async executeRefresh(module: string): Promise<void> {
    const callback = this.callbacks.get(module);
    if (!callback) return;

    try {
      await callback();
      this.lastRefresh.set(module, Date.now());
      this.refreshCount.set(module, (this.refreshCount.get(module) || 0) + 1);
    } catch (err: unknown) {
      log.warn(`[DataScheduler] Refresh error: ${module}`, err.message);
    }
  }

  private getInterval(module: string): number {
    const trading = this.isTradingHours();

    switch (module) {
      case 'heatmap':
        return trading ? this.config.heatmapIntervalMs : this.config.heatmapIntervalMs * 6;
      case 'macro':
        return this.config.macroIntervalMs;
      case 'sentiment':
        return trading ? this.config.sentimentIntervalMs : this.config.sentimentIntervalMs * 3;
      case 'anomaly':
        return trading ? this.config.anomalyIntervalMs : this.config.anomalyIntervalMs * 10;
      case 'rotation':
        return trading ? this.config.rotationIntervalMs : this.config.rotationIntervalMs * 2;
      case 'news':
        return trading ? this.config.newsIntervalMs : this.config.newsIntervalMs * 2;
      case 'hotspot':
        return trading ? this.config.hotspotIntervalMs : this.config.hotspotIntervalMs * 2;
      default:
        return 5 * 60 * 1000; // Default 5 min
    }
  }

  private isTradingHours(): boolean {
    // Use Asia/Shanghai time
    const now = new Date();
    const shanghaiOffset = 8 * 60; // UTC+8
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const shanghaiMinutes = (utcMinutes + shanghaiOffset) % (24 * 60);

    const start = this.config.tradingStartHour * 60 + this.config.tradingStartMinute;
    const end = this.config.tradingEndHour * 60 + this.config.tradingEndMinute;

    // Also check weekday
    const day = now.getUTCDay();
    // Convert UTC day to Shanghai day (rough approximation)
    const shanghaiDay = shanghaiMinutes < utcMinutes
      ? (day + 1) % 7
      : day;
    if (shanghaiDay === 0 || shanghaiDay === 6) return false; // Weekend

    return shanghaiMinutes >= start && shanghaiMinutes <= end;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let schedulerInstance: DataSchedulerService | null = null;

export function getDataScheduler(): DataSchedulerService {
  if (!schedulerInstance) {
    schedulerInstance = new DataSchedulerService();
  }
  return schedulerInstance;
}
