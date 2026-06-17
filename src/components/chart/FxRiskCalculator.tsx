/**
 * FxRiskCalculator — R274 ML#4: 汇率风险计算器UI (Currency Risk Calculator)
 *
 * Portfolio FX exposure analysis:
 * - Per-currency P&L decomposition (asset return vs FX return)
 * - VaR by currency
 * - Hedge ratio recommendations
 * - Carry cost analysis
 * - Correlation-adjusted risk
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface FxPosition {
  currency: string;
  flag: string;
  exposure: number;        // USD equivalent
  assetReturn: number;     // % local currency
  fxReturn: number;        // % FX move
  totalReturn: number;     // % in base currency
  volatility: number;      // annualized %
  carry: number;           // % p.a.
  hedgeCost: number;       // % p.a.
  var95: number;           // % of exposure
}

interface HedgeScenario {
  ratio: number;          // 0-100%
  cost: number;
  reducedVar: number;
  netPosition: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_FX_POSITIONS: FxPosition[] = [
  { currency: 'JPY', flag: '\u{1F1EF}\u{1F1F5}', exposure: 250000, assetReturn: 2.5, fxReturn: -1.8, totalReturn: 0.7, volatility: 12.5, carry: -4.5, hedgeCost: 0.35, var95: 8.2 },
  { currency: 'HKD', flag: '\u{1F1ED}\u{1F1F0}', exposure: 380000, assetReturn: 1.2, fxReturn: 0.05, totalReturn: 1.25, volatility: 0.8, carry: -0.5, hedgeCost: 0.15, var95: 0.5 },
  { currency: 'KRW', flag: '\u{1F1F0}\u{1F1F7}', exposure: 180000, assetReturn: 0.8, fxReturn: 2.1, totalReturn: 2.9, volatility: 8.5, carry: -2.0, hedgeCost: 0.45, var95: 5.6 },
  { currency: 'TWD', flag: '\u{1F1F9}\u{1F1FC}', exposure: 220000, assetReturn: 1.5, fxReturn: -0.3, totalReturn: 1.2, volatility: 5.2, carry: -1.5, hedgeCost: 0.25, var95: 3.4 },
  { currency: 'INR', flag: '\u{1F1EE}\u{1F1F3}', exposure: 150000, assetReturn: 3.2, fxReturn: -0.8, totalReturn: 2.4, volatility: 6.5, carry: 3.5, hedgeCost: 0.85, var95: 4.8 },
  { currency: 'BRL', flag: '\u{1F1E7}\u{1F1F7}', exposure: 95000, assetReturn: 5.5, fxReturn: -3.2, totalReturn: 2.3, volatility: 18.5, carry: 8.2, hedgeCost: 1.50, var95: 14.2 },
  { currency: 'EUR', flag: '\u{1F1EA}\u{1F1FA}', exposure: 310000, assetReturn: 0.5, fxReturn: 1.2, totalReturn: 1.7, volatility: 7.8, carry: -1.2, hedgeCost: 0.20, var95: 5.1 },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
function generateHedgeScenarios(pos: FxPosition): HedgeScenario[] {
  return [
    { ratio: 0, cost: 0, reducedVar: pos.var95, netPosition: pos.exposure },
    { ratio: 25, cost: pos.exposure * 0.25 * pos.hedgeCost / 100, reducedVar: pos.var95 * 0.75, netPosition: pos.exposure * 0.75 },
    { ratio: 50, cost: pos.exposure * 0.50 * pos.hedgeCost / 100, reducedVar: pos.var95 * 0.50, netPosition: pos.exposure * 0.50 },
    { ratio: 75, cost: pos.exposure * 0.75 * pos.hedgeCost / 100, reducedVar: pos.var95 * 0.25, netPosition: pos.exposure * 0.25 },
    { ratio: 100, cost: pos.exposure * pos.hedgeCost / 100, reducedVar: 0.1, netPosition: 0 },
  ];
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const FxRiskCalculator: React.FC = () => {
  const [selectedCcy, setSelectedCcy] = useState<string | null>(null);
  const [hedgeTarget, setHedgeTarget] = useState(50);

  const totalExposure = MOCK_FX_POSITIONS.reduce((s, p) => s + p.exposure, 0);
  const weightedVar = MOCK_FX_POSITIONS.reduce((s, p) => s + p.var95 * p.exposure, 0) / totalExposure;
  const totalCarry = MOCK_FX_POSITIONS.reduce((s, p) => s + p.carry * p.exposure, 0) / totalExposure;

  const selectedPos = selectedCcy ? MOCK_FX_POSITIONS.find(p => p.currency === selectedCcy) : null;
  const scenarios = selectedPos ? generateHedgeScenarios(selectedPos) : [];
  const bestScenario = scenarios.find(s => s.ratio === hedgeTarget);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F4B1}'} FX Risk Calculator</h3>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Total FX Exposure</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>${(totalExposure / 1e6).toFixed(1)}M</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: weightedVar > 10 ? 'rgba(239,68,68,.06)' : 'rgba(245,158,11,.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Wtd VaR (95%)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: weightedVar > 10 ? '#ef4444' : '#f59e0b' }}>
            {weightedVar.toFixed(1)}%
          </div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: totalCarry > 0 ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Wtd Carry</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: totalCarry > 0 ? '#22c55e' : '#ef4444' }}>
            {totalCarry > 0 ? '+' : ''}{totalCarry.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Position table */}
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thF}>CCY</th>
              <th style={thF}>Exposure</th>
              <th style={thF}>Asset Rtn</th>
              <th style={thF}>FX Rtn</th>
              <th style={thF}>Total</th>
              <th style={thF}>Vol</th>
              <th style={thF}>Carry</th>
              <th style={thF}>VaR95</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_FX_POSITIONS.map(p => (
              <tr
                key={p.currency}
                onClick={() => setSelectedCcy(p.currency)}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selectedCcy === p.currency ? 'rgba(99,102,241,.06)' : 'transparent',
                }}
              >
                <td style={tdF}>
                  <span style={{ fontWeight: 700 }}>{p.flag} {p.currency}</span>
                </td>
                <td style={{ ...tdF, textAlign: 'right' }}>${(p.exposure / 1e3).toFixed(0)}K</td>
                <td style={{ ...tdF, textAlign: 'right', color: p.assetReturn > 0 ? '#22c55e' : '#ef4444' }}>
                  {p.assetReturn > 0 ? '+' : ''}{p.assetReturn.toFixed(1)}%
                </td>
                <td style={{ ...tdF, textAlign: 'right', fontWeight: 600, color: p.fxReturn > 0 ? '#22c55e' : '#ef4444' }}>
                  {p.fxReturn > 0 ? '+' : ''}{p.fxReturn.toFixed(1)}%
                  {p.fxReturn !== 0 && (
                    <span style={{ fontSize: 9, marginLeft: 2 }}>
                      {p.fxReturn > 0 ? '\u2191' : '\u2193'}
                    </span>
                  )}
                </td>
                <td style={{ ...tdF, textAlign: 'right', fontWeight: 700, color: p.totalReturn > 0 ? '#22c55e' : '#ef4444' }}>
                  {p.totalReturn > 0 ? '+' : ''}{p.totalReturn.toFixed(1)}%
                </td>
                <td style={{ ...tdF, textAlign: 'right' }}>{p.volatility.toFixed(1)}%</td>
                <td style={{ ...tdF, textAlign: 'right', fontWeight: 600, color: p.carry > 0 ? '#22c55e' : '#ef4444' }}>
                  {p.carry > 0 ? '+' : ''}{p.carry.toFixed(1)}%
                </td>
                <td style={{ ...tdF, textAlign: 'right', fontWeight: 700, color: p.var95 > 8 ? '#ef4444' : '#f59e0b' }}>
                  ${((p.exposure * p.var95 / 100) / 1e3).toFixed(0)}K
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hedge calculator — shown when a currency is selected */}
      {selectedPos && (
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
            {'\u{1FA84}'} Hedge Calculator: {selectedPos.flag} {selectedPos.currency}
          </div>

          {/* Hedge ratio slider */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
              <span>Hedge Ratio</span>
              <span style={{ fontWeight: 700, color: '#6366f1' }}>{hedgeTarget}%</span>
            </div>
            <input
              type="range"
              min={0} max={100} step={25}
              value={hedgeTarget}
              onChange={e => setHedgeTarget(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)' }}>
              <span>0% (Full exposure)</span>
              <span>100% (Fully hedged)</span>
            </div>
          </div>

          {/* Scenario cards */}
          {bestScenario && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, padding: 8, borderRadius: 6, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Annual Hedge Cost</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>${bestScenario.cost.toFixed(0)}</div>
              </div>
              <div style={{ flex: 1, padding: 8, borderRadius: 6, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Reduced VaR</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{bestScenario.reducedVar.toFixed(1)}%</div>
              </div>
              <div style={{ flex: 1, padding: 8, borderRadius: 6, background: 'var(--bg-input)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Net Exposure</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>${(bestScenario.netPosition / 1e3).toFixed(0)}K</div>
              </div>
            </div>
          )}

          {/* Quick hedge scenarios */}
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            {[0, 25, 50, 75, 100].map(r => {
              const s = scenarios.find(sc => sc.ratio === r)!;
              return (
                <button key={r} onClick={() => setHedgeTarget(r)} style={{
                  flex: 1, padding: '4px 8px', borderRadius: 4, border: hedgeTarget === r ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: hedgeTarget === r ? 'rgba(99,102,241,.12)' : 'var(--bg-card)',
                  fontSize: 10, cursor: 'pointer',
                }}>
                  <div style={{ fontWeight: 600 }}>{r}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>VaR {s.reducedVar.toFixed(1)}%</div>
                </button>
              );
            })}
          </div>

          {/* P&L decomposition */}
          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-input)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>P&L Decomposition</div>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, selectedPos.assetReturn / (Math.abs(selectedPos.assetReturn) + Math.abs(selectedPos.fxReturn)) * 100)}%`, background: '#22c55e' }} />
              <div style={{ width: `${Math.max(0, Math.abs(selectedPos.fxReturn) / (Math.abs(selectedPos.assetReturn) + Math.abs(selectedPos.fxReturn)) * 100)}%`, background: selectedPos.fxReturn > 0 ? '#22c55e' : '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 2 }}>
              <span>{'\u{1F7E2}'} Asset: {selectedPos.assetReturn > 0 ? '+' : ''}{selectedPos.assetReturn}%</span>
              <span>{selectedPos.fxReturn > 0 ? '\u{1F7E2}' : '\u{1F534}'} FX: {selectedPos.fxReturn > 0 ? '+' : ''}{selectedPos.fxReturn}%</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
        {'\u{1F4CC}'} Click a currency row to activate the hedge calculator. VaR based on 95% confidence, 1-day horizon, historical volatility.
      </div>
    </div>
  );
};

const thF: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdF: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default FxRiskCalculator;
