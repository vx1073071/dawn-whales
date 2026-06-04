// ?? DAWN WHALES IPC: snapshot ????????????????????????????????????????????
// Auto-split from main.ts ? 12 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from '../../node_modules/electron-log';
import { validate, z, 
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
import { captureSnapshot, cleanupOldSnapshots, clearAllSnapshots, compareSnapshots, deleteSnapshot, exportSnapshots, getLatestSnapshot, getSnapshot, getSnapshotStats, getSnapshotTimeline, importSnapshots, querySnapshots } from '../engine/snapshot-service';

export function registerSnapshotIPC(
  _services: any
) {

  // ── JVS-39: Data Snapshot Service ──────────────────────────────────────
  ipcMain.handle('snapshot:capture', async (_e, type: string, category: string, data: any, metadata?: any) => {
    try {
      const snapshot = await captureSnapshot(type, category, data, metadata);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:query', async (_e, query: any) => {
    try {
      const snapshots = await querySnapshots(query);
      return { success: true, snapshots };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:get', async (_e, id: string) => {
    try {
      const snapshot = await getSnapshot(id);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:compare', async (_e, id1: string, id2: string) => {
    try {
      const comparison = await compareSnapshots(id1, id2);
      return { success: true, comparison };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:timeline', async (_e, category: string, limit?: number) => {
    try {
      const timeline = await getSnapshotTimeline(category, limit);
      return { success: true, timeline };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:latest', async (_e, category: string) => {
    try {
      const snapshot = await getLatestSnapshot(category);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:cleanup', async (_e, daysOld?: number) => {
    try {
      const deleted = await cleanupOldSnapshots(daysOld);
      return { success: true, deleted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:export', async (_e, query?: any) => {
    try {
      const json = await exportSnapshots(query);
      return { success: true, json };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:import', async (_e, jsonString: string) => {
    try {
      const imported = await importSnapshots(jsonString);
      return { success: true, imported };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:stats', async () => {
    try {
      const stats = getSnapshotStats();
      return { success: true, stats };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:delete', async (_e, id: string) => {
    try {
      const deleted = await deleteSnapshot(id);
      return { success: true, deleted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshot:clear', async () => {
    try {
      await clearAllSnapshots();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
