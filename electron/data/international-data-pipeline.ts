// JVS-47-01: International Data Pipeline
// Supports multi-currency financial reports, multi-timezone, and currency conversion

import { EventEmitter } from 'events';
import log from 'electron-log';

// Supported currencies
export type Currency = 'USD' | 'CNY' | 'EUR' | 'JPY' | 'GBP';

// Supported timezones
export type Timezone = 'Asia/Shanghai' | 'America/New_York' | 'Europe/London' | 'Asia/Tokyo' | 'Europe/London';

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;
  timestamp: number;
}

export interface FinancialData {
  symbol: string;
  price: number;
  currency: Currency;
  timestamp: number;
  timezone: Timezone;
  volume?: number;
  change?: number;
  changePercent?: number;
}

export interface CurrencyConversionResult {
  originalValue: number;
  originalCurrency: Currency;
  convertedValue: number;
  targetCurrency: Currency;
  exchangeRate: number;
  timestamp: number;
}

export interface TimezoneConversionResult {
  originalTime: number;
  originalTimezone: Timezone;
  convertedTime: number;
  targetTimezone: Timezone;
  offsetMinutes: number;
}

export interface DataPipelineConfig {
  defaultCurrency: Currency;
  defaultTimezone: Timezone;
  exchangeRateRefreshIntervalMs: number;
  maxCacheAge: number;
  enableAutoConversion: boolean;
}

export class InternationalDataPipeline extends EventEmitter {
  private config: DataPipelineConfig;
  private exchangeRates: Map<string, ExchangeRate>;
  private cache: Map<string, { data: unknown; timestamp: number }>;
  private timezoneOffsets: Map<Timezone, number>;

  constructor(config?: Partial<DataPipelineConfig>) {
    super();
    
    this.config = {
      defaultCurrency: config?.defaultCurrency || 'USD',
      defaultTimezone: config?.defaultTimezone || 'Asia/Shanghai',
      exchangeRateRefreshIntervalMs: config?.exchangeRateRefreshIntervalMs || 300000, // 5 minutes
      maxCacheAge: config?.maxCacheAge || 60000, // 1 minute
      enableAutoConversion: config?.enableAutoConversion ?? true,
    };

    this.exchangeRates = new Map();
    this.cache = new Map();
    this.timezoneOffsets = new Map([
      ['Asia/Shanghai', 8 * 60],
      ['America/New_York', -5 * 60],
      ['Europe/London', 0],
      ['Asia/Tokyo', 9 * 60],
      ['Europe/London', 1 * 60], // BST
    ]);

    this.initializeDefaultRates();
    this.startExchangeRateRefresh();
    
    log.info('[InternationalDataPipeline] Initialized', { config: this.config });
  }

  private initializeDefaultRates(): void {
    const now = Date.now();
    const defaultRates: ExchangeRate[] = [
      { from: 'USD', to: 'CNY', rate: 7.25, timestamp: now },
      { from: 'USD', to: 'EUR', rate: 0.92, timestamp: now },
      { from: 'USD', to: 'JPY', rate: 150.5, timestamp: now },
      { from: 'USD', to: 'GBP', rate: 0.79, timestamp: now },
      { from: 'CNY', to: 'USD', rate: 0.138, timestamp: now },
      { from: 'EUR', to: 'USD', rate: 1.087, timestamp: now },
      { from: 'JPY', to: 'USD', rate: 0.0066, timestamp: now },
      { from: 'GBP', to: 'USD', rate: 1.266, timestamp: now },
    ];

    defaultRates.forEach(rate => {
      const key = `${rate.from}_${rate.to}`;
      this.exchangeRates.set(key, rate);
    });

    log.info('[InternationalDataPipeline] Default exchange rates initialized', { count: defaultRates.length });
  }

  private startExchangeRateRefresh(): void {
    setInterval(() => {
      this.refreshExchangeRates();
    }, this.config.exchangeRateRefreshIntervalMs);
  }

  private refreshExchangeRates(): void {
    // Simulate exchange rate refresh with small random variations
    const now = Date.now();
    this.exchangeRates.forEach((rate, key) => {
      const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
      rate.rate *= (1 + variation);
      rate.timestamp = now;
    });

    this.emit('ratesUpdated', { timestamp: now });
    log.debug('[InternationalDataPipeline] Exchange rates refreshed');
  }

  convertCurrency(value: number, fromCurrency: Currency, toCurrency: Currency): CurrencyConversionResult {
    if (fromCurrency === toCurrency) {
      return {
        originalValue: value,
        originalCurrency: fromCurrency,
        convertedValue: value,
        targetCurrency: toCurrency,
        exchangeRate: 1,
        timestamp: Date.now(),
      };
    }

    const key = `${fromCurrency}_${toCurrency}`;
    let rate = this.exchangeRates.get(key);

    if (!rate) {
      // Try reverse conversion
      const reverseKey = `${toCurrency}_${fromCurrency}`;
      const reverseRate = this.exchangeRates.get(reverseKey);
      
      if (reverseRate) {
        rate = {
          from: fromCurrency,
          to: toCurrency,
          rate: 1 / reverseRate.rate,
          timestamp: reverseRate.timestamp,
        };
      } else {
        // Convert through USD
        const toUsd = this.convertCurrency(value, fromCurrency, 'USD');
        const fromUsd = this.convertCurrency(toUsd.convertedValue, 'USD', toCurrency);
        
        return {
          originalValue: value,
          originalCurrency: fromCurrency,
          convertedValue: fromUsd.convertedValue,
          targetCurrency: toCurrency,
          exchangeRate: fromUsd.convertedValue / value,
          timestamp: Date.now(),
        };
      }
    }

    const convertedValue = value * rate.rate;

    return {
      originalValue: value,
      originalCurrency: fromCurrency,
      convertedValue,
      targetCurrency: toCurrency,
      exchangeRate: rate.rate,
      timestamp: rate.timestamp,
    };
  }

  convertTimezone(timestamp: number, fromTimezone: Timezone, toTimezone: Timezone): TimezoneConversionResult {
    const fromOffset = this.timezoneOffsets.get(fromTimezone) || 0;
    const toOffset = this.timezoneOffsets.get(toTimezone) || 0;
    const offsetMinutes = toOffset - fromOffset;
    const convertedTime = timestamp + offsetMinutes * 60 * 1000;

    return {
      originalTime: timestamp,
      originalTimezone: fromTimezone,
      convertedTime,
      targetTimezone: toTimezone,
      offsetMinutes,
    };
  }

  processFinancialData(data: FinancialData): FinancialData {
    const cacheKey = `${data.symbol}_${data.timestamp}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.maxCacheAge) {
      return cached.data;
    }

    let processedData = { ...data };

    // Auto-convert currency if enabled
    if (this.config.enableAutoConversion && data.currency !== this.config.defaultCurrency) {
      const conversion = this.convertCurrency(
        data.price,
        data.currency,
        this.config.defaultCurrency
      );
      processedData.price = conversion.convertedValue;
      processedData.currency = this.config.defaultCurrency;
    }

    // Convert timezone if enabled and needed
    if (this.config.enableAutoConversion && data.timezone !== this.config.defaultTimezone) {
      const conversion = this.convertTimezone(
        data.timestamp,
        data.timezone,
        this.config.defaultTimezone
      );
      processedData.timestamp = conversion.convertedTime;
      processedData.timezone = this.config.defaultTimezone;
    }

    // Cache the result
    this.cache.set(cacheKey, {
      data: processedData,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    this.cleanCache();

    this.emit('dataProcessed', { symbol: data.symbol, timestamp: processedData.timestamp });

    return processedData;
  }

  private cleanCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.config.maxCacheAge) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  getExchangeRate(from: Currency, to: Currency): number | null {
    const key = `${from}_${to}`;
    const rate = this.exchangeRates.get(key);
    return rate ? rate.rate : null;
  }

  getStats(): {
    cachedEntries: number;
    exchangeRatesCount: number;
    processedDataCount: number;
  } {
    // Clean expired cache entries before returning stats
    this.cleanCache();
    
    return {
      cachedEntries: this.cache.size,
      exchangeRatesCount: this.exchangeRates.size,
      processedDataCount: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
    log.info('[InternationalDataPipeline] Cache cleared');
  }

  destroy(): void {
    this.cache.clear();
    this.exchangeRates.clear();
    this.removeAllListeners();
    log.info('[InternationalDataPipeline] Destroyed');
  }
}

// Singleton instance
let pipelineInstance: InternationalDataPipeline | null = null;

export function getInternationalDataPipeline(config?: Partial<DataPipelineConfig>): InternationalDataPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new InternationalDataPipeline(config);
  }
  return pipelineInstance;
}

export function destroyInternationalDataPipeline(): void {
  if (pipelineInstance) {
    pipelineInstance.destroy();
    pipelineInstance = null;
  }
}
