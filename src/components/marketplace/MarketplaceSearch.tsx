/**
 * MarketplaceSearch — Search bar + filter chips for Marketplace
 * (ML-46-01, R46 Phase 6.3)
 */

import React, { useState, useCallback } from 'react';

interface MarketplaceSearchProps {
  onSearch: (query: string) => void;
  onFilterChange?: (filters: Record<string, string>) => void;
  className?: string;
}

const FILTER_OPTIONS = [
  { key: 'category', label: '分类', options: ['趋势跟踪', '均值回归', '动量', '套利', '多因子', 'AI/ML'] },
  { key: 'timeframe', label: '周期', options: ['日内', '中频', '低频'] },
  { key: 'market', label: 'components.markets', options: ['A股', '港股', '美股'] },
  { key: 'price', label: 'components.price', options: ['免费', '付费'] },
];

export const MarketplaceSearch: React.FC<MarketplaceSearchProps> = ({ onSearch, onFilterChange, className }) => {
    const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onSearch(v);
  }, [onSearch]);

  const toggleFilter = useCallback((key: string, value: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      onFilterChange?.(next);
      return next;
    });
  }, [onFilterChange]);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    onFilterChange?.({});
  }, [onFilterChange]);

  return (
    <div className={className}>
      {/* Search bar */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="搜索策略名称、标签、作者..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-amber-500/50 focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(''); onSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
            ✕
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_OPTIONS.map(filter => (
          <div key={filter.key} className="relative">
            <button
              onClick={() => setExpandedFilter(expandedFilter === filter.key ? null : filter.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                activeFilters[filter.key]
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : expandedFilter === filter.key
                  ? 'bg-gray-700/50 text-gray-300 border border-gray-600'
                  : 'bg-gray-800/40 text-gray-500 border border-gray-700/30 hover:text-gray-300'
              }`}
            >
              {filter.label}
              {activeFilters[filter.key] && <span className="text-[8px] ml-0.5">▼</span>}
            </button>

            {/* Dropdown */}
            {expandedFilter === filter.key && (
              <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-2 min-w-[120px]">
                {filter.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleFilter(filter.key, opt)}
                    className={`block w-full text-left px-3 py-1.5 rounded text-[10px] transition-colors ${
                      activeFilters[filter.key] === opt
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Active filter tags */}
        {Object.keys(activeFilters).length > 0 && (
          <button
            onClick={clearFilters}
            className="px-2.5 py-1 rounded text-[10px] text-red-400/70 hover:text-red-400 bg-red-500/5 border border-red-500/10"
          >
            清除全部
          </button>
        )}

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-gray-600">排序:</span>
          {(['rating' as const, 'return' as const, 'new' as const]).map(sort => (
            <button
              key={sort}
              onClick={() => onSearch(sort)}
              className="px-2 py-0.5 rounded text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            >
              {sort === 'rating' ? '评分' : sort === 'return' ? 'components.returnRate' : '最新'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceSearch;
