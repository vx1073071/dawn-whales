// ── R171 F8: Turnover Cost Model ─────────────────────────────────────────
// Estimate per-factor turnover costs for realistic strategy backtesting.
//
// Turnover cost breaks down into:
//   1. Commission (broker fee) — varies by market
//   2. Spread cost (bid-ask) — varies by instrument liquidity
//   3. Market impact (slippage) — proportional to trade size vs volume
//   4. Factor-specific turnover rate — how often each factor triggers rebalancing
//
// Default rates align with DawnWhales v17.6 commission schedule:
//   Stocks/ETF: 0.1%, Crypto spot: 0.1%, Crypto futures: 0.02%

// ── Types ───────────────────────────────────────────────────────────────────

export interface TurnoverCostParams {
  /** Annual turnover rate (0-1, e.g. 0.5 = 50% of portfolio turns per year) */
  annualTurnoverRate: number;
  /** Average commission rate (e.g. 0.001 = 0.1%) */
  commissionRate: number;
  /** Average bid-ask spread (e.g. 0.0005 = 5 bps) */
  spreadBps: number;
  /** Market impact factor: how much price moves per 1% of ADV traded */
  impactFactor: number;
  /** Average daily volume (USD) */
  avgDailyVolumeUSD: number;
  /** Trade size (USD) */
  tradeSizeUSD: number;
}

export interface FactorTurnoverProfile {
  factorId: string;
  /** Typical annual turnover for this factor */
  typicalAnnualTurnover: number;
  /** Frequency of rebalance (days) */
  rebalanceFrequencyDays: number;
  /** Whether this factor triggers more trades when volatile */
  volatilitySensitivity: 'low' | 'medium' | 'high';
  description: string;
}

export interface TurnoverCostEstimate {
  // ── Point estimates ──
  /** Total cost as % of AUM per year */
  totalCostPct: number;
  /** Commission cost as % of AUM per year */
  commissionCostPct: number;
  /** Spread cost as % of AUM per year */
  spreadCostPct: number;
  /** Market impact as % of AUM per year */
  impactCostPct: number;

  // ── Per-trade costs ──
  /** Cost per round-trip trade (% of trade value) */
  costPerTradePct: number;
  /** Estimated annual number of trades */
  estimatedTradesPerYear: number;

  // ── Factor attribution ──
  factorId: string;
  factorAnnualTurnover: number;

  // ── Comparison ──
  /** Whether this factor is low-cost vs peers (< median) */
  isLowCost: boolean;
  /** Cost rank among factors (1 = lowest cost) */
  rankAmongFactors: number;
}

// ── Factor Turnover Profiles ───────────────────────────────────────────────

/**
 * Pre-calibrated turnover profiles for common factors.
 * Based on academic literature (Novy-Marx & Velikov 2016, Frazzini et al. 2018).
 */
const FACTOR_TURNOVER_PROFILES: FactorTurnoverProfile[] = [
  {
    factorId: 'MOM_12M',
    typicalAnnualTurnover: 3.0,
    rebalanceFrequencyDays: 30,
    volatilitySensitivity: 'high',
    description: '12-month momentum — highest turnover due to monthly rebalancing (~250%/year)',
  },
  {
    factorId: 'MOM_1M',
    typicalAnnualTurnover: 6.0,
    rebalanceFrequencyDays: 10,
    volatilitySensitivity: 'high',
    description: 'Short-term momentum — extreme turnover (~600%/year), suitable only for liquid markets',
  },
  {
    factorId: 'HML',
    typicalAnnualTurnover: 0.5,
    rebalanceFrequencyDays: 365,
    volatilitySensitivity: 'low',
    description: 'Value factor — low turnover, rebalance annually',
  },
  {
    factorId: 'SIZE',
    typicalAnnualTurnover: 0.6,
    rebalanceFrequencyDays: 365,
    volatilitySensitivity: 'low',
    description: 'Size factor — low turnover, market cap changes slowly',
  },
  {
    factorId: 'QUAL',
    typicalAnnualTurnover: 0.8,
    rebalanceFrequencyDays: 180,
    volatilitySensitivity: 'low',
    description: 'Quality factor — moderate turnover, semi-annual rebalance',
  },
  {
    factorId: 'RMW',
    typicalAnnualTurnover: 0.7,
    rebalanceFrequencyDays: 180,
    volatilitySensitivity: 'medium',
    description: 'Profitability — moderate turnover',
  },
  {
    factorId: 'CMA',
    typicalAnnualTurnover: 0.4,
    rebalanceFrequencyDays: 365,
    volatilitySensitivity: 'low',
    description: 'Investment factor — very low turnover',
  },
  {
    factorId: 'GROWTH',
    typicalAnnualTurnover: 1.5,
    rebalanceFrequencyDays: 90,
    volatilitySensitivity: 'medium',
    description: 'Growth factor — quarterly rebalance',
  },
  {
    factorId: 'YIELD',
    typicalAnnualTurnover: 0.5,
    rebalanceFrequencyDays: 180,
    volatilitySensitivity: 'low',
    description: 'Dividend yield — low turnover, dividends announced quarterly',
  },
  {
    factorId: 'VOL_60D',
    typicalAnnualTurnover: 1.8,
    rebalanceFrequencyDays: 60,
    volatilitySensitivity: 'high',
    description: 'Low volatility — moderate turnover, volatility changes faster than fundamentals',
  },
  {
    factorId: 'LIQ',
    typicalAnnualTurnover: 1.2,
    rebalanceFrequencyDays: 90,
    volatilitySensitivity: 'medium',
    description: 'Liquidity factor — quarterly rebalance',
  },
  {
    factorId: 'MA_20_60',
    typicalAnnualTurnover: 4.0,
    rebalanceFrequencyDays: 20,
    volatilitySensitivity: 'high',
    description: 'Moving average cross — high turnover, short-term signal',
  },
  {
    factorId: 'EMA_12_26',
    typicalAnnualTurnover: 5.0,
    rebalanceFrequencyDays: 12,
    volatilitySensitivity: 'high',
    description: 'MACD — high turnover, weekly rebalance',
  },
  {
    factorId: 'RSI_14',
    typicalAnnualTurnover: 2.5,
    rebalanceFrequencyDays: 14,
    volatilitySensitivity: 'medium',
    description: 'RSI — moderate turnover, bi-weekly signals',
  },
  {
    factorId: 'ADX',
    typicalAnnualTurnover: 2.0,
    rebalanceFrequencyDays: 30,
    volatilitySensitivity: 'medium',
    description: 'ADX trend strength — moderate turnover',
  },
  {
    factorId: 'CRYPTO_FUNDING',
    typicalAnnualTurnover: 12.0,
    rebalanceFrequencyDays: 1,
    volatilitySensitivity: 'high',
    description: 'Crypto funding rate — extreme turnover, daily rebalance (8h funding cycles)',
  },
  {
    factorId: 'CRYPTO_LIQUIDATIONS',
    typicalAnnualTurnover: 4.0,
    rebalanceFrequencyDays: 3,
    volatilitySensitivity: 'high',
    description: 'Crypto liquidation heat — high turnover, event-driven',
  },
  {
    factorId: 'BOLL',
    typicalAnnualTurnover: 3.0,
    rebalanceFrequencyDays: 20,
    volatilitySensitivity: 'medium',
    description: 'Bollinger Bands — moderate-high turnover',
  },
];

// ── Market Defaults ────────────────────────────────────────────────────────

const MARKET_DEFAULTS: Record<string, Omit<TurnoverCostParams, 'annualTurnoverRate' | 'tradeSizeUSD' | 'avgDailyVolumeUSD'>> = {
  US: { commissionRate: 0.001, spreadBps: 3, impactFactor: 0.1 },
  HK: { commissionRate: 0.001, spreadBps: 8, impactFactor: 0.15 },
  CRYPTO: { commissionRate: 0.0002, spreadBps: 5, impactFactor: 0.05 },
  SG: { commissionRate: 0.001, spreadBps: 10, impactFactor: 0.12 },
};

// ── Turnover Cost Engine ───────────────────────────────────────────────────

export class TurnoverCostEngine {
  private profiles: Map<string, FactorTurnoverProfile>;

  constructor() {
    this.profiles = new Map();
    for (const p of FACTOR_TURNOVER_PROFILES) {
      this.profiles.set(p.factorId, p);
    }
  }

  /**
   * Register or override a factor turnover profile.
   */
  registerProfile(profile: FactorTurnoverProfile): void {
    this.profiles.set(profile.factorId, profile);
  }

  /**
   * Estimate turnover cost for a single factor.
   */
  estimateCost(
    factorId: string,
    params: TurnoverCostParams,
  ): TurnoverCostEstimate {
    const profile = this.profiles.get(factorId) || {
      factorId,
      typicalAnnualTurnover: 1.0,
      rebalanceFrequencyDays: 90,
      volatilitySensitivity: 'medium',
      description: 'Unknown factor — using default medium turnover estimate',
    };

    const annualTurnover = profile.typicalAnnualTurnover;
    const tradesPerYear = annualTurnover * 2; // round trips

    // Commission cost = turnover * commission_rate * 2 (buy + sell)
    const commissionCostPct = annualTurnover * params.commissionRate * 2;

    // Spread cost = turnover * (spread / 10000) * 2
    const spreadCostPct = annualTurnover * (params.spreadBps / 10000) * 2;

    // Market impact = turnover * impactFactor * sqrt(tradeSize / ADV)
    const tradeRatio = params.tradeSizeUSD / Math.max(params.avgDailyVolumeUSD, 1);
    const impactCostPct = annualTurnover * params.impactFactor * Math.sqrt(tradeRatio) * 2;

    const totalCostPct = commissionCostPct + spreadCostPct + impactCostPct;

    return {
      totalCostPct: Number(totalCostPct.toFixed(6)),
      commissionCostPct: Number(commissionCostPct.toFixed(6)),
      spreadCostPct: Number(spreadCostPct.toFixed(6)),
      impactCostPct: Number(impactCostPct.toFixed(6)),
      costPerTradePct: Number(((totalCostPct / Math.max(tradesPerYear, 1)) * 100).toFixed(4)),
      estimatedTradesPerYear: Math.round(tradesPerYear),
      factorId,
      factorAnnualTurnover: annualTurnover,
      isLowCost: false, // filled by compareFactors()
      rankAmongFactors: 0, // filled by compareFactors()
    };
  }

  /**
   * Estimate turnover cost with market defaults.
   */
  estimateForMarket(
    factorId: string,
    market: string,
    tradeSizeUSD: number = 10000,
    avgDailyVolumeUSD: number = 5000000,
  ): TurnoverCostEstimate {
    const marketDefaults = MARKET_DEFAULTS[market] || MARKET_DEFAULTS.US;
    return this.estimateCost(factorId, {
      annualTurnoverRate: 1.0,
      commissionRate: marketDefaults.commissionRate,
      spreadBps: marketDefaults.spreadBps,
      impactFactor: marketDefaults.impactFactor,
      avgDailyVolumeUSD,
      tradeSizeUSD,
    });
  }

  /**
   * Compare all factors by turnover cost and rank them.
   * Returns the sorted list with updated isLowCost and rankAmongFields fields.
   */
  compareFactors(
    market: string = 'US',
    tradeSizeUSD: number = 10000,
    avgDailyVolumeUSD: number = 5000000,
  ): TurnoverCostEstimate[] {
    const estimates: TurnoverCostEstimate[] = [];

    for (const [factorId] of this.profiles) {
      estimates.push(this.estimateForMarket(factorId, market, tradeSizeUSD, avgDailyVolumeUSD));
    }

    // Sort by total cost (ascending)
    estimates.sort((a, b) => a.totalCostPct - b.totalCostPct);

    // Fill ranking metadata
    const medianIdx = Math.floor(estimates.length / 2);
    const medianCost = estimates[medianIdx]?.totalCostPct ?? 0;

    for (let i = 0; i < estimates.length; i++) {
      estimates[i].rankAmongFactors = i + 1;
      estimates[i].isLowCost = estimates[i].totalCostPct < medianCost;
    }

    return estimates;
  }

  /**
   * Bulk estimate for multiple factors.
   */
  estimateBulk(
    factorIds: string[],
    params: TurnoverCostParams,
  ): TurnoverCostEstimate[] {
    return factorIds.map(id => this.estimateCost(id, params));
  }

  /**
   * Get the turnover profile for a specific factor.
   */
  getProfile(factorId: string): FactorTurnoverProfile | undefined {
    return this.profiles.get(factorId);
  }

  /**
   * Get all registered profiles.
   */
  listProfiles(): FactorTurnoverProfile[] {
    return Array.from(this.profiles.values());
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createTurnoverCostEngine(): TurnoverCostEngine {
  return new TurnoverCostEngine();
}

let _engine: TurnoverCostEngine | null = null;

export function getTurnoverCostEngine(): TurnoverCostEngine {
  if (!_engine) _engine = new TurnoverCostEngine();
  return _engine;
}

export function resetTurnoverCostEngine(): void {
  _engine = null;
}
