/**
 * DAWN WHALES R124 J01 — Data Freshness Indicator
 * 
 * Shows how current the displayed market data is.
 * 4 states:
 *   live (green)    — <2s since last update
 *   recent (yellow) — 2s-5min since last update
 *   stale (orange)  — >5min since last update
 *   offline (red)   — no data received
 */

import React, { useEffect, useState } from 'react';

// ═══════════ Types ════════════════════════════════════════

export type FreshnessState = 'live' | 'recent' | 'stale' | 'offline';

export interface FreshnessInfo {
  state: FreshnessState;
  lastUpdateAt: number | null;
  secondsAgo: number | null;
  message: string;
  source: string;          // 'broker' | 'ws' | 'cache'
}

const STATE_CONFIG: Record<FreshnessState, {
  bg: string; dot: string; label: string; text: string;
}> = {
  live:    { bg: 'bg-[#0d3320]', dot: 'bg-[#22c55e] animate-pulse', label: 'Live', text: 'text-[#3fb950]' },
  recent:  { bg: 'bg-[#332a0d]', dot: 'bg-[#f59e0b]', label: 'Recent', text: 'text-[#d29922]' },
  stale:   { bg: 'bg-[#331a0d]', dot: 'bg-[#f0883e]', label: 'Stale', text: 'text-[#f0883e]' },
  offline: { bg: 'bg-[#330d17]', dot: 'bg-[#ef4444]', label: 'Offline', text: 'text-[#f85149]' },
};

// ═══════════ Hook ════════════════════════════════════════

const LIVE_THRESHOLD_MS = 2000;      // <2s = live
const RECENT_THRESHOLD_MS = 300000;  // <5min = recent, >5min = stale

export function useDataFreshness() {
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [state, setState] = useState<FreshnessState>('offline');
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const [source, setSource] = useState<string>('—');

  // Listen for IPC data timestamps
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;

    const onQuote = (data: any) => {
      setLastUpdateAt(data.timestamp || Date.now());
      setSource('broker');
    };
    const onWS = (data: any) => {
      setLastUpdateAt(data.timestamp || Date.now());
      setSource('ws');
    };
    const onCache = (data: any) => {
      if (lastUpdateAt) return; // prefer live data
      setLastUpdateAt(data.timestamp || Date.now());
      setSource('cache');
    };

    const unsub1 = api.on('broker:quote-push', onQuote);
    const unsub2 = api.on('ws:data-push', onWS);
    const unsub3 = api.on('cache:data-load', onCache);

    return () => { unsub1?.(); unsub2?.(); unsub3?.(); };
  }, [lastUpdateAt]);

  // Recompute state every 1s
  useEffect(() => {
    const compute = () => {
      if (!lastUpdateAt) {
        setState('offline');
        setSecondsAgo(null);
        return;
      }
      const elapsed = Date.now() - lastUpdateAt;
      setSecondsAgo(Math.floor(elapsed / 1000));

      if (elapsed < LIVE_THRESHOLD_MS) {
        setState('live');
      } else if (elapsed < RECENT_THRESHOLD_MS) {
        setState('recent');
      } else {
        setState('stale');
      }
    };

    compute();
    const timer = setInterval(compute, 1000);
    return () => clearInterval(timer);
  }, [lastUpdateAt]);

  const freshness: FreshnessInfo = {
    state,
    lastUpdateAt,
    secondsAgo,
    message: !lastUpdateAt
      ? 'No data received'
      : state === 'live' ? 'Up to date'
      : `Last update ${secondsAgo}s ago`,
    source,
  };

  return freshness;
}

// ═══════════ DataFreshnessIndicator Component ═════════════

interface Props {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const DataFreshnessIndicator: React.FC<Props> = ({
  compact = false,
  showDetails = false,
  className = '',
}) => {
  const freshness = useDataFreshness();
  const cfg = STATE_CONFIG[freshness.state];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${cfg.bg} ${cfg.text} ${className}`}
        title={freshness.message}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
        {freshness.secondsAgo != null && freshness.state !== 'live' && (
          <span className="text-[#484f58]">{freshness.secondsAgo}s</span>
        )}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 ${cfg.bg} rounded-lg border border-[#21262d] ${className}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      <div className="flex flex-col leading-tight">
        <span className={`text-[11px] font-semibold ${cfg.text}`}>
          {cfg.label}
        </span>
        <span className="text-[9px] text-[#484f58]">{freshness.message}</span>
      </div>
      {showDetails && (
        <div className="flex items-center gap-2 ml-auto text-[9px] text-[#484f58]">
          <span>Source: {freshness.source}</span>
          {freshness.lastUpdateAt && (
            <span>{new Date(freshness.lastUpdateAt).toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </div>
  );
};
