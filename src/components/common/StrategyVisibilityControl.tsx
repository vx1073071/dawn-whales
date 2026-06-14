/**
* StrategyVisibilityControl — ML R179 G31 [P0] 策略可见性控制
* Three modes: 创作(private) / 分享(link) / 公开(marketplace)
* Controls what data is visible at each level
*/

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type VisibilityMode = 'private' | 'shared' | 'public';

interface VisibilityConfig {
  mode: VisibilityMode;
  label: string;
  icon: string;
  color: string;
  bg: string;
  description: string;
  visibleFields: string[]; // what data is shown at this level
}

const VISIBILITY_CONFIGS: Record<VisibilityMode, VisibilityConfig> = {
  private: {
    mode: 'private',
    label: '仅自己',
    icon: '🔒',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10 border-gray-500/20',
    description: '仅创建者可见，不对外展示',
    visibleFields: ['name', 'description', 'tags', 'factorWeights', 'params', 'backtest', 'equityCurve'],
  },
  shared: {
    mode: 'shared',
    label: '分享链接',
    icon: '🔗',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    description: '通过链接可查看，不在市场列表展示',
    visibleFields: ['name', 'description', 'tags', 'top3Factors', 'summaryMetrics', 'blurredBacktest'],
  },
  public: {
    mode: 'public',
    label: '公开发布',
    icon: '🌐',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    description: '在市场列表中可见，其他用户可搜索和购买',
    visibleFields: ['name', 'description', 'tags', 'top3Factors', 'summaryMetrics', 'blurredBacktest', 'creatorInfo', 'pricing'],
  },
};

// ── What each visibility level hides ───────────────────────────────────

const VISIBILITY_FILTERS: Record<VisibilityMode, (data: Record<string, unknown>) => Record<string, unknown>> = {
  private: (data) => data, // full access
  shared: (data) => {
    const { factorWeights, backtest, equityCurve, params, ...rest } = data;
    // Only show top 3 factors with rounded weights
    const top3 = factorWeights
      ? Object.entries(factorWeights as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, v]) => [k, Math.round(v * 100)]) // round to whole %
      : [];
    // Blurred backtest: only show direction
    const blurred = backtest
      ? { annualReturnDirection: (backtest as Record<string, number>).annualReturn > 0 ? 'positive' : 'negative' }
      : null;
    return { ...rest, top3Factors: top3, summaryMetrics: blurred };
  },
  public: (data) => {
    // Same as shared + creator info + pricing
    const shared = VISIBILITY_FILTERS.shared(data);
    return { ...shared, creatorInfo: true, pricing: true };
  },
};

// ── Component ───────────────────────────────────────────────────────────

interface StrategyVisibilityControlProps {
  currentMode: VisibilityMode;
  onChange: (mode: VisibilityMode) => void;
  strategyName?: string;
  className?: string;
}

export function StrategyVisibilityControl({
  currentMode,
  onChange,
  strategyName,
  className = '',
}: StrategyVisibilityControlProps) {
  const [confirmMode, setConfirmMode] = useState<VisibilityMode | null>(null);

  const handleModeSelect = useCallback(
    (mode: VisibilityMode) => {
      if (mode === 'public' && currentMode !== 'public') {
        // Require confirmation for going public
        setConfirmMode(mode);
      } else {
        onChange(mode);
      }
    },
    [currentMode, onChange]
  );

  const handleConfirm = useCallback(() => {
    if (confirmMode) {
      onChange(confirmMode);
      setConfirmMode(null);
    }
  }, [confirmMode, onChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-300">👁️ 策略可见性</h4>
        {strategyName && (
          <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{strategyName}</span>
        )}
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2">
        {(['private', 'shared', 'public'] as VisibilityMode[]).map((mode) => {
          const cfg = VISIBILITY_CONFIGS[mode];
          const isActive = currentMode === mode;
          return (
            <button
              key={mode}
              onClick={() => handleModeSelect(mode)}
              className={`p-3 rounded-lg border text-center transition-all ${
                isActive
                  ? `${cfg.bg} ${cfg.border}`
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="text-lg">{cfg.icon}</div>
              <div className={`text-xs font-medium mt-1 ${isActive ? cfg.color : 'text-gray-400'}`}>
                {cfg.label}
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{cfg.description}</div>
            </button>
          );
        })}
      </div>

      {/* Visibility details */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 mb-2">当前可见数据:</div>
        <div className="flex flex-wrap gap-1">
          {VISIBILITY_CONFIGS[currentMode].visibleFields.map((field) => (
            <span
              key={field}
              className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400"
            >
              {field === 'factorWeights'
                ? '完整因子权重'
                : field === 'top3Factors'
                ? '前3因子(模糊)'
                : field === 'backtest'
                ? '完整回测数据'
                : field === 'blurredBacktest'
                ? '回测方向(模糊)'
                : field === 'equityCurve'
                ? '权益曲线'
                : field === 'summaryMetrics'
                ? '摘要指标'
                : field === 'creatorInfo'
                ? '创作者信息'
                : field === 'pricing'
                ? '定价信息'
                : field}
            </span>
          ))}
        </div>
      </div>

      {/* Current mode indicator */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${VISIBILITY_CONFIGS[currentMode].bg} ${VISIBILITY_CONFIGS[currentMode].border}`}
      >
        <span>{VISIBILITY_CONFIGS[currentMode].icon}</span>
        <span className={VISIBILITY_CONFIGS[currentMode].color}>
          {VISIBILITY_CONFIGS[currentMode].label}模式
        </span>
        <span className="text-gray-500">— {VISIBILITY_CONFIGS[currentMode].description}</span>
      </div>

      {/* Confirmation modal for going public */}
      {confirmMode === 'public' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1A1A24] border border-white/10 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/5">
              <h3 className="text-white font-semibold">确认公开发布</h3>
              <p className="text-xs text-gray-400 mt-1">
                公开发布后，策略将在市场列表中展示，其他用户可搜索和购买。
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-yellow-500/5 border border-yellow-500/10 rounded p-3 text-[10px] text-yellow-400">
                ⚠️ 注意: 完整因子权重和回测数据不会公开。仅显示前3因子(模糊化)和收益方向。
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmMode(null)}
                  className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm"
                >
                  确认发布
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { VISIBILITY_CONFIGS, VISIBILITY_FILTERS };
export default StrategyVisibilityControl;
