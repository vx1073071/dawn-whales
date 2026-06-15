// R185 J2: 35 Green Factor Calculators
// Production-ready calculators built on R184 templates.
import {
  FactorCalculator,
  RatioCalculator,
  RankCalculator,
  SignalCalculator,
  createFactorCalculator,
} from './factor-calculator';

import type {
  FactorInput,
  FactorCrossSectionResult,
  PriceSnapshot,
} from './factor-calculator';

import type { FactorCalculatorConfig, RankCalculatorConfig, SignalCalculatorConfig, RatioCalculatorConfig } from './factor-calculator';

export function createAllGreenFactorCalculators(): FactorCalculator[] {
  return [

    // ===== A1 Value (3) =====
    createFactorCalculator({ type: 'ratio', factorId: 'EP_RATIO', level1: 'L1_CLASSIC', level2: 'L2_VALUE', label: 'Earnings Yield (E/P)', numerator: 'eps', denominator: 'close', invert: true, denominatorFloor: 1e-10 }),
    createFactorCalculator({ type: 'ratio', factorId: 'HML', level1: 'L1_CLASSIC', level2: 'L2_VALUE', label: 'Book to Price (B/P)', numerator: 'bookValuePerShare', denominator: 'close', invert: true, denominatorFloor: 1e-10 }),
    createFactorCalculator({ type: 'ratio', factorId: 'YIELD', level1: 'L1_CLASSIC', level2: 'L2_YIELD', label: 'Dividend Yield', numerator: 'dps', denominator: 'close', invert: false, denominatorFloor: 1e-10 }),

    // ===== A2 Quality (3) =====
    createFactorCalculator({ type: 'rank', factorId: 'ROA', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFIT_QUALITY', label: 'Return on Assets', valueExtractor: (input: FactorInput) => { const ni = input.fundamental?.netIncome; const ta = input.fundamental?.totalAssets; return (ta && ta > 0) ? (ni ?? 0) / ta : 0; }, ascending: false }),
    createFactorCalculator({ type: 'rank', factorId: 'GROSS_MARGIN', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFIT_QUALITY', label: 'Gross Margin', valueExtractor: (input: FactorInput) => input.fundamental?.grossMargin ?? 0, ascending: false }),
    createFactorCalculator({ type: 'ratio', factorId: 'DEBT_TO_EQUITY', level1: 'L1_FUNDAMENTAL', level2: 'L2_RISK_STRUCTURE', label: 'Debt to Equity', numerator: 'totalLiabilities', denominator: 'bookValuePerShare', invert: false, denominatorFloor: 1e-10 }),

    // ===== A3 Low Vol (2) =====
    createFactorCalculator({ type: 'rank', factorId: 'MKT', level1: 'L1_CLASSIC', level2: 'L2_MARKET_RISK', label: 'Market Beta', valueExtractor: (input: FactorInput) => (input.extra?.beta as number) ?? 1.0, ascending: true }),
    createFactorCalculator({ type: 'rank', factorId: 'MAX_DRAWDOWN', level1: 'L1_RISK', level2: 'L2_DOWNSIDE', label: 'Max Drawdown (1Y)', valueExtractor: (input: FactorInput) => { const dd = input.extra?.maxDrawdown1Y as number; return dd ?? (input.priceData.high > 0 ? Math.abs(input.priceData.close - input.priceData.high) / input.priceData.high : 0); }, ascending: true }),

    // ===== A4 Sentiment (4) =====
    createFactorCalculator({ type: 'signal', factorId: 'KDJ', level1: 'L1_TECHNICAL', level2: 'L2_OSCILLATOR', label: 'KDJ Stochastic', signalFn: (input: FactorInput, history: PriceSnapshot[]) => { if (history.length < 9) return { signal: 0 }; const closes = history.map(h => h.close); const highs = history.map(h => h.high); const lows = history.map(h => h.low); const high9 = Math.max(...highs.slice(-9)); const low9 = Math.min(...lows.slice(-9)); const range = high9 - low9; if (range <= 0) return { signal: 0 }; const rsv = ((closes[closes.length - 1] - low9) / range) * 100; if (rsv > 80) return { signal: -1, strength: 0.8 }; if (rsv < 20) return { signal: 1, strength: 0.8 }; return { signal: 0 }; }, lookbackDays: 30 }),
    createFactorCalculator({ type: 'signal', factorId: 'INSIDER_BUYING', level1: 'L1_SENTIMENT', level2: 'L2_FLOW', label: 'Insider Buying', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const r = input.extra?.insiderBuyRatio as number; if (r === undefined) return { signal: 0 }; if (r > 0.7) return { signal: 1, strength: 0.9 }; if (r > 0.5) return { signal: 1, strength: 0.5 }; if (r < 0.3) return { signal: -1, strength: 0.7 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'FUND_FLOW', level1: 'L1_SENTIMENT', level2: 'L2_FLOW', label: 'Fund Flow', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const nf = input.extra?.netFundFlow as number; if (nf === undefined) return { signal: 0 }; const mcap = input.fundamental?.marketCap ?? 1e9; const ratio = Math.abs(nf) / mcap; if (nf > 0 && ratio > 0.01) return { signal: 1, strength: 0.7 }; if (nf > 0) return { signal: 1, strength: 0.4 }; if (ratio > 0.01) return { signal: -1, strength: 0.7 }; return { signal: -1, strength: 0.4 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'ETF_FLOW', level1: 'L1_SENTIMENT', level2: 'L2_FLOW', label: 'ETF Flow', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const f = input.extra?.etfNetFlow as number; if (f === undefined) return { signal: 0 }; if (f > 1e8) return { signal: 1, strength: 0.8 }; if (f > 0) return { signal: 1, strength: 0.4 }; if (f < -1e8) return { signal: -1, strength: 0.8 }; if (f < 0) return { signal: -1, strength: 0.4 }; return { signal: 0 }; } }),

    // ===== A5 Event (2) =====
    createFactorCalculator({ type: 'signal', factorId: 'EARNINGS_SURPRISE', level1: 'L1_FUNDAMENTAL', level2: 'L2_EVENT', label: 'Earnings Surprise', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const sp = input.extra?.earningsSurprisePct as number; if (sp === undefined) return { signal: 0 }; if (sp > 10) return { signal: 1, strength: 0.9 }; if (sp > 5) return { signal: 1, strength: 0.6 }; if (sp < -10) return { signal: -1, strength: 0.9 }; if (sp < -5) return { signal: -1, strength: 0.6 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'DIVIDEND_CHANGE', level1: 'L1_FUNDAMENTAL', level2: 'L2_YIELD_QUALITY', label: 'Dividend Change', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const dc = input.extra?.dividendChangePct as number; if (dc === undefined) return { signal: 0 }; if (dc > 10) return { signal: 1, strength: 0.8 }; if (dc > 0) return { signal: 1, strength: 0.5 }; if (dc < -10) return { signal: -1, strength: 0.8 }; if (dc < 0) return { signal: -1, strength: 0.5 }; return { signal: 0 }; } }),

    // ===== A6 Sector (1) =====
    createFactorCalculator({ type: 'rank', factorId: 'SECTOR_STRENGTH', level1: 'L1_MACRO', level2: 'L2_CYCLE', label: 'Sector Strength', valueExtractor: (input: FactorInput) => (input.extra?.sectorStrength as number) ?? 0, ascending: false }),

    // ===== A7 Options (1) =====
    createFactorCalculator({ type: 'rank', factorId: 'IV_RANK', level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', label: 'IV Rank', valueExtractor: (input: FactorInput) => (input.extra?.ivRank as number) ?? 0.5, ascending: true }),

    // ===== A8 Macro (1) =====
    createFactorCalculator({ type: 'signal', factorId: 'CURRENCY_EFFECT', level1: 'L1_MACRO', level2: 'L2_CURRENCY', label: 'Currency Effect', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const fx = input.extra?.currencyEffect as number; if (fx === undefined) return { signal: 0 }; if (fx > 0.02) return { signal: 1, strength: 0.7 }; if (fx < -0.02) return { signal: -1, strength: 0.7 }; return { signal: 0 }; } }),

    // ===== A9 Fundamental (2) =====
    createFactorCalculator({ type: 'ratio', factorId: 'FREE_CASH_FLOW_YIELD', level1: 'L1_FUNDAMENTAL', level2: 'L2_VALUE_DEEP', label: 'Free Cash Flow Yield', numerator: 'freeCashFlow', denominator: 'close', invert: true, denominatorFloor: 1e-10 }),
    createFactorCalculator({ type: 'rank', factorId: 'EQUITY_MULTIPLIER', level1: 'L1_FUNDAMENTAL', level2: 'L2_RISK_STRUCTURE', label: 'Equity Multiplier', valueExtractor: (input: FactorInput) => { const ta = input.fundamental?.totalAssets; const bv = input.fundamental?.bookValuePerShare; return (ta && bv && bv > 0) ? ta / bv : 0; }, ascending: false }),

    // ===== A10 Behavioral (2) =====
    createFactorCalculator({ type: 'signal', factorId: 'DISPOSITION_EFFECT', level1: 'L1_SENTIMENT', level2: 'L2_SOCIAL', label: 'Disposition Effect', signalFn: (input: FactorInput, history: PriceSnapshot[]) => { if (history.length < 20) return { signal: 0 }; const cur = input.priceData.close; const p20 = history[history.length - 20]?.close ?? cur; const pct = (cur - p20) / p20; const volRecent = history.slice(-5).reduce((s, h) => s + (h.volume || 0), 0) / 5; const volPrev = history.slice(-20, -5).reduce((s, h) => s + (h.volume || 0), 0) / 15; const vr = volPrev > 0 ? volRecent / volPrev : 1; if (pct < -0.1 && vr > 1.5) return { signal: 1, strength: 0.7 }; if (pct > 0.1 && vr > 1.5) return { signal: -1, strength: 0.5 }; return { signal: 0 }; }, lookbackDays: 30 }),
    createFactorCalculator({ type: 'signal', factorId: 'ANCHORING', level1: 'L1_SENTIMENT', level2: 'L2_SOCIAL', label: 'Anchoring Effect', signalFn: (input: FactorInput, history: PriceSnapshot[]) => { if (history.length < 60) return { signal: 0 }; const h52 = Math.max(...history.slice(-252).map(h => h.high)); const l52 = Math.min(...history.slice(-252).map(h => h.low)); const cur = input.priceData.close; if ((cur - l52) / l52 < 0.05) return { signal: 1, strength: 0.6 }; if ((h52 - cur) / h52 < 0.05) return { signal: -1, strength: 0.6 }; return { signal: 0 }; }, lookbackDays: 252 }),

    // ===== HK (5) =====
    createFactorCalculator({ type: 'rank', factorId: 'HK_AH_PREMIUM', level1: 'L1_HK', level2: 'L2_PRICING', label: 'AH Premium', valueExtractor: (input: FactorInput) => (input.extra?.ahPremium as number) ?? 0, ascending: true }),
    createFactorCalculator({ type: 'signal', factorId: 'AH_PREMIUM_CHANGE', level1: 'L1_HK', level2: 'L2_PRICING', label: 'AH Premium Change', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const pc = input.extra?.ahPremiumChange as number; if (pc === undefined) return { signal: 0 }; if (pc < -0.05) return { signal: 1, strength: 0.7 }; if (pc > 0.05) return { signal: -1, strength: 0.7 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'HK_SOUTHBOUND_FLOW', level1: 'L1_HK', level2: 'L2_FLOW', label: 'Southbound Flow', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const sf = input.extra?.southboundNetFlow as number; if (sf === undefined) return { signal: 0 }; if (sf > 5e9) return { signal: 1, strength: 0.9 }; if (sf > 0) return { signal: 1, strength: 0.4 }; if (sf < -5e9) return { signal: -1, strength: 0.7 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'HSI_CONSTITUENT', level1: 'L1_HK', level2: 'L2_FLOW', label: 'HSI Constituent', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const w = input.extra?.hsiWeight as number; if (w === undefined) return { signal: 0 }; if (w > 0.05) return { signal: 1, strength: 0.5 }; return { signal: 0, strength: 0.3 }; } }),
    createFactorCalculator({ type: 'ratio', factorId: 'HK_REIT_YIELD', level1: 'L1_HK', level2: 'L2_YIELD', label: 'HK REIT Yield', numerator: 'dps', denominator: 'close', invert: false, denominatorFloor: 1e-10 }),

    // ===== US (5) =====
    createFactorCalculator({ type: 'signal', factorId: 'US_EARNINGS_CALENDAR', level1: 'L1_US', level2: 'L2_EVENT', label: 'US Earnings Calendar', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const d = input.extra?.daysToEarnings as number; if (d === undefined) return { signal: 0 }; if (d <= 3) return { signal: 0, strength: 0.9 }; if (d <= 7) return { signal: 0, strength: 0.5 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'rank', factorId: 'US_SECTOR_ROTATION', level1: 'L1_US', level2: 'L2_CORPORATE', label: 'US Sector Rotation', valueExtractor: (input: FactorInput) => (input.extra?.usSectorMomentum as number) ?? 0, ascending: false }),
    createFactorCalculator({ type: 'rank', factorId: 'US_SMALL_CAP_MOMENTUM', level1: 'L1_US', level2: 'L2_STATS', label: 'US Small Cap Momentum', valueExtractor: (input: FactorInput) => (input.extra?.usSmallCapMomentum as number) ?? 0, ascending: false }),
    createFactorCalculator({ type: 'signal', factorId: 'US_DIVIDEND_ARISTOCRATS', level1: 'L1_US', level2: 'L2_YIELD', label: 'US Dividend Aristocrats', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const y = input.extra?.dividendGrowthYears as number; if (y === undefined) return { signal: 0 }; if (y >= 25) return { signal: 1, strength: 0.9 }; if (y >= 10) return { signal: 1, strength: 0.5 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'rank', factorId: 'US_SP500_EQUAL_WEIGHT', level1: 'L1_US', level2: 'L2_VALUE', label: 'SP500 Equal Weight', valueExtractor: (input: FactorInput) => (input.extra?.sp500EqualWeightDiff as number) ?? 0, ascending: true }),

    // ===== Crypto (6) =====
    createFactorCalculator({ type: 'rank', factorId: 'CRYPTO_MVRV', level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'MVRV Ratio', valueExtractor: (input: FactorInput) => input.onChain?.mvrv ?? (input.extra?.mvrv as number) ?? 0, ascending: true }),
    createFactorCalculator({ type: 'rank', factorId: 'CRYPTO_NVT', level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'NVT Ratio', valueExtractor: (input: FactorInput) => input.onChain?.nvt ?? (input.extra?.nvt as number) ?? 0, ascending: true }),
    createFactorCalculator({ type: 'signal', factorId: 'CRYPTO_S2F', level1: 'L1_CRYPTO', level2: 'L2_VALUATION', label: 'Stock-to-Flow', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const sfp = input.extra?.s2fFairPrice as number; if (sfp === undefined) return { signal: 0 }; const dev = (input.priceData.close - sfp) / sfp; if (dev < -0.5) return { signal: 1, strength: 0.8 }; if (dev < -0.2) return { signal: 1, strength: 0.5 }; if (dev > 0.5) return { signal: -1, strength: 0.8 }; if (dev > 0.2) return { signal: -1, strength: 0.5 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'CRYPTO_EXCHANGE_FLOW', level1: 'L1_CRYPTO', level2: 'L2_FLOW', label: 'Exchange Net Flow', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const nf = input.onChain?.exchangeNetFlow ?? (input.extra?.exchangeNetFlow as number); if (nf === undefined) return { signal: 0 }; if (nf < -1e8) return { signal: 1, strength: 0.8 }; if (nf < 0) return { signal: 1, strength: 0.4 }; if (nf > 1e8) return { signal: -1, strength: 0.8 }; if (nf > 0) return { signal: -1, strength: 0.4 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'CRYPTO_ACTIVE_ADDR', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'Active Addresses', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const t = input.extra?.activeAddressTrend as number ?? 0; if (t > 0.1) return { signal: 1, strength: 0.7 }; if (t > 0) return { signal: 1, strength: 0.3 }; if (t < -0.1) return { signal: -1, strength: 0.7 }; return { signal: 0 }; } }),
    createFactorCalculator({ type: 'signal', factorId: 'CRYPTO_HASH_RATE', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', label: 'Hash Rate', signalFn: (input: FactorInput, _history: PriceSnapshot[]) => { const t = input.extra?.hashRateTrend as number; if (t === undefined) return { signal: 0 }; if (t > 0.1) return { signal: 1, strength: 0.8 }; if (t > 0) return { signal: 1, strength: 0.4 }; if (t < -0.2) return { signal: -1, strength: 0.7 }; return { signal: 0 }; } }),

    // ===== Cross-Market (3) =====
    createFactorCalculator({ type: 'rank', factorId: 'XM_MKTCAP_EXPOSURE', level1: 'L1_CROSS_ASSET', level2: 'L2_CORRELATION', label: 'Cross-Market Cap Exposure', valueExtractor: (input: FactorInput) => (input.extra?.crossMarketCapExposure as number) ?? input.fundamental?.marketCap ?? 0, ascending: true }),
    createFactorCalculator({ type: 'rank', factorId: 'XM_LIQUIDITY', level1: 'L1_CROSS_ASSET', level2: 'L2_CORRELATION', label: 'Cross-Market Liquidity', valueExtractor: (input: FactorInput) => (input.extra?.crossMarketLiquidity as number) ?? input.priceData.volume, ascending: true }),
    createFactorCalculator({ type: 'rank', factorId: 'XM_DIVIDEND_ARAMA', level1: 'L1_CROSS_ASSET', level2: 'L2_CARRY', label: 'Cross-Market Dividend', valueExtractor: (input: FactorInput) => input.fundamental?.dps ?? 0, ascending: false }),
  ];
}

export function computeAllGreenFactors(inputs: FactorInput[]): FactorCrossSectionResult[] {
  const calculators = createAllGreenFactorCalculators();
  return calculators.map(calc => calc.computeCrossSection(inputs));
}

export function getGreenFactorCount(): number {
  return createAllGreenFactorCalculators().length;
}