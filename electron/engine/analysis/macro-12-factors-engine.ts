/**
 * Macro12FactorsEngine — R277 JVS-2 宏观12因子引擎
 *
 * 12 宏观因子 × 14 国:
 * 1. GDP Growth     2. Core CPI      3. PMI Manufacturing
 * 4. Unemployment   5. Industrial Production   6. Retail Sales
 * 7. Trade Balance  8. Interest Rate 9. M2 Money Supply
 * 10. Consumer Confidence  11. Business Confidence  12. Current Account
 *
 * 功能:
 * - calcFactor / calcAll / calcByCountry
 * - trendAnalysis (YoY, QoQ, MoM)
 * - zScoreDeviation (vs 3yr history)
 * - crossCountryRanking
 * - macroHealthScore 0-100 per country
 * - leadLagAnalysis (which countries lead/lag)
 * - seed with realistic macro profiles
 */

export interface MacroFactorConfig {
  id: string;
  name: string;
  abbr: string;
  description: string;
  unit: string;
  direction: 'higher_better' | 'lower_better' | 'stable_better';
}

export interface MacroFactorValue {
  factorId: string;
  factorName: string;
  country: string;
  countryName: string;
  value: number; // raw value
  zScore: number; // vs historical
  percentile: number; // cross-country percentile
  trend: 'improving' | 'stable' | 'deteriorating';
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  lastUpdated: number;
}

export interface MacroTrend {
  factorId: string;
  current: number;
  prev3m: number;
  prev6m: number;
  prev12m: number;
  qoq: number;
  yoy: number;
  trajectory: 'accel_up' | 'decel_up' | 'stable' | 'decel_down' | 'accel_down';
}

export interface MacroHealth {
  country: string;
  countryName: string;
  compositeScore: number; // 0-100
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  strengths: string[];
  weaknesses: string[];
  topFactors: Array<{ id: string; name: string; score: number }>;
  worstFactors: Array<{ id: string; name: string; score: number }>;
}

// ============================================================
// Registry
// ============================================================
const MACRO_FACTORS: MacroFactorConfig[] = [
  { id: 'macro_gdp', name: 'GDP Growth (YoY)', abbr: 'GDP', description: 'Year-over-year GDP growth rate', unit: '%', direction: 'higher_better' },
  { id: 'macro_cpi', name: 'Core CPI (YoY)', abbr: 'CPI', description: 'Core Consumer Price Index inflation', unit: '%', direction: 'stable_better' },
  { id: 'macro_pmi', name: 'PMI Manufacturing', abbr: 'PMI', description: 'Purchasing Managers Index — manufacturing', unit: 'index', direction: 'higher_better' },
  { id: 'macro_unemp', name: 'Unemployment Rate', abbr: 'U/E', description: 'Unemployment rate as percentage of labor force', unit: '%', direction: 'lower_better' },
  { id: 'macro_ip', name: 'Industrial Production', abbr: 'IP', description: 'Industrial production growth YoY', unit: '%', direction: 'higher_better' },
  { id: 'macro_retail', name: 'Retail Sales (YoY)', abbr: 'RS', description: 'Retail sales growth year-over-year', unit: '%', direction: 'higher_better' },
  { id: 'macro_trade', name: 'Trade Balance', abbr: 'TB', description: 'Net exports minus imports', unit: 'USD bn', direction: 'higher_better' },
  { id: 'macro_rate', name: 'Policy Interest Rate', abbr: 'IR', description: 'Central bank policy rate', unit: '%', direction: 'stable_better' },
  { id: 'macro_m2', name: 'M2 Money Supply (YoY)', abbr: 'M2', description: 'Broad money supply growth', unit: '%', direction: 'higher_better' },
  { id: 'macro_cons_conf', name: 'Consumer Confidence', abbr: 'CC', description: 'Consumer confidence index', unit: 'index', direction: 'higher_better' },
  { id: 'macro_biz_conf', name: 'Business Confidence', abbr: 'BC', description: 'Business confidence / sentiment index', unit: 'index', direction: 'higher_better' },
  { id: 'macro_cur_acct', name: 'Current Account', abbr: 'CA', description: 'Current account balance', unit: '% GDP', direction: 'higher_better' },
];

const MACRO_COUNTRIES: Array<{ code: string; name: string; region: string }> = [
  { code: 'US', name: 'United States', region: 'Americas' },
  { code: 'CN', name: 'China', region: 'Asia Emerging' },
  { code: 'HK', name: 'Hong Kong', region: 'Asia Developed' },
  { code: 'JP', name: 'Japan', region: 'Asia Developed' },
  { code: 'IN', name: 'India', region: 'Asia Emerging' },
  { code: 'KR', name: 'South Korea', region: 'Asia Developed' },
  { code: 'TW', name: 'Taiwan', region: 'Asia Developed' },
  { code: 'EU', name: 'European Union', region: 'EMEA' },
  { code: 'UK', name: 'United Kingdom', region: 'EMEA' },
  { code: 'BR', name: 'Brazil', region: 'Americas' },
  { code: 'SA', name: 'Saudi Arabia', region: 'EMEA' },
  { code: 'SG', name: 'Singapore', region: 'Asia Developed' },
  { code: 'AU', name: 'Australia', region: 'Asia Developed' },
  { code: 'VN', name: 'Vietnam', region: 'Asia Emerging' },
];

// ============================================================
export class Macro12FactorsEngine {
  private data = new Map<string, { current: number; history: number[]; lastUpdated: number }>();
  // key: country_factorId

  private compositeCache: Map<string, MacroHealth> | null = null;
  private cacheTime = 0;

  getFactors(): MacroFactorConfig[] {
    return [...MACRO_FACTORS];
  }

  getCountries(): Array<{ code: string; name: string; region: string }> {
    return [...MACRO_COUNTRIES];
  }

  /** Set macro data for a country+factor */
  setData(country: string, factorId: string, currentValue: number, history?: number[]): void {
    const key = `${country}_${factorId}`;
    this.data.set(key, {
      current: currentValue,
      history: history || [currentValue],
      lastUpdated: Date.now(),
    });
    this.compositeCache = null; // invalidate
  }

  /** Get macro factor value with analysis */
  calcFactor(country: string, factorId: string): MacroFactorValue | null {
    const key = `${country}_${factorId}`;
    const entry = this.data.get(key);
    if (!entry) return null;

    const config = MACRO_FACTORS.find(f => f.id === factorId);
    const countryMeta = MACRO_COUNTRIES.find(c => c.code === country);
    if (!config || !countryMeta) return null;

    const { current, history } = entry;

    // Z-Score vs 3yr history
    const mean = history.length > 1 ? history.reduce((a, b) => a + b, 0) / history.length : current;
    const sd = history.length > 1 ? Math.sqrt(history.reduce((a, x) => a + (x - mean) ** 2, 0) / (history.length - 1)) : 1;
    const zScore = sd > 0 ? (current - mean) / sd : 0;

    // Cross-country percentile
    const allVals = this.getAllValues(factorId);
    allVals.sort((a, b) => {
      if (config.direction === 'lower_better') return a - b;
      return b - a;
    });
    const rank = allVals.indexOf(current) + 1;
    const percentile = rank / allVals.length;

    // Trend detection
    let trend: MacroFactorValue['trend'] = 'stable';
    if (history.length >= 3) {
      const recent = history.slice(-3);
      if (config.direction === 'higher_better') {
        trend = recent[2] > recent[1] && recent[1] > recent[0] ? 'improving'
          : recent[2] < recent[1] && recent[1] < recent[0] ? 'deteriorating' : 'stable';
      } else {
        trend = recent[2] < recent[1] && recent[1] < recent[0] ? 'improving'
          : recent[2] > recent[1] && recent[1] > recent[0] ? 'deteriorating' : 'stable';
      }
    }

    // Signal
    let signal: MacroFactorValue['signal'];
    if (zScore > 1.5) signal = 'STRONG_LONG';
    else if (zScore > 0.5) signal = 'LONG';
    else if (zScore > -0.5) signal = 'NEUTRAL';
    else if (zScore > -1.5) signal = 'SHORT';
    else signal = 'STRONG_SHORT';

    // Invert for 'lower_better' or 'stable_better'
    if (config.direction !== 'higher_better') {
      const invert: Record<string, MacroFactorValue['signal']> = {
        'STRONG_LONG': 'STRONG_SHORT', 'LONG': 'SHORT', 'NEUTRAL': 'NEUTRAL',
        'SHORT': 'LONG', 'STRONG_SHORT': 'STRONG_LONG',
      };
      signal = invert[signal];
    }

    return {
      factorId, factorName: config.name, country, countryName: countryMeta.name,
      value: current, zScore, percentile, trend, signal, lastUpdated: entry.lastUpdated,
    };
  }

  /** Calculate all factors for one country */
  calcByCountry(country: string): MacroFactorValue[] {
    return MACRO_FACTORS
      .map(f => this.calcFactor(country, f.id))
      .filter((v): v is MacroFactorValue => v !== null);
  }

  /** Calculate all factors for all countries */
  calcAll(): MacroFactorValue[] {
    const results: MacroFactorValue[] = [];
    for (const country of MACRO_COUNTRIES) {
      for (const factor of MACRO_FACTORS) {
        const r = this.calcFactor(country.code, factor.id);
        if (r) results.push(r);
      }
    }
    return results;
  }

  /** Cross-country ranking for a specific factor */
  crossCountryRanking(factorId: string): MacroFactorValue[] {
    const config = MACRO_FACTORS.find(f => f.id === factorId);
    if (!config) return [];

    const results = MACRO_COUNTRIES
      .map(c => this.calcFactor(c.code, factorId))
      .filter((v): v is MacroFactorValue => v !== null);

    if (config.direction === 'higher_better') {
      results.sort((a, b) => b.value - a.value);
    } else {
      results.sort((a, b) => a.value - b.value);
    }
    return results;
  }

  /** Country macro health composite score 0-100 */
  getMacroHealth(): MacroHealth[] {
    // Check cache (5 min TTL)
    if (this.compositeCache && Date.now() - this.cacheTime < 300000) {
      return Array.from(this.compositeCache.values());
    }

    const results: MacroHealth[] = [];

    for (const country of MACRO_COUNTRIES) {
      const factors = this.calcByCountry(country.code);
      if (factors.length === 0) continue;

      // Weighted score:
      // * zScore → 0-100 score per factor
      // * GDP 15%, CPI 10%, PMI 10%, Unemp 8%, IP 8%, Retail 8%
      // * Trade 7%, Rate 7%, M2 7%, CC 7%, BC 7%, CA 6%
      const weights: Record<string, number> = {
        macro_gdp: 0.15, macro_cpi: 0.10, macro_pmi: 0.10,
        macro_unemp: 0.08, macro_ip: 0.08, macro_retail: 0.08,
        macro_trade: 0.07, macro_rate: 0.07, macro_m2: 0.07,
        macro_cons_conf: 0.07, macro_biz_conf: 0.07, macro_cur_acct: 0.06,
      };

      let weightedScore = 0;
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const topFactors: Array<{ id: string; name: string; score: number }> = [];
      const worstFactors: Array<{ id: string; name: string; score: number }> = [];

      for (const f of factors) {
        // Convert zScore to 0-100 score (zScore -2→+2 maps to 0→100)
        const score = Math.max(0, Math.min(100, (f.zScore + 2) * 25));
        weightedScore += score * (weights[f.factorId] || 1/12);

        topFactors.push({ id: f.factorId, name: f.factorName, score });

        if (f.signal === 'STRONG_LONG' || f.signal === 'LONG') {
          strengths.push(f.factorName);
        } else if (f.signal === 'STRONG_SHORT' || f.signal === 'SHORT') {
          weaknesses.push(f.factorName);
        }
      }

      topFactors.sort((a, b) => b.score - a.score);
      worstFactors.push(...[...topFactors].reverse().slice(0, 3));

      // Weighted round
      const compositeScore = Math.round(weightedScore);

      const signal: MacroHealth['signal'] =
        compositeScore >= 70 ? 'STRONG_LONG' : compositeScore >= 55 ? 'LONG'
        : compositeScore >= 45 ? 'NEUTRAL' : compositeScore >= 30 ? 'SHORT' : 'STRONG_SHORT';

      results.push({
        country: country.code,
        countryName: country.name,
        compositeScore,
        signal,
        strengths: strengths.slice(0, 5),
        weaknesses: weaknesses.slice(0, 5),
        topFactors: topFactors.slice(0, 3),
        worstFactors: worstFactors.slice(0, 3),
      });
    }

    results.sort((a, b) => b.compositeScore - a.compositeScore);

    // Cache
    this.compositeCache = new Map();
    for (const r of results) this.compositeCache.set(r.country, r);
    this.cacheTime = Date.now();

    return results;
  }

  /** Trend analysis — multi-timeframe */
  trendAnalysis(country: string, factorId: string): MacroTrend | null {
    const key = `${country}_${factorId}`;
    const entry = this.data.get(key);
    if (!entry || entry.history.length < 12) return null;

    const hist = entry.history;
    const current = hist[hist.length - 1];
    const prev3m = hist[Math.max(0, hist.length - 4)]; // ~3mo ago
    const prev6m = hist[Math.max(0, hist.length - 7)]; // ~6mo ago
    const prev12m = hist[Math.max(0, hist.length - 13)]; // ~12mo ago

    const qoq = prev3m !== 0 ? (current - prev3m) / Math.abs(prev3m) : 0;
    const yoy = prev12m !== 0 ? (current - prev12m) / Math.abs(prev12m) : 0;

    let trajectory: MacroTrend['trajectory'] = 'stable';
    if (yoy > 0.02 && qoq > 0) trajectory = 'accel_up';
    else if (yoy > 0.02) trajectory = 'decel_up';
    else if (yoy < -0.02 && qoq < 0) trajectory = 'accel_down';
    else if (yoy < -0.02) trajectory = 'decel_down';

    return { factorId, current, prev3m, prev6m, prev12m, qoq, yoy, trajectory };
  }

  /** Lead-Lag: find countries that lead in macro improvement */
  leadLagAnalysis(factorId: string): Array<{ country: string; countryName: string; yoy: number; qoq: number; leads: boolean }> {
    const config = MACRO_FACTORS.find(f => f.id === factorId);
    if (!config) return [];

    const results = MACRO_COUNTRIES.map(c => {
      const trend = this.trendAnalysis(c.code, factorId);
      return {
        country: c.code, countryName: c.name,
        yoy: trend?.yoy ?? 0,
        qoq: trend?.qoq ?? 0,
        leads: (trend?.qoq ?? 0) > 0,
      };
    });

    // Sort: leading improvers first
    results.sort((a, b) => {
      if (a.leads !== b.leads) return a.leads ? -1 : 1;
      return b.yoy - a.yoy;
    });
    return results;
  }

  /** Divergence detection: which countries have extreme data vs their region */
  getRegionalDivergences(): Array<{ country: string; factor: string; zScoreDiff: number }> {
    const regionMaps = new Map<string, string[]>();
    for (const c of MACRO_COUNTRIES) {
      if (!regionMaps.has(c.region)) regionMaps.set(c.region, []);
      regionMaps.get(c.region)!.push(c.code);
    }

    const divergences: Array<{ country: string; factor: string; zScoreDiff: number }> = [];

    for (const [region, codes] of Array.from(regionMaps.entries())) {
      for (const factor of MACRO_FACTORS) {
        const zScores: Array<{ country: string; z: number }> = [];
        for (const code of codes) {
          const r = this.calcFactor(code, factor.id);
          if (r) zScores.push({ country: code, z: r.zScore });
        }
        if (zScores.length < 2) continue;

        const avgZ = zScores.reduce((a, b) => a + b.z, 0) / zScores.length;
        for (const { country, z } of zScores) {
          const diff = z - avgZ;
          if (Math.abs(diff) > 1.5) {
            divergences.push({ country, factor: factor.abbr, zScoreDiff: diff });
          }
        }
      }
    }

    return divergences.sort((a, b) => Math.abs(b.zScoreDiff) - Math.abs(a.zScoreDiff));
  }

  /** Coverage stats */
  getCoverage(): { total: number; factors: number; countries: number; populated: number; missing: number } {
    const total = MACRO_FACTORS.length * MACRO_COUNTRIES.length;
    const populated = this.data.size;
    return { total, factors: MACRO_FACTORS.length, countries: MACRO_COUNTRIES.length, populated, missing: total - populated };
  }

  // ====== Seed ======
  seed(): void {
    // Realistic macro profiles per country
    const profiles: Record<string, Record<string, number[]>> = {
      US: { macro_gdp: [2.8], macro_cpi: [3.1], macro_pmi: [49.5], macro_unemp: [4.1], macro_ip: [1.2],
            macro_retail: [3.5], macro_trade: [-85], macro_rate: [5.25], macro_m2: [2.5],
            macro_cons_conf: [102], macro_biz_conf: [52], macro_cur_acct: [-3.5] },
      CN: { macro_gdp: [5.2], macro_cpi: [0.5], macro_pmi: [51.5], macro_unemp: [5.2], macro_ip: [4.8],
            macro_retail: [5.1], macro_trade: [120], macro_rate: [3.45], macro_m2: [8.5],
            macro_cons_conf: [95], macro_biz_conf: [51], macro_cur_acct: [1.8] },
      HK: { macro_gdp: [3.2], macro_cpi: [2.0], macro_pmi: [52.0], macro_unemp: [3.0], macro_ip: [2.5],
            macro_retail: [4.2], macro_trade: [-5], macro_rate: [5.75], macro_m2: [3.2],
            macro_cons_conf: [88], macro_biz_conf: [48], macro_cur_acct: [5.2] },
      JP: { macro_gdp: [1.2], macro_cpi: [2.8], macro_pmi: [50.5], macro_unemp: [2.5], macro_ip: [0.5],
            macro_retail: [1.8], macro_trade: [-25], macro_rate: [0.5], macro_m2: [1.8],
            macro_cons_conf: [36], macro_biz_conf: [12], macro_cur_acct: [3.2] },
      IN: { macro_gdp: [7.2], macro_cpi: [4.8], macro_pmi: [58.5], macro_unemp: [7.5], macro_ip: [5.5],
            macro_retail: [6.8], macro_trade: [-18], macro_rate: [6.5], macro_m2: [9.5],
            macro_cons_conf: [105], macro_biz_conf: [55], macro_cur_acct: [-1.2] },
      KR: { macro_gdp: [2.2], macro_cpi: [2.5], macro_pmi: [49.0], macro_unemp: [2.8], macro_ip: [4.2],
            macro_retail: [2.1], macro_trade: [28], macro_rate: [3.5], macro_m2: [5.2],
            macro_cons_conf: [98], macro_biz_conf: [72], macro_cur_acct: [3.8] },
      TW: { macro_gdp: [3.8], macro_cpi: [2.1], macro_pmi: [53.0], macro_unemp: [3.4], macro_ip: [7.2],
            macro_retail: [3.0], macro_trade: [42], macro_rate: [2.0], macro_m2: [5.8],
            macro_cons_conf: [72], macro_biz_conf: [58], macro_cur_acct: [12.5] },
      EU: { macro_gdp: [1.0], macro_cpi: [2.6], macro_pmi: [47.5], macro_unemp: [6.2], macro_ip: [-0.5],
            macro_retail: [1.2], macro_trade: [35], macro_rate: [4.0], macro_m2: [1.5],
            macro_cons_conf: [-14], macro_biz_conf: [-8], macro_cur_acct: [2.8] },
      UK: { macro_gdp: [0.6], macro_cpi: [3.2], macro_pmi: [51.0], macro_unemp: [4.2], macro_ip: [0.8],
            macro_retail: [0.5], macro_trade: [-12], macro_rate: [4.5], macro_m2: [1.2],
            macro_cons_conf: [-8], macro_biz_conf: [45], macro_cur_acct: [-2.5] },
      BR: { macro_gdp: [2.5], macro_cpi: [5.0], macro_pmi: [53.5], macro_unemp: [6.8], macro_ip: [3.2],
            macro_retail: [4.5], macro_trade: [15], macro_rate: [10.5], macro_m2: [6.5],
            macro_cons_conf: [92], macro_biz_conf: [52], macro_cur_acct: [-0.8] },
      SA: { macro_gdp: [2.8], macro_cpi: [2.2], macro_pmi: [57.0], macro_unemp: [4.5], macro_ip: [5.5],
            macro_retail: [5.2], macro_trade: [25], macro_rate: [5.5], macro_m2: [7.8],
            macro_cons_conf: [110], macro_biz_conf: [60], macro_cur_acct: [8.5] },
      SG: { macro_gdp: [2.5], macro_cpi: [2.8], macro_pmi: [50.8], macro_unemp: [2.0], macro_ip: [6.5],
            macro_retail: [2.8], macro_trade: [35], macro_rate: [3.2], macro_m2: [4.5],
            macro_cons_conf: [85], macro_biz_conf: [55], macro_cur_acct: [18.5] },
      AU: { macro_gdp: [2.1], macro_cpi: [3.5], macro_pmi: [48.5], macro_unemp: [3.8], macro_ip: [1.5],
            macro_retail: [2.0], macro_trade: [12], macro_rate: [4.1], macro_m2: [3.5],
            macro_cons_conf: [82], macro_biz_conf: [48], macro_cur_acct: [0.5] },
      VN: { macro_gdp: [6.8], macro_cpi: [3.8], macro_pmi: [54.5], macro_unemp: [2.2], macro_ip: [8.5],
            macro_retail: [7.2], macro_trade: [22], macro_rate: [4.0], macro_m2: [10.2],
            macro_cons_conf: [96], macro_biz_conf: [56], macro_cur_acct: [2.5] },
    };

    for (const [code, factors] of Object.entries(profiles)) {
      for (const [factorId, vals] of Object.entries(factors)) {
        // Generate 24mo history
        const history: number[] = [];
        const base = vals[0];
        for (let i = 0; i < 24; i++) {
          const noise = (Math.random() - 0.5) * base * 0.1;
          history.push(base + noise);
        }
        this.setData(code, factorId, base, history);
      }
    }
  }

  reset(): void {
    this.data.clear();
    this.compositeCache = null;
    this.cacheTime = 0;
  }

  // ====== Private ======
  private getAllValues(factorId: string): number[] {
    return MACRO_COUNTRIES
      .map(c => {
        const entry = this.data.get(`${c.code}_${factorId}`);
        return entry?.current;
      })
      .filter((v): v is number => v !== undefined);
  }
}

// ============================================================
// Singleton
// ============================================================
let _m12e: Macro12FactorsEngine | undefined;

export function getMacro12FactorsEngine(): Macro12FactorsEngine {
  if (!_m12e) _m12e = new Macro12FactorsEngine();
  return _m12e;
}

export function resetMacro12FactorsEngine(): void {
  _m12e?.reset();
  _m12e = undefined;
}
