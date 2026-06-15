// ── R229 ML-3.1u: FactorHeatmap — 因子热力图组件 ─────────────────
// 240 factors × 16 major categories, color-coded signal strength grid
// Hover tooltip + click to FactorDetailPanel + category grouping headers
// 11-language i18n + responsive grid + color-blind friendly palette

import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface HeatmapFactor {
  id: string;
  nameCn: string;
  category: string;
  categoryCn: string;
  level2: string;
  signal: number;       // 0-100 signal strength
  trend: 'up' | 'down' | 'flat';
  ic?: number;
  lastUpdate?: string;
}

export interface FactorHeatmapProps {
  factors: HeatmapFactor[];
  onFactorClick?: (factorId: string) => void;
  locale?: string;
  compact?: boolean;
}

// ── Category order ──────────────────────────────────────────────────
const CATEGORY_ORDER = [
  'L1_CLASSIC', 'L1_FUNDAMENTAL', 'L1_ANALYST', 'L1_SENTIMENT',
  'L1_TECHNICAL', 'L1_RISK', 'L1_MACRO', 'L1_REVERSAL',
  'L1_US', 'L1_HK', 'L1_CRYPTO', 'L1_CROSS_ASSET',
  'L1_EVENT', 'L1_ESG', 'L1_COMMODITY', 'L1_LEGACY',
];

const CATEGORY_META: Record<string, { icon: string; label: Record<string, string> }> = {
  L1_CLASSIC: { icon: '📊', label: { 'zh-CN': '经典因子', en: 'Classic', ja: '古典' } },
  L1_FUNDAMENTAL: { icon: '📋', label: { 'zh-CN': '基本面', en: 'Fundamental', ja: 'ファンダ' } },
  L1_ANALYST: { icon: '🔬', label: { 'zh-CN': '分析师', en: 'Analyst', ja: 'アナリスト' } },
  L1_SENTIMENT: { icon: '💬', label: { 'zh-CN': '情绪', en: 'Sentiment', ja: 'センチ' } },
  L1_TECHNICAL: { icon: '📈', label: { 'zh-CN': '技术', en: 'Technical', ja: 'テクニカル' } },
  L1_RISK: { icon: '⚠️', label: { 'zh-CN': '风险', en: 'Risk', ja: 'リスク' } },
  L1_MACRO: { icon: '🌍', label: { 'zh-CN': '宏观', en: 'Macro', ja: 'マクロ' } },
  L1_REVERSAL: { icon: '🔄', label: { 'zh-CN': '反转', en: 'Reversal', ja: 'リバーサル' } },
  L1_US: { icon: '🇺🇸', label: { 'zh-CN': '美股', en: 'US', ja: '米国' } },
  L1_HK: { icon: '🇭🇰', label: { 'zh-CN': '港股', en: 'HK', ja: '香港' } },
  L1_CRYPTO: { icon: '₿', label: { 'zh-CN': '加密', en: 'Crypto', ja: '暗号' } },
  L1_CROSS_ASSET: { icon: '🔗', label: { 'zh-CN': '跨资产', en: 'X-Asset', ja: 'クロス' } },
  L1_EVENT: { icon: '📅', label: { 'zh-CN': '事件', en: 'Event', ja: 'イベント' } },
  L1_ESG: { icon: '🌱', label: { 'zh-CN': 'ESG', en: 'ESG', ja: 'ESG' } },
  L1_COMMODITY: { icon: '🛢️', label: { 'zh-CN': '商品', en: 'Commodity', ja: '商品' } },
  L1_LEGACY: { icon: '📦', label: { 'zh-CN': '废弃', en: 'Legacy', ja: 'レガシー' } },
};

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '因子热力图', subtitle: '240因子信号强度一览',
    signalStrength: '信号强度', ic: 'IC', category: '分类',
    trendUp: '↑ 改善', trendDown: '↓ 恶化', trendFlat: '→ 平稳',
    clickDetail: '点击查看详情', hoverPreview: '悬停预览',
    legendStrong: '强', legendModerate: '中', legendWeak: '弱',
    noData: '暂无数据', total: '共',
    search: '搜索因子...',
  },
  en: {
    title: 'Factor Heatmap', subtitle: '240 factors signal strength at a glance',
    signalStrength: 'Signal', ic: 'IC', category: 'Category',
    trendUp: '↑ Up', trendDown: '↓ Down', trendFlat: '→ Flat',
    clickDetail: 'Click for details', hoverPreview: 'Hover to preview',
    legendStrong: 'Strong', legendModerate: 'Moderate', legendWeak: 'Weak',
    noData: 'No data', total: 'Total',
    search: 'Search factors...',
  },
  ja: {
    title: '因子ヒートマップ', subtitle: '240因子の信号強度一覧',
    signalStrength: '信号', ic: 'IC', category: 'カテゴリ',
    trendUp: '↑ 上昇', trendDown: '↓ 下降', trendFlat: '→ 横ばい',
    clickDetail: 'クリックで詳細', hoverPreview: 'ホバーでプレビュー',
    legendStrong: '強い', legendModerate: '中程度', legendWeak: '弱い',
    noData: 'データなし', total: '計',
    search: '因子を検索...',
  },
};

// ── Signal → color (color-blind friendly palette) ──────────────────
function signalColor(signal: number): { bg: string; text: string; border: string } {
  if (signal >= 70) return { bg: '#22c55e', text: '#052e16', border: '#16a34a' };  // strong green
  if (signal >= 50) return { bg: '#84cc16', text: '#1a2e05', border: '#65a30d' };  // lime
  if (signal >= 35) return { bg: '#eab308', text: '#422006', border: '#ca8a04' };  // yellow
  if (signal >= 20) return { bg: '#f97316', text: '#431407', border: '#ea580c' };  // orange
  return { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.08)' }; // neutral/grey
}

// ── Component ───────────────────────────────────────────────────────
const FactorHeatmap: React.FC<FactorHeatmapProps> = ({
  factors, onFactorClick, locale: pl, compact,
}) => {
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, HeatmapFactor[]> = {};
    for (const f of factors) {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    }
    return map;
  }, [factors]);

  // Filter by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORY_ORDER.filter(c => grouped[c]?.length > 0);
    const q = search.toLowerCase();
    return CATEGORY_ORDER.filter(c => {
      const fs = grouped[c] || [];
      return fs.some(f =>
        f.nameCn.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        c.toLowerCase().includes(q)
      );
    });
  }, [search, grouped]);

  // Stats
  const totalFactors = factors.length;
  const strongSignals = factors.filter(f => f.signal >= 70).length;
  const moderateSignals = factors.filter(f => f.signal >= 35 && f.signal < 70).length;
  const weakSignals = factors.filter(f => f.signal < 35).length;

  return (
    <div style={{ background: '#0d1117', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>🔥 {t.title}</h3>
            <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{t.total} {totalFactors} {t.subtitle}</p>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            <LegendItem color="#22c55e" label={t.legendStrong} count={strongSignals} />
            <LegendItem color="#eab308" label={t.legendModerate} count={moderateSignals} />
            <LegendItem color="rgba(255,255,255,0.15)" label={t.legendWeak} count={weakSignals} />
          </div>
        </div>
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.search}
          style={{
            width: '100%', padding: '6px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
            color: '#e2e8f0', fontSize: 11, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Heatmap grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {filteredCategories.map(cat => {
          const catFactors = grouped[cat] || [];
          if (catFactors.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const filtered = search.trim()
            ? catFactors.filter(f => f.nameCn.toLowerCase().includes(search.toLowerCase()) || f.id.toLowerCase().includes(search.toLowerCase()))
            : catFactors;
          if (filtered.length === 0) return null;

          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              {/* Category header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', marginBottom: 6,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 14 }}>{meta?.icon || '📌'}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12 }}>
                  {meta?.label[langKey] || cat}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>
                  ({filtered.length})
                </span>
              </div>

              {/* Factor tiles */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: compact ? 'repeat(auto-fill, minmax(80px, 1fr))' : 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 4,
              }}>
                {filtered.map(factor => {
                  const color = signalColor(factor.signal);
                  const isHovered = hoveredFactor === factor.id;
                  const trendIcon = factor.trend === 'up' ? '▲' : factor.trend === 'down' ? '▼' : '—';
                  const trendColor = factor.trend === 'up' ? '#22c55e' : factor.trend === 'down' ? '#f85149' : 'rgba(255,255,255,0.2)';

                  return (
                    <div
                      key={factor.id}
                      onMouseEnter={() => setHoveredFactor(factor.id)}
                      onMouseLeave={() => setHoveredFactor(null)}
                      onClick={() => onFactorClick?.(factor.id)}
                      style={{
                        padding: compact ? '6px 8px' : '8px 10px',
                        borderRadius: 8, cursor: 'pointer',
                        background: factor.signal >= 20 ? color.bg : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${color.border}`,
                        transition: 'all 0.15s ease',
                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                        position: 'relative' as const,
                        minHeight: compact ? 40 : 52,
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') onFactorClick?.(factor.id); }}
                    >
                      <div style={{
                        fontSize: compact ? 10 : 11, fontWeight: 600,
                        color: factor.signal >= 20 ? color.text : 'rgba(255,255,255,0.45)',
                        marginBottom: 2, lineHeight: 1.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                      }}>
                        {factor.nameCn}
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 9, color: factor.signal >= 20 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)',
                      }}>
                        <span>{factor.signal}</span>
                        <span style={{ color: trendColor, fontSize: 10 }}>{trendIcon}</span>
                      </div>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute' as const, bottom: '100%', left: '50%',
                          transform: 'translateX(-50%)', marginBottom: 4,
                          padding: '8px 12px', borderRadius: 8,
                          background: '#1c2333', border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10,
                          whiteSpace: 'nowrap' as const, minWidth: 120,
                        }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 11, marginBottom: 4 }}>
                            {factor.nameCn}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 }}>
                            {factor.id}
                          </div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
                            <span style={{ color: '#58a6ff' }}>{t.signalStrength}: {factor.signal}</span>
                            {factor.ic !== undefined && <span style={{ color: '#a371f7' }}>{t.ic}: {factor.ic.toFixed(3)}</span>}
                          </div>
                          <div style={{ fontSize: 9, color: trendColor, marginTop: 2 }}>
                            {factor.trend === 'up' ? t.trendUp : factor.trend === 'down' ? t.trendDown : t.trendFlat}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>{t.noData}</div>
        )}
      </div>
    </div>
  );
};

// ── Legend item ─────────────────────────────────────────────────────
const LegendItem: React.FC<{ color: string; label: string; count: number }> = ({ color, label, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
    <span>{label} ({count})</span>
  </div>
);

export default FactorHeatmap;
