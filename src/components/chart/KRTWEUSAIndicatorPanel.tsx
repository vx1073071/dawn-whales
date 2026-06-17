/**
 * KRTWEUSAIndicatorPanel — R275 ML#2: 韩台欧沙指标面板 (Korea/Taiwan/EU/Saudi Indicators)
 *
 * 12 market-specific indicators:
 * - KR: KOSDAQ venture index, semiconductor exports, household debt, CDS
 * - TW: TAIEX futures OI, export orders, TWD NEER, margin debt
 * - EU: EU volatility, PMI composite, bund yield, EUR NEER
 * - SA: Tadawul energy weight, oil price sensitivity, foreign ownership, PIF activity
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface RegionalMetric {
  id: string;
  name: string;
  region: 'KR' | 'TW' | 'EU' | 'SA';
  flag: string;
  value: number;
  unit: string;
  prevValue: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const METRICS: RegionalMetric[] = [
  // ── Korea ──
  { id: 'kosdaq_venture', name: 'KOSDAQ Venture Index', region: 'KR', flag: '\u{1F1F0}\u{1F1F7}', value: 892, unit: '', prevValue: 865,
    signal: 'bullish', description: 'KOSDAQ (Korean Nasdaq) rallying — retail risk appetite surging. Above 900 = euphoria territory' },
  { id: 'semi_exports', name: 'Semiconductor Exports (YoY)', region: 'KR', flag: '\u{1F1F0}\u{1F1F7}', value: 28.5, unit: '%', prevValue: 22.1,
    signal: 'bullish', description: 'Chip exports surging +28.5% — AI boom driving HBM demand. Samsung + SK hynix main beneficiaries' },
  { id: 'household_debt', name: 'Household Debt / GDP', region: 'KR', flag: '\u{1F1F0}\u{1F1F7}', value: 98.5, unit: '%', prevValue: 99.2,
    signal: 'neutral', description: 'Household deleveraging slowly — still very high. Consumer spending constrained by debt burden' },

  // ── Taiwan ──
  { id: 'taiex_oi', name: 'TAIEX Futures OI', region: 'TW', flag: '\u{1F1F9}\u{1F1FC}', value: 85.2, unit: 'K lots', prevValue: 78.5,
    signal: 'bullish', description: 'Futures open interest rising — more hedging and speculation. OI spike before large moves' },
  { id: 'export_orders', name: 'Export Orders (YoY)', region: 'TW', flag: '\u{1F1F9}\u{1F1FC}', value: 12.5, unit: '%', prevValue: 8.2,
    signal: 'bullish', description: 'Export orders accelerating — AI supply chain (TSMC, Foxconn) driving the economy' },
  { id: 'twd_neer', name: 'TWD Nominal Effective Rate', region: 'TW', flag: '\u{1F1F9}\u{1F1FC}', value: 98.5, unit: '', prevValue: 97.2,
    signal: 'neutral', description: 'TWD slightly stronger — good for importers, headwind for exporters. Central bank managing carefully' },

  // ── Europe ──
  { id: 'vstoxx', name: 'EURO STOXX 50 Volatility', region: 'EU', flag: '\u{1F1EA}\u{1F1FA}', value: 16.8, unit: '%', prevValue: 19.5,
    signal: 'bullish', description: 'EU vol declining — ECB rate cuts priced in. Political risk premium fading post-elections' },
  { id: 'pmi_composite', name: 'PMI Composite', region: 'EU', flag: '\u{1F1EA}\u{1F1FA}', value: 51.2, unit: '', prevValue: 50.1,
    signal: 'bullish', description: 'PMI back above 50 (expansion) after months in contraction. Manufacturing still weak but services leading' },
  { id: 'bund_yield', name: 'Bund 10Y Yield', region: 'EU', flag: '\u{1F1EA}\u{1F1FA}', value: 2.45, unit: '%', prevValue: 2.65,
    signal: 'bullish', description: 'Bund yield falling — markets pricing ECB cuts. Lower yields = higher equity valuations' },

  // ── Saudi Arabia ──
  { id: 'tadawul_energy', name: 'Tadawul Energy Weight', region: 'SA', flag: '\u{1F1F8}\u{1F1E6}', value: 68.5, unit: '%', prevValue: 70.2,
    signal: 'neutral', description: 'Energy still dominates Tadawul — but diversification happening (Vision 2030). Lower oil = more urgency' },
  { id: 'oil_sensitivity', name: 'Oil Price Beta', region: 'SA', flag: '\u{1F1F8}\u{1F1E6}', value: 0.65, unit: '', prevValue: 0.72,
    signal: 'bullish', description: 'Tadawul oil sensitivity declining — market decoupling from crude. Non-oil sectors growing' },
  { id: 'foreign_ownership', name: 'Foreign Ownership %', region: 'SA', flag: '\u{1F1F8}\u{1F1E6}', value: 15.8, unit: '%', prevValue: 14.5,
    signal: 'bullish', description: 'Foreign ownership rising — MSCI EM inclusion + Vision 2030 attracting global capital. Target: 20%' },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
const REGION_CONFIG: Record<string, { color: string; name: string; flag: string }> = {
  KR: { color: '#ef4444', name: '\u{1F1F0}\u{1F1F7} Korea', flag: '\u{1F1F0}\u{1F1F7}' },
  TW: { color: '#f97316', name: '\u{1F1F9}\u{1F1FC} Taiwan', flag: '\u{1F1F9}\u{1F1FC}' },
  EU: { color: '#3b82f6', name: '\u{1F1EA}\u{1F1FA} Europe', flag: '\u{1F1EA}\u{1F1FA}' },
  SA: { color: '#22c55e', name: '\u{1F1F8}\u{1F1E6} Saudi', flag: '\u{1F1F8}\u{1F1E6}' },
};

function RegionBadge({ region }: { region: 'KR' | 'TW' | 'EU' | 'SA' }) {
  const c = REGION_CONFIG[region];
  return <span style={{ padding: '2px 8px', borderRadius: 4, background: `${c.color}15`, color: c.color, fontSize: 10, fontWeight: 600 }}>{c.name}</span>;
}

function SignalPill({ signal }: { signal: RegionalMetric['signal'] }) {
  const c = { bullish: { bg: 'rgba(34,197,94,.12)', fg: '#22c55e', label: '\u25B2 Bullish' },
    bearish: { bg: 'rgba(239,68,68,.12)', fg: '#ef4444', label: '\u25BC Bearish' },
    neutral: { bg: 'rgba(156,163,175,.12)', fg: '#9ca3af', label: '\u25C6 Neutral' } };
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: c[signal].bg, color: c[signal].fg, fontSize: 9, fontWeight: 600 }}>{c[signal].label}</span>;
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const KRTWEUSAIndicatorPanel: React.FC = () => {
  const [region, setRegion] = useState<'all' | 'KR' | 'TW' | 'EU' | 'SA'>('all');
  const filtered = region === 'all' ? METRICS : METRICS.filter(m => m.region === region);

  const regions = ['KR', 'TW', 'EU', 'SA'];

  const regionScores = regions.map(r => {
    const ms = METRICS.filter(m => m.region === r);
    const bull = ms.filter(m => m.signal === 'bullish').length;
    const bear = ms.filter(m => m.signal === 'bearish').length;
    return { region: r, bull, bear, total: ms.length };
  });

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F30D}'} KR/TW/EU/SA Indicators</h3>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['all', 'KR', 'TW', 'EU', 'SA'] as const).map(r => (
            <button key={r} onClick={() => setRegion(r)} style={{
              padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: region === r ? 'var(--accent)' : 'transparent',
              color: region === r ? '#fff' : 'var(--text)', fontSize: 11, cursor: 'pointer', fontWeight: region === r ? 700 : 500,
            }}>{r === 'all' ? 'All' : r === 'KR' ? '\u{1F1F0}\u{1F1F7}' : r === 'TW' ? '\u{1F1F9}\u{1F1FC}' : r === 'EU' ? '\u{1F1EA}\u{1F1FA}' : '\u{1F1F8}\u{1F1E6}'} {r}</button>
          ))}
        </div>
      </div>

      {/* Region score grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 14 }}>
        {regionScores.map(rs => {
          const cfg = REGION_CONFIG[rs.region];
          const bullPct = rs.bull / rs.total * 100;
          return (
            <div key={rs.region} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{cfg.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${bullPct}%`, height: '100%', background: '#22c55e' }} />
                  <div style={{ width: `${(rs.total - rs.bull - rs.bear) / rs.total * 100}%`, height: '100%', background: '#9ca3af' }} />
                  <div style={{ width: `${rs.bear / rs.total * 100}%`, height: '100%', background: '#ef4444' }} />
                </div>
              </div>
              <div style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#22c55e' }}>{'\u25B2'} {rs.bull}</span>
                <span style={{ color: '#ef4444' }}>{rs.bear} {'\u25BC'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metrics list */}
      {filtered.map(m => {
        const cfg = REGION_CONFIG[m.region];
        const change = ((m.value - m.prevValue) / Math.abs(m.prevValue || 1)) * 100;
        return (
          <div key={m.id} style={{
            padding: '8px 10px', marginBottom: 4, borderRadius: 6, background: 'var(--bg-card)', border: `1px solid var(--border)`,
            borderLeft: `3px solid ${cfg.color}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <RegionBadge region={m.region} />
                  <SignalPill signal={m.signal} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{m.description}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 100, marginLeft: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {m.unit === '%' ? m.value.toFixed(1) : m.value.toLocaleString()}{m.unit}
                </div>
                <div style={{ fontSize: 10, color: change > 0 ? '#22c55e' : change < 0 ? '#ef4444' : 'var(--text-dim)' }}>
                  {change > 0 ? '\u25B2' : change < 0 ? '\u25BC' : '\u25C6'} {Math.abs(change).toFixed(1)}% vs prev
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
        {'\u{1F4CC}'} KR/TW = tech export proxies | EU = rate-cut play + political stabilization | SA = oil decoupling + Vision 2030 diversification
      </div>
    </div>
  );
};

export default KRTWEUSAIndicatorPanel;
