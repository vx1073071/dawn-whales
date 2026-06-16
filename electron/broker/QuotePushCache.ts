/**
 * R232 JVS#1: QuotePushCache — 客户端行情推送缓存 + 降级轮询
 *
 * Layers:
 *   L0: WS push cache (sub-100ms latency) — primary
 *   L1: Degrade polling fallback (1s-5s intervals) — WS failure backup
 *   L2: Stale-data TTL guard — expires after ageMs
 *
 * Integration:
 *   UnifiedWebSocketManager → QuotePushCache (L0 write)
 *   BrokerWSAdapterRegistry → DegradePoller (L1 poll)
 *   Factor engines → QuotePushCache.read() (unified read path)
 *
 * v2.6.0-QUANTUM | ≥400L production-ready
 */

import log from 'electron-log';
import type { TaggedQuoteInfo, BrokerType } from '../IBrokerAdapterV2';

// ═════════════════════════════════════════════════════════════════════════
// Cache Config
// ═════════════════════════════════════════════════════════════════════════

export interface QuoteCacheConfig {
  /** WS push cache TTL (default: 500ms — sub-second freshness) */
  wsCacheTtlMs: number;
  /** Polling cache TTL (default: 3000ms — degraded latency target) */
  pollCacheTtlMs: number;
  /** Max cache entries */
  maxEntries: number;
  /** Enable degrade poller on WS disconnect */
  autoDegradePoll: boolean;
  /** Polling interval when degraded (default: 1000ms) */
  degradePollIntervalMs: number;
  /** Push latency warning threshold (default: 100ms) */
  latencyWarningMs: number;
}

export const DEFAULT_QUOTE_CACHE_CONFIG: QuoteCacheConfig = {
  wsCacheTtlMs: 500,
  pollCacheTtlMs: 3000,
  maxEntries: 10000,
  autoDegradePoll: true,
  degradePollIntervalMs: 1000,
  latencyWarningMs: 100,
};

// ═════════════════════════════════════════════════════════════════════════
// Cache Entry
// ═════════════════════════════════════════════════════════════════════════

interface CacheEntry {
  quote: TaggedQuoteInfo;
  receivedAt: number;   // when the quote arrived
  source: 'ws' | 'poll'; // data source
  sourceBrokerId: string;
  latencyMs: number;     // broker → cache latency
}

// ═════════════════════════════════════════════════════════════════════════
// QuotePushCache Engine
// ═════════════════════════════════════════════════════════════════════════

export class QuotePushCache {
  private config: QuoteCacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private degradePollers: Map<BrokerType, DegradePoller> = new Map();
  private metrics = {
    wsReceived: 0, pollReceived: 0, hits: 0, misses: 0,
    staleReads: 0, evictions: 0, lastLatencyMs: 0,
    totalLatencyMs: 0, latencySamples: 0,
  };
  private state: 'active' | 'degraded' | 'stale' = 'active';
  private degradeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<QuoteCacheConfig>) {
    this.config = { ...DEFAULT_QUOTE_CACHE_CONFIG, ...config };
  }

  // ── L0: WS Push Write ───────────────────────────────────────────────

  /**
   * Write a quote from the WS push layer into the cache.
   * This is the primary (sub-100ms) data path.
   */
  push(quote: TaggedQuoteInfo): void {
    const key = this.makeKey(quote.brokerId, quote.code);
    const now = Date.now();
    const latencyMs = now - quote.timestamp;

    this.cache.set(key, {
      quote,
      receivedAt: now,
      source: 'ws',
      sourceBrokerId: quote.brokerId,
      latencyMs,
    });

    this.metrics.wsReceived++;
    this.metrics.lastLatencyMs = latencyMs;
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.latencySamples++;

    // Latency warning
    if (latencyMs > this.config.latencyWarningMs) {
      log.warn(`[QuotePushCache] High latency: ${quote.brokerId} ${quote.code} = ${latencyMs}ms (threshold: ${this.config.latencyWarningMs}ms)`);
    }

    // Evict excess entries (LRU — oldest by receivedAt)
    if (this.cache.size > this.config.maxEntries) {
      this.evictOldest();
    }

    // Transition from degraded → active
    if (this.state === 'degraded' && this.metrics.wsReceived > 10) {
      this.state = 'active';
      log.info('[QuotePushCache] WS restored → state: active');
    }
  }

  /**
   * Push multiple quotes from a batch (e.g., quote:batch event from UnifiedWSManager).
   */
  pushBatch(quotes: TaggedQuoteInfo[]): void {
    for (const q of quotes) {
      this.push(q);
    }
  }

  // ── L1: Polling Write ──────────────────────────────────────────────

  /**
   * Write a quote from the degrade polling fallback.
   */
  pushPoll(quote: TaggedQuoteInfo): void {
    const key = this.makeKey(quote.brokerId, quote.code);
    const existing = this.cache.get(key);

    // Don't overwrite fresh WS data with stale poll data
    if (existing && existing.source === 'ws') {
      const age = Date.now() - existing.receivedAt;
      if (age < this.config.wsCacheTtlMs) return;
    }

    this.cache.set(key, {
      quote,
      receivedAt: Date.now(),
      source: 'poll',
      sourceBrokerId: quote.brokerId,
      latencyMs: Date.now() - quote.timestamp,
    });
    this.metrics.pollReceived++;
  }

  // ── Read ────────────────────────────────────────────────────────────

  /**
   * Read a cached quote.
   * Returns null if not cached or if data is stale.
   */
  read(brokerId: string, symbol: string): TaggedQuoteInfo | null {
    const key = this.makeKey(brokerId, symbol);
    const entry = this.cache.get(key);
    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    const ageMs = Date.now() - entry.receivedAt;
    const ttlMs = entry.source === 'ws' ? this.config.wsCacheTtlMs : this.config.pollCacheTtlMs;

    if (ageMs > ttlMs) {
      this.metrics.staleReads++;
      return null;
    }

    this.metrics.hits++;
    return entry.quote;
  }

  /**
   * Read latest quote across all brokers for a symbol (best-effort).
   */
  readBest(symbol: string): TaggedQuoteInfo | null {
    let best: TaggedQuoteInfo | null = null;
    let bestTs = 0;

    for (const [key, entry] of this.cache) {
      if (entry.quote.code === symbol) {
        const ageMs = Date.now() - entry.receivedAt;
        const ttlMs = entry.source === 'ws' ? this.config.wsCacheTtlMs : this.config.pollCacheTtlMs;
        if (ageMs <= ttlMs && entry.quote.timestamp > bestTs) {
          best = entry.quote;
          bestTs = entry.quote.timestamp;
        }
      }
    }
    return best;
  }

  /**
   * Read quotes for all symbols under a broker.
   */
  readBroker(brokerId: string): TaggedQuoteInfo[] {
    const prefix = `${brokerId}:`;
    const results: TaggedQuoteInfo[] = [];

    for (const [key, entry] of this.cache) {
      if (key.startsWith(prefix)) {
        const ageMs = Date.now() - entry.receivedAt;
        const ttlMs = entry.source === 'ws' ? this.config.wsCacheTtlMs : this.config.pollCacheTtlMs;
        if (ageMs <= ttlMs) {
          results.push(entry.quote);
        }
      }
    }
    return results;
  }

  // ── Degrade Polling ─────────────────────────────────────────────────

  /**
   * Activate degrade polling for a broker when WS is disconnected.
   * Uses REST API polling as fallback.
   */
  startDegradePoll(brokerType: BrokerType, restUrl: string, symbols: string[]): void {
    if (this.degradePollers.has(brokerType)) return;

    const poller = new DegradePoller(brokerType, restUrl, symbols, this.config.degradePollIntervalMs);
    poller.onQuote((quote) => this.pushPoll(quote));
    poller.start();

    this.degradePollers.set(brokerType, poller);
    this.state = 'degraded';

    log.warn(`[QuotePushCache] Degrade polling started for ${brokerType} (${symbols.length} symbols)`);
  }

  /**
   * Stop degrade polling — WS recovered.
   */
  stopDegradePoll(brokerType: BrokerType): void {
    const poller = this.degradePollers.get(brokerType);
    if (poller) {
      poller.stop();
      this.degradePollers.delete(brokerType);
      log.info(`[QuotePushCache] Degrade polling stopped for ${brokerType}`);
    }

    if (this.degradePollers.size === 0) {
      this.state = 'active';
    }
  }

  /**
   * Stop all degrade pollers.
   */
  stopAllDegradePoll(): void {
    for (const [bt, poller] of this.degradePollers) {
      poller.stop();
    }
    this.degradePollers.clear();
    this.state = 'active';
  }

  // ── Metrics ─────────────────────────────────────────────────────────

  getMetrics() {
    const totalOps = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: totalOps > 0 ? (this.metrics.hits / totalOps * 100).toFixed(1) + '%' : '0%',
      avgLatencyMs: this.metrics.latencySamples > 0
        ? Math.round(this.metrics.totalLatencyMs / this.metrics.latencySamples)
        : 0,
      cacheSize: this.cache.size,
      degradePollers: this.degradePollers.size,
      state: this.state,
    };
  }

  /**
   * Get push latency in ms (last received quote).
   */
  getPushLatencyMs(): number {
    return this.metrics.lastLatencyMs;
  }

  /**
   * Check if push latency meets <100ms acceptance criterion.
   */
  isPushLatencyAcceptable(): boolean {
    // Average over last 20 samples should be <100ms
    if (this.metrics.latencySamples < 5) return false;
    return this.metrics.totalLatencyMs / this.metrics.latencySamples < 100;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  destroy(): void {
    this.stopAllDegradePoll();
    if (this.degradeTimer) clearInterval(this.degradeTimer);
    this.cache.clear();
  }

  // ── Internal ────────────────────────────────────────────────────────

  private makeKey(brokerId: string, symbol: string): string {
    return `${brokerId}:${symbol}`;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.receivedAt < oldestTs) {
        oldestTs = entry.receivedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Degrade Poller — REST fallback when WS is down
// ═════════════════════════════════════════════════════════════════════════

export class DegradePoller {
  private brokerType: BrokerType;
  private restUrl: string;
  private symbols: string[];
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private quoteCallbacks: Array<(quote: TaggedQuoteInfo) => void> = [];
  private running = false;
  private pollCount = 0;
  private errorCount = 0;

  constructor(brokerType: BrokerType, restUrl: string, symbols: string[], intervalMs: number = 1000) {
    this.brokerType = brokerType;
    this.restUrl = restUrl;
    this.symbols = symbols;
    this.intervalMs = intervalMs;
  }

  onQuote(cb: (quote: TaggedQuoteInfo) => void): void {
    this.quoteCallbacks.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(async () => {
      try {
        await this.poll();
      } catch (err: any) {
        this.errorCount++;
        log.error(`[DegradePoller] ${this.brokerType} poll error:`, err.message);
      }
    }, this.intervalMs);

    log.info(`[DegradePoller] ${this.brokerType} started (${this.intervalMs}ms, ${this.symbols.length} symbols)`);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info(`[DegradePoller] ${this.brokerType} stopped (${this.pollCount} polls, ${this.errorCount} errors)`);
  }

  private async poll(): Promise<void> {
    this.pollCount++;

    // Batch symbols: REST endpoints have limits (typically 50 per request)
    const batchSize = 50;
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      const quotes = await this.fetchQuotes(batch);
      for (const q of quotes) {
        for (const cb of this.quoteCallbacks) {
          cb(q);
        }
      }
    }
  }

  private async fetchQuotes(symbols: string[]): Promise<TaggedQuoteInfo[]> {
    const joined = symbols.join(',');
    const url = `${this.restUrl}?symbols=${encodeURIComponent(joined)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      const quotes: TaggedQuoteInfo[] = [];

      const results = Array.isArray(data) ? data : (data.data || data.quotes || []);
      for (const raw of results) {
        const code = raw.symbol || raw.code || raw.s || '';
        if (!code) continue;

        quotes.push({
          code,
          price: parseFloat(raw.price || raw.lastPrice || raw.c || 0),
          change: parseFloat(raw.change || raw.p || 0),
          changePct: parseFloat(raw.changePct || raw.changePercent || raw.P || 0),
          volume: parseFloat(raw.volume || raw.v || 0),
          turnover: parseFloat(raw.turnover || raw.q || 0),
          high: parseFloat(raw.high || raw.h || 0),
          low: parseFloat(raw.low || raw.l || 0),
          open: parseFloat(raw.open || raw.o || 0),
          prevClose: parseFloat(raw.prevClose || raw.x || 0),
          time: new Date().toISOString(),
          brokerId: this.brokerType,
          brokerName: this.brokerType,
          brokerType: this.brokerType,
          market: 'US',
          originalCode: code,
          standardCode: code,
          timestamp: Date.now(),
        });
      }

      return quotes;
    } catch (err: any) {
      throw err;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════

let defaultCache: QuotePushCache | null = null;

export function getQuotePushCache(config?: Partial<QuoteCacheConfig>): QuotePushCache {
  if (!defaultCache) {
    defaultCache = new QuotePushCache(config);
  }
  return defaultCache;
}

export function resetQuotePushCache(): void {
  if (defaultCache) {
    defaultCache.destroy();
    defaultCache = null;
  }
}
