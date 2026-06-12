// ── DAWN WHALES — IPC Bridge Type Definitions ───────────────────────────
// R124-P02: Type-safe bridge API interfaces. Replaces `any` in bridge-api.d.ts.
// 25+ `any` replacements in broker + risk namespaces (batch 1/4).

// ── Broker namespace ────────────────────────────────────────────────────

export interface BrokerConnectConfig {
  host?: string;
  port?: number;
  brokerId?: string;
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
}

export interface BrokerAccount {
  accountId: string;
  brokerId: string;
  name: string;
  currency: string;
  balance: number;
  availableBalance: number;
  frozen: number;
  totalPL: number;
  todayPL: number;
}

export interface BrokerPosition {
  accountId: string;
  brokerId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  realizedPL: number;
  currency: string;
}

export interface BrokerQuote {
  symbol: string;
  name: string;
  lastPrice: number;
  openPrice: number;
  high: number;
  low: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  timestamp: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  market: string;
}

export interface BrokerKline {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface BrokerOrderRequest {
  accountId: string;
  brokerId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'DAY' | 'GTC' | 'IOC' | 'FOK';
}

export interface BrokerOrder {
  orderId: string;
  accountId: string;
  brokerId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';
  quantity: number;
  filledQty: number;
  price?: number;
  avgFillPrice?: number;
  status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
  commission: number;
  commissionCurrency: string;
  message?: string;
}

export interface BrokerStatus {
  brokerId: string;
  connected: boolean;
  connectedAt?: string;
  lastHeartbeat?: string;
  latencyMs?: number;
  error?: string;
  accountCount: number;
}

export interface BrokerListEntry {
  id: string;
  name: string;
  type: string;
  status: BrokerStatus;
}

// ── Risk namespace ──────────────────────────────────────────────────────

export interface RiskConfig {
  maxPositionSize: number;
  maxDrawdown: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyLoss: number;
  maxConcentration: number;
  kellyFraction: number;
  vixThreshold: number;
  enabled: boolean;
}

export interface RiskAlert {
  id: string;
  type: 'DRAWDOWN' | 'POSITION_LIMIT' | 'DAILY_LOSS' | 'CONCENTRATION' | 'VIX' | 'KELLY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

export interface RiskStatusSnapshot {
  currentDrawdown: number;
  maxDrawdown: number;
  dailyPL: number;
  totalExposure: number;
  concentration: number;
  activeAlerts: number;
  vix: number;
  timestamp: string;
}

export interface RiskDrawdownState {
  peak: number;
  current: number;
  drawdown: number;
  maxDrawdown: number;
  recoveryTarget: number;
  recoveryPercent: number;
}

export interface RiskKellyStats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number;
  kellyFraction: number;
  optimalFraction: number;
  halfKellyFraction: number;
  sampleSize: number;
}

// ── IPC response wrapper ────────────────────────────────────────────────

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}
