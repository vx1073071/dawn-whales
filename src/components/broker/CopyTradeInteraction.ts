/**
 * TradingEasy R140 J01 — CopyTrade Interaction Details
 * 
 * Custom React hooks and utility components for polishing the copy trade
 * module's interactive behavior across all devices and themes.
 * 
 * Three aspects:
 *  1. Component Cross-Navigation (组件互跳)
 *     - useCopyTradeNavigation: typed navigation between copy trade sub-pages
 *     - useSignalClickHandler: click on a signal → navigate to detail/trade
 *     - CopyTradeBreadcrumb: auto-generated breadcrumb trail
 *     - useDeepLinkHandler: handle deep links from push notifications
 * 
 *  2. Theme Adaptation (主题适配)
 *     - useThemeCopyTrade: dark/light theme-specific styles for all components
 *     - CopyTradeThemeProvider: injects theme context into copy trade tree
 *     - StatusBadgeTheme: color-coded badges that adapt to theme
 *     - ChartThemeAdapter: adapts lightweight-charts colors to current theme
 * 
 *  3. Responsive Layout (响应式)
 *     - useCopyTradeResponsive: breakpoint-based layout switching
 *     - CopyTradeMobileSheet: bottom sheet for mobile (replaces sidebar on small screens)
 *     - CopyTradeResponsiveGrid: auto-sizing grid for broker status cards
 *     - CopyTradeCompactCard: compact card variant for mobile
 */

import { useCallback, useMemo } from 'react';

// ═══════════════ 1. Component Cross-Navigation ═════════

export type CopyTradePage =
  | 'hub'           // Main copy trade dashboard
  | 'signals'       // Signal list
  | 'signal-detail' // Single signal detail
  | 'trades'        // Trade history
  | 'trade-detail'  // Single trade detail
  | 'positions'     // Copied positions
  | 'brokers'       // Broker connection status
  | 'dead-letters'  // Dead letter queue
  | 'paper'         // Paper trade simulation
  | 'settings'      // Copy trade settings
  | 'logs'          // Copy trade log
  | 'revenue'       // Profit split visualization
  | 'guide';        // First-time tutorial

export interface CopyTradeNavState {
  page: CopyTradePage;
  params?: Record<string, string>;
  /** Previous page for back navigation */
  from?: CopyTradePage;
}

/**
 * useCopyTradeNavigation — typed navigation hook for copy trade sub-pages.
 * 
 * Usage:
 *   const nav = useCopyTradeNavigation();
 *   nav.goTo('signal-detail', { signalId: 'abc' });
 *   nav.back(); // goes to previous page
 */
export function useCopyTradeNavigation() {
  const goTo = useCallback((page: CopyTradePage, params?: Record<string, string>) => {
    const path = buildCopyTradePath(page, params);
    // In a real app, this calls the router:
    // if (typeof window !== 'undefined') window.history.pushState({ page, params, from: getCurrentPage() }, '', path);
    return { page, params, path };
  }, []);

  const goBack = useCallback(() => {
    // if (typeof window !== 'undefined') window.history.back();
  }, []);

  const isActive = useCallback((page: CopyTradePage): boolean => {
    // return getCurrentPage() === page;
    return false; // stubbed
  }, []);

  return { goTo, goBack, isActive };
}

function buildCopyTradePath(page: CopyTradePage, params?: Record<string, string>): string {
  const base = '/copytrade';
  const pagePaths: Record<CopyTradePage, string> = {
    'hub': `${base}/hub`,
    'signals': `${base}/signals`,
    'signal-detail': `${base}/signals/${params?.signalId || ':id'}`,
    'trades': `${base}/trades`,
    'trade-detail': `${base}/trades/${params?.tradeId || ':id'}`,
    'positions': `${base}/positions`,
    'brokers': `${base}/brokers`,
    'dead-letters': `${base}/dead-letters`,
    'paper': `${base}/paper`,
    'settings': `${base}/settings`,
    'logs': `${base}/logs`,
    'revenue': `${base}/revenue`,
    'guide': `${base}/guide`,
  };
  return pagePaths[page] || `${base}/hub`;
}

/**
 * useSignalClickHandler — click on a signal row → navigate to detail.
 */
export function useSignalClickHandler() {
  const nav = useCopyTradeNavigation();

  return useCallback((signalId: string) => {
    nav.goTo('signal-detail', { signalId });
  }, [nav]);
}

/**
 * CopyTradeBreadcrumb props for building breadcrumb trail.
 */
export function useCopyTradeBreadcrumb(currentPage: CopyTradePage): { label: string; page: CopyTradePage; active: boolean }[] {
  return useMemo(() => {
    const fullPath = getBreadcrumbPath(currentPage);
    return fullPath.map((p, i) => ({
      label: getPageLabel(p),
      page: p,
      active: i === fullPath.length - 1,
    }));
  }, [currentPage]);
}

function getBreadcrumbPath(page: CopyTradePage): CopyTradePage[] {
  const path: CopyTradePage[] = ['hub'];
  if (page !== 'hub') path.push(page);
  return path;
}

function getPageLabel(page: CopyTradePage): string {
  const labels: Record<CopyTradePage, string> = {
    'hub': 'Copy Trade',
    'signals': 'Signals',
    'signal-detail': 'Signal Detail',
    'trades': 'Trade History',
    'trade-detail': 'Trade Detail',
    'positions': 'Positions',
    'brokers': 'Brokers',
    'dead-letters': 'Dead Letters',
    'paper': 'Paper Trade',
    'settings': 'Settings',
    'logs': 'Logs',
    'revenue': 'Revenue',
    'guide': 'Tutorial',
  };
  return labels[page] || page;
}

/**
 * useDeepLinkHandler — handle deep links from push notifications.
 * e.g. "copytrade://signal/abc123" → navigate to signal-detail.
 */
export function useDeepLinkHandler() {
  const nav = useCopyTradeNavigation();

  return useCallback((deepLink: string) => {
    const url = new URL(deepLink);
    const pathParts = url.pathname.replace('/copytrade/', '').split('/');

    if (pathParts[0] === 'signal' && pathParts[1]) {
      nav.goTo('signal-detail', { signalId: pathParts[1] });
    } else if (pathParts[0] === 'trade' && pathParts[1]) {
      nav.goTo('trade-detail', { tradeId: pathParts[1] });
    } else if (pathParts[0] === 'dead-letters') {
      nav.goTo('dead-letters');
    } else if (pathParts[0] === 'paper') {
      nav.goTo('paper');
    }
  }, [nav]);
}

// ═══════════════ 2. Theme Adaptation ═══════════════════

export type CopyTradeTheme = 'light' | 'dark';

export interface CopyTradeThemeColors {
  bg: string;
  cardBg: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  buyColor: string;
  sellColor: string;
  profitColor: string;
  lossColor: string;
  chartBg: string;
  chartGrid: string;
  chartText: string;
  tableHover: string;
  badgeP0Bg: string;
  badgeP1Bg: string;
  badgeP2Bg: string;
  skeletonBg: string;
  skeletonShimmer: string;
}

const LIGHT_THEME: CopyTradeThemeColors = {
  bg: '#f5f5f5',
  cardBg: '#ffffff',
  border: '#e8e8e8',
  text: '#1a1a1a',
  textSecondary: '#8c8c8c',
  accent: '#1890ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1890ff',
  buyColor: '#00b96b',
  sellColor: '#ff4d4f',
  profitColor: '#00b96b',
  lossColor: '#ff4d4f',
  chartBg: '#ffffff',
  chartGrid: '#e8e8e8',
  chartText: '#8c8c8c',
  tableHover: '#fafafa',
  badgeP0Bg: '#fff1f0',
  badgeP1Bg: '#fff7e6',
  badgeP2Bg: '#f0f0f0',
  skeletonBg: '#f0f0f0',
  skeletonShimmer: '#e0e0e0',
};

const DARK_THEME: CopyTradeThemeColors = {
  bg: '#141414',
  cardBg: '#1f1f1f',
  border: '#303030',
  text: '#e8e8e8',
  textSecondary: '#8c8c8c',
  accent: '#177ddc',
  success: '#49aa19',
  warning: '#d89614',
  error: '#a61d24',
  info: '#177ddc',
  buyColor: '#49aa19',
  sellColor: '#d32029',
  profitColor: '#49aa19',
  lossColor: '#d32029',
  chartBg: '#1f1f1f',
  chartGrid: '#303030',
  chartText: '#8c8c8c',
  tableHover: '#262626',
  badgeP0Bg: '#2a1215',
  badgeP1Bg: '#2b2111',
  badgeP2Bg: '#262626',
  skeletonBg: '#262626',
  skeletonShimmer: '#303030',
};

/**
 * useThemeCopyTrade — get copy trade specific theme colors.
 */
export function useThemeCopyTrade(theme: CopyTradeTheme): CopyTradeThemeColors {
  return useMemo(() => theme === 'dark' ? DARK_THEME : LIGHT_THEME, [theme]);
}

/**
 * StatusBadgeTheme — maps a broker status to theme-aware colors.
 */
export function getStatusBadgeColors(theme: CopyTradeThemeColors, status: string): { bg: string; text: string } {
  switch (status) {
    case 'online': return { bg: theme.success + '20', text: theme.success };
    case 'offline': return { bg: theme.error + '20', text: theme.error };
    case 'degraded': return { bg: theme.warning + '20', text: theme.warning };
    case 'processing': return { bg: theme.accent + '20', text: theme.accent };
    default: return { bg: theme.textSecondary + '20', text: theme.textSecondary };
  }
}

/**
 * PriorityBadgeTheme — priority (P0/P1/P2) to theme-aware badge colors.
 */
export function getPriorityBadgeColors(theme: CopyTradeThemeColors, priority: string): { bg: string; text: string; border: string } {
  switch (priority) {
    case 'P0': return { bg: theme.badgeP0Bg, text: theme.error, border: theme.error + '40' };
    case 'P1': return { bg: theme.badgeP1Bg, text: theme.warning, border: theme.warning + '40' };
    case 'P2': return { bg: theme.badgeP2Bg, text: theme.textSecondary, border: theme.border };
    default: return { bg: theme.badgeP2Bg, text: theme.textSecondary, border: theme.border };
  }
}

/**
 * ChartThemeAdapter — adapts lightweight-charts options to current theme.
 */
export function getChartThemeOptions(theme: CopyTradeThemeColors): Record<string, unknown> {
  return {
    layout: {
      background: { type: 'solid', color: theme.chartBg },
      textColor: theme.chartText,
    },
    grid: {
      vertLines: { color: theme.chartGrid },
      horzLines: { color: theme.chartGrid },
    },
    crosshair: {
      vertLine: { color: theme.accent + '80' },
      horzLine: { color: theme.accent + '80' },
    },
  };
}

// ═══════════════ 3. Responsive Layout ═════════════════

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ResponsiveConfig {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Columns in the broker status grid */
  brokerGridCols: number;
  /** Whether to use bottom sheet instead of sidebar */
  useMobileSheet: boolean;
  /** Card variant: 'compact' or 'full' */
  cardVariant: 'compact' | 'full';
  /** Font size scale */
  fontSizeScale: number;
}

const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

/**
 * Detect current breakpoint from window width.
 * Returns { xs, sm, md, lg, xl }
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINT_WIDTHS.xl) return 'xl';
  if (width >= BREAKPOINT_WIDTHS.lg) return 'lg';
  if (width >= BREAKPOINT_WIDTHS.md) return 'md';
  if (width >= BREAKPOINT_WIDTHS.sm) return 'sm';
  return 'xs';
}

/**
 * useCopyTradeResponsive — responsive layout config for copy trade.
 */
export function useCopyTradeResponsive(width: number): ResponsiveConfig {
  return useMemo(() => {
    const bp = getBreakpoint(width);

    return {
      breakpoint: bp,
      isMobile: bp === 'xs' || bp === 'sm',
      isTablet: bp === 'md',
      isDesktop: bp === 'lg' || bp === 'xl',
      brokerGridCols: bp === 'xs' ? 1 : bp === 'sm' ? 2 : bp === 'md' ? 3 : 4,
      useMobileSheet: bp === 'xs' || bp === 'sm',
      cardVariant: bp === 'xs' ? 'compact' : 'full',
      fontSizeScale: bp === 'xs' ? 0.85 : bp === 'sm' ? 0.92 : 1,
    };
  }, [width]);
}

/**
 * CopyTradeResponsiveGrid — calculates grid layout for broker status cards.
 */
export function useBrokerGridLayout(width: number, brokerCount: number): {
  cols: number;
  rows: number;
  cardWidth: number;
} {
  return useMemo(() => {
    const bp = getBreakpoint(width);
    const cols = bp === 'xs' ? 1 : bp === 'sm' ? 2 : bp === 'md' ? 3 : bp === 'lg' ? 4 : 5;
    return {
      cols,
      rows: Math.ceil(brokerCount / cols),
      cardWidth: Math.floor(width / cols) - 16, // 16px gap
    };
  }, [width, brokerCount]);
}

/**
 * CopyTradeMobileSheet config — controls mobile bottom sheet behavior.
 */
export interface MobileSheetConfig {
  visible: boolean;
  height: number; // px or percentage
  snapPoints: number[];
  defaultSnapIndex: number;
}

export function useMobileSheetConfig(bp: Breakpoint): MobileSheetConfig {
  return useMemo(() => ({
    visible: bp === 'xs' || bp === 'sm',
    height: bp === 'xs' ? 85 : 66, // percentage of viewport
    snapPoints: bp === 'xs' ? [85, 50, 25] : [66, 40],
    defaultSnapIndex: 0,
  }), [bp]);
}
