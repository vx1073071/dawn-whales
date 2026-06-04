// ?? DAWN WHALES IPC: sentiment ????????????????????????????????????????????
// Auto-split from main.ts ? 8 handlers

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
import { getRealtimeSentimentStream } from '../engine/sentiment-stream';
import { getSentimentDashboard } from '../engine/sentiment-dashboard';

export function registerSentimentIPC(
  mainWindow: any,
  sentimentAttrEngine: any
) { {

  ipcMain.handle('sentiment:attribution', async (_e, params: any) => {
    try {
      const result = sentimentAttrEngine.attributeSentiment(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SentimentAttr] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Realtime Sentiment Stream (JVS-33) ─────────────────────────────────
  ipcMain.handle('sentiment:stream-start', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.start();
      
      // Forward ticks to renderer
      stream.on('tick', (tick) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sentiment:stream-tick', tick);
        }
      });
      
      // Forward alerts to renderer
      stream.on('alert', (alert) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sentiment:stream-alert', alert);
        }
      });
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-stop', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-status', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      const current = stream.getCurrentSentiment();
      return { success: true, current };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-history', async (_e, limit?: number) => {
    try {
      const stream = getRealtimeSentimentStream();
      const history = stream.getHistory();
      const limited = limit ? history.slice(-limit) : history;
      return { success: true, history: limited };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-alerts', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      const alerts = stream.getAlerts();
      return { success: true, alerts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sentiment:stream-clear-alerts', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.clearAlerts();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Dashboard API (JVS-36) ──────────────────────────────────
  ipcMain.handle('sentiment:dashboard', async () => {
    try {
      const dashboard = getSentimentDashboard();
      return { success: true, dashboard };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
