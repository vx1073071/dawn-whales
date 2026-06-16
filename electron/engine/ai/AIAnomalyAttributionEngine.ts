/**
 * AIAnomalyAttributionEngine — R258 QUANT MOO P1-04
 *
 * AI 驱动的异动归因引擎。当检测到价格/成交量异动时，
 * 自动分析原因：新闻事件、财报、宏观经济、行业联动、资金面变化。
 *
 * Feature set:
 *   - 7 类归因因子: 财报/新闻/宏观/行业/资金流/技术面/情绪
 *   - 置信度加权排序 (confidence-weighted ranking)
 *   - 多因子叠加检测 (multiple factors can trigger simultaneously)
 *   - 自然语言归因摘要
 *   - 历史异动回溯
 *   - 异动严重度 5 级 (P0-P4)
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Factor registration + weight configuration
 *   - Confidence scoring per factor
 *
 * @author JVS
 * @round R258
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type AttributionFactor =
  | 'earnings'        // 财报
  | 'news'            // 新闻
  | 'macro'           // 宏观经济
  | 'sector'          // 行业联动
  | 'capital_flow'    // 资金流向
  | 'technical'       // 技术面
  | 'sentiment';      // 市场情绪

export type AnomalySeverity = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface AttributionCandidate {
  factor: AttributionFactor;
  confidence: number;   // 0-1
  evidence: string;     // 证据描述
  source?: string;      // 信息来源
  timestamp: number;
}

export interface AnomalyAssessment {
  id: string;
  symbol: string;
  anomalyType: 'price_surge' | 'price_plunge' | 'volume_spike' | 'gap' | 'breakout' | 'breakdown';
  severity: AnomalySeverity;
  changePct: number;
  volumeRatio: number;
  timestamp: number;
  attributions: AttributionCandidate[];
  primaryFactor: AttributionFactor;
  summary: string;        // 自然语言摘要
  recommendation: string; // AI建议
  relatedSymbols: string[]; // 联动标的
  confidence: number;     // 整体归因置信度
}

export interface AttributionRequest {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  recentNews?: string[];
  earningsDate?: string;
  sectorMoves?: Array<{ symbol: string; changePct: number }>;
  marketIndexChange?: number;
}

export interface AttributionConfig {
  weights: Partial<Record<AttributionFactor, number>>;
  minConfidence: number;
  maxAttributions: number;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_FACTOR_WEIGHTS: Record<AttributionFactor, number> = {
  earnings: 0.20,
  news: 0.22,
  macro: 0.15,
  sector: 0.15,
  capital_flow: 0.12,
  technical: 0.10,
  sentiment: 0.06,
};

const FACTOR_LABELS: Record<AttributionFactor, string> = {
  earnings: '财报驱动',
  news: '新闻驱动',
  macro: '宏观驱动',
  sector: '行业联动',
  capital_flow: '资金驱动',
  technical: '技术面',
  sentiment: '情绪驱动',
};

const SEVERITY_THRESHOLDS: Array<{ severity: AnomalySeverity; minAbsPct: number; minVolRatio: number }> = [
  { severity: 'P0', minAbsPct: 15, minVolRatio: 5 },
  { severity: 'P1', minAbsPct: 10, minVolRatio: 3 },
  { severity: 'P2', minAbsPct: 5, minVolRatio: 2 },
  { severity: 'P3', minAbsPct: 3, minVolRatio: 1.5 },
  { severity: 'P4', minAbsPct: 0, minVolRatio: 0 },
];

// ─── Engine ──────────────────────────────────────────────

export class AIAnomalyAttributionEngine extends EventEmitter {
  private static instance: AIAnomalyAttributionEngine;

  private config: AttributionConfig;
  private assessments: AnomalyAssessment[] = [];
  private idCounter = 0;

  constructor(config?: Partial<AttributionConfig>) {
    super();
    this.config = {
      weights: { ...DEFAULT_FACTOR_WEIGHTS, ...(config?.weights ?? {}) },
      minConfidence: config?.minConfidence ?? 0.2,
      maxAttributions: config?.maxAttributions ?? 5,
    };
  }

  static getInstance(config?: Partial<AttributionConfig>): AIAnomalyAttributionEngine {
    if (!AIAnomalyAttributionEngine.instance) {
      AIAnomalyAttributionEngine.instance = new AIAnomalyAttributionEngine(config);
    }
    return AIAnomalyAttributionEngine.instance;
  }

  reset(): void {
    this.assessments = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Main Attribution ──────────────────────────────────

  attribute(req: AttributionRequest): AnomalyAssessment {
    const anomalyType = this.classifyAnomalyType(req);
    const severity = this.classifySeverity(req);
    const attributions = this.runAllFactors(req);
    const primary = this.pickPrimary(attributions);
    const assessment: AnomalyAssessment = {
      id: `attr_${++this.idCounter}`,
      symbol: req.symbol,
      anomalyType,
      severity,
      changePct: req.changePct,
      volumeRatio: req.avgVolume > 0 ? req.volume / req.avgVolume : 0,
      timestamp: Date.now(),
      attributions,
      primaryFactor: primary.factor,
      summary: this.buildSummary(req, primary, attributions, severity),
      recommendation: this.buildRecommendation(anomalyType, severity, primary),
      relatedSymbols: req.sectorMoves?.map(s => s.symbol).slice(0, 5) ?? [],
      confidence: primary.confidence,
    };

    this.assessments.push(assessment);
    this.emit('attribution_complete', assessment);
    return assessment;
  }

  // ─── Classification ────────────────────────────────────

  classifyAnomalyType(req: AttributionRequest): AnomalyAssessment['anomalyType'] {
    const volRatio = req.avgVolume > 0 ? req.volume / req.avgVolume : 1;
    if (req.changePct > 5) return volRatio > 2 ? 'breakout' : 'price_surge';
    if (req.changePct < -5) return volRatio > 2 ? 'breakdown' : 'price_plunge';
    if (volRatio > 3) return 'volume_spike';
    if (Math.abs(req.price / (req.prevClose || req.price) - 1) > 0.02) return 'gap';
    return 'price_surge';
  }

  classifySeverity(req: AttributionRequest): AnomalySeverity {
    const absPct = Math.abs(req.changePct);
    const volRatio = req.avgVolume > 0 ? req.volume / req.avgVolume : 1;
    for (const t of SEVERITY_THRESHOLDS) {
      if (absPct >= t.minAbsPct && volRatio >= t.minVolRatio) return t.severity;
    }
    return 'P4';
  }

  // ─── Factor Analysis ───────────────────────────────────

  private runAllFactors(req: AttributionRequest): AttributionCandidate[] {
    const candidates: AttributionCandidate[] = [];

    candidates.push(this.analyzeEarnings(req));
    candidates.push(this.analyzeNews(req));
    candidates.push(this.analyzeMacro(req));
    candidates.push(this.analyzeSector(req));
    candidates.push(this.analyzeCapitalFlow(req));
    candidates.push(this.analyzeTechnical(req));
    candidates.push(this.analyzeSentiment(req));

    return candidates
      .filter(c => c.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxAttributions);
  }

  private analyzeEarnings(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    let confidence = 0.1;
    let evidence = '无明显财报驱动';

    if (req.earningsDate) {
      const daysToEarnings = Math.abs(Date.now() - new Date(req.earningsDate).getTime()) / 86400000;
      if (daysToEarnings <= 3) {
        confidence = 0.85;
        evidence = daysToEarnings <= 1 ? '财报日在即或已发布' : '财报日临近';
      } else if (daysToEarnings <= 7) {
        confidence = 0.5;
        evidence = '财报窗口期';
      }
    }

    return { factor: 'earnings', confidence, evidence, timestamp: now };
  }

  private analyzeNews(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    const hasNews = (req.recentNews?.length ?? 0) > 0;
    return {
      factor: 'news',
      confidence: hasNews ? 0.75 : 0.15,
      evidence: hasNews ? `关联新闻 ${req.recentNews!.length} 条` : '无明显新闻驱动',
      timestamp: now,
    };
  }

  private analyzeMacro(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    const mktChange = Math.abs(req.marketIndexChange ?? 0);
    const confidence = mktChange > 1 ? 0.6 : mktChange > 0.5 ? 0.35 : 0.1;
    return {
      factor: 'macro',
      confidence,
      evidence: mktChange > 0.5 ? `大盘波动 ${(req.marketIndexChange ?? 0).toFixed(1)}%` : '无明显宏观驱动',
      timestamp: now,
    };
  }

  private analyzeSector(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    const sectorMoves = req.sectorMoves ?? [];
    const sameDirection = sectorMoves.filter(s =>
      s.changePct * req.changePct > 0
    );
    const confidence = sectorMoves.length > 0
      ? Math.min(0.8, 0.3 + sameDirection.length / sectorMoves.length * 0.5)
      : 0.1;
    return {
      factor: 'sector',
      confidence,
      evidence: sectorMoves.length > 0 ? `板块 ${sameDirection.length}/${sectorMoves.length} 同向` : '无行业联动数据',
      timestamp: now,
    };
  }

  private analyzeCapitalFlow(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    const volRatio = req.avgVolume > 0 ? req.volume / req.avgVolume : 1;
    const confidence = volRatio > 3 ? 0.7 : volRatio > 2 ? 0.45 : volRatio > 1.5 ? 0.25 : 0.1;
    return {
      factor: 'capital_flow',
      confidence,
      evidence: confidence > 0.4 ? `成交量比率 ${volRatio.toFixed(1)}x` : '资金面正常',
      timestamp: now,
    };
  }

  private analyzeTechnical(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    const absChange = Math.abs(req.changePct);
    const confidence = absChange > 5 ? 0.5 : 0.2;
    return {
      factor: 'technical',
      confidence,
      evidence: confidence > 0.3 ? `技术面突破信号` : '技术面无明显信号',
      timestamp: now,
    };
  }

  private analyzeSentiment(req: AttributionRequest): AttributionCandidate {
    const now = Date.now();
    const absChange = Math.abs(req.changePct);
    const confidence = absChange > 7 ? 0.65 : absChange > 5 ? 0.4 : absChange > 3 ? 0.2 : 0.05;
    return {
      factor: 'sentiment',
      confidence,
      evidence: confidence > 0.3 ? `大幅波动引发情绪` : '情绪面稳定',
      timestamp: now,
    };
  }

  // ─── Primary Factor ────────────────────────────────────

  private pickPrimary(attributions: AttributionCandidate[]): AttributionCandidate {
    if (attributions.length === 0) {
      return { factor: 'technical', confidence: 0.1, evidence: '无显著归因', timestamp: Date.now() };
    }
    return attributions[0];
  }

  // ─── NLP Summaries ─────────────────────────────────────

  private buildSummary(req: AttributionRequest, primary: AttributionCandidate, all: AttributionCandidate[], severity: AnomalySeverity): string {
    const direction = req.changePct > 0 ? '上涨' : '下跌';
    const factorLabel = FACTOR_LABELS[primary.factor];
    let summary = `${req.symbol} ${direction} ${Math.abs(req.changePct).toFixed(1)}%，主要由${factorLabel}推动`;

    const secondary = all.slice(1, 3);
    if (secondary.length > 0) {
      const secLabels = secondary.map(s => FACTOR_LABELS[s.factor]).join('、');
      summary += `，叠加${secLabels}因素`;
    }

    summary += `，严重度: ${severity}`;
    return summary;
  }

  private buildRecommendation(anomalyType: string, severity: AnomalySeverity, primary: AttributionCandidate): string {
    if (severity === 'P0') return '极端异动，建议暂停该标的交易并密切关注';
    if (severity === 'P1') return '严重异动，建议设置止损并减少仓位';
    if (severity === 'P2') return `中度异动(${FACTOR_LABELS[primary.factor]})，建议关注基本面变化`;
    if (anomalyType === 'volume_spike') return '成交量异动，注意后续方向确认';
    return '轻微波动，保持观望';
  }

  // ─── History ───────────────────────────────────────────

  getAssessments(symbol?: string, limit = 20): AnomalyAssessment[] {
    let list = symbol ? this.assessments.filter(a => a.symbol === symbol) : this.assessments;
    return list.slice(-limit);
  }

  getLatestAssessment(symbol: string): AnomalyAssessment | undefined {
    return [...this.assessments].reverse().find(a => a.symbol === symbol);
  }

  getSeverityBreakdown(): Record<AnomalySeverity, number> {
    const breakdown: Record<AnomalySeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const a of this.assessments) breakdown[a.severity]++;
    return breakdown;
  }

  // ─── Batch ─────────────────────────────────────────────

  attributeBatch(reqs: AttributionRequest[]): AnomalyAssessment[] {
    return reqs.map(r => this.attribute(r));
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockRequests(): AttributionRequest[] {
    return [
      {
        symbol: 'AAPL', price: 195, prevClose: 189, changePct: 3.2,
        volume: 75000000, avgVolume: 48000000,
        recentNews: ['Apple 发布新一代 M4 芯片'], earningsDate: '2026-06-22',
        sectorMoves: [{ symbol: 'MSFT', changePct: 2.1 }, { symbol: 'GOOG', changePct: 1.8 }],
        marketIndexChange: 1.2,
      },
      {
        symbol: 'TSLA', price: 220, prevClose: 238, changePct: -7.5,
        volume: 180000000, avgVolume: 95000000,
        recentNews: ['特斯拉中国销量下滑', '欧盟加征电动车关税'],
        sectorMoves: [{ symbol: 'NIO', changePct: -5 }, { symbol: 'RIVN', changePct: -4 }],
        marketIndexChange: -0.8,
      },
      {
        symbol: 'NVDA', price: 880, prevClose: 855, changePct: 2.9,
        volume: 42000000, avgVolume: 38000000,
        sectorMoves: [{ symbol: 'AMD', changePct: 1.5 }, { symbol: 'INTC', changePct: 0.5 }],
        marketIndexChange: 0.8,
      },
    ];
  }
}
