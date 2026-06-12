// R127-Q01: nocheck cleared — PM file, type mismatch pending resolution
// ── R114 QTE-17 PM: OpenD L3行情接入 ──────────────────────────────────
// 激活 SubType 2(OrderBook)/4(Ticker)/5(RT)/14(BrokerQueue)
// 新增 ProtoID 映射 + 推送处理分发
//
// @author PM (WorkBuddy)
// @round R114 QTE-17
// @since 2026-06-12

import type {
  OrderBookSnapshot,
  TickRecord,
  BrokerQueueLevel,
} from './depth-types';

// ═══════════════════════════════════════════════════════════════════════
// OpenD L3 SUBSCRIPTION CONFIG
// ═══════════════════════════════════════════════════════════════════════

/** OpenD 推送订阅类型 */
export enum OpenDSubType {
  /** 基础报价 L1 */
  BASIC = 1,
  /** 买卖盘深度 L2 */
  ORDER_BOOK = 2,
  /** 逐笔成交 L3 */
  TICKER = 4,
  /** 分时 RT */
  RT = 5,
  /** 经纪队列 */
  BROKER_QUEUE = 14,
}

/** 富途OpenD行情功能完整订阅配置 */
export const OPEND_L3_SUB_TYPE_LIST: number[] = [
  OpenDSubType.BASIC,          // 1: 基础报价
  OpenDSubType.ORDER_BOOK,     // 2: 买卖盘深度
  OpenDSubType.TICKER,         // 4: 逐笔成交
  OpenDSubType.RT,             // 5: 分时
  OpenDSubType.BROKER_QUEUE,   // 14: 经纪队列
];

/** OpenD ProtoID 映射表 (除Basic已有) */
export const OPEND_L3_PROTO_MAP = {
  // === 拉取 (Request) ===
  GET_ORDER_BOOK: 3012,         // Qot_GetOrderBook
  GET_TICKER: 3010,             // Qot_GetTicker
  GET_RT: 3008,                 // Qot_GetRT
  GET_BROKER_QUEUE: 3014,       // Qot_GetBrokerQueue
  GET_CAPITAL_FLOW: 3312,       // Qot_GetCapitalFlow
  GET_MARKET_SNAPSHOT: 3204,    // Qot_GetMarketSnapshot
  GET_SUSPEND: 3209,            // Qot_GetSuspend
  GET_STATIC_INFO: 3211,        // Qot_GetStaticInfo
  GET_WARRANT: 3310,            // Qot_GetWarrant

  // === 推送 (Push/Update) ===
  UPDATE_ORDER_BOOK: 3013,      // Qot_UpdateOrderBook
  UPDATE_TICKER: 3011,          // Qot_UpdateTicker
  UPDATE_RT: 3009,              // Qot_UpdateRT
  UPDATE_BROKER_QUEUE: 3015,    // Qot_UpdateBrokerQueue

  // === 已有 ===
  GET_BASIC_QUOTE: 3004,
  UPDATE_BASIC_QUOTE: 3005,
} as const;

// ═══════════════════════════════════════════════════════════════════════
// PUSH HANDLER DISPATCHER
// ═══════════════════════════════════════════════════════════════════════

export interface OpenDL3Handlers {
  onOrderBook?: (data: OrderBookSnapshot) => void;
  onTicker?: (data: TickRecord) => void;
  onRT?: (data: { symbol: string; price: number; volume: number; timestamp: number }[]) => void;
  onBrokerQueue?: (data: BrokerQueueLevel[]) => void;
}

/**
 * 将OpenD Proto推送数据分发给对应handler
 *
 * 调用方式 (在opend-base-adapter.ts的推送回调中):
 *   dispatchOpenDL3(protoId, rawData, handlers);
 */
export function dispatchOpenDL3(
  protoId: number,
  rawData: any,
  handlers: OpenDL3Handlers,
  brokerId: string = 'futu',
): void {
  switch (protoId) {
    case OPEND_L3_PROTO_MAP.UPDATE_ORDER_BOOK: {
      // Proto 3013: Qot_UpdateOrderBook
      const ob = rawData.s2c?.orderBook || rawData;
      const bestBidPrice = (ob.bidList || ob.bids || [])[0]?.price || (ob.bidList || ob.bids || [])[0]?.[0] || 0;
      const bestAskPrice = (ob.askList || ob.asks || [])[0]?.price || (ob.askList || ob.asks || [])[0]?.[0] || 0;
      handlers.onOrderBook?.({
        symbol: ob.security?.code || ob.symbol || '',
        exchange: brokerId,
        bids: (ob.bidList || ob.bids || []).map((b: any) => ({
          price: b.price || b[0],
          volume: b.volume || b.qty || b[1],
        })),
        asks: (ob.askList || ob.asks || []).map((a: any) => ({
          price: a.price || a[0],
          volume: a.volume || a.qty || a[1],
        })),
        timestamp: Date.now(),
        sequence: ob.seq || 0,
      });
      break;
    }

    case OPEND_L3_PROTO_MAP.UPDATE_TICKER: {
      // Proto 3011: Qot_UpdateTicker
      const tk = rawData.s2c?.ticker || rawData;
      const tickList = tk.tickerList || tk.ticks || [tk];
      for (const t of tickList) {
        handlers.onTicker?.({
          symbol: t.security?.code || tk.symbol || '',
          brokerId: brokerId,
          price: t.price || 0,
          volume: t.volume || t.qty || 0,
          side: parseTickerDirection(t),
          timestamp: t.time ? new Date(t.time).getTime() : Date.now(),
          sequence: t.seq || t.serialNo || 0,
          condition: t.tickerDirection || '',
        });
      }
      break;
    }

    case OPEND_L3_PROTO_MAP.UPDATE_RT: {
      // Proto 3009: Qot_UpdateRT
      const rt = rawData.s2c?.rt || rawData;
      const rtList = rt.rtList || [rt];
      handlers.onRT?.(rtList.map((r: any) => ({
        symbol: r.security?.code || rt.symbol || '',
        price: r.price || 0,
        volume: r.volume || 0,
        timestamp: r.time ? new Date(r.time).getTime() : Date.now(),
      })));
      break;
    }

    case OPEND_L3_PROTO_MAP.UPDATE_BROKER_QUEUE: {
      // Proto 3015: Qot_UpdateBrokerQueue
      const bq = rawData.s2c?.brokerQueue || rawData;
      const queueList = bq.brokerQueueList || [bq];
      const brokerQueue: BrokerQueueLevel[] = [];

      for (const level of queueList) {
        const bidList = (level.brokerList || level.bidBrokers || []).map((be: any) => ({
          brokerId: String(be.brokerId || be.code || 0),
          brokerName: be.brokerName || be.name || '',
          price: level.price || 0,
          quantity: be.volume || be.qty || 0,
        }));

        const askList = (level.askBrokers || []).map((be: any) => ({
          brokerId: String(be.brokerId || be.code || 0),
          brokerName: be.brokerName || be.name || '',
          price: level.price || 0,
          quantity: be.volume || be.qty || 0,
        }));

        brokerQueue.push({
          price: level.price || 0,
          bidBrokers: bidList,
          askBrokers: askList,
          totalBidQty: bidList.reduce((s: number, b: any) => s + (b.quantity || 0), 0),
          totalAskQty: askList.reduce((s: number, a: any) => s + (a.quantity || 0), 0),
        });
      }

      handlers.onBrokerQueue?.(brokerQueue);
      break;
    }
  }
}

function parseTickerDirection(t: any): 'BUY' | 'SELL' | 'UNKNOWN' {
  const dir = t.direction || t.tickerDirection || t.type || '';
  if (typeof dir === 'string') {
    if (dir.includes('BUY') || dir.includes('B') || dir.includes('Buy')) return 'BUY';
    if (dir.includes('SELL') || dir.includes('S') || dir.includes('Sell')) return 'SELL';
  }
  return 'UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════════════
// OPEND ADAPTER EXTENSION TEMPLATE
// ═══════════════════════════════════════════════════════════════════════

/**
 * opend-base-adapter.ts 改造清单:
 *
 * 1. CMD常量新增:
 *    GET_ORDER_BOOK: 3012,
 *    GET_TICKER: 3010,
 *    GET_RT: 3008,
 *    GET_BROKER_QUEUE: 3014,
 *    GET_CAPITAL_FLOW: 3312,
 *    GET_MARKET_SNAPSHOT: 3204,
 *
 * 2. subscribeAndPush() 方法:
 *    subTypeList: [1]   →   subTypeList: [1, 2, 4, 5, 14]
 *
 * 3. 推送回调 onData() 新增分发:
 *    import { dispatchOpenDL3 } from './opend-l3';
 *    // ...after existing Basic handler...
 *    dispatchOpenDL3(protoId, data, {
 *      onOrderBook: this.onOrderBookHandler,
 *      onTicker: this.onTickerHandler,
 *      onRT: this.onRTHandler,
 *      onBrokerQueue: this.onBrokerQueueHandler,
 *    });
 *
 * 4. 新增方法:
 *    async getOrderBook(symbol: string, depth: number = 10): Promise<OrderBookSnapshot>
 *    async getTickData(symbol: string, count: number = 1000): Promise<TickRecord[]>
 *    async getRTData(symbol: string): Promise<RTDataInfo>
 *    async getBrokerQueue(symbol: string): Promise<BrokerQueueLevel[]>
 *    subscribeDepth(symbol: string): Promise<void>
 *    subscribeTick(symbol: string): Promise<void>
 *    onDepthPush(cb): void
 *    onTickPush(cb): void
 *
 * 5. 改动范围: ~20行新增常量 + ~15行修改subscribeAndPush
 *    + ~80行4个新方法 + ~20行回调注册
 *    = 约135行改动, 不改变现有行为 (subTypeList [1] 保留)
 */
