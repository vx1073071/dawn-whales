// ── DAWN WHALES — BrokerEventBus ───────────────────────────────────────
// R1 CONC-03: 跨券商事件总线
// 统一事件流 — Quote/Order/Risk/Arbitrage/Status 五种事件
// 解耦: BrokerManagerV2 → EventBus → UI/Strategy/RiskEngine

import { EventEmitter } from 'events';
import log from 'electron-log';
import type { BrokerType, TaggedQuoteInfo, TaggedPositionInfo, TaggedOrderInfo } from './IBrokerAdapterV2';

// ═══ Event Types ═══════════════════════════════════════

export enum BrokerEventType {
  /** 券商连接状态变化 */
  CONNECTION = 'connection',
  /** 行情更新(单个TaggedQuote) */
  QUOTE = 'quote',
  /** 行情快照(批量) */
  QUOTE_SNAPSHOT = 'quote_snapshot',
  /** 订单状态变化 */
  ORDER_UPDATE = 'order_update',
  /** 持仓变化 */
  POSITION_UPDATE = 'position_update',
  /** 账户资金变化 */
  FUNDS_UPDATE = 'funds_update',
  /** 跨券商套利机会 */
  ARBITRAGE = 'arbitrage',
  /** 风控告警 */
  RISK_ALERT = 'risk_alert',
  /** 一键全停(Kill Switch) */
  KILL_SWITCH = 'kill_switch',
  /** 通用错误 */
  ERROR = 'error',
}

export interface BrokerEvent {
  type: BrokerEventType;
  brokerId?: string;
  brokerType?: BrokerType;
  timestamp: number;
  data: any;
}

export interface QuoteEvent extends BrokerEvent {
  type: BrokerEventType.QUOTE;
  data: TaggedQuoteInfo[];
}

export interface OrderUpdateEvent extends BrokerEvent {
  type: BrokerEventType.ORDER_UPDATE;
  data: TaggedOrderInfo;
}

export interface RiskAlertEvent extends BrokerEvent {
  type: BrokerEventType.RISK_ALERT;
  data: {
    alertId: string;
    level: 'INFO' | 'WARN' | 'CRITICAL';
    message: string;
    brokerId?: string;
    details?: any;
  };
}

export interface ArbitrageEvent extends BrokerEvent {
  type: BrokerEventType.ARBITRAGE;
  data: {
    standardCode: string;
    buyBroker: string;
    sellBroker: string;
    profitPct: number;
    profitPerUnit: number;
    amount: number;
    timestamp: number;
  };
}

export interface KillSwitchEvent extends BrokerEvent {
  type: BrokerEventType.KILL_SWITCH;
  data: {
    reason: string;
    disconnectedCount: number;
    disconnectedBrokers: string[];
  };
}

// ═══ Callbacks ═════════════════════════════════════════

type EventCallback = (event: BrokerEvent) => void;
type QuoteCallback = (quotes: TaggedQuoteInfo[]) => void;
type OrderCallback = (order: TaggedOrderInfo) => void;
type ArbitrageCallback = (event: ArbitrageEvent) => void;
type RiskCallback = (event: RiskAlertEvent) => void;
type StatusCallback = (brokerId: string, connected: boolean) => void;

export class BrokerEventBus {
  private emitter = new EventEmitter();
  private maxListeners = 100;
  private eventLog: BrokerEvent[] = [];
  private maxEventLog = 1000;

  constructor() {
    this.emitter.setMaxListeners(this.maxListeners);
  }

  // ═══ Emit Events ══════════════════════════════════

  emitQuote(brokerId: string, brokerType: BrokerType, quotes: TaggedQuoteInfo[]): void {
    const event: QuoteEvent = {
      type: BrokerEventType.QUOTE,
      brokerId,
      brokerType,
      timestamp: Date.now(),
      data: quotes,
    };
    this._emit(BrokerEventType.QUOTE, event);
    // Also emit per-broker
    this._emit(`${BrokerEventType.QUOTE}:${brokerId}`, event);
  }

  emitQuoteSnapshot(quotes: TaggedQuoteInfo[]): void {
    const event: BrokerEvent = {
      type: BrokerEventType.QUOTE_SNAPSHOT,
      timestamp: Date.now(),
      data: quotes,
    };
    this._emit(BrokerEventType.QUOTE_SNAPSHOT, event);
  }

  emitOrderUpdate(brokerId: string, order: TaggedOrderInfo): void {
    const event: OrderUpdateEvent = {
      type: BrokerEventType.ORDER_UPDATE,
      brokerId,
      timestamp: Date.now(),
      data: order,
    };
    this._emit(BrokerEventType.ORDER_UPDATE, event);
    this._emit(`${BrokerEventType.ORDER_UPDATE}:${brokerId}`, event);
  }

  emitPositionUpdate(brokerId: string, positions: TaggedPositionInfo[]): void {
    const event: BrokerEvent = {
      type: BrokerEventType.POSITION_UPDATE,
      brokerId,
      timestamp: Date.now(),
      data: positions,
    };
    this._emit(BrokerEventType.POSITION_UPDATE, event);
  }

  emitConnection(brokerId: string, connected: boolean): void {
    const event: BrokerEvent = {
      type: BrokerEventType.CONNECTION,
      brokerId,
      timestamp: Date.now(),
      data: { connected },
    };
    this._emit(BrokerEventType.CONNECTION, event);
  }

  emitArbitrage(opportunity: ArbitrageEvent['data']): void {
    const event: ArbitrageEvent = {
      type: BrokerEventType.ARBITRAGE,
      timestamp: Date.now(),
      data: opportunity,
    };
    this._emit(BrokerEventType.ARBITRAGE, event);
  }

  emitRiskAlert(alert: RiskAlertEvent['data']): void {
    const event: RiskAlertEvent = {
      type: BrokerEventType.RISK_ALERT,
      brokerId: alert.brokerId,
      timestamp: Date.now(),
      data: alert,
    };
    this._emit(BrokerEventType.RISK_ALERT, event);
  }

  emitKillSwitch(reason: string, disconnectedBrokers: string[]): void {
    const event: KillSwitchEvent = {
      type: BrokerEventType.KILL_SWITCH,
      timestamp: Date.now(),
      data: { reason, disconnectedCount: disconnectedBrokers.length, disconnectedBrokers },
    };
    this._emit(BrokerEventType.KILL_SWITCH, event);
  }

  emitError(brokerId: string | undefined, error: string, details?: any): void {
    const event: BrokerEvent = {
      type: BrokerEventType.ERROR,
      brokerId,
      timestamp: Date.now(),
      data: { error, details },
    };
    this._emit(BrokerEventType.ERROR, event);
    log.error(`[BrokerEventBus] ${brokerId || 'SYSTEM'}: ${error}`);
  }

  // ═══ Subscribe ═════════════════════════════════════

  /** Subscribe to ALL events */
  onEvent(callback: EventCallback): void {
    for (const type of Object.values(BrokerEventType)) {
      this.emitter.on(type, callback);
    }
  }

  /** Subscribe to a specific event type */
  on(eventType: BrokerEventType, callback: EventCallback): void {
    this.emitter.on(eventType, callback);
  }

  off(eventType: BrokerEventType, callback: EventCallback): void {
    this.emitter.off(eventType, callback);
  }

  /** Subscribe to per-broker quote events */
  onQuote(brokerId: string, callback: QuoteCallback): void {
    this.emitter.on(`${BrokerEventType.QUOTE}:${brokerId}`, (event: BrokerEvent) => {
      callback(event.data as TaggedQuoteInfo[]);
    });
  }

  /** Subscribe to per-broker order events */
  onOrderUpdate(brokerId: string, callback: OrderCallback): void {
    this.emitter.on(`${BrokerEventType.ORDER_UPDATE}:${brokerId}`, (event: BrokerEvent) => {
      callback(event.data as TaggedOrderInfo);
    });
  }

  /** Subscribe to arbitrage events */
  onArbitrage(callback: ArbitrageCallback): void {
    this.emitter.on(BrokerEventType.ARBITRAGE, (event: BrokerEvent) => {
      callback(event as ArbitrageEvent);
    });
  }

  /** Subscribe to risk alerts */
  onRiskAlert(callback: RiskCallback): void {
    this.emitter.on(BrokerEventType.RISK_ALERT, (event: BrokerEvent) => {
      callback(event as RiskAlertEvent);
    });
  }

  /** Subscribe to connection status */
  onConnection(callback: StatusCallback): void {
    this.emitter.on(BrokerEventType.CONNECTION, (event: BrokerEvent) => {
      callback(event.brokerId!, event.data.connected);
    });
  }

  // ═══ Query ═════════════════════════════════════════

  getEventLog(limit = 100): BrokerEvent[] {
    return this.eventLog.slice(-limit);
  }

  getEventsByType(type: BrokerEventType, limit = 100): BrokerEvent[] {
    return this.eventLog.filter(e => e.type === type).slice(-limit);
  }

  getEventsByBroker(brokerId: string, limit = 100): BrokerEvent[] {
    return this.eventLog.filter(e => e.brokerId === brokerId).slice(-limit);
  }

  getEventsSince(timestamp: number): BrokerEvent[] {
    return this.eventLog.filter(e => e.timestamp >= timestamp);
  }

  // ═══ Cleanup ═══════════════════════════════════════

  clearEventLog(): void {
    this.eventLog = [];
  }

  destroy(): void {
    this.emitter.removeAllListeners();
    this.eventLog = [];
  }

  // ═══ Private ═══════════════════════════════════════

  private _emit(type: string, event: BrokerEvent): void {
    // Log for replay/debug
    if (this.eventLog.length >= this.maxEventLog) {
      this.eventLog = this.eventLog.slice(-this.maxEventLog / 2);
    }
    this.eventLog.push(event);

    this.emitter.emit(type, event);
  }
}
