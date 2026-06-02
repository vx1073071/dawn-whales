// ── QuantDesk Pro — Electron Main Process ──────────────────────────────────
// 架构对齐：富途牛牛桌面端 (Electron + C++ core + React)
// 我们用：Electron + Node.js (Main) + React (Renderer)
// 性能热点后期下沉到 Rust N-API（富途用 C++ N-API）

import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { FutuOpenDClient } from './broker/futu-opend';
import { StrategyEngine } from './engine/strategy-engine';
import { BacktestEngine } from './engine/backtest-engine';
import { DatabaseManager } from './data/database';
import { RiskEngine } from './engine/risk-engine';
import log from 'electron-log';

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
      webSecurity: false,  // Allow fetch to local bridge API
    },
  });

  // Load app — always load built dist
  const distPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(distPath);

  // Open DevTools for debugging (remove in production)
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Log renderer console messages to main process
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['log', 'warn', 'error'];
    log.info(`[Renderer:${levels[level] || 'log'}] ${message}`);
  });

  // Show when ready (avoid white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // External links open in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers (Main ↔ Renderer) ────────────────────────────────────────

function setupIPC() {
  // ── Broker: Futu OpenD ──────────────────────────────────────────────
  ipcMain.handle('broker:connect', async (_e, config: { host: string; port: number }) => {
    try {
      opendClient = new FutuOpenDClient(config.host, config.port);
      await opendClient.connect();
      log.info('[Broker] OpenD connected', config);
      return { success: true, version: opendClient.version };
    } catch (err: any) {
      log.error('[Broker] OpenD connect failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:disconnect', async () => {
    opendClient?.disconnect();
    opendClient = null;
    return { success: true };
  });

  ipcMain.handle('broker:getAccounts', async () => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.getAccounts();
  });

  ipcMain.handle('broker:getFunds', async (_e, accountId: string) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.getFunds(accountId);
  });

  ipcMain.handle('broker:getPositions', async (_e, accountId: string) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.getPositions(accountId);
  });

  ipcMain.handle('broker:getQuotes', async (_e, codes: string[]) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.getQuotes(codes);
  });

  ipcMain.handle('broker:getKlines', async (_e, code: string, period: string, count: number) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.getKlines(code, period, count);
  });

  ipcMain.handle('broker:placeOrder', async (_e, order: any) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    // Risk check before placing order
    const riskResult = riskEngine?.checkOrder(order);
    if (riskResult && !riskResult.pass) {
      return { success: false, error: `风控拦截: ${riskResult.reason}` };
    }
    return opendClient.placeOrder(order);
  });

  ipcMain.handle('broker:cancelOrder', async (_e, orderId: string) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.cancelOrder(orderId);
  });

  ipcMain.handle('broker:getOrders', async (_e, accountId: string) => {
    if (!opendClient) return { success: false, error: 'Not connected' };
    return opendClient.getOrders(accountId);
  });

  // ── Strategy Engine ─────────────────────────────────────────────────
  ipcMain.handle('strategy:create', async (_e, dsl: any) => {
    const id = strategyEngine?.createStrategy(dsl);
    return { success: true, id };
  });

  ipcMain.handle('strategy:backtest', async (_e, config: any) => {
    if (!backtestEngine) return { success: false, error: 'Backtest engine not ready' };
    return backtestEngine.run(config);
  });

  ipcMain.handle('strategy:startLive', async (_e, strategyId: string) => {
    strategyEngine?.startLive(strategyId);
    return { success: true };
  });

  ipcMain.handle('strategy:stopLive', async (_e, strategyId: string) => {
    strategyEngine?.stopLive(strategyId);
    return { success: true };
  });

  // ── Database ────────────────────────────────────────────────────────
  ipcMain.handle('db:getStrategies', async () => {
    return db?.getStrategies() || [];
  });

  ipcMain.handle('db:saveStrategy', async (_e, strategy: any) => {
    return db?.saveStrategy(strategy);
  });

  ipcMain.handle('db:getSettings', async () => {
    return db?.getSettings() || {};
  });

  ipcMain.handle('db:saveSettings', async (_e, settings: any) => {
    return db?.saveSettings(settings);
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
}

// ── System Tray ────────────────────────────────────────────────────────────

function createTray() {
  // Create a simple tray icon (gold diamond)
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

app.whenReady().then(() => {
  log.info('[App] DAWN WHALES starting...');

  try {
    // Initialize database
    db = new DatabaseManager();
    db.initialize();
  } catch (err: any) {
    log.error('[App] Database init failed:', err.message);
  }

  try {
    // Initialize engines
    strategyEngine = new StrategyEngine();
    backtestEngine = new BacktestEngine();
    riskEngine = new RiskEngine();
  } catch (err: any) {
    log.error('[App] Engine init failed:', err.message);
  }

  // Setup IPC
  setupIPC();

  // Create window
  createWindow();
  createTray();

  log.info('[App] DAWN WHALES ready');
});

app.on('window-all-closed', () => {
  // Don't quit on window close (tray app behavior, like Futu)
  if (process.platform !== 'darwin') {
    // On Windows, minimize to tray instead of quit
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  opendClient?.disconnect();
  db?.close();
  strategyEngine?.emergencyStop();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function createDiamondIcon(size: number): Buffer {
  // Create a simple RGBA buffer for a gold diamond icon
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      const idx = (y * size + x) * 4;
      if (dist < size / 2 - 1) {
        pixels[idx] = 201;     // R (#C9A96E gold)
        pixels[idx + 1] = 169; // G
        pixels[idx + 2] = 110; // B
        pixels[idx + 3] = 255; // A
      }
    }
  }
  return pixels;
}
