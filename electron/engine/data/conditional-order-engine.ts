/**
 * R276 Claw(PM): 条件单引擎 — ConditionalOrderEngine
 * 价格触发+止损+止盈+移动止损+OCO(二选一)+条件触发
 * 
 * 定价: 免费创建, 执行成功收0.5U/次
 * 对标: 富途条件单 / IB Conditional Orders
 */

import { EventEmitter } from 'events';

// ── Types ──
export type OrderCondition = 'price_above' | 'price_below' | 'pct_gain' | 'pct_loss' | 'time' | 'volume_spike' | 'news_event';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' | 'oco';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'active' | 'triggered' | 'executed' | 'cancelled' | 'expired' | 'failed';
export type TIF = 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd';

export interface ConditionalOrder {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  condition: OrderCondition;
  conditionValue: number;
  limitPrice?: number;
  stopPrice?: number;
  trailingOffset?: number;    // trailing stop offset %
  trailingPeak?: number;       // tracked peak for trailing
  ocoPartner?: string;         // OCO pair orderId
  tif: TIF;
  gtdDate?: string;
  status: OrderStatus;
  createdAt: number;
  triggeredAt?: number;
  executedAt?: number;
  notes: string;
}

export interface ConditionalOrderResult {
  orderId: string;
  status: OrderStatus;
  executedPrice?: number;
  error?: string;
}

// ── Engine ──
export class ConditionalOrderEngine extends EventEmitter {
  private static instance: ConditionalOrderEngine;
  private orders: Map<string, ConditionalOrder> = new Map();
  private activeChecks: ReturnType<typeof setInterval> | null = null;
  private priceCache: Map<string, number> = new Map();

  private readonly EXECUTION_FEE = 0.5; // USDT per execution

  private constructor() { super(); }

  static getInstance(): ConditionalOrderEngine {
    if (!this.instance) this.instance = new ConditionalOrderEngine();
    return this.instance;
  }

  getPrice(): number { return this.EXECUTION_FEE; }

  // ── Order Management ──

  createOrder(params: {
    symbol: string; side: OrderSide; quantity: number; orderType: OrderType;
    condition: OrderCondition; conditionValue: number;
    limitPrice?: number; stopPrice?: number; trailingOffset?: number;
    tif?: TIF; gtdDate?: string; notes?: string;
  }): ConditionalOrder {
    const order: ConditionalOrder = {
      orderId: `CO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      orderType: params.orderType,
      condition: params.condition,
      conditionValue: params.conditionValue,
      limitPrice: params.limitPrice,
      stopPrice: params.stopPrice,
      trailingOffset: params.trailingOffset,
      trailingPeak: undefined,
      tif: params.tif || 'gtc',
      gtdDate: params.gtdDate,
      status: 'active',
      createdAt: Date.now(),
      notes: params.notes || '',
    };

    if (params.orderType === 'trailing_stop' && params.trailingOffset) {
      order.trailingPeak = this.priceCache.get(params.symbol) || 0;
    }

    this.orders.set(order.orderId, order);
    this.emit('order:created', order);
    this.startMonitoring();
    return order;
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'active') return false;
    order.status = 'cancelled';
    this.emit('order:cancelled', order);
    return true;
  }

  getOrders(symbol?: string, status?: OrderStatus): ConditionalOrder[] {
    let list = Array.from(this.orders.values());
    if (symbol) list = list.filter(o => o.symbol === symbol);
    if (status) list = list.filter(o => o.status === status);
    return list;
  }

  // ── Price Feed ──

  updatePrice(symbol: string, price: number): void {
    this.priceCache.set(symbol, price);
    this.checkOrders();
  }

  // ── Condition Check ──

  private startMonitoring(): void {
    if (this.activeChecks) return;
    this.activeChecks = setInterval(() => this.checkOrders(), 1000);
  }

  private checkOrders(): void {
    for (const order of this.orders.values()) {
      if (order.status !== 'active') continue;

      const price = this.priceCache.get(order.symbol);
      if (!price) continue;

      // Check expiry
      if (order.tif === 'day') {
        const created = new Date(order.createdAt);
        const now = new Date();
        if (created.getDate() !== now.getDate() || created.getMonth() !== now.getMonth()) {
          order.status = 'expired';
          this.emit('order:expired', order);
          continue;
        }
      }
      if (order.tif === 'gtd' && order.gtdDate) {
        if (Date.now() > new Date(order.gtdDate).getTime()) {
          order.status = 'expired';
          this.emit('order:expired', order);
          continue;
        }
      }

      // Check condition
      let triggered = false;
      switch (order.condition) {
        case 'price_above':
          triggered = price >= order.conditionValue;
          break;
        case 'price_below':
          triggered = price <= order.conditionValue;
          break;
        case 'pct_gain':
          triggered = order.stopPrice ? ((price - order.stopPrice) / order.stopPrice * 100) >= order.conditionValue : false;
          break;
        case 'pct_loss':
          triggered = order.stopPrice ? ((order.stopPrice - price) / order.stopPrice * 100) >= order.conditionValue : false;
          break;
        case 'time':
          triggered = Date.now() >= order.conditionValue;
          break;
      }

      // Trailing stop
      if (order.orderType === 'trailing_stop' && order.trailingPeak !== undefined && order.trailingOffset) {
        if ((order.side === 'sell' || order.side === 'buy') && price > order.trailingPeak) {
          order.trailingPeak = price;
        }
        const trailPrice = order.side === 'sell' ? order.trailingPeak * (1 - order.trailingOffset / 100) : order.trailingPeak * (1 + order.trailingOffset / 100);
        if (order.side === 'sell' && price <= trailPrice) triggered = true;
        if (order.side === 'buy' && price >= trailPrice) triggered = true;
      }

      if (triggered) {
        this.executeOrder(order, price);
      }
    }
  }

  private executeOrder(order: ConditionalOrder, price: number): void {
    order.status = 'triggered';
    order.triggeredAt = Date.now();
    this.emit('order:triggered', { orderId: order.orderId, price });

    // Simulate execution
    const executionPrice = order.orderType === 'limit' && order.limitPrice ? order.limitPrice : price;
    order.status = 'executed';
    order.executedAt = Date.now();

    const result: ConditionalOrderResult = {
      orderId: order.orderId,
      status: 'executed',
      executedPrice: Math.round(executionPrice * 100) / 100,
    };

    this.emit('order:executed', { ...result, fee: this.EXECUTION_FEE });
  }

  reset(): void {
    if (this.activeChecks) { clearInterval(this.activeChecks); this.activeChecks = null; }
    this.orders.clear();
    this.priceCache.clear();
    this.removeAllListeners();
  }
}
