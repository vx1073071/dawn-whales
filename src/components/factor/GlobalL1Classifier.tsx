/**
 * GlobalL1Classifier — R277 ML#3: 全球L1分类UI (Global L1 Category Classification)
 *
 * L1 category taxonomy visualization:
 * - 16 L1 factor categories with sub-counts
 * - Market × Category matrix (which markets have which factors)
 * - Factor distribution treemap
 * - Category health scores
 * - Cross-market category comparison
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface L1Category {
  id: string;
  label: string;
  icon: string;
  description: string;
  factorCount: number;
  markets: string[];     // which markets have this category
  avgIC: number;
  health: 'excellent' | 'good' | 'fair' | 'weak';
  coverage: number;      // 0-100% market coverage
  topFactor: string;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MARKETS_14 = [
  { code: 'US', flag: '\u{1F1FA}\u{1F1F8}' }, { code: 'JP', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'IN', flag: '\u{1F1EE}\u{1F1F3}' }, { code: 'KR', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'TW', flag: '\u{1F1F9}\u{1F1FC}' }, { code: 'HK', flag: '\u{1F1ED}\u{1F1F0}' },
  { code: 'CN', flag: '\u{1F1E8}\u{1F1F3}' }, { code: 'EU', flag: '\u{1F1EA}\u{1F1FA}' },
  { code: 'UK', flag: '\u{1F1EC}\u{1F1E7}' }, { code: 'BR', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'SA', flag: '\u{1F1F8}\u{1F1E6}' }, { code: 'SG', flag: '\u{1F1F8}\u{1F1EC}' },
  { code: 'AU', flag: '\u{1F1E6}\u{1F1FA}' }, { code: 'CRYPTO', flag: '\u{20BF}' },
];

const L1_CATEGORIES: L1Category[] = [
  { id: 'L1_VALUE', label: 'Value', icon: '\u{1F4B0}', description: 'PE, PB, EV/EBITDA, Dividend Yield, FCF Yield', factorCount: 42, markets: MARKETS_14.map(m => m.code), avgIC: 0.08, health: 'good', coverage: 100, topFactor: 'PE_TTM' },
  { id: 'L1_GROWTH', label: 'Growth', icon: '\u{1F4C8}', description: 'Revenue/Earnings growth, ROE, ROA, margin expansion', factorCount: 35, markets: MARKETS_14.map(m => m.code).filter(m => m !== 'CRYPTO'), avgIC: 0.06, health: 'fair', coverage: 93, topFactor: 'EPS_YoY' },
  { id: 'L1_QUALITY', label: 'Quality', icon: '\u{2B50}', description: 'ROE stability, debt/equity, Piotroski F-Score, accruals', factorCount: 28, markets: MARKETS_14.map(m => m.code).slice(0, 10), avgIC: 0.09, health: 'good', coverage: 71, topFactor: 'ROE' },
  { id: 'L1_MOMENTUM', label: 'Momentum', icon: '\u{1F680}', description: '1M/3M/6M/12M price momentum, relative strength', factorCount: 38, markets: MARKETS_14.map(m => m.code), avgIC: 0.07, health: 'good', coverage: 100, topFactor: 'MOM_6M' },
  { id: 'L1_SIZE', label: 'Size', icon: '\u{1F4CF}', description: 'Market cap, free float, small-cap premium', factorCount: 14, markets: MARKETS_14.map(m => m.code).filter(m => m !== 'CRYPTO'), avgIC: 0.03, health: 'fair', coverage: 93, topFactor: 'MktCap' },
  { id: 'L1_VOLATILITY', label: 'Volatility', icon: '\u{1F300}', description: 'Historical vol, beta, idiosyncratic vol, downside vol', factorCount: 26, markets: MARKETS_14.map(m => m.code), avgIC: -0.05, health: 'weak', coverage: 100, topFactor: 'Beta60D' },
  { id: 'L1_LIQUIDITY', label: 'Liquidity', icon: '\u{1F4A7}', description: 'Turnover rate, bid-ask spread, Amihud illiquidity', factorCount: 20, markets: MARKETS_14.map(m => m.code).slice(0, 12), avgIC: 0.04, health: 'fair', coverage: 86, topFactor: 'Turnover' },
  { id: 'L1_SENTIMENT', label: 'Sentiment', icon: '\u{1F4AC}', description: 'News sentiment, social media, analyst upgrades, put/call', factorCount: 34, markets: MARKETS_14.map(m => m.code).filter(m => ['US','CN','HK','JP','IN'].includes(m)), avgIC: 0.10, health: 'good', coverage: 36, topFactor: 'NewsSent' },
  { id: 'L1_FUND_FLOW', label: 'Fund Flow', icon: '\u{1F4B8}', description: 'Institutional flow, northbound, dark pool, ETF flow', factorCount: 22, markets: ['US','HK','CN','IN','JP','KR','TW'], avgIC: 0.11, health: 'excellent', coverage: 50, topFactor: 'Northbound' },
  { id: 'L1_MACRO', label: 'Macro', icon: '\u{1F30D}', description: 'GDP, CPI, PMI, interest rates, credit spreads, FX', factorCount: 32, markets: MARKETS_14.map(m => m.code).filter(m => m !== 'CRYPTO'), avgIC: 0.05, health: 'fair', coverage: 93, topFactor: 'PMI' },
  { id: 'L1_CROSS_ASSET', label: 'Cross Asset', icon: '\u{1F517}', description: 'Bond/equity correlation, commodity beta, FX exposure', factorCount: 18, markets: MARKETS_14.map(m => m.code).slice(0, 8), avgIC: 0.06, health: 'good', coverage: 57, topFactor: 'BondCorr' },
  { id: 'L1_RISK', label: 'Risk', icon: '\u{26A0}\u{FE0F}', description: 'VaR, CVaR, maximum drawdown, tail risk, stress test', factorCount: 20, markets: MARKETS_14.map(m => m.code), avgIC: 0.02, health: 'fair', coverage: 100, topFactor: 'VaR95' },
  { id: 'L1_EVENT', label: 'Event', icon: '\u{1F4C5}', description: 'Earnings surprise, insider trading, buyback, IPO, M&A', factorCount: 13, markets: ['US','HK','CN','JP','EU','IN'], avgIC: 0.12, health: 'excellent', coverage: 43, topFactor: 'EarnSurprise' },
  { id: 'L1_TECHNICAL', label: 'Technical', icon: '\u{1F4CA}', description: 'MA cross, RSI, MACD, Bollinger, pattern recognition', factorCount: 11, markets: MARKETS_14.map(m => m.code), avgIC: 0.04, health: 'fair', coverage: 100, topFactor: 'MA_CROSS' },
  { id: 'L1_ANALYST', label: 'Analyst', icon: '\u{1F4DD}', description: 'Analyst rating, target price, estimate revisions, dispersion', factorCount: 8, markets: ['US','HK','CN','JP','EU','IN','KR'], avgIC: 0.07, health: 'good', coverage: 50, topFactor: 'RatingChg' },
  { id: 'L1_CRYPTO', label: 'Crypto', icon: '\u{20BF}', description: 'On-chain metrics, hash rate, exchange flow, DeFi TVL', factorCount: 49, markets: ['CRYPTO'], avgIC: 0.15, health: 'excellent', coverage: 7, topFactor: 'ExchangeFlow' },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function HealthBadge({ health }: { health: L1Category['health'] }) {
  const cfg = {
    excellent: { bg: 'rgba(34,197,94,.15)', fg: '#22c55e', label: '\u{2B50} Excellent' },
    good: { bg: 'rgba(34,197,94,.10)', fg: '#22c55e', label: '\u{2705} Good' },
    fair: { bg: 'rgba(245,158,11,.10)', fg: '#f59e0b', label: '\u{26A0}\u{FE0F} Fair' },
    weak: { bg: 'rgba(239,68,68,.10)', fg: '#ef4444', label: '\u{274C} Weak' },
  }[health];
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: cfg.bg, color: cfg.fg, fontSize: 9, fontWeight: 600 }}>{cfg.label}</span>;
}

function TreemapCell({ cat, totalFactors }: { cat: L1Category; totalFactors: number }) {
  const pct = (cat.factorCount / totalFactors) * 100;
  const colors: Record<string, string> = {
    excellent: '#166534', good: '#14532d', fair: '#713f12', weak: '#7f1d1d',
  };
  const minSize = 3;
  const size = Math.max(pct, minSize);
  return (
    <div title={`${cat.label}: ${cat.factorCount} factors (${pct.toFixed(1)}%) | IC: ${(cat.avgIC*100).toFixed(1)}%`}
      style={{
        flexBasis: `${size}%`, minWidth: 40, padding: '4px 6px', background: colors[cat.health],
        color: '#fff', fontSize: 9, fontWeight: 600, borderRadius: 4, textAlign: 'center',
        cursor: 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        transition: 'flex-basis .4s',
      }}>
      {cat.icon} {cat.factorCount}
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const GlobalL1Classifier: React.FC = () => {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [view, setView] = useState<'treemap' | 'matrix' | 'list'>('treemap');

  const totalFactors = L1_CATEGORIES.reduce((s, c) => s + c.factorCount, 0);

  const selected = selectedCat ? L1_CATEGORIES.find(c => c.id === selectedCat) : null;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F4CA}'} Global Factor Taxonomy</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['treemap', 'matrix', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={tabV(view === v)}>
              {v === 'treemap' ? '\u{1F5FA}\u{FE0F}' : v === 'matrix' ? '\u{1F4CA}' : '\u{1F4CB}'} {v}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Total Categories', val: L1_CATEGORIES.length },
          { label: 'Total Factors', val: totalFactors },
          { label: 'Markets', val: MARKETS_14.length },
          { label: 'Avg IC', val: `${(L1_CATEGORIES.reduce((s, c) => s + c.avgIC, 0) / L1_CATEGORIES.length * 100).toFixed(1)}%` },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {view === 'treemap' ? (
        <>
          {/* Treemap */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 12 }}>
            {L1_CATEGORIES.map(c => <TreemapCell key={c.id} cat={c} totalFactors={totalFactors} />)}
          </div>

          {/* Category cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {L1_CATEGORIES.map(c => {
              const icPct = c.avgIC * 100;
              return (
                <div key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                  style={{
                    padding: 10, borderRadius: 8, cursor: 'pointer',
                    background: selectedCat === c.id ? 'rgba(99,102,241,.06)' : 'var(--bg-card)',
                    border: selectedCat === c.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    transition: 'all .2s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 16, marginRight: 6 }}>{c.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{c.label}</span>
                    </div>
                    <HealthBadge health={c.health} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{c.description}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                    <span>{'\u{1F4CA}'} {c.factorCount} factors</span>
                    <span>{'\u{1F30D}'} {c.markets.length}/{MARKETS_14.length} markets</span>
                    <span style={{ color: icPct > 5 ? '#22c55e' : icPct > 0 ? '#f59e0b' : '#ef4444' }}>
                      IC: {icPct > 0 ? '+' : ''}{icPct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{ width: `${c.coverage}%`, height: '100%', borderRadius: 2, background: c.health === 'excellent' ? '#22c55e' : c.health === 'good' ? '#86efac' : c.health === 'fair' ? '#fbbf24' : '#fca5a5' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : view === 'matrix' ? (
        /* Market × Category matrix */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={thL}>Category</th>
                {MARKETS_14.map(m => <th key={m.code} style={{ ...thL, fontSize: 14, padding: '4px 6px' }} title={m.code}>{m.flag}</th>)}
              </tr>
            </thead>
            <tbody>
              {L1_CATEGORIES.map(cat => (
                <tr key={cat.id}>
                  <td style={{ ...tdL, fontWeight: 700, whiteSpace: 'nowrap' }}>{cat.icon} {cat.label}</td>
                  {MARKETS_14.map(m => {
                    const hasIt = cat.markets.includes(m.code);
                    const seed = (cat.id + m.code).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                    const ic = hasIt ? ((seed % 30) - 5) / 100 : 0;
                    return (
                      <td key={m.code} style={{
                        ...tdL, textAlign: 'center', padding: '3px 6px',
                        background: hasIt
                          ? (ic > 0.05 ? 'rgba(34,197,94,.15)' : ic > 0 ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)')
                          : 'transparent',
                        color: hasIt ? (ic > 0.05 ? '#22c55e' : ic > 0 ? '#86efac' : '#9ca3af') : '#374151',
                        fontWeight: hasIt ? 600 : 300,
                      }}>
                        {hasIt ? '\u{2713}' : '\u{00B7}'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* List view — detailed */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {L1_CATEGORIES.sort((a, b) => b.factorCount - a.factorCount).map(c => {
            const icColor = c.avgIC > 0.05 ? '#22c55e' : c.avgIC > 0 ? '#f59e0b' : '#ef4444';
            return (
              <div key={c.id} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{c.icon}</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</span>
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)' }}>{c.factorCount} factors</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HealthBadge health={c.health} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: icColor }}>{(c.avgIC * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Market coverage bar */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                  {MARKETS_14.map(m => (
                    <div key={m.code} title={`${m.flag} ${m.code}`} style={{
                      flex: 1, height: 6, borderRadius: 2,
                      background: c.markets.includes(m.code) ? (c.avgIC > 0.05 ? '#22c55e' : '#f59e0b') : '#374151',
                      opacity: c.markets.includes(m.code) ? 1 : 0.3,
                    }} />
                  ))}
                </div>

                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  Top: <span style={{ color: 'var(--text)' }}>{c.topFactor}</span>
                  <span style={{ marginLeft: 12 }}>Markets: {c.markets.join(', ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected category detail */}
      {selected && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
            {selected.icon} {selected.label} — Deep Dive
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
            <div>
              <div style={{ color: 'var(--text-dim)' }}>Factor Count</div>
              <div style={{ fontWeight: 700 }}>{selected.factorCount}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)' }}>Avg IC</div>
              <div style={{ fontWeight: 700, color: selected.avgIC > 0.05 ? '#22c55e' : selected.avgIC > 0 ? '#f59e0b' : '#ef4444' }}>
                {(selected.avgIC * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)' }}>Market Coverage</div>
              <div style={{ fontWeight: 700 }}>{selected.markets.length}/{MARKETS_14.length} ({selected.coverage}%)</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)' }}>Top Factor</div>
              <div style={{ fontWeight: 700 }}>{selected.topFactor}</div>
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
            {selected.description}
          </div>
        </div>
      )}
    </div>
  );
};

const tabV = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 11, cursor: 'pointer', fontWeight: active ? 700 : 400,
});

const thL: React.CSSProperties = { padding: '4px 8px', borderBottom: '2px solid var(--border)', fontSize: 10, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdL: React.CSSProperties = { padding: '4px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

export default GlobalL1Classifier;
