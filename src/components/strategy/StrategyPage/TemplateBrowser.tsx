/**
 * R161 ML: TemplateBrowser — Strategy template gallery with search/filter
 * Displays strategy templates from electron engine, filterable by category.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TemplateItem {
  id: string;
  name: string;
  nameCn?: string;
  description?: string;
  category: string;
  timeframe?: string[];
  indicators?: string[];
  tags?: string[];
  risk?: { defaultStopLoss: number; defaultTakeProfit: number; maxPosition: number };
}

interface Props {
  onBack: () => void;
  onCreated: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  momentum: 'bg-red-500/10 text-red-400 border-red-500/20',
  mean_reversion: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  breakout: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pairs: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  options: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  multi_factor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export const TemplateBrowser: React.FC<Props> = ({ onBack, onCreated }) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { getTemplates } = await import('../../../lib/bridge-api');
        const list = await getTemplates();
        setTemplates(list || []);
      } catch {
        // Fallback: show empty with message
      }
      setLoading(false);
    };
    load();
  }, []);

  const categories = ['all', ...new Set(templates.map((t) => t.category))];

  const filtered = templates.filter((t) => {
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.nameCn || '').includes(q) ||
        t.id.includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleUse = async (tmpl: TemplateItem) => {
    try {
      const { createStrategy } = await import('../../../lib/bridge-api');
      await createStrategy({
        templateId: tmpl.id,
        name: tmpl.nameCn || tmpl.name,
        category: tmpl.category,
        tags: tmpl.tags || [],
      });
      onCreated();
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-2xl mb-3">⏳</div>
        <p className="text-sm text-gray-500">{t('TemplateBrowser.loading', '加载模板中...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('TemplateBrowser.title', '策略模板库')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('TemplateBrowser.subtitle', '选择一个模板快速开始')}</p>
        </div>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">
          ← {t('TemplateBrowser.back', '返回')}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('TemplateBrowser.searchPlaceholder', '搜索模板名称或标签...')}
        className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/40"
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              filterCat === c
                ? 'bg-[#C9A046] text-black font-medium'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {c === 'all' ? t('TemplateBrowser.allCategories', '全部') : (CATEGORY_COLORS[c] ? c : c)}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">
          {t('TemplateBrowser.noResults', '没有匹配的模板')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 hover:border-[#C9A046]/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {tmpl.nameCn || tmpl.name}
                  </h3>
                  {tmpl.nameCn && tmpl.name !== tmpl.nameCn && (
                    <p className="text-[10px] text-gray-600">{tmpl.name}</p>
                  )}
                </div>
                {tmpl.category && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[tmpl.category] || 'text-gray-500 border-white/10'}`}>
                    {tmpl.category}
                  </span>
                )}
              </div>

              {tmpl.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tmpl.description}</p>
              )}

              {/* Indicators & Timeframes */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(tmpl.indicators || []).slice(0, 4).map((ind, i) => (
                  <span key={i} className="text-[10px] bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{ind}</span>
                ))}
                {(tmpl.timeframe || []).slice(0, 3).map((tf, i) => (
                  <span key={`tf-${i}`} className="text-[10px] bg-white/[0.04] text-gray-600 px-1.5 py-0.5 rounded">{tf}</span>
                ))}
              </div>

              {/* Risk info */}
              {tmpl.risk && (
                <div className="flex gap-3 text-[10px] text-gray-600 mb-3">
                  <span>SL: {(tmpl.risk.defaultStopLoss * 100).toFixed(0)}%</span>
                  <span>TP: {(tmpl.risk.defaultTakeProfit * 100).toFixed(0)}%</span>
                  <span>Pos: {(tmpl.risk.maxPosition * 100).toFixed(0)}%</span>
                </div>
              )}

              {/* Use button */}
              <button
                onClick={() => handleUse(tmpl)}
                className="w-full text-xs bg-[#C9A046]/10 hover:bg-[#C9A046]/20 text-[#C9A046] border border-[#C9A046]/20 rounded-lg py-1.5 transition-all group-hover:bg-[#C9A046]/20"
              >
                {t('TemplateBrowser.useTemplate', '使用此模板')} →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateBrowser;
