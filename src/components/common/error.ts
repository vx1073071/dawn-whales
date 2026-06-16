// R232 ML#1: Error boundary barrel — unified export
export { default as SentryProvider, SentryErrorBoundary, useSentry } from './SentryProvider';
export { default as GlobalErrorBoundary, withErrorBoundary } from './GlobalErrorBoundary';
export { default as CrashReportPanel } from './CrashReportPanel';

// Re-export original ErrorBoundary for backward compat
export { default as ErrorBoundary } from './ErrorBoundary';
