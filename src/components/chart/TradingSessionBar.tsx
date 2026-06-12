/**
 * DAWN WHALES R125 J02 — Trading Session Indicator
 * 
 * Shows which market sessions are currently active.
 * Supports: US Pre/Regular/After, HK Morning/Afternoon, UK, Crypto (24/7).
 * Displays as a mini timeline bar along the top of chart.
 */

import React, { useEffect, useState } from 'react';
import { MarketClock, getMarketDisplayName } from '../lib/chart/market-clock';

// ═══════════ Types ════════════════════════════════════════

export type SessionState = 'active' | 'pre' | 'post' | 'closed';

export interface SessionInfo {
  market: string;
  name: string;
  state: SessionState;
  label: string;
  openUTC: string;
  closeUTC: string;
  nextOpen?: string;
}

// ═══════════ Hook: useTradingSessions ═══════════════════

const ALL_MARKETS = ['US', 'HK', 'UK', 'CRYPTO'];

export function useTradingSessions(): { sessions: SessionInfo[]; activeCount: number } {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  useEffect(() => {
    const clock = new MarketClock();
    const results: SessionInfo[] = [];

    for (const market of ALL_MARKETS) {
      const displayName = getMarketDisplayName(market);
      try {
        const status = clock.getSessionStatus(market);
        let state: SessionState = 'closed';
        let label = '休市';

        if (status?.isOpen) {
          state = 'active';
          label = '交易中';
        } else if (status?.nextOpenMs != null && status.nextOpenMs < 3600000) {
          state = 'pre';
          label = '盘前';
        } else if (status?.nextCloseMs != null && status.nextCloseMs < 3600000) {
          state = 'post';
          label = '盘后';
        }

        results.push({
          market,
          name: displayName,
          state,
          label,
          openUTC: status?.session?.openUTC?.toISOString() || '—',
          closeUTC: status?.session?.closeUTC?.toISOString() || '—',
          nextOpen: status?.nextOpenAt?.toISOString?.(),
        });
      } catch {
        results.push({
          market,
          name: displayName,
          state: market === 'CRYPTO' ? 'active' : 'closed',
          label: market === 'CRYPTO' ? '24/7' : '—',
          openUTC: '—',
          closeUTC: '—',
        });
      }
    }

    setSessions(results);
  }, []);

  const activeCount = sessions.filter(s => s.state === 'active').length;

  return { sessions, activeCount };
}

// ═══════════ TradingSessionBar Component ═══════════════════

const STATE_STYLES: Record<SessionState, { dot: string; text: string; bg: string }> = {
  active:  { dot: 'bg-[#22c55e] animate-pulse', text: 'text-[#22c55e]', bg: 'bg-[#22c55e20]' },
  pre:     { dot: 'bg-[#f59e0b]', text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b20]' },
  post:    { dot: 'bg-[#3b82f6]', text: 'text-[#3b82f6]', bg: 'bg-[#3b82f620]' },
  closed:  { dot: 'bg-[#484f58]', text: 'text-[#484f58]', bg: 'bg-[#21262d]' },
};

export const TradingSessionBar: React.FC = () => {
  const { sessions, activeCount } = useTradingSessions();

  return (
    <div className="flex items-center gap-1 px-3 py-1 text-[10px] bg-[#161b22] border-b border-[#21262d] overflow-x-auto">
      <span className="text-[#8b949e] mr-1">Session:</span>
      {sessions.map(s => {
        const style = STATE_STYLES[s.state];
        return (
          <span
            key={s.market}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
            title={`${s.name}: ${s.openUTC.slice(11, 16)}-${s.closeUTC.slice(11, 16)} UTC`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {s.name} · {s.label}
          </span>
        );
      })}
      {activeCount === 0 && (
        <span className="text-[#484f58]">All markets closed</span>
      )}
    </div>
  );
};
