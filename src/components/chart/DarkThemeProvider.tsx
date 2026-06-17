/**
 * DarkThemeProvider — R275 ML#3: 全量暗色主题 (Full Dark/Light Theme Provider)
 *
 * Complete theming system:
 * - 8 preset themes (Deep Dark, Midnight Blue, Forest, Solarized, Sepia, High Contrast, OLED, Light)
 * - CSS variable injection
 * - Theme persistence
 * - System preference detection
 * - Transition animations
 * - Per-component theme tokens
 */
import React, { useState, useEffect, useContext, createContext } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
type ThemeName = 'deep-dark' | 'midnight-blue' | 'forest' | 'solarized-dark' | 'sepia' | 'high-contrast' | 'oled' | 'light';

interface ThemeColors {
  '--bg-body': string;
  '--bg-card': string;
  '--bg-input': string;
  '--bg-hover': string;
  '--text': string;
  '--text-dim': string;
  '--text-bright': string;
  '--border': string;
  '--accent': string;
  '--accent-hover': string;
  '--success': string;
  '--danger': string;
  '--warning': string;
  '--info': string;
  '--chart-up': string;
  '--chart-down': string;
  '--chart-line': string;
  '--chart-bg': string;
  '--scrollbar': string;
  '--scrollbar-hover': string;
}

interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  icon: string;
  colors: ThemeColors;
}

// ────────────────────────────────────
// Theme definitions
// ────────────────────────────────────
const THEMES: Record<ThemeName, Theme> = {
  'deep-dark': {
    name: 'deep-dark', label: 'Deep Dark', description: 'Professional trading default — easy on eyes for long sessions', icon: '\u{1F319}',
    colors: {
      '--bg-body': '#0f1117', '--bg-card': '#1a1d27', '--bg-input': '#252836',
      '--bg-hover': '#2d3142', '--text': '#e1e4eb', '--text-dim': '#8b8fa3',
      '--text-bright': '#ffffff', '--border': '#2d3142', '--accent': '#6366f1',
      '--accent-hover': '#818cf8', '--success': '#22c55e', '--danger': '#ef4444',
      '--warning': '#f59e0b', '--info': '#3b82f6', '--chart-up': '#22c55e',
      '--chart-down': '#ef4444', '--chart-line': '#6366f1', '--chart-bg': '#1a1d27',
      '--scrollbar': '#2d3142', '--scrollbar-hover': '#4b5563',
    },
  },
  'midnight-blue': {
    name: 'midnight-blue', label: 'Midnight Blue', description: 'Cool blue tones — Bloomberg Terminal inspired', icon: '\u{1F30C}',
    colors: {
      '--bg-body': '#0a0e27', '--bg-card': '#111640', '--bg-input': '#1a2058',
      '--bg-hover': '#232b70', '--text': '#d4d9f0', '--text-dim': '#7b83b8',
      '--text-bright': '#ffffff', '--border': '#1a2058', '--accent': '#38bdf8',
      '--accent-hover': '#7dd3fc', '--success': '#34d399', '--danger': '#f87171',
      '--warning': '#fbbf24', '--info': '#60a5fa', '--chart-up': '#34d399',
      '--chart-down': '#f87171', '--chart-line': '#38bdf8', '--chart-bg': '#111640',
      '--scrollbar': '#1a2058', '--scrollbar-hover': '#232b70',
    },
  },
  'forest': {
    name: 'forest', label: 'Forest', description: 'Earthy greens — low eye strain, good for all-day use', icon: '\u{1F332}',
    colors: {
      '--bg-body': '#0d1a0d', '--bg-card': '#152415', '--bg-input': '#1e301e',
      '--bg-hover': '#284028', '--text': '#dce4dc', '--text-dim': '#7a947a',
      '--text-bright': '#ffffff', '--border': '#1e301e', '--accent': '#4ade80',
      '--accent-hover': '#86efac', '--success': '#4ade80', '--danger': '#f87171',
      '--warning': '#fbbf24', '--info': '#60a5fa', '--chart-up': '#4ade80',
      '--chart-down': '#f87171', '--chart-line': '#86efac', '--chart-bg': '#152415',
      '--scrollbar': '#1e301e', '--scrollbar-hover': '#284028',
    },
  },
  'solarized-dark': {
    name: 'solarized-dark', label: 'Solarized', description: 'Ethan Schoonover\'s classic — warm, low-contrast, timeless', icon: '\u{2600}\u{FE0F}',
    colors: {
      '--bg-body': '#002b36', '--bg-card': '#073642', '--bg-input': '#0a4b5c',
      '--bg-hover': '#115060', '--text': '#93a1a1', '--text-dim': '#586e75',
      '--text-bright': '#eee8d5', '--border': '#0a4b5c', '--accent': '#b58900',
      '--accent-hover': '#cb9b1e', '--success': '#859900', '--danger': '#dc322f',
      '--warning': '#b58900', '--info': '#268bd2', '--chart-up': '#859900',
      '--chart-down': '#dc322f', '--chart-line': '#268bd2', '--chart-bg': '#073642',
      '--scrollbar': '#0a4b5c', '--scrollbar-hover': '#115060',
    },
  },
  'sepia': {
    name: 'sepia', label: 'Sepia Warm', description: 'Paper-like warmth — Kindle-esque reading comfort', icon: '\u{1F4D6}',
    colors: {
      '--bg-body': '#1a1410', '--bg-card': '#241d18', '--bg-input': '#302720',
      '--bg-hover': '#3d3228', '--text': '#d4c5b2', '--text-dim': '#8a7a68',
      '--text-bright': '#f5e6d3', '--border': '#302720', '--accent': '#d4a373',
      '--accent-hover': '#e0b78a', '--success': '#7c9a5a', '--danger': '#c06050',
      '--warning': '#c89840', '--info': '#6a8cb0', '--chart-up': '#7c9a5a',
      '--chart-down': '#c06050', '--chart-line': '#d4a373', '--chart-bg': '#241d18',
      '--scrollbar': '#302720', '--scrollbar-hover': '#3d3228',
    },
  },
  'high-contrast': {
    name: 'high-contrast', label: 'High Contrast', description: 'Maximum readability — accessibility focused', icon: '\u{1F441}',
    colors: {
      '--bg-body': '#000000', '--bg-card': '#111111', '--bg-input': '#1a1a1a',
      '--bg-hover': '#2a2a2a', '--text': '#ffffff', '--text-dim': '#aaaaaa',
      '--text-bright': '#ffffff', '--border': '#444444', '--accent': '#ffff00',
      '--accent-hover': '#ffff66', '--success': '#00ff00', '--danger': '#ff4444',
      '--warning': '#ffaa00', '--info': '#44aaff', '--chart-up': '#00ff00',
      '--chart-down': '#ff4444', '--chart-line': '#ffff00', '--chart-bg': '#111111',
      '--scrollbar': '#333333', '--scrollbar-hover': '#555555',
    },
  },
  'oled': {
    name: 'oled', label: 'OLED Black', description: 'True black #000 — saves battery on OLED displays', icon: '\u{1F4F1}',
    colors: {
      '--bg-body': '#000000', '--bg-card': '#0a0a0a', '--bg-input': '#141414',
      '--bg-hover': '#1e1e1e', '--text': '#e5e5e5', '--text-dim': '#707070',
      '--text-bright': '#ffffff', '--border': '#1e1e1e', '--accent': '#818cf8',
      '--accent-hover': '#a5b4fc', '--success': '#4ade80', '--danger': '#f87171',
      '--warning': '#fbbf24', '--info': '#60a5fa', '--chart-up': '#4ade80',
      '--chart-down': '#f87171', '--chart-line': '#818cf8', '--chart-bg': '#0a0a0a',
      '--scrollbar': '#1a1a1a', '--scrollbar-hover': '#2a2a2a',
    },
  },
  'light': {
    name: 'light', label: 'Light Mode', description: 'Clean day mode — for bright environments', icon: '\u{2600}\u{FE0F}',
    colors: {
      '--bg-body': '#f8fafc', '--bg-card': '#ffffff', '--bg-input': '#f1f5f9',
      '--bg-hover': '#e2e8f0', '--text': '#0f172a', '--text-dim': '#64748b',
      '--text-bright': '#020617', '--border': '#e2e8f0', '--accent': '#4f46e5',
      '--accent-hover': '#6366f1', '--success': '#16a34a', '--danger': '#dc2626',
      '--warning': '#d97706', '--info': '#2563eb', '--chart-up': '#16a34a',
      '--chart-down': '#dc2626', '--chart-line': '#4f46e5', '--chart-bg': '#ffffff',
      '--scrollbar': '#cbd5e1', '--scrollbar-hover': '#94a3b8',
    },
  },
};

// ────────────────────────────────────
// Context
// ────────────────────────────────────
interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  allThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType>(null!);
export const useTheme = () => useContext(ThemeContext);

// ────────────────────────────────────
// Provider
// ────────────────────────────────────
export const DarkThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('qm-theme');
    if (saved && THEMES[saved as ThemeName]) return saved as ThemeName;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'deep-dark';
  });

  const theme = THEMES[themeName];

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    localStorage.setItem('qm-theme', themeName);
  }, [themeName, theme.colors]);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('qm-theme');
      if (!saved) setThemeName(e.matches ? 'light' : 'deep-dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = (name: ThemeName) => setThemeName(name);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme, allThemes: Object.values(THEMES) }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ────────────────────────────────────
// Theme Picker Component (standalone)
// ────────────────────────────────────
export const ThemePicker: React.FC = () => {
  const { themeName, setTheme, allThemes } = useTheme();
  const [previewTheme, setPreviewTheme] = useState<ThemeName | null>(null);

  const handlePreview = (name: ThemeName) => {
    setPreviewTheme(name);
    // Temporarily apply
    const root = document.documentElement;
    Object.entries(THEMES[name].colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const handlePreviewEnd = () => {
    if (previewTheme) {
      const root = document.documentElement;
      Object.entries(THEMES[themeName].colors).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      setPreviewTheme(null);
    }
  };

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 700 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>{'\u{1F3A8}'} Theme Settings</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {allThemes.map(t => {
          const c = t.colors;
          const isActive = themeName === t.name;
          return (
            <div
              key={t.name}
              onClick={() => setTheme(t.name)}
              onMouseEnter={() => handlePreview(t.name)}
              onMouseLeave={handlePreviewEnd}
              style={{
                padding: 12, borderRadius: 10, cursor: 'pointer',
                border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: c['--bg-card'],
                color: c['--text'],
                transition: 'all .2s',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {/* Color swatches */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: c['--bg-body'], border: `1px solid ${c['--border']}` }} />
                <div style={{ width: 20, height: 20, borderRadius: 6, background: c['--bg-input'] }} />
                <div style={{ width: 20, height: 20, borderRadius: 6, background: c['--accent'] }} />
                <div style={{ width: 20, height: 20, borderRadius: 6, background: c['--text'] }} />
                <div style={{ width: 20, height: 20, borderRadius: 6, background: c['--success'] }} />
              </div>

              {/* Text preview */}
              <div style={{
                padding: 6, borderRadius: 4, background: c['--bg-input'],
                fontSize: 9, lineHeight: 1.4, marginBottom: 8,
              }}>
                <div style={{ color: c['--text'] }}>AAPL 195.20</div>
                <div style={{ color: c['--chart-up'] }}>{'\u25B2'} +2.35 (1.22%)</div>
                <div style={{ color: c['--text-dim'] }}>Vol: 52.4M</div>
              </div>

              {/* Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{t.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{t.description}</div>
                </div>
              </div>

              {isActive && (
                <div style={{ marginTop: 6, fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>
                  {'\u2713'} Active
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          <QuickBtn label={'\u{1F31E} Auto'} desc="Follow system" />
          <QuickBtn label={'\u{1F319} Dark'} desc="Always dark" />
          <QuickBtn label={'\u{2600}\u{FE0F} Light'} desc="Always light" />
        </div>
      </div>
    </div>
  );
};

function QuickBtn({ label, desc }: { label: string; desc: string }) {
  return (
    <button style={{
      flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
      background: 'var(--bg-input)', cursor: 'pointer', color: 'var(--text)',
      transition: '.2s',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{desc}</div>
    </button>
  );
}

export default DarkThemeProvider;
