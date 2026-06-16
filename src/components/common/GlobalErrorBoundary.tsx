// @ts-nocheck
// R232 ML#1: GlobalErrorBoundary — Wraps entire app with Sentry crash reporting
// Per-route error boundaries with graceful fallback UI
import React from 'react';
import { SentryErrorBoundary } from './SentryProvider';

export interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  routeName?: string;
  fallback?: React.ReactNode;
}

// Route-specific fallback component
function RouteFallback({ routeName, error, onReset }: { routeName?: string; error: Error; onReset: () => void }) {
  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 300, padding: 32, textAlign: 'center',
    },
  }, [
    React.createElement('div', { key: 'icon', style: { fontSize: 48, marginBottom: 16 } }, '🔧'),
    React.createElement('h2', { key: 'title', style: { fontSize: 20, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: 8 } },
      routeName ? `${routeName} encountered an error` : 'Page Error'),
    React.createElement('p', { key: 'msg', style: { fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginBottom: 20, maxWidth: 400 } },
      error?.message || 'Something went wrong loading this page. Our team has been notified.'),
    React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 10 } }, [
      React.createElement('button', {
        key: 'retry', onClick: onReset,
        style: {
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: 'var(--brand, #d4a574)', color: '#000',
          fontSize: 14, fontWeight: 500, cursor: 'pointer',
        },
      }, 'Retry'),
      React.createElement('button', {
        key: 'home',
        onClick: () => { window.location.hash = '#/'; onReset(); },
        style: {
          padding: '8px 20px', borderRadius: 8,
          border: '1px solid var(--border-color, #334155)',
          background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
          fontSize: 14, cursor: 'pointer',
        },
      }, 'Go Home'),
    ]),
  ]);
}

export default function GlobalErrorBoundary({ children, routeName, fallback }: GlobalErrorBoundaryProps) {
  return React.createElement(SentryErrorBoundary, {
    level: 'fatal',
    tags: { route: routeName || 'unknown' },
    fallback: fallback || ((error: Error, reset: () => void) =>
      React.createElement(RouteFallback, { routeName, error, onReset: reset })
    ),
  }, children);
}

// Convenience HOC to wrap any component
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  routeName?: string,
) {
  return function WrappedComponent(props: P) {
    return React.createElement(GlobalErrorBoundary, { routeName },
      React.createElement(Component, props)
    );
  };
}
