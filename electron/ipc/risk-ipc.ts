// ── DAWN WHALES IPC: risk ────────────────────────────────────────────
// 17 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerRiskIPC(
  unifiedRiskDash: unknown,
  riskEngine: unknown) {

  ipcMain.handle('risk:dashboard', async (_e, params?: unknown) => {
    try {
      const result = unifiedRiskDash.generate(params);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      log.error('[RiskDashboard] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Valuation Dashboard (JVS-49) ────────────────────────────────────────


  // ── Q57: Cross-Asset Risk ───────────────────────────────────────────────
  ipcMain.handle('risk:cross-asset', async (_e, raw: unknown) => {
    try {
      const { portfolios, confidenceLevel, method } = raw as {
        portfolios: unknown[]; confidenceLevel?: number; method?: string;
      };
      const { CrossAssetRiskEngine } = await import('./engine/cross-asset-risk.js');
      const engine = new CrossAssetRiskEngine();
      const result = engine.calculatePortfolioVaR(portfolios, confidenceLevel, method);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q20: Real Trader ─────────────────────────────────────────────────────


  // ── Q9: Strategy Risk Decomposition ──────────────────────────────────
  ipcMain.handle('risk:decompose', async (_e, raw: unknown) => {
    try {
      const { equityCurve, positions, confidenceLevel } = raw as {
        equityCurve: number[];
        positions?: unknown[];
        confidenceLevel?: number;
      };
      if (!equityCurve || equityCurve.length < 20) {
        return { success: false, error: 'At least 20 equity curve data points required' };
      }
      const result = decomposeRisk(equityCurve, positions, confidenceLevel ?? 0.95);
      return { success: true, decomposition: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('risk:monteCarlo', async (_e, raw: unknown) => {
    try {
      const { equityCurve, paths, horizon } = raw as {
        equityCurve: number[];
        paths?: number;
        horizon?: number;
      };
      if (!equityCurve || equityCurve.length < 20) {
        return { success: false, error: 'At least 20 data points required' };
      }
      const result = runMonteCarlo(equityCurve, paths ?? 10000, horizon ?? 252);
      return { success: true, simulation: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q10: Real-time Anomaly Detection ─────────────────────────────────


  // ── Q16: Dynamic Position Sizer ────────────────────────────────
  ipcMain.handle('risk:position-size', async (_e, raw: unknown) => {
    try {
      const { calcPositionSize, calcQuickSize, calcPortfolioSizes } = require('./engine/dynamic-sizer');
      const req = raw as unknown;
      if (req.strategies != null) {
        // Portfolio mode
        const result = await calcPortfolioSizes(req);
        return { success: true, ...result };
      }
      if (req.equity == null || req.winRate == null || req.avgWin == null || req.avgLoss == null) {
        return { success: false, error: 'equity, winRate, avgWin, avgLoss required' };
  // ── Q16: Dynamic Position Sizer ──────────────────────


  // ── Q16: Dynamic Position Sizer ──────────────────────

  ipcMain.handle('risk:calculate-size', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as unknown;

      const result = await sizer.calculateSize(req);

      return { success: true, ...result };

    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('risk:calculate-portfolio-sizes', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as unknown;

      const result = await sizer.calculatePortfolioSizes(req);

      return { success: true, ...result };

    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('risk:record-trade', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const trade = raw as unknown;

      sizer.recordTrade(trade);

      return { success: true };

    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking

      return { success: false, error: err.message };

    }

  });







  ipcMain.handle('risk:get-trade-history', async (_e, strategyId?: string) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const history = sizer.getTradeHistory(strategyId);

      const winRate = sizer.getWinRate(strategyId);

      return { success: true, history, winRate };

    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking

      return { success: false, error: err.message };

    }

  });



      }
      if (req.quick != null) {
        return { success: true, ...calcQuickSize(req) };
      }
      const result = await calcPositionSize(req);
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q15: Multi-Factor Model ─────────────────────────────────────


  // ── Q12: Stress Tester ────────────────────────────────────────────
  ipcMain.handle('risk:stress-test', async (_e, raw: unknown) => {
    try {
      const { runStressTest, runCustomShock, HISTORICAL_SCENARIOS } = require('./engine/stress-tester');
      const { positions, scenarioName, customFactors, portfolio } = raw as {
        positions: unknown[];
        scenarioName?: string;
        customFactors?: unknown[];
        portfolio?: { totalValue: number; dailyVol: number };
      };
      if (!positions || positions.length === 0) {
        return { success: false, error: 'At least one position required' };
      }
      let result;
      if (customFactors) {
        result = runCustomShock(positions, customFactors, portfolio ?? { totalValue: 0, dailyVol: 0.02 });
      } else {
        const scenario = HISTORICAL_SCENARIOS.find((s: unknown) => s.name === scenarioName);
        if (!scenario) {
          return { success: false, error: 'Scenario not found: ' + scenarioName + '. Available: ' + HISTORICAL_SCENARIOS.map((s: unknown) => s.name).join(', ') };
        }
        result = runStressTest(positions, scenario);
      }
      return { success: true, ...result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Q13: Backtest Comparator ──────────────────────────────────────


  // ── Risk Engine ─────────────────────────────────────────────────────
  ipcMain.handle('risk:getConfig', async () => {
    return { success: true, config: riskEngine?.getConfig() };
  });



  ipcMain.handle('risk:updateConfig', async (_e, config: unknown) => {
    riskEngine?.updateConfig(config);
    return { success: true };
  });



  ipcMain.handle('risk:getAlerts', async () => {
    return { success: true, alerts: riskEngine?.getAlerts() || [] };
  });

  // v2: Risk engine status snapshot (for risk dashboard UI)


  // v2: Risk engine status snapshot (for risk dashboard UI)
  ipcMain.handle('risk:getStatusSnapshot', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, snapshot: riskEngine.getStatusSnapshot() };
  });



  ipcMain.handle('risk:getKellyStats', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, kelly: riskEngine.getKellyStats() };
  });



  ipcMain.handle('risk:getDrawdownState', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, drawdown: riskEngine.getDrawdownState() };
  });



  ipcMain.handle('risk:updateVix', async (_e, vix: number) => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    riskEngine.updateVix(vix);
    return { success: true };
  });

  // ── JVS-45: Portfolio Risk Calculator ──────────────────────────────────
  ipcMain.handle('risk:portfolio-calculate', async (_e, raw: unknown) => {
    try {
      const { positions, historicalReturns, config } = raw as {
        positions: unknown[];
        historicalReturns?: Map<string, number[]>;
        config?: unknown;
      };
      if (!positions || positions.length === 0) {
        return { success: false, error: 'At least one position required' };
      }
      const { getPortfolioRiskCalculator } = await import('../engine/portfolio-risk-calculator');
      const calculator = getPortfolioRiskCalculator(config);
      const result = calculator.calculate(positions, historicalReturns);
      return { success: true, result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

  // ── Database ────────────────────────────────────────────────────────

}
