// @ts-nocheck
/**
 * @deprecated Use src/services/portfolio-service.ts instead (R108 S-34).
 * Service layer provides typed interfaces and abstracts IPC calls.
 *
 * ── DAWN WHALES — Bridge API App Module ───────────────────────────────
 * S-15p1 split: App/Updater + Backtest Enhancement + Marketplace
 * S-15p2: Zod-derived types replaced all `any` usage
 */

import type {
  IpcResponse,
  AppVersionInfo,
  UpdateCheckResult,
  BacktestMultiPeriodParams,
  BacktestParamSweepParams,
  BacktestWalkForwardParams,
  BacktestParamScanParams,
  BacktestMultiTimeframeParams,
  BacktestResult,
  RiskMetrics,
  MarketplaceSavePerformanceParams,
  MarketplaceStrategy,
} from '../../types/ipc';
import { hasIPC } from '../bridge-api-types';

// ── App / Updater ──────────────────────────────────────────────────────────

export async function checkUpdate(): Promise<IpcResponse<UpdateCheckResult>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.app.checkUpdate();
}

export async function downloadUpdate(): Promise<IpcResponse<AppVersionInfo>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.app.downloadUpdate();
}

export async function installUpdate(): Promise<void> {
  if (!hasIPC()) return;
  return window.api.app.installUpdate();
}

// ── Backtest Enhancement (Sprint 2, merged) ──────────────────────────────

export async function multiPeriodBacktest(config: BacktestMultiPeriodParams): Promise<IpcResponse<BacktestResult>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.multiPeriod(config);
}

export async function parameterSweep(config: BacktestParamSweepParams): Promise<IpcResponse<BacktestResult[]>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.paramSweep(config);
}

export async function walkForwardAnalysis(config: BacktestWalkForwardParams): Promise<IpcResponse<BacktestResult>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.walkForward(config);
}

export async function computeRiskMetrics(equityCurve: number[], riskFreeRate?: number): Promise<IpcResponse<RiskMetrics>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.riskMetrics(equityCurve, riskFreeRate);
}

export async function runWalkForwardV2(config: BacktestWalkForwardParams): Promise<IpcResponse<BacktestResult>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.walkForwardV2(config);
}

export async function runParamScan(config: BacktestParamScanParams): Promise<IpcResponse<BacktestResult[]>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.paramScan(config);
}

export async function runMultiTimeframe(config: BacktestMultiTimeframeParams): Promise<IpcResponse<BacktestResult[]>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.backtest.multiTimeframe(config);
}

// ── Marketplace ──────────────────────────────────────────────────────────

export async function rateStrategy(strategyId: string, rating: number): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.rate(strategyId, rating);
}

export async function getStrategyRating(strategyId: string): Promise<IpcResponse<{ avg: number; count: number; myRating: number }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.getRating(strategyId);
}

export async function addComment(strategyId: string, content: string, parentId?: number): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.comment(strategyId, content, parentId);
}

export async function getComments(strategyId: string): Promise<IpcResponse<{ comments: unknown[] }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.getComments(strategyId);
}

export async function savePerformance(data: MarketplaceSavePerformanceParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.savePerformance(data);
}

export async function getPerformance(strategyId: string): Promise<IpcResponse<{ performance: unknown[] }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.getPerformance(strategyId);
}

export async function getMarketplaceList(sortBy?: string, limit?: number): Promise<IpcResponse<{ strategies: MarketplaceStrategy[] }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.list(sortBy, limit);
}

export async function getStrategyScore(strategyId: string): Promise<IpcResponse<{ score: unknown }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.score(strategyId);
}

export async function verifyStrategy(strategyId: string): Promise<IpcResponse<{ verification: unknown }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.verify(strategyId);
}

export async function updateAllScores(): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.marketplace.updateAllScores();
}
