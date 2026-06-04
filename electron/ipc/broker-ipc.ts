// ── DAWN WHALES IPC: broker ────────────────────────────────────────────
// Auto-split from main.ts — 26 handlers
//
// Registered channels:
//   order:route
//   order:tca
//   pnl:multi-broker
//   execution:analyze
//   trader:execute
//   trader:get-status
//   broker:connect
//   broker:disconnect
//   broker:getAccounts
//   broker:getFunds
//   broker:getPositions
//   broker:getQuotes
//   broker:subscribe
//   broker:unsubscribe
//   broker:getKlines
//   broker:placeOrder
//   broker:cancelOrder
//   broker:getOrders
//   broker:list
//   broker:add
//   broker:remove
//   broker:setActive
//   broker:switch
//   broker:getStatus
//   signal:quality-score
//   position:check

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { FutuOpenDClient } from './broker/futu-opend';
import { BrokerManager } from './broker/BrokerManager';

/**
 * Register all broker IPC handlers
 *
 * @param opendClient - service reference
 * @param brokerManager - service reference
 * @param strategyEngine - service reference
 * @param db - service reference
 * @param watchlist - service reference
 * @param mainWindow - service reference
 * @param quotePushHandler - service reference
 * @param riskEngine - service reference
 */
export function registerBrokerIPC(
  opendClient: any,
  brokerManager: any,
  strategyEngine: any,
  db: any,
  watchlist: any,
  mainWindow: any,
  quotePushHandler: any,
  riskEngine: any
) {

  // ── order:route ───────────────────────────────────────────────
  ipcMain.handle('order:route', async (_e, params: any) => {
    try {
      const result = orderRouter.route(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[OrderRouter] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── order:tca ───────────────────────────────────────────────
  ipcMain.handle('order:tca', async (_e, params: any) => {
    try {
      const result = tcaEngine.analyze(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[TCA] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── pnl:multi-broker ───────────────────────────────────────────────
  ipcMain.handle('pnl:multi-broker', async (_e, params?: any) => {
    try {
      const result = multiBrokerPnL.consolidate(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[MultiBrokerPnL] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── execution:analyze ───────────────────────────────────────────────
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── trader:execute ───────────────────────────────────────────────
  // ── Q20: Real Trader ─────────────────────────────────────────────────────
  ipcMain.handle('trader:execute', async (_e, raw: unknown) => {
    try {
      const { signal, paperMode } = raw as { signal: any; paperMode?: boolean };
      const { getRealTrader } = await import('./engine/real-trader.js');
      const trader = getRealTrader();
      const result = await trader.executeSignal(signal, paperMode);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── trader:get-status ───────────────────────────────────────────────
  ipcMain.handle('trader:get-status', async () => {
    try {
      const { getRealTrader } = await import('./engine/real-trader.js');
      const trader = getRealTrader();
      return { success: true, status: trader.getStatus(), metrics: trader.getMetrics() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── broker:connect ───────────────────────────────────────────────
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

  // ── broker:disconnect ───────────────────────────────────────────────
  ipcMain.handle('broker:disconnect', async () => {
    opendClient?.disconnect();
    opendClient = null;
    return { success: true };
  });

  // ── broker:getAccounts ───────────────────────────────────────────────
  ipcMain.handle('broker:getAccounts', async () => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, accounts: await opendClient.getAccounts() };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:getFunds ───────────────────────────────────────────────
  ipcMain.handle('broker:getFunds', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const funds = await opendClient.getFunds(accountId);
      riskEngine?.updateTotalAssets(funds?.totalAssets || 0);
      return { success: true, funds };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:getPositions ───────────────────────────────────────────────
  ipcMain.handle('broker:getPositions', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, positions: await opendClient.getPositions(accountId) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:getQuotes ───────────────────────────────────────────────
  ipcMain.handle('broker:getQuotes', async (_e, codes: string[]) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const quoteList = (!codes || codes.length === 0) ? WATCHLIST : codes;
      return { success: true, quotes: await opendClient.getQuotes(quoteList) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:subscribe ───────────────────────────────────────────────
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

  // ── broker:unsubscribe ───────────────────────────────────────────────
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

  // ── broker:getKlines ───────────────────────────────────────────────
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

  // ── broker:placeOrder ───────────────────────────────────────────────
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

  // ── broker:cancelOrder ───────────────────────────────────────────────
  ipcMain.handle('broker:cancelOrder', async (_e, orderId: string, accountId: string, code: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      await opendClient.cancelOrder(orderId, accountId, code);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:getOrders ───────────────────────────────────────────────
  ipcMain.handle('broker:getOrders', async (_e, accountId: string) => {
    if (!opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, orders: await opendClient.getOrders(accountId) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:list ───────────────────────────────────────────────
  // ── Broker Manager (Sprint1: multi-broker) ──────────────────────────
  ipcMain.handle('broker:list', async () => {
    return { success: true, brokers: brokerManager?.getConfigs() || [] };
  });

  // ── broker:add ───────────────────────────────────────────────
  ipcMain.handle('broker:add', async (_e, cfg: BrokerConfig) => {
    const vErr = validate(BrokerAddSchema, { cfg });
    if (vErr) return vErr;
    try {
      brokerManager?.addConfig(cfg);
      db?.saveBrokerConfig(cfg);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:remove ───────────────────────────────────────────────
  ipcMain.handle('broker:remove', async (_e, id: string) => {
    try {
      brokerManager?.removeConfig(id);
      db?.deleteBrokerConfig(id);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:setActive ───────────────────────────────────────────────
  ipcMain.handle('broker:setActive', async (_e, id: string) => {
    try {
      brokerManager?.setActiveBroker(id);
      return { success: true, activeBroker: id };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── broker:switch ───────────────────────────────────────────────
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

  // ── broker:getStatus ───────────────────────────────────────────────
  ipcMain.handle('broker:getStatus', async () => {
    return { success: true, status: brokerManager?.getStatus() || [] };
  });

  // ── signal:quality-score ───────────────────────────────────────────────
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── position:check ───────────────────────────────────────────────
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
