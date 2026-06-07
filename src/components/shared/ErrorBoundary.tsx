/**
 * ErrorBoundary — React error boundary with friendly fallback UI
 * (ML-44-03, R44 Phase 6.0)
 *
 * Features:
 * - Catch render errors in any child component tree
 * - Friendly fallback UI with retry button
 * - Error reporting (console + optional remote)
 * - Dev mode stack trace display
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ── Error Boundary ──────────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Console report
    console.error(
      `[ErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ''}]`,
      error.message,
      errorInfo.componentStack
    );

    // Optional remote reporting
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="bg-gray-900 rounded-xl border border-red-500/20 p-6 max-w-md w-full text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-base font-bold text-white mb-2">
              组件加载异常
              {this.props.componentName && (
                <span className="text-gray-500 font-normal"> ({this.props.componentName})</span>
              )}
            </h3>

            <p className="text-sm text-gray-400 mb-2">
              {this.state.error?.message ?? '发生了未知错误'}
            </p>

            {/* Dev: stack trace */}
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mb-4 text-left">
                <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400">
                  查看堆栈
                </summary>
                <pre className="text-[10px] text-gray-500 mt-2 p-2 bg-gray-950 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Inline error boundary (no class component needed) ──────────────────

interface InlineErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
}

export const InlineErrorBoundary: React.FC<InlineErrorBoundaryProps> = ({ children, componentName }) => (
  <ErrorBoundary componentName={componentName}>
    {children}
  </ErrorBoundary>
);

// ── Global error handler ────────────────────────────────────────────────

export function setupGlobalErrorHandler(): () => void {
  const handler = (event: ErrorEvent) => {
    console.error('[GlobalError]', event.error?.message ?? event.message);

    // Prevent blank screen on unhandled errors
    // In production, show a toast or status bar message instead of crashing
    const statusEl = document.getElementById('global-status');
    if (statusEl) {
      statusEl.textContent = `⚠️ ${event.error?.message ?? 'Unknown error'}`;
      statusEl.className = 'text-red-400 text-xs px-3 py-1';
      setTimeout(() => {
        if (statusEl.textContent?.startsWith('⚠️')) {
          statusEl.textContent = '';
        }
      }, 5000);
    }
  };

  const promiseHandler = (event: PromiseRejectionEvent) => {
    console.error('[UnhandledPromise]', event.reason);
  };

  window.addEventListener('error', handler);
  window.addEventListener('unhandledrejection', promiseHandler);

  // Return cleanup
  return () => {
    window.removeEventListener('error', handler);
    window.removeEventListener('unhandledrejection', promiseHandler);
  };
}

export default ErrorBoundary;
