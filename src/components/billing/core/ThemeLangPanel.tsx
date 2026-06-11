import { useState, createContext, useContext, type ReactNode, type CSSProperties } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';

import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';

// ── Types ──
type Theme = 'dark' | 'light';
type Lang = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko';

interface ThemeColors {
  bg: string; surface: string; border: string; borderHover: string;
  text: string; textSecondary: string; textMuted: string;
  accent: string; accentHover: string; accentBg: string;
  success: string; warning: string; danger: string;
  chartBg: string; chartGrid: string;
}

interface LangStrings {
  // Header
  appName: string
  settings: string
  // Theme
  darkMode: string; lightMode: string; followSystem: string; themeLabel: string
  langLabel: string
  // Errors
  errCodeFormat: string; errParamRange: string; errNetwork: string; errServer: string
  // Friendly errors
  friendlyCodeHK: string; friendlyCodeUS: string; friendlyParamShort: string; friendlyParamLong: string
  friendlyNetwork: string; friendlyServer: string
  // Common
  save: string; cancel: string; confirm: string; close: string
  loading: string; empty: string; error: string
}

const THEMES: Record<Theme, ThemeColors> = {
  dark: {
    bg: '#0A0A10', surface: '#1F2937', border: '#374151', borderHover: '#4B5563',
    text: '#F9FAFB', textSecondary: '#D1D5DB', textMuted: '#6B7280',
    accent: '#6366F1', accentHover: '#818CF8', accentBg: '#6366F118',
    success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
    chartBg: '#111827', chartGrid: '#1F2937',
  },
  light: {
    bg: '#F9FAFB', surface: '#FFFFFF', border: '#D1D5DB', borderHover: '#9CA3AF',
    text: '#111827', textSecondary: '#374151', textMuted: '#6B7280',
    accent: '#4F46E5', accentHover: '#6366F1', accentBg: '#EEF2FF',
    success: '#059669', warning: '#D97706', danger: '#DC2626',
    chartBg: '#FFFFFF', chartGrid: '#E5E7EB',
  },
};

const STRINGS: Record<Lang, LangStrings> = {
  'zh-CN': {
    appName: 'Dawn Whales', settings: i18n.t('ThemeLangPanel.k1'),
    darkMode: i18n.t('ThemeLangPanel.k2'), lightMode: i18n.t('ThemeLangPanel.k3'), followSystem: i18n.t('ThemeLangPanel.k4'), themeLabel: i18n.t('ThemeLangPanel.k5'),
    langLabel: i18n.t('ThemeLangPanel.k6'),
    errCodeFormat: i18n.t('ThemeLangPanel.k7'), errParamRange: i18n.t('ThemeLangPanel.k8'), errNetwork: i18n.t('ThemeLangPanel.k9'), errServer: i18n.t('ThemeLangPanel.k10'),
    friendlyCodeHK: i18n.t('ThemeLangPanel.k11'),
    friendlyCodeUS: i18n.t('ThemeLangPanel.k12'),
    friendlyParamShort: i18n.t('ThemeLangPanel.k13'),
    friendlyParamLong: i18n.t('ThemeLangPanel.k14'),
    friendlyNetwork: i18n.t('ThemeLangPanel.k15'),
    friendlyServer: i18n.t('ThemeLangPanel.k16'),
    save: i18n.t('ThemeLangPanel.k17'), cancel: i18n.t('ThemeLangPanel.k18'), confirm: i18n.t('ThemeLangPanel.k19'), close: i18n.t('ThemeLangPanel.k20'),
    loading: i18n.t('ThemeLangPanel.k21'), empty: i18n.t('ThemeLangPanel.k22'), error: i18n.t('ThemeLangPanel.k23'),
  },
  'zh-TW': {
    appName: 'Dawn Whales', settings: i18n.t('ThemeLangPanel.k24'),
    darkMode: i18n.t('ThemeLangPanel.k25'), lightMode: i18n.t('ThemeLangPanel.k26'), followSystem: i18n.t('ThemeLangPanel.k27'), themeLabel: i18n.t('ThemeLangPanel.k28'),
    langLabel: i18n.t('ThemeLangPanel.k29'),
    errCodeFormat: i18n.t('ThemeLangPanel.k30'), errParamRange: i18n.t('ThemeLangPanel.k31'), errNetwork: i18n.t('ThemeLangPanel.k32'), errServer: i18n.t('ThemeLangPanel.k33'),
    friendlyCodeHK: i18n.t('ThemeLangPanel.k34'),
    friendlyCodeUS: i18n.t('ThemeLangPanel.k35'),
    friendlyParamShort: i18n.t('ThemeLangPanel.k36'),
    friendlyParamLong: i18n.t('ThemeLangPanel.k37'),
    friendlyNetwork: i18n.t('ThemeLangPanel.k38'),
    friendlyServer: i18n.t('ThemeLangPanel.k39'),
    save: i18n.t('ThemeLangPanel.k40'), cancel: i18n.t('ThemeLangPanel.k41'), confirm: i18n.t('ThemeLangPanel.k42'), close: i18n.t('ThemeLangPanel.k43'),
    loading: i18n.t('ThemeLangPanel.k44'), empty: i18n.t('ThemeLangPanel.k45'), error: i18n.t('ThemeLangPanel.k46'),
  },
  'en': {
    appName: 'Dawn Whales', settings: 'Settings',
    darkMode: 'Dark', lightMode: 'Light', followSystem: 'System', themeLabel: 'Theme',
    langLabel: 'Language',
    errCodeFormat: 'Invalid code format', errParamRange: 'Parameter out of range', errNetwork: 'Network error', errServer: 'Server error',
    friendlyCodeHK: 'HK stock codes are 5 digits (e.g. 00700). Try again!',
    friendlyCodeUS: 'US stock tickers use letters (e.g. AAPL). Case doesn\'t matter~',
    friendlyParamShort: 'Fast MA 5-20 is for short-term swing trading. Adjust and try?',
    friendlyParamLong: 'Slow MA 20-200 is for trend following. Try again?',
    friendlyNetwork: 'Network seems unstable. Check your connection?',
    friendlyServer: 'Server is busy. Wait a moment, it\'ll recover~',
    save: 'Save', cancel: 'Cancel', confirm: 'Confirm', close: 'Close',
    loading: 'Loading...', empty: 'No data', error: 'Error',
  },
  'ja': {
    appName: 'Dawn Whales', settings: i18n.t('ThemeLangPanel.k47'),
    darkMode: 'ダーク', lightMode: 'ライト', followSystem: 'システム', themeLabel: 'テーマ',
    langLabel: i18n.t('ThemeLangPanel.k48'),
    errCodeFormat: i18n.t('ThemeLangPanel.k49'), errParamRange: i18n.t('ThemeLangPanel.k50'), errNetwork: 'ネットワークエラー', errServer: 'サーバーエラー',
    friendlyCodeHK: i18n.t('ThemeLangPanel.k51'),
    friendlyCodeUS: i18n.t('ThemeLangPanel.k52'),
    friendlyParamShort: i18n.t('ThemeLangPanel.k53'),
    friendlyParamLong: i18n.t('ThemeLangPanel.k54'),
    friendlyNetwork: i18n.t('ThemeLangPanel.k55'),
    friendlyServer: i18n.t('ThemeLangPanel.k56'),
    save: i18n.t('ThemeLangPanel.k57'), cancel: 'キャンセル', confirm: i18n.t('ThemeLangPanel.k58'), close: i18n.t('ThemeLangPanel.k59'),
    loading: i18n.t('ThemeLangPanel.k60'), empty: 'データなし', error: 'エラー',
  },
  'ko': {
    appName: 'Dawn Whales', settings: '설정',
    darkMode: '다크', lightMode: '라이트', followSystem: '시스템', themeLabel: '테마',
    langLabel: '언어',
    errCodeFormat: '코드 형식 오류', errParamRange: '매개변수 범위 초과', errNetwork: '네트워크 오류', errServer: '서버 오류',
    friendlyCodeHK: '홍콩 주식 코드는 5자리 숫자입니다 (예: 00700). 다시 입력해보세요!',
    friendlyCodeUS: '미국 주식 티커는 영문입니다 (예: AAPL). 대소문자 상관없어요~',
    friendlyParamShort: '단기 MA 5-20은 단기 스윙 트레이딩용입니다. 조정해보세요.',
    friendlyParamLong: '장기 MA 20-200은 추세 추종용입니다. 다시 시도해보세요!',
    friendlyNetwork: '네트워크가 불안정합니다. 연결을 확인해주세요.',
    friendlyServer: '서버가 혼잡합니다. 잠시만 기다려주세요~',
    save: '저장', cancel: '취소', confirm: '확인', close: '닫기',
    loading: '로딩 중...', empty: '데이터 없음', error: '오류',
  },
};

// ── Context ──
interface ThemeLangContextType {
  theme: Theme; setTheme: (t: Theme) => void; colors: ThemeColors;
  lang: Lang; setLang: (l: Lang) => void; s: LangStrings;
  systemPrefersDark: boolean;
}

const ThemeLangContext = createContext<ThemeLangContextType>(null!);
export function useThemeLang() {
  const { t: _t } = useTranslation();
 return useContext(ThemeLangContext); }

export function ThemeLangProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Lang>('zh-CN');
  const [systemPrefersDark] = useState(true);

  const colors = THEMES[theme];
  const s = STRINGS[lang];

  return (
    <ThemeLangContext.Provider value={{ theme, setTheme, colors, lang, setLang, s, systemPrefersDark }}>
      {children}
    </ThemeLangContext.Provider>
  );
}

// ── Theme Toggle ──
function ThemeToggle() {
  const { theme, setTheme, colors } = useThemeLang();

  return (
    <div style={{ display: 'flex', gap: 2, background: colors.bg, borderRadius: 10, padding: 3, border: `1px solid ${colors.border}` }}>
      <button
        onClick={() => setTheme('dark')}
        style={{
          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: theme === 'dark' ? colors.accent : 'transparent',
          color: theme === 'dark' ? '#FFF' : colors.textMuted, fontSize: 14,
          transition: 'all 0.2s',
        }}
        title={"components.darkMode"}
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('light')}
        style={{
          padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: theme === 'light' ? colors.accent : 'transparent',
          color: theme === 'light' ? '#FFF' : colors.textMuted, fontSize: 14,
          transition: 'all 0.2s',
        }}
        title={"components.lightMode"}
      >
        ☀️
      </button>
    </div>
  );
}

// ── Language Selector ──
function LanguageSelector() {
  const { lang, setLang, colors } = useThemeLang();

  const options: { value: Lang; label: string; flag: string }[] = [
    { value: 'zh-CN', label: i18n.t('ThemeLangPanel.k61'), flag: '🇨🇳' },
    { value: 'zh-TW', label: i18n.t('ThemeLangPanel.k62'), flag: '🇹🇼' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ja', label: i18n.t('ThemeLangPanel.k63'), flag: '🇯🇵' },
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
  ];

  return (
    <select
      value={lang}
      onChange={e => setLang(e.target.value as Lang)}
      style={{
        padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
        background: colors.surface, color: colors.text, fontSize: 13, cursor: 'pointer',
        outline: 'none',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
      ))}
    </select>
  );
}

// ── Friendly Error Demo ──
function FriendlyErrorDemo() {
  const { lang, colors, s } = useThemeLang();

  const pairs = [
    { old: s.errCodeFormat, new: s.friendlyCodeHK },
    { old: s.errCodeFormat, new: s.friendlyCodeUS },
    { old: s.errParamRange, new: s.friendlyParamShort },
    { old: s.errParamRange, new: s.friendlyParamLong },
    { old: s.errNetwork, new: s.friendlyNetwork },
    { old: s.errServer, new: s.friendlyServer },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 12 }}>
        💡 {lang === 'zh-CN' ? i18n.t('ThemeLangPanel.k64') : lang === 'zh-TW' ? i18n.t('ThemeLangPanel.k65') : 'Friendly Error Messages'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pairs.map((p, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '8px 14px', borderRadius: 8,
            background: colors.surface, border: `1px solid ${colors.border}`,
          }}>
            <span style={{ fontSize: 12, color: colors.danger, textDecoration: 'line-through', minWidth: 120 }}>
              ❌ {p.old}
            </span>
            <span style={{ fontSize: 12, color: colors.success }}>
              ✅ {p.new}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Theme Preview Swatch ──
function ThemeSwatch({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, background: bg, border: '1px solid #374151' }} />
      <span style={{ fontSize: 10, color: text }}>{label}</span>
    </div>
  );
}

// ── Main ──
export default function ThemeLangPanel() {
  const { theme, lang, colors, s } = useThemeLang();

  const panelStyle: CSSProperties = {
    background: colors.bg, borderRadius: 16, padding: 24,
    border: `1px solid ${colors.border}`, color: colors.text,
    maxWidth: 800, margin: '0 auto',
  };

  const sectionStyle: CSSProperties = {
    padding: '16px 20px', borderRadius: 12, background: colors.surface,
    border: `1px solid ${colors.border}`, marginBottom: 16,
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.text }}>
            ⚙️ {s.settings}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>
            {lang === 'zh-CN' ? i18n.t('ThemeLangPanel.k66') : lang === 'zh-TW' ? i18n.t('ThemeLangPanel.k67') : 'Theme · Language · Experience'}
          </p>
        </div>
      </div>

      {/* Theme section */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>🎨 {s.themeLabel}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {s.darkMode} · {s.lightMode} · {s.followSystem}
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Color preview */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <ThemeSwatch label={i18n.t('ThemeLangPanel.k68')} bg={colors.bg} text={colors.textSecondary} />
          <ThemeSwatch label={i18n.t('ThemeLangPanel.k69')} bg={colors.surface} text={colors.textSecondary} />
          <ThemeSwatch label={i18n.t('ThemeLangPanel.k70')} bg={colors.text} text={colors.textSecondary} />
          <ThemeSwatch label={i18n.t('ThemeLangPanel.k71')} bg={colors.accent} text={colors.textSecondary} />
          <ThemeSwatch  label={"components.success"} bg={colors.success} text={colors.textSecondary} />
          <ThemeSwatch  label={"components.warning"} bg={colors.warning} text={colors.textSecondary} />
          <ThemeSwatch label={i18n.t('ThemeLangPanel.k72')} bg={colors.danger} text={colors.textSecondary} />
          <ThemeSwatch label={i18n.t('ThemeLangPanel.k73')} bg={colors.chartBg} text={colors.textSecondary} />
        </div>

        {/* Preview card */}
        <div style={{
          marginTop: 12, padding: '16px', borderRadius: 10,
          background: colors.bg, border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{s.appName}</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
            {theme === 'dark' ? (lang === 'zh-CN' ? i18n.t('ThemeLangPanel.k74') : 'AI-Powered Quant Strategy Platform') : (lang === 'zh-CN' ? i18n.t('ThemeLangPanel.k75') : 'AI-Powered Quant Strategy Platform')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: colors.success + '22', color: colors.success, fontSize: 11 }}>
              ✅ {s.save}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: colors.accentBg, color: colors.accent, fontSize: 11 }}>
              {s.cancel}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: colors.danger + '22', color: colors.danger, fontSize: 11 }}>
              {s.close}
            </span>
          </div>
        </div>
      </div>

      {/* Language section */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>🌐 {s.langLabel}</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              简体中文 · 繁體中文 · English · 日本語 · 한국어
            </div>
          </div>
          <LanguageSelector />
        </div>
      </div>

      {/* Friendly errors */}
      <div style={sectionStyle}>
        <FriendlyErrorDemo />
      </div>

      {/* i18n status */}
      <div style={{
        padding: '12px 16px', borderRadius: 10, background: colors.accentBg,
        border: `1px solid ${colors.accent}33`, fontSize: 12, color: colors.textSecondary,
        lineHeight: 1.8,
      }}>
        📋 <strong>{lang === 'zh-CN' ? i18n.t('ThemeLangPanel.k76') : 'Current Config'}:</strong><br />
        {s.themeLabel}: <strong>{theme === 'dark' ? s.darkMode : s.lightMode}</strong> · {s.langLabel}: <strong>{lang}</strong><br />
        {lang === 'zh-CN' ? i18n.t('ThemeLangPanel.k77') : '5 languages supported · Dual theme · Friendly error messages'}
      </div>
    </div>
  );
}

// ── Standalone wrapper ──
export function ThemeLangPanelStandalone() {
  return (
    <ThemeLangProvider>
      <ThemeLangPanel />
    </ThemeLangProvider>
  );
}

void EngineError; // [TRADE] structured error tracking