/**
 * BrazilOptionsPanel — R273 ML#3: 巴西期权+ADR面板
 *
 * B3 exchange data:
 * - Bovespa index options
 * - Stock options (PETR4, VALE3)
 * - ADR correlation (PBR, VALE US vs Brazil)
 * - Brazil risk premium (EMBI+)
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface BrazilOption {
  symbol: string;
  name: string;
  localPrice: number;
  localChg: number;
  callOI: number;
  putOI: number;
  pcr: number;
  iv30d: number;
  ivChg: number;
}

interface ADRCorrelation {
  brazilSymbol: string;
  brazilName: string;
  adrSymbol: string;
  adrName: string;
  brazilPrice: number;
  adrPrice: number;
  adrRatio: number;      // ADR:Local ratio
  premium: number;        // % premium/discount
  correlation30d: number;
  spreadHistory: number[];
}

interface MacroRisk {
  indicator: string;
  value: number;
  change: number;
  level: 'low' | 'elevated' | 'high';
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_BRAZIL_OPTIONS: BrazilOption[] = [
  { symbol: 'IBOV', name: 'Ibovespa Index', localPrice: 128500, localChg: 0.6, callOI: 285, putOI: 320, pcr: 1.12, iv30d: 22.5, ivChg: 1.2 },
  { symbol: 'PETR4', name: 'Petrobras PN', localPrice: 38.5, localChg: 1.8, callOI: 125, putOI: 95, pcr: 0.76, iv30d: 35.2, ivChg: -2.5 },
  { symbol: 'VALE3', name: 'Vale ON', localPrice: 72.3, localChg: -0.8, callOI: 98, putOI: 112, pcr: 1.14, iv30d: 28.8, ivChg: 3.1 },
  { symbol: 'ITUB4', name: 'Itau Unibanco PN', localPrice: 35.2, localChg: 0.3, callOI: 185, putOI: 142, pcr: 0.77, iv30d: 25.1, ivChg: -0.5 },
  { symbol: 'BBDC4', name: 'Bradesco PN', localPrice: 15.8, localChg: -1.2, callOI: 88, putOI: 105, pcr: 1.19, iv30d: 30.2, ivChg: 2.8 },
  { symbol: 'WEGE3', name: 'WEG ON', localPrice: 42.1, localChg: 2.5, callOI: 55, putOI: 38, pcr: 0.69, iv30d: 28.5, ivChg: -1.8 },
];

const MOCK_ADRS: ADRCorrelation[] = [
  { brazilSymbol: 'PETR4', brazilName: 'Petrobras PN', adrSymbol: 'PBR', adrName: 'Petrobras ADR', brazilPrice: 38.5, adrPrice: 15.2, adrRatio: 2, premium: -1.2, correlation30d: 0.92, spreadHistory: [] },
  { brazilSymbol: 'VALE3', brazilName: 'Vale ON', adrSymbol: 'VALE', adrName: 'Vale ADR', brazilPrice: 72.3, adrPrice: 14.5, adrRatio: 5, premium: 0.3, correlation30d: 0.95, spreadHistory: [] },
  { brazilSymbol: 'ITUB4', brazilName: 'Itau Unibanco PN', adrSymbol: 'ITUB', adrName: 'Itau ADR', brazilPrice: 35.2, adrPrice: 7.0, adrRatio: 5, premium: -0.6, correlation30d: 0.94, spreadHistory: [] },
  { brazilSymbol: 'BBDC4', brazilName: 'Bradesco PN', adrSymbol: 'BBD', adrName: 'Bradesco ADR', brazilPrice: 15.8, adrPrice: 3.2, adrRatio: 5, premium: 1.2, correlation30d: 0.91, spreadHistory: [] },
];

const MOCK_MACRO: MacroRisk[] = [
  { indicator: 'EMBI+ Brazil Spread', value: 285, change: 12, level: 'elevated' },
  { indicator: 'CDS 5Y', value: 165, change: -8, level: 'elevated' },
  { indicator: 'USD/BRL', value: 5.42, change: 0.08, level: 'high' },
  { indicator: 'Brazil 10Y Yield', value: 12.8, change: 0.15, level: 'high' },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
const RiskBadge = ({ level }: { level: MacroRisk['level'] }) => {
  const c = level === 'high' ? { bg: 'rgba(239,68,68,.15)', fg: '#ef4444', t: '⃠ High' }
    : level === 'elevated' ? { bg: 'rgba(245,158,11,.15)', fg: '#f59e0b', t: '⚠ Elevated' }
    : { bg: 'rgba(34,197,94,.15)', fg: '#22c55e', t: '✅ Low' };
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 600 }}>{c.t}</span>;
};

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const BrazilOptionsPanel: React.FC = () => {
  const [tab, setTab] = useState<'options' | 'adr' | 'macro'>('options');

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇧🇷 Brazil B3 + ADR</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['options', 'adr', 'macro'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: tab === t ? 700 : 500,
            }}>{t === 'options' ? '📈 Options' : t === 'adr' ? '🇺🇸 ADR' : '⚠ Macro'}</button>
          ))}
        </div>
      </div>

      {tab === 'options' ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thB}>Symbol</th>
                <th style={thB}>Price (BRL)</th>
                <th style={thB}>Call OI</th>
                <th style={thB}>Put OI</th>
                <th style={thB}>PCR</th>
                <th style={thB}>IV30</th>
                <th style={thB}>IV Δ</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_BRAZIL_OPTIONS.map(o => {
                const maxOI = Math.max(...MOCK_BRAZIL_OPTIONS.map(x => x.callOI + x.putOI));
                return (
                  <tr key={o.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdB}>
                      <span style={{ fontWeight: 700 }}>{o.symbol}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{o.name}</div>
                    </td>
                    <td style={{ ...tdB, textAlign: 'right' }}>
                      R${o.localPrice.toFixed(2)}
                      <span style={{ marginLeft: 4, fontSize: 10, color: o.localChg > 0 ? '#22c55e' : '#ef4444' }}>
                        {o.localChg > 0 ? '+' : ''}{o.localChg}%
                      </span>
                    </td>
                    <td style={tdB}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ height: 6, flex: 1, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                          <div style={{ width: `${(o.callOI / (maxOI || 1)) * 100}%`, height: '100%', background: '#22c55e', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10 }}>{o.callOI}K</span>
                      </div>
                    </td>
                    <td style={tdB}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ height: 6, flex: 1, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                          <div style={{ width: `${(o.putOI / (maxOI || 1)) * 100}%`, height: '100%', background: '#ef4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10 }}>{o.putOI}K</span>
                      </div>
                    </td>
                    <td style={{ ...tdB, textAlign: 'right', fontWeight: 600, color: o.pcr > 1 ? '#ef4444' : '#22c55e' }}>
                      {o.pcr.toFixed(2)}
                    </td>
                    <td style={{ ...tdB, textAlign: 'right', fontWeight: 600 }}>
                      {o.iv30d.toFixed(1)}%
                    </td>
                    <td style={{ ...tdB, textAlign: 'right', color: o.ivChg > 0 ? '#ef4444' : '#22c55e', fontSize: 10 }}>
                      {o.ivChg > 0 ? '+' : ''}{o.ivChg.toFixed(1)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : tab === 'adr' ? (
        <>
          {/* ADR premium/discount */}
          {MOCK_ADRS.map(a => {
            const isPremium = a.premium > 0;
            return (
              <div key={a.brazilSymbol} style={{ padding: 8, marginBottom: 4, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{a.brazilSymbol}</span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-dim)' }}>{a.brazilName}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    Corr: <span style={{ fontWeight: 700, color: a.correlation30d > 0.9 ? '#22c55e' : '#f59e0b' }}>{(a.correlation30d * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Price comparison bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.adrSymbol} (US)</div>
                    <div style={{ fontWeight: 600 }}>${a.adrPrice.toFixed(2)}</div>
                  </div>

                  {/* Spread visualizer */}
                  <div style={{ flex: 2, position: 'relative', height: 24, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: '30%', top: 0, bottom: 0, width: '40%', background: 'rgba(99,102,241,.15)', borderLeft: '2px solid #6366f1', borderRight: '2px solid #6366f1' }} />
                    {/* Indicator dot */}
                    <div style={{
                      position: 'absolute', left: `${Math.min(Math.max(50 + (a.premium * 3), 5), 95)}%`, top: 4,
                      width: 8, height: 8, borderRadius: '50%', background: isPremium ? '#22c55e' : '#ef4444',
                      transform: 'translateX(-50%)', boxShadow: `0 0 6px ${isPremium ? '#22c55e' : '#ef4444'}`,
                    }} />
                    <div style={{ position: 'absolute', right: 4, top: 4, fontSize: 9, fontWeight: 700, color: isPremium ? '#22c55e' : '#ef4444' }}>
                      {isPremium ? '↑ PREMIUM' : '↓ DISCOUNT'} {Math.abs(a.premium).toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.brazilSymbol} (BR)</div>
                    <div style={{ fontWeight: 600 }}>R${a.brazilPrice.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            📌 ADR premium &gt;2% = US investors willing to pay more (bullish on Brazil). ADR discount &lt;-2% = US investors bearish. Track correlation: if corr drops &lt;0.85, US and Brazil markets are diverging = arbitrage signal.
          </div>
        </>
      ) : (
        /* Macro risk panel */
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            {MOCK_MACRO.map(m => (
              <div key={m.indicator} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 11 }}>{m.indicator}</div>
                  <RiskBadge level={m.level} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{m.value.toFixed(m.indicator.includes('%') ? 0 : m.indicator.includes('Yield') ? 1 : 0)}{m.indicator.includes('Yield') ? '%' : m.indicator.includes('USD') ? '' : 'bps'}</div>
                  <div style={{ fontSize: 10, color: m.change > 0 ? '#ef4444' : '#22c55e' }}>
                    {m.change > 0 ? '↑' : '↓'}{Math.abs(m.change)}{m.indicator.includes('Yield') ? 'pp' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            📌 Brazil risk = EMBI+ Spread + CDS + USD/BRL + local yields. All 4 elevated = risk-off on Brazil. Track before trading B3 options — IV spikes on political/news shocks.
          </div>
        </>
      )}
    </div>
  );
};

const thB: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdB: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default BrazilOptionsPanel;
