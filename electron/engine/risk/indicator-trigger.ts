// electron/engine/indicator-trigger.ts
// IndicatorTriggerEngine — technical indicatormodule
// J-30-01 ConditionEngine module
// ：RSI / MACD / MA / Bollinger Bandsbreakout

import log from 'electron-log';
import type { TriggerResult } from '../../types/condition.js';

// ── KlineData ─────────────────────────────────────────────────────────────

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Indicator Types ───────────────────────────────────────────────────────

export type IndicatorType = 'rsi' | 'macd' | 'ma_crossover' | 'bollinger';

export interface RsiRuleConfig {
  overbought?: number;  // default 70
  oversold?: number;    // default 30
  period?: number;      // default 14
}

export interface MacdRuleConfig {
  fast?: number;    // default 12
  slow?: number;    // default 26
  signal?: number;  // default 9
}

export interface MaCrossoverRuleConfig {
  shortPeriod?: number;  // default 5
  longPeriod?: number;   // default 20
}

export interface BollingerRuleConfig {
  period?: number;    // default 20
  multiplier?: number; // default 2
}

export type IndicatorSubCondition =
  | 'rsi_overbought'
  | 'rsi_oversold'
  | 'macd_golden_cross'
  | 'macd_death_cross'
  | 'ma_golden_cross'
  | 'ma_death_cross'
  | 'bollinger_upper_breakout'
  | 'bollinger_lower_breakout';

export interface IndicatorRule {
  id?: string;
  code: string;
  indicator: IndicatorType;
  subCondition: IndicatorSubCondition;
  rsiConfig?: RsiRuleConfig;
  macdConfig?: MacdRuleConfig;
  maConfig?: MaCrossoverRuleConfig;
  bollingerConfig?: BollingerRuleConfig;
  cooldownMs?: number;
  maxTriggersPerDay?: number;
  enabled?: boolean;
  description?: string;
}

export interface IndicatorTriggerResult extends TriggerResult {
  code: string;
  indicator: IndicatorType;
  subCondition: IndicatorSubCondition;
  indicatorValue?: number;
  /** MACD: { macd, signal, histogram } */
  indicatorDetails?: Record<string, number>;
}

interface IndicatorRuleInternal {
  id: string;
  code: string;
  indicator: IndicatorType;
  subCondition: IndicatorSubCondition;
  rsiConfig: Required<RsiRuleConfig>;
  macdConfig: Required<MacdRuleConfig>;
  maConfig: Required<MaCrossoverRuleConfig>;
  bollingerConfig: Required<BollingerRuleConfig>;
  cooldownMs: number;
  maxTriggersPerDay: number;
  enabled: boolean;
  description: string;
  lastTriggeredAt: number | undefined;
  triggerCount: number;
}

// ── Indicator Calculation Functions ───────────────────────────────────────

/**
 * moving average (SMA)
 */
export function calculateSMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) {
      sum -= closes[i - period];
    }
    if (i >= period - 1) {
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * EMA (indexmoving average)
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/**
 * RSI
 */
export function calculateRSI(closes: number[], period: number): number[] {
  if (closes.length < period + 1) return [];
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const result: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsI = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rsI));
  }

  return result;
}

/**
 * MACD (DIF, DEA, Histogram)
 */
export function calculateMACD(
  closes: number[],
  fast: number,
  slow: number,
  signal: number
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const macdLine: number[] = [];
 // ：EMA index 0 start， fast slow EMA 
 //
  const minLen = Math.min(emaFast.length, emaSlow.length);
  const offsetFast = emaFast.length - minLen;
  const offsetSlow = emaSlow.length - minLen;

  for (let i = 0; i < minLen; i++) {
    macdLine.push(emaFast[i + offsetFast] - emaSlow[i + offsetSlow]);
  }

  const signalLine = calculateEMA(macdLine, signal);
  const histogram: number[] = [];
  const sigOffset = macdLine.length - signalLine.length;

  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + sigOffset] - signalLine[i]);
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Bollinger Bands ( )
 */
export function calculateBollingerBands(
  closes: number[],
  period: number,
  multiplier: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - middle[i - period + 1];
      sumSq += diff * diff;
    }
    const std = Math.sqrt(sumSq / period);
    upper.push(middle[i - period + 1] + multiplier * std);
    lower.push(middle[i - period + 1] - multiplier * std);
  }

  return { upper, middle, lower };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function generateIndicatorRuleId(): string {
  return `itr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isSameDay(ms: number): boolean {
  const now = new Date();
  const d = new Date(ms);
  return (
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate()
  );
}

// ── IndicatorTriggerEngine ────────────────────────────────────────────────

export class IndicatorTriggerEngine {
  private rules: Map<string, IndicatorRuleInternal> = new Map();
 /** MACD histogram （/） */
  private lastHistogramMap: Map<string, number> = new Map();
 /** MA （ MA ） */
  private lastShortMaMap: Map<string, number> = new Map();
 /** MA */
  private lastLongMaMap: Map<string, number> = new Map();

  private triggerHistory: IndicatorTriggerResult[] = [];

  constructor() {
    log.info('[IndicatorTriggerEngine] initialized');
  }

  // ── CRUD ─────────────────────────────────────────────

  addRule(rule: IndicatorRule): string {
    const id = rule.id ?? generateIndicatorRuleId();
    const internal: IndicatorRuleInternal = {
      id,
      code: rule.code,
      indicator: rule.indicator,
      subCondition: rule.subCondition,
      rsiConfig: {
        overbought: rule.rsiConfig?.overbought ?? 70,
        oversold: rule.rsiConfig?.oversold ?? 30,
        period: rule.rsiConfig?.period ?? 14,
      },
      macdConfig: {
        fast: rule.macdConfig?.fast ?? 12,
        slow: rule.macdConfig?.slow ?? 26,
        signal: rule.macdConfig?.signal ?? 9,
      },
      maConfig: {
        shortPeriod: rule.maConfig?.shortPeriod ?? 5,
        longPeriod: rule.maConfig?.longPeriod ?? 20,
      },
      bollingerConfig: {
        period: rule.bollingerConfig?.period ?? 20,
        multiplier: rule.bollingerConfig?.multiplier ?? 2,
      },
      cooldownMs: rule.cooldownMs ?? 0,
      maxTriggersPerDay: rule.maxTriggersPerDay ?? Infinity,
      enabled: rule.enabled ?? true,
      description: rule.description ?? '',
      lastTriggeredAt: undefined,
      triggerCount: 0,
    };
    this.rules.set(id, internal);
    log.info(
      `[IndicatorTriggerEngine] rule added: ${id} — ${rule.indicator}/${rule.subCondition} on ${rule.code}`
    );
    return id;
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      log.info(`[IndicatorTriggerEngine] rule removed: ${ruleId}`);
    }
    return removed;
  }

  getRules(): IndicatorRule[] {
    return Array.from(this.rules.values()).map((r) => ({
      id: r.id,
      code: r.code,
      indicator: r.indicator,
      subCondition: r.subCondition,
      rsiConfig: { ...r.rsiConfig },
      macdConfig: { ...r.macdConfig },
      maConfig: { ...r.maConfig },
      bollingerConfig: { ...r.bollingerConfig },
      cooldownMs: r.cooldownMs,
      maxTriggersPerDay: r.maxTriggersPerDay,
      enabled: r.enabled,
      description: r.description,
    }));
  }

  clearAll(): void {
    this.rules.clear();
    this.lastHistogramMap.clear();
    this.lastShortMaMap.clear();
    this.lastLongMaMap.clear();
    this.triggerHistory = [];
  }

  // ── Evaluate ─────────────────────────────────────────

  /**
 * metricrule
 * @param code 
 * @param klines K 
   */
  evaluate(code: string, klines: KlineData[]): IndicatorTriggerResult[] {
    if (klines.length < 2) return [];

    const closes = klines.map((k) => k.close);
    const matchingRules = Array.from(this.rules.values()).filter(
      (r) => r.code === code && r.enabled
    );

    const results: IndicatorTriggerResult[] = [];

    for (const rule of matchingRules) {
      const result = this.evaluateRule(rule, code, closes, klines);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // ── Private ──────────────────────────────────────────

  private evaluateRule(
    rule: IndicatorRuleInternal,
    code: string,
    closes: number[],
    _klines: KlineData[]
  ): IndicatorTriggerResult | null {
    const now = Date.now();

 //
    if (rule.lastTriggeredAt !== undefined && rule.cooldownMs > 0) {
      const elapsed = now - rule.lastTriggeredAt;
      if (elapsed < rule.cooldownMs) {
        return this.makeResult(rule, code, false, {
          cooldownActive: true,
          reason: `cooldown: ${Math.round(rule.cooldownMs - elapsed)}ms remaining`,
        });
      }
    }

 //
    if (rule.maxTriggersPerDay < Infinity) {
      const todayCount = this.triggerHistory.filter(
        (e) => e.ruleId === rule.id && isSameDay(e.triggeredAt ?? 0)
      ).length;
      if (todayCount >= rule.maxTriggersPerDay) {
        return this.makeResult(rule, code, false, {
          cooldownActive: false,
          reason: `maxTriggersPerDay(${rule.maxTriggersPerDay}) reached`,
        });
      }
    }

 // metric
    let triggered = false;
    let indicatorValue: number | undefined;
    let indicatorDetails: Record<string, number> | undefined;

    switch (rule.indicator) {
      case 'rsi': {
        const rsiValues = calculateRSI(closes, rule.rsiConfig.period);
        if (rsiValues.length === 0) return null;
        const currentRsi = rsiValues[rsiValues.length - 1];
        indicatorValue = currentRsi;
        indicatorDetails = { rsi: currentRsi };

        if (rule.subCondition === 'rsi_overbought') {
          triggered = currentRsi > rule.rsiConfig.overbought;
        } else if (rule.subCondition === 'rsi_oversold') {
          triggered = currentRsi < rule.rsiConfig.oversold;
        }
        break;
      }

      case 'macd': {
        const macdData = calculateMACD(
          closes,
          rule.macdConfig.fast,
          rule.macdConfig.slow,
          rule.macdConfig.signal
        );
        if (macdData.histogram.length < 2) return null;

        const currentHist = macdData.histogram[macdData.histogram.length - 1];
        const prevHistKey = `macd_hist_${code}_${rule.id}`;
        const prevHist = this.lastHistogramMap.get(prevHistKey);
        this.lastHistogramMap.set(prevHistKey, currentHist);

        indicatorValue = currentHist;
        indicatorDetails = {
          macd: macdData.macd[macdData.macd.length - 1],
          signal: macdData.signal[macdData.signal.length - 1],
          histogram: currentHist,
        };

        if (prevHist === undefined) return null;

        if (rule.subCondition === 'macd_golden_cross') {
 // histogram = MACD 
          triggered = prevHist <= 0 && currentHist > 0;
        } else if (rule.subCondition === 'macd_death_cross') {
 // histogram = MACD 
          triggered = prevHist >= 0 && currentHist < 0;
        }
        break;
      }

      case 'ma_crossover': {
        const shortMa = calculateSMA(closes, rule.maConfig.shortPeriod);
        const longMa = calculateSMA(closes, rule.maConfig.longPeriod);
        if (shortMa.length === 0 || longMa.length === 0) return null;

        const currentShort = shortMa[shortMa.length - 1];
        const currentLong = longMa[longMa.length - 1];

        const shortKey = `ma_short_${code}_${rule.id}`;
        const longKey = `ma_long_${code}_${rule.id}`;
        const prevShort = this.lastShortMaMap.get(shortKey);
        const prevLong = this.lastLongMaMap.get(longKey);
        this.lastShortMaMap.set(shortKey, currentShort);
        this.lastLongMaMap.set(longKey, currentLong);

        indicatorValue = currentShort - currentLong;
        indicatorDetails = { shortMa: currentShort, longMa: currentLong };

        if (prevShort === undefined || prevLong === undefined) return null;

        if (rule.subCondition === 'ma_golden_cross') {
 // MA MA
          triggered = prevShort <= prevLong && currentShort > currentLong;
        } else if (rule.subCondition === 'ma_death_cross') {
 // MA MA
          triggered = prevShort >= prevLong && currentShort < currentLong;
        }
        break;
      }

      case 'bollinger': {
        const bands = calculateBollingerBands(
          closes,
          rule.bollingerConfig.period,
          rule.bollingerConfig.multiplier
        );
        if (bands.upper.length === 0) return null;

        const currentUpper = bands.upper[bands.upper.length - 1];
        const currentLower = bands.lower[bands.lower.length - 1];
        const currentMiddle = bands.middle[bands.middle.length - 1];
        const currentClose = closes[closes.length - 1];

        indicatorValue = currentClose;
        indicatorDetails = {
          upper: currentUpper,
          middle: currentMiddle,
          lower: currentLower,
          close: currentClose,
        };

        if (rule.subCondition === 'bollinger_upper_breakout') {
          triggered = currentClose > currentUpper;
        } else if (rule.subCondition === 'bollinger_lower_breakout') {
          triggered = currentClose < currentLower;
        }
        break;
      }

      default:
        return null;
    }

    if (triggered) {
      rule.lastTriggeredAt = now;
      rule.triggerCount += 1;

      const result = this.makeResult(rule, code, true, {
        cooldownActive: false,
        reason: `triggered: ${rule.subCondition}`,
        triggeredAt: now,
        indicatorValue,
        indicatorDetails,
      });
      this.triggerHistory.push(result);
      log.info(
        `[IndicatorTriggerEngine] TRIGGERED — ${rule.id} | ${code} ${rule.subCondition} value=${indicatorValue}`
      );
      return result;
    }

    return this.makeResult(rule, code, false, {
      cooldownActive: false,
      reason: `not triggered: ${rule.subCondition}`,
      indicatorValue,
      indicatorDetails,
    });
  }

  private makeResult(
    rule: IndicatorRuleInternal,
    code: string,
    triggered: boolean,
    extra: Partial<IndicatorTriggerResult>
  ): IndicatorTriggerResult {
    return {
      ruleId: rule.id,
      code,
      indicator: rule.indicator,
      subCondition: rule.subCondition,
      triggered,
      cooldownActive: extra.cooldownActive ?? false,
      reason: extra.reason,
      triggeredAt: extra.triggeredAt,
      indicatorValue: extra.indicatorValue,
      indicatorDetails: extra.indicatorDetails,
    };
  }

  // ── History / Accessors ──────────────────────────────

  getHistory(filter?: { ruleId?: string; code?: string }): IndicatorTriggerResult[] {
    let results = this.triggerHistory;
    if (filter?.ruleId) results = results.filter((r) => r.ruleId === filter.ruleId);
    if (filter?.code) results = results.filter((r) => r.code === filter.code);
    return results;
  }

  getRule(ruleId: string): IndicatorRule | undefined {
    const r = this.rules.get(ruleId);
    if (!r) return undefined;
    return {
      id: r.id,
      code: r.code,
      indicator: r.indicator,
      subCondition: r.subCondition,
      enabled: r.enabled,
      description: r.description,
    };
  }

  setEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  get ruleCount(): number {
    return this.rules.size;
  }
}
