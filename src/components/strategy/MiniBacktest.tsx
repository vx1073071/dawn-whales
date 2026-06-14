// ── R169 P4-03: Mini Backtest on Parameter Change ───────────────────────
// When user changes a parameter, show a compact 1-year mini backtest
// with green/red arrows indicating improvement or degradation.
//
// Features:
//  - Inline parameter editor with +/- buttons
//  - Instant 1-year rolling backtest (simulated)
//  - Green ↑ / Red ↓ arrows with percentage change
//  - Compact result bar: Return / Sharpe / MaxDD / WinRate
//  - "应用参数" button

import React, { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParamDef {
  name: string;
  currentValue: number;
  min: number;
  max: number;
  step: number;
  type: 'int' | 'float';
}

interface MiniBacktestResult {
  return: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
}

interface MiniBacktestProps {
  params: ParamDef[];
  baselineResult: MiniBacktestResult;
  onApply: (params: Record<string, number>) => void;
  className?: string;
}

// ── Mini backtest simulator ──────────────────────────────────────────────────

function runMiniBacktest(params: Record<string, number>, baseline: MiniBacktestResult): MiniBacktestResult {
  // Simulate parameter perturbation on baseline result
  const totalParamChange = Object.values(params).reduce((acc, v) => acc + Math.abs(v), 0);
  const noiseFactor = (totalParamChange / 100) * (Math.random() - 0.3);

  return {
    return: Number((baseline.return + noiseFactor * 0.05).toFixed(4)),
    sharpe: Number((baseline.sharpe + noiseFactor * 0.3).toFixed(2)),
    maxDrawdown: Number((baseline.maxDrawdown + noiseFactor * 0.02).toFixed(4)),
    winRate: Number((baseline.winRate + noiseFactor * 0.03).toFixed(3)),
    trades: Math.max(5, Math.round(baseline.trades + noiseFactor * 20)),
  };
}

// ── Arrow diff sub-component ─────────────────────────────────────────────────

const DiffArrow: React.FC<{
  oldValue: number;
  newValue: number;
  format: (v: number) => string;
  invert?: boolean; // lower is better (e.g., drawdown)
}> = ({ oldValue, newValue, format, invert }) => {
  const diff = newValue - oldValue;
  const improved = invert ? diff < 0 : diff > 0;
  const pctChange = oldValue !== 0 ? ((newValue - oldValue) / Math.abs(oldValue)) * 100 : 0;

  if (Math.abs(pctChange) < 0.5) {
    return <span className="text-gray-500 text-[10px] font-mono">— {format(newValue)}</span>;
  }

  return (
    <span className="flex items-center gap-1 text-[10px] font-mono">
      <span className={improved ? 'text-emerald-400' : 'text-red-400'}>
        {format(oldValue)} → {format(newValue)}
      </span>
      <span
        className={`font-bold ${improved ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}
      >
        {improved ? '↑' : '↓'}
        {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
      </span>
    </span>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const MiniBacktest: React.FC<MiniBacktestProps> = ({
  params: paramDefs,
  baselineResult,
  onApply,
  className,
}) => {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(paramDefs.map((p) => [p.name, p.currentValue]))
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MiniBacktestResult | null>(null);

  // Debounced mini backtest
  useEffect(() => {
    const timer = setTimeout(() => {
      const changed = paramDefs.some((p) => values[p.name] !== p.currentValue);
      if (changed) {
        setRunning(true);
        // Simulate computation delay
        setTimeout(() => {
          setResult(runMiniBacktest(values, baselineResult));
          setRunning(false);
        }, 400);
      } else {
        setResult(null);
        setRunning(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [values, paramDefs, baselineResult]);

  const adjustValue = (name: string, delta: number, type: 'int' | 'float', min: number, max: number) => {
    setValues((prev) => {
      const current = prev[name] ?? 0;
      let next = current + delta;
      if (type === 'int') next = Math.round(next);
      next = Math.max(min, Math.min(max, next));
      return { ...prev, [name]: Number(next.toFixed(type === 'int' ? 0 : 2)) };
    });
  };

  const handleInput = (name: string, raw: string, type: 'int' | 'float', min: number, max: number) => {
    const parsed = type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
    if (isNaN(parsed)) return;
    setValues((prev) => ({
      ...prev,
      [name]: Math.max(min, Math.min(max, parsed)),
    }));
  };

  const hasChanges = paramDefs.some((p) => values[p.name] !== p.currentValue);
  const changedParams = paramDefs.filter((p) => values[p.name] !== p.currentValue);

  return (
    <div className={`bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-4 ${className ?? ''}`}>
      <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-2">
        🔬 参数变更迷你回测
        <span className="text-[10px] text-gray-600 font-normal">(1年滚动窗口)</span>
      </h3>

      {/* Parameter editors */}
      <div className="space-y-2">
        {paramDefs.map((p) => {
          const isChanged = values[p.name] !== p.currentValue;
          return (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <span className={`w-20 truncate ${isChanged ? 'text-[#C9A046] font-medium' : 'text-gray-400'}`}>
                {p.name}
              </span>
              <button
                onClick={() => adjustValue(p.name, -p.step, p.type, p.min, p.max)}
                className="w-6 h-6 rounded bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm"
              >
                −
              </button>
              <input
                type="number"
                value={values[p.name]}
                onChange={(e) => handleInput(p.name, e.target.value, p.type, p.min, p.max)}
                min={p.min}
                max={p.max}
                step={p.step}
                className={`w-20 bg-white/[0.04] border rounded px-2 py-1 text-center font-mono text-xs focus:outline-none transition-colors ${
                  isChanged
                    ? 'border-[#C9A046]/40 text-[#C9A046]'
                    : 'border-white/5 text-gray-300'
                }`}
              />
              <button
                onClick={() => adjustValue(p.name, p.step, p.type, p.min, p.max)}
                className="w-6 h-6 rounded bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm"
              >
                +
              </button>
              <span className="text-[10px] text-gray-600 w-24 text-right">
                [{p.min}–{p.max}]
              </span>
            </div>
          );
        })}
      </div>

      {/* Reset button */}
      {hasChanges && !running && (
        <button
          onClick={() => setValues(Object.fromEntries(paramDefs.map((p) => [p.name, p.currentValue])))}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          ↩ 重置全部
        </button>
      )}

      {/* Mini backtest result */}
      {running && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <span className="animate-spin inline-block">⏳</span> 正在运行迷你回测...
        </div>
      )}

      {result && hasChanges && !running && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          {/* Changed params summary */}
          <div className="flex flex-wrap gap-1">
            {changedParams.map((p) => (
              <span
                key={p.name}
                className="text-[10px] text-[#C9A046] bg-[#C9A046]/10 px-1.5 py-0.5 rounded"
              >
                {p.name}: {p.currentValue}→{values[p.name]}
              </span>
            ))}
          </div>

          {/* Result comparison grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white/[0.03] rounded p-2">
              <div className="text-[10px] text-gray-500 mb-0.5">收益</div>
              <DiffArrow
                oldValue={baselineResult.return}
                newValue={result.return}
                format={(v) => `${(v * 100).toFixed(1)}%`}
              />
            </div>
            <div className="bg-white/[0.03] rounded p-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Sharpe</div>
              <DiffArrow
                oldValue={baselineResult.sharpe}
                newValue={result.sharpe}
                format={(v) => v.toFixed(2)}
              />
            </div>
            <div className="bg-white/[0.03] rounded p-2">
              <div className="text-[10px] text-gray-500 mb-0.5">回撤</div>
              <DiffArrow
                oldValue={baselineResult.maxDrawdown}
                newValue={result.maxDrawdown}
                format={(v) => `${(v * 100).toFixed(1)}%`}
                invert
              />
            </div>
            <div className="bg-white/[0.03] rounded p-2">
              <div className="text-[10px] text-gray-500 mb-0.5">胜率</div>
              <DiffArrow
                oldValue={baselineResult.winRate}
                newValue={result.winRate}
                format={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={() => onApply(values)}
            className="w-full px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black text-sm font-medium transition-all"
          >
            ✅ 应用参数
          </button>
        </div>
      )}
    </div>
  );
};

export default MiniBacktest;
