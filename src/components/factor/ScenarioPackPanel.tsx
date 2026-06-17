/**
 * ScenarioPackPanel — R279 ML#5: 场景包5组 (5 Scenario Packs)
 *
 * Pre-built factor combinations for specific market scenarios:
 * 1. Recession Defense — quality + low vol + defensive sectors
 * 2. AI Boom — momentum + growth + tech
 * 3. Inflation Hedge — commodity + value + TIPS
 * 4. China Recovery — northbound + value + policy-sensitive
 * 5. Crypto Bull — on-chain + momentum + exchange flow
 */
import React, { useState } from 'react';

interface ScenarioPack {
  id: string;
  name: string;
  icon: string;
  description: string;
  thesis: string;
  triggers: string[];
  factors: { name: string; weight: number; signal: string }[];
  markets: string[];
  expectedSharpe: number;
  expectedReturn: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Extreme';
  timeHorizon: string;
  rebalanceFreq: string;
  userCount: number;
  active: boolean;
}

const SCENARIOS: ScenarioPack[] = [
  {
    id: 'recession_defense', name: 'Recession Defense', icon: '\u{1F6E1}\u{FE0F}',
    description: 'Capital preservation during economic contraction. Quality + low vol + defensive sectors.',
    thesis: 'When PMI < 48 and yield curve inverts, rotate to quality companies with strong balance sheets and low volatility. These survive downturns and bounce first.',
    triggers: ['PMI < 48 (current: 51.2 — NOT triggered)', '2s10s inverted (current: -0.15 — TRIGGERED)', 'VIX > 25 (current: 14.2 — NOT triggered)'],
    factors: [
      { name: 'Quality (ROE)', weight: 35, signal: 'LONG' },
      { name: 'Low Volatility', weight: 30, signal: 'LONG' },
      { name: 'Dividend Yield', weight: 20, signal: 'LONG' },
      { name: 'Size (Large Cap)', weight: 15, signal: 'LONG' },
    ],
    markets: ['US', 'EU'], expectedSharpe: 0.65, expectedReturn: 6.0, riskLevel: 'Low', timeHorizon: '6-12 months', rebalanceFreq: 'Monthly', userCount: 1850, active: false,
  },
  {
    id: 'ai_boom', name: 'AI Technology Boom', icon: '\u{1F916}',
    description: 'Ride the AI capex super-cycle. Momentum + growth + semiconductor supply chain.',
    thesis: 'Global AI infrastructure spending projected at $500B+ through 2027. Semiconductor equipment, cloud providers, and AI application companies are the primary beneficiaries.',
    triggers: ['AI capex > $200B/quarter (current: $285B — TRIGGERED)', 'SOXX index ATH (current: near ATH — TRIGGERED)', 'NVDA revenue guidance > +20% QoQ'],
    factors: [
      { name: 'Momentum 12M', weight: 30, signal: 'LONG' },
      { name: 'Revenue Growth YoY', weight: 25, signal: 'LONG' },
      { name: 'EPS Revisions Up', weight: 20, signal: 'LONG' },
      { name: 'Supply Chain Activity', weight: 15, signal: 'LONG' },
      { name: 'Analyst Upgrades', weight: 10, signal: 'LONG' },
    ],
    markets: ['US', 'TW', 'KR'], expectedSharpe: 1.35, expectedReturn: 28.0, riskLevel: 'High', timeHorizon: '12-24 months', rebalanceFreq: 'Weekly', userCount: 3200, active: true,
  },
  {
    id: 'inflation_hedge', name: 'Inflation Hedge', icon: '\u{1F4B8}',
    description: 'Protect purchasing power. Commodities + value stocks + real assets.',
    thesis: 'Structural inflation from deglobalization + energy transition + fiscal dominance. Hard assets outperform financial assets in inflationary regimes.',
    triggers: ['CPI > 3% (current: 3.2 — TRIGGERED)', 'Gold > $2500 (current: $2450 — near)', 'CRB Index > 400'],
    factors: [
      { name: 'Commodity Beta', weight: 30, signal: 'LONG' },
      { name: 'Value (PE/PB)', weight: 25, signal: 'LONG' },
      { name: 'Energy Sector', weight: 20, signal: 'LONG' },
      { name: 'Materials Sector', weight: 15, signal: 'LONG' },
      { name: 'Real Estate (REITs)', weight: 10, signal: 'LONG' },
    ],
    markets: ['US', 'BR', 'AU'], expectedSharpe: 0.85, expectedReturn: 15.0, riskLevel: 'Medium', timeHorizon: '6-18 months', rebalanceFreq: 'Monthly', userCount: 1250, active: true,
  },
  {
    id: 'china_recovery', name: 'China Recovery Play', icon: '\u{1F1E8}\u{1F1F3}',
    description: 'Position for China policy-driven recovery. Northbound flow + deep value + consumer.',
    thesis: 'PBOC easing cycle + fiscal stimulus + property stabilization. A-shares deeply undervalued vs history and vs global peers. Foreign capital returning.',
    triggers: ['Northbound 5D net inflow (current: 5D cumulative +12.5B — TRIGGERED)', 'CSI 300 PE < 12 (current: 11.8 — TRIGGERED)', 'Property sales stabilization'],
    factors: [
      { name: 'Northbound Flow', weight: 30, signal: 'LONG' },
      { name: 'Deep Value (PE < 10)', weight: 25, signal: 'LONG' },
      { name: 'Consumer Spending', weight: 20, signal: 'LONG' },
      { name: 'Dragon Tiger Board', weight: 15, signal: 'LONG' },
      { name: 'Policy Sensitivity', weight: 10, signal: 'LONG' },
    ],
    markets: ['CN', 'HK'], expectedSharpe: 0.72, expectedReturn: 22.0, riskLevel: 'High', timeHorizon: '6-12 months', rebalanceFreq: 'Weekly', userCount: 980, active: true,
  },
  {
    id: 'crypto_bull', name: 'Crypto Bull Market', icon: '\u{20BF}',
    description: 'Aggressive crypto allocation during bull phase. On-chain metrics + momentum.',
    thesis: 'Bitcoin halving cycle + ETF inflows + institutional adoption. On-chain metrics suggest mid-cycle, not a top. Exchange outflows = accumulation.',
    triggers: ['Bitcoin > 200D MA (current: TRUE — TRIGGERED)', 'Exchange outflow > 30D avg (TRIGGERED)', 'US BTC ETF inflow > $500M/week'],
    factors: [
      { name: 'Exchange Outflow', weight: 25, signal: 'LONG' },
      { name: 'Hash Rate Growth', weight: 20, signal: 'LONG' },
      { name: 'Momentum 3M', weight: 20, signal: 'LONG' },
      { name: 'Stablecoin Minting', weight: 15, signal: 'LONG' },
      { name: 'DeFi TVL Growth', weight: 10, signal: 'LONG' },
      { name: 'ETF Flow', weight: 10, signal: 'LONG' },
    ],
    markets: ['CRYPTO'], expectedSharpe: 1.80, expectedReturn: 55.0, riskLevel: 'Extreme', timeHorizon: '3-9 months', rebalanceFreq: 'Daily', userCount: 5100, active: true,
  },
];

export const ScenarioPackPanel: React.FC = () => {
  const [selected, setSelected] = useState<string>(SCENARIOS[0].id);

  const pack = SCENARIOS.find(s => s.id === selected)!;
  const riskColors: Record<string, string> = { Low: '#22c55e', Medium: '#f59e0b', High: '#f97316', Extreme: '#ef4444' };

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F4E6}'} Scenario Packs</h3>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {SCENARIOS.length} scenarios · {SCENARIOS.filter(s => s.active).length} active
        </span>
      </div>

      {/* Scenario selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {SCENARIOS.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} style={{
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            border: selected === s.id ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: selected === s.id ? 'rgba(99,102,241,.08)' : 'var(--bg-card)',
            opacity: s.active ? 1 : 0.6, transition: 'all .2s', flex: '1 0 auto',
          }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>{s.name}</div>
            <div style={{ fontSize: 9, color: s.active ? '#22c55e' : '#6b7280' }}>
              {s.active ? '\u{1F7E2} Active' : '\u{26AA} Dormant'}
            </div>
          </button>
        ))}
      </div>

      {/* Selected pack detail */}
      <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{pack.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{pack.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{pack.description}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ padding: '4px 10px', borderRadius: 6, background: `${riskColors[pack.riskLevel]}18`, color: riskColors[pack.riskLevel], fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
              {pack.riskLevel} Risk
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{pack.userCount} users</div>
          </div>
        </div>

        {/* Thesis */}
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.10)', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>{'\u{1F4A1}'} INVESTMENT THESIS</div>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>{pack.thesis}</div>
        </div>

        {/* Triggers */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>{'\u{1F3AF}'} TRIGGERS</div>
          {pack.triggers.map((t, i) => {
            const triggered = t.includes('TRIGGERED');
            return (
              <div key={i} style={{ fontSize: 10, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{triggered ? '\u{2705}' : '\u{274C}'}</span>
                <span style={{ color: triggered ? 'var(--text)' : 'var(--text-dim)' }}>{t}</span>
              </div>
            );
          })}
        </div>

        {/* Factor allocation */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>{'\u{2696}\u{FE0F}'} FACTOR ALLOCATION</div>
          {pack.factors.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{f.weight}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                  <div style={{ width: `${f.weight}%`, height: '100%', background: '#6366f1', borderRadius: 3 }} />
                </div>
              </div>
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 3,
                background: 'rgba(34,197,94,.12)', color: '#22c55e', fontWeight: 600,
              }}>{f.signal}</span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Exp Sharpe', val: pack.expectedSharpe.toFixed(2) },
            { label: 'Exp Return', val: `+${pack.expectedReturn}%` },
            { label: 'Horizon', val: pack.timeHorizon },
            { label: 'Rebalance', val: pack.rebalanceFreq },
            { label: 'Markets', val: pack.markets.join('+') },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScenarioPackPanel;
