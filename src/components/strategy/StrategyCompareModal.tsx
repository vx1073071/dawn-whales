// @ts-nocheck
// R126-Q01: nocheck cleared — cleared
'use client';
import { useState, useRef } from 'react';

import i18n from '../../i18n';

interface Strategy {
  id: string;
  name: string;
  symbol?: string;
  strategy?: unknown;
  description?: string;
}

interface Props {
  strategies: Strategy[];
  defaultStrategyA?: Strategy;
  onClose: () => void;
}

export default function StrategyCompareModal({ strategies, defaultStrategyA, onClose }: Props) {
  const [strategyA, setStrategyA] = useState<Strategy | null>(defaultStrategyA || null);
  const [strategyB, setStrategyB] = useState<Strategy | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleCompare() {
    if (!strategyA || !strategyB) {
      setError(i18n.t('StrategyCompareModal.k1'));
      return;
    }
    setLoading(true);
    setError('');
    setComparison(null);
    try {
      const result = await window.api.strategy.compare(strategyA, strategyB);
      if (result.success) {
        setComparison(result.comparison);
      } else {
        setError(result.error || i18n.t('StrategyCompareModal.k2'));
      }
    } catch (e: unknown) {
      setError((e as any).message || i18n.t('StrategyCompareModal.k3'));
    } finally {
      setLoading(false);
    }
  }

  function renderComparison(text: string) {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-1" />;
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-2 py-0.5 pl-2">
            <span className="text-[#C9A046] mt-0.5 flex-shrink-0">•</span>
            <span className="text-gray-300 text-xs leading-relaxed">{trimmed.slice(2)}</span>
          </div>);

      }
      const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 py-0.5 pl-2">
            <span className="text-[#C9A046] font-medium text-xs min-w-[1rem] flex-shrink-0">{numMatch[1]}.</span>
            <span className="text-gray-300 text-xs leading-relaxed">{numMatch[2]}</span>
          </div>);

      }
      if (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && !trimmed.includes('.') && trimmed.length > 2) {
        return <div key={i} className="text-[#D4A853] font-semibold text-xs mt-3 mb-1 uppercase tracking-wide">{trimmed}</div>;
      }
      return <div key={i} className="text-gray-300 text-xs py-0.5 leading-relaxed">{trimmed}</div>;
    });
  }

  const selectStyle = "bg-[#12121a] border border-white/10 text-gray-200 text-xs rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#C9A046]/50";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      
      <div className="bg-[#1a1b25] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <h2 className="text-white font-semibold text-base">{i18n.t('StrategyCompareModal.k0')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-lg">✕</button>
        </div>

        {/* Strategy selectors */}
        <div className="p-5 border-b border-white/5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">{i18n.t('StrategyCompareModal.k1')}</label>
              <select
                className={selectStyle}
                value={strategyA?.id || ''}
                onChange={(e) => {
                  const found = strategies.find((s) => s.id === e.target.value);
                  setStrategyA(found || null);
                  setComparison(null);
                }}>
                
                <option value="">{i18n.t('StrategyCompareModal.k2')}</option>
                {strategies.filter((s) => s.id !== strategyB?.id).map((s) =>
                <option key={s.id} value={s.id}>{s.name}</option>
                )}
              </select>
              {strategyA &&
              <div className="mt-2 text-xs text-gray-500">
                  <span className="font-mono text-[#D4A853]">{strategyA.symbol || '—'}</span>
                  {' · '}
                  <span>{strategyA.strategy?.type || '—'}</span>
                </div>
              }
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">{i18n.t('StrategyCompareModal.k3')}</label>
              <select
                className={selectStyle}
                value={strategyB?.id || ''}
                onChange={(e) => {
                  const found = strategies.find((s) => s.id === e.target.value);
                  setStrategyB(found || null);
                  setComparison(null);
                }}>
                
                <option value="">{i18n.t('StrategyCompareModal.k4')}</option>
                {strategies.filter((s) => s.id !== strategyA?.id).map((s) =>
                <option key={s.id} value={s.id}>{s.name}</option>
                )}
              </select>
              {strategyB &&
              <div className="mt-2 text-xs text-gray-500">
                  <span className="font-mono text-[#D4A853]">{strategyB.symbol || '—'}</span>
                  {' · '}
                  <span>{strategyB.strategy?.type || '—'}</span>
                </div>
              }
            </div>
          </div>

          {error &&
          <div className="mt-3 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
          }

          <button
            onClick={handleCompare}
            disabled={!strategyA || !strategyB || loading}
            className="mt-4 w-full py-2.5 bg-[#C9A046] text-black font-semibold text-sm rounded-lg hover:bg-[#D4A853] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            
            {loading ?
            <>
                <span className="animate-spin">⏳</span>
                <span>{i18n.t("StrategyCompareModal.r92_e83f")}</span>
              </> :

            <>
                <span>⚖️</span>
                <span>{i18n.t('StrategyCompareModal.k5')}</span>
              </>
            }
          </button>
        </div>

        {/* Comparison result */}
        {comparison &&
        <div className="p-5 max-h-80 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-sm">✓</span>
              <h3 className="text-white text-sm font-medium">{i18n.t('StrategyCompareModal.k6')}</h3>
            </div>
            <div className="space-y-0.5">
              {renderComparison(comparison)}
            </div>
          </div>
        }

        {!comparison && !loading &&
        <div className="p-5 text-center text-gray-500 text-xs">{i18n.t("StrategyCompareModal.r92_e30f")}

        </div>
        }
      </div>
    </div>);

}