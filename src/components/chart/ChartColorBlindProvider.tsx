// @ts-nocheck
// R285 ML#3: ChartColorBlindProvider — 色盲适配+暗色主题 (4h)
// Protanopia/Deuteranopia/Tritanopia color palettes + dark/light theme
// Integrates with all chart, indicator, and drawing components
// 色盲适配: 支持红绿色盲/蓝黄色盲 + 暗色/亮色主题
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────
export type ColorVisionMode = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface ChartColors {
  // Candles
  candleUp: string;
  candleDown: string;
  candleWick: string;
  candleBorder: string;
  // Volume
  volumeUp: string;
  volumeDown: string;
  // Indicators
  ma: string[];
  macd: { line: string; signal: string; histogramUp: string; histogramDown: string };
  rsi: string;
  boll: { upper: string; middle: string; lower: string };
  // Drawing
  drawingDefault: string;
  drawingSupport: string;
  drawingResistance: string;
  drawingChannel: string;
  // Grid & Background
  grid: string;
  crosshair: string;
  text: string;
}

// ─── Color Palettes ────────────────────────────────────────────────

/** Normal vision */
const COLORS_NORMAL_DARK: ChartColors = {
  candleUp: '#22c55e', candleDown: '#ef4444', candleWick: '#94a3b8', candleBorder: '#64748b',
  volumeUp: '#22c55e44', volumeDown: '#ef444444',
  ma: ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'],
  macd: { line: '#3b82f6', signal: '#f59e0b', histogramUp: '#22c55e88', histogramDown: '#ef444488' },
  rsi: '#a855f7', boll: { upper: '#64748b', middle: '#f59e0b', lower: '#64748b' },
  drawingDefault: '#f59e0b', drawingSupport: '#22c55e', drawingResistance: '#ef4444', drawingChannel: '#3b82f6',
  grid: '#1e293b', crosshair: '#64748b', text: '#e2e8f0',
};

const COLORS_NORMAL_LIGHT: ChartColors = {
  ...COLORS_NORMAL_DARK,
  candleUp: '#16a34a', candleDown: '#dc2626',
  grid: '#e2e8f0', crosshair: '#94a3b8', text: '#0f172a',
};

/** Protanopia (red-blind) — replace reds with blues, greens with yellows */
const COLORS_PROTANOPIA_DARK: ChartColors = {
  ...COLORS_NORMAL_DARK,
  candleUp: '#0072B2', candleDown: '#E69F00',
  ma: ['#009E73', '#0072B2', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442'],
  macd: { line: '#0072B2', signal: '#E69F00', histogramUp: '#0072B244', histogramDown: '#E69F0044' },
  drawingSupport: '#0072B2', drawingResistance: '#E69F00',
};

/** Deuteranopia (green-blind) — replace greens with blues, reds with yellows */
const COLORS_DEUTERANOPIA_DARK: ChartColors = {
  ...COLORS_NORMAL_DARK,
  candleUp: '#009E73', candleDown: '#F0E442',
  ma: ['#0072B2', '#F0E442', '#CC79A7', '#56B4E9', '#009E73', '#E69F00'],
  macd: { line: '#009E73', signal: '#F0E442', histogramUp: '#009E7344', histogramDown: '#F0E44244' },
  drawingSupport: '#009E73', drawingResistance: '#F0E442',
};

/** Tritanopia (blue-blind) — replace blues with reds */
const COLORS_TRITANOPIA_DARK: ChartColors = {
  ...COLORS_NORMAL_DARK,
  ma: ['#f59e0b', '#ef4444', '#ec4899', '#22c55e', '#84cc16', '#eab308'],
  macd: { line: '#ef4444', signal: '#f59e0b', histogramUp: '#22c55e88', histogramDown: '#ef444488' },
  drawingChannel: '#ef4444',
};

// ─── Context ───────────────────────────────────────────────────────
interface ChartColorContextValue {
  visionMode: ColorVisionMode;
  setVisionMode: (mode: ColorVisionMode) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ChartColors;
  isDark: boolean;
}

const ChartColorContext = createContext<ChartColorContextValue | null>(null);

const STORAGE_VISION = 'chart-vision-mode';
const STORAGE_THEME = 'chart-theme-mode';

export function ChartColorBlindProvider({ children }: { children: React.ReactNode }) {
  const [visionMode, setVision] = useState<ColorVisionMode>(() => {
    try { return (localStorage.getItem(STORAGE_VISION) as ColorVisionMode) || 'normal'; } catch { return 'normal'; }
  });
  const [themeMode, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(STORAGE_THEME) as ThemeMode) || 'dark'; } catch { return 'dark'; }
  });

  const setVisionMode = useCallback((m: ColorVisionMode) => { setVision(m); try { localStorage.setItem(STORAGE_VISION, m); } catch {} }, []);
  const setThemeMode = useCallback((m: ThemeMode) => { setTheme(m); try { localStorage.setItem(STORAGE_THEME, m); } catch {} }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return themeMode === 'dark';
  }, [themeMode]);

  const colors = useMemo(() => {
    let palette: ChartColors;
    if (visionMode === 'protanopia') palette = COLORS_PROTANOPIA_DARK;
    else if (visionMode === 'deuteranopia') palette = COLORS_DEUTERANOPIA_DARK;
    else if (visionMode === 'tritanopia') palette = COLORS_TRITANOPIA_DARK;
    else palette = isDark ? COLORS_NORMAL_DARK : COLORS_NORMAL_LIGHT;
    return palette;
  }, [visionMode, isDark]);

  return <ChartColorContext.Provider value={{ visionMode, setVisionMode, themeMode, setThemeMode, colors, isDark }}>
    {children}
  </ChartColorContext.Provider>;
}

export function useChartColors() {
  const ctx = useContext(ChartColorContext);
  if (!ctx) throw new Error('useChartColors must be used within ChartColorBlindProvider');
  return ctx;
}

// ─── Quick Settings Button ─────────────────────────────────────────
export function ColorBlindSettingsButton({ dark = true }: { dark?: boolean }) {
  const c = dark ? { s: '#111827', b: '#1e293b', t: '#e2e8f0', t2: '#64748b', a: '#3b82f6' } : { s: '#ffffff', b: '#e2e8f0', t: '#0f172a', t2: '#94a3b8', a: '#2563eb' };
  const [open, setOpen] = useState(false);

  return <div style={{ position: 'relative' }}>
    <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: c.s, color: c.t, border: `1px solid ${c.b}`, cursor: 'pointer', fontSize: 11 }}>🎨 显示设置</button>
    {open && <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, padding: 14, borderRadius: 10, background: c.s, border: `1px solid ${c.b}`, minWidth: 200, zIndex: 200 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: c.t }}>色彩视觉</div>
      {[
        { v: 'normal', l: '👁️ 正常视觉', d: '默认红绿K线' },
        { v: 'protanopia', l: '🔴❌ 红色盲', d: '~8%男性, 红→蓝' },
        { v: 'deuteranopia', l: '🟢❌ 绿色盲', d: '~6%男性, 绿→黄' },
        { v: 'tritanopia', l: '🔵❌ 蓝色盲', d: '极罕见, 蓝→红' },
      ].map(m => <button key={m.v} onClick={() => { setOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: c.t, fontSize: 11 }} title={m.d}>{m.l}</button>)}
    </div>}
  </div>;
}

export { COLORS_NORMAL_DARK, COLORS_NORMAL_LIGHT, COLORS_PROTANOPIA_DARK, COLORS_DEUTERANOPIA_DARK, COLORS_TRITANOPIA_DARK };
