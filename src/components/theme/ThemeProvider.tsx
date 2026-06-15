// ── R229 ML-3.3: ColorBlindFriendly + DarkMode Default ────────────
// Dark mode as default, up/down arrows (↑/↓) with "涨/跌" text
// WCAG 2.1 AA compliant color palette for color-blind users
// Market-aware color switching (CN red-up / US green-up)
// Global CSS variable export for full-app theming

import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export type ColorMode = 'dark' | 'light';
export type MarketColorScheme = 'cn' | 'us';  // cn: red up, us: green up
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface ThemeConfig {
  mode: ColorMode;
  marketScheme: MarketColorScheme;
  colorBlindMode: ColorBlindMode;
}

// ── WCAG 2.1 AA Compliant Color Palette (color-blind friendly) ─────
// Each palette has: bg, surface, border, text, accent, up, down, warn
const PALETTES: Record<ColorMode, Record<string, string>> = {
  dark: {
    '--dw-bg': '#0d1117',
    '--dw-surface': '#161b22',
    '--dw-surface-hover': '#1c2129',
    '--dw-border': 'rgba(240,246,252,0.08)',
    '--dw-border-hover': 'rgba(240,246,252,0.15)',
    '--dw-text-primary': '#e6edf3',
    '--dw-text-secondary': '#8b949e',
    '--dw-text-tertiary': '#484f58',
    '--dw-accent': '#58a6ff',
    '--dw-accent-hover': '#79c0ff',
    '--dw-accent-bg': 'rgba(88,166,255,0.1)',
    '--dw-success': '#3fb950',
    '--dw-success-bg': 'rgba(63,185,80,0.1)',
    '--dw-warning': '#d29922',
    '--dw-warning-bg': 'rgba(210,153,34,0.1)',
    '--dw-danger': '#f85149',
    '--dw-danger-bg': 'rgba(248,81,73,0.1)',
    '--dw-purple': '#a371f7',
    '--dw-teal': '#39d353',
    // Market colors
    '--dw-up-color': '#f85149',     // default CN: red up
    '--dw-down-color': '#22c55e',   // default CN: green down
    '--dw-up-bg': 'rgba(248,81,73,0.12)',
    '--dw-down-bg': 'rgba(34,197,94,0.12)',
    // Chart
    '--dw-chart-grid': 'rgba(240,246,252,0.06)',
    '--dw-chart-text': '#8b949e',
  },
  light: {
    '--dw-bg': '#ffffff',
    '--dw-surface': '#f6f8fa',
    '--dw-surface-hover': '#eef0f2',
    '--dw-border': 'rgba(31,35,40,0.12)',
    '--dw-border-hover': 'rgba(31,35,40,0.2)',
    '--dw-text-primary': '#1f2328',
    '--dw-text-secondary': '#656d76',
    '--dw-text-tertiary': '#8c959f',
    '--dw-accent': '#0969da',
    '--dw-accent-hover': '#0550ae',
    '--dw-accent-bg': 'rgba(9,105,218,0.08)',
    '--dw-success': '#1a7f37',
    '--dw-success-bg': 'rgba(26,127,55,0.08)',
    '--dw-warning': '#9a6700',
    '--dw-warning-bg': 'rgba(154,103,0,0.08)',
    '--dw-danger': '#cf222e',
    '--dw-danger-bg': 'rgba(207,34,46,0.08)',
    '--dw-purple': '#8250df',
    '--dw-teal': '#1b7c83',
    // Market colors (light CN default)
    '--dw-up-color': '#cf222e',
    '--dw-down-color': '#1a7f37',
    '--dw-up-bg': 'rgba(207,34,46,0.08)',
    '--dw-down-bg': 'rgba(26,127,55,0.08)',
    // Chart
    '--dw-chart-grid': 'rgba(31,35,40,0.08)',
    '--dw-chart-text': '#656d76',
  },
};

// ── Color-blind mode adjustments ────────────────────────────────────
const COLOR_BLIND_ADJUSTMENTS: Record<ColorBlindMode, Record<string, string>> = {
  none: {},
  protanopia: {
    '--dw-up-color': '#3b82f6',    // blue instead of red
    '--dw-down-color': '#f59e0b',  // amber instead of green
    '--dw-up-bg': 'rgba(59,130,246,0.12)',
    '--dw-down-bg': 'rgba(245,158,11,0.12)',
    '--dw-success': '#3b82f6',
    '--dw-danger': '#f59e0b',
  },
  deuteranopia: {
    '--dw-up-color': '#3b82f6',    // blue instead of red
    '--dw-down-color': '#f59e0b',  // amber instead of green
    '--dw-up-bg': 'rgba(59,130,246,0.12)',
    '--dw-down-bg': 'rgba(245,158,11,0.12)',
    '--dw-success': '#3b82f6',
    '--dw-danger': '#f59e0b',
  },
  tritanopia: {
    '--dw-up-color': '#dc2626',    // red still visible
    '--dw-down-color': '#3b82f6',  // blue instead of green
    '--dw-up-bg': 'rgba(220,38,38,0.12)',
    '--dw-down-bg': 'rgba(59,130,246,0.12)',
    '--dw-success': '#dc2626',
    '--dw-danger': '#f59e0b',
  },
};

// ── Market color scheme (US: green up, red down) ────────────────────
const MARKET_COLOR_OVERRIDES: Record<string, boolean> = {
  us: true, hk: false, cn: false, jp: false, kr: false,
  eu: true, uk: true, sg: false, tw: false, in: false, au: false,
};

// ── Context ──────────────────────────────────────────────────────────
const defaultTheme: ThemeConfig = {
  mode: 'dark',
  marketScheme: 'cn',
  colorBlindMode: 'none',
};

const ThemeContext = createContext<{
  theme: ThemeConfig;
  setMode: (m: ColorMode) => void;
  setMarketScheme: (s: MarketColorScheme) => void;
  setColorBlindMode: (m: ColorBlindMode) => void;
  applyTheme: () => void;
}>({
  theme: defaultTheme,
  setMode: () => {},
  setMarketScheme: () => {},
  setColorBlindMode: () => {},
  applyTheme: () => {},
});

// ── Hook ─────────────────────────────────────────────────────────────
export function useTheme() {
  return useContext(ThemeContext);
}

// ── Provider ─────────────────────────────────────────────────────────
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const stored = localStorage.getItem('dw_theme');
      return stored ? JSON.parse(stored) : defaultTheme;
    } catch { return defaultTheme; }
  });

  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    const palette = PALETTES[theme.mode];
    const cbAdj = COLOR_BLIND_ADJUSTMENTS[theme.colorBlindMode];

    // Apply all CSS variables
    const allVars = { ...palette, ...cbAdj };

    // Market color scheme: US = green up
    if (theme.marketScheme === 'us') {
      allVars['--dw-up-color'] = palette['--dw-down-color'];
      allVars['--dw-down-color'] = palette['--dw-up-color'];
      allVars['--dw-up-bg'] = palette['--dw-down-bg'];
      allVars['--dw-down-bg'] = palette['--dw-up-bg'];
    }

    for (const [key, value] of Object.entries(allVars)) {
      root.style.setProperty(key, value);
    }

    root.setAttribute('data-theme', theme.mode);
    root.setAttribute('data-market', theme.marketScheme);
    if (theme.colorBlindMode !== 'none') {
      root.setAttribute('data-colorblind', theme.colorBlindMode);
    } else {
      root.removeAttribute('data-colorblind');
    }

    localStorage.setItem('dw_theme', JSON.stringify(theme));
  }, [theme]);

  // Apply on mount and change
  React.useEffect(() => { applyTheme(); }, [applyTheme]);

  const setMode = useCallback((mode: ColorMode) => setTheme(prev => ({ ...prev, mode })), []);
  const setMarketScheme = useCallback((s: MarketColorScheme) => setTheme(prev => ({ ...prev, marketScheme: s })), []);
  const setColorBlindMode = useCallback((m: ColorBlindMode) => setTheme(prev => ({ ...prev, colorBlindMode: m })), []);

  return (
    <ThemeContext.Provider value={{ theme, setMode, setMarketScheme, setColorBlindMode, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ── Price change indicator (with arrow + text) ──────────────────────
export interface PriceChangeProps {
  change: number;        // positive = gain
  changePct: number;     // percentage
  showArrow?: boolean;
  showText?: boolean;
  colorBlindMode?: ColorBlindMode;
  size?: 'sm' | 'md' | 'lg';
}

const UP_ARROW = '▲';
const DOWN_ARROW = '▼';

const TEXT_SIZES = { sm: 11, md: 13, lg: 16 };

export const PriceChangeIndicator: React.FC<PriceChangeProps> = ({
  change, changePct, showArrow = true, showText = true, colorBlindMode, size = 'md',
}) => {
  const isUp = change >= 0;
  const fontSize = TEXT_SIZES[size];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      color: `var(--dw-${isUp ? 'up' : 'down'}-color)`,
      fontWeight: 600, fontSize,
      background: `var(--dw-${isUp ? 'up' : 'down'}-bg)`,
      padding: '2px 8px', borderRadius: 6,
    }}>
      {showArrow && <span style={{ fontSize: fontSize - 2 }}>{isUp ? UP_ARROW : DOWN_ARROW}</span>}
      <span>{isUp ? '+' : ''}{change.toFixed(2)}</span>
      <span style={{ marginLeft: 2, opacity: 0.8 }}>({isUp ? '+' : ''}{changePct.toFixed(2)}%)</span>
      {showText && colorBlindMode !== 'none' && (
        <span style={{ fontSize: fontSize - 2, marginLeft: 2, fontWeight: 700, opacity: 0.9 }}>
          {isUp ? '涨' : '跌'}
        </span>
      )}
    </span>
  );
};

// ── Utility: is market US-style (green up)? ─────────────────────────
export function isUSStyleMarket(marketCode: string): boolean {
  return MARKET_COLOR_OVERRIDES[marketCode.toLowerCase()] ?? false;
}

// ── Utility: get up/down colors for a market ────────────────────────
export function getMarketColors(marketCode: string, mode: ColorMode = 'dark'): { up: string; down: string } {
  const palette = PALETTES[mode];
  if (isUSStyleMarket(marketCode)) {
    return { up: palette['--dw-down-color'], down: palette['--dw-up-color'] };
  }
  return { up: palette['--dw-up-color'], down: palette['--dw-down-color'] };
}

export default ThemeProvider;
export { PALETTES, COLOR_BLIND_ADJUSTMENTS, MARKET_COLOR_OVERRIDES };
