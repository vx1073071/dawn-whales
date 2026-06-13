// @ts-nocheck
/**
 * DAWN WHALES R144 J03 — Subscription Service
 * 
 * Monthly recurring billing for signal subscriptions.
 * 
 * Subscription lifecycle:
 *   1. Subscribe: first payment → ACTIVE
 *   2. Renew (auto): cron checks daily → debit → ledger
 *   3. Insufficient balance: PAUSED (not cancelled!)
 *   4. Recharge recovery: balance >= price → auto-resume to ACTIVE
 *   5. Cancel: user-initiated → CANCELLED (no reactivation)
 * 
 * v17.6 Rules:
 *  - Minimum subscription price: 9.9 USDT/month
 *  - Commission by creator level (L1:30% / L2:20% / L3:10%)
 *  - First month counts as 1 sale for creator level
 *  - 24h notification before insufficient balance pause
 * 
 * ≥250L
 */

import Database from 'better-sqlite3';
import { CreatorLevelEngine } from './creator-level';

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface SubscriptionRequest {
  userId: string;
  userWalletId: string;
  productId: string;
  idempotencyKey: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId: string;
  userId: string;
  creatorId: string;
  productId: string;
  productTitle: string;
  priceUSDT: number;
  status: SubscriptionStatus;
  nextBillingDate: string;
  error?: string;
}

export interface RenewalResult {
  subscriptionId: string;
  renewed: boolean;
  userId: string;
  priceUSDT: number;
  newStatus: SubscriptionStatus;
  error?: string;
}

export interface RechargeCheck {
  subscriptionId: string;
  userId: string;
  wasPaused: boolean;
  resumed: boolean;
  priceUSDT: number;
  currentBalance: number;
}

// ═══════════════ Subscription Service ════════════════════════════════════

export class SubscriptionService {
  private db: Database.Database;
  private levelEngine: CreatorLevelEngine;

  constructor(db: Database.Database, levelEngine: CreatorLevelEngine) {
    this.db = db;
    this.levelEngine = levelEngine;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions_v2 (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_wallet_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_title TEXT NOT NULL,
        price_usdt REAL NOT NULL CHECK(price_usdt >= 9.9),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','CANCELLED')),
        next_billing_date TEXT NOT NULL,
        billing_count INTEGER NOT NULL DEFAULT 0,
        total_paid_usdt REAL NOT NULL DEFAULT 0,
        paused_at TEXT,
        paused_reason TEXT,
        cancelled_at TEXT,
        idempotency_key TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES marketplace_products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_v2_user ON subscriptions_v2(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_v2_creator ON subscriptions_v2(creator_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_v2_next ON subscriptions_v2(next_billing_date);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_v2_status ON subscriptions_v2(status);
    `);
  }

  /**
   * Subscribe to a signal product.
   */
  subscribe(req: SubscriptionRequest): SubscriptionResult {
    // Idempotency
    const idemp = this.db.prepare(
      'SELECT id, status FROM subscriptions_v2 WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as { id: string; status: SubscriptionStatus } | undefined;
    if (idemp) {
      const s = this.db.prepare('SELECT * FROM subscriptions_v2 WHERE id=?').get(idemp.id) as any;
      return this.buildResult(s);
    }

    // Validate product
    const product = this.db.prepare(
      'SELECT * FROM marketplace_products WHERE id=? AND type="SUBSCRIPTION"'
    ).get(req.productId) as any;
    if (!product || !product.published) {
      return { success: false, subscriptionId: '', userId: req.userId, creatorId: '',
        productId: req.productId, productTitle: '', priceUSDT: 0, status: 'CANCELLED',
        nextBillingDate: '', error: 'Product not found or not published' };
    }

    // Check for existing subscription
    const existing = this.db.prepare(
      "SELECT * FROM subscriptions_v2 WHERE user_id=? AND product_id=? AND status != 'CANCELLED'"
    ).get(req.userId, req.productId) as any;
    if (existing) {
      return this.buildResult(existing);
    }

    // First payment
    const buyerWallet = this.db.prepare(
      'SELECT * FROM wallets WHERE id=? AND user_id=?'
    ).get(req.userWalletId, req.userId) as any;
    if (!buyerWallet || buyerWallet.usdt_balance < product.price_usdt) {
      return { success: false, subscriptionId: '', userId: req.userId, creatorId: product.creator_id,
        productId: req.productId, productTitle: product.title, priceUSDT: product.price_usdt,
        status: 'CANCELLED', nextBillingDate: '', error: 'Insufficient balance' };
    }

    const commission = this.levelEngine.calculateCommission(product.creator_id, product.price_usdt);
    const creatorWallet = this.db.prepare('SELECT * FROM wallets WHERE user_id=?').get(product.creator_id) as any;

    let subId = '';
    const txResult = this.db.transaction(() => {
      // Debit buyer
      const newBalance = roundUSD(buyerWallet.usdt_balance - product.price_usdt);
      const newVersion = buyerWallet.version + 1;
      const checksum = computeChecksum(newBalance, buyerWallet.usdt_frozen, newVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(newBalance, checksum, newVersion, req.userWalletId, buyerWallet.version);

      // Credit creator
      if (creatorWallet) {
        const cNew = roundUSD(creatorWallet.usdt_balance + commission.creatorShare);
        const cVersion = creatorWallet.version + 1;
        const cChk = computeChecksum(cNew, creatorWallet.usdt_frozen, cVersion);
        this.db.prepare(
          "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
        ).run(cNew, cChk, cVersion, creatorWallet.id, creatorWallet.version);
      }

      // Next billing = 30 days
      const nextBilling = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      subId = generateId();
      this.db.prepare(`
        INSERT INTO subscriptions_v2 (id, user_id, user_wallet_id, creator_id, product_id, product_title, price_usdt, status, next_billing_date, billing_count, total_paid_usdt, idempotency_key)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(subId, req.userId, req.userWalletId, product.creator_id, product.id,
        product.title, product.price_usdt, 'ACTIVE', nextBilling, 1, product.price_usdt, req.idempotencyKey);

      // Ledger entries
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(req.userWalletId, req.userId, 'SUBSCRIPTION_PAY', -product.price_usdt, newBalance,
        subId, `${req.idempotencyKey}_pay`, `${product.title} subscription (month 1)`);

      if (creatorWallet) {
        this.db.prepare(`
          INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(creatorWallet.id, product.creator_id, 'SUBSCRIPTION_EARN', commission.creatorShare,
          roundUSD(creatorWallet.usdt_balance + commission.creatorShare),
          subId, `${req.idempotencyKey}_earn`, `${product.title} subscription earnings`);
      }

      // Grant library access
      this.db.prepare(
        'INSERT OR REPLACE INTO user_library (user_id, product_id, purchase_id) VALUES (?,?,?)'
      ).run(req.userId, product.id, subId);
    }) as (() => void);

    try { txResult(); } catch (err: any) {
      return { success: false, subscriptionId: '', userId: req.userId, creatorId: product.creator_id,
        productId: req.productId, productTitle: product.title, priceUSDT: product.price_usdt,
        status: 'CANCELLED', nextBillingDate: '', error: `Transaction failed: ${err.message}` };
    }

    // Record sale (first month = 1 sale)
    this.levelEngine.recordSubscriptionSale(product.creator_id, commission.creatorShare, true);

    const sub = this.db.prepare('SELECT * FROM subscriptions_v2 WHERE id=?').get(subId) as any;
    return this.buildResult(sub);
  }

  /**
   * Process subscription renewal (called by cron or admin).
   */
  renewSubscription(subscriptionId: string): RenewalResult {
    const sub = this.db.prepare('SELECT * FROM subscriptions_v2 WHERE id=?').get(subscriptionId) as any;
    if (!sub) return { subscriptionId, renewed: false, userId: '', priceUSDT: 0, newStatus: 'CANCELLED', error: 'Not found' };
    if (sub.status === 'CANCELLED') return { subscriptionId, renewed: false, userId: sub.user_id,
      priceUSDT: sub.price_usdt, newStatus: 'CANCELLED', error: 'Already cancelled' };

    // Check wallet
    const wallet = this.db.prepare('SELECT * FROM wallets WHERE id=?').get(sub.user_wallet_id) as any;
    if (!wallet || wallet.usdt_balance < sub.price_usdt) {
      // Pause subscription
      this.db.prepare(
        "UPDATE subscriptions_v2 SET status='PAUSED', paused_at=datetime('now'), paused_reason='Insufficient balance', updated_at=datetime('now') WHERE id=?"
      ).run(subscriptionId);
      return { subscriptionId, renewed: false, userId: sub.user_id, priceUSDT: sub.price_usdt,
        newStatus: 'PAUSED', error: 'Insufficient balance — subscription paused' };
    }

    // Calculate commission
    const commission = this.levelEngine.calculateCommission(sub.creator_id, sub.price_usdt);
    const creatorWallet = this.db.prepare('SELECT * FROM wallets WHERE user_id=?').get(sub.creator_id) as any;

    this.db.transaction(() => {
      // Debit subscriber
      const newBalance = roundUSD(wallet.usdt_balance - sub.price_usdt);
      const newVersion = wallet.version + 1;
      const checksum = computeChecksum(newBalance, wallet.usdt_frozen, newVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(newBalance, checksum, newVersion, sub.user_wallet_id, wallet.version);

      // Credit creator
      if (creatorWallet) {
        const cNew = roundUSD(creatorWallet.usdt_balance + commission.creatorShare);
        const cVersion = creatorWallet.version + 1;
        const cChk = computeChecksum(cNew, creatorWallet.usdt_frozen, cVersion);
        this.db.prepare(
          "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
        ).run(cNew, cChk, cVersion, creatorWallet.id, creatorWallet.version);
      }

      // Next billing +30 days
      const nextBilling = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      const newCount = sub.billing_count + 1;

      this.db.prepare(`
        UPDATE subscriptions_v2 SET
          status='ACTIVE', next_billing_date=?, billing_count=?, total_paid_usdt=total_paid_usdt+?,
          paused_at=NULL, paused_reason=NULL, updated_at=datetime('now')
        WHERE id=?
      `).run(nextBilling, newCount, sub.price_usdt, subscriptionId);

      // Ledger
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, description)
        VALUES (?,?,?,?,?,?,?)
      `).run(sub.user_wallet_id, sub.user_id, 'SUBSCRIPTION_PAY', -sub.price_usdt, newBalance,
        subscriptionId, `${sub.product_title} subscription (month ${newCount})`);

      if (creatorWallet) {
        this.db.prepare(`
          INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, description)
          VALUES (?,?,?,?,?,?,?)
        `).run(creatorWallet.id, sub.creator_id, 'SUBSCRIPTION_EARN', commission.creatorShare,
          roundUSD(creatorWallet.usdt_balance + commission.creatorShare),
          subscriptionId, `${sub.product_title} subscription earnings (month ${newCount})`);
      }
    })();

    // Non-first-month = just revenue, not a new sale
    this.levelEngine.recordSubscriptionSale(sub.creator_id, commission.creatorShare, false);

    return { subscriptionId, renewed: true, userId: sub.user_id, priceUSDT: sub.price_usdt, newStatus: 'ACTIVE' };
  }

  /**
   * Check if user has balance to resume paused subscriptions.
   */
  checkRechargeResume(userId: string): RechargeCheck[] {
    const paused = this.db.prepare(
      "SELECT * FROM subscriptions_v2 WHERE user_id=? AND status='PAUSED'"
    ).all(userId) as any[];

    const results: RechargeCheck[] = [];

    for (const sub of paused) {
      const wallet = this.db.prepare('SELECT * FROM wallets WHERE id=?').get(sub.user_wallet_id) as any;
      const res: RechargeCheck = {
        subscriptionId: sub.id, userId, wasPaused: true, resumed: false,
        priceUSDT: sub.price_usdt, currentBalance: wallet?.usdt_balance || 0,
      };

      if (wallet && wallet.usdt_balance >= sub.price_usdt) {
        // Resume
        this.db.prepare(
          "UPDATE subscriptions_v2 SET status='ACTIVE', paused_at=NULL, paused_reason=NULL, updated_at=datetime('now') WHERE id=?"
        ).run(sub.id);
        res.resumed = true;
      }

      results.push(res);
    }

    return results;
  }

  /**
   * Get all subscriptions needing renewal (for daily cron).
   */
  getDueForRenewal(): any[] {
    const now = new Date().toISOString();
    return this.db.prepare(
      "SELECT * FROM subscriptions_v2 WHERE status='ACTIVE' AND next_billing_date <= ?"
    ).all(now) as any[];
  }

  /**
   * Cancel a subscription.
   */
  cancelSubscription(subscriptionId: string, userId: string): SubscriptionResult {
    const sub = this.db.prepare('SELECT * FROM subscriptions_v2 WHERE id=? AND user_id=?')
      .get(subscriptionId, userId) as any;
    if (!sub) return { success: false, subscriptionId, userId, creatorId: '', productId: '',
      productTitle: '', priceUSDT: 0, status: 'CANCELLED', nextBillingDate: '', error: 'Not found' };

    this.db.prepare(
      "UPDATE subscriptions_v2 SET status='CANCELLED', cancelled_at=datetime('now'), updated_at=datetime('now') WHERE id=?"
    ).run(subscriptionId);

    return this.buildResult({ ...sub, status: 'CANCELLED' });
  }

  getUserSubscriptions(userId: string): any[] {
    return this.db.prepare(
      "SELECT * FROM subscriptions_v2 WHERE user_id=? ORDER BY created_at DESC"
    ).all(userId);
  }

  getCreatorSubscribers(creatorId: string): any[] {
    return this.db.prepare(
      "SELECT * FROM subscriptions_v2 WHERE creator_id=? AND status='ACTIVE'"
    ).all(creatorId);
  }

  // ═══════════ Helpers ══════════════════════════════════════════════

  private buildResult(s: any): SubscriptionResult {
    return {
      success: true, subscriptionId: s.id,
      userId: s.user_id, creatorId: s.creator_id,
      productId: s.product_id, productTitle: s.product_title,
      priceUSDT: s.price_usdt, status: s.status,
      nextBillingDate: s.next_billing_date,
    };
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
