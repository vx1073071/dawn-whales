// ── R272 JVS-1 🇭🇰 香港卖空数据引擎 (HKShortSellEngine) ──
// 完整香港卖空数据服务: 日卖空速率→板块汇聚→异常检测→回测→排序→历史分析

export interface ShortSellDay {
  date: string; // YYYY-MM-DD
  code: string; // stock code e.g. '00700'
  name: string;
  sector: string; // e.g. 'Technology', 'Property'
  shortVolume: number; // shares shorted
  totalVolume: number; // total traded shares
  shortTurnover: number; // HKD shorted
  totalTurnover: number; // total HKD turnover
  shortRatio: number; // shortVolume / totalVolume
  shortTurnoverRatio: number; // shortTurnover / totalTurnover
  avgShortPrice: number;
  lastPrice: number;
  changePercent: number;
  marketCap: number; // HKD
  source: 'HKEX';
}

export interface ShortSellSummary {
  date: string;
  totalShortTurnover: number;
  totalMarketTurnover: number;
  overallShortRatio: number;
  stockCount: number;
  topShortStocks: ShortSellDay[];
  bySector: SectorShortSell[];
}

export interface SectorShortSell {
  sector: string;
  totalShortTurnover: number;
  totalTurnover: number;
  shortRatio: number;
  stockCount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  weekOverWeekChange: number;
}

export interface ShortSellAlert {
  id: string;
  code: string;
  name: string;
  type: 'short_spike' | 'short_squeeze' | 'declining_short' | 'sector_surge' | 'unusual_volume';
  severity: 'info' | 'warning' | 'critical';
  shortRatio: number;
  delta: number; // change from average
  sector: string;
  createdAt: number;
  detail: string;
}

export interface ShortSellTrend {
  code: string;
  name: string;
  sector: string;
  shortRatioSeries: number[]; // last 20 days
  avgShortRatio: number;
  maxShortRatio: number;
  minShortRatio: number;
  stdDev: number;
  trend: 'increasing' | 'decreasing' | 'flat' | 'volatile';
  lastDayShortRatio: number;
  zScore: number; // normalized deviation
  volumeTrend: 'increasing' | 'decreasing' | 'flat';
}

export interface ShortSellQuery {
  code?: string;
  sector?: string;
  dateFrom?: string;
  dateTo?: string;
  minShortRatio?: number;
  sortBy?: 'shortRatio' | 'shortTurnover' | 'changePercent';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class HKShortSellEngine {
  private data: ShortSellDay[] = [];
  private alerts: ShortSellAlert[] = [];

  reset(): void { this.data = []; this.alerts = []; }

  // ═══════════ Data Loading ═══════════

  /** Load short sell data batch (from DB/HKEX) */
  loadData(records: ShortSellDay[]): number {
    // Dedup by date+code
    const existing = new Set(this.data.map((d) => `${d.date}|${d.code}`));
    let added = 0;
    for (const r of records) {
      const key = `${r.date}|${r.code}`;
      if (!existing.has(key)) {
        this.data.push(r);
        existing.add(key);
        added++;
      }
    }
    return added;
  }

  /** Get latest date in dataset */
  getLatestDate(): string | null {
    if (this.data.length === 0) return null;
    return this.data.reduce((max, d) => (d.date > max ? d.date : max), this.data[0].date);
  }

  // ═══════════ Query ═══════════

  /** Query short sell data with filters */
  query(q?: ShortSellQuery): ShortSellDay[] {
    let results = [...this.data];
    if (q?.code) results = results.filter((d) => d.code === q.code);
    if (q?.sector) results = results.filter((d) => d.sector === q.sector);
    if (q?.dateFrom) results = results.filter((d) => d.date >= q.dateFrom!);
    if (q?.dateTo) results = results.filter((d) => d.date <= q.dateTo!);
    if (q?.minShortRatio) results = results.filter((d) => d.shortRatio >= q.minShortRatio!);

    const sortBy = q?.sortBy || 'shortRatio';
    results.sort((a, b) => {
      const v = (q?.sortOrder === 'asc' ? 1 : -1);
      return v * ((b[sortBy] as number) - (a[sortBy] as number));
    });

    if (q?.limit) results = results.slice(0, q.limit);
    return results;
  }

  /** Get latest day short sell data */
  getLatest(latestDate?: string): ShortSellDay[] {
    const date = latestDate || this.getLatestDate();
    if (!date) return [];
    return this.data.filter((d) => d.date === date);
  }

  // ═══════════ Daily Summary ═══════════

  /** Build daily summary including sector breakdown */
  getDailySummary(date?: string): ShortSellSummary | null {
    const records = this.getLatest(date);
    if (records.length === 0) return null;

    const totalShortTurnover = records.reduce((s, d) => s + d.shortTurnover, 0);
    const totalMarketTurnover = records.reduce((s, d) => s + d.totalTurnover, 0);
    const overallShortRatio = totalMarketTurnover > 0 ? totalShortTurnover / totalMarketTurnover : 0;

    // Sector aggregation
    const sectorMap = new Map<string, { turnover: number; total: number; codes: Set<string> }>();
    for (const r of records) {
      const e = sectorMap.get(r.sector) || { turnover: 0, total: 0, codes: new Set<string>() };
      e.turnover += r.shortTurnover;
      e.total += r.totalTurnover;
      e.codes.add(r.code);
      sectorMap.set(r.sector, e);
    }

    const bySector: SectorShortSell[] = [...sectorMap.entries()].map(([sector, v]) => ({
      sector, totalShortTurnover: v.turnover, totalTurnover: v.total,
      shortRatio: v.total > 0 ? v.turnover / v.total : 0,
      stockCount: v.codes.size,
      trend: 'stable', weekOverWeekChange: 0,
    })).sort((a, b) => b.totalShortTurnover - a.totalShortTurnover);

    return {
      date: records[0].date,
      totalShortTurnover, totalMarketTurnover, overallShortRatio,
      stockCount: records.length,
      topShortStocks: [...records].sort((a, b) => b.shortRatio - a.shortRatio).slice(0, 20),
      bySector,
    };
  }

  // ═══════════ Sector Analysis ═══════════

  /** Get sector-level aggregated short sell view over a date range */
  getSectorAnalysis(fromDate: string, toDate: string): SectorShortSell[] {
    const records = this.data.filter((d) => d.date >= fromDate && d.date <= toDate);
    const sectorMap = new Map<string, { turnovers: number[]; totals: number[]; codes: Set<string>; dates: string[] }>();

    for (const r of records) {
      const e = sectorMap.get(r.sector) || { turnovers: [], totals: [], codes: new Set<string>(), dates: [] };
      e.turnovers.push(r.shortTurnover);
      e.totals.push(r.totalTurnover);
      e.codes.add(r.code);
      e.dates.push(r.date);
      sectorMap.set(r.sector, e);
    }

    return [...sectorMap.entries()].map(([sector, v]) => {
      const totalST = v.turnovers.reduce((s, t) => s + t, 0);
      const totalT = v.totals.reduce((s, t) => s + t, 0);
      const ratio = totalT > 0 ? totalST / totalT : 0;

      // Week-over-week comparison
      const mid = Math.floor(v.turnovers.length / 2);
      const firstHalf = v.turnovers.slice(0, mid).reduce((s, t) => s + t, 0);
      const secondHalf = v.turnovers.slice(mid).reduce((s, t) => s + t, 0);
      const wowChange = firstHalf > 0 ? (secondHalf - firstHalf) / firstHalf : 0;

      return {
        sector, totalShortTurnover: totalST, totalTurnover: totalT, shortRatio: ratio,
        stockCount: v.codes.size,
        trend: Math.abs(wowChange) < 0.05 ? 'stable' : wowChange > 0 ? 'increasing' : 'decreasing',
        weekOverWeekChange: wowChange,
      };
    }).sort((a, b) => b.totalShortTurnover - a.totalShortTurnover);
  }

  // ═══════════ Trend Analysis (per stock over time) ═══════════

  /** Analyze short sell trend for a stock over last N days */
  getStockTrend(code: string, lookbackDays = 20, endDate?: string): ShortSellTrend | null {
    const latest = endDate || this.getLatestDate();
    if (!latest || this.data.length === 0) return null;

    const stockData = this.data.filter((d) => d.code === code).sort((a, b) => a.date.localeCompare(b.date));
    if (stockData.length === 0) return null;

    const recent = stockData.slice(-lookbackDays);
    if (recent.length < 5) return null; // need minimum data points

    const ratios = recent.map((d) => d.shortRatio);
    const volumes = recent.map((d) => d.shortVolume);

    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const avgRatio = mean(ratios);
    const maxR = Math.max(...ratios);
    const minR = Math.min(...ratios);
    const variance = mean(ratios.map((r) => (r - avgRatio) ** 2));
    const stdDev = Math.sqrt(variance);
    const zScore = stdDev > 0 ? (ratios[ratios.length - 1] - avgRatio) / stdDev : 0;

    // Trend direction using linear regression slope
    const n = ratios.length;
    const xSum = (n * (n - 1)) / 2;
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;
    const ySum = ratios.reduce((s, v) => s + v, 0);
    const xySum = ratios.reduce((s, v, i) => s + v * i, 0);
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);

    let trend: ShortSellTrend['trend'];
    if (Math.abs(slope) < 0.002) trend = 'flat';
    else if (slope > 0) trend = 'increasing';
    else if (slope > -0.01) trend = 'decreasing';
    else trend = 'volatile';

    let volumeTrend: ShortSellTrend['volumeTrend'];
    const vSlope = volumes.length > 1
      ? (volumes[volumes.length - 1] - volumes[0]) / volumes.length / (volumes[0] || 1)
      : 0;
    volumeTrend = Math.abs(vSlope) < 0.05 ? 'flat' : vSlope > 0 ? 'increasing' : 'decreasing';

    return {
      code, name: recent[0].name, sector: recent[0].sector,
      shortRatioSeries: ratios, avgShortRatio: avgRatio,
      maxShortRatio: maxR, minShortRatio: minR, stdDev, trend,
      lastDayShortRatio: ratios[ratios.length - 1], zScore, volumeTrend,
    };
  }

  /** Get top N stocks by short ratio */
  getTopShortStocks(date?: string, limit = 20): ShortSellDay[] {
    return this.getLatest(date).sort((a, b) => b.shortRatio - a.shortRatio).slice(0, limit);
  }

  /** Get top N stocks by short turnover */
  getTopShortTurnover(date?: string, limit = 20): ShortSellDay[] {
    return this.getLatest(date).sort((a, b) => b.shortTurnover - a.shortTurnover).slice(0, limit);
  }

  // ═══════════ Alert Detection ═══════════

  /** Run anomaly detection on all stocks — generate alerts */
  detectAlerts(date?: string | ShortSellDay[], stockLookback = 20): ShortSellAlert[] {
    const checkDate = typeof date === 'string' ? date : undefined;
    const records = Array.isArray(date) ? date : this.getLatest(checkDate);
    this.alerts = [];

    for (const r of records) {
      const trend = this.getStockTrend(r.code, stockLookback, checkDate || undefined);
      if (!trend) continue;

      // Spike: today's short ratio > avg + 2σ
      if (trend.zScore > 2.0) {
        this.alerts.push({
          id: crypto.randomUUID(), code: r.code, name: r.name, type: 'short_spike',
          severity: trend.zScore > 3.0 ? 'critical' : 'warning',
          shortRatio: r.shortRatio, delta: trend.lastDayShortRatio - trend.avgShortRatio,
          sector: r.sector, createdAt: Date.now(),
          detail: `Short ratio ${(r.shortRatio * 100).toFixed(1)}% vs avg ${(trend.avgShortRatio * 100).toFixed(1)}% (z=${trend.zScore.toFixed(2)})`,
        });
      }

      // Unusual volume: short volume > 3x recent average
      const recentAvgVol = trend.shortRatioSeries.length > 5
        ? trend.shortRatioSeries.slice(0, -1).reduce((s, v) => s + v, 0) / (trend.shortRatioSeries.length - 1)
        : trend.shortRatioSeries[0];
      if (trend.lastDayShortRatio > recentAvgVol * 2) {
        this.alerts.push({
          id: crypto.randomUUID(), code: r.code, name: r.name, type: 'unusual_volume',
          severity: trend.lastDayShortRatio > recentAvgVol * 3 ? 'critical' : 'warning',
          shortRatio: r.shortRatio, delta: trend.lastDayShortRatio - recentAvgVol,
          sector: r.sector, createdAt: Date.now(),
          detail: `Short vol ${r.shortVolume.toLocaleString()} shares — ${((trend.lastDayShortRatio / recentAvgVol - 1) * 100).toFixed(0)}% above average`,
        });
      }

      // Declining short (potential squeeze setup)
      if (trend.trend === 'decreasing' && trend.lastDayShortRatio < trend.avgShortRatio * 0.7) {
        this.alerts.push({
          id: crypto.randomUUID(), code: r.code, name: r.name, type: 'declining_short',
          severity: 'info', shortRatio: r.shortRatio,
          delta: trend.lastDayShortRatio - trend.avgShortRatio,
          sector: r.sector, createdAt: Date.now(),
          detail: `Short declining — potential squeeze candidate (${(r.shortRatio * 100).toFixed(1)}% vs avg ${(trend.avgShortRatio * 100).toFixed(1)}%)`,
        });
      }
    }

    return this.alerts;
  }

  /** Get all alerts (from last detect run) */
  getAlerts(severity?: ShortSellAlert['severity']): ShortSellAlert[] {
    return severity ? this.alerts.filter((a) => a.severity === severity) : [...this.alerts];
  }

  // ═══════════ Sector Trend Detection ═══════════

  /** Check if a whole sector is seeing short build-up */
  getSectorSurgeAlert(fromDate: string, toDate: string): ShortSellAlert[] {
    const sectorData = this.getSectorAnalysis(fromDate, toDate);
    const sectorAlerts: ShortSellAlert[] = [];

    for (const s of sectorData) {
      if (s.trend === 'increasing' && s.weekOverWeekChange > 0.15) {
        sectorAlerts.push({
          id: crypto.randomUUID(), code: `SECTOR:${s.sector}`, name: `${s.sector} Sector`,
          type: 'sector_surge', severity: s.weekOverWeekChange > 0.3 ? 'critical' : 'warning',
          shortRatio: s.shortRatio, delta: s.weekOverWeekChange,
          sector: s.sector, createdAt: Date.now(),
          detail: `${s.sector} sector short sell up ${(s.weekOverWeekChange * 100).toFixed(1)}% WoW — ${s.stockCount} stocks affected`,
        });
      }
    }
    return sectorAlerts;
  }

  // ═══════════ Ranking ═══════════

  /** Rank stocks by short sell score (composite: shortRatio × shortTurnover × change) */
  rankStocks(date?: string): { code: string; name: string; score: number; shortRatio: number; shortTurnover: number }[] {
    const records = this.getLatest(date);
    if (records.length === 0) return [];

    const maxTurnover = Math.max(...records.map((r) => r.shortTurnover));
    const maxRatio = Math.max(...records.map((r) => r.shortRatio));

    return records.map((r) => ({
      code: r.code, name: r.name,
      shortRatio: r.shortRatio, shortTurnover: r.shortTurnover,
      score: (r.shortRatio / maxRatio) * 0.5 + (r.shortTurnover / maxTurnover) * 0.3 + Math.abs(r.changePercent) / 100 * 0.2,
    })).sort((a, b) => b.score - a.score);
  }

  // ═══════════ Historical Backtest ═══════════

  /** Backtest: for stocks with high short ratio, what was next-day price change? */
  backtestHighShort(
    fromDate: string, toDate: string, threshold = 0.30,
  ): { code: string; date: string; shortRatio: number; nextDayChange: number | null; win: boolean }[] {
    const records = this.data.filter((d) => d.date >= fromDate && d.date <= toDate);
    const allDates = [...new Set(records.map((r) => r.date))].sort();

    const results: { code: string; date: string; shortRatio: number; nextDayChange: number | null; win: boolean }[] = [];

    for (const r of records) {
      if (r.shortRatio >= threshold) {
        // Find next day's change for same stock
        const currentIdx = allDates.indexOf(r.date);
        if (currentIdx < allDates.length - 1) {
          const nextDate = allDates[currentIdx + 1];
          const nextDay = records.find((d) => d.code === r.code && d.date === nextDate);
          const nextDayChange = nextDay?.changePercent ?? null;
          results.push({
            code: r.code, date: r.date, shortRatio: r.shortRatio,
            nextDayChange, win: nextDayChange !== null ? nextDayChange < 0 : false,
          });
        }
      }
    }
    return results;
  }

  /** Backtest summary stats */
  getBacktestSummary(results: ReturnType<typeof this.backtestHighShort>): {
    sampleSize: number; winRate: number; avgNextDayChange: number;
    maxDrop: number; maxGain: number; profitableForShorts: number;
  } {
    const valid = results.filter((r) => r.nextDayChange !== null);
    const wins = valid.filter((r) => r.win);
    return {
      sampleSize: valid.length,
      winRate: valid.length > 0 ? wins.length / valid.length : 0,
      avgNextDayChange: valid.length > 0 ? valid.reduce((s, r) => s + r.nextDayChange!, 0) / valid.length : 0,
      maxDrop: valid.length > 0 ? Math.min(...valid.map((r) => r.nextDayChange!)) : 0,
      maxGain: valid.length > 0 ? Math.max(...valid.map((r) => r.nextDayChange!)) : 0,
      profitableForShorts: valid.length,
    };
  }

  // ═══════════ Stock Code Utilities ═══════════

  /** Map HK stock code to sector */
  private _sectorMap: Record<string, string> = {
    '00700': 'Technology', '09988': 'Technology', '03690': 'Technology', '09618': 'Technology', '09999': 'Technology',
    '00388': 'Financials', '00005': 'Financials', '01299': 'Financials', '02318': 'Financials', '02628': 'Financials',
    '00016': 'Property', '00012': 'Property', '01212': 'Property', '00017': 'Property', '01098': 'Property',
    '02269': 'Healthcare', '01093': 'Healthcare', '00027': 'Gaming', '01928': 'Gaming',
  };

  getSector(code: string): string { return this._sectorMap[code] || 'Other'; }

  seed(symbols?: string[]): number {
    const defaultSymbols = ['00700', '09988', '00388', '00005', '00016'];
    const codes = symbols || defaultSymbols;
    const today = new Date().toISOString().slice(0, 10);
    const records: ShortSellDay[] = [];

    for (const code of codes) {
      for (let d = 20; d >= 0; d--) {
        const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        const totalVol = Math.round((5000000 + Math.random() * 20000000) * (0.8 + Math.random() * 0.4));
        const shortVol = Math.round(totalVol * (0.05 + Math.random() * 0.35));
        const price = code === '00700' ? 380 + Math.random() * 40 : code === '09988' ? 120 + Math.random() * 15 : code === '00388' ? 320 + Math.random() * 30 : 300 + Math.random() * 50;
        records.push({
          date, code, name: code === '00700' ? 'TENCENT' : code === '09988' ? 'BABA-SW' : code === '00388' ? 'HKEX' : code === '00005' ? 'HSBC' : 'SHK PPT',
          sector: this.getSector(code),
          shortVolume: shortVol, totalVolume: totalVol,
          shortTurnover: Math.round(shortVol * price),
          totalTurnover: Math.round(totalVol * price),
          shortRatio: shortVol / totalVol,
          shortTurnoverRatio: shortVol / totalVol,
          avgShortPrice: price, lastPrice: price + (Math.random() - 0.5) * 2,
          changePercent: (Math.random() - 0.5) * 6, marketCap: 1000000000000 + Math.random() * 4000000000000, source: 'HKEX',
        });
      }
    }
    return this.loadData(records);
  }
}

// ═══════════ TypeGuard + Singleton ═══════════

export function isShortSellDay(obj: unknown): obj is ShortSellDay {
  return typeof obj === 'object' && obj !== null && 'code' in obj && 'shortVolume' in obj && 'shortRatio' in obj;
}

let sseInstance: HKShortSellEngine | null = null;
export function getHKShortSellEngine(): HKShortSellEngine {
  if (!sseInstance) sseInstance = new HKShortSellEngine();
  return sseInstance;
}
export function resetHKShortSellEngine(): void { sseInstance = null; }
