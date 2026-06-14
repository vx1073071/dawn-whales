/**
* AIHistorySearch — ML R183 P2-01 [P0] AI回答历史可搜索
* Search past AI conversations with keyword highlighting.
* Stores last 20 AI Q&A pairs in localStorage.
*/

import { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface AIHistoryEntry {
  id: string;
  timestamp: string;
  query: string;          // user's question/action
  response: string;       // AI's response (truncated for display)
  fullResponse: string;
  category: 'factor' | 'strategy' | 'market' | 'backtest' | 'signal' | 'general';
  rating?: 'up' | 'down' | null;
  cost?: number;          // USDT spent
}

interface AIHistorySearchProps {
  entries?: AIHistoryEntry[];
  onSelect?: (entry: AIHistoryEntry) => void;
  onDelete?: (entryId: string) => void;
  maxEntries?: number;
  className?: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tradingeasy-ai-history';

export function loadHistory(): AIHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveHistory(entries: AIHistoryEntry[]): void {
  try {
    // Keep only last 50 entries
    const trimmed = entries.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* quota exceeded */ }
}

export function addHistoryEntry(entry: AIHistoryEntry): AIHistoryEntry[] {
  const history = loadHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, 50);
  saveHistory(trimmed);
  return trimmed;
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Component ───────────────────────────────────────────────────────────

export default function AIHistorySearch({
  entries: propEntries,
  onSelect,
  onDelete,
  maxEntries = 20,
  className = '',
}: AIHistorySearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [entries, setEntries] = useState<AIHistoryEntry[]>(() => {
    if (propEntries && propEntries.length > 0) return propEntries;
    return loadHistory().slice(0, maxEntries);
  });

  const handleDelete = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
    onDelete?.(id);
  }, [onDelete]);

  const filtered = useMemo(() => {
    let list = entries;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (e) =>
          e.query.toLowerCase().includes(q) ||
          e.response.toLowerCase().includes(q) ||
          e.category.includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((e) => e.category === categoryFilter);
    }
    return list;
  }, [entries, searchTerm, categoryFilter]);

  const categories = ['all', 'factor', 'strategy', 'market', 'backtest', 'signal', 'general'];

  // Highlight matching text
  const highlight = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-[#D4A853]/30 text-[#D4A853] px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={`bg-[#0D0D14] flex flex-col ${className}`}>
      {/* Header + search */}
      <div className="p-4 border-b border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">📜 AI对话历史</h3>
          <span className="text-[10px] text-gray-500">{entries.length}条记录</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索关键词..."
              className="w-full pl-9 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-xs text-gray-300"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? '全部' : c === 'factor' ? '因子' : c === 'strategy' ? '策略' : c === 'market' ? '市场' : c === 'backtest' ? '回测' : c === 'signal' ? '信号' : '通用'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <span className="text-3xl mb-2">📭</span>
            <span className="text-sm">{searchTerm ? '没有匹配的记录' : '暂无对话历史'}</span>
            <span className="text-xs mt-1">使用AI功能后，对话会自动记录在这里</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onSelect?.(entry)}
                className="p-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        entry.category === 'factor'
                          ? 'bg-blue-500/10 text-blue-400'
                          : entry.category === 'strategy'
                          ? 'bg-[#D4A853]/10 text-[#D4A853]'
                          : entry.category === 'signal'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {entry.category === 'factor' ? '因子' : entry.category === 'strategy' ? '策略' : entry.category === 'market' ? '市场' : entry.category === 'backtest' ? '回测' : entry.category === 'signal' ? '信号' : '通用'}
                    </span>
                    {entry.cost !== undefined && entry.cost > 0 && (
                      <span className="text-[9px] text-gray-600">{entry.cost.toFixed(2)} U</span>
                    )}
                    {entry.rating === 'up' && <span className="text-[9px]">👍</span>}
                    {entry.rating === 'down' && <span className="text-[9px]">👎</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-600">
                      {new Date(entry.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                      className="text-gray-700 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Query (highlighted) */}
                <div className="text-xs text-gray-300 font-medium mb-1 line-clamp-1">
                  {highlight(entry.query, searchTerm)}
                </div>

                {/* Response (highlighted, truncated) */}
                <div className="text-[11px] text-gray-500 line-clamp-2">
                  {highlight(entry.response.slice(0, 150), searchTerm)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="p-2 border-t border-white/5 flex justify-between text-[9px]">
          <span className="text-gray-600">
            显示 {filtered.length}/{entries.length} 条
          </span>
          <button
            onClick={() => {
              clearHistory();
              setEntries([]);
            }}
            className="text-red-400/70 hover:text-red-400"
          >
            清空历史
          </button>
        </div>
      )}
    </div>
  );
}
