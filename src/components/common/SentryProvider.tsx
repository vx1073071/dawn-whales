// @ts-nocheck
// R232 ML#1: SentryProvider — Error monitoring & crash reporting
// Integrates Sentry SDK for error capture, React error boundary, and crash reports
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ErrorInfo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface SentryConfig {
  dsn?: string;
  environment?: 'development' | 'staging' | 'production';
  release?: string;
  sampleRate?: number; // 0-1
  tracesSampleRate?: number;
  enabled?: boolean;
}

export interface SentryErrorInfo {
  error: Error;
  componentStack?: string;
  timestamp: string;
  level: 'error' | 'warning' | 'fatal';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface SentryContextValue {
  captureException: (error: Error, extra?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
  setUser: (user: { id: string; email?: string; username?: string }) => void;
  clearUser: () => void;
  setTag: (key: string, value: string) => void;
  errors: SentryErrorInfo[];
  clearErrors: () => void;
}

// ── Context ─────────────────────────────────────────────────────────
const SentryCtx = createContext<SentryContextValue | null>(null);

export function useSentry() {
  const ctx = useContext(SentryCtx);
  if (!ctx) throw new Error('useSentry must be used within SentryProvider');
  return ctx;
}

// ── Local error buffer (when Sentry DSN not configured) ─────────────
let localErrors: SentryErrorInfo[] = [];
const MAX_LOCAL_ERRORS = 100;

function addLocalError(info: SentryErrorInfo) {
  localErrors.unshift(info);
  if (localErrors.length > MAX_LOCAL_ERRORS) {
    localErrors = localErrors.slice(0, MAX_LOCAL_ERRORS);
  }
  // Log to console in development
  if (typeof window !== 'undefined' && (window as any).__DW_DEV__) {
    console.error(`[Sentry] ${info.level.toUpperCase()}:`, info.error.message, info.tags);
  }
}

// ── Optional Sentry SDK lazy loader ─────────────────────────────────
let sentryLoaded = false;
let sentryInitPromise: Promise<void> | null = null;

async function loadSentry(dsn: string, config: Omit<SentryConfig, 'dsn'>): Promise<void> {
  if (sentryInitPromise) return sentryInitPromise;
  
  sentryInitPromise = (async () => {
    try {
      // Dynamic import — won't bundle if not used
      const Sentry = await import('@sentry/browser');
      if (Sentry && Sentry.init) {
        Sentry.init({
          dsn,
          environment: config.environment || 'production',
          release: config.release || 'quant-moo@' + (config.release || '0.0.0'),
          sampleRate: config.sampleRate ?? 1.0,
          tracesSampleRate: config.tracesSampleRate ?? 0.1,
          enabled: config.enabled !== false,
          beforeSend(event) {
            // Strip sensitive data
            if (event.request?.url) {
              event.request.url = event.request.url.replace(/key=[^&]+/g, 'key=***');
              event.request.url = event.request.url.replace(/secret=[^&]+/g, 'secret=***');
            }
            return event;
          },
        });
        sentryLoaded = true;
      }
    } catch {
      // Sentry not available — use local fallback
    }
  })();
  
  return sentryInitPromise;
}

// ── Provider ────────────────────────────────────────────────────────
export interface SentryProviderProps {
  children: React.ReactNode;
  config?: SentryConfig;
}

export default function SentryProvider({ children, config }: SentryProviderProps) {
  const [errors, setErrors] = useState<SentryErrorInfo[]>([]);
  const userIdRef = useRef<string | null>(null);
  const tagsRef = useRef<Record<string, string>>({});
  
  // Initialize Sentry if DSN provided
  useEffect(() => {
    if (config?.dsn) {
      loadSentry(config.dsn, config);
    }
  }, [config?.dsn]);
  
  const captureException = useCallback((error: Error, extra?: Record<string, unknown>) => {
    const info: SentryErrorInfo = {
      error,
      componentStack: error.stack,
      timestamp: new Date().toISOString(),
      level: 'error',
      tags: tagsRef.current,
      extra,
    };
    
    addLocalError(info);
    setErrors(prev => [info, ...prev].slice(0, MAX_LOCAL_ERRORS));
    
    // Forward to Sentry
    if (sentryLoaded) {
      try {
        import('@sentry/browser').then(Sentry => {
          if (userIdRef.current) Sentry.setUser({ id: userIdRef.current });
          Sentry.captureException(error, { extra: extra as any });
        }).catch(() => {});
      } catch {}
    }
  }, []);
  
  const captureMessage = useCallback((message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    const info: SentryErrorInfo = {
      error: new Error(message),
      timestamp: new Date().toISOString(),
      level: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'error',
      tags: tagsRef.current,
      extra: { message },
    };
    
    addLocalError(info);
    setErrors(prev => [info, ...prev].slice(0, MAX_LOCAL_ERRORS));
    
    if (sentryLoaded) {
      try {
        import('@sentry/browser').then(Sentry => {
          Sentry.captureMessage(message, level);
        }).catch(() => {});
      } catch {}
    }
  }, []);
  
  const setUser = useCallback((user: { id: string; email?: string; username?: string }) => {
    userIdRef.current = user.id;
    if (sentryLoaded) {
      try {
        import('@sentry/browser').then(Sentry => Sentry.setUser(user as any)).catch(() => {});
      } catch {}
    }
  }, []);
  
  const clearUser = useCallback(() => {
    userIdRef.current = null;
    if (sentryLoaded) {
      try {
        import('@sentry/browser').then(Sentry => Sentry.setUser(null)).catch(() => {});
      } catch {}
    }
  }, []);
  
  const setTag = useCallback((key: string, value: string) => {
    tagsRef.current = { ...tagsRef.current, [key]: value };
    if (sentryLoaded) {
      try {
        import('@sentry/browser').then(Sentry => Sentry.setTag(key, value)).catch(() => {});
      } catch {}
    }
  }, []);
  
  const clearErrors = useCallback(() => {
    localErrors = [];
    setErrors([]);
  }, []);
  
  const value: SentryContextValue = {
    captureException,
    captureMessage,
    setUser,
    clearUser,
    setTag,
    errors,
    clearErrors,
  };
  
  return React.createElement(SentryCtx.Provider, { value }, children);
}

// ── Error Boundary ──────────────────────────────────────────────────
export interface SentryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  level?: 'error' | 'fatal';
  tags?: Record<string, string>;
}

interface BoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SentryErrorBoundary extends React.Component<SentryErrorBoundaryProps, BoundaryState> {
  static contextType = SentryCtx;
  
  constructor(props: SentryErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, info: ErrorInfo) {
    const sentry = this.context as SentryContextValue | null;
    if (sentry) {
      sentry.captureException(error, {
        componentStack: info.componentStack,
        ...(this.props.tags || {}),
      });
    }
    this.props.onError?.(error, info);
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };
  
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? (this.props.fallback as any)(this.state.error!, this.handleReset)
          : this.props.fallback;
      }
      
      return React.createElement('div', {
        style: {
          padding: 24, textAlign: 'center',
          background: 'var(--surface-1, #0f172a)',
          color: 'var(--text-primary, #e2e8f0)',
          borderRadius: 12,
          border: '1px solid var(--border-color, #334155)',
          maxWidth: 480, margin: '40px auto',
        },
      }, [
        React.createElement('div', { key: 'icon', style: { fontSize: 40, marginBottom: 12 } }, '⚠️'),
        React.createElement('h3', { key: 'title', style: { fontSize: 18, fontWeight: 600, marginBottom: 8 } }, 'Something went wrong'),
        React.createElement('p', { key: 'msg', style: { fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginBottom: 16 } },
          this.state.error?.message || 'An unexpected error occurred'),
        React.createElement('button', {
          key: 'retry',
          onClick: this.handleReset,
          style: {
            padding: '8px 20px', borderRadius: 8,
            background: 'var(--brand, #d4a574)', color: '#000',
            border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
          },
        }, 'Try Again'),
        React.createElement('details', { key: 'stack', style: { marginTop: 16, textAlign: 'left' } }, [
          React.createElement('summary', { key: 's', style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)', cursor: 'pointer' } }, 'Stack Trace'),
          React.createElement('pre', { key: 'p', style: { fontSize: 10, maxHeight: 200, overflow: 'auto', padding: 8, background: 'var(--surface-2, #1e293b)', borderRadius: 6, marginTop: 8 } },
            this.state.error?.stack || 'No stack trace'),
        ]),
      ]);
    }
    
    return this.props.children;
  }
}
