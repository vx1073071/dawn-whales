/**
 * JVS-95: NLP Sentiment Analysis Engine
 * Analyzes financial text sentiment with built-in Chinese and English lexicons.
 * Supports negation, intensifiers, entity extraction, and keyword extraction.
 */

import log from 'electron-log';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SentimentResult {
  text: string;
  score: number; // -1 to 1
  label: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
  keywords: { word: string; weight: number }[];
  entities: { name: string; type: 'stock' | 'sector' | 'event' | 'person' }[];
  language: string;
}

export interface BatchSentimentResult {
  results: SentimentResult[];
  overallScore: number;
  overallLabel: 'bullish' | 'bearish' | 'neutral';
  distribution: { bullish: number; neutral: number; bearish: number };
  topPositive: SentimentResult[];
  topNegative: SentimentResult[];
}

export interface SentimentConfig {
  language: 'zh' | 'en' | 'auto';
  includeEntities: boolean;
  includeKeywords: boolean;
  topKeywords: number;
}

// ─── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SentimentConfig = {
  language: 'auto',
  includeEntities: true,
  includeKeywords: true,
  topKeywords: 10,
};

// ─── Chinese Positive Lexicon (50+ terms) ─────────────────────────────────────

const ZH_POSITIVE_LEXICON: Map<string, number> = new Map([
  ['上涨', 0.6],
  ['涨停', 0.9],
  ['大涨', 0.8],
  ['反弹', 0.5],
  ['利好', 0.7],
  ['看涨', 0.7],
  ['突破', 0.6],
  ['新高', 0.8],
  ['增长', 0.6],
  ['盈利', 0.7],
  ['超预期', 0.8],
  ['强劲', 0.7],
  ['复苏', 0.6],
  ['回暖', 0.5],
  ['景气', 0.6],
  ['看好', 0.7],
  ['买入', 0.6],
  ['增持', 0.5],
  ['推荐', 0.5],
  ['跑赢', 0.6],
  ['领先', 0.5],
  ['创新', 0.5],
  ['扩张', 0.5],
  ['分红', 0.5],
  ['回购', 0.6],
  ['并购', 0.4],
  ['合作', 0.4],
  ['获批', 0.6],
  ['中标', 0.6],
  ['签约', 0.5],
  ['订单', 0.5],
  ['放量', 0.4],
  ['放量上涨', 0.7],
  ['金叉', 0.6],
  ['底部', 0.4],
  ['企稳', 0.5],
  ['止跌', 0.5],
  ['转好', 0.5],
  ['改善', 0.5],
  ['优化', 0.4],
  ['提升', 0.5],
  ['加速', 0.5],
  ['翻倍', 0.8],
  ['暴涨', 0.9],
  ['飙升', 0.9],
  ['热销', 0.6],
  ['供不应求', 0.7],
  ['利润增长', 0.7],
  ['业绩预增', 0.8],
  ['扭亏为盈', 0.7],
  ['高送转', 0.6],
  ['优质', 0.5],
  ['稳健', 0.5],
  ['龙头', 0.5],
  ['稀缺', 0.5],
  ['核心资产', 0.6],
]);

// ─── Chinese Negative Lexicon (50+ terms) ─────────────────────────────────────

const ZH_NEGATIVE_LEXICON: Map<string, number> = new Map([
  ['下跌', 0.6],
  ['跌停', 0.9],
  ['大跌', 0.8],
  ['暴跌', 0.9],
  ['利空', 0.7],
  ['看跌', 0.7],
  ['破位', 0.6],
  ['新低', 0.8],
  ['下滑', 0.6],
  ['亏损', 0.7],
  ['不及预期', 0.8],
  ['疲软', 0.6],
  ['衰退', 0.7],
  ['恶化', 0.7],
  ['萎缩', 0.6],
  ['看空', 0.7],
  ['卖出', 0.6],
  ['减持', 0.5],
  ['跑输', 0.6],
  ['落后', 0.5],
  ['违规', 0.6],
  ['处罚', 0.6],
  ['退市', 0.9],
  ['爆雷', 0.9],
  ['暴雷', 0.9],
  ['质押', 0.4],
  ['平仓', 0.6],
  ['强平', 0.8],
  ['死叉', 0.6],
  ['套牢', 0.7],
  ['割肉', 0.7],
  ['缩量', 0.4],
  ['破发', 0.7],
  ['腰斩', 0.9],
  ['崩盘', 0.9],
  ['闪崩', 0.9],
  ['跳水', 0.8],
  ['高估', 0.5],
  ['泡沫', 0.7],
  ['风险', 0.5],
  ['危机', 0.8],
  ['诉讼', 0.5],
  ['调查', 0.5],
  ['监管', 0.4],
  ['处罚通知', 0.7],
  ['业绩预减', 0.8],
  ['业绩预亏', 0.8],
  ['商誉减值', 0.7],
  ['坏账', 0.7],
  ['资不抵债', 0.9],
  ['拖欠', 0.7],
  ['违约', 0.8],
  ['停产', 0.7],
  ['裁员', 0.6],
  ['缩减', 0.5],
  ['流失', 0.6],
]);

// ─── English Positive Lexicon (50+ terms) ─────────────────────────────────────

const EN_POSITIVE_LEXICON: Map<string, number> = new Map([
  ['rally', 0.7],
  ['surge', 0.8],
  ['soar', 0.8],
  ['gain', 0.5],
  ['rise', 0.5],
  ['climb', 0.5],
  ['advance', 0.5],
  ['bullish', 0.7],
  ['breakout', 0.7],
  ['uptrend', 0.7],
  ['outperform', 0.7],
  ['beat', 0.6],
  ['exceed', 0.6],
  ['growth', 0.6],
  ['profit', 0.6],
  ['revenue', 0.4],
  ['strong', 0.5],
  ['robust', 0.6],
  ['recovery', 0.6],
  ['rebound', 0.5],
  ['optimistic', 0.6],
  ['upgrade', 0.6],
  ['buy', 0.5],
  ['overweight', 0.5],
  ['target', 0.3],
  ['dividend', 0.5],
  ['buyback', 0.6],
  ['acquisition', 0.4],
  ['partnership', 0.4],
  ['innovation', 0.5],
  ['expansion', 0.5],
  ['momentum', 0.5],
  ['record', 0.5],
  ['high', 0.3],
  ['all-time high', 0.8],
  ['boom', 0.7],
  ['thriving', 0.7],
  ['flourishing', 0.6],
  ['upbeat', 0.6],
  ['positive', 0.5],
  ['favorable', 0.5],
  ['impressive', 0.6],
  ['remarkable', 0.6],
  ['stellar', 0.7],
  ['solid', 0.5],
  ['resilient', 0.6],
  ['upside', 0.6],
  ['tailwind', 0.6],
  ['catalyst', 0.5],
  ['opportunity', 0.5],
  ['undervalued', 0.6],
  ['bargain', 0.5],
  ['turnaround', 0.6],
  ['accelerate', 0.5],
  ['double', 0.7],
]);

// ─── English Negative Lexicon (50+ terms) ─────────────────────────────────────

const EN_NEGATIVE_LEXICON: Map<string, number> = new Map([
  ['crash', 0.9],
  ['plunge', 0.8],
  ['drop', 0.6],
  ['fall', 0.5],
  ['decline', 0.6],
  ['slump', 0.7],
  ['tumble', 0.7],
  ['bearish', 0.7],
  ['downtrend', 0.7],
  ['breakdown', 0.6],
  ['underperform', 0.7],
  ['miss', 0.6],
  ['disappoint', 0.6],
  ['loss', 0.6],
  ['weak', 0.5],
  ['fragile', 0.6],
  ['recession', 0.8],
  ['contraction', 0.6],
  ['deteriorate', 0.7],
  ['worsen', 0.7],
  ['pessimistic', 0.6],
  ['downgrade', 0.6],
  ['sell', 0.5],
  ['underweight', 0.5],
  ['risk', 0.4],
  ['volatile', 0.4],
  ['concern', 0.4],
  ['warning', 0.6],
  ['threat', 0.6],
  ['crisis', 0.8],
  ['bankruptcy', 0.9],
  ['default', 0.8],
  ['layoff', 0.6],
  ['lawsuit', 0.5],
  ['fraud', 0.8],
  ['investigation', 0.5],
  ['penalty', 0.6],
  ['fine', 0.5],
  ['overvalued', 0.5],
  ['bubble', 0.7],
  ['headwind', 0.6],
  ['slowdown', 0.6],
  ['stagnation', 0.7],
  ['inflation', 0.5],
  ['negative', 0.5],
  ['adverse', 0.6],
  ['downside', 0.6],
  ['uncertainty', 0.5],
  ['turmoil', 0.7],
  ['collapse', 0.9],
  ['selloff', 0.7],
  ['write-down', 0.7],
  ['impairment', 0.6],
  ['delisting', 0.9],
  ['foreclosure', 0.8],
  ['subpoena', 0.7],
]);

// ─── Negation & Intensifier Patterns ──────────────────────────────────────────

const ZH_NEGATION_PATTERNS = ['不', '没', '未', '无', '非', '别'];
const EN_NEGATION_PATTERNS = ['not', 'no', 'never', 'neither', 'nor', "don't", "doesn't", "didn't", "won't", "can't", "cannot", 'hardly', 'barely'];

const ZH_INTENSIFIERS: Map<string, number> = new Map([
  ['非常', 1.5],
  ['极其', 1.8],
  ['十分', 1.5],
  ['特别', 1.4],
  ['格外', 1.4],
  ['相当', 1.3],
  ['很', 1.3],
  ['太', 1.4],
  ['最', 1.6],
  ['超级', 1.6],
  ['大幅', 1.5],
  ['小幅', 0.8],
  ['略微', 0.7],
  ['稍微', 0.7],
]);

const EN_INTENSIFIERS: Map<string, number> = new Map([
  ['very', 1.5],
  ['extremely', 1.8],
  ['highly', 1.5],
  ['remarkably', 1.6],
  ['incredibly', 1.7],
  ['significantly', 1.5],
  ['substantially', 1.5],
  ['greatly', 1.5],
  ['enormously', 1.7],
  ['tremendously', 1.7],
  ['somewhat', 0.7],
  ['slightly', 0.7],
  ['marginally', 0.7],
  ['barely', 0.5],
]);

// ─── Entity Extraction Patterns ───────────────────────────────────────────────

interface EntityPattern {
  type: 'stock' | 'sector' | 'event' | 'person';
  pattern: RegExp;
}

const ENTITY_PATTERNS: EntityPattern[] = [
  // Chinese stock codes: 6-digit numbers
  { type: 'stock', pattern: /(?<!\d)(\d{6})(?!\d)/g },
  // Stock tickers like $AAPL, $TSLA
  { type: 'stock', pattern: /\$([A-Z]{1,5})\b/g },
  // Chinese stock names ending with common suffixes
  { type: 'stock', pattern: /([\u4e00-\u9fa5]{2,8})(?:股份|控股|集团|科技|电子|生物|医药|银行|证券|保险|地产|能源|汽车)/g },
  // Sector keywords (Chinese)
  {
    type: 'sector',
    pattern: /(半导体|芯片|新能源|人工智能|AI|5G|6G|医药|消费|金融|地产|科技|军工|光伏|锂电|储能|氢能|区块链|元宇宙|数据中心|云计算|物联网|自动驾驶|电动车|碳中和)/g,
  },
  // Sector keywords (English)
  {
    type: 'sector',
    pattern: /\b(semiconductor|chip|AI|artificial intelligence|5G|6G|biotech|pharma|fintech|crypto|blockchain|cloud|EV|autonomous|renewable|solar|energy|tech|healthcare|finance|real estate)\b/gi,
  },
  // Event keywords (Chinese)
  {
    type: 'event',
    pattern: /(财报|年报|季报|半年报|股东大会|董事会|IPO|增发|配股|发债|回购|分红|并购|重组|上市|退市|听证会|发布会|签约仪式|战略合作|产能扩张|投产)/g,
  },
  // Event keywords (English)
  {
    type: 'event',
    pattern: /\b(earnings|annual report|quarterly|shareholder meeting|IPO|merger|acquisition|divestiture|spinoff|buyback|dividend|restructuring|bankruptcy filing|SEC filing|conference call|product launch)\b/gi,
  },
  // Person names (Chinese, 2-4 chars commonly)
  {
    type: 'person',
    pattern: /(?:董事长|总经理|CEO|总裁|CFO|CTO|创始人|董事|监事|主席)([\u4e00-\u9fa5]{2,4})/g,
  },
  // Person names (English, common patterns)
  {
    type: 'person',
    pattern: /\b(?:CEO|CFO|CTO|Chairman|President|Founder|Director)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  },
];

// ─── Language Detection ───────────────────────────────────────────────────────

function detectLanguage(text: string): 'zh' | 'en' {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars > englishWords ? 'zh' : 'en';
}

// ─── Text Segmentation (simple) ───────────────────────────────────────────────

function segmentChinese(text: string): string[] {
  // Simple segmentation: split by punctuation and spaces, keep Chinese phrases
  const tokens: string[] = [];
  // Split by common delimiters
  const parts = text.split(/[\s,，。！？；：、\n\r\t]+/);
  for (const part of parts) {
    if (part.length === 0) continue;
    tokens.push(part);
    // Also extract sub-phrases of length 2-6 for lexicon matching
    for (let len = 2; len <= Math.min(6, part.length); len++) {
      for (let i = 0; i <= part.length - len; i++) {
        const sub = part.substring(i, i + len);
        if (/[\u4e00-\u9fa5]/.test(sub)) {
          tokens.push(sub);
        }
      }
    }
  }
  return tokens;
}

function tokenizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.\-!?;:\n\r\t'"()]+/)
    .filter((t) => t.length > 0);
}

// ─── NLPSentimentEngine Class ─────────────────────────────────────────────────

export class NLPSentimentEngine {
  private zhPositive: Map<string, number>;
  private zhNegative: Map<string, number>;
  private enPositive: Map<string, number>;
  private enNegative: Map<string, number>;

  constructor() {
    // Clone built-in lexicons so instances are independent
    this.zhPositive = new Map(ZH_POSITIVE_LEXICON);
    this.zhNegative = new Map(ZH_NEGATIVE_LEXICON);
    this.enPositive = new Map(EN_POSITIVE_LEXICON);
    this.enNegative = new Map(EN_NEGATIVE_LEXICON);
    log.info('[NLPSentimentEngine] Initialized with built-in lexicons');
  }

  // ─── Custom Lexicon Support ───────────────────────────────────────────────

  /**
   * Add custom positive terms to the lexicon.
   * Terms are added to both Chinese and English lexicons based on character detection.
   */
  addPositiveTerms(terms: string[]): void {
    for (const term of terms) {
      const lang = detectLanguage(term);
      const weight = 0.6; // Default weight for custom terms
      if (lang === 'zh') {
        this.zhPositive.set(term, weight);
      } else {
        this.enPositive.set(term.toLowerCase(), weight);
      }
    }
    log.info(`[NLPSentimentEngine] Added ${terms.length} positive terms`);
  }

  /**
   * Add custom negative terms to the lexicon.
   */
  addNegativeTerms(terms: string[]): void {
    for (const term of terms) {
      const lang = detectLanguage(term);
      const weight = 0.6;
      if (lang === 'zh') {
        this.zhNegative.set(term, weight);
      } else {
        this.enNegative.set(term.toLowerCase(), weight);
      }
    }
    log.info(`[NLPSentimentEngine] Added ${terms.length} negative terms`);
  }

  // ─── Core Analysis ────────────────────────────────────────────────────────

  /**
   * Analyze sentiment of a single text.
   */
  analyze(text: string, config?: Partial<SentimentConfig>): SentimentResult {
    const cfg: SentimentConfig = { ...DEFAULT_CONFIG, ...config };
    const lang = cfg.language === 'auto' ? detectLanguage(text) : cfg.language;

    log.debug(`[NLPSentimentEngine] Analyzing text (${text.length} chars), language: ${lang}`);

    const { rawScore, matchedTerms } = this.computeLexiconScore(text, lang);

    // Apply modifiers
    const modifiedScore = this.applyModifiers(text, rawScore, lang);

    // Check for question mark modifier (questions tend to reduce certainty)
    const questionMarkCount = (text.match(/[?？]/g) || []).length;
    const questionModifier = questionMarkCount > 0 ? 0.7 : 1.0;

    // Normalize to [-1, 1]
    const normalizedScore = this.normalizeScore(modifiedScore * questionModifier);

    // Determine label
    const label = this.scoreToLabel(normalizedScore);

    // Calculate confidence based on number of matched terms and score magnitude
    const confidence = this.calculateConfidence(matchedTerms, normalizedScore);

    // Extract keywords if configured
    const keywords = cfg.includeKeywords ? this.extractKeywords(text, cfg.topKeywords) : [];

    // Extract entities if configured
    const entities = cfg.includeEntities ? this.extractEntities(text) : [];

    return {
      text,
      score: Math.round(normalizedScore * 10000) / 10000,
      label,
      confidence: Math.round(confidence * 10000) / 10000,
      keywords,
      entities,
      language: lang,
    };
  }

  /**
   * Analyze a batch of texts.
   */
  analyzeBatch(texts: string[], config?: Partial<SentimentConfig>): BatchSentimentResult {
    log.info(`[NLPSentimentEngine] Batch analyzing ${texts.length} texts`);

    const results = texts.map((text) => this.analyze(text, config));

    // Calculate overall score (weighted average)
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const overallScore = results.length > 0 ? totalScore / results.length : 0;

    // Distribution
    const distribution = {
      bullish: results.filter((r) => r.label === 'bullish').length,
      neutral: results.filter((r) => r.label === 'neutral').length,
      bearish: results.filter((r) => r.label === 'bearish').length,
    };

    // Top positive and negative
    const sorted = [...results].sort((a, b) => b.score - a.score);
    const topPositive = sorted.filter((r) => r.score > 0).slice(0, 5);
    const topNegative = sorted.filter((r) => r.score < 0).sort((a, b) => a.score - b.score).slice(0, 5);

    const overallLabel = this.scoreToLabel(overallScore);

    const batchResult: BatchSentimentResult = {
      results,
      overallScore: Math.round(overallScore * 10000) / 10000,
      overallLabel,
      distribution,
      topPositive,
      topNegative,
    };

    log.info(
      `[NLPSentimentEngine] Batch result: ${overallLabel} (${overallScore.toFixed(4)}), ` +
        `distribution: B+${distribution.bullish} N${distribution.neutral} B-${distribution.bearish}`
    );

    return batchResult;
  }

  /**
   * Analyze news headlines specifically.
   * Applies headline-specific heuristics (headlines tend to be more extreme).
   */
  analyzeNewsHeadlines(headlines: string[]): BatchSentimentResult {
    log.info(`[NLPSentimentEngine] Analyzing ${headlines.length} news headlines`);

    const results = headlines.map((headline) => {
      const result = this.analyze(headline, { language: 'auto', includeEntities: true, includeKeywords: true, topKeywords: 5 });

      // Headlines often have amplified sentiment; apply a slight boost
      const boostedScore = this.normalizeScore(result.score * 1.15);
      const boostedResult: SentimentResult = {
        ...result,
        score: Math.round(boostedScore * 10000) / 10000,
        label: this.scoreToLabel(boostedScore),
        confidence: Math.min(1, result.confidence * 1.1),
      };

      return boostedResult;
    });

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const overallScore = results.length > 0 ? totalScore / results.length : 0;

    const distribution = {
      bullish: results.filter((r) => r.label === 'bullish').length,
      neutral: results.filter((r) => r.label === 'neutral').length,
      bearish: results.filter((r) => r.label === 'bearish').length,
    };

    const sorted = [...results].sort((a, b) => b.score - a.score);
    const topPositive = sorted.filter((r) => r.score > 0).slice(0, 5);
    const topNegative = sorted.filter((r) => r.score < 0).sort((a, b) => a.score - b.score).slice(0, 5);

    return {
      results,
      overallScore: Math.round(overallScore * 10000) / 10000,
      overallLabel: this.scoreToLabel(overallScore),
      distribution,
      topPositive,
      topNegative,
    };
  }

  // ─── Entity Extraction ────────────────────────────────────────────────────

  /**
   * Extract entities from text using regex patterns.
   */
  extractEntities(text: string): { name: string; type: 'stock' | 'sector' | 'event' | 'person' }[] {
    const entities: Map<string, 'stock' | 'sector' | 'event' | 'person'> = new Map();

    for (const { type, pattern } of ENTITY_PATTERNS) {
      // Reset regex lastIndex for global patterns
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        // Use capture group 1 if available, otherwise full match
        const name = (match[1] || match[0]).trim();
        if (name.length > 0 && name.length < 50) {
          // Avoid duplicates: prefer more specific type
          if (!entities.has(name) || this.isMoreSpecificType(type, entities.get(name)!)) {
            entities.set(name, type);
          }
        }
      }
    }

    const result = Array.from(entities.entries()).map(([name, type]) => ({ name, type }));
    log.debug(`[NLPSentimentEngine] Extracted ${result.length} entities`);
    return result;
  }

  // ─── Keyword Extraction ───────────────────────────────────────────────────

  /**
   * Extract keywords from text, ranked by relevance.
   * Uses a simple frequency + lexicon-weight approach.
   */
  extractKeywords(text: string, topN: number = 10): { word: string; weight: number }[] {
    const lang = detectLanguage(text);
    const wordWeights: Map<string, number> = new Map();

    if (lang === 'zh') {
      // For Chinese, extract meaningful phrases (2-4 chars)
      const segments = segmentChinese(text);
      for (const seg of segments) {
        if (seg.length < 2 || seg.length > 6) continue;
        if (/^[\d\s\W]+$/.test(seg)) continue; // Skip pure numbers/punctuation

        const current = wordWeights.get(seg) || 0;
        // Base frequency weight
        let weight = current + 0.1;
        // Boost if in lexicon
        if (this.zhPositive.has(seg)) weight += this.zhPositive.get(seg)! * 0.5;
        if (this.zhNegative.has(seg)) weight += this.zhNegative.get(seg)! * 0.5;
        wordWeights.set(seg, weight);
      }
    } else {
      // For English, tokenize and score
      const tokens = tokenizeEnglish(text);
      const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
        'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither',
        'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
        'their', 'we', 'our', 'he', 'she', 'his', 'her', 'i', 'my', 'me',
        'you', 'your', 'who', 'which', 'what', 'when', 'where', 'how',
        'about', 'than', 'then', 'just', 'also', 'more', 'most', 'some',
        'any', 'all', 'each', 'every', 'other', 'such', 'only', 'own',
        'same', 'if', 'while', 'because', 'until', 'up', 'out', 'off',
        'over', 'under', 'again', 'further', 'once', 'here', 'there',
      ]);

      for (const token of tokens) {
        if (token.length < 2) continue;
        if (stopWords.has(token)) continue;
        if (/^\d+$/.test(token)) continue;

        const current = wordWeights.get(token) || 0;
        let weight = current + 0.1;
        if (this.enPositive.has(token)) weight += this.enPositive.get(token)! * 0.5;
        if (this.enNegative.has(token)) weight += this.enNegative.get(token)! * 0.5;
        wordWeights.set(token, weight);
      }
    }

    // Sort by weight descending and take topN
    const sorted = Array.from(wordWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word, weight]) => ({ word, weight: Math.round(weight * 10000) / 10000 }));

    return sorted;
  }

  // ─── Market Mood ──────────────────────────────────────────────────────────

  /**
   * Determine overall market mood from a set of sentiment results.
   */
  getMarketMood(results: SentimentResult[]): { mood: string; confidence: number; summary: string } {
    if (results.length === 0) {
      return { mood: 'neutral', confidence: 0, summary: 'No data available for mood analysis' };
    }

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const bullishCount = results.filter((r) => r.label === 'bullish').length;
    const bearishCount = results.filter((r) => r.label === 'bearish').length;
    const neutralCount = results.filter((r) => r.label === 'neutral').length;
    const totalCount = results.length;

    const bullishRatio = bullishCount / totalCount;
    const bearishRatio = bearishCount / totalCount;

    // Determine mood
    let mood: string;
    let summary: string;

    if (avgScore > 0.5 && bullishRatio > 0.7) {
      mood = '极度乐观';
      summary = `市场情绪极度乐观，${bullishCount}/${totalCount}条信息呈看涨态势，平均得分${avgScore.toFixed(2)}`;
    } else if (avgScore > 0.2 && bullishRatio > 0.5) {
      mood = '乐观';
      summary = `市场情绪偏乐观，${bullishCount}/${totalCount}条信息呈看涨态势，平均得分${avgScore.toFixed(2)}`;
    } else if (avgScore > 0.05) {
      mood = '谨慎乐观';
      summary = `市场情绪谨慎乐观，看涨(${bullishCount})略多于看跌(${bearishCount})，平均得分${avgScore.toFixed(2)}`;
    } else if (avgScore < -0.5 && bearishRatio > 0.7) {
      mood = '极度悲观';
      summary = `市场情绪极度悲观，${bearishCount}/${totalCount}条信息呈看跌态势，平均得分${avgScore.toFixed(2)}`;
    } else if (avgScore < -0.2 && bearishRatio > 0.5) {
      mood = '悲观';
      summary = `市场情绪偏悲观，${bearishCount}/${totalCount}条信息呈看跌态势，平均得分${avgScore.toFixed(2)}`;
    } else if (avgScore < -0.05) {
      mood = '谨慎悲观';
      summary = `市场情绪谨慎悲观，看跌(${bearishCount})略多于看涨(${bullishCount})，平均得分${avgScore.toFixed(2)}`;
    } else {
      mood = '中性';
      summary = `市场情绪中性，看涨(${bullishCount})、中性(${neutralCount})、看跌(${bearishCount})分布均匀，平均得分${avgScore.toFixed(2)}`;
    }

    // Confidence: based on consensus (how much results agree)
    const variance = results.reduce((sum, r) => sum + Math.pow(r.score - avgScore, 2), 0) / totalCount;
    const stdDev = Math.sqrt(variance);
    // Lower variance = higher confidence
    const confidence = Math.max(0, Math.min(1, 1 - stdDev));

    log.info(`[NLPSentimentEngine] Market mood: ${mood} (confidence: ${confidence.toFixed(2)})`);

    return {
      mood,
      confidence: Math.round(confidence * 10000) / 10000,
      summary,
    };
  }

  // ─── Private Helper Methods ───────────────────────────────────────────────

  /**
   * Compute raw lexicon score by matching terms.
   */
  private computeLexiconScore(
    text: string,
    lang: 'zh' | 'en'
  ): { rawScore: number; matchedTerms: number } {
    let rawScore = 0;
    let matchedTerms = 0;

    if (lang === 'zh') {
      // Check all Chinese positive terms
      for (const [term, weight] of this.zhPositive) {
        if (text.includes(term)) {
          rawScore += weight;
          matchedTerms++;
        }
      }
      // Check all Chinese negative terms
      for (const [term, weight] of this.zhNegative) {
        if (text.includes(term)) {
          rawScore -= weight;
          matchedTerms++;
        }
      }
    } else {
      const lowerText = text.toLowerCase();
      // Check all English positive terms
      for (const [term, weight] of this.enPositive) {
        // Use word boundary matching for English
        const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          rawScore += weight * matches.length;
          matchedTerms += matches.length;
        }
      }
      // Check all English negative terms
      for (const [term, weight] of this.enNegative) {
        const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          rawScore -= weight * matches.length;
          matchedTerms += matches.length;
        }
      }
    }

    return { rawScore, matchedTerms };
  }

  /**
   * Apply negation and intensifier modifiers.
   */
  private applyModifiers(text: string, rawScore: number, lang: 'zh' | 'en'): number {
    let modifiedScore = rawScore;

    if (lang === 'zh') {
      // Check for negation patterns near sentiment terms
      for (const neg of ZH_NEGATION_PATTERNS) {
        const negPattern = new RegExp(`${this.escapeRegex(neg)}[\\u4e00-\\u9fa5]{0,4}`, 'g');
        const negMatches = text.match(negPattern);
        if (negMatches) {
          // Each negation flips a portion of the score
          modifiedScore *= Math.pow(-0.6, negMatches.length);
        }
      }

      // Apply intensifiers
      for (const [intensifier, multiplier] of ZH_INTENSIFIERS) {
        if (text.includes(intensifier)) {
          // Apply intensifier as a scaling factor on the absolute score
          const sign = modifiedScore >= 0 ? 1 : -1;
          modifiedScore = sign * Math.abs(modifiedScore) * multiplier;
          break; // Apply only the first matched intensifier
        }
      }
    } else {
      const lowerText = text.toLowerCase();

      // Check for negation patterns
      for (const neg of EN_NEGATION_PATTERNS) {
        const negRegex = new RegExp(`\\b${this.escapeRegex(neg)}\\b`, 'gi');
        const negMatches = lowerText.match(negRegex);
        if (negMatches) {
          modifiedScore *= Math.pow(-0.6, negMatches.length);
        }
      }

      // Apply intensifiers
      for (const [intensifier, multiplier] of EN_INTENSIFIERS) {
        const intRegex = new RegExp(`\\b${this.escapeRegex(intensifier)}\\b`, 'gi');
        if (intRegex.test(lowerText)) {
          const sign = modifiedScore >= 0 ? 1 : -1;
          modifiedScore = sign * Math.abs(modifiedScore) * multiplier;
          break;
        }
      }
    }

    return modifiedScore;
  }

  /**
   * Normalize a raw score to [-1, 1] range using tanh-like clamping.
   */
  private normalizeScore(rawScore: number): number {
    // Use tanh for smooth normalization
    const normalized = Math.tanh(rawScore / 3);
    return Math.max(-1, Math.min(1, normalized));
  }

  /**
   * Convert a normalized score to a sentiment label.
   */
  private scoreToLabel(score: number): 'bullish' | 'bearish' | 'neutral' {
    if (score > 0.1) return 'bullish';
    if (score < -0.1) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate confidence based on matched terms and score magnitude.
   */
  private calculateConfidence(matchedTerms: number, score: number): number {
    // More matched terms = higher confidence
    const termConfidence = Math.min(1, matchedTerms / 5);
    // Higher absolute score = higher confidence
    const scoreConfidence = Math.abs(score);
    // Weighted combination
    const combined = termConfidence * 0.6 + scoreConfidence * 0.4;
    return Math.max(0.05, Math.min(1, combined));
  }

  /**
   * Check if a type is more specific than another for entity dedup.
   */
  private isMoreSpecificType(
    newType: 'stock' | 'sector' | 'event' | 'person',
    existingType: 'stock' | 'sector' | 'event' | 'person'
  ): boolean {
    const priority: Record<string, number> = {
      stock: 4,
      person: 3,
      event: 2,
      sector: 1,
    };
    return priority[newType] > priority[existingType];
  }

  /**
   * Escape special regex characters in a string.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default NLPSentimentEngine;
