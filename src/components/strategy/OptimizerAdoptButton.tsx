// ── R166 P1-X6: Optimizer Adopt Button ──────────────────────────────────
// One-click adopt optimal parameters from StrategyOptimizerPanel.
// Flow:
//  1. Click "采纳最优参数"
//  2. Confirmation modal: shows diff (old → new) with highlight
//  3. Apply → update strategy via store → auto-run backtest
//  4. Result: success toast with new vs old comparison
//
// Profit model: drives re-optimization → AI optimization 1.5U

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParamDiff {
  name: string;
  oldValue: number;
  newValue: number;
  changePct: number; // e.g., +15.3 or -8.2
}

interface OptimizerAdoptButtonProps {
  strategyId: string;
  strategyName?: string;
  /** Current strategy parameters */
  currentParams: Record<string, number>;
  /** Optimized parameters */
  optimizedParams: Record<string, number>;
  /** Adopt callback (apply + backtest) */
  onAdopt: (params: Record<string, number>) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

// ── Sub-component: Diff Modal ────────────────────────────────────────────────

const AdoptModal: React.FC<{
  diffs: ParamDiff[];
  onConfirm: () => void;
  onCancel: () => void;
  strategyName?: string;
}> = ({ diffs, onConfirm, onCancel, strategyName }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="bg-[#1a1a25] border border-white/10 rounded-xl p-5 w-[400px] max-w-[90vw] shadow-2xl">
      <h3 className="text-sm font-bold text-white mb-1">采纳优化参数</h3>
      <p className="text-xs text-gray-500 mb-4">
        将「{strategyName || '策略'}」的参数更新为优化结果。完成后将自动运行回测验证。
      </p>

      {/* Diff table */}
      <div className="bg-white/[0.03] rounded-lg overflow-hidden mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-gray-500">
              <th className="py-2 px-3 text-left">参数</th>
              <th className="py-2 px-3 text-right">当前</th>
              <th className="py-2 px-3 text-center">→</th>
              <th className="py-2 px-3 text-right">优化后</th>
              <th className="py-2 px-3 text-right">变化</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.name} className="border-b border-white/[0.02]">
                <td className="py-2 px-3 text-white font-medium">{d.name}</td>
                <td className="py-2 px-3 text-right text-gray-400 font-mono">
                  {Number.isInteger(d.oldValue) ? d.oldValue : d.oldValue.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-center text-gray-600">→</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                  {Number.isInteger(d.newValue) ? d.newValue : d.newValue.toFixed(2)}
                </td>
                <td className={`py-2 px-3 text-right font-mono font-medium ${
                  d.changePct > 0 ? 'text-emerald-400' : d.changePct < 0 ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {d.changePct > 0 ? '+' : ''}{d.changePct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black text-xs font-medium transition-all"
        >
          ✅ 采纳并回测验证
        </button>
      </div>
    </div>
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

export const OptimizerAdoptButton: React.FC<OptimizerAdoptButtonProps> = ({
  strategyId: _strategyId,
  strategyName,
  currentParams,
  optimizedParams,
  onAdopt,
  disabled,
  className,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [resultError, setResultError] = useState(false);

  // Compute diff between current and optimized
  const diffs = useMemo<ParamDiff[]>(() => {
    const allKeys = new Set([...Object.keys(currentParams), ...Object.keys(optimizedParams)]);
    return Array.from(allKeys)
      .map((key) => {
        const oldVal = currentParams[key] ?? 0;
        const newVal = optimizedParams[key] ?? 0;
        const changePct = oldVal !== 0 ? ((newVal - oldVal) / Math.abs(oldVal)) * 100 : (newVal !== 0 ? 100 : 0);
        return { name: key, oldValue: oldVal, newValue: newVal, changePct };
      })
      .filter((d) => d.oldValue !== d.newValue)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [currentParams, optimizedParams]);

  const hasChanges = diffs.length > 0;

  const handleConfirm = async () => {
    setAdopting(true);
    setResultMsg('');
    try {
      await onAdopt(optimizedParams);
      setResultMsg('✅ 参数已采纳，回测完成。新参数已生效。');
      setResultError(false);
      setShowModal(false);
    } catch (e) {
      setResultMsg(`❌ 采纳失败: ${(e as Error).message}`);
      setResultError(true);
    }
    setAdopting(false);
  };

  return (
    <>
      <button
        onClick={() => hasChanges ? setShowModal(true) : null}
        disabled={disabled || !hasChanges || adopting}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
          hasChanges && !disabled
            ? 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/30 text-emerald-400 hover:from-emerald-500/20 hover:to-blue-500/20 hover:shadow-lg hover:shadow-emerald-500/10'
            : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
        } ${className ?? ''}`}
        title={!hasChanges ? '参数无需更新' : `采纳 ${diffs.length} 项参数变更`}
      >
        {adopting ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin inline-block">⏳</span> 采纳中...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            ✅ 采纳最优参数
            {hasChanges && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                {diffs.length}项变更
              </span>
            )}
          </span>
        )}
      </button>

      {/* Result toast */}
      {resultMsg && (
        <div
          className={`mt-2 px-4 py-2 rounded-lg border text-xs ${
            resultError
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
        >
          {resultMsg}
        </div>
      )}

      {/* Confirmation modal */}
      {showModal && (
        <AdoptModal
          diffs={diffs}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          strategyName={strategyName}
        />
      )}
    </>
  );
};

export default OptimizerAdoptButton;
