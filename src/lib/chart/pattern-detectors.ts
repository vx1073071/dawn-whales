// R127-Q01: nocheck cleared — extracted from pattern-recognition.ts, internal types preserved
// ── TradingEasy — Pattern Detectors (extracted from pattern-recognition.ts) ──
// 20 chart pattern detection functions (W底/头肩/M顶/三角形/旗形 etc.)
// Imported by pattern-recognition.ts
//
// @round R119 #35 — split from pattern-recognition.ts (was 1072L)
// @since 2026-06-12

import type { ExtremePoint, ChartPattern, KlineBar, PatternType, ZigZagConfig, Neckline, KeyPoint } from './pattern-recognition';

// Re-export geometric helpers (used by detectors)
export function avgPrice(points: { price: number }[]): number {
  return points.reduce((s, p) => s + p.price, 0) / points.length;
}

export function isNear(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) <= tolerance;
}

export function slope(p1: { index: number; price: number }, p2: { index: number; price: number }): number {
  if (p2.index === p1.index) return 0;
  return (p2.price - p1.price) / (p2.index - p1.index);
}

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