// ── JVS R158: Asset Diagnosis (Multi-Asset) ────────────────────────────────
// Replaces stock-diagnosis.ts (A-stock focused) with multi-asset diagnosis
// Supports: US stocks, HK stocks, Crypto (spot+perp), Options, Futures
// Integrates: capital flow, fund ownership, institutional flow, news, anomalies

import log from 'electron-log';

import { getStockCapitalFlowRank, getSectorCapitalFlowRank } from '../analysis/capital-flow-rank';
import { getStockFundOwnership } from './fund-holdings';
import { getInstitutionalFlow } from './institutional-flow';
import { SentimentIndexEngine } from '../analysis/sentiment-index';
import { StockAnomalyDetector } from './stock-anomaly-detector';
import { NewsAggregator } from './news-aggregator';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';

// ── Types ──────────────────────────────────────────────────────────────────

export type AssetMarket = 'US' | 'HK' | 'CRYPTO' | 'FUTURES' | 'OPTIONS';
export type AssetType = 'stock' | 'crypto_spot' | 'crypto_perp' | 'future' | 'option';

export interface AssetDiagnosisRequest {
  code: string;
  name?: string;
  market?: AssetMarket;
  assetType?: AssetType;
  includeCapitalFlow?: boolean;
  includeFundOwnership?: boolean;
  includeInstitutionalFlow?: boolean;
  includeNews?: boolean;
  includeAnomalies?: boolean;
}

export interface AssetDiagnosisReport {
  success: boolean;
  code: string;
  name: string;
  market: AssetMarket;
  assetType: AssetType;
  timestamp: number;

  overview: {
    score: number;           // 0-100 comprehensive score
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    summary: string;
  };

  dimensions: {
    capitalFlow: DimensionResult;
    fundOwnership: DimensionResult;
    institutionalFlow: DimensionResult;
    news: DimensionResult;
    anomalies: DimensionResult;
  };

  rawData: Record<string, unknown>;

  error?: string;
}

export interface DimensionResult {
  score: number;
  grade: string;
  signal: string;
  detail: string;
  available: boolean;
}

// ── Diagnosis Engine ───────────────────────────────────────────────────────

const SENTIMENT_ENGINE = new SentimentIndexEngine();
const ANOMALY_DETECTOR = new StockAnomalyDetector();
const NEWS_AGGREGATOR = new NewsAggregator();

// Dimension weights per asset type
const WEIGHTS: Record<AssetType, Record<string, number>> = {
  stock: { capitalFlow: 0.25, fundOwnership: 0.20, institutionalFlow: 0.15, news: 0.25, anomalies: 0.15 },
  crypto_spot: { capitalFlow: 0.30, fundOwnership: 0.00, institutionalFlow: 0.25, news: 0.30, anomalies: 0.15 },
  crypto_perp: { capitalFlow: 0.35, fundOwnership: 0.00, institutionalFlow: 0.20, news: 0.25, anomalies: 0.20 },
  future: { capitalFlow: 0.30, fundOwnership: 0.10, institutionalFlow: 0.25, news: 0.20, anomalies: 0.15 },
  option: { capitalFlow: 0.20, fundOwnership: 0.15, institutionalFlow: 0.20, news: 0.25, anomalies: 0.20 },
};

export async function diagnoseAsset(request: AssetDiagnosisRequest): Promise<AssetDiagnosisReport> {
  const { code, name = '', market = 'US', assetType = 'stock' } = request;
  log.info(`[AssetDiagnosis] Diagnosing ${code} ${name} (${market}/${assetType})`);

  const dims: AssetDiagnosisReport['dimensions'] = {
    capitalFlow: makeDefaultDim(),
    fundOwnership: makeDefaultDim(),
    institutionalFlow: makeDefaultDim(),
    news: makeDefaultDim(),
    anomalies: makeDefaultDim(),
  };

  const rawData: Record<string, unknown> = {};

  // ── 1. Capital Flow (multi-market) ──────────────────────────────────
  if (request.includeCapitalFlow !== false) {
    await evalCapitalFlow(code, market, dims, rawData);
  }

  // ── 2. Fund/Institutional Ownership ─────────────────────────────────
  if (request.includeFundOwnership !== false) {
    await evalFundOwnership(code, market, assetType, dims, rawData);
  }

  // ── 3. Institutional Flow (replaces dragon tiger) ─────────────────────
  if (request.includeInstitutionalFlow !== false) {
    await evalInstitutionalFlow(code, market, dims, rawData);
  }

  // ── 4. News Sentiment ───────────────────────────────────────────────
  if (request.includeNews !== false) {
    await evalNews(code, name, dims, rawData);
  }

  // ── 5. Anomalies ────────────────────────────────────────────────────
  if (request.includeAnomalies !== false) {
    evalAnomalies(code, dims, rawData);
  }

  // ── Calculate weighted overall score ────────────────────────────────
  const weights = WEIGHTS[assetType];
  const availableDims = Object.entries(dims).filter(([, d]) => d.available);
  let totalWeight = 0;
  let weightedScore = 0;

  for (const [key, dim] of availableDims) {
    const weight = weights[key] || 0.2;
    weightedScore += dim.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

  const grade = scoreToGrade(overallScore);
  const recommendation = scoreToRecommendation(overallScore);

  const report: AssetDiagnosisReport = {
    success: true,
    code,
    name,
    market,
    assetType,
    timestamp: Date.now(),
    overview: {
      score: overallScore,
      grade,
      recommendation,
      summary: `${assetType} diagnosis: ${overallScore}/100 (${grade}) — ${recommendation}`,
    },
    dimensions: dims,
    rawData,
  };

  log.info(`[AssetDiagnosis] ${code}: ${overallScore}/100 (${grade}) ${recommendation}`);
  return report;
}

/**
 * Batch diagnose multiple assets across markets
 */
export async function batchDiagnoseAssets(
  requests: AssetDiagnosisRequest[]
): Promise<AssetDiagnosisReport[]> {
  const results = await Promise.allSettled(
    requests.map(req => diagnoseAsset(req))
  );

  return results.map(r => {
    if (r.status === 'fulfilled') return r.value;
    return makeErrorReport(
      '', '',
      r.reason?.message || 'Unknown error'
    );
  });
}

// ── Dimension Evaluators ───────────────────────────────────────────────────

async function evalCapitalFlow(
  code: string,
  market: AssetMarket,
  dims: AssetDiagnosisReport['dimensions'],
  rawData: Record<string, unknown>
): Promise<void> {
  try {
    let flowResult;

    if (market === 'CRYPTO') {
      // For crypto: use institutional flow as capital flow proxy
      flowResult = await getInstitutionalFlow('CRYPTO', undefined, 100);
      if (flowResult.success) {
        const match = flowResult.entries.find(e => e.code === code);
        rawData.capitalFlow = match || null;
        if (match) {
          dims.capitalFlow = scoreCapitalFlow(match.netBuyAmount);
        }
      }
    } else {
      // For stocks: use existing capital flow rank
      const rankResult = await getStockCapitalFlowRank('mainNetInflow', 'desc', 500);
      if (rankResult.success && rankResult.items) {
        const stockFlow = (rankResult.items as Array<Record<string, unknown>>).find(
          item => item.code === code
        );
        rawData.capitalFlow = stockFlow || null;
        if (stockFlow) {
          const mainNet = (stockFlow.mainNetInflow as number) || 0;
          dims.capitalFlow = scoreCapitalFlow(mainNet);
        }
      }
    }

    if (!dims.capitalFlow.available) {
      dims.capitalFlow = { score: 50, grade: 'C', signal: 'neutral', detail: 'No capital flow data', available: true };
    }
  } catch (err: unknown) {
    log.warn('[AssetDiagnosis] Capital flow error:', (err as Error).message);
    dims.capitalFlow = { score: 45, grade: 'C', signal: 'error', detail: 'Error fetching data', available: false };
  }
}

function scoreCapitalFlow(mainNet: number): DimensionResult {
  if (mainNet > 10000000) return { score: 85, grade: 'A', signal: 'bullish', detail: 'Strong institutional buying', available: true };
  if (mainNet > 3000000) return { score: 70, grade: 'A', signal: 'bullish', detail: 'Moderate institutional buying', available: true };
  if (mainNet > 1000000) return { score: 60, grade: 'B', signal: 'mild_bullish', detail: 'Slight institutional buying', available: true };
  if (mainNet > -1000000) return { score: 50, grade: 'C', signal: 'neutral', detail: 'Balanced flow', available: true };
  if (mainNet > -3000000) return { score: 40, grade: 'D', signal: 'mild_bearish', detail: 'Slight institutional selling', available: true };
  if (mainNet > -10000000) return { score: 25, grade: 'D', signal: 'bearish', detail: 'Institutional selling', available: true };
  return { score: 15, grade: 'F', signal: 'bearish', detail: 'Heavy institutional selling', available: true };
}

async function evalFundOwnership(
  code: string,
  market: AssetMarket,
  assetType: AssetType,
  dims: AssetDiagnosisReport['dimensions'],
  rawData: Record<string, unknown>
): Promise<void> {
  // Fund ownership only applies to stocks (13F for US, HKEX for HK)
  // Crypto and derivatives don't have traditional fund ownership
  if (assetType !== 'stock' && assetType !== 'option') {
    dims.fundOwnership = { score: 50, grade: 'C', signal: 'neutral', detail: 'Not applicable for this asset type', available: false };
    return;
  }

  try {
    const result = await getStockFundOwnership(code);
    rawData.fundOwnership = result;

    if (result.success && result.items) {
      const items = result.items as Array<Record<string, unknown>>;
      const totalFunds = items.length;
      const increaseCount = items.filter(i => (i.sharesChange as number) > 0).length;
      const decreaseCount = items.filter(i => (i.sharesChange as number) < 0).length;

      if (totalFunds > 50 && increaseCount > decreaseCount * 2) {
        dims.fundOwnership = { score: 80, grade: 'A', signal: 'bullish', detail: `${totalFunds} funds, net accumulation`, available: true };
      } else if (totalFunds > 20 && increaseCount > decreaseCount) {
        dims.fundOwnership = { score: 60, grade: 'B', signal: 'mild_bullish', detail: `${totalFunds} funds, mild buying`, available: true };
      } else if (totalFunds > 10) {
        dims.fundOwnership = { score: 50, grade: 'C', signal: 'neutral', detail: `${totalFunds} funds holding`, available: true };
      } else if (totalFunds > 0 && decreaseCount > increaseCount) {
        dims.fundOwnership = { score: 30, grade: 'D', signal: 'bearish', detail: `${totalFunds} funds, reducing`, available: true };
      } else {
        dims.fundOwnership = { score: 20, grade: 'F', signal: 'bearish', detail: 'Minimal fund interest', available: true };
      }
    } else {
      dims.fundOwnership = { score: 40, grade: 'D', signal: 'neutral', detail: 'No fund ownership data', available: true };
    }
  } catch (err: unknown) {
    log.warn('[AssetDiagnosis] Fund ownership error:', (err as Error).message);
    dims.fundOwnership = { score: 40, grade: 'D', signal: 'error', detail: 'Error fetching data', available: false };
  }
}

async function evalInstitutionalFlow(
  code: string,
  market: AssetMarket,
  dims: AssetDiagnosisReport['dimensions'],
  rawData: Record<string, unknown>
): Promise<void> {
  try {
    const instMarket = market === 'CRYPTO' ? 'CRYPTO' : market === 'HK' ? 'HK' : 'US';
    const flowResult = await getInstitutionalFlow(instMarket, undefined, 100);
    rawData.institutionalFlow = flowResult;

    if (flowResult.success && flowResult.entries) {
      const match = flowResult.entries.find(e => e.code === code);
      if (match) {
        const netBuy = match.netBuyAmount || 0;
        if (netBuy > 5000000) {
          dims.institutionalFlow = { score: 85, grade: 'A', signal: 'bullish', detail: 'Heavy institutional buying', available: true };
        } else if (netBuy > 1000000) {
          dims.institutionalFlow = { score: 65, grade: 'B', signal: 'mild_bullish', detail: 'Moderate institutional flow', available: true };
        } else if (netBuy > 0) {
          dims.institutionalFlow = { score: 55, grade: 'C', signal: 'neutral', detail: 'Light institutional buying', available: true };
        } else if (netBuy > -1000000) {
          dims.institutionalFlow = { score: 40, grade: 'D', signal: 'mild_bearish', detail: 'Light institutional selling', available: true };
        } else {
          dims.institutionalFlow = { score: 25, grade: 'D', signal: 'bearish', detail: 'Institutional selling', available: true };
        }
      } else {
        dims.institutionalFlow = { score: 50, grade: 'C', signal: 'neutral', detail: 'No institutional activity detected', available: true };
      }
    } else {
      dims.institutionalFlow = { score: 50, grade: 'C', signal: 'neutral', detail: 'No data available', available: true };
    }
  } catch (err: unknown) {
    log.warn('[AssetDiagnosis] Institutional flow error:', (err as Error).message);
    dims.institutionalFlow = { score: 45, grade: 'C', signal: 'error', detail: 'Error fetching data', available: false };
  }
}

async function evalNews(
  code: string,
  name: string,
  dims: AssetDiagnosisReport['dimensions'],
  rawData: Record<string, unknown>
): Promise<void> {
  try {
    const newsItems = await NEWS_AGGREGATOR.getNewsForSymbols([code]);
    rawData.news = newsItems;

    if (newsItems.length > 0) {
      const avgSentiment = newsItems.reduce((sum, item) => sum + item.sentiment.score, 0) / newsItems.length;
      const conclusion = newsItems[0].sentiment.label;

      if (conclusion === 'positive' && avgSentiment > 0.3) {
        dims.news = { score: 80, grade: 'A', signal: 'bullish', detail: 'Strong positive news sentiment', available: true };
      } else if (conclusion === 'positive') {
        dims.news = { score: 65, grade: 'B', signal: 'mild_bullish', detail: 'Positive news sentiment', available: true };
      } else if (conclusion === 'neutral') {
        dims.news = { score: 50, grade: 'C', signal: 'neutral', detail: 'Mixed news sentiment', available: true };
      } else if (avgSentiment < -0.3) {
        dims.news = { score: 20, grade: 'F', signal: 'bearish', detail: 'Strong negative news sentiment', available: true };
      } else {
        dims.news = { score: 35, grade: 'D', signal: 'mild_bearish', detail: 'Negative news sentiment', available: true };
      }
    } else {
      dims.news = { score: 50, grade: 'C', signal: 'neutral', detail: 'No news available', available: true };
    }
  } catch (err: unknown) {
    log.warn('[AssetDiagnosis] News error:', (err as Error).message);
    dims.news = { score: 45, grade: 'C', signal: 'error', detail: 'Error fetching news', available: false };
  }
}

function evalAnomalies(
  code: string,
  dims: AssetDiagnosisReport['dimensions'],
  rawData: Record<string, unknown>
): void {
  try {
    const alerts = ANOMALY_DETECTOR.getAlerts({ code, limit: 10 });
    rawData.anomalies = alerts;

    const criticalCount = alerts.filter(a => a.level === 'critical').length;
    const warningCount = alerts.filter(a => a.level === 'warning').length;

    if (criticalCount > 0) {
      dims.anomalies = { score: 20, grade: 'F', signal: 'danger', detail: `${criticalCount} critical anomalies`, available: true };
    } else if (warningCount > 2) {
      dims.anomalies = { score: 35, grade: 'D', signal: 'caution', detail: `${warningCount} warnings`, available: true };
    } else if (warningCount > 0) {
      dims.anomalies = { score: 45, grade: 'C', signal: 'neutral', detail: `${warningCount} minor warnings`, available: true };
    } else {
      dims.anomalies = { score: 70, grade: 'B', signal: 'stable', detail: 'No anomalies detected', available: true };
    }
  } catch (err: unknown) {
    log.warn('[AssetDiagnosis] Anomalies error:', (err as Error).message);
    dims.anomalies = { score: 50, grade: 'C', signal: 'error', detail: 'Error checking anomalies', available: false };
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────

function makeDefaultDim(): DimensionResult {
  return { score: 50, grade: 'C', signal: 'neutral', detail: 'No data', available: false };
}

function scoreToGrade(score: number): AssetDiagnosisReport['overview']['grade'] {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function scoreToRecommendation(score: number): AssetDiagnosisReport['overview']['recommendation'] {
  if (score >= 75) return 'strong_buy';
  if (score >= 60) return 'buy';
  if (score >= 45) return 'hold';
  if (score >= 30) return 'sell';
  return 'strong_sell';
}

function makeErrorReport(code: string, name: string, error: string): AssetDiagnosisReport {
  return {
    success: false,
    code,
    name,
    market: 'US',
    assetType: 'stock',
    timestamp: Date.now(),
    overview: { score: 0, grade: 'F', recommendation: 'hold', summary: 'Error' },
    dimensions: {
      capitalFlow: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
      fundOwnership: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
      institutionalFlow: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
      news: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
      anomalies: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
    },
    rawData: {},
    error,
  };
}

// ── Backward-compatible alias ──────────────────────────────────────────────

/**
 * @deprecated Use diagnoseAsset() instead (multi-asset support)
 */
export async function diagnoseStock(request: AssetDiagnosisRequest): Promise<AssetDiagnosisReport> {
  log.warn('[AssetDiagnosis] diagnoseStock is deprecated, using diagnoseAsset');
  return diagnoseAsset({ ...request, assetType: 'stock' });
}
