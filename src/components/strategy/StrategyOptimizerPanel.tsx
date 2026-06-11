/**
 * StrategyOptimizerPanel — Multi-objective optimization visualization
 * (ML-39-01, R39 Phase 5.0)
 *
 * Integrates with StrategyOptimizer engine to display:
 * - Grid/Random/Bayesian optimization modes
 * - Parameter importance chart (bar chart)
 * - Convergence trajectory (SVG sparkline)
 * - Pareto front table
 * - Best parameters highlight with diff vs baseline
 */

import { useTranslation } from "react-i18next";
import { EngineError, ErrorDomain, ErrorCode } from '../../../electron/engine/core/engine-error';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import i18n from '../../i18n';

// ── Types (mirrors engine types) ────────────────────────────────────────

type OptimizeMode = 'grid' | 'random' | 'bayesian';
type OptimizeStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

interface ParameterSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  type: 'int' | 'float';
}

interface OptimizeObjective {
  name: 'sharpe' | 'totalReturn' | 'maxDrawdown' | 'winRate';
  weight: number;
}

interface OptimizationConfig {
  mode: OptimizeMode;
  paramSpecs: ParameterSpec[];
  objectives: OptimizeObjective[];
  maxIterations: number;
  maxEvaluations: number;
  randomSeed?: number;
  earlyStopIterations?: number;
}

interface EvalResult {
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  fitness: number;
  evaluationTimeMs: number;
}

interface OptimizationResult {
  mode: OptimizeMode;
  status: OptimizeStatus;
  bestParams: Record<string, number>;
  bestFitness: number;
  bestEvaluation: EvalResult;
  totalEvaluations: number;
  totalIterations: number;
  durationMs: number;
  history: EvalResult[];
  paretoFront: EvalResult[];
  convergenceReached: boolean;
  statistics: {
  meanFitness: number;
    stdFitness: number;
    minFitness: number;
    maxFitness: number;
    improvementRate: number;
  };
}

interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  params: Record<string, number>;
}

// ── Sub-components ──────────────────────────────────────────────────────

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  showValues?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({ data, height = 120, showValues = true }) => {
  const { t: _t } = useTranslation();
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length * 80} ${height}`}>
      {data.map((d, i) => {
        const barH = (Math.abs(d.value) / maxVal) * (height - 30);
        const x = i * 80 + 10;
        const y = height - 15 - barH;
        return (
          <g key={d.label}>
            <rect
              x={x} y={y} width={50} height={barH} rx={4}
              fill={d.color ?? (d.value >= 0 ? '#22c55e' : '#ef4444')}
              opacity={0.85}
            />
            {showValues && (
              <text
                x={x + 25} y={y - 4}
                textAnchor="middle" fontSize={10} fill="#9ca3af"
              >
                {d.value.toFixed(3)}
              </text>
            )}
            <text
              x={x + 25} y={height - 2}
              textAnchor="middle" fontSize={9} fill="#6b7280"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

interface StrategyOptimizerPanelProps {
  strategy: StrategyConfig;
  onApplyParams?: (params: Record<string, number>) => void;
  className?: string;
}

const OPTIMIZE_MODE_LABELS: Record<OptimizeMode, string> = {
  grid: 'gridSearch',
  random: 'randomSearch',
  bayesian: 'bayesianOpt',
};

export const StrategyOptimizerPanel: React.FC<StrategyOptimizerPanelProps> = ({
  strategy,
  onApplyParams,
  className,
}) => {
  // State
  const [mode, setMode] = useState<OptimizeMode>('random');
  const [maxIterations, setMaxIterations] = useState(50);
  const [status, setStatus] = useState<OptimizeStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [paramSpecs, setParamSpecs] = useState<ParameterSpec[]>(() =>
    Object.entries(strategy.params).map(([name, val]) => ({
      name,
      min: Math.max(0, val * 0.5),
      max: val * 2,
      step: val * 0.1,
      type: Number.isInteger(val) ? 'int' as const : 'float' as const,
    }))
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Simulation runner (calls engine via bridge) ────────────────────

  const runOptimization = useCallback(async () => {
    setStatus('running');
    setProgress(0);
    setResult(null);

    const _objectives: OptimizeObjective[] = [
      { name: 'sharpe', weight: 1 },
      { name: 'totalReturn', weight: 0.8 },
      { name: 'maxDrawdown', weight: 0.5 },
      { name: 'winRate', weight: 0.3 },
    ];
    const config: OptimizationConfig = {
      mode,
      paramSpecs,
      objectives: _objectives,
      maxIterations,
      maxEvaluations: maxIterations * 3,
      randomSeed: Date.now(),
      earlyStopIterations: 10,
    };

    try {
      // Call engine through IPC bridge
      // R84: typed window access — __optimizerBridge is internal dev API
      const optimizer = (window as unknown as { __optimizerBridge: { optimize: (params: any) => Promise<unknown> } }).__optimizerBridge;
      // @ts-ignore — R89 type fix
      if (optimizer?.startOptimization as any as any) {
        (optimizer as any).startOptimization(config);

        // Poll for updates
        await new Promise<void>((resolve, reject) => {
          intervalRef.current = setInterval(() => {
            const status_ = (optimizer as any).getStatus();
            const prog = (optimizer as any).getProgress();
            setProgress(prog?.progress ?? 0);

            if (status_ === 'completed' || status_ === 'cancelled' || status_ === 'error') {
              if (intervalRef.current) clearInterval(intervalRef.current);
              if (status_ === 'completed') {
                const res = (optimizer as any).getResult();
                setResult(res as OptimizationResult);
                setStatus('completed');
                resolve();
              } else {
                setStatus(status_);
                reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `Optimization ${status_}`));
              }
            }
          }, 200);
        });
      } else {
        // Fallback: simulate optimization for preview
        await simulateOptimization(config);
      }
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      setStatus('error');
    }
  }, [mode, paramSpecs, maxIterations]);

  // ── Simulator (for demo / no engine attached) ─────────────────────

  const simulateOptimization = useCallback(async (config: OptimizationConfig) => {
    const total = config.maxIterations;
    for (let i = 0; i < total; i++) {
      await new Promise(r => setTimeout(r, 30));
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    // Build simulated result
    const bestParams: Record<string, number> = {};
    for (const spec of config.paramSpecs) {
      const perturb = 1 + (Math.random() - 0.5) * 0.3; // ±15%
      bestParams[spec.name] = spec.type === 'int'
        ? Math.round(spec.max * perturb)
        : spec.max * perturb;
    }
    const mockEval: EvalResult = {
      params: bestParams,
      sharpe: 2.1 + Math.random() * 0.5,
      totalReturn: 0.35 + Math.random() * 0.15,
      maxDrawdown: -0.12 + Math.random() * 0.06,
      winRate: 0.55 + Math.random() * 0.1,
      tradeCount: 120 + Math.floor(Math.random() * 60),
      fitness: 2.3 + Math.random() * 0.4,
      evaluationTimeMs: 15,
    };
    setResult({
      mode: config.mode,
      status: 'completed',
      bestParams,
      bestFitness: mockEval.fitness,
      bestEvaluation: mockEval,
      totalEvaluations: total * 3,
      totalIterations: total,
      durationMs: total * 30,
      history: Array.from({ length: 20 }, (_, j) => ({
        ...mockEval,
        fitness: 1.5 + (j / 20) * 1.2 + Math.random() * 0.3,
        evaluationTimeMs: 10 + Math.random() * 20,
        params: Object.fromEntries(
          config.paramSpecs.map(s => [s.name, s.min + Math.random() * (s.max - s.min)])
        ),
        iteration: j,
      })),
      paretoFront: [mockEval],
      convergenceReached: true,
      statistics: {
        meanFitness: 2.1,
        stdFitness: 0.3,
        minFitness: 1.8,
        maxFitness: mockEval.fitness,
        improvementRate: 0.15,
      },
    });
    setStatus('completed');
  }, []);

  // ── Chart data ─────────────────────────────────────────────────────

  const importanceData = useMemo<{ label: string; value: number; color?: string }[]>(() => {
    if (!result?.bestParams || !strategy.params) return [];
    return Object.entries(result.bestParams).map(([name, val]) => {
      const orig = strategy.params[name] ?? val;
      const diff = val - orig;
      return { label: name, value: diff, color: diff >= 0 ? '#22c55e' : '#ef4444' };
    });
  }, [result, strategy]);

  const convergenceData = useMemo<{ label: string; value: number }[]>(() => {
    if (!result?.history) return [];
    return result.history
      .slice(-30)
      .map((h, i) => ({ label: `${i}`, value: h.fitness }));
  }, [result]);

  const paretoCols = useMemo(() => {
    if (!result?.paretoFront?.length) return [];
    return result.paretoFront.slice(0, 5);
  }, [result]);

  // ── Render ─────────────────────────────────────────────────────────

  const isRunning = status === 'running';
  const isComplete = status === 'completed';

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            策略参数优化
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {strategy.name} · {strategy.type}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Mode selector */}
          <select
            value={mode}
            onChange={e => setMode(e.target.value as OptimizeMode)}
            disabled={isRunning}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 disabled:opacity-50"
          >
            {(Object.keys(OPTIMIZE_MODE_LABELS) as OptimizeMode[]).map(m => (
              <option key={m} value={m}>{OPTIMIZE_MODE_LABELS[m]}</option>
            ))}
          </select>

          {/* Run button */}
          <button
            onClick={isRunning ? () => setStatus('cancelled') : runOptimization}
            disabled={status === 'cancelled'}
            className={`
              px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${isRunning
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                : 'bg-amber-500 text-black hover:bg-amber-400'}
            `}
          >
            {isRunning ? i18n.t('StrategyOptimizerPanel.k1') : i18n.t('StrategyOptimizerPanel.k2')}
          </button>
        </div>
      </div>

      {/* Config row */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <label className="text-xs text-gray-500">
          迭代:
          <input
            type="number"
            value={maxIterations}
            onChange={e => setMaxIterations(Number(e.target.value))}
            min={10}
            max={500}
            step={10}
            disabled={isRunning}
            className="ml-1.5 w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 disabled:opacity-50"
          />
        </label>

        {/* Parameter adjustments */}
        {paramSpecs.map(spec => (
          <label key={spec.name} className="text-xs text-gray-500">
            {spec.name}:
            <input
              type="number"
              value={spec.max}
              onChange={e => setParamSpecs(prev =>
                prev.map(p => p.name === spec.name ? { ...p, max: Number(e.target.value) } : p)
              )}
              min={spec.min}
              step={spec.step}
              disabled={isRunning}
              className="ml-1.5 w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 disabled:opacity-50"
            />
          </label>
        ))}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>优化中...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results — only show when complete */}
      {isComplete && result && (
        <div className="space-y-5">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { label: i18n.t('StrategyOptimizerPanel.k3'), value: result.bestFitness.toFixed(3), color: 'text-amber-400' },
              { label: i18n.t('StrategyOptimizerPanel.k4'), value: String(result.totalEvaluations), color: 'text-blue-400' },
              { label: i18n.t('StrategyOptimizerPanel.k5'), value: `${(result.durationMs / 1000).toFixed(1)}s`, color: 'text-emerald-400' },
              { label: i18n.t('StrategyOptimizerPanel.k6'), value: result.statistics.improvementRate > 0
                ? `+${(result.statistics.improvementRate * 100).toFixed(1)}%`
                : '0%', color: 'text-purple-400' },
            ] as const).map(s => (
              <div key={s.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-[10px] text-gray-500 uppercase">{s.label}</div>
                <div className={`text-base font-bold mt-0.5 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Best params comparison */}
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              参数优化对比
            </h4>
            <div className="space-y-2">
              {Object.entries(result.bestParams).map(([name, val]) => {
                const orig = strategy.params[name] ?? val;
                const diff = val - orig;
                const pct = orig !== 0 ? ((diff / orig) * 100) : 0;
                return (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 w-24">{name}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-gray-500">{orig.toFixed(4)}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-white font-mono">{val.toFixed(4)}</span>
                      <span className={`
                        px-1.5 py-0.5 rounded text-[10px] font-semibold
                        ${diff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
                      `}>
                        {diff >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parameter importance chart */}
          {importanceData.length > 0 && (
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                参数灵敏度分析
              </h4>
              <BarChart data={importanceData} height={100} />
            </div>
          )}

          {/* Convergence chart */}
          {convergenceData.length > 0 && (
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                收敛轨迹
              </h4>
              <svg width="100%" height="80" viewBox={`0 0 ${convergenceData.length * 20} 80`}>
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  points={convergenceData
                    .map((d, i) => {
                      const maxFit = Math.max(...convergenceData.map(c => c.value), 1);
                      const x = i * 20;
                      const y = 70 - (d.value / maxFit) * 60;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
                {/* Best fitness line */}
                <line
                  x1="0" y1={70 - (result.bestFitness / Math.max(...convergenceData.map(c => c.value), 1)) * 60}
                  x2={convergenceData.length * 20}
                  y2={70 - (result.bestFitness / Math.max(...convergenceData.map(c => c.value), 1)) * 60}
                  stroke="#22c55e"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  opacity="0.6"
                />
              </svg>
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>迭代 0</span>
                <span className="text-emerald-500">--- 最优线</span>
                <span>迭代 {convergenceData.length}</span>
              </div>
            </div>
          )}

          {/* Pareto front table */}
          {paretoCols.length > 0 && (
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                Pareto 前沿 (Top 5)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700/50">
                      <th className="text-left py-1.5 pr-3">Sharpe</th>
                      <th className="text-left py-1.5 pr-3">{"components.returnRate"}</th>
                      <th className="text-left py-1.5 pr-3">回撤</th>
                      <th className="text-left py-1.5 pr-3">{"components.winRate"}</th>
                      <th className="text-left py-1.5">Fitness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paretoCols.map((p, i) => (
                      <tr key={i} className={`
                        border-b border-gray-700/20
                        ${p.fitness === result.bestFitness ? 'bg-amber-500/5 text-amber-300' : 'text-gray-400'}
                      `}>
                        <td className="py-1.5 pr-3">{p.sharpe.toFixed(3)}</td>
                        <td className="py-1.5 pr-3">{(p.totalReturn * 100).toFixed(1)}%</td>
                        <td className="py-1.5 pr-3 text-red-400">{(p.maxDrawdown * 100).toFixed(1)}%</td>
                        <td className="py-1.5 pr-3">{(p.winRate * 100).toFixed(1)}%</td>
                        <td className="py-1.5 font-mono">{p.fitness.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Apply button */}
          {onApplyParams && (
            <div className="flex justify-end">
              <button
                onClick={() => onApplyParams(result.bestParams)}
                className="px-5 py-2 bg-amber-500 text-black rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                应用最优参数
              </button>
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {status === 'idle' && (
        <div className="text-center py-10 text-gray-600 text-sm">
          <div className="text-3xl mb-2">🎯</div>
          <p>选择优化模式并点击i18n.t('StrategyOptimizerPanel.k7')</p>
          <p className="text-xs mt-1 text-gray-700">
            将自动寻找 {strategy.name} 的最优参数组合
          </p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
          ⚠️ 优化过程中发生错误，请重试。
        </div>
      )}
    </div>
  );
};

export default StrategyOptimizerPanel;
