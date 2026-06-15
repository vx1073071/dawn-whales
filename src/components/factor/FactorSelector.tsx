// ── R227 ML-2.2a: FactorSelector — 3-level factor browsing UI ────
// Level 1: 16 major categories (Classic/Fundamental/Analyst/Sentiment/...)
// Level 2: 55 sub-categories (Trend/Oscillator/Volatility/Volume...)
// Level 3: Factor cards with name/description/signal/region
// Search + filter + keyboard nav + 11-lang i18n

import React, { useState, useMemo, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface FactorCardData {
  id: string;
  nameEn: string;
  nameCn: string;
  level1: string;
  level2: string;
  region: string;
  description?: string;
}

export interface FactorSelectorProps {
  factors: FactorCardData[];
  onSelect?: (factorId: string) => void;
  onMultiSelect?: (factorIds: string[]) => void;
  selected?: string[];
  multiSelect?: boolean;
  maxSelect?: number;
  locale?: string;
  compact?: boolean;
}

// ── L1 Category definitions ────────────────────────────────────────
const CATEGORIES: Record<string, { icon: string; label: Record<string, string>; desc: Record<string, string> }> = {
  L1_CLASSIC: { icon: '📊', label: { 'zh-CN': '经典因子', en: 'Classic Factors', ja: '古典因子' }, desc: { 'zh-CN': 'Fama-French + Carhart 经典多因子', en: 'Fama-French + Carhart multi-factor', ja: 'Fama-French + Carhartマルチファクター' } },
  L1_FUNDAMENTAL: { icon: '📋', label: { 'zh-CN': '基本面', en: 'Fundamental', ja: 'ファンダメンタル' }, desc: { 'zh-CN': '盈利质量/收益率/风险结构/效率/健康度', en: 'Profit quality/yield/risk/efficiency/health', ja: '利益品質/利回り/リスク/効率/健全性' } },
  L1_ANALYST: { icon: '🔬', label: { 'zh-CN': '分析师', en: 'Analyst', ja: 'アナリスト' }, desc: { 'zh-CN': '评级变化/盈利修正/目标价', en: 'Rating changes/earnings revision/target price', ja: '格付変更/利益修正/目標株価' } },
  L1_SENTIMENT: { icon: '💬', label: { 'zh-CN': '市场情绪', en: 'Sentiment', ja: 'センチメント' }, desc: { 'zh-CN': '恐惧贪婪/期权/社交/资金流', en: 'Fear&greed/options/social/flow', ja: '恐怖欲/オプション/ソーシャル/フロー' } },
  L1_TECHNICAL: { icon: '📈', label: { 'zh-CN': '技术指标', en: 'Technical', ja: 'テクニカル' }, desc: { 'zh-CN': '趋势/振荡/波动/成交量', en: 'Trend/oscillator/volatility/volume', ja: 'トレンド/オシレーター/ボラ/出来高' } },
  L1_RISK: { icon: '⚠️', label: { 'zh-CN': '风险与尾部', en: 'Risk & Tail', ja: 'リスク＆テール' }, desc: { 'zh-CN': '波动率/流动性/下行/风险调整/结构性', en: 'Vol/liquidity/downside/risk-adjusted/structural', ja: 'ボラティリティ/流動性/下方/リスク調整' } },
  L1_MACRO: { icon: '🌍', label: { 'zh-CN': '宏观敏感度', en: 'Macro', ja: 'マクロ' }, desc: { 'zh-CN': '经济周期/汇率/利率/通胀/商品', en: 'Cycle/currency/rate/inflation/commodity', ja: '景気循環/為替/金利/インフレ/商品' } },
  L1_REVERSAL: { icon: '🔄', label: { 'zh-CN': '反转与季节性', en: 'Reversal', ja: 'リバーサル' }, desc: { 'zh-CN': '短期反转/长期反转/季节性/统计套利', en: 'Short-term/long-term/seasonal/stat-arb', ja: '短期/長期/季節性/統計的裁定' } },
  L1_US: { icon: '🇺🇸', label: { 'zh-CN': '美股专属', en: 'US Specific', ja: '米国特化' }, desc: { 'zh-CN': 'VIX/空头/机构/回购/财报/Meme', en: 'VIX/shorts/institutions/buyback/earnings', ja: 'VIX/空売り/機関/自社株買い/決算' } },
  L1_HK: { icon: '🇭🇰', label: { 'zh-CN': '港股专属', en: 'HK Specific', ja: '香港特化' }, desc: { 'zh-CN': '南向/AH溢价/涡轮/沽空/分红', en: 'Southbound/AH premium/warrants/short sell', ja: '南向き/AHプレミアム/ワラント/空売り' } },
  L1_CRYPTO: { icon: '₿', label: { 'zh-CN': '加密货币', en: 'Crypto', ja: '暗号資産' }, desc: { 'zh-CN': '资金费率/链上/衍生品/估值/情绪', en: 'Funding/on-chain/derivatives/valuation', ja: '資金調達/オンチェーン/デリバティブ' } },
  L1_CROSS_ASSET: { icon: '🔗', label: { 'zh-CN': '跨资产', en: 'Cross-Asset', ja: 'クロスアセット' }, desc: { 'zh-CN': '利差/Carry/相关性/动量', en: 'Carry/correlation/momentum/pricing', ja: 'キャリー/相関/モメンタム/価格' } },
  L1_EVENT: { icon: '📅', label: { 'zh-CN': '事件驱动', en: 'Event-Driven', ja: 'イベント駆動' }, desc: { 'zh-CN': '财报/回购/分红/指数调整/解禁', en: 'Earnings/buyback/dividend/index/rebalance', ja: '決算/自社株買い/配当/指数/リバランス' } },
  L1_ESG: { icon: '🌱', label: { 'zh-CN': 'ESG', en: 'ESG', ja: 'ESG' }, desc: { 'zh-CN': 'ESG综合/环境/治理/社会责任', en: 'Overall/environment/governance/social', ja: '総合/環境/ガバナンス/社会' } },
  L1_COMMODITY: { icon: '🛢️', label: { 'zh-CN': '商品期货', en: 'Commodity', ja: '商品先物' }, desc: { 'zh-CN': '期限结构/库存/COT/比价', en: 'Term structure/inventory/COT/ratios', ja: '期間構造/在庫/COT/比率' } },
  L1_LEGACY: { icon: '📦', label: { 'zh-CN': '已废弃', en: 'Legacy', ja: 'レガシー' }, desc: { 'zh-CN': '已弃用的历史因子', en: 'Deprecated factors', ja: '廃止された因子' } },
};

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    search: '搜索因子...', allCategories: '全部分类',
    selected: '已选', clear: '清空',
    noResults: '未找到匹配因子', noDesc: '请尝试其他搜索词',
    selectFactor: '点击选择因子', deselectFactor: '点击取消',
    regionGlobal: '全球', regionHK: '港股', regionUS: '美股', regionCrypto: '加密货币',
    addToStrategy: '加入策略', maxReached: '最多选择',
    browse: '按分类浏览', viewAll: '查看全部',
    factors: '因子', subCategories: '子分类',
  },
  en: {
    search: 'Search factors...', allCategories: 'All Categories',
    selected: 'Selected', clear: 'Clear',
    noResults: 'No matching factors', noDesc: 'Try different keywords',
    selectFactor: 'Click to select', deselectFactor: 'Click to deselect',
    regionGlobal: 'Global', regionHK: 'HK', regionUS: 'US', regionCrypto: 'Crypto',
    addToStrategy: 'Add to Strategy', maxReached: 'Max reached',
    browse: 'Browse Categories', viewAll: 'View All',
    factors: 'Factors', subCategories: 'Sub-Categories',
  },
  ja: {
    search: '因子を検索...', allCategories: '全カテゴリ',
    selected: '選択中', clear: 'クリア',
    noResults: '一致する因子がありません', noDesc: '別のキーワードをお試しください',
    selectFactor: 'クリックで選択', deselectFactor: 'クリックで解除',
    regionGlobal: 'グローバル', regionHK: '香港', regionUS: '米国', regionCrypto: '暗号資産',
    addToStrategy: '戦略に追加', maxReached: '上限到達',
    browse: 'カテゴリから探す', viewAll: 'すべて表示',
    factors: '因子', subCategories: 'サブカテゴリ',
  },
};

// ── Region badge colors ─────────────────────────────────────────────
const REGION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  global: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', text: '#58a6ff' },
  hk: { bg: 'rgba(240,136,62,0.1)', border: 'rgba(240,136,62,0.2)', text: '#f0883e' },
  us: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', text: '#3fb950' },
  crypto: { bg: 'rgba(163,113,247,0.1)', border: 'rgba(163,113,247,0.2)', text: '#a371f7' },
};

// ── Component ───────────────────────────────────────────────────────
const FactorSelector: React.FC<FactorSelectorProps> = ({
  factors, onSelect, onMultiSelect, selected = [], multiSelect, maxSelect = 10, locale: pl, compact,
}) => {
  const [search, setSearch] = useState('');
  const [activeL1, setActiveL1] = useState<string>('');
  const [viewMode, setViewMode] = useState<'browse' | 'all'>('browse');

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  // Group factors by L1
  const grouped = useMemo(() => {
    const map: Record<string, FactorCardData[]> = {};
    for (const f of factors) {
      if (!map[f.level1]) map[f.level1] = [];
      map[f.level1].push(f);
    }
    return map;
  }, [factors]);

  // Available L1 categories that have factors
  const availableL1 = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  // Active L1 (default to first if none selected)
  const effectiveL1 = activeL1 || availableL1[0] || '';

  // Filter factors by search
  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return factors.filter(f =>
      f.nameCn.toLowerCase().includes(q) ||
      f.nameEn.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    );
  }, [search, factors]);

  // Factors in current view
  const visibleFactors = viewMode === 'all' || search.trim()
    ? (filtered || factors)
    : (grouped[effectiveL1] || []);

  const handleSelect = useCallback((id: string) => {
    if (multiSelect && onMultiSelect) {
      if (selected.includes(id)) {
        onMultiSelect(selected.filter(s => s !== id));
      } else if (selected.length < maxSelect) {
        onMultiSelect([...selected, id]);
      }
    } else {
      onSelect?.(id);
    }
  }, [multiSelect, onMultiSelect, onSelect, selected, maxSelect]);

  return (
    <div style={{ background: '#0d1117', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.search}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', fontSize: 13, outline: 'none',
            }}
            aria-label={t.search}
          />
          {!compact && (
            <button
              onClick={() => setViewMode(m => m === 'all' ? 'browse' : 'all')}
              style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: '1px solid rgba(255,255,255,0.1)', background: viewMode === 'all' ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: viewMode === 'all' ? '#58a6ff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {viewMode === 'all' ? t.browse : t.viewAll}
            </button>
          )}
          {/* Selected count */}
          {multiSelect && selected.length > 0 && (
            <span style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 12,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              color: '#58a6ff',
            }}>
              {t.selected}: {selected.length}
              <button
                onClick={() => onMultiSelect?.([])}
                style={{ marginLeft: 6, padding: '1px 6px', cursor: 'pointer', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              >
                {t.clear}
              </button>
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* L1 Sidebar (only in browse mode) */}
        {viewMode === 'browse' && !search.trim() && !compact && (
          <div style={{
            width: 160, borderRight: '1px solid rgba(255,255,255,0.05)',
            overflowY: 'auto', padding: '8px 0', flexShrink: 0,
          }}>
            {availableL1.map(l1 => {
              const cat = CATEGORIES[l1];
              const count = grouped[l1]?.length || 0;
              const isActive = effectiveL1 === l1;
              return (
                <div
                  key={l1}
                  onClick={() => setActiveL1(l1)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                    background: isActive ? 'rgba(59,130,246,0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                    color: isActive ? '#e2e8f0' : 'rgba(255,255,255,0.5)',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') setActiveL1(l1); }}
                >
                  <span style={{ marginRight: 6 }}>{cat?.icon || '📌'}</span>
                  {cat?.label[langKey] || l1}
                  <span style={{ marginLeft: 4, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>({count})</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Factor cards area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '8px' : '12px' }}>
          {/* L1 header */}
          {!search.trim() && viewMode === 'browse' && effectiveL1 && !compact && (
            <div style={{ padding: '0 4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
                {CATEGORIES[effectiveL1]?.icon || ''} {CATEGORIES[effectiveL1]?.label[langKey] || effectiveL1}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {CATEGORIES[effectiveL1]?.desc[langKey] || ''}
              </div>
            </div>
          )}

          {/* Factor cards */}
          {visibleFactors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t.noResults}</div>
              <div style={{ fontSize: 11 }}>{t.noDesc}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: compact ? 6 : 8 }}>
              {visibleFactors.map(f => {
                const isSelected = selected.includes(f.id);
                const regionColor = REGION_COLORS[f.region] || REGION_COLORS.global;
                const regionLabel = t[`region${f.region === 'hk' ? 'HK' : f.region === 'us' ? 'US' : f.region === 'crypto' ? 'Crypto' : 'Global'}`] || f.region;

                return (
                  <div
                    key={f.id}
                    onClick={() => handleSelect(f.id)}
                    style={{
                      padding: compact ? '8px 10px' : '10px 12px', borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.05)'}`,
                      transition: 'all 0.15s',
                    }}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(f.id); } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12 }}>{f.nameCn}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: 9,
                        background: regionColor.bg, border: `1px solid ${regionColor.border}`, color: regionColor.text,
                      }}>
                        {regionLabel}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}>{f.id}</div>
                    {!compact && f.description && (
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 4, lineHeight: 1.3 }}>
                        {f.description}
                      </div>
                    )}
                    {isSelected && (
                      <div style={{ marginTop: 4, fontSize: 10, color: '#58a6ff' }}>✓ {t.addToStrategy}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Max reached warning */}
          {multiSelect && selected.length >= maxSelect && (
            <div style={{ padding: '8px 12px', marginTop: 8, borderRadius: 8, background: 'rgba(240,136,62,0.08)', border: '1px solid rgba(240,136,62,0.15)', color: '#f0883e', fontSize: 11, textAlign: 'center' }}>
              ⚠️ {t.maxReached}: {maxSelect}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FactorSelector;
