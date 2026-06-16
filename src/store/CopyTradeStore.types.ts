// ── quant-moo CopyTradeStore Types ──────────────────────────────────
// R137-P02: Unified Zustand store types for all 12 copy-trade components
// Replaces scattered localStorage + per-component mock data

// ── Core types shared across all components ──────────────────────────

export interface CopyTradeProvider {
  id: string;
  name: string;
  avatar?: string;
  exchange: string;
  verified: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  category: 'trend' | 'momentum' | 'arbitrage' | 'mean-reversion' | 'mixed';
  stats: {
    totalReturn: number;      // % total
    winRate: number;          // %
    sharpeRatio: number;
    maxDrawdown: number;      // %
    totalTrades: number;
    avgHoldingHours: number;
    followerCount: number;
    profitSplit: number;      // % to creator
    dailyFee: number;         // USDT subscription
  };
}

export interface CopyTradeSignal {
  id: string;
  providerId: string;
  providerName: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  confidence: number;         // 0-1
  priority: 'P0' | 'P1' | 'P2';
  brokerType: 'cloud' | 'opend';
  sourceBrokerId: string;
  targetBrokerId: string;
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'dead';
  createdAt: string;
  executedAt?: string;
  errorMessage?: string;
}

export interface CopyTradeConfig {
  providerId: string;
  brokerId: string;
  accountLabel: string;
  maxAmountPerTrade: number;  // USDT
  maxPositionSize: number;    // total USDT
  stopLossPct: number;        // %
  takeProfitPct: number;      // %
  maxDailyLoss: number;       // USDT
  maxConsecutiveLoss: number;
  enabled: boolean;
  mode: 'live' | 'paper';     // live trading or paper simulation
  createdAt: string;
  updatedAt: string;
}

export interface CopyTradeNotification {
  id: string;
  type: 'executed' | 'failed' | 'paused' | 'stopped' | 'limit_reached' | 'dead_letter';
  severity: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  signalId?: string;
  brokerId?: string;
  providerId?: string;
  timestamp: string;
  read: boolean;
}

export interface CopyTradeExecution {
  id: string;
  signalId: string;
  providerId: string;
  providerName: string;
  brokerId: string;
  brokerName: string;
  accountLabel: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string;
  status: 'executed' | 'failed' | 'cancelled';
  profitLoss?: number;
  profitLossPct?: number;
  executedAt: string;
}

export interface CopyTradeSummary {
  totalAsset: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  todayPnL: number;
  todayPnLPct: number;
  activeConfigs: number;
  pausedConfigs: number;
  signalsToday: number;
  executedToday: number;
  failedToday: number;
  bestProvider?: { id: string; name: string; pnl: number };
  worstProvider?: { id: string; name: string; pnl: number };
}

// ── Kill Switch state ────────────────────────────────────────────────

export interface KillSwitchState {
  active: boolean;
  activatedAt?: string;
  reason: 'manual' | 'daily_loss' | 'consecutive_loss' | 'circuit_breaker' | 'api_error';
  message?: string;
}

// ── Dead letter state ────────────────────────────────────────────────

export interface DeadLetterState {
  total: number;
  unresolved: number;
  lastUpdated: string;
}

// ── IPC interface (server ↔ desktop) ─────────────────────────────────

export interface CopyTradeIpc {
  // Config
  'copytrade:config:getAll': () => Promise<CopyTradeConfig[]>;
  'copytrade:config:save': (config: CopyTradeConfig) => Promise<void>;
  'copytrade:config:delete': (providerId: string, brokerId: string) => Promise<void>;

  // Providers
  'copytrade:providers:list': (sortBy?: string) => Promise<CopyTradeProvider[]>;
  'copytrade:providers:get': (id: string) => Promise<CopyTradeProvider>;

  // Signals
  'copytrade:signals:pending': (brokerType?: 'cloud' | 'opend') => Promise<CopyTradeSignal[]>;
  'copytrade:signals:execute': (signalId: string, brokerId: string) => Promise<void>;
  'copytrade:signals:cancel': (signalId: string) => Promise<void>;

  // Executions
  'copytrade:executions:list': (filters?: {
    startDate?: string; endDate?: string; brokerId?: string; providerId?: string;
  }) => Promise<CopyTradeExecution[]>;

  // Summary
  'copytrade:summary': () => Promise<CopyTradeSummary>;

  // Kill Switch
  'copytrade:killswitch:toggle': (active: boolean) => Promise<void>;
  'copytrade:killswitch:status': () => Promise<KillSwitchState>;

  // Notifications
  'copytrade:notifications:list': (unreadOnly?: boolean) => Promise<CopyTradeNotification[]>;
  'copytrade:notifications:markRead': (id: string) => Promise<void>;

  // Dead Letters
  'copytrade:deadletter:list': () => Promise<CopyTradeSignal[]>;
  'copytrade:deadletter:retry': (id: string) => Promise<void>;

  // Events (server → desktop push)
  'copytrade:event': (event: {
    type: 'signal_new' | 'executed' | 'failed' | 'killswitch' | 'dead_letter' | 'circuit_breaker';
    payload: unknown;
  }) => void;
}
