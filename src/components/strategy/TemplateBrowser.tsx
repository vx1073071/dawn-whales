// TemplateBrowser — Strategy Template Selection UI
// Displays 8 pre-built strategy templates with search, category filter, and instantiating.

import { useState, useEffect } from 'react';

import { useTranslation } from "react-i18next";
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';


interface ParameterDef {
  name: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description: string;
}

interface StrategyTemplate {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  category: string;
  timeframe: string[];
  parameters: ParameterDef[];
  indicators: string[];
  rules: { entry: string; exit: string; stopLoss?: string; takeProfit?: string };
  risk: { defaultStopLoss: number; defaultTakeProfit: number; maxPosition: number };
  tags: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  momentum: i18n.t('TemplateBrowser.k1'),
  mean_reversion: i18n.t('TemplateBrowser.k2'),
  breakout: i18n.t('TemplateBrowser.k3'),
  pairs: i18n.t('TemplateBrowser.k4'),
  options: i18n.t('TemplateBrowser.k5'),
  multi_factor: i18n.t('TemplateBrowser.k6'),
};

const CATEGORY_COLORS: Record<string, string> = {
  momentum: 'from-blue-900/40 to-blue-800/20 border-blue-500/30',
  mean_reversion: 'from-purple-900/40 to-purple-800/20 border-purple-500/30',
  breakout: 'from-green-900/40 to-green-800/20 border-green-500/30',
  pairs: 'from-yellow-900/40 to-yellow-800/20 border-yellow-500/30',
  options: 'from-pink-900/40 to-pink-800/20 border-pink-500/30',
  multi_factor: 'from-orange-900/40 to-orange-800/20 border-orange-500/30',
};

interface Props {
  onBack: () => void;
  onCreated: () => void;
}

export default function TemplateBrowser({ onBack, onCreated }: Props) {
  const { t } = useTranslation();

  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paramOverrides, setParamOverrides] = useState<Record<string, unknown>>({});
  const [instantiating, setInstantiating] = useState(false);
  const [instantiateError, setInstantiateError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await (window.api as any).getTemplates();
        const data = raw?.templates ?? raw;
        setTemplates(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setError((e as any).message ?? i18n.t('TemplateBrowser.k7'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = ['all', ...new Set(templates.map((t) => t.category))];

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === 'all' || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.nameCn.includes(search) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const selected = templates.find((t) => t.id === selectedId);

  // Init param overrides when template selected
  useEffect(() => {
    if (selected) {
      const init: Record<string, unknown> = {};
      for (const p of selected.parameters) {
        init[p.name] = p.default;
      }
      setParamOverrides(init);
    }
  }, [selectedId]);

  async function instantiate() {
    if (!selectedId) return;
    setInstantiating(true);
    setInstantiateError(null);
    try {
      const result = await (window.api as any).instantiateTemplate(selectedId, paramOverrides);
      if (!result?.success) {
        setInstantiateError(result?.error ?? i18n.t('TemplateBrowser.k8'));
        setInstantiating(false);
        return;
      }
      // Open the instantiated strategy in creation form
      onCreated();
    } catch (e: unknown) {
      setInstantiateError((e as any).message ?? i18n.t('TemplateBrowser.k9'));
      setInstantiating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">{t('back')}</button>
        <div>
          <h2 className="text-lg font-semibold text-white">策略模板</h2>
          <p className="text-gray-400 text-xs">选择一个模板，快速创建策略</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="搜索模板..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">✕</button>
        )}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeCategory === cat
                ? 'bg-[#C9A046] text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {cat === 'all' ? t('components.all') : (CATEGORY_LABELS[cat] ?? cat)}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-gray-400 py-12">{t("components.loading")}</div>}
      {error && <div className="text-red-400 text-sm py-4 px-4 bg-red-900/20 rounded-lg border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => setSelectedId(tmpl.id)}
              className={`bg-gradient-to-br ${CATEGORY_COLORS[tmpl.category] ?? 'from-gray-900/40 to-gray-800/20 border-gray-500/30'} border rounded-xl p-4 text-left transition-all hover:scale-[1.01] cursor-pointer ${
                selectedId === tmpl.id ? 'ring-2 ring-[#C9A046]' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-white font-semibold text-sm">{tmpl.nameCn || tmpl.name}</div>
                  <div className="text-gray-400 text-xs">{tmpl.name}</div>
                </div>
                <span className="text-xs bg-white/10 text-gray-300 rounded px-2 py-0.5 shrink-0">
                  {CATEGORY_LABELS[tmpl.category] ?? tmpl.category}
                </span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed mb-3 line-clamp-2">{tmpl.description}</p>
              <div className="flex flex-wrap gap-1">
                {tmpl.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[10px] bg-white/10 text-gray-300 rounded px-1.5 py-0.5">{tag}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center text-gray-500 py-12">没有找到匹配的模板</div>
      )}

      {/* Selected template detail panel */}
      {selected && (
        <div className="bg-card border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-white font-semibold">{selected.nameCn || selected.name}</h3>
              <p className="text-gray-400 text-xs mt-0.5">{selected.name}</p>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-white text-xs">✕ 关闭</button>
          </div>

          <p className="text-gray-300 text-sm leading-relaxed">{selected.description}</p>

          {/* Rules */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400">
              <span className="text-green-400 font-medium">入场</span>：{selected.rules.entry}
            </div>
            <div className="text-xs text-gray-400">
              <span className="text-red-400 font-medium">出场</span>：{selected.rules.exit}
            </div>
            {selected.rules.stopLoss && (
              <div className="text-xs text-gray-400">
                <span className="text-yellow-400 font-medium">{t("components.stopLoss")}</span>：{selected.rules.stopLoss}
              </div>
            )}
            {selected.rules.takeProfit && (
              <div className="text-xs text-gray-400">
                <span className="text-blue-400 font-medium">{t("components.takeProfit")}</span>：{selected.rules.takeProfit}
              </div>
            )}
          </div>

          {/* Indicators */}
          <div className="flex flex-wrap gap-1.5">
            {selected.indicators.map((ind) => (
              <span key={ind} className="text-[11px] bg-[#C9A046]/20 text-[#D4A853] rounded px-2 py-0.5">{ind}</span>
            ))}
          </div>

          {/* Timeframes */}
          <div className="flex flex-wrap gap-1.5">
            {selected.timeframe.map((tf) => (
              <span key={tf} className="text-[11px] bg-white/10 text-gray-400 rounded px-2 py-0.5">{tf}</span>
            ))}
          </div>

          {/* Parameters */}
          {selected.parameters.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs text-gray-400 border-t border-white/5 pt-3">参数设置</div>
              {selected.parameters.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <label className="text-xs text-gray-300 w-32 shrink-0">{p.label}</label>
                  {p.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={paramOverrides[p.name] ?? p.default}
                      onChange={(e) => setParamOverrides((prev) => ({ ...prev, [p.name]: e.target.checked }))}
                      className="accent-[#C9A046]"
                    />
                  ) : p.type === 'select' ? (
                    <select
                      value={paramOverrides[p.name] ?? p.default}
                      onChange={(e) => setParamOverrides((prev) => ({ ...prev, [p.name]: e.target.value }))}
                      className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1 text-xs text-white"
                    >
                      {p.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={paramOverrides[p.name] ?? p.default}
                      min={p.min}
                      max={p.max}
                      step={p.step ?? 1}
                      onChange={(e) => setParamOverrides((prev) => ({ ...prev, [p.name]: parseFloat(e.target.value) }))}
                      className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1 text-xs text-white w-28"
                    />
                  )}
                  <span className="text-[10px] text-gray-500">{p.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risk defaults */}
          <div className="flex gap-4 text-xs text-gray-500 border-t border-white/5 pt-3">
            <span>默认止损: <b className="text-red-400">{(selected.risk.defaultStopLoss * 100).toFixed(1)}%</b></span>
            <span>默认止盈: <b className="text-green-400">{(selected.risk.defaultTakeProfit * 100).toFixed(1)}%</b></span>
            <span>最大仓位: <b className="text-yellow-400">{(selected.risk.maxPosition * 100).toFixed(0)}%</b></span>
          </div>

          {/* Error */}
          {instantiateError && (
            <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded px-3 py-2">{instantiateError}</div>
          )}

          {/* Use template button */}
          <button
            onClick={instantiate}
            disabled={instantiating}
            className="w-full bg-[#C9A046] hover:bg-[#D4A853] disabled:opacity-50 text-black font-semibold text-sm rounded-lg py-2.5 transition-colors"
          >
            {instantiating ? i18n.t('TemplateBrowser.k10') : i18n.t('TemplateBrowser.k11')}
          </button>
        </div>
      )}
    </div>
  );
}
