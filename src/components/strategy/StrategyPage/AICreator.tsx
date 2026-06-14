/**
 * R161 ML: AICreator — Natural language strategy creation with AI
 * 1 USDT per use. Shows pricing disclosure before submitting.
 * Sends NL prompt → server → parsed strategy → fills form or creates directly.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ParsedStrategy {
  success: boolean;
  name: string;
  description: string;
  symbol?: string;
  strategy: { type: string; params: Record<string, number>; stopLoss?: number; takeProfit?: number };
  error?: string;
}

interface Props {
  onBack: () => void;
  onCreated: () => void;
  onFillForm: (parsed: ParsedStrategy) => void;
}

const EXAMPLE_PROMPTS = [
  { key: 'aiExample1', text: '当MACD金叉且价格突破20日均线时买入，止损2%' },
  { key: 'aiExample2', text: 'RSI低于30超卖时买入，RSI高于70时卖出' },
  { key: 'aiExample3', text: '布林带下轨买入，中轨卖出，波动率过滤' },
];

export const AICreator: React.FC<Props> = ({ onBack, onCreated, onFillForm }) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedStrategy | null>(null);
  const [error, setError] = useState('');
  const [showPricing, setShowPricing] = useState(true);
  const [charCount, setCharCount] = useState(0);

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { parseNL } = await import('../../../lib/bridge-api');
      const parsed = await parseNL(prompt.trim());
      setResult(parsed);

      if (parsed.success) {
        // Could auto-create or pre-fill form
      } else {
        setError(parsed.error || t('AICreator.parseError', '解析失败，请尝试更清晰的描述'));
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Network error');
    }
    setLoading(false);
  };

  const handleUseResult = () => {
    if (result?.success) {
      onFillForm(result);
    }
  };

  const handleCreateDirectly = async () => {
    if (!result?.success) return;
    try {
      const { createStrategy } = await import('../../../lib/bridge-api');
      await createStrategy({
        name: result.name,
        description: result.description,
        symbol: result.symbol,
        strategy: result.strategy,
      });
      onCreated();
    } catch {
      setError(t('AICreator.createError', '创建失败，请重试'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🤖 {t('AICreator.title', 'AI 智能创建')}
            <span className="text-[10px] bg-[#C9A046]/15 text-[#C9A046] border border-[#C9A046]/20 px-2 py-0.5 rounded-full font-normal">
              1 USDT/次
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('AICreator.subtitle', '用自然语言描述策略，AI 自动解析参数')}</p>
        </div>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">
          ← {t('AICreator.back', '返回')}
        </button>
      </div>

      {/* Pricing disclosure */}
      {showPricing && (
        <div className="bg-[#C9A046]/5 border border-[#C9A046]/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-[#C9A046] text-lg mt-0.5">💡</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#C9A046] mb-1">
                {t('AICreator.pricingTitle', 'AI 策略创建 — 1 USDT / 次')}
              </h3>
              <p className="text-xs text-[#C9A046]/70 leading-relaxed mb-2">
                {t('AICreator.pricingBody', '每次提交将消耗 1 USDT 积分。AI 会解析你的自然语言描述并自动填充策略参数。解析失败不扣费。')}
              </p>
              <button
                onClick={() => setShowPricing(false)}
                className="text-[10px] bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-3 py-1 rounded transition-colors"
              >
                {t('AICreator.understood', '我知道了，开始创建')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Example prompts */}
      {!result && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              onClick={() => setPrompt(ex.text)}
              className="text-[10px] bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200 px-2.5 py-1.5 rounded-lg transition-all border border-white/5 text-left max-w-[280px]"
            >
              💬 {ex.text}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setCharCount(e.target.value.length); }}
          placeholder={t('AICreator.placeholder', '例如：当5日均线上穿20日均线且成交量放大1.5倍时买入，止损3%，止盈8%...')}
          rows={4}
          disabled={loading}
          className="w-full bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-gray-600">{charCount} {t('AICreator.chars', '字')}</span>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading || showPricing}
            className="text-xs bg-[#C9A046] hover:bg-[#D4A853] disabled:bg-white/10 disabled:text-gray-600 text-black disabled:text-gray-600 font-medium px-4 py-1.5 rounded-lg transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin">⏳</span>
                {t('AICreator.parsing', '解析中...')}
              </span>
            ) : (
              <>{t('AICreator.submit', '提交解析')} · 1 USDT</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result?.success && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✅</span>
            <h3 className="text-sm font-semibold text-white">{t('AICreator.parseSuccess', '解析成功')}</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/[0.03] rounded-lg p-2">
              <span className="text-gray-500">{t('AICreator.strategyName', '策略名')}</span>
              <p className="text-white font-medium mt-0.5">{result.name}</p>
            </div>
            {result.symbol && (
              <div className="bg-white/[0.03] rounded-lg p-2">
                <span className="text-gray-500">{t('AICreator.symbol', '标的')}</span>
                <p className="text-white font-mono mt-0.5">{result.symbol}</p>
              </div>
            )}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <span className="text-gray-500">{t('AICreator.type', '策略类型')}</span>
              <p className="text-white mt-0.5">{result.strategy.type}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2">
              <span className="text-gray-500">{t('AICreator.params', '参数')}</span>
              <p className="text-white mt-0.5">{Object.keys(result.strategy.params).length} {t('AICreator.paramsCount', '个')}</p>
            </div>
          </div>

          {result.description && (
            <p className="text-xs text-gray-400 italic">"{result.description}"</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreateDirectly}
              className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-1.5 rounded-lg transition-all"
            >
              {t('AICreator.createNow', '直接创建策略')}
            </button>
            <button
              onClick={handleUseResult}
              className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-1.5 rounded-lg transition-all"
            >
              {t('AICreator.editFirst', '先编辑参数')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICreator;
