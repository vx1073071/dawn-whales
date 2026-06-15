// R194 J3: JP12 + TW7 = 19 Market-Specific Factor Calculators
// JP: BoJ_ETF, Cross_Holding, March_Effect, Carry_Trade, JPX400, TOPIX_Sector,
//     Foreign_Flow, Dividend_Season, Shareholder_Benefit, Bank_Lending, Value_Trap, Yen_Sensitivity
// TW: Margin_Balance, Short_Ratio, Foreign_Flow, TSMC_Linkage, Dividend_Chase, Financing_Overheat, NT_Dollar
import { FactorCalculator, type FactorInput } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

// === JP 12 ===
export class JP_BOJ_ETF_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_BOJ_ETF' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_FLOW', label: 'BoJ ETF Purchase' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const buying = (input.extra as Record<string,number>)?.bojEtfPurchasing ?? 0;
    const topixDev = (input.extra as Record<string,number>)?.topixDeviation ?? 0;
    return { value: buying > 0.5 ? 0.5 + topixDev : buying > 0.3 ? 0.2 : 0, rawValue: buying };
  }
}

export class JP_CROSS_HOLDING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_CROSS_HOLDING' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_VALUATION', label: 'Cross-Holding Discount' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ratio = (input.extra as Record<string,number>)?.crossHoldingRatio ?? 0.15;
    const trend = (input.extra as Record<string,number>)?.unwindingTrend ?? 0;
    const v = -(ratio * 2 + trend * 5);
    return { value: Math.tanh(v), rawValue: ratio };
  }
}

export class JP_MARCH_EFFECT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_MARCH_EFFECT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_EVENT', label: 'March Fiscal Year-End Effect' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const now = new Date(input.timestamp);
    const month = now.getMonth();
    const day = now.getDate();
    const daysToMarch = (2 - month) * 30 + (31 - day);
    const v = daysToMarch > 0 && daysToMarch < 60 ? (60 - daysToMarch) / 60 : 0;
    return { value: v, rawValue: daysToMarch };
  }
}

export class JPY_CARRY_TRADE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JPY_CARRY_TRADE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'JPY Carry Trade' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const yen = (input.extra as Record<string,number>)?.yenStrength ?? 125;
    const usBond = (input.extra as Record<string,number>)?.us10y ?? 3.5;
    const jpBond = (input.extra as Record<string,number>)?.jp10y ?? 0.5;
    const spread = usBond - jpBond;
    const carry = yen > 130 ? 1 : yen < 110 ? -1 : 0;
    return { value: carry + Math.tanh(spread - 2), rawValue: spread };
  }
}

export class JPX_400_SELECTION_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JPX_400_SELECTION' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_QUALITY', label: 'JPX400 Index Selection' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const included = (input.extra as Record<string,number>)?.jpx400Included ?? 0;
    const score = (input.extra as Record<string,number>)?.compositeScore ?? 50;
    const v = included > 0 ? (score - 50) / 50 : -0.5;
    return { value: Math.tanh(v), rawValue: score };
  }
}

export class JP_TOPIX_SECTOR_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_TOPIX_SECTOR' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_MOMENTUM', label: 'TOPIX Sector Rotation' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mom = (input.extra as Record<string,number>)?.sectorMomentum ?? 0;
    const rotation = (input.extra as Record<string,number>)?.rotationSignal ?? 0;
    return { value: Math.tanh(mom * 5) + rotation * 0.5, rawValue: mom };
  }
}

export class JP_FOREIGN_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_FOREIGN_FLOW' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_FLOW', label: 'Foreign Investor Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const netFlow = (input.extra as Record<string,number>)?.netBuySellBln ?? 0;
    const ownRatio = (input.extra as Record<string,number>)?.foreignOwnershipRatio ?? 0.3;
    const trend = (input.extra as Record<string,number>)?.weeklyTrend ?? netFlow;
    const v = Math.tanh(netFlow * 0.05) + (ownRatio > 0.35 ? 0.3 : ownRatio > 0.25 ? 0 : -0.2);
    return { value: v, rawValue: netFlow };
  }
}

export class JP_DIVIDEND_SEASON_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_DIVIDEND_SEASON' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_EVENT', label: 'Dividend Season Effect' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const yield_ = (input.extra as Record<string,number>)?.dividendYield ?? 0.02;
    const now = new Date(input.timestamp);
    const month = now.getMonth();
    const nearSeason = month === 2 || month === 8 ? 1 : 0;
    const v = yield_ * 5 + nearSeason * 0.3;
    return { value: Math.min(1, v), rawValue: yield_ };
  }
}

export class JP_SHAREHOLDER_BENEFIT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_SHAREHOLDER_BENEFIT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENTIMENT', label: 'Shareholder Benefit (Kabunushi) Star' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const hasBenefit = (input.extra as Record<string,number>)?.hasBenefit ?? 0;
    const value_ = (input.extra as Record<string,number>)?.benefitValue ?? 0;
    const count = (input.extra as Record<string,number>)?.shareholderCount ?? 0;
    const v = hasBenefit > 0 ? 0.3 + Math.min(0.7, Math.log10(value_ + 1) / 5 + Math.log10(count + 1) / 10) : 0;
    return { value: v, rawValue: value_ };
  }
}

export class JP_BANK_LENDING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_BANK_LENDING' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'Bank Lending Exposure' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const exposure = (input.extra as Record<string,number>)?.bankLendingExposure ?? 0.2;
    const interestRate = (input.extra as Record<string,number>)?.tibor3m ?? 0.1;
    const v = exposure * (interestRate > 0.5 ? 1 : interestRate > 0 ? 0.5 : -0.3);
    return { value: v, rawValue: exposure };
  }
}

export class JP_VALUE_TRAP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JP_VALUE_TRAP' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_VALUATION', label: 'Value Trap Detection' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pb = (input.extra as Record<string,number>)?.pbRatio ?? 1;
    const roe = (input.extra as Record<string,number>)?.roe ?? 0.05;
    const crossHolding = (input.extra as Record<string,number>)?.crossHoldingRatio ?? 0.1;
    const v = pb < 0.8 && roe < 0.05 && crossHolding > 0.2 ? -1 : pb < 1 && roe < 0.08 ? -0.5 : 0;
    return { value: v, rawValue: pb };
  }
}

export class JPY_SENSITIVITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'JPY_SENSITIVITY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'JPY Exchange Sensitivity' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const yenBeta = (input.extra as Record<string,number>)?.yenBeta ?? 1;
    const exportRatio = (input.extra as Record<string,number>)?.exportRatio ?? 0.3;
    const yen = (input.extra as Record<string,number>)?.yenStrength ?? 125;
    const v = yen > 130 ? exportRatio * yenBeta : yen < 110 ? -exportRatio * yenBeta : 0;
    return { value: Math.tanh(v), rawValue: yenBeta };
  }
}

// === TW 7 ===
export class TW_MARGIN_BALANCE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_MARGIN_BALANCE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_FLOW', label: 'Margin Balance' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const bal = (input.extra as Record<string,number>)?.marginBalanceBln ?? 10;
    const change = (input.extra as Record<string,number>)?.marginChange ?? 0;
    const util = (input.extra as Record<string,number>)?.marginUtilization ?? 0.5;
    const v = change > 0.1 ? 1 : change > 0.05 ? 0.5 : change < -0.1 ? -1 : change < -0.05 ? -0.5 : 0;
    return { value: v + (util > 0.8 ? -0.3 : 0), rawValue: bal };
  }
}

export class TW_SHORT_RATIO_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_SHORT_RATIO' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENTIMENT', label: 'Short Ratio' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ratio = (input.extra as Record<string,number>)?.shortRatio ?? 0.1;
    const days = (input.extra as Record<string,number>)?.daysToCover ?? 3;
    const v = ratio > 0.25 ? -1 : ratio > 0.15 ? -0.5 : ratio < 0.05 ? 0.5 : 0;
    return { value: v - (days > 10 ? 0.3 : 0), rawValue: ratio };
  }
}

export class TW_FOREIGN_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_FOREIGN_FLOW' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_FLOW', label: 'Foreign Investor Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const net = (input.extra as Record<string,number>)?.foreignNetBuyBln ?? 0;
    const pct = (input.extra as Record<string,number>)?.foreignOwnershipPct ?? 0.25;
    const v = Math.tanh(net * 0.2) + (pct > 0.4 ? 0.3 : pct > 0.3 ? 0 : -0.2);
    return { value: v, rawValue: net };
  }
}

export class TW_TSMC_LINKAGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_TSMC_LINKAGE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'TSMC Linkage' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const corr = (input.extra as Record<string,number>)?.tsmcCorrelation ?? 0.4;
    const level = (input.extra as Record<string,number>)?.supplyChainLevel ?? 0;
    const v = level > 0 ? corr * 0.8 + (level === 1 ? 0.4 : level === 2 ? 0.2 : 0) : 0;
    return { value: v, rawValue: corr };
  }
}

export class TW_DIVIDEND_CHASE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_DIVIDEND_CHASE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_EVENT', label: 'Ex-Dividend Chase' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const yield_ = (input.extra as Record<string,number>)?.dividendYield ?? 0.03;
    const days = (input.extra as Record<string,number>)?.daysToExDividend ?? 60;
    const near = days < 30 ? 1 : days < 60 ? (60 - days) / 30 : 0;
    const v = near * (yield_ > 0.05 ? 1 : yield_ > 0.03 ? 0.6 : 0.3);
    return { value: v, rawValue: yield_ };
  }
}

export class TW_FINANCING_OVERHEAT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_FINANCING_OVERHEAT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_RISK', label: 'Margin Financing Overheat' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const growth = (input.extra as Record<string,number>)?.marginGrowth ?? 0;
    const score = (input.extra as Record<string,number>)?.overheatScore ?? 0;
    const v = score > 0.8 ? -1 : score > 0.6 ? -0.5 : growth > 0.3 ? -1 : growth > 0.15 ? -0.5 : 0;
    return { value: v, rawValue: score };
  }
}

export class TW_NT_DOLLAR_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'TW_NT_DOLLAR' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SENSITIVITY', label: 'NT Dollar Exchange' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const usdTwd = (input.extra as Record<string,number>)?.usdTwd ?? 30;
    const export_ = (input.extra as Record<string,number>)?.exportExportRatio ?? 0.4;
    const strength = usdTwd < 29 ? 1 : usdTwd > 31 ? -1 : 0;
    const v = strength * (export_ > 0.5 ? 1.5 : 1);
    return { value: v, rawValue: usdTwd };
  }
}

// === Registry ===
export const JP_TW_FACTOR_CALCULATORS: Record<string, { new(): FactorCalculator }> = {
  JP_BOJ_ETF: JP_BOJ_ETF_Calculator,
  JP_CROSS_HOLDING: JP_CROSS_HOLDING_Calculator,
  JP_MARCH_EFFECT: JP_MARCH_EFFECT_Calculator,
  JPY_CARRY_TRADE: JPY_CARRY_TRADE_Calculator,
  JPX_400_SELECTION: JPX_400_SELECTION_Calculator,
  JP_TOPIX_SECTOR: JP_TOPIX_SECTOR_Calculator,
  JP_FOREIGN_FLOW: JP_FOREIGN_FLOW_Calculator,
  JP_DIVIDEND_SEASON: JP_DIVIDEND_SEASON_Calculator,
  JP_SHAREHOLDER_BENEFIT: JP_SHAREHOLDER_BENEFIT_Calculator,
  JP_BANK_LENDING: JP_BANK_LENDING_Calculator,
  JP_VALUE_TRAP: JP_VALUE_TRAP_Calculator,
  JPY_SENSITIVITY: JPY_SENSITIVITY_Calculator,
  TW_MARGIN_BALANCE: TW_MARGIN_BALANCE_Calculator,
  TW_SHORT_RATIO: TW_SHORT_RATIO_Calculator,
  TW_FOREIGN_FLOW: TW_FOREIGN_FLOW_Calculator,
  TW_TSMC_LINKAGE: TW_TSMC_LINKAGE_Calculator,
  TW_DIVIDEND_CHASE: TW_DIVIDEND_CHASE_Calculator,
  TW_FINANCING_OVERHEAT: TW_FINANCING_OVERHEAT_Calculator,
  TW_NT_DOLLAR: TW_NT_DOLLAR_Calculator,
};

export const JP_TW_FACTOR_IDS: readonly string[] = Object.keys(JP_TW_FACTOR_CALCULATORS);

export function getJpTwFactorCalculator(factorId: string): FactorCalculator | null {
  const Ctor = JP_TW_FACTOR_CALCULATORS[factorId];
  return Ctor ? new Ctor() : null;
}

export function getFactorsByMarket(market: string): string[] {
  const pre = market.toUpperCase();
  if (pre === 'JP') return JP_TW_FACTOR_IDS.filter(id => id.startsWith('JP'));
  if (pre === 'TW') return JP_TW_FACTOR_IDS.filter(id => id.startsWith('TW'));
  return [];
}

export const JP_TW_FACTOR_COUNT = 19;