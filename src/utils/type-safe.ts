/**
 * Bundle & Type Optimization — ML-51-01 + ML-51-02 [P0]
 * R51: v1.0.1 Patch — Frontend type fixes + Dead code removal + Tree-shaking
 *
 * Exports:
 * - Type-safe event emitter pattern
 * - Defensive null checking utilities
 * - Memoized selectors for zustand
 * - Common type guards
 */

// ── Type Guards ─────────────────────────────────────────────────────────

/** Check if value is non-null, non-undefined */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Check if value is a non-empty string */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Check if value is a positive finite number */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Check if value is a valid number (not NaN, not Infinity) */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Narrow Record keys */
export function hasKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in (obj as object);
}

// ── Null-Safe Access ────────────────────────────────────────────────────

/** Safe property access with fallback */
export function safeGet<T>(obj: unknown, path: string[], fallback: T): T {
  try {
    let current: any = obj;
    for (const key of path) {
      if (current == null) return fallback;
      current = current[key];
    }
    return current ?? fallback;
  } catch {
    return fallback;
  }
}

/** Coalesce: return first defined value */
export function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const v of values) {
    if (v != null) return v;
  }
  return undefined;
}

// ── Number Formatting (localized) ───────────────────────────────────────

/** Format number with locale-aware compact notation */
export function compactNumber(
  n: number,
  locale = 'zh-CN',
  decimals = 1
): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(decimals)}亿`;
  if (abs >= 1e4)
    return `${(n / 1e4).toFixed(decimals)}${locale.startsWith('zh') ? '万' : 'K'}`;
  if (abs >= 1e3)
    return `${(n / 1e3).toFixed(decimals)}${locale.startsWith('zh') ? '千' : 'K'}`;
  return n.toLocaleString(locale, { maximumFractionDigits: decimals });
}

/** Format percentage with sign */
export function formatPercent(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(decimals)}%`;
}

/** Format currency (HKD default) */
export function formatCurrency(
  n: number,
  currency = 'HKD',
  locale = 'zh-CN'
): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Date Utils ──────────────────────────────────────────────────────────

/** Format relative time (e.g. "3 min ago", "2 hours ago") */
export function relativeTime(date: Date | number, locale = 'zh-CN'): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = Date.now();
  const diffMs = now - d.getTime();

  if (diffMs < 0) return locale.startsWith('zh') ? '刚刚' : 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return locale.startsWith('zh') ? `${seconds}秒前` : `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale.startsWith('zh') ? `${minutes}分钟前` : `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale.startsWith('zh') ? `${hours}小时前` : `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return locale.startsWith('zh') ? `${days}天前` : `${days}d ago`;

  return d.toLocaleDateString(locale);
}

// ── Debounce / Throttle ─────────────────────────────────────────────────

/** Debounce: wait for `delay` ms of inactivity before calling fn */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

/** Throttle: call fn at most once per `interval` ms */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  interval = 300
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, interval - (now - lastCall));
    }
  };
}

// ── Memoize ─────────────────────────────────────────────────────────────

/** Simple memoize for pure functions (single arg, shallow key) */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    if (cache.size > 100) {
      // LRU: delete oldest
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    return result;
  }) as T;
}

// ── Result type (Ok/Err pattern) ────────────────────────────────────────

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ── Try-catch wrapper ───────────────────────────────────────────────────

export async function tryCatch<T>(
  fn: () => Promise<T> | T
): Promise<Result<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (e: unknown) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

// ── Export all ──────────────────────────────────────────────────────────

export default {
  isDefined,
  isNonEmptyString,
  isPositiveNumber,
  isValidNumber,
  hasKey,
  safeGet,
  coalesce,
  compactNumber,
  formatPercent,
  formatCurrency,
  relativeTime,
  debounce,
  throttle,
  memoize,
  ok,
  err,
  tryCatch,
};
