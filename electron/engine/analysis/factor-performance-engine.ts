/**
 * FactorPerformanceEngine — R276 JVS-2 因子绩效追踪引擎
 *
 * 六维度追踪:
 * 1. IC (Information Coefficient) — Pearson corr(factor_signal, forward_return)
 * 2. Rank IC — Spearman rank correlation
 * 3. Long-Short Return — top quintile - bottom quintile period return
 * 4. Turnover — avg quarterly turnover
 * 5. Max Drawdown — long-short portfolio max drawdown
 * 6. Factor Crowding — position concentration (delegates to UnifiedCrowdingEngine)
 *
 * 支持: registerFactor / trackFactor / getPerformance / rankFactors / seed
 */

export interface FactorPerformanceRecord {
  factorId: string;
  factorName: string;
  category: string;
  /** Information Coefficient (日频) */
  ic: number;
  /** IC t-statistic */
  icTStat: number;
  /** Rank IC */
  rankIc: number;
  /** IC 胜率 (IC>0 占比) */
  icWinRate: number;
  /** 多空收益 (年化 %) */
  longShortReturn: number;
  /** 多头收益 (年化 %) */
  longReturn: number;
  /** 空头收益 (年化 %) */
  shortReturn: number;
  /** 年化波动率 */
  annualVolatility: number;
  /** Sharpe ratio */
  sharpeRatio: number;
  /** 最大回撤 (%) */
  maxDrawdown: number;
  /** Calmar ratio (return/maxDD) */
  calmarRatio: number;
  /** 平均季度换手率 (%) */
  avgTurnover: number;
  /** 因子拥挤度 (0-100) */
  crowdingScore: number;
  /** 拥挤度等级 */
  crowdingLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  /** 综合评分 (0-100) */
  compositeScore: number;
  /** 因子等级: S/A/B/C/D */
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  /** 最近更新时间 */
  lastUpdated: number;
  /** 历史IC序列 (最近60天) */
  icHistory: number[];
}

export interface PerformanceQuery {
  factorId?: string;
  category?: string;
  market?: string;
  minIC?: number;
  minSharpe?: number;
  maxDrawdownLimit?: number;
  maxCrowding?: number;
  grade?: string;
  sortBy?: keyof FactorPerformanceRecord;
  sortDir?: 'asc' | 'desc';
  topN?: number;
}

export interface ICHistoryPoint {
  date: string;
  ic: number;
  rankIc: number;
  longShortReturn: number;
}

export interface FactorRanking {
  rank: number;
  factorId: string;
  factorName: string;
  compositeScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  ic: number;
  sharpe: number;
  change: 'up' | 'down' | 'stable';
  changeScore: number;
}

// ============================================================
export class FactorPerformanceEngine {
  private records = new Map<string, FactorPerformanceRecord>();
  private icHistory = new Map<string, ICHistoryPoint[]>();
  private prevRanking = new Map<string, number>();

  /** 注册因子 */
  registerFactor(factorId: string, factorName: string, category: string): void {
    if (!this.records.has(factorId)) {
      this.records.set(factorId, {
        factorId, factorName, category,
        ic: 0, icTStat: 0, rankIc: 0, icWinRate: 0.5,
        longShortReturn: 0, longReturn: 0, shortReturn: 0,
        annualVolatility: 0.15, sharpeRatio: 0, maxDrawdown: 0,
        calmarRatio: 0, avgTurnover: 0.3, crowdingScore: 0,
        crowdingLevel: 'low', compositeScore: 0, grade: 'C',
        lastUpdated: Date.now(), icHistory: [],
      });
    }
  }

  /** 更新因子绩效快照 */
  trackFactor(
    factorId: string,
    data: {
      ic?: number;
      rankIc?: number;
      longShortReturn?: number;
      longReturn?: number;
      shortReturn?: number;
      annualVolatility?: number;
      maxDrawdown?: number;
      avgTurnover?: number;
      crowdingScore?: number;
      icHistory?: number[];
    },
  ): FactorPerformanceRecord | null {
    const rec = this.records.get(factorId);
    if (!rec) return null;

    if (data.ic !== undefined) rec.ic = data.ic;
    if (data.rankIc !== undefined) rec.rankIc = data.rankIc;
    if (data.longShortReturn !== undefined) rec.longShortReturn = data.longShortReturn;
    if (data.longReturn !== undefined) rec.longReturn = data.longReturn;
    if (data.shortReturn !== undefined) rec.shortReturn = data.shortReturn;
    if (data.annualVolatility !== undefined) rec.annualVolatility = data.annualVolatility;
    if (data.maxDrawdown !== undefined) rec.maxDrawdown = data.maxDrawdown;
    if (data.avgTurnover !== undefined) rec.avgTurnover = data.avgTurnover;
    if (data.crowdingScore !== undefined) {
      rec.crowdingScore = data.crowdingScore;
      rec.crowdingLevel = this.classifyCrowding(data.crowdingScore);
    }
    if (data.icHistory) rec.icHistory = data.icHistory;

    // Auto-compute derived metrics
    rec.sharpeRatio = rec.annualVolatility > 0 ? rec.longShortReturn / rec.annualVolatility : 0;
    rec.calmarRatio = rec.maxDrawdown > 0 ? Math.abs(rec.longShortReturn) / rec.maxDrawdown : 0;
    rec.icTStat = rec.icHistory.length > 1
      ? rec.ic / (this.stdDev(rec.icHistory) / Math.sqrt(rec.icHistory.length))
      : 0;
    rec.icWinRate = rec.icHistory.length > 0
      ? rec.icHistory.filter(v => v > 0).length / rec.icHistory.length
      : 0.5;

    // Composite score: weighted multi-dimension
    rec.compositeScore = this.computeCompositeScore(rec);
    rec.grade = this.assignGrade(rec.compositeScore);
    rec.lastUpdated = Date.now();

    // Record IC history point
    if (!this.icHistory.has(factorId)) this.icHistory.set(factorId, []);
    this.icHistory.get(factorId)!.push({
      date: new Date().toISOString().split('T')[0],
      ic: rec.ic,
      rankIc: rec.rankIc,
      longShortReturn: rec.longShortReturn,
    });
    // Keep last 252
    const hist = this.icHistory.get(factorId)!;
    if (hist.length > 252) hist.shift();

    return { ...rec, icHistory: [...rec.icHistory] };
  }

  /** 获取单个因子绩效 */
  getPerformance(factorId: string): FactorPerformanceRecord | null {
    const rec = this.records.get(factorId);
    return rec ? { ...rec, icHistory: [...rec.icHistory] } : null;
  }

  /** 获取所有因子绩效 */
  getAllPerformances(): FactorPerformanceRecord[] {
    return Array.from(this.records.values()).map(r => ({ ...r, icHistory: [...r.icHistory] }));
  }

  /** 查询因子绩效 (支持过滤/排序/topN) */
  queryPerformances(query: PerformanceQuery): FactorPerformanceRecord[] {
    let results = Array.from(this.records.values()).map(r => ({ ...r, icHistory: [...r.icHistory] }));

    if (query.factorId) results = results.filter(r => r.factorId === query.factorId);
    if (query.category) results = results.filter(r => r.category === query.category);
    if (query.minIC !== undefined) results = results.filter(r => r.ic >= query.minIC);
    if (query.minSharpe !== undefined) results = results.filter(r => r.sharpeRatio >= query.minSharpe);
    if (query.maxDrawdownLimit !== undefined) results = results.filter(r => r.maxDrawdown <= query.maxDrawdownLimit);
    if (query.maxCrowding !== undefined) results = results.filter(r => r.crowdingScore <= query.maxCrowding);
    if (query.grade) results = results.filter(r => r.grade === query.grade);

    const sortBy = query.sortBy || 'compositeScore';
    const sortDir = query.sortDir || 'desc';
    results.sort((a, b) => {
      const aVal = a[sortBy] as number;
      const bVal = b[sortBy] as number;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    if (query.topN !== undefined) results = results.slice(0, query.topN);
    return results;
  }

  /** 因子排名 (含变化) */
  rankFactors(category?: string): FactorRanking[] {
    // Snapshot previous ranks
    const all = Array.from(this.records.values()).map(r => ({ ...r }));
    if (category) all.filter(r => r.category === category);
    all.sort((a, b) => b.compositeScore - a.compositeScore);

    const rankings: FactorRanking[] = all.map((r, i) => {
      const prevRank = this.prevRanking.get(r.factorId);
      const change = prevRank === undefined ? 'stable'
        : i < prevRank ? 'up' : i > prevRank ? 'down' : 'stable';
      const changeScore = prevRank !== undefined ? prevRank - i : 0;
      return {
        rank: i + 1,
        factorId: r.factorId,
        factorName: r.factorName,
        compositeScore: r.compositeScore,
        grade: r.grade,
        ic: r.ic,
        sharpe: r.sharpeRatio,
        change,
        changeScore,
      };
    });

    // Update prev ranking
    this.prevRanking.clear();
    rankings.forEach(r => this.prevRanking.set(r.factorId, r.rank));

    return rankings;
  }

  /** 获取 IC 衰减曲线 */
  getICDecay(factorId: string, maxLag = 20): { lag: number; avgIC: number }[] {
    const hist = this.icHistory.get(factorId);
    if (!hist || hist.length < maxLag + 1) return [];

    const icVals = hist.map(h => h.ic);
    const result: { lag: number; avgIC: number }[] = [];

    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0; let count = 0;
      for (let i = lag; i < icVals.length; i++) {
        sum += icVals[i] * icVals[i - lag];
        count++;
      }
      result.push({ lag, avgIC: count > 0 ? sum / count : 0 });
    }
    return result;
  }

  /** 热门因子 (综合评分 top10) */
  getHotFactors(topN = 10): FactorRanking[] {
    return this.rankFactors().slice(0, topN);
  }

  /** 因子过热检测 */
  detectOverheating(): FactorPerformanceRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.crowdingLevel === 'extreme' && r.ic > 0.03)
      .sort((a, b) => b.crowdingScore - a.crowdingScore);
  }

  /** 因子 pair 相关性矩阵 */
  getPairIC(factorIdA: string, factorIdB: string): number {
    const histA = this.icHistory.get(factorIdA);
    const histB = this.icHistory.get(factorIdB);
    if (!histA || !histB) return 0;

    const minLen = Math.min(histA.length, histB.length);
    if (minLen < 5) return 0;

    const aVals = histA.slice(-minLen).map(h => h.ic);
    const bVals = histB.slice(-minLen).map(h => h.ic);

    return this.pearsonCorrelation(aVals, bVals);
  }

  /** 跨因子去重复 (检测高相关性因子对) */
  findDuplicates(correlationThreshold = 0.85): Array<{ a: string; b: string; correlation: number }> {
    const ids = Array.from(this.records.keys());
    const duplicates: Array<{ a: string; b: string; correlation: number }> = [];

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const corr = this.getPairIC(ids[i], ids[j]);
        if (corr >= correlationThreshold) {
          duplicates.push({ a: ids[i], b: ids[j], correlation: corr });
        }
      }
    }
    return duplicates.sort((a, b) => b.correlation - a.correlation);
  }

  // ======== Private helpers ========

  private computeCompositeScore(r: FactorPerformanceRecord): number {
    // Weighted scoring: IC 40%, Sharpe 25%, WinRate 15%, Calmar 10%, Crowding (inverse) 10%
    const icScore = Math.tanh(r.ic * 20) * 40;
    const sharpeScore = Math.min(r.sharpeRatio / 2, 1) * 25;
    const winRateScore = r.icWinRate * 15;
    const calmarScore = Math.min(r.calmarRatio / 2, 1) * 10;
    // Lower crowding = higher score
    const crowdingScore = Math.max(0, (100 - r.crowdingScore) / 100) * 10;
    return Math.min(Math.round((icScore + sharpeScore + winRateScore + calmarScore + crowdingScore)), 100);
  }

  private assignGrade(score: number): FactorPerformanceRecord['grade'] {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 50) return 'B';
    if (score >= 30) return 'C';
    return 'D';
  }

  private classifyCrowding(score: number): FactorPerformanceRecord['crowdingLevel'] {
    if (score >= 85) return 'extreme';
    if (score >= 70) return 'high';
    if (score >= 50) return 'elevated';
    if (score >= 30) return 'moderate';
    return 'low';
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let cov = 0, varX = 0, varY = 0;
    for (let i = 0; i < n; i++) {
      cov += (x[i] - meanX) * (y[i] - meanY);
      varX += (x[i] - meanX) ** 2;
      varY += (y[i] - meanY) ** 2;
    }
    const denom = Math.sqrt(varX * varY);
    return denom === 0 ? 0 : cov / denom;
  }

  private stdDev(vals: number[]): number {
    if (vals.length < 2) return 0;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1));
  }

  // ======== Seed ========

  seed(): void {
    const factorSeeds: Array<{
      id: string; name: string; cat: string;
      ic: number; rankIc: number; lsr: number; vol: number; dd: number; turn: number; crowd: number;
      icHist: number[];
    }> = [
      { id: 'momentum_12m', name: 'Momentum 12M', cat: 'momentum', ic: 0.045, rankIc: 0.052, lsr: 12.5, vol: 0.18, dd: 15.2, turn: 0.85, crowd: 72,
        icHist: [0.04,0.05,0.06,0.03,0.07,0.04,0.05,0.06,0.04,0.05,0.06,0.04,0.03,0.05,0.06,0.04,0.05,0.06,0.04,0.05] },
      { id: 'pe_ttm', name: 'Value PE', cat: 'value', ic: 0.032, rankIc: 0.038, lsr: 8.2, vol: 0.15, dd: 18.5, turn: 0.35, crowd: 45,
        icHist: [0.03,0.04,0.02,0.05,0.03,0.02,0.04,0.03,0.02,0.03,0.04,0.02,0.03,0.04,0.02,0.03,0.04,0.02,0.03,0.04] },
      { id: 'market_cap', name: 'Size', cat: 'size', ic: 0.028, rankIc: 0.035, lsr: 6.5, vol: 0.17, dd: 22.3, turn: 0.25, crowd: 55,
        icHist: [0.02,0.03,0.04,0.02,0.03,0.01,0.03,0.02,0.04,0.02,0.03,0.01,0.03,0.02,0.04,0.02,0.03,0.01,0.03,0.02] },
      { id: 'roe_ttm', name: 'Quality ROE', cat: 'quality', ic: 0.035, rankIc: 0.041, lsr: 9.8, vol: 0.14, dd: 14.1, turn: 0.30, crowd: 38,
        icHist: [0.03,0.04,0.05,0.03,0.04,0.03,0.04,0.03,0.05,0.03,0.04,0.03,0.04,0.03,0.05,0.03,0.04,0.03,0.04,0.03] },
      { id: 'volatility_20d', name: 'Low Volatility', cat: 'volatility', ic: -0.025, rankIc: -0.032, lsr: 4.5, vol: 0.12, dd: 8.5, turn: 0.22, crowd: 28,
        icHist: [-0.02,-0.03,-0.01,-0.04,-0.02,-0.03,-0.01,-0.02,-0.03,-0.01,-0.02,-0.03,-0.01,-0.02,-0.03,-0.01,-0.02,-0.03,-0.01,-0.02] },
      { id: 'turnover_rate', name: 'Liquidity', cat: 'liquidity', ic: 0.018, rankIc: 0.022, lsr: 3.2, vol: 0.20, dd: 25.5, turn: 0.55, crowd: 20,
        icHist: [0.02,0.01,0.03,0.02,0.01,0.02,0.03,0.01,0.02,0.03,0.01,0.02,0.03,0.01,0.02,0.03,0.01,0.02,0.03,0.01] },
      { id: 'northbound', name: 'Northbound Flow', cat: 'flow', ic: 0.022, rankIc: 0.026, lsr: 7.1, vol: 0.16, dd: 19.1, turn: 0.40, crowd: 62,
        icHist: [0.02,0.03,0.01,0.04,0.02,0.03,0.01,0.02,0.03,0.01,0.02,0.03,0.01,0.02,0.03,0.01,0.02,0.03,0.01,0.02] },
      { id: 'major_flow_5d', name: 'Major Flow 5D', cat: 'flow', ic: 0.015, rankIc: 0.018, lsr: 4.8, vol: 0.19, dd: 21.5, turn: 0.60, crowd: 33,
        icHist: [0.01,0.02,0.01,0.03,0.01,0.02,0.01,0.02,0.01,0.03,0.01,0.02,0.01,0.02,0.01,0.03,0.01,0.02,0.01,0.02] },
      { id: 'pb_lf', name: 'Value PB', cat: 'value', ic: 0.029, rankIc: 0.033, lsr: 7.5, vol: 0.16, dd: 20.2, turn: 0.32, crowd: 42,
        icHist: [0.03,0.02,0.04,0.03,0.02,0.03,0.04,0.02,0.03,0.04,0.02,0.03,0.04,0.02,0.03,0.04,0.02,0.03,0.04,0.02] },
      { id: 'momentum_3m', name: 'Momentum 3M', cat: 'momentum', ic: 0.042, rankIc: 0.048, lsr: 11.2, vol: 0.22, dd: 16.8, turn: 0.72, crowd: 68,
        icHist: [0.04,0.05,0.03,0.06,0.04,0.05,0.03,0.04,0.05,0.03,0.04,0.05,0.03,0.04,0.05,0.03,0.04,0.05,0.03,0.04] },
    ];

    for (const s of factorSeeds) {
      this.registerFactor(s.id, s.name, s.cat);
      this.trackFactor(s.id, {
        ic: s.ic, rankIc: s.rankIc, longShortReturn: s.lsr,
        annualVolatility: s.vol, maxDrawdown: s.dd,
        avgTurnover: s.turn, crowdingScore: s.crowd,
        icHistory: s.icHist,
      });
    }
  }

  reset(): void {
    this.records.clear();
    this.icHistory.clear();
    this.prevRanking.clear();
  }
}

// ============================================================
// Singleton
// ============================================================
let _perfEngine: FactorPerformanceEngine | undefined;

export function getFactorPerformanceEngine(): FactorPerformanceEngine {
  if (!_perfEngine) _perfEngine = new FactorPerformanceEngine();
  return _perfEngine;
}

export function resetFactorPerformanceEngine(): void {
  _perfEngine?.reset();
  _perfEngine = undefined;
}
