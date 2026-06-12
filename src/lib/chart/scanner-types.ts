// ── R115 QTE-37 QClaw: Scanner/FundFlow/Alert类型定义 ────────────────
// PM: 行情升级v2.0 模块8-9 — 筛选器/资金流向/异动提醒 类型基础
// 单点真实源: 所有scanner/fundflow/alert相关代码引用此文件
//
// @author QClaw (document-shrimp)
// @round R115 QTE-37
// @since 2026-06-12
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: MarketScanner — 市场筛选器
// ═══════════════════════════════════════════════════════════════════════

/** 筛选条件字段 */
export type ScanField =
  | 'price'          // 价格
  | 'changePct'      // 涨跌幅
  | 'change'         // 涨跌额
  | 'volume'         // 成交量
  | 'turnover'       // 成交额
  | 'turnoverRate'   // 换手率
  | 'marketCap'      // 总市值
  | 'pe'             // PE (TTM)
  | 'pb'             // PB
  | 'eps'            // 每股收益
  | 'dividendYield'  // 股息率
  | 'amplitude'      // 振幅
  | 'volumeRatio'    // 量比 (今量/5日均量)
  | 'beta'           // Beta系数
  | 'roe'            // ROE
  | 'peg'            // PEG
  | 'ma5' | 'ma10' | 'ma20' | 'ma60'     // 均线价格
  | 'rsi' | 'macd' | 'kdjK' | 'kdjD'     // 技术指标
  | 'atr' | 'bollUpper' | 'bollLower'    // 波动指标
  | 'obv' | 'mfi'                         // 量价指标
  | 'pattern';       // K线形态 (多选)

/** 条件运算符 */
export type ScanOperator =
  | 'gt'             // >
  | 'gte'            // >=
  | 'lt'             // <
  | 'lte'            // <=
  | 'eq'             // ==
  | 'between'        // a <= x <= b
  | 'cross_above'    // 上穿 (指标金叉)
  | 'cross_below'    // 下穿 (指标死叉)
  | 'in_list'        // 属于列表
  | 'not_in_list';   // 不属于列表

/** 单条筛选条件 */
export interface ScanCondition {
  /** 字段 */
  field: ScanField;
  /** 运算符 */
  operator: ScanOperator;
  /** 值1 */
  value: number;
  /** 值2 (between/in_list用) */
  value2?: number;
  /** 字符串列表 (in_list/not_in_list用) */
  stringValues?: string[];
  /** 标签 */
  label?: string;
}

/** 条件分组逻辑 */
export type ScanLogic = 'AND' | 'OR';

/** 条件分组 (树形结构) */
export interface ScanGroup {
  logic: ScanLogic;
  conditions: (ScanCondition | ScanGroup)[];
}

/** 排序配置 */
export interface ScanSort {
  field: ScanField;
  direction: 'asc' | 'desc';
}

/** 预设扫描ID */
export type PresetScanId =
  | 'top_gainers'       // 涨幅榜
  | 'top_losers'        // 跌幅榜
  | 'top_volume'        // 成交额榜
  | 'top_turnover'      // 换手率榜
  | 'volume_breakout'   // 放量突破 (今量>5日2x+涨>0)
  | 'oversold_bounce'   // 超跌反弹 (RSI<30+连续下跌)
  | 'new_high'          // 创52周新高
  | 'golden_cross'      // MA金叉 (MA5上穿MA20)
  | 'death_cross'       // MA死叉 (MA5下穿MA20)
  | 'strong_trend'      // 强势股 (MA5>MA20>MA60+量比>1.5)
  | 'low_pe_growth';    // 低估值成长 (PE<20+PEG<1+ROE>15%)

/** 预设扫描定义 */
export interface PresetScan {
  id: PresetScanId;
  label: string;
  description: string;
  /** 条件组 (根节点) */
  conditions: ScanGroup;
  /** 排序 */
  sort: ScanSort;
  /** 结果上限 (0=不限) */
  limit: number;
  /** 所属市场 (空=全部) */
  markets?: string[];
  /** 图标emoji */
  icon?: string;
}

/** 市场扫描请求 */
export interface MarketScannerQuery {
  /** 条件组 (null=使用预设) */
  conditions?: ScanGroup;
  /** 预设ID (当conditions为null时使用) */
  presetId?: PresetScanId;
  /** 市场过滤 */
  markets?: string[];
  /** 板块过滤 */
  sectors?: string[];
  /** 排序 */
  sort?: ScanSort;
  /** 结果上限 */
  limit: number;
  /** 缓存key (相同key命中缓存) */
  cacheKey?: string;
  /** 缓存TTL (ms, 默认30s) */
  cacheTtl?: number;
}

/** 筛选过滤器 (UI表单模型) */
export interface ScanFilter {
  price: { min?: number; max?: number };
  changePct: { min?: number; max?: number };
  volume: { min?: number };
  turnover: { min?: number };
  turnoverRate: { min?: number; max?: number };
  marketCap: { min?: number; max?: number };
  pe: { min?: number; max?: number };
  pb: { min?: number; max?: number };
  volumeRatio: { min?: number };
  amplitude: { min?: number; max?: number };
  maCross: { fastPeriod: number; slowPeriod: number; direction: 'golden' | 'death' };
  rsi: { min?: number; max?: number };
  pattern: string[];
}

/** 扫描结果(单条) */
export interface ScanResult {
  symbol: string;
  name: string;
  market: string;
  sector?: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  turnoverRate?: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  volumeRatio?: number;
  amplitude?: number;
  /** 符合条件的tag (如 "RSI<30", "量比>2")  */
  matchTags: string[];
  /** 排序分数 */
  sortScore: number;
}

/** 扫描完整结果 */
export interface ScanResultSet {
  /** 总数 */
  total: number;
  /** 本页结果 */
  results: ScanResult[];
  /** 是否有下一页 */
  hasMore: boolean;
  /** 游标 (分页) */
  cursor?: number;
  /** 扫描耗时 (ms) */
  elapsedMs: number;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 生成时间 */
  timestamp: number;
}

/** 预设扫描列表 */
export const PRESET_SCANS: PresetScan[] = [
  {
    id: 'top_gainers', label: '📈 涨幅榜', description: '当日涨幅前50',
    conditions: { logic: 'AND', conditions: [] },
    sort: { field: 'changePct', direction: 'desc' }, limit: 50,
    icon: '📈',
  },
  {
    id: 'top_losers', label: '📉 跌幅榜', description: '当日跌幅前50',
    conditions: { logic: 'AND', conditions: [] },
    sort: { field: 'changePct', direction: 'asc' }, limit: 50,
    icon: '📉',
  },
  {
    id: 'top_volume', label: '🔥 爆量榜', description: '成交额最大前50',
    conditions: { logic: 'AND', conditions: [] },
    sort: { field: 'turnover', direction: 'desc' }, limit: 50,
    icon: '🔥',
  },
  {
    id: 'top_turnover', label: '🔄 换手榜', description: '换手率最高前50',
    conditions: { logic: 'AND', conditions: [] },
    sort: { field: 'turnoverRate', direction: 'desc' }, limit: 50,
    icon: '🔄',
  },
  {
    id: 'volume_breakout', label: '📊 放量突破', description: '成交量>5日均量2倍且涨幅>0',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'volumeRatio', operator: 'gt', value: 2, label: '量比>2' },
        { field: 'changePct', operator: 'gt', value: 0, label: '上涨' },
      ],
    },
    sort: { field: 'volumeRatio', direction: 'desc' }, limit: 30,
    icon: '📊',
  },
  {
    id: 'oversold_bounce', label: '🩹 超跌反弹', description: 'RSI<30, 关注反弹机会',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'rsi', operator: 'lt', value: 30, label: 'RSI<30' },
      ],
    },
    sort: { field: 'rsi', direction: 'asc' }, limit: 30,
    icon: '🩹',
  },
  {
    id: 'new_high', label: '🏔️ 创52周新高', description: '价格>52周最高价95%',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'price', operator: 'gt', value: 0, label: '筛选52周新高' },
      ],
    },
    sort: { field: 'changePct', direction: 'desc' }, limit: 30,
    icon: '🏔️',
  },
  {
    id: 'golden_cross', label: '✨ MA金叉', description: 'MA5上穿MA20',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'ma5', operator: 'cross_above', value: 0, label: 'MA5>MA20' },
      ],
    },
    sort: { field: 'changePct', direction: 'desc' }, limit: 30,
    icon: '✨',
  },
  {
    id: 'death_cross', label: '⚠️ MA死叉', description: 'MA5下穿MA20',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'ma5', operator: 'cross_below', value: 0, label: 'MA5<MA20' },
      ],
    },
    sort: { field: 'changePct', direction: 'asc' }, limit: 30,
    icon: '⚠️',
  },
  {
    id: 'strong_trend', label: '💪 强势股', description: '多头排列+量比>1.5',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'ma5', operator: 'gt', value: 0, label: 'MA5>MA10>MA20>MA60' },
        { field: 'volumeRatio', operator: 'gt', value: 1.5, label: '量比>1.5' },
      ],
    },
    sort: { field: 'changePct', direction: 'desc' }, limit: 30,
    icon: '💪',
  },
  {
    id: 'low_pe_growth', label: '💎 低估值成长', description: 'PE<20+PEG<1+ROE>15%',
    conditions: {
      logic: 'AND', conditions: [
        { field: 'pe', operator: 'between', value: 0, value2: 20, label: '0<PE<20' },
      ],
    },
    sort: { field: 'roe', direction: 'desc' }, limit: 30,
    icon: '💎',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: FundFlow — 资金流向
// ═══════════════════════════════════════════════════════════════════════

/** 资金分类 (按单笔金额) */
export type FundCategory =
  | 'super_large'  // 超大单: ≥100万(股票) / ≥50 BTC(加密)
  | 'large'        // 大单: 20万-100万
  | 'medium'       // 中单: 4万-20万
  | 'small';       // 小单: <4万

/** 资金分类阈值 */
export const FUND_CATEGORY_THRESHOLDS = {
  stocks: { superLarge: 1_000_000, large: 200_000, medium: 40_000 },
  crypto: { superLarge: 50, large: 10, medium: 2 },  // BTC单位
} as const;

/** 单只股票资金流快照 */
export interface FundFlowSnapshot {
  symbol: string;
  name: string;
  market: string;
  /** 超大单净流入 */
  superLargeNet: number;
  /** 大单净流入 */
  largeNet: number;
  /** 中单净流入 */
  mediumNet: number;
  /** 小单净流入 */
  smallNet: number;
  /** 主力净流入 (超大单+大单) */
  mainForceNet: number;
  /** 总净流入 */
  totalNet: number;
  /** 超大单流入 */
  superLargeInflow: number;
  /** 超大单流出 */
  superLargeOutflow: number;
  /** 大单流入 */
  largeInflow: number;
  /** 大单流出 */
  largeOutflow: number;
  /** 中单流入 */
  mediumInflow: number;
  /** 中单流出 */
  mediumOutflow: number;
  /** 小单流入 */
  smallInflow: number;
  /** 小单流出 */
  smallOutflow: number;
  /** 主力占比 (主力净流入/总成交额) */
  mainForceRatio: number;
  /** 数据时间 */
  timestamp: number;
}

/** 主力追踪 (N日累计) */
export interface MainForceTracking {
  symbol: string;
  /** 主力1日净流入 */
  day1: number;
  /** 主力3日净流入 */
  day3: number;
  /** 主力5日净流入 */
  day5: number;
  /** 主力10日净流入 */
  day10: number;
  /** 20日净流入 */
  day20: number;
  /** 趋势方向 (看主力是否持续流入) */
  trend: 'accumulating' | 'distributing' | 'neutral';
  /** 趋势强度 0-1 */
  trendStrength: number;
}

/** 板块资金流 */
export interface SectorFundFlow {
  sector: string;
  /** 板块内成分数 */
  stockCount: number;
  /** 主力净流入汇总 */
  mainForceNet: number;
  /** 主力净流入占板块总市值比 */
  mainForceRatio: number;
  /** 净流入个股数 */
  inflowCount: number;
  /** 净流出个股数 */
  outflowCount: number;
  /** 板块涨跌幅 */
  changePct: number;
}

/** 主力净流入排行榜条目 */
export interface FlowRankEntry {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  mainForceNet: number;
  mainForceRatio: number;
  /** 趋势箭头 (up/down/flat) */
  trend: 'up' | 'down' | 'flat';
}

/** 资金流请求 (IPC) */
export interface FundFlowRequest {
  /** 个股symbol (与sector互斥) */
  symbol?: string;
  /** 板块 (与symbol互斥) */
  sector?: string;
  /** 排名模式 (top_main_force=主力净流入, top_main_ratio=主力占比) */
  rankBy?: 'top_main_force' | 'top_main_ratio' | 'top_inflow' | 'top_outflow';
  /** 结果上限 */
  limit?: number;
}

/** 资金流响应 */
export interface FundFlowResponse {
  success: boolean;
  /** 个股资金流 */
  snapshot?: FundFlowSnapshot;
  /** 主力追踪 */
  tracking?: MainForceTracking;
  /** 板块资金流 */
  sectorFlows?: SectorFundFlow[];
  /** 排行榜 */
  rankEntries?: FlowRankEntry[];
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: Alert — 异动提醒
// ═══════════════════════════════════════════════════════════════════════

/** 提醒类型 */
export type AlertType =
  | 'price_break'       // 价格突破 (上破/下破)
  | 'volume_spike'      // 放量异动 (量比>N)
  | 'pattern_trigger'   // 形态触发 (K线形态/图表形态)
  | 'indicator_signal'  // 指标信号 (RSI超买超卖/MACD金叉死叉)
  | 'spread_arbitrage'  // 跨所价差 (价差>N bps)
  | 'volatility_alert'  // 波动率突增
  | 'fund_flow_alert'   // 主力异动 (单笔大单>N)
  | 'custom';           // 自定义

/** 提醒触发条件 */
export interface AlertCondition {
  field: string;
  operator: ScanOperator;
  value: number;
  value2?: number;
  /** 持续满足条件的最小时间 (ms, 0=瞬时) */
  duration?: number;
}

/** 推送渠道 */
export type AlertChannel = 'system' | 'telegram' | 'feishu' | 'email' | 'sound';

/** 提醒规则 */
export interface AlertRule {
  /** 唯一ID */
  id: string;
  /** 名称 */
  name: string;
  /** 类型 */
  type: AlertType;
  /** 标的代码 */
  symbol: string;
  /** 是否启用 */
  enabled: boolean;
  /** 触发条件 */
  condition: AlertCondition;
  /** 推送渠道列表 */
  channels: AlertChannel[];
  /** 冷却时间 (ms, 避免重复推送) */
  cooldownMs: number;
  /** 每日最大推送次数 (0=不限) */
  maxDaily?: number;
  /** 仅交易时段 (true=仅9:30-16:00) */
  tradingHoursOnly?: boolean;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** 备注 */
  note?: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后触发时间 */
  lastTriggered?: number;
  /** 今日已触发次数 */
  todayCount?: number;
}

/** 异动事件 (已触发) */
export interface AlertEvent {
  /** 规则ID */
  ruleId: string;
  /** 规则名称 */
  ruleName: string;
  /** 类型 */
  type: AlertType;
  /** 标的 */
  symbol: string;
  /** 标的名称 */
  symbolName?: string;
  /** 消息 */
  message: string;
  /** 触发值 */
  value: number;
  /** 阈值 */
  threshold: number;
  /** 优先级 */
  priority: AlertRule['priority'];
  /** 时间戳 */
  timestamp: number;
  /** 是否已读 */
  read: boolean;
  /** 是否已推送 */
  delivered: boolean;
}

/** 提醒评估结果 (Alert引擎输出) */
export interface AlertEvaluateResult {
  /** 当前活跃规则数 */
  activeRules: number;
  /** 本轮评估触发的提醒 */
  triggered: AlertEvent[];
  /** 因冷却被抑制的提醒 */
  suppressed: AlertEvent[];
  /** 评估耗时 (ms) */
  elapsedMs: number;
}

/** 提醒历史查询 */
export interface AlertHistoryQuery {
  symbol?: string;
  type?: AlertType;
  from?: number;
  to?: number;
  limit?: number;
  unreadOnly?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: IPC Contracts
// ═══════════════════════════════════════════════════════════════════════

/** IPC: scanner:search */
export interface IpcScannerRequest {
  query: MarketScannerQuery;
}

export interface IpcScannerResponse {
  success: boolean;
  data: ScanResultSet;
  error?: string;
}

/** IPC: fundflow:get */
export interface IpcFundFlowRequest {
  symbol?: string;
  sector?: string;
  rankBy?: FundFlowRequest['rankBy'];
  limit?: number;
}

export interface IpcFundFlowResponse {
  success: boolean;
  data: FundFlowResponse;
  error?: string;
}

/** IPC: alert:create / alert:update / alert:delete */
export interface IpcAlertCreateRequest {
  rule: Omit<AlertRule, 'id' | 'createdAt' | 'lastTriggered' | 'todayCount'>;
}

export interface IpcAlertUpdateRequest {
  ruleId: string;
  patch: Partial<Omit<AlertRule, 'id' | 'createdAt'>>;
}

/** IPC: alert:history */
export interface IpcAlertHistoryRequest {
  query: AlertHistoryQuery;
}

export interface IpcAlertHistoryResponse {
  success: boolean;
  data: AlertEvent[];
  total: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT AGGREGATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * 全部Scanner/FundFlow/Alert类型
 *
 * Scanner (筛选器):
 *   ScanField, ScanOperator, ScanCondition, ScanGroup, ScanLogic,
 *   ScanSort, PresetScanId, PresetScan, PRESET_SCANS,
 *   MarketScannerQuery, ScanFilter, ScanResult, ScanResultSet
 *
 * FundFlow (资金流向):
 *   FundCategory, FUND_CATEGORY_THRESHOLDS,
 *   FundFlowSnapshot, MainForceTracking, SectorFundFlow,
 *   FlowRankEntry, FundFlowRequest, FundFlowResponse
 *
 * Alert (异动提醒):
 *   AlertType, AlertChannel, AlertCondition, AlertRule,
 *   AlertEvent, AlertEvaluateResult, AlertHistoryQuery
 *
 * IPC:
 *   IpcScannerRequest/Response, IpcFundFlowRequest/Response,
 *   IpcAlertCreateRequest, IpcAlertUpdateRequest,
 *   IpcAlertHistoryRequest/Response
 */
