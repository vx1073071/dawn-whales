// Responsive utility styles — ML-76-03
// Shared responsive breakpoints and helper for 1366×768 minimum

export const BREAKPOINTS = { xs: 480, sm: 640, md: 768, lg: 1024, xl: 1280, minLaptop: 1366 } as const;

export const RESPONSIVE = {
  // Container that adapts to all breakpoints
  container: {
    width: '100%', maxWidth: 1280, margin: '0 auto', padding: '16px',
    '@media (max-width: 1366px)': { maxWidth: '100%', padding: '12px' },
    '@media (max-width: 768px)': { padding: '8px' },
  } as CSSProperties,

  // Grid that collapses on narrow screens
  grid2: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
    '@media (max-width: 1366px)': { gridTemplateColumns: '1fr 1fr', gap: 12 },
    '@media (max-width: 768px)': { gridTemplateColumns: '1fr', gap: 10 },
  } as CSSProperties,

  // Hide on small screens
  hideMobile: {
    '@media (max-width: 768px)': { display: 'none' },
  } as CSSProperties,

  // Show only on small screens
  showMobile: {
    display: 'none',
    '@media (max-width: 768px)': { display: 'block' },
  } as CSSProperties,

  // Prevent horizontal scroll
  noScrollX: {
    overflowX: 'hidden' as const, maxWidth: '100vw',
  },

  // Table wrapper for overflow
  tableWrapper: {
    overflowX: 'auto' as const, WebkitOverflowScrolling: 'touch' as const,
  },
};

import { type CSSProperties } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// Number abbreviation helper
export function abbreviateNumber(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

export function abbreviateMoney(n: number, currency?: string): string {
  const pre = currency || '$';
  if (n >= 1e9) return pre + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return pre + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return pre + (n / 1e3).toFixed(1) + 'K';
  return pre + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
