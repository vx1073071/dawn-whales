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
import { StrategyEngine } from './engine/analysis/strategy-engine';
import { BacktestEngine } from './engine/backtest/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from './engine/agents/nl-parser';
import { MarketplaceService } from './data/marketplace-service';
import { DataProviderService } from './data/data-provider';
import { z } from 'zod';
import { WalkForwardEngine } from './engine/backtest/walk-forward';
import { ParameterScanner } from './engine/portfolio/parameter-scanner';
import { CronScheduler } from './engine/core/cron-scheduler';
import type { StrategyRunnerInterface } from './engine/core/cron-scheduler';
import { ConditionWatcher } from './engine/core/condition-watcher';
import type { QuoteSnapshot, ConditionRule } from './engine/core/condition-watcher';
import { registerStrategyExecuteHandler } from './ipc/strategy-execute-handler';
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
} from './ipc-schemas';

// 默认监控列表，连接时从 DB 读取用户配置
let WATCHLIST = ['US.TQQQ','US.SOXL','US.QQQ','US.SPY','US.AAPL','US.NVDA','US.SQQQ','US.SOXS'];

// ── Utils ──────────────────────────────────────────────────────────────────
const execAsync = promisify(exec);

// ── Configuration ──────────────────────────────────────────────────────────
import { createWindow } from './main/browser';
import { createTray } from './main/tray';
import { setupIPC } from './main/ipc-setup';
import type { IPCContext } from './main/ipc-setup';
import { EngineError, ErrorDomain, ErrorCode } from './engine/core/engine-error';
import i18n from '../src/i18n';



const isDev = !app.isPackaged;
const RESOURCES_PATH = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'resources');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let opendClient: FutuOpenDClient | null = null;
let brokerManager: BrokerManager | null = null;
let strategyEngine: StrategyEngine | null = null;
let backtestEngine: BacktestEngine | null = null;
let riskEngine: RiskEngine | null = null;
let cronScheduler: CronScheduler | null = null;
let conditionWatcher: ConditionWatcher | null = null;
let db: DatabaseManager | null = null;
let marketplaceService: MarketplaceService | null = null;
let dataProvider: DataProviderService | null = null;

// ── Shared quote push handler (prevents duplicate listener registration) ─────
const quotePushHandler = (quotes: any[]) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('quotes:push', quotes);
  strategyEngine?.onQuoteUpdate(quotes);
};

// ── Helper: build IPC context from module-scoped variables ──────────────────
function buildIPCContext(): IPCContext {
  return {
    mainWindow,
    opendClient,
    brokerManager,
    strategyEngine,
    backtestEngine,
    riskEngine,
    db,
    marketplaceService,
    dataProvider,
    WATCHLIST,
    quotePushHandler,
    setOpendClient: (c: FutuOpenDClient | null) => { opendClient = c; },
    setWatchlist: (list: string[]) => { WATCHLIST = list; },
  };
}

// ── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info('[App] DAWN WHALES starting...');

  // Initialize modules
  try {
    db = new DatabaseManager();
    db.initialize();
  } catch (err) {
    log.error('[App] Database init failed:', err.message);
  }

  try {
    strategyEngine = new StrategyEngine();
    backtestEngine = new BacktestEngine();
    riskEngine = new RiskEngine();
    if (strategyEngine && riskEngine) {
      strategyEngine.setRiskEngine(riskEngine);
      log.info('[App] StrategyEngine ↔ RiskEngine connected');
    }
    brokerManager = new BrokerManager();
  } catch (err) {
    log.error('[App] Engine init failed:', err.message);
  }

  try {
    if (db) {
      marketplaceService = new MarketplaceService(db);
      log.info('[App] MarketplaceService initialized');

      dataProvider = new DataProviderService();
      dataProvider.initialize(db);
      log.info('[App] DataProviderService initialized');
    }
  } catch (err) {
    log.error('[App] MarketplaceService init failed:', err.message);
  }

  // Register all IPC handlers (parameterized — extracted to main/ipc-setup.ts)
  setupIPC(buildIPCContext());
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

    const savedConfigs = db?.getBrokerConfigs?.() || [defaultBroker];
    if (brokerManager) {
      brokerManager.loadConfigs(savedConfigs);
      brokerManager.clearCallbacks();
      brokerManager.onQuotePush(quotePushHandler);
      await brokerManager.connect('futu-default');
      const adapter = brokerManager.getActiveBroker();
      adapter?.onDisconnect(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send('notification', { type: 'warning', message: i18n.t('main.k1') });
      });
      await brokerManager.subscribeAndPush('futu-default', WATCHLIST);
      log.info('[App] BrokerManager auto-connected ✓ Push mode active');
    } else {
      opendClient = new FutuOpenDClient('127.0.0.1', 11111);
      opendClient.onDisconnect(() => {
        mainWindow?.webContents.send('notification', { type: 'warning', message: i18n.t('main.k2') });
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
          log.error('[App] Auto-trade failed:', err.message);
          mainWindow?.webContents.send('notification', { type: 'error', message: i18n.t('main.k3') });
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
      mainWindow?.webContents.send('notification', { type: 'info', message: i18n.t('main.k4') });
    });
    autoUpdater.on('update-downloaded', () => {
      log.info('[Updater] Update downloaded, ready to install');
      mainWindow?.webContents.send('notification', { type: 'success', message: i18n.t('main.k5') });
    });
    autoUpdater.on('error', (err) => {
      log.warn('[Updater] Error:', err.message);
    });
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  }

  // Register strategy:execute IPC handler
  if (strategyEngine && riskEngine) {
    registerStrategyExecuteHandler(ipcMain, {
      strategyEngine,
      riskEngine,
      backtestEngine: new BacktestEngine(),
    });
  }

  // ── CronScheduler (Phase 4.1) ──────────────────────────────────────
  cronScheduler = new CronScheduler();

  const strategyRunner: StrategyRunnerInterface = {
    run: async (opts) => {
      log.info(`[CronScheduler] Running strategy: ${opts.strategyId}, dryRun=${opts.dryRun}`);
      const strategy = strategyEngine?.getStrategy(opts.strategyId);
      if (!strategy) throw new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `Strategy not found: ${opts.strategyId}`);

      if (!opts.dryRun) {
        strategyEngine?.startLive(opts.strategyId);
      }

      return {
        signal: { side: 'BUY', symbol: strategy.symbol, quantity: 100 },
        riskPassed: true,
        duration: Date.now() - Date.now(),
      };
    },
  };
  cronScheduler.setStrategyRunner(strategyRunner);

  // CronScheduler IPC handlers
  ipcMain.handle('cron:schedule', async (_e, data) => {
    try {
      const task = cronScheduler!.schedule({
        name: data.name || 'Unnamed Task',
        strategyId: data.strategyId,
        schedule: data.schedule,
        options: data.options || { dryRun: true, enabled: true },
      });
      return { success: true, task };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('cron:cancel', async (_e, taskId: string) => {
    return { success: cronScheduler!.cancel(taskId) };
  });

  ipcMain.handle('cron:list', async () => {
    return { success: true, tasks: cronScheduler!.list() };
  });

  ipcMain.handle('cron:pause', async (_e, taskId: string) => {
    return { success: cronScheduler!.pause(taskId) };
  });

  ipcMain.handle('cron:resume', async (_e, taskId: string) => {
    return { success: cronScheduler!.resume(taskId) };
  });

  ipcMain.handle('cron:trigger', async (_e, taskId: string) => {
    return cronScheduler!.trigger(taskId);
  });

  cronScheduler!.onEvent((event) => {
    mainWindow?.webContents.send('cron:event', event);
  });

  // ── ConditionWatcher (Phase 4.2) ──────────────────────────────────
  conditionWatcher = new ConditionWatcher();
  conditionWatcher.setStrategyRunner(strategyRunner);
  conditionWatcher.startCleanup();

  // Wire quote push to ConditionWatcher
  const enhancedHandler = (quotes: any[]) => {
    quotePushHandler(quotes);
    for (const q of quotes) {
      conditionWatcher?.processQuote({
        symbol: q.code || q.symbol,
        price: q.price || q.lastPrice || 0,
        bid: q.bid || 0,
        ask: q.ask || 0,
        volume: q.volume || 0,
        timestamp: Date.now(),
        source: q.source || 'futu',
      });
    }
  };
  if (brokerManager) {
    brokerManager.clearCallbacks();
    brokerManager.onQuotePush(enhancedHandler);
  }

  // ConditionWatcher IPC handlers
  ipcMain.handle('condition:addRule', async (_e, rule: unknown) => {
    try {
      const r = conditionWatcher!.addRule(rule);
      return { success: true, rule: r };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('condition:removeRule', async (_e, ruleId: string) => {
    return { success: conditionWatcher!.removeRule(ruleId) };
  });

  ipcMain.handle('condition:setEnabled', async (_e, ruleId: string, enabled: boolean) => {
    return { success: conditionWatcher!.setEnabled(ruleId, enabled) };
  });

  ipcMain.handle('condition:listRules', async () => {
    return { success: true, rules: conditionWatcher!.listRules() };
  });

  ipcMain.handle('condition:getRule', async (_e, ruleId: string) => {
    return { success: true, rule: conditionWatcher!.getRule(ruleId) };
  });

  ipcMain.handle('condition:resetDaily', async () => {
    conditionWatcher!.resetDailyCounts();
    return { success: true };
  });

  log.info('[App] DAWN WHALES ready (CronScheduler + ConditionWatcher active)');
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
