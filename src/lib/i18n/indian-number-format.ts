// ── R228 auto-2.3e: Indian Number Format ────────────────────────────────
// Indian numbering system: 12,34,567 (not 1,234,567)
// Groups: first 3 digits, then groups of 2
//   ₹1,23,45,678 → 1 crore 23 lakh 45 thousand 678

import { formatNumber, type FormatNumberOptions, type AppLocale } from './intl-unified-formatter';

// ═══════════ Indian Number Formatting ════════════════════════════════════

/**
 * Format number with Indian grouping (lakh/crore system).
 * In Indian system: 1,23,45,678 = 1 crore 23 lakh 45 thousand 678
 */
export function formatIndianNumber(
  value: number,
  options: {
    decimals?: number;
    compact?: boolean;
    showSign?: boolean;
    useWords?: boolean;  // e.g., "1.23 Cr" instead of "1,23,00,000"
  } = {}
): string {
  const sign = options.showSign && value > 0 ? '+' : '';
  const absVal = Math.abs(value);
  const dec = options.decimals ?? 2;

  // Word notation (1.23 Cr, 45.67 L, etc.)
  if (options.useWords && absVal >= 1000) {
    return formatIndianCompact(absVal, dec, value < 0, sign);
  }

  // Numeric grouping
  const formatted = groupIndian(absVal, dec);
  return `${sign}${value < 0 ? '-' : ''}${formatted}`;
}

/** Indian compact notation */
function formatIndianCompact(value: number, decimals: number, negative: boolean, sign: string): string {
  const prefix = sign + (negative ? '-' : '');
  if (value >= 1e7) return `${prefix}${(value / 1e7).toFixed(decimals)} Cr`;
  if (value >= 1e5) return `${prefix}${(value / 1e5).toFixed(decimals)} L`;
  if (value >= 1000) return `${prefix}${(value / 1000).toFixed(decimals)} K`;
  return `${prefix}${value.toFixed(0)}`;
}

/** Group digits Indian-style */
function groupIndian(value: number, decimals: number): string {
  const [intPart, fracPart] = value.toFixed(decimals).split('.');
  const n = intPart.length;

  if (n <= 3) return fracPart ? `${intPart}.${fracPart}` : intPart;

  // Last 3 digits, then groups of 2
  const last3 = intPart.substring(n - 3);
  const rest = intPart.substring(0, n - 3);

  // Group the rest into pairs of 2 from right to left
  const groups: string[] = [];
  for (let i = rest.length; i > 0; i -= 2) {
    groups.unshift(rest.substring(Math.max(0, i - 2), i));
  }

  const result = groups.join(',') + ',' + last3;
  return fracPart ? `${result}.${fracPart}` : result;
}

// ═══════════ Indian Currency Formatting ══════════════════════════════════

/**
 * Format INR amount with Indian grouping.
 * ₹1,23,45,678.00
 */
export function formatIndianCurrency(
  value: number,
  options: {
    compact?: boolean;
    decimals?: number;
  } = {}
): string {
  const dec = options.decimals ?? 2;
  const formatted = options.compact && Math.abs(value) >= 1000
    ? formatIndianNumber(value, { compact: true, decimals: dec })
    : formatIndianNumber(value, { decimals: dec });
  return `₹${formatted}`;
}

// ═══════════ Indian Market Locale Extension ══════════════════════════════

/** Register 'in' as a locale extension for Indian formatting */
export const INDIAN_LOCALE = {
  code: 'en-IN' as const,
  displayName: 'English (India)',
  currency: 'INR',
  currencySymbol: '₹',
  symbolPosition: 'prefix' as const,
  decimalConfig: 'standard' as const,
  numeralSystem: 'latn',
  grouping: 'indian', // Custom property
};

/**
 * Format a number using the appropriate grouping for the market.
 * Auto-detects Indian market from locale.
 */
export function formatMarketNumber(
  value: number,
  locale: AppLocale | 'en-IN',
  options: FormatNumberOptions = {}
): string {
  if (locale === 'en-IN' || options.currency === 'INR') {
    return formatIndianNumber(value, {
      decimals: options.decimals,
      compact: options.compact,
      showSign: options.showSign,
    });
  }
  return formatNumber(value, options);
}

// ═══════════ Indian Market Price Display ═════════════════════════════════

export interface IndianMarketPrice {
  tickSize: number;       // Minimum price increment
  lotSize: number;        // Standard lot size
  priceFormat: (price: number) => string;
  quantityFormat: (qty: number) => string;
}

/** NSE/BSE market configuration */
export const INDIAN_MARKET_CONFIG: IndianMarketPrice = {
  tickSize: 0.05,         // ₹0.05 for most stocks
  lotSize: 1,             // Equity delivery (F&O varies)
  priceFormat: (price: number) => formatIndianCurrency(price, { decimals: 2 }),
  quantityFormat: (qty: number) => formatIndianNumber(qty, { decimals: 0 }),
};
