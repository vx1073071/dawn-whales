/**
 * R161 ML: FormCreator — Manual strategy form with parameter inputs
 * Pre-fills from AI parse result when nlPrefill is provided.
 * Supports editing existing strategy via editId.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ParsedStrategy {
  success: boolean;
  name: string;
  description: string;
  symbol?: string;
  strategy: { type: string; params: Record<string, number>; stopLoss?: number; takeProfit?: number };
}

interface Props {
  onBack: () => void;
  onCreated: () => void;
  nlPrefill?: ParsedStrategy;
  editId?: string;
}

const STRATEGY_TYPES = ['MACD', 'RSI', 'Bollinger', 'MovingAverage', 'Breakout', 'MultiFactor'];

export const FormCreator: React.FC<Props> = ({ onBack, onCreated, nlPrefill, editId }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState('');
  const [strategyType, setStrategyType] = useState('MACD');
  const [params, setParams] = useState<Record<string, string>>({ fast: '12', slow: '26', signal: '9' });
  const [stopLoss, setStopLoss] = useState('2');
  const [takeProfit, setTakeProfit] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from AI parse
  useEffect(() => {
    if (nlPrefill?.success) {
      setName(nlPrefill.name || '');
      setDescription(nlPrefill.description || '');
      setSymbol(nlPrefill.symbol || '');
      setStrategyType(nlPrefill.strategy.type || 'MACD');
      const p: Record<string, string> = {};
      Object.entries(nlPrefill.strategy.params || {}).forEach(([k, v]) => { p[k] = String(v); });
      if (Object.keys(p).length > 0) setParams(p);
      if (nlPrefill.strategy.stopLoss) setStopLoss(String(nlPrefill.strategy.stopLoss * 100));
      if (nlPrefill.strategy.takeProfit) setTakeProfit(String(nlPrefill.strategy.takeProfit * 100));
    }
  }, [nlPrefill]);

  // Load existing for editing
  useEffect(() => {
    if (!editId) return;
    const load = async () => {
      try {
        const { getAllStrategies } = await import('../../../lib/bridge-api');
        const list = await getAllStrategies();
        const found = list.find((s: any) => s.id === editId);
        if (found) {
          setName(found.nameCn || found.name || '');
          setDescription(found.description || '');
          setSymbol(found.symbol || '');
          setStrategyType(found.strategy?.type || 'MACD');
          if (found.parameters) {
            const p: Record<string, string> = {};
            Object.entries(found.parameters).forEach(([k, v]) => { p[k] = String(v); });
            setParams(p);
          }
          if (found.strategy?.stopLoss) setStopLoss(String(found.strategy.stopLoss * 100));
          if (found.strategy?.takeProfit) setTakeProfit(String(found.strategy.takeProfit * 100));
        }
      } catch { /* ignore */ }
    };
    load();
  }, [editId]);

  const paramDefs: Record<string, Array<{ key: string; label: string; defaultVal: string }>> = {
    MACD: [
      { key: 'fast', label: '快线周期', defaultVal: '12' },
      { key: 'slow', label: '慢线周期', defaultVal: '26' },
      { key: 'signal', label: '信号线周期', defaultVal: '9' },
    ],
    RSI: [
      { key: 'period', label: '周期', defaultVal: '14' },
      { key: 'oversold', label: '超卖阈值', defaultVal: '30' },
      { key: 'overbought', label: '超买阈值', defaultVal: '70' },
    ],
    Bollinger: [
      { key: 'period', label: '周期', defaultVal: '20' },
      { key: 'stdDev', label: '标准差倍数', defaultVal: '2' },
    ],
    MovingAverage: [
      { key: 'fast', label: '快线', defaultVal: '5' },
      { key: 'slow', label: '慢线', defaultVal: '20' },
    ],
    Breakout: [
      { key: 'period', label: '突破周期', defaultVal: '20' },
      { key: 'volumeRatio', label: '量比', defaultVal: '1.5' },
    ],
    MultiFactor: [
      { key: 'minScore', label: '最低评分', defaultVal: '65' },
      { key: 'universeSize', label: '持仓数量', defaultVal: '10' },
    ],
  };

  const currentParams = paramDefs[strategyType] || paramDefs.MACD;

  const handleTypeChange = (t: string) => {
    setStrategyType(t);
    const newParams: Record<string, string> = {};
    (paramDefs[t] || paramDefs.MACD).forEach((p) => { newParams[p.key] = p.defaultVal; });
    setParams(newParams);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError(t('FormCreator.nameRequired', '请输入策略名称')); return; }
    setSaving(true);
    setError('');
    try {
      const numericParams: Record<string, number> = {};
      Object.entries(params).forEach(([k, v]) => { numericParams[k] = parseFloat(v) || 0; });

      const { createStrategy, updateStrategy } = await import('../../../lib/bridge-api');
      const payload = {
        name: name.trim(),
        description: description.trim(),
        symbol: symbol.trim() || undefined,
        strategy: {
          type: strategyType,
          params: numericParams,
          stopLoss: parseFloat(stopLoss) / 100,
          takeProfit: parseFloat(takeProfit) / 100,
        },
        category: strategyType === 'MultiFactor' ? 'multi_factor' : 'momentum',
        tags: [strategyType],
      };

      if (editId) {
        await updateStrategy(editId, payload);
      } else {
        await createStrategy(payload);
      }
      onCreated();
    } catch (e: unknown) {
      setError((e as Error).message || t('FormCreator.saveError', '保存失败'));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          ⚙️ {editId ? t('FormCreator.editTitle', '编辑策略') : t('FormCreator.createTitle', '手动创建策略')}
        </h2>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">
          ← {t('FormCreator.back', '返回')}
        </button>
      </div>

      {nlPrefill && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-xs text-blue-400">
          🤖 {t('FormCreator.aiPrefill', '已从 AI 解析结果预填参数，你可以修改后保存')}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">{t('FormCreator.name', '策略名称')} *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('FormCreator.namePlaceholder', '如：双均线突破策略')}
          className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/40"
        />
      </div>

      {/* Symbol */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">{t('FormCreator.symbol', '交易标的')}</label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="US.AAPL / HK.0700"
          className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-[#C9A046]/40"
        />
      </div>

      {/* Strategy Type */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">{t('FormCreator.type', '策略类型')}</label>
        <div className="flex flex-wrap gap-1.5">
          {STRATEGY_TYPES.map((st) => (
            <button
              key={st}
              onClick={() => handleTypeChange(st)}
              className={`px-3 py-1 rounded text-xs transition-all ${
                strategyType === st
                  ? 'bg-[#C9A046] text-black font-medium'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-300">{t('FormCreator.parameters', '策略参数')}</h3>
        {currentParams.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3">
            <label className="text-xs text-gray-400 flex-shrink-0">{p.label}</label>
            <input
              type="number"
              value={params[p.key] || p.defaultVal}
              onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
              step="any"
              className="w-24 bg-white/[0.04] border border-white/5 rounded px-2 py-1 text-xs text-white text-right font-mono focus:outline-none focus:border-[#C9A046]/40"
            />
          </div>
        ))}
      </div>

      {/* Stop Loss / Take Profit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{t('FormCreator.stopLoss', '止损 (%)')}</label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            step="0.5"
            min="0"
            className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-red-400 font-mono text-right focus:outline-none focus:border-red-500/40"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{t('FormCreator.takeProfit', '止盈 (%)')}</label>
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            step="0.5"
            min="0"
            className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono text-right focus:outline-none focus:border-emerald-500/40"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">{t('FormCreator.description', '描述')}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t('FormCreator.descPlaceholder', '策略描述（可选）')}
          className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A046]/40"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Save */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 text-sm bg-[#C9A046] hover:bg-[#D4A853] disabled:bg-white/10 disabled:text-gray-600 text-black font-medium py-2 rounded-lg transition-all"
        >
          {saving ? '⏳' : editId ? t('FormCreator.update', '更新策略') : t('FormCreator.create', '创建策略')}
        </button>
      </div>
    </div>
  );
};

export default FormCreator;
