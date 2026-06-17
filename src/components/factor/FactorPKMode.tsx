/**
 * FactorPKMode — R279 ML#3: 因子PK模式 (Factor Head-to-Head Comparison)
 *
 * Side-by-side factor battle:
 * - Compare 2 factors on multiple dimensions
 * - Rolling IC comparison chart
 * - Win rate by market regime
 * - Correlation between factors
 * - "Which factor should I use right now?"
 */
import React, { useState } from 'react';

interface FactorFighter {
  id: string;
  name: string;
  market: string;
  flag: string;
  category: string;
  ic12m: number;
  icVol: number;
  sharpe: number;
  maxDD: number;
  winRate: number;
  turnover: number;
  capacity: number;
  crowding: number;
  regimePerformance: Record<string, number>;
}

const FACTOR_POOL: FactorFighter[] = [
  { id: 'value_us', name: 'US Value (PE)', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', category: 'Value', ic12m: 0.06, icVol: 0.22, sharpe: 0.85, maxDD: 25, winRate: 55, turnover: 35, capacity: 0.8, crowding: 0.4, regimePerformance: { 'Risk-On': 0.04, 'Risk-Off': 0.08, 'Bull': 0.02, 'Bear': 0.10 } },
  { id: 'momentum_us', name: 'US Momentum 12M', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', category: 'Momentum', ic12m: 0.08, icVol: 0.28, sharpe: 0.95, maxDD: 35, winRate: 58, turnover: 120, capacity: 0.5, crowding: 0.6, regimePerformance: { 'Risk-On': 0.10, 'Risk-Off': 0.02, 'Bull': 0.12, 'Bear': -0.05 } },
  { id: 'quality_us', name: 'US Quality (ROE)', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', category: 'Quality', ic12m: 0.05, icVol: 0.18, sharpe: 0.75, maxDD: 18, winRate: 53, turnover: 25, capacity: 0.9, crowding: 0.5, regimePerformance: { 'Risk-On': 0.04, 'Risk-Off': 0.06, 'Bull': 0.03, 'Bear': 0.07 } },
  { id: 'size_us', name: 'US Size (Small-Cap)', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', category: 'Size', ic12m: 0.03, icVol: 0.15, sharpe: 0.45, maxDD: 20, winRate: 48, turnover: 15, capacity: 0.3, crowding: 0.25, regimePerformance: { 'Risk-On': 0.05, 'Risk-Off': 0.01, 'Bull': 0.06, 'Bear': -0.02 } },
  { id: 'value_cn', name: 'CN A-Share Value', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', category: 'Value', ic12m: 0.09, icVol: 0.35, sharpe: 0.65, maxDD: 40, winRate: 52, turnover: 55, capacity: 0.6, crowding: 0.2, regimePerformance: { 'Risk-On': 0.08, 'Risk-Off': 0.05, 'Bull': 0.10, 'Bear': 0.04 } },
  { id: 'northbound_cn', name: 'CN Northbound Flow', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', category: 'Flow', ic12m: 0.11, icVol: 0.30, sharpe: 0.88, maxDD: 28, winRate: 60, turnover: 80, capacity: 0.5, crowding: 0.35, regimePerformance: { 'Risk-On': 0.12, 'Risk-Off': 0.06, 'Bull': 0.14, 'Bear': 0.03 } },
];

const DIMENSIONS = ['sharpe', 'maxDD', 'winRate', 'turnover', 'capacity', 'crowding'] as const;
const DIM_LABELS: Record<string, string> = { sharpe: 'Sharpe', maxDD: 'Max DD (inverted)', winRate: 'Win Rate', turnover: 'Turnover (inv)', capacity: 'Capacity', crowding: 'Crowding (inv)' };

function normalizeDD(dd: number) { return Math.max(0, 100 - dd); }
function normalizeTO(to: number) { return Math.max(0, 100 - to); }
function normalizeCrowd(c: number) { return Math.max(0, 100 - c * 100); }

function getDimValue(f: FactorFighter, dim: string): number {
  switch(dim) {
    case 'sharpe': return f.sharpe * 40;
    case 'maxDD': return normalizeDD(f.maxDD);
    case 'winRate': return f.winRate;
    case 'turnover': return normalizeTO(f.turnover);
    case 'capacity': return f.capacity * 100;
    case 'crowding': return normalizeCrowd(f.crowding);
    default: return 50;
  }
}

export const FactorPKMode: React.FC = () => {
  const [leftId, setLeftId] = useState(FACTOR_POOL[0].id);
  const [rightId, setRightId] = useState(FACTOR_POOL[2].id);
  const [regime, setRegime] = useState<string>('Bull');

  const left = FACTOR_POOL.find(f => f.id === leftId)!;
  const right = FACTOR_POOL.find(f => f.id === rightId)!;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{2694}\u{FE0F}'} Factor PK Arena</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Bull', 'Bear', 'Risk-On', 'Risk-Off'].map(r => (
            <button key={r} onClick={() => setRegime(r)} style={{
              padding: '2px 8px', borderRadius: 4, border: regime === r ? '1px solid var(--accent)' : '1px solid transparent',
              background: regime === r ? 'rgba(99,102,241,.10)' : 'var(--bg-input)',
              color: regime === r ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: regime === r ? 600 : 400,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Fighter selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select value={leftId} onChange={e => setLeftId(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '2px solid #6366f1', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
          {FACTOR_POOL.filter(f => f.id !== rightId).map(f => <option key={f.id} value={f.id}>{f.flag} {f.name}</option>)}
        </select>
        <div style={{ textAlign: 'center', fontSize: 24 }}>{'\u2694}\u{FE0F}'}</div>
        <select value={rightId} onChange={e => setRightId(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '2px solid #ef4444', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
          {FACTOR_POOL.filter(f => f.id !== leftId).map(f => <option key={f.id} value={f.id}>{f.flag} {f.name}</option>)}
        </select>
      </div>

      {/* Radar comparison */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 6, fontSize: 10, color: 'var(--text-dim)' }}>Multi-Dimensional Comparison</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg viewBox="0 0 260 200" width={260} height={200}>
            {DIMENSIONS.map((dim, i) => {
              const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
              const cx = 130, cy = 100, r = 70;
              const lx = cx + Math.cos(angle) * (r + 18);
              const ly = cy + Math.sin(angle) * (r + 18);
              return <text key={`lbl-${i}`} x={lx} y={ly} textAnchor="middle" fontSize={7} fill="var(--text-dim)" fontWeight={600}>{DIM_LABELS[dim]}</text>;
            })}
            {/* Grid */}
            {[0.25, 0.5, 0.75].map(lvl => {
              const pts = DIMENSIONS.map((_, i) => {
                const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
                return `${130 + Math.cos(angle) * 70 * lvl},${100 + Math.sin(angle) * 70 * lvl}`;
              }).join(' ');
              return <polygon key={lvl} points={pts} fill="none" stroke="var(--border)" strokeWidth={0.5} />;
            })}
            {/* Left fighter */}
            <polygon points={DIMENSIONS.map((dim, i) => {
              const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
              const v = getDimValue(left, dim) / 100;
              return `${130 + Math.cos(angle) * 70 * v},${100 + Math.sin(angle) * 70 * v}`;
            }).join(' ')} fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={1.5} />
            {/* Right fighter */}
            <polygon points={DIMENSIONS.map((dim, i) => {
              const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
              const v = getDimValue(right, dim) / 100;
              return `${130 + Math.cos(angle) * 70 * v},${100 + Math.sin(angle) * 70 * v}`;
            }).join(' ')} fill="rgba(239,68,68,0.12)" stroke="#ef4444" strokeWidth={1.5} />
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10 }}>
          <span>{'\u{1F7E6}'} {left.name}</span>
          <span>{'\u{1F7E5}'} {right.name}</span>
        </div>
      </div>

      {/* Stats table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thPK}>Metric</th>
              <th style={{ ...thPK, textAlign: 'center', color: '#6366f1' }}>{left.flag} {left.name}</th>
              <th style={{ ...thPK, textAlign: 'center', color: '#ef4444' }}>{right.flag} {right.name}</th>
              <th style={thPK}>Winner</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: '12M IC', leftVal: left.ic12m, rightVal: right.ic12m, fmt: (v: number) => `${(v*100).toFixed(1)}%`, higher: true },
              { label: 'IC Volatility', leftVal: left.icVol, rightVal: right.icVol, fmt: (v: number) => v.toFixed(2), higher: false },
              { label: 'Sharpe', leftVal: left.sharpe, rightVal: right.sharpe, fmt: (v: number) => v.toFixed(2), higher: true },
              { label: 'Max DD', leftVal: left.maxDD, rightVal: right.maxDD, fmt: (v: number) => `${v}%`, higher: false },
              { label: 'Win Rate', leftVal: left.winRate, rightVal: right.winRate, fmt: (v: number) => `${v}%`, higher: true },
              { label: 'Turnover %', leftVal: left.turnover, rightVal: right.turnover, fmt: (v: number) => `${v}%`, higher: false },
              { label: 'Capacity', leftVal: left.capacity, rightVal: right.capacity, fmt: (v: number) => v.toFixed(1), higher: true },
              { label: 'Crowding', leftVal: left.crowding, rightVal: right.crowding, fmt: (v: number) => v.toFixed(2), higher: false },
              { label: `${regime} Regime IC`, leftVal: left.regimePerformance[regime] ?? 0, rightVal: right.regimePerformance[regime] ?? 0, fmt: (v: number) => `${(v*100).toFixed(1)}%`, higher: true },
            ].map(row => {
              const lWin = row.higher ? row.leftVal > row.rightVal : row.leftVal < row.rightVal;
              const rWin = row.higher ? row.rightVal > row.leftVal : row.rightVal < row.leftVal;
              const tie = row.leftVal === row.rightVal;
              return (
                <tr key={row.label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdPK}>{row.label}</td>
                  <td style={{ ...tdPK, textAlign: 'center', fontWeight: lWin && !tie ? 700 : 400, color: lWin && !tie ? '#22c55e' : 'var(--text)' }}>
                    {row.fmt(row.leftVal)}
                  </td>
                  <td style={{ ...tdPK, textAlign: 'center', fontWeight: rWin && !tie ? 700 : 400, color: rWin && !tie ? '#22c55e' : 'var(--text)' }}>
                    {row.fmt(row.rightVal)}
                  </td>
                  <td style={{ ...tdPK, textAlign: 'center' }}>
                    {tie ? '\u{27A1}\u{FE0F}' : lWin ? '\u{1F7E6}' : '\u{1F7E5}'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score */}
      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
          {left.regimePerformance[regime] > right.regimePerformance[regime]
            ? `\u{1F3C6} ${left.name} wins in ${regime} regime (+${(left.regimePerformance[regime]*100).toFixed(1)}% IC)`
            : `\u{1F3C6} ${right.name} wins in ${regime} regime (+${(right.regimePerformance[regime]*100).toFixed(1)}% IC)`}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
          Switch regimes above to see how factor effectiveness changes across market conditions
        </div>
      </div>
    </div>
  );
};

const thPK: React.CSSProperties = { padding: '4px 8px', borderBottom: '2px solid var(--border)', fontSize: 10, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdPK: React.CSSProperties = { padding: '3px 8px', verticalAlign: 'middle' };

export default FactorPKMode;
