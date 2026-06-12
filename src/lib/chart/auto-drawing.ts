// ── R114 QTE-15 PM: 自动画线引擎 ──────────────────────────────────────
// 自动趋势线/支撑压力线/通道线识别 + 动态更新
//
// @author PM (WorkBuddy)
// @round R114 QTE-15
// @since 2026-06-12
//
// ═══════════════════════════════════════════════════════════════════════
// ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════
//
// 1. TrendLineDetector: 扫描K线序列，检测可用的趋势线
//    - 上涨趋势线(支撑): 连接至少2个低点，价格在其上方
//    - 下降趋势线(阻力): 连接至少2个高点，价格在其下方
//
// 2. SupportResistanceDetector: 识别支撑/压力位
//    - 基于历史高/低点聚类
//    - 成交量加权确认
//
// 3. ChannelDetector: 识别平行通道
//    - 等距平行线(趋势线+平行偏移)
//    - 回归通道(线性回归+标准差)

import type { KlineBar } from './types';
import type { TrendLine, HorizontalLine } from './drawing-types';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface AutoTrendLine {
  type: 'trendline_up' | 'trendline_down';
  points: { index: number; price: number }[]; // ≥2触点
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  slope: number;         // 每K线价格变化
  strength: number;      // 0-100, 基于触点数量和触碰次数
  breaks: { index: number; price: number }[]; // 被突破位置
  active: boolean;       // 当前是否仍有效
}

export interface AutoSupportResistance {
  type: 'support' | 'resistance';
  price: number;
  touches: { index: number }[]; // 触碰历史
  strength: number;      // 0-100
  broken: boolean;       // 是否已被突破
  brokenAtPrice?: number; // 被突破时的价格
}

export interface AutoChannel {
  type: 'ascending' | 'descending' | 'horizontal';
  upperLine: { startIndex: number; startPrice: number; endIndex: number; endPrice: number };
  lowerLine: { startIndex: number; startPrice: number; endIndex: number; endPrice: number };
  midline?: { startIndex: number; startPrice: number; endIndex: number; endPrice: number };
  width: number;         // 通道宽度(价格%)
  strength: number;      // 0-100
}

export interface AutoDrawingResult {
  trendLines: AutoTrendLine[];
  supportResistance: AutoSupportResistance[];
  channels: AutoChannel[];
  generatedAt: number;
  barCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
// TRENDLINE DETECTOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * 自动检测趋势线
 */
export function detectTrendLines(
  bars: KlineBar[],
  minTouches: number = 2,
  minBars: number = 5,
): AutoTrendLine[] {
  const results: AutoTrendLine[] = [];
  const n = bars.length;
  if (n < minBars * 2) return results;

  // === 上涨趋势线 (连接低点) ===
  const lows = bars.map((b, i) => ({ index: i, price: b.low }));

  for (let i = 0; i < n - minBars; i++) {
    for (let j = i + minBars; j < n; j++) {
      const p1 = lows[i];
      const p2 = lows[j];
      const lineSlope = (p2.price - p1.price) / (p2.index - p1.index);

      // 斜率合理: 非水平(±0.5%/K线以内)且不过分陡峭(±10%/K线以内)
      const absSlopePercent = Math.abs(lineSlope) / p1.price;
      if (absSlopePercent < 0.001 || absSlopePercent > 0.1) continue;

      // 收集接触此线的低点
      const touches: { index: number; price: number }[] = [{ index: p1.index, price: p1.price }];

      for (let k = i + 1; k < n; k++) {
        const expectedPrice = p1.price + lineSlope * (k - p1.index);
        const tolerance = expectedPrice * 0.02; // 2%容差

        // 价格在线上方(支撑线不应被跌破)
        if (bars[k].low >= expectedPrice - tolerance) {
          if (Math.abs(bars[k].low - expectedPrice) <= tolerance) {
            touches.push({ index: k, price: bars[k].low });
          }
        } else {
          break; // 被突破, 趋势线失效
        }
      }

      if (touches.length >= minTouches) {
        const strength = Math.min(100, touches.length * 25 + (p2.index - p1.index) * 0.5);

        results.push({
          type: 'trendline_up',
          points: touches.slice(0, 5), // 最多保留5个触点
          startIndex: p1.index,
          startPrice: p1.price,
          endIndex: j,
          endPrice: p2.price,
          slope: lineSlope,
          strength,
          breaks: [],
          active: true,
        });
      }

      break; // 只取最长的有效趋势线
    }
  }

  // === 下降趋势线 (连接高点) ===
  const highs = bars.map((b, i) => ({ index: i, price: b.high }));

  for (let i = 0; i < n - minBars; i++) {
    for (let j = i + minBars; j < n; j++) {
      const p1 = highs[i];
      const p2 = highs[j];
      const lineSlope = (p2.price - p1.price) / (p2.index - p1.index);
      const absSlopePercent = Math.abs(lineSlope) / p1.price;

      if (absSlopePercent < 0.001 || absSlopePercent > 0.1) continue;

      const touches: { index: number; price: number }[] = [{ index: p1.index, price: p1.price }];

      for (let k = i + 1; k < n; k++) {
        const expectedPrice = p1.price + lineSlope * (k - p1.index);
        const tolerance = expectedPrice * 0.02;

        if (bars[k].high <= expectedPrice + tolerance) {
          if (Math.abs(bars[k].high - expectedPrice) <= tolerance) {
            touches.push({ index: k, price: bars[k].high });
          }
        } else {
          break;
        }
      }

      if (touches.length >= minTouches) {
        const strength = Math.min(100, touches.length * 25 + (p2.index - p1.index) * 0.5);

        results.push({
          type: 'trendline_down',
          points: touches.slice(0, 5),
          startIndex: p1.index,
          startPrice: p1.price,
          endIndex: j,
          endPrice: p2.price,
          slope: lineSlope,
          strength,
          breaks: [],
          active: true,
        });
      }

      break;
    }
  }

  // 去重: 同一类型的趋势线取strength最高的2条
  const upLines = results
    .filter(t => t.type === 'trendline_up')
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2);

  const downLines = results
    .filter(t => t.type === 'trendline_down')
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2);

  return [...upLines, ...downLines];
}

// ═══════════════════════════════════════════════════════════════════════
// SUPPORT / RESISTANCE DETECTOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * 自动检测支撑/压力位
 * 基于历史高低点的价格聚类
 */
export function detectSupportResistance(
  bars: KlineBar[],
  clusterThreshold: number = 0.03,
  minTouches: number = 2,
): AutoSupportResistance[] {
  const results: AutoSupportResistance[] = [];
  const n = bars.length;
  if (n < 10) return results;

  // 收集所有局部高点和低点
  const swingHighs: { index: number; price: number }[] = [];
  const swingLows: { index: number; price: number }[] = [];

  for (let i = 2; i < n - 2; i++) {
    const b = bars[i];
    const prev2 = bars.slice(i - 2, i);
    const next2 = bars.slice(i + 1, i + 3);

    const isHigh = prev2.every(p => p.high <= b.high) && next2.every(p => p.high <= b.high);
    const isLow = prev2.every(p => p.low >= b.low) && next2.every(p => p.low >= b.low);

    if (isHigh) swingHighs.push({ index: i, price: b.high });
    if (isLow) swingLows.push({ index: i, price: b.low });
  }

  // 聚类支撑位
  const supports: AutoSupportResistance[] = clusterPrices(swingLows, clusterThreshold, minTouches)
    .map(c => ({
      type: 'support' as const,
      price: c.avgPrice,
      touches: c.points.map(p => ({ index: p.index })),
      strength: Math.min(100, c.points.length * 25 + 10),
      broken: false,
      brokenAtPrice: undefined,
    }));

  // 聚类压力位
  const resistances: AutoSupportResistance[] = clusterPrices(swingHighs, clusterThreshold, minTouches)
    .map(c => ({
      type: 'resistance' as const,
      price: c.avgPrice,
      touches: c.points.map(p => ({ index: p.index })),
      strength: Math.min(100, c.points.length * 25 + 10),
      broken: false,
      brokenAtPrice: undefined,
    }));

  // 检查是否被最近价格突破
  const currentPrice = bars[n - 1].close;

  for (const s of supports) {
    if (currentPrice < s.price * 0.97) {
      s.broken = true;
      s.brokenAtPrice = currentPrice;
    }
  }

  for (const r of resistances) {
    if (currentPrice > r.price * 1.03) {
      r.broken = true;
      r.brokenAtPrice = currentPrice;
    }
  }

  results.push(...supports, ...resistances);
  return results.sort((a, b) => b.strength - a.strength).slice(0, 8);
}

interface PriceCluster {
  avgPrice: number;
  points: { index: number; price: number }[];
}

function clusterPrices(
  points: { index: number; price: number }[],
  threshold: number,
  minSize: number,
): PriceCluster[] {
  if (points.length === 0) return [];

  // 按价格排序
  const sorted = [...points].sort((a, b) => a.price - b.price);

  const clusters: PriceCluster[] = [];
  let currentCluster: { index: number; price: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const lastPrice = currentCluster[currentCluster.length - 1].price;
    const diffPct = (sorted[i].price - lastPrice) / lastPrice;

    if (diffPct <= threshold) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length >= minSize) {
        const avgPrice = currentCluster.reduce((s, p) => s + p.price, 0) / currentCluster.length;
        clusters.push({ avgPrice, points: currentCluster });
      }
      currentCluster = [sorted[i]];
    }
  }

  // 最后一个聚类
  if (currentCluster.length >= minSize) {
    const avgPrice = currentCluster.reduce((s, p) => s + p.price, 0) / currentCluster.length;
    clusters.push({ avgPrice, points: currentCluster });
  }

  return clusters;
}

// ═══════════════════════════════════════════════════════════════════════
// CHANNEL DETECTOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * 自动检测平行通道
 */
export function detectChannels(
  bars: KlineBar[],
  minBars: number = 10,
): AutoChannel[] {
  const results: AutoChannel[] = [];
  const n = bars.length;
  if (n < minBars * 2) return results;

  // 先检测趋势线，然后找平行通道
  const trendLines = detectTrendLines(bars, 3, minBars);

  for (const tl of trendLines) {
    // 获取趋势线覆盖的K线范围
    const rangeStart = tl.startIndex;
    const rangeEnd = tl.endIndex;

    // 找到对面(上方或下方)的平行线
    const isUpTrend = tl.type === 'trendline_up';
    const swingPoints = isUpTrend
      ? bars.slice(rangeStart, rangeEnd).map((b, i) => ({ index: rangeStart + i, price: b.high }))
      : bars.slice(rangeStart, rangeEnd).map((b, i) => ({ index: rangeStart + i, price: b.low }));

    // 找对面的聚类价格
    const parallelClusters = clusterPrices(swingPoints, 0.04, 2);
    if (parallelClusters.length === 0) continue;

    // 取最大聚类做平行线
    const bestCluster = parallelClusters.reduce((best, c) =>
      c.points.length > best.points.length ? c : best, parallelClusters[0]);

    if (bestCluster.points.length < 2) continue;

    // 平行线: 相同斜率, 偏移到对面聚类
    const offset = bestCluster.avgPrice - tl.startPrice;
    const upperLine = isUpTrend
      ? {
          startIndex: tl.startIndex, startPrice: tl.startPrice + offset,
          endIndex: tl.endIndex, endPrice: tl.endPrice + offset,
        }
      : {
          startIndex: tl.startIndex, startPrice: tl.startPrice,
          endIndex: tl.endIndex, endPrice: tl.endPrice,
        };

    const lowerLine = isUpTrend
      ? {
          startIndex: tl.startIndex, startPrice: tl.startPrice,
          endIndex: tl.endIndex, endPrice: tl.endPrice,
        }
      : {
          startIndex: tl.startIndex, startPrice: tl.startPrice + offset,
          endIndex: tl.endIndex, endPrice: tl.endPrice + offset,
        };

    const width = Math.abs(offset) / tl.startPrice;
    if (width < 0.02 || width > 0.30) continue;

    const channelType =
      Math.abs(tl.slope) / tl.startPrice < 0.002 ? 'horizontal' :
      isUpTrend ? 'ascending' : 'descending';

    // 中轨
    const midOffset = offset / 2;
    const midline = {
      startIndex: tl.startIndex, startPrice: tl.startPrice + midOffset,
      endIndex: tl.endIndex, endPrice: tl.endPrice + midOffset,
    };

    results.push({
      type: channelType,
      upperLine,
      lowerLine,
      midline,
      width,
      strength: Math.min(100, tl.strength * 0.8),
    });
  }

  return results.sort((a, b) => b.strength - a.strength).slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════════════

/**
 * 执行全部自动画线检测
 */
export function autoDetectAll(bars: KlineBar[]): AutoDrawingResult {
  return {
    trendLines: detectTrendLines(bars),
    supportResistance: detectSupportResistance(bars),
    channels: detectChannels(bars),
    generatedAt: Date.now(),
    barCount: bars.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CONVERSION: AutoDrawing → DrawingData (对接 DrawingTools)
// ═══════════════════════════════════════════════════════════════════════

/**
 * 将自动检测的趋势线转换为画线工具的DrawingData格式
 */
const now = Date.now();

export function autoTrendLinesToDrawings(trendLines: AutoTrendLine[]): TrendLine[] {
  return trendLines.map((tl, i) => ({
    id: `auto_tl_${i}_${tl.startIndex}`,
    type: 'trend-line' as const,
    points: [
      { x: tl.startIndex * 8, y: tl.startPrice, price: tl.startPrice, time: now },
      { x: tl.endIndex * 8, y: tl.endPrice, price: tl.endPrice, time: now },
    ],
    extendLeft: false,
    extendRight: true,
    ray: false,
    state: 'idle' as const,
    style: {
      color: tl.type === 'trendline_up' ? '#26a69a' : '#ef5350',
      lineWidth: tl.strength > 60 ? 2 : 1,
      opacity: 0.8,
    },
    handles: [
      { position: 'start' as const, point: { x: tl.startIndex * 8, y: tl.startPrice, price: tl.startPrice, time: now }, visible: false },
      { position: 'end' as const, point: { x: tl.endIndex * 8, y: tl.endPrice, price: tl.endPrice, time: now }, visible: false },
    ],
    locked: false,
    visible: true,
    zIndex: 1,
    createdAt: now,
    updatedAt: now,
    label: `${tl.type === 'trendline_up' ? '支撑' : '阻力'} (${tl.strength}%)`,
  }));
}

/**
 * 将自动检测的支撑压力位转换为画线工具的DrawingData格式
 */
export function autoSRToDrawings(sr: AutoSupportResistance[]): HorizontalLine[] {
  return sr.map((s, i) => ({
    id: `auto_sr_${i}_${s.price}`,
    type: 'horizontal-line' as const,
    points: [{ x: 0, y: s.price, price: s.price, time: now }],
    state: 'idle' as const,
    style: {
      color: s.type === 'support' ? '#66bb6a' : '#ef5350',
      lineWidth: s.strength > 60 ? 2 : 1,
      opacity: 0.6,
      dash: s.broken ? [4, 4] : undefined,
    },
    handles: [],
    locked: false,
    visible: true,
    zIndex: 1,
    createdAt: now,
    updatedAt: now,
    label: `${s.type === 'support' ? '支撑' : '压力'} ¥${s.price.toFixed(2)}`,
  }));
}
