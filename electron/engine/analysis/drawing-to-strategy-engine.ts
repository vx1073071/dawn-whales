// ── R267 JVS-3 画线→策略引擎 (DrawingToStrategyEngine) ──
// 用户画线自动转化为可执行的交易策略信号
// 功能: 趋势线突破/通道突破/支撑阻力触发/自动止损止盈/画线条件单

export interface DrawingObject {
  id: string;
  type: DrawingType;
  /** Anchor points (at least 2 for lines, 1 for horizontal) */
  points: DrawingPoint[];
  /** Line style */
  style?: DrawingStyle;
  /** User label */
  label?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DrawingPoint {
  timestamp: number;
  price: number;
  /** Optional: which K-line index this point anchors to */
  barIndex?: number;
}

export type DrawingType =
  | 'horizontal'     // 水平线 (支撑/阻力)
  | 'trendline'      // 趋势线
  | 'ray'            // 射线 (无限延伸)
  | 'segment'        // 线段
  | 'channel'        // 平行通道
  | 'fib_retracement' // 斐波那契回调
  | 'fib_extension'  // 斐波那契扩展
  | 'rect'           // 矩形区间
  | 'triangle';      // 三角形

export interface DrawingStyle {
  color?: string;
  lineWidth?: number;
  dashed?: boolean;
  extend?: boolean;  // ray/triangle
}

export interface StrategySignal {
  /** Unique signal ID */
  id: string;
  /** Source drawing that generated this signal */
  drawingId: string;
  /** Drawing type */
  drawingType: DrawingType;
  /** Signal type */
  signalType: SignalType;
  /** Current price that triggered the signal */
  triggerPrice: number;
  /** The level that was crossed */
  levelPrice: number;
  /** Timestamp of signal generation */
  timestamp: number;
  /** Strength 0-100 */
  strength: number;
  /** Suggested action */
  action: 'buy' | 'sell' | 'close_long' | 'close_short' | 'alert' | 'none';
  /** Suggested stop-loss */
  stopLoss?: number;
  /** Suggested take-profit */
  takeProfit?: number;
  /** Risk/Reward ratio */
  riskReward?: number;
  /** Human-readable message */
  message: string;
  /** Timeframe of the signal */
  timeframe?: string;
}

export type SignalType =
  | 'breakout_up'      // 向上突破
  | 'breakout_down'    // 向下突破
  | 'bounce_up'        // 支撑反弹
  | 'bounce_down'      // 阻力回落
  | 'channel_top_reached'
  | 'channel_bottom_reached'
  | 'fib_level_reached'
  | 'fib_level_breached'
  | 'trendline_touch'
  | 'trendline_break';

export interface StrategyConfig {
  /** Minimum confirmation bars before signal fires (avoids whipsaws) */
  confirmBars?: number;
  /** Tolerance for "touching" a line (% of price) */
  touchTolerance?: number;
  /** Auto-generated SL as % from trigger */
  autoStopLossPct?: number;
  /** Auto-generated TP as % from trigger */
  autoTakeProfitPct?: number;
  /** Minimum R:R to fire a signal */
  minRiskReward?: number;
  /** Cooldown (ms) between same signal */
  signalCooldownMs?: number;
  /** Max active signals per drawing */
  maxSignalsPerDrawing?: number;
}

export const DEFAULT_STRATEGY_CONFIG: Required<StrategyConfig> = {
  confirmBars: 1,
  touchTolerance: 0.005,
  autoStopLossPct: 0.02,
  autoTakeProfitPct: 0.04,
  minRiskReward: 1.0,
  signalCooldownMs: 300_000, // 5 min
  maxSignalsPerDrawing: 3,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class DrawingToStrategyEngine {
  private config: Required<StrategyConfig>;
  private drawings: Map<string, DrawingObject> = new Map();
  private signalHistory: StrategySignal[] = [];
  private activeSignals: Map<string, Set<string>> = new Map(); // drawingId → signalIds
  private lastSignalTime: Map<string, number> = new Map(); // signalKey → timestamp

  constructor(config?: StrategyConfig) {
    this.config = { ...DEFAULT_STRATEGY_CONFIG, ...config };
  }

  reset(): void {
    this.drawings.clear();
    this.signalHistory = [];
    this.activeSignals.clear();
    this.lastSignalTime.clear();
  }

  getConfig(): Required<StrategyConfig> {
    return { ...this.config };
  }

  updateConfig(patch: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  // ═══════════ Drawing Management ═══════════

  registerDrawing(drawing: DrawingObject): void {
    this.drawings.set(drawing.id, { ...drawing });
  }

  registerDrawings(drawings: DrawingObject[]): void {
    for (const d of drawings) this.registerDrawing(d);
  }

  removeDrawing(id: string): void {
    this.drawings.delete(id);
    this.activeSignals.delete(id);
  }

  getDrawing(id: string): DrawingObject | null {
    return this.drawings.get(id) || null;
  }

  getAllDrawings(): DrawingObject[] {
    return Array.from(this.drawings.values());
  }

  getDrawingsByType(type: DrawingType): DrawingObject[] {
    return this.getAllDrawings().filter((d) => d.type === type);
  }

  // ═══════════ Line Math ═══════════

  /**
   * Calculate price on a line at a given timestamp (linear interpolation/extrapolation).
   */
  private getLinePrice(drawing: DrawingObject, timestamp: number): number {
    const pts = drawing.points;
    if (pts.length < 2) return pts[0]?.price || 0;

    // For horizontal lines, always return the anchor price
    if (drawing.type === 'horizontal') return pts[0].price;

    const p1 = pts[0];
    const p2 = pts[1];
    if (p2.timestamp === p1.timestamp) return p1.price;

    const slope = (p2.price - p1.price) / (p2.timestamp - p1.timestamp);
    return p1.price + slope * (timestamp - p1.timestamp);
  }

  /**
   * Check if a price "touches" a line at a given timestamp.
   */
  private priceTouchesLine(price: number, drawing: DrawingObject, timestamp: number): boolean {
    const linePrice = this.getLinePrice(drawing, timestamp);
    if (linePrice === 0) return false;
    const deviation = Math.abs(price - linePrice) / linePrice;
    return deviation <= this.config.touchTolerance;
  }

  /**
   * Check if price crosses above/below a line.
   */
  private detectCross(
    prevPrice: number,
    currentPrice: number,
    drawing: DrawingObject,
    prevTime: number,
    currentTime: number,
  ): 'cross_up' | 'cross_down' | null {
    const prevLine = this.getLinePrice(drawing, prevTime);
    const currLine = this.getLinePrice(drawing, currentTime);

    if (prevPrice < prevLine && currentPrice > currLine) return 'cross_up';
    if (prevPrice > prevLine && currentPrice < currLine) return 'cross_down';
    return null;
  }

  // ═══════════ Signal Generation ═══════════

  /**
   * Process a new price bar against all registered drawings.
   * Returns any signals generated.
   */
  evaluate(
    bars: { timestamp: number; open: number; high: number; low: number; close: number }[],
    timeframe?: string,
  ): StrategySignal[] {
    if (bars.length < 2) return [];

    const signals: StrategySignal[] = [];
    const prevBar = bars[bars.length - 2];
    const currentBar = bars[bars.length - 1];

    for (const drawing of this.drawings.values()) {
      const newSignals = this.evaluateDrawing(drawing, prevBar, currentBar, timeframe);
      signals.push(...newSignals);
    }

    this.signalHistory.push(...signals);
    return signals;
  }

  /**
   * Evaluate a single drawing against a price pair.
   */
  evaluateDrawing(
    drawing: DrawingObject,
    prevBar: { timestamp: number; open: number; high: number; low: number; close: number },
    currentBar: { timestamp: number; open: number; high: number; low: number; close: number },
    timeframe?: string,
  ): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const activeSet = this.activeSignals.get(drawing.id) || new Set();
    if (activeSet.size >= this.config.maxSignalsPerDrawing) return signals;

    // Cooldown check
    const cooldownKey = `${drawing.id}`;
    const lastTime = this.lastSignalTime.get(cooldownKey) || 0;
    if (Date.now() - lastTime < this.config.signalCooldownMs) return signals;

    switch (drawing.type) {
      case 'horizontal':
        signals.push(...this.evaluateHorizontal(drawing, prevBar, currentBar, timeframe));
        break;
      case 'trendline':
      case 'ray':
      case 'segment':
        signals.push(...this.evaluateTrendLine(drawing, prevBar, currentBar, timeframe));
        break;
      case 'channel':
        signals.push(...this.evaluateChannel(drawing, prevBar, currentBar, timeframe));
        break;
      case 'fib_retracement':
        signals.push(...this.evaluateFibRetracement(drawing, prevBar, currentBar, timeframe));
        break;
    }

    return signals;
  }

  // ═══════════ Horizontal Evaluation ═══════════

  private evaluateHorizontal(
    drawing: DrawingObject,
    prev: { timestamp: number; high: number; low: number; close: number },
    curr: { timestamp: number; high: number; low: number; close: number },
    timeframe?: string,
  ): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const level = drawing.points[0]?.price;
    if (!level) return signals;

    const tolerance = this.config.touchTolerance;
    const levelUpper = level * (1 + tolerance);
    const levelLower = level * (1 - tolerance);
    const { autoStopLossPct, autoTakeProfitPct } = this.config;

    // Breakout up: prev price below level, current price above level
    const cross = this.detectCross(prev.close, curr.close, drawing, prev.timestamp, curr.timestamp);

    if (cross === 'cross_up') {
      const sl = Math.round(level * (1 - autoStopLossPct) * 100) / 100;
      const tp = Math.round(level * (1 + autoTakeProfitPct) * 100) / 100;
      const rr = (tp - curr.close) / (curr.close - sl);

      const signal: StrategySignal = {
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'horizontal',
        signalType: 'breakout_up',
        triggerPrice: curr.close,
        levelPrice: level,
        timestamp: curr.timestamp,
        strength: 70,
        action: 'buy',
        stopLoss: sl,
        takeProfit: tp,
        riskReward: Math.round(rr * 100) / 100,
        message: `${drawing.label || '水平线'} 向上突破! 价格突破 ${level}，做多信号。SL: ${sl} TP: ${tp}`,
        timeframe,
      };
      if (rr >= this.config.minRiskReward) signals.push(signal);
    }

    if (cross === 'cross_down') {
      const sl = Math.round(level * (1 + autoStopLossPct) * 100) / 100;
      const tp = Math.round(level * (1 - autoTakeProfitPct) * 100) / 100;
      const rr = (curr.close - sl) / (tp - curr.close); // tp < current for sell

      const signal: StrategySignal = {
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'horizontal',
        signalType: 'breakout_down',
        triggerPrice: curr.close,
        levelPrice: level,
        timestamp: curr.timestamp,
        strength: 70,
        action: 'sell',
        stopLoss: sl,
        takeProfit: tp,
        riskReward: Math.round(Math.abs(rr) * 100) / 100,
        message: `${drawing.label || '水平线'} 向下突破! 价格跌破 ${level}，做空信号。SL: ${sl} TP: ${tp}`,
        timeframe,
      };
      if (Math.abs(rr) >= this.config.minRiskReward) signals.push(signal);
    }

    // Bounce: price approached but didn't break
    if (Math.abs(curr.close - level) / level <= tolerance * 2) {
      // If price bounced up from below → support bounce
      // If price bounced down from above → resistance bounce
      const prevDist = (prev.close - level) / level;

      if (prevDist > tolerance && curr.close >= level * (1 - tolerance) && curr.close <= levelUpper) {
        signals.push({
          id: `s-${drawing.id}-${Date.now()}`,
          drawingId: drawing.id,
          drawingType: 'horizontal',
          signalType: 'bounce_up',
          triggerPrice: curr.close,
          levelPrice: level,
          timestamp: curr.timestamp,
          strength: 50,
          action: 'alert',
          message: `${drawing.label || '水平线'} 支撑反弹! 价格在 ${level} 获得支撑`,
          timeframe,
        });
      } else if (prevDist < -tolerance && curr.close <= level * (1 + tolerance) && curr.close >= levelLower) {
        signals.push({
          id: `s-${drawing.id}-${Date.now()}`,
          drawingId: drawing.id,
          drawingType: 'horizontal',
          signalType: 'bounce_down',
          triggerPrice: curr.close,
          levelPrice: level,
          timestamp: curr.timestamp,
          strength: 50,
          action: 'alert',
          message: `${drawing.label || '水平线'} 阻力回落! 价格在 ${level} 遇阻`,
          timeframe,
        });
      }
    }

    return signals;
  }

  // ═══════════ Trendline Evaluation ═══════════

  private evaluateTrendLine(
    drawing: DrawingObject,
    prev: { timestamp: number; high: number; low: number; close: number },
    curr: { timestamp: number; high: number; low: number; close: number },
    timeframe?: string,
  ): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const linePrice = this.getLinePrice(drawing, curr.timestamp);
    if (linePrice === 0) return signals;

    const tolerance = this.config.touchTolerance;
    const { autoStopLossPct, autoTakeProfitPct } = this.config;

    const cross = this.detectCross(prev.close, curr.close, drawing, prev.timestamp, curr.timestamp);
    const slope = this.getLineSlope(drawing);

    // Determine if this is an uptrend (support) or downtrend (resistance) line
    const isSupportLine = slope > 0;

    if (cross === 'cross_up' && !isSupportLine) {
      // Breaking above a downtrend resistance → bullish
      const signal: StrategySignal = {
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'trendline',
        signalType: 'trendline_break',
        triggerPrice: curr.close,
        levelPrice: linePrice,
        timestamp: curr.timestamp,
        strength: 80,
        action: 'buy',
        stopLoss: Math.round(linePrice * (1 - autoStopLossPct) * 100) / 100,
        takeProfit: Math.round(linePrice * (1 + autoTakeProfitPct * 1.5) * 100) / 100,
        message: `${drawing.label || '趋势线'} 向上突破! 突破下降趋势线，趋势可能反转`,
        timeframe,
      };
      signals.push(signal);
    }

    if (cross === 'cross_down' && isSupportLine) {
      // Breaking below an uptrend support → bearish
      const signal: StrategySignal = {
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'trendline',
        signalType: 'trendline_break',
        triggerPrice: curr.close,
        levelPrice: linePrice,
        timestamp: curr.timestamp,
        strength: 80,
        action: 'sell',
        message: `${drawing.label || '趋势线'} 向下突破! 跌破上升趋势线，支撑失守`,
        timeframe,
      };
      signals.push(signal);
    }

    // Touch detection
    if (this.priceTouchesLine(curr.close, drawing, curr.timestamp)) {
      signals.push({
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'trendline',
        signalType: 'trendline_touch',
        triggerPrice: curr.close,
        levelPrice: linePrice,
        timestamp: curr.timestamp,
        strength: isSupportLine ? 55 : 45,
        action: isSupportLine ? 'alert' : 'alert',
        message: `${drawing.label || '趋势线'} 第N次触及${isSupportLine ? '支撑' : '阻力'}，关注方向选择`,
        timeframe,
      });
    }

    return signals;
  }

  private getLineSlope(drawing: DrawingObject): number {
    const pts = drawing.points;
    if (pts.length < 2) return 0;
    return (pts[1].price - pts[0].price) / (pts[1].timestamp - pts[0].timestamp);
  }

  // ═══════════ Channel Evaluation ═══════════

  private evaluateChannel(
    drawing: DrawingObject,
    prev: { timestamp: number; high: number; low: number; close: number },
    curr: { timestamp: number; high: number; low: number; close: number },
    timeframe?: string,
  ): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const pts = drawing.points;
    if (pts.length < 4) return signals; // channel needs 2 top + 2 bottom

    // Top line: points[0] and points[1]
    // Bottom line: points[2] and points[3]
    const topPts = { ...drawing, points: [pts[0], pts[1]], type: 'trendline' as DrawingType };
    const bottomPts = { ...drawing, points: [pts[2], pts[3]], type: 'trendline' as DrawingType };

    const topPrice = this.getLinePrice(topPts as DrawingObject, curr.timestamp);
    const bottomPrice = this.getLinePrice(bottomPts as DrawingObject, curr.timestamp);
    const tolerance = this.config.touchTolerance;

    if (topPrice === 0 || bottomPrice === 0) return signals;

    // Channel top reached → potential sell
    if (Math.abs(curr.high - topPrice) / topPrice <= tolerance) {
      signals.push({
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'channel',
        signalType: 'channel_top_reached',
        triggerPrice: curr.high,
        levelPrice: topPrice,
        timestamp: curr.timestamp,
        strength: 60,
        action: 'close_long',
        message: `${drawing.label || '通道'} 触及上轨 ${Math.round(topPrice * 100) / 100}，关注回落`,
        stopLoss: topPrice * 1.01,
        takeProfit: bottomPrice,
        timeframe,
      });
    }

    // Channel bottom reached → potential buy
    if (Math.abs(curr.low - bottomPrice) / bottomPrice <= tolerance) {
      const sl = bottomPrice * (1 - this.config.autoStopLossPct);
      const tp = topPrice;
      const rr = (tp - curr.close) / (curr.close - sl);

      signals.push({
        id: `s-${drawing.id}-${Date.now()}`,
        drawingId: drawing.id,
        drawingType: 'channel',
        signalType: 'channel_bottom_reached',
        triggerPrice: curr.low,
        levelPrice: bottomPrice,
        timestamp: curr.timestamp,
        strength: 60,
        action: 'buy',
        stopLoss: Math.round(sl * 100) / 100,
        takeProfit: Math.round(tp * 100) / 100,
        riskReward: Math.round(rr * 100) / 100,
        message: `${drawing.label || '通道'} 触及下轨 ${Math.round(bottomPrice * 100) / 100}，关注反弹`,
        timeframe,
      });
    }

    return signals;
  }

  // ═══════════ Fibonacci Evaluation ═══════════

  private evaluateFibRetracement(
    drawing: DrawingObject,
    prev: { timestamp: number; high: number; low: number; close: number },
    curr: { timestamp: number; high: number; low: number; close: number },
    timeframe?: string,
  ): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const pts = drawing.points;
    if (pts.length < 2) return signals;

    const p1 = pts[0]; // high
    const p2 = pts[1]; // low
    const range = p1.price - p2.price;
    if (range <= 0) return signals;

    // Standard Fib levels
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const tolerance = this.config.touchTolerance;

    for (const level of levels) {
      const fibPrice = p2.price + range * level;
      const deviation = Math.abs(curr.close - fibPrice) / fibPrice;

      if (deviation <= tolerance * 2) {
        const action = level >= 0.5 ? 'sell' : 'buy';
        signals.push({
          id: `s-${drawing.id}-${Date.now()}`,
          drawingId: drawing.id,
          drawingType: 'fib_retracement',
          signalType: 'fib_level_reached',
          triggerPrice: curr.close,
          levelPrice: fibPrice,
          timestamp: curr.timestamp,
          strength: 50 + Math.round(level * 50),
          action,
          message: `斐波那契 ${(level * 100).toFixed(1)}% 回调位 ${Math.round(fibPrice * 100) / 100} 达到`,
          timeframe,
        });
      }
    }

    return signals;
  }

  // ═══════════ Signal History ═══════════

  getSignalHistory(limit?: number): StrategySignal[] {
    const sorted = [...this.signalHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getSignalsForDrawing(drawingId: string): StrategySignal[] {
    return this.signalHistory.filter((s) => s.drawingId === drawingId);
  }

  clearSignalHistory(): void {
    this.signalHistory = [];
  }
}

// ═══════════ Singleton ═══════════

let dtsInstance: DrawingToStrategyEngine | null = null;

export function getDrawingToStrategyEngine(config?: StrategyConfig): DrawingToStrategyEngine {
  if (!dtsInstance) {
    dtsInstance = new DrawingToStrategyEngine(config);
  } else if (config) {
    dtsInstance.updateConfig(config);
  }
  return dtsInstance;
}

export function resetDrawingToStrategyEngine(): void {
  dtsInstance = null;
}
