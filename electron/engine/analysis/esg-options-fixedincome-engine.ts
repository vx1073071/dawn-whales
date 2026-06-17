/**
 * ESGOptionsFixedIncomeEngine — R278 JVS-2 ESG25+Options15+FI10引擎 (50因子)
 *
 * ESG (25): E(8)+S(9)+G(8)
 * Options (15): IV(5)+Greeks(5)+PutCall(5)
 * Fixed Income (10): YieldCurve(4)+CreditSpread(3)+Duration(3)
 */

export interface ESGFactor {
  id: string; name: string; nameCn: string;
  category: 'E' | 'S' | 'G'; description: string;
  score: number; weight: number; source: string;
}

export interface OptionsFactor {
  id: string; name: string; nameCn: string;
  category: 'IV' | 'Greeks' | 'PutCall'; description: string;
  value: number; zScore: number; signal: 'bullish' | 'neutral' | 'bearish';
}

export interface FIFactor {
  id: string; name: string; nameCn: string;
  category: 'YieldCurve' | 'CreditSpread' | 'Duration'; description: string;
  value: number; bps: number; zScore: number; signal: 'tightening' | 'stable' | 'widening' | 'flattening' | 'steepening';
}

export interface ESGScore {
  total: number; e: number; s: number; g: number;
  rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  percentile: number; leader: boolean;
}

export interface OptionsDashboard {
  vixProxy: number; skew: number; termStructure: number;
  putCallRatio: number; overallSignal: 'bullish' | 'neutral' | 'bearish';
  greeks: { delta: number; gamma: number; vega: number; theta: number; rho: number };
}

export interface FIDashboard {
  curve: { '2Y': number; '10Y': number; spread: number; inverted: boolean };
  credit: { IG: number; HY: number; spread: number };
  duration: { effective: number; modified: number; convexity: number };
}

// ============================================================
// ESLint disable for large constant arrays
/* eslint-disable max-lines */
// ============================================================

const ESG_E_FACTORS: Array<{ sub: string; desc: string; w: number }> = [
  { sub: 'Carbon Emissions Intensity', desc: 'Scope 1+2 emissions per revenue', w: 0.18 },
  { sub: 'Carbon Emissions Reduction', desc: 'YoY emissions reduction rate', w: 0.16 },
  { sub: 'Water Intensity', desc: 'Water withdrawal per revenue', w: 0.12 },
  { sub: 'Renewable Energy Share', desc: '% energy from renewables', w: 0.14 },
  { sub: 'Waste Recycling Rate', desc: '% waste recycled vs landfilled', w: 0.10 },
  { sub: 'Environmental Fines', desc: 'Fines per revenue (inverted)', w: 0.10 },
  { sub: 'Biodiversity Impact', desc: 'Land use change score', w: 0.10 },
  { sub: 'Climate Risk Score', desc: 'Physical+transition risk (inv)', w: 0.10 },
];

const ESG_S_FACTORS: Array<{ sub: string; desc: string; w: number }> = [
  { sub: 'Employee Turnover Rate', desc: 'Voluntary attrition (inv)', w: 0.13 },
  { sub: 'Gender Diversity', desc: '% women in workforce & mgmt', w: 0.13 },
  { sub: 'LTIR Rate', desc: 'Lost time injury rate (inv)', w: 0.11 },
  { sub: 'Human Rights Score', desc: 'Supply chain HR violations', w: 0.12 },
  { sub: 'Community Investment', desc: 'CSR spend per revenue', w: 0.10 },
  { sub: 'Customer Satisfaction', desc: 'NPS / satisfaction score', w: 0.11 },
  { sub: 'Data Privacy Incidents', desc: 'Data breaches count (inv)', w: 0.10 },
  { sub: 'Product Quality', desc: 'Recall frequency (inv)', w: 0.10 },
  { sub: 'Employee Training Hours', desc: 'Avg training per employee', w: 0.10 },
];

const ESG_G_FACTORS: Array<{ sub: string; desc: string; w: number }> = [
  { sub: 'Board Independence', desc: '% independent directors', w: 0.16 },
  { sub: 'Board Gender Diversity', desc: '% women on board', w: 0.12 },
  { sub: 'CEO Pay Ratio', desc: 'CEO/median employee pay (inv)', w: 0.12 },
  { sub: 'Audit Committee Independence', desc: '100% independent (binary)', w: 0.14 },
  { sub: 'Shareholder Rights', desc: 'One-share-one-vote proxy', w: 0.14 },
  { sub: 'Executive Clawback Policy', desc: 'Clawback presence', w: 0.10 },
  { sub: 'Corruption Risk', desc: 'Anti-corruption score', w: 0.12 },
  { sub: 'Tax Transparency', desc: 'CbCR reporting score', w: 0.10 },
];

const OPTIONS_IV_FACTORS: Array<{ sub: string; desc: string }> = [
  { sub: 'ATM IV 30d', desc: 'At-the-money 30-day implied vol' },
  { sub: 'IV Skew 25 Delta', desc: 'OTM put/ATM IV ratio' },
  { sub: 'IV Term Structure', desc: '30d/90d IV ratio' },
  { sub: 'IV Percentile 1Y', desc: 'Current IV vs 1-year range' },
  { sub: 'IV/HV Ratio', desc: 'IV divided by 30d historical vol' },
];

const OPTIONS_GREEKS_FACTORS: Array<{ sub: string; desc: string }> = [
  { sub: 'Net Delta Exposure', desc: 'Aggregate delta across expiries' },
  { sub: 'Gamma Imbalance', desc: 'Dealer gamma positioning' },
  { sub: 'Vega Exposure', desc: 'Aggregate vega sensitivity' },
  { sub: 'Theta Decay Rate', desc: 'Weighted avg theta burn' },
  { sub: 'Rho Sensitivity', desc: 'Interest rate sensitivity' },
];

const OPTIONS_PC_FACTORS: Array<{ sub: string; desc: string }> = [
  { sub: 'Put/Call Volume Ratio', desc: 'Equity-only P/C volume' },
  { sub: 'Put/Call Open Interest', desc: 'Total P/C OI ratio' },
  { sub: 'Index Put/Call Ratio', desc: 'Index options P/C' },
  { sub: 'Equity Put/Call Ratio', desc: 'Single stock P/C' },
  { sub: 'Call Skew', desc: 'OTM call skew premium' },
];

const FI_YC_FACTORS: Array<{ sub: string; desc: string }> = [
  { sub: '2Y-10Y Spread', desc: '10Y minus 2Y yield spread' },
  { sub: '3M-10Y Spread', desc: '10Y minus 3M bill spread' },
  { sub: '5Y Forward 5Y', desc: '5-year rate 5 years fwd' },
  { sub: 'Term Premium', desc: 'ACM term premium estimate' },
];

const FI_CS_FACTORS: Array<{ sub: string; desc: string }> = [
  { sub: 'IG OAS', desc: 'Investment grade option-adj spread' },
  { sub: 'HY OAS', desc: 'High yield option-adj spread' },
  { sub: 'IG-HY Spread', desc: 'HY minus IG spread width' },
];

const FI_DUR_FACTORS: Array<{ sub: string; desc: string }> = [
  { sub: 'Effective Duration', desc: 'Price sensitivity to rates' },
  { sub: 'Modified Duration', desc: 'Macaulay adjusted' },
  { sub: 'Convexity', desc: 'Second-order rate sensitivity' },
];

// ============================================================
export class ESGOptionsFixedIncomeEngine {
  private esgFactors: ESGFactor[];
  private optionsFactors: OptionsFactor[];
  private fiFactors: FIFactor[];
  private esgSnapshots = new Map<string, ESGScore[]>();
  private optSnapshots = new Map<string, number[]>();

  constructor() {
    this.esgFactors = [];
    this.optionsFactors = [];
    this.fiFactors = [];
    this.initESG();
    this.initOptions();
    this.initFI();
  }

  private initESG(): void {
    let id = 1;
    for (const f of ESG_E_FACTORS) {
      this.esgFactors.push({ id: 'esg_e_' + (id++), name: f.sub, nameCn: f.sub, category: 'E', description: f.desc, score: 0, weight: f.w, source: 'MSCI ESG' });
    }
    for (const f of ESG_S_FACTORS) {
      this.esgFactors.push({ id: 'esg_s_' + (id++), name: f.sub, nameCn: f.sub, category: 'S', description: f.desc, score: 0, weight: f.w, source: 'MSCI ESG' });
    }
    for (const f of ESG_G_FACTORS) {
      this.esgFactors.push({ id: 'esg_g_' + (id++), name: f.sub, nameCn: f.sub, category: 'G', description: f.desc, score: 0, weight: f.w, source: 'MSCI ESG' });
    }
  }

  private initOptions(): void {
    let id = 1;
    for (const f of OPTIONS_IV_FACTORS) {
      this.optionsFactors.push({ id: 'opt_iv_' + (id++), name: f.sub, nameCn: f.sub, category: 'IV', description: f.desc, value: 0, zScore: 0, signal: 'neutral' });
    }
    for (const f of OPTIONS_GREEKS_FACTORS) {
      this.optionsFactors.push({ id: 'opt_gk_' + (id++), name: f.sub, nameCn: f.sub, category: 'Greeks', description: f.desc, value: 0, zScore: 0, signal: 'neutral' });
    }
    for (const f of OPTIONS_PC_FACTORS) {
      this.optionsFactors.push({ id: 'opt_pc_' + (id++), name: f.sub, nameCn: f.sub, category: 'PutCall', description: f.desc, value: 0, zScore: 0, signal: 'neutral' });
    }
  }

  private initFI(): void {
    let id = 1;
    for (const f of FI_YC_FACTORS) {
      this.fiFactors.push({ id: 'fi_yc_' + (id++), name: f.sub, nameCn: f.sub, category: 'YieldCurve', description: f.desc, value: 0, bps: 0, zScore: 0, signal: 'stable' });
    }
    for (const f of FI_CS_FACTORS) {
      this.fiFactors.push({ id: 'fi_cs_' + (id++), name: f.sub, nameCn: f.sub, category: 'CreditSpread', description: f.desc, value: 0, bps: 0, zScore: 0, signal: 'stable' });
    }
    for (const f of FI_DUR_FACTORS) {
      this.fiFactors.push({ id: 'fi_dur_' + (id++), name: f.sub, nameCn: f.sub, category: 'Duration', description: f.desc, value: 0, bps: 0, zScore: 0, signal: 'stable' });
    }
  }

  // ====== ESG ======
  getESGFactors(): ESGFactor[] { return [...this.esgFactors]; }
  getESGByCategory(cat: 'E'|'S'|'G'): ESGFactor[] { return this.esgFactors.filter(f => f.category === cat); }

  setESGScores(scores: Array<{ id: string; score: number }>): ESGScore {
    for (const { id, score } of scores) {
      const f = this.esgFactors.find(x => x.id === id);
      if (f) f.score = Math.max(0, Math.min(10, score));
    }
    return this.computeESGScore();
  }

  computeESGScore(): ESGScore {
    const cats: Record<string, { sum: number; totalW: number }> = { E: {sum:0,totalW:0}, S:{sum:0,totalW:0}, G:{sum:0,totalW:0} };
    for (const f of this.esgFactors) {
      cats[f.category].sum += f.score * f.weight;
      cats[f.category].totalW += f.weight;
    }
    const e = cats.E.totalW > 0 ? cats.E.sum / cats.E.totalW : 0;
    const s = cats.S.totalW > 0 ? cats.S.sum / cats.S.totalW : 0;
    const g = cats.G.totalW > 0 ? cats.G.sum / cats.G.totalW : 0;
    const total = (e + s + g) / 3;
    let rating: ESGScore['rating'];
    if (total >= 8.57) rating = 'AAA'; else if (total >= 7.14) rating = 'AA';
    else if (total >= 5.71) rating = 'A'; else if (total >= 4.29) rating = 'BBB';
    else if (total >= 2.86) rating = 'BB'; else if (total >= 1.43) rating = 'B';
    else rating = 'CCC';
    return { total, e, s, g, rating, percentile: total / 10, leader: total >= 7.14 };
  }

  getESGSnapshot(label: string): ESGScore | undefined {
    const snap = this.esgSnapshots.get(label);
    return snap ? snap[snap.length - 1] : undefined;
  }

  // ====== Options ======
  getOptionsFactors(): OptionsFactor[] { return [...this.optionsFactors]; }

  setOptionsValues(values: Array<{ id: string; value: number }>): OptionsDashboard {
    for (const { id, value } of values) {
      const f = this.optionsFactors.find(x => x.id === id);
      if (f) {
        f.value = value;
        f.zScore = Math.tanh(value * 0.5);
        f.signal = value > 0.3 ? 'bullish' : value < -0.3 ? 'bearish' : 'neutral';
      }
    }
    return this.getOptionsDashboard();
  }

  getOptionsDashboard(): OptionsDashboard {
    const getV = (id: string) => this.optionsFactors.find(f => f.id === id)?.value ?? 0;
    const vix = getV('opt_iv_1');
    const skew = getV('opt_iv_2');
    const term = getV('opt_iv_3');
    const pc = getV('opt_pc_1');
    const bullish = [vix < -0.2, skew < -0.1, pc < -0.1].filter(Boolean).length;
    const bearish = [vix > 0.2, skew > 0.1, pc > 0.1].filter(Boolean).length;
    const overallSignal: OptionsDashboard['overallSignal'] =
      bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';
    return {
      vixProxy: vix, skew, termStructure: term, putCallRatio: pc, overallSignal,
      greeks: { delta: getV('opt_gk_1'), gamma: getV('opt_gk_2'), vega: getV('opt_gk_3'), theta: getV('opt_gk_4'), rho: getV('opt_gk_5') },
    };
  }

  // ====== Fixed Income ======
  getFIFactors(): FIFactor[] { return [...this.fiFactors]; }

  setFIValues(values: Array<{ id: string; value: number; bps?: number }>): FIDashboard {
    for (const { id, value, bps } of values) {
      const f = this.fiFactors.find(x => x.id === id);
      if (f) {
        f.value = value;
        f.bps = bps ?? value * 100;
        f.zScore = Math.tanh(value * 0.3);
        if (f.category === 'YieldCurve') {
          f.signal = value > 0.1 ? 'steepening' : value < -0.1 ? 'flattening' : 'stable';
        } else if (f.category === 'CreditSpread') {
          f.signal = value > 0.2 ? 'widening' : value < -0.2 ? 'tightening' : 'stable';
        }
      }
    }
    return this.getFIDashboard();
  }

  getFIDashboard(): FIDashboard {
    const getV = (id: string) => this.fiFactors.find(f => f.id === id);
    const y2 = getV('fi_yc_1'); const y10 = getV('fi_yc_2');
    const ig = getV('fi_cs_1'); const hy = getV('fi_cs_2');
    const eff = getV('fi_dur_1'); const mod = getV('fi_dur_2'); const conv = getV('fi_dur_3');
    return {
      curve: { '2Y': y2?.value??0, '10Y': y10?.value??0, spread: (y10?.value??0)-(y2?.value??0), inverted: (y10?.value??0) < (y2?.value??0) },
      credit: { IG: ig?.bps??0, HY: hy?.bps??0, spread: (hy?.bps??0)-(ig?.bps??0) },
      duration: { effective: eff?.value??0, modified: mod?.value??0, convexity: conv?.value??0 },
    };
  }

  /** Full 50-factor coverage report */
  getFullReport(): { esg: ESGScore; options: OptionsDashboard; fi: FIDashboard; totalFactors: number; coverage: { esg: number; options: number; fi: number } } {
    return {
      esg: this.computeESGScore(),
      options: this.getOptionsDashboard(),
      fi: this.getFIDashboard(),
      totalFactors: this.esgFactors.length + this.optionsFactors.length + this.fiFactors.length,
      coverage: { esg: this.esgFactors.length, options: this.optionsFactors.length, fi: this.fiFactors.length },
    };
  }

  getCoverage(): { total: number; esg: number; options: number; fi: number; esgByCategory: Record<string, number> } {
    const esgCat: Record<string, number> = {};
    for (const f of this.esgFactors) esgCat[f.category] = (esgCat[f.category] || 0) + 1;
    return { total: this.esgFactors.length + this.optionsFactors.length + this.fiFactors.length, esg: this.esgFactors.length, options: this.optionsFactors.length, fi: this.fiFactors.length, esgByCategory: esgCat };
  }

  seed(): void {
undefined' ? `  /**
   * 🚫 [R284 MockDataGuard] Production mode → seed() skipped.
   * Replace mock data with real API sources before enabling production.
   * Real sources: KR=KOSTAT/BOK, TW=MOEA, EU=Eurostat/ECB, SA=SAMA/OPEC
   */
  if (getMockDataGuard().isProduction()) {
    console.warn('[R284] seed() skipped in production mode. Use load methods with real data.');
    return;
  }
    // ESG seeding
    const esgVals: Array<{ id: string; score: number }> = [];
    for (const f of this.esgFactors) {
      const base = f.category === 'E' ? 6.5 + Math.random() * 2.5 : f.category === 'S' ? 5.8 + Math.random() * 2.5 : 6.2 + Math.random() * 2.5;
      esgVals.push({ id: f.id, score: Math.round(base * 10) / 10 });
    }
    this.setESGScores(esgVals);

    // Options seeding
    const optVals: Array<{ id: string; value: number }> = [];
    for (const f of this.optionsFactors) {
      optVals.push({ id: f.id, value: Number((Math.random() * 2 - 1).toFixed(3)) });
    }
    this.setOptionsValues(optVals);

    // FI seeding
    const fiVals: Array<{ id: string; value: number; bps: number }> = [];
    for (const f of this.fiFactors) {
      if (f.category === 'YieldCurve') {
        const v = f.id.includes('yc_1') ? 0.042 : f.id.includes('yc_2') ? 0.045 : f.id.includes('yc_3') ? 0.008 : 0.005;
        fiVals.push({ id: f.id, value: Number(v.toFixed(4)), bps: Math.round(v * 10000) });
      } else if (f.category === 'CreditSpread') {
        const v = f.id.includes('cs_1') ? 0.95 : f.id.includes('cs_2') ? 3.8 : 2.85;
        fiVals.push({ id: f.id, value: Number((v / 100).toFixed(4)), bps: Math.round(v * 100) });
      } else {
        fiVals.push({ id: f.id, value: 5 + Math.random() * 3, bps: 0 });
      }
    }
    this.setFIValues(fiVals);
    // Snapshot
    this.esgSnapshots.set('init', [this.computeESGScore()]);
  }

  reset(): void {
    for (const f of this.esgFactors) f.score = 0;
    for (const f of this.optionsFactors) { f.value = 0; f.zScore = 0; f.signal = 'neutral'; }
    for (const f of this.fiFactors) { f.value = 0; f.bps = 0; f.zScore = 0; f.signal = 'stable'; }
    this.esgSnapshots.clear();
    this.optSnapshots.clear();
  }
}

// Singleton
let _eofi: ESGOptionsFixedIncomeEngine | undefined;
export function getESGOptionsFixedIncomeEngine(): ESGOptionsFixedIncomeEngine {
  if (!_eofi) _eofi = new ESGOptionsFixedIncomeEngine();
  return _eofi;
}
export function resetESGOptionsFixedIncomeEngine(): void { _eofi?.reset(); _eofi = undefined; }
