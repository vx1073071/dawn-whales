// ?? DAWN WHALES IPC: portfolio ????????????????????????????????????????????
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
import { batchOptimizePortfolios, generateEfficientFrontier, optimizePortfolio, riskParityPortfolio } from '../engine/portfolio-optimizer';

export function registerPortfolioIPC(
  _services: any
) {

  // ── Portfolio Optimizer (JVS-57) ────────────────────────────────────────
  ipcMain.handle('portfolio:optimize', async (_e, assets: any[], constraints?: any) => {
    try {
      const result = optimizePortfolio(assets, constraints);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('portfolio:efficient-frontier', async (_e, assets: any[], points?: number, constraints?: any) => {
    try {
      const result = generateEfficientFrontier(assets, points, constraints);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Frontier error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('portfolio:risk-parity', async (_e, assets: any[], constraints?: any) => {
    try {
      const result = riskParityPortfolio(assets, constraints);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Risk parity error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('portfolio:optimize-batch', async (_e, scenarios: any[]) => {
    try {
      const result = await batchOptimizePortfolios(scenarios);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Batch error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Q56: Portfolio Cost Analytics ───────────────────────────────────────
  ipcMain.handle('portfolio:cost-analyze', async (_e, raw: unknown) => {
    try {
      const { positions, trades, periodDays } = raw as {
        positions: any[]; trades: any[]; periodDays?: number;
      };
      const { PortfolioCostAnalytics } = await import('./engine/portfolio-cost-analytics.js');
      const result = new PortfolioCostAnalytics().analyze(positions, trades, periodDays);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q54: RAR Optimizer ──────────────────────────────────────────────────
  ipcMain.handle('portfolio:rar-optimize', async (_e, raw: unknown) => {
    try {
      const { positions, marketData, riskAppetite, constraints } = raw as {
        positions: any[]; marketData?: any; riskAppetite?: string; constraints?: any;
      };
      const { RAROptimizer } = await import('./engine/rar-optimizer.js');
      const optimizer = new RAROptimizer();
      const result = await optimizer.optimize(positions, marketData, riskAppetite, constraints);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q22: Portfolio Rebalancer ────────────────────────────────────────────
  ipcMain.handle('portfolio:rebalance', async (_e, raw: unknown) => {
    try {
      const { positions, targetWeights, dryRun, driftThreshold, maxTurnover } = raw as {
        positions: any[]; targetWeights: Record<string, number>; dryRun?: boolean;
        driftThreshold?: number; maxTurnover?: number;
      };
      const { getPortfolioRebalancer } = await import('./engine/portfolio-rebalancer.js');
      const rebalancer = getPortfolioRebalancer();
      const result = await rebalancer.rebalance(positions, targetWeights, dryRun, driftThreshold, maxTurnover);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('portfolio:rebalance-kelly', async (_e, raw: unknown) => {
    try {
      const { positions, kellyFraction, maxTurnover } = raw as {
        positions: any[]; kellyFraction?: number; maxTurnover?: number;
      };
      const { getPortfolioRebalancer } = await import('./engine/portfolio-rebalancer.js');
      const rebalancer = getPortfolioRebalancer();
      const result = await rebalancer.kellyOptimize(positions, kellyFraction, maxTurnover);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
