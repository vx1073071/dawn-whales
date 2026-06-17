// ── R191 ML P7-02: AIParameterOptimizer — AI参数优化 (1.5U/次) ──────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// Interactive AI-powered factor parameter optimizer.
// User inputs: lookback window, threshold range, market filters
// AI returns: optimized parameters + expected IC improvement + comparison
//
// Revenue: 1.5 USDT per optimization (manual parameter tweaking is free)
//
// Design:
// - Input panel: current params + allowed ranges
// - Processing: simulated AI thinking (loading animation)
// - Output: optimized params with before/after comparison
// - Paywall: preview shows "potential improvement", pay to see exact values
// - Dark theme, golden CTA buttons

import React, { useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OptimizerParams {
  lookbackDays: number;
  minLookback: number;
  maxLookback: number;
  threshold: number;
  minThreshold: number;
  maxThreshold: number;
  marketFilter: string;
  additionalParams?: Array<{ name: string; current: number; min: number; max: number }>;
}

export interface OptimizerResult {
  optimizedLookback: number;
  optimizedThreshold: number;
  expectedICImprovement: number;    // e.g. 0.005
  expectedSharpeImprovement: number;
  confidenceLevel: number;          // 0-100
  reasoning: string;
  warnings: string[];
  beforeAfter: {
    metric: string;
    before: string;
    after: string;
    improvement: string;
  }[];
}

interface AIParameterOptimizerProps {
  factorName: string;
  factorId: string;
  currentParams: OptimizerParams;
  /** User balance */
  userBalance?: number;
  /** Called to purchase optimization */
  onPurchaseOptimize?: (factorId: string, params: OptimizerParams) => void;
  /** If true, show full result. false = paywall */
  unlocked?: boolean;
  className?: string;
}

// ── Loading animation ────────────────────────────────────────────────────────

const OptimizerLoading: React.FC = () => {
  const steps = ['分析因子结构…', '扫描参数空间…', '验证过拟合风险…', '生成最优参数…'];
  const [step, setStep] = useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setStep(s => (s + 1) % steps.length), 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center py-8 space-y-3">
      <div className="w-10 h-10 border-2 border-[#D4A853]/30 border-t-[#D4A853] rounded-full animate-spin" />
      <p className="text-xs text-[#D4A853] font-bold">{steps[step]}</p>
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-[#D4A853] scale-125' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const AIParameterOptimizer: React.FC<AIParameterOptimizerProps> = ({
  factorName,
  factorId,
  currentParams,
  userBalance,
  onPurchaseOptimize,
  unlocked = false,
  className = '',
}) => {
  const [params, setParams] = useState<OptimizerParams>(currentParams);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);

  // Generate "optimized" result (demo)
  const runOptimization = useCallback(() => {
    setIsOptimizing(true);
    setResult(null);

    setTimeout(() => {
      const improvement = 0.003 + (factorId.charCodeAt(0) % 10) * 0.001;
      const optLookback = Math.round(params.lookbackDays * (0.7 + Math.random() * 0.6));
      const optThreshold = Math.round((params.threshold * (0.8 + Math.random() * 0.4)) * 100) / 100;

      setResult({
        optimizedLookback: Math.min(params.maxLookback, Math.max(params.minLookback, optLookback)),
        optimizedThreshold: Math.min(params.maxThreshold, Math.max(params.minThreshold, optThreshold)),
        expectedICImprovement: improvement,
        expectedSharpeImprovement: improvement * 22,
        confidenceLevel: 65 + (factorId.length * 5),
        reasoning: `基于12个月IC滚动分析，回看窗口从${params.lookbackDays}天调整为${optLookback}天可将信号噪声降低约${(improvement * 100).toFixed(1)}个百分点。阈值从${params.threshold}调整为${optThreshold.toFixed(0)}可提升信号纯度。`,
        warnings: [
          '参数优化基于历史数据，未来表现可能不同',
          '建议每季度重新优化一次',
          '避免过度优化——参数调整不应超过原值50%',
        ],
        beforeAfter: [
          { metric: '预期IC', before: '0.035', after: (0.035 + improvement).toFixed(3), improvement: `+${(improvement * 1000).toFixed(0)}bp` },
          { metric: '预期Sharpe', before: '0.85', after: (0.85 + improvement * 22).toFixed(2), improvement: `+${(improvement * 2200).toFixed(0)}bp` },
          { metric: '信号噪声比', before: '1.2', after: (1.2 + improvement * 30).toFixed(1), improvement: `+${((improvement * 3000) / 1.2).toFixed(0)}%` },
          { metric: '换手率', before: '45%', after: `${Math.round(45 * optLookback / params.lookbackDays)}%`, improvement: `-${Math.round(45 - 45 * optLookback / params.lookbackDays)}%` },
        ],
      });
      setIsOptimizing(false);
    }, 2500);
  }, [params, factorId]);

  const handleOptimize = () => {
    if (!unlocked) {
      onPurchaseOptimize?.(factorId, params);
      return;
    }
    runOptimization();
  };

  return (
    <div className={`rounded-xl border bg-white/[0.01] p-4 ${className}`}
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-bold text-white">🤖 AI参数优化</h4>
          <p className="text-[9px] text-gray-600 mt-0.5">{factorName} ({factorId})</p>
        </div>
        <span className="text-[9px] text-[#D4A853] bg-[#D4A853]/10 px-1.5 py-0.5 rounded-full border border-[#D4A853]/20">
          1.5 USDT/次
        </span>
      </div>

      {/* Parameter inputs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[9px] text-gray-500 block mb-1">
            回看天数: <span className="text-white font-mono">{params.lookbackDays}</span>
          </label>
          <input type="range" min={params.minLookback} max={params.maxLookback} value={params.lookbackDays}
            onChange={e => setParams(p => ({ ...p, lookbackDays: Number(e.target.value) }))}
            className="w-full h-1 accent-[#D4A853]" />
          <div className="flex justify-between text-[7px] text-gray-700">
            <span>{params.minLookback}</span><span>{params.maxLookback}</span>
          </div>
        </div>
        <div>
          <label className="text-[9px] text-gray-500 block mb-1">
            阈值: <span className="text-white font-mono">{params.threshold}</span>
          </label>
          <input type="range" min={params.minThreshold * 10} max={params.maxThreshold * 10} value={params.threshold * 10}
            onChange={e => setParams(p => ({ ...p, threshold: Number(e.target.value) / 10 }))}
            className="w-full h-1 accent-[#D4A853]" />
          <div className="flex justify-between text-[7px] text-gray-700">
            <span>{params.minThreshold}</span><span>{params.maxThreshold}</span>
          </div>
        </div>
      </div>

      {/* Optimize button */}
      <button
        onClick={handleOptimize}
        disabled={isOptimizing}
        className="w-full py-2.5 rounded-lg text-xs font-bold transition-all mb-4"
        style={{
          backgroundColor: isOptimizing ? 'rgba(212,168,83,0.2)' : '#D4A853',
          color: 'black',
          opacity: isOptimizing ? 0.6 : 1,
        }}
      >
        {isOptimizing ? '优化中…' : unlocked ? `🚀 开始优化` : `🔓 解锁AI优化 (1.5 USDT)`}
        {!unlocked && userBalance !== undefined && (
          <span className="ml-1 text-[10px] opacity-60">余额:{userBalance}U</span>
        )}
      </button>

      {/* Loading */}
      {isOptimizing && <OptimizerLoading />}

      {/* Results (blurred if not unlocked) */}
      {!isOptimizing && !unlocked && (
        <div className="relative">
          <div className="blur-sm space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-white/[0.02] text-center">
                <div className="text-gray-500">优化回看</div>
                <div className="text-[#D4A853] font-mono font-bold text-sm">???</div>
              </div>
              <div className="p-2 rounded bg-white/[0.02] text-center">
                <div className="text-gray-500">优化阈值</div>
                <div className="text-[#D4A853] font-mono font-bold text-sm">??.?</div>
              </div>
              <div className="p-2 rounded bg-white/[0.02] col-span-2 text-center">
                <div className="text-gray-500">预期IC提升</div>
                <div className="text-green-400 font-mono font-bold">+0.00? (点击解锁查看)</div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-gray-400">调整参数→点击"解锁AI优化"查看完整结果</p>
          </div>
        </div>
      )}

      {/* Full results */}
      {!isOptimizing && result && unlocked && (
        <div className="space-y-4">
          {/* Optimized values */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-3 rounded-lg bg-green-500/[0.05] border border-green-500/10 text-center">
              <div className="text-gray-500 mb-1">优化回看窗口</div>
              <div className="text-green-400 text-lg font-mono font-bold">{result.optimizedLookback}天</div>
              <div className="text-gray-600 text-[9px]">原值: {params.lookbackDays}天</div>
            </div>
            <div className="p-3 rounded-lg bg-green-500/[0.05] border border-green-500/10 text-center">
              <div className="text-gray-500 mb-1">优化阈值</div>
              <div className="text-green-400 text-lg font-mono font-bold">{result.optimizedThreshold}</div>
              <div className="text-gray-600 text-[9px]">原值: {params.threshold}</div>
            </div>
          </div>

          {/* IC improvement badge */}
          <div className="p-3 rounded-lg bg-[#D4A853]/5 border border-[#D4A853]/10 text-center">
            <div className="text-[10px] text-gray-500">预期IC提升</div>
            <div className="text-[#D4A853] text-xl font-mono font-bold">
              +{(result.expectedICImprovement * 1000).toFixed(0)}bp
            </div>
            <div className="text-[9px] text-gray-600">
              置信度: {result.confidenceLevel}% · Sharpe +{result.expectedSharpeImprovement.toFixed(2)}
            </div>
          </div>

          {/* Before/After table */}
          <div>
            <h5 className="text-[10px] text-gray-500 mb-2">优化前后对比</h5>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left font-normal p-1">指标</th>
                  <th className="text-right font-normal p-1">优化前</th>
                  <th className="text-right font-normal p-1">优化后</th>
                  <th className="text-right font-normal p-1">提升</th>
                </tr>
              </thead>
              <tbody>
                {result.beforeAfter.map((row, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="p-1 text-gray-400">{row.metric}</td>
                    <td className="p-1 text-right text-gray-500">{row.before}</td>
                    <td className="p-1 text-right text-green-400 font-bold">{row.after}</td>
                    <td className="p-1 text-right text-green-400 font-mono">{row.improvement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reasoning */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <h5 className="text-[10px] text-gray-500 mb-1">AI推理</h5>
            <p className="text-[10px] text-gray-300 leading-relaxed">{result.reasoning}</p>
          </div>

          {/* Warnings */}
          <div className="space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="text-[9px] text-yellow-400/80 flex items-start gap-1">
                <span>⚠️</span><span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIParameterOptimizer;
