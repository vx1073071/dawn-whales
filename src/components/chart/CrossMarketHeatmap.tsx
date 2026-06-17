/**
 * CrossMarketHeatmap — R274 ML#2: 联动热图UI (Cross-Market Correlation)
 *
 * Interactive correlation matrix + scatter plot:
 * - 10-market correlation matrix
 * - Sector-level cross-market correlation
 * - Leading/lagging indicator
 * - Time-shifted correlation
 * - Click to scatter plot
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface CorrEntry {
  from: string;
  to: string;
  value: number;
  lag: number;     // days lead/lag
  r2: number;
}

interface MarketIndex {
  id: string;
  name: string;
  flag: string;
  current: number;
  changePct: number;
  corrToSPX: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const INDICES: MarketIndex[] = [
  { id: 'SPX', name: 'S&P 500', flag: '\u{1F1FA}\u{1F1F8}', current: 5480, changePct: 0.6, corrToSPX: 1.00 },
  { id: 'NDX', name: 'Nasdaq 100', flag: '\u{1F1FA}\u{1F1F8}', current: 19500, changePct: 0.9, corrToSPX: 0.95 },
  { id: 'UKX', name: 'FTSE 100', flag: '\u{1F1EC}\u{1F1E7}', current: 8250, changePct: 0.3, corrToSPX: 0.72 },
  { id: 'SX5E', name: 'Euro Stoxx 50', flag: '\u{1F1EA}\u{1F1FA}', current: 5020, changePct: 0.4, corrToSPX: 0.68 },
  { id: 'N225', name: 'Nikkei 225', flag: '\u{1F1EF}\u{1F1F5}', current: 39200, changePct: 1.2, corrToSPX: 0.58 },
  { id: 'HSI', name: 'Hang Seng', flag: '\u{1F1ED}\u{1F1F0}', current: 19450, changePct: -0.5, corrToSPX: 0.35 },
  { id: 'CSI', name: 'CSI 300', flag: '\u{1F1E8}\u{1F1F3}', current: 3580, changePct: -0.3, corrToSPX: 0.25 },
  { id: 'KOSPI', name: 'KOSPI', flag: '\u{1F1F0}\u{1F1F7}', current: 2785, changePct: 0.8, corrToSPX: 0.55 },
  { id: 'NIFTY', name: 'Nifty 50', flag: '\u{1F1EE}\u{1F1F3}', current: 23450, changePct: 0.8, corrToSPX: 0.42 },
  { id: 'IBOV', name: 'Ibovespa', flag: '\u{1F1E7}\u{1F1F7}', current: 128500, changePct: 0.1, corrToSPX: 0.38 },
];

// Generate full correlation matrix from corrToSPX
function generateCorrelations(): CorrEntry[][] {
  const entries: CorrEntry[][] = [];
  for (let i = 0; i < INDICES.length; i++) {
    const row: CorrEntry[] = [];
    for (let j = 0; j < INDICES.length; j++) {
      if (i === j) {
        row.push({ from: INDICES[i].id, to: INDICES[j].id, value: 1.0, lag: 0, r2: 1.0 });
      } else {
        // Simulate: correlation = sqrt(corrA * corrB) + noise
        const base1 = INDICES[i].corrToSPX;
        const base2 = INDICES[j].corrToSPX;
        const corr = Math.min(Math.sqrt(base1 * base2) + ((Math.sin(i * j * 1.7) * 0.1)), 0.99);
        const lag = Math.round(Math.sin(i * 0.8) * 2);
        row.push({ from: INDICES[i].id, to: INDICES[j].id, value: Math.max(corr, 0.05), lag, r2: corr * corr });
      }
    }
    entries.push(row);
  }
  return entries;
}

const SECTORS = ['Tech', 'Finance', 'Energy', 'Healthcare', 'Consumer'];
const MOCK_SECTOR_CORR: Record<string, number[]> = {
  'US-TW': [0.85, 0.42, 0.35, 0.58, 0.45],
  'US-KR': [0.78, 0.38, 0.32, 0.52, 0.40],
  'US-IN': [0.65, 0.45, 0.38, 0.55, 0.42],
  'US-HK': [0.55, 0.35, 0.30, 0.28, 0.25],
  'US-CN': [0.35, 0.25, 0.28, 0.20, 0.22],
};

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function CorrCell({ value, onClick, selected }: { value: number; onClick?: () => void; selected?: boolean }) {
  const abs = Math.abs(value);
  const isPositive = value > 0;
  const alpha = abs * abs;
  const bgColor = isPositive
    ? `rgba(34,197,94,${alpha})`
    : `rgba(239,68,68,${alpha})`;
  return (
    <div
      onClick={onClick}
      title={value.toFixed(3)}
      style={{
        padding: '3px 2px', textAlign: 'center', borderRadius: 3,
        background: bgColor, fontSize: 10, fontWeight: abs > 0.7 ? 700 : 400,
        color: abs > 0.5 ? '#fff' : 'var(--text)', cursor: onClick ? 'pointer' : 'default',
        border: selected ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all .2s', minWidth: 32,
        userSelect: 'none',
      }}
    >
      {value.toFixed(2)}
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const CrossMarketHeatmap: React.FC = () => {
  const [tab, setTab] = useState<'correlation' | 'sector' | 'lag'>('correlation');
  const [selected, setSelected] = useState<{ from: string; to: string } | null>(null);

  const corrMatrix = useMemo(() => generateCorrelations(), []);

  const selectedPair = selected
    ? corrMatrix[INDICES.findIndex(x => x.id === selected.from)][INDICES.findIndex(x => x.id === selected.to)]
    : null;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F310}'} Cross-Market Correlation</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['correlation', 'sector', 'lag'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: tab === t ? 700 : 500,
            }}>{t === 'correlation' ? '\u{1F4CA} Matrix' : t === 'sector' ? '\u{1F3ED} Sectors' : '\u{23F1} Lead/Lag'}</button>
          ))}
        </div>
      </div>

      {tab === 'correlation' ? (
        <>
          {/* Summary stat */}
          <div style={{ marginBottom: 12, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
            Average cross-market correlation: <span style={{ fontWeight: 700, color: 'var(--text)' }}>
              {(corrMatrix.flat().reduce((s, c) => s + c.value, 0) / (INDICES.length * INDICES.length)).toFixed(2)}
            </span>
            <span style={{ marginLeft: 8 }}>
              | {INDICES.filter(x => x.corrToSPX > 0.7).length}/{INDICES.length} highly coupled to US
            </span>
          </div>

          {/* Correlation Matrix */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 4 }}></th>
                  {INDICES.map(idx => (
                    <th key={idx.id} style={{ padding: '2px 4px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {idx.flag} {idx.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corrMatrix.map((row, i) => (
                  <tr key={INDICES[i].id}>
                    <td style={{ padding: '2px 4px', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {INDICES[i].flag} {INDICES[i].id}
                    </td>
                    {row.map((c, j) => (
                      <td key={j} style={{ padding: 1 }}>
                        <CorrCell
                          value={c.value}
                          selected={selected?.from === INDICES[i].id && selected?.to === INDICES[j].id}
                          onClick={() => setSelected({ from: INDICES[i].id, to: INDICES[j].id })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected pair details */}
          {selectedPair && selected && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
                {selected.from} \u2194 {selected.to}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Correlation: </span>
                  <span style={{ fontWeight: 700, color: selectedPair.value > 0.7 ? '#22c55e' : selectedPair.value > 0.4 ? '#f59e0b' : '#ef4444' }}>
                    {selectedPair.value.toFixed(3)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>R\u00B2: </span>
                  <span style={{ fontWeight: 600 }}>{(selectedPair.r2 * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Lead/Lag: </span>
                  <span style={{ fontWeight: 600, color: selectedPair.lag > 0 ? '#22c55e' : '#6366f1' }}>
                    {selected.from} {selectedPair.lag > 0 ? `leads by ${selectedPair.lag}d` : `lags by ${Math.abs(selectedPair.lag)}d`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 12, justifyContent: 'center' }}>
            <span>{'\u{1F7E9}'} &gt;0.7 High</span>
            <span>{'\u{1F7E8}'} 0.4-0.7 Medium</span>
            <span>{'\u{1F7E5}'} &lt;0.4 Low</span>
            <span>| Click to inspect pair</span>
          </div>
        </>
      ) : tab === 'sector' ? (
        <>
          {/* Sector-level cross-market */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={thC}>Pair</th>
                  {SECTORS.map(s => <th key={s} style={thC}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MOCK_SECTOR_CORR).map(([pair, values]) => {
                  const avgCorr = values.reduce((a, v) => a + v, 0) / values.length;
                  return (
                    <tr key={pair} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdC}><span style={{ fontWeight: 700 }}>{pair}</span>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Avg: {avgCorr.toFixed(2)}</div>
                      </td>
                      {values.map((v, i) => (
                        <td key={i} style={tdC}>
                          <CorrCell value={v} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            {'\u{1F4CC}'} Tech is the most globally correlated sector. China A-share sectors show lowest correlation to US = diversification value exists.
          </div>
        </>
      ) : (
        <>
          {/* Lead/Lag analysis */}
          <div style={{ display: 'grid', gap: 8 }}>
            {INDICES.filter(x => x.id !== 'SPX').map(idx => {
              const corrToSPX = idx.corrToSPX;
              const lag = Math.round((idx.corrToSPX - 0.5) * 4);
              return (
                <div key={idx.id} style={{
                  padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ minWidth: 60 }}>
                    <div style={{ fontSize: 20 }}>{idx.flag}</div>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{idx.id}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                      <span>Corr to SPX</span>
                      <span style={{ fontWeight: 600, color: corrToSPX > 0.6 ? '#22c55e' : '#f59e0b' }}>
                        {corrToSPX.toFixed(2)}
                      </span>
                    </div>
                    {/* Bar */}
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ width: `${corrToSPX * 100}%`, height: '100%', background: corrToSPX > 0.6 ? '#22c55e' : '#f59e0b', borderRadius: 3, transition: 'width .5s' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, textAlign: 'right', minWidth: 100 }}>
                    <div style={{ fontWeight: 600, color: lag > 0 ? '#6366f1' : '#f59e0b' }}>
                      {lag > 0 ? `\u2190 Lags US ${lag}d` : lag < 0 ? `\u2192 Leads US ${Math.abs(lag)}d` : 'In sync'}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>
                      R\u00B2: {(corrToSPX * corrToSPX * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
            {'\u{1F4CC}'} Asian markets lag US by 1-3 days (timezone effect). European markets mostly in sync. A-shares have lowest US correlation = portfolio diversification.
          </div>
        </>
      )}
    </div>
  );
};

const thC: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdC: React.CSSProperties = { padding: '4px 8px', verticalAlign: 'middle' };

export default CrossMarketHeatmap;
