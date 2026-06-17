/**
 * FactorTemplateMarket — R279 ML#1: 因子模板市场前端
 *
 * Creator marketplace for factor templates:
 * - Browse/purchase factor strategy templates
 * - Filter by market/category/performance
 * - Creator tiers (L1 70% / L2 80% / L3 90%)
 * - Template preview + backtest stats
 * - Ratings + reviews
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface FactorTemplate {
  id: string;
  name: string;
  creator: string;
  creatorTier: 'L1' | 'L2' | 'L3';
  price: number;          // USDT
  category: string;
  markets: string[];
  factors: string[];
  sharpe: number;
  winRate: number;
  maxDrawdown: number;
  annualReturn: number;
  backtestYears: number;
  rating: number;
  reviews: number;
  sales: number;
  tags: string[];
  description: string;
}

type SortMode = 'popular' | 'new' | 'performance' | 'price-asc' | 'price-desc';

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_TEMPLATES: FactorTemplate[] = [
  { id: 'tpl_001', name: 'US Value + Quality Combo', creator: 'AlphaSeeker', creatorTier: 'L3', price: 29.9, category: 'Value', markets: ['US'], factors: ['PE_TTM', 'PB_LF', 'ROE', 'FCF_Yield'], sharpe: 1.42, winRate: 62, maxDrawdown: 18, annualReturn: 15.2, backtestYears: 10, rating: 4.8, reviews: 245, sales: 1850, tags: ['value', 'quality', 'large-cap'], description: 'Buffett-style value + quality filter. PE&lt;15, ROE&gt;15%, positive FCF. Rebalanced quarterly.' },
  { id: 'tpl_002', name: 'A-Share Northbound Momentum', creator: 'DragonTrader', creatorTier: 'L2', price: 19.9, category: 'Momentum', markets: ['CN'], factors: ['Northbound', 'MOM_6M', 'Turnover'], sharpe: 1.28, winRate: 58, maxDrawdown: 25, annualReturn: 22.5, backtestYears: 5, rating: 4.5, reviews: 128, sales: 920, tags: ['momentum', 'northbound', 'A-share'], description: 'Ride northbound money flow + price momentum. Weekly rebalance, max 10 positions.' },
  { id: 'tpl_003', name: 'Global Low Vol Anomaly', creator: 'RiskWizard', creatorTier: 'L3', price: 24.9, category: 'Volatility', markets: ['US', 'EU', 'JP'], factors: ['Beta60D', 'IdioVol', 'MinVol'], sharpe: 1.15, winRate: 55, maxDrawdown: 12, annualReturn: 8.5, backtestYears: 15, rating: 4.6, reviews: 312, sales: 2100, tags: ['low-vol', 'defensive', 'global'], description: 'Low volatility factor across 3 markets. Beta &lt;0.8, low idio vol. Monthly rebal.' },
  { id: 'tpl_004', name: 'HK Small-Cap Deep Value', creator: 'ValueHunter', creatorTier: 'L1', price: 9.9, category: 'Value', markets: ['HK'], factors: ['PE_TTM', 'PB_LF', 'MktCap', 'Dividend'], sharpe: 0.95, winRate: 52, maxDrawdown: 32, annualReturn: 18.0, backtestYears: 8, rating: 4.2, reviews: 85, sales: 450, tags: ['small-cap', 'deep-value', 'HK'], description: 'HK small caps with PE&lt;8 and PB&lt;0.8. High dividend. 20 positions.' },
  { id: 'tpl_005', name: 'India Growth + FII Flow', creator: 'NiftyMaster', creatorTier: 'L2', price: 22.9, category: 'Growth', markets: ['IN'], factors: ['EPS_YoY', 'FII_Flow', 'GST'], sharpe: 1.55, winRate: 65, maxDrawdown: 20, annualReturn: 24.0, backtestYears: 7, rating: 4.7, reviews: 190, sales: 1350, tags: ['growth', 'FII', 'India'], description: 'High growth + FII buying. EPS growth &gt;15%, FII net buyer. 15 positions.' },
  { id: 'tpl_006', name: 'Crypto On-Chain Momentum', creator: 'ChainAlpha', creatorTier: 'L3', price: 34.9, category: 'Momentum', markets: ['CRYPTO'], factors: ['ExchangeFlow', 'HashRate', 'MOM_1M'], sharpe: 1.85, winRate: 68, maxDrawdown: 45, annualReturn: 52.0, backtestYears: 4, rating: 4.9, reviews: 420, sales: 3200, tags: ['crypto', 'on-chain', 'momentum'], description: 'Exchange outflow + hash rate + price momentum. Weekly rebalance, 5 coins.' },
  { id: 'tpl_007', name: 'Japan PBR Reform Play', creator: 'TokyoTrader', creatorTier: 'L2', price: 18.9, category: 'Quality', markets: ['JP'], factors: ['PB_LF', 'ROE', 'Buyback'], sharpe: 1.32, winRate: 60, maxDrawdown: 16, annualReturn: 12.8, backtestYears: 5, rating: 4.4, reviews: 105, sales: 680, tags: ['Japan', 'PBR', 'buyback'], description: 'Japanese stocks with PB&lt;1 + active buybacks. TSE reform catalyst.' },
  { id: 'tpl_008', name: 'Brazil Commodity Beta', creator: 'SambaTrade', creatorTier: 'L1', price: 14.9, category: 'Macro', markets: ['BR'], factors: ['CommodityBeta', 'CRB', 'BRL_USD'], sharpe: 1.05, winRate: 54, maxDrawdown: 38, annualReturn: 28.0, backtestYears: 10, rating: 4.1, reviews: 62, sales: 320, tags: ['commodity', 'Brazil', 'macro'], description: 'Track commodity cycle with Brazilian equities. For contrarians.' },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const cfg = { L1: { bg: 'rgba(34,197,94,.12)', fg: '#22c55e', label: 'L1 (70%)' },
    L2: { bg: 'rgba(99,102,241,.12)', fg: '#818cf8', label: 'L2 (80%)' },
    L3: { bg: 'rgba(245,158,11,.12)', fg: '#fbbf24', label: 'L3 (90%)' } };
  const c = cfg[tier as keyof typeof cfg];
  return <span style={{ padding: '1px 6px', borderRadius: 3, background: c.bg, color: c.fg, fontSize: 9, fontWeight: 600 }}>{c.label}</span>;
}

function Stars({ rating, reviews }: { rating: number; reviews: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ fontSize: 11, color: '#fbbf24' }}>
      {'\u2605'.repeat(full)}{half ? '\u00BD' : ''} <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({reviews})</span>
    </span>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const FactorTemplateMarket: React.FC = () => {
  const [sort, setSort] = useState<SortMode>('popular');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterMkt, setFilterMkt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const categories = [...new Set(MOCK_TEMPLATES.map(t => t.category))];
  const allMarkets = [...new Set(MOCK_TEMPLATES.flatMap(t => t.markets))];

  const filtered = useMemo(() => {
    let data = MOCK_TEMPLATES;
    if (filterCat) data = data.filter(t => t.category === filterCat);
    if (filterMkt) data = data.filter(t => t.markets.includes(filterMkt));
    return [...data].sort((a, b) => {
      switch (sort) {
        case 'popular': return b.sales - a.sales;
        case 'new': return b.backtestYears - a.backtestYears;
        case 'performance': return b.sharpe - a.sharpe;
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        default: return 0;
      }
    });
  }, [sort, filterCat, filterMkt]);

  const totalRevenue = MOCK_TEMPLATES.reduce((s, t) => s + t.sales * t.price, 0);
  const creatorShare = MOCK_TEMPLATES.reduce((s, t) => {
    const share = t.creatorTier === 'L3' ? 0.9 : t.creatorTier === 'L2' ? 0.8 : 0.7;
    return s + t.sales * t.price * share;
  }, 0);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 940 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F3EC}'} Factor Template Market</h3>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {(totalRevenue / 1000).toFixed(0)}K USDT total · {creatorShare.toFixed(0)}K to creators
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[{ label: 'Templates', val: MOCK_TEMPLATES.length }, { label: 'Total Sales', val: MOCK_TEMPLATES.reduce((s, t) => s + t.sales, 0).toLocaleString() }, { label: 'Avg Price', val: `${(MOCK_TEMPLATES.reduce((s, t) => s + t.price, 0) / MOCK_TEMPLATES.length).toFixed(1)}U` }, { label: 'Avg Sharpe', val: (MOCK_TEMPLATES.reduce((s, t) => s + t.sharpe, 0) / MOCK_TEMPLATES.length).toFixed(2) }].map(s => (
          <div key={s.label} style={{ flex: 1, padding: 6, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Sort:</span>
        {(['popular', 'performance', 'price-asc', 'price-desc', 'new'] as SortMode[]).map(m => (
          <button key={m} onClick={() => setSort(m)} style={chipM(sort === m)}>{m}</button>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>Market:</span>
        <button onClick={() => setFilterMkt(null)} style={chipS2(!filterMkt)}>All</button>
        {allMarkets.map(m => <button key={m} onClick={() => setFilterMkt(m)} style={chipS2(filterMkt === m)}>{m}</button>)}
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>Category:</span>
        <button onClick={() => setFilterCat(null)} style={chipS2(!filterCat)}>All</button>
        {categories.map(c => <button key={c} onClick={() => setFilterCat(c)} style={chipS2(filterCat === c)}>{c}</button>)}
      </div>

      {/* Template cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {filtered.map(t => {
          const isOpen = selected === t.id;
          return (
            <div key={t.id} onClick={() => setSelected(isOpen ? null : t.id)} style={{
              padding: 12, borderRadius: 8, cursor: 'pointer',
              background: isOpen ? 'rgba(99,102,241,.04)' : 'var(--bg-card)',
              border: isOpen ? '2px solid var(--accent)' : '1px solid var(--border)',
              transition: 'all .2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{t.name}</div>
                <div style={{ fontWeight: 700, color: '#6366f1', fontSize: 13 }}>{t.price}U</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <TierBadge tier={t.creatorTier} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>by {t.creator}</span>
                <span style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-input)', fontSize: 9 }}>{t.category}</span>
              </div>

              {/* Performance strip */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 10 }}>
                <span>Sharpe: <strong style={{ color: t.sharpe > 1.5 ? '#22c55e' : t.sharpe > 1 ? '#f59e0b' : 'var(--text)' }}>{t.sharpe.toFixed(2)}</strong></span>
                <span>Ret: <strong style={{ color: '#22c55e' }}>+{t.annualReturn}%</strong></span>
                <span>DD: <strong style={{ color: t.maxDrawdown > 30 ? '#ef4444' : 'var(--text)' }}>-{t.maxDrawdown}%</strong></span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stars rating={t.rating} reviews={t.reviews} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{t.sales} sold</span>
              </div>

              {/* Market badges */}
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {t.markets.map(m => <span key={m} style={{ padding: '1px 5px', borderRadius: 3, background: 'var(--bg-input)', fontSize: 9 }}>{m}</span>)}
              </div>

              {isOpen && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--bg-input)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{t.description}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {t.tags.map(tag => <span key={tag} style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(99,102,241,.10)', color: '#818cf8', fontSize: 9 }}>#{tag}</span>)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-dim)' }}>
                    Factors: {t.factors.join(', ')} | Period: {t.backtestYears}y
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const chipM = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 4, border: active ? '1px solid var(--accent)' : '1px solid transparent',
  background: active ? 'rgba(99,102,241,.10)' : 'var(--bg-input)',
  color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: active ? 600 : 400,
});
const chipS2 = (active: boolean): React.CSSProperties => ({
  padding: '1px 6px', borderRadius: 3, border: active ? '1px solid var(--accent)' : '1px solid transparent',
  background: active ? 'rgba(99,102,241,.10)' : 'var(--bg-input)',
  color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 9, cursor: 'pointer', fontWeight: active ? 600 : 400,
});

export default FactorTemplateMarket;
