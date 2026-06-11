/**
 * formatNumber.ts — Number, percent, volume, compact formatting (R99 M-01)
 *
 * All formatting based on Intl.NumberFormat for full i18n support.
 *
 * API:
 *   formatNumber(n, options?)         → "1,234.56" / "1.234,56" (locale-aware)
 *   formatPercent(p, options?)        → "12.3%" / "12,3 %"
 *   formatVolume(v, options?)         → "1.2K" / "12.3M" / "1234.6万" (locale-aware)
 *   formatCompact(n, options?)        → Intl compactDisplay
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface NumberFormatOptions {
  locale?: string;
  decimals?: number;
  /** Force specific notation */
  notation?: 'standard' | 'compact' | 'scientific' | 'engineering';
}

// ── formatNumber ──────────────────────────────────────────────────────────

/**
 * Format a number with locale-aware thousands separator and decimal point.
 * e.g., en: "1,234.56", de: "1.234,56", ja: "1,234.56"
 */
export function formatNumber(n: number, options?: NumberFormatOptions): string {
  if (!Number.isFinite(n)) return String(n); // NaN, Infinity
  const locale = options?.locale || 'en';
  const decimals = options?.decimals;

  const fmtOpts: Intl.NumberFormatOptions = {};
  if (decimals !== undefined) {
    fmtOpts.minimumFractionDigits = decimals;
    fmtOpts.maximumFractionDigits = decimals;
  }

  return new Intl.NumberFormat(locale, fmtOpts).format(n);
}

// ── formatPercent ─────────────────────────────────────────────────────────

/**
 * Format a percentage value (input as ratio: 0.123 → "12.3%").
 * If the value is already in percent form (e.g., 12.3), pass decimals=1 and multiply by 0.01.
 */
export function formatPercent(p: number, options?: NumberFormatOptions & { raw?: boolean }): string {
  if (!Number.isFinite(p)) return String(p);
  const locale = options?.locale || 'en';
  const decimals = options?.decimals ?? 1;

  const fmtOpts: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  };

  // If raw=true, the value is already a ratio (0.123 = 12.3%)
  // If raw=false (default), the value is already a percent number (12.3 → 12.3%)
  const value = options?.raw ? p : p / 100;
  return new Intl.NumberFormat(locale, fmtOpts).format(value);
}

// ── formatVolume ──────────────────────────────────────────────────────────

/**
 * Smart volume abbreviation based on locale:
 *   en: 123 → "123", 1234 → "1.2K", 1234567 → "1.2M", 1234567890 → "1.2B"
 *   zh-CN/zh-HK: 1234 → "1234", 10000 → "1万", 100000000 → "1亿"
 *   ja: 10000 → "1万", 100000000 → "1億"
 *   ko: 10000 → "1만"
 */
export function formatVolume(v: number, options?: NumberFormatOptions): string {
  if (!Number.isFinite(v)) return String(v);
  const locale = options?.locale || 'en';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';

  // CJK locales use 万/亿
  if (isCJKLocale(locale)) {
    return sign + formatVolumeCJK(abs, locale);
  }

  // Western locales use K/M/B
  return sign + formatVolumeWestern(abs, locale);
}

function isCJKLocale(locale: string): boolean {
  const l = locale.toLowerCase();
  return l.startsWith('zh') || l.startsWith('ja') || l.startsWith('ko');
}

function formatVolumeCJK(n: number, locale: string): string {
  const l = locale.toLowerCase();
  const isJapanese = l.startsWith('ja');
  const isKorean = l.startsWith('ko');

  // 亿/億 = 100M, 万/万/만 = 10K
  const yiLabel = isJapanese ? '億' : '亿';
  const wanLabel = isKorean ? '만' : '万';

  if (n >= 1e8) {
    return formatNumber(n / 1e8, { locale, decimals: 1 }) + yiLabel;
  }
  if (n >= 1e4) {
    return formatNumber(n / 1e4, { locale, decimals: 1 }) + wanLabel;
  }
  if (n >= 1000) {
    return formatNumber(n, { locale, decimals: 0 });
  }
  return formatNumber(n, { locale, decimals: 0 });
}

function formatVolumeWestern(n: number, locale: string): string {
  if (n >= 1e9) {
    return formatNumber(n / 1e9, { locale, decimals: 1 }) + 'B';
  }
  if (n >= 1e6) {
    return formatNumber(n / 1e6, { locale, decimals: 1 }) + 'M';
  }
  if (n >= 1e3) {
    return formatNumber(n / 1e3, { locale, decimals: 1 }) + 'K';
  }
  return formatNumber(n, { locale, decimals: 0 });
}

// ── formatCompact ─────────────────────────────────────────────────────────

/**
 * Use Intl.NumberFormat compactDisplay for locale-native compact formatting.
 * Browser decides the best unit (K/M/B or 万/亿 etc.) based on locale.
 */
export function formatCompact(n: number, options?: NumberFormatOptions): string {
  if (!Number.isFinite(n)) return String(n);
  const locale = options?.locale || 'en';
  const decimals = options?.decimals ?? 1;

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}

// ── Utilities ─────────────────────────────────────────────────────────────

/**
 * Format price change with sign and color hint.
 * Returns { text: "+1.23%", direction: "up" | "down" | "flat" }
 */
export function formatPriceChange(
  change: number,
  options?: NumberFormatOptions
): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (!Number.isFinite(change)) {
    return { text: String(change), direction: 'flat' };
  }
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const sign = change > 0 ? '+' : '';
  const decimals = options?.decimals ?? 2;
  const formatted = formatNumber(Math.abs(change), { ...options, decimals });
  return {
    text: `${sign}${formatted}%`,
    direction,
  };
}

/**
 * Format a ratio as human-readable (e.g., Sharpe ratio: 1.23).
 */
export function formatRatio(n: number, options?: NumberFormatOptions): string {
  if (!Number.isFinite(n)) return '—';
  return formatNumber(n, { ...options, decimals: options?.decimals ?? 2 });
}
