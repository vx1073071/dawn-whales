// ── R267 JVS-4 形态识别 21新引擎 (PatternRecognition21Engine) ──
// 21种K线形态自动识别: 头肩/双顶底/三角形/旗形/楔形/圆弧/岛形/谐波形态等
// 对标 TradingView 30+形态 + 富途 15+形态

export interface KLine {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PatternMatch {
  /** Pattern type identifier */
  pattern: PatternType;
  /** Human-readable name */
  name: string;
  /** Direction implication */
  direction: 'bullish' | 'bearish' | 'neutral';
  /** Reliability score 0-100 */
  reliability: number;
  /** Start bar index (inclusive) */
  startIndex: number;
  /** End bar index (inclusive) */
  endIndex: number;
  /** Key price levels */
  priceLevels: {
    neckline?: number;
    target?: number;
    entry?: number;
    stopLoss?: number;
    takeProfit?: number;
  };
  /** Pattern completion percentage (0-100 for incomplete patterns) */
  completion: number;
  /** Whether pattern is fully formed */
  completed: boolean;
  /** Description */
  description: string;
}

export type PatternType =
  // 经典反转形态
  | 'head_shoulders_top'
  | 'head_shoulders_bottom'
  | 'double_top'
  | 'double_bottom'
  | 'triple_top'
  | 'triple_bottom'
  | 'rounding_top'
  | 'rounding_bottom'
  // 持续形态
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetrical_triangle'
  | 'bull_flag'
  | 'bear_flag'
  | 'bull_pennant'
  | 'bear_pennant'
  | 'rising_wedge'
  | 'falling_wedge'
  // 其他经典
  | 'cup_handle'
  | 'inverse_cup_handle'
  | 'island_top'
  | 'island_bottom'
  | 'broadening_top'
  | 'broadening_bottom'
  // 蜡烛图组合
  | 'morning_star'
  | 'evening_star'
  | 'three_white_soldiers'
  | 'three_black_crows'
  | 'engulfing_bullish'
  | 'engulfing_bearish'
  | 'hammer'
  | 'shooting_star'
  | 'doji'
  | 'marubozu';

interface SwingPoint {
  index: number;
  price: number;
  type: 'peak' | 'trough';
}

export interface PatternConfig {
  /** Default target (TP) as % of entry */
  defaultTargetPct?: number;
  /** Default stop as % of entry */
  defaultStopPct?: number;
  /** Min swing distance for pattern detection */
  minSwingDistance?: number;
  /** Tolerance for price level matching (% of price) */
  levelTolerance?: number;
}

export const DEFAULT_PATTERN_CONFIG: Required<PatternConfig> = {
  defaultTargetPct: 0.05,
  defaultStopPct: 0.02,
  minSwingDistance: 5,
  levelTolerance: 0.03,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class PatternRecognition21Engine {
  private config: Required<PatternConfig>;
  private bars: KLine[] = [];

  constructor(config?: PatternConfig) {
    this.config = { ...DEFAULT_PATTERN_CONFIG, ...config };
  }

  reset(): void {
    this.bars = [];
  }

  getConfig(): Required<PatternConfig> {
    return { ...this.config };
  }

  loadBars(bars: KLine[]): void {
    this.bars = [...bars].sort((a, b) => a.timestamp - b.timestamp);
  }

  getBarCount(): number {
    return this.bars.length;
  }

  // ═══════════ Swing Points ═══════════

  private findSwingPoints(minDistance?: number): SwingPoint[] {
    const dist = minDistance || this.config.minSwingDistance;
    if (this.bars.length < dist * 3) return [];

    const swings: SwingPoint[] = [];
    for (let i = dist; i < this.bars.length - dist; i++) {
      const bar = this.bars[i];
      let isPeak = true, isTrough = true;
      for (let j = i - dist; j <= i + dist; j++) {
        if (j === i) continue;
        if (this.bars[j].high >= bar.high) isPeak = false;
        if (this.bars[j].low <= bar.low) isTrough = false;
      }
      if (isPeak) swings.push({ index: i, price: bar.high, type: 'peak' });
      if (isTrough) swings.push({ index: i, price: bar.low, type: 'trough' });
    }
    return swings.sort((a, b) => a.index - b.index);
  }

  // ═══════════ Full Scan ═══════════

  scanAll(): PatternMatch[] {
    const patterns: PatternMatch[] = [];

    // Candlestick patterns (fast, check last 5 bars)
    patterns.push(...this.detectCandlestickPatterns());

    // Multi-bar patterns (require swing points)
    const swings = this.findSwingPoints();
    patterns.push(...this.detectHeadShoulders(swings));
    patterns.push(...this.detectDoubleTopBottom(swings));
    patterns.push(...this.detectTripleTopBottom(swings));
    patterns.push(...this.detectTriangles(swings));
    patterns.push(...this.detectFlags(swings));
    patterns.push(...this.detectWedges(swings));
    patterns.push(...this.detectRounding(swings));
    patterns.push(...this.detectCupHandle(swings));
    patterns.push(...this.detectIsland(swings));
    patterns.push(...this.detectBroadening(swings));

    // Sort most recent first
    patterns.sort((a, b) => b.endIndex - a.endIndex);

    // Deduplicate: keep highest reliability for same pattern type in same area
    return this.deduplicatePatterns(patterns);
  }

  private deduplicatePatterns(patterns: PatternMatch[]): PatternMatch[] {
    const seen = new Set<string>();
    return patterns.filter((p) => {
      const key = `${p.pattern}-${p.startIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ═══════════ Candlestick Patterns ═══════════

  private detectCandlestickPatterns(): PatternMatch[] {
    const results: PatternMatch[] = [];
    const n = this.bars.length;
    if (n < 3) return results;

    const last = (i: number) => this.bars[n - 1 - i];

    // Engulfing
    const c0 = last(0);
    const c1 = last(1);
    const c2 = last(2);

    // Bullish engulfing
    if (c1.close < c1.open && c0.close > c0.open &&
        c0.open <= c1.close && c0.close >= c1.open) {
      results.push(this.makePattern('engulfing_bullish', '看涨吞没', 'bullish', 70,
        n - 2, n - 1, { entry: c0.close, stopLoss: Math.min(c1.low, c0.low), target: c0.close * 1.05 },
        true, '阳线实体完全吞没前一根阴线实体，强烈看涨信号'));
    }

    // Bearish engulfing
    if (c1.close > c1.open && c0.close < c0.open &&
        c0.open >= c1.close && c0.close <= c1.open) {
      results.push(this.makePattern('engulfing_bearish', '看跌吞没', 'bearish', 70,
        n - 2, n - 1, { entry: c0.close, stopLoss: Math.max(c1.high, c0.high), target: c0.close * 0.95 },
        true, '阴线实体完全吞没前一根阳线实体，强烈看跌信号'));
    }

    // Morning star (3-candle)
    if (n >= 3) {
      if (c2.close < c2.open && // Day 1: bearish
          Math.abs(c1.close - c1.open) < (c2.high - c2.low) * 0.3 && // Day 2: small body
          c0.close > c0.open && // Day 3: bullish
          c0.close > (c2.open + c2.close) / 2) {
        results.push(this.makePattern('morning_star', '晨星', 'bullish', 75,
          n - 3, n - 1, { entry: c0.close, target: c2.open, stopLoss: c1.low },
          true, '三日晨星反转形态：底部出现预示上涨'));
      }

      if (c2.close > c2.open && // Day 1: bullish
          Math.abs(c1.close - c1.open) < (c2.high - c2.low) * 0.3 && // Day 2: small body
          c0.close < c0.open && // Day 3: bearish
          c0.close < (c2.open + c2.close) / 2) {
        results.push(this.makePattern('evening_star', '黄昏星', 'bearish', 75,
          n - 3, n - 1, { entry: c0.close, target: c2.open, stopLoss: c1.high },
          true, '三日黄昏星反转形态：顶部出现预示下跌'));
      }
    }

    // Three White Soldiers / Three Black Crows
    if (n >= 3) {
      const bull1 = c2.close > c2.open;
      const bull2 = c1.close > c1.open && c1.close > c2.close && c1.open > c2.open;
      const bull3 = c0.close > c0.open && c0.close > c1.close && c0.open > c1.open;
      if (bull1 && bull2 && bull3) {
        results.push(this.makePattern('three_white_soldiers', '红三兵', 'bullish', 65,
          n - 3, n - 1, { entry: c0.close, target: c0.close * 1.08 },
          true, '连续三根阳线，每根收盘都高于前一根，上涨趋势确认'));
      }

      const bear1 = c2.close < c2.open;
      const bear2 = c1.close < c1.open && c1.close < c2.close && c1.open < c2.open;
      const bear3 = c0.close < c0.open && c0.close < c1.close && c0.open < c1.open;
      if (bear1 && bear2 && bear3) {
        results.push(this.makePattern('three_black_crows', '三只乌鸦', 'bearish', 65,
          n - 3, n - 1, { entry: c0.close, target: c0.close * 0.92 },
          true, '连续三根阴线，每根收盘都低于前一根，下跌趋势确认'));
      }
    }

    // Hammer
    const bodyC0 = c0.close - c0.open;
    const totalC0 = c0.high - c0.low;
    const lowerShadow = Math.min(c0.open, c0.close) - c0.low;
    if (totalC0 > 0 && lowerShadow > bodyC0 * 2 && bodyC0 < totalC0 * 0.3) {
      results.push(this.makePattern('hammer', '锤子线', 'bullish', 55,
        n - 1, n - 1, { entry: c0.close, stopLoss: c0.low, target: c0.close * 1.03 },
        true, '长下影线小实体：底部反转信号'));
    }

    // Shooting star
    const upperShadow = c0.high - Math.max(c0.open, c0.close);
    if (totalC0 > 0 && upperShadow > bodyC0 * 2 && bodyC0 < totalC0 * 0.3) {
      results.push(this.makePattern('shooting_star', '射击之星', 'bearish', 55,
        n - 1, n - 1, { entry: c0.close, stopLoss: c0.high, target: c0.close * 0.97 },
        true, '长上影线小实体：顶部反转信号'));
    }

    // Doji
    if (totalC0 > 0 && Math.abs(bodyC0) < totalC0 * 0.1) {
      results.push(this.makePattern('doji', '十字星', 'neutral', 30,
        n - 1, n - 1, { entry: c0.close },
        true, '开盘价≈收盘价：市场犹豫不决，变盘前兆'));
    }

    // Marubozu (long body, tiny shadows)
    if (Math.abs(bodyC0) > totalC0 * 0.8) {
      const dir = bodyC0 > 0 ? 'bullish' : 'bearish';
      results.push(this.makePattern('marubozu', bodyC0 > 0 ? '光头光脚阳线' : '光头光脚阴线', dir, 45,
        n - 1, n - 1, { entry: c0.close },
        true, '实体极长无影线：趋势强劲'));
    }

    return results;
  }

  // ═══════════ Head & Shoulders ═══════════

  private detectHeadShoulders(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const peaks = swings.filter((s) => s.type === 'peak');
    const troughs = swings.filter((s) => s.type === 'trough');

    // Head & Shoulders Top: 3 peaks, middle highest
    for (let i = 1; i < peaks.length - 1; i++) {
      const left = peaks[i - 1], head = peaks[i], right = peaks[i + 1];
      if (head.price > left.price && head.price > right.price &&
          Math.abs(left.price - right.price) / left.price < this.config.levelTolerance) {
        // Find neckline (troughs between peaks)
        const leftTrough = this.findTroughBetween(troughs, left.index, head.index);
        const rightTrough = this.findTroughBetween(troughs, head.index, right.index);
        if (leftTrough && rightTrough) {
          const neckline = (leftTrough.price + rightTrough.price) / 2;
          const target = neckline - (head.price - neckline);
          results.push(this.makePattern('head_shoulders_top', '头肩顶', 'bearish', 85,
            left.index, right.index,
            { neckline, target, entry: rightTrough.price, stopLoss: head.price },
            true, '经典头肩顶反转形态：三个峰值中间最高，颈线突破确认'));
        }
      }
    }

    // Head & Shoulders Bottom: 3 troughs, middle lowest
    for (let i = 1; i < troughs.length - 1; i++) {
      const left = troughs[i - 1], head = troughs[i], right = troughs[i + 1];
      if (head.price < left.price && head.price < right.price &&
          Math.abs(left.price - right.price) / left.price < this.config.levelTolerance) {
        const leftPeak = this.findPeakBetween(peaks, left.index, head.index);
        const rightPeak = this.findPeakBetween(peaks, head.index, right.index);
        if (leftPeak && rightPeak) {
          const neckline = (leftPeak.price + rightPeak.price) / 2;
          const target = neckline + (neckline - head.price);
          results.push(this.makePattern('head_shoulders_bottom', '头肩底', 'bullish', 85,
            left.index, right.index,
            { neckline, target, entry: rightPeak.price, stopLoss: head.price },
            true, '经典头肩底反转形态：三个谷值中间最低，颈线突破确认'));
        }
      }
    }

    return results;
  }

  // ═══════════ Double Top / Bottom ═══════════

  private detectDoubleTopBottom(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const peaks = swings.filter((s) => s.type === 'peak');
    const troughs = swings.filter((s) => s.type === 'trough');

    // Double Top
    for (let i = 0; i < peaks.length - 1; i++) {
      const p1 = peaks[i], p2 = peaks[i + 1];
      if (Math.abs(p1.price - p2.price) / p1.price < this.config.levelTolerance &&
          p2.index - p1.index > this.config.minSwingDistance) {
        const between = this.findTroughBetween(troughs, p1.index, p2.index);
        if (between) {
          const target = between.price - (p1.price - between.price);
          results.push(this.makePattern('double_top', '双顶(M头)', 'bearish', 80,
            p1.index, p2.index,
            { neckline: between.price, target, entry: between.price, stopLoss: Math.max(p1.price, p2.price) },
            true, '价格两次冲击同一高位失败：典型的顶部反转信号'));
        }
      }
    }

    // Double Bottom
    for (let i = 0; i < troughs.length - 1; i++) {
      const t1 = troughs[i], t2 = troughs[i + 1];
      if (Math.abs(t1.price - t2.price) / t1.price < this.config.levelTolerance &&
          t2.index - t1.index > this.config.minSwingDistance) {
        const between = this.findPeakBetween(peaks, t1.index, t2.index);
        if (between) {
          const target = between.price + (between.price - t1.price);
          results.push(this.makePattern('double_bottom', '双底(W底)', 'bullish', 80,
            t1.index, t2.index,
            { neckline: between.price, target, entry: between.price, stopLoss: Math.min(t1.price, t2.price) },
            true, '价格两次探底获得支撑：典型的底部反转信号'));
        }
      }
    }

    return results;
  }

  // ═══════════ Triple Top / Bottom ═══════════

  private detectTripleTopBottom(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const peaks = swings.filter((s) => s.type === 'peak');
    const troughs = swings.filter((s) => s.type === 'trough');

    for (let i = 0; i < peaks.length - 2; i++) {
      const p1 = peaks[i], p2 = peaks[i + 1], p3 = peaks[i + 2];
      const avg = (p1.price + p2.price + p3.price) / 3;
      if (Math.abs(p1.price - avg) / avg < this.config.levelTolerance &&
          Math.abs(p2.price - avg) / avg < this.config.levelTolerance &&
          Math.abs(p3.price - avg) / avg < this.config.levelTolerance) {
        results.push(this.makePattern('triple_top', '三重顶', 'bearish', 90,
          p1.index, p3.index, { entry: p3.price, target: avg * 0.9 },
          true, '价格三次冲击同一区域失败：强阻力确认'));
        break;
      }
    }

    for (let i = 0; i < troughs.length - 2; i++) {
      const t1 = troughs[i], t2 = troughs[i + 1], t3 = troughs[i + 2];
      const avg = (t1.price + t2.price + t3.price) / 3;
      if (Math.abs(t1.price - avg) / avg < this.config.levelTolerance &&
          Math.abs(t2.price - avg) / avg < this.config.levelTolerance &&
          Math.abs(t3.price - avg) / avg < this.config.levelTolerance) {
        results.push(this.makePattern('triple_bottom', '三重底', 'bullish', 90,
          t1.index, t3.index, { entry: t3.price, target: avg * 1.1 },
          true, '价格三次探底获得支撑：强支撑确认'));
        break;
      }
    }

    return results;
  }

  // ═══════════ Triangles ═══════════

  private detectTriangles(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const recent = swings.slice(-12);
    const peaks = recent.filter((s) => s.type === 'peak');
    const troughs = recent.filter((s) => s.type === 'trough');

    if (peaks.length < 4 || troughs.length < 4) return results;

    // Compute slopes of peaks and troughs regression
    const peakSlope = this.regressionSlope(peaks.map((s) => s.index), peaks.map((s) => s.price));
    const troughSlope = this.regressionSlope(troughs.map((s) => s.index), troughs.map((s) => s.price));

    if (peakSlope < -0.01 && Math.abs(troughSlope) < 0.005) {
      results.push(this.makePattern('descending_triangle', '下降三角形', 'bearish', 70,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '高点不断降低但低点水平：看跌持续形态'));
    } else if (troughSlope > 0.01 && Math.abs(peakSlope) < 0.005) {
      results.push(this.makePattern('ascending_triangle', '上升三角形', 'bullish', 70,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '高点水平但低点不断抬高：看涨持续形态'));
    } else if (Math.abs(peakSlope + troughSlope) < Math.abs(peakSlope) * 0.3 && peakSlope < -0.005) {
      results.push(this.makePattern('symmetrical_triangle', '对称三角形', 'neutral', 60,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '高点降低低点抬高收敛：即将选择方向'));
    }

    return results;
  }

  // ═══════════ Flags / Pennants ═══════════

  private detectFlags(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const recent = swings.slice(-8);
    if (recent.length < 6) return results;

    // Flags: steep move followed by consolidation in opposite direction
    const first5 = recent.slice(0, 5);
    const last3 = recent.slice(-3);

    const firstDir = this.getDirection(first5);
    const lastDir = this.getDirection(last3);

    // Bull flag: up move, then slight pullback
    if (firstDir > 0 && lastDir < 0) {
      results.push(this.makePattern('bull_flag', '上升旗形', 'bullish', 65,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '快速上升后小幅回落：典型的上涨中继形态'));
    }

    // Bear flag: down move, then slight bounce
    if (firstDir < 0 && lastDir > 0) {
      results.push(this.makePattern('bear_flag', '下降旗形', 'bearish', 65,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '快速下跌后小幅反弹：典型的下跌中继形态'));
    }

    return results;
  }

  // ═══════════ Wedges ═══════════

  private detectWedges(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const recent = swings.slice(-10);
    const peaks = recent.filter((s) => s.type === 'peak');
    const troughs = recent.filter((s) => s.type === 'trough');
    if (peaks.length < 4 || troughs.length < 4) return results;

    const peakSlope = this.regressionSlope(peaks.map((s) => s.index), peaks.map((s) => s.price));
    const troughSlope = this.regressionSlope(troughs.map((s) => s.index), troughs.map((s) => s.price));

    // Both sloping in same direction = wedge
    if (peakSlope < -0.01 && troughSlope < -0.01 && peakSlope < troughSlope) {
      results.push(this.makePattern('falling_wedge', '下降楔形', 'bullish', 70,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '高低点均下降但下轨更陡：向上突破概率大'));
    }
    if (peakSlope > 0.01 && troughSlope > 0.01 && troughSlope > peakSlope) {
      results.push(this.makePattern('rising_wedge', '上升楔形', 'bearish', 70,
        recent[0].index, recent[recent.length - 1].index, {},
        true, '高低点均上升但上轨更缓：向下突破概率大'));
    }

    return results;
  }

  // ═══════════ Rounding ═══════════

  private detectRounding(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const peaks = swings.filter((s) => s.type === 'peak');
    const troughs = swings.filter((s) => s.type === 'trough');

    // Rounding bottom: gradual decline → flat bottom → gradual rise
    if (troughs.length >= 5) {
      const last5t = troughs.slice(-5);
      const prices = last5t.map((s) => s.price);
      // U-shape: middle lower than edges
      const mid = Math.floor(prices.length / 2);
      if (prices[mid] < prices[0] && prices[mid] < prices[prices.length - 1]) {
        results.push(this.makePattern('rounding_bottom', '圆弧底', 'bullish', 75,
          last5t[0].index, last5t[last5t.length - 1].index, {},
          true, '价格曲线呈现U形：底部盘整后缓慢回升'));
      }
    }

    if (peaks.length >= 5) {
      const last5p = peaks.slice(-5);
      const prices = last5p.map((s) => s.price);
      const mid = Math.floor(prices.length / 2);
      if (prices[mid] > prices[0] && prices[mid] > prices[prices.length - 1]) {
        results.push(this.makePattern('rounding_top', '圆弧顶', 'bearish', 75,
          last5p[0].index, last5p[last5p.length - 1].index, {},
          true, '价格曲线呈现倒U形：顶部滞涨后缓慢回落'));
      }
    }

    return results;
  }

  // ═══════════ Cup & Handle ═══════════

  private detectCupHandle(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    if (swings.length < 6) return results;

    // Cup: U-shaped recovery
    // Handle: small downward drift after the cup
    const peaks = swings.filter((s) => s.type === 'peak');
    const troughs = swings.filter((s) => s.type === 'trough');

    if (troughs.length >= 3 && peaks.length >= 2) {
      const lastTrough = troughs[troughs.length - 1];
      const firstPeak = peaks[peaks.length - 2];
      const lastPeak = peaks[peaks.length - 1];

      // Cup handle: last trough > previous trough, last peak < previous peak
      if (lastTrough.price > troughs[troughs.length - 2].price &&
          Math.abs(lastPeak.price - firstPeak.price) / firstPeak.price < this.config.levelTolerance) {
        results.push(this.makePattern('cup_handle', '杯柄形态', 'bullish', 80,
          firstPeak.index, lastPeak.index,
          { entry: firstPeak.price, target: firstPeak.price * 1.1, stopLoss: lastTrough.price },
          true, '经典杯柄形态：U型杯身+小幅回调手柄，向上突破在即'));
      }
    }

    return results;
  }

  // ═══════════ Island Reversal ═══════════

  private detectIsland(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const n = this.bars.length;
    if (n < 5) return results;

    // Island: gap up → consolidation → gap down (or reverse)
    // Simplified: check for price gaps on both sides of a consolidation range
    for (let i = 2; i < n - 2; i++) {
      const prevLow = this.bars[i - 1].low;
      const prevHigh = this.bars[i - 1].high;
      const currLow = this.bars[i].low;
      const currHigh = this.bars[i].high;
      const nextLow = this.bars[i + 1].low;
      const nextHigh = this.bars[i + 1].high;

      // Island top: gap up before, gap down after
      if (currLow > prevHigh && currLow - prevHigh > (currHigh - currLow) * 0.5 &&
          nextLow < currLow) {
        results.push(this.makePattern('island_top', '岛形顶', 'bearish', 85,
          i - 1, i + 1, { entry: nextLow },
          true, '向上跳空后向下跳空，形成孤立价格区间：强烈顶部反转'));
      }

      // Island bottom: gap down before, gap up after
      if (currHigh < prevLow && prevLow - currHigh > (currHigh - currLow) * 0.5 &&
          nextHigh > currHigh) {
        results.push(this.makePattern('island_bottom', '岛形底', 'bullish', 85,
          i - 1, i + 1, { entry: nextHigh },
          true, '向下跳空后向上跳空，形成孤立价格区间：强烈底部反转'));
      }
    }

    return results;
  }

  // ═══════════ Broadening Formation ═══════════

  private detectBroadening(swings: SwingPoint[]): PatternMatch[] {
    const results: PatternMatch[] = [];
    const peaks = swings.filter((s) => s.type === 'peak');
    const troughs = swings.filter((s) => s.type === 'trough');

    if (peaks.length < 4 && troughs.length < 4) return results;

    const peakSlope = this.regressionSlope(peaks.slice(-4).map((s) => s.index), peaks.slice(-4).map((s) => s.price));
    const troughSlope = this.regressionSlope(troughs.slice(-4).map((s) => s.index), troughs.slice(-4).map((s) => s.price));

    // Broadening: peaks going up AND troughs going down (expanding)
    if (peakSlope > 0.02 && troughSlope < -0.02) {
      results.push(this.makePattern('broadening_top', '扩散三角形(喇叭口)', 'bearish', 65,
        swings[0].index, swings[swings.length - 1].index, {},
        true, '高低点均向外扩散：市场情绪极度不稳定，通常顶部信号'));
    }

    return results;
  }

  // ═══════════ Helpers ═══════════

  private findTroughBetween(troughs: SwingPoint[], startIdx: number, endIdx: number): SwingPoint | null {
    const between = troughs.filter((t) => t.index > startIdx && t.index < endIdx);
    if (between.length === 0) return null;
    return between.reduce((best, t) => t.price < best.price ? t : best);
  }

  private findPeakBetween(peaks: SwingPoint[], startIdx: number, endIdx: number): SwingPoint | null {
    const between = peaks.filter((p) => p.index > startIdx && p.index < endIdx);
    if (between.length === 0) return null;
    return between.reduce((best, p) => p.price > best.price ? p : best);
  }

  private regressionSlope(xs: number[], ys: number[]): number {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return 0;
    const meanX = xs.reduce((s, v) => s + v, 0) / n;
    const meanY = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    return den > 0 ? num / den : 0;
  }

  private getDirection(swings: SwingPoint[]): number {
    if (swings.length < 2) return 0;
    const first = swings[0].price;
    const last = swings[swings.length - 1].price;
    return last - first;
  }

  private makePattern(
    pattern: PatternType, name: string, direction: 'bullish' | 'bearish' | 'neutral',
    reliability: number, startIdx: number, endIdx: number,
    priceLevels: PatternMatch['priceLevels'],
    completed: boolean, description: string,
  ): PatternMatch {
    return {
      pattern, name, direction, reliability,
      startIndex: startIdx, endIndex: endIdx,
      priceLevels: {
        neckline: priceLevels.neckline,
        target: priceLevels.target,
        entry: priceLevels.entry,
        stopLoss: priceLevels.stopLoss,
        takeProfit: priceLevels.takeProfit,
      },
      completion: completed ? 100 : 70,
      completed,
      description,
    };
  }
}

// ═══════════ Singleton ═══════════

let pr21Instance: PatternRecognition21Engine | null = null;

export function getPatternRecognition21Engine(config?: PatternConfig): PatternRecognition21Engine {
  if (!pr21Instance) pr21Instance = new PatternRecognition21Engine(config);
  return pr21Instance;
}

export function resetPatternRecognition21Engine(): void {
  pr21Instance = null;
}
