// @ts-nocheck
// R235 ML#2: EmptyState system — 12 guided empty states with CTA buttons
// Replaces blank screens with helpful onboarding prompts
import React from 'react';

export interface EmptyStateProps {
  type: 'no-strategies' | 'no-factors' | 'no-orders' | 'no-data' | 'no-results' | 
        'no-alerts' | 'no-brokers' | 'no-wallet' | 'no-signals' | 'no-backtests' | 
        'error-loading' | 'offline';
  onAction?: () => void;
  actionLabel?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
  className?: string;
  compact?: boolean;
}

const EMPTY_CONFIGS: Record<string, { icon: string; title: string; description: string; actionLabel: string }> = {
  'no-strategies': {
    icon: '🎯', title: 'No Strategies Yet',
    description: 'Create your first trading strategy to get started. Choose from templates or build from scratch.',
    actionLabel: 'Create Strategy',
  },
  'no-factors': {
    icon: '📊', title: 'No Factors Selected',
    description: 'Add factors to power your strategy. Browse 240+ factors across 16 categories.',
    actionLabel: 'Browse Factors',
  },
  'no-orders': {
    icon: '💹', title: 'No Orders',
    description: 'Your order history will appear here once you start trading.',
    actionLabel: 'Place Order',
  },
  'no-data': {
    icon: '📡', title: 'No Market Data',
    description: 'Connect a broker or select a market to view real-time data.',
    actionLabel: 'Connect Broker',
  },
  'no-results': {
    icon: '🔍', title: 'No Results Found',
    description: 'Try adjusting your search terms or filters.',
    actionLabel: 'Clear Filters',
  },
  'no-alerts': {
    icon: '🔔', title: 'No Alerts',
    description: 'Set up price alerts to get notified when conditions are met.',
    actionLabel: 'Create Alert',
  },
  'no-brokers': {
    icon: '🏦', title: 'No Brokers Connected',
    description: 'Connect a broker to start trading. We support 13+ brokers including crypto exchanges.',
    actionLabel: 'Connect Broker',
  },
  'no-wallet': {
    icon: '👛', title: 'No Wallet',
    description: 'Set up your USDT wallet to make deposits and start trading.',
    actionLabel: 'Setup Wallet',
  },
  'no-signals': {
    icon: '📶', title: 'No Trading Signals',
    description: 'Subscribe to strategy signals or create your own to receive trade alerts.',
    actionLabel: 'Browse Signals',
  },
  'no-backtests': {
    icon: '⏮️', title: 'No Backtests',
    description: 'Run a backtest to evaluate your strategy\'s historical performance.',
    actionLabel: 'Run Backtest',
  },
  'error-loading': {
    icon: '⚠️', title: 'Failed to Load',
    description: 'Something went wrong loading this content. Please try again.',
    actionLabel: 'Retry',
  },
  'offline': {
    icon: '🌐', title: 'You\'re Offline',
    description: 'Check your internet connection and try again.',
    actionLabel: 'Retry',
  },
};

export default function EmptyState({
  type, onAction, actionLabel, secondaryAction, secondaryLabel, className = '', compact = false,
}: EmptyStateProps) {
  const config = EMPTY_CONFIGS[type] || EMPTY_CONFIGS['no-data'];
  const size = compact ? { pad: 20, iconSize: 36, titleSize: 15, descSize: 12, btnSize: 12 } 
                        : { pad: 40, iconSize: 56, titleSize: 18, descSize: 13, btnSize: 14 };
  
  return React.createElement('div', {
    className: `empty-state ${className}`,
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: size.pad, textAlign: 'center', minHeight: compact ? 150 : 250,
    },
  }, [
    React.createElement('div', { key: 'icon', style: { fontSize: size.iconSize, marginBottom: 12 } }, config.icon),
    React.createElement('h3', { key: 'title', style: { fontSize: size.titleSize, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', margin: '0 0 8px' } }, config.title),
    React.createElement('p', { key: 'desc', style: { fontSize: size.descSize, color: 'var(--text-secondary, #94a3b8)', maxWidth: 380, margin: '0 0 20px', lineHeight: 1.5 } }, config.description),
    React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' } }, [
      onAction && React.createElement('button', {
        key: 'primary', onClick: onAction,
        style: {
          padding: `${compact ? 6 : 8}px ${compact ? 14 : 20}px`, borderRadius: 8, border: 'none',
          background: 'var(--brand, #d4a574)', color: '#000',
          fontSize: size.btnSize, fontWeight: 500, cursor: 'pointer',
        },
      }, actionLabel || config.actionLabel),
      secondaryAction && secondaryLabel && React.createElement('button', {
        key: 'secondary', onClick: secondaryAction,
        style: {
          padding: `${compact ? 6 : 8}px ${compact ? 14 : 20}px`, borderRadius: 8,
          border: '1px solid var(--border-color, #334155)',
          background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
          fontSize: size.btnSize, cursor: 'pointer',
        },
      }, secondaryLabel),
    ]),
  ]);
}

// ── Convenience wrapper: Auto-show skeleton or empty state ──────────
export interface LoadedContentProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyType: EmptyStateProps['type'];
  skeletonType?: 'dashboard' | 'strategy' | 'factor' | 'portfolio' | 'settings';
  children: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  error?: Error | null;
}

export function LoadedContent({
  isLoading, isEmpty, emptyType, skeletonType = 'dashboard',
  children, onAction, actionLabel, error,
}: LoadedContentProps) {
  if (error) {
    return React.createElement(EmptyState, { type: 'error-loading', onAction, actionLabel: 'Retry' });
  }
  if (isLoading) {
    const { FullPageSkeleton, injectSkeletonStyles } = require('./SkeletonSystem');
    injectSkeletonStyles();
    return React.createElement(FullPageSkeleton, { type: skeletonType });
  }
  if (isEmpty) {
    return React.createElement(EmptyState, { type: emptyType, onAction, actionLabel });
  }
  return React.createElement(React.Fragment, null, children);
}
