// @ts-nocheck
/**
 * DAWN WHALES R143 J04 — Tipping / Reward Service
 * 
 * ⚠️ CRITICAL: Tipping ≠ Transfer! Two completely separate billing pipelines!
 * 
 * v17.6 Tipping Rules:
 *  - Creator level-based commission:
 *    L1 (Newcomer):     30% goes to platform, 70% to creator
 *    L2 (Intermediate): 20% goes to platform, 80% to creator
 *    L3 (Top):          10% goes to platform, 90% to creator
 *  - Levels based on subscriber count OR total earnings:
 *    L1: default (new creators)
 *    L2: >= 100 subscribers OR >= 1,000 USDT total earnings
 *    L3: >= 1000 subscribers OR >= 10,000 USDT total earnings
 *  - Commission is taken from the tip amount, NOT an additional fee
 *  - NOT 0.3%! This is the mistake everyone makes!
 * 
 * Tipping lifecycle:
 *   1. Idempotency check
 *   2. Validate tipper wallet
 *   3. Look up creator level (L1/L2/L3)
 *   4. Calculate split: platform keeps {30,20,10}%, creator gets remainder
 *   5. Debit tipper wallet (full tip amount), OCC
 *   6. Credit creator wallet (creator share), OCC
 *   7. Write dual ledger entries (TIP_SEND + TIP_RECEIVE + platform revenue)
 * 
 * Quick amounts (UI presets): 9.9 / 19.9 / 49.9 / 99.9 USDT
 * 
 * ≥300L
 */

import Database from 'better-sqlite3';

// ═══════════════ Types ═══════════════════════════════════════════════════

export type CreatorLevel = 'L1' | 'L2' | 'L3';

export interface TipRequest {
  fromUserId: string;
  fromWalletId: string;
  toCreatorId: string;
  amountUSDT: number;
  memo?: string;
  idempotencyKey: string;
}

export interface TipResult {
  success: boolean;
  tipId: string;
  fromUserId: string;
  toCreatorId: string;
  amountUSDT: number;
  creatorLevel: CreatorLevel;
  platformShare: number;    // platform commission (20 USDT on 100 → L2: 20)
  platformRate: number;     // e.g., 0.20 for L2
  creatorShare: number;     // creator gets this (80 USDT on 100 → L2: 80)
  error?: string;
}

export interface CreatorInfo {
  userId: string;
  level: CreatorLevel;
  subscriberCount: number;
  totalEarningsUSDT: number;
  totalTipsReceived: number;
}

// ═══════════════ Level Thresholds (v17.6) ════════════════════════════════

const LEVEL_CONFIG: Record<CreatorLevel, { platformRate: number; creatorRate: number; minSubscribers: number; minEarnings: number }> = {
  L1: { platformRate: 0.30, creatorRate: 0.70, minSubscribers: 0,    minEarnings: 0 },
  L2: { platformRate: 0.20, creatorRate: 0.80, minSubscribers: 100,  minEarnings: 1_000 },
  L3: { platformRate: 0.10, creatorRate: 0.90, minSubscribers: 1000, minEarnings: 10_000 },
};

const QUICK_AMOUNTS = [9.9, 19.9, 49.9, 99.9];

// ═══════════════ Tip Service ═════════════════════════════════════════════

export class TipService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tips (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        from_wallet_id TEXT NOT NULL,
        to_creator_id TEXT NOT NULL,
        to_wallet_id TEXT NOT NULL,
        amount_usdt REAL NOT NULL,
        creator_level TEXT NOT NULL,
        platform_rate REAL NOT NULL,
        platform_share REAL NOT NULL,
        creator_share REAL NOT NULL,
        memo TEXT,
        idempotency_key TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (from_wallet_id) REFERENCES wallets(id),
        FOREIGN KEY (to_wallet_id) REFERENCES wallets(id)
      );
      CREATE INDEX IF NOT EXISTS idx_tips_from ON tips(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_tips_to ON tips(to_creator_id);
      CREATE INDEX IF NOT EXISTS idx_tips_idempotency ON tips(idempotency_key);

      -- Creator levels table
      CREATE TABLE IF NOT EXISTS creator_levels (
        user_id TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'L1' CHECK(level IN ('L1','L2','L3')),
        subscriber_count INTEGER NOT NULL DEFAULT 0,
        total_earnings_usdt REAL NOT NULL DEFAULT 0,
        total_tips_received INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_creator_levels_level ON creator_levels(level);
    `);
  }

  /**
   * Execute a tip.
   */
  tip(req: TipRequest): TipResult {
    // Idempotency check
    const idemp = this.db.prepare(
      'SELECT id FROM tips WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as { id: string } | undefined;

    if (idemp) {
      const t = this.db.prepare('SELECT * FROM tips WHERE id=?').get(idemp.id) as any;
      if (t) {
        return {
          success: true, tipId: t.id,
          fromUserId: t.from_user_id, toCreatorId: t.to_creator_id,
          amountUSDT: t.amount_usdt, creatorLevel: t.creator_level,
          platformShare: t.platform_share, platformRate: t.platform_rate, creatorShare: t.creator_share,
        };
      }
    }

    // 1. No self-tip
    if (req.fromUserId === req.toCreatorId) {
      return { success: false, tipId: '', fromUserId: req.fromUserId, toCreatorId: req.toCreatorId,
        amountUSDT: req.amountUSDT, creatorLevel: 'L1', platformShare: 0, platformRate: 0, creatorShare: 0,
        error: 'Cannot tip yourself' };
    }

    // 2. Get creator level
    const creatorLevel = this.getCreatorLevel(req.toCreatorId);
    const config = LEVEL_CONFIG[creatorLevel];

    // 3. Calculate split
    const platformShare = roundUSD(req.amountUSDT * config.platformRate);
    const creatorShare = roundUSD(req.amountUSDT - platformShare);

    // 4. Validate tipper wallet
    const fromWallet = this.db.prepare('SELECT * FROM wallets WHERE id=? AND user_id=?')
      .get(req.fromWalletId, req.fromUserId) as any;
    if (!fromWallet) {
      return { success: false, tipId: '', fromUserId: req.fromUserId, toCreatorId: req.toCreatorId,
        amountUSDT: req.amountUSDT, creatorLevel, platformShare, platformRate: config.platformRate,
        creatorShare, error: 'Tipper wallet not found or access denied' };
    }
    if (fromWallet.usdt_balance < req.amountUSDT) {
      return { success: false, tipId: '', fromUserId: req.fromUserId, toCreatorId: req.toCreatorId,
        amountUSDT: req.amountUSDT, creatorLevel, platformShare, platformRate: config.platformRate,
        creatorShare, error: `Insufficient balance: need ${req.amountUSDT}, have ${fromWallet.usdt_balance}` };
    }

    // 5. Get creator wallet
    const toWallet = this.db.prepare('SELECT * FROM wallets WHERE user_id=?').get(req.toCreatorId) as any;
    if (!toWallet) {
      return { success: false, tipId: '', fromUserId: req.fromUserId, toCreatorId: req.toCreatorId,
        amountUSDT: req.amountUSDT, creatorLevel, platformShare, platformRate: config.platformRate,
        creatorShare, error: 'Creator has no wallet' };
    }

    // 6. Atomic tip
    let tipId = '';
    const txResult = this.db.transaction(() => {
      // Debit tipper
      const fromNewBalance = roundUSD(fromWallet.usdt_balance - req.amountUSDT);
      const fromNewVersion = fromWallet.version + 1;
      const fromChecksum = computeChecksum(fromNewBalance, fromWallet.usdt_frozen, fromNewVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(fromNewBalance, fromChecksum, fromNewVersion, fromWallet.id, fromWallet.version);

      // Credit creator (only their share)
      const toNewBalance = roundUSD(toWallet.usdt_balance + creatorShare);
      const toNewVersion = toWallet.version + 1;
      const toChecksum = computeChecksum(toNewBalance, toWallet.usdt_frozen, toNewVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(toNewBalance, toChecksum, toNewVersion, toWallet.id, toWallet.version);

      // Create tip record
      tipId = generateId();
      this.db.prepare(`
        INSERT INTO tips (id, from_user_id, from_wallet_id, to_creator_id, to_wallet_id,
          amount_usdt, creator_level, platform_rate, platform_share, creator_share,
          memo, idempotency_key)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(tipId, req.fromUserId, req.fromWalletId, req.toCreatorId, toWallet.id,
        req.amountUSDT, creatorLevel, config.platformRate, platformShare, creatorShare,
        req.memo || null, req.idempotencyKey);

      // Ledger: tipper debit (TIP_SEND)
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(req.fromWalletId, req.fromUserId, 'TIP_SEND', -req.amountUSDT, fromNewBalance, tipId,
        `${req.idempotencyKey}_send`,
        `Tip to ${req.toCreatorId} — ${config.platformRate * 100}% platform commission`);

      // Ledger: creator credit (TIP_RECEIVE) — only their share
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(toWallet.id, req.toCreatorId, 'TIP_RECEIVE', creatorShare, toNewBalance, tipId,
        `${req.idempotencyKey}_receive`,
        `Tip from ${req.fromUserId} — ${creatorShare} USDT (${config.platformRate * 100}% commission)`);

      // Update creator stats
      this.db.prepare(
        'UPDATE creator_levels SET total_tips_received = total_tips_received + 1, total_earnings_usdt = total_earnings_usdt + ?, updated_at = datetime("now") WHERE user_id = ?'
      ).run(creatorShare, req.toCreatorId);

      // Recalculate level after earnings update
      this.recalculateLevel(req.toCreatorId);
    }) as (() => void);

    try {
      txResult();
    } catch (err: any) {
      return { success: false, tipId: '', fromUserId: req.fromUserId, toCreatorId: req.toCreatorId,
        amountUSDT: req.amountUSDT, creatorLevel, platformShare, platformRate: config.platformRate,
        creatorShare, error: `Transaction failed: ${err.message}` };
    }

    return {
      success: true, tipId,
      fromUserId: req.fromUserId, toCreatorId: req.toCreatorId,
      amountUSDT: req.amountUSDT,
      creatorLevel,
      platformShare,
      platformRate: config.platformRate,
      creatorShare,
    };
  }

  /**
   * Get or create creator level info.
   */
  getCreatorLevel(userId: string): CreatorLevel {
    let creator = this.db.prepare('SELECT * FROM creator_levels WHERE user_id=?').get(userId) as any;
    if (!creator) {
      this.db.prepare(
        'INSERT OR IGNORE INTO creator_levels (user_id, level, subscriber_count, total_earnings_usdt, total_tips_received) VALUES (?,?,?,?,?)'
      ).run(userId, 'L1', 0, 0, 0);
      return 'L1';
    }
    return creator.level;
  }

  /**
   * Get full creator info.
   */
  getCreatorInfo(userId: string): CreatorInfo {
    let c = this.db.prepare('SELECT * FROM creator_levels WHERE user_id=?').get(userId) as any;
    if (!c) {
      this.db.prepare(
        'INSERT OR IGNORE INTO creator_levels (user_id, level, subscriber_count, total_earnings_usdt, total_tips_received) VALUES (?,?,?,?,?)'
      ).run(userId, 'L1', 0, 0, 0);
      return { userId, level: 'L1', subscriberCount: 0, totalEarningsUSDT: 0, totalTipsReceived: 0 };
    }
    return {
      userId: c.user_id,
      level: c.level,
      subscriberCount: c.subscriber_count,
      totalEarningsUSDT: c.total_earnings_usdt,
      totalTipsReceived: c.total_tips_received,
    };
  }

  /**
   * Recalculate creator level based on earnings/subscribers.
   */
  recalculateLevel(userId: string): CreatorLevel {
    const c = this.db.prepare('SELECT * FROM creator_levels WHERE user_id=?').get(userId) as any;
    if (!c) return 'L1';

    let newLevel: CreatorLevel = 'L1';
    if (c.subscriber_count >= 1000 || c.total_earnings_usdt >= 10000) {
      newLevel = 'L3';
    } else if (c.subscriber_count >= 100 || c.total_earnings_usdt >= 1000) {
      newLevel = 'L2';
    }

    if (newLevel !== c.level) {
      this.db.prepare('UPDATE creator_levels SET level=?, updated_at=datetime("now") WHERE user_id=?')
        .run(newLevel, userId);
    }
    return newLevel;
  }

  /**
   * Update subscriber count (called when subscription changes).
   */
  updateSubscriberCount(creatorId: string, delta: number): CreatorInfo {
    // Ensure exists
    this.getCreatorLevel(creatorId);

    this.db.prepare(
      'UPDATE creator_levels SET subscriber_count = subscriber_count + ?, updated_at = datetime("now") WHERE user_id = ?'
    ).run(delta, creatorId);

    this.recalculateLevel(creatorId);
    return this.getCreatorInfo(creatorId);
  }

  /**
   * Get tip history for user (given or received).
   */
  getHistory(userId: string, limit = 20, offset = 0) {
    const rows = this.db.prepare(
      `SELECT * FROM tips WHERE from_user_id=? OR to_creator_id=?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(userId, userId, limit, offset);
    const count = (this.db.prepare(
      'SELECT COUNT(*) as total FROM tips WHERE from_user_id=? OR to_creator_id=?'
    ).get(userId, userId) as any).total;
    return { rows, pagination: { total: count, limit, offset } };
  }

  /**
   * Get quick tip amounts (UI presets).
   */
  getQuickAmounts(): number[] {
    return [...QUICK_AMOUNTS];
  }

  /**
   * Get a single tip.
   */
  getTip(tipId: string) {
    return this.db.prepare('SELECT * FROM tips WHERE id=?').get(tipId);
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
