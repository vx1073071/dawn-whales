/**
 * R249 P2-29: AI可质疑机制 (AIQuestionableEngine)
 * 
 * 让用户能质疑/挑战AI决策，建立双向信任：
 *   - AI决策记录 (why/how/what → 可追溯)
 *   - 用户反馈 (赞同/质疑/纠正)
 *   - 争议升级 (三级：AI自查→专家审核→人工裁决)
 *   - 学习闭环 (反馈→模型提示调整→下次改进)
 *   - 质疑历史 (每项决策的争议记录)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type DecisionType =
  | 'strategy_recommendation'
  | 'factor_suggestion'
  | 'risk_warning'
  | 'market_prediction'
  | 'parameter_tuning'
  | 'backtest_interpretation'
  | 'news_sentiment'
  | 'price_move_attribution'
  | 'portfolio_rebalance'
  | 'entry_exit_signal';

export type FeedbackAction = 'agree' | 'disagree' | 'correct';
export type DisputeStatus = 'pending' | 'ai_self_review' | 'expert_review' | 'manual_adjudication' | 'resolved';
export type DisputeResolution = 'ai_upheld' | 'ai_corrected' | 'user_correct' | 'split_difference' | 'escalated_to_human';

export interface AIDecision {
  decisionId: string;
  userId: string;
  type: DecisionType;
  context: {
    symbol?: string;
    market?: string;
    input: Record<string, unknown>;
    reasoning: string;              // AI's reasoning chain
  };
  output: {
    result: string;
    confidence: number;            // 0-1
    alternatives: string[];
    dataSources: string[];         // raw data used
  };
  feedback?: DecisionFeedback;
  disputes: DecisionDispute[];
  createdAt: number;
  updatedAt: number;
}

export interface DecisionFeedback {
  action: FeedbackAction;
  userId: string;
  comment?: string;
  correction?: string;             // if action=correct, what should it be
  confidenceShift?: number;        // new confidence after feedback
  createdAt: number;
  tags?: string[];                 // e.g. ["overly_optimistic", "ignored_risk", "good_call"]
}

export interface DecisionDispute {
  disputeId: string;
  raisedById: string;
  reason: string;
  suggestedCorrection?: string;
  severity: 'minor' | 'moderate' | 'critical';
  status: DisputeStatus;
  aiSelfReview?: {
    evaluation: string;
    confidenceAdjustment: number;
    errorDetected: boolean;
    notes: string;
  };
  expertReview?: {
    reviewerId: string;
    verdict: string;
    recommendation: string;
    reviewedAt: number;
  };
  finalResolution?: {
    resolution: DisputeResolution;
    resolvedBy: string;
    explanation: string;
    resolvedAt: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackStats {
  totalDecisions: number;
  agreementRate: number;
  totalDisputes: number;
  aiCorrectedRate: number;
  avgConfidence: number;
  confidenceAfterFeedback: number;
  perType: Record<string, { decisions: number; agrees: number; disputes: number; corrections: number }>;
}

export interface LearningInsight {
  insightId: string;
  pattern: string;
  description: string;
  descriptionCn: string;
  evidence: string[];
  suggestion: string;
  suggestionCn: string;
  confidence: number;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// AIQuestionableEngine
// ═══════════════════════════════════════════════════════════════════════════

export class AIQuestionableEngine {
  private decisions: Map<string, AIDecision> = new Map();
  private learningInsights: LearningInsight[] = [];

  constructor() {
    this._seedLearningInsights();
  }

  // ── Public API: Record AI Decision ─────────────────────────────────────

  /**
   * Record an AI decision so users can later challenge it.
   * This should be called every time AI makes a recommendation.
   */
  recordDecision(
    userId: string,
    type: DecisionType,
    context: AIDecision['context'],
    output: AIDecision['output'],
  ): AIDecision {
    const decision: AIDecision = {
      decisionId: `ai-dec:${type}:${Date.now()}:${this._hash(JSON.stringify(context.input)).toString(36).slice(0, 6)}`,
      userId, type, context, output,
      disputes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.decisions.set(decision.decisionId, decision);
    return decision;
  }

  // ── Public API: Feedback ────────────────────────────────────────────────

  /**
   * User provides feedback on an AI decision.
   * action: agree, disagree, or correct (with correction)
   */
  provideFeedback(
    decisionId: string,
    userId: string,
    feedback: {
      action: FeedbackAction;
      comment?: string;
      correction?: string;
      tags?: string[];
    },
  ): AIDecision | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    // Confidence shift based on feedback
    let confidenceShift: number;
    switch (feedback.action) {
      case 'agree': confidenceShift = 0.02; break;
      case 'disagree': confidenceShift = -0.15; break;
      case 'correct': confidenceShift = -0.25; break;
    }

    decision.feedback = {
      action: feedback.action,
      userId,
      comment: feedback.comment,
      correction: feedback.correction,
      confidenceShift,
      createdAt: Date.now(),
      tags: feedback.tags,
    };

    decision.updatedAt = Date.now();
    return decision;
  }

  // ── Public API: Dispute (Challenge AI) ──────────────────────────────────

  /**
   * User raises a formal dispute on an AI decision.
   * This triggers a 3-level review process.
   */
  raiseDispute(
    decisionId: string,
    userId: string,
    dispute: {
      reason: string;
      suggestedCorrection?: string;
      severity: 'minor' | 'moderate' | 'critical';
    },
  ): DecisionDispute | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    const d: DecisionDispute = {
      disputeId: `dispute:${decision.decisionId}:${Date.now()}`,
      raisedById: userId,
      reason: dispute.reason,
      suggestedCorrection: dispute.suggestedCorrection,
      severity: dispute.severity,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    decision.disputes.push(d);
    decision.updatedAt = Date.now();
    return d;
  }

  /**
   * Level 1: AI self-review.
   * AI re-evaluates its own decision based on the dispute reason.
   */
  aiSelfReview(
    decisionId: string,
    disputeId: string,
    evaluation: { errorDetected: boolean; evaluation: string; confidenceAdjustment: number; notes: string },
  ): DecisionDispute | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    const dispute = decision.disputes.find(d => d.disputeId === disputeId);
    if (!dispute || dispute.status !== 'pending') return null;

    dispute.aiSelfReview = evaluation;
    dispute.status = evaluation.errorDetected ? 'resolved' : 'expert_review';
    dispute.updatedAt = Date.now();

    if (evaluation.errorDetected) {
      dispute.finalResolution = {
        resolution: 'ai_corrected',
        resolvedBy: 'ai_self',
        explanation: evaluation.notes,
        resolvedAt: Date.now(),
      };
    }

    return dispute;
  }

  /**
   * Level 2: Expert review.
   * Human expert reviews the dispute.
   */
  expertReview(
    decisionId: string,
    disputeId: string,
    reviewerId: string,
    verdict: { verdict: string; recommendation: string },
  ): DecisionDispute | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    const dispute = decision.disputes.find(d => d.disputeId === disputeId);
    if (!dispute || dispute.status !== 'expert_review') return null;

    dispute.expertReview = {
      reviewerId,
      verdict: verdict.verdict,
      recommendation: verdict.recommendation,
      reviewedAt: Date.now(),
    };

    // If expert agrees with AI, resolve. If not, escalate to manual.
    if (verdict.verdict === 'ai_correct') {
      dispute.status = 'resolved';
      dispute.finalResolution = {
        resolution: 'ai_upheld',
        resolvedBy: reviewerId,
        explanation: verdict.recommendation,
        resolvedAt: Date.now(),
      };
    } else if (verdict.verdict === 'user_correct') {
      dispute.status = 'resolved';
      dispute.finalResolution = {
        resolution: 'user_correct',
        resolvedBy: reviewerId,
        explanation: verdict.recommendation,
        resolvedAt: Date.now(),
      };
    } else {
      dispute.status = 'manual_adjudication';
    }

    dispute.updatedAt = Date.now();
    return dispute;
  }

  /**
   * Level 3: Manual adjudication (final).
   */
  manualAdjudication(
    decisionId: string,
    disputeId: string,
    adjudicatorId: string,
    resolution: { resolution: DisputeResolution; explanation: string },
  ): DecisionDispute | null {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    const dispute = decision.disputes.find(d => d.disputeId === disputeId);
    if (!dispute || dispute.status !== 'manual_adjudication') return null;

    dispute.status = 'resolved';
    dispute.finalResolution = {
      resolution: resolution.resolution,
      resolvedBy: adjudicatorId,
      explanation: resolution.explanation,
      resolvedAt: Date.now(),
    };

    dispute.updatedAt = Date.now();
    return dispute;
  }

  // ── Public API: Queries ─────────────────────────────────────────────────

  /** Get all decisions for a user */
  getUserDecisions(userId: string, options?: { type?: DecisionType; limit?: number; hasDisputes?: boolean }): AIDecision[] {
    let results = Array.from(this.decisions.values()).filter(d => d.userId === userId);
    if (options?.type) results = results.filter(d => d.type === options.type);
    if (options?.hasDisputes !== undefined) {
      results = results.filter(d => d.disputes.length > 0 === options.hasDisputes);
    }
    return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, options?.limit ?? 50);
  }

  /** Get a specific decision */
  getDecision(decisionId: string): AIDecision | null {
    return this.decisions.get(decisionId) ?? null;
  }

  /** Get pending disputes */
  getPendingDisputes(): Array<{ decision: AIDecision; dispute: DecisionDispute }> {
    const results: Array<{ decision: AIDecision; dispute: DecisionDispute }> = [];
    for (const decision of this.decisions.values()) {
      for (const dispute of decision.disputes) {
        if (dispute.status !== 'resolved') {
          results.push({ decision, dispute });
        }
      }
    }
    return results.sort((a, b) => b.dispute.createdAt - a.dispute.createdAt);
  }

  /** Get feedback statistics */
  getFeedbackStats(userId?: string): FeedbackStats {
    const decisions = userId
      ? Array.from(this.decisions.values()).filter(d => d.userId === userId)
      : Array.from(this.decisions.values());

    const totalDecisions = decisions.length;
    const withFeedback = decisions.filter(d => d.feedback);
    const agrees = withFeedback.filter(d => d.feedback!.action === 'agree').length;
    const disagreements = withFeedback.filter(d => d.feedback!.action === 'disagree').length;
    const corrections = withFeedback.filter(d => d.feedback!.action === 'correct').length;
    const totalDisputes = decisions.reduce((s, d) => s + d.disputes.length, 0);
    const aiCorrectedDisputes = decisions.reduce((s, d) => s + d.disputes.filter(dp => dp.finalResolution?.resolution === 'ai_corrected' || dp.finalResolution?.resolution === 'user_correct').length, 0);

    const avgConfidence = totalDecisions > 0
      ? decisions.reduce((s, d) => s + d.output.confidence, 0) / totalDecisions
      : 0;

    const confidenceAfterFeedback = withFeedback.filter(d => d.feedback!.action !== 'agree').length > 0
      ? totalDecisions > 0
        ? decisions.reduce((s, d) => s + (d.feedback?.confidenceShift ? d.output.confidence + d.feedback.confidenceShift : d.output.confidence), 0) / totalDecisions
        : 0
      : avgConfidence;

    const perType: Record<string, { decisions: number; agrees: number; disputes: number; corrections: number }> = {};
    for (const d of decisions) {
      if (!perType[d.type]) perType[d.type] = { decisions: 0, agrees: 0, disputes: 0, corrections: 0 };
      perType[d.type].decisions++;
      if (d.feedback?.action === 'agree') perType[d.type].agrees++;
      if (d.feedback?.action === 'correct') perType[d.type].corrections++;
      perType[d.type].disputes += d.disputes.length;
    }

    return {
      totalDecisions,
      agreementRate: totalDecisions > 0 ? Math.round(agrees / totalDecisions * 1000) / 10 : 0,
      totalDisputes,
      aiCorrectedRate: totalDisputes > 0 ? Math.round(aiCorrectedDisputes / totalDisputes * 1000) / 10 : 0,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      confidenceAfterFeedback: Math.round(confidenceAfterFeedback * 100) / 100,
      perType,
    };
  }

  // ── Public API: Learning Insights ───────────────────────────────────────

  /**
   * Get learning insights derived from feedback patterns.
   */
  getLearningInsights(limit = 5): LearningInsight[] {
    return this.learningInsights.slice(0, limit);
  }

  /**
   * Generate a new learning insight from feedback data.
   */
  generateInsight(
    pattern: string, description: string, descriptionCn: string,
    evidence: string[], suggestion: string, suggestionCn: string,
    confidence = 0.7,
  ): LearningInsight {
    const insight: LearningInsight = {
      insightId: `insight:${Date.now()}:${this._hash(pattern).toString(36).slice(0, 6)}`,
      pattern, description, descriptionCn, evidence, suggestion, suggestionCn,
      confidence, createdAt: Date.now(),
    };
    this.learningInsights.unshift(insight);
    // Keep top 20
    if (this.learningInsights.length > 20) this.learningInsights = this.learningInsights.slice(0, 20);
    return insight;
  }

  // ── Public API: Export ─────────────────────────────────────────────────

  /** Export all decisions as JSON */
  exportAll(): AIDecision[] {
    return Array.from(this.decisions.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Reset */
  reset(): void {
    this.decisions.clear();
    this.learningInsights.length = 0;
    this._seedLearningInsights();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _seedLearningInsights(): void {
    const seedInsights: Omit<LearningInsight, 'insightId' | 'createdAt'>[] = [
      {
        pattern: 'overly_optimistic_strategy', confidence: 0.72,
        description: 'AI tends to overestimate strategy returns 15-20% above actual backtest results.',
        descriptionCn: 'AI倾向高估策略收益15-20%，高于实际回测结果。',
        evidence: ['avg overestimation 18% across 47 strategies', 'momentum strategies most affected'],
        suggestion: 'Apply 0.85x multiplier to AI-predicted returns for momentum strategies.',
        suggestionCn: '对动量策略的AI预测收益应用0.85倍乘数。',
      },
      {
        pattern: 'crypto_vol_underestimate', confidence: 0.68,
        description: 'AI underestimates crypto market volatility by 25-30% in risk projections.',
        descriptionCn: 'AI在风险预测中低估加密市场波动率25-30%。',
        evidence: ['25 cases of VaR underestimation in crypto strategies', 'larger gaps during high vol regimes'],
        suggestion: 'Apply 1.3x multiplier to crypto volatility estimates.',
        suggestionCn: '对加密波动率估算应用1.3倍乘数。',
      },
      {
        pattern: 'earnings_miss_poor_attribution', confidence: 0.55,
        description: 'AI often attributes earnings-miss price moves to wrong causes (news vs fundamentals confusion).',
        descriptionCn: 'AI常用错误原因归因盈利不及预期的价格变动（新闻vs基本面混淆）。',
        evidence: ['12 disputed attributions', '8 corrections confirmed by expert review'],
        suggestion: 'Add explicit earnings-date check before attributing price moves.',
        suggestionCn: '在归因价格变动前增加显式盈利日期检查。',
      },
    ];

    for (const si of seedInsights) {
      this.learningInsights.push({
        ...si,
        insightId: `insight:seed:${Date.now()}:${this._hash(si.pattern).toString(36).slice(0, 6)}`,
        createdAt: Date.now(),
      });
    }
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: AIQuestionableEngine | null = null;

export function aiQuestionableEngine(): AIQuestionableEngine {
  if (!instance) instance = new AIQuestionableEngine();
  return instance;
}

export function resetAIQuestionableEngine(): void { instance = null; }
