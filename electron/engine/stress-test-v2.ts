// ── Q43: Strategy Stress Test v2 ──────────────────────────────────────────────
// Scenario-based stress test with user-defined scenarios
// Correlation shock scenarios + Regime-based scenario switching

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StressScenario {
  name: string;
  description: string;
  category: 'market' | 'sector' | 'macro' | 'liquidity' | 'correlation' | 'custom';
  severity: 'MODERATE' | 'SEVERE' | 'CRISIS';

  // Price shocks (%)
  priceShocks: Record<string, number>;  // symbol → % change

  // Vol multiplier
  volMultiplier: number;

  // Correlation shock (add to correlation matrix)
  correlationShock?: number;   // ± delta added to all correlations

  // Liquidity shock (spread multiplier)
  liquidityShock?: number;     // Spread multiplier

  // Duration (days)
  durationDays: number;
}

export interface StressResult {
  scenario: string;
  category: string;
  severity: string;

  // P&L
  basePnL: number;           // No shock
  stressedPnL: number;       // With shock
  shockLoss: number;         // stressed - base

  // Risk metrics
  stressedVaR: number;
  stressedCVaR: number;
  maxDrawdown: number;
  recoveryDays: number;

  // Position impact
  impactedPositions: Array<{
    symbol: string;
    quantity: number;
    avgCost: number;
    shockLoss: number;
    shockLossPct: number;
  }>;

  // Mitigation
  hedgingCost: number;
  reducedLoss: number;       // If hedged
  suggestions: string[];
  timestamp: number;
}

export interface RegimeScenarios {
  bull: StressScenario[];
  bear: StressScenario[];
  range: StressScenario[];
  volatile: StressScenario[];
}

// ── Predefined Scenarios ────────────────────────────────────────────────

const BUILT_IN_SCENARIOS: StressScenario[] = [
  {
    name: 'COVID-Crash-2020',
    description: 'COVID crash: -35% in 30 days, vol 4x',
    category: 'market',
    severity: 'CRISIS',
    priceShocks: { SPY: -35, QQQ: -30, 'HK.00700': -25, 'HK.09988': -30 },
    volMultiplier: 4,
    correlationShock: 0.3,
    liquidityShock: 5,
    durationDays: 30,
  },
  {
    name: 'Rate-Hike-200bp',
    description: 'Fed rate hike 200bp shock',
    category: 'macro',
    severity: 'SEVERE',
    priceShocks: { QQQ: -20, 'HK.00700': -15, TLT: -25, DXY: 10 },
    volMultiplier: 2,
    liquidityShock: 3,
    durationDays: 10,
  },
  {
    name: 'China-Double-Default',
    description: 'China property double default (Evergrande style)',
    category: 'sector',
    severity: 'SEVERE',
    priceShocks: { 'HK.00700': -20, 'HK.09988': -25, 'HK.02382': -40, GKO: -60, FXI: -15 },
    volMultiplier: 3,
    correlationShock: 0.4,
    liquidityShock: 4,
    durationDays: 15,
  },
  {
    name: 'Flash-Crash-5pct',
    description: 'Flash crash: 5% drop in 5 minutes, immediate bounce',
    category: 'liquidity',
    severity: 'MODERATE',
    priceShocks: { SPY: -5, QQQ: -6, 'HK.00700': -5 },
    volMultiplier: 5,
    liquidityShock: 10,
    durationDays: 1,
  },
  {
    name: 'Correlation-Spike',
    description: 'All correlations jump to 0.9 (crisis mode)',
    category: 'correlation',
    severity: 'SEVERE',
    priceShocks: {},
    volMultiplier: 2,
    correlationShock: 0.6,
    liquidityShock: 2,
    durationDays: 20,
  },
  {
    name: 'Tech-Selloff-30pct',
    description: 'Tech sector correction -30%',
    category: 'sector',
    severity: 'SEVERE',
    priceShocks: { QQQ: -30, AAPL: -28, MSFT: -25, GOOGL: -30, AMZN: -32, TSLA: -40 },
    volMultiplier: 2.5,
    liquidityShock: 3,
    durationDays: 20,
  },
  {
    name: 'HV-Yen-Spike',
    description: 'High volatility yen spike (carry unwind)',
    category: 'macro',
    severity: 'SEVERE',
    priceShocks: { JPY: -15, EWJ: -18, DX: 10, GLD: 10, SPY: -10 },
    volMultiplier: 3,
    correlationShock: 0.2,
    liquidityShock: 3,
    durationDays: 10,
  },
  {
    name: 'Brexit-2018',
    description: 'Brexit volatility event',
    category: 'macro',
    severity: 'MODERATE',
    priceShocks: { FXI: -12, EWU: -15, EWJ: -10, SPY: -8 },
    volMultiplier: 2.5,
    liquidityShock: 2,
    durationDays: 7,
  },
  {
    name: 'Election-Vol-Spike',
    description: 'US Election result uncertainty',
    category: 'macro',
    severity: 'MODERATE',
    priceShocks: { SPY: -10, QQQ: -12, VIX: 50, 'HK.00700': -8 },
    volMultiplier: 3,
    correlationShock: 0.3,
    liquidityShock: 2,
    durationDays: 5,
  },
  {
    name: 'Oil-Shock-50pct',
    description: 'Oil price collapse 50%',
    category: 'sector',
    severity: 'CRISIS',
    priceShocks: { USO: -50, XLE: -45, XOM: -40, 'HK.00857': -35, SPY: -15 },
    volMultiplier: 3,
    correlationShock: 0.2,
    liquidityShock: 3,
    durationDays: 30,
  },
];

// ── Regime Detection ────────────────────────────────────────────────────

const REGIME_SCENARIOS: RegimeScenarios = {
  bull: [
    { name: 'Bull-Correction-10pct', description: 'Bull market 10% pullback', category: 'market', severity: 'MODERATE', priceShocks: { SPY: -10, QQQ: -12 }, volMultiplier: 1.5, durationDays: 10 },
    { name: 'Bull-Correction-20pct', description: 'Bull market 20% correction', category: 'market', severity: 'SEVERE', priceShocks: { SPY: -20, QQQ: -25 }, volMultiplier: 2, durationDays: 30 },
  ],
  bear: [
    { name: 'Bear-Rally-20pct', description: 'Dead cat bounce in bear market', category: 'market', severity: 'SEVERE', priceShocks: { SPY: 20, QQQ: 25 }, volMultiplier: 2, durationDays: 10 },
    { name: 'Bear-Acceleration', description: 'Bear market acceleration', category: 'market', severity: 'CRISIS', priceShocks: { SPY: -35, QQQ: -40 }, volMultiplier: 3, liquidityShock: 5, durationDays: 30 },
  ],
  range: [
    { name: 'Breakdown-15pct', description: 'Range breakdown', category: 'market', severity: 'MODERATE', priceShocks: { SPY: -15, QQQ: -18 }, volMultiplier: 1.8, durationDays: 10 },
    { name: 'Breakout-15pct', description: 'Range breakout', category: 'market', severity: 'MODERATE', priceShocks: { SPY: 15, QQQ: 18 }, volMultiplier: 1.5, durationDays: 5 },
  ],
  volatile: [
    { name: 'Vol-Double', description: 'Vol doubles in volatile market', category: 'market', severity: 'SEVERE', priceShocks: { SPY: -15, QQQ: -18 }, volMultiplier: 4, correlationShock: 0.3, durationDays: 15 },
    { name: 'Vol-Triple', description: 'Vol triples (VVIX spike)', category: 'market', severity: 'CRISIS', priceShocks: { SPY: -25, QQQ: -30 }, volMultiplier: 6, correlationShock: 0.5, liquidityShock: 5, durationDays: 20 },
  ],
};

// ── Stress Test Engine ───────────────────────────────────────────────────

export class StressTestEngineV2 {
  constructor() {
    log.info('[StressTestEngineV2] Initialized');
  }

  // ── Get Scenarios ──────────────────────────────────────────────────

  getBuiltInScenarios(): StressScenario[] {
    return [...BUILT_IN_SCENARIOS];
  }

  getRegimeScenarios(regime: keyof RegimeScenarios): StressScenario[] {
    return [...(REGIME_SCENARIOS[regime] ?? [])];
  }

  // ── Run Stress Test ─────────────────────────────────────────────────

  runStressTest(
    scenario: StressScenario,
    positions: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
    }>
  ): StressResult {
    log.info(`[StressTestV2] Running: ${scenario.name}`);

    let basePnL = 0, stressedPnL = 0;
    const impactedPositions: StressResult['impactedPositions'] = [];

    for (const pos of positions) {
      const baseVal = pos.quantity * pos.currentPrice;
      basePnL += 0; // Base scenario: no P&L change (mark-to-market baseline)

      const shockPct = scenario.priceShocks[pos.symbol] ?? 0;
      const shockPrice = pos.currentPrice * (1 + shockPct / 100);
      const shockedValue = pos.quantity * shockPrice;
      const shockLoss = shockedValue - baseVal;

      stressedPnL += shockLoss;

      if (Math.abs(shockLoss) > 10) {
        impactedPositions.push({
          symbol: pos.symbol,
          quantity: pos.quantity,
          avgCost: pos.avgCost,
          shockLoss: Math.round(shockLoss * 100) / 100,
          shockLossPct: Math.round(shockPct * 100) / 100,
        });
      }
    }

    const shockLoss = stressedPnL - basePnL;
    const stressedVaR = Math.abs(shockLoss) * 1.65; // Simplified VaR
    const stressedCVaR = Math.abs(shockLoss) * 2.0;
    const maxDrawdown = Math.min(shockLoss / 10, shockLoss * 1.5);
    const recoveryDays = Math.abs(shockLoss) > 50000 ? Math.ceil(Math.abs(shockLoss) / 2000) : 0;

    // Suggestions
    const suggestions: string[] = [];
    if (scenario.severity === 'CRISIS' && Math.abs(shockLoss) > 100000) {
      suggestions.push('🚨 Extreme scenario: review overall risk limits immediately');
    }
    if (scenario.correlationShock && scenario.correlationShock > 0.4) {
      suggestions.push('⚠️ Correlation spike: diversification benefit reduced — hedge with broad ETF');
    }
    if (scenario.liquidityShock && scenario.liquidityShock > 3) {
      suggestions.push('⚠️ Liquidity stress: avoid large orders, consider smaller position sizes');
    }
    if (impactedPositions.length > 0) {
      const topLoss = impactedPositions.sort((a, b) => a.shockLoss - b.shockLoss)[0];
      if (topLoss) {
        suggestions.push(`📉 Largest impact: ${topLoss.symbol} (${topLoss.shockLossPct}%, HK$${(Math.abs(topLoss.shockLoss) / 10000).toFixed(1)}万)`);
      }
    }
    if (scenario.volMultiplier > 3) {
      suggestions.push('⚠️ High volatility multiplier: consider buying puts for protection');
    }
    if (suggestions.length === 0) {
      suggestions.push('✅ Scenario within risk tolerance — no immediate action needed');
    }

    return {
      scenario: scenario.name,
      category: scenario.category,
      severity: scenario.severity,
      basePnL: Math.round(basePnL * 100) / 100,
      stressedPnL: Math.round(stressedPnL * 100) / 100,
      shockLoss: Math.round(shockLoss * 100) / 100,
      stressedVaR: Math.round(stressedVaR * 100) / 100,
      stressedCVaR: Math.round(stressedCVaR * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      recoveryDays,
      impactedPositions: impactedPositions.sort((a, b) => a.shockLoss - b.shockLoss),
      hedgingCost: 0,
      reducedLoss: 0,
      suggestions,
      timestamp: Date.now(),
    };
  }

  // ── Batch Run ───────────────────────────────────────────────────────

  runBatchStress(
    scenarios: StressScenario[],
    positions: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
    }>
  ): StressResult[] {
    return scenarios.map(s => this.runStressTest(s, positions));
  }

  // ── Correlation Shock Scenarios ─────────────────────────────────────

  runCorrelationShock(
    baseCorr: number[][],
    shockDelta: number,
    positions: Array<{
      symbol: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
    }>
  ): {
    originalVaR: number;
    stressedVaR: number;
    varIncrease: number;
    description: string;
  } {
    // Run with base correlation
    const originalVaR = Math.abs(
      positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0) * 0.015 * 1.65
    );

    // With shocked correlation (all correlations increase)
    const stressedVaR = Math.abs(
      positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0) * 0.015 * (1.65 + shockDelta * 2)
    );

    return {
      originalVaR: Math.round(originalVaR * 100) / 100,
      stressedVaR: Math.round(stressedVaR * 100) / 100,
      varIncrease: Math.round((stressedVaR - originalVaR) * 100) / 100,
      description: `Correlation +${(shockDelta * 100).toFixed(0)}%: VaR increases ${((stressedVaR / originalVaR - 1) * 100).toFixed(1)}%`,
    };
  }

  // ── User-Defined Scenario ───────────────────────────────────────────

  createCustomScenario(
    name: string,
    description: string,
    priceShocks: Record<string, number>,
    volMultiplier = 2,
    severity: StressScenario['severity'] = 'SEVERE'
  ): StressScenario {
    return {
      name,
      description,
      category: 'custom',
      severity,
      priceShocks,
      volMultiplier,
      durationDays: 10,
    };
  }
}

export default StressTestEngineV2;