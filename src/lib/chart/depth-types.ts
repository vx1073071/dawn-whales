// ── R114 QTE-24 QClaw: 深度/Tick/BrokerQueue类型完整定义 ────────────
// PM: 行情升级v2.0 模块5-6 深度行情+逐笔成交 类型基础
// 覆盖: OrderBook(20档+) / Tick / BrokerQueue / Delta增量 / 缓存 / 分析
//
// @author QClaw (document-shrimp)
// @round R114 QTE-24
// @since 2026-06-12
//
// ═══════════════════════════════════════════════════════════════════════
// USAGE GUIDE
// ═══════════════════════════════════════════════════════════════════════
//
// Engine (electron/engine/data/):
//   import type { OrderBookSnapshot, TickRecord, BrokerQueueSnapshot }
//     from '@src/lib/chart/depth-types';
//
// UI (OrderBook瀑布图 / Tick时间轴):
//   import { DepthLevel, TickInfo, AggregatedTick, DepthImbalance, WallAlert }
//     from '../../lib/chart/depth-types';
//
// IPC:
//   ipcMain.handle('depth:getOrderBook', (_, req: DepthRequest): Promise<OrderBookSnapshot>);
//   ipcMain.handle('depth:subscribeTick', (_, req: TickSubscribeRequest) => void);
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: OrderBook 深度行情
// ═══════════════════════════════════════════════════════════════════════

/** 单档深度 */
export interface DepthLevel {
  /** 价格 */
  price: number;
  /** 挂单量 (base amount) */
  size: number;
  /** 订单数 (部分交易所提供) */
  orderCount?: number;
  /** 交易所 (聚合深度时来源) */
  exchange?: string;
}

/** 买一/卖一 (最佳买卖价) */
export interface BestBidAsk {
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  spread: number;        // askPrice - bidPrice
  spreadPercent: number; // (spread / (bid+ask)/2) * 100
}

/** 完整深度快照 */
export interface OrderBookSnapshot {
  /** 交易所 (binance / okx / bybit / futu / tiger / ibkr...) */
  exchange: string;
  /** 标的代码 */
  symbol: string;
  /** 交易所侧更新ID (用于delta排序: Binance=lastUpdateId, OKX=seqId) */
  updateId: number;
  /** 序列号 (OKX/Bybit) */
  seqId?: number;
  /** 上一个updateId (delta校验用) */
  prevUpdateId?: number;
  /** 买方挂单 (价格从高到低) */
  bids: DepthLevel[];
  /** 卖方挂单 (价格从低到高) */
  asks: DepthLevel[];
  /** 最佳买卖价 (快速访问) */
  best: BestBidAsk;
  /** 快照时间戳 (UTC ms) */
  timestamp: number;
  /** 接收时间 (本地UTC ms, 用于测量延迟) */
  localTimestamp: number;
}

/** 增量深度更新 (delta) */
export interface OrderBookDelta {
  exchange: string;
  symbol: string;
  /** 起始updateId (delta适用范围的第一个ID) */
  firstUpdateId: number;
  /** 当前updateId (本次delta的ID) */
  finalUpdateId: number;
  /** 买方价格变动 (价格→新挂单量, 0=删除该档) */
  bidChanges: [number, number][];
  /** 卖方价格变动 */
  askChanges: [number, number][];
  /** 事件时间 */
  eventTime: number;
  /** 本地接收时间 */
  localTimestamp: number;
}

/** DepthCache — LRU快照缓存 (Snapshot + Delta合并) */
export interface DepthCache {
  /** 当前最新快照 (已合并所有delta) */
  snapshot: OrderBookSnapshot;
  /** 待处理的delta队列 (按updateId排序) */
  pendingDeltas: OrderBookDelta[];
  /** 上次全量快照时间 */
  lastSnapshotTime: number;
  /** 已处理的delta数量 */
  deltaCount: number;
  /** 缓存状态 */
  state: 'uninitialized' | 'waiting_snapshot' | 'syncing' | 'ready';
  /** 最大缓存delta数 */
  maxPendingDeltas: number;
}

/** 深度请求 — IPC */
export interface DepthRequest {
  symbol: string;
  exchange?: string;
  /** 档位数 (默认20) */
  levels?: number;
  /** 聚合精度 (0=不聚合) */
  aggregate?: number;
}

/** 深度订阅请求 */
export interface DepthSubscribeRequest {
  symbol: string;
  exchange: string;
  /** 推送频率限制 (ms, 默认100) */
  throttleMs?: number;
  /** 档数 (默认20) */
  levels?: number;
  /** 是否推送delta (false=全量快照) */
  streamDelta?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: Tick 逐笔成交
// ═══════════════════════════════════════════════════════════════════════

/** 逐笔成交方向 */
export type TickSide = 'BUY' | 'SELL' | 'UNKNOWN';

/** 逐笔条件码 (深交所/上交所特有) */
export type TickCondition =
  | 'NORMAL'       // 普通成交
  | 'BLOCK'        // 大宗交易
  | 'CROSS'        // 交叉盘
  | 'ODD_LOT'      // 碎股
  | 'AUCTION'      // 竞价
  | 'PRE_CLOSE'    // 收市竞价
  | 'AFTER_HOURS'  // 暗盘/盘后
  | 'OPENING'      // 开盘成交
  | 'CLOSING';     // 收盘成交

/** 单笔逐笔成交 (Tick) */
export interface TickRecord {
  /** 交易所 */
  exchange: string;
  /** 标的代码 */
  symbol: string;
  /** 成交价格 */
  price: number;
  /** 成交数量 (base amount) */
  size: number;
  /** 成交额 (= price * size) */
  turnover: number;
  /** 方向 */
  side: TickSide;
  /** 成交时间 (UTC ms) */
  timestamp: number;
  /** 交易ID (交易所原始ID) */
  tradeId: string;
  /** 序列号 */
  seqId?: number;
  /** 条件码 (深/沪特有) */
  condition?: TickCondition;
  /** 买方订单号 (部分交易所提供) */
  buyerOrderId?: string;
  /** 卖方订单号 */
  sellerOrderId?: string;
}

/** 聚合逐笔 (N秒/分钟级, 用于K线补充) */
export interface AggregatedTick {
  symbol: string;
  /** 区间起始时间 (UTC ms) */
  startTime: number;
  /** 区间结束时间 */
  endTime: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 总成交量 */
  volume: number;
  /** 总成交额 */
  turnover: number;
  /** 成交笔数 */
  tradeCount: number;
  /** 主动买入成交量 */
  buyVolume: number;
  /** 主动卖出成交量 */
  sellVolume: number;
  /** 主动买入笔数 */
  buyCount: number;
  /** 主动卖出笔数 */
  sellCount: number;
  /** 大单成交笔数 (数量>3σ) */
  largeTradeCount: number;
  /** 大单成交总量 */
  largeTradeVolume: number;
  /** VWAP */
  vwap: number;
}

/** 逐笔成交订阅请求 */
export interface TickSubscribeRequest {
  symbol: string;
  exchange: string;
  /** 限制数量 (0=不限制) */
  limit?: number;
  /** 是否聚合 (聚合周期ms, 0=不聚合) */
  aggregateMs?: number;
}

/** 逐笔成交缓存 — 环形缓冲区 */
export interface TickBuffer {
  symbol: string;
  /** 最大容量 */
  maxSize: number;
  /** 缓存的逐笔数据 (按时间排序) */
  ticks: TickRecord[];
  /** 最早tick时间 */
  oldestTime: number;
  /** 最新tick时间 */
  newestTime: number;
  /** 缓冲区总数 (含溢出) */
  totalCount: number;
  /** 溢出丢弃数量 */
  droppedCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: BrokerQueue 经纪商买卖盘 (港股/台股特有)
// ═══════════════════════════════════════════════════════════════════════

/** 单个经纪商的挂单详情 */
export interface BrokerInfo {
  /** 经纪商ID (如 0128=辉立, 0079=耀才, 0129=大华继显) */
  brokerId: string;
  /** 经纪商名称 */
  brokerName: string;
  /** 挂单价格档位 */
  price: number;
  /** 挂单数量 */
  quantity: number;
  /** 挂单方向 */
  side: 'BID' | 'ASK';
  /** 订单数 */
  orderCount?: number;
  /** 时间戳 */
  timestamp: number;
}

/** 经纪商排队快照 (单档) */
export interface BrokerQueueLevel {
  /** 价格 */
  price: number;
  /** 买方经纪商列表 (按数量排序) */
  bidBrokers: BrokerInfo[];
  /** 卖方经纪商列表 */
  askBrokers: BrokerInfo[];
  /** 买方总挂单量 */
  totalBidQty: number;
  /** 卖方总挂单量 */
  totalAskQty: number;
}

/** 多档经纪商排队快照 */
export interface BrokerQueueSnapshot {
  symbol: string;
  /** 每档经纪商买卖详情 */
  levels: BrokerQueueLevel[];
  /** 时间戳 */
  timestamp: number;
  /** ProtoID (富途: 3014/3015) */
  protoId?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: DepthAnalyzer 分析类型 (QTE-11 引擎输出)
// ═══════════════════════════════════════════════════════════════════════

/** 资金失衡 (Imbalance) */
export interface DepthImbalance {
  /** 总买单量 */
  totalBidSize: number;
  /** 总卖单量 */
  totalAskSize: number;
  /** 失衡比率 (正=买盘优势, 负=卖盘优势) */
  imbalanceRatio: number;
  /** 失衡程度 (0-1, >0.3则预警) */
  imbalanceScore: number;
  /** 是否触发预警 */
  alerted: boolean;
  /** 计算时间 */
  timestamp: number;
}

/** 挂单墙检测结果 */
export interface WallDetection {
  /** 价格 */
  price: number;
  /** 方向 */
  side: 'BID' | 'ASK';
  /** 挂单量 */
  size: number;
  /** 该档挂单量与最近5档均值的比值 (>3触发预警) */
  ratio: number;
  /** 警告等级 */
  severity: 'info' | 'warning' | 'critical';
  /** 检测时间 */
  timestamp: number;
}

/** 幌骗检测结果 (Spoofing) */
export interface SpoofAlert {
  /** 价格 */
  price: number;
  /** 方向 */
  side: 'BID' | 'ASK';
  /** 初始挂单量 */
  initialSize: number;
  /** 撤单后剩余量 */
  remainingSize: number;
  /** 挂单到撤单的时间 (ms) */
  durationMs: number;
  /** 幌骗比率 (>5x且5s内撤单=确认) */
  spoofRatio: number;
  /** 检测时间 */
  timestamp: number;
}

/** 流动性评分 */
export interface LiquidityScore {
  /** 总分 0-100 */
  overall: number;
  /** 挂单深度子分 (0-25) */
  depthScore: number;
  /** 买卖价差子分 (0-25) */
  spreadScore: number;
  /** 盘口厚度子分 (0-25, 前5档均量) */
  thicknessScore: number;
  /** 交易活跃度子分 (0-25, tick频率) */
  activityScore: number;
  /** 评分等级 */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** 评分时间 */
  timestamp: number;
}

/** 滑点预估 */
export interface SlippageEstimate {
  symbol: string;
  /** 基准价格 (mid price) */
  basePrice: number;
  /** 给定买入金额的预估滑点 */
  buy: {
    /** amount → expected price → slippage% */
    estimates: { amount: number; avgPrice: number; slippageBps: number }[];
  };
  /** 给定卖出金额的预估滑点 */
  sell: {
    estimates: { amount: number; avgPrice: number; slippageBps: number }[];
  };
  /** 计算时间 */
  timestamp: number;
}

/** DepthAnalyzer 完整输出 */
export interface DepthAnalysisResult {
  symbol: string;
  exchange: string;
  /** 资金失衡 */
  imbalance: DepthImbalance;
  /** 挂单墙列表 */
  walls: WallDetection[];
  /** 幌骗警报列表 */
  spoofAlerts: SpoofAlert[];
  /** 流动性评分 */
  liquidity: LiquidityScore;
  /** 滑点预估 */
  slippage: SlippageEstimate;
  /** 发送给前端的深度热力图数据 */
  heatmap: DepthHeatmap;
  /** 分析时间 */
  timestamp: number;
}

/** 深度热力图数据 (前端渲染用) */
export interface DepthHeatmap {
  /** 买方区域 (价格从bid中心向下延伸) */
  bidZones: HeatmapZone[];
  /** 卖方区域 (价格从ask中心向上延伸) */
  askZones: HeatmapZone[];
}

/** 热力图单个区域 */
export interface HeatmapZone {
  /** 起始价格 */
  priceStart: number;
  /** 结束价格 */
  priceEnd: number;
  /** 挂单密度 (0-1, 用于颜色渐变) */
  density: number;
  /** 总挂单量 */
  totalSize: number;
  /** 总订单数 */
  totalOrders: number;
  /** 大单墙颜色 (null=普通, 'wall'=墙) */
  highlight?: 'wall' | 'spoof' | null;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: Broker深度数据源统一接口
// ═══════════════════════════════════════════════════════════════════════

/** 深度数据源类型 */
export type DepthSourceType = 'REST' | 'WS_SNAPSHOT' | 'WS_DELTA' | 'WS_INCREMENTAL';

/** 交易所深度配置 */
export interface ExchangeDepthConfig {
  /** 交易所标识 */
  exchange: string;
  /** 深度数据源类型 */
  sourceType: DepthSourceType;
  /** 最大档数 */
  maxLevels: number;
  /** 默认档数 */
  defaultLevels: number;
  /** Delta推送频率 (ms) */
  updateFrequency: number;
  /** 快照推送频率 (ms) */
  snapshotFrequency: number;
  /** 深度WS端点 */
  wsEndpoint?: string;
  /** 深度REST端点 */
  restEndpoint?: string;
  /** 是否需要校验seqId (OKX/Bybit=true) */
  validateSeqId: boolean;
}

/** 已知交易所深度配置表 */
export const EXCHANGE_DEPTH_CONFIGS: Record<string, ExchangeDepthConfig> = {
  binance: {
    exchange: 'binance', sourceType: 'WS_DELTA', maxLevels: 5000,
    defaultLevels: 20, updateFrequency: 100, snapshotFrequency: 1000,
    wsEndpoint: 'wss://stream.binance.com:9443/ws',
    restEndpoint: 'https://api.binance.com/api/v3/depth',
    validateSeqId: false,
  },
  okx: {
    exchange: 'okx', sourceType: 'WS_SNAPSHOT', maxLevels: 400,
    defaultLevels: 20, updateFrequency: 100, snapshotFrequency: 0,
    wsEndpoint: 'wss://ws.okx.com:8443/ws/v5/public',
    validateSeqId: true,
  },
  bybit: {
    exchange: 'bybit', sourceType: 'WS_DELTA', maxLevels: 200,
    defaultLevels: 50, updateFrequency: 100, snapshotFrequency: 0,
    wsEndpoint: 'wss://stream.bybit.com/v5/public/spot',
    validateSeqId: true,
  },
  bitget: {
    exchange: 'bitget', sourceType: 'WS_INCREMENTAL', maxLevels: 150,
    defaultLevels: 20, updateFrequency: 100, snapshotFrequency: 0,
    wsEndpoint: 'wss://ws.bitget.com/v2/ws/public',
    validateSeqId: false,
  },
  futu: {
    exchange: 'futu', sourceType: 'WS_DELTA', maxLevels: 10,
    defaultLevels: 10, updateFrequency: 0, snapshotFrequency: 0,
    validateSeqId: false,
  },
  tiger: {
    exchange: 'tiger', sourceType: 'REST', maxLevels: 40,
    defaultLevels: 40, updateFrequency: 500, snapshotFrequency: 0,
    validateSeqId: false,
  },
  ibkr: {
    exchange: 'ibkr', sourceType: 'WS_DELTA', maxLevels: 20,
    defaultLevels: 20, updateFrequency: 250, snapshotFrequency: 0,
    validateSeqId: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: 多交易所深度聚合 (CBBO)
// ═══════════════════════════════════════════════════════════════════════

/** 聚合深度快照 (多交易所合并) */
export interface AggregatedOrderBook {
  symbol: string;
  /** 交易所列表 */
  exchanges: string[];
  /** 聚合买方深度 (价格从高到低, 同价合并size) */
  bids: DepthLevel[];
  /** 聚合卖方深度 */
  asks: DepthLevel[];
  /** CBBO (NBBO加密版) — 全国最优买卖价 */
  best: BestBidAsk;
  /** 各交易所期权性风险 (套利判定) */
  arbitrage?: AggregatedArbitrage;
  /** 快照时间 */
  timestamp: number;
}

/** 聚合套利机会 */
export interface AggregatedArbitrage {
  /** 套利机会数量 (>0即存在可套利空间) */
  opportunityCount: number;
  /** 最大套利bps */
  maxProfitBps: number;
  /** 套利方向 (跨所买卖价差) */
  pair: {
    buyExchange: string;
    buyPrice: number;
    sellExchange: string;
    sellPrice: number;
    spreadBps: number;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: IBrokerDepthAdapter 接口 (券商扩展)
// ═══════════════════════════════════════════════════════════════════════

/** 深度行情回调 */
export type DepthCallback = (data: OrderBookSnapshot | OrderBookDelta) => void;

/** 逐笔成交回调 */
export type TickCallback = (tick: TickRecord) => void;

/** 经纪商排队回调 */
export type BrokerQueueCallback = (queue: BrokerQueueSnapshot) => void;

/** 券商深度适配器接口 — 所有具备L3行情的券商必须实现 */
export interface IBrokerDepthAdapter {
  readonly name: string;
  /** 是否支持OrderBook深度 */
  readonly supportsOrderBook: boolean;
  /** 是否支持逐笔成交 */
  readonly supportsTick: boolean;
  /** 是否支持经纪商排队 */
  readonly supportsBrokerQueue: boolean;

  // ── OrderBook ──

  /** 获取深度快照 (REST) */
  getOrderBook(symbol: string, levels?: number): Promise<OrderBookSnapshot>;

  /** 订阅深度推送 (WS) */
  subscribeOrderBook(symbol: string, callback: DepthCallback, levels?: number): Promise<void>;

  /** 取消订阅深度 */
  unsubscribeOrderBook(symbol: string): Promise<void>;

  // ── Tick ──

  /** 订阅逐笔成交推送 */
  subscribeTick(symbol: string, callback: TickCallback): Promise<void>;

  /** 取消订阅逐笔 */
  unsubscribeTick(symbol: string): Promise<void>;

  // ── BrokerQueue (港股专用) ──

  /** 获取经纪商排队 */
  getBrokerQueue?(symbol: string): Promise<BrokerQueueSnapshot>;

  /** 订阅经纪商排队推送 */
  subscribeBrokerQueue?(symbol: string, callback: BrokerQueueCallback): Promise<void>;

  /** 取消订阅 */
  unsubscribeBrokerQueue?(symbol: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: IPC Contract
// ═══════════════════════════════════════════════════════════════════════

/** IPC: depth:getOrderBook */
export interface IpcDepthRequest {
  symbol: string;
  exchange?: string;
  levels?: number;
}

export interface IpcDepthResponse {
  success: boolean;
  data: OrderBookSnapshot;
  error?: string;
}

/** IPC: depth:subscribe */
export interface IpcDepthSubscribeRequest {
  symbol: string;
  exchange: string;
  throttleMs?: number;
  levels?: number;
}

/** IPC: tick:subscribe */
export interface IpcTickSubscribeRequest {
  symbol: string;
  exchange: string;
  limit?: number;
  aggregateMs?: number;
}

/** IPC: brokerqueue:get (港股) */
export interface IpcBrokerQueueRequest {
  symbol: string;
}

export interface IpcBrokerQueueResponse {
  success: boolean;
  data: BrokerQueueSnapshot;
  error?: string;
}

/** IPC: depth:analyze (DepthAnalyzer) */
export interface IpcDepthAnalyzeRequest {
  symbol: string;
  exchange: string;
  snapshot: OrderBookSnapshot;
}

export interface IpcDepthAnalyzeResponse {
  success: boolean;
  data: DepthAnalysisResult;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT AGGREGATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * 全部深度/逐笔类型导出 (import from '@src/lib/chart/depth-types')
 *
 * OrderBook:
 *   DepthLevel, OrderBookSnapshot, OrderBookDelta, DepthCache,
 *   DepthRequest, DepthSubscribeRequest, BestBidAsk
 *
 * Tick:
 *   TickRecord, TickSide, TickCondition, AggregatedTick,
 *   TickBuffer, TickSubscribeRequest
 *
 * BrokerQueue (港股):
 *   BrokerInfo, BrokerQueueLevel, BrokerQueueSnapshot
 *
 * DepthAnalyzer:
 *   DepthImbalance, WallDetection, SpoofAlert, LiquidityScore,
 *   SlippageEstimate, DepthAnalysisResult, DepthHeatmap, HeatmapZone
 *
 * 多交易所聚合:
 *   AggregatedOrderBook, AggregatedArbitrage
 *
 * 券商接口:
 *   IBrokerDepthAdapter, DepthCallback, TickCallback, BrokerQueueCallback,
 *   ExchangeDepthConfig, EXCHANGE_DEPTH_CONFIGS
 *
 * IPC:
 *   IpcDepthRequest, IpcDepthResponse, IpcDepthSubscribeRequest,
 *   IpcTickSubscribeRequest, IpcBrokerQueueRequest, IpcBrokerQueueResponse,
 *   IpcDepthAnalyzeRequest, IpcDepthAnalyzeResponse
 */
