// ── IC Worker: Real-time IC/IR Background Calculation Engine (R159 P0-D4) ──
// Daily after-close 252-day rolling IC + EMA smoothing + IC failure alerts
// IPC: ic:start, ic:stop, ic:status, ic:query, ic:history

import { FactorResearchEngine, ICResult } from './factor-research-engine';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ICWorkerConfig {
  /** Markets to monitor */
  markets: string[];
  /** Lookback window in days (default 252 = 1 trading year) */
  rollingWindow: number;
  /** EMA smoothing alpha (0-1, default 0.05 = ~40-day effective window) */
  emaAlpha: number;
  /** IC failure threshold: if EMA-smoothed |IC| drops below this, alert fires */
  failureThreshold: number;
  /** Consecutive days below threshold before alert triggers */
  failureConsecutiveDays: number;
  /** Schedule: time-of-day to run (minutes after midnight UTC) */
  scheduleHour: number;
  scheduleMinute: number;
}

export const DEFAULT_IC_WORKER_CONFIG: ICWorkerConfig = {
  markets: ['HKEX', 'NYSE', 'NASDAQ', 'CRYPTO'],
  rollingWindow: 252,
  emaAlpha: 0.05,
  failureThreshold: 0.01,
  failureConsecutiveDays: 5,
  scheduleHour: 22,  // 22:00 UTC = next day 06:00 HKT (Asia close) / 17:00 EST (US close observed)
  scheduleMinute: 0,
};

export interface ICDailyRecord {
  date: string;
  factorName: string;
  market: string;
  rankIC: number;
  pearsonIC: number;
  emaRankIC: number;        // EMA-smoothed rank IC
  emaPearsonIC: number;      // EMA-smoothed pearson IC
  IR: number;
  tStat: number;
  hitRate: number;
  halfLife: number;
  crowding: number;
  observations: number;
  alertLevel: 'none' | 'watch' | 'warning' | 'critical';
  alertReason?: string;
}

export interface ICWorkerStatus {
  running: boolean;
  markets: string[];
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalCalculations: number;
  activeAlerts: ICAlert[];
  failureCount: Record<string, number>; // factorName -> consecutive failure days
}

export interface ICAlert {
  factorName: string;
  market: string;
  level: 'watch' | 'warning' | 'critical';
  reason: string;
  detectedAt: string;
  currentEMAIC: number;
  threshold: number;
}

export interface ICQueryParams {
  factorName?: string;
  market?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// ── IC Worker Engine ──────────────────────────────────────────────────────

export class ICWorker {
  private engine: FactorResearchEngine;
  private config: ICWorkerConfig;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private history: ICDailyRecord[] = [];
  private emaState: Map<string, { rankEma: number; pearsonEma: number }> = new Map();
  private failureCount: Map<string, number> = new Map();
  private lastRunAt: string | null = null;
  private totalCalculations = 0;
  private activeAlerts: ICAlert[] = [];
  private dataProvider: ICDataProvider | null = null;

  constructor(config: Partial<ICWorkerConfig> = {}) {
    this.engine = new FactorResearchEngine();
    this.config = { ...DEFAULT_IC_WORKER_CONFIG, ...config };
  }

  /** Set an external data provider for factor values and forward returns */
  setDataProvider(provider: ICDataProvider): void {
    this.dataProvider = provider;
  }

  /** Start the background worker */
  start(): ICWorkerStatus {
    if (this.running) {
      log.warn('[ICWorker] Already running');
      return this.getStatus();
    }

    this.running = true;
    log.info('[ICWorker] Started — markets:', this.config.markets.join(','),
      'window:', this.config.rollingWindow, 'd',
      'schedule:', `${this.config.scheduleHour}:${String(this.config.scheduleMinute).padStart(2, '0')} UTC`);

    // Schedule daily run
    this.scheduleNextRun();

    return this.getStatus();
  }

  /** Stop the background worker */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info('[ICWorker] Stopped');
  }

  /** Get current worker status */
  getStatus(): ICWorkerStatus {
    return {
      running: this.running,
      markets: [...this.config.markets],
      lastRunAt: this.lastRunAt,
      nextRunAt: this.calculateNextRunTime(),
      totalCalculations: this.totalCalculations,
      activeAlerts: [...this.activeAlerts],
      failureCount: Object.fromEntries(this.failureCount),
    };
  }

  /** Query IC history */
  queryHistory(params: ICQueryParams = {}): ICDailyRecord[] {
    let results = [...this.history];

    if (params.factorName) {
      results = results.filter((r) => r.factorName === params.factorName);
    }
    if (params.market) {
      results = results.filter((r) => r.market === params.market);
    }
    if (params.dateFrom) {
      results = results.filter((r) => r.date >= params.dateFrom!);
    }
    if (params.dateTo) {
      results = results.filter((r) => r.date <= params.dateTo!);
    }

    // Most recent first
    results.sort((a, b) => b.date.localeCompare(a.date));

    if (params.limit && params.limit > 0) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  /** Manually trigger a calculation run (for testing / on-demand) */
  async runNow(): Promise<ICDailyRecord[]> {
    log.info('[ICWorker] Manual run triggered');
    return this.executeDailyRun();
  }

  /** Inject historical data for backfilling */
  injectHistory(records: ICDailyRecord[]): void {
    this.history.push(...records);
    // Rebuild EMA state from history
    this.rebuildEMAState();
    // Re-evaluate alerts
    this.evaluateAlerts();
    this.totalCalculations += records.length;
    log.info('[ICWorker] Injected', records.length, 'historical records');
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private scheduleNextRun(): void {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(this.config.scheduleHour, this.config.scheduleMinute, 0, 0);

    if (next <= now) {
      // Already past today's schedule time → schedule for tomorrow
      next.setUTCDate(next.getUTCDate() + 1);
    }

    const delayMs = next.getTime() - now.getTime();
    log.info('[ICWorker] Next run scheduled for:', next.toISOString(),
      `(in ${Math.round(delayMs / 60000)} min)`);

    // For daily scheduling, use a check every 60 seconds
    // In production, this would use a proper cron/scheduler
    this.timer = setInterval(() => {
      const now2 = new Date();
      const todaySchedule = new Date(now2);
      todaySchedule.setUTCHours(this.config.scheduleHour, this.config.scheduleMinute, 0, 0);

      // Check if we're within 1 minute of scheduled time and haven't run today yet
      if (Math.abs(now2.getTime() - todaySchedule.getTime()) < 60000) {
        const todayStr = now2.toISOString().split('T')[0];
        if (this.lastRunAt !== todayStr) {
          this.executeDailyRun().catch((err) => {
            log.error('[ICWorker] Daily run failed:', err);
          });
        }
      }
    }, 60000);
  }

  private calculateNextRunTime(): string | null {
    if (!this.running) return null;
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(this.config.scheduleHour, this.config.scheduleMinute, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.toISOString();
  }

  private async executeDailyRun(): Promise<ICDailyRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    this.lastRunAt = today;
    const newRecords: ICDailyRecord[] = [];

    for (const market of this.config.markets) {
      if (!this.dataProvider) {
        log.warn('[ICWorker] No data provider set, skipping market:', market);
        continue;
      }

      try {
        const factors = this.dataProvider.getAvailableFactors(market);
        for (const factorId of factors) {
          const { factorValues, forwardReturns, dates } =
            this.dataProvider.getFactorData(factorId, market, this.config.rollingWindow);

          if (factorValues.length < 20) {
            log.debug('[ICWorker] Insufficient data for', factorId, 'in', market,
              `(${factorValues.length} < 20)`);
            continue;
          }

          // Compute raw IC via FactorResearchEngine
          const icResult = this.engine.computeIC(factorId, factorValues, forwardReturns, dates);

          // EMA smoothing
          const emaKey = `${market}:${factorId}`;
          const prevEma = this.emaState.get(emaKey) ?? { rankEma: icResult.rankIC, pearsonEma: icResult.pearsonIC };
          const alpha = this.config.emaAlpha;

          const emaRankIC = prevEma.rankEma === 0
            ? icResult.rankIC
            : alpha * icResult.rankIC + (1 - alpha) * prevEma.rankEma;
          const emaPearsonIC = prevEma.pearsonEma === 0
            ? icResult.pearsonIC
            : alpha * icResult.pearsonIC + (1 - alpha) * prevEma.pearsonIC;

          this.emaState.set(emaKey, { rankEma: emaRankIC, pearsonEma: emaPearsonIC });

          // IC failure detection
          const alertInfo = this.evaluateAlert(factorId, market, emaRankIC);

          const record: ICDailyRecord = {
            date: today,
            factorName: factorId,
            market,
            rankIC: icResult.rankIC,
            pearsonIC: icResult.pearsonIC,
            emaRankIC: Number(emaRankIC.toFixed(6)),
            emaPearsonIC: Number(emaPearsonIC.toFixed(6)),
            IR: icResult.IR,
            tStat: icResult.tStat,
            hitRate: icResult.hitRate,
            halfLife: icResult.halfLife,
            crowding: icResult.crowding,
            observations: icResult.observations,
            alertLevel: alertInfo.level,
            alertReason: alertInfo.reason,
          };

          newRecords.push(record);
          this.totalCalculations++;
        }
      } catch (err) {
        log.error('[ICWorker] Error processing market', market, ':', err);
      }
    }

    // Store in history
    this.history.push(...newRecords);

    // Re-evaluate all alerts
    this.evaluateAlerts();

    log.info('[ICWorker] Daily run complete:', newRecords.length, 'records across',
      this.config.markets.length, 'markets');
    return newRecords;
  }

  private evaluateAlert(
    factorId: string,
    market: string,
    emaRankIC: number,
  ): { level: ICAlert['level']; reason?: string } {
    const key = `${market}:${factorId}`;
    const absEmaIC = Math.abs(emaRankIC);

    // Track consecutive failures
    if (absEmaIC < this.config.failureThreshold) {
      const count = (this.failureCount.get(key) ?? 0) + 1;
      this.failureCount.set(key, count);

      if (count >= this.config.failureConsecutiveDays) {
        return {
          level: 'critical',
          reason: `EMA |IC| = ${absEmaIC.toFixed(4)} < ${this.config.failureThreshold} for ${count} consecutive days. Factor may have decayed.`,
        };
      } else if (count >= Math.ceil(this.config.failureConsecutiveDays * 0.6)) {
        return {
          level: 'warning',
          reason: `EMA |IC| declining: ${absEmaIC.toFixed(4)} (${count}/${this.config.failureConsecutiveDays} days)`,
        };
      } else {
        return {
          level: 'watch',
          reason: `EMA |IC| below threshold: ${absEmaIC.toFixed(4)}`,
        };
      }
    } else {
      // Reset failure count on recovery
      this.failureCount.set(key, 0);
      return { level: 'none' };
    }
  }

  private evaluateAlerts(): void {
    this.activeAlerts = [];

    for (const [key, count] of this.failureCount.entries()) {
      if (count === 0) continue;
      const [market, factorName] = key.split(':');
      if (!factorName) continue;

      const emaState = this.emaState.get(key);
      const currentEMAIC = emaState?.rankEma ?? 0;

      let level: ICAlert['level'] = 'watch';
      let reason = '';

      if (count >= this.config.failureConsecutiveDays) {
        level = 'critical';
        reason = `EMA |IC| has been below ${this.config.failureThreshold} for ${count} consecutive days. Factor ${factorName} in ${market} may have decayed significantly. Consider removing or reducing weight.`;
      } else if (count >= Math.ceil(this.config.failureConsecutiveDays * 0.6)) {
        level = 'warning';
        reason = `EMA |IC| declining for ${count}/${this.config.failureConsecutiveDays} days. Monitor closely.`;
      } else {
        reason = `EMA |IC| = ${currentEMAIC.toFixed(4)} below threshold ${this.config.failureThreshold}`;
      }

      this.activeAlerts.push({
        factorName,
        market,
        level,
        reason,
        detectedAt: new Date().toISOString(),
        currentEMAIC,
        threshold: this.config.failureThreshold,
      });
    }

    // Sort: critical first, then warning, then watch
    this.activeAlerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, watch: 2 };
      return (order[a.level] ?? 3) - (order[b.level] ?? 3);
    });
  }

  private rebuildEMAState(): void {
    this.emaState.clear();
    const sorted = [...this.history].sort((a, b) => a.date.localeCompare(b.date));
    for (const r of sorted) {
      const key = `${r.market}:${r.factorName}`;
      this.emaState.set(key, { rankEma: r.emaRankIC, pearsonEma: r.emaPearsonIC });
    }
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.stop();
    this.history = [];
    this.emaState.clear();
    this.failureCount.clear();
    this.activeAlerts = [];
    this.lastRunAt = null;
    this.totalCalculations = 0;
    this.dataProvider = null;
    log.info('[ICWorker] Reset complete');
  }
}

// ── Data Provider Interface ────────────────────────────────────────────────

/**
 * External data source that supplies factor values and forward returns.
 * Implementations can pull from Futu OpenD, Binance API, local K-line DB, etc.
 */
export interface ICDataProvider {
  /** List all factor IDs available for a given market */
  getAvailableFactors(market: string): string[];

  /** Get factor values and forward returns for computing IC */
  getFactorData(
    factorId: string,
    market: string,
    lookbackDays: number,
  ): {
    factorValues: number[];
    forwardReturns: number[];
    dates: string[];
  };
}

// ── IPC-Compatible Factory ─────────────────────────────────────────────────

let _defaultWorker: ICWorker | null = null;

export function getICWorker(): ICWorker {
  if (!_defaultWorker) {
    _defaultWorker = new ICWorker();
  }
  return _defaultWorker;
}

export function createICWorker(config?: Partial<ICWorkerConfig>): ICWorker {
  return new ICWorker(config);
}

export { getICWorker as default };
