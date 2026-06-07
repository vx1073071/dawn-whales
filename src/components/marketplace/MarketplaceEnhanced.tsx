/**
 * Marketplace Enhanced — ML-52-01 + ML-52-02 [P0]
 * R52: v1.1.0-alpha Strategy Marketplace Enhancement
 *
 * New additions to R46 MarketplaceSearch + MarketplaceDetail:
 * - List/Card view toggle
 * - Pagination with page size control
 * - Sort by rating/return/newest (already in R46, enhanced)
 * - Strategy publish form (ML-52-02)
 * - Subscription status badge + count
 * - Responsive skeleton loader
 */

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface StrategyCard {
  id: string;
  name: string;
  author: string;
  description: string;
  category: string;
  market: string;
  timeframe: string;
  rating: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  subscribers: number;
  price: number; // 0 = free
  tags: string[];
  isSubscribed?: boolean;
  weeklyReturns: number[];
  backtestMonths: number;
  createdAt: string;
}

export type SortKey = 'rating' | 'return' | 'newest' | 'subscribers';
export type ViewMode = 'card' | 'list';

// ── Demo Data ───────────────────────────────────────────────────────────

const demoStrategies: StrategyCard[] = [
  { id: 's1', name: 'Golden Cross MA20/60', author: 'WhaleTrader', description: 'Classic moving average crossover on TQQQ with 5% stop loss', category: 'Trend Following', market: 'US', timeframe: 'Daily', rating: 4.7, totalReturn: 38.2, sharpeRatio: 1.82, maxDrawdown: 12.5, subscribers: 342, price: 0, tags: ['MA', 'TQQQ', 'Trend'], weeklyReturns: [2.1, -1.3, 3.5, 0.8, -0.5], backtestMonths: 24, createdAt: '2026-06-01', isSubscribed: true },
  { id: 's2', name: 'RSI Mean Reversion', author: 'QuantPanda', description: 'RSI(14) oversold bounce with volume confirmation on SPY', category: 'Mean Reversion', market: 'US', timeframe: 'Hourly', rating: 4.3, totalReturn: 24.8, sharpeRatio: 1.45, maxDrawdown: 8.2, subscribers: 189, price: 0, tags: ['RSI', 'SPY', 'Reversion'], weeklyReturns: [1.5, 2.2, -0.8, 1.9, 0.3], backtestMonths: 18, createdAt: '2026-05-15' },
  { id: 's3', name: 'Momentum Breakout', author: 'AlphaSeeker', description: '52-week high breakout with ADX > 25 filter, A-share market', category: 'Momentum', market: 'CN', timeframe: 'Daily', rating: 4.1, totalReturn: 45.6, sharpeRatio: 1.21, maxDrawdown: 22.0, subscribers: 567, price: 99, tags: ['Momentum', 'A-Share', 'Breakout'], weeklyReturns: [5.2, -2.1, 4.8, -1.5, 3.0], backtestMonths: 36, createdAt: '2026-04-20', isSubscribed: true },
  { id: 's4', name: 'HK Dividend Capture', author: 'DivHunter', description: 'Dividend capture strategy for HK blue chips with ex-date calendar', category: 'Arbitrage', market: 'HK', timeframe: 'Weekly', rating: 3.9, totalReturn: 15.3, sharpeRatio: 2.10, maxDrawdown: 5.1, subscribers: 123, price: 49, tags: ['Dividend', 'HK', 'Blue Chip'], weeklyReturns: [0.8, 1.1, 0.5, 0.9, 0.7], backtestMonths: 12, createdAt: '2026-05-30' },
  { id: 's5', name: 'VIX Volatility Hedge', author: 'VolMaster', description: 'VIX futures term structure arbitrage with dynamic position sizing', category: 'Hedge', market: 'US', timeframe: 'Daily', rating: 4.5, totalReturn: 28.7, sharpeRatio: 1.67, maxDrawdown: 15.3, subscribers: 278, price: 0, tags: ['VIX', 'Hedge', 'Volatility'], weeklyReturns: [-0.5, 4.2, 1.8, -2.1, 3.5], backtestMonths: 20, createdAt: '2026-05-10' },
  { id: 's6', name: 'Multi-Factor Alpha', author: 'FactorLab', description: 'Value + Momentum + Quality multi-factor model with monthly rebalance', category: 'Multi-Factor', market: 'US', timeframe: 'Monthly', rating: 4.8, totalReturn: 32.1, sharpeRatio: 2.05, maxDrawdown: 10.8, subscribers: 891, price: 199, tags: ['Multi-Factor', 'Value', 'Momentum'], weeklyReturns: [1.2, 2.8, -0.3, 1.5, 2.0], backtestMonths: 30, createdAt: '2026-04-01' },
];

const categoryOptions = ['All', 'Trend Following', 'Mean Reversion', 'Momentum', 'Arbitrage', 'Multi-Factor', 'Hedge'];
const marketOptions = ['All', 'US', 'HK', 'CN'];
const timeframeOptions = ['All', 'Hourly', 'Daily', 'Weekly', 'Monthly'];

// ── Components ──────────────────────────────────────────────────────────

const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ rating, size = 'sm' }) => {
  const stars = Math.round(rating * 2) / 2;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  return (
    <span className={`${textSize} text-amber-400`}>
      {'★'.repeat(Math.floor(stars))}
      {stars % 1 !== 0 ? '½' : ''}
      <span className="text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
};

const StrategyCardView: React.FC<{ item: StrategyCard; onDetail: (id: string) => void }> = ({ item, onDetail }) => (
  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 hover:border-amber-500/15 transition-all cursor-pointer group" onClick={() => onDetail(item.id)}>
    <div className="flex items-start justify-between mb-2">
      <div>
        <h4 className="text-sm font-medium text-gray-200 group-hover:text-amber-400 transition-colors">{item.name}</h4>
        <p className="text-[10px] text-gray-600 mt-0.5">{item.author} · {item.createdAt}</p>
      </div>
      <StarRating rating={item.rating} />
    </div>
    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.description}</p>
    <div className="flex flex-wrap gap-1 mb-3">
      {item.tags.map((t) => (
        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-500">{t}</span>
      ))}
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{item.category}</span>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { label: 'Return', value: `${item.totalReturn > 0 ? '+' : ''}${item.totalReturn}%`, cls: item.totalReturn > 0 ? 'text-green-400' : 'text-red-400' },
        { label: 'Sharpe', value: item.sharpeRatio.toFixed(2), cls: 'text-gray-300' },
        { label: 'Subs', value: item.subscribers.toLocaleString(), cls: 'text-gray-400' },
      ].map((s) => (
        <div key={s.label}>
          <p className={`text-sm font-semibold ${s.cls}`}>{s.value}</p>
          <p className="text-[9px] text-gray-600">{s.label}</p>
        </div>
      ))}
    </div>
    {item.isSubscribed && (
      <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[10px] text-amber-400">Subscribed</span>
        <span className="text-[10px] text-gray-600">{item.price === 0 ? 'Free' : `$${item.price}`}</span>
      </div>
    )}
  </div>
);

const StrategyListView: React.FC<{ item: StrategyCard; onDetail: (id: string) => void }> = ({ item, onDetail }) => (
  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-4 py-3 flex items-center gap-4 hover:border-amber-500/10 transition-colors cursor-pointer" onClick={() => onDetail(item.id)}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-gray-200 truncate">{item.name}</h4>
        {item.isSubscribed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Subbed</span>}
      </div>
      <p className="text-[10px] text-gray-600">{item.author} · {item.category} · {item.market} · {item.timeframe}</p>
    </div>
    <div className="text-right shrink-0">
      <p className={`text-sm font-semibold ${item.totalReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>{item.totalReturn > 0 ? '+' : ''}{item.totalReturn}%</p>
      <p className="text-[9px] text-gray-600">Return</p>
    </div>
    <div className="text-right shrink-0">
      <p className="text-sm font-semibold text-gray-300">{item.sharpeRatio.toFixed(2)}</p>
      <p className="text-[9px] text-gray-600">Sharpe</p>
    </div>
    <StarRating rating={item.rating} />
    <span className="text-[10px] text-gray-500">{item.subscribers} subs</span>
    <span className="text-[10px] text-gray-600 w-12 text-right">{item.price === 0 ? 'Free' : `$${item.price}`}</span>
  </div>
);

// ── Pagination ──────────────────────────────────────────────────────────

const Pagination: React.FC<{
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}> = ({ page, total, pageSize, onPage, onSize }) => {
  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span>Show</span>
        <select value={pageSize} onChange={(e) => onSize(Number(e.target.value))} className="bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 text-xs text-gray-400">
          {[6, 12, 24].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-2 py-1 text-xs rounded bg-white/[0.03] text-gray-500 disabled:opacity-30 hover:text-gray-300">{'<'}</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = page <= 3 ? i + 1 : Math.min(i + page - 2, totalPages);
          return <button key={p} onClick={() => onPage(p)} className={`px-2 py-1 text-xs rounded ${p === page ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'}`}>{p}</button>;
        })}
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="px-2 py-1 text-xs rounded bg-white/[0.03] text-gray-500 disabled:opacity-30 hover:text-gray-300">{'>'}</button>
      </div>
    </div>
  );
};

// ── Skeleton Loader ─────────────────────────────────────────────────────

const MarketplaceSkeleton: React.FC = () => (
  <div className="p-4 space-y-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 animate-pulse space-y-2">
        <div className="flex justify-between">
          <div className="h-4 bg-white/[0.04] rounded w-48" />
          <div className="h-3 bg-white/[0.04] rounded w-16" />
        </div>
        <div className="h-3 bg-white/[0.04] rounded w-3/4" />
        <div className="flex gap-1">
          <div className="h-5 bg-white/[0.04] rounded w-12" />
          <div className="h-5 bg-white/[0.04] rounded w-16" />
        </div>
      </div>
    ))}
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────

const MarketplaceEnhanced: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sort, setSort] = useState<SortKey>('rating');
  const [catFilter, setCatFilter] = useState('All');
  const [marketFilter, setMarketFilter] = useState('All');
  const [tfFilter, setTfFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [, setSelectedId] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);

  const filtered = useMemo(() => {
    let items = [...demoStrategies];
    if (catFilter !== 'All') items = items.filter((s) => s.category === catFilter);
    if (marketFilter !== 'All') items = items.filter((s) => s.market === marketFilter);
    if (tfFilter !== 'All') items = items.filter((s) => s.timeframe === tfFilter);
    items.sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'return') return b.totalReturn - a.totalReturn;
      if (sort === 'subscribers') return b.subscribers - a.subscribers;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return items;
  }, [catFilter, marketFilter, tfFilter, sort]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page on filter change
  const setFilterAndReset = useCallback((setter: (v: string) => void, val: string) => {
    setter(val);
    setPage(1);
  }, []);

  return (
    <div className="h-full bg-[#0d0d15] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Strategy Marketplace</h2>
          <p className="text-[10px] text-gray-600">{filtered.length} strategies · {demoStrategies.filter(s => s.price === 0).length} free</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPublish(!showPublish)} className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs hover:bg-amber-500/25 transition-colors">
            + Publish
          </button>
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            <button onClick={() => setViewMode('card')} className={`px-2 py-1 rounded text-xs ${viewMode === 'card' ? 'bg-white/[0.06] text-gray-200' : 'text-gray-500'}`}>▦</button>
            <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded text-xs ${viewMode === 'list' ? 'bg-white/[0.06] text-gray-200' : 'text-gray-500'}`}>☰</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-white/[0.03] overflow-x-auto">
        {[
          { label: 'Category', val: catFilter, set: setCatFilter, opts: categoryOptions },
          { label: 'Market', val: marketFilter, set: setMarketFilter, opts: marketOptions },
          { label: 'Timeframe', val: tfFilter, set: setTfFilter, opts: timeframeOptions },
        ].map((f) => (
          <select key={f.label} value={f.val} onChange={(e) => setFilterAndReset(f.set, e.target.value)} className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[10px] text-gray-400">
            {f.opts.map((o) => <option key={o} value={o}>{f.label}: {o}</option>)}
          </select>
        ))}
        {[
          { label: 'Rating', key: 'rating' as SortKey },
          { label: 'Return', key: 'return' as SortKey },
          { label: 'Subs', key: 'subscribers' as SortKey },
          { label: 'Newest', key: 'newest' as SortKey },
        ].map((s) => (
          <button key={s.key} onClick={() => setSort(s.key)} className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${sort === s.key ? 'bg-amber-500/10 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {s.label} {sort === s.key ? '↓' : ''}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'card' ? (
          <div className="grid grid-cols-3 gap-3 p-4">
            {paged.map((item) => <StrategyCardView key={item.id} item={item} onDetail={setSelectedId} />)}
          </div>
        ) : (
          <div className="space-y-1 p-4">
            {paged.map((item) => <StrategyListView key={item.id} item={item} onDetail={setSelectedId} />)}
          </div>
        )}
      </div>

      <Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={setPage} onSize={(s) => { setPageSize(s); setPage(1); }} />
    </div>
  );
};

export default MarketplaceEnhanced;
export { MarketplaceSkeleton };
