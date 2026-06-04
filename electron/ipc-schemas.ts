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