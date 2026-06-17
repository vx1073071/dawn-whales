/**
 * StockConnectPanel — R272 ML#3: 港股通资金流面板 (Stock Connect)
 *
 * Northbound/Southbound flow tracking:
 * - Real-time net flow (CNY + HKD)
 * - Daily quota usage
 * - Top stocks by net buy
 * - Sector aggregation
 * - Historical trend (7D)
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface ConnectFlow {
  direction: 'NB' | 'SB';     // Northbound (A-share) / Southbound (HK)
  market: 'SH' | 'SZ';
  dailyQuota: number;          // CNY bn
  used: number;
  netFlow: number;             // CNY bn (+buy, -sell)
  topBuy: { symbol: string; name: string; net: number }[];
  topSell: { symbol: string; name: string; net: number }[];
}

interface SbStock {
  symbol: string;
  name: string;
  netFlow: number;      // HKD mn
  turnover: number;
  hkShareholding: number; // %
  shChange: number;      // % pts
  price: number;
  changePct: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_CONNECT: ConnectFlow[] = [
  {
    direction: 'NB', market: 'SH', dailyQuota: 52, used: 28.5, netFlow: 3.2,
    topBuy: [{ symbol: '600519', name: 'Kweichow Moutai', net: 1.2 }, { symbol: '601012', name: 'LONGi Green Energy', net: 0.85 }, { symbol: '600809', name: 'Shanxi Fenjiu', net: 0.62 }],
    topSell: [{ symbol: '600036', name: 'CMB', net: -0.45 }, { symbol: '601318', name: 'Ping An', net: -0.38 }],
  },
  {
    direction: 'NB', market: 'SZ', dailyQuota: 52, used: 22.1, netFlow: -1.5,
    topBuy: [{ symbol: '300750', name: 'CATL', net: 0.95 }, { symbol: '002475', name: 'Luxshare', net: 0.55 }],
    topSell: [{ symbol: '000858', name: 'Wuliangye', net: -0.72 }, { symbol: '002594', name: 'BYD', net: -0.58 }],
  },
  {
    direction: 'SB', market: 'SH', dailyQuota: 42, used: 35.2, netFlow: 5.8,
    topBuy: [{ symbol: '0700', name: 'Tencent', net: 2.1 }, { symbol: '0941', name: 'China Mobile', net: 1.45 }, { symbol: '9988', name: 'Alibaba', net: 0.92 }],
    topSell: [{ symbol: '2269', name: 'WuXi Bio', net: -0.35 }],
  },
  {
    direction: 'SB', market: 'SZ', dailyQuota: 42, used: 28.8, netFlow: 2.3,
    topBuy: [{ symbol: '1810', name: 'Xiaomi', net: 1.25 }, { symbol: '3690', name: 'Meituan', net: 0.78 }],
    topSell: [{ symbol: '09618', name: 'JD.com', net: -0.42 }],
  },
];

const MOCK_SB_STOCKS: SbStock[] = [
  { symbol: '0700', name: 'Tencent', netFlow: 2100, turnover: 5200, hkShareholding: 8.5, shChange: 0.3, price: 385, changePct: 1.2 },
  { symbol: '0941', name: 'China Mobile', netFlow: 1450, turnover: 2800, hkShareholding: 12.2, shChange: 0.5, price: 72.5, changePct: 0.8 },
  { symbol: '9988', name: 'Alibaba', netFlow: 920, turnover: 3500, hkShareholding: 5.8, shChange: -0.2, price: 78, changePct: -0.6 },
  { symbol: '1810', name: 'Xiaomi', netFlow: 1250, turnover: 1800, hkShareholding: 7.1, shChange: 0.6, price: 28.5, changePct: 2.5 },
  { symbol: '3690', name: 'Meituan', netFlow: 780, turnover: 2200, hkShareholding: 6.3, shChange: 0.1, price: 168, changePct: 0.3 },
  { symbol: '2269', name: 'WuXi Bio', netFlow: -350, turnover: 450, hkShareholding: 3.2, shChange: -0.4, price: 18.2, changePct: -2.1 },
  { symbol: '09618', name: 'JD.com', netFlow: -420, turnover: 890, hkShareholding: 4.5, shChange: -0.3, price: 135, changePct: -1.2 },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
const QuotaBar = ({ used, total }: { used: number; total: number }) => {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .3s' }} />
    </div>
  );
};

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const StockConnectPanel: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'stocks'>('overview');

  const totalNbNet = useMemo(() => MOCK_CONNECT.filter(c => c.direction === 'NB').reduce((s, c) => s + c.netFlow, 0), []);
  const totalSbNet = useMemo(() => MOCK_CONNECT.filter(c => c.direction === 'SB').reduce((s, c) => s + c.netFlow, 0), []);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇭🇰⇄🇨🇳 Stock Connect Flow</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('overview')} style={tabBtnStyle(tab === 'overview')}>📊 Overview</button>
          <button onClick={() => setTab('stocks')} style={tabBtnStyle(tab === 'stocks')}>📈 Top Stocks</button>
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          {/* Net Flow Summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: totalNbNet > 0 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>🇨🇳 Northbound (Foreign → A-share)</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: totalNbNet > 0 ? '#22c55e' : '#ef4444' }}>
                {totalNbNet > 0 ? '+' : ''}{totalNbNet.toFixed(1)}B CNY
              </div>
            </div>
            <div style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: totalSbNet > 0 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>🇭🇰 Southbound (Mainland → HK)</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: totalSbNet > 0 ? '#22c55e' : '#ef4444' }}>
                {totalSbNet > 0 ? '+' : ''}{totalSbNet.toFixed(1)}B CNY
              </div>
            </div>
          </div>

          {/* Quota usage grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MOCK_CONNECT.map(c => (
              <div key={`${c.direction}-${c.market}`} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>
                    {c.direction === 'NB' ? '🇨🇳 NB' : '🇭🇰 SB'} {c.market}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.netFlow > 0 ? '#22c55e' : '#ef4444' }}>
                    {c.netFlow > 0 ? '+' : ''}{c.netFlow.toFixed(1)}B
                  </span>
                </div>
                <QuotaBar used={c.used} total={c.dailyQuota} />
                <div style={{ marginTop: 2, fontSize: 10, color: 'var(--text-dim)' }}>
                  {c.used.toFixed(1)}B / {c.dailyQuota}B quota ({((c.used / c.dailyQuota) * 100).toFixed(0)}%)
                </div>

                {/* Mini top buy/sell */}
                <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>🟢 Top Buy</div>
                    {c.topBuy.map(s => (
                      <div key={s.symbol} style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{s.symbol}</span>
                        <span style={{ color: '#22c55e' }}>+{s.net}B</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>🔴 Top Sell</div>
                    {c.topSell.map(s => (
                      <div key={s.symbol} style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{s.symbol}</span>
                        <span style={{ color: '#ef4444' }}>{s.net}B</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* SB Top Stocks Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={thS}>Symbol</th>
                  <th style={thS}>Price</th>
                  <th style={thS}>Chg%</th>
                  <th style={thS}>Net Flow</th>
                  <th style={thS}>Turnover</th>
                  <th style={thS}>SC Hld%</th>
                  <th style={thS}>Hld Δ</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SB_STOCKS.sort((a, b) => b.netFlow - a.netFlow).map(s => (
                  <tr key={s.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdS}>
                      <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.name}</div>
                    </td>
                    <td style={{ ...tdS, textAlign: 'right' }}>HK${s.price.toFixed(1)}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: s.changePct > 0 ? '#22c55e' : '#ef4444' }}>
                      {s.changePct > 0 ? '+' : ''}{s.changePct.toFixed(1)}%
                    </td>
                    <td style={{ ...tdS, textAlign: 'right', color: s.netFlow > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {s.netFlow > 0 ? '+' : ''}{s.netFlow.toFixed(0)}M
                    </td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{s.turnover.toFixed(0)}M</td>
                    <td style={tdS}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <QuotaBar used={s.hkShareholding} total={20} />
                        <span style={{ fontSize: 10 }}>{s.hkShareholding.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, color: s.shChange > 0 ? '#22c55e' : '#ef4444' }}>
                      {s.shChange > 0 ? '+' : ''}{s.shChange.toFixed(1)}pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const thS: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdS: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default StockConnectPanel;
