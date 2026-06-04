// ?? DAWN WHALES IPC: backtest ????????????????????????????????????????????
// Auto-split from main.ts ? 7 handlers

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
import { BacktestEngine } from '../engine/backtest-engine';
import { WalkForwardEngine } from '../engine/walk-forward';
import { ParameterScanner } from '../engine/parameter-scanner-v2';

export function registerBacktestIPC(
  backtestEngine: any
) { {

  ipcMain.handle('backtest:multiPeriod', async (_e, config: any) => {
    const vErr = validate(BacktestMultiPeriodSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const results = await enhancer.multiPeriodBacktest(
        config.klines, config.strategyConfig, config.periods
      );
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:paramSweep', async (_e, config: any) => {
    const vErr = validate(BacktestParamSweepSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const results = await enhancer.parameterSweep(
        config.klines, config.baseConfig, config.paramRanges, config.maxCombinations || 100
      );
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:riskMetrics', async (_e, equityCurve: number[], riskFreeRate?: number) => {
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const metrics = enhancer.computeDeepRiskMetrics(equityCurve, riskFreeRate || 0.03);
      return { success: true, metrics };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q64: Backtest Stability Checker ──────────────────────────────────
  ipcMain.handle('backtest:stability', async (_e, raw: unknown) => {
    try {
      const { isReturns, oosReturns, paramGridResults, walkForwardResults, isPeriodDays, oosPeriodDays, tradingDays } = raw as {
        isReturns: number[];
        oosReturns: number[];
        paramGridResults?: any[];
        walkForwardResults?: any[];
        isPeriodDays?: number;
        oosPeriodDays?: number;
        tradingDays?: number;
      };
      const { BacktestStabilityChecker } = await import('./engine/backtest-stability.js');
      const checker = new BacktestStabilityChecker();
      const result = checker.analyzeStability({ isReturns, oosReturns, paramGridResults, walkForwardResults, isPeriodDays, oosPeriodDays, tradingDays });
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Walk-Forward Analysis (Sprint 2 �?JVS) ───────────────────────────
  ipcMain.handle('backtest:walk-forward', async (_e, config: any) => {
    const vErr = validate(BacktestWalkForwardSchema, { config });
    if (vErr) return vErr;
    try {
      const wfa = new WalkForwardEngine();
      const klines = config.klines || [];
      if (klines.length < 100) {
        return { success: false, error: 'K线数据不�?(需至少100�?' };
      }
      const report = await wfa.run(config, klines);
      return { success: true, report };
    } catch (err: any) {
      log.error('[WFA] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Parameter Scanner (Sprint 2 �?JVS) ───────────────────────────────
  ipcMain.handle('backtest:param-scan', async (_e, config: any) => {
    const vErr = validate(BacktestParamScanSchema, { config });
    if (vErr) return vErr;
    try {
      const scanner = new ParameterScanner();
      const klines = config.klines || [];
      if (klines.length < 50) {
        return { success: false, error: 'K线数据不�?(需至少50�?' };
      }
      const report = await scanner.run({ ...config, klines });
      return { success: true, report };
    } catch (err: any) {
      log.error('[ParamScan] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-timeframe comparison (Sprint 2 �?JVS) ──────────────────────
  ipcMain.handle('backtest:multi-timeframe', async (_e, config: any) => {
    const vErr = validate(BacktestMultiTimeframeSchema, { config });
    if (vErr) return vErr;
    try {
      const engine = new BacktestEngine();
      const timeframes = config.timeframes || ['1m', '5m', '15m', '1h', 'daily'];
      const results: Record<string, any> = {};

      for (const tf of timeframes) {
        const klines = config.klinesByTimeframe?.[tf] || [];
        if (klines.length < 50) {
          results[tf] = { success: false, error: 'K线不�? };
          continue;
        }
        const btResult = await engine.run({
          symbol: config.symbol,
          initialCapital: config.initialCapital || 100000,
          commission: config.commission || 0.001,
          slippage: config.slippage || 0.0005,
          strategy: config.strategy,
          klines,
        });
        results[tf] = btResult;
      }

      return { success: true, results, timeframes };
    } catch (err: any) {
      log.error('[MultiTF] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

}
