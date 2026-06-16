/**
 * quant-moo R125 J01 — Chart Theme Colors Adapter
 * 
 * Replaces hardcoded hex values in chart/market engines with CSS-variable-driven colors.
 * Priority: window.getComputedStyle  → ThemeContext.colors → fallback defaults.
 */

export interface ChartTheme {
  bgPrimary: string;
  bgSecondary: string;
  borderPrimary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  gridColor: string;
  upColor: string;
  downColor: string;
  volumeUp: string;
  volumeDown: string;
  accent: string;
  crosshairColor: string;
  axisColor: string;
}

// ═══════════ CSS Variable Keys (matches ThemeProvider) ═══════════════════

const CSS_VAR_MAP: Record<keyof ChartTheme, string> = {
  bgPrimary: '--dw-bg-primary',
  bgSecondary: '--dw-bg-secondary',
  borderPrimary: '--dw-border-primary',
  textPrimary: '--dw-text-primary',
  textSecondary: '--dw-text-secondary',
  textMuted: '--dw-text-muted',
  gridColor: '--dw-chart-grid',
  upColor: '--dw-chart-up',
  downColor: '--dw-chart-down',
  volumeUp: '--dw-chart-volume-up',
  volumeDown: '--dw-chart-volume-down',
  accent: '--dw-accent',
  crosshairColor: '--dw-text-muted',
  axisColor: '--dw-text-muted',
};

// ═══════════ Dark defaults (matches DARK_COLORS in ThemeProvider) ══════════

export const DARK_CHART_THEME: ChartTheme = {
  bgPrimary: '#0d1117',
  bgSecondary: '#1c2333',
  borderPrimary: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#c9d1d9',
  textMuted: '#8b949e',
  gridColor: '#1c2333',
  upColor: '#22c55e',
  downColor: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.25)',
  volumeDown: 'rgba(239, 68, 68, 0.25)',
  accent: '#3b82f6',
  crosshairColor: '#8b949e',
  axisColor: '#8b949e',
};

export const LIGHT_CHART_THEME: ChartTheme = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f0f2f5',
  borderPrimary: '#d0d7de',
  textPrimary: '#1f2328',
  textSecondary: '#343941',
  textMuted: '#656d76',
  gridColor: '#e8eaed',
  upColor: '#1a7f37',
  downColor: '#cf222e',
  volumeUp: 'rgba(26, 127, 55, 0.25)',
  volumeDown: 'rgba(207, 34, 46, 0.25)',
  accent: '#0969da',
  crosshairColor: '#656d76',
  axisColor: '#656d76',
};

// ═══════════ Resolve from CSS variables or fallback ═══════════════════

export function resolveChartTheme(): ChartTheme {
  try {
    const el = document.documentElement;
    const style = getComputedStyle(el);
    const theme: Partial<ChartTheme> = {};
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
      const val = style.getPropertyValue(cssVar).trim();
      if (val) {
        (theme as any)[key] = val;
      }
    }
    // If all resolved, return
    if (Object.keys(theme).length === Object.keys(CSS_VAR_MAP).length) {
      return theme as ChartTheme;
    }
  } catch {}

  // Fallback: check from window state
  try {
    const dwTheme = (window as any).__dwThemeMode;
    if (dwTheme === 'light') return LIGHT_CHART_THEME;
  } catch {}

  return DARK_CHART_THEME;
}

// ═══════════ Convenience: get single color ═══════════════════════════

let _cachedTheme: ChartTheme | null = null;
let _cacheTime = 0;

export function getChartTheme(forceRefresh = false): ChartTheme {
  if (!_cachedTheme || forceRefresh || Date.now() - _cacheTime > 5000) {
    _cachedTheme = resolveChartTheme();
    _cacheTime = Date.now();
  }
  return _cachedTheme!;
}

export function getChartColor(key: keyof ChartTheme): string {
  return getChartTheme()[key];
}

// ═══════════ Map common hardcoded hex → theme key ═══════════════════

const HEX_TO_THEME: Record<string, keyof ChartTheme> = {
  '#0d1117': 'bgPrimary',
  '#161b22': 'bgSecondary',
  '#1c2333': 'bgSecondary',
  '#30363d': 'borderPrimary',
  '#e6edf3': 'textPrimary',
  '#c9d1d9': 'textSecondary',
  '#8b949e': 'textMuted',
  '#58a6ff': 'accent',
  '#3b82f6': 'accent',
  '#22c55e': 'upColor',
  '#ef4444': 'downColor',
  '#ffffff': 'bgPrimary', // in dark context
};

export function fromLegacyColor(hex: string): string {
  const key = HEX_TO_THEME[hex.toLowerCase()];
  if (key) return getChartColor(key);
  return hex; // Keep unrecognized colors (line colors, labels etc.)
}
