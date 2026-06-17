/**
 * ShortSellPanel — R272 ML#1: 卖空数据面板 (US/HK)
 * 
 * NYSE/NASDAQ + HKEX short sell tracking:
 * - Daily short volume & ratio
 * - Short interest (US: bi-monthly, HK: daily)
 * - Days to cover
 * - Top shorted stocks
 * - Sector short aggregation
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface ShortSellRecord {
  symbol: string;
  name: string;
  market: 'US' | 'HK';
  shortVolume: number;
  totalVolume: number;
  shortRatio: number; // %
  shortInterest: number;
  float: number;
  daysToCover: number;
  prevShortRatio: number;
  change: number; // % pts
  fee: number; // borrow fee %
  available: number;
}

type SortKey = keyof ShortSellRecord;

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_SHORT: ShortSellRecord[] = [
  { symbol: 'TSLA', name: 'Tesla', market: 'US', shortVolume: 12400000, totalVolume: 45000000, shortRatio: 27.6, shortInterest: 87600000, float: 2800000000, daysToCover: 1.8, prevShortRatio: 25.1, change: 2.5, fee: 1.2, available: 150000 },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'US', shortVolume: 8900000, totalVolume: 52000000, shortRatio: 17.1, shortInterest: 45000000, float: 2360000000, daysToCover: 0.9, prevShortRatio: 19.3, change: -2.2, fee: 0.8, available: 500000 },
  { symbol: 'AAPL', name: 'Apple', market: 'US', shortVolume: 5600000, totalVolume: 62000000, shortRatio: 9.0, shortInterest: 120000000, float: 15300000000, daysToCover: 1.9, prevShortRatio: 8.5, change: 0.5, fee: 0.3, available: 2000000 },
  { symbol: 'GME', name: 'GameStop', market: 'US', shortVolume: 3200000, totalVolume: 8500000, shortRatio: 37.6, shortInterest: 45000000, float: 120000000, daysToCover: 5.3, prevShortRatio: 41.2, change: -3.6, fee: 15.0, available: 5000 },
  { symbol: '0700', name: 'Tencent', market: 'HK', shortVolume: 4500000, totalVolume: 22000000, shortRatio: 20.5, shortInterest: 89000000, float: 6500000000, daysToCover: 1.4, prevShortRatio: 18.9, change: 1.6, fee: 2.5, available: 300000 },
  { symbol: '9988', name: 'Alibaba', market: 'HK', shortVolume: 3800000, totalVolume: 25000000, shortRatio: 15.2, shortInterest: 67000000, float: 4200000000, daysToCover: 1.1, prevShortRatio: 14.8, change: 0.4, fee: 1.8, available: 400000 },
  { symbol: '3690', name: 'Meituan', market: 'HK', shortVolume: 2100000, totalVolume: 12000000, shortRatio: 17.5, shortInterest: 34000000, float: 2800000000, daysToCover: 0.8, prevShortRatio: 19.1, change: -1.6, fee: 3.2, available: 150000 },
  { symbol: '1810', name: 'Xiaomi', market: 'HK', shortVolume: 2900000, totalVolume: 18000000, shortRatio: 16.1, shortInterest: 52000000, float: 3100000000, daysToCover: 1.3, prevShortRatio: 14.2, change: 1.9, fee: 2.0, available: 250000 },
];

const MARKETS = ['All', 'US', 'HK'] as const;

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function RatioBar({ value, prev, max }: { value: number; prev?: number; max?: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const prevPct = prev != null ? Math.min(Math.max(prev, 0), 100) : pct;
  const barMax = max || 50;
  const w = (pct / barMax) * 100;
  const prevW = (prevPct / barMax) * 100;
  const up = value > (prev ?? value);
  const color = value > 30 ? '#ef4444' : value > 20 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ position: 'relative', height: 16, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
      {prev != null && (
        <div style={{ position: 'absolute', left: `${prevW}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-dim)', zIndex: 2 }} title={`Previous: ${prev.toFixed(1)}%`} />
      )}
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .3s' }} />
      <span style={{ position: 'absolute', right: 4, top: 0, fontSize: 10, lineHeight: '16px', color: 'var(--text)', fontWeight: 600, zIndex: 2 }}>
        {value.toFixed(1)}%
        {prev != null && <span style={{ marginLeft: 4, fontSize: 9, color: up ? '#ef4444' : '#22c55e' }}>{up ? '↑' : '↓'}</span>}
      </span>
    </div>
  );
}

function MarketBadge({ market }: { market: 'US' | 'HK' }) {
  const flag = market === 'US' ? '🇺🇸' : '🇭🇰';
  const bg = market === 'US' ? 'rgba(59,130,246,.15)' : 'rgba(239,68,68,.15)';
  const fg = market === 'US' ? '#60a5fa' : '#f87171';
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: bg, color: fg, fontSize: 11, fontWeight: 600 }}>{flag} {market}</span>;
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const ShortSellPanel: React.FC = () => {
  const [market, setMarket] = useState<'All' | 'US' | 'HK'>('All');
  const [sortKey, setSortKey] = useState<SortKey>('shortRatio');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const filtered = useMemo(() => {
    let data = MOCK_SHORT;
    if (market !== 'All') data = data.filter(r => r.market === market);
    return [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });
  }, [market, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d * -1) as 1 | -1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const totalShortVol = filtered.reduce((s, r) => s + r.shortVolume, 0);
  const totalVol = filtered.reduce((s, r) => s + r.totalVolume, 0);
  const avgRatio = totalVol > 0 ? (totalShortVol / totalVol * 100) : 0;

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th onClick={() => toggleSort(k)} style={{ cursor: 'pointer', padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {label}{sortKey === k ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🔻 Short Sell Dashboard</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {MARKETS.map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              style={{
                padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: market === m ? 'var(--accent)' : 'transparent',
                color: market === m ? '#fff' : 'var(--text)',
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Total Short Volume</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{(totalShortVol / 1e6).toFixed(1)}M</div>
        </div>
        <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Avg Short Ratio</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: avgRatio > 25 ? '#ef4444' : avgRatio > 15 ? '#f59e0b' : '#22c55e' }}>{avgRatio.toFixed(1)}%</div>
        </div>
        <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Highest Borrow Fee</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{Math.max(...filtered.map(r => r.fee)).toFixed(1)}%</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <Th k="symbol" label="Symbol" />
              <Th k="market" label="Mkt" />
              <th style={headerStyle}>Short Ratio</th>
              <Th k="shortVolume" label="Short Vol" />
              <Th k="daysToCover" label="DTC" />
              <Th k="shortInterest" label="Short Int" />
              <Th k="fee" label="Fee %" />
              <Th k="available" label="Avail" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 700 }}>{r.symbol}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.name}</div>
                </td>
                <td style={cellStyle}><MarketBadge market={r.market} /></td>
                <td style={cellStyle}>
                  <RatioBar value={r.shortRatio} prev={r.prevShortRatio} />
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{(r.shortVolume / 1e6).toFixed(1)}M</td>
                <td style={{ ...cellStyle, textAlign: 'right', color: r.daysToCover > 3 ? '#ef4444' : 'var(--text)' }}>{r.daysToCover.toFixed(1)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{(r.shortInterest / 1e6).toFixed(1)}M</td>
                <td style={{ ...cellStyle, textAlign: 'right', color: r.fee > 10 ? '#ef4444' : r.fee > 5 ? '#f59e0b' : 'var(--text)' }}>{r.fee}%</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{(r.available / 1e3).toFixed(0)}K</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 12, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 16 }}>
        <span>🟢 &lt;20% Normal</span>
        <span>🟡 20-30% Elevated</span>
        <span>🔴 &gt;30% Squeeze risk</span>
        <span>|</span>
        <span>DTC &gt;3 = hard to cover</span>
        <span>Fee &gt;10% = expensive borrow</span>
      </div>
    </div>
  );
};

const headerStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const cellStyle: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default ShortSellPanel;
