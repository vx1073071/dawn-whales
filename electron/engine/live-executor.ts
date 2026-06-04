// ── Q14: Live Execution Engine ────────────────────────────────────────────
// Consumes JVS quote:stream-tick → evaluates strategy signals → executes orders via IBrokerAdapter
// Feeds live positions back to RiskEngine for real-time monitoring

import { EventEmitter } from 'events';
import log from 'electron-log';
import { QuoteStreamService, QuoteTick } from './quote-stream';
import { StrategyEngine, SignalEvent } from './strategy-engine';
import type { RiskEngine } from './risk-engine';
import type { IBrokerAdapter, Order, Position } from '../broker/IBrokerAdapter';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LiveStrategyConfig {
  strategyId: string;
  symbol: string;
  signalType: 'BUY' | 'SELL' | 'CLOSE';
  price?: number;        // limit price, undefined = market
  quantity?: number;     // undefined = auto-size via Kelly
  stopLoss?: number;     // absolute price
  takeProfit?: number;   // absolute price
}

export interface LiveOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  status: 'pending' | 'submitted' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  filledQty: number;
  avgFillPrice?: number;
  createdAt: number;
  updatedAt: number;
  signalReason: string;
}

export interface LivePosition {
  strategyId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgCost: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  stopLoss?: number;
  takeProfit?: number;
  entryTime: number;
}

export interface ExecutorStatus {
  isRunning: boolean;
  strategiesCount: number;
  positionsCount: number;
  ordersCount: number;
  totalPnL: number;
  lastUpdate: number;
}

// ── Live Executor ────────────────────────────────────────────────────────────

export class LiveExecutor extends EventEmitter {
  private quoteStream: QuoteStreamService | null = null;
  private strategyEngine: StrategyEngine;
  private riskEngine: RiskEngine | null = null;
  private broker: IBrokerAdapter | null = null;

  // Live strategy configs (strategyId → config)
  private liveStrategies = new Map<string, LiveStrategyConfig>();

  // Track live positions (strategyId → position)
  private positions = new Map<string, LivePosition>();

  // Track open/pending orders (orderId → order)
  private orders = new Map<string, LiveOrder>();

  // Last quote per symbol (symbol → tick)
  private lastQuotes = new Map<string, QuoteTick>();

  private running = false;
  private totalPnL = 0;

  constructor(strategyEngine: StrategyEngine) {
    super();
    this.strategyEngine = strategyEngine;
    log.info('[LiveExecutor] Created');
  }

  // ── Setup ─────────────────────────────────────────────────────────────

  setRiskEngine(riskEngine: RiskEngine): void {
    this.riskEngine = riskEngine;
    this.strategyEngine.setRiskEngine(riskEngine);
    log.info('[LiveExecutor] RiskEngine connected');
  }

  setBroker(broker: IBrokerAdapter): void {
    this.broker = broker;
    log.info('[LiveExecutor] Broker connected:', broker.name);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  start(symbols?: string[]): void {
    if (this.running) {
      log.warn('[LiveExecutor] Already running');
      return;
    }

    const subs = symbols || Array.from(this.liveStrategies.values()).map(s => s.symbol);
    if (subs.length === 0) {
      log.warn('[LiveExecutor] No symbols to subscribe');
      return;
    }

    this.quoteStream = new QuoteStreamService({
      symbols: subs,
      refreshIntervalMs: 3000,
      enableAnomalyDetection: false,
    });

    this.quoteStream.on('quote:update', (quotes: QuoteTick[]) => {
      this.onQuotes(quotes);
    });

    this.quoteStream.start();
    this.running = true;
    log.info(`[LiveExecutor] Started with ${subs.length} symbols`);
    this.emit('executor:started');
  }

  stop(): void {
    if (!this.running) return;

    if (this.quoteStream) {
      this.quoteStream.stop();
      this.quoteStream = null;
    }

    this.running = false;
    log.info('[LiveExecutor] Stopped');
    this.emit('executor:stopped');
  }

  // ── Strategy Management ────────────────────────────────────────────────

  addStrategy(config: LiveStrategyConfig): void {
    this.liveStrategies.set(config.strategyId, config);

    // Register signal callback with strategy engine
    this.strategyEngine.onSignal(config.strategyId, (event: SignalEvent) => {
      this.onSignal(event);
    });

    log.info(`[LiveExecutor] Added strategy ${config.strategyId} for ${config.symbol}`);
    this.emit('strategy:added', config);
  }

  removeStrategy(strategyId: string): void {
    const removed = this.liveStrategies.delete(strategyId);
    if (removed) {
      this.positions.delete(strategyId);
      log.info(`[LiveExecutor] Removed strategy ${strategyId}`);
      this.emit('strategy:removed', { strategyId });
    }
  }

  getStrategies(): LiveStrategyConfig[] {
    return Array.from(this.liveStrategies.values());
  }

  // ── Position & Order Access ─────────────────────────────────────────────

  getPositions(): LivePosition[] {
    return Array.from(this.positions.values());
  }

  getOrders(): LiveOrder[] {
    return Array.from(this.orders.values());
  }

  getStatus(): ExecutorStatus {
    return {
      isRunning: this.running,
      strategiesCount: this.liveStrategies.size,
      positionsCount: this.positions.size,
      ordersCount: this.orders.size,
      totalPnL: Math.round(this.totalPnL * 100) / 100,
      lastUpdate: Date.now(),
    };
  }

  // ── Core Event Handlers ─────────────────────────────────────────────────

  private onQuotes(quotes: QuoteTick[]): void {
    for (const quote of quotes) {
      this.lastQuotes.set(quote.code, quote);
      this.processStrategyEvaluation(quote);
      this.updatePositionPnL(quote);
    }

    // Emit position updates
    this.emit('positions:updated', this.getPositions());
  }

  private processStrategyEvaluation(quote: QuoteTick): void {
    for (const [strategyId, config] of this.liveStrategies) {
      if (config.symbol !== quote.code) continue;

      const position = this.positions.get(strategyId);
      const hasPosition = position && position.quantity > 0;

      // Evaluate via strategy engine
      const result = this.strategyEngine.evaluateSignal(strategyId, quote.price);

      if (result && result.signal !== 'HOLD') {
        // Check if action already in progress
        if (this.hasPendingOrder(strategyId)) {
          log.info(`[LiveExecutor] Skipping ${result.signal} — order pending for ${strategyId}`);
          continue;
        }

        // Determine action: BUY (open long), SELL (close), or CLOSE existing
        if (result.signal === 'BUY' && !hasPosition) {
          this.executeBuy(strategyId, quote, result.reason);
        } else if (result.signal === 'SELL' && hasPosition) {
          this.executeSell(strategyId, quote, result.reason);
        } else if (result.signal === 'SELL' && !hasPosition) {
          // Short signal — if broker supports shorting
          this.executeSell(strategyId, quote, result.reason);
        }
      }
    }
  }

  private async executeBuy(strategyId: string, quote: QuoteTick, reason: string): Promise<void> {
    const config = this.liveStrategies.get(strategyId);
    if (!config) return;

    // Auto-size via Kelly if no quantity specified
    let quantity = config.quantity;
    if (!quantity && this.broker && this.riskEngine) {
      const kellyFrac = this.riskEngine.calculateKellyFraction?.(strategyId, quote.price) ?? 0.25;
      const capital = await this.broker.getAvailableCapital?.() ?? 100000;
      quantity = Math.floor((capital * kellyFrac) / quote.price);
    }
    quantity = quantity ?? 100;

    // Risk check
    if (this.riskEngine) {
      const riskOk = this.riskEngine.checkRisk?.(strategyId, quote.price, quantity);
      if (!riskOk) {
        log.warn(`[LiveExecutor] Risk check rejected BUY for ${strategyId}`);
        this.emit('risk:rejected', { strategyId, side: 'BUY', price: quote.price, qty: quantity });
        return;
      }
    }

    const orderId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const order: LiveOrder = {
      id: orderId,
      strategyId,
      symbol: quote.code,
      side: 'BUY',
      type: config.price ? 'LIMIT' : 'MARKET',
      quantity,
      price: config.price || quote.price,
      status: 'pending',
      filledQty: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      signalReason: reason,
    };

    this.orders.set(orderId, order);
    this.emit('order:created', order);

    // Submit to broker
    if (this.broker) {
      try {
        await this.submitToBroker(order);
      } catch (err: any) {
        order.status = 'rejected';
        order.updatedAt = Date.now();
        this.emit('order:rejected', order);
        log.error(`[LiveExecutor] Order rejected: ${err.message}`);
      }
    }
  }

  private async executeSell(strategyId: string, quote: QuoteTick, reason: string): Promise<void> {
    const position = this.positions.get(strategyId);
    if (!position) return;

    const config = this.liveStrategies.get(strategyId);
    const orderId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const order: LiveOrder = {
      id: orderId,
      strategyId,
      symbol: quote.code,
      side: 'SELL',
      type: config?.price ? 'LIMIT' : 'MARKET',
      quantity: position.quantity,
      price: config?.price || quote.price,
      status: 'pending',
      filledQty: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      signalReason: reason,
    };

    this.orders.set(orderId, order);
    this.emit('order:created', order);

    if (this.broker) {
      try {
        await this.submitToBroker(order);
      } catch (err: any) {
        order.status = 'rejected';
        order.updatedAt = Date.now();
        this.emit('order:rejected', order);
        log.error(`[LiveExecutor] Order rejected: ${err.message}`);
      }
    }
  }

  private async submitToBroker(order: LiveOrder): Promise<void> {
    if (!this.broker) return;

    order.status = 'submitted';
    order.updatedAt = Date.now();
    this.emit('order:submitted', order);

    // Call broker order API
    if (typeof this.broker.submitOrder === 'function') {
      const result = await this.broker.submitOrder({
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
      });

      if (result.success) {
        order.status = 'filled';
        order.filledQty = order.quantity;
        order.avgFillPrice = result.avgPrice || order.price;
        order.updatedAt = Date.now();

        // Update position
        this.updatePositionFromFill(order);
        this.emit('order:filled', order);
      }
    }
  }

  private updatePositionFromFill(order: LiveOrder): void {
    const existing = this.positions.get(order.strategyId);

    if (order.side === 'BUY') {
      if (existing) {
        const totalQty = existing.quantity + order.filledQty;
        existing.avgCost = (existing.avgCost * existing.quantity + (order.avgFillPrice || order.price) * order.filledQty) / totalQty;
        existing.quantity = totalQty;
        existing.unrealizedPnLPct = 0; // reset
      } else {
        this.positions.set(order.strategyId, {
          strategyId: order.strategyId,
          symbol: order.symbol,
          side: 'LONG',
          quantity: order.filledQty,
          avgCost: order.avgFillPrice || order.price,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          entryTime: Date.now(),
        });
      }
    } else if (order.side === 'SELL') {
      if (existing) {
        const remaining = existing.quantity - order.filledQty;
        if (remaining <= 0) {
          // Close position
          const pnl = (order.avgFillPrice || order.price) - existing.avgCost;
          this.totalPnL += pnl * existing.quantity;
          this.positions.delete(order.strategyId);
        } else {
          existing.quantity = remaining;
        }
      }
    }
  }

  private updatePositionPnL(quote: QuoteTick): void {
    for (const [strategyId, position] of this.positions) {
      if (position.symbol !== quote.code) continue;
      const pnl = (quote.price - position.avgCost) * position.quantity;
      position.unrealizedPnL = Math.round(pnl * 100) / 100;
      position.unrealizedPnLPct = Math.round((pnl / (position.avgCost * position.quantity)) * 10000) / 100;

      // Check stop-loss
      if (position.stopLoss && quote.price <= position.stopLoss) {
        log.info(`[LiveExecutor] Stop-loss triggered for ${strategyId} at ${quote.price}`);
        this.executeSell(strategyId, quote, `Stop-loss @ ${position.stopLoss}`);
      }

      // Check take-profit
      if (position.takeProfit && quote.price >= position.takeProfit) {
        log.info(`[LiveExecutor] Take-profit triggered for ${strategyId} at ${quote.price}`);
        this.executeSell(strategyId, quote, `Take-profit @ ${position.takeProfit}`);
      }
    }
  }

  private hasPendingOrder(strategyId: string): boolean {
    for (const order of this.orders.values()) {
      if (order.strategyId === strategyId && ['pending', 'submitted'].includes(order.status)) {
        return true;
      }
    }
    return false;
  }

  // ── Signal Handler ─────────────────────────────────────────────────────

  private onSignal(event: SignalEvent): void {
    const quote = this.lastQuotes.get(event.symbol);
    if (!quote) return;

    if (event.signal === 'BUY') {
      this.executeBuy(event.strategyId, quote, event.reason);
    } else if (event.signal === 'SELL') {
      this.executeSell(event.strategyId, quote, event.reason);
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let executorInstance: LiveExecutor | null = null;

export function initLiveExecutor(strategyEngine: StrategyEngine): LiveExecutor {
  if (!executorInstance) {
    executorInstance = new LiveExecutor(strategyEngine);
  }
  return executorInstance;
}

export function getLiveExecutor(): LiveExecutor | null {
  return executorInstance;
}
