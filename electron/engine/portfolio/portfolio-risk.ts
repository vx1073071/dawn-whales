// ── JVS-15: Portfolio Risk Calculator () ────────────────────
// Calculates portfolio risk metrics using JVS data modules
// Integrates: correlation matrix, sentiment, anomaly, sector rotation

import log from 'electron-log';

import { correlationMatrix as computeCorrelationMatrix } from '../risk/correlation-matrix-v2';
import { SentimentIndexEngine } from '../analysis/sentiment-index';
import { getCapitalFlowMonitor } from '../analysis/capital-flow-monitor';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface PortfolioPosition {
  code: string;
  name: string;
  shares: number;          // 持有股数
  avgCost: number;         // 平均成本
  currentPrice: number;    // current价格
  weight?: number;         // weight (optional, will be calculated)
  sector?: string;         // 所属sector
}

export interface PortfolioRiskRequest {
  positions: PortfolioPosition[];
  riskFreeRate?: number;   // 无风险利率 (default 2.5%)
  benchmarkCode?: string;  // 基准index代码
  includeConcentration?: boolean;
  includeCorrelation?: boolean;
  includeSentiment?: boolean;
}

export interface PortfolioRiskReport {
  success: boolean;
  timestamp: number;

  // Portfolio overview
  overview: {
    totalValue: number;        // total market cap
    totalCost: number;         // 总成本
    totalPnl: number;          // 总盈亏
    totalPnlPct: number;       // 总盈亏比例 %
    positionCount: number;     // position/holding数
    topWeight: number;         // 最大position/holdingweight %
  };

  // Concentration risk
  concentration: {
    hhi: number;               // Herfindahl-Hirschman Index (0-10000)
    hhiGrade: 'low' | 'medium' | 'high' | 'very_high';
    top3Weight: number;        // 前3大position/holdingweight %
    top5Weight: number;        // 前5大position/holdingweight %
    sectorConcentration: Record<string, number>; // sector分布
    risk: string;
  };

  // Correlation risk
  correlation: {
    avgCorrelation: number;    // 平均相关性
    maxCorrelation: number;    // 最大相关性
    minCorrelation: number;    // 最小相关性
    diversificationScore: number; // 分散化评分 0-100
    highCorrPairs: { codeA: string; codeB: string; corr: number }[];
    risk: string;
  };

  // Market risk
  marketRisk: {
    sentimentScore: number;    // 市场情绪 0-100
    sentimentLevel: string;
    sentimentSignal: string;
    sectorRotationRisk: string;
    overallMarketRisk: 'low' | 'medium' | 'high' | 'extreme';
  };

  // Position-level risk
  positionRisks: {
    code: string;
    name: string;
    weight: number;
    pnlPct: number;
    riskFactors: string[];
  }[];

  // Overall risk score
  riskScore: number;           // 0-100 (higher = more risky)
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];

  error?: string;
}

// ── Portfolio Risk Calculator ──────────────────────────────────────────────

const SENTIMENT_ENGINE = new SentimentIndexEngine();

export async function calculatePortfolioRisk(
  request: PortfolioRiskRequest
): Promise<PortfolioRiskReport> {
  const { positions, riskFreeRate = 2.5 } = request;
  log.info(`[PortfolioRisk] Calculating risk for ${positions.length} positions`);

  if (positions.length === 0) {
    return emptyReport('No positions');
  }

  // ── 1. Calculate weights and overview ────────────────────────────────
  const totalValue = positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.shares * p.avgCost, 0);

  const weightedPositions = positions.map(p => ({
    ...p,
    weight: p.weight || ((p.shares * p.currentPrice) / totalValue * 100),
    pnlPct: ((p.currentPrice - p.avgCost) / p.avgCost * 100),
  }));

  const sortedByWeight = [...weightedPositions].sort((a, b) => b.weight - a.weight);
  const topWeight = sortedByWeight[0]?.weight || 0;

  // ── 2. Concentration risk ────────────────────────────────────────────
  const weights = weightedPositions.map(p => p.weight / 100);
  const hhi = Math.round(weights.reduce((sum, w) => sum + w * w, 0) * 10000);

  let hhiGrade: 'low' | 'medium' | 'high' | 'very_high';
  if (hhi < 1500) hhiGrade = 'low';
  else if (hhi < 2500) hhiGrade = 'medium';
  else if (hhi < 4000) hhiGrade = 'high';
  else hhiGrade = 'very_high';

  const top3Weight = sortedByWeight.slice(0, 3).reduce((s, p) => s + p.weight, 0);
  const top5Weight = sortedByWeight.slice(0, 5).reduce((s, p) => s + p.weight, 0);

  // Sector concentration
  const sectorConcentration: Record<string, number> = {};
  for (const p of weightedPositions) {
    const sector = p.sector || 'unknown';
    sectorConcentration[sector] = (sectorConcentration[sector] || 0) + p.weight;
  }

  const concentrationRisk = hhiGrade === 'very_high'
    ? 'Very concentrated — consider diversifying'
    : hhiGrade === 'high'
      ? 'Moderately concentrated'
      : 'Well diversified';

  // ── 3. Correlation analysis ──────────────────────────────────────────
  let avgCorrelation = 0;
  let maxCorrelation = 0;
  let minCorrelation = 1;
  let diversificationScore = 50;
  const highCorrPairs: { codeA: string; codeB: string; corr: number }[] = [];

  if (request.includeCorrelation !== false && positions.length >= 2) {
    try {
      // Build mock equity curves for correlation (using position data as proxy)
      const equityInputs = weightedPositions.map(p => ({
        id: p.code,
        equityCurve: [
          { time: Date.now() - 30 * 86400000, value: p.avgCost * p.shares },
          { time: Date.now(), value: p.currentPrice * p.shares },
        ],
      }));

      const corrResult = computeCorrelationMatrix(equityInputs);
      if (corrResult && corrResult.entries) {
        const corrs = corrResult.entries.map((e: unknown) => Math.abs(e.corr));
        avgCorrelation = corrs.length > 0 ? corrs.reduce((s: number, v: number) => s + v, 0) / corrs.length : 0;
        maxCorrelation = Math.max(...corrs, 0);
        minCorrelation = Math.min(...corrs, 1);
        diversificationScore = Math.round((1 - avgCorrelation) * 100);

        // Find high correlation pairs
        for (const entry of corrResult.entries) {
          if (Math.abs((entry as any).corr) > 0.7) {
            highCorrPairs.push({
              codeA: (entry as any).idA,
              codeB: (entry as any).idB,
              corr: (entry as any).corr,
            });
          }
        }
      }
    } catch (err: unknown) {
      log.warn('[PortfolioRisk] Correlation calc error:', err.message);
    }
  }

  const correlationRisk = avgCorrelation > 0.7
    ? 'High correlation — positions move together'
    : avgCorrelation > 0.4
      ? 'Moderate correlation'
      : 'Low correlation — good diversification';

  // ── 4. Market/Sentiment risk ─────────────────────────────────────────
  let sentimentScore = 50;
  let sentimentLevel = 'neutral';
  let sentimentSignal = 'hold';

  if (request.includeSentiment !== false) {
    try {
      const sentimentResult = SENTIMENT_ENGINE.compute({});
      sentimentScore = sentimentResult.score;
      sentimentLevel = sentimentResult.level;
      sentimentSignal = sentimentResult.signal;
    } catch (err: unknown) {
      log.warn('[PortfolioRisk] Sentiment error:', err.message);
    }
  }

  // Overall market risk
  let overallMarketRisk: 'low' | 'medium' | 'high' | 'extreme';
  if (sentimentScore <= 15 || sentimentScore >= 85) overallMarketRisk = 'extreme';
  else if (sentimentScore <= 25 || sentimentScore >= 75) overallMarketRisk = 'high';
  else if (sentimentScore <= 35 || sentimentScore >= 65) overallMarketRisk = 'medium';
  else overallMarketRisk = 'low';

  // ── 5. Position-level risks ──────────────────────────────────────────
  const positionRisks = weightedPositions.map(p => {
    const riskFactors: string[] = [];
    if (p.weight > 20) riskFactors.push('Overweight position');
    if (p.pnlPct < -20) riskFactors.push('Significant loss');
    if (p.pnlPct > 50) riskFactors.push('Large unrealized gain — consider taking profit');
    return {
      code: p.code,
      name: p.name,
      weight: Math.round(p.weight * 100) / 100,
      pnlPct: Math.round(p.pnlPct * 100) / 100,
      riskFactors,
    };
  });

  // ── 6. Overall risk score ────────────────────────────────────────────
  const concentrationRiskScore = Math.min(100, hhi / 40);
  const correlationRiskScore = avgCorrelation * 100;
  const sentimentRiskScore = Math.abs(sentimentScore - 50) * 2;
  const positionRiskScore = Math.min(100, topWeight * 2);

  const riskScore = Math.round(
    concentrationRiskScore * 0.25 +
    correlationRiskScore * 0.25 +
    sentimentRiskScore * 0.25 +
    positionRiskScore * 0.25
  );

  let riskGrade: PortfolioRiskReport['riskGrade'];
  if (riskScore <= 20) riskGrade = 'A';
  else if (riskScore <= 40) riskGrade = 'B';
  else if (riskScore <= 60) riskGrade = 'C';
  else if (riskScore <= 80) riskGrade = 'D';
  else riskGrade = 'F';

  // ── 7. Recommendations ───────────────────────────────────────────────
  const recommendations: string[] = [];

  if (hhiGrade === 'very_high' || hhiGrade === 'high') {
    recommendations.push('Reduce concentration: consider trimming top positions');
  }
  if (avgCorrelation > 0.6) {
    recommendations.push('Reduce correlation: add positions in uncorrelated sectors');
  }
  if (topWeight > 30) {
    recommendations.push(`Top position (${sortedByWeight[0]?.name}) exceeds 30% — high single-stock risk`);
  }
  if (sentimentScore >= 80) {
    recommendations.push('Market extremely greedy — consider reducing exposure');
  } else if (sentimentScore <= 20) {
    recommendations.push('Market extremely fearful — potential buying opportunity');
  }
  if (highCorrPairs.length > 0) {
    recommendations.push(`${highCorrPairs.length} highly correlated pairs detected — review for redundancy`);
  }

  const sectorWeights = Object.entries(sectorConcentration);
  const dominantSector = sectorWeights.sort((a, b) => b[1] - a[1])[0];
  if (dominantSector && dominantSector[1] > 50) {
    recommendations.push(`${dominantSector[0]} sector exceeds 50% — sector concentration risk`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Portfolio well balanced — maintain current allocation');
  }

  log.info(`[PortfolioRisk] Score: ${riskScore}/100 (${riskGrade}), ${recommendations.length} recommendations`);

  return {
    success: true,
    timestamp: Date.now(),
    overview: {
      totalValue: Math.round(totalValue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalPnl: Math.round((totalValue - totalCost) * 100) / 100,
      totalPnlPct: Math.round(((totalValue - totalCost) / totalCost * 100) * 100) / 100,
      positionCount: positions.length,
      topWeight: Math.round(topWeight * 100) / 100,
    },
    concentration: {
      hhi,
      hhiGrade,
      top3Weight: Math.round(top3Weight * 100) / 100,
      top5Weight: Math.round(top5Weight * 100) / 100,
      sectorConcentration,
      risk: concentrationRisk,
    },
    correlation: {
      avgCorrelation: Math.round(avgCorrelation * 100) / 100,
      maxCorrelation: Math.round(maxCorrelation * 100) / 100,
      minCorrelation: Math.round(minCorrelation * 100) / 100,
      diversificationScore,
      highCorrPairs: highCorrPairs.slice(0, 5),
      risk: correlationRisk,
    },
    marketRisk: {
      sentimentScore,
      sentimentLevel,
      sentimentSignal,
      sectorRotationRisk: 'neutral',
      overallMarketRisk,
    },
    positionRisks,
    riskScore,
    riskGrade,
    recommendations,
  };
}

function emptyReport(reason: string): PortfolioRiskReport {
  return {
    success: false,
    timestamp: Date.now(),
    overview: { totalValue: 0, totalCost: 0, totalPnl: 0, totalPnlPct: 0, positionCount: 0, topWeight: 0 },
    concentration: { hhi: 0, hhiGrade: 'low', top3Weight: 0, top5Weight: 0, sectorConcentration: {}, risk: reason },
    correlation: { avgCorrelation: 0, maxCorrelation: 0, minCorrelation: 0, diversificationScore: 0, highCorrPairs: [], risk: reason },
    marketRisk: { sentimentScore: 50, sentimentLevel: 'neutral', sentimentSignal: 'hold', sectorRotationRisk: 'neutral', overallMarketRisk: 'low' },
    positionRisks: [],
    riskScore: 0,
    riskGrade: 'A',
    recommendations: [reason],
    error: reason,
  };
}
