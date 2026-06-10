/**
 * MobileNavigation — Mobile-first bottom tab navigation
 * (ML-45-02, R45 Phase 6.2)
 *
 * Shows at bottom on mobile (< 768px), hidden on desktop.
 * 5 tabs: Dashboard / Strategy / Market / Portfolio / More
 */

import { useTranslation } from "react-i18next";
import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

// ── Mobile Navigation ───────────────────────────────────────────────────

interface MobileNavigationProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: '📊', label: '仪表盘', badge: 0 },
  { id: 'strategy', icon: '🎯', label: '策略', badge: 3 },
  { id: 'market', icon: '📈', label: '行情' },
  { id: 'portfolio', icon: '💰', label: '持仓' },
  { id: 'more', icon: '⋮', label: '更多' },
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab: externalActive,
  onTabChange,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<string>(externalActive ?? 'dashboard');
  const [moreOpen, setMoreOpen] = useState(false);

  const handleTab = useCallback((id: string) => {
    if (id === 'more') {
      setMoreOpen(o => !o);
      return;
    }
    setActiveTab(id);
    onTabChange?.(id);
    setMoreOpen(false);
  }, [onTabChange]);

  const moreItems: NavItem[] = [
    { id: 'orders', icon: '📋', label: t('components.orders') },
    { id: 'backtest', icon: '🔬', label: t('components.backtest') },
    { id: 'marketplace', icon: '🏪', label: t('components.markets') },
    { id: 'settings', icon: '⚙️', label: t('components.settings') },
  ];

  return (
    <>
      {/* Bottom nav bar — mobile only */}
      <nav className={`mobile-bottom-nav bg-gray-950 border-t border-gray-800 ${className ?? ''}`}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => handleTab(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1 min-w-0 flex-1 transition-colors ${
              activeTab === item.id ? 'text-amber-400' : 'text-gray-500'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[9px] leading-none">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-0.5 right-1/4 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* More menu overlay */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          {/* Menu */}
          <div className="fixed bottom-16 left-4 right-4 bg-gray-900 border border-gray-700 rounded-xl z-50 p-3 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleTab(item.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ── Mobile touch optimizations hook ─────────────────────────────────────

export function useMobileTouchOptimizations() {
  const { t } = useTranslation();

  // Ensure minimum touch target size (44px)
  // Prevent double-tap zoom on interactive elements
  // Disable pull-to-refresh in PWA standalone mode

  const preventPullToRefresh = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && e.touches[0].clientY > 50) {
      e.preventDefault();
    }
  }, []);

  return { preventPullToRefresh };
}

export default MobileNavigation;
