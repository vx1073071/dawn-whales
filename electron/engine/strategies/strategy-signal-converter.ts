/**
 * J-56-03: Strategy Signal Converter (R56 TradingAgents Integration)
 * Agent → dawn-whales strategy/policy
 *
 * Features:
 * - Convert TradingAgents analysis results to StrategyMarketplace format
 * - Map agent recommendations to signal types (BUY/SELL/HOLD)
 * - Confidence threshold filtering
 * - Multi-agent consensus resolution (4 agents vote → final signal)
 * - Historical signal tracking
 * - Signal quality scoring
 *
 * ≥200L, 5+ tests
 */

import log from 'electron-log';
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentRecommendation = 'buy' | 'sell' | 'hold' | 'neutral';
export type SignalSide = 'buy' | 'sell' | 'hold';
export type ConsensusMethod = 'majority' | 'weighted' | 'unanimous';

export interface AgentVote {
  agentType: string;
  recommendation: AgentRecommendation;
  confidence: number;      // 0-100
  reasoning: string;
}

export interface ConvertedSignal {
  id: string;
  symbol: string;
  market?: string;
  side: SignalSide;
  confidence: number;       // 0-100, consensus confidence
  votes: AgentVote[];
  consensusMethod: ConsensusMethod;
  reasoning: string;
  keyFactors: string[];
  stopLoss?: number;
  takeProfit?: number;
  timeframe?: string;
  llmProvider: string;
  costEstimate: number;     // USDT
  createdAt: string;
  qualityScore: number;     // 0-100
}

export interface ConversionOptions {
  consensusMethod?: ConsensusMethod;
  minConfidence?: number;    // reject signals below this
  minVotes?: number;         // require at least N agents to agree
  autoStopLoss?: boolean;    // auto-calculate stop loss
  stopLossPct?: number;      // default 5%
  autoTakeProfit?: boolean;
  takeProfitPct?: number;    // default 10%
}

// ── Default Options ────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: ConversionOptions = {
  consensusMethod: 'weighted',
  minConfidence: 50,
  minVotes: 2,
  autoStopLoss: true,
  stopLossPct: 5,
  autoTakeProfit: true,
  takeProfitPct: 10,
};

// ── Strategy Signal Converter ──────────────────────────────────────────────

export class StrategySignalConverter extends EventEmitter {
  private signals: Map<string, ConvertedSignal> = new Map();
  private options: ConversionOptions;
  private idCounter = 1;

  constructor(options?: Partial<ConversionOptions>) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    log.info('[StrategySignalConverter] Initialized');
  }

  // ── Core Conversion ───────────────────────────────────────────────────

  /**
   * Convert agent votes into a unified trading signal
   */
  convert(params: {
    symbol: string;
    market?: string;
    votes: AgentVote[];
    price?: number;
    llmProvider?: string;
    costEstimate?: number;
    timeframe?: string;
  }): ConvertedSignal | null {
    const { symbol, market, votes, price, llmProvider, costEstimate, timeframe } = params;

    if (votes.length === 0) {
      log.warn('[StrategySignalConverter] No votes provided');
      return null;
    }

    // Resolve consensus
    const consensus = this.resolveConsensus(votes, this.options.consensusMethod || 'weighted');

    // Check minimum confidence
    if (consensus.confidence < (this.options.minConfidence || 0)) {
      log.info(`[StrategySignalConverter] Signal rejected: confidence ${consensus.confidence} < ${this.options.minConfidence}`);
      return null;
    }

    // Check minimum votes
    const agreeCount = votes.filter(v => v.recommendation === consensus.side || (consensus.side === 'hold' && v.recommendation === 'neutral')).length;
    if (agreeCount < (this.options.minVotes || 0)) {
      log.info(`[StrategySignalConverter] Signal rejected: only ${agreeCount} votes agree (min ${this.options.minVotes})`);
      return null;
    }

    // Calculate stop loss / take profit
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    if (price && this.options.autoStopLoss && consensus.side === 'buy') {
      stopLoss = Math.round(price * (1 - (this.options.stopLossPct || 5) / 100) * 100) / 100;
    } else if (price && this.options.autoStopLoss && consensus.side === 'sell') {
      stopLoss = Math.round(price * (1 + (this.options.stopLossPct || 5) / 100) * 100) / 100;
    }
    if (price && this.options.autoTakeProfit && consensus.side === 'buy') {
      takeProfit = Math.round(price * (1 + (this.options.takeProfitPct || 10) / 100) * 100) / 100;
    } else if (price && this.options.autoTakeProfit && consensus.side === 'sell') {
      takeProfit = Math.round(price * (1 - (this.options.takeProfitPct || 10) / 100) * 100) / 100;
    }

    // Aggregate key factors
    const keyFactors = this.aggregateKeyFactors(votes);

    // Build reasoning summary
    const reasoning = this.buildReasoningSummary(votes, consensus);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(votes, consensus);

    const now = new Date().toISOString();
    const signal: ConvertedSignal = {
      id: `sig_${this.idCounter++}_${Date.now().toString(36)}`,
      symbol,
      market,
      side: consensus.side,
      confidence: consensus.confidence,
      votes,
      consensusMethod: this.options.consensusMethod || 'weighted',
      reasoning,
      keyFactors,
      stopLoss,
      takeProfit,
      timeframe,
      llmProvider: llmProvider || 'deepseek',
      costEstimate: costEstimate || 0,
      createdAt: now,
      qualityScore,
    };

    this.signals.set(signal.id, signal);
    this.emit('signal:converted', signal);
    log.info(`[StrategySignalConverter] Signal created: ${signal.id} ${signal.side} ${symbol} (${signal.confidence}% confidence)`);
    return signal;
  }

  // ── Consensus Resolution ──────────────────────────────────────────────

  resolveConsensus(votes: AgentVote[], method: ConsensusMethod): { side: SignalSide; confidence: number } {
    switch (method) {
      case 'majority':
        return this.majorityVote(votes);
      case 'unanimous':
        return this.unanimousVote(votes);
      case 'weighted':
      default:
        return this.weightedVote(votes);
    }
  }

  private majorityVote(votes: AgentVote[]): { side: SignalSide; confidence: number } {
    const counts: Record<string, number> = { buy: 0, sell: 0, hold: 0 };
    for (const v of votes) {
      const side = v.recommendation === 'neutral' ? 'hold' : v.recommendation;
      counts[side]++;
    }

    let maxSide: SignalSide = 'hold';
    let maxCount = 0;
    for (const [side, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxSide = side as SignalSide;
      }
    }

    const confidence = Math.round((maxCount / votes.length) * 100);
    return { side: maxSide, confidence };
  }

  private unanimousVote(votes: AgentVote[]): { side: SignalSide; confidence: number } {
    const sides = votes.map(v => v.recommendation === 'neutral' ? 'hold' : v.recommendation);
    const allSame = sides.every(s => s === sides[0]);

    if (allSame) {
      const avgConfidence = Math.round(votes.reduce((s, v) => s + v.confidence, 0) / votes.length);
      return { side: sides[0] as SignalSide, confidence: avgConfidence };
    }

    // Not unanimous → fall back to majority
    return this.majorityVote(votes);
  }

  private weightedVote(votes: AgentVote[]): { side: SignalSide; confidence: number } {
    const weights: Record<string, number> = { buy: 0, sell: 0, hold: 0 };

    for (const v of votes) {
      const side = v.recommendation === 'neutral' ? 'hold' : v.recommendation;
      weights[side] += v.confidence; // weight by confidence
    }

    let maxSide: SignalSide = 'hold';
    let maxWeight = 0;
    let totalWeight = 0;

    for (const [side, weight] of Object.entries(weights)) {
      totalWeight += weight;
      if (weight > maxWeight) {
        maxWeight = weight;
        maxSide = side as SignalSide;
      }
    }

    const confidence = totalWeight > 0 ? Math.round((maxWeight / totalWeight) * 100) : 0;
    return { side: maxSide, confidence };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private aggregateKeyFactors(votes: AgentVote[]): string[] {
    const factors = new Set<string>();
    for (const v of votes) {
      if (v.reasoning) {
        // Extract key phrases (simplified: take first sentence)
        const firstSentence = v.reasoning.split(/[.!?]/)[0].trim();
        if (firstSentence) factors.add(`${v.agentType}: ${firstSentence}`);
      }
    }
    return Array.from(factors).slice(0, 8);
  }

  private buildReasoningSummary(votes: AgentVote[], consensus: { side: SignalSide; confidence: number }): string {
    const buyCount = votes.filter(v => v.recommendation === 'buy').length;
    const sellCount = votes.filter(v => v.recommendation === 'sell').length;
    const holdCount = votes.filter(v => v.recommendation === 'hold' || v.recommendation === 'neutral').length;

    return `${consensus.side.toUpperCase()} signal (${consensus.confidence}% confidence) — ` +
      `${votes.length} agents: ${buyCount} buy, ${sellCount} sell, ${holdCount} hold`;
  }

  private calculateQualityScore(votes: AgentVote[], consensus: { side: SignalSide; confidence: number }): number {
    // Quality based on: consensus strength + average confidence + agreement ratio
    const avgConfidence = votes.reduce((s, v) => s + v.confidence, 0) / votes.length;
    const agreementRatio = votes.filter(v => {
      const side = v.recommendation === 'neutral' ? 'hold' : v.recommendation;
      return side === consensus.side;
    }).length / votes.length;

    const score = (consensus.confidence * 0.4) + (avgConfidence * 0.3) + (agreementRatio * 100 * 0.3);
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getSignal(id: string): ConvertedSignal | null {
    return this.signals.get(id) || null;
  }

  getSignals(filter?: { symbol?: string; side?: SignalSide; minConfidence?: number }): ConvertedSignal[] {
    let signals = Array.from(this.signals.values());
    if (filter?.symbol) signals = signals.filter(s => s.symbol === filter.symbol);
    if (filter?.side) signals = signals.filter(s => s.side === filter.side);
    if (filter?.minConfidence !== undefined) signals = signals.filter(s => s.confidence >= filter.minConfidence!);
    return signals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getSignalCount(): number {
    return this.signals.size;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.signals.clear();
    this.idCounter = 1;
    log.info('[StrategySignalConverter] Reset');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: StrategySignalConverter | null = null;

export function getStrategySignalConverter(options?: Partial<ConversionOptions>): StrategySignalConverter {
  if (!_instance) _instance = new StrategySignalConverter(options);
  return _instance;
}

export function resetStrategySignalConverter(): void {
  _instance?.reset();
  _instance = null;
}

export default StrategySignalConverter;
