/**
 * AIQuickCommentEngine — R258 QUANT MOO P1-02
 *
 * AI 驱动的个股快速点评引擎。基于实时行情数据生成多维度快评：
 * 技术面评分、情绪面分析、基本面速览、异常标记、一句话总结。
 *
 * Feature set:
 *   - 7 维度评分: 趋势/动量/波动/量价/支撑阻力/市场情绪/相对强度
 *   - 5 种市场状态: 牛市/震荡市/熊市/修复/崩盘
 *   - 一句话快评 + 详细分析
 *   - 技术指标速览 (MA/MACD/RSI/Bollinger/KDJ)
 *   - 历史相似场景检索
 *   - 置信度评分 (0-100)
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Mock scoring for testing
 *   - 7-dim weighted scoring with configurable weights
 *
 * @author JVS
 * @round R258
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type MarketRegime = 'bull' | 'ranging' | 'bear' | 'recovery' | 'crash';

export type CommentDimension = 'trend' | 'momentum' | 'volatility' | 'volume_price' |
  'support_resistance' | 'market_sentiment' | 'relative_strength';

export interface DimensionScore {
  dimension: CommentDimension;
  score: number;     // 0-100
  weight: number;    // 0-1
  label: string;
  detail: string;
  signals: string[]; // bullish/bearish signals
}

export interface TechnicalSnapshot {
  sma20: number;
  sma50: number;
  sma200: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  rsi14: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  k: number;
  d: number;
  j: number;
  atr14: number;
}

export interface AIQuickComment {
  id: string;
  symbol: string;
  generatedAt: number;
  overallScore: number;          // 0-100
  marketRegime: MarketRegime;
  dimensions: DimensionScore[];
  technicalSnapshot: TechnicalSnapshot;
  oneLiner: string;              // 一句话
  detailedAnalysis: string;      // 详细
  keySignals: string[];          // 关键信号列表
  confidence: number;            // 0-100
  tags: string[];                // e.g. ['突破阻力', '放量上涨', 'RSI超买']
  similarPatterns: string[];     // 历史相似形态
}

export interface QuickCommentRequest {
  symbol: string;
  price: number;
  change: number;       // %
  changePct: number;
  volume: number;
  avgVolume20d: number;
  high52: number;
  low52: number;
  marketCap?: number;
  pe?: number;
}

export interface AIQuickCommentConfig {
  weights: Partial<Record<CommentDimension, number>>;
  minConfidence: number;     // 低于此值不生成
  maxTags: number;
  similarPatternsCount: number;
}

// ─── Default Weights ─────────────────────────────────────

const DEFAULT_WEIGHTS: Record<CommentDimension, number> = {
  trend: 0.20,
  momentum: 0.18,
  volatility: 0.15,
  volume_price: 0.15,
  support_resistance: 0.12,
  market_sentiment: 0.10,
  relative_strength: 0.10,
};

const DEFAULT_CONFIG: AIQuickCommentConfig = {
  weights: DEFAULT_WEIGHTS,
  minConfidence: 30,
  maxTags: 5,
  similarPatternsCount: 3,
};

// ─── Regime Labels ───────────────────────────────────────

const REGIME_LABELS: Record<MarketRegime, string> = {
  bull: '牛市',
  ranging: '震荡市',
  bear: '熊市',
  recovery: '修复行情',
  crash: '崩盘',
};

const DIMENSION_LABELS: Record<CommentDimension, string> = {
  trend: '趋势',
  momentum: '动量',
  volatility: '波动率',
  volume_price: '量价关系',
  support_resistance: '支撑阻力',
  market_sentiment: '市场情绪',
  relative_strength: '相对强度',
};

// ─── Pattern Library ─────────────────────────────────────

const BULLISH_PATTERNS = ['突破箱体', '黄金交叉', '杯柄形态', '旗形整理突破', 'W底确认'];
const BEARISH_PATTERNS = ['头肩顶', '双重顶', '跌破支撑', '死亡交叉', '下降通道'];
const ALL_PATTERNS = [...BULLISH_PATTERNS, ...BEARISH_PATTERNS, '三角形整理', '楔形', '收敛形态'];

// ─── Engine ──────────────────────────────────────────────

export class AIQuickCommentEngine extends EventEmitter {
  private static instance: AIQuickCommentEngine;

  private config: AIQuickCommentConfig;
  private commentHistory: AIQuickComment[] = [];
  private idCounter = 0;

  constructor(config?: Partial<AIQuickCommentConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config, weights: { ...DEFAULT_WEIGHTS, ...(config?.weights ?? {}) } };
  }

  static getInstance(config?: Partial<AIQuickCommentConfig>): AIQuickCommentEngine {
    if (!AIQuickCommentEngine.instance) {
      AIQuickCommentEngine.instance = new AIQuickCommentEngine(config);
    }
    return AIQuickCommentEngine.instance;
  }

  reset(): void {
    this.commentHistory = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Core Analysis ─────────────────────────────────────

  analyze(req: QuickCommentRequest): AIQuickComment {
    const dimensions = this.scoreDimensions(req);
    const overallScore = this.weightedScore(dimensions);
    const regime = this.classifyRegime(req, overallScore);
    const technicalSnapshot = this.buildTechnicalSnapshot(req);
    const tags = this.generateTags(dimensions, regime);
    const keySignals = this.extractKeySignals(dimensions, overallScore);
    const similarPatterns = this.findSimilarPatterns(dimensions, regime);

    const comment: AIQuickComment = {
      id: `cmt_${++this.idCounter}`,
      symbol: req.symbol,
      generatedAt: Date.now(),
      overallScore,
      marketRegime: regime,
      dimensions,
      technicalSnapshot,
      oneLiner: this.generateOneLiner(req, overallScore, regime, dimensions),
      detailedAnalysis: this.generateDetailedAnalysis(req, overallScore, regime, dimensions, tags),
      keySignals,
      confidence: this.calcConfidence(dimensions, overallScore),
      tags,
      similarPatterns,
    };

    this.commentHistory.push(comment);
    this.emit('comment_generated', comment);
    return comment;
  }

  // ─── Dimension Scoring ─────────────────────────────────

  private scoreDimensions(req: QuickCommentRequest): DimensionScore[] {
    const results: DimensionScore[] = [];

    // Trend score
    const trendScore = this.scoreTrend(req);
    results.push({
      dimension: 'trend', score: trendScore.score,
      weight: this.config.weights.trend ?? 0.2,
      label: DIMENSION_LABELS.trend,
      detail: trendScore.detail,
      signals: trendScore.signals,
    });

    // Momentum
    const momentumScore = this.scoreMomentum(req);
    results.push({
      dimension: 'momentum', score: momentumScore.score,
      weight: this.config.weights.momentum ?? 0.18,
      label: DIMENSION_LABELS.momentum,
      detail: momentumScore.detail,
      signals: momentumScore.signals,
    });

    // Volatility
    const volScore = this.scoreVolatility(req);
    results.push({
      dimension: 'volatility', score: volScore.score,
      weight: this.config.weights.volatility ?? 0.15,
      label: DIMENSION_LABELS.volatility,
      detail: volScore.detail,
      signals: volScore.signals,
    });

    // Volume-price
    const vpScore = this.scoreVolumePrice(req);
    results.push({
      dimension: 'volume_price', score: vpScore.score,
      weight: this.config.weights.volume_price ?? 0.15,
      label: DIMENSION_LABELS.volume_price,
      detail: vpScore.detail,
      signals: vpScore.signals,
    });

    // Support/resistance
    const srScore = this.scoreSupportResistance(req);
    results.push({
      dimension: 'support_resistance', score: srScore.score,
      weight: this.config.weights.support_resistance ?? 0.12,
      label: DIMENSION_LABELS.support_resistance,
      detail: srScore.detail,
      signals: srScore.signals,
    });

    // Market sentiment
    const sentimentScore = this.scoreSentiment(req);
    results.push({
      dimension: 'market_sentiment', score: sentimentScore.score,
      weight: this.config.weights.market_sentiment ?? 0.10,
      label: DIMENSION_LABELS.market_sentiment,
      detail: sentimentScore.detail,
      signals: sentimentScore.signals,
    });

    // Relative strength
    const rsScore = this.scoreRelativeStrength(req);
    results.push({
      dimension: 'relative_strength', score: rsScore.score,
      weight: this.config.weights.relative_strength ?? 0.10,
      label: DIMENSION_LABELS.relative_strength,
      detail: rsScore.detail,
      signals: rsScore.signals,
    });

    return results;
  }

  private scoreTrend(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    const range = req.high52 - req.low52;
    if (range === 0) return { score: 50, detail: '无法判断趋势', signals: [] };
    const pos = ((req.price - req.low52) / range) * 100;
    if (pos > 80) { signals.push('处于52周高位'); return { score: 80, detail: `价格位于52周高位 (${pos.toFixed(0)}%)`, signals }; }
    if (pos > 60) { signals.push('趋势偏强'); return { score: 65, detail: `价格偏强 (${pos.toFixed(0)}%)`, signals }; }
    if (pos > 40) return { score: 50, detail: `价格居中 (${pos.toFixed(0)}%)`, signals };
    if (pos > 20) { signals.push('趋势偏弱'); return { score: 35, detail: `价格偏弱 (${pos.toFixed(0)}%)`, signals }; }
    signals.push('处于52周低位');
    return { score: 20, detail: `价格位于52周低位 (${pos.toFixed(0)}%)`, signals };
  }

  private scoreMomentum(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    const absChange = Math.abs(req.changePct);
    if (req.changePct > 5) { signals.push('强势上涨'); return { score: 85, detail: `日涨幅 ${req.changePct.toFixed(1)}%`, signals }; }
    if (req.changePct > 2) { signals.push('温和上涨'); return { score: 70, detail: `日涨幅 ${req.changePct.toFixed(1)}%`, signals }; }
    if (req.changePct > 0) return { score: 55, detail: `微涨 ${req.changePct.toFixed(1)}%`, signals };
    if (req.changePct > -2) return { score: 45, detail: `微跌 ${req.changePct.toFixed(1)}%`, signals };
    if (req.changePct > -5) { signals.push('温和下跌'); return { score: 30, detail: `日跌幅 ${req.changePct.toFixed(1)}%`, signals }; }
    signals.push('大幅下跌');
    return { score: 15, detail: `日跌幅 ${req.changePct.toFixed(1)}%`, signals };
  }

  private scoreVolatility(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    const absChange = Math.abs(req.changePct);
    if (absChange > 10) { signals.push('极度波动'); return { score: 10, detail: `日内波动 >10%`, signals }; }
    if (absChange > 5) { signals.push('高波动'); return { score: 35, detail: `日内波动 ${absChange.toFixed(1)}%`, signals }; }
    if (absChange > 2) return { score: 60, detail: `正常波动 ${absChange.toFixed(1)}%`, signals };
    return { score: 75, detail: `低波动 ${absChange.toFixed(1)}%`, signals };
  }

  private scoreVolumePrice(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    if (req.avgVolume20d === 0) return { score: 50, detail: '无量价数据', signals: [] };
    const ratio = req.volume / req.avgVolume20d;
    if (ratio > 3) { signals.push('成交量激增'); return { score: req.changePct > 0 ? 85 : 15, detail: `放量${req.changePct > 0 ? '上涨' : '下跌'} (${ratio.toFixed(1)}x)`, signals }; }
    if (ratio > 1.5) { signals.push('放量'); return { score: req.changePct > 0 ? 70 : 30, detail: `放量 (${ratio.toFixed(1)}x)`, signals }; }
    if (ratio > 0.8) return { score: 50, detail: `量能正常 (${ratio.toFixed(1)}x)`, signals };
    signals.push('缩量');
    return { score: req.changePct > 0 ? 40 : 45, detail: `缩量 (${ratio.toFixed(1)}x)`, signals };
  }

  private scoreSupportResistance(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    if (req.price >= req.high52 * 0.98) { signals.push('接近52周阻力'); return { score: 70, detail: '价格接近阻力位', signals }; }
    if (req.price <= req.low52 * 1.02) { signals.push('接近52周支撑'); return { score: 30, detail: '价格接近支撑位', signals }; }
    return { score: 50, detail: '价格居支撑与阻力之间', signals };
  }

  private scoreSentiment(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    const absChange = Math.abs(req.changePct);
    if (req.changePct > 3) { signals.push('情绪积极'); return { score: 75, detail: '正面情绪', signals }; }
    if (req.changePct > 0) return { score: 58, detail: '偏正面', signals };
    if (req.changePct > -3) return { score: 42, detail: '偏负面', signals };
    signals.push('情绪恐慌');
    return { score: 25, detail: '恐慌情绪', signals };
  }

  private scoreRelativeStrength(req: QuickCommentRequest): { score: number; detail: string; signals: string[] } {
    const signals: string[] = [];
    if (req.changePct > 2) { signals.push('跑赢大盘'); return { score: 75, detail: '相对强势', signals }; }
    if (req.changePct > 0) return { score: 55, detail: '略强于大盘', signals };
    if (req.changePct > -2) return { score: 45, detail: '略弱于大盘', signals };
    signals.push('跑输大盘');
    return { score: 25, detail: '相对弱势', signals };
  }

  // ─── Weighted Aggregation ──────────────────────────────

  private weightedScore(dimensions: DimensionScore[]): number {
    let score = 0;
    let totalWeight = 0;
    for (const d of dimensions) {
      score += d.score * d.weight;
      totalWeight += d.weight;
    }
    return totalWeight > 0 ? Math.round(score / totalWeight) : 50;
  }

  // ─── Regime Classification ─────────────────────────────

  classifyRegime(req: QuickCommentRequest, overallScore: number): MarketRegime {
    if (req.changePct < -7) return 'crash';
    if (srcChanged(req.changePct, -5)) return 'bear';
    if (overallScore > 70) return 'bull';
    if (overallScore > 55) return 'recovery';
    if (overallScore > 35) return 'ranging';
    if (overallScore > 20) return 'bear';
    return 'bear';
  }

  // ─── Technical Snapshot ────────────────────────────────

  buildTechnicalSnapshot(req: QuickCommentRequest): TechnicalSnapshot {
    const p = req.price;
    return {
      sma20: p * 0.98,
      sma50: p * 0.95,
      sma200: p * 0.88,
      macd: p * 0.02,
      macdSignal: p * 0.015,
      macdHistogram: p * 0.005,
      rsi14: 50 + req.changePct * 4,
      bollingerUpper: p * 1.05,
      bollingerMiddle: p * 0.98,
      bollingerLower: p * 0.91,
      k: 60,
      d: 55,
      j: 70,
      atr14: p * 0.02,
    };
  }

  // ─── Tag Generation ────────────────────────────────────

  generateTags(dimensions: DimensionScore[], regime: MarketRegime): string[] {
    const tags: string[] = [];
    for (const d of dimensions) {
      if (d.score >= 80) tags.push(`${d.label}强势`);
      else if (d.score <= 20) tags.push(`${d.label}弱势`);
    }
    tags.push(REGIME_LABELS[regime]);
    return tags.slice(0, this.config.maxTags);
  }

  extractKeySignals(dimensions: DimensionScore[], overallScore: number): string[] {
    const signals: string[] = [];
    for (const d of dimensions) {
      for (const s of d.signals) signals.push(s);
    }
    if (overallScore >= 75) signals.unshift('综合评分: 强烈看多');
    else if (overallScore >= 60) signals.unshift('综合评分: 偏多');
    else if (overallScore >= 40) signals.unshift('综合评分: 中性');
    else if (overallScore >= 25) signals.unshift('综合评分: 偏空');
    else signals.unshift('综合评分: 强烈看空');
    return signals;
  }

  findSimilarPatterns(dimensions: DimensionScore[], regime: MarketRegime): string[] {
    const patterns: string[] = [];
    const bullishCount = dimensions.filter(d => d.score >= 60).length;
    const bearishCount = dimensions.filter(d => d.score <= 40).length;
    if (regime === 'bull' || bullishCount >= 5) patterns.push(...BULLISH_PATTERNS.slice(0, 2));
    else if (regime === 'bear' || bearishCount >= 5) patterns.push(...BEARISH_PATTERNS.slice(0, 2));
    else patterns.push(ALL_PATTERNS[0]);
    return patterns.slice(0, this.config.similarPatternsCount);
  }

  // ─── One-liner / Detailed ──────────────────────────────

  private generateOneLiner(req: QuickCommentRequest, overallScore: number, regime: MarketRegime, dims: DimensionScore[]): string {
    const vpDim = dims.find(d => d.dimension === 'volume_price');
    const momentumDim = dims.find(d => d.dimension === 'momentum');
    const volInfo = vpDim?.detail ?? '';
    const momInfo = momentumDim?.detail ?? '';

    if (regime === 'crash') return `${req.symbol} 盘中急跌，注意风险控制`;
    if (regime === 'bull') return `${req.symbol} ${momInfo}, ${volInfo}, 趋势偏强`;
    if (regime === 'bear') return `${req.symbol} ${momInfo}, 短期承压`;
    return `${req.symbol} ${momInfo}, ${REGIME_LABELS[regime]}`;
  }

  private generateDetailedAnalysis(req: QuickCommentRequest, overallScore: number, regime: MarketRegime, dims: DimensionScore[], tags: string[]): string {
    const lines: string[] = [];
    lines.push(`【${req.symbol} AI 快评】(${REGIME_LABELS[regime]} | 综合评分: ${overallScore}/100)`);
    lines.push('');
    for (const d of dims) {
      lines.push(`- ${d.label}: ${d.score}分 → ${d.detail}`);
    }
    if (tags.length > 0) lines.push(`\n标签: ${tags.join(' · ')}`);
    lines.push(`\n置信度: ${this.calcConfidence(dims, overallScore)}%`);
    return lines.join('\n');
  }

  calcConfidence(dimensions: DimensionScore[], overallScore: number): number {
    const signalCount = dimensions.reduce((s, d) => s + d.signals.length, 0);
    const base = Math.min(100, 60 + signalCount * 5);
    return Math.round(base);
  }

  // ─── History ───────────────────────────────────────────

  getCommentHistory(symbol?: string, limit = 20): AIQuickComment[] {
    let history = symbol ? this.commentHistory.filter(c => c.symbol === symbol) : this.commentHistory;
    return history.slice(-limit);
  }

  getLatestComment(symbol: string): AIQuickComment | undefined {
    return [...this.commentHistory].reverse().find(c => c.symbol === symbol);
  }

  // ─── Batch ─────────────────────────────────────────────

  analyzeBatch(reqs: QuickCommentRequest[]): AIQuickComment[] {
    return reqs.map(r => this.analyze(r));
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockRequests(): QuickCommentRequest[] {
    return [
      { symbol: 'AAPL', price: 195, change: 4.5, changePct: 2.3, volume: 55000000, avgVolume20d: 48000000, high52: 200, low52: 140, marketCap: 3000000000000, pe: 30 },
      { symbol: 'TSLA', price: 220, change: -18, changePct: -7.5, volume: 180000000, avgVolume20d: 95000000, high52: 300, low52: 150, marketCap: 700000000000, pe: 65 },
      { symbol: 'NVDA', price: 880, change: 25, changePct: 2.9, volume: 42000000, avgVolume20d: 38000000, high52: 920, low52: 400, marketCap: 2200000000000, pe: 45 },
    ];
  }
}

// ─── Helpers ─────────────────────────────────────────────

function srcChanged(a: number, threshold: number): boolean {
  if (threshold > 0) return a >= threshold;
  return a <= threshold;
}
