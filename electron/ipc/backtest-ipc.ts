// ── DAWN WHALES IPC: backtest ────────────────────────────────────────────
// 7 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';
import i18n from '../../src/i18n';

export function registerBacktestIPC(
  backtestEngine: unknown) {


  // ── Backtest Enhancement (Sprint 2: P1) ──────────────────────────

  ipcMain.handle('backtest:multiPeriod', async (_e, config: unknown) => {
    const vErr = validate(BacktestMultiPeriodSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const results = await enhancer.multiPeriodBacktest(
        config.klines, config.strategyConfig, config.periods
      );
      return { success: true, results };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('backtest:paramSweep', async (_e, config: unknown) => {
    const vErr = validate(BacktestParamSweepSchema, { config });
    if (vErr) return vErr;
    try {
      const { BacktestEnhancer } = require('./engine/backtest-enhancer');
      const enhancer = new BacktestEnhancer(backtestEngine);
      const results = await enhancer.parameterSweep(
        config.klines, config.baseConfig, config.paramRanges, config.maxCombinations || 100
      );
      return { success: true, results };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
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
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
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
        paramGridResults?: unknown[];
        walkForwardResults?: unknown[];
        isPeriodDays?: number;
        oosPeriodDays?: number;
        tradingDays?: number;
      };
      const { BacktestStabilityChecker } = await import('../engine/backtest-stability.js');
      const checker = new BacktestStabilityChecker();
      const result = checker.analyzeStability({ isReturns, oosReturns, paramGridResults, walkForwardResults, isPeriodDays, oosPeriodDays, tradingDays });
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q63: Signal Quality Scorer ───────────────────────────────────────


  // ── Walk-Forward Analysis (Sprint 2 — JVS) ───────────────────────────
  ipcMain.handle('backtest:walk-forward', async (_e, config: unknown) => {
    const vErr = validate(BacktestWalkForwardSchema, { config });
    if (vErr) return vErr;
    try {
      const wfa = new WalkForwardEngine();
      const klines = config.klines || [];
      if (klines.length < 100) {
        return { success: false, error: i18n.t('BacktestIpc.k0') };
      }
      const report = await wfa.run(config, klines);
      return { success: true, report };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[WFA] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────


  // ── Parameter Scanner (Sprint 2 — JVS) ───────────────────────────────
  ipcMain.handle('backtest:param-scan', async (_e, config: unknown) => {
    const vErr = validate(BacktestParamScanSchema, { config });
    if (vErr) return vErr;
    try {
      const scanner = new ParameterScanner();
      const klines = config.klines || [];
      if (klines.length < 50) {
        return { success: false, error: i18n.t('BacktestIpc.k1') };
      }
      const report = await scanner.run({ ...config, klines });
      return { success: true, report };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ParamScan] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────


  // ── Multi-timeframe comparison (Sprint 2 — JVS) ──────────────────────
  ipcMain.handle('backtest:multi-timeframe', async (_e, config: unknown) => {
    const vErr = validate(BacktestMultiTimeframeSchema, { config });
    if (vErr) return vErr;
    try {
      const engine = new BacktestEngine();
      const timeframes = config.timeframes || ['1m', '5m', '15m', '1h', 'daily'];
      const results: Record<string, unknown> = {};

      for (const tf of timeframes) {
        const klines = config.klinesByTimeframe?.[tf] || [];
        if (klines.length < 50) {
          results[tf] = { success: false, error: i18n.t('BacktestIpc.k2') };
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
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[MultiTF] Failed:', err.message);
      return { success: false, error: err.message };
    }
  });

    // ── walkForward (alias for backtest:walk-forward) ─────────────────────
  ipcMain.handle('backtest:walkForward', async (_e, config: unknown) => {
    // Delegates to the main.ts inline backtest:walk-forward handler
    // This stub ensures the preload call resolves even if main.ts hasn't
    // registered the handler yet (registration order issue)
    const WalkForwardEngine = (global as unknown).__walkForwardEngine;
    if (WalkForwardEngine) {
      try {
        const result = await WalkForwardEngine.run(config);
        return { success: true, result };
      } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'WalkForwardEngine not initialized' };
  });

  // ── parallel — parallel backtest execution ───────────────────────────
  ipcMain.handle('backtest:parallel', async (_e, configs: unknown[]) => {
    if (!Array.isArray(configs) || configs.length === 0) {
      return { success: false, error: 'configs must be non-empty array' };
    }
    const results = await Promise.allSettled(
      configs.map(cfg => backtestEngine ? backtestEngine.run(cfg) : Promise.reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, 'No engine')))
    );
    return {
      success: true,
      results: results.map((r, i) =>
        r.status === 'fulfilled' ? { index: i, ...(r.value as unknown) } : { index: i, error: (r as unknown).reason?.message }
      ),
    };
  });

  // ── param-scan-parallel ───────────────────────────────────────────────
  ipcMain.handle('backtest:param-scan-parallel', async (_e, config: unknown) => {
    const { paramGrid, baseConfig } = config || {};
    if (!paramGrid || !baseConfig) {
      return { success: false, error: 'paramGrid and baseConfig required' };
    }
    const keys = Object.keys(paramGrid);
    const combos = keys.reduce((acc: unknown[][], k) => {
      const vals = Array.isArray(paramGrid[k]) ? paramGrid[k] : [paramGrid[k]];
      return acc.length === 0 ? vals.map(v => ({ [k]: v })) :
        acc.flatMap(o => vals.map(v => ({ ...o, [k]: v })));
    }, []);
    const results = await Promise.allSettled(
      combos.map(combo => {
        const cfg = { ...baseConfig, ...combo };
        return backtestEngine ? backtestEngine.run(cfg) : Promise.reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, 'No engine'));
      })
    );
    const metrics = results.map((r, i) => ({
      params: combos[i],
      ...(r.status === 'fulfilled' ? (r.value as unknown) : { error: (r as unknown).reason?.message }),
    }));
    // Find best by Sharpe
    const valid = metrics.filter(m => m.sharpe !== undefined);
    if (valid.length > 0) {
      valid.sort((a, b) => (b.sharpe as number) - (a.sharpe as number));
    }
    return { success: true, results: metrics, best: valid[0] || null, total: combos.length };
  });

  // ── walk-forward-parallel ─────────────────────────────────────────────
  ipcMain.handle('backtest:walk-forward-parallel', async (_e, config: unknown, numWindows?: number, trainRatio?: number) => {
    const WalkForwardEngine = (global as unknown).__walkForwardEngine;
    if (!WalkForwardEngine) {
      return { success: false, error: 'WalkForwardEngine not available' };
    }
    const engine = new WalkForwardEngine();
    try {
      const result = await engine.run({ ...config, numWindows: numWindows || 5, trainRatio: trainRatio || 0.7 });
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

}

