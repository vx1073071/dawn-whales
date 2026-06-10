import { useState, createContext, useContext, type ReactNode, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

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
    appName: 'Dawn Whales', settings: t('components.settings'),
    darkMode: t('components.darkMode'), lightMode: t('components.lightMode'), followSystem: t('跟随系统'), themeLabel: t('components.theme'),
    langLabel: t('components.language'),
    errCodeFormat: t('代码格式错误'), errParamRange: t('参数超出范围'), errNetwork: t('网络错误'), errServer: t('服务器错误'),
    friendlyCodeHK: t('港股代码是5位数字哦（如 00700），试试重新输入？'),
    friendlyCodeUS: t('美股代码是英文字母（如 AAPL），大小写都可以~'),
    friendlyParamShort: t('快线5~20适合短线快进快出，调整一下试试？'),
    friendlyParamLong: t('慢线20~200适合中长期趋势，再试试？'),
    friendlyNetwork: t('网络不太稳定，检查一下连接后重试？'),
    friendlyServer: t('服务器繁忙中，稍等片刻自动恢复~'),
    save: t('components.save'), cancel: t('components.cancel'), confirm: t('components.confirm'), close: t('components.close'),
    loading: t('components.loading'), empty: t('components.noData'), error: t('出错了'),
  },
  'zh-TW': {
    appName: 'Dawn Whales', settings: t('設定'),
    darkMode: t('components.darkMode'), lightMode: t('淺色模式'), followSystem: t('跟隨系統'), themeLabel: t('主題'),
    langLabel: t('語言'),
    errCodeFormat: t('代碼格式錯誤'), errParamRange: t('參數超出範圍'), errNetwork: t('網路錯誤'), errServer: t('伺服器錯誤'),
    friendlyCodeHK: t('港股代碼是5位數字喔（如 00700），試試重新輸入？'),
    friendlyCodeUS: t('美股代碼是英文字母（如 AAPL），大小寫都可以~'),
    friendlyParamShort: t('快線5~20適合短線快進快出，調整一下試試？'),
    friendlyParamLong: t('慢線20~200適合中長期趨勢，再試試？'),
    friendlyNetwork: t('網路不太穩定，檢查一下連線後重試？'),
    friendlyServer: t('伺服器繁忙中，稍等片刻自動恢復~'),
    save: t('儲存'), cancel: t('components.cancel'), confirm: t('確認'), close: t('關閉'),
    loading: t('載入中...'), empty: t('暫無資料'), error: t('出錯了'),
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
    appName: 'Dawn Whales', settings: t('設定'),
    darkMode: t('ダーク'), lightMode: t('ライト'), followSystem: t('システム'), themeLabel: t('テーマ'),
    langLabel: t('言語'),
    errCodeFormat: t('コード形式エラー'), errParamRange: t('パラメータ範囲外'), errNetwork: t('ネットワークエラー'), errServer: t('サーバーエラー'),
    friendlyCodeHK: t('香港株のコードは5桁の数字です（例：00700）。もう一度お試しください！'),
    friendlyCodeUS: t('米国株のティッカーは英字です（例：AAPL）。大文字小文字は問いません〜'),
    friendlyParamShort: t('短期MA 5-20は短期売買向けです。調整してみてください。'),
    friendlyParamLong: t('長期MA 20-200はトレンドフォロー向けです。もう一度！'),
    friendlyNetwork: t('ネットワークが不安定です。接続を確認してください。'),
    friendlyServer: t('サーバーが混雑しています。しばらくお待ちください〜'),
    save: t('components.save'), cancel: t('キャンセル'), confirm: t('確認'), close: t('閉じる'),
    loading: t('読み込み中...'), empty: t('データなし'), error: t('エラー'),
  },
  'ko': {
    appName: 'Dawn Whales', settings: t('설정'),
    darkMode: t('다크'), lightMode: t('라이트'), followSystem: t('시스템'), themeLabel: t('테마'),
    langLabel: t('언어'),
    errCodeFormat: t('코드 형식 오류'), errParamRange: t('매개변수 범위 초과'), errNetwork: t('네트워크 오류'), errServer: t('서버 오류'),
    friendlyCodeHK: t('홍콩 주식 코드는 5자리 숫자입니다 (예: 00700). 다시 입력해보세요!'),
    friendlyCodeUS: t('미국 주식 티커는 영문입니다 (예: AAPL). 대소문자 상관없어요~'),
    friendlyParamShort: t('단기 MA 5-20은 단기 스윙 트레이딩용입니다. 조정해보세요.'),
    friendlyParamLong: t('장기 MA 20-200은 추세 추종용입니다. 다시 시도해보세요!'),
    friendlyNetwork: t('네트워크가 불안정합니다. 연결을 확인해주세요.'),
    friendlyServer: t('서버가 혼잡합니다. 잠시만 기다려주세요~'),
    save: t('저장'), cancel: t('취소'), confirm: t('확인'), close: t('닫기'),
    loading: t('로딩 중...'), empty: t('데이터 없음'), error: t('오류'),
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
  const { t } = useTranslation();
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
        title={t("components.darkMode")}
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
        title={t("components.lightMode")}
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
    { value: 'zh-CN', label: t('简体中文'), flag: t('🇨🇳') },
    { value: 'zh-TW', label: t('繁體中文'), flag: t('🇹🇼') },
    { value: 'en', label: 'English', flag: t('🇺🇸') },
    { value: 'ja', label: t('日本語'), flag: t('🇯🇵') },
    { value: 'ko', label: t('한국어'), flag: t('🇰🇷') },
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
        💡 {lang === 'zh-CN' ? t('友好错误提示对比') : lang === 'zh-TW' ? t('友善錯誤提示對比') : 'Friendly Error Messages'}
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
            {lang === 'zh-CN' ? t('主题·语言·体验') : lang === 'zh-TW' ? t('主題·語言·體驗') : t('Theme · Language · Experience')}
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
          <ThemeSwatch label="背景" bg={colors.bg} text={colors.textSecondary} />
          <ThemeSwatch label="表面" bg={colors.surface} text={colors.textSecondary} />
          <ThemeSwatch label="文字" bg={colors.text} text={colors.textSecondary} />
          <ThemeSwatch label="主色" bg={colors.accent} text={colors.textSecondary} />
          <ThemeSwatch  label={t("components.success")} bg={colors.success} text={colors.textSecondary} />
          <ThemeSwatch  label={t("components.warning")} bg={colors.warning} text={colors.textSecondary} />
          <ThemeSwatch label="危险" bg={colors.danger} text={colors.textSecondary} />
          <ThemeSwatch label="图表" bg={colors.chartBg} text={colors.textSecondary} />
        </div>

        {/* Preview card */}
        <div style={{
          marginTop: 12, padding: '16px', borderRadius: 10,
          background: colors.bg, border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{s.appName}</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
            {theme === 'dark' ? (lang === 'zh-CN' ? t('AI驱动的量化策略平台') : 'AI-Powered Quant Strategy Platform') : (lang === 'zh-CN' ? t('AI驱动的量化策略平台') : 'AI-Powered Quant Strategy Platform')}
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
        📋 <strong>{lang === 'zh-CN' ? t('当前配置') : 'Current Config'}:</strong><br />
        {s.themeLabel}: <strong>{theme === 'dark' ? s.darkMode : s.lightMode}</strong> · {s.langLabel}: <strong>{lang}</strong><br />
        {lang === 'zh-CN' ? t('支持5种语言 · 深浅双主题 · 友好错误文案') : t('5 languages supported · Dual theme · Friendly error messages')}
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
