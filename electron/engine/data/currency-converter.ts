/**
 * currency-converter.ts — R99 J-01 Multi-Currency Conversion Engine
 *
 * Features:
 * - Real-time exchange rate fetching (exchangerate-api.com free tier)
 * - In-memory cache with 5-minute TTL
 * - Static fallback rates for offline mode
 * - Precision-aware conversion (currency-dependent decimal places)
 * - Singleton export (currencyConverter, getCurrencyConverter)
 */

/** Supported currencies */
export type CurrencyCode = 'USD' | 'CNY' | 'HKD' | 'JPY' | 'EUR' | 'KRW' | 'GBP' | 'AUD' | 'CAD' | 'CHF';

/** Exchange rate map: base currency -> { quote currency -> rate } */
export interface ExchangeRates {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, number>>;
  timestamp: number;
  source: 'live' | 'static' | 'cache';
}

/** Conversion result with metadata */
export interface ConversionResult {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
  result: number;
  rate: number;
  timestamp: number;
  source: 'live' | 'static' | 'cache';
}

/** Currency precision by ISO code */
export const CURRENCY_PRECISION: Record<CurrencyCode, number> = {
  USD: 2,
  CNY: 2,
  HKD: 2,
  JPY: 0,
  EUR: 2,
  KRW: 0,
  GBP: 2,
  AUD: 2,
  CAD: 2,
  CHF: 2,
};

/** Static fallback rates (USD base, updated 2024-06) */
const STATIC_RATES: Partial<Record<CurrencyCode, number>> = {
  USD: 1,
  CNY: 7.24,
  HKD: 7.82,
  JPY: 155.6,
  EUR: 0.92,
  KRW: 1365.0,
  GBP: 0.786,
  AUD: 1.505,
  CAD: 1.363,
  CHF: 0.888,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class CurrencyConverter {
  private cache: ExchangeRates | null = null;
  private fetchPromise: Promise<ExchangeRates | null> | null = null;
  private apiUrl: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || 'https://api.exchangerate-api.com/v4/latest/USD';
  }

  /**
   * Get decimal places for a given currency.
   */
  getPrecision(currency: CurrencyCode): number {
    return CURRENCY_PRECISION[currency] ?? 2;
  }

  /**
   * Round a value to the appropriate precision for the target currency.
   */
  roundToPrecision(value: number, currency: CurrencyCode): number {
    const decimals = this.getPrecision(currency);
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Get the current exchange rate from `from` to `to`.
   * Returns the rate and metadata.
   */
  async getRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    if (from === to) return 1;

    const rates = await this.fetchRates();

    const fromRate = rates.rates[from];
    const toRate = rates.rates[to];

    if (!fromRate && from !== 'USD') {
      throw new Error(`No rate available for currency: ${from}`);
    }
    if (!toRate && to !== 'USD') {
      throw new Error(`No rate available for currency: ${to}`);
    }

    // All rates are USD-based: toRate / fromRate
    const effectiveFrom = fromRate ?? 1;
    const effectiveTo = toRate ?? 1;
    return effectiveTo / effectiveFrom;
  }

  /**
   * Get rate synchronously from cache or static fallback.
   * Does NOT trigger a network fetch.
   */
  getRateSync(from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return 1;

    const ratesObj = this.getStaticRates();
    const rates = ratesObj.rates;

    const fromRate = rates[from];
    const toRate = rates[to];

    if (!fromRate && from !== 'USD') {
      throw new Error(`No rate available for currency: ${from}`);
    }
    if (!toRate && to !== 'USD') {
      throw new Error(`No rate available for currency: ${to}`);
    }

    const effectiveFrom = fromRate ?? 1;
    const effectiveTo = toRate ?? 1;
    return effectiveTo / effectiveFrom;
  }

  /**
   * Convert an amount from one currency to another.
   * Async — uses live rates when available.
   */
  async convert(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<ConversionResult> {
    const rates = await this.fetchRates();
    const rateObj = rates.rates;
    const fromRate = rateObj[from] ?? 1;
    const toRate = rateObj[to] ?? 1;
    const rate = from === to ? 1 : toRate / fromRate;
    const raw = amount * rate;
    const result = this.roundToPrecision(raw, to);

    return {
      from,
      to,
      amount,
      result,
      rate,
      timestamp: rates.timestamp,
      source: rates.source,
    };
  }

  /**
   * Synchronous conversion using cached or static rates.
   */
  convertSync(amount: number, from: CurrencyCode, to: CurrencyCode): ConversionResult {
    const rate = this.getRateSync(from, to);
    const raw = amount * rate;
    const result = this.roundToPrecision(raw, to);

    const ratesObj = this.cache ?? { base: 'USD', rates: STATIC_RATES, timestamp: Date.now(), source: 'static' as const };

    return {
      from,
      to,
      amount,
      result,
      rate,
      timestamp: ratesObj.timestamp,
      source: ratesObj.source,
    };
  }

  /**
   * Fetch live exchange rates with cache.
   * Falls back to static rates on network failure.
   */
  async fetchRates(): Promise<ExchangeRates> {
    // Return cache if still valid
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache;
    }

    // Deduplicate concurrent fetches
    if (this.fetchPromise) {
      const result = await this.fetchPromise;
      if (result) return result;
    }

    this.fetchPromise = this._doFetch();
    const result = await this.fetchPromise;
    this.fetchPromise = null;

    if (result) {
      this.cache = result;
      return result;
    }

    // Fallback to static
    return this.getStaticRates();
  }

  /**
   * Invalidate cache. Next fetchRates() will hit the network.
   */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Check if the cache is currently valid.
   */
  isCacheValid(): boolean {
    return !!(
      this.cache && Date.now() - this.cache.timestamp < CACHE_TTL_MS
    );
  }

  /**
   * Get remaining cache TTL in milliseconds.
   */
  getCacheTTL(): number {
    if (!this.cache) return 0;
    const elapsed = Date.now() - this.cache.timestamp;
    return Math.max(0, CACHE_TTL_MS - elapsed);
  }

  /**
   * Get supported currency codes.
   */
  getSupportedCurrencies(): CurrencyCode[] {
    return Object.keys(CURRENCY_PRECISION) as CurrencyCode[];
  }

  /**
   * Get static rates as an ExchangeRates object.
   */
  private getStaticRates(): ExchangeRates {
    return {
      base: 'USD',
      rates: { ...STATIC_RATES },
      timestamp: 0,
      source: 'static',
    };
  }

  /**
   * Perform network fetch.
   */
  private async _doFetch(): Promise<ExchangeRates | null> {
    try {
      const response = await fetch(this.apiUrl);
      if (!response.ok) return null;

      const data = await response.json();
      const rawRates: Record<string, number> = data.rates || {};

      // Filter to supported currencies only
      const supported = this.getSupportedCurrencies();
      const rates: Partial<Record<CurrencyCode, number>> = {};
      for (const code of supported) {
        if (typeof rawRates[code] === 'number') {
          rates[code] = rawRates[code];
        }
      }

      return {
        base: 'USD',
        rates,
        timestamp: Date.now(),
        source: 'live',
      };
    } catch {
      return null;
    }
  }
}

/** Singleton instance */
let _instance: CurrencyConverter | null = null;

export function getCurrencyConverter(apiUrl?: string): CurrencyConverter {
  if (!_instance) {
    _instance = new CurrencyConverter(apiUrl);
  }
  return _instance;
}

export const currencyConverter = getCurrencyConverter();
