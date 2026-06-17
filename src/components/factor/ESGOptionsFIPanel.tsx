/**
 * ESGOptionsFIPanel — R278 ML#2: ESG/期权/固收面板
 *
 * Three specialized factor panels in one:
 * - ESG 25: MSCI ESG ratings, carbon, governance, controversy
 * - Options 15: CBOE data — IV skew, put/call, gamma, VIX term structure
 * - Fixed Income 10: yield curve, credit spreads, duration, convexity
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface ESGScore {
  symbol: string;
  name: string;
  market: string;
  flag: string;
  esgRating: string;     // AAA, AA, A, BBB, BB, B, CCC
  esgScore: number;      // 0-10
  environmental: number;
  social: number;
  governance: number;
  carbonIntensity: number;
  controversy: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  esgMomentum: number;   // rating change
  sustainable: boolean;  // SFDR Art 8/9
}

interface OptionsSignal {
  id: string;
  name: string;
  symbol: string;
  iv30: number;
  ivPercentile: number;   // 0-100
  skew: number;           // put IV - call IV
  pcr: number;
  gammaExposure: number;  // GEX in $M
  vannaFlow: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
}

interface FIMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  prevValue: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
  category: string;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_ESG: ESGScore[] = [
  { symbol: 'AAPL', name: 'Apple', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', esgRating: 'AAA', esgScore: 8.5, environmental: 8.2, social: 8.0, governance: 8.8, carbonIntensity: 25, controversy: 'NONE', esgMomentum: 0.3, sustainable: true },
  { symbol: 'TSLA', name: 'Tesla', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', esgRating: 'AA', esgScore: 7.8, environmental: 9.5, social: 6.5, governance: 7.0, carbonIntensity: 0, controversy: 'MINOR', esgMomentum: -0.2, sustainable: true },
  { symbol: '005930', name: 'Samsung', market: 'KR', flag: '\u{1F1F0}\u{1F1F7}', esgRating: 'AA', esgScore: 7.5, environmental: 7.2, social: 7.8, governance: 7.5, carbonIntensity: 180, controversy: 'NONE', esgMomentum: 0.5, sustainable: false },
  { symbol: '0700', name: 'Tencent', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', esgRating: 'BBB', esgScore: 5.5, environmental: 5.2, social: 6.0, governance: 5.3, carbonIntensity: 95, controversy: 'MODERATE', esgMomentum: -0.5, sustainable: false },
  { symbol: 'SHEL', name: 'Shell', market: 'UK', flag: '\u{1F1EC}\u{1F1E7}', esgRating: 'A', esgScore: 6.8, environmental: 5.5, social: 7.2, governance: 7.5, carbonIntensity: 1200, controversy: 'MINOR', esgMomentum: 0.8, sustainable: false },
  { symbol: '7203', name: 'Toyota', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', esgRating: 'A', esgScore: 7.0, environmental: 7.8, social: 7.0, governance: 6.5, carbonIntensity: 320, controversy: 'NONE', esgMomentum: 0.2, sustainable: false },
];

const MOCK_OPTIONS: OptionsSignal[] = [
  { id: 'SPX_skew', name: 'SPX Skew', symbol: 'SPX', iv30: 16.5, ivPercentile: 45, skew: -3.2, pcr: 0.85, gammaExposure: 5800, vannaFlow: 120, signal: 'BULLISH', description: 'Skew flattening — dealers long gamma, suppressing volatility' },
  { id: 'NDX_skew', name: 'NDX Skew', symbol: 'NDX', iv30: 22.5, ivPercentile: 65, skew: -5.5, pcr: 0.72, gammaExposure: 3200, vannaFlow: 85, signal: 'BULLISH', description: 'Call skew elevated — AI/tech euphoria' },
  { id: 'AAPL_opt', name: 'AAPL Options', symbol: 'AAPL', iv30: 25.2, ivPercentile: 55, skew: -1.8, pcr: 0.68, gammaExposure: 420, vannaFlow: 35, signal: 'BULLISH', description: 'Normal IV, bullish positioning' },
  { id: 'TSLA_opt', name: 'TSLA Options', symbol: 'TSLA', iv30: 55.5, ivPercentile: 85, skew: -12.5, pcr: 1.25, gammaExposure: -850, vannaFlow: -120, signal: 'BEARISH', description: 'Elevated IV, negative gamma — dealers selling into rallies' },
  { id: 'VIX_term', name: 'VIX Term Structure', symbol: 'VIX', iv30: 14.2, ivPercentile: 35, skew: 0, pcr: 0, gammaExposure: 0, vannaFlow: 0, signal: 'BULLISH', description: 'Contango — normal calm market' },
];

const MOCK_FI: FIMetric[] = [
  { id: 'us10y', name: 'US 10Y Yield', value: 4.35, unit: '%', prevValue: 4.50, signal: 'BULLISH', description: 'Yields falling — bullish for duration, growth stocks', category: 'Rates' },
  { id: 'yield_curve', name: '2s10s Spread', value: -0.15, unit: '%', prevValue: -0.25, signal: 'NEUTRAL', description: 'Inverted but steepening — recession risk fading', category: 'Curve' },
  { id: 'ig_spread', name: 'IG Credit Spread', value: 95, unit: 'bps', prevValue: 105, signal: 'BULLISH', description: 'Credit spreads tightening — risk appetite healthy', category: 'Credit' },
  { id: 'hy_spread', name: 'HY Credit Spread', value: 380, unit: 'bps', prevValue: 420, signal: 'BULLISH', description: 'High yield spreads narrowing — risk-on', category: 'Credit' },
  { id: 'tips_breakeven', name: '10Y Breakeven', value: 2.35, unit: '%', prevValue: 2.40, signal: 'NEUTRAL', description: 'Inflation expectations stable near Fed target', category: 'Inflation' },
  { id: 'mortgage_spread', name: 'MBS Spread', value: 45, unit: 'bps', prevValue: 52, signal: 'BULLISH', description: 'Mortgage spreads tightening — housing supportive', category: 'MBS' },
  { id: 'sofr', name: 'SOFR Overnight', value: 4.85, unit: '%', prevValue: 5.05, signal: 'BULLISH', description: 'Fed cutting cycle — lower funding costs', category: 'Rates' },
  { id: 'duration', name: 'Agg Duration', value: 6.2, unit: 'yr', prevValue: 6.3, signal: 'NEUTRAL', description: 'Bond market duration stable', category: 'Duration' },
  { id: 'em_spread', name: 'EMBI Spread', value: 320, unit: 'bps', prevValue: 345, signal: 'BULLISH', description: 'EM spreads tightening — risk-on for EM equities', category: 'Credit' },
  { id: 'liquidity_prem', name: 'TIPS Liquidity', value: 8, unit: 'bps', prevValue: 12, signal: 'BULLISH', description: 'Treasury liquidity improving', category: 'Liquidity' },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function ESGRatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = { AAA: '#22c55e', AA: '#86efac', A: '#fbbf24', BBB: '#f59e0b', BB: '#f97316', B: '#ef4444', CCC: '#dc2626' };
  return <span style={{ padding: '2px 8px', borderRadius: 4, background: `${colors[rating] || '#6b7280'}20`, color: colors[rating] || '#6b7280', fontSize: 10, fontWeight: 700 }}>{rating}</span>;
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}

function IVGauge({ value, percentile }: { value: number; percentile: number }) {
  const color = percentile > 80 ? '#ef4444' : percentile > 60 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ position: 'relative', width: 48, height: 24, borderRadius: 12, background: 'var(--bg-input)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 12, width: '100%', background: 'rgba(239,68,68,.15)' }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 12, width: '100%', background: 'rgba(34,197,94,.15)' }} />
      <div style={{ position: 'absolute', left: `${Math.min(percentile, 95)}%`, top: 2, width: 2, height: 20, background: color, borderRadius: 1, transform: 'translateX(-50%)' }} />
      <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', top: 4, fontSize: 8, fontWeight: 700, color }}>{value.toFixed(0)}</span>
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const ESGOptionsFIPanel: React.FC = () => {
  const [tab, setTab] = useState<'esg' | 'options' | 'fi'>('esg');

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          {tab === 'esg' ? '\u{267B}\u{FE0F} ESG Ratings' : tab === 'options' ? '\u{1F4CA} Options Signals' : '\u{1F3E6} Fixed Income'}
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('esg')} style={tabBtn(tab === 'esg')}>{'\u{267B}\u{FE0F}'} ESG</button>
          <button onClick={() => setTab('options')} style={tabBtn(tab === 'options')}>{'\u{1F4CA}'} Options</button>
          <button onClick={() => setTab('fi')} style={tabBtn(tab === 'fi')}>{'\u{1F3E6}'} FI</button>
        </div>
      </div>

      {tab === 'esg' ? (
        <div style={{ overflowX: 'auto' }}>
          {/* ESG summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Avg ESG Score</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{(MOCK_ESG.reduce((s, e) => s + e.esgScore, 0) / MOCK_ESG.length).toFixed(1)}/10</div>
            </div>
            <div style={{ flex: 1, padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>SFDR Sustainable</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{MOCK_ESG.filter(e => e.sustainable).length}/{MOCK_ESG.length}</div>
            </div>
            <div style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: MOCK_ESG.filter(e => e.controversy !== 'NONE').length > 0 ? 'rgba(239,68,68,.06)' : 'var(--bg-card)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Controversies</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{MOCK_ESG.filter(e => e.controversy !== 'NONE').length}</div>
            </div>
          </div>

          {/* ESG Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={thE}>Symbol</th>
                <th style={thE}>Rating</th>
                <th style={thE}>E /10</th>
                <th style={thE}>S /10</th>
                <th style={thE}>G /10</th>
                <th style={thE}>Carbon</th>
                <th style={thE}>Momentum</th>
                <th style={thE}>Controversy</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ESG.map(e => (
                <tr key={e.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdE}>
                    <span style={{ fontSize: 12 }}>{e.flag}</span>
                    <span style={{ fontWeight: 700, marginLeft: 4 }}>{e.symbol}</span>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{e.name}</div>
                  </td>
                  <td style={tdE}><ESGRatingBadge rating={e.esgRating} /></td>
                  <td style={tdE}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScoreBar value={e.environmental} max={10} color="#22c55e" />
                      <span style={{ fontSize: 9 }}>{e.environmental.toFixed(1)}</span>
                    </div>
                  </td>
                  <td style={tdE}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScoreBar value={e.social} max={10} color="#6366f1" />
                      <span style={{ fontSize: 9 }}>{e.social.toFixed(1)}</span>
                    </div>
                  </td>
                  <td style={tdE}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScoreBar value={e.governance} max={10} color="#f59e0b" />
                      <span style={{ fontSize: 9 }}>{e.governance.toFixed(1)}</span>
                    </div>
                  </td>
                  <td style={{ ...tdE, textAlign: 'right', color: e.carbonIntensity > 500 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                    {e.carbonIntensity} tCO2
                  </td>
                  <td style={{ ...tdE, textAlign: 'center', color: e.esgMomentum > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {e.esgMomentum > 0 ? '+' : ''}{e.esgMomentum.toFixed(1)}
                  </td>
                  <td style={tdE}>
                    {e.controversy !== 'NONE' ? (
                      <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(239,68,68,.12)', color: '#ef4444', fontSize: 9, fontWeight: 600 }}>{e.controversy}</span>
                    ) : <span style={{ color: '#22c55e', fontSize: 9 }}>{'\u{2705}'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'options' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MOCK_OPTIONS.map(o => (
            <div key={o.id} style={{
              padding: '10px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderLeft: `4px solid ${o.signal === 'BULLISH' ? '#22c55e' : o.signal === 'BEARISH' ? '#ef4444' : '#f59e0b'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{o.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{o.description}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
                    <span>IV30: <strong>{o.iv30.toFixed(1)}%</strong></span>
                    <span>Skew: <strong style={{ color: Math.abs(o.skew) > 5 ? '#ef4444' : 'var(--text)' }}>{o.skew.toFixed(1)}</strong></span>
                    <span>PCR: <strong style={{ color: o.pcr > 1 ? '#ef4444' : '#22c55e' }}>{o.pcr.toFixed(2)}</strong></span>
                    <span>GEX: <strong style={{ color: o.gammaExposure > 1000 ? '#22c55e' : o.gammaExposure < -500 ? '#ef4444' : 'var(--text)' }}>${o.gammaExposure}M</strong></span>
                  </div>
                </div>
                <IVGauge value={o.iv30} percentile={o.ivPercentile} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            {'\u{1F4CC}'} IV Rank &gt;80 = expensive options | PCR &gt;1.2 = put heavy (bearish) | Negative GEX = dealers selling into rallies — amplifies downside
          </div>
        </div>
      ) : (
        /* Fixed Income tab */
        <div>
          {['Rates', 'Curve', 'Credit', 'Inflation', 'MBS', 'Duration', 'Liquidity'].map(cat => {
            const items = MOCK_FI.filter(f => f.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>{'\u{25B8}'} {cat}</div>
                {items.map(f => (
                  <div key={f.id} style={{
                    padding: '8px 10px', marginBottom: 3, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 11 }}>{f.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{f.description}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {f.value}{f.unit}
                      </div>
                      <div style={{ fontSize: 10, color: (f.value < f.prevValue ? (f.signal === 'BULLISH' ? '#22c55e' : '#ef4444') : (f.signal === 'BULLISH' ? '#ef4444' : '#22c55e')) }}>
                        Prev: {f.prevValue}{f.unit}
                        <span style={{ marginLeft: 4 }}>
                          {f.value < f.prevValue ? '\u2193' : '\u2191'}{Math.abs(f.value - f.prevValue).toFixed(f.unit === '%' || f.unit === 'yr' ? 1 : 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            {'\u{1F4CC}'} Yield curve inverted but steepening = late cycle | Credit spreads &lt;100bps IG = risk-on | &gt;400bps HY = stress signal
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

const thE: React.CSSProperties = { padding: '5px 6px', borderBottom: '2px solid var(--border)', fontSize: 10, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdE: React.CSSProperties = { padding: '4px 6px', verticalAlign: 'middle' };

export default ESGOptionsFIPanel;
