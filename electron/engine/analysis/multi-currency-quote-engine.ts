// ── R273 JVS-4 💱 多币种报价引擎 (MultiCurrencyQuoteEngine) ──
// 24币种实时汇率 + 换算 + 深度 + 持仓重估 + 联动热图

export type CurrencyCode = 'USD' | 'EUR' | 'JPY' | 'GBP' | 'CNY' | 'HKD' | 'KRW' | 'TWD' | 'INR' | 'BRL'
  | 'AUD' | 'CAD' | 'CHF' | 'SGD' | 'MYR' | 'THB' | 'IDR' | 'PHP' | 'VND' | 'MXN'
  | 'ZAR' | 'TRY' | 'RUB' | 'AED';

export const ALL_CURRENCIES: CurrencyCode[] = [
  'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'HKD', 'KRW', 'TWD', 'INR', 'BRL',
  'AUD', 'CAD', 'CHF', 'SGD', 'MYR', 'THB', 'IDR', 'PHP', 'VND', 'MXN',
  'ZAR', 'TRY', 'RUB', 'AED',
];

export interface CurrencyRate {
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number; // how many quote per 1 base
  bid: number; ask: number;
  spread: number;
  timestamp: number;
  source: 'LSEG' | 'Bloomberg' | 'XE' | 'OANDA' | 'aggregate';
  dayHigh: number; dayLow: number;
  dayOpen: number;
  changePercent: number;
  volatility: number; // annualized %
  liquidity: 'high' | 'medium' | 'low';
}

export interface CurrencyPair {
  base: CurrencyCode; quote: CurrencyCode;
  pair: string; // e.g. 'USD/INR'
  rate: CurrencyRate;
}

export interface ConversionResult {
  from: { currency: CurrencyCode; amount: number };
  to: { currency: CurrencyCode; amount: number };
  rate: number;
  pair: string;
  timestamp: number;
  appliedSpread: number; // spread added to mid rate
}

export interface MultiCurrencyQuote {
  base: CurrencyCode;
  rates: Map<CurrencyCode, CurrencyRate>; // base→each other currency
  timestamp: number;
  dominantCurrency: 'USD'; // primary quoting currency
}

export interface CrossRate {
  from: CurrencyCode; to: CurrencyCode;
  rate: number; // how many 'to' per 1 'from'
  viaUSD: boolean; // triangulated through USD
  precision: number; // decimal places to display
}

export interface CurrencyHeatmap {
  timestamp: number;
  matrix: number[][]; // changePercent matrix: currencies × currencies
  strongest: CurrencyCode;
  weakest: CurrencyCode;
  avgChange: number;
  volatility: number;
  correlationCluster?: CurrencyCode[][]; // highly correlated currencies
}

export interface PortfolioExposure {
  totalValueUSD: number;
  currencies: {
    currency: CurrencyCode;
    value: number; // original
    valueUSD: number;
    percent: number; // of total
    exposure: 'long' | 'short' | 'balanced';
  }[];
  hedgingRecommendations: string[];
  var95: number; // Value at Risk 95% 1-day in USD
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class MultiCurrencyQuoteEngine {
  private rates = new Map<string, CurrencyRate>(); // "USD/JPY" → rate
  private baseCurrency: CurrencyCode = 'USD';

  reset(): void { this.rates.clear(); }

  // ═══════════ Rate Storage ═══════════

  /** Set base→quote rate */
  setRate(rate: CurrencyRate): void {
    const key = `${rate.base}/${rate.quote}`;
    this.rates.set(key, rate);
    // Also set inverse
    this.rates.set(`${rate.quote}/${rate.base}`, {
      ...rate, base: rate.quote, quote: rate.base,
      rate: 1 / rate.rate, bid: 1 / rate.ask, ask: 1 / rate.bid,
      spread: rate.spread,
    });
  }

  /** Get rate for base→quote pair */
  getRate(base: CurrencyCode, quote: CurrencyCode): CurrencyRate | undefined {
    if (base === quote) return { base, quote, rate: 1, bid: 1, ask: 1, spread: 0, timestamp: Date.now(), source: 'aggregate', dayHigh: 1, dayLow: 1, dayOpen: 1, changePercent: 0, volatility: 0, liquidity: 'high' };
    return this.rates.get(`${base}/${quote}`);
  }

  /** Get all rates */
  getAllRates(): CurrencyRate[] { return [...this.rates.values()]; }

  /** Get all rates for a base currency */
  getRatesForBase(base: CurrencyCode): CurrencyRate[] {
    return [...this.rates.values()].filter((r) => r.base === base);
  }

  // ═══════════ Conversion ═══════════

  /** Convert amount from one currency to another */
  convert(amount: number, from: CurrencyCode, to: CurrencyCode): ConversionResult | null {
    if (from === to) return { from: { currency: from, amount }, to: { currency: to, amount }, rate: 1, pair: `${from}/${to}`, timestamp: Date.now(), appliedSpread: 0 };

    // Direct pair lookup
    let rate = this.getRate(from, to);
    if (rate) {
      return { from: { currency: from, amount }, to: { currency: to, amount: Math.round(amount * rate.rate * 1000) / 1000 }, rate: rate.rate, pair: `${from}/${to}`, timestamp: rate.timestamp, appliedSpread: rate.spread };
    }

    // Triangulation via USD
    const fx2usd = this.getRate(from, 'USD');
    const usd2to = this.getRate('USD', to);
    if (fx2usd && usd2to) {
      const crossRate = fx2usd.rate * usd2to.rate;
      return { from: { currency: from, amount }, to: { currency: to, amount: Math.round(amount * crossRate * 1000) / 1000 }, rate: crossRate, pair: `${from}/${to}`, timestamp: Math.min(fx2usd.timestamp, usd2to.timestamp), appliedSpread: 0 };
    }

    return null;
  }

  /** Convert to USD (portfolio standard) */
  toUSD(amount: number, currency: CurrencyCode): number | null {
    const result = this.convert(amount, currency, 'USD');
    return result ? result.to.amount : null;
  }

  // ═══════════ Portfolio Exposure ═══════════

  /** Calculate total portfolio value in USD from list of positions */
  computePortfolioExposure(positions: { currency: CurrencyCode; amount: number }[]): PortfolioExposure | null {
    const values: { currency: CurrencyCode; value: number; valueUSD: number }[] = [];
    let totalUSD = 0;

    for (const pos of positions) {
      const usdValue = this.toUSD(pos.amount, pos.currency);
      if (usdValue === null) return null; // rate missing
      values.push({ currency: pos.currency, value: pos.amount, valueUSD: usdValue });
      totalUSD += usdValue;
    }

    const currencies = values.map((v) => ({
      currency: v.currency, value: v.value, valueUSD: Math.round(v.valueUSD * 100) / 100,
      percent: totalUSD > 0 ? Math.round((v.valueUSD / totalUSD) * 10000) / 100 : 0,
      exposure: totalUSD > 0 && v.valueUSD / totalUSD > 0.5 ? 'long' : totalUSD > 0 && v.valueUSD / totalUSD < 0.1 ? 'short' : 'balanced',
    })).sort((a, b) => b.valueUSD - a.valueUSD);

    // Simple VaR 95% (1-day): assume avg 1% daily vol
    const var95 = Math.round(totalUSD * 0.0166 * 100) / 100; // 1.66σ at 95% confidence

    const hedges: string[] = [];
    const usdExposure = currencies.find((c) => c.currency === 'USD');
    if (usdExposure && usdExposure.percent < 50) hedges.push('Increase USD allocation to ≥50% for natural hedge');

    return { totalValueUSD: Math.round(totalUSD * 100) / 100, currencies, hedgingRecommendations: hedges, var95 };
  }

  // ═══════════ Currency Pairs ═══════════

  /** Get all tracked currency pairs */
  getPairs(): CurrencyPair[] {
    const pairs: CurrencyPair[] = [];
    for (const [, rate] of this.rates) {
      if (rate.base < rate.quote) { // dedup: only show once
        pairs.push({ base: rate.base, quote: rate.quote, pair: `${rate.base}/${rate.quote}`, rate });
      }
    }
    return pairs;
  }

  /** Get most volatile pairs */
  getMostVolatile(limit = 10): CurrencyPair[] {
    return this.getPairs().sort((a, b) => b.rate.volatility - a.rate.volatility).slice(0, limit);
  }

  // ═══════════ Heatmap ═══════════

  /** Build cross-currency change% heatmap matrix */
  buildHeatmap(): CurrencyHeatmap | null {
    const majorCurrencies: CurrencyCode[] = ['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'HKD', 'KRW', 'TWD', 'INR', 'BRL'];
    const n = majorCurrencies.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    let strongestIdx = 0; let strongestVal = -Infinity;
    let weakestIdx = 0; let weakestVal = Infinity;
    let totalChange = 0; let count = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const rate = this.getRate(majorCurrencies[i], majorCurrencies[j]);
        const chg = rate?.changePercent || 0;
        matrix[i][j] = chg;
        if (i !== j) { totalChange += chg; count++; }
      }
      // Row average = currency strength
      const rowAvg = matrix[i].reduce((s, v, k) => k !== i ? s + v : s, 0) / (n - 1);
      if (rowAvg > strongestVal) { strongestVal = rowAvg; strongestIdx = i; }
      if (rowAvg < weakestVal) { weakestVal = rowAvg; weakestIdx = i; }
    }

    const avgChange = count > 0 ? totalChange / count : 0;
    const volatility = count > 0 ? Math.sqrt(matrix.flat().reduce((s, v) => s + (v !== 0 ? (v - avgChange) ** 2 : 0), 0) / count) : 0;

    return {
      timestamp: Date.now(), matrix,
      strongest: majorCurrencies[strongestIdx], weakest: majorCurrencies[weakestIdx],
      avgChange: Number(avgChange.toFixed(4)), volatility: Number(volatility.toFixed(4)),
    };
  }

  // ═══════════ Cross Rates ═══════════

  /** Compute cross rates for all pair combinations */
  getCrossRates(): CrossRate[] {
    const results: CrossRate[] = [];
    const currencies = ALL_CURRENCIES;
    for (const from of currencies) {
      for (const to of currencies) {
        if (from === to) continue;
        const direct = this.getRate(from, to);
        const viaUSD = !direct;
        const fx2usd = this.getRate(from, 'USD');
        const usd2to = this.getRate('USD', to);
        let rate = direct?.rate || (fx2usd && usd2to ? fx2usd.rate * usd2to.rate : 0);
        results.push({
          from, to, rate, viaUSD,
          precision: to === 'JPY' || to === 'KRW' || to === 'INR' || to === 'IDR' || to === 'VND' ? 2 : 4,
        });
      }
    }
    return results;
  }

  // ═══════════ Seed ═══════════

  seed(): number {
    const baseRates: Record<string, { rate: number; vol: number; prec: number }> = {
      'USD/EUR': { rate: 0.92, vol: 6, prec: 4 }, 'USD/JPY': { rate: 155, vol: 10, prec: 2 },
      'USD/GBP': { rate: 0.78, vol: 7, prec: 4 }, 'USD/CNY': { rate: 7.25, vol: 3, prec: 4 },
      'USD/HKD': { rate: 7.82, vol: 0.5, prec: 4 }, 'USD/KRW': { rate: 1350, vol: 8, prec: 2 },
      'USD/TWD': { rate: 32.5, vol: 4, prec: 3 }, 'USD/INR': { rate: 83.5, vol: 3, prec: 4 },
      'USD/BRL': { rate: 5.2, vol: 12, prec: 4 }, 'USD/AUD': { rate: 1.52, vol: 8, prec: 4 },
      'USD/CAD': { rate: 1.36, vol: 6, prec: 4 }, 'USD/CHF': { rate: 0.89, vol: 6, prec: 4 },
      'USD/SGD': { rate: 1.34, vol: 4, prec: 4 }, 'USD/MYR': { rate: 4.7, vol: 3, prec: 4 },
      'USD/THB': { rate: 36.5, vol: 4, prec: 4 }, 'USD/IDR': { rate: 16000, vol: 5, prec: 2 },
      'USD/PHP': { rate: 57, vol: 3, prec: 3 }, 'USD/VND': { rate: 25200, vol: 4, prec: 0 },
      'USD/MXN': { rate: 17.5, vol: 8, prec: 4 }, 'USD/ZAR': { rate: 18.2, vol: 12, prec: 4 },
      'USD/TRY': { rate: 32.5, vol: 15, prec: 4 }, 'USD/RUB': { rate: 90, vol: 20, prec: 3 },
      'USD/AED': { rate: 3.67, vol: 0.2, prec: 4 },
    };

    let count = 0;
    for (const [pair, info] of Object.entries(baseRates)) {
      const [base, quote] = pair.split('/') as [CurrencyCode, CurrencyCode];
      const mid = info.rate * (0.998 + Math.random() * 0.004);
      const spread = info.vol * 0.0001 + 0.0001;
      const change = (Math.random() - 0.5) * 0.5;

      this.setRate({
        base, quote, rate: mid, bid: mid * (1 - spread), ask: mid * (1 + spread),
        spread, timestamp: Date.now(), source: 'aggregate',
        dayHigh: mid * 1.005, dayLow: mid * 0.995, dayOpen: mid * (1 + change * 0.3),
        changePercent: change, volatility: info.vol, liquidity: info.vol > 10 ? 'medium' : 'high',
      });
      count++;
    }
    return count;
  }
}

// ═══════════ Singleton ═══════════

let mcqInstance: MultiCurrencyQuoteEngine | null = null;
export function getMultiCurrencyQuoteEngine(): MultiCurrencyQuoteEngine {
  if (!mcqInstance) mcqInstance = new MultiCurrencyQuoteEngine();
  return mcqInstance;
}
export function resetMultiCurrencyQuoteEngine(): void { mcqInstance = null; }
