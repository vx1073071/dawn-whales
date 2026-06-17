// @ts-nocheck
// R276 ML#1: A-Share 20 Factor Engine — CN market specific factor calculators
// Covers: Value, Growth, Quality, Momentum, Size, Volatility, Liquidity, Sentiment, FundFlow, Macro
// All using FactorCalculator base class

import { FactorCalculator, type FactorInput } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

// ── Value Factors (5) ─────────────────────────────────────────────────────

export class CN_PE_TTM_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_PE_TTM' as FactorId, level1: 'L1_VALUE', level2: 'L2_CN', label: '市盈率TTM' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pe = input.fundamentals?.peTtm ?? 0;
    if (pe <= 0) return { value: 0, rawValue: pe, label: 'PE≤0 (亏损)' };
    return { value: -Math.tanh((pe - 15) / 15), rawValue: pe, label: `PE TTM ${pe.toFixed(1)}x` };
  }
}

export class CN_PB_LF_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_PB_LF' as FactorId, level1: 'L1_VALUE', level2: 'L2_CN', label: '市净率LF' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pb = input.fundamentals?.pbLf ?? 0;
    if (pb <= 0) return { value: 0, rawValue: pb, label: 'PB≤0 (破净)' };
    return { value: -Math.tanh((pb - 1.5) / 2), rawValue: pb, label: `PB ${pb.toFixed(2)}x` };
  }
}

export class CN_DIVIDEND_YIELD_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_DIVIDEND_YIELD' as FactorId, level1: 'L1_VALUE', level2: 'L2_CN', label: '股息率' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const div = input.fundamentals?.dividendYield ?? 0;
    return { value: Math.tanh((div - 2) / 3), rawValue: div, label: `股息率 ${div.toFixed(2)}%` };
  }
}

export class CN_EV_EBITDA_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_EV_EBITDA' as FactorId, level1: 'L1_VALUE', level2: 'L2_CN', label: 'EV/EBITDA' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ev = input.fundamentals?.evEbitda ?? 0;
    if (ev <= 0) return { value: 0, rawValue: ev };
    return { value: -Math.tanh((ev - 10) / 10), rawValue: ev, label: `EV/EBITDA ${ev.toFixed(1)}x` };
  }
}

export class CN_PS_TTM_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_PS_TTM' as FactorId, level1: 'L1_VALUE', level2: 'L2_CN', label: '市销率TTM' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ps = input.fundamentals?.psTtm ?? 0;
    if (ps <= 0) return { value: 0, rawValue: ps };
    return { value: -Math.tanh((ps - 2) / 3), rawValue: ps, label: `PS TTM ${ps.toFixed(2)}x` };
  }
}

// ── Growth Factors (3) ────────────────────────────────────────────────────

export class CN_REVENUE_YOY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_REVENUE_YOY' as FactorId, level1: 'L1_GROWTH', level2: 'L2_CN', label: '营收YoY' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const revYoY = input.fundamentals?.revenueYoy ?? 0;
    return { value: Math.tanh(revYoY / 25), rawValue: revYoY, label: `营收YoY ${revYoY.toFixed(1)}%` };
  }
}

export class CN_EARNINGS_YOY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_EARNINGS_YOY' as FactorId, level1: 'L1_GROWTH', level2: 'L2_CN', label: '净利YoY' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const earnYoY = input.fundamentals?.earningsYoy ?? 0;
    return { value: Math.tanh(earnYoY / 30), rawValue: earnYoY, label: `净利YoY ${earnYoY.toFixed(1)}%` };
  }
}

export class CN_ROE_TTM_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_ROE_TTM' as FactorId, level1: 'L1_QUALITY', level2: 'L2_CN', label: 'ROE TTM' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const roe = input.fundamentals?.roeTtm ?? 0;
    return { value: Math.tanh((roe - 8) / 10), rawValue: roe, label: `ROE TTM ${roe.toFixed(1)}%` };
  }
}

// ── Momentum Factors (2) ──────────────────────────────────────────────────

export class CN_MOMENTUM_1M_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_MOMENTUM_1M' as FactorId, level1: 'L1_MOMENTUM', level2: 'L2_CN', label: '1月动量' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mom1 = input.price?.changePct1m ?? 0;
    return { value: Math.tanh(mom1 / 15), rawValue: mom1, label: `1月${mom1 >= 0 ? '+' : ''}${mom1.toFixed(1)}%` };
  }
}

export class CN_MOMENTUM_3M_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_MOMENTUM_3M' as FactorId, level1: 'L1_MOMENTUM', level2: 'L2_CN', label: '3月动量' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mom3 = input.price?.changePct3m ?? 0;
    return { value: Math.tanh(mom3 / 25), rawValue: mom3, label: `3月${mom3 >= 0 ? '+' : ''}${mom3.toFixed(1)}%` };
  }
}

// ── Size Factor (1) ───────────────────────────────────────────────────────

export class CN_MARKET_CAP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_MARKET_CAP' as FactorId, level1: 'L1_SIZE', level2: 'L2_CN', label: '市值' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const cap = input.price?.marketCap ?? 0;
    if (cap <= 0) return { value: 0, rawValue: cap };
    const capB = cap / 1e8; // in 亿
    return { value: -Math.tanh((Math.log10(capB) - 2) / 2), rawValue: capB, label: `市值 ${capB.toFixed(0)}亿` };
  }
}

// ── Volatility Factors (2) ────────────────────────────────────────────────

export class CN_VOLATILITY_20D_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_VOLATILITY_20D' as FactorId, level1: 'L1_VOLATILITY', level2: 'L2_CN', label: '20日波动' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const vol = input.price?.volatility20d ?? 0;
    return { value: -Math.tanh((vol - 30) / 20), rawValue: vol, label: `波动${vol.toFixed(1)}%` };
  }
}

export class CN_BETA_60D_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_BETA_60D' as FactorId, level1: 'L1_VOLATILITY', level2: 'L2_CN', label: '60日Beta' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const beta = input.price?.beta60d ?? 1;
    return { value: -(beta - 1) / 2, rawValue: beta, label: `Beta ${beta.toFixed(2)}` };
  }
}

// ── Liquidity Factors (2) ─────────────────────────────────────────────────

export class CN_TURNOVER_RATE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_TURNOVER_RATE' as FactorId, level1: 'L1_LIQUIDITY', level2: 'L2_CN', label: '换手率' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const turnover = input.price?.turnoverRate ?? 0;
    return { value: Math.tanh((turnover - 3) / 5), rawValue: turnover, label: `换手${turnover.toFixed(1)}%` };
  }
}

export class CN_AMPLITUDE_5D_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_AMPLITUDE_5D' as FactorId, level1: 'L1_LIQUIDITY', level2: 'L2_CN', label: '5日振幅' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ampl = input.price?.amplitude5d ?? 0;
    return { value: -Math.tanh((ampl - 8) / 6), rawValue: ampl, label: `振幅${ampl.toFixed(1)}%` };
  }
}

// ── Fund Flow Factors (3) ─────────────────────────────────────────────────

export class CN_NORTHBOUND_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_NORTHBOUND_FLOW' as FactorId, level1: 'L1_FLOW', level2: 'L2_CN', label: '北向资金' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const flow = (input.extra as Record<string,number>)?.northboundNet ?? 0;
    const mc = input.price?.marketCap ?? 1;
    const v = mc > 0 ? flow / mc : 0;
    return { value: Math.tanh(v * 1000), rawValue: flow, label: `北向 ${(flow / 1e8).toFixed(1)}亿` };
  }
}

export class CN_INSTITUTION_HOLDING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_INSTITUTION_HOLDING' as FactorId, level1: 'L1_FLOW', level2: 'L2_CN', label: '机构持股' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const instPct = input.fundamentals?.institutionHoldingPct ?? 0;
    return { value: Math.tanh((instPct - 30) / 20), rawValue: instPct, label: `机构${instPct.toFixed(1)}%` };
  }
}

export class CN_MAJOR_FLOW_5D_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_MAJOR_FLOW_5D' as FactorId, level1: 'L1_FLOW', level2: 'L2_CN', label: '5日主力' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mf = (input.extra as Record<string,number>)?.majorFlow5d ?? 0;
    const mc = input.price?.marketCap ?? 1;
    const v = mc > 0 ? mf / mc : 0;
    return { value: Math.tanh(v * 2000), rawValue: mf, label: `主力${(mf / 1e8).toFixed(2)}亿` };
  }
}

// ── Macro Factor (1) — PMI sensitivity ────────────────────────────────────

export class CN_PMI_SENSITIVITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_PMI_SENSITIVITY' as FactorId, level1: 'L1_MACRO', level2: 'L2_CN', label: 'PMI敏感度' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pmi = (input.extra as Record<string,number>)?.pmi ?? 50;
    const stockReturn = input.price?.changePct1m ?? 0;
    const v = (pmi - 50) * 2 + stockReturn * 0.5;
    return { value: Math.tanh(v / 20), rawValue: pmi, label: `PMI${pmi > 50 ? '+' : ''}` };
  }
}

// ── Sentiment Factor (1) — Dragon/Tiger list ──────────────────────────────

export class CN_DRAGON_TIGER_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CN_DRAGON_TIGER' as FactorId, level1: 'L1_SENTIMENT', level2: 'L2_CN', label: '龙虎榜净买' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const netBuy = (input.extra as Record<string,number>)?.dragonTigerNetBuy ?? 0;
    const mc = input.price?.marketCap ?? 1e8;
    const v = mc > 0 ? netBuy / mc : 0;
    return { value: Math.tanh(v * 500), rawValue: netBuy, label: `龙虎${(netBuy / 1e8).toFixed(2)}亿` };
  }
}

// ── All CN Factor export ──────────────────────────────────────────────────

export const CN_FACTOR_LIST = [
  'CN_PE_TTM', 'CN_PB_LF', 'CN_DIVIDEND_YIELD', 'CN_EV_EBITDA', 'CN_PS_TTM',
  'CN_REVENUE_YOY', 'CN_EARNINGS_YOY', 'CN_ROE_TTM',
  'CN_MOMENTUM_1M', 'CN_MOMENTUM_3M',
  'CN_MARKET_CAP',
  'CN_VOLATILITY_20D', 'CN_BETA_60D',
  'CN_TURNOVER_RATE', 'CN_AMPLITUDE_5D',
  'CN_NORTHBOUND_FLOW', 'CN_INSTITUTION_HOLDING', 'CN_MAJOR_FLOW_5D',
  'CN_PMI_SENSITIVITY',
  'CN_DRAGON_TIGER',
] as const;
