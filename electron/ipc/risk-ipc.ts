// ── DAWN WHALES IPC: risk ────────────────────────────────────────────
// Auto-split from main.ts — 17 handlers
//
// Registered channels:
//   risk:dashboard
//   risk:cross-asset
//   risk:decompose
//   risk:monteCarlo
//   risk:position-size
//   risk:calculate-size
//   risk:calculate-portfolio-sizes
//   risk:record-trade
//   risk:get-trade-history
//   risk:stress-test
//   risk:getConfig
//   risk:updateConfig
//   risk:getAlerts
//   risk:getStatusSnapshot
//   risk:getKellyStats
//   risk:getDrawdownState
//   risk:updateVix

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { RiskEngine } from './engine/risk-engine';
import { decomposeRisk, runMonteCarlo } from './engine/risk-decomposition';
import { HISTORICAL_SCENARIOS, runCustomShock, runStressTest } from './engine/stress-tester';

/**
 * Register all risk IPC handlers
 *
 * @param riskEngine - service reference
 * @param snapshot - service reference
 */
export function registerRiskIPC(
  riskEngine: any,
  snapshot: any
) {

  // ── risk:dashboard ───────────────────────────────────────────────
  ipcMain.handle('risk:dashboard', async (_e, params?: any) => {
    try {
      const result = unifiedRiskDash.generate(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[RiskDashboard] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── risk:cross-asset ───────────────────────────────────────────────
  // ── Q57: Cross-Asset Risk ───────────────────────────────────────────────
  ipcMain.handle('risk:cross-asset', async (_e, raw: unknown) => {
    try {
      const { portfolios, confidenceLevel, method } = raw as {
        portfolios: any[]; confidenceLevel?: number; method?: string;
      };
      const { CrossAssetRiskEngine } = await import('./engine/cross-asset-risk.js');
      const engine = new CrossAssetRiskEngine();
      const result = engine.calculatePortfolioVaR(portfolios, confidenceLevel, method);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── risk:decompose ───────────────────────────────────────────────
  // ── Q9: Strategy Risk Decomposition ──────────────────────────────────
  ipcMain.handle('risk:decompose', async (_e, raw: unknown) => {
    try {
      const { equityCurve, positions, confidenceLevel } = raw as {
        equityCurve: number[];
        positions?: any[];
        confidenceLevel?: number;
      };
      if (!equityCurve || equityCurve.length < 20) {
        return { success: false, error: 'At least 20 equity curve data points required' };
      }
      const result = decomposeRisk(equityCurve, positions, confidenceLevel ?? 0.95);
      return { success: true, decomposition: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── risk:monteCarlo ───────────────────────────────────────────────
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── risk:position-size ───────────────────────────────────────────────
  // ── Q16: Dynamic Position Sizer ────────────────────────────────
  ipcMain.handle('risk:position-size', async (_e, raw: unknown) => {
    try {
      const { calcPositionSize, calcQuickSize, calcPortfolioSizes } = require('./engine/dynamic-sizer');
      const req = raw as any;
      if (req.strategies != null) {
        // Portfolio mode
        const result = await calcPortfolioSizes(req);
        return { success: true, ...result };
      }
      if (req.equity == null || req.winRate == null || req.avgWin == null || req.avgLoss == null) {
        return { success: false, error: 'equity, winRate, avgWin, avgLoss required' };
  // ── Q16: Dynamic Position Sizer ──────────────────────

  ipcMain.handle('risk:calculate-size', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as any;

      const result = await sizer.calculateSize(req);

      return { success: true, ...result };

    } catch (err: any) {

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

      const req = raw as any;

      const result = await sizer.calculatePortfolioSizes(req);

      return { success: true, ...result };

    } catch (err: any) {

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

      const trade = raw as any;

      sizer.recordTrade(trade);

      return { success: true };

    } catch (err: any) {

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

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });



      }
      if (req.quick != null) {
        return { success: true, ...calcQuickSize(req) };
      }
      const result = await calcPositionSize(req);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── risk:calculate-size ───────────────────────────────────────────────
  ipcMain.handle('risk:calculate-size', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as any;

      const result = await sizer.calculateSize(req);

      return { success: true, ...result };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── risk:calculate-portfolio-sizes ───────────────────────────────────────────────
  ipcMain.handle('risk:calculate-portfolio-sizes', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const req = raw as any;

      const result = await sizer.calculatePortfolioSizes(req);

      return { success: true, ...result };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── risk:record-trade ───────────────────────────────────────────────
  ipcMain.handle('risk:record-trade', async (_e, raw: unknown) => {

    try {

      const { getDynamicSizer } = require('./engine/dynamic-sizer');

      const sizer = getDynamicSizer();

      if (!sizer) {

        return { success: false, error: 'DynamicSizer not initialized' };

      }

      const trade = raw as any;

      sizer.recordTrade(trade);

      return { success: true };

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── risk:get-trade-history ───────────────────────────────────────────────
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

    } catch (err: any) {

      return { success: false, error: err.message };

    }

  });

  // ── risk:stress-test ───────────────────────────────────────────────
  // ── Q12: Stress Tester ────────────────────────────────────────────
  ipcMain.handle('risk:stress-test', async (_e, raw: unknown) => {
    try {
      const { runStressTest, runCustomShock, HISTORICAL_SCENARIOS } = require('./engine/stress-tester');
      const { positions, scenarioName, customFactors, portfolio } = raw as {
        positions: any[];
        scenarioName?: string;
        customFactors?: any[];
        portfolio?: { totalValue: number; dailyVol: number };
      };
      if (!positions || positions.length === 0) {
        return { success: false, error: 'At least one position required' };
      }
      let result;
      if (customFactors) {
        result = runCustomShock(positions, customFactors, portfolio ?? { totalValue: 0, dailyVol: 0.02 });
      } else {
        const scenario = HISTORICAL_SCENARIOS.find((s: any) => s.name === scenarioName);
        if (!scenario) {
          return { success: false, error: 'Scenario not found: ' + scenarioName + '. Available: ' + HISTORICAL_SCENARIOS.map((s: any) => s.name).join(', ') };
        }
        result = runStressTest(positions, scenario);
      }
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── risk:getConfig ───────────────────────────────────────────────
  // ── Risk Engine ─────────────────────────────────────────────────────
  ipcMain.handle('risk:getConfig', async () => {
    return { success: true, config: riskEngine?.getConfig() };
  });

  // ── risk:updateConfig ───────────────────────────────────────────────
  ipcMain.handle('risk:updateConfig', async (_e, config: any) => {
    riskEngine?.updateConfig(config);
    return { success: true };
  });

  // ── risk:getAlerts ───────────────────────────────────────────────
  ipcMain.handle('risk:getAlerts', async () => {
    return { success: true, alerts: riskEngine?.getAlerts() || [] };
  });

  // ── risk:getStatusSnapshot ───────────────────────────────────────────────
  // v2: Risk engine status snapshot (for risk dashboard UI)
  ipcMain.handle('risk:getStatusSnapshot', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, snapshot: riskEngine.getStatusSnapshot() };
  });

  // ── risk:getKellyStats ───────────────────────────────────────────────
  ipcMain.handle('risk:getKellyStats', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, kelly: riskEngine.getKellyStats() };
  });

  // ── risk:getDrawdownState ───────────────────────────────────────────────
  ipcMain.handle('risk:getDrawdownState', async () => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, drawdown: riskEngine.getDrawdownState() };
  });

  // ── risk:updateVix ───────────────────────────────────────────────
  ipcMain.handle('risk:updateVix', async (_e, vix: number) => {
    if (!riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    riskEngine.updateVix(vix);
    return { success: true };
  });

}
