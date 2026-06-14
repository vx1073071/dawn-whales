/**
 * R161 ML: MyStrategies — Strategy list with filter, sort, delete
 * Shows strategy cards with status badges and actions.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface StrategyItem {
  id: string;
  name?: string;
  nameCn?: string;
  category?: string;
  status?: string;
  tags?: string[];
  updatedAt?: string | number;
  createdAt?: string | number;
  totalReturn?: number;
  sharpeRatio?: number;
}

interface Props {
  strategies: StrategyItem[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCompare: (strategy: StrategyItem) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  momentum: '动量', mean_reversion: '均值回归', breakout: '突破',
  pairs: '配对交易', options: '期权', multi_factor: '多因子',
};

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-emerald-500/20 text-emerald-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  stopped: 'bg-gray-500/20 text-gray-400',
  backtest: 'bg-blue-500/20 text-blue-400',
  draft: 'bg-white/5 text-gray-500',
};

export const MyStrategies: React.FC<Props> = ({ strategies, onSelect, onEdit, onDelete, onCompare }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<'recent' | 'return' | 'sharpe'>('recent');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const categories: string[] = ['all', ...new Set(strategies.map((s) => s.category).filter((c): c is string => !!c))];

  const filtered = strategies
    .filter((s) => filter === 'all' || s.category === filter)
    .sort((a, b) => {
      if (sort === 'return') return (b.totalReturn || 0) - (a.totalReturn || 0);
      if (sort === 'sharpe') return (b.sharpeRatio || 0) - (a.sharpeRatio || 0);
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });

  if (strategies.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📭</div>
        <h3 className="text-lg font-semibold text-white mb-1">{t('MyStrategies.emptyTitle', '还没有策略')}</h3>
        <p className="text-sm text-gray-500">{t('MyStrategies.emptyDesc', '选择上方一种方式创建你的第一个量化策略')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter & Sort bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                filter === c ? 'bg-[#C9A046] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {c === 'all' ? t('MyStrategies.filterAll', '全部') : (CATEGORY_LABELS[c] || c)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {(['recent', 'return', 'sharpe'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2 py-1 rounded text-[10px] transition-all ${
                sort === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'recent' ? t('MyStrategies.sortRecent', '最近') : s === 'return' ? t('MyStrategies.sortReturn', '收益') : t('MyStrategies.sortSharpe', '夏普')}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/10 hover:bg-[#1a1a28] transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {s.nameCn || s.name || s.id}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {s.category && (
                    <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                      {CATEGORY_LABELS[s.category] || s.category}
                    </span>
                  )}
                  {s.status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[s.status] || 'text-gray-500'}`}>
                      {s.status}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}
                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white text-xs"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onCompare(s); }}
                  className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-[#C9A046] text-xs"
                  title="Compare"
                >
                  ⚖️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteConfirm === s.id) { onDelete(s.id); setDeleteConfirm(null); }
                    else { setDeleteConfirm(s.id); setTimeout(() => setDeleteConfirm(null), 3000); }
                  }}
                  className={`p-1 rounded text-xs transition-all ${
                    deleteConfirm === s.id
                      ? 'bg-red-500/20 text-red-400'
                      : 'hover:bg-white/10 text-gray-500 hover:text-red-400'
                  }`}
                  title="Delete"
                >
                  {deleteConfirm === s.id ? '🗑️✓' : '🗑️'}
                </button>
              </div>
            </div>

            {/* Mini stats */}
            <div className="flex gap-4 text-xs">
              {s.totalReturn !== undefined && (
                <div>
                  <span className="text-gray-500">{t('MyStrategies.return', '收益')}</span>
                  <span className={`ml-1 font-mono font-medium ${(s.totalReturn || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(s.totalReturn || 0) >= 0 ? '+' : ''}{((s.totalReturn || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {s.sharpeRatio !== undefined && (
                <div>
                  <span className="text-gray-500">Sharpe</span>
                  <span className="ml-1 font-mono text-gray-300">{(s.sharpeRatio || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {s.tags && s.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {s.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-[10px] text-gray-600 bg-white/[0.03] px-1.5 py-0.5 rounded">{tag}</span>
                ))}
                {s.tags.length > 3 && (
                  <span className="text-[10px] text-gray-600">+{s.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 text-center">
        {t('MyStrategies.count', { count: filtered.length, total: strategies.length })}
      </p>
    </div>
  );
};

export default MyStrategies;
