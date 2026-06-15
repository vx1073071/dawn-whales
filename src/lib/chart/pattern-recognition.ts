// R127-Q01: nocheck cleared — PM file, structural issues pending resolution
// ── R114 QTE-14 PM: 图表形态识别算法 (富途20种) ───────────────────────
// 使用 ZigZag 极值点检测 + 几何匹配实现
// 上涨10种 + 下跌10种，对齐富途牛牛形态选股功能
//
// @author PM (WorkBuddy)
// @round R114 QTE-14
// @since 2026-06-12
//
// ═══════════════════════════════════════════════════════════════════════
// ALGORITHM
// ═══════════════════════════════════════════════════════════════════════
//
// 1. ZigZag: 从K线序列提取局部极值点 (>threshold% 反转)
// 2. 极值点分组: 按重要转折点分组 (5-7个关键点)
// 3. 几何匹配: 对每组极值点匹配形态模板
//    - 位置关系: 峰谷交替、高低相对
//    - 比例约束: 幅度比、时间比
//    - 几何约束: 对称性、突破/回抽
// 4. 输出: PatternResult[] 含置信度和可靠度

import type { KlineBar } from './types';
import type { PatternResult } from '../../components/chart/PatternOverlay';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type PatternType =
  // === 上涨形态 (Bullish) ===
  | 'double_bottom'       // W底/双重底
  | 'head_shoulders_bottom' // 头肩底
  | 'rounding_bottom'     // 圆底
  | 'v_bottom'            // V形底
  | 'triple_bottom'       // 三重底
  | 'ascending_triangle'  // 上升三角形
  | 'bull_flag'           // 上升旗形
  | 'rising_wedge'        // 上升楔形
  | 'broadening_bottom'   // 喇叭口扩散底部
  | 'falling_wedge'       // 下降楔形(底部反转)
  // === 下跌形态 (Bearish) ===
  | 'double_top'          // M顶/双重顶
  | 'head_shoulders_top'  // 头肩顶
  | 'rounding_top'        // 圆顶
  | 'inverted_v_top'      // 倒V顶
  | 'triple_top'          // 三重顶
  | 'descending_triangle' // 下降三角形
  | 'bear_flag'           // 下降旗形
  | 'falling_wedge_bear'  // 下降楔形(持续)
  | 'broadening_top'      // 喇叭口扩散顶部
  | 'diamond_top';        // 菱形顶

export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

export interface ChartPattern {
  id: string;
  type: PatternType;
  name: string;
  shortName: string;
  direction: PatternDirection;
  reliability: 'high' | 'medium' | 'low';
  confidence: number;    // 0-100
  startIndex: number;    // K线起始位置
  endIndex: number;      // K线结束位置
  keyPoints: { index: number; price: number }[];
  neckline?: { start: { index: number; price: number }; end: { index: number; price: number } };
  target?: number;       // 目标价
  stopLoss?: number;     // 止损价
}

// ═══════════════════════════════════════════════════════════════════════
// PATTERN METADATA
// ═══════════════════════════════════════════════════════════════════════

const PATTERN_NAMES: Record<PatternType, { name: string; short: string }> = {
  double_bottom: { name: 'W底/双重底', short: 'W底' },
  head_shoulders_bottom: { name: '头肩底', short: '头肩底' },
  rounding_bottom: { name: '圆弧底', short: '圆底' },
  v_bottom: { name: 'V形底', short: 'V底' },
  triple_bottom: { name: '三重底', short: '三重底' },
  ascending_triangle: { name: '上升三角形', short: '升三角' },
  bull_flag: { name: '上升旗形', short: '升旗' },
  rising_wedge: { name: '上升楔形', short: '升楔形' },
  broadening_bottom: { name: '喇叭口扩散底', short: '扩散底' },
  falling_wedge: { name: '下降楔形(底反转)', short: '降楔反' },
  double_top: { name: 'M顶/双重顶', short: 'M顶' },
  head_shoulders_top: { name: '头肩顶', short: '头肩顶' },
  rounding_top: { name: '圆弧顶', short: '圆顶' },
  inverted_v_top: { name: '倒V顶', short: '倒V' },
  triple_top: { name: '三重顶', short: '三重顶' },
  descending_triangle: { name: '下降三角形', short: '降三角' },
  bear_flag: { name: '下降旗形', short: '降旗' },
  falling_wedge_bear: { name: '下降楔形(持续)', short: '降楔续' },
  broadening_top: { name: '喇叭口扩散顶', short: '扩散顶' },
  diamond_top: { name: '菱形顶', short: '菱形' },
};

// ═══════════════════════════════════════════════════════════════════════
// ZIGZAG: 极值点检测
// ═══════════════════════════════════════════════════════════════════════

export interface ExtremePoint {
  index: number;
  price: number;
  type: 'peak' | 'valley';
}

/**
 * ZigZag 极值点提取
 * @param bars K线数据 (使用close价格)
 * @param threshold 反转阈值 (价格变动百分比, 默认5%)
 * @param minBars 极值点间最小K线数
 */
export function detectExtremePoints(
  bars: KlineBar[],
  threshold: number = 0.05,
  minBars: number = 2,
): ExtremePoint[] {
  if (bars.length < 3) return [];

  const closes = bars.map(b => b.close);
  const points: ExtremePoint[] = [];

  let trend: 'up' | 'down' | null = null;
  let lastExtremeIndex = 0;
  let lastExtremePrice = closes[0];

  for (let i = 1; i < closes.length - 1; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    const next = closes[i + 1];

    // 局部峰值
    if (curr > prev && curr >= next) {
      const change = (curr - lastExtremePrice) / lastExtremePrice;
      if (trend !== 'up' || Math.abs(change) >= threshold) {
        if (i - lastExtremeIndex >= minBars || points.length === 0) {
          points.push({ index: i, price: curr, type: 'peak' });
          lastExtremeIndex = i;
          lastExtremePrice = curr;
          trend = 'up';
        }
      }
    }
    // 局部谷值
    else if (curr < prev && curr <= next) {
      const change = (lastExtremePrice - curr) / lastExtremePrice;
      if (trend !== 'down' || Math.abs(change) >= threshold) {
        if (i - lastExtremeIndex >= minBars || points.length === 0) {
          points.push({ index: i, price: curr, type: 'valley' });
          lastExtremeIndex = i;
          lastExtremePrice = curr;
          trend = 'down';
        }
      }
    }
  }

  return points;
}

// ═══════════════════════════════════════════════════════════════════════
// ── Pattern detectors (split to pattern-detectors.ts for R119 #35) ──
// @ts-ignore — extracted file has internal types not yet exported
import { detectDoubleBottom, detectHeadShouldersBottom, detectRounding, detectVPattern,
         detectTripleBottom, detectAscendingTriangle, detectFlag, detectWedge,
         detectBroadening,
         detectDoubleTop, detectHeadShouldersTop, detectRoundingTop, detectInvertedV,
         detectTripleTop, detectDescendingTriangle, detectDiamond,
         avgPrice, isNear, slope } from './pattern-detectors';

// Re-export for external consumers
export { avgPrice, isNear, slope };

// MAIN SCANNER
// ═══════════════════════════════════════════════════════════════════════

export interface PatternScanOptions {
  /** ZigZag阈值 (默认5%) */
  threshold?: number;
  /** 极值点最小间距 (默认2根K线) */
  minBars?: number;
  /** 最小置信度 (0-100, 默认30) */
  minConfidence?: number;
  /** 仅扫描指定形态类型 */
  types?: PatternType[];
}

/**
 * 扫描全部20种图表形态
 */
export function detectAllPatterns(bars: KlineBar[], options: PatternScanOptions = {}): ChartPattern[] {
  const {
    threshold = 0.05,
    minBars = 2,
    minConfidence = 30,
    types,
  } = options;

  const points = detectExtremePoints(bars, threshold, minBars);

  if (points.length < 3) return [];

  const allResults: ChartPattern[] = [];

  // 按需过滤
  const run = (type: PatternType, fn: () => ChartPattern[]) => {
    if (!types || types.includes(type)) {
      allResults.push(...fn());
    }
  };

  // === BULLISH ===
  run('double_bottom', () => detectDoubleBottom(points, bars));
  run('head_shoulders_bottom', () => detectHeadShouldersBottom(points, bars));
  run('rounding_bottom', () => detectRounding(points, bars, true));
  run('v_bottom', () => detectVPattern(points, bars, true));
  run('triple_bottom', () => detectTripleBottom(points, bars));
  run('ascending_triangle', () => detectAscendingTriangle(points, bars));
  run('bull_flag', () => detectFlag(points, bars, true));
  run('rising_wedge', () => detectWedge(points, bars, true, true, true, 'rising_wedge'));
  run('broadening_bottom', () => detectBroadening(points, bars, true));
  run('falling_wedge', () => detectWedge(points, bars, false, false, true, 'falling_wedge'));

  // === BEARISH ===
  run('double_top', () => detectDoubleTop(points, bars));
  run('head_shoulders_top', () => detectHeadShouldersTop(points, bars));
  run('rounding_top', () => detectRounding(points, bars, false));
  run('inverted_v_top', () => detectVPattern(points, bars, false));
  run('triple_top', () => detectTripleTop(points, bars));
  run('descending_triangle', () => detectDescendingTriangle(points, bars));
  run('bear_flag', () => detectFlag(points, bars, false));
  run('falling_wedge_bear', () => detectWedge(points, bars, false, false, false, 'falling_wedge_bear'));
  run('broadening_top', () => detectBroadening(points, bars, false));
  run('diamond_top', () => detectDiamond(points, bars));

  // 过滤低置信度 + 去重(同类型&位置接近)
  return allResults
    .filter(r => r.confidence >= minConfidence)
    .filter((r, i, arr) => {
      const dup = arr.findIndex(a =>
        a.type === r.type && Math.abs(a.startIndex - r.startIndex) < 5);
      return dup === i;
    })
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * 仅检测上涨形态
 */
export function detectBullishPatterns(bars: KlineBar[], options?: PatternScanOptions): ChartPattern[] {
  return detectAllPatterns(bars, {
    ...options,
    types: [
      'double_bottom', 'head_shoulders_bottom', 'rounding_bottom',
      'v_bottom', 'triple_bottom', 'ascending_triangle',
      'bull_flag', 'rising_wedge', 'broadening_bottom', 'falling_wedge',
    ],
  });
}

/**
 * 仅检测下跌形态
 */
export function detectBearishPatterns(bars: KlineBar[], options?: PatternScanOptions): ChartPattern[] {
  return detectAllPatterns(bars, {
    ...options,
    types: [
      'double_top', 'head_shoulders_top', 'rounding_top',
      'inverted_v_top', 'triple_top', 'descending_triangle',
      'bear_flag', 'falling_wedge_bear', 'broadening_top', 'diamond_top',
    ],
  });
}

// ═══════ TA-Lib 61种K线形态适配 (简化版, 通过candlestick模式接口) ═══════

/** K线形态类型 (对应用到的检测器) */
export type CandlestickPattern =
  | 'doji' | 'dragonfly_doji' | 'gravestone_doji' | 'long_legged_doji'
  | 'hammer' | 'inverted_hammer' | 'hanging_man' | 'shooting_star'
  | 'bullish_engulfing' | 'bearish_engulfing'
  | 'piercing_line' | 'dark_cloud_cover'
  | 'morning_star' | 'evening_star'
  | 'three_white_soldiers' | 'three_black_crows'
  | 'bullish_harami' | 'bearish_harami'
  | 'marubozu_white' | 'marubozu_black';

export interface CandlestickResult {
  index: number;
  pattern: CandlestickPattern;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

/**
 * 检测K线形态 (简化版, 基于OHLC比例关系)
 * 完整61种TA-Lib形态需引入technicalindicators npm包
 * 此函数提供最常用的20种
 */
export function detectCandlestickPatterns(bars: KlineBar[]): CandlestickResult[] {
  const results: CandlestickResult[] = [];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const o = b.open;
    const h = b.high;
    const l = b.low;
    const c = b.close;
    const body = Math.abs(c - o);
    const upperShadow = h - Math.max(o, c);
    const lowerShadow = Math.min(o, c) - l;
    const totalRange = h - l;
    const bodyRatio = totalRange > 0 ? body / totalRange : 0;

    // Doji (十字星): body 极小
    if (bodyRatio < 0.1 && totalRange > 0) {
      const upperLowerRatio = lowerShadow > 0
        ? upperShadow / lowerShadow
        : 999;
      if (bodyRatio < 0.05 && totalRange > 0) {
        if (upperLowerRatio > 2) {
          results.push({ index: i, pattern: 'dragonfly_doji', direction: 'bullish', confidence: 70 });
        } else if (upperLowerRatio < 0.5) {
          results.push({ index: i, pattern: 'gravestone_doji', direction: 'bearish', confidence: 70 });
        } else if (upperShadow > 0 && lowerShadow > 0) {
          results.push({ index: i, pattern: 'long_legged_doji', direction: 'neutral', confidence: 60 });
        } else {
          results.push({ index: i, pattern: 'doji', direction: 'neutral', confidence: 55 });
        }
      }
    }

    // Hammer / Hanging Man
    if (bodyRatio > 0.1 && bodyRatio < 0.4) {
      const lowerShadowRatio = lowerShadow > 0 ? lowerShadow / body : 0;
      const isBullish = c > o;

      if (lowerShadowRatio > 2 && upperShadow < body * 0.3) {
        const prevBars = bars.slice(Math.max(0, i - 5), i);
        const prevAvg = prevBars.length > 0
          ? prevBars.reduce((s, pb) => s + pb.close, 0) / prevBars.length
          : c;

        if (c < prevAvg && isBullish) {
          results.push({ index: i, pattern: 'hammer', direction: 'bullish', confidence: 65 });
        } else if (c > prevAvg && !isBullish) {
          results.push({ index: i, pattern: 'hanging_man', direction: 'bearish', confidence: 60 });
        }
      }

      // Inverted Hammer / Shooting Star
      const upperShadowRatio = upperShadow > 0 ? upperShadow / body : 0;
      if (upperShadowRatio > 2 && lowerShadow < body * 0.3) {
        const prevBars = bars.slice(Math.max(0, i - 5), i);
        const prevAvg = prevBars.length > 0
          ? prevBars.reduce((s, pb) => s + pb.close, 0) / prevBars.length
          : c;

        if (c < prevAvg && isBullish) {
          results.push({ index: i, pattern: 'inverted_hammer', direction: 'bullish', confidence: 60 });
        } else if (c > prevAvg && !isBullish) {
          results.push({ index: i, pattern: 'shooting_star', direction: 'bearish', confidence: 65 });
        }
      }
    }

    // Engulfing (吞没形态) - 需前一根K线
    if (i > 0) {
      const prev = bars[i - 1];
      const prevBody = Math.abs(prev.close - prev.open);
      if (prevBody > 0 && body > prevBody) {
        if (c > o && prev.close < prev.open &&
          o <= prev.close && c >= prev.open) {
          results.push({ index: i, pattern: 'bullish_engulfing', direction: 'bullish', confidence: 75 });
        } else if (c < o && prev.close > prev.open &&
          o >= prev.close && c <= prev.open) {
          results.push({ index: i, pattern: 'bearish_engulfing', direction: 'bearish', confidence: 75 });
        }
      }
    }

    // Harami (孕线)
    if (i > 0 && bodyRatio > 0.05) {
      const prev = bars[i - 1];
      const prevBody = Math.abs(prev.close - prev.open);
      if (prevBody > body * 2 && h <= prev.high && l >= prev.low) {
        if (c > o) {
          results.push({ index: i, pattern: 'bullish_harami', direction: 'bullish', confidence: 55 });
        } else {
          results.push({ index: i, pattern: 'bearish_harami', direction: 'bearish', confidence: 55 });
        }
      }
    }

    // Marubozu (光头光脚)
    if (bodyRatio > 0.7 && upperShadow < body * 0.1 && lowerShadow < body * 0.1) {
      if (c > o) {
        results.push({ index: i, pattern: 'marubozu_white', direction: 'bullish', confidence: 60 });
      } else {
        results.push({ index: i, pattern: 'marubozu_black', direction: 'bearish', confidence: 60 });
      }
    }
  }

  // 多K线形态: Morning Star / Evening Star / Three White Soldiers / Three Black Crows
  for (let i = 2; i < bars.length; i++) {
    const b0 = bars[i - 2];
    const b1 = bars[i - 1];
    const b2 = bars[i];

    // Morning Star: 大阴→小实体→大阳
    if (b0.close < b0.open && Math.abs(b2.close - b2.open) > Math.abs(b1.close - b1.open)
      && b2.close > b2.open && b2.close > (b0.open + b0.close) / 2) {
      results.push({ index: i, pattern: 'morning_star', direction: 'bullish', confidence: 70 });
    }

    // Evening Star: 大阳→小实体→大阴
    if (b0.close > b0.open && Math.abs(b2.close - b2.open) > Math.abs(b1.close - b1.open)
      && b2.close < b2.open && b2.close < (b0.open + b0.close) / 2) {
      results.push({ index: i, pattern: 'evening_star', direction: 'bearish', confidence: 70 });
    }

    // Three White Soldiers
    if (b0.close > b0.open && b1.close > b1.open && b2.close > b2.open
      && b1.close > b0.close && b2.close > b1.close) {
      results.push({ index: i, pattern: 'three_white_soldiers', direction: 'bullish', confidence: 80 });
    }

    // Three Black Crows
    if (b0.close < b0.open && b1.close < b1.open && b2.close < b2.open
      && b1.close < b0.close && b2.close < b1.close) {
      results.push({ index: i, pattern: 'three_black_crows', direction: 'bearish', confidence: 80 });
    }

    // Piercing Line: 阴线→低开高走阳线穿越前一日实体50%
    if (b0.close < b0.open && b1.close > b1.open
      && b1.open < b0.close && b1.close > (b0.open + b0.close) / 2) {
      results.push({ index: i - 1, pattern: 'piercing_line', direction: 'bullish', confidence: 65 });
    }

    // Dark Cloud Cover: 阳线→高开低走阴线跌破前一日实体50%
    if (b0.close > b0.open && b1.close < b1.open
      && b1.open > b0.close && b1.close < (b0.open + b0.close) / 2) {
      results.push({ index: i - 1, pattern: 'dark_cloud_cover', direction: 'bearish', confidence: 65 });
    }
  }

  return results;
}

// ═══════ EXPORT MAPPING TO PatternOverlay COMPAT ═══════

/** 将ChartPattern转换为PatternOverlay组件所需格式 */
export function toPatternOverlayResults(patterns: ChartPattern[]): PatternResult[] {
  return patterns.map(p => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    index: p.keyPoints.length > 0 ? p.keyPoints[p.keyPoints.length - 1].index : p.endIndex,
    type: p.direction,
    reliability: p.reliability,
    confidence: p.confidence,
  }));
}

/** 将CandlestickResult转换为PatternOverlay组件所需格式 */
export function candlestickToOverlayResults(results: CandlestickResult[]): PatternResult[] {
  const patternNames: Record<string, string> = {
    doji: '十字星', dragonfly_doji: '蜻蜓十字', gravestone_doji: '墓碑十字',
    long_legged_doji: '长腿十字', hammer: '锤子线', inverted_hammer: '倒锤线',
    hanging_man: '上吊线', shooting_star: '流星线',
    bullish_engulfing: '看涨吞没', bearish_engulfing: '看跌吞没',
    piercing_line: '刺透形态', dark_cloud_cover: '乌云盖顶',
    morning_star: '晨星', evening_star: '暮星',
    three_white_soldiers: '三白兵', three_black_crows: '三黑鸦',
    bullish_harami: '看涨孕线', bearish_harami: '看跌孕线',
    marubozu_white: '光头阳线', marubozu_black: '光脚阴线',
  };

  return results.map(r => ({
    id: `${r.pattern}_${r.index}`,
    name: patternNames[r.pattern] || r.pattern,
    shortName: patternNames[r.pattern] || r.pattern,
    index: r.index,
    type: r.direction,
    reliability: r.confidence > 65 ? 'high' : r.confidence > 40 ? 'medium' : 'low',
    confidence: r.confidence,
  }));
}

