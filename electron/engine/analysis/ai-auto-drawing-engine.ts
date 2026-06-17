// ── R266 JVS-3 AI 自动画线引擎 (AIAutoDrawingEngine) ──
// 自动识别关键支撑/阻力/趋势线/通道 — 基于 swing high/low 算法
// 对标 TradingView 自动画线 + 富途智能画线
// 定价: 1 USDT/次 (AI自动画线)

export interface OHLCBar {
  timestamp: number;  // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SwingPoint {
  timestamp: number;
  price: number;
  type: 'high' | 'low';
  strength: number;  // 0-100, higher = more significant swing
  barIndex: number;
}

export interface TrendLine {
  id: string;
  type: 'support' | 'resistance' | 'trendline' | 'channel_top' | 'channel_bottom';
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
  /** Slope in price per millisecond */
  slope: number;
  /** Number of touch points confirming the line */
  touches: number;
  /** Strength / reliability 0-100 */
  strength: number;
  /** Whether the line is still active (not broken) */
  active: boolean;
  /** R² of the linear regression through touch points */
  r2: number;
}

export interface HorizontalLevel {
  price: number;
  type: 'support' | 'resistance';
  touches: number;
  strength: number;
  /** Most recent touch timestamps */
  recentTouches: number[];
  /** Whether still valid */
  active: boolean;
  /** Role: recently flipped S→R or R→S */
  roleFlip: boolean;
}

export interface Channel {
  topLine: TrendLine;
  bottomLine: TrendLine;
  /** Channel width as % of midpoint */
  widthPct: number;
  /** Current price position within channel (0=bottom, 100=top) */
  pricePosition: number;
}

export interface AutoDrawingResult {
  symbol: string;
  generatedAt: number;
  /** Horizontal support/resistance levels */
  horizontalLevels: HorizontalLevel[];
  /** Diagonal trendlines */
  trendLines: TrendLine[];
  /** Parallel channels */
  channels: Channel[];
  /** Key swing points */
  swingPoints: SwingPoint[];
  /** Trading suggestion based on drawn lines */
  suggestion: string;
  /** Billing */
  billingUnits: number;
}

export interface AutoDrawingConfig {
  /** Lookback bars for swing detection */
  lookbackBars?: number;
  /** Min bars between swing points */
  minSwingDistance?: number;
  /** Min touches to confirm a line */
  minTouches?: number;
  /** Tolerance for price "touching" a line (as fraction) */
  touchTolerance?: number;
  /** R² threshold for valid regression line */
  minR2?: number;
  /** Max trendlines to return */
  maxTrendLines?: number;
  /** Max horizontal levels */
  maxHorizontalLevels?: number;
}

export const DEFAULT_AUTO_DRAWING_CONFIG: Required<AutoDrawingConfig> = {
  lookbackBars: 200,
  minSwingDistance: 5,
  minTouches: 2,
  touchTolerance: 0.005, // 0.5%
  minR2: 0.7,
  maxTrendLines: 6,
  maxHorizontalLevels: 8,
};

// ═══════════════════════════════════════════════════════════
// AI Auto Drawing Engine
// ═══════════════════════════════════════════════════════════

export class AIAutoDrawingEngine {
  private config: Required<AutoDrawingConfig>;
  private bars: OHLCBar[] = [];
  private idCounter = 0;

  constructor(config?: AutoDrawingConfig) {
    this.config = { ...DEFAULT_AUTO_DRAWING_CONFIG, ...config };
  }

  reset(): void {
    this.bars = [];
    this.idCounter = 0;
  }

  getConfig(): Required<AutoDrawingConfig> {
    return { ...this.config };
  }

  updateConfig(patch: Partial<AutoDrawingConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  loadBars(bars: OHLCBar[]): void {
    this.bars = [...bars].sort((a, b) => a.timestamp - b.timestamp);
  }

  getBarCount(): number {
    return this.bars.length;
  }

  private nextId(): string {
    return `ad-${++this.idCounter}-${Date.now().toString(36)}`;
  }

  // ═══════════ Swing Point Detection ═══════════

  /**
   * Detect swing high and swing low points using local extrema.
   * A swing high: bar.high > N bars before AND after.
   * A swing low: bar.low < N bars before AND after.
   */
  detectSwingPoints(minDistance?: number): SwingPoint[] {
    const distance = minDistance || this.config.minSwingDistance;
    if (this.bars.length < distance * 3) return [];

    const swings: SwingPoint[] = [];
    const len = this.bars.length;

    for (let i = distance; i < len - distance; i++) {
      const bar = this.bars[i];

      // Check swing high
      let isSwingHigh = true;
      let highStrength = 0;
      for (let j = i - distance; j <= i + distance; j++) {
        if (j === i) continue;
        if (this.bars[j].high >= bar.high) {
          isSwingHigh = false;
          break;
        }
        // accumulate strength: how much higher
        highStrength += (bar.high - this.bars[j].high) / bar.high;
      }
      if (isSwingHigh) {
        const strength = Math.min(100, Math.round(Math.abs(highStrength) * 1000));
        swings.push({
          timestamp: bar.timestamp,
          price: bar.high,
          type: 'high',
          strength,
          barIndex: i,
        });
      }

      // Check swing low
      let isSwingLow = true;
      let lowStrength = 0;
      for (let j = i - distance; j <= i + distance; j++) {
        if (j === i) continue;
        if (this.bars[j].low <= bar.low) {
          isSwingLow = false;
          break;
        }
        lowStrength += (this.bars[j].low - bar.low) / bar.low;
      }
      if (isSwingLow) {
        const strength = Math.min(100, Math.round(Math.abs(lowStrength) * 1000));
        swings.push({
          timestamp: bar.timestamp,
          price: bar.low,
          type: 'low',
          strength,
          barIndex: i,
        });
      }
    }

    // Sort by bar index
    swings.sort((a, b) => a.barIndex - b.barIndex);
    return swings;
  }

  // ═══════════ Horizontal Support / Resistance ═══════════

  /**
   * Find horizontal support and resistance from swing points.
   * Groups nearby swing points into levels.
   */
  findHorizontalLevels(swings?: SwingPoint[]): HorizontalLevel[] {
    const points = swings || this.detectSwingPoints();
    if (points.length === 0) return [];

    const { touchTolerance } = this.config;

    // Group swing highs into resistance, swing lows into support
    const levels: Map<number, { type: 'support' | 'resistance'; touches: number; timestamps: number[]; strengths: number[] }> = new Map();

    for (const sp of points) {
      // Find the nearest existing level
      let matchedKey: number | null = null;
      for (const [price] of levels.entries()) {
        const deviation = Math.abs(sp.price - price) / price;
        if (deviation <= touchTolerance) {
          matchedKey = price;
          break;
        }
      }

      if (matchedKey !== null) {
        const level = levels.get(matchedKey)!;
        level.touches++;
        level.timestamps.push(sp.timestamp);
        level.strengths.push(sp.strength);
      } else {
        levels.set(sp.price, {
          type: sp.type === 'high' ? 'resistance' : 'support',
          touches: 1,
          timestamps: [sp.timestamp],
          strengths: [sp.strength],
        });
      }
    }

    // Convert to sorted array, filter by min touches
    const result: HorizontalLevel[] = [];
    const currentPrice = this.bars.length > 0 ? this.bars[this.bars.length - 1].close : 0;

    for (const [price, data] of levels.entries()) {
      const avgStrength = data.strengths.reduce((s, v) => s + v, 0) / data.strengths.length;
      const recentTouches = data.timestamps.slice(-5);
      // Determine if level flipped role (support → resistance or vice versa)
      const roleFlip = this.detectRoleFlip(Number(price), data.type, points);

      result.push({
        price: Math.round(Number(price) * 10000) / 10000,
        type: data.type,
        touches: data.touches,
        strength: Math.min(100, Math.round(avgStrength + data.touches * 5)),
        recentTouches,
        active: true,
        roleFlip,
      });
    }

    // Sort: resistance high→low, support low→high
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'resistance' ? -1 : 1;
      return a.type === 'resistance' ? b.price - a.price : a.price - b.price;
    });

    return result.slice(0, this.config.maxHorizontalLevels);
  }

  /**
   * Detect if a level has flipped role (S→R or R→S)
   * If price crossed a support level and is now below it → flipped to resistance
   */
  private detectRoleFlip(
    price: number,
    originalType: 'support' | 'resistance',
    swings: SwingPoint[],
  ): boolean {
    const currentPrice = this.bars.length > 0 ? this.bars[this.bars.length - 1].close : 0;
    if (currentPrice === 0) return false;

    const crossedBelow = currentPrice < price && originalType === 'support';
    const crossedAbove = currentPrice > price && originalType === 'resistance';

    return crossedBelow || crossedAbove;
  }

  // ═══════════ Trend Line Detection ═══════════

  /**
   * Find diagonal trendlines by connecting swing points.
   * Uses linear regression and validates with touch counts.
   */
  findTrendLines(swings?: SwingPoint[]): TrendLine[] {
    const points = swings || this.detectSwingPoints();
    if (points.length < 4) return [];

    const { minTouches, touchTolerance, minR2, maxTrendLines } = this.config;
    const lines: TrendLine[] = [];
    const swingHighs = points.filter((p) => p.type === 'high');
    const swingLows = points.filter((p) => p.type === 'low');

    // Try connecting every pair of swing highs (resistance trendlines)
    for (let i = 0; i < swingHighs.length - 1; i++) {
      for (let j = i + 1; j < swingHighs.length; j++) {
        const line = this.buildTrendLine(swingHighs[i], swingHighs[j], swingHighs, 'resistance');
        if (line && line.touches >= minTouches && line.r2 >= minR2) {
          lines.push(line);
        }
      }
    }

    // Try connecting every pair of swing lows (support trendlines)
    for (let i = 0; i < swingLows.length - 1; i++) {
      for (let j = i + 1; j < swingLows.length; j++) {
        const line = this.buildTrendLine(swingLows[i], swingLows[j], swingLows, 'support');
        if (line && line.touches >= minTouches && line.r2 >= minR2) {
          lines.push(line);
        }
      }
    }

    // Deduplicate: keep lines with most touches
    const deduped: TrendLine[] = [];
    const used = new Set<string>();

    lines.sort((a, b) => b.touches - a.touches);
    for (const line of lines) {
      const key = `${Math.round(line.slope * 1e10)}-${Math.round(line.startPrice)}`;
      if (!used.has(key)) {
        used.add(key);
        deduped.push(line);
      }
      if (deduped.length >= maxTrendLines) break;
    }

    return deduped;
  }

  private buildTrendLine(
    p1: SwingPoint,
    p2: SwingPoint,
    allPoints: SwingPoint[],
    lineType: 'support' | 'resistance',
  ): TrendLine | null {
    if (p2.timestamp === p1.timestamp) return null;

    const slope = (p2.price - p1.price) / (p2.timestamp - p1.timestamp);
    const { touchTolerance } = this.config;

    // Collect all touch points
    const touches: SwingPoint[] = [p1, p2];

    for (const sp of allPoints) {
      if (sp === p1 || sp === p2) continue;
      if (sp.type !== p1.type) continue; // same type only

      // Calculate expected price at sp's timestamp on the line
      const expectedPrice = p1.price + slope * (sp.timestamp - p1.timestamp);
      const deviation = Math.abs(sp.price - expectedPrice) / expectedPrice;

      if (deviation <= touchTolerance) {
        touches.push(sp);
      }
    }

    if (touches.length < 2) return null;

    // Calculate R² for linear regression through touch points
    const touchTimes = touches.map((t) => t.timestamp);
    const touchPrices = touches.map((t) => t.price);
    const r2 = this.calculateR2(touchTimes, touchPrices);

    // Determine if line is still active
    const currentPrice = this.bars.length > 0 ? this.bars[this.bars.length - 1].close : 0;
    const lastBarTime = this.bars.length > 0 ? this.bars[this.bars.length - 1].timestamp : 0;
    const expectedCurrentPrice = p1.price + slope * (lastBarTime - p1.timestamp);
    const currentDeviation = Math.abs(currentPrice - expectedCurrentPrice) / expectedCurrentPrice;

    const active = lineType === 'support'
      ? currentPrice > expectedCurrentPrice - expectedCurrentPrice * touchTolerance
      : currentPrice < expectedCurrentPrice + expectedCurrentPrice * touchTolerance;

    // Strength: based on touch count, time span, and R²
    const timeSpan = (touches[touches.length - 1].timestamp - touches[0].timestamp) / (1000 * 3600 * 24); // days
    const strength = Math.min(100, Math.round(
      touches.length * 15 + Math.min(timeSpan, 30) * 2 + r2 * 30,
    ));

    const startT = touches[0];
    const endT = touches[touches.length - 1];
    const endExpectedPrice = p1.price + slope * (endT.timestamp - p1.timestamp);

    return {
      id: this.nextId(),
      type: lineType === 'support' ? 'trendline' : 'trendline',
      startTime: startT.timestamp,
      startPrice: startT.price,
      endTime: endT.timestamp,
      endPrice: endExpectedPrice,
      slope,
      touches: touches.length,
      strength,
      active,
      r2: Math.round(r2 * 1000) / 1000,
    };
  }

  private calculateR2(xs: number[], ys: number[]): number {
    if (xs.length < 2) return 0;
    const n = xs.length;
    const meanX = xs.reduce((s, x) => s + x, 0) / n;
    const meanY = ys.reduce((s, y) => s + y, 0) / n;

    let ssXX = 0;
    let ssYY = 0;
    let ssXY = 0;
    for (let i = 0; i < n; i++) {
      ssXX += (xs[i] - meanX) ** 2;
      ssYY += (ys[i] - meanY) ** 2;
      ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    }

    if (ssXX === 0 || ssYY === 0) return 0;
    const r = ssXY / Math.sqrt(ssXX * ssYY);
    return r * r;
  }

  // ═══════════ Channel Detection ═══════════

  /**
   * Detect parallel channels by pairing support and resistance trendlines.
   */
  findChannels(trendLines?: TrendLine[]): Channel[] {
    const lines = trendLines || this.findTrendLines();
    const channels: Channel[] = [];

    const supportLines = lines.filter((l) =>
      l.touches >= 2 && l.slope !== undefined && (l.type === 'trendline' || l.type === 'support'),
    );
    const resistanceLines = lines.filter((l) =>
      l.touches >= 2 && l.slope !== undefined && (l.type === 'trendline' || l.type === 'resistance'),
    );

    for (const top of resistanceLines) {
      for (const bottom of supportLines) {
        // Check if slopes are similar (parallel)
        const slopeDiff = Math.abs(top.slope - bottom.slope);
        const avgSlope = (Math.abs(top.slope) + Math.abs(bottom.slope)) / 2 || 1e-10;

        if (slopeDiff / avgSlope < 0.2) {
          // Channels should have top > bottom
          const midPrice = (top.startPrice + bottom.startPrice) / 2;
          const width = top.startPrice - bottom.startPrice;
          const widthPct = (width / midPrice) * 100;

          if (widthPct > 0.5 && widthPct < 50) {
            // Reasonable channel width
            const currentPrice = this.bars.length > 0 ? this.bars[this.bars.length - 1].close : 0;
            const pricePosition = midPrice > 0
              ? Math.max(0, Math.min(100, ((currentPrice - bottom.startPrice) / width) * 100))
              : 50;

            channels.push({
              topLine: { ...top, type: 'channel_top' },
              bottomLine: { ...bottom, type: 'channel_bottom' },
              widthPct: Math.round(widthPct * 100) / 100,
              pricePosition: Math.round(pricePosition * 100) / 100,
            });
          }
        }
      }
    }

    // Deduplicate and limit
    return channels.slice(0, 3);
  }

  // ═══════════ Full Analysis ═══════════

  /**
   * Run full auto-drawing analysis: swing points → horizontal levels → trendlines → channels.
   */
  analyze(symbol: string = ''): AutoDrawingResult {
    const swingPoints = this.detectSwingPoints();
    const horizontalLevels = this.findHorizontalLevels(swingPoints);
    const trendLines = this.findTrendLines(swingPoints);
    const channels = this.findChannels(trendLines);

    // Generate suggestion
    let suggestion = '';
    const currentPrice = this.bars.length > 0 ? this.bars[this.bars.length - 1].close : 0;
    const nearestSupport = horizontalLevels
      .filter((l) => l.type === 'support' && l.price < currentPrice)
      .sort((a, b) => b.price - a.price)[0];
    const nearestResistance = horizontalLevels
      .filter((l) => l.type === 'resistance' && l.price > currentPrice)
      .sort((a, b) => a.price - b.price)[0];

    if (nearestSupport && nearestResistance) {
      const supportDist = ((currentPrice - nearestSupport.price) / currentPrice) * 100;
      const resistDist = ((nearestResistance.price - currentPrice) / currentPrice) * 100;

      if (supportDist < resistDist) {
        suggestion = `价格更接近支撑位 ${nearestSupport.price}（距离 ${supportDist.toFixed(1)}%），止损可设其下方。上方阻力在 ${nearestResistance.price}`;
      } else {
        suggestion = `价格更接近阻力位 ${nearestResistance.price}（距离 ${resistDist.toFixed(1)}%），突破则看高一线。下方支撑在 ${nearestSupport.price}`;
      }
    } else if (nearestSupport) {
      suggestion = `当前无明确上方阻力，最近支撑在 ${nearestSupport.price}，可依托此位做多`;
    } else if (nearestResistance) {
      suggestion = `当前无明确下方支撑，最近阻力在 ${nearestResistance.price}，需警惕回调风险`;
    } else if (trendLines.length > 0) {
      const bestLine = trendLines[0];
      suggestion = `无显著水平支撑阻力，关注趋势线（${bestLine.touches} 点确认），斜率方向${bestLine.slope > 0 ? '向上' : '向下'}`;
    } else {
      suggestion = '当前价格区域无明显技术参考位，建议结合更大周期分析';
    }

    return {
      symbol,
      generatedAt: Date.now(),
      horizontalLevels,
      trendLines,
      channels,
      swingPoints: swingPoints.slice(-20), // last 20 swing points
      suggestion,
      billingUnits: 1,
    };
  }
}

// ═══════════ Singleton ═══════════

let drawingInstance: AIAutoDrawingEngine | null = null;

export function getAIAutoDrawingEngine(config?: AutoDrawingConfig): AIAutoDrawingEngine {
  if (!drawingInstance) {
    drawingInstance = new AIAutoDrawingEngine(config);
  } else if (config) {
    drawingInstance.updateConfig(config);
  }
  return drawingInstance;
}

export function resetAIAutoDrawingEngine(): void {
  if (drawingInstance) {
    drawingInstance.reset();
    drawingInstance = null;
  }
}
