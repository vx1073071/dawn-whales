// R192: 30 Market-Specific Red Factor Calculators (HK 11 + US 14 + CC 5)
// All extend FactorCalculator using correct FactorLevel1/Level2 from registry.
import { FactorCalculator, type FactorInput } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

// === HK 11 ===
export class HK_WARRANT_IV_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_WARRANT_IV' as FactorId, level1: 'L1_HK', level2: 'L2_DERIVATIVES', label: 'Warrant Implied Vol' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const iv = (input.extra as Record<string,number>)?.warrantIv ?? 0;
    const ivRank = (input.extra as Record<string,number>)?.ivPercentile30d ?? 0.5;
    const v = iv * (ivRank > 0.8 ? 1.5 : ivRank > 0.5 ? 1.0 : 0.5);
    return { value: v, rawValue: iv };
  }
}

export class HK_WARRANT_DELTA_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_WARRANT_DELTA' as FactorId, level1: 'L1_HK', level2: 'L2_DERIVATIVES', label: 'Warrant Delta' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const delta = (input.extra as Record<string,number>)?.warrantDelta ?? 0;
    const v = delta * Math.log(1 + input.priceData.volume);
    return { value: v, rawValue: delta };
  }
}

export class HK_LEVERAGE_INVERSE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_LEVERAGE_INVERSE' as FactorId, level1: 'L1_HK', level2: 'L2_FLOW', label: 'Leverage/Inverse ETF Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const f = (input.extra as Record<string,number>)?.leveragedFlow ?? 0;
    const pf = (input.extra as Record<string,number>)?.leveragedFlowPrev ?? f;
    return { value: pf > 0 ? (f - pf) / pf : 0, rawValue: f };
  }
}

export class HK_SOUTHBOUND_SMART_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_SOUTHBOUND_SMART' as FactorId, level1: 'L1_HK', level2: 'L2_FLOW', label: 'Southbound Smart Money Star' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const nf = (input.extra as Record<string,number>)?.southboundNetFlow ?? 0;
    const af = (input.extra as Record<string,number>)?.southboundAvgFlow30d ?? 1;
    const r = (input.extra as Record<string,number>)?.southboundMomentum ?? nf;
    const v = Math.tanh(nf / Math.max(1, af) + (r > nf ? 0.3 : 0));
    return { value: v, rawValue: nf };
  }
}

export class HK_WARRANT_OVERHEAT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_WARRANT_OVERHEAT' as FactorId, level1: 'L1_HK', level2: 'L2_FLOW', label: 'Street Volume Overheat' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sv = (input.extra as Record<string,number>)?.streetVolume ?? 0;
    const cap = (input.extra as Record<string,number>)?.warrantOutstanding ?? 1;
    const ratio = cap > 0 ? sv / cap : 0;
    return { value: ratio > 0.5 ? 1 : ratio > 0.3 ? 0.6 : 0, rawValue: ratio };
  }
}

export class HKD_PEG_PRESSURE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HKD_PEG_PRESSURE' as FactorId, level1: 'L1_HK', level2: 'L2_RISK', label: 'HKD Peg Pressure' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const spot = (input.extra as Record<string,number>)?.hkdSpot ?? 7.8;
    const v = Math.abs(spot - 7.85) > 0.02 ? -1 : Math.abs(spot - 7.78) < 0.005 ? 0.5 : 0;
    return { value: v, rawValue: spot };
  }
}

export class HIBOR_STEEPNESS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HIBOR_STEEPNESS' as FactorId, level1: 'L1_HK', level2: 'L2_SENSITIVITY', label: 'HIBOR Steepness' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const o1m = (input.extra as Record<string,number>)?.hibor1m ?? 0;
    const o3m = (input.extra as Record<string,number>)?.hibor3m ?? 0;
    return { value: o3m - o1m, rawValue: o3m };
  }
}

export class HK_PRIVATIZATION_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_PRIVATIZATION' as FactorId, level1: 'L1_HK', level2: 'L2_EVENT', label: 'Privatization Probability' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const p = (input.extra as Record<string,number>)?.privatizationProb ?? 0;
    return { value: p, rawValue: p };
  }
}

export class HK_DERIV_POS_ANOMALY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_DERIV_POS_ANOMALY' as FactorId, level1: 'L1_HK', level2: 'L2_DERIVATIVES', label: 'Derivative Position Anomaly' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pos = (input.extra as Record<string,number>)?.derivNetPosition ?? 0;
    const avg = (input.extra as Record<string,number>)?.derivAvgPosition ?? pos;
    const z = Math.abs(avg) > 1 ? (pos - avg) / Math.abs(avg) : 0;
    const anomaly = Math.abs(z) > 3 ? Math.sign(z) : Math.abs(z) > 2 ? Math.sign(z) * 0.5 : 0;
    return { value: anomaly, rawValue: pos };
  }
}

export class HK_HSI_WEIGHT_CHANGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_HSI_WEIGHT_CHANGE' as FactorId, level1: 'L1_HK', level2: 'L2_EVENT', label: 'HSI Weight Change' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const delta = (input.extra as Record<string,number>)?.hsiWeightDelta ?? 0;
    return { value: Math.tanh(delta * 100), rawValue: delta };
  }
}

export class HK_CBBC_DISTANCE_ADV_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'HK_CBBC_DISTANCE_ADV' as FactorId, level1: 'L1_HK', level2: 'L2_DERIVATIVES', label: 'CBBC Distance Advanced' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dist = (input.extra as Record<string,number>)?.cbbcDistance ?? 0;
    const callRatio = (input.extra as Record<string,number>)?.cbbcCallRatio ?? 0.5;
    const v = dist > 0 ? (1 / Math.max(0.5, dist)) * (callRatio - 0.5) * 2 : 0;
    return { value: v, rawValue: dist };
  }
}

// === US 14 ===
export class US_GUIDANCE_CHANGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_GUIDANCE_CHANGE' as FactorId, level1: 'L1_US', level2: 'L2_EARNINGS', label: 'Management Guidance Change' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const g = (input.extra as Record<string,number>)?.guidanceChange ?? 0;
    return { value: g > 0.05 ? 1 : g > 0.02 ? 0.5 : g < -0.05 ? -1 : g < -0.02 ? -0.5 : 0, rawValue: g };
  }
}

export class US_POST_EARNINGS_DRIFT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_POST_EARNINGS_DRIFT' as FactorId, level1: 'L1_US', level2: 'L2_EARNINGS', label: 'PEAD Effect' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const surp = (input.extra as Record<string,number>)?.earningsSurprise ?? 0;
    const days = (input.extra as Record<string,number>)?.daysSinceEarnings ?? 30;
    return { value: surp * Math.exp(-days / 30), rawValue: surp };
  }
}

export class US_GAMMA_EXPOSURE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_GAMMA_EXPOSURE' as FactorId, level1: 'L1_US', level2: 'L2_OPTIONS', label: 'Gamma Exposure Star' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const gex = (input.extra as Record<string,number>)?.gammaExposure ?? 0;
    const flip = (input.extra as Record<string,number>)?.gammaFlip ?? 0;
    return { value: Math.tanh(gex * 0.1) + (flip > 0 ? 0.3 : 0), rawValue: gex };
  }
}

export class US_MAX_PAIN_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_MAX_PAIN' as FactorId, level1: 'L1_US', level2: 'L2_OPTIONS', label: 'Max Pain' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pain = (input.extra as Record<string,number>)?.maxPain ?? input.priceData.close;
    return { value: Math.tanh((input.priceData.close / Math.max(0.01, pain) - 1) * 5), rawValue: pain };
  }
}

export class US_SKEW_INDEX_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_SKEW_INDEX' as FactorId, level1: 'L1_US', level2: 'L2_VOLATILITY', label: 'Skew Index' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const skew = (input.extra as Record<string,number>)?.skewIndex ?? 100;
    return { value: skew > 130 ? -1 : skew > 120 ? -0.5 : skew > 110 ? -0.2 : 0, rawValue: skew };
  }
}

export class US_DEBT_CEILING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_DEBT_CEILING' as FactorId, level1: 'L1_US', level2: 'L2_RISK', label: 'Debt Ceiling Risk' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const risk = (input.extra as Record<string,number>)?.debtCeilingRisk ?? 0;
    return { value: -risk, rawValue: risk };
  }
}

export class US_0DTE_RATIO_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_0DTE_RATIO' as FactorId, level1: 'L1_US', level2: 'L2_OPTIONS', label: '0DTE Ratio' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dte0 = (input.extra as Record<string,number>)?.volume0DTE ?? 0;
    const tot = (input.extra as Record<string,number>)?.volumeTotal ?? input.priceData.volume;
    const v = tot > 0 ? dte0 / tot : 0;
    return { value: v > 0.3 ? -0.5 : v > 0.15 ? -0.2 : 0, rawValue: v };
  }
}

export class US_SPLIT_EXPECT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_SPLIT_EXPECT' as FactorId, level1: 'L1_US', level2: 'L2_EVENT', label: 'Split Expectation' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const p = (input.extra as Record<string,number>)?.splitProbability ?? 0;
    const ratio = (input.extra as Record<string,number>)?.expectedSplitRatio ?? 1;
    return { value: p * (ratio - 0.5), rawValue: p };
  }
}

export class US_BUYBACK_ACCEL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_BUYBACK_ACCEL' as FactorId, level1: 'L1_US', level2: 'L2_SENTIMENT', label: 'Buyback Acceleration' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const cur = (input.extra as Record<string,number>)?.buybackAmount ?? 0;
    const prev = (input.extra as Record<string,number>)?.buybackPrev ?? cur;
    const mcap = input.fundamental?.marketCap ?? 1;
    return { value: Math.tanh((prev > 0 ? (cur - prev) / Math.abs(prev) : 0) * 5), rawValue: cur };
  }
}

export class US_SHORT_INTEREST_RATE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_SHORT_INTEREST_RATE' as FactorId, level1: 'L1_US', level2: 'L2_FLOW', label: 'Short Interest Rate' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const rate = (input.extra as Record<string,number>)?.shortInterestRate ?? 0;
    const fee = (input.extra as Record<string,number>)?.borrowFeeRate ?? 0.05;
    return { value: -(rate + fee), rawValue: rate };
  }
}

export class US_SPAC_PROGRESS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_SPAC_PROGRESS' as FactorId, level1: 'L1_US', level2: 'L2_EVENT', label: 'SPAC Progress' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const prog = (input.extra as Record<string,number>)?.spacProgress ?? 0;
    const days = (input.extra as Record<string,number>)?.spacDaysLeft ?? 365;
    return { value: prog > 0.8 ? 1 : prog > 0.5 ? 0.5 : days < 90 ? -0.5 : 0, rawValue: prog };
  }
}

export class US_SHORT_SQUEEZE_SCORE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_SHORT_SQUEEZE_SCORE' as FactorId, level1: 'L1_US', level2: 'L2_FLOW', label: 'Short Squeeze Score Star' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sf = (input.extra as Record<string,number>)?.shortFloat ?? 0;
    const dtc = (input.extra as Record<string,number>)?.daysToCover ?? 1;
    const pc = input.priceData.prevClose ? (input.priceData.close - input.priceData.prevClose) / input.priceData.prevClose : 0;
    const score = Math.min(1, sf * 3 + Math.min(1, 1 / Math.max(1, dtc)) + (pc > 0.03 ? 0.3 : 0));
    return { value: score, rawValue: sf };
  }
}

export class US_MAG7_MOMENTUM_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_MAG7_MOMENTUM' as FactorId, level1: 'L1_US', level2: 'L2_MOMENTUM', label: 'MAG7 Momentum' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ret = (input.extra as Record<string,number>)?.mag7IndexReturn ?? 0;
    const isMag7 = (input.extra as Record<string,number>)?.isMag7 ?? 0;
    return { value: isMag7 > 0 ? ret : 0, rawValue: ret };
  }
}

export class US_TICK_INDEX_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'US_TICK_INDEX' as FactorId, level1: 'L1_US', level2: 'L2_SENTIMENT', label: 'Tick Index' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const tick = (input.extra as Record<string,number>)?.tickIndex ?? 0;
    return { value: Math.tanh(tick * 0.002), rawValue: tick };
  }
}

// === CC 5 ===
export class CRYPTO_PUELL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_PUELL' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'Puell Multiple' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pm = input.onChain?.puellMultiple ?? 1;
    const v = pm > 4 ? -1 : pm > 3 ? -0.5 : pm > 2 ? -0.2 : pm < 0.5 ? 1 : pm < 0.8 ? 0.5 : 0;
    return { value: v, rawValue: pm };
  }
}

export class CRYPTO_MVRV_Z_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_MVRV_Z' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'MVRV Z-Score' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mvrv = input.onChain?.mvrv ?? 1;
    const z = (input.extra as Record<string,number>)?.mvrvZScore ?? (mvrv - 1.5) / 0.5;
    const v = z > 3 ? -1 : z > 2 ? -0.5 : z > 1 ? -0.2 : z < -1 ? 0.5 : 0;
    return { value: Math.tanh(v), rawValue: z };
  }
}

export class CRYPTO_HODL_WAVE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_HODL_WAVE' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'HODL Wave' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const h1y = (input.extra as Record<string,number>)?.hodlRatio1y ?? 0.4;
    const h6m = (input.extra as Record<string,number>)?.hodlRatio6m ?? 0.25;
    const v = h1y > 0.6 ? 1 : h1y > 0.5 ? 0.5 : h6m < 0.15 ? -0.5 : 0;
    return { value: v, rawValue: h1y };
  }
}

export class CRYPTO_FUNDING_EXTREME_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_FUNDING_EXTREME' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_DERIVATIVES', label: 'Funding Rate Extreme' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const fund = (input.extra as Record<string,number>)?.fundingRate ?? 0;
    return { value: fund > 0.001 ? -1 : fund > 0.0005 ? -0.5 : fund < -0.001 ? 1 : fund < -0.0005 ? 0.5 : 0, rawValue: fund };
  }
}

export class CRYPTO_LIQUIDATION_MAP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_LIQUIDATION_MAP' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_DERIVATIVES', label: 'Liquidation Heatmap' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const liqL = (input.extra as Record<string,number>)?.liquidationLong ?? 0;
    const liqS = (input.extra as Record<string,number>)?.liquidationShort ?? 0;
    const tot = liqL + liqS;
    const bias = tot > 0 ? (liqL - liqS) / tot : 0;
    const intensity = tot / Math.max(1, input.priceData.volume);
    return { value: intensity > 0.1 ? -Math.sign(bias) * 0.5 : bias, rawValue: tot };
  }
}

// === Registry ===
export const MARKET_RED_FACTOR_CALCULATORS: Record<string, { new(): FactorCalculator }> = {
  HK_WARRANT_IV: HK_WARRANT_IV_Calculator,
  HK_WARRANT_DELTA: HK_WARRANT_DELTA_Calculator,
  HK_LEVERAGE_INVERSE: HK_LEVERAGE_INVERSE_Calculator,
  HK_SOUTHBOUND_SMART: HK_SOUTHBOUND_SMART_Calculator,
  HK_WARRANT_OVERHEAT: HK_WARRANT_OVERHEAT_Calculator,
  HKD_PEG_PRESSURE: HKD_PEG_PRESSURE_Calculator,
  HIBOR_STEEPNESS: HIBOR_STEEPNESS_Calculator,
  HK_PRIVATIZATION: HK_PRIVATIZATION_Calculator,
  HK_DERIV_POS_ANOMALY: HK_DERIV_POS_ANOMALY_Calculator,
  HK_HSI_WEIGHT_CHANGE: HK_HSI_WEIGHT_CHANGE_Calculator,
  HK_CBBC_DISTANCE_ADV: HK_CBBC_DISTANCE_ADV_Calculator,
  US_GUIDANCE_CHANGE: US_GUIDANCE_CHANGE_Calculator,
  US_POST_EARNINGS_DRIFT: US_POST_EARNINGS_DRIFT_Calculator,
  US_GAMMA_EXPOSURE: US_GAMMA_EXPOSURE_Calculator,
  US_MAX_PAIN: US_MAX_PAIN_Calculator,
  US_SKEW_INDEX: US_SKEW_INDEX_Calculator,
  US_DEBT_CEILING: US_DEBT_CEILING_Calculator,
  US_0DTE_RATIO: US_0DTE_RATIO_Calculator,
  US_SPLIT_EXPECT: US_SPLIT_EXPECT_Calculator,
  US_BUYBACK_ACCEL: US_BUYBACK_ACCEL_Calculator,
  US_SHORT_INTEREST_RATE: US_SHORT_INTEREST_RATE_Calculator,
  US_SPAC_PROGRESS: US_SPAC_PROGRESS_Calculator,
  US_SHORT_SQUEEZE_SCORE: US_SHORT_SQUEEZE_SCORE_Calculator,
  US_MAG7_MOMENTUM: US_MAG7_MOMENTUM_Calculator,
  US_TICK_INDEX: US_TICK_INDEX_Calculator,
  CRYPTO_PUELL: CRYPTO_PUELL_Calculator,
  CRYPTO_MVRV_Z: CRYPTO_MVRV_Z_Calculator,
  CRYPTO_HODL_WAVE: CRYPTO_HODL_WAVE_Calculator,
  CRYPTO_FUNDING_EXTREME: CRYPTO_FUNDING_EXTREME_Calculator,
  CRYPTO_LIQUIDATION_MAP: CRYPTO_LIQUIDATION_MAP_Calculator,
};

export function getMarketRedCalculator(factorId: string): FactorCalculator | null {
  const Ctor = MARKET_RED_FACTOR_CALCULATORS[factorId];
  return Ctor ? new Ctor() : null;
}

export const MARKET_RED_FACTOR_IDS: readonly string[] = Object.keys(MARKET_RED_FACTOR_CALCULATORS);

export function getMarketFactorsByMarket(market: string): string[] {
  const pre = market.toUpperCase();
  if (pre === "HK") return MARKET_RED_FACTOR_IDS.filter(id => id.startsWith("HK_"));
  if (pre === "US") return MARKET_RED_FACTOR_IDS.filter(id => id.startsWith("US_"));
  if (pre === "CRYPTO" || pre === "CC") return MARKET_RED_FACTOR_IDS.filter(id => id.startsWith("CRYPTO_"));
  return MARKET_RED_FACTOR_IDS.filter(id => id.startsWith(pre + "_"));
}