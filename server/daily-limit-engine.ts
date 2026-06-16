
/**
 * QUANT MOO R139 J02 — Daily Copy Trade Limit Engine
 * 
 * Tracks per-user daily copy-trade limits and enforces them before
 * signal execution.  Exposes both a server-side engine and IPC handlers
 * so the UI can display remaining allowance.
 * 
 * Features:
 *  - Per-user daily limit (default: 50 trades/day)
 *  - Per-broker daily limit (default: 25 trades/day/broker)
 *  - Per-monetary-amount daily limit (default: none, configurable)
 *  - Reset at midnight UTC
 *  - IPC: query remaining allowance + force-reset for debugging
 *  - Pre-execution check (call before placeOrder)
 * 
 * Architecture:
 *   CopyTradeExecutor.executeSignal()
 *     → dailyLimitChecker.consume(userId, brokerId, amount)
 *        → if exceeded: skip + dead letter
 *        → else: proceed
 */

import { EventEmitter } from 'events';

// ═══════════════ Types ══════════════════════════════════

export interface DailyLimit {
  maxTradesPerDay: number;
  maxTradesPerBrokerDay: number;
  maxAmountPerDay: number;    // 0 = unlimited
  maxAmountPerBrokerDay: number; // 0 = unlimited
}

export interface DailyUsage {
  userId: string;
  date: string;            // YYYY-MM-DD (UTC)
  totalTrades: number;
  totalAmount: number;
  perBroker: Record<string, { trades: number; amount: number }>;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  remaining: {
    totalTrades: number;
    brokerTrades: number;
    totalAmount: number;
    brokerAmount: number;
  };
}

export interface DailyLimitConfig {
  defaultLimit: DailyLimit;
  /** Per-user overrides (e.g. VIP users get higher limits) */
  userOverrides: Map<string, Partial<DailyLimit>>;
}

// ═══════════════ Engine ═════════════════════════════════

export class DailyLimitEngine extends EventEmitter {
  private config: DailyLimitConfig;
  private usage: Map<string, DailyUsage> = new Map(); // key = userId:YYYY-MM-DD

  constructor(config?: Partial<DailyLimitConfig>) {
    super();
    this.config = {
      defaultLimit: {
        maxTradesPerDay: 50,
        maxTradesPerBrokerDay: 25,
        maxAmountPerDay: 0,        // unlimited by default
        maxAmountPerBrokerDay: 0,   // unlimited by default
      },
      userOverrides: new Map(),
      ...config,
    };
  }

  // ═══════════ Configuration ══════════════════════════════

  getEffectiveLimit(userId: string): DailyLimit {
    const override = this.config.userOverrides.get(userId);
    if (!override) return { ...this.config.defaultLimit };
    return { ...this.config.defaultLimit, ...override };
  }

  setUserLimit(userId: string, limit: Partial<DailyLimit>): void {
    this.config.userOverrides.set(userId, limit);
  }

  removeUserLimit(userId: string): void {
    this.config.userOverrides.delete(userId);
  }

  // ═══════════ Pre-execution Check ════════════════════════

  /**
   * Check whether a user has remaining daily allowance for a trade.
   * Returns false if the user has exceeded their daily limit.
   * DOES NOT consume — call consume() separately after order placed.
   */
  check(userId: string, brokerId: string, amount: number): LimitCheckResult {
    const limit = this.getEffectiveLimit(userId);
    const usage = this.getTodayUsage(userId);
    const brokerUsage = usage.perBroker[brokerId] ?? { trades: 0, amount: 0 };

    const remaining = {
      totalTrades: limit.maxTradesPerDay - usage.totalTrades,
      brokerTrades: limit.maxTradesPerBrokerDay - brokerUsage.trades,
      totalAmount: limit.maxAmountPerDay > 0
        ? limit.maxAmountPerDay - usage.totalAmount
        : Number.MAX_SAFE_INTEGER,
      brokerAmount: limit.maxAmountPerBrokerDay > 0
        ? limit.maxAmountPerBrokerDay - brokerUsage.amount
        : Number.MAX_SAFE_INTEGER,
    };

    // Check total trades
    if (usage.totalTrades >= limit.maxTradesPerDay) {
      return { allowed: false, reason: 'Daily trade limit reached', remaining };
    }

    // Check per-broker trades
    if (brokerUsage.trades >= limit.maxTradesPerBrokerDay) {
      return {
        allowed: false,
        reason: `Daily broker trade limit reached for ${brokerId}`,
        remaining,
      };
    }

    // Check total amount
    if (limit.maxAmountPerDay > 0 && usage.totalAmount + amount > limit.maxAmountPerDay) {
      return { allowed: false, reason: 'Daily amount limit reached', remaining };
    }

    // Check per-broker amount
    if (limit.maxAmountPerBrokerDay > 0 && brokerUsage.amount + amount > limit.maxAmountPerBrokerDay) {
      return {
        allowed: false,
        reason: `Daily broker amount limit reached for ${brokerId}`,
        remaining,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Consume a trade from the daily allowance (called after order succeeded).
   */
  consume(userId: string, brokerId: string, amount: number): void {
    const usage = this.getTodayUsage(userId);
    usage.totalTrades++;
    usage.totalAmount += amount;

    if (!usage.perBroker[brokerId]) {
      usage.perBroker[brokerId] = { trades: 0, amount: 0 };
    }
    usage.perBroker[brokerId].trades++;
    usage.perBroker[brokerId].amount += amount;

    const limit = this.getEffectiveLimit(userId);

    // Emit warning at 80%
    if (usage.totalTrades >= limit.maxTradesPerDay * 0.8) {
      this.emit('limitWarning', {
        userId,
        pct: usage.totalTrades / limit.maxTradesPerDay,
        remaining: limit.maxTradesPerDay - usage.totalTrades,
      });
    }

    // Emit event when limit is reached
    if (usage.totalTrades >= limit.maxTradesPerDay) {
      this.emit('limitReached', { userId, limit: limit.maxTradesPerDay });
    }
  }

  // ═══════════ Query ═══════════════════════════════════════

  getTodayUsage(userId: string): DailyUsage {
    const today = this.todayUTC();
    const key = `${userId}:${today}`;
    if (!this.usage.has(key)) {
      this.usage.set(key, {
        userId,
        date: today,
        totalTrades: 0,
        totalAmount: 0,
        perBroker: {},
      });
    }
    return this.usage.get(key)!;
  }

  getRemaining(userId: string, brokerId: string): LimitCheckResult {
    return this.check(userId, brokerId, 0);
  }

  /** Get usage for all users today (admin/dashboard). */
  getAllTodayUsage(): DailyUsage[] {
    const today = this.todayUTC();
    return Array.from(this.usage.values()).filter((u) => u.date === today);
  }

  // ═══════════ Admin ═══════════════════════════════════════

  /** Force reset a user's daily limits (admin override). */
  resetUser(userId: string): void {
    const today = this.todayUTC();
    const key = `${userId}:${today}`;
    this.usage.delete(key);
  }

  /** Reset all daily limits (called at midnight UTC via cron). */
  resetAll(): void {
    this.usage.clear();
    this.emit('reset');
  }

  /** Cleanup old entries (older than 2 days). */
  cleanup(): number {
    const today = this.todayUTC();
    let removed = 0;
    for (const [key, u] of this.usage) {
      if (u.date < today) {
        this.usage.delete(key);
        removed++;
      }
    }
    return removed;
  }

  dispose(): void {
    this.usage.clear();
    this.removeAllListeners();
  }

  // ═══════════ Private ══════════════════════════════════════

  private todayUTC(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
}

// ═══════════════ IPC Handlers ═══════════════════════════

/**
 * Register IPC handlers for the daily limit engine.
 * Call from electron/ipc setup.
 */
export function registerDailyLimitIPC(ipcMain: any, engine: DailyLimitEngine): void {
  // Handle: get remaining allowance
  ipcMain.handle('copytrade:getRemaining', (_event: any, userId: string, brokerId: string) => {
    return engine.getRemaining(userId, brokerId);
  });

  // Handle: get today's usage
  ipcMain.handle('copytrade:getTodayUsage', (_event: any, userId: string) => {
    return engine.getTodayUsage(userId);
  });

  // Handle: reset user limit (admin only — should gate with permission check)
  ipcMain.handle('copytrade:resetDailyLimit', (_event: any, userId: string) => {
    engine.resetUser(userId);
    return { success: true };
  });

  // Handle: get all users usage today (admin only)
  ipcMain.handle('copytrade:getAllTodayUsage', () => {
    return engine.getAllTodayUsage();
  });

  // Handle: check before trade
  ipcMain.handle('copytrade:checkDailyLimit', (
    _event: any,
    userId: string,
    brokerId: string,
    amount: number,
  ) => {
    return engine.check(userId, brokerId, amount);
  });
}

// ═══════════════ Singleton ═══════════════════════════════

let _dailyLimit: DailyLimitEngine | null = null;

export function getDailyLimitEngine(config?: Partial<DailyLimitConfig>): DailyLimitEngine {
  if (!_dailyLimit) {
    _dailyLimit = new DailyLimitEngine(config);
  }
  return _dailyLimit;
}
