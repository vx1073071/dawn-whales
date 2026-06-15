/**
 * DAWN WHALES R144 Claw(PM) — Subscription Cron Scheduler
 * 
 * Daily cron job that checks expiring signal subscriptions and
 * auto-renews them. If balance insufficient, pauses subscription.
 * When user recharges, subscription auto-resumes.
 * 
 * v17.6 Signal Subscription Rules:
 *   - Minimum monthly fee: 9.9 USDT
 *   - Platform takes commission based on creator level (L1:30%/L2:20%/L3:10%)
 *   - Balance insufficient → pause subscription + notify
 *   - Recharge → auto-resume + catch up current month
 * 
 * Run: every day at 00:00 UTC (or via server startup for dev)
 * 
 * ≥150L production-ready
 */

import Database from 'better-sqlite3';
import { BillingService } from './billing-service';
import { TipEngine } from './tip-engine';

// ═══════════════ Types ════════════════════════════════════════════════════

export interface SubscriptionRecord {
  id: string;
  subscriberId: string;
  subscriberWalletId: string;
  creatorId: string;
  creatorWalletId: string;
  monthlyFeeUSDT: number;
  nextBillingDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  consecutiveFailures: number;
  signalId?: string;
}

export interface CronResult {
  timestamp: string;
  totalChecked: number;
  renewed: number;
  paused: number;
  resumed: number;
  failed: number;
  totalRevenueUSDT: number;
  errors: string[];
}

// ═══════════════ Subscription Cron ════════════════════════════════════════

export class SubscriptionCron {
  private db: Database.Database;
  private billingService: BillingService;
  private tipEngine: TipEngine;

  // 24h warning before expiry
  static readonly WARNING_HOURS = 24;
  static readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor(db: Database.Database, billingService: BillingService, tipEngine: TipEngine) {
    this.db = db;
    this.billingService = billingService;
    this.tipEngine = tipEngine;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signal_subscriptions (
        id TEXT PRIMARY KEY,
        subscriber_id TEXT NOT NULL,
        subscriber_wallet_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        creator_wallet_id TEXT NOT NULL,
        signal_id TEXT,
        monthly_fee_usdt REAL NOT NULL CHECK(monthly_fee_usdt >= 9.9),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','CANCELLED')),
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        next_billing_date TEXT NOT NULL,
        last_billed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (subscriber_id) REFERENCES users(id),
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_subs_status ON signal_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subs_next_billing ON signal_subscriptions(next_billing_date);
      CREATE INDEX IF NOT EXISTS idx_subs_subscriber ON signal_subscriptions(subscriber_id);
      CREATE INDEX IF NOT EXISTS idx_subs_creator ON signal_subscriptions(creator_id);

      CREATE TABLE IF NOT EXISTS subscription_invoices (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL,
        subscriber_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        amount_usdt REAL NOT NULL,
        commission_usdt REAL NOT NULL,
        creator_receives REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'PAID' CHECK(status IN ('PAID','FAILED','REFUNDED')),
        billed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (subscription_id) REFERENCES signal_subscriptions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_sub ON subscription_invoices(subscription_id);
    `);
  }

  // ── Daily Run ───────────────────────────────────────────────────────────

  runDailyRenewal(): CronResult {
    const now = new Date().toISOString();
    const errors: string[] = [];
    let totalRenewed = 0;
    let totalPaused = 0;
    let totalResumed = 0;
    let totalFailed = 0;
    let totalRevenue = 0;

    // Find all subscriptions due for renewal (next_billing_date <= today)
    const due = this.db.prepare(`
      SELECT * FROM signal_subscriptions
      WHERE status IN ('ACTIVE','PAUSED')
        AND date(next_billing_date) <= date('now')
      ORDER BY next_billing_date ASC
    `).all() as SubscriptionRecord[];

    for (const sub of due) {
      try {
        this.db.transaction(() => {
          // PAUSED: check if can resume
          if (sub.status === 'PAUSED') {
            const wallet = this.db.prepare(
              'SELECT usdt_balance FROM wallets WHERE id = ?'
            ).get(sub.subscriberWalletId) as any;

            if (wallet && wallet.usdt_balance >= sub.monthlyFeeUSDT) {
              // Resume and bill
              this.doBill(sub);
              this.db.prepare(`
                UPDATE signal_subscriptions SET status = 'ACTIVE', consecutive_failures = 0,
                  next_billing_date = datetime('now', '+1 month'), updated_at = datetime('now')
                WHERE id = ?
              `).run(sub.id);
              totalResumed++;
              totalRevenue += sub.monthlyFeeUSDT;
              totalRenewed++;
            } else {
              // Still insufficient
              totalFailed++;
            }
            return;
          }

          // ACTIVE: try to bill
          const wallet = this.db.prepare(
            'SELECT usdt_balance FROM wallets WHERE id = ?'
          ).get(sub.subscriberWalletId) as any;

          if (!wallet) {
            errors.push(`Wallet not found for subscription ${sub.id}`);
            totalFailed++;
            return;
          }

          if (wallet.usdt_balance < sub.monthlyFeeUSDT) {
            // Insufficient → pause
            const newFailures = sub.consecutiveFailures + 1;
            const newStatus = newFailures >= SubscriptionCron.MAX_CONSECUTIVE_FAILURES
              ? 'CANCELLED' : 'PAUSED';

            this.db.prepare(`
              UPDATE signal_subscriptions SET status = ?, consecutive_failures = ?,
                updated_at = datetime('now') WHERE id = ?
            `).run(newStatus, newFailures, sub.id);

            if (newStatus === 'PAUSED') totalPaused++;
            else totalFailed++;

            // Send notification (pseudo — real implementation via notification service)
            console.log(`[SubCron] Subscription ${sub.id} ${newStatus}: balance insufficient (need ${sub.monthlyFeeUSDT})`);
            return;
          }

          // Bill successfully
          this.doBill(sub);

          // Update next billing date
          this.db.prepare(`
            UPDATE signal_subscriptions SET
              status = 'ACTIVE',
              consecutive_failures = 0,
              next_billing_date = datetime('now', '+1 month'),
              last_billed_at = datetime('now'),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(sub.id);

          totalRenewed++;
          totalRevenue += sub.monthlyFeeUSDT;
        })();
      } catch (err: any) {
        errors.push(`Subscription ${sub.id}: ${err.message}`);
        totalFailed++;
      }
    }

    return {
      timestamp: now,
      totalChecked: due.length,
      renewed: totalRenewed,
      paused: totalPaused,
      resumed: totalResumed,
      failed: totalFailed,
      totalRevenueUSDT: roundUSD(totalRevenue),
      errors,
    };
  }

  // ── Warning: Notify subscriptions expiring in 24h ───────────────────────

  getExpiringSoon(): SubscriptionRecord[] {
    return this.db.prepare(`
      SELECT * FROM signal_subscriptions
      WHERE status = 'ACTIVE'
        AND next_billing_date <= datetime('now', '+24 hours')
        AND next_billing_date > datetime('now')
      ORDER BY next_billing_date ASC
    `).all() as SubscriptionRecord[];
  }

  // ── Pause / Resume / Cancel by Admin ────────────────────────────────────

  pauseSubscription(id: string): boolean {
    const result = this.db.prepare(
      "UPDATE signal_subscriptions SET status = 'PAUSED', updated_at = datetime('now') WHERE id = ? AND status = 'ACTIVE'"
    ).run(id);
    return result.changes > 0;
  }

  resumeSubscription(id: string): boolean {
    const result = this.db.prepare(
      "UPDATE signal_subscriptions SET status = 'ACTIVE', consecutive_failures = 0, updated_at = datetime('now') WHERE id = ? AND status = 'PAUSED'"
    ).run(id);
    return result.changes > 0;
  }

  cancelSubscription(id: string): boolean {
    const result = this.db.prepare(
      "UPDATE signal_subscriptions SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ? AND status IN ('ACTIVE','PAUSED')"
    ).run(id);
    return result.changes > 0;
  }

  // ── Private: Execute Billing ────────────────────────────────────────────

  private doBill(sub: SubscriptionRecord): void {
    const creatorInfo = this.tipEngine.getCreatorLevel(sub.creatorId);
    const commissionPercent = creatorInfo.commissionRate;
    const commissionUSDT = roundUSD(sub.monthlyFeeUSDT * commissionPercent / 100);
    const creatorReceives = roundUSD(sub.monthlyFeeUSDT - commissionUSDT);
    const invoiceId = generateId();
    const idempotencyKey = `sub_${sub.id}_${new Date().toISOString().slice(0, 10)}`;

    // Deduct subscriber
    const deductResult = this.billingService.deductBalance({
      userId: sub.subscriberId,
      walletId: sub.subscriberWalletId,
      amountUSDT: sub.monthlyFeeUSDT,
      entryType: 'SUBSCRIPTION_PAY',
      idempotencyKey,
      description: `Signal subscription monthly fee`,
    });

    if (!deductResult.success) {
      throw new Error(`Deduct failed: ${deductResult.error}`);
    }

    // Credit creator
    this.billingService.creditBalance({
      userId: sub.creatorId,
      walletId: sub.creatorWalletId,
      amountUSDT: creatorReceives,
      entryType: 'SUBSCRIPTION_EARN',
      idempotencyKey: `${idempotencyKey}_credit`,
      description: `Subscription income (${commissionPercent}% commission)`,
    });

    // Record invoice
    this.db.prepare(`
      INSERT INTO subscription_invoices (id, subscription_id, subscriber_id, creator_id, amount_usdt, commission_usdt, creator_receives)
      VALUES (?,?,?,?,?,?,?)
    `).run(invoiceId, sub.id, sub.subscriberId, sub.creatorId,
      sub.monthlyFeeUSDT, commissionUSDT, creatorReceives);

    // Increment creator sales count
    this.tipEngine.incrementSales(sub.creatorId);
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
