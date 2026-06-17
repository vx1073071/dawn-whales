// ── R273 JVS-2 🇮🇳 FII/DII引擎 (FII_DIIEngine) ──
// 印度外资/内资流向: FII(FPI/Foreign Portfolio Investors)→DII(Domestic Instl)→净流向→板块分解→趋势

export interface FII_DII_Day {
  date: string;
  fiiGrossBuy: number; // ₹ crores
  fiiGrossSell: number;
  fiiNet: number;
  diiGrossBuy: number;
  diiGrossSell: number;
  diiNet: number;
  netFlow: number; // FII net + DII net
  market: 'cash' | 'futures' | 'options' | 'debt';
  source: 'SEBI' | 'NSE' | 'BSE';
}

export interface FII_DII_SectorBreakdown {
  date: string;
  sector: string;
  fiiNet: number; // ₹ crores
  diiNet: number;
  netFlow: number;
  sectorWeight: number; // % of total market
}

export interface FII_DII_Summary {
  date: string;
  fiiNetTotal: number; // cash market net
  diiNetTotal: number;
  netFlow: number;
  fiiNetMonthly: number; // trailing 30 days
  diiNetMonthly: number;
  fiiNetQuarterly: number; // trailing 90 days
  diiNetQuarterly: number;
  sentiment: 'fii_bullish_dii_cautious' | 'fii_bearish_dii_strong' | 'both_bullish' | 'both_bearish' | 'divergent';
  fiiActivityScore: number; // 0-100 (0 = heavy selling, 50 = neutral, 100 = heavy buying)
  diiActivityScore: number;
  sectorLeaders: FII_DII_SectorBreakdown[]; // top sectors by FII net
  consecutiveFIIBuy: number; // consecutive days of FII net buying
  consecutiveFIISell: number; // consecutive days of FII net selling
  historicalTrend: 'accumulation' | 'distribution' | 'sideways';
}

export interface FII_DII_Alert {
  id: string;
  type: 'fii_surge' | 'fii_exodus' | 'dii_absorption' | 'divergence' | 'monthly_record' | 'sector_rotation';
  severity: 'info' | 'warning' | 'critical';
  detail: string; createdAt: number;
}

export interface FII_DII_Trend {
  period: string; // '5d' | '10d' | '30d' | '90d' | '1y'
  fiiCumulative: number;
  diiCumulative: number;
  netCumulative: number;
  fiiAvgDaily: number;
  diiAvgDaily: number;
  fiiPositiveDays: number;
  fiiNegativeDays: number;
  maxFiiInflow: { date: string; net: number };
  maxFiiOutflow: { date: string; net: number };
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class FII_DIIEngine {
  private data: FII_DII_Day[] = [];
  private sectors: FII_DII_SectorBreakdown[] = [];
  private alerts: FII_DII_Alert[] = [];

  reset(): void { this.data = []; this.sectors = []; this.alerts = []; }

  // ═══════════ Data Pipeline ═══════════

  loadData(records: FII_DII_Day[]): number {
    const existing = new Set(this.data.map((d) => `${d.date}|${d.market}`));
    let added = 0;
    for (const r of records) {
      const key = `${r.date}|${r.market}`;
      if (!existing.has(key)) { this.data.push(r); existing.add(key); added++; }
    }
    this.data.sort((a, b) => a.date.localeCompare(b.date));
    return added;
  }

  loadSectorBreakdown(records: FII_DII_SectorBreakdown[]): number {
    this.sectors.push(...records);
    return records.length;
  }

  get latest(): FII_DII_Day | undefined { return this.data[this.data.length - 1]; }

  getLatest(date?: string): FII_DII_Day[] {
    if (date) return this.data.filter((d) => d.date === date);
    const latestDate = this.latest?.date;
    return latestDate ? this.data.filter((d) => d.date === latestDate) : [];
  }

  getByMarket(market: FII_DII_Day['market']): FII_DII_Day[] {
    return this.data.filter((d) => d.market === market);
  }

  // ═══════════ Daily Summary ═══════════

  getDailySummary(): FII_DII_Summary | null {
    const latestCash = this.getByMarket('cash').slice(-1)[0];
    if (!latestCash) return null;

    const cashData = this.getByMarket('cash');
    const last30 = cashData.slice(-30);
    const last90 = cashData.slice(-90);
    const fiiNetMonthly = last30.reduce((s, d) => s + d.fiiNet, 0);
    const diiNetMonthly = last30.reduce((s, d) => s + d.diiNet, 0);
    const fiiNetQuarterly = last90.reduce((s, d) => s + d.fiiNet, 0);
    const diiNetQuarterly = last90.reduce((s, d) => s + d.diiNet, 0);

    // Consecutive counting
    let consBuy = 0; let consSell = 0;
    for (let i = cashData.length - 1; i >= 0; i--) {
      if (cashData[i].fiiNet >= 0) consBuy++; else break;
    }
    for (let i = cashData.length - 1; i >= 0; i--) {
      if (cashData[i].fiiNet < 0) consSell++; else break;
    }

    // Sentiment classification
    let sentiment: FII_DII_Summary['sentiment'];
    if (fiiNetMonthly > 5000 && diiNetMonthly > 0) sentiment = 'both_bullish';
    else if (fiiNetMonthly < -5000 && diiNetMonthly > 3000) sentiment = 'fii_bearish_dii_strong';
    else if (fiiNetMonthly > 3000 && diiNetMonthly < -2000) sentiment = 'divergent';
    else if (fiiNetMonthly < -3000 && diiNetMonthly < 0) sentiment = 'both_bearish';
    else sentiment = 'fii_bullish_dii_cautious';

    const fiiScore = Math.min(100, Math.max(0, 50 + fiiNetMonthly / 100));
    const diiScore = Math.min(100, Math.max(0, 50 + diiNetMonthly / 100));

    const histTrend: FII_DII_Summary['historicalTrend'] =
      fiiNetMonthly > 5000 ? 'accumulation' : fiiNetMonthly < -5000 ? 'distribution' : 'sideways';

    return {
      date: latestCash.date, fiiNetTotal: latestCash.fiiNet, diiNetTotal: latestCash.diiNet,
      netFlow: latestCash.netFlow, fiiNetMonthly, diiNetMonthly, fiiNetQuarterly, diiNetQuarterly,
      sentiment, fiiActivityScore: Math.round(fiiScore), diiActivityScore: Math.round(diiScore),
      sectorLeaders: this.sectors.filter((s) => s.date === latestCash.date).sort((a, b) => b.fiiNet - a.fiiNet).slice(0, 10),
      consecutiveFIIBuy: consBuy > 0 ? consBuy : 0, consecutiveFIISell: consSell > 0 ? consSell : 0,
      historicalTrend: histTrend,
    };
  }

  // ═══════════ Historical Trend Analysis ═══════════

  getTrend(days: number): FII_DII_Trend {
    const window = this.getByMarket('cash').slice(-days);
    const fiiCum = window.reduce((s, d) => s + d.fiiNet, 0);
    const diiCum = window.reduce((s, d) => s + d.diiNet, 0);
    const fiiPos = window.filter((d) => d.fiiNet > 0).length;
    const fiiNeg = window.filter((d) => d.fiiNet < 0).length;
    const maxIn = window.reduce((m, d) => d.fiiNet > m.net ? { date: d.date, net: d.fiiNet } : m, { date: '', net: -Infinity });
    const maxOut = window.reduce((m, d) => d.fiiNet < m.net ? { date: d.date, net: d.fiiNet } : m, { date: '', net: Infinity });
    return {
      period: `${days}d`, fiiCumulative: mRound(fiiCum), diiCumulative: mRound(diiCum),
      netCumulative: mRound(fiiCum + diiCum),
      fiiAvgDaily: mRound(fiiCum / (window.length || 1)),
      diiAvgDaily: mRound(diiCum / (window.length || 1)),
      fiiPositiveDays: fiiPos, fiiNegativeDays: fiiNeg,
      maxFiiInflow: maxIn.net === -Infinity ? { date: '-', net: 0 } : maxIn,
      maxFiiOutflow: maxOut.net === Infinity ? { date: '-', net: 0 } : maxOut,
    };
  }

  /** Cross-market FII analysis */
  getCrossMarketFlow(date?: string): { market: string; fiiNet: number; diiNet: number; net: number }[] {
    const dayData = date ? this.data.filter((d) => d.date === date) : this.getLatest();
    return dayData.map((d) => ({ market: d.market, fiiNet: d.fiiNet, diiNet: d.diiNet, net: d.netFlow }));
  }

  // ═══════════ Sector Analysis ═══════════

  /** Get sector FII/DII flow for a date range */
  getSectorFlow(fromDate: string, toDate: string): FII_DII_SectorBreakdown[] {
    const sectorData = this.sectors.filter((s) => s.date >= fromDate && s.date <= toDate);
    const sectorMap = new Map<string, { fiiNet: number; diiNet: number; weight: number; count: number }>();
    for (const s of sectorData) {
      const e = sectorMap.get(s.sector) || { fiiNet: 0, diiNet: 0, weight: 0, count: 0 };
      e.fiiNet += s.fiiNet; e.diiNet += s.diiNet; e.weight = s.sectorWeight; e.count++;
      sectorMap.set(s.sector, e);
    }
    return [...sectorMap.entries()].map(([sector, v]) => ({
      date: `${fromDate}→${toDate}`, sector,
      fiiNet: mRound(v.fiiNet), diiNet: mRound(v.diiNet),
      netFlow: mRound(v.fiiNet + v.diiNet),
      sectorWeight: v.weight,
    })).sort((a, b) => b.fiiNet - a.fiiNet);
  }

  /** Detect sector rotation: sectors gaining vs losing FII flow */
  detectSectorRotation(): { gaining: string[]; losing: string[] } {
    const today = this.sectors.filter((s) => s.date === this.latest?.date);
    const gaining = today.filter((s) => s.fiiNet > 100).map((s) => s.sector);
    const losing = today.filter((s) => s.fiiNet < -100).map((s) => s.sector);
    return { gaining, losing };
  }

  // ═══════════ Alert Detection ═══════════

  detectAlerts(): FII_DII_Alert[] {
    this.alerts = [];
    const summary = this.getDailySummary();
    if (!summary || this.data.length < 5) return [];

    // FII surge: single day > ₹5000cr
    if (summary.fiiNetTotal > 5000) {
      this.alerts.push({ id: crypto.randomUUID(), type: 'fii_surge', severity: 'critical', detail: `FII bought ₹${summary.fiiNetTotal.toFixed(0)}cr today — 10x average`, createdAt: Date.now() });
    }

    // FII exodus: single day < -₹5000cr
    if (summary.fiiNetTotal < -5000) {
      this.alerts.push({ id: crypto.randomUUID(), type: 'fii_exodus', severity: 'critical', detail: `FII sold ₹${Math.abs(summary.fiiNetTotal).toFixed(0)}cr today — massive outflow`, createdAt: Date.now() });
    }

    // DII absorption: DII buying while FII selling
    if (summary.fiiNetTotal < -2000 && summary.diiNetTotal > 2000) {
      this.alerts.push({ id: crypto.randomUUID(), type: 'dii_absorption', severity: 'warning', detail: `DII absorbing FII selling: FII -₹${Math.abs(summary.fiiNetTotal).toFixed(0)}cr, DII +₹${summary.diiNetTotal.toFixed(0)}cr`, createdAt: Date.now() });
    }

    // Divergence: monthly FII negative, DII positive (structural shift)
    if (summary.fiiNetMonthly < -10000 && summary.diiNetMonthly > 8000) {
      this.alerts.push({ id: crypto.randomUUID(), type: 'divergence', severity: 'warning', detail: `30d structural divergence: FII -₹${Math.abs(summary.fiiNetMonthly).toFixed(0)}cr, DII +₹${summary.diiNetMonthly.toFixed(0)}cr`, createdAt: Date.now() });
    }

    return this.alerts;
  }

  getAlerts(severity?: FII_DII_Alert['severity']): FII_DII_Alert[] {
    return severity ? this.alerts.filter((a) => a.severity === severity) : [...this.alerts];
  }

  // ═══════════ Seed ═══════════

  seed(days = 60): number {
    const records: FII_DII_Day[] = [];
    for (let d = days; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const fiiBuy = Math.round((5000 + Math.random() * 15000));
      const fiiSell = Math.round((5000 + Math.random() * 15000));
      const diiBuy = Math.round((3000 + Math.random() * 10000));
      const diiSell = Math.round((3000 + Math.random() * 10000));
      records.push({
        date, market: 'cash',
        fiiGrossBuy: fiiBuy, fiiGrossSell: fiiSell, fiiNet: fiiBuy - fiiSell,
        diiGrossBuy: diiBuy, diiGrossSell: diiSell, diiNet: diiBuy - diiSell,
        netFlow: (fiiBuy - fiiSell) + (diiBuy - diiSell), source: 'SEBI',
      });
      records.push({
        date, market: 'futures', fiiGrossBuy: Math.round(fiiBuy * 0.6), fiiGrossSell: Math.round(fiiSell * 0.7),
        fiiNet: Math.round((fiiBuy - fiiSell) * 0.5), diiGrossBuy: Math.round(diiBuy * 0.2), diiGrossSell: Math.round(diiSell * 0.2),
        diiNet: Math.round((diiBuy - diiSell) * 0.2), netFlow: 0, source: 'NSE',
      });
    }
    return this.loadData(records);
  }
}

// Helper
function mRound(n: number): number { return Math.round(n * 100) / 100; }

// ═══════════ Singleton ═══════════

let fdeInstance: FII_DIIEngine | null = null;
export function getFII_DIIEngine(): FII_DIIEngine {
  if (!fdeInstance) fdeInstance = new FII_DIIEngine();
  return fdeInstance;
}
export function resetFII_DIIEngine(): void { fdeInstance = null; }
