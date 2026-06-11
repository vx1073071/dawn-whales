// ── Sentiment Index Engine — Composite Market Sentiment Indicator ───────────
// JVS-3: Aggregates capital flow, margin balance, northbound flow, A/D ratio
// Output: 0-100 score (0=extreme fear, 100=extreme greed)

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface SentimentInput {
  // Capital flow (main force net inflow, billions)
  capitalFlowNetInflow?: number;     // Positive = inflow
  capitalFlowTrend?: 'increasing' | 'decreasing' | 'flat';

  // Margin balance (financing balance change, billions)
  marginBalanceChange?: number;      // Positive = increase
  marginBalanceTrend?: 'increasing' | 'decreasing' | 'flat';

  // Northbound flow (Stock Connect, billions)
  northboundNetBuy?: number;         // Positive = net buy
  northboundTrend?: 'increasing' | 'decreasing' | 'flat';

  // Advance/Decline ratio
  advanceCount?: number;             // Number of advancing stocks
  declineCount?: number;             // Number of declining stocks
  unchangedCount?: number;

  // Turnover (total market turnover, billions)
  totalTurnover?: number;
  turnoverTrend?: 'increasing' | 'decreasing' | 'flat';

  // Limit up/down count
  limitUpCount?: number;
  limitDownCount?: number;
}

export interface SentimentResult {
  score: number;                     // 0-100 composite score
  level: SentimentLevel;
  description: string;
  components: SentimentComponent[];
  signal: SentimentSignal;
  timestamp: number;
  metadata: {
    inputCount: number;              // How many inputs were available
    maxPossibleScore: number;        // Max score given available inputs
    dataQuality: 'full' | 'partial' | 'minimal';
  };
}

export type SentimentLevel =
  | 'extreme_fear'     // 0-20
  | 'fear'             // 20-40
  | 'neutral'          // 40-60
  | 'greed'            // 60-80
  | 'extreme_greed';   // 80-100

export interface SentimentComponent {
  name: string;
  score: number;       // 0-100 for this component
  weight: number;      // Weight in composite
  contribution: number;
  detail: string;
}

export type SentimentSignal =
  | 'strong_buy'       // Extreme fear = contrarian buy
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell';     // Extreme greed = contrarian sell

// ── Component Weights ──────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<string, number> = {
  capitalFlow: 0.25,    // Capital flow is the smart money
  marginBalance: 0.15,  // Leverage sentiment
  northbound: 0.20,     // Foreign institutional sentiment
  advanceDecline: 0.20, // Market breadth
  turnover: 0.10,       // Volume enthusiasm
  limitUpDown: 0.10,    // Extreme moves
};

// ── Sentiment Engine ───────────────────────────────────────────────────────

export class SentimentIndexEngine {
  private weights: Record<string, number>;
  private history: SentimentResult[] = [];
  private maxHistory = 100;

  constructor(customWeights?: Partial<Record<string, number>>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    // Normalize weights to sum to 1
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.01) {
      for (const key of Object.keys(this.weights)) {
        this.weights[key] /= sum;
      }
    }
    log.info('[SentimentIndex] Initialized with weights:', this.weights);
  }

  /**
   * Compute composite sentiment score
   */
  compute(input: SentimentInput): SentimentResult {
    const components: SentimentComponent[] = [];
    let totalWeight = 0;
    let weightedSum = 0;
    let inputCount = 0;

    // 1. Capital Flow Component
    if (input.capitalFlowNetInflow !== undefined) {
      const score = this.scoreCapitalFlow(input.capitalFlowNetInflow, input.capitalFlowTrend);
      const weight = this.weights.capitalFlow;
      components.push({
        name: 'Capital Flow',
        score,
        weight,
        contribution: score * weight,
        detail: `Net inflow: ${input.capitalFlowNetInflow.toFixed(2)}B, trend: ${input.capitalFlowTrend || 'unknown'}`,
      });
      weightedSum += score * weight;
      totalWeight += weight;
      inputCount++;
    }

    // 2. Margin Balance Component
    if (input.marginBalanceChange !== undefined) {
      const score = this.scoreMarginBalance(input.marginBalanceChange, input.marginBalanceTrend);
      const weight = this.weights.marginBalance;
      components.push({
        name: 'Margin Balance',
        score,
        weight,
        contribution: score * weight,
        detail: `Change: ${input.marginBalanceChange.toFixed(2)}B, trend: ${input.marginBalanceTrend || 'unknown'}`,
      });
      weightedSum += score * weight;
      totalWeight += weight;
      inputCount++;
    }

    // 3. Northbound Flow Component
    if (input.northboundNetBuy !== undefined) {
      const score = this.scoreNorthbound(input.northboundNetBuy, input.northboundTrend);
      const weight = this.weights.northbound;
      components.push({
        name: 'Northbound Flow',
        score,
        weight,
        contribution: score * weight,
        detail: `Net buy: ${input.northboundNetBuy.toFixed(2)}B, trend: ${input.northboundTrend || 'unknown'}`,
      });
      weightedSum += score * weight;
      totalWeight += weight;
      inputCount++;
    }

    // 4. Advance/Decline Component
    if (input.advanceCount !== undefined && input.declineCount !== undefined) {
      const score = this.scoreAdvanceDecline(input.advanceCount, input.declineCount, input.unchangedCount || 0);
      const weight = this.weights.advanceDecline;
      components.push({
        name: 'Advance/Decline',
        score,
        weight,
        contribution: score * weight,
        detail: `Advancing: ${input.advanceCount}, Declining: ${input.declineCount}`,
      });
      weightedSum += score * weight;
      totalWeight += weight;
      inputCount++;
    }

    // 5. Turnover Component
    if (input.totalTurnover !== undefined) {
      const score = this.scoreTurnover(input.totalTurnover, input.turnoverTrend);
      const weight = this.weights.turnover;
      components.push({
        name: 'Turnover',
        score,
        weight,
        contribution: score * weight,
        detail: `Total: ${input.totalTurnover.toFixed(0)}B, trend: ${input.turnoverTrend || 'unknown'}`,
      });
      weightedSum += score * weight;
      totalWeight += weight;
      inputCount++;
    }

    // 6. Limit Up/Down Component
    if (input.limitUpCount !== undefined && input.limitDownCount !== undefined) {
      const score = this.scoreLimitUpDown(input.limitUpCount, input.limitDownCount);
      const weight = this.weights.limitUpDown;
      components.push({
        name: 'Limit Up/Down',
        score,
        weight,
        contribution: score * weight,
        detail: `Limit up: ${input.limitUpCount}, Limit down: ${input.limitDownCount}`,
      });
      weightedSum += score * weight;
      totalWeight += weight;
      inputCount++;
    }

    // Normalize score by available weight
    const maxPossibleScore = totalWeight > 0 ? totalWeight * 100 : 100;
    const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
    const clampedScore = Math.max(0, Math.min(100, score));

    const level = this.scoreToLevel(clampedScore);
    const signal = this.scoreToSignal(clampedScore);
    const description = this.generateDescription(clampedScore, level, components);

    // Data quality assessment
    let dataQuality: 'full' | 'partial' | 'minimal';
    if (inputCount >= 5) dataQuality = 'full';
    else if (inputCount >= 3) dataQuality = 'partial';
    else dataQuality = 'minimal';

    const result: SentimentResult = {
      score: clampedScore,
      level,
      description,
      components,
      signal,
      timestamp: Date.now(),
      metadata: {
        inputCount,
        maxPossibleScore: Math.round(maxPossibleScore),
        dataQuality,
      },
    };

    // Update history
    this.history.push(result);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    log.info(`[SentimentIndex] Score: ${clampedScore} (${level}), signal: ${signal}, inputs: ${inputCount}`);
    return result;
  }

  /**
   * Get recent sentiment history
   */
  getHistory(limit = 20): SentimentResult[] {
    return this.history.slice(-limit);
  }

  /**
   * Get sentiment trend (improving/deteriorating)
   */
  getTrend(): { direction: 'improving' | 'deteriorating' | 'stable'; change: number } {
    if (this.history.length < 3) {
      return { direction: 'stable', change: 0 };
    }
    const recent = this.history.slice(-5);
    const scores = recent.map(r => r.score);
    const first = scores.slice(0, Math.floor(scores.length / 2));
    const second = scores.slice(Math.floor(scores.length / 2));
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
    const change = Math.round(avgSecond - avgFirst);

    if (change > 5) return { direction: 'improving', change };
    if (change < -5) return { direction: 'deteriorating', change };
    return { direction: 'stable', change };
  }

  // ── Component Scoring Functions ──────────────────────────────────────────

  /**
   * Capital flow: large positive = greed, large negative = fear
   * A-share typical range: -200B to +200B per day
   */
  private scoreCapitalFlow(netInflow: number, trend?: string): number {
    // Linear mapping: -200B → 0, 0 → 50, +200B → 100
    let score = 50 + (netInflow / 200) * 50;
    score = Math.max(0, Math.min(100, score));

    // Trend bonus/penalty
    if (trend === 'increasing') score = Math.min(100, score + 5);
    else if (trend === 'decreasing') score = Math.max(0, score - 5);

    return Math.round(score);
  }

  /**
   * Margin balance change: increase = greed, decrease = fear
   * Typical daily change: -10B to +10B
   */
  private scoreMarginBalance(change: number, trend?: string): number {
    let score = 50 + (change / 10) * 50;
    score = Math.max(0, Math.min(100, score));

    if (trend === 'increasing') score = Math.min(100, score + 5);
    else if (trend === 'decreasing') score = Math.max(0, score - 5);

    return Math.round(score);
  }

  /**
   * Northbound (Stock Connect): net buy = greed, net sell = fear
   * Typical daily: -15B to +15B
   */
  private scoreNorthbound(netBuy: number, trend?: string): number {
    let score = 50 + (netBuy / 15) * 50;
    score = Math.max(0, Math.min(100, score));

    if (trend === 'increasing') score = Math.min(100, score + 5);
    else if (trend === 'decreasing') score = Math.max(0, score - 5);

    return Math.round(score);
  }

  /**
   * Advance/Decline ratio: more advancers = greed
   */
  private scoreAdvanceDecline(advance: number, decline: number, unchanged: number): number {
    const total = advance + decline + unchanged;
    if (total === 0) return 50;

    // A/D ratio mapping
    const adRatio = decline > 0 ? advance / decline : advance > 0 ? 10 : 1;
    // adRatio: 0.1 → ~10, 1 → 50, 3 → ~75, 10 → ~90
    const score = 50 + (Math.log(adRatio) / Math.log(10)) * 30;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Turnover: high volume = enthusiasm, low = apathy
   * A-share typical daily: 500B to 1500B (yuan)
   */
  private scoreTurnover(turnover: number, trend?: string): number {
    // Map 500B → 30, 1000B → 50, 1500B → 70, 2000B → 90
    let score: number;
    if (turnover <= 500) {
      score = 20 + (turnover / 500) * 10;
    } else if (turnover <= 1000) {
      score = 30 + ((turnover - 500) / 500) * 20;
    } else if (turnover <= 1500) {
      score = 50 + ((turnover - 1000) / 500) * 20;
    } else {
      score = 70 + Math.min(((turnover - 1500) / 500) * 20, 20);
    }

    if (trend === 'increasing') score = Math.min(100, score + 5);
    else if (trend === 'decreasing') score = Math.max(0, score - 5);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Limit up/down: more limit-ups = extreme greed, more limit-downs = extreme fear
   */
  private scoreLimitUpDown(limitUp: number, limitDown: number): number {
    const total = limitUp + limitDown;
    if (total === 0) return 50;

    const ratio = limitUp / total; // 0 to 1
    // Map: 0 → 0 (all limit-down), 0.5 → 50, 1 → 100 (all limit-up)
    const score = ratio * 100;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ── Level & Signal Mapping ───────────────────────────────────────────────

  private scoreToLevel(score: number): SentimentLevel {
    if (score <= 20) return 'extreme_fear';
    if (score <= 40) return 'fear';
    if (score <= 60) return 'neutral';
    if (score <= 80) return 'greed';
    return 'extreme_greed';
  }

  private scoreToSignal(score: number): SentimentSignal {
    // Contrarian approach: extreme fear = buy, extreme greed = sell
    if (score <= 15) return 'strong_buy';
    if (score <= 30) return 'buy';
    if (score <= 70) return 'hold';
    if (score <= 85) return 'sell';
    return 'strong_sell';
  }

  private generateDescription(score: number, level: SentimentLevel, components: SentimentComponent[]): string {
    const levelNames: Record<SentimentLevel, string> = {
      extreme_fear: 'Extreme Fear',
      fear: 'Fear',
      neutral: 'Neutral',
      greed: 'Greed',
      extreme_greed: 'Extreme Greed',
    };

    const topComponent = components.reduce((best, c) =>
      c.contribution > best.contribution ? c : best,
    components[0]);

    const signalAdvice: Record<SentimentSignal, string> = {
      strong_buy: 'Contrarian buy signal — market overly pessimistic',
      buy: 'Lean bullish — sentiment below fair value',
      hold: 'Neutral — no clear sentiment edge',
      sell: 'Lean bearish — sentiment above fair value',
      strong_sell: 'Contrarian sell signal — market overly optimistic',
    };

    const signal = this.scoreToSignal(score);
    const parts = [
      `Market sentiment: ${levelNames[level]} (${score}/100)`,
      `Primary driver: ${topComponent?.name || 'N/A'} (${topComponent?.score || 50}/100)`,
      signalAdvice[signal],
    ];

    return parts.join('. ');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let sentimentEngineInstance: SentimentIndexEngine | null = null;

export function getSentimentEngine(): SentimentIndexEngine {
  if (!sentimentEngineInstance) {
    sentimentEngineInstance = new SentimentIndexEngine();
  }
  return sentimentEngineInstance;
}
