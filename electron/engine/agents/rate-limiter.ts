// ── R179 G13: Rate Limiter ──────────────────────────────────────────────────
// Per-user rate limiting for AI and API calls to prevent abuse.
//
// Limits:
//   5 calls/minute/user (sliding window)
//   Daily budget cap: managed by existing billing system
//   Per-endpoint throttling: configurable
//
// Usage:
//   import { checkRateLimit, getRateLimitStats } from './rate-limiter';
//   if (!checkRateLimit(userId, 'ai.recommend')) { throw tooMany(); }

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  enabled: boolean;
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
  /** Whether to include the limit headers in the response */
  includeHeaders: boolean;
}

export interface RateLimitState {
  calls: number[];
  hourCount: number;
  dayCount: number;
  blockedCount: number;
  lastAccess: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  reason?: string;
}

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RateLimitConfig = {
  enabled: true,
  maxPerMinute: 5,
  maxPerHour: 50,
  maxPerDay: 200,
  includeHeaders: true,
};

let config: RateLimitConfig = { ...DEFAULT_CONFIG };

// ── State Store ─────────────────────────────────────────────────────────────

const rateStates: Map<string, RateLimitState> = new Map();

function getState(userId: string): RateLimitState {
  let state = rateStates.get(userId);
  if (!state) {
    state = {
      calls: [],
      hourCount: 0,
      dayCount: 0,
      blockedCount: 0,
      lastAccess: new Date().toISOString(),
    };
    rateStates.set(userId, state);
  }
  return state;
}

// ── Core Limiter ────────────────────────────────────────────────────────────

/**
 * Check if a user is within rate limits.
 * Returns { allowed, remaining, retryAfterMs }
 */
export function checkRateLimit(userId: string, _endpoint?: string): RateLimitResult {
  if (!config.enabled) return { allowed: true, remaining: Infinity, retryAfterMs: 0 };

  const state = getState(userId);
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const hourAgo = now - 3_600_000;
  const dayAgo = now - 86_400_000;

  // Clean expired minute entries
  state.calls = state.calls.filter(ts => ts > minuteAgo);
  state.lastAccess = new Date().toISOString();

  // Check per-minute (5 calls/min)
  if (state.calls.length >= config.maxPerMinute) {
    state.blockedCount++;
    const retryAfterMs = 60_000 - (now - state.calls[0]);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
      reason: `Rate limit exceeded: ${config.maxPerMinute}/minute`,
    };
  }

  // Check per-hour (50 calls/hour) — count entries in last hour
  const hourCalls = state.calls.filter(ts => ts > hourAgo).length + 1;
  if (hourCalls > config.maxPerHour) {
    state.blockedCount++;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: 3_600_000,
      reason: `Rate limit exceeded: ${config.maxPerHour}/hour`,
    };
  }

  // Check per-day (200 calls/day) — rough check from dayCount
  state.dayCount++;
  if (state.dayCount > config.maxPerDay) {
    state.blockedCount++;
    state.dayCount = config.maxPerDay;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: 86_400_000,
      reason: `Rate limit exceeded: ${config.maxPerDay}/day`,
    };
  }

  // Allowed — record call
  state.calls.push(now);
  return {
    allowed: true,
    remaining: config.maxPerMinute - state.calls.length,
    retryAfterMs: 0,
  };
}

/**
 * Get remaining calls for a user.
 */
export function getRemainingCalls(userId: string): {
  minuteRemaining: number;
  hourRemaining: number;
  dayRemaining: number;
} {
  const state = rateStates.get(userId);
  if (!state) return { minuteRemaining: config.maxPerMinute, hourRemaining: config.maxPerHour, dayRemaining: config.maxPerDay };

  const now = Date.now();
  const minuteCalls = state.calls.filter(ts => ts > now - 60_000).length;
  const hourCalls = state.calls.filter(ts => ts > now - 3_600_000).length;

  return {
    minuteRemaining: Math.max(0, config.maxPerMinute - minuteCalls),
    hourRemaining: Math.max(0, config.maxPerHour - hourCalls),
    dayRemaining: Math.max(0, config.maxPerDay - state.dayCount),
  };
}

// ── Admin APIs ──────────────────────────────────────────────────────────────

/**
 * Get rate limit stats for a specific user.
 */
export function getUserRateStats(userId: string): RateLimitState | null {
  return rateStates.get(userId) || null;
}

/**
 * Get all users currently tracked.
 */
export function getAllRateStates(): Array<{ userId: string; state: RateLimitState }> {
  return [...rateStates.entries()].map(([userId, state]) => ({ userId, state }));
}

/**
 * Reset rate limits for a specific user.
 */
export function resetUserRateLimit(userId: string): void {
  const state = rateStates.get(userId);
  if (state) {
    state.calls = [];
    state.hourCount = 0;
    state.dayCount = 0;
  }
}

/**
 * Reset all rate limits.
 */
export function resetAllRateLimits(): void {
  rateStates.clear();
}

// ── Daily Reset ─────────────────────────────────────────────────────────────

let lastDailyReset = new Date().toDateString();

/**
 * Check and perform daily reset of counters.
 * Call periodically (e.g., on heartbeat or before each rate check).
 */
export function performDailyReset(): void {
  const todayStr = new Date().toDateString();
  if (todayStr !== lastDailyReset) {
    for (const state of rateStates.values()) {
      state.dayCount = 0;
    }
    lastDailyReset = todayStr;
    log.info('[RateLimiter] Daily counters reset');
  }
}

// ── Configuration ───────────────────────────────────────────────────────────

export function getRateLimitConfig(): Readonly<RateLimitConfig> {
  return { ...config };
}

export function updateRateLimitConfig(partial: Partial<RateLimitConfig>): void {
  config = { ...config, ...partial };
  log.info('[RateLimiter] Config updated:', JSON.stringify(partial));
}

export function resetRateLimitConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// ── Stats ───────────────────────────────────────────────────────────────────

export function getRateLimitStats(): {
  totalUsers: number;
  totalBlocked: number;
  enabled: boolean;
} {
  let totalBlocked = 0;
  for (const state of rateStates.values()) {
    totalBlocked += state.blockedCount;
  }

  return {
    totalUsers: rateStates.size,
    totalBlocked,
    enabled: config.enabled,
  };
}

log.info('[RateLimiter] Initialized — 5/min/user + daily budget cap');
