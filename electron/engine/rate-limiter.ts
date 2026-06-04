// ── Rate Limiter (JVS-38) ────────────────────────────────────────────────────
// Prevent EM API overload using sliding window algorithm
// Per-API and global rate limiting

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number;         // Sliding window size in ms
  maxRequests: number;      // Max requests per window
  burstLimit?: number;      // Burst allowance (default: maxRequests)
  retryAfterMs?: number;    // Default retry delay
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;        // Remaining requests in current window
  resetAt: number;          // Timestamp when window resets
  retryAfterMs?: number;    // If blocked, how long to wait
}

interface RequestRecord {
  timestamp: number;
}

interface LimiterState {
  requests: RequestRecord[];
  burstTokens: number;
  lastBurstUpdate: number;
}

// ── Default Configs ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60000,          // 1 minute
  maxRequests: 60,          // 60 requests per minute
  burstLimit: 10,           // 10 burst requests
  retryAfterMs: 1000,       // 1 second default retry
};

const API_CONFIGS: Record<string, RateLimitConfig> = {
  'push2-eastmoney': {
    windowMs: 1000,         // 1 second
    maxRequests: 5,         // 5 requests per second
    burstLimit: 10,
    retryAfterMs: 200,
  },
  'datacenter-eastmoney': {
    windowMs: 1000,
    maxRequests: 3,         // 3 requests per second
    burstLimit: 5,
    retryAfterMs: 333,
  },
  'python-skill': {
    windowMs: 60000,
    maxRequests: 30,        // 30 per minute (slower)
    burstLimit: 5,
    retryAfterMs: 2000,
  },
};

// ── Rate Limiter Class ─────────────────────────────────────────────────────

class RateLimiter {
  private config: RateLimitConfig;
  private state: LimiterState;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.state = {
      requests: [],
      burstTokens: config.burstLimit || config.maxRequests,
      lastBurstUpdate: Date.now(),
    };
  }

  check(): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Clean old requests outside window
    this.state.requests = this.state.requests.filter(r => r.timestamp > windowStart);

    // Refill burst tokens
    const timeSinceUpdate = now - this.state.lastBurstUpdate;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = timeSinceUpdate * refillRate;
    this.state.burstTokens = Math.min(
      this.config.burstLimit || this.config.maxRequests,
      this.state.burstTokens + tokensToAdd
    );
    this.state.lastBurstUpdate = now;

    const currentRequests = this.state.requests.length;
    const remaining = Math.max(0, this.config.maxRequests - currentRequests);
    const resetAt = this.state.requests.length > 0
      ? this.state.requests[0].timestamp + this.config.windowMs
      : now + this.config.windowMs;

    // Check if allowed
    if (currentRequests >= this.config.maxRequests) {
      // Rate limit exceeded
      const retryAfterMs = this.config.retryAfterMs || (resetAt - now);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs,
      };
    }

    if (this.state.burstTokens < 1) {
      // Burst limit exceeded
      return {
        allowed: false,
        remaining,
        resetAt,
        retryAfterMs: 100,
      };
    }

    // Allowed - record request
    this.state.requests.push({ timestamp: now });
    this.state.burstTokens -= 1;

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  }

  getStats() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const currentRequests = this.state.requests.filter(r => r.timestamp > windowStart).length;

    return {
      currentRequests,
      maxRequests: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - currentRequests),
      burstTokens: this.state.burstTokens,
      windowMs: this.config.windowMs,
    };
  }

  reset(): void {
    this.state.requests = [];
    this.state.burstTokens = this.config.burstLimit || this.config.maxRequests;
    this.state.lastBurstUpdate = Date.now();
  }
}

// ── Rate Limiter Manager ───────────────────────────────────────────────────

class RateLimiterManager {
  private limiters: Map<string, RateLimiter> = new Map();
  private globalLimiter: RateLimiter;

  constructor() {
    // Global limiter: 100 requests per minute
    this.globalLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      burstLimit: 20,
      retryAfterMs: 600,
    });
    log.info('[RateLimiter] Manager initialized with global limit (100/min)');
  }

  getLimiter(apiName: string): RateLimiter {
    if (!this.limiters.has(apiName)) {
      const config = API_CONFIGS[apiName] || DEFAULT_CONFIG;
      this.limiters.set(apiName, new RateLimiter(config));
      log.debug(`[RateLimiter] Created limiter for ${apiName}`);
    }
    return this.limiters.get(apiName)!;
  }

  check(apiName: string): RateLimitResult {
    // Check global limiter first
    const globalResult = this.globalLimiter.check();
    if (!globalResult.allowed) {
      log.warn(`[RateLimiter] Global limit exceeded, retry after ${globalResult.retryAfterMs}ms`);
      return globalResult;
    }

    // Check API-specific limiter
    const limiter = this.getLimiter(apiName);
    const result = limiter.check();

    if (!result.allowed) {
      log.warn(`[RateLimiter] ${apiName} limit exceeded, retry after ${result.retryAfterMs}ms`);
    }

    return result;
  }

  async waitAndRetry(apiName: string, retryAfterMs: number): Promise<void> {
    log.debug(`[RateLimiter] Waiting ${retryAfterMs}ms before retry for ${apiName}`);
    return new Promise(resolve => setTimeout(resolve, retryAfterMs));
  }

  async executeWithLimit<T>(apiName: string, fn: () => Promise<T>): Promise<T> {
    const result = this.check(apiName);

    if (!result.allowed) {
      await this.waitAndRetry(apiName, result.retryAfterMs || 1000);
      return this.executeWithLimit(apiName, fn);
    }

    return fn();
  }

  getStats(apiName?: string): any {
    if (apiName) {
      const limiter = this.limiters.get(apiName);
      return limiter ? limiter.getStats() : null;
    }

    const stats: Record<string, any> = {
      global: this.globalLimiter.getStats(),
      apis: {},
    };

    for (const [name, limiter] of this.limiters.entries()) {
      stats.apis[name] = limiter.getStats();
    }

    return stats;
  }

  resetAll(): void {
    this.globalLimiter.reset();
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
    log.info('[RateLimiter] All limiters reset');
  }

  getAvailableAPIs(): string[] {
    return Object.keys(API_CONFIGS);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let rateLimiterManagerInstance: RateLimiterManager | null = null;

export function getRateLimiterManager(): RateLimiterManager {
  if (!rateLimiterManagerInstance) {
    rateLimiterManagerInstance = new RateLimiterManager();
  }
  return rateLimiterManagerInstance;
}

export { RateLimiter, RateLimiterManager };
