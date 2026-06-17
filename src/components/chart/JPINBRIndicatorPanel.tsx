/**
 * JPINBRIndicatorPanel — R275 ML#1: 日印巴指标面板 (Japan/India/Brazil Indicators)
 *
 * 13 market-specific indicators:
 * - JP: Nikkei volatility, BOJ ETF buying, TOPIX PBR, JPY real effective rate, margin debt
 * - IN: India VIX, Nifty PE, FPI flow, rupee reserve, GST collection
 * - BR: Brazil risk, IPCA inflation, Selic rate, foreign flow, commodity index
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface CountryMetric {
  id: string;
  name: string;
  country: 'JP' | 'IN' | 'BR';
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
const METRICS: CountryMetric[] = [
  // ── Japan ──
  { id: 'nikkei_vol', name: 'Nikkei 225 Volatility', country: 'JP', flag: '\u{1F1EF}\u{1F1F5}', value: 18.5, unit: '%', prevValue: 22.0,
    signal: 'bullish', description: 'Nikkei vol declining — BOJ ETF buying calming the market. Below 15 = complacency risk' },
  { id: 'boj_etf', name: 'BOJ ETF Purchases (Monthly)', country: 'JP', flag: '\u{1F1EF}\u{1F1F5}', value: 850, unit: 'B JPY', prevValue: 1200,
    signal: 'neutral', description: 'BOJ tapering ETF buying — from 1.2T to 850B/month. Reduced backstop but still supportive' },
  { id: 'topix_pbr', name: 'TOPIX PBR', country: 'JP', flag: '\u{1F1EF}\u{1F1F5}', value: 1.45, unit: 'x', prevValue: 1.38,
    signal: 'bullish', description: 'PBR rising above 1.4x — TSE reform pushing companies above book value. Target: 1.5x' },
  { id: 'jpy_reer', name: 'JPY Real Effective Rate', country: 'JP', flag: '\u{1F1EF}\u{1F1F5}', value: 72.5, unit: '', prevValue: 70.2,
    signal: 'bullish', description: 'Yen strengthening in real terms — good for importers, headwind for exporters (Toyota, Sony)' },
  { id: 'margin_debt', name: 'Margin Debt Outstanding', country: 'JP', flag: '\u{1F1EF}\u{1F1F5}', value: 5.2, unit: 'T JPY', prevValue: 4.8,
    signal: 'bearish', description: 'Margin debt rising above 5T — approaching 2023 peak. Excessive leverage = correction risk' },

  // ── India ──
  { id: 'nifty_pe', name: 'Nifty 50 PE Ratio', country: 'IN', flag: '\u{1F1EE}\u{1F1F3}', value: 22.8, unit: 'x', prevValue: 21.5,
    signal: 'bearish', description: 'PE above 22x — expensive by historical standards (avg 18x). Earnings need to catch up' },
  { id: 'fpi_flow', name: 'FPI Net Flow (Monthly)', country: 'IN', flag: '\u{1F1EE}\u{1F1F3}', value: 2.8, unit: 'B USD', prevValue: -1.2,
    signal: 'bullish', description: 'Foreign portfolio investors returning — 2.8B net buy after months of selling. Strong bullish signal' },
  { id: 'inr_reserves', name: 'Forex Reserves', country: 'IN', flag: '\u{1F1EE}\u{1F1F3}', value: 645, unit: 'B USD', prevValue: 638,
    signal: 'bullish', description: 'Record high reserves — RBI has ample ammunition to defend INR. Import cover >11 months' },
  { id: 'gst_collection', name: 'GST Collection', country: 'IN', flag: '\u{1F1EE}\u{1F1F3}', value: 1.85, unit: 'T INR', prevValue: 1.78,
    signal: 'bullish', description: 'GST at all-time high — consumption booming. Direct proxy for economic activity' },

  // ── Brazil ──
  { id: 'ipca', name: 'IPCA Inflation (YoY)', country: 'BR', flag: '\u{1F1E7}\u{1F1F7}', value: 4.5, unit: '%', prevValue: 4.8,
    signal: 'bullish', description: 'Inflation easing toward target (3% +/- 1.5pp). Room for rate cuts if trend continues' },
  { id: 'selic', name: 'SELIC Rate', country: 'BR', flag: '\u{1F1E7}\u{1F1F7}', value: 10.5, unit: '%', prevValue: 10.75,
    signal: 'bullish', description: 'BCB started cutting cycle. Lower rates = higher equity valuations, especially financials' },
  { id: 'foreign_flow', name: 'Foreign Flow B3', country: 'BR', flag: '\u{1F1E7}\u{1F1F7}', value: 1.2, unit: 'B BRL', prevValue: -2.5,
    signal: 'bullish', description: 'Foreigners returning to B3 after prolonged outflow. Commodity cycle + rate cuts attracting capital' },
  { id: 'commodity_index', name: 'CRB Commodity Index', country: 'BR', flag: '\u{1F1E7}\u{1F1F7}', value: 385, unit: '', prevValue: 370,
    signal: 'bullish', description: 'Commodities rising — Brazil is a commodity exporter (Vale, Petrobras). Higher CRB = stronger BRL + equity' },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
const COLOR_MAP: Record<string, string> = { JP: '#ef4444', IN: '#f97316', BR: '#22c55e' };
const NAME_MAP: Record<string, string> = { JP: '\u{1F1EF}\u{1F1F5} Japan', IN: '\u{1F1EE}\u{1F1F3} India', BR: '\u{1F1E7}\u{1F1F7} Brazil' };

function CountryBadge({ country }: { country: 'JP' | 'IN' | 'BR' }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: `${COLOR_MAP[country]}15`, color: COLOR_MAP[country],
    }}>{NAME_MAP[country]}</span>
  );
}

function SignalDot({ signal }: { signal: CountryMetric['signal'] }) {
  const c = { bullish: '#22c55e', bearish: '#ef4444', neutral: '#9ca3af' };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c[signal], marginRight: 6 }} />;
}

function ChangeIndicator({ value, prev }: { value: number; prev: number }) {
  const diff = value - prev;
  const pctChange = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
  const isUp = diff > 0;
  return (
    <span style={{ fontSize: 10, marginLeft: 6, color: isUp ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-dim)' }}>
      {isUp ? '\u25B2' : diff < 0 ? '\u25BC' : '\u25C6'} {Math.abs(pctChange).toFixed(1)}%
    </span>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const JPINBRIndicatorPanel: React.FC = () => {
  const [country, setCountry] = useState<'all' | 'JP' | 'IN' | 'BR'>('all');
  const filtered = country === 'all' ? METRICS : METRICS.filter(m => m.country === country);

  // Sentiment scores
  const scores = ['JP', 'IN', 'BR'].map(c => {
    const ms = METRICS.filter(m => m.country === c);
    const bull = ms.filter(m => m.signal === 'bullish').length;
    const bear = ms.filter(m => m.signal === 'bearish').length;
    const score = ((bull - bear) / ms.length) * 50 + 50;
    return { country: c, score, bull, bear, total: ms.length };
  });

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F30F}'} JP/IN/BR Market Indicators</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'JP', 'IN', 'BR'] as const).map(c => (
            <button key={c} onClick={() => setCountry(c)} style={{
              padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: country === c ? 'var(--accent)' : 'transparent',
              color: country === c ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: country === c ? 700 : 500,
            }}>{c === 'all' ? 'All' : NAME_MAP[c]}</button>
          ))}
        </div>
      </div>

      {/* Sentiment gauge row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {scores.map(s => (
          <div key={s.country} style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{NAME_MAP[s.country]}</div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{
                width: `${s.score}%`, height: '100%', borderRadius: 3,
                background: s.score > 60 ? '#22c55e' : s.score > 40 ? '#f59e0b' : '#ef4444',
                transition: 'width .5s',
              }} />
            </div>
            <div style={{ fontSize: 10 }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{s.bull}</span>
              <span style={{ color: 'var(--text-dim)' }}> / </span>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{s.bear}</span>
              <span style={{ color: 'var(--text-dim)' }}> (score: {s.score.toFixed(0)})</span>
            </div>
          </div>
        ))}
      </div>

      {/* Metrics list */}
      {filtered.map(m => (
        <div key={m.id} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CountryBadge country={m.country} />
                <SignalDot signal={m.signal} />
                <span style={{ fontWeight: 600, fontSize: 11 }}>{m.name}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, marginLeft: 22 }}>
                {m.description}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 100 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {m.value}{m.unit}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                Prev: {m.prevValue}{m.unit}
                <ChangeIndicator value={m.value} prev={m.prevValue} />
              </div>
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
        {'\u{1F4CC}'} JP: BOJ policy + yen = key drivers | IN: FPI flow + consumption = bull market fuel | BR: Rate cycle + commodities = value play
      </div>
    </div>
  );
};

export default JPINBRIndicatorPanel;
