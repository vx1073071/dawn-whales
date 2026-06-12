// @ts-nocheck
// ── Q40: News Sentiment Engine v2 ────────────────────────────────────────────
// Fine-grained sentiment scoring (bullish/bearish/neutral 0-1)
// Source weighting + Time decay + Event-driven sentiment shift

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  url?: string;
  source: NewsSource;
  publishedAt: number;       // Unix timestamp (ms)
  symbols?: string[];        // Related symbols
  sentimentScore?: number;  // Raw sentiment -1 to +1
  sentimentLabel?: 'bullish' | 'bearish' | 'neutral';
}

export type NewsSource =
  | 'Reuters' | 'Bloomberg' | 'WSJ' | 'CNBC' | 'FT'
  | 'Sina' | 'Caixin' | 'SecuritiesTimes' | i18n.t('newsSentimentV2.k1')
  | 'AAstocks' | 'eastmoney' | 'futunn'
  | 'Twitter' | 'Reddit' | 'forum';

export interface SentimentAggregate {
  symbol: string;
  score: number;            // Weighted average 0-1
  label: 'bullish' | 'bearish' | 'neutral';
  confidence: number;       // 0-1
  nArticles: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  scoreTrend: number;       // vs previous period
  topSources: Array<{ source: string; score: number; weight: number }>;
  topHeadlines: Array<{ title: string; score: number; publishedAt: number }>;
  eventDrivenShift?: number;
  timestamp: number;
}

export interface EventSentimentShift {
  event: string;
  pattern: string;          // Keyword pattern
  sentimentShift: number;  // Expected shift in sentiment
  confidence: number;       // How reliable is this shift
  examples: string[];
}

export interface NewsSentimentConfig {
  sourceWeights: Partial<Record<NewsSource, number>>;
  decayHalfLifeHours: number;
  minConfidence: number;
  eventShifts: EventSentimentShift[];
}

// ── Source Weights ─────────────────────────────────────────────────────

const DEFAULT_SOURCE_WEIGHTS: Record<NewsSource, number> = {
  Reuters: 1.0,
  Bloomberg: 1.0,
  WSJ: 0.9,
  FT: 0.9,
  CNBC: 0.8,
  Caixin: 0.8,
  SecuritiesTimes: 0.7,
  Economic Daily: 0.7,
  Sina: 0.6,
  AAstocks: 0.6,
  eastmoney: 0.6,
  futunn: 0.6,
  Twitter: 0.3,
  Reddit: 0.2,
  forum: 0.1,
};

const HALF_LIFE_HOURS = 24; // Sentiment decays half in 24 hours

// ── Keyword Sentiment Dictionary ────────────────────────────────────────

const BULLISH_KEYWORDS = [
  'beat', 'beats', 'exceeded', 'strong', 'growth', 'surge', 'surged', 'rally',
  'upgrade', 'upgraded', 'buy', 'outperform', 'positive', 'optimistic',
  'record', 'high', 'recovery', 'gains', 'profit', 'profitable', 'breakthrough',
  'expansion', 'boom', 'soar', 'jump', 'climb', 'rise', 'increase',
  i18n.t('newsSentimentV2.k2'), i18n.t('newsSentimentV2.k3'), i18n.t('newsSentimentV2.k4'), i18n.t('newsSentimentV2.k5'), i18n.t('newsSentimentV2.k6'), i18n.t('newsSentimentV2.k7'), i18n.t('newsSentimentV2.k8'), i18n.t('newsSentimentV2.k9'), i18n.t('newsSentimentV2.k10'), i18n.t('newsSentimentV2.k11'),
];

const BEARISH_KEYWORDS = [
  'miss', 'missed', 'below', 'weak', 'decline', 'fell', 'drop', 'plunge',
  'downgrade', 'downgraded', 'sell', 'underperform', 'negative', 'pessimistic',
  'loss', 'losses', 'cut', 'warning', 'risk', 'fear', 'concern',
  'recession', 'slowdown', 'bankruptcy', 'fraud', 'investigation',
  i18n.t('newsSentimentV2.k12'), i18n.t('newsSentimentV2.k13'), i18n.t('newsSentimentV2.k14'), i18n.t('newsSentimentV2.k15'), i18n.t('newsSentimentV2.k16'), i18n.t('newsSentimentV2.k17'), i18n.t('newsSentimentV2.k18'), i18n.t('newsSentimentV2.k19'), i18n.t('newsSentimentV2.k20'),
];

// ── Simple Sentiment Scoring ─────────────────────────────────────────────

function scoreTextSentiment(text: string): number {
  const lower = text.toLowerCase();
  let bullish = 0, bearish = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) bullish++;
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) bearish++;
  }

  const total = bullish + bearish;
  if (total === 0) return 0.5; // Neutral

  const rawScore = bullish / total;
  // Map 0-1 where 0 = bearish, 0.5 = neutral, 1 = bullish
  return rawScore;
}

// ── Event-Driven Shifts ─────────────────────────────────────────────────

const DEFAULT_EVENT_SHIFTS: EventSentimentShift[] = [
  {
    event: 'Earnings Beat',
    pattern: i18n.t('newsSentimentV2.k21'),
    sentimentShift: 0.3,
    confidence: 0.9,
    examples: ['EPS beat by 15%', 'Q2 profit soars 40%'],
  },
  {
    event: 'Earnings Miss',
    pattern: 'misses earnings|eps miss|profit warning',
    sentimentShift: -0.3,
    confidence: 0.9,
    examples: ['EPS misses consensus', 'Q3 profit warning'],
  },
  {
    event: 'Analyst Upgrade',
    pattern: 'upgrade|raised to buy|upgraded',
    sentimentShift: 0.15,
    confidence: 0.8,
    examples: ['Analyst upgrades to Buy', 'Target raised 20%'],
  },
  {
    event: 'Analyst Downgrade',
    pattern: 'downgrade|cut to sell|downgraded',
    sentimentShift: -0.15,
    confidence: 0.8,
    examples: ['Analyst downgrades to Sell', 'Target cut 30%'],
  },
  {
    event: 'M&A Rumor',
    pattern: i18n.t('newsSentimentV2.k22'),
    sentimentShift: 0.2,
    confidence: 0.7,
    examples: ['In talks for acquisition', 'Merger speculation'],
  },
  {
    event: 'Regulatory Investigation',
    pattern: i18n.t('newsSentimentV2.k23'),
    sentimentShift: -0.25,
    confidence: 0.85,
    examples: ['Under SEC investigation', 'Regulatory probe'],
  },
  {
    event: 'Product Launch Success',
    pattern: i18n.t('newsSentimentV2.k24'),
    sentimentShift: 0.15,
    confidence: 0.7,
    examples: ['Product launch exceeds targets', 'New model sold out'],
  },
  {
    event: 'Macro Risk-Off',
    pattern: i18n.t('newsSentimentV2.k25'),
    sentimentShift: -0.2,
    confidence: 0.75,
    examples: ['Trade war escalation', 'New tariff announced'],
  },
];

// ── News Sentiment Engine ─────────────────────────────────────────────────

export class NewsSentimentEngine {
  private config: NewsSentimentConfig;

  constructor(config?: Partial<NewsSentimentConfig>) {
    this.config = {
      sourceWeights: {},
      decayHalfLifeHours: HALF_LIFE_HOURS,
      minConfidence: 0.3,
      eventShifts: DEFAULT_EVENT_SHIFTS,
      ...config,
    };
    log.info('[NewsSentimentEngine] Initialized', this.config);
  }

  // ── Score Single Article ─────────────────────────────────────────────

  scoreArticle(news: NewsItem): number {
    const text = `${news.title} ${news.body}`;
    const rawScore = scoreTextSentiment(text);

    // Event-driven shift
    let eventShift = 0;
    for (const shift of this.config.eventShifts) {
      const regex = new RegExp(shift.pattern, 'i');
      if (regex.test(text)) {
        eventShift += shift.sentimentShift * shift.confidence;
      }
    }

    const score = Math.max(0, Math.min(1, rawScore + eventShift));
    return Math.round(score * 1000) / 1000;
  }

  // ── Aggregate by Symbol ─────────────────────────────────────────────

  aggregateBySymbol(news: NewsItem[]): SentimentAggregate[] {
    const bySymbol = new Map<string, NewsItem[]>();
    const now = Date.now();

    for (const item of news) {
      if (!item.symbols || item.symbols.length === 0) continue;
      for (const sym of item.symbols) {
        const arr = bySymbol.get(sym) ?? [];
        arr.push(item);
        bySymbol.set(sym, arr);
      }
    }

    const aggregates: SentimentAggregate[] = [];

    for (const [symbol, items] of bySymbol) {
      const scored = items.map(item => ({
        ...item,
        sentimentScore: item.sentimentScore ?? this.scoreArticle(item),
      }));

      // Weighted average with time decay
      let weightedSum = 0, totalWeight = 0;
      const halfLifeMs = this.config.decayHalfLifeHours * 3600 * 1000;

      for (const item of scored) {
        const age = now - item.publishedAt;
        const decay = Math.exp(-age / halfLifeMs);
        const sourceWeight = this.config.sourceWeights[item.source] ??
          DEFAULT_SOURCE_WEIGHTS[item.source] ?? 0.5;
        const weight = decay * sourceWeight;

        weightedSum += item.sentimentScore * weight;
        totalWeight += weight;
      }

      const score = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
      const confidence = Math.min(1, scored.length / 10) * (totalWeight / scored.length);

      const bullish = scored.filter(s => s.sentimentScore > 0.6).length;
      const bearish = scored.filter(s => s.sentimentScore < 0.4).length;
      const neutral = scored.length - bullish - bearish;

      let label: SentimentAggregate['label'];
      if (score > 0.55) label = 'bullish';
      else if (score < 0.45) label = 'bearish';
      else label = 'neutral';

      // Top sources
      const sourceMap = new Map<string, { sum: number; weight: number; count: number }>();
      for (const item of scored) {
        const sw = this.config.sourceWeights[item.source] ??
          DEFAULT_SOURCE_WEIGHTS[item.source] ?? 0.5;
        const prev = sourceMap.get(item.source) ?? { sum: 0, weight: 0, count: 0 };
        sourceMap.set(item.source, {
          sum: prev.sum + item.sentimentScore * sw,
          weight: prev.weight + sw,
          count: prev.count + 1,
        });
      }

      const topSources = [...sourceMap.entries()]
        .map(([source, data]) => ({
          source,
          score: Math.round((data.sum / data.weight) * 100) / 100,
          weight: Math.round(data.weight * 100) / 100,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

      const topHeadlines = scored
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, 5)
        .map(item => ({
          title: item.title.slice(0, 100),
          score: Math.round(item.sentimentScore * 100) / 100,
          publishedAt: item.publishedAt,
        }));

      aggregates.push({
        symbol,
        score: Math.round(score * 1000) / 1000,
        label,
        confidence: Math.round(confidence * 1000) / 1000,
        nArticles: scored.length,
        bullishPct: Math.round((bullish / scored.length) * 10000) / 100,
        bearishPct: Math.round((bearish / scored.length) * 10000) / 100,
        neutralPct: Math.round((neutral / scored.length) * 10000) / 100,
        scoreTrend: 0, // Would need historical data
        topSources,
        topHeadlines,
        timestamp: now,
      });
    }

    return aggregates.sort((a, b) => b.nArticles - a.nArticles);
  }

  // ── Detect Event Shifts ─────────────────────────────────────────────

  detectEventShift(news: NewsItem[]): Array<{
    event: string;
    symbols: string[];
    shift: number;
    confidence: number;
    headline: string;
  }> {
    const detected: Array<{
      event: string;
      symbols: string[];
      shift: number;
      confidence: number;
      headline: string;
    }> = [];

    for (const item of news) {
      for (const es of this.config.eventShifts) {
        const regex = new RegExp(es.pattern, 'i');
        if (regex.test(`${item.title} ${item.body}`)) {
          detected.push({
            event: es.event,
            symbols: item.symbols ?? [],
            shift: es.sentimentShift,
            confidence: es.confidence,
            headline: item.title.slice(0, 80),
          });
        }
      }
    }

    return detected;
  }

  // ── Generate Full Report ─────────────────────────────────────────────

  generateReport(news: NewsItem[]): {
    overallSentiment: SentimentAggregate | null;
    bySymbol: SentimentAggregate[];
    events: ReturnType<NewsSentimentEngine['detectEventShift']>;
    timestamp: number;
  } {
    const bySymbol = this.aggregateBySymbol(news);
    const events = this.detectEventShift(news);

    const overall = bySymbol.length > 0
      ? {
        ...bySymbol[0],
        symbol: 'OVERALL',
        score: bySymbol.reduce((s, a) => s + a.score, 0) / bySymbol.length,
        nArticles: bySymbol.reduce((s, a) => s + a.nArticles, 0),
        bullishPct: bySymbol.reduce((s, a) => s + a.bullishPct, 0) / bySymbol.length,
        bearishPct: bySymbol.reduce((s, a) => s + a.bearishPct, 0) / bySymbol.length,
        neutralPct: bySymbol.reduce((s, a) => s + a.neutralPct, 0) / bySymbol.length,
      }
      : null;

    return {
      overallSentiment: overall,
      bySymbol,
      events,
      timestamp: Date.now(),
    };
  }

  getConfig(): NewsSentimentConfig {
    return {
      ...this.config,
      sourceWeights: { ...this.config.sourceWeights },
    };
  }
}

export default NewsSentimentEngine;