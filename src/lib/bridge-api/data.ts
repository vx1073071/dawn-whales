// R127-Q01: nocheck cleared — IpcError widening (R107 S-26 quick fix)
/**
 * @deprecated Use src/services/market-service.ts instead (R108 S-34).
 * Service layer provides typed interfaces and abstracts IPC calls.
 *
 * ── quant-moo — Bridge API Data Module ──────────────────────────────
 * S-15p1 split: Data Provider + Market Data Stubs + Demo K-line Generator
 * S-15p2: Zod-derived types replaced all `any` usage
 */

import type {
  IpcResponse,
  DbSaveFundamentalParams,
  DbSaveCapitalFlowParams,
  DbSaveRegimeParams,
  DbSaveAnomalyParams,
  DataComputeRegimeParams,
  FundamentalData,
  CapitalFlowData,
  NewsItem,
  AnomalySignal,
} from '../../types/ipc';
import { hasIPC } from '../bridge-api-types';

// R224: Bridge IPC types are approximate — cast through any at boundary
const api = (window as any).api;
if (!api) {/* not in Electron */}

// ── Data Provider ─────────────────────────────────────────────────────────

export async function getFundamental(symbol: string): Promise<IpcResponse<FundamentalData>> {
  if (!hasIPC()) return { success: false, data: null } as any as any;
  return api.dataProvider.getFundamental(symbol);
}

export async function getCapitalFlow(symbol: string): Promise<IpcResponse<CapitalFlowData>> {
  if (!hasIPC()) return { success: false, data: null } as any as any;
  return api.dataProvider.getCapitalFlow(symbol);
}

export async function getMarketRegime(): Promise<IpcResponse<{ regime: 'bull' | 'bear' | 'neutral'; confidence: number }>> {
  if (!hasIPC()) return { success: false, regime: null } as any as any;
  return api.dataProvider.getRegime();
}

export async function getAnomalies(symbol: string): Promise<IpcResponse<{ signals: AnomalySignal[] }>> {
  if (!hasIPC()) return { success: false, signals: [] } as any as any;
  return api.dataProvider.getAnomalies(symbol);
}

export async function getNews(symbol: string, limit?: number): Promise<IpcResponse<{ items: NewsItem[] }>> {
  if (!hasIPC()) return { success: false, items: [] } as any as any;
  return api.dataProvider.getNews(symbol, limit);
}

export async function getCompositeScore(symbol: string): Promise<IpcResponse<{ result: unknown }>> {
  if (!hasIPC()) return { success: false, result: null } as any as any;
  return api.dataProvider.getCompositeScore(symbol);
}

export async function saveFundamentalData(data: DbSaveFundamentalParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.dataProvider.saveFundamental(data);
}

export async function saveCapitalFlowData(data: DbSaveCapitalFlowParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.dataProvider.saveCapitalFlow(data);
}

export async function saveMarketRegimeData(regime: DbSaveRegimeParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.dataProvider.saveRegime(regime);
}

export async function computeMarketRegime(factors: DataComputeRegimeParams): Promise<IpcResponse<{ regime: 'bull' | 'bear' | 'neutral'; confidence: number }>> {
  if (!hasIPC()) return { success: false, regime: null } as any as any;
  return api.dataProvider.computeRegime(factors);
}

export async function saveAnomalySignal(signal: DbSaveAnomalyParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.dataProvider.saveAnomaly(signal);
}

export async function saveNewsItems(symbol: string, items: NewsItem[]): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.dataProvider.saveNews(symbol, items);
}

export async function clearDataCache(): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.dataProvider.clearCache();
}

// ── Market Data Stubs (UI pages import these, IPC not yet wired) ─────────
// S-15p2: stubs use unknown[] instead of any[] (not yet wired to real IPC)

export async function getStockCapitalFlowRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, data: [] } as any; }
export async function getSectorCapitalFlowRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, data: [] } as any; }
export async function getConceptCapitalFlowRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, data: [] } as any; }
export async function getConsumerData(..._a: unknown[]): Promise<IpcResponse> { return { success: false, data: null } as any; }
export async function getMarketHotspot(..._a: unknown[]): Promise<IpcResponse> { return { success: false, hotspots: [] } as any; }
export async function getDragonTigerList(..._a: unknown[]): Promise<IpcResponse> { return { success: false, list: [] } as any; }
export async function getDragonTigerDetail(..._a: unknown[]): Promise<IpcResponse> { return { success: false, detail: null } as any; }
export async function getInstitutionalTrades(..._a: unknown[]): Promise<IpcResponse> { return { success: false, trades: [] } as any; }
export async function getFundHoldings(..._a: unknown[]): Promise<IpcResponse> { return { success: false, holdings: [] } as any; }
export async function getStockFundOwnership(..._a: unknown[]): Promise<IpcResponse> { return { success: false, ownership: [] } as any; }
export async function getFundIncreaseRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, rank: [] } as any; }
export async function getFundDecreaseRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, rank: [] } as any; }
export async function getMacroDashboard(..._a: unknown[]): Promise<IpcResponse> { return { success: false, dashboard: null } as any; }
export async function getMarginData(..._a: unknown[]): Promise<IpcResponse> { return { success: false, data: null } as any; }
export async function getMarginBalanceRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, rank: [] } as any; }
export async function getShortInterestRank(..._a: unknown[]): Promise<IpcResponse> { return { success: false, rank: [] } as any; }
export async function getSectorHeatmap(..._a: unknown[]): Promise<IpcResponse> { return { success: false, heatmap: [] } as any; }
export async function searchNews(..._a: unknown[]): Promise<IpcResponse> { return { success: false, items: [] } as any; }
export async function getMarketMood(..._a: unknown[]): Promise<IpcResponse> { return { success: false, mood: null } as any; }
export async function subscribeQuoteStream(..._a: unknown[]): Promise<IpcResponse> { return { success: false, error: 'Not implemented' } as any; }
export async function unsubscribeQuoteStream(..._a: unknown[]): Promise<IpcResponse> { return { success: false, error: 'Not implemented' } as any; }
export async function getQuoteStreamStatus(..._a: unknown[]): Promise<IpcResponse> { return { success: false, status: 'disconnected' } as any; }
export async function analyzeSectorRotation(..._a: unknown[]): Promise<IpcResponse> { return { success: false, analysis: null } as any; }
export async function getSmartPick(..._a: unknown[]): Promise<IpcResponse> { return { success: false, picks: [] } as any; }
export async function diagnoseStock(..._a: unknown[]): Promise<IpcResponse> { return { success: false, diagnosis: null } as any; }
export async function searchStocks(..._a: unknown[]): Promise<IpcResponse> { return { success: false, results: [] } as any; }
export async function getAnomalyAlerts(..._a: unknown[]): Promise<IpcResponse> { return { success: false, alerts: [] } as any; }
export async function getAnomalySummary(..._a: unknown[]): Promise<IpcResponse> { return { success: false, summary: null } as any; }
export async function acknowledgeAnomalyAlert(..._a: unknown[]): Promise<IpcResponse> { return { success: false }; }
export async function computeSentiment(..._a: unknown[]): Promise<IpcResponse> { return { success: false, sentiment: null } as any; }
export async function getAISuggest(..._a: unknown[]): Promise<IpcResponse> { return { success: false, suggestion: null } as any; }
export async function getPaperTraderStatus(..._a: unknown[]): Promise<IpcResponse> { return { success: false, status: 'offline' } as any; }
export async function getTradeHistory(..._a: unknown[]): Promise<IpcResponse> { return { success: false, trades: [] } as any; }

// ── Demo K-line Generator (fallback) ──────────────────────────────────────

export interface DemoKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function generateDemoKlines(count: number): DemoKline[] {
  const data: DemoKline[] = [];
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
