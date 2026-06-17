/**
 * R258 P1-04: 异动→推送桥接 (MovePushBridge)
 * 
 * 连接归因引擎 → 推送引擎，将行情异动转化为可推送通知
 * 
 * 功能:
 *   1. MoveAttributionEngine → PushIpcBridge 数据管道
 *   2. 异动严重度 → 推送优先级自动映射
 *   3. 归因摘要 → 推送文案自动生成 (CN/EN)
 *   4. 批量异动聚合推送 (同一市场多标的)
 *   5. 推送节奏控制 (市场开盘/盘中/收盘的不同推送策略)
 * 
 * 上游: move-attribution-engine.ts, price-move-push-engine.ts
 * 下游: push-ipc-bridge.ts
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MoveSignal {
  symbol: string;
  name: string;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  direction: 'up' | 'down';
  changePercent: number;
  volumeRatio: number;
  severity: 'minor' | 'notable' | 'major' | 'extreme';
  attribution: AttributionResult;
  timestamp: number;
}

export interface AttributionResult {
  dimensions: AttributionDimension[];
  primaryReason: string;
  primaryReasonCn: string;
  confidence: number;  // 0-1
  score: number;       // aggregate attribution score
}

export interface AttributionDimension {
  name: string;
  nameCn: string;
  score: number;        // 0-1 contribution
  evidence: string[];
  evidenceCn: string[];
}

export type MovePushStrategy = 'realtime' | 'batched' | 'digest';

export interface PushRule {
  strategy: MovePushStrategy;
  minSeverity: 'minor' | 'notable' | 'major' | 'extreme';
  maxPerBatch: number;
  minIntervalMs: number;
  includeAttribution: boolean;
  marketPhase: 'pre_market' | 'open' | 'midday' | 'closing' | 'after_hours';
}

export interface MovePushEvent {
  eventId: string;
  moves: MoveSignal[];
  pushTitle: string;
  pushBody: string;
  pushBodyCn: string;
  strategy: MovePushStrategy;
  priority: 'high' | 'normal' | 'low';
  rule: PushRule;
  generatedAt: number;
}

// ── Default Push Rules ─────────────────────────────────────────────────────

const PUSH_RULES: Record<string, PushRule> = {
  pre_market: {
    strategy: 'batched',
    minSeverity: 'notable',
    maxPerBatch: 5,
    minIntervalMs: 0,        // fire once before open
    includeAttribution: true,
    marketPhase: 'pre_market',
  },
  open: {
    strategy: 'realtime',
    minSeverity: 'major',
    maxPerBatch: 3,
    minIntervalMs: 120_000,  // max 1 push per 2 min during open
    includeAttribution: true,
    marketPhase: 'open',
  },
  midday: {
    strategy: 'digest',
    minSeverity: 'notable',
    maxPerBatch: 8,
    minIntervalMs: 0,        // fire once at midday
    includeAttribution: false,
    marketPhase: 'midday',
  },
  closing: {
    strategy: 'batched',
    minSeverity: 'notable',
    maxPerBatch: 5,
    minIntervalMs: 0,        // fire once near close
    includeAttribution: true,
    marketPhase: 'closing',
  },
  after_hours: {
    strategy: 'realtime',
    minSeverity: 'extreme',  // only extreme moves after hours
    maxPerBatch: 1,
    minIntervalMs: 600_000,  // max 1 per 10 min
    includeAttribution: true,
    marketPhase: 'after_hours',
  },
};

// ── Market schedule helpers ────────────────────────────────────────────────

const MARKET_HOURS: Record<string, { open: number; close: number; tzOffset: number }> = {
  US:     { open: 9.5,  close: 16,  tzOffset: -4 },  // EDT
  HK:     { open: 9.5,  close: 16,  tzOffset: 8 },
  A:      { open: 9.5,  close: 15,  tzOffset: 8 },
  CRYPTO: { open: 0,    close: 24,  tzOffset: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════
// MovePushBridge
// ═══════════════════════════════════════════════════════════════════════════

export class MovePushBridge {
  private pushHistory: MovePushEvent[] = [];
  private lastPushTime: Map<string, number> = new Map(); // market → last push
  private batchedMoves: Map<string, MoveSignal[]> = new Map(); // market → moves
  private stats_ = { totalPushes: 0, totalMoves: 0, avgConfidence: 0 };

  constructor() {}

  // ── Public API: Move Ingestion ──────────────────────────────────────────

  /**
   * Ingest a move signal from the attribution engine.
   * Accumulates for batched/digest strategies, or fires immediately for realtime.
   */
  ingest(move: MoveSignal): MovePushEvent | null {
    const rule = this._determineRule(move.market, move.timestamp);
    if (!rule) return null;

    // Severity filter
    const severityRank: Record<string, number> = { minor: 0, notable: 1, major: 2, extreme: 3 };
    if (severityRank[move.severity] < severityRank[rule.minSeverity]) return null;

    return this._processMove(move, rule);
  }

  /**
   * Ingest multiple moves at once (e.g. pre-market scan results).
   */
  ingestBatch(moves: MoveSignal[]): MovePushEvent[] {
    const events: MovePushEvent[] = [];
    for (const move of moves) {
      const event = this.ingest(move);
      if (event) events.push(event);
    }
    return events;
  }

  /**
   * Force flush all batched moves now (e.g. on market phase change).
   */
  flushAll(): MovePushEvent[] {
    const events: MovePushEvent[] = [];
    for (const [market, moves] of this.batchedMoves) {
      if (moves.length === 0) continue;
      const rule = this._determineRule(market as MoveSignal['market'], Date.now());
      if (rule) {
        const event = this._buildBatchEvent(market, [...moves], rule);
        events.push(event);
        this.stats_.totalPushes++;
        this.stats_.totalMoves += moves.length;
      }
      this.batchedMoves.set(market, []);
    }
    return events;
  }

  /**
   * Get the current market phase for a market.
   */
  getMarketPhase(market: MoveSignal['market'], timestamp = Date.now()): string {
    const hours = MARKET_HOURS[market];
    if (!hours) return 'after_hours';
    const utcHour = new Date(timestamp).getUTCHours() + new Date(timestamp).getUTCMinutes() / 60;
    const localHour = (utcHour + hours.tzOffset + 24) % 24;

    if (market === 'CRYPTO') return 'open'; // 24/7

    if (localHour < hours.open - 0.5) return 'pre_market';
    if (localHour < hours.open) return 'pre_market';
    if (localHour < 12) return 'open';
    if (localHour < 13) return 'midday';
    if (localHour < hours.close - 1) return 'open';
    if (localHour < hours.close) return 'closing';
    return 'after_hours';
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get recent push events */
  getHistory(limit = 50): MovePushEvent[] {
    return this.pushHistory.slice(-limit).reverse();
  }

  /** Get batched moves for a market */
  getBatchedMoves(market: string): MoveSignal[] {
    return this.batchedMoves.get(market) ?? [];
  }

  /** Get push rule for a market at a given time */
  getActiveRule(market: MoveSignal['market'], timestamp = Date.now()): PushRule | null {
    return this._determineRule(market, timestamp);
  }

  /** Get all push rules */
  getAllRules(): Record<string, PushRule> {
    return { ...PUSH_RULES };
  }

  /** Get stats */
  getStats() {
    return { ...this.stats_ };
  }

  /** Reset */
  reset(): void {
    this.pushHistory = [];
    this.lastPushTime.clear();
    this.batchedMoves.clear();
    this.stats_ = { totalPushes: 0, totalMoves: 0, avgConfidence: 0 };
  }

  // ── Private: Processing ─────────────────────────────────────────────────

  private _processMove(move: MoveSignal, rule: PushRule): MovePushEvent | null {
    switch (rule.strategy) {
      case 'realtime':
        return this._buildImmediate(move, rule);
      case 'batched':
      case 'digest':
        return this._accumulate(move, rule);
      default:
        return null;
    }
  }

  private _buildImmediate(move: MoveSignal, rule: PushRule): MovePushEvent | null {
    // Interval check
    const lastKey = `realtime:${move.market}`;
    const lastTime = this.lastPushTime.get(lastKey) ?? 0;
    if (Date.now() - lastTime < rule.minIntervalMs) return null;

    this.lastPushTime.set(lastKey, Date.now());

    const event = this._buildPushEvent([move], rule);
    this._recordEvent(event);
    return event;
  }

  private _accumulate(move: MoveSignal, rule: PushRule): MovePushEvent | null {
    const key = `${rule.strategy}:${move.market}`;
    const batch = this.batchedMoves.get(key) ?? [];
    batch.push(move);

    if (batch.length >= rule.maxPerBatch) {
      const event = this._buildPushEvent([...batch], rule);
      this.batchedMoves.set(key, []);
      this._recordEvent(event);
      return event;
    }

    this.batchedMoves.set(key, batch);
    return null; // still accumulating
  }

  private _buildBatchEvent(market: string, moves: MoveSignal[], rule: PushRule): MovePushEvent {
    const sorted = moves.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    const top = sorted.slice(0, rule.maxPerBatch);
    return this._buildPushEvent(top, rule);
  }

  // ── Private: Event Construction ─────────────────────────────────────────

  private _buildPushEvent(moves: MoveSignal[], rule: PushRule): MovePushEvent {
    const sorted = moves.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    const top = sorted.slice(0, rule.maxPerBatch);
    const market = top[0]?.market ?? 'US';

    const { title, body, bodyCn, priority } = this._generatePushContent(top, rule);

    const event: MovePushEvent = {
      eventId: `mvp:${market}:${Date.now()}:${this._hash(top.map(m => m.symbol).join(',')).toString(36).slice(0, 6)}`,
      moves: top,
      pushTitle: title,
      pushBody: body,
      pushBodyCn: bodyCn,
      strategy: rule.strategy,
      priority,
      rule,
      generatedAt: Date.now(),
    };

    this.stats_.totalPushes++;
    this.stats_.totalMoves += top.length;

    const confidences = top.map(m => m.attribution.confidence);
    const avgConf = confidences.reduce((s, c) => s + c, 0) / confidences.length;
    this.stats_.avgConfidence = Math.round(avgConf * 100) / 100;

    return event;
  }

  private _generatePushContent(moves: MoveSignal[], rule: PushRule): {
    title: string; body: string; bodyCn: string; priority: 'high' | 'normal' | 'low';
  } {
    const market = moves[0]?.market ?? 'US';
    const marketNames: Record<string, string> = { US: 'US', HK: 'HK', A: 'A股', CRYPTO: 'Crypto' };
    const marketNamesCn: Record<string, string> = { US: '美股', HK: '港股', A: 'A股', CRYPTO: '加密' };

    if (moves.length === 1) {
      const m = moves[0];
      const dir = m.direction === 'up' ? '↑' : '↓';
      const dirCn = m.direction === 'up' ? '涨' : '跌';
      const sev = m.severity === 'extreme' ? '⚡ ' : m.severity === 'major' ? '🔥 ' : '';

      const title = `${sev}${m.symbol} ${dir}${Math.abs(m.changePercent).toFixed(1)}%`;
      const reason = rule.includeAttribution ? m.attribution.primaryReason : '';
      const reasonCn = rule.includeAttribution ? m.attribution.primaryReasonCn : '';

      return {
        title,
        body: `${m.name} ${m.direction} ${Math.abs(m.changePercent).toFixed(1)}%, vol ${m.volumeRatio.toFixed(1)}x. ${reason}`,
        bodyCn: `${m.name} ${dirCn}${Math.abs(m.changePercent).toFixed(1)}%, 量比${m.volumeRatio.toFixed(1)}倍。${reasonCn}`,
        priority: m.severity === 'extreme' || m.severity === 'major' ? 'high' : 'normal',
      };
    }

    // Multi-move summary
    const upList = moves.filter(m => m.direction === 'up');
    const downList = moves.filter(m => m.direction === 'down');
    const top3 = moves.slice(0, 3).map(m => `${m.symbol} ${m.direction === 'up' ? '↑' : '↓'}${Math.abs(m.changePercent).toFixed(1)}%`);
    const top3Cn = moves.slice(0, 3).map(m => `${m.symbol} ${m.direction === 'up' ? '涨' : '跌'}${Math.abs(m.changePercent).toFixed(1)}%`);

    const sev = moves.some(m => m.severity === 'extreme') ? '⚡ ' : '';

    const title = `${sev}${marketNames[market]} ${moves.length} 异动`;
    const body = `${upList.length}↑ ${downList.length}↓ — ${top3.join(', ')}`;
    const bodyCn = `${upList.length}涨 ${downList.length}跌 — ${top3Cn.join('、')}`;

    const hasExtreme = moves.some(m => m.severity === 'extreme');

    return {
      title,
      body,
      bodyCn,
      priority: hasExtreme ? 'high' : 'normal',
    };
  }

  // ── Private: Helpers ────────────────────────────────────────────────────

  private _determineRule(market: MoveSignal['market'], timestamp: number): PushRule | null {
    const phase = this.getMarketPhase(market, timestamp);
    return PUSH_RULES[phase] ?? null;
  }

  private _recordEvent(event: MovePushEvent): void {
    this.pushHistory.push(event);
    if (this.pushHistory.length > 500) this.pushHistory.shift();
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const movePushBridge = new MovePushBridge();
