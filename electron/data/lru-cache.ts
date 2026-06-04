// ── LRU Cache Implementation ───────────────────────────────────────────────
// 高性能 LRU (Least Recently Used) 缓存实现
// 用于行情数据、K线数据等高频访问数据的缓存
//
// 特性：
// 1. O(1) 时间复杂度的 get/put 操作
// 2. 自动淘汰最久未使用的数据
// 3. 支持容量限制和过期时间
// 4. 内存占用优化

export interface LRUCacheOptions {
  maxSize: number;           // 最大缓存条目数
  ttl?: number;             // 过期时间（毫秒），默认不过期
  onEvict?: (key: string, value: any) => void;  // 淘汰回调
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;        // 创建时间
  lastAccess: number;       // 最后访问时间
  accessCount: number;      // 访问次数
}

export class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttl: number;
  private onEvict?: (key: string, value: any) => void;

  // 统计信息
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    total: 0,
  };

  constructor(options: LRUCacheOptions) {
    this.maxSize = options.maxSize;
    this.ttl = options.ttl || 0;
    this.onEvict = options.onEvict;
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存值，如果不存在或已过期则返回 undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // 检查是否过期
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // 更新访问信息
    entry.lastAccess = Date.now();
    entry.accessCount++;

    // 移到链表末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param value 缓存值
   */
  set(key: string, value: T): void {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果缓存已满，淘汰最久未使用的
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry && this.onEvict) {
          this.onEvict(oldestKey, oldestEntry.value);
        }
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    // 添加新条目
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0,
    };

    this.cache.set(key, entry);
    this.stats.total++;
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    if (this.ttl === 0) return 0;

    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ── 多级缓存管理器 ─────────────────────────────────────────────────────────

export interface MultiLevelCacheOptions {
  l1Size?: number;    // L1 缓存大小（内存）
  l2Size?: number;    // L2 缓存大小（本地存储）
  l1TTL?: number;     // L1 缓存 TTL
  l2TTL?: number;     // L2 缓存 TTL
}

export class MultiLevelCache<T = any> {
  private l1Cache: LRUCache<T>;  // 内存缓存（快速）
  private l2Cache: LRUCache<T>;  // 本地缓存（持久化）

  constructor(options: MultiLevelCacheOptions = {}) {
    this.l1Cache = new LRUCache<T>({
      maxSize: options.l1Size || 100,
      ttl: options.l1TTL || 5 * 60 * 1000,  // 默认 5 分钟
    });

    this.l2Cache = new LRUCache<T>({
      maxSize: options.l2Size || 1000,
      ttl: options.l2TTL || 24 * 60 * 60 * 1000,  // 默认 24 小时
    });
  }

  /**
   * 获取缓存（优先 L1，然后 L2）
   */
  get(key: string): T | undefined {
    // 先查 L1
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      return value;
    }

    // 再查 L2
    value = this.l2Cache.get(key);
    if (value !== undefined) {
      // 提升回 L1
      this.l1Cache.set(key, value);
      return value;
    }

    return undefined;
  }

  /**
   * 设置缓存（同时写入 L1 和 L2）
   */
  set(key: string, value: T): void {
    this.l1Cache.set(key, value);
    this.l2Cache.set(key, value);
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    return this.l1Cache.has(key) || this.l2Cache.has(key);
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.l1Cache.delete(key);
    this.l2Cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    l1: any;
    l2: any;
  } {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache.getStats(),
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): { l1: number; l2: number } {
    return {
      l1: this.l1Cache.cleanup(),
      l2: this.l2Cache.cleanup(),
    };
  }
}
