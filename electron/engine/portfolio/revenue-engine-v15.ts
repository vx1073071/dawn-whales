/**
 * J-V15-01: Revenue Engine v15 (R53 v15 商业模型定版)
 * USDT 计价 + 创作者分级抽成 (L1/L2/L3)
 *
 * Features:
 * - Creator tier system (L1: 70/30, L2: 80/20, L3: 90/10)
 * - Tier promotion/demotion with criteria
 * - USDT-based pricing (1 USDT ≈ 7.2 ¥ reference)
 * - Revenue calculation for subscriptions, templates, tips
 * - Creator earnings tracking + settlement
 * - Platform revenue aggregation
 *
 * ≥500L, 30+ tests
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type CreatorTier = 'L1' | 'L2' | 'L3';
export type RevenueType = 'subscription' | 'template' | 'tip' | 'p2p_transfer' | 'withdrawal' | 'auto_trade_taker' | 'auto_trade_maker';
export type Currency = 'USDT';
export type SettlementStatus = 'pending' | 'settled' | 'paid' | 'disputed';

export interface CreatorTierConfig {
  tier: CreatorTier;
  creatorPercent: number;
  platformPercent: number;
  promotionCriteria: {
    minSubscribers?: number;
    minCumulativeEarnings?: number; // USDT
  };
  label: string;
}

export interface CreatorProfile {
  creatorId: string;
  creatorName: string;
  tier: CreatorTier;
  totalSubscribers: number;
  cumulativeEarningsUSDT: number;
  joinedAt: string;
  updatedAt: string;
}

export interface RevenueTransaction {
  id: string;
  type: RevenueType;
  creatorId?: string;
  userId: string;
  amountUSDT: number;
  creatorAmount?: number;
  platformAmount?: number;
  feeAmount?: number;
  description: string;
  status: SettlementStatus;
  createdAt: string;
  settledAt?: string;
}

export interface PlatformRevenueSummary {
  totalRevenueUSDT: number;
  creatorPayoutsUSDT: number;
  netPlatformRevenueUSDT: number;
  transactionCount: number;
  byType: Record<RevenueType, { count: number; platformRevenue: number; creatorRevenue: number }>;
  byTier: Record<CreatorTier, { count: number; platformRevenue: number; creatorRevenue: number }>;
}

export interface CreatorEarningsReport {
  creatorId: string;
  tier: CreatorTier;
  grossEarnings: number;
  platformFee: number;
  netEarnings: number;
  transactionCount: number;
  byType: Record<string, { count: number; gross: number; net: number }>;
  pendingPayout: number;
}

// ── Tier Configuration (v15 LOCKED) ───────────────────────────────────────

const TIER_CONFIGS: Record<CreatorTier, CreatorTierConfig> = {
  L1: {
    tier: 'L1',
    creatorPercent: 70,
    platformPercent: 30,
    promotionCriteria: {},
    label: 'Newcomer',
  },
  L2: {
    tier: 'L2',
    creatorPercent: 80,
    platformPercent: 20,
    promotionCriteria: {
      minSubscribers: 100,
      minCumulativeEarnings: 1000,
    },
    label: 'Intermediate',
  },
  L3: {
    tier: 'L3',
    creatorPercent: 90,
    platformPercent: 10,
    promotionCriteria: {
      minSubscribers: 1000,
      minCumulativeEarnings: 10000,
    },
    label: 'Top Creator',
  },
};

// USDT ↔ CNY reference rate (for display only, all calculations in USDT)
const USDT_CNY_RATE = 7.2;

// ── Revenue Engine ─────────────────────────────────────────────────────────

export class RevenueEngineV15 extends EventEmitter {
  private creators: Map<string, CreatorProfile> = new Map();
  private transactions: Map<string, RevenueTransaction> = new Map();
  private idCounter = 1;

  constructor() {
    super();
    log.info('[RevenueEngineV15] Initialized (v15 commercial model LOCKED)');
  }

  // ── Creator Management ─────────────────────────────────────────────────

  registerCreator(creatorId: string, creatorName: string): CreatorProfile {
    if (this.creators.has(creatorId)) {
      return this.creators.get(creatorId)!;
    }

    const now = new Date().toISOString();
    const profile: CreatorProfile = {
      creatorId,
      creatorName,
      tier: 'L1',
      totalSubscribers: 0,
      cumulativeEarningsUSDT: 0,
      joinedAt: now,
      updatedAt: now,
    };

    this.creators.set(creatorId, profile);
    this.emit('creator:registered', profile);
    log.info(`[RevenueEngineV15] Creator registered: ${creatorName} (${creatorId}, L1)`);
    return profile;
  }

  getCreator(creatorId: string): CreatorProfile | null {
    return this.creators.get(creatorId) || null;
  }

  updateCreatorStats(creatorId: string, subscribers?: number, earnings?: number): boolean {
    const creator = this.creators.get(creatorId);
    if (!creator) return false;

    if (subscribers !== undefined) creator.totalSubscribers = subscribers;
    if (earnings !== undefined) creator.cumulativeEarningsUSDT = earnings;
    creator.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Tier Promotion ─────────────────────────────────────────────────────

  checkAndPromote(creatorId: string): { promoted: boolean; from?: CreatorTier; to?: CreatorTier } {
    const creator = this.creators.get(creatorId);
    if (!creator) return { promoted: false };

    const currentTier = creator.tier;
    let targetTier: CreatorTier = currentTier;

    // Check L3 first (highest priority)
    const l3Config = TIER_CONFIGS.L3;
    if (
      creator.totalSubscribers >= (l3Config.promotionCriteria.minSubscribers || 0) ||
      creator.cumulativeEarningsUSDT >= (l3Config.promotionCriteria.minCumulativeEarnings || 0)
    ) {
      targetTier = 'L3';
    } else {
      // Check L2
      const l2Config = TIER_CONFIGS.L2;
      if (
        creator.totalSubscribers >= (l2Config.promotionCriteria.minSubscribers || 0) ||
        creator.cumulativeEarningsUSDT >= (l2Config.promotionCriteria.minCumulativeEarnings || 0)
      ) {
        targetTier = 'L2';
      }
    }

    if (targetTier !== currentTier) {
      const from = currentTier;
      creator.tier = targetTier;
      creator.updatedAt = new Date().toISOString();
      this.emit('creator:promoted', { creatorId, from, to: targetTier });
      log.info(`[RevenueEngineV15] Creator ${creatorId} promoted: ${from} → ${targetTier}`);
      return { promoted: true, from, to: targetTier };
    }

    return { promoted: false };
  }

  getTierConfig(tier: CreatorTier): CreatorTierConfig {
    return { ...TIER_CONFIGS[tier] };
  }

  getAllTierConfigs(): Record<CreatorTier, CreatorTierConfig> {
    return { ...TIER_CONFIGS };
  }

  // ── Revenue Calculation ────────────────────────────────────────────────

  /**
   * Calculate revenue split for a creator transaction
   */
  calculateSplit(creatorId: string, amountUSDT: number, type: RevenueType): { creatorAmount: number; platformAmount: number; tier: CreatorTier } {
    // For platform-only revenue (P2P, withdrawal, auto-trade), no split
    if (type === 'p2p_transfer' || type === 'withdrawal' || type === 'auto_trade_taker' || type === 'auto_trade_maker') {
      return { creatorAmount: 0, platformAmount: amountUSDT, tier: 'L1' };
    }

    const creator = this.creators.get(creatorId);
    const tier = creator?.tier || 'L1';
    const config = TIER_CONFIGS[tier];

    const creatorAmount = Math.round(amountUSDT * config.creatorPercent) / 100;
    const platformAmount = Math.round(amountUSDT * 100 - creatorAmount * 100) / 100;

    return { creatorAmount, platformAmount, tier };
  }

  /**
   * Record a revenue transaction
   */
  recordTransaction(params: {
    type: RevenueType;
    creatorId?: string;
    userId: string;
    amountUSDT: number;
    description?: string;
  }): RevenueTransaction {
    const { type, creatorId, userId, amountUSDT, description } = params;

    let creatorAmount = 0;
    let platformAmount = amountUSDT;
    let tier: CreatorTier = 'L1';

    if (creatorId && (type === 'subscription' || type === 'template' || type === 'tip')) {
      const split = this.calculateSplit(creatorId, amountUSDT, type);
      creatorAmount = split.creatorAmount;
      platformAmount = split.platformAmount;
      tier = split.tier;
    }

    const now = new Date().toISOString();
    const tx: RevenueTransaction = {
      id: `rev_${this.idCounter++}`,
      type,
      creatorId,
      userId,
      amountUSDT,
      creatorAmount: creatorAmount || undefined,
      platformAmount,
      feeAmount: type === 'p2p_transfer' ? amountUSDT * 0.006 : type === 'withdrawal' ? amountUSDT * 0.001 : undefined,
      description: description || `${type} transaction`,
      status: 'pending',
      createdAt: now,
    };

    this.transactions.set(tx.id, tx);

    // Update creator earnings
    if (creatorId && creatorAmount > 0) {
      const creator = this.creators.get(creatorId);
      if (creator) {
        creator.cumulativeEarningsUSDT = Math.round((creator.cumulativeEarningsUSDT + creatorAmount) * 100) / 100;
        creator.updatedAt = now;
        // Auto-check promotion
        this.checkAndPromote(creatorId);
      }
    }

    this.emit('transaction:recorded', tx);
    log.info(`[RevenueEngineV15] Transaction ${tx.id}: ${type} $${amountUSDT} USDT (creator: $${creatorAmount}, platform: $${platformAmount})`);
    return tx;
  }

  // ── Settlement ─────────────────────────────────────────────────────────

  settleTransaction(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== 'pending') return false;
    tx.status = 'settled';
    tx.settledAt = new Date().toISOString();
    this.emit('transaction:settled', tx);
    return true;
  }

  batchSettle(txIds?: string[]): number {
    const ids = txIds || Array.from(this.transactions.keys()).filter(id => this.transactions.get(id)!.status === 'pending');
    let count = 0;
    for (const id of ids) {
      if (this.settleTransaction(id)) count++;
    }
    return count;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getTransactions(filter?: { type?: RevenueType; creatorId?: string; userId?: string; status?: SettlementStatus }): RevenueTransaction[] {
    let txs = Array.from(this.transactions.values());
    if (filter?.type) txs = txs.filter(t => t.type === filter.type);
    if (filter?.creatorId) txs = txs.filter(t => t.creatorId === filter.creatorId);
    if (filter?.userId) txs = txs.filter(t => t.userId === filter.userId);
    if (filter?.status) txs = txs.filter(t => t.status === filter.status);
    return txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPlatformRevenueSummary(): PlatformRevenueSummary {
    const txs = Array.from(this.transactions.values());
    let totalRevenue = 0;
    let creatorPayouts = 0;

    const byType: Record<string, { count: number; platformRevenue: number; creatorRevenue: number }> = {};
    const byTier: Record<string, { count: number; platformRevenue: number; creatorRevenue: number }> = {};

    for (const tx of txs) {
      totalRevenue += tx.platformAmount || 0;
      creatorPayouts += tx.creatorAmount || 0;

      if (!byType[tx.type]) byType[tx.type] = { count: 0, platformRevenue: 0, creatorRevenue: 0 };
      byType[tx.type].count++;
      byType[tx.type].platformRevenue += tx.platformAmount || 0;
      byType[tx.type].creatorRevenue += tx.creatorAmount || 0;

      if (tx.creatorId) {
        const creator = this.creators.get(tx.creatorId);
        const tier = creator?.tier || 'L1';
        if (!byTier[tier]) byTier[tier] = { count: 0, platformRevenue: 0, creatorRevenue: 0 };
        byTier[tier].count++;
        byTier[tier].platformRevenue += tx.platformAmount || 0;
        byTier[tier].creatorRevenue += tx.creatorAmount || 0;
      }
    }

    return {
      totalRevenueUSDT: Math.round(totalRevenue * 100) / 100,
      creatorPayoutsUSDT: Math.round(creatorPayouts * 100) / 100,
      netPlatformRevenueUSDT: Math.round(totalRevenue * 100) / 100,
      transactionCount: txs.length,
      byType: byType as Record<RevenueType, { count: number; platformRevenue: number; creatorRevenue: number }>,
      byTier: byTier as Record<CreatorTier, { count: number; platformRevenue: number; creatorRevenue: number }>,
    };
  }

  getCreatorEarningsReport(creatorId: string): CreatorEarningsReport | null {
    const creator = this.creators.get(creatorId);
    if (!creator) return null;

    const txs = this.getTransactions({ creatorId });
    let grossEarnings = 0;
    let platformFee = 0;
    let pendingPayout = 0;
    const byType: Record<string, { count: number; gross: number; net: number }> = {};

    for (const tx of txs) {
      grossEarnings += tx.amountUSDT;
      platformFee += tx.platformAmount || 0;
      if (tx.status === 'pending') pendingPayout += tx.creatorAmount || 0;

      if (!byType[tx.type]) byType[tx.type] = { count: 0, gross: 0, net: 0 };
      byType[tx.type].count++;
      byType[tx.type].gross += tx.amountUSDT;
      byType[tx.type].net += tx.creatorAmount || 0;
    }

    return {
      creatorId,
      tier: creator.tier,
      grossEarnings: Math.round(grossEarnings * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      netEarnings: creator.cumulativeEarningsUSDT,
      transactionCount: txs.length,
      byType,
      pendingPayout: Math.round(pendingPayout * 100) / 100,
    };
  }

  // ── USDT ↔ CNY Conversion ─────────────────────────────────────────────

  static usdtToCny(usdt: number): number {
    return Math.round(usdt * USDT_CNY_RATE * 100) / 100;
  }

  static cnyToUsdt(cny: number): number {
    return Math.round((cny / USDT_CNY_RATE) * 100) / 100;
  }

  getUsdtCnyRate(): number {
    return USDT_CNY_RATE;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.creators.clear();
    this.transactions.clear();
    this.idCounter = 1;
    log.info('[RevenueEngineV15] Reset');
  }

  get creatorCount(): number {
    return this.creators.size;
  }

  get transactionCount(): number {
    return this.transactions.size;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: RevenueEngineV15 | null = null;

export function getRevenueEngineV15(): RevenueEngineV15 {
  if (!_instance) _instance = new RevenueEngineV15();
  return _instance;
}

export function resetRevenueEngineV15(): void {
  _instance?.reset();
  _instance = null;
}

export default RevenueEngineV15;
