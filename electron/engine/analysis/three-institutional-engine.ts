// ── R273 JVS-3 🇰🇷🇹🇼 三大法人引擎 (ThreeInstitutionalEngine) ──
// KRX Foreign/Institutional/Individual + TWSE Foreign/Investment Trust/Dealer

export type Institution = 'foreign' | 'investment_trust' | 'dealer' | 'individual';
export type TWMarket = 'TWSE' | 'TPEX';
export type KRMarket = 'KOSPI' | 'KOSDAQ';

export interface InstitutionalDay {
  date: string;
  market: TWMarket | KRMarket;
  country: 'TW' | 'KR';
  foreign: number; // TW: TWD mn, KR: KRW bill
  investmentTrust: number;
  dealer: number;
  individual: number; // KR only
  total: number; // should ≈ 0 (sum of 3 institutions)
  foreignCumulative30d: number;
  index?: string; // TAIEX / KOSPI index close
  indexChange?: number;
}

export interface InstitutionalSummary {
  date: string;
  country: 'TW' | 'KR';
  mainIndex: string;
  indexClose: number;
  indexChange: number;
  foreignNet: number;
  itNet: number; // investment trust
  dealerNet: number;
  individualNet?: number;
  netFlow: number; // foreign + IT + dealer
  sentiment: InstitutionalSentiment;
  foreignSentiment: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  itSentiment: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  consecutiveForeignBuy: number;
  consecutiveForeignSell: number;
  topBuySectors: SectorFlow[];
  topSellSectors: SectorFlow[];
  foreignOwnershipRatio: number; // % of market cap
  itOwnershipRatio: number; // %
}

export interface InstitutionalSentiment {
  foreign: 'bullish' | 'bearish' | 'neutral';
  investmentTrust: 'bullish' | 'bearish' | 'neutral';
  dealer: 'bullish' | 'bearish' | 'neutral';
  consensus: 'strong_bullish' | 'bullish' | 'mixed' | 'bearish' | 'strong_bearish';
  score: number; // -100 to 100
}

export interface SectorFlow {
  sector: string;
  foreignNet: number;
  itNet: number;
  dealerNet: number;
  total: number;
  leadingStock: string;
  leadingCode: string;
}

export interface InstitutionalAlert {
  id: string;
  country: 'TW' | 'KR';
  type: 'foreign_surge' | 'foreign_dump' | 'it_rotation' | 'dealer_divergence' | 'index_disconnect' | 'ownership_peak';
  severity: 'info' | 'warning' | 'critical';
  detail: string; createdAt: number;
}

export interface InstitutionalTrend {
  country: 'TW' | 'KR';
  period: string;
  foreignCumulative: number;
  itCumulative: number;
  dealerCumulative: number;
  netCumulative: number;
  indexReturn: number; // % return over period
  correlation: number; // flow vs index correlation
  maxForeignDay: { date: string; net: number };
  minForeignDay: { date: string; net: number };
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class ThreeInstitutionalEngine {
  private dataTW = new Map<string, InstitutionalDay[]>();
  private dataKR = new Map<string, InstitutionalDay[]>();
  private sectorFlowTW: SectorFlow[] = [];
  private sectorFlowKR: SectorFlow[] = [];
  private alerts: InstitutionalAlert[] = [];

  reset(): void { this.dataTW.clear(); this.dataKR.clear(); this.sectorFlowTW = []; this.sectorFlowKR = []; this.alerts = []; }

  // ═══════════ Data Pipeline ═══════════

  loadTW(market: TWMarket, records: InstitutionalDay[]): number {
    const arr = this.dataTW.get(market) || [];
    const existing = new Set(arr.map((d) => d.date));
    let added = 0;
    for (const r of records) { if (!existing.has(r.date)) { arr.push(r); existing.add(r.date); added++; } }
    arr.sort((a, b) => a.date.localeCompare(b.date));
    this.dataTW.set(market, arr);
    return added;
  }

  loadKR(market: KRMarket, records: InstitutionalDay[]): number {
    const arr = this.dataKR.get(market) || [];
    const existing = new Set(arr.map((d) => d.date));
    let added = 0;
    for (const r of records) { if (!existing.has(r.date)) { arr.push(r); existing.add(r.date); added++; } }
    arr.sort((a, b) => a.date.localeCompare(b.date));
    this.dataKR.set(market, arr);
    return added;
  }

  /** Get latest day by country (aggregating both markets) */
  private getLatestData(country: 'TW' | 'KR'): InstitutionalDay[] {
    if (country === 'TW') {
      const twse = this.dataTW.get('TWSE') || [];
      const tpex = this.dataTW.get('TPEX') || [];
      const latestDate = [...twse, ...tpex].reduce((m, d) => d.date > m ? d.date : m, '');
      return [twse.find((d) => d.date === latestDate), tpex.find((d) => d.date === latestDate)].filter(Boolean) as InstitutionalDay[];
    }
    const kospi = this.dataKR.get('KOSPI') || [];
    const kosdaq = this.dataKR.get('KOSDAQ') || [];
    const latestDate = [...kospi, ...kosdaq].reduce((m, d) => d.date > m ? d.date : m, '');
    return [kospi.find((d) => d.date === latestDate), kosdaq.find((d) => d.date === latestDate)].filter(Boolean) as InstitutionalDay[];
  }

  private getHistory(country: 'TW' | 'KR', market: string): InstitutionalDay[] {
    if (country === 'TW') return this.dataTW.get(market as TWMarket) || [];
    return this.dataKR.get(market as KRMarket) || [];
  }

  // ═══════════ Daily Summary ═══════════

  getDailySummary(country: 'TW' | 'KR'): InstitutionalSummary | null {
    const latest = this.getLatestData(country);
    if (latest.length === 0) return null;

    const main = latest[0]; // main board (TWSE/KOSPI)
    const foreignNet = latest.reduce((s, d) => s + d.foreign, 0);
    const itNet = latest.reduce((s, d) => s + d.investmentTrust, 0);
    const dealerNet = latest.reduce((s, d) => s + d.dealer, 0);
    const individualNet = latest.reduce((s, d) => s + (d.individual || 0), 0);

    const foreignSent = classifySentiment(main.foreign, 5000);
    const itSent = classifySentiment(main.investmentTrust, 2000);

    // Consecutive foreign buy/sell
    const history = this.getHistory(country, country === 'TW' ? 'TWSE' : 'KOSPI');
    let consBuy = 0; let consSell = 0;
    for (let i = history.length - 1; i >= 0; i--) { if (history[i].foreign > 0) consBuy++; else break; }
    for (let i = history.length - 1; i >= 0; i--) { if (history[i].foreign < 0) consSell++; else break; }

    // Sentiment consensus
    const score = scoreInstitutions(main);
    const consensus = computeConsensus(main);

    return {
      date: main.date, country,
      mainIndex: country === 'TW' ? 'TAIEX' : 'KOSPI',
      indexClose: main.index || 0, indexChange: main.indexChange || 0,
      foreignNet, itNet, dealerNet, individualNet: country === 'KR' ? individualNet : undefined,
      netFlow: foreignNet + itNet + dealerNet,
      sentiment: computeInstitutionalSentiment(main),
      foreignSentiment: foreignSent, itSentiment: itSent,
      consecutiveForeignBuy: consBuy, consecutiveForeignSell: consSell,
      topBuySectors: (country === 'TW' ? this.sectorFlowTW : this.sectorFlowKR).filter((s) => s.foreignNet > 0).slice(0, 5),
      topSellSectors: (country === 'TW' ? this.sectorFlowTW : this.sectorFlowKR).filter((s) => s.foreignNet < 0).slice(0, 5),
      foreignOwnershipRatio: history.length > 0 ? main.foreignCumulative30d / 1e9 * 0.1 : 0, // approximate
      itOwnershipRatio: 0,
    };
  }

  // ═══════════ Historical Trend ═══════════

  getTrend(country: 'TW' | 'KR', days: number): InstitutionalTrend | null {
    const history = this.getHistory(country, country === 'TW' ? 'TWSE' : 'KOSPI').slice(-days);
    if (history.length === 0) return null;

    const fCum = history.reduce((s, d) => s + d.foreign, 0);
    const itCum = history.reduce((s, d) => s + d.investmentTrust, 0);
    const dCum = history.reduce((s, d) => s + d.dealer, 0);
    const idxFirst = history[0].index;
    const idxLast = history[history.length - 1].index;
    const idxReturn = idxFirst && idxFirst > 0 ? ((idxLast || 0) - idxFirst) / idxFirst * 100 : 0;

    // Correlation of foreign flow vs index
    const fFlows = history.map((d) => d.foreign);
    const idxChanges = history.map((d) => d.indexChange || 0);
    const correlation = computeCorrelation(fFlows, idxChanges) || 0;

    const maxF = history.reduce((m, d) => d.foreign > m.net ? { date: d.date, net: d.foreign } : m, { date: '-', net: -Infinity });
    const minF = history.reduce((m, d) => d.foreign < m.net ? { date: d.date, net: d.foreign } : m, { date: '-', net: Infinity });

    return {
      country, period: `${days}d`, foreignCumulative: fCum, itCumulative: itCum,
      dealerCumulative: dCum, netCumulative: fCum + itCum + dCum,
      indexReturn: Number(idxReturn.toFixed(2)), correlation,
      maxForeignDay: maxF.net === -Infinity ? { date: '-', net: 0 } : maxF,
      minForeignDay: minF.net === Infinity ? { date: '-', net: 0 } : minF,
    };
  }

  // ═══════════ Cross-Country Comparison ═══════════

  /** Compare TW vs KR institutional flows side-by-side */
  compare(): { tw: InstitutionalSummary | null; kr: InstitutionalSummary | null; relativeStrength: 'TW_stronger' | 'KR_stronger' | 'equal' } {
    const tw = this.getDailySummary('TW');
    const kr = this.getDailySummary('KR');
    let rs: 'TW_stronger' | 'KR_stronger' | 'equal' = 'equal';
    if (tw && kr) {
      if (tw.sentiment.score > kr.sentiment.score + 20) rs = 'TW_stronger';
      else if (kr.sentiment.score > tw.sentiment.score + 20) rs = 'KR_stronger';
    }
    return { tw, kr, relativeStrength: rs };
  }

  // ═══════════ Alert Detection ═══════════

  detectAlerts(): InstitutionalAlert[] {
    this.alerts = [];

    for (const country of ['TW', 'KR'] as const) {
      const summary = this.getDailySummary(country);
      if (!summary) continue;

      if (summary.foreignNet > 50000) {
        this.alerts.push({ id: crypto.randomUUID(), country, type: 'foreign_surge', severity: 'critical', detail: `${country === 'TW' ? '台股' : '韩国'}: 外资大买 ${Number(summary.foreignNet).toFixed(0)} — surge!`, createdAt: Date.now() });
      }
      if (summary.foreignNet < -50000) {
        this.alerts.push({ id: crypto.randomUUID(), country, type: 'foreign_dump', severity: 'critical', detail: `${country === 'TW' ? '台股' : '韩国'}: 外资大卖 ${Math.abs(summary.foreignNet).toFixed(0)} — exodus!`, createdAt: Date.now() });
      }
      if (summary.sentiment.consensus === 'strong_bullish' || summary.sentiment.consensus === 'strong_bearish') {
        this.alerts.push({ id: crypto.randomUUID(), country, type: 'dealer_divergence', severity: 'warning', detail: `${country === 'TW' ? '台股' : '韩国'}: 三大法人共识${summary.sentiment.consensus} (score: ${summary.sentiment.score})`, createdAt: Date.now() });
      }
    }
    return this.alerts;
  }

  getAlerts(): InstitutionalAlert[] { return [...this.alerts]; }

  // ═══════════ Sector Flow ═══════════

  loadSectorFlow(country: 'TW' | 'KR', sectors: SectorFlow[]): void {
    if (country === 'TW') this.sectorFlowTW = sectors;
    else this.sectorFlowKR = sectors;
  }

  // ═══════════ Seed ═══════════

  seed(): void {
    for (let d = 30; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const twNet = (Math.random() - 0.5) * 30000;
      const krNet = (Math.random() - 0.5) * 8000; // KRW bill

      const taiwanRecord: InstitutionalDay = {
        date, market: 'TWSE', country: 'TW',
        foreign: Math.round(twNet), investmentTrust: Math.round(twNet * 0.3 + (Math.random() - 0.3) * 5000),
        dealer: Math.round(twNet * 0.1 + (Math.random() - 0.5) * 2000), individual: 0,
        total: 0, foreignCumulative30d: 1e9 + Math.round(Math.random() * 1e9),
        index: 22500 + Math.random() * 1000, indexChange: (Math.random() - 0.5) * 2,
      };
      this.loadTW('TWSE', [taiwanRecord]);

      const koreaRecord: InstitutionalDay = {
        date, market: 'KOSPI', country: 'KR',
        foreign: Math.round(krNet), investmentTrust: Math.round(krNet * 0.5 + (Math.random() - 0.3) * 3000),
        dealer: Math.round(krNet * 0.2 + (Math.random() - 0.5) * 1000),
        individual: Math.round(-krNet * 0.7 + (Math.random() - 0.5) * 5000),
        total: 0, foreignCumulative30d: 5e11 + Math.round(Math.random() * 2e11),
        index: 2700 + Math.random() * 100, indexChange: (Math.random() - 0.5) * 1.5,
      };
      this.loadKR('KOSPI', [koreaRecord]);
    }
  }
}

// ═══════════ Helpers ═══════════

function classifySentiment(net: number, threshold: number): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' {
  if (net > threshold * 2) return 'strong_buy';
  if (net > threshold) return 'buy';
  if (net > -threshold) return 'neutral';
  if (net > -threshold * 2) return 'sell';
  return 'strong_sell';
}

function scoreInstitutions(d: InstitutionalDay): number {
  const fScore = Math.tanh(d.foreign / 100000) * 50;
  const itScore = Math.tanh(d.investmentTrust / 50000) * 30;
  const dScore = Math.tanh(d.dealer / 20000) * 20;
  return Math.round(fScore + itScore + dScore);
}

function computeConsensus(d: InstitutionalDay): InstitutionalSentiment['consensus'] {
  const score = scoreInstitutions(d);
  if (score > 40) return 'strong_bullish';
  if (score > 10) return 'bullish';
  if (score > -10) return 'mixed';
  if (score > -40) return 'bearish';
  return 'strong_bearish';
}

function computeInstitutionalSentiment(d: InstitutionalDay): InstitutionalSentiment {
  return {
    foreign: d.foreign > 5000 ? 'bullish' : d.foreign < -5000 ? 'bearish' : 'neutral',
    investmentTrust: d.investmentTrust > 2000 ? 'bullish' : d.investmentTrust < -2000 ? 'bearish' : 'neutral',
    dealer: d.dealer > 1000 ? 'bullish' : d.dealer < -1000 ? 'bearish' : 'neutral',
    consensus: computeConsensus(d), score: scoreInstitutions(d),
  };
}

function computeCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let cov = 0; let varX = 0; let varY = 0;
  for (let i = 0; i < n; i++) { cov += (x[i] - mx) * (y[i] - my); varX += (x[i] - mx) ** 2; varY += (y[i] - my) ** 2; }
  return varX * varY > 0 ? cov / Math.sqrt(varX * varY) : 0;
}

// ═══════════ Singleton ═══════════

let tieInstance: ThreeInstitutionalEngine | null = null;
export function getThreeInstitutionalEngine(): ThreeInstitutionalEngine {
  if (!tieInstance) tieInstance = new ThreeInstitutionalEngine();
  return tieInstance;
}
export function resetThreeInstitutionalEngine(): void { tieInstance = null; }
