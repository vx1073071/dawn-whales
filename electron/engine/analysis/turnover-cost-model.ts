// ── R171 F8: Turnover Cost Model ─────────────────────────────────────────
// Estimate per-factor turnover costs for realistic strategy backtesting.
//
// Turnover cost breaks down into:
//   1. Commission (broker fee) — varies by market
//   2. Spread cost (bid-ask) — varies by instrument liquidity
//   3. Market impact (slippage) — proportional to trade size vs volume
//   4. Factor-specific turnover rate — how often each factor triggers rebalancing
//
// Default rates align with QuantMoo v17.6 commission schedule:
//   Stocks/ETF: 0.1%, Crypto spot: 0.1%, Crypto futures: 0.02%

import { log } from '../../../../src/lib/logger';

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

  /**
   * R172 F8续: Get UI-ready turnover cost summary.
   * Returns formatted data for frontend display: cost breakdown per factor,
   * market comparison, cost tiers, and actionable recommendations.
   */
  getTurnoverCostSummary(options?: {
    market?: string;
    tradeSizeUSD?: number;
    avgDailyVolumeUSD?: number;
    factorIds?: string[];
  }): {
    timestamp: number;
    market: string;
    parameters: {
      tradeSizeUSD: number;
      avgDailyVolumeUSD: number;
      commissionRate: number;
      spreadBps: number;
      impactFactor: number;
    };
    costTiers: Array<{
      tier: 'low' | 'medium' | 'high' | 'extreme';
      label: string;
      labelCN: string;
      threshold: number; // totalCostPct threshold
      factors: Array<{
        factorId: string;
        nameCN: string;
        totalCostPct: number;
        annualTurnover: number;
        rebalanceDays: number;
        costPerTradePct: number;
      }>;
    }>;
    allFactors: Array<{
      factorId: string;
      nameCN: string;
      rank: number;
      tier: 'low' | 'medium' | 'high' | 'extreme';
      totalCostPct: number;
      costBreakdown: {
        commission: number;
        spread: number;
        impact: number;
      };
      annualTurnover: number;
      rebalanceDays: number;
      tradesPerYear: number;
      costPerTradePct: number;
      volatilitySensitivity: string;
    }>;
    lowestCostFactors: string[];
    highestCostFactors: string[];
    recommendations: string[];
  } {
    const mkt = options?.market || 'US';
    const tradeSize = options?.tradeSizeUSD || 10000;
    const adv = options?.avgDailyVolumeUSD || 5000000;
    const marketDefaults = MARKET_DEFAULTS[mkt] || MARKET_DEFAULTS.US;

    // Get estimates for all (or specified) factors
    const factorIds = options?.factorIds
      || Array.from(this.profiles.keys());
    const estimates = factorIds.map(fid => {
      const est = this.estimateForMarket(fid, mkt, tradeSize, adv);
      const profile = this.profiles.get(fid);
      return { estimate: est, profile };
    });

    // Sort by total cost ascending
    estimates.sort((a, b) => a.estimate.totalCostPct - b.estimate.totalCostPct);

    // Assign tiers
    const tierThresholds = {
      low: { threshold: 0.005, label: 'Low', labelCN: '低成本' },      // <0.5%/yr
      medium: { threshold: 0.02, label: 'Medium', labelCN: '中等成本' }, // 0.5-2%/yr
      high: { threshold: 0.05, label: 'High', labelCN: '高成本' },       // 2-5%/yr
      extreme: { threshold: Infinity, label: 'Extreme', labelCN: '极高成本' },
    };

    const tiers: Record<string, Array<{ factorId: string; nameCN: string; totalCostPct: number; annualTurnover: number; rebalanceDays: number; costPerTradePct: number }>> = {
      low: [], medium: [], high: [], extreme: [],
    };

    // CN name mapping
    const cnNames: Record<string, string> = {
      MOM_12M: '12月动量', MOM_1M: '1月动量', HML: '价值因子', SIZE: '规模因子',
      QUAL: '质量因子', RMW: '盈利能力', CMA: '投资风格', GROWTH: '成长因子',
      YIELD: '股息因子', VOL_60D: '60日波动率', LIQ: '流动性因子',
      MA_20_60: '均线交叉', EMA_12_26: 'MACD', RSI_14: 'RSI',
      ADX: 'ADX趋势', BOLL: '布林带', CRYPTO_FUNDING: '资金费率',
      CRYPTO_LIQUIDATIONS: '爆仓热度',
    };

    const allFactors: Array<any> = [];

    for (let i = 0; i < estimates.length; i++) {
      const { estimate: e, profile: p } = estimates[i];
      const tier: 'low' | 'medium' | 'high' | 'extreme' =
        e.totalCostPct < 0.005 ? 'low' :
        e.totalCostPct < 0.02 ? 'medium' :
        e.totalCostPct < 0.05 ? 'high' : 'extreme';

      tiers[tier].push({
        factorId: e.factorId,
        nameCN: cnNames[e.factorId] || e.factorId,
        totalCostPct: e.totalCostPct,
        annualTurnover: e.factorAnnualTurnover,
        rebalanceDays: p?.rebalanceFrequencyDays || 90,
        costPerTradePct: e.costPerTradePct,
      });

      allFactors.push({
        factorId: e.factorId,
        nameCN: cnNames[e.factorId] || e.factorId,
        rank: i + 1,
        tier,
        totalCostPct: e.totalCostPct,
        costBreakdown: {
          commission: e.commissionCostPct,
          spread: e.spreadCostPct,
          impact: e.impactCostPct,
        },
        annualTurnover: e.factorAnnualTurnover,
        rebalanceDays: p?.rebalanceFrequencyDays || 90,
        tradesPerYear: e.estimatedTradesPerYear,
        costPerTradePct: e.costPerTradePct,
        volatilitySensitivity: p?.volatilitySensitivity || 'medium',
      });
    }

    // Recommendations
    const recommendations: string[] = [];
    const lowestIds = allFactors.slice(0, 3).map(f => f.nameCN);
    const highestIds = allFactors.slice(-3).map(f => f.nameCN);

    recommendations.push(`▼ 最低换手成本: ${lowestIds.join('、')} — 适合长期持有策略`);
    recommendations.push(`▲ 最高换手成本: ${highestIds.join('、')} — 仅适合高频/LP策略`);
    recommendations.push(`⚡ 成本占比中，${marketDefaults.impactFactor > 0.08 ? '市场冲击' : marketDefaults.spreadBps > 5 ? '价差成本' : '佣金'}是主要成本来源`);
    if (mkt === 'CRYPTO') {
      recommendations.push('⚠️ 加密货币资金费率因子换手率极高，仅在永续合约市场有效');
    }
    if (mkt === 'HK') {
      recommendations.push('⚠️ 港股价差较大，小型股因子策略需额外注意流动性');
    }

    return {
      timestamp: Date.now(),
      market: mkt,
      parameters: {
        tradeSizeUSD: tradeSize,
        avgDailyVolumeUSD: adv,
        commissionRate: marketDefaults.commissionRate,
        spreadBps: marketDefaults.spreadBps,
        impactFactor: marketDefaults.impactFactor,
      },
      costTiers: [
        { tier: 'low' as const, ...tierThresholds.low, factors: tiers.low },
        { tier: 'medium' as const, ...tierThresholds.medium, factors: tiers.medium },
        { tier: 'high' as const, ...tierThresholds.high, factors: tiers.high },
        { tier: 'extreme' as const, ...tierThresholds.extreme, factors: tiers.extreme },
      ],
      allFactors,
      lowestCostFactors: allFactors.slice(0, 3).map(f => f.factorId),
      highestCostFactors: allFactors.slice(-3).map(f => f.factorId),
      recommendations,
    };
  }

  /**
   * [R176 F8续] Get turnover cost summary as chart-friendly JSON for UI display.
   * Implemented as standalone function to support esbuild/vitest transform.
   */
  getTurnoverCostJSON(currentWeights, targetWeights, market, marketValue) {
    const mkt = market || 'US';
    const mv = marketValue != null ? marketValue : 100000;
    const cw = currentWeights || [];
    const tw = targetWeights || [];

    const wm = new Map<string, number>();
    for (const w of cw) wm.set(w.factorId, w.weight);
    for (const w of tw) {
      const cur = wm.get(w.factorId) || 0;
      wm.set(w.factorId, w.weight - cur); // store delta
    }

    const details: any[] = [];

    let totalAbsDelta = 0;
    for (const t of tw) {
      const cur = cw.find((c: any) => c.factorId === t.factorId)?.weight ?? 0;
      const delta = Math.abs(t.weight - cur);
      totalAbsDelta += delta;

      const factorProfile = this.profiles.get(t.factorId);
      const annualTurnover = factorProfile?.typicalAnnualTurnover ?? 1.0;
      const mktDef = MARKET_DEFAULTS[mkt] || MARKET_DEFAULTS.US;
      const costBps = delta * annualTurnover * (mktDef.commissionRate + mktDef.spreadBps / 10000 + mktDef.impactFactor * 0.01) * 10000;

      details.push({
        factorId: t.factorId,
        currentWeight: Math.round(cur * 10000) / 100,
        targetWeight: Math.round(t.weight * 10000) / 100,
        changePct: Math.round(delta * 10000) / 100,
        annualTurnover: Math.round(annualTurnover * 100) / 100,
        costPerFactorBps: Math.round(costBps * 100) / 100,
      });
    }

    const turnoverPct = totalAbsDelta / 2;
    const mktDef = MARKET_DEFAULTS[mkt] || MARKET_DEFAULTS.US;
    const costBps = turnoverPct * (mktDef.commissionRate + mktDef.spreadBps / 10000 + mktDef.impactFactor * 0.01) * 10000;
    const costUSD = mv * (costBps / 10000);
    const feasible = turnoverPct <= 0.50 && costUSD <= mv * 0.01;

    let recommendation: string;
    if (!feasible) {
      recommendation = turnoverPct > 0.50
        ? `换手率 ${(turnoverPct * 100).toFixed(1)}% 过高, 建议分批执行或降低调整幅度`
        : `预计成本 $${costUSD.toFixed(1)} 超出 1%, 建议优化组合`;
    } else {
      recommendation = `换手率 ${(turnoverPct * 100).toFixed(1)}%, 预计成本 $${costUSD.toFixed(2)}, 建议一次性执行`;
    }

    return {
      summary: {
        totalTurnoverPct: Math.round(turnoverPct * 10000) / 100,
        estimatedCostBps: Math.round(costBps * 100) / 100,
        estimatedCostUSD: Math.round(costUSD * 100) / 100,
        feasible,
        recommendation,
      },
      details,
      market: mkt,
      marketValue: mv,
      timestamp: Date.now(),
    };
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
