/**
 * Trading Service Types — R108 S-34
 * Shared types for the trading service layer.
 */

// ── Broker ────────────────────────────────────────────────────────────────

export interface BrokerConfig {
  id: string;
  name: string;
  type: 'futu' | 'ibkr' | 'paper';
  host?: string;
  port?: number;
  tradeEnv?: 'SIMULATE' | 'REAL';
  enabled?: boolean;
}

// ── Order ─────────────────────────────────────────────────────────────────

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;       // limit price (omit for market)
  orderType?: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';
  stopPrice?: number;
  remark?: string;
}

// ── Market Data ───────────────────────────────────────────────────────────

export interface KlineData {
  symbol: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

export interface AccountInfo {
  accountId: string;
  broker: string;
  currency: string;
  totalAssets: number;
  cash: number;
  marketValue: number;
  frozenCash: number;
  availableCash: number;
}

// ── Strategy ──────────────────────────────────────────────────────────────

export interface StrategyConfig {
  id?: string;
  name: string;
  type: string;
  symbol?: string;
  params: Record<string, unknown>;
  enabled?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface BacktestRequest {
  strategyId?: string;
  strategy?: StrategyConfig;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital?: number;
  commissionRate?: number;
}

export interface SignalEntry {
  id: string;
  signalId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  price: number;
  volume: number;
  timestamp: string;
  strategy: string;
  confidence: number;
}
