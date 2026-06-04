// ?? DAWN WHALES IPC: ws ????????????????????????????????????????????
// Auto-split from main.ts ? 24 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from '../../node_modules/electron-log';
import { validate, 
  BrokerConnectSchema, BrokerGetFundsSchema, BrokerGetPositionsSchema,
  BrokerGetQuotesSchema, BrokerSubscribeSchema, BrokerGetKlinesSchema,
  BrokerPlaceOrderSchema, BrokerCancelOrderSchema,
  BrokerSwitchSchema, BrokerAddSchema,
  StrategyCreateSchema, StrategyUpdateSchema, StrategyGetSchema,
  StrategyBacktestSchema, BacktestMultiPeriodSchema,
  BacktestParamSweepSchema, BacktestRiskMetricsSchema,
  BacktestWalkForwardSchema, BacktestParamScanSchema,
  BacktestMultiTimeframeSchema,
  RiskUpdateConfigSchema, RiskUpdateVixSchema,
  DbSaveStrategySchema, DbSaveSettingsSchema, DbSaveWatchlistSchema,
  DbGetTradesSchema, DbGetBacktestResultsSchema, DbGetSignalsSchema,
  DbSaveFundamentalSchema, DbSaveCapitalFlowSchema,
  DbSaveRegimeSchema, DbSaveAnomalySchema, DbSaveNewsSchema,
  DataComputeRegimeSchema,
  MarketplaceRateSchema, MarketplaceCommentSchema,
  MarketplaceSavePerformanceSchema, MarketplaceListSchema,
  GreeksCalculateSchema, GreeksPortfolioSchema,
  DataNewsSchema, DataFundamentalSchema,
  DataCapitalFlowSchema, DataAnomaliesSchema,
  DataCompositeScoreSchema,
  NlParseSchema, StrategyExplainSchema,
  StrategyCompareSchema, StrategyOptimizeSchema,
  StrategyCorrelationSchema,
  NotificationGenerateSchema,
  ReportGenerateSchema, ReportQuickSchema,
  StrategyAutoTuneSchema,
} from '../ipc-schemas';

// Auto-imported dependencies:
import { getQuoteStream } from '../engine/quote-stream';
import { getMarketBreadth } from '../engine/market-breadth';
import { getPush2Proxy } from '../data/push2-proxy';
import { getWsDataStream } from '../data/ws-data-stream';
import { connectWebSocket, disconnectWebSocket, getStreamingStats, getWebSocketStatus, subscribeToSymbol, subscribeToSymbols, unsubscribeFromSymbol, unsubscribeFromSymbols } from '../engine/websocket-enhancer';

export function registerWsIPC(
  mainWindow: any
) { {

  // ── WebSocket Real-time Data Enhancer (JVS-58) ──────────────────────────
  ipcMain.handle('ws:connect', async (_e, config: any) => {
    try {
      const result = await connectWebSocket(config);
      return { success: result };
    } catch (err: any) {
      log.error('[WebSocket] Connect error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:disconnect', async () => {
    try {
      await disconnectWebSocket();
      return { success: true };
    } catch (err: any) {
      log.error('[WebSocket] Disconnect error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:subscribe', async (_e, symbol: string) => {
    try {
      const result = subscribeToSymbol(symbol);
      return { success: result };
    } catch (err: any) {
      log.error('[WebSocket] Subscribe error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:unsubscribe', async (_e, symbol: string) => {
    try {
      const result = unsubscribeFromSymbol(symbol);
      return { success: result };
    } catch (err: any) {
      log.error('[WebSocket] Unsubscribe error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:subscribe-batch', async (_e, symbols: string[]) => {
    try {
      const result = subscribeToSymbols(symbols);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WebSocket] Batch subscribe error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:unsubscribe-batch', async (_e, symbols: string[]) => {
    try {
      const result = unsubscribeFromSymbols(symbols);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WebSocket] Batch unsubscribe error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:status', async () => {
    try {
      const status = getWebSocketStatus();
      return { success: true, status };
    } catch (err: any) {
      log.error('[WebSocket] Status error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:streaming-stats', async () => {
    try {
      const stats = getStreamingStats();
      return { success: true, stats };
    } catch (err: any) {
      log.error('[WebSocket] Streaming stats error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Quote Stream �?Real-time Market Data (JVS-9) ─────────────────────
  ipcMain.handle('quote:stream-start', async (_e, symbols?: string[]) => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    try {
      if (symbols && symbols.length > 0) stream.subscribe(symbols);
      stream.start();
      return { success: true, status: stream.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('quote:stream-stop', async () => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    stream.stop();
    return { success: true };
  });

  ipcMain.handle('quote:stream-status', async () => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    return { success: true, status: stream.getStatus() };
  });

  ipcMain.handle('quote:subscribe', async (_e, symbols: string[]) => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    stream.subscribe(symbols);
    return { success: true, status: stream.getStatus() };
  });

  ipcMain.handle('quote:unsubscribe', async (_e, symbols: string[]) => {
    const stream = getQuoteStream();
    if (!stream) return { success: false, error: 'QuoteStream not initialized' };
    stream.unsubscribe(symbols);
    return { success: true, status: stream.getStatus() };
  });

  // ── Push2 Proxy Service (JVS-27) ─────────────────────────────────────────
  ipcMain.handle('push2:get-sector-heatmap', async (_e, type?: string, limit?: number) => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getSectorHeatmap(type as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:get-capital-flow-rank', async (_e, type?: string, limit?: number) => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getCapitalFlowRank(type as any, limit);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:get-stock-quote', async (_e, secid: string) => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getStockQuote(secid);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:get-market-breadth', async () => {
    try {
      const proxy = getPush2Proxy();
      const result = await proxy.getMarketBreadth();
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:proxy-status', async () => {
    try {
      const proxy = getPush2Proxy();
      return { success: true, status: proxy.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('push2:clear-cache', async () => {
    try {
      const proxy = getPush2Proxy();
      proxy.clearCache();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── WS Data Stream (JVS-29) ────────────────────────────────────────────
  ipcMain.handle('ws:start-stream', async (_e, config?: any) => {
    try {
      const stream = getWsDataStream();
      await stream.start();
      stream.on('tick', (tick) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ws:tick', tick);
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:stop-stream', async () => {
    try {
      getWsDataStream().stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:subscribe', async (_e, codes: string[]) => {
    try {
      getWsDataStream().subscribe(codes || []);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:unsubscribe', async (_e, codes: string[]) => {
    try {
      getWsDataStream().unsubscribe(codes || []);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ws:stream-status', async () => {
    try {
      return { success: true, status: getWsDataStream().getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
