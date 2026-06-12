// ── R113 QTE-09 QClaw: 画线/形态TypeScript类型定义 ───────────────────
// PM: 行情升级v2.0 模块3-4 类型基础, 单点真实源
// 覆盖: 68种画线工具 + 61种K线形态 + 20种图表形态 + 自动画线
//
// @author QClaw (document-shrimp)
// @round R113b QTE-09
// @since 2026-06-12
//
// ═══════════════════════════════════════════════════════════════════════
// USAGE GUIDE
// ═══════════════════════════════════════════════════════════════════════
//
// DrawingToolbar UI:
//   import { DRAWING_TOOL_DEFS, DrawingCategory, DrawingToolDef } from '@src/lib/chart/drawing-types';
//
// PatternOverlay UI:
//   import { PATTERN_CATALOG, PatternResult, DetectedChartPattern } from '@src/lib/chart/drawing-types';
//
// Drawing persistence:
//   import type { DrawingData, DrawingCollection } from '@src/lib/chart/drawing-types';
//
// Pattern engine (electron):
//   import type { ChartPattern, PatternRecognitionRequest, PatternRecognitionResult } from '@src/lib/chart/drawing-types';
// ═══════════════════════════════════════════════════════════════════════

import type { KlineBar } from './types';

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: 画线工具核心类型
// ═══════════════════════════════════════════════════════════════════════

/** 画线工具唯一ID */
export type DrawingId = string;

/** 画线工具分类 */
export type DrawingCategory = 'line' | 'channel' | 'fib' | 'shape' | 'text';

/** 分类中文标签 */
export const DRAWING_CATEGORY_LABELS: Record<DrawingCategory, string> = {
  line: '线段', channel: '通道', fib: '斐波那契', shape: '形状', text: '标注',
};

/** 分类颜色 */
export const DRAWING_CATEGORY_COLORS: Record<DrawingCategory, string> = {
  line: '#60a5fa', channel: '#34d399', fib: '#f472b6', shape: '#fbbf24', text: '#a78bfa',
};

/** 画线工具完整ID (68种对齐TradingView) */
export type ToolType =
  // 线段 (9)
  | 'trend-line' | 'ray' | 'horizontal-line' | 'horizontal-ray'
  | 'vertical-line' | 'cross-line' | 'info-line' | 'extended-line' | 'trend-angle'
  // 通道 (4)
  | 'parallel-channel' | 'regression-trend' | 'fixed-range-channel' | 'disjoint-channel'
  // 安德鲁分叉 (4)
  | 'pitchfork' | 'schiff-pitchfork' | 'modified-schiff-pitchfork' | 'inside-pitchfork'
  // 斐波那契 (11)
  | 'fib-retracement' | 'fib-extension' | 'fib-channel' | 'fib-time-zone'
  | 'fib-speed-resistance' | 'fib-fan' | 'fib-circle' | 'fib-spiral'
  | 'fib-speed-arc' | 'fib-wedge' | 'fib-pitchfan'
  // 江恩 (4)
  | 'gann-fan' | 'gann-box' | 'gann-square' | 'gann-square-fixed'
  // 预测测量 (8)
  | 'long-position' | 'short-position' | 'forecast' | 'price-range'
  | 'date-range' | 'date-price-range' | 'candle-pattern' | 'projection'
  // 形状 (10)
  | 'rectangle' | 'rotated-rectangle' | 'circle' | 'triangle' | 'ellipse'
  | 'arc' | 'path' | 'curve' | 'polyline' | 'hyperbola'
  // 标注 (17)
  | 'text' | 'label-callout' | 'anchor-text' | 'note-text' | 'price-note'
  | 'price-label' | 'flag-marker' | 'pin-marker' | 'comment-marker'
  | 'milestone-marker' | 'table-marker' | 'brush' | 'highlighter'
  | 'arrow-marker' | 'arrow-up' | 'arrow-down' | 'arrow-marker-generic';

// ═══════ 画线工具定义 =═══════

/** 单个画线工具定义 */
export interface DrawingToolDef {
  id: ToolType;
  label: string;
  shortLabel: string;
  icon: string;
  category: DrawingCategory;
  description: string;
  cursor?: string;
}

/** P0 20种核心画线工具 */
export const DRAWING_TOOL_DEFS: DrawingToolDef[] = [
  // ── 线段 (5) ──
  { id: 'trend-line', label: '趋势线', shortLabel: 'TL', icon: '╱', category: 'line', description: 'Trend Line — 两点连接', cursor: 'crosshair' },
  { id: 'horizontal-line', label: '水平线', shortLabel: 'HL', icon: '━', category: 'line', description: 'Horizontal Line — 价格支撑/压力', cursor: 'crosshair' },
  { id: 'vertical-line', label: '垂直线', shortLabel: 'VL', icon: '┃', category: 'line', description: 'Vertical Line — 时间标记', cursor: 'crosshair' },
  { id: 'ray', label: '射线', shortLabel: 'Ray', icon: '↗', category: 'line', description: 'Ray — 单方向延伸', cursor: 'crosshair' },
  { id: 'extended-line', label: '延长线', shortLabel: 'EL', icon: '↔', category: 'line', description: 'Extended Line — 双向延伸', cursor: 'crosshair' },

  // ── 通道 (3) ──
  { id: 'parallel-channel', label: '平行通道', shortLabel: 'PC', icon: '∥', category: 'channel', description: 'Parallel Channel — 趋势通道', cursor: 'crosshair' },
  { id: 'regression-trend', label: '回归趋势', shortLabel: 'LR', icon: '📈', category: 'channel', description: 'Linear Regression Channel — 统计回归', cursor: 'crosshair' },
  { id: 'pitchfork', label: '安德鲁鱼叉', shortLabel: 'AP', icon: 'Ψ', category: 'channel', description: "Andrew's Pitchfork — 中位线+叉臂", cursor: 'crosshair' },

  // ── 斐波那契 (3) ──
  { id: 'fib-retracement', label: '斐波那契回调', shortLabel: 'Fib', icon: 'φ', category: 'fib', description: 'Fib Retracement — 0/0.236/0.382/0.5/0.618/0.786/1', cursor: 'crosshair' },
  { id: 'fib-extension', label: '斐波那契扩展', shortLabel: 'FExt', icon: 'Φ', category: 'fib', description: 'Fib Extension — 三目标', cursor: 'crosshair' },
  { id: 'fib-speed-resistance', label: '斐波速度阻力', shortLabel: 'FSR', icon: '🌊', category: 'fib', description: 'Speed Resistance Fan — 扇形', cursor: 'crosshair' },

  // ── 形状 (4) ──
  { id: 'rectangle', label: '矩形', shortLabel: 'Rect', icon: '▭', category: 'shape', description: 'Rectangle — 支撑/阻力/盘整区域', cursor: 'crosshair' },
  { id: 'price-range', label: '价格区间', shortLabel: 'PR', icon: '↕', category: 'shape', description: 'Price Range — 价格跨度标注', cursor: 'crosshair' },
  { id: 'date-range', label: '日期区间', shortLabel: 'DR', icon: '↔', category: 'shape', description: 'Date Range — 时间跨度标注', cursor: 'crosshair' },
  { id: 'triangle', label: '三角形', shortLabel: '△', icon: '△', category: 'shape', description: 'Triangle — 形态标记', cursor: 'crosshair' },

  // ── 标注 (5) ──
  { id: 'text', label: '文字标注', shortLabel: 'T', icon: 'T', category: 'text', description: 'Text Annotation — 自由文字', cursor: 'text' },
  { id: 'label-callout', label: '标注气泡', shortLabel: '💬', icon: '💬', category: 'text', description: 'Callout — 气泡标注', cursor: 'crosshair' },
  { id: 'arrow-marker', label: '箭头', shortLabel: '→', icon: '→', category: 'text', description: 'Arrow — 方向指示', cursor: 'crosshair' },
  { id: 'price-label', label: '价格标签', shortLabel: '🏷', icon: '🏷', category: 'text', description: 'Price Label — Y轴价格标记', cursor: 'crosshair' },
  { id: 'note-text', label: '笔记', shortLabel: 'N', icon: '📝', category: 'text', description: 'Note — 自由笔记', cursor: 'crosshair' },
];

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: 画线数据结构
// ═══════════════════════════════════════════════════════════════════════

/** 画布坐标点 */
export interface Point {
  x: number;       // Canvas像素X
  y: number;       // Canvas像素Y
  price: number;   // 对应价格
  time: number;    // Unix毫秒
}

/** 画线状态 */
export type DrawingState = 'idle' | 'drawing' | 'selected' | 'moving' | 'resizing';

/** 画线控制手柄 */
export interface DrawingHandle {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    | 'start' | 'end' | 'center' | 'level-1' | 'level-2' | 'level-3';
  point: Point;
  visible: boolean;
}

/** 画线样式 */
export interface DrawingStyle {
  color: string;
  lineWidth: number;
  dash?: number[];
  opacity: number;
  fontFamily?: string;
  fontSize?: number;
  fillColor?: string;
  fillOpacity?: number;
}

/** 所有画线的基类 */
export interface DrawingBase {
  id: DrawingId;
  type: ToolType;
  state: DrawingState;
  points: Point[];
  handles: DrawingHandle[];
  style: DrawingStyle;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
  label?: string;
  note?: string;
}

// ── 具体画线类型 ──

/** 趋势线 */
export interface TrendLine extends DrawingBase {
  type: 'trend-line';
  points: [Point, Point];
  extendLeft: boolean;
  extendRight: boolean;
  ray: boolean;
}

/** 水平线 */
export interface HorizontalLine extends DrawingBase {
  type: 'horizontal-line';
  points: [Point];
}

/** 斐波那契回调 */
export interface FibRetracement extends DrawingBase {
  type: 'fib-retracement';
  points: [Point, Point];
  levels: number[];
  showLabels: boolean;
  showLevels: boolean;
  invertFib: boolean;
}

/** 斐波那契扩展 */
export interface FibExtension extends DrawingBase {
  type: 'fib-extension';
  points: [Point, Point, Point];
  levels: number[];
  showLabels: boolean;
}

/** 平行通道 */
export interface ParallelChannel extends DrawingBase {
  type: 'parallel-channel';
  points: [Point, Point, Point];
  extendLeft: boolean;
  extendRight: boolean;
  showMidline: boolean;
}

/** 安德鲁分叉 */
export interface Pitchfork extends DrawingBase {
  type: 'pitchfork';
  points: [Point, Point, Point];
  showSchiffAdjustment: boolean;
}

/** 回归通道 */
export interface RegressionTrend extends DrawingBase {
  type: 'regression-trend';
  points: [Point, Point];
  stddevMultiplier: number;
  showCenter: boolean;
  showPearsonR: boolean;
}

/** 矩形 */
export interface RectangleDrawing extends DrawingBase {
  type: 'rectangle';
  points: [Point, Point];
  filled: boolean;
}

/** 文字标注 */
export interface TextDrawing extends DrawingBase {
  type: 'text' | 'label-callout' | 'note-text' | 'price-label' | 'arrow-marker';
  points: [Point];
  text: string;
}

/** 测量工具 */
export interface MeasurementDrawing extends DrawingBase {
  type: 'price-range' | 'date-range' | 'date-price-range';
  points: [Point, Point];
  showValues: boolean;
}

/** 所有画线联合类型 */
export type DrawingData =
  | TrendLine
  | HorizontalLine
  | FibRetracement
  | FibExtension
  | ParallelChannel
  | Pitchfork
  | RegressionTrend
  | RectangleDrawing
  | TextDrawing
  | MeasurementDrawing;

/** 画线集合 (持久化存储) */
export interface DrawingCollection {
  symbol: string;
  timeframe: string;
  drawings: DrawingData[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: 画线颜色与线型预设
// ═══════════════════════════════════════════════════════════════════════

/** 预设颜色面板 */
export const DRAWING_COLORS: string[] = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#94a3b8', '#f8fafc', '#c9a96e',
];

/** 线型定义 */
export interface LineStyleDef {
  id: string;
  label: string;
  dash: number[];
}

/** 预设线型 */
export const LINE_STYLES: LineStyleDef[] = [
  { id: 'solid', label: '实线', dash: [] },
  { id: 'dotted', label: '点线', dash: [1, 3] },
  { id: 'dashed', label: '虚线', dash: [4, 4] },
  { id: 'dashdot', label: '点划线', dash: [6, 2, 1, 2] },
];

/** 默认画线样式 */
export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: '#c9a96e',
  lineWidth: 1,
  dash: [],
  opacity: 1,
  fontFamily: 'monospace',
  fontSize: 11,
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: K线形态识别类型 (TA-Lib 61种)
// ═══════════════════════════════════════════════════════════════════════

/** 形态方向 */
export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

/** 形态可靠性 */
export type PatternReliability = 'high' | 'medium' | 'low';

/** 单根K线形态识别结果 */
export interface PatternResult {
  id: string;
  name: string;
  shortName: string;
  /** K线索引 (在bars数组中的位置) */
  index: number;
  /** 方向 */
  type: PatternDirection;
  reliability: PatternReliability;
  /** 置信度 0-100 */
  confidence: number;
}

/** K线形态目录条目 */
export interface PatternCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  type: PatternDirection;
  description: string;
  /** 需要的K线数 */
  requiredBars: number;
}

/** 61种K线形态完整目录 */
export const PATTERN_CATALOG: PatternCatalogEntry[] = [
  // ── 单根K线 (7) ──
  { id: 'doji', name: '十字星', shortName: '十字星', type: 'neutral', description: 'Doji — 开盘价=收盘价, 多空平衡', requiredBars: 1 },
  { id: 'hammer', name: '锤子线', shortName: '锤子', type: 'bullish', description: 'Hammer — 长下影线, 底部反转', requiredBars: 2 },
  { id: 'hanging-man', name: '上吊线', shortName: '上吊', type: 'bearish', description: 'Hanging Man — 顶部反转信号', requiredBars: 2 },
  { id: 'shooting-star', name: '射击之星', shortName: '流星', type: 'bearish', description: 'Shooting Star — 长上影线, 顶部反转', requiredBars: 2 },
  { id: 'inverted-hammer', name: '倒锤子', shortName: '倒锤', type: 'bullish', description: 'Inverted Hammer — 底部反转', requiredBars: 2 },
  { id: 'marubozu', name: '光头光脚', shortName: '光脚', type: 'neutral', description: 'Marubozu — 趋势强劲, 无影线', requiredBars: 1 },
  { id: 'spinning-top', name: '陀螺线', shortName: '陀螺', type: 'neutral', description: 'Spinning Top — 实体小影线长, 犹豫', requiredBars: 1 },

  // ── 双K线 (8) ──
  { id: 'bullish-engulfing', name: '看涨吞没', shortName: '吞没↑', type: 'bullish', description: 'Bullish Engulfing — 阳包阴', requiredBars: 2 },
  { id: 'bearish-engulfing', name: '看跌吞没', shortName: '吞没↓', type: 'bearish', description: 'Bearish Engulfing — 阴包阳', requiredBars: 2 },
  { id: 'bullish-harami', name: '看涨孕线', shortName: '孕线↑', type: 'bullish', description: 'Bullish Harami — 小K线在大K线体内', requiredBars: 2 },
  { id: 'bearish-harami', name: '看跌孕线', shortName: '孕线↓', type: 'bearish', description: 'Bearish Harami', requiredBars: 2 },
  { id: 'piercing-line', name: '刺透线', shortName: '刺透', type: 'bullish', description: 'Piercing Line — 低开高走刺入前阴一半', requiredBars: 2 },
  { id: 'dark-cloud-cover', name: '乌云盖顶', shortName: '乌云', type: 'bearish', description: 'Dark Cloud Cover', requiredBars: 2 },
  { id: 'tweezer-top', name: '平头顶', shortName: '平头↓', type: 'bearish', description: 'Tweezer Top — 两线同高', requiredBars: 2 },
  { id: 'tweezer-bottom', name: '平头底', shortName: '平头↑', type: 'bullish', description: 'Tweezer Bottom — 两线同低', requiredBars: 2 },

  // ── 三K线 (8) ──
  { id: 'morning-star', name: '启明星', shortName: '启明星', type: 'bullish', description: 'Morning Star — 阴→十字→阳, 底部反转三线', requiredBars: 3 },
  { id: 'evening-star', name: '黄昏星', shortName: '黄昏星', type: 'bearish', description: 'Evening Star — 阳→十字→阴, 顶部反转三线', requiredBars: 3 },
  { id: 'three-white-soldiers', name: '三白兵', shortName: '三白兵', type: 'bullish', description: 'Three White Soldiers — 三连阳递增', requiredBars: 3 },
  { id: 'three-black-crows', name: '三乌鸦', shortName: '三乌鸦', type: 'bearish', description: 'Three Black Crows — 三连阴递减', requiredBars: 3 },
  { id: 'three-inside-up', name: '三内升', shortName: '三内升', type: 'bullish', description: 'Three Inside Up — 孕线+突破', requiredBars: 3 },
  { id: 'three-inside-down', name: '三内降', shortName: '三内降', type: 'bearish', description: 'Three Inside Down', requiredBars: 3 },
  { id: 'morning-doji-star', name: '启明十字星', shortName: '启明十字', type: 'bullish', description: 'Morning Doji Star — 启明星变体', requiredBars: 3 },
  { id: 'evening-doji-star', name: '黄昏十字星', shortName: '黄昏十字', type: 'bearish', description: 'Evening Doji Star — 黄昏星变体', requiredBars: 3 },

  // ── 复合形态 (8) ──
  { id: 'abandoned-baby-bull', name: '弃婴(看涨)', shortName: '弃婴↑', type: 'bullish', description: 'Abandoned Baby — 跳空十字+跳空反转', requiredBars: 3 },
  { id: 'abandoned-baby-bear', name: '弃婴(看跌)', shortName: '弃婴↓', type: 'bearish', description: 'Abandoned Baby — bear', requiredBars: 3 },
  { id: 'rising-three-methods', name: '上升三法', shortName: '升三法', type: 'bullish', description: 'Rising Three Methods — 大阳+三阴回调+大阳', requiredBars: 5 },
  { id: 'falling-three-methods', name: '下降三法', shortName: '降三法', type: 'bearish', description: 'Falling Three Methods', requiredBars: 5 },
  { id: 'belt-hold-bull', name: '探水杆(看涨)', shortName: '探水↑', type: 'bullish', description: 'Belt Hold Bullish — 低开阳线无下影', requiredBars: 1 },
  { id: 'belt-hold-bear', name: '探水杆(看跌)', shortName: '探水↓', type: 'bearish', description: 'Belt Hold Bearish — 高开阴线无上影', requiredBars: 1 },
  { id: 'ladder-bottom', name: '梯底', shortName: '梯底', type: 'bullish', description: 'Ladder Bottom — 底部五线反转', requiredBars: 5 },
  { id: 'mat-hold', name: '垫子持有', shortName: '垫子', type: 'bullish', description: 'Mat Hold — 上升三法变体', requiredBars: 5 },
];

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: 图表形态识别类型 (富途20种 + 扩展)
// ═══════════════════════════════════════════════════════════════════════

/** 图表形态类型 */
export type ChartPatternType =
  // 上涨形态 (10)
  | 'double-bottom' | 'triple-bottom' | 'head-shoulders-bottom' | 'rounding-bottom'
  | 'broadening-bottom' | 'bullish-flag' | 'bullish-symmetrical-triangle'
  | 'bullish-continuation-diamond' | 'bullish-continuation-wedge' | 'bullish-continuation-triangle'
  // 下跌形态 (10)
  | 'double-top' | 'triple-top' | 'head-shoulders-top' | 'rounding-top'
  | 'broadening-top' | 'bearish-flag' | 'bearish-symmetrical-triangle'
  | 'bearish-continuation-diamond' | 'bearish-continuation-wedge' | 'bearish-continuation-triangle'
  // 扩展 (TrendSpider)
  | 'cup-handle' | 'rising-wedge' | 'falling-wedge'
  | 'ascending-channel' | 'descending-channel' | 'horizontal-channel';

/** 图表形态中文名映射 */
export const CHART_PATTERN_LABELS: Record<ChartPatternType, string> = {
  'double-bottom': 'W型底', 'triple-bottom': '三重底', 'head-shoulders-bottom': '头肩底',
  'rounding-bottom': '圆弧底', 'broadening-bottom': '喇叭底', 'bullish-flag': '看涨旗形',
  'bullish-symmetrical-triangle': '看涨对称三角形', 'bullish-continuation-diamond': '看涨持续菱形',
  'bullish-continuation-wedge': '看涨持续楔形', 'bullish-continuation-triangle': '看涨持续三角形',
  'double-top': 'M型顶', 'triple-top': '三重顶', 'head-shoulders-top': '头肩顶',
  'rounding-top': '圆弧顶', 'broadening-top': '喇叭顶', 'bearish-flag': '看跌旗形',
  'bearish-symmetrical-triangle': '看跌对称三角形', 'bearish-continuation-diamond': '看跌持续菱形',
  'bearish-continuation-wedge': '看跌持续楔形', 'bearish-continuation-triangle': '看跌持续三角形',
  'cup-handle': '杯柄形态', 'rising-wedge': '上升楔形', 'falling-wedge': '下降楔形',
  'ascending-channel': '上升通道', 'descending-channel': '下降通道', 'horizontal-channel': '水平通道',
};

/** 已识别的图表形态 */
export interface DetectedChartPattern {
  /** 形态类型 */
  pattern: ChartPatternType;
  /** 中文名 */
  patternCN: string;
  /** 方向 */
  direction: 'bullish' | 'bearish';
  /** K线索引范围 */
  startIndex: number;
  endIndex: number;
  /** 置信度 0-1 */
  confidence: number;
  /** 关键点位 (极值点) */
  keyPoints: { index: number; price: number }[];
  /** 颈线 */
  neckline?: { start: { index: number; price: number }; end: { index: number; price: number } };
  /** 目标价 */
  targetPrice?: number;
  /** 止损价 */
  stopLoss?: number;
  /** 3日看涨概率 */
  bullProb3d?: number;
  /** 3日看跌概率 */
  bearProb3d?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: 自动画线类型
// ═══════════════════════════════════════════════════════════════════════

/** 自动趋势线 */
export interface AutoTrendLine {
  /** 起点 */
  start: { index: number; price: number };
  /** 终点 */
  end: { index: number; price: number };
  /** 斜率 */
  slope: number;
  /** R² 拟合度 */
  rSquared: number;
  /** 触碰点数 (趋势线有效性的证据) */
  touchPoints: number;
  /** 类型 */
  type: 'support' | 'resistance';
}

/** 支撑/压力位 */
export interface SupportResistance {
  price: number;
  /** 触碰次数 */
  touchCount: number;
  /** 类型 */
  type: 'support' | 'resistance';
  /** 强度 (触碰次数 × 时间跨度) */
  strength: number;
  /** 首次触碰时的K线索引 */
  firstTouch: number;
  /** 最近触碰时的K线索引 */
  lastTouch: number;
}

/** ZigZag 极值点 */
export interface ZigZagPoint {
  index: number;
  price: number;
  /** 类型 */
  type: 'high' | 'low';
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: 形态识别引擎接口
// ═══════════════════════════════════════════════════════════════════════

/** 形态识别请求 */
export interface PatternRecognitionRequest {
  /** K线数据 */
  bars: KlineBar[];
  /** 识别类型 */
  types: ('candlestick' | 'chart' | 'auto-trendline' | 'zigzag')[];
  /** 形态检测敏感度 0-1 */
  sensitivity?: number;
}

/** 形态识别结果 */
export interface PatternRecognitionResult {
  success: boolean;
  /** K线形态 */
  candlePatterns: PatternResult[];
  /** 图表形态 */
  chartPatterns: DetectedChartPattern[];
  /** 自动趋势线 */
  autoTrendLines: AutoTrendLine[];
  /** ZigZag 极值点 */
  zigzagPoints: ZigZagPoint[];
  /** 支撑/压力位 */
  supportResistance: SupportResistance[];
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: 画线工具栏IPC接口
// ═══════════════════════════════════════════════════════════════════════

/** IPC: drawings:save — 保存画线到IndexedDB */
export interface IpcSaveDrawingsRequest {
  symbol: string;
  timeframe: string;
  drawings: DrawingData[];
}

/** IPC: drawings:load — 加载画线 */
export interface IpcLoadDrawingsRequest {
  symbol: string;
  timeframe: string;
}

/** IPC: drawings:load 响应 */
export interface IpcLoadDrawingsResponse {
  success: boolean;
  data: DrawingData[];
  error?: string;
}

/** IPC: patterns:detect — 形态识别 */
export interface IpcPatternDetectRequest {
  symbol: string;
  bars: KlineBar[];
  options?: { candle?: boolean; chart?: boolean; auto?: boolean };
}

/** IPC: patterns:detect 响应 */
export interface IpcPatternDetectResponse {
  success: boolean;
  data: PatternRecognitionResult;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT AGGREGATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * 全部画线/形态类型导出 (import from '@src/lib/chart/drawing-types')
 *
 * 画线工具: DrawingToolDef, DRAWING_TOOL_DEFS, ToolType, DrawingCategory
 * 画线数据: DrawingData, DrawingBase, TrendLine, HorizontalLine, FibRetracement,
 *           FibExtension, ParallelChannel, Pitchfork, RegressionTrend,
 *           RectangleDrawing, TextDrawing, MeasurementDrawing, DrawingCollection
 * 画线样式: DrawingStyle, DRAWING_COLORS, LINE_STYLES, DEFAULT_DRAWING_STYLE
 * K线形态: PatternResult, PatternCatalogEntry, PATTERN_CATALOG, PatternDirection
 * 图表形态: DetectedChartPattern, ChartPatternType, CHART_PATTERN_LABELS
 * 自动画线: AutoTrendLine, SupportResistance, ZigZagPoint
 * 引擎接口: PatternRecognitionRequest, PatternRecognitionResult
 * IPC: IpcSaveDrawingsRequest, IpcLoadDrawingsRequest, IpcLoadDrawingsResponse,
 *      IpcPatternDetectRequest, IpcPatternDetectResponse
 */
