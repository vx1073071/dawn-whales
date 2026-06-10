// AdaptiveParamPanel — Strategy parameter self-learning UI
// Phase 4.4 ML-38-02: Self-adaptive parameter adjustment for strategies
// Connects to AdaptiveParamEngine + RewardEngine
import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

interface ParameterHistory {
  timestamp: number;
  params: Record<string, number>;
  reward: number;
  pnl: number;
  sharpe: number;
  iteration: number;
}

interface AdaptiveState {
  strategyId: string;
  currentParams: Record<string, number>;
  suggestedParams: Record<string, number>;
  confidence: number;
  improvementPct: number;
  history: ParameterHistory[];
  learningRate: number;
  explorationRate: number;
  iterations: number;
  bestParams: Record<string, number>;
  bestReward: number;
}

interface Props {
  strategyId?: string;
  onApply?: (params: Record<string, number>) => void;
  onBack?: () => void;
  initialParams?: Record<string, number>;
}

// ── Param definitions for different strategy types ────────────────────────

const STRATEGY_PARAMS: Record<string, { label: string; key: string; min: number; max: number; step: number; unit: string }[]> = {
  'ma_cross': [
    { label: '快线周期', key: 'fastPeriod', min: 5, max: 50, step: 1, unit: '' },
    { label: '慢线周期', key: 'slowPeriod', min: 20, max: 200, step: 1, unit: '' },
    { label: '止损(%)', key: 'stopLoss', min: 1, max: 20, step: 0.5, unit: '%' },
    { label: '止盈(%)', key: 'takeProfit', min: 2, max: 50, step: 1, unit: '%' },
  ],
  'rsi': [
    { label: 'RSI 周期', key: 'period', min: 7, max: 28, step: 1, unit: '' },
    { label: '超卖阈值', key: 'oversold', min: 15, max: 40, step: 1, unit: '' },
    { label: '超买阈值', key: 'overbought', min: 60, max: 85, step: 1, unit: '' },
    { label: '止损(%)', key: 'stopLoss', min: 1, max: 15, step: 0.5, unit: '%' },
  ],
  'macd': [
    { label: '快线', key: 'fast', min: 8, max: 20, step: 1, unit: '' },
    { label: '慢线', key: 'slow', min: 21, max: 40, step: 1, unit: '' },
    { label: '信号线', key: 'signal', min: 5, max: 15, step: 1, unit: '' },
    { label: '止损(%)', key: 'stopLoss', min: 1, max: 15, step: 0.5, unit: '%' },
  ],
  'bollinger': [
    { label: '中轨周期', key: 'period', min: 10, max: 30, step: 1, unit: '' },
    { label: '标准差倍数', key: 'stdDev', min: 1.5, max: 3.5, step: 0.1, unit: 'σ' },
    { label: '止损(%)', key: 'stopLoss', min: 1, max: 15, step: 0.5, unit: '%' },
    { label: '止盈(%)', key: 'takeProfit', min: 2, max: 30, step: 1, unit: '%' },
  ],
};

const DEFAULT_PARAMS: Record<string, number> = {
  fastPeriod: 12, slowPeriod: 26, stopLoss: 5, takeProfit: 15,
  period: 14, oversold: 30, overbought: 70,
  fast: 12, slow: 26, signal: 9,
  stdDev: 2.0,
};

// ── Mock adaptive engine ──────────────────────────────────────────────────

function generateMockHistory(_strategyId: string, initialParams: Record<string, number>): ParameterHistory[] {
  const history: ParameterHistory[] = [];
  let params = { ...initialParams };

  for (let i = 0; i < 20; i++) {
    const reward = -5 + Math.random() * 15 + (i > 10 ? 3 : 0); // improving trend
    const pnl = +(reward * 100).toFixed(2);
    history.push({
      timestamp: Date.now() - (20 - i) * 60000,
      params: { ...params },
      reward: +reward.toFixed(3),
      pnl,
      sharpe: +((0.5 + reward * 0.15).toFixed(2)),
      iteration: i,
    });

    // Slight param drift
    for (const key of Object.keys(params)) {
      params[key] += (Math.random() - 0.45) * 0.5;
      params[key] = +Math.max(0.5, params[key]).toFixed(1);
    }
  }

  return history;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdaptiveParamPanel({ strategyId = 'ma_cross', onApply, onBack, initialParams }: Props) {
  const [state, setState] = useState<AdaptiveState>(() => {
    const params = initialParams || { ...DEFAULT_PARAMS };
    const history = generateMockHistory(strategyId, params);
    const lastReward = history[history.length - 1]?.reward || 0;
    const bestItem = history.reduce((best, h) => h.reward > best.reward ? h : best, history[0]);

    return {
      strategyId,
      currentParams: { ...params },
      suggestedParams: { ...params },
      confidence: 0.75,
      improvementPct: +(lastReward * 10).toFixed(1),
      history,
      learningRate: 0.1,
      explorationRate: 0.2,
      iterations: history.length,
      bestParams: bestItem?.params || params,
      bestReward: bestItem?.reward || 0,
    };
  });

  const [selectedParamSet, setSelectedParamSet] = useState<keyof typeof STRATEGY_PARAMS>('ma_cross');
  const [showHistory, setShowHistory] = useState(false);
  const [autoLearn, setAutoLearn] = useState(false);

  const paramDefs = STRATEGY_PARAMS[selectedParamSet] || STRATEGY_PARAMS['ma_cross'];

  const applySuggested = useCallback(() => {
    onApply?.(state.suggestedParams);
  }, [state.suggestedParams, onApply]);

  const resetToBest = useCallback(() => {
    setState(prev => ({ ...prev, currentParams: { ...prev.bestParams } }));
  }, []);

  // Auto-generate suggestions on interval when autoLearn is on
  useEffect(() => {
    if (!autoLearn) return;
    const timer = setInterval(() => {
      setState(prev => {
        const newSuggested = { ...prev.currentParams };
        for (const key of Object.keys(newSuggested)) {
          newSuggested[key] += (Math.random() - 0.5) * (prev.explorationRate * 5);
          newSuggested[key] = +Math.max(0.5, newSuggested[key]).toFixed(1);
        }
        return {
          ...prev,
          suggestedParams: newSuggested,
          iterations: prev.iterations + 1,
          confidence: +Math.min(1, prev.confidence + 0.02).toFixed(2),
        };
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [autoLearn]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">自适应参数优化</h2>
          <p className="text-xs text-gray-500 mt-1">
            {strategyId} · 已迭代 {state.iterations} 次 · 置信度 {(state.confidence * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex gap-2">
          {onBack && (
            <button onClick={onBack} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              返回
            </button>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLearn}
              onChange={e => setAutoLearn(e.target.checked)}
              className="rounded border-white/10 accent-[#D4A853]"
            />
            <span className="text-xs text-gray-400">自动学习</span>
          </label>
        </div>
      </div>

      {/* Strategy Type Selector */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">策略类型</h3>
        <div className="flex gap-2">
          {Object.keys(STRATEGY_PARAMS).map(key => (
            <button
              key={key}
              onClick={() => setSelectedParamSet(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedParamSet === key
                  ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/30'
                  : 'bg-[#0a0a12] text-gray-500 hover:text-gray-300 border border-white/5'
              }`}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Parameter Comparison: Current vs Suggested */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">参数对比</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Current */}
          <div>
            <div className="text-xs text-gray-500 mb-2">当前参数</div>
            {paramDefs.map(def => (
              <div key={def.key} className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-xs text-gray-400">{def.label}</span>
                <span className="text-xs text-white font-mono">
                  {state.currentParams[def.key]?.toFixed(1) || '-'}{def.unit}
                </span>
              </div>
            ))}
            {state.bestReward > 0 && (
              <button onClick={resetToBest} className="mt-2 text-xs text-[#D4A853] hover:underline">
                ↺ 恢复到最优参数 (reward: {state.bestReward.toFixed(2)})
              </button>
            )}
          </div>

          {/* Suggested */}
          <div>
            <div className="text-xs text-gray-500 mb-2">
              建议参数
              <span className="ml-2 text-green-400">
                {state.improvementPct > 0 ? `↑${state.improvementPct}%` : `${state.improvementPct}%`}
              </span>
            </div>
            {paramDefs.map(def => {
              const current = state.currentParams[def.key] || 0;
              const suggested = state.suggestedParams[def.key] || 0;
              const diff = suggested - current;
              const isChanged = Math.abs(diff) > 0.01;

              return (
                <div key={def.key} className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-xs text-gray-400">{def.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-mono ${isChanged ? 'text-[#D4A853]' : 'text-gray-500'}`}>
                      {suggested.toFixed(1)}{def.unit}
                    </span>
                    {isChanged && (
                      <span className={`text-[10px] font-mono ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={applySuggested}
              className="mt-3 w-full px-4 py-2 bg-[#D4A853]/20 hover:bg-[#D4A853]/30 text-[#D4A853] rounded-lg text-xs font-medium transition-colors"
            >
              应用建议参数
            </button>
          </div>
        </div>
      </div>

      {/* Reward History Chart */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-400">奖励历史</h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            {showHistory ? t('components.hide') : '显示全部'}
          </button>
        </div>

        {/* Sparkline */}
        <svg viewBox="0 0 200 40" className="w-full" preserveAspectRatio="none">
          <line x1="0" y1="20" x2="200" y2="20" stroke="#1a1a2e" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="0" x2="200" y2="0" stroke="#1a1a2e" strokeWidth="0.5" />
          <line x1="0" y1="40" x2="200" y2="40" stroke="#1a1a2e" strokeWidth="0.5" />
          <polyline
            points={state.history.map((h, i) => {
              const x = +(i / Math.max(1, state.history.length - 1) * 200).toFixed(1);
              const maxR = Math.max(...state.history.map(hh => hh.reward), 1);
              const minR = Math.min(...state.history.map(hh => hh.reward), 0);
              const range = Math.max(0.1, maxR - minR);
              const y = +((1 - (h.reward - minR) / range) * 40).toFixed(1);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke={state.improvementPct > 0 ? '#4ade80' : '#f87171'}
            strokeWidth="1.5"
          />
          {/* Best point */}
          {state.history.length > 0 && (
            <circle
              cx={state.history.indexOf(state.history.reduce((b, h) => h.reward > b.reward ? h : b)) / Math.max(1, state.history.length - 1) * 200}
              cy={(1 - (state.bestReward - Math.min(...state.history.map(hh => hh.reward), 0)) / Math.max(0.1, Math.max(...state.history.map(hh => hh.reward), 1) - Math.min(...state.history.map(hh => hh.reward), 0))) * 40}
              r="3"
              fill="#D4A853"
            />
          )}
        </svg>

        {showHistory && (
          <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
            {state.history.slice(-10).reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-[#0a0a12] rounded px-3 py-1.5 text-xs">
                <span className="text-gray-500">
                  {new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  {' '}#{h.iteration}
                </span>
                <div className="flex items-center gap-4">
                  <span className={`font-mono ${h.reward > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    R: {h.reward.toFixed(2)}
                  </span>
                  <span className={`font-mono ${h.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {h.pnl >= 0 ? '+' : ''}{h.pnl}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Learning config */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">学习参数</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">学习率</label>
            <input
              type="number"
              value={state.learningRate}
              onChange={e => setState(prev => ({ ...prev, learningRate: parseFloat(e.target.value) || 0.1 }))}
              min={0.01} max={0.5} step={0.01}
              className="w-24 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">探索率</label>
            <input
              type="number"
              value={state.explorationRate}
              onChange={e => setState(prev => ({ ...prev, explorationRate: parseFloat(e.target.value) || 0.2 }))}
              min={0.01} max={0.5} step={0.01}
              className="w-24 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">已迭代</label>
            <div className="text-white text-sm font-mono px-3 py-2">{state.iterations}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
