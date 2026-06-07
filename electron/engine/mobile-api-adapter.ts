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

  constructor(maxEntries: number = 100) {
    this.maxEntries = maxEntries;
  }

  private getTtl(policy: CachePolicy): number {
    switch (policy) {
      case 'none': return 0;
      case 'short': return 30_000; // 30s
      case 'medium': return 300_000; // 5min
      case 'long': return 3600_000; // 1hr
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
   * Store response with cache policy
   */
  set<T>(key: string, data: T, policy: CachePolicy): void {
    const ttl = this.getTtl(policy);
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
