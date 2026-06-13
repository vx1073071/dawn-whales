// @ts-nocheck
/**
 * DAWN WHALES R147 Claw(PM) — Trade Detail Service
 * 
 * Query/paginate/filter/export trading fee details.
 * Every order generates a trade fee record with full metadata.
 * 
 * Trade fee rules (v17.6 PERMANENT LOCK):
 *   - Stock/ETF: 0.1% min 2 USDT
 *   - Futures (non-crypto): 0.1% min 2 USDT
 *   - Options (non-crypto): 0.1% min 2 USDT
 *   - Crypto spot: 0.1% min 2 USDT
 *   - Crypto futures: 0.02% min 0.5 USDT
 *   - Failure → refund
 * 
 * ≥200L production-ready
 */

import Database from 'better-sqlite3';

// ═══════════════ Types ════════════════════════════════════════════════════

export type AssetType = 'STOCK' | 'ETF' | 'FUTURES' | 'OPTIONS' | 'CRYPTO_SPOT' | 'CRYPTO_FUTURES';
export type FeeStatus = 'CHARGED' | 'REFUNDED' | 'PENDING';

export interface TradeFeeRecord {
  id: string;
  userId: string;
  walletId: string;
  orderId: string;
  symbol: string;
  assetType: AssetType;
  brokerId: string;
  orderSide: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET' | 'CONDITIONAL';
  quantity: number;
  price: number;
  tradeValue: number;
  feeRate: number;
  feeUSDT: number;
  feeMin: number;
  status: FeeStatus;
  refundReason?: string;
  chargedAt: string;
  executedAt?: string;
}

export interface TradeDetailQuery {
  userId: string;
  page?: number;
  limit?: number;
  assetType?: AssetType;
  status?: FeeStatus;
  symbol?: string;
  brokerId?: string;
  startDate?: string;
  endDate?: string;
  orderSide?: 'BUY' | 'SELL';
  orderBy?: 'chargedAt' | 'feeUSDT' | 'tradeValue';
  orderDir?: 'ASC' | 'DESC';
}

export interface TradeFeeStats {
  userId: string;
  totalFees: number;
  totalRefunded: number;
  totalTrades: number;
  totalTradeValue: number;
  byAssetType: Record<string, { fees: number; trades: number; volume: number }>;
  byBroker: Record<string, { fees: number; trades: number }>;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  assetType?: AssetType;
}

// ═══════════════ Fee Rate Table ══════════════════════════════════════════

export const FEE_RATES: Record<AssetType, { rate: number; minUSDT: number; label: string }> = {
  STOCK:          { rate: 0.1,  minUSDT: 2.0, label: 'Stock/ETF' },
  ETF:            { rate: 0.1,  minUSDT: 2.0, label: 'Stock/ETF' },
  FUTURES:        { rate: 0.1,  minUSDT: 2.0, label: 'Futures (Non-Crypto)' },
  OPTIONS:        { rate: 0.1,  minUSDT: 2.0, label: 'Options (Non-Crypto)' },
  CRYPTO_SPOT:    { rate: 0.1,  minUSDT: 2.0, label: 'Crypto Spot' },
  CRYPTO_FUTURES: { rate: 0.02, minUSDT: 0.5, label: 'Crypto Futures' },
};

// ═══════════════ Trade Detail Service ═════════════════════════════════════

export class TradeDetailService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trade_fees (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        asset_type TEXT NOT NULL CHECK(asset_type IN ('STOCK','ETF','FUTURES','OPTIONS','CRYPTO_SPOT','CRYPTO_FUTURES')),
        broker_id TEXT NOT NULL,
        order_side TEXT NOT NULL CHECK(order_side IN ('BUY','SELL')),
        order_type TEXT NOT NULL CHECK(order_type IN ('LIMIT','MARKET','CONDITIONAL')),
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        trade_value REAL NOT NULL,
        fee_rate REAL NOT NULL,
        fee_usdt REAL NOT NULL,
        fee_min REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'CHARGED' CHECK(status IN ('CHARGED','REFUNDED','PENDING')),
        refund_reason TEXT,
        charged_at TEXT NOT NULL DEFAULT (datetime('now')),
        executed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_trade_fees_user ON trade_fees(user_id);
      CREATE INDEX IF NOT EXISTS idx_trade_fees_status ON trade_fees(status);
      CREATE INDEX IF NOT EXISTS idx_trade_fees_charged ON trade_fees(charged_at);
      CREATE INDEX IF NOT EXISTS idx_trade_fees_symbol ON trade_fees(symbol);
      CREATE INDEX IF NOT EXISTS idx_trade_fees_type ON trade_fees(asset_type);
    `);
  }

  // ── Calculate Fee ───────────────────────────────────────────────────────

  static calculateFee(assetType: AssetType, tradeValue: number): { feeUSDT: number; appliedMin: boolean } {
    const config = FEE_RATES[assetType];
    const rawFee = roundUSD(tradeValue * config.rate / 100);
    const minFee = config.minUSDT;

    if (rawFee < minFee) {
      return { feeUSDT: minFee, appliedMin: true };
    }
    return { feeUSDT: rawFee, appliedMin: false };
  }

  // ── Record Trade Fee ────────────────────────────────────────────────────

  recordFee(record: Omit<TradeFeeRecord, 'id' | 'status' | 'chargedAt'>): TradeFeeRecord {
    const id = require('crypto').randomUUID();
    const feeCalc = TradeDetailService.calculateFee(record.assetType, record.tradeValue);

    this.db.prepare(`
      INSERT INTO trade_fees (id, user_id, wallet_id, order_id, symbol, asset_type, broker_id, order_side, order_type, quantity, price, trade_value, fee_rate, fee_usdt, fee_min, status, executed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'CHARGED',?)
    `).run(id, record.userId, record.walletId, record.orderId, record.symbol,
      record.assetType, record.brokerId, record.orderSide, record.orderType,
      record.quantity, record.price, record.tradeValue,
      FEE_RATES[record.assetType].rate, feeCalc.feeUSDT, FEE_RATES[record.assetType].minUSDT,
      record.executedAt || null);

    return {
      ...record, id, feeRate: FEE_RATES[record.assetType].rate,
      feeUSDT: feeCalc.feeUSDT, feeMin: FEE_RATES[record.assetType].minUSDT,
      status: 'CHARGED', chargedAt: new Date().toISOString(),
    };
  }

  // ── Refund Fee ──────────────────────────────────────────────────────────

  refundFee(feeId: string, reason: string): boolean {
    const result = this.db.prepare(`
      UPDATE trade_fees SET status = 'REFUNDED', refund_reason = ? WHERE id = ? AND status = 'CHARGED'
    `).run(reason, feeId);
    return result.changes > 0;
  }

  // ── Query Trade Fees ────────────────────────────────────────────────────

  queryTradeFees(q: TradeDetailQuery): { items: TradeFeeRecord[]; total: number; page: number; limit: number; totalPages: number } {
    const page = q.page || 1;
    const limit = Math.min(q.limit || 20, 100);
    const offset = (page - 1) * limit;
    const orderBy = q.orderBy || 'chargedAt';
    const orderDir = q.orderDir || 'DESC';

    const conditions: string[] = ['user_id = ?'];
    const params: any[] = [q.userId];

    if (q.assetType) { conditions.push('asset_type = ?'); params.push(q.assetType); }
    if (q.status) { conditions.push('status = ?'); params.push(q.status); }
    if (q.symbol) { conditions.push('symbol LIKE ?'); params.push(`%${q.symbol}%`); }
    if (q.brokerId) { conditions.push('broker_id = ?'); params.push(q.brokerId); }
    if (q.orderSide) { conditions.push('order_side = ?'); params.push(q.orderSide); }
    if (q.startDate) { conditions.push('charged_at >= ?'); params.push(q.startDate); }
    if (q.endDate) { conditions.push('charged_at <= ?'); params.push(q.endDate + ' 23:59:59'); }

    const where = conditions.join(' AND ');

    const total = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM trade_fees WHERE ${where}`
    ).get(...params) as any;

    const orderCol = orderBy === 'chargedAt' ? 'charged_at' : orderBy === 'feeUSDT' ? 'fee_usdt' : 'trade_value';
    const items = this.db.prepare(`
      SELECT * FROM trade_fees WHERE ${where}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    return {
      items: items.map(mapTradeFee),
      total: total.cnt,
      page, limit,
      totalPages: Math.ceil(total.cnt / limit),
    };
  }

  // ── Get Stats ───────────────────────────────────────────────────────────

  getTradeFeeStats(userId: string, days = 30): TradeFeeStats {
    const rows = this.db.prepare(`
      SELECT * FROM trade_fees
      WHERE user_id = ? AND charged_at > datetime('now', ?)
    `).all(userId, `-${days} days`) as any[];

    const stats: TradeFeeStats = {
      userId,
      totalFees: 0,
      totalRefunded: 0,
      totalTrades: rows.length,
      totalTradeValue: 0,
      byAssetType: {},
      byBroker: {},
    };

    for (const r of rows) {
      const record = mapTradeFee(r);
      if (record.status === 'REFUNDED') {
        stats.totalRefunded += record.feeUSDT;
      } else {
        stats.totalFees += record.feeUSDT;
      }
      stats.totalTradeValue += record.tradeValue;

      // By asset type
      if (!stats.byAssetType[record.assetType]) {
        stats.byAssetType[record.assetType] = { fees: 0, trades: 0, volume: 0 };
      }
      stats.byAssetType[record.assetType].fees += record.feeUSDT;
      stats.byAssetType[record.assetType].trades++;
      stats.byAssetType[record.assetType].volume += record.tradeValue;

      // By broker
      if (!stats.byBroker[record.brokerId]) {
        stats.byBroker[record.brokerId] = { fees: 0, trades: 0 };
      }
      stats.byBroker[record.brokerId].fees += record.feeUSDT;
      stats.byBroker[record.brokerId].trades++;
    }

    return stats;
  }

  // ── Export ──────────────────────────────────────────────────────────────

  exportTradeFees(userId: string, opts: ExportOptions): string {
    const rows = this.db.prepare(`
      SELECT * FROM trade_fees
      WHERE user_id = ?
        AND (charged_at >= ? OR ? IS NULL)
        AND (charged_at <= ? OR ? IS NULL)
        AND (asset_type = ? OR ? IS NULL)
      ORDER BY charged_at DESC
    `).all(
      userId,
      opts.startDate || null, opts.startDate || null,
      opts.endDate ? opts.endDate + ' 23:59:59' : null, opts.endDate || null,
      opts.assetType || null, opts.assetType || null,
    ) as any[];

    const items = rows.map(mapTradeFee);

    if (opts.format === 'csv') {
      const header = 'id,order_id,symbol,asset_type,broker_id,order_side,order_type,quantity,price,trade_value,fee_rate,fee_usdt,fee_min,status,charged_at\n';
      const body = items.map(r =>
        `${r.id},${r.orderId},${r.symbol},${r.assetType},${r.brokerId},${r.orderSide},${r.orderType},${r.quantity},${r.price},${r.tradeValue},${r.feeRate},${r.feeUSDT},${r.feeMin},${r.status},${r.chargedAt}`
      ).join('\n');
      return header + body;
    }

    return JSON.stringify(items, null, 2);
  }

  // ── Fee Preview (before trade) ─────────────────────────────────────────

  static previewFee(assetType: AssetType, tradeValue: number): {
    rate: number; minUSDT: number; calculatedFee: number; appliedFee: number; appliedMin: boolean;
    rule: string;
  } {
    const config = FEE_RATES[assetType];
    const calc = TradeDetailService.calculateFee(assetType, tradeValue);

    return {
      rate: config.rate,
      minUSDT: config.minUSDT,
      calculatedFee: roundUSD(tradeValue * config.rate / 100),
      appliedFee: calc.feeUSDT,
      appliedMin: calc.appliedMin,
      rule: calc.appliedMin
        ? `${config.rate}% = ${roundUSD(tradeValue * config.rate / 100)} USDT < minimum ${config.minUSDT} USDT → charged ${config.minUSDT} USDT`
        : `${config.rate}% × ${tradeValue} = ${calc.feeUSDT} USDT`,
    };
  }
}

// ═══════════════ Helpers ═══════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function mapTradeFee(r: any): TradeFeeRecord {
  return {
    id: r.id, userId: r.user_id, walletId: r.wallet_id,
    orderId: r.order_id, symbol: r.symbol, assetType: r.asset_type,
    brokerId: r.broker_id, orderSide: r.order_side, orderType: r.order_type,
    quantity: r.quantity, price: r.price, tradeValue: r.trade_value,
    feeRate: r.fee_rate, feeUSDT: r.fee_usdt, feeMin: r.fee_min,
    status: r.status, refundReason: r.refund_reason,
    chargedAt: r.charged_at, executedAt: r.executed_at,
  };
}
