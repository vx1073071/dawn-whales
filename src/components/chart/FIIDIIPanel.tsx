/**
 * FIIDIIPanel — R273 ML#2: FII/DII资金流面板 (India Institutional Flow)
 *
 * SEBI FII/DII data:
 * - FII net buy/sell (equity + debt)
 * - DII net buy/sell
 * - Net inflow vs Nifty correlation
 * - Sector-wise breakdown
 * - Monthly trend
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface InstitutionalFlow {
  date: string;
  fiiEquity: number;      // ₹ cr
  fiiDebt: number;
  fiiTotal: number;
  diiEquity: number;
  diiTotal: number;
  netInflow: number;      // fiiTotal + diiTotal
  nifty: number;
  niftyChg: number;
}

interface SectorFlow {
  sector: string;
  fiiBuy: number;
  fiiSell: number;
  fiiNet: number;
  diiNet: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_FLOW: InstitutionalFlow[] = [
  { date: 'Jun 16', fiiEquity: 2850, fiiDebt: 1200, fiiTotal: 4050, diiEquity: -1800, diiTotal: -1800, netInflow: 2250, nifty: 23450, niftyChg: 0.8 },
  { date: 'Jun 15', fiiEquity: -1250, fiiDebt: 800, fiiTotal: -450, diiEquity: 2200, diiTotal: 2200, netInflow: 1750, nifty: 23260, niftyChg: -0.3 },
  { date: 'Jun 14', fiiEquity: 4200, fiiDebt: 1500, fiiTotal: 5700, diiEquity: -2500, diiTotal: -2500, netInflow: 3200, nifty: 23330, niftyChg: 1.2 },
  { date: 'Jun 13', fiiEquity: -3200, fiiDebt: -500, fiiTotal: -3700, diiEquity: 3500, diiTotal: 3500, netInflow: -200, nifty: 23050, niftyChg: -1.5 },
  { date: 'Jun 12', fiiEquity: 1800, fiiDebt: 600, fiiTotal: 2400, diiEquity: -900, diiTotal: -900, netInflow: 1500, nifty: 23400, niftyChg: 0.6 },
  { date: 'Jun 9', fiiEquity: -850, fiiDebt: 350, fiiTotal: -500, diiEquity: 1800, diiTotal: 1800, netInflow: 1300, nifty: 23260, niftyChg: 0.3 },
  { date: 'Jun 8', fiiEquity: 5600, fiiDebt: 2200, fiiTotal: 7800, diiEquity: -4200, diiTotal: -4200, netInflow: 3600, nifty: 23190, niftyChg: 1.8 },
];

const MOCK_SECTORS: SectorFlow[] = [
  { sector: 'IT', fiiBuy: 8500, fiiSell: 5200, fiiNet: 3300, diiNet: -1200 },
  { sector: 'Banking', fiiBuy: 6200, fiiSell: 7800, fiiNet: -1600, diiNet: 2800 },
  { sector: 'Auto', fiiBuy: 3200, fiiSell: 2100, fiiNet: 1100, diiNet: -500 },
  { sector: 'Pharma', fiiBuy: 2800, fiiSell: 1900, fiiNet: 900, diiNet: 600 },
  { sector: 'Oil & Gas', fiiBuy: 1500, fiiSell: 3800, fiiNet: -2300, diiNet: 1500 },
  { sector: 'Metals', fiiBuy: 1200, fiiSell: 2800, fiiNet: -1600, diiNet: 800 },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
const fmtCr = (v: number) => `${v > 0 ? '+' : ''}₹${v.toLocaleString()}cr`;

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const FIIDIIPanel: React.FC = () => {
  const [tab, setTab] = useState<'daily' | 'sector'>('daily');

  const weekFII = MOCK_FLOW.reduce((s, d) => s + d.fiiTotal, 0);
  const weekDII = MOCK_FLOW.reduce((s, d) => s + d.diiTotal, 0);
  const weekNet = weekFII + weekDII;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇮🇳 FII/DII Flow Tracker</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('daily')} style={tabBtn(tab === 'daily')}>📅 Daily</button>
          <button onClick={() => setTab('sector')} style={tabBtn(tab === 'sector')}>📊 Sector</button>
        </div>
      </div>

      {/* Weekly summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: weekFII > 0 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>FII 7-Day Net</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: weekFII > 0 ? '#22c55e' : '#ef4444' }}>{fmtCr(weekFII)}</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: weekDII > 0 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>DII 7-Day Net</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: weekDII > 0 ? '#22c55e' : '#ef4444' }}>{fmtCr(weekDII)}</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: weekNet > 0 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Combined</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: weekNet > 0 ? '#22c55e' : '#ef4444' }}>{fmtCr(weekNet)}</div>
        </div>
      </div>

      {tab === 'daily' ? (
        <>
          {/* Mini bar chart */}
          <div style={{ display: 'flex', gap: 0, height: 80, alignItems: 'center', marginBottom: 12, padding: '0 8px' }}>
            {MOCK_FLOW.map(d => {
              const maxAbs = Math.max(...MOCK_FLOW.map(x => Math.max(Math.abs(x.fiiTotal), Math.abs(x.diiTotal))));
              const fiiH = (Math.abs(d.fiiTotal) / maxAbs) * 60;
              const diiH = (Math.abs(d.diiTotal) / maxAbs) * 60;
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <div style={{ width: 8, height: fiiH, background: d.fiiTotal > 0 ? '#22c55e' : '#ef4444', borderRadius: '1px 1px 0 0' }} />
                    <div style={{ width: 8, height: diiH, background: d.diiTotal > 0 ? '#f59e0b' : '#a855f7', borderRadius: '1px 1px 0 0' }} />
                  </div>
                  <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{d.date}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 10, fontSize: 10, color: 'var(--text-dim)' }}>
            <span>🟢/🔴 FII</span>
            <span>🟡/🟣 DII</span>
          </div>

          {/* Daily table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={thI}>Date</th>
                  <th style={thI}>FII Eq</th>
                  <th style={thI}>FII Db</th>
                  <th style={thI}>FII Tot</th>
                  <th style={thI}>DII Tot</th>
                  <th style={thI}>Net</th>
                  <th style={thI}>Nifty</th>
                  <th style={thI}>Chg</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_FLOW.map(d => (
                  <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdI}><span style={{ fontWeight: 600 }}>{d.date}</span></td>
                    <td style={{ ...tdI, textAlign: 'right', color: d.fiiEquity > 0 ? '#22c55e' : '#ef4444' }}>{d.fiiEquity > 0 ? '+' : ''}₹{d.fiiEquity.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right', color: d.fiiDebt > 0 ? '#22c55e' : '#ef4444' }}>{d.fiiDebt > 0 ? '+' : ''}₹{d.fiiDebt.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right', fontWeight: 600, color: d.fiiTotal > 0 ? '#22c55e' : '#ef4444' }}>{d.fiiTotal > 0 ? '+' : ''}₹{d.fiiTotal.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right', fontWeight: 600, color: d.diiTotal > 0 ? '#f59e0b' : '#a855f7' }}>{d.diiTotal > 0 ? '+' : ''}₹{d.diiTotal.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right', fontWeight: 700, color: d.netInflow > 0 ? '#22c55e' : '#ef4444' }}>{d.netInflow > 0 ? '+' : ''}₹{d.netInflow.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right' }}>{d.nifty.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right', color: d.niftyChg > 0 ? '#22c55e' : '#ef4444' }}>{d.niftyChg > 0 ? '+' : ''}{d.niftyChg}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Sector view */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thI}>Sector</th>
                <th style={thI}>FII Buy</th>
                <th style={thI}>FII Sell</th>
                <th style={thI}>FII Net</th>
                <th style={thI}>DII Net</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SECTORS.sort((a, b) => b.fiiNet - a.fiiNet).map(s => {
                const fiiMax = Math.max(...MOCK_SECTORS.map(x => Math.max(Math.abs(x.fiiNet), Math.abs(x.diiNet))));
                return (
                  <tr key={s.sector} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdI}><span style={{ fontWeight: 700 }}>{s.sector}</span></td>
                    <td style={{ ...tdI, textAlign: 'right', color: '#22c55e' }}>₹{s.fiiBuy.toLocaleString()}</td>
                    <td style={{ ...tdI, textAlign: 'right', color: '#ef4444' }}>₹{s.fiiSell.toLocaleString()}</td>
                    <td style={tdI}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ height: 6, flex: 1, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                          <div style={{ width: `${(Math.abs(s.fiiNet) / fiiMax) * 50}%`, height: '100%', background: s.fiiNet > 0 ? '#22c55e' : '#ef4444', borderRadius: 3, marginLeft: s.fiiNet < 0 ? 'auto' : 0 }} />
                        </div>
                        <span style={{ fontWeight: 600, color: s.fiiNet > 0 ? '#22c55e' : '#ef4444', fontSize: 10 }}>
                          {s.fiiNet > 0 ? '+' : ''}₹{s.fiiNet.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdI, textAlign: 'right', fontWeight: 600, color: s.diiNet > 0 ? '#f59e0b' : '#a855f7' }}>
                      {s.diiNet > 0 ? '+' : ''}₹{s.diiNet.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Foreign vs Domestic interpretation */}
          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            📌 FII buying + DII selling = bullish crossover (foreigners lead). DII buying + FII selling = domestic support floor. Both selling = risk-off. Both buying = strong bull.
          </div>
        </div>
      )}
    </div>
  );
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const thI: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdI: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default FIIDIIPanel;
