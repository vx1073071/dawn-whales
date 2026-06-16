// R127-Q01: nocheck cleared — bridge-api IpcError widening (R107 S-26)
/**
 * @deprecated Use src/services/trading-service.ts and src/services/portfolio-service.ts instead (R108 S-34).
 * Service layer provides typed interfaces and abstracts IPC calls.
 *
 * ── quant-moo — Bridge API Trade Module ─────────────────────────────
 * S-15p1 split: Broker + Broker Manager + Strategy + Strategy CRUD + Signals
 * S-15p2: Zod-derived types replaced all `any` usage
 */

import type {
  IpcResponse,
  BrokerConnectParams,
  BrokerAddParams,
  BrokerInfo,
  BrokerPlaceOrderParams,
  StrategyCreateParams,
  StrategyUpdateParams,
  StrategyBacktestParams,
  StrategyInfo,
  GreeksCalculateParams,
  GreeksPortfolioParams,
  GreeksResult,
  SignalData,
} from '../../types/ipc';
import { hasIPC } from '../bridge-api-types';

// R224: Bridge IPC types are approximate — cast through any at boundary
const api = (window as any).api;
if (!api) {/* not in Electron */}
import { generateDemoKlines } from './data';

// ── Broker ─────────────────────────────────────────────────────────────────

export async function connectBroker(config?: BrokerConnectParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.broker.connect(config || { host: '127.0.0.1', port: 11111 });
}

export async function getKlines(code: string, period: string = 'daily', count: number = 200): Promise<unknown[]> {
  if (!hasIPC()) return generateDemoKlines(count);
  const result = await api.broker.getKlines(code, period, count);
  if (result?.success && Array.isArray(result.klines) && result.klines.length > 0) return result.klines;
  return generateDemoKlines(count);
}

export async function getAccounts(): Promise<IpcResponse<{ accounts: unknown[] }>> {
  if (!hasIPC()) return { success: false, accounts: [] } as any;
  const result = await api.broker.getAccounts();
  return result?.success ? result : { success: false, accounts: [] };
}

export async function getFunds(accountId: string): Promise<IpcResponse<{ funds: unknown }>> {
  if (!hasIPC()) return { success: false, funds: null } as any;
  const result = await api.broker.getFunds(accountId);
  return result?.success ? result : { success: false, funds: null };
}

export async function getPositions(accountId: string): Promise<IpcResponse<{ positions: unknown[] }>> {
  if (!hasIPC()) return { success: false, positions: [] } as any;
  const result = await api.broker.getPositions(accountId);
  return result?.success ? result : { success: false, positions: [] };
}

export async function getQuotes(codes: string[] = []): Promise<IpcResponse<{ quotes: unknown[] }>> {
  if (!hasIPC()) return { success: false, quotes: [] } as any;
  const result = await api.broker.getQuotes(codes);
  return result?.success ? result : { success: false, quotes: [] };
}

export async function subscribeQuotes(codes: string[]): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.broker.subscribe(codes);
}

export async function unsubscribeQuotes(codes: string[]): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.broker.unsubscribe(codes);
}

export async function getWatchlist(): Promise<string[]> {
  if (!hasIPC()) return [];
  const result = await api.db.getWatchlist();
  return Array.isArray(result) ? result : [];
}

export async function saveWatchlist(codes: string[]): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.db.saveWatchlist(codes);
}

export async function calculateGreeks(params: GreeksCalculateParams): Promise<IpcResponse<GreeksResult>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.greeks.calculate(params);
}

export async function calculatePortfolioGreeks(positions: GreeksPortfolioParams['positions']): Promise<IpcResponse<{ greeks: GreeksResult[] }>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.greeks.portfolio(positions);
}

export async function getOrders(accountId: string): Promise<IpcResponse<{ orders: unknown[] }>> {
  if (!hasIPC()) return { success: false, orders: [] } as any;
  return api.broker.getOrders(accountId);
}

export async function cancelOrder(orderId: string): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.broker.cancelOrder(orderId);
}

export async function placeOrder(order: BrokerPlaceOrderParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'No IPC' } as any;
  return api.broker.placeOrder(order);
}

export async function isConnected(): Promise<boolean> {
  if (!hasIPC()) return false;
  try {
    const result = await api.broker.getAccounts();
    return result?.success === true;
  } catch (_e: unknown) { return false; }
}

// ── Broker Manager (Sprint1: multi-broker) ───────────────────────────────

export async function listBrokers(): Promise<IpcResponse<{ brokers: BrokerInfo[] }>> {
  if (!hasIPC()) return { success: false, brokers: [] } as any;
  const result = await api.broker.list();
  return result?.success ? result : { success: false, brokers: [] };
}

export async function addBroker(cfg: BrokerAddParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.broker.add(cfg);
}

export async function removeBroker(id: string): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.broker.remove(id);
}

export async function setActiveBroker(id: string): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.broker.setActive(id);
}

export async function getBrokerStatus(): Promise<IpcResponse<{ status: unknown[] }>> {
  if (!hasIPC()) return { success: false, status: [] } as any;
  const result = await api.broker.getStatus();
  return result?.success ? result : { success: false, status: [] };
}

// ── Strategy ───────────────────────────────────────────────────────────────

export async function createStrategy(input: StrategyCreateParams): Promise<IpcResponse<StrategyInfo>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.strategy.create(input);
}

export async function getAllStrategies(): Promise<IpcResponse<{ strategies: StrategyInfo[] }>> {
  if (!hasIPC()) return { success: false, strategies: [] } as any;
  const result = await api.strategy.getAll();
  return result?.success ? result : { success: false, strategies: [] };
}

export async function runBacktest(config: StrategyBacktestParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.strategy.backtest(config);
}

export async function startLive(strategyId: string): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.strategy.startLive(strategyId);
}

export async function stopLive(strategyId: string): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return api.strategy.stopLive(strategyId);
}

// ── Strategy CRUD ────────────────────────────────────────────────────────────

export async function getStrategies(): Promise<IpcResponse<{ strategies: StrategyInfo[] }>> {
  if (!hasIPC()) return { success: false, strategies: [] } as any;
  const result = await api.strategy.getAll();
  return result?.success ? result : { success: false, strategies: [] };
}

export async function updateStrategy(id: string, updates: StrategyUpdateParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.strategy.update?.(id, updates) || { success: false, error: 'Not implemented' };
}

export async function deleteStrategy(id: string): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' } as any;
  return api.strategy.delete(id);
}

// ── Signals ─────────────────────────────────────────────────────────────────

export async function getSignals(strategyId?: string): Promise<SignalData[]> {
  if (!hasIPC()) return [];
  const result = await api.db.getSignals(strategyId);
  return Array.isArray(result) ? result : [];
}
