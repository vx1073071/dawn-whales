/**
 * i18n Provider + LanguageSelector
 * (ML-42-03, R42 Phase 6.0)
 *
 * Integrates existing i18n-data.ts (12,895L) into the app.
 * Features:
 * - React context with zh/en toggle
 * - LanguageSelector dropdown (Header-compatible)
 * - useI18n hook for all components
 * - LocalStorage persistence
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

type Locale = 'zh' | 'zh-HK' | 'en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
  formatNumber: (n: number, decimals?: number) => string;
  formatCurrency: (n: number, currency?: string) => string;
  formatPercent: (n: number, decimals?: number) => string;
  formatDate: (d: Date | number, format?: 'short' | 'long') => string;
}

// ── Translation maps (extracted from i18n-data.ts subset) ───────────────

const ZH: Record<string, string> = {
  // Navigation
  'nav.dashboard': '仪表盘',
  'nav.strategy': '策略',
  'nav.market': '行情',
  'nav.portfolio': '持仓',
  'nav.orders': '订单',
  'nav.backtest': '回测',
  'nav.marketplace': '策略市场',
  'nav.settings': '设置',
  'nav.risk': '风险管理',

  // Dashboard
  'dashboard.title': '仪表盘',
  'dashboard.total_assets': '总资产',
  'dashboard.today_pnl': '今日盈亏',
  'dashboard.total_pnl': '累计盈亏',
  'dashboard.win_rate': '胜率',
  'dashboard.sharpe': '夏普比率',
  'dashboard.max_drawdown': '最大回撤',

  // Strategy
  'strategy.create': '创建策略',
  'strategy.optimize': '参数优化',
  'strategy.backtest': '回测',
  'strategy.publish': '发布策略',
  'strategy.import': '导入策略',
  'strategy.export': '导出策略',

  // Orders
  'order.buy': '买入',
  'order.sell': '卖出',
  'order.pending': '待处理',
  'order.filled': '已成交',
  'order.cancelled': '已取消',
  'order.rejected': '已拒绝',

  // Market
  'market.search': '搜索股票',
  'market.watchlist': '自选股',
  'market.hot': '热门',
  'market.indices': '指数',

  // Common
  'common.confirm': '确认',
  'common.cancel': '取消',
  'common.save': '保存',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.loading': '加载中...',
  'common.error': '错误',
  'common.success': '成功',
  'common.no_data': '暂无数据',
  'common.refresh': '刷新',
  'common.settings': '设置',
  'common.logout': '退出',
  'common.language': '语言',

  // Risk
  'risk.var': '风险价值',
  'risk.cvar': '条件风险价值',
  'risk.stress_test': '压力测试',
  'risk.correlation': '相关性矩阵',

  // Time periods
  'time.1m': '1分钟',
  'time.5m': '5分钟',
  'time.15m': '15分钟',
  'time.30m': '30分钟',
  'time.1h': '1小时',
  'time.4h': '4小时',
  'time.1d': '日线',
  'time.1w': '周线',

  // Status
  'status.connected': '已连接',
  'status.disconnected': '未连接',
  'status.running': '运行中',
  'status.stopped': '已停止',
  'status.error': '错误',

  // Phase 5.0
  'phase5.optimizer': '策略优化器',
  'phase5.multitimeframe': '多周期引擎',
  'phase5.portfolio_risk': '组合风险引擎',
  'phase5.live_trading': '实盘交易',
  'phase5.walkforward': '前向分析',
  'phase5.marketplace': '策略市场',
  'phase5.multisource': '多源数据',
};

const EN: Record<string, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.strategy': 'Strategy',
  'nav.market': 'Market',
  'nav.portfolio': 'Portfolio',
  'nav.orders': 'Orders',
  'nav.backtest': 'Backtest',
  'nav.marketplace': 'Marketplace',
  'nav.settings': 'Settings',
  'nav.risk': 'Risk',

  'dashboard.title': 'Dashboard',
  'dashboard.total_assets': 'Total Assets',
  'dashboard.today_pnl': 'Today P&L',
  'dashboard.total_pnl': 'Total P&L',
  'dashboard.win_rate': 'Win Rate',
  'dashboard.sharpe': 'Sharpe',
  'dashboard.max_drawdown': 'Max Drawdown',

  'strategy.create': 'Create Strategy',
  'strategy.optimize': 'Optimize',
  'strategy.backtest': 'Backtest',
  'strategy.publish': 'Publish',
  'strategy.import': 'Import',
  'strategy.export': 'Export',

  'order.buy': 'Buy',
  'order.sell': 'Sell',
  'order.pending': 'Pending',
  'order.filled': 'Filled',
  'order.cancelled': 'Cancelled',
  'order.rejected': 'Rejected',

  'market.search': 'Search',
  'market.watchlist': 'Watchlist',
  'market.hot': 'Hot',
  'market.indices': 'Indices',

  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.no_data': 'No Data',
  'common.refresh': 'Refresh',
  'common.settings': 'Settings',
  'common.logout': 'Logout',
  'common.language': 'Language',

  'risk.var': 'VaR',
  'risk.cvar': 'CVaR',
  'risk.stress_test': 'Stress Test',
  'risk.correlation': 'Correlation',

  'time.1m': '1min',
  'time.5m': '5min',
  'time.15m': '15min',
  'time.30m': '30min',
  'time.1h': '1H',
  'time.4h': '4H',
  'time.1d': 'Daily',
  'time.1w': 'Weekly',

  'status.connected': 'Connected',
  'status.disconnected': 'Disconnected',
  'status.running': 'Running',
  'status.stopped': 'Stopped',
  'status.error': 'Error',

  'phase5.optimizer': 'Strategy Optimizer',
  'phase5.multitimeframe': 'Multi-Timeframe',
  'phase5.portfolio_risk': 'Portfolio Risk',
  'phase5.live_trading': 'Live Trading',
  'phase5.walkforward': 'Walk-Forward',
  'phase5.marketplace': 'Marketplace',
  'phase5.multisource': 'Multi-Source',
};

const ZH_HK: Record<string, string> = ZH;
const translations: Record<Locale, Record<string, string>> = { zh: ZH, 'zh-HK': ZH_HK, en: EN };

// ── Context ─────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | null>(null);

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

// ── Provider ────────────────────────────────────────────────────────────

interface I18nProviderProps {
  children: React.ReactNode;
  defaultLocale?: Locale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children, defaultLocale = 'zh' }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem('dawn-whales-locale');
      if (saved === 'zh' || saved === 'en') return saved;
    } catch {}
    return defaultLocale;
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('dawn-whales-locale', l); } catch {}
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    const lang = locale === 'zh-HK' ? 'zh' : locale;
    return translations[lang]?.[key] ?? fallback ?? key;
  }, [locale]);

  const formatNumber = useCallback((n: number, decimals = 0): string => {
    if (locale === 'zh-HK') return n.toLocaleString('zh-HK', { maximumFractionDigits: decimals });
    return locale === 'zh'
      ? n.toLocaleString('zh-CN', { maximumFractionDigits: decimals })
      : n.toLocaleString('en-US', { maximumFractionDigits: decimals });
  }, [locale]);

  const formatCurrency = useCallback((n: number, currency = 'HKD'): string => {
    if (locale === 'zh-HK') return `${currency} ${n.toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return locale === 'zh'
      ? `${currency} ${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [locale]);

  const formatPercent = useCallback((n: number, decimals = 1): string => {
    const sign = n >= 0 ? '+' : '';
    const formatted = (n * 100).toFixed(decimals);
    return `${sign}${formatted}%`;
  }, []);

  const formatDate = useCallback((d: Date | number, format: 'short' | 'long' = 'short'): string => {
    const date = d instanceof Date ? d : new Date(d);
    const opts: Intl.DateTimeFormatOptions = format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { month: '2-digit', day: '2-digit' };
    const dateLocale = locale === 'zh-HK' ? 'zh-HK' : locale === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleDateString(dateLocale, opts);
  }, [locale]);

  const value = useMemo((): I18nContextValue => ({
    locale, setLocale, t, formatNumber, formatCurrency, formatPercent, formatDate,
  }), [locale, setLocale, t, formatNumber, formatCurrency, formatPercent, formatDate]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

// ── LanguageSelector Component ──────────────────────────────────────────

interface LanguageSelectorProps {
  className?: string;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className, compact = false }) => {
  const { locale, setLocale } = useI18n();

  return (
    <div className={`flex items-center ${className ?? ''}`}>
      {compact ? (
        <button
          onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
          className="px-2 py-1 bg-gray-800/60 border border-gray-700/50 rounded text-xs text-gray-400 hover:text-gray-200"
          title={locale === 'zh' ? 'Switch to English' : '切换中文'}
        >
          {locale === 'zh' ? 'EN' : '中'}
        </button>
      ) : (
        <div className="flex bg-gray-800/40 rounded-lg p-0.5">
          <button
            onClick={() => setLocale('zh')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              locale === 'zh'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              locale === 'en'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            EN
          </button>
        </div>
      )}
    </div>
  );
};

export default I18nProvider;
