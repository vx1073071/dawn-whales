// ── R113 QTE-04 QClaw: K线/指标TypeScript类型定义+接口文档 ───────────
// PM: 行情升级v2.0 模块1-2 类型基础, 单点真实源(所有引擎+UI引用此文件)
// 覆盖: 多周期K线/复权/K线类型/80+指标/十字光标/多图布局/MarketSnapshot
//
// @author QClaw (document-shrimp)
// @round R113a QTE-04
// @since 2026-06-12
//
// ═══════════════════════════════════════════════════════════════════════
// USAGE GUIDE
// ═══════════════════════════════════════════════════════════════════════
//
// Engine (electron/engine/analysis):
//   import type { KlineBar, Timeframe, IndicatorResult, FullIndicatorSuite } from '@src/lib/chart/types';
//
// UI (src/components/chart/):
//   import { KlineBar, ALL_TIMEFRAMES, INDICATOR_DEFS, ... } from '../../lib/chart/types';
//
// IPC:
//   ipcMain.handle('chart:getKlines', (_, req: KlineRequest): Promise<KlineBar[]> => {...});
//   ipcMain.handle('indicator:compute', (_, req: IndicatorRequest): Promise<IndicatorResult> => {...});
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: K线核心类型
// ═══════════════════════════════════════════════════════════════════════

/** K线周期 — 对齐富途/moomoo/IBKR通用周期体系 */
export type Timeframe =
  | '1s'   // 1秒 (加密专用)
  | '1m'   // 1分
  | '5m'   // 5分
  | '15m'  // 15分
  | '30m'  // 30分
  | '1h'   // 1小时
  | '4h'   // 4小时
  | 'D'    // 日K
  | 'W'    // 周K
  | 'M'    // 月K
  | 'Q'    // 季K
  | 'Y';   // 年K

/** 完整周期列表 (UI切换用) */
export const ALL_TIMEFRAMES: Timeframe[] = [
  '1s', '1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W', 'M', 'Q', 'Y',
];

/** 周期中文标签 */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1s': '1秒', '1m': '1分', '5m': '5分', '15m': '15分',
  '30m': '30分', '1h': '1时', '4h': '4时',
  'D': '日', 'W': '周', 'M': '月', 'Q': '季', 'Y': '年',
};

/** 周期→毫秒转换 */
export const TIMEFRAME_MS: Partial<Record<Timeframe, number>> = {
  '1s': 1_000, '1m': 60_000, '5m': 300_000, '15m': 900_000,
  '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000,
  'D': 86_400_000, 'W': 604_800_000, 'M': 2_592_000_000,
};

/** 复权类型 */
export type AdjustType = 'none' | 'pre' | 'post';

/** 复权类型中文标签 */
export const ADJUST_LABELS: Record<AdjustType, string> = {
  none: '不复权', pre: '前复权', post: '后复权',
};

/** K线类型 */
export type CandleType = 'candle' | 'hollow' | 'heikin-ashi' | 'line' | 'area' | 'renko' | 'kagi';

/** K线类型中文标签 */
export const CANDLE_LABELS: Record<CandleType, string> = {
  candle: '标准K线', hollow: '空心K线', 'heikin-ashi': 'Heikin Ashi',
  line: '折线', area: '面积', renko: '砖形图', kagi: '卡吉图',
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: K线数据 Bar
// ═══════════════════════════════════════════════════════════════════════

/** 单根K线 (OHLCV) — 所有行情引擎的统一数据单元 */
export interface KlineBar {
  /** Unix毫秒时间戳 (UTC) */
  time: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 (基础份额) */
  volume: number;
  /** 成交额 (可选) */
  turnover?: number;
  /** 换手率 (可选, 0-1) */
  turnoverRate?: number;
}

/** K线请求参数 — IPC interface */
export interface KlineRequest {
  /** 标的代码 (标准化格式如 00700.HK / AAPL.US / BTC-USD.CRYPTO) */
  symbol: string;
  /** 券商ID (可选, 不传=自动选) */
  brokerId?: string;
  /** K线周期 */
  timeframe: Timeframe;
  /** 复权类型 (默认none) */
  adjust?: AdjustType;
  /** 起始时间 (Unix ms, 默认=最新往前count根) */
  startTime?: number;
  /** 结束时间 (Unix ms, 默认=now) */
  endTime?: number;
  /** 请求数量 (默认200) */
  count?: number;
  /** K线类型 (默认candle) */
  candleType?: CandleType;
}

/** K线响应 */
export interface KlineResponse {
  success: boolean;
  symbol: string;
  timeframe: Timeframe;
  adjust: AdjustType;
  bars: KlineBar[];
  /** 复权因子 (前复权/后复权时使用) */
  adjustFactor?: number[];
  /** 数据源券商 */
  brokerId?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: 图表主题与布局
// ═══════════════════════════════════════════════════════════════════════

/** 图表主题色 */
export interface ChartTheme {
  bg: string;
  grid: string;
  gridMajor: string;
  text: string;
  textMuted: string;
  crosshair: string;
  up: string;
  down: string;
  upBg: string;
  downBg: string;
  volUp: string;
  volDown: string;
  border: string;
  selection: string;
  tooltip: string;
}

/** 暗色主题 (默认) */
export const CHART_THEME_DARK: ChartTheme = {
  bg: '#0d1117',
  grid: '#1c2333',
  gridMajor: '#222c3a',
  text: '#8b949e',
  textMuted: '#484f58',
  crosshair: '#c9a96e',
  up: '#22c55e',
  down: '#ef4444',
  upBg: 'rgba(34,197,94,0.12)',
  downBg: 'rgba(239,68,68,0.12)',
  volUp: 'rgba(34,197,94,0.3)',
  volDown: 'rgba(239,68,68,0.3)',
  border: '#30363d',
  selection: 'rgba(99,102,241,0.15)',
  tooltip: '#1c2333',
};

/** 明色主题 */
export const CHART_THEME_LIGHT: ChartTheme = {
  bg: '#ffffff',
  grid: '#e2e8f0',
  gridMajor: '#cbd5e1',
  text: '#475569',
  textMuted: '#94a3b8',
  crosshair: '#b45309',
  up: '#16a34a',
  down: '#dc2626',
  upBg: 'rgba(22,163,74,0.08)',
  downBg: 'rgba(220,38,38,0.08)',
  volUp: 'rgba(22,163,74,0.2)',
  volDown: 'rgba(220,38,38,0.2)',
  border: '#e2e8f0',
  selection: 'rgba(99,102,241,0.1)',
  tooltip: '#f8fafc',
};

/** 图表布局配置 */
export interface ChartLayout {
  /** K线区域占比 (0-1) */
  mainRatio: number;
  /** 副图指标区域占比 */
  indicatorRatio: number;
  /** 成交量区域占比 */
  volumeRatio: number;
}

export const DEFAULT_LAYOUT: ChartLayout = {
  mainRatio: 0.55,
  indicatorRatio: 0.25,
  volumeRatio: 0.20,
};

/** 十字光标信息 */
export interface CrosshairInfo {
  time: number;       // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;     // 涨跌额
  changePct: number;  // 涨跌幅
  turnover?: number;
  turnoverRate?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: 技术指标 — 参数定义 (80+指标)
// ═══════════════════════════════════════════════════════════════════════

/** 指标类别 */
export type IndicatorCategory =
  | 'trend'       // 趋势类 (MA/EMA/MACD/DMI...)
  | 'momentum'    // 动量类 (RSI/KDJ/CCI/WR/ROC...)
  | 'volatility'  // 波动类 (BOLL/ATR/Keltner/Donchian...)
  | 'volume'      // 量价类 (OBV/VWAP/MFI/CMF...)
  | 'overlay'     // 主图叠加 (SAR/Ichimoku/VWAP/Pivot...)
  | 'custom';     // 自定义/高级

/** 指标类别中文标签 */
export const INDICATOR_CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: '趋势',
  momentum: '动量',
  volatility: '波动',
  volume: '量价',
  overlay: '主图叠加',
  custom: '高级',
};

/** 单个指标参数定义 */
export interface IndicatorParam {
  /** 显示名称 (如 "周期") */
  name: string;
  /** 参数key (如 "period") */
  key: string;
  /** 默认值 */
  default: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 步长 */
  step: number;
}

/** 指标定义 (完整元数据) */
export interface IndicatorDef {
  /** 唯一ID */
  id: string;
  /** 中文名称 */
  label: string;
  /** 英文缩写 */
  shortLabel: string;
  /** 分类 */
  category: IndicatorCategory;
  /** 用途说明 */
  description: string;
  /** 可调参数 */
  params: IndicatorParam[];
  /** 是否多线 (MACD需DIF/DEA/柱, BOLL需上中下轨, KDJ需K/D/J) */
  multiLine?: boolean;
  /** 是否副图指标 (false=主图叠加) */
  isStudy?: boolean;
  /** 指标线名称 (多线指标的每条线标签) */
  lineNames?: string[];
  /** 默认颜色 */
  defaultColor?: string;
  /** 参考区间 (如RSI [0,100], CCI [-200,200]) */
  range?: [number, number];
  /** 参考线值 (如RSI的水平70/30线) */
  referenceLines?: number[];
}

// ═══════ 20核心指标定义 (P0) ═══════

/** 全部P0指标定义 — 用于IndicatorPanel渲染 */
export const INDICATOR_DEFS: IndicatorDef[] = [
  // ── 趋势 (5) ──
  {
    id: 'ma', label: '移动平均线', shortLabel: 'MA', category: 'trend',
    description: 'Simple Moving Average — N日收盘价算术平均',
    params: [{ name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 }],
    defaultColor: '#f59e0b',
  },
  {
    id: 'ema', label: '指数移动平均', shortLabel: 'EMA', category: 'trend',
    description: 'Exponential Moving Average — 近期权重更高',
    params: [{ name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 }],
    defaultColor: '#3b82f6',
  },
  {
    id: 'wma', label: '加权移动平均', shortLabel: 'WMA', category: 'trend',
    description: 'Weighted Moving Average — 线性加权',
    params: [{ name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 }],
    defaultColor: '#6366f1',
  },
  {
    id: 'boll', label: '布林带', shortLabel: 'BOLL', category: 'volatility',
    description: 'Bollinger Bands — 中轨±N倍标准差',
    params: [
      { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
      { name: '倍数', key: 'multiplier', default: 2, min: 1, max: 5, step: 0.5 },
    ],
    multiLine: true, lineNames: ['中轨', '上轨', '下轨'],
    defaultColor: '#a78bfa',
  },
  {
    id: 'ichimoku', label: '一目均衡', shortLabel: 'ICHIMOKU', category: 'overlay',
    description: 'Ichimoku Cloud — 五线趋势系统 (转换线/基准线/先行A/先行B/迟行线)',
    params: [
      { name: '转换线', key: 'tenkan', default: 9, min: 2, max: 200, step: 1 },
      { name: '基准线', key: 'kijun', default: 26, min: 2, max: 200, step: 1 },
      { name: '先行B', key: 'senkouB', default: 52, min: 2, max: 500, step: 1 },
    ],
    multiLine: true, lineNames: ['转换线', '基准线', '先行A', '先行B', '迟行线'],
    defaultColor: '#06b6d4',
  },

  // ── 动量 (6) ──
  {
    id: 'macd', label: 'MACD', shortLabel: 'MACD', category: 'momentum',
    description: '异同移动平均线 — 快慢EMA差值+信号线+柱',
    params: [
      { name: '快线', key: 'fast', default: 12, min: 2, max: 200, step: 1 },
      { name: '慢线', key: 'slow', default: 26, min: 2, max: 200, step: 1 },
      { name: '信号', key: 'signal', default: 9, min: 2, max: 100, step: 1 },
    ],
    multiLine: true, lineNames: ['DIF', 'DEA', 'MACD柱'],
    isStudy: true, defaultColor: '#ef4444',
    referenceLines: [0],
  },
  {
    id: 'rsi', label: '相对强弱', shortLabel: 'RSI', category: 'momentum',
    description: 'Relative Strength Index — 0-100, >70超买 <30超卖',
    params: [{ name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 }],
    isStudy: true, defaultColor: '#8b5cf6',
    range: [0, 100], referenceLines: [30, 70],
  },
  {
    id: 'kdj', label: 'KDJ随机', shortLabel: 'KDJ', category: 'momentum',
    description: '随机指标 — K线+D线+J线',
    params: [
      { name: 'N', key: 'n', default: 9, min: 2, max: 200, step: 1 },
      { name: 'M1', key: 'm1', default: 3, min: 1, max: 200, step: 1 },
      { name: 'M2', key: 'm2', default: 3, min: 1, max: 200, step: 1 },
    ],
    multiLine: true, lineNames: ['K', 'D', 'J'],
    isStudy: true, defaultColor: '#f59e0b',
    range: [0, 100], referenceLines: [20, 80],
  },
  {
    id: 'wr', label: '威廉指标', shortLabel: 'W%R', category: 'momentum',
    description: 'Williams %R — -100到0, >-20超买 <-80超卖',
    params: [{ name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 }],
    isStudy: true, defaultColor: '#ec4899',
    range: [-100, 0], referenceLines: [-20, -80],
  },
  {
    id: 'cci', label: '商品通道', shortLabel: 'CCI', category: 'momentum',
    description: 'Commodity Channel Index — ±100超买超卖',
    params: [{ name: '周期', key: 'period', default: 20, min: 2, max: 200, step: 1 }],
    isStudy: true, defaultColor: '#f97316',
    range: [-300, 300], referenceLines: [-100, 100],
  },
  {
    id: 'roc', label: '变动速率', shortLabel: 'ROC', category: 'momentum',
    description: 'Rate of Change — (今收-N前收)/N前收×100',
    params: [{ name: '周期', key: 'period', default: 12, min: 1, max: 200, step: 1 }],
    isStudy: true, defaultColor: '#22c55e',
    referenceLines: [0],
  },

  // ── 波动 (2) ──
  {
    id: 'atr', label: '平均真实波幅', shortLabel: 'ATR', category: 'volatility',
    description: 'Average True Range — N日波动幅度',
    params: [{ name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 }],
    isStudy: true, defaultColor: '#eab308',
  },
  {
    id: 'stddev', label: '标准差', shortLabel: 'STDDEV', category: 'volatility',
    description: 'Standard Deviation — N日收盘价波动标准差',
    params: [{ name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 }],
    isStudy: true, defaultColor: '#94a3b8',
  },

  // ── 量价 (3) ──
  {
    id: 'obv', label: '能量潮', shortLabel: 'OBV', category: 'volume',
    description: 'On-Balance Volume — 价涨+量, 价跌-量',
    params: [],
    isStudy: true, defaultColor: '#06b6d4',
  },
  {
    id: 'vwap', label: '成交量加权均价', shortLabel: 'VWAP', category: 'overlay',
    description: 'Volume Weighted Average Price — 日内加权均价',
    params: [],
    defaultColor: '#fb923c',
  },
  {
    id: 'mfi', label: '资金流量', shortLabel: 'MFI', category: 'volume',
    description: 'Money Flow Index — 量价RSI, 0-100',
    params: [{ name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 }],
    isStudy: true, defaultColor: '#84cc16',
    range: [0, 100], referenceLines: [20, 80],
  },

  // ── 主图叠加 (4) ──
  {
    id: 'sar', label: '抛物线SAR', shortLabel: 'SAR', category: 'overlay',
    description: 'Parabolic SAR — 止损反转点 (价格上方=看跌, 下方=看涨)',
    params: [
      { name: '加速因子', key: 'af', default: 0.02, min: 0.01, max: 0.1, step: 0.01 },
      { name: '最大加速', key: 'maxAf', default: 0.2, min: 0.05, max: 0.5, step: 0.05 },
    ],
    defaultColor: '#22d3ee',
  },
  {
    id: 'pivot', label: '枢轴点', shortLabel: 'PIVOT', category: 'overlay',
    description: 'Pivot Points — R3/R2/R1/PP/S1/S2/S3七线',
    params: [],
    multiLine: true, lineNames: ['R3', 'R2', 'R1', 'PP', 'S1', 'S2', 'S3'],
    defaultColor: '#c9a96e',
  },
  {
    id: 'ma-envelope', label: '均线包络', shortLabel: 'ENV', category: 'overlay',
    description: 'Moving Average Envelope — MA±N%',
    params: [
      { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
      { name: '偏离%', key: 'pct', default: 5, min: 0.5, max: 50, step: 0.5 },
    ],
    multiLine: true, lineNames: ['上轨', '下轨'],
    defaultColor: '#a78bfa',
  },
  {
    id: 'ema-cross', label: 'EMA交叉', shortLabel: 'X', category: 'overlay',
    description: 'EMA金叉死叉 — 快慢两条EMA交叉点标记',
    params: [
      { name: '快线周期', key: 'fast', default: 12, min: 2, max: 200, step: 1 },
      { name: '慢线周期', key: 'slow', default: 26, min: 2, max: 500, step: 1 },
    ],
    multiLine: true, lineNames: ['快线', '慢线'],
    defaultColor: '#fbbf24',
  },
];

// ═══════ 扩展指标 (P1 — 未来R117补齐) ═══════

/** P1 扩展指标定义参考 — 对齐富途80+指标体系 */
export const EXTENDED_INDICATOR_REFS: Omit<IndicatorDef, 'params'>[] = [
  // 趋势扩展
  { id: 'dema', label: '双指数移动平均', shortLabel: 'DEMA', category: 'trend', description: 'Double EMA' },
  { id: 'tema', label: '三指数移动平均', shortLabel: 'TEMA', category: 'trend', description: 'Triple EMA' },
  { id: 'hma', label: 'Hull移动平均', shortLabel: 'HMA', category: 'trend', description: 'Hull MA — 低延迟' },
  { id: 'lsma', label: '最小二乘移动平均', shortLabel: 'LSMA', category: 'trend', description: 'Least Squares MA' },
  { id: 'vwma', label: '成交量加权MA', shortLabel: 'VWMA', category: 'trend', description: 'Volume Weighted MA' },
  { id: 'bbi', label: '多空指数', shortLabel: 'BBI', category: 'trend', description: 'Bull-Bear Index — MA3+MA6+MA12+MA24均值' },
  { id: 'gmma', label: '顾比均线', shortLabel: 'GMMA', category: 'trend', description: 'Guppy Multiple MA — 12线系统' },
  { id: 'alligator', label: '鳄鱼线', shortLabel: 'Gator', category: 'trend', description: "Williams Alligator — 蓝/红/绿三线" },
  { id: 'tsf', label: '时间序列预测', shortLabel: 'TSF', category: 'trend', description: 'Time Series Forecast' },
  { id: 'twap', label: '时间加权均价', shortLabel: 'TWAP', category: 'trend', description: 'Time Weighted Avg Price' },
  // 动量扩展
  { id: 'dmi', label: '趋向指标', shortLabel: 'DMI', category: 'momentum', description: 'Directional Movement Index — +DI/-DI/ADX' },
  { id: 'trix', label: '三重指数平滑', shortLabel: 'TRIX', category: 'momentum', description: 'Triple Smoothed EMA' },
  { id: 'stochrsi', label: '随机RSI', shortLabel: 'StochRSI', category: 'momentum', description: 'Stochastic RSI' },
  { id: 'tsi', label: '真实强度指数', shortLabel: 'TSI', category: 'momentum', description: 'True Strength Index' },
  { id: 'cmo', label: '钱德动量', shortLabel: 'CMO', category: 'momentum', description: 'Chande Momentum Oscillator' },
  { id: 'rvi', label: '相对活力指数', shortLabel: 'RVI', category: 'momentum', description: 'Relative Vigor Index' },
  { id: 'fisher', label: '费雪变换', shortLabel: 'Fisher', category: 'momentum', description: 'Fisher Transform' },
  { id: 'ao', label: 'Awesome Oscillator', shortLabel: 'AO', category: 'momentum', description: '动量柱 — Bill Williams' },
  { id: 'mom', label: '动量线', shortLabel: 'MOM', category: 'momentum', description: 'Momentum — 今收-N前收' },
  // 超买超卖扩展
  { id: 'bias', label: '乖离率', shortLabel: 'BIAS', category: 'momentum', description: '收盘价偏离MA百分比' },
  { id: 'psy', label: '心理线', shortLabel: 'PSY', category: 'momentum', description: 'Psychological Line — N日内上涨天数占比' },
  { id: 'vr', label: '成交量变异率', shortLabel: 'VR', category: 'momentum', description: 'Volume Ratio' },
  { id: 'arbr', label: '人气意愿指标', shortLabel: 'ARBR', category: 'momentum', description: 'AR/BR指标' },
  { id: 'asi', label: '振动升降指标', shortLabel: 'ASI', category: 'momentum', description: 'Accumulation Swing Index' },
  { id: 'cr', label: '中间意愿指标', shortLabel: 'CR', category: 'momentum', description: 'CR指标 — 能量型' },
  { id: 'dpo', label: '区间振荡线', shortLabel: 'DPO', category: 'momentum', description: 'Detrended Price Oscillator' },
  // 波动扩展
  { id: 'keltner', label: '肯特纳通道', shortLabel: 'KC', category: 'volatility', description: 'Keltner Channels — ATR通道' },
  { id: 'donchian', label: '唐奇安通道', shortLabel: 'DC', category: 'volatility', description: 'Donchian Channels — N日最高最低' },
  { id: 'bb-width', label: '布林带宽', shortLabel: 'BW', category: 'volatility', description: 'Bollinger Band Width' },
  { id: 'squeeze', label: '挤压动量', shortLabel: 'Sqz', category: 'volatility', description: 'Squeeze Momentum — BB+KC共振' },
  { id: 'choppiness', label: '震荡指数', shortLabel: 'CHOP', category: 'volatility', description: 'Choppiness Index — 趋势/盘整判断' },
  { id: 'aroon', label: '阿隆指标', shortLabel: 'Aroon', category: 'volatility', description: 'Aroon Up/Down — 趋势强度' },
  { id: 'mass', label: '梅斯线', shortLabel: 'MASS', category: 'volatility', description: 'Mass Index — 反转预警' },
  // 量价扩展
  { id: 'cmf', label: '蔡金资金流', shortLabel: 'CMF', category: 'volume', description: 'Chaikin Money Flow' },
  { id: 'adl', label: '集散线', shortLabel: 'A/D', category: 'volume', description: 'Accumulation/Distribution Line' },
  { id: 'efi', label: '艾达透视', shortLabel: 'EFI', category: 'volume', description: "Elder's Force Index" },
  { id: 'vos', label: '量摆动', shortLabel: 'VOSC', category: 'volume', description: 'Volume Oscillator' },
  { id: 'vroc', label: '量变动率', shortLabel: 'VROC', category: 'volume', description: 'Volume Rate of Change' },
  { id: 'wvad', label: '威廉变异离散量', shortLabel: 'WVAD', category: 'volume', description: "Williams' Variable Accumulation Distribution" },
  { id: 'kvo', label: '克林格量摆动', shortLabel: 'KVO', category: 'volume', description: 'Klinger Volume Oscillator' },
  { id: 'eom', label: '简易波动指标', shortLabel: 'EOM', category: 'volume', description: 'Ease of Movement' },
  { id: 'bop', label: '力量平衡', shortLabel: 'BOP', category: 'volume', description: 'Balance of Power' },
  // 主图扩展
  { id: 'mi', label: '麦克支撑压力', shortLabel: 'MIKE', category: 'overlay', description: 'MIKE指标 — 多级支撑压力' },
  { id: 'td-sequential', label: '神奇九转', shortLabel: 'TD9', category: 'overlay', description: 'TD Sequential — DeMark九转' },
  { id: 'fractal', label: '分形', shortLabel: 'Fractal', category: 'overlay', description: 'Williams Fractals — 局部极值点' },
];

// ═══════════════════════════════════════════════════════════════════════
//

// NOTE: Sections 5-8 (IPC types, indicator results, data export)
// have been moved to types-data.ts for module size compliance.
// Re-export for backwards compatibility:
// export type * from './types-data';
