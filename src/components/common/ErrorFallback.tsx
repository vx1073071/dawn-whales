/**
 * ErrorFallback — User-friendly error display with retry and details toggle.
 * Used as the default fallback for ErrorBoundary and async error states.
 */
import { useState, type CSSProperties } from 'react';

export interface ErrorFallbackProps {
  /** Error title */
  title?: string;
  /** Error message / description */
  message?: string;
  /** Technical error details (stack trace, error code, etc.) */
  details?: string;
  /** Error icon emoji (default: ⚠️) */
  icon?: string;
  /** Show retry button */
  showRetry?: boolean;
  /** Retry button callback */
  onRetry?: () => void;
  /** Retry button label (default: "Retry") */
  retryLabel?: string;
  /** Show "Go Home" button */
  showHome?: boolean;
  /** Home button callback */
  onHome?: () => void;
  /** Home button label (default: "Go Home") */
  homeLabel?: string;
  /** Error severity: changes accent color */
  severity?: 'error' | 'warning' | 'info';
  /** Compact mode (less padding, smaller text) */
  compact?: boolean;
  /** Additional CSS class */
  className?: string;
}

const SEVERITY_COLORS = {
  error: { accent: '#EF4444', bg: '#1C1017', border: '#7F1D1D' },
  warning: { accent: '#F59E0B', bg: '#1C1810', border: '#78350F' },
  info: { accent: '#6366F1', bg: '#131327', border: '#312E81' },
};

export default function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  details,
  icon = '⚠️',
  showRetry = true,
  onRetry,
  retryLabel = 'Retry',
  showHome = false,
  onHome,
  homeLabel = 'Go Home',
  severity = 'error',
  compact = false,
  className = '',
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const colors = SEVERITY_COLORS[severity];

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: compact ? '16px' : '40px 24px',
    minHeight: compact ? 120 : 240,
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    textAlign: 'center',
    maxWidth: 480,
    margin: compact ? 0 : '0 auto',
  };

  return (
    <div className={className} style={containerStyle}>
      <div style={{ fontSize: compact ? 32 : 48, marginBottom: compact ? 8 : 16, lineHeight: 1 }}>{icon}</div>

      <h3 style={{
        fontSize: compact ? 15 : 18,
        fontWeight: 700,
        color: colors.accent,
        margin: '0 0 8px',
      }}>
        {title}
      </h3>

      <p style={{
        fontSize: compact ? 12 : 14,
        color: '#9CA3AF',
        margin: '0 0 20px',
        lineHeight: 1.6,
        maxWidth: 360,
      }}>
        {message}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: compact ? '6px 16px' : '10px 24px',
              background: colors.accent,
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              fontSize: compact ? 12 : 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
          >
            {retryLabel}
          </button>
        )}

        {showHome && onHome && (
          <button
            onClick={onHome}
            style={{
              padding: compact ? '6px 16px' : '10px 24px',
              background: 'transparent',
              color: '#D1D5DB',
              border: '1px solid #374151',
              borderRadius: 8,
              fontSize: compact ? 12 : 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {homeLabel}
          </button>
        )}
      </div>

      {details && (
        <div style={{ marginTop: 16, width: '100%' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && (
            <pre style={{
              marginTop: 8,
              padding: 12,
              background: '#111827',
              borderRadius: 8,
              fontSize: 11,
              color: '#F87171',
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: 200,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {details}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
