// ── R122-M02 ErrorBoundary — 引擎组件错误隔离 ───────────────────────────
// PM: 包裹 26 个引擎组件，防白屏，带重试按钮

import { Component, ReactNode, ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  /** Called when an error is caught (for logging/metrics) */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Custom fallback UI. Default: compact retry card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { hasError: false, error: null, errorCount: 0 };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));
    this.props.onError?.(error, info);

    // Auto-reset after 30s if error persists
    if (!this.resetTimer) {
      this.resetTimer = setTimeout(() => {
        this.setState({ hasError: false, error: null });
        this.resetTimer = null;
      }, 30_000);
    }
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorCount: this.state.errorCount });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.handleReset);
      }
      return (
        <div className="flex items-center justify-center p-4 bg-[#1a1020] border border-[#ff4444]/30 rounded-lg">
          <div className="text-center">
            <div className="text-[#ff6b6b] text-sm font-medium mb-1">
              {this.props.componentName || 'Component'} Error
            </div>
            <div className="text-[#8b949e] text-xs mb-2 max-w-xs truncate">
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button
              onClick={this.handleReset}
              className="px-3 py-1 text-xs bg-[#ff4444]/20 hover:bg-[#ff4444]/30 text-[#ff6b6b] border border-[#ff4444]/30 rounded transition-colors"
            >
              Retry
            </button>
            {this.state.errorCount > 2 && (
              <div className="text-[#8b949e] text-[10px] mt-1">
                Error count: {this.state.errorCount}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
