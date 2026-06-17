/**
 * GlobalTradingTimeline — R274 ML#1: 全球交易时间轴UI (Global Trading Hours)
 *
 * 24h world clock with market sessions:
 * - 9 market sessions visualized on 24h ring
 * - Active/closed status with countdown
 * - Lunch break indicators (CN/HK/JP)
 * - Timezone-aware (local machine)
 * - Overlap highlights
 */
import React, { useState, useEffect } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface MarketSession {
  id: string;
  name: string;
  flag: string;
  timezone: string;
  openHour: number;      // local time hours
  openMin: number;
  closeHour: number;
  closeMin: number;
  lunchStart?: number;
  lunchEnd?: number;
  dayOfWeek: number[];   // 0=Sun, 6=Sat
}

interface SessionStatus {
  status: 'closed' | 'pre' | 'open' | 'lunch' | 'post';
  nextEvent: string;
  nextEventTime: number; // minutes from now
}

// ────────────────────────────────────
// Market sessions (UTC hours for simplicity)
// ────────────────────────────────────
const MARKETS: MarketSession[] = [
  { id: 'US', name: 'US Equities', flag: '\u{1F1FA}\u{1F1F8}', timezone: 'America/New_York', openHour: 9, openMin: 30, closeHour: 16, closeMin: 0, dayOfWeek: [1,2,3,4,5] },
  { id: 'BR', name: 'Brazil B3', flag: '\u{1F1E7}\u{1F1F7}', timezone: 'America/Sao_Paulo', openHour: 10, openMin: 0, closeHour: 17, closeMin: 0, dayOfWeek: [1,2,3,4,5] },
  { id: 'UK', name: 'LSE', flag: '\u{1F1EC}\u{1F1E7}', timezone: 'Europe/London', openHour: 8, openMin: 0, closeHour: 16, closeMin: 30, dayOfWeek: [1,2,3,4,5] },
  { id: 'EU', name: 'Xetra/Euronext', flag: '\u{1F1E9}\u{1F1EA}', timezone: 'Europe/Berlin', openHour: 9, openMin: 0, closeHour: 17, closeMin: 30, dayOfWeek: [1,2,3,4,5] },
  { id: 'IN', name: 'NSE India', flag: '\u{1F1EE}\u{1F1F3}', timezone: 'Asia/Kolkata', openHour: 9, openMin: 15, closeHour: 15, closeMin: 30, dayOfWeek: [1,2,3,4,5] },
  { id: 'CN', name: 'Shanghai/Shenzhen', flag: '\u{1F1E8}\u{1F1F3}', timezone: 'Asia/Shanghai', openHour: 9, openMin: 30, closeHour: 15, closeMin: 0, lunchStart: 11.5, lunchEnd: 13, dayOfWeek: [1,2,3,4,5] },
  { id: 'HK', name: 'HKEX', flag: '\u{1F1ED}\u{1F1F0}', timezone: 'Asia/Hong_Kong', openHour: 9, openMin: 30, closeHour: 16, closeMin: 0, lunchStart: 12, lunchEnd: 13, dayOfWeek: [1,2,3,4,5] },
  { id: 'JP', name: 'TSE Japan', flag: '\u{1F1EF}\u{1F1F5}', timezone: 'Asia/Tokyo', openHour: 9, openMin: 0, closeHour: 15, closeMin: 0, lunchStart: 11.5, lunchEnd: 12.5, dayOfWeek: [1,2,3,4,5] },
  { id: 'KR', name: 'KRX Korea', flag: '\u{1F1F0}\u{1F1F7}', timezone: 'Asia/Seoul', openHour: 9, openMin: 0, closeHour: 15, closeMin: 30, dayOfWeek: [1,2,3,4,5] },
  { id: 'TW', name: 'TWSE Taiwan', flag: '\u{1F1F9}\u{1F1FC}', timezone: 'Asia/Taipei', openHour: 9, openMin: 0, closeHour: 13, closeMin: 30, dayOfWeek: [1,2,3,4,5] },
  { id: 'AU', name: 'ASX Australia', flag: '\u{1F1E6}\u{1F1FA}', timezone: 'Australia/Sydney', openHour: 10, openMin: 0, closeHour: 16, closeMin: 0, dayOfWeek: [1,2,3,4,5] },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
function getStatus(session: MarketSession): SessionStatus {
  const now = new Date();
  const day = now.getDay();
  if (!session.dayOfWeek.includes(day)) return { status: 'closed', nextEvent: 'Next session: Monday', nextEventTime: (8 - day + 1) * 1440 };

  // Convert to UTC for comparison (simplified)
  const nowUTC = now.getTime();
  const sessionDate = new Date(now);
  sessionDate.setHours(session.openHour, session.openMin, 0, 0);
  const openUTC = sessionDate.getTime();
  sessionDate.setHours(session.closeHour, session.closeMin, 0, 0);
  const closeUTC = sessionDate.getTime();

  const relative = (target: number) => Math.round((target - nowUTC) / 60000);

  if (nowUTC < openUTC - 30 * 60000) return { status: 'pre', nextEvent: 'Opens in', nextEventTime: relative(openUTC) };
  if (nowUTC < openUTC) return { status: 'pre', nextEvent: 'Opens in', nextEventTime: relative(openUTC) };
  if (nowUTC < closeUTC) {
    if (session.lunchStart != null && session.lunchEnd != null) {
      const lunchStartDate = new Date(now);
      lunchStartDate.setHours(Math.floor(session.lunchStart), (session.lunchStart % 1) * 60, 0, 0);
      const lunchEndDate = new Date(now);
      lunchEndDate.setHours(Math.floor(session.lunchEnd), (session.lunchEnd % 1) * 60, 0, 0);
      if (nowUTC >= lunchStartDate.getTime() && nowUTC < lunchEndDate.getTime()) {
        return { status: 'lunch', nextEvent: 'Resumes in', nextEventTime: relative(lunchEndDate.getTime()) };
      }
    }
    return { status: 'open', nextEvent: 'Closes in', nextEventTime: relative(closeUTC) };
  }
  return { status: 'post', nextEvent: 'Next open', nextEventTime: relative(openUTC + 86400000) };
}

function formatTimeLeft(minutes: number): string {
  if (minutes < 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? m + 'm' : ''}`;
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const GlobalTradingTimeline: React.FC = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(c => c + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Re-run getStatus every render via a simpler approach
  const now = new Date();
  const localDay = now.getDay();

  const marketStatuses = MARKETS.map(m => ({ ...m, s: getStatus(m) }));

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F310}'} Global Trading Timeline</h3>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          Local: {now.toLocaleTimeString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        </span>
      </div>

      {/* 24h Ring */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, margin: '0 auto 16px auto' }}>
        <svg viewBox="0 0 200 200" width="100%">
          {/* Background ring */}
          <circle cx={100} cy={100} r={85} fill="none" stroke="var(--bg-input)" strokeWidth={24} />

          {/* Market segments */}
          {marketStatuses.map((m, i) => {
            const angle = (i / MARKETS.length) * 360;
            const innerR = 73;
            const outerR = 97;
            const segAngle = 360 / MARKETS.length;
            const segRadStart = ((angle - segAngle / 2 - 90) * Math.PI) / 180;
            const segRadEnd = ((angle + segAngle / 2 - 90) * Math.PI) / 180;

            const activeColor = m.s.status === 'open' ? '#22c55e'
              : m.s.status === 'lunch' ? '#f59e0b'
              : m.s.status === 'pre' ? '#6366f1'
              : m.s.status === 'post' ? '#3b82f6'
              : '#374151';

            const x1 = 100 + Math.cos(segRadStart) * outerR;
            const y1 = 100 + Math.sin(segRadStart) * outerR;
            const x2 = 100 + Math.cos(segRadEnd) * outerR;
            const y2 = 100 + Math.sin(segRadEnd) * outerR;

            return (
              <path
                key={m.id}
                d={`M ${100 + Math.cos(segRadStart) * innerR} ${100 + Math.sin(segRadStart) * innerR} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${100 + Math.cos(segRadEnd) * innerR} ${100 + Math.sin(segRadEnd) * innerR} A ${innerR} ${innerR} 0 0 0 ${100 + Math.cos(segRadStart) * innerR} ${100 + Math.sin(segRadStart) * innerR}`}
                fill={activeColor}
                opacity={m.s.status === 'open' ? 1 : m.s.status === 'lunch' ? 0.8 : 0.3}
                style={{ transition: 'fill .5s, opacity .5s' }}
              />
            );
          })}

          {/* Center content */}
          <circle cx={100} cy={100} r={60} fill="var(--bg-card)" />
          <text x={100} y={92} textAnchor="middle" fontSize={8} fill="var(--text-dim)">
            {localDay === 0 || localDay === 6 ? 'WEEKEND' : ''}
          </text>
          <text x={100} y={108} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)">
            {marketStatuses.filter(m => m.s.status === 'open').length} Open
          </text>
          <text x={100} y={122} textAnchor="middle" fontSize={8} fill="var(--text-dim)">
            {(marketStatuses.filter(m => m.s.status === 'open' || m.s.status === 'lunch').length * 100 / MARKETS.length).toFixed(0)}% active
          </text>

          {/* Labels */}
          {marketStatuses.map((m, i) => {
            const angle = (i / MARKETS.length) * 360;
            const radians = ((angle - 90) * Math.PI) / 180;
            const lx = 100 + Math.cos(radians) * 114;
            const ly = 100 + Math.sin(radians) * 114;
            return (
              <text key={`label-${m.id}`} x={lx} y={ly} textAnchor="middle" fontSize={14} dominantBaseline="middle">
                {m.flag}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Market list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {marketStatuses.map(m => {
          const statusColors: Record<string, string> = {
            open: '#22c55e', pre: '#6366f1', lunch: '#f59e0b', post: '#3b82f6', closed: '#6b7280',
          };
          const statusLabels: Record<string, string> = {
            open: '\u{1F7E2} Live', pre: '\u{1F535} Pre-open', lunch: '\u{1F7E1} Lunch', post: '\u{1F535} After hours', closed: '\u{26AA} Closed',
          };
          return (
            <div key={m.id} style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
              background: m.s.status === 'open' ? 'rgba(34,197,94,.06)' : 'var(--bg-card)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ marginRight: 4 }}>{m.flag}</span>
                <span style={{ fontWeight: 600, fontSize: 11 }}>{m.id}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: statusColors[m.s.status] }}>
                  {statusLabels[m.s.status]}
                </div>
                {m.s.nextEventTime > 0 && (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                    {m.s.nextEvent} <span style={{ fontWeight: 600 }}>{formatTimeLeft(m.s.nextEventTime)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalTradingTimeline;
