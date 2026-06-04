// ── DAWN WHALES — Electron Main Process ────────────────────────────────────
// 架构对齐：富途牛牛桌面端 (Electron + C++ core + React)
// 我们用：Electron + Node.js (Main) + React (Renderer)

import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { autoUpdater } from 'electron-updater';
import { FutuOpenDClient } from './broker/futu-opend';
import { BrokerManager } from './broker/BrokerManager';
import type { BrokerConfig } from './broker/IBrokerAdapter';
import { StrategyEngine } from './engine/strategy-engine';
import { BacktestEngine } from './engine/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from './engine/nl-parser';
import { MarketplaceService } from './data/marketplace-service';
import { DataProviderService } from './data/data-provider';
import { EMDataProvider } from './data/em-data-provider';
import { MacroDataProvider } from './data/macro-provider';
import { SentimentIndexEngine } from './engine/sentiment-index';
import { getRealtimeSentimentStream } from './engine/sentiment-stream';
import { getDataQualityDashboard } from './engine/data-quality-dashboard';
import { exploreCache, getCacheEntryDetail, getCacheKeys } from './engine/cache-explorer';
import { getSentimentDashboard } from './engine/sentiment-dashboard';
import { exportData, getAvailableModules } from './engine/data-export-service';
import { getRateLimiterManager } from './engine/rate-limiter';
import { runConsistencyCheck, getConsistencyRules } from './engine/data-consistency-checker';
import { StockScreenerService } from './engine/stock-screener';
import { NewsAggregatorService } from './engine/news-aggregator';
import { SectorRotationMonitor } from './engine/sector-rotation';
import { StockAnomalyDetector } from './engine/stock-anomaly-detector';
import { MarketHotspotService } from './engine/market-hotspot';
import { DataSchedulerService } from './engine/data-scheduler';
import { initQuoteStream, getQuoteStream } from './engine/quote-stream';
import { initLiveExecutor, getLiveExecutor, LiveExecutor } from './engine/live-executor';
import { getDragonTigerList, getDragonTigerDetail, getInstitutionalTrades } from './engine/dragon-tiger-list';
import { getStockCapitalFlowRank, getSectorCapitalFlowRank, getConceptCapitalFlowRank } from './engine/capital-flow-rank';
import { getCapitalFlowMonitor } from './engine/capital-flow-monitor';
import { getFundHoldings, getStockFundOwnership, getFundIncreaseRank, getFundDecreaseRank } from './engine/fund-holdings';
import { diagnoseStock, batchDiagnose } from './engine/stock-diagnosis';
import { calculatePortfolioRisk } from './engine/portfolio-risk';
import { getMarketBreadth } from './engine/market-breadth';
import { getConsumerDataReport } from './engine/consumer-data';
import { getMarginDataReport, getStockMargin, getMarginBalanceRanking, getShortInterestRanking } from './engine/margin-data';
import { getStockOverview, getMarketOverview, getDailyReport } from './engine/emi-unified';
import { getPythonProxy } from './data/python-proxy';
import { getPush2Proxy } from './data/push2-proxy';
import { getDataQualityMonitor, registerModule } from './engine/data-quality-monitor';
import { setupI18nDataIPC } from './engine/i18n-data';
import { getFinancialReports } from './engine/financial-reports';
import { getValuationData } from './engine/valuation-data';
import { computeIndicators } from './engine/technical-indicators';
import { blackScholesPrice, calculateGreeks, impliedVolatility, buildVolSurface, priceAndGreeks } from './engine/options-pricing';
import { calculateRiskMetrics, calcSharpeRatio, calcMaxDrawdown, calcVaR } from './engine/risk-metrics';
import { brinsonAttribution, timeSeriesAttribution } from './engine/performance-attribution';
import { correlationMatrix } from './engine/correlation-matrix-v2';
import { detectSectorRotation } from './engine/sector-rotation-v2';
import { getDataQualityStream } from './engine/data-quality-stream';
import { getSmartCacheManager } from './engine/smart-cache';
import { getDragonTigerStream } from './engine/dragon-tiger-stream';
import { getUnlockCalendar } from './engine/unlock-calendar';
import { getDividendCalendar } from './engine/dividend-calendar';
import { getEarningsCalendar } from './engine/earnings-calendar';
import { exportData } from './engine/data-exporter';
import { getSmartPicker } from './engine/smart-picker';
import { getWsDataStream } from './data/ws-data-stream';
import { getHistoryBackfill } from './data/history-backfill';
// QClaw Q57-Q60
import SentimentAttributionEngine from './engine/sentiment-attribution';
import CapitalFlowPredictor from './engine/capital-flow-predictor';
import SmartOrderRouter from './engine/smart-order-router';
import TCAV2Engine from './engine/tca-v3';
import { z } from 'zod';
import { WalkForwardEngine } from './engine/walk-forward';
import { ParameterScanner } from './engine/parameter-scanner-v2';
import { computeCorrelationMatrix } from './engine/correlation-matrix';
import { generateSmartAlerts, generateAlertSummary, type NotificationContext } from './engine/notification-engine';
import { generateBacktestReport, generateQuickReport } from './engine/ai-report-generator';
import { autoTune, type ParamRange } from './engine/auto-tuner';
import { detectRegime, type RegimeLabel } from './engine/regime-detector';
import { decomposeRisk, runMonteCarlo } from './engine/risk-decomposition';
import { detectAnomalies } from './engine/anomaly-detector';
import { buildCorrelationVisualization } from './engine/correlation-visualizer';
import { runStressTest, runCustomShock, HISTORICAL_SCENARIOS } from './engine/stress-tester';
import { compareBacktests, summaryTable } from './engine/backtest-comparator';
import { getValuationDashboard, getValuationDashboardBatch } from './engine/valuation-dashboard';
import { compareSectorStocks, compareMultipleSectors, rankSectorStocks } from './engine/sector-comparison';
import { detectMacroAnomalies, analyzeMultipleIndicators } from './engine/macro-alert';
import { detectCorrelationAnomalies, analyzeCorrelationMatrix } from './engine/correlation-alert';
import { generateWalkForwardReport, generateBatchWalkForwardReport } from './engine/walk-forward-report';
import { generateBrinsonReport, generateBatchBrinsonReport } from './engine/brinson-attribution';
import { analyzeOptionsChain, analyzeBatchOptionsChain } from './engine/options-chain-analyzer';
import { validate,
  BrokerConnectSchema,
  BrokerGetFundsSchema,
  BrokerGetPositionsSchema,
  BrokerGetQuotesSchema,
  BrokerSubscribeSchema,
  BrokerGetKlinesSchema,
  BrokerPlaceOrderSchema,
  BrokerCancelOrderSchema,
  BrokerSwitchSchema,
  BrokerAddSchema,
  StrategyCreateSchema,
  StrategyUpdateSchema,
  StrategyGetSchema,
  StrategyBacktestSchema,
  BacktestMultiPeriodSchema,
  BacktestParamSweepSchema,
  BacktestRiskMetricsSchema,
  BacktestWalkForwardSchema,
  BacktestParamScanSchema,
  BacktestMultiTimeframeSchema,
  RiskUpdateConfigSchema,
  RiskUpdateVixSchema,
  DbSaveStrategySchema,
  DbSaveSettingsSchema,
  DbSaveWatchlistSchema,
  DbGetTradesSchema,
  DbGetBacktestResultsSchema,
  DbGetSignalsSchema,
  DbSaveFundamentalSchema,
  DbSaveCapitalFlowSchema,
  DbSaveRegimeSchema,
  DbSaveAnomalySchema,
  DbSaveNewsSchema,
  DataComputeRegimeSchema,
  MarketplaceRateSchema,
  MarketplaceCommentSchema,
  MarketplaceSavePerformanceSchema,
  MarketplaceListSchema,
  GreeksCalculateSchema,
  GreeksPortfolioSchema,
  DataNewsSchema,
  DataFundamentalSchema,
  DataCapitalFlowSchema,
  DataAnomaliesSchema,
  DataCompositeScoreSchema,
  NlParseSchema,
  StrategyExplainSchema,
  StrategyCompareSchema,
  StrategyOptimizeSchema,
  StrategyCorrelationSchema,
  NotificationGenerateSchema,
  ReportGenerateSchema,
  ReportQuickSchema,
  StrategyAutoTuneSchema,
} from './ipc-schemas';
const _secureKey = require('./utils/secure-key');
const getDeepSeekKey_ = (app: any) => _secureKey.getDeepSeekKey_(app);
import log from 'electron-log';

// 默认监控列表，连接时从 DB 读取用户配置
let WATCHLIST = ['US.TQQQ','US.SOXL','US.QQQ','US.SPY','US.AAPL','US.NVDA','US.SQQQ','US.SOXS'];

// ── Utils ──────────────────────────────────────────────────────────────────
const execAsync = promisify(exec);

// ── Configuration ──────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const RESOURCES_PATH = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'resources');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let opendClient: FutuOpenDClient | null = null;
let brokerManager: BrokerManager | null = null;
let strategyEngine: StrategyEngine | null = null;
let backtestEngine: BacktestEngine | null = null;
let riskEngine: RiskEngine | null = null;
let liveExecutor: LiveExecutor | null = null;
let db: DatabaseManager | null = null;
let marketplaceService: MarketplaceService | null = null;
let dataProvider: DataProviderService | null = null;
let emDataProvider: EMDataProvider | null = null;
let macroDataProvider: MacroDataProvider | null = null;
let stockScreener: StockScreenerService | null = null;
let newsAggregator: NewsAggregatorService | null = null;
let sectorRotation: SectorRotationMonitor | null = null;
let stockAnomalyDetector: StockAnomalyDetector | null = null;
let marketHotspot: MarketHotspotService | null = null;
let dataScheduler: DataSchedulerService | null = null;

// ── Shared quote push handler (prevents duplicate listener registration) ─────
const quotePushHandler = (quotes: any[]) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('quotes:push', quotes);
  strategyEngine?.onQuoteUpdate(quotes);
};

// ── Black-Scholes Greeks (pure JS, ~5µs, P0: replaces Python subprocess) ──
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
function calcGreeksJS(spot: number, strike: number, vol: number, days: number, rate: number, type: 'CALL' | 'PUT') {
  const T = Math.max(days, 0.01) / 365;
  const d1 = (Math.log(spot / strike) + (rate + vol * vol / 2) * T) / (vol * Math.sqrt(T));
  const d2 = d1 - vol * Math.sqrt(T);
  const nd1 = normCDF(d1);
  const sign = type === 'CALL' ? 1 : -1;
  const price = sign * (spot * nd1 - strike * Math.exp(-rate * T) * normCDF(d2 * sign));
  const delta = sign * nd1;
  const gamma = normPDF(d1) / (spot * vol * Math.sqrt(T));
  const vega = (spot * normPDF(d1) * Math.sqrt(T)) / 100;
  const theta = (-spot * normPDF(d1) * vol / (2 * Math.sqrt(T)) - sign * rate * strike * Math.exp(-rate * T) * normCDF(d2 * sign)) / 365;
  const rho = (sign * strike * T * Math.exp(-rate * T) * normCDF(d2 * sign)) / 100;
  return { price: Math.max(price, 0), delta, gamma, theta, vega, rho };
}

// ── Window Creation ────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'DAWN WHALES · 道鲸',
    icon: path.join(RESOURCES_PATH, 'icons', 'icon.png'),
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  // Load app — dev server in development, built files in production
  const hasDevServer = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (hasDevServer) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Log renderer console messages
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['log', 'warn', 'error'];
    log.info(`[Renderer:${levels[level] || 'log'}] ${message}`);
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

function setupIPC() {
  // ── i18n Data Layer (JVS-40) ───────────────────────────────────────────
  setupI18nDataIPC();

  // ── Financial Reports (JVS-41) ─────────────────────────────────────────
  ipcMain.handle('em:get-financials', async (_e, code: string, quarters?: number) => {
    try {
      return await getFinancialReports(code, quarters);
    } catch (err: any) {
      log.error('[FinancialReports] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Valuation Data (JVS-42) ────────────────────────────────────────────
  ipcMain.handle('em:get-valuation', async (_e, code: string, historyDays?: number) => {
    try {
      return await getValuationData(code, historyDays);
    } catch (err: any) {
      log.error('[ValuationData] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Technical Indicators (JVS-43) ──────────────────────────────────────
  ipcMain.handle('indicator:compute', async (_e, klines: any[], indicators?: string[], options?: any) => {
    try {
      return computeIndicators(klines, indicators, options);
    } catch (err: any) {
      log.error('[TechnicalIndicators] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Options Pricing Engine (JVS-44) ────────────────────────────────────
  ipcMain.handle('em:price-option', async (_e, params: any) => {
    try {
      return { success: true, ...blackScholesPrice(params) };
    } catch (err: any) {
      log.error('[OptionsPricing] Price error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:calc-greeks', async (_e, params: any) => {
    try {
      return { success: true, ...calculateGreeks(params) };
    } catch (err: any) {
      log.error('[OptionsPricing] Greeks error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:implied-vol', async (_e, marketPrice: number, S: number, K: number, T: number, r: number, optionType: string, q?: number) => {
    try {
      return { success: true, ...impliedVolatility(marketPrice, S, K, T, r, optionType as any, q) };
    } catch (err: any) {
      log.error('[OptionsPricing] IV error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:vol-surface', async (_e, S: number, r: number, strikes: number[], expiries: number[], callPrices: number[][], putPrices?: number[][]) => {
    try {
      const surface = buildVolSurface(S, r, strikes, expiries, callPrices, putPrices);
      return { success: true, surface };
    } catch (err: any) {
      log.error('[OptionsPricing] Surface error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:price-and-greeks', async (_e, params: any) => {
    try {
      return { success: true, ...priceAndGreeks(params) };
    } catch (err: any) {
      log.error('[OptionsPricing] Price+Greeks error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Risk Metrics Calculator (JVS-46) ───────────────────────────────────
  ipcMain.handle('em:calc-risk-metrics', async (_e, params: any) => {
    try {
      const result = calculateRiskMetrics(params);
      return { success: true, metrics: result };
    } catch (err: any) {
      log.error('[RiskMetrics] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:calc-sharpe', async (_e, returns: number[], riskFreeRate?: number, tradingDays?: number) => {
    try {
      return { success: true, sharpe: calcSharpeRatio(returns, riskFreeRate, tradingDays) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:calc-max-drawdown', async (_e, returns: number[]) => {
    try {
      return { success: true, maxDrawdown: calcMaxDrawdown(returns) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:calc-var', async (_e, returns: number[], confidence?: number) => {
    try {
      return { success: true, var: calcVaR(returns, confidence) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Performance Attribution (JVS-45) ─────────────────────────────────
  ipcMain.handle('em:portfolio-attribution', async (_e, params: any) => {
    try {
      const result = brinsonAttribution(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Attribution] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:time-series-attribution', async (_e, params: any) => {
    try {
      const result = timeSeriesAttribution(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Attribution] TimeSeries Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Correlation Matrix v2 (JVS-47) ──────────────────────────────────────
  ipcMain.handle('em:correlation-matrix', async (_e, params: any) => {
    try {
      const result = correlationMatrix(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[CorrelationMatrix] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Sector Rotation v2 (JVS-48) ─────────────────────────────────────────
  ipcMain.handle('em:sector-rotation', async (_e, params: any) => {
    try {
      const result = detectSectorRotation(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SectorRotation] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Attribution (QClaw Q57) ──────────────────────────────────
  const sentimentAttrEngine = new SentimentAttributionEngine();
  ipcMain.handle('sentiment:attribution', async (_e, params: any) => {
    try {
      const result = sentimentAttrEngine.attributeSentiment(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SentimentAttr] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Capital Flow Predictor (QClaw Q58) ─────────────────────────────────
  const flowPredictor = new CapitalFlowPredictor();
  ipcMain.handle('predict:capital-flow', async (_e, params: any) => {
    try {
      const result = flowPredictor.predict(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[FlowPredict] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Smart Order Router (QClaw Q59) ─────────────────────────────────────
  const orderRouter = new SmartOrderRouter();
  ipcMain.handle('order:route', async (_e, params: any) => {
    try {
      const result = orderRouter.route(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[OrderRouter] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── TCA V2 (QClaw Q60) ────────────────────────────────────────────────
  const tcaEngine = new TCAV2Engine();
  ipcMain.handle('order:tca', async (_e, params: any) => {
    try {
      const result = tcaEngine.analyze(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[TCA] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Valuation Dashboard (JVS-49) ────────────────────────────────────────
  ipcMain.handle('data:valuation-dashboard', async (_e, codes: string[], historyDays?: number) => {
    try {
      const result = await getValuationDashboard(codes, historyDays);
      return { success: true, result };
    } catch (err: any) {
      log.error('[ValuationDashboard] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:valuation-dashboard-batch', async (_e, codes: string[], batchSize?: number, delayMs?: number) => {
    try {
      const result = await getValuationDashboardBatch(codes, batchSize, delayMs);
      return { success: true, result };
    } catch (err: any) {
      log.error('[ValuationDashboardBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Sector Comparison (JVS-50) ──────────────────────────────────────────
  ipcMain.handle('data:sector-compare', async (_e, stocks: any[], financialData: any) => {
    try {
      const financialMap = new Map(Object.entries(financialData || {}));
      const result = await compareSectorStocks(stocks, financialMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SectorComparison] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:sector-compare-multiple', async (_e, sectors: any[], financialData: any) => {
    try {
      const financialMap = new Map(Object.entries(financialData || {}));
      const result = await compareMultipleSectors(sectors, financialMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SectorComparisonMultiple] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:sector-rank', async (_e, metrics: any[], weights?: any) => {
    try {
      const result = rankSectorStocks(metrics, weights);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SectorRank] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Macro Alert (JVS-51) ────────────────────────────────────────────────
  ipcMain.handle('alert:macro', async (_e, currentData: any[], historicalData: any) => {
    try {
      const historicalMap = new Map(Object.entries(historicalData || {}) as [string, number[]][]);
      const result = await detectMacroAnomalies(currentData, historicalMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[MacroAlert] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('alert:macro-multiple', async (_e, indicatorData: any[]) => {
    try {
      const result = await analyzeMultipleIndicators(indicatorData);
      return { success: true, result };
    } catch (err: any) {
      log.error('[MacroAlertMultiple] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Correlation Alert (JVS-52) ─────────────────────────────────────────
  ipcMain.handle('alert:correlation', async (_e, snapshots: any[], historicalData: any) => {
    try {
      const histMap = new Map(Object.entries(historicalData || {}) as [string, number[]][]);
      const result = await detectCorrelationAnomalies(snapshots, histMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[CorrelationAlert] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('alert:correlation-matrix', async (_e, matrix: number[][], codes: string[], prevMatrix?: number[][], histMatrices?: any) => {
    try {
      const histMap = histMatrices ? new Map(Object.entries(histMatrices) as [string, number[]][]) : undefined;
      const result = await analyzeCorrelationMatrix(matrix, codes, prevMatrix, histMap);
      return { success: true, result };
    } catch (err: any) {
      log.error('[CorrelationAlertMatrix] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Walk-Forward Report (JVS-53) ───────────────────────────────────────
  ipcMain.handle('report:walk-forward', async (_e, strategyName: string, windows: any[]) => {
    try {
      const result = generateWalkForwardReport(strategyName, windows);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WalkForwardReport] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('report:walk-forward-batch', async (_e, strategies: any[]) => {
    try {
      const result = await generateBatchWalkForwardReport(strategies);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WalkForwardReportBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Brinson Attribution (JVS-54) ───────────────────────────────────────
  ipcMain.handle('report:brinson-attribution', async (_e, holdings: any[], benchmark: any[], benchmarkReturn: number) => {
    try {
      const result = generateBrinsonReport(holdings, benchmark, benchmarkReturn);
      return { success: true, result };
    } catch (err: any) {
      log.error('[BrinsonAttribution] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('report:brinson-batch', async (_e, portfolios: any[]) => {
    try {
      const result = await generateBatchBrinsonReport(portfolios);
      return { success: true, result };
    } catch (err: any) {
      log.error('[BrinsonAttributionBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Options Chain Analyzer (JVS-55) ─────────────────────────────────
  ipcMain.handle('options:chain-analyze', async (_e, contracts: any[], symbol: string, historicalIVRange?: any) => {
    try {
      const result = analyzeOptionsChain(contracts, symbol, historicalIVRange);
      return { success: true, result };
    } catch (err: any) {
      log.error('[OptionsChain] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('options:chain-batch', async (_e, symbols: any[]) => {
    try {
      const result = await analyzeBatchOptionsChain(symbols);
      return { success: true, result };
    } catch (err: any) {
      log.error('[OptionsChainBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Broker: Multi-broker support (WP1 + Sprint1) ────────────────────
  ipcMain.handle('broker:connect', async (_e, config: { host: string; port: number; brokerId?: string }) => {
    try {
      // Use BrokerManager if available, fallback to legacy opendClient
      if (brokerManager) {
        const brokerCfg: BrokerConfig = {
          id: config.brokerId || 'futu-default',
          name: config.brokerId || 'Futu OpenD',
          type: 'futu',
          host: config.host || '127.0.0.1',
          port: config.port || 11111,
          enabled: true,
        };
        brokerManager.loadConfigs([brokerCfg]);
        brokerManager.clearCallbacks();
        brokerManager.onQuotePush(quotePushHandler);
        await brokerManager.connect(brokerCfg.id);
        // Load watchlist
        const savedWatchlist = db?.getWatchlist();
        if (savedWatchlist && savedWatchlist.length > 0) {
          WATCHLIST = savedWatchlist;
        }
        await brokerManager.subscribeAndPush(brokerCfg.id, WATCHLIST);
        log.info('[Broker] Multi-broker connected:', brokerCfg.id);
        return { success: true, brokerId: brokerCfg.id, host: config.host, port: config.port };
      }

      // Legacy single-broker path
      opendClient = new FutuOpenDClient(config.host || '127.0.0.1', config.port || 11111);
      await opendClient.connect();
      log.info('[Broker] OpenD connected');

      opendClient.onQuotePush((quotes) => {
        mainWindow?.webContents.send('quotes:push', quotes);
        strategyEngine?.onQuoteUpdate(quotes);
      });
      const savedWatchlist = db?.getWatchlist();
      if (savedWatchlist && savedWatchlist.length > 0) {
        WATCHLIST = savedWatchlist;
        log.info('[Broker] Loaded watchlist from DB:', WATCHLIST);
      }
      await opendClient.subscribeAndPush(WATCHLIST);
      log.info('[Broker] Push mode active');

      return { success: true, host: config.host, port: config.port };
    } catch (err: any) {
      log.error('[Broker] Connect failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:disconnect', async () => {
    opendClient?.disconnect();
    opendClient = null;
    return { success: true };
  });

  ipcMain.handle('broker:getAccounts', async () => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, accounts: await opendClient.getAccounts() };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getFunds', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const funds = await opendClient.getFunds(accountId);
      riskEngine?.updateTotalAssets(funds?.totalAssets || 0);
      return { success: true, funds };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getPositions', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, positions: await opendClient.getPositions(accountId) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getQuotes', async (_e, codes: string[]) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const quoteList = (!codes || codes.length === 0) ? WATCHLIST : codes;
      return { success: true, quotes: await opendClient.getQuotes(quoteList) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Subscribe / Unsubscribe (WP1: 动态监控列表) ────────────────────
  ipcMain.handle('broker:subscribe', async (_e, codes: string[]) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      // Merge with existing watchlist, dedupe
      const merged = Array.from(new Set([...WATCHLIST, ...codes]));
      WATCHLIST = merged;
      await opendClient.subscribeAndPush(WATCHLIST);
      // Persist to DB
      db?.saveWatchlist(WATCHLIST);
      log.info('[Broker] Subscribed:', codes);
      return { success: true, watchlist: WATCHLIST };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:unsubscribe', async (_e, codes: string[]) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      WATCHLIST = WATCHLIST.filter((c) => !codes.includes(c));
      await opendClient.subscribeAndPush(WATCHLIST);
      db?.saveWatchlist(WATCHLIST);
      log.info('[Broker] Unsubscribed:', codes);
      return { success: true, watchlist: WATCHLIST };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getKlines', async (_e, code: string, period: string, count: number) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      // Check cache first
      const cached = db?.getKlines(code, period || 'daily', count || 200);
      if (cached && cached.length > 0) {
        return { success: true, klines: cached, cached: true };
      }
      const klines = await opendClient.getKlines(code, period || 'daily', count || 200);
      // Cache for future use
      if (klines.length > 0 && db) {
        db.saveKlines(code, period || 'daily', klines);
      }
      return { success: true, klines };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Order Placement (with input validation) ─────────────────────────
  ipcMain.handle('broker:placeOrder', async (_e, order: any) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    // Input validation
    if (!order || typeof order !== 'object') {
      return { success: false, error: 'Invalid order object' };
    }
    if (!order.code || typeof order.code !== 'string') {
      return { success: false, error: 'Missing or invalid order.code' };
    }
    if (!['BUY', 'SELL'].includes(order.side)) {
      return { success: false, error: 'Invalid order.side (must be BUY or SELL)' };
    }
    if (typeof order.qty !== 'number' || order.qty <= 0 || order.qty > 1000000 || !Number.isInteger(order.qty)) {
      return { success: false, error: 'Invalid order.qty (must be positive integer <= 1,000,000)' };
    }
    if (order.price !== undefined && (typeof order.price !== 'number' || order.price < 0)) {
      return { success: false, error: 'Invalid order.price' };
    }
    const riskResult = riskEngine?.checkOrder(order);
    if (riskResult && !riskResult.pass) {
      mainWindow?.webContents.send('risk-alert', { order, reason: riskResult.reason });
      return { success: false, error: `风控拦截: ${riskResult.reason}` };
    }
    try {
      const result = await opendClient.placeOrder(order);
      db?.saveTrade({ ...order, orderId: result.orderId, status: 'submitted' });
      mainWindow?.webContents.send('order-update', { ...order, orderId: result.orderId, status: 'submitted' });
      return { success: true, ...result };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:cancelOrder', async (_e, orderId: string, accountId: string, code: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      await opendClient.cancelOrder(orderId, accountId, code);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getOrders', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, orders: await opendClient.getOrders(accountId) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Broker Manager (Sprint1: multi-broker) ──────────────────────────
  ipcMain.handle('broker:list', async () => {
    return { success: true, brokers: brokerManager?.getConfigs() || [] };
  });

  ipcMain.handle('broker:add', async (_e, cfg: BrokerConfig) => {
    const vErr = validate(BrokerAddSchema, { cfg });
    if (vErr) return vErr;
    try {
      brokerManager?.addConfig(cfg);
      db?.saveBrokerConfig(cfg);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:remove', async (_e, id: string) => {
    try {
      brokerManager?.removeConfig(id);
      db?.deleteBrokerConfig(id);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:setActive', async (_e, id: string) => {
    try {
      brokerManager?.setActiveBroker(id);
      return { success: true, activeBroker: id };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Broker Switching (Sprint1) ───────────────────────────────────────
  ipcMain.handle('broker:switch', async (_e, id: string) => {
    const vErr = validate(BrokerSwitchSchema, { id });
    if (vErr) return vErr;
    try {
      const adapter = brokerManager?.getAdapters().get(id);
      if (!adapter) {
        // Broker not yet connected — connect first
        const config = brokerManager?.getConfigs().find((c: any) => c.id === id);
        if (!config) return { success: false, error: `Broker config not found: ${id}` };

        brokerManager?.loadConfigs([config]);
        await brokerManager?.connect(id);
      } else if (!adapter.connected) {
        await adapter.connect();
      }

      brokerManager?.setActiveBroker(id);
      const activeId = brokerManager?.getActiveBrokerId();
      const activeAdapter = brokerManager?.getActiveBroker();

      // Re-subscribe quotes for the newly active broker
      if (activeAdapter) {
        brokerManager?.clearCallbacks();
        brokerManager?.onQuotePush(quotePushHandler);
        const savedWatchlist = db?.getWatchlist();
        await activeAdapter.subscribeAndPush(savedWatchlist && savedWatchlist.length > 0 ? savedWatchlist : WATCHLIST);
      }

      const status = brokerManager?.getStatus() || [];
      const switched = status.find((s: any) => s.id === activeId);

      log.info(`[Broker] Switched to ${id}, connected=${switched?.connected}`);
      mainWindow?.webContents.send('broker:switched', { activeBroker: activeId, status });
      return { success: true, activeBroker: activeId, brokerStatus: switched };
    } catch (err: any) {
      log.error('[Broker] Switch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:getStatus', async () => {
    return { success: true, status: brokerManager?.getStatus() || [] };
  });

  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: any) => {
    const vErr = validate(StrategyCreateSchema, { dsl });
    if (vErr) return vErr;
    try {
      const id = strategyEngine?.createStrategy(dsl);
      const strategy = strategyEngine?.getStrategy(id!);
      if (strategy && db) db.saveStrategy(strategy);
      return { success: true, id, strategy };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('strategy:getAll', async () => {
    return { success: true, strategies: strategyEngine?.getAllStrategies() || [] };
  });

  ipcMain.handle('strategy:get', async (_e, id: string) => {
    const strategy = strategyEngine?.getStrategy(id);
    return { success: !!strategy, strategy };
  });

  // ── Strategy Update (with field whitelist for security) ─────────────
  const STRATEGY_UPDATE_WHITELIST = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];
  ipcMain.handle('strategy:update', async (_e, id: string, updates: any) => {
    const vErr = validate(StrategyUpdateSchema, { updates });
    if (vErr) return vErr;
    try {
      const strategy = strategyEngine?.getStrategy(id);
      if (!strategy) return { success: false, error: 'Strategy not found' };
      // Security: only allow whitelisted fields
      const sanitized: any = {};
      for (const key of STRATEGY_UPDATE_WHITELIST) {
        if (key in updates) sanitized[key] = updates[key];
      }
      Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
      if (db) db.saveStrategy(strategy);
      return { success: true, strategy };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('strategy:delete', async (_e, id: string) => {
    strategyEngine?.deleteStrategy(id);
    db?.deleteStrategy(id);
    return { success: true };
  });

  ipcMain.handle('strategy:backtest', async (_e, config: any) => {
    if (!strategyEngine || !backtestEngine) {
      return { success: false, error: 'Engine not ready' };
    }
    try {
      // Fetch K-lines
      let klines = config.klines;
      if (!klines || klines.length === 0) {
        // Try cache first
        klines = db?.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
        if (!klines || klines.length === 0) {
          if (opendClient?.connected) {
            klines = await opendClient.getKlines(config.symbol || 'US.TQQQ', config.period || 'daily', config.count || 200);
            if (klines.length > 0 && db) db.saveKlines(config.symbol || 'US.TQQQ', config.period || 'daily', klines);
          }
        }
      }

      if (!klines || klines.length < 50) {
        return { success: false, error: 'K线数据不足（需要至少50根），请确认 OpenD 已连接' };
      }

      const strategyId = config.strategyId;
      if (strategyId) {
        const result = await strategyEngine.runBacktest(strategyId, klines);
        if (result.success && db) {
          db.saveBacktestResult({
            strategyId, ...result.result,
            initialCapital: config.initialCapital || 100000,
          });
        }
        return result;
      }

      return await backtestEngine.run({ ...config, klines });
    } catch (err: any) {
      log.error('[IPC] Backtest error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('strategy:startLive', async (_e, strategyId: string) => {
    strategyEngine?.startLive(strategyId);
    return { success: true };
  });

  ipcMain.handle('strategy:stopLive', async (_e, strategyId: string) => {
    strategyEngine?.stopLive(strategyId);
    return { success: true };
  });

  // ── Backtest Enhancement (Sprint 2: P1) ──────────────────────────

  ipcMain.handle('backtest:multiPeriod', async (_e, config: any) => {
    const vErr = validate(BacktestMultiPeriodSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const results = await enhancer.multiPeriodBacktest(
        config.klines, config.strategyConfig, config.periods
      );
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:paramSweep', async (_e, config: any) => {
    const vErr = validate(BacktestParamSweepSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const results = await enhancer.parameterSweep(
        config.klines, config.baseConfig, config.paramRanges, config.maxCombinations || 100
      );
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // NOTE: backtest:walk-forward is defined below (line ~980) using JVS WalkForwardEngine.
  // The old backtest:walkForward handler has been removed to avoid duplicate registration.

  ipcMain.handle('backtest:riskMetrics', async (_e, equityCurve: number[], riskFreeRate?: number) => {
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const metrics = enhancer.computeDeepRiskMetrics(equityCurve, riskFreeRate || 0.03);
      return { success: true, metrics };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Strategy AI — LLM-powered (Sprint 2 P1) ─────────────────────
  ipcMain.handle('strategy:explain', async (_e, strategy: any) => {
    const apiKey = getDeepSeekKey_(app);
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };
    }
    const prompt = `You are a quantitative trading strategy analyst. Explain the following strategy in clear, actionable English for a retail trader.

Strategy:
- Name: ${strategy.name || 'Unnamed'}
- Symbol: ${strategy.symbol || 'Unknown'}
- Type: ${strategy.strategy?.type || 'Unknown'}
- Params: ${JSON.stringify(strategy.strategy?.params || {})}}
- Stop Loss: ${strategy.strategy?.stopLoss || 'Not set'}%
- Take Profit: ${strategy.strategy?.takeProfit || 'Not set'}%
- Description: ${strategy.description || 'No description'}

Provide a concise explanation covering:
1. What the strategy does (in plain language)
2. Entry and exit conditions
3. Risk management (stop loss / take profit)
4. Ideal market conditions for this strategy

Keep it under 200 words. Use bullet points.`;

    try {
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 400 });
      const result = await new Promise<any>((resolve, reject) => {
        const req = require('https').request(
          { hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } },
          (res: any) => { let data = ''; res.on('data', (c: string) => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); }
        );
        req.on('error', reject); req.write(body); req.end();
      });
      const content = result.choices?.[0]?.message?.content || '';
      return { success: true, explanation: content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('strategy:compare', async (_e, s1: any, s2: any) => {
    const apiKey = getDeepSeekKey_(app);
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };
    }
    const fmt = (s: any) => `Name: ${s.name || '?'} | Symbol: ${s.symbol || '?'} | Type: ${s.strategy?.type || '?'} | Params: ${JSON.stringify(s.strategy?.params || {})} | SL: ${s.strategy?.stopLoss || '?'}% | TP: ${s.strategy?.takeProfit || '?'}%`;
    const prompt = `You are a quantitative trading strategy comparison tool. Compare these two strategies objectively.

Strategy A: ${fmt(s1)}

Strategy B: ${fmt(s2)}

Provide a structured comparison covering:
1. Which strategy is more aggressive / conservative
2. Which suits trending vs ranging markets
3. Risk/reward comparison
4. Which has better risk management (stop loss / take profit)
5. Overall recommendation for different trader profiles

Keep it under 250 words. Be objective, not promotional.`;

    try {
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 500 });
      const result = await new Promise<any>((resolve, reject) => {
        const req = require('https').request(
          { hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } },
          (res: any) => { let data = ''; res.on('data', (c: string) => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); }
        );
        req.on('error', reject); req.write(body); req.end();
      });
      const content = result.choices?.[0]?.message?.content || '';
      return { success: true, comparison: content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Strategy Optimizer (LLM-powered) ─────────────────────────────────
  ipcMain.handle('strategy:optimize', async (_e, raw: unknown) => {
    const vErr = validate(StrategyOptimizeSchema, raw);
    if (vErr) return vErr;
    const { strategyDSL, backtestResult } = raw as {
      strategyDSL: { name: string; symbol?: string; type: string; params: Record<string, unknown>; stopLoss?: number; takeProfit?: number };
      backtestResult: { totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number; tradeCount?: number; equityCurve?: number[] };
    };
    const apiKey = getDeepSeekKey_(app);
    if (!apiKey) return { success: false, error: 'DeepSeek API key not configured. Use Settings to set your key.' };


    const { totalReturn, sharpeRatio, maxDrawdown, winRate, tradeCount } = backtestResult;
    const metricSummary = `Total Return: ${totalReturn}%; Sharpe: ${sharpeRatio}; Max Drawdown: ${maxDrawdown}%; Win Rate: ${winRate}%${tradeCount !== undefined ? `; Trades: ${tradeCount}` : ''}`;
    const prompt = `You are a quantitative trading strategy optimization assistant. Based on the backtest results below, generate 3 concise parameter optimization suggestions to improve this strategy.

Current Strategy:
- Name: ${strategyDSL.name}
- Type: ${strategyDSL.type}
- Symbol: ${strategyDSL.symbol || 'Unknown'}
- Current Params: ${JSON.stringify(strategyDSL.params || {})}
- Stop Loss: ${strategyDSL.stopLoss ?? 'Not set'}%
- Take Profit: ${strategyDSL.takeProfit ?? 'Not set'}%

Backtest Results:
${metricSummary}


Provide exactly 3 suggestions. For each, explain:
1. Which parameter to change and why
2. The expected improvement
3. A concise rationale (1 sentence)

Respond ONLY with valid JSON in this exact format (no markdown, no explanation outside JSON):
{
  "suggestions": [
    {
      "param": "param_name",
      "currentValue": "current value or range",
      "suggestedValue": "suggested value or range",
      "reason": "why this improves the strategy"
    }
  ]
}`;


    try {
      const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 600 });
      const result = await new Promise<any>((resolve, reject) => {
        const req = require('https').request(
          { hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` } },
          (res: any) => { let data = ''; res.on('data', (c: string) => data += c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } }); }
        );
        req.on('error', reject); req.write(body); req.end();
      });
      const rawContent = result.choices?.[0]?.message?.content || '';
      let suggestions = [];
      try { suggestions = JSON.parse(rawContent).suggestions || []; } catch { suggestions = []; }
      return { success: true, suggestions };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Strategy Correlation Matrix ───────────────────────────────────────
  ipcMain.handle('strategy:correlation', async (_e, raw: unknown) => {
    const vErr = validate(StrategyCorrelationSchema, raw);
    if (vErr) return vErr;
    const { strategies } = raw as {
      strategies: { id: string; equityCurve: { time: number; value: number }[] }[];
    };
    if (strategies.length < 1) {
      return { success: false, error: 'At least 1 strategy required' };
    }
    const result = computeCorrelationMatrix(strategies);
    return { success: true, ...result };
  });

  // ── Smart Notification Engine ───────────────────────────────────────
  ipcMain.handle('notification:generate', async (_e, raw: unknown) => {
    const vErr = validate(NotificationGenerateSchema, raw);
    if (vErr) return vErr;
    const ctx = raw as NotificationContext;
    const alerts = generateSmartAlerts(ctx);
    return { success: true, alerts };
  });

  ipcMain.handle('notification:summary', async (_e, alerts: SmartAlert[], apiKey?: string) => {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return { success: true, summary: '暂无活跃警报。' };
    }
    const summary = await generateAlertSummary(alerts, apiKey ?? '');
    return { success: true, summary };
  });

  // ── AI Report Generator ──────────────────────────────────────────────
  ipcMain.handle('report:generate', async (_e, raw: unknown) => {
    const vErr = validate(ReportGenerateSchema, raw);
    if (vErr) return vErr;
    const { results, symbol, apiKey, timeoutMs } = raw as {
      results: any[];
      symbol?: string;
      apiKey?: string;
      timeoutMs?: number;
    };
    const report = await generateBacktestReport(results, symbol, apiKey, timeoutMs ?? 20000);
    return { success: true, report };
  });

  ipcMain.handle('report:quick', async (_e, raw: unknown) => {
    const vErr = validate(ReportQuickSchema, raw);
    if (vErr) return vErr;
    const { result, apiKey } = raw as { result: any; apiKey?: string };
    const report = await generateQuickReport(result, apiKey);
    return { success: true, report };
  });

  // ── Auto-Tuner ──────────────────────────────────────────────────────
  ipcMain.handle('strategy:auto-tune', async (_e, raw: unknown) => {
    const vErr = validate(StrategyAutoTuneSchema, raw);
    if (vErr) return vErr;
    const { strategyType, ranges, klines, method, populationSize, generations, iterations } = raw as {
      strategyType: string;
      ranges: ParamRange[];
      klines: any[];
      method?: 'ga' | 'bayesian' | 'both';
      populationSize?: number;
      generations?: number;
      iterations?: number;
    };
    log.info(`[IPC] strategy:auto-tune — type=${strategyType} method=${method ?? 'both'}`);
    const result = await autoTune(strategyType, ranges, klines, { method, populationSize, generations, iterations });
    return { success: true, result };
  });

  // ── Q8: Market Regime Detector ─────────────────────────────────────────
  ipcMain.handle('regime:detect', async (_e, raw: unknown) => {
    try {
      const { klines, vixLevel, symbol } = raw as {
        klines: { close: number[]; high: number[]; low: number[]; open: number[] };
        vixLevel?: number;
        symbol?: string;
      };
      if (!klines || !klines.close || klines.close.length < 30) {
        return { success: false, error: 'At least 30 klines required for regime detection' };
      }
      const result = detectRegime(klines, { vixLevel });
      return { success: true, regime: result, symbol };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q9: Strategy Risk Decomposition ──────────────────────────────────
  ipcMain.handle('risk:decompose', async (_e, raw: unknown) => {
    try {
      const { equityCurve, positions, confidenceLevel } = raw as {
        equityCurve: number[];
        positions?: any[];
        confidenceLevel?: number;
      };
      if (!equityCurve || equityCurve.length < 20) {
        return { success: false, error: 'At least 20 equity curve data points required' };
      }
      const result = decomposeRisk(equityCurve, positions, confidenceLevel ?? 0.95);
      return { success: true, decomposition: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('risk:monteCarlo', async (_e, raw: unknown) => {
    try {
      const { equityCurve, paths, horizon } = raw as {
        equityCurve: number[];
        paths?: number;
        horizon?: number;
      };
      if (!equityCurve || equityCurve.length < 20) {
        return { success: false, error: 'At least 20 data points required' };
      }
      const result = runMonteCarlo(equityCurve, paths ?? 10000, horizon ?? 252);
      return { success: true, simulation: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q10: Real-time Anomaly Detection ─────────────────────────────────
  ipcMain.handle('anomaly:detect', async (_e, raw: unknown) => {
    try {
      const { values, method, window, threshold } = raw as {
        values: number[];
        method?: 'zscore' | 'iqr' | 'moving';
        window?: number;
        threshold?: number;
      };
      if (!values || values.length < 10) {
        return { success: false, error: 'At least 10 data points required' };
      }
      const result = detectAnomalies({ values, method: method ?? 'zscore', window: window ?? 20, threshold: threshold ?? 3 });
      return { success: true, anomalies: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q11: Correlation Visualizer ────────────────────────────────────
  ipcMain.handle('strategy:correlation-viz', async (_e, raw: unknown) => {
    try {
      const { buildCorrelationVisualization } = require('./engine/correlation-visualizer');
      const { inputs } = raw as { inputs: Array<{ id: string; equityCurve: Array<{ time: number; value: number }> }> };
      if (!inputs || inputs.length < 2) {
        return { success: false, error: 'At least 2 strategies required for correlation visualization' };
      }
      const result = buildCorrelationVisualization(inputs);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q17: Paper Trader ─────────────────────────────────────────
  ipcMain.handle('paper:start', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const pt = getPaperTrader('default');
      return { success: true, status: pt.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('paper:stop', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const pt = getPaperTrader('default');
      pt.stopAll();
      return { success: true, report: pt.getReport() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('paper:reset', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      getPaperTrader('default').reset();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('paper:report', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const pt = getPaperTrader('default');
      const report = pt.getReport();
      return { success: true, ...report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('paper:execute-signal', async (_e, raw: unknown) => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      const signal = raw as any;
      const pt = getPaperTrader('default');
      const trade = pt.executeSignal(signal, signal.name);
      return { success: !!trade, trade };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('paper:status', async () => {
    try {
      const { getPaperTrader } = require('./engine/paper-trader');
      return { success: true, status: getPaperTrader('default').getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q19: OpenD Health Check ─────────────────────────────────
  ipcMain.handle('system:opend-health', async (_e, raw: unknown) => {
    try {
      const { runOpenDHealthCheck, pingOpenD } = require('./engine/opend-health-check');
      const req = raw as { action?: string; host?: string; port?: number };
      if (req?.action === 'ping') {
        const result = await pingOpenD(req.host ?? '127.0.0.1', req.port ?? 11111);
        return { success: true, ...result };
      }
      const result = await runOpenDHealthCheck(req as any);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q18: Strategy Templates ─────────────────────────────────
  ipcMain.handle('strategy:templates', async (_e, raw: unknown) => {
    try {
      const { getAllTemplates, getTemplate, getTemplatesByCategory, searchTemplates, instantiateTemplate } =
        require('./engine/strategy-templates');
      const req = raw as { action?: string; id?: string; category?: string; query?: string; overrides?: any };
      const action = req?.action ?? 'list';
      if (action === 'list') return { success: true, templates: getAllTemplates() };
      if (action === 'get') {
        if (!req.id) return { success: false, error: 'id required' };
        const t = getTemplate(req.id);
        return { success: !!t, template: t };
      }
      if (action === 'category') {
        if (!req.category) return { success: false, error: 'category required' };
        return { success: true, templates: getTemplatesByCategory(req.category) };
      }
      if (action === 'search') {
        if (!req.query) return { success: false, error: 'query required' };
        return { success: true, templates: searchTemplates(req.query) };
      }
      if (action === 'instantiate') {
        if (!req.id) return { success: false, error: 'id required' };
        const { strategy, error } = instantiateTemplate(req.id, req.overrides ?? {});
        return { success: !error, strategy, error };
      }
      return { success: false, error: 'Unknown action' };
  // ── Q17: Paper Trader ──────────────────────

  ipcMain.handle('paper:start', async (_e, symbols?: string[]) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      pt.start(symbols);

      return { success: true, status: pt.getAccount() };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('paper:stop', async () => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      getPaperTrader('default').stop();

      return { success: true };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('paper:reset', async () => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      getPaperTrader('default').reset();

      return { success: true };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('paper:report', async (_e, strategyId?: string) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      const report = pt.getReport(strategyId);

      return { success: true, ...report };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('paper:submit-order', async (_e, raw: unknown) => {

    try {

      const { getPaperTrader } = require('./engine/paper-trader');

      const pt = getPaperTrader('default');

      const order = raw as any;

      const orderId = pt.submitOrder(order);

      return { success: true, orderId };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q16: Dynamic Position Sizer ────────────────────────────────
  ipcMain.handle('risk:position-size', async (_e, raw: unknown) => {
    try {
      const { calcPositionSize, calcQuickSize, calcPortfolioSizes } = require('./engine/dynamic-sizer');
      const req = raw as any;
      if (req.strategies != null) {
        // Portfolio mode
        const result = await calcPortfolioSizes(req);
        return { success: true, ...result };
      }
      if (req.equity == null || req.winRate == null || req.avgWin == null || req.avgLoss == null) {
        return { success: false, error: 'equity, winRate, avgWin, avgLoss required' };
  // ── Q16: Dynamic Position Sizer ──────────────────────

  ipcMain.handle('risk:calculate-size', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as any;

      const result = await sizer.calculateSize(req);

      return { success: true, ...result };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('risk:calculate-portfolio-sizes', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as any;

      const result = await sizer.calculatePortfolioSizes(req);

      return { success: true, ...result };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('risk:record-trade', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const trade = raw as any;

      sizer.recordTrade(trade);

      return { success: true };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



  ipcMain.handle('risk:get-trade-history', async (_e, strategyId?: string) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const history = sizer.getTradeHistory(strategyId);

      const winRate = sizer.getWinRate(strategyId);

      return { success: true, history, winRate };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



      }
      if (req.quick != null) {
        return { success: true, ...calcQuickSize(req) };
      }
      const result = await calcPositionSize(req);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q15: Multi-Factor Model ─────────────────────────────────────
  ipcMain.handle('strategy:multi-factor', async (_e, raw: unknown) => {
    try {
      const { scoreStocks, scoreTopAStocks } = require('./engine/multi-factor');
      const req = raw as { stocks?: Array<{ code: string; name: string }>; preset?: string; limit?: number };
      if (req.limit != null) {
        // Top-A mode
        const result = await scoreTopAStocks(req.limit, req.preset as any);
        return { success: true, ...result };
      }
      if (!req.stocks || req.stocks.length === 0) {
        return { success: false, error: 'stocks array is required' };
      }
      const result = await scoreStocks(req as any);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q12: Stress Tester ────────────────────────────────────────────
  ipcMain.handle('risk:stress-test', async (_e, raw: unknown) => {
    try {
      const { runStressTest, runCustomShock, HISTORICAL_SCENARIOS } = require('./engine/stress-tester');
      const { positions, scenarioName, customFactors, portfolio } = raw as {
        positions: any[];
        scenarioName?: string;
        customFactors?: any[];
        portfolio?: { totalValue: number; dailyVol: number };
      };
      if (!positions || positions.length === 0) {
        return { success: false, error: 'At least one position required' };
      }
      let result;
      if (customFactors) {
        result = runCustomShock(positions, customFactors, portfolio ?? { totalValue: 0, dailyVol: 0.02 });
      } else {
        const scenario = HISTORICAL_SCENARIOS.find((s: any) => s.name === scenarioName);
        if (!scenario) {
          return { success: false, error: 'Scenario not found: ' + scenarioName + '. Available: ' + HISTORICAL_SCENARIOS.map((s: any) => s.name).join(', ') };
        }
        result = runStressTest(positions, scenario);
      }
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q13: Backtest Comparator ──────────────────────────────────────
  ipcMain.handle('strategy:compare', async (_e, raw: unknown) => {
    try {
      const { compareBacktests, summaryTable } = require('./engine/backtest-comparator');
      const { results } = raw as { results: any[] };
      if (!results || results.length === 0) {
        return { success: false, error: 'At least one backtest result required' };
      }
      const comparison = compareBacktests(results);
      const table = summaryTable(results, comparison);
      return { success: true, comparison, table };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── NL Parser ───────────────────────────────────────────────────────
  ipcMain.handle('nl:parse', async (_e, text: string) => {
    return parseNaturalLanguage(text);
  });

  ipcMain.handle('nl:templates', async () => {
    return { success: true, templates: STRATEGY_TEMPLATES };
  });

  // ── Risk Engine ─────────────────────────────────────────────────────
  ipcMain.handle('risk:getConfig', async () => {
    return { success: true, config: riskEngine?.getConfig() };
  });

  ipcMain.handle('risk:updateConfig', async (_e, config: any) => {
    riskEngine?.updateConfig(config);
    return { success: true };
  });

  ipcMain.handle('risk:getAlerts', async () => {
    return { success: true, alerts: riskEngine?.getAlerts() || [] };
  });

  // v2: Risk engine status snapshot (for risk dashboard UI)
  ipcMain.handle('risk:getStatusSnapshot', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, snapshot: riskEngine.getStatusSnapshot() };
  });

  ipcMain.handle('risk:getKellyStats', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, kelly: riskEngine.getKellyStats() };
  });

  ipcMain.handle('risk:getDrawdownState', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, drawdown: riskEngine.getDrawdownState() };
  });

  ipcMain.handle('risk:updateVix', async (_e, vix: number) => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    riskEngine.updateVix(vix);
    return { success: true };
  });

  // ── Database ────────────────────────────────────────────────────────
  ipcMain.handle('db:getStrategies', async () => {
    return db?.getStrategies() || [];
  });

  ipcMain.handle('db:saveStrategy', async (_e, strategy: any) => {
    db?.saveStrategy(strategy);
    return { success: true };
  });

  ipcMain.handle('db:getSettings', async () => {
    return db?.getSettings() || {};
  });

  ipcMain.handle('db:saveSettings', async (_e, settings: any) => {
    db?.saveSettings(settings);
    return { success: true };
  });

  ipcMain.handle('db:getTrades', async (_e, strategyId?: string) => {
    return db?.getTrades(strategyId) || [];
  });

  ipcMain.handle('db:getBacktestResults', async (_e, strategyId: string) => {
    return db?.getBacktestResults(strategyId) || [];
  });

  ipcMain.handle('db:getWatchlist', async () => {
    return db?.getWatchlist() || [];
  });

  ipcMain.handle('db:saveWatchlist', async (_e, codes: string[]) => {
    db?.saveWatchlist(codes);
    return { success: true };
  });

  ipcMain.handle('db:getSignals', async (_e, strategyId?: string) => {
    return db?.getSignals(strategyId) || [];
  });

  // ── App ─────────────────────────────────────────────────────────────
  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    name: 'DAWN WHALES',
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
  }));

  ipcMain.handle('app:getMemoryUsage', () => ({
    mainProcess: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    total: Math.round(process.memoryUsage().rss / 1024 / 1024),
  }));

  ipcMain.handle('app:exportPdf', async (_e, filename: string) => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: 'Window not available' };
      }
      const { dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');

      const defaultPath = path.join(require('os').homedir(), 'Downloads', filename);
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { success: false, error: 'User cancelled' };

      const data = await mainWindow.webContents.printToPDF({
        marginsType: 1,
        pageSize: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      fs.writeFileSync(filePath, data);
      return { success: true, path: filePath };
    } catch (err: any) {
      log.error('[App] PDF export failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:emergencyStop', async () => {
    try {
      log.warn('[App] Emergency stop triggered');
      // Stop all live strategies
      const strategies = strategyEngine?.getAllStrategies() || [];
      for (const s of strategies) {
        if (s.liveRunning) {
          strategyEngine?.stopLive(s.id);
        }
      }
      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('notification', {
          type: 'error',
          title: '紧急停止',
          message: '所有策略已停止',
        });
      }
      return { success: true };
    } catch (err: any) {
      log.error('[App] Emergency stop failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── External URL Security ────────────────────────────────────────────
  const ALLOWED_PROTOCOLS = ['http:', 'https:'];
  ipcMain.handle('app:openExternal', async (_e, rawUrl: string) => {
    const vErr = validate(Z.object({ rawUrl: z.string().url() }), { rawUrl });
    if (vErr) return vErr;
    try {
      const url = new URL(rawUrl);
      if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        log.warn('[Security] Blocked openExternal:', rawUrl);
        return { success: false, error: 'Protocol not allowed' };
      }
      await shell.openExternal(rawUrl);
      return { success: true };
    } catch {
      return { success: false, error: 'Invalid URL' };
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);

  // ── Auto-updater ──────────────────────────────────────────────────
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version || null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:downloadUpdate', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:installUpdate', () => {
    autoUpdater.quitAndInstall();
  });

  // ── Greeks Calculation (P0-fixed: pure JS Black-Scholes, no Python subprocess) ─
  ipcMain.handle('greeks:calculate', async (_e, params: {
    spot: number; strike: number; vol: number; days: number;
    rate?: number; type: 'CALL' | 'PUT'; qty?: number;
  }) => {
    try {
      const greeks = calcGreeksJS(params.spot, params.strike, params.vol, params.days, params.rate || 0.05, params.type);
      return { success: true, greeks };
    } catch (err: any) {
      log.error('[Greeks] Calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('greeks:portfolio', async (_e, positions: any[]) => {
    const vErr = validate(GreeksPortfolioSchema, { positions });
    if (vErr) return vErr;
    try {
      const portfolio = positions.map((p: any) => {
        const g = calcGreeksJS(p.spot, p.strike, p.iv, p.dte, p.rate || 0.05, p.type);
        const mult = p.qty || 1;
        return {
          ...g,
          symbol: p.symbol,
          type: p.type,
          strike: p.strike,
          qty: mult,
          totalDelta: (g.delta * mult * 100).toFixed(2),
          totalGamma: (g.gamma * mult * 100).toFixed(4),
          totalTheta: (g.theta * mult).toFixed(2),
          totalVega: (g.vega * mult * 0.01).toFixed(2),
        };
      });
      const totals = {
        netDelta: portfolio.reduce((s: number, p: any) => s + parseFloat(p.totalDelta), 0).toFixed(2),
        netGamma: portfolio.reduce((s: number, p: any) => s + parseFloat(p.totalGamma), 0).toFixed(4),
        netTheta: portfolio.reduce((s: number, p: any) => s + parseFloat(p.totalTheta), 0).toFixed(2),
      };
      return { success: true, portfolio: { positions: portfolio, totals } };
    } catch (err: any) {
      log.error('[Greeks] Portfolio calc failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Marketplace ───────────────────────────────────────────────────

  ipcMain.handle('marketplace:rate', async (_e, strategyId: string, rating: number) => {
    const vErr = validate(MarketplaceRateSchema, { strategyId });
    if (vErr) return vErr;
    try {
      db?.rateStrategy(strategyId, rating);
      const stats = db?.getStrategyRating(strategyId);
      return { success: true, ...stats };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:getRating', async (_e, strategyId: string) => {
    const rating = db?.getStrategyRating(strategyId);
    const myRating = db?.getMyRating(strategyId);
    return { success: true, ...rating, myRating };
  });

  ipcMain.handle('marketplace:comment', async (_e, strategyId: string, content: string, parentId?: number) => {
    const vErr = validate(MarketplaceCommentSchema, { strategyId });
    if (vErr) return vErr;
    try {
      db?.addComment(strategyId, content, parentId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:getComments', async (_e, strategyId: string) => {
    const comments = db?.getComments(strategyId) || [];
    return { success: true, comments };
  });

  ipcMain.handle('marketplace:savePerformance', async (_e, data: any) => {
    const vErr = validate(MarketplaceSavePerformanceSchema, { data });
    if (vErr) return vErr;
    try {
      db?.saveStrategyPerformance(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:getPerformance', async (_e, strategyId: string) => {
    const perf = db?.getStrategyPerformance(strategyId) || [];
    return { success: true, performance: perf };
  });

  ipcMain.handle('marketplace:list', async (_e, sortBy?: string, limit?: number) => {
    const strategies = db?.getMarketplaceStrategies(sortBy || 'rating', limit || 50) || [];
    return { success: true, strategies };
  });

  // ── Correlation Matrix (Q2: QClaw) ──────────────────────────────────
  ipcMain.handle('strategy:correlation', async (_e, inputs: Array<{ id: string; equityCurve: Array<{ time: number; value: number }> }>) => {
    try {
      const { computeCorrelationMatrix } = require('./engine/correlation-matrix');
      const result = computeCorrelationMatrix(inputs);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Marketplace: Score & Verify (JVS) ─────────────────────────────────
  ipcMain.handle('marketplace:score', async (_e, strategyId: string) => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const score = marketplaceService.calculateStrategyScore(strategyId);
      return { success: true, score };
    } catch (err: any) {
      log.error('[Marketplace] Score calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:verify', async (_e, strategyId: string) => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const verification = marketplaceService.verifyPerformance(strategyId);
      return { success: true, verification };
    } catch (err: any) {
      log.error('[Marketplace] Verification failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('marketplace:updateAllScores', async () => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const result = marketplaceService.updateAllScores();
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[Marketplace] Batch update failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Data Provider (multi-source integration) ───────────────────────────
  ipcMain.handle('data:fundamental', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const data = await dataProvider.getFundamental(symbol);
      return { success: true, data };
    } catch (err: any) {
      log.error('[DataProvider] Fundamental fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:capital-flow', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const data = await dataProvider.getCapitalFlow(symbol);
      return { success: true, data };
    } catch (err: any) {
      log.error('[DataProvider] Capital flow fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:regime', async () => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = await dataProvider.getMarketRegime();
      return { success: true, regime };
    } catch (err: any) {
      log.error('[DataProvider] Regime fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:anomalies', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const signals = await dataProvider.getAnomalies(symbol);
      return { success: true, signals };
    } catch (err: any) {
      log.error('[DataProvider] Anomalies fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:news', async (_e, symbol: string, limit?: number) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const items = await dataProvider.getNews(symbol, limit);
      return { success: true, items };
    } catch (err: any) {
      log.error('[DataProvider] News fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:composite-score', async (_e, symbol: string) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const result = await dataProvider.getCompositeScore(symbol);
      return { success: true, result };
    } catch (err: any) {
      log.error('[DataProvider] Composite score failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-fundamental', async (_e, data: any) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveFundamental(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-capital-flow', async (_e, data: any) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveCapitalFlow(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-regime', async (_e, regime: any) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveMarketRegime(regime);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:compute-regime', async (_e, factors: any) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      const regime = dataProvider.computeRegime(factors);
      return { success: true, regime };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-anomaly', async (_e, signal: any) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveAnomaly(signal);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:save-news', async (_e, symbol: string, items: any[]) => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.saveNews(symbol, items);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:clear-cache', async () => {
    if (!dataProvider) return { success: false, error: 'DataProvider not initialized' };
    try {
      dataProvider.clearExpiredCache();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── EM Data Provider — Sector Heatmap (JVS-1) ─────────────────────────
  ipcMain.handle('em:get-heatmap', async (_e, boardType?: string, limit?: number) => {
    if (!emDataProvider) return { success: false, error: 'EMDataProvider not initialized' };
    try {
      const bt = (boardType === 'concept' || boardType === 'region') ? boardType : 'industry';
      const result = await emDataProvider.getHeatmap(bt, limit || 50);
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[EMDataProvider] Heatmap fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-all-heatmaps', async () => {
    if (!emDataProvider) return { success: false, error: 'EMDataProvider not initialized' };
    try {
      const maps = await emDataProvider.getAllHeatmaps();
      return { success: true, ...maps };
    } catch (err: any) {
      log.error('[EMDataProvider] All heatmaps fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Macro Data Provider — Dashboard (JVS-2) ───────────────────────────
  ipcMain.handle('em:get-macro', async (_e, indicator?: string, limit?: number) => {
    if (!macroDataProvider) return { success: false, error: 'MacroDataProvider not initialized' };
    try {
      const type = (indicator || 'GDP') as any;
      const result = await macroDataProvider.getIndicator(type, limit || 24);
      return { success: true, data: result };
    } catch (err: any) {
      log.error('[MacroDataProvider] Fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-macro-dashboard', async (_e, indicators?: string[]) => {
    if (!macroDataProvider) return { success: false, error: 'MacroDataProvider not initialized' };
    try {
      const result = await macroDataProvider.getDashboard(indicators as any);
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[MacroDataProvider] Dashboard fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Index Engine (JVS-3) ──────────────────────────────────────
  ipcMain.handle('em:get-sentiment', async (_e, input?: any) => {
    try {
      const engine = new SentimentIndexEngine();
      const sentimentInput = input || {};
      const result = engine.compute(sentimentInput);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SentimentIndex] Compute failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Stock Screener (JVS-4) ─────────────────────────────────────────────
  ipcMain.handle('screener:search', async (_e, request: any) => {
    if (!stockScreener) return { success: false, error: 'StockScreener not initialized' };
    try {
      const result = await stockScreener.search(request || { query: '' });
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[StockScreener] Search failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── News Aggregator (JVS-5) ────────────────────────────────────────────
  ipcMain.handle('em:get-news-aggregate', async (_e, request: any) => {
    if (!newsAggregator) return { success: false, error: 'NewsAggregator not initialized' };
    try {
      const result = await newsAggregator.search(request || { query: '' });
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[NewsAggregator] Search failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-market-mood', async (_e, symbols?: string[]) => {
    if (!newsAggregator) return { success: false, error: 'NewsAggregator not initialized' };
    try {
      const report = await newsAggregator.getMarketMood(symbols);
      return { success: true, report };
    } catch (err: any) {
      log.error('[NewsAggregator] Market mood failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Sector Rotation Monitor (JVS-6) ──────────────────────────────────
  ipcMain.handle('em:get-sector-rotation', async () => {
    if (!sectorRotation) return { success: false, error: 'SectorRotation not initialized' };
    try {
      const report = sectorRotation.analyze();
      return { success: true, ...report };
    } catch (err: any) {
      log.error('[SectorRotation] Analyze failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:record-sector-snapshot', async (_e, sectors: any[]) => {
    if (!sectorRotation) return { success: false, error: 'SectorRotation not initialized' };
    try {
      sectorRotation.recordSnapshot(sectors || []);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Stock Anomaly Detector (JVS-7) ────────────────────────────────────
  ipcMain.handle('em:get-anomaly-summary', async () => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const summary = stockAnomalyDetector.getSummary();
      return { success: true, summary };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-anomaly-alerts', async (_e, options?: any) => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const alerts = stockAnomalyDetector.getAlerts(options);
      return { success: true, alerts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:process-anomaly-quotes', async (_e, quotes: any[]) => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const newAlerts = stockAnomalyDetector.processQuotes(quotes || []);
      return { success: true, newAlerts: newAlerts.length };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:acknowledge-anomaly', async (_e, id: string) => {
    if (!stockAnomalyDetector) return { success: false, error: 'AnomalyDetector not initialized' };
    try {
      const result = stockAnomalyDetector.acknowledgeAlert(id);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Market Hotspot (JVS-8) ─────────────────────────────────────────────
  ipcMain.handle('em:get-hotspot', async (_e, query?: any) => {
    if (!marketHotspot) return { success: false, error: 'MarketHotspot not initialized' };
    try {
      const report = await marketHotspot.getReport(query);
      return { success: true, ...report };
    } catch (err: any) {
      log.error('[MarketHotspot] Fetch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Data Scheduler (auto-refresh) ─────────────────────────────────────
  ipcMain.handle('data:scheduler-status', async () => {
    if (!dataScheduler) return { success: false, error: 'DataScheduler not initialized' };
    return { success: true, status: dataScheduler.getStatus() };
  });

  ipcMain.handle('data:scheduler-refresh', async (_e, module?: string) => {
    if (!dataScheduler) return { success: false, error: 'DataScheduler not initialized' };
    try {
      if (module) {
        await dataScheduler.refreshNow(module);
      } else {
        await dataScheduler.refreshAll();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Quote Stream — Real-time Market Data (JVS-9) ─────────────────────
  ipcMain.handle('quote:stream-start', async (_e, symbols?: string[]) => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    try {
      if (symbols && symbols.length > 0) stream.subscribe(symbols);
      stream.start();
      return { success: true, status: stream.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quote:stream-stop', async () => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    stream.stop();
    return { success: true };
  });

  ipcMain.handle('quote:stream-status', async () => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    return { success: true, status: stream.getStatus() };
  });

  ipcMain.handle('quote:subscribe', async (_e, symbols: string[]) => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    stream.subscribe(symbols);
    return { success: true, status: stream.getStatus() };
  });

  ipcMain.handle('quote:unsubscribe', async (_e, symbols: string[]) => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    stream.unsubscribe(symbols);
    return { success: true, status: stream.getStatus() };
  });

  // ── Dragon Tiger List — 龙虎榜 (JVS-10) ─────────────────────────────
  ipcMain.handle('em:get-dragon-tiger', async (_e, date?: string) => {
    try {
      const result = await getDragonTigerList(date);
      return result;
    } catch (err: any) {
      return { success: false, entries: [], total: 0, date: '', error: err.message };
    }
  });

  ipcMain.handle('em:get-dragon-tiger-detail', async (_e, code: string, date: string) => {
    try {
      const detail = await getDragonTigerDetail(code, date);
      return { success: !!detail, detail };
    } catch (err: any) {
      return { success: false, detail: null, error: err.message };
    }
  });

  ipcMain.handle('em:get-institutional-trades', async (_e, date?: string) => {
    try {
      const entries = await getInstitutionalTrades(date);
      return { success: true, entries };
    } catch (err: any) {
      return { success: false, entries: [], error: err.message };
    }
  });

  // ── Capital Flow Ranking — 资金流排行 (JVS-11) ──────────────────────
  ipcMain.handle('em:get-capital-flow-stock', async (_e, sortBy?: string, order?: string, limit?: number) => {
    try {
      const result = await getStockCapitalFlowRank(sortBy as any, order as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, type: 'stock', error: err.message };
    }
  });

  ipcMain.handle('em:get-capital-flow-sector', async (_e, sortBy?: string, order?: string, limit?: number) => {
    try {
      const result = await getSectorCapitalFlowRank(sortBy as any, order as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, type: 'sector', error: err.message };
    }
  });

  ipcMain.handle('em:get-capital-flow-concept', async (_e, sortBy?: string, order?: string, limit?: number) => {
    try {
      const result = await getConceptCapitalFlowRank(sortBy as any, order as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, type: 'concept', error: err.message };
    }
  });

  // ── Capital Flow Monitor — Real-time alerts (JVS-12) ─────────────────
  ipcMain.handle('em:get-capital-flow-alerts', async (_e, items?: any[]) => {
    try {
      const monitor = getCapitalFlowMonitor();
      const alerts = items ? monitor.process(items) : [];
      return { success: true, alerts, config: monitor.getConfig() };
    } catch (err: any) {
      return { success: false, alerts: [], error: err.message };
    }
  });

  ipcMain.handle('em:set-capital-flow-config', async (_e, config: any) => {
    try {
      const monitor = getCapitalFlowMonitor();
      monitor.updateConfig(config);
      return { success: true, config: monitor.getConfig() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:clear-capital-flow-history', async () => {
    try {
      getCapitalFlowMonitor().clearHistory();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Fund Holdings — 基金持仓数据 (JVS-13) ────────────────────────
  ipcMain.handle('em:get-fund-holdings', async (_e, fundCode: string, reportDate?: string) => {
    try {
      const result = await getFundHoldings(fundCode, reportDate);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, error: err.message };
    }
  });

  ipcMain.handle('em:get-stock-fund-ownership', async (_e, stockCode: string, reportDate?: string) => {
    try {
      const result = await getStockFundOwnership(stockCode, reportDate);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, error: err.message };
    }
  });

  ipcMain.handle('em:get-fund-increase-rank', async (_e, limit?: number, reportDate?: string) => {
    try {
      const result = await getFundIncreaseRank(limit, reportDate);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, error: err.message };
    }
  });

  ipcMain.handle('em:get-fund-decrease-rank', async (_e, limit?: number, reportDate?: string) => {
    try {
      const result = await getFundDecreaseRank(limit, reportDate);
      return result;
    } catch (err: any) {
      return { success: false, items: [], total: 0, error: err.message };
    }
  });

  // ── Stock Diagnosis — 个股诊断聚合器 (JVS-14) ──────────────────────
  ipcMain.handle('em:diagnose-stock', async (_e, request: any) => {
    try {
      const result = await diagnoseStock(request || { code: '' });
      return result;
    } catch (err: any) {
      return { success: false, code: '', name: '', timestamp: Date.now(), error: err.message };
    }
  });

  ipcMain.handle('em:batch-diagnose', async (_e, codes: string[], options?: any) => {
    try {
      const results = await batchDiagnose(codes || [], options);
      return { success: true, reports: results };
    } catch (err: any) {
      return { success: false, reports: [], error: err.message };
    }
  });

  // ── Portfolio Risk — 组合风险计算器 (JVS-15) ─────────────────────
  ipcMain.handle('em:portfolio-risk', async (_e, request: any) => {
    try {
      const result = await calculatePortfolioRisk(request || { positions: [] });
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Market Breadth — 市场广度分析器 (JVS-16) ────────────────────
  ipcMain.handle('em:get-market-breadth', async () => {
    try {
      const result = await getMarketBreadth();
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Consumer Data — 消费者数据服务 (JVS-17) ────────────────────
  ipcMain.handle('em:get-consumer-data', async (_e, months?: number) => {
    try {
      const result = await getConsumerDataReport(months || 12);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Margin Data — 融资融券数据服务 (JVS-18) ────────────────────
  ipcMain.handle('em:get-margin-data', async () => {
    try {
      const result = await getMarginDataReport();
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-stock-margin', async (_e, code: string, days?: number) => {
    try {
      const result = await getStockMargin(code, days || 30);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-margin-balance-rank', async (_e, limit?: number) => {
    try {
      const result = await getMarginBalanceRanking(limit || 30);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-short-interest-rank', async (_e, limit?: number) => {
    try {
      const result = await getShortInterestRanking(limit || 30);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── EMI Unified Service Layer (JVS-19) ──────────────────────────────────
  ipcMain.handle('em:get-stock-overview', async (_e, code: string) => {
    if (!code) return { success: false, error: 'Stock code required' };
    try {
      const result = await getStockOverview(code);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-market-overview', async () => {
    try {
      const result = await getMarketOverview();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:get-daily-report', async () => {
    try {
      const result = await getDailyReport();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Python Script Proxy Layer (JVS-20) ──────────────────────────────────
  ipcMain.handle('py:call-skill', async (_e, skillName: string, query: string, options?: any) => {
    try {
      const proxy = getPythonProxy();
      const result = await proxy.callSkill(skillName, query, options);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('py:list-skills', async () => {
    try {
      const proxy = getPythonProxy();
      return { success: true, skills: proxy.listAvailableSkills() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('py:proxy-status', async () => {
    try {
      const proxy = getPythonProxy();
      return { success: true, status: proxy.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Push2 Proxy Service (JVS-27) ─────────────────────────────────────────
  ipcMain.handle('push2:get-sector-heatmap', async (_e, type?: string, limit?: number) => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getSectorHeatmap(type as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:get-capital-flow-rank', async (_e, type?: string, limit?: number) => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getCapitalFlowRank(type as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:get-stock-quote', async (_e, secid: string) => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getStockQuote(secid);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:get-market-breadth', async () => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getMarketBreadth();
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:proxy-status', async () => {
    try {
      const proxy = getPush2Proxy();
      return { success: true, status: proxy.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:clear-cache', async () => {
    try {
      const proxy = getPush2Proxy();
      proxy.clearCache();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Data Quality Monitor (JVS-22) ────────────────────────────────────────
  ipcMain.handle('data:quality-check', async () => {
    try {
      const monitor = getDataQualityMonitor();
      const report = await monitor.runHealthCheck();
      return { success: true, report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-report', async () => {
    try {
      const monitor = getDataQualityMonitor();
      const report = monitor.getLastReport();
      return { success: true, report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-acknowledge', async (_e, alertIndex: number) => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.acknowledgeAlert(alertIndex);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-clear-acknowledged', async () => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.clearAcknowledgedAlerts();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-start-periodic', async (_e, intervalMs?: number) => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.startPeriodicCheck(intervalMs);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-stop-periodic', async () => {
    try {
      const monitor = getDataQualityMonitor();
      monitor.stopPeriodicCheck();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Data Quality Stream Monitor (JVS-31) ─────────────────────────────────
  ipcMain.handle('data:quality-stream-start', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.start();
      
      // Forward alerts to renderer
      monitor.on('alert', (alert) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('data:quality-stream-alert', alert);
        }
      });
      
      // Hook into WebSocket stream
      const wsStream = getWsDataStream();
      wsStream.on('tick', (tick) => {
        monitor.validateTick(tick);
      });
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-stream-stop', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-stream-status', async () => {
    try {
      const monitor = getDataQualityStream();
      const status = monitor.getStatus();
      // Convert Map to object for IPC serialization
      const symbolStats = Object.fromEntries(status.symbolStats);
      return { success: true, status: { ...status, symbolStats } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-stream-clear-alerts', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.clearAlerts();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:quality-stream-reset-metrics', async () => {
    try {
      const monitor = getDataQualityStream();
      monitor.resetMetrics();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Realtime Sentiment Stream (JVS-33) ─────────────────────────────────
  ipcMain.handle('sentiment:stream-start', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.start();
      
      // Forward ticks to renderer
      stream.on('tick', (tick) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sentiment:stream-tick', tick);
        }
      });
      
      // Forward alerts to renderer
      stream.on('alert', (alert) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sentiment:stream-alert', alert);
        }
      });
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-stop', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-status', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      const current = stream.getCurrentSentiment();
      return { success: true, current };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-history', async (_e, limit?: number) => {
    try {
      const stream = getRealtimeSentimentStream();
      const history = stream.getHistory();
      const limited = limit ? history.slice(-limit) : history;
      return { success: true, history: limited };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-alerts', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      const alerts = stream.getAlerts();
      return { success: true, alerts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-clear-alerts', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.clearAlerts();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Data Quality Dashboard Aggregator (JVS-34) ────────────────────────
  ipcMain.handle('data:quality-dashboard', async () => {
    try {
      const dashboard = await getDataQualityDashboard();
      return { success: true, dashboard };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Cache Explorer API (JVS-35) ───────────────────────────────────────
  ipcMain.handle('cache:explore', async () => {
    try {
      const result = exploreCache();
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:entry-detail', async (_e, namespace: string, key: string) => {
    try {
      const detail = getCacheEntryDetail(namespace, key);
      return { success: true, detail };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:keys-paginated', async (_e, namespace: string, limit?: number, offset?: number) => {
    try {
      const result = getCacheKeys(namespace, limit || 100, offset || 0);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Dashboard API (JVS-36) ──────────────────────────────────
  ipcMain.handle('sentiment:dashboard', async () => {
    try {
      const dashboard = getSentimentDashboard();
      return { success: true, dashboard };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Data Export Service (JVS-37) ──────────────────────────────────────
  ipcMain.handle('data:export', async (_e, request: any) => {
    try {
      const result = await exportData(request);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:export-modules', async () => {
    try {
      const modules = getAvailableModules();
      return { success: true, modules };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Rate Limiter (JVS-38) ─────────────────────────────────────────────
  ipcMain.handle('rate-limiter:stats', async (_e, apiName?: string) => {
    try {
      const manager = getRateLimiterManager();
      const stats = manager.getStats(apiName);
      return { success: true, stats };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rate-limiter:reset', async () => {
    try {
      const manager = getRateLimiterManager();
      manager.resetAll();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rate-limiter:apis', async () => {
    try {
      const manager = getRateLimiterManager();
      const apis = manager.getAvailableAPIs();
      return { success: true, apis };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Data Consistency Checker (JVS-39) ─────────────────────────────────
  ipcMain.handle('data:consistency-check', async () => {
    try {
      const report = await runConsistencyCheck();
      return { success: true, report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:consistency-rules', async () => {
    try {
      const rules = getConsistencyRules();
      return { success: true, rules };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Smart Cache Manager (JVS-32) ──────────────────────────────────────
  ipcMain.handle('cache:get', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      const value = cache.get(key);
      return { success: true, value, hit: value !== undefined };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:set', async (_e, namespace: string, key: string, value: any, ttl?: number) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      cache.set(key, value, ttl);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:has', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, exists: cache.has(key) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:delete', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, deleted: cache.delete(key) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:clear', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        manager.clearNamespace(namespace);
      } else {
        manager.clearAll();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        return { success: true, stats: cache.getStats() };
      } else {
        return { success: true, stats: manager.getAllStats() };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:reset-stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        cache.resetStats();
      } else {
        manager.resetAllStats();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cache:keys', async (_e, namespace: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, keys: cache.keys() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Dragon Tiger Stream (JVS-22 PM) ─────────────────────────────────────
  ipcMain.handle('em:dragon-tiger-stream-start', async () => {
    try {
      const stream = getDragonTigerStream();
      stream.start();
      stream.on('update', (event) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dragon-tiger:update', event);
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:dragon-tiger-stream-stop', async () => {
    try {
      getDragonTigerStream().stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:dragon-tiger-stream-fetch', async () => {
    try {
      const result = await getDragonTigerStream().fetchNow();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:dragon-tiger-stream-status', async () => {
    try {
      return { success: true, status: getDragonTigerStream().getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Unlock Calendar (JVS-23 PM) ────────────────────────────────────────
  ipcMain.handle('em:get-unlock-calendar', async (_e, days?: number) => {
    try {
      const result = await getUnlockCalendar(days || 30);
      return result;
    } catch (err: any) {
      return { success: false, events: [], total: 0, error: err.message };
    }
  });

  // ── Dividend Calendar (JVS-24 PM) ──────────────────────────────────────
  ipcMain.handle('em:get-dividend-calendar', async (_e, days?: number) => {
    try {
      const result = await getDividendCalendar(days || 30);
      return result;
    } catch (err: any) {
      return { success: false, events: [], total: 0, error: err.message };
    }
  });

  // ── Earnings Calendar (JVS-25 PM) ──────────────────────────────────────
  ipcMain.handle('em:get-earnings-calendar', async (_e, days?: number) => {
    try {
      const result = await getEarningsCalendar(days || 30);
      return result;
    } catch (err: any) {
      return { success: false, events: [], total: 0, error: err.message };
    }
  });

  // ── Data Exporter (JVS-26 PM) ──────────────────────────────────────────
  ipcMain.handle('em:export-data', async (_e, type: string, format?: string) => {
    try {
      const result = await exportData(type as any, (format as any) || 'json');
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Smart Picker (JVS-25 PM Round 2) ───────────────────────────────────
  ipcMain.handle('em:smart-pick', async (_e, request?: any) => {
    try {
      const picker = getSmartPicker();
      const result = await picker.pick(request || {});
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── WS Data Stream (JVS-29) ────────────────────────────────────────────
  ipcMain.handle('ws:start-stream', async (_e, config?: any) => {
    try {
      const stream = getWsDataStream();
      await stream.start();
      stream.on('tick', (tick) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ws:tick', tick);
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:stop-stream', async () => {
    try {
      getWsDataStream().stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:subscribe', async (_e, codes: string[]) => {
    try {
      getWsDataStream().subscribe(codes || []);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:unsubscribe', async (_e, codes: string[]) => {
    try {
      getWsDataStream().unsubscribe(codes || []);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:stream-status', async () => {
    try {
      return { success: true, status: getWsDataStream().getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── History Backfill (JVS-30) ──────────────────────────────────────────
  ipcMain.handle('em:backfill-start', async (_e, config?: any) => {
    try {
      const backfill = getHistoryBackfill();
      const status = await backfill.start(config);
      return { success: true, status };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:backfill-status', async () => {
    try {
      return { success: true, status: getHistoryBackfill().getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:backfill-data', async (_e, module: string) => {
    try {
      const data = getHistoryBackfill().getBackfillData(module);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('em:backfill-list', async () => {
    try {
      const files = getHistoryBackfill().listBackfillFiles();
      return { success: true, files };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Wire quote stream events to renderer
  if (getQuoteStream()) {
    getQuoteStream()!.on('quote:update', (quotes) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quote:stream-tick', quotes);
      }
    });
    getQuoteStream()!.on('anomaly:detected', (alerts) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quote:stream-anomaly', alerts);
      }
    });
  }

  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────
  ipcMain.handle('backtest:walk-forward', async (_e, config: any) => {
    const vErr = validate(BacktestWalkForwardSchema, { config });
    if (vErr) return vErr;
    try {
      const wfa = new WalkForwardEngine();
      const klines = config.klines || [];
      if (klines.length < 100) {
        return { success: false, error: 'K线数据不足 (需至少100根)' };
      }
      const report = await wfa.run(config, klines);
      return { success: true, report };
    } catch (err: any) {
      log.error('[WFA] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────
  ipcMain.handle('backtest:param-scan', async (_e, config: any) => {
    const vErr = validate(BacktestParamScanSchema, { config });
    if (vErr) return vErr;
    try {
      const scanner = new ParameterScanner();
      const klines = config.klines || [];
      if (klines.length < 50) {
        return { success: false, error: 'K线数据不足 (需至少50根)' };
      }
      const report = await scanner.run({ ...config, klines });
      return { success: true, report };
    } catch (err: any) {
      log.error('[ParamScan] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────
  ipcMain.handle('backtest:multi-timeframe', async (_e, config: any) => {
    const vErr = validate(BacktestMultiTimeframeSchema, { config });
    if (vErr) return vErr;
    try {
      const engine = new BacktestEngine();
      const timeframes = config.timeframes || ['1m', '5m', '15m', '1h', 'daily'];
      const results: Record<string, any> = {};

      for (const tf of timeframes) {
        const klines = config.klinesByTimeframe?.[tf] || [];
        if (klines.length < 50) {
          results[tf] = { success: false, error: 'K线不足' };
          continue;
        }
        const btResult = await engine.run({
          symbol: config.symbol,
          initialCapital: config.initialCapital || 100000,
          commission: config.commission || 0.001,
          slippage: config.slippage || 0.0005,
          strategy: config.strategy,
          klines,
        });
        results[tf] = btResult;
      }

      return { success: true, results, timeframes };
    } catch (err: any) {
      log.error('[MultiTF] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Q14: Live Executor ──────────────────────────────────────────────
  ipcMain.handle('live:start', async (_e, symbols?: string[]) => {
    try {
      if (!liveExecutor) {
        return { success: false, error: 'LiveExecutor not initialized' };
      }
      liveExecutor.start(symbols);
      return { success: true, status: liveExecutor.getStatus() };
    } catch (err: any) {
      log.error('[live:start]', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('live:stop', async () => {
    try {
      liveExecutor?.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('live:add-strategy', async (_e, config: any) => {
    try {
      if (!liveExecutor) return { success: false, error: 'LiveExecutor not initialized' };
      const { strategyId, symbol, signalType, price, quantity, stopLoss, takeProfit } = config;
      if (!strategyId || !symbol) return { success: false, error: 'strategyId and symbol required' };
      liveExecutor.addStrategy({ strategyId, symbol, signalType: signalType || 'BUY', price, quantity, stopLoss, takeProfit });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('live:remove-strategy', async (_e, strategyId: string) => {
    try {
      liveExecutor?.removeStrategy(strategyId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('live:get-status', async () => {
    return { success: true, status: liveExecutor?.getStatus() ?? null };
  });

  ipcMain.handle('live:get-positions', async () => {
    return { success: true, positions: liveExecutor?.getPositions() ?? [] };
  });

  ipcMain.handle('live:get-orders', async () => {
    return { success: true, orders: liveExecutor?.getOrders() ?? [] };
  });
}

// ── System Tray ────────────────────────────────────────────────────────────

function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createFromBuffer(createDiamondIcon(iconSize));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'DAWN WHALES · 道鲸', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { label: '紧急停止所有策略', click: () => strategyEngine?.emergencyStop() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  tray.setToolTip('DAWN WHALES · 道鲸');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

// ── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info('[App] DAWN WHALES starting...');

  // Initialize modules
  try {
    db = new DatabaseManager();
    db.initialize();
  } catch (err: any) {
    log.error('[App] Database init failed:', err.message);
  }

  try {
    strategyEngine = new StrategyEngine();
    backtestEngine = new BacktestEngine();
    riskEngine = new RiskEngine();
    // v2: Connect risk engine to strategy engine
    if (strategyEngine && riskEngine) {
      strategyEngine.setRiskEngine(riskEngine);
      log.info('[App] StrategyEngine ↔ RiskEngine connected');
    }
    // Q14: Initialize live executor
    liveExecutor = initLiveExecutor(strategyEngine!);
    if (riskEngine) liveExecutor.setRiskEngine(riskEngine);
    log.info('[App] LiveExecutor initialized');
    brokerManager = new BrokerManager();

    // Q15: Initialize multi-factor model
    const { initMultiFactor } = require('./engine/multi-factor');
    const multiFactor = initMultiFactor();
    log.info('[App] MultiFactorModel initialized');

    // Q16: Initialize dynamic sizer
    const { initDynamicSizer } = require('./engine/dynamic-sizer');
    const dynamicSizer = initDynamicSizer();
    log.info('[App] DynamicSizer initialized');


    // Q17: Initialize paper trader
    const { initPaperTrader } = require('./engine/paper-trader');
    const paperTrader = initPaperTrader();
    log.info('[App] PaperTrader initialized');

  } catch (err: any) {
    log.error('[App] Engine init failed:', err.message);
  }

  try {
    if (db) {
      marketplaceService = new MarketplaceService(db);
      log.info('[App] MarketplaceService initialized');

      dataProvider = new DataProviderService();
      dataProvider.initialize(db);
      log.info('[App] DataProviderService initialized');

      emDataProvider = new EMDataProvider();
      emDataProvider.initialize(db);
      log.info('[App] EMDataProvider initialized (JVS-1)');

      macroDataProvider = new MacroDataProvider();
      macroDataProvider.initialize(db);
      log.info('[App] MacroDataProvider initialized (JVS-2)');

      stockScreener = new StockScreenerService();
      log.info('[App] StockScreenerService initialized (JVS-4)');

      newsAggregator = new NewsAggregatorService();
      newsAggregator.initialize(db);
      log.info('[App] NewsAggregatorService initialized (JVS-5)');

      sectorRotation = new SectorRotationMonitor();
      sectorRotation.initialize(db);
      log.info('[App] SectorRotationMonitor initialized (JVS-6)');

      stockAnomalyDetector = new StockAnomalyDetector();
      stockAnomalyDetector.initialize(db);
      log.info('[App] StockAnomalyDetector initialized (JVS-7)');

      marketHotspot = new MarketHotspotService();
      log.info('[App] MarketHotspotService initialized (JVS-8)');

      dataScheduler = new DataSchedulerService();
      // Register refresh callbacks
      dataScheduler.register('heatmap', async () => {
        if (emDataProvider) await emDataProvider.getHeatmap('industry');
      });
      dataScheduler.register('macro', async () => {
        if (macroDataProvider) await macroDataProvider.getDashboard();
      });
      dataScheduler.register('news', async () => {
        if (newsAggregator) await newsAggregator.search({ query: 'A股市场' });
      });
      dataScheduler.register('hotspot', async () => {
        if (marketHotspot) await marketHotspot.getReport();
      });
      dataScheduler.start();
      log.info('[App] DataSchedulerService initialized and started');

      // JVS-9: Real-time quote stream with anomaly detection integration
      const quoteStream = initQuoteStream(
        ['600519', '000858', '601318', '000001', '300750'],  // Default watchlist
        stockAnomalyDetector || undefined
      );
      log.info('[App] QuoteStreamService initialized (JVS-9)');
    }
  } catch (err: any) {
    log.error('[App] MarketplaceService init failed:', err.message);
  }

  setupIPC();
  createWindow();

  // Auto-connect to OpenD (with auto-reconnect) — via BrokerManager
  try {
    const defaultBroker: BrokerConfig = {
      id: 'futu-default',
      name: 'Futu OpenD',
      type: 'futu',
      host: '127.0.0.1',
      port: 11111,
      enabled: true,
    };

    // Load saved broker configs from DB
    const savedConfigs = db?.getBrokerConfigs?.() || [defaultBroker];
    if (brokerManager) {
      brokerManager.loadConfigs(savedConfigs);
      brokerManager.clearCallbacks();
      brokerManager.onQuotePush(quotePushHandler);
      await brokerManager.connect('futu-default');
      const adapter = brokerManager.getActiveBroker();
      adapter?.onDisconnect(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send('notification', { type: 'warning', message: 'OpenD 连接断开，正在重连...' });
      });
      await brokerManager.subscribeAndPush('futu-default', WATCHLIST);
      log.info('[App] BrokerManager auto-connected ✓ Push mode active');
    } else {
      // Legacy fallback
      opendClient = new FutuOpenDClient('127.0.0.1', 11111);
      opendClient.onDisconnect(() => {
        mainWindow?.webContents.send('notification', { type: 'warning', message: 'OpenD 连接断开，正在重连...' });
      });
      await opendClient.connect();
      opendClient.onQuotePush((quotes) => {
        mainWindow?.webContents.send('quotes:push', quotes);
        strategyEngine?.onQuoteUpdate(quotes);
      });
      await opendClient.subscribeAndPush(WATCHLIST);
      log.info('[App] OpenD auto-connected ✓ Push mode active');
    }
  } catch (err: any) {
    log.warn('[App] OpenD auto-connect failed:', err.message);
    opendClient = null;
  }

  // Wire strategy engine callbacks
  if (strategyEngine) {
    strategyEngine.onSignal((event) => {
      mainWindow?.webContents.send('strategy-signal', event);
      db?.saveSignal(event);
      log.info(`[App] Signal: ${event.signal} ${event.symbol} @ ${event.price} — ${event.reason}`);
    });

    strategyEngine.onTrade(async (order) => {
      const riskResult = riskEngine?.checkOrder(order);
      if (riskResult && !riskResult.pass) {
        mainWindow?.webContents.send('risk-alert', { order, reason: riskResult.reason });
        log.warn(`[App] Risk blocked: ${order.code} — ${riskResult.reason}`);
        return;
      }

      const tradeBroker = brokerManager?.getActiveBroker() || opendClient;
      if (tradeBroker?.connected) {
        try {
          const result = await tradeBroker.placeOrder(order);
          db?.saveTrade({ ...order, orderId: result.orderId, status: 'submitted' });
          mainWindow?.webContents.send('order-update', { ...order, orderId: result.orderId, status: 'submitted' });
        } catch (err: any) {
          log.error('[App] Auto-trade failed:', err.message);
          mainWindow?.webContents.send('notification', { type: 'error', message: `交易失败: ${err.message}` });
        }
      }
    });
  }

  createTray();

  // Auto-updater (only in production)
  if (!isDev) {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', (info) => {
      log.info('[Updater] New version available:', info.version);
      mainWindow?.webContents.send('notification', { type: 'info', message: `新版本 ${info.version} 可用，请在设置中更新` });
    });
    autoUpdater.on('update-downloaded', () => {
      log.info('[Updater] Update downloaded, ready to install');
      mainWindow?.webContents.send('notification', { type: 'success', message: '更新已下载，重启即可安装' });
    });
    autoUpdater.on('error', (err) => {
      log.warn('[Updater] Error:', err.message);
    });
    // Check for updates 10s after launch, then every 4 hours
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  }

  log.info('[App] DAWN WHALES ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Minimize to tray on Windows
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  brokerManager?.disconnect();
  opendClient?.disconnect();
  db?.close();
  strategyEngine?.emergencyStop();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function createDiamondIcon(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      const idx = (y * size + x) * 4;
      if (dist < size / 2 - 1) {
        pixels[idx] = 201;
        pixels[idx + 1] = 169;
        pixels[idx + 2] = 110;
        pixels[idx + 3] = 255;
      }
    }
  }
  return pixels;
}
