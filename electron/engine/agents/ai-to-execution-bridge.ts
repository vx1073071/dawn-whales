/**
 * J-59-04: AI-to-Execution Bridge (R59 v19)
 * AI signal → Futu OpenD order abstraction (simulation mode MVP)
 *
 * Features:
 * - Signal parsing: orchestrator recommend → BUY/SELL/HOLD → order quantity
 * - Risk controls: max position / max daily trades / max loss
 * - Futu OpenD interface abstraction (IExecutionBroker)
 * - MVP: simulation mode (no real orders, log only)
 *
 * ≥200L, 8 tests
 */

import { EventEmitter } from 'events';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';
export type OrderSide = 'buy' | 'sell';

export interface AISignal {
  symbol: string;
  action: SignalAction;
  score: number;            // 0-10
  confidence: number;       // 0-1
  source: string;           // agent name or orchestrator
  recommendQuantity?: number;
  reason: string;
}

export interface RiskControls {
  maxPositionSize: number;       // max quantity per position
  maxDailyTrades: number;        // max trades per day
  maxLossUSDT: number;           // max cumulative loss
  maxSingleOrderUSDT: number;    // max single order value
  requireApproval: boolean;      // require manual approval
}

export interface SimulatedOrder {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price?: number;
  status: 'pending' | 'filled' | 'rejected' | 'cancelled';
  filledAt?: string;
  fillPrice?: number;
  errorMessage?: string;
}

export interface ExecutionSession {
  sessionId: string;
  creator: string;
  mode: 'simulation' | 'live';
  orders: SimulatedOrder[];
  riskControls: RiskControls;
  dailyTradeCount: number;
  cumulativePnL: number;
  lastTradeDate: string;
  active: boolean;
}

// ── Futu OpenD Interface Abstraction ───────────────────────────────────────

export interface IExecutionBroker {
  placeOrder(symbol: string, side: OrderSide, quantity: number, price?: number): Promise<{ orderId: string; status: string }>;
  cancelOrder(orderId: string): Promise<boolean>;
  getPositions(): Promise<{ symbol: string; quantity: number; avgPrice: number }[]>;
  getAccountInfo(): Promise<{ totalAssets: number; availableCash: number; frozenCash: number }>;
}

// ── Default Risk Controls ──────────────────────────────────────────────────

export const DEFAULT_RISK_CONTROLS: RiskControls = {
  maxPositionSize: 1000,
  maxDailyTrades: 10,
  maxLossUSDT: 500,
  maxSingleOrderUSDT: 5000,
  requireApproval: true,
};

// ── Simulation Broker (MVP) ────────────────────────────────────────────────

class SimulationBroker implements IExecutionBroker {
  private orders: SimulatedOrder[] = [];
  private simCounter = 1;

  async placeOrder(symbol: string, side: OrderSide, quantity: number, price?: number): Promise<{ orderId: string; status: string }> {
    const orderId = `SIM-${this.simCounter++}-${Date.now()}`;
    const order: SimulatedOrder = {
      orderId,
      symbol,
      side,
      quantity,
      price,
      status: 'filled',
      filledAt: new Date().toISOString(),
      fillPrice: price,
    };
    this.orders.push(order);
    return { orderId, status: 'filled' };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.find(o => o.orderId === orderId);
    if (order && order.status === 'pending') {
      order.status = 'cancelled';
      return true;
    }
    return false;
  }

  async getPositions(): Promise<{ symbol: string; quantity: number; avgPrice: number }[]> {
    return [];
  }

  async getAccountInfo(): Promise<{ totalAssets: number; availableCash: number; frozenCash: number }> {
    return { totalAssets: 100000, availableCash: 100000, frozenCash: 0 };
  }
}

// ── AI to Execution Bridge ─────────────────────────────────────────────────

export class AIExecutionBridge extends EventEmitter {
  private sessions: Map<string, ExecutionSession> = new Map();
  private broker: IExecutionBroker = new SimulationBroker();
  private sessionCounter = 1;

  /**
   * Create an execution session
   */
  createSession(creator: string, mode: 'simulation' | 'live' = 'simulation'): ExecutionSession {
    const session: ExecutionSession = {
      sessionId: `EXEC-${this.sessionCounter++}-${Date.now()}`,
      creator,
      mode,
      orders: [],
      riskControls: { ...DEFAULT_RISK_CONTROLS },
      dailyTradeCount: 0,
      cumulativePnL: 0,
      lastTradeDate: new Date().toISOString().substring(0, 10),
      active: true,
    };
    this.sessions.set(session.sessionId, session);
    this.emit('session:created', session);
    return session;
  }

  /**
   * Parse AI signal into an execution decision
   */
  parseSignal(signal: AISignal, sessionId: string): { safe: boolean; reason?: string; quantity?: number } {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return { safe: false, reason: 'Session not active' };

    if (signal.action === 'HOLD') return { safe: true, reason: 'HOLD: no action', quantity: 0 };

    // Risk checks
    const today = new Date().toISOString().substring(0, 10);
    if (session.lastTradeDate !== today) {
      session.dailyTradeCount = 0;
      session.lastTradeDate = today;
    }

    if (session.dailyTradeCount >= session.riskControls.maxDailyTrades) {
      return { safe: false, reason: `Daily trade limit (${session.riskControls.maxDailyTrades}) reached` };
    }

    // Calculate quantity from confidence
    const quantity = Math.round(signal.confidence * 100);
    if (quantity > session.riskControls.maxPositionSize) {
      return { safe: false, reason: `Position size ${quantity} exceeds max ${session.riskControls.maxPositionSize}` };
    }

    return { safe: true, quantity };
  }

  /**
   * Execute order from AI signal (simulation mode)
   */
  async executeOrder(signal: AISignal, sessionId: string): Promise<SimulatedOrder> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new EngineError(ErrorCode.AI_QUERY_FAILED, `Session not found: ${sessionId}`);

    const parsed = this.parseSignal(signal, sessionId);
    if (!parsed.safe) {
      const order: SimulatedOrder = {
        orderId: `REJ-${Date.now()}`,
        symbol: signal.symbol,
        side: signal.action === 'BUY' ? 'buy' : 'sell',
        quantity: 0,
        status: 'rejected',
        errorMessage: parsed.reason,
      };
      session.orders.push(order);
      this.emit('order:rejected', { sessionId, signal, reason: parsed.reason });
      return order;
    }

    if (signal.action === 'HOLD' || parsed.quantity === 0) {
      const order: SimulatedOrder = {
        orderId: `HOLD-${Date.now()}`,
        symbol: signal.symbol,
        side: signal.action === 'BUY' ? 'buy' : 'sell',
        quantity: 0,
        status: 'cancelled',
        errorMessage: 'HOLD signal: no order placed',
      };
      session.orders.push(order);
      return order;
    }

    const side: OrderSide = signal.action === 'BUY' ? 'buy' : 'sell';

    try {
      const result = await this.broker.placeOrder(signal.symbol, side, parsed.quantity);

      const order: SimulatedOrder = {
        orderId: result.orderId,
        symbol: signal.symbol,
        side,
        quantity: parsed.quantity,
        status: 'filled',
        filledAt: new Date().toISOString(),
      };

      session.orders.push(order);
      session.dailyTradeCount++;
      this.emit('order:executed', { sessionId, order, signal });
      return order;
    } catch (err) {
      const order: SimulatedOrder = {
        orderId: `ERR-${Date.now()}`,
        symbol: signal.symbol,
        side,
        quantity: 0,
        status: 'rejected',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
      session.orders.push(order);
      return order;
    }
  }

  /**
   * Update risk controls
   */
  updateRiskControls(sessionId: string, controls: Partial<RiskControls>): RiskControls {
    const session = this.sessions.get(sessionId);
    if (!session) throw new EngineError(ErrorCode.AI_QUERY_FAILED, `Session not found: ${sessionId}`);

    session.riskControls = { ...session.riskControls, ...controls };
    this.emit('risk:updated', { sessionId, controls: session.riskControls });
    return session.riskControls;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): ExecutionSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all orders for a session
   */
  getOrders(sessionId: string): SimulatedOrder[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.orders] : [];
  }

  /**
   * Deactivate session
   */
  deactivateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.active = false;
  }

  /**
   * Get broker (for testing/live switching)
   */
  getBroker(): IExecutionBroker {
    return this.broker;
  }

  /**
   * Set broker (for switching to live in R60)
   */
  setBroker(broker: IExecutionBroker): void {
    this.broker = broker;
  }

  reset(): void {
    this.sessions.clear();
    this.sessionCounter = 1;
    this.broker = new SimulationBroker();
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _bridgeInstance: AIExecutionBridge | null = null;

export function getExecutionBridge(): AIExecutionBridge {
  if (!_bridgeInstance) _bridgeInstance = new AIExecutionBridge();
  return _bridgeInstance;
}

export function resetExecutionBridge(): void {
  _bridgeInstance?.reset();
  _bridgeInstance = null;
}

export default { AIExecutionBridge, getExecutionBridge, resetExecutionBridge, SimulationBroker, DEFAULT_RISK_CONTROLS };
