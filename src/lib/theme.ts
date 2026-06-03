// ── DAWN WHALES — Theme Store ───────────────────────────────────────────────
import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: (localStorage.getItem('dw_theme') as Theme) || 'dark',

  setTheme: (theme: Theme) => {
    localStorage.setItem('dw_theme', theme);
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

// Apply theme to document
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
}

// Initialize theme on load
const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('dw_theme') as Theme) || 'dark';
applyTheme(savedTheme);

export const THEME_LABELS: Record<Theme, string> = {
  dark: '🌙 深色',
  light: '☀️ 浅色',
};
