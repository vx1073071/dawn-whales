// @ts-nocheck
/**
 * DAWN WHALES R125 J02 — Trading Session Indicator
 * 
 * Shows which market sessions are currently active.
 * US Pre/Regular/After | HK Morning/Afternoon | UK | Crypto 24/7
 */

import React, { useEffect, useState } from 'react';

// ═══════════ Types ═══════════════════════════

type SessionState = 'active' | 'pre' | 'post' | 'closed';

interface SessionInfo {
  market: string;
  name: string;
  state: SessionState;
  label: string;
  timeRange: string;
}

// ═══════════ Market Session Logic ═══════════════════════

function getSessionState(
  marketHours: { open: [number, number]; close: [number, number]; tz: string },
  preOpenMinutes?: number,
  postCloseMinutes?: number,
): SessionInfo {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const totalUtcMins = utcHour * 60 + utcMinutes;

  // Convert market hours to total minutes
  const openMins = marketHours.open[0] * 60 + marketHours.open[1];
  const closeMins = marketHours.close[0] * 60 + marketHours.close[1];
  const preOpenMins = preOpenMinutes ? openMins - preOpenMinutes : openMins - 60; // 1h pre-market
  const postCloseMins = postCloseMinutes ? closeMins + postCloseMinutes : closeMins + 60; // 1h after-market

  let state: SessionState;
  let label: string;

  if (totalUtcMins >= openMins && totalUtcMins < closeMins) {
    state = 'active';
    label = '交易中';
  } else if (preOpenMinutes && totalUtcMins >= preOpenMins && totalUtcMins < openMins) {
    state = 'pre';
    label = '盘前';
  } else if (postCloseMinutes && totalUtcMins >= closeMins && totalUtcMins < postCloseMins) {
    state = 'post';
    label = '盘后';
  } else {
    state = 'closed';
    label = '休市';
  }

  const formatTime = (h: number, m: number) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  return {
    market: marketHours.tz,
    name: marketHours.tz,
    state,
    label,
    timeRange: `${formatTime(marketHours.open[0], marketHours.open[1])}-${formatTime(marketHours.close[0], marketHours.close[1])} UTC`,
  };
}

const MARKET_HOURS: Record<string, { open: [number, number]; close: [number, number]; tz: string }> = {
  US:     { open: [14, 30], close: [21, 0], tz: '美股' },
  HK:     { open: [1, 30],  close: [8, 0],  tz: '港股' },
  UK:     { open: [8, 0],   close: [16, 30], tz: '英股' },
  CRYPTO: { open: [0, 0],   close: [23, 59], tz: '加密' },
  ASIA:   { open: [1, 0],   close: [8, 0],  tz: '亚太' },
};

// ═══════════ Hook ═══════════════════════════

export function useTradingSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const compute = () => {
      const results: SessionInfo[] = [
        getSessionState(MARKET_HOURS.US, 60, 60),   // 1h pre/post
        getSessionState(MARKET_HOURS.HK, 30, 0),    // 30min pre
        getSessionState(MARKET_HOURS.UK, 30, 30),
        getSessionState(MARKET_HOURS.CRYPTO),
        getSessionState(MARKET_HOURS.ASIA),
      ];
      setSessions(results);
      setActiveCount(results.filter(s => s.state === 'active').length);
    };

    compute();
    const timer = setInterval(compute, 30000);
    return () => clearInterval(timer);
  }, []);

  return { sessions, activeCount };
}

// ═══════════ Component ═══════════════════════════

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
            title={`${s.name}: ${s.timeRange}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {s.name} · {s.label}
          </span>
        );
      })}
      {activeCount === 0 && (
        <span className="text-[#484f58]">All closed</span>
      )}
    </div>
  );
};
