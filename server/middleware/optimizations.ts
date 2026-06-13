// @ts-nocheck
/**
 * DAWN WHALES R148 J02 — Performance Optimizations
 * 
 * 1. Batch queries: combine multiple queries into one transaction
 * 2. Index optimization: ensure all critical indexes exist
 * 3. Caching: LRU in-memory cache for frequent reads (dashboard, wallet balance, AI results)
 * 4. Rate limiting: 100 req/min general + AI-specific limits
 * 
 * ≥300L
 */

import Database from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';

// ═══════════════ LRU Cache ═════════════════════════════════════════════

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T> {
  private maxSize: number;
  private ttlMs: number;
  private cache: Map<string, CacheEntry<T>>;

  constructor(maxSize = 500, ttlMs = 60000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU: delete and re-insert to move to end
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }

    // Delete existing to update position
    this.cache.delete(key);
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hitRate: 0, // tracked externally
    };
  }
}

// ═══════════════ Index Optimizer ═══════════════════════════════════════

export class IndexOptimizer {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Ensure all critical indexes exist.
   */
  ensureIndexes(): string[] {
    const created: string[] = [];
    const indexDefs = [
      // Wallet
      'CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger_entries(wallet_id)',
      'CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(created_at)',
      // Transactions
      'CREATE INDEX IF NOT EXISTS idx_transfer_from ON internal_transfers(from_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_transfer_to ON internal_transfers(to_user_id)',
      // AI
      'CREATE INDEX IF NOT EXISTS idx_ai_bills_user ON ai_bills(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_ai_bills_status ON ai_bills(status)',
      // Marketplace
      'CREATE INDEX IF NOT EXISTS idx_marketplace_published ON marketplace_products(published)',
      'CREATE INDEX IF NOT EXISTS idx_marketplace_sales ON marketplace_products(sales_count)',
      'CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id)',
      // TA
      'CREATE INDEX IF NOT EXISTS idx_ta_rounds_user ON ta_execution_rounds(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_trade_detail_user ON trade_details(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_trade_detail_date ON trade_details(executed_at)',
      // Subscription
      'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)',
      // Signals/copy trade
      'CREATE INDEX IF NOT EXISTS idx_copy_trades_user ON copy_trades(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_copy_trades_status ON copy_trades(status)',
    ];

    for (const sql of indexDefs) {
      try {
        this.db.exec(sql);
        created.push(sql.split('ON')[1]?.split('(')[0]?.trim() || sql);
      } catch (e: any) {
        console.warn(`[Index] Failed to create index: ${e.message}`);
      }
    }

    return created;
  }

  /**
   * Analyze query performance.
   */
  analyzeQueryPlan(sql: string, params?: any[]): any {
    const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params || []));
    return plan;
  }

  /**
   * Run VACUUM and ANALYZE for SQLite optimization.
   */
  optimize(): void {
    this.db.exec('PRAGMA optimize');
    this.db.exec('PRAGMA analysis_limit=1000');
    this.db.exec('ANALYZE');
  }
}

// ═══════════════ Rate Limiter ══════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private store: Map<string, RateLimitEntry>;

  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.store = new Map();
  }

  /**
   * Check if request is allowed. Returns true if within limit.
   */
  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    let entry = this.store.get(key);

    // New window
    if (!entry || now > entry.windowStart + this.windowMs) {
      entry = { count: 1, windowStart: now };
      this.store.set(key, entry);
      return { allowed: true, remaining: this.maxRequests - 1, resetMs: this.windowMs };
    }

    entry.count++;
    if (entry.count > this.maxRequests) {
      const resetMs = entry.windowStart + this.windowMs - now;
      return { allowed: false, remaining: 0, resetMs };
    }

    return { allowed: true, remaining: this.maxRequests - entry.count, resetMs: entry.windowStart + this.windowMs - now };
  }

  /**
   * Reset a key.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup stale entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.windowStart + this.windowMs + 60000) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    return {
      activeWindows: this.store.size,
      maxPerWindow: this.maxRequests,
      windowMs: this.windowMs,
    };
  }
}

// ═══════════════ Express Middlewares ════════════════════════════════════

export function rateLimitMiddleware(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || (req as any).user?.userId || 'anonymous';
    const { allowed, remaining, resetMs } = limiter.check(key);

    res.set('X-RateLimit-Limit', String(limiter['maxRequests']));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(resetMs / 1000)));

    if (!allowed) {
      res.status(429).json({
        status: 429,
        code: 'RATE_LIMITED',
        message: `Too many requests. Try again in ${Math.ceil(resetMs / 1000)}s.`,
        retryAfter: Math.ceil(resetMs / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * AI-specific rate limiter — stricter than general.
 * 10 req/minute for expensive AI calls (2U+).
 */
export class AIRateLimiter extends RateLimiter {
  constructor() {
    super(60000, 10);
  }
}

// ═══════════════ Batch Transaction Helper ═══════════════════════════════

export class BatchExecutor {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Execute multiple statements in a single transaction.
   */
  batch(queries: Array<{ sql: string; params?: any[] }>): any[] {
    const results: any[] = [];
    const txn = this.db.transaction(() => {
      for (const q of queries) {
        const stmt = this.db.prepare(q.sql);
        if (q.sql.trim().toUpperCase().startsWith('SELECT')) {
          results.push(stmt.all(...(q.params || [])));
        } else {
          results.push(stmt.run(...(q.params || [])));
        }
      }
    });
    txn();
    return results;
  }

  /**
   * Batch insert for performance.
   */
  batchInsert(table: string, columns: string[], rows: any[][]): void {
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;

    const txn = this.db.transaction(() => {
      const stmt = this.db.prepare(sql);
      for (const row of rows) {
        stmt.run(...row);
      }
    });
    txn();
  }
}

// ═══════════════ Cache for AI Results (1h TTL) ═════════════════════════

export class AIResultCache {
  private cache: LRUCache<any>;

  constructor() {
    // 1-hour TTL for AI results (same K-line + symbol)
    this.cache = new LRUCache(200, 3600000);
  }

  getCacheKey(serviceName: string, symbol: string, dataHash: string): string {
    return `ai:${serviceName}:${symbol}:${dataHash}`;
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}
