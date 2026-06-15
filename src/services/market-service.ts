/**
 * Market Service — R108 S-34
 *
 * Market data: fundamentals, flows, regime, anomalies, news,
 * sentiment, screening, paper trading.
 *
 * @module services/market-service
 */

import * as dataBridgeRaw from '../lib/bridge-api/data'; const dataBridge = dataBridgeRaw as any;

export const marketService = {
  // ── Fundamental Analysis ─────────────────────────────────────────────
  getFundamental: (symbol: string) => dataBridge.getFundamental(symbol),

  getCompositeScore: (symbol: string) => dataBridge.getCompositeScore(symbol),

  // ── Capital Flow ─────────────────────────────────────────────────────
  getCapitalFlow: (symbol: string) => dataBridge.getCapitalFlow(symbol),

  getStockCapitalFlowRank: (params?: Record<string, unknown>) =>
    dataBridge.getStockCapitalFlowRank(params || {}),

  getSectorCapitalFlowRank: (params?: Record<string, unknown>) =>
    dataBridge.getSectorCapitalFlowRank(params || {}),

  getConceptCapitalFlowRank: (params?: Record<string, unknown>) =>
    dataBridge.getConceptCapitalFlowRank(params || {}),

  // ── Market Regime ────────────────────────────────────────────────────
  getMarketRegime: () => dataBridge.getMarketRegime(),

  computeMarketRegime: (params?: Record<string, unknown>) =>
    dataBridge.computeMarketRegime(params || {}),

  // ── Anomalies ────────────────────────────────────────────────────────
  getAnomalies: (symbol: string) => dataBridge.getAnomalies(symbol),

  getAnomalyAlerts: (params?: Record<string, unknown>) =>
    dataBridge.getAnomalyAlerts(params || {}),

  getAnomalySummary: (params?: Record<string, unknown>) =>
    dataBridge.getAnomalySummary(params || {}),

  acknowledgeAnomalyAlert: (alertId: string) =>
    dataBridge.acknowledgeAnomalyAlert(alertId),

  // ── News ─────────────────────────────────────────────────────────────
  getNews: (symbol: string, limit?: number) =>
    dataBridge.getNews(symbol, limit || 10),

  searchNews: (params: Record<string, unknown>) =>
    dataBridge.searchNews(params),

  // ── Sentiment ────────────────────────────────────────────────────────
  computeSentiment: (symbol: string) => dataBridge.computeSentiment(symbol),

  getMarketMood: () => dataBridge.getMarketMood(),

  // ── Data Persistence ─────────────────────────────────────────────────
  saveFundamentalData: (data: Record<string, unknown>) =>
    dataBridge.saveFundamentalData(data),

  saveCapitalFlowData: (data: Record<string, unknown>) =>
    dataBridge.saveCapitalFlowData(data),

  saveMarketRegimeData: (data: Record<string, unknown>) =>
    dataBridge.saveMarketRegimeData(data),

  saveAnomalySignal: (data: Record<string, unknown>) =>
    dataBridge.saveAnomalySignal(data),

  saveNewsItems: (data: Record<string, unknown>) =>
    dataBridge.saveNewsItems(data),

  clearDataCache: () => dataBridge.clearDataCache(),

  // ── Advanced Data ────────────────────────────────────────────────────
  getConsumerData: (params?: Record<string, unknown>) =>
    dataBridge.getConsumerData(params || {}),

  getMarketHotspot: () => dataBridge.getMarketHotspot(),

  getDragonTigerList: (params?: Record<string, unknown>) =>
    dataBridge.getDragonTigerList(params || {}),

  getDragonTigerDetail: (stockCode: string) =>
    dataBridge.getDragonTigerDetail(stockCode),

  getInstitutionalTrades: (params?: Record<string, unknown>) =>
    dataBridge.getInstitutionalTrades(params || {}),

  getFundHoldings: (params?: Record<string, unknown>) =>
    dataBridge.getFundHoldings(params || {}),

  getStockFundOwnership: (stockCode: string) =>
    dataBridge.getStockFundOwnership(stockCode),

  getFundIncreaseRank: (params?: Record<string, unknown>) =>
    dataBridge.getFundIncreaseRank(params || {}),

  getFundDecreaseRank: (params?: Record<string, unknown>) =>
    dataBridge.getFundDecreaseRank(params || {}),

  getMacroDashboard: (params?: Record<string, unknown>) =>
    dataBridge.getMacroDashboard(params || {}),

  getMarginData: (params?: Record<string, unknown>) =>
    dataBridge.getMarginData(params || {}),

  getMarginBalanceRank: (params?: Record<string, unknown>) =>
    dataBridge.getMarginBalanceRank(params || {}),

  getShortInterestRank: (params?: Record<string, unknown>) =>
    dataBridge.getShortInterestRank(params || {}),

  getSectorHeatmap: (type?: string, limit?: number) =>
    dataBridge.getSectorHeatmap(type || 'industry', limit || 50),

  // ── Screening ────────────────────────────────────────────────────────
  searchStocks: (query: string) => dataBridge.searchStocks(query),

  getSmartPick: (params?: Record<string, unknown>) =>
    dataBridge.getSmartPick(params || {}),

  diagnoseStock: (symbol: string) => dataBridge.diagnoseStock(symbol),

  analyzeSectorRotation: (params?: Record<string, unknown>) =>
    dataBridge.analyzeSectorRotation(params || {}),

  // ── Quote Stream ─────────────────────────────────────────────────────
  subscribeQuoteStream: (symbols: string[]) =>
    dataBridge.subscribeQuoteStream(symbols),

  unsubscribeQuoteStream: (symbols: string[]) =>
    dataBridge.unsubscribeQuoteStream(symbols),

  getQuoteStreamStatus: () => dataBridge.getQuoteStreamStatus(),

  // ── AI ───────────────────────────────────────────────────────────────
  getAISuggest: (params?: Record<string, unknown>) =>
    dataBridge.getAISuggest(params || {}),

  // ── Paper Trading ────────────────────────────────────────────────────
  getPaperTraderStatus: () => dataBridge.getPaperTraderStatus(),

  getTradeHistory: (params?: Record<string, unknown>) =>
    dataBridge.getTradeHistory(params || {}),

  generateDemoKlines: (params: Record<string, unknown>) =>
    dataBridge.generateDemoKlines(params),
};
