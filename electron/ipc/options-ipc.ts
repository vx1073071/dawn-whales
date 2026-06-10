// ── DAWN WHALES IPC: options ────────────────────────────────────────────
// 6 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerOptionsIPC(
  calcGreeksJS: unknown) {


  // ── Options Chain Analyzer (JVS-55) ─────────────────────────────────
  ipcMain.handle('options:chain-analyze', async (_e, contracts: unknown[], symbol: string, historicalIVRange?: unknown) => {
    try {
      const result = analyzeOptionsChain(contracts, symbol, historicalIVRange);
      return { success: true, result };
    } catch (err) {
      log.error('[OptionsChain] Error:', err);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('options:chain-batch', async (_e, symbols: unknown[]) => {
    try {
      const result = await analyzeBatchOptionsChain(symbols);
      return { success: true, result };
    } catch (err) {
      log.error('[OptionsChainBatch] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Multi-Factor Selector (JVS-56) ─────────────────────────────────────


  // ── Q55: Options Strategy Builder ────────────────────────────────────────
  ipcMain.handle('options:build', async (_e, raw: unknown) => {
    try {
      const { underlying, spotPrice, strategyType, targetParams, legs } = raw as {
        underlying: string; spotPrice: number; strategyType?: string; targetParams?: unknown; legs?: unknown[];
      };
      const { OptionsStrategyBuilder } = await import('./engine/options-strategy-builder.js');
      const builder = new OptionsStrategyBuilder(underlying, spotPrice);
      const result = builder.buildStrategy(strategyType, targetParams, legs);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('options:analyze', async (_e, raw: unknown) => {
    try {
      const { strategy, spotPrice, volatility, riskFreeRate, dividends } = raw as {
        strategy: unknown; spotPrice: number; volatility?: number; riskFreeRate?: number; dividends?: unknown;
      };
      const { OptionsStrategyBuilder } = await import('./engine/options-strategy-builder.js');
      const builder = new OptionsStrategyBuilder(strategy.underlying || 'UNKNOWN', spotPrice);
      const result = builder.analyzeStrategy(strategy, { spotPrice, volatility, riskFreeRate, dividends });
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q56: Portfolio Cost Analytics ───────────────────────────────────────


  // ── Greeks Calculation (P0-fixed: pure JS Black-Scholes, no Python subprocess) ─
  ipcMain.handle('greeks:calculate', async (_e, params: {
    spot: number; strike: number; vol: number; days: number;
    rate?: number; type: 'CALL' | 'PUT'; qty?: number;
  }) => {
    try {
      const greeks = calcGreeksJS(params.spot, params.strike, params.vol, params.days, params.rate || 0.05, params.type);
      return { success: true, greeks };
    } catch (err) {
      log.error('[Greeks] Calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('greeks:portfolio', async (_e, positions: unknown[]) => {
    const vErr = validate(GreeksPortfolioSchema, { positions });
    if (vErr) return vErr;
    try {
      const portfolio = positions.map((p: unknown) => {
        const g = calcGreeksJS(p.spot, p.strike, p.iv, p.dte, p.rate || 0.05, p.type);
        const mult = p.qty || 1;
        return {
          ...g,
          symbol: p.symbol,
          type: p.type,
          strike: p.strike,
          qty: mult,
          totalDelta: (g.delta * mult * 100).toFixed(2),
          totalGamma: (g.gamma * mult * 100).toFixed(4),
          totalTheta: (g.theta * mult).toFixed(2),
          totalVega: (g.vega * mult * 0.01).toFixed(2),
        };
      });
      const totals = {
        netDelta: portfolio.reduce((s: number, p: unknown) => s + parseFloat(p.totalDelta), 0).toFixed(2),
        netGamma: portfolio.reduce((s: number, p: unknown) => s + parseFloat(p.totalGamma), 0).toFixed(4),
        netTheta: portfolio.reduce((s: number, p: unknown) => s + parseFloat(p.totalTheta), 0).toFixed(2),
      };
      return { success: true, portfolio: { positions: portfolio, totals } };
    } catch (err) {
      log.error('[Greeks] Portfolio calc failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Marketplace ───────────────────────────────────────────────────


}
