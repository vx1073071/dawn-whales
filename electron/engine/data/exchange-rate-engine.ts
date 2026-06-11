/**
 * exchange-rate-engine.ts — R102 J-01 Exchange Rate Engine
 *
 * Fetches real-time exchange rates for 6 fiat currencies → USDT,
 * with CoinGecko → Binance → static fallback chain and 60s in-memory cache.
 *
 * Currencies: HKD, CNY, USD, JPY, EUR, GBP
 * Base: USDT (Tether)
 */

/** Supported fiat currencies */
export type FiatCurrency = 'HKD' | 'CNY' | 'USD' | 'JPY' | 'EUR' | 'GBP';

/** Rate record type */
export type ExchangeRates = Record<FiatCurrency, number>;

/** Cache entry */
interface CacheEntry {
  rates: ExchangeRates;
  timestamp: number;
  source: 'coingecko' | 'binance' | 'static';
}

/** Binance ticker response */
interface BinanceTicker {
  symbol: string;
  price: string;
}

// ─── Static fallback rates (updated 2026-06) ───
const STATIC_RATES: ExchangeRates = {
  HKD: 0.1277,   // 1 HKD = 0.1277 USDT
  CNY: 0.1381,   // 1 CNY = 0.1381 USDT
  USD: 1.0,      // 1 USD = 1 USDT
  JPY: 0.00643,  // 1 JPY = 0.00643 USDT
  EUR: 1.089,    // 1 EUR = 1.089 USDT
  GBP: 1.273,    // 1 GBP = 1.273 USDT
};

const CACHE_TTL_MS = 60_000;       // 60 seconds
const STALE_THRESHOLD_MS = 300_000; // 5 minutes → stale warning

export class ExchangeRateEngine {
  private cache: CacheEntry | null = null;
  private fetchInProgress: Promise<ExchangeRates> | null = null;

  /**
   * Get exchange rate for a single fiat currency → USDT.
   * Returns 0 if currency is unsupported or fetch fails.
   */
  async getRate(from: FiatCurrency): Promise<number> {
    const rates = await this.getAllRates();
    return rates[from] ?? 0;
  }

  /**
   * Synchronously get a single rate (uses cache, falls back to static).
   */
  getRateSync(from: FiatCurrency): number {
    if (this.cache && (Date.now() - this.cache.timestamp) < CACHE_TTL_MS) {
      return this.cache.rates[from] ?? 0;
    }
    return STATIC_RATES[from] ?? 0;
  }

  /**
   * Get all exchange rates.
   * Uses cached values if within TTL, otherwise fetches fresh.
   */
  async getAllRates(): Promise<ExchangeRates> {
    if (this.cache && (Date.now() - this.cache.timestamp) < CACHE_TTL_MS) {
      return this.cache.rates;
    }

    // Deduplicate concurrent fetch requests
    if (this.fetchInProgress) {
      return this.fetchInProgress;
    }

    this.fetchInProgress = this.doFetch();
    try {
      const rates = await this.fetchInProgress;
      return rates;
    } finally {
      this.fetchInProgress = null;
    }
  }

  /**
   * Force refresh rates, bypassing the cache.
   */
  async refresh(): Promise<ExchangeRates> {
    this.invalidateCache();
    return this.getAllRates();
  }

  /**
   * Check if the current cache is stale (>5 min since last fetch).
   */
  isStale(): boolean {
    if (!this.cache) return true;
    return (Date.now() - this.cache.timestamp) >= STALE_THRESHOLD_MS;
  }

  /**
   * Get the source of the last cached rates.
   */
  getSource(): 'coingecko' | 'binance' | 'static' | null {
    return this.cache?.source ?? null;
  }

  /**
   * Get the age of the cache in milliseconds, or -1 if never cached.
   */
  getCacheAge(): number {
    if (!this.cache) return -1;
    return Date.now() - this.cache.timestamp;
  }

  /**
   * Invalidate the cache (force next getRate to fetch).
   */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Set static rates for testing / manual override.
   */
  setStaticRates(rates: Partial<ExchangeRates>): void {
    Object.assign(STATIC_RATES, rates);
  }

  /**
   * Get the static fallback rates (for testing).
   */
  getStaticRates(): ExchangeRates {
    return { ...STATIC_RATES };
  }

  // ─── Private: fetch chain ───

  private async doFetch(): Promise<ExchangeRates> {
    // Tier 1: CoinGecko
    try {
      const rates = await this.fetchCoinGecko();
      this.cache = { rates, timestamp: Date.now(), source: 'coingecko' };
      return rates;
    } catch {
      // Tier 2: Binance
      try {
        const rates = await this.fetchBinance();
        this.cache = { rates, timestamp: Date.now(), source: 'binance' };
        return rates;
      } catch {
        // Tier 3: static fallback
        this.cache = { rates: { ...STATIC_RATES }, timestamp: Date.now(), source: 'static' };
        return { ...STATIC_RATES };
      }
    }
  }

  private async fetchCoinGecko(): Promise<ExchangeRates> {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=hkd,cny,usd,jpy,eur,gbp';
    const response = await this.httpGet(url);
    const data = JSON.parse(response);

    if (!data?.tether) {
      throw new Error('Invalid CoinGecko response: missing tether');
    }

    const raw = data.tether as Record<string, number>;
    const rates: ExchangeRates = {} as ExchangeRates;

    for (const currency of ['HKD', 'CNY', 'USD', 'JPY', 'EUR', 'GBP'] as FiatCurrency[]) {
      const key = currency.toLowerCase();
      if (typeof raw[key] !== 'number' || raw[key] <= 0) {
        throw new Error(`Invalid CoinGecko rate for ${currency}`);
      }
      rates[currency] = this.invertRate(raw[key]);
    }

    return rates;
  }

  private async fetchBinance(): Promise<ExchangeRates> {
    // Binance doesn't have direct fiat→USDT pairs for all currencies.
    // We use USDTUSDC price as a stability check and fall back to static.
    const url = 'https://api.binance.com/api/v3/ticker/price';
    const response = await this.httpGet(url);
    const tickers = JSON.parse(response) as BinanceTicker[];

    if (!Array.isArray(tickers)) {
      throw new Error('Invalid Binance response');
    }

    // Binance has limited fiat pairs; extract what we can
    const fiatPairs: Record<string, string> = {
      USD: 'USDTUSDC',
    };

    const rates: ExchangeRates = { ...STATIC_RATES };

    for (const ticker of tickers) {
      for (const [currency, symbol] of Object.entries(fiatPairs)) {
        if (ticker.symbol === symbol) {
          const price = parseFloat(ticker.price);
          if (price > 0) {
            rates[currency as FiatCurrency] = price;
          }
        }
      }
    }

    return rates;
  }

  private async httpGet(url: string): Promise<string> {
    // Use fetch API (available in Node 18+ and Electron)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * CoinGecko gives price of 1 USDT in fiat (e.g., hkd: 7.8 means 1 USDT = 7.8 HKD).
   * We want 1 fiat → USDT, so invert: 1 / rate.
   */
  private invertRate(rate: number): number {
    return 1 / rate;
  }
}

// ─── Singleton ───

let _engine: ExchangeRateEngine | null = null;

export function getExchangeRateEngine(): ExchangeRateEngine {
  if (!_engine) {
    _engine = new ExchangeRateEngine();
  }
  return _engine;
}

export const exchangeRateEngine = getExchangeRateEngine();
