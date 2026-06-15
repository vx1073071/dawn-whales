// R193 J1: 29 Remaining RED Factor Calculators (Crypto14 + CrossMarket5 + Supplement10)
// All use the correct FactorCalculator base class and FactorInput.
import { FactorCalculator, type FactorInput } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

// === CRYPTO 14 (On-chain depth) ===
export class CRYPTO_NFT_VOLUME_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_NFT_VOLUME' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'NFT Volume' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const vol = (input.extra as Record<string,number>)?.nftVolume ?? 0;
    const prev = (input.extra as Record<string,number>)?.nftVolumePrev ?? vol;
    const spike = prev > 0 ? (vol - prev) / prev : 0;
    return { value: Math.tanh(spike * 2), rawValue: vol };
  }
}

export class CRYPTO_BRIDGE_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_BRIDGE_FLOW' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'Bridge Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const inflow = (input.extra as Record<string,number>)?.bridgeInflow ?? 0;
    const outflow = (input.extra as Record<string,number>)?.bridgeOutflow ?? 0;
    const net = inflow - outflow;
    const tvl = input.onChain?.tvl ?? 1;
    const v = tvl > 0 ? net / tvl : 0;
    return { value: Math.tanh(v * 100), rawValue: net };
  }
}

export class CRYPTO_STABLECOIN_MINT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_STABLECOIN_MINT' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_FLOW', label: 'Stablecoin Mint' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mint = (input.extra as Record<string,number>)?.stablecoinMintVolume ?? 0;
    const burn = (input.extra as Record<string,number>)?.stablecoinBurnVolume ?? 0;
    const mc = (input.extra as Record<string,number>)?.stablecoinMarketCap ?? 1;
    const v = mc > 0 ? (mint - burn) / mc : 0;
    return { value: Math.tanh(v * 100), rawValue: mint };
  }
}

export class CRYPTO_MINER_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_MINER_FLOW' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_FLOW', label: 'Miner Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mf = (input.extra as Record<string,number>)?.minerOutflow ?? 0;
    const rev = (input.extra as Record<string,number>)?.minerRevenue ?? mf;
    const sellRatio = rev > 0 ? mf / rev : 0;
    return { value: sellRatio > 0.8 ? -1 : sellRatio > 0.6 ? -0.5 : 0, rawValue: mf };
  }
}

export class CRYPTO_ONCHAIN_GDP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_ONCHAIN_GDP' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'On-Chain GDP' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const volume = (input.extra as Record<string,number>)?.txVolume ?? 0;
    const fees = input.onChain?.feeRevenue ?? 0;
    const active = input.onChain?.activeAddresses ?? 1;
    const gdp = (volume + fees) / Math.max(1, active);
    const prevGdp = (input.extra as Record<string,number>)?.onChainGdpPrev ?? gdp;
    const growth = prevGdp > 0 ? (gdp - prevGdp) / prevGdp : 0;
    return { value: Math.tanh(growth * 5), rawValue: gdp };
  }
}

export class CRYPTO_MINER_SELL_PRESS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_MINER_SELL_PRESS' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_FLOW', label: 'Miner Sell Pressure' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const outflow = (input.extra as Record<string,number>)?.minerOutflow ?? 0;
    const balance = (input.extra as Record<string,number>)?.minerBalance ?? 1;
    const ratio = balance > 0 ? outflow / balance : 0;
    const hash = input.onChain?.hashRate ?? 1;
    const prevHash = (input.extra as Record<string,number>)?.hashRatePrev ?? hash;
    const hashDrop = prevHash > 0 ? (hash - prevHash) / prevHash : 0;
    const v = -(ratio * 10) - (hashDrop < -0.05 ? 0.3 : 0);
    return { value: v, rawValue: ratio };
  }
}

export class CRYPTO_CROSSCHAIN_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_CROSSCHAIN_FLOW' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'Cross-Chain Flow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const inflow = (input.extra as Record<string,number>)?.crossChainInflow ?? 0;
    const outflow = (input.extra as Record<string,number>)?.crossChainOutflow ?? 0;
    const tvl = input.onChain?.tvl ?? 1;
    const net = tvl > 0 ? (inflow - outflow) / tvl : 0;
    return { value: Math.tanh(net * 100), rawValue: net };
  }
}

export class CRYPTO_RESERVE_PROOF_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_RESERVE_PROOF' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_RISK', label: 'Reserve Proof' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const claimed = (input.extra as Record<string,number>)?.claimedReserves ?? 1;
    const verified = (input.extra as Record<string,number>)?.verifiedReserves ?? claimed;
    const ratio = claimed > 0 ? verified / claimed : 1;
    return { value: ratio > 0.98 ? 0.5 : ratio > 0.95 ? 0 : ratio > 0.9 ? -0.5 : -1, rawValue: ratio };
  }
}

export class CRYPTO_WHALE_TX_COUNT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_WHALE_TX_COUNT' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_SENTIMENT', label: 'Whale TX Count' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const wtc = input.onChain?.whaleTransactionCount ?? 0;
    const prev = (input.extra as Record<string,number>)?.whaleTxPrev ?? wtc;
    const change = prev > 0 ? (wtc - prev) / prev : 0;
    const netFlow = input.onChain?.exchangeNetFlow ?? 0;
    const v = Math.tanh(change * 2) + (netFlow < -1000000 ? 0.3 : netFlow > 1000000 ? -0.3 : 0);
    return { value: v, rawValue: wtc };
  }
}

export class CRYPTO_25DELTA_RR_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_25DELTA_RR' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_OPTIONS', label: '25-Delta Risk Reversal' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const rr = (input.extra as Record<string,number>)?.riskReversal25d ?? 0;
    return { value: Math.tanh(rr * 10), rawValue: rr };
  }
}

export class CRYPTO_OPTION_TERM_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_OPTION_TERM' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_OPTIONS', label: 'Option Term Structure' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const iv1w = (input.extra as Record<string,number>)?.ivWeek ?? 0;
    const iv3m = (input.extra as Record<string,number>)?.iv3Month ?? iv1w;
    const slope = iv1w > 0 ? (iv3m - iv1w) / iv1w : 0;
    return { value: Math.tanh(slope * 3), rawValue: slope };
  }
}

export class CRYPTO_DEV_CENTRAL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_DEV_CENTRAL' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'Developer Centralization' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const top = (input.extra as Record<string,number>)?.topDevShare ?? 0;
    const activity = input.onChain?.developerActivity ?? 1;
    const v = activity > 0 ? -(top / Math.max(0.1, Math.log10(activity+1))) : 0;
    return { value: v, rawValue: top };
  }
}

export class CRYPTO_TOKEN_UNLOCK_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_TOKEN_UNLOCK' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_EVENT', label: 'Token Unlock' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const unlocked = (input.extra as Record<string,number>)?.tokensUnlocked ?? 0;
    const supply = input.onChain?.supplyOnExchanges ?? 0;
    const ratio = supply > 0 ? unlocked / supply : 0;
    const days = (input.extra as Record<string,number>)?.daysSinceUnlock ?? 30;
    const decay = Math.exp(-days / 7);
    return { value: -Math.min(1, ratio * 10) * decay, rawValue: unlocked };
  }
}

export class CRYPTO_PROTOCOL_REV_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_PROTOCOL_REV' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'Protocol Revenue' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const rev = input.onChain?.feeRevenue ?? 0;
    const prev = (input.extra as Record<string,number>)?.feeRevenuePrev ?? rev;
    const tvl = input.onChain?.tvl ?? 1;
    const revYield = tvl > 0 ? rev / tvl : 0;
    const growth = prev > 0 ? (rev - prev) / prev : 0;
    return { value: Math.tanh(revYield * 1000 + growth * 3), rawValue: rev };
  }
}

export class CRYPTO_PF_RATIO_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_PF_RATIO' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'Price/Fees Ratio' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const fees = input.onChain?.feeRevenue ?? 1;
    const pf = fees > 0 ? input.priceData.close / (fees * 365) : 0;
    const v = pf > 100 ? -1 : pf > 50 ? -0.5 : pf > 20 ? 0 : pf > 10 ? 0.5 : 1;
    return { value: v, rawValue: pf };
  }
}

export class CRYPTO_GOVERNANCE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'CRYPTO_GOVERNANCE' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'Governance Activity' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const proposals = (input.extra as Record<string,number>)?.govProposals ?? 0;
    const turnout = (input.extra as Record<string,number>)?.govTurnout ?? 0;
    const v = Math.tanh(proposals * 0.5) + (turnout > 0.5 ? 0.3 : turnout > 0.2 ? 0.1 : -0.1);
    return { value: v, rawValue: proposals };
  }
}

// === CROSS-MARKET 5 ===
export class XM_CO_SKEWNESS_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'XM_CO_SKEWNESS' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_MOMENTUM', label: 'Co-Skewness' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ret = input.priceData.prevClose ? (input.priceData.close - input.priceData.prevClose) / input.priceData.prevClose : 0;
    const mktRet = (input.extra as Record<string,number>)?.marketReturn ?? ret;
    const mktRet2 = Math.pow(mktRet, 2);
    const coSkew = (input.extra as Record<string,number>)?.coskew30d ?? 0;
    return { value: Math.tanh(coSkew * 5), rawValue: coSkew };
  }
}

export class XM_IDIO_VOL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'XM_IDIO_VOL' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_VOLATILITY', label: 'Idiosyncratic Volatility' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const beta = (input.extra as Record<string,number>)?.beta ?? 1;
    const mktVol = (input.extra as Record<string,number>)?.marketVolatility ?? 0.2;
    const totalVol = (input.extra as Record<string,number>)?.totalVolatility ?? mktVol;
    const idio = Math.sqrt(Math.max(0, totalVol * totalVol - (beta * mktVol) * (beta * mktVol)));
    return { value: -Math.tanh(idio * 5), rawValue: idio };
  }
}

export class XM_MOMENTUM_CRASH_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'XM_MOMENTUM_CRASH' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_RISK', label: 'Momentum Crash' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mom = (input.extra as Record<string,number>)?.momentum12m ?? 0;
    const vix = (input.extra as Record<string,number>)?.vixLevel ?? 20;
    const crashRisk = mom > 0.3 && vix > 25 ? -1 : mom > 0.2 && vix > 30 ? -1.5 : 0;
    return { value: crashRisk, rawValue: mom };
  }
}

export class XM_CURRENCY_HEDGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'XM_CURRENCY_HEDGE' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_SENSITIVITY', label: 'Currency Hedge' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const fxRet = (input.extra as Record<string,number>)?.currencyReturn ?? 0;
    const localRet = input.priceData.prevClose ? (input.priceData.close - input.priceData.prevClose) / input.priceData.prevClose : 0;
    const hedgedRet = localRet - fxRet;
    const hedgeBenefit = Math.abs(hedgedRet) > Math.abs(localRet) ? 1 : 0;
    return { value: Math.tanh(hedgedRet * 5) + hedgeBenefit * 0.3, rawValue: fxRet };
  }
}

export class XM_FACTOR_TIMING_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'XM_FACTOR_TIMING' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_SENSITIVITY', label: 'Factor Timing' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const regime = (input.extra as Record<string,number>)?.volRegime ?? 0;
    const icWindow = (input.extra as Record<string,number>)?.rollingIC30d ?? 0;
    const icTrend = (input.extra as Record<string,number>)?.icTrend ?? 0;
    const timing = icWindow > 0.03 ? 1 : icWindow < -0.03 ? -1 : icTrend > 0.001 ? 0.5 : 0;
    return { value: timing, rawValue: icWindow };
  }
}

// === SUPPLEMENT 10 ===
export class A5_VOLATILITY_REGIME_ADV_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A5_VOLATILITY_REGIME_ADV' as FactorId, level1: 'L1_CRYPTO', level2: 'L2_VOLATILITY', label: 'Volatility Regime Advanced' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const vi = (input.extra as Record<string,number>)?.volIndex ?? 20;
    const ma20 = (input.extra as Record<string,number>)?.volMA20 ?? vi;
    const ma60 = (input.extra as Record<string,number>)?.volMA60 ?? ma20;
    const shortTerm = ma20 > 0 ? vi / ma20 - 1 : 0;
    const longTerm = ma60 > 0 ? vi / ma60 - 1 : 0;
    const regime = Math.tanh(shortTerm * 2) * 0.7 + Math.tanh(longTerm) * 0.3;
    return { value: -regime, rawValue: vi };
  }
}

export class A7_EARNINGS_MOVE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A7_EARNINGS_MOVE' as FactorId, level1: 'L1_US', level2: 'L2_EARNINGS', label: 'Earnings Implied Move' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const atmIv = (input.extra as Record<string,number>)?.atmIv ?? 0;
    const daysToEarn = (input.extra as Record<string,number>)?.daysToEarnings ?? 5;
    const impliedMove = atmIv * Math.sqrt(daysToEarn / 365);
    const histMove = (input.extra as Record<string,number>)?.historicalEarningsMove ?? impliedMove;
    const v = histMove > 0 ? (impliedMove - histMove) / histMove : 0;
    return { value: Math.tanh(v * 3), rawValue: impliedMove };
  }
}

export class A8_CONVERTIBLE_ARB_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A8_CONVERTIBLE_ARB' as FactorId, level1: 'L1_US', level2: 'L2_DERIVATIVES', label: 'Convertible Arb' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const cbPrice = (input.extra as Record<string,number>)?.convertibleBondPrice ?? 100;
    const conversionValue = (input.extra as Record<string,number>)?.conversionValue ?? cbPrice;
    const premium = cbPrice > 0 ? (conversionValue - cbPrice) / cbPrice : 0;
    return { value: Math.tanh(premium * 5), rawValue: premium };
  }
}

export class A9_STAT_ARB_RESIDUAL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A9_STAT_ARB_RESIDUAL' as FactorId, level1: 'L1_US', level2: 'L2_MOMENTUM', label: 'Statistical Arb Residual' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const residual = (input.extra as Record<string,number>)?.statArbResidual ?? 0;
    const meanReversion = (input.extra as Record<string,number>)?.halfLife ?? 10;
    const z = Math.abs(residual);
    const v = z > 2.5 ? Math.sign(residual) : z > 1.5 ? Math.sign(residual) * 0.5 : 0;
    return { value: v, rawValue: residual };
  }
}

export class A10_ROE_TREND_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A10_ROE_TREND' as FactorId, level1: 'L1_US', level2: 'L2_QUALITY', label: 'ROE Trend' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const roe = (input.extra as Record<string,number>)?.roeCurrent ?? 0;
    const roe1y = (input.extra as Record<string,number>)?.roe1YearAgo ?? roe;
    const roe3y = (input.extra as Record<string,number>)?.roe3YearAgo ?? roe1y;
    const trend = (roe - roe1y) * 0.6 + (roe1y - roe3y) * 0.4;
    const level = roe > 0.2 ? 0.5 : roe > 0.15 ? 0.3 : roe > 0.1 ? 0 : -0.2;
    return { value: Math.tanh(trend * 10) + level, rawValue: roe };
  }
}

export class A11_SHORT_TERM_REVERSAL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A11_SHORT_TERM_REVERSAL' as FactorId, level1: 'L1_US', level2: 'L2_MOMENTUM', label: 'Short-Term Reversal' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const ret1w = (input.extra as Record<string,number>)?.return1w ?? 0;
    const ret1m = (input.extra as Record<string,number>)?.return1m ?? 0;
    const v = -(ret1w * 0.7 + ret1m * 0.3);
    return { value: Math.tanh(v * 5), rawValue: ret1w };
  }
}

export class A11_GAP_FILL_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A11_GAP_FILL' as FactorId, level1: 'L1_US', level2: 'L2_MOMENTUM', label: 'Gap Fill' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const gap = input.priceData.prevClose && input.priceData.open ? (input.priceData.open - input.priceData.prevClose) / input.priceData.prevClose : 0;
    const filled = (input.extra as Record<string,number>)?.gapFilled ?? 1;
    const gapDir = Math.abs(gap) > 0.02 ? Math.sign(gap) : 0;
    const v = gapDir !== 0 ? (filled > 0.5 ? -gapDir * 0.5 : gapDir * 0.5) : 0;
    return { value: v, rawValue: gap };
  }
}

export class A11_RETAIL_SENTIMENT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A11_RETAIL_SENTIMENT' as FactorId, level1: 'L1_US', level2: 'L2_SENTIMENT', label: 'Retail Sentiment' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sent = (input.extra as Record<string,number>)?.retailSentiment ?? 0;
    const mentions = (input.extra as Record<string,number>)?.socialMentions ?? 0;
    const prevMentions = (input.extra as Record<string,number>)?.socialMentionsPrev ?? mentions;
    const mentionGrowth = prevMentions > 0 ? (mentions - prevMentions) / prevMentions : 0;
    const v = Math.tanh(sent * 0.5) + Math.tanh(mentionGrowth * 2) * 0.5;
    return { value: Math.tanh(v), rawValue: sent };
  }
}

export class A12_NEWS_NLP_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A12_NEWS_NLP' as FactorId, level1: 'L1_US', level2: 'L2_SENTIMENT', label: 'News NLP Star' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const sentiment = (input.extra as Record<string,number>)?.nlpSentiment ?? 0;
    const confidence = (input.extra as Record<string,number>)?.nlpConfidence ?? 0.5;
    const volume = (input.extra as Record<string,number>)?.newsVolume ?? 0;
    const prevVolume = (input.extra as Record<string,number>)?.newsVolumePrev ?? volume;
    const volRatio = prevVolume > 0 ? Math.min(2, volume / prevVolume) : 1;
    const v = sentiment * confidence * volRatio * 0.5;
    return { value: Math.tanh(v * 3), rawValue: sentiment };
  }
}

export class A12_ESG_SCORE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'A12_ESG_SCORE' as FactorId, level1: 'L1_US', level2: 'L2_QUALITY', label: 'ESG Score' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const e = (input.extra as Record<string,number>)?.esgE ?? 50;
    const s = (input.extra as Record<string,number>)?.esgS ?? 50;
    const g = (input.extra as Record<string,number>)?.esgG ?? 50;
    const controversy = (input.extra as Record<string,number>)?.esgControversy ?? 0;
    const total = (e + s + g) / 3;
    const v = (total - 50) / 50 - controversy * 0.5;
    return { value: Math.tanh(v), rawValue: total };
  }
}

// === Registry ===
export const FINAL_RED_FACTOR_CALCULATORS: Record<string, { new(): FactorCalculator }> = {
  CRYPTO_NFT_VOLUME: CRYPTO_NFT_VOLUME_Calculator,
  CRYPTO_BRIDGE_FLOW: CRYPTO_BRIDGE_FLOW_Calculator,
  CRYPTO_STABLECOIN_MINT: CRYPTO_STABLECOIN_MINT_Calculator,
  CRYPTO_MINER_FLOW: CRYPTO_MINER_FLOW_Calculator,
  CRYPTO_ONCHAIN_GDP: CRYPTO_ONCHAIN_GDP_Calculator,
  CRYPTO_MINER_SELL_PRESS: CRYPTO_MINER_SELL_PRESS_Calculator,
  CRYPTO_CROSSCHAIN_FLOW: CRYPTO_CROSSCHAIN_FLOW_Calculator,
  CRYPTO_RESERVE_PROOF: CRYPTO_RESERVE_PROOF_Calculator,
  CRYPTO_WHALE_TX_COUNT: CRYPTO_WHALE_TX_COUNT_Calculator,
  CRYPTO_25DELTA_RR: CRYPTO_25DELTA_RR_Calculator,
  CRYPTO_OPTION_TERM: CRYPTO_OPTION_TERM_Calculator,
  CRYPTO_DEV_CENTRAL: CRYPTO_DEV_CENTRAL_Calculator,
  CRYPTO_TOKEN_UNLOCK: CRYPTO_TOKEN_UNLOCK_Calculator,
  CRYPTO_PROTOCOL_REV: CRYPTO_PROTOCOL_REV_Calculator,
  CRYPTO_PF_RATIO: CRYPTO_PF_RATIO_Calculator,
  CRYPTO_GOVERNANCE: CRYPTO_GOVERNANCE_Calculator,
  XM_CO_SKEWNESS: XM_CO_SKEWNESS_Calculator,
  XM_IDIO_VOL: XM_IDIO_VOL_Calculator,
  XM_MOMENTUM_CRASH: XM_MOMENTUM_CRASH_Calculator,
  XM_CURRENCY_HEDGE: XM_CURRENCY_HEDGE_Calculator,
  XM_FACTOR_TIMING: XM_FACTOR_TIMING_Calculator,
  A5_VOLATILITY_REGIME_ADV: A5_VOLATILITY_REGIME_ADV_Calculator,
  A7_EARNINGS_MOVE: A7_EARNINGS_MOVE_Calculator,
  A8_CONVERTIBLE_ARB: A8_CONVERTIBLE_ARB_Calculator,
  A9_STAT_ARB_RESIDUAL: A9_STAT_ARB_RESIDUAL_Calculator,
  A10_ROE_TREND: A10_ROE_TREND_Calculator,
  A11_SHORT_TERM_REVERSAL: A11_SHORT_TERM_REVERSAL_Calculator,
  A11_GAP_FILL: A11_GAP_FILL_Calculator,
  A11_RETAIL_SENTIMENT: A11_RETAIL_SENTIMENT_Calculator,
  A12_NEWS_NLP: A12_NEWS_NLP_Calculator,
  A12_ESG_SCORE: A12_ESG_SCORE_Calculator,
};

export const FINAL_RED_FACTOR_IDS: readonly string[] = Object.keys(FINAL_RED_FACTOR_CALCULATORS);

export function getFinalRedCalculator(factorId: string): FactorCalculator | null {
  const Ctor = FINAL_RED_FACTOR_CALCULATORS[factorId];
  return Ctor ? new Ctor() : null;
}

/** Count: 31 factors */
export const FINAL_RED_COUNT = 31;