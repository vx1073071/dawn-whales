/**
 * DAWN WHALES R147 Claw(PM) — TA Fee Service (TradingAgents Billing)
 * 
 * 3-tier billing for 4 TradingAgents:
 *   - TA Standard:  1.0 USDT/round
 *   - TA Advanced:  1.5 USDT/round
 *   - TA Ultimate:  2.0 USDT/round
 * 
 * v17.6 TA Rules (PERMANENT LOCK):
 *   - Pure per-use, no free rounds, no discount
 *   - Extra rounds charged at original price
 *   - Execution failure → NO CHARGE
 *   - 1 round = 1 complete execution cycle (receive signal→analyze→order→report)
 *   - Silent billing: no popup
 * 
 * ≥200L production-ready
 */

import Database from 'better-sqlite3';
import { BillingService, BillRequest, BillResult } from './billing-service';

// ═══════════════ Types ════════════════════════════════════════════════════

export type TATier = 'STANDARD' | 'ADVANCED' | 'ULTIMATE';

export interface TAExecutionRequest {
  userId: string;
  walletId: string;
  tier: TATier;
  signalId: string;
  strategyId?: string;
  idempotencyKey: string;
}

export interface TAExecutionResult {
  success: boolean;
  executionId: string;
  tier: TATier;
  priceUSDT: number;
  charged: boolean;
  signalId: string;
  orderExecuted: boolean;
  orderId?: string;
  error?: string;
  refunded?: boolean;
  refundReason?: string;
}

export interface TARoundStats {
  userId: string;
  totalRounds: number;
  totalCharged: number;
  totalRefunded: number;
  byTier: Record<TATier, { rounds: number; charged: number; refunded: number }>;
}

export interface OrderTypeSettings {
  strategyEntry: 'LIMIT' | 'MARKET';
  copytradeEntry: 'MARKET' | 'LIMIT';
  stopLoss: 'MARKET';
  takeProfit: 'LIMIT' | 'MARKET';
}

// ═══════════════ TA Price Table ═══════════════════════════════════════════

export const TA_PRICE_TABLE: Record<TATier, { priceUSDT: number; label: string }> = {
  STANDARD:  { priceUSDT: 1.0, label: 'TA Standard Agent' },
  ADVANCED:  { priceUSDT: 1.5, label: 'TA Advanced Agent' },
  ULTIMATE:  { priceUSDT: 2.0, label: 'TA Ultimate Agent' },
};

// ═══════════════ Default Order Type Settings ══════════════════════════════

export const DEFAULT_ORDER_TYPES: OrderTypeSettings = {
  strategyEntry: 'LIMIT',    // strategies default to limit orders
  copytradeEntry: 'MARKET', // copytrade must use market (slip tolerance)
  stopLoss: 'MARKET',       // stop loss MUST be market (non-negotiable)
  takeProfit: 'LIMIT',      // take profit defaults to limit (precision)
};

// ═══════════════ TA Fee Service ═══════════════════════════════════════════

export class TAFeeService {
  private db: Database.Database;
  private billingService: BillingService;

  constructor(db: Database.Database, billingService: BillingService) {
    this.db = db;
    this.billingService = billingService;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ta_executions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        signal_id TEXT NOT NULL,
        strategy_id TEXT,
        tier TEXT NOT NULL CHECK(tier IN ('STANDARD','ADVANCED','ULTIMATE')),
        price_usdt REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'CHARGED' CHECK(status IN ('CHARGED','EXECUTING','EXECUTED','FAILED','REFUNDED')),
        order_id TEXT,
        order_executed INTEGER NOT NULL DEFAULT 0,
        idempotency_key TEXT UNIQUE,
        charged_at TEXT NOT NULL DEFAULT (datetime('now')),
        executed_at TEXT,
        refunded_at TEXT,
        refund_reason TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (signal_id) REFERENCES signals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ta_user ON ta_executions(user_id);
      CREATE INDEX IF NOT EXISTS idx_ta_signal ON ta_executions(signal_id);
      CREATE INDEX IF NOT EXISTS idx_ta_idempotency ON ta_executions(idempotency_key);

      CREATE TABLE IF NOT EXISTS ta_round_counter (
        user_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        date TEXT NOT NULL,
        round_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, tier, date)
      );
    `);
  }

  // ── Charge & Execute TA ─────────────────────────────────────────────────

  chargeTAExecution(req: TAExecutionRequest): TAExecutionResult {
    const price = TA_PRICE_TABLE[req.tier].priceUSDT;
    const executionId = require('crypto').randomUUID();

    // Idempotency
    const existing = this.db.prepare(
      'SELECT * FROM ta_executions WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as any;

    if (existing) {
      const tier = existing.tier as TATier;
      return {
        success: existing.status !== 'REFUNDED',
        executionId: existing.id, tier,
        priceUSDT: existing.price_usdt,
        charged: existing.status === 'CHARGED',
        signalId: req.signalId,
        orderExecuted: existing.order_executed === 1,
        orderId: existing.order_id,
        refunded: existing.status === 'REFUNDED',
      };
    }

    let success = false;
    let error = '';

    try {
      this.db.transaction(() => {
        // Charge via billing service
        const billReq: BillRequest = {
          userId: req.userId,
          walletId: req.walletId,
          amountUSDT: price,
          entryType: 'TRADE_FEE',
          idempotencyKey: req.idempotencyKey,
          referenceId: req.signalId,
          description: `${TA_PRICE_TABLE[req.tier].label} execution`,
        };

        const billResult = this.billingService.deductBalance(billReq);

        if (!billResult.success) {
          throw new Error(billResult.error || 'Balance insufficient');
        }

        // Record execution
        this.db.prepare(`
          INSERT INTO ta_executions (id, user_id, wallet_id, signal_id, strategy_id, tier, price_usdt, status, idempotency_key)
          VALUES (?,?,?,?,?,?,?,'CHARGED',?)
        `).run(executionId, req.userId, req.walletId, req.signalId,
          req.strategyId || null, req.tier, price, req.idempotencyKey);

        // Increment round counter
        this.db.prepare(`
          INSERT INTO ta_round_counter (user_id, tier, date, round_count)
          VALUES (?,?,date('now'),1)
          ON CONFLICT(user_id, tier, date) DO UPDATE SET round_count = round_count + 1
        `).run(req.userId, req.tier);

        success = true;
      })();
    } catch (err: any) {
      error = err.message;
    }

    return {
      success, executionId,
      tier: req.tier, priceUSDT: price,
      charged: success, signalId: req.signalId,
      orderExecuted: false, error,
    };
  }

  // ── Mark Execution Complete / Failed ────────────────────────────────────

  markExecuted(executionId: string, orderId: string): boolean {
    const result = this.db.prepare(`
      UPDATE ta_executions SET status = 'EXECUTED', order_id = ?, order_executed = 1, executed_at = datetime('now')
      WHERE id = ? AND status = 'CHARGED'
    `).run(orderId, executionId);
    return result.changes > 0;
  }

  markFailed(executionId: string, reason: string): TAExecutionResult {
    const exec = this.db.prepare(
      'SELECT * FROM ta_executions WHERE id = ?'
    ).get(executionId) as any;

    if (!exec) {
      return { success: false, executionId, tier: 'STANDARD', priceUSDT: 0,
        charged: false, signalId: '', orderExecuted: false,
        error: 'Execution not found' };
    }

    if (exec.status === 'REFUNDED') {
      return { success: true, executionId, tier: exec.tier, priceUSDT: exec.price_usdt,
        charged: false, signalId: exec.signal_id, orderExecuted: false,
        refunded: true, refundReason: 'Already refunded' };
    }

    // Refund: execution failed → no charge!
    this.db.transaction(() => {
      // Refund via billing service
      this.billingService.refundBalance({
        billId: executionId,
        userId: exec.user_id,
        walletId: exec.wallet_id,
        amountUSDT: exec.price_usdt,
        reason: `TA execution failed: ${reason}`,
        entryType: 'REFUND',
        originalEntryType: 'TRADE_FEE',
      });

      // Mark as refunded
      this.db.prepare(`
        UPDATE ta_executions SET status = 'REFUNDED', refunded_at = datetime('now'), refund_reason = ?
        WHERE id = ?
      `).run(reason, executionId);
    })();

    return {
      success: true, executionId, tier: exec.tier as TATier,
      priceUSDT: exec.price_usdt, charged: false,
      signalId: exec.signal_id, orderExecuted: false,
      refunded: true, refundReason: reason,
    };
  }

  // ── Get User Stats ──────────────────────────────────────────────────────

  getTAStats(userId: string): TARoundStats {
    const rows = this.db.prepare(`
      SELECT tier, COUNT(*) as total,
        SUM(CASE WHEN status IN ('CHARGED','EXECUTED') THEN 1 ELSE 0 END) as charged_count,
        SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) as refunded_count,
        SUM(CASE WHEN status IN ('CHARGED','EXECUTED') THEN price_usdt ELSE 0 END) as charged_usdt,
        SUM(CASE WHEN status = 'REFUNDED' THEN price_usdt ELSE 0 END) as refunded_usdt
      FROM ta_executions WHERE user_id = ?
      GROUP BY tier
    `).all(userId) as any[];

    const byTier: Record<TATier, { rounds: number; charged: number; refunded: number }> = {
      STANDARD: { rounds: 0, charged: 0, refunded: 0 },
      ADVANCED: { rounds: 0, charged: 0, refunded: 0 },
      ULTIMATE: { rounds: 0, charged: 0, refunded: 0 },
    };

    let totalRounds = 0, totalCharged = 0, totalRefunded = 0;

    for (const r of rows) {
      const tier = r.tier as TATier;
      byTier[tier] = { rounds: r.total, charged: r.charged_usdt, refunded: r.refunded_usdt };
      totalRounds += r.total;
      totalCharged += r.charged_usdt;
      totalRefunded += r.refunded_usdt;
    }

    return { userId, totalRounds, totalCharged, totalRefunded, byTier };
  }

  // ── Get Daily Round Count ───────────────────────────────────────────────

  getDailyRounds(userId: string): number {
    const row = this.db.prepare(
      "SELECT COALESCE(SUM(round_count), 0) as total FROM ta_round_counter WHERE user_id = ? AND date = date('now')"
    ).get(userId) as any;
    return row.total;
  }

  // ── Get Execution History ───────────────────────────────────────────────

  getExecutionHistory(userId: string, limit = 20, offset = 0): any[] {
    return this.db.prepare(`
      SELECT * FROM ta_executions WHERE user_id = ?
      ORDER BY charged_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }
}
