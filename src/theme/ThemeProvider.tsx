// ── R125 Theme System — CSS变量 + ThemeContext + 双主题切换 ────────────
// M01: 暗色/亮色双主题 (4h)
// M02: 视觉一致性 — 字体3级/间距/边框/滚动条 (3h)

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// ═══════════ Types ═══════════

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  borderPrimary: string;
  borderSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textAccent: string;
  accent: string;
  accentHover: string;
  green: string;
  red: string;
  yellow: string;
  chartBg: string;
  chartGrid: string;
  chartText: string;
  chartUp: string;
  chartDown: string;
  chartVolumeUp: string;
  chartVolumeDown: string;
}

export interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  colors: ThemeColors;
}

// ═══════════ Color definitions ═══════════

const DARK_COLORS: ThemeColors = {
  bgPrimary: '#0d1117',
  bgSecondary: '#161b22',
  bgTertiary: '#1c2333',
  bgHover: '#1f2937',
  borderPrimary: '#30363d',
  borderSecondary: '#1c2333',
  textPrimary: '#e6edf3',
  textSecondary: '#c9d1d9',
  textMuted: '#8b949e',
  textAccent: '#58a6ff',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#f59e0b',
  chartBg: '#0d1117',
  chartGrid: '#1c2333',
  chartText: '#8b949e',
  chartUp: '#22c55e',
  chartDown: '#ef4444',
  chartVolumeUp: '#22c55e40',
  chartVolumeDown: '#ef444440',
};

const LIGHT_COLORS: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f6f8fa',
  bgTertiary: '#f0f2f5',
  bgHover: '#e8eaed',
  borderPrimary: '#d0d7de',
  borderSecondary: '#e8eaed',
  textPrimary: '#1f2328',
  textSecondary: '#343941',
  textMuted: '#656d76',
  textAccent: '#0969da',
  accent: '#0969da',
  accentHover: '#0550ae',
  green: '#1a7f37',
  red: '#cf222e',
  yellow: '#9a6700',
  chartBg: '#ffffff',
  chartGrid: '#e8eaed',
  chartText: '#656d76',
  chartUp: '#1a7f37',
  chartDown: '#cf222e',
  chartVolumeUp: '#1a7f3740',
  chartVolumeDown: '#cf222e40',
};

// ═══════════ Build CSS variables string ═══════════

function colorsToCSSVars(colors: ThemeColors): string {
  return Object.entries(colors)
    .map(([key, val]) => `--dw-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${val};`)
    .join('\n');
}

// Inject CSS variables into <style id="dw-theme-vars">
function injectThemeVars(colors: ThemeColors) {
  const id = 'dw-theme-vars';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = `:root {\n${colorsToCSSVars(colors)}\n}`;
}

// ═══════════ Typography scale ═══════════
// M02: 3级字体系统 (不再混用7/8/9/10/12px)

export const TYPOGRAPHY = {
  // Font sizes
  textXs: '10px',    // 辅助信息: 成交量/时间戳
  textSm: '11px',    // 正文: 表格/标签
  textBase: '12px',  // 标题/主文本
  // Font family
  mono: '"SF Mono", "Cascadia Code", Consolas, "Noto Sans SC", monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif',
  // Line heights
  leadingTight: '1.3',
  leadingNormal: '1.5',
} as const;

// ═══════════ Spacing scale ═══════════
export const SPACING = {
  xs: '0.25rem',  // 4px  — 紧凑间隙
  sm: '0.5rem',   // 8px  — 标准间隙
  md: '0.75rem',  // 12px — 段落间距
  lg: '1rem',     // 16px — 区块间距
  xl: '1.5rem',   // 24px — 大区块分离
} as const;

// ═══════════ Border radius scale ═══════════
export const RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
} as const;

// ═══════════ Global scrollbar styles ═══════════
const DARK_SCROLLBAR = `
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--dw-bg-primary); }
  ::-webkit-scrollbar-thumb { background: var(--dw-bg-tertiary); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--dw-border-primary); }
`;

const LIGHT_SCROLLBAR = `
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--dw-bg-secondary); }
  ::-webkit-scrollbar-thumb { background: var(--dw-border-primary); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #a0a8b0; }
`;

function injectScrollbarStyles(mode: ThemeMode) {
  const id = 'dw-scrollbar';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = mode === 'dark' ? DARK_SCROLLBAR : LIGHT_SCROLLBAR;
}

// ═══════════ ThemeContext ═══════════

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be within ThemeProvider');
  return ctx;
}

export function useThemeSafe(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

// ═══════════ ThemeProvider ═══════════

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('dw-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    // Detect OS preference
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem('dw-theme', m); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  // Inject CSS variables + scrollbar on mount/mode change
  useEffect(() => {
    injectThemeVars(colors);
    injectScrollbarStyles(mode);
  }, [colors, mode]);

  // Listen for OS theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      try {
        if (!localStorage.getItem('dw-theme')) {
          setModeState(e.matches ? 'dark' : 'light');
        }
      } catch {}
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export { DARK_COLORS, LIGHT_COLORS };
