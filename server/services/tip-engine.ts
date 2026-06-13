// @ts-nocheck
/**
 * DAWN WHALES R143 Claw(PM) — Tip Engine (打赏等级抽成引擎)
 * 
 * CRITICAL: 转账 ≠ 打赏! Two completely independent billing pipelines!
 *   - TRANSFER: sender 0.3% + receiver 0.3% platform fee
 *   - TIP: deducted by creator LEVEL (L1:30% / L2:20% / L3:10%)
 * 
 * v17.6 Creator Level Rules (PERMANENT LOCK):
 *   - L1 (注册即可): platform takes 30%, creator gets 70%
 *   - L2 (≥100笔累计销量): platform takes 20%, creator gets 80%
 *   - L3 (≥1000笔累计销量): platform takes 10%, creator gets 90%
 *   - No KYC, no rating requirement, pure sales-volume upgrade
 *   - Minimum tip: 9.9 USDT
 *   - Quick amounts: 9.9 / 19.9 / 49.9 / 99.9 USDT
 * 
 * Flow:
 *   1. Sender selects creator + amount
 *   2. Query creator level → get commission rate
 *   3. Deduct from sender wallet (full amount)
 *   4. Credit creator wallet (amount × (1 - commission%))
 *   5. Platform keeps (amount × commission%)
 * 
 * ≥200L production-ready
 */

import Database from 'better-sqlite3';
import { BillingService } from './billing-service';

// ═══════════════ Types ════════════════════════════════════════════════════

export type CreatorLevel = 'L1' | 'L2' | 'L3';

export interface TipRequest {
  senderId: string;
  senderWalletId: string;
  creatorId: string;
  creatorWalletId: string;
  amountUSDT: number;
  idempotencyKey: string;
  message?: string;
}

export interface TipResult {
  success: boolean;
  tipId: string;
  amountUSDT: number;
  commissionRate: number;
  commissionUSDT: number;
  creatorReceives: number;
  senderId: string;
  creatorId: string;
  creatorLevel: CreatorLevel;
  error?: string;
}

export interface CreatorInfo {
  userId: string;
  username: string;
  level: CreatorLevel;
  totalSales: number;
  commissionRate: number;
  totalEarned: number;
}

// ═══════════════ Commission Table ═════════════════════════════════════════

export const CREATOR_LEVEL_RULES: Record<CreatorLevel, {
  level: number;
  minSales: number;
  commissionPercent: number;
  label: string;
}> = {
  L1: { level: 1, minSales: 0,     commissionPercent: 30, label: '新手创作者' },
  L2: { level: 2, minSales: 100,   commissionPercent: 20, label: '进阶创作者' },
  L3: { level: 3, minSales: 1000,  commissionPercent: 10, label: '旗舰创作者' },
};

export const TIP_QUICK_AMOUNTS = [9.9, 19.9, 49.9, 99.9];
export const MIN_TIP_USDT = 9.9;

// ═══════════════ Tip Engine ═══════════════════════════════════════════════

export class TipEngine {
  private db: Database.Database;
  private billingService: BillingService;

  constructor(db: Database.Database, billingService: BillingService) {
    this.db = db;
    this.billingService = billingService;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tips (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        amount_usdt REAL NOT NULL,
        commission_rate REAL NOT NULL,
        commission_usdt REAL NOT NULL,
        creator_receives REAL NOT NULL,
        creator_level TEXT NOT NULL CHECK(creator_level IN ('L1','L2','L3')),
        message TEXT,
        idempotency_key TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_tips_sender ON tips(sender_id);
      CREATE INDEX IF NOT EXISTS idx_tips_creator ON tips(creator_id);
      CREATE INDEX IF NOT EXISTS idx_tips_idempotency ON tips(idempotency_key);

      CREATE TABLE IF NOT EXISTS creator_stats (
        user_id TEXT PRIMARY KEY,
        total_sales INTEGER NOT NULL DEFAULT 0,
        total_earned REAL NOT NULL DEFAULT 0,
        current_level TEXT NOT NULL DEFAULT 'L1' CHECK(current_level IN ('L1','L2','L3')),
        level_updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
  }

  // ── Get Creator Level ───────────────────────────────────────────────────

  getCreatorLevel(userId: string): CreatorInfo {
    const stats = this.db.prepare(
      'SELECT * FROM creator_stats WHERE user_id = ?'
    ).get(userId) as any;

    if (!stats) {
      // Initialize if not exists
      this.db.prepare(`
        INSERT OR IGNORE INTO creator_stats (user_id, total_sales, total_earned, current_level)
        VALUES (?, 0, 0, 'L1')
      `).run(userId);

      const user = this.db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;

      return {
        userId, username: user?.username || 'Unknown',
        level: 'L1', totalSales: 0, commissionRate: 30, totalEarned: 0,
      };
    }

    const level = stats.current_level as CreatorLevel;
    const user = this.db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;

    return {
      userId, username: user?.username || 'Unknown',
      level, totalSales: stats.total_sales,
      commissionRate: CREATOR_LEVEL_RULES[level].commissionPercent,
      totalEarned: stats.total_earned,
    };
  }

  // ── Send Tip ────────────────────────────────────────────────────────────

  sendTip(req: TipRequest): TipResult {
    // Minimum amount check
    if (req.amountUSDT < MIN_TIP_USDT) {
      return { success: false, tipId: '', amountUSDT: req.amountUSDT,
        commissionRate: 0, commissionUSDT: 0, creatorReceives: 0,
        senderId: req.senderId, creatorId: req.creatorId, creatorLevel: 'L1',
        error: `Minimum tip is ${MIN_TIP_USDT} USDT` };
    }

    // Idempotency check
    const existing = this.db.prepare(
      'SELECT * FROM tips WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as any;

    if (existing) {
      const level = existing.creator_level as CreatorLevel;
      return { success: true, tipId: existing.id, amountUSDT: existing.amount_usdt,
        commissionRate: existing.commission_rate, commissionUSDT: existing.commission_usdt,
        creatorReceives: existing.creator_receives,
        senderId: req.senderId, creatorId: req.creatorId, creatorLevel: level };
    }

    // Get creator level
    const creatorInfo = this.getCreatorLevel(req.creatorId);
    const commissionRate = creatorInfo.commissionRate;
    const commissionUSDT = roundUSD(req.amountUSDT * commissionRate / 100);
    const creatorReceives = roundUSD(req.amountUSDT - commissionUSDT);
    const tipId = generateId();

    let success = false;
    let error = '';

    try {
      this.db.transaction(() => {
        // 1. Deduct from sender wallet
        const deductResult = this.billingService.deductBalance({
          userId: req.senderId,
          walletId: req.senderWalletId,
          amountUSDT: req.amountUSDT,
          entryType: 'TIP_SEND',
          idempotencyKey: req.idempotencyKey,
          description: `Tip to ${creatorInfo.username} (${creatorInfo.level})`,
        });

        if (!deductResult.success) throw new Error(deductResult.error || 'Deduct failed');

        // 2. Credit creator wallet (net amount after commission)
        const creditResult = this.billingService.creditBalance({
          userId: req.creatorId,
          walletId: req.creatorWalletId,
          amountUSDT: creatorReceives,
          entryType: 'TIP_RECEIVE',
          idempotencyKey: `${req.idempotencyKey}_credit`,
          description: `Tip from sender (${creatorInfo.level}: ${commissionRate}% commission)`,
        });

        if (!creditResult.success) throw new Error('Credit to creator failed');

        // 3. Record tip
        this.db.prepare(`
          INSERT INTO tips (id, sender_id, creator_id, amount_usdt, commission_rate, commission_usdt, creator_receives, creator_level, message, idempotency_key)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `).run(tipId, req.senderId, req.creatorId, req.amountUSDT,
          commissionRate, commissionUSDT, creatorReceives,
          creatorInfo.level, req.message || null, req.idempotencyKey);

        success = true;
      })();
    } catch (err: any) {
      error = err.message;
    }

    return { success, tipId, amountUSDT: req.amountUSDT,
      commissionRate, commissionUSDT, creatorReceives,
      senderId: req.senderId, creatorId: req.creatorId,
      creatorLevel: creatorInfo.level, error };
  }

  // ── Increment Creator Sales ─────────────────────────────────────────────

  incrementSales(creatorId: string, count: number = 1): void {
    const before = this.getCreatorLevel(creatorId);
    const newTotal = before.totalSales + count;

    this.db.prepare(`
      UPDATE creator_stats SET total_sales = ?, updated_at = datetime('now') WHERE user_id = ?
    `).run(newTotal, creatorId);

    // Check level upgrade
    this.checkLevelUpgrade(creatorId, newTotal);
  }

  // ── Check & Apply Level Upgrade ────────────────────────────────────────

  checkLevelUpgrade(userId: string, totalSales?: number): { upgraded: boolean; oldLevel: CreatorLevel; newLevel: CreatorLevel } {
    const current = this.getCreatorLevel(userId);
    const sales = totalSales ?? current.totalSales;
    const oldLevel = current.level;

    let newLevel: CreatorLevel = 'L1';
    if (sales >= CREATOR_LEVEL_RULES.L3.minSales) {
      newLevel = 'L3';
    } else if (sales >= CREATOR_LEVEL_RULES.L2.minSales) {
      newLevel = 'L2';
    }

    if (newLevel !== oldLevel) {
      this.db.prepare(`
        UPDATE creator_stats SET current_level = ?, level_updated_at = datetime('now') WHERE user_id = ?
      `).run(newLevel, userId);

      // Audit log the level change
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, description)
        SELECT w.id, ?, 'ADJUSTMENT', 0, w.usdt_balance, ?
        FROM wallets w WHERE w.user_id = ?
      `).run(userId, `Creator level upgrade: ${oldLevel} → ${newLevel} (${sales} total sales)`, userId);
    }

    return { upgraded: newLevel !== oldLevel, oldLevel, newLevel };
  }

  // ── Get Tip History ─────────────────────────────────────────────────────

  getSentTips(userId: string, limit = 20, offset = 0): any[] {
    return this.db.prepare(`
      SELECT t.*, u.username as creator_name
      FROM tips t JOIN users u ON u.id = t.creator_id
      WHERE t.sender_id = ?
      ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }

  getReceivedTips(userId: string, limit = 20, offset = 0): any[] {
    return this.db.prepare(`
      SELECT t.*, u.username as sender_name
      FROM tips t JOIN users u ON u.id = t.sender_id
      WHERE t.creator_id = ?
      ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }

  // ── Level Distribution (Admin) ─────────────────────────────────────────

  getLevelDistribution(): { L1: number; L2: number; L3: number } {
    const stats = this.db.prepare(`
      SELECT current_level, COUNT(*) as cnt FROM creator_stats GROUP BY current_level
    `).all() as any[];

    const dist = { L1: 0, L2: 0, L3: 0 };
    for (const row of stats) {
      if (row.current_level in dist) {
        dist[row.current_level as keyof typeof dist] = row.cnt;
      }
    }
    return dist;
  }
}

// ═══════════════ Helpers ═══════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function generateId(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}
