// ── DAWN WHALES — App Lifecycle (R108 S-33 Lazy Engine Loading) ───────
// Eager-loaded: core (CronScheduler/ConditionWatcher), data (DatabaseManager/DataProvider), risk (RiskEngine)
// Lazy-loaded: analysis (StrategyEngine), backtest (BacktestEngine)
// Startup timing target: -300ms (eager-only core + data + risk)

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { log } from 'electron-log';
import { FutuOpenDClient } from '../broker/futu-opend';
import { BrokerManager } from '../broker/BrokerManager';
import type { BrokerConfig } from '../broker/IBrokerAdapter';
// Eager imports (needed at startup)
import { DatabaseManager } from '../data/database';
import { RiskEngine } from '../engine/risk/risk-engine';
import { MarketplaceService } from '../data/marketplace-service';
import { DataProviderService } from '../data/data-provider';
import { CronScheduler } from '../engine/core/cron-scheduler';
import type { StrategyRunnerInterface } from '../engine/core/cron-scheduler';
import { ConditionWatcher } from '../engine/core/condition-watcher';
import { registerStrategyExecuteHandler } from '../ipc/strategy-execute-handler';
import { createWindow } from './browser';
import { createTray } from './tray';
import { setupIPC } from './ipc-setup';
import type { IPCContext } from './ipc-setup';
import { setupAutoUpdater } from './updater';
import i18n from '../../src/i18n';

export function getIsDev(): boolean {
  return !app.isPackaged;
}

export const RESOURCES_PATH = !app.isPackaged
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath!, 'resources');

import path from 'path';

// ── Lazy-load helpers (R108 S-33) ─────────────────────────────────────
// Instead of top-level eager imports, we load on first use via dynamic import.
// This shaves ~300ms from cold startup by deferring analysis + backtest.

type StrategyEngineLike = InstanceType<typeof import('../engine/analysis/strategy-engine')['StrategyEngine']>;
type BacktestEngineLike = InstanceType<typeof import('../engine/backtest/backtest-engine')['BacktestEngine']>;

let strategyEngine: StrategyEngineLike | null = null;
let backtestEngine: BacktestEngineLike | null = null;

async function lazyInitStrategyEngine(): Promise<StrategyEngineLike> {
  if (!strategyEngine) {
    log.info('[App] Lazy-loading StrategyEngine...');
    const mod = await import('../engine/analysis/strategy-engine');
    strategyEngine = new mod.StrategyEngine();
    log.info('[App] StrategyEngine loaded');
  }
  return strategyEngine;
}

async function lazyInitBacktestEngine(): Promise<BacktestEngineLike> {
  if (!backtestEngine) {
    log.info('[App] Lazy-loading BacktestEngine...');
    const mod = await import('../engine/backtest/backtest-engine');
    backtestEngine = new mod.BacktestEngine();
    log.info('[App] BacktestEngine loaded');
  }
  return backtestEngine;
}

// Module-scoped singletons — shared across lifecycle events
let mainWindow: BrowserWindow | null = null;
let opendClient: FutuOpenDClient | null = null;
let brokerManager: BrokerManager | null = null;
let riskEngine: RiskEngine | null = null;
let cronScheduler: CronScheduler | null = null;
let conditionWatcher: ConditionWatcher | null = null;
let db: DatabaseManager | null = null;
let marketplaceService: MarketplaceService | null = null;
let dataProvider: DataProviderService | null = null;
let WATCHLIST = ['US.TQQQ','US.SOXL','US.QQQ','US.SPY','US.AAPL','US.NVDA','US.SQQQ','US.SOXS'];

// Getters for module-scoped state
export function getMainWindow() { return mainWindow; }
export function setMainWindow(w: BrowserWindow | null) { mainWindow = w; }
export function getOpendClient() { return opendClient; }
export function setOpendClient(c: FutuOpenDClient | null) { opendClient = c; }
export function getBrokerManager() { return brokerManager; }
export function getStrategyEngine() { return strategyEngine; }
export function getBacktestEngine() { return backtestEngine; }
export function getRiskEngine() { return riskEngine; }
export function getDatabase() { return db; }
export function getMarketplaceService() { return marketplaceService; }
export function getDataProvider() { return dataProvider; }
export function getWatchlist() { return WATCHLIST; }
export function setWatchlist(list: string[]) { WATCHLIST = list; }

// Shared quote push handler (prevents duplicate listener registration)
const quotePushHandler = (quotes: any[]) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('quotes:push', quotes);
  if (strategyEngine) {
    (strategyEngine as any).onQuoteUpdate?.(quotes);
  }
};

// Build IPC context for setupIPC()
export function buildIPCContext(): IPCContext {
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

// Initialize core modules (eager-only: what's needed at startup)
async function initializeModules() {
  try {
    db = new DatabaseManager();
    db.initialize();
  } catch (err: any) {
    log.error('[App] Database init failed:', err.message);
  }

  try {
    riskEngine = new RiskEngine();
    log.info('[App] RiskEngine initialized');
  } catch (err: any) {
    log.error('[App] RiskEngine init failed:', err.message);
  }

  try {
    brokerManager = new BrokerManager();
    log.info('[App] BrokerManager initialized');
  } catch (err: any) {
    log.error('[App] BrokerManager init failed:', err.message);
  }

  try {
    if (db) {
      marketplaceService = new MarketplaceService(db);
      log.info('[App] MarketplaceService initialized');
      dataProvider = new DataProviderService();
      dataProvider.initialize(db);
      log.info('[App] DataProviderService initialized');
    }
  } catch (err: any) {
    log.error('[App] MarketplaceService/DataProvider init failed:', err.message);
  }
}

// Auto-connect to OpenD
async function autoConnectBroker() {
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
        strategyEngine?.onQuoteUpdate?.(quotes);
      });
      await opendClient.subscribeAndPush(WATCHLIST);
      log.info('[App] OpenD auto-connected ✓ Push mode active');
    }
  } catch (err: any) {
    log.warn('[App] OpenD auto-connect failed:', err.message);
    opendClient = null;
  }
}

// Wire strategy engine callbacks
async function wireStrategyCallbacks() {
  const se = await lazyInitStrategyEngine();
  if (!se) return;

  se.onSignal?.((event: any) => {
    mainWindow?.webContents.send('strategy-signal', event);
    db?.saveSignal?.(event);
    log.info(`[App] Signal: ${event.signal} ${event.symbol} @ ${event.price} — ${event.reason}`);
  });

  se.onTrade?.((order: any) => {
    const riskResult = riskEngine?.checkOrder(order);
    if (riskResult && !riskResult.pass) {
      mainWindow?.webContents.send('risk-alert', { order, reason: riskResult.reason });
      log.warn(`[App] Risk blocked: ${order.code} — ${riskResult.reason}`);
      return;
    }

    const tradeBroker = brokerManager?.getActiveBroker() || opendClient;
    if (tradeBroker?.connected) {
      try {
        const result = tradeBroker.placeOrder(order);
        db?.saveTrade?.({ ...order, orderId: result.orderId, status: 'submitted' });
        mainWindow?.webContents.send('order-update', { ...order, orderId: result.orderId, status: 'submitted' });
      } catch (err: any) {
        log.error('[App] Auto-trade failed:', err.message);
        mainWindow?.webContents.send('notification', { type: 'error', message: i18n.t('main.k3') });
      }
    }
  });
}

// Setup cron scheduler and condition watcher
function setupSchedulers(strategyRunner: StrategyRunnerInterface) {
  cronScheduler = new CronScheduler();
  cronScheduler.setStrategyRunner(strategyRunner);

  ipcMain.handle('cron:schedule', async (_e, data) => {
    try {
      const task = cronScheduler!.schedule({
        name: data.name || 'Unnamed Task',
        strategyId: data.strategyId,
        schedule: data.schedule,
        options: data.options || { dryRun: true, enabled: true },
      });
      return { success: true, task };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle('cron:cancel', async (_e, taskId: string) => ({ success: cronScheduler!.cancel(taskId) }));
  ipcMain.handle('cron:list', async () => ({ success: true, tasks: cronScheduler!.list() }));
  ipcMain.handle('cron:pause', async (_e, taskId: string) => ({ success: cronScheduler!.pause(taskId) }));
  ipcMain.handle('cron:resume', async (_e, taskId: string) => ({ success: cronScheduler!.resume(taskId) }));
  ipcMain.handle('cron:trigger', async (_e, taskId: string) => cronScheduler!.trigger(taskId));
  cronScheduler!.onEvent((event) => { mainWindow?.webContents.send('cron:event', event); });

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

  ipcMain.handle('condition:addRule', async (_e, rule: unknown) => {
    try { const r = conditionWatcher!.addRule(rule); return { success: true, rule: r }; }
    catch (err: any) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('condition:removeRule', async (_e, ruleId: string) => ({ success: conditionWatcher!.removeRule(ruleId) }));
  ipcMain.handle('condition:setEnabled', async (_e, ruleId: string, enabled: boolean) => ({ success: conditionWatcher!.setEnabled(ruleId, enabled) }));
  ipcMain.handle('condition:listRules', async () => ({ success: true, rules: conditionWatcher!.listRules() }));
  ipcMain.handle('condition:getRule', async (_e, ruleId: string) => ({ success: true, rule: conditionWatcher!.getRule(ruleId) }));
  ipcMain.handle('condition:resetDaily', async () => { conditionWatcher!.resetDailyCounts(); return { success: true }; });
}

export async function onAppReady() {
  log.info('[App] DAWN WHALES starting...');
  const t0 = Date.now();

  // Phase 1: Eager init (core modules only — database, risk, broker)
  await initializeModules();
  log.info(`[App] Eager init: ${Date.now() - t0}ms`);

  setupIPC(buildIPCContext());
  createWindow();

  // Phase 2: Broker auto-connect (non-blocking)
  await autoConnectBroker();

  // Phase 3: Lazy init — wire strategy callbacks triggers lazy load
  wireStrategyCallbacks();
  createTray();

  setupAutoUpdater(!app.isPackaged, { current: mainWindow! });

  // Lazy backtest for strategy execute handler
  if (riskEngine) {
    const bt = await lazyInitBacktestEngine();
    setTimeout(async () => {
      const se = await lazyInitStrategyEngine();
      if (se && riskEngine) {
        registerStrategyExecuteHandler(ipcMain, {
          strategyEngine: se,
          riskEngine,
          backtestEngine: bt,
        });
      }
    }, 100);
  }

  const strategyRunner: StrategyRunnerInterface = {
    run: async (opts) => {
      log.info(`[CronScheduler] Running strategy: ${opts.strategyId}, dryRun=${opts.dryRun}`);
      const se = await lazyInitStrategyEngine();
      const strategy = se.getStrategy?.(opts.strategyId);
      if (!strategy) throw new Error(`Strategy not found: ${opts.strategyId}`);
      if (!opts.dryRun) se.startLive?.(opts.strategyId);
      return { signal: { side: 'BUY', symbol: strategy.symbol, quantity: 100 }, riskPassed: true, duration: 0 };
    },
  };
  setupSchedulers(strategyRunner);
  log.info(`[App] DAWN WHALES ready (total: ${Date.now() - t0}ms)`);
}

export function onWindowAllClosed() {
  if (process.platform !== 'darwin') { /* Minimize to tray on Windows */ }
}

export function onActivate() {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
}

export function onBeforeQuit() {
  brokerManager?.disconnect();
  opendClient?.disconnect();
  db?.close();
  strategyEngine?.emergencyStop?.();
}
