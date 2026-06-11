/**
 * Portfolio Service — R108 S-34
 *
 * Portfolio management: strategies, backtesting, greeks, marketplace.
 *
 * @module services/portfolio-service
 */

import * as tradeBridge from '../lib/bridge-api/trade';
import * as appBridge from '../lib/bridge-api/app';
import type { StrategyConfig, BacktestRequest } from './trading-types';

// ═══════════════════════════════════════════════════════════════════════════
// Strategy Management
// ═══════════════════════════════════════════════════════════════════════════

export const portfolioService = {
  // ── Strategies ──────────────────────────────────────────────────────
  createStrategy: (config: StrategyConfig) => tradeBridge.createStrategy(config),
  getAllStrategies: () => tradeBridge.getAllStrategies(),
  getStrategies: (ids?: string[]) => tradeBridge.getStrategies(ids || []),
  updateStrategy: (id: string, config: Partial<StrategyConfig>) =>
    tradeBridge.updateStrategy(id, config),
  deleteStrategy: (id: string) => tradeBridge.deleteStrategy(id),
  getSignals: () => tradeBridge.getSignals(),

  // ── Backtesting ─────────────────────────────────────────────────────
  runBacktest: (params: BacktestRequest) => tradeBridge.runBacktest(params),

  /** Multi-period backtest across different time windows */
  multiPeriodBacktest: (params: Record<string, unknown>) =>
    appBridge.multiPeriodBacktest(params),

  /** Parameter sweep / grid search */
  parameterSweep: (params: Record<string, unknown>) =>
    appBridge.parameterSweep(params),

  /** Walk-forward optimization */
  walkForwardAnalysis: (params: Record<string, unknown>) =>
    appBridge.walkForwardAnalysis(params),

  /** Walk-forward v2 */
  runWalkForwardV2: (params: Record<string, unknown>) =>
    appBridge.runWalkForwardV2(params),

  /** Parameter scan (single param range) */
  runParamScan: (params: Record<string, unknown>) =>
    appBridge.runParamScan(params),

  /** Multi-timeframe backtest */
  runMultiTimeframe: (params: Record<string, unknown>) =>
    appBridge.runMultiTimeframe(params),

  // ── Risk Performance ────────────────────────────────────────────────
  /** Compute risk metrics for a backtest result */
  computeRiskMetrics: (params: Record<string, unknown>) =>
    appBridge.computeRiskMetrics(params),

  // ── Greeks ──────────────────────────────────────────────────────────
  calculateGreeks: (params: { symbol: string; strike: number; expiry: string; optionType: string }) =>
    tradeBridge.calculateGreeks(params),

  calculatePortfolioGreeks: () => tradeBridge.calculatePortfolioGreeks(),

  // ── Marketplace ─────────────────────────────────────────────────────
  rateStrategy: (params: { strategyId: string; rating: number; review?: string }) =>
    appBridge.rateStrategy(params),

  getStrategyRating: (strategyId: string) =>
    appBridge.getStrategyRating(strategyId),

  addComment: (params: { strategyId: string; content: string }) =>
    appBridge.addComment(params),

  getComments: (strategyId: string) =>
    appBridge.getComments(strategyId),

  savePerformance: (params: Record<string, unknown>) =>
    appBridge.savePerformance(params),

  getPerformance: (strategyId: string) =>
    appBridge.getPerformance(strategyId),

  listMarketplace: (params?: Record<string, unknown>) =>
    appBridge.getMarketplaceList(params || {}),

  getStrategyScore: (strategyId: string) =>
    appBridge.getStrategyScore(strategyId),

  verifyStrategy: (strategyId: string) =>
    appBridge.verifyStrategy(strategyId),

  updateAllScores: () => appBridge.updateAllScores(),
};
