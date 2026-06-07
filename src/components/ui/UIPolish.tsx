/**
 * UI Polish — ML-48-01 [P0]
 * R48+R49: UI Detail Optimization
 *
 * Improvements:
 * - Consistent transitions & micro-interactions
 * - Focus ring styling for accessibility
 * - Empty state illustrations
 * - Loading skeleton refinements
 * - Responsive grid breakpoints
 */

import React from 'react';

// ── Transition Presets ──────────────────────────────────────────────────

/** Shared transition classes for consistent micro-interactions */
export const transitions = {
  /** Default hover/active transition */
  interactive: 'transition-all duration-200 ease-out',
  /** Page entrance */
  pageEnter: 'animate-in fade-in slide-in-from-bottom-2 duration-300',
  /** Card hover lift */
  cardHover: 'transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg',
  /** Toast notification */
  toast: 'animate-in slide-in-from-top-full fade-in duration-300',
  /** Modal backdrop */
  backdrop: 'animate-in fade-in duration-200',
  /** Modal content */
  modalContent: 'animate-in zoom-in-95 fade-in duration-200',
};

// ── Focus Ring ──────────────────────────────────────────────────────────

/**
 * Consistent focus ring for all interactive elements.
 * Replace browser default outlines with a subtle amber glow.
 */
export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d15]';

/** Focus ring variant for dark backgrounds */
export const focusRingDark =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';

// ── Button Variants ─────────────────────────────────────────────────────

const btnBase = `inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${focusRing} disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150`;

export const btnStyles = {
  primary: `${btnBase} bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600 px-4 py-2`,
  secondary: `${btnBase} bg-white/[0.06] text-gray-300 hover:bg-white/[0.10] active:bg-white/[0.04] border border-white/[0.08] px-4 py-2`,
  ghost: `${btnBase} text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] px-3 py-1.5`,
  danger: `${btnBase} bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 px-4 py-2`,
  icon: `${btnBase} p-2 text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] rounded-lg`,
};

// ── Empty State ─────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  action,
  className,
}) => (
  <div className={`flex flex-col items-center justify-center py-16 px-4 ${className ?? ''}`}>
    <span className="text-5xl mb-4 opacity-50">{icon}</span>
    <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
    {description && (
      <p className="text-xs text-gray-600 max-w-xs text-center mb-4">{description}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className={btnStyles.primary + ' mt-2'}
      >
        {action.label}
      </button>
    )}
  </div>
);

// ── Badge ───────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const badgeVariants: Record<string, string> = {
  default: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${badgeVariants[variant]} ${className ?? ''}`}
  >
    {children}
  </span>
);

// ── Stat Card ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, sub, trend, trendValue }) => (
  <div className={`bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 ${transitions.cardHover}`}>
    <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">{label}</p>
    <p className="text-xl font-semibold text-gray-100">{value}</p>
    <div className="flex items-center gap-1.5 mt-1">
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
      {trend && trendValue && (
        <span
          className={`text-[10px] ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
          }`}
        >
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </span>
      )}
    </div>
  </div>
);

// ── Section Header ──────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      {subtitle && <p className="text-[10px] text-gray-600 mt-0.5">{subtitle}</p>}
    </div>
    {action && (
      <button onClick={action.onClick} className={btnStyles.ghost}>
        {action.label}
      </button>
    )}
  </div>
);

// ── Tooltip ─────────────────────────────────────────────────────────────

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div className="relative group inline-flex">
      {children}
      <div
        className={`absolute ${positionClasses[position]} pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50`}
      >
        <div className="bg-gray-900 border border-white/10 text-gray-300 text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
          {content}
        </div>
      </div>
    </div>
  );
};

// ── Responsive Grid ─────────────────────────────────────────────────────

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: { sm?: number; md?: number; lg?: number };
  gap?: string;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  cols = { sm: 1, md: 2, lg: 4 },
  gap = 'gap-4',
  className,
}) => {
  const colClasses = [
    cols.sm ? `grid-cols-${cols.sm}` : '',
    cols.md ? `md:grid-cols-${cols.md}` : '',
    cols.lg ? `lg:grid-cols-${cols.lg}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={`grid ${colClasses} ${gap} ${className ?? ''}`}>{children}</div>;
};

// ── Export all ──────────────────────────────────────────────────────────

export default {
  transitions,
  focusRing,
  focusRingDark,
  btnStyles,
  EmptyState,
  Badge,
  StatCard,
  SectionHeader,
  Tooltip,
  ResponsiveGrid,
};
