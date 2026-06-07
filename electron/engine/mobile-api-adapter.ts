/**
 * J-53-04: Mobile API Adapter [P1]
 * v1.1.0-beta — Lightweight API responses for mobile clients
 *
 * 功能:
 * - 分页适配 (cursor-based + offset-based)
 * - 轻量响应 (field selection, compression hints)
 * - 响应缓存 (TTL-based, per-endpoint)
 * - 带宽优化 (delta sync, field stripping)
 *
 * 验收标准:
 * - 代码量 ≥ 200L
 * - 测试 ≥ 10 tests, 全部 pass
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type CachePolicy = 'none' | 'short' | 'medium' | 'long';

export interface PaginationRequest {
  page?: number;
  pageSize?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  endpoint: string;
}

export interface LightweightResponse<T> {
  data: T;
  meta: {
    cached: boolean;
    responseTimeMs: number;
    fieldsStripped: number;
    originalSize: number;
    compressedSize: number;
  };
}

export interface FieldSelector {
  include?: string[];
  exclude?: string[];
}

// ── Response Cache ─────────────────────────────────────────────────────────

export class ResponseCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private defaultTtl: number;

  /**
   * Constructor supports two signatures:
   * - (maxEntries) — uses default 5min TTL
   * - (defaultTtlMs, maxEntries) — explicit TTL + max
   */
  constructor(arg1: number = 100, arg2?: number) {
    if (arg2 !== undefined) {
      // (defaultTtlMs, maxEntries)
      this.defaultTtl = arg1;
      this.maxEntries = arg2;
    } else {
      // (maxEntries)
      this.maxEntries = arg1;
      this.defaultTtl = 300_000; // 5min default
    }
  }

  get size(): number {
    return this.cache.size;
  }

  private getTtl(policy: CachePolicy): number {
    switch (policy) {
      case 'none': return 0;
      case 'short': return 30_000;
      case 'medium': return 300_000;
      case 'long': return 3600_000;
    }
  }

  /**
   * Get cached response if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data as T;
  }

  /**
   * Store response — supports both CachePolicy string and numeric TTL (ms)
   */
  set<T>(key: string, data: T, policyOrTtl?: CachePolicy | number): void {
    let ttl: number;
    if (typeof policyOrTtl === 'number') {
      ttl = policyOrTtl;
    } else if (typeof policyOrTtl === 'string') {
      ttl = this.getTtl(policyOrTtl);
    } else {
      ttl = this.defaultTtl;
    }
    if (ttl === 0) return;

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      endpoint: key,
    });
  }

  /**
   * Invalidate by key or prefix
   */
  invalidate(keyOrPrefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate by pattern (alias for invalidate with prefix matching)
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxSize: number; hitRates: Record<string, number> } {
    const hitRates: Record<string, number> = {};
    for (const [key, entry] of this.cache.entries()) {
      hitRates[key] = entry.hits;
    }
    return { size: this.cache.size, maxSize: this.maxEntries, hitRates };
  }

  reset(): void {
    this.cache.clear();
  }
}

// ── Field Stripper ─────────────────────────────────────────────────────────

export class FieldStripper {
  /**
   * Strip fields from objects based on include/exclude selectors
   */
  strip<T extends Record<string, any>>(items: T[], selector: FieldSelector): { stripped: Partial<T>[]; fieldsRemoved: number } {
    let fieldsRemoved = 0;

    const stripped = items.map(item => {
      if (selector.include && selector.include.length > 0) {
        const result: Record<string, any> = {};
        for (const field of selector.include) {
          if (field in item) result[field] = item[field];
        }
        fieldsRemoved += Object.keys(item).length - Object.keys(result).length;
        return result as Partial<T>;
      }

      if (selector.exclude && selector.exclude.length > 0) {
        const result = { ...item };
        for (const field of selector.exclude) {
          if (field in result) {
            delete (result as any)[field];
            fieldsRemoved++;
          }
        }
        return result as Partial<T>;
      }

      return item;
    });

    return { stripped, fieldsRemoved };
  }

  /**
   * Estimate byte size reduction
   */
  estimateSavings(original: any[], stripped: any[]): { originalBytes: number; strippedBytes: number; savingsPct: number } {
    const originalBytes = JSON.stringify(original).length;
    const strippedBytes = JSON.stringify(stripped).length;
    const savingsPct = originalBytes > 0 ? Math.round(((originalBytes - strippedBytes) / originalBytes) * 100) : 0;
    return { originalBytes, strippedBytes, savingsPct };
  }
}

// ── Mobile API Adapter ─────────────────────────────────────────────────────

export class MobileApiAdapter {
  private cache: ResponseCache;
  private stripper: FieldStripper;
  private defaultPageSize: number;
  private maxPageSize: number;

  constructor(options?: { cacheMaxEntries?: number; defaultPageSize?: number; maxPageSize?: number }) {
    this.cache = new ResponseCache(options?.cacheMaxEntries ?? 100);
    this.stripper = new FieldStripper();
    this.defaultPageSize = options?.defaultPageSize ?? 20;
    this.maxPageSize = options?.maxPageSize ?? 100;
    log.info('[MobileApiAdapter] Initialized');
  }

  /**
   * Paginate a dataset with offset + cursor support
   */
  paginate<T>(items: T[], request: PaginationRequest): PaginatedResult<T> {
    const pageSize = Math.min(request.pageSize ?? this.defaultPageSize, this.maxPageSize);
    const page = Math.max(1, request.page ?? 1);

    // Cursor-based: decode cursor to page number
    let effectivePage = page;
    if (request.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(request.cursor, 'base64').toString());
        effectivePage = decoded.page ?? page;
      } catch {
        // Fall back to offset-based
      }
    }

    const start = (effectivePage - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    const hasMore = start + pageSize < items.length;

    const makeCursor = (p: number) => Buffer.from(JSON.stringify({ page: p })).toString('base64');

    return {
      items: paged,
      total: items.length,
      page: effectivePage,
      pageSize,
      hasMore,
      nextCursor: hasMore ? makeCursor(effectivePage + 1) : undefined,
      prevCursor: effectivePage > 1 ? makeCursor(effectivePage - 1) : undefined,
    };
  }

  /**
   * Create lightweight response with caching + field stripping
   */
  adaptResponse<T extends Record<string, any>>(
    endpoint: string,
    data: T[],
    options?: {
      cachePolicy?: CachePolicy;
      fieldSelector?: FieldSelector;
    }
  ): LightweightResponse<Partial<T>[]> {
    const start = Date.now();
    const policy = options?.cachePolicy ?? 'none';

    // Check cache
    const cacheKey = `${endpoint}:${JSON.stringify(options?.fieldSelector ?? {})}`;
    if (policy !== 'none') {
      const cached = this.cache.get<LightweightResponse<Partial<T>[]>>(cacheKey);
      if (cached) {
        return {
          ...cached,
          meta: { ...cached.meta, cached: true, responseTimeMs: Date.now() - start },
        };
      }
    }

    // Strip fields
    const { stripped, fieldsRemoved } = options?.fieldSelector
      ? this.stripper.strip(data, options.fieldSelector)
      : { stripped: data as Partial<T>[], fieldsRemoved: 0 };

    const savings = this.stripper.estimateSavings(data, stripped);

    const response: LightweightResponse<Partial<T>[]> = {
      data: stripped,
      meta: {
        cached: false,
        responseTimeMs: Date.now() - start,
        fieldsStripped: fieldsRemoved,
        originalSize: savings.originalBytes,
        compressedSize: savings.strippedBytes,
      },
    };

    // Store in cache
    if (policy !== 'none') {
      this.cache.set(cacheKey, response, policy);
    }

    return response;
  }

  /**
   * Batch adapt: paginate + strip + cache in one call
   */
  adaptPaginated<T extends Record<string, any>>(
    endpoint: string,
    items: T[],
    request: PaginationRequest,
    options?: {
      cachePolicy?: CachePolicy;
      fieldSelector?: FieldSelector;
    }
  ): LightweightResponse<PaginatedResult<Partial<T>>> {
    const start = Date.now();
    const paginated = this.paginate(items, request);

    const { stripped, fieldsRemoved } = options?.fieldSelector
      ? this.stripper.strip(paginated.items as T[], options.fieldSelector)
      : { stripped: paginated.items as Partial<T>[], fieldsRemoved: 0 };

    const savings = this.stripper.estimateSavings(paginated.items, stripped);

    return {
      data: { ...paginated, items: stripped },
      meta: {
        cached: false,
        responseTimeMs: Date.now() - start,
        fieldsStripped: fieldsRemoved,
        originalSize: savings.originalBytes,
        compressedSize: savings.strippedBytes,
      },
    };
  }

  /**
   * Invalidate cache for endpoint
   */
  invalidateCache(endpoint: string): number {
    return this.cache.invalidate(endpoint);
  }

  /**
   * Get adapter stats
   */
  getStats() {
    return this.cache.getStats();
  }

  reset(): void {
    this.cache.reset();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: MobileApiAdapter | null = null;

export function getMobileApiAdapter(options?: ConstructorParameters<typeof MobileApiAdapter>[0]): MobileApiAdapter {
  if (!_instance) _instance = new MobileApiAdapter(options);
  return _instance;
}

export function resetMobileApiAdapter(): void {
  _instance?.reset();
  _instance = null;
}

export default MobileApiAdapter;

// ── QClaw Compatibility Layer ─────────────────────────────────────────────
// Exports expected by tests/jvs-53-04-mobile-api-adapter.test.ts (QClaw)

/**
 * PaginationHelper — static paginate + cursorPaginate
 */
export const PaginationHelper = {
  paginate<T>(items: T[], opts: { page: number; pageSize: number }) {
    const { page, pageSize } = opts;
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);
    const totalPages = Math.ceil(items.length / pageSize);
    return {
      data,
      total: items.length,
      totalPages,
      page,
      pageSize,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  },

  cursorPaginate<T extends { id: string }>(items: T[], opts: { cursor?: string; limit: number }) {
    const { cursor, limit } = opts;
    let startIdx = 0;
    if (cursor) {
      const idx = items.findIndex(i => i.id === cursor);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }
    const data = items.slice(startIdx, startIdx + limit);
    const hasNext = startIdx + limit < items.length;
    return {
      data,
      hasNext,
      nextCursor: hasNext ? data[data.length - 1]?.id : undefined,
    };
  },
};

/**
 * LightweightResponse — strips heavy fields (code, backtestResult, etc.)
 */
const HEAVY_FIELDS = ['code', 'backtestResult', 'fullHistory', 'rawData', 'debugInfo'];

export class LightweightResponse {
  build<T extends Record<string, any>>(obj: T): Partial<T> {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!HEAVY_FIELDS.includes(k)) result[k] = v;
    }
    return result as Partial<T>;
  }

  buildList<T extends Record<string, any>>(items: T[]): Partial<T>[] {
    return items.map(item => this.build(item));
  }

  static estimateSize(obj: any): number {
    return JSON.stringify(obj).length;
  }
}

/**
 * RateLimiter — token bucket per client
 */
export class RateLimiter {
  private clients: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private maxTokens: number;
  private windowMs: number;

  constructor(maxTokens: number, windowMs: number) {
    this.maxTokens = maxTokens;
    this.windowMs = windowMs;
  }

  check(clientId: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    let client = this.clients.get(clientId);

    if (!client) {
      client = { tokens: this.maxTokens, lastRefill: now };
      this.clients.set(clientId, client);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - client.lastRefill;
    if (elapsed >= this.windowMs) {
      client.tokens = this.maxTokens;
      client.lastRefill = now;
    }

    if (client.tokens > 0) {
      client.tokens--;
      return { allowed: true, remaining: client.tokens, retryAfterMs: 0 };
    }

    const retryAfterMs = this.windowMs - elapsed;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  reset(clientId: string): void {
    this.clients.delete(clientId);
  }
}

/**
 * Response builders
 */
export function okResponse<T>(data: T) {
  return { ok: true as const, data, meta: undefined as any };
}

export function errorResponse(code: string, message: string, retryable: boolean = false) {
  return { ok: false as const, data: undefined as any, error: { code, message, retryable } };
}

export function cachedResponse<T>(data: T) {
  return { ok: true as const, data, meta: { cached: true } };
}

/**
 * Global singletons for QClaw tests
 */
let _globalCache: ResponseCache | null = null;
let _globalLimiter: RateLimiter | null = null;

export function getResponseCache(): ResponseCache {
  if (!_globalCache) _globalCache = new ResponseCache(300000, 100);
  return _globalCache;
}

export function getRateLimiter(): RateLimiter {
  if (!_globalLimiter) _globalLimiter = new RateLimiter(100, 60000);
  return _globalLimiter;
}

export function resetMobileApi(): void {
  _globalCache = null;
  _globalLimiter = null;
  resetMobileApiAdapter();
}
