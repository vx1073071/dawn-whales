/**
 * R239 JVS#3: SentimentAggregator — 多源情绪聚合引擎
 *
 * Aggregates sentiment signals from multiple sources with:
 *   - Multi-source weighting (source trust, recency, consistency)
 *   - Noise filtering (outlier removal, agreement boosting)
 *   - Time decay (exponential: recent news weights more)
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────┐
 *   │           SentimentAggregator                 │
 *   │  ┌────────────────────────────────────────┐  │
 *   │  │ Source Weighting Engine                │  │
 *   │  │ (trust × recency × sample_count)       │  │
 *   │  └──────────────┬─────────────────────────┘  │
 *   │                 │                             │
 *   │  ┌──────────────┴─────────────────────────┐  │
 *   │  │ Noise Filter                           │  │
 *   │  │ (IQR outlier detection + agreement)    │  │
 *   │  └──────────────┬─────────────────────────┘  │
 *   │                 │                             │
 *   │  ┌──────────────┴─────────────────────────┐  │
 *   │  │ Time Decay                             │  │
 *   │  │ (w = e^(-λ·Δt), half-life configurable) │  │
 *   │  └──────────────┬─────────────────────────┘  │
 *   │                 │                             │
 *   │  ┌──────────────┴─────────────────────────┐  │
 *   │  │ Aggregate Output                       │  │
 *   │  │ (combined score + confidence + trend)  │  │
 *   │  └────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────┘
 *
 * Output: AggregatedSentiment
 *   - symbol/market: what this aggregation is for
 *   - aggregateScore: weighted average -1 to +1
 *   - confidence: agreement level among sources
 *   - sourceCount: how many sources contributed
 *   - trend: 'improving' | 'stable' | 'deteriorating'
 *   - breakdown: per-source detail
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';
import type { SentimentResult, SentimentLabel } from './AISentimentEngine';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export interface AggregatorConfig {
  /** Half-life in hours for time decay (default: 6) */
  halfLifeHours: number;
  /** Minimum sources required for high confidence */
  minSourcesForConfidence: number;
  /** IQR multiplier for outlier detection (default: 1.5) */
  iqrMultiplier: number;
  /** Source trust weights (0-1) */
  sourceTrustWeights: Record<string, number>;
}

export interface SourceBreakdown {
  sourceId: string;
  sourceName: string;
  score: number;
  confidence: number;
  weight: number;
  itemCount: number;
  latestUpdate: number;
}

export interface AggregatedSentiment {
  /** Symbol or market being aggregated */
  target: string;
  /** Weighted aggregate score -1 to +1 */
  aggregateScore: number;
  /** Aggregate confidence 0-1 */
  confidence: number;
  /** Overall sentiment label */
  sentiment: SentimentLabel;
  /** Number of unique sources */
  sourceCount: number;
  /** Total news items aggregated */
  itemCount: number;
  /** Sentiment trend direction */
  trend: 'improving' | 'stable' | 'deteriorating';
  /** Degree of agreement among sources 0-1 */
  agreementScore: number;
  /** Timestamp of most recent contribution */
  latestUpdate: number;
  /** Per-source breakdown */
  breakdown: SourceBreakdown[];
  /** Time-decayed aggregate (more weight to recent) */
  timeDecayedScore: number;
}

export interface AggregationInput {
  results: SentimentResult[];
  previousAggregation?: AggregatedSentiment;
  target: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Default Config
// ═════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: AggregatorConfig = {
  halfLifeHours: 6,
  minSourcesForConfidence: 3,
  iqrMultiplier: 1.5,
  sourceTrustWeights: {
    reuters: 0.95,
    bloomberg: 0.90,
    wsj: 0.85,
    ft: 0.85,
    fed: 0.90,
    ecb: 0.85,
    sec: 0.80,
    cnbc: 0.70,
    yahoo: 0.60,
    marketwatch: 0.65,
    coindesk: 0.65,
    cointelegraph: 0.60,
    seekingalpha: 0.50,
    benzinga: 0.55,
    zerohedge: 0.30,
    default: 0.50,
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// SentimentAggregator
// ═════════════════════════════════════════════════════════════════════════════

export class SentimentAggregator {
  private config: AggregatorConfig;
  private history: Map<string, AggregatedSentiment[]>; // target → history

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.history = new Map();
  }

  // ── Main Aggregation ────────────────────────────────────────────────────

  /**
   * Aggregate multiple sentiment results for a single symbol/market.
   * Applies: source weighting → noise filtering → time decay → combination.
   */
  aggregate(input: AggregationInput): AggregatedSentiment {
    const { results, previousAggregation, target } = input;
    const now = Date.now();

    if (results.length === 0) {
      // Return previous aggregation if no new data, with time decay applied
      if (previousAggregation) {
        return this.applyTimeDecayOnly(previousAggregation, now);
      }
      return this.emptyAggregation(target);
    }

    // Step 1: Filter outliers (noise removal via IQR)
    const filtered = this.filterOutliers(results);

    // Step 2: Assign weights to each source
    const weighted = this.assignWeights(filtered, now);

    // Step 3: Calculate aggregate score (weighted average)
    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
    const aggregateScore = totalWeight > 0
      ? weighted.reduce((s, w) => s + w.score * w.weight, 0) / totalWeight
      : 0;

    // Step 4: Time-decayed score
    const timeDecayedScore = this.calculateTimeDecayedScore(weighted, now);

    // Step 5: Build source breakdown
    const breakdown = this.buildBreakdown(weighted);

    // Step 6: Calculate agreement and confidence
    const agreementScore = this.calculateAgreement(weighted);
    const confidence = this.calculateConfidence(weighted, agreementScore);

    // Step 7: Determine sentiment
    const sentiment = this.classifySentiment(aggregateScore);

    // Step 8: Detect trend
    const trend = this.detectTrend(aggregateScore, timeDecayedScore, previousAggregation);

    // Step 9: Source count
    const sourceIds = new Set(weighted.map(w => w.sourceId));
    const sourceCount = sourceIds.size;
    const itemCount = results.length;

    const aggregated: AggregatedSentiment = {
      target,
      aggregateScore: Math.round(aggregateScore * 10000) / 10000,
      confidence: Math.round(confidence * 10000) / 10000,
      sentiment,
      sourceCount,
      itemCount,
      trend,
      agreementScore: Math.round(agreementScore * 10000) / 10000,
      latestUpdate: now,
      breakdown,
      timeDecayedScore: Math.round(timeDecayedScore * 10000) / 10000,
    };

    // Record history
    if (!this.history.has(target)) this.history.set(target, []);
    const hist = this.history.get(target)!;
    hist.push(aggregated);
    if (hist.length > 100) hist.shift(); // Keep last 100

    log.info(`[SENTIMENT-AGG] ${target}: score=${aggregated.aggregateScore.toFixed(3)} conf=${aggregated.confidence.toFixed(2)} from ${sourceCount} sources / ${itemCount} items`);

    return aggregated;
  }

  // ── Market-level Aggregation ────────────────────────────────────────────

  /**
   * Aggregate sentiments across an entire market.
   */
  aggregateMarket(market: string, results: SentimentResult[], previous?: AggregatedSentiment): AggregatedSentiment {
    const marketResults = results.filter(r => r.markets.includes(market));
    return this.aggregate({ results: marketResults, previousAggregation: previous, target: `market:${market}` });
  }

  /**
   * Aggregate sentiments for multiple markets at once.
   */
  aggregateMultiMarket(results: SentimentResult[]): Map<string, AggregatedSentiment> {
    const markets = new Set<string>();
    for (const r of results) {
      for (const m of r.markets) markets.add(m);
    }

    const output = new Map<string, AggregatedSentiment>();
    for (const market of markets) {
      const agg = this.aggregateMarket(market, results);
      output.set(market, agg);
    }

    return output;
  }

  // ── Source Weighting ────────────────────────────────────────────────────

  private assignWeights(
    results: SentimentResult[],
    now: number,
  ): Array<SentimentResult & { weight: number }> {
    return results.map(r => {
      const trustWeight = this.getSourceTrust(r.sourceId);
      const confidenceWeight = r.confidence;
      const recencyWeight = this.timeDecayWeight(r.analyzedAt, now);

      // Combined weight: trust 40% + confidence 30% + recency 30%
      const weight = (trustWeight * 0.4) + (confidenceWeight * 0.3) + (recencyWeight * 0.3);

      return { ...r, weight: Math.max(0.01, weight) };
    });
  }

  private getSourceTrust(sourceId: string): number {
    // Match partial source IDs
    for (const [key, weight] of Object.entries(this.config.sourceTrustWeights)) {
      if (sourceId.toLowerCase().includes(key.toLowerCase())) {
        return weight;
      }
    }
    return this.config.sourceTrustWeights.default || 0.5;
  }

  // ── Noise Filtering ─────────────────────────────────────────────────────

  /**
   * Remove outlier scores using IQR method.
   * Outliers: values > Q3 + k×IQR or < Q1 - k×IQR
   */
  private filterOutliers(results: SentimentResult[]): SentimentResult[] {
    if (results.length < 4) return results; // Need at least 4 for meaningful IQR

    const scores = results.map(r => r.score).sort((a, b) => a - b);
    const n = scores.length;

    const q1 = this.quantile(scores, 0.25);
    const q3 = this.quantile(scores, 0.75);
    const iqr = q3 - q1;

    const lower = q1 - this.config.iqrMultiplier * iqr;
    const upper = q3 + this.config.iqrMultiplier * iqr;

    const filtered = results.filter(r => r.score >= lower && r.score <= upper);

    if (filtered.length < results.length) {
      log.info(`[SENTIMENT-AGG] Filtered ${results.length - filtered.length} outliers from ${results.length} items`);
    }

    return filtered.length > 0 ? filtered : results; // Keep at least 1
  }

  private quantile(sorted: number[], q: number): number {
    const pos = q * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
  }

  // ── Time Decay ──────────────────────────────────────────────────────────

  /**
   * Exponential time decay: w = e^(-λ · Δt)
   * λ = ln(2) / halfLifeMs
   */
  private timeDecayWeight(timestamp: number, now: number): number {
    const deltaMs = now - timestamp;
    if (deltaMs <= 0) return 1.0;
    const halfLifeMs = this.config.halfLifeHours * 3600 * 1000;
    const lambda = Math.log(2) / halfLifeMs;
    return Math.exp(-lambda * deltaMs);
  }

  private calculateTimeDecayedScore(
    weighted: Array<SentimentResult & { weight: number }>,
    now: number,
  ): number {
    let totalDecayedWeight = 0;
    let decayedSum = 0;

    for (const w of weighted) {
      const decay = this.timeDecayWeight(w.analyzedAt, now);
      decayedSum += w.score * w.weight * decay;
      totalDecayedWeight += w.weight * decay;
    }

    return totalDecayedWeight > 0 ? decayedSum / totalDecayedWeight : 0;
  }

  private applyTimeDecayOnly(prev: AggregatedSentiment, now: number): AggregatedSentiment {
    const decayedScore = this.timeDecayWeight(prev.latestUpdate, now) * prev.aggregateScore;

    return {
      ...prev,
      aggregateScore: decayedScore,
      timeDecayedScore: decayedScore,
      trend: Math.abs(decayedScore) < 0.1 ? 'stable' : prev.trend,
    };
  }

  // ── Agreement & Confidence ──────────────────────────────────────────────

  /**
   * Agreement = 1 - normalized_stddev of scores.
   * 1.0 = all sources agree, 0.0 = maximum disagreement
   */
  private calculateAgreement(weighted: Array<SentimentResult & { weight: number }>): number {
    if (weighted.length <= 1) return 1.0;

    const scores = weighted.map(w => w.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const stddev = Math.sqrt(variance);

    // Normalize: stddev range is [0, 2] (scores in [-1, 1])
    // Agreement = 1 - stddev/2 → [0, 1]
    return Math.max(0, 1 - stddev / 2);
  }

  private calculateConfidence(
    weighted: Array<SentimentResult & { weight: number }>,
    agreement: number,
  ): number {
    const sourceCount = new Set(weighted.map(w => w.sourceId)).size;
    const avgSourceConfidence = weighted.reduce((s, w) => s + w.confidence, 0) / weighted.length;

    // Confidence factors:
    // - Source count (enough sources?  1.0 if ≥minSources)
    const sourceFactor = Math.min(1, sourceCount / this.config.minSourcesForConfidence);
    // - Agreement among sources
    const agreementFactor = agreement;
    // - Individual confidence
    const individualFactor = avgSourceConfidence;

    // Weighted: sources 20% + agreement 50% + individual 30%
    let confidence = (sourceFactor * 0.2) + (agreementFactor * 0.5) + (individualFactor * 0.3);

    // Penalty for very few items
    if (weighted.length < 3) {
      confidence *= weighted.length / 3;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  // ── Trend Detection ─────────────────────────────────────────────────────

  private detectTrend(
    currentScore: number,
    decayedScore: number,
    previous?: AggregatedSentiment,
  ): 'improving' | 'stable' | 'deteriorating' {
    // Compare current vs time-decayed (are recent contributions more positive?)
    if (previous) {
      const delta = currentScore - previous.aggregateScore;
      if (delta > 0.15) return 'improving';
      if (delta < -0.15) return 'deteriorating';
    }

    // Compare current vs time-decayed (heavier weight on recent)
    const recentDelta = currentScore - decayedScore;
    if (recentDelta > 0.10) return 'improving';
    if (recentDelta < -0.10) return 'deteriorating';

    return 'stable';
  }

  private classifySentiment(score: number): SentimentLabel {
    if (score > 0.15) return 'bullish';
    if (score < -0.15) return 'bearish';
    return 'neutral';
  }

  // ── Breakdown ────────────────────────────────────────────────────────────

  private buildBreakdown(
    weighted: Array<SentimentResult & { weight: number }>,
  ): SourceBreakdown[] {
    const bySource = new Map<string, Array<SentimentResult & { weight: number }>>();

    for (const w of weighted) {
      if (!bySource.has(w.sourceId)) bySource.set(w.sourceId, []);
      bySource.get(w.sourceId)!.push(w);
    }

    const breakdowns: SourceBreakdown[] = [];

    for (const [sourceId, items] of bySource) {
      const avgScore = items.reduce((s, i) => s + i.score, 0) / items.length;
      const avgConf = items.reduce((s, i) => s + i.confidence, 0) / items.length;
      const avgWeight = items.reduce((s, i) => s + i.weight, 0) / items.length;
      const latest = Math.max(...items.map(i => i.analyzedAt));

      breakdowns.push({
        sourceId,
        sourceName: items[0].sourceId, // Use sourceId as name for now
        score: Math.round(avgScore * 10000) / 10000,
        confidence: Math.round(avgConf * 10000) / 10000,
        weight: Math.round(avgWeight * 10000) / 10000,
        itemCount: items.length,
        latestUpdate: latest,
      });
    }

    // Sort by weight descending
    breakdowns.sort((a, b) => b.weight - a.weight);

    return breakdowns;
  }

  // ── Utilities ───────────────────────────────────────────────────────────

  private emptyAggregation(target: string): AggregatedSentiment {
    return {
      target,
      aggregateScore: 0,
      confidence: 0,
      sentiment: 'neutral',
      sourceCount: 0,
      itemCount: 0,
      trend: 'stable',
      agreementScore: 0,
      latestUpdate: Date.now(),
      breakdown: [],
      timeDecayedScore: 0,
    };
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getHistory(target: string, limit = 20): AggregatedSentiment[] {
    const hist = this.history.get(target);
    if (!hist) return [];
    return hist.slice(-limit);
  }

  getLatest(target: string): AggregatedSentiment | null {
    const hist = this.history.get(target);
    if (!hist || hist.length === 0) return null;
    return hist[hist.length - 1];
  }

  getConfig(): AggregatorConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  reset(): void {
    this.history.clear();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultAggregator: SentimentAggregator | null = null;

export function getSentimentAggregator(): SentimentAggregator {
  if (!defaultAggregator) defaultAggregator = new SentimentAggregator();
  return defaultAggregator;
}

export function resetSentimentAggregator(): void {
  defaultAggregator = null;
}
