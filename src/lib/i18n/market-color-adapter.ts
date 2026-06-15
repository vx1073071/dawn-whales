// ── R227 auto-2.3b: Market Color Adapter ────────────────────────────────
// Handles cultural color conventions for price changes:
//   CN/HK/TW/JP/KR: 红涨绿跌 (red=up, green=down)
//   US/EU:          绿涨红跌 (green=up, red=down)
//
// Provides a single color API used by ALL chart, PnL, and position components.

// ═══════════ Market Region → Color Convention ════════════════════════════

export type MarketColorConvention = 'cn-style' | 'us-style';

export const MARKET_COLOR_CONVENTION: Record<string, MarketColorConvention> = {
  // CN-style (red = up/positive, green = down/negative)
  'zh-CN': 'cn-style',
  'zh-TW': 'cn-style',
  'zh-HK': 'cn-style',
  'ja': 'cn-style',
  'ko': 'cn-style',
  // US-style (green = up/positive, red = down/negative)
  'en': 'us-style',
  'fr': 'us-style',
  'it': 'us-style',
  'de': 'us-style',
  'es': 'us-style',
  'ru': 'us-style',
};

/** Markets that use CN-style coloring */
export const CN_STYLE_MARKETS = new Set(['HK', 'SH', 'SZ', 'JP', 'KR', 'TW', 'CN']);

/** Markets that use US-style coloring */
export const US_STYLE_MARKETS = new Set(['US', 'UK', 'DE', 'FR', 'EU']);

// ═══════════ Color Definitions ═══════════════════════════════════════════

export interface MarketColors {
  up: string;       // Positive change color
  down: string;     // Negative change color
  neutral: string;  // Flat/zero change
  upBg: string;     // Background for positive
  downBg: string;   // Background for negative
  upBorder: string;
  downBorder: string;
}

const CN_COLORS: MarketColors = {
  up: '#e53935',        // Red (涨 = 红)
  down: '#43a047',      // Green (跌 = 绿)
  neutral: '#757575',
  upBg: 'rgba(229,57,53,0.12)',
  downBg: 'rgba(67,160,71,0.12)',
  upBorder: '#e53935',
  downBorder: '#43a047',
};

const US_COLORS: MarketColors = {
  up: '#43a047',        // Green (up = green)
  down: '#e53935',      // Red (down = red)
  neutral: '#757575',
  upBg: 'rgba(67,160,71,0.12)',
  downBg: 'rgba(229,57,53,0.12)',
  upBorder: '#43a047',
  downBorder: '#e53935',
};

// ═══════════ Color Adapter API ═══════════════════════════════════════════

let _activeConvention: MarketColorConvention = 'cn-style';

/** Set color convention by locale */
export function setMarketColorByLocale(locale: string): void {
  const lang = locale.split('-')[0];
  const baseLocale = MARKET_COLOR_CONVENTION[locale] || MARKET_COLOR_CONVENTION[lang];
  _activeConvention = baseLocale || 'cn-style';
}

/** Set color convention by market code (e.g., 'HK', 'US') */
export function setMarketColorByMarket(market: string): void {
  if (CN_STYLE_MARKETS.has(market.toUpperCase())) {
    _activeConvention = 'cn-style';
  } else {
    _activeConvention = 'us-style';
  }
}

/** Get current color convention */
export function getMarketColorConvention(): MarketColorConvention {
  return _activeConvention;
}

/** Get active market colors based on current convention */
export function getMarketColors(): MarketColors {
  return _activeConvention === 'cn-style' ? CN_COLORS : US_COLORS;
}

// ═══════════ Convenience Functions ═══════════════════════════════════════

/**
 * Get the color for a signed numeric change.
 * Positive → up color, negative → down color.
 */
export function colorForChange(value: number): string {
  const colors = getMarketColors();
  if (value > 0) return colors.up;
  if (value < 0) return colors.down;
  return colors.neutral;
}

/** Get CSS var names for dynamic theme support */
export function getColorCssVars(): Record<string, string> {
  const colors = getMarketColors();
  return {
    '--dw-market-up': colors.up,
    '--dw-market-down': colors.down,
    '--dw-market-neutral': colors.neutral,
    '--dw-market-up-bg': colors.upBg,
    '--dw-market-down-bg': colors.downBg,
    '--dw-market-up-border': colors.upBorder,
    '--dw-market-down-border': colors.downBorder,
  };
}

/** Get Tailwind-compatible color classes */
export function getChangeColorClass(value: number): string {
  if (value > 0) return 'text-market-up';
  if (value < 0) return 'text-market-down';
  return 'text-gray-500 dark:text-gray-400';
}

/** Get BG color class for change cells */
export function getChangeBgClass(value: number): string {
  if (value > 0) return _activeConvention === 'cn-style' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20';
  if (value < 0) return _activeConvention === 'cn-style' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
  return '';
}

/** Get arrow indicator for change direction */
export function getChangeArrow(value: number): string {
  if (value > 0) return '▲';
  if (value < 0) return '▼';
  return '—';
}

// ═══════════ PnL Formatter (with color) ══════════════════════════════════

export interface PnLDisplay {
  text: string;
  color: string;
  arrow: string;
  className: string;
}

/**
 * Format a P&L value for display with correct market colors.
 * Single function to replace all ad-hoc PnL formatting across the app.
 */
export function formatPnL(
  value: number,
  options?: {
    prefix?: string;
    decimals?: number;
    showArrow?: boolean;
  }
): PnLDisplay {
  const d = options?.decimals ?? 2;
  const prefix = options?.prefix ?? '';
  const absVal = Math.abs(value);
  const colors = getMarketColors();

  return {
    text: `${value >= 0 ? '+' : '-'}${prefix}${absVal.toFixed(d)}`,
    color: value > 0 ? colors.up : value < 0 ? colors.down : colors.neutral,
    arrow: options?.showArrow !== false ? getChangeArrow(value) : '',
    className: getChangeColorClass(value),
  };
}

// ═══════════ Market Icon/Label Helper ════════════════════════════════════

const MARKET_LABELS: Record<string, { flag: string; name: string }> = {
  'HK': { flag: '🇭🇰', name: '港股' },
  'US': { flag: '🇺🇸', name: '美股' },
  'JP': { flag: '🇯🇵', name: '日本' },
  'KR': { flag: '🇰🇷', name: '韩国' },
  'TW': { flag: '🇹🇼', name: '台湾' },
  'SG': { flag: '🇸🇬', name: '新加坡' },
  'AU': { flag: '🇦🇺', name: '澳大利亚' },
  'IN': { flag: '🇮🇳', name: '印度' },
  'EU': { flag: '🇪🇺', name: '欧洲' },
  'SH': { flag: '🇨🇳', name: '沪市' },
  'SZ': { flag: '🇨🇳', name: '深市' },
  'CN': { flag: '🇨🇳', name: 'A股' },
};

export function getMarketIcon(marketCode: string): string {
  return MARKET_LABELS[marketCode?.toUpperCase()]?.flag || '🏦';
}

export function getMarketName(marketCode: string): string {
  return MARKET_LABELS[marketCode?.toUpperCase()]?.name || marketCode;
}
