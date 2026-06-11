/**
 * EmptyState — Empty data display with icon, title, description, and CTA.
 * Used when lists, tables, charts, or search results have no data.
 */
import { type ReactNode, type CSSProperties } from 'react';

export interface EmptyStateProps {
  /** Main icon (emoji or ReactNode) */
  icon?: string | ReactNode;
  /** Title text */
  title?: string;
  /** Description / subtitle */
  description?: string;
  /** Primary action button label */
  actionLabel?: string;
  /** Primary action callback */
  onAction?: () => void;
  /** Secondary action button label */
  secondaryLabel?: string;
  /** Secondary action callback */
  onSecondaryAction?: () => void;
  /** Layout variant */
  variant?: 'default' | 'compact' | 'illustration';
  /** Theme: dark (default) or light */
  theme?: 'dark' | 'light';
  /** Custom children (rendered below the CTA buttons) */
  children?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

const THEMES = {
  dark: {
    bg: '#0F1117',
    title: '#F9FAFB',
    desc: '#9CA3AF',
    border: '#1F2937',
    accent: '#6366F1',
    secondary: '#374151',
  },
  light: {
    bg: '#F9FAFB',
    title: '#111827',
    desc: '#6B7280',
    border: '#E5E7EB',
    accent: '#4F46E5',
    secondary: '#D1D5DB',
  },
};

const DEFAULT_ICONS: Record<string, string> = {
  list: '📋',
  search: '🔍',
  chart: '📊',
  strategy: '🎯',
  order: '📦',
  portfolio: '💼',
  notification: '🔔',
  default: '📭',
};

export default function EmptyState({
  icon = DEFAULT_ICONS.default,
  title = 'No data',
  description = 'Nothing to display here yet.',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  variant = 'default',
  theme = 'dark',
  children,
  className = '',
}: EmptyStateProps) {
  const t = THEMES[theme];
  const isCompact = variant === 'compact';

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isCompact ? '20px 16px' : '48px 24px',
    minHeight: isCompact ? 120 : 240,
    background: t.bg,
    border: `1px dashed ${t.border}`,
    borderRadius: 16,
    textAlign: 'center',
  };

  const iconSize = isCompact ? 36 : 56;

  return (
    <div className={className} style={containerStyle}>
      {/* Icon */}
      <div style={{
        fontSize: typeof icon === 'string' ? iconSize : undefined,
        marginBottom: isCompact ? 8 : 16,
        lineHeight: 1,
        opacity: 0.8,
      }}>
        {icon}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: isCompact ? 14 : 18,
        fontWeight: 700,
        color: t.title,
        margin: '0 0 6px',
      }}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p style={{
          fontSize: isCompact ? 12 : 14,
          color: t.desc,
          margin: '0 0 20px',
          lineHeight: 1.6,
          maxWidth: 380,
        }}>
          {description}
        </p>
      )}

      {/* Action buttons */}
      {(actionLabel || secondaryLabel) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              style={{
                padding: isCompact ? '6px 16px' : '10px 24px',
                background: t.accent,
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                fontSize: isCompact ? 12 : 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              style={{
                padding: isCompact ? '6px 16px' : '10px 24px',
                background: 'transparent',
                color: t.desc,
                border: `1px solid ${t.secondary}`,
                borderRadius: 8,
                fontSize: isCompact ? 12 : 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}

      {/* Custom children */}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}
