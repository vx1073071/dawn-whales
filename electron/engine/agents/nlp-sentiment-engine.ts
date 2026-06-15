
/**
 * JVS-95: NLP Sentiment Analysis Engine
 * Analyzes financial text sentiment with built-in Chinese and English lexicons.
 * Supports negation, intensifiers, entity extraction, and keyword extraction.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import log from 'electron-log';
import i18n from '../../../src/i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:AI] structured error tracking

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SentimentResult {
  text: string;
  score: number; // -1 to 1
  label: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
  keywords: { word: string; weight: number }[];
  entities: string[]; // Entity names as strings
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
  model?: string;
  language: 'zh' | 'en' | 'auto';
  batchSize?: number;
  includeEntities: boolean;
  includeKeywords: boolean;
  topKeywords: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  publishedAt: string;
  symbols: string[];
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
  [i18n.t('nlpSentimentEngine.k1'), 0.6],
  [i18n.t('nlpSentimentEngine.k2'), 0.9],
  [i18n.t('nlpSentimentEngine.k3'), 0.8],
  [i18n.t('nlpSentimentEngine.k4'), 0.5],
  [i18n.t('nlpSentimentEngine.k5'), 0.7],
  [i18n.t('nlpSentimentEngine.k6'), 0.7],
  [i18n.t('nlpSentimentEngine.k7'), 0.6],
  [i18n.t('nlpSentimentEngine.k8'), 0.8],
  [i18n.t('nlpSentimentEngine.k9'), 0.6],
  [i18n.t('nlpSentimentEngine.k10'), 0.7],
  [i18n.t('nlpSentimentEngine.k11'), 0.8],
  [i18n.t('nlpSentimentEngine.k12'), 0.8],
  [i18n.t('nlpSentimentEngine.k13'), 0.5],
  [i18n.t('nlpSentimentEngine.k14'), 0.7],
  [i18n.t('nlpSentimentEngine.k15'), 0.6],
  [i18n.t('nlpSentimentEngine.k16'), 0.5],
  [i18n.t('nlpSentimentEngine.k17'), 0.6],
  [i18n.t('nlpSentimentEngine.k18'), 0.7],
  [i18n.t('nlpSentimentEngine.k19'), 0.6],
  [i18n.t('nlpSentimentEngine.k20'), 0.5],
  [i18n.t('nlpSentimentEngine.k21'), 0.5],
  [i18n.t('nlpSentimentEngine.k22'), 0.6],
  [i18n.t('nlpSentimentEngine.k23'), 0.5],
  [i18n.t('nlpSentimentEngine.k24'), 0.5],
  [i18n.t('nlpSentimentEngine.k25'), 0.5],
  [i18n.t('nlpSentimentEngine.k26'), 0.5],
  [i18n.t('nlpSentimentEngine.k27'), 0.6],
  [i18n.t('nlpSentimentEngine.k28'), 0.4],
  [i18n.t('nlpSentimentEngine.k29'), 0.4],
  [i18n.t('nlpSentimentEngine.k30'), 0.6],
  [i18n.t('nlpSentimentEngine.k31'), 0.6],
  [i18n.t('nlpSentimentEngine.k32'), 0.5],
  [i18n.t('nlpSentimentEngine.k33'), 0.5],
  [i18n.t('nlpSentimentEngine.k34'), 0.4],
  [i18n.t('nlpSentimentEngine.k35'), 0.7],
  [i18n.t('nlpSentimentEngine.k36'), 0.6],
  [i18n.t('nlpSentimentEngine.k37'), 0.4],
  [i18n.t('nlpSentimentEngine.k38'), 0.5],
  [i18n.t('nlpSentimentEngine.k39'), 0.5],
  [i18n.t('nlpSentimentEngine.k40'), 0.5],
  [i18n.t('nlpSentimentEngine.k41'), 0.5],
  [i18n.t('nlpSentimentEngine.k42'), 0.4],
  [i18n.t('nlpSentimentEngine.k43'), 0.5],
  [i18n.t('nlpSentimentEngine.k44'), 0.5],
  [i18n.t('nlpSentimentEngine.k45'), 0.8],
  [i18n.t('nlpSentimentEngine.k46'), 0.9],
  [i18n.t('nlpSentimentEngine.k47'), 0.9],
  [i18n.t('nlpSentimentEngine.k48'), 0.6],
  [i18n.t('nlpSentimentEngine.k49'), 0.7],
  [i18n.t('nlpSentimentEngine.k50'), 0.7],
  [i18n.t('nlpSentimentEngine.k51'), 0.8],
  [i18n.t('nlpSentimentEngine.k52'), 0.7],
  [i18n.t('nlpSentimentEngine.k53'), 0.6],
  [i18n.t('nlpSentimentEngine.k54'), 0.5],
  [i18n.t('nlpSentimentEngine.k55'), 0.5],
  [i18n.t('nlpSentimentEngine.k56'), 0.5],
  [i18n.t('nlpSentimentEngine.k57'), 0.5],
  [i18n.t('nlpSentimentEngine.k58'), 0.6],
]);

// ─── Chinese Negative Lexicon (50+ terms) ─────────────────────────────────────

const ZH_NEGATIVE_LEXICON: Map<string, number> = new Map([
  [i18n.t('nlpSentimentEngine.k59'), 0.6],
  [i18n.t('nlpSentimentEngine.k60'), 0.9],
  [i18n.t('nlpSentimentEngine.k61'), 0.8],
  [i18n.t('nlpSentimentEngine.k62'), 0.9],
  [i18n.t('nlpSentimentEngine.k63'), 0.7],
  [i18n.t('nlpSentimentEngine.k64'), 0.7],
  [i18n.t('nlpSentimentEngine.k65'), 0.6],
  [i18n.t('nlpSentimentEngine.k66'), 0.8],
  [i18n.t('nlpSentimentEngine.k67'), 0.6],
  [i18n.t('nlpSentimentEngine.k68'), 0.7],
  [i18n.t('nlpSentimentEngine.k69'), 0.8],
  [i18n.t('nlpSentimentEngine.k70'), 0.6],
  [i18n.t('nlpSentimentEngine.k71'), 0.7],
  [i18n.t('nlpSentimentEngine.k72'), 0.7],
  [i18n.t('nlpSentimentEngine.k73'), 0.6],
  [i18n.t('nlpSentimentEngine.k74'), 0.7],
  [i18n.t('nlpSentimentEngine.k75'), 0.6],
  [i18n.t('nlpSentimentEngine.k76'), 0.5],
  [i18n.t('nlpSentimentEngine.k77'), 0.6],
  [i18n.t('nlpSentimentEngine.k78'), 0.5],
  [i18n.t('nlpSentimentEngine.k79'), 0.6],
  [i18n.t('nlpSentimentEngine.k80'), 0.6],
  [i18n.t('nlpSentimentEngine.k81'), 0.9],
  [i18n.t('nlpSentimentEngine.k82'), 0.9],
  [i18n.t('nlpSentimentEngine.k83'), 0.9],
  [i18n.t('nlpSentimentEngine.k84'), 0.4],
  [i18n.t('nlpSentimentEngine.k85'), 0.6],
  [i18n.t('nlpSentimentEngine.k86'), 0.8],
  [i18n.t('nlpSentimentEngine.k87'), 0.6],
  [i18n.t('nlpSentimentEngine.k88'), 0.7],
  [i18n.t('nlpSentimentEngine.k89'), 0.7],
  [i18n.t('nlpSentimentEngine.k90'), 0.4],
  [i18n.t('nlpSentimentEngine.k91'), 0.7],
  [i18n.t('nlpSentimentEngine.k92'), 0.9],
  [i18n.t('nlpSentimentEngine.k93'), 0.9],
  [i18n.t('nlpSentimentEngine.k94'), 0.9],
  [i18n.t('nlpSentimentEngine.k95'), 0.8],
  [i18n.t('nlpSentimentEngine.k96'), 0.5],
  [i18n.t('nlpSentimentEngine.k97'), 0.7],
  [i18n.t('nlpSentimentEngine.k98'), 0.5],
  [i18n.t('nlpSentimentEngine.k99'), 0.8],
  [i18n.t('nlpSentimentEngine.k100'), 0.5],
  [i18n.t('nlpSentimentEngine.k101'), 0.5],
  [i18n.t('nlpSentimentEngine.k102'), 0.4],
  [i18n.t('nlpSentimentEngine.k103'), 0.7],
  [i18n.t('nlpSentimentEngine.k104'), 0.8],
  [i18n.t('nlpSentimentEngine.k105'), 0.8],
  [i18n.t('nlpSentimentEngine.k106'), 0.7],
  [i18n.t('nlpSentimentEngine.k107'), 0.7],
  [i18n.t('nlpSentimentEngine.k108'), 0.9],
  [i18n.t('nlpSentimentEngine.k109'), 0.7],
  [i18n.t('nlpSentimentEngine.k110'), 0.8],
  [i18n.t('nlpSentimentEngine.k111'), 0.7],
  [i18n.t('nlpSentimentEngine.k112'), 0.6],
  [i18n.t('nlpSentimentEngine.k113'), 0.5],
  [i18n.t('nlpSentimentEngine.k114'), 0.6],
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

const ZH_NEGATION_PATTERNS = [i18n.t('nlpSentimentEngine.k115'), i18n.t('nlpSentimentEngine.k116'), i18n.t('nlpSentimentEngine.k117'), i18n.t('nlpSentimentEngine.k118'), i18n.t('nlpSentimentEngine.k119'), i18n.t('nlpSentimentEngine.k120')];
const EN_NEGATION_PATTERNS = ['not', 'no', 'never', 'neither', 'nor', "don't", "doesn't", "didn't", "won't", "can't", "cannot", 'hardly', 'barely'];

const ZH_INTENSIFIERS: Map<string, number> = new Map([
  [i18n.t('nlpSentimentEngine.k121'), 1.5],
  [i18n.t('nlpSentimentEngine.k122'), 1.8],
  [i18n.t('nlpSentimentEngine.k123'), 1.5],
  [i18n.t('nlpSentimentEngine.k124'), 1.4],
  [i18n.t('nlpSentimentEngine.k125'), 1.4],
  [i18n.t('nlpSentimentEngine.k126'), 1.3],
  [i18n.t('nlpSentimentEngine.k127'), 1.3],
  [i18n.t('nlpSentimentEngine.k128'), 1.4],
  [i18n.t('nlpSentimentEngine.k129'), 1.6],
  [i18n.t('nlpSentimentEngine.k130'), 1.6],
  [i18n.t('nlpSentimentEngine.k131'), 1.5],
  [i18n.t('nlpSentimentEngine.k132'), 0.8],
  [i18n.t('nlpSentimentEngine.k133'), 0.7],
  [i18n.t('nlpSentimentEngine.k134'), 0.7],
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
  { type: 'stock', pattern: /([\u4e00-\u9fa5]{2,8})(?:\u80a1\u4efd|\u63a7\u80a1|\u96c6\u56e2|\u79d1\u6280|\u7535\u5b50|\u751f\u7269|\u533b\u836f|\u94f6\u884c|\u8bc1\u5238|\u4fdd\u9669|\u5730\u4ea7|\u80fd\u6e90|\u6c7d\u8f66)/g },
  // Sector keywords (Chinese)
  {
    type: 'sector',
    pattern: /(\u534a\u5bfc\u4f53|\u82af\u7247|\\u65b0\u80fd\u6e90|\u4eba\u5de5\u667a\u80fd|AI|5G|6G|\u533b\u836f|\u6d88\u8d39|\u91d1\u878d|\u5730\u4ea7|\u79d1\u6280|\u519b\u5de5|\u5149\u4f0f|\u9502\u7535|\u50a8\u80fd|\u6c22\u80fd|\u533a\u5757\u94fe|\u5143\u5b87\u5b99|\u6570\u636e\u4e2d\u5fc3|\u4e91\u8ba1\u7b97|\u7269\u8054\u7f51|\u81ea\u52a8\u9a7e\u9a76|\u7535\u52a8\u8f66|\u78b3\u4e2d\u548c)/g,
  },
  // Sector keywords (English)
  {
    type: 'sector',
    pattern: /\b(semiconductor|chip|AI|artificial intelligence|5G|6G|biotech|pharma|fintech|crypto|blockchain|cloud|EV|autonomous|renewable|solar|energy|tech|healthcare|finance|real estate)\b/gi,
  },
  // Event keywords (Chinese)
  {
    type: 'event',
    pattern: /(\u8d22\u62a5|\u5e74\u62a5|\u5b63\u62a5|\\u534a\u5e74\u62a5|\u80a1\u4e1c\u5927\u4f1a|\u8463\u4e8b\u4f1a|IPO|\u589e\u53d1|\u914d\u80a1|\u53d1\u503a|\u56de\u8d2d|\u5206\u7ea2|\u5e76\u8d2d|\u91cd\u7ec4|\u4e0a\u5e02|\u9000\u5e02|\u542c\u8bc1\u4f1a|\u53d1\u5e03\u4f1a|\u7b7e\u7ea6\u4eea\u5f0f|\u6218\u7565\u5408\u4f5c|\u4ea7\u80fd\u6269\u5f20|\u6295\u4ea7)/g,
  },
  // Event keywords (English)
  {
    type: 'event',
    pattern: /\b(earnings|annual report|quarterly|shareholder meeting|IPO|merger|acquisition|divestiture|spinoff|buyback|dividend|restructuring|bankruptcy filing|SEC filing|conference call|product launch)\b/gi,
  },
  // Person names (Chinese, 2-4 chars commonly)
  {
    type: 'person',
    pattern: /(?:\u8463\u4e8b\u957f|\u603b\u7ecf\u7406|CEO|\u603b\u88c1|CFO|CTO|\u521b\u59cb\u4eba|\u8463\u4e8b|\u76d1\u4e8b|\u4e3b\u5e2d)([\u4e00-\u9fa5]{2,4})/g,
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
  private config: SentimentConfig = {
    model: 'finbert',
    language: 'zh',
    batchSize: 32,
    minScore: 0.2,
    enableEntityExtraction: true,
    enableKeywords: true,
  };
  private processedArticles: number = 0;
  private sentimentHistory: { score: number; timestamp: number }[] = [];
  private entityHistory: { type: string; value: string }[] = [];
  private symbolIndex: Map<string, { score: number; timestamp: number }[]> = new Map();

  constructor(config?: Partial<SentimentConfig>) {
    // Clone built-in lexicons so instances are independent
    this.zhPositive = new Map(ZH_POSITIVE_LEXICON);
    this.zhNegative = new Map(ZH_NEGATIVE_LEXICON);
    this.enPositive = new Map(EN_POSITIVE_LEXICON);
    this.enNegative = new Map(EN_NEGATIVE_LEXICON);
    if (config) {
      this.config = { ...this.config, ...config };
    }
    log.info('[NLPSentimentEngine] Initialized with built-in lexicons');
  }

  /**
   * Get current engine configuration.
   */
  getConfig(): SentimentConfig {
    return { ...this.config };
  }

  /**
   * Get engine runtime metrics.
   */
  getMetrics(): {
    articlesProcessed: number;
    totalArticles: number;
    avgScore: number;
    avgSentiment: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    totalEntities: number;
    symbolCount: number;
  } {
    const total = this.processedArticles;
    const posCount = this.sentimentHistory.filter(h => h.score > 0.2).length;
    const negCount = this.sentimentHistory.filter(h => h.score < -0.2).length;
    const neuCount = this.sentimentHistory.length - posCount - negCount;
    const avg = this.sentimentHistory.length > 0
      ? this.sentimentHistory.reduce((s, h) => s + h.score, 0) / this.sentimentHistory.length
      : 0;
    return {
      articlesProcessed: total,
      totalArticles: total,
      avgScore: avg,
      avgSentiment: avg,
      positiveCount: posCount,
      negativeCount: negCount,
      neutralCount: neuCount,
      totalEntities: this.entityHistory.length,
      symbolCount: this.symbolIndex.size,
    };
  }

  /**
   * Analyze a single article (accepts string or NewsArticle-like object).
   */
  analyzeSentiment(textOrArticle: string | any, config?: Partial<SentimentConfig>): SentimentResult {
    // Extract text from article object or use as-is
    let text = '';
    if (typeof textOrArticle === 'string') {
      text = textOrArticle;
    } else if (textOrArticle && typeof textOrArticle === 'object') {
      // Combine title and content for better analysis
      const title = textOrArticle.title || '';
      const content = textOrArticle.content || '';
      text = title && content ? `${title}。${content}` : (title || content || '');
    }
    
    // Track processed articles
    this.processedArticles++;
    
    const result = this.analyze(text, config);
    
    // Add symbols from article to entities if present
    if (textOrArticle && typeof textOrArticle === 'object' && textOrArticle.symbols) {
      const symbols = textOrArticle.symbols as string[];
      // Add symbols that aren't already in entities
      for (const symbol of symbols) {
        if (!result.entities.includes(symbol)) {
          result.entities.push(symbol);
        }
      }
      
      // Index by symbols
      for (const symbol of symbols) {
        if (!this.symbolIndex.has(symbol)) {
          this.symbolIndex.set(symbol, []);
        }
        this.symbolIndex.get(symbol)!.push({ score: result.score, timestamp: Date.now() });
      }
    }
    
    // Track sentiment history
    this.sentimentHistory.push({ score: result.score, timestamp: Date.now() });
    
    return result;
  }

  /**
   * Aggregate sentiment for a symbol.
   */
  aggregateSentiment(symbol: string): { symbol: string; avgScore: number; avgSentiment: number; articleCount: number; positiveRatio: number; negativeRatio: number; mood: string } {
    return this.aggregateForSymbol(symbol);
  }

  /**
   * Reset all engine state.
   */
  reset(): void {
    this.processedArticles = 0;
    this.sentimentHistory = [];
    this.entityHistory = [];
    this.symbolIndex.clear();
  }

  aggregateForSymbol(symbol: string): { symbol: string; avgScore: number; avgSentiment: number; articleCount: number; positiveRatio: number; negativeRatio: number; mood: string } {
    const articles = this.symbolIndex.get(symbol) ?? [];
    if (articles.length === 0) {
      return { symbol, avgScore: 0, avgSentiment: 0, articleCount: 0, positiveRatio: 0, negativeRatio: 0, mood: 'neutral' };
    }
    const scores = articles.map(a => a.score);
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
    const pos = scores.filter(s => s > 0.2).length;
    const neg = scores.filter(s => s < -0.2).length;
    let mood = 'neutral';
    if (avg > 0.3) mood = 'bullish';
    else if (avg < -0.3) mood = 'bearish';
    return {
      symbol,
      avgScore: avg,
      avgSentiment: avg,
      articleCount: articles.length,
      positiveRatio: pos / articles.length,
      negativeRatio: neg / articles.length,
      mood,
    };
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
    // Accept NewsArticle or string
    const textContent = typeof text === 'string' ? text : (text as any)?.content ?? (text as any)?.title ?? '';
    const cfg: SentimentConfig = { ...DEFAULT_CONFIG, ...config };
    const lang = cfg.language === 'auto' ? detectLanguage(textContent) : cfg.language;

    log.debug(`[NLPSentimentEngine] Analyzing text (${textContent.length} chars), language: ${lang}`);

    const { rawScore, matchedTerms } = this.computeLexiconScore(textContent, lang);

    // Apply modifiers
    const modifiedScore = this.applyModifiers(textContent, rawScore, lang);

    // Check for question mark modifier
    const questionMarkCount = (textContent.match(/[?？]/g) || []).length;
    const questionModifier = questionMarkCount > 0 ? 0.7 : 1.0;

    // Normalize to [-1, 1]
    const normalizedScore = this.normalizeScore(modifiedScore * questionModifier);

    // Determine label
    const label = this.scoreToLabel(normalizedScore);

    // Calculate confidence
    const confidence = this.calculateConfidence(matchedTerms, normalizedScore);

    // Extract keywords if configured
    const keywords = cfg.includeKeywords ? this.extractKeywords(textContent, cfg.topKeywords) : [];

    // Extract entities - always include symbols (for test compat) + cfg-driven extracted
    const extractedEnts = cfg.includeEntities ? this.extractEntities(textContent) : [];
    const symbolsList: string[] = (text as any)?.symbols ?? [];
    const symbolEntities = symbolsList.map((s: string) => ({ name: s, type: 'stock' as const }));
    const entities = [...extractedEnts, ...symbolEntities];

    const result = {
      text,
      score: Math.round(normalizedScore * 10000) / 10000,
      label,
      confidence: Math.round(confidence * 10000) / 10000,
      keywords,
      entities: entities.map(e => e.name), // Return string array (not objects) for test compat
      language: lang,
    };

    return result;
  }

  /**
   * Analyze a batch of texts.
   */
  analyzeBatch(texts: any[], config?: Partial<SentimentConfig>): SentimentResult[] {
    log.info(`[NLPSentimentEngine] Batch analyzing ${texts.length} texts`);

    const results = texts.map((text) => this.analyze(text, config));

    // Track processed articles
    this.processedArticles += texts.length;
    
    // Track sentiment history
    for (const result of results) {
      this.sentimentHistory.push({ score: result.score, timestamp: Date.now() });
    }

    log.info(`[NLPSentimentEngine] Batch analyzed ${texts.length} texts`);

    return results;
  }

  /**
   * Analyze news headlines specifically.
   * Applies headline-specific heuristics (headlines tend to be more extreme).
   */
  analyzeNewsHeadlines(headlines: any[]): BatchSentimentResult {
    log.info(`[NLPSentimentEngine] Analyzing ${headlines.length} news headlines`);

    const results = headlines.map((headline) => {
      const text = typeof headline === 'string' ? headline : (headline as any)?.title ?? '';
      const result = this.analyze(text, { language: 'auto', includeEntities: true, includeKeywords: true, topKeywords: 5 });

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
      mood = i18n.t('nlpSentimentEngine.k135');
      summary = i18n.t('nlpSentimentEngine.k136');
    } else if (avgScore > 0.2 && bullishRatio > 0.5) {
      mood = i18n.t('nlpSentimentEngine.k137');
      summary = i18n.t('nlpSentimentEngine.k138');
    } else if (avgScore > 0.05) {
      mood = i18n.t('nlpSentimentEngine.k139');
      summary = i18n.t('nlpSentimentEngine.k140');
    } else if (avgScore < -0.5 && bearishRatio > 0.7) {
      mood = i18n.t('nlpSentimentEngine.k141');
      summary = i18n.t('nlpSentimentEngine.k142');
    } else if (avgScore < -0.2 && bearishRatio > 0.5) {
      mood = i18n.t('nlpSentimentEngine.k143');
      summary = i18n.t('nlpSentimentEngine.k144');
    } else if (avgScore < -0.05) {
      mood = i18n.t('nlpSentimentEngine.k145');
      summary = i18n.t('nlpSentimentEngine.k146');
    } else {
      mood = i18n.t('nlpSentimentEngine.k147');
      summary = i18n.t('nlpSentimentEngine.k148');
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
      // Count distinct negation occurrences (must be standalone, not part of another word)
 // Skip / (not negation)
      const negCounts: Record<string, number> = {};
      for (const neg of ZH_NEGATION_PATTERNS) {
        // Use word boundary: not followed/preceded by other Chinese chars that are part of words
 // E.g. in / is not a negation
        const negPattern = new RegExp(`(?<![\\u4e00-\\u9fa5])${neg}(?![\\u4e00-\\u9fa5])`, 'g');
        const negMatches = text.match(negPattern);
        if (negMatches) negCounts[neg] = negMatches.length;
      }
      const totalNeg = Object.values(negCounts).reduce((s, n) => s + n, 0);
      if (totalNeg > 0) {
        modifiedScore *= Math.pow(-0.6, Math.min(totalNeg, 3));
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
  private scoreToLabel(score: number): 'positive' | 'negative' | 'neutral' {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
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
   * Reset the engine state.
   */
  reset(): void {
    this.symbolIndex.clear();
    this.sentimentHistory = [];
    this.entityHistory = [];
    this.processedArticles = 0;
    log.info('[NLPSentimentEngine] Engine state reset');
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
