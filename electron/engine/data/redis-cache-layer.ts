/**
 * Redis-Compatible Cache Layer
 * 
 * Provides a Redis-like API with in-memory Map as fallback.
 * Supports LRU eviction, pub/sub, key prefixing, and cache statistics.
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../errors';


// ─── Types & Interfaces ────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  value: T;
  expireAt?: number;
  lastAccess: number;
  accessCount: number;
  type: 'string' | 'hash' | 'number';
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  deletes: number;
  totalKeys: number;
  memoryUsageBytes: number;
  hitRate: number;
}

interface PubSubMessage {
  channel: string;
  message: string;
  timestamp: number;
}

interface RedisCacheOptions {
  maxKeys?: number;
  defaultTTL?: number; // seconds
  keyPrefix?: string;
  enableStats?: boolean;
  evictionPolicy?: 'lru' | 'lfu' | 'ttl';
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  namespace?: string;
}

type PubSubCallback = (message: PubSubMessage) => void;

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_KEYS = 50000;
const DEFAULT_TTL = 0; // 0 = no expiry
const DEFAULT_RECONNECT_INTERVAL = 5000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const STATS_LOG_INTERVAL = 60000; // log stats every 60s
const SERIALIZATION_PREFIX = '__serialized__:';

// ─── Serialization Helpers ──────────────────────────────────────────────────

function serialize<T>(value: T): string {
  if (typeof value === 'string') return value;
  try {
    return SERIALIZATION_PREFIX + JSON.stringify(value);
  } catch (err) {
    log.error('[RedisCache] Serialization failed:', err);
    return String(value);
  }
}

function deserialize<T>(raw: string): T {
  if (raw.startsWith(SERIALIZATION_PREFIX)) {
    try {
      return JSON.parse(raw.slice(SERIALIZATION_PREFIX.length)) as T;
    } catch {
      return raw as unknown as T;
    }
  }
  return raw as unknown as T;
}

// ─── LRU Doubly Linked List ────────────────────────────────────────────────

class LRUNode {
  key: string;
  prev: LRUNode | null = null;
  next: LRUNode | null = null;

  constructor(key: string) {
    this.key = key;
  }
}

class LRUList {
  private head: LRUNode;
  private tail: LRUNode;
  private map: Map<string, LRUNode> = new Map();

  constructor() {
    this.head = new LRUNode('__head__');
    this.tail = new LRUNode('__tail__');
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  add(key: string): void {
    this.remove(key);
    const node = new LRUNode(key);
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
    this.map.set(key, node);
  }

  remove(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    this.map.delete(key);
    return true;
  }

  evict(): string | null {
    const node = this.tail.prev;
    if (!node || node === this.head) return null;
    node.prev!.next = this.tail;
    this.tail.prev = node.prev;
    this.map.delete(node.key);
    return node.key;
  }

  touch(key: string): void {
    if (this.remove(key)) {
      this.add(key);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
}

// ─── Main Redis Cache Layer ─────────────────────────────────────────────────

export class RedisCacheLayer {
  private store: Map<string, CacheEntry> = new Map();
  private lru: LRUList = new LRUList();
  private subscribers: Map<string, Set<PubSubCallback>> = new Map();
  private patternSubscribers: Map<string, Set<PubSubCallback>> = new Map();

  private options: Required<RedisCacheOptions>;
  private connected: boolean = false;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    deletes: 0,
    totalKeys: 0,
    memoryUsageBytes: 0,
    hitRate: 0,
  };

  private hashStore: Map<string, Map<string, string>> = new Map();

  constructor(options: RedisCacheOptions = {}) {
    this.options = {
      maxKeys: options.maxKeys ?? DEFAULT_MAX_KEYS,
      defaultTTL: options.defaultTTL ?? DEFAULT_TTL,
      keyPrefix: options.keyPrefix ?? '',
      enableStats: options.enableStats ?? true,
      evictionPolicy: options.evictionPolicy ?? 'lru',
      reconnectInterval: options.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL,
      maxReconnectAttempts: options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      namespace: options.namespace ?? 'default',
    };

    this.connect();
  }

  // ─── Connection Management ──────────────────────────────────────────────

  private connect(): void {
    try {
      this.connected = true;
      this.startCleanupTimer();
      if (this.options.enableStats) {
        this.startStatsTimer();
      }
      log.info(`[RedisCache] Connected (namespace=${this.options.namespace}, prefix=${this.options.keyPrefix})`);
    } catch (err) {
      log.error('[RedisCache] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.connected = false;
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    log.info('[RedisCache] Disconnected');
  }

  private scheduleReconnect(): void {
    let attempts = 0;
    this.reconnectTimer = setInterval(() => {
      attempts++;
      if (attempts > this.options.maxReconnectAttempts) {
        log.error('[RedisCache] Max reconnect attempts reached');
        clearInterval(this.reconnectTimer!);
        this.reconnectTimer = null;
        return;
      }
      log.warn(`[RedisCache] Reconnect attempt ${attempts}/${this.options.maxReconnectAttempts}`);
      this.connect();
      if (this.connected && this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }, this.options.reconnectInterval);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ─── Key Helpers ────────────────────────────────────────────────────────

  private prefixKey(key: string): string {
    return this.options.keyPrefix ? `${this.options.keyPrefix}:${key}` : key;
  }

  private estimateSize(entry: CacheEntry): number {
    const valStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
    return new TextEncoder().encode(valStr).length + 64; // 64 bytes overhead
  }

  private updateMemoryUsage(): void {
    let total = 0;
    for (const entry of this.store.values()) {
      total += this.estimateSize(entry);
    }
    for (const hash of this.hashStore.values()) {
      for (const [k, v] of hash) {
        total += new TextEncoder().encode(k + v).length + 32;
      }
    }
    this.stats.memoryUsageBytes = total;
    this.stats.totalKeys = this.store.size + this.hashStore.size;
  }

  // ─── Eviction ───────────────────────────────────────────────────────────

  private evictIfNeeded(): void {
    while (this.store.size >= this.options.maxKeys) {
      let evictedKey: string | null = null;

      switch (this.options.evictionPolicy) {
        case 'lru': {
          evictedKey = this.lru.evict();
          break;
        }
        case 'lfu': {
          let minAccess = Infinity;
          for (const [key, entry] of this.store) {
            if (entry.accessCount < minAccess) {
              minAccess = entry.accessCount;
              evictedKey = key;
            }
          }
          break;
        }
        case 'ttl': {
          let earliest = Infinity;
          for (const [key, entry] of this.store) {
            if (entry.expireAt && entry.expireAt < earliest) {
              earliest = entry.expireAt;
              evictedKey = key;
            }
          }
          // fallback to LRU if no TTL entries
          if (!evictedKey) evictedKey = this.lru.evict();
          break;
        }
      }

      if (evictedKey) {
        this.store.delete(evictedKey);
        this.lru.remove(evictedKey);
        this.stats.evictions++;
        log.debug(`[RedisCache] Evicted key: ${evictedKey}`);
      } else {
        break;
      }
    }
  }

  // ─── Expired Key Cleanup ────────────────────────────────────────────────

  private cleanExpiredKeys(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (entry.expireAt && now > entry.expireAt) {
        this.store.delete(key);
        this.lru.remove(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log.debug(`[RedisCache] Cleaned ${cleaned} expired keys`);
      this.updateMemoryUsage();
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => this.cleanExpiredKeys(), 10000);
  }

  private isExpired(entry: CacheEntry): boolean {
    return !!entry.expireAt && Date.now() > entry.expireAt;
  }

  // ─── Core String Commands ──────────────────────────────────────────────

  async get<T = string>(key: string): Promise<T | null> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const entry = this.store.get(pk);

    if (!entry || this.isExpired(entry)) {
      if (entry && this.isExpired(entry)) {
        this.store.delete(pk);
        this.lru.remove(pk);
      }
      this.stats.misses++;
      return null;
    }

    entry.lastAccess = Date.now();
    entry.accessCount++;
    this.lru.touch(pk);
    this.stats.hits++;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);
    return deserialize<T>(serialize(entry.value));
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const ttl = ttlSeconds ?? this.options.defaultTTL;

    // Remove old entry if exists for LRU tracking
    if (this.store.has(pk)) {
      this.lru.remove(pk);
    }

    this.evictIfNeeded();

    const entry: CacheEntry = {
      value,
      expireAt: ttl > 0 ? Date.now() + ttl * 1000 : undefined,
      lastAccess: Date.now(),
      accessCount: 0,
      type: typeof value === 'string' ? 'string' : 'string',
    };

    this.store.set(pk, entry);
    this.lru.add(pk);
    this.stats.sets++;
    this.updateMemoryUsage();
    return true;
  }

  async del(...keys: string[]): Promise<number> {
    this.ensureConnected();
    let deleted = 0;
    for (const key of keys) {
      const pk = this.prefixKey(key);
      if (this.store.delete(pk)) {
        this.lru.remove(pk);
        deleted++;
      }
      if (this.hashStore.delete(pk)) {
        deleted++;
      }
    }
    this.stats.deletes += deleted;
    this.updateMemoryUsage();
    return deleted;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const entry = this.store.get(pk);
    if (!entry) return false;
    entry.expireAt = Date.now() + seconds * 1000;
    return true;
  }

  async ttl(key: string): Promise<number> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const entry = this.store.get(pk);
    if (!entry) return -2; // key doesn't exist
    if (!entry.expireAt) return -1; // no TTL
    const remaining = Math.ceil((entry.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async exists(...keys: string[]): Promise<number> {
    this.ensureConnected();
    let count = 0;
    for (const key of keys) {
      const pk = this.prefixKey(key);
      const entry = this.store.get(pk);
      if (entry && !this.isExpired(entry)) {
        count++;
      }
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    let entry = this.store.get(pk);

    if (!entry || this.isExpired(entry)) {
      entry = { value: '0', lastAccess: Date.now(), accessCount: 0, type: 'string' };
      this.store.set(pk, entry);
      this.lru.add(pk);
    }

    const current = parseInt(String(entry.value), 10);
    if (isNaN(current)) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `ERR value is not an integer or out of range for key: ${key}`);
    }

    const newVal = current + 1;
    entry.value = String(newVal);
    entry.lastAccess = Date.now();
    entry.accessCount++;
    this.lru.touch(pk);
    this.updateMemoryUsage();
    return newVal;
  }

  async keys(pattern: string): Promise<string[]> {
    this.ensureConnected();
    const prefix = this.options.keyPrefix ? `${this.options.keyPrefix}:` : '';
    const regex = new RegExp('^' + prefix + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const result: string[] = [];
    const now = Date.now();

    for (const [key] of this.store) {
      if (regex.test(key)) {
        const entry = this.store.get(key)!;
        if (!entry.expireAt || now <= entry.expireAt) {
          result.push(key.startsWith(prefix) ? key.slice(prefix.length) : key);
        }
      }
    }
    return result;
  }

  async flushdb(): Promise<boolean> {
    this.ensureConnected();
    this.store.clear();
    this.hashStore.clear();
    this.lru.clear();
    this.updateMemoryUsage();
    log.warn('[RedisCache] FLUSHDB executed');
    return true;
  }

  // ─── Hash Commands ─────────────────────────────────────────────────────

  async hset(key: string, field: string, value: string): Promise<number> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    let hash = this.hashStore.get(pk);
    let isNew = 0;

    if (!hash) {
      hash = new Map();
      this.hashStore.set(pk, hash);
      isNew = 1;
    }

    if (!hash.has(field)) isNew = 1;
    hash.set(field, String(value));
    this.updateMemoryUsage();
    return isNew;
  }

  async hget(key: string, field: string): Promise<string | null> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const hash = this.hashStore.get(pk);
    if (!hash) return null;
    return hash.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const hash = this.hashStore.get(pk);
    if (!hash || hash.size === 0) return null;

    const result: Record<string, string> = {};
    for (const [k, v] of hash) {
      result[k] = v;
    }
    return result;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const hash = this.hashStore.get(pk);
    if (!hash) return 0;

    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) deleted++;
    }
    if (hash.size === 0) this.hashStore.delete(pk);
    this.updateMemoryUsage();
    return deleted;
  }

  async hlen(key: string): Promise<number> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const hash = this.hashStore.get(pk);
    return hash ? hash.size : 0;
  }

  // ─── Pub/Sub ───────────────────────────────────────────────────────────

  subscribe(channel: string, callback: PubSubCallback): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
    log.debug(`[RedisCache] Subscribed to channel: ${channel}`);
  }

  unsubscribe(channel: string, callback?: PubSubCallback): void {
    if (!callback) {
      this.subscribers.delete(channel);
    } else {
      this.subscribers.get(channel)?.delete(callback);
    }
  }

  psubscribe(pattern: string, callback: PubSubCallback): void {
    if (!this.patternSubscribers.has(pattern)) {
      this.patternSubscribers.set(pattern, new Set());
    }
    this.patternSubscribers.get(pattern)!.add(callback);
  }

  async publish(channel: string, message: string): Promise<number> {
    this.ensureConnected();
    const pubMsg: PubSubMessage = {
      channel,
      message,
      timestamp: Date.now(),
    };

    let receivers = 0;

    // Direct subscribers
    const subs = this.subscribers.get(channel);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(pubMsg);
          receivers++;
        } catch (err) {
          log.error(`[RedisCache] PubSub callback error on channel ${channel}:`, err);
        }
      }
    }

    // Pattern subscribers
    for (const [pattern, psubs] of this.patternSubscribers) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      if (regex.test(channel)) {
        for (const cb of psubs) {
          try {
            cb(pubMsg);
            receivers++;
          } catch (err) {
            log.error(`[RedisCache] PubSub pattern callback error:`, err);
          }
        }
      }
    }

    return receivers;
  }

  on(event: string, callback: PubSubCallback): void {
    this.subscribe(event, callback);
  }

  off(event: string, callback?: PubSubCallback): void {
    this.unsubscribe(event, callback);
  }

  // ─── Statistics ─────────────────────────────────────────────────────────

  getStats(): CacheStats {
    this.updateMemoryUsage();
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      totalKeys: 0,
      memoryUsageBytes: 0,
      hitRate: 0,
    };
  }

  private startStatsTimer(): void {
    this.statsTimer = setInterval(() => {
      this.updateMemoryUsage();
      log.debug(
        `[RedisCache] Stats: keys=${this.stats.totalKeys}, hits=${this.stats.hits}, ` +
        `misses=${this.stats.misses}, evictions=${this.stats.evictions}, ` +
        `memory=${(this.stats.memoryUsageBytes / 1024 / 1024).toFixed(2)}MB, ` +
        `hitRate=${(this.stats.hitRate * 100).toFixed(1)}%`
      );
    }, STATS_LOG_INTERVAL);
  }

  // ─── Utility ───────────────────────────────────────────────────────────

  async dbsize(): Promise<number> {
    this.ensureConnected();
    return this.store.size + this.hashStore.size;
  }

  async type(key: string): Promise<string> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    if (this.hashStore.has(pk)) return 'hash';
    if (this.store.has(pk)) return 'string';
    return 'none';
  }

  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    this.ensureConnected();
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  async mset(entries: Array<[string, unknown]>): Promise<boolean> {
    this.ensureConnected();
    for (const [key, value] of entries) {
      await this.set(key, value);
    }
    return true;
  }

  async setnx<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    this.ensureConnected();
    const pk = this.prefixKey(key);
    const existing = this.store.get(pk);
    if (existing && !this.isExpired(existing)) return false;
    return this.set(key, value, ttlSeconds);
  }

  async append(key: string, value: string): Promise<number> {
    this.ensureConnected();
    const current = await this.get<string>(key);
    const newVal = (current ?? '') + value;
    await this.set(key, newVal);
    return newVal.length;
  }

  async strlen(key: string): Promise<number> {
    this.ensureConnected();
    const value = await this.get<string>(key);
    return value ? value.length : 0;
  }

  // ─── Pipeline (batch) ─────────────────────────────────────────────────

  pipeline(): PipelineBuilder {
    return new PipelineBuilder(this);
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'RedisCache: not connected');
    }
  }
}

// ─── Pipeline Builder ───────────────────────────────────────────────────────

class PipelineBuilder {
  private cache: RedisCacheLayer;
  private commands: Array<() => Promise<unknown>> = [];

  constructor(cache: RedisCacheLayer) {
    this.cache = cache;
  }

  get(key: string): this {
    this.commands.push(() => this.cache.get(key));
    return this;
  }

  set(key: string, value: unknown, ttl?: number): this {
    this.commands.push(() => this.cache.set(key, value, ttl));
    return this;
  }

  del(...keys: string[]): this {
    this.commands.push(() => this.cache.del(...keys));
    return this;
  }

  incr(key: string): this {
    this.commands.push(() => this.cache.incr(key));
    return this;
  }

  hset(key: string, field: string, value: string): this {
    this.commands.push(() => this.cache.hset(key, field, value));
    return this;
  }

  hget(key: string, field: string): this {
    this.commands.push(() => this.cache.hget(key, field));
    return this;
  }

  async exec(): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const cmd of this.commands) {
      try {
        results.push(await cmd());
      } catch (err) {
        results.push(err);
      }
    }
    return results;
  }
}

// ─── Factory & Singleton ────────────────────────────────────────────────────

const instances: Map<string, RedisCacheLayer> = new Map();

export function createRedisCache(options: RedisCacheOptions = {}): RedisCacheLayer {
  const ns = options.namespace ?? 'default';
  if (instances.has(ns)) {
    return instances.get(ns)!;
  }
  const cache = new RedisCacheLayer(options);
  instances.set(ns, cache);
  return cache;
}

export function destroyRedisCache(namespace: string = 'default'): void {
  const cache = instances.get(namespace);
  if (cache) {
    cache.disconnect();
    instances.delete(namespace);
  }
}

export function destroyAllRedisCaches(): void {
  for (const [ns, cache] of instances) {
    cache.disconnect();
  }
  instances.clear();
}

// ─── Default Export ─────────────────────────────────────────────────────────

export default RedisCacheLayer;
