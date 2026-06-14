/**
* StrategyExpiryBanner — ML R176 G4 [P0] 策略到期主动推送UI
* Flashing badge + notification bar + "one-click AI optimize" button
* Integrates into StrategyPage header area
*/

import { useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface ExpiringStrategy {
  id: string;
  name: string;
  daysRemaining: number;
  lastOptimized: string; // ISO date
  currentSharpe: number;
  optimizedSharpe?: number;
  reason: string;
}

interface StrategyExpiryBannerProps {
  strategies?: ExpiringStrategy[];
  onOptimize?: (strategyId: string) => void;
  onDismiss?: (strategyId: string) => void;
  className?: string;
  // Legacy props from StrategyDetail integration
  strategyId?: string;
  strategyName?: string;
  lastOptimizedAt?: string;
  createdAt?: string;
  onNavigateOptimizer?: () => void;
}

// ── Mock expiring strategies ────────────────────────────────────────────

const MOCK_EXPIRING: ExpiringStrategy[] = [
  {
    id: 's-001',
    name: '多因子动量',
    daysRemaining: 3,
    lastOptimized: '2026-05-01',
    currentSharpe: 0.85,
    optimizedSharpe: 1.24,
    reason: '市场Beta因子衰减40%，需重新校准权重',
  },
  {
    id: 's-002',
    name: '低波动防御',
    daysRemaining: 7,
    lastOptimized: '2026-05-15',
    currentSharpe: 1.12,
    optimizedSharpe: 1.38,
    reason: '波动率因子IC下降至0.018，建议替换为品质因子',
  },
];

// ── Expiry Card ─────────────────────────────────────────────────────────

function ExpiryCard({
  strategy,
  onOptimize,
  onDismiss,
}: {
  strategy: ExpiringStrategy;
  onOptimize?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isUrgent = strategy.daysRemaining <= 3;
  const sharpeDelta = (strategy.optimizedSharpe ?? strategy.currentSharpe) - strategy.currentSharpe;

  const handleOptimize = async () => {
    setIsOptimizing(true);
    await new Promise((r) => setTimeout(r, 1500)); // simulate AI opt
    onOptimize?.(strategy.id);
    setIsOptimizing(false);
  };

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isUrgent
          ? 'bg-red-500/5 border-red-500/20 animate-pulse'
          : 'bg-yellow-500/5 border-yellow-500/20'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
              isUrgent
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-red-400 animate-ping' : 'bg-yellow-400'}`} />
            {isUrgent ? '⚠️ 即将失效' : '📅 即将到期'}
          </span>
          <span className="text-sm font-medium text-white">{strategy.name}</span>
        </div>
        <button
          onClick={() => { setDismissed(true); onDismiss?.(strategy.id); }}
          className="text-gray-600 hover:text-gray-400 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Info */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-gray-400">
            剩余 <span className={`font-semibold ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>{strategy.daysRemaining}天</span>
          </span>
          <span className="text-gray-500">上次优化: {strategy.lastOptimized}</span>
        </div>
        <p className="text-xs text-gray-500">{strategy.reason}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-3 text-center">
        <div className="bg-white/[0.02] rounded px-3 py-1.5">
          <div className="text-[9px] text-gray-500">当前Sharpe</div>
          <div className="text-xs text-white font-bold">{strategy.currentSharpe.toFixed(2)}</div>
        </div>
        {strategy.optimizedSharpe !== undefined && (
          <>
            <span className="text-gray-600">→</span>
            <div className="bg-green-500/5 border border-green-500/20 rounded px-3 py-1.5">
              <div className="text-[9px] text-green-400/70">优化后Sharpe</div>
              <div className="text-xs text-green-400 font-bold">
                {strategy.optimizedSharpe.toFixed(2)}
                <span className="text-[10px] ml-1">(+{sharpeDelta.toFixed(2)})</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="flex-1 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-xs transition-colors disabled:opacity-60"
        >
          {isOptimizing ? '⏳ AI优化中...' : '🤖 一键AI优化'}
        </button>
        <button
          onClick={onDismiss ? () => { setDismissed(true); onDismiss(strategy.id); } : undefined}
          className="px-3 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs transition-colors"
        >
          忽略
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function StrategyExpiryBanner({
  strategies: propStrategies,
  onOptimize,
  onDismiss,
  className = '',
}: StrategyExpiryBannerProps) {
  const strategies = propStrategies && propStrategies.length > 0 ? propStrategies : MOCK_EXPIRING;
  const [collapsed, setCollapsed] = useState(false);

  const urgentCount = strategies.filter((s) => s.daysRemaining <= 3).length;
  const totalCount = strategies.length;

  if (totalCount === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Badge bar */}
      <div
        className={`flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer transition-colors ${
          urgentCount > 0
            ? 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15'
            : 'bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15'
        }`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          {/* Flashing badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              urgentCount > 0
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-yellow-500 text-black'
            }`}
          >
            {totalCount}
          </span>
          <span className={`text-xs ${urgentCount > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
            {urgentCount > 0
              ? `${urgentCount} 个策略即将失效，建议立即优化`
              : `${totalCount} 个策略即将到期`}
          </span>
        </div>
        <span className="text-gray-500 text-xs">{collapsed ? '展开 ▼' : '收起 ▲'}</span>
      </div>

      {/* Expanded cards */}
      {!collapsed && (
        <div className="space-y-3">
          {strategies.map((s) => (
            <ExpiryCard
              key={s.id}
              strategy={s}
              onOptimize={onOptimize}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { StrategyExpiryBanner as default };
