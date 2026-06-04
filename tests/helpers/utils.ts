// ─────────────────────────────────────────────────────────────────
// tests/helpers/utils.ts
// Common assertion utilities and test helpers
// ─────────────────────────────────────────────────────────────────

import { expect, type MatcherResult } from 'vitest';

// ── Numeric Assertions ────────────────────────────────────────────

/** Assert a number is within a relative tolerance */
export function toBeCloseTo(received: number, expected: number, tolerance = 0.01) {
  const pass = Math.abs(received - expected) <= tolerance * Math.abs(expected);
  return {
    pass,
    message: () =>
      pass
        ? `Expected ${received} not to be close to ${expected} (tolerance ${tolerance})`
        : `Expected ${received} to be close to ${expected} (diff ${Math.abs(received - expected)})`,
  } as MatcherResult;
}

/** Assert a value is within [min, max] */
export function toBeBetween(received: number, min: number, max: number) {
  const pass = received >= min && received <= max;
  return {
    pass,
    message: () =>
      pass
        ? `Expected ${received} not to be between ${min} and ${max}`
        : `Expected ${received} to be between ${min} and ${max}`,
  } as MatcherResult;
}

// Extend expect with custom matchers
expect.extend({
  toBeCloseTo(received: number, expected: number, tolerance?: number) {
    return toBeCloseTo(received, expected, tolerance);
  },
  toBeBetween(received: number, min: number, max: number) {
    return toBeBetween(received, min, max);
  },
});

// ── Array Assertions ───────────────────────────────────────────────

/** Assert array is sorted in descending order */
export function toBeSortedDesc(arr: number[]) {
  const pass = arr.every((v, i) => i === 0 || arr[i - 1] >= v);
  return {
    pass,
    message: () =>
      pass
        ? `Array ${arr} is not sorted descending`
        : `Array ${arr} is sorted descending`,
  } as MatcherResult;
}

expect.extend({
  toBeSortedDesc(received: number[]) {
    return toBeSortedDesc(received);
  },
});

// ── IPC Response Assertions ────────────────────────────────────────

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function assertIpcOk<T>(res: IpcResponse<T>, message?: string): asserts res is IpcResponse<T> & { data: T } {
  expect(res.success, message ?? `Expected success=true, got error: ${res.error}`).toBe(true);
}

export function assertIpcErr<T>(res: IpcResponse<T>, contains?: string) {
  expect(res.success, `Expected failure, got success with data: ${JSON.stringify(res.data)}`).toBe(false);
  if (contains) {
    expect(res.error ?? '', `Error message should contain: ${contains}`).toContain(contains);
  }
}

// ── Promise Assertions ─────────────────────────────────────────────

/** Assert a promise rejects */
export async function assertRejects(promise: Promise<unknown>, message?: string) {
  try {
    await promise;
    throw new Error(message ?? 'Expected promise to reject, but it resolved');
  } catch (e) {
    // expected
  }
}

// ── Test Timer Utilities ──────────────────────────────────────────

/** Measure execution time of a function */
export async function measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms: +ms.toFixed(2) };
}

/** Assert execution time is under threshold */
export async function assertTimeUnder(fn: () => unknown | Promise<unknown>, maxMs: number) {
  const { ms } = await measureTime(fn);
  expect(ms, `Execution took ${ms}ms, expected < ${maxMs}ms`).toBeLessThan(maxMs);
}

// ── Deep Clone Helper ──────────────────────────────────────────────

export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
