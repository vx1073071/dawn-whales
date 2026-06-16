/**
 * DQ-04 LocalCacheLayer — R255 QUANT MOO
 *
 * 本地缓存层。提供高性能、可配置的浏览器端缓存基础设施，
 * 用于行情数据、计算结果、API 响应等高频访问数据的本地暂存。
 *
 * Features:
 * - LRU eviction with configurable max size
 * - TTL-based expiration with stale-while-revalidate
 * - Hit/miss tracking with hit rate reporting
 * - Namespace isolation for multi-tenant use
 * - JSON serialization for persistence
 * - Batch operations: getMany, setMany, deleteMany
 * - Cache stats: hits, misses, evictions, size
 *
 * Architecture:
 * - Singleton with reset() for testability
 * - Map-based storage with doubly-linked LRU
 * - Per-entry TTL with lazy expiration
 *
 * @author JVS
 * @round R255
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  hitCount: number;
  size: number;            // Estimated bytes
  namespace: string;
}

export interface CacheConfig {
  maxEntries: number;
  maxSizeBytes: number;
  defaultTTLMs: number;          // default time-to-live
  staleWhileRevalidateMs: number; // serve stale while fetching fresh
  enablePersistence: boolean;
  persistenceKey: string;
  autoPruneIntervalMs: number;    // 0 = disable auto-prune
  pruneBatchSize: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
  namespaces: string[];
  totalSizeBytes: number;
  uptimeMs: number;
}

export interface CacheQueryOptions {
  namespace?: string;
  maxAgeMs?: number;
}

// ─── Internals ─────────────────────────────────────────

interface ListNode<T> {
  entry: CacheEntry<T>;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 10000,
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  defaultTTLMs: 5 * 60 * 1000,     // 5 minutes
  staleWhileRevalidateMs: 60000,   // 1 minute stale grace
  enablePersistence: false,
  persistenceKey: 'dw_cache',
  autoPruneIntervalMs: 30000,      // prune every 30s
  pruneBatchSize: 500,
};

function estimateSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;  // chars ≈ bytes for ASCII
  } catch {
    return 128;
  }
}

// ─── Engine ──────────────────────────────────────────────

export class LocalCacheLayer extends EventEmitter {
  private static instance: LocalCacheLayer;

  private config: CacheConfig = { ...DEFAULT_CACHE_CONFIG };
  private cache = new Map<string, ListNode<unknown>>();
  private head: ListNode<unknown> | null = null;
  private tail: ListNode<unknown> | null = null;

  // Stats
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private totalSizeBytes = 0;
  private startedAt: number;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  // Sequential key index for LRU ordering fallback
  private keyOrder: string[] = [];

  private constructor() {
    super();
    this.startedAt = Date.now();
  }

  static getInstance(): LocalCacheLayer {
    if (!LocalCacheLayer.instance) {
      LocalCacheLayer.instance = new LocalCacheLayer();
    }
    return LocalCacheLayer.instance;
  }

  reset(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.keyOrder = [];
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalSizeBytes = 0;
    this.startedAt = Date.now();
    this.config = { ...DEFAULT_CACHE_CONFIG };
    if (this.pruneTimer) { clearInterval(this.pruneTimer); this.pruneTimer = null; }
    this.removeAllListeners();
  }

  // ─── Config ────────────────────────────────────────

  configure(partial: Partial<CacheConfig>): void {
    Object.assign(this.config, partial);
    if (this.pruneTimer) { clearInterval(this.pruneTimer); this.pruneTimer = null; }
    if (this.config.autoPruneIntervalMs > 0) {
      this.startAutoPrune();
    }
  }

  getConfig(): Readonly<CacheConfig> {
    return { ...this.config };
  }

  // ─── LRU List Operations ────────────────────────────

  private makeKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  private toFront(node: ListNode<unknown>): void {
    if (!this.head || this.head === node) return;

    // Remove from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.tail === node) this.tail = node.prev;

    // Put at front
    node.prev = null;
    node.next = this.head;
    this.head.prev = node;
    this.head = node;
  }

  private pushFront(node: ListNode<unknown>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeLast(): void {
    if (!this.tail) return;
    const node = this.tail;
    const fullKey = node.entry.namespace + ':' + node.entry.key;
    if (node.prev) {
      node.prev.next = null;
      this.tail = node.prev;
    } else {
      this.head = null;
      this.tail = null;
    }
    this.cache.delete(fullKey);
    this.keyOrder = this.keyOrder.filter(k => k !== fullKey);
    this.totalSizeBytes -= node.entry.size;
    this.evictions++;
    this.emit('evicted', { key: node.entry.key, namespace: node.entry.namespace });
  }

  private removeNode(node: ListNode<unknown>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.head === node) this.head = node.next;
    if (this.tail === node) this.tail = node.prev;
    this.totalSizeBytes -= node.entry.size;
  }

  // ─── Core Operations ───────────────────────────────

  set<T>(key: string, value: T, ttlMs?: number, namespace = 'default'): CacheEntry<T> {
    const fullKey = this.makeKey(namespace, key);
    const now = Date.now();
    const ttl = ttlMs ?? this.config.defaultTTLMs;

    // Evict if this key already exists
    const existing = this.cache.get(fullKey);
    if (existing) {
      this.removeNode(existing);
      this.cache.delete(fullKey);
    }

    // Evict if over capacity
    while (this.cache.size >= this.config.maxEntries || this.totalSizeBytes >= this.config.maxSizeBytes) {
      if (this.cache.size === 0) break;
      this.removeLast();
    }

    const size = estimateSize(value);
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccessedAt: now,
      hitCount: 0,
      size,
      namespace,
    };

    const node: ListNode<T> = { entry: entry as CacheEntry<unknown>, prev: null, next: null };
    this.pushFront(node as ListNode<unknown>);
    this.cache.set(fullKey, node as ListNode<unknown>);
    this.totalSizeBytes += size;

    // Track key order for non-LRU fallback
    this.keyOrder = this.keyOrder.filter(k => k !== fullKey);
    this.keyOrder.push(fullKey);

    this.emit('set', { key, namespace });

    return entry;
  }

  get<T>(key: string, namespace = 'default'): { value: T; entry: CacheEntry<T> } | null {
    const fullKey = this.makeKey(namespace, key);
    const node = this.cache.get(fullKey);

    if (!node) {
      this.misses++;
      this.emit('miss', { key, namespace });
      return null;
    }

    const entry = node.entry as CacheEntry<T>;
    const now = Date.now();

    // Check expiration
    if (now > entry.expiresAt) {
      // Stale-while-revalidate check
      if (now < entry.expiresAt + this.config.staleWhileRevalidateMs) {
        entry.hitCount++;
        this.hits++;
        this.emit('stale_hit', { key, namespace, entry });
        return { value: entry.value, entry };
      }
      // Expired — remove
      this.removeNode(node);
      this.cache.delete(fullKey);
      this.keyOrder = this.keyOrder.filter(k => k !== fullKey);
      this.misses++;
      this.emit('expired', { key, namespace });
      return null;
    }

    entry.hitCount++;
    entry.lastAccessedAt = now;
    this.toFront(node);
    this.hits++;
    this.emit('hit', { key, namespace });
    return { value: entry.value, entry };
  }

  getStale<T>(key: string, namespace = 'default'): { value: T; entry: CacheEntry<T>; expired: boolean } | null {
    const fullKey = this.makeKey(namespace, key);
    const node = this.cache.get(fullKey);

    if (!node) {
      this.misses++;
      return null;
    }

    const entry = node.entry as CacheEntry<T>;
    const expired = Date.now() > entry.expiresAt;
    entry.hitCount++;
    this.hits++;

    return { value: entry.value, entry, expired };
  }

  has(key: string, namespace = 'default'): boolean {
    const fullKey = this.makeKey(namespace, key);
    const node = this.cache.get(fullKey);
    if (!node) return false;
    return Date.now() <= node.entry.expiresAt + this.config.staleWhileRevalidateMs;
  }

  delete(key: string, namespace = 'default'): boolean {
    const fullKey = this.makeKey(namespace, key);
    const node = this.cache.get(fullKey);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(fullKey);
    this.keyOrder = this.keyOrder.filter(k => k !== fullKey);
    this.emit('delete', { key, namespace });
    return true;
  }

  clear(namespace?: string): number {
    let count = 0;
    if (namespace) {
      for (const [fullKey, node] of this.cache) {
        if (node.entry.namespace === namespace) {
          this.removeNode(node);
          this.cache.delete(fullKey);
          this.keyOrder = this.keyOrder.filter(k => k !== fullKey);
          count++;
        }
      }
    } else {
      count = this.cache.size;
      this.cache.clear();
      this.head = null;
      this.tail = null;
      this.keyOrder = [];
      this.totalSizeBytes = 0;
    }
    this.emit('clear', { namespace, count });
    return count;
  }

  // ─── Batch Operations ──────────────────────────────

  setMany<T>(entries: Array<{ key: string; value: T; ttlMs?: number; namespace?: string }>): number {
    let count = 0;
    for (const e of entries) {
      this.set(e.key, e.value, e.ttlMs, e.namespace);
      count++;
    }
    return count;
  }

  getMany<T>(keys: string[], namespace = 'default'): Map<string, T> {
    const results = new Map<string, T>();
    for (const key of keys) {
      const result = this.get<T>(key, namespace);
      if (result) results.set(key, result.value);
    }
    return results;
  }

  deleteMany(keys: string[], namespace = 'default'): number {
    let count = 0;
    for (const key of keys) {
      if (this.delete(key, namespace)) count++;
    }
    return count;
  }

  // ─── Search & Query ────────────────────────────────

  keys(namespace = 'default'): string[] {
    const result: string[] = [];
    for (const node of this.cache.values()) {
      if (node.entry.namespace === namespace) {
        result.push(node.entry.key);
      }
    }
    return result;
  }

  count(namespace?: string): number {
    if (!namespace) return this.cache.size;
    let count = 0;
    for (const node of this.cache.values()) {
      if (node.entry.namespace === namespace) count++;
    }
    return count;
  }

  getNamespaces(): string[] {
    return Array.from(new Set(Array.from(this.cache.values()).map(n => n.entry.namespace)));
  }

  // ─── Expiration ─────────────────────────────────────

  prune(namespace?: string): number {
    const now = Date.now();
    let count = 0;

    for (const [fullKey, node] of this.cache) {
      if (now > node.entry.expiresAt + this.config.staleWhileRevalidateMs) {
        if (!namespace || node.entry.namespace === namespace) {
          this.removeNode(node);
          this.cache.delete(fullKey);
          this.keyOrder = this.keyOrder.filter(k => k !== fullKey);
          count++;
        }
      }
    }

    if (count > 0) {
      this.emit('pruned', { count, namespace });
    }
    return count;
  }

  startAutoPrune(): void {
    if (this.pruneTimer) return;
    this.pruneTimer = setInterval(() => {
      this.prune();
    }, this.config.autoPruneIntervalMs);
  }

  stopAutoPrune(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  // ─── Stats ──────────────────────────────────────────

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
      entries: this.cache.size,
      hitRate: this.hits + this.misses > 0
        ? Math.round(this.hits / (this.hits + this.misses) * 10000) / 100
        : 0,
      namespaces: this.getNamespaces(),
      totalSizeBytes: this.totalSizeBytes,
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.startedAt = Date.now();
  }

  // ─── Persistence ────────────────────────────────────

  // Note: actual localStorage/IndexedDB integration would use
  // browser APIs. These are abstracted for testability.
  serialize(): string {
    const entries: Array<{ k: string; v: unknown; e: number; n: string }> = [];
    for (const node of this.cache.values()) {
      entries.push({
        k: node.entry.key,
        v: node.entry.value,
        e: node.entry.expiresAt,
        n: node.entry.namespace,
      });
    }
    return JSON.stringify(entries);
  }

  deserialize(json: string): number {
    try {
      const entries: Array<{ k: string; v: unknown; e: number; n: string }> = JSON.parse(json);
      for (const item of entries) {
        const ttl = Math.max(0, item.e - Date.now());
        this.set(item.k, item.v, ttl, item.n);
      }
      return entries.length;
    } catch {
      return 0;
    }
  }

  // ─── Warm-up ────────────────────────────────────────

  warmup<T>(entries: Array<{ key: string; value: T; ttlMs?: number; namespace?: string }>): number {
    return this.setMany(entries);
  }

  // ─── Size ───────────────────────────────────────────

  estimatedSizeBytes(): number {
    return this.totalSizeBytes;
  }

  entryCount(): number {
    return this.cache.size;
  }
}
