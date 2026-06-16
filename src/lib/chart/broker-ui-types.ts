// ── quant-moo — Broker UI Types (R120 #22 + #23) ────────────────────
// Type definitions for ML UI components:
//   #22 SignalProviderDashboard — 跟单信号源可视化
//   #23 BrokerManager+Portfolio  — 跨券商持仓总览
//
// @author QClaw (document-shrimp)
// @round R120
// @tasks #22 (SignalProvider/SignalStats/TradeHistory) + #23 (PortfolioSummary/AssetAllocation/BrokerHolding)
// @since 2026-06-12
// @tsc 0 — designed for npx tsc --noEmit clean pass
//
// ═══════════════════════════════════════════════════════════════════════
// USAGE GUIDE
// ═══════════════════════════════════════════════════════════════════════
//
// ML UI:
//   import type { SignalProvider, SignalStats, TradeHistory } from '../../lib/chart/broker-ui-types';
//   import type { PortfolioSummary, AssetAllocation, BrokerHolding } from '../../lib/chart/broker-ui-types';
//
// IPC:
//   ipcMain.handle('broker:getSignalProviders', (): Promise<SignalProvider[]> => {...});
//   ipcMain.handle('broker:getPortfolioSummary', (): Promise<PortfolioSummary> => {...});
//
// Engine (electron/broker/):
//   import type { SignalProvider, PortfolioSummary } from '@src/lib/chart/broker-ui-types';
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// NOTE: tsconfig isolates src/ from electron/. BrokerType defined locally
// to match electron/broker/IBrokerAdapterV2.ts. Keep in sync.
// ═══════════════════════════════════════════════════════════════════════

/** Broker type identifier — synced with electron/broker/IBrokerAdapterV2.ts */
export type BrokerType =
  | 'futu' | 'moomoo' | 'ib' | 'longbridge'
  | 'tiger' | 'vbkr' | 'usmart'
  | 'binance' | 'okx' | 'bybit' | 'bitget'
  | 'schwab' | 'etrade' | 'etoro' | 'webull'
  | 'robinhood'
  | 'mt5';

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: Signal Provider (跟单信号源) — R120 #22
// ═══════════════════════════════════════════════════════════════════════

/** Risk tolerance for signal providers */
export type SignalRiskLevel = 'conservative' | 'moderate' | 'aggressive' | 'extreme';

/** Signal subscription tier with copy-trade limits */
export type SignalTier = 'free' | 'basic' | 'pro' | 'elite';

/** Copy-trade execution mode */
export type CopyTradeMode = 'manual' | 'semi-auto' | 'full-auto';

/** Verified status of a signal provider */
export type ProviderVerification = 'unverified' | 'pending' | 'verified' | 'featured';

/** A trade signal emitted by a provider */
export interface TradeSignal {
  /** Unique signal ID */
  signalId: string;
  /** Provider who emitted this signal */
  providerId: string;
  /** Trade symbol (e.g. HK.00700, US.AAPL) */
  symbol: string;
  /** Market the symbol belongs to */
  market: 'HK' | 'US' | 'CN' | 'JP' | 'SG' | 'UK' | 'crypto';
  /** Direction: long or short */
  direction: 'long' | 'short';
  /** Signal type */
  type: 'entry' | 'exit' | 'adjust' | 'alert';
  /** Entry price (null for exit signals) */
  entryPrice: number | null;
  /** Exit price (null for entry signals) */
  exitPrice: number | null;
  /** Stop-loss price */
  stopLoss: number | null;
  /** Take-profit price */
  takeProfit: number | null;
  /** Position size ratio (0.01 = 1%) */
  positionRatio: number;
  /** Confidence 0-1 */
  confidence: number;
  /** Signal reason / analysis notes (markdown) */
  reason: string;
  /** Timestamp (ISO 8601) */
  createdAt: string;
  /** Expiration (ISO 8601, null = no expiry) */
  expiresAt: string | null;
  /** Whether this signal has been executed by follower */
  executed: boolean;
  /** Tags for filtering */
  tags: string[];
}

/** Core signal provider profile */
export interface SignalProvider {
  /** Unique provider ID */
  providerId: string;
  /** Display name */
  name: string;
  /** Avatar URL (or null for default) */
  avatarUrl: string | null;
  /** Primary broker(s) the provider trades on */
  brokers: BrokerType[];
  /** Primary market focus */
  primaryMarket: 'HK' | 'US' | 'CN' | 'JP' | 'crypto' | 'global';
  /** Trading style */
  style: 'day-trade' | 'swing' | 'position' | 'scalping' | 'quant' | 'mixed';
  /** Strategy name (e.g. "Dual EMA Crossover") */
  strategyName: string;
  /** Strategy description (1-2 sentences) */
  strategySummary: string;
  /** Full strategy description (markdown) */
  description: string;
  /** Verification status */
  verification: ProviderVerification;
  /** Subscription tier */
  tier: SignalTier;
  /** Monthly subscription cost in USDT */
  monthlyFee: number;
  /** Follower count */
  followerCount: number;
  /** Total AUM following this provider (USDT) */
  totalAUM: number;
  /** Days since first signal */
  daysActive: number;
  /** Minimum AUM to subscribe */
  minAUMToSubscribe: number;
  /** Profile tags */
  tags: string[];
  /** Creation date (ISO 8601) */
  createdAt: string;
  /** Last active timestamp */
  lastActiveAt: string;
  /** Aggregated performance statistics */
  stats: SignalStats;
  /** Recent signals (last 10) */
  recentSignals: TradeSignal[];
  /** Active (not expired) signals count */
  activeSignals: number;
}

/** Signal provider performance statistics */
export interface SignalStats {
  /** All-time cumulative return (ratio, e.g. 0.42 = 42%) */
  totalReturn: number;
  /** Annualized return (ratio) */
  annualizedReturn: number;
  /** Total trades executed */
  totalTrades: number;
  /** Winning trades count */
  winningTrades: number;
  /** Losing trades count */
  losingTrades: number;
  /** Win rate (0-1) */
  winRate: number;
  /** Average return per winning trade (ratio) */
  avgWinReturn: number;
  /** Average return per losing trade (ratio, negative) */
  avgLossReturn: number;
  /** Sharpe ratio (risk-adjusted return) */
  sharpeRatio: number;
  /** Sortino ratio (downside risk-adjusted) */
  sortinoRatio: number;
  /** Calmar ratio (return / max drawdown) */
  calmarRatio: number;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Maximum drawdown percentage (0-1, e.g. 0.15 = -15%) */
  maxDrawdown: number;
  /** Maximum consecutive wins */
  maxConsecutiveWins: number;
  /** Maximum consecutive losses */
  maxConsecutiveLosses: number;
  /** Average holding time in hours */
  avgHoldTimeHours: number;
  /** Monthly returns history (last 12 months, ISO "YYYY-MM" → return ratio) */
  monthlyReturns: Record<string, number>;
  /** Daily volatility (standard deviation of daily returns) */
  dailyVolatility: number;
  /** Beta relative to benchmark (market sensitivity) */
  beta: number;
  /** Alpha (excess return over benchmark) */
  alpha: number;
  /** Information ratio */
  informationRatio: number;
  /** Last updated timestamp (ISO 8601) */
  updatedAt: string;
}

/** A completed trade in a provider's history */
export interface TradeHistory {
  /** Unique trade ID */
  tradeId: string;
  /** Provider who executed this trade */
  providerId: string;
  /** Symbol traded */
  symbol: string;
  /** Market */
  market: 'HK' | 'US' | 'CN' | 'JP' | 'SG' | 'UK' | 'crypto';
  /** Direction */
  direction: 'long' | 'short';
  /** Entry time (ISO 8601) */
  entryTime: string;
  /** Entry price */
  entryPrice: number;
  /** Exit time (ISO 8601) */
  exitTime: string;
  /** Exit price */
  exitPrice: number;
  /** Quantity */
  quantity: number;
  /** Gross P&L (in quote currency) */
  grossPnL: number;
  /** P&L percentage (ratio) */
  pnlPercent: number;
  /** Fees paid */
  fees: number;
  /** Net P&L after fees */
  netPnL: number;
  /** Whether this was a winning trade */
  isWin: boolean;
  /** Stop-loss price (null if not set) */
  stopLoss: number | null;
  /** Take-profit price (null if not set) */
  takeProfit: number | null;
  /** Holding time in hours */
  holdTimeHours: number;
  /** Trade tags */
  tags: string[];
  /** Strategy context (e.g. "breakout", "reversal") */
  strategyContext: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: Portfolio & Broker Holdings (跨券商持仓总览) — R120 #23
// ═══════════════════════════════════════════════════════════════════════

/** Currency type for portfolio values */
export type PortfolioCurrency = 'USD' | 'HKD' | 'CNY' | 'USDT' | 'JPY' | 'EUR' | 'GBP';

/** Asset class categorization */
export type AssetClass =
  | 'stock'       // 正股
  | 'etf'         // ETF
  | 'warrant'     // 涡轮/牛熊证
  | 'option'      // 期权
  | 'future'      // 期货
  | 'crypto'      // 加密货币
  | 'forex'       // 外汇
  | 'bond'        // 债券
  | 'fund'        // 基金
  | 'cash'        // 现金
  | 'other';      // 其他

/** A single position/holding */
export interface BrokerHolding {
  /** Symbol code */
  symbol: string;
  /** Display name (e.g. 腾讯控股) */
  name: string;
  /** Broker holding this position */
  brokerId: string;
  /** Broker display name */
  brokerName: string;
  /** Broker type */
  brokerType: BrokerType;
  /** Market */
  market: 'HK' | 'US' | 'CN' | 'JP' | 'SG' | 'UK' | 'crypto';
  /** Asset class */
  assetClass: AssetClass;
  /** Quantity held */
  quantity: number;
  /** Average cost price */
  avgCost: number;
  /** Current market price */
  currentPrice: number;
  /** Currency of the holding */
  currency: PortfolioCurrency;
  /** Market value (quantity × currentPrice) in local currency */
  marketValue: number;
  /** Cost value (quantity × avgCost) in local currency */
  costValue: number;
  /** Unrealized P&L in local currency */
  unrealizedPnL: number;
  /** Unrealized P&L percentage (ratio, e.g. 0.15 = +15%) */
  unrealizedPnLPct: number;
  /** Realized P&L today in local currency */
  realizedPnLToday: number;
  /** Change percent today (ratio) */
  changePctToday: number;
  /** Weight in total portfolio (0-1) */
  portfolioWeight: number;
  /** Whether this is a short position */
  isShort: boolean;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Per-broker allocation summary */
export interface BrokerAllocation {
  /** Broker ID */
  brokerId: string;
  /** Broker display name */
  brokerName: string;
  /** Broker type */
  brokerType: BrokerType;
  /** Connection status */
  connected: boolean;
  /** Total value across all holdings in this broker (in display currency) */
  totalValue: number;
  /** Total unrealized P&L (in display currency) */
  totalPnL: number;
  /** P&L percentage (ratio) */
  totalPnLPct: number;
  /** Weight in total portfolio (0-1) */
  weight: number;
  /** Holdings count in this broker */
  holdingsCount: number;
  /** Currency the broker reports in */
  currency: PortfolioCurrency;
  /** Account ID(s) under this broker */
  accountIds: string[];
  /** Available cash balance (in broker currency) */
  cashBalance: number;
  /** Margin used (ratio, 0-1) */
  marginUsed: number;
  /** Holdings breakdown */
  holdings: BrokerHolding[];
}

/** Per-market allocation */
export interface MarketAllocation {
  /** Market identifier */
  market: 'HK' | 'US' | 'CN' | 'JP' | 'SG' | 'UK' | 'crypto';
  /** Total value across all brokers in this market */
  totalValue: number;
  /** Total P&L in this market */
  totalPnL: number;
  /** Weight in total portfolio (0-1) */
  weight: number;
  /** Holdings count */
  holdingsCount: number;
  /** Broken down by broker */
  brokers: {
    brokerId: string;
    brokerName: string;
    value: number;
    weight: number;
  }[];
}

/** Per-asset-class allocation */
export interface AssetClassAllocation {
  /** Asset class */
  assetClass: AssetClass;
  /** Total value across all holdings of this class */
  totalValue: number;
  /** Total P&L for this class */
  totalPnL: number;
  /** Weight in total portfolio (0-1) */
  weight: number;
  /** Holdings count */
  holdingsCount: number;
}

/** Daily P&L history point */
export interface DailyPnLPoint {
  /** Date (ISO "YYYY-MM-DD") */
  date: string;
  /** Total portfolio value end of day */
  totalValue: number;
  /** Daily P&L */
  dailyPnL: number;
  /** Cumulative P&L since tracking start */
  cumulativePnL: number;
  /** Daily return percentage (ratio) */
  dailyReturn: number;
}

/** Full portfolio summary aggregating all brokers */
export interface PortfolioSummary {
  /** Total portfolio value in display currency */
  totalValue: number;
  /** Total cost basis */
  totalCost: number;
  /** Total unrealized P&L */
  totalUnrealizedPnL: number;
  /** Total unrealized P&L percentage (ratio) */
  totalUnrealizedPnLPct: number;
  /** Today's P&L */
  todayPnL: number;
  /** Today's return percentage (ratio) */
  todayReturn: number;
  /** Display/base currency for all values */
  displayCurrency: PortfolioCurrency;
  /** Number of connected brokers */
  connectedBrokers: number;
  /** Total number of registered brokers */
  totalBrokers: number;
  /** Total holdings across all brokers */
  totalHoldings: number;
  /** Total available cash (in display currency) */
  totalCash: number;
  /** Overall margin usage (ratio, 0-1) */
  overallMarginUsed: number;
  /** Key performance metrics */
  metrics: PortfolioMetrics;
  /** Per-broker allocation */
  brokerAllocations: BrokerAllocation[];
  /** Per-market allocation */
  marketAllocations: MarketAllocation[];
  /** Per-asset-class allocation */
  assetClassAllocations: AssetClassAllocation[];
  /** Top 10 holdings by value */
  topHoldings: BrokerHolding[];
  /** Daily P&L history (last 30 days) */
  dailyPnLHistory: DailyPnLPoint[];
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** Portfolio-level performance metrics */
export interface PortfolioMetrics {
  /** All-time cumulative return (ratio) */
  totalReturn: number;
  /** Annualized return (ratio) */
  annualizedReturn: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Sortino ratio */
  sortinoRatio: number;
  /** Calmar ratio */
  calmarRatio: number;
  /** Maximum drawdown (ratio) */
  maxDrawdown: number;
  /** Daily volatility (ratio) */
  dailyVolatility: number;
  /** Win rate on closed positions (ratio) */
  winRate: number;
  /** Profit factor */
  profitFactor: number;
  /** Average holding period in days */
  avgHoldDays: number;
  /** Beta to benchmark */
  beta: number;
  /** Alpha */
  alpha: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: IPC Interface Types (R120 #23)
// ═══════════════════════════════════════════════════════════════════════

/** IPC request: fetch portfolio summary */
export interface IpcPortfolioRequest {
  /** Display currency override (defaults to user preference) */
  displayCurrency?: PortfolioCurrency;
  /** Include daily P&L history */
  includeHistory?: boolean;
  /** History days count (default 30, max 365) */
  historyDays?: number;
}

/** IPC request: fetch signal providers list */
export interface IpcSignalProvidersRequest {
  /** Filter by broker type */
  brokerFilter?: BrokerType[];
  /** Filter by market */
  marketFilter?: string[];
  /** Filter by risk level */
  riskFilter?: SignalRiskLevel[];
  /** Filter by tier */
  tierFilter?: SignalTier[];
  /** Minimum win rate (0-1) */
  minWinRate?: number;
  /** Sort field */
  sortBy?: 'totalReturn' | 'sharpeRatio' | 'winRate' | 'followerCount' | 'totalAUM';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Page for pagination */
  page?: number;
  /** Items per page */
  pageSize?: number;
}

/** IPC response: signal providers list */
export interface IpcSignalProvidersResponse {
  /** Signal providers matching the query */
  providers: SignalProvider[];
  /** Total count matching query (before pagination) */
  total: number;
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has more pages */
  hasMore: boolean;
}

/** IPC request: provider trade history */
export interface IpcTradeHistoryRequest {
  /** Provider ID */
  providerId: string;
  /** Start date (ISO 8601) */
  startDate?: string;
  /** End date (ISO 8601) */
  endDate?: string;
  /** Filter: winning trades only */
  winsOnly?: boolean;
  /** Filter by symbol */
  symbol?: string;
  /** Sort by */
  sortBy?: 'entryTime' | 'pnlPercent' | 'holdTimeHours';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Page */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/** IPC response: provider trade history */
export interface IpcTradeHistoryResponse {
  trades: TradeHistory[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** IPC request: update broker allocation (subscribe/unsubscribe from signal provider) */
export interface IpcSubscribeProviderRequest {
  providerId: string;
  brokerId: string;
  copyTradeMode: CopyTradeMode;
  maxPositionRatio: number;  // 0.01 = 1% of portfolio
  maxDrawdownLimit: number;  // stop following if drawdown exceeds this
}

/** IPC response: subscribe to signal provider result */
export interface IpcSubscribeProviderResponse {
  success: boolean;
  subscriptionId: string | null;
  error: string | null;
  nextBillingDate: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: Convenience Types (R120 #22 + #23)
// ═══════════════════════════════════════════════════════════════════════

/** Performance tier label for display */
export function getPerformanceTier(winRate: number, sharpeRatio: number): 'diamond' | 'gold' | 'silver' | 'bronze' | 'unranked' {
  if (winRate >= 0.70 && sharpeRatio >= 2.5) return 'diamond';
  if (winRate >= 0.60 && sharpeRatio >= 2.0) return 'gold';
  if (winRate >= 0.55 && sharpeRatio >= 1.5) return 'silver';
  if (winRate >= 0.50 && sharpeRatio >= 1.0) return 'bronze';
  return 'unranked';
}

/** Currency symbol map for display */
export const CURRENCY_SYMBOLS: Record<PortfolioCurrency, string> = {
  USD: '$', HKD: 'HK$', CNY: '¥', USDT: '₮', JPY: '¥', EUR: '€', GBP: '£',
};

/** Asset class display labels */
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  stock: '正股', etf: 'ETF', warrant: '涡轮/牛熊', option: '期权',
  future: '期货', crypto: '加密货币', forex: '外汇', bond: '债券',
  fund: '基金', cash: '现金', other: '其他',
};

/** Asset class color hex for charts */
export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  stock: '#3b82f6', etf: '#22c55e', warrant: '#f59e0b', option: '#ef4444',
  future: '#8b5cf6', crypto: '#ec4899', forex: '#06b6d4', bond: '#84cc16',
  fund: '#14b8a6', cash: '#64748b', other: '#94a3b8',
};

/** Market display labels */
export const MARKET_LABELS: Record<string, string> = {
  HK: '港股', US: '美股', CN: '中国', JP: '日股', SG: '新加坡', UK: '英股', crypto: '加密货币',
};

/** Risk level display labels */
export const RISK_LABELS: Record<SignalRiskLevel, string> = {
  conservative: '保守', moderate: '稳健', aggressive: '激进', extreme: '极限',
};

/** Tier display labels */
export const TIER_LABELS: Record<SignalTier, string> = {
  free: '免费', basic: '基础', pro: '专业', elite: '精英',
};

/** Verification badge labels */
export const VERIFICATION_LABELS: Record<ProviderVerification, string> = {
  unverified: '未认证', pending: '审核中', verified: '已认证', featured: '精选',
};
