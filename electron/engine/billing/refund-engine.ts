// ── R174 D8: Refund Engine ────────────────────────────────────────────────
// Handles refund processing for AI/deep/strategy analysis charges.
// 48-hour refund window, state machine, anti-duplicate, admin review.
// Copyright (c) 2026 DAWN WHALES. All rights reserved.

// logger disabled (vite module resolution)

// ── Types ───────────────────────────────────────────────────────────────────

export type RefundStatus = 'pending' | 'approved' | 'refunded' | 'rejected';

export interface RefundRequest {
  refundId: string;
  transactionId: string;       // original charge tx
  userId: string;
  amountUSDT: number;
  serviceType: string;
  reason: string;
  status: RefundStatus;
  createdAt: string;           // ISO timestamp
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  chargeTimestamp: string;     // when original charge happened
}

export interface RefundEligibilityResult {
  eligible: boolean;
  reason?: string;
  expiresAt?: string;
  hoursRemaining?: number;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: RefundStatus;
  message: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** 48-hour refund window (in milliseconds) */
const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Maximum refund requests per user per transaction (anti-duplicate) */
const MAX_REFUNDS_PER_TX = 1;

// ── Refund Engine ───────────────────────────────────────────────────────────

export class RefundEngine {
  private requests: Map<string, RefundRequest> = new Map();
  private processedTxIds: Set<string> = new Set();

  constructor() {
    console.log('[RefundEngine] Initialized — 48h refund window');
  }

  /**
   * Check if a charge is eligible for refund.
   * Returns eligibility info including remaining window.
   */
  checkEligibility(chargeTimestamp: string): RefundEligibilityResult {
    const chargeTime = new Date(chargeTimestamp).getTime();
    if (isNaN(chargeTime)) {
      return { eligible: false, reason: 'Invalid charge timestamp' };
    }

    const now = Date.now();
    const elapsed = now - chargeTime;
    const hoursRemaining = Math.max(0, (REFUND_WINDOW_MS - elapsed) / (60 * 60 * 1000));

    if (elapsed > REFUND_WINDOW_MS) {
      const hours = Math.floor(elapsed / (60 * 60 * 1000));
      return {
        eligible: false,
        reason: `退款窗口已关闭 (${hours}小时, 超出48小时限制)`,
        expiresAt: new Date(chargeTime + REFUND_WINDOW_MS).toISOString(),
        hoursRemaining: 0,
      };
    }

    const expiresAt = new Date(chargeTime + REFUND_WINDOW_MS).toISOString();

    return {
      eligible: true,
      expiresAt,
      hoursRemaining: Number(hoursRemaining.toFixed(1)),
    };
  }

  /**
   * Submit a refund request.
   * Returns error if:
   *  - Outside 48h window
   *  - Duplicate request for same transaction
   *  - Missing required reason
   */
  async submitRefund(
    transactionId: string,
    userId: string,
    chargeTimestamp: string,
    reason: string,
    details?: { serviceType?: string; amountUSDT?: number },
  ): Promise<RefundResult> {
    // ── Validate reason ──
    if (!reason || reason.trim().length < 10) {
      return {
        success: false,
        refundId: '',
        status: 'rejected',
        message: '退款理由需至少10个字符，请详细说明退款原因',
      };
    }

    // ── Anti-duplicate ──
    if (this.processedTxIds.has(transactionId)) {
      return {
        success: false,
        refundId: '',
        status: 'rejected',
        message: '该交易已提交过退款申请，不可重复申请',
      };
    }

    // Check for pending duplicate
    for (const [, req] of this.requests) {
      if (req.transactionId === transactionId) {
        return {
          success: false,
          refundId: req.refundId,
          status: req.status,
          message: `该交易已有退款申请 (状态: ${req.status})`,
        };
      }
    }

    // ── Check 48h window ──
    const eligibility = this.checkEligibility(chargeTimestamp);
    if (!eligibility.eligible) {
      return {
        success: false,
        refundId: '',
        status: 'rejected',
        message: eligibility.reason || '不满足退款条件',
      };
    }

    // ── Create refund request ──
    const refundId = this.generateRefundId(transactionId);
    const request: RefundRequest = {
      refundId,
      transactionId,
      userId,
      amountUSDT: details?.amountUSDT || 0,
      serviceType: details?.serviceType || 'unknown',
      reason: reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      chargeTimestamp,
    };

    this.requests.set(refundId, request);
    this.processedTxIds.add(transactionId);

    console.log(`[RefundEngine] Refund submitted — ID: ${refundId}, Tx: ${transactionId}, Amount: ${request.amountUSDT} USDT`);

    return {
      success: true,
      refundId,
      status: 'pending',
      message: `退款申请已提交 (${eligibility.hoursRemaining?.toFixed(1)}小时内可退款)`,
    };
  }

  /**
   * Admin: Approve a refund request.
   * Transitions: pending → approved → (refunded via processRefund)
   */
  async approveRefund(refundId: string, adminId: string): Promise<RefundResult> {
    const request = this.requests.get(refundId);
    if (!request) {
      return { success: false, refundId, status: 'rejected', message: '退款申请不存在' };
    }

    if (request.status !== 'pending') {
      return {
        success: false,
        refundId,
        status: request.status,
        message: `无法审批: 当前状态为 ${request.status}, 仅 pending 状态可审批`,
      };
    }

    // Check time window still valid
    const eligibility = this.checkEligibility(request.chargeTimestamp);
    if (!eligibility.eligible) {
      request.status = 'rejected';
      request.reviewedAt = new Date().toISOString();
      request.reviewedBy = adminId;
      request.rejectionReason = '审批时已超过48小时退款窗口';
      return { success: false, refundId, status: 'rejected', message: '退款窗口已关闭' };
    }

    request.status = 'approved';
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = adminId;

    console.log(`[RefundEngine] Refund APPROVED — ID: ${refundId}, Admin: ${adminId}`);

    return { success: true, refundId, status: 'approved', message: '退款已批准' };
  }

  /**
   * Admin: Reject a refund request.
   * Transitions: pending → rejected
   */
  async rejectRefund(refundId: string, adminId: string, reason: string): Promise<RefundResult> {
    const request = this.requests.get(refundId);
    if (!request) {
      return { success: false, refundId, status: 'rejected', message: '退款申请不存在' };
    }

    if (request.status !== 'pending') {
      return {
        success: false,
        refundId,
        status: request.status,
        message: `无法拒绝: 当前状态为 ${request.status}`,
      };
    }

    request.status = 'rejected';
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = adminId;
    request.rejectionReason = reason;

    console.log(`[RefundEngine] Refund REJECTED — ID: ${refundId}, Admin: ${adminId}, Reason: ${reason}`);

    return { success: true, refundId, status: 'rejected', message: '退款已拒绝' };
  }

  /**
   * Process refund: execute the actual fund return.
   * Transitions: approved → refunded
   * In production, this calls the server billing API.
   */
  async processRefund(refundId: string): Promise<RefundResult> {
    const request = this.requests.get(refundId);
    if (!request) {
      return { success: false, refundId, status: 'rejected', message: '退款申请不存在' };
    }

    if (request.status !== 'approved') {
      return {
        success: false,
        refundId,
        status: request.status,
        message: `无法执行退款: 当前状态为 ${request.status}, 需要 approved 状态`,
      };
    }

    const eligibility = this.checkEligibility(request.chargeTimestamp);
    if (!eligibility.eligible) {
      request.status = 'rejected';
      request.rejectionReason = '执行时已超过48小时退款窗口';
      return { success: false, refundId, status: 'rejected', message: '退款窗口已关闭' };
    }

    request.status = 'refunded';

    console.log(`[RefundEngine] Refund EXECUTED — ID: ${refundId}, Amount: ${request.amountUSDT} USDT returned to user ${request.userId}`);

    return {
      success: true,
      refundId,
      status: 'refunded',
      message: `已退款 ${request.amountUSDT} USDT`,
    };
  }

  /**
   * Get refund request by ID.
   */
  getRefund(refundId: string): RefundRequest | null {
    return this.requests.get(refundId) || null;
  }

  /**
   * Get all refund requests for a user.
   */
  getUserRefunds(userId: string): RefundRequest[] {
    const results: RefundRequest[] = [];
    for (const [, req] of this.requests) {
      if (req.userId === userId) {
        results.push(req);
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get pending refunds (for admin review).
   */
  getPendingRefunds(): RefundRequest[] {
    const results: RefundRequest[] = [];
    for (const [, req] of this.requests) {
      if (req.status === 'pending') {
        results.push(req);
      }
    }
    return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Get refund statistics
   */
  getStats(): { total: number; pending: number; approved: number; refunded: number; rejected: number; totalRefundedUSDT: number } {
    let pending = 0;
    let approved = 0;
    let refunded = 0;
    let rejected = 0;
    let totalRefundedUSDT = 0;

    for (const [, req] of this.requests) {
      switch (req.status) {
        case 'pending': pending++; break;
        case 'approved': approved++; break;
        case 'refunded': refunded++; totalRefundedUSDT += req.amountUSDT; break;
        case 'rejected': rejected++; break;
      }
    }

    return {
      total: this.requests.size,
      pending,
      approved,
      refunded,
      rejected,
      totalRefundedUSDT: Number(totalRefundedUSDT.toFixed(2)),
    };
  }

  /**
   * Clear all refund data (for testing).
   */
  clear(): void {
    this.requests.clear();
    this.processedTxIds.clear();
    console.log('[RefundEngine] All data cleared');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateRefundId(transactionId: string): string {
    const ts = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const txSuffix = transactionId.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
    return `REF-${ts}-${txSuffix}-${random}`;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createRefundEngine(): RefundEngine {
  return new RefundEngine();
}

let _refundEngine: RefundEngine | null = null;

export function getRefundEngine(): RefundEngine {
  if (!_refundEngine) _refundEngine = new RefundEngine();
  return _refundEngine;
}

export function resetRefundEngine(): void {
  _refundEngine = null;
}
