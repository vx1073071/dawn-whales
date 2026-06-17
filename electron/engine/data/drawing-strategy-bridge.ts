/**
 * R267: DrawingStrategyBridge — 画线→策略自动转换桥接
 * 
 * 功能:
 *   1. 画线→交易策略自动生成 (支撑→止损, 阻力→止盈, 趋势线→跟踪止损)
 *   2. 多画线组合→复合策略 (通道+趋势线 = 突破策略)
 *   3. 策略参数计算 (入场价/止损价/止盈价/仓位%)
 *   4. 策略回测建议 (基于画线间距计算风险收益比)
 *   5. 策略配置 → strategy-runner 桥接
 *   6. 策略模板库 (趋势追踪/区间突破/斐波回调)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DrawingStrategyInput {
  drawings: DrawingInput[];
  symbol: string;
  currentPrice: number;
  timeframe: string;
}

export interface DrawingInput {
  drawingId: string;
  type: DrawingType;
  points: PointInput[];
  label?: string;
  note?: string;
}

export type DrawingType = 'trend-line' | 'horizontal-line' | 'fib-retracement' | 'fib-extension' | 'parallel-channel' | 'pitchfork' | 'regression-trend' | 'rectangle' | 'triangle';

export interface PointInput {
  price: number;
  time: number;
  x?: number;
  y?: number;
}

export interface TradingStrategy {
  strategyId: string;
  name: string;
  nameCn: string;
  symbol: string;
  type: StrategyType;
  source: 'drawing';
  sourceDrawingIds: string[];
  entry: StrategyEntry;
  exit: StrategyExit[];
  stopLoss: StopLossConfig;
  riskReward: RiskReward;
  confidence: number;       // 0-100
  timeframe: string;
  createdAt: number;
  status: 'draft' | 'active' | 'backtested' | 'live';
}

export type StrategyType =
  | 'trend_following'
  | 'support_bounce'
  | 'breakout'
  | 'channel_trading'
  | 'fibonacci_retrace'
  | 'range_trading'
  | 'triangle_breakout'
  | 'composite';

export interface StrategyEntry {
  type: 'limit' | 'market' | 'stop';
  price: number;
  condition: string;
  conditionCn: string;
}

export interface StrategyExit {
  exitId: string;
  type: 'take_profit' | 'trailing_stop' | 'time_stop' | 'signal_exit';
  price: number | null;
  percent: number | null;
  description: string;
  descriptionCn: string;
}

export interface StopLossConfig {
  price: number;
  percent: number;       // % from entry
  type: 'hard' | 'trailing' | 'atr_based';
  atrMultiple?: number;
}

export interface RiskReward {
  risk: number;          // absolute risk $
  reward: number;        // absolute reward $
  ratio: number;         // reward:risk
  riskPercent: number;   // % of capital at risk
}

// ── Strategy templates ─────────────────────────────────────────────────────

const STRATEGY_TEMPLATES: Record<string, { name: string; nameCn: string; description: string; descriptionCn: string }> = {
  support_bounce: { name: 'Support Bounce', nameCn: '支撑反弹', description: 'Buy at support level with tight stop', descriptionCn: '在支撑位买入，紧止损' },
  resistance_short: { name: 'Resistance Short', nameCn: '阻力做空', description: 'Short at resistance with stop above', descriptionCn: '在阻力位做空，止损在阻力上方' },
  breakout_long: { name: 'Breakout Long', nameCn: '突破做多', description: 'Buy on resistance breakout with stop below', descriptionCn: '突破阻力做多，止损在阻力下方' },
  breakdown_short: { name: 'Breakdown Short', nameCn: '跌破做空', description: 'Short on support breakdown', descriptionCn: '跌破支撑做空' },
  trend_following: { name: 'Trend Following', nameCn: '趋势追踪', description: 'Buy along trend line pullback', descriptionCn: '趋势线回调买入' },
  channel_trade: { name: 'Channel Trading', nameCn: '通道交易', description: 'Buy near channel low, sell at high', descriptionCn: '通道下沿买入/上沿卖出' },
  fib_buy: { name: 'Fibonacci Entry', nameCn: '斐波那契入场', description: 'Buy at key fib retracement level', descriptionCn: '在关键斐波回撤位买入' },
  range_trade: { name: 'Range Trading', nameCn: '区间交易', description: 'Buy low, sell high within rectangle', descriptionCn: '矩形区间低买高卖' },
  triangle_break: { name: 'Triangle Breakout', nameCn: '三角突破', description: 'Trade triangle pattern breakout direction', descriptionCn: '三角形突破方向交易' },
};

// ═══════════════════════════════════════════════════════════════════════════
// DrawingStrategyBridge
// ═══════════════════════════════════════════════════════════════════════════

export class DrawingStrategyBridge {
  private strategies: Map<string, TradingStrategy> = new Map();
  private stats_ = { totalStrategies: 0, activeStrategies: 0, averageRR: 0 };

  constructor() {}

  // ── Public API: Generate Strategy from Drawings ─────────────────────────

  /**
   * Analyze drawings and generate a trading strategy.
   */
  generateStrategy(input: DrawingStrategyInput): TradingStrategy[] {
    const strategies: TradingStrategy[] = [];
    const { drawings, symbol, currentPrice, timeframe } = input;

    // Group drawings by type
    const trendLines = drawings.filter(d => d.type === 'trend-line');
    const horizontalLines = drawings.filter(d => d.type === 'horizontal-line');
    const fibs = drawings.filter(d => d.type === 'fib-retracement' || d.type === 'fib-extension');
    const channels = drawings.filter(d => d.type === 'parallel-channel');
    const rectangles = drawings.filter(d => d.type === 'rectangle');
    const triangles = drawings.filter(d => d.type === 'triangle');

    // 1. Support bounce / resistance break
    for (const hline of horizontalLines) {
      const price = hline.points[0]?.price ?? 0;
      if (!price) continue;

      if (price < currentPrice) {
        // Below current = potential support
        const s = this._makeStrategy(symbol, 'support_bounce', [hline.drawingId], timeframe, currentPrice, {
          entry: { type: 'limit', price: +(price * 1.005).toFixed(2), condition: 'Price touches support', conditionCn: '价格触及支撑位' },
          stopPrice: +(price * 0.97).toFixed(2),  // 3% below support
          takeProfit: +(price * 1.06).toFixed(2),  // 6% above entry
        });
        strategies.push(s);
      } else if (price > currentPrice) {
        // Above current = potential resistance
        const s = this._makeStrategy(symbol, 'breakout_long', [hline.drawingId], timeframe, currentPrice, {
          entry: { type: 'stop', price: +(price * 1.003).toFixed(2), condition: 'Price breaks above resistance', conditionCn: '价格突破阻力位' },
          stopPrice: +(price * 0.98).toFixed(2),
          takeProfit: +(price * 1.08).toFixed(2),
        });
        strategies.push(s);
      }
    }

    // 2. Trend line following
    for (const tl of trendLines) {
      if (tl.points.length < 2) continue;
      const p1 = tl.points[tl.points.length - 2];
      const p2 = tl.points[tl.points.length - 1];
      const slope = (p2.price - p1.price) / (p2.time - p1.time);
      const trendPrice = p2.price + slope * 1000; // extrapolate

      const isUp = slope > 0;
      strategies.push(this._makeStrategy(symbol, isUp ? 'trend_following' : 'breakdown_short', [tl.drawingId], timeframe, currentPrice, {
        entry: { type: 'limit', price: +trendPrice.toFixed(2), condition: 'Price pulls back to trendline', conditionCn: '价格回调至趋势线' },
        stopPrice: +(trendPrice * (isUp ? 0.97 : 1.03)).toFixed(2),
        takeProfit: +(trendPrice * (isUp ? 1.08 : 0.92)).toFixed(2),
      }));
    }

    // 3. Fibonacci retracement entry
    for (const fib of fibs) {
      if (fib.points.length < 2) continue;
      const high = fib.points[0].price;
      const low = fib.points[fib.points.length - 1].price;

      // Key fib levels: 0.382 and 0.618
      const isRetraceDown = high > low;
      const entry382 = isRetraceDown ? high - (high - low) * 0.382 : low + (high - low) * 0.382;
      const entry618 = isRetraceDown ? high - (high - low) * 0.618 : low + (high - low) * 0.618;

      // Use the level closest to current price
      const entryPrice = Math.abs(currentPrice - entry382) < Math.abs(currentPrice - entry618) ? entry382 : entry618;

      strategies.push(this._makeStrategy(symbol, 'fibonacci_retrace', [fib.drawingId], timeframe, currentPrice, {
        entry: { type: 'limit', price: +entryPrice.toFixed(2), condition: 'Price reaches fib retracement', conditionCn: '价格达到斐波那契回撤位' },
        stopPrice: +(entryPrice * 0.97).toFixed(2),
        takeProfit: +(high).toFixed(2),
      }));
    }

    // 4. Channel trading
    for (const ch of channels) {
      if (ch.points.length < 3) continue;
      const upper = Math.max(ch.points[0].price, ch.points[1].price, ch.points[2]?.price ?? 0);
      const lower = Math.min(ch.points[0].price, ch.points[1].price, ch.points[2]?.price ?? 0);

      strategies.push(this._makeStrategy(symbol, 'channel_trade', [ch.drawingId], timeframe, currentPrice, {
        entry: { type: 'limit', price: +lower.toFixed(2), condition: 'Price at channel low', conditionCn: '价格在通道下沿' },
        stopPrice: +(lower * 0.97).toFixed(2),
        takeProfit: +(upper).toFixed(2),
      }));
    }

    // 5. Range / Rectangle trading
    for (const rect of rectangles) {
      if (rect.points.length < 2) continue;
      const high = Math.max(rect.points[0].price, rect.points[1].price);
      const low = Math.min(rect.points[0].price, rect.points[1].price);

      strategies.push(this._makeStrategy(symbol, 'range_trade', [rect.drawingId], timeframe, currentPrice, {
        entry: { type: 'limit', price: +low.toFixed(2), condition: 'Price at range low', conditionCn: '价格在区间下沿' },
        stopPrice: +(low * 0.97).toFixed(2),
        takeProfit: +(high).toFixed(2),
      }));
    }

    // 6. Triangle breakout
    for (const tri of triangles) {
      if (tri.points.length < 3) continue;
      const apex = tri.points[0].price;
      strategies.push(this._makeStrategy(symbol, 'triangle_break', [tri.drawingId], timeframe, currentPrice, {
        entry: { type: 'market', price: currentPrice, condition: 'Break above triangle', conditionCn: '突破三角形态' },
        stopPrice: +(currentPrice * 0.97).toFixed(2),
        takeProfit: +(apex).toFixed(2),
      }));
    }

    return strategies;
  }

  // ── Public API: Composite Strategy ──────────────────────────────────────

  /**
   * Generate a composite strategy from multiple drawing types.
   */
  generateComposite(input: DrawingStrategyInput): TradingStrategy | null {
    const strategies = this.generateStrategy(input);
    if (strategies.length < 2) return null;

    // Pick the two strategies with highest confidence and combine
    const sorted = [...strategies].sort((a, b) => b.confidence - a.confidence);
    const primary = sorted[0];
    const secondary = sorted[1];

    const composite: TradingStrategy = {
      ...primary,
      strategyId: `cs:${input.symbol}:${Date.now()}`,
      name: `Composite: ${primary.name}+${secondary.name}`,
      nameCn: `复合策略: ${primary.nameCn}+${secondary.nameCn}`,
      type: 'composite',
      sourceDrawingIds: [...new Set([...primary.sourceDrawingIds, ...secondary.sourceDrawingIds])],
      confidence: Math.round((primary.confidence + secondary.confidence) / 2),
      exit: [
        ...primary.exit,
        {
          exitId: `exit:comp:sec:${Date.now()}`,
          type: 'take_profit',
          price: secondary.exit[0]?.price ?? null,
          percent: null,
          description: `Secondary: ${secondary.exit[0]?.description ?? ''}`,
          descriptionCn: `副策略: ${secondary.exit[0]?.descriptionCn ?? ''}`,
        }],
      riskReward: {
        risk: primary.riskReward.risk,
        reward: (primary.riskReward.reward + (secondary.riskReward?.reward ?? 0)) / 2,
        ratio: 0,
        riskPercent: primary.riskReward.riskPercent,
      },
    };
    composite.riskReward.ratio = composite.riskReward.risk > 0
      ? +(composite.riskReward.reward / composite.riskReward.risk).toFixed(2)
      : 0;

    this.strategies.set(composite.strategyId, composite);
    return composite;
  }

  // ── Public API: Strategy Validation ────────────────────────────────────

  /**
   * Validate a generated strategy (check logic, risk limits, practicality).
   */
  validateStrategy(strategy: TradingStrategy): { valid: boolean; warnings: string[]; warningsCn: string[] } {
    const warnings: string[] = [];
    const warningsCn: string[] = [];

    if (strategy.riskReward.ratio < 1.5) {
      warnings.push('Risk/Reward ratio < 1.5 — low profitability');
      warningsCn.push('风险收益比<1.5 — 盈利空间偏低');
    }

    if (strategy.stopLoss.percent > 10) {
      warnings.push('Stop loss > 10% — excessive risk');
      warningsCn.push('止损超过10% — 风险过大');
    }

    if (strategy.confidence < 50) {
      warnings.push('Confidence < 50 — consider manual review');
      warningsCn.push('置信度<50 — 建议人工审核');
    }

    if (Math.abs(strategy.entry.price - strategy.stopLoss.price) < strategy.entry.price * 0.01) {
      warnings.push('Stop loss too tight — may trigger on noise');
      warningsCn.push('止损过紧 — 可能被噪声触发');
    }

    return {
      valid: warnings.length <= 2,
      warnings,
      warningsCn,
    };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  getStrategy(strategyId: string): TradingStrategy | null { return this.strategies.get(strategyId) ?? null; }
  getStrategiesBySymbol(symbol: string): TradingStrategy[] {
    return Array.from(this.strategies.values()).filter(s => s.symbol === symbol);
  }
  getAllStrategies(): TradingStrategy[] { return Array.from(this.strategies.values()); }
  getStats() { return { ...this.stats_ }; }
  reset(): void { this.strategies.clear(); this.stats_ = { totalStrategies: 0, activeStrategies: 0, averageRR: 0 }; }

  // ── Private ─────────────────────────────────────────────────────────────

  private _makeStrategy(
    symbol: string, type: StrategyType, drawingIds: string[],
    timeframe: string, currentPrice: number,
    params: { entry: StrategyEntry; stopPrice: number; takeProfit: number; },
  ): TradingStrategy {
    const template = STRATEGY_TEMPLATES[type] ?? { name: type, nameCn: type };
    const stopPercent = +(Math.abs(params.entry.price - params.stopPrice) / params.entry.price * 100).toFixed(2);
    const profitPercent = +(Math.abs(params.takeProfit - params.entry.price) / params.entry.price * 100).toFixed(2);
    const rr = stopPercent > 0 ? +(profitPercent / stopPercent).toFixed(2) : 0;

    const strategy: TradingStrategy = {
      strategyId: `ds:${symbol}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      name: template.name,
      nameCn: template.nameCn,
      symbol,
      type,
      source: 'drawing',
      sourceDrawingIds: drawingIds,
      entry: params.entry,
      exit: [{
        exitId: `exit:tp:${Date.now()}`,
        type: 'take_profit',
        price: +params.takeProfit.toFixed(2),
        percent: +profitPercent.toFixed(2),
        description: `Take profit at $${params.takeProfit} (${profitPercent}%)`,
        descriptionCn: `止盈 @ ${params.takeProfit} (${profitPercent}%)`,
      }],
      stopLoss: {
        price: +params.stopPrice.toFixed(2),
        percent: +stopPercent.toFixed(2),
        type: 'hard',
      },
      riskReward: {
        risk: Math.abs(params.entry.price - params.stopPrice),
        reward: Math.abs(params.takeProfit - params.entry.price),
        ratio: rr,
        riskPercent: stopPercent,
      },
      confidence: this._calcConfidence(rr, type),
      timeframe,
      createdAt: Date.now(),
      status: 'draft',
    };

    this.strategies.set(strategy.strategyId, strategy);
    this.stats_.totalStrategies++;
    return strategy;
  }

  private _calcConfidence(rr: number, type: StrategyType): number {
    const baseConfidence: Record<string, number> = {
      support_bounce: 65, breakout_long: 60, trend_following: 70,
      channel_trade: 75, fibonacci_retrace: 55, range_trade: 65,
      triangle_break: 50, resistance_short: 55, breakdown_short: 50, composite: 70,
    };
    let conf = baseConfidence[type] ?? 60;
    if (rr >= 2) conf += 15;
    else if (rr >= 1.5) conf += 5;
    else conf -= 10;
    return Math.min(95, Math.max(20, conf));
  }
}

export const drawingStrategyBridge = new DrawingStrategyBridge();
