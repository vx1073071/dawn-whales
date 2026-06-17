// ── R266 JVS-2 指标 AI 解读引擎 (IndicatorAIInterpretationEngine) ──
// 接收指标计算结果 → 返回自然语言解读 + 置信度 + 多指标综合诊断
// 定价: 1 USDT/次 AI对话 → 复用 ai-orchestrator 计费

export interface IndicatorValue {
  /** Indicator id (e.g. 'rsi', 'macd', 'stoch', 'keltner') */
  indicator: string;
  /** Human-readable name */
  name: string;
  /** Current value (number or string for crossover signals) */
  value: number | null;
  /** Signal value (e.g. MACD signal line, STOCH D line) */
  signal?: number | null;
  /** Histogram / oscillator value */
  histogram?: number | null;
  /** Additional context */
  params?: Record<string, number>;
}

export interface InterpretationRequest {
  indicators: IndicatorValue[];
  symbol?: string;
  timeframe?: string;
  price?: number;
  locale?: string;
}

export interface IndicatorInterpretation {
  indicator: string;
  name: string;
  /** Primary interpretation in natural language */
  interpretation: string;
  /** Action signal: bullish / bearish / neutral */
  signal: 'bullish' | 'bearish' | 'neutral';
  /** Signal strength 0-100 */
  strength: number;
  /** Key metric(s) extracted */
  metrics: string[];
  /** Common pitfalls / false signals */
  warnings: string[];
  /** Confidence score 0-100 */
  confidence: number;
}

export interface CompositeDiagnosis {
  /** Overall market bias */
  overallBias: 'bullish' | 'bearish' | 'neutral' | 'conflicting';
  /** Agreement score: % of indicators pointing same direction */
  agreementScore: number;
  /** Number of indicators analyzed */
  indicatorCount: number;
  /** Bullish count */
  bullishCount: number;
  /** Bearish count */
  bearishCount: number;
  /** Neutral count */
  neutralCount: number;
  /** Per-indicator interpretations */
  interpretations: IndicatorInterpretation[];
  /** Summary paragraph */
  summary: string;
  /** Key confluence points (indicators agreeing) */
  confluences: string[];
  /** Key divergence points (indicators disagreeing) */
  divergences: string[];
  /** Actionable suggestion */
  suggestion: string;
  /** Risk level: low / medium / high */
  riskLevel: 'low' | 'medium' | 'high';
  /** Billing: always 1 USDT per invocation */
  billingUnits: number;
}

export interface AIInterpretationConfig {
  /** Language for output */
  locale?: string;
  /** Include detailed reasoning */
  verbose?: boolean;
  /** Maximum indicators to process */
  maxIndicators?: number;
  /** Confidence floor for warnings */
  warningThreshold?: number;
  /** Enable confluence detection */
  detectConfluence?: boolean;
}

export const DEFAULT_AI_INTERPRETATION_CONFIG: Required<AIInterpretationConfig> = {
  locale: 'zh',
  verbose: true,
  maxIndicators: 20,
  warningThreshold: 30,
  detectConfluence: true,
};

// ═══════════ Interpretation Rule Definitions ═══════════

interface InterpretationRule {
  condition: (v: IndicatorValue) => boolean;
  interpretation: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  warnings: string[];
  metrics: string[];
}

const INTERPRETATION_RULES: Record<string, InterpretationRule[]> = {
  rsi: [
    {
      condition: (v) => (v.value ?? 0) > 70,
      interpretation: 'RSI 处于超买区域 (>70)，短期可能面临回调压力。注意：强势上涨行情中 RSI 可长期维持超买',
      signal: 'bearish',
      strength: 75,
      warnings: ['强势趋势中 RSI 超买可持续数周，单独使用不可靠', '需结合趋势指标确认是否真正见顶'],
      metrics: ['RSI值', '超买超卖区间'],
    },
    {
      condition: (v) => (v.value ?? 0) < 30,
      interpretation: 'RSI 处于超卖区域 (<30)，短期可能出现技术性反弹。注意：下跌趋势中超卖后仍可能继续下跌',
      signal: 'bullish',
      strength: 75,
      warnings: ['熊市中 RSI 可持续超卖', '需成交量配合确认反弹有效性'],
      metrics: ['RSI值', '超买超卖区间'],
    },
    {
      condition: (v) => (v.value ?? 0) > 50 && (v.value ?? 0) <= 70,
      interpretation: 'RSI 偏强 (50-70)，多头占优但未过热，趋势健康',
      signal: 'bullish',
      strength: 55,
      warnings: [],
      metrics: ['RSI值', '中性偏强区间'],
    },
    {
      condition: (v) => (v.value ?? 0) >= 30 && (v.value ?? 0) <= 50,
      interpretation: 'RSI 偏弱 (30-50)，空头占优，价格动能不足',
      signal: 'bearish',
      strength: 55,
      warnings: [],
      metrics: ['RSI值', '中性偏弱区间'],
    },
  ],
  macd: [
    {
      condition: (v) => (v.histogram ?? 0) > 0 && (v.value ?? 0) > (v.signal ?? 0),
      interpretation: 'MACD 金叉且柱状图为正，多头趋势确立，动能持续增强',
      signal: 'bullish',
      strength: 80,
      warnings: ['MACD 滞后于价格，金叉确认时可能已错过最佳入场', '震荡市中 MACD 频繁交叉，信号可靠性降低'],
      metrics: ['MACD线', '信号线', '柱状图', '零轴位置'],
    },
    {
      condition: (v) => (v.histogram ?? 0) < 0 && (v.value ?? 0) < (v.signal ?? 0),
      interpretation: 'MACD 死叉且柱状图为负，空头趋势确立，动能持续减弱',
      signal: 'bearish',
      strength: 80,
      warnings: ['MACD 死叉是滞后信号', '需确认是否只是短期回调'],
      metrics: ['MACD线', '信号线', '柱状图', '零轴位置'],
    },
    {
      condition: (v) => (v.histogram ?? 0) > 0 && (v.value ?? 0) < (v.signal ?? 0),
      interpretation: 'MACD 柱转正但快线仍在慢线下方，动能正在转换但趋势尚未确认',
      signal: 'neutral',
      strength: 40,
      warnings: ['金叉尚未完成，存在假突破风险'],
      metrics: ['MACD线', '信号线', '柱状图方向'],
    },
  ],
  stoch: [
    {
      condition: (v) => (v.value ?? 0) > 80,
      interpretation: '随机指标处于超买区 (>80)，短线可能回调。若 K 线向下穿越 D 线则为卖出信号',
      signal: 'bearish',
      strength: 70,
      warnings: ['趋势行情中 STOCH 可长期钝化于超买区'],
      metrics: ['%K值', '%D值', '超买超卖区间'],
    },
    {
      condition: (v) => (v.value ?? 0) < 20,
      interpretation: '随机指标处于超卖区 (<20)，短线可能反弹。若 K 线向上穿越 D 线则为买入信号',
      signal: 'bullish',
      strength: 70,
      warnings: ['超卖后可能继续下跌，需等待 K/D 金叉确认'],
      metrics: ['%K值', '%D值', '超买超卖区间'],
    },
    {
      condition: (v) => (v.value ?? 0) >= 20 && (v.value ?? 0) <= 80,
      interpretation: '随机指标处于中性区间，K/D 线的交叉方向决定短线走势',
      signal: 'neutral',
      strength: 30,
      warnings: [],
      metrics: ['%K值', '%D值', 'K/D交叉'],
    },
  ],
  bollinger: [
    {
      condition: (v) => {
        const params = v.params || {};
        const upperBand = params.upper || 0;
        const price = params.price || 0;
        return price > upperBand;
      },
      interpretation: '价格突破布林带上轨，短期超买。若伴随放量突破，可能开启主升浪；否则大概率回归中轨',
      signal: 'neutral',
      strength: 50,
      warnings: ['突破上轨不一定反转：强势股可持续沿上轨运行', '需结合成交量判断'],
      metrics: ['价格vs上轨', '带宽'],
    },
    {
      condition: (v) => {
        const params = v.params || {};
        const lowerBand = params.lower || 0;
        const price = params.price || 0;
        return price < lowerBand;
      },
      interpretation: '价格跌破布林带下轨，短期超卖。缩量跌破可能反弹，放量跌破则趋势转弱',
      signal: 'neutral',
      strength: 50,
      warnings: ['跌破下轨可能继续下跌，需确认支撑'],
      metrics: ['价格vs下轨', '带宽', '成交量'],
    },
  ],
  keltner: [
    {
      condition: (v) => {
        const params = v.params || {};
        return (params.priceClose || 0) > (params.upper || Infinity);
      },
      interpretation: '收盘价突破肯特纳通道上轨，强势突破信号。相比布林带，肯特纳通道突破假信号更少',
      signal: 'bullish',
      strength: 70,
      warnings: ['突破后可能回踩确认'],
      metrics: ['收盘价', '上轨', '中轨'],
    },
    {
      condition: (v) => {
        const params = v.params || {};
        return (params.priceClose || 0) < (params.lower || -Infinity);
      },
      interpretation: '收盘价跌破肯特纳通道下轨，趋势走弱。通常比布林带下轨突破更可靠',
      signal: 'bearish',
      strength: 70,
      warnings: ['存在假跌破可能，需等下一根K线确认'],
      metrics: ['收盘价', '下轨', '中轨'],
    },
  ],
  cmo: [
    {
      condition: (v) => (v.value ?? 0) > 50,
      interpretation: '钱德动量摆动指标 (CMO) > 50，表明上涨动量显著强于下跌动量，趋势偏多',
      signal: 'bullish',
      strength: 65,
      warnings: [],
      metrics: ['CMO值', '50分界线'],
    },
    {
      condition: (v) => (v.value ?? 0) < -50,
      interpretation: '钱德动量摆动指标 (CMO) < -50，表明下跌动量显著强于上涨动量，趋势偏空',
      signal: 'bearish',
      strength: 65,
      warnings: [],
      metrics: ['CMO值', '-50分界线'],
    },
  ],
  aroon: [
    {
      condition: (v) => {
        const params = v.params || {};
        const up = params.up ?? 0;
        const down = params.down ?? 0;
        return up > 70 && down < 30;
      },
      interpretation: '阿隆指标显示上升趋势强劲：Aroon Up > 70 且 Aroon Down < 30，新高频现，趋势向上确立',
      signal: 'bullish',
      strength: 75,
      warnings: [],
      metrics: ['Aroon Up', 'Aroon Down'],
    },
    {
      condition: (v) => {
        const params = v.params || {};
        const up = params.up ?? 0;
        const down = params.down ?? 0;
        return down > 70 && up < 30;
      },
      interpretation: '阿隆指标显示下跌趋势强劲：Aroon Down > 70 且 Aroon Up < 30，新低频现，趋势向下确立',
      signal: 'bearish',
      strength: 75,
      warnings: [],
      metrics: ['Aroon Up', 'Aroon Down'],
    },
  ],
  forceindex: [
    {
      condition: (v) => (v.value ?? 0) > 0,
      interpretation: '力量指数为正值，买盘力量主导。数值越大表明上涨动能越强',
      signal: 'bullish',
      strength: 55,
      warnings: ['力量指数对成交量敏感，单日异常放量可能导致信号失真'],
      metrics: ['力量指数值', '零轴'],
    },
    {
      condition: (v) => (v.value ?? 0) < 0,
      interpretation: '力量指数为负值，卖盘力量主导。数值越小（越负）表明下跌动能越强',
      signal: 'bearish',
      strength: 55,
      warnings: ['需结合趋势指标过滤噪音'],
      metrics: ['力量指数值', '零轴'],
    },
  ],
  chaikinOsc: [
    {
      condition: (v) => (v.value ?? 0) > 0,
      interpretation: '蔡金资金流 (CMF) 为正，表明资金正在流入该标的，聪明钱偏多',
      signal: 'bullish',
      strength: 60,
      warnings: ['CMF 是累积/分布指标，短期波动可能不反映真实资金流向'],
      metrics: ['CMF值', '零轴位置'],
    },
    {
      condition: (v) => (v.value ?? 0) < 0,
      interpretation: '蔡金资金流 (CMF) 为负，表明资金正在流出该标的，聪明钱偏空',
      signal: 'bearish',
      strength: 60,
      warnings: ['单日负值不足以判断趋势，需看连续多日方向'],
      metrics: ['CMF值', '零轴位置'],
    },
  ],
  bop: [
    {
      condition: (v) => (v.value ?? 0) > 0.3,
      interpretation: '力量平衡指标 (BOP) > 0.3，多头完全控盘，收盘价接近最高价',
      signal: 'bullish',
      strength: 70,
      warnings: ['单日极端值可能是短期情绪爆发，次日可能回落'],
      metrics: ['BOP值', '±0.3阈值'],
    },
    {
      condition: (v) => (v.value ?? 0) < -0.3,
      interpretation: '力量平衡指标 (BOP) < -0.3，空头完全控盘，收盘价接近最低价',
      signal: 'bearish',
      strength: 70,
      warnings: ['连续极端值表明趋势加速，但也可能是赶底/赶顶'],
      metrics: ['BOP值', '±0.3阈值'],
    },
  ],
  dpo: [
    {
      condition: (v) => (v.value ?? 0) > 0,
      interpretation: '去趋势价格震荡指标 (DPO) > 0，表明当前价格高于历史移动平均，短期偏多',
      signal: 'bullish',
      strength: 50,
      warnings: ['DPO 是短周期指标，反映的是相对于历史均值的偏离，不预测方向'],
      metrics: ['DPO值', '零轴'],
    },
    {
      condition: (v) => (v.value ?? 0) < 0,
      interpretation: '去趋势价格震荡指标 (DPO) < 0，表明当前价格低于历史移动平均，短期偏空',
      signal: 'bearish',
      strength: 50,
      warnings: ['DPO 偏离大时不一定是反转信号，可能是趋势加速'],
      metrics: ['DPO值', '零轴'],
    },
  ],
};

// Default generic rule when indicator has value but no specific rule matches
const DEFAULT_INTERPRETATION = {
  condition: () => true,
  interpretation: '该指标当前处于常规区间，无极端信号，建议结合其他指标综合判断',
  signal: 'neutral' as const,
  strength: 20,
  warnings: [],
  metrics: ['当前值'],
};

// ═══════════ Engine ═══════════

export class IndicatorAIInterpretationEngine {
  private config: Required<AIInterpretationConfig>;

  constructor(config?: AIInterpretationConfig) {
    this.config = { ...DEFAULT_AI_INTERPRETATION_CONFIG, ...config };
  }

  reset(): void {
    // stateless engine
  }

  getConfig(): Required<AIInterpretationConfig> {
    return { ...this.config };
  }

  updateConfig(patch: Partial<AIInterpretationConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  // ═══════════ Single Indicator Interpretation ═══════════

  /**
   * Generate natural language interpretation for a single indicator value.
   */
  interpretIndicator(indicator: IndicatorValue, price?: number): IndicatorInterpretation {
    const indicatorLower = indicator.indicator.toLowerCase();
    const rules = INTERPRETATION_RULES[indicatorLower];

    // Inject price into params if available
    if (price !== undefined) {
      indicator.params = { ...indicator.params, price };
    }

    let matchedRule: InterpretationRule | null = null;

    if (rules) {
      for (const rule of rules) {
        if (rule.condition(indicator)) {
          matchedRule = rule;
          break;
        }
      }
    }

    if (!matchedRule) {
      matchedRule = {
        ...DEFAULT_INTERPRETATION,
        interpretation: indicator.value !== null
          ? `${indicator.name || indicator.indicator} 当前值为 ${typeof indicator.value === 'number' ? indicator.value.toFixed(2) : indicator.value}，处于正常波动范围`
          : `${indicator.name || indicator.indicator} 无法获取有效值，请检查数据源`,
      };
    }

    // Calculate confidence based on indicator data quality
    let confidence = matchedRule.strength;
    if (indicator.value === null) confidence = Math.min(confidence, 10);
    if (indicator.signal === null && ['macd', 'stoch'].includes(indicatorLower)) {
      confidence = Math.min(confidence, 50);
    }

    return {
      indicator: indicator.indicator,
      name: indicator.name || indicator.indicator.toUpperCase(),
      interpretation: matchedRule.interpretation,
      signal: matchedRule.signal,
      strength: matchedRule.strength,
      metrics: matchedRule.metrics,
      warnings: matchedRule.warnings,
      confidence,
    };
  }

  // ═══════════ Composite Diagnosis (Multi-Indicator) ═══════════

  /**
   * Run full composite diagnosis on multiple indicators.
   * This is the main entry point for the 1 USDT/次 billing.
   */
  diagnose(request: InterpretationRequest): CompositeDiagnosis {
    const { indicators, symbol, timeframe, price, locale } = request;

    // Apply locale if provided
    if (locale) this.config.locale = locale;

    const limited = indicators.slice(0, this.config.maxIndicators);

    // Interpret each indicator
    const interpretations = limited.map((ind) =>
      this.interpretIndicator(ind, price),
    );

    // Count signals
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    for (const interp of interpretations) {
      if (interp.signal === 'bullish') bullishCount++;
      else if (interp.signal === 'bearish') bearishCount++;
      else neutralCount++;
    }

    // Agreement score: what % agree on the dominant direction
    const total = interpretations.length || 1;
    const maxDirection = Math.max(bullishCount, bearishCount, neutralCount);
    const agreementScore = Math.round((maxDirection / total) * 100);

    // Overall bias
    let overallBias: CompositeDiagnosis['overallBias'] = 'neutral';
    if (bullishCount > bearishCount && bullishCount > neutralCount) {
      overallBias = 'bullish';
    } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
      overallBias = 'bearish';
    } else if (bullishCount === bearishCount && bullishCount > 0) {
      overallBias = 'conflicting';
    }

    // Confluences: indicators pointing same direction with high confidence
    const confluences: string[] = [];
    const bullishIndicators = interpretations
      .filter((i) => i.signal === 'bullish' && i.confidence >= 50)
      .map((i) => i.name);
    const bearishIndicators = interpretations
      .filter((i) => i.signal === 'bearish' && i.confidence >= 50)
      .map((i) => i.name);

    if (bullishIndicators.length >= 2) {
      confluences.push(
        `多头共振：${bullishIndicators.join('、')} 同时发出看涨信号`,
      );
    }
    if (bearishIndicators.length >= 2) {
      confluences.push(
        `空头共振：${bearishIndicators.join('、')} 同时发出看跌信号`,
      );
    }

    // Divergences: conflicting signals
    const divergences: string[] = [];
    if (bullishIndicators.length > 0 && bearishIndicators.length > 0) {
      divergences.push(
        `信号分歧：${bullishIndicators.join('、')} 看涨 vs ${bearishIndicators.join('、')} 看跌，建议等待方向明确`,
      );
    }

    // Risk level
    let riskLevel: CompositeDiagnosis['riskLevel'] = 'medium';
    if (agreementScore >= 75) riskLevel = 'low';
    if (agreementScore < 40 && overallBias === 'conflicting') riskLevel = 'high';

    // Summary
    const symbolStr = symbol ? `${symbol} ` : '';
    const tfStr = timeframe ? ` ${timeframe}级别` : '';

    let summary = '';
    if (overallBias === 'bullish') {
      summary = `${symbolStr}${tfStr}技术指标综合诊断为看多，${bullishCount}/${total} 个指标发出看涨信号，一致度 ${agreementScore}%。`;
    } else if (overallBias === 'bearish') {
      summary = `${symbolStr}${tfStr}技术指标综合诊断为看空，${bearishCount}/${total} 个指标发出看跌信号，一致度 ${agreementScore}%。`;
    } else if (overallBias === 'conflicting') {
      summary = `${symbolStr}${tfStr}技术指标多空分歧明显（多${bullishCount}/空${bearishCount}），一致度仅 ${agreementScore}%，建议观望或降低仓位。`;
    } else {
      summary = `${symbolStr}${tfStr}技术指标中性，大部分指标未发出明确方向信号，建议等待突破确认。`;
    }

    // Suggestion
    let suggestion = '';
    switch (overallBias) {
      case 'bullish':
        suggestion = riskLevel === 'low'
          ? '指标高度一致看多，可考虑顺势做多，建议设好止损'
          : '多数指标偏多，建议轻仓参与，注意回踩风险';
        break;
      case 'bearish':
        suggestion = riskLevel === 'low'
          ? '指标高度一致看空，建议减仓或观望，不宜逆势做多'
          : '多数指标偏空，已有持仓建议设好止损，空仓者等待企稳信号';
        break;
      case 'conflicting':
        suggestion = '多空分歧严重，不建议新开仓。已有持仓建议收紧止损，待方向明确后再操作';
        break;
      default:
        suggestion = '当前无明确方向，建议等待关键支撑/阻力突破后再决策';
    }

    return {
      overallBias,
      agreementScore,
      indicatorCount: interpretations.length,
      bullishCount,
      bearishCount,
      neutralCount,
      interpretations,
      summary,
      confluences,
      divergences,
      suggestion,
      riskLevel,
      billingUnits: 1,
    };
  }

  // ═══════════ Quick Scan (lightweight, no composite) ═══════════

  /**
   * Quick scan: just the signal summary without full interpretations.
   * Useful for watchlist overview / screening.
   */
  quickScan(indicators: IndicatorValue[]): {
    total: number;
    bullish: number;
    bearish: number;
    neutral: number;
    bias: 'bullish' | 'bearish' | 'neutral';
    topSignal: string | null;
  } {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    let topSignal: string | null = null;
    let topStrength = 0;

    for (const ind of indicators) {
      const interp = this.interpretIndicator(ind);
      if (interp.signal === 'bullish') bullish++;
      else if (interp.signal === 'bearish') bearish++;
      else neutral++;

      if (interp.strength > topStrength) {
        topStrength = interp.strength;
        topSignal = interp.interpretation;
      }
    }

    let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (bullish > bearish && bullish > neutral) bias = 'bullish';
    else if (bearish > bullish && bearish > neutral) bias = 'bearish';

    return {
      total: indicators.length,
      bullish,
      bearish,
      neutral,
      bias,
      topSignal,
    };
  }

  // ═══════════ Divergence Detection ═══════════

  /**
   * Detect divergences between price and indicator.
   * Bullish divergence: price makes lower low, indicator makes higher low.
   * Bearish divergence: price makes higher high, indicator makes lower high.
   */
  detectDivergence(
    priceValues: number[],
    indicatorValues: (number | null)[],
  ): { type: 'bullish' | 'bearish' | 'none'; description: string } {
    if (priceValues.length < 3 || indicatorValues.length < 3) {
      return { type: 'none', description: '数据点不足，无法检测背离' };
    }

    // Take last 3 swing points
    const validIndices = indicatorValues
      .map((v, i) => (v !== null ? i : -1))
      .filter((i) => i >= 0);

    if (validIndices.length < 3) {
      return { type: 'none', description: '指标有效数据不足' };
    }

    const last3 = validIndices.slice(-3);
    const p1 = priceValues[last3[0]];
    const p2 = priceValues[last3[1]];
    const p3 = priceValues[last3[2]];
    const i1 = indicatorValues[last3[0]]!;
    const i2 = indicatorValues[last3[1]]!;
    const i3 = indicatorValues[last3[2]]!;

    // Bullish divergence: price ↓↓ but indicator ↑↑
    if (p3 < p1 && i3 > i1) {
      return {
        type: 'bullish',
        description: `看涨背离：价格创新低 (${p3.toFixed(2)} < ${p1.toFixed(2)})，但指标走高 (${i3.toFixed(2)} > ${i1.toFixed(2)})，下跌动能减弱`,
      };
    }

    // Bearish divergence: price ↑↑ but indicator ↓↓
    if (p3 > p1 && i3 < i1) {
      return {
        type: 'bearish',
        description: `看跌背离：价格创新高 (${p3.toFixed(2)} > ${p1.toFixed(2)})，但指标走低 (${i3.toFixed(2)} < ${i1.toFixed(2)})，上涨动能减弱`,
      };
    }

    return { type: 'none', description: '未检测到明显背离' };
  }

  // ═══════════ Supported Indicators ═══════════

  /**
   * Return list of indicators with interpretation rules.
   */
  getSupportedIndicators(): string[] {
    return Object.keys(INTERPRETATION_RULES);
  }
}

// ═══════════ Singleton ═══════════

let aiInterpretationInstance: IndicatorAIInterpretationEngine | null = null;

export function getIndicatorAIInterpretationEngine(config?: AIInterpretationConfig): IndicatorAIInterpretationEngine {
  if (!aiInterpretationInstance) {
    aiInterpretationInstance = new IndicatorAIInterpretationEngine(config);
  } else if (config) {
    aiInterpretationInstance.updateConfig(config);
  }
  return aiInterpretationInstance;
}

export function resetIndicatorAIInterpretationEngine(): void {
  aiInterpretationInstance = null;
}
