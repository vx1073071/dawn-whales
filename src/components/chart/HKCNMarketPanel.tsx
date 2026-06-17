/**
 * HKCNMarketPanel — R274 ML#5: 港股/A股指标集成面板
 *
 * 12 cross-market indicators (6 HK + 6 CN):
 * - HK: ADR premium, HSI volatility, turnover ratio, short sell%, AH premium, HKD peg stress
 * - CN: CSI margin balance, new accounts, IPO count, repo rate, SHIBOR, CNY fixing
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface MarketMetric {
  id: string;
  name: string;
  market: 'HK' | 'CN';
  value: number;
  unit: string;
  change: number;
  changeUnit: string;
  signal: 'bullish' | 'bearish' | 'neutral' | 'extreme';
  description: string;
  history: number[];  // last 7 values
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_METRICS: MarketMetric[] = [
  // ── HK Indicators ──
  { id: 'adr_premium', name: 'ADR Premium Index', market: 'HK', value: 0.8, unit: '%', change: -0.3, changeUnit: 'pp',
    signal: 'bullish', description: 'HK-listed stocks trading at discount to US ADRs — bullish for HK (catch-up trade)',
    history: [1.2, 0.9, 1.1, 0.8, 1.0, 1.1, 0.8] },
  { id: 'hsi_vol', name: 'HSI 30D Volatility', market: 'HK', value: 22.5, unit: '%', change: -5.2, changeUnit: 'pp',
    signal: 'bullish', description: 'Volatility declining — market calming, typical of pre-rally consolidation',
    history: [28, 26, 25, 27, 24, 23, 22.5] },
  { id: 'turnover_ratio', name: 'Main Board Turnover', market: 'HK', value: 128.5, unit: 'B HKD', change: 15.2, changeUnit: 'B',
    signal: 'bullish', description: 'Turnover rising — more money flowing in, retail + institutional participation up',
    history: [105, 108, 112, 115, 118, 122, 128.5] },
  { id: 'short_sell_pct', name: 'Short Sell %', market: 'HK', value: 18.2, unit: '%', change: 1.5, changeUnit: 'pp',
    signal: 'bearish', description: 'Short selling increasing — bears getting more aggressive. Above 20% = squeeze candidate',
    history: [15, 16, 17, 16.5, 17.5, 17, 18.2] },
  { id: 'ah_premium', name: 'AH Premium Index', market: 'HK', value: 142, unit: '', change: -8, changeUnit: '',
    signal: 'neutral', description: 'A-shares 42% more expensive than H-shares. Below 120 = HK catching up, above 150 = A-share bubble',
    history: [148, 150, 145, 147, 150, 150, 142] },
  { id: 'hkd_peg', name: 'HKD Peg Stress', market: 'HK', value: 7.8495, unit: '', change: -0.0005, changeUnit: '',
    signal: 'neutral', description: 'Approaching weak-side convertibility undertaking (7.85). Peg defense may drain liquidity',
    history: [7.8498, 7.85, 7.8499, 7.85, 7.85, 7.85, 7.8495] },

  // ── CN A-share Indicators ──
  { id: 'margin_balance', name: 'Margin Balance', market: 'CN', value: 1.85, unit: 'T CNY', change: 0.12, changeUnit: 'T',
    signal: 'bullish', description: 'Margin debt rising — retail investors borrowing to buy. Above 2T = overheated',
    history: [1.65, 1.68, 1.72, 1.75, 1.78, 1.82, 1.85] },
  { id: 'new_accounts', name: 'New A-share Accounts', market: 'CN', value: 285, unit: 'K/week', change: 45, changeUnit: 'K',
    signal: 'bullish', description: 'New account openings surging — retail FOMO indicator. Above 300K = peak euphoria',
    history: [180, 195, 210, 220, 240, 260, 285] },
  { id: 'ipo_count', name: 'IPO Filings', market: 'CN', value: 12, unit: '/month', change: -8, changeUnit: '',
    signal: 'bullish', description: 'IPO pace slowing — regulator reducing supply to support market. Bullish for existing stocks',
    history: [25, 22, 20, 18, 15, 14, 12] },
  { id: 'shibor_overnight', name: 'SHIBOR Overnight', market: 'CN', value: 1.85, unit: '%', change: -0.15, changeUnit: 'pp',
    signal: 'bullish', description: 'Interbank rates falling — PBOC injecting liquidity. Loose monetary = bullish stocks',
    history: [2.1, 2.05, 2.0, 1.95, 1.9, 1.9, 1.85] },
  { id: 'repo_7d', name: '7D Reverse Repo Rate', market: 'CN', value: 1.8, unit: '%', change: 0, changeUnit: 'pp',
    signal: 'neutral', description: 'PBOC policy rate unchanged. Market pricing in no immediate cut',
    history: [1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8] },
  { id: 'cny_fixing', name: 'CNY Central Parity', market: 'CN', value: 7.18, unit: '', change: -0.05, changeUnit: '',
    signal: 'bullish', description: 'PBOC setting CNY stronger — signal of stability confidence. Weaker fixing (above 7.25) = concern',
    history: [7.25, 7.23, 7.22, 7.20, 7.19, 7.20, 7.18] },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function SignalBadge({ signal }: { signal: MarketMetric['signal'] }) {
  const c = {
    bullish: { bg: 'rgba(34,197,94,.15)', fg: '#22c55e', label: '\u{1F7E2} Bullish' },
    bearish: { bg: 'rgba(239,68,68,.15)', fg: '#ef4444', label: '\u{1F534} Bearish' },
    neutral: { bg: 'rgba(156,163,175,.15)', fg: '#9ca3af', label: '\u{26AA} Neutral' },
    extreme: { bg: 'rgba(239,68,68,.25)', fg: '#ef4444', label: '\u{203C} Extreme' },
  }[signal];
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 600 }}>{c.label}</span>;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 80},${100 - ((v - min) / range) * 30}`).join(' ');
  return (
    <svg viewBox="0 -5 80 40" width={80} height={28} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * 80} cy={100 - ((data[data.length - 1] - min) / range) * 30} r={3} fill={color} />
    </svg>
  );
}

function MetricBar({ value, history, color }: { value: number; history: number[]; color: string }) {
  const min = Math.min(...history);
  const max = Math.max(...history, value);
  const range = max - min || 1;
  const pct = ((value - min) / range) * 100;
  return (
    <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .5s' }} />
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const HKCNMarketPanel: React.FC = () => {
  const [market, setMarket] = useState<'all' | 'HK' | 'CN'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = market === 'all' ? MOCK_METRICS : MOCK_METRICS.filter(m => m.market === market);

  const hkBullish = MOCK_METRICS.filter(m => m.market === 'HK' && m.signal === 'bullish').length;
  const hkTotal = MOCK_METRICS.filter(m => m.market === 'HK').length;
  const cnBullish = MOCK_METRICS.filter(m => m.market === 'CN' && m.signal === 'bullish').length;
  const cnTotal = MOCK_METRICS.filter(m => m.market === 'CN').length;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F1ED}\u{1F1F0}'}{'\u{1F1E8}\u{1F1F3}'} HK/CN Market Dashboard</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'HK', 'CN'] as const).map(m => (
            <button key={m} onClick={() => setMarket(m)} style={{
              padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: market === m ? 'var(--accent)' : 'transparent',
              color: market === m ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: market === m ? 700 : 500,
            }}>{m === 'all' ? 'All' : m === 'HK' ? '\u{1F1ED}\u{1F1F0} HK' : '\u{1F1E8}\u{1F1F3} CN'}</button>
          ))}
        </div>
      </div>

      {/* Sentiment summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: hkBullish / hkTotal > 0.5 ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{'\u{1F1ED}\u{1F1F0}'} HK Sentiment</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: hkBullish / hkTotal > 0.5 ? '#22c55e' : '#ef4444' }}>
            {hkBullish}/{hkTotal} Bullish
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{(hkBullish / hkTotal * 100).toFixed(0)}% positive</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: cnBullish / cnTotal > 0.5 ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{'\u{1F1E8}\u{1F1F3}'} CN Sentiment</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: cnBullish / cnTotal > 0.5 ? '#22c55e' : '#ef4444' }}>
            {cnBullish}/{cnTotal} Bullish
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{(cnBullish / cnTotal * 100).toFixed(0)}% positive</div>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(m => {
          const isOpen = expanded === m.id;
          const color = m.signal === 'bullish' ? '#22c55e' : m.signal === 'bearish' ? '#ef4444' : '#f59e0b';
          return (
            <div key={m.id} style={{ padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: `1px solid var(--border)`, cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : m.id)}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 18, fontSize: 14 }}>
                  {m.market === 'HK' ? '\u{1F1ED}\u{1F1F0}' : '\u{1F1E8}\u{1F1F3}'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <SignalBadge signal={m.signal} />
                    <MetricBar value={m.value} history={m.history} color={color} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {m.value}{m.unit}
                  </div>
                  <div style={{ fontSize: 10, color: m.change > 0 ? '#22c55e' : m.change < 0 ? '#ef4444' : 'var(--text-dim)' }}>
                    {m.change > 0 ? '+' : ''}{m.change}{m.changeUnit}
                  </div>
                </div>
                <MiniSparkline data={m.history} color={color} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: '.2s' }}>{'\u25BC'}</span>
              </div>

              {/* Expandable detail */}
              {isOpen && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--bg-input)', fontSize: 10, color: 'var(--text-dim)' }}>
                  {m.description}
                  <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
                    <span>7D Range: {Math.min(...m.history).toFixed(1)}–{Math.max(...m.history).toFixed(1)}</span>
                    <span>{m.change > 0 ? '\u{1F7E2}' : m.change < 0 ? '\u{1F534}' : '\u{26AA}'} {m.change > 0 ? 'Improving' : m.change < 0 ? 'Deteriorating' : 'Stable'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cross-market insight */}
      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: '#6366f1' }}>{'\u{1F4CA}'} Cross-Market Insight</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          AH Premium {MOCK_METRICS.find(m => m.id === 'ah_premium')!.value} (declining) + ADR Discount + Short Sell Rising = HK stocks may be entering a squeeze zone.
          Margin Balance {MOCK_METRICS.find(m => m.id === 'margin_balance')!.value.toFixed(2)}T CNY approaching 2T threshold — watch for regulatory cooling measures.
        </div>
      </div>
    </div>
  );
};

export default HKCNMarketPanel;
