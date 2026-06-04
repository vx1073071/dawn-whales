// ── IPC Parameter Zod Schemas ───────────────────────────────────────────────
// 所有 ipcMain.handle 的输入参数 schema，用于运行时校验
// 规则：校验失败返回 { success: false, error: string }，不抛异常

import { z } from 'zod';

// ── Broker ──────────────────────────────────────────────────────────────────

export const BrokerConnectSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(11111),
  brokerId: z.string().optional(),
});

export const BrokerGetFundsSchema = z.object({
  accountId: z.string().min(1),
});

export const BrokerGetPositionsSchema = z.object({
  accountId: z.string().min(1),
});

export const BrokerGetQuotesSchema = z.object({
  codes: z.array(z.string()).min(1),
});

export const BrokerSubscribeSchema = z.object({
  codes: z.array(z.string()).min(1),
});

export const BrokerGetKlinesSchema = z.object({
  code: z.string().min(1),
  period: z.string().min(1),
  count: z.number().int().min(1).max(1000),
});

export const BrokerPlaceOrderSchema = z.object({
  code: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  qty: z.number().int().min(1).max(1_000_000),
  price: z.number().min(0),
  accountId: z.string().optional(),
});

export const BrokerCancelOrderSchema = z.object({
  orderId: z.string().min(1),
  accountId: z.string().min(1),
  code: z.string().min(1),
});

export const BrokerSwitchSchema = z.object({
  id: z.string().min(1),
});

export const BrokerAddSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  host: z.string().optional(),
  port: z.number().optional(),
  token: z.string().optional(),
  enabled: z.boolean().optional(),
});

// ── Strategy ────────────────────────────────────────────────────────────────

export const StrategyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  symbol: z.string().min(1).max(20),
  stopLoss: z.number().min(0).max(1).optional(),
  takeProfit: z.number().min(0).max(1).optional(),
});

export const StrategyUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  stopLoss: z.number().min(0).max(1).optional(),
  takeProfit: z.number().min(0).max(1).optional(),
  symbol: z.string().min(1).max(20).optional(),
});

export const StrategyGetSchema = z.object({
  id: z.string().min(1),
});

export const StrategyBacktestSchema = z.object({
  strategyId: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  initialCapital: z.number().min(1000).optional(),
  stopLoss: z.number().min(0).max(1).optional(),
  takeProfit: z.number().min(0).max(1).optional(),
  commission: z.number().min(0).optional(),
});

// ── Backtest ───────────────────────────────────────────────────────────────

export const BacktestMultiPeriodSchema = z.object({
  strategyId: z.string().min(1),
  periods: z.array(z.object({
    period: z.string(),
    weight: z.number().min(0),
  })),
  initialCapital: z.number().min(1000).optional(),
});

export const BacktestParamSweepSchema = z.object({
  strategyId: z.string().min(1),
  paramName: z.string().min(1),
  values: z.array(z.number()),
  symbol: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const BacktestRiskMetricsSchema = z.object({
  equityCurve: z.array(z.number()).min(1),
  riskFreeRate: z.number().min(0).max(1).optional(),
});

export const BacktestWalkForwardSchema = z.object({
  strategyId: z.string().min(1),
  windowSize: z.number().int().min(10).max(500).optional(),
  stepSize: z.number().int().min(1).max(100).optional(),
});

export const BacktestParamScanSchema = z.object({
  strategyId: z.string().min(1),
  params: z.record(z.string(), z.array(z.number())).optional(),
});

export const BacktestMultiTimeframeSchema = z.object({
  strategyId: z.string().min(1),
  timeframes: z.array(z.string()).min(1),
});

// ── Risk ────────────────────────────────────────────────────────────────────

export const RiskUpdateConfigSchema = z.object({
  maxDrawdownPct: z.number().min(0).max(1).optional(),
  maxPositionSize: z.number().min(0).optional(),
  kellyFraction: z.number().min(0).max(1).optional(),
  atrPeriod: z.number().int().min(1).max(100).optional(),
  useVixAdjustment: z.boolean().optional(),
});

export const RiskUpdateVixSchema = z.object({
  vix: z.number().min(0).max(100),
});

// ── DB ────────────────────────────────────────────────────────────────────

export const DbSaveStrategySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  symbol: z.string().min(1).max(20),
  stopLoss: z.number().min(0).max(1).optional(),
  takeProfit: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
});

export const DbSaveSettingsSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export const DbSaveWatchlistSchema = z.object({
  codes: z.array(z.string()).min(1),
});

export const DbGetTradesSchema = z.object({
  strategyId: z.string().optional(),
});

export const DbGetBacktestResultsSchema = z.object({
  strategyId: z.string().min(1),
});

export const DbGetSignalsSchema = z.object({
  strategyId: z.string().optional(),
});

export const DbSaveFundamentalSchema = z.object({
  symbol: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export const DbSaveCapitalFlowSchema = z.object({
  symbol: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export const DbSaveRegimeSchema = z.object({
  regime: z.enum(['bull', 'bear', 'neutral']),
  confidence: z.number().min(0).max(1),
});

export const DbSaveAnomalySchema = z.object({
  symbol: z.string().min(1),
  signal: z.record(z.string(), z.unknown()),
});

export const DbSaveNewsSchema = z.object({
  symbol: z.string().min(1),
  items: z.array(z.object({
    title: z.string(),
    url: z.string().optional(),
    time: z.string().optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  })),
});

export const DataComputeRegimeSchema = z.object({
  factors: z.record(z.string(), z.number()),
});

// ── Marketplace ───────────────────────────────────────────────────────────

export const MarketplaceRateSchema = z.object({
  strategyId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

export const MarketplaceCommentSchema = z.object({
  strategyId: z.string().min(1),
  content: z.string().min(1).max(1000),
  parentId: z.number().int().min(0).optional(),
});

export const MarketplaceSavePerformanceSchema = z.object({
  strategyId: z.string().min(1),
  totalReturn: z.number(),
  sharpeRatio: z.number().optional(),
  maxDrawdown: z.number().optional(),
  winRate: z.number().min(0).max(1).optional(),
  profitFactor: z.number().optional(),
  trades: z.number().int().min(0).optional(),
});

export const MarketplaceListSchema = z.object({
  sortBy: z.enum(['rating', 'return', 'trades', 'created']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ── Greeks ─────────────────────────────────────────────────────────────────

export const GreeksCalculateSchema = z.object({
  symbol: z.string().min(1),
  expiry: z.string().min(1),
  strike: z.number().min(0),
  optionType: z.enum(['call', 'put']),
  spotPrice: z.number().min(0),
  riskFreeRate: z.number().min(0).max(1).optional(),
  volatility: z.number().min(0).max(10).optional(),
});

export const GreeksPortfolioSchema = z.object({
  positions: z.array(z.object({
    symbol: z.string(),
    expiry: z.string(),
    strike: z.number(),
    optionType: z.enum(['call', 'put']),
    qty: z.number(),
    spotPrice: z.number(),
    iv: z.number().min(0).optional(),
  })).min(1),
});

// ── Data ────────────────────────────────────────────────────────────────────

export const DataNewsSchema = z.object({
  symbol: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

export const DataFundamentalSchema = z.object({
  symbol: z.string().min(1),
});

export const DataCapitalFlowSchema = z.object({
  symbol: z.string().min(1),
});

export const DataAnomaliesSchema = z.object({
  symbol: z.string().min(1),
});

export const DataCompositeScoreSchema = z.object({
  symbol: z.string().min(1),
});

// ── NL ─────────────────────────────────────────────────────────────────────

export const NlParseSchema = z.object({
  text: z.string().min(1).max(2000),
});

// ── Strategy Explain/Compare ──────────────────────────────────────────────

export const StrategyExplainSchema = z.object({
  strategy: z.object({
    name: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
  }),
});

export const StrategyCompareSchema = z.object({
  s1: z.object({
    name: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
  }),
  s2: z.object({
    name: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
  }),
});

// ── Strategy Optimize ────────────────────────────────────────────────────────

export const StrategyOptimizeSchema = z.object({
  strategyDSL: z.object({
    name: z.string(),
    symbol: z.string().optional(),
    type: z.enum(['ma_cross', 'rsi', 'macd', 'momentum', 'bollinger', 'custom']),
    params: z.record(z.string(), z.unknown()).optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
  }),
  backtestResult: z.object({
    totalReturn: z.number(),
    sharpeRatio: z.number(),
    maxDrawdown: z.number(),
    winRate: z.number(),
    tradeCount: z.number().optional(),
    equityCurve: z.array(z.number()).optional(),
  }),
});

// ── Utility ────────────────────────────────────────────────────────────────

/**
 * 通用校验函数：校验失败返回错误对象，成功返回 null
 * Usage in ipcMain.handle:
 *   const schema = BrokerPlaceOrderSchema;
 *   const result = validate(schema, order);
 *   if (result) return result;
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: false; error: string } | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { success: false, error: `Validation failed: ${issues}` };
  }
  return null;
}

// ── Strategy Correlation Matrix ─────────────────────────────────────────────

export const StrategyCorrelationSchema = z.object({
  strategies: z.array(z.object({
    id: z.string(),
    equityCurve: z.array(z.object({
      time: z.number(),
      value: z.number(),
    })),
  })),
});

// ── Notification Generate ────────────────────────────────────────────────────

export const NotificationGenerateSchema = z.object({
  anomalies: z.array(z.object({
    symbol: z.string(),
    type: z.string(),
    level: z.enum(['info', 'warning', 'critical']),
    message: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.number(),
  })).optional(),
  riskAlerts: z.array(z.object({
    type: z.string(),
    level: z.enum(['info', 'warning', 'critical']),
    message: z.string().optional(),
    metrics: z.record(z.string(), z.number()).optional(),
  })).optional(),
  marketRegime: z.object({
    state: z.string(),
    confidence: z.number(),
    recommendation: z.string(),
  }).optional(),
  positions: z.array(z.object({
    symbol: z.string(),
    pnlPct: z.number(),
    size: z.number(),
  })).optional(),
  vix: z.number().optional(),
});

// ── Report Generate ──────────────────────────────────────────────────────────

// Minimal schema — BacktestResult is complex, we accept as any[] and validate key fields
const BacktestResultCoreSchema = z.object({
  success: z.boolean(),
  result: z.object({
    totalReturn: z.number(),
    annualReturn: z.number(),
    sharpeRatio: z.number(),
    maxDrawdown: z.number(),
    winRate: z.number(),
    profitFactor: z.number(),
    totalTrades: z.number(),
    avgTradePnl: z.number(),
    avgHoldingBars: z.number(),
    config: z.object({
      symbol: z.string().optional(),
      strategyName: z.string().optional(),
      strategy: z.object({ type: z.string() }).optional(),
    }).optional(),
  }),
});

export const ReportGenerateSchema = z.object({
  results: z.array(BacktestResultCoreSchema),
  symbol: z.string().optional(),
  apiKey: z.string().optional(),
  timeoutMs: z.number().optional(),
});

export const ReportQuickSchema = z.object({
  result: BacktestResultCoreSchema,
  apiKey: z.string().optional(),
});

// ── Strategy Auto-Tune ────────────────────────────────────────────────────────

export const StrategyAutoTuneSchema = z.object({
  strategyType: z.string(),
  ranges: z.array(z.object({
    name: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number(),
  })),
  klines: z.array(z.record(z.string(), z.unknown())),
  method: z.enum(['ga', 'bayesian', 'both']).optional(),
  populationSize: z.number().optional(),
  generations: z.number().optional(),
  iterations: z.number().optional(),
});

// ── Execution Analytics (Q29) ───────────────────────────────────────────────

export const ExecutionAnalyzeSchema = z.object({
  executionRecords: z.array(z.any()),
  marketData: z.any().optional(),
  benchmarkPrice: z.number().optional(),
  optionsScope: z.any().optional(),
});

// ── Options Strategy Builder (Q55) ──────────────────────────────────────────

export const OptionsBuildSchema = z.object({
  underlying: z.string().min(1),
  spotPrice: z.number().positive(),
  strategyType: z.string().optional(),
  targetParams: z.any().optional(),
  legs: z.array(z.any()).optional(),
});

export const OptionsAnalyzeSchema = z.object({
  strategy: z.any(),
  spotPrice: z.number().positive(),
  volatility: z.number().optional(),
  riskFreeRate: z.number().optional(),
  dividends: z.any().optional(),
});

// ── Portfolio Rebalancer / Cost / RAR (Q22/Q54/Q56) ───────────────────────

export const PortfolioRebalanceSchema = z.object({
  positions: z.array(z.any()),
  targetWeights: z.record(z.string(), z.number()),
  dryRun: z.boolean().optional(),
  driftThreshold: z.number().optional(),
  maxTurnover: z.number().optional(),
});

export const PortfolioRebalanceKellySchema = z.object({
  positions: z.array(z.any()),
  kellyFraction: z.number().optional(),
  maxTurnover: z.number().optional(),
});

export const PortfolioCostAnalyzeSchema = z.object({
  positions: z.array(z.any()),
  trades: z.array(z.any()),
  periodDays: z.number().optional(),
});

export const PortfolioRarOptimizeSchema = z.object({
  positions: z.array(z.any()),
  marketData: z.any().optional(),
  riskAppetite: z.string().optional(),
  constraints: z.any().optional(),
});

// ── Real Trader (Q20) ──────────────────────────────────────────────────────

export const TraderExecuteSchema = z.object({
  signal: z.any(),
  paperMode: z.boolean().optional(),
});

// ── Cross-Asset Risk (Q57) ─────────────────────────────────────────────────

export const RiskCrossAssetSchema = z.object({
  portfolios: z.array(z.any()),
  confidenceLevel: z.number().optional(),
  method: z.string().optional(),
});

// ── Backtest Stability (Q64) ───────────────────────────────────────────────

export const BacktestStabilitySchema = z.object({
  equityCurve: z.array(z.number()),
  trades: z.array(z.any()).optional(),
  config: z.any().optional(),
});

// ── Signal Quality (Q63) ────────────────────────────────────────────────────

export const SignalQualityScoreSchema = z.object({
  signal: z.any(),
  marketContext: z.any().optional(),
});

// ── Position Alert (Q68) ───────────────────────────────────────────────────

export const PositionCheckSchema = z.object({
  positions: z.array(z.any()),
  alerts: z.array(z.any()).optional(),
});

// ── Alert ──────────────────────────────────────────────────────────────────

export const AlertCorrelationSchema = z.object({
  snapshots: z.array(z.any()),
  historicalData: z.any().optional(),
});

export const AlertCorrelationMatrixSchema = z.object({
  matrix: z.array(z.array(z.number())),
  codes: z.array(z.string()),
  prevMatrix: z.array(z.array(z.number())).optional(),
  histMatrices: z.any().optional(),
});

export const AlertMacroSchema = z.object({
  currentData: z.array(z.any()),
  historicalData: z.any(),
});

export const AlertMacroMultipleSchema = z.object({
  indicatorData: z.array(z.any()),
});

// ── Backfill ────────────────────────────────────────────────────────────────

export const BackfillStartSchema = z.object({
  symbols: z.array(z.string()),
  type: z.string().optional(),
  startDate: z.string().optional(),
});

export const BackfillIncrementalSchema = z.object({
  symbol: z.string(),
});

export const BackfillSymbolsSchema = z.object({
  market: z.string().optional(),
  type: z.string().optional(),
});

// ── Cache ───────────────────────────────────────────────────────────────────

export const CacheSetSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  ttlMs: z.number().optional(),
});

export const CacheGetSchema = z.object({
  key: z.string().min(1),
});

export const CacheDeleteSchema = z.object({
  key: z.string().min(1),
});

export const CacheExploreSchema = z.object({
  pattern: z.string().optional(),
  limit: z.number().optional(),
});

export const CacheKeysPaginatedSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

// ── Data ────────────────────────────────────────────────────────────────────

export const DataRegimeSchema = z.object({
  klines: z.array(z.any()),
});

export const DataCapitalFlowBatchSchema = z.object({
  codes: z.array(z.string()).optional(),
});

export const DataQualityStartSchema = z.object({
  symbols: z.array(z.string()),
});

export const DataQualityStreamStartSchema = z.object({
  symbols: z.array(z.string()),
  intervalMs: z.number().optional(),
});

export const DataQualityAcknowledgeSchema = z.object({
  alertId: z.string(),
});

export const DataSaveAnomalySchema = z.object({
  anomaly: z.any(),
});

export const DataSaveCapitalFlowSchema = z.object({
  capitalFlow: z.any(),
});

export const DataSaveFundamentalSchema = z.object({
  fundamental: z.any(),
});

export const DataSaveNewsSchema = z.object({
  news: z.any(),
});

export const DataSaveRegimeSchema = z.object({
  regime: z.any(),
});

export const DataExportSchema = z.object({
  moduleIds: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const DataConsistencyCheckSchema = z.object({
  moduleIds: z.array(z.string()).optional(),
});

export const DataConsistencyRulesSchema = z.object({
  moduleId: z.string().optional(),
});

// ── EM (Eastmoney) ───────────────────────────────────────────────────────────

export const EmGetFinancialsSchema = z.object({
  code: z.string().min(1),
  quarters: z.number().optional(),
});

export const EmGetValuationSchema = z.object({
  code: z.string().min(1),
  historyDays: z.number().optional(),
});

export const EmImpliedVolSchema = z.object({
  marketPrice: z.number().positive(),
  S: z.number().positive(),
  K: z.number().positive(),
  T: z.number().positive(),
  r: z.number(),
  optionType: z.string(),
  q: z.number().optional(),
});

export const EmVolSurfaceSchema = z.object({
  S: z.number().positive(),
  r: z.number(),
  strikes: z.array(z.number()),
  expiries: z.array(z.number()),
  callPrices: z.array(z.array(z.number())),
  putPrices: z.array(z.array(z.number())).optional(),
});

export const EmCalcGreeksSchema = z.object({
  S: z.number().positive(),
  K: z.number().positive(),
  T: z.number().positive(),
  r: z.number(),
  sigma: z.number().positive(),
  optionType: z.string(),
  q: z.number().optional(),
});

export const EmCalcSharpeSchema = z.object({
  returns: z.array(z.number()),
  riskFreeRate: z.number().optional(),
  tradingDays: z.number().optional(),
});

export const EmCalcMaxDrawdownSchema = z.object({
  returns: z.array(z.number()),
});

export const EmCalcVarSchema = z.object({
  returns: z.array(z.number()),
  confidence: z.number().optional(),
});

export const EmPortfolioAttributionSchema = z.object({
  portfolio: z.any(),
  benchmark: z.any().optional(),
});

export const EmCorrelationMatrixSchema = z.object({
  codes: z.array(z.string()),
  period: z.string().optional(),
});

export const EmSectorRotationSchema = z.object({
  period: z.string().optional(),
});

export const EmDiagnoseStockSchema = z.object({
  code: z.string().min(1),
});

export const EmBatchDiagnoseSchema = z.object({
  codes: z.array(z.string()),
});

export const EmGetMacroSchema = z.object({
  indicator: z.string().optional(),
});

export const EmGetHeatmapSchema = z.object({
  market: z.string().optional(),
});

export const EmGetMarketOverviewSchema = z.object({
  market: z.string().optional(),
});

export const EmGetNewsAggregateSchema = z.object({
  codes: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export const EmGetSentimentSchema = z.object({
  code: z.string().optional(),
});

export const EmSmartPickSchema = z.object({
  preset: z.string().optional(),
  limit: z.number().optional(),
});

export const EmPriceAndGreeksSchema = z.object({
  code: z.string().min(1),
  expiry: z.string().optional(),
  strike: z.number().optional(),
});

export const EmCalcRiskMetricsSchema = z.object({
  positions: z.array(z.any()),
  marketData: z.any().optional(),
});

export const EmBackfillStartSchema = z.object({
  symbols: z.array(z.string()),
  type: z.string().optional(),
});

// ── Factor ──────────────────────────────────────────────────────────────────

export const FactorScoreSchema = z.object({
  stocks: z.array(z.any()),
  factorWeights: z.any().optional(),
});

export const FactorScreenSchema = z.object({
  stocks: z.array(z.any()),
  criteria: z.any(),
  factorWeights: z.any().optional(),
});

export const FactorScreenBatchSchema = z.object({
  batches: z.array(z.any()),
});

// ── Live Executor ────────────────────────────────────────────────────────────

export const LiveAddStrategySchema = z.object({
  strategy: z.any(),
  config: z.any().optional(),
});

export const LiveRemoveStrategySchema = z.object({
  strategyId: z.string().min(1),
});

export const LiveGetPositionsSchema = z.object({
  strategyId: z.string().optional(),
});

export const LiveGetOrdersSchema = z.object({
  strategyId: z.string().optional(),
});

// ── Notification ────────────────────────────────────────────────────────────

export const NotificationSummarySchema = z.object({
  events: z.array(z.any()),
  limit: z.number().optional(),
});

// ── Paper Trader ────────────────────────────────────────────────────────────

export const PaperStartSchema = z.object({
  initialCash: z.number().optional(),
});

export const PaperSubmitOrderSchema = z.object({
  order: z.any(),
});

export const PaperExecuteSignalSchema = z.object({
  signal: z.any(),
});

// ── PnL ──────────────────────────────────────────────────────────────────────

export const PnlMultiBrokerSchema = z.object({
  accountIds: z.array(z.string()).optional(),
  currency: z.string().optional(),
});

// ── Quote Stream ────────────────────────────────────────────────────────────

export const QuoteSubscribeSchema = z.object({
  codes: z.array(z.string()),
});

export const QuoteUnsubscribeSchema = z.object({
  codes: z.array(z.string()),
});

export const QuoteStreamStartSchema = z.object({
  codes: z.array(z.string()),
  period: z.string().optional(),
});

// ── Screener ────────────────────────────────────────────────────────────────

export const ScreenerSearchSchema = z.object({
  criteria: z.any(),
  limit: z.number().optional(),
});

// ── Sentiment ────────────────────────────────────────────────────────────────

export const SentimentDashboardSchema = z.object({
  codes: z.array(z.string()).optional(),
});

export const SentimentStreamStartSchema = z.object({
  codes: z.array(z.string()).optional(),
});

export const SentimentStreamAlertsSchema = z.object({
  codes: z.array(z.string()).optional(),
});

export const SentimentAttributionSchema = z.object({
  news: z.array(z.any()),
  portfolio: z.any().optional(),
});

// ── Snapshot ────────────────────────────────────────────────────────────────

export const SnapshotGetSchema = z.object({
  name: z.string().optional(),
  id: z.string().optional(),
});

export const SnapshotSaveSchema = z.object({
  name: z.string(),
  data: z.any(),
});

export const SnapshotDeleteSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

export const SnapshotCompareSchema = z.object({
  idA: z.string(),
  idB: z.string(),
});

export const SnapshotExportSchema = z.object({
  ids: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const SnapshotImportSchema = z.object({
  data: z.any(),
  overwrite: z.boolean().optional(),
});

export const SnapshotQuerySchema = z.object({
  key: z.string(),
  value: z.any().optional(),
  limit: z.number().optional(),
});

export const SnapshotTimelineSchema = z.object({
  strategyId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

// ── System ──────────────────────────────────────────────────────────────────

export const SystemOpendHealthSchema = z.object({
  host: z.string().optional(),
  port: z.number().optional(),
});

// ── WebSocket ────────────────────────────────────────────────────────────────

export const WsConnectSchema = z.object({
  url: z.string().optional(),
  protocols: z.any().optional(),
});

export const WsSubscribeSchema = z.object({
  symbol: z.string().min(1),
  channel: z.string().optional(),
});

export const WsSubscribeBatchSchema = z.object({
  symbols: z.array(z.string()),
  channel: z.string().optional(),
});

export const WsUnsubscribeSchema = z.object({
  symbol: z.string().min(1),
  channel: z.string().optional(),
});

export const WsUnsubscribeBatchSchema = z.object({
  symbols: z.array(z.string()),
  channel: z.string().optional(),
});

export const WsStreamStartSchema = z.object({
  codes: z.array(z.string()),
  channel: z.string().optional(),
});

export const WsStreamingStatsSchema = z.object({
  reset: z.boolean().optional(),
});

// ── Rate Limiter ─────────────────────────────────────────────────────────────

export const RateLimiterStatsSchema = z.object({
  api: z.string().optional(),
});

export const RateLimiterApisSchema = z.object({
  limit: z.number().optional(),
});

// ── Push2 ────────────────────────────────────────────────────────────────────

export const Push2GetStockQuoteSchema = z.object({
  code: z.string().min(1),
});

export const Push2GetSectorHeatmapSchema = z.object({
  market: z.string().optional(),
});

export const Push2GetCapitalFlowRankSchema = z.object({
  market: z.string().optional(),
  limit: z.number().optional(),
});

export const Push2GetMarketBreadthSchema = z.object({
  market: z.string().optional(),
});

// ── Python Bridge ───────────────────────────────────────────────────────────

export const PyCallSkillSchema = z.object({
  skill: z.string().min(1),
  params: z.any().optional(),
});

export const PyListSkillsSchema = z.object({
  filter: z.string().optional(),
});

// ── Anomaly ─────────────────────────────────────────────────────────────────

export const AnomalyDetectSchema = z.object({
  symbol: z.string().min(1),
  type: z.string().optional(),
  params: z.any().optional(),
});

// ── Regime ──────────────────────────────────────────────────────────────────

export const RegimeDetectSchema = z.object({
  klines: z.array(z.any()),
  method: z.string().optional(),
});

// ── Report Brinson ──────────────────────────────────────────────────────────

export const ReportBrinsonAttributionSchema = z.object({
  holdings: z.array(z.any()),
  benchmark: z.array(z.any()),
  benchmarkReturn: z.number(),
});

export const ReportBrinsonBatchSchema = z.object({
  portfolios: z.array(z.any()),
});

// ── Report Walk-Forward ──────────────────────────────────────────────────────

export const ReportWalkForwardSchema = z.object({
  strategyName: z.string(),
  windows: z.array(z.any()),
});

export const ReportWalkForwardBatchSchema = z.object({
  strategies: z.array(z.any()),
});

// ── Strategy ────────────────────────────────────────────────────────────────

export const StrategyBacktestV2Schema = z.object({
  strategy: z.any(),
  klines: z.array(z.any()),
  initialCash: z.number().optional(),
});

export const StrategyCorrelationVizSchema = z.object({
  strategyIds: z.array(z.string()),
  period: z.string().optional(),
});

export const StrategyTemplatesSchema = z.object({
  category: z.string().optional(),
  limit: z.number().optional(),
});

export const StrategyGetAllSchema = z.object({
  status: z.string().optional(),
  limit: z.number().optional(),
});

export const StrategyMultiFactorSchema = z.object({
  stocks: z.array(z.any()),
  preset: z.string().optional(),
  limit: z.number().optional(),
});

export const StrategyStartLiveSchema = z.object({
  strategyId: z.string().min(1),
  paperMode: z.boolean().optional(),
});
export const StrategyStopLiveSchema = z.object({
  strategyId: z.string().min(1),
});

// ── Risk ────────────────────────────────────────────────────────────────────

export const RiskCalculateSizeSchema = z.object({
  signal: z.any(),
  portfolio: z.any().optional(),
});

export const RiskCalculatePortfolioSizesSchema = z.object({
  signals: z.array(z.any()),
  portfolio: z.any().optional(),
});

export const RiskRecordTradeSchema = z.object({
  trade: z.any(),
  strategyId: z.string().optional(),
});

export const RiskDecomposeSchema = z.object({
  equityCurve: z.array(z.number()),
  positions: z.array(z.any()).optional(),
  confidenceLevel: z.number().optional(),
});

export const RiskMonteCarloSchema = z.object({
  equityCurve: z.array(z.number()),
  paths: z.number().optional(),
  horizon: z.number().optional(),
});

export const RiskStressTestSchema = z.object({
  positions: z.array(z.any()),
  scenario: z.string().optional(),
  params: z.any().optional(),
});

export const RiskGetTradeHistorySchema = z.object({
  strategyId: z.string().optional(),
  limit: z.number().optional(),
});

export const RiskPositionSizeSchema = z.object({
  signal: z.any(),
  riskProfile: z.any().optional(),
});

// ── NL ──────────────────────────────────────────────────────────────────────

export const NlTemplatesSchema = z.object({
  category: z.string().optional(),
});

// ── Marketplace ──────────────────────────────────────────────────────────────

export const MarketplaceVerifySchema = z.object({
  strategyId: z.string().min(1),
});

export const MarketplaceGetRatingSchema = z.object({
  strategyId: z.string().min(1),
});

export const MarketplaceGetCommentsSchema = z.object({
  strategyId: z.string().min(1),
  limit: z.number().optional(),
});

export const MarketplaceScoreSchema = z.object({
  strategyId: z.string().min(1),
});

export const MarketplaceUpdateAllScoresSchema = z.object({
  dryRun: z.boolean().optional(),
});

// ── Order ────────────────────────────────────────────────────────────────────

export const OrderRouteSchema = z.object({
  symbol: z.string().min(1),
  side: z.string(),
  quantity: z.number().positive(),
  type: z.string().optional(),
  price: z.number().optional(),
});

export const OrderTcaSchema = z.object({
  order: z.any(),
  benchmark: z.string().optional(),
});

// ── Predict ─────────────────────────────────────────────────────────────────

export const PredictCapitalFlowSchema = z.object({
  code: z.string().min(1),
  horizon: z.number().optional(),
});

// ── Indicator ────────────────────────────────────────────────────────────────

export const IndicatorComputeSchema = z.object({
  klines: z.array(z.any()),
  indicators: z.array(z.string()).optional(),
  options: z.any().optional(),
});

export const IndicatorRealtimeAddSchema = z.object({
  symbol: z.string().min(1),
  kline: z.any(),
});

export const IndicatorRealtimeAddBatchSchema = z.object({
  symbol: z.string().min(1),
  klines: z.array(z.any()),
});

export const IndicatorRealtimeGetBufferSchema = z.object({
  symbol: z.string().min(1),
});

// ── App ─────────────────────────────────────────────────────────────────────

export const AppExportPdfSchema = z.object({
  filename: z.string(),
  data: z.any().optional(),
});

export const AppOpenExternalSchema = z.object({
  url: z.string().url(),
});

// ── Strategy Correlation ──────────────────────────────────────────────────────

export const StrategyCorrelationSchemaV2 = z.object({
  strategyIds: z.array(z.string()),
  klines: z.array(z.any()).optional(),
  period: z.string().optional(),
});

// ── Unified Schema Registry ──────────────────────────────────────────────────
// 汇总所有 schema，供 main.ts 校验层统一调用

export const ipcSchemaMap = {
  // Broker
  'broker:connect': BrokerConnectSchema,
  'broker:getFunds': BrokerGetFundsSchema,
  'broker:getPositions': BrokerGetPositionsSchema,
  'broker:getQuotes': BrokerGetQuotesSchema,
  'broker:subscribe': BrokerSubscribeSchema,
  'broker:getKlines': BrokerGetKlinesSchema,
  'broker:placeOrder': BrokerPlaceOrderSchema,
  'broker:cancelOrder': BrokerCancelOrderSchema,
  'broker:switch': BrokerSwitchSchema,
  'broker:add': BrokerAddSchema,
  // Execution / Portfolio / Trader
  'execution:analyze': ExecutionAnalyzeSchema,
  'options:build': OptionsBuildSchema,
  'options:analyze': OptionsAnalyzeSchema,
  'portfolio:rebalance': PortfolioRebalanceSchema,
  'portfolio:rebalance-kelly': PortfolioRebalanceKellySchema,
  'portfolio:cost-analyze': PortfolioCostAnalyzeSchema,
  'portfolio:rar-optimize': PortfolioRarOptimizeSchema,
  'trader:execute': TraderExecuteSchema,
  'risk:cross-asset': RiskCrossAssetSchema,
  // Backtest
  'backtest:stability': BacktestStabilitySchema,
  'signal:quality-score': SignalQualityScoreSchema,
  'position:check': PositionCheckSchema,
  // Alert
  'alert:correlation': AlertCorrelationSchema,
  'alert:correlation-matrix': AlertCorrelationMatrixSchema,
  'alert:macro': AlertMacroSchema,
  'alert:macro-multiple': AlertMacroMultipleSchema,
  // Backfill
  'backfill:start': BackfillStartSchema,
  'backfill:incremental': BackfillIncrementalSchema,
  'backfill:symbols': BackfillSymbolsSchema,
  // Cache
  'cache:set': CacheSetSchema,
  'cache:get': CacheGetSchema,
  'cache:delete': CacheDeleteSchema,
  'cache:explore': CacheExploreSchema,
  'cache:keys-paginated': CacheKeysPaginatedSchema,
  // Data
  'data:regime': DataRegimeSchema,
  'data:capital-flow': DataCapitalFlowSchema,
  'data:quality-start-periodic': DataQualityStartSchema,
  'data:quality-stream-start': DataQualityStreamStartSchema,
  'data:quality-acknowledge': DataQualityAcknowledgeSchema,
  'data:save-anomaly': DataSaveAnomalySchema,
  'data:save-capital-flow': DataSaveCapitalFlowSchema,
  'data:save-fundamental': DataSaveFundamentalSchema,
  'data:save-news': DataSaveNewsSchema,
  'data:save-regime': DataSaveRegimeSchema,
  'data:export': DataExportSchema,
  'data:consistency-check': DataConsistencyCheckSchema,
  'data:consistency-rules': DataConsistencyRulesSchema,
  // EM
  'em:getFinancials': EmGetFinancialsSchema,
  'em:getValuation': EmGetValuationSchema,
  'em:implied-vol': EmImpliedVolSchema,
  'em:vol-surface': EmVolSurfaceSchema,
  'em:calc-greeks': EmCalcGreeksSchema,
  'em:calc-sharpe': EmCalcSharpeSchema,
  'em:calc-max-drawdown': EmCalcMaxDrawdownSchema,
  'em:calc-var': EmCalcVarSchema,
  'em:portfolio-attribution': EmPortfolioAttributionSchema,
  'em:correlation-matrix': EmCorrelationMatrixSchema,
  'em:sector-rotation': EmSectorRotationSchema,
  'em:diagnose-stock': EmDiagnoseStockSchema,
  'em:batch-diagnose': EmBatchDiagnoseSchema,
  'em:get-macro': EmGetMacroSchema,
  'em:get-heatmap': EmGetHeatmapSchema,
  'em:get-market-overview': EmGetMarketOverviewSchema,
  'em:get-news-aggregate': EmGetNewsAggregateSchema,
  'em:get-sentiment': EmGetSentimentSchema,
  'em:smart-pick': EmSmartPickSchema,
  'em:price-and-greeks': EmPriceAndGreeksSchema,
  'em:calc-risk-metrics': EmCalcRiskMetricsSchema,
  'em:backfill-start': EmBackfillStartSchema,
  // Factor
  'factor:score': FactorScoreSchema,
  'factor:screen': FactorScreenSchema,
  'factor:screen-batch': FactorScreenBatchSchema,
  // Live
  'live:add-strategy': LiveAddStrategySchema,
  'live:remove-strategy': LiveRemoveStrategySchema,
  'live:get-positions': LiveGetPositionsSchema,
  'live:get-orders': LiveGetOrdersSchema,
  // Notification
  'notification:summary': NotificationSummarySchema,
  // Paper
  'paper:start': PaperStartSchema,
  'paper:submit-order': PaperSubmitOrderSchema,
  'paper:execute-signal': PaperExecuteSignalSchema,
  // PnL
  'pnl:multi-broker': PnlMultiBrokerSchema,
  // Quote Stream
  'quote:subscribe': QuoteSubscribeSchema,
  'quote:unsubscribe': QuoteUnsubscribeSchema,
  'quote:stream-start': QuoteStreamStartSchema,
  // Screener
  'screener:search': ScreenerSearchSchema,
  // Sentiment
  'sentiment:dashboard': SentimentDashboardSchema,
  'sentiment:stream-start': SentimentStreamStartSchema,
  'sentiment:stream-alerts': SentimentStreamAlertsSchema,
  'sentiment:attribution': SentimentAttributionSchema,
  // Snapshot
  'snapshot:get': SnapshotGetSchema,
  'snapshot:delete': SnapshotDeleteSchema,
  'snapshot:compare': SnapshotCompareSchema,
  'snapshot:export': SnapshotExportSchema,
  'snapshot:import': SnapshotImportSchema,
  'snapshot:query': SnapshotQuerySchema,
  'snapshot:timeline': SnapshotTimelineSchema,
  // System
  'system:opend-health': SystemOpendHealthSchema,
  // WebSocket
  'ws:connect': WsConnectSchema,
  'ws:subscribe': WsSubscribeSchema,
  'ws:subscribe-batch': WsSubscribeBatchSchema,
  'ws:unsubscribe': WsUnsubscribeSchema,
  'ws:unsubscribe-batch': WsUnsubscribeBatchSchema,
  'ws:stream-start': WsStreamStartSchema,
  'ws:streaming-stats': WsStreamingStatsSchema,
  // Rate Limiter
  'rate-limiter:stats': RateLimiterStatsSchema,
  'rate-limiter:apis': RateLimiterApisSchema,
  // Push2
  'push2:get-stock-quote': Push2GetStockQuoteSchema,
  'push2:get-sector-heatmap': Push2GetSectorHeatmapSchema,
  'push2:get-capital-flow-rank': Push2GetCapitalFlowRankSchema,
  'push2:get-market-breadth': Push2GetMarketBreadthSchema,
  // Python Bridge
  'py:call-skill': PyCallSkillSchema,
  'py:list-skills': PyListSkillsSchema,
  // Anomaly
  'anomaly:detect': AnomalyDetectSchema,
  // Regime
  'regime:detect': RegimeDetectSchema,
  // Report
  'report:brinson-attribution': ReportBrinsonAttributionSchema,
  'report:brinson-batch': ReportBrinsonBatchSchema,
  'report:walk-forward': ReportWalkForwardSchema,
  'report:walk-forward-batch': ReportWalkForwardBatchSchema,
  // Strategy
  'strategy:backtest': StrategyBacktestSchema,
  'strategy:correlation-viz': StrategyCorrelationVizSchema,
  'strategy:templates': StrategyTemplatesSchema,
  'strategy:getAll': StrategyGetAllSchema,
  'strategy:multi-factor': StrategyMultiFactorSchema,
  'strategy:startLive': StrategyStartLiveSchema,
  'strategy:stopLive': StrategyStopLiveSchema,
  // Risk
  'risk:calculate-size': RiskCalculateSizeSchema,
  'risk:calculate-portfolio-sizes': RiskCalculatePortfolioSizesSchema,
  'risk:record-trade': RiskRecordTradeSchema,
  'risk:decompose': RiskDecomposeSchema,
  'risk:monteCarlo': RiskMonteCarloSchema,
  'risk:stress-test': RiskStressTestSchema,
  'risk:get-trade-history': RiskGetTradeHistorySchema,
  'risk:position-size': RiskPositionSizeSchema,
  // NL
  'nl:templates': NlTemplatesSchema,
  // Marketplace
  'marketplace:verify': MarketplaceVerifySchema,
  'marketplace:getRating': MarketplaceGetRatingSchema,
  'marketplace:getComments': MarketplaceGetCommentsSchema,
  'marketplace:score': MarketplaceScoreSchema,
  'marketplace:updateAllScores': MarketplaceUpdateAllScoresSchema,
  // Order
  'order:route': OrderRouteSchema,
  'order:tca': OrderTcaSchema,
  // Predict
  'predict:capital-flow': PredictCapitalFlowSchema,
  // Indicator
  'indicator:compute': IndicatorComputeSchema,
  'indicator:realtime-add': IndicatorRealtimeAddSchema,
  'indicator:realtime-add-batch': IndicatorRealtimeAddBatchSchema,
  'indicator:realtime-get-buffer': IndicatorRealtimeGetBufferSchema,
  // App
  'app:exportPdf': AppExportPdfSchema,
  'app:openExternal': AppOpenExternalSchema,
} as const;

// ── Schema Validator Utility ────────────────────────────────────────────────

/**
 * Validate IPC input against registered schema.
 * Returns parsed data on success, ZodError details on failure.
 * Falls back to z.any() if no schema registered.
 */
export function validateIpcInput<T = unknown>(
  channel: string,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const schema = (ipcSchemaMap as any)[channel];
  if (!schema) {
    // No schema registered — accept as-is
    return { success: true, data: input as T };
  }
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (err: any) {
    const issues = err.issues ?? [];
    const msg = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { success: false, error: msg };
  }
}

/**
 * Wrap an IPC handler with automatic schema validation.
 * Usage: ipcMain.handle('channel', withSchema('channel', async (e, data) => { ... }))
 */
export function withSchema<T = unknown>(
  channel: string,
  handler: (e: any, data: T) => Promise<any>
): (e: any, raw: unknown) => Promise<any> {
  return async (_e: any, raw: unknown) => {
    const result = validateIpcInput<T>(channel, raw);
    if (!result.success) {
      return { success: false, error: `[${channel}] Validation failed: ${(result as { success: false; error: string }).error}` };
    }
    return handler(_e, result.data);
  };
}

/**
 * List all channels that have registered schemas.
 */
export function getRegisteredChannels(): string[] {
  return Object.keys(ipcSchemaMap);
}

/**
 * Get coverage stats.
 */
export function getSchemaCoverage(totalHandlers: number): { registered: number; total: number; coverage: string } {
  const registered = Object.keys(ipcSchemaMap).length;
  return {
    registered,
    total: totalHandlers,
    coverage: `${((registered / totalHandlers) * 100).toFixed(1)}%`,
  };
}