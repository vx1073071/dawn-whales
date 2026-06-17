// ── R271 JVS-1 画线→策略转换引擎 (DrawingToStrategyEngine) ──
// 分析用户在K线图上绘制的68种画线工具，提取信号规则，自动生成策略定义

import type { KLine } from './pattern-recognition-21-engine';

export type DrawingToolType =
  | 'horizontal_line' | 'vertical_line' | 'trend_line' | 'ray_line' | 'parallel_channel'
  | 'fib_retracement' | 'fib_extension' | 'fib_fan' | 'fib_arc' | 'fib_timezone'
  | 'pitchfork' | 'schiff_pitchfork' | 'modified_schiff' | 'inside_pitchfork'
  | 'gann_line' | 'gann_fan' | 'gann_box' | 'gann_square'  | 'gann_grid'
  | 'support_resistance' | 'rectangle' | 'ellipse' | 'arc' | 'speed_line' | 'speed_resistance_arc'
  | 'head_shoulders' | 'inverse_head_shoulders' | 'double_top' | 'double_bottom'
  | 'triple_top' | 'triple_bottom' | 'rounded_top' | 'rounded_bottom'
  | 'wedge' | 'rising_wedge' | 'falling_wedge' | 'triangle' | 'ascending_triangle'
  | 'descending_triangle' | 'symmetrical_triangle' | 'flag' | 'pennant'
  | 'cup_handle' | 'megaphone' | 'diamond_top' | 'diamond_bottom'
  | 'abcd_pattern' | 'three_drives' | 'bat_pattern' | 'butterfly' | 'crab_pattern'
  | 'gartley' | 'shark_pattern' | 'cypher_pattern'
  | 'regression_channel' | 'volume_profile' | 'vwap' | 'market_profile'
  | 'crosshair' | 'measure_tool' | 'text_annotation' | 'arrow_marker'
  | 'price_range' | 'time_range' | 'info_line';

export interface DrawingPoint {
  x: number; y: number;
  price: number; timestamp: number; // bar index or real time
}

export interface DrawingObject {
  id: string;
  type: DrawingToolType;
  symbol: string;
  points: DrawingPoint[];
  properties: Record<string, number | string | boolean>;
  layerId?: string;
  createdAt: number;
}

export interface StrategyRule {
  id: string;
  name: string;
  sourceDrawingId: string;
  sourceDrawingType: DrawingToolType;
  condition: StrategyCondition;
  action: 'buy' | 'sell' | 'alert' | 'watch';
  priority: number;
  weight: number;
  description: string;
}

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | 'cross_above' | 'cross_below' | 'break_out' | 'break_down' | 'touch' | 'bounce' | 'reject' | 'between';

export interface StrategyCondition {
  left: StrategyOperand;
  operator: ConditionOperator;
  right: StrategyOperand;
  joinedBy: 'AND' | 'OR';
}

export interface StrategyOperand {
  type: 'price' | 'indicator' | 'drawing' | 'volume' | 'constant';
  value: number | string;
  symbol?: string;
  params?: Record<string, number>;
}

export interface GeneratedStrategy {
  id: string;
  name: string;
  description: string;
  drawings: DrawingObject[];
  rules: StrategyRule[];
  riskManagement: {
    stopLoss: StrategyOperand | null;
    takeProfit: StrategyOperand | null;
    trailingStop: boolean;
    positionSize: number; // percentage
  };
  timeframe: string;
  confidence: number; // 0-100
  backtestReady: boolean;
  createdAt: number;
}

export interface DrawToStrategyConfig {
  minRuleConfidence: number;
  defaultStopLoss: number;   // percentage
  defaultTakeProfit: number; // percentage
  maxRulesPerDrawing: number;
  enableAutoRisk: boolean;
}

const DEFAULT_CONFIG: DrawToStrategyConfig = {
  minRuleConfidence: 40,
  defaultStopLoss: 5,
  defaultTakeProfit: 10,
  maxRulesPerDrawing: 8,
  enableAutoRisk: true,
};

// ═══════════════════════════════════════════════════════════
// Drawing Analyzers
// ═══════════════════════════════════════════════════════════

export class DrawingAnalyzer {
  /** Analyze horizontal support/resistance lines */
  static analyzeHorizontal(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    const price = drawing.points[0]?.price;
    if (!price) return rules;

    rules.push({
      id: `${drawing.id}_bounce_support`,
      name: `Price bounce at ${price}`,
      sourceDrawingId: drawing.id,
      sourceDrawingType: drawing.type,
      condition: { left: { type: 'price', value: 'close' }, operator: 'bounce', right: { type: 'drawing', value: price }, joinedBy: 'AND' },
      action: 'buy', priority: 5, weight: 0.7,
      description: `Buy when price bounces off ${price} with volume confirmation`,
    });
    rules.push({
      id: `${drawing.id}_break_resistance`,
      name: `Break above ${price}`,
      sourceDrawingId: drawing.id,
      sourceDrawingType: drawing.type,
      condition: { left: { type: 'price', value: 'close' }, operator: 'cross_above', right: { type: 'drawing', value: price }, joinedBy: 'AND' },
      action: 'buy', priority: 7, weight: 0.8,
      description: `Buy when price breaks above ${price} with strong volume`,
    });
    return rules;
  }

  /** Analyze trend lines */
  static analyzeTrendLine(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    if (drawing.points.length < 2) return rules;

    const [p1, p2] = drawing.points;
    const slope = p2.price - p1.price;
    const direction = slope > 0 ? 'bullish' : slope < 0 ? 'bearish' : 'neutral';

    if (slope > 0) {
      // Uptrend support
      rules.push({
        id: `${drawing.id}_trend_buy`,
        name: `Buy on trend line bounce (uptrend)`,
        sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
        condition: { left: { type: 'price', value: 'close' }, operator: 'touch', right: { type: 'drawing', value: 'trendLine' }, joinedBy: 'AND' },
        action: 'buy', priority: 6, weight: 0.75,
        description: `Buy when price touches uptrend support line with bullish candlestick`,
      });
    } else {
      // Downtrend resistance
      rules.push({
        id: `${drawing.id}_trend_sell`,
        name: `Sell on trend line rejection (downtrend)`,
        sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
        condition: { left: { type: 'price', value: 'close' }, operator: 'reject', right: { type: 'drawing', value: 'trendLine' }, joinedBy: 'AND' },
        action: 'sell', priority: 6, weight: 0.75,
        description: `Sell when price gets rejected at downtrend resistance line`,
      });
    }
    return rules;
  }

  /** Analyze Fibonacci retracement levels */
  static analyzeFibRetracement(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    const [p1, p2] = drawing.points;
    if (!p1 || !p2) return rules;
    const range = p2.price - p1.price;

    for (const level of levels) {
      const price = p1.price + range * level;
      rules.push({
        id: `${drawing.id}_fib_${level}`,
        name: `Fib ${(level * 100).toFixed(1)}% at ${price.toFixed(2)}`,
        sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
        condition: { left: { type: 'price', value: 'close' }, operator: 'bounce', right: { type: 'drawing', value: price }, joinedBy: 'AND' },
        action: level <= 0.5 ? 'buy' : 'sell',
        priority: 5, weight: 0.65 + level * 0.2,
        description: `Trade at Fibonacci ${(level * 100).toFixed(1)}% retracement level`,
      });
    }
    return rules.slice(0, DEFAULT_CONFIG.maxRulesPerDrawing);
  }

  /** Analyze parallel channels */
  static analyzeChannel(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    if (drawing.points.length < 2) return rules;

    rules.push({
      id: `${drawing.id}_channel_bottom`,
      name: `Buy at channel support`,
      sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
      condition: { left: { type: 'price', value: 'close' }, operator: 'touch', right: { type: 'drawing', value: 'channelBottom' }, joinedBy: 'AND' },
      action: 'buy', priority: 5, weight: 0.6,
      description: `Buy when price reaches channel support bottom`,
    });
    rules.push({
      id: `${drawing.id}_channel_top`,
      name: `Sell at channel resistance`,
      sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
      condition: { left: { type: 'price', value: 'close' }, operator: 'touch', right: { type: 'drawing', value: 'channelTop' }, joinedBy: 'AND' },
      action: 'sell', priority: 5, weight: 0.6,
      description: `Sell when price reaches channel resistance top`,
    });
    return rules;
  }

  /** Analyze harmonic patterns (Gartley, Bat, Butterfly, Crab, Shark, Cypher) */
  static analyzeHarmonic(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    const patternName = drawing.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const isBearish = drawing.points.length >= 4 && drawing.points[drawing.points.length - 1].price > drawing.points[0].price;

    rules.push({
      id: `${drawing.id}_harmonic_entry`,
      name: `${patternName} Pattern Entry`,
      sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
      condition: { left: { type: 'price', value: 'close' }, operator: 'touch', right: { type: 'drawing', value: 'patternZone' }, joinedBy: 'AND' },
      action: isBearish ? 'sell' : 'buy',
      priority: 8, weight: 0.9,
      description: `${patternName} harmonic pattern detected — trade at Pattern Completion Zone`,
    });
    return rules;
  }

  /** Analyze price patterns (H&S, double tops/bottoms, triangles, flags, etc.) */
  static analyzePricePattern(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    const patternMap: Record<string, { action: 'buy' | 'sell'; desc: string; priority: number }> = {
      head_shoulders: { action: 'sell', desc: 'Head & Shoulders breakdown below neckline', priority: 9 },
      inverse_head_shoulders: { action: 'buy', desc: 'Inverse Head & Shoulders breakout above neckline', priority: 9 },
      double_top: { action: 'sell', desc: 'Double Top breakdown below neckline', priority: 8 },
      double_bottom: { action: 'buy', desc: 'Double Bottom breakout above neckline', priority: 8 },
      triple_top: { action: 'sell', desc: 'Triple Top breakdown', priority: 8 },
      triple_bottom: { action: 'buy', desc: 'Triple Bottom breakout', priority: 8 },
      ascending_triangle: { action: 'buy', desc: 'Ascending Triangle breakout above resistance', priority: 7 },
      descending_triangle: { action: 'sell', desc: 'Descending Triangle breakdown below support', priority: 7 },
      symmetrical_triangle: { action: 'buy', desc: 'Symmetrical Triangle breakout', priority: 6 },
      flag: { action: 'buy', desc: 'Bull Flag breakout', priority: 7 },
      pennant: { action: 'buy', desc: 'Pennant breakout', priority: 7 },
      cup_handle: { action: 'buy', desc: 'Cup & Handle breakout', priority: 8 },
      rising_wedge: { action: 'sell', desc: 'Rising Wedge breakdown', priority: 6 },
      falling_wedge: { action: 'buy', desc: 'Falling Wedge breakout', priority: 7 },
      megaphone: { action: 'sell', desc: 'Megaphone pattern — reversal', priority: 5 },
    };

    const config = patternMap[drawing.type];
    if (config) {
      rules.push({
        id: `${drawing.id}_pattern_breakout`,
        name: `${config.desc.split(' ').slice(0, 2).join(' ')} signal`,
        sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
        condition: { left: { type: 'price', value: 'close' }, operator: config.action === 'buy' ? 'break_out' : 'break_down', right: { type: 'drawing', value: 'patternLine' }, joinedBy: 'AND' },
        action: config.action, priority: config.priority, weight: 0.7 + config.priority * 0.03,
        description: config.desc,
      });
    }
    return rules;
  }

  /** Analyze support/resistance zones */
  static analyzeSupportResistance(drawing: DrawingObject): StrategyRule[] {
    const rules: StrategyRule[] = [];
    const props = drawing.properties;
    const isSupport = props.isSupport !== false;

    rules.push({
      id: `${drawing.id}_sr_${isSupport ? 'support' : 'resistance'}`,
      name: isSupport ? 'Support zone bounce' : 'Resistance zone rejection',
      sourceDrawingId: drawing.id, sourceDrawingType: drawing.type,
      condition: {
        left: { type: 'price', value: 'close' },
        operator: isSupport ? 'bounce' : 'reject',
        right: { type: 'drawing', value: isSupport ? 'supportZone' : 'resistanceZone' },
        joinedBy: 'AND',
      },
      action: isSupport ? 'buy' : 'sell', priority: 6, weight: 0.7,
      description: isSupport ? 'Buy on support zone bounce with confirmation' : 'Sell on resistance zone rejection with confirmation',
    });
    return rules;
  }

  /** Dispatch to the proper analyzer based on drawing type */
  static analyze(drawing: DrawingObject): StrategyRule[] {
    switch (drawing.type) {
      case 'horizontal_line': return this.analyzeHorizontal(drawing);
      case 'trend_line': case 'ray_line': case 'speed_line':
        return this.analyzeTrendLine(drawing);
      case 'fib_retracement': case 'fib_extension': return this.analyzeFibRetracement(drawing);
      case 'parallel_channel': case 'regression_channel':
        return this.analyzeChannel(drawing);
      case 'gartley': case 'bat_pattern': case 'butterfly': case 'crab_pattern':
      case 'shark_pattern': case 'cypher_pattern':
        return this.analyzeHarmonic(drawing);
      case 'head_shoulders': case 'inverse_head_shoulders': case 'double_top': case 'double_bottom':
      case 'triple_top': case 'triple_bottom': case 'triangle': case 'ascending_triangle':
      case 'descending_triangle': case 'symmetrical_triangle': case 'flag': case 'pennant':
      case 'cup_handle': case 'megaphone': case 'rising_wedge': case 'falling_wedge':
        return this.analyzePricePattern(drawing);
      case 'support_resistance': return this.analyzeSupportResistance(drawing);
      case 'rectangle': return this.analyzeChannel(drawing);
      default: return [];
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Strategy Generator
// ═══════════════════════════════════════════════════════════

export class DrawingToStrategyEngine {
  private strategies: Map<string, GeneratedStrategy> = new Map();
  private config: DrawToStrategyConfig;

  constructor(config?: Partial<DrawToStrategyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void { this.strategies.clear(); }

  /** Generate a strategy from a set of drawings */
  generate(name: string, description: string, drawings: DrawingObject[], symbol: string, timeframe = '1h'): GeneratedStrategy {
    const allRules: StrategyRule[] = [];

    for (const drawing of drawings) {
      const rules = DrawingAnalyzer.analyze(drawing);
      allRules.push(...rules);
    }

    // Deduplicate by condition + action
    const seen = new Set<string>();
    const uniqueRules = allRules.filter((r) => {
      const key = `${r.condition.operator}_${r.condition.left.value}_${r.condition.right.value}_${r.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, this.config.maxRulesPerDrawing * drawings.length);

    // Calculate confidence based on drawing types used
    const typeMultiplier = drawings.map((d) => {
      if (['head_shoulders', 'inverse_head_shoulders', 'double_top', 'double_bottom', 'gartley', 'bat_pattern', 'butterfly', 'crab_pattern'].includes(d.type)) return 1.5;
      if (['trend_line', 'fib_retracement', 'horizontal_line', 'triangle', 'ascending_triangle', 'descending_triangle'].includes(d.type)) return 1.0;
      return 0.5;
    });
    const baseConfidence = drawings.length > 0 ? (typeMultiplier.reduce((s, m) => s + m, 0) / drawings.length) * 50 : 30;
    const confidence = Math.min(95, Math.round(baseConfidence + (uniqueRules.length > 3 ? 10 : 0)));

    const strategy: GeneratedStrategy = {
      id: crypto.randomUUID(),
      name, description, drawings, symbol,
      rules: uniqueRules,
      riskManagement: {
        stopLoss: this.config.enableAutoRisk ? { type: 'constant', value: this.config.defaultStopLoss, params: { unit: 'percent' } } : null,
        takeProfit: this.config.enableAutoRisk ? { type: 'constant', value: this.config.defaultTakeProfit, params: { unit: 'percent' } } : null,
        trailingStop: this.config.enableAutoRisk,
        positionSize: 10,
      },
      timeframe, confidence, backtestReady: uniqueRules.length >= 2,
      createdAt: Date.now(),
    };

    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  /** Add a manual rule to existing strategy */
  addRule(strategyId: string, rule: StrategyRule): GeneratedStrategy | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;
    strategy.rules.push(rule);
    return strategy;
  }

  /** Remove a rule by id */
  removeRule(strategyId: string, ruleId: string): GeneratedStrategy | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;
    strategy.rules = strategy.rules.filter((r) => r.id !== ruleId);
    return strategy;
  }

  /** Update risk parameters */
  updateRisk(strategyId: string, risk: Partial<GeneratedStrategy['riskManagement']>): GeneratedStrategy | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;
    Object.assign(strategy.riskManagement, risk);
    return strategy;
  }

  get(id: string): GeneratedStrategy | undefined { return this.strategies.get(id); }
  list(): GeneratedStrategy[] { return [...this.strategies.values()]; }

  /** Get drawing type support status */
  getSupportedDrawingTypes(): { type: DrawingToolType; supported: boolean; ruleCount: number }[] {
    const types: DrawingToolType[] = [
      'horizontal_line', 'trend_line', 'fib_retracement', 'parallel_channel',
      'gartley', 'bat_pattern', 'butterfly', 'crab_pattern', 'shark_pattern', 'cypher_pattern',
      'head_shoulders', 'inverse_head_shoulders', 'double_top', 'double_bottom',
      'triple_top', 'triple_bottom', 'ascending_triangle', 'descending_triangle',
      'symmetrical_triangle', 'flag', 'pennant', 'cup_handle', 'support_resistance',
      'rectangle', 'rising_wedge', 'falling_wedge', 'megaphone', 'ray_line',
      'speed_line', 'regression_channel', 'fib_extension',
    ];
    return types.map((type) => {
      const rules = DrawingAnalyzer.analyze({ id: 'test', type, symbol: 'TEST', points: [{ x: 0, y: 0, price: 100, timestamp: 0 }, { x: 1, y: 1, price: 105, timestamp: 1 }], properties: {}, createdAt: 0 });
      return { type, supported: rules.length > 0, ruleCount: rules.length };
    });
  }

  /** Export strategy as JSON for backtesting */
  export(strategyId: string): string | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;
    return JSON.stringify(strategy, null, 2);
  }

  /** Batch generate strategies: one per drawing (used for rapid prototyping) */
  batchGenerate(symbol: string, drawings: DrawingObject[], timeframe = '1h'): GeneratedStrategy[] {
    return drawings.map((d, i) =>
      this.generate(`Strategy from ${d.type}_${i + 1}`, `Auto-generated from ${d.type} on ${symbol}`, [d], symbol, timeframe)
    );
  }
}

// ═══════════ Singleton ═══════════

let dtsInstance: DrawingToStrategyEngine | null = null;
export function getDrawingToStrategyEngine(config?: Partial<DrawToStrategyConfig>): DrawingToStrategyEngine {
  if (!dtsInstance) dtsInstance = new DrawingToStrategyEngine(config);
  return dtsInstance;
}
export function resetDrawingToStrategyEngine(): void { dtsInstance = null; }
