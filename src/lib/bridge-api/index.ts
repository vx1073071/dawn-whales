/**
 * @deprecated Use src/services/ instead (R108 S-34).
 * Service layer provides typed, domain-split interfaces.
 *
 * ── quant-moo — Bridge API Index ────────────────────────────────────
 * S-15p1: Re-export all modules + types
 * Backward-compatible: import { x } from 'src/lib/bridge-api' still works.
 */

// Types
export type { /* Window.api type is global, no named exports needed */ } from '../bridge-api-types';

// Data module (Data Provider + Market Data Stubs + Demo K-line)
export {
  getFundamental,
  getCapitalFlow,
  getMarketRegime,
  getAnomalies,
  getNews,
  getCompositeScore,
  saveFundamentalData,
  saveCapitalFlowData,
  saveMarketRegimeData,
  computeMarketRegime,
  saveAnomalySignal,
  saveNewsItems,
  clearDataCache,
  getStockCapitalFlowRank,
  getSectorCapitalFlowRank,
  getConceptCapitalFlowRank,
  getConsumerData,
  getMarketHotspot,
  getDragonTigerList,
  getDragonTigerDetail,
  getInstitutionalTrades,
  getFundHoldings,
  getStockFundOwnership,
  getFundIncreaseRank,
  getFundDecreaseRank,
  getMacroDashboard,
  getMarginData,
  getMarginBalanceRank,
  getShortInterestRank,
  getSectorHeatmap,
  searchNews,
  getMarketMood,
  subscribeQuoteStream,
  unsubscribeQuoteStream,
  getQuoteStreamStatus,
  analyzeSectorRotation,
  getSmartPick,
  diagnoseStock,
  searchStocks,
  getAnomalyAlerts,
  getAnomalySummary,
  acknowledgeAnomalyAlert,
  computeSentiment,
  getAISuggest,
  getPaperTraderStatus,
  getTradeHistory,
  generateDemoKlines,
} from './data';

// Trade module (Broker + Broker Manager + Strategy + Strategy CRUD + Signals)
export {
  connectBroker,
  getKlines,
  getAccounts,
  getFunds,
  getPositions,
  getQuotes,
  subscribeQuotes,
  unsubscribeQuotes,
  getWatchlist,
  saveWatchlist,
  calculateGreeks,
  calculatePortfolioGreeks,
  getOrders,
  cancelOrder,
  placeOrder,
  isConnected,
  listBrokers,
  addBroker,
  removeBroker,
  setActiveBroker,
  getBrokerStatus,
  createStrategy,
  getAllStrategies,
  runBacktest,
  startLive,
  stopLive,
  getStrategies,
  updateStrategy,
  deleteStrategy,
  getSignals,
} from './trade';

// Risk module (NL Parser + Risk + Risk Config)
export {
  parseNL,
  getTemplates,
  getRiskAlerts,
  getRiskConfig,
  updateRiskConfig,
} from './risk';

// App module (App/Updater + Backtest Enhancement + Marketplace)
export {
  checkUpdate,
  downloadUpdate,
  installUpdate,
  multiPeriodBacktest,
  parameterSweep,
  walkForwardAnalysis,
  computeRiskMetrics,
  runWalkForwardV2,
  runParamScan,
  runMultiTimeframe,
  rateStrategy,
  getStrategyRating,
  addComment,
  getComments,
  savePerformance,
  getPerformance,
  getMarketplaceList,
  getStrategyScore,
  verifyStrategy,
  updateAllScores,
} from './app';
