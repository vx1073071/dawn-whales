/**
 * MarketplacePublishPanel — Strategy publishing workflow
 * (ML-41-01, R41 Phase 5.0)
 *
 * Complete publish flow for Marketplace:
 * - Step 1: Select strategy + description
 * - Step 2: Tags + category + pricing
 * - Step 3: Preview + confirm publish
 */

import React, { useState, useCallback, useMemo } from 'react';
import i18n from '../../i18n';
// ── Types ───────────────────────────────────────────────────────────────

interface PublishStrategy {
  id: string;
  name: string;
  type: string;
  description: string;
  sharpe: number;
  annualReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
}

interface PublishForm {
  strategyId: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  price: 'free' | 'one_time' | 'subscription';
  priceAmount: number;
  authorNote: string;
}

// ── Mock strategies for selection ───────────────────────────────────────

const MOCK_STRATEGIES: PublishStrategy[] = [
  { id: 'strat-001', name: i18n.t('MarketplacePublishPanel.k1'), type: 'MA_CROSS', description: i18n.t('MarketplacePublishPanel.k2'), sharpe: 2.1, annualReturn: 0.35, maxDrawdown: -0.12, winRate: 0.58, tradeCount: 245 },
  { id: 'strat-002', name: i18n.t('MarketplacePublishPanel.k3'), type: 'MOMENTUM', description: i18n.t('MarketplacePublishPanel.k4'), sharpe: 1.8, annualReturn: 0.28, maxDrawdown: -0.18, winRate: 0.52, tradeCount: 180 },
  { id: 'strat-003', name: i18n.t('MarketplacePublishPanel.k5'), type: 'MEAN_REV', description: i18n.t('MarketplacePublishPanel.k6'), sharpe: 2.4, annualReturn: 0.42, maxDrawdown: -0.09, winRate: 0.63, tradeCount: 320 },
];

const CATEGORIES = [i18n.t('MarketplacePublishPanel.k7'), i18n.t('MarketplacePublishPanel.k8'), i18n.t('MarketplacePublishPanel.k9'), i18n.t('MarketplacePublishPanel.k10'), i18n.t('MarketplacePublishPanel.k11'), i18n.t('MarketplacePublishPanel.k12'), 'AI/ML', i18n.t('MarketplacePublishPanel.k13')];
const SUGGESTED_TAGS = [i18n.t('MarketplacePublishPanel.k14'), i18n.t('MarketplacePublishPanel.k15'), i18n.t('MarketplacePublishPanel.k16'), i18n.t('MarketplacePublishPanel.k17'), i18n.t('MarketplacePublishPanel.k18'), i18n.t('MarketplacePublishPanel.k19'), i18n.t('MarketplacePublishPanel.k20'), i18n.t('MarketplacePublishPanel.k21'), i18n.t('MarketplacePublishPanel.k22'), i18n.t('MarketplacePublishPanel.k23')];

// ── Main Component ──────────────────────────────────────────────────────

interface MarketplacePublishPanelProps {
  className?: string;
}

export const MarketplacePublishPanel: React.FC<MarketplacePublishPanelProps> = ({ className }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PublishForm>({
    strategyId: '',
    title: '',
    description: '',
    tags: [],
    category: i18n.t('MarketplacePublishPanel.k24'),
    price: 'free',
    priceAmount: 0,
    authorNote: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [published, setPublished] = useState(false);

  const selectedStrategy = useMemo(
    () => MOCK_STRATEGIES.find(s => s.id === form.strategyId),
    [form.strategyId]
  );

  const updateForm = useCallback(<K extends keyof PublishForm>(key: K, value: PublishForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const addTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      updateForm('tags', [...form.tags, tag]);
    }
    setTagInput('');
  }, [tagInput, form.tags, updateForm]);

  const removeTag = useCallback((tag: string) => {
    updateForm('tags', form.tags.filter(t => t !== tag));
  }, [form.tags, updateForm]);

  const handlePublish = useCallback(() => {
    setPublished(true);
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) return !!form.strategyId && form.title.length >= 3 && form.description.length >= 10;
    if (step === 2) return form.tags.length >= 1;
    return true;
  }, [step, form]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            发布策略
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            步骤 {step}/3 · {step === 1 ? i18n.t('MarketplacePublishPanel.k25') : step === 2 ? i18n.t('MarketplacePublishPanel.k26') : i18n.t('MarketplacePublishPanel.k27')}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              s < step ? 'bg-emerald-500/20 text-emerald-400' :
              s === step ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50' :
              'bg-gray-800 text-gray-600'
            }`}>
              {s < step ? '✓' : s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 rounded ${s < step ? 'bg-emerald-500/50' : 'bg-gray-800'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Select strategy ───────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Strategy selection */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">选择策略</label>
            <div className="space-y-2">
              {MOCK_STRATEGIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    updateForm('strategyId', s.id);
                    updateForm('title', s.name);
                    updateForm('description', s.description);
                  }}
                  className={`w-full text-left rounded-lg p-4 border transition-colors ${
                    form.strategyId === s.id
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-gray-800/40 border-gray-700/30 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-white">{s.name}</span>
                      <span className="ml-2 text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded">{s.type}</span>
                    </div>
                    <div className="flex gap-3 text-[10px]">
                      <span className="text-amber-400">Sharpe {s.sharpe.toFixed(1)}</span>
                      <span className="text-emerald-400">{(s.annualReturn * 100).toFixed(0)}%</span>
                      <span className="text-red-400">DD {(s.maxDrawdown * 100).toFixed(0)}%</span>
                      <span className="text-gray-500">{s.tradeCount}笔</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">标题 *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateForm('title', e.target.value)}
              placeholder="给你的策略取个吸引人的标题"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">描述 *</label>
            <textarea
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              placeholder="描述你的策略逻辑、适用场景..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 resize-y focus:border-amber-500/50 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Tags & pricing ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Tags */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">标签 *</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="输入标签后按回车"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:border-amber-500/50 focus:outline-none"
              />
              <button onClick={addTag} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-gray-200">
                + 添加
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {form.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-[10px]">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-400">×</button>
                </span>
              ))}
            </div>
            {/* Suggested tags */}
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-gray-600 mr-1">推荐:</span>
              {SUGGESTED_TAGS.filter(t => !form.tags.includes(t)).slice(0, 8).map(tag => (
                <button
                  key={tag}
                  onClick={() => updateForm('tags', [...form.tags, tag])}
                  className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-500 hover:text-gray-300"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">分类</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => updateForm('category', cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    form.category === cat
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-gray-800/40 border border-gray-700/30 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">定价模式</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([
                { key: 'free', label: i18n.t('MarketplacePublishPanel.k28'), sub: '¥0' },
                { key: 'one_time', label: i18n.t('MarketplacePublishPanel.k29'), sub: i18n.t('MarketplacePublishPanel.k30') },
                { key: 'subscription', label: i18n.t('MarketplacePublishPanel.k31'), sub: i18n.t('MarketplacePublishPanel.k32') },
              ] as const).map(p => (
                <button
                  key={p.key}
                  onClick={() => updateForm('price', p.key)}
                  className={`py-2 rounded-lg text-xs transition-colors ${
                    form.price === p.key
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-gray-800/40 border border-gray-700/30 text-gray-500'
                  }`}
                >
                  <div>{p.label}</div>
                  <div className="text-[10px] opacity-60">{p.sub}</div>
                </button>
              ))}
            </div>
            {form.price !== 'free' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">¥</span>
                <input
                  type="number"
                  value={form.priceAmount || ''}
                  onChange={e => updateForm('priceAmount', Number(e.target.value))}
                  placeholder="0"
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300"
                />
                <span className="text-[10px] text-gray-600">{form.price === 'subscription' ? i18n.t('MarketplacePublishPanel.k33') : ''}</span>
              </div>
            )}
          </div>

          {/* Author note */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">作者备注 (可选)</label>
            <textarea
              value={form.authorNote}
              onChange={e => updateForm('authorNote', e.target.value)}
              placeholder="使用建议、风险提示..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 resize-y focus:border-amber-500/50 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ─────────────────────────────────────── */}
      {step === 3 && !published && (
        <div className="space-y-4">
          {/* Preview card */}
          <div className="bg-gray-800/40 rounded-lg p-5 border border-gray-700/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-base font-bold text-white">{form.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded">{selectedStrategy?.type}</span>
                  <span className="text-[10px] text-gray-600">{form.category}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    form.price === 'free' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {form.price === 'free' ? i18n.t('MarketplacePublishPanel.k34') : form.price === 'one_time' ? `¥${form.priceAmount}` : `¥${form.priceAmount}/月`}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-4">{form.description}</p>

            {/* Strategy metrics preview */}
            {selectedStrategy && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {([
                  ['Sharpe', selectedStrategy.sharpe.toFixed(1), 'text-amber-400'],
                  [i18n.t('MarketplacePublishPanel.k35'), `${(selectedStrategy.annualReturn * 100).toFixed(0)}%`, 'text-emerald-400'],
                  ['components.maxDrawdown', `${(selectedStrategy.maxDrawdown * 100).toFixed(0)}%`, 'text-red-400'],
                  ['components.winRate', `${(selectedStrategy.winRate * 100).toFixed(0)}%`, 'text-blue-400'],
                ] as const).map(([label, val, color]) => (
                  <div key={label} className="text-center">
                    <div className="text-[10px] text-gray-600">{label}</div>
                    <div className={`text-xs font-bold ${color}`}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {form.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">{tag}</span>
              ))}
            </div>

            {form.authorNote && (
              <div className="bg-gray-900/50 rounded p-3 text-xs text-gray-500 italic">
                {form.authorNote}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Published success */}
      {published && (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-lg font-bold text-white">策略发布成功！</div>
          <p className="text-sm text-gray-500 mt-1">{form.title}</p>
          <p className="text-xs text-gray-600 mt-3">
            你的策略已提交到策略市场，审核通过后将公开可见。
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      {!published && (
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 disabled:opacity-40"
          >
            ← 上一步
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold disabled:opacity-40"
            >
              下一步 →
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500"
            >
              🚀 发布策略
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketplacePublishPanel;
