// ── DAWN WHALES — Electron Main Process ────────────────────────────────────
// 架构对齐：富途牛牛桌面端 (Electron + C++ core + React)
// 我们用：Electron + Node.js (Main) + React (Renderer)

import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { FutuOpenDClient } from './broker/futu-opend';
import { StrategyEngine } from './engine/strategy-engine';
import { BacktestEngine } from './engine/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from './engine/nl-parser';
import log from 'electron-log';

const WATCHLIST = ['US.TQQQ','US.SOXL','US.QQQ','US.SPY','US.AAPL','US.NVDA','US.SQQQ','US.SOXS'];

// ── Configuration ──────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const RESOURCES_PATH = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'resources');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let opendClient: FutuOpenDClient | null = null;
let strategyEngine: StrategyEngine | null = null;
let backtestEngine: BacktestEngine | null = null;
let riskEngine: RiskEngine | null = null;
let db: DatabaseManager | null = null;

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
  // ── Broker: Futu OpenD ──────────────────────────────────────────────
  ipcMain.handle('broker:connect', async (_e, config: { host: string; port: number }) => {
    try {
      opendClient = new FutuOpenDClient(config.host || '127.0.0.1', config.port || 11111);
      await opendClient.connect();
      log.info('[Broker] OpenD connected');

      opendClient.onQuotePush((quotes) => {
        mainWindow?.webContents.send('quotes:push', quotes);
        strategyEngine?.onQuoteUpdate(quotes);
      });
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

  ipcMain.handle('broker:placeOrder', async (_e, order: any) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
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

  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: any) => {
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
  } catch (err: any) {
    log.error('[App] Engine init failed:', err.message);
  }

  setupIPC();
  createWindow();

  // Auto-connect to OpenD (with auto-reconnect)
  try {
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

      if (opendClient?.connected) {
        try {
          const result = await opendClient.placeOrder(order);
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
