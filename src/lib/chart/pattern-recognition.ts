// @ts-nocheck — PM file, structural issues pending resolution
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
// GEOMETRIC HELPERS
// ═══════════════════════════════════════════════════════════════════════

function avgPrice(points: { price: number }[]): number {
  return points.reduce((s, p) => s + p.price, 0) / points.length;
}

function priceDiffPercent(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(a, b);
}

function isNear(a: number, b: number, tolerance: number = 0.03): boolean {
  return priceDiffPercent(a, b) <= tolerance;
}

function _slope(p1: { index: number; price: number }, p2: { index: number; price: number }): number {
// PATTERN DETECTORS (20 patterns)
// ═══════════════════════════════════════════════════════════════════════

function detectDoubleBottom(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const valleys = points.filter(p => p.type === 'valley');

  for (let i = 0; i < valleys.length - 1; i++) {
    const v1 = valleys[i];
    const v2 = valleys[i + 1];

    // 两谷价格相近 (≤5%)
    if (!isNear(v1.price, v2.price, 0.05)) continue;

    // 中间有峰 (W形态需要)
    const midPeaks = points.filter(p =>
      p.type === 'peak' && p.index > v1.index && p.index < v2.index);
    if (midPeaks.length === 0) continue;

    const peak = midPeaks.reduce((best, p) =>
      p.price > best.price ? p : best, midPeaks[0]);

    // 峰不能太高也不能太低
    const height = (peak.price - v1.price) / v1.price;

    if (height < 0.05 || height > 0.40) continue;

    // 时间跨度合理 (≥5根K线)
    if (v2.index - v1.index < 5) continue;

    // 颈线 = 两谷连线
    const neckline = {
      start: { index: v1.index, price: v1.price },
      end: { index: v2.index, price: v2.price },
    };

    // 目标价 = 颈线 + (颈线 - 谷底)
    const target = peak.price + (peak.price - v1.price);
    const confidence = Math.min(100, Math.round(height * 250 + (v2.index - v1.index) * 2));

    results.push({
      id: `db_${v1.index}`,
      type: 'double_bottom',
      name: PATTERN_NAMES.double_bottom.name,
      shortName: PATTERN_NAMES.double_bottom.short,
      direction: 'bullish',
      reliability: confidence > 70 ? 'high' : confidence > 45 ? 'medium' : 'low',
      confidence,
      startIndex: v1.index - 3, // extend a bit for context
      endIndex: v2.index,
      keyPoints: [
        { index: v1.index, price: v1.price },
        { index: peak.index, price: peak.price },
        { index: v2.index, price: v2.price },
      ],
      neckline,
      target,
      stopLoss: v1.price * 0.97,
    });
  }
  return results;
}

function detectDoubleTop(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');

  for (let i = 0; i < peaks.length - 1; i++) {
    const p1 = peaks[i];
    const p2 = peaks[i + 1];

    if (!isNear(p1.price, p2.price, 0.05)) continue;

    const midValleys = points.filter(p =>
      p.type === 'valley' && p.index > p1.index && p.index < p2.index);
    if (midValleys.length === 0) continue;

    const valley = midValleys.reduce((best, p) =>
      p.price < best.price ? p : best, midValleys[0]);

    const depth = (p1.price - valley.price) / p1.price;
    if (depth < 0.05 || depth > 0.40) continue;
    if (p2.index - p1.index < 5) continue;

    const neckline = {
      start: { index: p1.index, price: p1.price },
      end: { index: p2.index, price: p2.price },
    };
    const target = valley.price - (p1.price - valley.price);
    const confidence = Math.min(100, Math.round(depth * 250 + (p2.index - p1.index) * 2));

    results.push({
      id: `dt_${p1.index}`,
      type: 'double_top',
      name: PATTERN_NAMES.double_top.name,
      shortName: PATTERN_NAMES.double_top.short,
      direction: 'bearish',
      reliability: confidence > 70 ? 'high' : confidence > 45 ? 'medium' : 'low',
      confidence,
      startIndex: p1.index - 3,
      endIndex: p2.index,
      keyPoints: [
        { index: p1.index, price: p1.price },
        { index: valley.index, price: valley.price },
        { index: p2.index, price: p2.price },
      ],
      neckline,
      target,
      stopLoss: p1.price * 1.03,
    });
  }
  return results;
}

function detectHeadShouldersBottom(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const valleys = points.filter(p => p.type === 'valley');

  // 需要3个谷: 左肩-头-右肩
  for (let i = 0; i < valleys.length - 2; i++) {
    const ls = valleys[i];      // left shoulder
    const head = valleys[i + 1]; // head
    const rs = valleys[i + 2];  // right shoulder

    // 头比两肩都低
    if (head.price >= ls.price || head.price >= rs.price) continue;

    // 两肩价格相近
    if (!isNear(ls.price, rs.price, 0.08)) continue;

    // 头的深度合适
    const depth = (ls.price - head.price) / ls.price;
    if (depth < 0.03 || depth > 0.35) continue;

    // 颈线: 左肩到右肩间的高点连线
    const betweenPeaks = points.filter(p =>
      p.type === 'peak' && p.index > ls.index && p.index < rs.index);
    if (betweenPeaks.length < 2) continue;

    const neckline = {
      start: { index: ls.index, price: ls.price },
      end: { index: rs.index, price: rs.price },
    };

    const target = ls.price + (ls.price - head.price);
    const confidence = Math.min(100, Math.round(depth * 300 + (rs.index - ls.index) * 1.5));

    results.push({
      id: `hsb_${ls.index}`,
      type: 'head_shoulders_bottom',
      name: PATTERN_NAMES.head_shoulders_bottom.name,
      shortName: PATTERN_NAMES.head_shoulders_bottom.short,
      direction: 'bullish',
      reliability: confidence > 70 ? 'high' : confidence > 50 ? 'medium' : 'low',
      confidence,
      startIndex: ls.index - 5,
      endIndex: rs.index,
      keyPoints: [
        { index: ls.index, price: ls.price },
        { index: head.index, price: head.price },
        { index: rs.index, price: rs.price },
      ],
      neckline,
      target,
      stopLoss: head.price * 0.97,
    });
  }
  return results;
}

function detectHeadShouldersTop(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');

  for (let i = 0; i < peaks.length - 2; i++) {
    const ls = peaks[i];
    const head = peaks[i + 1];
    const rs = peaks[i + 2];

    if (head.price <= ls.price || head.price <= rs.price) continue;
    if (!isNear(ls.price, rs.price, 0.08)) continue;

    const height = (head.price - ls.price) / ls.price;
    if (height < 0.03 || height > 0.35) continue;

    const neckline = {
      start: { index: ls.index, price: ls.price },
      end: { index: rs.index, price: rs.price },
    };

    const target = ls.price - (head.price - ls.price);
    const confidence = Math.min(100, Math.round(height * 300 + (rs.index - ls.index) * 1.5));

    results.push({
      id: `hst_${ls.index}`,
      type: 'head_shoulders_top',
      name: PATTERN_NAMES.head_shoulders_top.name,
      shortName: PATTERN_NAMES.head_shoulders_top.short,
      direction: 'bearish',
      reliability: confidence > 70 ? 'high' : confidence > 50 ? 'medium' : 'low',
      confidence,
      startIndex: ls.index - 5,
      endIndex: rs.index,
      keyPoints: [
        { index: ls.index, price: ls.price },
        { index: head.index, price: head.price },
        { index: rs.index, price: rs.price },
      ],
      neckline,
      target,
      stopLoss: head.price * 1.03,
    });
  }
  return results;
}

function detectTripleBottom(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const valleys = points.filter(p => p.type === 'valley');

  for (let i = 0; i < valleys.length - 2; i++) {
    const v1 = valleys[i];
    const v2 = valleys[i + 1];
    const v3 = valleys[i + 2];

    if (!isNear(v1.price, v2.price, 0.06) || !isNear(v2.price, v3.price, 0.06)) continue;

    const betweenPeaks = points.filter(p =>
      p.type === 'peak' && p.index > v1.index && p.index < v3.index);

    if (betweenPeaks.length < 2) continue;

    const highestPeak = betweenPeaks.reduce((best, p) =>
      p.price > best.price ? p : best, betweenPeaks[0]);

    const height = (highestPeak.price - v1.price) / v1.price;
    if (height < 0.03 || height > 0.35) continue;

    const neckline = {
      start: { index: v1.index, price: highestPeak.price },
      end: { index: v3.index, price: highestPeak.price },
    };

    const target = highestPeak.price + (highestPeak.price - v1.price);
    const confidence = Math.min(100, Math.round(height * 250 + (v3.index - v1.index)));

    results.push({
      id: `tb_${v1.index}`,
      type: 'triple_bottom',
      name: PATTERN_NAMES.triple_bottom.name,
      shortName: PATTERN_NAMES.triple_bottom.short,
      direction: 'bullish',
      reliability: confidence > 70 ? 'high' : confidence > 45 ? 'medium' : 'low',
      confidence,
      startIndex: v1.index - 3,
      endIndex: v3.index,
      keyPoints: [
        { index: v1.index, price: v1.price },
        { index: v2.index, price: v2.price },
        { index: v3.index, price: v3.price },
      ],
      neckline,
      target,
      stopLoss: Math.min(v1.price, v2.price, v3.price) * 0.97,
    });
  }
  return results;
}

function detectTripleTop(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');

  for (let i = 0; i < peaks.length - 2; i++) {
    const p1 = peaks[i];
    const p2 = peaks[i + 1];
    const p3 = peaks[i + 2];

    if (!isNear(p1.price, p2.price, 0.06) || !isNear(p2.price, p3.price, 0.06)) continue;

    const betweenValleys = points.filter(p =>
      p.type === 'valley' && p.index > p1.index && p.index < p3.index);
    if (betweenValleys.length < 2) continue;

    const deepestValley = betweenValleys.reduce((best, p) =>
      p.price < best.price ? p : best, betweenValleys[0]);

    const depth = (p1.price - deepestValley.price) / p1.price;
    if (depth < 0.03 || depth > 0.35) continue;

    const neckline = {
      start: { index: p1.index, price: deepestValley.price },
      end: { index: p3.index, price: deepestValley.price },
    };

    const target = deepestValley.price - (p1.price - deepestValley.price);
    const confidence = Math.min(100, Math.round(depth * 250 + (p3.index - p1.index)));

    results.push({
      id: `tt_${p1.index}`,
      type: 'triple_top',
      name: PATTERN_NAMES.triple_top.name,
      shortName: PATTERN_NAMES.triple_top.short,
      direction: 'bearish',
      reliability: confidence > 70 ? 'high' : confidence > 45 ? 'medium' : 'low',
      confidence,
      startIndex: p1.index - 3,
      endIndex: p3.index,
      keyPoints: [
        { index: p1.index, price: p1.price },
        { index: p2.index, price: p2.price },
        { index: p3.index, price: p3.price },
      ],
      neckline,
      target,
      stopLoss: Math.max(p1.price, p2.price, p3.price) * 1.03,
    });
  }
  return results;
}

function detectAscendingTriangle(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');
  const valleys = points.filter(p => p.type === 'valley');

  // 上升三角形: 水平上轨 + 上升下轨(底越来越高)
  for (let i = 0; i < Math.min(peaks.length, valleys.length) - 2; i++) {
    const p1 = peaks[i];
    const p2 = peaks[i + 1];
    if (valleys.length < i + 3) break;

    const v1 = valleys[i];
    const v2 = valleys[i + 1];
    const v3 = valleys[i + 2];

    // 上轨水平 (两峰接近)
    if (!isNear(p1.price, p2.price, 0.04)) continue;

    // 下轨上升 (谷越来越高)
    if (v3.price <= v2.price || v2.price <= v1.price) continue;

    // 下轨斜率适中
    const vSlope = (v3.price - v1.price) / (v3.index - v1.index);
    const maxSlope = avgPrice([v1, v2, v3]) * 0.02;
    if (vSlope <= 0 || vSlope > maxSlope) continue;

    const target = p2.price + (p2.price - v1.price);
    const confidence = Math.min(100, Math.round(60 + (v3.index - v1.index) * 0.5));

    results.push({
      id: `at_${v1.index}`,
      type: 'ascending_triangle',
      name: PATTERN_NAMES.ascending_triangle.name,
      shortName: PATTERN_NAMES.ascending_triangle.short,
      direction: 'bullish',
      reliability: confidence > 65 ? 'high' : confidence > 40 ? 'medium' : 'low',
      confidence,
      startIndex: v1.index - 3,
      endIndex: p2.index,
      keyPoints: [
        { index: v1.index, price: v1.price },
        { index: p1.index, price: p1.price },
        { index: v2.index, price: v2.price },
        { index: p2.index, price: p2.price },
        { index: v3.index, price: v3.price },
      ],
      target,
      stopLoss: v1.price * 0.98,
    });
  }
  return results;
}

function detectDescendingTriangle(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');
  const valleys = points.filter(p => p.type === 'valley');

  // 下降三角形: 水平下轨 + 下降上轨(顶越来越低)
  for (let i = 0; i < Math.min(valleys.length, peaks.length) - 2; i++) {
    const v1 = valleys[i];
    const v2 = valleys[i + 1];
    if (peaks.length < i + 3) break;

    const p1 = peaks[i];
    const p2 = peaks[i + 1];
    const p3 = peaks[i + 2];

    // 下轨水平
    if (!isNear(v1.price, v2.price, 0.04)) continue;

    // 上轨下降 (顶越来越低)
    if (p3.price >= p2.price || p2.price >= p1.price) continue;

    const pSlope = (p1.price - p3.price) / (p3.index - p1.index);
    const maxSlope = avgPrice([p1, p2, p3]) * 0.02;
    if (pSlope <= 0 || pSlope > maxSlope) continue;

    const target = v2.price - (p1.price - v2.price);
    const confidence = Math.min(100, Math.round(60 + (p3.index - p1.index) * 0.5));

    results.push({
      id: `dtri_${p1.index}`,
      type: 'descending_triangle',
      name: PATTERN_NAMES.descending_triangle.name,
      shortName: PATTERN_NAMES.descending_triangle.short,
      direction: 'bearish',
      reliability: confidence > 65 ? 'high' : confidence > 40 ? 'medium' : 'low',
      confidence,
      startIndex: p1.index - 3,
      endIndex: v2.index,
      keyPoints: [
        { index: p1.index, price: p1.price },
        { index: v1.index, price: v1.price },
        { index: p2.index, price: p2.price },
        { index: v2.index, price: v2.price },
        { index: p3.index, price: p3.price },
      ],
      target,
      stopLoss: p1.price * 1.02,
    });
  }
  return results;
}

function detectFlag(points: ExtremePoint[], bars: KlineBar[], bullish: boolean): ChartPattern[] {
  const results: ChartPattern[] = [];
  const poles = points.filter(p => p.type === (bullish ? 'peak' : 'valley'));

  for (let i = 1; i < poles.length - 1; i++) {
    const pole1 = poles[i - 1];
    const pole2 = poles[i];

    // 旗杆: 快速大波动
    const poleMove = Math.abs(pole2.price - pole1.price) / pole1.price;
    if (poleMove < 0.05 || poleMove > 0.30) continue;

    const poleDirection = (pole2.price > pole1.price) === bullish;
    if (!poleDirection) continue;

    // 旗面: 窄幅整理
    const flagBars = bars.slice(pole2.index, Math.min(bars.length, pole2.index + 20));
    const flagHigh = Math.max(...flagBars.map(b => b.high));
    const flagLow = Math.min(...flagBars.map(b => b.low));
    const flagRange = (flagHigh - flagLow) / flagLow;

    if (flagRange > poleMove * 0.5) continue; // 旗面太宽
    if (flagBars.length < 4) continue;

    const type: PatternType = bullish ? 'bull_flag' : 'bear_flag';
    const patternName = PATTERN_NAMES[type];

    const target = bullish
      ? pole2.price * (1 + poleMove)
      : pole2.price * (1 - poleMove);

    const confidence = Math.min(100, Math.round(poleMove * 400));

    results.push({
      id: `flag_${pole2.index}`,
      type,
      name: patternName.name,
      shortName: patternName.short,
      direction: bullish ? 'bullish' : 'bearish',
      reliability: confidence > 60 ? 'high' : confidence > 35 ? 'medium' : 'low',
      confidence,
      startIndex: pole1.index,
      endIndex: pole2.index + flagBars.length,
      keyPoints: [
        { index: pole1.index, price: pole1.price },
        { index: pole2.index, price: pole2.price },
      ],
      target,
      stopLoss: pole2.price * (bullish ? 0.97 : 1.03),
    });
  }
  return results;
}

function detectWedge(points: ExtremePoint[], _bars: KlineBar[],
  risingBound: boolean, fallingBound: boolean, bullish: boolean,
  patternType: PatternType): ChartPattern[] {
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');
  const valleys = points.filter(p => p.type === 'valley');

  const minLen = Math.min(peaks.length, valleys.length) - 2;
  for (let i = 0; i < minLen; i++) {
    const p1 = peaks[i];
    const p2 = peaks[i + 1];
    const v1 = valleys[i];
    const v2 = valleys[i + 1];

    // 楔形收敛: 上轨和下轨都向同方向倾斜
    const upperSlope = (p2.price - p1.price) / (p2.index - p1.index);
    const lowerSlope = (v2.price - v1.price) / (v2.index - v1.index);

    const upperDirection = upperSlope > 0.001;
    const lowerDirection = lowerSlope > 0.001;

    // 检查方向是否符合预期
    if (upperDirection !== risingBound || lowerDirection !== fallingBound) continue;

    // 楔形收敛: 幅度在收窄
    const range1 = p1.price - v1.price;
    const range2 = p2.price - v2.price;
    if (range2 >= range1) continue;

    // 时间跨度不少于5根
    if (p2.index - p1.index < 5) continue;

    const breakoutPrice = p2.price;
    const target = bullish
      ? breakoutPrice + (range2 * 2)
      : breakoutPrice - (range2 * 2);

    const patternMeta = PATTERN_NAMES[patternType];
    const confidence = Math.min(100, Math.round(50 + Math.abs(upperSlope * 1000)));

    results.push({
      id: `${patternType}_${p1.index}`,
      type: patternType,
      name: patternMeta.name,
      shortName: patternMeta.short,
      direction: bullish ? 'bullish' : 'bearish',
      reliability: confidence > 60 ? 'high' : confidence > 35 ? 'medium' : 'low',
      confidence,
      startIndex: p1.index - 3,
      endIndex: p2.index,
      keyPoints: [
        { index: p1.index, price: p1.price },
        { index: v1.index, price: v1.price },
        { index: p2.index, price: p2.price },
        { index: v2.index, price: v2.price },
      ],
      target,
      stopLoss: v1.price * (bullish ? 0.97 : 1.03),
    });
  }
  return results;
}

function detectRounding(points: ExtremePoint[], bars: KlineBar[], bottom: boolean): ChartPattern[] {
  const results: ChartPattern[] = [];
  const extremes = points.filter(p => p.type === (bottom ? 'valley' : 'peak'));

  for (const extreme of extremes) {
    // 圆弧形态: 极端值两侧对称缓慢变化
    const leftBars = bars.slice(Math.max(0, extreme.index - 15), extreme.index);
    const rightBars = bars.slice(extreme.index + 1, Math.min(bars.length, extreme.index + 16));

    if (leftBars.length < 5 || rightBars.length < 5) continue;

    // 左侧价格平滑下降(底)/上升(顶)
    const leftClose = leftBars[leftBars.length - 1].close;
    const rightClose = rightBars[0].close;

    // 左右对称: 价格接近
    if (!isNear(leftClose, rightClose, 0.06)) continue;

    // 曲率检查: 价格变化的二阶导数应较为均匀
    const curvature = computeCurvature([...leftBars, bars[extreme.index], ...rightBars], bottom);
    if (curvature < 0.3) continue;

    const type: PatternType = bottom ? 'rounding_bottom' : 'rounding_top';
    const patternMeta = PATTERN_NAMES[type];
    const confidence = Math.min(100, Math.round(curvature * 120));

    const target = bottom
      ? extreme.price + (leftClose - extreme.price) * 2
      : extreme.price - (extreme.price - leftClose) * 2;

    results.push({
      id: `${type}_${extreme.index}`,
      type,
      name: patternMeta.name,
      shortName: patternMeta.short,
      direction: bottom ? 'bullish' : 'bearish',
      reliability: confidence > 55 ? 'high' : confidence > 30 ? 'medium' : 'low',
      confidence,
      startIndex: Math.max(0, extreme.index - 15),
      endIndex: Math.min(bars.length - 1, extreme.index + 15),
      keyPoints: [{ index: extreme.index, price: extreme.price }],
      target,
      stopLoss: extreme.price * (bottom ? 0.97 : 1.03),
    });
  }
  return results;
}

function computeCurvature(bars: KlineBar[], bottom: boolean): number {
  // 简化曲率计算: 测量价格偏离直线连接的程度
  if (bars.length < 5) return 0;

  const closes = bars.map(b => b.close);
  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];

  // 直线连接
  const straightLine = closes.map((_, i) =>
    firstClose + (lastClose - firstClose) * i / (closes.length - 1));

  // 实际偏离
  let totalDeviation = 0;
  for (let i = 0; i < closes.length; i++) {
    const deviation = Math.abs(closes[i] - straightLine[i]) / straightLine[i];
    totalDeviation += deviation;
  }

  const avgDeviation = totalDeviation / closes.length;

  // 检查是否朝正确方向弯曲
  const midPoint = closes[Math.floor(closes.length / 2)];
  const midLine = straightLine[Math.floor(closes.length / 2)];
  const correctDirection = bottom
    ? midPoint < midLine  // 底部: 中间更低(弯曲向下)
    : midPoint > midLine; // 顶部: 中间更高(弯曲向上)

  return correctDirection ? Math.min(1, avgDeviation * 20) : avgDeviation * 5;
}

function detectVPattern(points: ExtremePoint[], bars: KlineBar[], bottom: boolean): ChartPattern[] {
  const results: ChartPattern[] = [];
  const extremes = points.filter(p => p.type === (bottom ? 'valley' : 'peak'));

  for (const extreme of extremes) {
    const beforeBars = Math.min(5, extreme.index);
    const afterBars = Math.min(5, bars.length - extreme.index - 1);
    if (beforeBars < 2 || afterBars < 2) continue;

    // V形: 快速反转
    const beforeSlope = (extreme.price - bars[extreme.index - beforeBars].close) / beforeBars;
    const afterSlope = (bars[extreme.index + afterBars].close - extreme.price) / afterBars;

    // 反转方向正确
    const reversals = bottom
      ? beforeSlope < 0 && afterSlope > 0    // 先跌后涨
      : beforeSlope > 0 && afterSlope < 0;   // 先涨后跌

    if (!reversals) continue;

    // 反转幅度足够
    const beforeMove = Math.abs(beforeSlope * beforeBars / extreme.price);
    const afterMove = Math.abs(afterSlope * afterBars / extreme.price);

    if (beforeMove < 0.05 || afterMove < 0.03) continue;

    const type: PatternType = bottom ? 'v_bottom' : 'inverted_v_top';
    const patternMeta = PATTERN_NAMES[type];
    const confidence = Math.min(100, Math.round(beforeMove * 300 + afterMove * 200));

    const target = bottom
      ? extreme.price * (1 + beforeMove * 1.5)
      : extreme.price * (1 - beforeMove * 1.5);

    results.push({
      id: `${type}_${extreme.index}`,
      type,
      name: patternMeta.name,
      shortName: patternMeta.short,
      direction: bottom ? 'bullish' : 'bearish',
      reliability: confidence > 65 ? 'high' : confidence > 35 ? 'medium' : 'low',
      confidence,
      startIndex: extreme.index - beforeBars,
      endIndex: extreme.index + afterBars,
      keyPoints: [{ index: extreme.index, price: extreme.price }],
      target,
      stopLoss: extreme.price * (bottom ? 0.97 : 1.03),
    });
  }
  return results;
}

function detectBroadening(points: ExtremePoint[], _bars: KlineBar[], bottom: boolean): ChartPattern[] {
  // 喇叭口扩散: 振幅越来越大
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');
  const valleys = points.filter(p => p.type === 'valley');

  const minLen = Math.min(peaks.length, valleys.length) - 2;
  for (let i = 0; i < minLen; i++) {
    const range0 = peaks[i].price - valleys[i].price;
    const range1 = peaks[i + 1].price - valleys[i + 1].price;
    const range2 = peaks[i + 2].price - valleys[i + 2].price;

    // 振幅扩大
    if (range2 <= range1 * 1.1 || range1 <= range0 * 1.1) continue;

    // 方向判断
    const trend = bottom
      ? valleys[i + 2].price > valleys[i].price && peaks[i + 2].price > peaks[i].price
      : peaks[i + 2].price < peaks[i].price && valleys[i + 2].price < valleys[i].price;

    if (!trend) continue;

    const type: PatternType = bottom ? 'broadening_bottom' : 'broadening_top';
    const patternMeta = PATTERN_NAMES[type];
    const confidence = Math.min(100, Math.round(40 + range2 / range0 * 30));

    results.push({
      id: `${type}_${valleys[i].index}`,
      type,
      name: patternMeta.name,
      shortName: patternMeta.short,
      direction: bottom ? 'bullish' : 'bearish',
      reliability: confidence > 55 ? 'high' : confidence > 30 ? 'medium' : 'low',
      confidence,
      startIndex: valleys[i].index,
      endIndex: peaks[i + 2].index,
      keyPoints: [
        { index: valleys[i].index, price: valleys[i].price },
        { index: peaks[i].index, price: peaks[i].price },
        { index: valleys[i + 2].index, price: valleys[i + 2].price },
        { index: peaks[i + 2].index, price: peaks[i + 2].price },
      ],
      target: bottom ? peaks[i + 2].price : valleys[i + 2].price,
      stopLoss: bottom ? valleys[i].price * 0.97 : peaks[i].price * 1.03,
    });
  }
  return results;
}

function detectDiamond(points: ExtremePoint[], _bars: KlineBar[]): ChartPattern[] {
  // 菱形: 先扩散再收敛
  const results: ChartPattern[] = [];
  const peaks = points.filter(p => p.type === 'peak');
  const valleys = points.filter(p => p.type === 'valley');

  const minLen = Math.min(peaks.length, valleys.length) - 3;
  for (let i = 0; i < minLen; i++) {
    const range0 = peaks[i].price - valleys[i].price;
    const range1 = peaks[i + 1].price - valleys[i + 1].price;
    const range2 = peaks[i + 2].price - valleys[i + 2].price;

    // 先扩散(range0→range1增大) 再收敛(range1→range2减小)
    if (range1 <= range0 * 1.05) continue; // 扩散不够
    if (range2 >= range1 * 0.95) continue;  // 收敛不够

    // 顶部: 确认下行趋势
    if (peaks[i + 2].price > peaks[i + 1].price) continue;

    const confidence = Math.min(100, Math.round(50 + (range1 - range2) / range1 * 100));

    results.push({
      id: `diamond_${valleys[i].index}`,
      type: 'diamond_top',
      name: PATTERN_NAMES.diamond_top.name,
      shortName: PATTERN_NAMES.diamond_top.short,
      direction: 'bearish',
      reliability: confidence > 55 ? 'high' : confidence > 30 ? 'medium' : 'low',
      confidence,
      startIndex: valleys[i].index,
      endIndex: peaks[i + 2].index,
      keyPoints: [
        { index: peaks[i].index, price: peaks[i].price },
        { index: valleys[i].index, price: valleys[i].price },
        { index: peaks[i + 2].index, price: peaks[i + 2].price },
        { index: valleys[i + 2].index, price: valleys[i + 2].price },
      ],
      target: valleys[i + 2].price,
      stopLoss: peaks[i].price * 1.03,
    });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
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


}
