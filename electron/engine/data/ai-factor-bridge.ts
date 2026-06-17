/**
 * R258 P1-02: AI快评→因子桥接 (AiFactorBridge)
 * 
 * 连接AI评论引擎 → 因子信号系统，将AI市场评论转化为可量化因子信号
 * 
 * 功能:
 *   1. AI评论文本 → 结构化因子提取
 *   2. 情绪评分 → 因子权重映射
 *   3. 多维度因子聚合 (技术面/基本面/情绪/宏观/资金)
 *   4. 因子置信度校准
 *   5. AI评论→策略模板信号转换
 * 
 * 上游: ai-sentiment-engine.ts, price-move-attribution.ts
 * 下游: factor-signal-translator.ts, strategy templates
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type FactorDomain = 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'flow';

export interface AiCommentary {
  commentaryId: string;
  symbol: string;
  market: string;
  timestamp: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;        // -1 to 1
  keyPoints: string[];
  keyPointsCn: string[];
  confidence: number;             // 0-1
  source: string;
  factors?: ExtractedFactor[];
}

export interface ExtractedFactor {
  domain: FactorDomain;
  name: string;
  nameCn: string;
  direction: 'positive' | 'negative' | 'neutral';
  strength: number;               // 0-1
  evidence: string;
  evidenceCn: string;
}

export interface FactorSignal {
  signalId: string;
  symbol: string;
  factorDomain: FactorDomain;
  factorName: string;
  factorNameCn: string;
  rawValue: number;
  normalizedValue: number;        // -1 to 1
  weight: number;                 // 0-1 (confidence-adjusted)
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  sourceCommentaryId: string;
  timestamp: number;
}

export interface FactorAggregate {
  symbol: string;
  technical: { score: number; signal: 'long' | 'short' | 'neutral'; weight: number };
  fundamental: { score: number; signal: 'long' | 'short' | 'neutral'; weight: number };
  sentiment: { score: number; signal: 'long' | 'short' | 'neutral'; weight: number };
  macro: { score: number; signal: 'long' | 'short' | 'neutral'; weight: number };
  flow: { score: number; signal: 'long' | 'short' | 'neutral'; weight: number };
  compositeScore: number;         // weighted aggregate -1 to 1
  compositeSignal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  generatedAt: number;
}

// ── Domain weight defaults ─────────────────────────────────────────────────

const DEFAULT_DOMAIN_WEIGHTS: Record<FactorDomain, number> = {
  technical: 0.25,
  fundamental: 0.20,
  sentiment: 0.25,
  macro: 0.15,
  flow: 0.15,
};

// ── AI sentiment keyword → factor extraction patterns ─────────────────────

const SENTIMENT_FACTORS: Record<string, { domain: FactorDomain; name: string; nameCn: string; direction: 'positive' | 'negative' }> = {
  // Bullish patterns
  'breakout':      { domain: 'technical', name: 'breakout', nameCn: '突破', direction: 'positive' },
  'oversold':      { domain: 'technical', name: 'oversold_bounce', nameCn: '超卖反弹', direction: 'positive' },
  'accumulation':  { domain: 'flow', name: 'accumulation', nameCn: '吸筹', direction: 'positive' },
  'upgrade':       { domain: 'fundamental', name: 'analyst_upgrade', nameCn: '分析师上调', direction: 'positive' },
  'beat':          { domain: 'fundamental', name: 'earnings_beat', nameCn: '财报超预期', direction: 'positive' },
  'easing':        { domain: 'macro', name: 'policy_easing', nameCn: '政策宽松', direction: 'positive' },
  'bullish':       { domain: 'sentiment', name: 'bullish_sentiment', nameCn: '看多情绪', direction: 'positive' },
  'inflow':        { domain: 'flow', name: 'capital_inflow', nameCn: '资金流入', direction: 'positive' },

  // Bearish patterns
  'breakdown':     { domain: 'technical', name: 'breakdown', nameCn: '跌破', direction: 'negative' },
  'overbought':    { domain: 'technical', name: 'overbought_pullback', nameCn: '超买回调', direction: 'negative' },
  'distribution':  { domain: 'flow', name: 'distribution', nameCn: '出货', direction: 'negative' },
  'downgrade':     { domain: 'fundamental', name: 'analyst_downgrade', nameCn: '分析师下调', direction: 'negative' },
  'miss':          { domain: 'fundamental', name: 'earnings_miss', nameCn: '财报不及预期', direction: 'negative' },
  'tightening':    { domain: 'macro', name: 'policy_tightening', nameCn: '政策收紧', direction: 'negative' },
  'bearish':       { domain: 'sentiment', name: 'bearish_sentiment', nameCn: '看空情绪', direction: 'negative' },
  'outflow':       { domain: 'flow', name: 'capital_outflow', nameCn: '资金流出', direction: 'negative' },
};

// ═══════════════════════════════════════════════════════════════════════════
// AiFactorBridge
// ═══════════════════════════════════════════════════════════════════════════

export class AiFactorBridge {
  private signals: FactorSignal[] = [];
  private aggregates: FactorAggregate[] = [];
  private domainWeights: Record<FactorDomain, number>;
  private stats_ = { totalCommentaries: 0, totalSignals: 0, avgCompositeScore: 0 };

  constructor(domainWeights?: Partial<Record<FactorDomain, number>>) {
    this.domainWeights = { ...DEFAULT_DOMAIN_WEIGHTS, ...domainWeights };
  }

  // ── Public API: Commentary → Factors ────────────────────────────────────

  /**
   * Extract factors from an AI commentary and generate factor signals.
   */
  extractFactors(commentary: AiCommentary): ExtractedFactor[] {
    if (commentary.factors && commentary.factors.length > 0) {
      return commentary.factors; // pre-extracted
    }

    return this._extractFromText(commentary);
  }

  /**
   * Convert extracted factors to quantifiable signals.
   */
  generateSignals(commentary: AiCommentary): FactorSignal[] {
    const factors = this.extractFactors(commentary);
    const signals: FactorSignal[] = [];

    for (const factor of factors) {
      const signal = this._factorToSignal(factor, commentary);
      if (signal) {
        signals.push(signal);
        this.signals.push(signal);
      }
    }

    this.stats_.totalCommentaries++;
    this.stats_.totalSignals += signals.length;

    return signals;
  }

  /**
   * Full pipeline: commentary → factors → signals → aggregate.
   */
  processCommentary(commentary: AiCommentary): FactorAggregate | null {
    const signals = this.generateSignals(commentary);
    if (signals.length === 0) return null;

    return this.aggregate(commentary.symbol, signals, commentary.confidence);
  }

  /**
   * Batch process multiple commentaries.
   */
  processBatch(commentaries: AiCommentary[]): FactorAggregate[] {
    return commentaries
      .map(c => this.processCommentary(c))
      .filter((a): a is FactorAggregate => a !== null);
  }

  // ── Public API: Factor Aggregation ──────────────────────────────────────

  /**
   * Aggregate factor signals into a composite score.
   */
  aggregate(symbol: string, signals: FactorSignal[], baseConfidence = 0.7): FactorAggregate {
    const domainMap = new Map<FactorDomain, FactorSignal[]>();
    for (const s of signals) {
      const arr = domainMap.get(s.factorDomain) ?? [];
      arr.push(s);
      domainMap.set(s.factorDomain, arr);
    }

    const compute = (domain: FactorDomain) => {
      const ss = domainMap.get(domain) ?? [];
      if (ss.length === 0) return { score: 0, signal: 'neutral' as const, weight: 0 };

      const totalWeight = ss.reduce((sum, s) => sum + s.weight, 0);
      const avgScore = totalWeight > 0
        ? ss.reduce((sum, s) => sum + s.normalizedValue * s.weight, 0) / totalWeight
        : 0;

      const signal = avgScore > 0.2 ? 'long' as const : avgScore < -0.2 ? 'short' as const : 'neutral' as const;

      return { score: Math.round(avgScore * 100) / 100, signal, weight: Math.min(totalWeight, 1) };
    };

    const domains: FactorDomain[] = ['technical', 'fundamental', 'sentiment', 'macro', 'flow'];
    const scores = Object.fromEntries(domains.map(d => [d, compute(d)])) as FactorAggregate;

    // Weighted composite
    let compositeNumerator = 0;
    let compositeDenominator = 0;
    for (const d of domains) {
      const s = scores[d];
      compositeNumerator += s.score * s.weight * this.domainWeights[d];
      compositeDenominator += s.weight * this.domainWeights[d];
    }
    const compositeScore = compositeDenominator > 0
      ? compositeNumerator / compositeDenominator
      : 0;

    let compositeSignal: FactorAggregate['compositeSignal'] = 'hold';
    if (compositeScore > 0.5) compositeSignal = 'strong_buy';
    else if (compositeScore > 0.2) compositeSignal = 'buy';
    else if (compositeScore < -0.5) compositeSignal = 'strong_sell';
    else if (compositeScore < -0.2) compositeSignal = 'sell';

    // Confidence = min(base_confidence, avg factor confidence)
    const avgFactorConfidence = signals.length > 0
      ? signals.reduce((s, sig) => s + sig.confidence, 0) / signals.length
      : 0.5;

    const aggregate: FactorAggregate = {
      symbol,
      ...scores,
      compositeScore: Math.round(compositeScore * 100) / 100,
      compositeSignal,
      confidence: Math.round(Math.min(baseConfidence, avgFactorConfidence) * 100) / 100,
      generatedAt: Date.now(),
    };

    this.aggregates.push(aggregate);
    if (this.aggregates.length > 500) this.aggregates.shift();

    this.stats_.avgCompositeScore = Math.round(
      (this.stats_.avgCompositeScore * (this.aggregates.length - 1) + compositeScore) / this.aggregates.length * 100
    ) / 100;

    return aggregate;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get factor signals history */
  getSignals(symbol?: string, limit = 100): FactorSignal[] {
    let results = this.signals;
    if (symbol) results = results.filter(s => s.symbol === symbol);
    return results.slice(-limit).reverse();
  }

  /** Get latest aggregate for a symbol */
  getLatestAggregate(symbol: string): FactorAggregate | null {
    for (let i = this.aggregates.length - 1; i >= 0; i--) {
      if (this.aggregates[i].symbol === symbol) return this.aggregates[i];
    }
    return null;
  }

  /** Get all aggregates */
  getAggregates(symbol?: string, limit = 50): FactorAggregate[] {
    let results = this.aggregates;
    if (symbol) results = results.filter(a => a.symbol === symbol);
    return results.slice(-limit).reverse();
  }

  /** Get domain weights */
  getDomainWeights(): Record<FactorDomain, number> {
    return { ...this.domainWeights };
  }

  /** Update domain weights */
  updateDomainWeights(weights: Partial<Record<FactorDomain, number>>): void {
    this.domainWeights = { ...this.domainWeights, ...weights };
  }

  /** Get calibration score (avg confidence vs actual) */
  getStats() {
    return { ...this.stats_ };
  }

  /** Reset */
  reset(): void {
    this.signals = [];
    this.aggregates = [];
    this.stats_ = { totalCommentaries: 0, totalSignals: 0, avgCompositeScore: 0 };
  }

  // ── Private: Factor Extraction ───────────────────────────────────────────

  private _extractFromText(commentary: AiCommentary): ExtractedFactor[] {
    const text = [...commentary.keyPoints.map(p => p.toLowerCase()), ...commentary.keyPointsCn].join(' ');
    const factors: ExtractedFactor[] = [];
    const seen = new Set<string>();

    for (const [keyword, def] of Object.entries(SENTIMENT_FACTORS)) {
      if (!text.includes(keyword.toLowerCase())) continue;
      if (seen.has(def.name)) continue;
      seen.add(def.name);

      // Strength based on sentiment alignment
      let strength = 0.6; // base
      if (def.direction === 'positive' && commentary.sentiment === 'bullish') strength = 0.85;
      else if (def.direction === 'negative' && commentary.sentiment === 'bearish') strength = 0.85;
      else if (def.direction === 'positive' && commentary.sentiment === 'bearish') strength = 0.3;
      else if (def.direction === 'negative' && commentary.sentiment === 'bullish') strength = 0.3;

      strength = Math.round(strength * commentary.confidence * 100) / 100;

      factors.push({
        domain: def.domain,
        name: def.name,
        nameCn: def.nameCn,
        direction: def.direction,
        strength,
        evidence: `AI commentary mentions "${keyword}" for ${commentary.symbol}`,
        evidenceCn: `AI评论提及"${keyword}"关键词 (${commentary.symbol})`,
      });
    }

    return factors;
  }

  private _factorToSignal(factor: ExtractedFactor, commentary: AiCommentary): FactorSignal | null {
    const rawValue = factor.direction === 'positive' ? factor.strength : -factor.strength;
    const normalizedValue = Math.max(-1, Math.min(1, rawValue * 2)); // scale to -1..1

    const weight = factor.strength * commentary.confidence;

    let direction: FactorSignal['direction'] = 'neutral';
    if (normalizedValue > 0.15) direction = 'long';
    else if (normalizedValue < -0.15) direction = 'short';

    return {
      signalId: `fsig:${commentary.symbol}:${factor.domain}:${factor.name}:${this._hash(commentary.commentaryId + factor.name).toString(36).slice(0, 6)}`,
      symbol: commentary.symbol,
      factorDomain: factor.domain,
      factorName: factor.name,
      factorNameCn: factor.nameCn,
      rawValue,
      normalizedValue: Math.round(normalizedValue * 100) / 100,
      weight: Math.round(weight * 100) / 100,
      direction,
      confidence: factor.strength,
      sourceCommentaryId: commentary.commentaryId,
      timestamp: Date.now(),
    };
  }

  // ── Private: Helpers ────────────────────────────────────────────────────

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const aiFactorBridge = new AiFactorBridge();
