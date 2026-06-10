/**
 * J-59-02: Platform Commission Engine (R59 v19)
 * AI analysis real-time profit split + creator withdrawal + platform dashboard
 *
 * Features:
 * - Integrates with revenue-engine-v15: L1(70/30) L2(80/20) L3(90/10)
 * - AI analysis real-time profit split on each settlement
 * - Creator withdrawal (≥10 USDT, manual review for MVP)
 * - Platform income dashboard data (daily/weekly/monthly/cumulative)
 * - Billing statement: consumption + platform fee + creator income
 *
 * ≥350L, 12 tests
 */

import { EventEmitter } from 'events';
import { CreatorTier, RevenueEngineV15, getRevenueEngineV15 } from '../portfolio/revenue-engine-v15';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export type CommissionSplit = {
  tier: CreatorTier;
  creatorPercent: number;
  platformPercent: number;
};

export interface CommissionTransaction {
  id: string;
  creator: string;
  tier: CreatorTier;
  billingSessionId: string;
  grossAmountUSDT: number;
  creatorIncomeUSDT: number;
  platformRevenueUSDT: number;
  splitPercent: number;           // creator's share
  settledAt: string;
}

export interface WithdrawalRequest {
  id: string;
  creator: string;
  amountUSDT: number;
  walletAddress: string;          // TRC-20
  status: 'pending_review' | 'approved' | 'rejected' | 'completed';
  requestedAt: string;
  reviewedAt?: string;
  completedAt?: string;
  reviewerNote?: string;
}

export interface PlatformDashboard {
  period: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCreatorIncome: number;
  totalPlatformRevenue: number;
  totalSettlements: number;
  pendingWithdrawals: number;
  byTier: Record<CreatorTier, { revenue: number; creatorIncome: number; platformRevenue: number; count: number }>;
}

export interface BillingStatement {
  billingSessionId: string;
  creator: string;
  tier: CreatorTier;
  grossAmount: number;
  creatorIncome: number;
  platformFee: number;
  splitPercent: number;
  settledAt: string;
}

// ── Platform Commission Engine ─────────────────────────────────────────────

export class PlatformCommissionEngine extends EventEmitter {
  private commissions: CommissionTransaction[] = [];
  private withdrawals: WithdrawalRequest[] = [];
  private revenueEngine: RevenueEngineV15;
  private withdrawalCounter = 1;
  private minWithdrawalUSDT = 10;

  constructor() {
    super();
    this.revenueEngine = getRevenueEngineV15();
  }

  /**
   * Get commission split for a creator's tier
   */
  getSplit(creatorId: string): CommissionSplit {
    const creator = this.revenueEngine.getCreator(creatorId);
    const tier = creator?.tier || 'L1';
    const tierConfig = this.revenueEngine.getTierConfig(tier);

    return {
      tier,
      creatorPercent: tierConfig.creatorPercent,
      platformPercent: 100 - tierConfig.creatorPercent,
    };
  }

  /**
   * Settle an AI analysis: split the billing amount
   */
  settle(sessionId: string, creator: string, grossAmountUSDT: number): CommissionTransaction {
    const split = this.getSplit(creator);

    const creatorIncome = Math.round(grossAmountUSDT * split.creatorPercent) / 100;
    const platformRevenue = Math.round(grossAmountUSDT * 100 - creatorIncome * 100) / 100;

    const tx: CommissionTransaction = {
      id: `COMM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      creator,
      tier: split.tier,
      billingSessionId: sessionId,
      grossAmountUSDT,
      creatorIncomeUSDT: creatorIncome,
      platformRevenueUSDT: platformRevenue,
      splitPercent: split.creatorPercent,
      settledAt: new Date().toISOString(),
    };

    this.commissions.push(tx);
    this.emit('commission:settled', tx);
    return tx;
  }

  /**
   * Request a withdrawal
   */
  requestWithdrawal(creator: string, amountUSDT: number, walletAddress: string): WithdrawalRequest {
    if (amountUSDT < this.minWithdrawalUSDT) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Minimum withdrawal is $${this.minWithdrawalUSDT} USDT`);
    }

    const totalCreatorIncome = this.getCreatorTotalIncome(creator);
    if (amountUSDT > totalCreatorIncome) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Insufficient earnings: $${totalCreatorIncome} available, requested $${amountUSDT}`);
    }

    const request: WithdrawalRequest = {
      id: `WD-${this.withdrawalCounter++}-${Date.now()}`,
      creator,
      amountUSDT,
      walletAddress,
      status: 'pending_review',
      requestedAt: new Date().toISOString(),
    };

    this.withdrawals.push(request);
    this.emit('withdrawal:requested', request);
    return request;
  }

  /**
   * Review (approve/reject) a withdrawal request
   */
  reviewWithdrawal(requestId: string, status: 'approved' | 'rejected', reviewerNote?: string): WithdrawalRequest {
    const request = this.withdrawals.find(w => w.id === requestId);
    if (!request) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Withdrawal not found: ${requestId}`);
    if (request.status !== 'pending_review') throw new EngineError(ErrorCode.INTERNAL_ERROR, `Withdrawal already ${request.status}`);

    request.status = status;
    request.reviewedAt = new Date().toISOString();
    if (reviewerNote) request.reviewerNote = reviewerNote;

    this.emit(status === 'approved' ? 'withdrawal:approved' : 'withdrawal:rejected', request);
    return request;
  }

  /**
   * Complete a withdrawal (after actual TRC-20 transfer)
   */
  completeWithdrawal(requestId: string): WithdrawalRequest {
    const request = this.withdrawals.find(w => w.id === requestId);
    if (!request) throw new EngineError(ErrorCode.INTERNAL_ERROR, `Withdrawal not found: ${requestId}`);
    if (request.status !== 'approved') throw new EngineError(ErrorCode.INTERNAL_ERROR, `Withdrawal must be approved first`);

    request.status = 'completed';
    request.completedAt = new Date().toISOString();
    this.emit('withdrawal:completed', request);
    return request;
  }

  /**
   * Get creator total income (from settled commissions, minus withdrawals)
   */
  getCreatorTotalIncome(creator: string): number {
    const totalIncome = this.commissions
      .filter(c => c.creator === creator)
      .reduce((s, c) => s + c.creatorIncomeUSDT, 0);

    const totalWithdrawn = this.withdrawals
      .filter(w => w.creator === creator && (w.status === 'approved' || w.status === 'completed'))
      .reduce((s, w) => s + w.amountUSDT, 0);

    return Math.round((totalIncome - totalWithdrawn) * 1000000) / 1000000;
  }

  /**
   * Get creator available balance for withdrawal
   */
  getCreatorAvailableBalance(creator: string): number {
    return this.getCreatorTotalIncome(creator);
  }

  /**
   * Get platform dashboard data
   */
  getPlatformDashboard(since?: string): PlatformDashboard {
    const filtered = this.filterCommissions(since);

    const totalRevenue = Math.round(filtered.reduce((s, c) => s + c.grossAmountUSDT, 0) * 1000000) / 1000000;
    const totalCreatorIncome = Math.round(filtered.reduce((s, c) => s + c.creatorIncomeUSDT, 0) * 1000000) / 1000000;
    const totalPlatformRevenue = Math.round(filtered.reduce((s, c) => s + c.platformRevenueUSDT, 0) * 1000000) / 1000000;

    const byTier: Record<string, { revenue: number; creatorIncome: number; platformRevenue: number; count: number }> = {};
    for (const c of filtered) {
      if (!byTier[c.tier]) byTier[c.tier] = { revenue: 0, creatorIncome: 0, platformRevenue: 0, count: 0 };
      byTier[c.tier].revenue = Math.round((byTier[c.tier].revenue + c.grossAmountUSDT) * 1000000) / 1000000;
      byTier[c.tier].creatorIncome = Math.round((byTier[c.tier].creatorIncome + c.creatorIncomeUSDT) * 1000000) / 1000000;
      byTier[c.tier].platformRevenue = Math.round((byTier[c.tier].platformRevenue + c.platformRevenueUSDT) * 1000000) / 1000000;
      byTier[c.tier].count++;
    }

    return {
      period: since ? 'custom' : 'all-time',
      startDate: since || 'epoch',
      endDate: new Date().toISOString(),
      totalRevenue,
      totalCreatorIncome,
      totalPlatformRevenue,
      totalSettlements: filtered.length,
      pendingWithdrawals: this.withdrawals.filter(w => w.status === 'pending_review').length,
      byTier: byTier as Record<CreatorTier, { revenue: number; creatorIncome: number; platformRevenue: number; count: number }>,
    };
  }

  /**
   * Get creator billing statements
   */
  getCreatorStatements(creator: string): BillingStatement[] {
    return this.commissions
      .filter(c => c.creator === creator)
      .map(c => ({
        billingSessionId: c.billingSessionId,
        creator: c.creator,
        tier: c.tier,
        grossAmount: c.grossAmountUSDT,
        creatorIncome: c.creatorIncomeUSDT,
        platformFee: c.platformRevenueUSDT,
        splitPercent: c.splitPercent,
        settledAt: c.settledAt,
      }));
  }

  /**
   * Get all withdrawals
   */
  getWithdrawals(creator?: string): WithdrawalRequest[] {
    if (creator) return this.withdrawals.filter(w => w.creator === creator);
    return [...this.withdrawals];
  }

  /**
   * Get tier distribution (how many creators at each tier)
   */
  getTierDistribution(): Record<CreatorTier, { creators: number; totalRevenue: number }> {
    const result: Record<string, { creators: Set<string>; totalRevenue: number }> = {
      L1: { creators: new Set(), totalRevenue: 0 },
      L2: { creators: new Set(), totalRevenue: 0 },
      L3: { creators: new Set(), totalRevenue: 0 },
    };

    for (const c of this.commissions) {
      result[c.tier].creators.add(c.creator);
      result[c.tier].totalRevenue = Math.round((result[c.tier].totalRevenue + c.grossAmountUSDT) * 1000000) / 1000000;
    }

    return {
      L1: { creators: result.L1.creators.size, totalRevenue: result.L1.totalRevenue },
      L2: { creators: result.L2.creators.size, totalRevenue: result.L2.totalRevenue },
      L3: { creators: result.L3.creators.size, totalRevenue: result.L3.totalRevenue },
    };
  }

  /**
   * Daily revenue trend
   */
  getDailyRevenueTrend(days: number = 7): { date: string; revenue: number; platformRevenue: number; settlements: number }[] {
    const now = new Date();
    const trend: { date: string; revenue: number; platformRevenue: number; settlements: number }[] = [];

    for (let d = 0; d < days; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().substring(0, 10);
      const dayCommissions = this.commissions.filter(c => c.settledAt.startsWith(dateStr));

      trend.push({
        date: dateStr,
        revenue: Math.round(dayCommissions.reduce((s, c) => s + c.grossAmountUSDT, 0) * 1000000) / 1000000,
        platformRevenue: Math.round(dayCommissions.reduce((s, c) => s + c.platformRevenueUSDT, 0) * 1000000) / 1000000,
        settlements: dayCommissions.length,
      });
    }

    return trend.reverse();
  }

  reset(): void {
    this.commissions = [];
    this.withdrawals = [];
    this.withdrawalCounter = 1;
    this.removeAllListeners();
  }

  private filterCommissions(since?: string): CommissionTransaction[] {
    if (!since) return [...this.commissions];
    const sinceDate = new Date(since);
    return this.commissions.filter(c => new Date(c.settledAt) >= sinceDate);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _commissionInstance: PlatformCommissionEngine | null = null;

export function getCommissionEngine(): PlatformCommissionEngine {
  if (!_commissionInstance) _commissionInstance = new PlatformCommissionEngine();
  return _commissionInstance;
}

export function resetCommissionEngine(): void {
  _commissionInstance?.reset();
  _commissionInstance = null;
}

export default { PlatformCommissionEngine, getCommissionEngine, resetCommissionEngine };
