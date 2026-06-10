/**
 * Options Pricing Engine
 * JVS-98: Black-Scholes and Binomial Tree Models
 *
 * Provides closed-form Black-Scholes pricing, CRR binomial tree with early
 * exercise for American options, Newton-Raphson implied-volatility solver,
 * analytical & numerical Greeks, payoff diagrams, volatility-surface builder,
 * and put-call parity verification.
 */

import log from 'electron-log';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface OptionParams {
  /** Current underlying price */
  underlying: number;
  /** Strike price */
  strike: number;
  /** Time to expiry in years (e.g. 0.25 = 3 months) */
  timeToExpiry: number;
  /** Annualised risk-free interest rate (e.g. 0.05 = 5 %) */
  riskFreeRate: number;
  /** Annualised volatility (e.g. 0.20 = 20 %) */
  volatility: number;
  /** Continuous dividend yield (optional, default 0) */
  dividendYield?: number;
  /** Option type */
  type: 'call' | 'put';
  /** Exercise style */
  style: 'european' | 'american';
}

export interface Greeks {
  /** Sensitivity to underlying price */
  delta: number;
  /** Second derivative w.r.t. underlying price */
  gamma: number;
  /** Sensitivity to time decay (per calendar day) */
  theta: number;
  /** Sensitivity to volatility (per 1 % move) */
  vega: number;
  /** Sensitivity to interest rate (per 1 % move) */
  rho: number;
}

export interface PricingResult {
  /** Theoretical option price */
  price: number;
  /** Option Greeks */
  greeks: Greeks;
  /** Implied volatility (only when solved via IV) */
  impliedVol?: number;
  /** Model name used */
  model: string;
  /** Computation time in milliseconds */
  durationMs: number;
}

export interface BinomialConfig {
  /** Number of time steps in the CRR tree (default 200) */
  steps: number;
}

export interface VolatilitySurface {
  prices: {
    strike: number;
    expiry: number;
    impliedVol: number;
  }[];
}

// ---------------------------------------------------------------------------
// Payoff-diagram point
// ---------------------------------------------------------------------------

export interface PayoffPoint {
  price: number;
  payoff: number;
  profit: number;
}

// ---------------------------------------------------------------------------
// Volatility-surface input
// ---------------------------------------------------------------------------

export interface VolSurfaceInput {
  strike: number;
  expiry: number;
  marketPrice: number;
  underlying: number;
  rate: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default number of CRR tree steps */
const DEFAULT_TREE_STEPS = 200;

/** Newton-Raphson tolerance */
const IV_TOLERANCE = 1e-8;

/** Newton-Raphson max iterations */
const IV_MAX_ITERATIONS = 100;

/** Bump size for numerical Greeks */
const NUMERICAL_BUMP = 0.01;

/** Minimum volatility floor for calculations */
const MIN_VOLATILITY = 1e-6;

/** Maximum volatility cap */
const MAX_VOLATILITY = 10.0;

// ---------------------------------------------------------------------------
// Mathematical helpers
// ---------------------------------------------------------------------------

/**
 * Approximation of the standard-normal cumulative distribution function (CDF)
 * using the Abramowitz & Stegun formula 26.2.17.
 *
 * Maximum absolute error �?1.5 × 10⁻⁷.
 */
import { normalCDF } from '../utils/math';
import { EngineError, ErrorCode } from '../../errors';


/**
 * Standard-normal probability density function (PDF).
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

/**
 * High-precision timer (returns milliseconds as a float).
 */
function nowMs(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

// ---------------------------------------------------------------------------
// OptionsPricingEngine
// ---------------------------------------------------------------------------

export class OptionsPricingEngine {

  // -----------------------------------------------------------------------
  // Black-Scholes closed-form
  // -----------------------------------------------------------------------

  /**
   * Price a European option using the Black-Scholes-Merton formula.
   *
   * For American-style inputs the method still returns the European value
   * and logs a warning �?use `binomialTree` for proper American pricing.
   */
  public blackScholes(params: OptionParams): PricingResult {
    const start = nowMs();

    if (params.style === 'american') {
      log.warn(
        '[OptionsPricingEngine] blackScholes called with american style �?' +
        'returning European price; use binomialTree for early exercise.',
      );
    }

    this.validateParams(params);

    const S = params.underlying;
    const K = params.strike;
    const T = params.timeToExpiry;
    const r = params.riskFreeRate;
    const sigma = Math.max(params.volatility, MIN_VOLATILITY);
    const q = params.dividendYield ?? 0;

    // Edge case: zero or negative time to expiry
    if (T <= 0) {
      const intrinsic = this.intrinsicValue(S, K, params.type);
      const durationMs = nowMs() - start;
      return {
        price: intrinsic,
        greeks: this.expiredGreeks(params.type, S, K),
        model: 'Black-Scholes',
        durationMs,
      };
    }

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const Nd1 = normalCDF(d1);
    const Nd2 = normalCDF(d2);

    let price: number;
    if (params.type === 'call') {
      price = S * Math.exp(-q * T) * Nd1 - K * Math.exp(-r * T) * Nd2;
    } else {
      price = K * Math.exp(-r * T) * (1 - Nd2) - S * Math.exp(-q * T) * (1 - Nd1);
    }

    // Ensure non-negative
    price = Math.max(price, 0);

    const greeks = this.analyticalGreeks(params);

    const durationMs = nowMs() - start;
    log.debug(
      `[OptionsPricingEngine] BS ${params.type} S=${S} K=${K} T=${T} σ=${sigma} �?price=${price.toFixed(4)} (${durationMs.toFixed(2)} ms)`,
    );

    return {
      price,
      greeks,
      model: 'Black-Scholes',
      durationMs,
    };
  }

  // -----------------------------------------------------------------------
  // Binomial tree (CRR)
  // -----------------------------------------------------------------------

  /**
   * Cox-Ross-Rubinstein binomial tree.
   *
   * Handles both European and American exercise styles.  For American options
   * the algorithm checks early exercise at every node.
   */
  public binomialTree(params: OptionParams, config?: BinomialConfig): PricingResult {
    const start = nowMs();
    this.validateParams(params);

    const N = config?.steps ?? DEFAULT_TREE_STEPS;
    if (N < 1 || !Number.isInteger(N)) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `BinomialConfig.steps must be a positive integer, got ${N}`);
    }

    const S = params.underlying;
    const K = params.strike;
    const T = params.timeToExpiry;
    const r = params.riskFreeRate;
    const sigma = Math.max(params.volatility, MIN_VOLATILITY);
    const q = params.dividendYield ?? 0;

    // Edge case: zero or negative time
    if (T <= 0) {
      const intrinsic = this.intrinsicValue(S, K, params.type);
      const durationMs = nowMs() - start;
      return {
        price: intrinsic,
        greeks: this.expiredGreeks(params.type, S, K),
        model: `CRR-Binomial(${N})`,
        durationMs,
      };
    }

    const dt = T / N;
    const sqrtDt = Math.sqrt(dt);
    const u = Math.exp(sigma * sqrtDt);          // up factor
    const d = 1.0 / u;                            // down factor
    const growthFactor = Math.exp((r - q) * dt);  // risk-neutral growth
    const pUp = (growthFactor - d) / (u - d);     // risk-neutral up probability
    const pDown = 1.0 - pUp;
    const discount = Math.exp(-r * dt);

    // Pre-allocate the option value array (re-use a single row).
    // At maturity (step N) the array holds payoffs for nodes 0..N.
    let values = new Float64Array(N + 1);

    // Terminal payoffs
    for (let i = 0; i <= N; i++) {
      const priceAtNode = S * Math.pow(u, N - i) * Math.pow(d, i);
      values[i] = this.intrinsicValue(priceAtNode, K, params.type);
    }

    // Backward induction
    const isAmerican = params.style === 'american';
    for (let step = N - 1; step >= 0; step--) {
      for (let i = 0; i <= step; i++) {
        const continuation = discount * (pUp * values[i] + pDown * values[i + 1]);

        if (isAmerican) {
          const priceAtNode = S * Math.pow(u, step - i) * Math.pow(d, i);
          const exercise = this.intrinsicValue(priceAtNode, K, params.type);
          values[i] = Math.max(continuation, exercise);
        } else {
          values[i] = continuation;
        }
      }
    }

    const price = Math.max(values[0], 0);

    // Greeks via finite differences on the tree
    const greeks = this.treeGreeks(params, N);

    const durationMs = nowMs() - start;
    log.debug(
      `[OptionsPricingEngine] CRR(${N}) ${params.style}/${params.type} S=${S} K=${K} T=${T} σ=${sigma} �?price=${price.toFixed(4)} (${durationMs.toFixed(2)} ms)`,
    );

    return {
      price,
      greeks,
      model: `CRR-Binomial(${N})`,
      durationMs,
    };
  }

  // -----------------------------------------------------------------------
  // Implied volatility (Newton-Raphson)
  // -----------------------------------------------------------------------

  /**
   * Solve for the implied volatility that reproduces `marketPrice` using
   * Newton-Raphson iteration on the Black-Scholes formula.
   *
   * Falls back to bisection if Newton-Raphson fails to converge.
   */
  public impliedVolatility(
    marketPrice: number,
    params: Omit<OptionParams, 'volatility'>,
  ): number {
    if (marketPrice <= 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Market price must be positive, got ${marketPrice}`);
    }

    const S = params.underlying;
    const K = params.strike;
    const T = params.timeToExpiry;
    const r = params.riskFreeRate;
    const q = params.dividendYield ?? 0;

    if (T <= 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Cannot compute implied volatility for expired options (T �?0)');
    }

    // Check that market price is within no-arbitrage bounds
    const intrinsicCall = Math.max(S * Math.exp(-q * T) - K * Math.exp(-r * T), 0);
    const intrinsicPut = Math.max(K * Math.exp(-r * T) - S * Math.exp(-q * T), 0);
    const intrinsic = params.type === 'call' ? intrinsicCall : intrinsicPut;

    if (marketPrice < intrinsic - 1e-6) {
      log.warn(
        `[OptionsPricingEngine] Market price ${marketPrice} is below intrinsic ${intrinsic.toFixed(6)} �?IV may be unreliable`,
      );
    }

    // Initial guess using Brenner-Subrahmanyam approximation for ATM-ish options
    let sigma = Math.sqrt(2.0 * Math.PI / T) * marketPrice / S;
    if (sigma < MIN_VOLATILITY || !isFinite(sigma)) {
      sigma = 0.3; // reasonable default
    }

    // Newton-Raphson
    for (let iter = 0; iter < IV_MAX_ITERATIONS; iter++) {
      const paramsWithVol: OptionParams = { ...params, volatility: sigma } as OptionParams;
      const bsResult = this.blackScholes(paramsWithVol);
      const diff = bsResult.price - marketPrice;

      if (Math.abs(diff) < IV_TOLERANCE) {
        log.debug(
          `[OptionsPricingEngine] IV converged in ${iter + 1} iterations �?σ=${sigma.toFixed(6)}`,
        );
        return sigma;
      }

      // Vega is dPrice/dSigma
      const vega = bsResult.greeks.vega;
      if (Math.abs(vega) < 1e-12) {
        log.warn('[OptionsPricingEngine] Vega near zero �?switching to bisection');
        return this.impliedVolatilityBisection(marketPrice, params as Omit<OptionParams, 'volatility'>);
      }

      const step = diff / vega;
      sigma = sigma - step;

      // Clamp to valid range
      sigma = Math.max(MIN_VOLATILITY, Math.min(MAX_VOLATILITY, sigma));
    }

    // Newton-Raphson did not converge �?fall back to bisection
    log.warn(
      '[OptionsPricingEngine] Newton-Raphson did not converge �?falling back to bisection',
    );
    return this.impliedVolatilityBisection(marketPrice, params as Omit<OptionParams, 'volatility'>);
  }

  // -----------------------------------------------------------------------
  // Greeks
  // -----------------------------------------------------------------------

  /**
   * Compute option Greeks.
   *
   * For European options, uses closed-form analytical formulas.
   * For American options, falls back to numerical finite-difference methods.
   */
  public greeks(params: OptionParams): Greeks {
    if (params.style === 'american') {
      return this.numericalGreeks(params);
    }
    return this.analyticalGreeks(params);
  }

  // -----------------------------------------------------------------------
  // Payoff diagram
  // -----------------------------------------------------------------------

  /**
   * Build a payoff / profit diagram for a given set of underlying prices.
   *
   * `payoff`  = intrinsic value at expiry
   * `profit`  = payoff �?premium paid (uses BS price as premium)
   */
  public payoffDiagram(
    params: OptionParams,
    priceRange: number[],
  ): PayoffPoint[] {
    const premium = this.blackScholes(params).price;

    return priceRange.map((price) => {
      const payoff = this.intrinsicValue(price, params.strike, params.type);
      const profit = payoff - premium;
      return { price, payoff, profit };
    });
  }

  // -----------------------------------------------------------------------
  // Volatility surface
  // -----------------------------------------------------------------------

  /**
   * Build a volatility surface by solving implied-vol for each input point.
   */
  public buildVolatilitySurface(options: VolSurfaceInput[]): VolatilitySurface {
    const prices: VolatilitySurface['prices'] = [];

    for (const opt of options) {
      try {
        const iv = this.impliedVolatility(opt.marketPrice, {
          underlying: opt.underlying,
          strike: opt.strike,
          timeToExpiry: opt.expiry,
          riskFreeRate: opt.rate,
          type: 'call', // convention: use call prices for surface
          style: 'european',
        });

        prices.push({
          strike: opt.strike,
          expiry: opt.expiry,
          impliedVol: iv,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(
          `[OptionsPricingEngine] Failed to compute IV for K=${opt.strike} T=${opt.expiry}: ${msg}`,
        );
      }
    }

    log.debug(
      `[OptionsPricingEngine] Volatility surface built: ${prices.length}/${options.length} points`,
    );

    return { prices };
  }

  // -----------------------------------------------------------------------
  // Put-Call parity
  // -----------------------------------------------------------------------

  /**
   * Verify put-call parity for European options.
   *
   * C �?P = S·e^(−qT) �?K·e^(−rT)
   *
   * Given a call price, returns the theoretical put price implied by parity.
   */
  public putCallParity(callPrice: number, params: OptionParams): number {
    if (params.style === 'american') {
      log.warn(
        '[OptionsPricingEngine] putCallParity is exact only for European options',
      );
    }

    const S = params.underlying;
    const K = params.strike;
    const T = params.timeToExpiry;
    const r = params.riskFreeRate;
    const q = params.dividendYield ?? 0;

    const pvForward = S * Math.exp(-q * T) - K * Math.exp(-r * T);
    const putPrice = callPrice - pvForward;

    log.debug(
      `[OptionsPricingEngine] Put-Call parity: C=${callPrice.toFixed(4)} �?P=${putPrice.toFixed(4)} (PV_fwd=${pvForward.toFixed(4)})`,
    );

    return putPrice;
  }

  // =======================================================================
  // PRIVATE HELPERS
  // =======================================================================

  // -----------------------------------------------------------------------
  // Parameter validation
  // -----------------------------------------------------------------------

  private validateParams(params: OptionParams): void {
    if (params.underlying <= 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Underlying price must be positive, got ${params.underlying}`);
    }
    if (params.strike <= 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Strike price must be positive, got ${params.strike}`);
    }
    if (params.timeToExpiry < 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Time to expiry must be non-negative, got ${params.timeToExpiry}`);
    }
    if (params.volatility < 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Volatility must be non-negative, got ${params.volatility}`);
    }
    if (params.dividendYield !== undefined && params.dividendYield < 0) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Dividend yield must be non-negative, got ${params.dividendYield}`);
    }
  }

  // -----------------------------------------------------------------------
  // Intrinsic value
  // -----------------------------------------------------------------------

  private intrinsicValue(
    underlyingPrice: number,
    strike: number,
    type: 'call' | 'put',
  ): number {
    if (type === 'call') {
      return Math.max(underlyingPrice - strike, 0);
    }
    return Math.max(strike - underlyingPrice, 0);
  }

  // -----------------------------------------------------------------------
  // Expired-option Greeks
  // -----------------------------------------------------------------------

  private expiredGreeks(
    type: 'call' | 'put',
    S: number,
    K: number,
  ): Greeks {
    // At expiry, Greeks collapse to step-function values
    const itm = type === 'call' ? S > K : S < K;
    return {
      delta: itm ? (type === 'call' ? 1 : -1) : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    };
  }

  // -----------------------------------------------------------------------
  // Analytical Greeks (Black-Scholes)
  // -----------------------------------------------------------------------

  private analyticalGreeks(params: OptionParams): Greeks {
    const S = params.underlying;
    const K = params.strike;
    const T = params.timeToExpiry;
    const r = params.riskFreeRate;
    const sigma = Math.max(params.volatility, MIN_VOLATILITY);
    const q = params.dividendYield ?? 0;

    if (T <= 0) {
      return this.expiredGreeks(params.type, S, K);
    }

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const Nd1 = normalCDF(d1);
    const Nd2 = normalCDF(d2);
    const pdfD1 = normalPDF(d1);

    const eqT = Math.exp(-q * T);
    const erT = Math.exp(-r * T);

    // Delta
    let delta: number;
    if (params.type === 'call') {
      delta = eqT * Nd1;
    } else {
      delta = eqT * (Nd1 - 1);
    }

    // Gamma (same for calls and puts)
    const gamma = eqT * pdfD1 / (S * sigma * sqrtT);

    // Theta (per calendar day = divide annual by 365)
    const commonTheta =
      -(S * eqT * pdfD1 * sigma) / (2 * sqrtT);

    let thetaAnnual: number;
    if (params.type === 'call') {
      thetaAnnual = commonTheta + q * S * eqT * Nd1 - r * K * erT * Nd2;
    } else {
      thetaAnnual = commonTheta - q * S * eqT * (1 - Nd1) + r * K * erT * (1 - Nd2);
    }
    const theta = thetaAnnual / 365; // per calendar day

    // Vega (per 1 percentage-point change in vol)
    const vega = S * eqT * pdfD1 * sqrtT / 100;

    // Rho (per 1 percentage-point change in rate)
    let rho: number;
    if (params.type === 'call') {
      rho = K * T * erT * Nd2 / 100;
    } else {
      rho = -K * T * erT * (1 - Nd2) / 100;
    }

    return { delta, gamma, theta, vega, rho };
  }

  // -----------------------------------------------------------------------
  // Numerical Greeks (finite-difference, works for any model)
  // -----------------------------------------------------------------------

  private numericalGreeks(params: OptionParams): Greeks {
    const S = params.underlying;
    const sigma = params.volatility;
    const T = params.timeToExpiry;

    const bumpS = Math.max(S * NUMERICAL_BUMP, 0.01);
    const bumpSigma = 0.01; // 1 % vol bump
    const bumpT = 1 / 365;  // 1 day
    const bumpR = 0.01;     // 1 % rate bump

    // Base price
    const basePrice = this.priceForGreeks(params);

    // Delta �?central difference
    const priceUp = this.priceForGreeks({ ...params, underlying: S + bumpS });
    const priceDown = this.priceForGreeks({ ...params, underlying: S - bumpS });
    const delta = (priceUp - priceDown) / (2 * bumpS);

    // Gamma �?central second difference
    const gamma = (priceUp - 2 * basePrice + priceDown) / (bumpS * bumpS);

    // Theta �?forward difference (time decreases �?price generally decreases)
    const priceTimeBump = this.priceForGreeks({
      ...params,
      timeToExpiry: Math.max(T - bumpT, 0),
    });
    const theta = priceTimeBump - basePrice; // per day

    // Vega �?central difference
    const priceVolUp = this.priceForGreeks({
      ...params,
      volatility: sigma + bumpSigma,
    });
    const priceVolDown = this.priceForGreeks({
      ...params,
      volatility: Math.max(sigma - bumpSigma, MIN_VOLATILITY),
    });
    const vega = (priceVolUp - priceVolDown) / (2 * bumpSigma * 100); // per 1% vol

    // Rho �?central difference
    const r = params.riskFreeRate;
    const priceRateUp = this.priceForGreeks({ ...params, riskFreeRate: r + bumpR });
    const priceRateDown = this.priceForGreeks({
      ...params,
      riskFreeRate: Math.max(r - bumpR, -0.1),
    });
    const rho = (priceRateUp - priceRateDown) / (2 * bumpR * 100); // per 1% rate

    return { delta, gamma, theta, vega, rho };
  }

  /**
   * Dispatcher for numerical-Greek pricing.
   * Uses BS for European, binomial for American.
   */
  private priceForGreeks(params: OptionParams): number {
    if (params.style === 'american') {
      return this.binomialTree(params, { steps: 100 }).price;
    }
    return this.blackScholes(params).price;
  }

  // -----------------------------------------------------------------------
  // Tree-based Greeks (finite-difference on CRR)
  // -----------------------------------------------------------------------

  private treeGreeks(params: OptionParams, steps: number): Greeks {
    // Use a smaller step count for speed when computing Greeks via bumps
    const treeSteps = Math.min(steps, 150);
    const cfg: BinomialConfig = { steps: treeSteps };

    const S = params.underlying;
    const sigma = params.volatility;
    const T = params.timeToExpiry;

    const bumpS = Math.max(S * NUMERICAL_BUMP, 0.01);
    const bumpSigma = 0.01;
    const bumpT = 1 / 365;
    const bumpR = 0.01;

    const basePrice = this.binomialTree(params, cfg).price;

    // Delta
    const pUp = this.binomialTree({ ...params, underlying: S + bumpS }, cfg).price;
    const pDown = this.binomialTree({ ...params, underlying: S - bumpS }, cfg).price;
    const delta = (pUp - pDown) / (2 * bumpS);

    // Gamma
    const gamma = (pUp - 2 * basePrice + pDown) / (bumpS * bumpS);

    // Theta
    const pTime = this.binomialTree(
      { ...params, timeToExpiry: Math.max(T - bumpT, 0) },
      cfg,
    ).price;
    const theta = pTime - basePrice;

    // Vega
    const pVolUp = this.binomialTree(
      { ...params, volatility: sigma + bumpSigma },
      cfg,
    ).price;
    const pVolDown = this.binomialTree(
      { ...params, volatility: Math.max(sigma - bumpSigma, MIN_VOLATILITY) },
      cfg,
    ).price;
    const vega = (pVolUp - pVolDown) / (2 * bumpSigma * 100);

    // Rho
    const r = params.riskFreeRate;
    const pRateUp = this.binomialTree(
      { ...params, riskFreeRate: r + bumpR },
      cfg,
    ).price;
    const pRateDown = this.binomialTree(
      { ...params, riskFreeRate: Math.max(r - bumpR, -0.1) },
      cfg,
    ).price;
    const rho = (pRateUp - pRateDown) / (2 * bumpR * 100);

    return { delta, gamma, theta, vega, rho };
  }

  // -----------------------------------------------------------------------
  // Implied volatility �?bisection fallback
  // -----------------------------------------------------------------------

  private impliedVolatilityBisection(
    marketPrice: number,
    params: Omit<OptionParams, 'volatility'>,
  ): number {
    let lo = MIN_VOLATILITY;
    let hi = MAX_VOLATILITY;

    for (let iter = 0; iter < 200; iter++) {
      const mid = (lo + hi) / 2;
      const testParams: OptionParams = { ...params, volatility: mid } as OptionParams;
      const bsPrice = this.blackScholes(testParams).price;
      const diff = bsPrice - marketPrice;

      if (Math.abs(diff) < IV_TOLERANCE) {
        log.debug(
          `[OptionsPricingEngine] IV (bisection) converged in ${iter + 1} iterations �?σ=${mid.toFixed(6)}`,
        );
        return mid;
      }

      if (diff > 0) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    const finalMid = (lo + hi) / 2;
    log.warn(
      `[OptionsPricingEngine] IV bisection did not fully converge �?σ�?{finalMid.toFixed(6)}`,
    );
    return finalMid;
  }
}

// ---------------------------------------------------------------------------
// Re-export convenience singleton
// ---------------------------------------------------------------------------

/**
 * Pre-instantiated engine for quick one-off calculations.
 *
 * ```ts
 * import { optionsEngine } from './options-pricing';
 * const result = optionsEngine.blackScholes({ ... });
 * ```
 */
export const optionsEngine = new OptionsPricingEngine();

// ── Standalone exports for main.ts import ──────────────────────────────────
export function blackScholesPrice(params: OptionParams): PricingResult {
  return optionsEngine.blackScholes(params);
}
export function calculateGreeks(params: OptionParams): Greeks {
  return optionsEngine.calculateGreeks(params);
}
export function priceAndGreeks(params: OptionParams): PricingResult & { greeks: Greeks } {
  const price = optionsEngine.blackScholes(params);
  const greeks = optionsEngine.calculateGreeks(params);
  return { ...price, greeks };
}
export function buildVolSurface(inputs: VolSurfaceInput[]): VolatilitySurface {
  return optionsEngine.buildVolatilitySurface(inputs);
}
export function impliedVolatility(marketPrice: number, params: Omit<OptionParams, 'volatility'>): number {
  return optionsEngine.impliedVolatility(marketPrice, params);
}
