// ── Q16: Dynamic Position Sizer ─────────────────────────────────────────────
// Kelly Criterion + Volatility-Adjusted + Regime-Aware Position Sizing
//
// Inputs: account equity, strategy win rate / avg win / avg loss, volatility,
//         regime (from JVS market-breadth), optional custom risk params
//
// Output: recommended position size ($ and shares) per trade

import log from 'electron-log';
import { getMarketBreadth } from './market-breadth';
import { getRiskStatus } from './risk-engine';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PositionSizeRequest {
  /** Current account equity (CNY) */
  equity: number;
  /** Strategy win rate (0.0-1.0) */
  winRate: number;
  /** Average winning trade amount (CNY) */
  avgWin: number;
  /** Average losing trade amount (CNY, positive number) */
  avgLoss: number;
  /** Current volatility (annualized, e.g. 0.20 for 20%) */
  volatility?: number;
  /** Per-trade risk ceiling (CNY), default 2% of equity */
  riskCeiling?: number;
  /** Kelly fraction cap, default 0.25 (25%) */
  kellyCap?: number;
  /** Regime: 'bull'|'bear'|'range'|'volatile', auto-detected if omitted */
  regime?: 'bull' | 'bear' | 'range' | 'volatile';
  /** Custom Kelly multiplier (e.g. 0.5 = half-Kelly), default 0.5 */
  kellyMult?: number;
  /** Stock code for stock-specific volatility (optional) */
  stockCode?: string;
}

export interface PositionSizeResult {
  recommendedSize: number;     // CNY to risk
  kellyFrac: number;          // raw Kelly %
  adjustedFrac: number;       // after volatility + regime + cap
  positionValue: number;      // notional value of position
  shares: number;             // number of shares (if price provided)
  price?: number;             // entry price used
  leverage: number;           // effective leverage used
  riskReward: number;         // avgWin/avgLoss ratio
  kellyPct: number;           // Kelly as human-readable %
  regime: string;
  regimeAdjustments: RegimeAdjustment[];
  breakdown: {
    kellyBase: number;
    volAdjustment: number;
    regimeAdjustment: number;
    capAdjustment: number;
  };
}

export interface RegimeAdjustment {
  factor: string;
  multiplier: number;
  reason: string;
}

export interface DynamicSizerOutput {
  sizing: PositionSizeResult;
  timestamp: number;
  warnings: string[];
}

// ── Regime Detection ─────────────────────────────────────────────────────────

async function detectRegime(): Promise<{ regime: string; strength: number }> {
  try {
    const breadth = await getMarketBreadth({});
    const strength = breadth.strength ?? 50;
    const trend = breadth.trend ?? 'neutral';
    if (trend === 'strong_bull' || trend === 'bull') return { regime: 'bull', strength };
    if (trend === 'strong_bear' || trend === 'bear') return { regime: 'bear', strength };
    // High breadth = range/low vol, low breadth = volatile
    if (strength > 60) return { regime: 'range', strength };
    return { regime: 'volatile', strength };
  } catch (e) {
    log.warn('[DynamicSizer] regime detection failed, defaulting to range:', e);
    return { regime: 'range', strength: 50 };
  }
}

// ── Core Kelly Calculator ───────────────────────────────────────────────────

function calcKelly(winRate: number, avgWin: number, avgLoss: number): number {
  if (avgLoss <= 0 || avgWin <= 0) return 0;
  const winLossRatio = avgWin / avgLoss;
  const raw = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;
  return Math.max(0, raw); // Kelly can never be negative
}

// ── Regime Adjustment Table ──────────────────────────────────────────────────

const REGIME_TABLE: Record<string, { frac: number; reason: string }> = {
  bull:     { frac: 1.20, reason: '上升趋势，增强仓位' },
  bear:     { frac: 0.50, reason: '下降趋势，降半仓' },
  range:    { frac: 1.00, reason: '震荡市，标准仓位' },
  volatile: { frac: 0.60, reason: '高波动市，缩仓40%' },
};

// ── Main Sizing Function ─────────────────────────────────────────────────────

export async function calcPositionSize(req: PositionSizeReq): Promise<DynamicSizerOutput> {
  const {
    equity,
    winRate,
    avgWin,
    avgLoss,
    volatility = 0.20,
    riskCeiling,
    kellyCap = 0.25,
    regime: forcedRegime,
    kellyMult = 0.5,
    stockCode,
  } = req;

  const warnings: string[] = [];

  // ── 1. Raw Kelly ──────────────────────────────────────────────────────
  const rawKelly = calcKelly(winRate, avgWin, avgLoss);
  if (rawKelly > kellyCap) {
    warnings.push(`Raw Kelly ${(rawKelly * 100).toFixed(1)}% exceeds cap ${kellyCap * 100}%, capping`);
  }

  // ── 2. Kelly with multiplier (half-Kelly by default) ─────────────────
  const kellyWithMult = Math.min(rawKelly * kellyMult, kellyCap);

  // ── 3. Regime detection & adjustment ──────────────────────────────────
  const { regime, strength: regimeStrength } = forcedRegime
    ? { regime: forcedRegime, strength: 50 }
    : await detectRegime();

  const regimeAdj = REGIME_TABLE[regime] ?? REGIME_TABLE.range;

  // Scale adjustment by regime strength (50-100 scale)
  const regimeScale = regimeStrength / 100;
  const regimeMultiplier = 1 + (regimeAdj.frac - 1) * regimeScale;

  // ── 4. Volatility adjustment ───────────────────────────────────────────
  // Target: ~1x risk per unit of volatility
  // If vol > 20% annualized, reduce position; if < 10%, can increase
  const volBaseline = 0.20;
  const volMultiplier = volBaseline / volatility;

  // Cap volatility adjustment at 2x / 0.5x
  const volAdjClamped = Math.min(Math.max(volMultiplier, 0.5), 2.0);

  if (volatility > 0.30) {
    warnings.push(`High volatility ${(volatility * 100).toFixed(1)}% — position reduced`);
  }

  // ── 5. Risk ceiling ────────────────────────────────────────────────────
  const effectiveRiskCeiling = riskCeiling ?? equity * 0.02;
  const maxPositionByRisk = effectiveRiskCeiling / (avgLoss / equity); // if SL hits

  // ── 6. Combine adjustments ─────────────────────────────────────────────
  const adjustments: RegimeAdjustment[] = [
    { factor: 'volatility', multiplier: volAdjClamped, reason: `波动率调整 ×${volAdjClamped.toFixed(2)}` },
    { factor: 'regime',     multiplier: regimeMultiplier, reason: regimeAdj.reason },
  ];

  const adjKelly = kellyWithMult * volAdjClamped * regimeMultiplier;

  // ── 7. Apply risk ceiling ───────────────────────────────────────────────
  const maxByRisk = maxPositionByRisk;
  const adjKellyCapped = Math.min(adjKelly, maxByRisk / equity);

  // ── 8. Final position sizing ────────────────────────────────────────────
  const riskFrac = Math.min(adjKellyCapped, kellyCap);
  const recommendedSize = Math.round(equity * riskFrac);

  // Notional value (assume 1:1 for simplicity, can add price later)
  const positionValue = recommendedSize;
  const shares = 0; // caller multiplies by their entry price

  // ── 9. Leverage estimate ───────────────────────────────────────────────
  const leverage = riskFrac > 0 ? 1 / riskFrac : 0;

  // ── 10. Risk/Reward ─────────────────────────────────────────────────────
  const riskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

  const result: PositionSizeResult = {
    recommendedSize,
    kellyFrac: rawKelly,
    adjustedFrac: riskFrac,
    positionValue,
    shares,
    leverage: Math.round(leverage * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
    kellyPct: Math.round(riskFrac * 10000) / 100,
    regime,
    regimeAdjustments: adjustments,
    breakdown: {
      kellyBase:     Math.round(rawKelly * 10000) / 100,
      volAdjustment: Math.round(volAdjClamped * 100) / 100,
      regimeAdjustment: Math.round(regimeMultiplier * 100) / 100,
      capAdjustment: Math.round(kellyCap * 100) / 100,
    },
  };

  return { sizing: result, timestamp: Date.now(), warnings };
}

// ── Quick Sizing (simplified) ────────────────────────────────────────────────

export interface QuickSizingRequest {
  equity: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  volatility?: number;
}

export function calcQuickSize(req: QuickSizingReq): { riskAmount: number; fraction: number } {
  const { equity, winRate, avgWin, avgLoss, volatility = 0.20 } = req;
  const kelly = calcKelly(winRate, avgWin, avgLoss);
  const volAdj = Math.min(Math.max(0.20 / volatility, 0.5), 2.0);
  const halfKelly = Math.min(kelly * 0.5, 0.25);
  const adj = halfKelly * volAdj;
  const fraction = Math.min(adj, 0.25);
  return {
    riskAmount: Math.round(equity * fraction),
    fraction: Math.round(fraction * 10000) / 100,
  };
}

// ── Batch: Size multiple strategies ───────────────────────────────────────────

export interface PortfolioSizingRequest {
  equity: number;
  strategies: Array<{
    id: string;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    volatility?: number;
    correlation?: number; // correlation with other strategies
  }>;
  /** Max total risk as fraction of equity, default 0.10 (10%) */
  totalRiskCap?: number;
}

export async function calcPortfolioSizes(req: PortfolioSizerReq): Promise<{
  allocations: Array<{ strategyId: string; size: number; fraction: number; correlationPenalty: number }>;
  totalRisk: number;
  timestamp: number;
}> {
  const { equity, strategies, totalRiskCap = 0.10 } = req;

  // Step 1: Raw Kelly sizes
  const rawSizes = strategies.map(s => ({
    strategyId: s.id,
    kelly: calcKelly(s.winRate, s.avgWin, s.avgLoss),
    volatility: s.volatility ?? 0.20,
  }));

  // Step 2: Correlation penalty
  // For each strategy, reduce size if highly correlated with others
  const correlationMatrix: number[][] = strategies.map(a =>
    strategies.map(b => {
      if (a.id === b.id) return 1;
      return a.id === b.id ? 1 : (strategies.find(x => x.id === a.id)?.correlation ?? 0.5);
    })
  );

  const avgCorr = (idx: number) => {
    const row = correlationMatrix[idx] ?? [];
    const others = row.filter((_, i) => i !== idx);
    return others.length > 0 ? others.reduce((a, b) => a + b, 0) / others.length : 0;
  };

  const maxSingleRisk = totalRiskCap * equity;
  const allocations = rawSizes.map((s, idx) => {
    const corr = avgCorr(idx);
    // Penalize high correlation (> 0.6): up to 50% reduction
    const corrPenalty = corr > 0.6 ? 1 - (corr - 0.6) * 1.25 : 1.0;
    const volAdj = Math.min(Math.max(0.20 / s.volatility, 0.5), 2.0);
    const halfKelly = Math.min(s.kelly * 0.5, 0.25);
    const adj = halfKelly * volAdj * corrPenalty;
    const fraction = Math.min(adj, maxSingleRisk / equity);
    return {
      strategyId: s.strategyId,
      size: Math.round(equity * fraction),
      fraction: Math.round(fraction * 10000) / 100,
      correlationPenalty: Math.round((1 - corrPenalty) * 100) / 100,
    };
  });

  const totalRisk = allocations.reduce((sum, a) => sum + a.fraction, 0);

  return {
    allocations,
    totalRisk: Math.round(totalRisk * 100) / 100,
    timestamp: Date.now(),
  };
}
