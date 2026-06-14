/**
 * R163 ML: TemplateBrowser — Strategy template gallery + Factor recommendation linkage
 * P0-U3: Selecting a template auto-loads recommended factors via FactorCompatibilityEngine.
 * Green badge = compatible, Red badge = incompatible + reason.
 * Factor weights auto-saved to localStorage for FactorWeightSlider pickup.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTemplates, createStrategy, getFactorSuggestions } from '../../../lib/bridge-api';
import type { StrategyCategory } from '../../../lib/bridge-api';

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

interface FactorRecommendation {
  factorId: string;
  nameCN: string;
  categoryCN: string;
  compatible: boolean;
  reason?: string;
  typicalIC: number;
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

// Maps template category to FactorCompatibilityEngine strategyType
const CATEGORY_TO_STRATEGY: Record<string, 'momentum' | 'value' | 'growth' | 'balanced' | 'defensive'> = {
  momentum: 'momentum',
  mean_reversion: 'defensive',
  breakout: 'momentum',
  pairs: 'balanced',
  options: 'defensive',
  multi_factor: 'balanced',
};

export const TemplateBrowser: React.FC<Props> = ({ onBack, onCreated }) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [recommendations, setRecommendations] = useState<FactorRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getTemplates();
        setTemplates(list || []);
      } catch { /* fallback */ }
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

  // R164 P1-E4: Fetch factor recommendations via centralized bridge-api (was inline STRATEGY_FACTORS)
  const handleSelectTemplate = async (tmpl: TemplateItem) => {
    setSelectedTemplate(tmpl);
    setRecLoading(true);
    setRecommendations([]);

    try {
      const strategyType = CATEGORY_TO_STRATEGY[tmpl.category] || 'balanced';
      const recs = await getFactorSuggestions(strategyType as StrategyCategory, 6);
      setRecommendations(recs);
    } catch {
      setRecommendations([]);
    }
    setRecLoading(false);
  };

  // R163: Save factor weights to localStorage based on recommendations
  const saveFactorWeights = () => {
    if (recommendations.length === 0) return;
    const compatible = recommendations.filter((r) => r.compatible);
    if (compatible.length === 0) return;

    // Distribute weights evenly among recommended compatible factors
    const weightPerFactor = Math.floor(100 / compatible.length);
    const weights: Record<string, number> = {};
    compatible.forEach((r) => { weights[r.factorId] = weightPerFactor; });

    // Normalize to 100
    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    const remainder = 100 - total;
    if (compatible.length > 0 && remainder > 0) {
      weights[compatible[0].factorId] += remainder;
    }

    localStorage.setItem('dw-factor-recommendations', JSON.stringify({
      templateId: selectedTemplate?.id,
      weights,
      factors: compatible.map((r) => r.factorId),
      timestamp: Date.now(),
    }));
  };

  const handleUse = async () => {
    if (!selectedTemplate) return;
    saveFactorWeights();
    try {
      await createStrategy({
        templateId: selectedTemplate.id,
        name: selectedTemplate.nameCn || selectedTemplate.name,
        category: selectedTemplate.category,
        tags: selectedTemplate.tags || [],
      });
      onCreated();
    } catch { /* silently fail */ }
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
        {categories.map((c, idx) => (
          <button
            key={`${c}-${idx}`}
            onClick={() => setFilterCat(c)}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              filterCat === c
                ? 'bg-[#C9A046] text-black font-medium'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {c === 'all' ? t('TemplateBrowser.allCategories', '全部') : c}
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
          {filtered.map((tmpl) => {
            const isSelected = selectedTemplate?.id === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl)}
                className={`bg-[#1a1a25] border rounded-xl p-4 cursor-pointer transition-all group ${
                  isSelected ? 'border-[#C9A046]/50 shadow-lg shadow-[#C9A046]/5' : 'border-white/5 hover:border-[#C9A046]/30'
                }`}
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

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(tmpl.indicators || []).slice(0, 4).map((ind, i) => (
                    <span key={i} className="text-[10px] bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{ind}</span>
                  ))}
                  {(tmpl.timeframe || []).slice(0, 3).map((tf, i) => (
                    <span key={`tf-${i}`} className="text-[10px] bg-white/[0.04] text-gray-600 px-1.5 py-0.5 rounded">{tf}</span>
                  ))}
                </div>

                {tmpl.risk && (
                  <div className="flex gap-3 text-[10px] text-gray-600 mb-3">
                    <span>SL: {(tmpl.risk.defaultStopLoss * 100).toFixed(0)}%</span>
                    <span>TP: {(tmpl.risk.defaultTakeProfit * 100).toFixed(0)}%</span>
                    <span>Pos: {(tmpl.risk.maxPosition * 100).toFixed(0)}%</span>
                  </div>
                )}

                {isSelected && (
                  <div className="text-[10px] text-[#C9A046] border-t border-[#C9A046]/10 pt-2 mt-1">
                    ✓ {t('TemplateBrowser.selected', '已选择 — 滚动查看因子推荐')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ R163: Factor Recommendation Panel ═══════════════════════════════ */}
      {selectedTemplate && (
        <div className="bg-[#1a1a25] border border-[#C9A046]/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[#C9A046] text-lg">🧬</span>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {t('TemplateBrowser.factorRecTitle', '因子推荐')}
              </h3>
              <p className="text-[10px] text-gray-500">
                {t('TemplateBrowser.factorRecSubtitle', '基于')}「{selectedTemplate.nameCn || selectedTemplate.name}」
                {t('TemplateBrowser.factorRecSubtitle2', '的策略类型自动推荐的因子组合')}
              </p>
            </div>
          </div>

          {recLoading ? (
            <div className="text-center py-4 text-gray-500 text-xs">⏳ {t('TemplateBrowser.analyzing', '分析中...')}</div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {recommendations.map((rec) => (
                  <div
                    key={rec.factorId}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                      rec.compatible
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}
                    title={rec.reason || ''}
                  >
                    <span className="text-[10px]">{rec.compatible ? '✅' : '❌'}</span>
                    <span className="font-medium">{rec.nameCN}</span>
                    <span className="text-[10px] opacity-60">{rec.categoryCN}</span>
                    <span className="text-[10px] opacity-40">IC:{rec.typicalIC.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-400/60">
                  <span>✅</span> {t('TemplateBrowser.compatible', '兼容')}
                </span>
                <span className="flex items-center gap-1 text-red-400/60">
                  <span>❌</span> {t('TemplateBrowser.incompatible', '不兼容')}
                </span>
              </div>

              {/* Auto-load weights button */}
              <button
                onClick={saveFactorWeights}
                className="text-[10px] bg-[#C9A046]/10 hover:bg-[#C9A046]/20 text-[#C9A046] border border-[#C9A046]/20 px-3 py-1 rounded transition-all"
              >
                💾 {t('TemplateBrowser.saveWeights', '保存推荐权重到因子配置器')}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              {t('TemplateBrowser.noFactors', '暂无因子推荐数据，你可以手动配置')}
            </p>
          )}

          {/* Create button */}
          <button
            onClick={handleUse}
            className="w-full text-sm bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium py-2 rounded-lg transition-all"
          >
            {t('TemplateBrowser.createWithFactors', '使用此模板创建策略')} →
          </button>
        </div>
      )}
    </div>
  );
};

export default TemplateBrowser;
