// ══ R245 Claw(PM)代工JVS Step3: Blank Category Calculators ══
// Generated calculators for 5 L1 categories that previously had ZERO coverage:
//   COMMODITY (26) + ANALYST (6) + ESG (6) + REVERSAL (5) + RISK (14) = 57 total
//
// Built on the existing FactorCalculator framework (factor-calculator.ts).
// Uses the same 3 calculator types: ratio / rank / signal.
// All factor IDs reference the now-complete factor-id-registry (320 entries).

import {
  FactorCalculator,
  createFactorCalculator,
} from './factor-calculator';

import type {
  FactorInput,
  FactorCrossSectionResult,
  PriceSnapshot,
} from './factor-calculator';

import type { FactorId } from './factor-id-registry';

// ═══════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════

export function createAllBlankCategoryCalculators(): FactorCalculator[] {
  return [

    // ================================================================
    // 1. COMMODITY (26) — Term Structure / Inventory / COT / Macro / Ratio
    // ================================================================

    // ── L2_TERM_STRUCTURE (4) ──
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_ROLL_YIELD' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_TERM_STRUCTURE',
      label: 'Roll Yield',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.rollYield ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_TERM_STRUCTURE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_TERM_STRUCTURE',
      label: 'Term Structure Slope',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.termStructureSlope ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'ratio', factorId: 'CMD_BASIS' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_TERM_STRUCTURE',
      label: 'Basis (Spot vs Futures)',
      numerator: 'spotPrice', denominator: 'futuresPrice',
      invert: false, denominatorFloor: 1e-10,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_MOMENTUM_12M' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_TERM_STRUCTURE',
      label: '12M Commodity Momentum',
      signalFn: (_input: FactorInput, history: PriceSnapshot[]) => {
        if (history.length < 252) return { signal: 0 };
        const cur = history[history.length-1].close;
        const prev = history[history.length-252].close;
        const pct = prev > 0 ? (cur-prev)/prev : 0;
        if (pct > 0.2) return { signal: 1, strength: 0.8 };
        if (pct > 0) return { signal: 1, strength: 0.4 };
        if (pct < -0.2) return { signal: -1, strength: 0.8 };
        return { signal: -1, strength: 0.4 };
      },
      lookbackDays: 252,
    }),

    // ── L2_MOMENTUM / L2_VOLATILITY (3) ──
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_MOMENTUM_1M' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_MOMENTUM',
      label: '1M Commodity Reversal',
      signalFn: (_input: FactorInput, history: PriceSnapshot[]) => {
        if (history.length < 22) return { signal: 0 };
        const cur = history[history.length-1].close;
        const prev = history[history.length-22].close;
        const pct = prev > 0 ? (cur-prev)/prev : 0;
        if (pct < -0.1) return { signal: 1, strength: 0.7 };
        if (pct > 0.1) return { signal: -1, strength: 0.7 };
        return { signal: 0 };
      },
      lookbackDays: 30,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_VOLATILITY' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_VOLATILITY',
      label: 'Commodity Volatility',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.volatility ?? 0.2,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_SKEWNESS' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_VOLATILITY',
      label: 'Return Skewness',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.skewness ?? 0,
      ascending: false,
    }),

    // ── L2_INVENTORY (3) ──
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_EIA_CRUDE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_INVENTORY',
      label: 'EIA Crude Inventory',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const dev = (input.extra as Record<string,number>)?.eiaDeviation ?? 0;
        if (dev < -2) return { signal: 1, strength: 0.8 };
        if (dev < 0) return { signal: 1, strength: 0.4 };
        if (dev > 2) return { signal: -1, strength: 0.8 };
        if (dev > 0) return { signal: -1, strength: 0.4 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_NATGAS_STORAGE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_INVENTORY',
      label: 'Natural Gas Storage',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const dev = (input.extra as Record<string,number>)?.ngStorageDeviation ?? 0;
        if (dev < -2) return { signal: 1, strength: 0.8 };
        if (dev > 2) return { signal: -1, strength: 0.8 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_LME_INVENTORY' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_INVENTORY',
      label: 'LME Metal Inventory',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const chg = (input.extra as Record<string,number>)?.lmeInventoryChange ?? 0;
        if (chg < -0.05) return { signal: 1, strength: 0.8 };
        if (chg < 0) return { signal: 1, strength: 0.4 };
        if (chg > 0.05) return { signal: -1, strength: 0.8 };
        return { signal: 0 };
      },
    }),

    // ── L2_FLOW / L2_FUNDAMENTAL (2) ──
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_GOLD_ETF' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_FLOW',
      label: 'Gold ETF Holdings',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const chg = (input.extra as Record<string,number>)?.goldETFChange ?? 0;
        if (chg > 0.05) return { signal: 1, strength: 0.8 };
        if (chg > 0) return { signal: 1, strength: 0.4 };
        if (chg < -0.05) return { signal: -1, strength: 0.8 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_BALANCE_SHEET' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_FUNDAMENTAL',
      label: 'Supply-Demand Balance',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.sdBalance ?? 0,
      ascending: false,
    }),

    // ── L2_SEASONAL (2) ──
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_SEASONALITY' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_SEASONAL',
      label: 'Commodity Seasonality',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.seasonalScore ?? 0.5,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_GOLD_SUMMER' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_SEASONAL',
      label: 'Gold Summer Effect',
      signalFn: (_input: FactorInput, _history: PriceSnapshot[]) => {
        const month = new Date().getMonth() + 1; // 1-12
        if (month >= 6 && month <= 8) return { signal: 1, strength: 0.5 };
        return { signal: 0 };
      },
    }),

    // ── L2_COT (5) ──
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_COT_COMMERCIAL' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_COT',
      label: 'COT Commercial Hedgers',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const net = (input.extra as Record<string,number>)?.cotCommercialNet ?? 0;
        if (net > 0.3) return { signal: -1, strength: 0.7 };
        if (net < -0.1) return { signal: 1, strength: 0.7 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_COT_SPECULATOR' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_COT',
      label: 'COT Speculator (Smart Money)',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const net = (input.extra as Record<string,number>)?.cotSpecNet ?? 0;
        if (net > 0.3) return { signal: 1, strength: 0.8 };
        if (net > 0.1) return { signal: 1, strength: 0.4 };
        if (net < -0.1) return { signal: -1, strength: 0.7 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_COT_EXTREME' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_COT',
      label: 'COT Extreme Positioning',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const z = (input.extra as Record<string,number>)?.cotExtremeZ ?? 0;
        if (z > 2) return { signal: -1, strength: 0.9 };
        if (z < -2) return { signal: 1, strength: 0.9 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_COT_CHANGE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_COT',
      label: 'COT Position Change',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.cotPosChg ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_OPEN_INTEREST' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_COT',
      label: 'Total Open Interest',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const oiChg = (input.extra as Record<string,number>)?.oiChange ?? 0;
        const priceChg = (input.extra as Record<string,number>)?.priceD1 ?? 0;
        if (oiChg > 0.05 && priceChg > 0) return { signal: 1, strength: 0.8 };
        if (oiChg > 0.05 && priceChg < 0) return { signal: -1, strength: 0.7 };
        if (oiChg < -0.05 && priceChg > 0) return { signal: -1, strength: 0.5 };
        return { signal: 0 };
      },
    }),

    // ── L2_MACRO (4) ──
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_DXY_LINKAGE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_MACRO',
      label: 'USD Linkage',
      valueExtractor: (input: FactorInput) =>
        -(input.extra as Record<string,number>)?.dxyCorr ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_REAL_RATE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_MACRO',
      label: 'Real Rate Impact',
      valueExtractor: (input: FactorInput) =>
        -(input.macroContext?.realRate ?? 0),
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CMD_INFLATION_BE' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_MACRO',
      label: 'Inflation Breakeven',
      valueExtractor: (input: FactorInput) =>
        input.macroContext?.inflationBE ?? 0.025,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_GEOPOL_RISK' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_MACRO',
      label: 'Geopolitical Risk',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const risk = (input.extra as Record<string,number>)?.geopolRisk ?? 0;
        if (risk > 200) return { signal: 1, strength: 0.9 };
        if (risk > 100) return { signal: 1, strength: 0.5 };
        return { signal: 0 };
      },
    }),

    // ── L2_RATIO (3) ──
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_GOLD_SILVER_RATIO' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_RATIO',
      label: 'Gold/Silver Ratio',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const gsr = (input.extra as Record<string,number>)?.goldSilverRatio ?? 80;
        if (gsr > 90) return { signal: 1, strength: 0.8 };
        if (gsr > 80) return { signal: 1, strength: 0.4 };
        if (gsr < 50) return { signal: -1, strength: 0.7 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_GOLD_OIL_RATIO' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_RATIO',
      label: 'Gold/Oil Ratio (Recession Signal)',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const gor = (input.extra as Record<string,number>)?.goldOilRatio ?? 25;
        if (gor > 40) return { signal: -1, strength: 0.9 };
        if (gor > 30) return { signal: -1, strength: 0.5 };
        if (gor < 15) return { signal: 1, strength: 0.5 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CMD_CRACK_SPREAD' as FactorId,
      level1: 'L1_COMMODITY', level2: 'L2_RATIO',
      label: 'Crack Spread (Refining Margin)',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const cs = (input.extra as Record<string,number>)?.crackSpread ?? 15;
        if (cs > 30) return { signal: 1, strength: 0.8 };
        if (cs > 20) return { signal: 1, strength: 0.4 };
        if (cs < 5) return { signal: -1, strength: 0.7 };
        return { signal: 0 };
      },
    }),

    // ================================================================
    // 2. ANALYST (6)
    // ================================================================

    createFactorCalculator({
      type: 'rank', factorId: 'ANALYST_MOMENTUM' as FactorId,
      level1: 'L1_ANALYST', level2: 'L2_RATING',
      label: 'Analyst Rating Momentum',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.analystMomentum ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'EARNINGS_REVISION' as FactorId,
      level1: 'L1_ANALYST', level2: 'L2_FORECAST',
      label: 'Earnings Estimate Revision',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const rev = (input.extra as Record<string,number>)?.earningsRevisionPct ?? 0;
        if (rev > 5) return { signal: 1, strength: 0.8 };
        if (rev > 0) return { signal: 1, strength: 0.4 };
        if (rev < -5) return { signal: -1, strength: 0.8 };
        if (rev < 0) return { signal: -1, strength: 0.4 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'TARGET_PRICE_IMPLIED' as FactorId,
      level1: 'L1_ANALYST', level2: 'L2_FORECAST',
      label: 'Target Price Upside',
      valueExtractor: (input: FactorInput) => {
        const tp = (input.extra as Record<string,number>)?.targetPrice ?? 0;
        return tp > 0 ? (tp - input.priceData.close) / tp : 0;
      },
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'ANALYST_DISPERSION' as FactorId,
      level1: 'L1_ANALYST', level2: 'L2_FORECAST',
      label: 'Analyst Forecast Dispersion',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.forecastDispersion ?? 0.1,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'RECOMMENDATION_CHANGE' as FactorId,
      level1: 'L1_ANALYST', level2: 'L2_RATING',
      label: 'Rating Upgrade/Downgrade',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const chg = (input.extra as Record<string,number>)?.ratingChange ?? 0;
        if (chg > 0) return { signal: 1, strength: 0.8 };
        if (chg < 0) return { signal: -1, strength: 0.8 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'REVISION_RATIO' as FactorId,
      level1: 'L1_ANALYST', level2: 'L2_RATING',
      label: 'Upgrade/Downgrade Ratio',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.revisionRatio ?? 1,
      ascending: false,
    }),

    // ================================================================
    // 3. ESG (6)
    // ================================================================

    createFactorCalculator({
      type: 'rank', factorId: 'ESG_SCORE' as FactorId,
      level1: 'L1_ESG', level2: 'L2_OVERALL',
      label: 'ESG Composite Score',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.esgScore ?? 50,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CARBON_INTENSITY' as FactorId,
      level1: 'L1_ESG', level2: 'L2_ENVIRONMENT',
      label: 'Carbon Intensity',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.carbonIntensity ?? 100,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'GOVERNANCE_SCORE' as FactorId,
      level1: 'L1_ESG', level2: 'L2_GOVERNANCE',
      label: 'Governance Score',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.governanceScore ?? 50,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'GREEN_REVENUE' as FactorId,
      level1: 'L1_ESG', level2: 'L2_ENVIRONMENT',
      label: 'Green Revenue Share',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.greenRevenuePct ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'SOCIAL_SCORE' as FactorId,
      level1: 'L1_ESG', level2: 'L2_SOCIAL',
      label: 'Social Responsibility Score',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.socialScore ?? 50,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'ESG_MOMENTUM' as FactorId,
      level1: 'L1_ESG', level2: 'L2_OVERALL',
      label: 'ESG Improvement Momentum',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const chg = (input.extra as Record<string,number>)?.esgMomentum ?? 0;
        if (chg > 5) return { signal: 1, strength: 0.6 };
        if (chg > 0) return { signal: 1, strength: 0.3 };
        if (chg < -5) return { signal: -1, strength: 0.6 };
        return { signal: 0 };
      },
    }),

    // ================================================================
    // 4. REVERSAL (5)
    // ================================================================

    createFactorCalculator({
      type: 'signal', factorId: 'STR_5D' as FactorId,
      level1: 'L1_REVERSAL', level2: 'L2_SHORT_TERM',
      label: '5-Day Short-Term Reversal',
      signalFn: (_input: FactorInput, history: PriceSnapshot[]) => {
        if (history.length < 5) return { signal: 0 };
        const cur = history[history.length-1].close;
        const p5 = history[history.length-6].close;
        const ret = p5 > 0 ? (cur-p5)/p5 : 0;
        if (ret < -0.05) return { signal: 1, strength: 0.7 };
        if (ret > 0.05) return { signal: -1, strength: 0.7 };
        return { signal: 0 };
      },
      lookbackDays: 10,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'LTR_60M' as FactorId,
      level1: 'L1_REVERSAL', level2: 'L2_LONG_TERM',
      label: '60-Month Long-Term Reversal',
      signalFn: (_input: FactorInput, history: PriceSnapshot[]) => {
        if (history.length < 1260) return { signal: 0 };
        const cur = history[history.length-1].close;
        const p60m = history[history.length-1260].close;
        const ret = p60m > 0 ? (cur-p60m)/p60m : 0;
        if (ret < -0.5) return { signal: 1, strength: 0.8 };
        if (ret > 0.5) return { signal: -1, strength: 0.8 };
        return { signal: 0 };
      },
      lookbackDays: 1260,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'SEASONAL_1M' as FactorId,
      level1: 'L1_REVERSAL', level2: 'L2_SEASONAL',
      label: 'Monthly Seasonality',
      signalFn: (_input: FactorInput, _history: PriceSnapshot[]) => {
        const today = new Date().getDate();
        if (today <= 5) return { signal: 1, strength: 0.4 };
        if (today >= 25) return { signal: -1, strength: 0.3 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'GAP_REVERSION' as FactorId,
      level1: 'L1_REVERSAL', level2: 'L2_SHORT_TERM',
      label: 'Gap Reversion',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        if (!input.priceData.prevClose || input.priceData.prevClose <= 0)
          return { signal: 0 };
        const gap = (input.priceData.open - input.priceData.prevClose) / input.priceData.prevClose;
        if (gap < -0.03) return { signal: 1, strength: 0.6 };
        if (gap > 0.03) return { signal: -1, strength: 0.6 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'MEAN_REVERSION_SPEED' as FactorId,
      level1: 'L1_REVERSAL', level2: 'L2_STATISTICAL',
      label: 'Mean Reversion Speed',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.mrSpeed ?? 0.5,
      ascending: false,
    }),

    // ================================================================
    // 5. RISK (14)
    // ================================================================

    createFactorCalculator({
      type: 'rank', factorId: 'VOL_60D' as FactorId,
      level1: 'L1_RISK', level2: 'L2_VOLATILITY',
      label: '60-Day Volatility',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.vol60d ??
        (input.priceData.high > 0 ?
          Math.abs(input.priceData.close - input.priceData.low) / input.priceData.high :
          0.2),
      ascending: true,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'LIQ' as FactorId,
      level1: 'L1_RISK', level2: 'L2_LIQUIDITY',
      label: 'Liquidity (Volume/MCap)',
      valueExtractor: (input: FactorInput) => {
        const mcap = input.fundamental?.marketCap ?? 1e9;
        const vol = input.priceData.volume ?? 0;
        return mcap > 0 ? vol / mcap : 0;
      },
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'VAR_95' as FactorId,
      level1: 'L1_RISK', level2: 'L2_DOWNSIDE',
      label: '95% Value at Risk',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.var95 ?? 0.12,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'CVAR_95' as FactorId,
      level1: 'L1_RISK', level2: 'L2_DOWNSIDE',
      label: '95% Conditional VaR',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.cvar95 ?? 0.18,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'DOWNSIDE_DEVIATION' as FactorId,
      level1: 'L1_RISK', level2: 'L2_DOWNSIDE',
      label: 'Downside Deviation',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.downsideDeviation ?? 0.15,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'SORTINO_RATIO' as FactorId,
      level1: 'L1_RISK', level2: 'L2_RISK_ADJUSTED',
      label: 'Sortino Ratio',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.sortinoRatio ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'OMEGA_RATIO' as FactorId,
      level1: 'L1_RISK', level2: 'L2_RISK_ADJUSTED',
      label: 'Omega Ratio',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.omegaRatio ?? 1,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'TAIL_DEPENDENCE' as FactorId,
      level1: 'L1_RISK', level2: 'L2_DOWNSIDE',
      label: 'Tail Dependence',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.tailDependence ?? 0.3,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'CROWDING' as FactorId,
      level1: 'L1_RISK', level2: 'L2_STRUCTURAL',
      label: 'Crowding Score',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const cs = (input.extra as Record<string,number>)?.crowdingScore ?? 0.3;
        if (cs > 0.7) return { signal: -1, strength: 0.9 };
        if (cs > 0.5) return { signal: -1, strength: 0.5 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'MOM_CRASH' as FactorId,
      level1: 'L1_RISK', level2: 'L2_DOWNSIDE',
      label: 'Momentum Crash Warning',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const mc = (input.extra as Record<string,number>)?.momCrashProb ?? 0;
        if (mc > 0.3) return { signal: -1, strength: 0.9 };
        if (mc > 0.15) return { signal: -1, strength: 0.5 };
        return { signal: 0 };
      },
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'BETA_STABILITY' as FactorId,
      level1: 'L1_RISK', level2: 'L2_VOLATILITY',
      label: 'Beta Stability',
      valueExtractor: (input: FactorInput) =>
        1 - ((input.extra as Record<string,number>)?.betaStd ?? 0.2),
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'SKEWNESS' as FactorId,
      level1: 'L1_RISK', level2: 'L2_VOLATILITY',
      label: 'Return Skewness',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.skewness ?? 0,
      ascending: false,
    }),
    createFactorCalculator({
      type: 'rank', factorId: 'KURTOSIS' as FactorId,
      level1: 'L1_RISK', level2: 'L2_VOLATILITY',
      label: 'Return Kurtosis (Fat Tail)',
      valueExtractor: (input: FactorInput) =>
        (input.extra as Record<string,number>)?.kurtosis ?? 3,
      ascending: true,
    }),
    createFactorCalculator({
      type: 'signal', factorId: 'ALPHA_DECAY' as FactorId,
      level1: 'L1_RISK', level2: 'L2_STRUCTURAL',
      label: 'Alpha Decay Monitor',
      signalFn: (input: FactorInput, _history: PriceSnapshot[]) => {
        const ad = (input.extra as Record<string,number>)?.alphaDecayRate ?? 0;
        if (ad < -0.02) return { signal: -1, strength: 0.8 };
        if (ad < 0) return { signal: -1, strength: 0.4 };
        return { signal: 0 };
      },
    }),

  ];
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function computeAllBlankCategoryFactors(
  inputs: FactorInput[]
): FactorCrossSectionResult[] {
  const calculators = createAllBlankCategoryCalculators();
  return calculators.map(calc => calc.computeCrossSection(inputs));
}

export function getBlankCategoryFactorCount(): number {
  return createAllBlankCategoryCalculators().length;
}
