// R123-Q01: @ts-nocheck removed — imports validated
import type { KlineBar, Timeframe, AdjustType } from './types';
// DAWN WHALES R121 — Split from types.ts
// Sections 5-8: IPC handler contracts, indicator results, data export types

// SECTION 5: 指标计算结果类型
// ═══════════════════════════════════════════════════════════════════════

/** 指标计算请求 — IPC interface */
export interface IndicatorRequest {
  /** 标的代码 */
  symbol: string;
  /** 指标ID */
  indicatorId: string;
  /** K线数据 */
  bars: KlineBar[];
  /** 指标参数 */
  params?: Record<string, number>;
}

/** 单线指标结果 */
export interface SingleLineResult {
  indicatorId: string;
  label: string;
  /** 数据 (null=该位置无计算结果) */
  values: (number | null)[];
  color: string;
  lineWidth: number;
  dash?: number[];
}

/** 多线指标结果 (MACD/BOLL/KDJ/Ichimoku) */
export interface MultiLineResult {
  indicatorId: string;
  label: string;
  lines: {
    name: string;
    values: (number | null)[];
    color: string;
    lineWidth: number;
    dash?: number[];
    /** histogram 类型用柱状图渲染 */
    style?: 'line' | 'histogram';
  }[];
  referenceLines?: number[];
}

/** 统一指标结果类型 */
export type IndicatorResult = SingleLineResult | MultiLineResult;

/** 指标计算结果全集 (批量计算返回值) */
export interface FullIndicatorSuite {
  success: boolean;
  symbol: string;
  timestamp: number;
  /** 各个指标的计算结果 */
  results: IndicatorResult[];
  error?: string;
}

// ═══════ IPC handler contracts ═══════

/** IPC: chart:getKlines 请求 */
export interface IpcKlineRequest {
  symbol: string;
  brokerId?: string;
  timeframe: Timeframe;
  adjust?: AdjustType;
  count?: number;
}

/** IPC: chart:getKlines 响应 */
export interface IpcKlineResponse {
  success: boolean;
  data: KlineBar[];
  error?: string;
}

/** IPC: indicator:compute 请求 */
export interface IpcIndicatorRequest {
  symbol: string;
  indicatorIds: string[];
  bars: KlineBar[];
  params?: Record<string, Record<string, number>>; // indicatorId -> params
}

/** IPC: indicator:compute 响应 */
export interface IpcIndicatorResponse {
  success: boolean;
  data: IndicatorResult[];
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: 指标ID枚举
// ═══════════════════════════════════════════════════════════════════════

/** 20核心指标ID常量 (供代码使用, 避免魔法字符串) */
export const INDICATOR_IDS = {
  // Trend
  MA: 'ma',
  EMA: 'ema',
  SMA_WEIGHTED: 'wma',
  BOLL: 'boll',
  ICHIMOKU: 'ichimoku',
  // Momentum
  MACD: 'macd',
  RSI: 'rsi',
  KDJ: 'kdj',
  WR: 'wr',
  CCI: 'cci',
  ROC: 'roc',
  // Volatility
  ATR: 'atr',
  STDDEV: 'stddev',
  // Volume
  OBV: 'obv',
  VWAP: 'vwap',
  MFI: 'mfi',
  // Overlay
  SAR: 'sar',
  PIVOT: 'pivot',
  MA_ENVELOPE: 'ma-envelope',
  EMA_CROSS: 'ema-cross',
} as const;

/** 指标ID联合类型 */
export type IndicatorId = (typeof INDICATOR_IDS)[keyof typeof INDICATOR_IDS];

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: Engine接口契约
// ═══════════════════════════════════════════════════════════════════════

/**
 * IndicatorEngine 接口 — electron/engine (主进程Web Worker池)
 *
 * @example
 *   const engine = new IndicatorEngine({ poolSize: 4 });
 *   await engine.compute(bars, [
 *     { indicatorId: 'ma', params: { period: 20 } },
 *     { indicatorId: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
 *   ]);
 */
export interface IIndicatorEngine {
  /** 批量计算指标 (Web Worker池并行) */
  compute(
    bars: KlineBar[],
    requests: { indicatorId: string; params?: Record<string, number> }[]
  ): Promise<IndicatorResult[]>;

  /** 注册自定义指标 */
  register(id: string, calcFn: (bars: KlineBar[], params: Record<string, number>) => (number | null)[] | (number | null)[][]): void;

  /** 获取已注册指标列表 */
  getRegistered(): string[];

  /** 销毁Worker池 */
  dispose(): void;
}

/** IndicatorEngine 构造选项 */
export interface IndicatorEngineOptions {
  /** Worker线程数 (默认 navigator.hardwareConcurrency - 1) */
  poolSize?: number;
  /** 批处理大小 (默认100) */
  batchSize?: number;
  /** 最大K线数量 (默认10000) */
  maxBars?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: 指标计算函数签名 (types only, impl in indicator-engine.ts)
// ═══════════════════════════════════════════════════════════════════════

/** 来源价格字段选择 */
export type PriceField = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

/** SMA/EMA/WMA 公用的输入类型 */
export interface MovingAverageInput {
  bars: KlineBar[];
  period: number;
  field?: PriceField;
}

/** TREND 指标输出类型 */
export interface TrendResult { values: (number | null)[]; }

/** MACD 输出 */
export interface MACDOutput {
  dif: (number | null)[];
  dea: (number | null)[];
  histogram: (number | null)[];
}

/** BOLL 输出 */
export interface BOLLOutput {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

/** KDJ 输出 */
export interface KDJOutput {
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
}

/** Ichimoku 输出 */
export interface IchimokuOutput {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
}

/** PivotPoints 输出 */
export interface PivotOutput {
  r3: (number | null)[];
  r2: (number | null)[];
  r1: (number | null)[];
  pp: (number | null)[];
  s1: (number | null)[];
  s2: (number | null)[];
  s3: (number | null)[];
}

// ═══════ Backward-compat: IndicatorLine (used by KLineChartPro) ═══════

/** 指标线渲染定义 (兼容旧版KLineChartPro) */
export interface IndicatorLine {
  label: string;
  color: string;
  lineWidth: number;
  dash?: number[];
  data: (number | null)[];
}

/** EMA Cross 信号输出 */
export interface CrossSignalOutput {
  cross: (number | null)[];  // 1=golden cross, -1=dead cross
  fast: (number | null)[];
  slow: (number | null)[];
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 9: 多图联动类型
// ═══════════════════════════════════════════════════════════════════════

/** 多图布局配置 */
export interface MultiChartLayout {
  /** 布局模式 */
  mode: 'single' | 'dual' | 'quad' | 'hex';
  /** 每个子图配置 */
  panes: PaneConfig[];
}

/** 单个K线图面板配置 */
export interface PaneConfig {
  /** 面板ID */
  id: string;
  /** 标的代码 */
  symbol: string;
  /** K线周期 */
  timeframe: Timeframe;
  /** 复权类型 */
  adjust?: AdjustType;
  /** 指标列表 */
  indicators?: string[];
  /** 网格位置 (0-based) */
  row: number;
  col: number;
}

/** 时间轴联动状态 */
export interface TimeSync {
  /** 当前可视起始时间 */
  from: number;
  /** 当前可视结束时间 */
  to: number;
  /** 主导面板ID (用户拖拽的面板) */
  masterPaneId: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 10: Web Worker 消息协议
// ═══════════════════════════════════════════════════════════════════════

/** Worker → Main 计算结果消息 */
export interface WorkerResultMessage {
  type: 'result';
  jobId: string;
  indicatorId: string;
  result: IndicatorResult;
}

/** Worker → Main 就绪消息 */
export interface WorkerReadyMessage {
  type: 'ready';
  workerId: number;
}

/** Main → Worker 计算任务消息 */
export interface WorkerComputeMessage {
  type: 'compute';
  jobId: string;
  indicatorId: string;
  bars: KlineBar[];
  params: Record<string, number>;
}

/** Worker消息联合类型 */
export type WorkerMessage =
  | WorkerResultMessage
  | WorkerReadyMessage
  | WorkerComputeMessage;

// ═══════════════════════════════════════════════════════════════════════
// SECTION 11: MarketSnapshot 市场快照类型 (模块7热力图数据源)
// ═══════════════════════════════════════════════════════════════════════

/** 市场快照 — 单只股票基本数据 (热力图/筛选器/排行榜数据源) */
export interface MarketSnapshot {
  symbol: string;
  name: string;
  market: 'HK' | 'US' | 'CN' | 'CRYPTO' | 'FOREX';
  sector?: string;         // 行业/板块
  price: number;
  change: number;          // 涨跌额
  changePct: number;       // 涨跌幅
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  turnover: number;        // 成交额
  turnoverRate?: number;   // 换手率
  marketCap?: number;      // 总市值
  pe?: number;             // PE (TTM)
  pb?: number;             // PB
  eps?: number;            // 每股收益
  dividendYield?: number;  // 股息率
  amplitude?: number;      // 振幅
  volumeRatio?: number;    // 量比 (今量/5日均量)
  updateTime: number;      // Unix ms
}

/** 热力图数据 */
export interface HeatmapData {
  /** 板块/行业分组 */
  groups: HeatmapGroup[];
  /** 更新时间 */
  updateTime: number;
}

/** 热力图分组 */
export interface HeatmapGroup {
  /** 板块名称 */
  name: string;
  /** 板块涨跌幅 */
  changePct: number;
  /** 板块总市值 */
  totalMarketCap: number;
  /** 板块内个股 */
  stocks: MarketSnapshot[];
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 12: 筛选器/扫描器类型 (模块8)
// ═══════════════════════════════════════════════════════════════════════

/** 筛选条件 */
export interface ScanCondition {
  field: string;           // 'price' | 'changePct' | 'volume' | 'pe' | 'rsi' etc.
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between' | 'cross_above' | 'cross_below';
  value: number;
  value2?: number;         // between用
}

/** 预设扫描ID */
export type PresetScanId =
  | 'top_gainers'      // 涨幅榜
  | 'top_losers'       // 跌幅榜
  | 'top_volume'       // 成交额榜
  | 'top_turnover'     // 换手率榜
  | 'volume_breakout'  // 放量突破
  | 'oversold_bounce'  // 超跌反弹
  | 'new_high'         // 创52周新高
  | 'golden_cross';    // MA金叉

/** 预设扫描定义 */
export interface PresetScan {
  id: PresetScanId;
  label: string;
  description: string;
  conditions: ScanCondition[];
  sortField: string;
  sortDir: 'asc' | 'desc';
  limit: number;
}

/** 异动提醒规则 */
export interface AlertRule {
  id: string;
  symbol: string;
  name: string;
  enabled: boolean;
  type: 'price' | 'volume' | 'pattern' | 'indicator' | 'spread';
  condition: ScanCondition;
  /** 推送渠道 */
  channels: AlertChannel[];
  /** 冷却时间 (ms, 避免重复推送) */
  cooldownMs: number;
  lastTriggered?: number;
}

/** 推送渠道 */
export type AlertChannel = 'system' | 'telegram' | 'feishu' | 'email';

/** 异动事件 */
export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  symbol: string;
  type: AlertRule['type'];
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT AGGREGATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * 全部类型导出 (import from '@src/lib/chart/types')
 *
 * K线核心: KlineBar, Timeframe, AdjustType, CandleType, KlineRequest, KlineResponse
 * 图表: ChartTheme, ChartLayout, CrosshairInfo, MultiChartLayout, PaneConfig, TimeSync
 * 指标定义: IndicatorDef, IndicatorParam, IndicatorCategory, INDICATOR_DEFS, EXTENDED_INDICATOR_REFS
 * 指标计算: IndicatorResult, SingleLineResult, MultiLineResult, FullIndicatorSuite
 * 指标输出: MACDOutput, BOLLOutput, KDJOutput, IchimokuOutput, PivotOutput
 * Engine: IIndicatorEngine, IndicatorEngineOptions
 * IPC: IpcKlineRequest, IpcKlineResponse, IpcIndicatorRequest, IpcIndicatorResponse
 * Worker: WorkerMessage, WorkerComputeMessage, WorkerResultMessage, WorkerReadyMessage
 * 市场数据: MarketSnapshot, HeatmapData, HeatmapGroup
 * 筛选器: ScanCondition, PresetScan, PresetScanId, AlertRule, AlertEvent, AlertChannel
 */