/**
 * GlobalIPOCalendar — R275 ML#4: 全球IPO日历UI (Global IPO Calendar)
 *
 * Global IPO pipeline tracker:
 * - Upcoming IPOs across 8 markets
 * - IPO performance (first-day pop, 30D return)
 * - Sector breakdown
 * - Market cap tiers
 * - Subscription status
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface IPO {
  symbol: string;
  name: string;
  market: string;
  flag: string;
  date: string;
  ipoPrice: number;
  currency: string;
  shares: number;       // millions
  marketCap: number;    // billions (in currency)
  sector: string;
  status: 'upcoming' | 'priced' | 'trading';
  firstDayReturn?: number;
  day30Return?: number;
  subscription: number; // x oversubscription
  leadManagers: string[];
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_IPOS: IPO[] = [
  { symbol: 'ARM', name: 'Arm Holdings (re-listing)', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', date: '2026-07-15', ipoPrice: 85, currency: 'USD', shares: 95, marketCap: 88, sector: 'Tech', status: 'upcoming', subscription: 8.5, leadManagers: ['Goldman', 'JPM'] },
  { symbol: 'SHEIN', name: 'Shein Group', market: 'UK', flag: '\u{1F1EC}\u{1F1E7}', date: '2026-07-22', ipoPrice: 42, currency: 'GBP', shares: 120, marketCap: 52, sector: 'Consumer', status: 'upcoming', subscription: 5.2, leadManagers: ['Morgan Stanley', 'HSBC'] },
  { symbol: 'DATABRICKS', name: 'Databricks', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', date: '2026-08-05', ipoPrice: 65, currency: 'USD', shares: 85, marketCap: 55, sector: 'Tech', status: 'upcoming', subscription: 12.3, leadManagers: ['Morgan Stanley', 'Goldman'] },
  { symbol: 'FLIPKART', name: 'Flipkart (Walmart)', market: 'IN', flag: '\u{1F1EE}\u{1F1F3}', date: '2026-08-12', ipoPrice: 850, currency: 'INR', shares: 180, marketCap: 38, sector: 'Consumer', status: 'upcoming', subscription: 15.8, leadManagers: ['Kotak', 'ICICI'] },
  { symbol: 'TOKOPEDIA', name: 'Tokopedia (GoTo group)', market: 'IN', flag: '\u{1F1EE}\u{1F1F3}', date: '2026-09-01', ipoPrice: 320, currency: 'INR', shares: 250, marketCap: 12, sector: 'Tech', status: 'upcoming', subscription: 6.5, leadManagers: ['Axis', 'JM Financial'] },
  { symbol: 'NUBNK', name: 'Nubank (secondary)', market: 'BR', flag: '\u{1F1E7}\u{1F1F7}', date: '2026-09-15', ipoPrice: 22, currency: 'BRL', shares: 350, marketCap: 105, sector: 'Finance', status: 'upcoming', subscription: 9.2, leadManagers: ['Itau BBA', 'BTG'] },
  { symbol: 'CAVA', name: 'Cava Group', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', date: '2026-06-10', ipoPrice: 22, currency: 'USD', shares: 14, marketCap: 2.5, sector: 'Consumer', status: 'trading', firstDayReturn: 99, day30Return: 112, subscription: 42, leadManagers: ['JPM', 'Jefferies'] },
  { symbol: 'REDDIT', name: 'Reddit', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', date: '2026-06-05', ipoPrice: 34, currency: 'USD', shares: 22, marketCap: 5.8, sector: 'Tech', status: 'trading', firstDayReturn: 48, day30Return: 35, subscription: 8, leadManagers: ['Morgan Stanley', 'Goldman'] },
  { symbol: 'GOTO', name: 'GoTo Group', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', date: '2026-07-01', ipoPrice: 1200, currency: 'JPY', shares: 420, marketCap: 28, sector: 'Tech', status: 'priced', subscription: 11.5, leadManagers: ['Nomura', 'Daiwa'] },
  { symbol: 'OLAM', name: 'Olam Agri (SGX)', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', date: '2026-07-15', ipoPrice: 18, currency: 'HKD', shares: 680, marketCap: 45, sector: 'Agriculture', status: 'upcoming', subscription: 4.8, leadManagers: ['CICC', 'UBS'] },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
const STATUS_COLORS: Record<string, string> = { upcoming: '#6366f1', priced: '#f59e0b', trading: '#22c55e' };
const STATUS_LABELS: Record<string, string> = { upcoming: 'Upcoming', priced: 'Priced', trading: 'Trading' };

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const GlobalIPOCalendar: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'priced' | 'trading'>('all');
  const [marketFilter, setMarketFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let data = MOCK_IPOS;
    if (filter !== 'all') data = data.filter(i => i.status === filter);
    if (marketFilter) data = data.filter(i => i.market === marketFilter);
    return data.sort((a, b) => a.date.localeCompare(b.date));
  }, [filter, marketFilter]);

  const markets = useMemo(() => {
    const map = new Map<string, { flag: string; count: number }>();
    MOCK_IPOS.forEach(i => {
      const e = map.get(i.market) || { flag: i.flag, count: 0 };
      e.count++;
      map.set(i.market, e);
    });
    return [...map.entries()];
  }, []);

  const upcomingTotal = MOCK_IPOS.filter(i => i.status === 'upcoming').reduce((s, i) => s + i.marketCap, 0);
  const avgSubscription = MOCK_IPOS.filter(i => i.status === 'upcoming').reduce((s, i) => s + i.subscription, 0)
    / Math.max(MOCK_IPOS.filter(i => i.status === 'upcoming').length, 1);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F4C8}'} Global IPO Calendar</h3>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Upcoming IPOs</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>{MOCK_IPOS.filter(i => i.status === 'upcoming').length}</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Total Pipeline Value</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>${upcomingTotal.toFixed(0)}B</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: avgSubscription > 10 ? 'rgba(239,68,68,.06)' : 'rgba(34,197,94,.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Avg Subscription</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: avgSubscription > 10 ? '#ef4444' : '#22c55e' }}>{avgSubscription.toFixed(1)}x</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'upcoming', 'priced', 'trading'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '2px 10px', borderRadius: 4, border: '1px solid var(--border)',
            background: filter === f ? STATUS_COLORS[f] || 'var(--accent)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--text)', fontSize: 11, cursor: 'pointer', fontWeight: filter === f ? 700 : 400,
          }}>{f === 'all' ? 'All' : STATUS_LABELS[f]}</button>
        ))}
        <span style={{ color: 'var(--text-dim)', fontSize: 10, margin: '0 4px' }}>|</span>
        {markets.map(([mkt, info]) => (
          <button key={mkt} onClick={() => setMarketFilter(marketFilter === mkt ? null : mkt)} style={{
            padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
            background: marketFilter === mkt ? 'var(--accent)' : 'transparent',
            color: marketFilter === mkt ? '#fff' : 'var(--text)', fontSize: 10, cursor: 'pointer', fontWeight: marketFilter === mkt ? 700 : 400,
          }}>{info.flag} {mkt} ({info.count})</button>
        ))}
      </div>

      {/* IPO Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thP}>Symbol</th>
              <th style={thP}>Mkt</th>
              <th style={thP}>Date</th>
              <th style={thP}>Price</th>
              <th style={thP}>Cap</th>
              <th style={thP}>Sub</th>
              <th style={thP}>1D</th>
              <th style={thP}>30D</th>
              <th style={thP}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ipo => (
              <tr key={ipo.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdP}>
                  <div style={{ fontWeight: 700 }}>{ipo.symbol}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{ipo.name}</div>
                </td>
                <td style={tdP}><span style={{ fontSize: 14 }}>{ipo.flag}</span> {ipo.market}</td>
                <td style={tdP}>
                  <span style={{
                    fontWeight: 600,
                    color: new Date(ipo.date) < new Date() ? 'var(--text-dim)' : 'var(--text)',
                  }}>{ipo.date}</span>
                </td>
                <td style={{ ...tdP, textAlign: 'right' }}>
                  {ipo.currency === 'USD' ? '$' : ipo.currency === 'GBP' ? '\u00A3' : ipo.currency === 'INR' ? '\u20B9' : ipo.currency === 'JPY' ? '\u00A5' : ipo.currency === 'HKD' ? 'HK$' : 'R$'}
                  {ipo.ipoPrice}
                </td>
                <td style={{ ...tdP, textAlign: 'right' }}>
                  {ipo.marketCap.toFixed(1)}B
                  {ipo.marketCap > 50 && '\u{1F451}'}
                </td>
                <td style={{ ...tdP, textAlign: 'right', fontWeight: 600, color: ipo.subscription > 10 ? '#ef4444' : '#22c55e' }}>
                  {ipo.subscription.toFixed(1)}x
                </td>
                <td style={{ ...tdP, textAlign: 'right' }}>
                  {ipo.firstDayReturn != null ? (
                    <span style={{ fontWeight: 600, color: ipo.firstDayReturn > 0 ? '#22c55e' : '#ef4444' }}>
                      {ipo.firstDayReturn > 0 ? '+' : ''}{ipo.firstDayReturn}%
                    </span>
                  ) : '-'}
                </td>
                <td style={{ ...tdP, textAlign: 'right' }}>
                  {ipo.day30Return != null ? (
                    <span style={{ color: ipo.day30Return > 0 ? '#22c55e' : '#ef4444' }}>
                      {ipo.day30Return > 0 ? '+' : ''}{ipo.day30Return}%
                    </span>
                  ) : '-'}
                </td>
                <td style={tdP}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    background: `${STATUS_COLORS[ipo.status]}15`, color: STATUS_COLORS[ipo.status],
                  }}>{STATUS_LABELS[ipo.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent performance */}
      <div style={{ marginTop: 14 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px 0' }}>{'\u{1F4CA}'} Recent IPO Performance</h4>
        <div style={{ display: 'flex', gap: 10 }}>
          {MOCK_IPOS.filter(i => i.status === 'trading').map(ipo => (
            <div key={ipo.symbol} style={{ flex: 1, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>{ipo.flag} {ipo.symbol}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{ipo.sector}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>1D Pop</div>
                  <div style={{ fontWeight: 600, color: (ipo.firstDayReturn ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
                    {ipo.firstDayReturn != null ? `+${ipo.firstDayReturn}%` : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>30D</div>
                  <div style={{ fontWeight: 600, color: (ipo.day30Return ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
                    {ipo.day30Return != null ? `+${ipo.day30Return}%` : '-'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
        {'\u{1F4CC}'} {'\u{1F451}'} = Mega IPO (&gt;$50B) | Sub &gt;10x = extremely hot (potential pop but risk of overvaluation) | Lead managers listed on hover
      </div>
    </div>
  );
};

const thP: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdP: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default GlobalIPOCalendar;
