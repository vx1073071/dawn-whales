// ?? DAWN WHALES IPC: report ????????????????????????????????????????????
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
import { generateBacktestReport, generateQuickReport } from '../engine/ai-report-generator';
import { generateBatchWalkForwardReport, generateWalkForwardReport } from '../engine/walk-forward-report';
import { generateBatchBrinsonReport, generateBrinsonReport } from '../engine/brinson-attribution';

export function registerReportIPC(
  _services: any
) {

  // ── Walk-Forward Report (JVS-53) ───────────────────────────────────────
  ipcMain.handle('report:walk-forward', async (_e, strategyName: string, windows: any[]) => {
    try {
      const result = generateWalkForwardReport(strategyName, windows);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WalkForwardReport] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('report:walk-forward-batch', async (_e, strategies: any[]) => {
    try {
      const result = await generateBatchWalkForwardReport(strategies);
      return { success: true, result };
    } catch (err: any) {
      log.error('[WalkForwardReportBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Brinson Attribution (JVS-54) ───────────────────────────────────────
  ipcMain.handle('report:brinson-attribution', async (_e, holdings: any[], benchmark: any[], benchmarkReturn: number) => {
    try {
      const result = generateBrinsonReport(holdings, benchmark, benchmarkReturn);
      return { success: true, result };
    } catch (err: any) {
      log.error('[BrinsonAttribution] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('report:brinson-batch', async (_e, portfolios: any[]) => {
    try {
      const result = await generateBatchBrinsonReport(portfolios);
      return { success: true, result };
    } catch (err: any) {
      log.error('[BrinsonAttributionBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── AI Report Generator ──────────────────────────────────────────────
  ipcMain.handle('report:generate', async (_e, raw: unknown) => {
    const vErr = validate(ReportGenerateSchema, raw);
    if (vErr) return vErr;
    const { results, symbol, apiKey, timeoutMs } = raw as {
      results: any[];
      symbol?: string;
      apiKey?: string;
      timeoutMs?: number;
    };
    const report = await generateBacktestReport(results, symbol, apiKey, timeoutMs ?? 20000);
    return { success: true, report };
  });

  ipcMain.handle('report:quick', async (_e, raw: unknown) => {
    const vErr = validate(ReportQuickSchema, raw);
    if (vErr) return vErr;
    const { result, apiKey } = raw as { result: any; apiKey?: string };
    const report = await generateQuickReport(result, apiKey);
    return { success: true, report };
  });

}
