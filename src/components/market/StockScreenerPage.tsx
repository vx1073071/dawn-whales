import { useState, useEffect, useCallback } from 'react';
import { searchStocks } from '../../lib/bridge-api';

interface ScreenerResult {
  code: string;
  name: string;
  latestPrice: number;
  changePct: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  roe?: number;
  revenueGrowth?: number;
  sector?: string;
}

const PRESET_QUERIES = [
  '高ROE低PE',
  '小市值成长股',
  '行业龙头',
  '高股息',
  '近期突破',
  '北向资金增持',
];

export default function StockScreenerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<keyof ScreenerResult>('changePct');
  const [sortDesc, setSortDesc] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState({
    minPe: '',
    maxPe: '',
    minRoe: '',
    minMarketCap: '',
    sector: '',
  });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchStocks({
        query: query.trim(),
        selectType: 'natural',
        limit: 100,
      });
      if (res?.success && Array.isArray(res.records)) {
        let data = res.records as ScreenerResult[];
        // Apply advanced filters client-side
        data = data.filter((r) => {
          if (filters.minPe && r.pe && r.pe < Number(filters.minPe)) return false;
          if (filters.maxPe && r.pe && r.pe > Number(filters.maxPe)) return false;
          if (filters.minRoe && r.roe && r.roe < Number(filters.minRoe)) return false;
          if (filters.minMarketCap && r.marketCap && r.marketCap < Number(filters.minMarketCap)) return false;
          if (filters.sector && r.sector && !r.sector.includes(filters.sector)) return false;
          return true;
        });
        setResults(data);
      } else {
        setResults([]);
        setError(res?.error || '未找到匹配结果');
      }
    } catch (e: any) {
      setError(e.message || '查询失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) handleSearch();
    }, 500);
    return () => clearTimeout(t);
  }, [query, handleSearch]);

  const sorted = [...results].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDesc ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
  });

  function toggleSort(key: keyof ScreenerResult) {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  }

  const formatNumber = (n?: number) => {
    if (n == null) return '-';
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
    return n.toFixed(2);
  };

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">🔍 智能选股</h1>
        <p className="text-gray-400 text-sm">自然语言选股 + 高级筛选条件</p>
      </div>

      {/* Search Bar */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="输入选股条件，如：高ROE低PE、小市值成长股、行业龙头..."
            className="flex-1 bg-card border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-[#C9A046] hover:bg-[#b8933f] text-sidebar font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>

        {/* Preset Queries */}
        <div className="flex flex-wrap gap-2">
          {PRESET_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-1.5 rounded-full border border-white/5 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="text-xs text-[#C9A046] hover:text-[#d4b55a] flex items-center gap-1"
        >
          {advancedOpen ? '▲' : '▼'} 高级筛选
        </button>

        {advancedOpen && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-white/5">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">最小PE</label>
              <input
                type="number"
                value={filters.minPe}
                onChange={(e) => setFilters({ ...filters, minPe: e.target.value })}
                placeholder="0"
                className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">最大PE</label>
              <input
                type="number"
                value={filters.maxPe}
                onChange={(e) => setFilters({ ...filters, maxPe: e.target.value })}
                placeholder="100"
                className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">最小ROE(%)</label>
              <input
                type="number"
                value={filters.minRoe}
                onChange={(e) => setFilters({ ...filters, minRoe: e.target.value })}
                placeholder="10"
                className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">最小市值(亿)</label>
              <input
                type="number"
                value={filters.minMarketCap}
                onChange={(e) => setFilters({ ...filters, minMarketCap: e.target.value })}
                placeholder="50"
                className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">行业</label>
              <input
                type="text"
                value={filters.sector}
                onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                placeholder="如：科技"
                className="w-full bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results Table */}
      {sorted.length > 0 && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm text-gray-400">共找到 <span className="text-white font-semibold">{sorted.length}</span> 只符合条件的股票</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card text-gray-400 text-xs">
                  <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('code')}>
                    代码 {sortKey === 'code' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('name')}>
                    名称 {sortKey === 'name' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('latestPrice')}>
                    最新价 {sortKey === 'latestPrice' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('changePct')}>
                    涨跌幅 {sortKey === 'changePct' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('marketCap')}>
                    市值 {sortKey === 'marketCap' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('pe')}>
                    PE {sortKey === 'pe' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('pb')}>
                    PB {sortKey === 'pb' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => toggleSort('roe')}>
                    ROE {sortKey === 'roe' && (sortDesc ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">行业</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sorted.map((r) => (
                  <tr key={r.code} className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3 text-white font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{r.latestPrice?.toFixed(2) ?? '-'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${(r.changePct ?? 0) >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {(r.changePct ?? 0) >= 0 ? '+' : ''}{r.changePct?.toFixed(2) ?? '-'}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatNumber(r.marketCap)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{r.pe?.toFixed(1) ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{r.pb?.toFixed(1) ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{r.roe ? `${r.roe.toFixed(1)}%` : '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.sector || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && results.length === 0 && query.trim() && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">未找到匹配的股票</p>
          <p className="text-xs mt-1">尝试修改筛选条件或关键词</p>
        </div>
      )}

      {!query.trim() && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">输入选股条件开始搜索</p>
          <p className="text-xs mt-1">支持自然语言，如：高ROE低PE、小市值成长股</p>
        </div>
      )}
    </div>
  );
}
