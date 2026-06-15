'use client';
import { useState } from 'react';

import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

interface Props {
  strategy: unknown;
  onExplain?: (explanation: string) => void;
}

export default function StrategyExplainCard({ strategy, onExplain }: Props) {
  const { t } = useTranslation();

  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  async function handleExplain() {
    setLoading(true);
    setError('');
    try {
      const result = await (window.api.strategy.explain as any)(strategy);
      if (result.success) {
        setExplanation(result.explanation as any);
        onExplain?.(result.explanation as any);
      } else {
        setError(result.error || i18n.t('StrategyExplainCard.k0'));
      }
    } catch (e: unknown) {
      setError((e as any).message || i18n.t('StrategyExplainCard.k1'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#1a1a25] border border-[#C9A046]/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-white font-semibold text-sm">{t('aiStrategyExplain')}</h3>
        </div>
        <div className="flex items-center gap-2">
          {!explanation && !loading &&
          <button
            onClick={handleExplain}
            className="px-3 py-1.5 bg-[#C9A046]/20 text-[#D4A853] rounded-lg text-xs hover:bg-[#C9A046]/30 transition-colors">{i18n.t("StrategyExplainCard.r92_18bc")}


          </button>
          }
          {explanation &&
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 hover:text-gray-300 text-xs">
            
              {collapsed ? t('components.expand') : t('collapse')}
            </button>
          }
        </div>
      </div>

      {loading &&
      <div className="flex items-center gap-2 text-gray-400 text-xs">
          <span className="animate-spin">⏳</span>
          <span>{i18n.t("StrategyExplainCard.r92_e270")}</span>
        </div>
      }

      {error &&
      <div className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
          {error}
        </div>
      }

      {explanation && !collapsed &&
      <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
          {explanation.split('\n').map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1" />;
          if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            return (
              <div key={i} className="flex gap-2 py-0.5 pl-2">
                  <span className="text-[#C9A046] mt-0.5">•</span>
                  <span>{trimmed.slice(2)}</span>
                </div>);

          }
          // Numbered lists
          const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
          if (numMatch) {
            return (
              <div key={i} className="flex gap-2 py-0.5 pl-2">
                  <span className="text-[#C9A046] font-medium min-w-[1rem]">{numMatch[1]}.</span>
                  <span>{numMatch[2]}</span>
                </div>);

          }
          // Section headers (all caps or short bold patterns)
          if (trimmed === trimmed.toUpperCase() && trimmed.length < 60 && !trimmed.includes('.')) {
            return <div key={i} className="text-[#D4A853] font-semibold text-xs mt-2 mb-1 uppercase tracking-wide">{trimmed}</div>;
          }
          return <div key={i} className="py-0.5">{trimmed}</div>;
        })}
        </div>
      }
    </div>);

}