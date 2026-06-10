/**
 * J-80-04: 7市场数据新鲜度监控 G8
 * v1.9.0 GA — Data freshness monitoring for all 7 markets
 *
 * Alert: >5min stale → warning
 * API: /api/data/freshness returns 7-market timestamps
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type MarketCode = 'US' | 'HK' | 'CN' | 'JP' | 'UK' | 'EU' | 'CRYPTO';

export interface MarketFreshness {
  market: MarketCode;
  label: string;
  lastUpdate: number | null;
  delayMs: number;
  isStale: boolean;
  status: 'healthy' | 'stale' | 'offline' | 'unknown';
  lastError: string | null;
}

export interface FreshnessReport {
  generatedAt: number;
  markets: MarketFreshness[];
  summary: {
    total: number;
    healthy: number;
    stale: number;
    offline: number;
    unknown: number;
    maxDelay: number;
    maxDelayMarket: MarketCode | null;
  };
}

// ── Constants ──────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

const MARKET_LABELS: Record<MarketCode, string> = {
  US: '美股',
  HK: '港股',
  CN: 'A股',
  JP: '日股',
  UK: '英股',
  EU: '欧股',
  CRYPTO: '加密',
};

// ── Engine ─────────────────────────────────────────────────────────────────

export class DataFreshnessMonitor {
  private markets = new Map<MarketCode, { lastUpdate: number | null; lastError: string | null }>();
  private listeners: Array<(report: FreshnessReport) => void> = [];

  constructor() {
    for (const m of Object.keys(MARKET_LABELS) as MarketCode[]) {
      this.markets.set(m, { lastUpdate: null, lastError: null });
    }
  }

  /** Update data freshness for a market */
  updateMarket(market: MarketCode, timestamp = Date.now()): void {
    if (!this.markets.has(market)) return;
    const m = this.markets.get(market)!;
    m.lastUpdate = timestamp;
    m.lastError = null;
  }

  /** Record an error for a market (doesn't clear lastUpdate) */
  recordError(market: MarketCode, error: string): void {
    if (!this.markets.has(market)) return;
    const m = this.markets.get(market)!;
    m.lastError = error;
  }

  /** Get the last update time for a market */
  getLastUpdate(market: MarketCode): number | null {
    return this.markets.get(market)?.lastUpdate ?? null;
  }

  /** Check if a market is stale (>5min since last update) */
  isMarketStale(market: MarketCode, now = Date.now()): boolean {
    const lu = this.getLastUpdate(market);
    if (lu === null) return true;
    return now - lu > STALE_THRESHOLD_MS;
  }

  /** Generate full freshness report */
  generateReport(now = Date.now()): FreshnessReport {
    const markets: MarketFreshness[] = [];

    for (const [code, data] of this.markets.entries()) {
      const delayMs = data.lastUpdate !== null ? now - data.lastUpdate : Infinity;
      let status: MarketFreshness['status'];

      if (data.lastUpdate === null) {
        status = 'unknown';
      } else if (delayMs > OFFLINE_THRESHOLD_MS) {
        status = 'offline';
      } else if (delayMs > STALE_THRESHOLD_MS) {
        status = 'stale';
      } else {
        status = 'healthy';
      }

      markets.push({
        market: code,
        label: MARKET_LABELS[code],
        lastUpdate: data.lastUpdate,
        delayMs: data.lastUpdate !== null ? Math.round(delayMs) : -1,
        isStale: delayMs > STALE_THRESHOLD_MS,
        status,
        lastError: data.lastError,
      });
    }

    const summary = {
      total: markets.length,
      healthy: markets.filter((m) => m.status === 'healthy').length,
      stale: markets.filter((m) => m.status === 'stale').length,
      offline: markets.filter((m) => m.status === 'offline').length,
      unknown: markets.filter((m) => m.status === 'unknown').length,
      maxDelay: 0,
      maxDelayMarket: null as MarketCode | null,
    };

    for (const m of markets) {
      if (m.delayMs > summary.maxDelay && m.delayMs > 0) {
        summary.maxDelay = m.delayMs;
        summary.maxDelayMarket = m.market;
      }
    }

    const report: FreshnessReport = {
      generatedAt: now,
      markets,
      summary,
    };

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch {
        /* ignore */
      }
    }

    return report;
  }

  /** Add a report listener */
  onReport(listener: (report: FreshnessReport) => void): void {
    this.listeners.push(listener);
  }

  /** Remove a listener */
  offReport(listener: (report: FreshnessReport) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  /** Get stale markets (for alerting) */
  getStaleMarkets(now = Date.now()): MarketFreshness[] {
    return this.generateReport(now).markets.filter((m) => m.status === 'stale' || m.status === 'offline');
  }

  /** Reset all data */
  reset(): void {
    for (const m of this.markets.values()) {
      m.lastUpdate = null;
      m.lastError = null;
    }
    this.listeners = [];
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: DataFreshnessMonitor | null = null;

export function getFreshnessMonitor(): DataFreshnessMonitor {
  if (!instance) instance = new DataFreshnessMonitor();
  return instance;
}

export function resetFreshnessMonitor(): void {
  instance?.reset();
  instance = null;
}

export { MARKET_LABELS, STALE_THRESHOLD_MS, OFFLINE_THRESHOLD_MS };

export default { DataFreshnessMonitor, getFreshnessMonitor, resetFreshnessMonitor, MARKET_LABELS };
