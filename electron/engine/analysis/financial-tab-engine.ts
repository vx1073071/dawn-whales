// ── R267 JVS-2 财务Tab增强引擎 (FinancialTabEngine) ──
// 对标: 富途 财务Tab + 东方财富 F10
// 扩展 StockKLineDeep 12项→40+项: 营收/利润/现金流/估值/盈利能力/成长性/杜邦分析

export interface FinancialMetric {
  symbol: string;
  period: string;            // 'FY2024' | 'Q2 2024' | 'TTM'
  periodType: 'annual' | 'quarterly' | 'ttm';
  fiscalYear: number;
  fiscalQuarter?: number;
  reportDate: string;

  // 营收 & 利润
  revenue: number;
  revenueYoY: number;        // 同比 (fraction)
  revenueQoQ: number;        // 环比
  grossProfit: number;
  grossMargin: number;       // 毛利率
  operatingIncome: number;
  operatingMargin: number;   // 运营利润率
  netIncome: number;
  netMargin: number;         // 净利率
  eps: number;
  epsDiluted: number;

  // 资产负债表
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentAssets: number;
  currentLiabilities: number;
  currentRatio: number;      // 流动比率
  quickRatio: number;        // 速动比率
  debtToEquity: number;      // 资产负债率
  longTermDebt: number;
  cashEquivalents: number;
  bookValuePerShare: number;

  // 现金流
  operatingCashFlow: number;
  freeCashFlow: number;
  fcfYield: number;          // FCF / 市值
  capex: number;
  cashFlowPerShare: number;

  // 估值
  pe: number;                // 市盈率
  forwardPE: number;         // 远期PE
  pb: number;                // 市净率
  ps: number;                // 市销率
  pcf: number;               // 市现率
  peg: number;               // PEG
  evToEbitda: number;
  dividendYield: number;

  // 盈利能力
  roe: number;               // ROE
  roa: number;               // ROA
  roic: number;              // ROIC
  roce: number;              // ROCE

  // 成长性
  revenueCAGR3Y: number;     // 3年复合增长率
  epsCAGR3Y: number;
  revenueCAGR5Y: number;
  epsCAGR5Y: number;
}

export interface FinancialTrend {
  symbol: string;
  metric: string;            // 'revenue' | 'netIncome' | 'eps' | 'roe' ...
  periods: string[];         // ['FY2020', 'FY2021', ...]
  values: number[];
  /** Trend direction and slope */
  direction: 'up' | 'down' | 'flat';
  slope: number;             // average YoY change
  volatility: number;        // std dev of YoY changes
}

export interface DuponAnalysis {
  symbol: string;
  period: string;
  roe: number;
  /** Net Margin */
  netMargin: number;
  /** Asset Turnover */
  assetTurnover: number;
  /** Equity Multiplier (leverage) */
  equityMultiplier: number;
  /** Tax Burden (net income / pretax income) */
  taxBurden: number;
  /** Interest Burden (pretax income / EBIT) */
  interestBurden: number;
  /** EBIT Margin */
  ebitMargin: number;
  /** Extended 5-factor breakdown */
  breakdown: {
    label: string;
    value: number;
    contribution: 'positive' | 'negative' | 'neutral';
  }[];
}

export interface ValuationRanking {
  symbol: string;
  pe: number;
  pePercentile: number;     // percentile within sector
  pb: number;
  pbPercentile: number;
  ps: number;
  psPercentile: number;
  evToEbitda: number;
  evToEbitdaPercentile: number;
  /** Composite rank (lower = cheaper) */
  compositeRank: number;
  sector: string;
  peers: string[];          // peer symbols
}

export interface FinancialScore {
  symbol: string;
  date: string;
  /** 0-100 overall score */
  totalScore: number;
  /** Sub-scores */
  profitability: number;    // 盈利能力 0-25
  growth: number;           // 成长性 0-25
  financialHealth: number;  // 财务健康 0-25
  valuation: number;        // 估值合理性 0-25
  cashflow: number;         // 现金流 0-25 (adjusted to fit 0-100 total)
  /** Interpretation */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  highlights: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class FinancialTabEngine {
  /** Financial data store: symbol → metrics[] */
  private metrics: Map<string, FinancialMetric[]> = new Map();
  /** Peers mapping for valuation ranking */
  private peers: Map<string, string[]> = new Map();

  reset(): void {
    this.metrics.clear();
    this.peers.clear();
  }

  // ═══════════ Data Ingestion ═══════════

  /**
   * Load financial metrics for a symbol.
   */
  loadMetrics(symbol: string, data: FinancialMetric[]): void {
    const key = symbol.toUpperCase();
    this.metrics.set(key, [...data].sort((a, b) => b.fiscalYear - a.fiscalYear || a.fiscalQuarter || 0 - (b.fiscalQuarter || 0)));
  }

  /**
   * Register peer group for valuation comparison.
   */
  registerPeers(symbol: string, peers: string[]): void {
    this.peers.set(symbol.toUpperCase(), peers.map((p) => p.toUpperCase()));
  }

  // ═══════════ Single Metric Retrieval ═══════════

  getLatestMetrics(symbol: string): FinancialMetric | null {
    return this.metrics.get(symbol.toUpperCase())?.[0] || null;
  }

  getMetricsByPeriod(symbol: string, periodType: 'annual' | 'quarterly' | 'ttm'): FinancialMetric[] {
    return (this.metrics.get(symbol.toUpperCase()) || [])
      .filter((m) => m.periodType === periodType);
  }

  getMetricsByYear(symbol: string, year: number): FinancialMetric | null {
    return (this.metrics.get(symbol.toUpperCase()) || [])
      .find((m) => m.fiscalYear === year) || null;
  }

  // ═══════════ Trend Analysis ═══════════

  getTrend(symbol: string, metric: keyof FinancialMetric, minPeriods: number = 3): FinancialTrend | null {
    const data = this.metrics.get(symbol.toUpperCase());
    if (!data || data.length < minPeriods) return null;

    // Get annual data for clean trend
    const annual = data
      .filter((m) => m.periodType === 'annual')
      .sort((a, b) => a.fiscalYear - b.fiscalYear);

    if (annual.length < minPeriods) return null;

    const periods = annual.map((m) => `FY${m.fiscalYear}`);
    const values = annual.map((m) => {
      const val = m[metric as keyof FinancialMetric];
      return typeof val === 'number' ? val : 0;
    });

    // Linear regression slope
    const n = values.length;
    const xMean = periods.reduce((s, _, i) => s + i, 0) / n;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den > 0 ? num / den : 0;

    // YoY changes for volatility
    const changes: number[] = [];
    for (let i = 1; i < n; i++) {
      if (values[i - 1] !== 0) {
        changes.push((values[i] - values[i - 1]) / Math.abs(values[i - 1]));
      }
    }
    const changeMean = changes.length > 0 ? changes.reduce((s, v) => s + v, 0) / changes.length : 0;
    const volatility = changes.length > 0
      ? Math.sqrt(changes.reduce((s, v) => s + (v - changeMean) ** 2, 0) / changes.length)
      : 0;

    let direction: FinancialTrend['direction'] = 'flat';
    if (slope > values[0] * 0.02) direction = 'up';
    else if (slope < -values[0] * 0.02) direction = 'down';

    return {
      symbol: symbol.toUpperCase(),
      metric: String(metric),
      periods,
      values,
      direction,
      slope: Math.round(slope * 100) / 100,
      volatility: Math.round(volatility * 10000) / 10000,
    };
  }

  // ═══════════ Growth Calculations ═══════════

  getRevenueGrowth(symbol: string): { yoy: number; qoq: number; cagr3: number; cagr5: number } {
    const m = this.getLatestMetrics(symbol);
    if (!m) return { yoy: 0, qoq: 0, cagr3: 0, cagr5: 0 };

    return {
      yoy: Math.round(m.revenueYoY * 10000) / 10000,
      qoq: Math.round(m.revenueQoQ * 10000) / 10000,
      cagr3: Math.round(m.revenueCAGR3Y * 10000) / 10000,
      cagr5: Math.round(m.revenueCAGR5Y * 10000) / 10000,
    };
  }

  getEarningsGrowth(symbol: string): { yoy: number; cagr3: number; cagr5: number; surpriseRate: number } {
    const annual = this.getMetricsByPeriod(symbol, 'annual');
    // surprise rate: % of quarters where EPS beat prior year same quarter
    const quarterly = this.getMetricsByPeriod(symbol, 'quarterly');
    let beats = 0;
    const pairs = Math.min(quarterly.length, 8);
    for (let i = 0; i < pairs && i + 4 < quarterly.length; i++) {
      if (quarterly[i].eps > quarterly[i + 4].eps) beats++;
    }

    const surpriseRate = pairs > 0 ? beats / pairs : 0;
    const latest = this.getLatestMetrics(symbol);

    return {
      yoy: latest ? ((latest.epsDiluted || latest.eps) / (annual[0] ? annual[0].eps : 1) - 1) : 0,
      cagr3: latest?.epsCAGR3Y || 0,
      cagr5: latest?.epsCAGR5Y || 0,
      surpriseRate: Math.round(surpriseRate * 100) / 100,
    };
  }

  // ═══════════ DuPont Analysis ═══════════

  computeDuPont(symbol: string): DuponAnalysis | null {
    const m = this.getLatestMetrics(symbol);
    if (!m) return null;

    const netMargin = m.netMargin || (m.revenue > 0 ? m.netIncome / m.revenue : 0);
    const assetTurnover = m.totalAssets > 0 ? m.revenue / m.totalAssets : 0;
    const equityMultiplier = m.totalEquity > 0 ? m.totalAssets / m.totalEquity : 0;
    const roe = m.roe || netMargin * assetTurnover * equityMultiplier;

    // Extended 5-factor
    const taxBurden = m.netIncome > 0 && m.operatingIncome > 0 ? m.netIncome / m.operatingIncome : 1;
    const interestBurden = m.operatingIncome > 0 && m.revenue > 0
      ? m.operatingIncome / (m.operatingIncome + (m.longTermDebt * 0.05))
      : 1;
    const ebitMargin = m.operatingIncome > 0 && m.revenue > 0 ? m.operatingIncome / m.revenue : 0;

    const breakdown: DuponAnalysis['breakdown'] = [
      { label: '净利率 (Net Margin)', value: netMargin, contribution: netMargin > 0.15 ? 'positive' : netMargin < 0.05 ? 'negative' : 'neutral' },
      { label: '资产周转率 (Asset Turnover)', value: assetTurnover, contribution: assetTurnover > 0.8 ? 'positive' : assetTurnover < 0.3 ? 'negative' : 'neutral' },
      { label: '权益乘数 (Equity Multiplier)', value: equityMultiplier, contribution: equityMultiplier < 3 ? 'positive' : equityMultiplier > 5 ? 'negative' : 'neutral' },
      { label: '税负率 (Tax Burden)', value: taxBurden, contribution: taxBurden > 0.8 ? 'positive' : 'neutral' },
      { label: '利息负担 (Interest Burden)', value: interestBurden, contribution: interestBurden > 0.9 ? 'positive' : 'neutral' },
      { label: 'EBIT利润率', value: ebitMargin, contribution: ebitMargin > 0.2 ? 'positive' : 'neutral' },
    ];

    return {
      symbol: symbol.toUpperCase(),
      period: m.period,
      roe: Math.round(roe * 10000) / 10000,
      netMargin: Math.round(netMargin * 10000) / 10000,
      assetTurnover: Math.round(assetTurnover * 10000) / 10000,
      equityMultiplier: Math.round(equityMultiplier * 10000) / 10000,
      taxBurden: Math.round(taxBurden * 10000) / 10000,
      interestBurden: Math.round(interestBurden * 10000) / 10000,
      ebitMargin: Math.round(ebitMargin * 10000) / 10000,
      breakdown,
    };
  }

  // ═══════════ Valuation Ranking ═══════════

  computeValuationRanking(symbol: string): ValuationRanking | null {
    const m = this.getLatestMetrics(symbol);
    if (!m) return null;

    const peerSymbols = this.peers.get(symbol.toUpperCase()) || [];
    const allSymbols = [symbol.toUpperCase(), ...peerSymbols];
    const allMetrics: (FinancialMetric | null)[] = allSymbols.map((s) => this.getLatestMetrics(s));

    // Collect PE, PB, PS, EV/EBITDA for all peers
    const peValues = allMetrics.map((fm) => fm?.pe || 0).filter((v) => v > 0).sort((a, b) => a - b);
    const pbValues = allMetrics.map((fm) => fm?.pb || 0).filter((v) => v > 0).sort((a, b) => a - b);
    const psValues = allMetrics.map((fm) => fm?.ps || 0).filter((v) => v > 0).sort((a, b) => a - b);
    const evValues = allMetrics.map((fm) => fm?.evToEbitda || 0).filter((v) => v > 0).sort((a, b) => a - b);

    const pePct = this.percentileRank(peValues, m.pe);
    const pbPct = this.percentileRank(pbValues, m.pb);
    const psPct = this.percentileRank(psValues, m.ps);
    const evPct = this.percentileRank(evValues, m.evToEbitda);

    const compositeRank = Math.round((pePct + pbPct + psPct + evPct) / 4);

    return {
      symbol: symbol.toUpperCase(),
      pe: m.pe,
      pePercentile: pePct,
      pb: m.pb,
      pbPercentile: pbPct,
      ps: m.ps,
      psPercentile: psPct,
      evToEbitda: m.evToEbitda,
      evToEbitdaPercentile: evPct,
      compositeRank,
      sector: 'General', // can be extended with sector registration
      peers: peerSymbols,
    };
  }

  private percentileRank(sorted: number[], value: number): number {
    if (sorted.length === 0 || value <= 0) return 50;
    const rank = sorted.findIndex((v) => v >= value);
    return Math.round(((rank >= 0 ? rank : sorted.length) / sorted.length) * 100);
  }

  // ═══════════ Financial Health Check ═══════════

  /**
   * Comprehensive financial health check with 5-pillar scoring.
   */
  scoreFinancialHealth(symbol: string): FinancialScore {
    const m = this.getLatestMetrics(symbol);
    if (!m) {
      return {
        symbol: symbol.toUpperCase(),
        date: '',
        totalScore: 0,
        profitability: 0, growth: 0, financialHealth: 0, valuation: 0, cashflow: 0,
        grade: 'F',
        highlights: [],
        warnings: ['无法获取财务数据'],
      };
    }

    // 1. Profitability (0-25)
    let profitability = 0;
    const highlights: string[] = [];
    const warnings: string[] = [];

    if (m.netMargin > 0.20) profitability += 10;
    else if (m.netMargin > 0.10) profitability += 7;
    else if (m.netMargin > 0.05) profitability += 3;
    else if (m.netMargin < 0) profitability += 0;

    if (m.roe > 0.20) profitability += 8;
    else if (m.roe > 0.10) profitability += 5;
    else if (m.roe > 0) profitability += 2;

    if (m.roic > 0.15) profitability += 7;
    else if (m.roic > 0.08) profitability += 4;
    else if (m.roic > 0) profitability += 2;

    profitability = Math.min(25, profitability);
    if (profitability >= 20) highlights.push('盈利能力优秀');
    else if (profitability < 8) warnings.push('盈利能力偏弱');

    // 2. Growth (0-25)
    let growth = 0;
    if (m.revenueYoY > 0.30) growth += 8;
    else if (m.revenueYoY > 0.15) growth += 5;
    else if (m.revenueYoY > 0.05) growth += 3;
    else if (m.revenueYoY < 0) growth += 0;

    if (m.revenueCAGR3Y > 0.25) growth += 9;
    else if (m.revenueCAGR3Y > 0.15) growth += 6;
    else if (m.revenueCAGR3Y > 0.05) growth += 3;

    if (m.epsCAGR3Y > 0.20) growth += 8;
    else if (m.epsCAGR3Y > 0.10) growth += 5;
    else if (m.epsCAGR3Y > 0) growth += 2;

    growth = Math.min(25, growth);
    if (growth >= 18) highlights.push('营收/利润高速增长');
    else if (growth < 6 && m.revenueYoY < 0) warnings.push('营收下滑需警惕');

    // 3. Financial Health (0-25)
    let financialHealth = 0;
    if (m.currentRatio > 2) financialHealth += 5;
    else if (m.currentRatio > 1.5) financialHealth += 3;
    else if (m.currentRatio < 1) financialHealth += 0;

    if (m.quickRatio > 1.5) financialHealth += 5;
    else if (m.quickRatio > 1) financialHealth += 3;

    if (m.debtToEquity < 0.5) financialHealth += 8;
    else if (m.debtToEquity < 1) financialHealth += 4;
    else if (m.debtToEquity < 2) financialHealth += 1;

    if (m.cashEquivalents > m.longTermDebt) financialHealth += 7;
    else if (m.cashEquivalents > m.longTermDebt * 0.5) financialHealth += 3;

    financialHealth = Math.min(25, financialHealth);
    if (financialHealth >= 20) highlights.push('资产负债表稳健');
    else if (financialHealth < 10 && m.debtToEquity > 1) warnings.push('负债水平偏高');

    // 4. Valuation (0-25)
    let valuation = 0;
    if (m.pe > 0 && m.pe < 15) valuation += 8;
    else if (m.pe < 20) valuation += 5;
    else if (m.pe < 30) valuation += 2;

    if (m.pb > 0 && m.pb < 2) valuation += 5;
    else if (m.pb < 4) valuation += 3;

    if (m.peg > 0 && m.peg < 1) valuation += 7;
    else if (m.peg < 1.5) valuation += 4;

    if (m.evToEbitda > 0 && m.evToEbitda < 10) valuation += 5;
    else if (m.evToEbitda < 15) valuation += 2;

    valuation = Math.min(25, valuation);
    if (valuation >= 18) highlights.push('估值合理偏低');
    else if (valuation < 6) warnings.push('估值偏高');

    // 5. Cashflow (0-25) — adjusted to fit final total
    let cashflow = 0;
    if (m.freeCashFlow > 0) {
      cashflow += 10;
      if (m.fcfYield > 0.05) cashflow += 8;
      else if (m.fcfYield > 0.03) cashflow += 4;
      if (m.operatingCashFlow > m.netIncome) cashflow += 7;
    } else {
      cashflow += 0;
    }
    cashflow = Math.min(25, cashflow);
    if (cashflow >= 15) highlights.push('自由现金流充裕');

    // Total score (scale cashflow proportionally into 100)
    const totalScore = Math.min(100, profitability + growth + financialHealth + valuation + cashflow);

    let grade: FinancialScore['grade'] = 'F';
    if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 50) grade = 'C';
    else if (totalScore >= 30) grade = 'D';

    return {
      symbol: symbol.toUpperCase(),
      date: m.reportDate || m.period,
      totalScore: Math.round(totalScore),
      profitability: Math.round(profitability),
      growth: Math.round(growth),
      financialHealth: Math.round(financialHealth),
      valuation: Math.round(valuation),
      cashflow: Math.round(cashflow),
      grade,
      highlights,
      warnings,
    };
  }

  // ═══════════ Quick Summary (for StockDetailPage) ═══════════

  getQuickSummary(symbol: string): Record<string, number | string> {
    const m = this.getLatestMetrics(symbol);
    if (!m) return {};

    return {
      marketCap: m.totalEquity * (m.pb || 1), // rough
      pe: m.pe,
      forwardPE: m.forwardPE,
      pb: m.pb,
      revenue: m.revenue,
      revenueYoY: Math.round(m.revenueYoY * 10000) / 100,
      netIncome: m.netIncome,
      netMargin: Math.round(m.netMargin * 10000) / 100,
      roe: Math.round(m.roe * 10000) / 100,
      roic: Math.round(m.roic * 10000) / 100,
      eps: m.eps,
      epsCAGR3Y: Math.round(m.epsCAGR3Y * 10000) / 100,
      dividendYield: Math.round(m.dividendYield * 10000) / 100,
      debtToEquity: Math.round(m.debtToEquity * 10000) / 100,
      currentRatio: Math.round(m.currentRatio * 100) / 100,
      fcfYield: Math.round(m.fcfYield * 10000) / 100,
      peg: Math.round(m.peg * 100) / 100,
      evToEbitda: Math.round(m.evToEbitda * 100) / 100,
    };
  }
}

// ═══════════ Singleton ═══════════

let ftInstance: FinancialTabEngine | null = null;

export function getFinancialTabEngine(): FinancialTabEngine {
  if (!ftInstance) ftInstance = new FinancialTabEngine();
  return ftInstance;
}

export function resetFinancialTabEngine(): void {
  ftInstance = null;
}
