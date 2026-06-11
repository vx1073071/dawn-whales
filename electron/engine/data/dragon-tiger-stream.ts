// ── JVS-22 (PM): Dragon Tiger Real-time Stream ────────────────────────────
// Auto-fetch dragon tiger data every trading day at 16:00
// Push events to IPC: dragon-tiger:update

import log from 'electron-log';
import { getDragonTigerList } from './dragon-tiger-list';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface DragonTigerStreamConfig {
  fetchHour?: number;       // Default: 16 (4 PM)
  fetchMinute?: number;     // Default: 0
  enabled?: boolean;
}

export interface DragonTigerUpdateEvent {
  date: string;
  entries: any[];
  total: number;
  fetchedAt: number;
}

// ── Stream Service ─────────────────────────────────────────────────────────

export class DragonTigerStream {
  private config: Required<DragonTigerStreamConfig>;
  private timer: NodeJS.Timeout | null = null;
  private listeners: ((event: DragonTigerUpdateEvent) => void)[] = [];
  private lastFetch: string | null = null;

  constructor(config?: DragonTigerStreamConfig) {
    this.config = {
      fetchHour: config?.fetchHour ?? 16,
      fetchMinute: config?.fetchMinute ?? 0,
      enabled: config?.enabled ?? true,
    };
    log.info(`[DragonTigerStream] Initialized, fetch at ${this.config.fetchHour}:${String(this.config.fetchMinute).padStart(2, '0')}`);
  }

  on(event: 'update', listener: (data: DragonTigerUpdateEvent) => void): void {
    if (event === 'update') {
      this.listeners.push(listener);
    }
  }

  off(event: 'update', listener: (data: DragonTigerUpdateEvent) => void): void {
    if (event === 'update') {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  }

  start(): void {
    if (this.timer) return;
    if (!this.config.enabled) return;

    // Check every 60 seconds if it's time to fetch
    this.timer = setInterval(() => this.checkAndFetch(), 60000);
    log.info('[DragonTigerStream] Started periodic check');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('[DragonTigerStream] Stopped');
    }
  }

  async fetchNow(): Promise<DragonTigerUpdateEvent | null> {
    try {
      const result = await getDragonTigerList();
      if (result.success && result.entries.length > 0) {
        const event: DragonTigerUpdateEvent = {
          date: result.date,
          entries: result.entries,
          total: result.total,
          fetchedAt: Date.now(),
        };
        this.lastFetch = result.date;
        this.listeners.forEach(l => l(event));
        log.info(`[DragonTigerStream] Fetched ${result.total} entries for ${result.date}`);
        return event;
      }
    } catch (err: unknown) {
      log.error('[DragonTigerStream] Fetch error:', err.message);
    }
    return null;
  }

  private checkAndFetch(): void {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const today = now.toISOString().split('T')[0];

    // Skip if already fetched today
    if (this.lastFetch === today) return;

    // Check if it's fetch time (or past it on trading day)
    if (hour === this.config.fetchHour && minute >= this.config.fetchMinute && minute < this.config.fetchMinute + 5) {
      // Skip weekends
      const day = now.getDay();
      if (day === 0 || day === 6) return;

      this.fetchNow();
    }
  }

  getStatus(): { running: boolean; lastFetch: string | null; config: Required<DragonTigerStreamConfig> } {
    return {
      running: this.timer !== null,
      lastFetch: this.lastFetch,
      config: this.config,
    };
  }
}

let instance: DragonTigerStream | null = null;

export function getDragonTigerStream(): DragonTigerStream {
  if (!instance) {
    instance = new DragonTigerStream();
  }
  return instance;
}
