import { useState, useEffect, useCallback, useRef } from 'react';

// ── types ──────────────────────────────────────────────────
interface MarketSession {
  market: string;
  nameEn: string;
  nameCn: string;
  timezone: string;
  utcOffset: number;
  opens: string;   // HH:mm local
  closes: string;  // HH:mm local
  lunchStart?: string;
  lunchEnd?: string;
  dayOfWeek: number[]; // 1=Mon .. 5=Fri
  hasDST: boolean;
  flag: string;
  status: 'open' | 'closed' | 'lunch' | 'pre-market' | 'after-hours';
  nextEvent: string;
  nextEventTime: string;
  progress: number; // 0..100
}

const MARKET_CONFIGS: Omit<MarketSession, 'status' | 'nextEvent' | 'nextEventTime' | 'progress'>[] = [
  { market: 'US', nameEn: 'NYSE / NASDAQ', nameCn: '美股', timezone: 'America/New_York', utcOffset: -4, opens: '09:30', closes: '16:00', dayOfWeek: [1,2,3,4,5], hasDST: true, flag: '🇺🇸' },
  { market: 'HK', nameEn: 'HKEX', nameCn: '港股', timezone: 'Asia/Hong_Kong', utcOffset: 8, opens: '09:30', closes: '16:00', lunchStart: '12:00', lunchEnd: '13:00', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇭🇰' },
  { market: 'CN', nameEn: 'SSE / SZSE', nameCn: 'A股', timezone: 'Asia/Shanghai', utcOffset: 8, opens: '09:30', closes: '15:00', lunchStart: '11:30', lunchEnd: '13:00', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇨🇳' },
  { market: 'JP', nameEn: 'JPX', nameCn: '日股', timezone: 'Asia/Tokyo', utcOffset: 9, opens: '09:00', closes: '15:00', lunchStart: '11:30', lunchEnd: '12:30', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇯🇵' },
  { market: 'UK', nameEn: 'LSE', nameCn: '英股', timezone: 'Europe/London', utcOffset: 1, opens: '08:00', closes: '16:30', dayOfWeek: [1,2,3,4,5], hasDST: true, flag: '🇬🇧' },
  { market: 'DE', nameEn: 'Xetra', nameCn: '德股', timezone: 'Europe/Berlin', utcOffset: 2, opens: '09:00', closes: '17:30', dayOfWeek: [1,2,3,4,5], hasDST: true, flag: '🇩🇪' },
  { market: 'KR', nameEn: 'KRX', nameCn: '韩股', timezone: 'Asia/Seoul', utcOffset: 9, opens: '09:00', closes: '15:30', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇰🇷' },
  { market: 'TW', nameEn: 'TWSE', nameCn: '台股', timezone: 'Asia/Taipei', utcOffset: 8, opens: '09:00', closes: '13:30', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇹🇼' },
  { market: 'AU', nameEn: 'ASX', nameCn: '澳股', timezone: 'Australia/Sydney', utcOffset: 10, opens: '10:00', closes: '16:00', dayOfWeek: [1,2,3,4,5], hasDST: true, flag: '🇦🇺' },
  { market: 'SG', nameEn: 'SGX', nameCn: '新加', timezone: 'Asia/Singapore', utcOffset: 8, opens: '09:00', closes: '17:00', lunchStart: '12:00', lunchEnd: '13:00', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇸🇬' },
  { market: 'IN', nameEn: 'NSE / BSE', nameCn: '印度', timezone: 'Asia/Kolkata', utcOffset: 5.5, opens: '09:15', closes: '15:30', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇮🇳' },
  { market: 'BR', nameEn: 'B3', nameCn: '巴西', timezone: 'America/Sao_Paulo', utcOffset: -3, opens: '10:00', closes: '17:00', dayOfWeek: [1,2,3,4,5], hasDST: false, flag: '🇧🇷' },
  { market: 'Crypto', nameEn: 'Crypto 24/7', nameCn: '加密', timezone: 'UTC', utcOffset: 0, opens: '00:00', closes: '23:59', dayOfWeek: [0,1,2,3,4,5,6], hasDST: false, flag: '🪙' },
];

// ── helpers ─────────────────────────────────────────────────
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getNowUTC(): Date {
  return new Date();
}

function getMarketNow(utcOffset: number): Date {
  const now = getNowUTC();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + utcOffset * 3600000);
}

function computeSession(m: typeof MARKET_CONFIGS[0]): MarketSession {
  const now = getMarketNow(m.utcOffset);
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  const openMin = timeToMinutes(m.opens);
  const closeMin = timeToMinutes(m.closes);
  const lunchStart = m.lunchStart ? timeToMinutes(m.lunchStart) : null;
  const lunchEnd = m.lunchEnd ? timeToMinutes(m.lunchEnd) : null;

  let status: MarketSession['status'] = 'closed';
  let nextEvent = '';
  let nextEventTime = '';
  let progress = 0;

  if (!m.dayOfWeek.includes(day)) {
    status = 'closed';
    // find next trading day
    let daysAhead = 0;
    for (let d = 1; d <= 7; d++) {
      if (m.dayOfWeek.includes((day + d) % 7)) { daysAhead = d; break; }
    }
    nextEvent = 'Opens in';
    nextEventTime = `${daysAhead}d`;
  } else if (minutes < openMin) {
    // pre-market
    if (m.market === 'US' && minutes >= timeToMinutes('04:00')) {
      status = 'pre-market';
      progress = 0;
    } else {
      status = 'closed';
    }
    nextEvent = 'Opens at';
    nextEventTime = m.opens;
  } else if (lunchStart && lunchEnd && minutes >= lunchStart && minutes < lunchEnd) {
    status = 'lunch';
    progress = 100;
    nextEvent = 'Lunch ends';
    nextEventTime = m.lunchEnd || '';
  } else if (minutes >= openMin && minutes < closeMin) {
    status = 'open';
    const total = closeMin - openMin - (lunchStart && lunchEnd ? (lunchEnd - lunchStart) : 0);
    let elapsed = minutes - openMin;
    if (lunchStart && lunchEnd && minutes > lunchEnd) {
      elapsed -= (lunchEnd - lunchStart);
    }
    progress = Math.min(100, Math.round((elapsed / total) * 100));
    nextEvent = 'Closes at';
    nextEventTime = m.closes;
  } else if (minutes >= closeMin && minutes < closeMin + 120) {
    status = 'after-hours';
    progress = 100;
    nextEvent = 'Closed';
    nextEventTime = 'tomorrow';
  } else {
    status = 'closed';
    nextEvent = 'Opens tomorrow';
    nextEventTime = m.opens;
  }

  return { ...m, status, nextEvent, nextEventTime, progress };
}

// ── countdown component ─────────────────────────────────────
interface CountdownProps {
  targetMinutes: number;
  utcOffset: number;
  label: string;
}

function CountdownTimer({ targetMinutes, utcOffset, label }: CountdownProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = getMarketNow(utcOffset);
      const mins = now.getHours() * 60 + now.getMinutes();
      const secs = now.getSeconds();
      const diff = (targetMinutes - mins) * 60 - secs;
      setRemaining(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMinutes, utcOffset]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  return (
    <div className="countdown-timer">
      <span className="countdown-label">{label}</span>
      <span className="countdown-digits">
        {remaining > 0
          ? `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
          : 'Now'}
      </span>
    </div>
  );
}

// ── main component ──────────────────────────────────────────
export default function GlobalMarketClockCountdown() {
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'ticker'>('grid');
  const [compact, setCompact] = useState(false);
  const intervalRef = useRef<number>();

  const refresh = useCallback(() => {
    setSessions(MARKET_CONFIGS.map(computeSession));
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = window.setInterval(refresh, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh]);

  const openMarkets = sessions.filter(s => s.status === 'open' || s.status === 'lunch');
  const upcomingOpen = sessions.filter(s => s.status === 'closed' || s.status === 'pre-market')
    .sort((a, b) => {
      const na = getMarketNow(a.utcOffset);
      const nb = getMarketNow(b.utcOffset);
      return timeToMinutes(a.opens) - na.getHours() * 60 - na.getMinutes() >
        timeToMinutes(b.opens) - nb.getHours() * 60 - nb.getMinutes() ? 1 : -1;
    });

  const statusColors: Record<string, string> = {
    'open': '#22c55e',
    'closed': '#6b7280',
    'lunch': '#f59e0b',
    'pre-market': '#3b82f6',
    'after-hours': '#8b5cf6',
  };

  const statusLabels: Record<string, string> = {
    'open': '● Live',
    'closed': '○ Closed',
    'lunch': '◐ Lunch',
    'pre-market': '◑ Pre',
    'after-hours': '◑ AH',
  };

  return (
    <div className={`gmk-clock ${compact ? 'gmk-compact' : ''}`}>
      {/* header */}
      <div className="gmk-header">
        <div className="gmk-title">
          <span className="gmk-icon">🕐</span>
          <span>Global Market Clock</span>
        </div>
        <div className="gmk-controls">
          <span className="gmk-stat">
            {openMarkets.length}/{sessions.length} open
          </span>
          <button
            className={`gmk-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >⊞</button>
          <button
            className={`gmk-mode-btn ${viewMode === 'ticker' ? 'active' : ''}`}
            onClick={() => setViewMode('ticker')}
            title="Ticker view"
          >≡</button>
          <button
            className={`gmk-mode-btn ${compact ? 'active' : ''}`}
            onClick={() => setCompact(!compact)}
            title="Compact"
          >⊟</button>
        </div>
      </div>

      {/* upcoming open bar */}
      {upcomingOpen.length > 0 && upcomingOpen[0].status !== 'open' && (
        <div className="gmk-upcoming-bar">
          <span className="gmk-upcoming-icon">⏰</span>
          <span>Next: {upcomingOpen[0].flag} {upcomingOpen[0].nameEn} opens at {upcomingOpen[0].opens}</span>
          <CountdownTimer
            targetMinutes={timeToMinutes(upcomingOpen[0].opens)}
            utcOffset={upcomingOpen[0].utcOffset}
            label=""
          />
        </div>
      )}

      {/* grid view */}
      {viewMode === 'grid' && (
        <div className="gmk-grid">
          {sessions.map(s => (
            <div key={s.market} className={`gmk-card gmk-status-${s.status}`}>
              <div className="gmk-card-top">
                <span className="gmk-flag">{s.flag}</span>
                <span className="gmk-market-name">{s.nameEn}</span>
                <span className="gmk-status-dot" style={{ color: statusColors[s.status] }}>
                  {statusLabels[s.status]}
                </span>
              </div>
              {!compact && (
                <>
                  <div className="gmk-card-hours">
                    <span>🕘 {s.opens} – {s.closes}</span>
                    <span>{s.hasDST ? 'DST' : ''}</span>
                  </div>
                  {s.status === 'open' && (
                    <div className="gmk-progress-bar">
                      <div className="gmk-progress-fill" style={{ width: `${s.progress}%` }} />
                      <span className="gmk-progress-text">{s.progress}%</span>
                    </div>
                  )}
                  {s.status === 'lunch' && (
                    <div className="gmk-lunch-banner">🍱 Lunch break</div>
                  )}
                  <div className="gmk-next-event">
                    <span>{s.nextEvent}: {s.nextEventTime}</span>
                  </div>
                </>
              )}
              {compact && (s.status === 'open' || s.status === 'lunch') && (
                <div className="gmk-progress-bar">
                  <div className="gmk-progress-fill" style={{ width: `${s.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ticker view */}
      {viewMode === 'ticker' && (
        <div className="gmk-ticker-list">
          {sessions.map(s => (
            <div key={s.market} className="gmk-ticker-row">
              <span className="gmk-flag">{s.flag}</span>
              <span className="gmk-market-name">{compact ? s.market : s.nameEn}</span>
              <span className="gmk-status-dot" style={{ color: statusColors[s.status] }}>
                {statusLabels[s.status]}
              </span>
              {s.status === 'open' && (
                <div className="gmk-progress-bar gmk-progress-inline">
                  <div className="gmk-progress-fill" style={{ width: `${s.progress}%` }} />
                </div>
              )}
              <span className="gmk-next-event">{s.nextEvent}: {s.nextEventTime}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .gmk-clock {
          background: var(--bg-surface, #1a1a2e);
          border: 1px solid var(--border, #2a2a4a);
          border-radius: 12px;
          padding: 16px;
          color: var(--text-primary, #e2e8f0);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .gmk-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px; padding-bottom: 8px;
          border-bottom: 1px solid var(--border, #2a2a4a);
        }
        .gmk-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .gmk-icon { font-size: 18px; }
        .gmk-controls { display: flex; align-items: center; gap: 8px; }
        .gmk-stat { font-size: 11px; color: #9ca3af; }
        .gmk-mode-btn {
          background: none; border: 1px solid #3a3a5a; color: #9ca3af;
          border-radius: 6px; padding: 2px 8px; cursor: pointer; font-size: 14px;
        }
        .gmk-mode-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .gmk-upcoming-bar {
          background: linear-gradient(135deg, #1e3a5f, #162447);
          border: 1px solid #3b82f6; border-radius: 8px;
          padding: 8px 12px; margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: #93c5fd;
        }
        .gmk-upcoming-icon { font-size: 16px; }
        .countdown-timer { display: flex; gap: 6px; margin-left: auto; font-variant-numeric: tabular-nums; }
        .countdown-digits { color: #60a5fa; font-weight: 600; }
        .countdown-label { color: #9ca3af; font-size: 11px; }
        .gmk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .gmk-card {
          background: var(--bg-card, #162032); border: 1px solid #2a2a4a;
          border-radius: 10px; padding: 12px; transition: all 0.2s;
        }
        .gmk-card.gmk-status-open { border-color: #22c55e; box-shadow: 0 0 12px rgba(34,197,94,0.1); }
        .gmk-card.gmk-status-lunch { border-color: #f59e0b; }
        .gmk-card.gmk-status-pre-market { border-color: #3b82f6; }
        .gmk-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .gmk-flag { font-size: 18px; }
        .gmk-market-name { font-size: 13px; font-weight: 500; flex: 1; }
        .gmk-status-dot { font-size: 11px; font-weight: 500; }
        .gmk-card-hours { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
        .gmk-progress-bar {
          height: 4px; background: #2a2a4a; border-radius: 2px;
          margin-bottom: 4px; position: relative; overflow: hidden;
        }
        .gmk-progress-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, #22c55e, #4ade80);
          transition: width 1s ease;
        }
        .gmk-progress-text { position: absolute; right: 0; top: -16px; font-size: 10px; color: #9ca3af; }
        .gmk-progress-inline { flex: 1; max-width: 120px; margin: 0; }
        .gmk-lunch-banner { font-size: 10px; color: #f59e0b; text-align: center; margin: 4px 0; }
        .gmk-next-event { font-size: 10px; color: #6b7280; }
        .gmk-ticker-list { display: flex; flex-direction: column; gap: 6px; }
        .gmk-ticker-row {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; border-radius: 6px;
          background: var(--bg-card, #162032); border: 1px solid #2a2a4a;
        }
        .gmk-ticker-row .gmk-market-name { min-width: 100px; }
        .gmk-compact .gmk-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        .gmk-compact .gmk-card { padding: 8px 10px; }
      `}</style>
    </div>
  );
}
