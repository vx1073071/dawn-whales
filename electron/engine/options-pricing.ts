// ── Options Pricing Engine (JVS-44) ─────────────────────────────────────────
// Black-Scholes pricing + Greeks + Implied Volatility
// IPC: em:price-option, em:calc-greeks, em:implied-vol

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type OptionType = 'call' | 'put';

export interface OptionParams {
  underlyingPrice: number;  // S - 标的资产价格
  strikePrice: number;      // K - 行权价
  timeToExpiry: number;     // T - 到期时间（年）
  riskFreeRate: number;     // r - 无风险利率
  volatility: number;       // σ - 波动率
  optionType: OptionType;   // call or put
  dividendYield?: number;   // q - 股息率（默认0）
}

export interface OptionPrice {
  callPrice: number;
  putPrice: number;
  params: OptionParams;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface GreeksResult {
  callGreeks: Greeks;
  putGreeks: Greeks;
  params: OptionParams;
}

export interface ImpliedVolResult {
  impliedVol: number;
  marketPrice: number;
  modelPrice: number;
  error: number;
  iterations: number;
  converged: boolean;
}

// ── Standard Normal CDF (Abramowitz & Stegun approximation) ────────────────

function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ── Black-Scholes Pricing ──────────────────────────────────────────────────

export function blackScholesPrice(params: OptionParams): OptionPrice {
  const { underlyingPrice: S, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: sigma, dividendYield: q = 0 } = params;

  if (T <= 0) {
    // Expired option = intrinsic value
    return {
      callPrice: Math.max(S - K, 0),
      putPrice: Math.max(K - S, 0),
      params,
    };
  }

  if (sigma <= 0) {
    // Zero volatility = deterministic
    const forwardPrice = S * Math.exp((r - q) * T);
    return {
      callPrice: Math.max(forwardPrice - K, 0) * Math.exp(-r * T),
      putPrice: Math.max(K - forwardPrice, 0) * Math.exp(-r * T),
      params,
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const callPrice = S * Math.exp(-q * T) * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  const putPrice = K * Math.exp(-r * T) * normCDF(-d2) - S * Math.exp(-q * T) * normCDF(-d1);

  return {
    callPrice: Math.max(0, callPrice),
    putPrice: Math.max(0, putPrice),
    params,
  };
}

// ── Greeks Calculation ─────────────────────────────────────────────────────

export function calculateGreeks(params: OptionParams): GreeksResult {
  const { underlyingPrice: S, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: sigma, dividendYield: q = 0 } = params;

  if (T <= 0 || sigma <= 0) {
    const intrinsicCall = Math.max(S - K, 0);
    const intrinsicPut = Math.max(K - S, 0);
    return {
      callGreeks: {
        delta: S > K ? 1 : 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
      },
      putGreeks: {
        delta: S < K ? -1 : 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
      },
      params,
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);
  const nd1 = normPDF(d1);

  // Delta
  const callDelta = expQT * normCDF(d1);
  const putDelta = expQT * (normCDF(d1) - 1);

  // Gamma (same for call and put)
  const gamma = expQT * nd1 / (S * sigma * sqrtT);

  // Theta (per day)
  const commonTheta = -(S * expQT * nd1 * sigma) / (2 * sqrtT);
  const callTheta = (commonTheta + q * S * expQT * normCDF(d1) - r * K * expRT * normCDF(d2)) / 365;
  const putTheta = (commonTheta - q * S * expQT * normCDF(-d1) + r * K * expRT * normCDF(-d2)) / 365;

  // Vega (per 1% change in vol)
  const vega = S * expQT * nd1 * sqrtT / 100;

  // Rho (per 1% change in rate)
  const callRho = K * T * expRT * normCDF(d2) / 100;
  const putRho = -K * T * expRT * normCDF(-d2) / 100;

  return {
    callGreeks: {
      delta: round(callDelta, 6),
      gamma: round(gamma, 6),
      theta: round(callTheta, 4),
      vega: round(vega, 4),
      rho: round(callRho, 4),
    },
    putGreeks: {
      delta: round(putDelta, 6),
      gamma: round(gamma, 6),
      theta: round(putTheta, 4),
      vega: round(vega, 4),
      rho: round(putRho, 4),
    },
    params,
  };
}

// ── Implied Volatility (Newton-Raphson) ───────────────────────────────────

export function impliedVolatility(
  marketPrice: number,
  underlyingPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  optionType: OptionType,
  dividendYield: number = 0
): ImpliedVolResult {
  const maxIter = 100;
  const tolerance = 1e-6;
  let sigma = 0.3; // Initial guess 30%

  for (let i = 0; i < maxIter; i++) {
    const params: OptionParams = {
      underlyingPrice,
      strikePrice,
      timeToExpiry,
      riskFreeRate,
      volatility: sigma,
      optionType,
      dividendYield,
    };

    const price = blackScholesPrice(params);
    const modelPrice = optionType === 'call' ? price.callPrice : price.putPrice;

    const error = modelPrice - marketPrice;

    if (Math.abs(error) < tolerance) {
      return {
        impliedVol: round(sigma, 6),
        marketPrice,
        modelPrice: round(modelPrice, 4),
        error: round(error, 8),
        iterations: i + 1,
        converged: true,
      };
    }

    // Vega for Newton step
    const greeks = calculateGreeks(params);
    const vega = (optionType === 'call' ? greeks.callGreeks.vega : greeks.putGreeks.vega) * 100; // Un-scale

    if (Math.abs(vega) < 1e-10) break;

    sigma = sigma - error / vega;

    // Keep sigma positive
    if (sigma <= 0) sigma = 0.001;
    if (sigma > 10) sigma = 10;
  }

  // Final evaluation
  const finalParams: OptionParams = {
    underlyingPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate,
    volatility: sigma,
    optionType,
    dividendYield,
  };
  const finalPrice = blackScholesPrice(finalParams);
  const finalModelPrice = optionType === 'call' ? finalPrice.callPrice : finalPrice.putPrice;

  return {
    impliedVol: round(sigma, 6),
    marketPrice,
    modelPrice: round(finalModelPrice, 4),
    error: round(finalModelPrice - marketPrice, 8),
    iterations: maxIter,
    converged: false,
  };
}

// ── Volatility Surface ─────────────────────────────────────────────────────

export interface VolSurfacePoint {
  strike: number;
  expiry: number;     // days
  impliedVol: number;
  optionType: OptionType;
}

export function buildVolSurface(
  underlyingPrice: number,
  riskFreeRate: number,
  strikes: number[],
  expiries: number[],      // in days
  marketPrices: number[][], // [strike_idx][expiry_idx] for calls
  putMarketPrices?: number[][] // optional puts
): VolSurfacePoint[] {
  const surface: VolSurfacePoint[] = [];

  for (let si = 0; si < strikes.length; si++) {
    for (let ei = 0; ei < expiries.length; ei++) {
      const T = expiries[ei] / 365;

      // Call
      if (marketPrices[si] && marketPrices[si][ei] > 0) {
        const iv = impliedVolatility(
          marketPrices[si][ei],
          underlyingPrice,
          strikes[si],
          T,
          riskFreeRate,
          'call'
        );
        surface.push({
          strike: strikes[si],
          expiry: expiries[ei],
          impliedVol: iv.impliedVol,
          optionType: 'call',
        });
      }

      // Put
      if (putMarketPrices && putMarketPrices[si] && putMarketPrices[si][ei] > 0) {
        const iv = impliedVolatility(
          putMarketPrices[si][ei],
          underlyingPrice,
          strikes[si],
          T,
          riskFreeRate,
          'put'
        );
        surface.push({
          strike: strikes[si],
          expiry: expiries[ei],
          impliedVol: iv.impliedVol,
          optionType: 'put',
        });
      }
    }
  }

  log.info(`[OptionsPricing] Built vol surface: ${surface.length} points`);
  return surface;
}

// ── Utility ────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ── Convenience: Price + Greeks in one call ────────────────────────────────

export function priceAndGreeks(params: OptionParams): {
  price: OptionPrice;
  greeks: GreeksResult;
} {
  return {
    price: blackScholesPrice(params),
    greeks: calculateGreeks(params),
  };
}
