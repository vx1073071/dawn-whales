// ── DAWN WHALES IPC: portfolio ────────────────────────────────────────────
// Auto-split from main.ts — 8 handlers
//
// Registered channels:
//   portfolio:optimize
//   portfolio:efficient-frontier
//   portfolio:risk-parity
//   portfolio:optimize-batch
//   portfolio:cost-analyze
//   portfolio:rar-optimize
//   portfolio:rebalance
//   portfolio:rebalance-kelly

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { batchOptimizePortfolios, generateEfficientFrontier, optimizePortfolio, riskParityPortfolio } from './engine/portfolio-optimizer';

/**
 * Register all portfolio IPC handlers
 *
 */
export function registerPortfolioIPC(
  
) {

  // ── portfolio:optimize ───────────────────────────────────────────────
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

  // ── portfolio:efficient-frontier ───────────────────────────────────────────────
  ipcMain.handle('portfolio:efficient-frontier', async (_e, assets: any[], points?: number, constraints?: any) => {
    try {
      const result = generateEfficientFrontier(assets, points, constraints);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Frontier error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── portfolio:risk-parity ───────────────────────────────────────────────
  ipcMain.handle('portfolio:risk-parity', async (_e, assets: any[], constraints?: any) => {
    try {
      const result = riskParityPortfolio(assets, constraints);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Risk parity error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── portfolio:optimize-batch ───────────────────────────────────────────────
  ipcMain.handle('portfolio:optimize-batch', async (_e, scenarios: any[]) => {
    try {
      const result = await batchOptimizePortfolios(scenarios);
      return { success: true, result };
    } catch (err: any) {
      log.error('[PortfolioOptimizer] Batch error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── portfolio:cost-analyze ───────────────────────────────────────────────
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

  // ── portfolio:rar-optimize ───────────────────────────────────────────────
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

  // ── portfolio:rebalance ───────────────────────────────────────────────
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

  // ── portfolio:rebalance-kelly ───────────────────────────────────────────────
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
