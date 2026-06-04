// ?? DAWN WHALES IPC: indicator ????????????????????????????????????????????
// Auto-split from main.ts ? 6 handlers

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
import { computeIndicators } from '../engine/technical-indicators';
import { getRealtimeIndicatorCalculator } from '../engine/realtime-indicators';

export function registerIndicatorIPC(
  _services: any
) {

  // ── Technical Indicators (JVS-43) ──────────────────────────────────────
  ipcMain.handle('indicator:compute', async (_e, klines: any[], indicators?: string[], options?: any) => {
    try {
      return computeIndicators(klines, indicators, options);
    } catch (err: any) {
      log.error('[TechnicalIndicators] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Realtime Technical Indicators (JVS-36) ─────────────────────────────
  ipcMain.handle('indicator:realtime-add', async (_e, symbol: string, kline: any) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, indicators: calculator.addKLine(symbol, kline) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Add error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('indicator:realtime-add-batch', async (_e, symbol: string, klines: any[]) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, indicators: calculator.addKLines(symbol, klines) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Batch add error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('indicator:realtime-get-buffer', async (_e, symbol: string) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      return { success: true, klines: calculator.getKLineBuffer(symbol) };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Get buffer error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('indicator:realtime-clear', async (_e, symbol: string) => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      calculator.clearBuffer(symbol);
      return { success: true };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Clear error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('indicator:realtime-clear-all', async () => {
    try {
      const calculator = getRealtimeIndicatorCalculator();
      calculator.clearAllBuffers();
      return { success: true };
    } catch (err: any) {
      log.error('[RealtimeIndicators] Clear all error:', err);
      return { success: false, error: err.message };
    }
  });

}
