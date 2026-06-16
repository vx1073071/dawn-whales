/**
 * R249 P2-26: 因子可视化数据引擎 (FactorVisualizationDataEngine)
 * 
 * 为前端因子可视化提供所有数据管道:
 *   - IC时间序列 (rolling IC charts)
 *   - 累计收益曲线 (cumulative return curves)
 *   - 因子相关性矩阵 (correlation matrix)
 *   - 因子排名数据 (ranking by IC/sharpe/return)
 *   - 热力图数据 (heatmap: domain × metric)
 *   - 分布数据 (factor value distribution by market)
 *   - 分组对比数据 (group comparison violin/bar chart)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ICTimeSeries {
  factorId: string;
  factorName: string;
  factorNameCn: string;
  domain: string;
  series: Array<{ date: string; ic: number; rankIC: number }>;
  summary: { meanIC: number; stdIC: number; ir: number; tStat: number; recentTrend: 'up' | 'down' | 'flat' };
}

export interface CumulativeReturnCurve {
  factorId: string;
  factorName: string;
  factorNameCn: string;
  benchmark: string;
  series: Array<{ date: string; factorReturn: number; benchmarkReturn: number; excessReturn: number }>;
  summary: { totalReturn: number; benchmarkReturn: number; excess: number; cagr: number; trackingError: number };
}

export interface CorrelationMatrix {
  factors: string[];
  labels: string[];
  labelsCn: string[];
  matrix: number[][];              // N×N correlation values
  clusters: Array<{ name: string; nameCn: string; factorIds: string[] }>;
  overallAvg: number;
}

export interface FactorRanking {
  dimension: 'ic' | 'sharpe' | 'return' | 'drawdown' | 'winRate' | 'turnover';
  rankings: Array<{
    rank: number;
    factorId: string;
    name: string;
    nameCn: string;
    domain: string;
    value: number;
    prevRank: number;
    change: number;
  }>;
  updatedAt: number;
}

export interface HeatmapData {
  domains: string[];
  metrics: string[];
  metricLabels: string[];
  metricLabelsCn: string[];
  data: number[][];                 // domains × metrics
  colorRange: { min: number; max: number };
}

export interface DistributionData {
  factorId: string;
  factorName: string;
  factorNameCn: string;
  market: string;
  histogram: Array<{ binStart: number; binEnd: number; count: number }>;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  stats: { mean: number; std: number; skewness: number; kurtosis: number; n: number };
}

export interface GroupComparison {
  title: string;
  titleCn: string;
  groups: string[];
  groupLabels: string[];
  groupLabelsCn: string[];
  metric: string;
  metricLabel: string;
  metricLabelCn: string;
  data: Array<{ group: string; min: number; q1: number; median: number; q3: number; max: number; mean: number; points: number[] }>;
}

export interface DashboardSnapshot {
  topFactors: FactorRanking;
  heatmap: HeatmapData;
  correlation: CorrelationMatrix;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// FactorVisualizationDataEngine
// ═══════════════════════════════════════════════════════════════════════════

export class FactorVisualizationDataEngine {
  // Factor registry for reference
  private factorRegistry: Map<string, { id: string; name: string; nameCn: string; domain: string }> = new Map();

  constructor() {
    this._seedRegistry();
  }

  // ── Public API: IC Time Series ────────────────────────────────────────

  /**
   * Generate rolling IC time series for a factor.
   * Simulates 252 trading days of IC data.
   */
  getICTimeSeries(factorId: string, periodDays = 252): ICTimeSeries | null {
    const meta = this.factorRegistry.get(factorId);
    if (!meta) return null;

    const seed = this._hash(factorId);
    const series: ICTimeSeries['series'] = [];
    let baseIC = (seed % 100) / 1000 + 0.02; // 2-12% base IC

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    for (let i = 0; i < periodDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

      const noise = ((seed + i * 7) % 1000 - 500) / 10000; // -0.05 to +0.05
      const ic = Math.round((baseIC + noise) * 10000) / 10000;
      const rankIC = Math.round((ic + ((seed + i * 11) % 100 - 50) / 10000) * 10000) / 10000;

      series.push({
        date: date.toISOString().slice(0, 10),
        ic,
        rankIC,
      });
    }

    const ics = series.map(s => s.ic);
    const meanIC = ics.reduce((s, v) => s + v, 0) / ics.length;
    const variance = ics.reduce((s, v) => s + (v - meanIC) ** 2, 0) / ics.length;
    const stdIC = Math.sqrt(variance);
    const ir = stdIC > 0 ? meanIC / stdIC : 0;
    const tStat = ir * Math.sqrt(ics.length);

    const recentIC = series.slice(-20).reduce((s, s_) => s_ + s_.ic, 0) / 20;
    const olderIC = series.slice(-40, -20).reduce((s, s_) => s_ + s_.ic, 0) / 20;
    const recentTrend: ICTimeSeries['summary']['recentTrend'] =
      recentIC > olderIC + 0.005 ? 'up' : recentIC < olderIC - 0.005 ? 'down' : 'flat';

    return {
      factorId, factorName: meta.name, factorNameCn: meta.nameCn, domain: meta.domain,
      series,
      summary: { meanIC: Math.round(meanIC * 10000) / 10000, stdIC: Math.round(stdIC * 10000) / 10000, ir: Math.round(ir * 100) / 100, tStat: Math.round(tStat * 100) / 100, recentTrend },
    };
  }

  // ── Public API: Cumulative Return ──────────────────────────────────────

  /**
   * Generate cumulative return curve for a factor vs benchmark.
   */
  getCumulativeReturn(factorId: string, symbol = 'SPY', periods = 252): CumulativeReturnCurve | null {
    const meta = this.factorRegistry.get(factorId);
    if (!meta) return null;

    const seed = this._hash(factorId + symbol);
    const series: CumulativeReturnCurve['series'] = [];
    let factorCum = 1, benchCum = 1;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periods);

    for (let i = 0; i < periods; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const fRet = ((seed + i * 13) % 100 - 40) / 1000; // -4% to +6%
      const bRet = ((seed + i * 7) % 60 - 25) / 1000;    // -2.5% to +3.5%

      factorCum *= 1 + fRet;
      benchCum *= 1 + bRet;

      series.push({
        date: date.toISOString().slice(0, 10),
        factorReturn: Math.round(factorCum * 10000) / 10000,
        benchmarkReturn: Math.round(benchCum * 10000) / 10000,
        excessReturn: Math.round((factorCum - benchCum) * 10000) / 10000,
      });
    }

    const last = series[series.length - 1];
    const totalReturn = Math.round((factorCum - 1) * 10000) / 100;
    const benchReturn = Math.round((benchCum - 1) * 10000) / 100;
    const cagr = (periods / 252) > 0
      ? Math.round((Math.pow(factorCum, 252 / periods) - 1) * 10000) / 100
      : 0;

    // Tracking error
    const excessReturns = series.map(s => s.excessReturn - (last ? last.excessReturn / periods : 0));
    const trackingError = Math.sqrt(excessReturns.reduce((s, v) => s + v ** 2, 0) / excessReturns.length);

    return {
      factorId, factorName: meta.name, factorNameCn: meta.nameCn,
      benchmark: symbol,
      series,
      summary: {
        totalReturn, benchmarkReturn: benchReturn,
        excess: Math.round((totalReturn - benchReturn) * 100) / 100,
        cagr, trackingError: Math.round(trackingError * 100) / 100,
      },
    };
  }

  // ── Public API: Correlation Matrix ─────────────────────────────────────

  /**
   * Build factor correlation matrix for a set of factors.
   */
  buildCorrelationMatrix(factorIds: string[]): CorrelationMatrix {
    const n = factorIds.length;
    const labels = factorIds.map(id => this.factorRegistry.get(id)?.name ?? id);
    const labelsCn = factorIds.map(id => this.factorRegistry.get(id)?.nameCn ?? id);

    const matrix: number[][] = [];
    let totalCorr = 0, count = 0;

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i];
        } else {
          const seedI = this._hash(factorIds[i]);
          const seedJ = this._hash(factorIds[j]);
          // Factors from same domain have higher correlation
          const domainI = this.factorRegistry.get(factorIds[i])?.domain;
          const domainJ = this.factorRegistry.get(factorIds[j])?.domain;
          const base = domainI === domainJ ? 0.4 : 0.05;
          const corr = Math.round((base + ((seedI + seedJ) % 100) / 200) * 100) / 100;
          matrix[i][j] = corr;
          totalCorr += corr;
          count++;
        }
      }
    }

    // Simple clustering: group by domain
    const domainGroups = new Map<string, string[]>();
    for (const fid of factorIds) {
      const meta = this.factorRegistry.get(fid);
      const domain = meta?.domain ?? 'other';
      if (!domainGroups.has(domain)) domainGroups.set(domain, []);
      domainGroups.get(domain)!.push(fid);
    }

    const clusters = Array.from(domainGroups.entries()).map(([domain, fids]) => ({
      name: domain, nameCn: domain,
      factorIds: fids,
    }));

    return {
      factors: factorIds, labels, labelsCn, matrix,
      clusters,
      overallAvg: count > 0 ? Math.round(totalCorr / count * 100) / 100 : 0,
    };
  }

  // ── Public API: Factor Ranking ─────────────────────────────────────────

  /**
   * Get factor rankings by a given dimension.
   */
  getRankings(
    dimension: FactorRanking['dimension'] = 'ic',
    market?: string,
  ): FactorRanking {
    const allFactors = Array.from(this.factorRegistry.values());

    const rankings = allFactors.map((meta, idx) => {
      const seed = this._hash(meta.id + dimension + (market ?? 'all'));
      let value: number;

      switch (dimension) {
        case 'ic': value = (seed % 100) / 1000 + 0.02; break; // 0.02-0.12
        case 'sharpe': value = (seed % 150) / 100 + 0.3; break; // 0.3-1.8
        case 'return': value = (seed % 200) / 1000 + 0.05; break; // 5-25%
        case 'drawdown': value = -((seed % 300) / 1000 + 0.05); break; // -5% to -35%
        case 'winRate': value = (seed % 300) / 1000 + 0.4; break; // 40-70%
        case 'turnover': value = (seed % 80) / 100 + 0.2; break; // 20-100%
        default: value = 0;
      }

      return {
        factorId: meta.id, name: meta.name, nameCn: meta.nameCn, domain: meta.domain,
        value: Math.round(value * 1000) / 1000,
        rank: 0,
        prevRank: Math.max(1, idx - (seed % 5) + 2),
        change: 0,
      };
    });

    // Sort (higher = better for all except drawdown/turnover)
    const ascending = dimension === 'drawdown' || dimension === 'turnover';
    rankings.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

    rankings.forEach((r, i) => {
      r.rank = i + 1;
      r.change = r.prevRank - r.rank;
    });

    return { dimension, rankings, updatedAt: Date.now() };
  }

  // ── Public API: Heatmap ────────────────────────────────────────────────

  /**
   * Generate heatmap data: domains × metrics grid.
   */
  getHeatmap(options?: { domains?: string[]; metrics?: string[] }): HeatmapData {
    const allDomains = new Set<string>();
    for (const meta of this.factorRegistry.values()) allDomains.add(meta.domain);

    const domains = options?.domains ?? Array.from(allDomains).sort();
    const metrics = options?.metrics ?? ['ic', 'sharpe', 'return', 'drawdown', 'winRate', 'turnover', 'ir'];
    const metricLabels = ['IC', 'Sharpe', 'Return', 'Drawdown', 'Win Rate', 'Turnover', 'IR'];
    const metricLabelsCn = ['信息系数', '夏普比率', '收益率', '最大回撤', '胜率', '换手率', '信息比率'];

    const data: number[][] = [];
    let min = Infinity, max = -Infinity;

    for (const domain of domains) {
      const row: number[] = [];
      // Aggregate all factors in this domain
      const domainFactors = Array.from(this.factorRegistry.values()).filter(m => m.domain === domain);

      for (const metric of metrics) {
        let val: number;
        if (domainFactors.length === 0) {
          val = 0;
        } else {
          const seed = this._hash(`${domain}:${metric}`);
          switch (metric) {
            case 'ic': val = (seed % 100) / 1000 + 0.02; break;
            case 'sharpe': val = (seed % 150) / 100 + 0.3; break;
            case 'return': val = (seed % 200) / 1000 + 0.05; break;
            case 'drawdown': val = -((seed % 300) / 1000 + 0.05); break;
            case 'winRate': val = (seed % 300) / 1000 + 0.4; break;
            case 'turnover': val = (seed % 80) / 100 + 0.2; break;
            case 'ir': val = (seed % 120) / 100; break;
            default: val = 0;
          }
        }

        const rounded = Math.round(val * 1000) / 1000;
        row.push(rounded);
        if (rounded < min) min = rounded;
        if (rounded > max) max = rounded;
      }

      data.push(row);
    }

    return { domains, metrics, metricLabels, metricLabelsCn, data, colorRange: { min, max } };
  }

  // ── Public API: Distribution ────────────────────────────────────────────

  /**
   * Generate factor value distribution data for a market.
   */
  getDistribution(factorId: string, market = 'US', bins = 20): DistributionData | null {
    const meta = this.factorRegistry.get(factorId);
    if (!meta) return null;

    const seed = this._hash(factorId + market);
    const n = 500; // 500 stocks

    // Generate synthetic factor values (normal-ish distribution)
    const values: number[] = [];
    let sum = 0, sumSq = 0;

    for (let i = 0; i < n; i++) {
      // Box-Muller-like approximation
      const u1 = ((seed + i * 17) % 1001) / 1000;
      const u2 = ((seed + i * 31) % 1001) / 1000;
      const z = Math.sqrt(-2 * Math.log(u1 + 0.001)) * Math.cos(2 * Math.PI * u2);
      const val = seed % 100 / 1000 + z * (seed % 100) / 1000;
      values.push(val);
      sum += val;
      sumSq += val * val;
    }

    values.sort((a, b) => a - b);
    const mean = sum / n;
    const std = Math.sqrt(sumSq / n - mean * mean);

    // Histogram
    const minVal = values[0], maxVal = values[n - 1];
    const binWidth = (maxVal - minVal) / bins;
    const histogram: DistributionData['histogram'] = [];

    for (let b = 0; b < bins; b++) {
      const binStart = minVal + b * binWidth;
      const binEnd = binStart + binWidth;
      const count = values.filter(v => v >= binStart && (b === bins - 1 ? v <= binEnd : v < binEnd)).length;
      histogram.push({ binStart: Math.round(binStart * 10000) / 10000, binEnd: Math.round(binEnd * 10000) / 10000, count });
    }

    // Percentiles
    function pct(p: number) { return values[Math.floor(p * n)]; }
    const percentiles = { p5: pct(0.05), p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), p95: pct(0.95) };

    // Skewness & kurtosis
    const skew = values.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n;
    const kurt = values.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / n;

    return {
      factorId, factorName: meta.name, factorNameCn: meta.nameCn, market,
      histogram,
      percentiles,
      stats: {
        mean: Math.round(mean * 10000) / 10000,
        std: Math.round(std * 10000) / 10000,
        skewness: Math.round(skew * 1000) / 1000,
        kurtosis: Math.round(kurt * 100) / 100,
        n,
      },
    };
  }

  // ── Public API: Group Comparison ────────────────────────────────────────

  /**
   * Compare factor metrics across domains (violin/box plot data).
   */
  compareDomains(metric: string, domains?: string[]): GroupComparison {
    const domainList = domains ?? Array.from(new Set(Array.from(this.factorRegistry.values()).map(m => m.domain))).sort();
    const metricLabels: Record<string, { label: string; labelCn: string }> = {
      ic: { label: 'IC', labelCn: '信息系数' },
      sharpe: { label: 'Sharpe Ratio', labelCn: '夏普比率' },
      return: { label: 'Annual Return', labelCn: '年化收益' },
      drawdown: { label: 'Max Drawdown', labelCn: '最大回撤' },
      winRate: { label: 'Win Rate', labelCn: '胜率' },
    };
    const ml = metricLabels[metric] ?? { label: metric, labelCn: metric };

    const data = domainList.map(domain => {
      const factors = Array.from(this.factorRegistry.values()).filter(m => m.domain === domain);
      const n = Math.max(factors.length, 3);
      const points: number[] = [];

      for (let i = 0; i < n * 20; i++) {
        const seed = this._hash(`${domain}:${metric}:${i}`);
        let val: number;
        switch (metric) {
          case 'ic': val = (seed % 100) / 1000 + 0.01; break;
          case 'sharpe': val = (seed % 150) / 100 + 0.2; break;
          case 'return': val = (seed % 250) / 1000 + 0.03; break;
          case 'drawdown': val = -((seed % 350) / 1000); break;
          case 'winRate': val = (seed % 300) / 1000 + 0.35; break;
          default: val = 0;
        }
        points.push(Math.round(val * 1000) / 1000);
      }

      points.sort((a, b) => a - b);
      const mean = points.reduce((s, v) => s + v, 0) / points.length;
      const p25 = points[Math.floor(points.length * 0.25)];
      const median = points[Math.floor(points.length * 0.5)];
      const p75 = points[Math.floor(points.length * 0.75)];

      return {
        group: domain,
        min: points[0], q1: p25, median, q3: p75, max: points[points.length - 1],
        mean: Math.round(mean * 1000) / 1000,
        points,
      };
    });

    return {
      title: `Factor ${ml.label} by Domain`,
      titleCn: `按大类的因子${ml.labelCn}对比`,
      groups: domainList,
      groupLabels: domainList,
      groupLabelsCn: domainList,
      metric, metricLabel: ml.label, metricLabelCn: ml.labelCn,
      data,
    };
  }

  // ── Public API: Dashboard Snapshot ──────────────────────────────────────

  /**
   * Generate a full dashboard snapshot for a quick overview.
   */
  getDashboardSnapshot(): DashboardSnapshot {
    return {
      topFactors: this.getRankings('ic'),
      heatmap: this.getHeatmap(),
      correlation: this.buildCorrelationMatrix(Array.from(this.factorRegistry.keys()).slice(0, 15)),
      timestamp: Date.now(),
    };
  }

  /** Reset */
  reset(): void {
    this.factorRegistry.clear();
    this._seedRegistry();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _seedRegistry(): void {
    const factors: Array<{ id: string; name: string; nameCn: string; domain: string }> = [
      { id: 'MOMENTUM_12M', name: '12M Momentum', nameCn: '12月动量', domain: 'momentum' },
      { id: 'MOMENTUM_3M', name: '3M Momentum', nameCn: '3月动量', domain: 'momentum' },
      { id: 'MOMENTUM_1M', name: '1M Momentum', nameCn: '1月动量', domain: 'momentum' },
      { id: 'VALUE_EARNINGS_YIELD', name: 'Earnings Yield', nameCn: '盈利收益率', domain: 'value' },
      { id: 'VALUE_FCF_YIELD', name: 'FCF Yield', nameCn: '自由现金流收益率', domain: 'value' },
      { id: 'VALUE_DIVIDEND_YIELD', name: 'Dividend Yield', nameCn: '股息率', domain: 'value' },
      { id: 'QUALITY_ROE', name: 'ROE', nameCn: '净资产收益率', domain: 'quality' },
      { id: 'QUALITY_FCF_STABILITY', name: 'FCF Stability', nameCn: '自由现金流稳定性', domain: 'quality' },
      { id: 'GROWTH_EPS_3Y', name: 'EPS Growth 3Y', nameCn: '3年EPS增长', domain: 'growth' },
      { id: 'VOL_HISTORICAL', name: 'Historical Vol', nameCn: '历史波动率', domain: 'volatility' },
      { id: 'TECH_RSI', name: 'RSI', nameCn: '相对强弱指数', domain: 'technical' },
      { id: 'SENT_EARNINGS_SURPRISE', name: 'Earnings Surprise', nameCn: '盈利超预期', domain: 'sentiment' },
      { id: 'CRYPTO_VOLUME', name: 'Crypto Volume', nameCn: '加密交易量', domain: 'crypto' },
      { id: 'MACRO_INTEREST_RATE', name: 'Interest Rate', nameCn: '利率敏感度', domain: 'macro' },
      { id: 'REVERSAL_SHORT', name: 'Short-term Reversal', nameCn: '短期反转', domain: 'reversal' },
      { id: 'LIQUIDITY_TURNOVER', name: 'Turnover', nameCn: '换手率', domain: 'liquidity' },
      { id: 'SIZE_MARKET_CAP', name: 'Market Cap', nameCn: '市值', domain: 'size' },
      { id: 'ESG_SCORE', name: 'ESG Score', nameCn: 'ESG评分', domain: 'esg' },
      { id: 'COMMODITY_GOLD', name: 'Gold Sensitivity', nameCn: '黄金敏感度', domain: 'commodity' },
      { id: 'ANALYST_REVISION', name: 'Analyst Revision', nameCn: '分析师修正', domain: 'analyst' },
    ];
    for (const f of factors) this.factorRegistry.set(f.id, f);
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FactorVisualizationDataEngine | null = null;

export function factorVisualizationDataEngine(): FactorVisualizationDataEngine {
  if (!instance) instance = new FactorVisualizationDataEngine();
  return instance;
}

export function resetFactorVisualizationDataEngine(): void { instance = null; }
