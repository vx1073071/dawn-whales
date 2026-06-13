// @ts-nocheck
/**
 * DAWN WHALES R145 J02 — AI Billing Unified Interface
 * 
 * Billing pipeline for ALL AI services (drawlines, chat, param-fill).
 * 
 * v17.6 AI Billing Rules (PERMANENT):
 *  - All AI features: 1 USDT per use, pure per-use, no free tier, no subscription
 *  - Silent billing: no popup, click = charge immediately
 *  - Charge BEFORE calling DeepSeek (扣了再调!)
 *  - Failure refund: if analysis/model call fails → refund 1 USDT
 *  - No natural-language-to-code, param-fill only
 * 
 * AI Price Table:
 *  AI_DRAW_LINES       — 1 USDT/次
 *  AI_CHAT            — 1 USDT/次
 *  AI_PARAM_FILL       — 1 USDT/次
 *  AI_PATTERN_RECOG    — 1 USDT/次
 * 
 * Flow:
 *   1. billAIService() — charge immediately
 *   2. Call DeepSeek
 *   3. If failure → refundAIService()
 * 
 * ≥200L
 */

import Database from 'better-sqlite3';

export type AIServiceType = 'AI_DRAW_LINES' | 'AI_CHAT' | 'AI_PARAM_FILL' | 'AI_PATTERN_RECOG';

export const AI_PRICE_TABLE: Record<AIServiceType, { priceUSDT: number; label: string }> = {
  AI_DRAW_LINES:     { priceUSDT: 1, label: 'AI Auto Drawlines' },
  AI_CHAT:           { priceUSDT: 1, label: 'AI Chat' },
  AI_PARAM_FILL:     { priceUSDT: 1, label: 'AI Strategy Param Fill' },
  AI_PATTERN_RECOG:  { priceUSDT: 1, label: 'AI Pattern Recognition' },
};

export interface AIBillRequest {
  userId: string;
  walletId: string;
  serviceType: AIServiceType;
  /**
   * If provided, this overrides the standard price (fallback chain pricing).
   * V4 Pro (discount) < V4 Pro (full) < V4 Flash < MiniMax-M3
   */
  customPriceUSDT?: number;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface AIBillResult {
  success: boolean;
  billId: string;
  serviceType: AIServiceType;
  amountUSDT: number;
  userId: string;
  charged: boolean;
  error?: string;
}

export interface AIRefundRequest {
  billId: string;
  userId: string;
  reason: string;
}

export interface AIUsageStats {
  userId: string;
  totalSpentUSDT: number;
  totalCalls: number;
  totalRefunds: number;
  breakdown: Record<string, { calls: number; spentUSDT: number; refunded: number }>;
}

// ═══════════════ AI Billing Service ══════════════════════════════════════

export class AIBillingService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_bills (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        service_type TEXT NOT NULL CHECK(service_type IN ('AI_DRAW_LINES','AI_CHAT','AI_PARAM_FILL','AI_PATTERN_RECOG')),
        amount_usdt REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'CHARGED' CHECK(status IN ('CHARGED','REFUNDED')),
        idempotency_key TEXT UNIQUE,
        metadata TEXT,
        charged_at TEXT NOT NULL DEFAULT (datetime('now')),
        refunded_at TEXT,
        refund_reason TEXT,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_bills_user ON ai_bills(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_bills_idempotency ON ai_bills(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_ai_bills_charged ON ai_bills(charged_at);
    `);
  }

  /**
   * Charge user for AI service.
   * ⚠️ MUST call BEFORE DeepSeek API call!
   * Returns billId for later refund if needed.
   */
  billAIService(req: AIBillRequest): AIBillResult {
    // Idempotency first
    const idemp = this.db.prepare(
      'SELECT id, status, amount_usdt FROM ai_bills WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as { id: string; status: string; amount_usdt: number } | undefined;

    if (idemp) {
      if (idemp.status === 'REFUNDED') {
        return { success: false, billId: idemp.id, serviceType: req.serviceType,
          amountUSDT: idemp.amount_usdt, userId: req.userId, charged: false,
          error: 'Idempotency key already used and refunded' };
      }
      return { success: true, billId: idemp.id, serviceType: req.serviceType,
        amountUSDT: idemp.amount_usdt, userId: req.userId, charged: true };
    }

    const price = req.customPriceUSDT ?? AI_PRICE_TABLE[req.serviceType].priceUSDT;

    // Check wallet balance
    const wallet = this.db.prepare(
      'SELECT * FROM wallets WHERE id=? AND user_id=?'
    ).get(req.walletId, req.userId) as any;

    if (!wallet) {
      return { success: false, billId: '', serviceType: req.serviceType,
        amountUSDT: price, userId: req.userId, charged: false,
        error: 'Wallet not found or access denied' };
    }

    if (wallet.usdt_balance < price) {
      return { success: false, billId: '', serviceType: req.serviceType,
        amountUSDT: price, userId: req.userId, charged: false,
        error: `Insufficient balance: need ${price}, have ${wallet.usdt_balance}` };
    }

    // Atomic charge
    let billId = '';
    const txResult = this.db.transaction(() => {
      // Debit
      const newBalance = roundUSD(wallet.usdt_balance - price);
      const newVersion = wallet.version + 1;
      const checksum = computeChecksum(newBalance, wallet.usdt_frozen, newVersion);

      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(newBalance, checksum, newVersion, req.walletId, wallet.version);

      // Create bill
      billId = generateId();
      const metadata = req.metadata ? JSON.stringify(req.metadata) : null;

      this.db.prepare(`
        INSERT INTO ai_bills (id, user_id, wallet_id, service_type, amount_usdt, idempotency_key, metadata)
        VALUES (?,?,?,?,?,?,?)
      `).run(billId, req.userId, req.walletId, req.serviceType, price, req.idempotencyKey, metadata);

      // Ledger entry
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(req.walletId, req.userId, 'AI_SERVICE', -price, newBalance, billId,
        `${req.idempotencyKey}_bill`, `${AI_PRICE_TABLE[req.serviceType].label}`);
    }) as (() => void);

    try {
      txResult();
    } catch (err: any) {
      return { success: false, billId: '', serviceType: req.serviceType,
        amountUSDT: price, userId: req.userId, charged: false,
        error: `Transaction failed: ${err.message}` };
    }

    return { success: true, billId, serviceType: req.serviceType,
      amountUSDT: price, userId: req.userId, charged: true };
  }

  /**
   * Refund a failed AI service call.
   */
  refundAIService(req: AIRefundRequest): AIBillResult {
    const bill = this.db.prepare(
      'SELECT * FROM ai_bills WHERE id=? AND user_id=?'
    ).get(req.billId, req.userId) as any;

    if (!bill) {
      return { success: false, billId: req.billId, serviceType: 'AI_CHAT',
        amountUSDT: 0, userId: req.userId, charged: false,
        error: 'Bill not found' };
    }

    if (bill.status === 'REFUNDED') {
      return { success: false, billId: req.billId, serviceType: bill.service_type,
        amountUSDT: bill.amount_usdt, userId: req.userId, charged: false,
        error: 'Already refunded' };
    }

    // Get wallet
    const wallet = this.db.prepare('SELECT * FROM wallets WHERE id=?').get(bill.wallet_id) as any;

    this.db.transaction(() => {
      // Credit back
      const newBalance = roundUSD((wallet?.usdt_balance || 0) + bill.amount_usdt);
      const newVersion = (wallet?.version || 0) + 1;
      const frozen = wallet?.usdt_frozen || 0;
      const checksum = computeChecksum(newBalance, frozen, newVersion);

      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=?"
      ).run(newBalance, checksum, newVersion, bill.wallet_id);

      // Mark bill refunded
      this.db.prepare(
        "UPDATE ai_bills SET status='REFUNDED', refunded_at=datetime('now'), refund_reason=? WHERE id=?"
      ).run(req.reason, req.billId);

      // Ledger refund entry
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, description)
        VALUES (?,?,?,?,?,?,?)
      `).run(bill.wallet_id, req.userId, 'AI_REFUND', bill.amount_usdt, newBalance,
        req.billId, `Refund: ${req.reason}`);
    })();

    return { success: true, billId: req.billId, serviceType: bill.service_type as AIServiceType,
      amountUSDT: bill.amount_usdt, userId: req.userId, charged: false };
  }

  /**
   * Get user AI usage stats.
   */
  getAIUsageStats(userId: string): AIUsageStats {
    const rows = this.db.prepare(
      "SELECT * FROM ai_bills WHERE user_id = ?"
    ).all(userId) as any[];

    const breakdown: Record<string, { calls: number; spentUSDT: number; refunded: number }> = {};

    let totalSpent = 0;
    let totalCalls = 0;
    let totalRefunds = 0;

    for (const r of rows) {
      const st = r.service_type;
      if (!breakdown[st]) {
        breakdown[st] = { calls: 0, spentUSDT: 0, refunded: 0 };
      }

      if (r.status === 'REFUNDED') {
        breakdown[st].refunded++;
        totalRefunds++;
      } else {
        breakdown[st].spentUSDT += r.amount_usdt;
        totalSpent += r.amount_usdt;
      }
      breakdown[st].calls++;
      totalCalls++;
    }

    return { userId, totalSpentUSDT: totalSpent, totalCalls, totalRefunds, breakdown };
  }

  /**
   * Check if user has enough for this AI service.
   */
  canAfford(userId: string, walletId: string, serviceType: AIServiceType): boolean {
    const wallet = this.db.prepare(
      'SELECT usdt_balance FROM wallets WHERE id=? AND user_id=?'
    ).get(walletId, userId) as any;
    if (!wallet) return false;
    return wallet.usdt_balance >= AI_PRICE_TABLE[serviceType].priceUSDT;
  }
}

// ═══════════════ Helpers ═════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function computeChecksum(balance: number, frozen: number, version: number): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${balance}:${frozen}:${version}`).digest('hex');
}

function generateId(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}
