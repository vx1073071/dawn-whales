// ── DAWN WHALES — Internationalization (i18n) ──────────────────────────────
import { create } from 'zustand';
import i18n from '../i18n';

export type Locale = 'zh' | 'en' | 'ja';

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ── Translation dictionaries ──────────────────────────────────────────────

const zh: Record<string, string> = {
  // Navigation
  'nav.market': i18n.t('I18n.k0'),
  'nav.strategy': i18n.t('I18n.k1'),
  'nav.marketplace': i18n.t('I18n.k2'),
  'nav.live': i18n.t('I18n.k3'),
  'nav.backtest': i18n.t('I18n.k4'),
  'nav.portfolio': i18n.t('I18n.k5'),
  'nav.orders': i18n.t('I18n.k6'),
  'nav.risk': i18n.t('I18n.k7'),
  'nav.settings': i18n.t('I18n.k8'),
  // Common
  'common.save': i18n.t('I18n.k9'),
  'common.cancel': i18n.t('I18n.k10'),
  'common.delete': i18n.t('I18n.k11'),
  'common.edit': i18n.t('I18n.k12'),
  'common.create': i18n.t('I18n.k13'),
  'common.loading': i18n.t('I18n.k14'),
  'common.confirm': i18n.t('I18n.k15'),
  'common.back': i18n.t('I18n.k16'),
  'common.refresh': i18n.t('I18n.k17'),
  'common.export': i18n.t('I18n.k18'),
  'common.search': i18n.t('I18n.k19'),
  'common.noData': i18n.t('I18n.k20'),
  // Market
  'market.title': i18n.t('I18n.k21'),
  'market.watchlist': i18n.t('I18n.k22'),
  'market.addWatch': i18n.t('I18n.k23'),
  'market.removeWatch': i18n.t('I18n.k24'),
  'market.price': i18n.t('I18n.k25'),
  'market.change': i18n.t('I18n.k26'),
  'market.changePct': i18n.t('I18n.k27'),
  'market.volume': i18n.t('I18n.k28'),
  // Strategy
  'strategy.title': i18n.t('I18n.k29'),
  'strategy.create': i18n.t('I18n.k30'),
  'strategy.backtest': i18n.t('I18n.k31'),
  'strategy.live': i18n.t('I18n.k32'),
  'strategy.stop': i18n.t('I18n.k33'),
  'strategy.ai': i18n.t('I18n.k34'),
  'strategy.template': i18n.t('I18n.k35'),
  'strategy.form': i18n.t('I18n.k36'),
  // Portfolio
  'portfolio.title': i18n.t('I18n.k37'),
  'portfolio.totalAssets': i18n.t('I18n.k38'),
  'portfolio.todayPnl': i18n.t('I18n.k39'),
  'portfolio.marketValue': i18n.t('I18n.k40'),
  'portfolio.available': i18n.t('I18n.k41'),
  // Settings
  'settings.title': i18n.t('I18n.k42'),
  'settings.connection': i18n.t('I18n.k43'),
  'settings.risk': i18n.t('I18n.k44'),
  'settings.language': i18n.t('I18n.k45'),
  'settings.theme': i18n.t('I18n.k46'),
  // Risk
  'risk.maxDailyLoss': i18n.t('I18n.k47'),
  'risk.maxPosition': i18n.t('I18n.k48'),
  'risk.maxTotalPosition': i18n.t('I18n.k49'),
  'risk.maxOrdersPerMin': i18n.t('I18n.k50'),
  // Status
  'status.connected': i18n.t('I18n.k51'),
  'status.disconnected': i18n.t('I18n.k52'),
  'status.connecting': i18n.t('I18n.k53'),
  // Onboarding
  'onboarding.welcome': i18n.t('I18n.k54'),
  'onboarding.connect': i18n.t('I18n.k55'),
  'onboarding.firstStrategy': i18n.t('I18n.k56'),
  'onboarding.start': i18n.t('I18n.k57'),
};

const en: Record<string, string> = {
  'nav.market': 'Market',
  'nav.strategy': 'Strategy Lab',
  'nav.marketplace': 'Marketplace',
  'nav.live': 'Live Monitor',
  'nav.backtest': 'Backtest Report',
  'nav.portfolio': 'Portfolio',
  'nav.orders': 'Orders',
  'nav.risk': 'Risk Settings',
  'nav.settings': 'Settings',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.loading': 'Loading...',
  'common.confirm': 'Confirm',
  'common.back': 'Back',
  'common.refresh': 'Refresh',
  'common.export': 'Export',
  'common.search': 'Search',
  'common.noData': 'No data',
  'market.title': 'Market Center',
  'market.watchlist': 'Watchlist',
  'market.addWatch': 'Add to Watchlist',
  'market.removeWatch': 'Remove',
  'market.price': 'Price',
  'market.change': 'Change',
  'market.changePct': 'Change %',
  'market.volume': 'Volume',
  'strategy.title': 'Strategy Lab',
  'strategy.create': 'Create Strategy',
  'strategy.backtest': 'Backtest',
  'strategy.live': 'Live',
  'strategy.stop': 'Stop',
  'strategy.ai': 'Describe',
  'strategy.template': 'Templates',
  'strategy.form': 'Form',
  'portfolio.title': 'Portfolio',
  'portfolio.totalAssets': 'Total Assets',
  'portfolio.todayPnl': 'Today P&L',
  'portfolio.marketValue': 'Market Value',
  'portfolio.available': 'Available Cash',
  'settings.title': 'Settings',
  'settings.connection': 'OpenD Connection',
  'settings.risk': 'Risk Parameters',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'risk.maxDailyLoss': 'Max Daily Loss',
  'risk.maxPosition': 'Max Position per Stock',
  'risk.maxTotalPosition': 'Max Total Position',
  'risk.maxOrdersPerMin': 'Max Orders per Minute',
  'status.connected': 'Connected',
  'status.disconnected': 'Disconnected',
  'status.connecting': 'Connecting...',
  'onboarding.welcome': 'Welcome to Dawn Whales',
  'onboarding.connect': 'Connect Futu OpenD',
  'onboarding.firstStrategy': 'Create your first strategy',
  'onboarding.start': 'Get Started',
};

const ja: Record<string, string> = {
  'nav.market': 'マーケット',
  'nav.strategy': i18n.t('I18n.k58'),
  'nav.marketplace': 'マーケットプレイス',
  'nav.live': 'ライブモニター',
  'nav.backtest': 'バックテスト',
  'nav.portfolio': 'ポートフォリオ',
  'nav.orders': i18n.t('I18n.k59'),
  'nav.risk': i18n.t('I18n.k60'),
  'nav.settings': i18n.t('I18n.k61'),
  'common.save': i18n.t('I18n.k62'),
  'common.cancel': 'キャンセル',
  'common.delete': i18n.t('I18n.k63'),
  'common.edit': i18n.t('I18n.k64'),
  'common.create': i18n.t('I18n.k65'),
  'common.loading': i18n.t('I18n.k66'),
  'common.confirm': i18n.t('I18n.k67'),
  'common.back': i18n.t('I18n.k68'),
  'common.refresh': i18n.t('I18n.k69'),
  'common.export': 'エクスポート',
  'common.search': i18n.t('I18n.k70'),
  'common.noData': 'データなし',
  'market.title': 'マーケットセンター',
  'market.watchlist': 'ウォッチリスト',
  'market.addWatch': i18n.t('I18n.k71'),
  'market.removeWatch': i18n.t('I18n.k72'),
  'market.price': i18n.t('I18n.k73'),
  'market.change': i18n.t('I18n.k74'),
  'market.changePct': i18n.t('I18n.k75'),
  'market.volume': i18n.t('I18n.k76'),
  'strategy.title': i18n.t('I18n.k77'),
  'strategy.create': i18n.t('I18n.k78'),
  'strategy.backtest': 'バックテスト',
  'strategy.live': 'ライブ',
  'strategy.stop': i18n.t('I18n.k79'),
  'strategy.ai': i18n.t('I18n.k80'),
  'strategy.template': 'テンプレート',
  'strategy.form': 'フォーム',
  'portfolio.title': 'ポートフォリオ',
  'portfolio.totalAssets': i18n.t('I18n.k81'),
  'portfolio.todayPnl': i18n.t('I18n.k82'),
  'portfolio.marketValue': i18n.t('I18n.k83'),
  'portfolio.available': i18n.t('I18n.k84'),
  'settings.title': i18n.t('I18n.k85'),
  'settings.connection': i18n.t('I18n.k86'),
  'settings.risk': i18n.t('I18n.k87'),
  'settings.language': i18n.t('I18n.k88'),
  'settings.theme': 'テーマ',
  'risk.maxDailyLoss': i18n.t('I18n.k89'),
  'risk.maxPosition': i18n.t('I18n.k90'),
  'risk.maxTotalPosition': i18n.t('I18n.k91'),
  'risk.maxOrdersPerMin': i18n.t('I18n.k92'),
  'status.connected': i18n.t('I18n.k93'),
  'status.disconnected': i18n.t('I18n.k94'),
  'status.connecting': i18n.t('I18n.k95'),
  'onboarding.welcome': 'Dawn Whales へようこそ',
  'onboarding.connect': i18n.t('I18n.k96'),
  'onboarding.firstStrategy': i18n.t('I18n.k97'),
  'onboarding.start': i18n.t('I18n.k98'),
};

const dictionaries: Record<Locale, Record<string, string>> = { zh, en, ja };

// ── Store ─────────────────────────────────────────────────────────────────

export const useI18nStore = create<I18nStore>((set, get) => ({
  locale: (localStorage.getItem('dw_locale') as Locale) || 'zh',

  setLocale: (locale: Locale) => {
    localStorage.setItem('dw_locale', locale);
    set({ locale });
  },

  t: (key: string, params?: Record<string, string | number>) => {
    const dict = dictionaries[get().locale] || zh;
    let text = dict[key] || zh[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  },
}));

// Convenience hook
export function useT() {
  return useI18nStore((s) => s.t);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: i18n.t('I18n.k99'),
  en: 'English',
  ja: i18n.t('I18n.k100'),
};
