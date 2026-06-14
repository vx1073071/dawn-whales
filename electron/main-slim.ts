// ── DAWN WHALES — Electron Main Process ────────────────────────────────────
// ： (Electron + C++ core + React)
// ：Electron + Node.js (Main) + React (Renderer)

import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import { EngineError } from './engine/core/engine-error';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { autoUpdater } from 'electron-updater';
import { FutuOpenDClient } from './broker/futu-opend';
import { BrokerManager } from './broker/BrokerManager';
import type { BrokerConfig } from './broker/IBrokerAdapter';
import { StrategyEngine } from './engine/analysis/strategy-engine';
import { BacktestEngine } from './engine/backtest/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from './engine/agents/nl-parser';
import { MarketplaceService } from './data/marketplace-service';
import { DataProviderService } from './data/data-provider';
import { EMDataProvider } from './data/em-data-provider';
import { MacroDataProvider } from './data/macro-provider';
import { SentimentIndexEngine } from './engine/analysis/sentiment-index';
import { getRealtimeSentimentStream } from './engine/analysis/sentiment-stream';
import { getDataQualityDashboard } from './engine/data/data-quality-dashboard';
import { exploreCache, getCacheEntryDetail, getCacheKeys } from './engine/data/cache-explorer';
import { getSentimentDashboard } from './engine/analysis/sentiment-dashboard';
import { exportData, getAvailableModules } from './engine/data/data-export-service';
import { getRateLimiterManager } from './engine/core/rate-limiter';
import { runConsistencyCheck, getConsistencyRules } from './engine/data/data-consistency-checker';
import { StockScreenerService } from './engine/data/stock-screener';
import { NewsAggregatorService } from './engine/data/news-aggregator';
import { SectorRotationMonitor } from './engine/data/sector-rotation';
import { StockAnomalyDetector } from './engine/data/stock-anomaly-detector';
import { MarketHotspotService } from './engine/data/market-hotspot';
import { DataSchedulerService } from './engine/data/data-scheduler';
import { initQuoteStream, getQuoteStream } from './engine/data/quote-stream';
import { initLiveExecutor, getLiveExecutor, LiveExecutor } from './engine/analysis/live-executor';
// [R158] dragon-tiger imports removed (A-stock only feature)
import { getStockCapitalFlowRank, getSectorCapitalFlowRank, getConceptCapitalFlowRank } from './engine/analysis/capital-flow-rank';
import { getCapitalFlowMonitor } from './engine/analysis/capital-flow-monitor';
import { getFundHoldings, getStockFundOwnership, getFundIncreaseRank, getFundDecreaseRank } from './engine/data/fund-holdings';
import { diagnoseStock, batchDiagnose } from './engine/data/stock-diagnosis';
import { calculatePortfolioRisk } from './engine/portfolio/portfolio-risk';
import { getMarketBreadth } from './engine/data/market-breadth';
import { getConsumerDataReport } from './engine/data/consumer-data';
import { getMarginDataReport, getStockMargin, getMarginBalanceRanking, getShortInterestRanking } from './engine/data/margin-data';
import { getStockOverview, getMarketOverview, getDailyReport } from './engine/core/emi-unified';
import { getPythonProxy } from './data/python-proxy';
import { getPush2Proxy } from './data/push2-proxy';
import { getDataQualityMonitor, registerModule } from './engine/data/data-quality-monitor';
import { captureSnapshot, querySnapshots, getSnapshot, compareSnapshots, getSnapshotTimeline, getLatestSnapshot, cleanupOldSnapshots, exportSnapshots, importSnapshots, getSnapshotStats, deleteSnapshot, clearAllSnapshots } from './engine/analysis/snapshot-service';
import { trackVersion, getEntityVersions, getVersion, getLatestVersion, diffVersions, rollback, queryVersions, getVersionStats, deleteVersion, clearAllVersions, exportVersions, importVersions } from './engine/core/version-control-service';
import { setupI18nDataIPC } from './engine/core/i18n-data';
import { getFinancialReports } from './engine/data/financial-reports';
import { getValuationData } from './engine/analysis/valuation-data';
import { computeIndicators } from './engine/analysis/technical-indicators';
import { getRealtimeIndicatorCalculator } from './engine/data/realtime-indicators';
import { blackScholesPrice, calculateGreeks, impliedVolatility, buildVolSurface, priceAndGreeks } from './engine/analysis/options-pricing';
import { calculateRiskMetrics, calcSharpeRatio, calcMaxDrawdown, calcVaR } from './engine/risk/risk-metrics';
import { brinsonAttribution, timeSeriesAttribution } from './engine/portfolio/performance-attribution';
import { correlationMatrix } from './engine/risk/correlation-matrix-v2';
import { detectSectorRotation } from './engine/data/sector-rotation-v2';
import { getDataQualityStream } from './engine/data/data-quality-stream';
import { getSmartCacheManager } from './engine/core/smart-cache';
// [R158] dragon-tiger-stream import removed (A-stock only feature)
import { getUnlockCalendar } from './engine/data/unlock-calendar';
import { getDividendCalendar } from './engine/data/dividend-calendar';
import { getEarningsCalendar } from './engine/data/earnings-calendar';
import { exportData } from './engine/data/data-exporter';
import { getSmartPicker } from './engine/agents/smart-picker';
import { getWsDataStream } from './data/ws-data-stream';
import { getHistoryBackfill } from './data/history-backfill';
import { getOpenDHealthMonitor } from './data/opd-health-data';
// QClaw Q57-Q60
import SentimentAttributionEngine from './engine/analysis/sentiment-attribution';
import CapitalFlowPredictor from './engine/analysis/capital-flow-predictor';
import SmartOrderRouter from './engine/analysis/smart-order-router';
import TCAV2Engine from './engine/analysis/tca-v3';
import MultiBrokerPnLEngine from './engine/analysis/multi-broker-pnl';
import UnifiedRiskDashboard from './engine/risk/unified-risk-dashboard';
import { z } from 'zod';
import { WalkForwardEngine } from './engine/backtest/walk-forward';
import { ParameterScanner } from './engine/portfolio/parameter-scanner-v2';
import { computeCorrelationMatrix } from './engine/risk/correlation-matrix';
import { generateSmartAlerts, generateAlertSummary, type NotificationContext } from './engine/core/notification-engine';
import { generateBacktestReport, generateQuickReport } from './engine/agents/ai-report-generator';
import { autoTune, type ParamRange } from './engine/agents/auto-tuner';
import { detectRegime, type RegimeLabel } from './engine/risk/regime-detector';
import { decomposeRisk, runMonteCarlo } from './engine/risk/risk-decomposition';
import { detectAnomalies } from './engine/analysis/anomaly-detector';
import { buildCorrelationVisualization } from './engine/risk/correlation-visualizer';
import { runStressTest, runCustomShock, HISTORICAL_SCENARIOS } from './engine/risk/stress-tester';
import { compareBacktests, summaryTable } from './engine/backtest/backtest-comparator';
import { getValuationDashboard, getValuationDashboardBatch } from './engine/analysis/valuation-dashboard';
import { compareSectorStocks, compareMultipleSectors, rankSectorStocks } from './engine/data/sector-comparison';
import { detectMacroAnomalies, analyzeMultipleIndicators } from './engine/risk/macro-alert';
import { detectCorrelationAnomalies, analyzeCorrelationMatrix } from './engine/risk/correlation-alert';
import { generateWalkForwardReport, generateBatchWalkForwardReport } from './engine/backtest/walk-forward-report';
import { generateBrinsonReport, generateBatchBrinsonReport } from './engine/portfolio/brinson-attribution';
import { analyzeOptionsChain, analyzeBatchOptionsChain } from './engine/analysis/options-chain-analyzer';
import { scoreAndRankStocks, screenStocks, batchScreenStocks } from './engine/factors/multi-factor-selector';
import { optimizePortfolio, generateEfficientFrontier, riskParityPortfolio, batchOptimizePortfolios } from './engine/portfolio/portfolio-optimizer';
import { connectWebSocket, disconnectWebSocket, subscribeToSymbol, unsubscribeFromSymbol, getWebSocketStatus, subscribeToSymbols, unsubscribeFromSymbols, getStreamingStats } from './engine/data/websocket-enhancer';
import { startBackfill, stopBackfill, getBackfillStatus, getBackfillStats, backfillSymbols, incrementalBackfill } from './engine/backtest/backfill-service';
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
import log from 'electron-log';

// default， DB user config
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
    title: i18n.t('mainSlim.k1'),
    icon: path.join(RESOURCES_PATH, 'icons', 'icon.png'),
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: !app.isPackaged, /* dev:false for HMR/devtools, packaged:true */
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

import { registerAllIPC } from './ipc/index';

function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createFromBuffer(createDiamondIcon(iconSize));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'DAWN WHALES', enabled: false },
    { type: 'separator' },
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Emergency Stop', click: () => strategyEngine?.emergencyStop() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('DAWN WHALES');
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
  } catch (err) {
    // [EngineError:AI] — structured error tracking
    void EngineError; // structured error domain: AI
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

  } catch (err) {
    // [EngineError:AI] — structured error tracking
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
        if (newsAggregator) await newsAggregator.search({ query: i18n.t('mainSlim.k7') });
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
  } catch (err) {
    // [EngineError:AI] — structured error tracking
    log.error('[App] MarketplaceService init failed:', err.message);
  }

    // ── Register all IPC handlers from domain modules ──────────────
  registerAllIPC({
    opendClient,
    brokerManager,
    strategyEngine,
    backtestEngine,
    riskEngine,
    liveExecutor,
    marketplaceService,
    dataProvider,
    emDataProvider,
    macroDataProvider,
    stockScreener,
    newsAggregator,
    sectorRotation,
    stockAnomalyDetector,
    marketHotspot,
    dataScheduler,
    db,
    watchlist: WATCHLIST,
    mainWindow,
    quotePushHandler,
  });
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
        mainWindow.webContents.send('notification', { type: 'warning', message: i18n.t('mainSlim.k8') });
      });
      await brokerManager.subscribeAndPush('futu-default', WATCHLIST);
      log.info('[App] BrokerManager auto-connected ✓ Push mode active');
    } else {
      // Legacy fallback
      opendClient = new FutuOpenDClient('127.0.0.1', 11111);
      opendClient.onDisconnect(() => {
        mainWindow?.webContents.send('notification', { type: 'warning', message: i18n.t('mainSlim.k9') });
      });
      await opendClient.connect();
      opendClient.onQuotePush((quotes) => {
        mainWindow?.webContents.send('quotes:push', quotes);
        strategyEngine?.onQuoteUpdate(quotes);
      });
      await opendClient.subscribeAndPush(WATCHLIST);
      log.info('[App] OpenD auto-connected ✓ Push mode active');
    }
  } catch (err) {
    // [EngineError:AI] — structured error tracking
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
        } catch (err) {
    // [EngineError:AI] — structured error tracking
          log.error('[App] Auto-trade failed:', err.message);
          mainWindow?.webContents.send('notification', { type: 'error', message: i18n.t('mainSlim.k10') });
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
      mainWindow?.webContents.send('notification', { type: 'info', message: i18n.t('mainSlim.k11') });
    });
    autoUpdater.on('update-downloaded', () => {
      log.info('[Updater] Update downloaded, ready to install');
      mainWindow?.webContents.send('notification', { type: 'success', message: i18n.t('mainSlim.k12') });
    });
    autoUpdater.on('error', (err) => {
      log.warn('[Updater] Error:', err.message);
    });
    // Check for updates 10s after launch, then every 4 hours
    setTimeout(() => autoUpdater.checkForUpdates().catch((_: unknown) => {}), 10000);
    setInterval(() => autoUpdater.checkForUpdates().catch((_: unknown) => {}), 4 * 60 * 60 * 1000);
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
