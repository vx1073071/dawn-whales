/**
* SmartContextPrefill — ML R182 P1-04 [P0] 智能上下文预填
* Detects user portfolio holdings and auto-prefills AI recommendation context.
* Shows: "基于你的持仓(3个因子/港股偏好/稳健风格)，AI已为你预选..."
*/

import { useState, useEffect, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface PortfolioContext {
  /** Factor IDs currently in portfolio */
  activeFactors: string[];
  /** Factor names (ID→nameZh) */
  factorNames: Record<string, string>;
  /** Market preference inferred from holdings */
  primaryMarket: string;
  /** Style preference inferred from factor composition */
  detectedStyle: 'momentum' | 'value' | 'balanced' | 'defensive' | 'unknown';
  /** Total factor count */
  factorCount: number;
  /** Last optimized date */
  lastOptimized?: string;
}

interface SmartContextPrefillProps {
  /** Portfolio context from store or IPC */
  context: PortfolioContext;
  /** Callback when user accepts prefill */
  onAccept: (selectedFactors: string[]) => void;
  /** Callback to ignore prefill */
  onIgnore: () => void;
  className?: string;
}

// ── Style detection ─────────────────────────────────────────────────────

function detectStyle(factors: string[]): PortfolioContext['detectedStyle'] {
  const names = factors.join(' ').toLowerCase();
  if (names.includes('momentum') || names.includes('动量')) return 'momentum';
  if (names.includes('value') || names.includes('价值') || names.includes('dividend')) return 'value';
  if (names.includes('quality') || names.includes('品质') || names.includes('low_vol') || names.includes('低波')) return 'defensive';
  if (factors.length >= 3) return 'balanced';
  return 'unknown';
}

// ── Style descriptions ─────────────────────────────────────────────────

const STYLE_DESCRIPTIONS: Record<string, { label: string; emoji: string; desc: string }> = {
  momentum: { label: '动量型', emoji: '🚀', desc: '偏好趋势跟踪和高增长因子' },
  value: { label: '价值型', emoji: '💎', desc: '偏好低估值和高股息因子' },
  defensive: { label: '防御型', emoji: '🛡️', desc: '偏好低波动和品质因子' },
  balanced: { label: '均衡型', emoji: '⚖️', desc: '多种因子均衡配置' },
  unknown: { label: '未知', emoji: '📊', desc: '尚未检测到明显风格偏好' },
};

// ── Component ───────────────────────────────────────────────────────────

export default function SmartContextPrefill({
  context,
  onAccept,
  onIgnore,
  className = '',
}: SmartContextPrefillProps) {
  const [accepted, setAccepted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const style = useMemo(() => detectStyle(context.activeFactors), [context.activeFactors]);
  const styleInfo = STYLE_DESCRIPTIONS[style];
  const daysSinceOptimized = context.lastOptimized
    ? Math.floor((Date.now() - new Date(context.lastOptimized).getTime()) / 86400000)
    : null;

  if (context.activeFactors.length === 0 || dismissed) {
    return null;
  }

  const handleAccept = () => {
    setAccepted(true);
    onAccept(context.activeFactors);
  };

  const handleDismiss = () => {
    setDismissed(true);
    onIgnore();
  };

  return (
    <div className={`bg-gradient-to-r from-[#D4A853]/5 to-[#1a1a25] border border-[#D4A853]/10 rounded-lg p-4 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <div>
            <div className="text-sm font-medium text-white">AI已了解你的偏好</div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              基于你的持仓自动分析
            </div>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-600 hover:text-gray-400 text-sm">
          ✕
        </button>
      </div>

      {/* Detected profile */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/[0.02] border border-white/5 rounded p-2 text-center">
          <div className="text-[9px] text-gray-500">持仓因子</div>
          <div className="text-sm font-bold text-[#D4A853]">{context.factorCount}个</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded p-2 text-center">
          <div className="text-[9px] text-gray-500">风格偏好</div>
          <div className="text-xs font-medium text-white">
            {styleInfo.emoji} {styleInfo.label}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded p-2 text-center">
          <div className="text-[9px] text-gray-500">主要市场</div>
          <div className="text-xs font-medium text-white">{context.primaryMarket || '—'}</div>
        </div>
      </div>

      {/* Detected factors */}
      <div>
        <div className="text-[10px] text-gray-500 mb-1.5">当前配置的因子:</div>
        <div className="flex flex-wrap gap-1">
          {context.activeFactors.map((fid) => (
            <span
              key={fid}
              className="text-[10px] bg-[#D4A853]/10 text-[#D4A853] px-2 py-0.5 rounded"
            >
              {context.factorNames[fid] || fid}
            </span>
          ))}
        </div>
      </div>

      {/* Style insight */}
      <div className="bg-white/[0.02] border border-white/5 rounded p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span>{styleInfo.emoji}</span>
          <span className="text-[10px] font-medium text-gray-300">
            {styleInfo.label}投资者
          </span>
        </div>
        <p className="text-[9px] text-gray-500 leading-relaxed">
          {styleInfo.desc}。
          {daysSinceOptimized && daysSinceOptimized > 14
            ? ` 上次优化已是${daysSinceOptimized}天前，建议让AI重新评估。`
            : ' AI可基于此偏好为你推荐最兼容的因子。'}
        </p>
      </div>

      {/* Actions */}
      {!accepted ? (
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-xs transition-colors"
          >
            ✅ 一键预填AI推荐
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs transition-colors"
          >
            自己选择
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/5 border border-green-500/10 rounded p-2">
          <span>✅</span>
          <span>已预填 {context.activeFactors.length} 个因子到AI推荐表单</span>
        </div>
      )}
    </div>
  );
}
