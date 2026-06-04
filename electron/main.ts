// ── DAWN WHALES — Electron Main Process (Modular) ──────────────────────────
// 架构对齐：富途牛牛桌面端 (Electron + C++ core + React)
// 我们用：Electron + Node.js (Main) + React (Renderer)
//
// 模块化重构：所有 IPC handlers 已拆分到 ipc-handlers/*.ts
// main.ts 只负责：应用启动、引擎初始化、窗口管理

import { app, BrowserWindow, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { FutuOpenDClient } from './broker/futu-opend';
import { BrokerManager } from './broker/BrokerManager';
import type { BrokerConfig } from './broker/IBrokerAdapter';
import { StrategyEngine } from './engine/strategy-engine';
import { BacktestEngine } from './engine/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk-engine';
import { MarketplaceService } from './data/marketplace-service';
import { DataProviderService } from './data/data-provider';
import { registerAllHandlers } from './ipc-handlers';
import { shared } from './ipc-handlers/_import-shared';
import log from 'electron-log';

// ── Configuration ──────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const RESOURCES_PATH = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'resources');

// ── Window Creation ────────────────────────────────────────────────────────

function createWindow() {
  shared.mainWindow = new BrowserWindow({
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
    shared.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    shared.mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    shared.mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Log renderer console messages
  shared.mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['log', 'warn', 'error'];
    log.info(`[Renderer:${levels[level] || 'log'}] ${message}`);
  });

  shared.mainWindow.once('ready-to-show', () => shared.mainWindow?.show());

  shared.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  shared.mainWindow.on('closed', () => { shared.mainWindow = null; });
}

// ── System Tray ────────────────────────────────────────────────────────────

function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createFromBuffer(createDiamondIcon(iconSize));
  shared.tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'DAWN WHALES · 道鲸', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => shared.mainWindow?.show() },
    { label: '紧急停止所有策略', click: () => shared.strategyEngine?.emergencyStop() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  shared.tray.setToolTip('DAWN WHALES · 道鲸');
  shared.tray.setContextMenu(contextMenu);
  shared.tray.on('double-click', () => shared.mainWindow?.show());
}

// ── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info('[App] DAWN WHALES starting...');

  // Initialize modules
  try {
    shared.db = new DatabaseManager();
    shared.db.initialize();
  } catch (err: any) {
    log.error('[App] Database init failed:', err.message);
  }

  try {
    shared.strategyEngine = new StrategyEngine();
    shared.backtestEngine = new BacktestEngine();
    shared.riskEngine = new RiskEngine();
    // v2: Connect risk engine to strategy engine
    if (shared.strategyEngine && shared.riskEngine) {
      shared.strategyEngine.setRiskEngine(shared.riskEngine);
      log.info('[App] StrategyEngine ↔ RiskEngine connected');
    }
    shared.brokerManager = new BrokerManager();
  } catch (err: any) {
    log.error('[App] Engine init failed:', err.message);
  }

  try {
    if (shared.db) {
      shared.marketplaceService = new MarketplaceService(shared.db);
      log.info('[App] MarketplaceService initialized');

      shared.dataProvider = new DataProviderService();
      shared.dataProvider.initialize(shared.db);
      log.info('[App] DataProviderService initialized');
    }
  } catch (err: any) {
    log.error('[App] MarketplaceService init failed:', err.message);
  }

  // Register all IPC handlers (modular)
  registerAllHandlers();
  
  createWindow();

  // Shared quote push handler (prevents duplicate listener registration)
  shared.quotePushHandler = (quotes: any[]) => {
    if (!shared.mainWindow || shared.mainWindow.isDestroyed()) return;
    shared.mainWindow.webContents.send('quotes:push', quotes);
    shared.strategyEngine?.onQuoteUpdate(quotes);
  };

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
    const savedConfigs = shared.db?.getBrokerConfigs?.() || [defaultBroker];
    if (shared.brokerManager) {
      shared.brokerManager.loadConfigs(savedConfigs);
      shared.brokerManager.clearCallbacks();
      shared.brokerManager.onQuotePush(shared.quotePushHandler);
      await shared.brokerManager.connect('futu-default');
      const adapter = shared.brokerManager.getActiveBroker();
      adapter?.onDisconnect(() => {
        if (!shared.mainWindow || shared.mainWindow.isDestroyed()) return;
        shared.mainWindow.webContents.send('notification', { type: 'warning', message: 'OpenD 连接断开，正在重连...' });
      });
      await shared.brokerManager.subscribeAndPush('futu-default', shared.WATCHLIST);
      log.info('[App] BrokerManager auto-connected ✓ Push mode active');
    } else {
      // Legacy fallback
      shared.opendClient = new FutuOpenDClient('127.0.0.1', 11111);
      shared.opendClient.onDisconnect(() => {
        shared.mainWindow?.webContents.send('notification', { type: 'warning', message: 'OpenD 连接断开，正在重连...' });
      });
      await shared.opendClient.connect();
      shared.opendClient.onQuotePush((quotes) => {
        shared.mainWindow?.webContents.send('quotes:push', quotes);
        shared.strategyEngine?.onQuoteUpdate(quotes);
      });
      await shared.opendClient.subscribeAndPush(shared.WATCHLIST);
      log.info('[App] OpenD auto-connected ✓ Push mode active');
    }
  } catch (err: any) {
    log.warn('[App] OpenD auto-connect failed:', err.message);
    shared.opendClient = null;
  }

  // Wire strategy engine callbacks
  if (shared.strategyEngine) {
    shared.strategyEngine.onSignal((event) => {
      shared.mainWindow?.webContents.send('strategy-signal', event);
      shared.db?.saveSignal(event);
      log.info(`[App] Signal: ${event.signal} ${event.symbol} @ ${event.price} — ${event.reason}`);
    });

    shared.strategyEngine.onTrade(async (order) => {
      const riskResult = shared.riskEngine?.checkOrder(order);
      if (riskResult && !riskResult.pass) {
        shared.mainWindow?.webContents.send('risk-alert', { order, reason: riskResult.reason });
        log.warn(`[App] Risk blocked: ${order.code} — ${riskResult.reason}`);
        return;
      }

      const tradeBroker = shared.brokerManager?.getActiveBroker() || shared.opendClient;
      if (tradeBroker?.connected) {
        try {
          const result = await tradeBroker.placeOrder(order);
          shared.db?.saveTrade({ ...order, orderId: result.orderId, status: 'submitted' });
          shared.mainWindow?.webContents.send('order-update', { ...order, orderId: result.orderId, status: 'submitted' });
        } catch (err: any) {
          log.error('[App] Auto-trade failed:', err.message);
          shared.mainWindow?.webContents.send('notification', { type: 'error', message: `交易失败: ${err.message}` });
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
      shared.mainWindow?.webContents.send('notification', { type: 'info', message: `新版本 ${info.version} 可用，请在设置中更新` });
    });
    autoUpdater.on('update-downloaded', () => {
      log.info('[Updater] Update downloaded, ready to install');
      shared.mainWindow?.webContents.send('notification', { type: 'success', message: '更新已下载，重启即可安装' });
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
  shared.brokerManager?.disconnect();
  shared.opendClient?.disconnect();
  shared.db?.close();
  shared.strategyEngine?.emergencyStop();
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
