/**
 * R259 P1-07: 对比PK桥接 (ComparisonPkBridge)
 * 
 * 一键对比 — 多标的PK分析引擎
 * 
 * 功能:
 *   1. 多标的并行对比 (价格/涨跌/量比/估值/技术面)
 *   2. 同行业/同板块自动分组PK
 *   3. 对比雷达图数据生成
 *   4. PK排名与评分
 *   5. 对比报告 CN/EN 输出
 * 
 * 上游: market-observation, strategy signals
 * 下游: comparison UI, factor signals
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type PkDimension = 'price' | 'momentum' | 'volume' | 'valuation' | 'technical' | 'sentiment' | 'risk';

export interface PkEntry {
  symbol: string;
  name: string;
  nameCn: string;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  price: number;
  changePercent: number;
  volumeRatio: number;
  pe?: number;
  marketCap?: number;
  rsi?: number;
  macdSignal?: 'bullish' | 'bearish' | 'neutral';
  sentimentScore?: number;  // -1 to 1
  beta?: number;
}

export interface PkDimensionScore {
  dimension: PkDimension;
  dimensionCn: string;
  weight: number;
  scores: Record<string, number>;  // symbol → normalized score 0-100
  winner: string;
  gap: number;  // winner vs runner-up
}

export interface PkResult {
  pkId: string;
  symbols: string[];
  entries: PkEntry[];
  dimensions: PkDimensionScore[];
  compositeScores: Record<string, number>;  // symbol → overall 0-100
  ranking: string[];           // symbols sorted by composite score
  winner: string;
  summaryEn: string;
  summaryCn: string;
  generatedAt: number;
}

export interface PkGroup {
  groupId: string;
  groupName: string;
  groupNameCn: string;
  category: 'sector' | 'watchlist' | 'market' | 'custom';
  symbols: string[];
}

// ── Dimension weights ──────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<PkDimension, number> = {
  price:       0.10,
  momentum:    0.25,
  volume:      0.15,
  valuation:   0.15,
  technical:   0.20,
  sentiment:   0.10,
  risk:        0.05,
};

const DIMENSION_NAMES: Record<PkDimension, string> = {
  price:     'Price Action',
  momentum:  'Momentum',
  volume:    'Volume',
  valuation: 'Valuation',
  technical: 'Technical',
  sentiment: 'Sentiment',
  risk:      'Risk',
};

const DIMENSION_NAMES_CN: Record<PkDimension, string> = {
  price:     '价格动能',
  momentum:  '动量趋势',
  volume:    '成交量',
  valuation: '估值水平',
  technical: '技术指标',
  sentiment: '市场情绪',
  risk:      '风险控制',
};

// ═══════════════════════════════════════════════════════════════════════════
// ComparisonPkBridge
// ═══════════════════════════════════════════════════════════════════════════

export class ComparisonPkBridge {
  private results: PkResult[] = [];
  private groups: PkGroup[] = [];
  private stats_ = { totalPks: 0, avgGap: 0 };

  constructor() {}

  // ── Public API: PK Comparison ───────────────────────────────────────────

  /**
   * Run a head-to-head PK comparison between entries.
   */
  compare(entries: PkEntry[]): PkResult {
    const symbols = entries.map(e => e.symbol);
    const pkId = `pk:${symbols.sort().join(':')}:${Date.now()}`;

    const dimensions: PkDimensionScore[] = [];

    // Price Action: momentum, day change, price range
    dimensions.push(this._scoreDimension('price', entries, (e) => {
      const absChange = Math.abs(e.changePercent);
      return Math.min(100, absChange * 10 + 30);
    }));

    // Momentum: change% + trend bonus
    dimensions.push(this._scoreDimension('momentum', entries, (e) => {
      let score = 50 + e.changePercent * 5;
      if (e.macdSignal === 'bullish') score += 15;
      else if (e.macdSignal === 'bearish') score -= 15;
      return Math.max(0, Math.min(100, score));
    }));

    // Volume: volume ratio
    dimensions.push(this._scoreDimension('volume', entries, (e) => {
      return Math.min(100, e.volumeRatio * 30 + 20);
    }));

    // Valuation: lower PE = higher score (inverted)
    dimensions.push(this._scoreDimension('valuation', entries, (e) => {
      if (!e.pe) return 50;
      return Math.max(0, Math.min(100, 80 - e.pe * 2));
    }));

    // Technical: RSI normalized
    dimensions.push(this._scoreDimension('technical', entries, (e) => {
      if (!e.rsi) return 50;
      if (e.rsi < 30) return 80; // oversold → potential bounce
      if (e.rsi > 70) return 30; // overbought
      return 50 + (e.rsi - 50) * 0.8;
    }));

    // Sentiment
    dimensions.push(this._scoreDimension('sentiment', entries, (e) => {
      if (e.sentimentScore === undefined) return 50;
      return 50 + e.sentimentScore * 40;
    }));

    // Risk: inverse beta
    dimensions.push(this._scoreDimension('risk', entries, (e) => {
      if (!e.beta) return 50;
      return Math.max(0, Math.min(100, 80 - e.beta * 10));
    }));

    // Composite scores
    const compositeScores: Record<string, number> = {};
    for (const entry of entries) {
      let total = 0;
      let totalWeight = 0;
      for (const dim of dimensions) {
        const weight = DIMENSION_WEIGHTS[dim.dimension];
        total += (dim.scores[entry.symbol] ?? 0) * weight;
        totalWeight += weight;
      }
      compositeScores[entry.symbol] = Math.round(total / totalWeight * 100) / 100;
    }

    const ranking = Object.entries(compositeScores)
      .sort((a, b) => b[1] - a[1])
      .map(([sym]) => sym);

    const winner = ranking[0] ?? '';
    const winnerEntry = entries.find(e => e.symbol === winner);

    const result: PkResult = {
      pkId,
      symbols,
      entries,
      dimensions,
      compositeScores,
      ranking,
      winner,
      summaryEn: winnerEntry
        ? `${winner} wins (${compositeScores[winner]?.toFixed(1)}) across ${dimensions.length} dimensions`
        : 'No clear winner',
      summaryCn: winnerEntry
        ? `${winnerEntry.nameCn || winner} 综合胜出 (${compositeScores[winner]?.toFixed(1)}分)`
        : '无明显胜者',
      generatedAt: Date.now(),
    };

    this.results.push(result);
    if (this.results.length > 200) this.results.shift();
    this.stats_.totalPks++;

    // Track avg gap
    if (ranking.length >= 2) {
      const gap = (compositeScores[ranking[0]] ?? 0) - (compositeScores[ranking[1]] ?? 0);
      this.stats_.avgGap = Math.round(
        (this.stats_.avgGap * (this.stats_.totalPks - 1) + gap) / this.stats_.totalPks * 100
      ) / 100;
    }

    return result;
  }

  /**
   * Quick compare two symbols.
   */
  quickCompare(a: PkEntry, b: PkEntry): PkResult {
    return this.compare([a, b]);
  }

  /**
   * Compare a group by its predefined symbols (caller provides entries).
   */
  compareGroup(groupId: string, entries: PkEntry[]): PkResult | null {
    const group = this.groups.find(g => g.groupId === groupId);
    if (!group) return null;

    const filtered = entries.filter(e => group.symbols.includes(e.symbol));
    if (filtered.length < 2) return null;

    return this.compare(filtered);
  }

  // ── Public API: Groups ──────────────────────────────────────────────────

  /**
   * Create a PK group (sector, watchlist, custom).
   */
  createGroup(params: {
    groupName: string;
    groupNameCn: string;
    category: PkGroup['category'];
    symbols: string[];
  }): PkGroup {
    const group: PkGroup = {
      groupId: `pkgrp:${params.category}:${this._hash(params.groupName).toString(36).slice(0, 6)}`,
      ...params,
    };
    this.groups.push(group);
    return group;
  }

  /** Get all groups */
  getGroups(category?: PkGroup['category']): PkGroup[] {
    if (category) return this.groups.filter(g => g.category === category);
    return [...this.groups];
  }

  /** Delete a group */
  deleteGroup(groupId: string): boolean {
    const idx = this.groups.findIndex(g => g.groupId === groupId);
    if (idx < 0) return false;
    this.groups.splice(idx, 1);
    return true;
  }

  // ── Public API: Radar Data ──────────────────────────────────────────────

  /**
   * Generate radar chart data for a PK result.
   */
  getRadarData(pkId: string): Array<{ symbol: string; name: string; values: number[] }> | null {
    const result = this.results.find(r => r.pkId === pkId);
    if (!result) return null;

    return result.entries.map(entry => ({
      symbol: entry.symbol,
      name: entry.nameCn || entry.name,
      values: result.dimensions.map(dim => dim.scores[entry.symbol] ?? 0),
    }));
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get recent PK results */
  getHistory(limit = 50): PkResult[] {
    return this.results.slice(-limit).reverse();
  }

  /** Get PK result by ID */
  getResult(pkId: string): PkResult | null {
    return this.results.find(r => r.pkId === pkId) ?? null;
  }

  /** Get dimension config */
  getDimensions(): Array<{ key: PkDimension; name: string; nameCn: string; weight: number }> {
    return Object.entries(DIMENSION_WEIGHTS).map(([k, w]) => ({
      key: k as PkDimension,
      name: DIMENSION_NAMES[k as PkDimension],
      nameCn: DIMENSION_NAMES_CN[k as PkDimension],
      weight: w,
    }));
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.results = [];
    this.groups = [];
    this.stats_ = { totalPks: 0, avgGap: 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _scoreDimension(
    dim: PkDimension,
    entries: PkEntry[],
    scorer: (e: PkEntry) => number,
  ): PkDimensionScore {
    const scores: Record<string, number> = {};
    for (const e of entries) {
      scores[e.symbol] = Math.round(scorer(e) * 100) / 100;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winner = sorted[0]?.[0] ?? '';
    const gap = sorted.length >= 2 ? sorted[0][1] - sorted[1][1] : 0;

    return {
      dimension: dim,
      dimensionCn: DIMENSION_NAMES_CN[dim],
      weight: DIMENSION_WEIGHTS[dim],
      scores,
      winner,
      gap: Math.round(gap * 100) / 100,
    };
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const comparisonPkBridge = new ComparisonPkBridge();
