/**
 * QUANT MOO R143 Claw(PM) — Withdrawal Review Service
 * 
 * Admin review queue for manual-approval withdrawals.
 * Only triggered when: balance > 1,000 USDT AND registered < 7 days.
 * 
 * v17.6 Rules:
 *   - First withdrawal: auto-approved (no review)
 *   - New address: auto-approved (no review)
 *   - Same address 24h: auto-approved
 *   - Only "new user + high balance" triggers manual review
 * 
 * ≥150L production-ready
 */

import Database from 'better-sqlite3';
import { BillingService } from './billing-service';
import { RiskEngine } from './risk-engine';

// ═══════════════ Types ════════════════════════════════════════════════════

export interface ReviewItem {
  auditId: number;
  userId: string;
  username: string;
  walletId: string;
  amountUSDT: number;
  toAddress: string;
  network: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  userBalance: number;
  userRegisteredDays: number;
  reason: string;
  createdAt: string;
}

export interface ReviewAction {
  auditId: number;
  action: 'APPROVED' | 'REJECTED';
  reviewedBy: string;
  notes?: string;
}

export interface ReviewStats {
  totalPending: number;
  totalApprovedToday: number;
  totalRejectedToday: number;
  totalAmountPending: number;
  highRiskCount: number;
}

// ═══════════════ Withdrawal Review Service ═════════════════════════════════

export class WithdrawReviewService {
  private db: Database.Database;
  private billingService: BillingService;
  private riskEngine: RiskEngine;

  constructor(db: Database.Database, billingService: BillingService, riskEngine: RiskEngine) {
    this.db = db;
    this.billingService = billingService;
    this.riskEngine = riskEngine;
  }

  // ── Get Pending Reviews ─────────────────────────────────────────────────

  getPendingReviews(): ReviewItem[] {
    const rows = this.db.prepare(`
      SELECT
        wa.id as audit_id,
        wa.user_id,
        u.username,
        wa.wallet_id,
        wa.amount_usdt,
        wa.to_address,
        wa.network,
        wa.risk_level,
        wa.created_at,
        w.usdt_balance as user_balance,
        u.created_at as user_registered_at
      FROM withdrawal_audit wa
      JOIN users u ON u.id = wa.user_id
      JOIN wallets w ON w.id = wa.wallet_id
      WHERE wa.review_status = 'PENDING'
      ORDER BY
        CASE wa.risk_level WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
        wa.created_at ASC
    `).all() as any[];

    return rows.map(r => ({
      auditId: r.audit_id,
      userId: r.user_id,
      username: r.username,
      walletId: r.wallet_id,
      amountUSDT: r.amount_usdt,
      toAddress: r.to_address,
      network: r.network,
      riskLevel: r.risk_level,
      userBalance: r.user_balance,
      userRegisteredDays: daysSinceDate(r.user_registered_at),
      reason: r.risk_level === 'HIGH'
        ? `Balance > 1,000 USDT AND registered < 7 days`
        : 'Manual review queue',
      createdAt: r.created_at,
    }));
  }

  // ── Approve / Reject ────────────────────────────────────────────────────

  approveWithdrawal(auditId: number, reviewedBy: string): ReviewItem | null {
    const audit = this.db.prepare(
      'SELECT * FROM withdrawal_audit WHERE id = ? AND review_status = ?'
    ).get(auditId, 'PENDING') as any;

    if (!audit) return null;

    this.riskEngine.approveReview(auditId, reviewedBy);

    return this.getReviewById(auditId);
  }

  rejectWithdrawal(auditId: number, reviewedBy: string, note?: string): ReviewItem | null {
    const audit = this.db.prepare(
      'SELECT * FROM withdrawal_audit WHERE id = ? AND review_status = ?'
    ).get(auditId, 'PENDING') as any;

    if (!audit) return null;

    this.riskEngine.rejectReview(auditId, reviewedBy);

    // Refund the frozen amount
    if (audit.status === 'PENDING') {
      this.riskEngine.updateWithdrawalStatus(auditId, 'ROLLED_BACK');
    }

    return this.getReviewById(auditId);
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getReviewStats(): ReviewStats {
    const pending = this.db.prepare(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(amount_usdt), 0) as total FROM withdrawal_audit WHERE review_status = 'PENDING'"
    ).get() as any;

    const today = new Date().toISOString().slice(0, 10);

    const approved = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM withdrawal_audit WHERE review_status = 'APPROVED' AND date(updated_at) = ?"
    ).get(today) as any;

    const rejected = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM withdrawal_audit WHERE review_status = 'REJECTED' AND date(updated_at) = ?"
    ).get(today) as any;

    const highRisk = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM withdrawal_audit WHERE review_status = 'PENDING' AND risk_level = 'HIGH'"
    ).get() as any;

    return {
      totalPending: pending.cnt,
      totalApprovedToday: approved.cnt,
      totalRejectedToday: rejected.cnt,
      totalAmountPending: roundUSD(pending.total),
      highRiskCount: highRisk.cnt,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private getReviewById(auditId: number): ReviewItem | null {
    const r = this.db.prepare(`
      SELECT wa.*, u.username, w.usdt_balance, u.created_at as registered
      FROM withdrawal_audit wa
      JOIN users u ON u.id = wa.user_id
      JOIN wallets w ON w.id = wa.wallet_id
      WHERE wa.id = ?
    `).get(auditId) as any;

    if (!r) return null;

    return {
      auditId: r.id, userId: r.user_id, username: r.username,
      walletId: r.wallet_id, amountUSDT: r.amount_usdt,
      toAddress: r.to_address, network: r.network, riskLevel: r.risk_level,
      userBalance: r.usdt_balance,
      userRegisteredDays: daysSinceDate(r.registered),
      reason: r.risk_level === 'HIGH'
        ? `Balance > 1,000 USDT AND registered < 7 days` : 'Manual review queue',
      createdAt: r.created_at,
    };
  }
}

// ═══════════════ Helpers ═══════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function daysSinceDate(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}
