/**
 * Global84FactorsEngine — R277 JVS-1 全球84因子引擎
 *
 * 14 国覆盖: JP/IN/KR/TW/EU/BR/SA/SG/AU/US/HK/CN/UK/VN
 * 每国 6 类因子: value/growth/momentum/quality/sentiment/flow 各 1
 * 总计 84+ 因子
 *
 * 功能:
 * - registerFactor / unregisterFactor per country
 * - calcAll per country
 * - globalRanking (cross-country)
 * - regionAggregate
 * - topPerformers / countryDashboard
 */

export interface CountryFactorConfig {
  id: string;
  name: string;
  country: string;
  countryName: string;
  category: 'value' | 'growth' | 'momentum' | 'quality' | 'sentiment' | 'flow';
  formula: string;
  description: string;
  thresholds: { strongLong: number; long: number; short: number; strongShort: number };
  enabled: boolean;
  normalize: 'tanh' | 'percentile' | 'zscore' | 'rank';
}

export interface GlobalFactorResult {
  factorId: string;
  factorName: string;
  country: string;
  countryName: string;
  category: string;
  value: number;
  normalized: number; // 0-1 normalized
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  confidence: number; // 0-1
  ranking: number; // cross-country rank (1=best)
}

export interface CountryDashboard {
  country: string;
  countryName: string;
  overallScore: number; // 0-100
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  topFactor: { id: string; name: string; value: number };
  worstFactor: { id: string; name: string; value: number };
  factorCount: number;
  categoryScores: Record<string, number>; // avg per category
}

interface FactorInput {
  price?: number;
  pe?: number;
  pb?: number;
  roe?: number;
  eps?: number;
  revenueGrowth?: number;
  marketCap?: number;
  volume?: number;
  dividendYield?: number;
  debtToEquity?: number;
  currentRatio?: number;
  grossMargin?: number;
  netMargin?: number;
  fcf?: number;
  beta?: number;
  shortInterest?: number;
  institutionalOwnership?: number;
  flowNet?: number;
  pmi?: number;
  gdpGrowth?: number;
}

// ============================================================
// Country factor registry builder
// ============================================================
const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'US', name: 'United States' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
  { code: 'KR', name: 'South Korea' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'EU', name: 'European Union' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'BR', name: 'Brazil' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AU', name: 'Australia' },
  { code: 'VN', name: 'Vietnam' },
];

const CATEGORIES = ['value', 'growth', 'momentum', 'quality', 'sentiment', 'flow'] as const;

// Category-specific formula builders per country
function buildCountryConfigs(): CountryFactorConfig[] {
  const configs: CountryFactorConfig[] = [];

  for (const country of COUNTRIES) {
    const c = country.code;
    const cn = country.name;

    // 1. Value — PB ratio (universal)
    configs.push({
      id: `${c.toLowerCase()}_value_pb`,
      name: `${cn} Value (PB)`,
      country: c, countryName: cn, category: 'value',
      formula: '1/(PB/median_PB)',
      description: `Price-to-Book valuation for ${cn} market`,
      thresholds: { strongLong: 0.7, long: 0.5, short: 0.3, strongShort: 0.15 },
      enabled: true, normalize: 'tanh',
    });

    // 2. Growth — Revenue Growth YoY
    configs.push({
      id: `${c.toLowerCase()}_growth_rev`,
      name: `${cn} Growth (Revenue)`,
      country: c, countryName: cn, category: 'growth',
      formula: 'tanh(revenueGrowth * 5)',
      description: `Revenue growth momentum for ${cn} market`,
      thresholds: { strongLong: 0.6, long: 0.4, short: 0.2, strongShort: 0.0 },
      enabled: true, normalize: 'tanh',
    });

    // 3. Momentum — 3M price momentum
    configs.push({
      id: `${c.toLowerCase()}_momentum_3m`,
      name: `${cn} Momentum (3M)`,
      country: c, countryName: cn, category: 'momentum',
      formula: 'tanh(3M_return * 3)',
      description: `3-month price momentum for ${cn} market`,
      thresholds: { strongLong: 0.6, long: 0.4, short: 0.2, strongShort: 0.0 },
      enabled: true, normalize: 'tanh',
    });

    // 4. Quality — ROE
    configs.push({
      id: `${c.toLowerCase()}_quality_roe`,
      name: `${cn} Quality (ROE)`,
      country: c, countryName: cn, category: 'quality',
      formula: 'tanh(ROE * 8)',
      description: `Return on Equity quality metric for ${cn} market`,
      thresholds: { strongLong: 0.6, long: 0.4, short: 0.2, strongShort: 0.0 },
      enabled: true, normalize: 'tanh',
    });

    // 5. Sentiment — Short Interest / Put-Call ratio (inverted)
    configs.push({
      id: `${c.toLowerCase()}_sentiment_si`,
      name: `${cn} Sentiment (Short Interest)`,
      country: c, countryName: cn, category: 'sentiment',
      formula: '1 - tanh(shortInterest * 3)',
      description: `Short interest sentiment for ${cn} market (inverted)`,
      thresholds: { strongLong: 0.7, long: 0.5, short: 0.3, strongShort: 0.15 },
      enabled: true, normalize: 'tanh',
    });

    // 6. Flow — Institutional ownership / net flow
    configs.push({
      id: `${c.toLowerCase()}_flow_inst`,
      name: `${cn} Flow (Institutional)`,
      country: c, countryName: cn, category: 'flow',
      formula: 'tanh(institutionalOwnership * 3)',
      description: `Institutional ownership flow for ${cn} market`,
      thresholds: { strongLong: 0.6, long: 0.4, short: 0.2, strongShort: 0.0 },
      enabled: true, normalize: 'tanh',
    });
  }

  return configs;
}

// ============================================================
export class Global84FactorsEngine {
  private registry: CountryFactorConfig[];
  private history = new Map<string, GlobalFactorResult[]>();

  constructor() {
    this.registry = buildCountryConfigs();
  }

  getRegistry(): CountryFactorConfig[] {
    return [...this.registry];
  }

  getCountries(): Array<{ code: string; name: string }> {
    return [...COUNTRIES];
  }

  getCategories(): string[] {
    return [...CATEGORIES];
  }

  /** Calculate factor value from input */
  calcFactor(factorId: string, input: FactorInput): GlobalFactorResult | null {
    const config = this.registry.find(c => c.id === factorId);
    if (!config) return null;

    let rawValue = 0;

    switch (config.category) {
      case 'value':
        rawValue = input.pb ? Math.tanh(1 / (input.pb / 1.5)) : 0.5;
        break;
      case 'growth':
        rawValue = Math.tanh((input.revenueGrowth ?? 0.05) * 5);
        break;
      case 'momentum':
        rawValue = Math.tanh((input.price ?? 0.05) * 3);
        break;
      case 'quality':
        rawValue = Math.tanh((input.roe ?? 0.12) * 8);
        break;
      case 'sentiment':
        rawValue = 1 - Math.tanh((input.shortInterest ?? 0.05) * 3);
        break;
      case 'flow':
        rawValue = Math.tanh((input.institutionalOwnership ?? 0.3) * 3);
        break;
      default:
        rawValue = 0.5;
    }

    const normalized = this.normalize(rawValue, config.normalize);

    // Signal classification
    let signal: GlobalFactorResult['signal'];
    if (rawValue >= config.thresholds.strongLong) signal = 'STRONG_LONG';
    else if (rawValue >= config.thresholds.long) signal = 'LONG';
    else if (rawValue >= config.thresholds.short) signal = 'NEUTRAL';
    else if (rawValue >= config.thresholds.strongShort) signal = 'SHORT';
    else signal = 'STRONG_SHORT';

    const confidence = Math.abs(rawValue - 0.5) * 2; // 0-1 distance from neutral

    const result: GlobalFactorResult = {
      factorId: config.id,
      factorName: config.name,
      country: config.country,
      countryName: config.countryName,
      category: config.category,
      value: rawValue,
      normalized,
      signal,
      confidence,
      ranking: 0, // filled by cross-country ranking
    };

    // Record history
    if (!this.history.has(factorId)) this.history.set(factorId, []);
    this.history.get(factorId)!.push(result);
    // Keep last 100
    const h = this.history.get(factorId)!;
    if (h.length > 100) h.shift();

    return result;
  }

  /** Calculate all factors for a given country */
  calcAll(input: FactorInput): GlobalFactorResult[] {
    const results: GlobalFactorResult[] = [];
    for (const config of this.registry) {
      if (config.enabled) {
        const r = this.calcFactor(config.id, input);
        if (r) results.push(r);
      }
    }
    return results;
  }

  /** Calculate all factors for a specific country */
  calcByCountry(country: string, input: FactorInput): GlobalFactorResult[] {
    const results: GlobalFactorResult[] = [];
    for (const config of this.registry) {
      if (config.country === country && config.enabled) {
        const r = this.calcFactor(config.id, input);
        if (r) results.push(r);
      }
    }
    return results;
  }

  /** Calculate all factors for a specific category across all countries */
  calcByCategory(category: string, input: FactorInput): GlobalFactorResult[] {
    const results: GlobalFactorResult[] = [];
    for (const config of this.registry) {
      if (config.category === category && config.enabled) {
        const r = this.calcFactor(config.id, input);
        if (r) results.push(r);
      }
    }
    return results;
  }

  /** Cross-country ranking for a specific category */
  globalRanking(category?: string): GlobalFactorResult[] {
    let all = this.getRegistry().map(c => {
      const h = this.history.get(c.id);
      return h ? h[h.length - 1] : { factorId: c.id, factorName: c.name, country: c.country, countryName: c.countryName, category: c.category, value: 0.5, normalized: 0.5, signal: 'NEUTRAL' as const, confidence: 0, ranking: 0 };
    });
    if (category) all = all.filter(r => r.category === category);
    all.sort((a, b) => b.value - a.value);
    all.forEach((r, i) => { r.ranking = i + 1; });
    return all;
  }

  /** Country dashboard — aggregate scores */
  getCountryDashboard(): CountryDashboard[] {
    return COUNTRIES.map(c => {
      const countryConfigs = this.registry.filter(f => f.country === c.code);
      let totalScore = 0;
      const categoryScores: Record<string, { sum: number; count: number }> = {};

      let topF: { id: string; name: string; value: number } | null = null;
      let worstF: { id: string; name: string; value: number } | null = null;

      for (const config of countryConfigs) {
        const h = this.history.get(config.id);
        const v = h ? h[h.length - 1]?.value ?? 0.5 : 0.5;
        const normalized = h ? h[h.length - 1]?.normalized ?? 0.5 : 0.5;

        totalScore += normalized * 100 / 6;

        if (!topF || v > topF.value) topF = { id: config.id, name: config.name, value: v };
        if (!worstF || v < worstF.value) worstF = { id: config.id, name: config.name, value: v };

        if (!categoryScores[config.category]) categoryScores[config.category] = { sum: 0, count: 0 };
        categoryScores[config.category].sum += normalized;
        categoryScores[config.category].count++;
      }

      const catAvg: Record<string, number> = {};
      for (const [cat, { sum, count }] of Object.entries(categoryScores)) {
        catAvg[cat] = count > 0 ? sum / count : 0;
      }

      const signal: CountryDashboard['signal'] =
        totalScore >= 70 ? 'STRONG_LONG' : totalScore >= 55 ? 'LONG'
        : totalScore >= 45 ? 'NEUTRAL' : totalScore >= 30 ? 'SHORT' : 'STRONG_SHORT';

      return {
        country: c.code,
        countryName: c.name,
        overallScore: Math.round(totalScore * 10) / 10,
        signal,
        topFactor: topF!,
        worstFactor: worstF!,
        factorCount: countryConfigs.length,
        categoryScores: catAvg,
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  }

  /** Top performing factors across all countries */
  topPerformers(n = 20): GlobalFactorResult[] {
    return this.globalRanking().slice(0, n);
  }

  /** Heatmap data: countries × categories */
  getHeatmap(): { countries: string[]; categories: string[]; matrix: number[][] } {
    const categories = [...CATEGORIES];
    const countries = COUNTRIES.map(c => c.code);
    const matrix: number[][] = [];

    for (const c of COUNTRIES) {
      const row: number[] = [];
      for (const cat of categories) {
        const cfg = this.registry.find(f => f.country === c.code && f.category === cat);
        if (cfg) {
          const h = this.history.get(cfg.id);
          row.push(h ? h[h.length - 1]?.normalized ?? 0.5 : 0.5);
        } else {
          row.push(0.5);
        }
      }
      matrix.push(row);
    }
    return { countries, categories, matrix };
  }

  /** Region aggregate — average score per region */
  getRegionAggregate(): Record<string, number> {
    const regions: Record<string, string[]> = {
      'Asia Developed': ['JP', 'HK', 'SG', 'AU'],
      'Asia Emerging': ['CN', 'IN', 'KR', 'TW', 'VN'],
      'Americas': ['US', 'BR'],
      'EMEA': ['EU', 'UK', 'SA'],
    };

    const result: Record<string, number> = {};
    for (const [region, codes] of Object.entries(regions)) {
      let sum = 0; let count = 0;
      for (const code of codes) {
        const countryConfigs = this.registry.filter(f => f.country === code);
        for (const cfg of countryConfigs) {
          const h = this.history.get(cfg.id);
          sum += h ? h[h.length - 1]?.normalized ?? 0.5 : 0.5;
          count++;
        }
      }
      result[region] = count > 0 ? sum / count : 0;
    }
    return result;
  }

  /** Top 3 countries */
  getTopCountries(n = 3): Array<{ country: string; countryName: string; score: number }> {
    return this.getCountryDashboard().slice(0, n).map(d => ({
      country: d.country, countryName: d.countryName, score: d.overallScore,
    }));
  }

  /** Coverage stats */
  getCoverage(): { total: number; byCountry: Record<string, number>; byCategory: Record<string, number>; enabled: number } {
    const byCountry: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let enabled = 0;

    for (const c of this.registry) {
      byCountry[c.country] = (byCountry[c.country] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      if (c.enabled) enabled++;
    }

    return { total: this.registry.length, byCountry, byCategory, enabled };
  }

  getHistory(factorId: string): GlobalFactorResult[] {
    return this.history.get(factorId) || [];
  }

  // ====== Seed ======
  seed(): void {
    // Seed each country's 6 factors with realistic cross-country variation
    const countryProfiles: Record<string, Partial<FactorInput>> = {
      US: { pe: 25, pb: 8, roe: 0.28, revenueGrowth: 0.10, price: 0.12, shortInterest: 0.02, institutionalOwnership: 0.75 },
      CN: { pe: 18, pb: 2.5, roe: 0.14, revenueGrowth: 0.08, price: 0.06, shortInterest: 0.03, institutionalOwnership: 0.35 },
      HK: { pe: 14, pb: 1.5, roe: 0.15, revenueGrowth: 0.07, price: 0.05, shortInterest: 0.04, institutionalOwnership: 0.45 },
      JP: { pe: 16, pb: 1.6, roe: 0.12, revenueGrowth: 0.05, price: 0.08, shortInterest: 0.02, institutionalOwnership: 0.55 },
      IN: { pe: 22, pb: 3.2, roe: 0.18, revenueGrowth: 0.12, price: 0.14, shortInterest: 0.06, institutionalOwnership: 0.30 },
      KR: { pe: 13, pb: 1.2, roe: 0.10, revenueGrowth: 0.06, price: 0.07, shortInterest: 0.03, institutionalOwnership: 0.40 },
      TW: { pe: 16, pb: 2.0, roe: 0.16, revenueGrowth: 0.09, price: 0.10, shortInterest: 0.04, institutionalOwnership: 0.38 },
      EU: { pe: 15, pb: 1.8, roe: 0.13, revenueGrowth: 0.04, price: 0.06, shortInterest: 0.02, institutionalOwnership: 0.50 },
      UK: { pe: 13, pb: 1.7, roe: 0.12, revenueGrowth: 0.03, price: 0.05, shortInterest: 0.03, institutionalOwnership: 0.52 },
      BR: { pe: 12, pb: 1.5, roe: 0.16, revenueGrowth: 0.08, price: 0.11, shortInterest: 0.07, institutionalOwnership: 0.25 },
      SA: { pe: 18, pb: 2.2, roe: 0.15, revenueGrowth: 0.06, price: 0.04, shortInterest: 0.05, institutionalOwnership: 0.20 },
      SG: { pe: 14, pb: 1.4, roe: 0.11, revenueGrowth: 0.04, price: 0.03, shortInterest: 0.02, institutionalOwnership: 0.42 },
      AU: { pe: 17, pb: 2.0, roe: 0.14, revenueGrowth: 0.05, price: 0.06, shortInterest: 0.03, institutionalOwnership: 0.48 },
      VN: { pe: 16, pb: 2.0, roe: 0.17, revenueGrowth: 0.10, price: 0.12, shortInterest: 0.08, institutionalOwnership: 0.18 },
    };

    for (const [code, profile] of Object.entries(countryProfiles)) {
      const factors = this.registry.filter(c => c.country === code);
      for (const f of factors) {
        const input: FactorInput = { ...profile };
        this.calcFactor(f.id, input);
      }
    }
  }

  reset(): void {
    this.history.clear();
  }

  // ====== Private ======
  private normalize(raw: number, method: CountryFactorConfig['normalize']): number {
    // Clamp to 0-1
    return Math.max(0, Math.min(1, raw));
  }
}

// ============================================================
// Singleton
// ============================================================
let _g84e: Global84FactorsEngine | undefined;

export function getGlobal84FactorsEngine(): Global84FactorsEngine {
  if (!_g84e) _g84e = new Global84FactorsEngine();
  return _g84e;
}

export function resetGlobal84FactorsEngine(): void {
  _g84e?.reset();
  _g84e = undefined;
}
