// ── JVS-14: Stock Diagnosis Aggregator (个股诊断聚合器) ────────────────────
// Combines multiple JVS data modules into a comprehensive stock diagnosis
// Integrates: anomaly, sentiment, capital flow, dragon tiger, fund holdings, news

import log from 'electron-log';
import { getStockCapitalFlowRank } from '../analysis/capital-flow-rank';
import { getStockFundOwnership } from './fund-holdings';
import { getDragonTigerList, getDragonTigerDetail } from './dragon-tiger-list';
import { SentimentIndexEngine } from '../analysis/sentiment-index';
import { StockAnomalyDetector } from './stock-anomaly-detector';
import { NewsAggregatorService } from './news-aggregator';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockDiagnosisRequest {
  code: string;
  name?: string;
  includeCapitalFlow?: boolean;
  includeFundHoldings?: boolean;
  includeDragonTiger?: boolean;
  includeNews?: boolean;
  includeAnomalies?: boolean;
}

export interface StockDiagnosisReport {
  success: boolean;
  code: string;
  name: string;
  timestamp: number;

  // Overview
  overview: {
    score: number;           // 0-100 comprehensive score
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    summary: string;
  };

  // Dimension scores
  dimensions: {
    capitalFlow: DimensionResult;
    fundOwnership: DimensionResult;
    dragonTiger: DimensionResult;
    news: DimensionResult;
    anomalies: DimensionResult;
  };

  // Raw data
  rawData: {
    capitalFlow?: unknown;
    fundHoldings?: unknown;
    dragonTiger?: unknown;
    news?: unknown;
    anomalies?: unknown;
  };

  error?: string;
}

interface DimensionResult {
  score: number;      // 0-100
  grade: string;
  signal: string;
  detail: string;
  available: boolean;
}

// ── Diagnosis Engine ───────────────────────────────────────────────────────

const SENTIMENT_ENGINE = new SentimentIndexEngine();
const ANOMALY_DETECTOR = new StockAnomalyDetector();
const NEWS_AGGREGATOR = new NewsAggregatorService();

// Dimension weights for overall score
const WEIGHTS = {
  capitalFlow: 0.25,
  fundOwnership: 0.20,
  dragonTiger: 0.15,
  news: 0.25,
  anomalies: 0.15,
};

export async function diagnoseStock(request: StockDiagnosisRequest): Promise<StockDiagnosisReport> {
  const { code, name = '' } = request;
  log.info(`[StockDiagnosis] Diagnosing ${code} ${name}`);

  const dimensions: StockDiagnosisReport['dimensions'] = {
    capitalFlow: { score: 50, grade: 'C', signal: 'neutral', detail: 'No data', available: false },
    fundOwnership: { score: 50, grade: 'C', signal: 'neutral', detail: 'No data', available: false },
    dragonTiger: { score: 50, grade: 'C', signal: 'neutral', detail: 'No data', available: false },
    news: { score: 50, grade: 'C', signal: 'neutral', detail: 'No data', available: false },
    anomalies: { score: 50, grade: 'C', signal: 'neutral', detail: 'No data', available: false },
  };

  const rawData: StockDiagnosisReport['rawData'] = {};

  // ── 1. Capital Flow ──────────────────────────────────────────────────
  if (request.includeCapitalFlow !== false) {
    try {
      const flowResult = await getStockCapitalFlowRank('mainNetInflow', 'desc', 500);
      if (flowResult.success && flowResult.items) {
        const stockFlow = flowResult.items.find((item: unknown) => item.code === code);
        rawData.capitalFlow = stockFlow || null;

        if (stockFlow) {
          dimensions.capitalFlow.available = true;
          const mainNet = (stockFlow as any).mainNetInflow || 0;

          if (mainNet > 10000) {
            dimensions.capitalFlow = { score: 85, grade: 'A', signal: 'bullish', detail: `主力净流入 ${(mainNet / 10000).toFixed(2)}亿`, available: true };
          } else if (mainNet > 3000) {
            dimensions.capitalFlow = { score: 65, grade: 'B', signal: 'mild_bullish', detail: `主力净流入 ${mainNet.toFixed(0)}万`, available: true };
          } else if (mainNet > -3000) {
            dimensions.capitalFlow = { score: 50, grade: 'C', signal: 'neutral', detail: `主力资金持平`, available: true };
          } else if (mainNet > -10000) {
            dimensions.capitalFlow = { score: 35, grade: 'D', signal: 'mild_bearish', detail: `主力净流出 ${Math.abs(mainNet).toFixed(0)}万`, available: true };
          } else {
            dimensions.capitalFlow = { score: 15, grade: 'F', signal: 'bearish', detail: `主力净流出 ${(Math.abs(mainNet) / 10000).toFixed(2)}亿`, available: true };
          }
        }
      }
    } catch (err: unknown) {
      log.warn('[StockDiagnosis] Capital flow error:', err.message);
    }
  }

  // ── 2. Fund Holdings ─────────────────────────────────────────────────
  if (request.includeFundHoldings !== false) {
    try {
      const ownershipResult = await getStockFundOwnership(code);
      if (ownershipResult.success && ownershipResult.items) {
        rawData.fundHoldings = ownershipResult;
        dimensions.fundOwnership.available = true;

        const items = ownershipResult.items as any[];
        const totalFunds = items.length;
        const increaseCount = items.filter(i => i.sharesChange > 0).length;
        const decreaseCount = items.filter(i => i.sharesChange < 0).length;

        if (totalFunds > 50 && increaseCount > decreaseCount * 2) {
          dimensions.fundOwnership = { score: 80, grade: 'A', signal: 'bullish', detail: `${totalFunds}家基金持仓，${increaseCount}家增持`, available: true };
        } else if (totalFunds > 20 && increaseCount > decreaseCount) {
          dimensions.fundOwnership = { score: 60, grade: 'B', signal: 'mild_bullish', detail: `${totalFunds}家基金持仓，增持居多`, available: true };
        } else if (totalFunds > 10) {
          dimensions.fundOwnership = { score: 50, grade: 'C', signal: 'neutral', detail: `${totalFunds}家基金持仓`, available: true };
        } else if (totalFunds > 0 && decreaseCount > increaseCount) {
          dimensions.fundOwnership = { score: 30, grade: 'D', signal: 'bearish', detail: `${totalFunds}家基金持仓，减持居多`, available: true };
        } else {
          dimensions.fundOwnership = { score: 20, grade: 'F', signal: 'bearish', detail: '基金持仓极少', available: true };
        }
      }
    } catch (err: unknown) {
      log.warn('[StockDiagnosis] Fund holdings error:', err.message);
    }
  }

  // ── 3. Dragon Tiger ──────────────────────────────────────────────────
  if (request.includeDragonTiger !== false) {
    try {
      const dtResult = await getDragonTigerList();
      if (dtResult.success && dtResult.entries) {
        const dtEntry = dtResult.entries.find((e: unknown) => e.code === code);
        rawData.dragonTiger = dtEntry || null;
        dimensions.dragonTiger.available = true;

        if (dtEntry) {
          const netBuy = (dtEntry as any).netBuyAmount || 0;

          if (netBuy > 10000) {
            dimensions.dragonTiger = { score: 85, grade: 'A', signal: 'bullish', detail: `龙虎榜净买入 ${(netBuy / 10000).toFixed(2)}亿`, available: true };
          } else if (netBuy > 0) {
            dimensions.dragonTiger = { score: 65, grade: 'B', signal: 'mild_bullish', detail: `龙虎榜净买入 ${netBuy.toFixed(0)}万`, available: true };
          } else {
            dimensions.dragonTiger = { score: 35, grade: 'D', signal: 'bearish', detail: `龙虎榜净卖出 ${Math.abs(netBuy).toFixed(0)}万`, available: true };
          }
        } else {
          dimensions.dragonTiger = { score: 50, grade: 'C', signal: 'neutral', detail: '未上龙虎榜', available: true };
        }
      }
    } catch (err: unknown) {
      log.warn('[StockDiagnosis] Dragon tiger error:', err.message);
    }
  }

  // ── 4. News ──────────────────────────────────────────────────────────
  if (request.includeNews !== false) {
    try {
      const newsResult = await NEWS_AGGREGATOR.search({ query: `${code} ${name}`, hoursBack: 72, limit: 20 });
      if (newsResult.success && newsResult.articles) {
        rawData.news = newsResult;
        dimensions.news.available = true;

        const summary = newsResult.sentimentSummary;
        if (summary) {
          if (summary.overallMood === 'bullish' && summary.avgScore > 0.3) {
            dimensions.news = { score: 80, grade: 'A', signal: 'bullish', detail: `舆情积极 (${summary.positive}正面 vs ${summary.negative}负面)`, available: true };
          } else if (summary.overallMood === 'bullish') {
            dimensions.news = { score: 65, grade: 'B', signal: 'mild_bullish', detail: `舆情偏正面`, available: true };
          } else if (summary.overallMood === 'mixed') {
            dimensions.news = { score: 50, grade: 'C', signal: 'neutral', detail: `舆情中性`, available: true };
          } else if (summary.avgScore < -0.3) {
            dimensions.news = { score: 20, grade: 'F', signal: 'bearish', detail: `舆情消极 (${summary.negative}负面消息)`, available: true };
          } else {
            dimensions.news = { score: 35, grade: 'D', signal: 'mild_bearish', detail: `舆情偏负面`, available: true };
          }
        }
      }
    } catch (err: unknown) {
      log.warn('[StockDiagnosis] News error:', err.message);
    }
  }

  // ── 5. Anomalies ─────────────────────────────────────────────────────
  if (request.includeAnomalies !== false) {
    try {
      const alerts = ANOMALY_DETECTOR.getAlerts({ code, limit: 10 });
      rawData.anomalies = alerts;
      dimensions.anomalies.available = true;

      const criticalCount = alerts.filter(a => a.level === 'critical').length;
      const warningCount = alerts.filter(a => a.level === 'warning').length;

      if (criticalCount > 0) {
        dimensions.anomalies = { score: 20, grade: 'F', signal: 'danger', detail: `${criticalCount}个严重异动警报`, available: true };
      } else if (warningCount > 2) {
        dimensions.anomalies = { score: 35, grade: 'D', signal: 'caution', detail: `${warningCount}个异动预警`, available: true };
      } else if (warningCount > 0) {
        dimensions.anomalies = { score: 45, grade: 'C', signal: 'neutral', detail: `${warningCount}个异动提醒`, available: true };
      } else {
        dimensions.anomalies = { score: 70, grade: 'B', signal: 'stable', detail: '近期无异动', available: true };
      }
    } catch (err: unknown) {
      log.warn('[StockDiagnosis] Anomalies error:', err.message);
    }
  }

  // ── Calculate overall score ──────────────────────────────────────────
  const availableDimensions = Object.entries(dimensions).filter(([, d]) => d.available);
  let totalWeight = 0;
  let weightedScore = 0;

  for (const [key, dim] of availableDimensions) {
    const weight = (WEIGHTS as any)[key] || 0.2;
    weightedScore += dim.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

  let grade: StockDiagnosisReport['overview']['grade'];
  if (overallScore >= 80) grade = 'A';
  else if (overallScore >= 65) grade = 'B';
  else if (overallScore >= 50) grade = 'C';
  else if (overallScore >= 35) grade = 'D';
  else grade = 'F';

  let recommendation: StockDiagnosisReport['overview']['recommendation'];
  if (overallScore >= 75) recommendation = 'strong_buy';
  else if (overallScore >= 60) recommendation = 'buy';
  else if (overallScore >= 45) recommendation = 'hold';
  else if (overallScore >= 30) recommendation = 'sell';
  else recommendation = 'strong_sell';

  const summaryParts: string[] = [];
  for (const [key, dim] of availableDimensions) {
    summaryParts.push(`${key}: ${dim.detail}`);
  }

  const report: StockDiagnosisReport = {
    success: true,
    code,
    name,
    timestamp: Date.now(),
    overview: {
      score: overallScore,
      grade,
      recommendation,
      summary: `综合评分 ${overallScore}/100 (${grade}) — ${recommendation}`,
    },
    dimensions,
    rawData,
  };

  log.info(`[StockDiagnosis] ${code} ${name}: ${overallScore}/100 (${grade}) ${recommendation}`);
  return report;
}

/**
 * Batch diagnose multiple stocks
 */
export async function batchDiagnose(codes: string[], options?: Partial<StockDiagnosisRequest>): Promise<StockDiagnosisReport[]> {
  const results = await Promise.allSettled(
    codes.map(code => diagnoseStock({ code, ...options }))
  );

  return results.map(r => {
    if (r.status === 'fulfilled') return r.value;
    return {
      success: false,
      code: '',
      name: '',
      timestamp: Date.now(),
      overview: { score: 0, grade: 'F' as const, recommendation: 'hold' as const, summary: 'Error' },
      dimensions: {
        capitalFlow: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
        fundOwnership: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
        dragonTiger: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
        news: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
        anomalies: { score: 0, grade: 'N/A', signal: 'error', detail: 'Failed', available: false },
      },
      rawData: {},
      error: r.reason?.message || 'Unknown error',
    };
  });
}
