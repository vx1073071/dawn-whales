/**
 * R246 P2-32: 今天为什么涨跌推送引擎 (PriceMovePushEngine)
 * 
 * 开盘前3分钟检测用户关注列表异动 → AI生成原因 → 推送通知
 * 
 * Pipeline:
 *   Pre-market scan (before open) → detect significant moves (>3%)
 *     → match with news events → AI generate explanation
 *     → push notification to user
 * 
 * 推送策略:
 *   - 开盘前3分钟 (09:27 AM EST for US, 09:27 AM HKT for HK)
 *   - 异动阈值: 盘前/pre-market涨跌 >3% 或 昨收对比 >5%
 *   - 人数限制: 每条推送最多5个异动(最相关)
 *   - 原因来源: 新闻头条+财报+社交媒体
 *   - 免费推送(基础版) vs 付费深度分析(3U/月)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PriceMove {
  symbol: string;
  name: string;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  direction: 'up' | 'down';
  changePercent: number;       // e.g. 4.5 = +4.5%
  price: number;
  preMarketPrice?: number;
  yesterdayClose: number;
  volumeRatio: number;         // vs avg volume
  severity: 'minor' | 'notable' | 'major' | 'extreme';
}

export interface MoveExplanation {
  moveId: string;
  symbol: string;
  changePercent: number;
  direction: 'up' | 'down';
  reasons: ExplanationReason[];
  confidence: number;          // AI confidence 0-1
  generatedAt: number;
}

export interface ExplanationReason {
  category: 'earnings' | 'news' | 'sector' | 'macro' | 'technical' | 'social' | 'insider';
  headline: string;
  summary: string;
  source: string;
  relevance: number;           // 0-1
  publishedAt: number;
}

export interface PushNotification {
  pushId: string;
  userId: string;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  generatedAt: number;
  marketOpenInMinutes: number; // e.g. 3
  moves: PushMove[];
  summary: string;             // "你关注的3只股票今日盘前异动"
}

export interface PushMove {
  symbol: string;
  direction: 'up' | 'down';
  changePercent: number;
  /**
   * Primary reason — one sentence why
   * e.g. "财报超预期15%推动股价大涨"
   */
  oneLineReason: string;
  severity: string; // emoji: 🔴🟡🟢
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  alerted: boolean;            // User wants push for this?
}

export interface PushSchedule {
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  openTime: string;            // HH:MM in local TZ
  pushTime: string;            // HH:MM (3 min before open)
  timezone: string;
}

// ── Market open schedules ───────────────────────────────────────────────────

const MARKET_SCHEDULES: PushSchedule[] = [
  { market: 'US', openTime: '09:30', pushTime: '09:27', timezone: 'America/New_York' },
  { market: 'HK', openTime: '09:30', pushTime: '09:27', timezone: 'Asia/Hong_Kong' },
  { market: 'A',  openTime: '09:30', pushTime: '09:27', timezone: 'Asia/Shanghai' },
  { market: 'CRYPTO', openTime: '00:00', pushTime: '08:00', timezone: 'UTC' }, // 24/7, push at 8am
];

// ── Move severity thresholds ────────────────────────────────────────────────

const SEVERITY_THRESHOLDS = {
  minor:   1,     // >1%
  notable: 3,     // >3%
  major:   6,     // >6%
  extreme: 10,    // >10%
};

// ═══════════════════════════════════════════════════════════════════════════
// PriceMovePushEngine
// ═══════════════════════════════════════════════════════════════════════════

export class PriceMovePushEngine {
  private watchlists: Map<string, WatchlistItem[]> = new Map(); // userId→items
  private moveHistory: Map<string, PriceMove[]> = new Map();    // userId→moves
  private explanationCache: Map<string, MoveExplanation> = new Map(); // moveId→explanation
  private pushHistory: PushNotification[] = [];
  private stats_ = { totalPushes: 0, totalMoves: 0, avgMovePercent: 0 };

  constructor() { }

  // ── Public API: Watchlist Management ────────────────────────────────────

  /** Register a user's watchlist for push alerts */
  registerWatchlist(userId: string, items: WatchlistItem[]): void {
    this.watchlists.set(userId, items);
  }

  /** Add single item to watchlist */
  addToWatchlist(userId: string, item: WatchlistItem): void {
    const list = this.watchlists.get(userId) ?? [];
    if (!list.some(i => i.symbol === item.symbol)) {
      list.push(item);
      this.watchlists.set(userId, list);
    }
  }

  /** Get user's watchlist */
  getWatchlist(userId: string): WatchlistItem[] {
    return this.watchlists.get(userId) ?? [];
  }

  // ── Public API: Move Detection ──────────────────────────────────────────

  /**
   * Detect significant pre-market moves.
   * Called ~3 min before market open.
   */
  detectMoves(
    userId: string,
    marketData: Array<{
      symbol: string; price: number; preMarketPrice?: number;
      yesterdayClose: number; volume: number; avgVolume: number;
      name: string;
    }>,
  ): PriceMove[] {
    const watchlist = this.watchlists.get(userId) ?? [];
    if (watchlist.length === 0) return [];

    const watchlistSymbols = new Set(watchlist.map(w => w.symbol));
    const moves: PriceMove[] = [];

    for (const d of marketData) {
      if (!watchlistSymbols.has(d.symbol)) continue;

      const refPrice = d.preMarketPrice ?? d.price;
      const changePct = ((refPrice - d.yesterdayClose) / d.yesterdayClose) * 100;
      const absChange = Math.abs(changePct);

      if (absChange < SEVERITY_THRESHOLDS.minor) continue;

      let severity: PriceMove['severity'] = 'minor';
      if (absChange >= SEVERITY_THRESHOLDS.extreme) severity = 'extreme';
      else if (absChange >= SEVERITY_THRESHOLDS.major) severity = 'major';
      else if (absChange >= SEVERITY_THRESHOLDS.notable) severity = 'notable';

      moves.push({
        symbol: d.symbol,
        name: d.name,
        market: watchlist.find(w => w.symbol === d.symbol)?.market ?? 'US',
        direction: changePct > 0 ? 'up' : 'down',
        changePercent: Math.round(changePct * 100) / 100,
        price: d.price,
        preMarketPrice: d.preMarketPrice,
        yesterdayClose: d.yesterdayClose,
        volumeRatio: d.avgVolume > 0 ? Math.round(d.volume / d.avgVolume * 100) / 100 : 1,
        severity,
      });
    }

    // Sort by severity desc, then abs change desc
    moves.sort((a, b) => {
      const sev = ['extreme', 'major', 'notable', 'minor'];
      const sa = sev.indexOf(a.severity);
      const sb = sev.indexOf(b.severity);
      if (sa !== sb) return sa - sb;
      return Math.abs(b.changePercent) - Math.abs(a.changePercent);
    });

    return moves;
  }

  // ── Public API: AI Explanation ──────────────────────────────────────────

  /**
   * Generate AI explanation for a detected move.
   * Uses simulated AI (in production: DeepSeek V4 / GPT-4).
   */
  explainMove(move: PriceMove, newsContext?: Array<{
    headline: string; source: string; category: ExplanationReason['category'];
    publishedAt: number; relevance: number;
  }>): MoveExplanation {
    const moveId = `move:${move.symbol}:${Date.now()}`;

    // Generate reasons from news context or simulated data
    let reasons: ExplanationReason[];

    if (newsContext && newsContext.length > 0) {
      reasons = newsContext.map(n => ({
        category: n.category,
        headline: n.headline,
        summary: this._expandHeadline(n.headline, move),
        source: n.source,
        relevance: n.relevance,
        publishedAt: n.publishedAt,
      }));
    } else {
      reasons = this._generateSimulatedReasons(move);
    }

    const explanation: MoveExplanation = {
      moveId,
      symbol: move.symbol,
      changePercent: move.changePercent,
      direction: move.direction,
      reasons: reasons.slice(0, 3),
      confidence: reasons.length > 0 ? Math.min(0.95, 0.5 + reasons.length * 0.15) : 0.4,
      generatedAt: Date.now(),
    };

    this.explanationCache.set(moveId, explanation);
    return explanation;
  }

  // ── Public API: Push Notification ───────────────────────────────────────

  /**
   * Generate push notification for user.
   * Takes detected moves + explanations → formatted push.
   */
  generatePush(
    userId: string,
    market: 'US' | 'HK' | 'A' | 'CRYPTO',
    moves: PriceMove[],
    explanations: MoveExplanation[],
  ): PushNotification | null {
    if (moves.length === 0) return null;

    // Limit to top 5 moves
    const topMoves = moves.slice(0, 5);
    const explMap = new Map(explanations.map(e => [e.symbol, e]));

    const schedule = MARKET_SCHEDULES.find(s => s.market === market);
    const minutesToOpen = schedule ? 3 : 0;

    const pushMoves: PushMove[] = topMoves.map(m => {
      const expl = explMap.get(m.symbol);
      const reason = expl?.reasons[0];

      let oneLineReason: string;
      if (reason) {
        oneLineReason = reason.summary;
      } else {
        oneLineReason = m.direction === 'up'
          ? `${m.name}盘前大涨${Math.abs(m.changePercent)}%`
          : `${m.name}盘前跌${Math.abs(m.changePercent)}%`;
      }

      const sevEmoji = m.severity === 'extreme' ? '🔴' : m.severity === 'major' ? '🟠' : m.severity === 'notable' ? '🟡' : '🟢';

      return {
        symbol: m.symbol,
        direction: m.direction,
        changePercent: m.changePercent,
        oneLineReason: `${sevEmoji} ${oneLineReason}`,
        severity: m.severity,
      };
    });

    // Summary
    const upCount = pushMoves.filter(p => p.direction === 'up').length;
    const downCount = pushMoves.filter(p => p.direction === 'down').length;
    const summaryParts: string[] = [];
    if (upCount > 0) summaryParts.push(`${upCount}只上涨`);
    if (downCount > 0) summaryParts.push(`${downCount}只下跌`);
    const summary = `你关注的${pushMoves.length}只股票今日盘前异动：${summaryParts.join('，')}`;

    const push: PushNotification = {
      pushId: `push:${userId}:${market}:${Date.now()}`,
      userId, market,
      generatedAt: Date.now(),
      marketOpenInMinutes: minutesToOpen,
      moves: pushMoves,
      summary,
    };

    this.pushHistory.push(push);
    this.stats_.totalPushes++;
    this.stats_.totalMoves += pushMoves.length;

    // Rolling avg
    const totalMoves = this.stats_.totalMoves;
    const avgPct = pushMoves.reduce((s, m) => s + Math.abs(m.changePercent), 0) / pushMoves.length;
    this.stats_.avgMovePercent = Math.round(((this.stats_.avgMovePercent * (totalMoves - pushMoves.length)) + avgPct * pushMoves.length) / totalMoves * 100) / 100;

    return push;
  }

  /**
   * Complete pipeline: detect → explain → push.
   * One call does everything for pre-market push.
   */
  completePipeline(
    userId: string,
    marketData: Array<{
      symbol: string; price: number; preMarketPrice?: number;
      yesterdayClose: number; volume: number; avgVolume: number;
      name: string;
    }>,
    newsContext?: Array<{
      symbol: string; headline: string; source: string;
      category: ExplanationReason['category']; publishedAt: number; relevance: number;
    }>,
  ): { push: PushNotification | null; moves: PriceMove[]; explanations: MoveExplanation[] } {
    const moves = this.detectMoves(userId, marketData);
    if (moves.length === 0) return { push: null, moves: [], explanations: [] };

    const market = moves[0].market;

    const explanations = moves.map(m => {
      const symbolNews = newsContext?.filter(n => n.symbol === m.symbol);
      return this.explainMove(m, symbolNews);
    });

    const push = this.generatePush(userId, market, moves, explanations);

    // Store history
    this.moveHistory.set(userId, moves);

    return { push, moves, explanations };
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Get push history for a user */
  getPushHistory(userId: string, limit = 20): PushNotification[] {
    return this.pushHistory
      .filter(p => p.userId === userId)
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, limit);
  }

  /** Get latest move detections for user */
  getLatestMoves(userId: string): PriceMove[] {
    return this.moveHistory.get(userId) ?? [];
  }

  /** Get explanation for a known move */
  getExplanation(moveId: string): MoveExplanation | null {
    return this.explanationCache.get(moveId) ?? null;
  }

  /** Get push stats */
  getStats() { return { ...this.stats_ }; }

  /** Get market schedules */
  getSchedules(): PushSchedule[] { return MARKET_SCHEDULES; }

  /** Reset all state */
  reset(): void {
    this.watchlists.clear();
    this.moveHistory.clear();
    this.explanationCache.clear();
    this.pushHistory.length = 0;
    this.stats_ = { totalPushes: 0, totalMoves: 0, avgMovePercent: 0 };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private _generateSimulatedReasons(move: PriceMove): ExplanationReason[] {
    const reasons: ExplanationReason[] = [];
    const now = Date.now();

    if (move.changePercent > 5 || move.changePercent < -5) {
      const isUp = move.direction === 'up';
      reasons.push({
        category: 'earnings',
        headline: `${move.name} earnings ${isUp ? 'beat' : 'missed'} estimates`,
        summary: isUp
          ? `财报超预期推动${move.symbol}盘前大涨${Math.abs(move.changePercent)}%`
          : `财报不及预期导致${move.symbol}盘前跌${Math.abs(move.changePercent)}%`,
        source: 'Earnings Report',
        relevance: 0.85,
        publishedAt: now - 3600000,
      });
    } else if (move.volumeRatio > 2) {
      reasons.push({
        category: 'technical',
        headline: `Unusual volume in ${move.symbol}`,
        summary: `${move.symbol}盘前成交量放大${move.volumeRatio.toFixed(1)}倍，大资金异动`,
        source: 'Market Data',
        relevance: 0.7,
        publishedAt: now - 1800000,
      });
    } else {
      reasons.push({
        category: 'sector',
        headline: `Sector movement affecting ${move.symbol}`,
        summary: move.direction === 'up'
          ? `板块轮动推动${move.symbol}盘前小幅上涨`
          : `板块回调拖累${move.symbol}盘前走低`,
        source: 'Sector Analysis',
        relevance: 0.55,
        publishedAt: now - 2700000,
      });
    }

    // Always add a macro note for context
    reasons.push({
      category: 'macro',
      headline: 'Pre-market sentiment',
      summary: move.direction === 'up'
        ? '今日盘前整体情绪偏乐观'
        : '今日盘前整体情绪偏谨慎',
      source: 'Market Overview',
      relevance: 0.4,
      publishedAt: now - 900000,
    });

    return reasons;
  }

  private _expandHeadline(headline: string, move: PriceMove): string {
    const direction = move.direction === 'up' ? '推动' : '拖累';
    return `${headline}，${direction}${move.symbol}盘前${move.direction === 'up' ? '涨' : '跌'}${Math.abs(move.changePercent)}%`;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: PriceMovePushEngine | null = null;

export function priceMovePushEngine(): PriceMovePushEngine {
  if (!instance) instance = new PriceMovePushEngine();
  return instance;
}

export function resetPriceMovePushEngine(): void { instance = null; }
