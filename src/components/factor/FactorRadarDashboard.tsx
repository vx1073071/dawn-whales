/**
 * FactorRadarDashboard — R277 ML#2: 因子雷达图+信号灯 (Factor Radar Chart + Signal Lights)
 *
 * Multi-dimensional factor visualization:
 * - Radar/spider chart for single stock factor profile
 * - Multi-factor signal light grid (traffic light system)
 * - Factor correlation mini-matrix
 * - Portfolio factor exposure radar
 * - Market regime indicator
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface FactorDimension {
  axis: string;
  label: string;
  value: number;       // 0-100 normalized
  rawValue: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  weight: number;
}

interface SignalLight {
  id: string;
  label: string;
  market: string;
  flag: string;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
  value: number;
  description: string;
  since: string;
}

interface RegimeIndicator {
  name: string;
  value: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  description: string;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_FACTOR_DIMS: FactorDimension[] = [
  { axis: 'value', label: 'Value', value: 65, rawValue: 0.12, signal: 'BULLISH', weight: 20 },
  { axis: 'growth', label: 'Growth', value: 45, rawValue: 0.05, signal: 'NEUTRAL', weight: 20 },
  { axis: 'quality', label: 'Quality', value: 72, rawValue: 0.18, signal: 'BULLISH', weight: 15 },
  { axis: 'momentum', label: 'Momentum', value: 55, rawValue: 0.08, signal: 'BULLISH', weight: 15 },
  { axis: 'size', label: 'Size', value: 40, rawValue: -0.03, signal: 'NEUTRAL', weight: 10 },
  { axis: 'volatility', label: 'Volatility', value: 35, rawValue: -0.06, signal: 'BEARISH', weight: 10 },
  { axis: 'liquidity', label: 'Liquidity', value: 60, rawValue: 0.10, signal: 'BULLISH', weight: 5 },
  { axis: 'sentiment', label: 'Sentiment', value: 68, rawValue: 0.15, signal: 'BULLISH', weight: 5 },
];

const MOCK_SIGNAL_LIGHTS: SignalLight[] = [
  { id: 'us_value', label: 'US Value', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', status: 'GREEN', value: 0.12, description: 'PE below 5Y avg, PB cheap', since: '2 weeks' },
  { id: 'us_momentum', label: 'US Momentum', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', status: 'YELLOW', value: 0.05, description: 'Momentum weakening', since: '3 days' },
  { id: 'us_sentiment', label: 'US Sentiment', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', status: 'GREEN', value: 0.15, description: 'Bullish retail + insider buying', since: '1 week' },
  { id: 'jp_value', label: 'JP Value', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', status: 'GREEN', value: 0.18, description: 'PBR reform driving re-rating', since: '2 months' },
  { id: 'jp_quality', label: 'JP Quality', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', status: 'GREEN', value: 0.14, description: 'TSE corporate governance push', since: '1 month' },
  { id: 'hk_value', label: 'HK Value', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', status: 'GREEN', value: 0.22, description: 'Deep value — AH discount', since: '3 months' },
  { id: 'hk_momentum', label: 'HK Momentum', market: 'HK', flag: '\u{1F1ED}\u{1F1F0}', status: 'YELLOW', value: 0.02, description: 'Barely positive momentum', since: '1 week' },
  { id: 'cn_sentiment', label: 'CN Sentiment', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', status: 'YELLOW', value: 0.01, description: 'Mixed — policy support vs growth fear', since: '5 days' },
  { id: 'cn_liquidity', label: 'CN Liquidity', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', status: 'GREEN', value: 0.13, description: 'PBOC injecting, SHIBOR falling', since: '1 month' },
  { id: 'in_growth', label: 'IN Growth', market: 'IN', flag: '\u{1F1EE}\u{1F1F3}', status: 'GREEN', value: 0.20, description: 'GDP 7%+, GST record high', since: '6 months' },
  { id: 'br_value', label: 'BR Value', market: 'BR', flag: '\u{1F1E7}\u{1F1F7}', status: 'GREEN', value: 0.16, description: 'Rate cut cycle starting', since: '1 month' },
  { id: 'eu_vol', label: 'EU Volatility', market: 'EU', flag: '\u{1F1EA}\u{1F1FA}', status: 'RED', value: -0.08, description: 'Political uncertainty elevated', since: '2 weeks' },
  { id: 'kr_tech', label: 'KR Tech', market: 'KR', flag: '\u{1F1F0}\u{1F1F7}', status: 'GREEN', value: 0.21, description: 'AI chip boom + HBM demand', since: '3 months' },
  { id: 'tw_tech', label: 'TW Tech', market: 'TW', flag: '\u{1F1F9}\u{1F1FC}', status: 'GREEN', value: 0.19, description: 'TSMC leading AI supply chain', since: '3 months' },
  { id: 'sa_energy', label: 'SA Energy', market: 'SA', flag: '\u{1F1F8}\u{1F1E6}', status: 'YELLOW', value: 0.03, description: 'Oil price volatile, diversification', since: '1 week' },
  { id: 'crypto_sentiment', label: 'Crypto Sentiment', market: 'CRYPTO', flag: '\u{20BF}', status: 'GREEN', value: 0.25, description: 'Bull market phase, ETF inflows', since: '4 months' },
];

const MOCK_REGIME: RegimeIndicator[] = [
  { name: 'Risk-On/Off', value: 72, status: 'GREEN', description: 'VIX < 20, credit spreads tightening, global equities rising' },
  { name: 'Value vs Growth', value: 65, status: 'GREEN', description: 'Value outperforming. Rate sensitivity + rotation from tech' },
  { name: 'USD Direction', value: 45, status: 'YELLOW', description: 'USD weakening slightly. EM/commodity positive' },
  { name: 'Rate Regime', value: 55, status: 'YELLOW', description: 'Central banks cutting. Dovish but data-dependent' },
  { name: 'Commodity Cycle', value: 68, status: 'GREEN', description: 'Gold ATH, copper strong. Reflation trade' },
  { name: 'Volatility Regime', value: 35, status: 'GREEN', description: 'Low vol. Complacency risk but trend-following works' },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function SignalBulb({ status, size }: { status: string; size?: number }) {
  const s = size || 12;
  const colors: Record<string, string> = {
    GREEN: '#22c55e', YELLOW: '#f59e0b', RED: '#ef4444', GRAY: '#6b7280',
  };
  return (
    <div style={{
      width: s, height: s, borderRadius: '50%', background: colors[status] || '#6b7280',
      boxShadow: `0 0 ${s/2}px ${colors[status] || '#6b7280'}66`,
    }} />
  );
}

function RadarSVG({ dimensions, size }: { dimensions: FactorDimension[]; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const n = dimensions.length;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getPoint = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(angle - Math.PI / 2),
    y: cy + radius * Math.sin(angle - Math.PI / 2),
  });

  const dataPoints = dimensions.map((d, i) => {
    const angle = (2 * Math.PI * i) / n;
    return getPoint(angle, r * (d.value / 100));
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* Grid levels */}
      {levels.map(lvl => {
        const pts = dimensions.map((_, i) => {
          const angle = (2 * Math.PI * i) / n;
          const p = getPoint(angle, r * lvl);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }).join(' ');
        return <polygon key={lvl} points={pts} fill="none" stroke="var(--border)" strokeWidth={0.5} />;
      })}

      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const angle = (2 * Math.PI * i) / n;
        const outer = getPoint(angle, r * 1.05);
        return <line key={`axis-${i}`} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--border)" strokeWidth={0.5} />;
      })}

      {/* Data polygon */}
      <polygon points={dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={2} />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} fill="#6366f1" stroke="#fff" strokeWidth={1} />
      ))}

      {/* Labels */}
      {dimensions.map((d, i) => {
        const angle = (2 * Math.PI * i) / n;
        const label = getPoint(angle, r * 1.18);
        const color = d.signal === 'BULLISH' ? '#22c55e' : d.signal === 'BEARISH' ? '#ef4444' : '#9ca3af';
        return (
          <text key={`label-${i}`} x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontWeight={600} fill={color}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function RegimeBar({ indicator }: { indicator: RegimeIndicator }) {
  const colors = { GREEN: '#22c55e', YELLOW: '#f59e0b', RED: '#ef4444' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <div style={{ minWidth: 100, fontSize: 11, fontWeight: 600 }}>{indicator.name}</div>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{ width: `${indicator.value}%`, height: '100%', borderRadius: 4, background: colors[indicator.status], transition: 'width .5s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: colors[indicator.status], minWidth: 24, textAlign: 'right' }}>{indicator.value}</span>
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const FactorRadarDashboard: React.FC = () => {
  const [tab, setTab] = useState<'radar' | 'lights' | 'regime'>('radar');
  const [filterMarket, setFilterMarket] = useState<string | null>(null);

  const filteredLights = useMemo(() => {
    let sl = MOCK_SIGNAL_LIGHTS;
    if (filterMarket) sl = sl.filter(s => s.market === filterMarket);
    return sl;
  }, [filterMarket]);

  const greenCount = MOCK_SIGNAL_LIGHTS.filter(s => s.status === 'GREEN').length;
  const yellowCount = MOCK_SIGNAL_LIGHTS.filter(s => s.status === 'YELLOW').length;
  const redCount = MOCK_SIGNAL_LIGHTS.filter(s => s.status === 'RED').length;
  const overallScore = Math.round((greenCount / MOCK_SIGNAL_LIGHTS.length) * 100);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F3AF}'} Factor Radar & Signals</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['radar', 'lights', 'regime'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
              {t === 'radar' ? '\u{1F4CA} Radar' : t === 'lights' ? '\u{1F6A6} Signals' : '\u{1F30D} Regime'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'radar' ? (
        <>
          {/* Overall score */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Factor Score</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: overallScore > 60 ? '#22c55e' : overallScore > 40 ? '#f59e0b' : '#ef4444' }}>
              {(MOCK_FACTOR_DIMS.reduce((s, d) => s + d.value * d.weight, 0) / MOCK_FACTOR_DIMS.reduce((s, d) => s + d.weight, 0)).toFixed(0)}/100
            </div>
          </div>

          {/* Radar chart */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <RadarSVG dimensions={MOCK_FACTOR_DIMS} size={300} />
          </div>

          {/* Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {MOCK_FACTOR_DIMS.map(d => (
              <div key={d.axis} style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{d.label}</span>
                  <SignalBulb status={d.signal} size={10} />
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${d.value}%`, height: '100%', background: d.signal === 'BULLISH' ? '#22c55e' : d.signal === 'BEARISH' ? '#ef4444' : '#f59e0b', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{d.value}/100</span>
                  <span>Wt: {d.weight}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : tab === 'lights' ? (
        <>
          {/* Signal summary bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{'\u{1F7E2}'} Green</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{greenCount}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{'\u{1F7E1}'} Yellow</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{yellowCount}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{'\u{1F534}'} Red</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{redCount}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Score</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: overallScore > 60 ? '#22c55e' : '#f59e0b' }}>{overallScore}%</div>
            </div>
          </div>

          {/* Market filter */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterMarket(null)} style={chipS(!filterMarket)}>All</button>
            {['US', 'JP', 'HK', 'CN', 'IN', 'BR', 'EU', 'KR', 'TW', 'SA', 'CRYPTO'].map(m => (
              <button key={m} onClick={() => setFilterMarket(m)} style={chipS(filterMarket === m)}>
                {m}
              </button>
            ))}
          </div>

          {/* Signal lights grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
            {filteredLights.map(sl => (
              <div key={sl.id} style={{
                padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <SignalBulb status={sl.status} size={14} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>{sl.flag}</span>
                    <span style={{ fontWeight: 700, fontSize: 11 }}>{sl.label}</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{sl.description}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sl.value > 0.1 ? '#22c55e' : sl.value > 0 ? '#f59e0b' : '#ef4444' }}>
                    {(sl.value * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{sl.since}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Regime dashboard */
        <>
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>{'\u{1F3AF}'} Market Regime Dashboard</div>
            {MOCK_REGIME.map(r => <RegimeBar key={r.name} indicator={r} />)}
          </div>

          {/* Regime interpretation */}
          <div style={{ padding: 10, borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#6366f1' }}>{'\u{1F4A1}'} Regime Interpretation</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
              <strong>Current:</strong> Risk-On + Value Rotation + Commodity Bull. This regime favors <strong>Value factors</strong> (PE, PB, Dividend), <strong>Commodity-linked markets</strong> (BR, SA, AU), and <strong>Commodity currencies</strong> (AUD, BRL). Momentum factors work but watch for inflection. Growth factors underperform in rising rate environments — but AI may be an exception.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const chipS = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 4, border: active ? '1px solid var(--accent)' : '1px solid transparent',
  background: active ? 'rgba(99,102,241,.10)' : 'var(--bg-input)',
  color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: active ? 600 : 400,
});

export default FactorRadarDashboard;
