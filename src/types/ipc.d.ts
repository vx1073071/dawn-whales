/**
 * TradingEasy — IPC Parameter & Response Type Definitions
 *
 * Mirrors the Zod schemas in electron/ipc-schemas.ts.
 * Pure TypeScript types (no Zod dependency) for renderer-side bridge-api usage.
 *
 * Usage: import type { BrokerPlaceOrderParams } from '../../types/ipc';
 */

// ── Generic IPC Response ──────────────────────────────────────────────────

export interface IpcSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface IpcError {
  success: false;
  error?: string;
}

export type IpcResponse<T = unknown> = IpcSuccess<T> | IpcError;

// ── Broker ────────────────────────────────────────────────────────────────

export interface BrokerConnectParams {
  host?: string;
  port?: number;
  brokerId?: string;
}

export interface BrokerGetFundsParams {
  accountId: string;
}

export interface BrokerGetPositionsParams {
  accountId: string;
}

export interface BrokerGetQuotesParams {
  codes: string[];
}

export interface BrokerSubscribeParams {
  codes: string[];
}

export interface BrokerGetKlinesParams {
  code: string;
  period: string;
  count: number;
}

export interface BrokerPlaceOrderParams {
  code: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  accountId?: string;
}

export interface BrokerCancelOrderParams {
  orderId: string;
  accountId: string;
  code: string;
}

export interface BrokerSwitchParams {
  id: string;
}

export interface BrokerAddParams {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  token?: string;
  enabled?: boolean;
}

export interface BrokerInfo {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  connected: boolean;
}

// ── Strategy ──────────────────────────────────────────────────────────────

export interface StrategyCreateParams {
  name: string;
  description?: string;
  params?: Record<string, unknown>;
  symbol: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface StrategyUpdateParams {
  name?: string;
  description?: string;
  params?: Record<string, unknown>;
  stopLoss?: number;
  takeProfit?: number;
  symbol?: string;
}

export interface StrategyGetParams {
  id: string;
}

export interface StrategyBacktestParams {
  strategyId?: string;
  symbol?: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  stopLoss?: number;
  takeProfit?: number;
  commission?: number;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description?: string;
  params?: Record<string, unknown>;
  symbol: string;
  stopLoss?: number;
  takeProfit?: number;
  isActive?: boolean;
}

// ── Backtest ──────────────────────────────────────────────────────────────

export interface BacktestMultiPeriodParams {
  strategyId: string;
  periods: Array<{ period: string; weight: number }>;
  initialCapital?: number;
}

export interface BacktestParamSweepParams {
  strategyId: string;
  paramName: string;
  values: number[];
  symbol?: string;
  startDate?: string;
  endDate?: string;
}

export interface BacktestRiskMetricsParams {
  equityCurve: number[];
  riskFreeRate?: number;
}

export interface BacktestWalkForwardParams {
  strategyId: string;
  windowSize?: number;
  stepSize?: number;
}

export interface BacktestParamScanParams {
  strategyId: string;
  params?: Record<string, number[]>;
}

export interface BacktestMultiTimeframeParams {
  strategyId: string;
  timeframes: string[];
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  tradeCount?: number;
  profitFactor?: number;
  equityCurve?: number[];
}

// ── Risk ─────────────────────────────────────────────────────────────────

export interface RiskUpdateConfigParams {
  maxDrawdownPct?: number;
  maxPositionSize?: number;
  kellyFraction?: number;
  atrPeriod?: number;
  useVixAdjustment?: boolean;
}

export interface RiskUpdateVixParams {
  vix: number;
}

export interface RiskMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  var95: number;
  cvar95: number;
  beta?: number;
  alpha?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  profitFactor?: number;
}

// ── Database ──────────────────────────────────────────────────────────────

export interface DbSaveStrategyParams {
  id?: string;
  name: string;
  description?: string;
  params?: Record<string, unknown>;
  symbol: string;
  stopLoss?: number;
  takeProfit?: number;
  isActive?: boolean;
}

export interface DbSaveSettingsParams {
  key: string;
  value: unknown;
}

export interface DbSaveWatchlistParams {
  codes: string[];
}

export interface DbGetTradesParams {
  strategyId?: string;
}

export interface DbGetBacktestResultsParams {
  strategyId: string;
}

export interface DbGetSignalsParams {
  strategyId?: string;
}

export interface DbSaveFundamentalParams {
  symbol: string;
  data: Record<string, unknown>;
}

export interface DbSaveCapitalFlowParams {
  symbol: string;
  data: Record<string, unknown>;
}

export interface DbSaveRegimeParams {
  regime: 'bull' | 'bear' | 'neutral';
  confidence: number;
}

export interface DbSaveAnomalyParams {
  symbol: string;
  signal: Record<string, unknown>;
}

export interface DbSaveNewsParams {
  symbol: string;
  items: Array<{
    title: string;
    url?: string;
    time?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface DataComputeRegimeParams {
  factors: Record<string, number>;
}

// ── Marketplace ───────────────────────────────────────────────────────────

export interface MarketplaceRateParams {
  strategyId: string;
  rating: number;
}

export interface MarketplaceCommentParams {
  strategyId: string;
  content: string;
  parentId?: number;
}

export interface MarketplaceSavePerformanceParams {
  strategyId: string;
  totalReturn: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  trades?: number;
}

export interface MarketplaceListParams {
  sortBy?: 'rating' | 'return' | 'trades' | 'created';
  limit?: number;
}

export interface MarketplaceStrategy {
  id: string;
  name: string;
  description?: string;
  rating: number;
  totalReturn: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  trades: number;
  created: string;
}

// ── Greeks (Options) ─────────────────────────────────────────────────────

export interface GreeksCalculateParams {
  symbol: string;
  expiry: string;
  strike: number;
  optionType: 'call' | 'put';
  spotPrice: number;
  riskFreeRate?: number;
  volatility?: number;
}

export interface GreeksPortfolioParams {
  positions: Array<{
    symbol: string;
    expiry: string;
    strike: number;
    optionType: 'call' | 'put';
    qty: number;
    spotPrice: number;
    iv?: number;
  }>;
}

export interface GreeksResult {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  price: number;
  iv?: number;
}

// ── Data Provider ─────────────────────────────────────────────────────────

export interface DataNewsParams {
  symbol: string;
  limit?: number;
}

export interface DataFundamentalParams {
  symbol: string;
}

export interface DataCapitalFlowParams {
  symbol: string;
}

export interface DataAnomaliesParams {
  symbol: string;
}

export interface DataCompositeScoreParams {
  symbol: string;
}

export interface FundamentalData {
  pe: number;
  pb: number;
  roe: number;
  revenue: number;
  profit: number;
  marketCap: number;
  [key: string]: unknown;
}

export interface CapitalFlowData {
  mainInflow: number;
  mainOutflow: number;
  retailInflow: number;
  retailOutflow: number;
  [key: string]: unknown;
}

export interface NewsItem {
  title: string;
  url?: string;
  time?: string;
  source?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface AnomalySignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: string;
  [key: string]: unknown;
}

// ── NL Parser ─────────────────────────────────────────────────────────────

export interface NlParseParams {
  text: string;
}

export interface NlParsedStrategy {
  name: string;
  type: string;
  params: Record<string, unknown>;
  symbol?: string;
  stopLoss?: number;
  takeProfit?: number;
}

// ── Strategy Explain / Compare / Optimize ─────────────────────────────────

export interface StrategyExplainParams {
  strategy: {
    name: string;
    params?: Record<string, unknown>;
    stopLoss?: number;
    takeProfit?: number;
  };
}

export interface StrategyCompareParams {
  s1: {
    name: string;
    params?: Record<string, unknown>;
    stopLoss?: number;
    takeProfit?: number;
  };
  s2: {
    name: string;
    params?: Record<string, unknown>;
    stopLoss?: number;
    takeProfit?: number;
  };
}

export interface StrategyOptimizeParams {
  strategyDSL: {
    name: string;
    symbol?: string;
    type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'custom';
    params?: Record<string, unknown>;
    stopLoss?: number;
    takeProfit?: number;
  };
  backtestResult: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    tradeCount?: number;
    equityCurve?: number[];
  };
}

// ── App / System ──────────────────────────────────────────────────────────

export interface AppVersionInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  url?: string;
}

// ── Signal ────────────────────────────────────────────────────────────────

export interface SignalData {
  symbol: string;
  strategyId: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: string;
  [key: string]: unknown;
}

// ── Config ────────────────────────────────────────────────────────────────

export interface ConfigData {
  key: string;
  value: unknown;
}

// ── Commission ────────────────────────────────────────────────────────────

export interface CommissionRate {
  tier: 'L1' | 'L2' | 'L3';
  rate: number;
  effectiveDate: string;
}
