// ?? DAWN WHALES IPC: system ????????????????????????????????????????????
// Auto-split from main.ts ? 1 handlers

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

export function registerSystemIPC(
  _services: any
) {

  // ── Q19: OpenD Health Check ─────────────────────────────────
  ipcMain.handle('system:opend-health', async (_e, raw: unknown) => {
    try {
      const { runOpenDHealthCheck, pingOpenD } = require('./engine/opend-health-check');
      const req = raw as { action?: string; host?: string; port?: number };
      if (req?.action === 'ping') {
        const result = await pingOpenD(req.host ?? '127.0.0.1', req.port ?? 11111);
        return { success: true, ...result };
      }
      const result = await runOpenDHealthCheck(req as any);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
