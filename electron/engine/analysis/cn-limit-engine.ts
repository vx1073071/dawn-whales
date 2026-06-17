// ── R272 JVS-2 🇨🇳 涨跌停板引擎 (CNLimitEngine) ──
// A股涨跌停板数据 + 封单分析 + 开板预测 + 板块联动 + 连板检测

export interface LimitStock {
  code: string; // e.g. '600519', '000858'
  name: string;
  market: 'SH' | 'SZ' | 'BJ';
  sector: string;
  limitType: 'up_limit' | 'down_limit' | 'near_up_limit' | 'near_down_limit' | 'broke_up' | 'broke_down';
  currentPrice: number;
  prevClose: number;
  limitPrice: number; // exact limit price (±10%/±20%/±30% depending on board)
  limitPercent: number; // 10, 20, or 30
  openPrice: number;
  high: number; low: number;
  volume: number; // shares
  turnover: number; // CNY
  turnoverRate: number; // %
  limitLevel: number; // 1=涨停, 2=跌停, 3=近涨停(>7%), 4=近跌停(<-7%)
  sealVolume: number; // 封单量 (shares at limit price waiting)
  sealTurnover: number; // 封单金额
  sealRatio: number; // 封单/流通市值 或 封单/今日成交量
  consecutiveDays: number; // 连续涨停/跌停天数
  firstTimeLimit: number; // 首次涨停时间 (seconds from market open, 0=开盘即封)
  brokeCount: number; // 炸板次数 (当天打开再封)
  amplitude: number; // 振幅 (high-low)/prevClose
  previousDayLimit: boolean; // 前一日是否涨停
  sectorRank: number; // 板块内排名
}

export interface LimitSummary {
  date: string;
  upLimitCount: number;
  downLimitCount: number;
  nearUpCount: number;
  nearDownCount: number;
  totalStocks: number;
  upLimitRatio: number;
  sectorLeaders: SectorLimit[];
  continuousStocks: ConsecutiveLimit[];
  brokeCounts: { total: number; reSealed: number; fullBroke: number };
  marketSentiment: 'bullish' | 'bearish' | 'neutral' | 'extreme_bull' | 'extreme_bear';
  sentimentScore: number;
}

export interface SectorLimit {
  sector: string;
  upLimitCount: number;
  downLimitCount: number;
  sentiment: number; // -100 to 100
  leaderName: string;
  leaderCode: string;
}

export interface ConsecutiveLimit {
  code: string;
  name: string;
  sector: string;
  days: number;
  direction: 'up' | 'down';
  totalGain: number; // % cumulative
  sealTiming: number[]; // each day's first seal time
  todaySealVolume: number;
}

export interface LimitAlert {
  id: string;
  code: string; name: string;
  type: 'near_limit' | 'seal_broken' | 'new_consecutive' | 'consecutive_ended' | 'opening_dash' | 'limit_rare';
  severity: 'info' | 'warning' | 'action';
  detail: string; createdAt: number;
}

export interface LimitBacktest {
  code: string;
  firstLimitDate: string;
  consecutiveDays: number;
  totalReturn: number; // cumulative % from first limit
  maxReturn: number;
  finalReturn: number; // after X days
  win: boolean; // overall positive
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class CNLimitEngine {
  private data: LimitStock[] = [];
  private historicalDates = new Map<string, LimitStock[]>();
  private alerts: LimitAlert[] = [];

  reset(): void { this.data = []; this.historicalDates.clear(); this.alerts = []; }

  // ═══════════ Limit Price Calculation ═══════════

  /** Calculate limit price for a stock (board-aware) */
  static calcLimitPrice(prevClose: number, market: 'SH' | 'SZ' | 'BJ', direction: 'up' | 'down', isST = false, isStar = false): { limitPrice: number; limitPercent: number } {
    let pct = 0.10; // Main board default
    if (market === 'BJ') pct = 0.30; // Beijing Stock Exchange 30%
    else if (market === 'SH' && (isStar || (prevClose > 0 && prevClose < 10))) {
      // STAR board (科创板) = 20%, or new stocks first 5 days no limit
    }
    // SZ ChiNext (创业板) stock codes starting with 300 also 20% — caller determines

    const limitPrice = prevClose * (direction === 'up' ? 1 + pct : 1 - pct);
    // Round to 2 decimal places for CNY stocks
    return { limitPrice: Math.round(limitPrice * 100) / 100, limitPercent: pct };
  }

  /** Classify stock: up_limit / down_limit / near_limit / normal */
  static classify(price: number, prevClose: number, market: 'SH' | 'SZ' | 'BJ', isST = false, isStar = false): {
    type: LimitStock['limitType']; level: number; limitPrice: number; distancePct: number;
  } {
    const { limitPrice: upLimit } = CNLimitEngine.calcLimitPrice(prevClose, market, 'up', isST, isStar);
    const { limitPrice: downLimit } = CNLimitEngine.calcLimitPrice(prevClose, market, 'down', isST, isStar);
    const change = (price - prevClose) / prevClose;
    const threshold = market === 'BJ' ? 0.20 : isStar ? 0.15 : 0.07;

    if (price >= upLimit) return { type: 'up_limit', level: 1, limitPrice: upLimit, distancePct: change };
    if (price <= downLimit) return { type: 'down_limit', level: 2, limitPrice: downLimit, distancePct: change };
    if (change >= threshold) return { type: 'near_up_limit', level: 3, limitPrice: upLimit, distancePct: change };
    if (change <= -threshold) return { type: 'near_down_limit', level: 4, limitPrice: downLimit, distancePct: change };

    return { type: price > upLimit * 0.99 ? 'broke_up' : price < downLimit * 1.01 ? 'broke_down' : 'near_up_limit', level: 0, limitPrice: upLimit, distancePct: change };
  }

  // ═══════════ Data Loading ═══════════

  loadData(records: LimitStock[]): number {
    const existing = new Set(this.data.map((d) => d.code));
    let added = 0;
    for (const r of records) {
      if (!existing.has(r.code)) {
        this.data.push(r);
        existing.add(r.code);
        added++;
      }
    }
    return added;
  }

  /** Store historical by date */
  snapshot(date: string): void { this.historicalDates.set(date, [...this.data]); }

  getByDate(date: string): LimitStock[] { return this.historicalDates.get(date) || []; }

  // ═══════════ Daily Summary ═══════════

  getDailySummary(): LimitSummary {
    const up = this.data.filter((d) => d.limitType === 'up_limit');
    const down = this.data.filter((d) => d.limitType === 'down_limit');
    const nearUp = this.data.filter((d) => d.limitType === 'near_up_limit');
    const nearDown = this.data.filter((d) => d.limitType === 'near_down_limit');
    let broke = this.data.filter((d) => d.limitType === 'broke_up' || d.limitType === 'broke_down');

    // Sector sentiment
    const sectorMap = new Map<string, { up: number; down: number; leader: LimitStock }>();
    for (const s of up) {
      const e = sectorMap.get(s.sector) || { up: 0, down: 0, leader: s };
      e.up++; if (!e.leader || s.sealVolume > e.leader.sealVolume) e.leader = s;
      sectorMap.set(s.sector, e);
    }
    for (const s of down) {
      const e = sectorMap.get(s.sector) || { up: 0, down: 0, leader: s };
      e.down++; sectorMap.set(s.sector, e);
    }

    const sectorLeaders: SectorLimit[] = [...sectorMap.entries()].map(([sector, v]) => ({
      sector, upLimitCount: v.up, downLimitCount: v.down,
      sentiment: v.up + v.down > 0 ? ((v.up - v.down) / (v.up + v.down)) * 100 : 0,
      leaderName: v.leader.name, leaderCode: v.leader.code,
    })).sort((a, b) => b.upLimitCount + b.downLimitCount - a.upLimitCount - a.downLimitCount);

    // Consecutive detection: group by consecutiveDays >= 2
    const continuousStocks: ConsecutiveLimit[] = up.filter((d) => d.consecutiveDays >= 2).map((d) => ({
      code: d.code, name: d.name, sector: d.sector, days: d.consecutiveDays,
      direction: 'up', totalGain: ((d.currentPrice / d.prevClose) - 1) * 100,
      sealTiming: [d.firstTimeLimit], todaySealVolume: d.sealVolume,
    })).sort((a, b) => b.days - a.days);

    const brokeCounts = { total: broke.length, reSealed: broke.filter((d) => d.brokeCount > 0 && d.limitType === 'up_limit').length, fullBroke: broke.filter((d) => d.brokeCount > 0 && d.limitType === 'broke_up').length };

    // Sentiment: up/down ratio
    const ratio = down.length === 0 ? 9 : up.length / down.length;
    let sentiment: LimitSummary['marketSentiment']; let sentimentScore = 0;
    if (ratio > 5) { sentiment = 'extreme_bull'; sentimentScore = 80 + Math.min(ratio * 2, 20); }
    else if (ratio > 2) { sentiment = 'bullish'; sentimentScore = 50 + (ratio - 2) * 15; }
    else if (ratio > 0.8) { sentiment = 'neutral'; sentimentScore = 50 + (ratio - 1) * 50; }
    else if (ratio > 0.3) { sentiment = 'bearish'; sentimentScore = 50 - (1 - ratio) * 50; }
    else { sentiment = 'extreme_bear'; sentimentScore = 20 - Math.min((1 - ratio) * 15, 20); }

    return {
      date: new Date().toISOString().slice(0, 10), upLimitCount: up.length, downLimitCount: down.length,
      nearUpCount: nearUp.length, nearDownCount: nearDown.length, totalStocks: this.data.length,
      upLimitRatio: this.data.length > 0 ? up.length / this.data.length : 0,
      sectorLeaders, continuousStocks, brokeCounts, marketSentiment: sentiment, sentimentScore,
    };
  }

  // ═══════════ Sector Leader Board ═══════════

  getSectorLimitRank(): SectorLimit[] {
    const sectorMap = new Map<string, { up: number; down: number; leaders: LimitStock[] }>();
    for (const s of this.data) {
      const e = sectorMap.get(s.sector) || { up: 0, down: 0, leaders: [] };
      if (s.limitType === 'up_limit') e.up++;
      if (s.limitType === 'down_limit') e.down++;
      e.leaders.push(s);
      sectorMap.set(s.sector, e);
    }
    return [...sectorMap.entries()].map(([sector, v]) => ({
      sector, upLimitCount: v.up, downLimitCount: v.down,
      sentiment: v.up + v.down > 0 ? ((v.up - v.down) / (v.up + v.down)) * 100 : 0,
      leaderName: v.leaders.sort((a, b) => b.sealVolume - a.sealVolume)[0]?.name || '-',
      leaderCode: v.leaders.sort((a, b) => b.sealVolume - a.sealVolume)[0]?.code || '-',
    })).sort((a, b) => b.upLimitCount - a.upLimitCount);
  }

  // ═══════════ Query ═══════════

  getUpLimitStocks(): LimitStock[] { return this.data.filter((d) => d.limitType === 'up_limit').sort((a, b) => b.sealVolume - a.sealVolume); }
  getDownLimitStocks(): LimitStock[] { return this.data.filter((d) => d.limitType === 'down_limit').sort((a, b) => b.sealVolume - a.sealVolume); }
  getNearLimitStocks(): LimitStock[] { return this.data.filter((d) => d.limitType === 'near_up_limit' || d.limitType === 'near_down_limit'); }
  getConsecutiveUp(days = 2): LimitStock[] { return this.data.filter((d) => d.consecutiveDays >= days && d.limitType === 'up_limit').sort((a, b) => b.consecutiveDays - a.consecutiveDays); }

  getByCode(code: string): LimitStock | undefined { return this.data.find((d) => d.code === code); }

  // ═══════════ Consecutive Limit Analysis ═══════════

  /** Find all stocks with consecutive limits and produce a narrative */
  analyzeConsecutive(): ConsecutiveLimit[] {
    const results: ConsecutiveLimit[] = [];
    const seen = new Set<string>();

    for (const s of this.data) {
      if (s.consecutiveDays >= 2 && !seen.has(s.code)) {
        seen.add(s.code);
        results.push({
          code: s.code, name: s.name, sector: s.sector, days: s.consecutiveDays,
          direction: s.limitType === 'up_limit' ? 'up' : 'down',
          totalGain: ((s.currentPrice / s.prevClose) - 1) * 100,
          sealTiming: [s.firstTimeLimit], todaySealVolume: s.sealVolume,
        });
      }
    }
    return results.sort((a, b) => b.days - a.days);
  }

  // ═══════════ Break Analysis ═══════════

  /** Find stocks that broke through a limit level */
  getBreakStocks(): LimitStock[] {
    return this.data.filter((d) => d.limitType === 'broke_up' || d.limitType === 'broke_down')
      .sort((a, b) => Math.abs(b.amplitude) - Math.abs(a.amplitude));
  }

  /** Detect stocks at risk of opening the limit */
  detectRiskStocks(sealRatioThreshold = 0.05): LimitStock[] {
    return this.data.filter((d) => d.limitType === 'up_limit' && d.sealRatio < sealRatioThreshold && d.amplitude > 0.03);
  }

  // ═══════════ Alert Detection ═══════════

  detectAlerts(): LimitAlert[] {
    this.alerts = [];

    // Near limit approaching: high momentum toward limit
    for (const s of this.data) {
      const changePct = (s.currentPrice - s.prevClose) / s.prevClose;
      if (changePct > 0.088 && s.limitType === 'near_up_limit') {
        this.alerts.push({ id: crypto.randomUUID(), code: s.code, name: s.name, type: 'near_limit', severity: 'warning', detail: `${s.name} approaching up-limit at +${(changePct * 100).toFixed(1)}%`, createdAt: Date.now() });
      }
      if (changePct < -0.088 && s.limitType === 'near_down_limit') {
        this.alerts.push({ id: crypto.randomUUID(), code: s.code, name: s.name, type: 'near_limit', severity: 'warning', detail: `${s.name} approaching down-limit at ${(changePct * 100).toFixed(1)}%`, createdAt: Date.now() });
      }
    }

    // Seal broken
    for (const s of this.getBreakStocks()) {
      this.alerts.push({ id: crypto.randomUUID(), code: s.code, name: s.name, type: 'seal_broken', severity: 'action', detail: `${s.name} limit seal broken! Broke ${s.brokeCount}x, amplitude ${(s.amplitude * 100).toFixed(1)}%`, createdAt: Date.now() });
    }

    // New consecutive day record
    for (const s of this.getConsecutiveUp(3)) {
      this.alerts.push({ id: crypto.randomUUID(), code: s.code, name: s.name, type: 'new_consecutive', severity: 'action', detail: `${s.name} ${s.consecutiveDays}d consecutive up-limit!`, createdAt: Date.now() });
    }

    return this.alerts;
  }

  getAlerts(severity?: LimitAlert['severity']): LimitAlert[] {
    return severity ? this.alerts.filter((a) => a.severity === severity) : [...this.alerts];
  }

  // ═══════════ Backtest ═══════════

  /** Backtest buying on first limit day */
  backtestFromFirstLimit(
    historicalDays: Array<{ date: string; stocks: LimitStock[] }>, holdDays = 5,
  ): LimitBacktest[] {
    const results: LimitBacktest[] = [];
    const allStocks = new Map<string, Array<{ date: string; stock: LimitStock }>>();

    for (const day of historicalDays) {
      for (const s of day.stocks) {
        if (s.consecutiveDays === 1 && s.limitType === 'up_limit') {
          const arr = allStocks.get(s.code) || [];
          arr.push({ date: day.date, stock: s });
          allStocks.set(s.code, arr);
        }
      }
    }

    for (const [code, entries] of allStocks) {
      for (const entry of entries) {
        const startIdx = historicalDays.findIndex((d) => d.date === entry.date);
        if (startIdx < 0) continue;

        let totalReturn = 0; let maxReturn = -Infinity;
        const limit = Math.min(holdDays, historicalDays.length - startIdx - 1);

        for (let i = 1; i <= limit; i++) {
          const nextDay = historicalDays[startIdx + i];
          const nextStock = nextDay?.stocks.find((s) => s.code === code);
          if (nextStock) {
            const dayReturn = (nextStock.currentPrice - entry.stock.limitPrice) / entry.stock.limitPrice;
            totalReturn += dayReturn;
            maxReturn = Math.max(maxReturn, dayReturn);
          }
        }

        results.push({
          code, firstLimitDate: entry.date, consecutiveDays: entry.stock.consecutiveDays,
          totalReturn, maxReturn: maxReturn === -Infinity ? 0 : maxReturn,
          finalReturn: totalReturn, win: totalReturn > 0,
        });
      }
    }

    return results;
  }

  // ═══════════ Seed Data ═══════════

  seed(count = 50): number {
    const sectors = ['消费电子', '新能源', '金融', '医药', '地产', '半导体', '白酒', '汽车', 'AI', '电力'];
    const records: LimitStock[] = [];

    for (let i = 0; i < count; i++) {
      const code = `600${String(100 + i).slice(0, 3)}`;
      const sector = sectors[i % sectors.length];
      const prevClose = 10 + Math.random() * 100;
      const changePct = (Math.random() - 0.5) * 0.22;
      const currentPrice = Math.round(prevClose * (1 + changePct) * 100) / 100;
      const classification = CNLimitEngine.classify(currentPrice, prevClose, 'SH');
      const sealVol = Math.round(Math.random() * 50000000);
      const totalVol = Math.round(sealVol * (1 + Math.random() * 5));

      records.push({
        code, name: `${sector}${i + 1}`, market: i % 3 === 0 ? 'SH' : i % 3 === 1 ? 'SZ' : 'BJ',
        sector, limitType: classification.type, currentPrice, prevClose,
        limitPrice: classification.limitPrice, limitPercent: i % 3 === 2 ? 30 : 10,
        openPrice: prevClose + Math.random() * 2, high: currentPrice + Math.random() * 1,
        low: prevClose - Math.random() * 2, volume: totalVol, turnover: Math.round(totalVol * currentPrice),
        turnoverRate: Math.random() * 20, limitLevel: classification.level,
        sealVolume: sealVol, sealTurnover: Math.round(sealVol * classification.limitPrice),
        sealRatio: sealVol / totalVol, consecutiveDays: Math.floor(Math.random() * 5) + 1,
        firstTimeLimit: Math.round(Math.random() * 14400),
        brokeCount: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0,
        amplitude: Math.random() * 0.15, previousDayLimit: Math.random() > 0.6, sectorRank: i + 1,
      });
    }
    return this.loadData(records);
  }
}

// ═══════════ Singleton ═══════════

let cleInstance: CNLimitEngine | null = null;
export function getCNLimitEngine(): CNLimitEngine {
  if (!cleInstance) cleInstance = new CNLimitEngine();
  return cleInstance;
}
export function resetCNLimitEngine(): void { cleInstance = null; }
