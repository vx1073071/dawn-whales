/**
 * AIDecisionLogEngine — R263 P1-03
 *
 * AI决策日志引擎。每次AI推荐附带完整思考链: 触发因子×权重 + 不确定性标注。
 *
 * Feature set:
 *   - 决策条目: 输入参数+触发因子+因子权重+中间推理+最终结论
 *   - 因子溯源: 每因子来源(技术面/基本面/资金流/情绪/板块/宏观)
 *   - 不确定性: confidence区间+knownUnknowns+assumptions
 *   - 决策追溯: 查询历史决策+对比结果+复盘
 *   - 日志审计: 可读/可导出/可回放
 *   - 权重可视化: 因子权重堆叠
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Per-decision structured log tree
 *   - Factor × weight × reasoning chain
 *
 * @author JVS
 * @round R263
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type FactorSource = 'technical' | 'fundamental' | 'fund_flow' | 'sentiment' | 'sector' | 'macro' | 'ai_derived' | 'user_override';

export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

export type DecisionAction = 'buy' | 'sell' | 'hold' | 'rebalance' | 'watch' | 'ignore';

export interface FactorWeight {
  factorId: string;
  name: string;
  weight: number;        // 0-1
  source: FactorSource;
  value: number;         // raw factor value
  normalized: number;    // 0-1 normalized
  contribution: number;  // weight × normalized
  reasoning: string;     // human-readable
}

export interface Uncertainty {
  confidenceLevel: ConfidenceLevel;
  confidenceInterval: [number, number];  // lower/upper bound
  knownUnknowns: string[];   // things we know we don't know
  assumptions: string[];     // explicit assumptions
  dataQualityScore: number;  // 0-1
  modelRiskNote?: string;
}

export interface DecisionNode {
  id: string;
  parentId?: string;
  symbol: string;
  action: DecisionAction;
  factors: FactorWeight[];
  uncertainty: Uncertainty;
  reasoningChain: string[];
  conclusion: string;
  createdAt: number;
  expiresAt?: number;
  result?: DecisionResult;
}

export interface DecisionResult {
  actualOutcome: number;       // actual return %
  decisionQuality: 'good' | 'neutral' | 'poor' | 'unknown';
  hindsightNote?: string;
  resolvedAt?: number;
}

export interface DecisionLogConfig {
  maxEntries: number;
  autoExpireHours: number;
  enableAutoReview: boolean;
}

export interface DecisionLogStats {
  totalDecisions: number;
  byAction: Record<string, number>;
  byConfidence: Record<ConfidenceLevel, number>;
  bySource: Record<FactorSource, number>;
  averageFactorsPerDecision: number;
  goodDecisions: number;
  poorDecisions: number;
  unresolvedDecisions: number;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: DecisionLogConfig = {
  maxEntries: 10000,
  autoExpireHours: 720,  // 30 days
  enableAutoReview: true,
};

// ─── Engine ──────────────────────────────────────────────

export class AIDecisionLogEngine extends EventEmitter {
  private static instance: AIDecisionLogEngine;

  private config: DecisionLogConfig;
  private decisions: DecisionNode[] = [];
  private decisionIndex: Map<string, number> = new Map(); // id → index
  private idCounter = 0;

  constructor(config?: Partial<DecisionLogConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<DecisionLogConfig>): AIDecisionLogEngine {
    if (!AIDecisionLogEngine.instance) {
      AIDecisionLogEngine.instance = new AIDecisionLogEngine(config);
    } else if (config) {
      AIDecisionLogEngine.instance.config = { ...AIDecisionLogEngine.instance.config, ...config };
    }
    return AIDecisionLogEngine.instance;
  }

  reset(): void {
    this.decisions = [];
    this.decisionIndex.clear();
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Decision Logging ───────────────────────────────────

  logDecision(params: {
    symbol: string;
    action: DecisionAction;
    factors: Omit<FactorWeight, 'contribution'>[];
    reasoningChain: string[];
    conclusion: string;
    uncertainty: Omit<Uncertainty, 'dataQualityScore' | 'confidenceInterval'> & { confidenceInterval?: [number, number]; dataQualityScore?: number };
    parentId?: string;
    expiresAt?: number;
  }): DecisionNode {
    const id = `dl_${++this.idCounter}_${params.symbol}`;

    // Compute contributions
    const totalWeight = params.factors.reduce((s, f) => s + f.weight, 0);
    const factors: FactorWeight[] = params.factors.map(f => ({
      ...f,
      normalized: Math.min(1, Math.max(0, f.normalized)),
      contribution: totalWeight > 0 ? (f.weight / totalWeight) * f.normalized : 0,
    }));

    const uncertainty: Uncertainty = {
      confidenceLevel: params.uncertainty.confidenceLevel,
      confidenceInterval: params.uncertainty.confidenceInterval || [0, 1],
      knownUnknowns: params.uncertainty.knownUnknowns || [],
      assumptions: params.uncertainty.assumptions || [],
      dataQualityScore: params.uncertainty.dataQualityScore ?? 0.8,
      modelRiskNote: params.uncertainty.modelRiskNote,
    };

    const decision: DecisionNode = {
      id, symbol: params.symbol, action: params.action,
      factors, uncertainty,
      reasoningChain: params.reasoningChain,
      conclusion: params.conclusion,
      createdAt: Date.now(),
      parentId: params.parentId,
      expiresAt: params.expiresAt,
    };

    this.decisions.push(decision);
    this.decisionIndex.set(id, this.decisions.length - 1);

    // Prune old
    if (this.decisions.length > this.config.maxEntries) {
      const removed = this.decisions.shift();
      if (removed) this.decisionIndex.delete(removed.id);
    }

    this.emit('decision_logged', decision);
    return decision;
  }

  // ─── Factor Builder ─────────────────────────────────────

  /**
   * Builder to construct factor arrays with fluently.
   */
  createFactor(params: {
    factorId: string; name: string; weight: number;
    source: FactorSource; value: number; normalized?: number; reasoning: string;
  }): Omit<FactorWeight, 'contribution'> {
    return {
      factorId: params.factorId, name: params.name,
      weight: Math.min(1, Math.max(0, params.weight)),
      source: params.source, value: params.value,
      normalized: params.normalized ?? this.minMaxNormalize(params.value, -10, 10),
      reasoning: params.reasoning,
    };
  }

  private minMaxNormalize(value: number, min: number, max: number): number {
    if (max <= min) return 0.5;
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  }

  // ─── Result Resolution ──────────────────────────────────

  resolveDecision(decisionId: string, actualOutcome: number, quality?: DecisionResult['decisionQuality'], hindsightNote?: string): boolean {
    const idx = this.decisionIndex.get(decisionId);
    if (idx === undefined || !this.decisions[idx]) return false;

    const decision = this.decisions[idx];
    decision.result = {
      actualOutcome,
      decisionQuality: quality || this.inferQuality(actualOutcome),
      hindsightNote, resolvedAt: Date.now(),
    };

    this.emit('decision_resolved', decision);
    return true;
  }

  private inferQuality(returnPct: number): DecisionResult['decisionQuality'] {
    if (returnPct > 2) return 'good';
    if (returnPct < -2) return 'poor';
    return 'neutral';
  }

  // ─── Query ──────────────────────────────────────────────

  getDecision(id: string): DecisionNode | null {
    const idx = this.decisionIndex.get(id);
    return idx !== undefined ? this.decisions[idx] || null : null;
  }

  getDecisionsBySymbol(symbol: string, limit = 50): DecisionNode[] {
    return this.decisions.filter(d => d.symbol === symbol).slice(-limit);
  }

  getDecisionsByAction(action: DecisionAction, limit = 50): DecisionNode[] {
    return this.decisions.filter(d => d.action === action).slice(-limit);
  }

  getDecisionsByFactorSource(source: FactorSource, limit = 50): DecisionNode[] {
    return this.decisions.filter(d => d.factors.some(f => f.source === source)).slice(-limit);
  }

  getUnresolvedDecisions(): DecisionNode[] {
    return this.decisions.filter(d => !d.result);
  }

  getRecentDecisions(limit = 20): DecisionNode[] {
    return this.decisions.slice(-limit);
  }

  // ─── Auditing ───────────────────────────────────────────

  /**
   * Generate a readable audit trail for a decision.
   */
  generateAuditTrail(decisionId: string): string | null {
    const d = this.getDecision(decisionId);
    if (!d) return null;

    const lines: string[] = [];
    lines.push(`=== AI Decision Audit Trail ===`);
    lines.push(`ID: ${d.id}`);
    lines.push(`Symbol: ${d.symbol} | Action: ${d.action}`);
    lines.push(`Time: ${new Date(d.createdAt).toISOString()}`);
    lines.push(``);
    lines.push(`--- Factors (${d.factors.length}) ---`);
    for (const f of d.factors) {
      lines.push(`  ${f.name} [${f.source}] w=${f.weight.toFixed(2)} val=${f.value} contrib=${f.contribution.toFixed(3)}`);
      lines.push(`    Reason: ${f.reasoning}`);
    }
    lines.push(``);
    lines.push(`--- Reasoning Chain ---`);
    for (let i = 0; i < d.reasoningChain.length; i++) {
      lines.push(`  Step ${i + 1}: ${d.reasoningChain[i]}`);
    }
    lines.push(``);
    lines.push(`--- Uncertainty ---`);
    lines.push(`  Confidence: ${d.uncertainty.confidenceLevel} (${d.uncertainty.confidenceInterval[0]}-${d.uncertainty.confidenceInterval[1]})`);
    lines.push(`  Known Unknowns: ${d.uncertainty.knownUnknowns.join(', ') || '(none)'}`);
    lines.push(`  Assumptions: ${d.uncertainty.assumptions.join(', ') || '(none)'}`);
    lines.push(`  Data Quality: ${(d.uncertainty.dataQualityScore * 100).toFixed(0)}%`);
    if (d.uncertainty.modelRiskNote) lines.push(`  Model Risk: ${d.uncertainty.modelRiskNote}`);
    lines.push(``);
    lines.push(`--- Conclusion ---`);
    lines.push(`  ${d.conclusion}`);

    if (d.result) {
      lines.push(``);
      lines.push(`--- Result ---`);
      lines.push(`  Outcome: ${d.result.actualOutcome > 0 ? '+' : ''}${d.result.actualOutcome.toFixed(2)}%`);
      lines.push(`  Quality: ${d.result.decisionQuality}`);
      if (d.result.hindsightNote) lines.push(`  Hindsight: ${d.result.hindsightNote}`);
    }

    return lines.join('\n');
  }

  // ─── Stats ──────────────────────────────────────────────

  getStats(): DecisionLogStats {
    const byAction: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalFactors = 0;
    let good = 0; let poor = 0; let unresolved = 0;

    for (const d of this.decisions) {
      byAction[d.action] = (byAction[d.action] || 0) + 1;
      byConfidence[d.uncertainty.confidenceLevel] = (byConfidence[d.uncertainty.confidenceLevel] || 0) + 1;
      for (const f of d.factors) {
        bySource[f.source] = (bySource[f.source] || 0) + 1;
        totalFactors++;
      }
      if (d.result) {
        if (d.result.decisionQuality === 'good') good++;
        else if (d.result.decisionQuality === 'poor') poor++;
      } else {
        unresolved++;
      }
    }

    return {
      totalDecisions: this.decisions.length,
      byAction, byConfidence, bySource,
      averageFactorsPerDecision: this.decisions.length > 0 ? totalFactors / this.decisions.length : 0,
      goodDecisions: good, poorDecisions: poor,
      unresolvedDecisions: unresolved,
    };
  }

  getDecisionCount(): number { return this.decisions.length; }

  // ─── Auto Review ────────────────────────────────────────

  autoExpireOldDecisions(): number {
    if (!this.config.enableAutoReview) return 0;
    const cutoff = Date.now() - this.config.autoExpireHours * 3600000;
    let expired = 0;
    for (const d of this.decisions) {
      if (d.createdAt < cutoff && !d.result && !d.expiresAt) {
        d.expiresAt = cutoff;
        expired++;
      }
    }
    return expired;
  }

  // ─── Mock ────────────────────────────────────────────────

  logMockMultifactorDecision(symbol: string, action: DecisionAction): DecisionNode {
    return this.logDecision({
      symbol, action,
      factors: [
        this.createFactor({ factorId: 'rsi_14', name: 'RSI(14)', weight: 0.25, source: 'technical', value: 65, reasoning: 'RSI接近超买区，但未进入极端' }),
        this.createFactor({ factorId: 'macd', name: 'MACD交叉', weight: 0.20, source: 'technical', value: 0.8, reasoning: 'MACD金叉，短期动能向上' }),
        this.createFactor({ factorId: 'vol_ratio', name: '量比', weight: 0.15, source: 'fund_flow', value: 1.5, reasoning: '成交量放大1.5倍，资金流入信号' }),
        this.createFactor({ factorId: 'sent_score', name: '情绪分', weight: 0.15, source: 'sentiment', value: 0.7, reasoning: '新闻情绪偏正面，评分0.7' }),
        this.createFactor({ factorId: 'sector_mo', name: '板块动量', weight: 0.15, source: 'sector', value: 0.4, reasoning: '板块动量中性' }),
        this.createFactor({ factorId: 'macro_vix', name: 'VIX', weight: 0.10, source: 'macro', value: 18, reasoning: 'VIX低于20，市场风险偏好正常' }),
      ],
      reasoningChain: [
        '第1步：扫描6个因子，技术面RSI偏高但MACD金叉形成',
        '第2步：资金面成交量放大，有资金流入',
        '第3步：情绪面偏正面，新闻无重大利空',
        '第4步：板块动量中性，宏观环境稳定',
        '第5步：综合6因子加权得分=0.62，置信度中等偏高',
      ],
      conclusion: `${symbol}当前技术面强势，资金面流入，建议${action === 'buy' ? '买入' : '持有'}。但RSI偏高，需注意回调风险。`,
      uncertainty: {
        confidenceLevel: 'medium',
        knownUnknowns: ['财报尚未公布', '美联储利率决议在即'],
        assumptions: ['当前趋势延续', '无黑天鹅事件'],
        dataQualityScore: 0.75,
        modelRiskNote: '多因子模型未覆盖地缘政治风险',
      },
    });
  }
}
