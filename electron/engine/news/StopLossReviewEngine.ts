/**
 * P2-14 StopLossReviewEngine — Stop-Loss & Take-Profit Review Engine
 * R249 — P1 Closure Round
 * JVS / 引擎虾
 *
 * Post-trade review engine that analyzes stop-loss and take-profit
 * events. Evaluates whether exits were optimal, detects patterns
 * (stopped out too early, missed profit), computes slippage, and
 * suggests improved stop/target levels. Singleton, testable.
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type StopType = 'stop_loss' | 'take_profit' | 'trailing_stop' | 'manual_exit' | 'time_stop';
export type ExitResult = 'premature' | 'optimal' | 'late' | 'missed_opportunity' | 'not_applicable';

export interface TradeRecord {
  id: string;
  symbol: string;
  market: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  direction: 'long' | 'short';
  entryTime: number;
  exitTime: number;
  /** Set stop-loss level */
  stopLoss?: number;
  /** Set take-profit level */
  takeProfit?: number;
  /** What triggered the exit */
  exitTrigger: StopType;
  /** Actual pnl */
  pnl: number;
  /** pnl percentage */
  pnlPct: number;
}

export interface StopReview {
  id: string;
  tradeId: string;
  symbol: string;
  /** Original stop levels */
  originalStop: number;
  originalTarget: number;
  /** Actual exit */
  actualExit: number;
  /** What the price did after exit */
  priceAfterExit: number;
  /** Max favorable excursion after exit */
  maxFavorableAfter: number;
  /** Max adverse excursion after exit */
  maxAdverseAfter: number;
  /** Evaluation */
  exitResult: ExitResult;
  /** Potential pnl if held to target */
  potentialPnl: number;
  /** Slippage from stop */
  slippage: number;
  /** Suggested better stop level */
  suggestedStop?: number;
  /** Suggested better target level */
  suggestedTarget?: number;
  /** Root cause identified */
  rootCause: string;
  /** Improvement score 0-100 (100 = nothing to improve) */
  improvementScore: number;
  /** Tags for pattern detection */
  tags: string[];
  reviewedAt: number;
}

export interface StopPattern {
  id: string;
  patternType: 'too_tight_stop' | 'too_wide_target' | 'no_stop_used' | 'emotional_exit' | 'gap_whiplash' | 'recurring_symbol';
  symbol?: string;
  count: number;
  totalPnlLost: number;
  examples: string[]; // trade IDs
  suggestion: string;
  confidence: number; // 0-1
}

export interface ReviewStats {
  totalTrades: number;
  reviews: number;
  byResult: Record<ExitResult, number>;
  avgImprovementScore: number;
  totalPnlLost: number;
  patterns: StopPattern[];
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class StopLossReviewEngine {
  private static instance: StopLossReviewEngine;

  private trades: Map<string, TradeRecord> = new Map();
  private reviews: Map<string, StopReview> = new Map();
  private reviewsBySymbol: Map<string, StopReview[]> = new Map();
  private idCounter = 0;

  private constructor() {}

  static getInstance(): StopLossReviewEngine {
    if (!StopLossReviewEngine.instance) {
      StopLossReviewEngine.instance = new StopLossReviewEngine();
    }
    return StopLossReviewEngine.instance;
  }

  reset(): void {
    this.trades.clear();
    this.reviews.clear();
    this.reviewsBySymbol.clear();
    this.idCounter = 0;
  }

  private nextId(prefix: string): string {
    return `${prefix}-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Trade Recording
  // ═══════════════════════════════════════════════════════════════

  recordTrade(params: {
    symbol: string;
    market: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    direction: 'long' | 'short';
    entryTime: number;
    exitTime: number;
    stopLoss?: number;
    takeProfit?: number;
    exitTrigger: StopType;
  }): TradeRecord {
    const pnl = params.direction === 'long'
      ? (params.exitPrice - params.entryPrice) * params.quantity
      : (params.entryPrice - params.exitPrice) * params.quantity;
    const pnlPct = Math.round(pnl / (params.entryPrice * params.quantity) * 100 * 100) / 100;

    const trade: TradeRecord = {
      id: this.nextId('trd'),
      symbol: params.symbol.toUpperCase(),
      market: params.market,
      entryPrice: params.entryPrice,
      exitPrice: params.exitPrice,
      quantity: params.quantity,
      direction: params.direction,
      entryTime: params.entryTime,
      exitTime: params.exitTime,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      exitTrigger: params.exitTrigger,
      pnl,
      pnlPct,
    };

    this.trades.set(trade.id, trade);
    return trade;
  }

  // ═══════════════════════════════════════════════════════════════
  // Review
  // ═══════════════════════════════════════════════════════════════

  reviewTrade(params: {
    tradeId: string;
    priceAfterExit: number;
    maxFavorableAfter?: number;
    maxAdverseAfter?: number;
  }): StopReview | null {
    const trade = this.trades.get(params.tradeId);
    if (!trade) return null;

    const now = Date.now();
    const priceAfter = params.priceAfterExit;
    const maxFavAfter = params.maxFavorableAfter ?? priceAfter;
    const maxAdvAfter = params.maxAdverseAfter ?? priceAfter;

    // Determine exit result
    let exitResult: ExitResult = 'optimal';
    const tags: string[] = [];
    const rootCauses: string[] = [];

    const directionMultiplier = trade.direction === 'long' ? 1 : -1;
    const moveAfterExit = (priceAfter - trade.exitPrice) * directionMultiplier;
    const pctAfter = (moveAfterExit / trade.exitPrice) * 100;

    if (trade.exitTrigger === 'stop_loss') {
      // Check if price recovered significantly after stop-out
      if (pctAfter > 1.5) {
        exitResult = 'premature';
        rootCauses.push('Stop-loss level set too tight');
        tags.push('too_tight_stop', 'price_recovered');
      } else if (pctAfter < -1.0) {
        exitResult = 'optimal';
        tags.push('stop_saved_losses');
      } else {
        exitResult = 'optimal';
      }
    } else if (trade.exitTrigger === 'take_profit') {
      const maxPct = (maxFavAfter - trade.exitPrice) * directionMultiplier / trade.exitPrice * 100;
      if (maxPct > 3) {
        exitResult = 'missed_opportunity';
        rootCauses.push('Take-profit set too conservative');
        tags.push('too_wide_target', 'left_money_on_table');
      } else if (pctAfter < -1.0) {
        exitResult = 'optimal';
        tags.push('target_was_right');
      } else {
        exitResult = 'optimal';
      }
    } else if (trade.exitTrigger === 'manual_exit') {
      if (pctAfter > 2) {
        exitResult = 'late';
        rootCauses.push('Manual exit delayed — consider setting hard stop');
        tags.push('emotional_exit', 'no_hard_stop');
      } else {
        exitResult = 'not_applicable';
      }
    }

    // Compute slippage
    const slippage = trade.stopLoss
      ? Math.abs(trade.exitPrice - trade.stopLoss) / trade.stopLoss * 100
      : 0;

    // Potential pnl if held to target
    const potentialPnl = trade.takeProfit
      ? (trade.takeProfit - trade.entryPrice) * directionMultiplier * trade.quantity
      : undefined;

    // Improvement suggestions
    let suggestedStop: number | undefined;
    let suggestedTarget: number | undefined;

    if (exitResult === 'premature' && trade.stopLoss) {
      // Suggest wider stop: 1.5x ATR wider (simplified: 50% wider)
      const currentWidth = Math.abs(trade.entryPrice - trade.stopLoss);
      suggestedStop = Math.round((trade.entryPrice - currentWidth * 1.5 * directionMultiplier) * 100) / 100;
    }
    if (exitResult === 'missed_opportunity' && trade.takeProfit) {
      const targetWidth = Math.abs(trade.takeProfit - trade.entryPrice);
      suggestedTarget = Math.round((trade.entryPrice + targetWidth * 1.5 * directionMultiplier) * 100) / 100;
    }

    // Improvement score
    let improvementScore = 100;
    if (exitResult === 'premature') {
      improvementScore = 25; // Needs significant improvement
    } else if (exitResult === 'missed_opportunity') {
      improvementScore = 30;
    } else if (exitResult === 'late') {
      improvementScore = 35;
    } else if (slippage > 2) {
      improvementScore = 60;
    }

    const review: StopReview = {
      id: this.nextId('rvw'),
      tradeId: trade.id,
      symbol: trade.symbol,
      originalStop: trade.stopLoss || trade.entryPrice,
      originalTarget: trade.takeProfit || trade.exitPrice,
      actualExit: trade.exitPrice,
      priceAfterExit: priceAfter,
      maxFavorableAfter: maxFavAfter,
      maxAdverseAfter: maxAdvAfter,
      exitResult,
      potentialPnl: potentialPnl ?? 0,
      slippage: Math.round(slippage * 100) / 100,
      suggestedStop,
      suggestedTarget,
      rootCause: rootCauses.join('; ') || 'N/A',
      improvementScore,
      tags,
      reviewedAt: now,
    };

    this.reviews.set(review.id, review);

    const symbol = trade.symbol;
    if (!this.reviewsBySymbol.has(symbol)) {
      this.reviewsBySymbol.set(symbol, []);
    }
    this.reviewsBySymbol.get(symbol)!.push(review);

    log.info(`[StopReview] Reviewed trade ${trade.id}: result=${exitResult}, score=${improvementScore}`);
    return review;
  }

  // ═══════════════════════════════════════════════════════════════
  // Pattern Detection
  // ═══════════════════════════════════════════════════════════════

  detectPatterns(): StopPattern[] {
    const patterns: StopPattern[] = [];
    const reviews = Array.from(this.reviews.values());

    // Pattern: too_tight_stop
    const tooTight = reviews.filter(r => r.exitResult === 'premature');
    if (tooTight.length >= 2) {
      patterns.push({
        id: this.nextId('ptn'),
        patternType: 'too_tight_stop',
        count: tooTight.length,
        totalPnlLost: tooTight.reduce((s, r) => s + r.potentialPnl, 0),
        examples: tooTight.map(r => r.tradeId),
        suggestion: 'Widen stop-loss by 30-50% or use ATR-based stops (2x ATR).',
        confidence: Math.min(0.9, tooTight.length * 0.2),
      });
    }

    // Pattern: too_wide_target
    const missed = reviews.filter(r => r.exitResult === 'missed_opportunity');
    if (missed.length >= 2) {
      patterns.push({
        id: this.nextId('ptn'),
        patternType: 'too_wide_target',
        count: missed.length,
        totalPnlLost: missed.reduce((s, r) => s + r.potentialPnl, 0),
        examples: missed.map(r => r.tradeId),
        suggestion: 'Consider scaling out at multiple targets (50% at TP1, 50% at TP2).',
        confidence: Math.min(0.9, missed.length * 0.2),
      });
    }

    // Pattern: emotional_exit
    const manualExits = reviews.filter(r => {
      const trade = this.trades.get(r.tradeId);
      return trade?.exitTrigger === 'manual_exit' && r.exitResult === 'late';
    });
    if (manualExits.length >= 2) {
      patterns.push({
        id: this.nextId('ptn'),
        patternType: 'emotional_exit',
        count: manualExits.length,
        totalPnlLost: manualExits.reduce((s, r) => s + r.potentialPnl, 0),
        examples: manualExits.map(r => r.tradeId),
        suggestion: 'Use hard stop-loss/take-profit orders instead of manual exits.',
        confidence: Math.min(0.85, manualExits.length * 0.15),
      });
    }

    // Pattern: recurring_symbol (same symbol, many bad exits)
    const bySymbol = new Map<string, StopReview[]>();
    for (const r of reviews) {
      if (r.improvementScore < 50) {
        const sym = r.symbol;
        if (!bySymbol.has(sym)) bySymbol.set(sym, []);
        bySymbol.get(sym)!.push(r);
      }
    }
    for (const [symbol, symReviews] of bySymbol) {
      if (symReviews.length >= 3) {
        patterns.push({
          id: this.nextId('ptn'),
          patternType: 'recurring_symbol',
          symbol,
          count: symReviews.length,
          totalPnlLost: symReviews.reduce((s, r) => s + r.potentialPnl, 0),
          examples: symReviews.map(r => r.tradeId),
          suggestion: `Review strategy for ${symbol}. Consider different stop methodology.`,
          confidence: Math.min(0.9, symReviews.length * 0.25),
        });
      }
    }

    // Pattern: no_stop_used
    const noStopTrades = Array.from(this.trades.values()).filter(t => !t.stopLoss);
    if (noStopTrades.length >= 3) {
      const noStopReviews = noStopTrades
        .map(t => this.reviews.get(this.findReviewForTrade(t.id)))
        .filter((r): r is StopReview => r !== undefined);

      if (noStopReviews.length >= 2) {
        const lost = noStopTrades.filter(t => t.pnl < 0);
        patterns.push({
          id: this.nextId('ptn'),
          patternType: 'no_stop_used',
          count: noStopTrades.length,
          totalPnlLost: lost.reduce((s, t) => s + Math.abs(t.pnl), 0),
          examples: noStopTrades.slice(0, 5).map(t => t.id),
          suggestion: 'Always set a stop-loss. Consider -2% trailing or -5% hard stop.',
          confidence: Math.min(0.95, noStopTrades.length * 0.1),
        });
      }
    }

    return patterns;
  }

  private findReviewForTrade(tradeId: string): string | undefined {
    for (const [id, review] of this.reviews) {
      if (review.tradeId === tradeId) return id;
    }
    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════
  // Bulk Analysis
  // ═══════════════════════════════════════════════════════════════

  reviewAllTrades(params: {
    priceMap: Record<string, number>; // symbol → current price
  }): StopReview[] {
    const results: StopReview[] = [];
    for (const [, trade] of this.trades) {
      const currentPrice = params.priceMap[trade.symbol] || trade.exitPrice;
      // If there's already a review, skip
      const existingReview = this.findReviewForTrade(trade.id);
      if (existingReview) continue;

      const review = this.reviewTrade({
        tradeId: trade.id,
        priceAfterExit: currentPrice,
        maxFavorableAfter: currentPrice * 1.05, // simulated
        maxAdverseAfter: currentPrice * 0.95,
      });
      if (review) results.push(review);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // Optimization Suggestions
  // ═══════════════════════════════════════════════════════════════

  suggestOptimalStops(symbol: string): {
    symbol: string;
    suggestedStopPct: number;
    suggestedTargetPct: number;
    avgSlippage: number;
    reviewCount: number;
  } {
    const reviews = this.reviewsBySymbol.get(symbol.toUpperCase()) || [];
    if (reviews.length === 0) {
      return { symbol: symbol.toUpperCase(), suggestedStopPct: 3, suggestedTargetPct: 5, avgSlippage: 0, reviewCount: 0 };
    }

    const prematureReviews = reviews.filter(r => r.exitResult === 'premature');
    const missedReviews = reviews.filter(r => r.exitResult === 'missed_opportunity');
    const totalSlippage = reviews.reduce((s, r) => s + r.slippage, 0);

    // Calculate optimal stop as average of fixes
    let suggestedStopPct = 3; // default 3%
    if (prematureReviews.length > 0) {
      suggestedStopPct = 5; // widen
    }

    let suggestedTargetPct = 5; // default 5%
    if (missedReviews.length > 2) {
      suggestedTargetPct = 8; // extend target
    }

    return {
      symbol: symbol.toUpperCase(),
      suggestedStopPct,
      suggestedTargetPct,
      avgSlippage: reviews.length > 0 ? Math.round(totalSlippage / reviews.length * 100) / 100 : 0,
      reviewCount: reviews.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════

  getStats(): ReviewStats {
    const reviews = Array.from(this.reviews.values());

    const byResult: Record<ExitResult, number> = {
      premature: 0, optimal: 0, late: 0, missed_opportunity: 0, not_applicable: 0,
    };
    let totalScore = 0;
    let totalPnlLost = 0;

    for (const r of reviews) {
      byResult[r.exitResult]++;
      totalScore += r.improvementScore;
      totalPnlLost += r.potentialPnl;
    }

    return {
      totalTrades: this.trades.size,
      reviews: reviews.length,
      byResult,
      avgImprovementScore: reviews.length > 0 ? Math.round(totalScore / reviews.length) : 100,
      totalPnlLost,
      patterns: this.detectPatterns(),
    };
  }

  getTradeReview(tradeId: string): StopReview | undefined {
    for (const [, review] of this.reviews) {
      if (review.tradeId === tradeId) return review;
    }
    return undefined;
  }

  getReviewsBySymbol(symbol: string): StopReview[] {
    return this.reviewsBySymbol.get(symbol.toUpperCase()) || [];
  }
}
