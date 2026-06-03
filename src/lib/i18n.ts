// ── DAWN WHALES — Internationalization (i18n) ──────────────────────────────
import { create } from 'zustand';

export type Locale = 'zh' | 'en' | 'ja';

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ── Translation dictionaries ──────────────────────────────────────────────

const zh: Record<string, string> = {
  // Navigation
  'nav.market': '行情中心',
  'nav.strategy': '策略工坊',
  'nav.marketplace': '策略市场',
  'nav.live': '实盘监控',
  'nav.backtest': '回测报告',
  'nav.portfolio': '持仓管理',
  'nav.orders': '委托订单',
  'nav.risk': '风控设置',
  'nav.settings': '系统设置',
  // Common
  'common.save': '保存',
  'common.cancel': '取消',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.create': '创建',
  'common.loading': '加载中...',
  'common.confirm': '确认',
  'common.back': '返回',
  'common.refresh': '刷新',
  'common.export': '导出',
  'common.search': '搜索',
  'common.noData': '暂无数据',
  // Market
  'market.title': '行情中心',
  'market.watchlist': '自选股',
  'market.addWatch': '添加自选',
  'market.removeWatch': '移出自选',
  'market.price': '价格',
  'market.change': '涨跌额',
  'market.changePct': '涨跌幅',
  'market.volume': '成交量',
  // Strategy
  'strategy.title': '策略工坊',
  'strategy.create': '创建策略',
  'strategy.backtest': '回测',
  'strategy.live': '实盘',
  'strategy.stop': '停止',
  'strategy.ai': '说出来',
  'strategy.template': '选模板',
  'strategy.form': '填表单',
  // Portfolio
  'portfolio.title': '持仓管理',
  'portfolio.totalAssets': '总资产',
  'portfolio.todayPnl': '今日盈亏',
  'portfolio.marketValue': '持仓市值',
  'portfolio.available': '可用资金',
  // Settings
  'settings.title': '系统设置',
  'settings.connection': 'OpenD 连接',
  'settings.risk': '风控参数',
  'settings.language': '语言',
  'settings.theme': '主题',
  // Risk
  'risk.maxDailyLoss': '日最大亏损',
  'risk.maxPosition': '单品种最大仓位',
  'risk.maxTotalPosition': '总持仓上限',
  'risk.maxOrdersPerMin': '每分钟最大下单',
  // Status
  'status.connected': '已连接',
  'status.disconnected': '未连接',
  'status.connecting': '连接中...',
  // Onboarding
  'onboarding.welcome': '欢迎使用道鲸',
  'onboarding.connect': '连接富途 OpenD',
  'onboarding.firstStrategy': '创建你的第一个策略',
  'onboarding.start': '开始使用',
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
  'nav.strategy': '戦略ラボ',
  'nav.marketplace': 'マーケットプレイス',
  'nav.live': 'ライブモニター',
  'nav.backtest': 'バックテスト',
  'nav.portfolio': 'ポートフォリオ',
  'nav.orders': '注文管理',
  'nav.risk': 'リスク管理',
  'nav.settings': '設定',
  'common.save': '保存',
  'common.cancel': 'キャンセル',
  'common.delete': '削除',
  'common.edit': '編集',
  'common.create': '作成',
  'common.loading': '読み込み中...',
  'common.confirm': '確認',
  'common.back': '戻る',
  'common.refresh': '更新',
  'common.export': 'エクスポート',
  'common.search': '検索',
  'common.noData': 'データなし',
  'market.title': 'マーケットセンター',
  'market.watchlist': 'ウォッチリスト',
  'market.addWatch': 'ウォッチリストに追加',
  'market.removeWatch': '削除',
  'market.price': '価格',
  'market.change': '変動',
  'market.changePct': '変動率',
  'market.volume': '出来高',
  'strategy.title': '戦略ラボ',
  'strategy.create': '戦略作成',
  'strategy.backtest': 'バックテスト',
  'strategy.live': 'ライブ',
  'strategy.stop': '停止',
  'strategy.ai': 'AI 入力',
  'strategy.template': 'テンプレート',
  'strategy.form': 'フォーム',
  'portfolio.title': 'ポートフォリオ',
  'portfolio.totalAssets': '総資産',
  'portfolio.todayPnl': '本日損益',
  'portfolio.marketValue': '時価総額',
  'portfolio.available': '利用可能資金',
  'settings.title': '設定',
  'settings.connection': 'OpenD 接続',
  'settings.risk': 'リスク設定',
  'settings.language': '言語',
  'settings.theme': 'テーマ',
  'risk.maxDailyLoss': '日次最大損失',
  'risk.maxPosition': '単一銘柄最大ポジション',
  'risk.maxTotalPosition': '総ポジション上限',
  'risk.maxOrdersPerMin': '1分あたり最大注文数',
  'status.connected': '接続済み',
  'status.disconnected': '未接続',
  'status.connecting': '接続中...',
  'onboarding.welcome': 'Dawn Whales へようこそ',
  'onboarding.connect': 'Futu OpenD に接続',
  'onboarding.firstStrategy': '最初の戦略を作成',
  'onboarding.start': '始める',
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
  zh: '中文',
  en: 'English',
  ja: '日本語',
};
