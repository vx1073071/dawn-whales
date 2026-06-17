/**
 * IndiaFuturesPanel — R273 ML#1: 印度F&O面板 (India Futures & Options)
 *
 * NSE F&O segment data:
 * - Nifty/Bank Nifty futures OI & rollover
 * - Option chain put/call OI concentration
 * - F&O ban list
 * - VIX India (India VIX)
 * - Sector F&O activity
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface FoStock {
  symbol: string;
  name: string;
  segment: 'NIFTY' | 'BANKNIFTY' | 'STOCK';
  futuresOI: number;       // lakh shares
  futuresChange: number;
  rolloverPct: number;
  callOI: number;
  putOI: number;
  pcr: number;            // put/call ratio
  pcrChange: number;
  indiaVIX: number;
  foBan: boolean;
  price: number;
  changePct: number;
  costOfCarry: number;    // %
}

interface OptionStrike {
  strike: number;
  callOI: number;
  callChg: number;
  putOI: number;
  putChg: number;
  callIV: number;
  putIV: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_FO: FoStock[] = [
  { symbol: 'NIFTY', name: 'Nifty 50 Index', segment: 'NIFTY', futuresOI: 125.5, futuresChange: 12.3, rolloverPct: 68.5, callOI: 85.2, putOI: 62.1, pcr: 0.73, pcrChange: 0.08, indiaVIX: 14.2, foBan: false, price: 23450, changePct: 0.8, costOfCarry: 0.85 },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty', segment: 'BANKNIFTY', futuresOI: 45.2, futuresChange: -5.8, rolloverPct: 72.1, callOI: 32.5, putOI: 38.9, pcr: 1.20, pcrChange: -0.15, indiaVIX: 0, foBan: false, price: 49850, changePct: -0.3, costOfCarry: 0.92 },
  { symbol: 'RELIANCE', name: 'Reliance Industries', segment: 'STOCK', futuresOI: 38.9, futuresChange: 8.2, rolloverPct: 65.3, callOI: 28.1, putOI: 18.5, pcr: 0.66, pcrChange: 0.05, indiaVIX: 0, foBan: false, price: 2850, changePct: 1.5, costOfCarry: 1.25 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', segment: 'STOCK', futuresOI: 32.1, futuresChange: -3.5, rolloverPct: 58.9, callOI: 22.3, putOI: 25.8, pcr: 1.16, pcrChange: 0.12, indiaVIX: 0, foBan: false, price: 1680, changePct: -0.5, costOfCarry: 0.78 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', segment: 'STOCK', futuresOI: 28.5, futuresChange: 5.1, rolloverPct: 61.2, callOI: 19.8, putOI: 15.2, pcr: 0.77, pcrChange: -0.03, indiaVIX: 0, foBan: false, price: 1125, changePct: 0.9, costOfCarry: 0.95 },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', segment: 'STOCK', futuresOI: 52.3, futuresChange: 15.8, rolloverPct: 78.5, callOI: 45.1, putOI: 18.2, pcr: 0.40, pcrChange: -0.22, indiaVIX: 0, foBan: true, price: 2850, changePct: 4.2, costOfCarry: 3.85 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', segment: 'STOCK', futuresOI: 22.8, futuresChange: -8.2, rolloverPct: 55.1, callOI: 15.5, putOI: 20.3, pcr: 1.31, pcrChange: 0.18, indiaVIX: 0, foBan: false, price: 980, changePct: -1.2, costOfCarry: 0.65 },
];

const INDIA_VIX = 14.2;
const INDIA_VIX_CHANGE = -1.8;

const MOCK_OPTION_CHAIN: OptionStrike[] = [
  { strike: 23200, callOI: 45.2, callChg: 5.8, putOI: 38.1, putChg: -2.3, callIV: 13.5, putIV: 14.8 },
  { strike: 23300, callOI: 52.8, callChg: 8.2, putOI: 32.5, putChg: -4.5, callIV: 14.2, putIV: 14.2 },
  { strike: 23400, callOI: 85.2, callChg: 15.5, putOI: 28.9, putChg: -8.2, callIV: 15.1, putIV: 13.8 },
  { strike: 23500, callOI: 68.5, callChg: 12.3, putOI: 35.2, putChg: 5.8, callIV: 14.8, putIV: 14.5 },
  { strike: 23600, callOI: 42.3, callChg: -5.2, putOI: 42.1, putChg: 8.5, callIV: 14.0, putIV: 15.2 },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function OIBar({ oi, max }: { oi: number; max: number }) {
  const pct = Math.min((oi / max) * 100, 100);
  return (
    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 2 }} />
    </div>
  );
}

function MaxPainGauge({ chain, spot }: { chain: OptionStrike[]; spot: number }) {
  const maxPain = chain.reduce((best, s) => {
    let pain = 0;
    chain.forEach(st => {
      if (st.strike < s.strike) pain += st.putOI * (s.strike - st.strike);
      else pain += st.callOI * (st.strike - s.strike);
    });
    return pain < best.pain ? { strike: s.strike, pain } : best;
  }, { strike: chain[0]?.strike || 0, pain: Infinity });

  return (
    <div style={{ textAlign: 'center', fontSize: 10, marginTop: 4 }}>
      <span style={{ color: 'var(--text-dim)' }}>Max Pain: </span>
      <span style={{ fontWeight: 700, color: '#6366f1' }}>{maxPain.strike}</span>
      <span style={{ marginLeft: 8, color: spot > maxPain.strike ? '#22c55e' : '#ef4444', fontSize: 9 }}>
        Spot {spot > maxPain.strike ? '↑' : '↓'} {Math.abs(spot - maxPain.strike)}
      </span>
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const IndiaFOPanel: React.FC = () => {
  const [tab, setTab] = useState<'futures' | 'options'>('futures');

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇮🇳 India F&O Monitor</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('futures')} style={tabBtn(tab === 'futures')}>📊 Futures</button>
          <button onClick={() => setTab('options')} style={tabBtn(tab === 'options')}>📈 Options</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>India VIX</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: INDIA_VIX > 20 ? '#ef4444' : '#22c55e' }}>
            {INDIA_VIX.toFixed(1)}
          </div>
          <div style={{ fontSize: 10, color: INDIA_VIX_CHANGE < 0 ? '#22c55e' : '#ef4444' }}>
            {INDIA_VIX_CHANGE > 0 ? '+' : ''}{INDIA_VIX_CHANGE.toFixed(1)}
          </div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>F&O Ban</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
            {MOCK_FO.filter(f => f.foBan).length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {MOCK_FO.filter(f => f.foBan).map(f => f.symbol).join(', ')}
          </div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Avg Rollover</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
            {(MOCK_FO.reduce((s, f) => s + f.rolloverPct, 0) / MOCK_FO.length).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>series expiry</div>
        </div>
      </div>

      {tab === 'futures' ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thF}>Symbol</th>
                <th style={thF}>Price</th>
                <th style={thF}>Fut OI</th>
                <th style={thF}>OI Δ</th>
                <th style={thF}>Roll%</th>
                <th style={thF}>PCR</th>
                <th style={thF}>CoC%</th>
                <th style={thF}>Ban</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_FO.map(f => {
                const maxOI = Math.max(...MOCK_FO.map(x => x.futuresOI));
                return (
                  <tr key={f.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdF}>
                      <span style={{ fontWeight: 700 }}>{f.symbol}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{f.name}</div>
                    </td>
                    <td style={{ ...tdF, textAlign: 'right' }}>
                      ₹{f.price.toLocaleString()}
                      <span style={{ marginLeft: 4, fontSize: 10, color: f.changePct > 0 ? '#22c55e' : '#ef4444' }}>
                        {f.changePct > 0 ? '+' : ''}{f.changePct.toFixed(1)}%
                      </span>
                    </td>
                    <td style={tdF}>
                      <div>{f.futuresOI.toFixed(1)}L</div>
                      <OIBar oi={f.futuresOI} max={maxOI} />
                    </td>
                    <td style={{ ...tdF, textAlign: 'right', fontWeight: 600, color: f.futuresChange > 0 ? '#22c55e' : '#ef4444' }}>
                      {f.futuresChange > 0 ? '+' : ''}{f.futuresChange.toFixed(1)}L
                    </td>
                    <td style={{ ...tdF, textAlign: 'right', fontWeight: 600, color: f.rolloverPct > 75 ? '#ef4444' : f.rolloverPct > 60 ? '#f59e0b' : '#22c55e' }}>
                      {f.rolloverPct.toFixed(1)}%
                    </td>
                    <td style={{ ...tdF, textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, color: f.pcr > 1 ? '#ef4444' : '#22c55e' }}>{f.pcr.toFixed(2)}</span>
                      <span style={{ marginLeft: 2, fontSize: 9, color: f.pcrChange > 0 ? '#ef4444' : '#22c55e' }}>
                        {f.pcrChange > 0 ? '↑' : '↓'}{Math.abs(f.pcrChange).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ ...tdF, textAlign: 'right', color: f.costOfCarry > 2 ? '#f59e0b' : 'var(--text)' }}>
                      {f.costOfCarry.toFixed(2)}%
                    </td>
                    <td style={tdF}>
                      {f.foBan ? <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 10, fontWeight: 700 }}>BAN</span> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Option Chain */}
          <div style={{ marginBottom: 8 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600 }}>NIFTY Option Chain (₹23,450)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={thF}>Strike</th>
                    <th style={thF}>Call OI</th>
                    <th style={thF}>Call Δ</th>
                    <th style={thF}>IV</th>
                    <th style={thF}>Strike</th>
                    <th style={thF}>Put OI</th>
                    <th style={thF}>Put Δ</th>
                    <th style={thF}>IV</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_OPTION_CHAIN.map(s => {
                    const callMax = Math.max(...MOCK_OPTION_CHAIN.map(x => x.callOI));
                    const putMax = Math.max(...MOCK_OPTION_CHAIN.map(x => x.putOI));
                    const itm = s.strike < 23450;
                    return (
                      <tr key={s.strike} style={{ borderBottom: '1px solid var(--border)', background: s.strike === 23400 ? 'rgba(99,102,241,.06)' : 'transparent' }}>
                        <td style={{ ...tdF, textAlign: 'right', fontWeight: 700 }}>₹{s.strike.toLocaleString()}</td>
                        <td style={tdF}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <OIBar oi={s.callOI} max={callMax} />
                            <span style={{ color: itm ? '#22c55e' : 'var(--text)', fontWeight: itm ? 600 : 400 }}>{s.callOI.toFixed(1)}L</span>
                          </div>
                        </td>
                        <td style={{ ...tdF, textAlign: 'right', color: s.callChg > 0 ? '#22c55e' : '#ef4444', fontSize: 10 }}>
                          {s.callChg > 0 ? '+' : ''}{s.callChg.toFixed(1)}L
                        </td>
                        <td style={{ ...tdF, textAlign: 'center' }}>{s.callIV.toFixed(1)}%</td>
                        <td style={{ ...tdF, textAlign: 'left', fontWeight: 700 }}>₹{s.strike.toLocaleString()}</td>
                        <td style={tdF}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <OIBar oi={s.putOI} max={putMax} />
                            <span style={{ color: !itm ? '#22c55e' : 'var(--text)', fontWeight: !itm ? 600 : 400 }}>{s.putOI.toFixed(1)}L</span>
                          </div>
                        </td>
                        <td style={{ ...tdF, textAlign: 'right', color: s.putChg > 0 ? '#22c55e' : '#ef4444', fontSize: 10 }}>
                          {s.putChg > 0 ? '+' : ''}{s.putChg.toFixed(1)}L
                        </td>
                        <td style={{ ...tdF, textAlign: 'center' }}>{s.putIV.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MaxPainGauge chain={MOCK_OPTION_CHAIN} spot={23450} />
          </div>

          {/* Legend */}
          <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            📌 F&O Ban = MWPL (Market-Wide Position Limit) breached. No new positions allowed. | PCR &gt;1.2 = put heavy (bearish) | Cost of carry &gt;2% = bulls paying premium for leverage.
          </div>
        </>
      )}
    </div>
  );
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const thF: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdF: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default IndiaFOPanel;
