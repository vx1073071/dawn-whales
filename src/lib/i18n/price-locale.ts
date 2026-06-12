// @ts-nocheck
/**
 * DAWN WHALES R125 J02 — Price Localization Utilities
 * 
 * Locale-aware number/price formatting for i18n support.
 * Chinese locales: 万/亿 notation
 * Western locales: K/M/B notation
 */

// ═══════════ Locale-aware suffix map ═══════════════════════════

const SUFFIX_MAP: Record<string, Record<string, { divisor: number; suffix: string }[]>> = {
  // Chinese-style: 万 (10k), 亿 (100M)
  'zh-CN': [
    { divisor: 1e8, suffix: '亿' },
    { divisor: 1e4, suffix: '万' },
  ],
  'zh-HK': [
    { divisor: 1e8, suffix: '億' },
    { divisor: 1e4, suffix: '萬' },
  ],
  'zh-TW': [
    { divisor: 1e8, suffix: '億' },
    { divisor: 1e4, suffix: '萬' },
  ],
  'ja': [
    { divisor: 1e8, suffix: '億' },
    { divisor: 1e4, suffix: '万' },
  ],
  'ko': [
    { divisor: 1e8, suffix: '억' },
    { divisor: 1e4, suffix: '만' },
  ],
};

// Western: K/M/B/T
const WESTERN_SUFFIXES = [
  { divisor: 1e12, suffix: 'T' },
  { divisor: 1e9, suffix: 'B' },
  { divisor: 1e6, suffix: 'M' },
  { divisor: 1e3, suffix: 'K' },
];

// ═══════════ Locale Price Config ═══════════════════════════

export interface PriceLocaleConfig {
  currency: string;
  currencySymbol: string;
  position: 'prefix' | 'suffix';
  decimals: number;
  locale: string;
}

const PRICE_LOCALE_MAP: Record<string, Partial<PriceLocaleConfig>> = {
  'en':    { currency: 'USD', currencySymbol: '$', position: 'prefix' },
  'zh-CN': { currency: 'CNY', currencySymbol: '¥', position: 'prefix' },
  'zh-HK': { currency: 'HKD', currencySymbol: 'HK$', position: 'prefix' },
  'zh-TW': { currency: 'TWD', currencySymbol: 'NT$', position: 'prefix' },
  'ja':    { currency: 'JPY', currencySymbol: '¥', position: 'prefix' },
  'ko':    { currency: 'KRW', currencySymbol: '₩', position: 'prefix' },
  'de':    { currency: 'EUR', currencySymbol: '€', position: 'prefix' },
  'fr':    { currency: 'EUR', currencySymbol: '€', position: 'suffix' },
  'es':    { currency: 'MXN', currencySymbol: 'MX$', position: 'prefix' },
  'pt':    { currency: 'BRL', currencySymbol: 'R$', position: 'prefix' },
};

// ═══════════ Format Compact Number ═══════════════════════════

export function formatLocaleCompact(
  value: number,
  locale: string,
  decimals: number = 1
): string {
  if (Math.abs(value) < 1000) {
    return value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  // Try locale-specific suffixes first
  const localeBase = locale.split('-')[0] || locale;
  const suffixes = SUFFIX_MAP[locale] || null;

  if (suffixes) {
    for (const { divisor, suffix } of suffixes) {
      if (Math.abs(value) >= divisor) {
        return (value / divisor).toFixed(decimals) + suffix;
      }
    }
    // Fallback to western for small values
  }

  for (const { divisor, suffix } of WESTERN_SUFFIXES) {
    if (Math.abs(value) >= divisor) {
      return (value / divisor).toFixed(decimals) + suffix;
    }
  }

  return value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

// ═══════════ Format Price ═══════════════════════════════════

export function formatLocalePrice(
  value: number,
  locale: string = 'en',
  options?: {
    compact?: boolean;
    decimals?: number;
    showSign?: boolean;
    colorize?: boolean;
  }
): { text: string; color?: string } {
  const config: Partial<PriceLocaleConfig> = PRICE_LOCALE_MAP[locale] || PRICE_LOCALE_MAP['en']!;
  const symbol = config.currencySymbol || '$';
  const decimals = options?.decimals ?? config.decimals ?? 2;
  const sign = options?.showSign && value > 0 ? '+' : '';
  const absVal = Math.abs(value);

  let formatted: string;
  if (options?.compact && absVal >= 1000) {
    formatted = formatLocaleCompact(absVal, locale, 1);
  } else {
    formatted = absVal.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const priceText = `${sign}${value < 0 ? '-' : ''}${formatted}`;
  const fullText = config.position === 'prefix'
    ? `${symbol}${priceText}`
    : `${priceText} ${symbol}`;

  let color: string | undefined;
  if (options?.colorize) {
    color = value > 0 ? 'var(--dw-chart-up)' : value < 0 ? 'var(--dw-chart-down)' : 'var(--dw-text-primary)';
  }

  return { text: fullText, color };
}

// ═══════════ Format Date/Time Locale ═══════════════════════

export function formatLocaleDate(
  timestamp: number | Date,
  locale: string,
  format: 'short' | 'medium' | 'long' | 'time' | 'datetime' = 'short'
): string {
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);

  switch (format) {
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
    case 'short':
    default:
      return d.toLocaleDateString(locale);
  }
}

// ═══════════ Format Percentage ═══════════════════════════

export function formatLocalePercent(
  value: number,
  locale: string,
  decimals: number = 2
): { text: string; color?: string } {
  const sign = value > 0 ? '+' : '';
  const text = `${sign}${value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
  const color = value > 0 ? 'var(--dw-chart-up)' : value < 0 ? 'var(--dw-chart-down)' : 'var(--dw-text-primary)';
  return { text, color };
}

// ═══════════ Format Volume ═══════════════════════════════

export function formatLocaleVolume(
  value: number,
  locale: string = 'en'
): string {
  return formatLocaleCompact(value, locale, 1);
}

// ═══════════ Format Currency Amount ═══════════════════════════

export function formatLocaleAmount(
  value: number,
  currencyCode: string,
  locale: string = 'en',
  compact: boolean = false
): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      notation: compact && Math.abs(value) >= 1000 ? 'compact' : 'standard',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(value);
  } catch {
    // Fallback for unsupported currency codes (crypto)
    return formatLocalePrice(value, locale, { compact }).text;
  }
}
