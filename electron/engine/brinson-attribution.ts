// ── Brinson Attribution (JVS-54) ────────────────────────────────────────────
// Brinson-Fachler performance attribution model
// Decomposes portfolio returns into: allocation effect + selection effect + interaction effect
// IPC: report:brinson-attribution

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SectorHolding {
  code: string;
  name: string;
  sector: string;
  weight: number;          // Portfolio weight (0-1)
  returnPct: number;       // Return %
}

export interface SectorBenchmark {
  sector: string;
  weight: number;          // Benchmark weight (0-1)
  returnPct: number;       // Benchmark return %
}

export interface SectorAttribution {
  sector: string;
  // Weights
  portfolioWeight: number;
  benchmarkWeight: number;
  activeWeight: number;    // Portfolio - Benchmark
  // Returns
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;    // Portfolio - Benchmark
  // Brinson effects
  allocationEffect: number;   // (Wp - Wb) * (Rb_sector - Rb_total)
  selectionEffect: number;    // Wb * (Rp_sector - Rb_sector)
  interactionEffect: number;  // (Wp - Wb) * (Rp_sector - Rb_sector)
  totalEffect: number;        // Sum of all three
}

export interface BrinsonReport {
  success: boolean;
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
  summary: {
    totalSectors: number;
    topContributor: string;
    topDetractor: string;
    allocationContribution: number;    // % of active return from allocation
    selectionContribution: number;   // % of active return from selection
    interactionContribution: number; // % of active return from interaction
  };
  // Recommendations
  recommendations: string[];
  timestamp: number;
  error?: string;
}

// ── Main Function ──────────────────────────────────────────────────────────

export function generateBrinsonReport(
  portfolioHoldings: SectorHolding[],
  benchmarkSectors: SectorBenchmark[],
  benchmarkTotalReturn: number
): BrinsonReport {
  if (!portfolioHoldings || !benchmarkSectors || benchmarkSectors.length === 0) {
    return {
      success: false,
      portfolioReturn: 0,
      benchmarkReturn: 0,
      activeReturn: 0,
      totalAllocation: 0,
      totalSelection: 0,
      totalInteraction: 0,
      sectors: [],
      summary: {
        totalSectors: 0,
        topContributor: '',
        topDetractor: '',
        allocationContribution: 0,
        selectionContribution: 0,
        interactionContribution: 0,
      },
      recommendations: [],
      timestamp: Date.now(),
      error: 'Invalid input',
    };
  }

  log.info(`[BrinsonAttribution] Generating report for ${portfolioHoldings.length} holdings vs ${benchmarkSectors.length} benchmark sectors`);

  // Build sector maps
  const portfolioBySector = new Map<string, { weight: number; returnPct: number }>();
  for (const h of portfolioHoldings) {
    const existing = portfolioBySector.get(h.sector);
    if (existing) {
      // Aggregate holdings in same sector
      const totalWeight = existing.weight + h.weight;
      const weightedReturn = (existing.weight * existing.returnPct + h.weight * h.returnPct) / totalWeight;
      portfolioBySector.set(h.sector, { weight: totalWeight, returnPct: weightedReturn });
    } else {
      portfolioBySector.set(h.sector, { weight: h.weight, returnPct: h.returnPct });
    }
  }

  const benchmarkBySector = new Map<string, SectorBenchmark>();
  for (const b of benchmarkSectors) {
    benchmarkBySector.set(b.sector, b);
  }

  // Get all unique sectors
  const allSectors = new Set<string>([
    ...Array.from(portfolioBySector.keys()),
    ...Array.from(benchmarkBySector.keys()),
  ]);

  // Calculate portfolio total return
  const portfolioReturn = portfolioHoldings.reduce((sum, h) => sum + h.weight * h.returnPct, 0);

  // Calculate benchmark total return (use provided or calculate)
  const benchmarkReturn = benchmarkTotalReturn || benchmarkSectors.reduce((sum, b) => sum + b.weight * b.returnPct, 0);

  // Per-sector attribution
  const sectors: SectorAttribution[] = [];

  for (const sector of allSectors) {
    const portfolio = portfolioBySector.get(sector) || { weight: 0, returnPct: 0 };
    const benchmark = benchmarkBySector.get(sector) || { sector, weight: 0, returnPct: 0 };

    const Wp = portfolio.weight;
    const Wb = benchmark.weight;
    const Rp = portfolio.returnPct;
    const Rb = benchmark.returnPct;

    const activeWeight = Wp - Wb;
    const activeReturn = Rp - Rb;

    // Brinson-Fachler decomposition
    const allocationEffect = activeWeight * (Rb - benchmarkReturn);
    const selectionEffect = Wb * (Rp - Rb);
    const interactionEffect = activeWeight * (Rp - Rb);
    const totalEffect = allocationEffect + selectionEffect + interactionEffect;

    sectors.push({
      sector,
      portfolioWeight: Wp,
      benchmarkWeight: Wb,
      activeWeight,
      portfolioReturn: Rp,
      benchmarkReturn: Rb,
      activeReturn,
      allocationEffect,
      selectionEffect,
      interactionEffect,
      totalEffect,
    });
  }

  // Sort by total effect (descending)
  sectors.sort((a, b) => b.totalEffect - a.totalEffect);

  // Aggregate effects
  const totalAllocation = sectors.reduce((sum, s) => sum + s.allocationEffect, 0);
  const totalSelection = sectors.reduce((sum, s) => sum + s.selectionEffect, 0);
  const totalInteraction = sectors.reduce((sum, s) => sum + s.interactionEffect, 0);
  const activeReturn = portfolioReturn - benchmarkReturn;

  // Calculate contribution percentages
  const absActiveReturn = Math.abs(activeReturn);
  const allocationContribution = absActiveReturn > 0 ? (totalAllocation / absActiveReturn) * 100 : 0;
  const selectionContribution = absActiveReturn > 0 ? (totalSelection / absActiveReturn) * 100 : 0;
  const interactionContribution = absActiveReturn > 0 ? (totalInteraction / absActiveReturn) * 100 : 0;

  const topContributor = sectors.length > 0 ? sectors[0].sector : '';
  const topDetractor = sectors.length > 0 ? sectors[sectors.length - 1].sector : '';

  const summary = {
    totalSectors: sectors.length,
    topContributor,
    topDetractor,
    allocationContribution: Math.round(allocationContribution * 100) / 100,
    selectionContribution: Math.round(selectionContribution * 100) / 100,
    interactionContribution: Math.round(interactionContribution * 100) / 100,
  };

  // Generate recommendations
  const recommendations: string[] = [];

  if (Math.abs(totalAllocation) > Math.abs(totalSelection)) {
    recommendations.push(`配置效应主导业绩 (${summary.allocationContribution.toFixed(1)}%)，建议优化板块配置。`);
  } else {
    recommendations.push(`选股效应主导业绩 (${summary.selectionContribution.toFixed(1)}%)，选股能力较强。`);
  }

  if (topContributor) {
    recommendations.push(`最大贡献板块: ${topContributor}，考虑保持或增加配置。`);
  }

  if (topDetractor) {
    recommendations.push(`最大拖累板块: ${topDetractor}，考虑减仓或替换持仓。`);
  }

  if (Math.abs(activeReturn) < 0.5) {
    recommendations.push(`超额收益仅 ${activeReturn.toFixed(2)}%，接近基准，可考虑增加主动管理。`);
  }

  const result: BrinsonReport = {
    success: true,
    portfolioReturn: Math.round(portfolioReturn * 100) / 100,
    benchmarkReturn: Math.round(benchmarkReturn * 100) / 100,
    activeReturn: Math.round(activeReturn * 100) / 100,
    totalAllocation: Math.round(totalAllocation * 100) / 100,
    totalSelection: Math.round(totalSelection * 100) / 100,
    totalInteraction: Math.round(totalInteraction * 100) / 100,
    sectors,
    summary,
    recommendations,
    timestamp: Date.now(),
  };

  log.info(`[BrinsonAttribution] Done: ${sectors.length} sectors, active return ${activeReturn.toFixed(2)}%, allocation ${summary.allocationContribution.toFixed(1)}%, selection ${summary.selectionContribution.toFixed(1)}%`);

  return result;
}

// ── Batch Report ───────────────────────────────────────────────────────────

export async function generateBatchBrinsonReport(
  portfolios: { name: string; holdings: SectorHolding[]; benchmark: SectorBenchmark[]; benchmarkReturn: number }[]
): Promise<{ name: string; report: BrinsonReport }[]> {
  log.info(`[BrinsonAttribution] Batch report for ${portfolios.length} portfolios`);

  const results: { name: string; report: BrinsonReport }[] = [];
  for (const p of portfolios) {
    results.push({
      name: p.name,
      report: generateBrinsonReport(p.holdings, p.benchmark, p.benchmarkReturn),
    });
  }

  // Sort by active return (descending)
  results.sort((a, b) => b.report.activeReturn - a.report.activeReturn);

  return results;
}
