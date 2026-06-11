// ── J-73-02 R73 V19: AI Drawing Engine ────────────────────────────────────
import i18n from '../../../src/i18n';
// Auto-detects trend lines, support/resistance, channels, Fibonacci, Gann
// Price-based geometric pattern recognition for K-line overlay

export type DrawLineType = "trend_line" | "support" | "resistance" | "channel_top" | "channel_bottom" | "fibonacci" | "gann_line";

export interface DrawPoint {
  x: number; // bar index (0 = most recent)
  y: number; // price
  time: number; // epoch ms
}

export interface AILine {
  id: string;
  type: DrawLineType;
  label: string;
  confidence: number; // 0-1
  points: DrawPoint[]; // 2+ points defining the line
  color: string; // hex
  dashStyle: "solid" | "dashed" | "dotted";
  thickness: number; // px
  extendRight: boolean; // project into future
  extendLeft: boolean;
  userModified: boolean;
  createdAt: number;
}

export interface FibonacciLevel {
  level: number; // 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618
  price: number;
  label: string;
  type: "retracement" | "extension";
}

export interface FibonacciDrawing {
  id: string;
  start: DrawPoint; // swing low
  end: DrawPoint; // swing high
  levels: FibonacciLevel[];
  confidence: number;
  createdAt: number;
}

export interface GannFan {
  id: string;
  pivot: DrawPoint;
  angles: { angle: number; label: string; priceAtBar: (barIndex: number) => number }[];
  confidence: number;
  createdAt: number;
}

// ── K-line data input ─────────────────────────────────────────────────────

export interface KlineDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Swing Point Detection ─────────────────────────────────────────────────

interface SwingPoint {
  index: number;
  price: number;
  time: number;
  type: "high" | "low";
  strength: number; // 0-1, how strong the swing is (candle count + price deviation)
}

function detectSwingPoints(klines: KlineDataPoint[], minStrength = 0.3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  const lookback = 3; // must be higher/lower than 3 candles on each side

  for (let i = lookback; i < klines.length - lookback; i++) {
    const candle = klines[i];

    // Check if local high
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (klines[i - j].high >= candle.high || klines[i + j].high >= candle.high) isHigh = false;
      if (klines[i - j].low <= candle.low || klines[i + j].low <= candle.low) isLow = false;
    }

    if (isHigh) {
      const strength = computeSwingStrength(klines, i, "high", lookback);
      if (strength >= minStrength) {
        swings.push({ index: i, price: candle.high, time: candle.time, type: "high", strength });
      }
    }
    if (isLow) {
      const strength = computeSwingStrength(klines, i, "low", lookback);
      if (strength >= minStrength) {
        swings.push({ index: i, price: candle.low, time: candle.time, type: "low", strength });
      }
    }
  }

  return swings.sort((a, b) => a.index - b.index);
}

function computeSwingStrength(klines: KlineDataPoint[], index: number, type: "high" | "low", lookback: number): number {
  const price = type === "high" ? klines[index].high : klines[index].low;
  let deviation = 0;
  for (let j = 1; j <= lookback; j++) {
    const comp = type === "high" ? klines[index - j].high : klines[index - j].low;
    deviation += Math.abs(price - comp) / price;
  }
  // Scale: random walk has ~2% deviation per 3 bars → ~0.2 with *10 scaling
  return Math.min(1, deviation / lookback * 5);
}

// ── Trend Line Detection ──────────────────────────────────────────────────

function detectTrendLines(klines: KlineDataPoint[], swings: SwingPoint[]): AILine[] {
  const lines: AILine[] = [];
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  // Find trend lines: connect 2+ swing highs (downtrend) or 2+ swing lows (uptrend)
  lines.push(...connectSwings(klines, lows, "trend_line", 2, "#26a69a", "solid")); // green uptrend
  lines.push(...connectSwings(klines, highs, "trend_line", 2, "#ef5350", "dashed")); // red downtrend

  return lines;
}

function connectSwings(
  klines: KlineDataPoint[],
  swings: SwingPoint[],
  type: DrawLineType,
  minPoints: number,
  color: string,
  dash: "solid" | "dashed",
): AILine[] {
  const lines: AILine[] = [];
  if (swings.length < minPoints) return lines;

  // Try to link swings that form a reasonably straight line
  for (let i = 0; i < swings.length - 1; i++) {
    for (let j = i + 1; j < swings.length; j++) {
      const dx = swings[j].index - swings[i].index;
      if (dx < 3) continue; // too close, not meaningful

      const slope = (swings[j].price - swings[i].price) / dx;

      // Count how many other swings align with this line
      let aligned = 0;
      for (let k = 0; k < swings.length; k++) {
        if (k === i || k === j) continue;
        const expectedPrice = swings[i].price + slope * (swings[k].index - swings[i].index);
        const deviation = Math.abs(swings[k].price - expectedPrice) / swings[k].price;
        if (deviation < 0.01) aligned++; // within 1%
      }

      if (aligned >= 1) {
        // At least 1 other swing aligns
        const confidence = Math.min(1, (aligned + 1) / 5 * 1.5);
        lines.push({
          id: `tl-${type}-${i}-${j}`,
          type,
          label: type === "trend_line" ? i18n.t('AiDrawingEngine.k0') : type,
          confidence,
          points: [
            { x: swings[i].index, y: swings[i].price, time: swings[i].time },
            { x: swings[j].index, y: swings[j].price, time: swings[j].time },
          ],
          color,
          dashStyle: dash,
          thickness: 2,
          extendRight: true,
          extendLeft: false,
          userModified: false,
          createdAt: Date.now(),
        });
        break; // one good line per pair
      }
    }
  }

  return lines;
}

// ── Support / Resistance Detection ───────────────────────────────────────

function detectSupportResistance(klines: KlineDataPoint[], swings: SwingPoint[]): AILine[] {
  const lines: AILine[] = [];

  // Resistance = horizontal line through swing highs that were tested multiple times
  const resistanceLevels = findHorizontalLevels(klines, swings.filter((s) => s.type === "high"), "resistance", "#ef5350");
  const supportLevels = findHorizontalLevels(klines, swings.filter((s) => s.type === "low"), "support", "#26a69a");

  lines.push(...resistanceLevels, ...supportLevels);
  return lines;
}

function findHorizontalLevels(
  klines: KlineDataPoint[],
  swings: SwingPoint[],
  type: DrawLineType,
  color: string,
): AILine[] {
  const lines: AILine[] = [];
  const tolerance = 0.005; // 0.5% tolerance for same level

  // Cluster nearby swing prices into horizontal levels
  const clusters: { price: number; count: number; swings: SwingPoint[] }[] = [];

  for (const swing of swings) {
    let found = false;
    for (const cluster of clusters) {
      if (Math.abs(swing.price - cluster.price) / cluster.price < tolerance) {
        cluster.count++;
        cluster.price = (cluster.price * (cluster.count - 1) + swing.price) / cluster.count; // rolling avg
        cluster.swings.push(swing);
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ price: swing.price, count: 1, swings: [swing] });
    }
  }

  for (const cluster of clusters) {
    if (cluster.count >= 2) {
      const confidence = Math.min(1, cluster.count / 4 * 1.2);
      const labelCN = type === "support" ? i18n.t('AiDrawingEngine.k1') : i18n.t('AiDrawingEngine.k2');
      lines.push({
        id: `${type}-${cluster.price.toFixed(2)}`,
        type,
        label: `${labelCN} ${cluster.price.toFixed(2)} (${cluster.count}次)`,
        confidence,
        points: [
          { x: 0, y: cluster.price, time: klines[klines.length - 1]?.time ?? Date.now() },
          { x: klines.length - 1, y: cluster.price, time: klines[0]?.time ?? Date.now() },
        ],
        color,
        dashStyle: "dashed",
        thickness: 1.5,
        extendRight: true,
        extendLeft: true,
        userModified: false,
        createdAt: Date.now(),
      });
    }
  }

  return lines;
}

// ── Channel Detection ─────────────────────────────────────────────────────

function detectChannels(klines: KlineDataPoint[], swings: SwingPoint[]): AILine[] {
  const lines: AILine[] = [];
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  // Try to find parallel trend lines (channel)
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const dxLow = lows[j].index - lows[i].index;
      if (dxLow < 5) continue;

      const lowSlope = (lows[j].price - lows[i].price) / dxLow;

      // Look for a parallel upper trend line
      for (let k = 0; k < highs.length - 1; k++) {
        for (let l = k + 1; l < highs.length; l++) {
          const dxHigh = highs[l].index - highs[k].index;
          if (dxHigh < 5) continue;

          const highSlope = (highs[l].price - highs[k].price) / dxHigh;

          // Check if slopes are parallel (within 15%)
          const slopeDiff = Math.abs(lowSlope - highSlope) / (Math.abs(lowSlope) + 0.0001);
          if (slopeDiff < 0.15) {
            const confidence = Math.min(1, (1 - slopeDiff / 0.15) * 0.8);

            lines.push(
              {
                id: `channel-bottom-${i}-${j}`,
                type: "channel_bottom",
                label: i18n.t('AiDrawingEngine.k3'),
                confidence,
                points: [
                  { x: lows[i].index, y: lows[i].price, time: lows[i].time },
                  { x: lows[j].index, y: lows[j].price, time: lows[j].time },
                ],
                color: "#26a69a",
                dashStyle: "dashed",
                thickness: 1.5,
                extendRight: true,
                extendLeft: false,
                userModified: false,
                createdAt: Date.now(),
              },
              {
                id: `channel-top-${k}-${l}`,
                type: "channel_top",
                label: i18n.t('AiDrawingEngine.k4'),
                confidence,
                points: [
                  { x: highs[k].index, y: highs[k].price, time: highs[k].time },
                  { x: highs[l].index, y: highs[l].price, time: highs[l].time },
                ],
                color: "#ef5350",
                dashStyle: "dashed",
                thickness: 1.5,
                extendRight: true,
                extendLeft: false,
                userModified: false,
                createdAt: Date.now(),
              },
            );
            return lines; // found channel, stop looking
          }
        }
      }
    }
  }

  return lines;
}

// ── Fibonacci Retracement ─────────────────────────────────────────────────

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618] as const;
const FIB_LABELS: Record<number, string> = {
  0: "0%", 0.236: "23.6%", 0.382: "38.2%", 0.5: "50%", 0.618: "61.8%", 0.786: "78.6%",
  1.0: "100%", 1.272: "127.2%", 1.618: "161.8%",
};

function detectFibonacci(klines: KlineDataPoint[], swings: SwingPoint[]): FibonacciDrawing[] {
  const drawings: FibonacciDrawing[] = [];
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  // Find the most significant recent swing high and swing low
  const recentHigh = highs[highs.length - 1];
  const recentLow = lows[lows.length - 1];

  if (recentHigh && recentLow) {
    // Determine if uptrend (low → high) or downtrend (high → low)
    const isUptrend = recentLow.index < recentHigh.index;
    const start = isUptrend ? recentLow : recentHigh;
    const end = isUptrend ? recentHigh : recentLow;

    const range = end.price - start.price;
    const levels: FibonacciLevel[] = FIB_LEVELS.map((level) => {
      const price = isUptrend
        ? end.price - range * level // retracement from top
        : start.price + range * level; // retracement from bottom
      return {
        level,
        price,
        label: FIB_LABELS[level],
        type: level <= 1 ? "retracement" : "extension",
      };
    });

    drawings.push({
      id: `fib-${start.index}-${end.index}`,
      start: { x: start.index, y: start.price, time: start.time },
      end: { x: end.index, y: end.price, time: end.time },
      levels,
      confidence: 0.7,
      createdAt: Date.now(),
    });
  }

  return drawings;
}

// ── Gann Fan ──────────────────────────────────────────────────────────────

function detectGannFan(klines: KlineDataPoint[], swings: SwingPoint[]): GannFan[] {
  const fans: GannFan[] = [];
  const significantSwings = swings.filter((s) => s.strength > 0.5);

  if (significantSwings.length === 0) return fans;

  // Use the most recent strong swing as pivot
  const pivot = significantSwings[significantSwings.length - 1];

  const angles = [
    { angle: 82.5, label: "1×8" },
    { angle: 75, label: "1×4" },
    { angle: 71.25, label: "1×3" },
    { angle: 63.75, label: "1×2" },
    { angle: 45, label: "1×1" },
    { angle: 26.25, label: "2×1" },
    { angle: 18.75, label: "3×1" },
    { angle: 15, label: "4×1" },
    { angle: 7.5, label: "8×1" },
  ];

  fans.push({
    id: `gann-${pivot.index}`,
    pivot: { x: pivot.index, y: pivot.price, time: pivot.time },
    angles: angles.map((a) => ({
      ...a,
      priceAtBar: (barIndex: number) => {
        const dx = barIndex - pivot.index;
        const radians = (a.angle * Math.PI) / 180;
        return pivot.price + dx * Math.tan(radians);
      },
    })),
    confidence: 0.5,
    createdAt: Date.now(),
  });

  return fans;
}

// ── Main AI Drawing Engine ────────────────────────────────────────────────

export interface AIDrawingResult {
  trendLines: AILine[];
  supportResistance: AILine[];
  channels: AILine[];
  fibonacci: FibonacciDrawing[];
  gannFans: GannFan[];
  allLines: AILine[];
  meta: {
    dataPoints: number;
    swingPoints: number;
    computeMs: number;
  };
}

export class AIDrawingEngine {
  private userModifiedLines: Map<string, AILine> = new Map();

  /**
   * Analyze K-line data and auto-detect all drawing patterns.
   * Target: <50ms for 500 candles.
   */
  analyze(klines: KlineDataPoint[]): AIDrawingResult {
    const startTime = performance.now();

    if (klines.length < 10) {
      return {
        trendLines: [], supportResistance: [], channels: [],
        fibonacci: [], gannFans: [], allLines: [],
        meta: { dataPoints: klines.length, swingPoints: 0, computeMs: 0 },
      };
    }

    // 1. Detect swing points
    const swings = detectSwingPoints(klines, 0.15);

    // 2. Detect patterns
    const trendLines = detectTrendLines(klines, swings);
    const supportResistance = detectSupportResistance(klines, swings);
    const channels = detectChannels(klines, swings);
    const fibonacci = detectFibonacci(klines, swings);
    const gannFans = detectGannFan(klines, swings);

    // Merge all lines, apply user modifications
    const allLines = this.mergeAndApplyUserMods([
      ...trendLines,
      ...supportResistance,
      ...channels,
    ]);

    const computeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      trendLines, supportResistance, channels, fibonacci, gannFans, allLines,
      meta: { dataPoints: klines.length, swingPoints: swings.length, computeMs },
    };
  }

  /**
   * Allow user to modify a line (drag endpoints, change type, delete)
   */
  modifyLine(lineId: string, modifications: Partial<AILine>): AILine {
    const existing = this.userModifiedLines.get(lineId);
    const updated: AILine = {
      ...(existing ?? { id: lineId, type: "trend_line", label: "", confidence: 1, points: [], color: "#fff", dashStyle: "solid", thickness: 2, extendRight: true, extendLeft: false, userModified: true, createdAt: Date.now() }),
      ...modifications,
      userModified: true,
    };
    this.userModifiedLines.set(lineId, updated);
    return updated;
  }

  /** Remove a user-added or auto-detected line */
  removeLine(lineId: string): void {
    this.userModifiedLines.delete(lineId);
  }

  /** Clear all user modifications */
  clearUserMods(): void {
    this.userModifiedLines.clear();
  }

  /** Get user modifications as a serializable record */
  getUserModifications(): Record<string, AILine> {
    return Object.fromEntries(this.userModifiedLines);
  }

  private mergeAndApplyUserMods(autoLines: AILine[]): AILine[] {
    const result: AILine[] = [];
    const seenIds = new Set<string>();

    for (const line of autoLines) {
      if (this.userModifiedLines.has(line.id)) {
        // User has modified this line
        const userLine = this.userModifiedLines.get(line.id)!;
        result.push(userLine);
        seenIds.add(line.id);
      } else {
        result.push(line);
        seenIds.add(line.id);
      }
    }

    // Add lines that user added but engine didn't detect
    for (const [, userLine] of this.userModifiedLines) {
      if (!seenIds.has(userLine.id)) {
        result.push(userLine);
      }
    }

    return result.sort((a, b) => b.confidence - a.confidence);
  }

  reset(): void {
    this.userModifiedLines.clear();
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createAIDrawingEngine(): AIDrawingEngine {
  return new AIDrawingEngine();
}
