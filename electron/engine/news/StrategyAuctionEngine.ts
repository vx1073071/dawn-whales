/**
 * P2-06 StrategyAuctionEngine — Strategy Auction/Bidding Engine
 * R248 — Strategy Deepening
 * JVS / 引擎虾
 *
 * Auction marketplace for premium strategies: creators list strategies
 * with minimum bid, buyers bid over auction period. Supports blind
 * auctions, reserve prices, auto-bidding, and bid history.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type AuctionType = 'english' | 'blind' | 'dutch';
export type AuctionStatus = 'pending' | 'active' | 'ended' | 'cancelled' | 'settled';

export interface AuctionItem {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  /** What's being auctioned */
  contentType: 'strategy' | 'indicator' | 'template' | 'data_feed' | 'consulting';
  /** Reference to the actual content */
  contentId?: string;
  /** Strategy details if content is strategy */
  strategyDetails?: {
    market: string;
    timeframe: string;
    expectedReturn?: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  /** Auction type */
  auctionType: AuctionType;
  /** Starting bid (minimum) */
  startingBid: number;
  /** Reserve price (must be met or no sale) */
  reservePrice?: number;
  /** Buy-it-now price (optional, ends auction immediately) */
  buyItNowPrice?: number;
  /** Auction period */
  startTime: number;
  endTime: number;
  /** Current status */
  status: AuctionStatus;
  /** Current highest bid */
  highestBid: number;
  /** Current highest bidder */
  highestBidderId?: string;
  /** Number of bids */
  bidCount: number;
  /** All bids (for blind auction, only visible after end) */
  bids: AuctionBid[];
  /** Winner (set after settlement) */
  winnerId?: string;
  /** Final price */
  finalPrice?: number;
  /** Commission rate */
  commissionRate: number;
  /** Creator revenue after commission */
  creatorRevenue?: number;
  /** Whether watchers get notified */
  notifyWatchers: boolean;
  /** Tags for search */
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AuctionBid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  /** For blind auction: max bid for auto-increment */
  maxBid?: number;
  timestamp: number;
  /** Whether this is an auto-bid */
  autoBid: boolean;
}

export interface AutoBidRule {
  id: string;
  userId: string;
  auctionId: string;
  maxAmount: number;
  incrementBy: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AuctionSearchParams {
  keywords?: string;
  contentType?: AuctionItem['contentType'];
  auctionType?: AuctionType;
  status?: AuctionStatus;
  minBid?: number;
  maxBid?: number;
  tags?: string[];
  sortBy?: 'ending_soon' | 'newest' | 'highest_bid' | 'most_bids';
  limit?: number;
  offset?: number;
}

export interface AuctionStats {
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalBidVolume: number; // Total USDT bid
  totalSettled: number; // Settled revenue
  avgFinalPrice: number;
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class StrategyAuctionEngine {
  private static instance: StrategyAuctionEngine;

  private auctions: Map<string, AuctionItem> = new Map();
  private autoBidRules: Map<string, AutoBidRule[]> = new Map(); // userId → rules
  /** watchers: auctionId → userId[] */
  private watchers: Map<string, Set<string>> = new Map();
  private idCounter = 0;

  private constructor() {}

  static getInstance(): StrategyAuctionEngine {
    if (!StrategyAuctionEngine.instance) {
      StrategyAuctionEngine.instance = new StrategyAuctionEngine();
    }
    return StrategyAuctionEngine.instance;
  }

  reset(): void {
    this.auctions.clear();
    this.autoBidRules.clear();
    this.watchers.clear();
    this.idCounter = 0;
  }

  private nextId(prefix: string): string {
    return `${prefix}-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Auction Lifecycle
  // ═══════════════════════════════════════════════════════════════

  createAuction(params: {
    creatorId: string;
    creatorName: string;
    title: string;
    description: string;
    contentType: AuctionItem['contentType'];
    contentId?: string;
    strategyDetails?: AuctionItem['strategyDetails'];
    auctionType?: AuctionType;
    startingBid: number;
    reservePrice?: number;
    buyItNowPrice?: number;
    startTime?: number;
    endTime: number;
    commissionRate?: number;
    tags?: string[];
  }): AuctionItem {
    const now = Date.now();

    const auction: AuctionItem = {
      id: this.nextId('auc'),
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      title: params.title,
      description: params.description,
      contentType: params.contentType,
      contentId: params.contentId,
      strategyDetails: params.strategyDetails,
      auctionType: params.auctionType || 'english',
      startingBid: params.startingBid,
      reservePrice: params.reservePrice,
      buyItNowPrice: params.buyItNowPrice,
      startTime: params.startTime || now,
      endTime: params.endTime,
      status: params.startTime && params.startTime > now ? 'pending' : 'active',
      highestBid: params.startingBid,
      bidCount: 0,
      bids: [],
      commissionRate: params.commissionRate || 0.15,
      notifyWatchers: true,
      tags: params.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.auctions.set(auction.id, auction);
    log.info(`[Auction] Created auction ${auction.id}: ${auction.title}`);
    return auction;
  }

  startAuction(auctionId: string): boolean {
    const auction = this.auctions.get(auctionId);
    if (!auction || auction.status !== 'pending') return false;
    auction.status = 'active';
    auction.startTime = Date.now();
    auction.updatedAt = Date.now();
    return true;
  }

  cancelAuction(auctionId: string, reason?: string): boolean {
    const auction = this.auctions.get(auctionId);
    if (!auction || (auction.status !== 'pending' && auction.status !== 'active')) return false;
    auction.status = 'cancelled';
    auction.updatedAt = Date.now();
    log.info(`[Auction] Cancelled auction ${auctionId}: ${reason || 'no reason'}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Bidding
  // ═══════════════════════════════════════════════════════════════

  placeBid(params: {
    auctionId: string;
    bidderId: string;
    bidderName: string;
    amount: number;
    maxBid?: number;
  }): { bid: AuctionBid; won: boolean } | null {
    const auction = this.auctions.get(params.auctionId);
    if (!auction) return null;
    if (auction.status !== 'active') return null;
    if (Date.now() > auction.endTime) {
      this.endAuction(params.auctionId);
      return null;
    }

    // Check buy-it-now
    if (auction.buyItNowPrice && params.amount >= auction.buyItNowPrice) {
      params.amount = auction.buyItNowPrice;
    }

    // Validate minimum bid increment
    if (auction.auctionType !== 'blind' && params.amount <= auction.highestBid && !auction.buyItNowPrice) {
      return null; // Must bid higher than current
    }

    const bid: AuctionBid = {
      id: this.nextId('bid'),
      auctionId: params.auctionId,
      bidderId: params.bidderId,
      bidderName: params.bidderName,
      amount: params.amount,
      maxBid: params.maxBid,
      timestamp: Date.now(),
      autoBid: false,
    };

    auction.bids.push(bid);
    auction.bidCount++;
    auction.highestBid = params.amount;
    auction.highestBidderId = params.bidderId;
    auction.updatedAt = Date.now();

    let won = false;

    // Check buy-it-now
    if (auction.buyItNowPrice && params.amount >= auction.buyItNowPrice) {
      won = true;
      auction.winnerId = params.bidderId;
      auction.finalPrice = auction.buyItNowPrice;
      this.settleAuction(params.auctionId);
    }

    // Process auto-bid for other bidders
    if (!won) {
      this.processAutoBids(params.auctionId, params.bidderId);
    }

    log.info(`[Auction] Bid placed: ${bid.amount} USDT by ${params.bidderName} on ${params.auctionId}`);
    return { bid, won };
  }

  // ═══════════════════════════════════════════════════════════════
  // Auto-bidding
  // ═══════════════════════════════════════════════════════════════

  setAutoBid(params: {
    userId: string;
    auctionId: string;
    maxAmount: number;
    incrementBy?: number;
  }): AutoBidRule {
    const rule: AutoBidRule = {
      id: this.nextId('ab'),
      userId: params.userId,
      auctionId: params.auctionId,
      maxAmount: params.maxAmount,
      incrementBy: params.incrementBy || 1,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!this.autoBidRules.has(params.userId)) {
      this.autoBidRules.set(params.userId, []);
    }
    this.autoBidRules.get(params.userId)!.push(rule);

    return rule;
  }

  getAutoBidRules(userId: string): AutoBidRule[] {
    return this.autoBidRules.get(userId) || [];
  }

  disableAutoBid(ruleId: string): boolean {
    for (const [, rules] of this.autoBidRules) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        rule.enabled = false;
        rule.updatedAt = Date.now();
        return true;
      }
    }
    return false;
  }

  private processAutoBids(auctionId: string, excludeUserId: string): void {
    for (const [, rules] of this.autoBidRules) {
      for (const rule of rules) {
        if (!rule.enabled || rule.auctionId !== auctionId || rule.userId === excludeUserId) continue;

        const auction = this.auctions.get(auctionId);
        if (!auction || auction.status !== 'active') continue;

        const newBid = auction.highestBid + rule.incrementBy;
        if (newBid <= rule.maxAmount && newBid > auction.highestBid) {
          const bid: AuctionBid = {
            id: this.nextId('bid'),
            auctionId,
            bidderId: rule.userId,
            bidderName: `auto-${rule.userId}`,
            amount: newBid,
            maxBid: rule.maxAmount,
            timestamp: Date.now(),
            autoBid: true,
          };

          auction.bids.push(bid);
          auction.bidCount++;
          auction.highestBid = newBid;
          auction.highestBidderId = rule.userId;
          auction.updatedAt = Date.now();

          if (auction.buyItNowPrice && newBid >= auction.buyItNowPrice) {
            auction.winnerId = rule.userId;
            auction.finalPrice = auction.buyItNowPrice;
            this.settleAuction(auctionId);
            return;
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Auction End & Settlement
  // ═══════════════════════════════════════════════════════════════

  endAuction(auctionId: string): AuctionItem | null {
    const auction = this.auctions.get(auctionId);
    if (!auction || auction.status !== 'active') return null;

    auction.status = 'ended';
    auction.updatedAt = Date.now();

    // Check if reserve price met
    if (auction.reservePrice && auction.highestBid < auction.reservePrice) {
      // Reserve not met — no winner
      auction.winnerId = undefined;
      auction.finalPrice = undefined;
    } else if (auction.highestBidderId) {
      auction.winnerId = auction.highestBidderId;
      auction.finalPrice = auction.highestBid;
    }

    log.info(`[Auction] Ended auction ${auctionId}: winner=${auction.winnerId || 'none'}, price=${auction.finalPrice || 'N/A'}`);
    return auction;
  }

  settleAuction(auctionId: string): AuctionItem | null {
    const auction = this.auctions.get(auctionId);
    if (!auction) return null;
    if (auction.status !== 'ended' && auction.status !== 'active') return null;
    if (!auction.winnerId) return null;

    // If still active, end first
    if (auction.status === 'active') {
      auction.status = 'ended';
    }

    auction.status = 'settled';
    auction.finalPrice = auction.finalPrice || auction.highestBid;
    const commission = auction.finalPrice * auction.commissionRate;
    auction.creatorRevenue = auction.finalPrice - commission;
    auction.updatedAt = Date.now();

    log.info(`[Auction] Settled auction ${auctionId}: ${auction.finalPrice} USDT, creator gets ${auction.creatorRevenue}`);
    return auction;
  }

  // ═══════════════════════════════════════════════════════════════
  // Watchers
  // ═══════════════════════════════════════════════════════════════

  watchAuction(auctionId: string, userId: string): boolean {
    const auction = this.auctions.get(auctionId);
    if (!auction) return false;

    if (!this.watchers.has(auctionId)) {
      this.watchers.set(auctionId, new Set());
    }
    this.watchers.get(auctionId)!.add(userId);
    return true;
  }

  unwatchAuction(auctionId: string, userId: string): boolean {
    return this.watchers.get(auctionId)?.delete(userId) || false;
  }

  getWatchers(auctionId: string): string[] {
    return Array.from(this.watchers.get(auctionId) || []);
  }

  getWatchedAuctions(userId: string): AuctionItem[] {
    const result: AuctionItem[] = [];
    for (const [auctionId, users] of this.watchers) {
      if (users.has(userId)) {
        const auction = this.auctions.get(auctionId);
        if (auction) result.push(auction);
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getAuction(id: string): AuctionItem | undefined {
    return this.auctions.get(id);
  }

  searchAuctions(params: AuctionSearchParams): { auctions: AuctionItem[]; total: number } {
    let results = Array.from(this.auctions.values());

    if (params.status) {
      results = results.filter(a => a.status === params.status);
    }

    if (params.keywords) {
      const kw = params.keywords.toLowerCase();
      results = results.filter(a =>
        a.title.toLowerCase().includes(kw) ||
        a.description.toLowerCase().includes(kw) ||
        a.tags.some(t => t.toLowerCase().includes(kw)),
      );
    }

    if (params.contentType) {
      results = results.filter(a => a.contentType === params.contentType);
    }

    if (params.auctionType) {
      results = results.filter(a => a.auctionType === params.auctionType);
    }

    if (params.minBid !== undefined) {
      results = results.filter(a => a.highestBid >= params.minBid!);
    }

    if (params.maxBid !== undefined) {
      results = results.filter(a => a.highestBid <= params.maxBid!);
    }

    if (params.tags && params.tags.length > 0) {
      results = results.filter(a => params.tags!.some(t => a.tags.includes(t)));
    }

    switch (params.sortBy) {
      case 'ending_soon': results.sort((a, b) => a.endTime - b.endTime); break;
      case 'newest': results.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'highest_bid': results.sort((a, b) => b.highestBid - a.highestBid); break;
      case 'most_bids': results.sort((a, b) => b.bidCount - a.bidCount); break;
      default: results.sort((a, b) => b.createdAt - a.createdAt);
    }

    const total = results.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    results = results.slice(offset, offset + limit);

    return { auctions: results, total };
  }

  getActiveAuctions(): AuctionItem[] {
    return Array.from(this.auctions.values()).filter(a => a.status === 'active');
  }

  getCreatorAuctions(creatorId: string): AuctionItem[] {
    return Array.from(this.auctions.values()).filter(a => a.creatorId === creatorId);
  }

  getBidderHistory(bidderId: string): AuctionBid[] {
    const bids: AuctionBid[] = [];
    for (const [, auction] of this.auctions) {
      bids.push(...auction.bids.filter(b => b.bidderId === bidderId));
    }
    return bids.sort((a, b) => b.timestamp - a.timestamp);
  }

  getBids(auctionId: string): AuctionBid[] {
    const auction = this.auctions.get(auctionId);
    return auction ? [...auction.bids].sort((a, b) => b.timestamp - a.timestamp) : [];
  }

  // ═══════════════════════════════════════════════════════════════
  // Expiry Check
  // ═══════════════════════════════════════════════════════════════

  checkExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [, auction] of this.auctions) {
      if (auction.status === 'active' && now > auction.endTime) {
        this.endAuction(auction.id);
        count++;
      }
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════

  getStats(): AuctionStats {
    const auctions = Array.from(this.auctions.values());
    const active = auctions.filter(a => a.status === 'active');
    const completed = auctions.filter(a => a.status === 'settled' || a.status === 'ended');

    let totalBidVolume = 0;
    let totalSettled = 0;
    let settledCount = 0;

    for (const a of auctions) {
      totalBidVolume += a.bids.reduce((s, b) => s + b.amount, 0);
    }

    for (const a of completed) {
      if (a.status === 'settled' && a.finalPrice) {
        totalSettled += a.finalPrice;
        settledCount++;
      }
    }

    return {
      totalAuctions: auctions.length,
      activeAuctions: active.length,
      completedAuctions: completed.length,
      totalBidVolume,
      totalSettled,
      avgFinalPrice: settledCount > 0 ? Math.round(totalSettled / settledCount * 100) / 100 : 0,
    };
  }
}
