/**
 * number-precision.ts — R99 J-02 Number Precision & Formatting Engine
 *
 * Features:
 * - Market-specific price precision (US 2, CN 2, HK 3, JP 0, crypto 8)
 * - Smart unit abbreviation (locale-aware: zh=万/亿, en=K/M/B, ja=万/億)
 * - formatMoney: symbol + precision + abbreviation in one call
 * - Currency-to-market mapping
 */

import type { CurrencyCode } from './currency-converter';
import { CURRENCY_PRECISION } from './currency-converter';

/** Supported locale codes */
export type LocaleCode = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'it' | 'de' | 'es' | 'ru' | 'pt';

/** Supported market codes */
export type MarketCode = 'US' | 'CN' | 'HK' | 'JP' | 'UK' | 'EU' | 'CRYPTO';

/** Price precision by market */
export const MARKET_PRECISION: Record<MarketCode, number> = {
  US: 2,
  CN: 2,
  HK: 3,
  JP: 0,
  UK: 2,
  EU: 2,
  CRYPTO: 8,
};

/** Currency symbols */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  HKD: 'HK$',
  JPY: '¥',
  EUR: '€',
  KRW: '₩',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
};

/** Currency symbol position: prefix or suffix */
export const CURRENCY_SYMBOL_POSITION: Record<string, 'prefix' | 'suffix'> = {
  USD: 'prefix',
  CNY: 'prefix',
  HKD: 'prefix',
  JPY: 'prefix',
  EUR: 'prefix',
  KRW: 'prefix',
  GBP: 'prefix',
  AUD: 'prefix',
  CAD: 'prefix',
  CHF: 'prefix',
};

/** Smart unit thresholds (SI-style for en, myriads-style for zh/ja) */
interface UnitThreshold {
  divisor: number;
  suffix: Record<string, string>;
}

const UNIT_THRESHOLDS: UnitThreshold[] = [
  { divisor: 1_000_000_000_000, suffix: { en: 'T', 'zh-CN': '万亿', 'zh-TW': '兆', ja: '兆' } },
  { divisor: 100_000_000, suffix: { en: '', 'zh-CN': '亿', 'zh-TW': '億', ja: '億' } },
  { divisor: 1_000_000_000, suffix: { en: 'B', 'zh-CN': '', 'zh-TW': '', ja: '' } },
  { divisor: 1_000_000, suffix: { en: 'M', 'zh-CN': '', 'zh-TW': '', ja: '' } },
  { divisor: 10_000, suffix: { en: '', 'zh-CN': '万', 'zh-TW': '萬', ja: '万' } },
  { divisor: 10_000, suffix: { en: 'K', 'zh-CN': '', 'zh-TW': '', ja: '' } },
];

/** Smart unit options */
export interface SmartUnitOptions {
  locale?: LocaleCode;
  maxDecimals?: number;
}

/** Smart unit result */
export interface SmartUnitResult {
  value: number;
  unit: string;
  formatted: string;
  divisor: number;
}

export class NumberPrecision {
  /**
   * Get the expected price precision for a given market.
   */
  pricePrecision(market: MarketCode): number {
    return MARKET_PRECISION[market] ?? 2;
  }

  /**
   * Round a number to a specified number of decimal places.
   */
  round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Round a price to market-appropriate precision.
   */
  roundPrice(value: number, market: MarketCode): number {
    return this.round(value, this.pricePrecision(market));
  }

  /**
   * Format a number with locale-aware separators.
   * Uses simple formatting (no Intl dependency for test determinism).
   */
  formatNumber(value: number, locale?: LocaleCode, decimals?: number): string {
    const dec = decimals ?? 2;
    const rounded = this.round(value, dec);
    const localeStr = locale || 'en';

    // Determine separator style
    let thousandsSep = ',';
    let decimalSep = '.';
    if (localeStr.startsWith('zh')) {
      thousandsSep = ',';
    } else if (localeStr === 'ja') {
      thousandsSep = ',';
    } else if (localeStr === 'ko') {
      thousandsSep = ',';
    }

    const parts = rounded.toFixed(dec).split('.');
    const intPart = parts[0];
    const fracPart = parts[1] || '';

    // Add thousands separators
    let withCommas = '';
    for (let i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 === 0) {
        withCommas += thousandsSep;
      }
      withCommas += intPart[i];
    }

    if (dec === 0 || !fracPart) {
      return withCommas;
    }
    return withCommas + decimalSep + fracPart.padEnd(dec, '0');
  }

  /**
   * Format a number as percentage.
   */
  formatPercent(value: number, decimals?: number, locale?: LocaleCode): string {
    const dec = decimals ?? 2;
    const pct = this.round(value * 100, dec);
    const formatted = pct.toFixed(dec);
    return formatted + '%';
  }

  /**
   * Smart unit abbreviation — choose the best unit for readability.
   *
   * Locale-aware:
   * - zh: 1234 → 1234, 12345 → 1.23万, 123456789 → 1.23亿
   * - en: 12345 → 12.35K, 1234567 → 1.23M
   * - ja: similar to zh (万/億)
   */
  smartUnit(value: number, options?: SmartUnitOptions): SmartUnitResult {
    const locale = options?.locale || 'en';
    const maxDecimals = options?.maxDecimals ?? 2;

    const absValue = Math.abs(value);
    const sign = value < 0 ? -1 : 1;

    // Try each threshold in descending order
    for (const threshold of UNIT_THRESHOLDS) {
      const suffix = threshold.suffix[locale];
      if (!suffix) continue; // Skip thresholds irrelevant for this locale
      if (absValue >= threshold.divisor) {
        const scaled = this.round(absValue / threshold.divisor, maxDecimals);
        let formatted: string;
        if (scaled === Math.floor(scaled)) {
          formatted = scaled.toFixed(0) + suffix;
        } else {
          formatted = scaled.toFixed(maxDecimals) + suffix;
        }
        if (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja') {
          // For CJK locales, no space between number and unit
          formatted = formatted;
        } else {
          // For en, use space (e.g., "1.5 K")
          formatted = scaled.toFixed(maxDecimals) + ' ' + suffix;
        }
        return {
          value: sign * scaled,
          unit: suffix,
          formatted: sign === -1 ? '-' + formatted : formatted,
          divisor: threshold.divisor,
        };
      }
    }

    // No unit needed — just format
    const formatted = this.round(absValue, maxDecimals).toFixed(maxDecimals);
    return {
      value: sign * absValue,
      unit: '',
      formatted: sign === -1 ? '-' + formatted : formatted,
      divisor: 1,
    };
  }

  /**
   * Format a monetary amount with currency symbol, precision, and smart unit.
   */
  formatMoney(
    amount: number,
    currency: CurrencyCode,
    locale?: LocaleCode,
    options?: { useSmartUnit?: boolean; decimals?: number }
  ): string {
    const loc = locale || 'en';
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const position = CURRENCY_SYMBOL_POSITION[currency] || 'prefix';
    const decimals = options?.decimals ?? CURRENCY_PRECISION[currency] ?? 2;

    let formattedValue: string;

    if (options?.useSmartUnit) {
      const su = this.smartUnit(amount, { locale: loc, maxDecimals: decimals });
      // Extract just the number part, re-apply locale formatting
      const numPart = su.formatted.replace(/^\-/, '').replace(su.unit, '').trim();
      formattedValue = su.formatted;
    } else {
      formattedValue = this.formatNumber(amount, loc, decimals);
    }

    if (position === 'prefix') {
      if (amount < 0) {
        return '-' + symbol + formattedValue.substring(1);
      }
      return symbol + formattedValue;
    } else {
      return formattedValue + ' ' + symbol;
    }
  }

  /**
   * Format compact number (Intl.NumberFormat compactDisplay equivalent).
   */
  formatCompact(value: number, locale?: LocaleCode, notation?: 'compact' | 'standard'): string {
    const loc = locale || 'en';
    if (notation === 'standard') {
      return this.formatNumber(value, loc);
    }

    const su = this.smartUnit(value, { locale: loc, maxDecimals: 1 });
    if (su.unit) {
      return su.formatted;
    }

    return this.formatNumber(value, loc, 0);
  }

  /**
   * Get currency symbol for a currency code.
   */
  getCurrencySymbol(currency: CurrencyCode): string {
    return CURRENCY_SYMBOLS[currency] || currency;
  }

  /**
   * Get symbol position for a currency code.
   */
  getCurrencySymbolPosition(currency: CurrencyCode): 'prefix' | 'suffix' {
    return CURRENCY_SYMBOL_POSITION[currency] || 'prefix';
  }

  /**
   * Format volume with smart unit.
   * Volume-specific: always use smart unit abbreviation.
   */
  formatVolume(value: number, locale?: LocaleCode): string {
    const loc = locale || 'en';
    const su = this.smartUnit(value, { locale: loc, maxDecimals: 2 });
    return su.formatted;
  }
}

/** Singleton instance */
let _precisionInstance: NumberPrecision | null = null;

export function getNumberPrecision(): NumberPrecision {
  if (!_precisionInstance) {
    _precisionInstance = new NumberPrecision();
  }
  return _precisionInstance;
}

export const numberPrecision = getNumberPrecision();
