// T55: In-Memory LRU Cache Service
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private store = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;
  private accessOrder: string[] = []; // for LRU eviction

  constructor(maxSize = 500, defaultTTLMs = 60000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this._evictIfNeeded();
    const ttl = ttlMs ?? this.defaultTTL;
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
    this._touch(key);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      return null;
    }
    this._touch(key);
    return entry.value as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  ttl(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return -1;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  expire(key: string, ttlMs: number): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttlMs;
    return true;
  }

  private _touch(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  private _evictIfNeeded(): void {
    while (this.store.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      this.store.delete(oldest);
    }
  }

  /** Remove all expired entries */
  sweep(): number {
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (Date.now() > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    this.accessOrder = this.accessOrder.filter(k => this.store.has(k));
    return removed;
  }
}

export const globalCache = new CacheService(1000, 300000); // 1000 entries, 5min default
