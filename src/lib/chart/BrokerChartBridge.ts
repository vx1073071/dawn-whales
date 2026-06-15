// ── R221-auto#1 (L20): BrokerChartBridge 类型定义 + IPC文档 ──────────────
// 桥接JVS(broker/engine) ↔ ML(chart components)
// 5链路: broker ↔ IPC ↔ bridge ↔ engine ↔ UI
//
// @see src/hooks/ChartContext.tsx       — chart全局状态
// @see electron/ipc/em-ipc.ts          — IPC注册
// @see electron/broker/opend-base-adapter.ts — broker适配器
// @see src/lib/chart/ws-pool.ts        — WebSocket连接池

// ═══════════════════════════════════════════════════════════════════════════
// IPC CHANNEL NAMES
// ═══════════════════════════════════════════════════════════════════════════

export const IPC_CHANNELS = {
  // ── Quote (行情) ──
  QUOTE_STREAM:       'broker:quote-stream',
  QUOTE_SNAPSHOT:     'broker:quote-snapshot',
  QUOTE_BATCH:        'broker:quote-batch',
  QUOTE_SUBSCRIBE:    'broker:quote-subscribe',
  QUOTE_UNSUBSCRIBE:  'broker:quote-unsubscribe',

  // ── Kline (K线) ──
  KLINE_GET:          'broker:kline-get',
  KLINE_STREAM:       'broker:kline-stream',
  KLINE_SUBSCRIBE:    'broker:kline-subscribe',
  KLINE_UNSUBSCRIBE:  'broker:kline-unsubscribe',

  // ── Depth (深度) ──
  DEPTH_STREAM:       'broker:depth-stream',
  DEPTH_SNAPSHOT:     'broker:depth-snapshot',

  // ── Footprint (足迹) ──
  FOOTPRINT_STREAM:   'broker:footprint-stream',

  // ── Order (下单) ──
  ORDER_PLACE:        'broker:order-place',
  ORDER_CANCEL:       'broker:order-cancel',
  ORDER_STATUS:       'broker:order-status',
  ORDER_HISTORY:      'broker:order-history',

  // ── Connection (连接) ──
  BROKER_CONNECT:     'broker:connect',
  BROKER_DISCONNECT:  'broker:disconnect',
  BROKER_STATUS:      'broker:status',
  BROKER_STATUS_CHANGED: 'broker:status-changed',

  // ── Notification (通知) ──
  NOTIFICATION:       'broker:notification',
  DIFFERENTIAL:       'broker:differential',    // 增量数据
  INDICATOR:          'broker:indicator',       // 技术指标

  // ── Chart Sync (同步) ──
  CHART_SYMBOL_SET:   'chart:symbol-set',
  CHART_TIMEFRAME_SET:'chart:timeframe-set',
  CHART_MARKET_SET:   'chart:market-set',

  // ── Error / Alert ──
  BROKER_ERROR:       'broker:error',
  BROKER_ALERT:       'broker:alert',
} as const;

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ═══════════════════════════════════════════════════════════════════════════
// DATA TYPES — Broker → Bridge → Chart
// ═══════════════════════════════════════════════════════════════════════════

/** 实时报价 — broker原生格式 */
export interface BrokerQuote {
  code: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  timestamp: number;
  source: string;          // broker ID: 'futu' | 'ibkr' | 'binance' | 'okx' | 'paper'
}

/** K线数据 — broker原生格式 */
export interface BrokerKline {
  code: string;
  period: string;          // '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | 'D' | 'W' | 'M'
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}

/** 深度数据 */
export interface BrokerDepth {
  code: string;
  bids: Array<{ price: number; size: number; orderCount?: number }>;
  asks: Array<{ price: number; size: number; orderCount?: number }>;
  timestamp: number;
}

/** 足迹数据 (Tick级微观结构) */
export interface BrokerFootprint {
  code: string;
  time: number;
  price: number;
  volume: number;
  side: 'buy' | 'sell' | 'neutral';
  bidVolume: number;
  askVolume: number;
  delta: number;           // bidVolume - askVolume
  cumulativeDelta: number;
}

/** 下单请求 */
export interface BrokerOrderRequest {
  code: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  price?: number;
  stopPrice?: number;
  quantity: number;
  tif?: 'day' | 'gtc' | 'ioc' | 'fok';
}

/** 订单状态 */
export interface BrokerOrder {
  orderId: string;
  code: string;
  side: 'buy' | 'sell';
  orderType: string;
  price: number;
  stopPrice?: number;
  quantity: number;
  filledQty: number;
  status: 'pending' | 'submitted' | 'partial_filled' | 'filled' | 'cancelled' | 'rejected';
  createdAt: number;
  updatedAt: number;
  brokerId: string;
}

/** 券商连接状态 */
export interface BrokerConnectionStatus {
  brokerId: string;
  brokerName: string;
  connected: boolean;
  connectionMode: 'websocket' | 'polling' | 'offline';
  latency: number;         // ms
  lastHeartbeat: number;
  uptime: number;          // ms
  errors: number;
  reconnectCount: number;
  /** 🟢绿色 🟡黄色 🔴红色 */
  health: 'green' | 'yellow' | 'red';
}

/** 通知消息 */
export interface BrokerNotification {
  brokerId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  actionable: boolean;
  action?: {
    label: string;
    handler: string;   // IPC channel to invoke
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC PAYLOAD CONTRACTS — 请求/响应格式
// ═══════════════════════════════════════════════════════════════════════════

/** 通用IPC响应包裹 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp: number;
}

// ── Quote ──
export interface QuoteSubscribeRequest {
  symbols: string[];
  brokerId?: string;       // 不传=all connected
}
export interface QuoteStreamEvent {
  symbols: string[];
  quotes: BrokerQuote[];
  fullUpdate: boolean;     // true=全量刷新, false=增量
}

// ── Kline ──
export interface KlineGetRequest {
  symbol: string;
  period: BrokerKline['period'];
  count?: number;          // default 200
  startTime?: number;
  endTime?: number;
}
export interface KlineGetResponse {
  symbol: string;
  period: string;
  klines: BrokerKline[];
}

// ── Depth ──
export interface DepthSubscribeRequest {
  symbol: string;
  levels?: number;         // default 10
}
export interface DepthStreamEvent {
  symbol: string;
  depth: BrokerDepth;
}

// ── Footprint ──
export interface FootprintSubscribeRequest {
  symbol: string;
  aggregationMs?: number;  // default 1000
}
export interface FootprintStreamEvent {
  symbol: string;
  footprints: BrokerFootprint[];
}

// ── Order ──
export interface OrderPlaceRequest extends BrokerOrderRequest {
  brokerId?: string;
}
export interface OrderConfirmRequest {
  order: BrokerOrderRequest;
  /** 用户确认后的回调通道 */
  confirmChannel: string;
}
export interface OrderResponse {
  order: BrokerOrder;
}

// ── Connection ──
export interface BrokerConnectRequest {
  brokerId: string;
  config?: Record<string, unknown>;
}
export interface BrokerStatusEvent {
  brokerId: string;
  status: BrokerConnectionStatus;
}

// ── Chart Sync ──
export interface ChartSyncEvent {
  symbol?: string;
  timeframe?: string;
  market?: string;
}

// ── Notification ──
export interface BrokerNotificationEvent {
  notification: BrokerNotification;
}

// ═══════════════════════════════════════════════════════════════════════════
// BRIDGE — JVS ↔ ML 接口契约
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BrokerChartBridge — JVS(engine侧) ↔ ML(chart组件侧) 的完整接口契约
 *
 * JVS侧实现: electron/broker/ + electron/ipc/
 * ML侧消费: src/components/chart/ + src/components/broker/
 *
 * 5链路各自职责:
 *   1. broker    — 原生券商协议适配 (Futu OpenD / IBKR / Binance WS)
 *   2. IPC       — Electron main↔renderer 事件通道
 *   3. bridge    — 数据格式转换(本文件定义类型) + preload暴露API
 *   4. engine    — 因子计算/信号生成/风控
 *   5. UI        — ChartContextProvider + 26个chart/broker组件
 */
export interface BrokerChartBridge {
  // ── 行情链路 ──
  subscribeQuotes(req: QuoteSubscribeRequest): Promise<IpcResponse<void>>;
  unsubscribeQuotes(symbols: string[]): Promise<IpcResponse<void>>;
  onQuote(callback: (event: QuoteStreamEvent) => void): () => void;  // returns unsubscribe

  // ── K线链路 ──
  getKlines(req: KlineGetRequest): Promise<IpcResponse<KlineGetResponse>>;
  subscribeKlines(symbol: string, period: string): Promise<IpcResponse<void>>;
  unsubscribeKlines(symbol: string): Promise<IpcResponse<void>>;
  onKline(callback: (event: { symbol: string; kline: BrokerKline }) => void): () => void;

  // ── 深度链路 ──
  subscribeDepth(req: DepthSubscribeRequest): Promise<IpcResponse<void>>;
  unsubscribeDepth(symbol: string): Promise<IpcResponse<void>>;
  onDepth(callback: (event: DepthStreamEvent) => void): () => void;

  // ── 足迹链路 ──
  subscribeFootprint(req: FootprintSubscribeRequest): Promise<IpcResponse<void>>;
  unsubscribeFootprint(symbol: string): Promise<IpcResponse<void>>;
  onFootprint(callback: (event: FootprintStreamEvent) => void): () => void;

  // ── 下单链路 ──
  placeOrder(req: OrderPlaceRequest): Promise<IpcResponse<OrderResponse>>;
  cancelOrder(orderId: string): Promise<IpcResponse<void>>;
  getOrders(brokerId?: string): Promise<IpcResponse<BrokerOrder[]>>;
  onOrderUpdate(callback: (order: BrokerOrder) => void): () => void;

  // ── 连接状态 ──
  connect(req: BrokerConnectRequest): Promise<IpcResponse<BrokerConnectionStatus>>;
  disconnect(brokerId: string): Promise<IpcResponse<void>>;
  getBrokerStatus(brokerId?: string): Promise<IpcResponse<BrokerConnectionStatus[]>>;
  onBrokerStatusChange(callback: (event: BrokerStatusEvent) => void): () => void;

  // ── 通知/告警 ──
  onNotification(callback: (event: BrokerNotificationEvent) => void): () => void;
  onError(callback: (error: { brokerId: string; message: string; code: string }) => void): () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC REGISTRATION DOCUMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * # IPC 注册清单 — 4个待注册通道
 *
 * R221-JVS#2 要求在 electron/ipc/em-ipc.ts 中注册:
 *
 * ### 1. broker:notification
 * ```ts
 * ipcMain.handle('broker:notification', async (_event, req) => {
 *   // 转发券商通知到 renderer
 *   mainWindow.webContents.send('broker:notification', req);
 *   return { success: true };
 * });
 * ```
 *
 * ### 2. broker:differential
 * ```ts
 * ipcMain.handle('broker:differential', async (_event, req) => {
 *   // 增量数据推送 (仅发送变更字段)
 *   mainWindow.webContents.send('broker:differential', req);
 *   return { success: true };
 * });
 * ```
 *
 * ### 3. broker:indicator
 * ```ts
 * ipcMain.handle('broker:indicator', async (_event, req) => {
 *   // 技术指标计算结果推送
 *   mainWindow.webContents.send('broker:indicator', req);
 *   return { success: true };
 * });
 * ```
 *
 * ### 4. broker:status-changed
 * ```ts
 * // 已有 handle 改为双向:
 * // 从 ipcMain.handle → ipcMain.on + webContents.send
 * // 确保 renderer 侧能实时收到状态变更事件
 * ```
 *
 * ## Preload 暴露清单 (window.api.brokerChart)
 * ```ts
 * contextBridge.exposeInMainWorld('api', {
 *   brokerChart: {
 *     subscribeQuotes: (req) => ipcRenderer.invoke(IPC_CHANNELS.QUOTE_SUBSCRIBE, req),
 *     getKlines: (req) => ipcRenderer.invoke(IPC_CHANNELS.KLINE_GET, req),
 *     // ... 其余按 BrokerChartBridge 接口
 *   }
 * });
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  IPC_CHANNELS,
};
