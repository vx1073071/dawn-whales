/**
 * PriceDisplay — Locale-aware price rendering component (R99 M-02)
 *
 * Features:
 * - Currency symbol position (prefix/suffix)
 * - Precision by currency (USD 2dp, JPY 0dp)
 * - Optional compact mode for large values (K/M/B)
 * - Color-coded for positive/negative values
 * - Uses useCurrency hook for global currency setting
 */

import { getCurrencyConfig } from '@/hooks/useCurrency';
import { formatNumber, formatVolume } from '@/utils/formatNumber';

export interface PriceDisplayProps {
  /** The numeric value to display */
  value: number;
  /** Currency code (override global setting) */
  currencyCode?: string;
  /** Force specific decimal places */
  decimals?: number;
  /** Use compact notation for large values */
  compact?: boolean;
  /** Locale for number formatting */
  locale?: string;
  /** Show sign for positive values */
  showSign?: boolean;
  /** Color: 'auto' = green/red by sign, 'neutral' = no color, or custom color */
  color?: 'auto' | 'neutral' | string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class */
  className?: string;
}

export default function PriceDisplay({
  value,
  currencyCode,
  decimals,
  compact = false,
  locale = 'en',
  showSign = false,
  color = 'neutral',
  size = 'md',
  className = '',
}: PriceDisplayProps) {
  const config = getCurrencyConfig(currencyCode || 'USD');
  const dp = decimals ?? config.decimals;
  const sign = showSign && value > 0 ? '+' : '';

  let formattedValue: string;
  if (compact && Math.abs(value) >= 1000) {
    formattedValue = formatVolume(Math.abs(value), { locale, decimals: 1 });
  } else {
    formattedValue = formatNumber(Math.abs(value), { locale, decimals: dp });
  }

  const priceText = `${sign}${value < 0 ? '-' : ''}${formattedValue}`;
  const symbol = config.symbol;
  const displayText =
    config.position === 'prefix'
      ? `${symbol}${priceText}`
      : `${priceText} ${symbol}`;

  // Color logic
  let textColor = 'var(--dw-text, #E5E7EB)';
  if (color === 'auto') {
    textColor = value > 0 ? '#22C55E' : value < 0 ? '#EF4444' : 'var(--dw-text, #E5E7EB)';
  } else if (color !== 'neutral') {
    textColor = color;
  }

  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';

  return (
    <span className={`${fontSize} font-mono ${className}`} style={{ color: textColor }}>
      {displayText}
    </span>
  );
}

// ── Helper for non-React usage ────────────────────────────────────────────

/**
 * Format a price as string (non-React helper).
 */
export function formatPrice(
  value: number,
  options?: {
    currency?: string;
    locale?: string;
    decimals?: number;
    compact?: boolean;
    showSign?: boolean;
  }
): string {
  const config = getCurrencyConfig(options?.currency || 'USD');
  const dp = options?.decimals ?? config.decimals;
  const locale = options?.locale || 'en';
  const sign = options?.showSign && value > 0 ? '+' : '';

  let formatted: string;
  if (options?.compact && Math.abs(value) >= 1000) {
    formatted = formatVolume(Math.abs(value), { locale, decimals: 1 });
  } else {
    formatted = formatNumber(Math.abs(value), { locale, decimals: dp });
  }

  const priceText = `${sign}${value < 0 ? '-' : ''}${formatted}`;
  return config.position === 'prefix'
    ? `${config.symbol}${priceText}`
    : `${priceText} ${config.symbol}`;
}

/**
 * Format market cap with smart abbreviation.
 * e.g., 1234567890 → "$1.2B" (en) or "¥12.3亿" (zh-CN)
 */
export function formatMarketCap(
  value: number,
  options?: { currency?: string; locale?: string }
): string {
  return formatPrice(value, {
    ...options,
    compact: true,
    decimals: 1,
  });
}
