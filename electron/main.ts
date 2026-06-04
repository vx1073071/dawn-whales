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
import { WalkForwardEngine } from './engine/walk-forward';
import { ParameterScanner } from './engine/parameter-scanner';
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
let db: DatabaseManager | null = null;
let marketplaceService: MarketplaceService | null = null;
let dataProvider: DataProviderService | null = null;

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
        await brokerManager.connect(brokerCfg.id);
        const adapter = brokerManager.getActiveBroker();
        adapter?.onQuotePush((quotes) => {
          mainWindow?.webContents.send('quotes:push', quotes);
          strategyEngine?.onQuoteUpdate(quotes);
        });
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
        activeAdapter.onQuotePush((quotes) => {
          mainWindow?.webContents.send('quotes:push', quotes);
          strategyEngine?.onQuoteUpdate(quotes);
        });
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
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Set DEEPSEEK_API_KEY env var.' };
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
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'DeepSeek API key not configured. Set DEEPSEEK_API_KEY env var.' };
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

  // ── Greeks Calculation (WP5: Python subprocess) ─────────────────────
  ipcMain.handle('greeks:calculate', async (_e, params: {
    spot: number; strike: number; vol: number; days: number;
    rate?: number; type: 'CALL' | 'PUT'; qty?: number;
  }) => {
    try {
      const scriptPath = path.join(
        process.resourcesPath, '..', '..', '.workbuddy', 'skills', 'option-greeks', 'scripts', 'calc_greeks.py'
      );
      // Fallback for dev mode
      const devPath = path.join(
        require('os').homedir(), '.workbuddy', 'skills', 'option-greeks', 'scripts', 'calc_greeks.py'
      );
      const pythonExe = path.join(
        require('os').homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'
      );

      const fs = require('fs');
      const actualScript = fs.existsSync(scriptPath) ? scriptPath : devPath;
      if (!fs.existsSync(actualScript)) {
        return { success: false, error: 'option-greeks script not found' };
      }

      const cmd = `"${pythonExe}" "${actualScript}" --spot ${params.spot} --strike ${params.strike} --vol ${params.vol} --days ${params.days} --type ${params.type} --rate ${params.rate || 0.05} --json`;
      const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 5000 });
      const result = JSON.parse(stdout);
      return { success: true, greeks: result };
    } catch (err: any) {
      log.error('[Greeks] Calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('greeks:portfolio', async (_e, positions: any[]) => {
    try {
      const devPath = path.join(
        require('os').homedir(), '.workbuddy', 'skills', 'option-greeks', 'scripts', 'portfolio_greeks.py'
      );
      const pythonExe = path.join(
        require('os').homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'
      );

      const fs = require('fs');
      if (!fs.existsSync(devPath)) {
        return { success: false, error: 'portfolio_greeks script not found' };
      }

      const positionsJson = JSON.stringify(positions).replace(/"/g, '\\"');
      const cmd = `"${pythonExe}" "${devPath}" --positions "${positionsJson}" --json`;
      const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 10000 });
      const result = JSON.parse(stdout);
      return { success: true, portfolio: result };
    } catch (err: any) {
      log.error('[Greeks] Portfolio calc failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Marketplace ───────────────────────────────────────────────────

  ipcMain.handle('marketplace:rate', async (_e, strategyId: string, rating: number) => {
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

  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────
  ipcMain.handle('backtest:walk-forward', async (_e, config: any) => {
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
    brokerManager = new BrokerManager();
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
      await brokerManager.connect('futu-default');
      const adapter = brokerManager.getActiveBroker();
      adapter?.onQuotePush((quotes) => {
        mainWindow?.webContents.send('quotes:push', quotes);
        strategyEngine?.onQuoteUpdate(quotes);
      });
      adapter?.onDisconnect(() => {
        mainWindow?.webContents.send('notification', { type: 'warning', message: 'OpenD 连接断开，正在重连...' });
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
