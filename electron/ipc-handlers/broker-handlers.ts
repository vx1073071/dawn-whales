// ── IPC Handlers — Broker ───────────────────────────────────────────────────
// 所有 broker:* 相关的 IPC handlers
// 从 main.ts 拆分出来，约19个 handlers

import { ipcMain } from 'electron';
import { shared, validate } from './_import-shared';
import type { BrokerConfig } from '../broker/IBrokerAdapter';
import { FutuOpenDClient } from '../broker/futu-opend';
import log from 'electron-log';
import {
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
} from '../ipc-schemas';

export function registerBrokerHandlers() {
  // ── Broker: Multi-broker support (WP1 + Sprint1) ────────────────────
  ipcMain.handle('broker:connect', async (_e, config: { host: string; port: number; brokerId?: string }) => {
    const vErr = validate(BrokerConnectSchema, config);
    if (vErr) return vErr;
    
    try {
      // Use BrokerManager if available, fallback to legacy opendClient
      if (shared.brokerManager) {
        const brokerCfg: BrokerConfig = {
          id: config.brokerId || 'futu-default',
          name: config.brokerId || 'Futu OpenD',
          type: 'futu',
          host: config.host || '127.0.0.1',
          port: config.port || 11111,
          enabled: true,
        };
        shared.brokerManager.loadConfigs([brokerCfg]);
        await shared.brokerManager.connect(brokerCfg.id);
        const adapter = shared.brokerManager.getActiveBroker();
        adapter?.onQuotePush((quotes) => {
          shared.mainWindow?.webContents.send('quotes:push', quotes);
          shared.strategyEngine?.onQuoteUpdate(quotes);
        });
        // Load watchlist
        const savedWatchlist = shared.db?.getWatchlist();
        if (savedWatchlist && savedWatchlist.length > 0) {
          shared.WATCHLIST = savedWatchlist;
        }
        await shared.brokerManager.subscribeAndPush(brokerCfg.id, shared.WATCHLIST);
        log.info('[Broker] Multi-broker connected:', brokerCfg.id);
        return { success: true, brokerId: brokerCfg.id, host: config.host, port: config.port };
      }

      // Legacy single-broker path
      shared.opendClient = new FutuOpenDClient(config.host || '127.0.0.1', config.port || 11111);
      await shared.opendClient.connect();
      log.info('[Broker] OpenD connected');

      shared.opendClient.onQuotePush((quotes) => {
        shared.mainWindow?.webContents.send('quotes:push', quotes);
        shared.strategyEngine?.onQuoteUpdate(quotes);
      });
      const savedWatchlist = shared.db?.getWatchlist();
      if (savedWatchlist && savedWatchlist.length > 0) {
        shared.WATCHLIST = savedWatchlist;
        log.info('[Broker] Loaded watchlist from DB:', shared.WATCHLIST);
      }
      await shared.opendClient.subscribeAndPush(shared.WATCHLIST);
      log.info('[Broker] Push mode active');

      return { success: true, host: config.host, port: config.port };
    } catch (err: any) {
      log.error('[Broker] Connect failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:disconnect', async () => {
    shared.opendClient?.disconnect();
    shared.opendClient = null;
    return { success: true };
  });

  ipcMain.handle('broker:getAccounts', async () => {
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, accounts: await shared.opendClient.getAccounts() };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getFunds', async (_e, accountId: string) => {
    const vErr = validate(BrokerGetFundsSchema, { accountId });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const funds = await shared.opendClient.getFunds(accountId);
      shared.riskEngine?.updateTotalAssets(funds?.totalAssets || 0);
      return { success: true, funds };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getPositions', async (_e, accountId: string) => {
    const vErr = validate(BrokerGetPositionsSchema, { accountId });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, positions: await shared.opendClient.getPositions(accountId) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getQuotes', async (_e, codes: string[]) => {
    const vErr = validate(BrokerGetQuotesSchema, { codes });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      const quoteList = (!codes || codes.length === 0) ? shared.WATCHLIST : codes;
      return { success: true, quotes: await shared.opendClient.getQuotes(quoteList) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Subscribe / Unsubscribe (WP1: 动态监控列表) ────────────────────
  ipcMain.handle('broker:subscribe', async (_e, codes: string[]) => {
    const vErr = validate(BrokerSubscribeSchema, { codes });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      // Merge with existing watchlist, dedupe
      const merged = Array.from(new Set([...shared.WATCHLIST, ...codes]));
      shared.WATCHLIST = merged;
      await shared.opendClient.subscribeAndPush(shared.WATCHLIST);
      // Persist to DB
      shared.db?.saveWatchlist(shared.WATCHLIST);
      log.info('[Broker] Subscribed:', codes);
      return { success: true, watchlist: shared.WATCHLIST };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:unsubscribe', async (_e, codes: string[]) => {
    const vErr = validate(BrokerSubscribeSchema, { codes });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      shared.WATCHLIST = shared.WATCHLIST.filter((c) => !codes.includes(c));
      await shared.opendClient.subscribeAndPush(shared.WATCHLIST);
      shared.db?.saveWatchlist(shared.WATCHLIST);
      log.info('[Broker] Unsubscribed:', codes);
      return { success: true, watchlist: shared.WATCHLIST };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getKlines', async (_e, code: string, period: string, count: number) => {
    const vErr = validate(BrokerGetKlinesSchema, { code, period, count });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      // Check cache first
      const cached = shared.db?.getKlines(code, period || 'daily', count || 200);
      if (cached && cached.length > 0) {
        return { success: true, klines: cached, cached: true };
      }
      const klines = await shared.opendClient.getKlines(code, period || 'daily', count || 200);
      // Cache for future use
      if (klines.length > 0 && shared.db) {
        shared.db.saveKlines(code, period || 'daily', klines);
      }
      return { success: true, klines };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Order Placement (with input validation) ─────────────────────────
  ipcMain.handle('broker:placeOrder', async (_e, order: any) => {
    const vErr = validate(BrokerPlaceOrderSchema, { order });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    
    const riskResult = shared.riskEngine?.checkOrder(order);
    if (riskResult && !riskResult.pass) {
      shared.mainWindow?.webContents.send('risk-alert', { order, reason: riskResult.reason });
      return { success: false, error: `风控拦截: ${riskResult.reason}` };
    }
    try {
      const result = await shared.opendClient.placeOrder(order);
      shared.db?.saveTrade({ ...order, orderId: result.orderId, status: 'submitted' });
      shared.mainWindow?.webContents.send('order-update', { ...order, orderId: result.orderId, status: 'submitted' });
      return { success: true, ...result };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:cancelOrder', async (_e, orderId: string, accountId: string, code: string) => {
    const vErr = validate(BrokerCancelOrderSchema, { orderId, accountId, code });
    if (vErr) return vErr;
    
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      await shared.opendClient.cancelOrder(orderId, accountId, code);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:getOrders', async (_e, accountId: string) => {
    if (!shared.opendClient?.connected) return { success: false, error: 'Not connected' };
    try {
      return { success: true, orders: await shared.opendClient.getOrders(accountId) };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Broker Manager (Sprint1: multi-broker) ──────────────────────────
  ipcMain.handle('broker:list', async () => {
    return { success: true, brokers: shared.brokerManager?.getConfigs() || [] };
  });

  ipcMain.handle('broker:add', async (_e, cfg: BrokerConfig) => {
    const vErr = validate(BrokerAddSchema, { cfg });
    if (vErr) return vErr;
    try {
      shared.brokerManager?.addConfig(cfg);
      shared.db?.saveBrokerConfig(cfg);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:remove', async (_e, id: string) => {
    try {
      shared.brokerManager?.removeConfig(id);
      shared.db?.deleteBrokerConfig(id);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('broker:setActive', async (_e, id: string) => {
    try {
      shared.brokerManager?.setActiveBroker(id);
      return { success: true, activeBroker: id };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  // ── Broker Switching (Sprint1) ───────────────────────────────────────
  ipcMain.handle('broker:switch', async (_e, id: string) => {
    const vErr = validate(BrokerSwitchSchema, { id });
    if (vErr) return vErr;
    try {
      const adapter = shared.brokerManager?.getAdapters().get(id);
      if (!adapter) {
        // Broker not yet connected — connect first
        const config = shared.brokerManager?.getConfigs().find((c: any) => c.id === id);
        if (!config) return { success: false, error: `Broker config not found: ${id}` };

        shared.brokerManager?.loadConfigs([config]);
        await shared.brokerManager?.connect(id);
      } else if (!adapter.connected) {
        await adapter.connect();
      }

      shared.brokerManager?.setActiveBroker(id);
      const activeId = shared.brokerManager?.getActiveBrokerId();
      const activeAdapter = shared.brokerManager?.getActiveBroker();

      // Re-subscribe quotes for the newly active broker
      if (activeAdapter) {
        activeAdapter.onQuotePush((quotes) => {
          shared.mainWindow?.webContents.send('quotes:push', quotes);
          shared.strategyEngine?.onQuoteUpdate(quotes);
        });
        const savedWatchlist = shared.db?.getWatchlist();
        await activeAdapter.subscribeAndPush(savedWatchlist && savedWatchlist.length > 0 ? savedWatchlist : shared.WATCHLIST);
      }

      const status = shared.brokerManager?.getStatus() || [];
      const switched = status.find((s: any) => s.id === activeId);

      log.info(`[Broker] Switched to ${id}, connected=${switched?.connected}`);
      shared.mainWindow?.webContents.send('broker:switched', { activeBroker: activeId, status });
      return { success: true, activeBroker: activeId, brokerStatus: switched };
    } catch (err: any) {
      log.error('[Broker] Switch failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('broker:getStatus', async () => {
    return { success: true, status: shared.brokerManager?.getStatus() || [] };
  });
}
