/**
 * TradingStatusIndicator — Real-time trading status indicator (R100 M-01)
 *
 * Shows: ● Open (green pulse) / ● Lunch (amber) / ● Pre-Open (gold) / ● Closed (gray)
 * With optional countdown to next state change.
 */

import { useState, useEffect } from 'react';
import { getMarketTradingStatus, type TradingStatus } from './MarketBadge';

export interface TradingStatusIndicatorProps {
  market: string; // 'US' | 'HK' | 'CN' | 'JP' | 'UK' | 'EU' | 'CRYPTO'
  showCountdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Refresh interval in ms (default: 30000 = 30s) */
  refreshInterval?: number;
}

const STATUS_STYLES: Record<TradingStatus, {
  dot: string;
  text: string;
  bg: string;
  pulse: boolean;
}> = {
  open: {
    dot: '#22C55E',
    text: 'Open',
    bg: '#22C55E15',
    pulse: true,
  },
  'pre-open': {
    dot: '#D4A853',
    text: 'Pre-Open',
    bg: '#D4A85315',
    pulse: false,
  },
  lunch: {
    dot: '#F59E0B',
    text: 'Lunch Break',
    bg: '#F59E0B15',
    pulse: false,
  },
  closed: {
    dot: '#6B7280',
    text: 'Closed',
    bg: '#6B728015',
    pulse: false,
  },
};

export default function TradingStatusIndicator({
  market,
  showCountdown: _showCountdown = false,
  size = 'md',
  className = '',
  refreshInterval = 30000,
}: TradingStatusIndicatorProps) {
  void _showCountdown; // reserved for future R101 countdown feature
  const [, setTick] = useState(0);

  // Auto-refresh to keep status current
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const status = getMarketTradingStatus(market);
  const style = STATUS_STYLES[status.status];

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs';
  const px = size === 'sm' ? 'px-1.5' : size === 'lg' ? 'px-3' : 'px-2';
  const py = size === 'sm' ? 'py-0.5' : size === 'lg' ? 'py-1.5' : 'py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${fontSize} ${px} ${py} ${className}`}
      style={{ background: style.bg }}
    >
      {/* Status dot with optional pulse animation */}
      <span className="relative flex">
        <span
          className={`${dotSize} rounded-full`}
          style={{ background: style.dot }}
        />
        {style.pulse && (
          <span
            className={`absolute inset-0 ${dotSize} rounded-full animate-ping opacity-75`}
            style={{ background: style.dot }}
          />
        )}
      </span>

      {/* Label */}
      <span style={{ color: style.dot }}>{style.text}</span>
    </span>
  );
}
