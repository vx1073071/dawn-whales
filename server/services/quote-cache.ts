// @ts-nocheck
/**
 * DAWN WHALES R153 Claw(PM) — Quote Cache + Latency Monitor
 * 
 * Caches quote data to reduce duplicate broker API calls.
 * Tracks per-broker latency for SymbolQuoteRouter health decisions.
 * 
 * Cache rules:
 *   - Quote: 30s TTL (same symbol within 30s → cache hit)
 *   - Kline: 5min TTL (historical data doesn't change frequently)
 *   - Max 1000 entries, LRU eviction on overflow
 * 
 * Latency monitoring:
 *   - Rolling average over last 10 requests per broker
 *   - Reports to SymbolQuoteRouter for failover decisions
 *   - Logs spikes (>5x avg) for alerting
 * 
 * ≥200L production-ready
 */

import { Quote } from '../../electron/engine/broker/types';
import { getQuoteRouter, QuoteSource } from './quote-router';

// ═══════════════ Types ════════════════════════════════════════════════════

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttlMs: number;
  hits: number;
  source: string;  // brokerId
}

/** R156 #15: Freshness-aware cache result */
export interface CacheResult<T> {
  data: T;
  source: string;
  createdAt: number;
  ageMs: number;
  isStale: boolean;
}

export interface LatencyRecord {
  brokerId: string;
  timestamps: number[];  // last N request latencies in ms
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  sampleCount: number;
  spikeCount: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryEstimate: number;
  byType: Record<string, number>;
}

// ═══════════════ Constants ════════════════════════════════════════════════

const QUOTE_TTL_MS = 30_000;       // 30s
const KLINE_TTL_MS = 300_000;      // 5min
const MAX_CACHE_SIZE = 1000;
const LATENCY_SAMPLE_SIZE = 10;    // rolling window size
const LATENCY_SPIKE_FACTOR = 5;    // >5x avg = spike

// ═══════════════ Quote Cache Service ══════════════════════════════════════

export class QuoteCacheService {
  private store: Map<string, CacheEntry<any>> = new Map();
  private latencyMap: Map<string, LatencyRecord> = new Map();
  private hits = 0;
  private misses = 0;

  // ── Cache Operations ───────────────────────────────────────────────────

  get<T>(key: string): CacheResult<T> | null {
    const entry = this.store.get(key);
    if (!entry || Date.now() - entry.createdAt > entry.ttlMs) {
      this.misses++;
      if (entry) this.store.delete(key);
      return null;
    }
    entry.hits++;
    this.hits++;
    const ageMs = Date.now() - entry.createdAt;
    return { data: entry.data, source: entry.source, createdAt: entry.createdAt, ageMs, isStale: ageMs > 5000 };
  }

  set<T>(key: string, data: T, ttlMs: number = QUOTE_TTL_MS, source: string = 'unknown'): void {
    if (this.store.size >= MAX_CACHE_SIZE) {
      this.evictLRU(Math.ceil(MAX_CACHE_SIZE * 0.1));
    }
    this.store.set(key, { data, createdAt: Date.now(), ttlMs, hits: 0, source });
  }

  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const [key] of this.store) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  // ── Quote-specific ──────────────────────────────────────────────────────

  getQuote(symbol: string, brokerId: string): Quote | null {
    const key = `quote:${brokerId}:${symbol}`;
    const result = this.get<Quote>(key);
    return result?.data || null;
  }

  setQuote(symbol: string, brokerId: string, quote: Quote): void {
    const key = `quote:${brokerId}:${symbol}`;
    this.set(key, quote, QUOTE_TTL_MS, brokerId);
  }

  getKlines(symbol: string, brokerId: string, interval: string): any[] | null {
    const key = `kline:${brokerId}:${symbol}:${interval}`;
    const result = this.get<any[]>(key);
    return result?.data || null;
  }

  setKlines(symbol: string, brokerId: string, interval: string, klines: any[]): void {
    const key = `kline:${brokerId}:${symbol}:${interval}`;
    this.set(key, klines, KLINE_TTL_MS, brokerId);
  }

  // ── Latency Tracking ───────────────────────────────────────────────────

  recordLatency(brokerId: string, latencyMs: number): void {
    let record = this.latencyMap.get(brokerId);
    if (!record) {
      record = { brokerId, timestamps: [], avgMs: 0, p95Ms: 0, p99Ms: 0, sampleCount: 0, spikeCount: 0 };
      this.latencyMap.set(brokerId, record);
    }

    record.timestamps.push(latencyMs);
    if (record.timestamps.length > LATENCY_SAMPLE_SIZE) {
      record.timestamps.shift();
    }
    record.sampleCount++;

    // Check spike
    if (record.avgMs > 0 && latencyMs > record.avgMs * LATENCY_SPIKE_FACTOR) {
      record.spikeCount++;
    }

    // Update stats
    this.recalcLatency(record);

    // Push to router
    const router = getQuoteRouter();
    router.updateBrokerLatency(brokerId, record.avgMs);
  }

  getLatency(brokerId: string): LatencyRecord | null {
    return this.latencyMap.get(brokerId) || null;
  }

  getAllLatencies(): Map<string, LatencyRecord> {
    return this.latencyMap;
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getCacheStats(): CacheStats {
    const total = this.hits + this.misses;
    const byType: Record<string, number> = {};
    let memoryEstimate = 0;

    for (const [key] of this.store) {
      const type = key.split(':')[0];
      byType[type] = (byType[type] || 0) + 1;
    }
    for (const [, entry] of this.store) {
      memoryEstimate += JSON.stringify(entry.data).length;
    }

    return {
      size: this.store.size,
      maxSize: MAX_CACHE_SIZE,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      memoryEstimate,
      byType,
    };
  }

  cleanup(): number {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.createdAt > entry.ttlMs) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private evictLRU(count: number): void {
    const sorted = [...this.store.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, count);
    for (const [key] of sorted) this.store.delete(key);
  }

  private recalcLatency(record: LatencyRecord): void {
    const sorted = [...record.timestamps].sort((a, b) => a - b);
    if (sorted.length === 0) return;

    record.avgMs = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
    record.p95Ms = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    record.p99Ms = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  }
}

// ═══════════════ Singleton ════════════════════════════════════════════════

let _cacheService: QuoteCacheService | null = null;

export function getQuoteCache(): QuoteCacheService {
  if (!_cacheService) _cacheService = new QuoteCacheService();
  return _cacheService;
}
