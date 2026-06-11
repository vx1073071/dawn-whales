// ── Q49: Liquidity Risk Engine ────────────────────────────────────────────────
// LCR + Funding gap + Liquidation cost estimation + Fire sale cascade

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LiquidityPosition {
  symbol: string;
  quantity: number;
  marketValue: number;     // HKD
  avgDailyVolume: number;  // ADV (shares)
  advValue: number;        // ADV in HKD
  daysToLiquidate: number; // Estimated
  bidAskSpread: number;    // bps
  priceImpact: number;     // % price move per 10% of ADV traded
  assetClass: 'STOCK' | 'ETF' | 'OPTIONS' | 'FUTURES' | 'BOND' | 'FX';
  liquidationPriority: number; // 1 = most liquid
}

export interface FundingObligation {
  type: 'MARGIN' | 'SETTLEMENT' | 'REDEMPTION' | 'COLLATERAL_CALL';
  amount: number;
  dueDate: number;         // Unix timestamp
  currency: string;
  rolloverAvailable: boolean;
}

export interface LiquidityRiskReport {
  portfolioId: string;

  // LCR components
  hqla: number;            // High Quality Liquid Assets (HKD)
  netCashOutflow: number;  // 30-day net cash outflow
  lcr: number;             // Liquidity Coverage Ratio
  lcrGrade: 'PASS' | 'FAIL' | 'WARNING';

  // Funding gap
  fundingGap7d: number;    // 7-day funding gap
  fundingGap30d: number;  // 30-day funding gap
  cumulativeGap: Array<{ day: number; gap: number }>;

  // Liquidation analysis
  positions: LiquidityPosition[];
  liquidationCostTotal: number;  // Total cost to liquidate all
  liquidationCostBp: number;    // Cost in bps of portfolio
  maxLiquidationDays: number;   // Max days to fully liquidate
  criticalPositions: Array<{ symbol: string; issue: string; daysToLiquidate: number }>;

  // Fire sale cascade
  fireSaleScenario: Array<{
    day: number;
    liquidatedPct: number;
    portfolioValue: number;
    cascadeLoss: number;
  }>;

  // Risk flags
  riskFlags: string[];
  recommendations: string[];
  timestamp: number;
}

// ── Liquidity Risk Engine ─────────────────────────────────────────────────

export class LiquidityRiskEngine {
  constructor(private portfolioValue: number = 0) {
    log.info('[LiquidityRiskEngine] Initialized');
  }

  // ── Analyze ────────────────────────────────────────────────────────

  analyze(
    positions: LiquidityPosition[],
    fundingObligations: FundingObligation[],
    liquidationTargetDays = 10
  ): LiquidityRiskReport {
    log.info(`[LiquidityRisk] Analyzing ${positions.length} positions, ${fundingObligations.length} obligations`);

    // HQLA: only cash + government bonds + large-cap stocks
    const hqla = positions
      .filter(p => p.assetClass === 'ETF' || p.assetClass === 'FX')
      .reduce((s, p) => s + p.marketValue, 0);

    // Funding obligations
    const now = Date.now();
    const obs7d = fundingObligations.filter(o => o.dueDate - now <= 7 * 86400_000);
    const obs30d = fundingObligations.filter(o => o.dueDate - now <= 30 * 86400_000);
    const fundingGap7d = obs7d.reduce((s, o) => s + o.amount, 0);
    const fundingGap30d = obs30d.reduce((s, o) => s + o.amount, 0);

    // LCR = HQLA / Net Cash Outflows (30d)
    const lcr = fundingGap30d > 0 ? (hqla / fundingGap30d) * 100 : 999;
    const lcrGrade: LiquidityRiskReport['lcrGrade'] =
      lcr >= 100 ? 'PASS' : lcr >= 80 ? 'WARNING' : 'FAIL';

    // Liquidation costs
    let totalLiqCost = 0;
    const criticalPositions: LiquidityRiskReport['criticalPositions'] = [];

    for (const pos of positions) {
      // Days to liquidate: at 20% of ADV per day (conservative)
      const dailyVolume = pos.avgDailyVolume * 0.2;
      const daysNeeded = dailyVolume > 0 ? pos.quantity / dailyVolume : 999;
      pos.daysToLiquidate = Math.ceil(daysNeeded);

      // Liquidation cost = market impact + spread
      const liquidationPct = Math.min(1, pos.quantity / Math.max(pos.avgDailyVolume, 1));
      const impactCost = pos.priceImpact * liquidationPct * pos.marketValue;
      const spreadCost = pos.marketValue * pos.bidAskSpread / 10000;
      const liqCost = impactCost + spreadCost;
      totalLiqCost += liqCost;

      if (daysNeeded > liquidationTargetDays) {
        criticalPositions.push({
          symbol: pos.symbol,
          issue: `${i18n.t('LiquidityRisk.k0')} ${Math.ceil(daysNeeded)}${i18n.t('LiquidityRisk.k1')}${liquidationTargetDays}${i18n.t('LiquidityRisk.k2')}`,
          daysToLiquidate: Math.ceil(daysNeeded),
        });
      }
    }

    const liquidationCostBp = this.portfolioValue > 0
      ? (totalLiqCost / this.portfolioValue) * 10000 : 0;
    const maxLiqDays = Math.max(...positions.map(p => p.daysToLiquidate), 0);

    // Fire sale cascade (simulate liquidation over 10 days)
    const fireSaleScenario = this.simulateFireSale(positions, 10);

    // Risk flags
    const riskFlags: string[] = [];
    if (lcr < 80) riskFlags.push(`⚠️ LCR ${lcr.toFixed(0)}% below 100% minimum`);
    if (liquidationCostBp > 50) riskFlags.push(`💸 High liquidation cost: ${liquidationCostBp.toFixed(1)}bps`);
    if (maxLiqDays > 30) riskFlags.push(`⚠️ ${maxLiqDays} days to fully liquidate — extreme illiquidity`);
    if (fundingGap7d > this.portfolioValue * 0.1) riskFlags.push(`💰 7-day funding gap HK$${(fundingGap7d/10000).toFixed(1)}${i18n.t('LiquidityRisk.k3')}`);
    if (criticalPositions.length > 0) riskFlags.push(`🔴 ${criticalPositions.length} positions difficult to liquidate`);

    // Recommendations
    const recommendations: string[] = [];
    if (lcr < 100) recommendations.push(`Increase HQLA by HK$${Math.max(0, (fundingGap30d - hqla)/10000).toFixed(1)}${i18n.t('LiquidityRisk.k4')}`);
    if (totalLiqCost > this.portfolioValue * 0.02) recommendations.push(`⚠️ Pre-liquidate illiquid positions gradually to reduce cascade risk`);
    if (fundingGap30d > this.portfolioValue * 0.2) recommendations.push(`💰 Arrange credit lines for ${(fundingGap30d/this.portfolioValue*100).toFixed(0)}% of portfolio in 30d obligations`);
    if (recommendations.length === 0) recommendations.push('✅ Liquidity profile adequate — maintain HQLA buffer');

    return {
      portfolioId: '',
      hqla: Math.round(hqla * 100) / 100,
      netCashOutflow: Math.round(fundingGap30d * 100) / 100,
      lcr: Math.round(lcr * 10) / 10,
      lcrGrade,
      fundingGap7d: Math.round(fundingGap7d * 100) / 100,
      fundingGap30d: Math.round(fundingGap30d * 100) / 100,
      cumulativeGap: Array.from({ length: 10 }, (_, i) => ({
        day: i + 1,
        gap: Math.round(fundingGap7d * (i + 1) / 7 * 100) / 100,
      })),
      positions,
      liquidationCostTotal: Math.round(totalLiqCost * 100) / 100,
      liquidationCostBp: Math.round(liquidationCostBp * 10) / 10,
      maxLiquidationDays: maxLiqDays,
      criticalPositions,
      fireSaleScenario,
      riskFlags,
      recommendations,
      timestamp: Date.now(),
    };
  }

  // ── Fire Sale Simulation ────────────────────────────────────────────

  private simulateFireSale(
    positions: LiquidityPosition[],
    totalDays: number
  ): LiquidityRiskReport['fireSaleScenario'] {
    const scenario: LiquidityRiskReport['fireSaleScenario'] = [];
    let remainingValue = this.portfolioValue;
    let totalLiquidated = 0;

    const sortedPos = [...positions].sort((a, b) => a.liquidationPriority - b.liquidationPriority);

    for (let day = 1; day <= totalDays; day++) {
      // Liquidate up to 20% of remaining per day
      const targetSell = remainingValue * 0.20;
      let daySell = 0;

      for (const pos of sortedPos) {
        const maxSell = Math.min(pos.marketValue * 0.5, targetSell - daySell);
        if (maxSell <= 0) continue;

        // Price impact from selling 20% of daily volume
        const sellQty = maxSell / pos.marketValue;
        const impactPct = pos.priceImpact * (sellQty / pos.avgDailyVolume) * 10;
        const priceDrop = pos.marketValue * impactPct / 100;

        daySell += maxSell;
        totalLiquidated += maxSell;
        remainingValue -= (maxSell + priceDrop);

        // Cascade: others lose value too
        remainingValue -= priceDrop * 0.3; // Contagion
      }

      scenario.push({
        day,
        liquidatedPct: Math.round((daySell / this.portfolioValue) * 10000) / 100,
        portfolioValue: Math.round(Math.max(0, remainingValue) * 100) / 100,
        cascadeLoss: Math.round((this.portfolioValue - remainingValue - totalLiquidated) * 100) / 100,
      });
    }

    return scenario;
  }
}

export default LiquidityRiskEngine;