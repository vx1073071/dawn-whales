// @ts-nocheck
// ── R186 ML P2-02: FactorSearch — 人说人话，因子听懂 ──────────────────
// Natural language → factor mapping. User types "便宜好公司" and gets
// BOOK_TO_PRICE + EARNINGS_YIELD + QUAL. No technical knowledge required.
//
// Design:
// - Fuzzy keyword mapping with CN/EN bilingual support
// - Semantic categories (便宜→value, 赚钱→quality, 涨→momentum, etc.)
// - Search history (last 10 queries, localStorage)
// - Includes all 35 entry factors + extends to advanced factors
// - Debounced search (300ms) for smooth UX

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { FactorLevel } from './FactorLevelSelector';
import type { FactorMarket } from './FactorMarketSwitch';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FactorSearchResult {
  factorId: string;
  nameCN: string;
  category: string;
  level: FactorLevel;
  markets: FactorMarket[];
  matchedTerms: string[];    // which keywords matched
  matchType: 'exact' | 'semantic' | 'category';
  relevanceScore: number;    // 0-100
  description: string;
}

interface FactorSearchProps {
  /** All available factors to search */
  factors: Array<{
    id: string;
    nameCN: string;
    category: string;
    level?: FactorLevel;
    markets?: FactorMarket[];
    description?: string;
  }>;
  /** Current market filter */
  activeMarket?: FactorMarket;
  /** Called when user selects a result */
  onSelect?: (result: FactorSearchResult) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Additional class */
  className?: string;
}

// ── Keyword-to-factor semantic map ───────────────────────────────────────────

// Each keyword group maps to factor categories and IDs.
// User says "便宜" → we match value factors.
const SEMANTIC_MAP: Record<string, {
  keywords: string[];
  categories: string[];
  factorIds: string[];
  description: string;
}> = {
  cheap: {
    keywords: ['便宜', '低估', '打折', '低价', '划算', '便宜好公司', '烟蒂', '价值', 'cheap', 'undervalued', 'value', 'bargain'],
    categories: ['value'],
    factorIds: ['HML', 'YIELD'],
    description: '低估值因子：找被市场低估的公司',
  },
  quality: {
    keywords: ['优质', '好公司', '品质', '高ROE', '赚钱', '盈利强', '质量', '蓝筹', '白马', '龙头', 'quality', 'profitable', 'bluechip'],
    categories: ['quality'],
    factorIds: ['QUAL', 'RMW', 'CMA'],
    description: '品质因子：找盈利能力强的优质公司',
  },
  momentum: {
    keywords: ['涨', '强势', '趋势', '动能', '动量', '上涨', '涨幅', '领涨', '强者恒强', 'momentum', 'trend', 'strength'],
    categories: ['momentum'],
    factorIds: ['MOM_12M', 'MOM_1M'],
    description: '动量因子：找趋势延续的强势股',
  },
  growth: {
    keywords: ['成长', '增长', '高增长', '扩张', '爆发', '翻倍', '成长股', 'growth', 'AI', '科技'],
    categories: ['growth'],
    factorIds: ['GROWTH'],
    description: '成长因子：找营收盈利双增长的公司',
  },
  defense: {
    keywords: ['防御', '防守', '安全', '稳', '低风险', '稳定', '避险', '安全港', '避风港', 'defense', 'safe', 'stable', 'conservative'],
    categories: ['volatility'],
    factorIds: ['VOL_60D', 'QUAL', 'YIELD'],
    description: '防御因子：低波动+高品质，熊市避风港',
  },
  dividend: {
    keywords: ['股息', '分红', '派息', '高息', '收息', '吃息', 'dividend', 'income', 'yield'],
    categories: ['yield'],
    factorIds: ['YIELD'],
    description: '股息因子：找高分红公司',
  },
  technical: {
    keywords: ['金叉', '死叉', 'MACD', 'RSI', '超买', '超卖', '布林', 'KDJ', '均线', '技术', 'technical', 'golden cross'],
    categories: ['technical'],
    factorIds: ['EMA_12_26', 'RSI_14', 'BOLL', 'KDJ', 'MA_20_60'],
    description: '技术面因子：经典技术指标',
  },
  crypto: {
    keywords: ['比特币', '以太坊', 'BTC', 'ETH', '加密货币', '加密', '永续', '合约', '链上', 'crypto', 'bitcoin', 'ethereum', 'defi'],
    categories: ['crypto'],
    factorIds: ['CRYPTO_FUNDING', 'CRYPTO_OI_DELTA', 'CRYPTO_EXCHANGE_FLOW', 'CRYPTO_NVT', 'CRYPTO_ACTIVE_ADDR', 'CRYPTO_LIQUIDATIONS'],
    description: '加密货币因子：链上+衍生品指标',
  },
  hk: {
    keywords: ['港股', '南向', '北向', '港股通', 'AH', '窝轮', '牛熊', '恒指', 'HK', '香港', 'hongkong'],
    categories: ['hk_specific'],
    factorIds: ['HKEX_SOUTHBOUND', 'HKEX_CBCS_PREMIUM', 'HKEX_WARRANT_IV', 'HKEX_DLHB', 'HKEX_FUND_HOLD'],
    description: '港股专属因子：南向资金+窝轮+AH溢价',
  },
  us: {
    keywords: ['美股', 'VIX', '标普', '做空', '逼空', '回购', '机构', '13F', 'US', 'america', 'sp500', 'nasdaq'],
    categories: ['us_specific'],
    factorIds: ['US_VIX', 'US_SHORT_RATIO', 'US_INST_HOLD', 'US_BUYBACK', 'OPTION_PCR'],
    description: '美股专属因子：VIX+做空+机构+回购',
  },
  bear: {
    keywords: ['熊市', '跌', '下跌', '回调', '崩盘', '暴跌', '恐慌', 'bear', 'crash', 'correction', 'panic'],
    categories: ['volatility', 'value'],
    factorIds: ['US_VIX', 'VOL_60D', 'QUAL', 'YIELD', 'HML'],
    description: '熊市相关因子：防御+价值+恐慌指数',
  },
  bull: {
    keywords: ['牛市', '暴涨', '反弹', '冲破', '新高', 'bull', 'rally', 'surge', 'ath'],
    categories: ['momentum', 'growth'],
    factorIds: ['MOM_12M', 'GROWTH', 'MOM_1M', 'EMA_12_26'],
    description: '牛市相关因子：动量+成长+趋势确认',
  },
  sentiment: {
    keywords: ['情绪', '恐慌', '贪婪', '散户', '拥挤', '情绪', 'sentiment', 'fear', 'greed'],
    categories: ['sentiment'],
    factorIds: ['OPTION_PCR', 'US_VIX', 'CRYPTO_FUNDING'],
    description: '情绪因子：市场恐慌/贪婪温度计',
  },
  small: {
    keywords: ['小盘', '中小盘', '小市值', '微盘', 'small cap', 'micro cap'],
    categories: ['size'],
    factorIds: ['SIZE'],
    description: '小盘因子：小市值溢价效应',
  },
  event: {
    keywords: ['财报', '业绩', '公告', '事件', '回购', '增持', 'earnings', 'event', 'announcement', 'buyback'],
    categories: ['us_specific', 'hk_specific'],
    factorIds: ['US_BUYBACK', 'HKEX_DLHB'],
    description: '事件驱动因子：财报+回购+特别事件',
  },
  smartMoney: {
    keywords: ['聪明钱', '主力', '机构', '基金', '大单', '北向', '南向', 'smart money', 'institution', 'whale'],
    categories: ['sentiment', 'hk_specific', 'us_specific'],
    factorIds: ['US_INST_HOLD', 'HKEX_SOUTHBOUND', 'HKEX_FUND_HOLD'],
    description: '聪明钱因子：机构/基金/北向南向持仓',
  },
};

const LOCAL_HISTORY_KEY = 'tradingeasy-factor-search-history';
const MAX_HISTORY = 10;

// ── Search function ──────────────────────────────────────────────────────────

export function searchFactors(
  query: string,
  factors: FactorSearchProps['factors']
): FactorSearchResult[] {
  if (!query.trim()) return [];

  const results: Map<string, FactorSearchResult> = new Map();
  const qLower = query.toLowerCase();

  // Phase 1: Semantic keyword matching
  for (const [groupKey, group] of Object.entries(SEMANTIC_MAP)) {
    let bestKeyword = '';
    let bestMatch: 'exact' | 'semantic' | 'category' = 'semantic';

    for (const kw of group.keywords) {
      const kwLower = kw.toLowerCase();
      if (qLower === kwLower) {
        bestKeyword = kw;
        bestMatch = 'exact';
        break;
      }
      if (qLower.includes(kwLower) || kwLower.includes(qLower)) {
        bestKeyword = kw;
        bestMatch = 'semantic';
        break;
      }
    }

    if (!bestKeyword) {
      // Check if query matches any category name
      if (group.categories.some(c => qLower.includes(c.toLowerCase()))) {
        bestMatch = 'category';
        bestKeyword = group.categories[0];
      }
    }

    if (!bestKeyword) continue;

    // Add matched factor IDs
    for (const fid of group.factorIds) {
      const factor = factors.find(f => f.id === fid);
      if (factor && !results.has(fid)) {
        const score = bestMatch === 'exact' ? 100 : bestMatch === 'semantic' ? 75 : 50;
        results.set(fid, {
          factorId: fid,
          nameCN: factor.nameCN,
          category: factor.category,
          level: factor.level || 'L1',
          markets: factor.markets || ['US', 'HK'],
          matchedTerms: [bestKeyword],
          matchType: bestMatch,
          relevanceScore: score,
          description: group.description,
        });
      }
    }

    // Also match by category for category-level hits
    if (bestMatch === 'category') {
      for (const cat of group.categories) {
        for (const factor of factors) {
          if (factor.category === cat && !results.has(factor.id)) {
            results.set(factor.id, {
              factorId: factor.id,
              nameCN: factor.nameCN,
              category: factor.category,
              level: factor.level || 'L1',
              markets: factor.markets || ['US', 'HK'],
              matchedTerms: [cat],
              matchType: 'category',
              relevanceScore: 40,
              description: `属于${cat}类别的因子`,
            });
          }
        }
      }
    }
  }

  // Phase 2: Direct text search (name, ID, description)
  for (const factor of factors) {
    if (results.has(factor.id)) continue;

    const nameMatch = factor.nameCN.toLowerCase().includes(qLower);
    const idMatch = factor.id.toLowerCase().includes(qLower);
    const descMatch = factor.description?.toLowerCase().includes(qLower);

    if (nameMatch || idMatch || descMatch) {
      const score = nameMatch ? 60 : idMatch ? 45 : 30;
      results.set(factor.id, {
        factorId: factor.id,
        nameCN: factor.nameCN,
        category: factor.category,
        level: factor.level || 'L1',
        markets: factor.markets || ['US', 'HK'],
        matchedTerms: [query],
        matchType: 'semantic',
        relevanceScore: score,
        description: factor.description || `${factor.nameCN}因子`,
      });
    }
  }

  // Sort by relevance score descending
  return Array.from(results.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorSearch: React.FC<FactorSearchProps> = ({
  factors,
  activeMarket,
  onSelect,
  placeholder = '说人话搜索因子… 如"便宜好公司"、"熊市防御"',
  autoFocus = false,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]'); }
    catch { return []; }
  });
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const results = useMemo(() => {
    const r = searchFactors(debouncedQuery, factors);
    // Filter by market if set
    if (activeMarket && activeMarket !== 'ALL') {
      return r.filter(f => f.markets.includes(activeMarket));
    }
    return r;
  }, [debouncedQuery, factors, activeMarket]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowResults(false);
      inputRef.current?.blur();
    }
  }, [showResults, results, selectedIndex]);

  const handleSelect = useCallback((result: FactorSearchResult) => {
    // Save to history
    const newHistory = [query, ...history.filter(h => h !== query)].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    try { localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(newHistory)); } catch {}

    onSelect?.(result);
    setQuery('');
    setShowResults(false);
    setSelectedIndex(-1);
  }, [query, history, onSelect]);

  const matchTypeLabels: Record<string, { icon: string; label: string; color: string }> = {
    exact: { icon: '🎯', label: '精确', color: '#22c55e' },
    semantic: { icon: '💡', label: '语义', color: '#3b82f6' },
    category: { icon: '📂', label: '分类', color: '#a855f7' },
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); setSelectedIndex(-1); }}
          onFocus={() => query && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-white/[0.03] border border-white/5 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4A853]/40 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setShowResults(false); setSelectedIndex(-1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (debouncedQuery || history.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a25] border border-white/10 rounded-lg shadow-2xl max-h-[380px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] text-gray-600">
                找到 {results.length} 个相关因子
              </div>
              {results.map((r, i) => {
                const mt = matchTypeLabels[r.matchType];
                return (
                  <button
                    key={r.factorId}
                    className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] transition-colors flex items-center gap-3 ${
                      i === selectedIndex ? 'bg-white/[0.08]' : ''
                    }`}
                    onMouseDown={() => handleSelect(r)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      r.relevanceScore >= 80 ? 'bg-green-500' :
                      r.relevanceScore >= 50 ? 'bg-blue-500' : 'bg-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{r.nameCN}</span>
                        <span className="text-[10px] text-gray-600 font-mono">{r.factorId}</span>
                        <span
                          className="text-[9px] px-1 py-0.5 rounded"
                          style={{ backgroundColor: mt.color + '15', color: mt.color }}
                        >
                          {mt.icon} {mt.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{r.description}</p>
                    </div>
                    <div className="text-[10px] text-gray-600 flex items-center gap-0.5">
                      {r.matchedTerms.slice(0, 2).map(t => (
                        <span key={t} className="bg-white/[0.04] px-1 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : history.length > 0 && !debouncedQuery ? (
            /* Show history when no query */
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] text-gray-600 flex justify-between">
                <span>最近搜索</span>
                <button
                  onMouseDown={() => { setHistory([]); try { localStorage.removeItem(LOCAL_HISTORY_KEY); } catch {} }}
                  className="text-gray-700 hover:text-gray-500"
                >清除</button>
              </div>
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 hover:bg-white/[0.05] text-xs text-gray-400 flex items-center gap-2"
                  onMouseDown={() => { setQuery(h); }}
                >
                  <span className="text-gray-600">🕐</span> {h}
                </button>
              ))}
            </div>
          ) : debouncedQuery ? (
            <div className="px-3 py-4 text-center text-xs text-gray-600">
              未找到匹配的因子 — 试试"便宜好公司"、"熊市防御"、"港股"
            </div>
          ) : null}

          {/* Semantic tips */}
          {results.length === 0 && debouncedQuery && (
            <div className="px-3 py-3 border-t border-white/5">
              <p className="text-[10px] text-gray-600">💡 试试这样说：</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['便宜好公司', '强势上涨', '熊市防御', '高分红', '金叉', '加密趋势', '聪明钱', '小盘爆发'].map(tip => (
                  <button
                    key={tip}
                    className="text-[9px] px-2 py-1 rounded-full bg-white/[0.03] text-gray-500 hover:text-[#D4A853] border border-white/5 hover:border-[#D4A853]/30 transition-colors"
                    onMouseDown={() => { setQuery(tip); }}
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Semantic tips when empty */}
      {!query && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-[9px] text-gray-700">💡 说人话：</span>
          {['便宜好公司', '强势上涨', '熊市防御', '高分红', '金叉', '加密趋势', '聪明钱', '小盘爆发'].map(tip => (
            <button
              key={tip}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.02] text-gray-600 hover:text-[#D4A853] border border-white/5 hover:border-[#D4A853]/20 transition-colors"
              onClick={() => { setQuery(tip); }}
            >
              {tip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FactorSearch;
