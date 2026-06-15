// ── R189 ML P5-03: FactorSearchBarV2 — 三模式搜索升级 ─────────────────
// Upgrades FactorSearch with 3 search modes:
// 1. NL (自然语言): "便宜好公司" → semantic factor mapping (existing)
// 2. ID (精确搜索): "MOM_12M" / "ROIC" → direct factor ID match
// 3. TAG (标签过滤): "价值" / "低波" / "情绪" / "加密" → category filter
//
// Auto-detects mode from input:
// - ALL CAPS + underscores/digits → ID mode
// - Single CN word (2-4 chars) matching category names → TAG mode
// - Longer CN phrases → NL mode
//
// New features:
// - Mode indicator badge in search bar
// - Tab to cycle modes
// - Recent searches + popular searches
// - Category tag cloud (click to filter)
// - Keyboard shortcut: / to focus search (Cmd+K style)

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FactorSearch, searchFactors, type FactorSearchResult } from './FactorSearch';

// ── Types ────────────────────────────────────────────────────────────────────

export type SearchMode = 'auto' | 'nl' | 'id' | 'tag';

interface FactorSearchBarV2Props {
  factors: Array<{
    id: string;
    nameCN: string;
    category: string;
    description?: string;
  }>;
  onSelect?: (result: FactorSearchResult) => void;
  /** Available tags for tag mode */
  tags?: Array<{ key: string; label: string; count: number }>;
  className?: string;
}

// ── Category tag map (CN→key) ───────────────────────────────────────────────

const TAG_MAP: Record<string, string> = {
  '动量': 'momentum', '价值': 'value', '品质': 'quality', '低波': 'volatility',
  '技术': 'technical', '情绪': 'sentiment', '成长': 'growth', '股息': 'yield',
  '规模': 'size', '港股': 'hk_specific', '美股': 'us_specific', '加密': 'crypto',
  '宏观': 'macro', '事件': 'event',
  '防御': 'volatility', '防守': 'volatility', '熊市': 'volatility',
  '牛市': 'momentum', '强势': 'momentum', '弱势': 'volatility',
};

// ── Mode detector ────────────────────────────────────────────────────────────

function detectSearchMode(query: string): SearchMode {
  if (!query.trim()) return 'auto';
  const trimmed = query.trim();

  // ID mode: ALL CAPS or contains underscore or known factor IDs
  if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) return 'id';
  if (/^[A-Z]/.test(trimmed) && trimmed.length <= 15) return 'id';

  // Tag mode: single short CN word matching known tags
  if (TAG_MAP[trimmed] && trimmed.length <= 4) return 'tag';

  return 'nl';
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorSearchBarV2: React.FC<FactorSearchBarV2Props> = ({
  factors,
  onSelect,
  tags: customTags,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('auto');
  const [showTagCloud, setShowTagCloud] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tradingeasy-search-history-v2') || '[]'); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const detectedMode = useMemo(() => detectSearchMode(query), [query]);
  const effectiveMode = mode === 'auto' ? detectedMode : mode;

  // Tags from data
  const tags = useMemo(() => {
    if (customTags) return customTags;
    const tagCounts = new Map<string, number>();
    for (const f of factors) {
      tagCounts.set(f.category, (tagCounts.get(f.category) || 0) + 1);
    }
    const tagLabels: Record<string, string> = {
      momentum: '动量', value: '价值', quality: '品质', volatility: '低波',
      technical: '技术', sentiment: '情绪', growth: '成长', yield: '股息',
      size: '规模', hk_specific: '港股', us_specific: '美股', crypto: '加密',
      macro: '宏观',
    };
    return Array.from(tagCounts.entries()).map(([key, count]) => ({
      key, label: tagLabels[key] || key, count,
    }));
  }, [factors, customTags]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = useCallback((result: FactorSearchResult) => {
    const q = query.trim();
    if (q) {
      const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 15);
      setHistory(newHistory);
      try { localStorage.setItem('tradingeasy-search-history-v2', JSON.stringify(newHistory)); } catch {}
    }
    onSelect?.(result);
    setQuery('');
  }, [query, history, onSelect]);

  const handleTagClick = useCallback((tagKey: string) => {
    // Find tag label
    const tag = tags.find(t => t.key === tagKey);
    if (tag) {
      setQuery(tag.label);
      setMode('tag');
    }
  }, [tags]);

  // ID mode results
  const idResults = useMemo(() => {
    if (effectiveMode !== 'id' || !query.trim()) return [];
    const q = query.trim().toUpperCase();
    return factors
      .filter(f => f.id.toUpperCase().includes(q) || f.nameCN.includes(query.trim()))
      .slice(0, 10)
      .map(f => ({
        factorId: f.id,
        nameCN: f.nameCN,
        category: f.category,
        level: 'L1' as const,
        markets: ['US', 'HK'] as any[],
        matchedTerms: [query.trim()],
        matchType: 'exact' as const,
        relevanceScore: f.id.toUpperCase() === q ? 100 : 70,
        description: `${f.nameCN}因子 — 类别: ${f.category}`,
      }));
  }, [effectiveMode, query, factors]);

  const modeLabels: Record<SearchMode, { icon: string; label: string; color: string }> = {
    auto: { icon: '🤖', label: '智能', color: '#D4A853' },
    nl: { icon: '💬', label: '人话', color: '#22c55e' },
    id: { icon: '🔤', label: 'ID', color: '#3b82f6' },
    tag: { icon: '🏷️', label: '标签', color: '#a855f7' },
  };

  const ml = modeLabels[effectiveMode];

  return (
    <div className={`${className}`}>
      {/* Search bar with mode indicator */}
      <div className="relative">
        <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg focus-within:border-[#D4A853]/40 transition-colors">
          {/* Mode badge */}
          <div className="pl-3 flex items-center gap-1.5">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1"
              style={{ backgroundColor: ml.color + '15', color: ml.color, border: `1px solid ${ml.color}30` }}
            >
              {ml.icon} {ml.label}
            </span>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={effectiveMode === 'tag' ? '点击标签或输入分类名…' : effectiveMode === 'id' ? '输入因子ID (如 MOM_12M) …' : '说人话搜索因子 (如 "便宜好公司") …'}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
          />

          {/* Cmd+K hint */}
          <div className="pr-3 flex items-center gap-1">
            <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-600 border border-white/5">⌘K</kbd>
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-600 hover:text-gray-400 text-xs ml-1">✕</button>
            )}
          </div>
        </div>

        {/* Mode toggle tabs */}
        <div className="flex gap-1 mt-2">
          {(['auto', 'nl', 'id', 'tag'] as SearchMode[]).map(m => {
            const lm = modeLabels[m];
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[9px] px-2 py-1 rounded-full transition-all ${
                  mode === m
                    ? 'font-bold'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
                style={{
                  backgroundColor: mode === m ? lm.color + '15' : 'transparent',
                  color: mode === m ? lm.color : undefined,
                  border: mode === m ? `1px solid ${lm.color}30` : '1px solid transparent',
                }}
              >
                {lm.icon} {lm.label}
              </button>
            );
          })}

          {/* Tag cloud toggle */}
          <button
            onClick={() => setShowTagCloud(!showTagCloud)}
            className={`text-[9px] px-2 py-1 rounded-full ml-auto transition-all ${
              showTagCloud ? 'bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/30' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            🏷️ 标签云
          </button>
        </div>

        {/* Tag cloud */}
        {showTagCloud && (
          <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag.key}
                  onClick={() => handleTagClick(tag.key)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.03] text-gray-400 border border-white/5 hover:border-white/15 hover:text-white transition-colors"
                >
                  {tag.label} ({tag.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* History + Popular quick searches */}
        {!query && history.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] text-gray-700">最近:</span>
            {history.slice(0, 5).map((h, i) => (
              <button
                key={i}
                onClick={() => setQuery(h)}
                className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.02] text-gray-500 border border-white/5 hover:text-[#D4A853] hover:border-[#D4A853]/30 transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        {/* ID mode instant results */}
        {effectiveMode === 'id' && idResults.length > 0 && (
          <div className="mt-2 rounded-lg bg-[#1a1a25] border border-white/10 p-2 max-h-[200px] overflow-y-auto">
            {idResults.map(r => (
              <button
                key={r.factorId}
                onClick={() => handleSelect(r)}
                className="w-full text-left px-2 py-1.5 hover:bg-white/[0.05] rounded flex items-center gap-2 text-xs"
              >
                <span className="font-mono text-blue-400">{r.factorId}</span>
                <span className="text-white">{r.nameCN}</span>
                <span className="text-gray-600 ml-auto">{r.category}</span>
              </button>
            ))}
          </div>
        )}

        {/* NL mode: delegate to FactorSearch */}
        {effectiveMode === 'nl' && query.trim() && (
          <div className="mt-2">
            <FactorSearch
              factors={factors.map(f => ({ id: f.id, nameCN: f.nameCN, category: f.category, description: f.description }))}
              onSelect={handleSelect}
              placeholder="" autoFocus={false}
            />
          </div>
        )}

        {/* Tag mode: filtered results */}
        {effectiveMode === 'tag' && query.trim() && (
          <div className="mt-2 rounded-lg bg-[#1a1a25] border border-white/10 p-3">
            <div className="text-[10px] text-gray-600 mb-2">
              标签"<span className="text-white">{query.trim()}</span>"的匹配因子:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const tagKey = TAG_MAP[query.trim()];
                if (!tagKey) return <span className="text-[10px] text-gray-600">未识别此标签，试试"价值""低波""加密"</span>;
                const matched = factors.filter(f => f.category === tagKey);
                if (matched.length === 0) return <span className="text-[10px] text-gray-600">该标签下暂无因子数据</span>;
                return matched.map(f => {
                  const result: FactorSearchResult = {
                    factorId: f.id,
                    nameCN: f.nameCN,
                    category: f.category,
                    level: 'L1',
                    markets: ['US', 'HK'],
                    matchedTerms: [query.trim()],
                    matchType: 'category',
                    relevanceScore: 80,
                    description: `${f.nameCN}因子`,
                  };
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelect(result)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.03] text-gray-300 border border-white/5 hover:border-white/15 hover:bg-white/[0.06] transition-colors"
                    >
                      {f.nameCN} <span className="text-gray-600 font-mono">{f.id}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactorSearchBarV2;
