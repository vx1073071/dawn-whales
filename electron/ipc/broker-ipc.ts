// ── DAWN WHALES IPC: broker ────────────────────────────────────────────
// 26 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerBrokerIPC(
  orderRouter: any,
  tcaEngine: any,
  multiBrokerPnL: any,
  unifiedRiskDash: any,
  opendClient: any,
  brokerManager: any,
  strategyEngine: any,
  db: any,
  watchlist: any,
  mainWindow: any,
  quotePushHandler: any,
  BrokerConfig: any,
  riskEngine: any
) {

  ipcMain.handle('order:route', async (_e, params: any) => {
    try {
      const result = orderRouter.route(params);
      return { success: true, result };
    } catch (err) {
      log.error('[OrderRouter] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── TCA V2 (QClaw Q60) ────────────────────────────────────────────────
  const localTCAV2Engine = new TCAV2Engine();

  ipcMain.handle('order:tca', async (_e, params: any) => {
    try {
      const result = tcaEngine.analyze(params);
      return { success: true, result };
    } catch (err) {
      log.error('[TCA] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-Broker PnL (QClaw Q61) ──────────────────────────────────────
  const localMultiBrokerPnLEngine = new MultiBrokerPnLEngine();

  ipcMain.handle('pnl:multi-broker', async (_e, params?: any) => {
    try {
      const result = multiBrokerPnL.consolidate(params);
      return { success: true, result };
    } catch (err) {
      log.error('[MultiBrokerPnL] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Unified Risk Dashboard (QClaw Q62) ─────────────────────────────────
  const localUnifiedRiskDashboard = new UnifiedRiskDashboard();


  // ── Q29/Q54: Execution Analytics ────────────────────────────────────────
  ipcMain.handle('execution:analyze', async (_e, raw: unknown) => {
    try {
      const { executionRecords, marketData, benchmarkPrice, optionsScope } = raw as {
        executionRecords: any[]; marketData?: any; benchmarkPrice?: number; optionsScope?: any;
      };
      const { ExecutionAnalyticsEngine } = await import('./engine/execution-analytics.js');
      const engine = new ExecutionAnalyticsEngine();
      const result = engine.analyzeExecution(executionRecords, marketData, benchmarkPrice, optionsScope);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q55: Options Strategy Builder ────────────────────────────────────────


  // ── Q20: Real Trader ─────────────────────────────────────────────────────
  ipcMain.handle('trader:execute', async (_e, raw: unknown) => {
    try {
      const { signal, paperMode } = raw as { signal: any; paperMode?: boolean };
      const { getRealTrader } = await import('./engine/real-trader.js');
      const trader = getRealTrader();
      const result = await trader.executeSignal(signal, paperMode);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('trader:get-status', async () => {
    try {
      const { getRealTrader } = await import('./engine/real-trader.js');
      const trader = getRealTrader();
      return { success: true, status: trader.getStatus(), metrics: trader.getMetrics() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q22: Portfolio Rebalancer ────────────────────────────────────────────


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
    } catch (err) {
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
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:getFunds', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const funds = await opendClient.getFunds(accountId);
      riskEngine?.updateTotalAssets(funds?.totalAssets || 0);
      return { success: true, funds };
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:getPositions', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, positions: await opendClient.getPositions(accountId) };
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:getQuotes', async (_e, codes: string[]) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const quoteList = (!codes || codes.length === 0) ? WATCHLIST : codes;
      return { success: true, quotes: await opendClient.getQuotes(quoteList) };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Subscribe / Unsubscribe (WP1: 动态监控列表) ────────────────────


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
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:unsubscribe', async (_e, codes: string[]) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      WATCHLIST = WATCHLIST.filter((c) => !codes.includes(c));
      await opendClient.subscribeAndPush(WATCHLIST);
      db?.saveWatchlist(WATCHLIST);
      log.info('[Broker] Unsubscribed:', codes);
      return { success: true, watchlist: WATCHLIST };
    } catch (err) { return { success: false, error: err.message }; }
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
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Order Placement (with input validation) ─────────────────────────


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
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:cancelOrder', async (_e, orderId: string, accountId: string, code: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      await opendClient.cancelOrder(orderId, accountId, code);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:getOrders', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, orders: await opendClient.getOrders(accountId) };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Broker Manager (Sprint1: multi-broker) ──────────────────────────


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
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:remove', async (_e, id: string) => {
    try {
      brokerManager?.removeConfig(id);
      db?.deleteBrokerConfig(id);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });



  ipcMain.handle('broker:setActive', async (_e, id: string) => {
    try {
      brokerManager?.setActiveBroker(id);
      return { success: true, activeBroker: id };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ── Broker Switching (Sprint1) ───────────────────────────────────────


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
    } catch (err) {
      log.error('[Broker] Switch failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('broker:getStatus', async () => {
    return { success: true, status: brokerManager?.getStatus() || [] };
  });

  // ── Strategy Engine ─────────────────────────────────────────────────


  // ── Q63: Signal Quality Scorer ───────────────────────────────────────
  ipcMain.handle('signal:quality-score', async (_e, raw: unknown) => {
    try {
      const { signalType, marketContext, backtestHistory, signalParams } = raw as {
        signalType: string;
        marketContext?: any;
        backtestHistory?: any[];
        signalParams?: any;
      };
      const { SignalQualityScorer } = await import('./engine/signal-quality-scorer.js');
      const scorer = new SignalQualityScorer();
      const report = scorer.score(signalType, marketContext, backtestHistory, signalParams);
      return { success: true, report };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q68: Position Alert Engine ───────────────────────────────────────


  // ── Q68: Position Alert Engine ───────────────────────────────────────
  ipcMain.handle('position:check', async (_e, raw: unknown) => {
    try {
      const { positions, accountFunds, config } = raw as {
        positions: any[];
        accountFunds: number;
        config?: any;
      };
      const { PositionAlertEngine } = await import('./engine/position-alert-engine.js');
      const engine = new PositionAlertEngine();
      if (config) engine.updateConfig(config);
      const alerts = positions.map(pos => engine.checkPosition(pos, accountFunds));
      const summary = engine.getSummary();
      return { success: true, alerts, summary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q9: Strategy Risk Decomposition ──────────────────────────────────

}

