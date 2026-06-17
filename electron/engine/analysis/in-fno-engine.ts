// ── R273 JVS-1 🇮🇳 印度F&O引擎 (INFuturesOptionsEngine) ──
// NSE期货期权: 期货持仓+期权链+PCR+OI分析+展期+Implied Vol

export interface FnOContract {
  symbol: string; // e.g. 'NIFTY', 'BANKNIFTY', 'RELIANCE'
  type: 'FUT' | 'CE' | 'PE'; // futures / call / put
  expiry: string; // YYYY-MM-DD or 'current'/'next'/'far'
  strikePrice?: number; // options only
  lotSize: number;
  underlyingPrice: number;
  lastPrice: number;
  change: number;
  changePercent: number;
  open: number; high: number; low: number;
  volume: number; // contracts
  turnover: number; // ₹ lakhs
  openInterest: number; // OI
  oiChange: number; // OI change vs previous
  oiChangePercent: number;
  impliedVolatility?: number; // options only, annualized %
  bidQty?: number; askQty?: number;
  bid?: number; ask?: number;
}

export interface FNOSymbolSnapshot {
  symbol: string;
  underlyingPrice: number;
  underlyingChange: number;
  future?: FnOContract; // current month future
  optionChain: FnOContract[]; // all strikes for current expiry
  pcr: number; // Put/Call OI ratio
  pcrVolume: number; // Put/Call volume ratio
  maxCallOI: { strike: number; oi: number }; // resistance
  maxPutOI: { strike: number; oi: number }; // support
  totalCallOI: number;
  totalPutOI: number;
  totalFutOI: number;
  ivAverage: number; // avg implied vol across strikes
  ivTermStructure: { expiry: string; iv: number }[]; // IV by expiry
  expiryDates: string[];
  rolloverPercent: number; // % of contracts rolled to next month
  rolloverCost: number; // basis difference
}

export interface FNOAnalysis {
  symbol: string;
  timestamp: number;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'rangeBound';
  sentimentScore: number; // -100 to 100
  signals: FNOSignal[];
  supportLevels: number[];
  resistanceLevels: number[];
  maxPain: number; // strike where max options expire worthless
  gammaExposure?: number; // GEX for indices
}

export interface FNOSignal {
  id: string;
  type: 'oi_buildup' | 'oi_unwinding' | 'pcr_extreme' | 'iv_spike' | 'rollover_strong' | 'max_oai_shift' | 'basis_divergence';
  direction: 'bullish' | 'bearish';
  strength: 'weak' | 'moderate' | 'strong';
  detail: string;
  contract: string;
}

export interface FNOQuery {
  symbol?: string;
  type?: 'FUT' | 'CE' | 'PE';
  expiry?: string;
  minOI?: number;
  minVolume?: number;
  sortBy?: 'volume' | 'oi' | 'iv' | 'change';
  limit?: number;
}

export interface FNOMarketBreadth {
  date: string;
  totalFutVolume: number; // ₹ lakhs
  totalOptVolume: number;
  totalFutOI: number; // ₹ lakhs notional
  totalOptOI: number;
  overallPCR: number; // put/call OI
  overallPCRVolume: number; // put/call volume
  niftyPCR: number;
  bankNiftyPCR: number;
  advancers: number; decliners: number; unchanged: number;
  fiiNetFutures: number; // ₹ crores — FII net in index/stock futures
  fiiNetOptions: number;
  marketOutlook: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  volatilityIndex: number; // India VIX
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class INFuturesOptionsEngine {
  private contracts = new Map<string, FnOContract[]>();
  private snapshots = new Map<string, FNOSymbolSnapshot>();
  private breadth: FNOMarketBreadth[] = [];

  reset(): void { this.contracts.clear(); this.snapshots.clear(); this.breadth = []; }

  // ═══════════ Data Loading ═══════════

  /** Load contract data for a symbol — keyed by symbol */
  loadContracts(symbol: string, contracts: FnOContract[]): number {
    const existing = this.contracts.get(symbol) || [];
    const keySet = new Set(existing.map((c) => `${c.type}|${c.expiry}|${c.strikePrice ?? 0}`));
    let added = 0;
    for (const c of contracts) {
      const k = `${c.type}|${c.expiry}|${c.strikePrice ?? 0}`;
      if (!keySet.has(k)) {
        existing.push(c);
        keySet.add(k);
        added++;
      }
    }
    this.contracts.set(symbol, existing);
    return added;
  }

  /** Get all contracts for a symbol */
  getContracts(symbol: string): FnOContract[] {
    return this.contracts.get(symbol) || [];
  }

  // ═══════════ Query ═══════════

  query(symbol: string, q?: FNOQuery): FnOContract[] {
    let results = [...this.getContracts(symbol)];
    if (q?.type) results = results.filter((c) => c.type === q.type);
    if (q?.expiry) results = results.filter((c) => c.expiry === q.expiry || c.expiry === 'current');
    if (q?.minOI) results = results.filter((c) => c.openInterest >= q.minOI!);
    if (q?.minVolume) results = results.filter((c) => c.volume >= q.minVolume!);
    const sortBy = q?.sortBy || 'volume';
    results.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
    if (q?.limit) results = results.slice(0, q.limit);
    return results;
  }

  // ═══════════ Option Chain Analysis ═══════════

  /** Build full option chain snapshot for a symbol */
  buildSnapshot(symbol: string): FNOSymbolSnapshot | null {
    const contracts = this.getContracts(symbol);
    if (contracts.length === 0) return null;

    const underlying = contracts[0];
    const future = contracts.find((c) => c.type === 'FUT' && (c.expiry === 'current' || !c.strikePrice));
    const ceOptions = contracts.filter((c) => c.type === 'CE' && c.strikePrice !== undefined);
    const peOptions = contracts.filter((c) => c.type === 'PE' && c.strikePrice !== undefined);

    const totalCallOI = ceOptions.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI = peOptions.reduce((s, c) => s + c.openInterest, 0);
    const pcr = totalPutOI > 0 ? totalCallOI / totalPutOI : 0;
    const totalCallVol = ceOptions.reduce((s, c) => s + c.volume, 0);
    const totalPutVol = peOptions.reduce((s, c) => s + c.volume, 0);
    const pcrVolume = totalPutVol > 0 ? totalCallVol / totalPutVol : 0;

    const maxCallOI = ceOptions.reduce((max, c) => c.openInterest > (max?.oi || 0) ? { strike: c.strikePrice!, oi: c.openInterest } : max, { strike: 0, oi: 0 });
    const maxPutOI = peOptions.reduce((max, c) => c.openInterest > (max?.oi || 0) ? { strike: c.strikePrice!, oi: c.openInterest } : max, { strike: 0, oi: 0 });

    const ivs = [...ceOptions, ...peOptions].filter((c) => c.impliedVolatility !== undefined) as (FnOContract & { impliedVolatility: number })[];
    const ivAvg = ivs.length > 0 ? ivs.reduce((s, c) => s + c.impliedVolatility, 0) / ivs.length : 0;

    // IV term structure: group by expiry
    const expiryIVs = new Map<string, number[]>(); const expiryAvg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    for (const c of ivs) { const e = expiryIVs.get(c.expiry) || []; e.push(c.impliedVolatility); expiryIVs.set(c.expiry, e); }
    const ivTerm = [...expiryIVs.entries()].map(([expiry, ivsArr]) => ({ expiry, iv: expiryAvg(ivsArr) })).sort((a, b) => a.expiry.localeCompare(b.expiry));

    // Rollover: compare current month vs next month OI
    const curFut = contracts.filter((c) => c.type === 'FUT' && (c.expiry === 'current' || c.expiry === 'next'));
    const curOI = curFut.filter((c) => c.expiry === 'current').reduce((s, c) => s + c.openInterest, 0);
    const nextOI = curFut.filter((c) => c.expiry === 'next').reduce((s, c) => s + c.openInterest, 0);
    const rollover = curOI + nextOI > 0 ? nextOI / (curOI + nextOI) : 0;

    const snapshot: FNOSymbolSnapshot = {
      symbol, underlyingPrice: underlying.underlyingPrice,
      underlyingChange: underlying.changePercent,
      future, optionChain: contracts,
      pcr, pcrVolume, maxCallOI, maxPutOI, totalCallOI, totalPutOI,
      totalFutOI: future?.openInterest || 0,
      ivAverage: ivAvg, ivTermStructure: ivTerm,
      expiryDates: [...new Set(contracts.map((c) => c.expiry))].sort(),
      rolloverPercent: rollover, rolloverCost: curFut.length >= 2 ? (curFut[0].lastPrice - curFut[1].lastPrice) : 0,
    };
    this.snapshots.set(symbol, snapshot);
    return snapshot;
  }

  /** Get latest snapshot */
  getSnapshot(symbol: string): FNOSymbolSnapshot | undefined { return this.snapshots.get(symbol); }

  // ═══════════ OI Analysis ═══════════

  /** Analyze OI change patterns: buildup vs unwinding */
  analyzeOI(symbol: string): FnOContract[] {
    const contracts = this.getContracts(symbol);
    return contracts.sort((a, b) => Math.abs(b.oiChangePercent) - Math.abs(a.oiChangePercent));
  }

  /** Detect OI buildup: price up + OI up = bullish, price down + OI up = bearish */
  detectOIBuildup(symbol: string): { bullishBuildup: FnOContract[]; bearishBuildup: FnOContract[] } {
    const contracts = this.getContracts(symbol);
    const up = contracts.filter((c) => c.change > 0 && c.oiChange > 0).sort((a, b) => b.oiChangePercent - a.oiChangePercent);
    const down = contracts.filter((c) => c.change < 0 && c.oiChange > 0).sort((a, b) => b.oiChangePercent - a.oiChangePercent);
    return { bullishBuildup: up, bearishBuildup: down };
  }

  // ═══════════ PCR Analysis ═══════════

  /** Compute Put/Call ratio and interpret */
  getPCR(symbol: string): { pcr: number; interpretation: 'oversold' | 'overbought' | 'neutral'; level: string } {
    const snapshot = this.snapshots.get(symbol);
    if (!snapshot) return { pcr: 0, interpretation: 'neutral', level: 'N/A' };
    const { pcr } = snapshot;
    return {
      pcr: Number(pcr.toFixed(3)),
      interpretation: pcr > 1.3 ? 'oversold' : pcr < 0.7 ? 'overbought' : 'neutral',
      level: pcr > 1.5 ? 'extreme' : pcr < 0.5 ? 'extreme' : 'normal',
    };
  }

  // ═══════════ Max Pain ═══════════

  /** Compute Max Pain — strike where total option value is minimized at expiry */
  computeMaxPain(symbol: string): number {
    const contracts = this.getContracts(symbol);
    const options = contracts.filter((c) => c.strikePrice !== undefined && c.type !== 'FUT');
    if (options.length === 0) return 0;

    const strikes = [...new Set(options.map((c) => c.strikePrice!))].sort((a, b) => a - b);
    let minPain = Infinity;
    let maxPainStrike = 0;

    for (const strike of strikes) {
      let totalPain = 0;
      for (const opt of options) {
        if (opt.type === 'CE') totalPain += Math.max(strike - opt.strikePrice!, 0) * opt.openInterest;
        else totalPain += Math.max(opt.strikePrice! - strike, 0) * opt.openInterest;
      }
      if (totalPain < minPain) { minPain = totalPain; maxPainStrike = strike; }
    }
    return maxPainStrike;
  }

  // ═══════════ Signal Detection ═══════════

  detectSignals(symbol: string): FNOSignal[] {
    const signals: FNOSignal[] = [];
    const snapshot = this.snapshots.get(symbol);
    const contracts = this.getContracts(symbol);
    if (!snapshot) return signals;

    // PCR extreme
    if (snapshot.pcr > 1.5) signals.push({ id: crypto.randomUUID(), type: 'pcr_extreme', direction: 'bullish', strength: 'strong', detail: `PCR ${snapshot.pcr.toFixed(2)} → oversold, bullish reversal likely`, contract: symbol });
    else if (snapshot.pcr < 0.5) signals.push({ id: crypto.randomUUID(), type: 'pcr_extreme', direction: 'bearish', strength: 'strong', detail: `PCR ${snapshot.pcr.toFixed(2)} → overbought, bearish reversal likely`, contract: symbol });

    // OI buildup detection
    const buildup = this.detectOIBuildup(symbol);
    if (buildup.bullishBuildup.length > 0) {
      const top = buildup.bullishBuildup[0];
      signals.push({ id: crypto.randomUUID(), type: 'oi_buildup', direction: 'bullish', strength: top.oiChangePercent > 20 ? 'strong' : 'moderate', detail: `${top.type} ${top.strikePrice ? top.strikePrice : ''}: price ↑+${top.changePercent}%, OI ↑+${top.oiChangePercent}% → bullish buildup`, contract: `${top.type}|${top.strikePrice || 'FUT'}` });
    }
    if (buildup.bearishBuildup.length > 0) {
      const top = buildup.bearishBuildup[0];
      signals.push({ id: crypto.randomUUID(), type: 'oi_buildup', direction: 'bearish', strength: top.oiChangePercent > 20 ? 'strong' : 'moderate', detail: `${top.type} ${top.strikePrice ? top.strikePrice : ''}: price ↓${top.changePercent}%, OI ↑+${top.oiChangePercent}% → bearish buildup`, contract: `${top.type}|${top.strikePrice || 'FUT'}` });
    }

    // IV spike
    if (snapshot.ivAverage > 25) signals.push({ id: crypto.randomUUID(), type: 'iv_spike', direction: 'bearish', strength: snapshot.ivAverage > 35 ? 'strong' : 'moderate', detail: `Avg IV ${snapshot.ivAverage.toFixed(1)}% → elevated fear`, contract: symbol });

    return signals;
  }

  // ═══════════ FnO Analysis Report ═══════════

  analyze(symbol: string): FNOAnalysis | null {
    const snapshot = this.snapshots.get(symbol);
    if (!snapshot) return null;

    const signals = this.detectSignals(symbol);
    const bullSignals = signals.filter((s) => s.direction === 'bullish').length;
    const bearSignals = signals.filter((s) => s.direction === 'bearish').length;
    const score = bearSignals + bullSignals > 0 ? ((bullSignals - bearSignals) / (bullSignals + bearSignals)) * 50 : 0;
    let sentiment: FNOAnalysis['sentiment'];
    if (score > 25) sentiment = 'bullish';
    else if (score > 5) sentiment = 'neutral';
    else if (score > -25) sentiment = 'rangeBound';
    else sentiment = 'bearish';

    return {
      symbol, timestamp: Date.now(), sentiment,
      sentimentScore: Math.round(score), signals,
      supportLevels: [snapshot.maxPutOI.strike],
      resistanceLevels: [snapshot.maxCallOI.strike],
      maxPain: this.computeMaxPain(symbol),
    };
  }

  // ═══════════ Market Breadth ═══════════

  addMarketBreadth(b: FNOMarketBreadth): void { this.breadth.push(b); }

  getLatestBreadth(): FNOMarketBreadth | null {
    return this.breadth.length > 0 ? this.breadth[this.breadth.length - 1] : null;
  }

  getBreadthHistory(days = 5): FNOMarketBreadth[] {
    return this.breadth.slice(-days);
  }

  // ═══════════ Rollover Analysis ═══════════

  /** Compute rollover stats for all tracked symbols */
  getRolloverSummary(): { symbol: string; rolloverPercent: number; rolloverCost: number; nextMonthBasis: number }[] {
    const results: { symbol: string; rolloverPercent: number; rolloverCost: number; nextMonthBasis: number }[] = [];
    for (const [symbol] of this.contracts) {
      const s = this.snapshots.get(symbol);
      if (s) results.push({ symbol, rolloverPercent: s.rolloverPercent, rolloverCost: s.rolloverCost, nextMonthBasis: s.rolloverCost });
    }
    return results.sort((a, b) => b.rolloverPercent - a.rolloverPercent);
  }

  // ═══════════ Seed ═══════════

  seed(): FNOSymbolSnapshot[] {
    const symbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'ITC'];
    const snapshots: FNOSymbolSnapshot[] = [];
    const basePrices: Record<string, number> = { NIFTY: 23000, BANKNIFTY: 49000, FINNIFTY: 22000, MIDCPNIFTY: 12000, RELIANCE: 2800, TCS: 3800, HDFCBANK: 1700, INFY: 1600, ICICIBANK: 1100, ITC: 480 };

    for (const sym of symbols) {
      const base = basePrices[sym] || 1000;
      const contracts: FnOContract[] = [];
      const strikes = sym.includes('NIFTY') ? Array.from({ length: 11 }, (_, i) => base + (i - 5) * (sym === 'BANKNIFTY' ? 200 : 100))
        : Array.from({ length: 9 }, (_, i) => base + (i - 4) * (base * 0.02));

      for (const strike of strikes) {
        for (const type of ['CE' as const, 'PE' as const]) {
          const iv = 15 + Math.random() * 20;
          const oi = Math.round(50000 + Math.random() * 500000);
          contracts.push({
            symbol: sym, type, expiry: 'current', strikePrice: Math.round(strike),
            lotSize: sym === 'NIFTY' ? 25 : sym === 'BANKNIFTY' ? 15 : sym === 'FINNIFTY' ? 40 : 500,
            underlyingPrice: base, lastPrice: Math.round((10 + Math.random() * 200) * 100) / 100,
            change: (Math.random() - 0.5) * 20, changePercent: (Math.random() - 0.5) * 10,
            open: Math.round((10 + Math.random() * 200) * 100) / 100,
            high: Math.round((15 + Math.random() * 210) * 100) / 100,
            low: Math.round((5 + Math.random() * 190) * 100) / 100,
            volume: Math.round(10000 + Math.random() * 100000),
            turnover: Math.round((100000 + Math.random() * 1000000)),
            openInterest: oi, oiChange: Math.round((Math.random() - 0.4) * oi / 2),
            oiChangePercent: (Math.random() - 0.3) * 30,
            impliedVolatility: iv + Math.abs(strike - base) / base * 5,
          });
        }
      }
      // Future
      contracts.push({
        symbol: sym, type: 'FUT', expiry: 'current', strikePrice: undefined,
        lotSize: sym === 'NIFTY' ? 25 : sym === 'BANKNIFTY' ? 15 : 500,
        underlyingPrice: base, lastPrice: Math.round(base * (1 + (Math.random() - 0.5) * 0.02)),
        change: (Math.random() - 0.5) * 1, changePercent: (Math.random() - 0.5) * 2,
        open: Math.round(base * 0.99), high: Math.round(base * 1.01),
        low: Math.round(base * 0.98), volume: Math.round(200000 + Math.random() * 500000),
        turnover: Math.round(1e6 + Math.random() * 5e6),
        openInterest: Math.round(5e6 + Math.random() * 15e6),
        oiChange: Math.round((Math.random() - 0.4) * 5e5),
        oiChangePercent: (Math.random() - 0.3) * 10,
      });
      this.loadContracts(sym, contracts);
      snapshots.push(this.buildSnapshot(sym)!);
    }
    return snapshots;
  }
}

// ═══════════ Singleton ═══════════

let fnoInstance: INFuturesOptionsEngine | null = null;
export function getINFuturesOptionsEngine(): INFuturesOptionsEngine {
  if (!fnoInstance) fnoInstance = new INFuturesOptionsEngine();
  return fnoInstance;
}
export function resetINFuturesOptionsEngine(): void { fnoInstance = null; }
