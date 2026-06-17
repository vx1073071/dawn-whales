/**
 * AIFactorInterpretation — R279 ML#2: AI因子解读UI
 *
 * AI-powered factor interpretation:
 * - Natural language factor explanation
 * - "Why is this factor working/failing?"
 * - Regime-aware interpretation
 * - Actionable trading suggestions
 * - Confidence score + caveats
 */
import React, { useState } from 'react';

interface AIInterpretation {
  factorId: string;
  factorName: string;
  market: string;
  flag: string;
  currentValue: number;
  interpretation: string;
  regimeContext: string;
  suggestion: string;
  confidence: number;
  caveats: string[];
  updatedAt: string;
}

const MOCK_INTERPRETATIONS: AIInterpretation[] = [
  { factorId: 'PE_TTM_US', factorName: 'US PE_TTM', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', currentValue: 22.5, interpretation: 'S&P 500 PE at 22.5x — above 15Y average (18.2x) but justified by AI-driven earnings growth. The market is pricing in 12% EPS growth for 2026. Not cheap, but not bubble territory at current rates.', regimeContext: 'Late cycle with AI tailwind. Rate cuts supportive. Valuation expansion limited from here — earnings must deliver.', suggestion: '\u{1F4A1} Use PE as a position-sizing factor, not a timing factor. Reduce exposure when PE > 25x (2 std above mean). Add when PE < 16x. Current level: maintain, don\'t add.', confidence: 78, caveats: ['PE can stay elevated for years in low-rate environments', 'Sector composition shifts make historical comparison less reliable', 'AI stocks skew the index PE higher'], updatedAt: '2026-06-18' },
  { factorId: 'Northbound_CN', factorName: 'CN Northbound Flow', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', currentValue: 3.2, interpretation: 'Northbound net inflow of 3.2B CNY — foreign investors returning to A-shares after months of selling. This is a regime change signal. Historically, 5 consecutive days of net inflow marks a bottom.', regimeContext: 'PBOC easing + policy support for equities. Foreigners lagged domestic buyers in the March rally — now catching up.', suggestion: '\u{1F4A1} This is a CONFIRMATION signal for existing longs. New positions: focus on northbound-favored sectors (consumer, healthcare, new energy). Set stop at 2x ATR below entry.', confidence: 82, caveats: ['Northbound data is T+1 (delayed by one day)', 'Single-day flows can be noisy — use 5-day rolling average', 'Not all northbound is "smart money" — some is passive/index tracking'], updatedAt: '2026-06-18' },
  { factorId: 'PCR_NDX', factorName: 'NDX Put/Call Ratio', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', currentValue: 0.72, interpretation: 'Put/Call at 0.72 — heavily skewed toward calls. This is a contrarian warning. When PCR < 0.7, the market is complacent and a pullback often follows within 2-4 weeks.', regimeContext: 'AI euphoria is driving extreme call buying. Similar readings preceded the Aug 2024 and Apr 2025 corrections.', suggestion: '\u{1F4A1} Don\'t short into this — but tighten stops. Consider buying protective puts while IV is reasonable. Reduce position size by 20%. Let winners run but don\'t add.', confidence: 72, caveats: ['PCR is a sentiment indicator — timing is imprecise', 'Structural shift toward 0DTE options distorts ratio', 'Bull markets can stay irrational longer than you can stay solvent'], updatedAt: '2026-06-18' },
  { factorId: 'PBR_JP', factorName: 'JP Topix PBR', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', currentValue: 1.45, interpretation: 'Topix PBR at 1.45x — TSE reform is working. Companies with PBR < 1x are being forced to improve or face delisting pressure. The average PBR has risen from 1.2x to 1.45x in 18 months.', regimeContext: 'Structural reform + BOJ normalization. This is a multi-year re-rating story — not a short-term trade.', suggestion: '\u{1F4A1} Long Japan equities with PBR < 1.2x (still room to run). Prefer companies with announced buyback programs. This is a 2-3 year position-sizing opportunity, not a timing trade.', confidence: 85, caveats: ['TSE could soften enforcement if market drops', 'Yen strength hurts exporters (different factor)', 'Some PBR < 1 companies deserve to be cheap'], updatedAt: '2026-06-18' },
];

export const AIFactorInterpretation: React.FC = () => {
  const [selected, setSelected] = useState<string>(MOCK_INTERPRETATIONS[0].factorId);

  const current = MOCK_INTERPRETATIONS.find(i => i.factorId === selected)!;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F916}'} AI Factor Interpretation</h3>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>DeepSeek V4 Pro · Updated hourly</span>
      </div>

      {/* Factor selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {MOCK_INTERPRETATIONS.map(i => (
          <button key={i.factorId} onClick={() => setSelected(i.factorId)} style={{
            padding: '4px 10px', borderRadius: 6, border: selected === i.factorId ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: selected === i.factorId ? 'rgba(99,102,241,.10)' : 'var(--bg-card)',
            color: selected === i.factorId ? 'var(--accent)' : 'var(--text)', fontSize: 11, cursor: 'pointer', fontWeight: selected === i.factorId ? 700 : 400,
          }}>{i.flag} {i.factorName}</button>
        ))}
      </div>

      {/* Main interpretation card */}
      <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 16, marginRight: 6 }}>{current.flag}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{current.factorName}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Current Value</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{current.currentValue}</div>
          </div>
        </div>

        {/* Interpretation */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>{'\u{1F4AC}'} WHAT IT MEANS</div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text)' }}>{current.interpretation}</div>
        </div>

        {/* Regime context */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>{'\u{1F30D}'} MARKET CONTEXT</div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-dim)' }}>{current.regimeContext}</div>
        </div>

        {/* Suggestion */}
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>{current.suggestion}</div>
        </div>

        {/* Confidence + Caveats */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{'\u{26A0}\u{FE0F}'} CAVEATS</div>
            {current.caveats.map((c, i) => (
              <div key={i} style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>{'\u2022'} {c}</div>
            ))}
          </div>
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ width: 55, height: 55, margin: '0 auto' }}>
              <svg viewBox="0 0 60 60">
                <circle cx={30} cy={30} r={24} fill="none" stroke="var(--bg-input)" strokeWidth={6} />
                <circle cx={30} cy={30} r={24} fill="none" stroke={current.confidence > 80 ? '#22c55e' : '#f59e0b'} strokeWidth={6}
                  strokeDasharray={`${(current.confidence / 100) * 151} 151`} strokeLinecap="round" transform="rotate(-90 30 30)" />
                <text x={30} y={32} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)">{current.confidence}%</text>
              </svg>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Confidence</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center' }}>
        {'\u26A0\uFE0F'} AI-generated analysis. Not financial advice. Always verify with your own research. Updated: {current.updatedAt}
      </div>
    </div>
  );
};

export default AIFactorInterpretation;
