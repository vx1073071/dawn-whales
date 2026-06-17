/**
 * GlobalFactorPanel — R277 ML#1: 全球因子面板 (14-market factor dashboard)
 *
 * Unified global factor hub covering:
 * 🇯🇵JP 🇮🇳IN 🇰🇷KR 🇹🇼TW 🇪🇺EU 🇧🇷BR 🇸🇦SA 🇸🇬SG 🇦🇺AU
 * + UK/CH/Crypto — 84 total market factors
 * Features: market tabs, factor cards, IC ranking, per-market health score
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface GlobalFactorItem {
  id: string;
  name: string;
  market: string;
  flag: string;
  category: string;
  currentIC: number;    // Information Coefficient
  icRank: number;       // 0-100
  ic5dAvg: number;
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  value: number;
  description: string;
}

interface MarketStats {
  market: string;
  flag: string;
  factorCount: number;
  bullishPct: number;
  avgIC: number;
}

// ────────────────────────────────────
// Mock data — 84 factors across 14 markets
// ────────────────────────────────────
const MARKETS_CONFIG: { code: string; flag: string; name: string }[] = [
  { code: 'US', flag: '\u{1F1FA}\u{1F1F8}', name: 'US' },
  { code: 'JP', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan' },
  { code: 'IN', flag: '\u{1F1EE}\u{1F1F3}', name: 'India' },
  { code: 'KR', flag: '\u{1F1F0}\u{1F1F7}', name: 'Korea' },
  { code: 'TW', flag: '\u{1F1F9}\u{1F1FC}', name: 'Taiwan' },
  { code: 'HK', flag: '\u{1F1ED}\u{1F1F0}', name: 'HK' },
  { code: 'CN', flag: '\u{1F1E8}\u{1F1F3}', name: 'China' },
  { code: 'EU', flag: '\u{1F1EA}\u{1F1FA}', name: 'Europe' },
  { code: 'UK', flag: '\u{1F1EC}\u{1F1E7}', name: 'UK' },
  { code: 'BR', flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil' },
  { code: 'SA', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi' },
  { code: 'SG', flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore' },
  { code: 'AU', flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia' },
  { code: 'CRYPTO', flag: '\u{20BF}', name: 'Crypto' },
];

const CATEGORIES = ['Value', 'Growth', 'Quality', 'Momentum', 'Size', 'Volatility', 'Liquidity', 'Sentiment', 'FundFlow', 'Macro'];

function generateFactor(id: string, name: string, market: string, flag: string, category: string): GlobalFactorItem {
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const ic = ((seed % 30) - 15) / 100;
  const ic5 = ic + ((seed % 10) - 5) / 200;
  const rank = 25 + (seed % 70);
  const sigs: GlobalFactorItem['signal'][] = ['STRONG_LONG', 'LONG', 'NEUTRAL', 'SHORT', 'STRONG_SHORT'];
  const sig = sigs[seed % sigs.length];
  const val = Math.tanh(ic * 5);
  return { id, name, market, flag, category, currentIC: ic, icRank: rank, ic5dAvg: ic5, signal: sig, value: val,
    description: `${market} market-specific ${category} factor` };
}

const BOILERPLATE_FACTORS: [string, string, string][] = [
  ['PE', 'PE Ratio', 'Value'], ['PB', 'PB Ratio', 'Value'], ['ROE', 'ROE', 'Quality'], ['MOM', 'Momentum 1M', 'Momentum'],
  ['VOL', 'Volatility 20D', 'Volatility'], ['LIQ', 'Turnover Rate', 'Liquidity'],
];

const ALL_FACTORS: GlobalFactorItem[] = MARKETS_CONFIG.flatMap(m =>
  BOILERPLATE_FACTORS.map(([id, name], i) =>
    generateFactor(`${m.code}_${id}`, `${m.name} ${name}`, m.code, m.flag, CATEGORIES[i % CATEGORIES.length])
  )
);

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function SignalDot({ signal }: { signal: GlobalFactorItem['signal'] }) {
  const colors: Record<string, string> = {
    STRONG_LONG: '#22c55e', LONG: '#86efac', NEUTRAL: '#9ca3af',
    SHORT: '#fca5a5', STRONG_SHORT: '#ef4444',
  };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colors[signal], marginRight: 4 }} />;
}

function ICBar({ ic }: { ic: number; rank: number }) {
  const absIC = Math.abs(ic);
  const color = ic > 0.03 ? '#22c55e' : ic > 0 ? '#86efac' : ic > -0.03 ? '#fca5a5' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(absIC * 700, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>{ic > 0 ? '+' : ''}{(ic * 100).toFixed(1)}%</span>
    </div>
  );
}

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values, min + 0.01);
  const range = max - min;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${20 - ((v - min) / range) * 16}`).join(' ');
  return (
    <svg viewBox="0 -2 60 24" width={60} height={16} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1} strokeLinecap="round" />
      <circle cx={(values.length - 1) / (values.length - 1) * 60} cy={20 - ((values[values.length - 1] - min) / range) * 16} r={2} fill={color} />
    </svg>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const GlobalFactorPanel: React.FC = () => {
  const [selectedMarket, setSelectedMarket] = useState<string>('US');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const marketStats: MarketStats[] = useMemo(() => MARKETS_CONFIG.map(m => {
    const fs = ALL_FACTORS.filter(f => f.market === m.code);
    const bull = fs.filter(f => f.signal === 'STRONG_LONG' || f.signal === 'LONG').length;
    return {
      market: m.code, flag: m.flag,
      factorCount: fs.length,
      bullishPct: fs.length > 0 ? (bull / fs.length) * 100 : 50,
      avgIC: fs.length > 0 ? fs.reduce((s, f) => s + f.currentIC, 0) / fs.length : 0,
    };
  }), []);

  const filtered = useMemo(() => {
    let fs = selectedMarket === 'ALL' ? ALL_FACTORS : ALL_FACTORS.filter(f => f.market === selectedMarket);
    if (selectedCategory) fs = fs.filter(f => f.category === selectedCategory);
    return fs.sort((a, b) => Math.abs(b.currentIC) - Math.abs(a.currentIC));
  }, [selectedMarket, selectedCategory]);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 940 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F30D}'} Global Factor Hub</h3>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {ALL_FACTORS.length} factors · {MARKETS_CONFIG.length} markets
        </span>
      </div>

      {/* Market bar — scrollable flags */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, overflowX: 'auto', padding: '0 0 6px 0', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedMarket('ALL')} style={chipStyle(selectedMarket === 'ALL')}>{'\u{1F30D}'} ALL</button>
        {MARKETS_CONFIG.map(m => {
          const stat = marketStats.find(s => s.market === m.code)!;
          return (
            <button key={m.code} onClick={() => setSelectedMarket(m.code)} style={chipStyle(selectedMarket === m.code)}>
              {m.flag} {m.code}
              <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.7 }}>({stat.factorCount})</span>
            </button>
          );
        })}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedCategory(null)} style={chipSmallStyle(!selectedCategory)}>All</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setSelectedCategory(c)} style={chipSmallStyle(selectedCategory === c)}>{c}</button>
        ))}
      </div>

      {/* Market health mini-bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, height: 20, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-input)' }}>
        {marketStats.map(ms => {
          const pct = (ms.factorCount / ALL_FACTORS.length) * 100;
          return (
            <div key={ms.market} title={`${ms.flag} ${ms.market} | ${ms.bullishPct.toFixed(0)}% bullish | IC: ${(ms.avgIC*100).toFixed(2)}%`}
              style={{ width: `${pct}%`, height: '100%', background: ms.bullishPct > 60 ? '#22c55e' : ms.bullishPct > 40 ? '#f59e0b' : '#ef4444', transition: 'background .4s' }} />
          );
        })}
      </div>

      {/* Factor grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {filtered.slice(0, 24).map(f => {
          const marketCfg = MARKETS_CONFIG.find(m => m.code === f.market)!;
          const miniHistory = Array.from({ length: 7 }, (_, i) => f.currentIC + (Math.sin(i * 0.8) * 0.02));
          const color = f.currentIC > 0 ? '#22c55e' : '#ef4444';
          return (
            <div key={f.id} style={{
              padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-card)', transition: 'border-color .2s',
              borderLeft: `3px solid ${f.currentIC > 0.03 ? '#22c55e' : f.currentIC > 0 ? '#86efac' : f.currentIC > -0.03 ? '#fca5a5' : '#ef4444'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 14 }}>{marketCfg.flag}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-input)' }}>{f.category}</span>
                    <SignalDot signal={f.signal} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{f.name}</div>
                </div>
                <MiniSpark values={miniHistory} color={color} />
              </div>
              <ICBar ic={f.currentIC} rank={f.icRank} />
              <div style={{ marginTop: 2, fontSize: 9, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                <span>5D IC: {f.ic5dAvg > 0 ? '+' : ''}{(f.ic5dAvg * 100).toFixed(2)}%</span>
                <span>Rank #{f.icRank}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 24 && (
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>
          Showing top 24 of {filtered.length} factors — apply filters to narrow down
        </div>
      )}
    </div>
  );
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 8px', borderRadius: 6, border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'rgba(99,102,241,.12)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text)', fontSize: 11, cursor: 'pointer', fontWeight: active ? 700 : 400,
  whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
});

const chipSmallStyle = (active: boolean): React.CSSProperties => ({
  padding: '1px 8px', borderRadius: 4, border: active ? '1px solid var(--accent)' : '1px solid transparent',
  background: active ? 'rgba(99,102,241,.10)' : 'var(--bg-input)',
  color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: active ? 600 : 400,
});

export default GlobalFactorPanel;
