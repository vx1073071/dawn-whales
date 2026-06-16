import { useState, useEffect, useMemo } from 'react';

interface MarketClock {
  id: string;
  city: string;
  country: string;
  flag: string;
  exchange: string;
  timezone: string;
  utcOffset: number;
  openTime: string;
  closeTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  hasDST: boolean;
  isWeekend: boolean;
}

const CLOCKS: MarketClock[] = [
  { id: 'ny', city: 'New York', country: 'USA', flag: '🇺🇸', exchange: 'NYSE', timezone: 'America/New_York', utcOffset: -4, openTime: '09:30', closeTime: '16:00', hasDST: true, isWeekend: false },
  { id: 'chi', city: 'Chicago', country: 'USA', flag: '🇺🇸', exchange: 'CME', timezone: 'America/Chicago', utcOffset: -5, openTime: '08:30', closeTime: '15:15', hasDST: true, isWeekend: false },
  { id: 'ldn', city: 'London', country: 'UK', flag: '🇬🇧', exchange: 'LSE', timezone: 'Europe/London', utcOffset: 1, openTime: '08:00', closeTime: '16:30', hasDST: true, isWeekend: false },
  { id: 'fra', city: 'Frankfurt', country: 'Germany', flag: '🇩🇪', exchange: 'Xetra', timezone: 'Europe/Berlin', utcOffset: 2, openTime: '09:00', closeTime: '17:30', hasDST: true, isWeekend: false },
  { id: 'hkg', city: 'Hong Kong', country: 'China', flag: '🇭🇰', exchange: 'HKEX', timezone: 'Asia/Hong_Kong', utcOffset: 8, openTime: '09:30', closeTime: '16:00', lunchStart: '12:00', lunchEnd: '13:00', hasDST: false, isWeekend: false },
  { id: 'sha', city: 'Shanghai', country: 'China', flag: '🇨🇳', exchange: 'SSE', timezone: 'Asia/Shanghai', utcOffset: 8, openTime: '09:30', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '13:00', hasDST: false, isWeekend: false },
  { id: 'tyo', city: 'Tokyo', country: 'Japan', flag: '🇯🇵', exchange: 'JPX', timezone: 'Asia/Tokyo', utcOffset: 9, openTime: '09:00', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '12:30', hasDST: false, isWeekend: false },
  { id: 'sel', city: 'Seoul', country: 'Korea', flag: '🇰🇷', exchange: 'KRX', timezone: 'Asia/Seoul', utcOffset: 9, openTime: '09:00', closeTime: '15:30', hasDST: false, isWeekend: false },
  { id: 'syd', city: 'Sydney', country: 'Australia', flag: '🇦🇺', exchange: 'ASX', timezone: 'Australia/Sydney', utcOffset: 10, openTime: '10:00', closeTime: '16:00', hasDST: false, isWeekend: false },
  { id: 'sgp', city: 'Singapore', country: 'Singapore', flag: '🇸🇬', exchange: 'SGX', timezone: 'Asia/Singapore', utcOffset: 8, openTime: '09:00', closeTime: '17:00', lunchStart: '12:00', lunchEnd: '13:00', hasDST: false, isWeekend: false },
  { id: 'bom', city: 'Mumbai', country: 'India', flag: '🇮🇳', exchange: 'NSE', timezone: 'Asia/Kolkata', utcOffset: 5.5, openTime: '09:15', closeTime: '15:30', hasDST: false, isWeekend: false },
  { id: 'tpe', city: 'Taipei', country: 'Taiwan', flag: '🇹🇼', exchange: 'TWSE', timezone: 'Asia/Taipei', utcOffset: 8, openTime: '09:00', closeTime: '13:30', hasDST: false, isWeekend: false },
  { id: 'sp', city: 'São Paulo', country: 'Brazil', flag: '🇧🇷', exchange: 'B3', timezone: 'America/Sao_Paulo', utcOffset: -3, openTime: '10:00', closeTime: '17:00', hasDST: false, isWeekend: false },
  { id: 'crypto', city: 'Crypto', country: 'Global', flag: '🪙', exchange: '24/7', timezone: 'UTC', utcOffset: 0, openTime: '00:00', closeTime: '23:59', hasDST: false, isWeekend: false },
];

function getSessionState(clock: MarketClock): { status: 'open' | 'closed' | 'lunch' | 'pre'; label: string; color: string; progress: number } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + clock.utcOffset * 3600000);
  const mins = local.getHours() * 60 + local.getMinutes();
  const day = local.getDay();

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const open = parseTime(clock.openTime);
  const close = parseTime(clock.closeTime);

  if (clock.id === 'crypto') return { status: 'open', label: '24/7', color: '#22c55e', progress: 100 };

  if (day === 0 || day === 6) return { status: 'closed', label: 'Weekend', color: '#6b7280', progress: 0 };

  if (mins < open - 60) return { status: 'closed', label: `Opens ${clock.openTime}`, color: '#6b7280', progress: 0 };
  if (mins >= open - 60 && mins < open) return { status: 'pre', label: 'Pre-open', color: '#60a5fa', progress: 0 };

  if (clock.lunchStart && clock.lunchEnd) {
    const ls = parseTime(clock.lunchStart);
    const le = parseTime(clock.lunchEnd);
    if (mins >= ls && mins < le) return { status: 'lunch', label: 'Lunch Break', color: '#f59e0b', progress: 100 };
  }

  if (mins >= open && mins < close) {
    let total = close - open;
    let elapsed = mins - open;
    if (clock.lunchStart && clock.lunchEnd) {
      const ls = parseTime(clock.lunchStart);
      const le = parseTime(clock.lunchEnd);
      if (mins > le) {
        total -= (le - ls);
        elapsed -= (le - ls);
      }
    }
    const progress = Math.min(100, Math.round((elapsed / total) * 100));
    return { status: 'open', label: 'Trading', color: '#22c55e', progress };
  }

  return { status: 'closed', label: 'Closed', color: '#6b7280', progress: 100 };
}

export default function ClockUI() {
  const [now, setNow] = useState(new Date());
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [showDST] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessions = useMemo(() => CLOCKS.map(c => ({ ...c, session: getSessionState(c) })), [now]);

  const regions = ['ALL', 'Americas', 'Europe', 'Asia', 'Other'];
  const regionMap: Record<string, string[]> = {
    Americas: ['ny', 'chi', 'sp'],
    Europe: ['ldn', 'fra'],
    Asia: ['hkg', 'sha', 'tyo', 'sel', 'syd', 'sgp', 'bom', 'tpe'],
    Other: ['crypto'],
  };

  const filtered = selectedRegion === 'ALL' ? sessions : sessions.filter(s => regionMap[selectedRegion]?.includes(s.id));

  const openCount = sessions.filter(s => s.session.status === 'open').length;
  const lunchCount = sessions.filter(s => s.session.status === 'lunch').length;

  const formatTime = (d: Date, offset: number) => {
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const local = new Date(utc + offset * 3600000);
    return local.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const statusColors: Record<string, string> = { open: '#22c55e', closed: '#6b7280', lunch: '#f59e0b', pre: '#60a5fa' };

  return (
    <div className="clk-container">
      <div className="clk-header">
        <div className="clk-title-row">
          <span className="clk-icon">🕐</span>
          <span className="clk-title">World Clock</span>
          <span className="clk-live-dot">●</span>
          <span className="clk-current-time">{now.toLocaleTimeString()}</span>
        </div>
        <div className="clk-stats">
          <span style={{ color: '#22c55e' }}>{openCount} open</span>
          {lunchCount > 0 && <span style={{ color: '#f59e0b' }}>{lunchCount} lunch</span>}
        </div>
      </div>

      <div className="clk-controls">
        <div className="clk-region-chips">
          {regions.map(r => (
            <button key={r} className={`clk-chip ${selectedRegion === r ? 'active' : ''}`} onClick={() => setSelectedRegion(r)}>
              {r === 'ALL' ? '🌍 All' : r}
            </button>
          ))}
        </div>
        <div className="clk-view-group">
          <button className={`clk-vbtn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
          <button className={`clk-vbtn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>≡</button>
          <button className={`clk-vbtn ${viewMode === 'compact' ? 'active' : ''}`} onClick={() => setViewMode('compact')}>⊟</button>
        </div>
      </div>

      {viewMode === 'grid' && (
        <div className="clk-grid">
          {filtered.map(c => (
            <div key={c.id} className={`clk-card clk-${c.session.status}`}>
              <div className="clk-card-hdr">
                <span className="clk-flag">{c.flag}</span>
                <span className="clk-city">{c.city}</span>
                <span className="clk-local-time">{formatTime(now, c.utcOffset)}</span>
              </div>
              <div className="clk-card-body">
                <span className="clk-exchange">{c.exchange}</span>
                <span className="clk-hours">{c.openTime}–{c.closeTime}</span>
                {showDST && c.hasDST && <span className="clk-dst">DST</span>}
              </div>
              <div className={`clk-session-bar clk-session-${c.session.status}`}>
                <span className="clk-session-dot" style={{ backgroundColor: statusColors[c.session.status] }} />
                <span className="clk-session-label" style={{ color: statusColors[c.session.status] }}>{c.session.label}</span>
                {c.session.status === 'open' && c.id !== 'crypto' && (
                  <div className="clk-progress">
                    <div className="clk-progress-fill" style={{ width: `${c.session.progress}%` }} />
                  </div>
                )}
              </div>
              {c.session.status === 'open' && c.id !== 'crypto' && (
                <span className="clk-pct">{c.session.progress}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="clk-list">
          <div className="clk-list-header">
            <span>Exchange</span><span>City</span><span>Time</span><span>Session</span><span>Progress</span>
          </div>
          {filtered.map(c => (
            <div key={c.id} className="clk-list-row">
              <span className="clk-list-flag">{c.flag}</span>
              <span className="clk-list-exchange">{c.exchange}</span>
              <span className="clk-list-city">{c.city}</span>
              <span className="clk-list-time">{formatTime(now, c.utcOffset)}</span>
              <span className="clk-list-session" style={{ color: statusColors[c.session.status] }}>{c.session.label}</span>
              <span className="clk-list-progress">
                {c.session.status === 'open' && c.id !== 'crypto' && (
                  <div className="clk-progress"><div className="clk-progress-fill" style={{ width: `${c.session.progress}%` }} /></div>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'compact' && (
        <div className="clk-compact">
          {filtered.map(c => (
            <div key={c.id} className={`clk-compact-item clk-${c.session.status}`}>
              <span className="clk-flag">{c.flag}</span>
              <span className="clk-compact-time">{formatTime(now, c.utcOffset)}</span>
              <span className="clk-compact-city">{c.city}</span>
              <span className="clk-compact-dot" style={{ backgroundColor: statusColors[c.session.status] }} />
            </div>
          ))}
        </div>
      )}

      <style>{`
        .clk-container { background:var(--bg-surface,#0d1117); border:1px solid #21262d; border-radius:12px; padding:14px; color:#c9d1d9; font-family:'Inter',-apple-system,sans-serif; }
        .clk-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .clk-title-row { display:flex; align-items:center; gap:8px; }
        .clk-icon { font-size:18px; }
        .clk-title { font-size:15px; font-weight:700; }
        .clk-live-dot { color:#22c55e; font-size:8px; animation:clk-pulse 2s ease-in-out infinite; }
        @keyframes clk-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .clk-current-time { font-size:14px; font-weight:600; font-variant-numeric:tabular-nums; }
        .clk-stats { display:flex; gap:8px; font-size:11px; }
        .clk-controls { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:4px; }
        .clk-region-chips { display:flex; gap:3px; }
        .clk-chip { background:none; border:1px solid #30363d; color:#8b949e; border-radius:10px; padding:2px 8px; font-size:10px; cursor:pointer; }
        .clk-chip.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .clk-view-group { display:flex; gap:1px; }
        .clk-vbtn { background:none; border:1px solid #30363d; color:#8b949e; border-radius:4px; padding:2px 6px; font-size:13px; cursor:pointer; }
        .clk-vbtn.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .clk-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:8px; }
        .clk-card { background:#161b22; border:1px solid #21262d; border-radius:10px; padding:10px; transition:all 0.2s; }
        .clk-card.clk-open { border-color:rgba(34,197,94,0.3); }
        .clk-card.clk-lunch { border-color:rgba(251,191,36,0.3); }
        .clk-card.clk-pre { border-color:rgba(96,165,250,0.3); }
        .clk-card-hdr { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .clk-flag { font-size:16px; }
        .clk-city { font-size:13px; font-weight:600; flex:1; }
        .clk-local-time { font-size:14px; font-weight:700; font-variant-numeric:tabular-nums; color:#58a6ff; }
        .clk-card-body { display:flex; gap:8px; font-size:10px; color:#8b949e; margin-bottom:6px; }
        .clk-exchange { }
        .clk-hours { color:#484f58; }
        .clk-dst { background:rgba(139,92,246,0.15); color:#a78bfa; padding:0 4px; border-radius:3px; font-size:9px; }
        .clk-session-bar { display:flex; align-items:center; gap:4px; font-size:10px; }
        .clk-session-dot { width:6px; height:6px; border-radius:50%; }
        .clk-session-label { font-weight:500; }
        .clk-progress { flex:1; height:3px; background:#21262d; border-radius:2px; overflow:hidden; }
        .clk-progress-fill { height:100%; background:#22c55e; border-radius:2px; transition:width 1s ease; }
        .clk-pct { font-size:9px; color:#484f58; display:block; text-align:right; margin-top:2px; }
        .clk-list { }
        .clk-list-header { display:flex; gap:8px; padding:4px 8px; font-size:9px; color:#484f58; text-transform:uppercase; border-bottom:1px solid #21262d; margin-bottom:4px; }
        .clk-list-header span { flex:1; }
        .clk-list-row { display:flex; align-items:center; gap:8px; padding:5px 8px; font-size:11px; border-radius:4px; }
        .clk-list-row:hover { background:rgba(22,27,34,0.5); }
        .clk-list-flag { width:20px; }
        .clk-list-exchange, .clk-list-city, .clk-list-time, .clk-list-session, .clk-list-progress { flex:1; }
        .clk-list-time { font-variant-numeric:tabular-nums; color:#58a6ff; font-weight:600; }
        .clk-compact { display:flex; gap:4px; flex-wrap:wrap; }
        .clk-compact-item { display:flex; align-items:center; gap:4px; padding:4px 8px; border-radius:6px; font-size:11px; background:#161b22; border:1px solid #21262d; }
        .clk-compact-time { font-variant-numeric:tabular-nums; font-weight:600; color:#58a6ff; }
        .clk-compact-city { color:#8b949e; }
        .clk-compact-dot { width:6px; height:6px; border-radius:50%; }
      `}</style>
    </div>
  );
}
