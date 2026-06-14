/**
* AIPriceBadge — ML R181 P0-07 [P0] AI按钮价格透明
* Every AI action button shows its price. Free actions say "免费".
* Insufficient balance greys out and shows "余额不足".
*/

import { useState, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface AIPriceConfig {
  /** Display label for the action */
  label: string;
  /** Price in USDT. 0 = free */
  price: number;
  /** For free actions, show this text instead of price */
  freeLabel?: string;
  /** Tooltip explanation */
  tooltip?: string;
}

interface AIPriceBadgeProps {
  config: AIPriceConfig;
  /** Current user balance in USDT */
  userBalance: number;
  /** If true, show as inline badge (compact) */
  inline?: boolean;
  className?: string;
}

// ── Default price configs for all AI features ───────────────────────────

export const AI_PRICES: Record<string, AIPriceConfig> = {
  aiRecommend: {
    label: 'AI因子推荐',
    price: 1.0,
    tooltip: '基于实时IC/IR动态计算最优因子组合',
  },
  aiAnalyze: {
    label: 'AI因子分析',
    price: 1.0,
    tooltip: '完整因子解读 + 回测验证',
  },
  aiOptimize: {
    label: 'AI权重优化',
    price: 1.5,
    tooltip: '遍历5000+权重组合寻找最优配置',
  },
  aiBacktest: {
    label: 'AI回测解读',
    price: 1.0,
    tooltip: '深度解读回测结果 + 改进建议',
  },
  aiSignal: {
    label: 'AI信号订阅',
    price: 0.5,
    tooltip: '实时因子信号推送(每次)',
  },
  aiDiagnosis: {
    label: 'AI组合诊断',
    price: 3.0,
    tooltip: '全组合健康检查 + 风险分析',
  },
  aiCompare: {
    label: 'AI策略对比',
    price: 2.0,
    tooltip: '两策略深度对比分析',
  },
  aiHealth: {
    label: 'AI健康检查',
    price: 1.0,
    tooltip: '策略衰减检测 + 优化建议',
  },
  aiFreePreview: {
    label: '免费预览',
    price: 0,
    freeLabel: '免费',
    tooltip: '无需付费即可查看基本数据',
  },
  aiRefresh: {
    label: '刷新推荐',
    price: 0,
    freeLabel: '免费',
    tooltip: '重新获取最新因子推荐',
  },
  aiUnlockAll: {
    label: '解锁全部',
    price: 1.0,
    tooltip: '解锁全部8个因子的深度分析',
  },
};

// ── Hook for user balance ───────────────────────────────────────────────

let _mockBalance = 250;

export function useAIBalance(): {
  balance: number;
  setBalance: (v: number) => void;
  deduct: (amount: number) => boolean;
  canAfford: (price: number) => boolean;
} {
  const [balance, setBalance] = useState(_mockBalance);

  const deduct = (amount: number): boolean => {
    if (balance < amount) return false;
    const newBalance = balance - amount;
    setBalance(newBalance);
    _mockBalance = newBalance;
    return true;
  };

  const canAfford = (price: number) => balance >= price;

  return { balance, setBalance, deduct, canAfford };
}

// ── Component ───────────────────────────────────────────────────────────

export default function AIPriceBadge({
  config,
  userBalance,
  inline = false,
  className = '',
}: AIPriceBadgeProps) {
  const isFree = config.price === 0;
  const canAfford = userBalance >= config.price;

  if (inline) {
    // Compact inline badge for buttons
    if (isFree) {
      return (
        <span className={`inline-flex items-center gap-0.5 text-[9px] bg-green-500/10 text-green-400 px-1 py-0.5 rounded font-medium ${className}`}>
          🆓 {config.freeLabel || '免费'}
        </span>
      );
    }
    if (!canAfford) {
      return (
        <span className={`inline-flex items-center gap-0.5 text-[9px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded ${className}`}>
          🔒 余额不足
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] bg-[#D4A853]/10 text-[#D4A853] px-1 py-0.5 rounded font-mono font-medium ${className}`}>
        {config.price.toFixed(1)}U
      </span>
    );
  }

  // Full badge with tooltip
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${
        isFree
          ? 'bg-green-500/5 border-green-500/20 text-green-400'
          : canAfford
          ? 'bg-[#D4A853]/5 border-[#D4A853]/20 text-[#D4A853]'
          : 'bg-red-500/5 border-red-500/20 text-red-400'
      } ${className}`}
      title={config.tooltip}
    >
      <span className="font-medium">{config.label}</span>
      {isFree ? (
        <span className="font-bold">{config.freeLabel || '免费'}</span>
      ) : (
        <span className="font-mono font-bold">
          {config.price.toFixed(1)} USDT
        </span>
      )}
      {!canAfford && !isFree && (
        <span className="text-[10px]">(余额不足)</span>
      )}
    </div>
  );
}

// ── Price-aware button wrapper ──────────────────────────────────────────

interface AIActionButtonProps {
  actionKey: keyof typeof AI_PRICES;
  userBalance: number;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function AIActionButton({
  actionKey,
  userBalance,
  onClick,
  disabled = false,
  loading = false,
  className = '',
  children,
}: AIActionButtonProps) {
  const config = AI_PRICES[actionKey];
  const canAfford = config.price === 0 || userBalance >= config.price;
  const isFree = config.price === 0;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading || !canAfford}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        canAfford
          ? isFree
            ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
            : 'bg-[#C9A046] hover:bg-[#D4A853] text-black'
          : 'bg-gray-500/10 text-gray-500 border border-white/5 cursor-not-allowed'
      } ${className}`}
    >
      {loading ? '⏳' : children || config.label}
      <AIPriceBadge config={config} userBalance={userBalance} inline />
    </button>
  );
}
