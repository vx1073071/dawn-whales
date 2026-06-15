// ── R227 auto-2.3a: Unified Intl Formatting Layer ───────────────────────
// Single entry point for ALL numeric/date/currency formatting across the app.
// Eliminates scattered .toLocaleString() calls and ensures consistency.
//
// auto-2.3d: JPY/KRW zero decimals built-in
// Works with market-color-adapter for auto-2.3b

import { formatLocaleCompact } from './price-locale';

// ═══════════ Locale Registry ═════════════════════════════════════════════

/** Supported application locales */
export type AppLocale = 'zh-CN' | 'zh-TW' | 'zh-HK' | 'en' | 'ja' | 'ko' | 'fr' | 'it' | 'de' | 'es' | 'ru';

/** All locale metadata */
export const LOCALE_REGISTRY: Record<AppLocale, {
  displayName: string;
  currency: string;
  currencySymbol: string;
  symbolPosition: 'prefix' | 'suffix';
  decimalConfig: 'standard' | 'zero-decimal';
  numeralSystem: string;
}> = {
  'zh-CN': { displayName: '简体中文', currency: 'CNY', currencySymbol: '¥', symbolPosition: 'prefix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'zh-TW': { displayName: '繁體中文', currency: 'TWD', currencySymbol: 'NT$', symbolPosition: 'prefix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'zh-HK': { displayName: '香港繁中', currency: 'HKD', currencySymbol: 'HK$', symbolPosition: 'prefix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'en':    { displayName: 'English', currency: 'USD', currencySymbol: '$', symbolPosition: 'prefix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'ja':    { displayName: '日本語', currency: 'JPY', currencySymbol: '¥', symbolPosition: 'prefix', decimalConfig: 'zero-decimal', numeralSystem: 'latn' },
  'ko':    { displayName: '한국어', currency: 'KRW', currencySymbol: '₩', symbolPosition: 'prefix', decimalConfig: 'zero-decimal', numeralSystem: 'latn' },
  'fr':    { displayName: 'Français', currency: 'EUR', currencySymbol: '€', symbolPosition: 'suffix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'it':    { displayName: 'Italiano', currency: 'EUR', currencySymbol: '€', symbolPosition: 'suffix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'de':    { displayName: 'Deutsch', currency: 'EUR', currencySymbol: '€', symbolPosition: 'suffix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'es':    { displayName: 'Español', currency: 'EUR', currencySymbol: '€', symbolPosition: 'suffix', decimalConfig: 'standard', numeralSystem: 'latn' },
  'ru':    { displayName: 'Русский', currency: 'RUB', currencySymbol: '₽', symbolPosition: 'suffix', decimalConfig: 'standard', numeralSystem: 'latn' },
};

// ═══════════ Currency Decimals (auto-2.3d) ══════════════════════════════

/** Currencies that display with 0 decimal places */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'IDR', 'TWD',
]);

/** Get appropriate decimals for a currency code */
export function getCurrencyDecimals(currencyCode: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) return 0;
  // Crypto: up to 8 decimals
  if (['BTC', 'ETH', 'SOL', 'USDT', 'USDC'].includes(currencyCode.toUpperCase())) return 8;
  return 2; // Standard fiat
}

/** Get decimals for a locale */
export function getLocaleDecimals(locale: AppLocale): number {
  const cfg = LOCALE_REGISTRY[locale];
  if (!cfg) return 2;
  return cfg.decimalConfig === 'zero-decimal' ? 0 : 2;
}

// ═══════════ Number Formatting ══════════════════════════════════════════

export interface FormatNumberOptions {
  locale?: AppLocale;
  decimals?: number;
  compact?: boolean;
  showSign?: boolean;
  currency?: string;
}

/**
 * Unified number formatter — the ONE function for all numeric display.
 * Respects locale conventions, JPY/KRW zero-decimals, and compact notation.
 */
export function formatNumber(
  value: number,
  options: FormatNumberOptions = {}
): string {
  const locale: AppLocale = options.locale || 'en';
  const cfg = LOCALE_REGISTRY[locale];
  const currency = options.currency || cfg?.currency || 'USD';
  const decimals = options.decimals ?? getCurrencyDecimals(currency);
  const sign = options.showSign && value > 0 ? '+' : '';
  const absVal = Math.abs(value);

  if (options.compact && absVal >= 1000) {
    return sign + (value < 0 ? '-' : '') + formatLocaleCompact(absVal, locale, 1);
  }

  // Set maximum fraction digits based on whether value has fractional part
  const hasFraction = decimals > 0 && !Number.isInteger(absVal);
  const maxDigits = hasFraction ? decimals : 0;

  return sign + (value < 0 ? '-' : '') + absVal.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

// ═══════════ Currency Formatting ════════════════════════════════════════

export interface FormatCurrencyOptions {
  locale?: AppLocale;
  currency?: string;
  compact?: boolean;
  showSign?: boolean;
  decimals?: number;
}

/**
 * Unified currency formatter.
 * auto-2.3d: JPY/KRW automatically get 0 decimal places.
 */
export function formatCurrency(
  value: number,
  options: FormatCurrencyOptions = {}
): string {
  const locale: AppLocale = options.locale || 'en';
  const cfg = LOCALE_REGISTRY[locale];
  const currency = options.currency || cfg?.currency || 'USD';
  const decimals = options.decimals ?? getCurrencyDecimals(currency);

  // Use Intl.NumberFormat with currency for best locale-aware formatting
  // But fall back to manual formatting for edge cases
  const absVal = Math.abs(value);

  let formatted: string;
  if (options.compact && absVal >= 1000) {
    formatted = formatLocaleCompact(absVal, locale, 1);
    return `${cfg.currencySymbol}${value < 0 ? '-' : ''}${formatted}`;
  }

  // Format number with full control over decimal places
  const numberStr = absVal.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // Use Intl for proper symbol placement but with our controlled number
  const symbol = cfg.currencySymbol;
  const prefix = options.showSign && value > 0 ? '+' : '';
  const sign = value < 0 ? '-' : '';

  if (cfg.symbolPosition === 'suffix') {
    return `${prefix}${sign}${numberStr} ${symbol}`;
  }
  return `${prefix}${sign}${symbol}${numberStr}`;
}

// ═══════════ Percentage Formatting ══════════════════════════════════════

export interface FormatPercentOptions {
  locale?: AppLocale;
  decimals?: number;
  showSign?: boolean;
}

export function formatPercent(
  value: number,
  options: FormatPercentOptions = {}
): string {
  const locale: AppLocale = options.locale || 'en';
  const decimals = options.decimals ?? 2;
  const signVal = options.showSign !== false && value > 0 ? '+' : '';
  return `${signVal}${value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

// ═══════════ Date/Time Formatting ═══════════════════════════════════════

export type DateFormat = 'short' | 'medium' | 'long' | 'time' | 'datetime' | 'date-only' | 'relative';

export interface FormatDateOptions {
  locale?: AppLocale;
  format?: DateFormat;
}

/**
 * Unified date formatter.
 * Adds 'relative' format for human-friendly relative time.
 */
export function formatDate(
  timestamp: number | Date | string,
  options: FormatDateOptions = {}
): string {
  const locale: AppLocale = options.locale || 'en';
  const fmt = options.format || 'short';
  const d = timestamp instanceof Date ? timestamp :
           typeof timestamp === 'string' ? new Date(timestamp) :
           new Date(timestamp);

  if (isNaN(d.getTime())) return '—';

  if (fmt === 'relative') {
    return formatRelativeDate(d, locale);
  }

  switch (fmt) {
    case 'time':
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    case 'datetime':
      return d.toLocaleString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    case 'long':
      return d.toLocaleDateString(locale, {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    case 'medium':
      return d.toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    case 'date-only':
      return d.toLocaleDateString(locale, {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    case 'short':
    default:
      return d.toLocaleDateString(locale);
  }
}

// ═══════════ Relative Time ══════════════════════════════════════════════

const RELATIVE_LABELS: Record<AppLocale, { justNow: string; minAgo: string; minAgoP: string; hrAgo: string; hrAgoP: string; dayAgo: string; dayAgoP: string }> = {
  'zh-CN': { justNow: '刚刚', minAgo: '分钟前', minAgoP: '分钟前', hrAgo: '小时前', hrAgoP: '小时前', dayAgo: '天前', dayAgoP: '天前' },
  'zh-TW': { justNow: '剛剛', minAgo: '分鐘前', minAgoP: '分鐘前', hrAgo: '小時前', hrAgoP: '小時前', dayAgo: '天前', dayAgoP: '天前' },
  'zh-HK': { justNow: '啱啱', minAgo: '分鐘前', minAgoP: '分鐘前', hrAgo: '小時前', hrAgoP: '小時前', dayAgo: '日前', dayAgoP: '日前' },
  'en':    { justNow: 'just now', minAgo: 'min ago', minAgoP: 'mins ago', hrAgo: 'hr ago', hrAgoP: 'hrs ago', dayAgo: 'day ago', dayAgoP: 'days ago' },
  'ja':    { justNow: 'たった今', minAgo: '分前', minAgoP: '分前', hrAgo: '時間前', hrAgoP: '時間前', dayAgo: '日前', dayAgoP: '日前' },
  'ko':    { justNow: '방금', minAgo: '분 전', minAgoP: '분 전', hrAgo: '시간 전', hrAgoP: '시간 전', dayAgo: '일 전', dayAgoP: '일 전' },
  'fr':    { justNow: 'à l\'instant', minAgo: 'min', minAgoP: 'mins', hrAgo: 'heure', hrAgoP: 'heures', dayAgo: 'jour', dayAgoP: 'jours' },
  'it':    { justNow: 'adesso', minAgo: 'min fa', minAgoP: 'min fa', hrAgo: 'ora fa', hrAgoP: 'ore fa', dayAgo: 'giorno fa', dayAgoP: 'giorni fa' },
  'de':    { justNow: 'gerade', minAgo: 'Min.', minAgoP: 'Min.', hrAgo: 'Std.', hrAgoP: 'Std.', dayAgo: 'Tag', dayAgoP: 'Tage' },
  'es':    { justNow: 'ahora', minAgo: 'min', minAgoP: 'mins', hrAgo: 'hora', hrAgoP: 'horas', dayAgo: 'día', dayAgoP: 'días' },
  'ru':    { justNow: 'сейчас', minAgo: 'мин.', minAgoP: 'мин.', hrAgo: 'ч.', hrAgoP: 'ч.', dayAgo: 'день', dayAgoP: 'дней' },
};

function formatRelativeDate(d: Date, locale: AppLocale): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const labels = RELATIVE_LABELS[locale] || RELATIVE_LABELS['en'];

  if (diffSec < 60) return labels.justNow;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1 ? `1${labels.minAgo}` : `${diffMin}${labels.minAgoP}`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return diffHr === 1 ? `1${labels.hrAgo}` : `${diffHr}${labels.hrAgoP}`;
  }

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay <= 7) {
    return diffDay === 1 ? `1${labels.dayAgo}` : `${diffDay}${labels.dayAgoP}`;
  }

  // Beyond 7 days, use normal date
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// ═══════════ Convenience: Format with locale from user settings ═══════════

let _currentLocale: AppLocale = 'zh-CN';

export function setAppLocale(locale: AppLocale): void {
  _currentLocale = locale;
}

export function getAppLocale(): AppLocale {
  return _currentLocale;
}

/** Quick format using the globally-set locale */
export const fmt = {
  number: (value: number, opts?: Omit<FormatNumberOptions, 'locale'>) =>
    formatNumber(value, { ...opts, locale: _currentLocale }),
  currency: (value: number, opts?: Omit<FormatCurrencyOptions, 'locale'>) =>
    formatCurrency(value, { ...opts, locale: _currentLocale }),
  percent: (value: number, opts?: Omit<FormatPercentOptions, 'locale'>) =>
    formatPercent(value, { ...opts, locale: _currentLocale }),
  date: (ts: number | Date | string, opts?: Omit<FormatDateOptions, 'locale'>) =>
    formatDate(ts, { ...opts, locale: _currentLocale }),
};
