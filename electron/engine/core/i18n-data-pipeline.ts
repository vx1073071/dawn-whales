/**
 * I18n Data Pipeline - data pipeline
 * financial report
 */

import { EventEmitter } from 'events';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface TimezoneConfig {
  timezone: string;
  offset: number; // UTC offset in minutes
  name: string;
}

export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

export interface FinancialData {
  symbol: string;
  timestamp: number;
  value: number;
  currency: string;
  timezone: string;
  metadata?: Record<string, any>;
}

export interface ConversionOptions {
  fromCurrency?: string;
  toCurrency?: string;
  fromTimezone?: string;
  toTimezone?: string;
}

export interface ConversionResult {
  data: FinancialData;
  conversions: {
    currency?: { from: string; to: string; rate: number };
    timezone?: { from: string; to: string };
  };
  timestamp: number;
}

export class I18nDataPipeline extends EventEmitter {
  private currencies: Map<string, CurrencyConfig>;
  private timezones: Map<string, TimezoneConfig>;
  private rates: Map<string, CurrencyRate>;
  private cache: Map<string, ConversionResult>;
  private maxCacheSize: number;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(options?: { maxCacheSize?: number }) {
    super();
    this.currencies = new Map();
    this.timezones = new Map();
    this.rates = new Map();
    this.cache = new Map();
    this.maxCacheSize = options?.maxCacheSize || 1000;

    // Initialize default currencies
    this.initializeDefaultCurrencies();
    this.initializeDefaultTimezones();
    this.initializeDefaultRates();
  }

  private initializeDefaultCurrencies(): void {
    const defaultCurrencies: CurrencyConfig[] = [
      { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
      { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
      { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
      { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
      { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
    ];

    defaultCurrencies.forEach(currency => {
      this.currencies.set(currency.code, currency);
    });
  }

  private initializeDefaultTimezones(): void {
    const defaultTimezones: TimezoneConfig[] = [
      { timezone: 'UTC', offset: 0, name: 'Coordinated Universal Time' },
      { timezone: 'America/New_York', offset: -300, name: 'Eastern Time' },
      { timezone: 'Europe/London', offset: 0, name: 'Greenwich Mean Time' },
      { timezone: 'Asia/Shanghai', offset: 480, name: 'China Standard Time' },
      { timezone: 'Asia/Tokyo', offset: 540, name: 'Japan Standard Time' },
    ];

    defaultTimezones.forEach(timezone => {
      this.timezones.set(timezone.timezone, timezone);
    });
  }

  private initializeDefaultRates(): void {
    const now = Date.now();
    const defaultRates: CurrencyRate[] = [
      { from: 'USD', to: 'EUR', rate: 0.85, timestamp: now },
      { from: 'USD', to: 'GBP', rate: 0.73, timestamp: now },
      { from: 'USD', to: 'JPY', rate: 110.5, timestamp: now },
      { from: 'USD', to: 'CNY', rate: 7.25, timestamp: now },
      { from: 'EUR', to: 'USD', rate: 1 / 0.85, timestamp: now },
      { from: 'GBP', to: 'USD', rate: 1 / 0.73, timestamp: now },
      { from: 'JPY', to: 'USD', rate: 1 / 110.5, timestamp: now },
      { from: 'CNY', to: 'USD', rate: 1 / 7.25, timestamp: now },
    ];

    defaultRates.forEach(rate => {
      this.rates.set(`${rate.from}-${rate.to}`, rate);
    });
  }

  // Currency Management
  addCurrency(currency: CurrencyConfig): void {
    this.currencies.set(currency.code, currency);
    this.emit('currency-added', currency.code);
  }

  getCurrency(code: string): CurrencyConfig | undefined {
    return this.currencies.get(code);
  }

  getAllCurrencies(): CurrencyConfig[] {
    return Array.from(this.currencies.values());
  }

  // Currency Rate Management
  updateRates(rates: CurrencyRate[]): void {
    rates.forEach(rate => {
      const key = `${rate.from}-${rate.to}`;
      this.rates.set(key, rate);
    });
    this.emit('rates-updated', rates.length);
  }

  getRate(from: string, to: string): number {
    if (from === to) return 1;

    const key = `${from}-${to}`;
    const rate = this.rates.get(key);
    return rate?.rate || 1;
  }

  // Currency Conversion
  convertCurrency(amount: number, from: string, to: string): number {
    const rate = this.getRate(from, to);
    const currency = this.getCurrency(to);
    const decimals = currency?.decimals ?? 2;
    
    const converted = amount * rate;
    
    // For very small values, preserve more precision
    if (Math.abs(converted) < 0.01) {
      return converted;
    }
    
    return Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  formatCurrency(amount: number, currencyCode: string): string {
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      return amount.toString();
    }

    const formatted = amount.toFixed(currency.decimals);
    return `${currency.symbol}${formatted}`;
  }

  // Timezone Management
  addTimezone(timezone: TimezoneConfig): void {
    this.timezones.set(timezone.timezone, timezone);
    this.emit('timezone-added', timezone.timezone);
  }

  getTimezone(timezone: string): TimezoneConfig | undefined {
    return this.timezones.get(timezone);
  }

  getAllTimezones(): TimezoneConfig[] {
    return Array.from(this.timezones.values());
  }

  // Timezone Conversion
  convertTimezone(timestamp: number, fromTimezone: string, toTimezone: string): number {
    const from = this.getTimezone(fromTimezone);
    const to = this.getTimezone(toTimezone);

    if (!from || !to) {
      return timestamp;
    }

    const offsetDiff = (to.offset - from.offset) * 60 * 1000; // Convert to milliseconds
    return timestamp + offsetDiff;
  }

  formatTimezone(timestamp: number, timezone: string, locale?: string): string {
    const tz = this.getTimezone(timezone);
    if (!tz) {
      return new Date(timestamp).toISOString();
    }

    const converted = this.convertTimezone(timestamp, 'UTC', timezone);
    const date = new Date(converted);
    
    return date.toLocaleString(locale || 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    });
  }

  // Data Conversion
  convertData(data: FinancialData, options: ConversionOptions): ConversionResult {
    const conversions: ConversionResult['conversions'] = {};
    let convertedData = { ...data };

    // Currency conversion
    if (options.fromCurrency && options.toCurrency && options.fromCurrency !== options.toCurrency) {
      const rate = this.getRate(options.fromCurrency, options.toCurrency);
      convertedData.value = this.convertCurrency(data.value, options.fromCurrency, options.toCurrency);
      convertedData.currency = options.toCurrency;
      conversions.currency = {
        from: options.fromCurrency,
        to: options.toCurrency,
        rate: rate,
      };
    }

    // Timezone conversion
    if (options.fromTimezone && options.toTimezone && options.fromTimezone !== options.toTimezone) {
      convertedData.timestamp = this.convertTimezone(
        data.timestamp,
        options.fromTimezone,
        options.toTimezone
      );
      convertedData.timezone = options.toTimezone;
      conversions.timezone = {
        from: options.fromTimezone,
        to: options.toTimezone,
      };
    }

    return {
      data: convertedData,
      conversions,
      timestamp: Date.now(),
    };
  }

  // Batch Data Conversion
  convertDataBatch(dataList: FinancialData[], options: ConversionOptions): ConversionResult[] {
    return dataList.map(data => this.convertData(data, options));
  }

  // Cache Management
  convertDataWithCache(data: FinancialData, options: ConversionOptions): ConversionResult {
    const cacheKey = this.generateCacheKey(data, options);
    
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    this.cacheMisses++;
    const result = this.convertData(data, options);
    
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  // Format Financial Data
  formatFinancialData(data: FinancialData, locale?: string): string {
    const currency = this.formatCurrency(data.value, data.currency);
    const time = this.formatTimezone(data.timestamp, data.timezone, locale);
    return `${data.symbol}: ${currency} at ${time}`;
  }

  // Statistics
  getStats(): {
    currencies: number;
    timezones: number;
    rates: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      currencies: this.currencies.size,
      timezones: this.timezones.size,
      rates: this.rates.size,
      cacheSize: this.cache.size,
      cacheHitRate: 0,
    };
  }

  private generateCacheKey(data: FinancialData, options: ConversionOptions): string {
    return `${data.symbol}-${data.timestamp}-${options.fromCurrency}-${options.toCurrency}-${options.fromTimezone}-${options.toTimezone}`;
  }
}

export function createI18nDataPipeline(options?: { maxCacheSize?: number }): I18nDataPipeline {
  return new I18nDataPipeline(options);
}

export default I18nDataPipeline;
