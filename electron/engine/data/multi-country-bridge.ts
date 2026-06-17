/**
 * R275 多国数据源统一桥接 v5.0
 * 
 * Unified cross-country indicator evaluation bridge.
 * Wires up 🇯🇵JPX / 🇮🇳NSE / 🇧🇷B3 / 🇰🇷KRX / 🇹🇼TWSE / 🇪🇺EU / 🇸🇦TADAWUL
 * data into normalized indicator → signal → cross-compare pipeline.
 * 
 * Capabilities:
 *   - Per-country indicator evaluation (margin, shortsell, flow)
 *   - Normalized cross-country comparison
 *   - Aggregate risk scoring
 *   - Global market dashboard
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type CountryCode = 'JP' | 'IN' | 'BR' | 'KR' | 'TW' | 'EU' | 'SA';

export interface CountryIndicator {
  country: CountryCode;
  indicator: string;
  value: number;
  normalized: number;        // 0-100 normalized score
  direction: 'bullish' | 'bearish' | 'neutral';
  severity: 'info' | 'warning' | 'critical';
  raw: Record<string, unknown>;
}

export interface CrossCountryComparison {
  indicator: string;         // e.g. 'margin_ratio'
  values: Array<{ country: CountryCode; value: number; normalized: number }>;
  ranking: CountryCode[];   // best → worst
  best: CountryCode;
  worst: CountryCode;
  average: number;
  median: number;
  stdDev: number;
}

export interface GlobalRiskScore {
  overall: number;           // 0-100, higher = riskier
  breakdown: Array<{ country: CountryCode; score: number; topRisk: string }>;
  topRisks: string[];
  timestamp: number;
}

export interface GlobalMarketSnapshot {
  timestamp: number;
  countries: Array<{
    country: CountryCode;
    indicators: CountryIndicator[];
    compositeScore: number;
  }>;
  comparisons: CrossCountryComparison[];
  riskScore: GlobalRiskScore;
}

// ── Country Metadata ───────────────────────────────────────────────────────

const COUNTRY_META: Record<CountryCode, { name: string; nameCn: string; exchange: string; timezone: string }> = {
  JP: { name: 'Japan', nameCn: '日本', exchange: 'JPX', timezone: 'Asia/Tokyo' },
  IN: { name: 'India', nameCn: '印度', exchange: 'NSE', timezone: 'Asia/Kolkata' },
  BR: { name: 'Brazil', nameCn: '巴西', exchange: 'B3', timezone: 'America/Sao_Paulo' },
  KR: { name: 'South Korea', nameCn: '韩国', exchange: 'KRX', timezone: 'Asia/Seoul' },
  TW: { name: 'Taiwan', nameCn: '台湾', exchange: 'TWSE', timezone: 'Asia/Taipei' },
  EU: { name: 'Europe', nameCn: '欧洲', exchange: 'Euronext/Xetra', timezone: 'Europe/Paris' },
  SA: { name: 'Saudi Arabia', nameCn: '沙特', exchange: 'Tadawul', timezone: 'Asia/Riyadh' },
};

// ── Indicator Definitions ──────────────────────────────────────────────────

const INDICATOR_DEFS = [
  { id: 'margin_ratio',       name: 'Margin Ratio', nameCn: '融资融券比', higherBetter: false },
  { id: 'shortsell_ratio',    name: 'Short Sell Ratio', nameCn: '卖空比率', higherBetter: false },
  { id: 'foreign_flow',       name: 'Foreign Flow', nameCn: '外资流向', higherBetter: true },
  { id: 'credit_balance',     name: 'Credit Balance', nameCn: '信用交易余额', higherBetter: true },
  { id: 'market_breadth',     name: 'Market Breadth', nameCn: '市场宽度', higherBetter: true },
  { id: 'oi_net',             name: 'Futures OI Net', nameCn: '期货净OI', higherBetter: true },
  { id: 'pcr',                name: 'Put/Call Ratio', nameCn: 'PCR', higherBetter: false },
  { id: 'iv_index',           name: 'IV Index', nameCn: '波动率指数', higherBetter: false },
];

// ═══════════════════════════════════════════════════════════════════════════
// MultiCountryBridge
// ═══════════════════════════════════════════════════════════════════════════

export class MultiCountryBridge {
  private indicators_: Map<CountryCode, CountryIndicator[]> = new Map();
  private comparisons_: CrossCountryComparison[] = [];
  private riskScore_: GlobalRiskScore | null = null;

  // ── Per-Country Indicator Ingestion ─────────────────────────────────────

  /** Ingest normalized indicator for a country */
  ingest(country: CountryCode, indicator: Omit<CountryIndicator, 'country'> & Partial<Pick<CountryIndicator, 'country'>>): void {
    const full: CountryIndicator = { ...indicator, country };
    if (!this.indicators_.has(country)) this.indicators_.set(country, []);
    
    const arr = this.indicators_.get(country)!;
    const existing = arr.findIndex(i => i.indicator === full.indicator);
    if (existing >= 0) arr[existing] = full;
    else arr.push(full);
  }

  /** Bulk ingest indicators for one country */
  ingestBatch(country: CountryCode, indicators: Omit<CountryIndicator, 'country'>[]): void {
    for (const ind of indicators) this.ingest(country, ind);
  }

  // ── Cross-Country Comparison ────────────────────────────────────────────

  /** Compare a specific indicator across all countries */
  compare(indicatorId: string): CrossCountryComparison {
    const values: Array<{ country: CountryCode; value: number; normalized: number }> = [];
    
    for (const [country, indicators] of this.indicators_) {
      const ind = indicators.find(i => i.indicator === indicatorId);
      if (ind) values.push({ country, value: ind.value, normalized: ind.normalized });
    }

    const def = INDICATOR_DEFS.find(d => d.id === indicatorId);
    const higherBetter = def?.higherBetter ?? true;
    values.sort((a, b) => higherBetter ? b.normalized - a.normalized : a.normalized - b.normalized);
    const ranking = values.map(v => v.country);
    const best = values[0]?.country ?? 'JP';
    const worst = values[values.length - 1]?.country ?? 'JP';
    
    const nums = values.map(v => v.value);
    const average = nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted.length > 0 ? (sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)]) : 0;
    const variance = nums.length > 0 ? nums.reduce((s, v) => s + (v - average) ** 2, 0) / nums.length : 0;
    const stdDev = Math.sqrt(variance);

    return { indicator: indicatorId, values, ranking, best, worst, average, median, stdDev };
  }

  /** Compare all indicators across all countries */
  compareAll(): CrossCountryComparison[] {
    this.comparisons_ = INDICATOR_DEFS.map(d => this.compare(d.id));
    return this.comparisons_;
  }

  // ── Global Risk Scoring ─────────────────────────────────────────────────

  computeRiskScore(): GlobalRiskScore {
    const breakdown: Array<{ country: CountryCode; score: number; topRisk: string }> = [];
    const allRisks: string[] = [];

    for (const country of Object.keys(COUNTRY_META) as CountryCode[]) {
      const indicators = this.indicators_.get(country) || [];
      if (indicators.length === 0) {
        breakdown.push({ country, score: 50, topRisk: 'no_data' });
        continue;
      }

      let score = 0;
      let topRisk = '';
      let maxRiskContribution = 0;

      for (const ind of indicators) {
        const def = INDICATOR_DEFS.find(d => d.id === ind.indicator);
        let contribution = 0;

        switch (ind.indicator) {
          case 'margin_ratio':
            contribution = ind.value > 80 ? 25 : ind.value > 40 ? 15 : ind.value > 20 ? 5 : 0;
            break;
          case 'shortsell_ratio':
            contribution = ind.value > 40 ? 25 : ind.value > 25 ? 15 : ind.value > 15 ? 5 : 0;
            break;
          case 'foreign_flow':
            contribution = ind.value < -1000 ? 20 : ind.value < -300 ? 10 : 0;
            break;
          case 'market_breadth':
            contribution = ind.value < 0.5 ? 20 : ind.value < 0.8 ? 10 : 0;
            break;
          case 'pcr':
            contribution = ind.value > 1.5 ? 15 : ind.value > 1.2 ? 8 : ind.value < 0.5 ? 10 : 0;
            break;
          case 'iv_index':
            contribution = ind.value > 35 ? 20 : ind.value > 25 ? 10 : 0;
            break;
          case 'credit_balance':
            contribution = ind.value < 0.3 ? 15 : 0;
            break;
          case 'oi_net':
            contribution = ind.value < -10000 ? 15 : ind.value < -3000 ? 8 : 0;
            break;
        }

        score += contribution;
        if (contribution > maxRiskContribution && contribution > 0) {
          maxRiskContribution = contribution;
          topRisk = def?.nameCn || ind.indicator;
        }
      }

      score = Math.min(100, score);
      breakdown.push({ country, score, topRisk: topRisk || 'low' });

      if (score >= 70) allRisks.push(`${COUNTRY_META[country].nameCn}风险极高(${score})`);
      else if (score >= 50) allRisks.push(`${COUNTRY_META[country].nameCn}风险偏高(${score})`);
    }

    const overall = breakdown.reduce((s, b) => s + b.score, 0) / Math.max(1, breakdown.length);

    this.riskScore_ = {
      overall: Math.round(overall),
      breakdown: breakdown.sort((a, b) => b.score - a.score),
      topRisks: allRisks.slice(0, 5),
      timestamp: Date.now(),
    };
    return this.riskScore_;
  }

  // ── Global Snapshot ─────────────────────────────────────────────────────

  getSnapshot(): GlobalMarketSnapshot {
    return {
      timestamp: Date.now(),
      countries: (Object.keys(COUNTRY_META) as CountryCode[]).map(country => {
        const indicators = this.indicators_.get(country) || [];
        const composite = indicators.length > 0
          ? indicators.reduce((s, i) => s + i.normalized, 0) / indicators.length
          : 50;
        return { country, indicators, compositeScore: Math.round(composite) };
      }),
      comparisons: this.comparisons_,
      riskScore: this.riskScore_ ?? this.computeRiskScore(),
    };
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getCountryIndicators(country: CountryCode): CountryIndicator[] {
    return this.indicators_.get(country) || [];
  }

  getIndicator(indicatorId: string): Array<{ country: CountryCode; value: CountryIndicator }> {
    const results: Array<{ country: CountryCode; value: CountryIndicator }> = [];
    for (const [country, indicators] of this.indicators_) {
      const ind = indicators.find(i => i.indicator === indicatorId);
      if (ind) results.push({ country, value: ind });
    }
    return results;
  }

  getComparisons(): CrossCountryComparison[] { return this.comparisons_; }

  getRiskScore(): GlobalRiskScore | null { return this.riskScore_; }

  getCountryMeta(code: CountryCode) { return COUNTRY_META[code]; }

  getSupportedCountries(): CountryCode[] { return Object.keys(COUNTRY_META) as CountryCode[]; }

  getIndicatorDefs() { return INDICATOR_DEFS; }

  getActiveCountryCount(): number { return this.indicators_.size; }

  getTotalIndicatorCount(): number {
    let count = 0;
    for (const arr of this.indicators_.values()) count += arr.length;
    return count;
  }

  reset(): void {
    this.indicators_ = new Map();
    this.comparisons_ = [];
    this.riskScore_ = null;
  }
}

export const multiCountryBridge = new MultiCountryBridge();
