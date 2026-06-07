/**
 * J-53-04: Mobile API Adapter (R53 P1)
 * 移动端 API 适配层 — 分页/轻量响应/缓存/节流
 *
 * Features:
 * - Pagination helper (cursor-based + offset-based)
 * - Lightweight response builder (strip heavy fields for mobile)
 * - Response cache with TTL
 * - Rate limiting / throttle per client
 * - Mobile-optimized error responses
 *
 * ≥200L, 10+ tests
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  nextCursor?: string;
  prevCursor?: string;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  size: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

export interface MobileResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta?: {
    cached: boolean;
    responseTimeMs: number;
    pagination?: Partial<PaginatedResult<T>>;
  };
}

// ── Pagination Helper ──────────────────────────────────────────────────────

export class PaginationHelper {
  static paginate<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Cursor-based pagination for mobile (uses item ID as cursor)
   */
  static cursorPaginate<T extends { id: string }>(
    items: T[],
    params: { cursor?: string; limit?: number }
  ): PaginatedResult<T> {
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    let startIndex = 0;
    if (params.cursor) {
      const cursorIdx = items.findIndex(i => i.id === params.cursor);
      if (cursorIdx >= 0) startIndex = cursorIdx + 1;
    }

    const data = items.slice(startIndex, startIndex + limit);
    const nextCursor = data.length === limit && startIndex + limit < items.length
      ? data[data.length - 1].id
      : undefined;
    const prevCursor = startIndex > 0 ? items[startIndex - 1].id : undefined;

    return {
      data,
      total: items.length,
      page: Math.floor(startIndex / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(items.length / limit),
      nextCursor,
      prevCursor,
      hasNext: !!nextCursor,
      hasPrev: startIndex > 0,
    };
  }
}

// ── Lightweight Response Builder ───────────────────────────────────────────

export class LightweightResponse {
  private stripFields: Set<string>;

  constructor(fieldsToStrip: string[] = ['code', 'backtestResult', 'config', 'auditNote']) {
    this.stripFields = new Set(fieldsToStrip);
  }

  /**
   * Strip heavy fields from a response object for mobile bandwidth savings
   */
  build<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const result = { ...obj };
    for (const field of this.stripFields) {
      delete (result as Record<string, unknown>)[field];
    }
    return result;
  }

  /**
   * Build lightweight list response
   */
  buildList<T extends Record<string, unknown>>(items: T[]): Partial<T>[] {
    return items.map(item => this.build(item));
  }

  /**
   * Estimate JSON size in bytes
   */
  static estimateSize(obj: unknown): number {
    return JSON.stringify(obj).length;
  }
}

// ── Response Cache ─────────────────────────────────────────────────────────

export class ResponseCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTtlMs: number;
  private maxSize: number;

  constructor(defaultTtlMs: number = 30000, maxSize: number = 100) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    // Evict expired entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictExpired();
    }
    // If still at capacity, evict oldest
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.defaultTtlMs),
      size: JSON.stringify(data).length,
    });
  }

  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// ── Rate Limiter ───────────────────────────────────────────────────────────

export class RateLimiter {
  private windows: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(clientId: string): RateLimitResult {
    const now = Date.now();
    let window = this.windows.get(clientId);

    if (!window || now > window.resetAt) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(clientId, window);
    }

    window.count++;

    if (window.count > this.maxRequests) {
      const retryAfterMs = window.resetAt - now;
      return {
        allowed: false,
        remaining: 0,
        resetAt: window.resetAt,
        retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - window.count,
      resetAt: window.resetAt,
      retryAfterMs: 0,
    };
  }

  reset(clientId?: string): void {
    if (clientId) {
      this.windows.delete(clientId);
    } else {
      this.windows.clear();
    }
  }

  getClientCount(clientId: string): number {
    const window = this.windows.get(clientId);
    if (!window || Date.now() > window.resetAt) return 0;
    return window.count;
  }
}

// ── Mobile Response Builder ────────────────────────────────────────────────

export function okResponse<T>(data: T, meta?: Record<string, unknown>): MobileResponse<T> {
  return { ok: true, data, meta: { cached: false, responseTimeMs: 0, ...meta } };
}

export function errorResponse(code: string, message: string, retryable: boolean = false): MobileResponse<never> {
  return { ok: false, error: { code, message, retryable }, meta: { cached: false, responseTimeMs: 0 } };
}

export function cachedResponse<T>(data: T): MobileResponse<T> {
  return { ok: true, data, meta: { cached: true, responseTimeMs: 0 } };
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _cache: ResponseCache | null = null;
let _limiter: RateLimiter | null = null;

export function getResponseCache(): ResponseCache {
  if (!_cache) _cache = new ResponseCache();
  return _cache;
}

export function getRateLimiter(): RateLimiter {
  if (!_limiter) _limiter = new RateLimiter();
  return _limiter;
}

export function resetMobileApi(): void {
  _cache?.clear();
  _limiter?.reset();
  _cache = null;
  _limiter = null;
}

export default {
  PaginationHelper,
  LightweightResponse,
  ResponseCache,
  RateLimiter,
  okResponse,
  errorResponse,
  cachedResponse,
};
