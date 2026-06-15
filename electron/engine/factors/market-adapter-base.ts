// R194 J1: 7-Market Data Adapter Base Class
// Inherits FactorDataProvider. Adds market-specific data sources.
import { FactorDataProvider, type FactorDataProviderConfig, type FactorSourceName, type FactorPeriod, type FactorValue, type FactorValues, type BatchFactorResult } from './factor-data-provider';
import log from 'electron-log';

// Extended source types for 7-market data adapters
export type MarketSourceName = FactorSourceName | 'market_data' | 'local_financials' | 'regulatory' | 'holiday_calendar';

export type MarketCode = 'JP' | 'TW' | 'KR' | 'SG' | 'AU' | 'IN' | 'EU';

export interface MarketMetadata {
  code: MarketCode;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  tradingHours: string;
  primaryExchange: string;
}

export const MARKET_METADATA: Record<MarketCode, MarketMetadata> = {
  JP: { code: 'JP', name: 'Japan', timezone: 'Asia/Tokyo (JST UTC+9)', currency: 'JPY', locale: 'ja-JP', tradingHours: '09:00-15:00 (lunch 11:30-12:30)', primaryExchange: 'JPX/TSE' },
  TW: { code: 'TW', name: 'Taiwan', timezone: 'Asia/Taipei (CST UTC+8)', currency: 'TWD', locale: 'zh-TW', tradingHours: '09:00-13:30', primaryExchange: 'TWSE' },
  KR: { code: 'KR', name: 'Korea', timezone: 'Asia/Seoul (KST UTC+9)', currency: 'KRW', locale: 'ko-KR', tradingHours: '09:00-15:30', primaryExchange: 'KRX' },
  SG: { code: 'SG', name: 'Singapore', timezone: 'Asia/Singapore (SGT UTC+8)', currency: 'SGD', locale: 'en-SG', tradingHours: '09:00-17:00', primaryExchange: 'SGX' },
  AU: { code: 'AU', name: 'Australia', timezone: 'Australia/Sydney (AEST UTC+10)', currency: 'AUD', locale: 'en-AU', tradingHours: '10:00-16:00', primaryExchange: 'ASX' },
  IN: { code: 'IN', name: 'India', timezone: 'Asia/Kolkata (IST UTC+5:30)', currency: 'INR', locale: 'hi-IN', tradingHours: '09:15-15:30', primaryExchange: 'NSE/BSE' },
  EU: { code: 'EU', name: 'Europe', timezone: 'Europe/London (BST UTC+1)', currency: 'EUR', locale: 'en-GB', tradingHours: '08:00-16:30', primaryExchange: 'LSE/Euronext' },
};

export interface MarketAdapterConfig extends Partial<FactorDataProviderConfig> {
  marketCode: MarketCode;
  apiBaseUrl?: string;
  apiKey?: string;
}

export abstract class MarketAdapterBase extends FactorDataProvider {
  protected marketCode: MarketCode;
  protected metadata: MarketMetadata;
  protected apiBaseUrl: string;
  protected apiKey: string;

  constructor(config: MarketAdapterConfig) {
    super(config);
    this.marketCode = config.marketCode;
    this.metadata = MARKET_METADATA[config.marketCode];
    this.apiBaseUrl = config.apiBaseUrl ?? '';
    this.apiKey = config.apiKey ?? '';
    log.info(`[MarketAdapterBase] ${this.marketCode} adapter initialized (${this.metadata.name})`);
  }

  getMarketCode(): MarketCode { return this.marketCode; }
  getMetadata(): MarketMetadata { return this.metadata; }
  getCurrency(): string { return this.metadata.currency; }
  getTimezone(): string { return this.metadata.timezone; }

  abstract fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>>;
  abstract fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>>;
  abstract getSupportedFactorIds(): string[];
  abstract isHoliday(date: Date): boolean;

  getMarketHolidays(year: number): Date[] {
    const holidays: Date[] = [];
    const cursor = new Date(year, 0, 1);
    while (cursor.getFullYear() === year) {
      if (this.isHoliday(cursor)) holidays.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return holidays;
  }

  formatCurrencySymbol(symbol: string): string {
    return `${this.marketCode}.${symbol}`;
  }

  parseCurrencySymbol(formatted: string): string {
    const parts = formatted.split('.');
    return parts.length > 1 ? parts.slice(1).join('.') : formatted;
  }
}