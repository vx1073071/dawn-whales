// ── R272 JVS-3 🇯🇵 信用管线 (JPCreditEngine) ──
// 日本信用交易数据管道: 融资融券 + 制度信用 + 一般信用 + 信用残 + 貸借 + JPX集成

export interface JPCreditStock {
  code: string; // JP code e.g. '7203', '9984'
  name: string;
  nameJA: string; // Japanese name
  market: 'TSE1' | 'TSE2' | 'Mothers' | 'JASDAQ';
  sector: string;
  /** 融资 (margin buy / 信用買い) */
  marginBuy: {
    current: number; // shares
    previous: number;
    change: number; // MoM
    changePercent: number;
  };
  /** 融券 (margin sell / 信用売り) */
  marginSell: {
    current: number; // shares
    previous: number;
    change: number;
    changePercent: number;
  };
  /** 貸借倍率 (loan ratio) = marginBuy / marginSell */
  loanRatio: number;
  /** 信用买残 (system credit buy balance) */
  systemCreditBalance: number;
  /** 一般信用 (general credit / 一般信用取引) */
  generalCredit: {
    buy: number; sell: number; ratio: number;
  };
  /** 逆日歩 (reverse daily rate / fee for short sellers) */
  reverseDailyRate: number; // JPY/share — if >0, short squeeze pressure
  /** 品貸料 (stock lending fee) */
  stockLendingFee: number;
  /** Credit balance trend */
  balanceTrend: 'increasing_buy' | 'increasing_sell' | 'balanced' | 'squeeze_risk';
  /** Date */
  date: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number; // JPY
  shortInterest: number; // % of float
  daysToCover: number; // shortInterest / avgDailyVolume
}

export interface JPCreditSummary {
  date: string;
  totalMarginBuy: number; // JPY
  totalMarginSell: number;
  overallLoanRatio: number;
  stockCount: number;
  topLoanRatioStocks: JPCreditStock[]; // high loan ratio = bullish
  topShortInterestStocks: JPCreditStock[]; // high short interest = bearish
  reverseDailyRateLeaders: JPCreditStock[]; // negative rate = short squeeze
  sectorFlow: SectorCreditFlow[];
  squeezeCandidates: SqueezeCandidate[];
}

export interface SectorCreditFlow {
  sector: string;
  marginBuyChange: number; // MoM net change (shares)
  marginSellChange: number;
  netFlow: number; // positive = buyers dominating
  stockCount: number;
  flowDirection: 'inflow' | 'outflow' | 'neutral';
  avgLoanRatio: number;
}

export interface SqueezeCandidate {
  code: string; name: string; sector: string;
  loanRatio: number;
  reverseDailyRate: number;
  shortInterest: number;
  daysToCover: number;
  score: number; // 0-100 squeeze score
  severity: 'low' | 'medium' | 'high' | 'extreme';
}

export interface JPCreditAlert {
  id: string; code: string; name: string;
  type: 'squeeze_warning' | 'credit_surge' | 'reverse_rate_spike' | 'margin_call_risk' | 'loan_ratio_extreme';
  severity: 'info' | 'warning' | 'critical';
  detail: string; createdAt: number;
}

export interface JPCreditQuery {
  code?: string; sector?: string; market?: JPCreditStock['market'];
  minLoanRatio?: number; maxLoanRatio?: number;
  minShortInterest?: number; hasReverseRate?: boolean;
  balanceTrend?: JPCreditStock['balanceTrend'];
  sortBy?: 'loanRatio' | 'shortInterest' | 'reverseDailyRate' | 'marketCap';
  limit?: number;
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class JPCreditEngine {
  private data: JPCreditStock[] = [];
  private history = new Map<string, JPCreditStock[]>();
  private alerts: JPCreditAlert[] = [];

  reset(): void { this.data = []; this.history.clear(); this.alerts = []; }

  // ═══════════ Data Pipeline ═══════════

  /** Load batch from JPX credit data feed */
  loadData(records: JPCreditStock[]): number {
    const existing = new Set(this.data.map((d) => `${d.date}|${d.code}`));
    let added = 0;
    for (const r of records) {
      const key = `${r.date}|${r.code}`;
      if (!existing.has(key)) {
        this.data.forEach((old) => { if (old.code === r.code && old.date !== r.date) this.archive(old); });
        this.data = this.data.filter((d) => d.code !== r.code);
        this.data.push(r);
        existing.add(key);
        added++;
      }
    }
    return added;
  }

  private archive(record: JPCreditStock): void {
    const arr = this.history.get(record.code) || [];
    arr.push(record);
    this.history.set(record.code, arr.slice(-90)); // keep 90 days
  }

  /** Get latest credit data for all stocks */
  getLatest(): JPCreditStock[] { return [...this.data]; }

  /** Get historical credit data for a stock */
  getHistory(code: string, days = 20): JPCreditStock[] {
    const arr = this.history.get(code) || [];
    return arr.slice(-days);
  }

  // ═══════════ Query ═══════════

  query(q?: JPCreditQuery): JPCreditStock[] {
    let results = [...this.data];
    if (q?.code) results = results.filter((d) => d.code === q.code);
    if (q?.sector) results = results.filter((d) => d.sector === q.sector);
    if (q?.market) results = results.filter((d) => d.market === q.market);
    if (q?.minLoanRatio) results = results.filter((d) => d.loanRatio >= q.minLoanRatio!);
    if (q?.maxLoanRatio) results = results.filter((d) => d.loanRatio <= q.maxLoanRatio!);
    if (q?.minShortInterest) results = results.filter((d) => d.shortInterest >= q.minShortInterest!);
    if (q?.hasReverseRate) results = results.filter((d) => d.reverseDailyRate > 0);
    if (q?.balanceTrend) results = results.filter((d) => d.balanceTrend === q.balanceTrend);

    const sortBy = q?.sortBy || 'loanRatio';
    results.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
    if (q?.limit) results = results.slice(0, q.limit);
    return results;
  }

  /** Get single stock credit data */
  getByCode(code: string): JPCreditStock | undefined { return this.data.find((d) => d.code === code); }

  // ═══════════ Daily Summary / Market-level ═══════════

  getDailySummary(): JPCreditSummary {
    if (this.data.length === 0) return {
      date: '', totalMarginBuy: 0, totalMarginSell: 0, overallLoanRatio: 0, stockCount: 0,
      topLoanRatioStocks: [], topShortInterestStocks: [], reverseDailyRateLeaders: [],
      sectorFlow: [], squeezeCandidates: [],
    };

    const totalMB = this.data.reduce((s, d) => s + d.marginBuy.current, 0);
    const totalMS = this.data.reduce((s, d) => s + d.marginSell.current, 0);
    const overallRatio = totalMS > 0 ? totalMB / totalMS : 0;

    // Sector flow
    const sectorMap = new Map<string, { mbChange: number; msChange: number; count: number; loanRatios: number[] }>();
    for (const s of this.data) {
      const e = sectorMap.get(s.sector) || { mbChange: 0, msChange: 0, count: 0, loanRatios: [] };
      e.mbChange += s.marginBuy.change;
      e.msChange += s.marginSell.change;
      e.count++;
      e.loanRatios.push(s.loanRatio);
      sectorMap.set(s.sector, e);
    }

    const sectorFlow: SectorCreditFlow[] = [...sectorMap.entries()].map(([sector, v]) => {
      const netFlow = v.mbChange - v.msChange;
      return {
        sector, marginBuyChange: v.mbChange, marginSellChange: v.msChange,
        netFlow, stockCount: v.count,
        flowDirection: Math.abs(netFlow) < 100000 ? 'neutral' : netFlow > 0 ? 'inflow' : 'outflow',
        avgLoanRatio: v.loanRatios.length > 0 ? v.loanRatios.reduce((s, r) => s + r, 0) / v.loanRatios.length : 0,
      };
    }).sort((a, b) => b.netFlow - a.netFlow);

    // Squeeze candidates: reverseDailyRate > 0 AND high loan ratio
    const squeezeCandidates = this.detectSqueezeCandidates(0);

    return {
      date: this.data[0]?.date || '', totalMarginBuy: totalMB, totalMarginSell: totalMS,
      overallLoanRatio: overallRatio, stockCount: this.data.length,
      topLoanRatioStocks: [...this.data].sort((a, b) => b.loanRatio - a.loanRatio).slice(0, 10),
      topShortInterestStocks: [...this.data].sort((a, b) => b.shortInterest - a.shortInterest).slice(0, 10),
      reverseDailyRateLeaders: [...this.data].filter((d) => d.reverseDailyRate > 0).sort((a, b) => b.reverseDailyRate - a.reverseDailyRate).slice(0, 10),
      sectorFlow, squeezeCandidates,
    };
  }

  // ═══════════ Squeeze Detection ═══════════

  /** Score and rank short squeeze candidates */
  detectSqueezeCandidates(reverseRateThreshold = 0): SqueezeCandidate[] {
    return this.data.filter((d) => d.reverseDailyRate > reverseRateThreshold && d.loanRatio > 1.5).map((d) => {
      const loanScore = Math.min(d.loanRatio / 5, 1) * 25;
      const rateScore = Math.min(d.reverseDailyRate * 100, 1) * 25;
      const siScore = Math.min(d.shortInterest / 50, 1) * 25;
      const dtcScore = Math.min(d.daysToCover / 10, 1) * 25;
      const score = Math.round(loanScore + rateScore + siScore + dtcScore);
      return {
        code: d.code, name: d.name, sector: d.sector, loanRatio: d.loanRatio,
        reverseDailyRate: d.reverseDailyRate, shortInterest: d.shortInterest,
        daysToCover: d.daysToCover, score,
        severity: score >= 75 ? 'extreme' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
      };
    }).sort((a, b) => b.score - a.score);
  }

  // ═══════════ Balance Trend Analysis ═══════════

  /** Classify balance trend: increasing buy vs sell */
  analyzeBalanceTrend(code: string): JPCreditStock['balanceTrend'] | null {
    const history = this.getHistory(code, 20);
    if (history.length < 5) return null;

    const current = history[history.length - 1];
    const buyChangeRate = current.marginBuy.previous > 0 ? current.marginBuy.change / current.marginBuy.previous : 0;
    const sellChangeRate = current.marginSell.previous > 0 ? current.marginSell.change / current.marginSell.previous : 0;

    if (buyChangeRate > 0.1 && sellChangeRate < 0) return 'increasing_buy';
    if (sellChangeRate > 0.1 && buyChangeRate < 0) return 'increasing_sell';
    if (buyChangeRate > 0.15) return 'squeeze_risk';
    return 'balanced';
  }

  // ═══════════ Sector Credit Flow ═══════════

  getSectorCreditFlow(): SectorCreditFlow[] {
    const sectorMap = new Map<string, { mbChange: number; msChange: number; count: number; loanRatios: number[] }>();
    for (const s of this.data) {
      const e = sectorMap.get(s.sector) || { mbChange: 0, msChange: 0, count: 0, loanRatios: [] };
      e.mbChange += s.marginBuy.change;
      e.msChange += s.marginSell.change;
      e.count++;
      e.loanRatios.push(s.loanRatio);
      sectorMap.set(s.sector, e);
    }
    return [...sectorMap.entries()].map(([s, v]) => {
      const net = v.mbChange - v.msChange;
      return {
        sector: s, marginBuyChange: v.mbChange, marginSellChange: v.msChange,
        netFlow: net, stockCount: v.count,
        flowDirection: Math.abs(net) < 1e5 ? 'neutral' : net > 0 ? 'inflow' : 'outflow',
        avgLoanRatio: v.loanRatios.length > 0 ? v.loanRatios.reduce((a, b) => a + b, 0) / v.loanRatios.length : 0,
      };
    }).sort((a, b) => b.netFlow - a.netFlow);
  }

  // ═══════════ Alert System ═══════════

  detectAlerts(): JPCreditAlert[] {
    this.alerts = [];

    for (const s of this.data) {
      // Squeeze warning: reverse rate > 1 JPY
      if (s.reverseDailyRate > 1) {
        this.alerts.push({
          id: crypto.randomUUID(), code: s.code, name: s.name, type: 'squeeze_warning',
          severity: s.reverseDailyRate > 5 ? 'critical' : 'warning',
          detail: `${s.name}: reverse daily rate ${s.reverseDailyRate.toFixed(1)} JPY/share — short squeeze risk!`,
          createdAt: Date.now(),
        });
      }

      // Loan ratio extreme (>5 = very bullish margin, <0.3 = bearish)
      if (s.loanRatio > 5) {
        this.alerts.push({
          id: crypto.randomUUID(), code: s.code, name: s.name, type: 'loan_ratio_extreme',
          severity: s.loanRatio > 10 ? 'critical' : 'warning',
          detail: `${s.name}: loan ratio ${s.loanRatio.toFixed(1)}x — extreme bullish margin positioning`,
          createdAt: Date.now(),
        });
      }

      // Margin call risk: declining price + high margin buy
      if (s.changePercent < -5 && s.loanRatio > 3) {
        this.alerts.push({
          id: crypto.randomUUID(), code: s.code, name: s.name, type: 'margin_call_risk',
          severity: s.changePercent < -8 ? 'critical' : 'warning',
          detail: `${s.name}: ${s.changePercent.toFixed(1)}% drop with ${s.loanRatio.toFixed(1)}x loan ratio — margin call risk`,
          createdAt: Date.now(),
        });
      }

      // Credit surge: margin buy MoM change > 30%
      if (s.marginBuy.changePercent > 30) {
        this.alerts.push({
          id: crypto.randomUUID(), code: s.code, name: s.name, type: 'credit_surge',
          severity: s.marginBuy.changePercent > 60 ? 'critical' : 'info',
          detail: `${s.name}: margin buy +${s.marginBuy.changePercent.toFixed(0)}% MoM — significant credit expansion`,
          createdAt: Date.now(),
        });
      }
    }

    return this.alerts;
  }

  getAlerts(severity?: JPCreditAlert['severity']): JPCreditAlert[] {
    return severity ? this.alerts.filter((a) => a.severity === severity) : [...this.alerts];
  }

  // ═══════════ Reverse Daily Rate Leaders ═══════════

  getReverseRateLeaders(minRate = 0): JPCreditStock[] {
    return this.data.filter((d) => d.reverseDailyRate >= minRate).sort((a, b) => b.reverseDailyRate - a.reverseDailyRate);
  }

  // ═══════════ Loan Ratio Distribution ═══════════

  getLoanRatioDistribution(): { range: string; count: number; percent: number }[] {
    const ranges = [
      { label: '<0.5x', min: 0, max: 0.5 },
      { label: '0.5-1x', min: 0.5, max: 1 },
      { label: '1-2x', min: 1, max: 2 },
      { label: '2-3x', min: 2, max: 3 },
      { label: '3-5x', min: 3, max: 5 },
      { label: '>5x', min: 5, max: Infinity },
    ];
    return ranges.map(({ label, min, max }) => {
      const count = this.data.filter((d) => d.loanRatio >= min && d.loanRatio < max).length;
      return { range: label, count, percent: this.data.length > 0 ? count / this.data.length * 100 : 0 };
    });
  }

  // ═══════════ Seed ═══════════

  seed(count = 40): number {
    const sectors = ['自動車', '半導体', '金融', '医薬品', '商社', '通信', '小売', '電機'];
    const records: JPCreditStock[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < count; i++) {
      const code = `${7000 + i * 10}`;
      const sector = sectors[i % sectors.length];
      const marginBuyCurr = Math.round((500000 + Math.random() * 5000000) * (0.5 + Math.random()));
      const marginSellCurr = Math.round(marginBuyCurr * (0.3 + Math.random() * 1.5));
      const reverseRate = Math.random() > 0.7 ? Math.round(Math.random() * 30) / 10 : 0;

      records.push({
        code, name: `${sector}${i + 1}`, nameJA: `${sector}${i + 1}株式会社`,
        market: 'TSE1', sector,
        marginBuy: { current: marginBuyCurr, previous: Math.round(marginBuyCurr * 0.9), change: Math.round(marginBuyCurr * 0.1), changePercent: Math.round(Math.random() * 40) },
        marginSell: { current: marginSellCurr, previous: Math.round(marginSellCurr * 0.95), change: Math.round(marginSellCurr * 0.05), changePercent: Math.round(Math.random() * 30) },
        loanRatio: marginSellCurr > 0 ? Math.round(marginBuyCurr / marginSellCurr * 100) / 100 : 0,
        systemCreditBalance: marginBuyCurr - marginSellCurr,
        generalCredit: { buy: marginBuyCurr * 0.3, sell: marginSellCurr * 0.3, ratio: 0 },
        reverseDailyRate: reverseRate,
        stockLendingFee: 0.5 + Math.random() * 3,
        balanceTrend: Math.random() > 0.5 ? 'increasing_buy' : 'balanced',
        date: today, price: 1000 + Math.random() * 5000,
        changePercent: (Math.random() - 0.5) * 10, volume: Math.round(500000 + Math.random() * 5000000),
        marketCap: 1e12 + Math.random() * 1e13,
        shortInterest: Math.random() * 20, daysToCover: Math.random() * 15,
      });
    }
    return this.loadData(records);
  }
}

// ═══════════ Singleton ═══════════

let jceInstance: JPCreditEngine | null = null;
export function getJPCreditEngine(): JPCreditEngine {
  if (!jceInstance) jceInstance = new JPCreditEngine();
  return jceInstance;
}
export function resetJPCreditEngine(): void { jceInstance = null; }
