// R191 J1: 30 Pro Factor Calculators
// All extend FactorCalculator using correct FactorLevel1/Level2 from registry.
import { FactorCalculator, RatioCalculator, type FactorInput, type RatioCalculatorConfig } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

export class EBITDA_EV_Calculator extends RatioCalculator {
  constructor() {
    super({ factorId: 'EBITDA_EV' as FactorId, level1: 'L1_CLASSIC', level2: 'L2_VALUE', numerator: 'ebitda', denominator: 'totalAssets', label: 'EBITDA/TA proxy', invert: true, denominatorFloor: 1, valueCap: 100 });
  }
}

export class GRAHAM_NET_Calculator extends RatioCalculator {
  constructor() {
    super({ factorId: 'GRAHAM_NET' as FactorId, level1: 'L1_CLASSIC', level2: 'L2_VALUE', numerator: 'bookValuePerShare', denominator: 'marketCap', label: 'Graham P/B proxy', invert: true, denominatorFloor: 1, valueCap: 100 });
  }
}

export class ACCRUALS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'ACCRUALS' as FactorId, level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFIT_QUALITY', label: 'Accruals Quality' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const f = input.fundamental ?? {};
    const acc = (f.netIncome ?? 0) - (f.operatingCashFlow ?? 0);
    return { value: (f.totalAssets??1) > 0 ? -acc / (f.totalAssets??1) : 0, rawValue: acc };
  }
}

export class DEBT_MATURITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'DEBT_MATURITY' as FactorId, level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFIT_QUALITY', label: 'Debt Maturity Risk' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const st = (input.extra as Record<string,number>)?.shortTermDebt ?? 0;
    const f = input.fundamental ?? {};
    const lt = (input.extra as Record<string,number>)?.longTermDebt ?? (f.totalLiabilities ?? 0) - st;
    const tot = Math.max(1, st + lt);
    return { value: -(st / tot), rawValue: st / tot };
  }
}

export class BAB_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'BAB' as FactorId, level1: 'L1_RISK', level2: 'L2_DOWNSIDE', label: 'BAB' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const b = (input.extra as Record<string,number>)?.beta ?? 1;
    return { value: 1 / Math.max(0.1, b), rawValue: b };
  }
}

export class TAIL_RISK_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TAIL_RISK' as FactorId, level1: 'L1_RISK', level2: 'L2_DOWNSIDE', label: 'Tail Risk' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const v = (input.extra as Record<string,number>)?.var95 ?? 0.12;
    return { value: -v, rawValue: v };
  }
}

export class SHORT_SQUEEZE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SHORT_SQUEEZE' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_MARKET_MOOD', label: 'Short Squeeze' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sf = (input.extra as Record<string,number>)?.shortFloat ?? 0;
    const sr = (input.extra as Record<string,number>)?.shortRatio ?? 0;
    const pc = input.priceData.prevClose ? (input.priceData.close - input.priceData.prevClose) / input.priceData.prevClose : 0;
    const score = Math.min(1, sf * 5 + (sr > 5 ? 0.5 : 0) + (pc > 0.05 ? 0.5 : 0));
    return { value: score, rawValue: sf };
  }
}

export class SHORT_CROWDING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SHORT_CROWDING' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_MARKET_MOOD', label: 'Short Crowding' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sf = (input.extra as Record<string,number>)?.shortFloat ?? 0;
    return { value: -sf, rawValue: sf };
  }
}

export class FACTOR_CROWDING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'FACTOR_CROWDING' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_MARKET_MOOD', label: 'Factor Crowding' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const cs = (input.extra as Record<string,number>)?.crowdingScore ?? 0.3;
    return { value: -cs, rawValue: cs };
  }
}

export class GDP_BETA_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'GDP_BETA' as FactorId, level1: 'L1_MACRO', level2: 'L2_SENSITIVITY', label: 'GDP Beta' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pmi = input.macroContext?.pmi ?? 50;
    const beta = Math.max(-3, Math.min(3, (pmi - 45) / 15));
    return { value: beta, rawValue: pmi };
  }
}

export class VOLATILITY_REGIME_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'VOLATILITY_REGIME' as FactorId, level1: 'L1_MACRO', level2: 'L2_SENSITIVITY', label: 'Volatility Regime' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const vix = input.macroContext?.vix ?? 15;
    const regime = vix > 30 ? 3 : vix > 20 ? 2 : vix > 12 ? 1 : 0;
    return { value: regime / 3, rawValue: vix };
  }
}

export class CROSS_ASSET_CORR_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CROSS_ASSET_CORR' as FactorId, level1: 'L1_MACRO', level2: 'L2_SENSITIVITY', label: 'Cross-Asset Corr' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const corr = (input.extra as Record<string,number>)?.crossAssetCorr ?? 0.3;
    return { value: corr > 0.7 ? -corr : corr, rawValue: corr };
  }
}

export class GAMMA_EXPOSURE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'GAMMA_EXPOSURE' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'Gamma Exposure' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const g = (input.extra as Record<string,number>)?.gammaExposure ?? 0;
    return { value: g, rawValue: g };
  }
}

export class IMPLIED_CORRELATION_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IMPLIED_CORRELATION' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'Implied Correlation' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const idx = (input.extra as Record<string,number>)?.indexIv ?? 0.2;
    const avg = (input.extra as Record<string,number>)?.avgSingleStockIv ?? 0.25;
    const ic = avg > 0 ? 1 - idx * idx / (avg * avg) : 0;
    return { value: Math.max(0, Math.min(1, ic)), rawValue: ic };
  }
}

export class IV_TERM_STRUCT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IV_TERM_STRUCT' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'IV Term Structure' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const iv30 = (input.extra as Record<string,number>)?.iv30d ?? 0.2;
    const iv7 = (input.extra as Record<string,number>)?.iv7d ?? 0.2;
    return { value: iv7 > 0 ? iv30 / iv7 - 1 : 0, rawValue: iv30 };
  }
}

export class VRP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'VRP' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'Vol Risk Premium' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const iv = (input.extra as Record<string,number>)?.atmIv ?? 0.2;
    const rv = (input.extra as Record<string,number>)?.realizedVol ?? 0.15;
    const vrp = (iv - rv) / Math.max(0.01, rv);
    return { value: vrp, rawValue: iv };
  }
}

export class OPTION_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'OPTION_FLOW' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'Option Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const cp = (input.extra as Record<string,number>)?.callOptionFlow ?? 0;
    const pp = (input.extra as Record<string,number>)?.putOptionFlow ?? 0;
    const tot = cp + pp;
    const score = tot > 0 ? (cp - pp) / tot : 0;
    return { value: (score + 1) / 2, rawValue: score };
  }
}

export class PINCH_RISK_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'PINCH_RISK' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'Pinch Risk' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dist = (input.extra as Record<string,number>)?.closestStrikeDistance ?? 0.01;
    const dte = (input.extra as Record<string,number>)?.daysToExpiry ?? 20;
    const tw = Math.exp(-dte / 5);
    const pinch = dist < 0.005 ? tw : 0;
    return { value: -pinch, rawValue: dist };
  }
}

export class OPTION_SKEW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'OPTION_SKEW' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: '25-Delta Skew' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const skew = (input.extra as Record<string,number>)?.skew25Delta ?? 0;
    return { value: skew, rawValue: skew };
  }
}

export class INDEX_REBALANCE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'INDEX_REBALANCE' as FactorId, level1: 'L1_EVENT', level2: 'L2_EARNINGS', label: 'Index Rebalance' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const imp = (input.extra as Record<string,number>)?.rebalanceImpact ?? 0;
    return { value: imp, rawValue: imp };
  }
}

export class BOND_SPREAD_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'BOND_SPREAD' as FactorId, level1: 'L1_EVENT', level2: 'L2_EARNINGS', label: 'Bond Credit Spread' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sp = input.macroContext?.creditSpread ?? 0.02;
    return { value: -sp, rawValue: sp };
  }
}

export class BUYBACK_YIELD_ADV_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'BUYBACK_YIELD_ADV' as FactorId, level1: 'L1_EVENT', level2: 'L2_EARNINGS', label: 'Buyback Yield Adv' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const nb = (input.extra as Record<string,number>)?.netBuyback ?? 0;
    const mc = input.fundamental?.marketCap ?? 1;
    return { value: mc > 0 ? nb / mc : 0, rawValue: nb };
  }
}

export class PAIRS_SPREAD_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'PAIRS_SPREAD' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CARRY', label: 'Pairs Spread' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sp = (input.extra as Record<string,number>)?.pairSpread ?? 0;
    return { value: sp, rawValue: sp };
  }
}

export class CROSS_MARKET_DISCOUNT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CROSS_MARKET_DISCOUNT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CARRY', label: 'Cross-Mkt Discount' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const alt = (input.extra as Record<string,number>)?.altPrice ?? input.priceData.close;
    const disc = alt > 0 ? input.priceData.close / alt - 1 : 0;
    return { value: disc, rawValue: alt };
  }
}

export class FIXED_INCOME_CARRY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'FIXED_INCOME_CARRY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CARRY', label: 'FI Carry' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const yld = input.macroContext?.us10y ?? 0.03;
    const fund = input.macroContext?.fedFundsRate ?? 0.02;
    return { value: yld - fund, rawValue: yld };
  }
}

export class CAPEX_INTENSITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CAPEX_INTENSITY' as FactorId, level1: 'L1_FUNDAMENTAL', level2: 'L2_VALUE_DEEP', label: 'Capex Intensity' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const fcf = input.fundamental?.freeCashFlow ?? 0;
    const rev = input.fundamental?.revenue ?? 1;
    return { value: rev > 0 ? fcf / rev : 0, rawValue: fcf };
  }
}

export class ALTMAN_Z_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'ALTMAN_Z' as FactorId, level1: 'L1_FUNDAMENTAL', level2: 'L2_VALUE_DEEP', label: 'Altman Z-Score' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const f = input.fundamental ?? {};
    const ta = f.totalAssets ?? 1;
    if (ta <= 0) return { value: 1.8, rawValue: 1.8 };
    const wc = ((input.extra as Record<string,number>)?.workingCapital ?? 0) / ta;
    const re = ((input.extra as Record<string,number>)?.retainedEarnings ?? 0) / ta;
    const ebit = (f.ebitda ?? 0) / ta;
    const mcapV = (f.marketCap ?? 0) / (f.totalLiabilities || 1);
    const rev = (f.revenue ?? 0) / ta;
    const z = 1.2 * wc + 1.4 * re + 3.3 * ebit + 0.6 * mcapV + 1.0 * rev;
    return { value: z, rawValue: z };
  }
}

export class APP_DOWNLOADS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'APP_DOWNLOADS' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_SOCIAL', label: 'App Downloads' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const dl = (input.extra as Record<string,number>)?.appDownloads7d ?? 0;
    const prev = (input.extra as Record<string,number>)?.appDownloadsPrev7d ?? dl;
    return { value: prev > 0 ? (dl - prev) / prev : 0, rawValue: dl };
  }
}

export class JOB_POSTINGS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JOB_POSTINGS' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_SOCIAL', label: 'Job Postings' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const jobs = (input.extra as Record<string,number>)?.jobPostings ?? 0;
    const prev = (input.extra as Record<string,number>)?.jobPostingsPrev ?? jobs;
    return { value: prev > 0 ? (jobs - prev) / prev : 0, rawValue: jobs };
  }
}

export class SUPPLY_CHAIN_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'SUPPLY_CHAIN' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_SOCIAL', label: 'Supply Chain' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sc = (input.extra as Record<string,number>)?.supplyChainScore ?? 0.5;
    return { value: sc > 0.5 ? sc : -sc, rawValue: sc };
  }
}

// === Registry ===
export const PRO_FACTOR_CALCULATORS: Record<string, { new(): FactorCalculator }> = {
  EBITDA_EV: EBITDA_EV_Calculator,
  GRAHAM_NET: GRAHAM_NET_Calculator,
  ACCRUALS: ACCRUALS_Calculator,
  DEBT_MATURITY: DEBT_MATURITY_Calculator,
  BAB: BAB_Calculator,
  TAIL_RISK: TAIL_RISK_Calculator,
  SHORT_SQUEEZE: SHORT_SQUEEZE_Calculator,
  SHORT_CROWDING: SHORT_CROWDING_Calculator,
  FACTOR_CROWDING: FACTOR_CROWDING_Calculator,
  GDP_BETA: GDP_BETA_Calculator,
  VOLATILITY_REGIME: VOLATILITY_REGIME_Calculator,
  CROSS_ASSET_CORR: CROSS_ASSET_CORR_Calculator,
  GAMMA_EXPOSURE: GAMMA_EXPOSURE_Calculator,
  IMPLIED_CORRELATION: IMPLIED_CORRELATION_Calculator,
  IV_TERM_STRUCT: IV_TERM_STRUCT_Calculator,
  VRP: VRP_Calculator,
  OPTION_FLOW: OPTION_FLOW_Calculator,
  PINCH_RISK: PINCH_RISK_Calculator,
  OPTION_SKEW: OPTION_SKEW_Calculator,
  INDEX_REBALANCE: INDEX_REBALANCE_Calculator,
  BOND_SPREAD: BOND_SPREAD_Calculator,
  BUYBACK_YIELD_ADV: BUYBACK_YIELD_ADV_Calculator,
  PAIRS_SPREAD: PAIRS_SPREAD_Calculator,
  CROSS_MARKET_DISCOUNT: CROSS_MARKET_DISCOUNT_Calculator,
  FIXED_INCOME_CARRY: FIXED_INCOME_CARRY_Calculator,
  CAPEX_INTENSITY: CAPEX_INTENSITY_Calculator,
  ALTMAN_Z: ALTMAN_Z_Calculator,
  APP_DOWNLOADS: APP_DOWNLOADS_Calculator,
  JOB_POSTINGS: JOB_POSTINGS_Calculator,
  SUPPLY_CHAIN: SUPPLY_CHAIN_Calculator,
};

export function getProFactorCalculator(factorId: string): FactorCalculator | null {
  const Ctor = PRO_FACTOR_CALCULATORS[factorId];
  return Ctor ? new Ctor() : null;
}