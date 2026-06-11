// ── JVS-25 (PM Round 2): Smart Picker () ──────────────────────
// Multi-dimensional stock scoring: fundamental + technical + capital flow + sentiment
// Outputs Top 10 recommendations with reasoning
// IPC: em:smart-pick

import log from 'electron-log';
import { EngineError } from '../core/engine-error';
import { getStockCapitalFlowRank } from '../analysis/capital-flow-rank';
import { getDragonTigerList } from '../data/dragon-tiger-list';
import { getFundIncreaseRank } from '../data/fund-holdings';
import { SentimentIndexEngine } from '../analysis/sentiment-index';
import { NewsAggregatorService } from '../data/news-aggregator';
import { StockAnomalyDetector } from '../data/stock-anomaly-detector';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SmartPickRequest {
  market?: 'HK' | 'US' | 'all';
  limit?: number;            // Top N results (default 10)
  minScore?: number;         // Minimum score threshold (0-100)
  weights?: {
    capitalFlow?: number;    // Default 0.30
    dragonTiger?: number;    // Default 0.15
    fundHolding?: number;    // Default 0.20
    sentiment?: number;      // Default 0.15
    technical?: number;      // Default 0.20
  };
}

export interface SmartPickResult {
  code: string;
  name: string;
  totalScore: number;        // 0-100
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  scores: {
    capitalFlow: number;
    dragonTiger: number;
    fundHolding: number;
    sentiment: number;
    technical: number;
  };
  reasons: string[];         // Why this stock was picked
  signals: string[];         // Active signals
  risks: string[];           // Risk warnings
}

export interface SmartPickReport {
  success: boolean;
  picks: SmartPickResult[];
  total: number;
  market: string;
  timestamp: number;
  summary: string;
  error?: string;
}

// ── Default Weights ────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  capitalFlow: 0.30,
  dragonTiger: 0.15,
  fundHolding: 0.20,
  sentiment: 0.15,
  technical: 0.20,
};

// ── Smart Picker Service ───────────────────────────────────────────────────

export class SmartPickerService {
  private sentimentEngine: SentimentIndexEngine;
  private newsAggregator: NewsAggregatorService;
  private anomalyDetector: StockAnomalyDetector;

  constructor() {
    this.sentimentEngine = new SentimentIndexEngine();
    this.newsAggregator = new NewsAggregatorService();
    this.anomalyDetector = new StockAnomalyDetector();
    log.info('[SmartPicker] Initialized');
  }

  async pick(request: SmartPickRequest = {}): Promise<SmartPickReport> {
    const limit = request.limit || 10;
    const minScore = request.minScore || 0;
    const weights = { ...DEFAULT_WEIGHTS, ...request.weights };
    const market = request.market || 'HK';

    log.info(`[SmartPicker] Scoring stocks, market: ${market}, limit: ${limit}`);

    try {
      // Step 1: Gather candidate stocks from multiple sources
      const candidates = new Map<string, { name: string; signals: string[]; scores: any }>();

      // Source 1: Capital flow top 100
      const cfResult = await getStockCapitalFlowRank('mainNetInflow', 'desc', 100);
      if (cfResult.success && cfResult.items) {
        for (const item of cfResult.items as any[]) {
          const code = item.code;
          if (!candidates.has(code)) {
            candidates.set(code, { name: item.name, signals: [], scores: {} });
          }
          const c = candidates.get(code)!;
          c.scores.capitalFlow = this.scoreCapitalFlow(item);
          if (item.mainNetInflow > 5000) c.signals.push(i18n.t('smartPicker.k1'));
          if (item.mainNetInflow > 0 && item.changePct > 3) c.signals.push(i18n.t('smartPicker.k2'));
        }
      }

      // Source 2: Dragon Tiger list
      const dtResult = await getDragonTigerList();
      if (dtResult.success && dtResult.entries) {
        for (const item of dtResult.entries as any[]) {
          const code = item.code;
          if (!candidates.has(code)) {
            candidates.set(code, { name: item.name, signals: [], scores: {} });
          }
          const c = candidates.get(code)!;
          c.scores.dragonTiger = this.scoreDragonTiger(item);
          if (item.netBuyAmount > 0) c.signals.push(i18n.t('smartPicker.k3'));
          if (item.reason) c.signals.push(i18n.t('smartPicker.k4'));
        }
      }

      // Source 3: Fund increase rank
      try {
        const fundResult = await getFundIncreaseRank(50);
        if (Array.isArray(fundResult)) {
          for (const item of fundResult as any[]) {
            const code = item.code;
            if (!candidates.has(code)) {
              candidates.set(code, { name: item.name, signals: [], scores: {} });
            }
            const c = candidates.get(code)!;
            c.scores.fundHolding = this.scoreFundHolding(item);
            if (item.fundCount > 10) c.signals.push(i18n.t('smartPicker.k5'));
          }
        }
      } catch (e) {
    // [EngineError:AI] — structured error tracking
    void EngineError; // structured error domain: AI
    logger.error('[backend:smart-picker]', e); }

      // Step 2: Score sentiment and technical for all candidates
      const newsResult = await this.newsAggregator.search({ query: 'HK market', hoursBack: 24, limit: 5 });
      const marketSentiment = newsResult.sentimentSummary?.avgScore || 0;

      for (const [code, c] of candidates) {
        // Sentiment score (stock-specific news if available, else market sentiment)
        try {
          const stockNews = await this.newsAggregator.search({ query: code, hoursBack: 48, limit: 5 });
          c.scores.sentiment = stockNews.sentimentSummary?.avgScore
            ? Math.max(0, Math.min(100, (stockNews.sentimentSummary.avgScore + 1) * 50))
            : Math.max(0, Math.min(100, (marketSentiment + 1) * 50));
        } catch (_e: unknown) {
          c.scores.sentiment = 50;
        }

        // Technical score (simplified - use changePct + volume as proxy)
        c.scores.technical = c.scores.capitalFlow ? Math.min(100, c.scores.capitalFlow * 0.7 + 15) : 50;

        // Set defaults for missing scores
        c.scores.capitalFlow = c.scores.capitalFlow ?? 50;
        c.scores.dragonTiger = c.scores.dragonTiger ?? 50;
        c.scores.fundHolding = c.scores.fundHolding ?? 50;
      }

      // Step 3: Calculate weighted total score
      const results: SmartPickResult[] = [];

      for (const [code, c] of candidates) {
        const totalScore = Math.round(
          c.scores.capitalFlow * weights.capitalFlow +
          c.scores.dragonTiger * weights.dragonTiger +
          c.scores.fundHolding * weights.fundHolding +
          c.scores.sentiment * weights.sentiment +
          c.scores.technical * weights.technical
        );

        if (totalScore < minScore) continue;

        // Grade
        let grade: SmartPickResult['grade'];
        if (totalScore >= 80) grade = 'S';
        else if (totalScore >= 70) grade = 'A';
        else if (totalScore >= 60) grade = 'B';
        else if (totalScore >= 50) grade = 'C';
        else grade = 'D';

        // Reasons
        const reasons: string[] = [];
        if (c.scores.capitalFlow >= 70) reasons.push(i18n.t('smartPicker.k6'));
        if (c.scores.dragonTiger >= 70) reasons.push(i18n.t('smartPicker.k7'));
        if (c.scores.fundHolding >= 70) reasons.push(i18n.t('smartPicker.k8'));
        if (c.scores.sentiment >= 70) reasons.push(i18n.t('smartPicker.k9'));
        if (c.scores.technical >= 70) reasons.push(i18n.t('smartPicker.k10'));
        if (reasons.length === 0) reasons.push(i18n.t('smartPicker.k11'));

        // Risks
        const risks: string[] = [];
        if (c.scores.capitalFlow < 30) risks.push(i18n.t('smartPicker.k12'));
        if (c.scores.sentiment < 30) risks.push(i18n.t('smartPicker.k13'));
        if (c.scores.technical < 30) risks.push(i18n.t('smartPicker.k14'));

        results.push({
          code,
          name: c.name,
          totalScore,
          grade,
          scores: {
            capitalFlow: Math.round(c.scores.capitalFlow),
            dragonTiger: Math.round(c.scores.dragonTiger),
            fundHolding: Math.round(c.scores.fundHolding),
            sentiment: Math.round(c.scores.sentiment),
            technical: Math.round(c.scores.technical),
          },
          reasons,
          signals: c.signals,
          risks,
        });
      }

      // Sort by total score
      results.sort((a, b) => b.totalScore - a.totalScore);
      const topPicks = results.slice(0, limit);

      // Summary
      const sCount = topPicks.filter(p => p.grade === 'S').length;
      const aCount = topPicks.filter(p => p.grade === 'A').length;
      const summary = i18n.t('smartPicker.k15');

      log.info(`[SmartPicker] Done: ${topPicks.length} picks from ${candidates.size} candidates`);

      return {
        success: true,
        picks: topPicks,
        total: candidates.size,
        market,
        timestamp: Date.now(),
        summary,
      };
    } catch (err: unknown) {
      log.error('[SmartPicker] Error:', err.message);
      return {
        success: false,
        picks: [],
        total: 0,
        market,
        timestamp: Date.now(),
        summary: '',
        error: err.message,
      };
    }
  }

  private scoreCapitalFlow(item: unknown): number {
    let score = 50;
    const mainNet = item.mainNetInflow || 0;

    if (mainNet > 10000) score = 90;       // > 100M
    else if (mainNet > 5000) score = 80;   // > 50M
    else if (mainNet > 2000) score = 70;   // > 200.0M
    else if (mainNet > 500) score = 60;    // > 50.0M
    else if (mainNet > 0) score = 55;
    else if (mainNet > -500) score = 45;
    else if (mainNet > -2000) score = 35;
    else score = 20;

    return score;
  }

  private scoreDragonTiger(item: unknown): number {
    let score = 50;
    const netBuy = item.netBuyAmount || 0;

    if (netBuy > 10000) score = 95;
    else if (netBuy > 5000) score = 85;
    else if (netBuy > 1000) score = 75;
    else if (netBuy > 0) score = 65;
    else if (netBuy > -1000) score = 40;
    else score = 25;

    return score;
  }

  private scoreFundHolding(item: unknown): number {
    let score = 50;
    const fundCount = item.fundCount || 0;
    const increaseCount = item.increaseCount || 0;

    if (fundCount > 50) score = 90;
    else if (fundCount > 30) score = 80;
    else if (fundCount > 20) score = 70;
    else if (fundCount > 10) score = 60;
    else if (fundCount > 5) score = 55;
    else score = 45;

    if (increaseCount > 5) score = Math.min(100, score + 10);

    return score;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let smartPickerInstance: SmartPickerService | null = null;

export function getSmartPicker(): SmartPickerService {
  if (!smartPickerInstance) {
    smartPickerInstance = new SmartPickerService();
  }
  return smartPickerInstance;
}
