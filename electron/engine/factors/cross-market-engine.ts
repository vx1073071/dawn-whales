// R197 J2: Cross-Market Factor Comparison Engine
// 1 factor x 10 markets IC horizontal comparison
import log from 'electron-log';

export interface CrossMarketIC {
  factorId: string;
  icByMarket: Record<string, { ic: number; ir: number; rank: number; samples: number; period: string }>;
  timestamp: number;
}

export interface TopMarketFactor {
  market: string;
  factorId: string;
  ic: number;
  ir: number;
  rankInMarket: number;
}

export interface FactorMarketDivergence {
  factorId: string;
  icMean: number;
  icStd: number;
  icRange: number;
  bestMarket: string;
  worstMarket: string;
  marketsWithSignal: number;
  verdict: 'universal' | 'regional' | 'fragmented';
}

export class CrossMarketComparisonEngine {
  private icStore = new Map<string, Map<string, number[]>>();
  private readonly MARKETS = ['HK','US','CC','JP','TW','KR','SG','AU','IN','EU'];

  constructor() {
    log.info('[CrossMarketEngine] Initialized for 10 markets');
  }

  getMarkets(): string[] { return [...this.MARKETS]; }

  recordIC(factorId: string, market: string, ic: number): void {
    if (!this.icStore.has(factorId)) {
      this.icStore.set(factorId, new Map());
    }
    const marketMap = this.icStore.get(factorId)!;
    if (!marketMap.has(market)) marketMap.set(market, []);
    marketMap.get(market)!.push(ic);
  }

  recordBulk(entries: Array<{ factorId: string; market: string; ic: number }>): void {
    for (const e of entries) this.recordIC(e.factorId, e.market, e.ic);
  }

  getFactorIC(factorId: string): CrossMarketIC | null {
    const marketMap = this.icStore.get(factorId);
    if (!marketMap) return null;

    const icByMarket: CrossMarketIC['icByMarket'] = {};
    for (const [mkt, ics] of Array.from(marketMap.entries())) {
      if (ics.length === 0) continue;
      const icMean = ics.reduce((s, v) => s + v, 0) / ics.length;
      const icStd = Math.sqrt(ics.reduce((s, v) => s + (v - icMean) ** 2, 0) / ics.length);
      const ir = icStd > 0 ? icMean / icStd : 0;
      icByMarket[mkt] = { ic: icMean, ir, rank: 0, samples: ics.length, period: 'rolling_12m' };
    }

    // Rank within factor by IC
    const sorted = Object.entries(icByMarket).sort((a, b) => b[1].ic - a[1].ic);
    sorted.forEach(([, v], i) => { v.rank = i + 1; });

    return { factorId, icByMarket, timestamp: Date.now() };
  }

  getTopFactorsPerMarket(limit = 10): Record<string, TopMarketFactor[]> {
    const result: Record<string, TopMarketFactor[]> = {};
    for (const mkt of this.MARKETS) {
      const factors: Array<{ id: string; ic: number; ir: number }> = [];
      for (const [fid, marketMap] of Array.from(this.icStore.entries())) {
        const ics = marketMap.get(mkt);
        if (!ics || ics.length === 0) continue;
        const ic = ics.reduce((a, b) => a + b, 0) / ics.length;
        const icStd = Math.sqrt(ics.reduce((a, b) => a + (b - ic) ** 2, 0) / ics.length);
        const ir = icStd > 0 ? ic / icStd : 0;
        factors.push({ id: fid, ic, ir });
      }
      factors.sort((a, b) => b.ic - a.ic);
      result[mkt] = factors.slice(0, limit).map((f, i) => ({ market: mkt, factorId: f.id, ic: f.ic, ir: f.ir, rankInMarket: i + 1 }));
    }
    return result;
  }

  getFactorDivergence(factorId: string): FactorMarketDivergence | null {
    const marketMap = this.icStore.get(factorId);
    if (!marketMap) return null;

    const ics: number[] = [];
    let bestMarket = '', worstMarket = '';
    let bestIc = -Infinity, worstIc = Infinity;
    let marketsWithSignal = 0;

    for (const [mkt, vals] of Array.from(marketMap.entries())) {
      if (vals.length === 0) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      ics.push(avg);
      if (Math.abs(avg) > 0.03) marketsWithSignal++;
      if (avg > bestIc) { bestIc = avg; bestMarket = mkt; }
      if (avg < worstIc) { worstIc = avg; worstMarket = mkt; }
    }

    if (ics.length === 0) return null;
    const icMean = ics.reduce((a, b) => a + b, 0) / ics.length;
    const icStd = Math.sqrt(ics.reduce((a, b) => a + (b - icMean) ** 2, 0) / ics.length);
    const icRange = bestIc - worstIc;

    let verdict: FactorMarketDivergence['verdict'];
    if (marketsWithSignal >= 7) verdict = 'universal';
    else if (marketsWithSignal >= 3) verdict = 'regional';
    else verdict = 'fragmented';

    return { factorId, icMean, icStd, icRange, bestMarket, worstMarket, marketsWithSignal, verdict };
  }

  compareSingleFactorCrossMarket(factorId: string): Record<string, number> {
    const data = this.getFactorIC(factorId);
    if (!data) return {};
    const result: Record<string, number> = {};
    for (const [mkt, info] of Object.entries(data.icByMarket)) {
      result[mkt] = info.ic;
    }
    return result;
  }

  getAllDivergences(): FactorMarketDivergence[] {
    return Array.from(this.icStore.keys())
      .map(fid => this.getFactorDivergence(fid))
      .filter((d): d is FactorMarketDivergence => d !== null)
      .sort((a, b) => b.icMean - a.icMean);
  }

  getUniversalFactors(): FactorMarketDivergence[] {
    return this.getAllDivergences().filter(d => d.verdict === 'universal');
  }

  getRegionalFactors(market: string): FactorMarketDivergence[] {
    return this.getAllDivergences().filter(d => d.bestMarket === market && d.verdict !== 'universal');
  }

  clear(): void { this.icStore.clear(); }
  getStoredFactorCount(): number { return this.icStore.size; }
}

// Mock IC data generator for 44 regional factors across 10 markets
export function generateMockCrossMarketIC(): Array<{ factorId: string; market: string; ic: number }> {
  const regionalFactors = [
    // JP 12
    ...['JP_BOJ_ETF','JP_CROSS_HOLDING','JP_MARCH_EFFECT','JPY_CARRY_TRADE','JPX_400_SELECTION','JP_TOPIX_SECTOR','JP_FOREIGN_FLOW','JP_DIVIDEND_SEASON','JP_SHAREHOLDER_BENEFIT','JP_BANK_LENDING','JP_VALUE_TRAP','JPY_SENSITIVITY'],
    // TW 7
    ...['TW_MARGIN_BALANCE','TW_SHORT_RATIO','TW_FOREIGN_FLOW','TW_TSMC_LINKAGE','TW_DIVIDEND_CHASE','TW_FINANCING_OVERHEAT','TW_NT_DOLLAR'],
    // KR 6 + SG 5 + AU 5
    ...['KR_CHAEBOL_DISCOUNT','KR_FOREIGN_OWNERSHIP','KR_SAMSUNG_LINKAGE','KR_OPTION_EXPIRY','KR_KRW_SENSITIVITY','KR_DIVIDEND_YIELD'],
    ...['SG_REIT_SPREAD','SG_STI_WEIGHT','SG_SGD_LINKAGE','SG_DIVIDEND_CULTURE','SG_US_LISTED'],
    ...['AU_COMMODITY_LINK','AU_FRANKING_CREDIT','AU_DIVIDEND_SEASON','AU_BANK_DIVIDEND','AU_AUD_SENSITIVITY'],
    // IN 5 + EU 4
    ...['IN_FII_DII_FLOW','IN_MONSOON_EFFECT','IN_MODI_POLICY','IN_RUPEE_HEDGE','IN_PLEDGED_SHARES'],
    ...['EU_STOXX_SECTOR','EU_EUR_SENSITIVITY','EU_ESG_PREMIUM','EU_BREXIT_SHADOW'],
  ];

  const markets = ['HK','US','CC','JP','TW','KR','SG','AU','IN','EU'];
  const entries: Array<{ factorId: string; market: string; ic: number }> = [];

  for (const fid of regionalFactors) {
    const homeMarket = fid.slice(0, 2);
    for (const mkt of markets) {
      const hash = (fid.length + mkt.charCodeAt(0)) % 20;
      let baseIc = mkt === homeMarket ? 0.04 + hash * 0.003 : -0.01 + hash * 0.002;
      baseIc += (Math.random() - 0.5) * 0.02;
      entries.push({ factorId: fid, market: mkt, ic: Number(baseIc.toFixed(4)) });
    }
  }
  return entries;
}