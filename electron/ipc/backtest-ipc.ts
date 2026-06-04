// ── DAWN WHALES IPC: backtest ────────────────────────────────────────────
// 7 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerBacktestIPC(
  backtestEngine: any
) {


  // ── Backtest Enhancement (Sprint 2: P1) ──────────────────────────

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

  // NOTE: backtest:walk-forward is defined below (line ~980) using JVS WalkForwardEngine.
  // The old backtest:walkForward handler has been removed to avoid duplicate registration.



  // NOTE: backtest:walk-forward is defined below (line ~980) using JVS WalkForwardEngine.
  // The old backtest:walkForward handler has been removed to avoid duplicate registration.

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

  // ── Strategy AI — LLM-powered (Sprint 2 P1) ─────────────────────


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

  // ── Q63: Signal Quality Scorer ───────────────────────────────────────


  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────
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

  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────


  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────
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

  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────


  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────
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

  // ── Q14: Live Executor ──────────────────────────────────────────────

}
