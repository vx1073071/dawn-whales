// @ts-nocheck
// R233 ML#2: Sentry sourcemap upload configuration
// Integrates with Vite build to upload sourcemaps for error deobfuscation

import { defineConfig, Plugin } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Sentry Vite plugin for automatic sourcemap upload
// Usage: Add to vite.config.ts plugins array
export const sentryPlugin = sentryVitePlugin({
  // Only upload in production builds
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT || 'dawn-whales',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: {
    name: process.env.npm_package_version || '0.0.0',
  },
  sourcemaps: {
    assets: './dist-electron/**',
    ignore: ['node_modules'],
    filesToDeleteAfterUpload: './dist-electron/**/*.map',
  },
  telemetry: false,
});

// SourceMap configuration for Vite
export const sourcemapConfig = {
  // Enable sourcemaps in production for Sentry
  build: {
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
  },
};

// Vite config helper for Sentry integration
export function withSentry(baseConfig: any) {
  return {
    ...baseConfig,
    build: {
      ...baseConfig.build,
      sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    },
    plugins: [
      ...(baseConfig.plugins || []),
      ...(process.env.SENTRY_AUTH_TOKEN ? [sentryPlugin] : []),
    ],
  };
}

// Environment validation
export function validateSentryConfig() {
  const issues: string[] = [];
  
  if (!process.env.SENTRY_DSN) {
    issues.push('SENTRY_DSN not set — errors will be logged locally only');
  }
  
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN) {
    if (!process.env.SENTRY_ORG) issues.push('SENTRY_ORG not set');
    if (!process.env.SENTRY_PROJECT) issues.push('SENTRY_PROJECT not set');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    dsn: process.env.SENTRY_DSN || '(not set)',
    environment: process.env.NODE_ENV || 'development',
  };
}
