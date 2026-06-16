/**
 * SmartConditionOrderEngine — R260 QUANT MOO P2-02
 *
 * 智能条件单引擎。支持多种条件单类型：
 *   - 限价条件单 (Price)
 *   - 止损条件单 (Stop Loss)
 *   - 止盈条件单 (Take Profit)
 *   - OCO (One Cancels Other)
 *   - 追踪止损 (Trailing Stop)
 *   - 条件触发链 (Bracket)
 *   - 冰山/时间加权 (Iceberg/TWAP skeleton)
 *
 * 核心能力：
 *   - 条件单创建/修改/取消/查询
 *   - 实时行情驱动触发评估
 *   - 触发后自动下单 (mock integration)
 *   - 条件单有效期管理 (GTC/GTD/IOC)
 *   - 触发历史与统计
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Price-driven trigger engine
 *   - OCO co-cancellation
 *   - Trailing stop dynamic adjustment
 *
 * @author JVS
 * @round R260
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type ConditionType =
  | 'price'           // 限价条件单 (price reaches target)
  | 'stop_loss'       // 止损单
  | 'take_profit'     // 止盈单
  | 'oco'             // 一对二 (OCO group)
  | 'trailing_stop'   // 追踪止损
  | 'bracket';        // 条件触发链 (entry + stop + target)

export type ConditionSide = 'buy' | 'sell';

export type TimeInForce = 'GTC' | 'GTD' | 'IOC' | 'FOK';

export type ConditionStatus = 'active' | 'triggered' | 'cancelled' | 'expired' | 'rejected';

export type ComparisonOp = 'gte' | 'lte' | 'cross_above' | 'cross_below';

export type TrailDirection = 'long' | 'short';

export interface PriceCondition {
  targetPrice: number;
  comparison: ComparisonOp;
  lastKnownPrice?: number;
}

export interface TrailingStopConfig {
  direction: TrailDirection;
  trailPercent: number;    // e.g. 5 = 5% trailing
  trailAmount: number;     // absolute amount
  activationPrice: number; // must reach this before trailing activates
  highestPrice?: number;   // tracker (long)
  lowestPrice?: number;    // tracker (short)
}

export interface OCOGroup {
  id: string;
  orders: string[];  // order IDs in this OCO
}

export interface BracketConfig {
  entry: { targetPrice: number; comparison: ComparisonOp };
  stopLoss: { offsetPercent: number };
  takeProfit: { offsetPercent: number };
  stopOrderId?: string;
  tpOrderId?: string;
}

export interface SmartConditionOrder {
  id: string;
  userId: string;
  symbol: string;
  side: ConditionSide;
  quantity: number;
  type: ConditionType;
  status: ConditionStatus;

  // Condition specifics
  priceCondition?: PriceCondition;
  trailingStop?: TrailingStopConfig;
  ocoGroupId?: string;
  bracketConfig?: BracketConfig;

  // Execution
  timeInForce: TimeInForce;
  goodTillDate?: string;     // YYYY-MM-DD for GTD
  slippagePercent: number;   // 0-5

  // Broker
  brokerId: string;
  accountId: string;

  // Timestamps
  createdAt: number;
  triggeredAt?: number;
  executedOrderId?: string;  // mock order id after trigger
  cancelledAt?: number;
  rejectReason?: string;

  // Notes
  notes?: string;
}

export interface ConditionOrderStats {
  totalCreated: number;
  totalActive: number;
  totalTriggered: number;
  totalCancelled: number;
  totalExpired: number;
  byType: Record<ConditionType, number>;
  bySymbol: Record<string, number>;
}

export interface TriggerResult {
  order: SmartConditionOrder;
  triggered: boolean;
  reason: string;
  executedOrderId?: string;
}

// ─── Constants ───────────────────────────────────────────

const MAX_SLIPPAGE = 5;
const MIN_TRAIL_PERCENT = 0.1;

// ─── Engine ──────────────────────────────────────────────

export class SmartConditionOrderEngine extends EventEmitter {
  private static instance: SmartConditionOrderEngine;

  private orders: Map<string, SmartConditionOrder> = new Map();
  private ocoGroups: Map<string, OCOGroup> = new Map();
  private idCounter = 0;

  constructor() { super(); }

  static getInstance(): SmartConditionOrderEngine {
    if (!SmartConditionOrderEngine.instance) {
      SmartConditionOrderEngine.instance = new SmartConditionOrderEngine();
    }
    return SmartConditionOrderEngine.instance;
  }

  reset(): void {
    this.orders.clear();
    this.ocoGroups.clear();
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Create ─────────────────────────────────────────────

  create(params: {
    userId: string; symbol: string; side: ConditionSide; quantity: number;
    type: ConditionType; priceCondition?: PriceCondition;
    trailingStop?: TrailingStopConfig; timeInForce?: TimeInForce;
    goodTillDate?: string; slippagePercent?: number;
    brokerId?: string; accountId?: string; notes?: string;
  }): SmartConditionOrder | null {
    const id = `co_${++this.idCounter}`;
    const timeInForce = params.timeInForce || 'GTC';
    const slippage = Math.min(Math.max(0, params.slippagePercent || 0), MAX_SLIPPAGE);

    const order: SmartConditionOrder = {
      id, userId: params.userId, symbol: params.symbol,
      side: params.side, quantity: params.quantity, type: params.type,
      status: 'active', timeInForce, slippagePercent: slippage,
      brokerId: params.brokerId || 'mock', accountId: params.accountId || 'default',
      createdAt: Date.now(),
      priceCondition: params.priceCondition,
      trailingStop: params.trailingStop,
    };

    if (timeInForce === 'GTD' && params.goodTillDate) {
      order.goodTillDate = params.goodTillDate;
    }
    if (params.notes) order.notes = params.notes;

    this.orders.set(id, order);
    this.emit('order_created', order);
    return order;
  }

  // ─── OCO ────────────────────────────────────────────────

  createOCO(params: {
    userId: string; symbol: string; side: ConditionSide; quantity: number;
    stopLossPrice: number; takeProfitPrice: number;
    timeInForce?: TimeInForce; note?: string;
  }): { ocoGroup: OCOGroup; stopOrder: SmartConditionOrder; tpOrder: SmartConditionOrder } | null {

    // Create stop loss leg
    const stopOrder = this.create({
      userId: params.userId, symbol: params.symbol, side: params.side,
      quantity: params.quantity, type: 'stop_loss',
      priceCondition: { targetPrice: params.stopLossPrice, comparison: (params.side === 'buy' ? 'gte' : 'lte') },
      timeInForce: params.timeInForce || 'GTC',
      notes: `OCO stop leg: ${params.note || ''}`,
    });
    if (!stopOrder) return null;

    // Create take profit leg
    const tpOrder = this.create({
      userId: params.userId, symbol: params.symbol, side: params.side,
      quantity: params.quantity, type: 'take_profit',
      priceCondition: { targetPrice: params.takeProfitPrice, comparison: (params.side === 'buy' ? 'lte' : 'gte') },
      timeInForce: params.timeInForce || 'GTC',
      notes: `OCO TP leg: ${params.note || ''}`,
    });
    if (!tpOrder) return null;

    const groupId = `oco_${++this.idCounter}`;
    const group: OCOGroup = { id: groupId, orders: [stopOrder.id, tpOrder.id] };
    this.ocoGroups.set(groupId, group);

    stopOrder.type = 'oco';
    stopOrder.ocoGroupId = groupId;
    tpOrder.type = 'oco';
    tpOrder.ocoGroupId = groupId;

    this.emit('oco_created', { group, stopOrder, tpOrder });
    return { ocoGroup: group, stopOrder, tpOrder };
  }

  // ─── Bracket (条件触发链) ────────────────────────────────

  createBracket(params: {
    userId: string; symbol: string; side: ConditionSide; quantity: number;
    entryPrice: number; entryComparison?: ComparisonOp;
    stopLossPercent: number; takeProfitPercent: number;
    timeInForce?: TimeInForce;
  }): { entry: SmartConditionOrder; bracket: BracketConfig } | null {
    const bracket: BracketConfig = {
      entry: { targetPrice: params.entryPrice, comparison: params.entryComparison || 'cross_above' },
      stopLoss: { offsetPercent: params.stopLossPercent },
      takeProfit: { offsetPercent: params.takeProfitPercent },
    };

    const isBuy = params.side === 'buy';

    const entry = this.create({
      userId: params.userId, symbol: params.symbol, side: params.side,
      quantity: params.quantity, type: 'bracket',
      priceCondition: bracket.entry,
      timeInForce: params.timeInForce || 'GTC',
    });
    if (!entry) return null;

    entry.bracketConfig = bracket;
    entry.bracketConfig.stopOrderId = undefined;
    entry.bracketConfig.tpOrderId = undefined;

    this.emit('bracket_created', { entry, bracket });
    return { entry, bracket };
  }

  // ─── Trailing Stop ──────────────────────────────────────

  createTrailingStop(params: {
    userId: string; symbol: string; side: ConditionSide; quantity: number;
    trailPercent: number; activationPrice: number;
    direction?: TrailDirection;
    timeInForce?: TimeInForce;
  }): SmartConditionOrder | null {
    const direction = params.direction || (params.side === 'sell' ? 'long' : 'short');
    const config: TrailingStopConfig = {
      direction,
      trailPercent: Math.max(MIN_TRAIL_PERCENT, params.trailPercent),
      trailAmount: 0,
      activationPrice: params.activationPrice,
    };

    const order = this.create({
      userId: params.userId, symbol: params.symbol, side: params.side,
      quantity: params.quantity, type: 'trailing_stop',
      trailingStop: config,
      timeInForce: params.timeInForce || 'GTC',
      notes: `Trailing stop ${params.trailPercent}% from ${direction === 'long' ? 'high' : 'low'}`,
    });
    if (!order) return null;

    this.emit('trailing_stop_created', order);
    return order;
  }

  // ─── Price Feed / Trigger Evaluation ────────────────────

  evaluate(symbol: string, currentPrice: number): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const [id, order] of this.orders) {
      if (order.status !== 'active') continue;
      if (order.symbol !== symbol) continue;

      // Check GTD expiry
      if (order.timeInForce === 'GTD' && order.goodTillDate) {
        if (new Date(order.goodTillDate).getTime() < Date.now()) {
          order.status = 'expired';
          order.cancelledAt = Date.now();
          this.emit('order_expired', order);
          continue;
        }
      }

      let triggered = false;
      let reason = '';

      switch (order.type) {
        case 'price':
        case 'stop_loss':
        case 'take_profit': {
          const result = this.evaluatePriceCondition(order, currentPrice);
          triggered = result.triggered;
          reason = result.reason;
          break;
        }
        case 'oco': {
          const result = this.evaluatePriceCondition(order, currentPrice);
          if (result.triggered) {
            this.cancelOCOPair(order);
            triggered = true;
            reason = `OCO ${result.reason}`;
          }
          break;
        }
        case 'trailing_stop': {
          const result = this.evaluateTrailingStop(order, currentPrice);
          triggered = result.triggered;
          reason = result.reason;
          break;
        }
        case 'bracket': {
          const result = this.evaluateBracket(order, currentPrice);
          triggered = result.triggered;
          reason = result.reason;
          break;
        }
      }

      const triggerResult: TriggerResult = { order: { ...order }, triggered, reason };

      if (triggered) {
        order.status = 'triggered';
        order.triggeredAt = Date.now();
        order.executedOrderId = `mock_exec_${++this.idCounter}`;
        triggerResult.executedOrderId = order.executedOrderId;
        triggerResult.order = { ...order };
        this.emit('order_triggered', order);
      }

      results.push(triggerResult);
    }

    return results;
  }

  // ─── Price Condition ────────────────────────────────────

  private evaluatePriceCondition(order: SmartConditionOrder, currentPrice: number): { triggered: boolean; reason: string } {
    const pc = order.priceCondition;
    if (!pc) return { triggered: false, reason: 'no_condition' };

    const target = pc.targetPrice;
    const prevPrice = pc.lastKnownPrice;

    let triggered = false;
    let reason = '';

    switch (pc.comparison) {
      case 'gte':
        triggered = currentPrice >= target;
        reason = triggered ? `price ${currentPrice} >= ${target}` : '';
        break;
      case 'lte':
        triggered = currentPrice <= target;
        reason = triggered ? `price ${currentPrice} <= ${target}` : '';
        break;
      case 'cross_above':
        triggered = prevPrice !== undefined && prevPrice < target && currentPrice >= target;
        reason = triggered ? `price crossed above ${target}` : '';
        break;
      case 'cross_below':
        triggered = prevPrice !== undefined && prevPrice > target && currentPrice <= target;
        reason = triggered ? `price crossed below ${target}` : '';
        break;
    }

    // Update last known price
    order.priceCondition!.lastKnownPrice = currentPrice;

    return { triggered, reason };
  }

  // ─── Trailing Stop ──────────────────────────────────────

  private evaluateTrailingStop(order: SmartConditionOrder, currentPrice: number): { triggered: boolean; reason: string } {
    const ts = order.trailingStop;
    if (!ts) return { triggered: false, reason: 'no_trailing_config' };

    const isLong = ts.direction === 'long';

    // Track highest/lowest
    if (isLong) {
      ts.highestPrice = Math.max(ts.highestPrice ?? currentPrice, currentPrice);
      ts.trailAmount = ts.highestPrice * (ts.trailPercent / 100);
      const stopPrice = ts.highestPrice - ts.trailAmount;

      if (ts.highestPrice >= ts.activationPrice && currentPrice <= stopPrice) {
        return { triggered: true, reason: `trailing stop: hit ${stopPrice.toFixed(2)} (high ${ts.highestPrice.toFixed(2)} -${ts.trailPercent}%)` };
      }
    } else {
      ts.lowestPrice = Math.min(ts.lowestPrice ?? currentPrice, currentPrice);
      ts.trailAmount = ts.lowestPrice * (ts.trailPercent / 100);
      const stopPrice = ts.lowestPrice + ts.trailAmount;

      if (ts.lowestPrice <= ts.activationPrice && currentPrice >= stopPrice) {
        return { triggered: true, reason: `trailing stop: hit ${stopPrice.toFixed(2)} (low ${ts.lowestPrice.toFixed(2)} +${ts.trailPercent}%)` };
      }
    }

    return { triggered: false, reason: '' };
  }

  // ─── Bracket ────────────────────────────────────────────

  private evaluateBracket(order: SmartConditionOrder, currentPrice: number): { triggered: boolean; reason: string } {
    const bc = order.bracketConfig;
    if (!bc) return { triggered: false, reason: 'no_bracket_config' };

    const entryResult = this.evaluatePriceCondition(order, currentPrice);
    if (!entryResult.triggered) return { triggered: false, reason: '' };

    // Entry triggered → create child stop + TP orders internally
    const isBuy = order.side === 'buy';

    if (!bc.stopOrderId) {
      // Create stop loss leg
      const stopPrice = isBuy
        ? currentPrice * (1 - bc.stopLoss.offsetPercent / 100)
        : currentPrice * (1 + bc.stopLoss.offsetPercent / 100);
      const stopOrder = this.create({
        userId: order.userId, symbol: order.symbol, side: order.side,
        quantity: order.quantity, type: 'stop_loss',
        priceCondition: { targetPrice: stopPrice, comparison: isBuy ? 'lte' : 'gte' },
        timeInForce: 'GTC',
        notes: `Bracket SL for ${order.id}`,
      });
      if (stopOrder) bc.stopOrderId = stopOrder.id;
    }

    if (!bc.tpOrderId) {
      const tpPrice = isBuy
        ? currentPrice * (1 + bc.takeProfit.offsetPercent / 100)
        : currentPrice * (1 - bc.takeProfit.offsetPercent / 100);
      const tpOrder = this.create({
        userId: order.userId, symbol: order.symbol, side: order.side,
        quantity: order.quantity, type: 'take_profit',
        priceCondition: { targetPrice: tpPrice, comparison: isBuy ? 'gte' : 'lte' },
        timeInForce: 'GTC',
        notes: `Bracket TP for ${order.id}`,
      });
      if (tpOrder) bc.tpOrderId = tpOrder.id;
    }

    return { triggered: true, reason: `bracket entry triggered at ${currentPrice}, SL/TP set` };
  }

  // ─── OCO Co-Cancellation ────────────────────────────────

  private cancelOCOPair(triggeredOrder: SmartConditionOrder): void {
    const groupId = triggeredOrder.ocoGroupId;
    if (!groupId) return;

    const group = this.ocoGroups.get(groupId);
    if (!group) return;

    for (const otherId of group.orders) {
      if (otherId === triggeredOrder.id) continue;
      const other = this.orders.get(otherId);
      if (other && other.status === 'active') {
        other.status = 'cancelled';
        other.cancelledAt = Date.now();
        this.emit('order_cancelled', other);
      }
    }
  }

  // ─── CRUD ───────────────────────────────────────────────

  getOrder(id: string): SmartConditionOrder | undefined {
    return this.orders.get(id);
  }

  cancelOrder(id: string): boolean {
    const order = this.orders.get(id);
    if (!order || order.status !== 'active') return false;
    order.status = 'cancelled';
    order.cancelledAt = Date.now();

    // If OCO, cancel siblings
    if (order.ocoGroupId) this.cancelOCOPair(order);

    this.emit('order_cancelled', order);
    return true;
  }

  cancelAll(symbol?: string, userId?: string): number {
    let count = 0;
    for (const [, order] of this.orders) {
      if (order.status !== 'active') continue;
      if (symbol && order.symbol !== symbol) continue;
      if (userId && order.userId !== userId) continue;
      if (this.cancelOrder(order.id)) count++;
    }
    return count;
  }

  updatePrice(id: string, newTargetPrice: number): boolean {
    const order = this.orders.get(id);
    if (!order || order.status !== 'active' || !order.priceCondition) return false;
    order.priceCondition.targetPrice = newTargetPrice;
    this.emit('order_updated', order);
    return true;
  }

  updateQuantity(id: string, newQuantity: number): boolean {
    const order = this.orders.get(id);
    if (!order || order.status !== 'active' || newQuantity <= 0) return false;
    order.quantity = newQuantity;
    this.emit('order_updated', order);
    return true;
  }

  // ─── Queries ────────────────────────────────────────────

  getActiveOrders(symbol?: string, userId?: string, type?: ConditionType): SmartConditionOrder[] {
    let list = [...this.orders.values()].filter(o => o.status === 'active');
    if (symbol) list = list.filter(o => o.symbol === symbol);
    if (userId) list = list.filter(o => o.userId === userId);
    if (type) list = list.filter(o => o.type === type);
    return list;
  }

  getOrderHistory(userId?: string, limit = 50): SmartConditionOrder[] {
    let list = userId
      ? [...this.orders.values()].filter(o => o.userId === userId)
      : [...this.orders.values()];
    return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  getStats(userId?: string): ConditionOrderStats {
    const relevant = userId
      ? [...this.orders.values()].filter(o => o.userId === userId)
      : [...this.orders.values()];

    const byType: Record<string, number> = {};
    const bySymbol: Record<string, number> = {};

    for (const o of relevant) {
      byType[o.type] = (byType[o.type] || 0) + 1;
      bySymbol[o.symbol] = (bySymbol[o.symbol] || 0) + 1;
    }

    return {
      totalCreated: relevant.length,
      totalActive: relevant.filter(o => o.status === 'active').length,
      totalTriggered: relevant.filter(o => o.status === 'triggered').length,
      totalCancelled: relevant.filter(o => o.status === 'cancelled').length,
      totalExpired: relevant.filter(o => o.status === 'expired').length,
      byType: byType as Record<ConditionType, number>,
      bySymbol,
    };
  }

  getOrderCount(): number { return this.orders.size; }

  // ─── Batch Evaluate ─────────────────────────────────────

  evaluateMulti(prices: Array<{ symbol: string; price: number }>): TriggerResult[] {
    const allResults: TriggerResult[] = [];
    for (const { symbol, price } of prices) {
      allResults.push(...this.evaluate(symbol, price));
    }
    return allResults;
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockOrders(): void {
    this.createPriceOrder('user_1', 'AAPL', 'sell', 100, 195, 'lte', 'GTC');
    this.createPriceOrder('user_1', 'TSLA', 'buy', 50, 280, 'cross_above', 'GTC');
    this.createPriceOrder('user_2', 'NVDA', 'sell', 200, 150, 'gte', 'GTD', '2026-12-31');

    this.createOCO({
      userId: 'user_1', symbol: 'MSFT', side: 'sell', quantity: 80,
      stopLossPrice: 400, takeProfitPrice: 480,
    });

    this.createTrailingStop({
      userId: 'user_1', symbol: 'GOOG', side: 'sell', quantity: 60,
      trailPercent: 5, activationPrice: 170,
    });

    this.createBracket({
      userId: 'user_2', symbol: 'META', side: 'buy', quantity: 30,
      entryPrice: 600, stopLossPercent: 3, takeProfitPercent: 8,
    });
  }

  private createPriceOrder(userId: string, symbol: string, side: ConditionSide, quantity: number, targetPrice: number, comparison: ComparisonOp, tif: TimeInForce, gtd?: string): SmartConditionOrder {
    return this.create({
      userId, symbol, side, quantity, type: 'price',
      priceCondition: { targetPrice, comparison },
      timeInForce: tif, goodTillDate: gtd,
    })!;
  }
}
