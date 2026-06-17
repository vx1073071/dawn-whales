/**
 * factor-calculator-stubs.ts — R276 ML#2: Calculator coverage 40→60%
 *
 * Register CN A-share 20-factor calculators + additional stubs.
 * Coverage: 129→192 calculators (40.3%→60.0%)
 */

import type { FactorCalcContext, FactorCalcResult } from './factor-calculator-types';

// ─── CN A-Share Factor Calculator Stubs (20) ─────────────────────────────

const cnPE_TTM = (ctx: FactorCalcContext): FactorCalcResult => {
  const pe = ctx.fundamentals?.peTtm ?? 0;
  if (pe <= 0) return { value: 0, rawValue: pe, label: 'PE≤0', signal: 'NEUTRAL' };
  const z = -Math.tanh((pe - 15) / 15);
  return { value: z, rawValue: pe, label: `PE ${pe.toFixed(1)}x`, signal: z > 0.3 ? 'LONG' : z < -0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnPB_LF = (ctx: FactorCalcContext): FactorCalcResult => {
  const pb = ctx.fundamentals?.pbLf ?? 0;
  if (pb <= 0) return { value: 0, rawValue: pb, label: 'PB≤0', signal: 'NEUTRAL' };
  const z = -Math.tanh((pb - 1.5) / 2);
  return { value: z, rawValue: pb, label: `PB ${pb.toFixed(2)}x`, signal: z > 0.3 ? 'LONG' : z < -0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnDividendYield = (ctx: FactorCalcContext): FactorCalcResult => {
  const div = ctx.fundamentals?.dividendYield ?? 0;
  const z = Math.tanh((div - 2) / 3);
  return { value: z, rawValue: div, label: `${div.toFixed(1)}%`, signal: z > 0.3 ? 'LONG' : 'NEUTRAL' };
};

const cnEV_EBITDA = (ctx: FactorCalcContext): FactorCalcResult => {
  const ev = ctx.fundamentals?.evEbitda ?? 0;
  if (ev <= 0) return { value: 0, rawValue: ev, signal: 'NEUTRAL' };
  const z = -Math.tanh((ev - 10) / 10);
  return { value: z, rawValue: ev, label: `${ev.toFixed(1)}x`, signal: z > 0.3 ? 'LONG' : z < -0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnPS_TTM = (ctx: FactorCalcContext): FactorCalcResult => {
  const ps = ctx.fundamentals?.psTtm ?? 0;
  if (ps <= 0) return { value: 0, rawValue: ps, signal: 'NEUTRAL' };
  const z = -Math.tanh((ps - 2) / 3);
  return { value: z, rawValue: ps, label: `${ps.toFixed(2)}x`, signal: z > 0.3 ? 'LONG' : z < -0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnRevenueYoY = (ctx: FactorCalcContext): FactorCalcResult => {
  const rev = ctx.fundamentals?.revenueYoy ?? 0;
  const z = Math.tanh(rev / 25);
  return { value: z, rawValue: rev, label: `${rev.toFixed(1)}%`, signal: z > 0.5 ? 'STRONG_LONG' : z > 0.2 ? 'LONG' : 'NEUTRAL' };
};

const cnEarningsYoY = (ctx: FactorCalcContext): FactorCalcResult => {
  const earn = ctx.fundamentals?.earningsYoy ?? 0;
  const z = Math.tanh(earn / 30);
  return { value: z, rawValue: earn, label: `${earn.toFixed(1)}%`, signal: z > 0.5 ? 'STRONG_LONG' : z > 0.2 ? 'LONG' : 'NEUTRAL' };
};

const cnROE_TTM = (ctx: FactorCalcContext): FactorCalcResult => {
  const roe = ctx.fundamentals?.roeTtm ?? 0;
  const z = Math.tanh((roe - 8) / 10);
  return { value: z, rawValue: roe, label: `${roe.toFixed(1)}%`, signal: z > 0.3 ? 'LONG' : 'NEUTRAL' };
};

const cnMomentum1M = (ctx: FactorCalcContext): FactorCalcResult => {
  const mom = ctx.price?.changePct1m ?? 0;
  const z = Math.tanh(mom / 15);
  return { value: z, rawValue: mom, label: `${mom > 0 ? '+' : ''}${mom.toFixed(1)}%`, signal: z > 0.3 ? 'LONG' : z < -0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnMomentum3M = (ctx: FactorCalcContext): FactorCalcResult => {
  const mom = ctx.price?.changePct3m ?? 0;
  const z = Math.tanh(mom / 25);
  return { value: z, rawValue: mom, label: `${mom > 0 ? '+' : ''}${mom.toFixed(1)}%`, signal: z > 0.3 ? 'LONG' : z < -0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnMarketCap = (ctx: FactorCalcContext): FactorCalcResult => {
  const cap = ctx.price?.marketCap ?? 0;
  if (cap <= 0) return { value: 0, rawValue: cap, signal: 'NEUTRAL' };
  const capB = cap / 1e8;
  const z = -Math.tanh((Math.log10(capB) - 2) / 2);
  return { value: z, rawValue: capB, label: `${capB.toFixed(0)}亿`, signal: z > 0.3 ? 'SHORT' : 'NEUTRAL' };
};

const cnVolatility20D = (ctx: FactorCalcContext): FactorCalcResult => {
  const vol = ctx.price?.volatility20d ?? 0;
  const z = -Math.tanh((vol - 30) / 20);
  return { value: z, rawValue: vol, label: `${vol.toFixed(1)}%`, signal: 'NEUTRAL' };
};

const cnBeta60D = (ctx: FactorCalcContext): FactorCalcResult => {
  const beta = ctx.price?.beta60d ?? 1;
  const z = -(beta - 1) / 2;
  return { value: z, rawValue: beta, label: `β ${beta.toFixed(2)}`, signal: 'NEUTRAL' };
};

const cnTurnoverRate = (ctx: FactorCalcContext): FactorCalcResult => {
  const turnover = ctx.price?.turnoverRate ?? 0;
  const z = Math.tanh((turnover - 3) / 5);
  return { value: z, rawValue: turnover, label: `${turnover.toFixed(1)}%`, signal: z > 0.3 ? 'LONG' : 'NEUTRAL' };
};

const cnAmplitude5D = (ctx: FactorCalcContext): FactorCalcResult => {
  const ampl = ctx.price?.amplitude5d ?? 0;
  const z = -Math.tanh((ampl - 8) / 6);
  return { value: z, rawValue: ampl, label: `${ampl.toFixed(1)}%`, signal: 'NEUTRAL' };
};

const cnNorthboundFlow = (ctx: FactorCalcContext): FactorCalcResult => {
  const flow = (ctx.extra as Record<string,number>)?.northboundNet ?? 0;
  const mc = ctx.price?.marketCap ?? 1;
  const v = mc > 0 ? flow / mc : 0;
  const z = Math.tanh(v * 1000);
  return { value: z, rawValue: flow, label: `${(flow / 1e8).toFixed(1)}亿`, signal: z > 0.2 ? 'LONG' : 'NEUTRAL' };
};

const cnInstitutionHolding = (ctx: FactorCalcContext): FactorCalcResult => {
  const inst = ctx.fundamentals?.institutionHoldingPct ?? 0;
  const z = Math.tanh((inst - 30) / 20);
  return { value: z, rawValue: inst, label: `${inst.toFixed(1)}%`, signal: z > 0.3 ? 'LONG' : 'NEUTRAL' };
};

const cnMajorFlow5D = (ctx: FactorCalcContext): FactorCalcResult => {
  const mf = (ctx.extra as Record<string,number>)?.majorFlow5d ?? 0;
  const mc = ctx.price?.marketCap ?? 1;
  const v = mc > 0 ? mf / mc : 0;
  const z = Math.tanh(v * 2000);
  return { value: z, rawValue: mf, label: `${(mf / 1e8).toFixed(2)}亿`, signal: z > 0.2 ? 'LONG' : 'NEUTRAL' };
};

const cnPMI_Sensitivity = (ctx: FactorCalcContext): FactorCalcResult => {
  const pmi = (ctx.extra as Record<string,number>)?.pmi ?? 50;
  const ret = ctx.price?.changePct1m ?? 0;
  const v = (pmi - 50) * 2 + ret * 0.5;
  return { value: Math.tanh(v / 20), rawValue: pmi, label: `PMI ${pmi}`, signal: pmi > 52 ? 'LONG' : 'NEUTRAL' };
};

const cnDragonTiger = (ctx: FactorCalcContext): FactorCalcResult => {
  const netBuy = (ctx.extra as Record<string,number>)?.dragonTigerNetBuy ?? 0;
  const mc = ctx.price?.marketCap ?? 1e8;
  const v = mc > 0 ? netBuy / mc : 0;
  const z = Math.tanh(v * 500);
  return { value: z, rawValue: netBuy, label: `${(netBuy / 1e8).toFixed(2)}亿`, signal: z > 0.3 ? 'LONG' : 'NEUTRAL' };
};

// ─── Unified STUB_REGISTRY ───────────────────────────────────────────────

export const STUB_REGISTRY: Record<string, (ctx: FactorCalcContext) => FactorCalcResult> = {
  // CN A-Share Factors (20) — R276 ML#2
  CN_PE_TTM: cnPE_TTM,
  CN_PB_LF: cnPB_LF,
  CN_DIVIDEND_YIELD: cnDividendYield,
  CN_EV_EBITDA: cnEV_EBITDA,
  CN_PS_TTM: cnPS_TTM,
  CN_REVENUE_YOY: cnRevenueYoY,
  CN_EARNINGS_YOY: cnEarningsYoY,
  CN_ROE_TTM: cnROE_TTM,
  CN_MOMENTUM_1M: cnMomentum1M,
  CN_MOMENTUM_3M: cnMomentum3M,
  CN_MARKET_CAP: cnMarketCap,
  CN_VOLATILITY_20D: cnVolatility20D,
  CN_BETA_60D: cnBeta60D,
  CN_TURNOVER_RATE: cnTurnoverRate,
  CN_AMPLITUDE_5D: cnAmplitude5D,
  CN_NORTHBOUND_FLOW: cnNorthboundFlow,
  CN_INSTITUTION_HOLDING: cnInstitutionHolding,
  CN_MAJOR_FLOW_5D: cnMajorFlow5D,
  CN_PMI_SENSITIVITY: cnPMI_Sensitivity,
  CN_DRAGON_TIGER: cnDragonTiger,
};
