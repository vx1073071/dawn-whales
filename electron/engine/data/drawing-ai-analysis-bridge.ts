/**
 * R284 auto#1: Drawing AI Analysis IPC Bridge — 画线→AI智能分析桥接
 * 
 * 将用户画线(趋势线/支撑压力/斐波/通道/形态)送入AI分析引擎,
 * 生成自然语言智能分析、交易信号、风险评估。
 * 
 * 功能:
 *   1. 画线集合 → 结构化分析上下文提取
 *   2. 多维度分析: 形态识别 / 交易设置 / 风险评估 / 多周期 / 综合
 *   3. AI提示词生成器 (中英双语)
 *   4. 分析结果缓存 + 版本管理
 *   5. 分析历史 → 趋势追踪
 *   6. 一键生成交易策略入口
 * 
 * 上游: DrawingIpcV5Bridge (画线数据), DrawingStrategyBridge (策略)
 * 下游: ML UI (AI Analysis面板), AI引擎
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type AnalysisType =
  | 'pattern_recognition'   // 形态识别
  | 'trade_setup'           // 交易设置建议
  | 'risk_assessment'       // 风险评估
  | 'multi_timeframe'       // 多周期分析
  | 'comprehensive';        // 综合分析

export type DrawingCategory =
  | 'line' | 'channel' | 'fib' | 'shape' | 'text' | 'pattern';

export interface DrawingPoint {
  price: number;
  time: number;
  x?: number;
  y?: number;
}

export interface DrawingForAnalysis {
  drawingId: string;
  type: string;               // trend-line, horizontal-line, fib-retracement, etc.
  category: DrawingCategory;
  points: DrawingPoint[];
  label?: string;
  note?: string;
  color?: string;
  lineWidth?: number;
}

export interface AnalysisContext {
  symbol: string;
  market: string;             // US, HK, CN, CRYPTO, etc.
  timeframe: string;          // 1m, 5m, 1h, D, W, etc.
  currentPrice: number;
  drawings: DrawingForAnalysis[];
  additionalNotes?: string;
  requestId: string;
  requestedAt: number;
}

export interface AiAnalysisRequest {
  context: AnalysisContext;
  analysisTypes: AnalysisType[];
  language: 'zh' | 'en' | 'both';
  maxInsights?: number;
  includeTradeSetup?: boolean;
  includeRiskParams?: boolean;
  style?: 'concise' | 'detailed' | 'educational';
}

export interface AiAnalysisResult {
  analysisId: string;
  requestId: string;
  symbol: string;
  generatedAt: number;
  model?: string;
  
  // Structured results per analysis type
  patternRecognition?: PatternRecognitionResult;
  tradeSetup?: TradeSetupResult;
  riskAssessment?: RiskAssessmentResult;
  multiTimeframe?: MultiTimeframeResult;
  
  // Unified summaries
  summary: string;
  summaryCn: string;
  keyInsights: AnalysisInsight[];
  confidence: number;                    // 0-100
  actionBias: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  
  // Trading signals derived from analysis
  tradingSignals: TradingSignal[];
  
  // Source drawings
  sourceDrawingIds: string[];
  
  // Metadata
  version: number;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  error?: string;
}

export interface PatternRecognitionResult {
  detectedPatterns: DetectedPattern[];
  primaryPattern: DetectedPattern | null;
  patternCount: number;
  description: string;
  descriptionCn: string;
}

export interface DetectedPattern {
  type: PatternType;
  name: string;
  nameCn: string;
  confidence: number;         // 0-100
  direction: 'bullish' | 'bearish' | 'neutral';
  reliability: number;        // 0-100 (historical accuracy)
  description: string;
  descriptionCn: string;
  boundingDrawingIds: string[];
}

export type PatternType =
  | 'trend_continuation'
  | 'trend_reversal'
  | 'support_bounce'
  | 'resistance_reject'
  | 'breakout'
  | 'breakdown'
  | 'double_top'
  | 'double_bottom'
  | 'head_shoulders'
  | 'inverse_head_shoulders'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetrical_triangle'
  | 'rising_wedge'
  | 'falling_wedge'
  | 'bull_flag'
  | 'bear_flag'
  | 'cup_handle'
  | 'channel_breakout'
  | 'fib_confluence'
  | 'custom';

export interface TradeSetupResult {
  setups: TradeSetup[];
  primarySetup: TradeSetup | null;
  totalSetups: number;
}

export interface TradeSetup {
  setupId: string;
  type: 'long' | 'short';
  entry: { price: number; description: string; descriptionCn: string };
  stopLoss: { price: number; percent: number; description: string; descriptionCn: string };
  takeProfit: { targets: { price: number; percent: number; description: string }[] };
  riskRewardRatio: number;
  positionSuggestion: { percent: number; rationale: string };
  confidence: number;                           // 0-100
  timeframe: string;
  invalidationCondition: string;
  invalidationConditionCn: string;
}

export interface RiskAssessmentResult {
  overallRisk: 'low' | 'moderate' | 'high' | 'extreme';
  riskScore: number;                            // 0-100
  keyRisks: RiskFactor[];
  mitigationSuggestions: string[];
  mitigationSuggestionsCn: string[];
}

export interface RiskFactor {
  riskId: string;
  type: 'volatility' | 'gap' | 'liquidity' | 'event' | 'correlation' | 'sizing' | 'slippage';
  severity: 'low' | 'medium' | 'high';
  description: string;
  descriptionCn: string;
  relatedDrawingIds: string[];
}

export interface MultiTimeframeResult {
  timeframes: MultiTimeframeAnalysis[];
  confluenceScore: number;                      // 0-100
  primaryTimeframe: string;
}

export interface MultiTimeframeAnalysis {
  timeframe: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  strength: number;                             // 0-100
  keyLevels: { price: number; type: string; description: string }[];
}

export interface AnalysisInsight {
  insightId: string;
  type: 'pattern' | 'level' | 'confluence' | 'divergence' | 'risk' | 'opportunity';
  priority: number;                             // 1=highest
  title: string;
  titleCn: string;
  detail: string;
  detailCn: string;
  confidence: number;
  relatedDrawingIds: string[];
}

export interface TradingSignal {
  signalId: string;
  type: 'entry' | 'exit' | 'alert' | 'modify_position';
  direction: 'long' | 'short' | 'close';
  price: number;
  reason: string;
  reasonCn: string;
  urgency: 'now' | 'soon' | 'watch';
  expiresAt?: number;
}

// ── Analysis history ───────────────────────────────────────────────────────

export interface AnalysisHistoryEntry {
  analysisId: string;
  symbol: string;
  timestamp: number;
  analysisTypes: AnalysisType[];
  primaryPattern?: string;
  actionBias: string;
  confidence: number;
  drawingCount: number;
}

// ── AI Prompt generation ───────────────────────────────────────────────────

interface PromptTemplate {
  system: string;
  user: string;
}

function buildDrawingDescription(d: DrawingForAnalysis): string {
  const parts: string[] = [];
  parts.push(`[${d.type}]`);
  if (d.label) parts.push(`label: ${d.label}`);
  parts.push(`points: ${d.points.map(p => `${p.price?.toFixed(2) || '?'}@${p.time ? new Date(p.time).toISOString() : '?'}`).join(' → ')}`);
  if (d.note) parts.push(`note: ${d.note}`);
  return parts.join(' | ');
}

function buildPatternRecognitionPrompt(ctx: AnalysisContext): PromptTemplate {
  const drawingDesc = ctx.drawings.map(d => buildDrawingDescription(d)).join('\n  ');
  
  return {
    system: `You are a professional technical analyst specializing in chart pattern recognition.
Analyze the drawings on a ${ctx.symbol} (${ctx.market}) ${ctx.timeframe} chart at price ${ctx.currentPrice}.
Identify patterns formed by: trend lines, horizontal support/resistance, Fibonacci retracements/extensions, channels, geometric shapes, and pitchforks.
For each pattern, assess confidence (0-100) based on touch point count, time span, and volume context.
Prioritize patterns with multiple confirmations (confluence).`,

    user: `Chart Drawings:\n  ${drawingDesc}\n\nAnalyze and identify all technical patterns formed by these drawings. For each pattern provide:
1. Pattern type and name (CN+EN)
2. Direction (bullish/bearish/neutral)
3. Confidence score (0-100)
4. Reliability based on historical accuracy
5. Brief justification citing which drawings form this pattern
6. Rank by confidence

Also determine the PRIMARY pattern (most significant/confluent).`,
  };
}

function buildTradeSetupPrompt(ctx: AnalysisContext, patterns: DetectedPattern[]): PromptTemplate {
  const patternSummary = patterns.map(p => `${p.nameCn}(${p.name}, confidence:${p.confidence}, ${p.direction})`).join(', ');
  
  return {
    system: `You are a professional trade planner. Based on chart patterns and drawing levels,
design precise trade setups with clear entry, stop loss, and take profit targets.
Use ATR-based position sizing. Always maintain risk:reward > 2:1.
State invalidation conditions clearly.`,

    user: `Symbol: ${ctx.symbol} (${ctx.market}) ${ctx.timeframe}
Current Price: ${ctx.currentPrice}
Detected Patterns: ${patternSummary || 'None explicitly detected'}

Design trade setups. For each:
1. Direction (long/short)
2. Entry price and description
3. Stop loss price and % distance
4. Take profit targets (2-3 levels) with prices and % gain
5. Risk:Reward ratio
6. Position size suggestion (% of capital)
7. Confidence (0-100)
8. Invalidation condition

Consider pattern direction, support/resistance levels, and Fibonacci levels from the drawings.`,
  };
}

function buildRiskAssessmentPrompt(ctx: AnalysisContext): PromptTemplate {
  return {
    system: `You are a risk management specialist. Assess trading risks based on chart structure.
Evaluate: volatility risk (ATR-based), gap risk (price gaps to levels), liquidity risk (thin areas),
event risk (nearby economic events), correlation risk, and position sizing risk.`,

    user: `Symbol: ${ctx.symbol} (${ctx.market}) ${ctx.timeframe}
Current Price: ${ctx.currentPrice}
Drawings: ${ctx.drawings.length} items on chart

Assess trading risks:
1. Overall risk level (low/moderate/high/extreme)
2. Risk score (0-100)
3. Key risk factors with severity
4. Mitigation suggestions

Focus on: proximity to support/resistance, volatility context, level clustering (confluence risk).`,
  };
}

function buildMultiTimeframePrompt(ctx: AnalysisContext): PromptTemplate {
  return {
    system: `You analyze multi-timeframe chart structure. Identify key levels and bias
across timeframes, assess confluence (agreement between timeframes). Higher confluence = stronger signal.`,

    user: `Symbol: ${ctx.symbol} (${ctx.market})
Base Timeframe: ${ctx.timeframe}, Current Price: ${ctx.currentPrice}

Assess expected bias across timeframes (higher=weekly/daily, medium=4h/1h, lower=15m/5m):
1. For each standard timeframe: bias (bullish/bearish/neutral), strength (0-100)
2. Key levels per timeframe
3. Confluence score (0-100) - how aligned are the timeframes?
4. Primary timeframe recommendation`,
  };
}

function buildComprehensivePrompt(ctx: AnalysisContext): PromptTemplate {
  const drawingSummary = ctx.drawings.map(d => {
    const pts = d.points.map(p => p.price?.toFixed(2) || '?');
    return `${d.type}${d.label ? ` "${d.label}"` : ''}: ${pts.join(' → ')}`;
  }).join('; ');

  return {
    system: `You are a senior technical analyst. Provide comprehensive chart analysis combining
pattern recognition, trade planning, and risk assessment. Be actionable:
tell the trader WHAT to watch, WHERE to act, and WHY.`,

    user: `Symbol: ${ctx.symbol} (${ctx.market}) ${ctx.timeframe}
Current Price: ${ctx.currentPrice}
Drawings: ${drawingSummary}

Provide:
1. **Pattern Analysis**: What patterns do these drawings form? Primary pattern?
2. **Key Levels**: Most important support/resistance/fib levels from the drawings
3. **Trade Setup**: If you had to trade this now, what would the plan be? (entry/SL/TPs)
4. **Risk Assessment**: What are the main risks to this setup?
5. **Overall Bias**: Bullish/Bearish/Neutral with confidence score
6. **Watch Points**: What would invalidate this view?

Be specific with price levels from the drawings.`,
  };
}

/**
 * Generate AI prompts from drawing analysis context.
 * These prompts can be sent to any LLM (local or cloud).
 */
export function generateAiPrompts(ctx: AnalysisContext, types: AnalysisType[]): Record<AnalysisType, PromptTemplate> {
  const prompts: Record<string, PromptTemplate> = {};
  const patterns = ctx.drawings.length > 0 ? [] : []; // Pre-computed if available

  for (const t of types) {
    switch (t) {
      case 'pattern_recognition':
        prompts[t] = buildPatternRecognitionPrompt(ctx);
        break;
      case 'trade_setup':
        prompts[t] = buildTradeSetupPrompt(ctx, patterns);
        break;
      case 'risk_assessment':
        prompts[t] = buildRiskAssessmentPrompt(ctx);
        break;
      case 'multi_timeframe':
        prompts[t] = buildMultiTimeframePrompt(ctx);
        break;
      case 'comprehensive':
        prompts[t] = buildComprehensivePrompt(ctx);
        break;
    }
  }
  return prompts as Record<AnalysisType, PromptTemplate>;
}

// ── Context extraction from raw drawings ────────────────────────────────────

export interface ExtractedContext {
  levels: { price: number; type: string; label: string; strength: number }[];
  trendLines: { slope: number; direction: 'up' | 'down' | 'flat'; startPrice: number; endPrice: number; touches: number }[];
  fibLevels: { level: number; price: number; type: 'retracement' | 'extension' }[];
  channels: { upperPrice: number; lowerPrice: number; midlinePrice: number; width: number; direction: string }[];
  zones: { topPrice: number; bottomPrice: number; type: string }[];
  drawingCount: number;
}

export function extractContextFromDrawings(drawings: DrawingForAnalysis[], currentPrice: number): ExtractedContext {
  const ctx: ExtractedContext = {
    levels: [],
    trendLines: [],
    fibLevels: [],
    channels: [],
    zones: [],
    drawingCount: drawings.length,
  };

  for (const d of drawings) {
    switch (d.type) {
      case 'horizontal-line':
      case 'price-range': {
        const price = d.points[0]?.price;
        if (price != null) {
          ctx.levels.push({
            price,
            type: price < currentPrice ? 'support' : 'resistance',
            label: d.label || (price < currentPrice ? '支撑' : '压力'),
            strength: d.points.length > 0 ? Math.min(100, d.points.length * 30) : 50,
          });
        }
        break;
      }
      case 'trend-line':
      case 'ray':
      case 'extended-line': {
        if (d.points.length >= 2) {
          const p1 = d.points[0], p2 = d.points[d.points.length - 1];
          const dx = p2.time - p1.time;
          if (dx > 0) {
            const slope = (p2.price - p1.price) / dx;
            ctx.trendLines.push({
              slope,
              direction: Math.abs(p2.price - p1.price) / p1.price < 0.005 ? 'flat' : slope > 0 ? 'up' : 'down',
              startPrice: p1.price,
              endPrice: p2.price,
              touches: d.points.length,
            });
          }
        }
        break;
      }
      case 'fib-retracement': {
        if (d.points.length >= 2) {
          const p1 = d.points[0], p2 = d.points[1];
          const diff = p2.price - p1.price;
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          for (const l of levels) {
            ctx.fibLevels.push({
              level: l,
              price: p2.price - diff * l,
              type: 'retracement',
            });
          }
        }
        break;
      }
      case 'fib-extension':
      case 'fib-expansion': {
        if (d.points.length >= 3) {
          const p1 = d.points[0], p2 = d.points[1], p3 = d.points[2];
          const diff = p2.price - p1.price;
          for (const l of [0.618, 1, 1.618, 2.618]) {
            ctx.fibLevels.push({
              level: l,
              price: p3.price + diff * l,
              type: 'extension',
            });
          }
        }
        break;
      }
      case 'parallel-channel':
      case 'regression-ch':
      case 'donchian-ch':
      case 'keltner-ch': {
        if (d.points.length >= 3) {
          const prices = d.points.map(p => p.price).sort((a, b) => a - b);
          ctx.channels.push({
            upperPrice: prices[prices.length - 1],
            lowerPrice: prices[0],
            midlinePrice: (prices[0] + prices[prices.length - 1]) / 2,
            width: (prices[prices.length - 1] - prices[0]) / prices[0],
            direction: d.label || 'channel',
          });
        }
        break;
      }
      case 'rectangle': {
        if (d.points.length >= 2) {
          const prices = [d.points[0].price, d.points[1].price].sort((a, b) => a - b);
          ctx.zones.push({
            topPrice: prices[1],
            bottomPrice: prices[0],
            type: 'rectangle',
          });
        }
        break;
      }
    }
  }

  return ctx;
}

// ── Confluence detection ───────────────────────────────────────────────────

export interface ConfluencePoint {
  price: number;
  types: string[];          // overlapping analysis types
  strength: number;         // 0-100
  label: string;
  labelCn: string;
}

export function detectConfluence(ctx: ExtractedContext, threshold = 0.02): ConfluencePoint[] {
  const allPrices: { price: number; type: string }[] = [];

  for (const l of ctx.levels) {
    allPrices.push({ price: l.price, type: l.type });
  }
  for (const f of ctx.fibLevels) {
    allPrices.push({ price: f.price, type: `fib_${f.level}` });
  }
  for (const c of ctx.channels) {
    allPrices.push({ price: c.upperPrice, type: 'channel_upper' });
    allPrices.push({ price: c.lowerPrice, type: 'channel_lower' });
  }
  for (const z of ctx.zones) {
    allPrices.push({ price: z.topPrice, type: 'zone_top' });
    allPrices.push({ price: z.bottomPrice, type: 'zone_bottom' });
  }

  // Cluster prices within threshold
  const clusters: { prices: { price: number; type: string }[] }[] = [];
  const sorted = [...allPrices].sort((a, b) => a.price - b.price);

  for (const p of sorted) {
    let added = false;
    for (const cluster of clusters) {
      const avgPrice = cluster.prices.reduce((s, c) => s + c.price, 0) / cluster.prices.length;
      if (Math.abs(p.price - avgPrice) / avgPrice < threshold) {
        cluster.prices.push(p);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({ prices: [p] });
    }
  }

  // Confluence = clusters with 2+ types
  return clusters
    .filter(c => {
      const types = new Set(c.prices.map(p => p.type));
      return types.size >= 2;
    })
    .map(c => {
      const avgPrice = c.prices.reduce((s, p) => s + p.price, 0) / c.prices.length;
      const types = [...new Set(c.prices.map(p => p.type))];
      const strength = Math.min(100, c.prices.length * 25);
      const typeLabels = types.map(t => {
        if (t.startsWith('fib_')) return `斐波${t.replace('fib_', '')}`;
        if (t === 'support') return '支撑';
        if (t === 'resistance') return '压力';
        if (t === 'channel_upper') return '通道上轨';
        if (t === 'channel_lower') return '通道下轨';
        return t;
      });
      return {
        price: +avgPrice.toFixed(8),
        types,
        strength,
        label: typeLabels.join(' + '),
        labelCn: typeLabels.join(' + '),
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

// ═══════════════════════════════════════════════════════════════════════════
// DrawingAiAnalysisBridge
// ═══════════════════════════════════════════════════════════════════════════

export class DrawingAiAnalysisBridge {
  private analyses: Map<string, AiAnalysisResult> = new Map();
  private history: AnalysisHistoryEntry[] = [];
  private stats = {
    totalAnalyses: 0,
    completedAnalyses: 0,
    averageConfidence: 0,
    mostCommonBias: 'neutral' as string,
  };

  /** Extract structured context from drawings */
  extractContext(drawings: DrawingForAnalysis[], symbol: string, currentPrice: number): ExtractedContext {
    return extractContextFromDrawings(drawings, currentPrice);
  }

  /** Generate AI prompts for requested analysis types */
  generatePrompts(ctx: AnalysisContext, types: AnalysisType[]): Record<AnalysisType, PromptTemplate> {
    return generateAiPrompts(ctx, types);
  }

  /** Find confluence zones from multiple drawing types */
  findConfluence(drawings: DrawingForAnalysis[], currentPrice: number, threshold = 0.02): ConfluencePoint[] {
    const ctx = extractContextFromDrawings(drawings, currentPrice);
    return detectConfluence(ctx, threshold);
  }

  /** Submit a new analysis request (returns analysisId for tracking) */
  submitAnalysis(request: AiAnalysisRequest): string {
    const analysisId = `dai_${createHash('md5').update(`${request.context.symbol}_${Date.now()}_${Math.random()}`).digest('hex').slice(0, 12)}`;

    const result: AiAnalysisResult = {
      analysisId,
      requestId: request.context.requestId,
      symbol: request.context.symbol,
      generatedAt: Date.now(),
      summary: '',
      summaryCn: '',
      keyInsights: [],
      confidence: 0,
      actionBias: 'neutral',
      tradingSignals: [],
      sourceDrawingIds: request.context.drawings.map(d => d.drawingId),
      version: 1,
      status: 'pending',
    };

    this.analyses.set(analysisId, result);
    this.stats.totalAnalyses++;

    return analysisId;
  }

  /** Update analysis with AI result (called after AI engine responds) */
  completeAnalysis(analysisId: string, aiResponse: Partial<AiAnalysisResult>): AiAnalysisResult | null {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) return null;

    Object.assign(analysis, aiResponse, {
      status: 'completed' as const,
      generatedAt: Date.now(),
      version: (analysis.version || 1) + 1,
    });

    // Update stats
    this.stats.completedAnalyses++;
    const confSum = this.stats.averageConfidence * (this.stats.completedAnalyses - 1) + (analysis.confidence || 0);
    this.stats.averageConfidence = +(confSum / this.stats.completedAnalyses).toFixed(1);

    // Track bias distribution
    const biasCounts: Record<string, number> = {};
    for (const a of this.analyses.values()) {
      if (a.status === 'completed') {
        biasCounts[a.actionBias] = (biasCounts[a.actionBias] || 0) + 1;
      }
    }
    this.stats.mostCommonBias = Object.entries(biasCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    // Add to history
    this.history.push({
      analysisId,
      symbol: analysis.symbol,
      timestamp: analysis.generatedAt,
      analysisTypes: [], // populated by caller
      primaryPattern: analysis.patternRecognition?.primaryPattern?.name,
      actionBias: analysis.actionBias,
      confidence: analysis.confidence,
      drawingCount: analysis.sourceDrawingIds.length,
    });

    return analysis;
  }

  /** Mark analysis as failed */
  failAnalysis(analysisId: string, error: string): void {
    const analysis = this.analyses.get(analysisId);
    if (analysis) {
      analysis.status = 'failed';
      analysis.error = error;
    }
  }

  /** Get analysis by ID */
  getAnalysis(analysisId: string): AiAnalysisResult | null {
    return this.analyses.get(analysisId) || null;
  }

  /** Get analysis history for a symbol */
  getHistory(symbol?: string, limit = 20): AnalysisHistoryEntry[] {
    let entries = [...this.history];
    if (symbol) entries = entries.filter(e => e.symbol === symbol);
    return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /** Get all analyses */
  listAnalyses(symbol?: string): AiAnalysisResult[] {
    const all = [...this.analyses.values()];
    if (symbol) return all.filter(a => a.symbol === symbol);
    return all;
  }

  /** Get bridge statistics */
  getStats() {
    return { ...this.stats, historySize: this.history.length, cachedAnalyses: this.analyses.size };
  }

  /** Generate a quick assessment from drawings without waiting for AI */
  quickAssess(drawings: DrawingForAnalysis[], symbol: string, currentPrice: number): {
    hasSupport: boolean;
    hasResistance: boolean;
    supportLevels: number[];
    resistanceLevels: number[];
    trendBias: 'bullish' | 'bearish' | 'neutral';
    fibConfluence: ConfluencePoint[];
    drawingTypeSummary: Record<string, number>;
    suggestion: string;
    suggestionCn: string;
  } {
    const ctx = extractContextFromDrawings(drawings, currentPrice);

    const supportLevels = ctx.levels
      .filter(l => l.type === 'support')
      .map(l => l.price)
      .sort((a, b) => b - a);

    const resistanceLevels = ctx.levels
      .filter(l => l.type === 'resistance')
      .map(l => l.price)
      .sort((a, b) => a - b);

    // Trend bias from trend lines
    const upTrends = ctx.trendLines.filter(t => t.direction === 'up');
    const downTrends = ctx.trendLines.filter(t => t.direction === 'down');
    let trendBias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (upTrends.length > downTrends.length * 2) trendBias = 'bullish';
    else if (downTrends.length > upTrends.length * 2) trendBias = 'bearish';

    const fibConfluence = detectConfluence(ctx);

    // Drawing type summary
    const drawingTypeSummary: Record<string, number> = {};
    for (const d of drawings) {
      drawingTypeSummary[d.type] = (drawingTypeSummary[d.type] || 0) + 1;
    }

    // Simple suggestion
    let suggestion = '观望 — 画线信息不足以做出判断';
    let suggestionCn = '观望 — 画线信息不足以做出判断';

    if (supportLevels.length > 0 && currentPrice < supportLevels[0] * 1.03 && currentPrice > supportLevels[0] * 0.97) {
      suggestion = `Near support at ${supportLevels[0].toFixed(2)} — Consider long with tight stop`;
      suggestionCn = `接近支撑 ${supportLevels[0].toFixed(2)} — 考虑做多，紧止损`;
    } else if (resistanceLevels.length > 0 && currentPrice > resistanceLevels[0] * 0.97 && currentPrice < resistanceLevels[0] * 1.03) {
      suggestion = `Near resistance at ${resistanceLevels[0].toFixed(2)} — Consider short or take profit`;
      suggestionCn = `接近压力 ${resistanceLevels[0].toFixed(2)} — 考虑做空或止盈`;
    } else if (trendBias === 'bullish' && supportLevels.length > 0) {
      suggestion = `Bullish trend with supports at ${supportLevels.slice(0, 2).map(p => p.toFixed(2)).join(', ')} — Buy dips`;
      suggestionCn = `上升趋势，支撑在 ${supportLevels.slice(0, 2).map(p => p.toFixed(2)).join(', ')} — 逢低买入`;
    } else if (trendBias === 'bearish' && resistanceLevels.length > 0) {
      suggestion = `Bearish trend with resistances at ${resistanceLevels.slice(0, 2).map(p => p.toFixed(2)).join(', ')} — Sell rallies`;
      suggestionCn = `下降趋势，压力在 ${resistanceLevels.slice(0, 2).map(p => p.toFixed(2)).join(', ')} — 逢高卖出`;
    }

    return {
      hasSupport: supportLevels.length > 0,
      hasResistance: resistanceLevels.length > 0,
      supportLevels,
      resistanceLevels,
      trendBias,
      fibConfluence,
      drawingTypeSummary,
      suggestion,
      suggestionCn,
    };
  }

  /** Reset bridge state */
  reset(): void {
    this.analyses.clear();
    this.history = [];
    this.stats = { totalAnalyses: 0, completedAnalyses: 0, averageConfidence: 0, mostCommonBias: 'neutral' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _bridge: DrawingAiAnalysisBridge | null = null;

export function getDrawingAiAnalysisBridge(): DrawingAiAnalysisBridge {
  if (!_bridge) _bridge = new DrawingAiAnalysisBridge();
  return _bridge;
}

export function resetDrawingAiAnalysisBridge(): void {
  _bridge?.reset();
  _bridge = null;
}
