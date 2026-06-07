/**
 * Strategy Publish Form — ML-52-02 [P0]
 * R52: v1.1.0-alpha Strategy Marketplace — Publish flow
 *
 * Form fields:
 * - Strategy name + description
 * - Category + market + timeframe
 * - Tags (multi-select)
 * - Price (free or custom)
 * - Backtest result upload (optional)
 * - Preview before publish
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface PublishFormData {
  name: string;
  description: string;
  category: string;
  market: string;
  timeframe: string;
  tags: string[];
  price: number;
  isFree: boolean;
  strategy: string; // NL description or code
  stopLoss: string;
  takeProfit: string;
}

const initialForm: PublishFormData = {
  name: '',
  description: '',
  category: 'Trend Following',
  market: 'US',
  timeframe: 'Daily',
  tags: [],
  price: 0,
  isFree: true,
  strategy: '',
  stopLoss: '',
  takeProfit: '',
};

const categoryOptions = ['Trend Following', 'Mean Reversion', 'Momentum', 'Arbitrage', 'Multi-Factor', 'Hedge', 'Options', 'Crypto', 'Other'];
const marketOptions = ['US', 'HK', 'CN', 'Crypto', 'Global'];
const timeframeOptions = ['Tick', 'Minute', 'Hourly', 'Daily', 'Weekly', 'Monthly'];
const commonTags = ['MA', 'RSI', 'MACD', 'Bollinger', 'Momentum', 'Breakout', 'Reversal', 'Volume', 'SPY', 'QQQ', 'TQQQ', 'AAPL', 'NVDA', 'TSLA'];

// ── Form Steps ──────────────────────────────────────────────────────────

const steps = ['Basic Info', 'Strategy', 'Preview', 'Publish'];

const StrategyPublishForm: React.FC<{ onClose: () => void; onSubmit: (data: PublishFormData) => void }> = ({ onClose, onSubmit }) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PublishFormData>(initialForm);
  const [tagInput, setTagInput] = useState('');

  const update = useCallback(<K extends keyof PublishFormData>(key: K, value: PublishFormData[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
  }, []);

  const addTag = useCallback((tag: string) => {
    if (tag && !form.tags.includes(tag) && form.tags.length < 6) {
      setForm((p) => ({ ...p, tags: [...p.tags, tag] }));
    }
    setTagInput('');
  }, [form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(form);
    onClose();
  }, [form, onSubmit, onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#111119] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
          <div>
            <h2 className="text-base font-semibold text-gray-200">Publish Strategy</h2>
            <p className="text-[10px] text-gray-600">Step {step + 1} of {steps.length}: {steps[step]}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-white/[0.06]'}`} />
          ))}
        </div>

        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Strategy Name *</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Golden Cross MA20/60 on TQQQ" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-amber-500/30 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description *</label>
              <textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe your strategy logic, indicators used, and target market..." rows={3} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-amber-500/30 outline-none resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category</label>
                <select value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200">
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Market</label>
                <select value={form.market} onChange={(e) => update('market', e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200">
                  {marketOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
                <select value={form.timeframe} onChange={(e) => update('timeframe', e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200">
                  {timeframeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Price</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={form.isFree} onChange={(e) => { update('isFree', e.target.checked); update('price', 0); }} className="accent-amber-500" /> Free
                </label>
                {!form.isFree && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">$</span>
                    <input type="number" value={form.price} onChange={(e) => update('price', Math.max(0, Number(e.target.value)))} min={1} className="w-20 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-sm text-gray-200" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Strategy */}
        {step === 1 && (
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Strategy Logic (NL or Code) *</label>
              <textarea value={form.strategy} onChange={(e) => update('strategy', e.target.value)} placeholder="Describe your strategy: MA5 cross MA20 buy TQQQ, 5% stop loss, or paste code..." rows={6} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-amber-500/30 outline-none resize-none font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stop Loss %</label>
                <input value={form.stopLoss} onChange={(e) => update('stopLoss', e.target.value)} placeholder="e.g. 5%" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Take Profit %</label>
                <input value={form.takeProfit} onChange={(e) => update('takeProfit', e.target.value)} placeholder="e.g. 15%" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tags (up to 6)</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">
                    {t} <button onClick={() => removeTag(t)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)} placeholder="Type tag and press Enter..." className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-gray-200 text-[10px] placeholder-gray-600" />
                <button onClick={() => addTag(tagInput)} className="px-3 py-2 bg-amber-500/15 text-amber-400 rounded-lg text-xs">Add</button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {commonTags.filter(t => !form.tags.includes(t)).slice(0, 8).map((t) => (
                  <button key={t} onClick={() => addTag(t)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.03] text-gray-500 hover:text-gray-300">{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="px-6 py-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Preview</h3>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-semibold text-gray-200">{form.name || 'Untitled Strategy'}</h4>
                  <p className="text-[10px] text-gray-600">You · Just now</p>
                </div>
                <span className="text-xs text-amber-400">{form.isFree ? 'Free' : `$${form.price}`}</span>
              </div>
              <p className="text-xs text-gray-400">{form.description || 'No description'}</p>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{form.category}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-500">{form.market}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-500">{form.timeframe}</span>
                {form.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.03] text-gray-500">{t}</span>)}
              </div>
              {form.strategy && (
                <div className="bg-[#0d0d15] rounded-lg p-3 border border-white/[0.04]">
                  <p className="text-[10px] text-gray-600 mb-1">Strategy</p>
                  <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{form.strategy}</p>
                </div>
              )}
              {(form.stopLoss || form.takeProfit) && (
                <div className="flex gap-3 text-xs">
                  {form.stopLoss && <span className="text-red-400">SL: -{form.stopLoss}%</span>}
                  {form.takeProfit && <span className="text-green-400">TP: +{form.takeProfit}%</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.05]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300">Cancel</button>
          <div className="flex gap-2">
            {step > 0 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200">Back</button>}
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} disabled={step === 0 && !form.name} className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-semibold disabled:opacity-40">
                Next: {steps[step + 1]}
              </button>
            ) : (
              <button onClick={handleSubmit} className="px-6 py-2 bg-green-500 text-black rounded-lg text-xs font-semibold">
                Publish Strategy
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyPublishForm;
