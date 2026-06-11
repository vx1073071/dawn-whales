/**
 * Trading Service — R108 S-34
 *
 * Centralized service layer for trading operations.
 * Wraps bridge-api IPC calls with type-safe interfaces.
 *
 * Components should import from here instead of calling bridge-api directly.
 *
 * @see src/lib/bridge-api/trade.ts
 */

import * as tradeBridge from '../lib/bridge-api/trade';
import type {
  BrokerConfig, OrderRequest, StrategyConfig,
  BacktestRequest, QuoteData, Position, AccountInfo,
  KlineData, SignalEntry,
} from './trading-types';

// ═══════════════════════════════════════════════════════════════════════════
// Broker Connection
// ═══════════════════════════════════════════════════════════════════════════

export const brokerService = {
  /** Connect to a broker (Futu OpenD / IBKR / paper) */
  connect: (config: BrokerConfig) => tradeBridge.connectBroker(config),

  /** Check if any broker is connected */
  isConnected: () => tradeBridge.isConnected(),

  /** List all configured brokers */
  list: () => tradeBridge.listBrokers(),

  /** Add a new broker configuration */
  add: (config: BrokerConfig) => tradeBridge.addBroker(config),

  /** Remove a broker */
  remove: (brokerId: string) => tradeBridge.removeBroker(brokerId),

  /** Set the active broker for trading */
  setActive: (brokerId: string) => tradeBridge.setActiveBroker(brokerId),

  /** Get broker status (connection, health, latency) */
  getStatus: () => tradeBridge.getBrokerStatus(),
};

// ═══════════════════════════════════════════════════════════════════════════
// Market Data
// ═══════════════════════════════════════════════════════════════════════════

export const marketDataService = {
  /** Get K-line (candlestick) data */
  getKlines: (params: { symbol: string; period: string; count?: number }) =>
    tradeBridge.getKlines(params),

  /** Get real-time quotes for symbols */
  getQuotes: (symbols: string[]) => tradeBridge.getQuotes(symbols),

  /** Subscribe to real-time quote updates */
  subscribe: (symbols: string[]) => tradeBridge.subscribeQuotes(symbols),

  /** Unsubscribe from quote updates */
  unsubscribe: (symbols: string[]) => tradeBridge.unsubscribeQuotes(symbols),
};

// ═══════════════════════════════════════════════════════════════════════════
// Account & Portfolio
// ═══════════════════════════════════════════════════════════════════════════

export const accountService = {
  /** Get all broker accounts */
  getAccounts: () => tradeBridge.getAccounts(),

  /** Get account funds/balance */
  getFunds: () => tradeBridge.getFunds(),

  /** Get current positions */
  getPositions: () => tradeBridge.getPositions(),

  /** Get trading history */
  getTradeHistory: (params?: { limit?: number; symbol?: string }) =>
    tradeBridge.getTradeHistory(params || {}),
};

// ═══════════════════════════════════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════════════════════════════════

export const orderService = {
  /** Place a new order */
  place: (order: OrderRequest) => tradeBridge.placeOrder(order),

  /** Cancel an existing order */
  cancel: (orderId: string) => tradeBridge.cancelOrder(orderId),

  /** Get order list (active + recent) */
  getOrders: () => tradeBridge.getOrders(),
};

// ═══════════════════════════════════════════════════════════════════════════
// Watchlist
// ═══════════════════════════════════════════════════════════════════════════

export const watchlistService = {
  /** Get user watchlist */
  get: () => tradeBridge.getWatchlist(),

  /** Save/update watchlist */
  save: (symbols: string[]) => tradeBridge.saveWatchlist(symbols),
};

// ═══════════════════════════════════════════════════════════════════════════
// Strategy
// ═══════════════════════════════════════════════════════════════════════════

export const strategyService = {
  /** Create a new trading strategy */
  create: (config: StrategyConfig) => tradeBridge.createStrategy(config),

  /** Get all strategies */
  getAll: () => tradeBridge.getAllStrategies(),

  /** Get specific strategies */
  get: (ids?: string[]) => tradeBridge.getStrategies(ids || []),

  /** Update an existing strategy */
  update: (id: string, config: Partial<StrategyConfig>) =>
    tradeBridge.updateStrategy(id, config),

  /** Delete a strategy */
  delete: (id: string) => tradeBridge.deleteStrategy(id),

  /** Run a backtest */
  runBacktest: (params: BacktestRequest) => tradeBridge.runBacktest(params),

  /** Start live trading for a strategy */
  startLive: (strategyId: string) => tradeBridge.startLive(strategyId),

  /** Stop live trading */
  stopLive: (strategyId: string) => tradeBridge.stopLive(strategyId),

  /** Get signals from strategies */
  getSignals: () => tradeBridge.getSignals(),
};

// ═══════════════════════════════════════════════════════════════════════════
// Barrel re-export
// ═══════════════════════════════════════════════════════════════════════════

export type {
  BrokerConfig, OrderRequest, StrategyConfig, BacktestRequest,
  QuoteData, Position, AccountInfo, KlineData, SignalEntry,
} from './trading-types';
