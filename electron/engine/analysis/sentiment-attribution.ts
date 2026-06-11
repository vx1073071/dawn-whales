// ── Q61: Sentiment Attribution Engine ──────────────────────────────────────────
// Breaks composite sentiment into sector/stock level contributions
// Topic modeling + Sector exposure weighting + News情感的归因

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SentimentAttributionResult {
  symbol: string;
  compositeSentiment: number;  // -1 to +1
  attribution: {
    topic: string;
    contribution: number;      // How much this topic drove the sentiment
    weight: number;           // Topic weight in this stock
    examples: string[];
  }[];
  sectorSentiment: Record<string, number>;
  peerComparison: {
    symbol: string;
    sentiment: number;
    relativeScore: number;    // vs sector average
  }[];
  drivers: string[];          // Top bullish/bearish drivers
  riskFactors: string[];
  timestamp: number;
}

export interface MarketSentimentAttribution {
  overallMarket: number;
  date: string;
  bySector: Record<string, {
    sentiment: number;
    contribution: number;      // % contribution to market sentiment
    topDrivers: string[];
    topRisks: string[];
  }>;
  sectorRotationSignal: 'EARLY' | 'CONFIRMED' | 'REVERSING';
  attributionModel: 'LINEAR' | 'NONLINEAR' | 'BAYESIAN';
  timestamp: number;
}

// ── Sentiment Attribution Engine ─────────────────────────────────────────

export class SentimentAttributionEngine {
  private topicKeywords: Record<string, string[]>;

  constructor() {
    this.topicKeywords = {
      'RATE_HIKE': ['interest rate', 'fed hike', 'rate increase', 'tightening', 'yield rise', 'bond selloff'],
      'RATE_CUT': ['rate cut', 'fed pivot', 'easing', 'yield drop', 'bond rally', 'stimulus'],
      'INFLATION': ['inflation', 'CPI', 'PPI', 'price surge', 'cost push', 'hot economy'],
      'DEFLATION': ['deflation', 'price drop', 'disinflation', 'falling prices', 'weak demand'],
      'GROWTH': ['GDP beat', 'jobs report', 'NFP', 'PMI beat', 'economic expansion', 'GDP growth'],
      'RECESSION': ['recession', 'GDP miss', 'layoffs', 'job cuts', 'slowdown', 'contraction'],
      'EARNINGS_BEAT': ['earnings beat', 'revenue beat', 'EPS beat', 'guidance raise', 'outperform'],
      'EARNINGS_MISS': ['earnings miss', 'revenue miss', 'EPS miss', 'guidance cut', 'underperform'],
      'M&A': ['acquisition', 'merger', 'takeover', 'buyout', 'deal', 'M&A'],
      'REGULATORY': ['SEC', 'investigation', 'antitrust', 'fine', 'regulation', 'compliance'],
      'GEOPOLITICAL': ['tariff', 'sanction', 'war', 'conflict', 'trade deal', 'diplomacy'],
      'TECH': ['AI', 'chip', 'semiconductor', 'cloud', 'software', 'tech rally'],
      'FINANCE': ['bank', 'credit', 'loan', 'mortgage', 'lending', 'financial'],
      'ENERGY': ['oil', 'crude', 'OPEC', 'gas', 'energy price', 'renewable'],
      'HEALTHCARE': ['FDA', 'drug approval', 'clinical trial', 'vaccine', 'biotech', 'pharma'],
      'CONSUMER': ['retail sales', 'consumer spending', 'confidence', 'retail', 'discretionary'],
    };
    log.info('[SentimentAttributionEngine] Initialized');
  }

  // ── Attribute Sentiment per Symbol ───────────────────────────────────

  attribute(
    symbol: string,
    compositeSentiment: number,
    newsItems: Array<{ headline: string; sentiment: number; topic?: string; date: string }>
  ): SentimentAttributionResult {
    const topicScores: Record<string, number[]> = {};
    const topicExamples: Record<string, string[]> = {};

    for (const item of newsItems) {
      const topic = item.topic ?? this.classifyTopic(item.headline);
      if (!topicScores[topic]) {
        topicScores[topic] = [];
        topicExamples[topic] = [];
      }
      topicScores[topic].push(item.sentiment);
      if (topicExamples[topic].length < 3) {
        topicExamples[topic].push(item.headline);
      }
    }

    const attribution = Object.entries(topicScores).map(([topic, scores]) => {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const weight = scores.length / newsItems.length;
      return {
        topic,
        contribution: Math.round(avgScore * weight * 100) / 100,
        weight: Math.round(weight * 100) / 100,
        examples: topicExamples[topic] ?? [],
      };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const sectorSentiment: Record<string, number> = {};
    for (const item of newsItems) {
      const topic = item.topic ?? this.classifyTopic(item.headline);
      const sector = this.topicToSector(topic);
      if (!sector) continue;
      sectorSentiment[sector] = (sectorSentiment[sector] ?? 0) + item.sentiment / newsItems.length;
    }
    for (const s of Object.keys(sectorSentiment)) {
      sectorSentiment[s] = Math.round(sectorSentiment[s] * 100) / 100;
    }

    const drivers: string[] = attribution.filter(a => a.contribution > 0).slice(0, 3).map(a =>
      `📈 ${a.topic}: +${a.contribution.toFixed(2)}`
    );
    const riskFactors: string[] = attribution.filter(a => a.contribution < 0).slice(0, 3).map(a =>
      `📉 ${a.topic}: ${a.contribution.toFixed(2)}`
    );

    return {
      symbol,
      compositeSentiment: Math.round(compositeSentiment * 100) / 100,
      attribution,
      sectorSentiment,
      peerComparison: [],
      drivers,
      riskFactors,
      timestamp: Date.now(),
    };
  }

  // ── Market-Level Attribution ──────────────────────────────────────────

  attributeMarket(
    marketSentiment: number,
    sectorSentiments: Record<string, number>,
    sectorWeights: Record<string, number>
  ): MarketSentimentAttribution {
    const bySector: MarketSentimentAttribution['bySector'] = {};

    let totalContribution = 0;
    for (const [sector, sentiment] of Object.entries(sectorSentiments)) {
      const weight = sectorWeights[sector] ?? 0.1;
      const contribution = sentiment * weight;
      totalContribution += contribution;

      bySector[sector] = {
        sentiment: Math.round(sentiment * 100) / 100,
        contribution: Math.round(contribution * 100) / 100,
        topDrivers: this.getSectorDrivers(sector, sentiment),
        topRisks: this.getSectorRisks(sector, sentiment),
      };
    }

    // Rotation signal
    const sectorSentimentValues = Object.values(sectorSentiments);
    const avgSector = sectorSentimentValues.reduce((a, b) => a + b, 0) / Math.max(sectorSentimentValues.length, 1);
    let rotationSignal: MarketSentimentAttribution['sectorRotationSignal'];
    const positiveSectors = sectorSentimentValues.filter(v => v > avgSector).length;
    if (positiveSectors >= sectorSentimentValues.length * 0.6) rotationSignal = 'CONFIRMED';
    else if (positiveSectors >= sectorSentimentValues.length * 0.4) rotationSignal = 'EARLY';
    else rotationSignal = 'REVERSING';

    return {
      overallMarket: Math.round(marketSentiment * 100) / 100,
      date: new Date().toISOString().split('T')[0],
      bySector,
      sectorRotationSignal: rotationSignal,
      attributionModel: 'LINEAR',
      timestamp: Date.now(),
    };
  }

  // ── Topic Classification ─────────────────────────────────────────────

  classifyTopic(headline: string): string {
    const lower = headline.toLowerCase();
    let bestTopic = 'GENERAL';
    let bestScore = 0;
    for (const [topic, keywords] of Object.entries(this.topicKeywords)) {
      const score = keywords.filter(k => lower.includes(k.toLowerCase())).length;
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }
    return bestScore > 0 ? bestTopic : 'GENERAL';
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private topicToSector(topic: string): string | null {
    const map: Record<string, string> = {
      TECH: 'Technology', FINANCE: 'Financials', ENERGY: 'Energy',
      HEALTHCARE: 'Healthcare', CONSUMER: 'Consumer Discretionary',
      RATE_HIKE: 'Financials', RATE_CUT: 'Financials',
      INFLATION: 'Consumer Staples', RECESSION: 'Consumer Discretionary',
      GEOPOLITICAL: 'Energy', 'M&A': 'Financials',
    };
    return map[topic] ?? null;
  }

  private getSectorDrivers(sector: string, sentiment: number): string[] {
    if (sentiment <= 0) return [];
    const drivers: Record<string, string[]> = {
      Technology: [i18n.t('SentimentAttribution.k0'), 'Cloud growth', 'Semiconductor cycle up'],
      Financials: ['NIM expansion', 'Credit growth', 'Fee income up'],
      Energy: ['Oil demand up', 'OPEC+ supply discipline', 'Clean energy investment'],
      Healthcare: ['Drug pipeline progress', 'Aging demographics', 'Innovation'],
      'Consumer Discretionary': ['Spending resilient', 'Travel recovery', 'Auto sales beat'],
    };
    return drivers[sector] ?? ['Sector momentum positive'];
  }

  private getSectorRisks(sector: string, sentiment: number): string[] {
    if (sentiment >= 0) return [];
    const risks: Record<string, string[]> = {
      Technology: ['Regulatory scrutiny', ' valuation concerns', 'Chip export restrictions'],
      Financials: ['Credit quality deterioration', 'Rate volatility', 'Property exposure'],
      Energy: ['Demand uncertainty', 'Carbon policy risk', 'Commodity price volatility'],
      Healthcare: ['Drug pricing pressure', 'Patent cliffs', 'Regulatory delays'],
      'Consumer Discretionary': ['Consumer slowdown', 'Rising defaults', 'Discretionary compression'],
    };
    return risks[sector] ?? ['Sector momentum negative'];
  }

  // ── Compare with Peers ────────────────────────────────────────────────

  compareWithPeers(
    symbol: string,
    sentiment: number,
    peers: Array<{ symbol: string; sentiment: number; sector: string }>
  ): SentimentAttributionResult['peerComparison'] {
    const sectorPeers = peers.filter(p => p.symbol !== symbol);
    const avgSentiment = sectorPeers.reduce((a, b) => a + b.sentiment, 0) / Math.max(sectorPeers.length, 1);

    return sectorPeers.map(p => ({
      symbol: p.symbol,
      sentiment: p.sentiment,
      relativeScore: Math.round((p.sentiment - avgSentiment) * 100) / 100,
    })).sort((a, b) => b.relativeScore - a.relativeScore);
  }
}

export default SentimentAttributionEngine;