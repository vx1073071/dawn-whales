/**
 * DAWN WHALES R147 J02 — TA Billing & Trade Detail Engine
 * 
 * Trading Agent (TA) billing — 3 tiers:
 *   - Standard (标准): 1.0 USDT/round
 *   - Advanced (高级): 1.5 USDT/round
 *   - Flagship (旗舰): 2.0 USDT/round
 * 
 * ⚠️ 执行失败不收费! (下单被拒/超时/券商拒绝→不退费?? NO→不扣费!!)
 * 
 * Trade detail: records per-order fees, asset type, fee rate, refund status
 * 
 * Integration: uses AIBillingService for unified billing pipeline (from R141)
 * 
 * ≥300L
 */

import Database from 'better-sqlite3';
import { AIBillingService } from './ai-billing';

export type TATier = 'STANDARD' | 'ADVANCED' | 'FLAGSHIP';

export interface TATierConfig {
  tier: TATier;
  label: string;
  priceUSDT: number;
  description: string;
}

export interface TABillRequest {
  userId: string;
  walletId: string;
  tier: TATier;
  roundNumber: number;
  idempotencyKey: string;
}

export interface TABillResult {
  success: boolean;
  billId: string;
  tier: TATier;
  priceUSDT: number;
  executed: boolean;
  error?: string;
}

export interface TradeDetailRecord {
  orderId: string;
  userId: string;
  tradeId: string;
  symbol: string;
  assetType: string;
  orderType: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: string;
  feeAmountUSDT: number;
  feeRatePct: number;
  isRefunded: boolean;
  refundReason?: string;
  taTier?: TATier;
  roundNumber?: number;
}

// ═══════════════ TA Tier Pricing (v17.6 permanent lock) ═════════════════

export const TA_TIERS: Record<TATier, TATierConfig> = {
  STANDARD: {
    tier: 'STANDARD',
    label: '标准Agent',
    priceUSDT: 1.0,
    description: '单策略, 基础执行, 1轮完成',
  },
  ADVANCED: {
    tier: 'ADVANCED',
    label: '高级Agent',
    priceUSDT: 1.5,
    description: '多策略协同, 动态参数调整, 1-3轮完成',
  },
  FLAGSHIP: {
    tier: 'FLAGSHIP',
    label: '旗舰Agent',
    priceUSDT: 2.0,
    description: '全策略组合, AI驱动决策, 最多5轮完成',
  },
};

// Asset type → fee rate mapping (from v17.6)
const ASSET_FEE_RATES: Record<string, number> = {
  stock: 0.001,        // 0.1% taker
  etf: 0.001,
  crypto_spot: 0.001,
  crypto_perp: 0.0002, // 0.02% crypto contracts
  forex: 0.0003,
  default: 0.001,
};

// ═══════════════ TA Billing Service ═════════════════════════════════════

export class TABillingService {
  private db: Database.Database;
  private billing: AIBillingService;

  constructor(db: Database.Database, billing: AIBillingService) {
    this.db = db;
    this.billing = billing;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      -- TA execution rounds
      CREATE TABLE IF NOT EXISTS ta_execution_rounds (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        round_number INTEGER NOT NULL,
        bill_id TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        error_reason TEXT,
        FOREIGN KEY (bill_id) REFERENCES ai_bills(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ta_rounds_user ON ta_execution_rounds(user_id);

      -- Trade detail: per-order fee tracking
      CREATE TABLE IF NOT EXISTS trade_details (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE,
        trade_id TEXT,
        symbol TEXT NOT NULL,
        asset_type TEXT NOT NULL DEFAULT 'stock',
        order_type TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        executed_at TEXT NOT NULL,
        fee_amount_usdt REAL NOT NULL,
        fee_rate_pct REAL NOT NULL,
        is_refunded INTEGER NOT NULL DEFAULT 0,
        refund_reason TEXT,
        ta_tier TEXT,
        round_number INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_trade_details_user ON trade_details(user_id);
      CREATE INDEX IF NOT EXISTS idx_trade_details_order ON trade_details(order_id);
      CREATE INDEX IF NOT EXISTS idx_trade_details_date ON trade_details(executed_at);
    `);
  }

  /**
   * Bill user for TA execution round.
   * Returns control immediately so execution can proceed.
   */
  billRound(req: TABillRequest): TABillResult {
    const tierConfig = TA_TIERS[req.tier];
    if (!tierConfig) {
      return { success: false, billId: '', tier: req.tier, priceUSDT: 0,
        executed: false, error: `Unknown tier: ${req.tier}` };
    }

    // Create round record (status defaults to 'PENDING' per schema)
    const roundId = generateId();
    this.db.prepare(`
      INSERT INTO ta_execution_rounds (id, user_id, tier, round_number)
      VALUES (?,?,?,?)
    `).run(roundId, req.userId, req.tier, req.roundNumber);

    // Bill via unified pipeline
    const billResult = this.billing.billAIService({
      userId: req.userId,
      walletId: req.walletId,
      serviceType: 'TA_STANDARD',
      customPriceUSDT: tierConfig.priceUSDT,
      idempotencyKey: req.idempotencyKey,
    });

    if (billResult.success) {
      this.db.prepare(`
        UPDATE ta_execution_rounds SET bill_id=?, status='BILLED'
        WHERE id=?
      `).run(billResult.billId, roundId);

      return { success: true, billId: billResult.billId, tier: req.tier,
        priceUSDT: tierConfig.priceUSDT, executed: true };
    } else {
      this.db.prepare(`
        UPDATE ta_execution_rounds SET status='BILL_FAILED', error_reason=?
        WHERE id=?
      `).run(billResult.error || 'Unknown', roundId);

      return { success: false, billId: billResult.billId || '', tier: req.tier,
        priceUSDT: tierConfig.priceUSDT, executed: false,
        error: billResult.error };
    }
  }

  /**
   * Complete a round — success or failure.
   * On success: keep the charge.
   * On failure: refund (执行失败不收费!)
   */
  completeRound(roundId: string, success: boolean, errorReason?: string): void {
    if (success) {
      this.db.prepare(`
        UPDATE ta_execution_rounds SET status='SUCCESS', completed_at=datetime('now') WHERE id=?
      `).run(roundId);
      // Keep the charge — no refund
      return;
    }

    // Failure → refund!
    const round = this.db.prepare('SELECT * FROM ta_execution_rounds WHERE id=?').get(roundId) as any;
    if (round && round.bill_id) {
      this.billing.refundAIService({
        billId: round.bill_id,
        userId: round.user_id,
        reason: errorReason || 'TA execution failed: order rejected/timeout/network error',
      });
    }

    this.db.prepare(`
      UPDATE ta_execution_rounds SET status='FAILED', completed_at=datetime('now'), error_reason=?
      WHERE id=?
    `).run(errorReason || 'Unknown', roundId);
  }

  /**
   * Get TA tier configuration.
   */
  getTierConfig(tier: TATier): TATierConfig | null {
    return TA_TIERS[tier] || null;
  }

  getAllTiers(): TATierConfig[] {
    return Object.values(TA_TIERS);
  }

  getRoundHistory(userId: string, limit = 20, offset = 0) {
    return this.db.prepare(
      'SELECT * FROM ta_execution_rounds WHERE user_id=? ORDER BY started_at DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, offset);
  }

  // ═══════════════ Trade Detail Recording ═════════════════════════════════

  /**
   * Record a completed trade with full fee detail.
   */
  recordTrade(detail: TradeDetailRecord): string {
    const id = generateId();
    const assetType = detail.assetType || 'stock';
    const feeRate = ASSET_FEE_RATES[assetType] || ASSET_FEE_RATES.default;
    const feeAmount = detail.price * detail.quantity * feeRate;

    this.db.prepare(`
      INSERT INTO trade_details (id, user_id, order_id, trade_id, symbol, asset_type, order_type, side, quantity, price, executed_at, fee_amount_usdt, fee_rate_pct, is_refunded, refund_reason, ta_tier, round_number)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, detail.userId, detail.orderId, detail.tradeId || null,
      detail.symbol, assetType, detail.orderType, detail.side,
      detail.quantity, detail.price, detail.executedAt,
      feeAmount, feeRate * 100, detail.isRefunded ? 1 : 0,
      detail.refundReason || null, detail.taTier || null, detail.roundNumber || null);

    return id;
  }

  /**
   * Mark a trade detail as refunded.
   */
  refundTrade(orderId: string, reason: string): boolean {
    const existing = this.db.prepare('SELECT * FROM trade_details WHERE order_id=?').get(orderId) as any;
    if (!existing) return false;

    this.db.prepare(`
      UPDATE trade_details SET is_refunded=1, refund_reason=? WHERE order_id=?
    `).run(reason, orderId);
    return true;
  }

  /**
   * Query trade details with filtering.
   */
  queryTradeDetails(params: {
    userId: string;
    symbol?: string;
    assetType?: string;
    startDate?: string;
    endDate?: string;
    isRefunded?: boolean;
    taTier?: TATier;
    limit?: number;
    offset?: number;
  }) {
    let query = 'SELECT * FROM trade_details WHERE user_id=?';
    const qParams: any[] = [params.userId];

    if (params.symbol) { query += ' AND symbol=?'; qParams.push(params.symbol); }
    if (params.assetType) { query += ' AND asset_type=?'; qParams.push(params.assetType); }
    if (params.startDate) { query += ' AND executed_at >= ?'; qParams.push(params.startDate); }
    if (params.endDate) { query += ' AND executed_at <= ?'; qParams.push(params.endDate); }
    if (params.isRefunded !== undefined) { query += ' AND is_refunded=?'; qParams.push(params.isRefunded ? 1 : 0); }
    if (params.taTier) { query += ' AND ta_tier=?'; qParams.push(params.taTier); }

    query += ' ORDER BY executed_at DESC LIMIT ? OFFSET ?';
    qParams.push(params.limit || 50, params.offset || 0);

    return this.db.prepare(query).all(...qParams);
  }

  /**
   * Get fee summary for a user.
   */
  getFeeSummary(userId: string, startDate?: string, endDate?: string) {
    let query = `
      SELECT
        COUNT(*) as total_trades,
        SUM(fee_amount_usdt) as total_fees,
        SUM(quantity * price) as total_volume,
        SUM(CASE WHEN is_refunded THEN fee_amount_usdt ELSE 0 END) as refunded_fees,
        asset_type
      FROM trade_details WHERE user_id=?
    `;
    const qParams: any[] = [userId];

    if (startDate) { query += ' AND executed_at >= ?'; qParams.push(startDate); }
    if (endDate) { query += ' AND executed_at <= ?'; qParams.push(endDate); }

    query += ' GROUP BY asset_type';
    return this.db.prepare(query).all(...qParams);
  }

  /**
   * Compute the fee for a given trade.
   */
  computeFee(assetType: string, price: number, quantity: number): {
    feeRatePct: number;
    feeAmountUSDT: number;
  } {
    const rate = ASSET_FEE_RATES[assetType] || ASSET_FEE_RATES.default;
    return {
      feeRatePct: rate * 100,
      feeAmountUSDT: price * quantity * rate,
    };
  }
}

function generateId(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}
