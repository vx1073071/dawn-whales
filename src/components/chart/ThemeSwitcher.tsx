import { useState } from 'react';

// ── Dark/Light Theme System ── ML#1 R270 (4h)
// Complete theme provider with multiple dark/light presets

type ThemeMode = 'light' | 'dark' | 'system';
type ThemePreset = 'default' | 'tradingview' | 'bloomberg' | 'midnight' | 'forest' | 'sunset';

interface ThemeColors {
  bg: string;
  bgCard: string;
  bgHover: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  success: string;
  danger: string;
  warning: string;
  chartBg: string;
  chartGrid: string;
  chartText: string;
  chartCandleUp: string;
  chartCandleDown: string;
  chartWick: string;
  chartVolume: string;
}

interface ThemeConfig {
  name: string;
  mode: 'light' | 'dark';
  colors: ThemeColors;
}

const THEMES: Record<ThemePreset, ThemeConfig> = {
  default: {
    name: '默认',
    mode: 'dark',
    colors: {
      bg: '#0f172a', bgCard: '#1e293b', bgHover: '#334155',
      text: '#f1f5f9', textSecondary: '#94a3b8', border: '#334155',
      primary: '#3b82f6', success: '#22c55e', danger: '#ef4444', warning: '#f59e0b',
      chartBg: '#0a0f1a', chartGrid: '#1e293b', chartText: '#94a3b8',
      chartCandleUp: '#22c55e', chartCandleDown: '#ef4444', chartWick: '#94a3b8',
      chartVolume: '#3b82f6',
    },
  },
  tradingview: {
    name: 'TradingView',
    mode: 'dark',
    colors: {
      bg: '#131722', bgCard: '#1e222d', bgHover: '#2a2e39',
      text: '#d1d4dc', textSecondary: '#787b86', border: '#2a2e39',
      primary: '#2962FF', success: '#089981', danger: '#F23645', warning: '#FF9800',
      chartBg: '#131722', chartGrid: '#1e222d', chartText: '#787b86',
      chartCandleUp: '#089981', chartCandleDown: '#F23645', chartWick: '#787b86',
      chartVolume: '#2962FF',
    },
  },
  bloomberg: {
    name: 'Bloomberg',
    mode: 'dark',
    colors: {
      bg: '#000000', bgCard: '#111111', bgHover: '#222222',
      text: '#FF6600', textSecondary: '#FF9900', border: '#333333',
      primary: '#FF6600', success: '#00FF00', danger: '#FF0000', warning: '#FFFF00',
      chartBg: '#000000', chartGrid: '#1a1a1a', chartText: '#FF9900',
      chartCandleUp: '#00FF00', chartCandleDown: '#FF0000', chartWick: '#FF6600',
      chartVolume: '#FF9900',
    },
  },
  midnight: {
    name: '午夜蓝',
    mode: 'dark',
    colors: {
      bg: '#0c0d1a', bgCard: '#161733', bgHover: '#222455',
      text: '#e8e8f0', textSecondary: '#8888aa', border: '#2a2b55',
      primary: '#6c63ff', success: '#00d2a0', danger: '#ff4757', warning: '#ffa502',
      chartBg: '#0c0d1a', chartGrid: '#1e1f3a', chartText: '#8888aa',
      chartCandleUp: '#00d2a0', chartCandleDown: '#ff4757', chartWick: '#6c63ff',
      chartVolume: '#6c63ff',
    },
  },
  forest: {
    name: '森林绿',
    mode: 'dark',
    colors: {
      bg: '#0a1a0a', bgCard: '#152215', bgHover: '#1f3320',
      text: '#c8e6c9', textSecondary: '#81c784', border: '#2d4a2e',
      primary: '#4caf50', success: '#66bb6a', danger: '#ef5350', warning: '#ffb74d',
      chartBg: '#0a1a0a', chartGrid: '#1a2f1a', chartText: '#81c784',
      chartCandleUp: '#66bb6a', chartCandleDown: '#ef5350', chartWick: '#a5d6a7',
      chartVolume: '#4caf50',
    },
  },
  sunset: {
    name: '日落橙',
    mode: 'dark',
    colors: {
      bg: '#1a0f0a', bgCard: '#2a1914', bgHover: '#3d251c',
      text: '#ffe0b2', textSecondary: '#ffcc80', border: '#4a3028',
      primary: '#ff9800', success: '#ffc107', danger: '#e91e63', warning: '#ffeb3b',
      chartBg: '#1a0f0a', chartGrid: '#2a1920', chartText: '#ffcc80',
      chartCandleUp: '#ffc107', chartCandleDown: '#e91e63', chartWick: '#ff9800',
      chartVolume: '#ff9800',
    },
  },
};

const ThemeSwitcher = () => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('qm-theme-mode') as ThemeMode) || 'dark';
  });
  const [preset, setPreset] = useState<ThemePreset>(() => {
    return (localStorage.getItem('qm-theme-preset') as ThemePreset) || 'default';
  });

  const theme = THEMES[preset];

  const applyTheme = (newPreset: ThemePreset) => {
    setPreset(newPreset);
    localStorage.setItem('qm-theme-preset', newPreset);
    const colors = THEMES[newPreset].colors;

    // Apply CSS variables
    const root = document.documentElement;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--qm-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    }
  };

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    localStorage.setItem('qm-theme-mode', next);
  };

  return (
    <div className="theme-switcher" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🎨 主题设置</span>
        <button onClick={toggleMode} style={{
          padding: '4px 12px', borderRadius: 16, border: 'none', fontSize: 10, cursor: 'pointer',
          background: mode === 'dark' ? '#1e293b' : '#f8fafc',
          color: mode === 'dark' ? '#f1f5f9' : '#1e293b',
        }}>
          {mode === 'dark' ? '🌙 暗色' : '☀️ 亮色'}
        </button>
      </div>

      {/* Preset Themes */}
      <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6, color: '#64748b' }}>🎨 预设主题</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {(Object.keys(THEMES) as ThemePreset[]).map(key => {
          const t = THEMES[key];
          const c = t.colors;
          return (
            <div key={key} onClick={() => applyTheme(key)} style={{
              padding: 8, borderRadius: 8, cursor: 'pointer',
              border: preset === key ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              background: c.bg,
              transition: 'all 0.15s',
            }}>
              {/* Mini preview */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 2, background: c.chartCandleUp }} />
                  <div style={{ flex: 1, height: 8, borderRadius: 2, background: c.chartCandleDown }} />
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.primary }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.success }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.danger }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.warning }} />
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: c.text, textAlign: 'center' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 8, color: c.textSecondary, textAlign: 'center' }}>
                {t.mode === 'dark' ? '🌙' : '☀️'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Color Preview */}
      <div style={{ marginTop: 10, fontWeight: 600, fontSize: 11, marginBottom: 6, color: '#64748b' }}>
        🔬 {theme.name} 配色预览
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: theme.colors.bgCard, border: `1px solid ${theme.colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            { label: 'Primary', color: theme.colors.primary },
            { label: 'Success', color: theme.colors.success },
            { label: 'Danger', color: theme.colors.danger },
            { label: 'Warning', color: theme.colors.warning },
            { label: 'BG', color: theme.colors.bg },
            { label: 'Card', color: theme.colors.bgCard },
            { label: 'Text', color: theme.colors.text },
            { label: 'Secondary', color: theme.colors.textSecondary },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: item.color, border: '1px solid rgba(255,255,255,0.1)',
              }} />
              <div style={{ fontSize: 8, color: theme.colors.textSecondary, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Chart preview */}
        <div style={{
          marginTop: 8, padding: 8, borderRadius: 6,
          background: theme.colors.chartBg, height: 60,
          display: 'flex', alignItems: 'flex-end', gap: 3,
        }}>
          {Array.from({ length: 20 }).map((_, i) => {
            const h = 20 + Math.random() * 35;
            const up = Math.random() > 0.45;
            return (
              <div key={i} style={{
                flex: 1, height: h, borderRadius: 1,
                background: up ? theme.colors.chartCandleUp : theme.colors.chartCandleDown,
              }} />
            );
          })}
        </div>
      </div>

      {/* Advanced Settings */}
      <div style={{ marginTop: 10, fontWeight: 600, fontSize: 11, marginBottom: 6, color: '#64748b' }}>
        ⚙️ 高级设置
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: '#64748b' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked /> 图表跟随系统主题
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked /> 降低动画效果 (性能优先)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" /> 高对比度模式 (色盲友好)
        </label>
      </div>
    </div>
  );
};

export { THEMES, ThemeSwitcher };
export default ThemeSwitcher;
