// ── J-73-03 R73 V19: AI Pattern Recognition Engine ─────────────────────
// 20+ candlestick & chart patterns with confidence scoring
// Semi-transparent overlay annotations, creator-correctable

export type PatternCategory = "reversal_bullish" | "reversal_bearish" | "continuation_bullish" | "continuation_bearish" | "indecision";

export interface PatternDefinition {
  id: string;
  name: string;
  nameCN: string;
  category: PatternCategory;
  description: string;
  candleCount: number; // how many candles in the pattern
  reliability: number; // historical hit rate 0-1
}

export interface DetectedPattern {
  pattern: PatternDefinition;
  startIndex: number; // bar index where pattern starts
  endIndex: number; // bar index where pattern ends
  confidence: number; // 0-1, how well it matches
  overlay: {
    bounds: { top: number; bottom: number; left: number; right: number };
    color: string; // hex with alpha
    label: string;
    annotation: string; // user-visible description
  };
  userCorrected: boolean;
  detectedAt: number;
}

// ── 20+ Pattern Library ───────────────────────────────────────────────────

const PATTERN_LIBRARY: PatternDefinition[] = [
  // ═══ Reversal: Bullish ═══
  {
    id: "HAMMER", name: "Hammer", nameCN: "锤子线",
    category: "reversal_bullish",
    description: "Small body at top, long lower shadow (>=2× body), little/no upper shadow. Bullish reversal at downtrend bottom.",
    candleCount: 1, reliability: 0.60,
  },
  {
    id: "INVERTED_HAMMER", name: "Inverted Hammer", nameCN: "倒锤子",
    category: "reversal_bullish",
    description: "Small body at bottom, long upper shadow (>=2× body). Bullish reversal signal.",
    candleCount: 1, reliability: 0.55,
  },
  {
    id: "BULLISH_ENGULFING", name: "Bullish Engulfing", nameCN: "看涨吞没",
    category: "reversal_bullish",
    description: "Bullish candle body completely engulfs previous bearish candle body. Strong reversal at bottom.",
    candleCount: 2, reliability: 0.63,
  },
  {
    id: "PIERCING_LINE", name: "Piercing Line", nameCN: "刺透形态",
    category: "reversal_bullish",
    description: "Bearish candle followed by bullish opening below prior close, closing above prior midpoint.",
    candleCount: 2, reliability: 0.61,
  },
  {
    id: "MORNING_STAR", name: "Morning Star", nameCN: "启明星",
    category: "reversal_bullish",
    description: "Bearish large → small body (gap down) → bullish large (gap up). 3-candle bottom reversal.",
    candleCount: 3, reliability: 0.68,
  },
  {
    id: "THREE_WHITE_SOLDIERS", name: "Three White Soldiers", nameCN: "三个白武士",
    category: "reversal_bullish",
    description: "Three consecutive bullish candles with higher closes, each opening within prior body.",
    candleCount: 3, reliability: 0.65,
  },
  {
    id: "DOJI_DRAGONFLY", name: "Dragonfly Doji", nameCN: "蜻蜓十字",
    category: "reversal_bullish",
    description: "Open=Close=High with long lower shadow. Classic bottom reversal.",
    candleCount: 1, reliability: 0.58,
  },
  {
    id: "BULLISH_HARAMI", name: "Bullish Harami", nameCN: "看涨孕线",
    category: "reversal_bullish",
    description: "Large bearish candle followed by small bullish candle completely inside prior body.",
    candleCount: 2, reliability: 0.53,
  },

  // ═══ Reversal: Bearish ═══
  {
    id: "SHOOTING_STAR", name: "Shooting Star", nameCN: "射击之星",
    category: "reversal_bearish",
    description: "Small body at bottom, long upper shadow (>=2× body). Bearish reversal at uptrend top.",
    candleCount: 1, reliability: 0.59,
  },
  {
    id: "HANGING_MAN", name: "Hanging Man", nameCN: "上吊线",
    category: "reversal_bearish",
    description: "Small body at top, long lower shadow. Bearish reversal at uptrend top.",
    candleCount: 1, reliability: 0.57,
  },
  {
    id: "BEARISH_ENGULFING", name: "Bearish Engulfing", nameCN: "看跌吞没",
    category: "reversal_bearish",
    description: "Bearish candle body completely engulfs previous bullish candle body. Strong reversal at top.",
    candleCount: 2, reliability: 0.64,
  },
  {
    id: "DARK_CLOUD_COVER", name: "Dark Cloud Cover", nameCN: "乌云盖顶",
    category: "reversal_bearish",
    description: "Bullish candle followed by bearish opening above prior high, closing below prior midpoint.",
    candleCount: 2, reliability: 0.62,
  },
  {
    id: "EVENING_STAR", name: "Evening Star", nameCN: "黄昏星",
    category: "reversal_bearish",
    description: "Bullish large → small body (gap up) → bearish large (gap down). 3-candle top reversal.",
    candleCount: 3, reliability: 0.67,
  },
  {
    id: "THREE_BLACK_CROWS", name: "Three Black Crows", nameCN: "三只乌鸦",
    category: "reversal_bearish",
    description: "Three consecutive bearish candles with lower closes, each opening within prior body.",
    candleCount: 3, reliability: 0.64,
  },
  {
    id: "DOJI_GRAVESTONE", name: "Gravestone Doji", nameCN: "墓碑十字",
    category: "reversal_bearish",
    description: "Open=Close=Low with long upper shadow. Classic top reversal.",
    candleCount: 1, reliability: 0.56,
  },
  {
    id: "BEARISH_HARAMI", name: "Bearish Harami", nameCN: "看跌孕线",
    category: "reversal_bearish",
    description: "Large bullish candle followed by small bearish candle completely inside prior body.",
    candleCount: 2, reliability: 0.52,
  },

  // ═══ Continuation: Bullish ═══
  {
    id: "BULLISH_MARUBOZU", name: "Bullish Marubozu", nameCN: "光头光脚阳线",
    category: "continuation_bullish",
    description: "Long bullish candle with no/small shadows. Strong bullish momentum.",
    candleCount: 1, reliability: 0.55,
  },
  {
    id: "RISING_THREE", name: "Rising Three Methods", nameCN: "上升三法",
    category: "continuation_bullish",
    description: "Long bullish + 3 small bearish (inside range) + long bullish. Continuation after consolidation.",
    candleCount: 5, reliability: 0.66,
  },

  // ═══ Continuation: Bearish ═══
  {
    id: "BEARISH_MARUBOZU", name: "Bearish Marubozu", nameCN: "光头光脚阴线",
    category: "continuation_bearish",
    description: "Long bearish candle with no/small shadows. Strong bearish momentum.",
    candleCount: 1, reliability: 0.54,
  },
  {
    id: "FALLING_THREE", name: "Falling Three Methods", nameCN: "下降三法",
    category: "continuation_bearish",
    description: "Long bearish + 3 small bullish (inside range) + long bearish. Bearish continuation.",
    candleCount: 5, reliability: 0.65,
  },

  // ═══ Indecision ═══
  {
    id: "DOJI", name: "Doji", nameCN: "十字星",
    category: "indecision",
    description: "Open ≈ Close with small shadows. Market indecision, potential reversal.",
    candleCount: 1, reliability: 0.45,
  },
  {
    id: "SPINNING_TOP", name: "Spinning Top", nameCN: "纺锤线",
    category: "indecision",
    description: "Small body with long upper and lower shadows. Indecision/consolidation.",
    candleCount: 1, reliability: 0.40,
  },
];

// ── Pattern Detection Functions ──────────────────────────────────────────

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function body(c: Candle): number { return Math.abs(c.close - c.open); }
function upperShadow(c: Candle): number { return c.high - Math.max(c.open, c.close); }
function lowerShadow(c: Candle): number { return Math.min(c.open, c.close) - c.low; }
function totalRange(c: Candle): number { return c.high - c.low; }
function isBullish(c: Candle): boolean { return c.close > c.open; }
function isBearish(c: Candle): boolean { return c.close < c.open; }

function detectSingleCandle(candle: Candle, index: number): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const b = body(candle);
  const us = upperShadow(candle);
  const ls = lowerShadow(candle);
  const tr = totalRange(candle);
  if (tr === 0) return patterns; // no range, can't detect

  // Hammer: small body at top, long lower shadow (>=2x body), minimal upper shadow
  if (b > 0 && ls >= 2 * b && us <= 0.3 * b) {
    patterns.push(makePattern("HAMMER", candle, index, 0.7));
  }

  // Inverted Hammer: small body at bottom, long upper shadow (>=2x body), minimal lower shadow
  if (b > 0 && us >= 2 * b && ls <= 0.3 * b) {
    patterns.push(makePattern("INVERTED_HAMMER", candle, index, 0.65));
  }

  // Shooting Star: small body at bottom, long upper shadow (>=2x body), minimal lower shadow, at top
  if (b > 0 && us >= 2 * b && ls <= 0.3 * b) {
    patterns.push(makePattern("SHOOTING_STAR", candle, index, 0.65));
  }

  // Hanging Man: small body at top, long lower shadow (>=2x body), minimal upper shadow
  if (b > 0 && ls >= 2 * b && us <= 0.3 * b) {
    patterns.push(makePattern("HANGING_MAN", candle, index, 0.6));
  }

  // Dragonfly Doji: open=close, long lower shadow
  if (b <= tr * 0.05 && ls >= tr * 0.6) {
    patterns.push(makePattern("DOJI_DRAGONFLY", candle, index, 0.7));
  }

  // Gravestone Doji: open=close, long upper shadow
  if (b <= tr * 0.05 && us >= tr * 0.6) {
    patterns.push(makePattern("DOJI_GRAVESTONE", candle, index, 0.7));
  }

  // Doji: open ≈ close
  if (b <= tr * 0.05) {
    patterns.push(makePattern("DOJI", candle, index, 0.6));
  }

  // Spinning Top: small body with both shadows
  if (b <= tr * 0.3 && us >= tr * 0.25 && ls >= tr * 0.25) {
    patterns.push(makePattern("SPINNING_TOP", candle, index, 0.55));
  }

  // Bullish Marubozu: long bullish, no shadows
  if (isBullish(candle) && us <= tr * 0.05 && ls <= tr * 0.05 && b >= tr * 0.9) {
    patterns.push(makePattern("BULLISH_MARUBOZU", candle, index, 0.65));
  }

  // Bearish Marubozu: long bearish, no shadows
  if (isBearish(candle) && us <= tr * 0.05 && ls <= tr * 0.05 && b >= tr * 0.9) {
    patterns.push(makePattern("BEARISH_MARUBOZU", candle, index, 0.65));
  }

  return patterns;
}

function detectTwoCandle(candles: Candle[], index: number): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  if (index < 1) return patterns;

  const prev = candles[index - 1];
  const curr = candles[index];

  // Bullish Engulfing: prev bearish, curr bullish, curr body engulfs prev body
  if (isBearish(prev) && isBullish(curr) &&
    Math.abs(curr.close - curr.open) > Math.abs(prev.close - prev.open) &&
    curr.open < prev.close && curr.close > prev.open) {
    patterns.push(makePattern("BULLISH_ENGULFING", curr, index, 0.75, 1));
  }

  // Bearish Engulfing: prev bullish, curr bearish, curr body engulfs prev body
  if (isBullish(prev) && isBearish(curr) &&
    Math.abs(curr.close - curr.open) > Math.abs(prev.close - prev.open) &&
    curr.open > prev.close && curr.close < prev.open) {
    patterns.push(makePattern("BEARISH_ENGULFING", curr, index, 0.75, 1));
  }

  // Piercing Line: prev bearish, curr opens below prev low, closes above prev midpoint
  if (isBearish(prev) && isBullish(curr) &&
    curr.open < prev.low && curr.close > (prev.open + prev.close) / 2) {
    patterns.push(makePattern("PIERCING_LINE", curr, index, 0.7, 1));
  }

  // Dark Cloud Cover: prev bullish, curr opens above prev high, closes below prev midpoint
  if (isBullish(prev) && isBearish(curr) &&
    curr.open > prev.high && curr.close < (prev.open + prev.close) / 2) {
    patterns.push(makePattern("DARK_CLOUD_COVER", curr, index, 0.7, 1));
  }

  // Bullish Harami: prev large bearish, curr small bullish inside prev body
  if (isBearish(prev) && isBullish(curr) &&
    body(prev) > body(curr) * 1.5 &&
    curr.open > prev.close && curr.close < prev.open) {
    patterns.push(makePattern("BULLISH_HARAMI", curr, index, 0.6, 1));
  }

  // Bearish Harami: prev large bullish, curr small bearish inside prev body
  if (isBullish(prev) && isBearish(curr) &&
    body(prev) > body(curr) * 1.5 &&
    curr.open < prev.close && curr.close > prev.open) {
    patterns.push(makePattern("BEARISH_HARAMI", curr, index, 0.6, 1));
  }

  return patterns;
}

function detectThreeCandle(candles: Candle[], index: number): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  if (index < 2) return patterns;

  const c0 = candles[index - 2];
  const c1 = candles[index - 1];
  const c2 = candles[index];

  // Morning Star: bearish large → small body (gap down) → bullish large (gap up)
  if (isBearish(c0) && body(c0) > totalRange(c1) * 0.5 &&
    isBullish(c2) && body(c2) > body(c1) * 1.5 &&
    c2.close > (c0.open + c0.close) / 2) {
    patterns.push(makePattern("MORNING_STAR", c2, index, 0.75, 2));
  }

  // Evening Star: bullish large → small body (gap up) → bearish large (gap down)
  if (isBullish(c0) && body(c0) > totalRange(c1) * 0.5 &&
    isBearish(c2) && body(c2) > body(c1) * 1.5 &&
    c2.close < (c0.open + c0.close) / 2) {
    patterns.push(makePattern("EVENING_STAR", c2, index, 0.75, 2));
  }

  // Three White Soldiers: 3 consecutive bullish, each close higher, each open within prior body
  if (isBullish(c0) && isBullish(c1) && isBullish(c2) &&
    c1.close > c0.close && c2.close > c1.close &&
    c1.open > c0.open && c1.open < c0.close &&
    c2.open > c1.open && c2.open < c1.close) {
    patterns.push(makePattern("THREE_WHITE_SOLDIERS", c2, index, 0.8, 2));
  }

  // Three Black Crows: 3 consecutive bearish, each close lower, each open within prior body
  if (isBearish(c0) && isBearish(c1) && isBearish(c2) &&
    c1.close < c0.close && c2.close < c1.close &&
    c1.open < c0.open && c1.open > c0.close &&
    c2.open < c1.open && c2.open > c1.close) {
    patterns.push(makePattern("THREE_BLACK_CROWS", c2, index, 0.8, 2));
  }

  return patterns;
}

function detectFiveCandle(candles: Candle[], index: number): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  if (index < 4) return patterns;

  const c0 = candles[index - 4];
  const c1 = candles[index - 3];
  const c2 = candles[index - 2];
  const c3 = candles[index - 1];
  const c4 = candles[index];

  // Rising Three Methods: long bullish + 3 small bearish (inside range) + long bullish
  if (isBullish(c0) && body(c0) > body(c1) &&
    isBearish(c1) && isBearish(c2) && isBearish(c3) &&
    c1.low > c0.low && c3.high < c0.high &&
    isBullish(c4) && c4.close > c0.close) {
    patterns.push(makePattern("RISING_THREE", c4, index, 0.7, 4));
  }

  // Falling Three Methods: long bearish + 3 small bullish (inside range) + long bearish
  if (isBearish(c0) && body(c0) > body(c1) &&
    isBullish(c1) && isBullish(c2) && isBullish(c3) &&
    c1.high < c0.high && c3.low > c0.low &&
    isBearish(c4) && c4.close < c0.close) {
    patterns.push(makePattern("FALLING_THREE", c4, index, 0.7, 4));
  }

  return patterns;
}

// ── Helper: build DetectedPattern ────────────────────────────────────────

function makePattern(
  patternId: string,
  candle: Candle,
  endIndex: number,
  confidence: number,
  candleOffset = 0,
): DetectedPattern {
  const pattern = PATTERN_LIBRARY.find((p) => p.id === patternId)!;
  const categoryColors: Record<PatternCategory, string> = {
    reversal_bullish: "rgba(38, 166, 154, 0.25)",
    reversal_bearish: "rgba(239, 83, 80, 0.25)",
    continuation_bullish: "rgba(38, 166, 154, 0.15)",
    continuation_bearish: "rgba(239, 83, 80, 0.15)",
    indecision: "rgba(255, 193, 7, 0.15)",
  };

  return {
    pattern,
    startIndex: endIndex - candleOffset,
    endIndex,
    confidence: Math.round(confidence * pattern.reliability * 100) / 100,
    overlay: {
      bounds: {
        top: candle.high,
        bottom: candle.low - (candle.high - candle.low) * 0.1,
        left: endIndex - candleOffset - 0.5,
        right: endIndex + 0.5,
      },
      color: categoryColors[pattern.category],
      label: pattern.nameCN,
      annotation: `${pattern.nameCN} (置信度${Math.round(confidence * pattern.reliability * 100)}%)`,
    },
    userCorrected: false,
    detectedAt: Date.now(),
  };
}

// ── AI Pattern Recognition Engine ─────────────────────────────────────────

export interface PatternRecognitionResult {
  patterns: DetectedPattern[];
  summary: {
    bullish: number;
    bearish: number;
    continuation: number;
    indecision: number;
    strongestSignal: DetectedPattern | null;
  };
  meta: {
    dataPoints: number;
    computeMs: number;
  };
}

export class AIPatternRecognitionEngine {
  private correctedPatterns: Map<string, DetectedPattern> = new Map();
  private deletedPatterns: Set<string> = new Set();

  /**
   * Analyze candles and detect all known patterns.
   * Target: <30ms for 200 candles.
   */
  analyze(candles: Candle[]): PatternRecognitionResult {
    const startTime = performance.now();

    if (candles.length < 1) {
      return {
        patterns: [],
        summary: { bullish: 0, bearish: 0, continuation: 0, indecision: 0, strongestSignal: null },
        meta: { dataPoints: 0, computeMs: 0 },
      };
    }

    const allPatterns: DetectedPattern[] = [];

    for (let i = 0; i < candles.length; i++) {
      // 1-candle patterns
      allPatterns.push(...detectSingleCandle(candles[i], i));

      // 2-candle patterns
      allPatterns.push(...detectTwoCandle(candles, i));

      // 3-candle patterns
      allPatterns.push(...detectThreeCandle(candles, i));

      // 5-candle patterns
      allPatterns.push(...detectFiveCandle(candles, i));
    }

    // Apply user corrections and deletions
    const patterns = this.applyCorrections(allPatterns);

    // Sort by confidence desc
    patterns.sort((a, b) => b.confidence - a.confidence);

    // Summary
    let bullish = 0, bearish = 0, continuation = 0, indecision = 0;
    for (const p of patterns) {
      switch (p.pattern.category) {
        case "reversal_bullish": bullish++; break;
        case "reversal_bearish": bearish++; break;
        case "continuation_bullish": case "continuation_bearish": continuation++; break;
        case "indecision": indecision++; break;
      }
    }

    const computeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      patterns,
      summary: {
        bullish,
        bearish,
        continuation,
        indecision,
        strongestSignal: patterns.length > 0 ? patterns[0] : null,
      },
      meta: { dataPoints: candles.length, computeMs },
    };
  }

  /** User corrects a detected pattern (adjust confidence, label, category) */
  correctPattern(patternId: string, corrections: Partial<Pick<DetectedPattern, "confidence" | "overlay">>): DetectedPattern | null {
    const existing = this.correctedPatterns.get(patternId);
    if (!existing) {
      // Find in last analysis result
      return null; // caller should pass the full DetectedPattern
    }

    const updated: DetectedPattern = {
      ...existing,
      ...corrections,
      userCorrected: true,
      overlay: { ...existing.overlay, ...corrections.overlay },
    };
    this.correctedPatterns.set(patternId, updated);
    return updated;
  }

  /** User adds a manually identified pattern */
  addPattern(pattern: DetectedPattern): void {
    this.correctedPatterns.set(pattern.pattern.id + "-" + pattern.startIndex + "-" + pattern.endIndex, {
      ...pattern,
      userCorrected: true,
    });
  }

  /** User deletes a falsely detected pattern */
  deletePattern(patternId: string): void {
    this.deletedPatterns.add(patternId);
    this.correctedPatterns.delete(patternId);
  }

  /** Clear all corrections */
  clearCorrections(): void {
    this.correctedPatterns.clear();
    this.deletedPatterns.clear();
  }

  /** Get all 22 pattern definitions for the UI pattern library */
  getPatternLibrary(): PatternDefinition[] {
    return [...PATTERN_LIBRARY];
  }

  private applyCorrections(autoPatterns: DetectedPattern[]): DetectedPattern[] {
    const result: DetectedPattern[] = [];

    for (const p of autoPatterns) {
      const id = p.pattern.id + "-" + p.startIndex + "-" + p.endIndex;

      if (this.deletedPatterns.has(id)) continue;

      if (this.correctedPatterns.has(id)) {
        result.push(this.correctedPatterns.get(id)!);
      } else {
        result.push(p);
      }
    }

    // Add user-added patterns
    for (const [, p] of this.correctedPatterns) {
      const exists = result.some((r) =>
        r.pattern.id === p.pattern.id && r.startIndex === p.startIndex && r.endIndex === p.endIndex
      );
      if (!exists) result.push(p);
    }

    return result;
  }

  reset(): void {
    this.correctedPatterns.clear();
    this.deletedPatterns.clear();
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createAIPatternRecognitionEngine(): AIPatternRecognitionEngine {
  return new AIPatternRecognitionEngine();
}
