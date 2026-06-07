/**
 * MobileResponsive MarketPlace — ML-53-03 [P1]
 * R53: v1.1.0-beta — Mobile-responsive enhancements for marketplace pages
 *
 * Features:
 * - Responsive grid system for marketplace cards (1/2/3 cols)
 * - Mobile-optimized navigation (bottom nav, swipe-friendly)
 * - Touch-friendly card interactions
 * - Adaptive pagination (compact on mobile)
 * - Responsive search bar with mobile overlay
 * - Responsive filter panel (drawer on mobile)
 * - Mobile-friendly publish form steps
 */

import React, { useState, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface ResponsiveConfig {
  breakpoints: {
    mobile: number;   // px
    tablet: number;   // px
    desktop: number;  // px
  };
  columns: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

export interface MobileResponsiveProps {
  config?: ResponsiveConfig;
  onBreakpointChange?: (size: ViewportSize) => void;
  className?: string;
}

// ── Hooks ────────────────────────────────────────────────────────────────

const DEFAULT_BREAKPOINTS: ResponsiveConfig = {
  breakpoints: { mobile: 640, tablet: 1024, desktop: 1440 },
  columns: { mobile: 1, tablet: 2, desktop: 3 },
};

/**
 * useResponsive — detects current viewport size via matchMedia
 */
export function useResponsive(config: ResponsiveConfig = DEFAULT_BREAKPOINTS): {
  size: ViewportSize;
  columns: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  const [size, setSize] = useState<ViewportSize>('desktop');

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < config.breakpoints.tablet) setSize('mobile');
      else if (w < config.breakpoints.desktop) setSize('tablet');
      else setSize('desktop');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [config]);

  return {
    size,
    columns: config.columns[size],
    isMobile: size === 'mobile',
    isTablet: size === 'tablet',
    isDesktop: size === 'desktop',
  };
}

// ── Responsive Container ─────────────────────────────────────────────────

interface ResponsiveContainerProps {
  children: React.ReactNode;
  config?: ResponsiveConfig;
  className?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children, config = DEFAULT_BREAKPOINTS, className = '',
}) => {
  const { size } = useResponsive(config);
  return (
    <div className={`responsive-container resp-${size} ${className}`}>
      {children}
    </div>
  );
};

// ── Mobile Drawer ────────────────────────────────────────────────────────

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right' | 'bottom';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen, onClose, position = 'bottom', title, children, className = '',
}) => {
  const posClass = {
    left: 'drawer-left',
    right: 'drawer-right',
    bottom: 'drawer-bottom',
  }[position];

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="mobile-drawer-backdrop" onClick={onClose} />}

      <div className={`mobile-drawer ${posClass} ${isOpen ? 'open' : ''} ${className}`}>
        <div className="mobile-drawer-header">
          {title && <h3 className="mobile-drawer-title">{title}</h3>}
          <button className="mobile-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="mobile-drawer-content">{children}</div>
      </div>
    </>
  );
};

// ── Responsive Search Bar ────────────────────────────────────────────────

interface ResponsiveSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

export const ResponsiveSearchBar: React.FC<ResponsiveSearchBarProps> = ({
  value, onChange, placeholder = 'Search...', suggestions = [], className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { isMobile } = useResponsive();

  return (
    <div className={`resp-search-bar ${isMobile ? 'mobile' : ''} ${isFocused ? 'focused' : ''} ${className}`}>
      <div className="resp-search-input-wrapper">
        <span className="resp-search-icon">🔍</span>
        <input
          className="resp-search-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
        />
        {value && (
          <button className="resp-search-clear" onClick={() => onChange('')}>✕</button>
        )}
      </div>

      {/* Mobile overlay */}
      {isMobile && isFocused && suggestions.length > 0 && (
        <div className="resp-search-mobile-overlay">
          <div className="resp-search-suggestions">
            {suggestions.map((s, i) => (
              <div key={i} className="resp-search-suggestion" onMouseDown={() => onChange(s)}>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desktop dropdown */}
      {!isMobile && isFocused && suggestions.length > 0 && (
        <div className="resp-search-suggestions-dropdown">
          {suggestions.map((s, i) => (
            <div key={i} className="resp-search-suggestion" onMouseDown={() => onChange(s)}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Responsive Filters Panel ─────────────────────────────────────────────

interface FilterOption {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface ResponsiveFiltersProps {
  filters: FilterOption[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  className?: string;
}

export const ResponsiveFilters: React.FC<ResponsiveFiltersProps> = ({
  filters, values, onChange, className = '',
}) => {
  const { isMobile, isTablet } = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filterContent = (
    <div className="resp-filters-list">
      {filters.map((f) => (
        <div key={f.key} className="resp-filter-item">
          <label className="resp-filter-label">{f.label}</label>
          <select
            className="resp-filter-select"
            value={values[f.key] || ''}
            onChange={(e) => onChange(f.key, e.target.value)}
          >
            <option value="">All {f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );

  // Mobile: show filter toggle button + drawer
  if (isMobile) {
    const activeCount = Object.values(values).filter((v) => v).length;
    return (
      <div className={`resp-filters-mobile ${className}`}>
        <button className="resp-filters-toggle" onClick={() => setDrawerOpen(true)}>
          Filters {activeCount > 0 && <span className="resp-filter-badge">{activeCount}</span>}
        </button>
        <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} position="bottom" title="Filters">
          {filterContent}
          <button className="resp-filters-apply" onClick={() => setDrawerOpen(false)}>
            Apply Filters
          </button>
        </MobileDrawer>
        {/* Active filter chips */}
        {activeCount > 0 && (
          <div className="resp-filter-chips">
            {filters.filter((f) => values[f.key]).map((f) => (
              <span key={f.key} className="resp-filter-chip">
                {f.label}: {f.options.find((o) => o.value === values[f.key])?.label || values[f.key]}
                <button onClick={() => onChange(f.key, '')}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Tablet/Desktop: inline filters
  return (
    <div className={`resp-filters-inline ${isTablet ? 'tablet' : 'desktop'} ${className}`}>
      {filterContent}
    </div>
  );
};

// ── Responsive Pagination ───────────────────────────────────────────────

interface ResponsivePaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export const ResponsivePagination: React.FC<ResponsivePaginationProps> = ({
  current, total, pageSize, onPageChange, onPageSizeChange, className = '',
}) => {
  const { isMobile } = useResponsive();
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  const getVisiblePages = (): (number | '...')[] => {
    const maxVisible = isMobile ? 3 : 7;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    const sideCount = Math.floor((maxVisible - 3) / 2);
    pages.push(1);
    if (current > sideCount + 2) pages.push('...');
    for (let i = Math.max(2, current - sideCount); i <= Math.min(totalPages - 1, current + sideCount); i++) {
      pages.push(i);
    }
    if (current < totalPages - sideCount - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={`resp-pagination ${isMobile ? 'mobile' : 'desktop'} ${className}`}>
      <button
        className="resp-page-btn"
        disabled={current === 1}
        onClick={() => onPageChange(current - 1)}
      >
        {isMobile ? '‹' : 'Previous'}
      </button>

      {!isMobile && getVisiblePages().map((p, i) =>
        typeof p === 'number' ? (
          <button
            key={i}
            className={`resp-page-btn ${p === current ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ) : (
          <span key={i} className="resp-page-ellipsis">...</span>
        )
      )}

      {isMobile && (
        <span className="resp-page-indicator">{current} / {totalPages}</span>
      )}

      <button
        className="resp-page-btn"
        disabled={current === totalPages}
        onClick={() => onPageChange(current + 1)}
      >
        {isMobile ? '›' : 'Next'}
      </button>

      {/* Page size selector — visible only on desktop */}
      {!isMobile && (
        <select
          className="resp-page-size-select"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[6, 12, 24, 48].map((s) => (
            <option key={s} value={s}>{s}/page</option>
          ))}
        </select>
      )}
    </div>
  );
};

// ── Responsive Card Grid ─────────────────────────────────────────────────

interface ResponsiveCardGridProps {
  children: React.ReactNode;
  config?: ResponsiveConfig;
  className?: string;
}

export const ResponsiveCardGrid: React.FC<ResponsiveCardGridProps> = ({
  children, config = DEFAULT_BREAKPOINTS, className = '',
}) => {
  const { columns } = useResponsive(config);
  return (
    <div
      className={`resp-card-grid resp-cols-${columns} ${className}`}
      style={{ '--resp-cols': columns } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

// ── Mobile Bottom Navigation ─────────────────────────────────────────────

interface MobileBottomNavProps {
  tabs: Array<{ key: string; label: string; icon: string }>;
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  tabs, active, onChange, className = '',
}) => {
  const { isMobile } = useResponsive();
  if (!isMobile) return null;

  return (
    <nav className={`mobile-bottom-nav ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`mobile-nav-item ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="mobile-nav-icon">{tab.icon}</span>
          <span className="mobile-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

// ── Adaptive Publish Form ────────────────────────────────────────────────

interface AdaptivePublishFormProps {
  steps: Array<{ key: string; title: string }>;
  currentStep: string;
  onStepChange: (step: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const AdaptivePublishForm: React.FC<AdaptivePublishFormProps> = ({
  steps, currentStep, onStepChange, children, className = '',
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={`adaptive-publish-form ${isMobile ? 'mobile' : 'desktop'} ${className}`}>
      {/* Step indicators */}
      <div className="adaptive-steps-bar">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className={`adaptive-step ${step.key === currentStep ? 'active' : ''} ${steps.findIndex((s) => s.key === currentStep) > i ? 'done' : ''}`}
            onClick={() => onStepChange(step.key)}
          >
            <div className="adaptive-step-dot">
              {steps.findIndex((s) => s.key === currentStep) > i ? '✓' : i + 1}
            </div>
            {!isMobile && <span className="adaptive-step-title">{step.title}</span>}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="adaptive-step-content">{children}</div>
    </div>
  );
};

// ── Sub-page: MobileResponsive Marketplace ───────────────────────────────

interface ResponsiveMarketplacePageProps {
  className?: string;
}

export const ResponsiveMarketplacePage: React.FC<ResponsiveMarketplacePageProps> = ({
  className = '',
}) => {
  const { isMobile: _isMobile } = useResponsive();
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [activeNav, setActiveNav] = useState('marketplace');

  const filterOptions: FilterOption[] = [
    { key: 'category', label: 'Category', options: [
      { value: 'momentum', label: 'Momentum' },
      { value: 'mean-reversion', label: 'Mean Reversion' },
      { value: 'trend-following', label: 'Trend Following' },
      { value: 'event-driven', label: 'Event Driven' },
      { value: 'macro', label: 'Macro' },
    ]},
    { key: 'market', label: 'Market', options: [
      { value: 'us', label: 'US' },
      { value: 'hk', label: 'HK' },
      { value: 'crypto', label: 'Crypto' },
      { value: 'forex', label: 'Forex' },
    ]},
    { key: 'timeframe', label: 'Timeframe', options: [
      { value: '1m', label: '1 Min' },
      { value: '1h', label: '1 Hour' },
      { value: '1d', label: 'Daily' },
      { value: '1w', label: 'Weekly' },
    ]},
    { key: 'price', label: 'Price', options: [
      { value: 'free', label: 'Free' },
      { value: 'paid', label: 'Paid' },
    ]},
  ];

  // Demo cards
  const demoCards = Array.from({ length: 9 }, (_, i) => ({
    id: `strat-${i + 1}`,
    name: `Strategy ${i + 1}`,
    author: `Trader ${i + 1}`,
    return: (Math.random() * 60 - 10).toFixed(1),
    sharpe: (Math.random() * 3 + 0.5).toFixed(2),
    subscribers: Math.floor(Math.random() * 500),
  }));

  return (
    <div className={`responsive-marketplace ${className}`}>
      {/* Responsive header / search */}
      <div className="resp-market-header">
        <ResponsiveSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search strategies, traders..."
          suggestions={['Momentum', 'Mean Reversion', 'Trend Following', 'AAPL', 'BTC']}
        />
      </div>

      {/* Responsive filters */}
      <ResponsiveFilters filters={filterOptions} values={filterValues} onChange={(k, v) => { setFilterValues({ ...filterValues, [k]: v }); setPage(1); }} />

      {/* Card grid */}
      <ResponsiveCardGrid className="resp-market-grid">
        {demoCards.map((card) => (
          <div key={card.id} className="resp-card">
            <div className="resp-card-header">
              <h3 className="resp-card-name">{card.name}</h3>
              <span className="resp-card-badge">{card.return > '0' ? '🟢' : '🔴'}</span>
            </div>
            <p className="resp-card-author">by {card.author}</p>
            <div className="resp-card-stats">
              <span className="resp-card-stat">
                <span className="text-green">{card.return > '0' ? '+' : ''}{card.return}%</span>
                <small>Return</small>
              </span>
              <span className="resp-card-stat">
                <span>{card.sharpe}</span>
                <small>Sharpe</small>
              </span>
              <span className="resp-card-stat">
                <span>{card.subscribers}</span>
                <small>Subscribers</small>
              </span>
            </div>
          </div>
        ))}
      </ResponsiveCardGrid>

      {/* Pagination */}
      {demoCards.length > 0 && (
        <ResponsivePagination
          current={page}
          total={48}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Mobile bottom nav — only shown on mobile */}
      <MobileBottomNav
        tabs={[
          { key: 'marketplace', label: 'Market', icon: '🏪' },
          { key: 'signals', label: 'Signals', icon: '📡' },
          { key: 'portfolio', label: 'Portfolio', icon: '💼' },
          { key: 'settings', label: 'Settings', icon: '⚙️' },
        ]}
        active={activeNav}
        onChange={setActiveNav}
      />
    </div>
  );
};

// ── CSS-in-JS ────────────────────────────────────────────────────────────

export const MOBILE_RESPONSIVE_STYLES = `
/* ── Responsive Container ───────────────────── */
.responsive-container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.resp-mobile { padding: 0 8px; }
.resp-tablet { padding: 0 12px; }

/* ── Mobile Drawer ──────────────────────────── */
.mobile-drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; }
.mobile-drawer { position: fixed; z-index: 1001; background: var(--bg-primary, #1a1a2e); transition: transform 0.3s ease; }
.drawer-bottom { bottom: 0; left: 0; right: 0; max-height: 70vh; border-radius: 16px 16px 0 0; transform: translateY(100%); }
.drawer-bottom.open { transform: translateY(0); }
.drawer-left { top: 0; bottom: 0; left: 0; width: 80vw; max-width: 320px; transform: translateX(-100%); }
.drawer-left.open { transform: translateX(0); }
.drawer-right { top: 0; bottom: 0; right: 0; width: 80vw; max-width: 320px; transform: translateX(100%); }
.drawer-right.open { transform: translateX(0); }
.mobile-drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); }
.mobile-drawer-title { font-size: 16px; font-weight: 600; margin: 0; }
.mobile-drawer-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255,255,255,0.1); color: var(--text-primary, #e2e8f0); font-size: 16px; cursor: pointer; }
.mobile-drawer-content { padding: 20px; overflow-y: auto; max-height: calc(70vh - 60px); }

/* ── Responsive Search Bar ──────────────────── */
.resp-search-bar { position: relative; width: 100%; }
.resp-search-input-wrapper { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); transition: border-color 0.2s; }
.resp-search-bar.focused .resp-search-input-wrapper { border-color: #3b82f6; }
.resp-search-icon { font-size: 16px; flex-shrink: 0; }
.resp-search-input { flex: 1; border: none; background: transparent; color: var(--text-primary, #e2e8f0); font-size: 14px; outline: none; }
.resp-search-input::placeholder { color: var(--text-secondary, #94a3b8); }
.resp-search-clear { width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; }
.resp-search-suggestions-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--bg-primary, #1a1a2e); border: 1px solid var(--border-color, rgba(255,255,255,0.12)); border-radius: 10px; overflow: hidden; z-index: 100; }
.resp-search-mobile-overlay { position: fixed; inset: 0; top: 60px; background: var(--bg-primary, #1a1a2e); z-index: 500; padding: 16px; overflow-y: auto; }
.resp-search-suggestion { padding: 12px 14px; cursor: pointer; font-size: 14px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.05)); }
.resp-search-suggestion:hover { background: rgba(59, 130, 246, 0.1); }

/* ── Responsive Filters ─────────────────────── */
.resp-filters-inline { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
.resp-filters-mobile { margin: 12px 0; }
.resp-filters-toggle { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); color: var(--text-primary, #e2e8f0); font-size: 14px; cursor: pointer; }
.resp-filter-badge { background: #3b82f6; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.resp-filter-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.resp-filter-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 16px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 12px; }
.resp-filter-chip button { background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0; }
.resp-filter-item { display: flex; flex-direction: column; gap: 4px; }
.resp-filter-label { font-size: 12px; color: var(--text-secondary, #94a3b8); font-weight: 500; }
.resp-filter-select { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); font-size: 13px; }
.resp-filters-apply { width: 100%; padding: 14px; margin-top: 16px; border-radius: 10px; border: none; background: #3b82f6; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }

/* ── Responsive Pagination ──────────────────── */
.resp-pagination { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 20px 0; }
.resp-pagination.mobile { gap: 12px; }
.resp-page-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); color: var(--text-primary, #e2e8f0); font-size: 13px; cursor: pointer; transition: all 0.15s; }
.resp-page-btn:hover:not(:disabled) { border-color: #3b82f6; }
.resp-page-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.resp-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.resp-page-indicator { font-size: 14px; font-weight: 600; }
.resp-page-ellipsis { padding: 0 4px; color: var(--text-secondary, #94a3b8); }
.resp-page-size-select { margin-left: 12px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); color: var(--text-primary, #e2e8f0); font-size: 12px; }

/* ── Responsive Card Grid ───────────────────── */
.resp-card-grid { display: grid; gap: 16px; }
.resp-cols-1 { grid-template-columns: 1fr; }
.resp-cols-2 { grid-template-columns: repeat(2, 1fr); }
.resp-cols-3 { grid-template-columns: repeat(3, 1fr); }
.resp-card { padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--card-bg, rgba(255,255,255,0.05)); transition: all 0.15s; }
.resp-card:hover { border-color: #3b82f640; transform: translateY(-1px); }
.resp-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.resp-card-name { font-size: 15px; font-weight: 600; margin: 0; }
.resp-card-badge { font-size: 18px; }
.resp-card-author { font-size: 12px; color: var(--text-secondary, #94a3b8); margin: 0 0 12px 0; }
.resp-card-stats { display: flex; gap: 16px; }
.resp-card-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.resp-card-stat > span:first-child { font-size: 15px; font-weight: 600; }
.resp-card-stat small { font-size: 10px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; }

/* ── Mobile Bottom Nav ──────────────────────── */
.mobile-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: var(--bg-primary, #1a1a2e); border-top: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); z-index: 900; }
.mobile-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; background: none; border: none; color: var(--text-secondary, #94a3b8); font-size: 11px; cursor: pointer; transition: color 0.15s; }
.mobile-nav-item.active { color: #3b82f6; }
.mobile-nav-icon { font-size: 20px; }

/* ── Adaptive Publish Form ──────────────────── */
.adaptive-publish-form { max-width: 800px; margin: 0 auto; }
.adaptive-steps-bar { display: flex; justify-content: center; gap: 8px; margin-bottom: 24px; }
.adaptive-step { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.adaptive-step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; border: 2px solid var(--border-color, rgba(255,255,255,0.15)); color: var(--text-secondary, #94a3b8); transition: all 0.2s; }
.adaptive-step.active .adaptive-step-dot { border-color: #3b82f6; background: #3b82f6; color: #fff; }
.adaptive-step.done .adaptive-step-dot { border-color: #22c55e; background: #22c55e; color: #fff; }
.adaptive-step-title { font-size: 13px; font-weight: 500; color: var(--text-secondary, #94a3b8); }
.adaptive-step.active .adaptive-step-title { color: var(--text-primary, #e2e8f0); }
.adaptive-step-content { min-height: 200px; }

/* ── Marketplace Page Layout ─────────────────── */
.responsive-marketplace { max-width: 1200px; margin: 0 auto; padding: 16px 24px 80px; }
.resp-market-header { margin-bottom: 8px; }
.resp-market-grid { min-height: 200px; }

@media (max-width: 640px) {
  .responsive-marketplace { padding: 8px 12px 80px; }
  .resp-card-stats { justify-content: space-between; }
}
`;

export default ResponsiveMarketplacePage;
