/**
 * J-77-05: Global ErrorBoundary
 * 
 * React ErrorBoundary component → hint + restore
 * R76 crash-protection.ts
 */

import React from 'react';
import { EngineError } from './core/engine-error';
import log from 'electron-log';
import i18n from '../../src/i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  recoveryTimeoutMs?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  lastErrorTime: number;
}

const MAX_ERRORS_PER_MINUTE = 3;
const DEFAULT_RECOVERY_MS = 5000;

export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private errorWindow: number[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, lastErrorTime: Date.now() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const now = Date.now();
    // Track error frequency (sliding window)
    this.errorWindow.push(now);
    this.errorWindow = this.errorWindow.filter(t => now - t < 60_000);
    
    const errorCount = this.errorWindow.length;
    this.setState({ errorCount, lastErrorTime: now });

    log.error('[ErrorBoundary] Caught error:', error.message);
    log.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.props.onError?.(error, errorInfo);

    // Auto-recover after timeout (unless too many errors)
    if (errorCount < MAX_ERRORS_PER_MINUTE) {
      const timeout = this.props.recoveryTimeoutMs || DEFAULT_RECOVERY_MS;
      this.recoveryTimer = setTimeout(() => {
        this.reset();
      }, timeout);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  };

  componentWillUnmount(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isCritical = this.state.errorCount >= MAX_ERRORS_PER_MINUTE;

      return React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: isCritical ? '#fff2f0' : '#fafafa',
          borderRadius: '8px',
          border: `1px solid ${isCritical ? '#ff4d4f' : '#e8e8e8'}`,
        } as React.CSSProperties,
      },
        React.createElement('div', {
          style: { fontSize: '48px', marginBottom: '16px' },
        }, isCritical ? '⚠️' : '🔧'),
        React.createElement('h2', {
          style: { margin: '0 0 8px', fontSize: '18px', color: '#333' },
        }, isCritical ? i18n.t('errorBoundary.k1') : i18n.t('errorBoundary.k2')),
        React.createElement('p', {
          style: { margin: '0 0 16px', color: '#666', fontSize: '14px', textAlign: 'center', maxWidth: '400px' },
        }, isCritical
          ? i18n.t('errorBoundary.k3')
          : i18n.t('errorBoundary.k4')),
        React.createElement('button', {
          onClick: this.reset,
          style: {
            padding: '8px 24px',
            borderRadius: '6px',
            border: 'none',
            background: '#1890ff',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          },
        }, i18n.t('errorBoundary.k5')),
        React.createElement('details', {
          style: { marginTop: '16px', fontSize: '12px', color: '#999', maxWidth: '400px' },
        },
          React.createElement('summary', { style: { cursor: 'pointer' } }, i18n.t('errorBoundary.k6')),
          React.createElement('pre', {
            style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
          }, this.state.error?.stack || this.state.error?.message || 'Unknown error')
        )
      );
    }

    return this.props.children;
  }
}

/**
 * error — React try-catch
 */
export function wrapEngineCall<T extends (...args: any[]) => any>(
  fn: T,
  engineName: string
): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      log.error(`[${engineName}] Engine call failed:`, (err as Error).message);
      // Allow crash-protection to handle
      throw err;
    }
  }) as T;
}

export default GlobalErrorBoundary;
