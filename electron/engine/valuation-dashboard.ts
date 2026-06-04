// ── Valuation Dashboard (JVS-49) ──────────────────────────────────────────
// Aggregates PE/PB/PS/ROE to stock cards
// IPC: data:valuation-dashboard

import log from 'electron-log';
import { getValuationData, type ValuationResult } from './valuation-data';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockValuationCard {
  code: string;
  name: string;
  // Current valuation metrics
  pe: number;
  peTTM: number;
  pb: number;
  ps: number;
  psTTM: number;
  roe: number;
  roa: number;
  dividendYield: number;
  marketCap: number;
  // Percentiles (0-100, lower = cheaper)
  pePercentile: number;
  pbPercentile: number;
  psPercentile: number;
  dividendYieldPercentile: number;
  // Valuation verdict
  verdict: 'cheap' | 'fair' | 'expensive';
  // Data quality
  dataFreshness: string;
  hasData: boolean;
}

export interface ValuationDashboardResult {
  success: boolean;
  stocks: StockValuationCard[];
  summary: {
    totalStocks: number;
    cheapCount: number;
    fairCount: number;
    expensiveCount: number;
    avgPE: number;
    avgPB: number;
    avgROE: number;
    avgDividendYield: number;
  };
  timestamp: number;
  error?: string;
}

// ── Verdict Logic ──────────────────────────────────────────────────────────

function calculateVerdict(pePercentile: number, pbPercentile: number, psPercentile: number): 'cheap' | 'fair' | 'expensive' {
  const avgPercentile = (pePercentile + pbPercentile + psPercentile) / 3;
  
  if (avgPercentile < 30) return 'cheap';
  if (avgPercentile > 70) return 'expensive';
  return 'fair';
}

// ── Main Function ──────────────────────────────────────────────────────────

export async function getValuationDashboard(
  codes: string[],
  historyDays: number = 252
): Promise<ValuationDashboardResult> {
  if (!codes || codes.length === 0) {
    return {
      success: false,
      stocks: [],
      summary: {
        totalStocks: 0,
        cheapCount: 0,
        fairCount: 0,
        expensiveCount: 0,
        avgPE: 0,
        avgPB: 0,
        avgROE: 0,
        avgDividendYield: 0,
      },
      timestamp: Date.now(),
      error: 'No stock codes provided',
    };
  }

  log.info(`[ValuationDashboard] Fetching data for ${codes.length} stocks`);

  // Fetch all valuations in parallel
  const valuationPromises = codes.map(code => getValuationData(code, historyDays));
  const valuations = await Promise.all(valuationPromises);

  // Build stock cards
  const stocks: StockValuationCard[] = [];
  
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const valuation = valuations[i];

    if (!valuation.success || !valuation.current) {
      stocks.push({
        code,
        name: valuation.name || code,
        pe: 0,
        peTTM: 0,
        pb: 0,
        ps: 0,
        psTTM: 0,
        roe: 0,
        roa: 0,
        dividendYield: 0,
        marketCap: 0,
        pePercentile: 50,
        pbPercentile: 50,
        psPercentile: 50,
        dividendYieldPercentile: 50,
        verdict: 'fair',
        dataFreshness: 'unknown',
        hasData: false,
      });
      continue;
    }

    const current = valuation.current;
    const percentiles = valuation.percentiles;
    const verdict = calculateVerdict(percentiles.pe, percentiles.pb, percentiles.ps);

    // Calculate data freshness
    const dataAge = Date.now() - valuation.timestamp;
    const dataFreshness = dataAge < 60000 ? 'real-time' :
                          dataAge < 3600000 ? 'recent' :
                          dataAge < 86400000 ? 'stale' : 'old';

    stocks.push({
      code,
      name: valuation.name || code,
      pe: current.pe,
      peTTM: current.peTTM,
      pb: current.pb,
      ps: current.ps,
      psTTM: current.psTTM,
      roe: current.roe,
      roa: current.roa,
      dividendYield: current.dividendYield,
      marketCap: current.marketCap,
      pePercentile: percentiles.pe,
      pbPercentile: percentiles.pb,
      psPercentile: percentiles.ps,
      dividendYieldPercentile: percentiles.dividendYield,
      verdict,
      dataFreshness,
      hasData: true,
    });
  }

  // Calculate summary statistics
  const stocksWithData = stocks.filter(s => s.hasData);
  const cheapCount = stocksWithData.filter(s => s.verdict === 'cheap').length;
  const fairCount = stocksWithData.filter(s => s.verdict === 'fair').length;
  const expensiveCount = stocksWithData.filter(s => s.verdict === 'expensive').length;

  const avgPE = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.peTTM, 0) / stocksWithData.length
    : 0;

  const avgPB = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.pb, 0) / stocksWithData.length
    : 0;

  const avgROE = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.roe, 0) / stocksWithData.length
    : 0;

  const avgDividendYield = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.dividendYield, 0) / stocksWithData.length
    : 0;

  const result: ValuationDashboardResult = {
    success: stocksWithData.length > 0,
    stocks,
    summary: {
      totalStocks: stocks.length,
      cheapCount,
      fairCount,
      expensiveCount,
      avgPE: Math.round(avgPE * 100) / 100,
      avgPB: Math.round(avgPB * 100) / 100,
      avgROE: Math.round(avgROE * 100) / 100,
      avgDividendYield: Math.round(avgDividendYield * 100) / 100,
    },
    timestamp: Date.now(),
    error: stocksWithData.length === 0 ? 'No data available for any stock' : undefined,
  };

  log.info(`[ValuationDashboard] Done: ${stocksWithData.length}/${stocks.length} stocks with data, ${cheapCount} cheap, ${fairCount} fair, ${expensiveCount} expensive`);

  return result;
}

// ── Batch Processing (for large watchlists) ────────────────────────────────

export async function getValuationDashboardBatch(
  codes: string[],
  batchSize: number = 10,
  delayMs: number = 500
): Promise<ValuationDashboardResult> {
  if (codes.length <= batchSize) {
    return getValuationDashboard(codes);
  }

  log.info(`[ValuationDashboard] Batch processing ${codes.length} stocks in batches of ${batchSize}`);

  const allStocks: StockValuationCard[] = [];
  
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const batchResult = await getValuationDashboard(batch);
    allStocks.push(...batchResult.stocks);

    // Delay between batches to avoid rate limiting
    if (i + batchSize < codes.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Recalculate summary
  const stocksWithData = allStocks.filter(s => s.hasData);
  const cheapCount = stocksWithData.filter(s => s.verdict === 'cheap').length;
  const fairCount = stocksWithData.filter(s => s.verdict === 'fair').length;
  const expensiveCount = stocksWithData.filter(s => s.verdict === 'expensive').length;

  const avgPE = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.peTTM, 0) / stocksWithData.length
    : 0;

  const avgPB = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.pb, 0) / stocksWithData.length
    : 0;

  const avgROE = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.roe, 0) / stocksWithData.length
    : 0;

  const avgDividendYield = stocksWithData.length > 0
    ? stocksWithData.reduce((sum, s) => sum + s.dividendYield, 0) / stocksWithData.length
    : 0;

  return {
    success: stocksWithData.length > 0,
    stocks: allStocks,
    summary: {
      totalStocks: allStocks.length,
      cheapCount,
      fairCount,
      expensiveCount,
      avgPE: Math.round(avgPE * 100) / 100,
      avgPB: Math.round(avgPB * 100) / 100,
      avgROE: Math.round(avgROE * 100) / 100,
      avgDividendYield: Math.round(avgDividendYield * 100) / 100,
    },
    timestamp: Date.now(),
  };
}
