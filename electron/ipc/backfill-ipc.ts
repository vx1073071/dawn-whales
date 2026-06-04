// ?? DAWN WHALES IPC: backfill ????????????????????????????????????????????
// Auto-split from main.ts ? 6 handlers

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
import { backfillSymbols, getBackfillStats, getBackfillStatus, incrementalBackfill, startBackfill, stopBackfill } from '../engine/backfill-service';

export function registerBackfillIPC(
  _services: any
) {

  // ── Backfill Service (JVS-59) ───────────────────────────────────────────
  ipcMain.handle('backfill:start', async (_e, config: any) => {
    try {
      const result = await startBackfill(config);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Backfill] Start error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backfill:stop', async () => {
    try {
      stopBackfill();
      return { success: true };
    } catch (err: any) {
      log.error('[Backfill] Stop error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backfill:status', async () => {
    try {
      const status = getBackfillStatus();
      return { success: true, status };
    } catch (err: any) {
      log.error('[Backfill] Status error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backfill:stats', async () => {
    try {
      const stats = getBackfillStats();
      return { success: true, stats };
    } catch (err: any) {
      log.error('[Backfill] Stats error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backfill:symbols', async (_e, symbols: string[], startDate: string, endDate: string, interval?: any) => {
    try {
      const result = await backfillSymbols(symbols, startDate, endDate, interval);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Backfill] Symbols backfill error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backfill:incremental', async (_e, symbol: string, startDate: string, endDate: string, existingRecords: any[]) => {
    try {
      const result = await incrementalBackfill(symbol, startDate, endDate, existingRecords);
      return { success: true, result };
    } catch (err: any) {
      log.error('[Backfill] Incremental backfill error:', err);
      return { success: false, error: err.message };
    }
  });

}
