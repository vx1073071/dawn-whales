// ── DAWN WHALES — Bridge API Data Module ──────────────────────────────
// S-15p1 split: Data Provider + Market Data Stubs + Demo K-line Generator
/* eslint-disable @typescript-eslint/no-explicit-any */

import { hasIPC } from '../bridge-api-types';

// ── Data Provider ─────────────────────────────────────────────────────────

export async function getFundamental(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getFundamental(symbol);
}

export async function getCapitalFlow(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, data: null };
  return window.api.dataProvider.getCapitalFlow(symbol);
}

export async function getMarketRegime(): Promise<any> {
  if (!hasIPC()) return { success: false, regime: null };
  return window.api.dataProvider.getRegime();
}

export async function getAnomalies(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, signals: [] };
  return window.api.dataProvider.getAnomalies(symbol);
}

export async function getNews(symbol: string, limit?: number): Promise<any> {
  if (!hasIPC()) return { success: false, items: [] };
  return window.api.dataProvider.getNews(symbol, limit);
}

export async function getCompositeScore(symbol: string): Promise<any> {
  if (!hasIPC()) return { success: false, result: null };
  return window.api.dataProvider.getCompositeScore(symbol);
}

export async function saveFundamentalData(data: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveFundamental(data);
}

export async function saveCapitalFlowData(data: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveCapitalFlow(data);
}

export async function saveMarketRegimeData(regime: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveRegime(regime);
}

export async function computeMarketRegime(factors: any): Promise<any> {
  if (!hasIPC()) return { success: false, regime: null };
  return window.api.dataProvider.computeRegime(factors);
}

export async function saveAnomalySignal(signal: any): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveAnomaly(signal);
}

export async function saveNewsItems(symbol: string, items: any[]): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.saveNews(symbol, items);
}

export async function clearDataCache(): Promise<any> {
  if (!hasIPC()) return { success: false };
  return window.api.dataProvider.clearCache();
}

// ── Market Data Stubs (UI pages import these, IPC not yet wired) ─────────

export async function getStockCapitalFlowRank(..._a: any[]): Promise<any> { return { success: false, data: [] }; }
export async function getSectorCapitalFlowRank(..._a: any[]): Promise<any> { return { success: false, data: [] }; }
export async function getConceptCapitalFlowRank(..._a: any[]): Promise<any> { return { success: false, data: [] }; }
export async function getConsumerData(..._a: any[]): Promise<any> { return { success: false, data: null }; }
export async function getMarketHotspot(..._a: any[]): Promise<any> { return { success: false, hotspots: [] }; }
export async function getDragonTigerList(..._a: any[]): Promise<any> { return { success: false, list: [] }; }
export async function getDragonTigerDetail(..._a: any[]): Promise<any> { return { success: false, detail: null }; }
export async function getInstitutionalTrades(..._a: any[]): Promise<any> { return { success: false, trades: [] }; }
export async function getFundHoldings(..._a: any[]): Promise<any> { return { success: false, holdings: [] }; }
export async function getStockFundOwnership(..._a: any[]): Promise<any> { return { success: false, ownership: [] }; }
export async function getFundIncreaseRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getFundDecreaseRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getMacroDashboard(..._a: any[]): Promise<any> { return { success: false, dashboard: null }; }
export async function getMarginData(..._a: any[]): Promise<any> { return { success: false, data: null }; }
export async function getMarginBalanceRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getShortInterestRank(..._a: any[]): Promise<any> { return { success: false, rank: [] }; }
export async function getSectorHeatmap(..._a: any[]): Promise<any> { return { success: false, heatmap: [] }; }
export async function searchNews(..._a: any[]): Promise<any> { return { success: false, items: [] }; }
export async function getMarketMood(..._a: any[]): Promise<any> { return { success: false, mood: null }; }
export async function subscribeQuoteStream(..._a: any[]): Promise<any> { return { success: false, error: 'Not implemented' }; }
export async function unsubscribeQuoteStream(..._a: any[]): Promise<any> { return { success: false, error: 'Not implemented' }; }
export async function getQuoteStreamStatus(..._a: any[]): Promise<any> { return { success: false, status: 'disconnected' }; }
export async function analyzeSectorRotation(..._a: any[]): Promise<any> { return { success: false, analysis: null }; }
export async function getSmartPick(..._a: any[]): Promise<any> { return { success: false, picks: [] }; }
export async function diagnoseStock(..._a: any[]): Promise<any> { return { success: false, diagnosis: null }; }
export async function searchStocks(..._a: any[]): Promise<any> { return { success: false, results: [] }; }
export async function getAnomalyAlerts(..._a: any[]): Promise<any> { return { success: false, alerts: [] }; }
export async function getAnomalySummary(..._a: any[]): Promise<any> { return { success: false, summary: null }; }
export async function acknowledgeAnomalyAlert(..._a: any[]): Promise<any> { return { success: false }; }
export async function computeSentiment(..._a: any[]): Promise<any> { return { success: false, sentiment: null }; }
export async function getAISuggest(..._a: any[]): Promise<any> { return { success: false, suggestion: null }; }
export async function getPaperTraderStatus(..._a: any[]): Promise<any> { return { success: false, status: 'offline' }; }
export async function getTradeHistory(..._a: any[]): Promise<any> { return { success: false, trades: [] }; }

// ── Demo K-line Generator (fallback) ──────────────────────────────────────

export function generateDemoKlines(count: number): any[] {
  const data: any[] = [];
  let price = 100 + Math.random() * 50;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;
  const startTime = now - count * daySeconds;

  for (let i = 0; i < count; i++) {
    const volatility = 0.02 + Math.random() * 0.03;
    const change = (Math.random() - 0.48) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      time: startTime + i * daySeconds,
      open: +open.toFixed(2), high: +high.toFixed(2),
      low: +low.toFixed(2), close: +close.toFixed(2), volume,
    });
    price = close;
  }
  return data;
}
