/**
 * R243 JVS#2: CreatorMaterialEngine — 创作者素材引擎
 *
 * When a creator is writing a strategy analysis, this engine recommends
 * relevant news articles as supporting evidence/arguments.
 *
 * Architecture:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │                   CreatorMaterialEngine                        │
 *   │  ┌─────────────────────────────────────────────────────────┐  │
 *   │  │ Intent Analyzer                                           │  │
 *   │  │  ├─ parse current draft text for intent signals          │  │
 *   │  │  ├─ detect: "I think"/"bearish"/"upgrade"/"risk"        │  │
 *   │  │  └─ map intent → search query expansion                  │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ News Matcher                                              │  │
 *   │  │  ├─ inverted index over recent news articles              │  │
 *   │  │  ├─ TF-IDF similarity or keyword overlap                  │  │
 *   │  │  └─ boost: same symbol, same sector, recent timeliness   │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                          │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Material Formatter                                        │  │
 *   │  │  ├─ "Supporting Evidence" cards                           │  │
 *   │  │  ├─ "Counter Argument" cards (opposite sentiment)         │  │
 *   │  │  ├─ "Key Data Point" cards (earnings/economic data)       │  │
 *   │  │  └─ "Related Headline" cards (general news)               │  │
 *   │  └─────────────────────────────────────────────────────────┘  │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Pricing: FREE (创作者工具, non-billable)
 *
 * v2.7.0-NEWS | production-ready | FINAL ROUND
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url?: string;
  symbol?: string;
  sector?: string;
  keywords: string[];
  sentiment: number;
  publishedAt: number;
  importance: 1|2|3|4|5;
}

export interface DraftContext {
  draftText: string;
  strategyName?: string;
  symbols: string[];
  sectors: string[];
  intent?: DraftIntent;
}

export interface DraftIntent {
  direction: 'bullish' | 'bearish' | 'neutral' | 'analysis';
  thesis: string[];
  confidence: 'low' | 'medium' | 'high';
  tone: 'optimistic' | 'cautious' | 'critical' | 'neutral';
}

export type MaterialType = 'supporting' | 'counter' | 'data_point' | 'headline';

export interface CreatorMaterial {
  id: string;
  materialType: MaterialType;
  article: NewsArticle;
  relevanceScore: number;     // 0-1
  matchReason: string;        // e.g. "Same symbol (AAPL)" or "Keyword: Q3 earnings"
  suggestedUsage: string;     // e.g. "Use as supporting evidence for bullish thesis"
  previewQuote?: string;      // key sentence from the article
  expiresAt?: number;
}

export interface MaterialRecommendation {
  requestId: string;
  symbol: string;
  draftSnapshot: string;      // first 200 chars of current draft
  intent: DraftIntent;
  supporting: CreatorMaterial[];
  counter: CreatorMaterial[];
  dataPoints: CreatorMaterial[];
  headlines: CreatorMaterial[];
  totalCount: number;
  generatedAt: number;
  processingTimeMs: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Intent Detection
// ═════════════════════════════════════════════════════════════════════════════

const BULLISH_SIGNALS = [
  'bullish', 'buy', 'long', 'overweight', 'upgrade', 'beat',
  'growth', 'momentum', 'catalyst', 'undervalued', 'breakout',
  '看涨', '买入', '做多', '增持', '上调', '超预期',
  '成长', '动能', '催化剂', '低估', '突破',
];

const BEARISH_SIGNALS = [
  'bearish', 'sell', 'short', 'underweight', 'downgrade', 'miss',
  'decline', 'risk', 'overvalued', 'bubble', 'collapse',
  '看跌', '卖出', '做空', '减持', '下调', '不及预期',
  '下跌', '风险', '高估', '泡沫', '崩溃',
];

const CONFIDENCE_SIGNALS = {
  high: ['certainly', 'undoubtedly', 'clearly', 'definitely', 'strong', '无疑', '必然', '强烈', '确定'],
  low: ['might', 'maybe', 'possible', 'uncertain', 'perhaps', 'speculative', '可能', '也许', '不确定', '推测'],
};

// ═════════════════════════════════════════════════════════════════════════════
// CreatorMaterialEngine
// ═════════════════════════════════════════════════════════════════════════════

export class CreatorMaterialEngine {
  private articleIndex: NewsArticle[] = [];
  private keywordIndex: Map<string, Set<number>> = new Map(); // keyword → article indices
  private maxIndexSize = 5000;
  private maxMaterialsPerQuery = 8;

  // ── Index Management ─────────────────────────────────────────────────

  /**
   * Index a batch of news articles for fast search.
   */
  indexArticles(articles: NewsArticle[]): number {
    let added = 0;
    for (const article of articles) {
      if (this.articleIndex.length >= this.maxIndexSize) break;

      const idx = this.articleIndex.length;
      this.articleIndex.push(article);

      // Index by keyword
      for (const kw of article.keywords) {
        const lower = kw.toLowerCase();
        if (!this.keywordIndex.has(lower)) this.keywordIndex.set(lower, new Set());
        this.keywordIndex.get(lower)!.add(idx);
      }

      // Also index by symbol
      if (article.symbol) {
        const symKey = `$${article.symbol.toLowerCase()}`;
        if (!this.keywordIndex.has(symKey)) this.keywordIndex.set(symKey, new Set());
        this.keywordIndex.get(symKey)!.add(idx);
      }
      added++;
    }
    log.info(`[CME] Indexed ${added} articles, total: ${this.articleIndex.length}`);
    return added;
  }

  /**
   * Clear all indexed articles.
   */
  clearIndex(): void {
    this.articleIndex = [];
    this.keywordIndex.clear();
  }

  // ── Intent Analysis ──────────────────────────────────────────────────

  /**
   * Analyze the draft text to detect the creator's intent.
   */
  analyzeIntent(draft: DraftContext): DraftIntent {
    const text = draft.draftText.toLowerCase();

    const bullishHits = BULLISH_SIGNALS.filter(s => text.includes(s.toLowerCase())).length;
    const bearishHits = BEARISH_SIGNALS.filter(s => text.includes(s.toLowerCase())).length;

    const direction: DraftIntent['direction'] =
      bullishHits > bearishHits ? 'bullish' :
      bearishHits > bullishHits ? 'bearish' :
      'analysis';

    const highConf = CONFIDENCE_SIGNALS.high.filter(s => text.includes(s.toLowerCase())).length;
    const lowConf = CONFIDENCE_SIGNALS.low.filter(s => text.includes(s.toLowerCase())).length;

    const confidence: DraftIntent['confidence'] =
      highConf > lowConf ? 'high' : lowConf > highConf ? 'low' : 'medium';

    const thesis: string[] = [];
    if (text.includes('earnings') || text.includes('财报') || text.includes('季度')) thesis.push('earnings');
    if (text.includes('merger') || text.includes('并购') || text.includes('收购')) thesis.push('merger');
    if (text.includes('dividend') || text.includes('分红') || text.includes('股息')) thesis.push('dividend');
    if (text.includes('technical') || text.includes('技术') || text.includes('chart')) thesis.push('technical');
    if (text.includes('fundamental') || text.includes('基本面') || text.includes('value')) thesis.push('fundamental');
    if (text.includes('regulatory') || text.includes('监管') || text.includes('政策')) thesis.push('regulatory');
    if (text.includes('product') || text.includes('产品') || text.includes('launch')) thesis.push('product');

    const tone: DraftIntent['tone'] =
      text.includes('confident') || text.includes('confident') ? 'optimistic' :
      text.includes('risk') || text.includes('caution') || text.includes('risk') ? 'cautious' :
      'neutral';

    return { direction, thesis, confidence, tone };
  }

  // ── Material Search ──────────────────────────────────────────────────

  /**
   * Search for relevant news articles based on the draft context.
   */
  search(draft: DraftContext): MaterialRecommendation {
    const start = Date.now();
    const intent = this.analyzeIntent(draft);

    // Collect candidate article indices
    const candidateIndices = new Set<number>();

    // Search by symbols
    for (const sym of draft.symbols) {
      const key = `$${sym.toLowerCase()}`;
      const indices = this.keywordIndex.get(key);
      if (indices) for (const i of indices) candidateIndices.add(i);
    }

    // Extract keywords from draft text
    const draftTokens = this.tokenize(draft.draftText);
    for (const token of draftTokens) {
      const indices = this.keywordIndex.get(token);
      if (indices) for (const i of indices) candidateIndices.add(i);
    }

    // Search by sector keywords
    for (const sector of draft.sectors) {
      const indices = this.keywordIndex.get(sector.toLowerCase());
      if (indices) for (const i of indices) candidateIndices.add(i);
    }

    // Rank candidates by relevance
    const scored: Array<{ idx: number; score: number; matchReason: string }> = [];
    for (const idx of candidateIndices) {
      const article = this.articleIndex[idx];
      let score = 0;
      const reasons: string[] = [];

      // Symbol match
      if (article.symbol && draft.symbols.includes(article.symbol)) {
        score += 3;
        reasons.push(`Same symbol (${article.symbol})`);
      }

      // Sector match
      if (article.sector && draft.sectors.includes(article.sector)) {
        score += 2;
        reasons.push(`Same sector (${article.sector})`);
      }

      // Keyword overlap
      const articleKeywords = new Set(article.keywords.map(k => k.toLowerCase()));
      let kwOverlap = 0;
      for (const tk of draftTokens) {
        if (articleKeywords.has(tk)) kwOverlap++;
      }
      score += kwOverlap;
      if (kwOverlap > 0) reasons.push(`${kwOverlap} keyword matches`);

      // Sentiment alignment
      if (intent.direction === 'bullish' && article.sentiment > 0.3) score += 1.5;
      if (intent.direction === 'bearish' && article.sentiment < -0.3) score += 1.5;

      // Recency bonus
      const hoursOld = (Date.now() - article.publishedAt) / 3600000;
      if (hoursOld < 24) score += 1;
      else if (hoursOld < 72) score += 0.5;

      if (score >= 1) {
        scored.push({ idx, score, matchReason: reasons.join('; ') });
      }
    }

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    const max = this.maxMaterialsPerQuery;
    const top = scored.slice(0, max);

    // Classify into material types
    const supporting: CreatorMaterial[] = [];
    const counter: CreatorMaterial[] = [];
    const dataPoints: CreatorMaterial[] = [];
    const headlines: CreatorMaterial[] = [];

    for (const { idx, score, matchReason } of top) {
      const article = this.articleIndex[idx];
      const base: Omit<CreatorMaterial, 'materialType'> = {
        id: `mat-${article.id}-${Date.now()}`,
        article,
        relevanceScore: Math.round(Math.min(score / 10, 1) * 100) / 100,
        matchReason,
        suggestedUsage: '',
        previewQuote: article.description.slice(0, 120),
      };

      // Classify
      if (article.sentiment * (intent.direction === 'bullish' ? 1 : -1) > 0.2) {
        supporting.push({
          ...base, materialType: 'supporting',
          suggestedUsage: 'Use as supporting evidence for your thesis',
        });
      } else if (article.sentiment * (intent.direction === 'bullish' ? 1 : -1) < -0.2) {
        counter.push({
          ...base, materialType: 'counter',
          suggestedUsage: 'Address this counter-argument to strengthen your analysis',
        });
      } else if (article.importance >= 3 || /earnings|dividend|GDP|CPI|NFP/i.test(article.title)) {
        dataPoints.push({
          ...base, materialType: 'data_point',
          suggestedUsage: 'Cite this data point as factual support',
        });
      } else {
        headlines.push({
          ...base, materialType: 'headline',
          suggestedUsage: 'Reference as market context',
        });
      }
    }

    const processingTimeMs = Date.now() - start;

    log.info(`[CME] Found ${top.length} materials for ${draft.symbols.join(',')} in ${processingTimeMs}ms`);

    return {
      requestId: `cme-${Date.now()}`,
      symbol: draft.symbols[0] || '',
      draftSnapshot: draft.draftText.slice(0, 200),
      intent,
      supporting, counter, dataPoints, headlines,
      totalCount: supporting.length + counter.length + dataPoints.length + headlines.length,
      generatedAt: Date.now(),
      processingTimeMs,
    };
  }

  // ── Utility ──────────────────────────────────────────────────────────

  private tokenize(text: string): string[] {
    const tokens = new Set<string>();

    // Split on non-word chars, filter stop words
    const words = text.toLowerCase().split(/[^a-zA-Z\u4e00-\u9fff]+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'it', 'its', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'my', 'our', 'your', 'their', 'his', 'her', '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);

    for (const w of words) {
      if (w.length >= 3 && !stopWords.has(w)) {
        tokens.add(w);
      }
    }

    return [...tokens];
  }

  getIndexStats(): { articleCount: number; keywordCount: number } {
    return { articleCount: this.articleIndex.length, keywordCount: this.keywordIndex.size };
  }

  reset(): void {
    this.articleIndex = [];
    this.keywordIndex.clear();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultCME: CreatorMaterialEngine | null = null;

export function getCreatorMaterialEngine(): CreatorMaterialEngine {
  if (!defaultCME) defaultCME = new CreatorMaterialEngine();
  return defaultCME;
}

export function resetCreatorMaterialEngine(): void {
  defaultCME = null;
}
