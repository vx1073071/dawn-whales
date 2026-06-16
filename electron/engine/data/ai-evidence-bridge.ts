/**
 * R247 P2-28: AI可验证证据桥接 (AIEvidenceBridge)
 * 
 * AI结论 → 来源标注 → 证据链展示
 * 
 * 解决了AI推荐"黑箱"问题:
 *   用户看到 "建议买入AAPL" → 点开看到证据链:
 *     ✅ 财报超预期15% (source: Bloomberg, 2h ago)
 *     ✅ 12月动量因子排名前5% (source: 因子引擎, 实时)
 *     ✅ 分析师上调目标价 (source: TipRanks, 1d ago)
 *     ⚠️ 波动率偏高 (source: 波动率引擎, 实时)
 *   → 用户自己判断是否采纳
 * 
 * 证据链层级:
 *   Level 1 — 直接来源 (新闻/财报/交易所数据)
 *   Level 2 — 推导来源 (AI分析/因子计算/模型输出)
 *   Level 3 — 元推理 (为什么这个证据重要)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type EvidenceLevel = 1 | 2 | 3;
export type EvidenceCategory =
  | 'earnings' | 'news' | 'factor' | 'price' | 'volume' | 'social'
  | 'macro' | 'analyst' | 'insider' | 'technical' | 'sentiment';

export interface Evidence {
  evidenceId: string;
  level: EvidenceLevel;
  category: EvidenceCategory;
  /** What the evidence says (one sentence) */
  claim: string;
  claimCn: string;
  /** Where it came from */
  source: {
    name: string;           // e.g. "Bloomberg", "12-Month Momentum Factor"
    type: 'news' | 'data' | 'analysis' | 'report' | 'social';
    url?: string;
    publishedAt: number;
    freshness: 'live' | 'recent' | 'stale';  // <1h / <24h / >24h
  };
  /** How strong is this evidence */
  strength: 'strong' | 'moderate' | 'weak';
  /** Direction */
  direction: 'bullish' | 'bearish' | 'neutral';
  /** Verifiability */
  verifiable: boolean;       // Can user click to verify?
  verificationMethod?: string; // e.g. "Click to read full article"
}

export interface EvidenceChain {
  chainId: string;
  conclusion: string;       // e.g. "AAPL is a strong buy for the next 3 months"
  conclusionCn: string;
  generatedAt: number;
  tickers: string[];
  /** Evidence pieces, ordered by strength */ 
  evidencePieces: Evidence[];
  /** Summary stats */
  summary: {
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    strongEvidenceCount: number;
    totalEvidenceCount: number;
    overallDirection: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    confidenceScore: number; // 0-100
  };
}

export interface AIRecommendation {
  recommendationId: string;
  ticker: string;
  action: 'buy' | 'sell' | 'hold' | 'watch';
  confidence: number;        // 0-100
  timeHorizon: string;       // "1 week", "1 month", "3 months"
  reasoning: string;
  reasoningCn: string;
  /** Links to the evidence chain */
  evidenceChainId: string;
}

export interface EvidenceStats {
  totalChains: number;
  totalEvidence: number;
  avgEvidencePerChain: number;
  byCategory: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// AIEvidenceBridge
// ═══════════════════════════════════════════════════════════════════════════

export class AIEvidenceBridge {
  private chains: Map<string, EvidenceChain> = new Map();
  private recommendations: Map<string, AIRecommendation> = new Map();
  private stats_: EvidenceStats = this._initStats();

  constructor() { }

  // ── Public API: Build Evidence Chain ────────────────────────────────────

  /**
   * Build an evidence chain from raw evidence pieces.
   * Groups, orders, and summarizes evidence for a conclusion.
   */
  buildChain(
    conclusion: string,
    conclusionCn: string,
    tickers: string[],
    evidencePieces: Evidence[],
  ): EvidenceChain {
    // Sort: strong first, then moderate, then weak
    const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
    const sorted = [...evidencePieces].sort((a, b) =>
      strengthOrder[a.strength] - strengthOrder[b.strength]);

    // Count
    const bulls = sorted.filter(e => e.direction === 'bullish').length;
    const bears = sorted.filter(e => e.direction === 'bearish').length;
    const neutrals = sorted.filter(e => e.direction === 'neutral').length;
    const strongs = sorted.filter(e => e.strength === 'strong').length;

    // Overall direction
    let overallDirection: EvidenceChain['summary']['overallDirection'];
    if (bulls > bears * 2) overallDirection = 'bullish';
    else if (bears > bulls * 2) overallDirection = 'bearish';
    else if (bulls > bears) overallDirection = 'bullish';
    else if (bears > bulls) overallDirection = 'bearish';
    else if (strongs > 0) {
      const strongBulls = sorted.filter(e => e.strength === 'strong' && e.direction === 'bullish').length;
      const strongBears = sorted.filter(e => e.strength === 'strong' && e.direction === 'bearish').length;
      overallDirection = strongBulls > strongBears ? 'bullish' : strongBears > strongBulls ? 'bearish' : 'neutral';
    } else {
      overallDirection = 'mixed';
    }

    // Confidence: weighted by strength and consistency
    const strengthWeight = { strong: 3, moderate: 2, weak: 1 };
    let weightedScore = 0, totalWeight = 0;
    for (const e of sorted) {
      const w = strengthWeight[e.strength];
      weightedScore += e.direction === 'bullish' ? w : e.direction === 'bearish' ? -w : 0;
      totalWeight += w;
    }
    const normalized = totalWeight > 0 ? Math.abs(weightedScore) / totalWeight : 0;
    const confidenceScore = Math.round(Math.min(100, normalized * 100));

    const chain: EvidenceChain = {
      chainId: `chain:${tickers.join(',')}:${Date.now()}`,
      conclusion, conclusionCn,
      generatedAt: Date.now(),
      tickers,
      evidencePieces: sorted,
      summary: {
        bullishCount: bulls, bearishCount: bears, neutralCount: neutrals,
        strongEvidenceCount: strongs,
        totalEvidenceCount: sorted.length,
        overallDirection,
        confidenceScore,
      },
    };

    this.chains.set(chain.chainId, chain);

    // Update stats
    this.stats_.totalChains++;
    this.stats_.totalEvidence += sorted.length;
    this.stats_.avgEvidencePerChain = Math.round(this.stats_.totalEvidence / this.stats_.totalChains * 10) / 10;
    for (const e of sorted) {
      this.stats_.byCategory[e.category] = (this.stats_.byCategory[e.category] ?? 0) + 1;
    }

    return chain;
  }

  /**
   * Build evidence chain from AI recommendation output.
   * Parses AI reasoning text → extracts implicit evidence → creates chain.
   */
  buildChainFromAI(
    recommendationId: string,
    ticker: string,
    action: 'buy' | 'sell' | 'hold' | 'watch',
    aiReasoning: string,
    aiReasoningCn: string,
    confidence: number,
    timeHorizon: string,
    extraEvidence?: Evidence[],
  ): { recommendation: AIRecommendation; chain: EvidenceChain } {
    // Generate evidence from AI reasoning
    const derivedEvidence = this._parseReasoningToEvidence(aiReasoning, aiReasoningCn, ticker);
    const allEvidence = [...derivedEvidence, ...(extraEvidence ?? [])];

    // Build direction summary for conclusion
    const bulls = allEvidence.filter(e => e.direction === 'bullish').length;
    const bears = allEvidence.filter(e => e.direction === 'bearish').length;
    const actionCn = action === 'buy' ? '买入' : action === 'sell' ? '卖出' : action === 'hold' ? '持有' : '关注';
    const conclusion = `AI recommends ${action.toUpperCase()} ${ticker} (${confidence}% confidence, ${timeHorizon})`;
    const conclusionCn = `AI建议${actionCn}${ticker} (置信度${confidence}%, ${timeHorizon})`;

    const chain = this.buildChain(conclusion, conclusionCn, [ticker], allEvidence);

    const recommendation: AIRecommendation = {
      recommendationId,
      ticker, action, confidence, timeHorizon,
      reasoning: aiReasoning,
      reasoningCn: aiReasoningCn,
      evidenceChainId: chain.chainId,
    };

    this.recommendations.set(recommendationId, recommendation);
    return { recommendation, chain };
  }

  // ── Public API: Quick Evidence Helpers ──────────────────────────────────

  /**
   * Create a single evidence piece from a news event.
   */
  createNewsEvidence(
    headline: string, headlineCn: string,
    source: string, url: string, publishedAt: number,
    direction: 'bullish' | 'bearish' | 'neutral',
    strength: 'strong' | 'moderate' | 'weak',
  ): Evidence {
    const hoursAgo = (Date.now() - publishedAt) / 3600000;
    const freshness = hoursAgo < 1 ? 'live' : hoursAgo < 24 ? 'recent' : 'stale';

    return {
      evidenceId: `ev:news:${Date.now()}`,
      level: 1,
      category: 'news',
      claim: headline,
      claimCn: headlineCn,
      source: { name: source, type: 'news', url, publishedAt, freshness },
      strength,
      direction,
      verifiable: !!url,
      verificationMethod: url ? 'Click to read full article' : undefined,
    };
  }

  /**
   * Create a single evidence piece from a factor signal.
   */
  createFactorEvidence(
    factorId: string, factorName: string, factorNameCn: string,
    value: number, percentile: number,
    direction: 'bullish' | 'bearish' | 'neutral',
  ): Evidence {
    const strength = percentile >= 90 || percentile <= 10 ? 'strong' :
      percentile >= 70 || percentile <= 30 ? 'moderate' : 'weak';

    return {
      evidenceId: `ev:factor:${factorId}:${Date.now()}`,
      level: 2,
      category: 'factor',
      claim: `${factorName} ranks at ${percentile}th percentile (value: ${value.toFixed(2)})`,
      claimCn: `${factorNameCn}排名${percentile}百分位 (值: ${value.toFixed(2)})`,
      source: { name: factorName, type: 'data', publishedAt: Date.now(), freshness: 'live' },
      strength,
      direction,
      verifiable: true,
      verificationMethod: 'View factor details in Factor Explorer',
    };
  }

  /**
   * Create a single evidence piece from price action.
   */
  createPriceEvidence(
    ticker: string, changePercent: number, volumeRatio: number,
  ): Evidence {
    const absChange = Math.abs(changePercent);
    const strength = absChange > 5 ? 'strong' : absChange > 2 ? 'moderate' : 'weak';
    const direction = changePercent > 0 ? 'bullish' : 'bearish';

    return {
      evidenceId: `ev:price:${ticker}:${Date.now()}`,
      level: 1,
      category: 'price',
      claim: `${ticker} moved ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% with ${volumeRatio.toFixed(1)}x avg volume`,
      claimCn: `${ticker}涨跌${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%，成交量${volumeRatio.toFixed(1)}倍均值`,
      source: { name: 'Market Data', type: 'data', publishedAt: Date.now(), freshness: 'live' },
      strength,
      direction,
      verifiable: true,
      verificationMethod: 'View live chart',
    };
  }

  // ── Public API: Chain Verification ──────────────────────────────────────

  /**
   * Verify an evidence chain — check freshness + source availability.
   * Returns report on how reliable the chain is.
   */
  verifyChain(chainId: string): {
    chain: EvidenceChain | null;
    isReliable: boolean;
    score: number;           // 0-100
    issues: string[];
    staleEvidenceCount: number;
    unverifiableCount: number;
  } {
    const chain = this.chains.get(chainId);
    if (!chain) return { chain: null, isReliable: false, score: 0, issues: ['Chain not found'], staleEvidenceCount: 0, unverifiableCount: 0 };

    const issues: string[] = [];
    let staleCount = 0;
    let unverifiableCount = 0;
    let score = 100;

    for (const e of chain.evidencePieces) {
      if (e.source.freshness === 'stale') {
        staleCount++;
        score -= 10;
        issues.push(`Stale evidence: "${e.claim.slice(0, 50)}..."`);
      }
      if (!e.verifiable) {
        unverifiableCount++;
        score -= 5;
      }
      if (e.strength === 'weak') score -= 2;
    }

    // Bonus for strong evidence
    const strongPct = chain.summary.strongEvidenceCount / chain.summary.totalEvidenceCount;
    score += Math.round(strongPct * 15);

    // Consistency bonus
    const maxDir = Math.max(chain.summary.bullishCount, chain.summary.bearishCount);
    const consistencyPct = maxDir / chain.summary.totalEvidenceCount;
    score += Math.round(consistencyPct * 10);

    score = Math.max(0, Math.min(100, score));

    return {
      chain,
      isReliable: score >= 60,
      score,
      issues,
      staleEvidenceCount: staleCount,
      unverifiableCount: unverifiableCount,
    };
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Get a recommendation with its verified chain */
  getRecommendation(recommendationId: string): {
    recommendation: AIRecommendation | null;
    chain: EvidenceChain | null;
    verification: ReturnType<AIEvidenceBridge['verifyChain']>;
  } {
    const rec = this.recommendations.get(recommendationId) ?? null;
    const chain = rec ? (this.chains.get(rec.evidenceChainId) ?? null) : null;
    const verification = rec ? this.verifyChain(rec.evidenceChainId) : { chain: null, isReliable: false, score: 0, issues: [], staleEvidenceCount: 0, unverifiableCount: 0 };

    return { recommendation: rec, chain, verification };
  }

  /** Get chain by ID */
  getChain(chainId: string): EvidenceChain | null {
    return this.chains.get(chainId) ?? null;
  }

  /** Get all chains for a ticker */
  getChainsForTicker(ticker: string): EvidenceChain[] {
    return Array.from(this.chains.values())
      .filter(c => c.tickers.includes(ticker))
      .sort((a, b) => b.generatedAt - a.generatedAt);
  }

  /** Get all recommendations */
  listRecommendations(): AIRecommendation[] {
    return Array.from(this.recommendations.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /** Export chain as frontend-ready JSON */
  exportForFrontend(chainId: string): {
    chain: EvidenceChain;
    timeline: Array<{
      evidence: Evidence;
      position: 'top' | 'middle' | 'bottom';
    }>;
  } | null {
    const chain = this.chains.get(chainId);
    if (!chain) return null;

    // Sort by level (1→2→3) then by strength
    const sorted = [...chain.evidencePieces].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const s = { strong: 0, moderate: 1, weak: 2 };
      return s[a.strength] - s[b.strength];
    });

    const timeline = sorted.map((e, i) => ({
      evidence: e,
      position: i === 0 ? 'top' : i === sorted.length - 1 ? 'bottom' : 'middle',
    }));

    return { chain, timeline };
  }

  /** Get stats */
  getStats(): EvidenceStats { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.chains.clear();
    this.recommendations.clear();
    this.stats_ = this._initStats();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _parseReasoningToEvidence(reasoning: string, reasoningCn: string, ticker: string): Evidence[] {
    const evidence: Evidence[] = [];
    const now = Date.now();

    // Parse reasoning text for evidence keywords
    const lower = reasoning.toLowerCase();

    // Check for earnings mentions
    if (lower.includes('earning') || lower.includes('revenue') || lower.includes('profit')) {
      const isBeat = lower.includes('beat') || lower.includes('surpass') || lower.includes('exceed');
      evidence.push({
        evidenceId: `ev:derived:earnings:${now}`,
        level: 2, category: 'earnings',
        claim: isBeat ? `${ticker} earnings beat estimates` : `${ticker} earnings related`,
        claimCn: isBeat ? `${ticker}财报超预期` : `${ticker}财报相关`,
        source: { name: 'AI Analysis', type: 'analysis', publishedAt: now, freshness: 'live' },
        strength: isBeat ? 'strong' : 'moderate',
        direction: isBeat ? 'bullish' : 'neutral',
        verifiable: false,
      });
    }

    // Check for momentum / trend mentions
    if (lower.includes('momentum') || lower.includes('trend') || lower.includes('moving average')) {
      const isUp = lower.includes('upward') || lower.includes('bullish') || lower.includes('positive');
      evidence.push({
        evidenceId: `ev:derived:trend:${now}`,
        level: 2, category: 'factor',
        claim: isUp ? `${ticker} shows positive momentum` : `${ticker} momentum indicators active`,
        claimCn: isUp ? `${ticker}动量指标偏多` : `${ticker}动量指标活跃`,
        source: { name: 'AI Analysis', type: 'analysis', publishedAt: now, freshness: 'live' },
        strength: 'moderate',
        direction: isUp ? 'bullish' : 'neutral',
        verifiable: false,
      });
    }

    // Check for news mentions
    if (lower.includes('news') || lower.includes('announce') || lower.includes('report')) {
      evidence.push({
        evidenceId: `ev:derived:news:${now}`,
        level: 2, category: 'news',
        claim: `${ticker} has recent news activity`,
        claimCn: `${ticker}近期有新闻活动`,
        source: { name: 'AI Analysis', type: 'analysis', publishedAt: now, freshness: 'live' },
        strength: 'moderate',
        direction: 'neutral',
        verifiable: true,
        verificationMethod: 'Search news for this ticker',
      });
    }

    // Check for analyst mentions
    if (lower.includes('analyst') || lower.includes('target') || lower.includes('upgrade') || lower.includes('downgrade')) {
      const isUpgrade = lower.includes('upgrade') || lower.includes('raise');
      evidence.push({
        evidenceId: `ev:derived:analyst:${now}`,
        level: 2, category: 'analyst',
        claim: isUpgrade ? `Analyst upgrade for ${ticker}` : `Analyst activity for ${ticker}`,
        claimCn: isUpgrade ? `${ticker}分析师上调评级` : `${ticker}分析师活动`,
        source: { name: 'AI Analysis', type: 'analysis', publishedAt: now, freshness: 'live' },
        strength: isUpgrade ? 'strong' : 'moderate',
        direction: isUpgrade ? 'bullish' : 'neutral',
        verifiable: false,
      });
    }

    // If no evidence parsed, add a generic fallback
    if (evidence.length === 0) {
      evidence.push({
        evidenceId: `ev:derived:general:${now}`,
        level: 3, category: 'sentiment',
        claim: `AI model analysis for ${ticker}`,
        claimCn: `${ticker} AI模型分析`,
        source: { name: 'QUANT MOO AI', type: 'analysis', publishedAt: now, freshness: 'live' },
        strength: 'weak',
        direction: 'neutral',
        verifiable: false,
      });
    }

    return evidence;
  }

  private _initStats(): EvidenceStats {
    return {
      totalChains: 0, totalEvidence: 0, avgEvidencePerChain: 0,
      byCategory: {},
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: AIEvidenceBridge | null = null;

export function aiEvidenceBridge(): AIEvidenceBridge {
  if (!instance) instance = new AIEvidenceBridge();
  return instance;
}

export function resetAIEvidenceBridge(): void { instance = null; }
