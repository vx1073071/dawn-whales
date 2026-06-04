// -- IPC Handlers: backtest (6 handlers) --

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { BacktestEngine } from '../engine/backtest-engine';
import { WalkForwardEngine } from '../engine/walk-forward';
import { ParameterScanner } from '../engine/parameter-scanner';
import { runParallelBacktests, runParameterScan, runWalkForwardParallel } from '../engine/parallel-backtest';
import { validate, BacktestMultiPeriodSchema, BacktestParamSweepSchema, BacktestRiskMetricsSchema, BacktestWalkForwardSchema, BacktestParamScanSchema, BacktestMultiTimeframeSchema } from '../ipc-schemas';
import log from 'electron-log';

export function registerBacktestHandlers() {

  ipcMain.handle('backtest:multiPeriod', async (_e, config: any) => {
      const vErr = validate(BacktestMultiPeriodSchema, { config });
      if (vErr) return vErr;
      try {
        const { BacktestEnhancer } = require('./engine/backtest-enhancer');
        const enhancer = new BacktestEnhancer(shared.backtestEngine);
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
        const enhancer = new BacktestEnhancer(shared.backtestEngine);
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
        const enhancer = new BacktestEnhancer(shared.backtestEngine);
        const metrics = enhancer.computeDeepRiskMetrics(equityCurve, riskFreeRate || 0.03);
        return { success: true, metrics };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('backtest:walk-forward', async (_e, config: any) => {
      const vErr = validate(BacktestWalkForwardSchema, { config });
      if (vErr) return vErr;
      try {
        const wfa = new WalkForwardEngine();
        const klines = config.klines || [];
        if (klines.length < 100) {
          return { success: false, error: 'K线数据不足 (需至少100根)' };
        }
        const report = await wfa.run(config, klines);
        return { success: true, report };
      } catch (err: any) {
        log.error('[WFA] Failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('backtest:param-scan', async (_e, config: any) => {
      const vErr = validate(BacktestParamScanSchema, { config });
      if (vErr) return vErr;
      try {
        const scanner = new ParameterScanner();
        const klines = config.klines || [];
        if (klines.length < 50) {
          return { success: false, error: 'K线数据不足 (需至少50根)' };
        }
        const report = await scanner.run({ ...config, klines });
        return { success: true, report };
      } catch (err: any) {
        log.error('[ParamScan] Failed:', err.message);
        return { success: false, error: err.message };
      }
    });


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
            results[tf] = { success: false, error: 'K线不足' };
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

  // ── Parallel Backtest (J2) ──────────────────────────────────────────
  ipcMain.handle('backtest:parallel', async (_e, config: any) => {
    try {
      const { configs, maxWorkers, timeout } = config;
      if (!configs || !Array.isArray(configs) || configs.length === 0) {
        return { success: false, error: 'configs must be a non-empty array' };
      }
      
      log.info(`[ParallelBacktest] Starting ${configs.length} backtests with maxWorkers=${maxWorkers || 4}`);
      const result = await runParallelBacktests({ configs, maxWorkers, timeout });
      
      log.info(`[ParallelBacktest] Done: ${result.successCount}/${configs.length} success, ${result.totalPerfMs.toFixed(1)}ms total`);
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[ParallelBacktest] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:param-scan-parallel', async (_e, config: any) => {
    try {
      const { baseConfig, paramRanges, maxWorkers } = config;
      if (!baseConfig || !paramRanges) {
        return { success: false, error: 'baseConfig and paramRanges are required' };
      }
      
      log.info('[ParamScanParallel] Starting parallel parameter scan');
      const result = await runParameterScan(baseConfig, paramRanges);
      
      log.info(`[ParamScanParallel] Done: ${result.successCount} success, ${result.totalPerfMs.toFixed(1)}ms total`);
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[ParamScanParallel] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backtest:walk-forward-parallel', async (_e, config: any) => {
    try {
      const { baseConfig, windows, maxWorkers } = config;
      if (!baseConfig || !windows || !Array.isArray(windows)) {
        return { success: false, error: 'baseConfig and windows array are required' };
      }
      
      log.info(`[WalkForwardParallel] Starting parallel walk-forward with ${windows.length} windows`);
      const result = await runWalkForwardParallel(baseConfig, windows);
      
      log.info(`[WalkForwardParallel] Done: ${result.successCount}/${windows.length} success, ${result.totalPerfMs.toFixed(1)}ms total`);
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[WalkForwardParallel] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

}
