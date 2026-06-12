// ── R113 KLineChart Pro Types — 多周期/复权/K线类型/十字光标/指标 ──────
// PM: 行情升级v2.0模块1-2 类型基础

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | 'D' | 'W' | 'M';

export const ALL_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W', 'M'];
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1分', '5m': '5分', '15m': '15分', '30m': '30分',
  '1h': '1时', '4h': '4时', 'D': '日', 'W': '周', 'M': '月',
};
export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, 'D': 86_400_000,
  'W': 604_800_000, 'M': 2_592_000_000,
};

export type AdjustType = 'none' | 'pre' | 'post';

export type CandleType = 'candle' | 'hollow' | 'heikin-ashi' | 'line' | 'area';

export interface KlineBar {
  time: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorLine {
  label: string;
  color: string;
  lineWidth: number;
  dash?: number[];
  data: (number | null)[];
}

export interface IndicatorConfig {
  id: string;
  label: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume' | 'overlap';
  params: Record<string, number>;
  calc: (bars: KlineBar[], params: Record<string, number>) => (number | null)[];
  defaultColor: string;
}

export interface ChartTheme {
  bg: string;
  grid: string;
  gridMinor: string;
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
}

export const CHART_THEME_DARK: ChartTheme = {
  bg: '#0d1117', grid: '#1c2333', gridMinor: 'rgba(28,35,51,0.4)',
  text: '#8b949e', textMuted: '#484f58', crosshair: '#c9a96e',
  up: '#22c55e', down: '#ef4444', upBg: 'rgba(34,197,94,0.12)', downBg: 'rgba(239,68,68,0.12)',
  volUp: 'rgba(34,197,94,0.3)', volDown: 'rgba(239,68,68,0.3)', border: '#30363d',
};

export interface ChartLayout {
  mainRatio: number; // 0-1, K线区域占比
  indicatorRatio: number;
  volumeRatio: number;
}

export const DEFAULT_LAYOUT: ChartLayout = { mainRatio: 0.55, indicatorRatio: 0.25, volumeRatio: 0.20 };

// 20 核心指标 ID 枚举
export const INDICATOR_IDS = {
  // Trend
  MA: 'ma', EMA: 'ema', SMA_WEIGHTED: 'wma', BOLL: 'boll',
  // Momentum
  MACD: 'macd', RSI: 'rsi', KDJ: 'kdj', WR: 'wr', CCI: 'cci',
  // Volatility
  ATR: 'atr', STDDEV: 'stddev',
  // Volume
  OBV: 'obv', VWAP: 'vwap', MFI: 'mfi',
  // Overlap
  SAR: 'sar', ICHIMOKU: 'ichimoku',
  // Custom
  PIVOT: 'pivot', MA_ENVELOPE: 'ma-envelope', EMA_CROSS: 'ema-cross',
} as const;
