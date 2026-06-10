import i18n from '../../../src/i18n';
// ── J-73-04 R73 V19: Parameter Smart Engine ────────────────────────────
// Preset definitions (conservative/balanced/aggressive) + AI recommendation + safety bounds + impact preview

export type RiskProfile = "conservative" | "balanced" | "aggressive" | "custom";

export interface ParameterDefinition {
  name: string;
  key: string;
  type: "number" | "integer" | "boolean" | "select";
  default: number;
  min: number;
  max: number;
  step: number;
  description: string;
  descriptionCN: string;
  unit?: string;
  options?: { label: string; value: number | string }[]; // for "select" type
}

export interface ParameterPreset {
  profile: RiskProfile;
  label: string;
  labelCN: string;
  description: string;
  descriptionCN: string;
  parameters: Record<string, number | boolean | string>;
}

export interface ParameterSafetyCheck {
  parameter: string;
  value: number;
  severity: "ok" | "warning" | "danger";
  message: string;
  messageCN: string;
  limit: number;
}

export interface ParameterImpact {
  parameter: string;
  currentValue: number;
  alternativeValues: {
    value: number;
    label: string;
    estimatedReturn: number;
    estimatedRisk: number;
    estimatedWinRate: number;
  }[];
}

export interface AIRecommendation {
  target: string; // symbol
  market: string;
  recommendedProfile: RiskProfile;
  parameters: Record<string, number | boolean | string>;
  reasoning: string;
  reasoningCN: string;
  confidence: number;
  basedOn: string[]; // what data informed this recommendation
}

// ── Parameter Definitions ─────────────────────────────────────────────────

export const STANDARD_PARAMETERS: ParameterDefinition[] = [
  { name: "Bollinger Period", key: "bbPeriod", type: "integer", default: 20, min: 5, max: 100, step: 5, description: "BB calculation period", descriptionCN: i18n.t('parameterSmartEngine.k1'), unit: "bars" },
  { name: "Bollinger Sigma", key: "bbSigma", type: "number", default: 2.0, min: 1.0, max: 4.0, step: 0.5, description: "BB standard deviation multiplier", descriptionCN: i18n.t('parameterSmartEngine.k2'), unit: "σ" },
  { name: "RSI Period", key: "rsiPeriod", type: "integer", default: 14, min: 5, max: 50, step: 1, description: "RSI calculation period", descriptionCN: i18n.t('parameterSmartEngine.k3'), unit: "bars" },
  { name: "RSI Oversold", key: "rsiOversold", type: "integer", default: 30, min: 10, max: 50, step: 1, description: "RSI oversold threshold", descriptionCN: i18n.t('parameterSmartEngine.k4'), unit: "" },
  { name: "RSI Overbought", key: "rsiOverbought", type: "integer", default: 70, min: 50, max: 90, step: 1, description: "RSI overbought threshold", descriptionCN: i18n.t('parameterSmartEngine.k5'), unit: "" },
  { name: "MACD Fast", key: "macdFast", type: "integer", default: 12, min: 3, max: 50, step: 1, description: "MACD fast EMA period", descriptionCN: i18n.t('parameterSmartEngine.k6'), unit: "bars" },
  { name: "MACD Slow", key: "macdSlow", type: "integer", default: 26, min: 10, max: 100, step: 1, description: "MACD slow EMA period", descriptionCN: i18n.t('parameterSmartEngine.k7'), unit: "bars" },
  { name: "MACD Signal", key: "macdSignal", type: "integer", default: 9, min: 3, max: 30, step: 1, description: "MACD signal EMA period", descriptionCN: i18n.t('parameterSmartEngine.k8'), unit: "bars" },
  { name: "MA Short", key: "maShort", type: "integer", default: 5, min: 2, max: 50, step: 1, description: "Short moving average period", descriptionCN: i18n.t('parameterSmartEngine.k9'), unit: "bars" },
  { name: "MA Long", key: "maLong", type: "integer", default: 20, min: 10, max: 200, step: 5, description: "Long moving average period", descriptionCN: i18n.t('parameterSmartEngine.k10'), unit: "bars" },
  { name: "Stop Loss %", key: "stopLoss", type: "number", default: 5, min: 1, max: 30, step: 1, description: "Stop loss percentage", descriptionCN: i18n.t('parameterSmartEngine.k11'), unit: "%" },
  { name: "Take Profit %", key: "takeProfit", type: "number", default: 15, min: 2, max: 100, step: 1, description: "Take profit percentage", descriptionCN: i18n.t('parameterSmartEngine.k12'), unit: "%" },
  { name: "Position Size %", key: "positionSize", type: "number", default: 10, min: 1, max: 50, step: 5, description: "Max position as % of portfolio", descriptionCN: i18n.t('parameterSmartEngine.k13'), unit: "%" },
  { name: "Max Positions", key: "maxPositions", type: "integer", default: 10, min: 1, max: 50, step: 1, description: "Maximum concurrent positions", descriptionCN: i18n.t('parameterSmartEngine.k14'), unit: i18n.t('parameterSmartEngine.k15') },
  { name: "Volume Threshold", key: "volumeMultiplier", type: "number", default: 1.5, min: 1.0, max: 5.0, step: 0.5, description: "Minimum volume vs 20d avg", descriptionCN: i18n.t('parameterSmartEngine.k16'), unit: "×" },
  { name: "Trailing Stop", key: "trailingStop", type: "number", default: 3, min: 0, max: 20, step: 1, description: "Trailing stop distance (% from peak, 0=off)", descriptionCN: i18n.t('parameterSmartEngine.k17'), unit: "%" },
];

// ── Preset Definitions ──────────────────────────────────────────────────

export const PARAMETER_PRESETS: ParameterPreset[] = [
  {
    profile: "conservative",
    label: "Conservative",
    labelCN: i18n.t('parameterSmartEngine.k18'),
    description: "Low risk, suitable for long-term holding and dividend strategies. Tighter stops, smaller positions.",
    descriptionCN: i18n.t('parameterSmartEngine.k19'),
    parameters: {
      bbPeriod: 20, bbSigma: 2.0,
      rsiPeriod: 14, rsiOversold: 25, rsiOverbought: 75,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      maShort: 10, maLong: 50,
      stopLoss: 3, takeProfit: 10,
      positionSize: 5, maxPositions: 5,
      volumeMultiplier: 2.0, trailingStop: 2,
    },
  },
  {
    profile: "balanced",
    label: "Balanced",
    labelCN: i18n.t('parameterSmartEngine.k20'),
    description: "Moderate risk-reward, suitable for most traders. Balanced stops and position sizing.",
    descriptionCN: i18n.t('parameterSmartEngine.k21'),
    parameters: {
      bbPeriod: 20, bbSigma: 2.0,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      maShort: 5, maLong: 20,
      stopLoss: 5, takeProfit: 15,
      positionSize: 10, maxPositions: 10,
      volumeMultiplier: 1.5, trailingStop: 3,
    },
  },
  {
    profile: "aggressive",
    label: "Aggressive",
    labelCN: i18n.t('parameterSmartEngine.k22'),
    description: "High risk-reward, suitable for active swing trading. Wider stops, larger positions, faster entries.",
    descriptionCN: i18n.t('parameterSmartEngine.k23'),
    parameters: {
      bbPeriod: 10, bbSigma: 1.5,
      rsiPeriod: 7, rsiOversold: 20, rsiOverbought: 80,
      macdFast: 5, macdSlow: 13, macdSignal: 3,
      maShort: 3, maLong: 10,
      stopLoss: 8, takeProfit: 25,
      positionSize: 20, maxPositions: 15,
      volumeMultiplier: 1.0, trailingStop: 5,
    },
  },
];

// ── Safety Bounds ──────────────────────────────────────────────────────

function checkSafetyBounds(
  paramDef: ParameterDefinition,
  value: number,
): ParameterSafetyCheck {
  const range = paramDef.max - paramDef.min;
  const dangerLow = paramDef.min + range * 0.1;
  const dangerHigh = paramDef.max - range * 0.1;
  const warningLow = paramDef.min + range * 0.25;
  const warningHigh = paramDef.max - range * 0.25;

  if (value <= dangerLow) {
    return {
      parameter: paramDef.key,
      value,
      severity: "danger",
      message: `${paramDef.name} is dangerously low (${value}${paramDef.unit ?? ""}). Falls below safe minimum of ${Math.ceil(warningLow)}.`,
      messageCN: i18n.t('parameterSmartEngine.k24'),
      limit: warningLow,
    };
  }
  if (value >= dangerHigh) {
    return {
      parameter: paramDef.key,
      value,
      severity: "danger",
      message: `${paramDef.name} is dangerously high (${value}${paramDef.unit ?? ""}). Exceeds safe maximum of ${Math.floor(warningHigh)}.`,
      messageCN: i18n.t('parameterSmartEngine.k25'),
      limit: warningHigh,
    };
  }
  if (value <= warningLow) {
    return {
      parameter: paramDef.key,
      value,
      severity: "warning",
      message: `${paramDef.name} is near lower bound (${value}${paramDef.unit ?? ""}). Consider increasing to avoid noise.`,
      messageCN: i18n.t('parameterSmartEngine.k26'),
      limit: warningLow,
    };
  }
  if (value >= warningHigh) {
    return {
      parameter: paramDef.key,
      value,
      severity: "warning",
      message: `${paramDef.name} is near upper bound (${value}${paramDef.unit ?? ""}). Consider decreasing to avoid lag.`,
      messageCN: i18n.t('parameterSmartEngine.k27'),
      limit: warningHigh,
    };
  }

  return {
    parameter: paramDef.key,
    value,
    severity: "ok",
    message: `${paramDef.name} is within safe range.`,
    messageCN: i18n.t('parameterSmartEngine.k28'),
    limit: 0,
  };
}

// ── AI Recommendation Engine ────────────────────────────────────────────

function recommendParameters(
  market: string,
  volatility: "low" | "medium" | "high",
  trendStrength: "weak" | "moderate" | "strong",
  liquidity: "low" | "medium" | "high",
): AIRecommendation {
  // Market-specific base adjustments
  const isUS = market === "NYSE" || market === "NASDAQ";
  const isAsia = ["HKEX", "SGX", "TSE", "BURSA"].includes(market);

  let profile: RiskProfile;
  let params: Record<string, number | boolean | string>;
  let reasoningCN: string;

  if (volatility === "low" && trendStrength === "strong") {
    // Low vol + strong trend → aggressive trend following
    profile = "aggressive";
    params = {
      bbPeriod: 10, bbSigma: 1.5,
      rsiPeriod: 7, rsiOversold: 25, rsiOverbought: 75,
      macdFast: 6, macdSlow: 13, macdSignal: 4,
      maShort: 3, maLong: 10,
      stopLoss: 5, takeProfit: 20,
      positionSize: isUS ? 20 : 15, maxPositions: 12,
      volumeMultiplier: 1.0, trailingStop: 4,
    };
    reasoningCN = i18n.t('parameterSmartEngine.k29');
  } else if (volatility === "high" || trendStrength === "weak") {
    // High vol or weak trend → conservative mean reversion
    profile = "conservative";
    params = {
      bbPeriod: 20, bbSigma: 2.5,
      rsiPeriod: 14, rsiOversold: 20, rsiOverbought: 80,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      maShort: 10, maLong: 50,
      stopLoss: 3, takeProfit: 10,
      positionSize: isUS ? 8 : 5, maxPositions: 5,
      volumeMultiplier: 2.0, trailingStop: 2,
    };
    reasoningCN = i18n.t('parameterSmartEngine.k30');
  } else {
    // Everything else → balanced
    profile = "balanced";
    params = {
      bbPeriod: 20, bbSigma: 2.0,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      maShort: isAsia ? 5 : 3, maLong: isAsia ? 20 : 10,
      stopLoss: isAsia ? 5 : 4, takeProfit: isAsia ? 12 : 15,
      positionSize: isUS ? 15 : 10, maxPositions: 10,
      volumeMultiplier: isAsia ? 1.8 : 1.5, trailingStop: 3,
    };
    reasoningCN = i18n.t('parameterSmartEngine.k33');
  }

  return {
    target: "",
    market,
    recommendedProfile: profile,
    parameters: params,
    reasoning: `AI recommends ${profile} strategy for ${market} given ${volatility} volatility and ${trendStrength} trend.`,
    reasoningCN,
    confidence: volatility === "low" && trendStrength === "strong" ? 0.85 :
      volatility === "high" ? 0.75 : 0.7,
    basedOn: [`${market} market profile`, `${volatility} volatility regime`, `${trendStrength} trend strength`],
  };
}

// ── Impact Preview ──────────────────────────────────────────────────────

function previewParameterImpact(
  paramDef: ParameterDefinition,
  currentValue: number,
  profile: RiskProfile,
): ParameterImpact {
  // Simulate what happens at different values
  const alternatives = [paramDef.min, currentValue, paramDef.max]
    .filter((v, i, arr) => arr.indexOf(v) === i) // unique
    .slice(0, 5);

  const altValues = alternatives.map((v) => {
    const normalizedPos = (v - paramDef.min) / (paramDef.max - paramDef.min + 0.0001);

    // Rough impact estimation
    const isSensitive = ["stopLoss", "positionSize", "rsiOversold", "trailingStop"].includes(paramDef.key);
    const isIndicator = ["bbPeriod", "rsiPeriod", "macdFast", "macdSlow", "maShort", "maLong"].includes(paramDef.key);

    let estReturn: number, estRisk: number, estWinRate: number;

    if (isSensitive) {
      // Higher values → higher risk & return (if it's a loss buffer → lower risk)
      const dir = paramDef.key === "stopLoss" || paramDef.key === "trailingStop" ? -1 : 1;
      const baseline = profile === "conservative" ? 0.06 : profile === "aggressive" ? 0.18 : 0.12;
      estReturn = baseline + dir * normalizedPos * 0.1;
      estRisk = baseline * 0.8 + dir * normalizedPos * 0.15;
      estWinRate = 0.55 + dir * normalizedPos * 0.1;
    } else if (isIndicator) {
      // Shorter periods → more signals, higher win rate but more noise
      const periodNormalized = 1 - normalizedPos; // shorter = higher value
      estReturn = 0.10 + periodNormalized * 0.05;
      estRisk = 0.12 + periodNormalized * 0.03;
      estWinRate = 0.50 + periodNormalized * 0.1;
    } else {
      estReturn = 0.10;
      estRisk = 0.10;
      estWinRate = 0.55;
    }

    return {
      value: v,
      label: v === paramDef.min ? i18n.t('parameterSmartEngine.k34') : v === paramDef.max ? i18n.t('parameterSmartEngine.k35') : i18n.t('parameterSmartEngine.k36'),
      estimatedReturn: Math.round(estReturn * 100) / 100,
      estimatedRisk: Math.round(estRisk * 100) / 100,
      estimatedWinRate: Math.round(estWinRate * 100) / 100,
    };
  });

  return { parameter: paramDef.key, currentValue, alternativeValues: altValues };
}

// ── Parameter Smart Engine ──────────────────────────────────────────────

export interface SmartParameterResult {
  profile: RiskProfile;
  parameters: Record<string, number | boolean | string>;
  safetyChecks: ParameterSafetyCheck[];
  impacts: ParameterImpact[];
  aiRecommendation: AIRecommendation | null;
  conflictWarnings: string[];
}

export class ParameterSmartEngine {
  private currentProfile: RiskProfile = "balanced";
  private currentParams: Record<string, number | boolean | string> = {};
  private customPresets: Map<string, ParameterPreset> = new Map();

  constructor() {
    // Load balanced as default
    const balanced = PARAMETER_PRESETS.find((p) => p.profile === "balanced")!;
    this.currentParams = { ...balanced.parameters };
  }

  /** Switch to a predefined profile */
  applyPreset(profile: RiskProfile): SmartParameterResult {
    this.currentProfile = profile;
    const preset = PARAMETER_PRESETS.find((p) => p.profile === profile)!;
    this.currentParams = { ...preset.parameters };
    return this.evaluate(this.currentParams);
  }

  /** Save custom preset */
  saveCustomPreset(name: string, params: Record<string, number | boolean | string>): void {
    this.customPresets.set(name, {
      profile: "custom",
      label: name,
      labelCN: name,
      description: `Custom preset: ${name}`,
      descriptionCN: i18n.t('parameterSmartEngine.k37'),
      parameters: { ...params },
    });
  }

  /** Get custom preset */
  getCustomPreset(name: string): ParameterPreset | undefined {
    return this.customPresets.get(name);
  }

  /** Set individual parameter */
  setParameter(key: string, value: number | boolean | string): SmartParameterResult {
    this.currentParams[key] = value;
    this.currentProfile = "custom";
    return this.evaluate(this.currentParams);
  }

  /** Evaluate current parameters: safety + impact + conflicts */
  evaluate(params: Record<string, number | boolean | string> = this.currentParams): SmartParameterResult {
    const safetyChecks: ParameterSafetyCheck[] = [];
    const impacts: ParameterImpact[] = [];
    const conflictWarnings: string[] = [];

    for (const def of STANDARD_PARAMETERS) {
      const value = params[def.key];
      if (value === undefined || typeof value !== "number") continue;

      // Safety bounds
      safetyChecks.push(checkSafetyBounds(def, value));

      // Impact preview
      impacts.push(previewParameterImpact(def, value, this.currentProfile));
    }

    // Conflict detection
    const stopLoss = Number(params.stopLoss);
    const takeProfit = Number(params.takeProfit);
    if (stopLoss >= takeProfit) {
      conflictWarnings.push(
        i18n.t('parameterSmartEngine.k38'),
      );
    }

    const rsiOver = Number(params.rsiOverbought);
    const rsiUnder = Number(params.rsiOversold);
    if (rsiOver - rsiUnder < 30) {
      conflictWarnings.push(
        i18n.t('parameterSmartEngine.k39'),
      );
    }

    const maShort = Number(params.maShort);
    const maLong = Number(params.maLong);
    if (maShort >= maLong) {
      conflictWarnings.push(
        i18n.t('parameterSmartEngine.k40'),
      );
    }

    const posSize = Number(params.positionSize);
    const maxPos = Number(params.maxPositions);
    if (posSize * maxPos > 100) {
      conflictWarnings.push(
        i18n.t('parameterSmartEngine.k41'),
      );
    }

    return {
      profile: this.currentProfile,
      parameters: { ...this.currentParams },
      safetyChecks,
      impacts,
      aiRecommendation: null, // set by caller if AI was used
      conflictWarnings,
    };
  }

  /** Get AI recommendation based on market conditions */
  getAIRecommendation(
    market: string,
    volatility: "low" | "medium" | "high",
    trendStrength: "weak" | "moderate" | "strong",
    liquidity: "low" | "medium" | "high" = "medium",
  ): AIRecommendation {
    const rec = recommendParameters(market, volatility, trendStrength, liquidity);
    return rec;
  }

  /** Apply AI recommendation and evaluate */
  applyAIRecommendation(
    market: string,
    volatility: "low" | "medium" | "high",
    trendStrength: "weak" | "moderate" | "strong",
  ): SmartParameterResult {
    const rec = this.getAIRecommendation(market, volatility, trendStrength);
    this.currentParams = { ...rec.parameters as Record<string, number | boolean | string> };
    this.currentProfile = rec.recommendedProfile;

    const result = this.evaluate(this.currentParams);
    result.aiRecommendation = rec;
    return result;
  }

  /** Restore default (balanced) */
  restoreDefaults(): SmartParameterResult {
    return this.applyPreset("balanced");
  }

  /** Get all available presets */
  getPresets(): ParameterPreset[] {
    return [...PARAMETER_PRESETS, ...this.customPresets.values()];
  }

  reset(): void {
    this.currentProfile = "balanced";
    const balanced = PARAMETER_PRESETS.find((p) => p.profile === "balanced")!;
    this.currentParams = { ...balanced.parameters };
    this.customPresets.clear();
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createParameterSmartEngine(): ParameterSmartEngine {
  return new ParameterSmartEngine();
}
