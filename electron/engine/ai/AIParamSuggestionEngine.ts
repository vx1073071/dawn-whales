/**
 * AIParamSuggestionEngine.ts — R228 JVS-2.4c: AI参数建议引擎
 *
 * Pure-logic parameter suggestion engine. No DeepSeek dependency.
 * Cost: 1 USDT per invocation (billed via ai-param-fill service).
 *
 * Input:  factorId + market + style → Output: parameter suggestions
 *
 * API:
 *   - suggest(input)          → AIParamSuggestion
 *   - suggestBatch(inputs)    → AIParamSuggestion[]
 *   - getPricing()            → { costPerCall: number }
 *
 * ≥250 lines.
 */

import type { MarketCode, StyleCode } from '../../strategies/StrategyRecommender';

// ─── Types ────────────────────────────────────────────────────────────

export interface AIParamSuggestionInput {
  factorId: string;
  market: MarketCode;
  style: StyleCode;
  currentValues?: Record<string, number>;
}

export interface ParameterSuggestion {
  paramName: string;
  paramLabel: string;
  currentValue: number;
  suggestedValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  reason: string;
  confidence: number;  // 0-1
}

export interface AIParamSuggestion {
  factorId: string;
  market: string;
  style: string;
  suggestions: ParameterSuggestion[];
  summary: string;
  billingId: string;
  costUSDT: number;
  generatedAt: number;
}

export interface AIParamSuggestionConfig {
  costPerCall: number;    // USDT per suggestion
  billingService: string;
}

// ─── Default Config ───────────────────────────────────────────────────

const DEFAULT_CONFIG: AIParamSuggestionConfig = {
  costPerCall: 1,       // 1 USDT per session (AI智能填充参数 row)
  billingService: 'ai-param-fill',
};

// ─── Factor Parameter Knowledge Base ──────────────────────────────────

interface FactorParamRules {
  factorId: string;
  params: Array<{
    paramName: string;
    paramLabel: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    default: number;
    styleAdjustments: Record<string, { factor: number; reason: string }>;
    marketAdjustments: Record<string, { offset: number; reason: string }>;
  }>;
}

/**
 * Knowledge base: factor-specific parameter adjustment rules.
 * Each rule defines how a parameter should be adjusted based on
 * market (geographic) and style (risk profile).
 */
const FACTOR_PARAM_KNOWLEDGE: FactorParamRules[] = [
  {
    factorId: 'MOM_12M',
    params: [{
      paramName: 'lookbackPeriod',
      paramLabel: '回溯周期',
      unit: '月',
      min: 1, max: 24, step: 1, default: 12,
      styleAdjustments: {
        aggressive: { factor: 0.75, reason: '激进策略需更短回溯捕捉脉冲动量' },
        conservative: { factor: 1.5, reason: '保守策略需更长时间验证趋势' },
        moderate: { factor: 1.0, reason: '标准周期' },
      },
      marketAdjustments: {
        US: { offset: 0, reason: '美股市场流动性高，标准周期适用' },
        HK: { offset: -2, reason: '港股受政策周期影响，建议缩短' },
        CRYPTO: { offset: -6, reason: '加密货币波动大，长周期滞后严重' },
        JP: { offset: 0, reason: '日股标准' },
        EU: { offset: 1, reason: '欧洲波动较低，可适当延长' },
      },
    }, {
      paramName: 'smoothing',
      paramLabel: '平滑度',
      unit: '%',
      min: 0, max: 30, step: 5, default: 10,
      styleAdjustments: {
        aggressive: { factor: 0.5, reason: '激进策略减少平滑以提高灵敏度' },
        conservative: { factor: 2.0, reason: '保守策略增加平滑以减少噪音' },
        moderate: { factor: 1.0, reason: '标准平滑' },
      },
      marketAdjustments: {
        CRYPTO: { offset: 5, reason: '加密货币噪音大，需更强平滑' },
        US: { offset: 0, reason: '美股正常' },
        HK: { offset: 3, reason: '港股跳空频繁' },
      },
    }],
  },
  {
    factorId: 'RSI_14',
    params: [{
      paramName: 'period',
      paramLabel: '计算周期',
      unit: '根K线',
      min: 5, max: 50, step: 1, default: 14,
      styleAdjustments: {
        aggressive: { factor: 0.5, reason: '激进策略需快速RSI反应' },
        conservative: { factor: 1.5, reason: '保守策略用长周期减少假信号' },
        moderate: { factor: 1.0, reason: '标准RSI周期' },
      },
      marketAdjustments: {
        US: { offset: 0, reason: '美股标准' },
        CRYPTO: { offset: -4, reason: '加密货币15分钟图下14周期过长' },
        HK: { offset: 0, reason: '港股标准' },
      },
    }, {
      paramName: 'overbought',
      paramLabel: '超买阈值',
      unit: '%',
      min: 60, max: 95, step: 5, default: 70,
      styleAdjustments: {
        aggressive: { factor: 1.14, reason: '激进策略提高超买线等更极端信号' },
        conservative: { factor: 0.86, reason: '保守策略降低超买线以早入场' },
        moderate: { factor: 1.0, reason: '标准70超买线' },
      },
      marketAdjustments: {
        CRYPTO: { offset: 10, reason: '加密货币常态RSI偏高' },
        US: { offset: 0, reason: '美股标准' },
      },
    }, {
      paramName: 'oversold',
      paramLabel: '超卖阈值',
      unit: '%',
      min: 10, max: 50, step: 5, default: 30,
      styleAdjustments: {
        aggressive: { factor: 0.83, reason: '激进策略降低超卖线以早抄底' },
        conservative: { factor: 1.17, reason: '保守策略提高超卖线等更确定信号' },
        moderate: { factor: 1.0, reason: '标准30超卖线' },
      },
      marketAdjustments: {
        CRYPTO: { offset: -10, reason: '加密货币常态RSI偏低' },
        US: { offset: 0, reason: '美股标准' },
      },
    }],
  },
  {
    factorId: 'MACD',
    params: [{
      paramName: 'fastPeriod',
      paramLabel: '快线周期',
      unit: '根K线',
      min: 3, max: 30, step: 1, default: 12,
      styleAdjustments: {
        aggressive: { factor: 0.67, reason: '激进策略快MA缩短以捕捉快速变化' },
        conservative: { factor: 1.33, reason: '保守策略慢MA延长以过滤噪音' },
        moderate: { factor: 1.0, reason: '标准12/26/9' },
      },
      marketAdjustments: {
        US: { offset: 0, reason: '美股标准' },
        CRYPTO: { offset: -3, reason: '加密货币波动快' },
      },
    }, {
      paramName: 'slowPeriod',
      paramLabel: '慢线周期',
      unit: '根K线',
      min: 10, max: 60, step: 1, default: 26,
      styleAdjustments: {
        aggressive: { factor: 0.69, reason: '激进策略慢MA缩短' },
        conservative: { factor: 1.31, reason: '保守策略慢MA延长' },
        moderate: { factor: 1.0, reason: '标准周期' },
      },
      marketAdjustments: {
        US: { offset: 0, reason: '美股标准' },
        CRYPTO: { offset: -6, reason: '加密货币快周期' },
      },
    }],
  },
];

// ─── Engine ───────────────────────────────────────────────────────────

export class AIParamSuggestionEngine {
  private config: AIParamSuggestionConfig;
  private callCount = 0;

  constructor(config?: Partial<AIParamSuggestionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate parameter suggestions for a single factor.
   */
  suggest(input: AIParamSuggestionInput): AIParamSuggestion {
    const rules = FACTOR_PARAM_KNOWLEDGE.find(
      (r) => r.factorId.toUpperCase() === input.factorId.toUpperCase().replace('FACTOR_', '')
    );

    const suggestions: ParameterSuggestion[] = [];

    if (rules) {
      for (const param of rules.params) {
        const currentValue = input.currentValues?.[param.paramName] ?? param.default;
        const suggestedValue = this.calculateSuggestion(
          param,
          input.market,
          input.style,
          currentValue
        );

        const styleAdj = param.styleAdjustments[input.style];
        const marketAdj = param.marketAdjustments[input.market];

        const reasons: string[] = [];
        if (styleAdj) reasons.push(styleAdj.reason);
        if (marketAdj) reasons.push(marketAdj.reason);

        suggestions.push({
          paramName: param.paramName,
          paramLabel: param.paramLabel,
          currentValue,
          suggestedValue,
          min: param.min,
          max: param.max,
          step: param.step,
          unit: param.unit,
          reason: reasons.join('；') || '保持默认参数',
          confidence: styleAdj && marketAdj ? 0.85 : styleAdj || marketAdj ? 0.65 : 0.3,
        });
      }
    } else {
      // Fallback: generic suggestion for unknown factor
      suggestions.push({
        paramName: 'weight',
        paramLabel: '因子权重',
        currentValue: input.currentValues?.weight ?? 25,
        suggestedValue: input.style === 'aggressive' ? 40 : input.style === 'conservative' ? 15 : 25,
        min: 0,
        max: 100,
        step: 5,
        unit: '%',
        reason: `基于${input.market}市场${input.style}风格的通用权重建议`,
        confidence: 0.3,
      });
    }

    this.callCount++;

    return {
      factorId: input.factorId,
      market: input.market,
      style: input.style,
      suggestions,
      summary: suggestions.length > 0
        ? `${suggestions.length}个参数建议已生成 (置信度: ${(suggestions.reduce((s, p) => s + p.confidence, 0) / suggestions.length * 100).toFixed(0)}%)`
        : '无可用建议',
      billingId: `ai-param-${Date.now()}-${this.callCount}`,
      costUSDT: this.config.costPerCall,
      generatedAt: Date.now(),
    };
  }

  /**
   * Batch-generate suggestions for multiple factors.
   */
  suggestBatch(inputs: AIParamSuggestionInput[]): AIParamSuggestion[] {
    return inputs.map((input) => this.suggest(input));
  }

  /**
   * Get pricing info.
   */
  getPricing(): { costPerCall: number; billingService: string } {
    return {
      costPerCall: this.config.costPerCall,
      billingService: this.config.billingService,
    };
  }

  // ── Private ─────────────────────────────────────────────────────

  private calculateSuggestion(
    param: FactorParamRules['params'][0],
    market: string,
    style: string,
    currentValue: number
  ): number {
    let value = currentValue;

    // Apply style adjustment (multiplier)
    const styleAdj = param.styleAdjustments[style];
    if (styleAdj) {
      value = Math.round(value * styleAdj.factor);
    }

    // Apply market adjustment (additive offset)
    const marketAdj = param.marketAdjustments[market];
    if (marketAdj) {
      value += marketAdj.offset;
    }

    // Clamp to valid range with step granularity
    value = Math.round(value / param.step) * param.step;
    value = Math.max(param.min, Math.min(param.max, value));

    return value;
  }
}
