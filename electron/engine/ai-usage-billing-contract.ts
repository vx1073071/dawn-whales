/**
 * J-59-01: AI Usage Billing Contract (R59 v19)
 * Per-use billing for AI analysis with 3-tier pricing + debate/arena extras
 *
 * Features:
 * - 3-tier pricing: Standard(2 Agent, 1.0)/Premium(3 Agent, 1.5)/Flagship(4 Agent, 2.0) USDT
 * - Debate surcharge: +0.5 USDT per round
 * - Arena mode: base × model count × 0.3
 * - Balance hold → settle on success → refund on failure
 * - New creator: first 3 analyses free
 * - Monthly spending cap (5/10/50/100 USDT)
 *
 * ≥350L, 12 tests
 */

import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type BillingTier = 'standard' | 'premium' | 'flagship';

export interface TierConfig {
  tier: BillingTier;
  name: string;
  agentCount: number;
  basePriceUSDT: number;
  debateSurchargePerRoundUSDT: number;
  arenaMultiplier: number;           // 0.3
}

export interface BillingSession {
  sessionId: string;
  creator: string;
  tier: BillingTier;
  agentCount: number;
  debateRounds: number;
  arenaModels: number;
  estimatedCostUSDT: number;
  actualCostUSDT?: number;
  status: 'pending' | 'holding' | 'settled' | 'refunded' | 'free';
  holdTimestamp?: string;
  settleTimestamp?: string;
  refundTimestamp?: string;
}

export interface CreatorWallet {
  creator: string;
  balanceUSDT: number;
  freeAnalysesRemaining: number;
  monthlySpendingCapUSDT: number;
  monthlySpentUSDT: number;
  lastResetMonth: string;
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'charge' | 'refund' | 'free_use';
  amountUSDT: number;
  balanceAfter: number;
  sessionId?: string;
  timestamp: string;
  description: string;
}

export interface BillingSummary {
  totalSessions: number;
  totalRevenueUSDT: number;
  totalRefundedUSDT: number;
  totalFreeUses: number;
  byTier: Record<BillingTier, { sessions: number; revenue: number }>;
  byCreator: Record<string, { sessions: number; spent: number }>;
}

// ── Tier Configuration ─────────────────────────────────────────────────────

export const TIER_CONFIGS: Record<BillingTier, TierConfig> = {
  standard: {
    tier: 'standard',
    name: 'Standard',
    agentCount: 2,
    basePriceUSDT: 1.0,
    debateSurchargePerRoundUSDT: 0.5,
    arenaMultiplier: 0.3,
  },
  premium: {
    tier: 'premium',
    name: 'Premium',
    agentCount: 3,
    basePriceUSDT: 1.5,
    debateSurchargePerRoundUSDT: 0.5,
    arenaMultiplier: 0.3,
  },
  flagship: {
    tier: 'flagship',
    name: 'Flagship',
    agentCount: 4,
    basePriceUSDT: 2.0,
    debateSurchargePerRoundUSDT: 0.5,
    arenaMultiplier: 0.3,
  },
};

const FREE_ANALYSES_NEW_CREATOR = 3;
const VALID_MONTHLY_CAPS = [5, 10, 50, 100, 0]; // 0 = unlimited

// ── AIUsageBillingContract ─────────────────────────────────────────────────

export class AIUsageBillingContract extends EventEmitter {
  private sessions: Map<string, BillingSession> = new Map();
  private wallets: Map<string, CreatorWallet> = new Map();
  private sessionCounter = 1;

  /**
   * Estimate cost for an analysis
   */
  estimateCost(
    tier: BillingTier,
    debateRounds: number = 0,
    arenaModels: number = 0,
  ): number {
    const config = TIER_CONFIGS[tier];
    let cost = config.basePriceUSDT;
    cost += debateRounds * config.debateSurchargePerRoundUSDT;
    if (arenaModels > 0) {
      cost *= arenaModels * config.arenaMultiplier;
    }
    return Math.round(cost * 1000000) / 1000000;
  }

  /**
   * Get or create creator wallet
   */
  getWallet(creator: string): CreatorWallet {
    if (this.wallets.has(creator)) return this.wallets.get(creator)!;

    const wallet: CreatorWallet = {
      creator,
      balanceUSDT: 0,
      freeAnalysesRemaining: FREE_ANALYSES_NEW_CREATOR,
      monthlySpendingCapUSDT: 0, // unlimited by default
      monthlySpentUSDT: 0,
      lastResetMonth: new Date().toISOString().substring(0, 7),
      transactions: [],
    };
    this.wallets.set(creator, wallet);
    return wallet;
  }

  /**
   * Deposit USDT into creator wallet
   */
  deposit(creator: string, amountUSDT: number, description: string = 'TRC-20 topup'): WalletTransaction {
    const wallet = this.getWallet(creator);
    wallet.balanceUSDT = Math.round((wallet.balanceUSDT + amountUSDT) * 1000000) / 1000000;

    const tx: WalletTransaction = {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type: 'deposit',
      amountUSDT,
      balanceAfter: wallet.balanceUSDT,
      timestamp: new Date().toISOString(),
      description,
    };
    wallet.transactions.push(tx);
    this.emit('wallet:deposit', { creator, amountUSDT, balance: wallet.balanceUSDT });
    return tx;
  }

  /**
   * Check if creator can afford an analysis
   */
  canAfford(creator: string, estimatedCost: number): { affordable: boolean; reason?: string } {
    const wallet = this.getWallet(creator);

    // Free analyses
    if (wallet.freeAnalysesRemaining > 0) {
      return { affordable: true };
    }

    // Monthly cap check
    this.checkMonthlyReset(wallet);
    if (wallet.monthlySpendingCapUSDT > 0 &&
        (wallet.monthlySpentUSDT + estimatedCost) > wallet.monthlySpendingCapUSDT) {
      return { affordable: false, reason: `Monthly spending cap of $${wallet.monthlySpendingCapUSDT} exceeded` };
    }

    // Balance check
    if (wallet.balanceUSDT < estimatedCost) {
      return { affordable: false, reason: `Insufficient balance: have $${wallet.balanceUSDT}, need $${estimatedCost}` };
    }

    return { affordable: true };
  }

  /**
   * Begin a billing session: hold the amount
   */
  beginSession(
    creator: string,
    tier: BillingTier,
    debateRounds: number = 0,
    arenaModels: number = 0,
  ): { session: BillingSession; isFree: boolean } {
    const wallet = this.getWallet(creator);
    const estimatedCost = this.estimateCost(tier, debateRounds, arenaModels);
    const isFree = wallet.freeAnalysesRemaining > 0;

    const session: BillingSession = {
      sessionId: `BILL-${this.sessionCounter++}-${Date.now()}`,
      creator,
      tier,
      agentCount: TIER_CONFIGS[tier].agentCount,
      debateRounds,
      arenaModels,
      estimatedCostUSDT: estimatedCost,
      status: 'pending',
    };

    if (isFree) {
      // Use free analysis
      wallet.freeAnalysesRemaining--;
      session.status = 'free';
      const tx: WalletTransaction = {
        id: `TXN-${Date.now()}-FREE`,
        type: 'free_use',
        amountUSDT: 0,
        balanceAfter: wallet.balanceUSDT,
        sessionId: session.sessionId,
        timestamp: new Date().toISOString(),
        description: `Free analysis (${wallet.freeAnalysesRemaining} remaining)`,
      };
      wallet.transactions.push(tx);
      this.emit('billing:free', { creator, sessionId: session.sessionId, remainingFree: wallet.freeAnalysesRemaining });
    } else {
      // Hold balance
      wallet.balanceUSDT = Math.round((wallet.balanceUSDT - estimatedCost) * 1000000) / 1000000;
      wallet.monthlySpentUSDT = Math.round((wallet.monthlySpentUSDT + estimatedCost) * 1000000) / 1000000;

      session.status = 'holding';
      session.holdTimestamp = new Date().toISOString();
      session.actualCostUSDT = estimatedCost;

      const tx: WalletTransaction = {
        id: `TXN-${Date.now()}-HOLD`,
        type: 'charge',
        amountUSDT: estimatedCost,
        balanceAfter: wallet.balanceUSDT,
        sessionId: session.sessionId,
        timestamp: new Date().toISOString(),
        description: `Hold for ${tier} analysis (${TIER_CONFIGS[tier].agentCount} agents)`,
      };
      wallet.transactions.push(tx);

      this.emit('billing:hold', { creator, sessionId: session.sessionId, amount: estimatedCost });
    }

    this.sessions.set(session.sessionId, session);
    return { session, isFree };
  }

  /**
   * Settle session: confirm charge
   */
  settleSession(sessionId: string): BillingSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = 'settled';
    session.settleTimestamp = new Date().toISOString();

    this.emit('billing:settled', { creator: session.creator, sessionId, amount: session.actualCostUSDT ?? 0 });
    return session;
  }

  /**
   * Refund session: return held amount
   */
  refundSession(sessionId: string): BillingSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.status !== 'holding') return session;

    const wallet = this.getWallet(session.creator);
    const refundAmount = session.actualCostUSDT ?? session.estimatedCostUSDT;

    wallet.balanceUSDT = Math.round((wallet.balanceUSDT + refundAmount) * 1000000) / 1000000;
    wallet.monthlySpentUSDT = Math.round((wallet.monthlySpentUSDT - refundAmount) * 1000000) / 1000000;

    session.status = 'refunded';
    session.refundTimestamp = new Date().toISOString();

    const tx: WalletTransaction = {
      id: `TXN-${Date.now()}-REFUND`,
      type: 'refund',
      amountUSDT: refundAmount,
      balanceAfter: wallet.balanceUSDT,
      sessionId,
      timestamp: new Date().toISOString(),
      description: `Refund for failed analysis`,
    };
    wallet.transactions.push(tx);

    this.emit('billing:refunded', { creator: session.creator, sessionId, amount: refundAmount });
    return session;
  }

  /**
   * Set monthly spending cap
   */
  setMonthlyCap(creator: string, capUSDT: number): void {
    if (!VALID_MONTHLY_CAPS.includes(capUSDT)) {
      throw new Error(`Invalid monthly cap: ${capUSDT}. Valid: ${VALID_MONTHLY_CAPS.join(', ')}`);
    }
    const wallet = this.getWallet(creator);
    wallet.monthlySpendingCapUSDT = capUSDT;
    this.emit('wallet:cap-updated', { creator, capUSDT });
  }

  /**
   * Check and reset monthly spending
   */
  private checkMonthlyReset(wallet: CreatorWallet): void {
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (wallet.lastResetMonth !== currentMonth) {
      wallet.monthlySpentUSDT = 0;
      wallet.lastResetMonth = currentMonth;
    }
  }

  /**
   * Get billing summary
   */
  getSummary(): BillingSummary {
    const summary: BillingSummary = {
      totalSessions: 0,
      totalRevenueUSDT: 0,
      totalRefundedUSDT: 0,
      totalFreeUses: 0,
      byTier: { standard: { sessions: 0, revenue: 0 }, premium: { sessions: 0, revenue: 0 }, flagship: { sessions: 0, revenue: 0 } },
      byCreator: {},
    };

    for (const session of this.sessions.values()) {
      summary.totalSessions++;
      if (session.status === 'free') {
        summary.totalFreeUses++;
      } else if (session.status === 'refunded') {
        summary.totalRefundedUSDT = Math.round((summary.totalRefundedUSDT + (session.actualCostUSDT ?? 0)) * 1000000) / 1000000;
      } else if (session.status === 'settled' || session.status === 'holding') {
        summary.totalRevenueUSDT = Math.round((summary.totalRevenueUSDT + (session.actualCostUSDT ?? 0)) * 1000000) / 1000000;
      }

      // By tier
      if (session.status !== 'free') {
        summary.byTier[session.tier].sessions++;
        summary.byTier[session.tier].revenue = Math.round((summary.byTier[session.tier].revenue + (session.actualCostUSDT ?? 0)) * 1000000) / 1000000;
      }

      // By creator
      if (!summary.byCreator[session.creator]) {
        summary.byCreator[session.creator] = { sessions: 0, spent: 0 };
      }
      summary.byCreator[session.creator].sessions++;
      summary.byCreator[session.creator].spent = Math.round((summary.byCreator[session.creator].spent + (session.actualCostUSDT ?? 0)) * 1000000) / 1000000;
    }

    return summary;
  }

  /**
   * Get creator billing history
   */
  getCreatorHistory(creator: string): { sessions: BillingSession[]; wallet: CreatorWallet } {
    const sessions = Array.from(this.sessions.values()).filter(s => s.creator === creator);
    const wallet = this.getWallet(creator);
    return { sessions, wallet };
  }

  reset(): void {
    this.sessions.clear();
    this.wallets.clear();
    this.sessionCounter = 1;
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _billingInstance: AIUsageBillingContract | null = null;

export function getBillingContract(): AIUsageBillingContract {
  if (!_billingInstance) _billingInstance = new AIUsageBillingContract();
  return _billingInstance;
}

export function resetBillingContract(): void {
  _billingInstance?.reset();
  _billingInstance = null;
}

export default { AIUsageBillingContract, getBillingContract, resetBillingContract, TIER_CONFIGS };
