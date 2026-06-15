// R195 J2: KR6+SG5+AU5 = 16 Market-Specific Factor Calculators
import { FactorCalculator, type FactorInput } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

// === KR 6 ===
export class KR_CHAEBOL_DISCOUNT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'KR_CHAEBOL_DISCOUNT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_VALUE', label: 'Chaebol Conglomerate Discount' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const isC = (input.extra as Record<string,number>)?.chaebolGroup ?? 0;
    const disc = (input.extra as Record<string,number>)?.discount ?? 0;
    const gov = (input.extra as Record<string,number>)?.governanceScore ?? 70;
    const v = isC > 0 ? -(disc * 2 + (100 - gov) / 100) : 0;
    return { value: Math.tanh(v), rawValue: disc };
  }
}

export class KR_FOREIGN_OWNERSHIP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'KR_FOREIGN_OWNERSHIP' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_FLOW', label: 'Foreign Ownership Premium' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const own = (input.extra as Record<string,number>)?.foreignOwnership ?? 0.3;
    const net = (input.extra as Record<string,number>)?.foreignNetBuy ?? 0;
    const v = own > 0.4 ? 0.5 : own > 0.3 ? 0.3 : 0 + Math.tanh(net * 1e-7);
    return { value: Math.tanh(v), rawValue: own };
  }
}

export class KR_SAMSUNG_LINKAGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'KR_SAMSUNG_LINKAGE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'Samsung Group Linkage' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const corr = (input.extra as Record<string,number>)?.samsungCorrelation ?? 0.4;
    const tier = (input.extra as Record<string,number>)?.supplyChainTier ?? 3;
    const v = tier <= 1 ? corr * 1.2 : tier === 2 ? corr * 0.8 : corr * 0.3;
    return { value: v, rawValue: corr };
  }
}

export class KR_OPTION_EXPIRY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'KR_OPTION_EXPIRY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_EVENT', label: 'KOSPI Option Expiry' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const days = (input.extra as Record<string,number>)?.daysToExpiry ?? 7;
    const gamma = (input.extra as Record<string,number>)?.gammaExposure ?? 0;
    const v = days <= 2 ? 0.5 + gamma : days <= 5 ? 0.3 + gamma : 0;
    return { value: Math.abs(v) > 1 ? Math.sign(v) : v, rawValue: days };
  }
}

export class KR_KRW_SENSITIVITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'KR_KRW_SENSITIVITY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CURRENCY', label: 'KRW Exchange Sensitivity' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const krw = (input.extra as Record<string,number>)?.usdKrw ?? 1280;
    const exportR = (input.extra as Record<string,number>)?.exportRatio ?? 0.4;
    const v = krw > 1320 ? exportR : krw < 1200 ? -exportR : 0;
    return { value: Math.tanh(v), rawValue: krw };
  }
}

export class KR_DIVIDEND_YIELD_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'KR_DIVIDEND_YIELD' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_YIELD', label: 'Korean Dividend Yield Premium' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dy = (input.extra as Record<string,number>)?.dividendYield ?? 0.025;
    const pay = (input.extra as Record<string,number>)?.payoutRatio ?? 0.2;
    const v = dy > 0.04 ? 1 : dy > 0.03 ? 0.6 : dy > 0.02 ? 0.3 : 0 + (pay > 0.3 ? 0.3 : 0);
    return { value: Math.min(1, v), rawValue: dy };
  }
}

// === SG 5 ===
export class SG_REIT_SPREAD_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SG_REIT_SPREAD' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_YIELD', label: 'REIT Yield Spread' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const isR = (input.extra as Record<string,number>)?.isReit ?? 0;
    const spread = (input.extra as Record<string,number>)?.spread ?? 0.02;
    const propY = (input.extra as Record<string,number>)?.propertyYield ?? 0;
    const rf = (input.extra as Record<string,number>)?.riskFreeRate ?? 0.025;
    const v = isR > 0 ? (propY - rf) / rf : 0;
    return { value: Math.tanh(v), rawValue: spread };
  }
}

export class SG_STI_WEIGHT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SG_STI_WEIGHT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_VALUE', label: 'STI Index Weight Effect' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const weight = (input.extra as Record<string,number>)?.stiWeight ?? 0.02;
    const top10 = (input.extra as Record<string,number>)?.inTop10 ?? 0;
    const v = weight > 0.05 ? 0.5 : weight > 0.03 ? 0.3 : 0.1 + (top10 > 0 ? 0.5 : 0);
    return { value: Math.min(1, v), rawValue: weight };
  }
}

export class SG_SGD_LINKAGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SG_SGD_LINKAGE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CURRENCY', label: 'SGD Exchange Linkage' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sgd = (input.extra as Record<string,number>)?.usdSgd ?? 1.34;
    const strength = (input.extra as Record<string,number>)?.sgdStrength ?? 0;
    const v = sgd < 1.32 ? -0.5 : sgd > 1.36 ? 0.5 : 0 + strength * 0.5;
    return { value: Math.tanh(v), rawValue: sgd };
  }
}

export class SG_DIVIDEND_CULTURE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SG_DIVIDEND_CULTURE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_YIELD', label: 'Dividend Culture Premium' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dy = (input.extra as Record<string,number>)?.dividendYield ?? 0.035;
    const payout = (input.extra as Record<string,number>)?.payoutRatio ?? 0.5;
    const growth = (input.extra as Record<string,number>)?.dividendGrowth3y ?? 0.05;
    const v = dy * 6 + payout + growth * 3;
    return { value: Math.tanh(v), rawValue: dy };
  }
}

export class SG_US_LISTED_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SG_US_LISTED' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'US-Listed ADR Premium' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const has = (input.extra as Record<string,number>)?.hasUsListing ?? 0;
    const premium = (input.extra as Record<string,number>)?.adrPremium ?? 0;
    const v = has > 0 ? (premium > 0.05 ? 1 : premium < -0.05 ? -1 : 0) : 0;
    return { value: v, rawValue: premium };
  }
}

// === AU 5 ===
export class AU_COMMODITY_LINK_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'AU_COMMODITY_LINK' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'Commodity Price Linkage' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const isM = (input.extra as Record<string,number>)?.isCommodity ?? 0;
    const fe = (input.extra as Record<string,number>)?.ironOreBeta ?? 0;
    const coal = (input.extra as Record<string,number>)?.coalBeta ?? 0;
    const lng = (input.extra as Record<string,number>)?.lngBeta ?? 0;
    const gold = (input.extra as Record<string,number>)?.goldBeta ?? 0;
    const v = isM > 0 ? (fe * 0.4 + coal * 0.3 + lng * 0.2 + gold * 0.1) : 0.1;
    return { value: Math.tanh(v) * (isM > 0 ? 1.5 : 1), rawValue: fe };
  }
}

export class AU_FRANKING_CREDIT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'AU_FRANKING_CREDIT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_YIELD', label: 'Franking Credit Premium' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const fpct = (input.extra as Record<string,number>)?.frankingPct ?? 0.8;
    const gross = (input.extra as Record<string,number>)?.grossedUpYield ?? 0.06;
    const v = fpct > 0.75 ? gross * 5 : fpct > 0.5 ? gross * 3 : gross * 2;
    return { value: Math.tanh(v), rawValue: fpct };
  }
}

export class AU_DIVIDEND_SEASON_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'AU_DIVIDEND_SEASON' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SEASONAL', label: 'Dividend Season Effect' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dy = (input.extra as Record<string,number>)?.dividendYield ?? 0.045;
    const near = (input.extra as Record<string,number>)?.seasonNearness ?? 0;
    const v = dy * 4 + near * 0.5;
    return { value: Math.tanh(v), rawValue: dy };
  }
}

export class AU_BANK_DIVIDEND_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'AU_BANK_DIVIDEND' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_YIELD', label: 'Big Bank High Dividend' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const isB = (input.extra as Record<string,number>)?.isBank ?? 0;
    const dy = (input.extra as Record<string,number>)?.dividendYield ?? 0.05;
    const car = (input.extra as Record<string,number>)?.capitalAdequacy ?? 0.12;
    const v = isB > 0 ? (dy * 8 + (car > 0.11 ? 0.3 : -0.5)) : dy * 3;
    return { value: Math.tanh(v), rawValue: dy };
  }
}

export class AU_AUD_SENSITIVITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'AU_AUD_SENSITIVITY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CURRENCY', label: 'AUD Exchange Sensitivity' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const aud = (input.extra as Record<string,number>)?.audUsd ?? 0.7;
    const exportR = (input.extra as Record<string,number>)?.exportRatio ?? 0.35;
    const v = aud > 0.72 ? exportR : aud < 0.66 ? -exportR : 0;
    return { value: Math.tanh(v), rawValue: aud };
  }
}

// === Registry ===
export const KRSGAU_FACTOR_CALCULATORS: Record<string, { new(): FactorCalculator }> = {
  KR_CHAEBOL_DISCOUNT: KR_CHAEBOL_DISCOUNT_Calculator,
  KR_FOREIGN_OWNERSHIP: KR_FOREIGN_OWNERSHIP_Calculator,
  KR_SAMSUNG_LINKAGE: KR_SAMSUNG_LINKAGE_Calculator,
  KR_OPTION_EXPIRY: KR_OPTION_EXPIRY_Calculator,
  KR_KRW_SENSITIVITY: KR_KRW_SENSITIVITY_Calculator,
  KR_DIVIDEND_YIELD: KR_DIVIDEND_YIELD_Calculator,
  SG_REIT_SPREAD: SG_REIT_SPREAD_Calculator,
  SG_STI_WEIGHT: SG_STI_WEIGHT_Calculator,
  SG_SGD_LINKAGE: SG_SGD_LINKAGE_Calculator,
  SG_DIVIDEND_CULTURE: SG_DIVIDEND_CULTURE_Calculator,
  SG_US_LISTED: SG_US_LISTED_Calculator,
  AU_COMMODITY_LINK: AU_COMMODITY_LINK_Calculator,
  AU_FRANKING_CREDIT: AU_FRANKING_CREDIT_Calculator,
  AU_DIVIDEND_SEASON: AU_DIVIDEND_SEASON_Calculator,
  AU_BANK_DIVIDEND: AU_BANK_DIVIDEND_Calculator,
  AU_AUD_SENSITIVITY: AU_AUD_SENSITIVITY_Calculator,
};

export const KRSGAU_FACTOR_IDS: readonly string[] = Object.keys(KRSGAU_FACTOR_CALCULATORS);

export function getKrSgAuFactorCalculator(factorId: string): FactorCalculator | null {
  const Ctor = KRSGAU_FACTOR_CALCULATORS[factorId];
  return Ctor ? new Ctor() : null;
}

export function getFactorsByMarket(market: string): string[] {
  const pre = market.toUpperCase();
  if (pre === 'KR') return KRSGAU_FACTOR_IDS.filter(id => id.startsWith('KR_'));
  if (pre === 'SG') return KRSGAU_FACTOR_IDS.filter(id => id.startsWith('SG_'));
  if (pre === 'AU') return KRSGAU_FACTOR_IDS.filter(id => id.startsWith('AU_'));
  return [];
}

export const KRSGAU_FACTOR_COUNT = 16;