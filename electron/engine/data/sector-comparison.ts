// ── Sector Comparison (JVS-50) ──────────────────────────────────────────────
// Multi-dimensional comparison of stocks within same sector
// IPC: data:sector-compare

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

interface StockMetrics {
  code: string;
  name: string;
  sector: string;
  // Valuation
  pe: number;
  pb: number;
  ps: number;
  // Growth
  revenueGrowth: number;      // revenue %
  profitGrowth: number;       // net profit %
  // Profitability
  roe: number;                // ROE %
  roa: number;                // ROA %
  grossMargin: number;        // gross margin %
  netMargin: number;          // net margin %
  // Scale
  marketCap: number;          // market cap ()
  revenue: number;            // revenue ()
}

interface SectorComparisonResult {
  success: boolean;
  sector: string;
  stocks: StockMetrics[];
  comparison: {
    // Rankings
    bestPE: string;           // code of best PE (lowest)
    bestPB: string;
    bestGrowth: string;       // highest revenue growth
    bestProfitability: string; // highest ROE
    bestScale: string;        // largest market cap
    // Averages
    avgPE: number;
    avgPB: number;
    avgROE: number;
    avgGrowth: number;
    // Outliers
    overvalued: string[];     // codes with PE > 2x sector avg
    undervalued: string[];    // codes with PE < 0.5x sector avg
  };
  timestamp: number;
  error?: string;
}

// ── Helper Functions ───────────────────────────────────────────────────────

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === '' || v === '--') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function calculateAverage(values: number[]): number {
  const valid = values.filter(v => v > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

// ── Main Function ──────────────────────────────────────────────────────────

export async function compareSectorStocks(
  stocks: { code: string; name: string; sector: string }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  financialData: Map<string, any>
): Promise<SectorComparisonResult> {
  if (!stocks || stocks.length === 0) {
    return {
      success: false,
      sector: '',
      stocks: [],
      comparison: {
        bestPE: '',
        bestPB: '',
        bestGrowth: '',
        bestProfitability: '',
        bestScale: '',
        avgPE: 0,
        avgPB: 0,
        avgROE: 0,
        avgGrowth: 0,
        overvalued: [],
        undervalued: [],
      },
      timestamp: Date.now(),
      error: 'No stocks provided',
    };
  }

  const sector = stocks[0].sector;
  log.info(`[SectorComparison] Comparing ${stocks.length} stocks in sector: ${sector}`);

  // Build metrics for each stock
  const metricsList: StockMetrics[] = [];
  
  for (const stock of stocks) {
    const data = financialData.get(stock.code) || {};
    
    metricsList.push({
      code: stock.code,
      name: stock.name,
      sector: stock.sector,
      pe: safeNum(data.pe),
      pb: safeNum(data.pb),
      ps: safeNum(data.ps),
      revenueGrowth: safeNum(data.revenueGrowth),
      profitGrowth: safeNum(data.profitGrowth),
      roe: safeNum(data.roe),
      roa: safeNum(data.roa),
      grossMargin: safeNum(data.grossMargin),
      netMargin: safeNum(data.netMargin),
      marketCap: safeNum(data.marketCap),
      revenue: safeNum(data.revenue),
    });
  }

  // Calculate averages
  const peValues = metricsList.map(m => m.pe).filter(v => v > 0);
  const pbValues = metricsList.map(m => m.pb).filter(v => v > 0);
  const roeValues = metricsList.map(m => m.roe).filter(v => v > 0);
  const growthValues = metricsList.map(m => m.revenueGrowth).filter(v => v !== 0);

  const avgPE = calculateAverage(peValues);
  const avgPB = calculateAverage(pbValues);
  const avgROE = calculateAverage(roeValues);
  const avgGrowth = calculateAverage(growthValues);

  // Find best performers
  const bestPE = metricsList
    .filter(m => m.pe > 0)
    .sort((a, b) => a.pe - b.pe)[0]?.code || '';

  const bestPB = metricsList
    .filter(m => m.pb > 0)
    .sort((a, b) => a.pb - b.pb)[0]?.code || '';

  const bestGrowth = metricsList
    .filter(m => m.revenueGrowth !== 0)
    .sort((a, b) => b.revenueGrowth - a.revenueGrowth)[0]?.code || '';

  const bestProfitability = metricsList
    .filter(m => m.roe > 0)
    .sort((a, b) => b.roe - a.roe)[0]?.code || '';

  const bestScale = metricsList
    .filter(m => m.marketCap > 0)
    .sort((a, b) => b.marketCap - a.marketCap)[0]?.code || '';

  // Identify outliers
  const overvalued: string[] = [];
  const undervalued: string[] = [];

  if (avgPE > 0) {
    for (const m of metricsList) {
      if (m.pe > 0) {
        if (m.pe > avgPE * 2) {
          overvalued.push(m.code);
        } else if (m.pe < avgPE * 0.5) {
          undervalued.push(m.code);
        }
      }
    }
  }

  const result: SectorComparisonResult = {
    success: true,
    sector,
    stocks: metricsList,
    comparison: {
      bestPE,
      bestPB,
      bestGrowth,
      bestProfitability,
      bestScale,
      avgPE: Math.round(avgPE * 100) / 100,
      avgPB: Math.round(avgPB * 100) / 100,
      avgROE: Math.round(avgROE * 100) / 100,
      avgGrowth: Math.round(avgGrowth * 100) / 100,
      overvalued,
      undervalued,
    },
    timestamp: Date.now(),
  };

  log.info(`[SectorComparison] Done: ${metricsList.length} stocks, avg PE=${result.comparison.avgPE}, avg ROE=${result.comparison.avgROE}%`);

  return result;
}

// ── Batch Comparison ───────────────────────────────────────────────────────

export async function compareMultipleSectors(
  sectors: { sector: string; stocks: { code: string; name: string }[] }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  financialData: Map<string, any>
): Promise<SectorComparisonResult[]> {
  log.info(`[SectorComparison] Comparing ${sectors.length} sectors`);

  const results: SectorComparisonResult[] = [];

  for (const sectorData of sectors) {
    const stocksWithSector = sectorData.stocks.map(s => ({
      code: s.code,
      name: s.name,
      sector: sectorData.sector,
    }));

    const result = await compareSectorStocks(stocksWithSector, financialData);
    results.push(result);
  }

  log.info(`[SectorComparison] Done: ${results.length} sectors compared`);

  return results;
}

// ── Ranking Generator ──────────────────────────────────────────────────────

export interface SectorRanking {
  code: string;
  name: string;
  sector: string;
  score: number;            // Composite score 0-100
  breakdown: {
    valuation: number;      // 0-100 (lower PE/PB = higher score)
    growth: number;         // 0-100 (higher growth = higher score)
    profitability: number;  // 0-100 (higher ROE = higher score)
    scale: number;          // 0-100 (larger = higher score)
  };
}

export function rankSectorStocks(
  metrics: StockMetrics[],
  weights: { valuation: number; growth: number; profitability: number; scale: number } = {
    valuation: 0.3,
    growth: 0.3,
    profitability: 0.25,
    scale: 0.15,
  }
): SectorRanking[] {
  if (metrics.length === 0) return [];

  // Calculate sector averages for normalization
  const avgPE = calculateAverage(metrics.map(m => m.pe).filter(v => v > 0));
  const avgPB = calculateAverage(metrics.map(m => m.pb).filter(v => v > 0));
  const avgROE = calculateAverage(metrics.map(m => m.roe).filter(v => v > 0));
  const avgGrowth = calculateAverage(metrics.map(m => m.revenueGrowth));
  const avgMarketCap = calculateAverage(metrics.map(m => m.marketCap).filter(v => v > 0));

  const rankings: SectorRanking[] = [];

  for (const m of metrics) {
    // Valuation score (lower PE/PB = higher score)
    let valuationScore = 50;
    if (m.pe > 0 && avgPE > 0) {
      const peRatio = m.pe / avgPE;
      valuationScore = Math.max(0, Math.min(100, 100 - (peRatio - 1) * 50));
    }
    if (m.pb > 0 && avgPB > 0) {
      const pbRatio = m.pb / avgPB;
      const pbScore = Math.max(0, Math.min(100, 100 - (pbRatio - 1) * 50));
      valuationScore = (valuationScore + pbScore) / 2;
    }

    // Growth score (higher = better)
    let growthScore = 50;
    if (m.revenueGrowth !== 0 && avgGrowth !== 0) {
      const growthRatio = m.revenueGrowth / avgGrowth;
      growthScore = Math.max(0, Math.min(100, 50 + (growthRatio - 1) * 30));
    }

    // Profitability score (higher ROE = better)
    let profitabilityScore = 50;
    if (m.roe > 0 && avgROE > 0) {
      const roeRatio = m.roe / avgROE;
      profitabilityScore = Math.max(0, Math.min(100, 50 + (roeRatio - 1) * 40));
    }

    // Scale score (larger = better)
    let scaleScore = 50;
    if (m.marketCap > 0 && avgMarketCap > 0) {
      const scaleRatio = m.marketCap / avgMarketCap;
      scaleScore = Math.max(0, Math.min(100, 50 + Math.log10(scaleRatio) * 30));
    }

    // Composite score
    const score = 
      valuationScore * weights.valuation +
      growthScore * weights.growth +
      profitabilityScore * weights.profitability +
      scaleScore * weights.scale;

    rankings.push({
      code: m.code,
      name: m.name,
      sector: m.sector,
      score: Math.round(score * 100) / 100,
      breakdown: {
        valuation: Math.round(valuationScore * 100) / 100,
        growth: Math.round(growthScore * 100) / 100,
        profitability: Math.round(profitabilityScore * 100) / 100,
        scale: Math.round(scaleScore * 100) / 100,
      },
    });
  }

  // Sort by score descending
  rankings.sort((a, b) => b.score - a.score);

  return rankings;
}
