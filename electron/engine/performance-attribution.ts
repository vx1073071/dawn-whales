// ── Performance Attribution (JVS-45) ────────────────────────────────────────
// Brinson model: Allocation + Selection + Interaction effects
// IPC: em:portfolio-attribution

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SectorHolding {
  sector: string;
  weight: number;           // Portfolio weight in sector (%)
  returnPct: number;        // Portfolio return in sector (%)
}

export interface BenchmarkSector {
  sector: string;
  weight: number;           // Benchmark weight in sector (%)
  returnPct: number;        // Benchmark return in sector (%)
}

export interface AttributionParams {
  portfolio: SectorHolding[];
  benchmark: BenchmarkSector[];
}

export interface SectorAttribution {
  sector: string;
  // Weights
  portfolioWeight: number;
  benchmarkWeight: number;
  activeWeight: number;     // portfolio - benchmark

  // Returns
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;     // portfolio - benchmark

  // Brinson effects
  allocationEffect: number;    // (Wp - Wb) * (Rb_sector - Rb_total)
  selectionEffect: number;     // Wb * (Rp_sector - Rb_sector)
  interactionEffect: number;   // (Wp - Wb) * (Rp_sector - Rb_sector)
  totalEffect: number;         // Sum of all three
}

export interface AttributionResult {
  // Portfolio vs Benchmark totals
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;

  // Total Brinson effects
  totalAllocation: number;
  totalSelection: number;
  totalInteraction: number;

  // Per-sector breakdown
  sectors: SectorAttribution[];

  // Summary
  bestContributor: string;
  worstContributor: string;
  timestamp: number;
}

// ── Brinson Attribution ────────────────────────────────────────────────────

export function brinsonAttribution(params: AttributionParams): AttributionResult {
  const { portfolio, benchmark } = params;

  // Build sector maps
  const portfolioMap = new Map<string, SectorHolding>();
  const benchmarkMap = new Map<string, BenchmarkSector>();

  for (const h of portfolio) {
    portfolioMap.set(h.sector, h);
  }
  for (const b of benchmark) {
    benchmarkMap.set(b.sector, b);
  }

  // Get all sectors
  const allSectors = new Set<string>();
  for (const h of portfolio) allSectors.add(h.sector);
  for (const b of benchmark) allSectors.add(b.sector);

  // Calculate portfolio and benchmark total returns
  let portfolioReturn = 0;
  let benchmarkReturn = 0;

  for (const h of portfolio) {
    portfolioReturn += (h.weight / 100) * h.returnPct;
  }
  for (const b of benchmark) {
    benchmarkReturn += (b.weight / 100) * b.returnPct;
  }

  const activeReturn = portfolioReturn - benchmarkReturn;

  // Per-sector attribution
  const sectors: SectorAttribution[] = [];

  for (const sector of allSectors) {
    const pHolding = portfolioMap.get(sector);
    const bHolding = benchmarkMap.get(sector);

    const Wp = pHolding ? pHolding.weight / 100 : 0;
    const Wb = bHolding ? bHolding.weight / 100 : 0;
    const Rp = pHolding ? pHolding.returnPct : 0;
    const Rb = bHolding ? bHolding.returnPct : 0;

    const activeWeight = Wp - Wb;
    const activeReturnSector = Rp - Rb;

    // Brinson-Fachler decomposition
    const allocationEffect = activeWeight * (Rb - benchmarkReturn);
    const selectionEffect = Wb * activeReturnSector;
    const interactionEffect = activeWeight * activeReturnSector;
    const totalEffect = allocationEffect + selectionEffect + interactionEffect;

    sectors.push({
      sector,
      portfolioWeight: round(Wp * 100, 2),
      benchmarkWeight: round(Wb * 100, 2),
      activeWeight: round(activeWeight * 100, 2),
      portfolioReturn: round(Rp, 2),
      benchmarkReturn: round(Rb, 2),
      activeReturn: round(activeReturnSector, 2),
      allocationEffect: round(allocationEffect, 4),
      selectionEffect: round(selectionEffect, 4),
      interactionEffect: round(interactionEffect, 4),
      totalEffect: round(totalEffect, 4),
    });
  }

  // Sort by total effect
  sectors.sort((a, b) => b.totalEffect - a.totalEffect);

  // Totals
  const totalAllocation = sectors.reduce((sum, s) => sum + s.allocationEffect, 0);
  const totalSelection = sectors.reduce((sum, s) => sum + s.selectionEffect, 0);
  const totalInteraction = sectors.reduce((sum, s) => sum + s.interactionEffect, 0);

  const bestContributor = sectors.length > 0 ? sectors[0].sector : '';
  const worstContributor = sectors.length > 0 ? sectors[sectors.length - 1].sector : '';

  log.info(`[Attribution] Portfolio ${round(portfolioReturn, 2)}% vs Benchmark ${round(benchmarkReturn, 2)}%, Active: ${round(activeReturn, 2)}%`);

  return {
    portfolioReturn: round(portfolioReturn, 4),
    benchmarkReturn: round(benchmarkReturn, 4),
    activeReturn: round(activeReturn, 4),
    totalAllocation: round(totalAllocation, 4),
    totalSelection: round(totalSelection, 4),
    totalInteraction: round(totalInteraction, 4),
    sectors,
    bestContributor,
    worstContributor,
    timestamp: Date.now(),
  };
}

// ── Time-Series Attribution ────────────────────────────────────────────────

export interface TimeSeriesAttributionParams {
  periods: {
    date: string;
    portfolio: SectorHolding[];
    benchmark: BenchmarkSector[];
  }[];
}

export interface TimeSeriesAttributionResult {
  periods: {
    date: string;
    portfolioReturn: number;
    benchmarkReturn: number;
    activeReturn: number;
    allocation: number;
    selection: number;
    interaction: number;
  }[];
  cumulative: {
    portfolioReturn: number;
    benchmarkReturn: number;
    activeReturn: number;
    allocation: number;
    selection: number;
    interaction: number;
  };
}

export function timeSeriesAttribution(params: TimeSeriesAttributionParams): TimeSeriesAttributionResult {
  const periods: TimeSeriesAttributionResult['periods'] = [];

  let cumPortfolio = 0;
  let cumBenchmark = 0;
  let cumAllocation = 0;
  let cumSelection = 0;
  let cumInteraction = 0;

  for (const period of params.periods) {
    const result = brinsonAttribution({
      portfolio: period.portfolio,
      benchmark: period.benchmark,
    });

    periods.push({
      date: period.date,
      portfolioReturn: result.portfolioReturn,
      benchmarkReturn: result.benchmarkReturn,
      activeReturn: result.activeReturn,
      allocation: result.totalAllocation,
      selection: result.totalSelection,
      interaction: result.totalInteraction,
    });

    cumPortfolio += result.portfolioReturn;
    cumBenchmark += result.benchmarkReturn;
    cumAllocation += result.totalAllocation;
    cumSelection += result.totalSelection;
    cumInteraction += result.totalInteraction;
  }

  return {
    periods,
    cumulative: {
      portfolioReturn: round(cumPortfolio, 4),
      benchmarkReturn: round(cumBenchmark, 4),
      activeReturn: round(cumPortfolio - cumBenchmark, 4),
      allocation: round(cumAllocation, 4),
      selection: round(cumSelection, 4),
      interaction: round(cumInteraction, 4),
    },
  };
}

// ── Utility ────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
