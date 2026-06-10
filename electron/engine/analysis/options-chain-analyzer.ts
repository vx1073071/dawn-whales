// ── Options Chain Analyzer (JVS-55) ────────────────────────────────────────
// Analyze options chain data: Greeks surface, IV skew, put/call ratio
// IPC: options:chain-analyze, options:iv-surface, options:put-call-ratio

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OptionContract {
  symbol: string;
  strike: number;
  expiry: string;          // ISO date string
  optionType: 'call' | 'put';
  // Market data
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVol: number;
  // Greeks
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  // Underlying
  underlyingPrice: number;
  daysToExpiry: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
}

export interface IVSurfacePoint {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  impliedVol: number;
  optionType: 'call' | 'put';
  moneyness: number;   // strike / spot
}

export interface IVSurface {
  symbol: string;
  underlyingPrice: number;
  points: IVSurfacePoint[];
  // Summary stats
  atmIV: number;           // ATM implied vol (nearest expiry)
  ivSkew: number;          // Put IV - Call IV at same strike
  termStructure: number;   // Near expiry IV - Far expiry IV
  ivRank: number;          // 0-100, current IV vs historical range
  ivPercentile: number;    // 0-100, percentile vs historical
}

export interface PutCallRatio {
  symbol: string;
  // Volume ratios
  putCallVolumeRatio: number;
  putCallOIRatio: number;
  // By expiry
  byExpiry: {
    expiry: string;
    putVolume: number;
    callVolume: number;
    putOI: number;
    callOI: number;
    ratio: number;
  }[];
  // Sentiment
  sentiment: 'bearish' | 'neutral' | 'bullish';
  extremeLevel: 'extreme_fear' | 'fear' | 'normal' | 'greed' | 'extreme_greed';
}

export interface ChainAnalysisResult {
  success: boolean;
  symbol: string;
  totalContracts: number;
  expiries: string[];
  strikes: number[];
  // Max pain
  maxPainStrike: number;
  // Gamma exposure
  maxGammaStrike: number;
  totalGammaExposure: number;
  // Support/resistance from options
  support: number;    // Strike with max put OI
  resistance: number; // Strike with max call OI
  // IV analysis
  ivSurface: IVSurface;
  putCallRatio: PutCallRatio;
  // Recommendations
  recommendations: string[];
  timestamp: number;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calculateIVSkew(
  contracts: OptionContract[],
  strike: number,
  tolerance: number = 0.02
): number {
  const calls = contracts.filter(c => c.optionType === 'call' && Math.abs(c.strike - strike) <= tolerance * strike);
  const puts = contracts.filter(c => c.optionType === 'put' && Math.abs(c.strike - strike) <= tolerance * strike);

  if (calls.length === 0 || puts.length === 0) return 0;

  const avgCallIV = calls.reduce((s, c) => s + c.impliedVol, 0) / calls.length;
  const avgPutIV = puts.reduce((s, c) => s + c.impliedVol, 0) / puts.length;

  return avgPutIV - avgCallIV;
}

function calculateMaxPain(contracts: OptionContract[]): number {
  const strikes = [...new Set(contracts.map(c => c.strike))].sort((a, b) => a - b);
  let minPain = Infinity;
  let maxPainStrike = strikes[0];

  for (const testStrike of strikes) {
    let totalPain = 0;
    for (const c of contracts) {
      if (c.optionType === 'call' && testStrike > c.strike) {
        totalPain += c.openInterest * (testStrike - c.strike);
      } else if (c.optionType === 'put' && testStrike < c.strike) {
        totalPain += c.openInterest * (c.strike - testStrike);
      }
    }
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = testStrike;
    }
  }

  return maxPainStrike;
}

function calculateMaxGammaStrike(contracts: OptionContract[]): { strike: number; totalGamma: number } {
  const strikes = [...new Set(contracts.map(c => c.strike))];
  let maxGamma = 0;
  let maxGammaStrike = strikes[0];

  for (const testStrike of strikes) {
    const totalGamma = contracts
      .filter(c => c.strike === testStrike)
      .reduce((s, c) => s + c.gamma * c.openInterest, 0);

    if (totalGamma > maxGamma) {
      maxGamma = totalGamma;
      maxGammaStrike = testStrike;
    }
  }

  return { strike: maxGammaStrike, totalGamma: maxGamma };
}

function findMaxOIStrike(contracts: OptionContract[], optionType: 'call' | 'put'): number {
  const strikes = [...new Set(contracts.map(c => c.strike))];
  let maxOI = 0;
  let maxStrike = strikes[0];

  for (const strike of strikes) {
    const totalOI = contracts
      .filter(c => c.strike === strike && c.optionType === optionType)
      .reduce((s, c) => s + c.openInterest, 0);

    if (totalOI > maxOI) {
      maxOI = totalOI;
      maxStrike = strike;
    }
  }

  return maxStrike;
}

function determineSentiment(putCallRatio: number): 'bearish' | 'neutral' | 'bullish' {
  if (putCallRatio > 1.2) return 'bearish';
  if (putCallRatio < 0.8) return 'bullish';
  return 'neutral';
}

function determineExtremeLevel(putCallRatio: number): 'extreme_fear' | 'fear' | 'normal' | 'greed' | 'extreme_greed' {
  if (putCallRatio > 1.5) return 'extreme_fear';
  if (putCallRatio > 1.2) return 'fear';
  if (putCallRatio > 0.8) return 'normal';
  if (putCallRatio > 0.5) return 'greed';
  return 'extreme_greed';
}

// ── Main Function ──────────────────────────────────────────────────────────

export function analyzeOptionsChain(
  contracts: OptionContract[],
  symbol: string,
  historicalIVRange?: { min: number; max: number }
): ChainAnalysisResult {
  if (!contracts || contracts.length === 0) {
    return {
      success: false,
      symbol,
      totalContracts: 0,
      expiries: [],
      strikes: [],
      maxPainStrike: 0,
      maxGammaStrike: 0,
      totalGammaExposure: 0,
      support: 0,
      resistance: 0,
      ivSurface: {
        symbol,
        underlyingPrice: 0,
        points: [],
        atmIV: 0,
        ivSkew: 0,
        termStructure: 0,
        ivRank: 50,
        ivPercentile: 50,
      },
      putCallRatio: {
        symbol,
        putCallVolumeRatio: 1,
        putCallOIRatio: 1,
        byExpiry: [],
        sentiment: 'neutral',
        extremeLevel: 'normal',
      },
      recommendations: [],
      timestamp: Date.now(),
      error: 'No contracts provided',
    };
  }

  log.info(`[OptionsChain] Analyzing ${contracts.length} contracts for ${symbol}`);

  const underlyingPrice = contracts[0].underlyingPrice;
  const expiries = [...new Set(contracts.map(c => c.expiry))].sort();
  const strikes = [...new Set(contracts.map(c => c.strike))].sort((a, b) => a - b);

  // Max pain
  const maxPainStrike = calculateMaxPain(contracts);

  // Gamma exposure
  const { strike: maxGammaStrike, totalGamma: totalGammaExposure } = calculateMaxGammaStrike(contracts);

  // Support/resistance from options
  const support = findMaxOIStrike(contracts, 'put');
  const resistance = findMaxOIStrike(contracts, 'call');

  // IV Surface
  const ivPoints: IVSurfacePoint[] = contracts.map(c => ({
    strike: c.strike,
    expiry: c.expiry,
    daysToExpiry: c.daysToExpiry,
    impliedVol: c.impliedVol,
    optionType: c.optionType,
    moneyness: c.strike / underlyingPrice,
  }));

  // ATM IV (nearest expiry, closest to spot)
  const nearestExpiry = expiries[0];
  const atmContracts = contracts
    .filter(c => c.expiry === nearestExpiry)
    .sort((a, b) => Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice));

  const atmIV = atmContracts.length > 0 ? atmContracts[0].impliedVol : 0;

  // IV Skew at ATM
  const ivSkew = calculateIVSkew(contracts, underlyingPrice);

  // Term structure
  const nearExpiryContracts = contracts.filter(c => c.expiry === expiries[0]);
  const farExpiryContracts = contracts.filter(c => c.expiry === expiries[expiries.length - 1]);
  const nearIV = nearExpiryContracts.length > 0
    ? nearExpiryContracts.reduce((s, c) => s + c.impliedVol, 0) / nearExpiryContracts.length
    : 0;
  const farIV = farExpiryContracts.length > 0
    ? farExpiryContracts.reduce((s, c) => s + c.impliedVol, 0) / farExpiryContracts.length
    : 0;
  const termStructure = nearIV - farIV;

  // IV Rank and Percentile
  const ivRank = historicalIVRange
    ? Math.round(((atmIV - historicalIVRange.min) / (historicalIVRange.max - historicalIVRange.min)) * 100)
    : 50;

  const ivSurface: IVSurface = {
    symbol,
    underlyingPrice,
    points: ivPoints,
    atmIV: Math.round(atmIV * 10000) / 10000,
    ivSkew: Math.round(ivSkew * 10000) / 10000,
    termStructure: Math.round(termStructure * 10000) / 10000,
    ivRank: Math.min(100, Math.max(0, ivRank)),
    ivPercentile: Math.min(100, Math.max(0, ivRank)),
  };

  // Put/Call ratio
  const putVolume = contracts.filter(c => c.optionType === 'put').reduce((s, c) => s + c.volume, 0);
  const callVolume = contracts.filter(c => c.optionType === 'call').reduce((s, c) => s + c.volume, 0);
  const putOI = contracts.filter(c => c.optionType === 'put').reduce((s, c) => s + c.openInterest, 0);
  const callOI = contracts.filter(c => c.optionType === 'call').reduce((s, c) => s + c.openInterest, 0);

  const putCallVolumeRatio = callVolume > 0 ? putVolume / callVolume : 1;
  const putCallOIRatio = callOI > 0 ? putOI / callOI : 1;

  // By expiry
  const byExpiry = expiries.map(expiry => {
    const expiryContracts = contracts.filter(c => c.expiry === expiry);
    const expPutVol = expiryContracts.filter(c => c.optionType === 'put').reduce((s, c) => s + c.volume, 0);
    const expCallVol = expiryContracts.filter(c => c.optionType === 'call').reduce((s, c) => s + c.volume, 0);
    const expPutOI = expiryContracts.filter(c => c.optionType === 'put').reduce((s, c) => s + c.openInterest, 0);
    const expCallOI = expiryContracts.filter(c => c.optionType === 'call').reduce((s, c) => s + c.openInterest, 0);

    return {
      expiry,
      putVolume: expPutVol,
      callVolume: expCallVol,
      putOI: expPutOI,
      callOI: expCallOI,
      ratio: expCallVol > 0 ? expPutVol / expCallVol : 1,
    };
  });

  const putCallRatio: PutCallRatio = {
    symbol,
    putCallVolumeRatio: Math.round(putCallVolumeRatio * 100) / 100,
    putCallOIRatio: Math.round(putCallOIRatio * 100) / 100,
    byExpiry,
    sentiment: determineSentiment(putCallVolumeRatio),
    extremeLevel: determineExtremeLevel(putCallVolumeRatio),
  };

  // Recommendations
  const recommendations: string[] = [];

  if (putCallVolumeRatio > 1.5) {
    recommendations.push(`Put/Call ratio ${putCallVolumeRatio.toFixed(2)} 极端看空，可能存在反向机会。`);
  } else if (putCallVolumeRatio < 0.5) {
    recommendations.push(`Put/Call ratio ${putCallVolumeRatio.toFixed(2)} 极端看多，注意回调风险。`);
  }

  if (ivRank > 80) {
    recommendations.push(`IV Rank ${ivRank}% 处于高位，考虑卖出策略 (iron condor, credit spread)。`);
  } else if (ivRank < 20) {
    recommendations.push(`IV Rank ${ivRank}% 处于低位，考虑买入策略 (long straddle, debit spread)。`);
  }

  if (Math.abs(ivSkew) > 0.05) {
    recommendations.push(`IV Skew ${ivSkew.toFixed(4)} ${ivSkew > 0 ? '看跌保护需求强' : '看涨情绪主导'}。`);
  }

  recommendations.push(`Max Pain: $${maxPainStrike}，Max Gamma: $${maxGammaStrike}，期权到期可能向此价位收敛。`);
  recommendations.push(`期权支撑: $${support} (max put OI)，阻力: $${resistance} (max call OI)。`);

  const result: ChainAnalysisResult = {
    success: true,
    symbol,
    totalContracts: contracts.length,
    expiries,
    strikes,
    maxPainStrike,
    maxGammaStrike,
    totalGammaExposure,
    support,
    resistance,
    ivSurface,
    putCallRatio,
    recommendations,
    timestamp: Date.now(),
  };

  log.info(`[OptionsChain] Done: ${contracts.length} contracts, max pain $${maxPainStrike}, P/C ratio ${putCallVolumeRatio.toFixed(2)}`);

  return result;
}

// ── Batch Analysis ─────────────────────────────────────────────────────────

export async function analyzeBatchOptionsChain(
  symbols: { symbol: string; contracts: OptionContract[]; historicalIVRange?: { min: number; max: number } }[]
): Promise<ChainAnalysisResult[]> {
  log.info(`[OptionsChain] Batch analysis for ${symbols.length} symbols`);

  const results: ChainAnalysisResult[] = [];
  for (const s of symbols) {
    results.push(analyzeOptionsChain(s.contracts, s.symbol, s.historicalIVRange));
  }

  return results;
}
