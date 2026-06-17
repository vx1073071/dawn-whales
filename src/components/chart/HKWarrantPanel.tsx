/**
 * HKWarrantPanel — R272 ML#2: 牛熊证/窝轮面板 (HK)
 *
 * HK derivatives market data:
 * - CBBC (牛熊证) bull/bear ratio
 * - Warrant (窝轮) call/put volume
 * - Street consensus vs turnover
 * - Top 10 underlying flow
 * - Implied volatility skew
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface CbbcFlow {
  symbol: string;
  name: string;
  bullIn: number;   // HKD
  bullOut: number;
  bearIn: number;
  bearOut: number;
  bullBearRatio: number;
  spotPrice: number;
  callIV: number;
  putIV: number;
  ivSkew: number;
  totalTurnover: number;
}

interface WarrantStreet {
  underlying: string;
  name: string;
  callVolume: number;
  putVolume: number;
  callOI: number;
  putOI: number;
  pcr: number;    // put/call ratio
  pcrChange: number;
  retailFlow: 'bullish' | 'bearish' | 'neutral';
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_CBBC: CbbcFlow[] = [
  { symbol: 'HSI', name: 'Hang Seng Index', bullIn: 890, bullOut: 620, bearIn: 450, bearOut: 710, bullBearRatio: 1.45, spotPrice: 19450, callIV: 22.5, putIV: 25.8, ivSkew: 3.3, totalTurnover: 3450 },
  { symbol: '0700', name: 'Tencent', bullIn: 320, bullOut: 280, bearIn: 180, bearOut: 240, bullBearRatio: 1.38, spotPrice: 385, callIV: 32.1, putIV: 35.5, ivSkew: 3.4, totalTurnover: 1280 },
  { symbol: '9988', name: 'Alibaba', bullIn: 210, bullOut: 190, bearIn: 290, bearOut: 160, bullBearRatio: 0.72, spotPrice: 78, callIV: 42.3, putIV: 38.1, ivSkew: -4.2, totalTurnover: 980 },
  { symbol: '3690', name: 'Meituan', bullIn: 180, bullOut: 150, bearIn: 130, bearOut: 170, bullBearRatio: 1.15, spotPrice: 168, callIV: 38.5, putIV: 41.2, ivSkew: 2.7, totalTurnover: 720 },
  { symbol: '1810', name: 'Xiaomi', bullIn: 150, bullOut: 120, bearIn: 90, bearOut: 110, bullBearRatio: 1.29, spotPrice: 28.5, callIV: 35.2, putIV: 33.8, ivSkew: -1.4, totalTurnover: 450 },
  { symbol: '2269', name: 'WuXi Bio', bullIn: 45, bullOut: 80, bearIn: 120, bearOut: 35, bullBearRatio: 0.42, spotPrice: 18.2, callIV: 55.0, putIV: 48.5, ivSkew: -6.5, totalTurnover: 280 },
];

const MOCK_WARRANT: WarrantStreet[] = [
  { underlying: 'HSI', name: 'Hang Seng Index', callVolume: 4120, putVolume: 2890, callOI: 125000, putOI: 98000, pcr: 0.78, pcrChange: -0.05, retailFlow: 'bullish' },
  { underlying: '0700', name: 'Tencent', callVolume: 1820, putVolume: 1250, callOI: 45000, putOI: 32000, pcr: 0.71, pcrChange: 0.02, retailFlow: 'bullish' },
  { underlying: '9988', name: 'Alibaba', callVolume: 950, putVolume: 1380, callOI: 28000, putOI: 36000, pcr: 1.29, pcrChange: 0.15, retailFlow: 'bearish' },
  { underlying: '3690', name: 'Meituan', callVolume: 780, putVolume: 560, callOI: 19000, putOI: 15000, pcr: 0.79, pcrChange: -0.03, retailFlow: 'bullish' },
  { underlying: '09618', name: 'JD.com', callVolume: 320, putVolume: 480, callOI: 8500, putOI: 11200, pcr: 1.32, pcrChange: 0.08, retailFlow: 'bearish' },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
const formatHKD = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}B` : `${v.toFixed(0)}M`;

const FlowBar = ({ bull, bear, max }: { bull: number; bear: number; max: number }) => {
  const bp = (bull / max) * 100;
  const brp = (bear / max) * 100;
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-input)' }}>
      <div style={{ width: `${bp}%`, background: '#22c55e', transition: 'width .3s' }} />
      <div style={{ width: `${brp}%`, background: '#ef4444', transition: 'width .3s' }} />
    </div>
  );
};

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const HKWarrantPanel: React.FC = () => {
  const [tab, setTab] = useState<'cbbc' | 'warrant'>('cbbc');

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇭🇰 HK Derivatives Flow</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('cbbc')} style={tabBtnStyle(tab === 'cbbc')}>🐂🐻 CBBC</button>
          <button onClick={() => setTab('warrant')} style={tabBtnStyle(tab === 'warrant')}>📜 Warrants</button>
        </div>
      </div>

      {tab === 'cbbc' ? (
        <>
          {/* Bull/Bear summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: 10, borderRadius: 8, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>🐂 Bull Side</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{formatHKD(MOCK_CBBC.reduce((s, c) => s + c.bullIn, 0) / 1e6)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>flow in</div>
            </div>
            <div style={{ flex: 1, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>🐻 Bear Side</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{formatHKD(MOCK_CBBC.reduce((s, c) => s + c.bearIn, 0) / 1e6)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>flow in</div>
            </div>
          </div>

          {/* CBBC Table */}
          {MOCK_CBBC.map(c => {
            return (
              <div key={c.symbol} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{c.symbol}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>HK${c.spotPrice.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <FlowBar bull={c.bullIn} bear={c.bearIn} max={Math.max(c.bullIn + c.bearIn, 1)} />
                  <span style={{ fontSize: 10, whiteSpace: 'nowrap', fontWeight: 600, color: c.bullBearRatio >= 1 ? '#22c55e' : '#ef4444' }}>
                    {c.bullBearRatio >= 1 ? '🐂' : '🐻'} {c.bullBearRatio.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-dim)' }}>
                  <span>Bull: 🟢{c.bullIn}M / 🔴{c.bullOut}M</span>
                  <span>Bear: 🟢{c.bearIn}M / 🔴{c.bearOut}M</span>
                  <span>IV skew: <span style={{ color: Math.abs(c.ivSkew) > 5 ? '#f59e0b' : 'var(--text-dim)' }}>{c.ivSkew > 0 ? '+' : ''}{c.ivSkew.toFixed(1)}%</span></span>
                  <span>Turnover: HK${c.totalTurnover}M</span>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <>
          {/* Warrant PCR Gauge */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Total Call Volume</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{formatHKD(MOCK_WARRANT.reduce((s, w) => s + w.callVolume, 0))}</div>
            </div>
            <div style={{ flex: 1, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Total Put Volume</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{formatHKD(MOCK_WARRANT.reduce((s, w) => s + w.putVolume, 0))}</div>
            </div>
          </div>

          {/* Warrant Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={wh}>Underlying</th>
                  <th style={wh}>Call Vol</th>
                  <th style={wh}>Put Vol</th>
                  <th style={wh}>P/C Ratio</th>
                  <th style={wh}>Call OI</th>
                  <th style={wh}>Put OI</th>
                  <th style={wh}>Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_WARRANT.map(w => (
                  <tr key={w.underlying} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={wc}>
                      <span style={{ fontWeight: 700 }}>{w.underlying}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{w.name}</div>
                    </td>
                    <td style={{ ...wc, textAlign: 'right', color: '#22c55e' }}>{w.callVolume}</td>
                    <td style={{ ...wc, textAlign: 'right', color: '#ef4444' }}>{w.putVolume}</td>
                    <td style={{ ...wc, textAlign: 'right' }}>
                      <span style={{ color: w.pcr > 1 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{w.pcr.toFixed(2)}</span>
                      <span style={{ marginLeft: 4, fontSize: 10, color: w.pcrChange > 0 ? '#ef4444' : '#22c55e' }}>
                        {w.pcrChange > 0 ? '↑' : '↓'}{Math.abs(w.pcrChange).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ ...wc, textAlign: 'right' }}>{(w.callOI / 1e3).toFixed(1)}K</td>
                    <td style={{ ...wc, textAlign: 'right' }}>{(w.putOI / 1e3).toFixed(1)}K</td>
                    <td style={wc}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: w.retailFlow === 'bullish' ? 'rgba(34,197,94,.15)' : w.retailFlow === 'bearish' ? 'rgba(239,68,68,.15)' : 'rgba(156,163,175,.15)',
                        color: w.retailFlow === 'bullish' ? '#22c55e' : w.retailFlow === 'bearish' ? '#ef4444' : 'var(--text-dim)',
                      }}>
                        {w.retailFlow === 'bullish' ? '📈 Bullish' : w.retailFlow === 'bearish' ? '📉 Bearish' : '➖ Neutral'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PCR interpretation */}
          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            P/C &lt;0.7 = excessively bullish (caution) | P/C &gt;1.2 = excessively bearish (reversal possible) | P/C 0.8-1.1 = neutral
          </div>
        </>
      )}
    </div>
  );
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)',
  fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const wh: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)' };
const wc: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default HKWarrantPanel;
