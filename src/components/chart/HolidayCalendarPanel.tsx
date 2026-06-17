/**
 * HolidayCalendarPanel — R274 ML#3: 假期日历叠加UI (Holiday Calendar Overlay)
 *
 * Global market holidays + trading calendar:
 * - 12-market holiday calendar
 * - Upcoming holidays in next 30 days
 * - Market closure impact warnings
 * - Half-day sessions
 * - Year view with monthly counts
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface Holiday {
  date: string;          // YYYY-MM-DD
  market: string;
  flag: string;
  name: string;
  type: 'full' | 'half' | 'early';
}

interface MarketHolidayStats {
  market: string;
  flag: string;
  upcoming: number;
  totalYear: number;
  nextHoliday: Holiday | null;
}

// ────────────────────────────────────
// Mock data — next 90 days
// ────────────────────────────────────
const MOCK_HOLIDAYS: Holiday[] = [
  // June
  { date: '2026-06-19', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'Juneteenth National Independence Day', type: 'full' },
  { date: '2026-06-22', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', name: 'Dragon Boat Festival (\u7AEF\u5348\u8282)', type: 'full' },
  // July
  { date: '2026-07-01', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', name: 'HKSAR Establishment Day', type: 'full' },
  { date: '2026-07-03', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'Independence Day (observed)', type: 'early' },
  { date: '2026-07-04', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'Independence Day', type: 'full' },
  { date: '2026-07-20', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', name: 'Marine Day (\u6D77\u306E\u65E5)', type: 'full' },
  // August
  { date: '2026-08-11', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', name: 'Mountain Day (\u5C71\u306E\u65E5)', type: 'full' },
  { date: '2026-08-15', market: 'IN', flag: '\u{1F1EE}\u{1F1F3}', name: 'Independence Day', type: 'full' },
  { date: '2026-08-15', market: 'KR', flag: '\u{1F1F0}\u{1F1F7}', name: 'Liberation Day (\uAD11\uBCF5\uC808)', type: 'full' },
  { date: '2026-08-25', market: 'IN', flag: '\u{1F1EE}\u{1F1F3}', name: 'Janmashtami', type: 'full' },
  { date: '2026-08-31', market: 'UK', flag: '\u{1F1EC}\u{1F1E7}', name: 'Summer Bank Holiday', type: 'full' },
  // September
  { date: '2026-09-01', market: 'BR', flag: '\u{1F1E7}\u{1F1F7}', name: 'Independence Day', type: 'full' },
  { date: '2026-09-07', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'Labor Day', type: 'full' },
  { date: '2026-09-15', market: 'TW', flag: '\u{1F1F9}\u{1F1FC}', name: 'Mid-Autumn Festival (\u4E2D\u79CB\u7BC0)', type: 'full' },
  { date: '2026-09-15', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', name: 'Mid-Autumn Festival (day after)', type: 'full' },
  { date: '2026-09-15', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', name: 'Mid-Autumn Festival', type: 'full' },
  { date: '2026-09-16', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', name: 'Day after Mid-Autumn', type: 'full' },
];

const MARKETS = [
  { id: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'US' },
  { id: 'CN', flag: '\u{1F1E8}\u{1F1F3}', name: 'China' },
  { id: 'HK', flag: '\u{1F1ED}\u{1F1F0}', name: 'HK' },
  { id: 'JP', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan' },
  { id: 'KR', flag: '\u{1F1F0}\u{1F1F7}', name: 'Korea' },
  { id: 'TW', flag: '\u{1F1F9}\u{1F1FC}', name: 'Taiwan' },
  { id: 'IN', flag: '\u{1F1EE}\u{1F1F3}', name: 'India' },
  { id: 'UK', flag: '\u{1F1EC}\u{1F1E7}', name: 'UK' },
  { id: 'EU', flag: '\u{1F1EA}\u{1F1FA}', name: 'EU' },
  { id: 'BR', flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil' },
  { id: 'AU', flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia' },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
function daysFromNow(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const HolidayCalendarPanel: React.FC = () => {
  const [filterMarket, setFilterMarket] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let h = MOCK_HOLIDAYS;
    if (filterMarket) h = h.filter(x => x.market === filterMarket);
    return h.sort((a, b) => a.date.localeCompare(b.date));
  }, [filterMarket]);

  // Market stats
  const marketStats: MarketHolidayStats[] = MARKETS.map(m => {
    const marketHolidays = MOCK_HOLIDAYS.filter(h => h.market === m.id);
    const upcoming = marketHolidays.filter(h => daysFromNow(h.date) >= 0 && daysFromNow(h.date) <= 30).length;
    const next = marketHolidays.sort((a, b) => a.date.localeCompare(b.date)).find(h => daysFromNow(h.date) >= 0) || null;
    return { market: m.id, flag: m.flag, upcoming, totalYear: marketHolidays.length, nextHoliday: next };
  });

  const totalUpcoming = marketStats.reduce((s, m) => s + m.upcoming, 0);
  const monthGroups = useMemo(() => {
    const groups: Record<string, Holiday[]> = {};
    filtered.forEach(h => {
      const month = h.date.slice(0, 7);
      if (!groups[month]) groups[month] = [];
      groups[month].push(h);
    });
    return groups;
  }, [filtered]);

  const monthNames: Record<string, string> = {
    '2026-06': 'Jun 2026', '2026-07': 'Jul 2026', '2026-08': 'Aug 2026', '2026-09': 'Sep 2026', '2026-10': 'Oct 2026',
  };

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F4C5}'} Global Holiday Calendar</h3>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {totalUpcoming} holidays in next 30 days
        </span>
      </div>

      {/* Market filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        <button onClick={() => setFilterMarket(null)} style={chipStyle(!filterMarket)}>All</button>
        {MARKETS.map(m => (
          <button key={m.id} onClick={() => setFilterMarket(m.id)} style={chipStyle(filterMarket === m.id)}>
            {m.flag} {m.id}
          </button>
        ))}
      </div>

      {/* KPI grid: per-market next holiday */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6, marginBottom: 14 }}>
        {marketStats.map(ms => (
          <div key={ms.market} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 11 }}>{ms.flag} {ms.market}</span>
              {ms.nextHoliday && (
                <span style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  background: daysFromNow(ms.nextHoliday.date) <= 3 ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)',
                  color: daysFromNow(ms.nextHoliday.date) <= 3 ? '#ef4444' : '#f59e0b',
                }}>
                  {daysFromNow(ms.nextHoliday.date) <= 1 ? 'Tomorrow!' : `${daysFromNow(ms.nextHoliday.date)}d`}
                </span>
              )}
            </div>
            {ms.nextHoliday ? (
              <>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{ms.nextHoliday.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {ms.nextHoliday.date} {' '}
                  <span style={{ color: ms.nextHoliday.type === 'full' ? '#ef4444' : '#f59e0b' }}>
                    {ms.nextHoliday.type === 'full' ? '\u{1F534} Closed' : '\u{1F7E1} Half/Early'}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>No upcoming</div>
            )}
          </div>
        ))}
      </div>

      {/* Monthly timeline */}
      {Object.entries(monthGroups).sort(([a], [b]) => a.localeCompare(b)).map(([month, holidays]) => (
        <div key={month} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--accent)' }}>
            {monthNames[month] || month}
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>
              {holidays.length} market closures
            </span>
          </div>

          {/* Timeline */}
          {holidays.map((h, i) => {
            const days = daysFromNow(h.date);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', marginBottom: 2,
                borderRadius: 4, background: days <= 2 ? 'rgba(239,68,68,.04)' : 'transparent',
                border: days <= 2 ? '1px solid rgba(239,68,68,.15)' : '1px solid transparent',
              }}>
                {/* Date badge */}
                <div style={{
                  minWidth: 80, textAlign: 'center', padding: '4px 8px', borderRadius: 4,
                  background: days <= 3 ? 'rgba(239,68,68,.12)' : 'var(--bg-input)',
                  fontSize: 10, fontWeight: 600,
                  color: days <= 3 ? '#ef4444' : 'var(--text)',
                }}>
                  {h.date.slice(5)}
                </div>

                {/* Market flag */}
                <span style={{ fontSize: 16 }}>{h.flag}</span>

                {/* Name */}
                <span style={{ flex: 1, fontSize: 11 }}>{h.name}</span>

                {/* Type badge */}
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  background: h.type === 'full' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                  color: h.type === 'full' ? '#ef4444' : '#f59e0b',
                }}>
                  {h.type === 'full' ? 'FULL CLOSE' : h.type === 'half' ? 'HALF DAY' : 'EARLY CLOSE'}
                </span>

                {/* Days countdown */}
                {days >= 0 && days <= 14 && (
                  <span style={{ fontSize: 9, color: days <= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                    {days === 0 ? 'TODAY' : `${days}d`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 10, cursor: 'pointer', fontWeight: active ? 700 : 400,
});

export default HolidayCalendarPanel;
